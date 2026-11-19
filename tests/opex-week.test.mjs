// opex-week study (research/edge/opex-week): the third-Friday calendar with holidays, entry and exit dates, the stop with gap
// fill, costs and financing, the placebo's weeks, and RESULT.md against result.json. Offline: hand-made candles only.
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import * as R from '../research/edge/opex-week/run.mjs';

const DIR = path.join(path.dirname(new URL(import.meta.url).pathname), '..', 'research', 'edge', 'opex-week');
const sec = (ymd) => Date.parse(ymd + 'T00:00:00Z') / 1000;

test('calendar: third Friday, holiday expiries, entry and exit dates', () => {
  assert.equal(R.thirdFriday('2026-10'), '2026-10-16');
  assert.equal(R.thirdFriday('2024-03'), '2024-03-15');
  assert.equal(R.thirdFriday('2022-04'), '2022-04-15', 'month starting on a Friday');
  assert.equal(R.thirdFriday('2023-09'), '2023-09-15');
  // an ordinary month: Friday to Friday, then Friday to the next Friday
  assert.deepEqual(R.datesOf('2026-10'), { F: '2026-10-16', X: '2026-10-16', E1: '2026-10-09', Y: '2026-10-23' });
  // Good Friday on the third Friday: expiry is the Thursday
  assert.deepEqual(R.datesOf('2025-04'), { F: '2025-04-18', X: '2025-04-17', E1: '2025-04-11', Y: '2025-04-25' });
  assert.equal(R.datesOf('2014-04').X, '2014-04-17');
  // Juneteenth (from 2022) on the third Friday
  assert.equal(R.datesOf('2026-06').X, '2026-06-18');
  assert.equal(R.isTradingDay('2021-06-18'), true, 'Juneteenth observed only from 2022');
  // Good Friday on the Friday before the expiry week: T1 enters the Thursday
  assert.equal(R.datesOf('2017-04').E1, '2017-04-13');
  assert.equal(R.datesOf('2020-04').E1, '2020-04-09');
  // Good Friday on the next Friday: the week-after exit is the Thursday
  assert.equal(R.datesOf('2016-03').Y, '2016-03-24');
  // Christmas on the next Friday
  assert.equal(R.datesOf('2015-12').Y, '2015-12-24');
  assert.equal(R.isTradingDay('2012-10-29'), false, 'hurricane closure');
  assert.equal(R.isTradingDay('2025-01-09'), false, 'day of mourning');
  // the expiry is always inside the expiry week and E1 before its Monday
  for (let ym = '2008-01'; ym <= '2026-10'; ym = R.addMonths(ym, 1)) {
    const D = R.datesOf(ym), mon = new Date(Date.parse(D.F) - 4 * 86400e3).toISOString().slice(0, 10);
    assert.ok(D.X >= mon && D.X <= D.F && R.isTradingDay(D.X), ym);
    assert.ok(D.E1 < mon && R.isTradingDay(D.E1), ym);
    assert.ok(D.Y > D.F && R.isTradingDay(D.Y), ym);
  }
});

test('placebo weeks: week-end days of the month, the next week-end', () => {
  assert.deepEqual(R.weekEnds('2025-04'), ['2025-04-04', '2025-04-11', '2025-04-17', '2025-04-25']);
  assert.deepEqual(R.weekEnds('2022-04'), ['2022-04-01', '2022-04-08', '2022-04-14', '2022-04-22', '2022-04-29']);
  assert.equal(R.nextWeekEnd('2025-04-11'), '2025-04-17');
  assert.equal(R.nextWeekEnd('2025-04-17'), '2025-04-25');
  assert.equal(R.nextWeekEnd('2016-03-18'), '2016-03-24');
});

test('weekend candles fold into the next weekday (council/fills.mjs foldWeekend)', () => {
  const B = R.fold([[sec('2025-11-21'), 10, 11, 9, 10.5], [sec('2025-11-23'), 10.4, 13, 10.3, 12], [sec('2025-11-24'), 12, 12.5, 11, 12.2], [sec('2025-11-29'), 1, 1, 1, 1]]);
  assert.equal(B.length, 2, 'a trailing weekend candle is dropped');
  assert.deepEqual(B[1], { d: '2025-11-24', o: 10.4, h: 13, l: 10.3, c: 12.2 });
});

// flat weekday candles with a true range of 2 -> ATR 2, risk 5
function flat(from, to) {
  const out = [];
  for (let t = sec(from); t <= sec(to); t += 86400) { const wd = new Date(t * 1000).getUTCDay(); if (wd && wd < 6) out.push([t, 100, 101, 99, 100, 1]); }
  return out;
}
const setup = (rows) => { const B = R.fold(rows); return { B, idx: new Map(B.map((b, i) => [b.d, i])) }; };
const opt = { pts: 1, rate: () => 4 };

