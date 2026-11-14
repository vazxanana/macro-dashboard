// cnh-fix study (research/edge/cnh-fix): the UTC clock of the 01:15 fix, the 01:15-01:30 UTC move, the 20-day median from
// earlier days only, the event, the follow / fade / mirrored-proxy sides, stop, gap and time exit at 03:30 UTC, the costs in R
// (the assumed USD/CNH spread, AUD/USD's raw-spread model), the statistics, the placebo quarter hours, and the committed
// result against the pre-registered bar and RESULT.md. Offline: small hand-made candles, no candle file is read.
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { P, PAIRS, TESTS, at, weekdays, windowOf, columns, moveOf, median, moves, simTrade, dayTrade, tradeCost, monthT, tOf, holm, normP, placeboStart, rng, study, coverage } from '../research/edge/cnh-fix/run.mjs';

const rd = (p) => fs.readFileSync(new URL(p, import.meta.url), 'utf8');
const PRE = rd('../research/edge/cnh-fix/PREREGISTRATION.md'), RES = rd('../research/edge/cnh-fix/RESULT.md');
const J = JSON.parse(rd('../research/edge/cnh-fix/result.json'));
const U = (s) => Date.parse(s) / 1000;
const near = (a, b, e = 1e-9) => assert.ok(Math.abs(a - b) < e, `${a} vs ${b}`);
const CNH = PAIRS.usdcnh, AUD = PAIRS.audusd;
const flat = (t0, t1, p, w = 0.0001) => { const r = []; for (let t = t0; t < t1; t += 300) r.push([t, p, p + w, p - w, p]); return r; };

test('the constants, markets and tests are the pre-registered ones', () => {
  assert.deepEqual([P.START, P.MOVE, P.ENTRY, P.HOLD, P.REF_N, P.REF_SPAN, P.EVENT, P.STOP, P.EXIT_SLACK, P.SEEDS], [75, 15, 15, 120, 20, 42, 0.5, 1, 900, 40]);
  assert.deepEqual(P.BAR, { n: 200, pHolm: 0.05, placeboAbove: 38, repYears: 2 });
  assert.deepEqual([CNH.spreadPips, CNH.slipPips, CNH.commRT, AUD.spreadPips, AUD.slipPips, AUD.commRT], [3, 3, 45e-6, 0.3, 0.3, 45e-6]);
  assert.deepEqual([TESTS.T1.sym, TESTS.T1.dir, TESTS.T2.sym, TESTS.T2.dir, TESTS.T3.sym, TESTS.T3.dir], ['usdcnh', 1, 'usdcnh', -1, 'audusd', -1]);
  assert.equal(P.PLACEBO_STARTS.length, 25);
  assert.ok(!P.PLACEBO_STARTS.some((m) => [60, 75, 90].includes(m)));
  assert.equal(P.PLACEBO_STARTS[0], -60); assert.equal(P.PLACEBO_STARTS.at(-1), 345);
  for (const s of ['**Decisive window: trades entered 1 Jan 2018 to 13 Nov 2026.', '`|M| > 0.5 × ref`', '`1 × ref` beyond the entry',
    '**spread 3.0 pips**', 'Holm-adjusted one-sided p < 0.05', 'decisive n ≥ 200', '**23:00, 23:15, …, 05:45 UTC except 01:00, 01:15, 01:30**',
    'This study cannot read the fix level itself.']) assert.ok(PRE.includes(s), s);
  assert.equal(windowOf(U('2017-12-29T01:30:00Z')), 'rep'); assert.equal(windowOf(U('2018-01-02T01:30:00Z')), 'dec'); assert.equal(windowOf(U('2026-11-16T01:30:00Z')), null);
});

