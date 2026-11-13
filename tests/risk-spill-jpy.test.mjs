// risk-spill-jpy: the signal reads only the closed cash session, the New York clock follows DST, every trade has its stop,
// costs are the pre-registered ones, and RESULT.md says what result.json holds. Offline.
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { nyTime, nyDate, fullDay, sessionReturns, signals, entryTime, trade, costOf, holm, report, LOOKBACK, COMMISSION_RT, PAIRS, STOP_ATR }
  from '../research/edge/risk-spill-jpy/run.mjs';

const U = (s) => Date.parse(s) / 1000;

test('New York clock: 09:30 is 13:30 UTC in summer, 14:30 UTC in winter; 18:00 and 03:00 follow the switch', () => {
  assert.equal(nyTime('2024-07-10', 9, 30), U('2024-07-10T13:30:00Z'));
  assert.equal(nyTime('2024-01-10', 9, 30), U('2024-01-10T14:30:00Z'));
  assert.equal(nyTime('2024-03-08', 9, 30), U('2024-03-08T14:30:00Z'));   // Friday before the March switch
  assert.equal(nyTime('2024-03-11', 9, 30), U('2024-03-11T13:30:00Z'));   // Monday after it
  assert.equal(nyTime('2024-11-01', 18), U('2024-11-01T22:00:00Z'));
  assert.equal(nyTime('2024-11-04', 3), U('2024-11-04T08:00:00Z'));       // after the November switch
  assert.equal(nyDate(U('2024-07-11T03:30:00Z')), '2024-07-10');
});

test('NYSE calendar: holidays and early closes are not kept, ordinary weekdays are', () => {
  for (const d of ['2024-01-01', '2024-01-15', '2024-03-29', '2024-05-27', '2024-06-19', '2024-07-04', '2024-11-28', '2024-12-25', '2012-10-29', '2025-01-09', '2024-07-06'])
    assert.equal(fullDay(d), false, d);
  for (const d of ['2024-07-03', '2024-11-29', '2024-12-24']) assert.equal(fullDay(d), false, 'early ' + d);
  assert.equal(fullDay('2021-06-18'), true);   // Juneteenth observed only from 2022
  for (const d of ['2024-07-10', '2024-03-28', '2024-11-27']) assert.equal(fullDay(d), true, d);
});

// a synthetic M30 S&P series: every candle of each day, open = close = base, the 09:30 open and 15:30 close set per day
function spxDays(days, ret) {
  const rows = [];
  days.forEach((d, k) => {
    for (let m = 0; m < 48; m++) { const t = U(d + 'T00:00:00Z') + m * 1800; rows.push([t, 100, 100, 100, 100]); }
    const a = nyTime(d, 9, 30), b = nyTime(d, 15, 30), r = ret(k);
    for (const x of rows) { if (x[0] === a) x[1] = 100; if (x[0] === b) x[4] = 100 * (1 + r); }
  });
  return rows.sort((p, q) => p[0] - q[0]);
}
const weekdays = (from, n) => { const out = []; for (let t = U(from + 'T00:00:00Z'); out.length < n; t += 86400) { const d = new Date(t * 1000).toISOString().slice(0, 10); if (fullDay(d)) out.push(d); } return out; };

test('the session return reads only the 09:30 open and the 15:30-16:00 candle; anything after 16:00 does not change it', () => {
  const days = weekdays('2024-02-01', 3), spx = spxDays(days, (k) => 0.01 * (k + 1));
  const r1 = sessionReturns(spx, U('2024-02-01T00:00:00Z'), U('2024-02-10T00:00:00Z'));
  // move every candle that starts at or after 16:00 New York: same returns
  const late = spx.map((x) => { const d = nyDate(x[0]); return x[0] >= nyTime(d, 16) ? [x[0], 999, 999, 1, 5] : x; });
  const r2 = sessionReturns(late, U('2024-02-01T00:00:00Z'), U('2024-02-10T00:00:00Z'));
  assert.deepEqual(r1.map((x) => +x.r.toFixed(10)), [0.01, 0.02, 0.03]);
  assert.deepEqual(r2.map((x) => x.r), r1.map((x) => x.r));
  for (const x of r1) assert.equal(x.closeAt, nyTime(x.day, 16));
});

