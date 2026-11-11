// Run: sh scripts/build.sh && node scripts/audit/pwa.cjs        (PORT=8767 by default; the script starts its own server on it,
// so it must be a free port, not the one out/ is already served on; AUDIT_OUT=<dir> keeps two pictures of the offline page)
// Installable-app audit with service workers ENABLED (the smoke test and the page audits block them): first visit, second
// visit, offline, a deploy while a page is open, the kill switch, ?sw-reset, push, the manifest and the fonts, in a real
// Chromium against out/. Hermetic: no network beyond this machine. The script serves out/ itself with vercel.json's rewrites
// and Cache-Control rules, answers /api/me as the owner and /api, /cdata, /md with marked "private" bodies (so a leak into
// Cache Storage is visible), and cuts every other host. "Offline" = the server drops every connection (a fetch then fails the
// way it does without a network) and the browser is told it is offline. A "deploy" = a copy of out/ with one asset changed,
// its ?v= stamps moved and sw.js rebuilt by scripts/pwa.mjs. Exit code 1 on any FAIL. CLAUDE.md "Installable app".
const { chromium } = require('playwright');
const http = require('node:http');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const crypto = require('node:crypto');
const { pathToFileURL } = require('node:url');

const ROOT = path.join(__dirname, '..', '..');
const OUT = path.join(ROOT, 'out');
const PORT = +process.env.PORT || 8767, H = 'http://127.0.0.1:' + PORT;
const VERCEL = JSON.parse(fs.readFileSync(path.join(ROOT, 'vercel.json'), 'utf8'));
const MARK = 'PRIVATE-' + crypto.randomBytes(6).toString('hex');   // in every /api, /cdata, /md answer
const PAGES = ['/', '/market-structure.html', '/macro-desk', '/backtest', '/academy', '/edge-lab.html', '/gold', '/macro/', '/veteran/'];
const TYPES = { html: 'text/html; charset=utf-8', js: 'text/javascript', css: 'text/css', json: 'application/json', png: 'image/png', svg: 'image/svg+xml', woff2: 'font/woff2', mp3: 'audio/mpeg', webmanifest: 'application/manifest+json', txt: 'text/plain', md: 'text/markdown' };

