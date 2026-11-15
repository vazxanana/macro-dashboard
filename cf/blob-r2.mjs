// Cloudflare stand-in for the three @vercel/blob calls the site's functions use (put, list, del), on an R2 bucket
// (15 Nov 2026, the move off Vercel). wrangler.toml aliases '@vercel/blob' to this file, so no function under api/ changed.
// An object's key is its Vercel pathname (scripts/blob-to-r2.mjs copies the store over under the same names).
// A "URL" here is BASE + key: the functions fetch a blob's url / downloadUrl with fetch(); cf/worker.mjs answers those
// fetches from the bucket (blobFetch), so read-after-write is exact (R2 is strongly consistent; no CDN copy in between).
export const BASE = 'https://blob.r2.internal/';
let bucket = null;
export function useBucket(b) { bucket = b; }
const need = () => { if (!bucket) throw new Error('blob store not configured (R2 binding BLOB)'); return bucket; };
const keyOf = (u) => { const s = String(u || ''); return decodeURIComponent((s.startsWith(BASE) ? s.slice(BASE.length) : s.replace(/^https?:\/\/[^/]+\//, '')).split('?')[0]); };
const rand = () => Array.from(crypto.getRandomValues(new Uint8Array(15)), (b) => 'abcdefghijklmnopqrstuvwxyz0123456789'[b % 36]).join('').slice(0, 21);
function suffixed(p) { const i = p.lastIndexOf('.'), j = p.lastIndexOf('/'); return i > j ? `${p.slice(0, i)}-${rand()}${p.slice(i)}` : `${p}-${rand()}`; }
const rec = (o) => ({ url: BASE + o.key, downloadUrl: BASE + o.key + '?download=1', pathname: o.key, size: o.size, uploadedAt: o.uploaded instanceof Date ? o.uploaded : new Date(o.uploaded || Date.now()), etag: o.httpEtag || (o.etag ? `"${o.etag}"` : undefined), contentType: o.httpMetadata && o.httpMetadata.contentType });

export async function put(pathname, body, opts = {}) {
  const b = need(); let key = String(pathname).replace(/^\/+/, '');
  if (opts.addRandomSuffix) key = suffixed(key);
  else if (opts.allowOverwrite === false && await b.head(key)) throw new Error(`blob already exists: ${key}`);
  const data = typeof body === 'string' || body instanceof ArrayBuffer || ArrayBuffer.isView(body) || body instanceof ReadableStream ? body
    : body && typeof body.arrayBuffer === 'function' ? await body.arrayBuffer() : String(body);
  const o = await b.put(key, data, { httpMetadata: opts.contentType ? { contentType: opts.contentType } : undefined });
  return rec(o);
}
export async function list(opts = {}) {
  const b = need(), r = await b.list({ prefix: opts.prefix || undefined, cursor: opts.cursor || undefined, limit: Math.min(opts.limit || 1000, 1000), include: ['httpMetadata'] });
  return { blobs: r.objects.map(rec), cursor: r.truncated ? r.cursor : undefined, hasMore: !!r.truncated };
}
export async function del(urls) {
  const b = need(), keys = (Array.isArray(urls) ? urls : [urls]).map(keyOf).filter(Boolean);
  if (keys.length) await b.delete(keys);
}
export async function head(url) { const o = await need().head(keyOf(url)); return o ? rec(o) : null; }
// a fetch of BASE + key: the object, or 404. Called by cf/worker.mjs's fetch wrapper.
export async function blobFetch(input, init = {}) {
  const url = typeof input === 'string' ? input : input.url, method = (init.method || (input.method) || 'GET').toUpperCase();
  if (method !== 'GET' && method !== 'HEAD') return new Response('method', { status: 405 });
  const o = method === 'HEAD' ? await need().head(keyOf(url)) : await need().get(keyOf(url));
  if (!o) return new Response('not found', { status: 404 });
  const h = new Headers(); if (o.httpMetadata && o.httpMetadata.contentType) h.set('content-type', o.httpMetadata.contentType); if (o.httpEtag) h.set('etag', o.httpEtag); h.set('content-length', String(o.size));
  return new Response(method === 'HEAD' ? null : o.body, { status: 200, headers: h });
}
export default { put, list, del, head, BASE };