test('signals use the 60 previous days only, beyond ±1 sd; the entry is 18:00 New York (Friday → Sunday)', () => {
  const rets = Array.from({ length: LOOKBACK + 3 }, (_, i) => ({ day: `d${i}`, r: i % 2 ? 0.01 : -0.01 }));
  rets[LOOKBACK].r = 0.05; rets[LOOKBACK + 1].r = -0.05; rets[LOOKBACK + 2].r = 0.001;
  const s = signals(rets);
  assert.deepEqual(s.map((x) => [x.day, x.side]), [[`d${LOOKBACK}`, 1], [`d${LOOKBACK + 1}`, -1]]);
  // the first signal's sd does not see its own day
  assert.ok(Math.abs(s[0].sd - 0.01 * Math.sqrt(60 / 59)) < 1e-12);
  assert.equal(entryTime('2024-07-10'), U('2024-07-10T22:00:00Z'));
  assert.equal(entryTime('2024-07-12'), U('2024-07-14T22:00:00Z'));
  assert.ok(entryTime('2024-07-10') > nyTime('2024-07-10', 16));
});

function pairBars(at, path) {   // 30 H1 candles of range 0.10 before `at`, then the given [o,h,l,c]
  const rows = []; for (let i = 30; i >= 1; i--) rows.push([at - i * 3600, 150, 150.05, 149.95, 150]);
  path.forEach((p, i) => rows.push([at + i * 3600, ...p])); return rows;
}
const ixOf = (bars) => new Map(bars.map((b, i) => [b[0], i]));

test('every trade has a 1.5 ATR(24) stop; a stop exits at the stop, a gap at the open, else the 03:00 open', () => {
  const at = entryTime('2024-07-10'), up = Array.from({ length: 10 }, (_, i) => [150 + i * 0.01, 150.02 + i * 0.01, 149.99 + i * 0.01, 150.01 + i * 0.01]);
  let b = pairBars(at, up), t = trade(b, ixOf(b), 'usdjpy', at, 1);
  assert.ok(Math.abs(t.risk - STOP_ATR * 0.1) < 1e-9); assert.ok(t.stop < t.entry); assert.equal(t.how, 'time');
  assert.equal(t.exit, b[ixOf(b).get(nyTime('2024-07-11', 3))][1]); assert.equal(t.rollover, false);
  const down = [[150, 150.01, 149.80, 149.82], ...up.slice(1)];
  b = pairBars(at, down); t = trade(b, ixOf(b), 'usdjpy', at, 1);
  assert.equal(t.how, 'stop'); assert.ok(Math.abs(t.gross + 1) < 1e-9);
  const gap = [up[0], [149.7, 149.75, 149.6, 149.7], ...up.slice(2)];
  b = pairBars(at, gap); t = trade(b, ixOf(b), 'usdjpy', at, 1);
  assert.equal(t.how, 'gap'); assert.equal(t.exit, 149.7); assert.ok(t.gross < -1);
  // a short's stop is above
  b = pairBars(at, up); t = trade(b, ixOf(b), 'usdjpy', at, -1); assert.ok(t.stop > t.entry);
});

test('costs: measured commission plus the pre-registered spread, taken off in R', () => {
  assert.equal(COMMISSION_RT, 0.000045); assert.equal(PAIRS.usdjpy.spread, 0.008); assert.equal(PAIRS.audjpy.spread, 0.012);
  assert.ok(Math.abs(costOf('usdjpy', 150) - (0.008 + 0.00675)) < 1e-12);
  const at = entryTime('2024-07-10'), b = pairBars(at, Array.from({ length: 10 }, () => [150, 150.02, 149.99, 150]));
  const t = trade(b, ixOf(b), 'usdjpy', at, 1); assert.ok(Math.abs(t.net - (t.gross - costOf('usdjpy', 150) / t.risk)) < 1e-12);
  assert.ok(Math.abs(t.net2 - (t.gross - 2 * t.cost)) < 1e-12);
});

test('Holm on two pairs', () => { assert.deepEqual(holm([0.02, 0.01]), [0.02, 0.02]); assert.deepEqual(holm([0.5, 0.01]), [0.5, 0.02]); });

test('RESULT.md is the report of result.json, verdict first', () => {
  const r = JSON.parse(fs.readFileSync(new URL('../research/edge/risk-spill-jpy/result.json', import.meta.url)));
  const md = fs.readFileSync(new URL('../research/edge/risk-spill-jpy/RESULT.md', import.meta.url), 'utf8');
  assert.equal(md, report(r));
  assert.match(md.split('\n')[2], new RegExp(`^\\*\\*Verdict: ${r.verdict}`));
  assert.equal(r.verdict, Object.values(r.pairs).some((p) => p.test.pass) ? 'PASS' : 'FAIL');
  for (const p of Object.values(r.pairs)) { assert.equal(p.rollovers, 0); assert.equal(p.placebo.means.length, 40); }
});
