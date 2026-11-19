// gold-weekly-stoch: the rule on hand-made candles, no look-ahead, and the report against result.json (offline).
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { P, weeksOf, stochK, SIGNALS, trade, runTest, placebo, holm, verdictOf, READING } from '../research/edge/gold-weekly-stoch/run.mjs';

const DIR = new URL('../research/edge/gold-weekly-stoch/', import.meta.url);
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

test('weekly high / low and %K(14) from the last 14 weeks only', () => {
  const bars = make(20, (w, d) => 100 + w + d * 0.2);
  const W = weeksOf(bars);
  assert.equal(W[3].high, Math.max(...bars.slice(15, 20).map((b) => b.high)));
  assert.equal(W[3].low, Math.min(...bars.slice(15, 20).map((b) => b.low)));
  assert.equal(stochK(W, 12), null);
  const k = 15, hi = Math.max(...W.slice(k - 13, k + 1).map((w) => w.high)), lo = Math.min(...W.slice(k - 13, k + 1).map((w) => w.low));
  assert.ok(Math.abs(stochK(W, k) - 100 * (W[k].close - lo) / (hi - lo)) < 1e-9);
});

test('signals: fade, turn and follow at 20 / 80, and no look-ahead', () => {
  // up 14 weeks (K high), then down hard (K low), then a bounce
  const path = (w) => (w < 16 ? 100 + w * 2 : w < 22 ? 130 - (w - 15) * 6 : 94 + (w - 21) * 4);
  const bars = make(30, (w, d) => path(w) + (d - 4) * 0.01);
  const W = weeksOf(bars);
  const K = W.map((_, k) => stochK(W, k));
  assert.ok(K[15] > 80 && K[21] < 20);
  assert.equal(SIGNALS.fade(W, 15), -1); assert.equal(SIGNALS.follow(W, 15), 1);
  assert.equal(SIGNALS.fade(W, 21), 1); assert.equal(SIGNALS.follow(W, 21), -1);
  assert.equal(SIGNALS.fade(W, 5), 0); // no %K yet
  const up = K.findIndex((x, k) => k > 21 && x >= 20 && K[k - 1] < 20);
  assert.ok(up > 21);
  assert.equal(SIGNALS.turn(W, up), 1);
  const dn = K.findIndex((x, k) => k > 0 && x != null && K[k - 1] != null && K[k - 1] > 80 && x <= 80);
  assert.equal(SIGNALS.turn(W, dn), -1);
  assert.equal(SIGNALS.turn(W, 15), 0);
  // changing every candle after week 21 changes no signal read at or before week 21
  const ks = [14, 15, 16, 18, 21];
  const before = ks.map((k) => [SIGNALS.fade(W, k), SIGNALS.turn(W, k), SIGNALS.follow(W, k), stochK(W, k)]);
  const changed = bars.map((b, i) => (i >= 22 * 5 ? { ...b, open: b.open * 3, high: b.high * 3, low: b.low * 3, close: b.close * 3 } : b));
  const W2 = weeksOf(changed);
  assert.deepEqual(ks.map((k) => [SIGNALS.fade(W2, k), SIGNALS.turn(W2, k), SIGNALS.follow(W2, k), stochK(W2, k)]), before);
});

test('trade: next week open to the close of the third week, 2 x ATR stop, gap fill, costs, financing on buys only', () => {
  const bars = make(30, (w, d) => 100 + w + d * 0.1);
  const W = weeksOf(bars);
  const t = trade(bars, W, 22, 1);
  assert.equal(P.HOLD, 3);
  assert.equal(t.entry, bars[W[23].a].open); assert.equal(t.exit, bars[W[25].b].close); assert.equal(t.how, 'time');
  assert.ok(Math.abs(t.stop - (t.entry - t.dist)) < 1e-9);
  assert.equal(t.nights, 3 * 6 + 2); // three weeks less the last night, Wednesday counts three
  assert.ok(Math.abs(t.costR - 0.6 / t.dist) < 1e-12);
  assert.ok(t.finR > 0);
  assert.ok(Math.abs(t.net - (t.gross - t.costR - t.finR)) < 1e-12);
  const s = trade(bars, W, 22, -1);
  assert.equal(s.finR, 0); assert.equal(s.nights, 0); assert.equal(s.how, 'stop');
  const g = bars.map((b) => ({ ...b }));
  const wed = W[24].a + 2; g[wed].open = 50; g[wed].low = 49.5;
  const tg = trade(g, weeksOf(g), 22, 1);
  assert.equal(tg.how, 'gap'); assert.equal(tg.exit, 50);
  assert.equal(trade(bars, W, 27, 1), null); // fewer than three weeks left
  assert.equal(trade(bars, W, 22, 0), null);
});

