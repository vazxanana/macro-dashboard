// research/edge/orb-nas100: the 5-minute opening range breakout study. Offline: the calendar on fixed dates, the trade on
// hand-made candles, the statistics, and RESULT.md against result.json.
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { nyTime, nyOffsetH, nyse, dayKind, dayTrade, monthT, holm, quantile, rng, report, decide, COST } from '../research/edge/orb-nas100/run.mjs';

const DIR = new URL('../research/edge/orb-nas100/', import.meta.url);
const iso = (t) => new Date(t * 1000).toISOString().slice(0, 16);

test('orb-nas100: the 09:30 New York candle in UTC, DST-correct (US and Europe mismatch weeks included)', () => {
  assert.equal(iso(nyTime(2026, 2, 6, 9, 30)), '2026-03-06T14:30');   // Friday before the US switch: EST
  assert.equal(iso(nyTime(2026, 2, 9, 9, 30)), '2026-03-09T13:30');   // Monday after the second Sunday of March: EDT
  assert.equal(iso(nyTime(2026, 9, 30, 9, 30)), '2026-10-30T13:30');  // Europe already back on winter time, US still EDT
  assert.equal(iso(nyTime(2026, 10, 2, 9, 30)), '2026-11-02T14:30');  // after the first Sunday of November: EST
  assert.equal(iso(nyTime(2016, 0, 4, 9, 30)), '2016-01-04T14:30');
  assert.equal(iso(nyTime(2016, 6, 1, 16, 0)), '2016-07-01T20:00');
  assert.equal(nyOffsetH(Date.UTC(2021, 2, 14, 6, 59) / 1000), -5);
  assert.equal(nyOffsetH(Date.UTC(2021, 2, 14, 7, 0) / 1000), -4);
});

test('orb-nas100: NYSE holidays and early closes', () => {
  const c = (y) => nyse(y).closed, e = (y) => nyse(y).early;
  for (const d of ['2016-03-25', '2018-12-05', '2020-07-03', '2021-07-05', '2021-12-24', '2022-06-20', '2025-01-09', '2026-07-03', '2026-11-26'])
    assert.ok(c(+d.slice(0, 4)).has(d), d);
  assert.ok(!c(2021).has('2021-12-31'));   // New Year on a Saturday is not observed on the Friday
  assert.ok(!c(2021).has('2021-06-18'));   // Juneteenth from 2022 only
  for (const d of ['2018-07-03', '2019-12-24', '2024-07-03', '2025-11-28', '2026-12-24']) assert.ok(e(+d.slice(0, 4)).has(d), d);
  assert.ok(!e(2020).has('2020-07-03') && !e(2021).has('2021-12-24'));
  assert.equal(dayKind(2025, 0, 9), 'holiday');
  assert.equal(dayKind(2025, 10, 28), 'early');
  assert.equal(dayKind(2025, 10, 29), 'weekend');
  assert.equal(dayKind(2025, 10, 25), 'trade');
});

// one summer day (Tue 10 Jun 2025): F is the 09:30 candle, then candles from 09:35
const Y = 2025, M = 5, D = 10, T0 = nyTime(Y, M, D, 9, 30);
function day(F, rest) {
  const m = new Map([[T0, [T0, ...F]]]);
  rest.forEach((b, i) => { if (b) m.set(T0 + 300 * (i + 1), [T0 + 300 * (i + 1), ...b]); });
  return m;
}

test('orb-nas100: a buy after an up candle, stop at its low, out at the 15:55 close', () => {
  const rest = Array.from({ length: 77 }, () => [101, 102, 100.5, 101.5]);
  rest[76] = [101, 103, 100.5, 102.5];                                         // 15:55, its close is the exit
  const x = dayTrade(day([100, 101, 99, 100.8], rest), Y, M, D, { cost: COST.spx500 });
  assert.equal(iso(T0 + 300 * 77), iso(nyTime(Y, M, D, 15, 55)));
  assert.equal(x.side, 1); assert.equal(x.entry, 101); assert.equal(x.stop, 99); assert.equal(x.r, 2); assert.equal(x.target, 121);
  assert.equal(x.how, 'time'); assert.equal(x.exit, 102.5); assert.equal(x.R, 0.75); assert.equal(x.net, 0.25);
});

