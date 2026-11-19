// High-volume return premium study (research/edge/volume-premium): offline checks of the signal on hand-made candles (volume
// rank, the return cap, placeholders), no look-ahead, the stop, the costs, the month values, Holm, the pre-registered checks and
// the written report against result.json.
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {
  signalAt, simLong, tradeAt, netOf, daysOf, benchMap, monthValues, holm, pTwo, prepare, costFrac, finNight, monthsBetween,
  report, MARKETS, GROUPS, P, IS, OOS,
} from '../research/edge/volume-premium/run.mjs';
import { FIN } from '../council/fills.mjs';

const dir = new URL('../research/edge/volume-premium/', import.meta.url);
const result = JSON.parse(fs.readFileSync(new URL('result.json', dir), 'utf8'));
const md = fs.readFileSync(new URL('RESULT.md', dir), 'utf8');

// weekday candles from 2020-01-06, volume and close from functions of the index
function series(n, volOf, closeOf) {
  const bars = []; let t = Date.UTC(2020, 0, 6) / 1000;
  while (bars.length < n) {
    const wd = new Date(t * 1000).getUTCDay();
    if (wd !== 0 && wd !== 6) { const i = bars.length, c = closeOf(i); bars.push({ time: t, open: c, high: c * 1.002, low: c * 0.998, close: c, v: volOf(i) }); }
    t += 86400;
  }
  return bars;
}
// alternating small returns so the return cap has a spread to rank against
const wiggle = (i) => 100 * (1 + (i % 2 ? 0.003 : -0.002) + (i % 7) * 0.0005);

test('pre-registered sets, windows and costs', () => {
  assert.equal(MARKETS.length, 32);
  assert.deepEqual(Object.keys(GROUPS), ['indices', 'metals', 'energy', 'fx']);
  assert.equal(GROUPS.indices.length, 17);
  for (const k of ['xaueur', 'xaugbp', 'xauxag', 'corn', 'usb10y', 'eurgbp']) assert.ok(!MARKETS.includes(k), k);
  assert.equal(monthsBetween(IS.from, IS.to).length, 144);
  assert.equal(monthsBetween(OOS.from, OOS.to).length, 118);
  assert.equal(costFrac('spx500'), 0.0003); assert.equal(costFrac('eurusd'), 0.00015); assert.equal(costFrac('xau'), 0.0002);
  assert.equal(costFrac('xag'), 0.001); assert.equal(costFrac('xpd'), 0.002); assert.equal(costFrac('natgas'), 0.001);
  assert.equal(finNight('xau'), FIN.xau.long); assert.equal(finNight('de40'), 0.00015); assert.equal(finNight('usdjpy'), 0.00004);
  assert.equal(P.LOOK, 50); assert.equal(P.TOP, 45); assert.equal(P.H, 5); assert.equal(P.H2, 20);
});

test('signal: top / bottom decile of the previous 50 quote counts, the return cap, placeholders', () => {
  const d = 60;
  // volume 100 + i % 50 before d: d's volume 1000 is above all 50 → high
  const b = series(80, (i) => (i === d ? 1000 : 100 + (i % 50)), wiggle);
  const s = signalAt(b, d);
  assert.equal(s.above, 50); assert.ok(s.high); assert.ok(!s.low); assert.ok(s.eligible);
  // exactly above 45 of 50 → high; above 44 → not
  const sorted = b.slice(d - 50, d).map((x) => x.v).sort((x, y) => x - y);
  b[d].v = sorted[44] + 0.5; assert.equal(signalAt(b, d).above, 45); assert.ok(signalAt(b, d).high);
  b[d].v = sorted[43] + 0.5; assert.equal(signalAt(b, d).above, 44); assert.ok(!signalAt(b, d).high);
  // bottom decile → low
  b[d].v = 50; assert.ok(signalAt(b, d).low);
  // a big-move day (return above all 50 previous) is not eligible, high volume or not; without the cap it is
  b[d].v = 1000; b[d].close = b[d - 1].close * 1.05;
  assert.ok(!signalAt(b, d).eligible); assert.ok(!signalAt(b, d).high);
  assert.ok(signalAt(b, d, { cap: false }).high);
  // placeholders and too little history
  const c = series(80, (i) => (i === 30 ? 2 : 100 + (i % 50)), wiggle);
  assert.equal(signalAt(c, 60), null); // a v < 10 in the window
  assert.equal(signalAt(c, 50), null); // fewer than 51 candles before
  c[70].v = 5; assert.equal(signalAt(c, 70), null);
});

test('no look-ahead: changing every candle after the signal day changes neither the signal nor the ATR', () => {
  const b = series(100, (i) => (i === 60 ? 1000 : 100 + (i % 50)), wiggle);
  const s0 = signalAt(b, 60);
  const b2 = b.map((x, i) => (i > 60 ? { ...x, v: 1e9, close: 1, open: 1, high: 1e6, low: 0.5 } : x));
  assert.deepEqual(signalAt(b2, 60), s0);
  // and the trade only reads candles after its entry candle (entry = the signal day's close)
  const t1 = tradeAt('spx500', b, 60, 5), t2 = tradeAt('spx500', b.map((x, i) => (i < 40 ? { ...x, v: 1 } : x)), 60, 5);
  assert.deepEqual(t1, t2);
});

