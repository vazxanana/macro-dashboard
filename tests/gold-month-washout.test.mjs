// gold-month-washout: the rule on hand-made candles, no look-ahead, and the report against result.json (offline).
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { P, TESTS, months, clv, signals, signalMonths, trade, tradesAfter, baselineByYear, withExcess, placebo, holm, monthly, verdictLine, READING } from '../research/edge/gold-month-washout/run.mjs';

const DIR = new URL('../research/edge/gold-month-washout/', import.meta.url);
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

test('months and close location: a month closing on its low is a washout, on its high a top-close month', () => {
  const bars = make(120, (i) => 100 + Math.sin(i * 0.9) * 2);
  const M = months(bars);
  assert.equal(M[0].k, '2010-01');
  for (const m of M) { assert.ok(m.h >= m.c && m.l <= m.c); assert.equal(bars[m.first].time <= bars[m.last].time, true); }
  assert.equal(clv({ h: 10, l: 0, c: 0.5 }), 0.05);
  // a month that falls into its close: washout; one that rises into its close: top
  const fall = make(80, (i) => (i < 21 ? 100 : i < 41 ? 100 - (i - 20) * 1.5 : 70));
  const Mf = months(fall);
  assert.ok(signals(Mf, 1).includes('wash'));
  const rise = make(80, (i) => (i < 21 ? 100 : i < 41 ? 100 + (i - 20) * 1.5 : 130));
  assert.ok(signals(months(rise), 1).includes('top'));
});

test('worst month of the past year: strictly the lowest of 12, and the signal reads no later month', () => {
  // 15 months: steady small rises, one fall of 5 % in month 13
  const f = (i) => { const m = Math.floor(i / 21); return 100 * Math.pow(1.01, Math.min(m, 13)) * (m >= 13 ? 0.95 : 1) + Math.sin(i) * 0.1; };
  const bars = make(21 * 15, f);
  const M = months(bars), j = M.findIndex((m, k) => k >= P.LOOKM && signals(M, k).includes('worst'));
  assert.ok(j >= P.LOOKM);
  const ch = bars.map((b) => (b.time > bars[M[j].last].time ? { ...b, open: b.open * 3, high: b.high * 3, low: b.low * 3, close: b.close * 3 } : b));
  assert.deepEqual(signals(months(ch), j), signals(M, j));
  assert.ok(signalMonths(M, 'worst').includes(j));
});

test('trade: entry at the day open, 3 x ATR of the day before, ten days held, costs and financing; one trade a day of the next month', () => {
  const bars = make(120, (i) => 100 + i * 0.1);
  const t = trade(bars, 40, 1);
  assert.equal(t.entry, bars[40].open); assert.equal(t.how, 'time'); assert.equal(t.exit, bars[49].close);
  assert.ok(t.stop < t.entry && Math.abs(t.entry - t.stop - t.dist) < 1e-9);
  // the stop uses ATR up to the day before: changing day 40's own candle range leaves it
  const ch = bars.map((b, i) => (i === 40 ? { ...b, high: b.high + 50 } : b));
  assert.ok(Math.abs(trade(ch, 40, 1).dist - t.dist) < 1e-12);
  assert.ok(Math.abs(t.costR - 0.6 / t.dist) < 1e-12);
  assert.ok(t.nights > 0 && t.finR > 0 && Math.abs(t.net - (t.gross - t.costR - t.finR)) < 1e-12);
  const s = trade(bars, 40, -1); assert.ok(s.stop > s.entry); assert.equal(s.finR, 0);
  assert.equal(trade(bars, 115, 1), null);
  const g = bars.map((b) => ({ ...b })); g[43].open = 50; g[43].low = 49;
  assert.equal(trade(g, 40, 1).how, 'gap');
  const M = months(bars), tr = tradesAfter(bars, M, 1, 1);
  assert.equal(tr.length, M[2].last - M[2].first + 1);
  for (const x of tr) assert.equal(x.entryMonth, M[2].k);
});

