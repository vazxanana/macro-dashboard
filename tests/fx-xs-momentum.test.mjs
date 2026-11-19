// Forex cross-sectional momentum study: inversion of USD-base pairs, ranking on past data only, the stop with a gap fill,
// costs, and the report against result.json. Offline.
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { invertBar, expressed, rank, atr, simLeg, costFrac, legResult, holm, percentile, mulberry32, randomPick, stats, P, PAIRS } from '../research/edge/fx-xs-momentum/run.mjs';

const bar = (time, open, high, low, close) => ({ time, open, high, low, close });

test('a USD-base pair is inverted candle by candle: high from the low, low from the high', () => {
  const b = invertBar(bar(1, 150, 160, 125, 140));
  assert.equal(b.open, 1 / 150); assert.equal(b.close, 1 / 140);
  assert.equal(b.high, 1 / 125); assert.equal(b.low, 1 / 160);
  assert.ok(b.high >= Math.max(b.open, b.close) && b.low <= Math.min(b.open, b.close));
  assert.deepEqual(expressed([bar(1, 1.1, 1.2, 1, 1.15)], false), [bar(1, 1.1, 1.2, 1, 1.15)]);
  assert.deepEqual(PAIRS.filter((p) => p.inv).map((p) => p.key), ['usdcad', 'usdchf', 'usdjpy']);
  // USD/JPY rising = JPY falling against USD
  const x = expressed([bar(0, 100, 100, 100, 100), bar(1, 110, 110, 110, 110)], true);
  assert.ok(x[1].close < x[0].close);
});

test('ranking reads closes up to and including the signal day only', () => {
  const mk = (f) => [...Array(30)].map((_, i) => bar(i, f(i), f(i), f(i), f(i)));
  const X = { A: mk((i) => 100 + i), B: mk((i) => 100 - i * 0.5), C: mk(() => 100) };
  assert.deepEqual(rank(X, ['A', 'B', 'C'], 20, 10), ['A', 'C', 'B']);
  const Y = { A: X.A.map((b, i) => (i > 20 ? bar(i, 1, 1, 1, 1) : b)), B: X.B.map((b, i) => (i > 20 ? bar(i, 999, 999, 999, 999) : b)), C: X.C };
  assert.deepEqual(rank(Y, ['A', 'B', 'C'], 20, 10), rank(X, ['A', 'B', 'C'], 20, 10));
  assert.equal(rank(X, ['A', 'B', 'C'], 5, 10), null, 'too little history');
  // ties: list order
  assert.deepEqual(rank({ A: X.C, B: X.C, C: X.C }, ['A', 'B', 'C'], 20, 10), ['A', 'B', 'C']);
  // ATR ignores later candles
  const Z = X.A.map((b, i) => (i > 20 ? bar(i, 100, 500, 1, 100) : b));
  assert.equal(atr(Z, 20), atr(X.A, 20));
});

test('stop: touched inside a candle fills at the stop, an open beyond it fills at the open, else the month-end close', () => {
  const bars = [bar(0, 100, 101, 99, 100), bar(1, 100, 101, 95, 96), bar(2, 92, 93, 90, 91)];
  assert.deepEqual(simLeg(bars, 0, 2, 1, 4), { entry: 100, stop: 96, exit: 96, exitIdx: 1, how: 'stop' });
  const gap = [bar(0, 100, 101, 99, 100), bar(1, 94, 95, 93, 94)];
  assert.deepEqual(simLeg(gap, 0, 1, 1, 4), { entry: 100, stop: 96, exit: 94, exitIdx: 1, how: 'gap' });
  const shortGap = [bar(0, 100, 101, 99, 100), bar(1, 106, 107, 105, 106)];
  assert.equal(simLeg(shortGap, 0, 1, -1, 4).exit, 106);
  const held = [bar(0, 100, 101, 99, 100), bar(1, 100, 103, 99, 102)];
  assert.deepEqual(simLeg(held, 0, 1, 1, 4), { entry: 100, stop: 96, exit: 102, exitIdx: 1, how: 'close' });
  // the entry candle itself can stop the leg (entry at its open)
  assert.equal(simLeg([bar(0, 100, 100, 90, 92)], 0, 0, 1, 4).how, 'stop');
});

