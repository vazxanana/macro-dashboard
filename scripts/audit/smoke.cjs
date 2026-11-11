// Run: sh scripts/build.sh && (cd out && python3 -m http.server 8766 &) ; node --use-env-proxy scripts/audit/smoke.cjs
// Page smoke test (CI, .github/workflows/ci.yml): every page of out/ opens without a page error (uncaught exception or
// unhandled rejection) and without sideways scroll at 390 px, as the owner, signed out, and on a 1366 px desktop (the owner also
// opens the Desk's inner views, see INNER); and no visible
// element runs an endless animation of a custom property or box-shadow (the header ring rule, CLAUDE.md "Desk smoothness").
// On the phone no inner view of the Desk may be wider than the screen either (the app clips it, so it never scrolls sideways).
// Like the ChronosTrade audit: /api/me is stubbed (owner or signed out), /md/bars is fetched from the live meridianx.dev proxy;
// /cdata/* comes from the public council-data branch (what api/data.js serves). Other /api/* answer 404 and every other
// third-party host (exchanges, FRED, calendars, websockets) is cut, so a page's offline path runs the same on every run.
// A failed proxy fetch answers 503: the page's fallback path runs, which must not throw either. Exit code 1 on any failure.
// Desk load (11 Nov): while the Desk loads, no /cdata file may be requested twice (every reader shares window.msData), and a
// visitor who is not signed in may only ask for the guest allowlist (GUEST_OK in api/data.js). A fourth run opens the Desk as a
// guest who chose "Continue as guest": under the first-load sign-in card the app sleeps, so that card alone no longer runs it.
const { chromium } = require('playwright');
const PORT = process.env.PORT || 8766, H = 'http://127.0.0.1:' + PORT;
const CDATA = 'https://raw.githubusercontent.com/vazxanana/macro-dashboard/council-data/';
const PAGES = ['/', '/market-structure.html', '/macro-desk.html', '/backtest.html', '/academy.html', '/edge-lab.html', '/gold-trading.html', '/macro/', '/veteran/', '/offline.html'];
// Inner views a page only draws when they are opened (the Desk's Council panes run their render functions on first show):
// as the owner, each is opened by its hash on the loaded page and must not throw either. Council → Systems once threw
// "sn is not defined" there, unseen by a check that only loaded the page.
const INNER = { '/market-structure.html': ['#council/overview', '#council/trades', '#council/systems', '#council/review', '#council/research', '#council/macro', '#council/week', '#scanner', '#gold', '#mosha', '#ict', '#crypto', '#lit', '#sdv', '#users', '#profile'] };
const OWNER = { u: 'owner', name: 'Owner', role: 'owner' };
const DESK = ['/', '/market-structure.html'];
const GUEST_OK = ['trades.json', 'snapshot.json', 'ict/replay.json', 'research/replay-2w.json', 'research.json', 'mt5/signals.csv'];   // api/data.js
// script and font CDNs the pages load (a page without its chart library is not what visitors get)
const ALLOW = /^https:\/\/(cdn\.jsdelivr\.net|s3\.tradingview\.com|fonts\.googleapis\.com|fonts\.gstatic\.com)\//;
const SETTLE = +process.env.SMOKE_SETTLE_MS || 3000;
const cache = new Map();
const proxy = (url) => { if (!cache.has(url)) cache.set(url, fetch(url, { signal: AbortSignal.timeout(15000) }).then(async (r) => ({ status: r.status, body: Buffer.from(await r.arrayBuffer()), type: r.headers.get('content-type') || 'application/octet-stream' })).catch(() => ({ status: 503, body: Buffer.from('{}'), type: 'application/json' }))); return cache.get(url); };

async function wire(ctx, account, seen) {
  await ctx.routeWebSocket(/.*/, (ws) => ws.close()).catch(() => {});
  await ctx.route(/.*/, async (r) => {
    const u = new URL(r.request().url());
    if (u.origin !== H) return ALLOW.test(u.href) ? r.continue() : r.abort('internetdisconnected');
    const p = u.pathname;
    if (/^\/api\/me$/.test(p)) return r.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ account }) });
    if (/^\/api\/sounds$/.test(p)) return r.fulfill({ status: 200, contentType: 'application/json', body: '{"sl":null,"tp":null}' });
    if (/^\/api\//.test(p) || p === '/md/stream') return r.fulfill({ status: 404, contentType: 'application/json', body: '{}' });
    if (p === '/md/bars') { const x = await proxy('https://meridianx.dev' + p + u.search); return r.fulfill({ status: x.status, contentType: x.type, body: x.body }); }
    if (p.startsWith('/cdata/')) { seen.push(p.slice(7)); const x = await proxy(CDATA + p.slice(7)); return r.fulfill({ status: x.status, contentType: /\.json$/.test(p) ? 'application/json' : 'text/plain', body: x.body }); }
    // vercel.json rewrites
    const m = /^\/macro-dashboard(\/.*)$/.exec(p); if (m) return r.continue({ url: H + m[1] + u.search });
    return r.continue();
  });
}

