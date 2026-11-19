// Dual momentum study (research/edge/dual-momentum): the month-end pick reads no later candle, the cash switch, the
// catastrophe stop, spreads and financing, the common calendar, Holm, the bootstrap, and RESULT.md against result.json. Offline.
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { align, monthEnds, signalAt, simulate, hurdleOf, nightRate, asOfRate, holm, bootstrap, passOf, MARKUP } from '../research/edge/dual-momentum/run.mjs';
import { FIN, nights } from '../council/fills.mjs';

const rd = (p) => fs.readFileSync(new URL(p, import.meta.url), 'utf8');
const RES = rd('../research/edge/dual-momentum/RESULT.md'), PRE = rd('../research/edge/dual-momentum/PREREGISTRATION.md');
const R = JSON.parse(rd('../research/edge/dual-momentum/result.json'));
const near = (a, b, e = 1e-9) => assert.ok(Math.abs(a - b) < e, `${a} vs ${b}`);
const T = (s) => Date.parse(s + 'T00:00:00Z') / 1000;

function mk(start, n, fn) {
  const out = []; let t = T(start), prev = fn(0);
  for (let i = 0; out.length < n; t += 86400) {
    const wd = new Date(t * 1000).getUTCDay(); if (wd === 0 || wd === 6) continue;
    const c = fn(i++); out.push({ time: t, open: prev, high: Math.max(prev, c) + 0.2, low: Math.min(prev, c) - 0.2, close: c }); prev = c;
  }
  return out;
}
const zeroHurdle = () => 0;
const noRate = { spx500: () => 0, xau: () => 0 };

test('the month-end pick reads no candle after its month end, and picks the better 12-month return', () => {
  const A = { spx500: mk('2019-01-01', 600, (i) => 100 + i * 0.05), xau: mk('2019-01-01', 600, (i) => 100 + i * 0.1) };
  const ends = monthEnds(A.spx500), j = ends.findIndex((e) => e >= 300), s = signalAt(A, ends, j, 252, zeroHurdle);
  assert.equal(s.pick, 'xau'); assert.equal(s.hold, 'xau');
  const cut = (bars) => bars.map((b, k) => (k > ends[j] ? { ...b, open: 1, high: 2, low: 0.5, close: 1 } : b));
  assert.deepEqual(signalAt({ spx500: cut(A.spx500), xau: cut(A.xau) }, ends, j, 252, zeroHurdle), s);
  assert.equal(signalAt(A, ends, ends.findIndex((e) => e >= 100), 252, zeroHurdle), null);   // under 252 candles: no signal
  assert.ok(ends.at(-1) < A.spx500.length - 1);                                              // a forming month has no end
});

test('the cash switch: flat when the better return does not beat the hurdle', () => {
  const A = { spx500: mk('2019-01-01', 600, (i) => 100 + i * 0.01), xau: mk('2019-01-01', 600, (i) => 100 - i * 0.01) };
  const ends = monthEnds(A.spx500), j = ends.findIndex((e) => e >= 300);
  const lo = signalAt(A, ends, j, 252, () => 0.001), hi = signalAt(A, ends, j, 252, () => 0.5);
  assert.equal(lo.hold, 'spx500'); assert.equal(hi.pick, 'spx500'); assert.equal(hi.hold, null); assert.equal(hi.stop, null);
  // flat all month: every return 0, no trade, no cost
  const k = ends[j] + 1, s = simulate(A, { L: 252, rate: noRate, hurdle: () => 0.5, from: A.spx500[k].time, to: A.spx500[ends[j + 1]].time + 1 });
  assert.ok(s.rule.every((x) => x.r === 0)); assert.equal(s.trades.length, 0);
  // the hurdle: mean DGS2 over the lookback / 100 x L/252
  const h = hurdleOf([['2019-06-07', 2], ['2020-01-03', 4], ['2020-05-29', 6]]);
  near(h(T('2020-06-01'), 252), 0.04); near(h(T('2020-06-01'), 126), 0.05 * 0.5);
});

