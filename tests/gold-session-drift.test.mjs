// Gold session drift (research/edge/gold-session-drift): a stand-alone intraday clock rule, not a gate of the gold book.
// Offline: session boundaries in UTC, skipped days, the 50-day filter without look-ahead, the stop and its gap fill, costs and
// financing, the statistics, and the report against result.json.
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { TESTS, H, D, COST, isTradeDay, windowAt, sessions, trades, simulate, dailyCloses, trendAt, monthSums, stats, holm, tCdf, pctl, placebo, ymd } from '../research/edge/gold-session-drift/run.mjs';
import { nights } from '../council/fills.mjs';

const day = (s) => Date.parse(s + 'T00:00:00Z') / 1000 / D;
// hourly candles on every hour from `from` for `n` days; price drifts by `step` an hour
function candles(from, n, step = 0.1, skip = () => false) {
  const out = []; let p = 2000;
  for (let t = day(from) * D; t < (day(from) + n) * D; t += H) { if (skip(t)) continue; out.push({ time: t, open: p, high: p + 1, low: p - 1, close: p + step }); p += step; }
  return out;
}

test('session boundaries in UTC: T1 13:00 -> 21:00 of D, T2 23:00 of D-1 -> 07:00 of D, eight candles each', () => {
  const h1 = candles('2024-03-01', 40), by = new Map(h1.map((b) => [b.time, b])), d = day('2024-03-13');
  const [s1] = sessions(by, d, d, TESTS.T1.off), [s2] = sessions(by, d, d, TESTS.T2.off);
  assert.equal(new Date(s1.start * 1000).toISOString(), '2024-03-13T13:00:00.000Z');
  assert.equal(new Date((s1.cs.at(-1).time + H) * 1000).toISOString(), '2024-03-13T21:00:00.000Z');
  assert.equal(new Date(s2.start * 1000).toISOString(), '2024-03-12T23:00:00.000Z');
  assert.equal(new Date((s2.cs.at(-1).time + H) * 1000).toISOString(), '2024-03-13T07:00:00.000Z');
  assert.equal(s1.cs.length, 8); assert.equal(s2.cs.length, 8);
  assert.equal(TESTS.T3.off, TESTS.T1.off); assert.equal(TESTS.T1.side, -1); assert.equal(TESTS.T2.side, 1);
  assert.equal(TESTS.R0.test, false, 'the H5 window is a reference, not a test');
});

test('weekends, 25 Dec, 1 Jan and incomplete windows are skipped', () => {
  assert.equal(isTradeDay(day('2024-03-16')), false); assert.equal(isTradeDay(day('2024-03-17')), false);
  assert.equal(isTradeDay(day('2024-12-25')), false); assert.equal(isTradeDay(day('2025-01-01')), false);
  assert.equal(isTradeDay(day('2024-12-24')), true);
  const hole = day('2024-03-14') * D + 15 * H, h1 = candles('2024-03-01', 30, 0.1, (t) => t === hole), by = new Map(h1.map((b) => [b.time, b]));
  assert.equal(windowAt(by, day('2024-03-14') * D + 13 * H), null);
  const ds = sessions(by, day('2024-03-11'), day('2024-03-17'), 13).map((s) => ymd(s.d));
  assert.deepEqual(ds, ['2024-03-11', '2024-03-12', '2024-03-13', '2024-03-15']);
});

test('the 50-day filter reads only closes that ended by the entry', () => {
  const h1 = candles('2024-01-01', 120), dc = dailyCloses(h1);
  assert.ok(dc.every((x) => (x.end - H) % D === 20 * H), 'the 20:00 UTC candle');
  const t = day('2024-04-10') * D + 13 * H, a = trendAt(dc, t);
  assert.equal(a.end, day('2024-04-09') * D + 21 * H, 'a 13:00 entry reads the previous day');
  const changed = dc.map((x) => x.end > t ? { ...x, close: 1e6 } : x);
  assert.deepEqual(trendAt(changed, t), a);
  const mon = trendAt(dc, day('2024-04-15') * D - H);   // Sunday 23:00 entry for Monday's long
  assert.equal(ymd(Math.floor(mon.end / D)), '2024-04-12', 'Friday');
  assert.equal(trendAt(dc.slice(0, 10), t), null, 'too few closes');
});

test('the stop: every trade has one; touch fills at the stop, a gap through fills at the open', () => {
  const c = (o, h, l, cl) => ({ open: o, high: h, low: l, close: cl });
  const touch = simulate([c(100, 101, 99, 100), c(100, 100, 94, 95), c(95, 96, 90, 91)], 1, 5);
  assert.equal(touch.stop, 95); assert.equal(touch.exit, 95); assert.equal(touch.how, 'stop'); assert.equal(touch.R, -1);
  const gap = simulate([c(100, 101, 99, 99), c(92, 93, 90, 91)], 1, 5);
  assert.equal(gap.exit, 92); assert.equal(+gap.R.toFixed(6), -1.6);
  const sgap = simulate([c(100, 101, 99, 101), c(108, 109, 107, 108)], -1, 5);
  assert.equal(sgap.stop, 105); assert.equal(sgap.exit, 108); assert.equal(+sgap.R.toFixed(6), -1.6);
  const time = simulate([c(100, 101, 99, 100), c(100, 103, 99, 102.5)], 1, 5);
  assert.equal(time.how, 'time'); assert.equal(time.R, 0.5);
  const h1 = candles('2024-01-01', 60), by = new Map(h1.map((b) => [b.time, b])), ss = sessions(by, day('2024-01-02'), day('2024-02-28'), 13);
  const T = trades(ss, -1);
  assert.ok(T.length > 10 && T.every((x) => x.dist > 0 && x.stop > x.entry), 'a short\'s stop above its entry');
  assert.equal(T[0].d, ss[20].d, 'no trade before 20 sessions');
  assert.equal(+T[0].dist.toFixed(6), +(1.5 * (2 + 0.7)).toFixed(6), '1.5 x the median range of the 20 before');
});

