// The quarter-end rebalancing flow study on US500: calendar, signal, stop, costs, split, no look-ahead, and the report against
// result.json. Offline: synthetic candles only, plus the committed result files.
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { quarterDays, quarters, addQ, split, sideOf, fold, trade, prepare, ruleTrades, placebo, rateOf, verdictOf, STOP_ATR, COST, HOLD } from '../research/edge/index-quarter-end/run.mjs';

const DAY = 86400;
// a straight daily series of weekday candles from a start date, close = f(i)
function rows(from, to, f, wiggle = 1) {
  const out = []; let i = 0;
  for (let t = Date.parse(from + 'T00:00:00Z') / 1000; t <= Date.parse(to + 'T00:00:00Z') / 1000; t += DAY) {
    const wd = new Date(t * 1000).getUTCDay(); if (wd === 0 || wd === 6) continue;
    const c = f(i++), o = c; out.push([t, o, Math.max(o, c) + wiggle, Math.min(o, c) - wiggle, c, 1]);
  }
  return out;
}

test('quarters and their NYSE trading days', () => {
  const qs = quarters();
  assert.equal(qs.length, 94); assert.equal(qs[0], '2003-Q2'); assert.equal(qs.at(-1), '2026-Q3');
  assert.equal(addQ('2014-Q4', 1), '2015-Q1'); assert.equal(addQ('2015-Q1', -1), '2014-Q4');
  const s = split(qs); assert.equal(s.is.size, 47); assert.ok(s.is.has('2014-Q4') && s.oos.has('2015-Q1'));
  const d = quarterDays('2024-Q1');
  assert.equal(d.at(-1), '2024-03-28');            // Good Friday 29 Mar 2024 is closed
  assert.ok(!d.includes('2024-01-01') && !d.includes('2024-01-15') && !d.includes('2024-02-19'));
  assert.equal(quarterDays('2024-Q4').at(-1), '2024-12-31');
  assert.equal(quarterDays('2024-Q4').at(-1 - HOLD), '2024-12-23');   // TD-6, 24 Dec is a trading (half) day, 25 Dec closed
});

test('stocks beating bonds sells, lagging buys, flat or missing trades nothing', () => {
  assert.equal(sideOf(0.02), -1); assert.equal(sideOf(-0.01), 1); assert.equal(sideOf(0), 0); assert.equal(sideOf(null), 0);
});

test('every trade has a stop 1.5 x ATR on the losing side; a gap fills at the open; costs in R', () => {
  const B = fold(rows('2024-01-01', '2024-03-29', (i) => 100 + i * 0.1));
  const idx = new Map(B.map((b, i) => [b.d, i])), rate = () => 2.5;
  const e = B[30].d, x = B[35].d;
  for (const side of [1, -1]) {
    const t = trade(B, idx, e, x, side, rate);
    assert.ok(side > 0 ? t.stop < t.entry : t.stop > t.entry);
    assert.ok(Math.abs(Math.abs(t.entry - t.stop) - t.risk) < 1e-9);
    assert.ok(Math.abs(t.costR - COST * t.entry / t.risk) < 1e-12);
    assert.ok(Math.abs(t.net2 - (t.net - t.costR)) < 1e-12);
    assert.equal(t.finR, side > 0 ? -(5 / 100 / 365 * t.nights * t.entry) / t.risk : 0);   // a sell at r = 2.5 receives 0
  }
  const atrRisk = trade(B, idx, e, x, 1, rate).risk / STOP_ATR;
  const G = B.map((b, i) => i === 31 ? { ...b, o: b.o - 10 * atrRisk, l: b.l - 10 * atrRisk } : b);
  const g = trade(G, idx, e, x, 1, rate);
  assert.equal(g.how, 'stop-gap'); assert.ok(g.gross < -1);
});

