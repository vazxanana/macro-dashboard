// Pre-FOMC drift study (research/edge/pre-fomc-drift): the event list and its DST-correct times, entry 24 h before and exit
// 5 min before the statement, a stop under every entry, no look-ahead, costs and financing, the placebo's stand-in dates,
// and the written report against result.json. Offline.
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { P, timesOf, toBars, lastEnding, nyDays, atrAt, rollovers, trade, stat, quantile, standIns, judge, verdictOf, report, nyDate } from '../research/edge/pre-fomc-drift/run.mjs';
import { fomcEvents, ALL_ANNOUNCE, UNSCHEDULED, clockOf } from '../research/edge/pre-fomc-drift/events.mjs';

const rd = (p) => fs.readFileSync(new URL(p, import.meta.url), 'utf8');
const PRE = rd('../research/edge/pre-fomc-drift/PREREGISTRATION.md');
const U = (s) => Date.parse(s) / 1000;
const near = (a, b, e = 1e-9) => assert.ok(Math.abs(a - b) < e, `${a} vs ${b}`);

test('the constants are the pre-registered ones', () => {
  assert.deepEqual([P.K, P.ATR, P.HOLD, P.PRE, P.FIN_YEAR, P.SEEDS, P.EXCL_DAYS, P.Q], [1.5, 14, 86400, 300, 0.06, 40, 3, 0.95]);
  assert.deepEqual(P.COST, { spx500: 1.0, nas100: 2.0, xau: 0.5 });
  assert.match(PRE, /\*\*1\.0 index point\*\*/); assert.match(PRE, /\*\*2\.0 points\*\*/); assert.match(PRE, /\*\*\$0\.50\*\*/);
  assert.match(PRE, /\*\*6 % a year/); assert.match(PRE, /t ≥ 2/);
  assert.equal(P.WIN.B[0], U('2016-01-01T00:00:00Z'));
});

test('the event list: scheduled only, DST-correct statement times', () => {
  const E = fomcEvents(), by = Object.fromEntries(E.map((e) => [e.date, e]));
  for (const d of UNSCHEDULED) assert.ok(!by[d], d);
  assert.ok(!E.some((e) => e.date.startsWith('2020-03')), 'no March 2020 statement');
  assert.equal(new Set(E.map((e) => e.date)).size, E.length);
  // winter and summer, each statement clock
  assert.equal(by['2008-01-30'].T, U('2008-01-30T19:15:00Z'));   // 14:15 EST
  assert.equal(by['2011-04-27'].T, U('2011-04-27T16:30:00Z'));   // 12:30 EDT, press conference
  assert.equal(by['2012-12-12'].T, U('2012-12-12T17:30:00Z'));   // 12:30 EST
  assert.equal(by['2013-01-30'].T, U('2013-01-30T19:00:00Z'));   // 14:00 EST from 2013
  assert.equal(by['2026-03-18'].T, U('2026-03-18T18:00:00Z'));   // 10 days after the US switch: EDT
  assert.equal(by['2025-10-29'].T, U('2025-10-29T18:00:00Z'));   // 4 days before the switch back: EDT
  assert.equal(by['2024-11-07'].T, U('2024-11-07T19:00:00Z'));   // after it: EST
  assert.equal(clockOf('2012-03-13'), '14:15'); assert.equal(clockOf('2019-06-19'), '14:00');
  for (const e of E) assert.equal(nyDate(e.T), e.date);
  // entry 24 h before, exit 13:55 New York
  const { tE, tX } = timesOf(by['2026-03-18'].T);
  assert.equal(tE, U('2026-03-17T18:00:00Z')); assert.equal(tX, U('2026-03-18T17:55:00Z'));
  assert.equal(new Intl.DateTimeFormat('en-US', { timeZone: 'America/New_York', hourCycle: 'h23', hour: '2-digit', minute: '2-digit' }).format(new Date(tX * 1000)), '13:55');
  // every year 2008-2025 has its eight (seven in 2020)
  const n = {}; for (const e of E) n[e.date.slice(0, 4)] = (n[e.date.slice(0, 4)] || 0) + 1;
  for (let y = 2008; y <= 2025; y++) assert.equal(n[y], y === 2020 ? 7 : 8, String(y));
});

// flat M5 candles every 5 minutes from `from` for `days` days, price px; `f(t, bar)` may change a candle
function mk(from, days, px = 100, f) {
  const rows = [];
  for (let t = from; t < from + days * 86400; t += 300) { const r = [t, px, px + 1, px - 1, px]; if (f) f(t, r); rows.push(r); }
  return rows;
}
const T = U('2026-03-18T18:00:00Z');

test('a trade: entry at T - 24 h, exit at T - 5 min, stop 1.5 ATR under the entry', () => {
  const rows = mk(T - 30 * 86400, 31), b = toBars(rows), days = nyDays(b);
  const x = trade(b, days, T, 'spx500');
  assert.ok(!x.skip);
  assert.equal(x.entryT, T - 86400); assert.equal(x.exitT, T - 300);
  near(atrAt(days, x.entryT), 2); near(x.stop, 100 - 3); assert.ok(x.stop < x.entry, 'a stop under every entry');
  assert.equal(x.why, 'time'); near(x.R, 0); assert.equal(x.nights, 1);
  near(x.costR, (1 + 1 * 0.06 / 365 * 100) / 3);
  near(x.net, -x.costR);
});

