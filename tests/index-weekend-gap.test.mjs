// US index CFDs' Sunday-reopen gap study (research/edge/index-weekend-gap): the New York clock across daylight saving, the
// weekend detection on hand-made candles, the no-look-ahead property of the gap and the ATR, the trade (side, stop on the
// losing side, target = Friday's close, exits), the CME holiday weekends, the costs, and the committed result against the
// written report. Offline: no candle file is read here.
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { K, nyTime, nyParts, cfdDays, atrAt, weeks, fadeTrade, holidayWeekend, dayNo, finRate, rateOf, evenings, holm, report } from '../research/edge/index-weekend-gap/run.mjs';

const rd = (p) => fs.readFileSync(new URL(p, import.meta.url), 'utf8');
const RES = rd('../research/edge/index-weekend-gap/RESULT.md'), J = JSON.parse(rd('../research/edge/index-weekend-gap/result.json'));
const near = (a, b, e = 1e-9) => assert.ok(Math.abs(a - b) < e, `${a} vs ${b}`);

// every CFD M5 slot (not Friday 17:00 - Sunday 18:00, not the 17:00-18:00 daily halt) between two UTC dates, a smooth
// deterministic walk; `over` replaces candles by time
function series(from, to, over = {}) {
  const out = []; let px = 5000;
  for (let t = from; t < to; t += 300) {
    const p = nyParts(t); if (p.wd === 6 || (p.wd === 5 && p.h >= 17) || (p.wd === 0 && p.h < 18) || p.h === 17) continue;
    const o = px, c = o + Math.sin(t / 7200) * 2;
    out.push(over[t] || { time: t, open: o, high: Math.max(o, c) + 1, low: Math.min(o, c) - 1, close: c }); px = c;
  }
  return out;
}
const U = (y, m, d, h = 0, mi = 0) => Date.UTC(y, m - 1, d, h, mi) / 1000;

test('the constants are the pre-registered ones', () => {
  assert.deepEqual([K.ATR_N, K.GAP_MIN, K.STOP_ATR, K.COST, K.FIN_ADD, K.NIGHTS, K.N_MIN, K.N_MIN_P, K.ALPHA, K.SEEDS], [20, 0.5, 1, 0.0003, 2.5, 1, 30, 60, 0.02275, 40]);
  assert.deepEqual(K.REP, ['2008-01-01', '2015-12-31']); assert.equal(K.DEC_FROM, '2016-01-01');
});

test('the reopen is Sunday 18:00 New York in both daylight-saving states', () => {
  assert.equal(nyTime(2024, 7, 14, 18), U(2024, 7, 14, 22));    // summer: UTC-4
  assert.equal(nyTime(2024, 1, 14, 18), U(2024, 1, 14, 23));    // winter: UTC-5
  assert.equal(nyTime(2024, 3, 10, 18), U(2024, 3, 10, 22));    // the Sunday daylight saving starts
  assert.equal(nyTime(2024, 11, 3, 18), U(2024, 11, 3, 23));    // the Sunday it ends
  assert.equal(nyTime(2024, 3, 8, 17), U(2024, 3, 8, 22));      // the Friday before it starts: still UTC-5
  for (const [from, to, sun] of [[U(2024, 5, 1), U(2024, 7, 20), U(2024, 7, 14, 22)], [U(2023, 11, 20), U(2024, 2, 1), U(2024, 1, 14, 23)]]) {
    const W = weeks(series(from, to)), w = W.find((x) => x.sun18 === sun);
    assert.ok(w && !w.skip, 'week used'); assert.equal(series(from, to)[w.iR].time, sun);
  }
});

test('the gap and the ATR read only candles before the entry', () => {
  const from = U(2024, 5, 1), to = U(2024, 7, 20), M5 = series(from, to), W = weeks(M5).filter((w) => !w.skip), w = W.at(-2);
  // change every candle after the reopen candle: Friday's close, the gap and the ATR do not move
  const M2 = M5.map((b, i) => (i > w.iR ? { ...b, open: b.open + 300, high: b.high + 400, low: b.low - 100, close: b.close + 300 } : b));
  const w2 = weeks(M2).find((x) => x.F === w.F);
  assert.equal(w2.fc, w.fc); assert.equal(w2.gap, w.gap); assert.equal(w2.atr, w.atr);
  // the ATR ends with Friday's day: it equals the ATR of the candles cut at Friday 17:00
  const cut = M5.filter((b) => b.time < w.F);
  near(atrAt(cfdDays(cut), dayNo(nyParts(w.F - 300))), w.atr);
  assert.equal(w.fc, M5[w.iF].close); assert.ok(M5[w.iF].time < w.F && M5[w.iR].time >= w.sun18);
});

