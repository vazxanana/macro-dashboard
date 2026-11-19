// Crypto weekend reversal study (research/edge/crypto-weekend-reversal): the weekend signal, the ATR with no look-ahead, the
// trade (stop on the losing side, stop / target / time exits, stop first in one candle), costs and financing, the statistics,
// and the committed result against the pre-registered bar and the written report. Offline: hand-made candles only.
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { P, AT, TESTS, MARKETS, nights, usDst, series, days, atrFor, simulate, costs, weekends, monthT, holm, normP, stat, placebo, realTrades } from '../research/edge/crypto-weekend-reversal/run.mjs';
import { CFD_CRYPTO } from '../council/fills.mjs';

const rd = (p) => fs.readFileSync(new URL(p, import.meta.url), 'utf8');
const PRE = rd('../research/edge/crypto-weekend-reversal/PREREGISTRATION.md'), RUN = rd('../research/edge/crypto-weekend-reversal/run.mjs');
const RES = rd('../research/edge/crypto-weekend-reversal/RESULT.md'), J = JSON.parse(rd('../research/edge/crypto-weekend-reversal/result.json'));
const DAY = 86400, near = (a, b, e = 1e-9) => assert.ok(Math.abs(a - b) < e, `${a} vs ${b}`);
const FRI = Date.UTC(2024, 6, 12) / 1000;       // Friday 12 Jul 2024 (US summer time)

// 5-minute candles from `from` to `to`: price(t) at open and close, high / low 0.5 either side (a UTC day's range is 1).
function candles(from, to, price, skip = () => false) {
  const rows = []; for (let t = from; t < to; t += 300) if (!skip(t)) { const p = price(t); rows.push([t, p, p + 0.5, p - 0.5, p]); } return rows;
}
const flat = (t) => 100;
// a weekend that rises 2 (> 1 ATR) from Saturday on, then whatever `after` says from Monday 13:30
const path = (after) => (t) => (t < FRI + DAY ? 100 : t < FRI + AT.mon1330 ? 102 : after(t));

