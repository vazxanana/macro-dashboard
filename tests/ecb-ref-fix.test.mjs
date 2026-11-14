// ecb-ref-fix study (research/edge/ecb-ref-fix): the CET / CEST clock across summer time, the 13:45-14:14 CET move, the 20-day
// median from earlier days only, the event, the fade's side, stop, gap and time exit at 15:00 / 14:45 CET, the costs in R
// (EUR/JPY pip, commission on a EUR cross), the statistics, the placebo hours, and the committed result against the
// pre-registered bar and RESULT.md. Offline: small hand-made candles, no candle file is read.
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { P, PAIRS, TESTS, cet, cetOff, weekdays, windowOf, mismatch, columns, moveOf, median, moves, simFade, tradeCost, tradesAt, monthT, tOf, holm, normP, placeboHour, rng, study } from '../research/edge/ecb-ref-fix/run.mjs';

const rd = (p) => fs.readFileSync(new URL(p, import.meta.url), 'utf8');
const PRE = rd('../research/edge/ecb-ref-fix/PREREGISTRATION.md'), RES = rd('../research/edge/ecb-ref-fix/RESULT.md');
const J = JSON.parse(rd('../research/edge/ecb-ref-fix/result.json'));
const ECB = JSON.parse(rd('../research/edge/ecb-ref-fix/ecb-days.json'));
const U = (s) => Date.parse(s) / 1000;
const near = (a, b, e = 1e-9) => assert.ok(Math.abs(a - b) < e, `${a} vs ${b}`);
const EUR = PAIRS[0], JPY = PAIRS[2];
const flat = (t0, t1, p, w = 0.0001) => { const r = []; for (let t = t0; t < t1; t += 300) r.push([t, p, p + w, p - w, p]); return r; };

test('the constants, markets and tests are the pre-registered ones', () => {
  assert.deepEqual([P.HOUR, P.REF_N, P.REF_SPAN, P.EVENT, P.STOP, P.EXIT_SLACK, P.SPREAD_PIPS, P.SLIP_PIPS, P.COMM_RT, P.SEEDS], [14, 20, 42, 0.5, 1, 900, 0.3, 0.3, 45e-6, 40]);
  assert.deepEqual(P.BAR, { n: 100, pHolm: 0.05, placeboAbove: 38 });
  assert.deepEqual(P.PLACEBO_HOURS, [2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 18, 19, 20, 21]);
  assert.deepEqual(PAIRS.map((p) => p.sym), ['eurusd', 'eurgbp', 'eurjpy', 'eurchf']);
  assert.deepEqual([TESTS.T1.pairs, TESTS.T1.exitMin, TESTS.T2.pairs, TESTS.T2.exitMin, TESTS.T3.pairs, TESTS.T3.exitMin],
    [['eurusd'], 45, ['eurusd'], 30, ['eurgbp', 'eurjpy', 'eurchf'], 45]);
  for (const s of ['**Decisive window: trades entered 1 Jan 2016 to 13 Nov 2026. Replication window: 1 Jan 2010 to 31 Dec 2015.**', '`|M| > 0.5 × ref`',
    '`1 × ref` beyond the entry', '| T2 | EUR/USD | 14:45 CET', 'Holm-adjusted one-sided p < 0.05', 'decisive n ≥ 100', '{2, 3, …, 12, 18, 19, 20, 21}']) assert.ok(PRE.includes(s), s);
  assert.equal(windowOf(U('2015-12-31T13:15:00Z')), 'rep'); assert.equal(windowOf(U('2016-01-04T13:15:00Z')), 'dec'); assert.equal(windowOf(U('2026-11-16T13:15:00Z')), null);
  assert.ok(ECB.ecbDecisionDays.length > 100 && ECB.provenance.includes('memory'));
});

