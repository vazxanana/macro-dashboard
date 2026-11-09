// Run: sh scripts/build.sh && (cd out && python3 -m http.server 8766 &) ; node --use-env-proxy scripts/audit/smoke.cjs
// Page smoke test (CI, .github/workflows/ci.yml): every page of out/ opens without a page error (uncaught exception or
// unhandled rejection) and without sideways scroll at 390 px, as the owner, signed out, and on a 1366 px desktop.
// Like the ChronosTrade audit: /api/me is stubbed (owner or signed out), /md/bars is fetched from the live meridianx.dev proxy;
// /cdata/* comes from the public council-data branch (what api/data.js serves). Other /api/* answer 404 and every other
// third-party host (exchanges, FRED, calendars, websockets) is cut, so a page's offline path runs the same on every run.
// A failed proxy fetch answers 503: the page's fallback path runs, which must not throw either. Exit code 1 on any failure.
const { chromium } = require('playwright');
const PORT = process.env.PORT || 8766, H = 'http://127.0.0.1:' + PORT;
const CDATA = 'https://raw.githubusercontent.com/vazxanana/macro-dashboard/council-data/';
const PAGES = ['/', '/market-structure.html', '/macro-desk.html', '/backtest.html', '/edge-lab.html', '/gold-trading.html', '/macro/', '/veteran/'];
const OWNER = { u: 'owner', name: 'Owner', role: 'owner' };
// script and font CDNs the pages load (a page without its chart library is not what visitors get)
const ALLOW = /^https:\/\/(cdn\.jsdelivr\.net|s3\.tradingview\.com|fonts\.googleapis\.com|fonts\.gstatic\.com)\//;
const SETTLE = +process.env.SMOKE_SETTLE_MS || 3000;
const cache = new Map();
const proxy = (url) => { if (!cache.has(url)) cache.set(url, fetch(url, { signal: AbortSignal.timeout(15000) }).then(async (r) => ({ status: r.status, body: Buffer.from(await r.arrayBuffer()), type: r.headers.get('content-type') || 'application/octet-stream' })).catch(() => ({ status: 503, body: Buffer.from('{}'), type: 'application/json' }))); return cache.get(url); };

async function wire(ctx, account) {
  await ctx.routeWebSocket(/.*/, (ws) => ws.close()).catch(() => {});
  await ctx.route(/.*/, async (r) => {
    const u = new URL(r.request().url());
    if (u.origin !== H) return ALLOW.test(u.href) ? r.continue() : r.abort('internetdisconnected');
    const p = u.pathname;
    if (/^\/api\/me$/.test(p)) return r.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ account }) });
    if (/^\/api\/sounds$/.test(p)) return r.fulfill({ status: 200, contentType: 'application/json', body: '{"sl":null,"tp":null}' });
    if (/^\/api\//.test(p) || p === '/md/stream') return r.fulfill({ status: 404, contentType: 'application/json', body: '{}' });
    if (p === '/md/bars') { const x = await proxy('https://meridianx.dev' + p + u.search); return r.fulfill({ status: x.status, contentType: x.type, body: x.body }); }
    if (p.startsWith('/cdata/')) { const x = await proxy(CDATA + p.slice(7)); return r.fulfill({ status: x.status, contentType: /\.json$/.test(p) ? 'application/json' : 'text/plain', body: x.body }); }
    // vercel.json rewrites
    const m = /^\/macro-dashboard(\/.*)$/.exec(p); if (m) return r.continue({ url: H + m[1] + u.search });
    return r.continue();
  });
}

(async () => {
  const b = await chromium.launch(), fails = [], t0 = Date.now();
  const runs = [['phone, owner', { width: 390, height: 844 }, OWNER], ['phone, signed out', { width: 390, height: 844 }, null], ['desktop, owner', { width: 1366, height: 768 }, OWNER]];
  const lines = [];
  // the three runs go side by side (own contexts); each opens its pages one after the other
  await Promise.all(runs.map(async ([label, viewport, account], ri) => {
    const ctx = await b.newContext({ viewport, serviceWorkers: 'block', isMobile: viewport.width < 500, hasTouch: viewport.width < 500 });
    await wire(ctx, account);
    for (const [pi, path] of PAGES.entries()) {
      const p = await ctx.newPage(), errs = [];
      p.on('pageerror', (e) => errs.push(e.message.split('\n')[0]));
      p.on('crash', () => errs.push('page crashed'));
      const res = await p.goto(H + path, { waitUntil: 'load', timeout: 30000 }).catch((e) => { errs.push('load: ' + e.message.split('\n')[0]); return null; });
      if (res && !res.ok()) errs.push('HTTP ' + res.status());
      await p.waitForTimeout(SETTLE);
      // scroll to the bottom and back so lazy sections render before the width check
      await p.evaluate(async () => { window.scrollTo(0, document.body.scrollHeight); await new Promise((r) => setTimeout(r, 300)); window.scrollTo(0, 0); }).catch(() => {});
      const w = await p.evaluate(() => ({ sw: document.documentElement.scrollWidth, iw: innerWidth })).catch(() => ({ sw: 0, iw: 0 }));
      // against the set width, not innerWidth: a phone browser zooms out to fit a too-wide page, so innerWidth grows with it
      const wide = viewport.width < 500 && Math.max(w.sw, w.iw) > viewport.width + 1;
      const ok = !errs.length && !wide;
      lines[ri * PAGES.length + pi] = `${ok ? 'PASS' : 'FAIL'}  ${label.padEnd(17)} ${path.padEnd(24)}${wide ? ` sideways scroll: ${Math.max(w.sw, w.iw)} px wide at ${viewport.width} px` : ''}${errs.length ? ' errors: ' + errs.join(' | ') : ''}`;
      if (!ok) fails.push(label + ' ' + path);
      await p.close();
    }
    await ctx.close();
  }));
  console.log(lines.join('\n'));
  await b.close();
  const got = await Promise.all([...cache].map(async ([u, x]) => [u, (await x).status]));
  console.log(`\nproxied: ${got.length} files (${got.filter(([, st]) => st === 200).length} answered 200; a miss runs the page's fallback)`);
  console.log(`${runs.length * PAGES.length - fails.length} / ${runs.length * PAGES.length} passed in ${((Date.now() - t0) / 1000).toFixed(1)} s`);
  process.exit(fails.length ? 1 : 0);
})().catch((e) => { console.error('ABORTED:', e.message.split('\n')[0]); process.exit(1); });
