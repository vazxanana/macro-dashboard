// vb-vol-regime: the result file's figures, and no look-ahead in the volatility label.
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { labels, N_RV, N_RANK } from '../research/edge/vb-vol-regime/run.mjs';

const R = JSON.parse(fs.readFileSync(new URL('../research/edge/vb-vol-regime/result.json', import.meta.url), 'utf8'));

test('vb-vol-regime: gate reproduced and verdict FAIL 0 of 2', () => {
  assert.equal(R.gate.usdjpy.got.n, 2089); assert.equal(R.gate.usdjpy.got.net, 0.079);
  assert.equal(R.gate.xau.got.n, 3713); assert.equal(R.gate.xau.got.net, 0.139);
  assert.match(R.verdict, /^FAIL: 0 of 2/);
  assert.equal(R.tests.filter((x) => x.pass).length, 0);
  const [g, j] = R.tests;
  assert.equal(g.disc.diff, 0.027); assert.equal(g.conf.diff, -0.056); assert.equal(g.conf.monthT, -3.42); assert.equal(g.checks.placebo, false);
  assert.equal(j.disc.diff, 0.103); assert.equal(j.conf.diff, -0.095); assert.equal(j.pHolm, 0.221);
  assert.equal(R.terciles.xau.conf.low.n, 804); assert.equal(R.terciles.usdjpy.conf.mid.net, -0.057);
});

test('vb-vol-regime: a label reads only closes before its day', () => {
  let s = 7; const r = () => ((s = (s * 16807) % 2147483647) / 2147483647);
  const closes = []; let px = 100;
  for (let i = 0; i < 600; i++) { px *= Math.exp((r() - 0.5) * 0.02 * (1 + (i % 90 > 45))); closes.push({ time: i * 86400, close: px }); }
  const full = labels(closes);
  for (const cut of [N_RV + N_RANK + 1, 400, 550]) {
    const altered = closes.map((c, i) => (i >= cut ? { ...c, close: c.close * (1 + 0.3 * r()) } : c));
    const a = labels(altered);
    for (let i = 0; i <= cut; i++) assert.deepEqual(a.get(closes[i].time), full.get(closes[i].time), `day ${i}`);
  }
  assert.equal(full.has(closes[N_RANK - 1].time), false);
});
