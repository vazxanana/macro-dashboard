// research/edge/gold-spx-rs: the rule on hand-made candles, no look-ahead, and the report against result.json (offline).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { signalAt, trade, monthEnds, atr, holm, pTwo, tstat, mAdd, P } from '../research/edge/gold-spx-rs/run.mjs';
import { headlineOf } from '../research/edge/verdict.mjs';

const dir = new URL('../research/edge/gold-spx-rs/', import.meta.url);
const R = JSON.parse(readFileSync(new URL('result.json', dir), 'utf8'));
const MD = readFileSync(new URL('RESULT.md', dir), 'utf8');

// weekday daily candles from 2020-01-01 for `days` days, close = f(i), range 2 around it
function bars(days, f) {
  const out = []; let t = Date.UTC(2020, 0, 1) / 1000;
  for (let i = 0; out.length < days; t += 86400) {
    const wd = new Date(t * 1000).getUTCDay(); if (wd === 0 || wd === 6) continue;
    const c = f(i), o = i ? f(i - 1) : c; out.push({ time: t, open: o, high: Math.max(o, c) + 1, low: Math.min(o, c) - 1, close: c }); i++;
  }
  return out;
}

test('signal: gold beating the S&P gives a buy, lagging a sell', () => {
  const g = bars(200, (i) => 1000 + i), s = bars(200, () => 3000);
  const gE = monthEnds(g), sE = monthEnds(s), m = '2020-06';
  const sg = signalAt(g, gE, s, sE, m);
  assert.ok(sg.rs > 0 && sg.sr === 0);
  const s2 = bars(200, (i) => 3000 + 10 * i), sg2 = signalAt(g, gE, s2, monthEnds(s2), m);
  assert.ok(sg2.rs < 0);
  assert.equal(mAdd('2020-01', -3), '2019-10');
});

test('no look-ahead: changing every candle after the month end leaves the signal and the stop unchanged', () => {
  const g = bars(200, (i) => 1000 + i), s = bars(200, (i) => 3000 + i / 2), m = '2020-04';
  const gE = monthEnds(g), i = gE.get(m);
  const a = signalAt(g, gE, s, monthEnds(s), m), t1 = trade(g, gE, m, 'buy');
  const g2 = g.map((b, k) => (k > i ? { ...b, close: b.close * 3, high: b.high * 3, low: b.low * 0.2 } : b));
  const s2 = s.map((b) => (b.time > g[i].time ? { ...b, close: 1 } : b));
  assert.deepEqual(signalAt(g2, monthEnds(g2), s2, monthEnds(s2), m), a);
  assert.equal(atr(g2, i), atr(g, i));
  assert.equal(trade(g2, monthEnds(g2), m, 'buy').stop, t1.stop);
});

test('trade: fixed 3 x ATR stop, exit at the open after the next month end, costs and financing', () => {
  const g = bars(200, (i) => 1000 + i), gE = monthEnds(g), m = '2020-04';
  const b = trade(g, gE, m, 'buy'), i = gE.get(m), j = gE.get('2020-05');
  assert.equal(b.entry, g[i + 1].open); assert.equal(b.exit, g[j + 1].open); assert.equal(b.how, 'month');
  assert.ok(Math.abs(b.r0 - 3 * atr(g, i)) < 1e-9 && b.stop < b.entry);
  assert.ok(b.fin > 0 && b.nights > 15 && Math.abs(b.net - (b.gross - b.spread - b.fin)) < 1e-12);
  const s = trade(g, gE, m, 'sell');   // a steady rise stops the sell out
  assert.equal(s.how, 'stop'); assert.equal(s.fin, 0); assert.ok(Math.abs(s.gross + 1) < 1e-9 || s.gross < -1);
  assert.ok(trade(g, gE, m, 'buy', { costX: 2 }).net < b.net);
});

test('statistics helpers', () => {
  assert.ok(Math.abs(pTwo(1.96, 1e6) - 0.05) < 1e-3);
  assert.deepEqual(holm([0.01, 0.04, 0.03]), [0.03, 0.06, 0.06]);
  assert.ok(Math.abs(tstat([1, 2, 3]).t - 2 / (1 / Math.sqrt(3))) < 1e-9);
  assert.equal(P.cost, 0.60);
});

test('the report matches result.json', () => {
  assert.equal(R.verdict, 'FAIL'); assert.equal(R.pass, false);
  const h = headlineOf(MD); assert.ok(h.length > 0 && h.length <= 220 && /^FAIL/.test(h), h);
  const o = R.T1.oos.net, s = R.T1.is.net;
  assert.ok(MD.includes(`n ${o.n}, t ${o.t.toFixed(2)}`));
  assert.ok(MD.includes(`| T1 switch, both sides (primary) | 2017-26 | ${o.n} |`));
  assert.ok(MD.includes(`| ${o.mean.toFixed(3)} | ${o.t.toFixed(2)} | ${R.T1.oos.net2.mean.toFixed(3)} | ${R.holm.T1.toFixed(3)} |`));
  assert.ok(MD.includes(`| ${s.mean.toFixed(3)} | ${s.t.toFixed(2)} |`));
  assert.ok(MD.includes(`95th percentile t ${R.placebo.T1.p95}`) && MD.includes(`${R.placebo.T1.atOrAbove} of 40`));
  assert.ok(MD.includes(`${R.T3.oos.net.mean.toFixed(3)} | ${R.T3.oos.net.t.toFixed(2)}`));
});
