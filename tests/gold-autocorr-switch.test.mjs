// gold-autocorr-switch: the rule on hand-made candles, no look-ahead, and the report against result.json (offline).
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { P, TESTS, acAt, eventAt, events, trade, runTest, uncond, pool, placebo, holm, monthly, verdictLine, READING } from '../research/edge/gold-autocorr-switch/run.mjs';

const DIR = new URL('../research/edge/gold-autocorr-switch/', import.meta.url);
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
const [T1, T2, T3] = TESTS;

test('autocorrelation: positive on persistent returns, negative on alternating ones, and no look-ahead', () => {
  // alternating up / down returns: lag-1 correlation near -1
  const alt = make(200, (i) => 100 * Math.exp(0.01 * (i % 2)));
  assert.ok(acAt(alt, 150) < -0.9);
  // returns in long runs (10 up, 10 down): clearly positive
  let c = 100; const runs = [100]; for (let i = 1; i < 200; i++) { c *= Math.exp(Math.floor(i / 10) % 2 ? -0.01 : 0.012); runs.push(c); }
  const pb = make(200, (i) => runs[i]);
  assert.ok(acAt(pb, 150) > 0.5);
  assert.equal(acAt(pb, P.AC_N), null); // needs AC_N + 1 returns before
  // changing every price after day i leaves AC(i) and the signal of day i as they were
  const ch = pb.map((b, k) => (k > 150 ? { ...b, open: b.open * 3, high: b.high * 3, low: b.low * 3, close: b.close * 7 } : b));
  assert.equal(acAt(ch, 150), acAt(pb, 150));
  assert.deepEqual(eventAt(ch, 150), eventAt(pb, 150));
});

test('signal: follow the 5-day move when AC > 0, fade it when AC < 0, nothing on a flat 5 days', () => {
  let c = 100; const runs = [100]; for (let i = 1; i < 200; i++) { c *= Math.exp(Math.floor(i / 10) % 2 ? -0.01 : 0.012); runs.push(c); }
  const pb = make(200, (i) => runs[i]);
  for (let i = 80; i < 190; i++) {
    const e = eventAt(pb, i); if (!e) continue;
    const dir = Math.sign(pb[i].close - pb[i - 5].close);
    assert.equal(e.regime, e.ac > 0 ? 'mom' : 'rev');
    assert.equal(e.side, e.regime === 'mom' ? dir : -dir);
  }
  const alt = make(200, (i) => 100 * Math.exp(0.01 * (i % 2)) + i * 0.001);
  const ea = eventAt(alt, 150);
  assert.equal(ea.regime, 'rev'); assert.equal(ea.side, -Math.sign(alt[150].close - alt[145].close));
  const flat = make(200, () => 100);
  assert.equal(eventAt(flat, 150), null);
});

test('trade: next open entry, 2 x ATR stop on the losing side, five days held, costs and financing', () => {
  const bars = make(60, (i) => 100 + i * 0.1);
  const t = trade(bars, 30, 1);
  assert.equal(t.entry, bars[31].open); assert.equal(t.how, 'time'); assert.equal(t.exit, bars[35].close);
  assert.ok(t.stop < t.entry && Math.abs(t.entry - t.stop - t.dist) < 1e-9);
  assert.ok(Math.abs(t.costR - 0.6 / t.dist) < 1e-12);
  assert.ok(t.nights > 0 && t.finR > 0);
  assert.ok(Math.abs(t.net - (t.gross - t.costR - t.finR)) < 1e-12);
  const s = trade(bars, 30, -1);
  assert.ok(s.stop > s.entry); assert.equal(s.finR, 0); assert.equal(s.nights, 0);
  assert.equal(trade(bars, 56, 1), null); // no room for five days
  const g = bars.map((b) => ({ ...b })); g[33].open = 50; g[33].low = 49;
  const tg = trade(g, 30, 1);
  assert.equal(tg.how, 'gap'); assert.equal(tg.exit, 50); assert.equal(tg.xi, 33);
});

