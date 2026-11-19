// gold-equity-corr-momentum: the rule on hand-made candles, no look-ahead, and the report against result.json (offline).
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { P, TESTS, common, corrAt, eventAt, events, trade, runTest, pool, placebo, holm, monthly, verdictLine, READING } from '../research/edge/gold-equity-corr-momentum/run.mjs';

const DIR = new URL('../research/edge/gold-equity-corr-momentum/', import.meta.url);
const MON = Date.UTC(2010, 0, 4) / 1000; // a Monday
function make(n, f) {
  const bars = []; let prev = f(0), d = 0;
  for (let i = 0; i < n; i++) {
    const c = f(i), t = MON + (Math.floor(d / 5) * 7 + (d % 5)) * 86400; d++;
    bars.push({ time: t, open: prev, high: Math.max(prev, c) + 0.5, low: Math.min(prev, c) - 0.5, close: c }); prev = c;
  }
  return bars;
}
const wig = (i) => Math.sin(i * 1.3) + 0.6 * Math.sin(i * 0.37);
const gold = make(300, (i) => 1000 * Math.exp(0.01 * wig(i) + i * 0.002));
const same = make(300, (i) => 2000 * Math.exp(0.01 * wig(i)));
const opp = make(300, (i) => 2000 * Math.exp(-0.01 * wig(i)));

test('correlation: +1 when the index moves with gold, -1 against it, needs 60 common returns, no look-ahead', () => {
  const cs = common(gold, same), co = common(gold, opp);
  assert.ok(corrAt(cs, 200) > 0.9); assert.ok(corrAt(co, 200) < -0.9);
  assert.equal(corrAt(cs, P.C_N - 1), null);
  assert.ok(corrAt(cs, P.C_N) !== null);
  // a gold day with no index candle carries no signal
  const gap = same.filter((_, k) => k !== 150), cg = common(gold, gap);
  assert.equal(corrAt(cg, 150), null); assert.equal(eventAt(gold, cg, 150), null);
  // changing every price after day i leaves C(i) and the signal of day i as they were
  const ch = (bars) => bars.map((b, k) => (k > 200 ? { ...b, open: b.open * 3, high: b.high * 3, low: b.low * 3, close: b.close * 7 } : b));
  const g2 = ch(gold), c2 = common(g2, ch(opp));
  assert.equal(corrAt(c2, 200), corrAt(co, 200));
  assert.deepEqual(eventAt(g2, c2, 200), eventAt(gold, co, 200));
});

test('signal: haven when C < 0, risk otherwise; side = sign of the 10-day move; none on a flat 10 days', () => {
  const co = common(gold, opp), cs = common(gold, same);
  for (let i = 100; i < 280; i++) {
    const e = eventAt(gold, co, i); if (!e) continue;
    assert.equal(e.regime, 'haven'); assert.equal(e.side, Math.sign(gold[i].close - gold[i - 10].close));
    assert.equal(eventAt(gold, cs, i).regime, 'risk');
  }
  const flat = make(300, () => 100);
  assert.equal(eventAt(flat, common(flat, same), 200), null);
});

test('trade: next open entry, 2 x ATR stop on the losing side, ten days held, costs and financing', () => {
  const bars = make(80, (i) => 100 + i * 0.1);
  const t = trade(bars, 30, 1);
  assert.equal(t.entry, bars[31].open); assert.equal(t.how, 'time'); assert.equal(t.exit, bars[40].close);
  assert.ok(t.stop < t.entry && Math.abs(t.entry - t.stop - t.dist) < 1e-9);
  assert.ok(Math.abs(t.costR - 0.6 / t.dist) < 1e-12);
  assert.ok(t.nights > 0 && t.finR > 0);
  assert.ok(Math.abs(t.net - (t.gross - t.costR - t.finR)) < 1e-12);
  const s = trade(bars, 30, -1);
  assert.ok(s.stop > s.entry); assert.equal(s.finR, 0);
  assert.equal(trade(bars, 71, 1), null);
  const g = bars.map((b) => ({ ...b })); g[34].open = 50; g[34].low = 49;
  const tg = trade(g, 30, 1);
  assert.equal(tg.how, 'gap'); assert.equal(tg.exit, 50); assert.equal(tg.xi, 34);
});

