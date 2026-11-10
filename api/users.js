// Dashboard accounts, kept in the private Vercel Blob store "meridian-users" (7 Nov 2026), so adding a user no longer
// needs a GitHub token in the owner's browser and works once the repo is private.
//   GET  /api/users   owner session  -> { users: { key: { name, role, ict?, ct?, mcp?, perms?, disabled? } }, builtins, updated }
//                     member session -> { users: { <own key>: own record } }      not signed in -> 401
//                     No password hash ever leaves the server (9 Nov 2026 security fix).
//   POST /api/users { users, note, ownerPw? }  owner session (or the owner password) -> saves the whole stored list.
//        A record keeps its stored (or built-in) password hash unless it carries `pw` (a new password, hashed here). A password
//        already used by another account or by the owner is refused. A record with no password at all is refused.
// Each save is a new blob users/<time>-<random>.json (unique URL, so no stale CDN copy); older ones are deleted.
// First run: if the store is empty, it starts from council-data users.json (if that exists).
// the Blob SDK loads on first use (the list checks below stay testable without it)
const blob = () => require('@vercel/blob');
const put = (...a) => blob().put(...a), list = (...a) => blob().list(...a), del = (...a) => blob().del(...a);
const crypto = require('node:crypto');
const A = require('./_accounts');
const S = require('./_session');
const G = require('./_guard');
const OWNER_HASH = A.OWNER_HASH;
const isOwner = (pw) => !!pw && String(pw).length <= 200 && crypto.timingSafeEqual(Buffer.from(A.sha(pw)), Buffer.from(OWNER_HASH));   // constant time
const tok = (env) => env.BLOB_READ_WRITE_TOKEN;

async function latest(env) {
  const { blobs } = await list({ prefix: 'users/', token: tok(env) });
  blobs.sort((a, b) => new Date(b.uploadedAt) - new Date(a.uploadedAt));
  return blobs;
}
// ictApply (10 Nov 2026): the member may apply changes to the ICT edge through the connector without the owner's review. Off
// for everyone by default; it lives in perms only (no record flag, no built-in): api/mcp.js canApply reads it on every apply
// call, and council/ict-apply.json on main is the second lock.
const PERM_KEYS = ['charts', 'scanner', 'journal', 'desks', 'council', 'macro', 'ct', 'mcp', 'ict', 'ictApply'];
const cleanPerms = (p) => { if (p == null) return null; if (typeof p !== 'object' || Array.isArray(p)) return null; const out = {};
  for (const [k, v] of Object.entries(p)) { if (!PERM_KEYS.includes(k)) return null; if (k === 'ict') { if (![false, true, 'read', 'write'].includes(v)) return null; out.ict = v === true ? 'write' : v; } else { if (typeof v !== 'boolean') return null; out[k] = v; } }
  return out; };
const clean = (users) => {
  if (!users || typeof users !== 'object' || Array.isArray(users)) return null;
  const out = {};
  for (const [k, u] of Object.entries(users)) {
    if (!/^[a-z0-9-]{1,24}$/.test(k) || k === 'owner' || !u || typeof u !== 'object') return null;   // "owner" is reserved (the owner's cTrader link)
    if (!/^[0-9a-f]{64}$/.test(String(u.hash || '')) || !['viewer', 'reviewer'].includes(u.role)) return null;
    // flags and per-member permissions (owner, 8 Nov): ict false | 'read' | 'write' (true = write), ct, mcp, and perms { key: bool | ict value }
    const ict = u.ict === 'read' ? 'read' : u.ict ? true : null, perms = cleanPerms(u.perms); if (u.perms && !perms) return null;
    out[k] = { name: String(u.name || k).slice(0, 24), role: u.role, hash: u.hash, ...(ict ? { ict } : {}), ...(u.ct ? { ct: true } : {}), ...(u.mcp ? { mcp: true } : {}), ...(perms ? { perms } : {}), ...(u.disabled ? { disabled: true } : {}) };
  }
  if (Object.keys(out).length > 200) return null;
  return out;
};
// the posted list (no hashes from the page) joined with the stored hashes: `pw` sets a new password; otherwise the stored
// record's hash, else the built-in one. A posted `hash` is ignored. Returns { users } or { error }.
function withHashes(posted, stored, builtIns = A.builtInUsers()) {
  if (!posted || typeof posted !== 'object' || Array.isArray(posted)) return { error: 'Bad user list' };
  const out = {}, fresh = new Set();
  for (const [k, u] of Object.entries(posted)) {
    if (!u || typeof u !== 'object') return { error: 'Bad user list' };
    const { pw, hash, ...rest } = u; let h = null;
    if (pw != null) { if (typeof pw !== 'string' || pw.trim().length < 4 || pw.length > 200) return { error: 'Use a password of at least 4 characters' }; h = A.sha(pw.trim()); fresh.add(k); }
    else h = (stored && stored[k] && stored[k].hash) || (builtIns[k] && builtIns[k].hash) || null;
    if (!h) return { error: `No password set for ${k}` };
    out[k] = { ...rest, hash: h };
  }
  // a new password must be unique: not the owner's, not another live account's (built-ins included)
  const live = { ...builtIns, ...out }; for (const k of Object.keys(live)) if (live[k] && live[k].disabled) delete live[k];
  for (const k of fresh) {
    if (A.same(out[k].hash, OWNER_HASH)) return { error: 'That password is the owner\'s' };
    if (Object.keys(live).some((j) => j !== k && A.same(live[j].hash, out[k].hash))) return { error: 'That password is already used by another account. Pick another one.' };
  }
  return { users: out };
}

