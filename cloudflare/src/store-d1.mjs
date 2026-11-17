// The site's file store on Cloudflare D1 (16 Nov 2026, owner: leave Vercel). A stand-in for the part of @vercel/blob that the
// api/ handlers use: list (prefix / limit / cursor), put (access, contentType, allowOverwrite, addRandomSuffix, token), del (one
// URL, a pathname or a list) and head, plus READING A FILE BY ITS URL: list hands out URLs on the reserved host STORE_HOST, and
// the Worker's fetch is wrapped (installFetch) so a request to that host is answered from D1 inside the Worker. `.invalid` never
// resolves, so a store URL can never leave the Worker.
// blobApi() is the switch: every call goes to the real @vercel/blob package unless the Worker secret STORE is 'd1'. Off by
// default, so deploying this changes nothing. In D1 mode the store serves only once a complete copy of the Vercel store has been
// recorded (store_state 'mirror'.ready, set by src/store-mirror.mjs); before that every call fails closed (a missing user list
// would otherwise fall back to the built-in accounts).
// D1 reads go to its primary (no read replication is used), so a write is read back at once.
// Files are kept as base64 text in chunks of CHUNK bytes (D1 keeps a row under 2 MB), at most MAX_BYTES a file.
// Pure (no Worker imports): the tests run it on node:sqlite. Wiring: src/store-blob.mjs.
import { Buffer } from 'node:buffer';

export const STORE_HOST = 'd1.store.invalid';
export const CHUNK = 768 * 1024;            // raw bytes a row (1 MiB as base64)
export const PAGE = 4;                       // chunks written or read in one D1 request
export const MAX_BYTES = 16 * 1024 * 1024;
export const LIST_MAX = 1000;
export const ORPHAN_MS = 3600e3;             // chunks of a write that never committed are cleared after an hour
const MAX_PATH = 950;

export class BlobError extends Error { constructor(m) { super(`Vercel Blob: ${m}`); this.name = 'BlobError'; } }
const EXISTS = 'This blob already exists, use `allowOverwrite: true` if you want to overwrite it. Or `addRandomSuffix: true` to generate a unique filename.';
const NO_TOKEN = 'No blob credentials found. Pass a `token` option, set `BLOB_READ_WRITE_TOKEN`, or use `oidcToken` (or `VERCEL_OIDC_TOKEN`) with `storeId` or `BLOB_STORE_ID`.';
export const NOT_READY = 'the Cloudflare store is not ready: no complete copy of the Vercel store has been recorded yet (docs/cloudflare.md, "File store on D1")';

export const isD1 = (env) => String((env && env.STORE) || '').trim().toLowerCase() === 'd1';
export const mirrorOff = (env) => /^(off|0|false|no)$/i.test(String((env && env.STORE_MIRROR) || '').trim());

export const SCHEMA = [
  'CREATE TABLE IF NOT EXISTS store_blobs (pathname TEXT PRIMARY KEY, size INTEGER NOT NULL, uploaded_at INTEGER NOT NULL, content_type TEXT NOT NULL, etag TEXT NOT NULL, chunks INTEGER NOT NULL, src TEXT NOT NULL)',
  'CREATE INDEX IF NOT EXISTS store_blobs_uploaded ON store_blobs (uploaded_at)',
  'CREATE TABLE IF NOT EXISTS store_chunks (pathname TEXT NOT NULL, etag TEXT NOT NULL, n INTEGER NOT NULL, data TEXT NOT NULL, at INTEGER NOT NULL, PRIMARY KEY (pathname, etag, n))',
  'CREATE TABLE IF NOT EXISTS store_gone (pathname TEXT PRIMARY KEY, at INTEGER NOT NULL)',
  'CREATE TABLE IF NOT EXISTS store_state (k TEXT PRIMARY KEY, v TEXT NOT NULL)',
];