test('one position at a time, regimes kept; placebo; Holm; empty months count', () => {
  const bars = make(700, (i) => 300 + 20 * Math.sin(i / 9) + 3 * Math.sin(i * 1.7) + i * 0.05);
  const idx = make(700, (i) => 1000 + 30 * Math.sin(i / 23) + 5 * Math.sin(i * 1.1));
  const evs = events(bars, common(bars, idx));
  const tr = runTest(bars, evs, TESTS[0].regimes), tr2 = runTest(bars, evs, TESTS[1].regimes);
  assert.ok(tr.length + tr2.length > 10);
  for (const x of [tr, tr2]) for (let i = 1; i < x.length; i++) assert.ok(x[i].i > x[i - 1].xi);
  for (const t of tr) assert.equal(t.regime, 'haven');
  for (const t of tr2) assert.equal(t.regime, 'risk');
  const pools = { 1: pool(bars, 1, 61), '-1': pool(bars, -1, 61) };
  assert.ok(placebo(tr, pools, 7).length <= tr.length);
  assert.deepEqual(holm([0.01, 0.04, 0.03]).map((x) => +x.toFixed(3)), [0.03, 0.06, 0.06]);
  assert.equal(monthly([], P.OOS).length, 118);
});

test('report: verdict line, headline and every quoted figure match result.json', () => {
  const r = JSON.parse(fs.readFileSync(new URL('result.json', DIR), 'utf8'));
  const md = fs.readFileSync(new URL('RESULT.md', DIR), 'utf8');
  assert.equal(r.params.C_N, P.C_N); assert.equal(r.params.HOLD, P.HOLD);
  assert.equal(r.verdict, r.tests[0].pass ? 'PASS' : 'FAIL');
  assert.equal(r.headline, verdictLine(r));
  assert.ok(r.headline.length < 220);
  assert.ok(md.includes(`**Verdict: ${r.headline}.**`));
  const [a, b, c] = r.tests, B = r.baseline, rd = READING.join('\n');
  const sg = (x, d = 3) => (x >= 0 ? '+' : '−') + Math.abs(x).toFixed(d);
  for (const s of [`${sg(a.oos.netR)}R a trade net (n ${a.oos.trades}, month t ${sg(a.oos.monthNetT, 2)}; ${sg(a.oos.grossR)}R gross)`,
    `in sample ${sg(a.is.netR)}R (n ${a.is.trades}, month t ${sg(a.is.monthNetT, 2)}; ${sg(a.is.grossR)}R gross)`,
    `only ${a.placebo.below} of 40 placebo seeds`, `median stop of $${a.oos.medStop.toFixed(2)}`,
    `cost ${a.oos.costR.toFixed(3)}R and financing ${a.oos.finR.toFixed(3)}R`,
    `${sg(b.oos.netR)}R net out of sample (n ${b.oos.trades}, t ${sg(b.oos.monthNetT, 2)}) and ${sg(b.is.netR)}R in sample`,
    `${sg(c.oos.monthNet)}R a month out of sample (t ${sg(c.oos.monthNetT, 2)})`,
    `${sg(B.momentum.oos.netR)}R out of sample (n ${B.momentum.oos.trades}, t ${sg(B.momentum.oos.monthNetT, 2)})`,
    `${sg(B.long.oos.netR)}R out of sample (n ${B.long.oos.trades}, t ${sg(B.long.oos.monthNetT, 2)})`,
    `${sg(B.short.oos.netR)}R (n ${B.short.oos.trades}, t ${sg(B.short.oos.monthNetT, 2)})`]) assert.ok(rd.includes(s), s);
  assert.equal(r.tests.filter((t) => t.pass).length, 0);
  assert.equal(r.preregCommit, '63bf5d75b');
});