test('costs: 0.3 pip spread + 1 pip slippage + 45 per million a round trip; financing 0.004 % a night on every leg', () => {
  assert.ok(Math.abs(costFrac(1, 0.0001) - (1.3e-4 + 4.5e-5)) < 1e-15);
  assert.ok(Math.abs(costFrac(150, 0.01) - (0.013 / 150 + 4.5e-5)) < 1e-15);
  const t0 = Date.UTC(2026, 9, 5) / 1000; // Monday
  const bars = [0, 1, 2].map((i) => bar(t0 + i * 86400, 1, 1.01, 0.995, 1));
  const D = { X: { EUR: bars }, Q: { EUR: bars } };
  const L = legResult(D.X, D.Q, PAIRS[0], 0, 2, 1, 0.02, bars.map((b) => b.time));
  assert.equal(L.gross, 0);
  assert.ok(Math.abs(L.costR - costFrac(1, 0.0001) / 0.02) < 1e-12);
  assert.equal(L.nights, 5); // Monday 1 + Tuesday 1 + Wednesday 3 (exit at Wednesday's close, after its 22:00 rollover)
  assert.ok(Math.abs(L.finR - (L.nights * P.FIN_NIGHT) / 0.02) < 1e-12);
  assert.ok(Math.abs(L.net - (-L.costR - L.finR)) < 1e-12);
  const S = legResult({ EUR: bars }, { EUR: bars }, PAIRS[0], 0, 2, -1, 0.02, bars.map((b) => b.time));
  assert.equal(S.finR, L.finR, 'a sell pays the same flat charge');
});

test('Holm, percentile, seeded placebo', () => {
  assert.deepEqual(holm([0.01, 0.04]), [0.02, 0.04]);
  assert.deepEqual(holm([0.04, 0.01]), [0.04, 0.02]);
  assert.equal(percentile([1, 2, 3, 4, 5], 0.5), 3); assert.equal(percentile([0, 10], 0.95), 9.5);
  const a = randomPick(mulberry32(7))(), b = randomPick(mulberry32(7))();
  assert.deepEqual(a, b); assert.equal(new Set([...a.long, ...a.short]).size, 4);
  const s = stats([1, -1, 2, 0]); assert.equal(s.n, 4); assert.equal(s.total, 2); assert.equal(s.dd, -1);
});

test('the report says what result.json holds, and FAIL', () => {
  const r = JSON.parse(fs.readFileSync(new URL('../research/edge/fx-xs-momentum/result.json', import.meta.url)));
  const md = fs.readFileSync(new URL('../research/edge/fx-xs-momentum/RESULT.md', import.meta.url), 'utf8');
  assert.equal(r.verdict, 'FAIL'); assert.match(md, /^\*\*Verdict: FAIL\*\*/m);
  const sg = (v, k) => (v < 0 ? '−' : v > 0 ? '+' : '') + Math.abs(v).toFixed(k);
  const tt = (v) => (v < 0 ? '−' : '') + String(Math.abs(v));
  for (const n of ['63', '21']) {
    const L = r.lookbacks[n];
    assert.equal(L.pass, false);
    for (const [w, name] of [['decisive', 'decisive 2016-01 to 2026-10'], ['replication', 'replication 2008-01 to 2015-12']]) {
      const s = L[w].net;
      const row = `| ${n}-day, ${name} | ${s.n} | ${sg(s.mean, 3)} | ${sg(s.total, 2).replace(/0$/, '').replace(/\.$/, '')}R | ${tt(s.t)} | ${tt(s.sharpe)} | ${tt(s.dd)}R |`;
      assert.ok(md.includes(row), `row ${n} ${w}: ${row}`);
    }
  }
  const p = r.placebo.t;
  assert.match(md, new RegExp(`5th\\s+percentile ${tt(p.p5)}, median ${tt(p.p50)}, 95th percentile ${tt(p.p95)}`));
  assert.ok(/carry is not in this test/i.test(md), 'the carry limitation is named');
  assert.ok(!/live change|now live/i.test(md.replace(/nothing\s+live changed/i, '')), 'no live change claimed');
});
