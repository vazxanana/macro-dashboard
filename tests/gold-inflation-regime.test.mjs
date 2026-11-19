// gold-inflation-regime: the rule on hand-made candles, no look-ahead, and the report against result.json (offline).
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { P, TESTS, common, corrAt, signals, trade, baseline, runTest, placebo, holm, monthly, verdictLine, READING } from '../research/edge/gold-inflation-regime/run.mjs';

const DIR = new URL('../research/edge/gold-inflation-regime/', import.meta.url);
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
const gold = make(300, (i) => 1000 * Math.exp(0.01 * Math.sin(i * 0.9) + i * 0.002));
const spx = make(300, (i) => 2000 * Math.exp(0.01 * wig(i)));
const bondWith = make(300, (i) => 120 * Math.exp(0.004 * wig(i)));
const bondAgainst = make(300, (i) => 120 * Math.exp(-0.004 * wig(i)));

test('stock-bond correlation: +1 when the note moves with stocks, -1 against, needs 63 common returns, no look-ahead', () => {
  const cw = common(gold, spx, bondWith), ca = common(gold, spx, bondAgainst);
  assert.ok(corrAt(cw, 200) > 0.9); assert.ok(corrAt(ca, 200) < -0.9);
  assert.equal(P.C_N, 63);
  assert.equal(corrAt(cw, P.C_N - 1), null); assert.ok(corrAt(cw, P.C_N) !== null);
  // a gold day without a note (or index) candle carries no signal
  const gap = bondWith.filter((_, k) => k !== 150);
  assert.equal(corrAt(common(gold, spx, gap), 150), null);
  assert.equal(corrAt(common(gold, spx.filter((_, k) => k !== 151), bondWith), 151), null);
  // changing every price after day i leaves C(i) as it was
  const ch = (bars) => bars.map((b, k) => (k > 200 ? { ...b, open: b.open * 3, high: b.high * 3, low: b.low * 3, close: b.close * 7 } : b));
  assert.equal(corrAt(common(ch(gold), ch(spx), ch(bondAgainst)), 200), corrAt(ca, 200));
  // gold's own prices do not enter C
  assert.equal(corrAt(common(make(300, (i) => 50 + i), spx, bondWith), 200), corrAt(cw, 200));
});

test('tests: T1 long C > 0, T2 long C > 0.3, T3 short C < 0', () => {
  assert.deepEqual(TESTS.map((t) => t.side), [1, 1, -1]);
  assert.deepEqual([0.1, 0, -0.1].map(TESTS[0].ok), [true, false, false]);
  assert.deepEqual([0.31, 0.3, 0.1].map(TESTS[1].ok), [true, false, false]);
  assert.deepEqual([-0.1, 0, 0.1].map(TESTS[2].ok), [true, false, false]);
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

test('one position at a time, only in its regime; excess = net minus the same-side every-day mean; placebo; Holm', () => {
  const g = make(700, (i) => 300 + 20 * Math.sin(i / 9) + 3 * Math.sin(i * 1.7) + i * 0.05);
  const s = make(700, (i) => 1000 + 30 * Math.sin(i / 23) + 5 * Math.sin(i * 1.1));
  const b = make(700, (i) => 120 + 2 * Math.sin(i / 41) + 0.3 * Math.sin(i * 1.1 + (i > 350 ? 0 : Math.PI)));
  const sig = signals(g, common(g, s, b));
  assert.ok(sig.some((x) => x.c > 0) && sig.some((x) => x.c < 0));
  const P0 = { ...P }; Object.assign(P, { IS: { from: '2010-01', to: '2010-12' }, OOS: { from: '2011-01', to: '2012-12' } });
  try {
    for (const T of TESTS) {
      const base = baseline(g, sig, T.side), tr = runTest(g, sig, T, base);
      for (let i = 1; i < tr.length; i++) assert.ok(tr[i].i > tr[i - 1].xi);
      for (const t of tr) {
        assert.ok(T.ok(t.c)); assert.equal(t.side, T.side);
        const w = t.exitMonth <= '2010-12' ? 'is' : 'oos';
        if (t.exitMonth >= '2010-01' && t.exitMonth <= '2012-12') assert.ok(Math.abs(t.ex - (t.net - base.mean[w])) < 1e-12);
      }
      const pl = placebo(tr, base, 7);
      assert.ok(pl.length <= tr.length); for (const t of pl) assert.equal(t.side, T.side);
    }
  } finally { Object.assign(P, P0); }
  assert.deepEqual(holm([0.01, 0.04, 0.03]).map((x) => +x.toFixed(3)), [0.03, 0.06, 0.06]);
  assert.equal(monthly([], P.OOS).length, 118); assert.equal(monthly([], P.IS).length, 120);
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
  const pct = (x) => (x * 100).toFixed(1) + ' %';
  for (const s of [`${sg(a.oos.netR)}R a trade net (n ${a.oos.trades}, month t ${sg(a.oos.monthNetT, 2)})`,
    `made ${sg(B.long.netR.oos)}R: the excess is ${sg(a.oos.exR)}R a trade (month t ${sg(a.oos.monthExT, 2)})`,
    `${a.placebo.below} of 40 placebo seeds`, `excess was ${sg(a.is.exR)}R (n ${a.is.trades}, t ${sg(a.is.monthExT, 2)})`,
    `${pct(r.regime.is.pos03)} of in-sample days (${b.is.trades} trades) and ${pct(r.regime.oos.pos03)} of out-of-sample days`,
    `its ${b.oos.trades} longs`, `(excess ${sg(b.oos.exR)}R, t ${b.oos.monthExT.toFixed(2)})`,
    `${sg(c.oos.netR)}R a trade net (n ${c.oos.trades}, month t ${sg(c.oos.monthNetT, 2)})`,
    `every-day short lost ${sg(B.short.netR.oos)}R: excess ${sg(c.oos.exR)}R (t ${sg(c.oos.monthExT, 2)})`,
    `${sg(B.long.netR.oos)}R net out of sample, ${sg(B.long.netR.is)}R in sample`]) assert.ok(rd.includes(s), s);
  assert.equal(r.tests.filter((t) => t.pass).length, 0);
  assert.equal(r.preregCommit, 'ec2a2ced8');
});