test('costs: $0.30 a round trip in R, no financing night for either session', () => {
  const h1 = candles('2024-01-01', 60), by = new Map(h1.map((b) => [b.time, b]));
  for (const off of [13, -1]) for (const x of trades(sessions(by, day('2024-01-02'), day('2024-02-28'), off), off < 0 ? 1 : -1)) {
    assert.equal(x.nights, 0); assert.equal(x.fin, 0); assert.ok(Math.abs(x.net - (x.R - COST / x.dist)) < 1e-12); }
  for (let d = day('2023-01-02'); d < day('2025-01-01'); d++) { if (!isTradeDay(d)) continue;
    assert.equal(nights(d * D + 13 * H, d * D + 21 * H), 0); assert.equal(nights(d * D - H, d * D + 7 * H), 0); }
  const s = sessions(by, day('2024-01-02'), day('2024-02-28'), 20);
  assert.ok(trades(s, 1).every((x) => x.nights >= 1 && x.fin > 0), 'a placebo long over 22:00 UTC pays financing');
});

test('statistics: month sums count empty months, Holm, the t distribution, percentiles', () => {
  assert.deepEqual(monthSums([{ d: day('2024-01-05'), net: 1 }, { d: day('2024-03-05'), net: -0.5 }], '2024-01-01', '2024-03-31'), [1, 0, -0.5]);
  const s = stats([{ d: day('2024-01-05'), net: 1, R: 1.1, dist: 3, how: 'time', nights: 0 }, { d: day('2024-02-05'), net: 2, R: 2.1, dist: 3, how: 'stop', nights: 0 }], '2024-01-01', '2024-02-29');
  assert.equal(s.n, 2); assert.equal(s.months, 2); assert.equal(s.stopped, 1); assert.equal(s.t, 3);
  assert.deepEqual(holm({ a: 0.01, b: 0.02, c: 0.03 }), { a: true, b: true, c: true });
  assert.deepEqual(holm({ a: 0.01, b: 0.04, c: 0.03 }), { a: true, b: false, c: false });
  assert.ok(Math.abs(tCdf(1.96, 1e6) - 0.975) < 1e-3); assert.ok(Math.abs(tCdf(2.0, 10) - 0.9633) < 1e-3); assert.equal(tCdf(0, 5), 0.5);
  assert.equal(pctl([1, 2, 3, 4, 5], 0.5), 3); assert.equal(pctl([0, 10], 0.95), 9.5);
});

test('placebo: never the test\'s own hour, repeatable by seed', () => {
  const h1 = candles('2024-01-01', 80), by = new Map(h1.map((b) => [b.time, b])), d0 = day('2024-01-02'), d1 = day('2024-03-20');
  const byOff = {}; for (let h = 0; h < 24; h++) byOff[h] = sessions(by, d0, d1, h);
  byOff[13] = null;   // the test's own hour: reading it would throw
  const days = byOff[2].slice(25).map((s) => s.d), a = placebo(TESTS.T1, days, byOff, 3), b = placebo(TESTS.T1, days, byOff, 3);
  assert.deepEqual(a, b); assert.equal(a.length, 3); assert.ok(a.every((x) => x.n > 0));
});

test('the report says what result.json holds: FAIL, 0 of 3, not a gate of the gold book', () => {
  const r = JSON.parse(fs.readFileSync(new URL('../research/edge/gold-session-drift/result.json', import.meta.url)));
  const md = fs.readFileSync(new URL('../research/edge/gold-session-drift/RESULT.md', import.meta.url), 'utf8');
  const pre = fs.readFileSync(new URL('../research/edge/gold-session-drift/PREREGISTRATION.md', import.meta.url), 'utf8');
  assert.equal(r.verdict, 'FAIL'); assert.equal(r.passed, 0); assert.match(md, /^\*\*Verdict: FAIL, 0 of 3 tests pass\.\*\*/m);
  assert.deepEqual(Object.keys(r.tests), ['T1', 'T2', 'T3']); assert.deepEqual(Object.keys(r.ref), ['R0']);
  assert.deepEqual(r.financing, { T1: 0, T2: 0, rule: 'council/fills.mjs nights: rollovers at 22:00 UTC' });
  const sgn = (v, d) => (v > 0 ? '+' : v < 0 ? '−' : '') + Math.abs(v).toFixed(d), int = (n) => n.toLocaleString('en-US');
  for (const g of [r.tests, r.ref]) for (const row of Object.values(g)) for (const k of ['decisive', 'replication']) {
    const x = row[k]; assert.ok(md.includes(`| ${int(x.n)} | ${sgn(x.avg, 4)} | ${sgn(x.gross, 4)} | ${sgn(x.total, 2)} | ${sgn(x.t, 2).replace(/^\+/, '')} |`), `${row.name} ${k}`); }
  for (const [id, row] of Object.entries(r.tests)) {
    assert.equal(row.pass, false);
    const P = row.placebo; assert.equal(P.seeds, 40);
    assert.ok(md.includes(`| ${id} | ${sgn(row.decisive.avg, 4)} | ${sgn(P.median, 4)} | ${sgn(P.p95, 4)} | ${sgn(P.max, 4)} | ${P.above} of 40 |`), `placebo ${id}`);
  }
  for (const t of [md, pre]) assert.match(t, /not a gate, exit, entry or size of the gold book/);
  assert.match(pre, /same window as H5 and is dropped from the tests/);
});
