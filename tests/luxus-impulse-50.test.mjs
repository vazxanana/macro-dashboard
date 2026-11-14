// luxus-impulse-50 (research/edge/luxus-impulse-50): the rule's pieces on hand-made candles (structure, the 50 % limit, the CF
// branch, the sell mirror, no look-ahead) and the committed report against result.json. Offline: no candle file is read here.
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { K, WIN, cols, boEvents, order50, orderCF, swingHi, headline, report, summary, monthT, holm } from '../research/edge/luxus-impulse-50/run.mjs';

const dir = new URL('../research/edge/luxus-impulse-50/', import.meta.url);
const R = JSON.parse(fs.readFileSync(new URL('result.json', dir)));
const MD = fs.readFileSync(new URL('RESULT.md', dir), 'utf8');
const PRE = fs.readFileSync(new URL('PREREGISTRATION.md', dir), 'utf8');
const T0 = 1.7e9;
const rowsOf = (ohlc) => ohlc.map(([o, h, l, c], i) => [T0 + i * 300, o, h, l, c]);
const mirror = (ohlc) => ohlc.map(([o, h, l, c]) => [200 - o, 200 - l, 200 - h, 200 - c]);

test('the constants and windows are the pre-registered ones', () => {
  assert.deepEqual([K.P4, K.PD, K.PW, K.P5, K.BUF, K.MIN_R0, K.HOLD, K.CF_VALID, K.MIN_RR_CF, K.COST], [3, 2, 2, 1, 0.30, 1.0, 10 * 86400, 24 * 3600, 1, 0.60]);
  assert.deepEqual(Object.values(WIN).map(([a, b]) => [new Date(a * 1000).toISOString().slice(0, 7), new Date(b * 1000).toISOString().slice(0, 7)]), [['2007-01', '2020-01'], ['2020-01', '2024-01'], ['2024-01', '2026-11']]);
  for (const s of ['**Stop $0.30 below the origin**', 'Valid 24 hours', '10 calendar days', '$0.60 a round trip', 'in sample 2020-01 to 2023-12; out of sample 2024-01 to 2026-10-31', 'gold-ote-retrace']) assert.ok(PRE.includes(s), s);
});

test('BO events: a close beyond the last confirmed swing; origin and leg high; no look-ahead', () => {
  const b = (time, open, high, low, close) => ({ time, open, high, low, close, end: time + 1 });
  const B = [b(0, 10, 11, 9, 10), b(1, 10, 12, 10, 11), b(2, 11, 11.5, 9.8, 11), b(3, 11, 11.2, 9.0, 10), b(4, 10, 13, 10, 12.5), b(5, 12.5, 14, 12, 13.5)];
  const ev = boEvents(B, 1);
  assert.deepEqual(ev.map((e) => [e.j, e.side, e.level, e.origin, e.ext]), [[4, 1, 12, 9, 13]]);   // candle 4 closes above the swing high of candle 1; origin = the low of candle 3
  for (let n = 1; n <= B.length; n++) assert.deepEqual(boEvents(B.slice(0, n), 1), ev.filter((e) => e.j < n));   // a later candle never changes an earlier event
});

const LEG = [[109.5, 110, 109.2, 109.8], [109.8, 111, 109, 110.8], [106, 106.5, 105.4, 106.2], [106.2, 111.2, 106, 111.1], [111, 111.5, 110.5, 111]];
test('Test 1: the 50 % follows the leg high, stop $0.30 under the origin, target the leg high', () => {
  const m = cols(rowsOf(LEG)), ev = { origin: 100, ext: 110, end: T0, side: 1 };
  const r = order50(m, ev, 1, Infinity);
  assert.equal(r.status, 'filled');
  const t = r.trade;
  assert.equal(t.side, 1); assert.equal(t.entry, 105.5); assert.equal(+t.stop.toFixed(2), 99.7); assert.equal(t.target, 111);   // the high of candle 1 moved the 50 % to 105.5
  assert.equal(t.how, 'target'); assert.ok(Math.abs(t.R - 5.5 / 5.8) < 1e-9); assert.ok(t.net < t.R && t.net2 < t.net);
  assert.equal(order50(m, ev, 1, T0 + 600).status, 'cancelled');                       // cancelled before the fill candle
  assert.equal(order50(m, { ...ev, ext: 101 }, 1, Infinity).status, 'small');          // risk under $1.00 is not placed
  // no look-ahead: changing every candle after the exit changes nothing
  const later = cols(rowsOf([...LEG.slice(0, 4), [50, 60, 40, 45]]));
  assert.deepEqual(order50(later, ev, 1, Infinity).trade, t);
});