test('the CET clock: 14:15 CET is 13:15 UTC in winter and 12:15 UTC in summer, switching on the EU dates', () => {
  assert.equal(cet(U('2024-01-15T00:00:00Z'), 14, 15), U('2024-01-15T13:15:00Z'));
  assert.equal(cet(U('2024-07-15T00:00:00Z'), 14, 15), U('2024-07-15T12:15:00Z'));
  // EU summer time 31 Mar - 27 Oct 2024; the US one 10 Mar - 3 Nov: the clock follows Frankfurt, the gap weeks are "mismatch"
  assert.equal(cetOff(U('2024-03-15T00:00:00Z')), 1); assert.equal(cetOff(U('2024-04-01T00:00:00Z')), 2);
  assert.equal(cetOff(U('2024-10-25T00:00:00Z')), 2); assert.equal(cetOff(U('2024-10-28T00:00:00Z')), 1);
  assert.equal(mismatch(U('2024-03-15T13:15:00Z')), true); assert.equal(mismatch(U('2024-04-15T12:15:00Z')), false);
  assert.equal(mismatch(U('2024-10-30T13:15:00Z')), true); assert.equal(mismatch(U('2024-12-02T13:15:00Z')), false);
  const w = weekdays(U('2024-03-01T00:00:00Z'), U('2024-03-11T00:00:00Z')).map((d) => new Date(d * 1000).toISOString().slice(0, 10));
  assert.deepEqual(w, ['2024-03-01', '2024-03-04', '2024-03-05', '2024-03-06', '2024-03-07', '2024-03-08']);
});

test('the move: close of 14:10 minus open of 13:45 CET; the median from the 20 EARLIER days only, within 42 days', () => {
  const day = U('2024-01-15T00:00:00Z'), rows = flat(cet(day, 13, 45), cet(day, 14, 15), 1.1);
  assert.equal(rows.length, 6);
  rows[0][1] = 1.1000; rows[5][4] = 1.1012;
  near(moveOf(columns(rows), day, 14), 0.0012);
  assert.equal(moveOf(columns(rows.slice(0, 5)), day, 14), null);
  assert.equal(median([3, 1, 2]), 2); assert.equal(median([4, 1, 3, 2]), 2.5); assert.equal(median([]), null);
  const days = weekdays(U('2024-01-01T00:00:00Z'), U('2024-02-08T00:00:00Z')).slice(0, 25), r = [];
  days.forEach((d, i) => { const a = flat(cet(d, 13, 45), cet(d, 14, 15), 1.1); a[0][1] = 1.1; a[5][4] = 1.1 + (i + 1) * 1e-4; r.push(...a); });
  const mv = moves(columns(r), days, 14);
  for (let i = 0; i < 20; i++) assert.equal(mv[i].ref, null, `day ${i}`);
  near(mv[20].ref, 10.5e-4); near(mv[24].ref, 14.5e-4); near(mv[20].M, 21e-4);
  const far = [...days.slice(0, 20), days[19] + 30 * 86400];
  assert.equal(moves(columns(r), far, 14)[20].ref, null);
});

test('the fade: against the move at 14:15 CET, stop 1x ref, gap and touch, time exit at 15:00 or 14:45 CET', () => {
  const day = U('2024-07-15T00:00:00Z'), s = cet(day, 14, 15), base = () => flat(s, s + 2700, 1.1);
  assert.equal(s, U('2024-07-15T12:15:00Z'));
  let x = simFade(columns(base()), EUR, 0.002, 0.001, s, s + 2700);
  assert.equal(x.side, -1); near(x.stop, 1.101); assert.equal(x.how, 'time'); near(x.gross, 0);
  const cost = tradeCost(EUR, 1.1); near(cost, 0.6e-4 + 45e-6 * 1.1); near(x.costR, cost / 0.001); near(x.net, -cost / 0.001); near(x.net2, -2 * cost / 0.001);
  let r = base(); r[2][3] = 1.0985; x = simFade(columns(r), EUR, -0.002, 0.001, s, s + 2700);
  assert.equal(x.side, 1); assert.equal(x.how, 'stop'); near(x.exit, 1.099); near(x.gross, -1);
  r = base(); r[4][1] = 1.1015; r[4][2] = 1.102; x = simFade(columns(r), EUR, 0.002, 0.001, s, s + 2700);
  assert.equal(x.how, 'gap'); near(x.gross, -1.5);
  // 15:00 CET = close of the 14:55 candle (index 8); 14:45 CET = close of the 14:40 candle (index 5)
  r = base(); r[5][4] = 1.0995; r[8][4] = 1.0990; x = simFade(columns(r), EUR, 0.002, 0.001, s, s + 1800);
  near(x.exit, 1.0995); near(x.gross, 0.5);
  x = simFade(columns(r), EUR, 0.002, 0.001, s, s + 2700); near(x.exit, 1.099); near(x.gross, 1);
  assert.equal(simFade(columns(base()), EUR, 0.0005, 0.001, s, s + 2700).skip, 'noevent');
  assert.equal(simFade(columns(base()), EUR, 0.002, 0, s, s + 2700).skip, 'noevent');
  assert.equal(simFade(columns(base().slice(1)), EUR, 0.002, 0.001, s, s + 2700).skip, 'nodata');
  assert.equal(simFade(columns(base().slice(0, 3)), EUR, 0.002, 0.001, s, s + 2700).skip, 'nodata');
  // EUR/JPY: pip 0.01, commission 45e-6 x entry in yen
  near(tradeCost(JPY, 160), 0.006 + 45e-6 * 160); near(tradeCost(JPY, 160, 2), 2 * (0.006 + 45e-6 * 160));
});

