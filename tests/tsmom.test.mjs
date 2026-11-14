// Time-series momentum study (research/edge/tsmom): the 12-1 signal reads only candles up to the rebalance and skips the last
// month, ATR(63) reads past candles only, every position has its stop on the losing side, financing by side and nights, the
// statistics, and the committed result against the pre-registered bar and the written report. Offline: no candle file is read.
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { P, KEYS, CLASSES, TESTS, COST, GOLD_COST, costOf, signalAt, atrAt, rebalances, position, priced, slots, finRate, usRate, rateOf, stat, maxDD, holm, normP, monthly, positionsOf, mulberry32, render, study } from '../research/edge/tsmom/run.mjs';
import { nights } from '../council/fills.mjs';

const rd = (p) => fs.readFileSync(new URL(p, import.meta.url), 'utf8');
const PRE = rd('../research/edge/tsmom/PREREGISTRATION.md'), RES = rd('../research/edge/tsmom/RESULT.md');
const J = JSON.parse(rd('../research/edge/tsmom/result.json')), RATES = JSON.parse(rd('../research/edge/tsmom/rates.json'));
const near = (a, b, e = 1e-9) => assert.ok(Math.abs(a - b) < e, `${a} vs ${b}`);
// weekday candles from a Monday; close = f(i), high / low +-1 around open / close
function series(n, f, t0 = Date.UTC(2007, 0, 1) / 1000) {
  const B = []; let t = t0, prev = f(0);
  for (let i = 0; i < n; i++) {
    while ([0, 6].includes(new Date(t * 1000).getUTCDay())) t += 86400;
    const c = f(i), o = prev;
    B.push({ time: t, open: o, high: Math.max(o, c) + 1, low: Math.min(o, c) - 1, close: c });
    prev = c; t += 86400;
  }
  return B;
}

test('constants, universe, tests and windows are the pre-registered ones', () => {
  assert.deepEqual([P.SKIP, P.LOOK, P.ATR, P.STOP_ATR, P.STALE_D, P.MARKUP, P.FX_MARKUP, P.SEEDS, P.T_BAR], [21, 252, 63, 2, 7, 2.5, 1, 40, 2]);
  assert.deepEqual(P.DECISIVE, ['2016-01', '2026-10']); assert.deepEqual(P.REPLICATION, ['2008-01', '2015-12']);
  assert.equal(KEYS.length, 25); assert.deepEqual(Object.keys(TESTS), ['T1', 'T2', 'T3', 'T4', 'T5']);
  for (const [c, ks] of Object.entries(CLASSES)) for (const k of ks) assert.ok(PRE.includes(k), `${c} ${k}`);
  assert.deepEqual(COST, { fx: 0.00015, index: 0.0003, mid: 0.001, wide: 0.002, bond: 0.001 }); assert.equal(GOLD_COST, 0.30);
  for (const s of ['**Decisive window: Jan 2016 to Oct\n  2026**', '**month-sum t >= 2.0**', '**PASS**: T1 passes.', '40 seeds', '**1R = 2 x ATR.**']) assert.ok(PRE.includes(s), s);
  near(costOf('eurusd', 1.1), 0.00015 * 1.1); near(costOf('corn', 400), 0.8); near(costOf('xau', 4000), 0.30); near(costOf('usb10y', 110), 0.11);
});

test('the signal reads only candles up to the rebalance and skips the last month', () => {
  const B = series(400, (i) => 100 + i * 0.1), i = 300;
  assert.equal(signalAt(B, i), 1);
  const after = B.map((b, j) => (j > i ? { ...b, close: 1 } : b));
  assert.equal(signalAt(after, i), 1, 'candles after the rebalance change nothing');
  const lastMonth = B.map((b, j) => (j > i - 21 && j <= i ? { ...b, close: 1 } : b));
  assert.equal(signalAt(lastMonth, i), 1, 'the skipped month (the last 20 candles) changes nothing');
  const atSkip = B.map((b, j) => (j === i - 21 ? { ...b, close: 1 } : b));
  assert.equal(signalAt(atSkip, i), -1, 'close[t-21] is read');
  const atLook = B.map((b, j) => (j === i - 252 ? { ...b, close: 1e6 } : b));
  assert.equal(signalAt(atLook, i), -1, 'close[t-252] is read');
  assert.equal(signalAt(B, 251), null);
});

