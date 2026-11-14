// Forex value (five-year cross-sectional reversal) study: the signal on month-end closes only, the cheapest bought and the
// dearest sold, the stop, costs at 1x and 2x, Holm, and the report against result.json. Offline.
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { invertBar, valueSignal, rankValue, value, monthEnds, atr, simLeg, costFrac, legResult, runBook, holm, percentile, mulberry32, randomPick, stats, P, PAIRS, IS, OOS } from '../research/edge/fx-value/run.mjs';

const bar = (time, open, high, low, close) => ({ time, open, high, low, close });
const R = JSON.parse(fs.readFileSync(new URL('../research/edge/fx-value/result.json', import.meta.url)));
const MD = fs.readFileSync(new URL('../research/edge/fx-value/RESULT.md', import.meta.url), 'utf8');
const PRE = fs.readFileSync(new URL('../research/edge/fx-value/PREREGISTRATION.md', import.meta.url), 'utf8');

test('value signal = minus the 60-month return, from month-end closes up to and including the signal month', () => {
  // 70 "months", one candle each
  const mk = (f) => [...Array(70)].map((_, i) => bar(i, f(i), f(i), f(i), f(i)));
  const ends = [...Array(70)].map((_, i) => i);
  const X = { A: mk((i) => 100 + i), B: mk((i) => 200 - i), C: mk(() => 50) };
  assert.equal(valueSignal(X.A, ends, 59), null, 'needs 60 month-ends before');
  assert.ok(Math.abs(valueSignal(X.A, ends, 65) - -(165 / 105 - 1)) < 1e-12);
  // skip 12: return from ends[m-60] to ends[m-12]
  assert.ok(Math.abs(valueSignal(X.A, ends, 65, 12) - -(153 / 105 - 1)) < 1e-12);
  // B fell (cheapest), A rose (dearest)
  assert.deepEqual(rankValue(X, ['A', 'B', 'C'], ends, 65), ['B', 'C', 'A']);
  // later candles never change the ranking
  const Y = { A: X.A.map((b, i) => (i > 65 ? bar(i, 1, 1, 1, 1) : b)), B: X.B.map((b, i) => (i > 65 ? bar(i, 999, 999, 999, 999) : b)), C: X.C };
  assert.deepEqual(rankValue(Y, ['A', 'B', 'C'], ends, 65), rankValue(X, ['A', 'B', 'C'], ends, 65));
  // ties: list order; pick = 2 cheapest long, 2 dearest short
  assert.deepEqual(rankValue({ A: X.C, B: X.C, C: X.C }, ['A', 'B', 'C'], ends, 65), ['A', 'B', 'C']);
  assert.deepEqual(value(['a', 'b', 'c', 'd', 'e', 'f', 'g']), { long: ['a', 'b'], short: ['f', 'g'] });
  assert.ok(Math.abs(invertBar(bar(0, 150, 160, 125, 140)).high - 1 / 125) < 1e-15);
});

test('month-ends and the book: one entry at the next open, exit at the next month-end, four legs each with a stop', () => {
  const t0 = Date.UTC(2000, 0, 3) / 1000;
  const times = [...Array(400 * 31)].map((_, i) => t0 + i * 86400).filter((t) => { const d = new Date(t * 1000).getUTCDay(); return d > 0 && d < 6; });
  const ends = monthEnds(times);
  assert.ok(ends.every((i, k) => k === ends.length - 1 || new Date(times[i + 1] * 1000).getUTCMonth() !== new Date(times[i] * 1000).getUTCMonth()));
  // seven series with distinct drifts, small noise range
  const drift = { EUR: 1.0004, GBP: 1.0002, AUD: 1.0001, NZD: 1, CAD: 0.9999, CHF: 0.9998, JPY: 0.9996 };
  const X = {}, Q = {};
  for (const p of PAIRS) { let c = 1; X[p.ccy] = times.map((t) => { const o = c; c *= drift[p.ccy]; return bar(t, o, Math.max(o, c) * 1.002, Math.min(o, c) * 0.998, c); }); Q[p.ccy] = X[p.ccy]; }
  const ms = runBook({ times, X, Q }, 0, value);
  assert.ok(ms.length > 0);
  for (const m of ms) {
    assert.deepEqual(m.long, ['JPY', 'CHF'], 'fell most = cheapest = bought');
    assert.deepEqual(m.short, ['GBP', 'EUR']);
    assert.equal(m.legs.length, 4);
    assert.ok(m.net2x < m.net && m.net < m.gross);
  }
});

