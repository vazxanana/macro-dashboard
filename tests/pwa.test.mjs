// node --test tests/pwa.test.mjs — installable app: sw.js routing (never caches pages, API answers or /cdata), the build step
// scripts/pwa.mjs (head tags, worker version, kill switch) and the manifest / icons.
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import vm from 'node:vm';
import { fileURLToPath } from 'node:url';
import { injectHead, siteVersion, buildWorker, run } from '../scripts/pwa.mjs';

const ROOT = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');
const ORIGIN = 'https://meridianx.dev';
const SRC = fs.readFileSync(path.join(ROOT, 'sw.js'), 'utf8');

// A fake worker global: Cache Storage in memory, fetch from the test, events captured.
function loadSw(src = SRC, net = async () => ok('net')) {
  const on = {}, store = new Map(), fetched = [];
  const key = (r) => typeof r === 'string' ? new URL(r, ORIGIN).href : r.url;
  const open = async (n) => {
    if (!store.has(n)) store.set(n, new Map());
    const m = store.get(n);
    return {
      match: async (r) => m.get(key(r)),
      put: async (r, res) => { m.set(key(r), res); },
      add: async (r) => { const res = await ctx.fetch(r); if (!res.ok) throw new TypeError('bad'); m.set(key(r), res); },
      keys: async () => [...m.keys()].map((url) => ({ url })),
      delete: async (r) => m.delete(key(r)),
    };
  };
  class Req { constructor(u, o = {}) { this.url = new URL(u, ORIGIN).href; this.method = 'GET'; this.mode = 'cors'; this.headers = new Headers(); Object.assign(this, o); } }
  const self = { location: new URL(ORIGIN + '/sw.js'), addEventListener: (t, f) => { on[t] = f; }, skipWaiting: async () => {}, clients: { claim: async () => {}, matchAll: async () => [] }, registration: {} };
  const ctx = vm.createContext({ self, location: self.location, caches: { open, has: async (n) => store.has(n), keys: async () => [...store.keys()], delete: async (n) => store.delete(n),
      match: async (r) => { for (const m of store.values()) if (m.has(key(r))) return m.get(key(r)); } },
    fetch: async (r) => { fetched.push(key(r)); return net(r); }, Request: Req, Response, Headers, URL, console });
  vm.runInContext(src, ctx);
  return { ctx, on, store, fetched, Req };
}
function ok(body, { status = 200, headers = {} } = {}) {
  const r = new Response(body, { status, headers });
  Object.defineProperty(r, 'type', { value: 'basic' });
  r.clone = function () { return ok(body, { status, headers }); };
  return r;
}
const req = (u, o = {}) => ({ url: new URL(u, ORIGIN).href, method: o.method || 'GET', mode: o.mode || 'no-cors', headers: new Headers(o.headers || {}) });
const nav = (u) => req(u, { mode: 'navigate' });
async function fire(w, r) {
  const waits = []; let answer = null;
  w.on.fetch({ request: r, respondWith: (p) => { answer = p; }, waitUntil: (p) => waits.push(p) });
  const res = answer ? await answer : null; await Promise.all(waits); return res;
}
const allKeys = (w) => [...w.store.values()].flatMap((m) => [...m.keys()]);

test('routing: pages network-first, versioned assets cached, everything private or live untouched', () => {
  const { ctx } = loadSw();
  const r = (x) => ctx.route(x, ORIGIN);
  assert.equal(r(nav('/')), 'page');
  assert.equal(r(nav('/gold')), 'page');
  assert.equal(r(nav('/macro-desk.html?x=1')), 'page');
  assert.equal(r(req('/assets/bt-fx.js?v=0123456789')), 'asset');
  assert.equal(r(req('/macro-dashboard/assets/mx-page.css?v=abcdef0123')), 'asset');
  for (const x of [
    req('/assets/bt-fx.js'),                      // unversioned: HTTP revalidation only (the old stop-out sound bug)
    req('/assets/sounds/sl.mp3'),
    req('/assets/bt-fx.js?v=notahash'),
    req('/assets/x.js?v=0123456789', { headers: { range: 'bytes=0-' } }),
    req('/cdata/trades.json'), req('/cdata/ict/state.json'), nav('/cdata/users.json'),
    req('/macro-dashboard/cdata/macro/forecast.json'),
    req('/api/me'), nav('/api/bridge?f=mq5'), req('/api/push', { method: 'POST' }),
    req('/md/bars?sym=xauusd&tf=1m'), req('/md/stream?sym=xauusd'), req('/_vercel/insights/script.js'),
    req('/app.webmanifest'), req('/icons/icon-192.png'), req('/sw.js'),
    req('https://fonts.googleapis.com/css2?family=Figtree'), nav('https://example.com/'),
    req('/assets/x.js?v=0123456789', { method: 'POST' }),
  ]) assert.equal(r(x), 'network', x.url);
});

