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

test('any timeframe from seconds to a year (19 Nov 2026): grouped, the free chart for the ones no analysed pane has', () => {
  assert.match(PAGE, /const SEC_TFS = \[XTF\('1s', 'S1', 'Seconds', 1\), XTF\('5s', 'S5', 'Seconds', 5\), XTF\('10s', 'S10', 'Seconds', 10\), XTF\('15s', 'S15', 'Seconds', 15\), XTF\('30s', 'S30', 'Seconds', 30\)\];/);
  const sp = PAGE.slice(PAGE.indexOf('  function spInit() {'), PAGE.indexOf('      if (ch) spMarkup(); } catch (e) {} }, 3e3);'));
  assert.ok(sp.length > 1000);
  assert.doesNotMatch(sp, /(?<!SP)TFS\.find\(\(t\) => t\.id === (spTf\(\)|tf)\)/, 'every timeframe lookup of the free chart knows every timeframe');
  const groups = /const TF_GROUPS = (\[[^\n]*\]);/.exec(PAGE)[1];
  assert.deepEqual(JSON.parse(groups.replace(/'/g, '"')).map((g) => g[0]), ['Seconds', 'Minutes', 'Hours', 'Days', 'Week', 'Month', 'Year']);
  const ids = JSON.parse(groups.replace(/'/g, '"')).flatMap((g) => g[1]);
  const bars = fs.readFileSync(new URL('../api/bars.js', import.meta.url), 'utf8');
  for (const id of ids) if (id !== '1Y' && id !== '1s') assert.match(bars, new RegExp(`'${id}': \\['`), `the candle proxy serves ${id}`);
  assert.match(PAGE, /\n    if \(tf && tf\.id === '1Y'\) \{ const r = await fetchBars\(SPTFS\.find\(\(t\) => t\.id === '1M'\)/, 'a year is built from months');
  // the year builder on hand-made months
  const yb = new Function(`${/const yearOf = [^\n]*\n[^\n]*\n[^\n]*return out; \};/.exec(PAGE)[0]}; return yearOf;`)();
  const m = (y, mo, o, h, l, c) => ({ time: Date.UTC(y, mo, 1) / 1e3, open: o, high: h, low: l, close: c, volume: 1 });
  assert.deepEqual(yb([m(2024, 0, 1, 5, 1, 2), m(2024, 11, 2, 9, 0.5, 3), m(2025, 0, 3, 4, 2, 4)]).map((b) => [new Date(b.time * 1e3).getUTCFullYear(), b.open, b.high, b.low, b.close, b.volume]), [[2024, 1, 9, 0.5, 3, 2], [2025, 3, 4, 2, 4, 1]]);
  assert.match(PAGE, /window\.msOneTf = \(t\) => \{[^\n]*if \(panes\[t\]\) \{ setView\(t\); return true; \}/, 'an analysed timeframe opens its own pane');
  assert.match(PAGE, /\.ms-grid4\.ms-grid4\[data-view="one"\] > \.ms-pane:not\(\.ms-splitc\) \{ display: none !important; \}/);
});

test('the toolbar keeps Split, Layout and a Clean toggle; the markup choice is in Style (19 Nov 2026)', () => {
  assert.match(PAGE, /#v-charts \.sec-h > \.seg\[aria-label="Chart view"\] > \[data-view\]:not\(\[data-view="split"\]\):not\(\[data-view="lay"\]\):not\(\[data-view="multi"\]\) \{ display: none !important; \}/);
  assert.match(PAGE, /<div class="sty-seg seg mk-mode mk-in-sty" role="group" aria-label="Chart markup"><button type="button" data-mk="meridian"/);
  assert.match(PAGE, /if \(b\.dataset\.mk === 'clean' && G\.mode === 'clean' && !b\.closest\('\.mk-in-sty'\)\) \{ setMode\(G\.lastMk \|\| 'meridian'\); return; \}/);
});

test('style: no text under 12 px, 44 px on touch, guests get no layout, the phone view keeps the tools behind More', () => {
  const css = /<style id="ms-dr-css">([\s\S]*?)<\/style>/.exec(PAGE)[1];
  for (const m of css.matchAll(/(\d+(?:\.\d+)?)px\s*(?:\/[\d.]+)?\s+var\(--sans\)|font-size:\s*([\d.]+)px/g)) assert.ok(+(m[1] || m[2]) >= 12, m[0]);
  assert.match(css, /@media \(pointer: coarse\) \{ \.dr-bar button \{ width: 44px; height: 44px; \}/);
  assert.match(css, /html\[data-role="public"\] :is\(#ms-lay-btn, #ms-lay-pop\) \{ display: none !important; \}/);
  assert.doesNotMatch(css, /data-phone/, 'nothing of the phone view in this block');
  assert.match(PAGE, /\.sec-h > :is\(\.mk-mode, \.ind-open, \.cx-tog, \.adr, \.mtf, \.cycle, \.dr-bar, \.ch-one, \.dr-note\) \{ display: none !important; \}/);
});

test('line alerts: a horizontal line, ray or trend line keeps its alert; crossing fires once; nothing is sent anywhere', () => {
  const BT = require('../assets/backtest-engine.js');
  const n = BT.drawNorm([{ type: 'h', price: 4000, alert: true }, { type: 'r', t1: 1, p1: 1, t2: 2, p2: 2, alert: true }, { type: 't', t1: 1, p1: 1, t2: 2, p2: 2, alert: 'yes', fired: 5 }]);
  assert.equal(n[0].alert, true, 'kept on a line'); assert.equal(n[1].alert, undefined, 'never on a box'); assert.equal(n[2].alert, undefined, 'only true'); assert.equal(n[2].fired, 5);
  assert.match(SRC, /if \(!fin\(lv\) \|\| \(prev - lv\) \* \(px - lv\) > 0\) continue;\s*delete d\.alert; d\.fired = t;/, 'fires on a cross, then switches itself off');
  assert.match(SRC, /data-alert title="Tell me when price crosses this line \(while this page is open\)"/);
  const blk = SRC.slice(SRC.indexOf('// ---- line alerts'), SRC.indexOf('// read-only view for the audit'));
  assert.doesNotMatch(blk, /fetch\(|XMLHttpRequest|sendBeacon|\.stop\s*=/);
});

test('one chart toolbar: pane headers carry no tools of their own, one bar acts on the chart last touched', () => {
  const page = fs.readFileSync(new URL('../market-structure.html', import.meta.url), 'utf8');
  assert.match(page, /<div class="ch-one" id="ms-ch-one" role="toolbar"/);
  assert.match(page, /\.ms-ph \.ch-tools \{ display: none !important; \}/);
  const js = page.slice(page.indexOf('// ─── One chart toolbar'), page.indexOf('window.msChartOne'));
  assert.match(js, /pointerdown/); assert.match(js, /t\.click\(\)/);
  assert.doesNotMatch(js, /\.stop\s*=|[^e]place\(|fetch\(/);
});

test('flat Charts toolbar (19 Nov 2026): no box around the groups, a Draw button holds the tools on a phone, every phone rule in the phone block', () => {
  const page = fs.readFileSync(new URL('../market-structure.html', import.meta.url), 'utf8');
  const css = page.slice(page.indexOf('<style id="ms-ch-flat-css">'), page.indexOf('</style>', page.indexOf('<style id="ms-ch-flat-css">')));
  assert.ok(css.length > 500, 'the flat block exists');
  assert.ok(page.indexOf('<style id="ms-ch-flat-css">') > page.indexOf('<style id="ms-shell-css">'), 'it comes after the shell, so it wins');
  assert.match(css, /#v-charts \.sec-h > :is\(\.seg, \.mk-mode, \.dr-bar, \.ch-one\) \{ border: 0 !important; background: transparent !important;/);
  const phone = css.slice(css.indexOf('@media (max-width: 640px)'), css.indexOf('@media (max-width: 389px)'));
  assert.match(phone, /#v-charts:not\(\[data-tools\]\) \.sec-h > :is\(\.dr-bar, \.ch-one\) \{ display: none !important; \}/);
  assert.match(phone, /#v-charts\[data-tools\] \.sec-h > \.ch-one\.ch-one/, 'the open tools rules sit in the phone block, not the narrow-phone one');
  assert.match(page, /tg\.className = 'ch-tools-tog'; tg\.id = 'ms-ch-tools-tog'/);
});

test('each chart chooses its own timeframe (19 Nov 2026): a menu in the chart header, the layout slot changed for that chart only, the phone header and the shared rows go', () => {
  const page = fs.readFileSync(new URL('../market-structure.html', import.meta.url), 'utf8');
  assert.match(page, /window\.msLaySet = \(i, t\) =>/);
  const js = page.slice(page.indexOf('// ─── Each chart chooses its own timeframe'), page.indexOf('// ─── Keyboard: 1–6'));
  assert.match(js, /t\.className = 'ph-tf'/); assert.match(js, /m\.className = 'ph-mk'/);
  assert.match(js, /else if \(v === 'lay' && an && window\.msLayState\)/, 'in the layout the menu changes that chart only');
  assert.doesNotMatch(js, /fetch\(|\.stop\s*=/);
  assert.match(page, /html:not\(\[data-role="public"\]\)\[data-view="charts"\] #v-charts \.sec-h > :is\(h2, #ms-wl, \.seg\[aria-label="Chart view"\]\) \{ display: none !important; \}/);
  assert.match(page, /\.brand \.mk-list \.mk-n \{ display: grid !important; \}/, 'the phone market list shows its names');
});

test('more forex pairs, sized through the quote currency; the market on the toolbar, no price chips on Charts (19 Nov 2026)', () => {
  const inst = PAGE.slice(PAGE.indexOf('const INSTRUMENTS = {'), PAGE.indexOf('let instKey = null;'));
  const oanda = fs.readFileSync(new URL('../api/_oanda.js', import.meta.url), 'utf8');
  for (const k of ['nzdusd', 'eurgbp', 'eurjpy', 'gbpjpy', 'audjpy', 'eurchf', 'euraud']) { assert.match(inst, new RegExp(`\\n    ${k}: \\{ group: 'Forex', md: '${k}'`)); assert.match(oanda, new RegExp(`\\['${k}', '`), `the candle proxy knows ${k}`); }
  for (const m of inst.matchAll(/size: 'cross', quote: \['(\w+)', (-?1)\]/g)) assert.match(inst, new RegExp(`\\n    ${m[1]}: \\{ group: 'Forex'`), 'the quote pair is a market with quotes');
  assert.match(PAGE, /window\.msQuoteUsd = \(I\) => \{ if \(!I \|\| !I\.quote\) return null;/);
  const paper = fs.readFileSync(new URL('../assets/ms-paper.js', import.meta.url), 'utf8');
  assert.match(paper, /if \(I\.size === 'cross'\) \{ const u2 = window\.msQuoteUsd && window\.msQuoteUsd\(I\); return u2 \? r2\(units \/ \(1e5 \* u2\), 2\) \+ ' lot'/);
  assert.match(PAGE, /el\.innerHTML = new Array\(17 \+ 1\)/);
  assert.match(PAGE, /b\.id = 'ms-ch-mk'/);
  assert.match(PAGE, /html:not\(\[data-role="public"\]\)\[data-view="charts"\] #v-charts \.sec-h > #ms-wl \{ display: none !important; \}/);
  assert.match(PAGE, /html:not\(\[data-role="public"\]\)\[data-view="charts"\] \.top \.brand #ms-mk-btn \{ display: none !important; \}/);
});

test('markets side by side (19 Nov 2026): 2 to 4 charts, each its own market and timeframe, display only', () => {
  assert.match(PAGE, /<button type="button" data-view="multi" id="ms-mm-btn"/);
  const blk = PAGE.slice(PAGE.indexOf('  // ─── Markets side by side'), PAGE.indexOf('  window.msOneTf = (t) =>'));
  assert.ok(blk.length > 3000);
  assert.match(blk, /MM\.n = \[2, 3, 4\]\.includes\(\+j\.n\) \? \+j\.n : 3;/, 'a stored count outside 2-4 is not taken');
  assert.match(blk, /if \(c && INSTRUMENTS\[c\.k\] && SPTFS\.some\(\(t\) => t\.id === c\.tf\)\)/, 'a stored market or timeframe that does not exist is not taken');
  assert.match(blk, /window\.msCharts\.add\(\{ id: 'mm' \+ i/, 'the drawing tools work on every chart');
  assert.doesNotMatch(blk, /\.stop\s*=|S\.acct|place\(/, 'display only');
  assert.match(PAGE, /if \(window\.msMultiView\) setTimeout\(\(\) => window\.msMultiView\(v === 'multi'\), 0\);/);
  assert.match(PAGE, /\['multi', 'Markets side by side'\]/, 'the chart header menu offers it (the phone has no toolbar row)');
});

test('free charts on a low timeframe keep up (19 Nov 2026): reads every 1.5-3 s, the page market moves with every live tick', () => {
  assert.match(PAGE, /const freePoll = \(T\) => \(!T \? 15e3 : T\.sec <= 60 \? 1000 : T\.sec <= 900 \? 2000 : T\.sec <= 3600 \? 5000 : 15e3\);/);
  assert.match(PAGE, /if \(window\.msTickSubs\) window\.msTickSubs\.forEach\(\(f\) => \{ try \{ f\(Q\); \} catch \(e\) \{\} \}\);/);
  const ti = /const tickInto = [\s\S]*?return ch; \};/.exec(PAGE)[0];
  const f = new Function('TZ', `${ti}; return tickInto;`)(0);
  const bars = [{ time: 120, open: 10, high: 11, low: 9, close: 10 }], up = [], series = { update: (x) => up.push(x) };
  assert.equal(f(bars, series, 60, 0, [{ px: 12, t: 150 }, { px: 8, t: 170 }, { px: 9, t: 185 }], null), true);
  assert.deepEqual(bars, [{ time: 120, open: 10, high: 12, low: 8, close: 8 }, { time: 180, open: 9, high: 9, low: 9, close: 9 }]);
  assert.equal(f(bars, series, 2678400, 0, [{ px: 1, t: 200 }], null), false, 'a month or a year is never bucketed from ticks');
  assert.match(PAGE, /now - SP_POLL < \(tickLive\(k\) \? \(T && T\.id === '1s' \? Infinity : 15e3\) : freePoll\(T\)\) - 300/, 'with live ticks the read only completes candles');
  assert.match(PAGE, /new EventSource\(`\$\{MD\.base\}stream\?sym=\$\{I\.md\}`\); f\.es = es;/, 'a stream per other market a free chart shows');
  assert.match(PAGE, /for \(const k of \[\.\.\.want\]\.slice\(0, 4\)\)/, 'at most four');
  assert.match(PAGE, /if \(tf && tf\.id === '1s'\) \{ const r = await fetchBars\(SPTFS\.find\(\(t\) => t\.id === '5s'\), I, n\);/, 'one second starts from 5 s candles');
});

test('Split without its own bar (19 Nov 2026): Sync in the toolbar, each chart\'s header picks its timeframe, the right one its market', () => {
  assert.match(PAGE, /#ms-sp-bar \{ display: none !important; \}/);
  assert.match(PAGE, /const sx = document\.querySelector\('#ms-sp-bar \.sp-sync'\), seg = document\.querySelector\('#v-charts \.sec-h > \.seg\[aria-label="Chart view"\]'\); if \(sx && seg\) \{ sx\.hidden = true; seg\.after\(sx\); \}/);
  assert.match(PAGE, /const spMarkRight = \(\) =>/, 'the right chart is marked, the free chart or an analysed pane');
  assert.match(PAGE, /else if \(v === 'split' && an\) \{ const lt = document\.getElementById\('ms-sp-ltf'\);/, 'the left chart takes an analysed timeframe');
  assert.match(PAGE, /else if \(b\.dataset\.phMk\) \{ const sy = document\.querySelector\('\[data-sync="sym"\]'\)/, 'the right chart picks its market');
  assert.match(PAGE, /if \(pn\.classList\.contains\('sp-right'\) && viewNow\(\) === 'split'\) openMk\(pn, m\); else openMarket\(\);/);
});

test('drawing rail on the left and a floating favourites bar (19 Nov 2026)', () => {
  const i = PAGE.indexOf('// ─── Drawing rail on the left and a floating favourites bar'), blk = PAGE.slice(i, PAGE.indexOf('window.msRailFav = toggleFav;', i));
  assert.ok(i > 0, 'the rail block is in the page');
  assert.match(blk, /const wide = window\.matchMedia\('\(min-width: 641px\)'\);/, 'wider than 640 px only: a phone keeps "Draw"');
  assert.match(blk, /rail\.prepend\(DB\); DB\.after\(CO\);/, 'the drawing tools and the chart tools move into the rail');
  assert.match(blk, /ph\.db\.after\(DB\); ph\.co\.after\(CO\);/, 'and back to the toolbar on a phone');
  assert.match(blk, /const FK = 'ms-dr-fav'/, 'favourites are kept on this device');
  assert.match(blk, /const b = btnOf\(f\.dataset\.fk\); if \(b\) \{ b\.click\(\);/, 'a favourite presses the rail\'s own button: no tool works differently');
  assert.match(blk, /rail\.addEventListener\('click', \(e\) => \{ const s = e\.target\.closest && e\.target\.closest\('\.rl-star'\); if \(!s\) return; e\.preventDefault\(\); e\.stopPropagation\(\);/, 'the star does not press the tool');
  assert.match(blk, /rail\.addEventListener\('contextmenu'/, 'right-click or long press adds a favourite');
  assert.doesNotMatch(blk, /fetch\(|\.stop = /, 'display only');
  // the star refresh must not set an attribute it watches to the same value (that looped and froze the page once)
  assert.match(blk, /if \(favBtn\.getAttribute\('aria-pressed'\) !== pr\) favBtn\.setAttribute\('aria-pressed', pr\);/);
  const css = PAGE.slice(PAGE.indexOf('<style id="ms-rail-css">'), PAGE.indexOf('</style>', PAGE.indexOf('<style id="ms-rail-css">')));
  assert.match(css, /\.ms-fav \{ position: fixed;/, 'the favourites bar floats');
  assert.match(css, /@media \(pointer: coarse\)[^\n]*44px/, '44 px on touch');
  assert.match(PAGE, /#v-charts:fullscreen > :not\(\.sec-h\):not\(\.ch-row\)/, 'full screen keeps the rail and the charts');
  const G = fs.readFileSync('assets/ms-charts-guide.js', 'utf8');
  assert.match(G, /const bar = document\.querySelector\('#v-charts \.sec-h'\);/, 'the guide button stays in the toolbar, not in the rail');
  assert.match(G, /<b>Favourites<\/b>/, 'the guide explains the favourites');
});

test('Fibonacci retracement, arrow and text are drawing shapes (19 Nov 2026)', () => {
  const B = require('../assets/backtest-engine.js');
  const n = B.drawNorm([{ type: 'f', t1: 1, p1: 10, t2: 2, p2: 20, ext: true }, { type: 'x', t1: 1, p1: 5, text: ' two\nwords ' }, { type: 'x', t1: 1, p1: 5, text: '   ' }, { type: 'a', t1: 1, p1: 1, t2: 2, p2: 2 }]);
  assert.deepEqual(n.map((d) => d.type), ['f', 'x', 'a'], 'a text with no words is dropped');
  assert.equal(n[1].text, 'two words'); assert.equal(n[0].ext, true);
  assert.equal(B.drawNorm([{ type: 'x', t1: 1, p1: 1, text: 'y'.repeat(300) }])[0].text.length, 120);
  const g = B.drawGeom(n[0], (t) => t * 100, (p) => 200 - p * 5, 800, 400);
  assert.deepEqual(g.lv.map(([r]) => r), B.FIB_LEVELS); assert.equal(g.lv[0][1], 100, 'level 0 at the second point'); assert.equal(g.lv[6][1], 150, 'level 1 at the first point');
  assert.equal(g.fx2, 800, 'extended to the right'); assert.equal(B.drawHit(g, 400, 125), 'body', 'the 0.5 level is hit');
  assert.equal(B.drawResize(n[0], 'b', 3, 30).p2, 30); assert.equal(B.drawResize(n[1], 'a', 4, 40).text, 'two words', 'moving a text keeps its words');
  const gx = B.drawGeom(n[1], (t) => t * 100, (p) => 200 - p * 5, 800, 400); assert.equal(B.drawHit(gx, gx.x1 + 10, gx.y1 - 5), 'body');
  assert.match(SRC, /f: 'Fibonacci retracement \(Alt\+F\)', a: 'Arrow \(Alt\+A\)', x: 'Text \(Alt\+X\)'/);
  assert.match(SRC, /KeyF: 'f', KeyA: 'a', KeyX: 'x'/);
  assert.match(SRC, /data-txt title="Change the words">Edit text</);
  assert.doesNotMatch(PAGE, /const TOOLS = \['\.ch-pos', '\.ch-fib'/, 'the old Fibonacci button leaves the rail: the drawing tool replaces it');
});

test('channel, range, anchored VWAP, measured move and ATR band; 18 more indicators in groups (19 Nov 2026)', () => {
  const B = require('../assets/backtest-engine.js'), X = (t) => t * 100, Y = (p) => 200 - p * 5;
  const n = B.drawNorm([{ type: 'c', t1: 1, p1: 10, t2: 3, p2: 20, off: -4 }, { type: 'm', t1: 1, p1: 10, t2: 2, p2: 12 }, { type: 'w', t1: 1, p1: 5 }, { type: 'p', t1: 1, p1: 10, t2: 2, p2: 15 }, { type: 'b', price: 10, hw: 2 }, { type: 'b', price: 10, hw: 0 }]);
  assert.deepEqual(n.map((d) => d.type), ['c', 'm', 'w', 'p', 'b'], 'an ATR band with no width is dropped');
  const g = B.drawGeom(n[0], X, Y, 800, 400); assert.equal(B.drawHit(g, 200, Y(13)), 'body', 'inside the channel'); assert.equal(B.drawHit(g, 200, Y(17)), null);
  assert.equal(B.drawResize(n[0], 'o', 2, 10).off, -5, 'the middle handle sets the width');
  assert.deepEqual(B.measuredMove(n[3]), { t: 3, one: 20, ext: 15 + 5 * 1.618 });
  assert.equal(B.drawHit(B.drawGeom(n[2], X, Y, 800, 400), 300, 300), null, 'anchored VWAP: only its handle is hit');
  assert.match(SRC, /KeyC: 'c', KeyG: 'm', KeyW: 'w', KeyP: 'p', KeyB: 'b'/);
  const a = PAGE.indexOf('  const iSMA = '), b = PAGE.indexOf('  const IND_COLORS');
  const lib = new Function('TZ', PAGE.slice(a, b) + '\nreturn { IND_DEF, IND_GROUP, IND_GROUPS };')(0);
  let p = 100; const bars = []; for (let i = 0; i < 400; i++) { const o = p; p += Math.sin(i / 9) * 1.3 + (i % 7 - 3) * 0.2; bars.push({ time: 1.79e9 + i * 3600, open: o, high: Math.max(o, p) + 0.6, low: Math.min(o, p) - 0.6, close: p, volume: 100 + (i % 13) * 10 }); }
  for (const k of ['hma', 'kama', 'ichi', 'chand', 'pivots', 'adx', 'willr', 'stochrsi', 'ao', 'aroon', 'fisher', 'chop', 'sqz', 'zscore', 'rexp', 'obv', 'mfi', 'cmf']) {
    const d = lib.IND_DEF[k]; assert.ok(d, k); assert.ok(lib.IND_GROUPS.includes(lib.IND_GROUP[k]), `${k} has a group`);
    const r = d.calc(bars, { ...d.p }); assert.ok(r.length, k); for (const s of r) assert.ok(s.v.every((v) => v == null || Number.isFinite(v)), `${k} finite`);
    assert.ok(r.some((s) => s.v[s.v.length - 1] != null), `${k} has a value on the last candle`); }
  for (const k of Object.keys(lib.IND_DEF)) assert.ok(lib.IND_GROUP[k], `${k} is in a group`);
  const rsi = lib.IND_DEF.willr.calc(bars, { len: 14 })[0].v; assert.ok(rsi.every((v) => v == null || (v <= 0 && v >= -100)), 'Williams %R stays in 0..-100');
  assert.match(PAGE, /id="ms-ind-q" placeholder="Search indicators/);
});
