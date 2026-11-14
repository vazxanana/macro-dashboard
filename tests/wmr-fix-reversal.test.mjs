// wmr-fix-reversal study (research/edge/wmr-fix-reversal): the London clock across summer time, the move of 15:00-15:59,
// the 20-day median from earlier days only, the event, the fade's side, stop, gap and time exit, the costs in R, the
// statistics, the placebo hours, and the committed result against the pre-registered bar and RESULT.md. Offline: small
// hand-made candles, no candle file is read.
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { P, PAIRS, TESTS, london, londonOff, weekdays, windowOf, columns, moveOf, median, moves, simFade, tradeCost, tradesAt, monthT, tOf, holm, normP, placeboHour, rng, study } from '../research/edge/wmr-fix-reversal/run.mjs';

const rd = (p) => fs.readFileSync(new URL(p, import.meta.url), 'utf8');
const PRE = rd('../research/edge/wmr-fix-reversal/PREREGISTRATION.md'), RES = rd('../research/edge/wmr-fix-reversal/RESULT.md');
const J = JSON.parse(rd('../research/edge/wmr-fix-reversal/result.json'));
const U = (s) => Date.parse(s) / 1000;
const near = (a, b, e = 1e-9) => assert.ok(Math.abs(a - b) < e, `${a} vs ${b}`);
const EUR = PAIRS[0], JPY = PAIRS[2];
// flat M5 candles from t0 to t1 at price p (range +-w)
const flat = (t0, t1, p, w = 0.0001) => { const r = []; for (let t = t0; t < t1; t += 300) r.push([t, p, p + w, p - w, p]); return r; };

test('the constants, pairs and tests are the pre-registered ones', () => {
  assert.deepEqual([P.HOUR, P.REF_N, P.REF_SPAN, P.EVENT, P.STOP, P.EXIT_SLACK, P.SPREAD_PIPS, P.SLIP_PIPS, P.COMM_RT, P.SEEDS], [15, 20, 42, 0.5, 1, 900, 0.3, 0.3, 45e-6, 40]);
  assert.deepEqual(P.BAR, { n: 100, pHolm: 0.0228, placeboAbove: 38 });
  assert.deepEqual(P.PLACEBO_HOURS, [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 17, 18, 19]);
  assert.deepEqual(PAIRS.map((p) => p.sym), ['eurusd', 'gbpusd', 'usdjpy', 'audusd', 'usdchf', 'usdcad']);
  assert.deepEqual([TESTS.T1.pairs.length, TESTS.T1.exitMin, TESTS.T2.pairs, TESTS.T2.exitMin, TESTS.T3.pairs.length, TESTS.T3.exitMin], [6, 60, ['eurusd'], 60, 6, 30]);
  near(normP(2), 0.02275, 1e-4);
  for (const s of ['**Decisive window: trades entered 1 Jan 2016 to 31 Oct 2026. Replication window: 1 Jan 2010 to 31 Dec 2015**', '`|M| > 0.5 × ref`', '`1 × ref` beyond the entry',
    '| T3 | the six pairs pooled | 16:30 London', 'Holm-adjusted one-sided p ≤ 0.0228', 'decisive n ≥ 100', 'beats at least 38 of\nthe 40 placebo seeds']) assert.ok(PRE.includes(s), s);
  assert.equal(windowOf(U('2015-12-31T16:00:00Z')), 'rep'); assert.equal(windowOf(U('2016-01-04T16:00:00Z')), 'dec'); assert.equal(windowOf(U('2026-11-02T16:00:00Z')), null);
});

