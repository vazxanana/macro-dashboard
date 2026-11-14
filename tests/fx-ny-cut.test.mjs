// fx-ny-cut (research/edge/fx-ny-cut): the New York clock with daylight time, the 50-pip round levels (and the shifted
// placebo grids), the 20-day hour range without look-ahead, the trade toward the level and its stop and exit, the release after
// the cut, the cost maths, and RESULT.md against result.json. Offline: hand-made candles only.
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { K, nyOffsetH, nyAt, levelOf, daysOf, dayTrade, manage, costPx, placeboOffset, monthT, holm, judge, report } from '../research/edge/fx-ny-cut/run.mjs';

const U = (y, m, d, h = 0, mi = 0) => Date.UTC(y, m - 1, d, h, mi) / 1000;
const near = (a, b, e = 1e-9) => assert.ok(Math.abs(a - b) < e, `${a} vs ${b}`);

test('09:00 and 10:00 New York in UTC: 13:00 / 14:00 in US daylight time, 14:00 / 15:00 otherwise', () => {
  assert.equal(nyAt(U(2024, 1, 10), 9), U(2024, 1, 10, 14));
  assert.equal(nyAt(U(2024, 1, 10), 10), U(2024, 1, 10, 15));
  assert.equal(nyAt(U(2024, 7, 10), 9), U(2024, 7, 10, 13));
  // 2024: US daylight time from Sunday 10 Mar to Sunday 3 Nov; Europe's change (31 Mar, 27 Oct) does not matter
  assert.equal(nyAt(U(2024, 3, 8), 9), U(2024, 3, 8, 14));
  assert.equal(nyAt(U(2024, 3, 11), 9), U(2024, 3, 11, 13));
  assert.equal(nyAt(U(2024, 3, 28), 9), U(2024, 3, 28, 13));
  assert.equal(nyAt(U(2024, 11, 1), 9), U(2024, 11, 1, 13));
  assert.equal(nyAt(U(2024, 11, 4), 9), U(2024, 11, 4, 14));
  assert.equal(nyOffsetH(U(2024, 3, 10, 6, 59)), -5);
  assert.equal(nyOffsetH(U(2024, 3, 10, 7)), -4);
  assert.equal(nyOffsetH(U(2024, 11, 3, 5, 59)), -4);
  assert.equal(nyOffsetH(U(2024, 11, 3, 6)), -5);
});

test('round levels: multiples of 50 pips (0.0050, or 0.50 yen), and the shifted grids', () => {
  near(levelOf(1.08712, 0.0001), 1.0850);
  near(levelOf(1.08760, 0.0001), 1.0900);
  near(levelOf(1.09031, 0.0001), 1.0900);
  near(levelOf(151.73, 0.01), 151.50);
  near(levelOf(151.77, 0.01), 152.00);
  near(levelOf(1.08712, 0.0001, 25), 1.0875);
  near(levelOf(151.40, 0.01, 25), 151.25);
  for (let s = 1; s <= K.SEEDS; s++) { const o = placeboOffset(s); assert.ok(o >= 5 && o < 45, `seed ${s}: ${o}`); }
  assert.equal(placeboOffset(7), placeboOffset(7));
});

// winter weekdays of flat candles at `px` with a 10-pip range (+-5 pips); `hour(i, b)` replaces the trade day's candles from
// 09:00 New York (index from 09:00)
function series(px = 1.0905, hour = null, days = 40) {
  const B = [], start = U(2023, 11, 20), T = start + days * 86400;
  for (let t = start; t < T; t += 300) {
    const wd = new Date(t * 1000).getUTCDay(), h = (t % 86400) / 3600;
    if (wd === 6 || (wd === 0 && h < 22) || (wd === 5 && h >= 22)) continue;
    B.push({ time: t, open: px, high: px + 0.0005, low: px - 0.0005, close: px });
  }
  const day0 = U(2023, 12, 27), t9 = U(2023, 12, 27, 14);
  if (hour) B.forEach((b, j) => { const i = (b.time - t9) / 300; if (i >= 0 && b.time < day0 + 86400) B[j] = { time: b.time, ...hour(i, b) }; });
  return { B, day0, t9 };
}
const dayOf = (D, day0) => D.find((d) => d.day === day0);

