// Node-style (req, res) handlers of api/ run on Cloudflare Workers.
// The handlers are the Vercel ones, unchanged: this file gives them the request and
// response objects Vercel's Node runtime gives (req.method / url / headers / query / body,
// res.status / setHeader / json / send / end / write / writeHead / redirect).
import { Buffer } from 'node:buffer';

// Vercel parses the body by content type before the handler runs.
export async function bodyOf(request) {
  if (request.method === 'GET' || request.method === 'HEAD') return undefined;
  const buf = Buffer.from(await request.arrayBuffer());
  if (!buf.length) return undefined;
  const ct = String(request.headers.get('content-type') || '').toLowerCase();
  if (ct.includes('application/json')) {
    try { return JSON.parse(buf.toString('utf8')); } catch (e) { const err = new Error('Invalid JSON'); err.status = 400; throw err; }
  }
  if (ct.includes('application/x-www-form-urlencoded')) return Object.fromEntries(new URLSearchParams(buf.toString('utf8')));
  if (ct.startsWith('text/')) return buf.toString('utf8');
  return buf;
}

// Repeated query keys become arrays, as on Vercel.
export function queryOf(url) {
  const q = {};
  for (const [k, v] of url.searchParams) q[k] = k in q ? [].concat(q[k], v) : v;
  return q;
}

// The client's address: Cloudflare's own header, never what the client sent.
export function headersOf(request) {
  const h = {};
  for (const [k, v] of request.headers) h[k.toLowerCase()] = v;
  const ip = request.headers.get('cf-connecting-ip');
  delete h['x-vercel-forwarded-for'];
  // 20 Nov 2026 review: nor a forwarded host. Vercel set that header itself; here it would be the client's own words, and
  // api/signup.js builds the links it emails (confirm, reset) from it. The Host header is the address the request came to.
  delete h['x-forwarded-host'];
  if (ip) { h['x-real-ip'] = ip; h['x-forwarded-for'] = ip; } else { delete h['x-real-ip']; delete h['x-forwarded-for']; }
  return h;
}

export function makeReq(request, url, body) {
  const listeners = { close: [] };
  if (request.signal) request.signal.addEventListener('abort', () => listeners.close.forEach((f) => { try { f(); } catch (e) {} }));
  return {
    method: request.method,
    url: url.pathname + url.search,
    headers: headersOf(request),
    query: queryOf(url),
    body,
    on(ev, fn) { (listeners[ev] = listeners[ev] || []).push(fn); return this; },
    once(ev, fn) { return this.on(ev, fn); },
    socket: { remoteAddress: request.headers.get('cf-connecting-ip') || '' },
  };
}

const toBytes = (x) => (x == null ? null : typeof x === 'string' ? new TextEncoder().encode(x) : x instanceof Uint8Array ? x : x instanceof ArrayBuffer ? new Uint8Array(x) : new TextEncoder().encode(String(x)));

export function makeRes() {
  let resolve;
  const done = new Promise((r) => { resolve = r; });
  const headers = new Map();
  let ended = false, stream = null, writer = null;
  const head = () => {
    const h = new Headers();
    for (const [k, v] of headers) for (const one of [].concat(v)) h.append(k, String(one));
    return h;
  };
  const finish = (bytes) => {
    if (ended) return;
    ended = true;
    if (writer) { if (bytes) writer.write(bytes).catch(() => {}); writer.close().catch(() => {}); return; }
    const status = res.statusCode;
    const nobody = status === 204 || status === 304;
    resolve(new Response(nobody ? null : bytes, { status, headers: head() }));
  };
  const res = {
    statusCode: 200,
    get headersSent() { return !!writer || ended; },
    get writableEnded() { return ended; },
    status(n) { res.statusCode = n; return res; },
    setHeader(k, v) { headers.set(k.toLowerCase(), v); return res; },
    getHeader(k) { return headers.get(k.toLowerCase()); },
    hasHeader(k) { return headers.has(k.toLowerCase()); },
    removeHeader(k) { headers.delete(k.toLowerCase()); },
    getHeaders() { return Object.fromEntries(headers); },
    writeHead(code, hs) { res.statusCode = code; if (hs) for (const [k, v] of Object.entries(hs)) res.setHeader(k, v); return res; },
    json(o) { if (!headers.has('content-type')) res.setHeader('Content-Type', 'application/json; charset=utf-8'); finish(toBytes(JSON.stringify(o))); return res; },
    send(x) {
      if (x != null && typeof x === 'object' && !(x instanceof Uint8Array) && !(x instanceof ArrayBuffer)) return res.json(x);
      if (typeof x === 'string' && !headers.has('content-type')) res.setHeader('Content-Type', 'text/html; charset=utf-8');
      if (x instanceof Uint8Array && !headers.has('content-type')) res.setHeader('Content-Type', 'application/octet-stream');
      finish(toBytes(x)); return res;
    },
    redirect(a, b) { const [code, loc] = typeof a === 'number' ? [a, b] : [307, a]; res.statusCode = code; res.setHeader('Location', loc); finish(null); return res; },
    // Streaming (server-sent events): the response starts with the first write.
    write(chunk) {
      if (ended) return false;
      if (!writer) {
        stream = new TransformStream();
        writer = stream.writable.getWriter();
        resolve(new Response(stream.readable, { status: res.statusCode, headers: head() }));
      }
      writer.write(toBytes(chunk)).catch(() => {});
      return true;
    },
    flushHeaders() {},
    end(x) { finish(toBytes(x)); return res; },
  };
  return { res, done, isEnded: () => ended };
}

// Run one handler; the Response arrives when it ends or starts streaming.
export async function run(handler, request, url, ctx) {
  let body;
  try { body = await bodyOf(request); } catch (e) { return new Response(JSON.stringify({ error: e.message }), { status: e.status || 400, headers: { 'content-type': 'application/json' } }); }
  const req = makeReq(request, url, body);
  const { res, done, isEnded } = makeRes();
  const work = (async () => { await handler(req, res); })();
  const failed = work.then(() => {
    if (!isEnded() && !res.headersSent) res.status(500).json({ error: 'The function ended without an answer' });
    return null;
  }, (e) => {
    console.error('handler failed', e && e.stack || e);
    if (!res.headersSent) res.status(500).json({ error: 'Server error' }); else res.end();
    return null;
  });
  if (ctx && ctx.waitUntil) ctx.waitUntil(failed);
  return Promise.race([done, failed.then(() => done)]);
}
