// node --test tests/ltf-choch-entry.test.mjs - the pre-registered lower-timeframe ChoCh entry (research/edge/ltf-choch-entry),
// offline: no look-ahead on synthetic candles, every stop on the losing side, the one-pass exits, the pass bar, and RESULT.md
// against result.json.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import * as K from '../research/edge/_lib/edgekit.mjs';
import { runMarket, sim, verdictOf } from '../research/edge/ltf-choch-entry/run.mjs';

const DIR = new URL('../research/edge/ltf-choch-entry/', import.meta.url);
const T0 = Date.UTC(2024, 0, 8) / 1000;
function walk1m(n, seed = 5) {
  const r = K.rng(seed); const out = []; let p = 100, drift = 0;
  for (let i = 0; i < n; i++) {
    if (i % 3000 === 0) drift = (r() - 0.5) * 0.06;
    const o = p, c = o + drift + (r() - 0.5) * 0.5, h = Math.max(o, c) + r() * 0.2, l = Math.min(o, c) - r() * 0.2;
    out.push({ t: T0 + i * 60, o, h, l, c, e: T0 + (i + 1) * 60 }); p = c;
  }
  return out;
}
const to5 = (M1) => K.resample(M1, 300).map(({ n, ...b }) => b);
const perturb = (bars, T) => bars.map((b) => (b.t < T ? b : { ...b, o: b.o * 1.03 + 2, h: b.h * 1.03 + 4, l: b.l * 1.03 - 1, c: b.c * 1.03 - 1 }));
const run = (M1) => runMarket({ M5: to5(M1), M1, cost: 0.02, start: T0 }).trades;
const lastExit = (x) => Math.max(...x.X.filter((v) => v != null));

test('no look-ahead: trades closed before a cut do not move when every later price changes', () => {
  const M1 = walk1m(120000);
  const base = run(M1);
  for (const etf of ['15m', '5m', '1m']) assert.ok(base.filter((x) => x.etf === etf).length > 10, 'synthetic trades on ' + etf);
  for (const frac of [0.35, 0.6, 0.85]) {
    const T = M1[Math.floor(M1.length * frac)].t;
    const A = run(perturb(M1, T));
    const keep = (xs) => xs.filter((x) => lastExit(x) < T).map((x) => JSON.stringify(x)).sort();
    assert.ok(keep(base).length > 20);
    assert.deepEqual(keep(A), keep(base));
  }
});

test('every trade has its stop on the losing side; a 2R / 3R exit is at most the target', () => {
  const xs = run(walk1m(80000, 9));
  assert.ok(xs.length > 30);
  for (const x of xs) {
    assert.ok(x.risk > 0 && x.cr > 0);
    assert.ok(x.R[0] <= 2 + 1e-9 && x.R[1] <= 3 + 1e-9, 'targets cap R (no gap beyond can pay more)');
    assert.ok(x.R[0] >= -1 - 50, 'finite');
  }
});

test('sim: stop first in one candle, a limit fill candle can only stop, time exit', () => {
  const B = [[0, 100, 100.5, 99.5, 100], [1, 100, 103, 98.8, 101], [2, 101, 107, 100.5, 106]].map(([i, o, h, l, c]) => ({ t: i * 60, o, h, l, c, e: (i + 1) * 60 }));
  const a = sim(B, 1, null, 99, 'mkt', 60, null, null, 3600); // fill 100 at candle 1, which reaches 98.8: a stop
  assert.equal(a.R[0], -1); assert.equal(a.X[0], 120);
  const b = sim(B, 1, 100, 98.5, 'lim', 0, 600, 106, 3600); // fill at 100 on candle 0 (only the stop counts), 2R = 103 on candle 1
  assert.equal(b.fill, 100); assert.equal(b.R[0], 2); assert.equal(b.R[1], 3); assert.equal(b.R[2], 4);
  assert.equal(sim(B, 1, null, 101, 'mkt', 0, null, null, 3600), null, 'a stop above the fill is bad');
});

test('RESULT.md agrees with result.json, and the verdict follows the bar', () => {
  const R = JSON.parse(fs.readFileSync(new URL('result.json', DIR), 'utf8'));
  const md = fs.readFileSync(new URL('RESULT.md', DIR), 'utf8');
  assert.equal(verdictOf(R.tests), R.verdict);
  assert.match(md.split('\n')[2], new RegExp(`^\\*\\*Verdict: ${R.verdict}\\. `));
  for (const k of ['T1', 'T2', 'T3', 'T4']) assert.ok(md.includes(`${k}`) && md.includes(R.tests[k].verdict));
  const fmt = (v, d) => (v < 0 ? '−' : '+') + Math.abs(v).toFixed(d);
  assert.ok(md.includes(`n ${R.tests.T1.conf.n}`) && md.includes(fmt(R.tests.T1.conf.mean, 3) + 'R'), 'T1 confirmation figures');
  assert.ok(md.includes(`t ${fmt(R.tests.T1.conf.tMonth, 2)}`));
  assert.ok(md.includes(`n ${R.tests.T2.conf.n}`) && md.includes(fmt(R.tests.T2.conf.mean, 3) + 'R'), 'T2 confirmation figures');
  assert.ok(md.includes(fmt(R.tests.T3.conf.diff, 3) + 'R') && md.includes(fmt(R.tests.T4.conf.diff, 3) + 'R'), 'differences');
  assert.equal(R.headline, md.split('\n')[2].replace(/^\*\*Verdict: \w+\. /, '').replace(/\*\*$/, ''));
  assert.ok(!/\bedge\b/i.test(R.headline), 'the headline never calls it an edge');
});