test('the London clock: 16:00 London is 16:00 UTC in winter and 15:00 UTC in summer, switching on the UK dates', () => {
  assert.equal(london(U('2024-01-15T00:00:00Z'), 16), U('2024-01-15T16:00:00Z'));
  assert.equal(london(U('2024-07-15T00:00:00Z'), 16), U('2024-07-15T15:00:00Z'));
  // UK summer time 31 Mar - 27 Oct 2024; the US one 10 Mar - 3 Nov: the mismatch weeks follow London
  assert.equal(londonOff(U('2024-03-15T00:00:00Z')), 0); assert.equal(londonOff(U('2024-04-01T00:00:00Z')), 1);
  assert.equal(londonOff(U('2024-10-25T00:00:00Z')), 1); assert.equal(londonOff(U('2024-10-28T00:00:00Z')), 0);
  assert.equal(london(U('2024-10-30T00:00:00Z'), 15, 55), U('2024-10-30T15:55:00Z'));
  const w = weekdays(U('2024-03-01T00:00:00Z'), U('2024-03-11T00:00:00Z')).map((d) => new Date(d * 1000).toISOString().slice(0, 10));
  assert.deepEqual(w, ['2024-03-01', '2024-03-04', '2024-03-05', '2024-03-06', '2024-03-07', '2024-03-08']);
});

test('the move: close of 15:55 minus open of 15:00; the median from the 20 EARLIER days only, within 42 days', () => {
  const day = U('2024-01-15T00:00:00Z'), rows = flat(day + 15 * 3600, day + 16 * 3600, 1.1);
  rows[0][1] = 1.1000; rows[11][4] = 1.1012;
  const B = columns(rows);
  near(moveOf(B, day, 15), 0.0012);
  assert.equal(moveOf(columns(rows.slice(0, 11)), day, 15), null);
  assert.equal(median([3, 1, 2]), 2); assert.equal(median([4, 1, 3, 2]), 2.5); assert.equal(median([]), null);
  // 25 weekdays; the move of day i is i pips: the ref of day 20 is the median of days 0..19 (= 9.5 pips), never its own
  const days = weekdays(U('2024-01-01T00:00:00Z'), U('2024-02-08T00:00:00Z')).slice(0, 25), r = [];
  days.forEach((d, i) => { const a = flat(london(d, 15), london(d, 16), 1.1); a[0][1] = 1.1; a[11][4] = 1.1 + (i + 1) * 1e-4; r.push(...a); });
  const mv = moves(columns(r), days, 15);
  for (let i = 0; i < 20; i++) assert.equal(mv[i].ref, null, `day ${i}`);
  near(mv[20].ref, 10.5e-4); near(mv[24].ref, 14.5e-4); near(mv[20].M, 21e-4);
  // a gap of 43+ days before the 20th earlier move: no reference
  const far = [...days.slice(0, 20), days[19] + 30 * 86400];
  assert.equal(moves(columns(r), far, 15)[20].ref, null);
});

test('the fade: against the move at 16:00, stop 1x ref, gap and touch, time exit at 17:00 or 16:30', () => {
  const day = U('2024-01-15T00:00:00Z'), s = london(day, 16), base = () => flat(s, s + 3600, 1.1);
  // move up -> sell at 1.1, stop 1.1010
  let x = simFade(columns(base()), EUR, 0.002, 0.001, s, s + 3600);
  assert.equal(x.side, -1); near(x.stop, 1.101); assert.equal(x.how, 'time'); near(x.gross, 0);
  const cost = tradeCost(EUR, 1.1); near(cost, 0.6e-4 + 45e-6 * 1.1); near(x.costR, cost / 0.001); near(x.net, -cost / 0.001); near(x.net2, -2 * cost / 0.001);
  // move down -> buy; price falls through the stop on the 3rd candle by touch
  let r = base(); r[2][3] = 1.0985; x = simFade(columns(r), EUR, -0.002, 0.001, s, s + 3600);
  assert.equal(x.side, 1); assert.equal(x.how, 'stop'); near(x.exit, 1.099); near(x.gross, -1);
  // a candle that opens beyond the stop exits at its open
  r = base(); r[4][1] = 1.1015; r[4][2] = 1.102; x = simFade(columns(r), EUR, 0.002, 0.001, s, s + 3600);
  assert.equal(x.how, 'gap'); near(x.gross, -1.5);
  // the time exit at 16:30 is the close of the 16:25 candle
  r = base(); r[5][4] = 1.0995; r[6][4] = 1.09; x = simFade(columns(r), EUR, 0.002, 0.001, s, s + 1800);
  near(x.exit, 1.0995); near(x.gross, 0.5);
  // no event, no entry candle, no exit candle within 15 minutes
  assert.equal(simFade(columns(base()), EUR, 0.0005, 0.001, s, s + 3600).skip, 'noevent');
  assert.equal(simFade(columns(base()), EUR, 0.002, 0, s, s + 3600).skip, 'noevent');
  assert.equal(simFade(columns(base().slice(1)), EUR, 0.002, 0.001, s, s + 3600).skip, 'nodata');
  assert.equal(simFade(columns(base().slice(0, 6)), EUR, 0.002, 0.001, s, s + 3600).skip, 'nodata');
  // USD/JPY: pip 0.01, commission 45e-6 x entry in yen
  near(tradeCost(JPY, 150), 0.006 + 45e-6 * 150); near(tradeCost(JPY, 150, 2), 2 * (0.006 + 45e-6 * 150));
});