test('baseline by year, excess, placebo months, Holm, empty months', () => {
  const bars = make(800, (i) => 200 + i * 0.05 + Math.sin(i * 0.3) * 3);
  const M = months(bars), b = baselineByYear(bars, 1);
  const y = Object.keys(b.mean)[0], ys = b.all.filter((t) => t.entryMonth.startsWith(y));
  assert.ok(Math.abs(b.mean[y] - ys.reduce((a, t) => a + t.net, 0) / ys.length) < 1e-12);
  const ex = withExcess(ys, b); assert.ok(Math.abs(ex.reduce((a, t) => a + t.excess, 0)) < 1e-9);
  const w = { from: '2010-01', to: '2012-12' };
  const pl = placebo(bars, M, w, 3, 1, 7), pl2 = placebo(bars, M, w, 3, 1, 7);
  assert.deepEqual(pl.map((t) => t.d), pl2.map((t) => t.d));
  assert.ok(new Set(pl.map((t) => t.entryMonth)).size <= 3);
  assert.deepEqual(holm([0.01, 0.04, 0.03]).map((x) => +x.toFixed(3)), [0.03, 0.06, 0.06]);
  assert.equal(monthly([], P.OOS).length, 118);
  assert.equal(TESTS.length, 3); assert.deepEqual(TESTS.map((t) => t.side), [1, 1, -1]);
});

test('report: verdict line, headline and every quoted figure match result.json', () => {
  const r = JSON.parse(fs.readFileSync(new URL('result.json', DIR), 'utf8'));
  const md = fs.readFileSync(new URL('RESULT.md', DIR), 'utf8');
  assert.equal(r.params.MULT, P.MULT); assert.equal(r.params.HOLD, P.HOLD);
  assert.equal(r.verdict, r.tests[0].pass ? 'PASS' : 'FAIL');
  assert.equal(r.headline, verdictLine(r));
  assert.ok(r.headline.length < 220);
  assert.ok(md.includes(`**Verdict: ${r.headline}.**`));
  const [a, b, c] = r.tests, rd = READING.join('\n');
  const sg = (x, d = 3) => (x >= 0 ? '+' : '−') + Math.abs(x).toFixed(d);
  for (const s of [
    `${sg(a.is.netR)}R a trade net (n ${a.is.trades} in ${a.is.signalMonths} traded months, month t ${sg(a.is.monthNetT, 2)})`,
    `${sg(a.is.excessR)}R a trade below`, `(t ${sg(a.is.monthExcessT, 2)})`,
    `${sg(a.oos.netR)}R net (n ${a.oos.trades}, month t ${a.oos.monthNetT.toFixed(2)}; ${sg(a.oos.grossR)}R gross, t ${a.oos.monthGrossT.toFixed(2)})`,
    `${sg(a.oos.excessR)}R over the baseline (t ${a.oos.monthExcessT.toFixed(2)})`, `beat ${a.placebo.below} of 40`,
    `${a.oos.costR.toFixed(3)}R spread and slippage, ${a.oos.finR.toFixed(3)}R financing`, `median stop $${a.oos.medStop.toFixed(1)}`,
    `${sg(b.is.netR)}R in sample (n ${b.is.trades}, t ${b.is.monthNetT.toFixed(2)})`,
    `${sg(b.oos.netR)}R out of sample (n ${b.oos.trades}, t ${b.oos.monthNetT.toFixed(2)}, ${sg(b.oos.excessR)}R over the baseline, t ${b.oos.monthExcessT.toFixed(2)}, Holm p ${b.holmP}, ${b.placebo.below} of 40`,
    `${sg(r.baseline.long.oos.netR)}R a trade net out of sample`,
    `(${sg(c.is.netR)}R and ${sg(c.oos.netR)}R a trade net)`,
  ]) assert.ok(rd.includes(s.replace(/^−/, '−')), s);
  assert.ok(!a.pass && !b.pass && !c.pass);
});
