// Copper / gold ratio study (research/edge/copper-gold): the weekly signal reads no candle after its week end, the stop fires
// and is never loosened, a switch pays its spread, financing is the nights() rule, the statistics, and RESULT.md against
// result.json. Offline.
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { weekEnds, weekOf, signalAt, weekRows, simulate, welch, nwT, holm, placebo, ewRows, passOf, LOOK } from '../research/edge/copper-gold/run.mjs';
import { nights } from '../council/fills.mjs';

const rd = (p) => fs.readFileSync(new URL(p, import.meta.url), 'utf8');
const RES = rd('../research/edge/copper-gold/RESULT.md'), PRE = rd('../research/edge/copper-gold/PREREGISTRATION.md');
const R = JSON.parse(rd('../research/edge/copper-gold/result.json'));
const near = (a, b, e = 1e-9) => assert.ok(Math.abs(a - b) < e, `${a} vs ${b}`);
const T = (s) => Date.parse(s + 'T00:00:00Z') / 1000;

function mk(start, n, fn) {
  const out = []; let t = T(start), prev = fn(0);
  for (let i = 0; out.length < n; t += 86400) {
    const wd = new Date(t * 1000).getUTCDay(); if (wd === 0 || wd === 6) continue;
    const c = fn(i++); out.push({ time: t, open: prev, high: Math.max(prev, c) + 0.5, low: Math.min(prev, c) - 0.5, close: c }); prev = c;
  }
  return out;
}

test('week ends are Fridays, and the forming week has none', () => {
  const bars = mk('2020-01-06', 52, (i) => 100 + i);
  const ends = weekEnds(bars);
  for (const i of ends.values()) assert.equal(new Date(bars[i].time * 1000).getUTCDay(), 5);
  assert.ok(Math.max(...ends.values()) < bars.length - 1);
});

test('the signal reads only the metals at its week end and 13 weeks before', () => {
  const cu = mk('2020-01-06', 200, (i) => 3 + i * 0.01), au = mk('2020-01-06', 200, () => 1500);
  const ce = weekEnds(cu), ae = weekEnds(au), wks = [...ce.keys()].sort((a, b) => a - b), wk = wks[20];
  const s = signalAt(cu, au, ce, ae, wk);
  assert.equal(s.on, true);
  const i = ce.get(wk);
  const cu2 = cu.map((b, k) => (k > i ? { ...b, close: 0.01 } : b));
  assert.deepEqual(signalAt(cu2, au, weekEnds(cu2), ae, wk), s);
  assert.equal(signalAt(cu, au, ce, ae, wks[LOOK - 1]), null);           // no week 13 back: no signal
  // copper falling against gold: off
  const cd = mk('2020-01-06', 200, (i) => 5 - i * 0.01);
  assert.equal(signalAt(cd, au, weekEnds(cd), ae, wk).on, false);
});

test('next-week rows are open to open after the week end', () => {
  const bars = mk('2020-01-06', 30, (i) => 100 + i);
  const rows = weekRows(bars, () => ({ on: true }));
  const ends = [...weekEnds(bars).values()].sort((a, b) => a - b);
  near(rows[0].r, bars[ends[1] + 1].open / bars[ends[0] + 1].open - 1);
});

test('a switch in pays the spread, the stop fires and the market stays flat to the next week end; never loosened', () => {
  const bars = mk('2020-01-06', 120, (i) => 100 + i * 0.1);
  const ends = [...weekEnds(bars).entries()].sort((a, b) => a[0] - b[0]);
  const [, i0] = ends[6], k = i0 + 1;
  const s = simulate(bars, () => true, { spread: 1, rate: () => 0, from: bars[k].time, to: bars[k + 2].time + 1 });
  near(s.rets[0].r, bars[k].close / (bars[k].open + 1) - 1);
  near(s.rets[1].r, bars[k + 1].close / bars[k].close - 1);
  // a crash candle two days in: out at the stop, flat to the week's end
  const crash = bars.map((b, j) => (j === k + 2 ? { ...b, low: 0 } : b));
  const c = simulate(crash, () => true, { spread: 0, rate: () => 0, from: bars[k].time, to: bars[ends[7][1]].time + 1 });
  assert.equal(c.trades[0].why, 'stop');
  assert.ok(c.trades[0].stop0 < bars[i0].close);
  for (let d = 3; d < c.rets.length; d++) assert.equal(c.rets[d].r, 0);
  // a kept position: the stop only rises
  const long = simulate(bars, () => true, { spread: 0, rate: () => 0, from: bars[k].time, to: bars[110].time });
  assert.equal(long.trades.length, 0); assert.equal(long.switches, 1);
  // switching off closes at the next open with the spread
  const off = simulate(bars, (wk) => wk < ends[8][0], { spread: 1, rate: () => 0, from: bars[k].time, to: bars[110].time });
  assert.equal(off.trades[0].why, 'signal'); near(off.trades[0].exit, bars[ends[8][1] + 1].open - 1);
});