test('tradesAt and study run end to end on a small fixture', () => {
  const days = weekdays(U('2017-01-02T00:00:00Z'), U('2017-03-01T00:00:00Z')), rows = [];
  days.forEach((d, i) => { const a = flat(london(d, 0), london(d, 21), 1.1); const k = 15 * 12; a[k][1] = 1.1; a[k + 11][4] = 1.1 + (i % 3 + 1) * 1e-4; rows.push(...a); });
  const B = columns(rows), mv = moves(B, days, 15), r = tradesAt(B, EUR, mv, 15, 60);
  assert.equal(r.fun.days, days.length); assert.equal(r.fun.noref, 20); assert.ok(r.fun.trades > 0);
  assert.ok(r.list.every((x) => x.side === -1 && x.stop > x.entry));
  const candles = Object.fromEntries(PAIRS.map((p) => [p.sym, rows]));
  const S = study(candles);
  assert.equal(S.verdict, 'FAIL'); assert.ok(S.tests.T1.dec.n === 6 * S.tests.T2.dec.n);
  assert.equal(S.tests.T1.placebo.of, 40);
});

test('statistics: month-sum t, Holm, the placebo hours never touch 14:00-17:00', () => {
  const tr = [{ t: U('2020-01-05T00:00:00Z'), net: 1 }, { t: U('2020-01-20T00:00:00Z'), net: 1 }, { t: U('2020-02-05T00:00:00Z'), net: 1 }, { t: U('2020-03-05T00:00:00Z'), net: -1 }];
  near(monthT(tr), tOf([2, 1, -1]));
  assert.deepEqual(holm([0.01, 0.04, 0.03]), [0.03, 0.06, 0.06]);
  const u = rng(7), seen = new Set(); for (let i = 0; i < 5000; i++) seen.add(placeboHour(u()));
  assert.deepEqual([...seen].sort((a, b) => a - b), P.PLACEBO_HOURS);
  assert.equal(rng(3)(), rng(3)());
});

test('the committed result follows the bar, and RESULT.md quotes it', () => {
  assert.equal(J.topic, 'wmr-fix-reversal');
  for (const k of ['T1', 'T2', 'T3']) {
    const X = J.tests[k];
    const pass = X.dec.exp > 0 && X.rep.exp > 0 && X.dec.t > 0 && X.pHolm <= 0.0228 && X.dec.n >= 100;
    assert.equal(X.pass, pass, k);
    assert.equal(X.placebo.of, 40);
    for (const v of [X.dec.exp, X.dec.t, X.rep.exp]) assert.ok(RES.includes(String(v).replace('-', '−')) || RES.includes(String(v)), `${k} ${v}`);
  }
  const verdict = ['T1', 'T2', 'T3'].some((k) => J.tests[k].pass) ? 'PASS' : 'FAIL';
  assert.ok(J.verdict.startsWith(verdict));
  assert.match(RES, new RegExp(`\\*\\*Verdict: ${verdict}`));
});