test('the 20-day hour range uses only earlier days; the trade day changes nothing in it', () => {
  const { B, day0 } = series();
  const D = daysOf(B, U(2023, 11, 20), U(2023, 12, 30)), d = dayOf(D, day0);
  near(d.H20, 0.001);
  assert.equal(d.n, 12);
  const { B: C } = series(1.0905, (i, b) => ({ open: b.open, high: 1.2, low: 1.0, close: b.close }));
  near(dayOf(daysOf(C, U(2023, 11, 20), U(2023, 12, 30)), day0).H20, 0.001);
  // too few earlier days: no stop size, no trade
  const early = dayOf(D, U(2023, 12, 1));
  assert.equal(early.H20, null);
  assert.equal(dayTrade('eurusd', B, early).skip, 'warm-up');
});

test('toward the level: sell 5 pips above 1.0900, buy 7 pips under 1.0950, stop 1.5 x H20, out at the 09:55 close', () => {
  // price 1.0905: the nearest round level is 1.0900, 5 pips below -> sell toward it
  const s1 = series(1.0905); let r = dayTrade('eurusd', s1.B, dayOf(daysOf(s1.B), s1.day0));
  assert.equal(r.trade.side, -1); near(r.trade.level, 1.09); near(r.trade.distPip, 5);
  near(r.trade.stop, 1.0905 + 0.0015); assert.equal(r.trade.exit, 'time'); assert.equal(r.trade.exitAt, s1.t9 + 11 * 300);
  // price 1.0943: level 1.0950 is 7 pips above -> buy
  const s2 = series(1.0943); r = dayTrade('eurusd', s2.B, dayOf(daysOf(s2.B), s2.day0));
  assert.equal(r.trade.side, 1); near(r.trade.level, 1.095); near(r.trade.stop, 1.0943 - 0.0015);
  // 1.0920: 20 pips from 1.0900, 30 from 1.0950 -> far, no trade; 1.09005: 0.5 pip -> at the level, no trade
  const s3 = series(1.092); assert.equal(dayTrade('eurusd', s3.B, dayOf(daysOf(s3.B), s3.day0)).skip, 'far');
  const s4 = series(1.09005); assert.equal(dayTrade('eurusd', s4.B, dayOf(daysOf(s4.B), s4.day0)).skip, 'at-level');
  // the same price on the 25-pip control grid: 1.0920 is 5 pips from 1.0925 -> buy toward it
  r = dayTrade('eurusd', s3.B, dayOf(daysOf(s3.B), s3.day0), 25);
  assert.equal(r.trade.side, 1); near(r.trade.level, 1.0925);
  // USD/JPY: 0.50-yen levels
  const s5 = series(151.44, null); const B5 = s5.B.map((b) => ({ ...b, high: b.open + 0.05, low: b.open - 0.05 }));
  r = dayTrade('usdjpy', B5, dayOf(daysOf(B5), s5.day0));
  assert.equal(r.trade.side, 1); near(r.trade.level, 151.5); near(r.trade.distPip, 6); near(r.trade.stop, 151.44 - 0.15);
});

