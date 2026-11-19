// nas-crypto-spill: the New York clock follows DST, half days are never signal days but can be exit days, the signal reads only
// the closed cash session, every trade has its stop, costs and swap are the pre-registered ones, and RESULT.md says what
// result.json holds. Offline.
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { nyTime, nyDate, fullDay, tradingDay, nextTradingDay, sessionMoves, signals, median, toH1, atrAt, nights, trade, prepare,
  monthT, quantile, holm, report, LOOKBACK, K, STOP_ATR, COST_RT, SWAP, WINDOWS } from '../research/edge/nas-crypto-spill/run.mjs';
import { CFD_CRYPTO } from '../council/fills.mjs';

const U = (s) => Date.parse(s) / 1000;
const DIR = new URL('../research/edge/nas-crypto-spill/', import.meta.url);

test('New York clock: 09:30 and 16:00 follow the March and November switches', () => {
  assert.equal(nyTime('2024-07-10', 9, 30), U('2024-07-10T13:30:00Z'));
  assert.equal(nyTime('2024-01-10', 9, 30), U('2024-01-10T14:30:00Z'));
  assert.equal(nyTime('2024-03-08', 16), U('2024-03-08T21:00:00Z'));
  assert.equal(nyTime('2024-03-11', 16), U('2024-03-11T20:00:00Z'));
  assert.equal(nyTime('2024-11-01', 16), U('2024-11-01T20:00:00Z'));
  assert.equal(nyTime('2024-11-04', 9, 30), U('2024-11-04T14:30:00Z'));
  assert.equal(nyDate(U('2024-07-11T03:30:00Z')), '2024-07-10');
});

test('calendar: holidays closed; half days open (exit) but never signal days; next trading day skips weekends and holidays', () => {
  for (const d of ['2024-01-01', '2024-03-29', '2024-06-19', '2024-07-04', '2024-11-28', '2024-12-25', '2025-01-09', '2024-07-06'])
    assert.equal(tradingDay(d), false, d);
  for (const d of ['2024-07-03', '2024-11-29', '2024-12-24']) { assert.equal(tradingDay(d), true, d); assert.equal(fullDay(d), false, d); }
  assert.equal(fullDay('2024-07-10'), true);
  assert.equal(nextTradingDay('2024-11-27'), '2024-11-29');   // Thanksgiving skipped, the half day is the exit day
  assert.equal(nextTradingDay('2024-07-12'), '2024-07-15');   // Friday → Monday
  assert.equal(nextTradingDay('2024-03-28'), '2024-04-01');   // Good Friday skipped
});

// synthetic NAS100 M15: flat 100 all day, the 09:30 open = 100 and the 15:45 close set per day
function nasDays(days, ret) {
  const rows = [];
  days.forEach((d, k) => {
    for (let m = 0; m < 96; m++) rows.push([U(d + 'T00:00:00Z') + m * 900, 100, 100, 100, 100]);
    const a = nyTime(d, 9, 30), b = nyTime(d, 15, 45);
    for (const x of rows) { if (x[0] === a) x[1] = 100; if (x[0] === b) x[4] = 100 * (1 + ret(k)); }
  });
  return rows.sort((p, q) => p[0] - q[0]);
}
const fullDays = (from, n) => { const out = []; for (let t = U(from + 'T00:00:00Z'); out.length < n; t += 86400) { const d = new Date(t * 1000).toISOString().slice(0, 10); if (fullDay(d)) out.push(d); } return out; };

test('the session move reads only 09:30 open to the 15:45 candle close; candles from 16:00 on do not change it; half days have none', () => {
  const days = fullDays('2024-02-01', 3), nas = nasDays(days, (k) => 0.01 * (k + 1));
  const a = sessionMoves(nas, U('2024-02-01T00:00:00Z'), U('2024-02-10T00:00:00Z'));
  const late = nas.map((x) => (x[0] >= nyTime(nyDate(x[0]), 16) ? [x[0], 999, 999, 1, 5] : x));
  const b = sessionMoves(late, U('2024-02-01T00:00:00Z'), U('2024-02-10T00:00:00Z'));
  assert.deepEqual(a.map((x) => +x.r.toFixed(10)), [0.01, 0.02, 0.03]);
  assert.deepEqual(b.map((x) => x.r), a.map((x) => x.r));
  const half = nasDays(['2024-11-29'], () => 0.05);
  assert.equal(sessionMoves(half, U('2024-11-29T00:00:00Z'), U('2024-11-30T00:00:00Z')).length, 0);
});

test('signals: |move| above 1.5 × the median |move| of the 20 previous days, the day itself excluded', () => {
  const moves = Array.from({ length: LOOKBACK + 3 }, (_, i) => ({ day: `d${i}`, r: i % 2 ? 0.01 : -0.01 }));
  moves[LOOKBACK].r = 0.0151; moves[LOOKBACK + 1].r = -0.02; moves[LOOKBACK + 2].r = 0.015;
  const s = signals(moves);
  assert.deepEqual(s.map((x) => [x.day, x.dir]), [[`d${LOOKBACK}`, 1], [`d${LOOKBACK + 1}`, -1]]);
  assert.equal(s[0].m20, 0.01);
  assert.equal(K, 1.5);
  assert.equal(median([3, 1, 2, 10]), 2.5);
});

