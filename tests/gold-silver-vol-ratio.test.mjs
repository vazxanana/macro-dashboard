// gold-silver-vol-ratio: the rule on hand-made candles, no look-ahead, and the report against result.json (offline).
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { P, join, ratios, sideAt, trade, runTest, baselineTrades, TESTS, excessOf, placebo, holm, monthly, verdictLine, READING } from '../research/edge/gold-silver-vol-ratio/run.mjs';

const DIR = new URL('../research/edge/gold-silver-vol-ratio/', import.meta.url);
const T0 = Date.UTC(2010, 0, 4) / 1000;
// weekdays only; gold path g(i), silver path s(i)
function make(n, g, s) {
  const out = []; let d = 0;
  for (let i = 0; i < n; i++) {
    while ([0, 6].includes(new Date((T0 + d * 86400) * 1000).getUTCDay())) d++;
    const c = g(i), o = i ? g(i - 1) : c;
    out.push({ time: T0 + d * 86400, open: o, high: Math.max(o, c) + 1, low: Math.min(o, c) - 1, close: c, sc: s(i) });
    d++;
  }
  return out;
}

test('join keeps only days both markets have, silver close as sc', () => {
  const g = [{ time: 1, open: 1, high: 2, low: 0, close: 1 }, { time: 2, open: 1, high: 2, low: 0, close: 1.5 }, { time: 3, open: 1, high: 2, low: 0, close: 2 }];
  const s = [{ time: 2, close: 20 }, { time: 3, close: 21 }];
  const j = join(g, s);
  assert.deepEqual(j.map((b) => [b.time, b.sc]), [[2, 20], [3, 21]]);
});

test('ratio and percentile: silver calm against gold gives a low signal, wild gives high; no look-ahead', () => {
  // silver as volatile as gold for 400 days, then silver nearly flat while gold keeps moving -> Q falls to its low
  const n = 600;
  const g = (i) => 1000 + 20 * Math.sin(i * 1.7);
  const sCalm = (i) => (i < 450 ? 20 + 0.8 * Math.sin(i * 1.7) * (1 + 0.3 * Math.sin(i / 13)) : 20 + 0.05 * Math.sin(i * 1.7));
  const bars = make(n, g, sCalm), { Q, pct } = ratios(bars);
  assert.equal(pct[P.PCT_N - 2], null);
  assert.ok(pct[480] <= P.LOW); assert.equal(sideAt(pct[480]), 1);
  const sWild = (i) => (i < 450 ? 20 + 0.4 * Math.sin(i * 1.7) * (1 + 0.3 * Math.sin(i / 13)) : 20 + 2 * Math.sin(i * 1.7));
  const w = ratios(make(n, g, sWild));
  assert.equal(sideAt(w.pct[480]), -1);
  // changing every price after day 480 leaves Q and pct up to 480 unchanged
  const b2 = bars.map((b, i) => (i > 480 ? { ...b, close: b.close * 3, sc: b.sc * 0.2 } : b));
  const r2 = ratios(b2);
  for (let i = 0; i <= 480; i++) { assert.equal(r2.Q[i], Q[i]); assert.equal(r2.pct[i], pct[i]); }
  assert.equal(sideAt(0.5), 0); assert.equal(sideAt(null), 0);
});

test('trade: next open entry, ATR stop on the losing side, five-day hold, costs and financing', () => {
  const bars = make(80, (i) => 100 + i * 0.5, () => 10);
  const t = trade(bars, 40, 1);
  assert.equal(t.entry, bars[41].open); assert.ok(t.stop < t.entry); assert.equal(t.xi, 45); assert.equal(t.how, 'time');
  assert.ok(t.gross > 0); assert.ok(t.finR > 0); assert.ok(t.nights >= 5);
  assert.ok(Math.abs(t.net - (t.gross - t.costR - t.finR)) < 1e-12);
  const s = trade(bars, 40, -1);
  assert.ok(s.stop > s.entry); assert.equal(s.finR, 0); assert.ok(s.how === 'stop' || s.how === 'gap' || s.gross < 0);
  assert.equal(trade(bars, 76, 1), null);
  const g = bars.map((b) => ({ ...b })); g[43].open = 50; g[43].low = 49;
  const tg = trade(g, 40, 1);
  assert.equal(tg.how, 'gap'); assert.equal(tg.exit, 50); assert.equal(tg.xi, 43);
});

test('streams are one trade at a time with their sides; baseline, excess, placebo, Holm, empty months', () => {
  const g = (i) => 1000 + 30 * Math.sin(i / 9) + 8 * Math.sin(i * 1.7) + i * 0.1;
  const s = (i) => 20 + (0.2 + 0.18 * Math.sin(i / 40)) * Math.sin(i * 1.7) + 0.3 * Math.sin(i / 9);
  const bars = make(1400, g, s), { pct } = ratios(bars);
  const [T1, T2, T3] = TESTS;
  const t1 = runTest(bars, pct, T1), t2 = runTest(bars, pct, T2), t3 = runTest(bars, pct, T3);
  assert.ok(t1.length > 5 && t2.length > 5);
  for (const t of t1) assert.equal(t.side, 1);
  for (const t of t2) assert.equal(t.side, -1);
  for (let i = 1; i < t3.length; i++) assert.ok(t3[i].i >= t3[i - 1].xi);
  const base = [...baselineTrades(bars, pct, 1), ...baselineTrades(bars, pct, -1)];
  for (const t of t3) assert.ok(base.some((b) => b.i === t.i && b.side === t.side && b.net === t.net));
  const ex = excessOf(t3, base, { from: '2000-01', to: '2030-12' });
  assert.ok(Number.isFinite(ex.excess) && Number.isFinite(ex.t));
  assert.ok(placebo(t3, base, 3).length <= t3.length);
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
  assert.ok(rd.includes(`${f(t1.oos.netR)}R a trade net (n ${t1.oos.trades}, month t ${f(t1.oos.monthNetT, 2).replace('+', '')}; ${f(t1.oos.grossR)}R gross)`));
  assert.ok(rd.includes(`in sample ${f(t1.is.netR)}R (n ${t1.is.trades}, month t ${f(t1.is.monthNetT, 2)})`));
  assert.ok(rd.includes(`only ${t1.placebo.below} of 40 placebo`));
  assert.ok(rd.includes(`at 2x costs (${f(t1.oos.x2Net)}R)`));
  assert.ok(rd.includes(`made ${f(t1.oos.baseNet)}R net out of sample`));
  assert.ok(rd.includes(`${Math.abs(t1.oos.excess).toFixed(3)}R a trade WORSE than an ordinary day (t ${f(t1.oos.excessT, 2)})`));
  assert.ok(rd.includes(`in sample ${f(t1.is.excess)}R (t ${f(t1.is.excessT, 2)})`));
  assert.ok(rd.includes(`T2 lost ${f(t2.oos.netR)}R a trade net out of sample (n ${t2.oos.trades}, month t ${f(t2.oos.monthNetT, 2)}) and ${f(t2.is.netR)}R in sample`));
  assert.ok(rd.includes(`(${f(t2.oos.excess)}R out of sample, t ${f(t2.oos.excessT, 2)})`));
  assert.ok(rd.includes(`lost ${f(t3.oos.netR)}R net out of sample (n ${t3.oos.trades}, month t ${f(t3.oos.monthNetT, 2)})`));
  assert.ok(rd.includes(`(median stop $${Math.round(t1.oos.medStop)})`));
  for (const t of res.tests) assert.equal(t.pass, Object.values(t.checks).every(Boolean));
});
