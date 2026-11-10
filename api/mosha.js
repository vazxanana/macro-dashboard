// The Mosha desk's trade log (owner, 10 Nov 2026: "And a place to mosha"). Five pre-registered studies found no fixed rule of the
// owner's Mosha trading that makes money, so what is left to measure is the owner's own selection: the trades the owner takes,
// written down with their stop before the result is known. This endpoint keeps that log.
//   GET  /api/mosha                     owner, or a member who may open the desks or the Mosha desk -> { trades, canWrite }
//   POST /api/mosha { save: {...} }     owner session only: a new trade, or changes to one (by id)
//   POST /api/mosha { remove: id }      owner session only
// Rules kept on the server (the page cannot bend them):
//   - every trade has a stop, on the losing side of the entry (the desk's rule 1);
//   - R is computed here from entry, stop and exit, never taken from the page;
//   - `pre` marks a trade written down while it was still open (before its result). A trade logged already closed is kept
//     apart ("added afterwards"); once a trade is closed its side, entry, stop and target cannot change.
// Stored privately in the Blob store as mosha/trades.json (500 kept). A log only: nothing here places, copies or changes a trade.
const S = require('./_session.js');
const KEEP = 500, MIN_T = Date.UTC(2020, 0, 1) / 1000;
const MARKETS = ['xau', 'xag', 'eurusd', 'gbpusd', 'nas100'], HOW = ['cf', 'zone', 'retest', 'other'], TF = ['M1', 'M5', 'M15', 'M30', 'H1'], H4 = ['with', 'against', ''];
function blobStore(env, io = {}) {
  const B = () => io.blob || require('@vercel/blob'), F = io.fetch || fetch, token = env.BLOB_READ_WRITE_TOKEN, P = 'mosha/trades.json';
  return {
    async get() { const { blobs } = await B().list({ prefix: P, token }); const b = blobs.find((x) => x.pathname === P); if (!b) return [];
      const r = await F(b.url, { headers: { Authorization: `Bearer ${token}` }, cache: 'no-store', signal: AbortSignal.timeout(8000) }); if (!r.ok) throw new Error(`mosha log read ${r.status}`); const j = await r.json(); return Array.isArray(j) ? j : []; },   // a failed read never looks empty (a save would overwrite the log)
    async put(list) { await B().put(P, JSON.stringify(list), { access: 'private', addRandomSuffix: false, allowOverwrite: true, contentType: 'application/json', token }); },
  };
}
const clean = (v, n) => String(v == null ? '' : v).replace(/[\u0000-\u0008\u000b\u000c\u000e-\u001f]/g, '').trim().slice(0, n);
const px = (v) => { const n = typeof v === 'number' ? v : typeof v === 'string' && v.trim() !== '' ? Number(v) : NaN; return Number.isFinite(n) && n > 0 && n < 1e7 ? +n.toFixed(5) : null; };
const pick = (v, list, d) => (list.includes(v) ? v : d);
// What an account may do on the Mosha desk: 'teach' (the owner, and a member allowed to send lessons), 'read', or false.
// A stored perms.mosha (the Users page) wins; then the account's own mosha flag (Luxus's built-in default); then the desks
// permission, which opens every desk to read (an explicit one wins over the role's default).
// Teaching is for ONE account (owner, 10 Nov 2026: "The functionality is only to work for" Luxus, "the key is his password"):
// only TEACHER may send lessons, judge the desk's answers and decide the book. His sign-in is all he needs. The owner and every
// other member who may open the desk read it; a stored 'teach' on any other account counts as 'read'.
const TEACHER = 'luxus';
function moshaLevel(acct) {
  if (!acct) return false; if (acct.u === 'owner') return 'read';
  const P = acct.perms || {}, m = P.mosha === false || P.mosha === 'read' || P.mosha === 'teach' ? P.mosha : acct.mosha === 'teach' || acct.mosha === 'read' ? acct.mosha : null;
  if (m != null) return m === 'teach' && acct.u !== TEACHER ? 'read' : m; const d = typeof P.desks === 'boolean' ? P.desks : acct.role === 'reviewer'; return d ? 'read' : false;
}
const canRead = (acct) => !!moshaLevel(acct);
// R of a closed trade: the exit against the entry, in units of the stop distance
function rOf(t) { const s = t.side === 'sell' ? -1 : 1, r0 = Math.abs(t.entry - t.stop); return r0 > 0 && t.exit != null ? +((s * (t.exit - t.entry)) / r0).toFixed(3) : null; }
// Checks one trade as sent by the page against the stored one (null for a new trade). Returns { trade } or { error }.
function build(b, old, now) {
  const nowS = Math.floor(now / 1000), closedBefore = !!old && old.status === 'closed';
  const side = closedBefore ? old.side : b.side === 'sell' || b.side === 'buy' ? b.side : null; if (!side) return { error: 'choose buy or sell' };
  const entry = closedBefore ? old.entry : px(b.entry), stop = closedBefore ? old.stop : px(b.stop);
  if (entry == null) return { error: 'the entry price is missing' };
  if (stop == null) return { error: 'every trade needs a stop: the stop price is missing' };
  if (side === 'sell' ? stop <= entry : stop >= entry) return { error: side === 'sell' ? 'a sell needs its stop above the entry' : 'a buy needs its stop below the entry' };
  let target = closedBefore ? old.target : b.target == null || b.target === '' ? null : px(b.target);
  if (!closedBefore && b.target != null && b.target !== '' && target == null) return { error: 'the target is not a price' };
  if (target != null && (side === 'sell' ? target >= entry : target <= entry)) return { error: side === 'sell' ? 'a sell needs its target below the entry' : 'a buy needs its target above the entry' };
  const at = closedBefore ? old.at : Math.floor(Number(b.at)); if (!Number.isFinite(at) || at < MIN_T || at > nowS + 86400) return { error: 'the entry time is missing or out of range' };
  const status = closedBefore || b.status === 'closed' ? 'closed' : 'open';
  let exit = null, exitAt = null;
  if (status === 'closed') {
    exit = px(b.exit != null && b.exit !== '' ? b.exit : old && old.exit); if (exit == null) return { error: 'a closed trade needs its exit price' };
    exitAt = Math.floor(Number(b.exitAt != null && b.exitAt !== '' ? b.exitAt : (old && old.exitAt) || nowS)); if (!Number.isFinite(exitAt) || exitAt < at || exitAt > nowS + 86400) return { error: 'the exit time must be after the entry' };
  }
  const r0 = Math.abs(entry - stop);
  const t = { id: old ? old.id : new Date(now).toISOString().replace(/\D/g, '').slice(0, 17) + Math.random().toString(36).slice(2, 6),
    market: closedBefore ? old.market : pick(String(b.market || '').toLowerCase(), MARKETS, old ? old.market : 'xau'), side, at, entry, stop, target,
    planRR: target != null ? +(Math.abs(target - entry) / r0).toFixed(2) : null,
    how: pick(b.how, HOW, old ? old.how : 'other'), tf: pick(b.tf, TF, old ? old.tf : 'M5'), h4: pick(b.h4, H4, old ? old.h4 : ''),
    swept: clean(b.swept != null ? b.swept : old && old.swept, 80), note: clean(b.note != null ? b.note : old && old.note, 1000),
    status, exit, exitAt, R: null,
    pre: old ? !!old.pre : status === 'open',                       // written down before the result was known
    logged: old ? old.logged : new Date(now).toISOString(), edited: old ? new Date(now).toISOString() : null };
  t.R = status === 'closed' ? rOf(t) : null;
  return { trade: t };
}
async function handle(req, res, d = {}) {
  const env = d.env || process.env; res.setHeader('Cache-Control', 'private, no-store');
  if (!env.BLOB_READ_WRITE_TOKEN && !d.store) return res.status(503).json({ error: 'storage not set up' });
  const store = d.store || blobStore(env), who = d.who || ((r) => S.fromRequest(r, env, S.defaultDeps(env), { cacheMs: 60e3 }));
  try {
    if (req.method !== 'GET' && req.method !== 'POST') return res.status(405).json({ error: 'GET or POST' });
    if (req.method === 'POST' && !(d.sameOrigin || S.sameOrigin)(req)) return res.status(403).json({ error: 'not allowed' });
    const acct = await who(req); if (!acct) return res.status(401).json({ error: 'sign in first' });
    if (!canRead(acct)) return res.status(403).json({ error: 'the Mosha desk is not open to this account' });
    const list = await store.get();
    if (req.method === 'GET') return res.status(200).json({ trades: list.slice().sort((a, b) => b.at - a.at), canWrite: acct.u === 'owner' });
    if (acct.u !== 'owner') return res.status(403).json({ error: 'only the owner writes the Mosha log' });
    let b; try { b = typeof req.body === 'string' ? JSON.parse(req.body || '{}') : req.body || {}; } catch (e) { return res.status(400).json({ error: 'bad JSON' }); }
    if (!b || typeof b !== 'object' || Array.isArray(b)) return res.status(400).json({ error: 'bad request' });
    if (b.remove) { const next = list.filter((x) => x.id !== String(b.remove)); if (next.length === list.length) return res.status(404).json({ error: 'no such trade' }); await store.put(next); return res.status(200).json({ ok: true, removed: 1 }); }
    if (!b.save || typeof b.save !== 'object' || Array.isArray(b.save)) return res.status(400).json({ error: 'nothing to save' });
    const old = b.save.id ? list.find((x) => x.id === String(b.save.id)) : null; if (b.save.id && !old) return res.status(404).json({ error: 'no such trade' });
    const out = build(b.save, old, d.now || Date.now()); if (out.error) return res.status(400).json({ error: out.error });
    if (!old && list.length >= KEEP) return res.status(400).json({ error: `the log holds ${KEEP} trades: export it and remove old ones first` });
    const next = old ? list.map((x) => (x.id === old.id ? out.trade : x)) : list.concat(out.trade); await store.put(next);
    return res.status(200).json({ ok: true, trade: out.trade });
  } catch (e) { return res.status(e.status === 503 ? 503 : 500).json({ error: 'the Mosha log is unavailable' }); }
}
module.exports = (req, res) => handle(req, res);
Object.assign(module.exports, { handle, blobStore, build, rOf, canRead, moshaLevel, TEACHER, KEEP });