test('the clock is UTC: the fix is 01:15 UTC all year, the move 01:15-01:30, entry 01:30', () => {
  const w = U('2024-01-15T00:00:00Z'), s = U('2024-07-15T00:00:00Z');
  assert.equal(at(w, P.START), U('2024-01-15T01:15:00Z')); assert.equal(at(s, P.START), U('2024-07-15T01:15:00Z'));
  assert.equal(at(w, -60), U('2024-01-14T23:00:00Z'));
  const d = weekdays(U('2024-03-01T00:00:00Z'), U('2024-03-11T00:00:00Z')).map((x) => new Date(x * 1000).toISOString().slice(0, 10));
  assert.deepEqual(d, ['2024-03-01', '2024-03-04', '2024-03-05', '2024-03-06', '2024-03-07', '2024-03-08']);
});

test('the move: close of 01:25 minus open of 01:15 UTC; the median from the 20 EARLIER days only, within 42 days', () => {
  const day = U('2024-01-15T00:00:00Z'), rows = flat(at(day, 75), at(day, 90), 7.1);
  assert.equal(rows.length, 3);
  rows[0][1] = 7.1; rows[2][4] = 7.1012;
  near(moveOf(columns(rows), day, 75), 0.0012);
  assert.equal(moveOf(columns(rows.slice(0, 2)), day, 75), null);
  assert.equal(median([3, 1, 2]), 2); assert.equal(median([4, 1, 3, 2]), 2.5);
  const days = weekdays(U('2024-01-01T00:00:00Z'), U('2024-02-08T00:00:00Z')).slice(0, 25), r = [];
  days.forEach((d, i) => { const a = flat(at(d, 75), at(d, 90), 7.1); a[2][4] = 7.1 + (i + 1) * 1e-4; r.push(...a); });
  const mv = moves(columns(r), days, 75);
  for (let i = 0; i < 20; i++) assert.equal(mv[i].ref, null);
  near(mv[20].ref, 10.5e-4); near(mv[24].ref, 14.5e-4);
  assert.equal(moves(columns(r), [...days.slice(0, 20), days[19] + 30 * 86400], 75)[20].ref, null);
});

test('the trade: follow / fade / mirrored AUD, stop 1x ref, gap and touch, time exit at 03:30 UTC', () => {
  const day = U('2024-07-15T00:00:00Z'), s = at(day, 90), base = (p) => flat(s, s + 7200, p);
  const D = { B: columns(base(7.1)), pr: CNH }, A = { B: columns(base(0.66)), pr: AUD };
  const x = { day, M: 0.002, ref: 0.001 }, y = { day, ref: 0.001 };
  let r = dayTrade(D, TESTS.T1, x, y, 75); assert.equal(r.side, 1); near(r.stop, 7.099); assert.equal(r.how, 'time'); assert.equal(r.t, U('2024-07-15T01:30:00Z'));
  r = dayTrade(D, TESTS.T2, x, y, 75); assert.equal(r.side, -1); near(r.stop, 7.101);
  // CNH weakens (USD/CNH up) -> sell AUD; CNH strengthens -> buy AUD; AUD's own ref is the stop
  r = dayTrade(A, TESTS.T3, x, { day, ref: 0.0005 }, 75); assert.equal(r.side, -1); near(r.stop, 0.6605);
  r = dayTrade(A, TESTS.T3, { ...x, M: -0.002 }, { day, ref: 0.0005 }, 75); assert.equal(r.side, 1);
  assert.equal(dayTrade(D, TESTS.T1, { ...x, M: 0.0004 }, y, 75).skip, 'noevent');
  assert.equal(dayTrade(D, TESTS.T1, { ...x, M: null }, y, 75).skip, 'nomove');
  assert.equal(dayTrade(A, TESTS.T3, x, { day, ref: null }, 75).skip, 'noref');
  // stop by touch, gap, and the 03:25 candle's close
  let rows = base(7.1); rows[3][3] = 7.098; r = simTrade(columns(rows), CNH, 1, 0.001, s, s + 7200); assert.equal(r.how, 'stop'); near(r.gross, -1);
  rows = base(7.1); rows[5][1] = 7.1015; rows[5][2] = 7.102; r = simTrade(columns(rows), CNH, -1, 0.001, s, s + 7200); assert.equal(r.how, 'gap'); near(r.gross, -1.5);
  rows = base(7.1); rows[23][4] = 7.1005; r = simTrade(columns(rows), CNH, 1, 0.001, s, s + 7200); assert.equal(rows[23][0], U('2024-07-15T03:25:00Z')); near(r.exit, 7.1005); near(r.gross, 0.5);
  assert.equal(simTrade(columns(base(7.1).slice(1)), CNH, 1, 0.001, s, s + 7200).skip, 'nodata');
  assert.equal(simTrade(columns(base(7.1).slice(0, 18)), CNH, 1, 0.001, s, s + 7200).skip, 'nodata');
  // costs: USD/CNH 6 pips + 45e-6 x entry; AUD/USD 0.6 pip + 45e-6 x entry; twice at k = 2
  near(tradeCost(CNH, 7.1), 6e-4 + 45e-6 * 7.1); near(tradeCost(AUD, 0.66), 0.6e-4 + 45e-6 * 0.66); near(tradeCost(CNH, 7.1, 2), 2 * (6e-4 + 45e-6 * 7.1));
  r = simTrade(columns(base(7.1)), CNH, 1, 0.001, s, s + 7200); near(r.net, -tradeCost(CNH, 7.1) / 0.001); near(r.net2, -2 * tradeCost(CNH, 7.1) / 0.001);
});

