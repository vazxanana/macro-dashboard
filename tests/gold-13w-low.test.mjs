// gold-13w-low: the rule on hand-made candles, no look-ahead, and the report against result.json (offline).
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { P, TESTS, weeksOf, lowEvent, highEvent, trade, runTest, pool, placebo, holm, verdictLine, READING } from '../research/edge/gold-13w-low/run.mjs';

const DIR = new URL('../research/edge/gold-13w-low/', import.meta.url);
const MON = Date.UTC(2024, 0, 1) / 1000; // a Monday
function make(nw, f) {
  const bars = []; let prev = 100;
  for (let w = 0; w < nw; w++) for (let d = 0; d < 5; d++) {
    const c = f(w, d), t = MON + (w * 7 + d) * 86400;
    bars.push({ time: t, open: prev, high: Math.max(prev, c) + 0.5, low: Math.min(prev, c) - 0.5, close: c }); prev = c;
  }
  return bars;
}
const [T1, T2, T3] = TESTS;

test('events: a close below each of the 12 previous weekly closes, the mirror for highs, and no look-ahead', () => {
  // flat at 100, week 15 closes at 90 (a 13-week low), week 20 at 110 (a 13-week high)
  const bars = make(30, (w, d) => (d === 4 ? (w === 15 ? 90 : w === 20 ? 110 : 100) : 100));
  const W = weeksOf(bars);
  assert.equal(lowEvent(W, 15), true); assert.equal(highEvent(W, 15), false);
  assert.equal(highEvent(W, 20), true); assert.equal(lowEvent(W, 20), false);
  assert.equal(lowEvent(W, 14), false); // equal closes are not a new low
  assert.equal(lowEvent(W, 11), false); // needs 12 earlier weeks
  // changing every price after week 15 does not change its event
  const ch = bars.map((b, i) => (i >= 16 * 5 ? { ...b, open: b.open / 3, high: b.high / 3, low: b.low / 3, close: b.close / 3 } : b));
  assert.equal(lowEvent(weeksOf(ch), 15), true);
});

test('trade: entry at the next week open, stop on the losing side, exit at week k+hold, costs and financing', () => {
  const bars = make(40, (w, d) => 100 + w * 0.2 + d * 0.05);
  const W = weeksOf(bars);
  const t = trade(bars, W, 20, T1);
  assert.equal(t.entry, bars[W[21].a].open); assert.equal(t.how, 'time'); assert.equal(t.exit, bars[W[24].b].close);
  assert.ok(t.stop < t.entry && Math.abs(t.entry - t.stop - t.dist) < 1e-9);
  assert.equal(t.nights, 27); // Mon-Thu nights (Wednesday x 3) of four weeks, plus the three Fridays held over a weekend
  assert.ok(Math.abs(t.costR - 0.6 / t.dist) < 1e-12);
  assert.ok(Math.abs(t.net - (t.gross - t.costR - t.finR)) < 1e-12);
  const s = trade(bars, W, 20, T3);
  assert.ok(s.stop > s.entry); assert.equal(s.finR, 0);
  const one = trade(bars, W, 20, T2);
  assert.equal(one.exit, bars[W[21].b].close); assert.equal(one.nights, 6);
  assert.equal(trade(bars, W, 37, T1), null); // no room for four weeks
  // a gap through the stop fills at the open
  const g = bars.map((b) => ({ ...b })), i = W[22].a; g[i].open = 50; g[i].low = 49;
  const tg = trade(g, weeksOf(g), 20, T1);
  assert.equal(tg.how, 'gap'); assert.equal(tg.exit, 50); assert.equal(tg.exitWeek, 22);
});

test('one position at a time; placebo keeps count and windows; Holm', () => {
  // a steady fall: every week from 12 on is a 13-week low
  const bars = make(60, (w, d) => 200 - w - d * 0.1);
  const W = weeksOf(bars), tr = runTest(bars, W, T1);
  assert.ok(tr.length > 2);
  for (let i = 1; i < tr.length; i++) assert.ok(tr[i].k >= tr[i - 1].exitWeek);
  const pp = pool(bars, W, T1);
  const pl = placebo(tr, pp, 3);
  assert.ok(pl.length <= tr.length);
  assert.deepEqual(holm([0.01, 0.04, 0.03]).map((x) => +x.toFixed(3)), [0.03, 0.06, 0.06]);
});

test('report: verdict line, headline and every quoted figure match result.json', () => {
  const r = JSON.parse(fs.readFileSync(new URL('result.json', DIR), 'utf8'));
  const md = fs.readFileSync(new URL('RESULT.md', DIR), 'utf8');
  assert.equal(r.params.LOOK, P.LOOK);
  assert.equal(r.verdict, r.tests.some((t) => t.pass) ? 'PASS' : 'FAIL');
  assert.equal(r.headline, verdictLine(r));
  assert.ok(r.headline.length < 220);
  assert.ok(md.includes(`**Verdict: ${r.headline}.**`));
  const [a, b, c] = r.tests, ef = r.everyFourth.oos, rd = READING.join('\n');
  const sg = (x, d = 3) => (x >= 0 ? '+' : '−') + Math.abs(x).toFixed(d);
  for (const s of [`${sg(a.oos.netR)}R a trade net (n ${a.oos.trades}, month t ${a.oos.monthNetT.toFixed(2)}`, `${sg(a.oos.grossR)}R gross`,
    `takes ${a.oos.finR.toFixed(3)}R`, `${sg(a.is.netR)}R (n ${a.is.trades}, t ${sg(a.is.monthNetT, 2)})`, `median t of ${a.placebo.p50.toFixed(2)}`,
    `below ${40 - a.placebo.below} of 40 seeds`, `${sg(ef.netR)}R a trade net out of sample (n ${ef.trades}, month t ${ef.monthNetT.toFixed(2)}, ${sg(ef.totalNet, 2)}R)`,
    `${sg(b.oos.netR)}R a trade net (n ${b.oos.trades}, t ${sg(b.oos.monthNetT, 2)})`, `${sg(b.is.netR)}R, n ${b.is.trades}`,
    `${sg(c.oos.netR)}R a trade out of sample (n ${c.oos.trades}, t ${sg(c.oos.monthNetT, 2)})`, `${sg(c.is.netR)}R in sample (n ${c.is.trades}, t ${sg(c.is.monthNetT, 2)})`,
    `median t ${sg(c.placebo.p50, 2)}`, `below ${40 - c.placebo.below} of 40 seeds`, `T1's ${sg(a.oos.totalNet, 2)}R`]) assert.ok(rd.includes(s), s);
  assert.equal(r.tests.filter((t) => t.pass).length, 0);
});
