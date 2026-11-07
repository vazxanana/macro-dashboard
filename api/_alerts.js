// Price alerts storage (private Vercel Blob, prefix "push/"): one JSON per device { sub, alerts: [{ id, sym, price, dir, note, at }], at }.
// Every save is a new blob with a random suffix (no stale CDN copy) and the device's older blobs are deleted.
const { put, list, del } = require('@vercel/blob');
const crypto = require('node:crypto');
const tok = () => process.env.BLOB_READ_WRITE_TOKEN;
const devId = (endpoint) => crypto.createHash('sha256').update(String(endpoint)).digest('hex').slice(0, 24);
async function all() {
  const out = []; let cursor;
  do { const r = await list({ prefix: 'push/', cursor, token: tok(), limit: 1000 }); out.push(...r.blobs); cursor = r.hasMore ? r.cursor : null; } while (cursor);
  const by = new Map();   // newest blob per device
  for (const b of out) { const id = b.pathname.split('/')[1]; const cur = by.get(id); if (!cur || new Date(b.uploadedAt) > new Date(cur.uploadedAt)) by.set(id, b); }
  return { by, blobs: out };
}
async function read(blob) {
  const r = await fetch(blob.url, { headers: { Authorization: `Bearer ${tok()}` }, cache: 'no-store', signal: AbortSignal.timeout(8000) });
  if (!r.ok) throw new Error(`Blob ${r.status}`); return r.json();
}
async function save(id, data, blobs) {
  const old = blobs.filter((b) => b.pathname.split('/')[1] === id).map((b) => b.url);
  if (data) await put(`push/${id}/d.json`, JSON.stringify(data), { access: 'private', addRandomSuffix: true, contentType: 'application/json', token: tok() });
  if (old.length) await del(old, { token: tok() }).catch(() => {});
}
module.exports = { all, read, save, devId, tok };
