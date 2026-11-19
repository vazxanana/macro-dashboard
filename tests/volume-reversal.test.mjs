// Volume-conditioned reversal study (research/edge/volume-reversal): offline checks of the signal on hand-made candles (the
// big-move decile, the volume median, placeholders), no look-ahead, the fade and its stop, the costs, month values, Holm,
// the pre-registered checks and the written report against result.json.
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {
  signalAt, simTrade, tradeAt, netOf, daysOf, monthValues, holm, pTwo, prepare, costFrac, finNight, monthsBetween, median,
  report, MARKETS, GROUPS, P, IS, OOS,
} from '../research/edge/volume-reversal/run.mjs';
import { FIN } from '../council/fills.mjs';

const dir = new URL('../research/edge/volume-reversal/', import.meta.url);
const result = JSON.parse(fs.readFileSync(new URL('result.json', dir), 'utf8'));
const md = fs.readFileSync(new URL('RESULT.md', dir), 'utf8');

// weekday candles from 2020-01-06; close follows small alternating returns, volume from a function of the index
function series(n, volOf, closeOf = (i, prev) => prev * (1 + (i % 2 ? 0.003 : -0.002) + (i % 7) * 0.0002)) {
  const bars = []; let t = Date.UTC(2020, 0, 6) / 1000, c = 100;
  while (bars.length < n) {
    const wd = new Date(t * 1000).getUTCDay();
    if (wd !== 0 && wd !== 6) { const i = bars.length; c = i ? closeOf(i, c) : 100; bars.push({ time: t, open: c, high: c * 1.002, low: c * 0.998, close: c, v: volOf(i) }); }
    t += 86400;
  }
  return bars;
}

test('pre-registered sets, windows, parameters and costs', () => {
  assert.equal(MARKETS.length, 32);
  assert.deepEqual(Object.keys(GROUPS), ['indices', 'metals', 'energy', 'fx']);
  assert.equal(monthsBetween(IS.from, IS.to).length, 144);
  assert.equal(monthsBetween(OOS.from, OOS.to).length, 118);
  assert.equal(P.RLOOK, 100); assert.equal(P.RTOP, 90); assert.equal(P.VLOOK, 50); assert.equal(P.H, 3); assert.equal(P.ATR_MULT, 1.5);
  assert.equal(costFrac('spx500'), 0.0003); assert.equal(costFrac('eurusd'), 0.00015); assert.equal(costFrac('xau'), 0.0002);
  assert.equal(finNight('xau', 1), FIN.xau.long); assert.equal(finNight('xau', -1), FIN.xau.short);
  assert.equal(finNight('de40', -1), 0.00015); assert.equal(finNight('usdjpy', 1), 0.00004);
  assert.equal(median([3, 1, 2]), 2); assert.equal(median([4, 1, 2, 3]), 2.5);
});

test('signal: top decile of the last 100 absolute returns, volume against the median of the last 50', () => {
  const d = 120;
  const b = series(140, (i) => 100 + (i % 50));
  b[d].close = b[d - 1].close * 1.05; // a big up day
  b[d].v = 10_000;
  let s = signalAt(b, d);
  assert.ok(s.big); assert.equal(s.rBelow, 100); assert.equal(s.cls, 'high'); assert.ok(s.r > 0);
  b[d].v = 50; s = signalAt(b, d); assert.equal(s.cls, 'low');
  b[d].v = s.med; assert.equal(signalAt(b, d).cls, 'mid');
  // a small move is not big
  b[d].close = b[d - 1].close * 1.0001; assert.ok(!signalAt(b, d).big);
  // too little history, and placeholders
  assert.equal(signalAt(b, 100), null);
  b[d - 10].v = 3; assert.equal(signalAt(b, d), null);
});

test('no look-ahead: changing every candle after the signal day changes neither the signal nor the ATR', () => {
  const b = series(140, (i) => 100 + (i % 50)); b[120].close = b[119].close * 0.95;
  const s0 = signalAt(b, 120);
  const b2 = b.map((x, i) => (i > 120 ? { ...x, v: 1e9, close: 1, open: 1, high: 1e6, low: 0.5 } : x));
  assert.deepEqual(signalAt(b2, 120), s0);
  // the trade reads nothing before the ATR window and the move window
  const t1 = tradeAt('spx500', b, 120, 1), t2 = tradeAt('spx500', b.map((x, i) => (i < 10 ? { ...x, v: 1 } : x)), 120, 1);
  assert.deepEqual(t1, t2);
});