test('every trade has a stop 1R below: a touch fills at the stop, an open below at the open; out at the close of d + H', () => {
  const base = { time: 0, open: 100, high: 100, low: 100, close: 100 };
  const bar = (o, h, l, c, i) => ({ time: 86400 * i, open: o, high: h, low: l, close: c });
  assert.deepEqual(simLong([base, bar(100, 101, 97.5, 98, 1), bar(98, 99, 97, 98, 2)], 0, 2, 2), { entry: 100, stop: 98, exit: 98, exitIdx: 1, how: 'stop' });
  const g = simLong([base, bar(96, 97, 95, 96, 1), bar(96, 97, 95, 96, 2)], 0, 2, 2); assert.equal(g.how, 'gap'); assert.equal(g.exit, 96);
  const x = simLong([base, bar(100, 101, 99, 100.5, 1), bar(100.5, 102, 100, 101.5, 2)], 0, 2, 2); assert.equal(x.how, 'close'); assert.equal(x.exit, 101.5);
  assert.equal(simLong([base, bar(100, 101, 99, 100, 1)], 0, 2, 2), null); // not enough candles after
  const b = series(100, () => 100, wiggle), tr = tradeAt('spx500', b, 60, 5);
  assert.ok(tr.costR > 0 && tr.finR > 0);
  assert.ok(Math.abs(netOf(tr) - (tr.gross - tr.costR - tr.finR)) < 1e-12);
  assert.ok(Math.abs(netOf(tr, 2) - (tr.gross - 2 * tr.costR - 2 * tr.finR)) < 1e-12);
});

test('month values: high minus the all-days mean of the same market and month; empty months are 0', () => {
  const T = (gross) => ({ gross, costR: 0, finR: 0 });
  const days = [
    { key: 'a', month: '2020-01', high: true, trade: T(1) }, { key: 'a', month: '2020-01', high: false, trade: T(-1) },
    { key: 'b', month: '2020-01', high: true, trade: T(0.5) }, { key: 'b', month: '2020-01', high: false, trade: T(0.5) },
    { key: 'a', month: '2020-03', high: true, trade: T(2) },
  ];
  const bench = benchMap(days);
  const v = monthValues(days.filter((x) => x.high), bench, { from: '2020-01', to: '2020-03' });
  assert.deepEqual(v, [1 - 0 + 0.5 - 0.5, 0, 0]);
  assert.deepEqual(monthValues(days.filter((x) => x.high), bench, { from: '2020-01', to: '2020-03' }, 1, { diff: false }), [1.5, 0, 2]);
});

test('Holm step-down and the two-sided normal p', () => {
  assert.ok(Math.abs(pTwo(1.96) - 0.05) < 1e-3);
  const h = holm({ a: 0.01, b: 0.04, c: 0.03 });
  assert.ok(Math.abs(h.a - 0.03) < 1e-12); assert.ok(Math.abs(h.c - 0.06) < 1e-12); assert.ok(Math.abs(h.b - 0.06) < 1e-12);
});

test('weekend stubs are folded and rows before 2005 dropped', () => {
  const sat = Date.UTC(2005, 0, 8) / 1000, mon = Date.UTC(2005, 0, 10) / 1000;
  const rows = [[Date.UTC(2004, 11, 31) / 1000, 1, 1, 1, 1, 1], [sat, 2, 5, 1, 2, 7], [mon, 3, 4, 2, 3, 900]];
  const b = prepare(rows);
  assert.equal(b.length, 1); assert.equal(b[0].open, 2); assert.equal(b[0].high, 5); assert.equal(b[0].v, 900);
  assert.equal(daysOf('spx500', b, 5).length, 0);
});

test('result.json: the checks, the verdict and the placebo follow the pre-registration', () => {
  const c = result.checks, tp = result.tests.pooled, po = result.horizons[P.H].pooled;
  assert.equal(c.oosT2Holm, tp.mean > 0 && tp.t >= 2 && tp.pHolm <= 0.05);
  assert.equal(c.isPositive, result.horizons[P.H].pooled.is.highMinusAll.net.mean > 0);
  assert.equal(c.oos2xPositive, po.oos.highMinusAll.net2x.mean > 0 && po.oos.highOwn.net2x.mean > 0);
  assert.equal(c.beatsPlacebo, result.placebo.beaten >= 38);
  assert.equal(result.placebo.runs.length, 40);
  assert.equal(result.placebo.beaten, result.placebo.runs.filter((x) => result.placebo.real > x).length);
  assert.equal(result.verdict, Object.values(c).every(Boolean) ? 'PASS' : 'FAIL');
  assert.deepEqual(Object.keys(result.tests), ['pooled', 'indices', 'metals', 'energy', 'fx']);
  for (const v of Object.values(result.tests)) assert.equal(v.pass, v.t >= 2 && v.pHolm <= 0.05);
});

test('RESULT.md is the report of result.json, with the verdict reason inside the bold Verdict line', () => {
  assert.equal(report(result), md);
  const line = md.split('\n').find((l) => l.startsWith('**Verdict:'));
  assert.match(line, new RegExp(`^\\*\\*Verdict: ${result.verdict}\\. .+\\*\\*$`));
  assert.ok(line.replace(/\*\*/g, '').replace(/^Verdict: /, '').length <= 220, 'headline under 220 characters');
  assert.match(md, /quote count/);
});
