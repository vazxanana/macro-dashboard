// Run: sh scripts/build.sh && (cd out && python3 -m http.server 8766 &) ; node --use-env-proxy scripts/audit/smoke.cjs
// Page smoke test (CI, .github/workflows/ci.yml): every page of out/ opens without a page error (uncaught exception or
// unhandled rejection) and without sideways scroll at 390 px, as the owner, signed out, and on a 1366 px desktop (the owner also
// opens the Desk's inner views, see INNER); and no visible
// element runs an endless animation of a custom property or box-shadow (the header ring rule, CLAUDE.md "Desk smoothness").
// On the phone no inner view of the Desk may be wider than the screen either (the app clips it, so it never scrolls sideways).
// Like the ChronosTrade audit: /api/me is stubbed (owner or signed out), /md/bars is fetched from the live meridianx.dev proxy;
// /cdata/* comes from the public council-data branch (what api/data.js serves). Other /api/* answer 404 and every other
// third-party host (exchanges, FRED, calendars, websockets) is cut, so a page's offline path runs the same on every run.
// A proxy fetch is tried three times (shared.cjs); one that still fails answers 503: the page's fallback path runs, which must
// not throw either. A check that could not be read (the page went away under it) is a failure, never a pass, and an inner view
// counts only when the Desk really shows it. Exit code 1 on any failure. This audit reads no colours.
const { chromium } = require('playwright');
const { fetchRetry, fetched } = require('./shared.cjs');
const PORT = process.env.PORT || 8766, H = 'http://127.0.0.1:' + PORT;
const CDATA = 'https://raw.githubusercontent.com/vazxanana/macro-dashboard/council-data/';
const PAGES = ['/', '/market-structure.html', '/macro-desk.html', '/backtest.html', '/academy.html', '/edge-lab.html', '/gold-trading.html', '/macro/', '/veteran/', '/offline.html'];
// Inner views a page only draws when they are opened (the Desk's Council panes run their render functions on first show):
// as the owner, each is opened by its hash on the loaded page and must not throw either. Council → Systems once threw
// "sn is not defined" there, unseen by a check that only loaded the page.
const INNER = { '/market-structure.html': ['#council/overview', '#council/trades', '#council/systems', '#council/review', '#council/research', '#council/macro', '#council/week', '#scanner', '#gold', '#mosha', '#ict', '#crypto', '#lit', '#sdv', '#users', '#profile'] };
const OWNER = { u: 'owner', name: 'Owner', role: 'owner' };
// script and font CDNs the pages load (a page without its chart library is not what visitors get)
const ALLOW = /^https:\/\/(cdn\.jsdelivr\.net|s3\.tradingview\.com|fonts\.googleapis\.com|fonts\.gstatic\.com)\//;
const SETTLE = +process.env.SMOKE_SETTLE_MS || 3000;
const proxy = fetchRetry;

