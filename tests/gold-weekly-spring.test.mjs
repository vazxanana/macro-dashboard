// gold-weekly-spring: the rule on hand-made candles, no look-ahead, and the report against result.json (offline).
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { P, TESTS, weeksOf, signal, hold, trades, runTest, baseline, placebo, holm, monthly, READING } from '../research/edge/gold-weekly-spring/run.mjs';

const DIR = new URL('../research/edge/gold-weekly-spring/', import.meta.url);
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
const wk = (high, low, close, n = 5) => ({ n, open: close, high, low, close });

test('spring and upthrust: four weeks\' extreme taken, close back in the right half', () => {
  const prev = [wk(110, 100, 105), wk(111, 101, 106), wk(112, 102, 107), wk(109, 99.5, 104)];
  assert.equal(signal([...prev, wk(108, 99, 104)], 4), 1); // low 99 < 99.5, close 104 >= mid 103.5
  assert.equal(signal([...prev, wk(108, 99, 103)], 4), 0); // close under the mid
  assert.equal(signal([...prev, wk(108, 99.6, 107)], 4), 0); // no new four-week low
  assert.equal(signal([...prev, wk(108, 99, 104, 3)], 4), 0); // fewer than 4 days
  assert.equal(signal([...prev, wk(113, 103, 107)], 4), -1); // high 113 > 112, close 107 <= mid 108
  assert.equal(signal([...prev, wk(113, 103, 109)], 4), 0);
  assert.equal(signal(prev, 3), 0); // fewer than four weeks before
  // the fifth week back does not count
  assert.equal(signal([wk(110, 90, 100), ...prev, wk(108, 99, 104)], 5), 1);
});

test('no look-ahead: signals and stops do not move when later candles change', () => {
  const bars = make(40, (w, d) => 100 + Math.sin(w * 1.7) * 4 + d * (w % 3 - 1) * 0.6);
  const W = weeksOf(bars);
  const before = W.map((_, k) => signal(W, k)).slice(0, 30);
  const t0 = trades(bars, W, 29, 1, 1);
  const changed = bars.map((b, i) => (i >= 30 * 5 + 1 ? { ...b, open: b.open * 2, high: b.high * 2, low: b.low * 2, close: b.close * 2 } : b));
  const W2 = weeksOf(changed);
  assert.deepEqual(W2.map((_, k) => signal(W2, k)).slice(0, 30), before);
  const t1 = trades(changed, W2, 29, 1, 1);
  assert.equal(t1[0].entry, t0[0].entry); assert.equal(t1[0].stop, t0[0].stop); // Monday's entry and stop read nothing later
});

test('trades: one at every open of the next week, out at its last close (or the week after), costs and financing', () => {
  const bars = make(30, (w, d) => 100 + w + d * 0.1);
  const W = weeksOf(bars);
  const tr = trades(bars, W, 25, 1, 1);
  assert.equal(tr.length, 5);
  tr.forEach((t, i) => { assert.equal(t.entry, bars[W[26].a + i].open); assert.equal(t.exit, bars[W[26].b].close); });
  const t = tr[0];
  assert.ok(Math.abs(t.stop - (t.entry - t.dist)) < 1e-9);
  assert.equal(t.nights, 6);
  assert.ok(Math.abs(t.costR - 0.6 / t.dist) < 1e-12);
  assert.ok(Math.abs(t.finR - 6 * 0.000148 * t.entry / t.dist) < 1e-12);
  assert.ok(Math.abs(t.net - (t.gross - t.costR - t.finR)) < 1e-12);
  const t2 = trades(bars, W, 25, 1, 2);
  assert.equal(t2.length, 5); assert.equal(t2[0].exit, bars[W[27].b].close); assert.equal(t2[0].nights, 13);
  const s = trades(bars, W, 25, -1, 1);
  assert.equal(s[0].finR, 0); assert.equal(s[0].nights, 0);
  const g = bars.map((b) => ({ ...b })); const wed = W[26].a + 2; g[wed].open = 50; g[wed].low = 49.5;
  const tg = trades(g, weeksOf(g), 25, 1, 1);
  assert.equal(tg[0].how, 'gap'); assert.equal(tg[0].exit, 50);
  assert.deepEqual(trades(bars, W, 29, 1, 1), []);
  assert.deepEqual(trades(bars, W, 25, 0, 1), []);
  assert.equal(hold(bars, 10, 14, 1), null); // fewer than 20 days of ATR before day 10
});

