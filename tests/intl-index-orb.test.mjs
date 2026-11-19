// research/edge/intl-index-orb: orb-nas100's 5-minute opening range breakout at the European and Asian cash opens. Offline:
// the clocks on fixed dates (each DST switch), the calendars, the trade on hand-made candles, no look-ahead, the statistics,
// and RESULT.md against result.json.
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { localTime, offsetH, dayKind, dayTrade, closeOf, monthT, holm, quantile, rng, report, decide, testOf, MARKETS, TESTS } from '../research/edge/intl-index-orb/run.mjs';

const DIR = new URL('../research/edge/intl-index-orb/', import.meta.url);
const iso = (t) => new Date(t * 1000).toISOString().slice(0, 16);
const U = (y, m, d, h, mi = 0) => Date.UTC(y, m, d, h, mi) / 1000;

test('intl-index-orb: Frankfurt / Paris 09:00 and London 08:00 in UTC across the EU switches', () => {
  assert.equal(iso(localTime('cet', 2024, 2, 29, 9, 0)), '2024-03-29T08:00');   // Friday before the last Sunday of March: CET
  assert.equal(iso(localTime('cet', 2024, 3, 1, 9, 0)), '2024-04-01T07:00');    // Monday after: CEST
  assert.equal(iso(localTime('cet', 2024, 9, 25, 9, 0)), '2024-10-25T07:00');   // Friday before the last Sunday of October: CEST
  assert.equal(iso(localTime('cet', 2024, 9, 28, 9, 0)), '2024-10-28T08:00');   // Monday after: CET
  assert.equal(iso(localTime('cet', 2026, 2, 13, 9, 0)), '2026-03-13T08:00');   // US already on summer time, Europe not
  assert.equal(iso(localTime('cet', 2016, 5, 1, 17, 30)), '2016-06-01T15:30');
  assert.equal(iso(localTime('uk', 2024, 0, 15, 8, 0)), '2024-01-15T08:00');
  assert.equal(iso(localTime('uk', 2024, 6, 15, 8, 0)), '2024-07-15T07:00');
  assert.equal(iso(localTime('uk', 2024, 6, 15, 16, 30)), '2024-07-15T15:30');
  assert.equal(offsetH('cet', U(2025, 2, 30, 0, 59)), 1);
  assert.equal(offsetH('cet', U(2025, 2, 30, 1, 0)), 2);
  assert.equal(offsetH('uk', U(2025, 9, 26, 0, 59)), 1);
  assert.equal(offsetH('uk', U(2025, 9, 26, 1, 0)), 0);
});

test('intl-index-orb: Tokyo 09:00 (no DST, 15:30 close from 5 Nov 2024) and Sydney 10:00 across the AU switches', () => {
  assert.equal(iso(localTime('jst', 2024, 6, 15, 9, 0)), '2024-07-15T00:00');
  assert.equal(iso(localTime('jst', 2024, 0, 15, 9, 0)), '2024-01-15T00:00');
  assert.deepEqual(closeOf('jp225', '2024-11-01'), [15, 0]);
  assert.deepEqual(closeOf('jp225', '2024-11-05'), [15, 30]);
  assert.equal(iso(localTime('syd', 2024, 0, 15, 10, 0)), '2024-01-14T23:00');  // AEDT: the previous UTC day
  assert.equal(iso(localTime('syd', 2024, 3, 5, 10, 0)), '2024-04-04T23:00');   // Friday before the first Sunday of April: AEDT
  assert.equal(iso(localTime('syd', 2024, 3, 8, 10, 0)), '2024-04-08T00:00');   // Monday after: AEST
  assert.equal(iso(localTime('syd', 2024, 9, 4, 10, 0)), '2024-10-04T00:00');   // Friday before the first Sunday of October: AEST
  assert.equal(iso(localTime('syd', 2024, 9, 7, 10, 0)), '2024-10-06T23:00');   // Monday after: AEDT
  assert.equal(offsetH('syd', U(2025, 3, 5, 15, 59)), 11);                       // Sunday 6 Apr 2025 03:00 AEDT = Sat 16:00 UTC
  assert.equal(offsetH('syd', U(2025, 3, 5, 16, 0)), 10);
  assert.equal(offsetH('syd', U(2025, 9, 4, 15, 59)), 10);                       // Sunday 5 Oct 2025 02:00 AEST = Sat 16:00 UTC
  assert.equal(offsetH('syd', U(2025, 9, 4, 16, 0)), 11);
});

