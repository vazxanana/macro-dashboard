// Live candles with no delay (19 Nov 2026, owner: "the candles need to be more live moving with no delay"): one tick engine
// for every feed, a faster OANDA stream, a refresh that never pulls the candle back, bid / ask lines, paper orders from the chart.
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
const PAGE = fs.readFileSync('market-structure.html', 'utf8'), STREAM = fs.readFileSync('api/stream.js', 'utf8');
const DRAW = fs.readFileSync('assets/ms-draw.js', 'utf8'), PAPER = fs.readFileSync('assets/ms-paper.js', 'utf8');

test('the OANDA stream forwards every quote at once (25 ms apart at most), names its heartbeat and asks to reconnect within 0.3 s', () => {
  assert.match(STREAM, /const GAP_MS = 25;/); assert.match(STREAM, /const wait = GAP_MS - \(Date\.now\(\) - last\);/);
  assert.match(STREAM, /res\.write\('event: hb\\ndata: 1\\n\\n'\);/, 'a heartbeat the page can hear');
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
  assert.match(PAGE, /const same = r\.src === G\.source, nx = same \? mergeBars\(P\.raw, r\.bars\) : r\.bars; liveKeep\(P, nx\);/);   // 27 Nov 2026: kept on the refreshed list before it is compared
  const src = /function liveKeep\(P, arr\) \{[\s\S]*?\n {2}\}/.exec(PAGE)[0];
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
  assert.match(PAGE, /G\.smooth = localStorage\.getItem\('ms-smooth'\) === '1'; G\.bidAsk = localStorage\.getItem\('ms-bidask'\) === '1';/);
});

test('paper orders from the right-click menu: the price under the pointer, the current market, never for guests', () => {
  assert.match(DRAW, /data-m="pbuy">Paper buy at \$\{t\}<\/button><button type="button" role="menuitem" data-m="psell">Paper sell at \$\{t\}/);
  assert.match(DRAW, /window\.msPaperMarket\(\) !== mk\) return '';/);
  assert.match(PAPER, /root\.msPaperDraftAt = \(side, price\) => \{ if \(document\.documentElement\.dataset\.role === 'public'/);
  assert.match(PAPER, /draft\(side\); if \(!D\) return false; D\.at = /);
});

// 26 Nov 2026, owner: "I want the candles faster, no delays"
test('no delay: instant by default, the stream opened beside the candle reads, handed over before it ends, replaced when silent', () => {
  const src = /function startTicks\(pre\) \{[\s\S]*?\n {2}\}/.exec(PAGE)[0];
  let now = 1e6; const made = [], ticks = [], iv = [];
  class ES { constructor(u) { this.u = u; this.readyState = 1; this.l = {}; made.push(this); } addEventListener(k, f) { this.l[k] = f; } close() { this.readyState = 2; this.closed = true; } }
  const G = {}, env = { G, MD: { base: '/md/' }, INST: { md: 'xau' }, EventSource: ES, marketClosed: () => false, liveTick: (px) => ticks.push(px), setStatus() {}, $: () => null,
    document: { hidden: false }, Date: { now: () => now }, setInterval: (f) => { iv.push(f); return iv.length; }, clearInterval: (i) => { iv[i - 1] = null; }, setTimeout: () => 0, isFinite, JSON,
    STREAM_QUIET: 12e3, STREAM_LIFE: 240e3, streamUrl: () => '/md/stream?sym=xau' };
  const start = Function(...Object.keys(env), `${src}; return startTicks;`)(...Object.values(env));
  const beat = () => iv.forEach((f) => f && f());
  const q = (p) => ({ data: JSON.stringify({ t: 1, b: p, a: p }) });
  const pre = new ES('early'); start(pre); assert.equal(G.es, pre, 'the stream boot opened early is the one used'); assert.equal(made.length, 1);
  pre.onmessage(q(100)); assert.deepEqual(ticks, [100]);
  // heartbeats keep a quiet market's stream: 30 s with no price and it is not replaced
  for (let i = 0; i < 30; i++) { now += 1000; if (i % 5 === 0) pre.l.hb(); beat(); } assert.equal(G.es, pre); assert.equal(made.length, 1);
  // STREAM_LIFE in: a second stream is opened, the first keeps going until the second has a price
  now += 240e3; pre.l.hb(); beat(); assert.equal(made.length, 2); assert.equal(G.es, pre); assert.ok(!pre.closed);
  pre.onmessage(q(101)); made[1].onmessage(q(102)); assert.equal(G.es, made[1]); assert.ok(pre.closed); assert.deepEqual(ticks, [100, 101, 102], 'no price lost or doubled at the hand-over');
  // nothing heard for 12 s (no price, no heartbeat): replaced at once
  now += 13e3; beat(); assert.equal(made.length, 3); assert.ok(made[1].closed); assert.equal(G.es, made[2]);
  assert.match(PAGE, /const STREAM_QUIET = 12e3, STREAM_LIFE = 240e3, STREAM_AWAY = 8e3;/);
  assert.match(PAGE, /early = new EventSource\(`\$\{MD\.base\}stream\?sym=\$\{INST\.md\}`\); early\.onmessage = \(m\) => \{ earlyQ = m; \};/);
  assert.match(PAGE, /startTicks\(early\); if \(early && earlyQ && early\.onmessage\) early\.onmessage\(earlyQ\);/);
  assert.match(PAGE, /if \(gone < STREAM_AWAY \|\| !G\.es \|\| !G\.booted \|\| G\.source !== 'OANDA' \|\| marketClosed\(\)\) return;\s*if \(G\.esRenew\) G\.esRenew\(\);/, 'back from another app: a fresh stream at once');
  assert.match(PAGE, /es\.addEventListener\('hb', \(\) => \{ f\.heard = Date\.now\(\); \}\);/, 'the other markets\' streams hear it too');
});
