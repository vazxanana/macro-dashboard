// Charts fit the window, and the desktop watchlist (26 Nov 2026). Display only.
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';

const page = fs.readFileSync(new URL('../market-structure.html', import.meta.url), 'utf8');
const css = /<style id="ms-fit-css">([\s\S]*?)<\/style>/.exec(page)[1];
const js = /<script id="ms-fit-js">([\s\S]*?)<\/script>/.exec(page)[1];

function load() {
  // the three pure pieces, lifted from the page's own block
  const pick = (name) => { const i = js.indexOf('function ' + name + '('); assert.ok(i > 0, name); let d = 0, j = js.indexOf('{', i); for (let k = j; k < js.length; k++) { if (js[k] === '{') d++; else if (js[k] === '}' && --d === 0) return js.slice(i, k + 1); } };
  const esc = /const esc = [^\n]+/.exec(js)[0];
  const ctx = {}; vm.createContext(ctx);
  vm.runInContext(esc + '\n' + ['heightFor', 'rowsOf', 'rowsHtml'].map(pick).join('\n') + '\nthis.F = { heightFor, rowsOf, rowsHtml };', ctx);
  return ctx.F;
}

test('the chart height makes the rows end at the bottom of the window', () => {
  const F = load();
  // one chart: window 900, grid starts at 181, pane chrome 42, 10 px left under it
  const a = F.heightFor({ win: 900, top: 181, reserve: 0, pad: 10, gap: 8, chrome: 42, rows: 1, minOne: 260, minHalf: 200 });
  assert.equal(a.h, 900 - 181 - 10 - 42); assert.equal(a.av, 709);
  // two rows share it: 2 x (h + chrome) + gap = what is available
  const b = F.heightFor({ win: 900, top: 181, reserve: 0, pad: 10, gap: 8, chrome: 42, rows: 2, minOne: 260, minHalf: 200 });
  assert.ok(2 * (b.h + 42) + 8 <= 709 && 2 * (b.h + 43) + 8 > 709);
  // a phone: the wheel bar and the tab bar at the bottom are kept free
  const c = F.heightFor({ win: 844, top: 130, reserve: 119, pad: 6, gap: 0, chrome: 49, rows: 1, minOne: 260, minHalf: 200 });
  assert.equal(c.h, 844 - 130 - 119 - 6 - 49);
  // never under the smallest chart worth drawing: the page scrolls instead
  assert.equal(F.heightFor({ win: 300, top: 250, reserve: 0, pad: 10, gap: 0, chrome: 40, rows: 1, minOne: 170, minHalf: 150 }).h, 170);
});

test('rows a view shows in one screen', () => {
  const F = load();
  assert.equal(F.rowsOf('all', 1, false), 2);
  for (const v of ['1h', '1d', 'one', 'multi']) assert.equal(F.rowsOf(v, 1, false), 1);
  assert.equal(F.rowsOf('split', 1, false), 1); assert.equal(F.rowsOf('split', 1, true), 2);
  assert.deepEqual([1, 2, 3, 4].map((n) => F.rowsOf('lay', n, false)), [1, 1, 2, 2]);
  assert.equal(F.rowsOf('lay', 2, true), 2);
});

test('the watchlist rows: escaped, filtered, the current market marked, no price without a quote', () => {
  const F = load();
  const list = [{ k: 'xau', label: 'XAU/USD', name: 'Gold', group: 'Metals', dec: 1, on: true }, { k: 'eurusd', label: 'EUR/USD', name: 'Euro', group: 'Forex', dec: 5 }, { k: 'btc', label: 'BTC<b>', name: 'x', group: 'Crypto' }];
  const Q = { xau: { c: 3566.31, ch: -0.284 }, eurusd: { c: 1.0971, ch: 0.01 } };
  const h = F.rowsHtml(list, Q, '');
  assert.match(h, /class="wlp-i cur" href="\?s=xau#charts" aria-current="true"/);
  assert.match(h, /3,566\.3<\/span><span class="wlp-c dn">−0\.28%/);
  assert.match(h, /1\.09710<\/span><span class="wlp-c up">\+0\.01%/);
  assert.ok(h.includes('BTC&lt;b&gt;') && !h.includes('BTC<b>'));
  assert.match(h, /BTC&lt;b&gt;<\/span><span class="wlp-p">—<\/span><span class="wlp-c "><\/span>/);
  assert.equal((h.match(/class="wlp-g"/g) || []).length, 3);
  const f = F.rowsHtml(list, Q, 'gold'); assert.ok(f.includes('XAU/USD') && !f.includes('EUR/USD'));
  assert.match(F.rowsHtml(list, Q, 'zzz'), /No market matches/);
});

