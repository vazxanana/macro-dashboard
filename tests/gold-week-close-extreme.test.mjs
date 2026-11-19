// gold-week-close-extreme: the rule on hand-made candles, no look-ahead, and the report against result.json (offline).
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { P, TESTS, weeksOf, signal, hold, trade, runTest, baseline, placebo, holm, monthly, READING } from '../research/edge/gold-week-close-extreme/run.mjs';

const DIR = new URL('../research/edge/gold-week-close-extreme/', import.meta.url);
const MON = Date.UTC(2024, 0, 1) / 1000; // a Monday
// n weeks of Mon-Fri candles; f(week, day) -> close; open = previous close, high / low 0.5 around
function make(nw, f) {
  const bars = []; let prev = 100;
  for (let w = 0; w < nw; w++) for (let d = 0; d < 5; d++) {
    const c = f(w, d), t = MON + (w * 7 + d) * 86400;
    bars.push({ time: t, open: prev, high: Math.max(prev, c) + 0.5, low: Math.min(prev, c) - 0.5, close: c }); prev = c;
  }
  return bars;
}

test('weeks carry their high, low and day count; the signal reads the close inside the week\'s range', () => {
  const bars = make(8, (w, d) => 100 + w * 5 + d);
  const W = weeksOf(bars);
  assert.equal(W.length, 8);
  assert.equal(W[1].n, 5); assert.equal(W[1].high, Math.max(...bars.slice(5, 10).map((b) => b.high)));
  // a rising week: close 104+5=109 at the top day, high = 109.5, low = 103.5 (prev close 104 - 0.5): top tenth? (109.5-109)/6 = 0.083
  assert.equal(signal(W, 1, 0.10), 1);
  const w = { n: 5, open: 100, high: 110, low: 100, close: 100.5 };
  assert.equal(signal([w], 0, 0.10), -1);
  assert.equal(signal([{ ...w, close: 105 }], 0, 0.10), 0);
  assert.equal(signal([{ ...w, close: 108.5 }], 0, 0.10), 0);
  assert.equal(signal([{ ...w, close: 108.5 }], 0, 0.20), 1);
  assert.equal(signal([{ ...w, n: 3, close: 110 }], 0, 0.10), 0); // fewer than 4 days
  assert.equal(signal([{ ...w, high: 100, close: 100 }], 0, 0.10), 0); // no range
});

test('no look-ahead: signals and the stop do not move when later candles change', () => {
  const bars = make(40, (w, d) => 100 + Math.sin(w * 1.7) * 4 + d * (w % 3 - 1) * 0.6);
  const W = weeksOf(bars);
  const before = W.map((_, k) => signal(W, k, 0.10)).slice(0, 30);
  const t0 = trade(bars, W, 29, 1, 1);
  const changed = bars.map((b, i) => (i >= 31 * 5 ? { ...b, open: b.open * 2, high: b.high * 2, low: b.low * 2, close: b.close * 2 } : b));
  const W2 = weeksOf(changed);
  assert.deepEqual(W2.map((_, k) => signal(W2, k, 0.10)).slice(0, 30), before);
  const t1 = trade(changed, W2, 29, 1, 1);
  assert.equal(t1.entry, t0.entry); assert.equal(t1.stop, t0.stop); // stop from candles up to the signal week only
});

test('trade: next week open to Friday close, two weeks for H 2, stop and gap fill, costs and financing', () => {
  const bars = make(30, (w, d) => 100 + w + d * 0.1);
  const W = weeksOf(bars);
  const t = trade(bars, W, 25, 1, 1);
  assert.equal(t.entry, bars[W[26].a].open); assert.equal(t.exit, bars[W[26].b].close); assert.equal(t.how, 'time');
  assert.ok(Math.abs(t.stop - (t.entry - t.dist)) < 1e-9);
  assert.equal(t.nights, 6);
  assert.ok(Math.abs(t.costR - 0.6 / t.dist) < 1e-12);
  assert.ok(Math.abs(t.finR - 6 * 0.000148 * t.entry / t.dist) < 1e-12);
  assert.ok(Math.abs(t.net - (t.gross - t.costR - t.finR)) < 1e-12);
  const t2 = trade(bars, W, 25, 1, 2);
  assert.equal(t2.exit, bars[W[27].b].close); assert.equal(t2.nights, 13);
  const s = trade(bars, W, 25, -1, 1);
  assert.equal(s.finR, 0); assert.equal(s.nights, 0);
  const g = bars.map((b) => ({ ...b })); const wed = W[26].a + 2; g[wed].open = 50; g[wed].low = 49.5;
  const tg = trade(g, weeksOf(g), 25, 1, 1);
  assert.equal(tg.how, 'gap'); assert.equal(tg.exit, 50);
  assert.equal(trade(bars, W, 29, 1, 1), null);
  assert.equal(trade(bars, W, 25, 0, 1), null);
  assert.equal(hold(bars, 10, 14, 1), null); // fewer than 20 days of ATR before day 10
});

