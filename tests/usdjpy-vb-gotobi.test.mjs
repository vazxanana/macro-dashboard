// usdjpy-vb-gotobi: result.json figures, the verdict, and the pure pieces (offline, no candles needed).
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { welch, compare, verdictOf, W } from '../research/edge/usdjpy-vb-gotobi/run.mjs';
import { isGotobi } from '../council/gotobi-calendar.mjs';

const R = JSON.parse(fs.readFileSync(new URL('../research/edge/usdjpy-vb-gotobi/result.json', import.meta.url)));

test('result: no difference, verdict matches the figures', () => {
  assert.equal(R.decision.G1.pass, false); assert.equal(R.decision.G2.pass, false);
  assert.equal(verdictOf(R), R.verdict);
  assert.match(R.verdict, /^NO DIFFERENCE, 0 of 2/);
  const C = R.tests.CONF.G1;
  assert.ok(C.gotobi.n >= 200 && Math.abs(C.welchT) < 2);
  assert.equal(R.tests.DISC.G1.gotobi.n + R.tests.DISC.G1.other.n + C.gotobi.n + C.other.n, R.data.trades);
  const md = fs.readFileSync(new URL('../research/edge/usdjpy-vb-gotobi/RESULT.md', import.meta.url), 'utf8');
  assert.ok(md.includes(R.verdict)); assert.ok(!md.includes('(to be written)'));
});

test('windows and calendar', () => {
  assert.deepEqual(W.DISC, ['2005-01-01', '2014-12-31']);
  assert.equal(isGotobi('2026-11-25'), true); assert.equal(isGotobi('2026-11-24'), false);
});

test('welch and compare on hand-made trades', () => {
  const w = welch([1, 2, 3], [0, 0, 1, 1]); assert.ok(Math.abs(w.diff - 1.5) < 1e-12 && w.t > 0 && w.p > 0 && w.p < 1);
  const tr = [];
  for (let d = 1; d <= 28; d++) { const day = `2020-02-${String(d).padStart(2, '0')}`; tr.push({ day, net: d % 5 === 0 ? 1 : -0.1, R: 0 }); }
  const c = compare(tr, (day) => +day.slice(8) % 5 === 0, 1);
  assert.equal(c.gotobi.n, 5); assert.equal(c.other.n, 23);
  assert.ok(c.diff > 1 && c.placeboShare < 0.05);
});