test('financing is nights() x the night rate while held', () => {
  const bars = mk('2020-01-06', 60, (i) => 100 + i * 0.1);
  const ends = [...weekEnds(bars).values()].sort((a, b) => a - b), k = ends[4] + 1;
  const a = simulate(bars, () => true, { spread: 0, rate: () => 0, from: bars[k].time, to: bars[k + 5].time });
  const b = simulate(bars, () => true, { spread: 0, rate: () => 0.001, from: bars[k].time, to: bars[k + 5].time });
  for (let d = 0; d < a.rets.length; d++) near(a.rets[d].r - b.rets[d].r, nights(bars[k + d].time, bars[k + d + 1].time) * 0.001);
});

test('statistics: Welch, Newey-West, Holm, placebo, equal weight, the bar', () => {
  const w = welch([1, 2, 3], [0, 0, 1]);
  near(w.diff, 5 / 3); near(w.t, (5 / 3) / Math.sqrt(1 / 3 + (1 / 3) / 3));
  const nw = nwT([1, 2, 3, 0, 0, 1], [1, 1, 1, 0, 0, 0], 0);
  near(nw.b, 5 / 3);
  assert.deepEqual(holm([0.01, 0.04]), [0.02, 0.04]);
  const rows = Array.from({ length: 50 }, (_, i) => ({ on: i % 3 === 0, r: Math.sin(i) }));
  assert.deepEqual(placebo(rows, 3), placebo(rows, 3));
  const ew = ewRows([[{ wk: 1, t: 1, on: true, r: 0.02 }], [{ wk: 1, t: 1, on: true, r: 0 }, { wk: 2, t: 2, on: false, r: 1 }]]);
  assert.equal(ew.length, 1); near(ew[0].r, 0.01);
  const ok = passOf({ W1: { ew: { diff: 1 } }, W2: { ew: { diff: 1, t: 2 } } }, { W2: { book: { rule: { sharpe: 1 }, bench: { sharpe: 1 } } } });
  assert.equal(ok.pass, true);
});

test('RESULT.md says what result.json says', () => {
  assert.equal(R.verdict, 'FAIL');
  assert.ok(RES.startsWith('**Verdict:** FAIL'));
  assert.equal(R.pass.pass, false);
  assert.deepEqual(R.pass.checks, { w2Positive: false, w1SameSign: true, w2Sharpe: false });
  const pct = (x) => (x * 100).toFixed(2), sgn = (x, d = 2) => (x < 0 ? '−' + Math.abs(x).toFixed(d) : x.toFixed(d));
  const e2 = R.signal.W2.ew, e1 = R.signal.W1.ew;
  assert.ok(RES.includes(`| 2016 to now (decisive) | equal-weight | ${e2.weeks} | ${pct(e2.onShare)} % | ${pct(e2.meanOn)} % | ${pct(e2.meanOff)} % | −${pct(-e2.diff)} % | ${sgn(e2.t)} | ${sgn(e2.nwT)} |`));
  assert.ok(RES.includes(`| 2008-15 (check) | equal-weight | ${e1.weeks} | ${pct(e1.onShare)} % | ${pct(e1.meanOn)} % | ${pct(e1.meanOff)} % | +${pct(e1.diff)} % | ${sgn(e1.t)} | ${sgn(e1.nwT)} |`));
  const b2 = R.rule_vs_benchmark.W2.book, b1 = R.rule_vs_benchmark.W1.book;
  for (const [s, lab] of [[b2.rule, 'rule'], [b2.bench, 'benchmark'], [b1.rule, 'rule'], [b1.bench, 'benchmark']]) {
    assert.ok(RES.includes(`| ${lab} | ${pct(s.cagr)} % | ${pct(s.vol)} % | ${s.sharpe.toFixed(2)} | ${pct(s.maxDD)} % |`), lab);
  }
  const p = R.signal.W2.placebo;
  assert.ok(RES.includes(`${p.atOrAboveReal} of ${p.seeds} placebos`));
  assert.equal(R.missing.length, 0);
  assert.ok(PRE.includes('Written and committed alone, before any return'));
});