test('runTest takes the signal\'s side only; baseline by side and year; placebo keeps side, week count and year; Holm; months', () => {
  // a dip week every 8 weeks that undercuts and closes high
  const bars = make(60, (w, d) => (w % 8 === 7 ? [95, 90, 92, 97, 99][d] : 100 + (d % 2)));
  const W = weeksOf(bars);
  const tr = runTest(bars, W, TESTS[0]);
  assert.ok(tr.length > 0);
  for (const t of tr) { assert.equal(t.side, 1); assert.equal(signal(W, t.k), 1); }
  const b = baseline(bars, W, 1);
  assert.ok(b[1][2024].n > 0 && Number.isFinite(b[1][2024].mean) && Number.isFinite(b[-1][2024].mean));
  const pl = placebo(bars, W, tr, 1, 1, 3);
  assert.ok(pl.every((t) => t.side === 1));
  assert.equal(new Set(pl.map((t) => t.k)).size <= new Set(tr.map((t) => t.k)).size, true);
  const yr = (t) => new Date(t.week).getUTCFullYear(), count = (xs) => xs.reduce((m, t) => ((m[yr(t)] = (m[yr(t)] || new Set()).add(t.k)), m), {});
  const cr = count(tr), cp = count(pl);
  for (const y in cp) assert.ok(cr[y] && cp[y].size <= cr[y].size, `placebo weeks drawn in ${y}`);
  assert.deepEqual(holm([0.01, 0.04, 0.03]).map((x) => +x.toFixed(3)), [0.03, 0.06, 0.06]);
  assert.deepEqual(monthly([{ exitMonth: '2024-02', net: 1 }], { from: '2024-01', to: '2024-03' }), [0, 1, 0]);
  assert.equal(TESTS.length, 3); assert.equal(P.SEEDS, 40); assert.equal(P.LOOK, 4);
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
  for (const s of [q(T1.oos.netR), `${T1.oos.trades} daily entries in ${T1.weeks.oos} signal weeks`, `t ${T1.oos.monthNetT.toFixed(2)}`,
    q(T1.oos.grossR), `${T1.oos.monthGrossT.toFixed(2)}`, q(T1.is.netR), `${T1.is.trades} entries, ${T1.weeks.is} weeks`,
    `t ${T1.is.monthNetT.toFixed(2)}`, `${T1.oos.costR}R`, `${T1.oos.finR}R`, q(T1.oos.x2R), `${T1.holmP}`, `${T1.placebo.below} of 40`,
    `${T1.placebo.p95.toFixed(2)}`, q(T1.oos.excessR), `t ${T1.oos.excessT}`, q(T1.is.excessR), `t ${T1.is.excessT}`,
    q(T2.oos.netR), `t ${T2.oos.monthNetT}`, q(T2.oos.excessR),
    q(T3.oos.netR), `n ${T3.oos.trades} in ${T3.weeks.oos} weeks`, `t ${T3.oos.monthNetT}`, q(T3.is.netR), q(T3.oos.excessR),
    `t ${T3.oos.excessT.toFixed(2)}`, q(T3.is.excessR), `${T3.placebo.below} of 40`, `t ${T3.placebo.p50.toFixed(2)}`]) {
    assert.ok(text.includes(s), `reading quotes ${s}`);
  }
  assert.ok(md.includes(READING[0]));
  assert.equal(r.verdict, 'FAIL');
});
