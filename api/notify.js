// Desk notifications (owner, 9 Nov 2026: "a notification icon in the corner, and when they log in it comes onto the screen; a
// feature on my profile to send a notification to all"). The owner posts; every signed-in member reads them.
//   GET  /api/notify                       signed in -> { items: [{ id, at, title, body }] } newest first (last 50)
//   POST /api/notify { title, body }       owner session only -> the new item; { remove: id } deletes one
// Stored privately in the Blob store as notices/list.json (100 kept). Read/unread is kept per browser and account (localStorage).
const S = require('./_session.js');
const KEEP = 100, SHOW = 50;
// Reads ask the Blob ORIGIN (`?cache=0`), never the CDN copy: the file is overwritten in place, and the CDN serves an overwritten
// file with its old bytes for up to a minute, so another function instance would show old data and its next save would drop
// what was stored in between (11 Nov 2026, the Academy store's bug; same fix).
const fresh = (url) => { const u = new URL(url); u.searchParams.set('cache', '0'); return u.toString(); };
function blobStore(env, io = {}) {
  const B = () => io.blob || require('@vercel/blob'), F = io.fetch || fetch, token = env.BLOB_READ_WRITE_TOKEN, P = 'notices/list.json';
  return {
    async get() { const { blobs } = await B().list({ prefix: P, token }); const b = blobs.find((x) => x.pathname === P); if (!b) return [];
      const r = await F(fresh(b.url), { headers: { Authorization: `Bearer ${token}` }, cache: 'no-store', signal: AbortSignal.timeout(8000) }); if (!r.ok) throw new Error(`notices read ${r.status}`); const j = await r.json(); return Array.isArray(j) ? j : []; },   // a failed read never looks empty (a POST would overwrite the list),
    async put(list) { await B().put(P, JSON.stringify(list), { access: 'private', addRandomSuffix: false, allowOverwrite: true, contentType: 'application/json', token }); },
  };
}
const clean = (v, n) => String(v == null ? '' : v).replace(/[\u0000-\u0008\u000b\u000c\u000e-\u001f]/g, '').trim().slice(0, n);
async function handle(req, res, d = {}) {
  const env = d.env || process.env; res.setHeader('Cache-Control', 'private, no-store');
  if (!env.BLOB_READ_WRITE_TOKEN && !d.store) return res.status(503).json({ error: 'storage not set up' });
  const store = d.store || blobStore(env), who = d.who || ((r) => S.fromRequest(r, env, S.defaultDeps(env), { cacheMs: 60e3 }));
  try {
    if (req.method !== 'GET' && req.method !== 'POST') return res.status(405).json({ error: 'GET or POST' });
    if (req.method === 'POST' && !(d.sameOrigin || S.sameOrigin)(req)) return res.status(403).json({ error: 'not allowed' });
    const acct = await who(req); if (!acct) return res.status(401).json({ error: 'sign in first' });
    const list = await store.get();
    if (req.method === 'GET') return res.status(200).json({ items: list.slice(-SHOW).reverse() });
    if (acct.u !== 'owner') return res.status(403).json({ error: 'only the owner sends notifications' });
    let b; try { b = typeof req.body === 'string' ? JSON.parse(req.body || '{}') : req.body || {}; } catch (e) { return res.status(400).json({ error: 'bad JSON' }); }
    b = b || {};
    if (b.remove) { const next = list.filter((x) => x.id !== String(b.remove)); await store.put(next); return res.status(200).json({ ok: true, removed: list.length - next.length }); }
    const title = clean(b.title, 80), body = clean(b.body, 1000); if (!title && !body) return res.status(400).json({ error: 'write a title or a message' });
    const at = new Date(d.now || Date.now()).toISOString(), item = { id: at.replace(/\D/g, '').slice(0, 17) + Math.random().toString(36).slice(2, 6), at, title: title || 'Message from the desk', body };
    const next = list.concat(item).slice(-KEEP); await store.put(next);
    return res.status(200).json({ ok: true, item });
  } catch (e) { return res.status(e.status === 503 ? 503 : 500).json({ error: 'notifications unavailable' }); }
}
module.exports = (req, res) => handle(req, res);
module.exports.handle = handle;
module.exports.blobStore = blobStore;
