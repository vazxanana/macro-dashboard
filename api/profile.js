// Profile photo and display name per account, kept on the server (owner, 8 Nov 2026: "the profile photo gets back to default
// for some reason"). They used to live only in the browser's localStorage, which is not shared between Safari and the
// home-screen app, nor between devices, and Safari wipes it after a week without a visit.
//   GET  /api/profile?u=<user key | owner>   header X-MS-Auth: <the account's password hash, as the page keeps it>
//        -> { photo, name, at } or {} when nothing is stored yet
//   POST /api/profile { u, h, photo?, name? }  photo: a data:image/jpeg or png URL (<= 160 KB) or null to remove; name <= 24 chars
// The hash is checked against the same user list as the sign-in (built-in users + the Blob list; removed users refused; the owner
// against the owner hash). Stored privately in the Blob store as profiles/<key>.json. Nothing here touches trading.
const crypto = require('node:crypto');
const fs = require('node:fs');
const path = require('node:path');
const OWNER_HASH = '49c5624f2625ed8b42b6e1bf2819a3a41ddb9743aeca36ea34ea7eb96c252ca8';
const KEY_RE = /^[a-z0-9-]{1,24}$/;
const same = (a, b) => typeof a === 'string' && typeof b === 'string' && a.length === b.length && crypto.timingSafeEqual(Buffer.from(a), Buffer.from(b));

async function users(deps) {
  const ct = require('./ctrader-link.js')._t;
  let html = deps.pageHtml; if (html == null) { try { html = fs.readFileSync(path.join(process.cwd(), 'market-structure.html'), 'utf8'); } catch (e) { html = ''; } }
  const out = Object.assign(Object.create(null), ct.builtInUsers(html));
  const r = await deps.blobUsers();   // throws when the list cannot be read: fail closed
  for (const [k, u] of Object.entries((r && r.users) || {})) { if (u && u.disabled) delete out[k]; else out[k] = u; }
  return out;
}
async function allowed(deps, u, h) {
  if (!KEY_RE.test(String(u || '')) || !/^[0-9a-f]{64}$/.test(String(h || ''))) return false;
  if (u === 'owner') return same(h, OWNER_HASH);
  const R = (await users(deps))[u]; return !!(R && same(String(R.hash), h));
}
function blobStore(env) {
  const B = () => require('@vercel/blob'), token = env.BLOB_READ_WRITE_TOKEN;
  return {
    async get(u) { const { blobs } = await B().list({ prefix: `profiles/${u}.json`, token }); const b = blobs.find((x) => x.pathname === `profiles/${u}.json`); if (!b) return null;
      const r = await fetch(b.url, { headers: { Authorization: `Bearer ${token}` }, cache: 'no-store', signal: AbortSignal.timeout(8000) }); return r.ok ? r.json() : null; },
    async put(u, data) { await B().put(`profiles/${u}.json`, JSON.stringify(data), { access: 'private', addRandomSuffix: false, allowOverwrite: true, contentType: 'application/json', token }); },
  };
}

async function handle(req, res, d = {}) {
  const env = d.env || process.env; res.setHeader('Cache-Control', 'no-store');
  if (!env.BLOB_READ_WRITE_TOKEN && !d.store) return res.status(503).json({ error: 'storage not set up' });
  const ct = require('./ctrader-link.js')._t;
  const deps = { blobUsers: d.blobUsers || (() => ct.blobUsers(env, req.headers.host)), pageHtml: d.pageHtml }, store = d.store || blobStore(env);
  try {
    if (req.method === 'GET') {
      const u = String((req.query && req.query.u) || ''), h = String(req.headers['x-ms-auth'] || '');
      if (!(await allowed(deps, u, h))) return res.status(403).json({ error: 'not allowed' });
      return res.status(200).json((await store.get(u)) || {});
    }
    if (req.method !== 'POST') return res.status(405).json({ error: 'GET or POST' });
    let b; try { b = typeof req.body === 'string' ? JSON.parse(req.body || '{}') : req.body || {}; } catch (e) { return res.status(400).json({ error: 'bad JSON' }); }
    if (!(await allowed(deps, b.u, b.h))) return res.status(403).json({ error: 'not allowed' });
    const cur = (await store.get(b.u)) || {}, next = { ...cur };
    if ('photo' in b) { if (b.photo == null) delete next.photo; else if (typeof b.photo === 'string' && /^data:image\/(jpeg|png);base64,[A-Za-z0-9+/=]+$/.test(b.photo) && b.photo.length <= 160e3) next.photo = b.photo; else return res.status(400).json({ error: 'photo must be a JPEG or PNG under 160 KB' }); }
    if ('name' in b) { const n = b.name == null ? '' : String(b.name).replace(/[<>]/g, '').trim().slice(0, 24); if (n) next.name = n; else delete next.name; }
    next.at = new Date().toISOString(); await store.put(b.u, next);
    return res.status(200).json(next);
  } catch (e) { return res.status(e.status || 500).json({ error: 'profile storage unavailable' }); }
}
module.exports = (req, res) => handle(req, res);
module.exports.handle = handle;
module.exports._t = { allowed, users };
