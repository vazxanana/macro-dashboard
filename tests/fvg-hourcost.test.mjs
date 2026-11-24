// tests/fvg-hourcost.test.mjs - the FVG return at the demo broker's measured hourly spreads (research/edge/fvg-hourcost).
// Offline: the stored result, the cost formula, and the 1R exit walk against dom-trade-through's manage on made-up candles.
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { exitWalk, costFrac, MEASURED, APART } from '../research/edge/fvg-hourcost/run.mjs';
import { manage } from '../research/edge/dom-trade-through/run.mjs';

const R = JSON.parse(fs.readFileSync(new URL('../research/edge/fvg-hourcost/result.json', import.meta.url), 'utf8'));
const P = JSON.parse(fs.readFileSync(new URL('../research/edge/fvg-hourcost/profile.json', import.meta.url), 'utf8'));
const G7 = JSON.parse(fs.readFileSync(new URL('../research/edge/grid7-fvg-wide/result.json', import.meta.url), 'utf8'));

test('verdict and the primary test as stored', () => {
  assert.equal(R.verdict, 'FAIL');
  assert.ok(R.headline.startsWith('FAIL.'));
  const t1 = R.tests.find((x) => x.key === 'pool');
  assert.equal(t1.pass, false);
  assert.equal(t1.d.n, 11994); assert.equal(t1.c.n, 14248);
  assert.ok(t1.c.mean < 0 && t1.d.mean < 0 && t1.c.gross > 0);
  assert.equal(R.tests.filter((x) => x.pass).length, 0);
  assert.equal(R.tests.length, 4);
});

test('the gate matches grid7 within the pre-registered tolerance, no walk mismatch', () => {
  const ref = Object.fromEntries(G7.perMarket['1h mkt large 1R'].map((x) => [x.market, x]));
  for (const g of R.gate) {
    assert.ok(g.ok && g.walkOk && g.mism === 0, g.market);
    assert.ok(Math.abs(g.c.n - ref[g.market].c.n) <= 0.01 * ref[g.market].c.n);
    assert.ok(Math.abs(g.c.mean - ref[g.market].c.mean) <= 0.005);
  }
});

test('measured markets have 24 hours each; the others are apart', () => {
  assert.deepEqual(MEASURED, ['xau', 'xag', 'usdjpy']);
  for (const m of MEASURED) { assert.equal(P.markets[m].hours.length, 24); assert.ok(P.markets[m].hours.every((h) => h.frac != null && h.n > 0)); }
  assert.equal(APART.length, 7);
  assert.deepEqual(R.unmeasured.map((x) => x.market), APART);
});

test('cost formula: half spread in and out, commission, extra half spread on a stop', () => {
  const hours = Array.from({ length: 24 }, (_, h) => ({ hour: h, frac: h === 5 ? 0.0002 : 0.0001, frac90: 0.0003 }));
  const x = { inH: 3, outH: 5, kind: 1 };
  assert.ok(Math.abs(costFrac(hours, x, 0.00004) - (0.00005 + 0.0001 + 0.00004)) < 1e-12);
  assert.ok(Math.abs(costFrac(hours, { ...x, kind: 0 }, 0.00004) - (0.00005 + 0.0001 + 0.00004 + 0.0001)) < 1e-12);
});

test('the 1R walk equals manage slot 0 on random paths (stop, target, gap, time)', () => {
  let seed = 7; const rnd = () => { seed = (seed * 1103515245 + 12345) % 2147483648; return seed / 2147483648; };
  let checked = 0;
  for (let k = 0; k < 300; k++) {
    const M5 = []; let p = 100; const t0 = 1.7e9;
    for (let i = 0; i < 700; i++) { const gap = rnd() < 0.02 ? (rnd() - 0.5) * 2 : 0; const o = p + gap; const c = o + (rnd() - 0.5) * 0.6;
      M5.push({ t: t0 + i * 300, e: t0 + (i + 1) * 300, o, h: Math.max(o, c) + rnd() * 0.2, l: Math.min(o, c) - rnd() * 0.2, c }); p = c; }
    const s = rnd() < 0.5 ? 1 : -1, fi = 3, fill = M5[fi].o, stop = fill - s * (0.3 + rnd() * 2);
    const cap = 2 * 86400 * (rnd() < 0.3 ? 0.01 : 1);
    const m = manage(M5, s, fi, fill, stop, cap, true), w = exitWalk(M5, s, fi, fill, stop, cap);
    if (!m) { continue; }
    assert.ok(w && Math.abs(w.R - m.R[0]) < 1e-9, `path ${k}`); checked++;
  }
  assert.ok(checked > 200);
});
