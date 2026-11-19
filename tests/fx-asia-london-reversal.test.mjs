// fx-asia-london-reversal (research/edge/fx-asia-london-reversal): the New York daily candles and ATR without look-ahead, the
// Asia read and size gate, the fade entry and its stop, the exits, the cost maths, the placebo, and RESULT.md against
// result.json. Offline: hand-made candles only.
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { K, nyDayStart, nyDays, atrAt, asiaOf, dayTrade, manage, costPx, placeboTrade, rng, monthT, holm, judge, report } from '../research/edge/fx-asia-london-reversal/run.mjs';

const U = (y, m, d, h = 0, mi = 0) => Date.UTC(y, m - 1, d, h, mi) / 1000;
const near = (a, b, e = 1e-9) => assert.ok(Math.abs(a - b) < e, `${a} vs ${b}`);

test('New York days start at 17:00 New York: 22:00 UTC in winter, 21:00 UTC in US daylight time', () => {
  assert.equal(nyDayStart(U(2024, 1, 10, 3)), U(2024, 1, 9, 22));
  assert.equal(nyDayStart(U(2024, 1, 10, 22)), U(2024, 1, 10, 22));
  assert.equal(nyDayStart(U(2024, 7, 10, 3)), U(2024, 7, 9, 21));
  assert.equal(nyDayStart(U(2024, 7, 10, 21, 30)), U(2024, 7, 10, 21));
  // 2024: US daylight time from 10 Mar to 3 Nov
  assert.equal(nyDayStart(U(2024, 3, 8, 12)), U(2024, 3, 7, 22));
  assert.equal(nyDayStart(U(2024, 3, 12, 12)), U(2024, 3, 11, 21));
  assert.equal(nyDayStart(U(2024, 11, 5, 12)), U(2024, 11, 4, 22));
});

// winter weekdays of flat 1.1000 candles with a 10-pip range each (high +5, low -5 pips), so every daily true range is 10 pips;
// the trade day's 00:00-07:00 UTC is replaced by `asia(i)` (index from 00:00)
function series(days = 30, asia = null, after = null) {
  const B = [], start = U(2023, 12, 4), T = U(2024, 1, 1) + days * 86400;
  for (let t = start; t < T; t += 300) {
    const wd = new Date(t * 1000).getUTCDay(), h = (t % 86400) / 3600;
    if (wd === 6 || (wd === 0 && h < 22) || (wd === 5 && h >= 22)) continue;
    B.push({ time: t, open: 1.1, high: 1.1005, low: 1.0995, close: 1.1 });
  }
  const day0 = U(2024, 1, 29);
  if (asia) B.forEach((b, j) => { const i = (b.time - day0) / 300; if (i >= 0 && i < 84) B[j] = { time: b.time, ...asia(i) }; });
  if (after) B.forEach((b, j) => { const i = (b.time - day0 - 7 * 3600) / 300; if (i >= 0 && b.time < day0 + 86400) B[j] = { time: b.time, ...after(i, b) }; });
  return { B, day0 };
}
// Asia rises 1 pip a candle from 1.1000 to 1.1083 (move 8.3 pips over an ATR of 10 pips)
const up = (i) => ({ open: 1.1 + i * 0.0001, high: 1.1 + (i + 1) * 0.0001, low: 1.1 + i * 0.0001, close: 1.1 + (i + 1) * 0.0001 });

test('daily candles and ATR20 use only New York days that ended before the trade day', () => {
  const { B, day0 } = series(30);
  const D = nyDays(B);
  assert.ok(D.every((d) => d.n >= K.NY_MIN));
  near(atrAt(D, day0), 0.001);
  // change every candle of the trade day: the ATR known at its 00:00 UTC does not move
  const C = B.map((b) => (b.time >= day0 ? { ...b, high: 2, low: 0.5 } : b));
  near(atrAt(nyDays(C), day0), 0.001);
  // not enough history: no ATR
  assert.equal(atrAt(nyDays(series(10).B), U(2023, 12, 20)), null);
});

test('Asia read: 00:00-06:55 UTC candles, at least 80 of 84, move = last close - first open', () => {
  const { B, day0 } = series(30, up);
  const a = asiaOf(B, day0);
  near(a.move, 0.0084); near(a.hi, 1.1084); near(a.lo, 1.1); near(a.range, 0.0084);
  assert.equal(B[a.iEntry].time, day0 + 7 * 3600);
  const C = B.filter((b) => !(b.time >= day0 && b.time < day0 + 5 * 300));
  assert.equal(asiaOf(C, day0), null, 'five Asia candles missing: skipped');
});

test('the fade: sell an up move at the 07:00 open, stop one Asia range above the Asia high, out at 12:00 UTC', () => {
  const { B, day0 } = series(30, up, (i) => ({ open: 1.108 - 0.00001 * i, high: 1.1081 - 0.00001 * i, low: 1.1079 - 0.00001 * i, close: 1.108 - 0.00001 * (i + 1) }));
  const r = dayTrade('eurusd', B, nyDays(B), day0);
  const t = r.trade; assert.ok(t, JSON.stringify(r));
  assert.equal(t.side, -1); near(t.entry, 1.108); near(t.stop, 1.1084 + 0.0084); near(t.r0, 0.0088);
  assert.equal(t.exit, 'time'); assert.equal(t.exitAt, day0 + 12 * 3600 - 300);
  near(t.gross, (1.108 - (1.108 - 0.00001 * 60)) / 0.0088);
  near(t.net, t.gross - costPx('eurusd', 1.108) / 0.0088); near(t.net2, t.gross - 2 * costPx('eurusd', 1.108) / 0.0088);
  // the mirror: a down move is bought, stop one range under the Asia low
  const dn = (i) => ({ open: 1.1 - i * 0.0001, high: 1.1 - i * 0.0001, low: 1.1 - (i + 1) * 0.0001, close: 1.1 - (i + 1) * 0.0001 });
  const s = series(30, dn).B, b = dayTrade('eurusd', s, nyDays(s), day0).trade;
  assert.equal(b.side, 1); near(b.stop, 1.0916 - 0.0084);
});