test('study and coverage run end to end on a small fixture', () => {
  const days = weekdays(U('2019-01-01T00:00:00Z'), U('2019-03-01T00:00:00Z')), rows = [];
  days.forEach((d, i) => { const a = flat(at(d, -60), at(d, 8 * 60), 7.1); const k = (75 + 60) / 5; a[k][1] = 7.1; a[k + 2][4] = 7.1 + (i % 3 + 1) * 1e-4; rows.push(...a); });
  const S = study({ usdcnh: rows, audusd: rows });
  assert.equal(S.verdict, 'FAIL');
  assert.ok(S.tests.T1.dec.n > 0); assert.equal(S.tests.T1.dec.n, S.tests.T2.dec.n);
  assert.equal(S.tests.T1.placebo.of, 40); assert.equal(S.tests.T1.rep.n, 0); assert.equal(S.tests.T1.repWeak, true);
  const c = coverage(rows); assert.equal(c.byYear['2019'].withMove, days.length);
});

test('statistics: month-sum t, Holm, the placebo starts never touch 01:15-01:30 UTC', () => {
  const tr = [{ t: U('2020-01-05T00:00:00Z'), net: 1 }, { t: U('2020-01-20T00:00:00Z'), net: 1 }, { t: U('2020-02-05T00:00:00Z'), net: 1 }, { t: U('2020-03-05T00:00:00Z'), net: -1 }];
  near(monthT(tr), tOf([2, 1, -1]));
  assert.deepEqual(holm([0.01, 0.04, 0.03]), [0.03, 0.06, 0.06]);
  near(normP(1.645), 0.05, 1e-3);
  const u = rng(7), seen = new Set(); for (let i = 0; i < 5000; i++) seen.add(placeboStart(u()));
  assert.deepEqual([...seen].sort((a, b) => a - b), P.PLACEBO_STARTS);
  assert.ok(P.PLACEBO_STARTS.every((m) => m + 15 <= 60 || m >= 105));
});

test('the committed result follows the bar, and RESULT.md quotes it', () => {
  assert.equal(J.topic, 'cnh-fix');
  for (const k of ['T1', 'T2', 'T3']) {
    const X = J.tests[k];
    const pass = X.dec.exp > 0 && X.rep.exp > 0 && X.dec.t > 0 && X.pHolm < 0.05 && X.dec.n >= 200;
    assert.equal(X.pass, pass, k);
    assert.equal(X.placebo.of, 40);
    for (const v of [X.dec.exp, X.dec.t, X.rep.exp]) assert.ok(RES.includes(String(v).replace('-', '−')) || RES.includes(String(v)), `${k} ${v}`);
  }
  const verdict = ['T1', 'T2', 'T3'].some((k) => J.tests[k].pass) ? 'PASS' : 'FAIL';
  assert.ok(J.verdict.startsWith(verdict));
  assert.match(RES, new RegExp(`\\*\\*Verdict: ${verdict}`));
});
