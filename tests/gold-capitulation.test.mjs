// gold-capitulation: the rule on hand-made candles, no look-ahead, and the report against result.json (offline).
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { P, TESTS, eventAt, events, trade, runTest, pool, placebo, holm, monthly, verdictLine, READING } from '../research/edge/gold-capitulation/run.mjs';

const DIR = new URL('../research/edge/gold-capitulation/', import.meta.url);
const MON = Date.UTC(2010, 0, 4) / 1000; // a Monday
// n weekdays (Mon-Fri), close from f(i)
function make(n, f) {
  const bars = []; let prev = f(0), d = 0;
  for (let i = 0; i < n; i++) {
    const c = f(i), t = MON + (Math.floor(d / 5) * 7 + (d % 5)) * 86400; d++;
    bars.push({ time: t, open: prev, high: Math.max(prev, c) + 0.5, low: Math.min(prev, c) - 0.5, close: c }); prev = c;
  }
  return bars;
}
const wiggle = (i) => 100 + Math.sin(i * 0.7) * 0.8;
const [T1, T2, T3] = TESTS;

test('events: the lowest / highest 5-day return of the past 252 days, strict, and no look-ahead', () => {
  const cap = 300, blow = 340;
  const ramp = (i, at, k) => k * Math.min(5, Math.max(0, i - at + 5));
  const f = (i) => wiggle(i) - ramp(i, cap, 2) + ramp(i, blow, 4);
  const bars = make(400, f);
  assert.equal(eventAt(bars, cap), 'cap');
  assert.equal(eventAt(bars, blow), 'blow');
  assert.equal(eventAt(bars, 200), null);
  assert.equal(eventAt(bars, P.LOOK + P.RET - 2), null); // needs 256 earlier closes
  // changing every price after the signal day leaves its event as it was
  const ch = bars.map((b, i) => (i > cap ? { ...b, open: b.open * 3, high: b.high * 3, low: b.low * 3, close: b.close * 3 } : b));
  assert.equal(eventAt(ch, cap), 'cap');
  // a tie with an earlier 5-day return is not a new extreme
  const flat = make(300, () => 100);
  assert.equal(eventAt(flat, 280), null);
});

test('trade: next open entry, 2 x ATR stop on the losing side, ten days held, costs and financing', () => {
  const bars = make(60, (i) => 100 + i * 0.1);
  const t = trade(bars, 30, 1);
  assert.equal(t.entry, bars[31].open); assert.equal(t.how, 'time'); assert.equal(t.exit, bars[40].close);
  assert.ok(t.stop < t.entry && Math.abs(t.entry - t.stop - t.dist) < 1e-9);
  assert.ok(Math.abs(t.costR - 0.6 / t.dist) < 1e-12);
  assert.ok(t.nights > 0 && t.finR > 0);
  assert.ok(Math.abs(t.net - (t.gross - t.costR - t.finR)) < 1e-12);
  const s = trade(bars, 30, -1);
  assert.ok(s.stop > s.entry); assert.equal(s.finR, 0); assert.equal(s.nights, 0);
  assert.equal(trade(bars, 55, 1), null); // no room for ten days
  // a gap through the stop fills at the open
  const g = bars.map((b) => ({ ...b })); g[33].open = 50; g[33].low = 49;
  const tg = trade(g, 30, 1);
  assert.equal(tg.how, 'gap'); assert.equal(tg.exit, 50); assert.equal(tg.xi, 33);
});

test('one position at a time, sides per test; placebo keeps sides and count; Holm; empty months count', () => {
  const bars = make(600, (i) => 300 - i * 0.3 - (i % 37 === 0 ? 4 : 0) + Math.sin(i) * 0.2);
  const evs = events(bars);
  const tr = runTest(bars, evs, T1);
  for (let i = 1; i < tr.length; i++) assert.ok(tr[i].i > tr[i - 1].xi);
  for (const t of runTest(bars, evs, T2)) assert.equal(t.side, 1);
  for (const t of runTest(bars, evs, T3)) { const e = evs.find((x) => x.i === t.i).ev; assert.equal(t.side, e === 'cap' ? -1 : 1); }
  const pools = { 1: pool(bars, 1), '-1': pool(bars, -1) };
  const pl = placebo(tr, pools, 7);
  assert.ok(pl.length <= tr.length);
  assert.deepEqual(holm([0.01, 0.04, 0.03]).map((x) => +x.toFixed(3)), [0.03, 0.06, 0.06]);
  assert.equal(monthly([], P.OOS).length, 118);
});

test('report: verdict line, headline and every quoted figure match result.json', () => {
  const r = JSON.parse(fs.readFileSync(new URL('result.json', DIR), 'utf8'));
  const md = fs.readFileSync(new URL('RESULT.md', DIR), 'utf8');
  assert.equal(r.params.LOOK, P.LOOK); assert.equal(r.params.HOLD, P.HOLD);
  assert.equal(r.verdict, r.tests[0].pass ? 'PASS' : 'FAIL');
  assert.equal(r.headline, verdictLine(r));
  assert.ok(r.headline.length < 220);
  assert.ok(md.includes(`**Verdict: ${r.headline}.**`));
  const [a, b, c] = r.tests, bl = r.baseline.long.oos, rd = READING.join('\n');
  const sg = (x, d = 3) => (x >= 0 ? '+' : '−') + Math.abs(x).toFixed(d);
  for (const s of [`${sg(a.oos.netR)}R a trade net (n ${a.oos.trades}, month t ${a.oos.monthNetT.toFixed(2)}; ${sg(a.oos.grossR)}R gross)`,
    `(${a.placebo.below} of 40 seeds below)`, `${sg(a.is.netR)}R a trade (n ${a.is.trades}, month t ${sg(a.is.monthNetT, 2)})`,
    `${a.oos.costR.toFixed(3)}R spread and slippage, ${a.oos.finR.toFixed(3)}R financing`,
    `${sg(b.oos.netR)}R out of sample on only ${b.oos.trades} trades (t ${b.oos.monthNetT.toFixed(2)})`, `${sg(b.is.netR)}R in sample (n ${b.is.trades}, t ${sg(b.is.monthNetT, 2)})`,
    `${sg(bl.netR)}R net out of sample (n ${bl.trades}, t ${bl.monthNetT.toFixed(2)})`,
    `${sg(c.is.netR)}R in sample (n ${c.is.trades}, t ${c.is.monthNetT.toFixed(2)})`, `${sg(c.oos.netR)}R out of sample (n ${c.oos.trades}, t ${sg(c.oos.monthNetT, 2)})`]) assert.ok(rd.includes(s), s);
  assert.equal(r.tests.filter((t) => t.pass).length, 0);
  assert.equal(r.preregCommit, '0f84ea91a');
});
