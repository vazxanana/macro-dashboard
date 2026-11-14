// research/edge/fx-us-holiday: the holiday rule on known dates, the pieces of run.mjs on hand-made candles, and the report
// against result.json (offline).
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { LEGS, P, dayKind, holidayEvents, isTradingDay, legDay, atr, monthSums, placebo, report, headline } from '../research/edge/fx-us-holiday/run.mjs';

const DIR = new URL('../research/edge/fx-us-holiday/', import.meta.url);
const R = JSON.parse(fs.readFileSync(new URL('result.json', DIR), 'utf8'));
const DAY = 86400, T0 = Date.UTC(2020, 0, 6) / 1000;   // a Monday

function bars(n, last) {
  const out = []; let t = T0;
  while (out.length < n) { const wd = new Date(t * 1000).getUTCDay(); if (wd >= 1 && wd <= 5) out.push({ time: t, open: 1.1, high: 1.101, low: 1.099, close: 1.1 }); t += DAY; }
  if (last) Object.assign(out[out.length - 1], last);
  return out;
}

test('pre-registration committed with the rules the code uses', () => {
  const pre = fs.readFileSync(new URL('PREREGISTRATION.md', DIR), 'utf8');
  for (const s of ['1.5 x ATR(20)', '40 seeds', '38 of the 40', 'learned in sample', '3 January 2005 to 31 December 2014', 'month-sums t', 'UTC daily close', 'Reported only'])
    assert.ok(pre.includes(s), s);
  assert.equal(P.STOP_ATR, 1.5); assert.equal(P.ATR_N, 20); assert.equal(P.SEEDS, 40); assert.equal(P.SEEDS_NEED, 38);
  assert.deepEqual(P.IS, ['2005-01-03', '2014-12-31']); assert.equal(P.OOS[0], '2015-01-01');
});

test('the basket: seven legs, positive = US dollar up', () => {
  assert.deepEqual(LEGS.map((l) => l.key), ['eurusd', 'gbpusd', 'audusd', 'nzdusd', 'usdjpy', 'usdcad', 'usdchf']);
  assert.deepEqual(LEGS.map((l) => l.usd), [-1, -1, -1, -1, 1, 1, 1]);
});

test('NYSE holidays and their pre / post days on known dates', () => {
  const ev = (from, to) => holidayEvents(from, to).map((e) => [e.hol, e.name, e.pre, e.post]);
  assert.deepEqual(ev('2024-01-01', '2024-12-31'), [
    ['2024-01-01', "New Year's Day", '2023-12-29', '2024-01-02'],
    ['2024-01-15', 'Martin Luther King Day', '2024-01-12', '2024-01-16'],
    ['2024-02-19', "Presidents' Day", '2024-02-16', '2024-02-20'],
    ['2024-03-29', 'Good Friday', '2024-03-28', '2024-04-01'],
    ['2024-05-27', 'Memorial Day', '2024-05-24', '2024-05-28'],
    ['2024-06-19', 'Juneteenth', '2024-06-18', '2024-06-20'],
    ['2024-07-04', 'Independence Day', '2024-07-03', '2024-07-05'],
    ['2024-09-02', 'Labor Day', '2024-08-30', '2024-09-03'],
    ['2024-11-28', 'Thanksgiving Day', '2024-11-27', '2024-11-29'],
    ['2024-12-25', 'Christmas Day', '2024-12-24', '2024-12-26'],
  ]);
  // a Saturday New Year is not observed on the Friday; Juneteenth only from 2022
  assert.equal(dayKind('2021-12-31'), 'open');
  assert.equal(dayKind('2021-06-18'), 'open');
  assert.equal(dayKind('2022-06-20'), 'holiday');
  // a Sunday Christmas is observed on the Monday; Christmas Eve is a half (trading) day
  assert.equal(dayKind('2022-12-26'), 'holiday');
  assert.equal(dayKind('2024-12-24'), 'half'); assert.ok(isTradingDay('2024-12-24'));
  // unscheduled closures are not holidays and not trading days
  assert.equal(dayKind('2025-01-09'), 'special'); assert.ok(!isTradingDay('2025-01-09'));
  assert.ok(!holidayEvents('2012-10-01', '2012-10-31').length);
  // holidays a year: 9 before Juneteenth, 10 from 2022 (fewer when New Year falls on a Saturday)
  assert.equal(holidayEvents('2019-01-01', '2019-12-31').length, 9);
  assert.equal(holidayEvents('2023-01-01', '2023-12-31').length, 10);
});