test('entry at the next open pays one spread; a switch sells one and buys the other at the open', () => {
  const up = mk('2019-01-01', 700, (i) => 100 + i * 0.1), flat = mk('2019-01-01', 700, (i) => 100 + i * 0.02);
  const A = { spx500: up, xau: flat }, ends = monthEnds(up), j = ends.findIndex((e) => e >= 300), k = ends[j] + 1;
  const s = simulate(A, { L: 252, spread: { spx500: 1, xau: 0.5 }, rate: noRate, hurdle: zeroHurdle, from: up[k].time, to: up[k + 3].time + 1 });
  near(s.rule[0].r, up[k].close / (up[k].open + 1) - 1);
  near(s.rule[1].r, up[k + 1].close / up[k].close - 1);
  // gold overtakes SPX500 after the month end: out of SPX500 and into gold at the same open
  const g = flat.map((b, i) => (i > ends[j] ? { ...b, open: b.open * 3, high: b.high * 3, low: b.low * 3, close: b.close * 3 } : b));
  const A2 = { spx500: up, xau: g }, m = ends[j + 1];
  const s2 = simulate(A2, { L: 252, spread: { spx500: 1, xau: 0.5 }, rate: noRate, hurdle: zeroHurdle, from: up[k + 1].time, to: up[m + 2].time + 1 });
  const out = s2.trades.find((x) => x.mk === 'spx500');
  assert.equal(out.why, 'signal'); near(out.exit, up[m + 1].open - 1);
  near(s2.rule[m + 1 - (k + 1)].r, ((up[m + 1].open - 1) / up[m].close) * (g[m + 1].close / (g[m + 1].open + 0.5)) - 1);
});

test('the stop fires on the low or at a gap open, and the position stays flat to the month end', () => {
  const A = { spx500: mk('2019-01-01', 700, (i) => 100 + i * 0.1), xau: mk('2019-01-01', 700, (i) => 100) };
  const ends = monthEnds(A.spx500), j = ends.findIndex((e) => e >= 300), k = ends[j] + 1, sig = signalAt(A, ends, j, 252, zeroHurdle);
  assert.equal(sig.hold, 'spx500');
  const crash = { ...A, spx500: A.spx500.map((b, i) => (i === k + 2 ? { ...b, low: sig.stop - 5 } : b)) };
  const s = simulate(crash, { L: 252, rate: noRate, hurdle: zeroHurdle, spread: { spx500: 0, xau: 0 }, from: A.spx500[k].time, to: A.spx500[ends[j + 1]].time + 1 });
  assert.equal(s.trades[0].why, 'stop'); near(s.trades[0].exit, sig.stop);
  for (let d = 3; d < s.rule.length; d++) assert.equal(s.rule[d].r, 0);
  const gap = { ...A, spx500: A.spx500.map((b, i) => (i === k + 2 ? { ...b, open: sig.stop - 3, low: sig.stop - 4 } : b)) };
  near(simulate(gap, { L: 252, rate: noRate, hurdle: zeroHurdle, spread: { spx500: 0, xau: 0 }, from: A.spx500[k].time, to: A.spx500[ends[j + 1]].time + 1 }).trades[0].exit, sig.stop - 3);
});

