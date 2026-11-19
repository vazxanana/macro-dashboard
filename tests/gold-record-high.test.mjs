// Gold after a new record closing high: the signals, the trade (stop, hold, costs), no look-ahead, one at a time, the
// statistics, and the report against result.json.
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { athSignals, h52Signals, firstAfterGap, atr, trade, runTest, monthly, tstat, holm, placebo, study, verdictLine,
  report, READING, P } from '../research/edge/gold-record-high/run.mjs';
import { FIN, nights } from '../council/fills.mjs';

// hand-made weekday candles from 2020-01-01; open = previous close, high / low = max / min of open and close +- 1
function path(closes, from = Date.UTC(2020, 0, 1) / 1000) {
  const out = []; let t = from, prev = closes[0];
  for (const c of closes) {
    while ([0, 6].includes(new Date(t * 1000).getUTCDay())) t += 86400;
    out.push({ time: t, open: prev, high: Math.max(prev, c) + 1, low: Math.min(prev, c) - 1, close: c }); prev = c; t += 86400;
  }
  return out;
}
const flat = (n, v = 1000) => Array(n).fill(v);

test('all-time high: above every earlier close and above the $850 prior record', () => {
  const s = athSignals(path([800, 860, 855, 870, 870, 871]));
  assert.deepEqual(s, [false, true, false, true, false, true]);
  assert.deepEqual(athSignals(path([900, 950]), 1000), [false, false]);
});

test('52-week high: above the previous 252 closes, none before 252 closes exist', () => {
  const c = [...flat(252, 100), 101, 100.5, 102];
  const s = h52Signals(path(c));
  assert.equal(s.slice(0, 252).some(Boolean), false);
  assert.deepEqual(s.slice(252), [true, false, true]);
});

test('first record after a gap counts only after more than 60 candles without one', () => {
  const a = Array(200).fill(false); a[0] = a[30] = a[100] = a[161] = a[162] = true;
  const f = firstAfterGap(a);
  assert.deepEqual([0, 30, 100, 161, 162].map((i) => f[i]), [true, false, true, true, false]);
});

test('signals never read a later candle (no look-ahead)', () => {
  const c = []; for (let i = 0; i < 400; i++) c.push(900 + i + 30 * Math.sin(i / 7));
  const a = path(c), A = athSignals(a), H = h52Signals(a);
  const b = path(c.map((x, i) => (i > 300 ? x * 3 : x)));
  assert.deepEqual(athSignals(b).slice(0, 301), A.slice(0, 301));
  assert.deepEqual(h52Signals(b).slice(0, 301), H.slice(0, 301));
  assert.equal(atr(b, 300), atr(a, 300));
});

test('trade: entry at the next open, stop 3 x ATR(20), time exit at the 20th close, costs and long financing', () => {
  const b = path(flat(60)); // flat candles: true range 2, ATR 2, stop distance 6
  assert.ok(Math.abs(atr(b, 25) - 2) < 1e-12);
  b[26].open = 1000; b[45].close = 1012;
  const L = trade(b, 25, 1);
  assert.equal(L.e, 26); assert.equal(L.entry, 1000); assert.equal(L.stop, 994); assert.equal(L.how, 'time');
  assert.equal(L.xi, 26 + P.HOLD - 1); assert.equal(L.exit, 1012);
  assert.ok(Math.abs(L.gross - 2) < 1e-12);
  assert.ok(Math.abs(L.costR - 0.6 / 6) < 1e-12);
  const n = nights(b[26].time, b[45].time + 86400);
  assert.equal(L.nights, n); assert.ok(n > 0);
  assert.ok(Math.abs(L.finR - n * FIN.xau.long * 1000 / 6) < 1e-12);
  assert.ok(Math.abs(L.net - (L.gross - L.costR - L.finR)) < 1e-12);
  const S = trade(b, 25, -1);
  assert.equal(S.finR, 0); assert.equal(S.stop, 1006);
  assert.ok(Math.abs(trade(b, 25, 1, { costX: 2 }).costR - 2 * L.costR) < 1e-12);
});

