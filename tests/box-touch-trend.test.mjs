// node --test tests/box-touch-trend.test.mjs - the pre-registered box-edge touch with the H1 trend
// (research/edge/box-touch-trend), offline: no look-ahead on toolkit-style synthetic candles, every trade's stop on the
// losing side, the pass bar, and RESULT.md against result.json.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import * as K from '../research/edge/_lib/edgekit.mjs';
import { runMarket, verdictOf, P } from '../research/edge/box-touch-trend/run.mjs';

const DIR = new URL('../research/edge/box-touch-trend/', import.meta.url);
const T0 = Date.UTC(2024, 0, 8) / 1000;
function walk(n, seed = 5) {
  const r = K.rng(seed); const out = []; let p = 100, drift = 0;
  for (let i = 0; i < n; i++) {
    if (i % 500 === 0) drift = (r() - 0.5) * 0.2;
    const o = p, c = o + drift + (r() - 0.5) * 1.2, h = Math.max(o, c) + r() * 0.5, l = Math.min(o, c) - r() * 0.5;
    out.push({ t: T0 + i * 300, o, h, l, c, e: T0 + (i + 1) * 300 }); p = c;
  }
  return out;
}
const perturb = (bars, T) => bars.map((b) => (b.t < T ? b : { ...b, o: b.o * 1.03 + 2, h: b.h * 1.03 + 4, l: b.l * 1.03 - 1, c: b.c * 1.03 - 1 }));

test('no look-ahead: trades closed before a cut do not move when every later price changes', () => {
  const B = walk(30000);
  for (const tf of [900, 300]) {
    const base = runMarket(B, 'syn', { tf, cost: 0.01 });
    assert.ok(base.length > 40, 'synthetic market gives trades on ' + tf);
    for (const frac of [0.3, 0.55, 0.8]) {
      const T = B[Math.floor(B.length * frac)].t;
      const A = runMarket(perturb(B, T), 'syn', { tf, cost: 0.01 });
      const keep = (xs) => xs.filter((x) => x.exitT < T); // a gap exit at the open of the candle starting at T uses that candle
      assert.ok(keep(base).length > 5);
      assert.deepEqual(keep(A), keep(base));
    }
  }
});

test('every trade has its stop on the losing side, its target on the winning side, 5R at most before costs', () => {
  const xs = runMarket(walk(20000, 9), 'syn', { tf: 900, cost: 0.01 });
  for (const x of xs) {
    assert.ok(x.side * (x.entry - x.stop) > 0 && x.side * (x.target - x.entry) > 0);
    assert.ok(Math.abs(Math.abs(x.target - x.entry) / Math.abs(x.entry - x.stop) - 1 / P.stopFrac) < 1e-6);
    assert.ok(x.R <= 5 + 1e-6 && x.R >= -1 - 1e-9 || x.reason === 'stop');
    assert.ok(x.entryT >= x.placed && x.exitT > x.entryT);
  }
  for (let i = 1; i < xs.length; i++) assert.ok(xs[i].entryT >= xs[i - 1].exitT, 'one position at a time');
  const tj = JSON.parse(fs.readFileSync(new URL('trades.json', DIR)));
  const c = Object.fromEntries(tj.cols.map((k, i) => [k, i]));
  assert.ok(tj.rows.length > 1000);
  for (const r of tj.rows) {
    assert.ok(r[c.side] * (r[c.target] - r[c.stop]) > 0, 'target and stop on opposite sides');
    // the entry is the filled price: only a fill at an open already past the stop sits beyond it, and it is stopped at once
    if (!(r[c.side] * (r[c.entry] - r[c.stop]) > 0)) assert.equal(r[c.reason], 'stop');
    else assert.ok(r[c.side] * (r[c.target] - r[c.entry]) > 0);
  }
  assert.ok(fs.statSync(new URL('trades.json', DIR)).size < 3e6);
});

test('the pass bar as pre-registered', () => {
  const w = (n, m, t) => ({ net: { n, meanR: m, tMonth: t }, net2x: { meanR: m - 0.05 }, gross: { meanR: m + 0.05 } });
  const good = { rep: w(500, 0.1, 2.5), is: w(300, 0.1, 2), oos: w(100, 0.1, 2.5) };
  assert.equal(verdictOf(good, 0.01), 'PASS');
  assert.equal(verdictOf(good, 0.08), 'INCONCLUSIVE');
  assert.equal(verdictOf({ ...good, rep: w(500, 0.1, 1.5) }, 0.01), 'INCONCLUSIVE');
  assert.equal(verdictOf({ ...good, oos: w(20, 0.1, 2.5) }, 0.01), 'INCONCLUSIVE');
  assert.equal(verdictOf({ ...good, rep: w(500, -0.01, 1) }, 0.01), 'FAIL');
  assert.equal(verdictOf({ ...good, oos: { ...w(100, 0.03, 2.5), net2x: { meanR: -0.01 } } }, 0.01), 'FAIL');
});

test('RESULT.md says what result.json says', () => {
  const res = JSON.parse(fs.readFileSync(new URL('result.json', DIR)));
  const md = fs.readFileSync(new URL('RESULT.md', DIR), 'utf8');
  assert.match(md, new RegExp(`\\*\\*Verdict: ${res.verdict}\\.\\*\\*`));
  assert.equal(res.verdict, res.tests[0].verdict);
  const fmt = (v) => (v > 0 ? '+' : v < 0 ? '−' : '') + Math.abs(v).toFixed(3);
  for (const t of res.tests) for (const k of ['rep', 'is', 'oos']) {
    const b = t.windows[k].net;
    assert.ok(md.includes(`| ${b.n} | ${fmt(b.meanR)} |`), `${t.id} ${k} row`);
  }
  assert.ok(!/\b(is|as|an) edge\b/i.test(md), 'never calls it an edge');
});
