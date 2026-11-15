// The site on Cloudflare (15 Nov 2026: Vercel blocked the account). One Worker serves the built site (out/, the ASSETS
// binding) and runs the same functions as Vercel did: every handler under api/ is imported unchanged and driven through a small
// Node-style request / response adapter (nodeReq / NodeRes below), so a function, its tests and the Vercel copy stay one code.
// What vercel.json did is here: the rewrites (ROUTES, PAGES), the security headers (SEC), the /assets cache rules (assetCache),
// and the crons (scheduled). Storage: '@vercel/blob' is aliased to cf/blob-r2.mjs (R2 bucket BLOB). Edge Config is not used:
// its three switches come from Worker variables (api/_flags.js reads EDGE_CONFIG, which is simply not set here).
// Not run here, said plainly (the free plan allows about 10 ms of CPU a request): api/run.js (the BACKUP council runner; GitHub
// Actions is the runner) and api/og.mjs (link-preview image; a static icon is served instead). See docs/cloudflare.md.
import { useBucket, blobFetch, BASE } from './blob-r2.mjs';
import { academyData } from './academy-data.mjs';
import login from '../api/login.js';
import logout from '../api/logout.js';
import me from '../api/me.js';
import users from '../api/users.js';
import profile from '../api/profile.js';
import data from '../api/data.js';
import bars from '../api/bars.js';
import stream from '../api/stream.js';
import status from '../api/status.js';
import notify from '../api/notify.js';
import sounds from '../api/sounds.js';
import push from '../api/push.js';
import alertCron from '../api/alert-cron.js';
import mosha from '../api/mosha.js';
import moshaLessons from '../api/mosha-lessons.js';
import mcp from '../api/mcp.js';
import ctraderLink from '../api/ctrader-link.js';
import bridge from '../api/bridge.js';
import tvWebhook from '../api/tv-webhook.js';
import pine from '../api/pine.js';
import edgeAnalyst from '../api/edge-analyst.js';
import academyMcp from '../api/academy-mcp.js';
import academy from '../api/academy.js';

export const API = {
  login, logout, me, users, profile, data, bars, stream, status, notify, sounds, push, 'alert-cron': alertCron, mosha,
  'mosha-lessons': moshaLessons, mcp, 'ctrader-link': ctraderLink, bridge, 'tv-webhook': tvWebhook, pine,
  'edge-analyst': edgeAnalyst, 'academy-mcp': academyMcp,
  academy: (req, res) => academy.handle(req, res, { data: ACADEMY.get() }),
};
const ACADEMY = { b: null, d: null, get() { return this.d; }, set(b) { if (b !== this.b) { this.b = b; this.d = academyData(b); } } };
const NOT_HERE = { run: 'The council runs on GitHub Actions; this backup runner is not used on Cloudflare.' };
// vercel.json "rewrites", in the same order
export function route(path) {
  let m;
  if ((m = path.match(/^\/api\/mcp\/([^/]+)\/?$/))) return { fn: 'mcp', q: { key: decodeURIComponent(m[1]) } };
  if ((m = path.match(/^\/api\/academy-mcp\/([^/]+)\/?$/))) return { fn: 'academy-mcp', q: { key: decodeURIComponent(m[1]) } };
  if ((m = path.match(/^\/cdata\/(.*)$/))) return { fn: 'data', q: { p: m[1] } };
  if (path === '/md/bars') return { fn: 'bars', q: {} };
  if (path === '/md/stream') return { fn: 'stream', q: {} };
  if ((m = path.match(/^\/api\/([a-z0-9-]+)(?:\.m?js)?\/?$/))) return { fn: m[1], q: {} };
  return null;
}
const PAGES = { '/gold': '/gold-trading.html', '/macro-desk': '/macro-desk.html', '/backtest': '/backtest.html', '/academy': '/academy.html' };
const SEC = {
  'X-Content-Type-Options': 'nosniff', 'X-Frame-Options': 'SAMEORIGIN', 'Referrer-Policy': 'strict-origin-when-cross-origin',
  'Permissions-Policy': 'camera=(), microphone=(), geolocation=(), payment=()',
  'Strict-Transport-Security': 'max-age=63072000; includeSubDomains; preload', 'X-Robots-Tag': 'noindex, nofollow',
};
const withSec = (resp) => { const r = new Response(resp.body, resp); for (const [k, v] of Object.entries(SEC)) if (!r.headers.has(k)) r.headers.set(k, v); return r; };