test('constants, windows and tests are the pre-registered ones', () => {
  assert.equal(P.COST, CFD_CRYPTO); assert.equal(CFD_CRYPTO, 0.0004);
  assert.deepEqual([P.K_SIG, P.K_STOP, P.K_TGT, P.ATR_N, P.MIN_N, P.MIN_N_POOL, P.T_MIN, P.SEEDS], [1, 1, 1, 20, 30, 60, 2, 40]);
  assert.deepEqual(P.FIN, { btc: { long: 0.15, short: 0.075 }, eth: { long: 0.15, short: 0.10 } });
  assert.deepEqual(P.WIN, ['2022-01-01', '2026-10-31']); assert.deepEqual(Object.keys(TESTS), ['T1', 'T2']); assert.deepEqual(Object.keys(MARKETS), ['btc', 'eth']);
  assert.deepEqual([AT.fri21, AT.sun22, AT.mon1330, AT.wed21], [21 * 3600, 2 * DAY + 22 * 3600, 3 * DAY + 13.5 * 3600, 5 * DAY + 21 * 3600]);
  for (const s of ['`|M| > 1.0 x ATR(20)`', '**Monday 13:30 UTC**', '**Sunday 22:00 UTC**', 'Wednesday 21:00', '**longs 15 %, shorts 7.5 % (BTC) / 10 % (ETH)**', '**Holm over the five**', 'month-sum t >= 2.0', 'n >= 30 trades (POOL: >= 60)', 'For each seed 1-40']) assert.ok(PRE.includes(s), s);
  assert.ok(!/from ['"]\.\.\/\.\.\/\.\.\/(api|ict)\//.test(RUN), 'a study imports nothing live but the cost constant');
  assert.deepEqual([...RUN.matchAll(/from ['"](\.[^'"]+)['"]/g)].map((m) => m[1]), ['../../../council/fills.mjs']);
});

test('financing nights: 17:00 New York in (entry, exit], Friday counts three', () => {
  assert.equal(usDst(FRI), true); assert.equal(usDst(Date.UTC(2024, 11, 13) / 1000), false);
  assert.equal(nights(FRI + AT.mon1330, FRI + AT.wed21), 3, 'summer: Mon, Tue and Wed 21:00 UTC (the exit instant counts)');
  const w = Date.UTC(2024, 11, 13) / 1000;
  assert.equal(nights(w + AT.mon1330, w + AT.wed21), 2, 'winter: 22:00 UTC, Wednesday is after the exit');
  assert.equal(nights(FRI + 20 * 3600, FRI + 22 * 3600), 3, 'Friday 17:00 New York counts three');
  assert.equal(nights(FRI + 21 * 3600, FRI + 22 * 3600), 0, 'the entry instant itself is not inside the hold');
  assert.equal(nights(FRI + AT.sun22, FRI + AT.mon1330), 0);
});

test('ATR(20) reads only complete days that ended by Friday 00:00 (no look-ahead)', () => {
  const S = series(candles(FRI - 30 * DAY, FRI + 7 * DAY, flat)), dm = new Map(days(S).map((d) => [d.time, d]));
  near(atrFor(dm, FRI), 1);
  const S2 = series(candles(FRI - 30 * DAY, FRI + 7 * DAY, (t) => (t >= FRI ? 500 + (t % 7) : 100))), dm2 = new Map(days(S2).map((d) => [d.time, d]));
  near(atrFor(dm2, FRI), 1, 1e-9);           // Friday and everything after changed: the ATR did not
  const S3 = series(candles(FRI - 30 * DAY, FRI + 7 * DAY, (t) => (t >= FRI - DAY && t < FRI ? 104 : 100))), dm3 = new Map(days(S3).map((d) => [d.time, d]));
  near(atrFor(dm3, FRI), (19 * 1 + 4.5) / 20);  // Thursday's gap is in it (true range from the previous close)
  const S4 = series(candles(FRI - 30 * DAY, FRI + 7 * DAY, flat, (t) => t >= FRI - 5 * DAY && t < FRI - 5 * DAY + 2 * 3600)), dm4 = new Map(days(S4).map((d) => [d.time, d]));
  assert.equal(atrFor(dm4, FRI), null, 'an incomplete day inside the 21 = no trade');
});

test('the weekend signal trades against the move, and nothing after Sunday 22:00 changes it', () => {
  const W = (after) => weekends(series(candles(FRI - 30 * DAY, FRI + 7 * DAY, path(after))), FRI, FRI)[0];
  const a = W(() => 102), b = W((t) => 50 + (t % 13));
  for (const w of [a, b]) { assert.equal(w.ok, true); near(w.move, 2); near(w.atr, 1); assert.equal(w.side, -1, 'a rise gives a short'); }
  const fall = weekends(series(candles(FRI - 30 * DAY, FRI + 7 * DAY, (t) => (t < FRI + DAY ? 100 : 98.5))), FRI, FRI)[0];
  assert.equal(fall.side, 1, 'a fall gives a long');
  const small = weekends(series(candles(FRI - 30 * DAY, FRI + 7 * DAY, (t) => (t < FRI + DAY ? 100 : 100.9))), FRI, FRI)[0];
  assert.equal(small.side, 0, 'a move under one ATR is no signal');
});

test('the trade: stop on the losing side, stop / target / time exits, stop first in one candle, gap at the open', () => {
  const t0 = FRI + AT.mon1330, end = FRI + AT.wed21;
  const S = (after) => series(candles(FRI - 30 * DAY, FRI + 7 * DAY, path(after)));
  // a short at 102 with ATR 1: stop 103, target 101
  const sh = simulate(S(() => 102), t0, -1, 1, end); assert.ok(sh.stop > sh.entry, 'a short stop is above'); near(sh.stop, 103); near(sh.target, 101);
  assert.equal(sh.how, 'time'); assert.equal(sh.closed, end); near(sh.R, 0);
  const lg = simulate(S(() => 102), t0, 1, 1, end); assert.ok(lg.stop < lg.entry, 'a long stop is below');
  const tg = simulate(S((t) => (t >= t0 + 3600 ? 101.2 : 102)), t0, -1, 1, end); assert.equal(tg.how, 'target'); near(tg.R, 1); near(tg.exit, 101);
  const st = simulate(S((t) => (t >= t0 + 3600 ? 102.6 : 102)), t0, -1, 1, end); assert.equal(st.how, 'stop'); near(st.R, -1);
  const gap = simulate(S((t) => (t >= t0 + 3600 ? 104 : 102)), t0, -1, 1, end); assert.equal(gap.how, 'stop'); near(gap.exit, 104); near(gap.R, -2);
  // one candle reaching both the stop and the target: the stop
  const rows = candles(FRI - 30 * DAY, FRI + 7 * DAY, path(() => 102)).map((r) => (r[0] === t0 + 3600 ? [r[0], 102, 103.5, 100.5, 102] : r));
  const both = simulate(series(rows), t0, -1, 1, end); assert.equal(both.how, 'stop'); near(both.R, -1);
  // too many candles missing in the hold: no trade
  assert.equal(simulate(series(candles(FRI - 30 * DAY, FRI + 7 * DAY, path(() => 102), (t) => t > t0 && t < t0 + DAY)), t0, -1, 1, end), null);
});

test('costs and financing in R; twice the costs doubles both', () => {
  const tr = { t: FRI + AT.mon1330, closed: FRI + AT.wed21, side: -1, entry: 50000, atr: 2000, R: 0.5 };
  const c = costs(tr, 'btc'), cost = 0.0004 * 50000 / 2000, fin = 0.075 / 365 * 50000 * 3 / 2000;
  near(c.cost, cost); near(c.fin, fin); assert.equal(c.nights, 3); near(c.net, 0.5 - cost - fin);
  near(costs({ ...tr, side: 1 }, 'eth').fin, 0.15 / 365 * 50000 * 3 / 2000); near(costs(tr, 'eth').fin, 0.10 / 365 * 50000 * 3 / 2000);
  near(costs(tr, 'btc', 2).net, 0.5 - 2 * (cost + fin));
});

test('statistics: month sums with empty months, Holm, the placebo keeps count and sides', () => {
  const from = Date.UTC(2024, 0, 1) / 1000, to = Date.UTC(2024, 3, 30) / 1000;
  const m = monthT([{ closed: from + 5 * DAY, net: 1 }, { closed: from + 6 * DAY, net: 1 }, { closed: Date.UTC(2024, 2, 3) / 1000, net: 1 }], from, to);
  assert.equal(m.months, 4); near(m.mean, 0.75); near(m.t, stat([2, 0, 1, 0]).t);
  assert.deepEqual(holm([0.01, 0.04, 0.03]).map((x) => Math.round(x * 1e6) / 1e6), [0.03, 0.06, 0.06]);
  assert.ok(normP(2) < 0.025 && normP(2) > 0.02); near(normP(0), 0.5, 1e-6);
  const W = []; for (let k = 0; k < 6; k++) { const f = FRI + k * 7 * DAY; W.push({ ok: true, fri: f, trades: { T1: { '1': { t: f, closed: f + DAY, side: 1, entry: 100, atr: 1, R: 1 }, '-1': { t: f, closed: f + DAY, side: -1, entry: 100, atr: 1, R: -1 } } } }); }
  const real = [{ side: 1 }, { side: -1 }, { side: -1 }], pl = placebo(W, 'btc', 'T1', real, 5);
  assert.equal(pl.length, 5); for (const tr of pl) { assert.equal(tr.length, 3); assert.deepEqual(tr.map((x) => x.side).sort(), [-1, -1, 1]); assert.equal(new Set(tr.map((x) => x.t)).size, 3, 'without replacement'); }
  assert.deepEqual(placebo(W, 'btc', 'T1', real, 5), pl, 'seeded');
  assert.equal(realTrades([{ ok: true, side: 0, trades: W[0].trades }], 'btc', 'T1').length, 0, 'no signal, no trade');
});

test('the committed result: the verdict follows the conditions, and RESULT.md says what result.json says', () => {
  assert.equal(J.study, 'crypto-weekend-reversal'); assert.deepEqual(Object.keys(J.tests), ['T1-BTC', 'T1-ETH', 'T2-BTC', 'T2-ETH', 'POOL']);
  const anyPass = Object.values(J.tests).some((T) => T.pass), anyT = Object.values(J.tests).some((T) => T.cond.tMonth);
  assert.equal(J.verdict, anyPass ? 'PASS' : anyT ? 'INCONCLUSIVE' : 'FAIL');
  for (const T of Object.values(J.tests)) {
    assert.equal(T.pass, Object.values(T.cond).every(Boolean));
    assert.equal(T.cond.tMonth, T.all.netR > 0 && T.all.tMonth >= 2); assert.equal(T.cond.n, T.all.n >= T.minN);
    assert.equal(T.placebo.of, 40);
  }
  assert.ok(RES.includes(`**Verdict: ${J.verdict}.** ${J.headline}`));
  const sg = (x) => (x > 0 ? '+' : '') + x;
  for (const [k, T] of Object.entries(J.tests)) assert.ok(RES.includes(`| ${k} | ${T.all.n} |`) && RES.includes(`| ${sg(T.all.netR)} | ${T.all.tMonth} |`), k);
  for (const line of J.reading) assert.ok(RES.includes(line));
  assert.equal(J.trades['T1-btc'].length, J.tests['T1-BTC'].all.n);
});
