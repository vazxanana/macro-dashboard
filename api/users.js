// Dashboard accounts, kept in the private Vercel Blob store "meridian-users" (7 Nov 2026), so adding a user no longer
// needs a GitHub token in the owner's browser and works once the repo is private.
//   GET  /api/users                       -> { users: { key: { name, role, hash, ict?, disabled? } }, updated }
//   POST /api/users { ownerPw, users, note } -> saves the whole list; ownerPw must hash to the owner's password hash
// Each save is a new blob users/<time>-<random>.json (unique URL, so no stale CDN copy); older ones are deleted.
// First run: if the store is empty, it starts from council-data users.json (if that exists).
// the Blob SDK loads on first use (the list checks below stay testable without it)
const blob = () => require('@vercel/blob');
const put = (...a) => blob().put(...a), list = (...a) => blob().list(...a), del = (...a) => blob().del(...a);
const crypto = require('node:crypto');
const OWNER_HASH = '49c5624f2625ed8b42b6e1bf2819a3a41ddb9743aeca36ea34ea7eb96c252ca8';   // same as MS_ADMIN_HASH in the page
const sha = (s) => crypto.createHash('sha256').update(String(s), 'utf8').digest('hex');
const isOwner = (pw) => !!pw && String(pw).length <= 200 && crypto.timingSafeEqual(Buffer.from(sha(pw)), Buffer.from(OWNER_HASH));   // constant time
const tok = () => process.env.BLOB_READ_WRITE_TOKEN;

async function latest() {
  const { blobs } = await list({ prefix: 'users/', token: tok() });
  blobs.sort((a, b) => new Date(b.uploadedAt) - new Date(a.uploadedAt));
  return blobs;
}
async function load(req) {
  const blobs = await latest();
  if (blobs.length) {
    const r = await fetch(blobs[0].url, { headers: { Authorization: `Bearer ${tok()}` }, cache: 'no-store', signal: AbortSignal.timeout(8000) });
    if (!r.ok) throw new Error(`Blob ${r.status}`);
    return r.json();
  }
  try { const r = await fetch(`https://${req.headers.host}/cdata/users.json`, { signal: AbortSignal.timeout(8000) }); if (r.ok) { const j = await r.json(); if (j && j.users) return j; } } catch (e) {}
  return { users: {} };
}
const PERM_KEYS = ['charts', 'scanner', 'journal', 'desks', 'council', 'macro', 'ct', 'mcp', 'ict'];
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

module.exports = async (req, res) => {
  res.setHeader('Cache-Control', 'no-store');
  if (!tok()) return res.status(503).json({ error: 'BLOB_READ_WRITE_TOKEN not set' });
  try {
    if (req.method === 'GET') return res.status(200).json(await load(req));
    if (req.method !== 'POST') return res.status(405).json({ error: 'GET or POST' });
    let b; try { b = typeof req.body === 'string' ? (JSON.parse(req.body || '{}') || {}) : (req.body || {}); } catch (e) { return res.status(400).json({ error: 'bad JSON' }); }
    if (!isOwner(b.ownerPw)) return res.status(403).json({ error: 'Owner password not accepted' });
    const users = clean(b.users); if (!users) return res.status(400).json({ error: 'Bad user list' });
    if (Object.values(users).some((u) => u.hash === OWNER_HASH)) return res.status(400).json({ error: 'That password is the owner\'s' });
    const data = { users, updated: new Date().toISOString(), note: String(b.note || '').slice(0, 120) };
    const old = await latest();
    await put(`users/${Date.now()}.json`, JSON.stringify(data, null, 1), { access: 'private', addRandomSuffix: true, contentType: 'application/json', token: tok() });
    if (old.length) await del(old.map((x) => x.url), { token: tok() }).catch(() => {});
    console.log(`[users] ${data.note}`);
    return res.status(200).json(data);
  } catch (e) { console.error(`[users] ${e.message}`); return res.status(500).json({ error: String(e.message || e) }); }
};
module.exports._t = { clean, isOwner };

module.exports.clean = clean; module.exports.cleanPerms = cleanPerms;