test('size gate: a move of 0.3 x ATR20 or less is no trade', () => {
  const small = (i) => ({ open: 1.1, high: 1.1003, low: 1.1, close: i === 83 ? 1.1003 : 1.1 });
  const { B, day0 } = series(30, small);
  assert.equal(dayTrade('eurusd', B, nyDays(B), day0).skip, 'small');
});

test('stop exits: touched at the level, gapped at the open; the entry candle counts', () => {
  const B = [{ time: 0, open: 1.0, high: 1.0, low: 1.0, close: 1.0 }, { time: 300, open: 1.0, high: 1.02, low: 0.99, close: 1.0 }, { time: 600, open: 1.05, high: 1.06, low: 1.0, close: 1.0 }];
  assert.deepEqual(manage(B, 0, -1, 1.01, 99999), { kind: 'stop', px: 1.01, at: 300 });
  assert.deepEqual(manage(B, 0, -1, 1.03, 99999), { kind: 'stop', px: 1.05, at: 600 });
  const E = [{ time: 0, open: 1.0, high: 1.02, low: 1.0, close: 1.0 }];
  assert.deepEqual(manage(E, 0, -1, 1.01, 99999), { kind: 'stop', px: 1.01, at: 0 });
  assert.deepEqual(manage(B, 0, -1, 2, 600), { kind: 'time', px: 1.0, at: 300 });
});

test('costs: 0.3 pip spread + 2 x 22.5e-6 x price + 1 pip of slippage, JPY pips are 0.01', () => {
  near(costPx('eurusd', 1.1), 0.00003 + 2 * 22.5e-6 * 1.1 + 0.0001);
  near(costPx('usdjpy', 150), 0.003 + 2 * 22.5e-6 * 150 + 0.01);
  near(costPx('usdjpy', 150, 2), 2 * costPx('usdjpy', 150));
});

test('no look-ahead: candles after the 07:00 entry change the exit only, never the gate, side, entry or stop', () => {
  const a = series(30, up), b = series(30, up, (i, x) => ({ ...x, high: x.high + 0.02 }));
  const ta = dayTrade('eurusd', a.B, nyDays(a.B), a.day0).trade, tb = dayTrade('eurusd', b.B, nyDays(b.B), b.day0).trade;
  for (const k of ['side', 'entry', 'stop', 'r0', 'asiaMove', 'atr']) assert.equal(tb[k], ta[k]);
  assert.equal(tb.exit, 'stop');
});

test('placebo: same entry and stop distance, random side, seeded and repeatable', () => {
  const { B, day0 } = series(30, up);
  const t = dayTrade('eurusd', B, nyDays(B), day0).trade;
  const u1 = rng(7), u2 = rng(7), p = placeboTrade(B, t, u1()), q = placeboTrade(B, t, u2());
  assert.deepEqual(p, q); near(p.r0, t.r0); assert.equal(p.entry, t.entry);
  const sides = new Set(); const u = rng(1); for (let k = 0; k < 20; k++) sides.add(placeboTrade(B, t, u()).side);
  assert.deepEqual([...sides].sort(), [-1, 1]);
});

test('statistics: month sums count empty months as zero; Holm is monotone', () => {
  const m = monthT([{ at: U(2024, 1, 5), net: 1 }, { at: U(2024, 3, 5), net: 1 }], U(2024, 1, 1), U(2024, 4, 1));
  assert.equal(m.months, 3); near(m.t, (2 / 3) / (Math.sqrt(1 / 3) / Math.sqrt(3)));
  assert.deepEqual(holm([0.01, 0.04, 0.03]), [0.03, 0.06, 0.06]);
});

test('RESULT.md and the verdict match result.json and the pre-registered bar', () => {
  const R = JSON.parse(fs.readFileSync(new URL('../research/edge/fx-asia-london-reversal/result.json', import.meta.url), 'utf8'));
  const md = fs.readFileSync(new URL('../research/edge/fx-asia-london-reversal/RESULT.md', import.meta.url), 'utf8');
  assert.equal(md, report(R));
  const P = R.pool, pass = P.oos.t >= 2 && P.is.net > 0 && P.oos.net2 > 0 && P.oos.net > P.placebo.p95;
  assert.deepEqual(P.tests, judge(P));
  assert.equal(P.verdict, pass ? 'PASS' : 'FAIL');
  assert.match(md, new RegExp(`\\*\\*Verdict: ${P.verdict}\\.\\*\\* The pool made`));
  assert.ok(R.verdict.startsWith(P.verdict));
  assert.equal(R.pairs.length, 7); assert.equal(P.placebo.seeds, 40);
  assert.equal(P.is.n + P.oos.n, R.pairs.reduce((s, p) => s + R.byPair[p].is.n + R.byPair[p].oos.n, 0));
  for (const p of R.pairs) assert.equal(R.byPair[p].verdict === 'PASS', Object.values(R.byPair[p].tests).every(Boolean) && R.byPair[p].pHolm < 0.05);
});