test('the stop: 2.5 x ATR(20), hit at the stop, gap fill at the open, time exit', () => {
  const rows = flat('2024-01-01', '2024-03-01');
  let { B, idx } = setup(rows);
  const t0 = R.trade(B, idx, '2024-02-09', '2024-02-16', 1, opt);
  assert.equal(t0.risk, 5); assert.equal(t0.stop, 95); assert.equal(t0.how, 'time'); assert.equal(t0.gross, 0);
  // a low through the stop on Tuesday: filled at the stop, -1R
  const hit = rows.map((r) => r[0] === sec('2024-02-13') ? [r[0], 100, 100, 94, 96, 1] : r);
  ({ B, idx } = setup(hit));
  const t1 = R.trade(B, idx, '2024-02-09', '2024-02-16', 1, opt);
  assert.equal(t1.how, 'stop'); assert.equal(t1.exit, 95); assert.equal(t1.exitD, '2024-02-13'); assert.equal(t1.gross, -1);
  // an open below the stop: filled at the open, worse than -1R
  const gap = rows.map((r) => r[0] === sec('2024-02-13') ? [r[0], 92.5, 93, 92, 92.5, 1] : r);
  ({ B, idx } = setup(gap));
  const t2 = R.trade(B, idx, '2024-02-09', '2024-02-16', 1, opt);
  assert.equal(t2.how, 'stop-gap'); assert.equal(t2.exit, 92.5); assert.equal(t2.gross, -1.5);
  // a short: stop above, gap up fills at the open
  const gapUp = rows.map((r) => r[0] === sec('2024-02-21') ? [r[0], 106, 107, 105, 106, 1] : r);
  ({ B, idx } = setup(gapUp));
  const t3 = R.trade(B, idx, '2024-02-16', '2024-02-23', -1, opt);
  assert.equal(t3.stop, 105); assert.equal(t3.how, 'stop-gap'); assert.equal(t3.exit, 106); assert.equal(t3.gross, -1.2);
  // fewer than 21 candles: no trade
  ({ B, idx } = setup(flat('2024-01-01', '2024-01-31')));
  assert.equal(R.trade(B, idx, '2024-01-26', '2024-01-30', 1, opt), null);
});

test('costs and financing: spread in R, long pays r + 2.5 %, short pays max(0, 2.5 - r) %', () => {
  const { B, idx } = setup(flat('2024-01-01', '2024-03-01'));
  const L = R.trade(B, idx, '2024-02-09', '2024-02-16', 1, opt);
  assert.equal(L.nights, 7);
  assert.ok(Math.abs(L.costR - 1 / 5) < 1e-12);
  assert.ok(Math.abs(L.finR - (6.5 / 100 / 365) * 7 * 100 / 5) < 1e-12);
  assert.ok(Math.abs(L.net - (0 - 0.2 - L.finR)) < 1e-12);
  const S = R.trade(B, idx, '2024-02-09', '2024-02-16', -1, opt);
  assert.equal(S.finR, 0, 'a short pays nothing while the 2-year yield is over 2.5 %');
  const S2 = R.trade(B, idx, '2024-02-09', '2024-02-16', -1, { pts: 3, rate: () => 1 });
  assert.ok(Math.abs(S2.finR - (1.5 / 100 / 365) * 7 * 100 / 5) < 1e-12);
  assert.ok(Math.abs(S2.costR - 0.6) < 1e-12);
  assert.ok(S2.net < 0);
  assert.equal(R.finRate(-1, 4), 0);
  assert.ok(R.finRate(-1, 4) >= 0 && R.finRate(-1, -1) > 0);
});

test('statistics: t, Holm', () => {
  const s = R.stats([1, 2, 3]); assert.equal(s.mean, 2); assert.equal(s.sd, 1); assert.ok(Math.abs(s.t - 2 * Math.sqrt(3)) < 1e-12);
  assert.deepEqual(R.holm([0.01, 0.04, 0.03, 0.5]).map((x) => +x.toFixed(4)), [0.04, 0.09, 0.09, 0.5]);
  assert.ok(Math.abs(R.pOneSided(1.645) - 0.05) < 1e-3);
});

test('RESULT.md matches result.json', () => {
  const j = JSON.parse(fs.readFileSync(path.join(DIR, 'result.json'), 'utf8'));
  const md = fs.readFileSync(path.join(DIR, 'RESULT.md'), 'utf8');
  assert.equal(j.verdict, 'FAIL');
  assert.match(md, /\*\*Verdict: FAIL, 0 of 4 tests\.\*\*/);
  const f3 = (x) => (x > 0 ? '+' : '') + x.toFixed(3), f2 = (x) => x.toFixed(2);
  for (const [k, T] of Object.entries(j.tests)) {
    assert.equal(j.checks[k].pass, false, k);
    const row = md.split('\n').find((l) => l.startsWith(`| ${k} | ${j.labels[k]} |`));
    assert.ok(row, k + ' row');
    const c = row.split('|').map((x) => x.trim());
    assert.equal(+c[3], T.dec.n); assert.equal(c[4], f3(T.dec.net)); assert.equal(c[5], f2(T.dec.t)); assert.equal(c[6], f3(T.dec.gross));
    assert.equal(c[7], f2(T.dec.win)); assert.equal(+c[8], T.dec.stops);
    assert.equal(+c[9], T.rep.n); assert.equal(c[10], f3(T.rep.net)); assert.equal(c[11], f2(T.rep.t));
    assert.equal(c[12], `${T.placebo.beaten} / 40`); assert.equal(c[13], f2(j.checks[k].holmP));
    const prow = md.split('\n').find((l) => l.startsWith(`| ${k} | ${f3(T.placebo.ruleMean)} |`));
    assert.ok(prow, k + ' placebo row');
    assert.deepEqual(prow.split('|').map((x) => x.trim()).slice(3, 6), [f3(T.placebo.median), f3(T.placebo.p95), String(T.placebo.beaten)]);
    assert.equal(T.counts.noCandle, 0);
  }
  for (const k of ['T1', 'T4']) assert.ok(md.includes(Object.values(j.tests[k].byYear).map((s) => f3(s.net)).join(', ')), k + ' by year');
});
