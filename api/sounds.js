// ChronosTrade trade sounds, chosen by the owner only (owner, 9 Nov 2026: "I'm the only one who can choose the sounds for SL and TP,
// on my profile"). The sounds play for everyone who uses ChronosTrade, on every device.
//   GET  /api/sounds                         -> { sl: { name, data } | null, tp: { name, data } | null }   (public: sounds are not secret)
//   POST /api/sounds { ownerPw, kind: 'sl'|'tp', data: <data:audio/... URL ≤ 700 KB> | null, name }   owner password only
// Stored privately in the Blob store as sounds/config.json. Without a stored stop-loss sound the page plays /assets/sounds/sl.mp3
// (the owner's clip, shipped with the site); without a target sound, the built-in chime.
const isOwner = (pw) => require('./users.js')._t.isOwner(pw);
const S = require('./_session.js');
const G = require('./_guard.js');
const MAX = 700 * 1024;
// Reads ask the Blob ORIGIN (`?cache=0`), never the CDN copy: the file is overwritten in place, and the CDN serves an overwritten
// file with its old bytes for up to a minute, so another function instance would show old data and its next save would drop
// what was stored in between (11 Nov 2026, the Academy store's bug; same fix).
const fresh = (url) => { const u = new URL(url); u.searchParams.set('cache', '0'); return u.toString(); };
function blobStore(env, io = {}) {
  const B = () => io.blob || require('@vercel/blob'), F = io.fetch || fetch, token = env.BLOB_READ_WRITE_TOKEN, P = 'sounds/config.json';
  return {
    async get() { const { blobs } = await B().list({ prefix: P, token }); const b = blobs.find((x) => x.pathname === P); if (!b) return null;
      const r = await F(fresh(b.url), { headers: { Authorization: `Bearer ${token}` }, cache: 'no-store', signal: AbortSignal.timeout(8000) }); if (!r.ok) throw new Error(`sounds read ${r.status}`); return r.json(); },   // a failed read never looks empty (a POST would drop the other sound)
    async put(data) { await B().put(P, JSON.stringify(data), { access: 'private', addRandomSuffix: false, allowOverwrite: true, contentType: 'application/json', token }); },
  };
}
async function handle(req, res, d = {}) {
  const env = d.env || process.env;
  if (!env.BLOB_READ_WRITE_TOKEN && !d.store) return res.status(503).json({ error: 'storage not set up' });
  const store = d.store || blobStore(env), owner = d.isOwner || isOwner;
  try {
    if (req.method === 'GET') { res.setHeader('Cache-Control', 'public, max-age=60'); const c = (await store.get()) || {}; return res.status(200).json({ sl: c.sl || null, tp: c.tp || null }); }
    res.setHeader('Cache-Control', 'no-store');
    if (req.method !== 'POST') return res.status(405).json({ error: 'GET or POST' });
    if (!S.sameOrigin(req)) return res.status(403).json({ error: 'not allowed' });
    let b; try { b = typeof req.body === 'string' ? JSON.parse(req.body || '{}') : req.body; } catch (e) { b = null; } if (!b || typeof b !== 'object') b = {};
    // the owner's session (same-origin, checked above) or the owner password
    const viaSession = await (d.isOwnerSession || ((r) => require('./_session.js').isOwnerSession(r, env)))(req).catch(() => false);
    if (!viaSession) {   // the owner password, under the shared password-guess limit (api/_guard.js)
      const secs = b.ownerPw ? G.wait(req) : 0; if (secs) return G.tooMany(res, secs);
      if (!owner(b.ownerPw)) { if (b.ownerPw) G.failed(req); return res.status(403).json({ error: 'Owner password not accepted' }); }
    }
    if (b.kind !== 'sl' && b.kind !== 'tp') return res.status(400).json({ error: 'kind must be sl or tp' });
    let v = null;
    if (b.data != null) {
      const s = String(b.data); if (!/^data:audio\/(mpeg|mp3|mp4|x-m4a|aac|wav|x-wav|ogg|webm);base64,[A-Za-z0-9+/=]+$/.test(s)) return res.status(400).json({ error: 'not an audio file' });
      if (s.length > MAX * 4 / 3 + 64) return res.status(400).json({ error: 'too big: keep the clip under 700 KB' });
      v = { name: String(b.name || 'sound').replace(/[^\w .()-]/g, '').slice(0, 60) || 'sound', data: s, at: new Date().toISOString() };
    }
    const c = (await store.get()) || {}; c[b.kind] = v; await store.put(c);
    return res.status(200).json({ ok: true, sl: c.sl ? { name: c.sl.name } : null, tp: c.tp ? { name: c.tp.name } : null });
  } catch (e) { res.setHeader('Cache-Control', 'no-store'); return res.status(500).json({ error: 'sounds unavailable' }); }   // a failed read is never cached as the public answer
}
module.exports = (req, res) => handle(req, res);
module.exports.handle = handle;
module.exports.blobStore = blobStore;
