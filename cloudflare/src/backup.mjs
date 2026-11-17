// A copy of the Vercel Blob store in Cloudflare KV (16 Nov 2026, owner: "get vercel data").
// The site still reads and writes the Blob store (users, profiles, Mosha lessons and log, notices, sounds,
// Academy, price alerts, cTrader links); this keeps a copy of every file on Cloudflare in case Vercel closes it.
// It only READS the Blob store and never deletes anything on either side. Runs from the 10-minute cron, copies
// at most PER_RUN changed files a run (Workers limit the requests of one run) and goes round again a day later.
// KV keys: 'blob:<pathname>' = the file's bytes (metadata: size, uploadedAt, contentType); 'meta' = the index.
export const PER_RUN = 200;
export const EVERY_MS = 24 * 3600e3;

export async function blobBackup(env, deps = {}) {
  const kv = env.BACKUP, token = env.BLOB_READ_WRITE_TOKEN;
  if (!kv || !token) return { skip: !kv ? 'no BACKUP binding' : 'no BLOB_READ_WRITE_TOKEN' };
  const now = deps.now || Date.now(), F = deps.fetch || fetch;
  const list = deps.list || (await import('vercel-blob-real')).list;   // the real Vercel store, whatever the switch STORE says
  const meta = (await kv.get('meta', 'json')) || { files: {} };
  if (meta.done && now - Date.parse(meta.at) < EVERY_MS) return { skip: 'fresh', at: meta.at };
  const blobs = [];
  let cursor;
  do { const r = await list({ token, cursor, limit: 1000 }); blobs.push(...r.blobs); cursor = r.hasMore ? r.cursor : undefined; } while (cursor);
  const files = meta.files || {}, seen = new Set();
  let copied = 0, failed = 0, left = 0;
  for (const b of blobs) {
    seen.add(b.pathname);
    const stamp = `${b.uploadedAt}|${b.size}`;
    if (files[b.pathname] && files[b.pathname].stamp === stamp) continue;
    if (copied + failed >= PER_RUN) { left++; continue; }
    try {
      const u = new URL(b.url); u.searchParams.set('cache', '0');
      const r = await F(u.toString(), { headers: { Authorization: `Bearer ${token}` }, cache: 'no-store' });
      if (!r.ok) throw new Error(`read ${r.status}`);
      const buf = await r.arrayBuffer();
      const contentType = r.headers.get('content-type') || '';
      await kv.put('blob:' + b.pathname, buf, { metadata: { size: buf.byteLength, uploadedAt: String(b.uploadedAt), contentType } });
      files[b.pathname] = { stamp, size: buf.byteLength, at: new Date(now).toISOString() };
      copied++;
    } catch (e) { failed++; }
  }
  // A file gone from the Blob store keeps its copy here, marked, so nothing is lost by a delete there.
  for (const p of Object.keys(files)) if (!seen.has(p) && !files[p].gone) files[p].gone = new Date(now).toISOString();
  const out = { at: new Date(now).toISOString(), done: left === 0 && failed === 0, blobs: blobs.length, copied, failed, left,
    bytes: Object.values(files).reduce((s, f) => s + (f.size || 0), 0), files };
  await kv.put('meta', JSON.stringify(out));
  return { at: out.at, done: out.done, blobs: out.blobs, copied, failed, left };
}