test('one position at a time, legs keep their regime; comparisons; placebo; Holm; empty months count', () => {
  const bars = make(700, (i) => 300 + 20 * Math.sin(i / 9) + 3 * Math.sin(i * 1.7) + i * 0.05);
  const evs = events(bars);
  const tr = runTest(bars, evs, T1);
  assert.ok(tr.length > 10);
  for (let i = 1; i < tr.length; i++) assert.ok(tr[i].i > tr[i - 1].xi);
  for (const t of runTest(bars, evs, T2)) assert.equal(t.regime, 'mom');
  for (const t of runTest(bars, evs, T3)) assert.equal(t.regime, 'rev');
  for (const t of uncond(bars, 1, 61)) assert.equal(t.side, Math.sign(bars[t.i].close - bars[t.i - 5].close));
  const pools = { 1: pool(bars, 1), '-1': pool(bars, -1) };
  assert.ok(placebo(tr, pools, 7).length <= tr.length);
  assert.deepEqual(holm([0.01, 0.04, 0.03]).map((x) => +x.toFixed(3)), [0.03, 0.06, 0.06]);
  assert.equal(monthly([], P.OOS).length, 118);
});

test('report: verdict line, headline and every quoted figure match result.json', () => {
  const r = JSON.parse(fs.readFileSync(new URL('result.json', DIR), 'utf8'));
  const md = fs.readFileSync(new URL('RESULT.md', DIR), 'utf8');
  assert.equal(r.params.AC_N, P.AC_N); assert.equal(r.params.HOLD, P.HOLD);
  assert.equal(r.verdict, r.tests[0].pass ? 'PASS' : 'FAIL');
  assert.equal(r.headline, verdictLine(r));
  assert.ok(r.headline.length < 220);
  assert.ok(md.includes(`**Verdict: ${r.headline}.**`));
  const [a, b, c] = r.tests, B = r.baseline, rd = READING.join('\n');
  const sg = (x, d = 3) => (x >= 0 ? '+' : '−') + Math.abs(x).toFixed(d);
  for (const s of [`${sg(a.oos.netR)}R a trade net (n ${a.oos.trades}, month t ${sg(a.oos.monthNetT, 2)}; ${sg(a.oos.grossR)}R gross)`,
    `in sample ${sg(a.is.netR)}R (n ${a.is.trades}, month t ${sg(a.is.monthNetT, 2)})`, `${a.placebo.below} of 40 placebo seeds`,
    `${a.oos.costR.toFixed(3)}R spread and slippage, ${a.oos.finR.toFixed(3)}R financing`,
    `${sg(b.oos.netR)}R net out of sample (n ${b.oos.trades}, t ${b.oos.monthNetT.toFixed(2)}; Holm p ${b.holmP.toFixed(3)})`,
    `${sg(b.is.netR)}R in sample (n ${b.is.trades}, t ${b.is.monthNetT.toFixed(2)})`,
    `${sg(B.momentum.oos.netR)}R out of sample (n ${B.momentum.oos.trades}, t ${B.momentum.oos.monthNetT.toFixed(2)})`,
    `${sg(B.momentum.is.netR)}R in sample (n ${B.momentum.is.trades}, t ${B.momentum.is.monthNetT.toFixed(2)})`,
    `${sg(c.oos.netR)}R out of sample (n ${c.oos.trades}, t ${sg(c.oos.monthNetT, 2)})`, `${sg(c.is.netR)}R in sample`,
    `${sg(B.reversal.oos.netR)}R out of sample, n ${B.reversal.oos.trades}, t ${sg(B.reversal.oos.monthNetT, 2)}`,
    `${sg(B.long.oos.netR)}R out of sample, n ${B.long.oos.trades}, t ${B.long.oos.monthNetT.toFixed(2)}`]) assert.ok(rd.includes(s), s);
  assert.equal(r.tests.filter((t) => t.pass).length, 0);
  assert.equal(r.preregCommit, '9aeba8af3');
});