test('the fade: short after an up day, long after a down day; every trade has a stop 1R against it', () => {
  const b = series(140, (i) => 100 + (i % 50)); b[120].close = b[119].close * 1.05;
  const days = daysOf('spx500', b);
  const x = days.find((y) => y.d === 120);
  assert.ok(x.big); assert.equal(x.trade.side, -1);
  const base = { time: 0, open: 100, high: 100, low: 100, close: 100 };
  const bar = (o, h, l, c, i) => ({ time: 86400 * i, open: o, high: h, low: l, close: c });
  // short: stop above
  assert.deepEqual(simTrade([base, bar(100, 102.5, 99, 101, 1), bar(101, 101, 100, 100, 2)], 0, -1, 2, 2), { entry: 100, stop: 102, exit: 102, exitIdx: 1, how: 'stop' });
  const g = simTrade([base, bar(104, 105, 103, 104, 1), bar(104, 104, 103, 103, 2)], 0, -1, 2, 2); assert.equal(g.how, 'gap'); assert.equal(g.exit, 104);
  // long: stop below, out at the close of d + H
  const c = simTrade([base, bar(100, 101, 99, 100.5, 1), bar(100.5, 102, 100, 101.5, 2)], 0, 1, 2, 2); assert.equal(c.how, 'close'); assert.equal(c.exit, 101.5);
  assert.equal(simTrade([base, bar(100, 101, 99, 100, 1)], 0, 1, 2, 2), null);
  const tr = tradeAt('spx500', b, 120, -1);
  assert.ok(tr.costR > 0 && tr.finR > 0);
  assert.ok(Math.abs(netOf(tr, 2) - (tr.gross - 2 * tr.costR - 2 * tr.finR)) < 1e-12);
  assert.equal(tradeAt('xau', b, 120, -1).finR, 0); // gold short: the broker's 0
});

test('month values are sums of net R; empty months are 0', () => {
  const T = (gross) => ({ gross, costR: 0.1, finR: 0 });
  const picked = [{ month: '2020-01', trade: T(1) }, { month: '2020-01', trade: T(-0.5) }, { month: '2020-03', trade: T(2) }];
  const v = monthValues(picked, { from: '2020-01', to: '2020-03' });
  assert.ok(Math.abs(v[0] - 0.3) < 1e-12); assert.equal(v[1], 0); assert.ok(Math.abs(v[2] - 1.9) < 1e-12);
  assert.deepEqual(monthValues(picked, { from: '2020-01', to: '2020-03' }, 0), [0.5, 0, 2]);
});

test('Holm step-down and the two-sided normal p', () => {
  assert.ok(Math.abs(pTwo(1.96) - 0.05) < 1e-3);
  const h = holm({ a: 0.01, b: 0.04, c: 0.03 });
  assert.ok(Math.abs(h.a - 0.03) < 1e-12); assert.ok(Math.abs(h.c - 0.06) < 1e-12); assert.ok(Math.abs(h.b - 0.06) < 1e-12);
});

test('weekend stubs are folded and rows before 2005 dropped', () => {
  const sat = Date.UTC(2005, 0, 8) / 1000, mon = Date.UTC(2005, 0, 10) / 1000;
  const b = prepare([[Date.UTC(2004, 11, 31) / 1000, 1, 1, 1, 1, 1], [sat, 2, 5, 1, 2, 7], [mon, 3, 4, 2, 3, 900]]);
  assert.equal(b.length, 1); assert.equal(b[0].open, 2); assert.equal(b[0].v, 900);
});

test('result.json: the checks, the verdict and the placebo follow the pre-registration', () => {
  const c = result.checks, t1 = result.tests.T1, po = result.blocks.pooled;
  assert.deepEqual(Object.keys(result.tests), ['T1', 'T2', 'T3', 'T4', 'T5', 'T6']);
  assert.equal(c.oosT2Holm, t1.mean > 0 && t1.t >= 2 && t1.pHolm <= 0.05);
  assert.equal(t1.mean, po.oos.low.net.mean);
  assert.equal(result.tests.T2.mean, po.oos.lowMinusHigh.net.mean);
  assert.equal(c.isPositive, po.is.low.net.mean > 0);
  assert.equal(c.oos2xPositive, po.oos.low.net2x.mean > 0);
  assert.equal(c.beatsPlacebo, result.placebo.beaten >= 38);
  assert.equal(result.placebo.runs.length, 40);
  assert.equal(result.placebo.beaten, result.placebo.runs.filter((x) => result.placebo.real > x).length);
  assert.equal(result.verdict, Object.values(c).every(Boolean) ? 'PASS' : 'FAIL');
  for (const v of Object.values(result.tests)) assert.equal(v.pass, v.t >= 2 && v.pHolm <= 0.05);
});

test('RESULT.md is the report of result.json, with the verdict reason inside the bold Verdict line', () => {
  assert.equal(report(result), md);
  const line = md.split('\n').find((l) => l.startsWith('**Verdict:'));
  assert.match(line, new RegExp(`^\\*\\*Verdict: ${result.verdict}\\. .+\\*\\*$`));
  assert.ok(line.replace(/\*\*/g, '').replace(/^Verdict: /, '').length <= 220, 'headline under 220 characters');
  assert.match(md, /proxy for volume, not traded volume/);
});