test('the signal and the trade read nothing after the entry; the placebo window ends by the entry', () => {
  const eq = rows('2002-06-01', '2004-12-31', (i) => 100 + i * 0.05), bd = rows('2002-06-01', '2004-12-31', () => 100, 0.2);
  const qs = ['2003-Q3', '2003-Q4', '2004-Q1'];
  const A = prepare({ spx500: eq, usb10y: bd }), base = ruleTrades(A, 'spx500', rateOf([['2003-01-01', 1]]), 'qe', qs);
  assert.equal(base.trades.length, 3); assert.ok(base.trades.every((t) => t.side === -1));   // stocks rose, bonds flat: sell
  // change every bond and stock price after each entry: the side does not move (the exit price may)
  for (const t of base.trades) {
    const cut = Date.parse(t.sD + 'T00:00:00Z') / 1000;
    const B2 = prepare({ spx500: eq.map((r) => r[0] > cut ? [r[0], 1, 2, 0.5, 1, 1] : r), usb10y: bd.map((r) => r[0] > cut ? [r[0], 500, 501, 499, 500, 1] : r) });
    const t2 = ruleTrades(B2, 'spx500', rateOf([['2003-01-01', 1]]), 'qe', [t.q]).trades[0];
    assert.equal(t2.side, t.side); assert.equal(t2.entry, t.entry); assert.equal(t2.risk, t.risk);
  }
  const pl = placebo(A, 'spx500', rateOf([['2003-01-01', 1]]), qs);
  assert.equal(pl.base.length, 40); assert.equal(pl.zero.length, 40); assert.equal(pl.x2.length, 40);
});

test('the report says what result.json holds, and FAIL', () => {
  const r = JSON.parse(fs.readFileSync(new URL('../research/edge/index-quarter-end/result.json', import.meta.url)));
  const md = fs.readFileSync(new URL('../research/edge/index-quarter-end/RESULT.md', import.meta.url), 'utf8');
  const m = r.markets.spx500;
  assert.equal(r.verdict, 'FAIL'); assert.deepEqual(verdictOf(m), { verdict: 'FAIL', checks: r.checks });
  assert.deepEqual(r.checks, { oosT: false, isNet: true, oos2x: false, placebo: false });
  const lead = md.split('\n').find((l) => /^\*\*Verdict: FAIL/.test(l));
  assert.ok(lead && lead.replace(/\*/g, '').length < 240, 'one bold verdict line with its reason');
  const f = (x) => (x > 0 ? '\\+' : '') + x.toFixed(3);
  assert.match(md, new RegExp(`\\| Out of sample \\| 2015-Q1 to 2026-Q3 \\| ${m.oos.n} \\| ${f(m.oos.net)} \\| ${m.oos.t.toFixed(2)} \\| ${f(m.oos.gross)} \\| ${f(m.oos.net2x)} \\|`));
  assert.match(md, new RegExp(`\\| In sample \\| 2003-Q2 to 2014-Q4 \\| ${m.is.n} \\| ${f(m.is.net)} \\| ${m.is.t.toFixed(2)} \\|`));
  assert.match(md, new RegExp(`\\| Base \\| ${f(m.oos.net)} \\| ${f(m.placebo.median.base)} \\| ${f(m.placebo.p95.base)} \\| ${m.placebo.beaten.base} \\|`));
  assert.match(md, new RegExp(`need a mean of about \\+${m.oos.needT2.toFixed(2)}R`));
  for (const k of ['nas100', 'us30', 'de40']) {
    const x = r.markets[k];
    assert.match(md, new RegExp(`\\| ${x.is.n} \\| ${f(x.is.net)} \\| ${x.is.t.toFixed(2)} \\| ${x.oos.n} \\| ${f(x.oos.net)} \\| ${x.oos.t.toFixed(2)} \\| ${f(x.oos.net2x)} \\| ${x.placebo.beaten.base} \\|`), k);
  }
  assert.ok(!/live change|now live/i.test(md.replace(/nothing live changed/i, '')), 'no live change claimed');
});
