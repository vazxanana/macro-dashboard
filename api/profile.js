// Profile photo and display name per account, kept on the server (owner, 8 Nov 2026: "the profile photo gets back to default
// for some reason"). They used to live only in the browser's localStorage, which is not shared between Safari and the
// home-screen app, nor between devices, and Safari wipes it after a week without a visit.
//   GET  /api/profile                       -> { photo, name, at } or {} for the signed-in account
//   POST /api/profile { photo?, name? }     photo: a data:image/jpeg or png URL (<= 160 KB) or null to remove; name <= 24 chars
// Who: the session cookie from /api/login (9 Nov 2026 security fix; it used to trust a password hash sent by the page). The
// account is re-checked against the user list on every call (removed members refused; fails closed). Each account reads and
// writes only its own record. Stored privately in the Blob store as profiles/<key>.json. Nothing here touches trading.
const S = require('./_session');

// Reads ask the Blob ORIGIN (`?cache=0`), never the CDN copy: the file is overwritten in place, and the CDN serves an overwritten
// file with its old bytes for up to a minute, so another function instance would show old data and its next save would drop
// what was stored in between (11 Nov 2026, the Academy store's bug; same fix).
const fresh = (url) => { const u = new URL(url); u.searchParams.set('cache', '0'); return u.toString(); };
function blobStore(env, io = {}) {
  const B = () => io.blob || require('@vercel/blob'), F = io.fetch || fetch, token = env.BLOB_READ_WRITE_TOKEN;
  return {
    async get(u) { const { blobs } = await B().list({ prefix: `profiles/${u}.json`, token }); const b = blobs.find((x) => x.pathname === `profiles/${u}.json`); if (!b) return null;
      const r = await F(fresh(b.url), { headers: { Authorization: `Bearer ${token}` }, cache: 'no-store', signal: AbortSignal.timeout(8000) }); if (!r.ok) throw new Error(`profile read ${r.status}`); return r.json(); },   // a failed read never looks empty (a save would drop the photo)
    async put(u, data) { await B().put(`profiles/${u}.json`, JSON.stringify(data), { access: 'private', addRandomSuffix: false, allowOverwrite: true, contentType: 'application/json', token }); },
  };
}

async function handle(req, res, d = {}) {
  const env = d.env || process.env; res.setHeader('Cache-Control', 'private, no-store');
  if (!env.BLOB_READ_WRITE_TOKEN && !d.store) return res.status(503).json({ error: 'storage not set up' });
  const deps = d.deps || S.defaultDeps(env), store = d.store || blobStore(env);
  try {
    if (req.method !== 'GET' && req.method !== 'POST') return res.status(405).json({ error: 'GET or POST' });
    if (req.method === 'POST' && !S.sameOrigin(req)) return res.status(403).json({ error: 'not allowed' });
    const acct = await S.fromRequest(req, env, deps); if (!acct) return res.status(401).json({ error: 'sign in first' });
    const u = acct.u;
    if (req.method === 'GET') return res.status(200).json((await store.get(u)) || {});
    let b; try { b = typeof req.body === 'string' ? JSON.parse(req.body || '{}') : req.body || {}; } catch (e) { return res.status(400).json({ error: 'bad JSON' }); }
    b = b == null ? {} : b; if (typeof b !== 'object' || Array.isArray(b)) return res.status(400).json({ error: 'bad JSON' });   // 5, "x", [..] used to throw a 500
    const cur = (await store.get(u)) || {}, next = { ...cur };
    if ('photo' in b) { if (b.photo == null) delete next.photo; else if (typeof b.photo === 'string' && /^data:image\/(jpeg|png);base64,[A-Za-z0-9+/=]+$/.test(b.photo) && b.photo.length <= 160e3) next.photo = b.photo; else return res.status(400).json({ error: 'photo must be a JPEG or PNG under 160 KB' }); }
    if ('name' in b) { const n = b.name == null ? '' : String(b.name).replace(/[<>]/g, '').trim().slice(0, 24); if (n) next.name = n; else delete next.name; }
    next.at = new Date().toISOString(); await store.put(u, next);
    return res.status(200).json(next);
  } catch (e) { return res.status(e.status === 503 ? 503 : 500).json({ error: 'profile storage unavailable' }); }
}
module.exports = (req, res) => handle(req, res);
module.exports.handle = handle;
module.exports.blobStore = blobStore;
