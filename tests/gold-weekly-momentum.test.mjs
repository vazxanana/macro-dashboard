// gold-weekly-momentum: the rule on hand-made candles, no look-ahead, and the report against result.json (offline).
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { P, weeksOf, weekKey, SIGNALS, trade, runTest, placebo, holm, READING } from '../research/edge/gold-weekly-momentum/run.mjs';

const DIR = new URL('../research/edge/gold-weekly-momentum/', import.meta.url);
const MON = Date.UTC(2024, 0, 1) / 1000; // a Monday
// n weeks of Mon-Fri candles; f(week, day) -> close; open = previous close
function make(nw, f) {
  const bars = []; let prev = 100;
  for (let w = 0; w < nw; w++) for (let d = 0; d < 5; d++) {
    const c = f(w, d), t = MON + (w * 7 + d) * 86400;
    bars.push({ time: t, open: prev, high: Math.max(prev, c) + 0.5, low: Math.min(prev, c) - 0.5, close: c }); prev = c;
  }
  return bars;
}

test('weeks group Monday to Friday, and a last week not ending on Friday is dropped', () => {
  const bars = make(3, (w, d) => 100 + w * 5 + d);
  assert.equal(weekKey(MON + 4 * 86400), MON);
  let W = weeksOf(bars);
  assert.equal(W.length, 3);
  assert.equal(W[1].open, bars[5].open); assert.equal(W[1].close, bars[9].close);
  assert.ok(Math.abs(W[1].r - (bars[9].close / bars[5].open - 1)) < 1e-12);
  W = weeksOf(bars.slice(0, 13));
  assert.equal(W.length, 2);
});

test('signals: momentum signs, four-week sign, reversal only past 2 sd, and no look-ahead', () => {
  const bars = make(60, (w, d) => 100 + (w % 2 ? -1 : 1) * d * 0.2 + w * 0.01 + (w === 57 ? d * 3 : 0));
  const W = weeksOf(bars);
  assert.equal(SIGNALS.mom1(W, 0), 1); assert.equal(SIGNALS.mom1(W, 1), -1);
  assert.equal(SIGNALS.mom4(W, 2), 0);
  assert.equal(SIGNALS.mom4(W, 3), Math.sign(W[3].close / W[0].open - 1));
  assert.equal(SIGNALS.rev(W, 51), 0);
  assert.equal(SIGNALS.rev(W, 57), -1); // a big up week -> short
  assert.equal(SIGNALS.rev(W, 56), 0);
  const before = [0, 10, 30, 57].map((k) => [SIGNALS.mom1(W, k), SIGNALS.mom4(W, k), SIGNALS.rev(W, k)]);
  const changed = bars.map((b, i) => (i >= 58 * 5 ? { ...b, open: b.open * 3, high: b.high * 3, low: b.low * 3, close: b.close * 3 } : b));
  const W2 = weeksOf(changed);
  assert.deepEqual([0, 10, 30, 57].map((k) => [SIGNALS.mom1(W2, k), SIGNALS.mom4(W2, k), SIGNALS.rev(W2, k)]), before);
});

test('trade: next week open to Friday close, 2 x ATR stop, gap fill, costs and six nights of financing', () => {
  const bars = make(6, (w, d) => 100 + w + d * 0.1);
  const W = weeksOf(bars);
  const t = trade(bars, W, 4, 1);
  assert.equal(t.entry, bars[W[5].a].open); assert.equal(t.exit, bars[W[5].b].close); assert.equal(t.how, 'time');
  assert.ok(Math.abs(t.stop - (t.entry - t.dist)) < 1e-9);
  assert.equal(t.nights, 6);
  assert.ok(Math.abs(t.costR - 0.6 / t.dist) < 1e-12);
  assert.ok(Math.abs(t.net - (t.gross - t.costR - t.finR)) < 1e-12);
  const s = trade(bars, W, 4, -1);
  assert.equal(s.finR, 0); assert.equal(s.nights, 0);
  // a Wednesday gap down through a long stop fills at the open
  const g = bars.map((b) => ({ ...b }));
  const wed = W[5].a + 2; g[wed].open = 50; g[wed].low = 49.5;
  const tg = trade(g, weeksOf(g), 4, 1);
  assert.equal(tg.how, 'gap'); assert.equal(tg.exit, 50);
  assert.equal(trade(bars, W, 5, 1), null); // no week after the last
  assert.equal(trade(bars, W, 4, 0), null);
});

test('placebo keeps the weeks and the long / short share; Holm', () => {
  const bars = make(40, (w, d) => 100 + Math.sin(w) * 3 + d * 0.1);
  const W = weeksOf(bars), real = runTest(bars, W, 'mom1'), pl = placebo(bars, W, real, 7);
  assert.equal(pl.length, real.length);
  assert.deepEqual(pl.map((t) => t.k), real.map((t) => t.k));
  assert.equal(pl.filter((t) => t.side > 0).length, real.filter((t) => t.side > 0).length);
  assert.deepEqual(holm([0.01, 0.04, 0.03]).map((x) => +x.toFixed(3)), [0.03, 0.06, 0.06]);
});

test('report: verdict line, headline and every quoted figure match result.json', () => {
  const r = JSON.parse(fs.readFileSync(new URL('result.json', DIR), 'utf8'));
  const md = fs.readFileSync(new URL('RESULT.md', DIR), 'utf8');
  assert.equal(r.params.ATR_MULT, P.ATR_MULT);
  assert.equal(r.verdict, r.tests.some((t) => t.pass) ? 'PASS' : 'FAIL');
  assert.ok(r.headline.length < 220);
  assert.ok(md.includes(`**Verdict: ${r.headline}.**`));
  const [T1, T2, T3] = r.tests, al = r.alwaysLong;
  for (const t of r.tests) assert.equal(t.pass, Object.values(t.checks).every(Boolean));
  const q = (x, d = 3) => (x < 0 ? '−' : '+') + Math.abs(x).toFixed(d);
  const text = READING.join('\n');
  for (const s of [q(T1.oos.netR), `n ${T1.oos.trades}`, `t ${T1.oos.monthNetT.toFixed(2)}`, q(T1.oos.grossR), `${T1.oos.monthGrossT}`,
    q(T1.is.netR), `n ${T1.is.trades}`, `${T1.holmP}`, `${T1.placebo.below} of 40`, `${T1.placebo.p95}`, q(T1.oos.x2Net),
    q(al.oos.netR), `${al.oos.monthNetT}`, q(al.oos.totalNet, 2), q(T1.oos.totalNet, 2),
    q(T1.legs.oos.long.netR), q(T1.legs.oos.long.totalNet, 2), q(T1.legs.oos.short.netR), q(T1.legs.oos.short.totalNet, 2),
    q(T2.oos.netR), q(T2.is.netR), q(T2.legs.oos.short.netR), q(T3.oos.netR), q(T3.is.netR), `${T3.oos.trades} trades`, `${T3.is.trades} in sample`]) {
    assert.ok(text.includes(s), `reading quotes ${s}`);
  }
  assert.ok(md.includes(READING[0]));
});