test('intl-index-orb: exchange holidays and early closes', () => {
  assert.equal(dayKind('de40', 2025, 3, 18), 'holiday');   // Good Friday
  assert.equal(dayKind('de40', 2025, 11, 24), 'holiday');  // Xetra closed on 24 Dec
  assert.equal(dayKind('eu50', 2025, 11, 31), 'holiday');
  assert.equal(dayKind('fr40', 2025, 11, 24), 'early');    // Euronext early close
  assert.equal(dayKind('fr40', 2025, 4, 1), 'holiday');    // 1 May
  assert.equal(dayKind('uk100', 2025, 4, 5), 'holiday');   // early May bank holiday
  assert.equal(dayKind('uk100', 2025, 11, 31), 'early');
  assert.equal(dayKind('uk100', 2025, 4, 1), 'trade');     // 1 May is a trading day in London
  assert.equal(dayKind('jp225', 2025, 0, 2), 'holiday');
  assert.equal(dayKind('jp225', 2025, 10, 24), 'holiday'); // Labour Thanksgiving on a Sunday -> Monday
  assert.equal(dayKind('au200', 2025, 3, 25), 'holiday');  // Anzac Day
  assert.equal(dayKind('au200', 2025, 11, 24), 'early');
  assert.equal(dayKind('au200', 2025, 10, 15), 'weekend');
  assert.equal(dayKind('de40', 2025, 10, 14), 'trade');
});

// one winter day in Frankfurt (Wed 15 Jan 2025): F is the 09:00 candle (08:00 UTC), candles from 09:05 to 17:25
const Y = 2025, M = 0, D = 15, T0 = localTime('cet', Y, M, D, 9, 0);
function day(F, rest, t0 = T0) {
  const m = new Map([[t0, [t0, ...F]]]);
  rest.forEach((b, i) => { if (b) m.set(t0 + 300 * (i + 1), [t0 + 300 * (i + 1), ...b]); });
  return m;
}

test('intl-index-orb: a buy after an up candle, out at the 17:25 close; candles at or after 17:30 are never read', () => {
  const rest = Array.from({ length: 120 }, () => [101, 102, 100.5, 101.5]);
  rest[100] = [101, 103, 100.5, 102.5];                                          // 17:25, its close is the exit
  rest[101] = [102.5, 200, 0, 150];                                              // 17:30: after the cash close, must not count
  const x = dayTrade(day([100, 101, 99, 100.8], rest), 'de40', Y, M, D, { cost: 2 });
  assert.equal(iso(T0 + 300 * 101), iso(localTime('cet', Y, M, D, 17, 25)));
  assert.equal(x.side, 1); assert.equal(x.entry, 101); assert.equal(x.stop, 99); assert.equal(x.r, 2); assert.equal(x.target, 121);
  assert.equal(x.how, 'time'); assert.equal(x.exit, 102.5); assert.equal(x.R, 0.75); assert.equal(x.net, -0.25);
});

test('intl-index-orb: no look-ahead: changing every candle after the exit changes nothing, and candles before the open are not read', () => {
  const base = [[99.5, 99.6, 99.2, 99.3], [99.3, 99.4, 89.0, 90]];
  const a = dayTrade(day([100, 100.5, 99, 99.5], base), 'de40', Y, M, D);
  const b = day([100, 100.5, 99, 99.5], [...base, [90, 500, 1, 300], [300, 900, 2, 3]]);
  b.set(T0 - 300, [T0 - 300, 1, 1000, 0.5, 2]);
  assert.deepEqual(dayTrade(b, 'de40', Y, M, D), a);
  assert.equal(a.side, -1); assert.equal(a.how, 'target'); assert.equal(a.R, 10);
});

