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