test('display only: no order, no request of its own, two display preferences', () => {
  assert.ok(!/fetch\(|XMLHttpRequest|sendBeacon|WebSocket|EventSource/.test(js));
  assert.ok(!/\.stop\s*=|placeOrder|msPaper/.test(js));
  const keys = [...js.matchAll(/p[gs]et\('([^']+)'/g)].map((m) => m[1]);
  assert.deepEqual([...new Set(keys)].sort(), ['ms-tv-v1', 'ms-wlp']);
  assert.ok(!/localStorage\.(setItem|getItem)\((?!k)/.test(js));
  assert.ok(page.includes('window.msQuotes = () => mdQuotes();'));
});

test('the rules: never for guests, never in full screen, the phone simple view block untouched', () => {
  for (const rule of css.split('}').map((r) => r.trim()).filter((r) => /--ch-h|--mm-h/.test(r))) { assert.ok(rule.includes(':not([data-role="public"])'), rule.slice(0, 80)); assert.ok(rule.includes(':not(:fullscreen):not(.ch-fake-fs)'), rule.slice(0, 80)); }
  assert.ok(!/data-phone|\.ps-/.test(css));
  assert.ok(/@media \(max-height: 560px\) and \(orientation: landscape\)/.test(css));   // a phone on its side
  assert.ok(/@media \(min-width: 1280px\)/.test(css));                              // the watchlist
  const sizes = [...css.matchAll(/font-size:\s*([\d.]+)px/g)].map((m) => +m[1]).filter((x) => x > 0);
  assert.ok(sizes.every((x) => x >= 12), 'text under 12 px');
  assert.ok(page.indexOf('id="ms-fit-css"') > page.indexOf('id="ms-ch-space-css"'));
});

// ---- on-chart controls (latest candle, go to a date, auto / log / percent)
const cnJs = /<script id="ms-cn-js">([\s\S]*?)<\/script>/.exec(page)[1];
const cnCss = /<style id="ms-cn-css">([\s\S]*?)<\/style>/.exec(page)[1];
function loadCn() {
  const pick = (name) => { const i = cnJs.indexOf('function ' + name + '('); assert.ok(i > 0, name); let d = 0; for (let k = cnJs.indexOf('{', i); k < cnJs.length; k++) { if (cnJs[k] === '{') d++; else if (cnJs[k] === '}' && --d === 0) return cnJs.slice(i, k + 1); } };
  const ctx = {}; vm.createContext(ctx);
  vm.runInContext(['findBar', 'windowAt', 'dayStart'].map(pick).join('\n') + '\nthis.F = { findBar, windowAt, dayStart };', ctx);
  return ctx.F;
}

test('go to a date: the first candle at or after it, and a window that keeps it in view', () => {
  const F = loadCn();
  const bars = Array.from({ length: 500 }, (_, i) => ({ time: 1_700_000_000 + i * 3600 }));
  assert.equal(F.findBar(bars, bars[0].time - 5), 0);
  assert.equal(F.findBar(bars, bars[200].time), 200);
  assert.equal(F.findBar(bars, bars[200].time + 1), 201);
  assert.equal(F.findBar(bars, bars[499].time + 99), 500);
  const w = F.windowAt(200, 120, 500); assert.equal(w.to - w.from, 120); assert.ok(w.from < 200 && w.to > 200);
  const first = F.windowAt(0, 120, 500); assert.ok(first.from <= 0 && first.to > 0);
  const end = F.windowAt(499, 120, 500); assert.ok(end.from <= 499 && end.from >= 0);
  assert.equal(F.dayStart('2026-11-10'), Date.UTC(2026, 10, 10) / 1000);
  for (const bad of ['', '10/11/2026', '2026-11', 'x']) assert.equal(F.dayStart(bad), null);
});

test('on-chart controls: display only, one display preference, not for guests, readable', () => {
  assert.ok(!/fetch\(|XMLHttpRequest|sendBeacon|WebSocket|EventSource|\.stop\s*=|msPaper/.test(cnJs));
  const sets = [...cnJs.matchAll(/localStorage\.setItem\('([^']+)'/g)].map((m) => m[1]);
  assert.deepEqual([...new Set(sets)], ['ms-scale-mode']);
  assert.match(cnJs, /dataset\.role === 'public'\) return/);
  assert.match(cnCss, /html\[data-role="public"\] \.ms-cn \{ display: none; \}/);
  assert.ok([...cnCss.matchAll(/(?:font-size:|font:\s*\d+\s+)([\d.]+)px/g)].every((m) => +m[1] >= 12));
  for (const label of ['Back to the latest candle', 'Go to a date', 'Fit the price scale']) assert.ok(cnJs.includes(label), label);
  assert.match(cnJs, /MODES = \{ n: 0, log: 1, pct: 2 \}/);   // the chart library's Normal, Logarithmic, Percentage
});

test('Layout with three charts: the fit reads the pane with the least around its chart, and the big chart spans both rows', () => {
  assert.match(page, /\.sort\(\(a, b\) => \(a\[0\]\.offsetHeight - a\[1\]\.offsetHeight\) - \(b\[0\]\.offsetHeight - b\[1\]\.offsetHeight\)\)/);
  assert.match(page, /set\['--ch-h2'\] = \(r\.h \* 2 \+ gap \+ chrome\) \+ 'px'/);
  assert.match(page, /\[data-view="lay"\]\[data-lay-n="3"\] \.ms-pane\[data-lay-i="0"\] \.ms-chart \{ height: var\(--ch-h2, var\(--ch-h, 420px\)\) !important; \}/);
  assert.match(page, /#ms-jr-btn \.jr-bl[^}]*\{ display: none; \}/);
});
