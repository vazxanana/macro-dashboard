// The paper trading account on the Desk's Charts (18 Nov 2026, assets/ms-paper.js): ChronosTrade's engine on the live
// one-minute candles, a stop on every order, stats from the engine, practice only.
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { createRequire } from 'node:module';
const require = createRequire(import.meta.url);
globalThis.BT = require('../assets/backtest-engine.js');
const PP = require('../assets/ms-paper.js');
const SRC = fs.readFileSync('assets/ms-paper.js', 'utf8'), PAGE = fs.readFileSync('market-structure.html', 'utf8');
const bar = (time, open, high, low, close) => ({ time, open, high, low, close });

test('every order needs a stop on its losing side, and a target on its winning side', () => {
  const s = PP.fresh();
  assert.throws(() => PP.order(s, 'xau', { side: 'buy', price: 4000, stop: null }, 600), /needs a stop/);
  assert.throws(() => PP.order(s, 'xau', { side: 'buy', price: 4000, stop: 4010 }, 600), /below the entry/);
  assert.throws(() => PP.order(s, 'xau', { side: 'sell', price: 4000, stop: 4010, target: 4005 }, 600), /below the entry/);
  const p = PP.order(s, 'xau', { side: 'sell', price: 4000, stop: 4010, target: 3980 }, 630);
  assert.equal(p.units, 10, '1 % of $10,000 over a $10 stop'); assert.equal(p.chk, 600, 'checked from the candle after the one it was placed in');
});

test('positions are checked only on closed candles that started after they were placed, each once', () => {
  const s = PP.fresh(); PP.order(s, 'xau', { side: 'buy', price: 4000, stop: 3990, target: 4020 }, 630);
  // the candle it was placed in reached the stop before the order: never counted; the forming candle is not read yet
  assert.equal(PP.process(s.acct, 'xau', [bar(600, 3995, 4001, 3985, 4000), bar(660, 4000, 4030, 3999, 4025)], 700).length, 0);
  const ev = PP.process(s.acct, 'xau', [bar(600, 3995, 4001, 3985, 4000), bar(660, 4000, 4030, 3999, 4025)], 720);
  assert.deepEqual(ev.map((e) => e.kind), ['close']); assert.equal(s.acct.balance, 10200); assert.equal(ev[0].trade.mk, 'xau');
  assert.equal(PP.process(s.acct, 'xau', [bar(660, 4000, 4030, 3999, 4025)], 720).length, 0, 'never twice');
});

test('a stop and a target in one candle: the stop (ChronosTrade worst case); another market is untouched', () => {
  const s = PP.fresh(); PP.order(s, 'xau', { side: 'buy', price: 4000, stop: 3990, target: 4020 }, 630); PP.order(s, 'eurusd', { side: 'sell', price: 1.1, stop: 1.101 }, 630);
  PP.process(s.acct, 'xau', [bar(660, 4000, 4025, 3985, 4000)], 800);
  assert.equal(s.acct.balance, 9900); assert.equal(s.acct.positions.length, 1); assert.equal(s.acct.positions[0].mk, 'eurusd');
});

test('a resting limit fills when touched, then runs to its target', () => {
  const s = PP.fresh(); const o = PP.order(s, 'xau', { side: 'buy', price: 4000, stop: 3980, at: 3990, target: 4010 }, 630);
  assert.equal(o.type, 'limit'); assert.equal(s.acct.orders.length, 1);
  const ev = PP.process(s.acct, 'xau', [bar(660, 3999, 4000, 3988, 3995), bar(720, 3995, 4012, 3994, 4010)], 900);
  assert.deepEqual(ev.map((e) => e.kind), ['fill', 'close']); assert.equal(s.acct.balance, 10200, '2R on $100 of risk');
});