test('one position at a time; placebo keeps the weeks and the long / short share; Holm', () => {
  const bars = make(120, (w, d) => 100 + Math.sin(w / 3) * 15 + d * 0.1);
  const W = weeksOf(bars);
  for (const sig of ['fade', 'turn', 'follow', 'long']) {
    const tr = runTest(bars, W, sig);
    assert.ok(tr.length > 2, sig);
    for (let i = 1; i < tr.length; i++) assert.ok(tr[i].k >= tr[i - 1].k + P.HOLD, sig);
  }
  const real = runTest(bars, W, 'fade'), pl = placebo(bars, W, real, 7);
  assert.equal(pl.length, real.length);
  assert.deepEqual(pl.map((t) => t.k), real.map((t) => t.k));
  assert.equal(pl.filter((t) => t.side > 0).length, real.filter((t) => t.side > 0).length);
  assert.deepEqual(holm([0.01, 0.04, 0.03]).map((x) => +x.toFixed(3)), [0.03, 0.06, 0.06]);
});

test('report: verdict line, headline and every quoted figure match result.json', () => {
  const r = JSON.parse(fs.readFileSync(new URL('result.json', DIR), 'utf8'));
  const md = fs.readFileSync(new URL('RESULT.md', DIR), 'utf8');
  assert.equal(r.params.K_N, P.K_N); assert.equal(r.params.HOLD, P.HOLD);
  assert.equal(r.verdict, verdictOf(r));
  assert.ok(r.headline.length < 220);
  assert.ok(md.includes(`**Verdict: ${r.headline}.**`));
  for (const t of r.tests) assert.equal(t.pass, Object.values(t.checks).every(Boolean));
  const [T1, T2, T3] = r.tests, al = r.alwaysLong, as = r.alwaysShort;
  const q = (x, d = 3) => (x < 0 ? '−' : '+') + Math.abs(x).toFixed(d);
  const tt = (x) => (x < 0 ? '−' : '') + Math.abs(x).toFixed(2);
  const text = READING.join('\n');
  for (const s of [q(T1.oos.netR), `n ${T1.oos.trades}`, `t ${tt(T1.oos.monthNetT)}`, q(T1.oos.grossR), `gross t ${tt(T1.oos.monthGrossT)}`,
    q(T1.is.netR), `n ${T1.is.trades}`, `t ${tt(T1.is.monthNetT)}`, q(T1.oos.x2Net), `t ${tt(T1.oos.x2T)}`,
    q(T1.legs.oos.short.netR), `n ${T1.legs.oos.short.trades}`, `t ${tt(T1.legs.oos.short.monthNetT)}`, q(as.oos.netR), `n ${as.oos.trades}`,
    q(T1.legs.oos.long.netR), `n ${T1.legs.oos.long.trades}`, q(al.oos.netR),
    `${T1.placebo.below} of 40`, `p5 ${tt(T1.placebo.p5)}`,
    q(T3.oos.netR), `n ${T3.oos.trades}`, `month t ${tt(T3.oos.monthNetT)}`, `Holm p ${T3.holmP}`, q(T3.is.netR), `n ${T3.is.trades}`,
    q(T3.oos.x2Net), `${T3.placebo.below} of 40`, `p95 ${tt(T3.placebo.p95)}`, q(T3.legs.oos.long.netR), `t ${tt(T3.legs.oos.long.monthNetT)}`,
    q(T3.legs.oos.short.netR), `takes ${T3.oos.finR}R`,
    q(T2.oos.netR), `n ${T2.oos.trades}`, `t ${tt(T2.oos.monthNetT)}`, q(T2.is.netR), `n ${T2.is.trades}`, `t ${tt(T2.is.monthNetT)}`]) {
    assert.ok(text.includes(s), `reading quotes ${s}`);
  }
  assert.ok(md.includes(READING[0]));
});