test('the stop: touched inside the hour exits at the stop, a gap beyond it exits at the open', () => {
  // buy at 1.0943, stop 1.0928: candle 3 dips to 1.0925
  const a = series(1.0943, (i, b) => (i === 3 ? { ...b, low: 1.0925 } : b));
  let r = dayTrade('eurusd', a.B, dayOf(daysOf(a.B), a.day0));
  assert.equal(r.trade.exit, 'stop'); near(r.trade.exitPx, 1.0928); near(r.trade.gross, -1);
  // candle 4 opens at 1.0920 (beyond the stop)
  const g = series(1.0943, (i, b) => (i === 4 ? { open: 1.092, high: 1.0925, low: 1.0915, close: 1.092 } : b));
  r = dayTrade('eurusd', g.B, dayOf(daysOf(g.B), g.day0));
  assert.equal(r.trade.exit, 'stop'); near(r.trade.exitPx, 1.092);
  // manage on its own: the time exit is the last candle opening before the end
  const ex = manage(a.B.map((b) => ({ ...b, low: b.open - 0.0001 })), a.B.findIndex((b) => b.time === a.t9), 1, 1.0, a.t9 + 3600);
  assert.equal(ex.kind, 'time'); assert.equal(ex.at, a.t9 + 3300);
});

test('the release after the cut: away from the same level from 10:00, out before 11:00', () => {
  // buy at 1.0943 toward 1.0950; at 10:00 price is 1.0948 (under 1.0950) -> sell away from it
  const s = series(1.0943, (i, b) => (i >= 12 ? { open: 1.0948, high: 1.0953, low: 1.0943, close: 1.0948 } : b));
  const r = dayTrade('eurusd', s.B, dayOf(daysOf(s.B), s.day0));
  assert.equal(r.release.side, -1); near(r.release.entry, 1.0948); near(r.release.stop, 1.0948 + 0.0015);
  assert.equal(r.release.exitAt, s.t9 + 23 * 300);
});

test('costs: spread 0.3 pip + commission 2 x 22.5e-6 x price + 1 pip of slippage, per trade in price', () => {
  near(costPx('eurusd', 1.1), 0.00013 + 2 * 22.5e-6 * 1.1);
  near(costPx('usdjpy', 150), 0.013 + 2 * 22.5e-6 * 150);
  near(costPx('eurusd', 1.1, 2), 2 * costPx('eurusd', 1.1));
});

test('statistics: month sums count empty months, Holm, the four-part bar', () => {
  const tr = [{ at: U(2024, 1, 5), net: 1 }, { at: U(2024, 3, 5), net: 1 }];
  assert.equal(monthT(tr, U(2024, 1, 1), U(2024, 4, 1)).months, 3);
  assert.deepEqual(holm([0.01, 0.04, 0.03]), [0.03, 0.06, 0.06]);
  const ok = { is: { net: 0.1 }, oos: { t: 2.1, net2: 0.01 }, placebo: { beats: true } };
  assert.ok(Object.values(judge(ok)).every(Boolean));
  assert.equal(judge({ ...ok, oos: { t: 1.9, net2: 0.01 } })['OOS month-sum t >= 2 (net)'], false);
});

test('RESULT.md is the report of result.json, the verdict line follows the pass bar, no stop-less trade', () => {
  const R = JSON.parse(fs.readFileSync(new URL('../research/edge/fx-ny-cut/result.json', import.meta.url), 'utf8'));
  const md = fs.readFileSync(new URL('../research/edge/fx-ny-cut/RESULT.md', import.meta.url), 'utf8');
  assert.equal(md, report(R));
  const pass = Object.values(R.pool.tests).every(Boolean);
  assert.equal(R.pool.verdict, pass ? 'PASS' : 'FAIL');
  assert.ok(md.includes(`**Verdict: ${R.pool.verdict}.**`));
  assert.ok(R.verdict.startsWith(R.pool.verdict + ':'));
  const first = md.split('\n')[2].replace(/^\*\*Verdict: \w+\.\*\* /, '').split('. ')[0];
  assert.ok(first.length < 220, first);
  assert.equal(R.pool.oos.n + R.pool.is.n, R.touch.nReal);
  assert.equal(R.pool.placebo.seeds, 40);
  assert.ok(R.limitation.includes('proxy'));
  for (const p of R.pairs) assert.ok(R.byPair[p].oos.medR0pip > 0);
});