test('stats come from the engine; a stored account without stops is cleaned on load', () => {
  const s = PP.fresh(); PP.order(s, 'xau', { side: 'buy', price: 4000, stop: 3990, target: 4020 }, 630); PP.process(s.acct, 'xau', [bar(660, 4000, 4021, 3999, 4020)], 800);
  const st = PP.stats(s); assert.equal(st.n, 1); assert.equal(st.winRate, 1); assert.equal(st.avgR, 2);
  const bad = JSON.parse(JSON.stringify(s)); bad.acct.positions.push({ id: 9, mk: 'xau', side: 'buy', entry: 4000, stop: 4005, r0: 5 }); bad.risk = 7;
  const n = PP.norm(bad); assert.equal(n.acct.positions.length, 0); assert.equal(n.risk, 1);
  assert.equal(PP.sizeText({ size: 'fx' }, 250000, 1.1), '2.5 lot'); assert.equal(PP.sizeText({ size: 'gold' }, 10, 4000), '10 oz');
});

test('practice only: no network write, no council, no broker; wired on the Charts above the six panes, hidden for guests', () => {
  assert.doesNotMatch(SRC, /fetch\(|XMLHttpRequest|sendBeacon|COUNCIL|ctrader|\/api\//);
  assert.match(SRC, /'ms-paper-' \+ \(who\(\) \|\| 'me'\)/);
  assert.match(PAGE, /<script src="\/assets\/ms-draw\.js" defer><\/script>\n(?:<script src="\/assets\/ms-quick\.js" defer><\/script>\n)?<script src="\/assets\/ms-paper\.js" defer><\/script>/);
  assert.match(PAGE, /<section class="pp" id="ms-pp" aria-label="Paper trading account" hidden><\/section>\n {4}<div class="ms-grid4">/);
  assert.match(PAGE, /window\.msPaperHost = \{ key: instKey,/);
  const css = /<style id="ms-pp-css">([\s\S]*?)<\/style>/.exec(PAGE)[1];
  assert.match(css, /html\[data-role="public"\] #ms-pp, html\[data-role="public"\] #hs-pp/); assert.doesNotMatch(css, /data-phone/);
  for (const m of css.matchAll(/font(?:-size)?:\s*(?:\d+\s+)?([\d.]+)px/g)) assert.ok(+m[1] >= 12, m[0]);
});

test('order flow studies: estimated from candles and said so; the bars keep their volume', () => {
  for (const k of ['delta', 'cvd', 'vwap', 'vprof', 'rvol']) assert.match(PAGE, new RegExp(`\\n    ${k}: \\{ name: '[^']+', (osc: true, )?flow: true,`), k);
  assert.match(PAGE, /const iDelta = \(B\) => B\.map\(\(b\) => \{ const r = b\.high - b\.low, w = b\.volume > 0 \? b\.volume : 1; return r > 0 \? w \* \(2 \* \(b\.close - b\.low\) \/ r - 1\) : 0; \}\);/);
  assert.match(PAGE, /Order flow studies are estimated from candles: the feeds give a volume per candle, not the trades at the bid and the ask\./);
  assert.match(PAGE, /close: b\.close \+ off, volume: b\.volume \|\| 0 \}\)\);/);
  // the delta of one candle, lifted from the page
  const src = /const iDelta = [^\n]+/.exec(PAGE)[0], iDelta = Function(`${src}; return iDelta;`)();
  assert.deepEqual(iDelta([{ open: 1, high: 2, low: 0, close: 2, volume: 10 }, { open: 1, high: 2, low: 0, close: 1, volume: 10 }, { open: 1, high: 2, low: 0, close: 0, volume: 0 }]), [10, 0, -1]);
});

test('full screen takes the whole Charts view, so the layout, split and tools stay as they were', () => {
  assert.match(PAGE, /tl\.querySelector\('\.ch-fs'\)\.addEventListener\('click', \(\) => window\.msChartsFs && window\.msChartsFs\(\)\)/);
  assert.match(PAGE, /window\.msChartsFs = \(\) => \{\n\s+const vc = VC\(\);/, 'the whole Charts view (#v-charts) goes full screen');
  const css = /<style id="ms-cfs-css">([\s\S]*?)<\/style>/.exec(PAGE)[1];
  assert.match(css, /#v-charts:fullscreen(?:, #v-charts\.ch-fake-fs\))? \.ms-grid4 \{ flex: 1 1 0; min-height: 0; grid-auto-rows: minmax\(0, 1fr\);/);
  // 20 Nov 2026 (bug hunt): the floating parts are also MADE inside the full-screen element, the page's own full screen counts,
  // and each chart's timeframe menu and the toasts move too (tests/desk-bughunt.test.mjs)
  assert.match(fs.readFileSync('assets/ms-draw.js', 'utf8'), /const fsMove = \(\) => \{ const host = fsHost\(\); for \(const id of \['ms-dsel', 'ms-cmenu', 'ms-ph-menu', 'ms-toasts', 'ms-dlist'\]\)/);
});

test('volume profile: a histogram of the candles in view, split into buying and selling, with POC and a 70 % value area', async () => {
  const VP = require('../assets/ms-vprof.js');
  const bars = [{ high: 10, low: 0, close: 10, volume: 100 }, { high: 10, low: 5, close: 5, volume: 300 }, { high: 2, low: 0, close: 1, volume: 50 }];
  const P = VP.profile(bars, 10, 70);
  assert.equal(P.rows, 10); assert.ok(P.poc >= 5, 'the busiest rows are 5-10');
  const tot = P.tot.reduce((s, v) => s + v, 0); assert.ok(Math.abs(tot - 450) < 1e-9, 'every unit of volume placed once');
  const b0 = P.buy.reduce((s, v) => s + v, 0); assert.ok(Math.abs(b0 - (100 + 0 + 25)) < 1e-9, 'buying = volume times where the candle closed in its range');
  const va = P.tot.slice(P.vaLo, P.vaHi + 1).reduce((s, v) => s + v, 0); assert.ok(va >= 0.7 * tot);
  assert.equal(VP.profile([bars[0]]), null, 'too few candles');
  assert.match(PAGE, /vprof: \{ name: 'Volume Profile \(visible range\)', flow: true, p: \{ rows: 60, va: 70 \}, calc: \(\) => \[\] \}/);
  assert.match(PAGE, /<script src="\/assets\/ms-paper\.js" defer><\/script>\n<script src="\/assets\/ms-vprof\.js" defer><\/script>/);
  assert.doesNotMatch(fs.readFileSync('assets/ms-vprof.js', 'utf8'), /fetch\(|localStorage|XMLHttpRequest/);
});

test('closed paper trades are drawn on the charts of their market: entry to exit, coloured by result, with the R', () => {
  assert.match(SRC, /function marks\(\) \{/); assert.match(SRC, /root\.msChartX\(cx, t\.openedAt \+ cx\.TZ\)/);
  assert.match(fs.readFileSync('assets/ms-draw.js', 'utf8'), /window\.msChartX = \(cx, t\) => X\(cx, t\);/);
  assert.match(PAGE, /\.ms-vp-cv, \.ms-pp-cv \{ position: absolute; inset: 0; pointer-events: none; z-index: 2; \}/);
});

test('Home shows the paper account in one line once it has a trade (members with the charts only)', () => {
  assert.match(PAGE, /<p class="hs-fwd adm" id="hs-fwd" hidden><\/p><p class="hs-fwd hs-pp" id="hs-pp" hidden><\/p><\/header>/);
  assert.match(PAGE, /html\[data-role="public"\] #hs-pp, html\[data-deny~="charts"\] #hs-pp \{ display: none !important; \}/);
  assert.match(SRC, /function home\(\) \{[\s\S]*?if \(!T\.length && !n\) \{ el\.hidden = true; return; \}[\s\S]*?Your paper account: /);
});

test('the paper account is optional: off until switched on in the Profile, set before the first paint, no orders from the chart while off', () => {
  assert.match(PAGE, /localStorage\.getItem\('ms-pp-on'\) === '1'/);
  assert.ok(PAGE.indexOf("getItem('ms-pp-on')") < PAGE.indexOf('<body'), 'set in the head');
  assert.match(PAGE, /html:not\(\[data-pp-on\]\) #ms-pp, html:not\(\[data-pp-on\]\) #hs-pp \{ display: none !important; \}/);
  assert.match(PAGE, /id="ms-pf-pp" role="switch"/);
  assert.match(SRC, /root\.msPaperMarket = \(\) => \(H\(\) && on\(\)/);
  assert.match(SRC, /root\.msPaperDraftAt = \(side, price\) => \{ if \([^)]*!on\(\)/);
});