async function handle(req, res, d = {}) {
  const env = d.env || process.env; res.setHeader('Cache-Control', 'private, no-store');
  if (!tok(env) && !d.load) return res.status(503).json({ error: 'BLOB_READ_WRITE_TOKEN not set' });
  const deps = d.deps || S.defaultDeps(env), load = d.load || (async () => (await A.blobUsers(env)) || { users: {} });
  try {
    if (req.method === 'GET') {
      const acct = await S.fromRequest(req, env, deps); if (!acct) return res.status(401).json({ error: 'sign in first' });
      const data = await load();
      if (acct.u === 'owner') return res.status(200).json({ users: A.stripHashes(data.users), builtins: A.stripHashes(d.builtIns || A.builtInUsers()), updated: data.updated || null });
      const { u, ...own } = acct; return res.status(200).json({ users: { [u]: own } });
    }
    if (req.method !== 'POST') return res.status(405).json({ error: 'GET or POST' });
    if (!S.sameOrigin(req)) return res.status(403).json({ error: 'Owner password not accepted' });
    let b; try { b = typeof req.body === 'string' ? (JSON.parse(req.body || '{}') || {}) : (req.body || {}); } catch (e) { return res.status(400).json({ error: 'bad JSON' }); }
    // the owner's session, else the owner password (counted against the shared password-guess limit, api/_guard.js)
    const acct = await S.fromRequest(req, env, deps).catch(() => null); let owner = !!acct && acct.u === 'owner';
    if (!owner && b.ownerPw) { const secs = G.wait(req); if (secs) return G.tooMany(res, secs); owner = isOwner(b.ownerPw); if (!owner) G.failed(req); }
    if (!owner) return res.status(403).json({ error: 'Owner password not accepted' });
    const cur = await load(), j = withHashes(b.users, (cur && cur.users) || {}, d.builtIns || A.builtInUsers()); if (j.error) return res.status(400).json({ error: j.error });
    const users = clean(j.users); if (!users) return res.status(400).json({ error: 'Bad user list' });
    if (Object.values(users).some((u) => u.hash === OWNER_HASH)) return res.status(400).json({ error: 'That password is the owner\'s' });
    const data = { users, updated: new Date().toISOString(), note: String(b.note || '').slice(0, 120) };
    if (d.save) await d.save(data); else {
      const old = await latest(env);
      await put(`users/${Date.now()}.json`, JSON.stringify(data, null, 1), { access: 'private', addRandomSuffix: true, contentType: 'application/json', token: tok(env) });
      if (old.length) await del(old.map((x) => x.url), { token: tok(env) }).catch(() => {});
    }
    console.log(`[users] ${data.note}`);
    return res.status(200).json({ users: A.stripHashes(users), builtins: A.stripHashes(d.builtIns || A.builtInUsers()), updated: data.updated, note: data.note });
  } catch (e) { console.error(`[users] ${e.message}`); return res.status(e.status === 503 ? 503 : 500).json({ error: 'account storage unavailable' }); }
}
module.exports = (req, res) => handle(req, res);
module.exports.handle = handle;
module.exports._t = { clean, isOwner, withHashes };
module.exports.clean = clean; module.exports.cleanPerms = cleanPerms;