(async () => {
  const b = await chromium.launch(), fails = [], t0 = Date.now();
  const runs = [['phone, owner', { width: 390, height: 844 }, OWNER], ['phone, signed out', { width: 390, height: 844 }, null], ['desktop, owner', { width: 1366, height: 768 }, OWNER], ['phone, guest', { width: 390, height: 844 }, null, DESK]];
  const lines = []; let total = 0;
  // the three runs go side by side (own contexts); each opens its pages one after the other
  await Promise.all(runs.map(async ([label, viewport, account, only], ri) => {
    const pages = only || PAGES, seen = []; total += pages.length;
    const ctx = await b.newContext({ viewport, serviceWorkers: 'block', isMobile: viewport.width < 500, hasTouch: viewport.width < 500 });
    await wire(ctx, account, seen);
    if (only) await ctx.addInitScript(() => { try { localStorage.setItem('ms-guest', '1'); } catch (e) {} });   // "Continue as guest" was chosen before
    for (const [pi, path] of pages.entries()) {
      const p = await ctx.newPage(), errs = []; seen.length = 0;
      p.on('framenavigated', (f) => { if (f === p.mainFrame()) seen.length = 0; });   // a reload (the first /api/me answer signs the owner in) is a new load
      p.on('pageerror', (e) => errs.push(e.message.split('\n')[0]));
      p.on('crash', () => errs.push('page crashed'));
      const res = await p.goto(H + path, { waitUntil: 'load', timeout: 30000 }).catch((e) => { errs.push('load: ' + e.message.split('\n')[0]); return null; });
      if (res && !res.ok()) errs.push('HTTP ' + res.status());
      await p.waitForTimeout(SETTLE);
      if (DESK.includes(path)) {   // council-data while the Desk loads: one request per file, and guests only the allowlist
        const twice = [...new Set(seen.filter((f, i) => seen.indexOf(f) !== i))]; if (twice.length) errs.push('council-data requested more than once during load: ' + twice.join(', '));
        const leak = account ? [] : [...new Set(seen.filter((f) => !GUEST_OK.includes(f)))]; if (leak.length) errs.push('not signed in, yet asked for: ' + leak.join(', '));
        if (!seen.includes('trades.json')) errs.push('the Desk did not ask for trades.json (the load check saw nothing)');
      }
      if (account && INNER[path]) for (const h of INNER[path]) {
        const n = errs.length; await p.evaluate((x) => { location.hash = x; }, h).catch(() => {}); await p.waitForTimeout(600);
        // a view wider than the phone is cut off on the right without any sideways scroll (the app clips it), so the width check
        // below cannot see it: the six-desk switch once made every desk view 10 px too wide (QA sweep, 11 Nov)
        if (viewport.width < 500) { const cut = await p.evaluate(() => [...document.querySelectorAll('#ms-live > section')].filter((e) => e.getClientRects().length).flatMap((e) => [e, ...e.children]).filter((e) => e.getClientRects().length && e.getBoundingClientRect().right > innerWidth + 1).map((e) => `${e.id ? '#' + e.id : e.tagName.toLowerCase() + '.' + String(e.className).trim().split(/\s+/)[0]} ends at ${Math.round(e.getBoundingClientRect().right)} px`)).catch(() => []); if (cut.length) errs.push(`view cut off on the right: ${[...new Set(cut)].slice(0, 3).join(', ')}`); }
        for (let i = n; i < errs.length; i++) errs[i] = `${h}: ${errs[i]}`;
      }
      // scroll to the bottom and back so lazy sections render before the width check
      await p.evaluate(async () => { window.scrollTo(0, document.body.scrollHeight); await new Promise((r) => setTimeout(r, 300)); window.scrollTo(0, 0); }).catch(() => {});
      const w = await p.evaluate(() => ({ sw: document.documentElement.scrollWidth, iw: innerWidth })).catch(() => ({ sw: 0, iw: 0 }));
      // endless animations that repaint every frame: a custom property (the conic ring's angle) or box-shadow; opacity / transform pulses are fine
      const spin = await p.evaluate(() => document.getAnimations().filter((a) => { try { const t = a.effect && a.effect.target; if (a.effect.getComputedTiming().iterations !== Infinity || a.playState !== 'running' || !t || !t.getClientRects().length) return false;
        const ks = new Set(a.effect.getKeyframes().flatMap((k) => Object.keys(k)).filter((x) => !/^(offset|easing|composite|computedOffset)$/.test(x))); return !ks.size || ks.has('boxShadow') || [...ks].some((x) => x.startsWith('--')); } catch (e) { return false; } })
        .map((a) => `${a.effect.target.tagName.toLowerCase()}${a.effect.target.className && typeof a.effect.target.className === 'string' ? '.' + a.effect.target.className.trim().split(/\s+/)[0] : ''}${a.effect.pseudoElement || ''} ${a.animationName || ''}`)).catch(() => []);
      if (spin.length) errs.push('endless repaint animation: ' + [...new Set(spin)].join(', '));
      // against the set width, not innerWidth: a phone browser zooms out to fit a too-wide page, so innerWidth grows with it
      const wide = viewport.width < 500 && Math.max(w.sw, w.iw) > viewport.width + 1;
      const ok = !errs.length && !wide;
      lines[ri * PAGES.length + pi] = `${ok ? 'PASS' : 'FAIL'}  ${label.padEnd(17)} ${path.padEnd(24)}${wide ? ` sideways scroll: ${Math.max(w.sw, w.iw)} px wide at ${viewport.width} px` : ''}${errs.length ? ' errors: ' + errs.join(' | ') : ''}`;
      if (!ok) fails.push(label + ' ' + path);
      await p.close();
    }
    await ctx.close();
  }));
  console.log(lines.filter(Boolean).join('\n'));
  await b.close();
  const got = await Promise.all([...cache].map(async ([u, x]) => [u, (await x).status]));
  console.log(`\nproxied: ${got.length} files (${got.filter(([, st]) => st === 200).length} answered 200; a miss runs the page's fallback)`);
  console.log(`${total - fails.length} / ${total} passed in ${((Date.now() - t0) / 1000).toFixed(1)} s`);
  process.exit(fails.length ? 1 : 0);
})().catch((e) => { console.error('ABORTED:', e.message.split('\n')[0]); process.exit(1); });