// synthetic crypto 5m from 2024-07-08 00:00 UTC; px(t) gives the price, range ±0.5
function coin(fromIso, hours, px) {
  const rows = []; const t0 = U(fromIso);
  for (let t = t0; t < t0 + hours * 3600; t += 300) { const p = px(t); rows.push([t, p, p + 0.5, p - 0.5, p]); }
  return prepare(rows);
}

test('ATR reads only the 24 H1 candles that ended at or before the entry; prices after the entry do not change the stop', () => {
  const c1 = coin('2024-07-08T00:00:00Z', 24 * 6, () => 100);
  const at = nyTime('2024-07-10', 16);
  assert.equal(atrAt(c1.h1, c1.h1ix, at), 1);
  const c2 = coin('2024-07-08T00:00:00Z', 24 * 6, (t) => (t >= at ? 100 + (t - at) / 30 : 100));
  const t1 = trade(c1, 'btc', '2024-07-10', 1), t2 = trade(c2, 'btc', '2024-07-10', 1);
  assert.equal(t1.risk, STOP_ATR * 1); assert.equal(t2.risk, t1.risk); assert.equal(t2.entry, 100);
  assert.equal(toH1(c1.m5).length, 24 * 6);
});

test('every trade has its stop on the losing side; a touch exits at the stop, a gap at the open, else at the next 09:30 open', () => {
  const at = nyTime('2024-07-10', 16), out = nyTime('2024-07-11', 9, 30);
  const flat = coin('2024-07-08T00:00:00Z', 24 * 6, (t) => (t >= at + 3600 ? 103 : 100));
  const L = trade(flat, 'btc', '2024-07-10', 1), S = trade(flat, 'btc', '2024-07-10', -1);
  assert.ok(L.stop < L.entry && S.stop > S.entry);
  assert.equal(L.how, 'time'); assert.equal(L.exit, 103); assert.equal(L.exitT, out);
  assert.equal(S.how, 'gap'); assert.equal(S.exit, 103);   // the 103 candle opens beyond the 101.5 stop
  const drift = coin('2024-07-08T00:00:00Z', 24 * 6, (t) => (t >= at ? 100 + (t - at) / 3600 : 100));
  const S2 = trade(drift, 'btc', '2024-07-10', -1);
  assert.equal(S2.how, 'stop'); assert.equal(S2.exit, S2.stop); assert.ok(Math.abs(S2.gross + 1) < 1e-12);
});

test('costs: 0.06 % of entry a round trip; swap per 17:00 New York rollover, Friday x3, longs 15 %, shorts 7.5 % / 10 %', () => {
  assert.equal(COST_RT, CFD_CRYPTO + 0.0002);
  assert.equal(nights(nyTime('2024-07-10', 16), nyTime('2024-07-11', 9, 30)), 1);   // Wednesday
  assert.equal(nights(nyTime('2024-07-12', 16), nyTime('2024-07-15', 9, 30)), 3);   // Friday → Monday
  assert.equal(nights(nyTime('2024-11-27', 16), nyTime('2024-11-29', 9, 30)), 2);   // over Thanksgiving
  assert.deepEqual(SWAP, { btc: { long: 0.15, short: 0.075 }, eth: { long: 0.15, short: 0.10 } });
  const c = coin('2024-07-08T00:00:00Z', 24 * 9, () => 100);
  const L = trade(c, 'eth', '2024-07-12', 1), S = trade(c, 'eth', '2024-07-12', -1);
  assert.equal(L.nights, 3);
  assert.ok(Math.abs(L.costR - 0.0006 * 100 / L.risk) < 1e-12);
  assert.ok(Math.abs(L.swapR - 3 * 0.15 / 365 * 100 / L.risk) < 1e-12);
  assert.ok(Math.abs(S.swapR - 3 * 0.10 / 365 * 100 / S.risk) < 1e-12);
  assert.ok(Math.abs(L.net - (L.gross - L.costR - L.swapR)) < 1e-12);
});

test('statistics: monthly sums count empty months as 0; Holm; the 95th percentile of 40', () => {
  const m = monthT([{ day: '2024-01-05', net: 1 }, { day: '2024-03-05', net: 2 }], '2024-01-01', '2024-04-30');
  assert.equal(m.months, 4); assert.equal(m.mean, 0.75);
  assert.deepEqual(holm([0.01, 0.04]), [0.02, 0.04]);
  assert.ok(Math.abs(quantile(Array.from({ length: 40 }, (_, i) => i), 0.95) - 37.05) < 1e-9);
  assert.equal(WINDOWS.dec[0], '2022-01-03');
});

test('RESULT.md says what result.json holds', () => {
  const res = JSON.parse(fs.readFileSync(new URL('result.json', DIR), 'utf8'));
  const md = fs.readFileSync(new URL('RESULT.md', DIR), 'utf8');
  assert.equal(md, report(res));
  assert.ok(md.includes(`**Verdict: ${res.verdict}, `));
  assert.ok(['FAIL', 'INCONCLUSIVE'].includes(res.verdict));   // the replication was not run, so PASS is impossible here
  for (const v of Object.values(res.variants)) { assert.equal(v.test.checks.sameSign, null); assert.equal(v.placebo.means.length, 40); }
});
