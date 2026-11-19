// gold-week-exhaustion: the rule on hand-made candles, no look-ahead, and the report against result.json (offline).
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { P, TESTS, weekKey, weeks, awr, eventAt, events, trade, runTest, baselineTrades, placebo, holm, monthly, excessOf, verdictLine, READING } from '../research/edge/gold-week-exhaustion/run.mjs';

const DIR = new URL('../research/edge/gold-week-exhaustion/', import.meta.url);
const MON = Date.UTC(2010, 0, 4) / 1000; // a Monday
// n weekdays (Mon-Fri), each day's close from f(i); range 1 around open / close
function make(n, f) {
  const bars = []; let prev = f(0);
  for (let d = 0; d < n; d++) {
    const c = f(d), t = MON + (Math.floor(d / 5) * 7 + (d % 5)) * 86400;
    bars.push({ time: t, open: prev, high: Math.max(prev, c) + 0.5, low: Math.min(prev, c) - 0.5, close: c }); prev = c;
  }
  return bars;
}
const [T1, T2, T3] = TESTS;

test('weeks: Monday key, week open, positions; mean range of the 10 previous weeks only', () => {
  const bars = make(100, (i) => 100 + (i % 5));
  assert.equal(weekKey(bars[3].time), bars[0].time);
  const wx = weeks(bars);
  assert.equal(wx.W.length, 20);
  assert.deepEqual(wx.pos.slice(0, 7), [0, 1, 2, 3, 4, 0, 1]);
  assert.equal(wx.W[1].open, bars[5].open);
  assert.equal(awr(wx.W, 9), null);
  const want = wx.W.slice(0, 10).reduce((a, w) => a + w.high - w.low, 0) / 10;
  assert.equal(awr(wx.W, 10), want);
});

test('signal: fade a week already moved 0.75 x AWR by its 3rd day; nothing later in the week; no look-ahead', () => {
  // quiet weeks (range ~5), then a week that jumps +20 on its Tuesday
  const bars = make(80, (i) => 100 + (i % 5) + (i >= 61 && i < 65 ? 20 : 0));
  const e = eventAt(bars, 61);
  assert.ok(e && e.side === -1 && e.move > 0);
  // a move on the 4th day of a week is not a signal
  const late = make(80, (i) => 100 + (i % 5) + (i === 63 ? 20 : 0));
  assert.equal(eventAt(late, 63), null);
  // down weeks are bought
  const dn = make(80, (i) => 100 + (i % 5) - (i >= 61 && i < 65 ? 20 : 0));
  assert.equal(eventAt(dn, 61).side, 1);
  // one signal a week, the first; its next day in the same week
  const ev = events(bars);
  assert.equal(ev.filter((x) => x.i >= 60 && x.i < 65).length, 1);
  // changing every price after the signal day leaves the signal as it was
  const ch = bars.map((b, k) => (k > 61 ? { ...b, open: b.open * 3, high: b.high * 3, low: b.low * 3, close: b.close * 0.2 } : b));
  assert.deepEqual(eventAt(ch, 61), eventAt(bars, 61));
  assert.deepEqual(events(ch).find((x) => x.i === 61), events(bars).find((x) => x.i === 61));
});

test('trade: next open, 1.5 x ATR stop on the losing side, out at the week\'s last close, costs and financing', () => {
  const bars = make(60, (i) => 100 + i * 0.1);
  const t = trade(bars, 31, 1); // Tuesday signal, Wednesday entry
  assert.equal(t.entry, bars[32].open); assert.equal(t.how, 'time'); assert.equal(t.xi, 34); assert.equal(t.exit, bars[34].close);
  assert.ok(t.stop < t.entry && Math.abs(t.entry - t.stop - t.dist) < 1e-9);
  assert.ok(Math.abs(t.costR - 0.6 / t.dist) < 1e-12);
  assert.ok(t.nights > 0 && t.finR > 0);
  assert.ok(Math.abs(t.net - (t.gross - t.costR - t.finR)) < 1e-12);
  const s = trade(bars, 31, -1);
  assert.ok(s.stop > s.entry); assert.equal(s.finR, 0); assert.equal(s.nights, 0);
  assert.equal(trade(bars, 34, 1), null); // Friday signal: next day is another week
  const g = bars.map((b) => ({ ...b })); g[33].open = 50; g[33].low = 49;
  const tg = trade(g, 31, 1);
  assert.equal(tg.how, 'gap'); assert.equal(tg.exit, 50); assert.equal(tg.xi, 33);
});