// ---- the request a Vercel function expects -------------------------------------------------------------------------
export async function nodeReq(request, extraQuery = {}) {
  const u = new URL(request.url), headers = {};
  request.headers.forEach((v, k) => { headers[k] = v; });
  const ip = request.headers.get('cf-connecting-ip');
  if (ip) { headers['x-real-ip'] = ip; headers['x-forwarded-for'] = ip; }   // api/_guard.js reads these; Cloudflare sets cf-connecting-ip, a client cannot
  else { delete headers['x-real-ip']; delete headers['x-forwarded-for']; }
  const query = Object.fromEntries(u.searchParams); Object.assign(query, extraQuery);
  let body;
  if (request.method !== 'GET' && request.method !== 'HEAD') {
    const txt = await request.text(), ct = (headers['content-type'] || '').toLowerCase();
    if (/application\/json/.test(ct)) { try { body = txt ? JSON.parse(txt) : {}; } catch (e) { body = txt; } }   // as Vercel: JSON parsed, a bad JSON left as text
    else if (/application\/x-www-form-urlencoded/.test(ct)) body = Object.fromEntries(new URLSearchParams(txt));
    else body = txt;
  }
  const listeners = [];
  if (request.signal) request.signal.addEventListener('abort', () => listeners.forEach((f) => { try { f(); } catch (e) {} }));
  return { method: request.method, url: u.pathname + u.search, headers, query, body, on(ev, f) { if (ev === 'close' || ev === 'aborted') listeners.push(f); return this; }, socket: { remoteAddress: ip || '' } };
}
// ---- the response object a Vercel function writes to --------------------------------------------------------------
export class NodeRes {
  constructor(head) { this.code = 200; this.h = new Headers(); this.head = !!head; this.p = new Promise((r) => { this.resolve = r; }); this.done = false; this.w = null; }
  status(c) { this.code = c; return this; }
  setHeader(k, v) { if (Array.isArray(v)) { this.h.delete(k); v.forEach((x) => this.h.append(k, String(x))); } else this.h.set(k, String(v)); return this; }
  getHeader(k) { return this.h.get(k) ?? undefined; }
  removeHeader(k) { this.h.delete(k); }
  get headersSent() { return this.done || !!this.w; }
  writeHead(c, hs) { this.code = c; if (hs) for (const [k, v] of Object.entries(hs)) this.setHeader(k, v); return this; }
  finish(body) {
    if (this.done) return; this.done = true;
    const nob = this.head || this.code === 204 || this.code === 304;
    this.resolve(new Response(nob ? null : body ?? null, { status: this.code, headers: this.h }));
  }
  json(o) { if (!this.h.has('content-type')) this.h.set('content-type', 'application/json; charset=utf-8'); this.finish(JSON.stringify(o)); return this; }
  send(b) {
    if (b != null && typeof b === 'object' && !(b instanceof Uint8Array) && !(b instanceof ArrayBuffer)) return this.json(b);
    if (typeof b === 'string' && !this.h.has('content-type')) this.h.set('content-type', 'text/html; charset=utf-8');
    this.finish(b); return this;
  }
  redirect(a, b) { const [c, url] = typeof a === 'number' ? [a, b] : [302, a]; this.code = c; this.h.set('location', url); this.finish(null); return this; }
  // streaming (api/stream.js): the first write sends the head, later writes go straight to the browser
  write(chunk) {
    if (this.done) return false;
    if (!this.w) { const ts = new TransformStream(); this.w = ts.writable.getWriter(); this.enc = new TextEncoder(); this.done = true; this.resolve(new Response(this.head ? null : ts.readable, { status: this.code, headers: this.h })); }
    this.w.write(typeof chunk === 'string' ? this.enc.encode(chunk) : chunk).catch(() => {});
    return true;
  }
  end(b) { if (this.w) { if (b != null) this.write(b); this.w.close().catch(() => {}); return this; } this.finish(b ?? null); return this; }
}