const hex = (n) => { const b = new Uint8Array(n); crypto.getRandomValues(b); return [...b].map((x) => x.toString(16).padStart(2, '0')).join(''); };
const ALNUM = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
export function randomSuffix(n = 30) { const b = new Uint8Array(n); crypto.getRandomValues(b); return [...b].map((x) => ALNUM[x % ALNUM.length]).join(''); }
// Vercel's form: "dir/name.json" -> "dir/name-<suffix>.json"
export const withSuffix = (p, s = randomSuffix()) => p.replace(/(\.[^./]+)?$/, (ext) => `-${s}${ext || ''}`);

export const urlOf = (p) => `https://${STORE_HOST}/` + String(p).split('/').map(encodeURIComponent).join('/');
// a store URL, a Vercel blob URL or a bare pathname -> the pathname
export function pathOf(x) {
  const s = String(x);
  if (!/^https?:\/\//i.test(s)) return s;
  return new URL(s).pathname.slice(1).split('/').map(decodeURIComponent).join('/');
}
const TYPES = { json: 'application/json', txt: 'text/plain', csv: 'text/csv', html: 'text/html', png: 'image/png', jpg: 'image/jpeg', jpeg: 'image/jpeg', webp: 'image/webp', gif: 'image/gif', svg: 'image/svg+xml', mp3: 'audio/mpeg', wav: 'audio/wav', ogg: 'audio/ogg' };
const typeOf = (p) => TYPES[(String(p).match(/\.([a-z0-9]+)$/i) || [])[1]?.toLowerCase()] || 'application/octet-stream';
const isUnique = (e) => /UNIQUE constraint failed/i.test(String(e && e.message || e));
function isPlainObject(v) {
  if (typeof v !== 'object' || v === null) return false;
  const p = Object.getPrototypeOf(v);
  return (p === null || p === Object.prototype || Object.getPrototypeOf(p) === null) && !(Symbol.toStringTag in v) && !(Symbol.iterator in v);
}
async function bytesOf(body) {
  if (typeof body === 'string') return new TextEncoder().encode(body);
  if (body instanceof ArrayBuffer) return new Uint8Array(body);
  if (ArrayBuffer.isView(body)) return new Uint8Array(body.buffer, body.byteOffset, body.byteLength);
  if (typeof Blob !== 'undefined' && body instanceof Blob) return new Uint8Array(await body.arrayBuffer());
  if (body && typeof body.getReader === 'function') return new Uint8Array(await new Response(body).arrayBuffer());
  throw new BlobError('Body must be a string, buffer or stream.');
}
const split = (bytes) => { const out = []; for (let i = 0; i < bytes.length; i += CHUNK) out.push(Buffer.from(bytes.subarray(i, i + CHUNK)).toString('base64')); return out; };
const join = (parts) => { const bufs = parts.map((d) => Buffer.from(d, 'base64')); return new Uint8Array(Buffer.concat(bufs)); };

// ---- the tables ------------------------------------------------------------------------------------------------------------
const SCHEMA_DONE = new WeakMap();   // per database object: the schema is created once an isolate
const UP = 'INSERT INTO store_blobs (pathname, size, uploaded_at, content_type, etag, chunks, src)';
const SET = 'ON CONFLICT(pathname) DO UPDATE SET size = excluded.size, uploaded_at = excluded.uploaded_at, content_type = excluded.content_type, etag = excluded.etag, chunks = excluded.chunks, src = excluded.src';
// a write made here is newer than every file in the store, so the final pass of the mirror can never overwrite it
const NOW_UP = 'MAX(?3, IFNULL((SELECT MAX(uploaded_at) FROM store_blobs), 0) + 1)';

export function d1Store(db, o = {}) {
  const now = o.now || Date.now;
  const q = (sql, ...a) => db.prepare(sql).bind(...a);
  const ensure = () => {
    let p = SCHEMA_DONE.get(db);
    if (!p) { p = db.batch(SCHEMA.map((s) => db.prepare(s))).catch((e) => { SCHEMA_DONE.delete(db); throw e; }); SCHEMA_DONE.set(db, p); }
    return p;
  };
  async function readFile(p) {
    for (let attempt = 0; attempt < 3; attempt++) {
      const { results } = await q('SELECT b.size, b.content_type, b.etag, b.uploaded_at, b.chunks, c.n, c.data FROM store_blobs b LEFT JOIN store_chunks c ON c.pathname = b.pathname AND c.etag = b.etag AND c.n < ?2 WHERE b.pathname = ?1 ORDER BY c.n', p, PAGE).all();
      if (!results.length) return null;
      const m = results[0], first = results.filter((r) => r.n != null);
      let ok = first.length === Math.min(m.chunks, PAGE) && first.every((r, i) => r.n === i);
      const parts = first.map((r) => r.data);
      for (let n = PAGE; ok && n < m.chunks; n += PAGE) {
        const r = (await q('SELECT n, data FROM store_chunks WHERE pathname = ?1 AND etag = ?2 AND n >= ?3 AND n < ?4 ORDER BY n', p, m.etag, n, n + PAGE).all()).results;
        if (r.length !== Math.min(PAGE, m.chunks - n) || !r.every((x, i) => x.n === n + i)) ok = false; else parts.push(...r.map((x) => x.data));
      }
      if (!ok) continue;   // overwritten while being read: read it again
      const bytes = join(parts); if (bytes.length !== m.size) continue;
      return { bytes, size: m.size, contentType: m.content_type, etag: m.etag, uploadedAt: m.uploaded_at };
    }
    throw new Error('store: a file could not be read whole');
  }
  // mode: 'create' (allowOverwrite false), 'overwrite', 'follow' (mirror: never over a file the site wrote here),
  // 'final' (mirror's final pass: only over an older row, never over a newer delete). -> { applied, etag }
  async function write(p, bytes, { mode, contentType, uploadedAt }) {
    const e = `"${hex(16)}"`, t = now(), parts = split(bytes);
    const ins = (n) => q('INSERT INTO store_chunks (pathname, etag, n, data, at) VALUES (?1, ?2, ?3, ?4, ?5)', p, e, n, parts[n], t);
    const pre = [];
    if (parts.length > PAGE) { for (let i = 0; i < parts.length; i += PAGE) await db.batch(parts.slice(i, i + PAGE).map((_, j) => ins(i + j))); }
    else parts.forEach((_, n) => pre.push(ins(n)));
    const meta = [p, bytes.length, mode === 'follow' || mode === 'final' ? uploadedAt : t, contentType, e, parts.length];
    let stmts;
    if (mode === 'create') stmts = [q(`${UP} VALUES (?1, ?2, ${NOW_UP}, ?4, ?5, ?6, 'd1')`, ...meta), q('DELETE FROM store_gone WHERE pathname = ?1', p)];
    else if (mode === 'overwrite') stmts = [q('DELETE FROM store_chunks WHERE pathname = ?1 AND etag = (SELECT etag FROM store_blobs WHERE pathname = ?1)', p),
      q(`${UP} VALUES (?1, ?2, ${NOW_UP}, ?4, ?5, ?6, 'd1') ${SET}`, ...meta), q('DELETE FROM store_gone WHERE pathname = ?1', p)];
    else if (mode === 'follow') stmts = [q("DELETE FROM store_chunks WHERE pathname = ?1 AND etag = (SELECT etag FROM store_blobs WHERE pathname = ?1 AND src = 'vercel')", p),
      q(`${UP} VALUES (?1, ?2, ?3, ?4, ?5, ?6, 'vercel') ${SET} WHERE store_blobs.src = 'vercel'`, ...meta), q('DELETE FROM store_gone WHERE pathname = ?1', p)];
    else if (mode === 'final') stmts = [q('DELETE FROM store_chunks WHERE pathname = ?1 AND etag = (SELECT etag FROM store_blobs WHERE pathname = ?1 AND uploaded_at < ?2)', p, uploadedAt),
      q(`${UP} SELECT ?1, ?2, ?3, ?4, ?5, ?6, 'vercel' WHERE NOT EXISTS (SELECT 1 FROM store_gone WHERE pathname = ?1 AND at >= ?3) ${SET} WHERE store_blobs.uploaded_at < excluded.uploaded_at`, ...meta),
      q('DELETE FROM store_gone WHERE pathname = ?1 AND at < ?2', p, uploadedAt)];
    else throw new Error(`store: unknown write mode ${mode}`);
    const upIdx = pre.length + (mode === 'create' ? 0 : 1);
    let res;
    try { res = await db.batch([...pre, ...stmts]); } catch (err) { if (parts.length > PAGE) await drop(p, e).catch(() => {}); throw err; }
    const applied = !!(res[upIdx] && res[upIdx].meta && res[upIdx].meta.changes > 0);
    if (!applied) await drop(p, e);   // a mirror copy that lost to a newer row: its chunks go
    return { applied, etag: e };
  }
  const drop = (p, e) => q('DELETE FROM store_chunks WHERE pathname = ?1 AND etag = ?2', p, e).run();
  // the site's delete: the file goes and a tombstone says when (so the mirror's final pass never brings an older copy back)
  async function remove(paths) {
    const t = now(), st = [];
    for (const p of paths) st.push(
      q(`INSERT INTO store_gone (pathname, at) VALUES (?1, MAX(?2, IFNULL((SELECT MAX(uploaded_at) FROM store_blobs), 0) + 1)) ON CONFLICT(pathname) DO UPDATE SET at = excluded.at`, p, t),
      q('DELETE FROM store_chunks WHERE pathname = ?1 AND etag = (SELECT etag FROM store_blobs WHERE pathname = ?1)', p),
      q('DELETE FROM store_blobs WHERE pathname = ?1', p));
    for (let i = 0; i < st.length; i += 90) await db.batch(st.slice(i, i + 90));
  }
  // the mirror's delete: only a copy it made itself (a file the site wrote here is never touched)
  async function dropMirrored(paths) {
    const st = [];
    for (const p of paths) st.push(q("DELETE FROM store_chunks WHERE pathname = ?1 AND etag = (SELECT etag FROM store_blobs WHERE pathname = ?1 AND src = 'vercel')", p),
      q("DELETE FROM store_blobs WHERE pathname = ?1 AND src = 'vercel'", p));
    for (let i = 0; i < st.length; i += 90) await db.batch(st.slice(i, i + 90));
  }
  return {
    db, ensure, readFile, write, remove, dropMirrored,
    list: async (prefix, limit, after) => (await q('SELECT pathname, size, uploaded_at, etag FROM store_blobs WHERE substr(pathname, 1, length(?1)) = ?1 AND pathname > ?2 ORDER BY pathname LIMIT ?3', prefix, after, limit + 1).all()).results,
    head: (p) => q('SELECT size, uploaded_at, content_type, etag FROM store_blobs WHERE pathname = ?1', p).first(),
    rows: async () => (await db.prepare('SELECT pathname, size, uploaded_at, src FROM store_blobs').all()).results,
    gone: async () => (await db.prepare('SELECT pathname, at FROM store_gone').all()).results,
    async state() { const r = await q('SELECT v FROM store_state WHERE k = ?1', 'mirror').first(); try { return r ? JSON.parse(r.v) : {}; } catch (e) { return {}; } },
    setState: (s) => q('INSERT INTO store_state (k, v) VALUES (?1, ?2) ON CONFLICT(k) DO UPDATE SET v = excluded.v', 'mirror', JSON.stringify(s)).run(),
    async housekeep(t, purgeGone) {
      const st = [q('DELETE FROM store_chunks WHERE at < ?1 AND NOT EXISTS (SELECT 1 FROM store_blobs b WHERE b.pathname = store_chunks.pathname AND b.etag = store_chunks.etag)', t - ORPHAN_MS)];
      if (purgeGone) st.push(db.prepare('DELETE FROM store_gone'));
      const r = await db.batch(st);
      return { orphans: r[0].meta.changes || 0, gone: purgeGone ? r[1].meta.changes || 0 : 0 };
    },
  };
}

// ---- the @vercel/blob stand-in ------------------------------------------------------------------------------------------
// real: the real package (or a fake in tests); env: () => the Worker's env (STORE, STORE_DB, BLOB_READ_WRITE_TOKEN).
export const GATED = ['put', 'list', 'del', 'head', 'get', 'copy', 'rename', 'putFromUrl', 'putImage', 'createFolder', 'createMultipartUpload', 'createMultipartUploader', 'uploadPart', 'completeMultipartUpload'];
export function blobApi({ real = {}, env, now } = {}) {
  const E = typeof env === 'function' ? env : () => env || {};
  const on = () => isD1(E());
  let cur = null;
  const storeOf = () => {
    const db = E().STORE_DB;
    if (!db) throw new BlobError('the STORE_DB binding (D1 database aureum-data) is missing');
    if (!cur || cur.db !== db) cur = { db, st: d1Store(db, { now }), ready: false };
    return cur;
  };
  async function ready() {
    const c = storeOf(); if (c.ready) return c.st;
    await c.st.ensure();
    const s = await c.st.state();
    if (s && s.ready) { c.ready = true; return c.st; }
    throw new BlobError(NOT_READY);
  }
  const token = (o) => { const t = (o && o.token) || E().BLOB_READ_WRITE_TOKEN; if (!t) throw new BlobError(NO_TOKEN); return t; };
  const blobOf = (r) => ({ url: urlOf(r.pathname), downloadUrl: `${urlOf(r.pathname)}?download=1`, pathname: r.pathname, size: r.size, uploadedAt: new Date(r.uploaded_at), etag: r.etag });

  const d1 = {
    async put(pathname, body, options) {
      if (!body) throw new BlobError('body is required');
      if (isPlainObject(body)) throw new BlobError("Body must be a string, buffer or stream. You sent a plain JavaScript object, double check what you're trying to upload.");
      if (!pathname) throw new BlobError('pathname is required');
      if (pathname.length > MAX_PATH) throw new BlobError(`pathname is too long, maximum length is ${MAX_PATH}`);
      if (pathname.includes('//')) throw new BlobError('pathname cannot contain "//", please encode it if needed');
      if (!options) throw new BlobError('missing options, see usage');
      if (options.access !== 'public' && options.access !== 'private') throw new BlobError('access must be "private" or "public", see https://vercel.com/docs/vercel-blob');
      token(options);
      for (const k of ['ifMatch', 'multipart', 'optimizeImage']) if (options[k]) throw new BlobError(`${k} is not available on the Cloudflare store`);
      const st = await ready(), bytes = await bytesOf(body);
      if (bytes.length > MAX_BYTES) throw new BlobError(`File is too large, the Cloudflare store keeps files up to ${MAX_BYTES / 1048576} MB.`);
      const contentType = options.contentType || typeOf(pathname);
      for (let i = 0; ; i++) {
        const p = options.addRandomSuffix ? withSuffix(pathname) : pathname;
        try {
          const w = await st.write(p, bytes, { mode: options.allowOverwrite ? 'overwrite' : 'create', contentType });
          return { url: urlOf(p), downloadUrl: `${urlOf(p)}?download=1`, pathname: p, contentType, contentDisposition: `attachment; filename="${p.split('/').pop()}"`, etag: w.etag };
        } catch (e) {
          if (!isUnique(e)) throw e;
          if (options.addRandomSuffix && i < 2) continue;
          throw new BlobError(EXISTS);
        }
      }
    },
    async list(options = {}) {
      token(options);
      if (options.mode === 'folded') throw new BlobError('mode "folded" is not available on the Cloudflare store');
      const limit = Math.min(Math.max(parseInt(options.limit, 10) || LIST_MAX, 1), LIST_MAX);
      let after = '';
      if (options.cursor) { try { after = Buffer.from(String(options.cursor), 'base64url').toString('utf8'); } catch (e) { after = ''; } if (!after) throw new BlobError('bad cursor'); }
      const st = await ready(), rows = await st.list(String(options.prefix || ''), limit, after);
      const more = rows.length > limit, page = rows.slice(0, limit);
      return { blobs: page.map(blobOf), cursor: more ? Buffer.from(page[page.length - 1].pathname, 'utf8').toString('base64url') : undefined, hasMore: more };
    },
    async del(urlOrPathname, options) {
      if (options && options.ifMatch) throw new BlobError('ifMatch is not available on the Cloudflare store');
      token(options);
      const paths = [...new Set([].concat(urlOrPathname).filter((x) => x != null && x !== '').map(pathOf))];
      const st = await ready(); if (paths.length) await st.remove(paths);
    },
    async head(urlOrPathname, options) {
      token(options);
      const st = await ready(), p = pathOf(urlOrPathname), r = await st.head(p);
      if (!r) throw new BlobError('The requested blob does not exist');
      return { url: urlOf(p), downloadUrl: `${urlOf(p)}?download=1`, pathname: p, size: r.size, contentType: r.content_type, contentDisposition: `attachment; filename="${p.split('/').pop()}"`, cacheControl: 'private, no-store', uploadedAt: new Date(r.uploaded_at), etag: r.etag };
    },
  };
  const api = {};
  for (const name of GATED) {
    if (typeof real[name] !== 'function' && !d1[name]) continue;
    api[name] = (...a) => {
      if (on()) return d1[name] ? d1[name](...a) : Promise.reject(new BlobError(`${name}() is not available on the Cloudflare store`));
      if (typeof real[name] !== 'function') return Promise.reject(new BlobError(`${name}() is not available`));
      return real[name](...a);
    };
  }
  const text = (status, msg) => new Response(msg, { status, headers: { 'content-type': 'text/plain; charset=utf-8' } });
  // reading a file by its store URL (what the handlers do with fetch)
  api.answer = async (url, method = 'GET', headers = new Headers()) => {
    if (!on()) return text(404, 'the Cloudflare store is off');
    if (method !== 'GET' && method !== 'HEAD') return text(405, 'GET or HEAD');
    const t = E().BLOB_READ_WRITE_TOKEN;
    if (!t || headers.get('authorization') !== `Bearer ${t}`) return text(403, 'Access denied, please provide a valid token for this resource.');
    let f;
    try { const st = await ready(); f = await st.readFile(pathOf(url)); } catch (e) { return text(503, String(e && e.message || e)); }
    if (!f) return text(404, 'The requested blob does not exist');
    return new Response(method === 'HEAD' ? null : f.bytes, { status: 200, headers: { 'content-type': f.contentType, 'content-length': String(f.size), etag: f.etag, 'last-modified': new Date(f.uploadedAt).toUTCString(), 'cache-control': 'private, no-store' } });
  };
  api.installFetch = (target = globalThis) => installFetch(target, api.answer);
  api.on = on;
  return api;
}

// The Worker's fetch, with store URLs answered from D1; every other request goes on as before.
const OURS = Symbol.for('aureum.store.fetch');
export function storeUrlOf(input) {
  const s = typeof input === 'string' ? input : input instanceof URL ? input.href : input && typeof input.url === 'string' ? input.url : null;
  if (!s || !s.includes(STORE_HOST)) return null;
  try { const u = new URL(s); return u.hostname === STORE_HOST ? u : null; } catch (e) { return null; }
}
export function installFetch(target, answer) {
  const orig = target.fetch;
  if (typeof orig !== 'function' || orig[OURS]) return orig;
  const f = function fetch(input, init) {
    const u = storeUrlOf(input);
    if (!u) return orig.call(target, input, init);
    const req = input && typeof input === 'object' && !(input instanceof URL) ? input : null;
    const method = String((init && init.method) || (req && req.method) || 'GET').toUpperCase();
    const headers = new Headers(init && init.headers !== undefined ? init.headers : (req && req.headers) || undefined);
    return answer(u, method, headers);
  };
  f[OURS] = true;
  target.fetch = f;
  return f;
}
