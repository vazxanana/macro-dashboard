// The decision journal (23 Nov 2026; design: research/proposals/2026-11-20-discretion.md). The studies say a person's edge, if
// there is one, is in the choosing, and only a choice stamped BEFORE the outcome can measure it. This endpoint keeps those
// choices: take or skip, with the levels, the method, a reason and a confidence, stamped by the server's clock.
//   GET  /api/journal                       the account's own calls -> { calls, canWrite }
//   POST /api/journal { call: {...} }       a new call (the server stamps `at`)
//   POST /api/journal { note: { id, text } } the one thing that may change after the stamp: the account's own note
//   POST /api/journal { remove: id }        withdraw the account's own call, only within DELETE_S (2 minutes) of its stamp: the
//                                            record STAYS, marked `withdrawn` (the proposal: nothing is deleted), so a call
//                                            taken back after a bad first move is still seen and counted apart (review, 23 Nov)
// Who: the owner, and a member whose desks permission is on (an explicit perms.desks wins; else reviewers, as the page).
// Rules kept on the server: every call has a stop on its losing side; side, levels, action, method, reason, confidence and
// `at` never change once stamped; each account reads only its own calls. Private store file journal/decisions.json,
// overwritten in place, so it is read with `?cache=0` (the store rules) and a failed read throws (never saved over).
// A record of choices only: nothing here places, sizes, copies or blocks a trade, and no council member reads it.
const S = require('./_session.js');
const J = require('./_journal.js');
const P = 'journal/decisions.json', KEEP = 5000, PER_ACCOUNT = 2000;
const fresh = (url) => { const u = new URL(url); u.searchParams.set('cache', '0'); return u.toString(); };
function blobStore(env, io = {}) {
  const B = () => io.blob || require('@vercel/blob'), F = io.fetch || fetch, token = env.BLOB_READ_WRITE_TOKEN;
  return {
    async get() { const { blobs } = await B().list({ prefix: P, token }); const b = blobs.find((x) => x.pathname === P); if (!b) return [];
      const r = await F(fresh(b.url), { headers: { Authorization: `Bearer ${token}` }, cache: 'no-store', signal: AbortSignal.timeout(8000) });
      if (!r.ok) throw new Error(`journal read ${r.status}`); const j = await r.json(); if (!Array.isArray(j)) throw new Error('journal file of another shape'); return j; },   // never saved over (review, 23 Nov 2026)
    async put(list) { await B().put(P, JSON.stringify(list), { access: 'private', addRandomSuffix: false, allowOverwrite: true, contentType: 'application/json', token }); },
  };
}
function canUse(acct) {
  if (!acct) return false; if (acct.u === 'owner') return true;
  const p = acct.perms || {}; return typeof p.desks === 'boolean' ? p.desks : acct.role === 'reviewer';
}
const own = (acct) => (x) => x && x.u === acct.u;
const view = (x) => { const { u, ...rest } = x; return rest; };   // the account key stays on the server
async function handle(req, res, d = {}) {
  const env = d.env || process.env; res.setHeader('Cache-Control', 'private, no-store');
  if (!env.BLOB_READ_WRITE_TOKEN && !d.store) return res.status(503).json({ error: 'storage not set up' });
  const store = d.store || blobStore(env), who = d.who || ((r) => S.fromRequest(r, env, S.defaultDeps(env)));
  try {
    if (req.method !== 'GET' && req.method !== 'POST') return res.status(405).json({ error: 'GET or POST' });
    if (req.method === 'POST' && !(d.sameOrigin || S.sameOrigin)(req)) return res.status(403).json({ error: 'not allowed' });
    const acct = await who(req); if (!acct) return res.status(401).json({ error: 'sign in first' });
    if (!canUse(acct)) return res.status(403).json({ error: 'the journal is not open to this account' });
    const list = await store.get();
    if (req.method === 'GET') return res.status(200).json({ calls: list.filter(own(acct)).sort((a, b) => b.at - a.at).map(view), canWrite: true, deleteS: J.DELETE_S });
    let b; try { b = typeof req.body === 'string' ? JSON.parse(req.body || '{}') : req.body || {}; } catch (e) { return res.status(400).json({ error: 'bad JSON' }); }
    if (!b || typeof b !== 'object' || Array.isArray(b)) return res.status(400).json({ error: 'bad request' });
    const nowS = Math.floor((d.now || Date.now()) / 1000);
    if (b.remove != null) {
      const x = list.find((y) => y.id === String(b.remove) && own(acct)(y)); if (!x) return res.status(404).json({ error: 'no such call' });
      if (x.withdrawn) return res.status(409).json({ error: 'this call is already withdrawn' });
      if (nowS - x.at > J.DELETE_S) return res.status(409).json({ error: 'a call can be withdrawn only in the first 2 minutes; add a note instead' });
      const w = { ...x, withdrawn: nowS };
      await store.put(list.map((y) => (y === x ? w : y))); return res.status(200).json({ ok: true, call: view(w) });
    }
    if (b.note && typeof b.note === 'object' && !Array.isArray(b.note)) {
      const x = list.find((y) => y.id === String(b.note.id) && own(acct)(y)); if (!x) return res.status(404).json({ error: 'no such call' });
      const next = list.map((y) => (y === x ? { ...y, note: J.clean(b.note.text, J.NOTE_N), noteAt: nowS } : y));
      await store.put(next); return res.status(200).json({ ok: true, call: view(next.find((y) => y.id === x.id)) });
    }
    if (!b.call) return res.status(400).json({ error: 'nothing to save (a call cannot be edited after it is stamped, only noted)' });
    if (b.call.id != null) return res.status(400).json({ error: 'a call cannot be edited after it is stamped, only noted' });
    const out = J.check(b.call, nowS); if (out.error) return res.status(400).json({ error: out.error });
    if (list.filter(own(acct)).length >= PER_ACCOUNT || list.length >= KEEP) return res.status(409).json({ error: 'the journal is full' });
    const call = { id: `${nowS}-${Math.random().toString(36).slice(2, 8)}`, u: acct.u, ...out.call };
    await store.put(list.concat(call)); return res.status(200).json({ ok: true, call: view(call) });
  } catch (e) { return res.status(e.status === 503 ? 503 : 500).json({ error: 'the journal is unavailable' }); }
}
module.exports = (req, res) => handle(req, res);
Object.assign(module.exports, { handle, blobStore, canUse, KEEP, PER_ACCOUNT, PATH: P });