test('/cdata, /api and /md are never answered or stored by the worker', async () => {
  const w = loadSw(SRC, async () => ok('{"secret":1}', { headers: { 'Cache-Control': 'private, no-store' } }));
  for (const u of ['/cdata/ict/state.json', '/api/me', '/md/bars?sym=xauusd']) {
    assert.equal(await fire(w, req(u)), null, u + ' answered by the worker');
    assert.equal(await fire(w, nav(u)), null, u + ' navigation answered by the worker');
  }
  assert.deepEqual(allKeys(w), []);
  assert.deepEqual(w.fetched, []);
});

test('pages: the network answer, never cached; offline -> the offline page', async () => {
  let up = true;
  const w = loadSw(SRC, async (r) => { if (!up) throw new TypeError('Failed to fetch'); return ok(r.url.endsWith('/offline.html') ? 'OFFLINE PAGE' : 'live page'); });
  await new Promise((done) => w.on.install({ waitUntil: (p) => p.then(done) }));
  assert.deepEqual(allKeys(w), [ORIGIN + '/offline.html']);
  assert.equal(await (await fire(w, nav('/gold'))).text(), 'live page');
  assert.deepEqual(allKeys(w), [ORIGIN + '/offline.html'], 'the page was not cached');
  up = false;
  assert.equal(await (await fire(w, nav('/gold'))).text(), 'OFFLINE PAGE');
  const err = ok('server error', { status: 500 });
  const w2 = loadSw(SRC, async () => err);
  assert.equal(await fire(w2, nav('/')), err, 'an HTTP error is passed through, not replaced');
});