test('intl-index-orb: stop first in one candle, a gap fills at the open, doji / missing / no risk skip, a forced side uses its own stop', () => {
  assert.equal(dayTrade(day([100, 101, 99.5, 100.9], [[101, 120, 99, 110]]), 'de40', Y, M, D).how, 'stop');
  const gap = dayTrade(day([100, 101, 99.5, 100.9], [[101, 101.2, 100.6, 100.8], [98, 98.5, 97.5, 98]]), 'de40', Y, M, D);
  assert.equal(gap.exit, 98); assert.equal(gap.R, -2);
  assert.equal(dayTrade(day([100, 101, 99, 100], [[100, 101, 99, 100]]), 'de40', Y, M, D).skip, 'doji');
  assert.equal(dayTrade(day([100, 101, 99, 100.5], []), 'de40', Y, M, D).skip, 'missing');
  assert.equal(dayTrade(day([100, 101, 99, 100.5], [[98.9, 99, 98, 98.5]]), 'de40', Y, M, D).skip, 'norisk');
  const s = dayTrade(day([100, 101, 99, 100.5], [[100.5, 100.6, 100.4, 100.5]]), 'de40', Y, M, D, { side: -1 });
  assert.equal(s.stop, 101); assert.equal(s.r, 0.5);
  // the same candles placed at the Sydney 10:00 open are read for au200, not at Frankfurt's
  const tS = localTime('syd', Y, M, D, 10, 0);
  assert.equal(dayTrade(day([100, 101, 99, 100.8], [[101, 101, 101, 101]], tS), 'au200', Y, M, D).side, 1);
  assert.equal(dayTrade(day([100, 101, 99, 100.8], [[101, 101, 101, 101]], tS), 'de40', Y, M, D).skip, 'missing');
});

test('intl-index-orb: statistics, pooled tests and the decision', () => {
  const tr = [['2021-01-04', 1], ['2021-01-05', 1], ['2021-02-01', 0], ['2021-03-01', 1]].map(([day, net]) => ({ day, net }));
  const m = monthT(tr); assert.equal(m.months, 3); assert.ok(Math.abs(m.t - Math.sqrt(3)) < 1e-9);
  assert.deepEqual(holm([0.01, 0.04]), [0.02, 0.04]);
  assert.equal(quantile([...Array(40).keys()], 0.95), 37.05);
  const a = rng(7), b = rng(7); assert.equal(a(), b());
  const mk = (day, R, r = 1) => ({ day, t: Date.parse(day) / 1000, R, r, net: R - 1 / r, cost: 1, spread: 0.5, how: 'time', side: 1 });
  const runs = { x: { trades: [mk('2018-01-02', 2), mk('2021-01-04', 2)], placebo: Array.from({ length: 40 }, () => [mk('2021-01-04', -1)]) },
    y: { trades: [mk('2021-02-01', 3)], placebo: Array.from({ length: 40 }, () => [mk('2021-02-01', 0)]) } };
  const t = testOf(runs, ['x', 'y']);
  assert.equal(t.windows.B.n, 2); assert.equal(t.windows.A.n, 1); assert.equal(t.windows.B.netR, 1.5); assert.equal(t.windows.B.net2R, 0.5);
  assert.equal(t.placebo.p95, -1.5);
  assert.deepEqual(TESTS.map((x) => x[0]), ['T1', 'T2', 'T3', 'T4', 'T5', 'T6', 'T7', 'T8']);
  assert.deepEqual(TESTS[0][2], ['de40', 'eu50', 'fr40', 'uk100']);
  assert.equal(MARKETS.jp225.cost, 18); assert.equal(MARKETS.uk100.open[0], 8); assert.equal(MARKETS.au200.open[0], 10);
});

test('intl-index-orb: result.json and RESULT.md agree; the verdict line is short and carries its reason', () => {
  const R = JSON.parse(fs.readFileSync(new URL('result.json', DIR), 'utf8'));
  assert.equal(fs.readFileSync(new URL('RESULT.md', DIR), 'utf8'), report(R));
  assert.deepEqual(decide(R.tests), R.decision);
  assert.ok(R.verdict.length < 220, R.verdict);
  assert.ok(R.verdict.startsWith(R.decision.verdict + ':'));
  assert.equal(R.decision.verdict, R.decision.byTest.T1.pass ? 'PASS' : 'FAIL');
  for (const [id] of TESTS) assert.ok(R.tests[id] && R.tests[id].placebo.values.length === 40, id);
  assert.ok(fs.readFileSync(new URL('RESULT.md', DIR), 'utf8').includes(`**Verdict: ${R.verdict}**`));
});