test('every leg has a stop at 1.5 x ATR: a gap fills at the open, a wick at the stop', () => {
  const leg = LEGS[0];
  assert.ok(Math.abs(atr(bars(25), 23) - 0.002) < 1e-12);
  const gap = legDay(bars(25, { open: 1.09, low: 1.08, high: 1.09, close: 1.085 }), 24, leg, 1, { swaps: null });
  assert.equal(gap.kind, 'gap'); assert.ok(Math.abs(gap.gross - (1.09 - 1.1) / 1.1) < 1e-12);
  const wick = legDay(bars(25, { open: 1.1, low: 1.096, high: 1.1, close: 1.1 }), 24, leg, 1, { swaps: null });
  assert.equal(wick.kind, 'stop'); assert.ok(Math.abs(wick.grossR + 1) < 1e-9);
  const inside = legDay(bars(25, { open: 1.1, low: 1.0975, high: 1.1, close: 1.1 }), 24, leg, 1, { swaps: null });
  assert.equal(inside.kind, 'close');
});

test('costs: one spread + commission round trip, doubled at 2x, none at 0', () => {
  const b = bars(25), x = (c) => legDay(b, 24, LEGS[0], 1, { swaps: null, costMult: c });
  assert.ok(Math.abs(x(1).cost - (0.3 * 0.0001 / 1.1 + 0.000045)) < 1e-15);
  assert.ok(Math.abs(x(2).cost - 2 * x(1).cost) < 1e-15);
  assert.equal(x(0).cost, 0);
});

test('month sums and the placebo draw per year', () => {
  const ms = monthSums([{ ymd: '2020-01-02', v: 1 }, { ymd: '2020-01-20', v: 1 }, { ymd: '2020-02-14', v: 4 }], (r) => r.v);
  assert.equal(ms.months, 2);
  const mk = (ymd, r) => ({ ymd, L1: { netR: r }, S1: { netR: -r } });
  const ord = [mk('2020-03-03', 1), mk('2020-03-04', 1), mk('2021-03-03', 2)];
  const pl = placebo([mk('2020-05-05', 0), mk('2020-06-05', 0), mk('2021-06-05', 0)], ord, 1, 3);
  for (const x of pl) { assert.equal(x.n, 3); assert.ok(Math.abs(x.meanR - 4 / 3) < 1e-12); }
});

test('result.json: verdict follows the pass bar, and RESULT.md is the report of it', () => {
  const po = R.pre.outOfSample, pi = R.pre.inSample, T = R.tests;
  assert.equal(T.T1, po.netR > 0 && po.t >= 2 && po.monthT >= 2);
  assert.equal(T.T2, pi.netR > 0);
  assert.equal(T.T3, po.netR2 > 0);
  assert.equal(T.T4, R.placebo.beaten >= 38);
  assert.equal(R.placebo.beaten, R.placebo.seedNetR.filter((x) => R.placebo.realNetR > x).length);
  assert.equal(R.verdict, T.T1 && T.T2 && T.T3 && T.T4 ? 'PASS' : 'FAIL');
  // the side is the sign of the in-sample gross long-USD mean
  assert.equal(R.pre.side, pi.grossPctLongUsd >= 0 ? 'long USD' : 'short USD');
  assert.equal(R.verdict, 'FAIL');
  assert.equal(R.headline, headline(R));
  const md = fs.readFileSync(new URL('RESULT.md', DIR), 'utf8');
  assert.equal(md, report(R));
  const line = md.split('\n').find((l) => l.startsWith('**Verdict: '));
  assert.ok(line.startsWith(`**Verdict: ${R.verdict}**`));
  assert.ok(line.length < 220, 'opening sentence under 220 characters');
  // every holiday's trade is in the file, one per pre-holiday day
  assert.equal(R.trades.length, pi.n + po.n);
  assert.equal(new Set(R.trades.map((t) => t.ymd)).size, R.trades.length);
  for (const t of R.trades) assert.ok(t.entry < t.ymd);
});