test('the stop: a low through it exits at the stop, an open through it at the open', () => {
  const hit = toBars(mk(T - 30 * 86400, 31, 100, (t, r) => { if (t === T - 3600) { r[3] = 96; } })), x = trade(hit, nyDays(hit), T, 'spx500');
  assert.equal(x.why, 'stop'); near(x.exit, 97); near(x.R, -1);
  const gap = toBars(mk(T - 30 * 86400, 31, 100, (t, r) => { if (t === T - 3600) { r[1] = 95; r[3] = 94; } })), y = trade(gap, nyDays(gap), T, 'spx500');
  assert.equal(y.why, 'gap'); near(y.exit, 95); assert.ok(y.R < -1);
});

test('no look-ahead: nothing after the exit and nothing after the entry changes what was known', () => {
  const base = mk(T - 30 * 86400, 31), a = toBars(base);
  const after = toBars(base.map((r) => (r[0] + 300 > T - 300 ? [r[0], 500, 600, 1, 300] : r)));   // every candle after the exit
  assert.deepEqual(trade(a, nyDays(a), T, 'spx500'), trade(after, nyDays(after), T, 'spx500'));
  const late = toBars(base.map((r) => (r[0] + 300 > T - 86400 ? [r[0], r[1], r[2] + 50, r[3], r[4]] : r)));   // after the entry
  near(atrAt(nyDays(late), T - 86400), atrAt(nyDays(a), T - 86400));
  near(trade(late, nyDays(late), T, 'spx500').stop, trade(a, nyDays(a), T, 'spx500').stop);
  assert.equal(lastEnding(a, T - 86400), base.findIndex((r) => r[0] === T - 86400 - 300));
});

test('missing candles: the last one in the hour before, else no trade', () => {
  const rows = mk(T - 30 * 86400, 31).filter((r) => !(r[0] >= T - 86400 - 1200 && r[0] < T - 86400));
  const b = toBars(rows), x = trade(b, nyDays(b), T, 'spx500');
  assert.equal(x.entryT, T - 86400 - 1200);
  const none = toBars(mk(T - 30 * 86400, 31).filter((r) => !(r[0] >= T - 86400 - 7200 && r[0] < T - 86400)));
  assert.equal(trade(none, nyDays(none), T, 'spx500').skip, 'no entry candle');
});

test('rollovers and financing: indices Friday 3x, gold Wednesday 3x', () => {
  assert.equal(rollovers(U('2026-03-17T18:00:00Z'), U('2026-03-18T17:55:00Z'), 'spx500'), 1);
  assert.equal(rollovers(U('2026-03-20T18:00:00Z'), U('2026-03-21T17:55:00Z'), 'spx500'), 3);
  assert.equal(rollovers(U('2026-03-18T18:00:00Z'), U('2026-03-19T17:55:00Z'), 'xau'), 3);
  assert.equal(rollovers(U('2026-03-18T18:00:00Z'), U('2026-03-19T17:55:00Z'), 'spx500'), 1);
});

test('the placebo: same weekday, never near an FOMC announcement, inside the window', () => {
  const ev = fomcEvents().find((e) => e.date === '2019-06-19'), xs = standIns(ev, P.WIN.B);
  const ban = ALL_ANNOUNCE().map((d) => Date.parse(d) / 86400e3);
  assert.ok(xs.length > 30);
  for (const x of xs) {
    assert.equal(new Date(x.date + 'T12:00Z').getUTCDay(), 3);
    assert.ok(ban.every((b) => Math.abs(b - Date.parse(x.date) / 86400e3) > 3), x.date);
    assert.ok(x.T >= P.WIN.B[0] && x.T < P.WIN.B[1]);
    assert.equal(nyDate(x.T), x.date);
  }
  const edge = standIns(fomcEvents().find((e) => e.date === '2016-01-27'), P.WIN.B);
  assert.ok(edge.every((x) => x.date >= '2016-01-01'), 'never in the other window');
});

test('statistics, the bar and the verdict', () => {
  const s = stat([1, 2, 3]); near(s.mean, 2); near(s.sd, 1); near(s.t, 2 * Math.sqrt(3));
  near(quantile([...Array(40).keys()], 0.95), 37.05);
  assert.equal(judge({ mean: 0.1, t: 2.1 }, 0.05).pass, true);
  assert.equal(judge({ mean: 0.1, t: 1.9 }, 0.05).pass, false);
  assert.equal(judge({ mean: 0.1, t: 2.1 }, 0.2).pass, false);
  assert.equal(verdictOf({ pass: false }, { pass: true }).word, 'FAIL');
});

test('RESULT.md is result.json, and the verdict follows the bar', () => {
  const r = JSON.parse(rd('../research/edge/pre-fomc-drift/result.json'));
  assert.equal(rd('../research/edge/pre-fomc-drift/RESULT.md'), report(r));
  const S = r.markets.spx500.windows.B;
  assert.equal(r.verdict, S.pass ? 'PASS' : 'FAIL');
  assert.equal(S.pass, S.netR > 0 && S.t >= 2 && S.netR > S.placebo.p95);
  assert.equal(r.markets.xau.windows.B.judged, false);
  assert.equal(fs.existsSync(new URL('../research/proposals/2026-11-13-pre-fomc.md', import.meta.url)), r.verdict === 'PASS');
  for (const m of Object.values(r.markets)) for (const w of Object.values(m.windows)) for (const x of w.trades) assert.ok(x.stop < x.entry, 'every trade has a stop');
});
