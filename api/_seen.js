// When each account was last on the site (owner, 20 Nov 2026: "when last time users been online"). Written by /api/me (every
// page load of a signed-in member) and /api/login; read by the owner's GET /api/users. One private file `presence/seen.json`
// = { <account key>: ISO time }, overwritten in place, so it is read from the Blob ORIGIN (`?cache=0`, the freshness rule).
// At most one write an account per TOUCH_MS in this instance; any failure is swallowed (a missed mark never blocks sign-in or a
// page). Stores only the account key and a time: no address, device, IP or page.
const P = 'presence/seen.json', TOUCH_MS = 5 * 60e3, KEEP = 500;
const LAST = new Map();   // this instance: account key -> when we last wrote it
const fresh = (url) => { const u = new URL(url); u.searchParams.set('cache', '0'); return u.toString(); };
function blobStore(env, io = {}) {
  const B = () => io.blob || require('@vercel/blob'), F = io.fetch || fetch, token = env.BLOB_READ_WRITE_TOKEN;
  return {
    async get() { const { blobs } = await B().list({ prefix: P, token }); const b = blobs.find((x) => x.pathname === P); if (!b) return {};
      const r = await F(fresh(b.url), { headers: { Authorization: `Bearer ${token}` }, cache: 'no-store', signal: AbortSignal.timeout(6000) });
      if (!r.ok) throw new Error(`seen read ${r.status}`); const j = await r.json(); return j && typeof j === 'object' && !Array.isArray(j) ? j : {}; },
    async put(map) { await B().put(P, JSON.stringify(map), { access: 'private', addRandomSuffix: false, allowOverwrite: true, contentType: 'application/json', token }); },
  };
}
const KEY = /^[a-z0-9][a-z0-9_-]{0,31}$/;
// keep the newest KEEP entries, valid keys and times only
function clean(map) {
  const e = Object.entries(map || {}).filter(([k, v]) => KEY.test(k) && typeof v === 'string' && Number.isFinite(Date.parse(v)));
  return Object.fromEntries(e.sort((a, b) => Date.parse(b[1]) - Date.parse(a[1])).slice(0, KEEP));
}
async function touch(env, key, now = Date.now(), d = {}) {
  try {
    const k = String(key || '').toLowerCase(); if (!KEY.test(k)) return false;
    if (!d.store && !env.BLOB_READ_WRITE_TOKEN) return false;
    const last = LAST.get(k); if (last && now - last < TOUCH_MS) return false;
    LAST.set(k, now);
    const store = d.store || blobStore(env), map = await store.get();
    map[k] = new Date(now).toISOString(); await store.put(clean(map)); return true;
  } catch (e) { return false; }
}
async function read(env, d = {}) {
  try { if (!d.store && !env.BLOB_READ_WRITE_TOKEN) return {}; return clean(await (d.store || blobStore(env)).get()); } catch (e) { return null; }
}
module.exports = { touch, read, clean, blobStore, TOUCH_MS, _reset: () => LAST.clear() };
