// A Blob service with a CDN in front of it, for offline tests (the one tests/academy-correction.test.mjs describes, with del,
// ETags and a hook). put() changes the origin at once; a path the CDN already holds keeps being served with its OLD bytes
// until LAG ms after the overwrite; a read with ?cache=0 goes to the origin. A file saved under a new name each time
// (addRandomSuffix) gets a new URL, which the CDN cannot hold yet. No network, no real store.
export const LAG = 60e3;
export function blobService(token = 'tok') {
  const W = { now: Date.UTC(2026, 10, 11, 18), origin: new Map(), cdn: new Map(), reads: { cdn: 0, origin: 0 }, puts: [], seq: 0, onPut: null };
  const url = (k) => `https://store.private.blob.invalid/${k}`;
  W.blob = {
    list: async ({ prefix = '' } = {}) => ({ blobs: [...W.origin.keys()].filter((k) => k.startsWith(prefix)).map((k) => ({ pathname: k, url: url(k), uploadedAt: new Date(W.origin.get(k).at), etag: W.origin.get(k).etag })), hasMore: false }),
    put: async (p, body, o = {}) => {
      const hook = W.onPut; if (hook) { W.onPut = null; await hook(p); }   // something else happens while this upload is on its way
      const k = o.addRandomSuffix ? p.replace(/(\.[a-z0-9]+)?$/, (e) => `-${(++W.seq).toString(36).padStart(6, '0')}${e}`) : p;
      if (W.origin.has(k) && !o.allowOverwrite) throw new Error('blob already exists');
      const etag = `"e${++W.seq}"`; W.origin.set(k, { body, at: W.now + W.seq / 1000, etag }); W.puts.push(k); const c = W.cdn.get(k); if (c) c.until = W.now + LAG;
      return { pathname: k, url: url(k), etag };
    },
    del: async (urls) => { for (const u of [].concat(urls)) W.origin.delete(decodeURIComponent(new URL(u).pathname.slice(1))); },
  };
  W.fetch = async (u0, o = {}) => {
    if (((o.headers || {}).Authorization) !== `Bearer ${token}`) return { ok: false, status: 403, json: async () => null };
    const u = new URL(u0), p = decodeURIComponent(u.pathname.slice(1)), at = W.origin.get(p); if (!at) return { ok: false, status: 404, json: async () => null };
    const answer = (body) => ({ ok: true, status: 200, json: async () => JSON.parse(body), arrayBuffer: async () => { const b = Buffer.from(body); return b.buffer.slice(b.byteOffset, b.byteOffset + b.length); } });
    if (u.searchParams.get('cache') === '0') { W.reads.origin++; return answer(at.body); }
    W.reads.cdn++; let c = W.cdn.get(p); if (!c || (c.until != null && W.now >= c.until)) { c = { body: at.body, until: null }; W.cdn.set(p, c); }
    return answer(c.body);
  };
  W.io = () => ({ blob: W.blob, fetch: W.fetch });
  W.env = { BLOB_READ_WRITE_TOKEN: token };
  W.json = (k) => (W.origin.has(k) ? JSON.parse(W.origin.get(k).body) : undefined);
  return W;
}
// a response object as the handlers use it
export function resOf() {
  const out = { code: 0, body: null, headers: {} };
  const res = { setHeader: (k, v) => { out.headers[String(k).toLowerCase()] = v; }, status(c) { out.code = c; return res; }, json(b) { out.body = b; return out; }, send(b) { out.body = b; return out; }, end() { return out; } };
  return { out, res };
}