test('one position at a time, baseline by side and year, placebo keeps sides and years; Holm; empty months count', () => {
  const bars = make(60, (w, d) => 100 + w * 0.5 + d * 0.3); // every week closes at its high
  const W = weeksOf(bars);
  const tr = runTest(bars, W, { F: 0.10, H: 2 });
  for (let i = 1; i < tr.length; i++) assert.ok(tr[i].k >= tr[i - 1].k + 2);
  const b = baseline(bars, 5);
  assert.ok(b[1][2024].n > 0 && Number.isFinite(b[1][2024].mean) && Number.isFinite(b[-1][2024].mean));
  const pl = placebo(bars, W, tr, 2, 3);
  assert.equal(pl.length, tr.length);
  assert.deepEqual(pl.map((t) => t.side), tr.map((t) => t.side));
  for (let i = 0; i < tr.length; i++) assert.equal(new Date(pl[i].week).getUTCFullYear(), new Date(tr[i].week).getUTCFullYear());
  assert.deepEqual(holm([0.01, 0.04, 0.03]).map((x) => +x.toFixed(3)), [0.03, 0.06, 0.06]);
  assert.deepEqual(monthly([{ exitMonth: '2024-02', net: 1 }], { from: '2024-01', to: '2024-03' }), [0, 1, 0]);
  assert.equal(TESTS.length, 3); assert.equal(P.SEEDS, 40);
});

test('report: verdict line, headline and every quoted figure match result.json', () => {
  const r = JSON.parse(fs.readFileSync(new URL('result.json', DIR), 'utf8'));
  const md = fs.readFileSync(new URL('RESULT.md', DIR), 'utf8');
  assert.equal(r.verdict, r.tests[0].pass ? 'PASS' : 'FAIL');
  assert.ok(r.headline.length < 220);
  assert.ok(md.includes(`**Verdict: ${r.headline}.**`));
  for (const t of r.tests) assert.equal(t.pass, Object.values(t.checks).every(Boolean));
  const [T1, T2, T3] = r.tests;
  const q = (x, d = 3) => (x < 0 ? '-' : '+') + Math.abs(x).toFixed(d);
  const text = READING.join('\n');
  for (const s of [q(T1.oos.netR), `n ${T1.oos.trades}`, `t ${T1.oos.monthNetT.toFixed(2)}`, q(T1.oos.grossR), `${T1.oos.monthGrossT}`,
    q(T1.is.netR), `n ${T1.is.trades}`, `t ${T1.is.monthNetT}`, `${T1.oos.costR}R`, `${T1.oos.finR}R`, q(T1.oos.x2R), `${T1.holmP}`,
    `${T1.placebo.below} of 40`, `${T1.placebo.p95}`, q(T1.oos.excessR), `t ${T1.oos.excessT}`, q(T1.is.excessR), `t ${T1.is.excessT}`,
    q(T1.sides.oos.buy.netR), q(T1.sides.oos.buy.excessR), q(T1.sides.oos.sell.excessR), q(r.baseline['5d sell'].oos.netR),
    q(T2.oos.netR), `n ${T2.oos.trades}`, `t ${T2.oos.monthNetT}`, q(T2.oos.excessR), q(T2.oos.x2R),
    q(T3.oos.netR), `n ${T3.oos.trades}`, `t ${T3.oos.monthNetT}`, q(T3.oos.excessR), q(T3.sides.oos.sell.netR), `${T3.is.trades} trades in sample`]) {
    assert.ok(text.includes(s), `reading quotes ${s}`);
  }
  assert.ok(md.includes(READING[0]));
});