test('stop: inside a candle at the stop, an open beyond it at the open, else the month-end close', () => {
  assert.deepEqual(simLeg([bar(0, 100, 101, 99, 100), bar(1, 100, 101, 95, 96)], 0, 1, 1, 4), { entry: 100, stop: 96, exit: 96, exitIdx: 1, how: 'stop' });
  assert.deepEqual(simLeg([bar(0, 100, 101, 99, 100), bar(1, 94, 95, 93, 94)], 0, 1, 1, 4), { entry: 100, stop: 96, exit: 94, exitIdx: 1, how: 'gap' });
  assert.equal(simLeg([bar(0, 100, 101, 99, 100), bar(1, 106, 107, 105, 106)], 0, 1, -1, 4).exit, 106);
  assert.equal(simLeg([bar(0, 100, 101, 99, 100), bar(1, 100, 103, 99, 102)], 0, 1, 1, 4).how, 'close');
  const a = atr([bar(0, 1, 1, 1, 1), ...[1, 2, 3].map((i) => bar(i, 1, 1.02, 0.99, 1))], 3, 3);
  assert.ok(Math.abs(a - 0.03) < 1e-12);
});

test('costs: base = 1.3 pip + 45 per million, financing 0.004 % a night; 2x doubles both', () => {
  assert.ok(Math.abs(costFrac(1, 0.0001) - (1.3e-4 + 4.5e-5)) < 1e-15);
  const t0 = Date.UTC(2026, 9, 5) / 1000; // Monday
  const bars = [0, 1, 2].map((i) => bar(t0 + i * 86400, 1, 1.01, 0.995, 1));
  const L = legResult({ EUR: bars }, { EUR: bars }, PAIRS[0], 0, 2, 1, 0.02, bars.map((b) => b.time));
  assert.equal(L.nights, 5);
  assert.ok(Math.abs(L.finR - (5 * P.FIN_NIGHT) / 0.02) < 1e-12);
  assert.ok(Math.abs(L.net - (L.gross - L.costR - L.finR)) < 1e-12);
  assert.ok(Math.abs(L.net2x - (L.gross - 2 * L.costR - 2 * L.finR)) < 1e-12);
});

test('statistics, Holm, percentile and the placebo picker', () => {
  const s = stats([1, -1, 2, 0]);
  assert.equal(s.n, 4); assert.equal(s.mean, 0.5); assert.equal(s.dd, -1);
  assert.deepEqual(holm([0.01, 0.04]), [0.02, 0.04]);
  assert.equal(percentile([1, 2, 3, 4, 5], 0.5), 3);
  const pk = randomPick(mulberry32(7))();
  assert.equal(new Set([...pk.long, ...pk.short]).size, 4);
});

test('the report matches result.json and the pre-registered bar', () => {
  assert.deepEqual(R.windows, { is: IS, oos: OOS });
  assert.ok(/Verdict:\s*(PASS|FAIL)/.test(MD));
  assert.ok(MD.includes(`**Verdict: ${R.verdict}**`));
  for (const k of ['primary', 'skip12']) {
    const L = R.signals[k];
    const c = L.checks;
    const pass = c.oosPositive && c.oosT2 && c.isPositive && c.oos2xPositive && c.holm && c.placebo;
    assert.equal(L.pass, pass);
    assert.equal(c.oosT2, L.oos.net.t >= 2);
    assert.equal(c.placebo, L.oos.net.t > R.placebo.t.p95);
    assert.equal(L.placeboBeaten, R.placebo.tAll.filter((t) => L.oos.net.t > t).length);
    const fmt = (v, d) => (v < 0 ? '−' : '+') + Math.abs(v).toFixed(d);
    assert.ok(MD.includes(fmt(L.oos.net.mean, 3)), `${k} OOS mean in the report`);
    assert.ok(MD.includes(`t ${L.oos.net.t.toFixed(2).replace('-', '−')}`), `${k} OOS t in the report`);
    assert.ok(MD.includes(fmt(L.is.net.mean, 3)));
    assert.ok(MD.includes(fmt(L.oos.net2x.mean, 3)));
    assert.ok(MD.includes(`beats ${L.placeboBeaten} of 40`));
  }
  assert.equal(R.verdict, R.signals.primary.pass ? 'PASS' : R.signals.skip12.pass ? 'PASS (skip variant only)' : 'FAIL');
  assert.equal(R.signals.primary.oos.net.n, 142);
  assert.ok(MD.includes(`5th percentile ${R.placebo.t.p5.toFixed(2).replace('-', '−')}`));
  assert.ok(MD.includes(`95th percentile +${R.placebo.t.p95.toFixed(2)}`));
  // the pre-registration fixed the rule before the result
  for (const s of ['60-month', 'skip the latest 12 months', '3 × ATR(20)', '0.004 %', '2x', '40 placebo']) assert.ok(PRE.includes(s), s);
});