test('ATR(63) reads past candles only, and the true range uses the previous close', () => {
  const B = series(200, (i) => 100 + (i % 2 ? 2 : 0)), i = 150;
  const a = atrAt(B, i);
  const after = B.map((b, j) => (j > i ? { ...b, high: 1e9, low: -1e9 } : b));
  near(atrAt(after, i), a);
  const before = B.map((b, j) => (j === i - 63 ? { ...b, high: 1e9 } : b));
  near(atrAt(before, i), a, 1e-6);   // candle i-63 is outside the window (its close still feeds candle i-62's true range)
  // every candle: open = previous close, range = |c - o| + 2 = 4 here
  near(a, 4);
  assert.equal(atrAt(B, 62), null);
});

test('every position has its stop on the losing side; a gap exits at the open, a touch at the stop', () => {
  const B = series(30, () => 100);
  B[10] = { ...B[10], open: 100, high: 101, low: 99, close: 100 };
  const long = position(B, 10, 25, 1, 5), short = position(B, 10, 25, -1, 5);
  assert.ok(long.stop < long.entry && short.stop > short.entry);
  assert.equal(long.stopped, false); assert.equal(long.exit, B[25].close);
  const touch = B.map((b, j) => (j === 14 ? { ...b, low: 94 } : b));
  const t = position(touch, 10, 25, 1, 5); assert.deepEqual([t.stopped, t.gap, t.exit, t.x], [true, false, 95, 14]);
  const gap = B.map((b, j) => (j === 14 ? { ...b, open: 90, low: 89 } : b));
  const g = position(gap, 10, 25, 1, 5); assert.deepEqual([g.stopped, g.gap, g.exit], [true, true, 90]);
  const sg = position(B.map((b, j) => (j === 12 ? { ...b, open: 110, high: 111 } : b)), 10, 25, -1, 5); assert.deepEqual([sg.stopped, sg.gap, sg.exit], [true, true, 110]);
  const onEntry = position(B.map((b, j) => (j === 10 ? { ...b, low: 90 } : b)), 10, 25, 1, 5); assert.deepEqual([onEntry.x, onEntry.exit, onEntry.gap], [10, 95, false]);
});

test('financing by side and nights: longs pay 2.5 % + the US 2Y, shorts 2.5 % - it floored at 0, currencies the differential less 1 %', () => {
  const t = Date.UTC(2023, 5, 1) / 1000, us = usRate(RATES, t);
  assert.ok(us > 3); near(finRate(RATES, 'spx500', 1, t), 2.5 + us); near(finRate(RATES, 'spx500', -1, t), Math.max(0, 2.5 - us)); assert.equal(finRate(RATES, 'xau', -1, t), 0);
  const t0 = Date.UTC(2013, 5, 3) / 1000, us0 = usRate(RATES, t0);
  near(finRate(RATES, 'usb10y', -1, t0), 2.5 - us0);
  const eur = rateOf(RATES, 'eur', t), jpy = rateOf(RATES, 'jpy', t);
  near(finRate(RATES, 'eurusd', 1, t), us - eur + 1); near(finRate(RATES, 'eurusd', -1, t), eur - us + 1);
  near(finRate(RATES, 'usdjpy', 1, t), jpy - us + 1); assert.ok(finRate(RATES, 'usdjpy', 1, t) < 0, 'a carry long is credited');
  for (const c of ['eur', 'gbp', 'jpy', 'aud', 'cad', 'chf', 'nzd']) for (let y = 2007; y <= 2026; y++) assert.ok(Number.isFinite(rateOf(RATES, c, Date.UTC(y, 6, 1) / 1000)), `${c} ${y}`);
  // priced: nights from the entry candle's start to the exit candle's end, Wednesday three, rate / 365 x entry / 1R
  const B = series(30, () => 100, Date.UTC(2023, 5, 5) / 1000);   // Monday 5 Jun 2023
  const p = { ...position(B, 0, 4, 1, 2), e: 0 }, x = priced('spx500', B, p, 1, 2, RATES);
  assert.equal(x.nights, nights(B[0].time, B[4].time + 86400)); assert.equal(x.nights, 7);   // Mon-Fri, Wednesday three
  near(x.fin, 7 * (2.5 + usRate(RATES, B[0].time)) / 100 / 365 * 100 / 2);
  near(x.cost, 0.0003 * 100 / 2); near(x.n, x.g - x.cost - x.fin);
  const s = priced('spx500', B, { ...position(B, 0, 4, -1, 2), e: 0 }, -1, 2, RATES); assert.equal(s.fin, 0);
});

