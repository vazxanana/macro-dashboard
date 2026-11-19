// Live candles with no delay (19 Nov 2026, owner: "the candles need to be more live moving with no delay"): one tick engine
// for every feed, a faster OANDA stream, a refresh that never pulls the candle back, bid / ask lines, paper orders from the chart.
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
const PAGE = fs.readFileSync('market-structure.html', 'utf8'), STREAM = fs.readFileSync('api/stream.js', 'utf8');
const DRAW = fs.readFileSync('assets/ms-draw.js', 'utf8'), PAPER = fs.readFileSync('assets/ms-paper.js', 'utf8');

test('the OANDA stream sends up to ten updates a second and asks the browser to reconnect within 0.3 s', () => {
  assert.match(STREAM, /const wait = 100 - \(Date\.now\(\) - last\);/);
  assert.match(STREAM, /res\.write\('retry: 300\\n\\n'\);/);
});

test('every feed goes through one tick engine, applied on the next frame', () => {
  assert.match(PAGE, /G\.quote = d; liveTick\(\(d\.b \+ d\.a\) \/ 2, d\.t \|\| Date\.now\(\) \/ 1000, d\);/);
  assert.match(PAGE, /if \(d\.e === 'aggTrade'\) \{ const p = \+d\.p; if \(isFinite\(p\) && p > 0\) liveTick\(p,/);
  assert.match(PAGE, /\.concat\(`\$\{INST\.binance\.toLowerCase\(\)\}@aggTrade`\)/);
  assert.match(PAGE, /liveTick\(px, Date\.now\(\) \/ 1000\);\n[^\n]*\n {6}setTimeout\(loop, fails \? 8000 : 1000\);/);
  assert.match(PAGE, /LT\.raf = document\.hidden \? setTimeout\(liveFrame, 200\) : requestAnimationFrame\(liveFrame\);/);
  // a frame keeps the high and low of every tick it applies
  assert.match(PAGE, /cur = \{ time: bt, open: base\.open, high: Math\.max\(base\.high, k\.px\), low: Math\.min\(base\.low, k\.px\), close: k\.px, volume: base\.volume \};/);
});

test('a candle refresh older than the last tick keeps the tick (no jump back)', () => {
  assert.match(PAGE, /P\.raw = r\.src === G\.source \? mergeBars\(P\.raw, r\.bars\) : r\.bars; liveKeep\(P\); P\.rebuild\(true\);/);
  const src = /function liveKeep\(P\) \{[\s\S]*?\n {2}\}/.exec(PAGE)[0];
  const LT = { px: 4010, t: 1000 * 60 + 30 }, keep = Function('LT', `${src}; return liveKeep;`)(LT);
  const P = { tf: { sec: 60 }, raw: [{ time: 1000 * 60, open: 4000, high: 4005, low: 3999, close: 4001 }] };
  keep(P); assert.deepEqual(P.raw[0], { time: 60000, open: 4000, high: 4010, low: 3999, close: 4010 });
  const Q = { tf: { sec: 60 }, raw: [{ time: 1001 * 60, open: 4000, high: 4005, low: 3999, close: 4001 }] };
  keep(Q); assert.equal(Q.raw[0].close, 4001, 'another candle is left alone');
});

test('smooth motion is display only; options in Style; the age of the last price beside Live', () => {
  const ease = /function liveEase\(\) \{[\s\S]*?\n {2}\}/.exec(PAGE)[0];
  assert.match(ease, /P\.series\.update\(/); assert.doesNotMatch(ease, /P\.raw|P\.bars\[[^\]]+\] =|P\.push|analyze/);
  for (const id of ['ms-sty-smooth', 'ms-sty-bidask', 'ms-live-lag']) assert.match(PAGE, new RegExp(`id="${id}"`));
  assert.match(PAGE, /G\.smooth = localStorage\.getItem\('ms-smooth'\) !== '0'; G\.bidAsk = localStorage\.getItem\('ms-bidask'\) === '1';/);
});

test('paper orders from the right-click menu: the price under the pointer, the current market, never for guests', () => {
  assert.match(DRAW, /data-m="pbuy">Paper buy at \$\{t\}<\/button><button type="button" role="menuitem" data-m="psell">Paper sell at \$\{t\}/);
  assert.match(DRAW, /window\.msPaperMarket\(\) !== mk\) return '';/);
  assert.match(PAPER, /root\.msPaperDraftAt = \(side, price\) => \{ if \(document\.documentElement\.dataset\.role === 'public'/);
  assert.match(PAPER, /draft\(side\); if \(!D\) return false; D\.at = /);
});