test('financing is nights() at each market\'s rate', () => {
  near(nightRate('xau', null)(T('2020-01-01')), FIN.xau.long);
  const dgs2 = asOfRate([['2020-01-03', 1.5], ['2020-01-10', -0.2]]);
  near(nightRate('spx500', dgs2)(T('2020-01-08')), (0.015 + MARKUP) / 365);
  near(nightRate('spx500', dgs2)(T('2020-01-12')), MARKUP / 365);
  const A = { spx500: mk('2019-01-01', 700, (i) => 100 + i * 0.1), xau: mk('2019-01-01', 700, () => 100) };
  const ends = monthEnds(A.spx500), k = ends[ends.findIndex((e) => e >= 300)] + 1, bars = A.spx500;
  const s = simulate(A, { L: 252, rate: { spx500: () => 0.001, xau: () => 0 }, hurdle: zeroHurdle, spread: { spx500: 0, xau: 0 }, from: bars[k].time, to: bars[k + 6].time + 1 });
  for (let d = 1; d < 6; d++) near(s.rule[d].r, bars[k + d].close / bars[k + d - 1].close - 1 - nights(bars[k + d].time, bars[k + d + 1].time) * 0.001);
});

test('the common calendar folds a lone candle into the next common one', () => {
  const a = [{ time: 1, open: 10, high: 11, low: 9, close: 10 }, { time: 2, open: 10, high: 15, low: 8, close: 12 }, { time: 3, open: 12, high: 13, low: 11, close: 12.5 }];
  const b = [{ time: 1, open: 1, high: 1, low: 1, close: 1 }, { time: 3, open: 1, high: 1, low: 1, close: 1 }];
  const [x, y] = align(a, b);
  assert.equal(x.length, 2); assert.equal(y.length, 2);
  assert.deepEqual(x[1], { time: 3, open: 10, high: 15, low: 8, close: 12.5 });
});

test('Holm, the bootstrap and the pass bar', () => {
  assert.deepEqual(holm({ L12: 0.04, L6: 0.09 }), { L12: { p: 0.04, bar: 0.05, reject: true }, L6: { p: 0.09, bar: 0.1, reject: true } });
  assert.equal(holm({ L12: 0.06, L6: 0.01 }).L12.reject, true);
  assert.equal(holm({ L12: 0.06, L6: 0.2 }).L12.reject, false);
  const a = [], b = [];
  for (let i = 0; i < 400; i++) { const t = T('2020-01-01') + i * 86400 * 1.45; a.push({ t, r: 0.001 + (i % 7 - 3) * 0.002 }); b.push({ t, r: (i % 5 - 2) * 0.004 }); }
  const x = bootstrap(a, b, 300, 1), y = bootstrap(a, b, 300, 1);
  assert.deepEqual(x, y); assert.ok(x.pBetter > 0.9);
  assert.equal(passOf(R.windows).verdict, R.verdict);
});

test('RESULT.md says what result.json says; the pre-registration states the frame', () => {
  assert.equal(R.verdict, 'FAIL');
  assert.match(RES, /^# .*\n\n\*\*Verdict: FAIL\.\*\*/);
  const W2 = R.windows.W2, W1 = R.windows.W1, pct = (v) => (v * 100).toFixed(2) + ' %', pct1 = (v) => (v * 100).toFixed(1) + ' %';
  for (const L of ['L12', 'L6']) {
    assert.ok(RES.includes(pct(W2[L].rule.cagr)) && RES.includes(String(W2[L].boot.pBetter)), L);
    assert.ok(RES.includes(pct1(W2[L].rule.maxDD)) && RES.includes(pct(W1[L].rule.cagr)));
    assert.ok(RES.includes(`t ${W2[L].vsMix.t.toFixed(2)}`));
  }
  assert.ok(RES.includes(pct(W2.L12.mix.cagr)) && RES.includes(pct1(W2.L12.mix.maxDD)) && RES.includes(W2.L12.mix.sharpe.toFixed(2)));
  assert.ok(RES.includes(`${W2.L12.positions} positions`) && RES.includes(`${W2.L12.stops} ended by the catastrophe stop`));
  assert.ok(RES.includes(R.data.candles.toLocaleString('en-US')));
  for (const s of ['owner decision 44', 'not** a test', 'Cash return while flat = 0', '6-month block bootstrap', 'Holm', '2016-01-01']) assert.ok((PRE + RES).includes(s), s);
});
