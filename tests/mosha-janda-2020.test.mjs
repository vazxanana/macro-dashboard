// tests/mosha-janda-2020.test.mjs - the Janda study on 18 markets (research/edge/mosha-janda-2020). Offline: no candle cache,
// synthetic candles for the rule checks, result.json for the report's figures.
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import * as K from '../research/edge/_lib/edgekit.mjs';
import { janda, trades, atr, P, windowStats, bar, verdictOf } from '../research/edge/mosha-janda-2020/run.mjs';

const DIR = new URL('../research/edge/mosha-janda-2020/', import.meta.url);
const R = JSON.parse(fs.readFileSync(new URL('result.json', DIR), 'utf8'));
const MD = fs.readFileSync(new URL('RESULT.md', DIR), 'utf8');

function walk(n, seed = 5) { // a seeded 5-minute random walk with drifting regimes
  const r = K.rng(seed), out = []; let p = 100, drift = 0;
  for (let i = 0; i < n; i++) {
    if (i % 600 === 0) drift = (r() - 0.5) * 0.02;
    const o = p, c = o + drift + (r() - 0.5) * 0.3, h = Math.max(o, c) + r() * 0.15, l = Math.min(o, c) - r() * 0.15;
    const t = 1577836800 + i * 300; out.push({ t, o, h, l, c, e: t + 300 }); p = c;
  }
  return out;
}

test('every order has its stop on the losing side and a risk of at least three costs', () => {
  const m5 = walk(40000), B = K.resample(m5, 3600);
  const { orders } = janda(B, m5, 0.01);
  assert.ok(orders.length > 5, 'some orders on the synthetic market');
  for (const o of orders) { assert.ok(o.side * (o.entry - o.stop) >= P.minCostX * 0.01); assert.ok(o.depth >= 0 && o.depth <= 1); }
  const r = trades(orders, m5, B, 0.01, 2);
  for (const x of r.trades) { assert.ok(x.side * (x.fill - x.stop) > 0); assert.ok(x.R >= -1.0001 || x.reason === 'stop'); }
});

test('cut test: orders before a cut do not change when later candles are removed', () => {
  const m5 = walk(40000, 11), cut = m5[25000].e;
  const key = (o) => [o.side, o.t, o.entry.toFixed(8), o.stop.toFixed(8)].join('|');
  const full = janda(K.resample(m5, 3600), m5, 0.01).orders.filter((o) => o.t <= cut).map(key);
  const cutM = m5.filter((b) => b.e <= cut);
  const part = janda(K.resample(cutM, 3600), cutM, 0.01).orders.filter((o) => o.t <= cut).map(key);
  assert.ok(full.length > 0); assert.deepEqual(part, full);
  for (const v of Object.values(R.cutTest)) assert.equal(v.same, true);
});

test('atr is known at each close', () => {
  const m5 = walk(500, 3), a = atr(m5), b = atr(m5.slice(0, 200));
  for (let i = 0; i < 200; i++) assert.equal(a[i], b[i]);
});

test('the bar and the verdict follow the pre-registration', () => {
  for (const [id, t] of Object.entries(R.tests)) assert.deepEqual(bar(t.eval, t.pHolm), t.bar, id);
  assert.equal(R.verdict, verdictOf(R.tests));
  const s = windowStats([{ fillT: 1580000000, exitT: 1580003600, Rnet: 1, R: 1 }], Date.UTC(2020, 0, 1) / 1000, Date.UTC(2020, 3, 1) / 1000);
  assert.equal(s.months, 3); assert.equal(s.n, 1);
});

test('RESULT.md states the figures of result.json', () => {
  assert.match(MD.split('\n')[2], new RegExp('^\\*\\*Verdict: ' + R.verdict + '\\.'));
  const f = (x) => (x >= 0 ? '+' : '−') + Math.abs(x).toFixed(3), tf = (x) => (x >= 0 ? '' : '−') + Math.abs(x).toFixed(2);
  for (const id of ['T1', 'T2', 'T3']) {
    const e = R.tests[id].eval;
    for (const w of ['disc', 'conf']) {
      assert.ok(MD.includes(String(e[w].n)), id + ' ' + w + ' n');
      assert.ok(MD.includes(f(e[w].meanR)), id + ' ' + w + ' mean ' + f(e[w].meanR));
      assert.ok(MD.includes('t ' + tf(e[w].tMonth)), id + ' ' + w + ' t ' + tf(e[w].tMonth));
    }
  }
  assert.ok(MD.includes(f(R.report.gold.conf.meanR)) && MD.includes(String(R.report.gold.conf.n)));
});

test('no owner documents or people named', () => {
  const text = (MD + fs.readFileSync(new URL('PREREGISTRATION.md', DIR), 'utf8')).replaceAll('mosha-janda-2020', '');
  assert.doesNotMatch(text, /Mosha|Private Room|S\.CODE|Luxus|skill/i);
});