test('every trade has a stop: touched exits at the stop, a gap through it at the open', () => {
  const b = path(flat(60));
  b[30].low = 993;
  const t = trade(b, 25, 1); assert.equal(t.how, 'stop'); assert.equal(t.exit, 994); assert.equal(t.gross, -1);
  b[30].open = 990; b[30].low = 989;
  const g = trade(b, 25, 1); assert.equal(g.how, 'gap'); assert.equal(g.exit, 990);
  const h = path(flat(60)); h[30].high = 1007;
  assert.equal(trade(h, 25, -1).exit, 1006);
  assert.equal(trade(path(flat(30)), 25, 1), null); // not enough candles for the hold
});

test('one position at a time: signals inside an open trade are ignored', () => {
  const b = path(flat(120)), sig = Array(120).fill(false);
  sig[25] = sig[30] = sig[44] = sig[50] = true;
  const tr = runTest(b, sig, 1);
  assert.deepEqual(tr.map((t) => t.s), [25, 50]);
});

test('statistics: monthly sums with empty months, Holm, placebo deterministic', () => {
  const w = { from: '2020-01', to: '2020-04' };
  assert.deepEqual(monthly([{ exitMonth: '2020-02', net: 1 }, { exitMonth: '2020-02', net: 0.5 }, { exitMonth: '2021-01', net: 9 }], w), [0, 1.5, 0, 0]);
  assert.ok(Math.abs(tstat([1, 2, 3]).t - 2 / (1 / Math.sqrt(3))) < 1e-12);
  assert.deepEqual(holm([0.01, 0.04, 0.03]), [0.03, 0.06, 0.06]);
  const c = []; for (let i = 0; i < 700; i++) c.push(1000 + 50 * Math.sin(i / 11));
  const b = path(c), real = runTest(b, h52Signals(b).map((x, i) => i % 40 === 0 || x), 1);
  assert.deepEqual(placebo(b, real, 1, 7).map((t) => t.s), placebo(b, real, 1, 7).map((t) => t.s));
});

test('RESULT.md and result.json agree with each other and with the code', () => {
  const dir = new URL('../research/edge/gold-record-high/', import.meta.url);
  const R = JSON.parse(fs.readFileSync(new URL('result.json', dir), 'utf8'));
  const md = fs.readFileSync(new URL('RESULT.md', dir), 'utf8');
  assert.equal(R.verdict, 'FAIL');
  assert.equal(R.headline, verdictLine(R));
  assert.ok(R.headline.length < 220);
  assert.ok(md.includes(`**Verdict: ${R.headline}.**`));
  assert.equal(md, [...report(R), ...READING].join('\n') + '\n');
  assert.equal(R.tests.filter((t) => t.pass).length, 0);
  const [T1, T2, T3] = R.tests;
  assert.equal(T1.oos.trades, 17); assert.equal(T1.oos.netR, 0.319); assert.equal(T1.oos.monthNetT, 0.93);
  assert.equal(T1.placebo.atOrAbove, 37);
  const reading = READING.join(' ');
  for (const s of ['+0.319R', '+0.285R', '+0.563R', '1.87', '0.93', '1.21', '37 of 40', '1.56', '24 of 40', '−0.404R', 'n 53', '−2.47', '−0.301R', '−2.97']) assert.ok(reading.includes(s), s);
  assert.equal(T2.oos.netR, 0.285); assert.equal(T2.oos.monthNetT, 1.21); assert.equal(T2.placebo.atOrAbove, 24);
  assert.equal(T1.is.netR, 0.563); assert.equal(T1.is.monthNetT, 1.87); assert.equal(T1.placebo.p50, 1.56);
  assert.equal(T3.oos.netR, -0.404); assert.equal(T3.oos.trades, 53); assert.equal(T3.oos.monthNetT, -2.47);
  assert.equal(T3.is.netR, -0.301); assert.equal(T3.placebo.p50, -2.97);
  assert.equal(R.firstAfterGap.length, 9);
  assert.equal(R.firstAfterGap.filter((g) => g.how === 'time').length, 5);
  assert.ok(R.tests.every((t) => t.trades.every((x) => (t.side > 0 ? x.stop < x.entry : x.stop > x.entry))));
});

test('study on synthetic data runs end to end without touching the network', () => {
  const c = []; for (let i = 0; i < 5200; i++) c.push(700 + i * 0.3 + 40 * Math.sin(i / 23));
  const b = path(c, Date.UTC(2006, 2, 20) / 1000), r = study(b);
  assert.equal(r.tests.length, 3);
  assert.ok(r.tests.every((t) => Number.isFinite(t.oos.monthNetT) && t.placebo.p50 != null));
});
