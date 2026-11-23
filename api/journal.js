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
// `at` never change once stamped; each account reads only its own calls. One private store file per account,
// journal/<account>.json (review, 23 Nov 2026: one shared file let two accounts' writes overwrite each other), overwritten in
// place, so it is read with `?cache=0` (the store rules) and a failed read throws (never saved over). Each account's writes run
// one at a time per instance (TAILS, as api/_academy-store.js); two instances writing the same account's file in the same
// moment can still lose one write (the store's documented limit; a conditional write is not tried yet). At most PER_ACCOUNT
// calls an account and POST_HOUR posts an account an hour (memory, per instance). A desk signal takes one call an account for
// good: a withdrawn call does not open it again (review: Take, withdraw, then Skip would have hidden the first choice).
// A record of choices only: nothing here places, sizes, copies or blocks a trade, and no council member reads it.
const S = require('./_session.js');
const J = require('./_journal.js');
const DIR = 'journal/', PER_ACCOUNT = 2000, POST_HOUR = 60;
const pathOf = (u) => `${DIR}${u}.json`;
const KEY_RE = /^[a-z0-9][a-z0-9-]{0,39}$/;
const fresh = (url) => { const u = new URL(url); u.searchParams.set('cache', '0'); return u.toString(); };
function blobStore(env, io = {}) {
  const B = () => io.blob || require('@vercel/blob'), F = io.fetch || fetch, token = env.BLOB_READ_WRITE_TOKEN;
  return {
    async get(u) { const P = pathOf(u); const { blobs } = await B().list({ prefix: P, token }); const b = blobs.find((x) => x.pathname === P); if (!b) return [];
      const r = await F(fresh(b.url), { headers: { Authorization: `Bearer ${token}` }, cache: 'no-store', signal: AbortSignal.timeout(8000) });
      if (!r.ok) throw new Error(`journal read ${r.status}`); const j = await r.json(); if (!Array.isArray(j)) throw new Error('journal file of another shape'); return j; },   // never saved over (review, 23 Nov 2026)
    async put(u, list) { await B().put(pathOf(u), JSON.stringify(list), { access: 'private', addRandomSuffix: false, allowOverwrite: true, contentType: 'application/json', token }); },
  };
}
const TAILS = new Map();   // account key -> the promise of its last write (one at a time per account, per instance)
function serial(key, fn) {
  const prev = TAILS.get(key) || Promise.resolve();
  const run = prev.catch(() => {}).then(fn);
  const tail = run.catch(() => {}); TAILS.set(key, tail); tail.then(() => { if (TAILS.get(key) === tail) TAILS.delete(key); });
  return run;
}
const HITS = new Map();   // account key -> post times (ms) in the last hour
function overLimit(key, nowMs, max) {
  const a = (HITS.get(key) || []).filter((t) => nowMs - t < 3600e3);
  if (a.length >= max) { HITS.set(key, a); return true; }
  a.push(nowMs); HITS.set(key, a); return false;
}
function canUse(acct) {
  if (!acct) return false; if (acct.u === 'owner') return true;
  const p = acct.perms || {}; return typeof p.desks === 'boolean' ? p.desks : acct.role === 'reviewer';
}
const own = (acct) => (x) => x && x.u === acct.u;
const view = (x) => { const { u, ...rest } = x; return rest; };   // the account key stays on the server
// any call of the account on that desk signal, withdrawn ones included: a signal takes one call an account
const anyCall = (calls, desk, id) => calls.find((c) => c && c.source && c.source.desk === desk && c.source.id === id) || null;
async function handle(req, res, d = {}) {
  const env = d.env || process.env; res.setHeader('Cache-Control', 'private, no-store');
  if (!env.BLOB_READ_WRITE_TOKEN && !d.store) return res.status(503).json({ error: 'storage not set up' });
  const store = d.store || blobStore(env), who = d.who || ((r) => S.fromRequest(r, env, S.defaultDeps(env)));
  try {
    if (req.method !== 'GET' && req.method !== 'POST') return res.status(405).json({ error: 'GET or POST' });
    if (req.method === 'POST' && !(d.sameOrigin || S.sameOrigin)(req)) return res.status(403).json({ error: 'not allowed' });
    const acct = await who(req); if (!acct) return res.status(401).json({ error: 'sign in first' });
    if (!canUse(acct)) return res.status(403).json({ error: 'the journal is not open to this account' });
    if (!KEY_RE.test(String(acct.u || ''))) return res.status(403).json({ error: 'the journal is not open to this account' });
    if (req.method === 'GET') { const list = (await store.get(acct.u)).filter(own(acct));
      return res.status(200).json({ calls: list.sort((a, b) => b.at - a.at).map(view), canWrite: true, deleteS: J.DELETE_S }); }
    let b; try { b = typeof req.body === 'string' ? JSON.parse(req.body || '{}') : req.body || {}; } catch (e) { return res.status(400).json({ error: 'bad JSON' }); }
    if (!b || typeof b !== 'object' || Array.isArray(b)) return res.status(400).json({ error: 'bad request' });
    const nowMs = d.now || Date.now(), nowS = Math.floor(nowMs / 1000);
    if (overLimit(acct.u, nowMs, d.postHour || POST_HOUR)) return res.status(429).json({ error: 'too many changes this hour; try again later' });
    return await serial(acct.u, async () => {
      const list = (await store.get(acct.u)).filter(own(acct));
      if (b.remove != null) {
        const x = list.find((y) => y.id === String(b.remove)); if (!x) return res.status(404).json({ error: 'no such call' });
        if (x.withdrawn) return res.status(409).json({ error: 'this call is already withdrawn' });
        if (nowS - x.at > J.DELETE_S) return res.status(409).json({ error: 'a call can be withdrawn only in the first 2 minutes; add a note instead' });
        const w = { ...x, withdrawn: nowS };
        await store.put(acct.u, list.map((y) => (y === x ? w : y))); return res.status(200).json({ ok: true, call: view(w) });
      }
      if (b.note && typeof b.note === 'object' && !Array.isArray(b.note)) {
        const x = list.find((y) => y.id === String(b.note.id)); if (!x) return res.status(404).json({ error: 'no such call' });
        const next = list.map((y) => (y === x ? { ...y, note: J.clean(b.note.text, J.NOTE_N), noteAt: nowS } : y));
        await store.put(acct.u, next); return res.status(200).json({ ok: true, call: view(next.find((y) => y.id === x.id)) });
      }
      if (!b.call) return res.status(400).json({ error: 'nothing to save (a call cannot be edited after it is stamped, only noted)' });
      if (b.call.id != null) return res.status(400).json({ error: 'a call cannot be edited after it is stamped, only noted' });
      const out = J.check(b.call, nowS); if (out.error) return res.status(400).json({ error: out.error });
      const src = out.call.source;
      if (src && J.DESKS.includes(src.desk) && src.id && anyCall(list, src.desk, src.id)) return res.status(409).json({ error: 'this signal already has your call (a withdrawn call stays on the record)' });
      if (list.length >= PER_ACCOUNT) return res.status(409).json({ error: 'the journal is full' });
      const call = { id: `${nowS}-${Math.random().toString(36).slice(2, 8)}`, u: acct.u, ...out.call };
      await store.put(acct.u, list.concat(call)); return res.status(200).json({ ok: true, call: view(call) });
    });
  } catch (e) { return res.status(e.status === 503 ? 503 : 500).json({ error: 'the journal is unavailable' }); }
}
module.exports = (req, res) => handle(req, res);
Object.assign(module.exports, { handle, blobStore, canUse, PER_ACCOUNT, POST_HOUR, pathOf, _reset: () => { TAILS.clear(); HITS.clear(); } });