test('tests keep their sides, baseline matches, placebo, Holm, empty months count', () => {
  const bars = make(900, (i) => 300 + 25 * Math.sin(i / 7) + 4 * Math.sin(i * 1.3) + i * 0.03);
  const evs = events(bars), tr = runTest(bars, evs, T1);
  assert.ok(tr.length > 10);
  for (let i = 1; i < tr.length; i++) assert.ok(tr[i].i > tr[i - 1].xi);
  for (const t of runTest(bars, evs, T2)) assert.equal(t.side, 1);
  for (const t of runTest(bars, evs, T3)) assert.equal(t.side, -1);
  const base = [...baselineTrades(bars, 1), ...baselineTrades(bars, -1)];
  // a signal trade is one of the baseline trades (same day, side): the baseline is the same trade on every week
  for (const t of tr) assert.ok(base.some((b) => b.i === t.i && b.side === t.side && b.net === t.net));
  const w = { from: '2000-01', to: '2030-12' };
  const ex = excessOf(tr, base, w);
  assert.ok(Number.isFinite(ex.excess) && Number.isFinite(ex.t));
  const pl = placebo(tr, base, 7);
  assert.ok(pl.length <= tr.length);
  assert.deepEqual(holm([0.01, 0.04, 0.03]).map((x) => +x.toFixed(3)), [0.03, 0.06, 0.06]);
  assert.equal(monthly([], P.OOS).length, 118);
});

test('report and result.json agree; verdict line in the bold line and under 220 characters', () => {
  const res = JSON.parse(fs.readFileSync(new URL('result.json', DIR), 'utf8'));
  const md = fs.readFileSync(new URL('RESULT.md', DIR), 'utf8');
  const line = verdictLine(res);
  assert.equal(res.headline, line);
  assert.ok(line.length < 220);
  assert.ok(md.includes(`**Verdict: ${line}.**`));
  assert.equal(res.verdict, res.tests[0].pass ? 'PASS' : 'FAIL');
  assert.equal(res.verdict, 'FAIL');
  const [t1, t2, t3] = res.tests;
  const f = (x, d = 3) => (x > 0 ? '+' : x < 0 ? '−' : '') + Math.abs(x).toFixed(d);
  const rd = READING.join('\n');
  assert.ok(rd.includes(`${f(t1.oos.netR)}R a trade net (n ${t1.oos.trades}, month t ${f(t1.oos.monthNetT, 2)}`));
  assert.ok(rd.includes(`in sample ${f(t1.is.netR)}R (n ${t1.is.trades}, month t ${f(t1.is.monthNetT, 2)})`));
  assert.ok(rd.includes(`${t1.placebo.below} of 40 placebo`));
  assert.ok(rd.includes(`made ${f(t1.oos.baseNet)}R, so T1 is ${f(t1.oos.excess)}R above it (t ${t1.oos.excessT.toFixed(2)})`));
  assert.ok(rd.includes(`${f(t2.oos.netR)}R net out of sample against ${f(t2.oos.baseNet)}R`));
  assert.ok(rd.includes(`excess ${f(t3.oos.excess)}R, t ${t3.oos.excessT.toFixed(2)}`));
  assert.ok(rd.includes(`${f(res.baseline.continuation.oos.netR)}R out of sample (n ${res.baseline.continuation.oos.trades})`));
  assert.ok(rd.includes(`median stop $${t1.oos.medStop.toFixed(2)}`));
  for (const t of res.tests) assert.equal(t.pass, Object.values(t.checks).every(Boolean));
});