test('the trade: against the gap, stop 1 ATR on the losing side, target Friday\'s close', () => {
  const base = (o, h, l, c, t) => ({ time: t, open: o, high: h, low: l, close: c });
  // gap up: Friday close 100, reopen candle opens 106 closes 105 -> sell at 105, stop 105 + 8, target 100
  const up = [base(100, 100, 100, 100, 0), base(106, 106.5, 104.8, 105, 300), base(105, 105.2, 103, 103.5, 600), base(103.5, 103.6, 99.9, 100.2, 900)];
  const s = fadeTrade(up, 1, 100, 8, 10_000, 4);
  assert.equal(s.side, -1); assert.equal(s.entry, 105); assert.equal(s.stop, 113); assert.ok(s.stop > s.entry); assert.equal(s.target, 100);
  assert.equal(s.exit, 'target'); near(s.R, 5 / 8);
  // gap down mirrored -> buy, stop below
  const dn = up.map((b) => ({ time: b.time, open: 200 - b.open, high: 200 - b.low, low: 200 - b.high, close: 200 - b.close }));
  const b = fadeTrade(dn, 1, 100, 8, 10_000, 4);
  assert.equal(b.side, 1); assert.ok(b.stop < b.entry); near(b.stop, b.entry - 8); assert.equal(b.target, 100); near(b.R, 5 / 8);
  // a candle reaching both: the stop first
  const both = [up[0], up[1], base(105, 113.5, 99, 104, 600)];
  assert.equal(fadeTrade(both, 1, 100, 8, 10_000, 4).exit, 'stop'); near(fadeTrade(both, 1, 100, 8, 10_000, 4).R, -1);
  // a gap through the stop at a candle's open exits at that open
  const g = fadeTrade([up[0], up[1], base(115, 116, 114, 115, 600)], 1, 100, 8, 10_000, 4);
  assert.equal(g.exit, 'stop (gap)'); near(g.R, -10 / 8);
  // already filled inside the first candle: no trade
  assert.equal(fadeTrade([up[0], base(106, 106, 99, 99.5, 300)], 1, 100, 8, 10_000, 4).skip, 'filled');
  // time exit at the last candle ending by endT
  const te = fadeTrade(up.slice(0, 3), 1, 100, 8, 900, 4); assert.equal(te.exit, 'time'); near(te.R, 1.5 / 8);
  // costs: spread 0.0003 x entry, one night; long pays 2Y + 2.5 %, short 2.5 % - 2Y floored at 0
  near(s.spreadR, 0.0003 * 105 / 8); near(s.finR, 0 / 365 * 105 / 8 + Math.max(0, 2.5 - 4) / 100 / 365 * 105 / 8);
  near(b.finR, (4 + 2.5) / 100 / 365 * b.entry / 8); near(s.net, s.R - s.spreadR - s.finR); near(s.net2, s.R - 2 * s.spreadR - s.finR);
  assert.equal(finRate(1, 1), 3.5); assert.equal(finRate(-1, 1), 1.5); assert.equal(finRate(-1, 5), 0);
  assert.equal(rateOf([['2020-01-03', 1.5], ['2020-01-10', 1.6]], '2020-01-09'), 1.5); assert.equal(rateOf([['2020-01-03', 1.5]], '2019-01-01'), 1.5);
});

test('CME holiday weekends are skipped', () => {
  const fri = (y, m, d) => Date.UTC(y, m - 1, d) / 86400000;
  assert.equal(holidayWeekend(fri(2024, 3, 29)), true);    // Good Friday
  assert.equal(holidayWeekend(fri(2023, 12, 22)), true);   // Christmas on Monday 25 Dec
  assert.equal(holidayWeekend(fri(2017, 12, 29)), true);   // New Year on Monday 1 Jan 2018
  assert.equal(holidayWeekend(fri(2024, 11, 29)), true);   // the day after Thanksgiving: early close on the Friday
  assert.equal(holidayWeekend(fri(2024, 5, 24)), false);   // Memorial Day Monday: early close from 13:00, after 09:30
  assert.equal(holidayWeekend(fri(2024, 7, 12)), false);   // an ordinary weekend
  const M5 = series(U(2024, 2, 15), U(2024, 4, 10)), w = weeks(M5).find((x) => x.fri === '2024-03-29');
  assert.equal(w.skip, 'holiday');
});

test('the placebo pool is weekday evenings only, with the same size filter', () => {
  const M5 = series(U(2024, 5, 1), U(2024, 7, 20)), t18 = nyTime(2024, 7, 9, 18), i = M5.findIndex((b) => b.time === t18);
  M5[i] = { ...M5[i], open: M5[i].open + 300, high: M5[i].open + 301, low: M5[i].open + 290, close: M5[i].open + 295 };   // a Tuesday evening jump
  const E = evenings(M5);
  assert.ok(E.some((e) => e.date === '2024-07-09'), 'the jump is in the pool');
  assert.ok(!E.some((e) => e.date === '2024-07-03'), 'Independence Day eve (early close) is not');
  for (const e of E) { const wd = new Date(e.date + 'T00:00:00Z').getUTCDay(); assert.ok(wd >= 1 && wd <= 4); }
  assert.deepEqual(holm([0.005, 0.01, 0.03]), [true, true, false]);
});

test('RESULT.md is written from result.json and agrees with it', () => {
  assert.equal(RES, report(J));
  assert.ok(RES.includes(`## Verdict: ${J.verdict}`));
  const pass = ['T1', 'T2', 'T3', 'P'].some((k) => J.tests[k].pass);
  assert.equal(J.pass, pass); assert.equal(J.verdict.startsWith('PASS'), pass);
  for (const k of ['T1', 'T2', 'T3', 'P']) { const d = J.tests[k].dec, c = J.tests[k].checks;
    assert.equal(c.netPos, d.net > 0); assert.equal(c.net2Pos, d.net2 > 0); assert.equal(c.repPos, J.tests[k].rep.net > 0); }
  assert.equal(J.trades.filter((t) => t[1] >= '2016-01-01').length, J.tests.P.dec.n);
  assert.ok(J.reading.length > 100, 'the reading is written');
});