// The Desk reloads itself once when /api/me answers with an account the browser did not have yet (the first owner page of a
// run), about when a slow runner's settle time ends. A check that landed in that reload was swallowed and counted as a pass,
// and one that landed just after it measured the page half drawn (413 px wide for half a second). So the settle time counts
// from the page's LAST load (`calm`), and a check the reload interrupted is read again once the page is calm.
const calmer = (p) => { let last = Date.now(); p.on('load', () => { last = Date.now(); }); return async () => { for (let left; (left = SETTLE - (Date.now() - last)) > 0;) await p.waitForTimeout(left); }; };
const ev = async (p, calm, fn, arg) => { for (let i = 0; ; i++) { try { return await p.evaluate(fn, arg); } catch (e) { if (i >= 2 || !/context was destroyed|navigat/i.test(e.message)) throw e; await p.waitForLoadState('load').catch(() => {}); await calm(); } } };

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
      const p = await ctx.newPage(), errs = [], calm = calmer(p);
      p.on('pageerror', (e) => errs.push(e.message.split('\n')[0]));
      p.on('crash', () => errs.push('page crashed'));
      const res = await p.goto(H + path, { waitUntil: 'load', timeout: 30000 }).catch((e) => { errs.push('load: ' + e.message.split('\n')[0]); return null; });
      if (res && !res.ok()) errs.push('HTTP ' + res.status());
      await calm();
      if (account && INNER[path]) for (const h of INNER[path]) {
        const n = errs.length; await ev(p, calm, (x) => { location.hash = x; }, h).catch((e) => errs.push('could not open: ' + e.message.split('\n')[0]));
        // the Desk shows the view asked for (a router that sends the owner home instead would otherwise pass every check below on the wrong view)
        { const [view, pane] = h.slice(1).split('/'); const shown = await p.waitForFunction(([v, c]) => { const e = document.getElementById('v-' + v), q = c && document.getElementById('ms-cp-' + c); return document.documentElement.dataset.view === v && e && !e.hidden && e.getClientRects().length > 0 && (!c || (q && !q.hidden && q.getClientRects().length > 0)); }, [view, pane], { timeout: 10000 }).then(() => true, () => false);
          if (!shown) errs.push('the view did not open'); }
        await p.waitForTimeout(600);   // the view's own render runs on a timer after it is shown: give its errors time to surface
        // a view wider than the phone is cut off on the right without any sideways scroll (the app clips it), so the width check
        // below cannot see it: the six-desk switch once made every desk view 10 px too wide (QA sweep, 11 Nov)
        if (viewport.width < 500) { const cut = await ev(p, calm, () => [...document.querySelectorAll('#ms-live > section')].filter((e) => e.getClientRects().length).flatMap((e) => [e, ...e.children]).filter((e) => e.getClientRects().length && e.getBoundingClientRect().right > innerWidth + 1).map((e) => `${e.id ? '#' + e.id : e.tagName.toLowerCase() + '.' + String(e.className).trim().split(/\s+/)[0]} ends at ${Math.round(e.getBoundingClientRect().right)} px`)).catch((e) => ['width check could not run: ' + e.message.split('\n')[0]]); if (cut.length) errs.push(`view cut off on the right: ${[...new Set(cut)].slice(0, 3).join(', ')}`); }
        for (let i = n; i < errs.length; i++) errs[i] = `${h}: ${errs[i]}`;
      }
      // two view changes with no pause between them (a fast double tap on the navigation): the second skips the first one's slide,
      // which once left a rejected promise unhandled ("Transition was skipped"), seen only when a runner was slow enough
      if (account && INNER[path]) { const n = errs.length; await ev(p, calm, () => { location.hash = '#scanner'; location.hash = '#council/trades'; setTimeout(() => { location.hash = '#home'; }, 30); }).catch((e) => errs.push(e.message.split('\n')[0]));
        const home = await p.waitForFunction(() => document.documentElement.dataset.view === 'home', null, { timeout: 10000 }).then(() => true, () => false); await p.waitForTimeout(400);
        if (!home) errs.push('did not end on the last view asked for'); for (let i = n; i < errs.length; i++) errs[i] = `views changed back to back: ${errs[i]}`; }
      await calm();
      // scroll to the bottom and back so lazy sections render before the width check
      await ev(p, calm, async () => { window.scrollTo(0, document.body.scrollHeight); await new Promise((r) => setTimeout(r, 300)); window.scrollTo(0, 0); }).catch((e) => errs.push('could not scroll the page: ' + e.message.split('\n')[0]));
      const w = await ev(p, calm, () => ({ sw: document.documentElement.scrollWidth, iw: innerWidth })).catch((e) => { errs.push('width check could not run: ' + e.message.split('\n')[0]); return { sw: 0, iw: 0 }; });
      // endless animations that repaint every frame: a custom property (the conic ring's angle) or box-shadow; opacity / transform pulses are fine
      const spin = await ev(p, calm, () => document.getAnimations().filter((a) => { try { const t = a.effect && a.effect.target; if (a.effect.getComputedTiming().iterations !== Infinity || a.playState !== 'running' || !t || !t.getClientRects().length) return false;
        const ks = new Set(a.effect.getKeyframes().flatMap((k) => Object.keys(k)).filter((x) => !/^(offset|easing|composite|computedOffset)$/.test(x))); return !ks.size || ks.has('boxShadow') || [...ks].some((x) => x.startsWith('--')); } catch (e) { return false; } })
        .map((a) => `${a.effect.target.tagName.toLowerCase()}${a.effect.target.className && typeof a.effect.target.className === 'string' ? '.' + a.effect.target.className.trim().split(/\s+/)[0] : ''}${a.effect.pseudoElement || ''} ${a.animationName || ''}`)).catch((e) => { errs.push('animation check could not run: ' + e.message.split('\n')[0]); return []; });
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
  console.log(lines.join('\n'));
  await b.close();
  const got = (await fetched()).map(([u, x]) => [u, x.status, x.tries]), hit = got.filter(([, st]) => st === 200).length, again = got.filter(([, , n]) => n > 1).length;
  console.log(`\nproxied: ${got.length} files (${hit} answered 200${again ? `, ${again} after a retry` : ''}; a miss runs the page's fallback)`);
  // with most of the data missing every page ran its fallback path only: say so where the run is read (it is not a page fault)
  if (got.length && hit < got.length / 2) console.log(`${process.env.GITHUB_ACTIONS ? '::warning::' : 'WARNING: '}smoke test: only ${hit} of ${got.length} data files could be fetched, so the pages were checked on their no-data path`);
  console.log(`${runs.length * PAGES.length - fails.length} / ${runs.length * PAGES.length} passed in ${((Date.now() - t0) / 1000).toFixed(1)} s`);
  process.exit(fails.length ? 1 : 0);
})().catch((e) => { console.error('ABORTED:', e.message.split('\n')[0]); process.exit(1); });