test('offline with no precached page: the built-in message', async () => {
  const w = loadSw(SRC, async () => { throw new TypeError('Failed to fetch'); });
  await new Promise((done) => w.on.install({ waitUntil: (p) => p.then(done) }));   // precache fails, install still completes
  const r = await fire(w, nav('/'));
  assert.equal(r.status, 503);
  assert.match(await r.text(), /You\\?'re offline — prices and trades need a connection/);
});

test('offline.html says what the owner asked for', () => {
  const s = fs.readFileSync(path.join(ROOT, 'offline.html'), 'utf8');
  assert.match(s, /You're offline — prices and trades need a connection/);
  assert.doesNotMatch(s, /<(?:script|link)\b[^>]*\b(?:src|href)=["'](?!data:)/i, 'self-contained');
});

test('versioned assets: stale-while-revalidate, one version per file, only storable answers kept', async () => {
  let n = 0, cc = '';
  const w = loadSw(SRC, async (r) => { if (r.url.endsWith('/offline.html')) throw new TypeError('down'); return ok('v' + (++n), { headers: cc ? { 'Cache-Control': cc } : {} }); });
  await new Promise((done) => w.on.install({ waitUntil: (p) => p.then(done) }));
  assert.equal(await (await fire(w, req('/assets/a.js?v=aaaaaaaaaa'))).text(), 'v1');
  assert.equal(await (await fire(w, req('/assets/a.js?v=aaaaaaaaaa'))).text(), 'v1', 'served from the cache');
  assert.equal(n, 2, 'and revalidated in the background');
  await fire(w, req('/assets/a.js?v=bbbbbbbbbb'));
  assert.deepEqual(allKeys(w), [ORIGIN + '/assets/a.js?v=bbbbbbbbbb'], 'the superseded version is dropped');
  cc = 'no-store';
  await fire(w, req('/assets/b.js?v=cccccccccc'));
  assert.ok(!allKeys(w).some((k) => k.includes('/b.js')), 'no-store is never cached');
  const w404 = loadSw(SRC, async () => ok('missing', { status: 404 }));
  await new Promise((done) => w404.on.install({ waitUntil: (p) => p.then(done) }));
  await fire(w404, req('/assets/c.js?v=dddddddddd'));
  assert.deepEqual(allKeys(w404), []);
});

test('a superseded worker (its cache deleted by a newer one) does not re-create its cache', async () => {
  const w = loadSw(SRC, async () => ok('x'));
  const r = await fire(w, req('/assets/a.js?v=aaaaaaaaaa'));   // never installed / cache already deleted
  assert.equal(await r.text(), 'x');
  assert.deepEqual([...w.store.keys()], []);
});

test('activate: caches of older versions go, the current ones and foreign caches stay', async () => {
  const w = loadSw(buildWorker(SRC, 'abc123', false));
  for (const n of ['meridian-v3', 'gold-terminal-v2', 'mx-assets-old', 'mx-shell-old', 'mx-shell-abc123', 'mx-assets-abc123', 'someone-else']) await w.ctx.caches.open(n);
  await new Promise((done) => w.on.activate({ waitUntil: (p) => p.then(done) }));
  assert.deepEqual([...w.store.keys()].sort(), ['mx-assets-abc123', 'mx-shell-abc123', 'someone-else']);
});

test('kill switch: no fetch handling, every cache of ours deleted, push still handled', async () => {
  const w = loadSw(buildWorker(SRC, 'abc123', true));
  assert.equal(await fire(w, nav('/')), null);
  assert.equal(await fire(w, req('/assets/a.js?v=aaaaaaaaaa')), null);
  for (const n of ['mx-assets-abc123', 'mx-shell-abc123', 'meridian-v3']) await w.ctx.caches.open(n);
  await new Promise((done) => w.on.install({ waitUntil: (p) => p.then(done) }));
  await new Promise((done) => w.on.activate({ waitUntil: (p) => p.then(done) }));
  assert.deepEqual([...w.store.keys()], []);
  assert.equal(typeof w.on.push, 'function');
  assert.equal(typeof w.on.notificationclick, 'function');
});

test('buildWorker stamps VERSION and KILL and refuses a worker without them', () => {
  const s = buildWorker(SRC, 'feedbeef0001', false);
  assert.match(s, /^const VERSION = 'feedbeef0001';$/m);
  assert.match(s, /^const KILL = false;$/m);
  assert.match(buildWorker(SRC, 'x', true), /^const KILL = true;$/m);
  assert.throws(() => buildWorker('self.addEventListener("fetch", () => {})', 'x', false));
});

test('injectHead: adds the missing app tags once, normalises manifest and Apple icon links', () => {
  const page = '<!doctype html><html><head><meta charset="utf-8"><link rel="manifest" href="manifest.json"><meta name="theme-color" content="#030607"><link rel="apple-touch-icon" href="icon-192.png"></head><body><script>var s = "<link rel=\\"manifest\\">";</script></body></html>';
  const t = injectHead(page);
  assert.equal(injectHead(t), t, 'idempotent');
  assert.match(t, /<link rel="manifest" href="\/app\.webmanifest">/);
  assert.doesNotMatch(t, /manifest\.json/);
  assert.match(t, /<meta name="theme-color" content="#030607">/, 'a page keeps its own theme colour');
  assert.equal((t.match(/theme-color/g) || []).length, 1);
  assert.match(t, /<link rel="apple-touch-icon" href="\/icons\/apple-touch-icon\.png">/);
  for (const re of [/apple-mobile-web-app-capable" content="yes"/, /name="mobile-web-app-capable" content="yes"/, /apple-mobile-web-app-title" content="Meridian X"/,
    /apple-mobile-web-app-status-bar-style" content="black"/, /<script src="\/assets\/pwa\.js" defer><\/script>/]) assert.match(t, re);
  assert.ok(t.indexOf('pwa.js') < t.indexOf('</head>'));
  assert.ok(t.endsWith('<body><script>var s = "<link rel=\\"manifest\\">";</script></body></html>'), 'the body is untouched');
  assert.equal(injectHead('<p>no head</p>'), '<p>no head</p>');
  const stamped = t.replace('/assets/pwa.js', '/assets/pwa.js?v=0123456789');
  assert.equal(injectHead(stamped), stamped, 'a stamped pwa.js counts as present');
});

test('build step: worker version follows the site content, kill switch from the environment', () => {
  const out = fs.mkdtempSync(path.join(os.tmpdir(), 'pwa-'));
  fs.mkdirSync(path.join(out, 'assets'));
  fs.writeFileSync(path.join(out, 'index.html'), '<html><head></head><body></body></html>');
  fs.writeFileSync(path.join(out, 'assets', 'a.js'), 'one');
  fs.mkdirSync(path.join(out, 'research'));
  fs.writeFileSync(path.join(out, 'research', 'index.json'), '{"generated":1}');
  const a = run(out, {});
  assert.equal(a.pages, 1);
  assert.match(fs.readFileSync(path.join(out, 'index.html'), 'utf8'), /pwa\.js/);
  assert.equal(run(out, {}).version, a.version, 'deterministic');
  fs.writeFileSync(path.join(out, 'research', 'index.json'), '{"generated":2}');
  assert.equal(run(out, {}).version, a.version, 'data timestamps do not make a new worker');
  fs.writeFileSync(path.join(out, 'assets', 'a.js'), 'two');
  const b = run(out, {});
  assert.notEqual(b.version, a.version, 'a changed asset is a new worker');
  assert.match(fs.readFileSync(path.join(out, 'sw.js'), 'utf8'), new RegExp(`^const VERSION = '${b.version}';$`, 'm'));
  assert.equal(run(out, { MX_SW_KILL: '1' }).kill, true);
  assert.match(fs.readFileSync(path.join(out, 'sw.js'), 'utf8'), /^const KILL = true;$/m);
  assert.equal(siteVersion(out, SRC), siteVersion(out, SRC));
  fs.rmSync(out, { recursive: true, force: true });
});

test('built site: every page carries the app tags; the worker is stamped and not killed', () => {
  const out = path.join(ROOT, 'out');
  const pages = ['index.html', 'market-structure.html', 'gold-trading.html', 'edge-lab.html', 'macro-desk.html', 'backtest.html', 'macro/index.html', 'veteran/index.html'];
  for (const p of pages) {
    const head = fs.readFileSync(path.join(out, p), 'utf8').split(/<\/head>/i)[0];
    assert.match(head, /<link rel="manifest" href="\/app\.webmanifest">/, p);
    assert.match(head, /<script src="\/assets\/pwa\.js\?v=[0-9a-f]{10}" defer><\/script>/, p);
    assert.match(head, /apple-touch-icon" href="\/icons\/apple-touch-icon\.png"/, p);
  }
  const sw = fs.readFileSync(path.join(out, 'sw.js'), 'utf8');
  assert.match(sw, /^const VERSION = '[0-9a-f]{12}';$/m);
  assert.match(sw, /^const KILL = false;$/m);
  assert.ok(fs.existsSync(path.join(out, 'offline.html')));
});

const pngSize = (f) => { const b = fs.readFileSync(f); assert.equal(b.toString('latin1', 1, 4), 'PNG', f); return [b.readUInt32BE(16), b.readUInt32BE(20)]; };

test('manifest: installable (name, standalone, start_url in scope, 192 + 512 + maskable icons that exist at their sizes)', () => {
  const m = JSON.parse(fs.readFileSync(path.join(ROOT, 'app.webmanifest'), 'utf8'));
  assert.equal(m.name, 'Meridian X');
  assert.ok(m.short_name && m.short_name.length <= 12);
  assert.equal(m.display, 'standalone');
  assert.equal(m.id, '/');
  assert.ok(m.start_url.startsWith(m.scope));
  assert.equal(m.theme_color, '#08090c'); assert.equal(m.background_color, '#08090c');   // the desk's dark --bg token
  for (const i of m.icons) {
    const [w, h] = pngSize(path.join(ROOT, i.src));
    assert.equal(`${w}x${h}`, i.sizes, i.src);
  }
  const has = (size, purpose) => m.icons.some((i) => i.sizes === size && i.purpose.split(' ').includes(purpose));
  assert.ok(has('192x192', 'any') && has('512x512', 'any') && has('192x192', 'maskable') && has('512x512', 'maskable'));
  assert.deepEqual(pngSize(path.join(ROOT, 'icons/apple-touch-icon.png')), [180, 180]);
  const rewrites = JSON.parse(fs.readFileSync(path.join(ROOT, 'vercel.json'), 'utf8')).rewrites.map((r) => r.source);
  for (const s of m.shortcuts) assert.ok(rewrites.includes(s.url), s.url);
});

test('caching headers: the worker and manifest revalidate, nothing is immutable, the build runs pwa.mjs before stamping', () => {
  const v = JSON.parse(fs.readFileSync(path.join(ROOT, 'vercel.json'), 'utf8'));
  const cc = (src) => ((v.headers.find((h) => h.source === src) || {}).headers || []).find((h) => h.key === 'Cache-Control');
  assert.equal(cc('/sw.js').value, 'no-cache');
  assert.equal(cc('/app.webmanifest').value, 'no-cache');
  assert.doesNotMatch(JSON.stringify(v.headers), /immutable/);
  const b = fs.readFileSync(path.join(ROOT, 'scripts/build.sh'), 'utf8');
  assert.ok(b.indexOf('scripts/pwa.mjs') > 0 && b.indexOf('scripts/pwa.mjs') < b.indexOf('scripts/stamp-assets.mjs'));
  assert.match(b, /\boffline\.html\b/); assert.match(b, /\bicons\b/);
});
