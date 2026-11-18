// ChronosTrade's chart tools on the Desk's Charts (18 Nov 2026): drawing layer (assets/ms-draw.js), 1-4 chart layout with time
// sync, right-click menu, seconds charts on Split's right chart. Offline: the page and the asset are read as text.
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { createRequire } from 'node:module';
const require = createRequire(import.meta.url);
const D = require('../assets/ms-draw.js');
const PAGE = fs.readFileSync('market-structure.html', 'utf8'), SRC = fs.readFileSync('assets/ms-draw.js', 'utf8');

test('drawings are stored in UTC and shown in the chart\'s own time zone', () => {
  const d = { type: 't', t1: 1795000000, p1: 4000, t2: 1795003600, p2: 4010 };
  assert.deepEqual(D.toChart(d, 3600), { ...d, t1: 1795003600, t2: 1795007200 });
  assert.deepEqual(D.toUTC(D.toChart(d, -18000), -18000), d);
  assert.deepEqual(D.toChart({ type: 'h', price: 5 }, 3600), { type: 'h', price: 5 }, 'a horizontal line has no time');
  assert.deepEqual(Object.keys(D.COLS), ['draw', 'up', 'dn', 'gold', 'ink'], 'the colours of ChronosTrade');
});

test('the layout keeps 1 to 4 charts, each timeframe once, from the six panes', () => {
  const src = /function msLayNorm\(v, ids\) \{[\s\S]*?\n {4}return \{ n, tfs: out\.slice\(0, 4\), sync: !\(v && v\.sync === false\) \}; \}/.exec(PAGE); assert.ok(src, 'msLayNorm in the page');
  const norm = Function(`${src[0]}; return msLayNorm;`)(), ids = ['1d', '4h', '1h', '15m', '5m', '1m'];
  assert.deepEqual(norm(null, ids), { n: 2, tfs: ['4h', '1h', '15m', '5m'], sync: true });
  assert.deepEqual(norm({ n: 9, tfs: ['1h', '1h', 'zz', '1d'], sync: false }, ids), { n: 4, tfs: ['1h', '1d', '4h', '15m'], sync: false });
  assert.equal(norm({ n: 0 }, ids).n, 2); assert.equal(norm({ n: 1 }, ids).n, 1);
});

test('wiring: the six panes and Split\'s free chart register with the drawing layer; the scripts load deferred', () => {
  assert.match(PAGE, /<script src="\/assets\/backtest-engine\.js" defer><\/script>\n<script src="\/assets\/ms-draw\.js" defer><\/script>/);
  assert.match(PAGE, /Object\.values\(panes\)\.forEach\(\(P\) => window\.msCharts\.add\(\{ id: P\.tf\.id, el: P\.el, chart: P\.chart, series: P\.series,/);
  assert.match(PAGE, /window\.msCharts\.add\(\{ id: 'split', el, chart: SP\.chart, series: SP\.series,/);
  assert.match(PAGE, /<div class="dr-bar" id="ms-dr-bar" role="toolbar" aria-label="Drawing tools"><\/div>/);
  assert.match(PAGE, /data-view="lay" id="ms-lay-btn"/); assert.match(PAGE, /if \(window\.msLayView\) window\.msLayView\(v === 'lay'\);/);
  assert.match(SRC, /reg\.list\.forEach\(attach\); document\.addEventListener\('ms:chart', \(e\) => attach\(e\.detail\)\);/, 'charts added before or after the script loads');
  // ChronosTrade's pure helpers do the geometry, hit test, magnet, resize and move
  for (const f of ['drawNorm', 'drawGeom', 'drawHit', 'drawSnap', 'drawResize', 'drawMove', 'drawInfo', 'tfLogical', 'tfTimeAt', 'closedBarAt']) assert.ok(SRC.includes(`BT().${f}(`), f);
  for (const k of ['KeyT', 'KeyH', 'KeyJ', 'KeyV', 'KeyR', 'KeyM']) assert.ok(SRC.includes(k), k);
  assert.match(PAGE, /window\.BT\.syncRange\(lvOf\(src\), lvOf\(P\), r\)/, 'the layout syncs by time'); assert.match(PAGE, /window\.BT\.syncEcho\(ex, r, performance\.now\(\)\)/, 'never echoes');
});

test('display only: the drawing layer places, changes and cancels no order and touches no stop or trade', () => {
  assert.doesNotMatch(SRC, /\.stop\s*=|COUNCIL|BT\(\)\.(place|close|closePartial|cancel|advance|onBar)\(|fetch\(|XMLHttpRequest|sendBeacon/);
  assert.match(SRC, /localStorage/); assert.match(SRC, /'ms-dr-' \+ mk/, 'stored per market in this browser');
});

test('seconds charts on Split\'s right chart only, from the OANDA proxy', () => {
  assert.match(PAGE, /const SEC_TFS = \[\{ id: '15s', label: 'S15', role: 'Seconds', sec: 15, binance: null, kraken: null, poll: 5e3 \}, \{ id: '30s', label: 'S30'/);
  const sp = PAGE.slice(PAGE.indexOf('  function spInit() {'), PAGE.indexOf('      if (ch) spMarkup(); } catch (e) {} }, 15e3);'));
  assert.doesNotMatch(sp, /(?<!SP)TFS\.find\(\(t\) => t\.id === (spTf\(\)|tf)\)/, 'every timeframe lookup of the free chart knows the seconds');
  assert.match(PAGE, /<optgroup label="Seconds \(OANDA markets\)">/);
});

test('style: no text under 12 px, 44 px on touch, guests get no layout, the phone view keeps the tools behind More', () => {
  const css = /<style id="ms-dr-css">([\s\S]*?)<\/style>/.exec(PAGE)[1];
  for (const m of css.matchAll(/(\d+(?:\.\d+)?)px\s*(?:\/[\d.]+)?\s+var\(--sans\)|font-size:\s*([\d.]+)px/g)) assert.ok(+(m[1] || m[2]) >= 12, m[0]);
  assert.match(css, /@media \(pointer: coarse\) \{ \.dr-bar button \{ width: 44px; height: 44px; \}/);
  assert.match(css, /html\[data-role="public"\] :is\(#ms-lay-btn, #ms-lay-pop\) \{ display: none !important; \}/);
  assert.doesNotMatch(css, /data-phone/, 'nothing of the phone view in this block');
  assert.match(PAGE, /\.sec-h > :is\(\.mk-mode, \.ind-open, \.cx-tog, \.adr, \.mtf, \.cycle, \.dr-bar, \.dr-note\) \{ display: none !important; \}/);
});