// ---- the server: out/ (or a "deploy" copy) the way vercel.json serves it ----
const S = { root: OUT, down: false, hits: [] };
const toRe = (src) => new RegExp('^' + src.replace(/:(\w+)\*/g, '(?<$1>.*)').replace(/:(\w+)/g, '(?<$1>[^/]+)') + '$');
const REWRITES = VERCEL.rewrites.map((r) => ({ re: toRe(r.source), to: r.destination }));
const HEADERS = VERCEL.headers.map((h) => ({ re: toRe(h.source), has: h.has || [], missing: h.missing || [], headers: h.headers }));
function headersFor(u) {
  const o = {};
  for (const h of HEADERS) {
    if (!h.re.test(u.pathname)) continue;
    if (!h.has.every((c) => c.type === 'query' && u.searchParams.has(c.key))) continue;
    if (h.missing.some((c) => c.type === 'query' && u.searchParams.has(c.key))) continue;
    for (const x of h.headers) o[x.key] = x.value;
  }
  delete o['Strict-Transport-Security'];   // plain http here
  return o;
}
function fileFor(pathname) {
  let p = pathname;
  if (!fs.existsSync(path.join(S.root, p)) || p.endsWith('/')) for (const r of REWRITES) { const m = r.re.exec(p); if (m) { p = r.to.replace(/:(\w+)\*?/g, (_, k) => (m.groups || {})[k] || '').split('?')[0]; break; } }
  let f = path.join(S.root, decodeURIComponent(p));
  if (!f.startsWith(S.root)) return null;
  if (fs.existsSync(f) && fs.statSync(f).isDirectory()) f = path.join(f, 'index.html');
  return fs.existsSync(f) && fs.statSync(f).isFile() ? f : null;
}
const server = http.createServer((req, res) => {
  const u = new URL(req.url, H), p = u.pathname;
  if (S.down) { req.socket.destroy(); return; }
  S.hits.push(p + u.search);
  const json = (code, body, extra) => { res.writeHead(code, Object.assign({ 'Content-Type': 'application/json', 'Cache-Control': 'private, no-store' }, extra)); res.end(JSON.stringify(body)); };
  if (p === '/api/me') return json(200, { account: { u: 'owner', name: 'Owner', role: 'owner' }, mark: MARK });
  if (p === '/api/sounds') return json(200, { sl: null, tp: null, mark: MARK }, { 'Cache-Control': 'public, max-age=60' });
  // deliberately cacheable answers: only the worker's own rules keep them out of Cache Storage
  if (/^\/(api|cdata|md)\//.test(p)) return json(p.startsWith('/api/') ? 404 : 200, { mark: MARK, trades: [], rows: [], candles: [] }, { 'Cache-Control': 'public, max-age=600' });
  const f = fileFor(p);
  if (!f) { res.writeHead(404, { 'Content-Type': 'text/plain' }); return res.end('not found'); }
  const body = fs.readFileSync(f);
  const etag = '"' + crypto.createHash('sha1').update(body).digest('hex').slice(0, 16) + '"';
  const head = Object.assign({ 'Content-Type': TYPES[path.extname(f).slice(1)] || 'application/octet-stream', ETag: etag }, headersFor(u));
  if (req.headers['if-none-match'] === etag) { res.writeHead(304, head); return res.end(); }
  res.writeHead(200, head); res.end(body);
});

// ---- a "deploy": out/ copied, one asset changed, its stamps moved, the worker rebuilt by the real build step ----
async function deploy(tmp, name, { kill = false, touch = 'assets/mx-nav.js' } = {}) {
  const { run } = await import(pathToFileURL(path.join(ROOT, 'scripts', 'pwa.mjs')).href);
  const dir = path.join(tmp, name);
  fs.cpSync(OUT, dir, { recursive: true });
  const f = path.join(dir, touch), old = fs.readFileSync(f);
  const next = Buffer.concat([old, Buffer.from('\n/* deploy ' + name + ' */\n')]);
  fs.writeFileSync(f, next);
  const h = (b) => crypto.createHash('sha256').update(b).digest('hex').slice(0, 10);
  const from = touch + '?v=' + h(old), to = touch + '?v=' + h(next);
  let pages = 0;
  (function walk(d) { for (const e of fs.readdirSync(d, { withFileTypes: true })) { const q = path.join(d, e.name); if (e.isDirectory()) { if (e.name !== 'assets') walk(q); } else if (/\.html$/.test(e.name)) { const s = fs.readFileSync(q, 'utf8'); if (s.includes(from)) { fs.writeFileSync(q, s.split(from).join(to)); pages++; } } } })(dir);
  const r = run(dir, { MX_SW_KILL: kill ? '1' : '' });
  return { dir, from: '/' + from, to: '/' + to, pages, version: r.version };
}

// ---- checks ----
const rows = [];
const check = (name, ok, detail) => { rows.push([!!ok, name, detail]); console.log(`${ok ? 'PASS' : 'FAIL'}  ${name}${detail && !ok ? '  -> ' + detail : ''}`); };
const note = (s) => console.log('      ' + s);
const until = async (fn, ms = 8000, step = 50) => { const t = Date.now(); for (;;) { const v = await fn().catch(() => null); if (v) return v; if (Date.now() - t > ms) return null; await new Promise((r) => setTimeout(r, step)); } };

// what the page can see of the worker and Cache Storage
const state = (p, shallow) => p.evaluate(async ([mark, shallow]) => {
  const reg = await navigator.serviceWorker.getRegistration('/');
  const out = { reg: !!reg, active: !!(reg && reg.active), controlled: !!navigator.serviceWorker.controller, caches: {}, leaks: [] };
  for (const n of await caches.keys()) {
    out.caches[n] = [];
    if (shallow) continue;   // caches.open would re-create a cache a new worker deletes at this very moment
    const c = await caches.open(n);
    for (const k of await c.keys()) {
      const u = new URL(k.url); out.caches[n].push(u.pathname + u.search);
      const r = await c.match(k); const ct = r.headers.get('Content-Type') || '';
      if (/json|text|javascript/.test(ct) && (await r.clone().text()).includes(mark)) out.leaks.push(u.pathname);
    }
  }
  return out;
}, [MARK, !!shallow]);
const version = (p) => p.evaluate(() => new Promise((res) => {
  const c = navigator.serviceWorker.controller; if (!c) return res(null);
  const on = (e) => { if (e.data && e.data.mxVersion) { navigator.serviceWorker.removeEventListener('message', on); res(e.data); } };
  navigator.serviceWorker.addEventListener('message', on); c.postMessage('mx-version'); setTimeout(() => res(null), 3000);
}));
// An update check, then wait for the new worker WITHOUT touching the old one: Chromium activates a waiting worker (skipWaiting)
// once the old one is idle, and stops it for that; a message or fetch in that moment wakes it up again and the hand-over then
// waits for the next idle moment (5 minutes at most). So no polling of the worker here, only the page's own event.
const takeover = (p) => p.evaluate(() => new Promise((res) => {
  navigator.serviceWorker.addEventListener('controllerchange', () => res(true), { once: true });
  navigator.serviceWorker.getRegistration('/').then((r) => r.update()).catch(() => res(false));
  setTimeout(() => res(false), 20000);
}));
const VERSIONED = /^\/(?:macro-dashboard\/)?assets\/[^?]+\?v=[0-9a-f]{10}$/;

(async () => {
  const t0 = Date.now();
  if (!fs.existsSync(path.join(OUT, 'sw.js'))) throw new Error('out/ is not built: run sh scripts/build.sh');
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'mx-pwa-'));
  await new Promise((r, j) => server.once('error', j).listen(PORT, '127.0.0.1', r));
  const b = await chromium.launch();
  const ctx = await b.newContext({ viewport: { width: 1366, height: 768 }, serviceWorkers: 'allow' });
  await ctx.grantPermissions(['notifications'], { origin: H }).catch(() => {});
  const foreign = [];
  await ctx.routeWebSocket(/.*/, (ws) => ws.close()).catch(() => {});
  await ctx.route((u) => u.origin !== H, (r) => { foreign.push(r.request().url()); return r.abort('internetdisconnected'); });
  // the test's hands on the page's clock and visibility (assets/pwa.js reads Date.now and document.visibilityState), and a
  // counter that survives only as long as the document does (a reload resets it)
  await ctx.addInitScript(() => {
    const now = Date.now.bind(Date); window.__skew = 0; Date.now = () => now() + window.__skew;
    window.__vis = null; Object.defineProperty(document, 'visibilityState', { configurable: true, get: () => window.__vis || 'visible' });
    window.__setVis = (v) => { window.__vis = v; document.dispatchEvent(new Event('visibilitychange')); };
    window.__born = now() + ':' + Math.random();
  });
  const open = async (url, opts) => { const p = await ctx.newPage(); await p.goto(H + url, Object.assign({ waitUntil: 'load', timeout: 20000 }, opts)); return p; };

  try {
    // ---------- 1. first visit ----------
    const SRC = fs.readFileSync(path.join(OUT, 'sw.js'), 'utf8');
    const V1 = (/^const VERSION = '([0-9a-f]{12})';$/m.exec(SRC) || [])[1];
    let p = await open('/edge-lab.html');
    const born = await p.evaluate(() => window.__born);
    const ctl = await until(() => p.evaluate(() => !!navigator.serviceWorker.controller));
    let st = await state(p), v = await version(p);
    check('first visit: the worker installs, activates and takes the open page (no reload)', ctl && st.active && v && v.mxVersion === V1 && !v.kill && born === await p.evaluate(() => window.__born), JSON.stringify({ ctl, v, V1 }));
    check('first visit: caches are mx-shell-<VERSION> (the offline page only) and mx-assets-<VERSION>', JSON.stringify(Object.keys(st.caches).sort()) === JSON.stringify(['mx-assets-' + V1, 'mx-shell-' + V1]) && JSON.stringify(st.caches['mx-shell-' + V1]) === '["/offline.html"]', JSON.stringify(st.caches));
    await p.close();

    // ---------- 2. second visit and heavy use, as the owner ----------
    const fontReq = [], bad = [];
    ctx.on('response', (r) => { const u = new URL(r.url()); if (u.origin === H && /\/assets\/fonts\//.test(u.pathname)) fontReq.push([u.pathname, r.status()]); if (u.origin === H && r.status() >= 400 && !/^\/(api|cdata|md)\//.test(u.pathname)) bad.push(r.status() + ' ' + u.pathname); });
    S.hits.length = 0;
    const perPage = {};
    for (const url of PAGES) {
      const q = await open(url);
      // the Desk reloads once when /api/me first says who is signed in: let that pass
      await q.waitForTimeout(500); await q.waitForLoadState('load').catch(() => {}); await q.waitForTimeout(100);
      if (url === '/market-structure.html') for (const h of ['#council/overview', '#council/week', '#ict', '#mosha', '#profile', '#charts']) { await q.evaluate((x) => { location.hash = x; }, h); await q.waitForTimeout(120); }
      perPage[url] = await q.evaluate(() => ({ fonts: [...document.fonts].length, ctl: !!navigator.serviceWorker.controller, tags: { manifest: document.querySelectorAll('link[rel="manifest"]').length, apple: document.querySelectorAll('link[rel="apple-touch-icon"]').length, theme: document.querySelectorAll('meta[name="theme-color"]').length, capable: document.querySelectorAll('meta[name="apple-mobile-web-app-capable"]').length, pwa: document.querySelectorAll('script[src*="/assets/pwa.js"]').length, manifestHref: (document.querySelector('link[rel="manifest"]') || {}).href } }));
      await q.close();
    }
    p = await open('/backtest');
    await p.waitForTimeout(300);
    st = await state(p);
    const aKeys = st.caches['mx-assets-' + V1] || [], sKeys = st.caches['mx-shell-' + V1] || [];
    const priv = S.hits.filter((x) => /^\/(api|cdata|md)\//.test(x)).length;
    check('heavy use: every page is controlled by the worker', Object.values(perPage).every((x) => x.ctl), JSON.stringify(perPage));
    check(`heavy use: the asset cache holds only /assets/*?v=<hash> (${aKeys.length} entries)`, aKeys.length >= 10 && aKeys.every((k) => VERSIONED.test(k)), aKeys.filter((k) => !VERSIONED.test(k)).join(', ') || 'only ' + aKeys.length + ' entries');
    check('heavy use: one cache entry per asset file', new Set(aKeys.map((k) => k.split('?')[0])).size === aKeys.length);
    check(`heavy use: no page, API answer, /cdata or /md in Cache Storage (${priv} such requests reached the server)`, priv >= 5 && Object.keys(st.caches).length === 2 && JSON.stringify(sKeys) === '["/offline.html"]' && !st.leaks.length && !Object.values(st.caches).flat().some((k) => /^\/(api|cdata|md)\/|\.html(\?|$)|\/$/.test(k) && k !== '/offline.html'), JSON.stringify({ leaks: st.leaks, names: Object.keys(st.caches), sKeys, priv }));
    check('no request to another host is needed for fonts (none to a Google host at all)', !foreign.some((u) => /fonts\.(googleapis|gstatic)\.com|google/.test(u)), foreign.filter((u) => /google/.test(u)).slice(0, 3).join(', '));
    check(`fonts: every font file asked for answers 200 (${new Set(fontReq.map((x) => x[0])).size} files)`, fontReq.length > 0 && fontReq.every((x) => x[1] === 200 || x[1] === 304), fontReq.filter((x) => x[1] >= 400).join(', '));
    check('no same-origin file a page asks for is missing', !bad.length, [...new Set(bad)].slice(0, 6).join(', '));
    const tagsBad = Object.entries(perPage).filter(([, x]) => !(x.tags.manifest === 1 && x.tags.apple === 1 && x.tags.theme >= 1 && x.tags.capable === 1 && x.tags.pwa === 1 && x.tags.manifestHref === H + '/app.webmanifest'));
    check('every page: one manifest link, one Apple icon, one pwa.js, the standalone tags', !tagsBad.length, JSON.stringify(tagsBad));

    // versioned assets: answered from the cache; the unversioned sound always goes to the network and is never stored
    const one = aKeys.find((k) => /\.js\?v=/.test(k));
    S.hits.length = 0;
    const snd = await p.evaluate(async (one) => {
      const a = await fetch('/assets/sounds/sl.mp3'), b2 = await fetch('/assets/sounds/sl.mp3'), c = await fetch(one);
      // read every body: a response the worker answered and nobody reads keeps the worker's fetch event open, and a new worker waits for it
      await Promise.all([a, b2, c].map((r) => r.arrayBuffer()));
      return { a: a.status, b: b2.status, cc: a.headers.get('Cache-Control'), vcc: c.headers.get('Cache-Control'), v: c.status };
    }, one);
    await p.waitForTimeout(150);
    st = await state(p);
    check('the stop-out sound (no ?v=) reaches the server on every request, revalidates, and is not cached by the worker', snd.a === 200 && snd.b === 200 && S.hits.filter((x) => x === '/assets/sounds/sl.mp3').length === 2 && /max-age=0, must-revalidate/.test(snd.cc) && !Object.values(st.caches).flat().some((k) => /sounds/.test(k)), JSON.stringify({ snd, hits: S.hits }));
    check('a ?v= asset is immutable for a year (vercel.json rule)', /max-age=31536000, immutable/.test(snd.vcc || ''), snd.vcc);

    // ---------- 5. manifest ----------
    const man = await p.evaluate(async () => {
      const m = await (await fetch('/app.webmanifest')).json();
      const img = (src) => new Promise((res) => { const i = new Image(); i.onload = () => res(i.naturalWidth + 'x' + i.naturalHeight); i.onerror = () => res('error'); i.src = src; });
      const icons = []; for (const i of m.icons) icons.push([i.src, i.sizes, i.purpose, await img(i.src)]);
      const shortcuts = []; for (const s of m.shortcuts) { const r = await fetch(s.url); await r.arrayBuffer(); shortcuts.push([s.url, r.status, (r.headers.get('Content-Type') || '').split(';')[0], s.icons && s.icons[0] ? await img(s.icons[0].src) : 'none']); }
      const start = await fetch(m.start_url); await start.arrayBuffer();
      return { m, icons, shortcuts, start: start.status, type: (await fetch('/app.webmanifest')).headers.get('Content-Type'), apple: await img('/icons/apple-touch-icon.png'), appleRoot: await img('/apple-touch-icon.png') };
    });
    const has = (size, purpose) => man.icons.some((i) => i[1] === size && i[2] === purpose && i[3] === size);
    check('manifest: 192 and 512 icons, plain and maskable, load at their declared sizes', has('192x192', 'any') && has('512x512', 'any') && has('192x192', 'maskable') && has('512x512', 'maskable') && man.icons.every((i) => i[3] === i[1]), JSON.stringify(man.icons));
    check('manifest: id, name, standalone, start_url inside scope and answering, colours, served as a manifest', man.m.id === '/' && man.m.name && man.m.short_name && man.m.display === 'standalone' && man.m.scope === '/' && man.m.start_url.startsWith(man.m.scope) && man.start === 200 && /^#[0-9a-f]{6}$/.test(man.m.theme_color) && /^#[0-9a-f]{6}$/.test(man.m.background_color) && /manifest\+json/.test(man.type), JSON.stringify({ start: man.start, type: man.type }));
    check('manifest: every shortcut opens a real page and its icon loads', man.shortcuts.length === 3 && man.shortcuts.every((s) => s[1] === 200 && s[2] === 'text/html' && s[3] === '192x192'), JSON.stringify(man.shortcuts));
    check('Apple touch icon: 180 px at /icons/ and at the root', man.apple === '180x180' && man.appleRoot === '180x180', man.apple + ' ' + man.appleRoot);
    const cdp = await ctx.newCDPSession(p);
    const inst = await cdp.send('Page.getInstallabilityErrors').catch(() => null);
    const ierr = inst ? (inst.installabilityErrors || []).map((e) => e.errorId).filter((e) => e !== 'in-incognito') : null;
    if (ierr === null) note('Chromium installability check not available in this browser');
    else check('Chromium reports no installability error', !ierr.length, ierr.join(', '));

    // ---------- push: a real push message through the worker ----------
    const regId = await new Promise((res) => {
      const on = (e) => { const r = (e.registrations || []).find((x) => x.scopeURL === H + '/' && !x.isDeleted); if (r) { cdp.off('ServiceWorker.workerRegistrationUpdated', on); res(r.registrationId); } };
      cdp.on('ServiceWorker.workerRegistrationUpdated', on); cdp.send('ServiceWorker.enable').catch(() => res(null)); setTimeout(() => res(null), 4000);
    });
    // headless Chromium has no notification permission, so the worker's showNotification is replaced by a recorder; the push
    // event itself is the browser's own (real PushMessageData), delivered through the DevTools protocol
    const worker = () => ctx.serviceWorkers().filter((w) => w.url() === H + '/sw.js').pop();
    const shown = async (payloads) => {
      await worker().evaluate(() => { self.__shown = []; self.registration.showNotification = (t, o) => { self.__shown.push({ title: t, body: o.body, tag: o.tag, url: o.data && o.data.url, icon: o.icon }); return Promise.resolve(); }; });
      for (const d of payloads) await cdp.send('ServiceWorker.deliverPushMessage', { origin: H, registrationId: regId, data: d });
      return await until(async () => { const n = await worker().evaluate(() => self.__shown); return n.length >= payloads.length && n; }, 4000) || worker().evaluate(() => self.__shown);
    };
    let pushOk = false;
    if (regId && worker()) {
      try {
        const n = await shown([JSON.stringify({ title: 'XAU rose to 4,100', body: 'Now 4,100.2', url: '/?s=xau#charts', tag: 'pa-1' }), 'not json at all', 'null', '"text"', '[1]', '{"title":7,"body":{},"url":"https://evil.example/x","tag":"pa-2"}', '{"url":"//evil.example/x"}']);
        pushOk = true;
        check('push: an alert becomes a notification with its title, body, icon and chart link', n[0] && n[0].title === 'XAU rose to 4,100' && n[0].body === 'Now 4,100.2' && n[0].url === '/?s=xau#charts' && n[0].tag === 'pa-1' && n[0].icon === '/icons/icon-192.png', JSON.stringify(n[0]));
        check('push: plain text, null, a bare string, a list, wrong types or a link to another site still give a notification that opens this site', n.length === 7 && n[1].body === 'not json at all' && n[3].body === 'text' && n[5].title === '7' && n[5].body === '' && n.slice(1).every((x) => typeof x.title === 'string' && x.title && x.url === '/#charts'), JSON.stringify(n));
      } catch (e) { note('push delivery not available in this browser: ' + e.message.split('\n')[0]); }
    }
    if (!pushOk) note('push through the browser not checked here (tests/pwa.test.mjs covers the handlers)');

    // ---------- 2. offline ----------
    S.down = true; await ctx.setOffline(true);
    const off = [];
    for (const url of PAGES.concat(['/offline.html', '/no-such-page'])) {
      const q = await ctx.newPage();
      const r = await q.goto(H + url, { waitUntil: 'domcontentloaded', timeout: 10000 }).catch((e) => ({ err: e.message.split('\n')[0] }));
      const h1 = r && r.err ? r.err : await q.evaluate(() => (document.querySelector('h1') || {}).textContent || document.title).catch((e) => e.message);
      off.push([url, h1, r && !r.err ? new URL(q.url()).pathname : '']);
      if (process.env.AUDIT_OUT && url === '/backtest') { await q.screenshot({ path: path.join(process.env.AUDIT_OUT, 'pwa-offline-1366.png') }).catch(() => {}); await q.setViewportSize({ width: 390, height: 844 }); await q.screenshot({ path: path.join(process.env.AUDIT_OUT, 'pwa-offline-390.png') }).catch(() => {}); }
      await q.close();
    }
    check('offline: every page (and an unknown one) shows the offline page, at its own address', off.every((o) => /You're offline/.test(o[1])) && off.every((o, i) => o[2] === new URL(H + PAGES.concat(['/offline.html', '/no-such-page'])[i]).pathname), JSON.stringify(off.filter((o) => !/You're offline/.test(o[1]))));
    const offFetch = await p.evaluate(async (one) => {
      const t = async (u) => { try { const r = await fetch(u); return r.status + ':' + (await r.text()).length; } catch (e) { return 'failed'; } };
      return { asset: await t(one), me: await t('/api/me'), sounds: await t('/api/sounds'), cdata: await t('/cdata/trades.json'), md: await t('/md/bars?sym=xau&tf=5m&n=5'), sound: await t('/assets/sounds/sl.mp3'), page: await t('/backtest.html') };
    }, one);
    check('offline: a ?v= asset comes from the cache', /^200:\d{3,}$/.test(offFetch.asset), offFetch.asset);
    check('offline: /api, /cdata, /md, the sound and a page fetched by script all fail (nothing stale is served)', ['me', 'sounds', 'cdata', 'md', 'sound', 'page'].every((k) => offFetch[k] === 'failed'), JSON.stringify(offFetch));
    // back online: the offline page reloads itself into the page that was asked for
    const q = await ctx.newPage();
    await q.goto(H + '/macro-desk', { waitUntil: 'domcontentloaded' }).catch(() => {});
    const wasOff = await q.evaluate(() => !!document.getElementById('retry')).catch(() => false);
    S.down = false; await ctx.setOffline(false);
    const back = await until(() => q.evaluate(() => !document.getElementById('retry') && /macro/i.test(document.title) && location.pathname === '/macro-desk'), 8000);
    check('back online: the offline page reloads by itself into the page that was asked for', wasOff && back, JSON.stringify({ wasOff, back, title: await q.title().catch(() => '') }));
    // and the button does the same without the online event
    S.down = true;
    await q.goto(H + '/gold', { waitUntil: 'domcontentloaded' }).catch(() => {});
    S.down = false;
    await q.click('#retry').catch(() => {});
    const back2 = await until(() => q.evaluate(() => !document.getElementById('retry') && location.pathname === '/gold'), 8000);
    check('back online: "Try again" loads the page', back2);
    await q.close();
    st = await state(p);
    check('offline use left nothing new in Cache Storage', Object.keys(st.caches).length === 2 && JSON.stringify(st.caches['mx-shell-' + V1]) === '["/offline.html"]' && !st.leaks.length && st.caches['mx-assets-' + V1].every((k) => VERSIONED.test(k)), JSON.stringify(Object.keys(st.caches)));

    // ---------- 1. a deploy while pages are open ----------
    const d2 = await deploy(tmp, 'two');
    check('test setup: the second build is a different worker version with a re-stamped asset', d2.version !== V1 && d2.pages >= 1 && d2.from !== d2.to, JSON.stringify(d2));
    // p = /backtest, open since before the deploy; a second open page has a dialog up; a third was away under 10 minutes
    const pDlg = await open('/edge-lab.html'), pShort = await open('/edge-lab.html'), pText = await open('/edge-lab.html'), pCard = await open('/edge-lab.html');
    await pText.evaluate(() => { const t = document.createElement('textarea'); t.id = 'audit-ta'; document.body.appendChild(t); t.value = 'half a note'; });
    await pCard.evaluate(() => { const d = document.createElement('dialog'); document.body.appendChild(d); d.show(); });   // like ChronosTrade's first-steps card: blocks nothing
    await pDlg.evaluate(() => { const d = document.createElement('dialog'); d.id = 'audit-dlg'; document.body.appendChild(d); d.showModal(); });
    const marks = await Promise.all([p, pDlg, pShort, pText, pCard].map((x) => x.evaluate(() => window.__born)));
    S.root = d2.dir;
    await takeover(p);
    const v2 = await version(p);
    // the open pages get the new worker first; its activate step (old caches out) follows about a second later
    const swept = await until(async () => { const s2 = await state(p, true); return Object.keys(s2.caches).length === 2 && Object.keys(s2.caches).every((n) => n.endsWith(d2.version)); }, 10000);
    st = await state(p);
    check('deploy: the new worker takes over the open pages within seconds', v2 && v2.mxVersion === d2.version && !!swept && st.controlled, JSON.stringify(await version(p)));
    check('deploy: caches of the old version are deleted, the new ones exist', JSON.stringify(Object.keys(st.caches).sort()) === JSON.stringify(['mx-assets-' + d2.version, 'mx-shell-' + d2.version]) && JSON.stringify(st.caches['mx-shell-' + d2.version]) === '["/offline.html"]', JSON.stringify(Object.keys(st.caches)));
    check('deploy: no open page was reloaded', JSON.stringify(marks) === JSON.stringify(await Promise.all([p, pDlg, pShort, pText, pCard].map((x) => x.evaluate(() => window.__born)))));
    // the open (old) page still gets every asset its HTML names, old stamps included
    const oldUrls = await p.evaluate(() => [...document.querySelectorAll('script[src], link[rel="stylesheet"][href]')].map((e) => e.src || e.href).filter((u) => /\/assets\//.test(u)));
    const oldGot = await p.evaluate(async (urls) => { const o = []; for (const u of urls) { try { const r = await fetch(u); await r.arrayBuffer(); o.push([new URL(u).pathname, r.status]); } catch (e) { o.push([u, 'failed']); } } return o; }, oldUrls.concat([H + d2.from]));
    check(`deploy: an open page from before the deploy still loads every asset it names (${oldGot.length}, old ?v= included)`, oldGot.length > 3 && oldGot.every((x) => x[1] === 200), JSON.stringify(oldGot.filter((x) => x[1] !== 200)));
    await p.waitForTimeout(200);
    st = await state(p);
    check('deploy: asking for old ?v= URLs re-creates no old cache', Object.keys(st.caches).length === 2 && Object.keys(st.caches).every((n) => n.endsWith(d2.version)), JSON.stringify(Object.keys(st.caches)));
    const pNew = await open('/edge-lab.html');
    const newHtml = await pNew.content();
    check('deploy: the next page load is the new deploy (new HTML, new ?v=)', newHtml.includes(d2.to.slice(1)) && !newHtml.includes(d2.from.slice(1)));
    // the quiet-moment reload (assets/pwa.js): only after 10+ minutes hidden, and never under an open dialog
    const away = async (pg, min) => { await pg.evaluate(() => window.__setVis('hidden')); await pg.evaluate((m) => { window.__skew += m * 60e3; }, min); await pg.evaluate(() => window.__setVis('visible')).catch(() => {}); await pg.waitForTimeout(400); return pg.evaluate(() => window.__born).catch(() => 'navigating'); };
    check('after the update: back from 5 minutes away, the page is left alone', await away(pShort, 5) === marks[2]);
    check('after the update: back from 11 minutes away with a dialog open, the page is left alone', await away(pDlg, 11) === marks[1]);
    check('after the update: back from 11 minutes away with a note typed and not sent, the page is left alone', await away(pText, 11) === marks[3]);
    await pText.evaluate(() => { document.getElementById('audit-ta').value = ''; });
    const again = await away(pText, 11); await pText.waitForLoadState('load').catch(() => {});
    check('after the update: a held-back reload happens at the next quiet return', again !== marks[3]);
    const card = await away(pCard, 11); await pCard.waitForLoadState('load').catch(() => {});
    check('after the update: a card that blocks nothing (a non-modal dialog) does not hold the reload back', card !== marks[4]);
    await p.evaluate(() => { if (document.activeElement && document.activeElement.blur) document.activeElement.blur(); });
    const reloaded = await away(p, 11);
    await p.waitForLoadState('load').catch(() => {});
    check('after the update: back from 11 minutes away with nothing open, the page reloads once into the new deploy', reloaded !== marks[0] && (await p.content()).length > 1000 && (await version(p) || {}).mxVersion === d2.version, String(reloaded === marks[0]));

    // ---------- 3. kill switch ----------
    const d3 = await deploy(tmp, 'three', { kill: true });
    S.root = d3.dir;
    await takeover(p);
    const v3 = await version(p);
    await until(async () => !Object.keys((await state(p, true)).caches).length, 10000);
    st = await state(p);
    check('kill switch: the killed worker takes over and every cache of ours is gone', v3 && v3.kill && !Object.keys(st.caches).length, JSON.stringify({ v3, c: Object.keys(st.caches) }));
    check('kill switch: the worker stays registered (price alerts keep working)', st.reg && st.active && st.controlled);
    S.hits.length = 0;
    const kUrl = await p.evaluate(async () => { const u = [...document.querySelectorAll('script[src]')].map((e) => e.src).find((x) => /\/assets\/.*\?v=/.test(x)); const r = await fetch(u); await r.arrayBuffer(); await (await fetch(u)).arrayBuffer(); return [new URL(u).pathname + new URL(u).search, r.status]; });
    st = await state(p);
    check('kill switch: a ?v= asset goes to the network and nothing is stored', kUrl[1] === 200 && S.hits.filter((x) => x === kUrl[0]).length >= 1 && !Object.keys(st.caches).length, JSON.stringify({ kUrl, hits: S.hits.length }));
    if (pushOk) {
      const n = await shown([JSON.stringify({ title: 'Killed but alerting', tag: 'pa-k' })]).catch(() => []);
      check('kill switch: a push still becomes a notification', n[0] && n[0].title === 'Killed but alerting' && n[0].tag === 'pa-k', JSON.stringify(n));
    }
    S.down = true;
    const kq = await ctx.newPage();
    const kr = await kq.goto(H + '/gold', { waitUntil: 'domcontentloaded', timeout: 8000 }).then(() => kq.evaluate(() => !!document.getElementById('retry'))).catch(() => 'browser error');
    S.down = false; await kq.close();
    check('kill switch: offline navigation is the browser\'s own error (the worker answers nothing)', kr === 'browser error', String(kr));

    // ---------- 3. ?sw-reset (on the normal build again) ----------
    S.root = OUT;
    await takeover(p);
    const reset = async (label, alone) => {
      if (alone) for (const x of ctx.pages()) await x.close();
      const rp = await open('/edge-lab.html');
      await until(() => rp.evaluate(() => !!navigator.serviceWorker.controller));
      await rp.evaluate(async () => { await (await caches.open('mx-shell-left-behind')).put('/x', new Response('x')); });
      await rp.goto(H + '/edge-lab.html?sw-reset&x=1#top', { waitUntil: 'load' }).catch(() => {});
      await until(() => rp.evaluate(() => !/sw-reset/.test(location.search) && document.readyState === 'complete'), 8000);
      check(`?sw-reset (${label}): the address loses the flag and keeps the rest`, rp.url() === H + '/edge-lab.html?x=1#top', rp.url());
      const ok = await until(async () => { const s2 = await state(rp, true); return s2.controlled && s2.active && Object.keys(s2.caches).length === 2; }, 8000);
      const fresh = await state(rp), fv = await version(rp);
      check(`?sw-reset (${label}): the page comes back with a clean worker in charge: this version's two caches, the left-behind one gone, the offline page stored`, ok && fv && fv.mxVersion === V1 && Object.keys(fresh.caches).every((n) => n.endsWith(V1)) && JSON.stringify(fresh.caches['mx-shell-' + V1]) === '["/offline.html"]', JSON.stringify({ c: fresh.caches && Object.keys(fresh.caches), controlled: fresh.controlled, fv }));
      return rp;
    };
    await reset('another window open', false);
    const rp = await reset('the only window', true);
    await rp.close();
  } finally {
    await b.close().catch(() => {});
    server.close();
    fs.rmSync(tmp, { recursive: true, force: true });
  }
  const failed = rows.filter((r) => !r[0]);
  console.log(`\n${rows.length - failed.length} / ${rows.length} passed in ${((Date.now() - t0) / 1000).toFixed(1)} s`);
  process.exit(failed.length ? 1 : 0);
})().catch((e) => { console.error('ABORTED:', (e && e.stack || String(e)).split('\n').slice(0, 3).join(' | ')); try { server.close(); } catch (x) {} process.exit(1); });