// every fetch of a blob URL is answered from the bucket (see cf/blob-r2.mjs)
const realFetch = globalThis.fetch.bind(globalThis);
globalThis.fetch = (input, init) => { const u = typeof input === 'string' ? input : input && input.url; return u && u.startsWith(BASE) ? blobFetch(input, init) : realFetch(input, init); };
function bind(env) {
  useBucket(env.BLOB || null); ACADEMY.set(env.BLOB || null);
  for (const [k, v] of Object.entries(env)) if (typeof v === 'string' && process.env[k] === undefined) process.env[k] = v;   // secrets and vars, for handlers that read process.env
}

export async function runFn(name, request, extraQuery, ctx) {
  const fn = API[name];
  if (!fn) return NOT_HERE[name] ? Response.json({ error: NOT_HERE[name] }, { status: 503 }) : Response.json({ error: 'not found' }, { status: 404 });
  const req = await nodeReq(request, extraQuery), res = new NodeRes(request.method === 'HEAD');
  const run = Promise.resolve().then(() => fn(req, res)).then(() => res.finish(null), (e) => {
    console.log(`fn ${name} failed: ${e && e.message}`);
    if (!res.done) { res.code = 500; res.h = new Headers({ 'content-type': 'application/json' }); res.finish(JSON.stringify({ error: 'server error' })); }
    else if (res.w) res.w.close().catch(() => {});
  });
  if (ctx && ctx.waitUntil) ctx.waitUntil(run);
  return res.p;
}
function assetCache(path, url, resp) {
  if (!/^\/assets\//.test(path)) return resp;
  const r = new Response(resp.body, resp);
  r.headers.set('Cache-Control', url.searchParams.has('v') ? 'public, max-age=31536000, immutable' : 'public, max-age=0, must-revalidate');
  return r;
}
export async function handle(request, env, ctx) {
  bind(env);
  const url = new URL(request.url);
  let path = url.pathname;
  if (path.startsWith('/macro-dashboard/')) path = path.slice('/macro-dashboard'.length);   // old GitHub Pages links
  if (path === '/api/og' || path === '/api/og.mjs') return withSec(Response.redirect(new URL('/icons/icon-512.png', url), 302));
  const r = route(path);
  if (r) {
    if (request.method === 'OPTIONS' && !['mcp', 'academy-mcp'].includes(r.fn)) return withSec(new Response(null, { status: 204 }));
    return withSec(await runFn(r.fn, request, r.q, ctx));
  }
  if (!env.ASSETS) return new Response('no assets', { status: 500 });
  if (path === '/macro' || path === '/veteran') return withSec(Response.redirect(new URL(path + '/' + url.search, url), 308));
  const target = PAGES[path.replace(/\/$/, '')] || (path.endsWith('/') ? path + 'index.html' : null);   // html_handling "none": a folder is its index.html
  const aurl = new URL(url); aurl.pathname = target || path;
  let resp = await env.ASSETS.fetch(new Request(aurl, request));
  if (/\.html$|\/$/.test(aurl.pathname) || (resp.headers.get('content-type') || '').includes('text/html')) {
    resp = new Response(resp.body, resp); resp.headers.set('Cache-Control', 'public, max-age=0, must-revalidate');   // vercel.json: no-cache on HTML
  }
  return withSec(assetCache(aurl.pathname, url, resp));
}
// Crons (vercel.json "crons"): price alerts every minute, the AI second opinion every 10 minutes. The council and ICT backup
// runs are not scheduled here (GitHub Actions runs the loop).
export const CRONS = { '* * * * *': ['alert-cron', {}], '*/10 * * * *': ['edge-analyst', { job: 'scan' }] };
export async function scheduled(event, env, ctx) {
  bind(env);
  const c = CRONS[event.cron]; if (!c || !env.CRON_SECRET) return;
  const q = new URLSearchParams(c[1]).toString();
  const req = new Request(`https://cron.internal/api/${c[0]}${q ? '?' + q : ''}`, { headers: { authorization: `Bearer ${env.CRON_SECRET}`, 'user-agent': 'cf-cron' } });
  const resp = await runFn(c[0], req, {}, ctx); await resp.text().catch(() => {});
}
export default { fetch: handle, scheduled };