test('orb-nas100: a sell after a down candle hits its 10R target', () => {
  const x = dayTrade(day([100, 100.5, 99, 99.5], [[99.5, 99.6, 99.2, 99.3], [99.3, 99.4, 89.0, 90]]), Y, M, D);
  assert.equal(x.side, -1); assert.equal(x.stop, 100.5); assert.equal(x.r, 1); assert.equal(x.target, 89.5);
  assert.equal(x.how, 'target'); assert.equal(x.R, 10);
});

test('orb-nas100: one candle with both stop and target exits at the stop; a gap through the stop fills at the open', () => {
  const both = dayTrade(day([100, 101, 99.5, 100.9], [[101, 120, 99, 110]]), Y, M, D);   // r 1.5, target 116
  assert.equal(both.how, 'stop'); assert.equal(both.R, -1);
  const gap = dayTrade(day([100, 101, 99.5, 100.9], [[101, 101.2, 100.6, 100.8], [98, 98.5, 97.5, 98]]), Y, M, D);
  assert.equal(gap.how, 'stop'); assert.equal(gap.exit, 98); assert.equal(gap.R, -2);
});

test('orb-nas100: doji, a missing candle and an entry past the stop are no trade; a forced side uses its own stop', () => {
  assert.equal(dayTrade(day([100, 101, 99, 100], [[100, 101, 99, 100]]), Y, M, D).skip, 'doji');
  assert.equal(dayTrade(day([100, 101, 99, 100.5], []), Y, M, D).skip, 'missing');
  assert.equal(dayTrade(day([100, 101, 99, 100.5], [[98.9, 99, 98, 98.5]]), Y, M, D).skip, 'norisk');
  const s = dayTrade(day([100, 101, 99, 100.5], [[100.5, 100.6, 100.4, 100.5]]), Y, M, D, { side: -1 });
  assert.equal(s.side, -1); assert.equal(s.stop, 101); assert.equal(s.r, 0.5);
});

test('orb-nas100: statistics (monthly t, Holm, quantile, seeded generator)', () => {
  const tr = [['2021-01-04', 1], ['2021-01-05', 1], ['2021-02-01', 0], ['2021-03-01', 1]].map(([day, net]) => ({ day, net }));
  const m = monthT(tr); assert.equal(m.months, 3); assert.ok(Math.abs(m.t - 1 / (1 / Math.sqrt(3))) < 1e-9);
  assert.deepEqual(holm([0.01, 0.04]), [0.02, 0.04]);
  assert.deepEqual(holm([0.04, 0.03]), [0.06, 0.06]);
  assert.equal(quantile([...Array(40).keys()], 0.95), 37.05);
  const a = rng(7), b = rng(7); assert.equal(a(), b());
});

test('orb-nas100: RESULT.md is the report of result.json, and the verdict follows the pre-registered bar', () => {
  const R = JSON.parse(fs.readFileSync(new URL('result.json', DIR), 'utf8'));
  assert.equal(fs.readFileSync(new URL('RESULT.md', DIR), 'utf8'), report(R));
  assert.deepEqual(decide(R.markets), R.decision);
  assert.ok(R.verdict.startsWith(R.decision.verdict + ':'));
  assert.ok(fs.readFileSync(new URL('RESULT.md', DIR), 'utf8').includes(`## Verdict: ${R.verdict}`));
  for (const k of ['nas100', 'spx500']) { assert.equal(R.markets[k].placebo.values.length, 40); assert.equal(R.markets[k].costPts, COST[k]); }
  assert.ok(fs.readFileSync(new URL('PREREGISTRATION.md', DIR), 'utf8').includes('January 2016 to February 2023'));
});
