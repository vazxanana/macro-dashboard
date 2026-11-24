// tests/fade-cost-floor.test.mjs - the cost-floor study: its result file, its pre-registered bar, and that the selection reads
// only what is known at the entry (fill and stop), never an outcome. Offline: no candle is read.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import * as S from '../research/edge/fade-cost-floor/run.mjs';
import { COSTS } from '../research/edge/combo-grid-2/run.mjs';

const dir = new URL('../research/edge/fade-cost-floor/', import.meta.url);
const J = JSON.parse(fs.readFileSync(new URL('result.json', dir), 'utf8'));
const md = fs.readFileSync(new URL('RESULT.md', dir), 'utf8');
const pre = fs.readFileSync(new URL('PREREGISTRATION.md', dir), 'utf8');
const src = fs.readFileSync(new URL('run.mjs', dir), 'utf8');

test('the pre-registered floors, seed and test count', () => {
  assert.deepEqual(S.FLOORS, [0.03, 0.05, 0.10]);
  assert.match(pre, /cost_R <= 0\.03, <= 0\.05, <= 0\.10/);
  assert.match(pre, /mulberry32 seed 20261124/);
  assert.equal(S.SEED, 20261124);
  assert.equal(J.tests.length, 15);
  assert.deepEqual(J.assumedCosts, ['xag', 'nzdusd', 'usdcad', 'usdchf', 'eurjpy']);
});

test('the selection is entry-time only: cost over |fill - stop|, outcome ignored', () => {
  assert.ok(Math.abs(S.costR('xau', 4000, 3990) - COSTS.xau / 10) < 1e-12);
  assert.ok(Math.abs(S.costR('eurusd', 1.1, 1.102) - COSTS.eurusd / 0.002) < 1e-9);
  const a = { cr: 0.04, R: 2, Rm: -1 }, b = { cr: 0.04, R: -1, Rm: 2 };
  for (const f of S.FLOORS) assert.equal(S.keep(a, f), S.keep(b, f));
  assert.equal(S.keep({ cr: 0.031 }, 0.03), false); assert.equal(S.keep({ cr: 0.03 }, 0.03), true);
  // the stored cost_R is built from the fill and the stop as placed, nothing else
  assert.match(src, /costR\(market, fill, r\.stop\)/);
  assert.match(src, /const s = r\.side, fill = r\.entry, risk = s \* \(fill - r\.stop\)/);
});

test('every test re-judges from its figures to the stored verdict', () => {
  for (const x of J.tests) {
    const c1 = x.net.d.mean > 0 && x.net.c.mean > 0, c2 = x.net.c.n >= 200, c3 = x.net.c.t >= 2 && x.holm < 0.05;
    const c4 = !(x.coin.c.mean > 0 && x.coin.c.t >= 2) && x.diff.c.t >= 2;
    assert.equal(x.pass, x.valid && c1 && c2 && c3 && c4, x.rule + ' ' + x.floor);
    assert.ok(x.holm >= x.net.c.p);
  }
  assert.equal(J.verdict, 'FAIL'); assert.equal(J.passes, 0);
  assert.ok(Object.values(J.gate).every((g) => g.ok));
});

test('RESULT.md quotes result.json', () => {
  assert.match(md, /^# Fade rules with a cost floor \(result\)\n\n\*\*Verdict: FAIL, 0 of 15/);
  const f = J.tests.find((x) => x.rule === 'fvg' && x.floor === 0.03);
  assert.equal(f.net.c.n, 4118); assert.equal(f.net.c.mean, 0.0256); assert.equal(f.net.c.t, 1.23);
  assert.match(md, /\+0\.026R a trade after costs \(n 4,118, month t 1\.23/);
  const b = J.tests.find((x) => x.rule === 'fade' && x.floor === 0.03);
  assert.equal(b.net.c.n, 1782); assert.match(md, /\| Break fade \| 0\.03 \| 4,930 \|/);
  assert.match(md, /A before-cost tilt is not an edge/);
});

test('the month statistics and the seeded coin are deterministic', () => {
  const tr = [{ t: Date.UTC(2015, 0, 5) / 1000, R: 1, Rm: -1, cr: 0.1 }, { t: Date.UTC(2015, 1, 5) / 1000, R: -1, Rm: 1, cr: 0.1 }];
  assert.deepEqual(S.coins(tr, 7), S.coins(tr, 7));
  const w = S.win(tr, (x) => x.R - x.cr);
  assert.equal(w.c.n, 2); assert.ok(Math.abs(w.c.mean + 0.1) < 1e-12); assert.equal(w.d.n, 0); assert.equal(w.c.months, 142);
});