test('tradesAt and study run end to end on a small fixture', () => {
  const days = weekdays(U('2017-01-02T00:00:00Z'), U('2017-03-01T00:00:00Z')), rows = [];
  days.forEach((d, i) => { const a = flat(cet(d, 1, 0), cet(d, 23, 0), 1.1); const k = (14 - 1 - 1) * 12 + 9; a[k][1] = 1.1; a[k + 5][4] = 1.1 + (i % 3 + 1) * 1e-4; rows.push(...a); });
  const B = columns(rows), mv = moves(B, days, 14);
  assert.ok(mv.every((x) => x.M > 0));
  const r = tradesAt(B, EUR, mv, 14, 45);
  assert.equal(r.fun.days, days.length); assert.equal(r.fun.noref, 20); assert.ok(r.fun.trades > 0);
  assert.ok(r.list.every((x) => x.side === -1 && x.stop > x.entry));
  const candles = Object.fromEntries(PAIRS.map((p) => [p.sym, rows]));
  const S = study(candles, ['2017-02-02']);
  assert.equal(S.verdict, 'FAIL'); assert.equal(S.tests.T3.dec.n, 3 * S.tests.T1.dec.n);
  assert.equal(S.tests.T1.placebo.of, 40);
  assert.equal(S.tests.T1.splits.ecbDays.n + S.tests.T1.splits.noEcbDays.n, S.tests.T1.dec.n);
});

test('statistics: month-sum t, Holm, the placebo hours never touch 13:45-15:00 CET', () => {
  const tr = [{ t: U('2020-01-05T00:00:00Z'), net: 1 }, { t: U('2020-01-20T00:00:00Z'), net: 1 }, { t: U('2020-02-05T00:00:00Z'), net: 1 }, { t: U('2020-03-05T00:00:00Z'), net: -1 }];
  near(monthT(tr), tOf([2, 1, -1]));
  assert.deepEqual(holm([0.01, 0.04, 0.03]), [0.03, 0.06, 0.06]);
  near(normP(1.645), 0.05, 1e-3);
  const u = rng(7), seen = new Set(); for (let i = 0; i < 5000; i++) seen.add(placeboHour(u()));
  assert.deepEqual([...seen].sort((a, b) => a - b), P.PLACEBO_HOURS);
  assert.ok(P.PLACEBO_HOURS.every((h) => h + 1 <= 13 || h - 1 >= 15));
  assert.equal(rng(3)(), rng(3)());
});

test('the committed result follows the bar, and RESULT.md quotes it', () => {
  assert.equal(J.topic, 'ecb-ref-fix');
  for (const k of ['T1', 'T2', 'T3']) {
    const X = J.tests[k];
    const pass = X.dec.exp > 0 && X.rep.exp > 0 && X.dec.t > 0 && X.pHolm < 0.05 && X.dec.n >= 100;
    assert.equal(X.pass, pass, k);
    assert.equal(X.placebo.of, 40);
    for (const v of [X.dec.exp, X.dec.t, X.rep.exp]) assert.ok(RES.includes(String(v).replace('-', '−')) || RES.includes(String(v)), `${k} ${v}`);
  }
  const verdict = ['T1', 'T2', 'T3'].some((k) => J.tests[k].pass) ? 'PASS' : 'FAIL';
  assert.ok(J.verdict.startsWith(verdict));
  assert.match(RES, new RegExp(`\\*\\*Verdict: ${verdict}`));
});
