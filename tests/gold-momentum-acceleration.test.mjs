// gold-momentum-acceleration: the signal and trade on hand-made weeks, no look-ahead, the baseline excess, and the report
// against result.json. Offline.
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { fileURLToPath } from 'node:url';
import * as S from '../research/edge/gold-momentum-acceleration/run.mjs';

const DIR = fileURLToPath(new URL('../research/edge/gold-momentum-acceleration/', import.meta.url));
const res = JSON.parse(fs.readFileSync(DIR + 'result.json', 'utf8'));
const md = fs.readFileSync(DIR + 'RESULT.md', 'utf8');

// weekdays from Monday 2007-01-01, closes from a function of the week index
function makeBars(weeks, closeOf, wiggle = 1) {
  const bars = []; let t = Date.UTC(2007, 0, 1) / 1000, prev = closeOf(0);
  for (let w = 0; w < weeks; w++) {
    for (let d = 0; d < 7; d++, t += 86400) {
      const dow = new Date(t * 1000).getUTCDay(); if (dow === 0 || dow === 6) continue;
      const c = closeOf(w) + (d % 2 ? wiggle : -wiggle) * 0.1;
      bars.push({ time: t, open: prev, high: Math.max(prev, c) + wiggle, low: Math.min(prev, c) - wiggle, close: c }); prev = c;
    }
  }
  return bars;
}
// a noisy walk (so the 52-week sd is not zero) that speeds up after week 60
const noise = (w) => ((w * 7919) % 13) - 6;
const closeOf = (w) => 1000 + noise(w) * 2 + (w > 60 ? (w - 60) ** 2 * 0.8 : 0);

test('acceleration z: sign and threshold on a path that speeds up', () => {
  const W = S.weeksOf(makeBars(90, closeOf));
  assert.equal(S.accelZ(W, 40, 13), null, 'needs 52 weeks of sd');
  const z = S.accelZ(W, 80, 13);
  assert.ok(z > S.P.Z, `accelerating up: z ${z}`);
  assert.equal(S.SIGNALS.acc13(W, 80), 1);
  // mirrored path: accelerating down gives a short
  const W2 = S.weeksOf(makeBars(90, (w) => 3000 - (closeOf(w) - 1000)));
  assert.equal(S.SIGNALS.acc13(W2, 80), -1);
});

test('no look-ahead: the signal at week k ignores every later candle', () => {
  const a = makeBars(90, closeOf), W = S.weeksOf(a);
  const cut = W[70].b, b = a.map((x, i) => (i > cut ? { ...x, open: 1, high: 2, low: 0.5, close: 1 } : x));
  const Wb = S.weeksOf(b);
  for (let k = 52; k <= 70; k++) assert.equal(S.accelZ(W, k, 13), S.accelZ(Wb, k, 13));
  assert.equal(S.atr(a, cut), S.atr(b, cut));
});

test('trade: every trade has a stop, 4-week time exit, stop and gap fills, costs and financing on buys only', () => {
  const bars = makeBars(90, closeOf), W = S.weeksOf(bars);
  const L = S.trade(bars, W, 70, 1), Sh = S.trade(bars, W, 70, -1);
  for (const t of [L, Sh]) { assert.ok(t.dist > 0); assert.ok(t.side > 0 ? t.stop < t.entry : t.stop > t.entry); }
  assert.equal(L.how, 'time'); assert.equal(L.exitWeek, 74); assert.equal(L.exit, bars[W[74].b].close);
  assert.ok(L.finR > 0 && L.nights > 0); assert.equal(Sh.finR, 0);
  assert.ok(Math.abs(L.costR - 0.6 / L.dist) < 1e-12);
  assert.ok(Math.abs(L.net - (L.gross - L.costR - L.finR)) < 1e-12);
  assert.equal(Sh.how, 'stop'); assert.ok(Math.abs(Sh.gross + 1) < 1e-9, 'stopped short loses 1R');
  // a gap through the stop fills at the open
  const g = bars.map((x) => ({ ...x })), e = W[71].a;
  g[e + 2] = { ...g[e + 2], open: g[e].open - 500, low: g[e].open - 510, high: g[e].open - 490 };
  const G = S.trade(g, S.weeksOf(g), 70, 1);
  assert.equal(G.how, 'gap'); assert.equal(G.exit, g[e + 2].open);
});

test('one trade at a time and excess against the same-side baseline', () => {
  const bars = makeBars(120, closeOf), W = S.weeksOf(bars);
  const tr = S.runRule(bars, W, 'acc13');
  for (let i = 1; i < tr.length; i++) assert.ok(tr[i].k >= tr[i - 1].exitWeek, 'next signal read at or after the exit week');
  const B = S.baseline(bars, W);
  assert.equal(B.long.length, B.short.length);
  const ex = S.withExcess(tr, B), bm = S.baseMeans(B, S.P.IS);
  for (const t of ex) if (t.exitMonth <= S.P.IS.to) assert.ok(Math.abs(t.excess - (t.net - (t.side > 0 ? bm.long : bm.short))) < 1e-12);
});

test('statistics helpers', () => {
  assert.deepEqual(S.holm([0.01, 0.04, 0.03]).map((x) => Math.round(x * 1000) / 1000), [0.03, 0.06, 0.06]);
  assert.equal(S.drawdown([1, -2, 1, -1]), -2);
  assert.equal(S.monthsOf(S.P.OOS).length, 118);
  assert.deepEqual(S.shuffleSides([{ side: 1 }, { side: -1 }, { side: 1 }], 3).sort(), [-1, 1, 1]);
});

test('report against result.json', () => {
  assert.equal(res.verdict, res.tests[0].pass ? 'PASS' : 'FAIL');
  assert.equal(res.verdict, 'FAIL');
  assert.equal(res.tests.length, 3);
  assert.ok(res.headline.length < 220);
  assert.ok(md.includes(`**Verdict: ${res.headline}.**`));
  const [T1, T2, T3] = res.tests;
  assert.equal(T1.oos.trades, 76); assert.equal(T1.oos.excessR, 0.029); assert.equal(T1.oos.monthT, 0.21); assert.equal(T1.holmP, 1);
  assert.equal(T1.is.excessR, -0.165); assert.equal(T1.is.monthT, -1.2); assert.equal(T1.placebo.below, 24);
  assert.equal(T2.oos.netR, -0.015); assert.equal(T2.is.monthT, -1.57);
  assert.equal(T3.is.excessR, 0.384); assert.equal(T3.oos.excessR, -0.078); assert.equal(T3.oos.monthT, -0.44);
  assert.equal(res.base.oos.long.netR, 0.187); assert.equal(res.base.oos.short.netR, -0.263);
  for (const s of ['+0.029R', 'n 76', 'month t 0.21', '−0.165R', '+0.187R', '−0.263R', '$48.69', '+0.384R', '−0.078R', '24 of 40', '126%']) assert.ok(md.includes(s), s);
  assert.equal(T1.oos.medianStop, 48.69); assert.ok(T1.oos.medianStop >= 10 && T1.is.medianStop >= 10);
});