test('rebalances are month-end candles with a later candle; slots price both sides; the placebo is seeded', () => {
  const B = series(800, (i) => 100 + Math.sin(i / 30) * 10, Date.UTC(2006, 0, 2) / 1000), rb = rebalances(B);
  for (const i of rb) assert.notEqual(new Date(B[i].time * 1000).getUTCMonth(), new Date(B[i + 1].time * 1000).getUTCMonth());
  assert.ok(!rb.includes(B.length - 1));
  const S = slots('spx500', B, RATES);
  assert.ok(S.length > 10);
  for (const o of S) { assert.ok(o.r0 > 0); assert.ok(o.long.stop < o.long.entry && o.short.stop > o.short.entry); assert.ok(o.month >= '2008-01'); assert.ok(o.i < o.e); }
  const a = mulberry32(7), b = mulberry32(7); for (let k = 0; k < 5; k++) assert.equal(a(), b());
  const ps = positionsOf({ spx500: S }, ['spx500'], (o) => o.s);
  assert.equal(monthly(ps, ['2008-01', '2008-03']).length, 3);
});

test('statistics: t on monthly sums, drawdown, Holm', () => {
  const s = stat([1, 2, 3, 4]); near(s.mean, 2.5); near(s.t, 2.5 / (Math.sqrt(5 / 3) / 2)); near(s.sharpe, 2.5 / Math.sqrt(5 / 3) * Math.sqrt(12));
  assert.equal(maxDD([1, -3, 1, 4, -1]), -3);
  assert.deepEqual(holm([0.01, 0.04, 0.03]).map((x) => +x.toFixed(4)), [0.03, 0.06, 0.06]);
  near(normP(0), 0.5, 1e-7); assert.ok(Math.abs(normP(1.6449) - 0.05) < 1e-4);
});

test('the committed result: the verdict follows the pre-registered conditions, and RESULT.md is the result rendered', () => {
  assert.equal(RES, render(J));
  assert.ok(RES.includes(`**Verdict: ${J.verdict}.**`));
  assert.equal(J.markets.used.length, 25); assert.deepEqual(J.markets.dropped, []);
  const ps = Object.keys(J.tests).map((id) => normP(J.tests[id].decisive.t)), adj = holm(ps);
  for (const [i, id] of Object.keys(J.tests).entries()) {
    const T = J.tests[id], D = T.decisive;
    assert.deepEqual(T.cond, { c1: D.perMonth > 0 && D.t >= 2, c2: T.replication.perMonth > 0, c3: adj[i] < 0.05, c4: D.t > D.placebo.p95, c5: D.x2.perMonth > 0 });
    assert.equal(T.pass, Object.values(T.cond).every(Boolean));
    assert.equal(D.months, 130); assert.equal(T.replication.months, 96);
  }
  const T1 = J.tests.T1, anyClass = ['T2', 'T3', 'T4', 'T5'].some((id) => J.tests[id].cond.c1 && J.tests[id].cond.c2);
  assert.equal(J.verdict, T1.pass ? 'PASS' : (!(T1.cond.c1 && T1.cond.c2) && !anyClass) ? 'FAIL' : 'INCONCLUSIVE');
  assert.equal(J.prereg.length > 6, true);
});

test('study() on two tiny markets gives the five tests with placebo bands', () => {
  const B1 = series(4000, (i) => 100 + i * 0.05 + Math.sin(i / 7) * 3, Date.UTC(2004, 0, 5) / 1000);
  const B2 = series(4000, (i) => 200 - i * 0.03 + Math.cos(i / 11) * 4, Date.UTC(2004, 0, 5) / 1000);
  const R = study({ spx500: slots('spx500', B1, RATES), eurusd: slots('eurusd', B2.map((b) => ({ ...b, open: b.open / 100, high: b.high / 100, low: b.low / 100, close: b.close / 100 })), RATES) });
  assert.deepEqual(Object.keys(R.tests), ['T1', 'T2', 'T3', 'T4', 'T5']);
  assert.ok(['PASS', 'FAIL', 'INCONCLUSIVE'].includes(R.verdict));
  assert.ok(Number.isFinite(R.tests.T1.decisive.placebo.p95));
  assert.equal(R.tests.T1.decisive.positions, R.tests.T2.decisive.positions + R.tests.T5.decisive.positions);
});