test('Test 3 is the mirror: the same trade as a sell on the reflected series', () => {
  const m = cols(rowsOf(mirror(LEG)), -1), r = order50(m, { origin: -100, ext: -90, end: T0, side: 1 }, 1, Infinity), t = r.trade;
  assert.equal(t.side, -1); assert.ok(Math.abs(t.entry - 94.5) < 1e-9); assert.ok(Math.abs(t.stop - 100.3) < 1e-9); assert.ok(Math.abs(t.target - 89) < 1e-9);
  assert.ok(t.stop > t.entry && t.target < t.entry);
  assert.ok(Math.abs(t.R - 5.5 / 5.8) < 1e-9);
});

test('Test 2: the M5 CF (a close above the VR top) before the 50 %, entry at the return to the broken level', () => {
  const C = [[117, 117, 117, 117], [117.5, 117.8, 117.2, 117.4], [117.4, 117.5, 116.8, 117.0], [117.0, 117.6, 116.9, 117.3], [117.3, 117.4, 116.0, 116.2],
    [116.2, 116.3, 115.5, 115.6], [115.6, 117.9, 115.6, 117.8], [117.8, 117.9, 117.5, 117.7], [117.7, 120.2, 117.6, 120.1]];
  const m = cols(rowsOf(C)), hi = swingHi(m), ev = { origin: 100, ext: 120, end: T0, side: 1 };
  const r = orderCF(m, ev, 1, Infinity, hi), t = r.trade;
  assert.equal(r.status, 'filled');
  assert.equal(t.entry, 117.6); assert.equal(+t.stop.toFixed(2), 115.3); assert.equal(t.target, 120); assert.equal(t.how, 'target');
  assert.equal(t.cfT, T0 + 7 * 300);                                                    // the CF is the close of candle 6
  // the 50 % touched first: no CF trade
  const touched = cols(rowsOf([C[0], [117, 117.2, 109.9, 117], ...C.slice(1)]));
  assert.equal(orderCF(touched, ev, 1, Infinity, swingHi(touched)).status, 'touched50');
  // a target under 1R from the entry: not placed
  assert.equal(orderCF(m, { ...ev, ext: 118.5 }, 1, Infinity, hi).status, 'noRoom');
});

test('statistics helpers: month t counts empty months, Holm is monotone', () => {
  const T = [{ fillT: Date.UTC(2024, 0, 5) / 1000, net: 1, exitT: 1 }, { fillT: Date.UTC(2024, 2, 5) / 1000, net: 1, exitT: 2 }];
  assert.equal(monthT(T, Date.UTC(2024, 0, 1) / 1000, Date.UTC(2024, 3, 1) / 1000).months, 3);
  assert.deepEqual(holm([0.01, 0.04, 0.03]).map((p) => +p.toFixed(2)), [0.03, 0.06, 0.06]);
  assert.equal(summary(T).total, 2);
});

test('the committed report is written from result.json, and the verdict follows the pre-registered bar', () => {
  assert.equal(MD, report(R));
  assert.ok(MD.includes(headline(R)));
  const line = MD.split('\n').find((l) => l.startsWith('**Verdict:'));
  assert.ok(line.length < 220, line);
  for (const [k, r] of Object.entries(R.tests)) {
    const want = r.oos.tNet >= 2 && r.pHolm < 0.05 && r.is.net.avg > 0 && r.oos.net2.avg > 0 && r.oos.net.n >= 30;
    assert.equal(r.pass, want, k);
    for (const x of r.trades) assert.ok(x.side === 'buy' ? x.stop < x.entry && x.target > x.entry : x.stop > x.entry && x.target < x.entry, `${k} ${x.d}`);
    assert.equal(r.trades.filter((x) => x.d < '2024').length, r.is.net.n, k);
  }
  assert.equal(R.verdict, R.tests.T1.pass ? 'PASS' : 'FAIL');
  assert.ok(MD.startsWith(`# Result`) && line.includes(R.verdict));
});
