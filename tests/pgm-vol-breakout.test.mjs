import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { charge, MARKETS, COSTS, judge } from '../research/edge/pgm-vol-breakout/run.mjs';

const R = JSON.parse(fs.readFileSync(new URL('../research/edge/pgm-vol-breakout/result.json', import.meta.url)));
test('markets and costs are the pre-registered ones', () => {
  assert.deepEqual(MARKETS, ['xpt', 'xpd']); assert.deepEqual(COSTS, { xpt: 0.003, xpd: 0.002 });
  const x = charge('xpt', { R: 1, entry: 1000, r: 10 }); assert.ok(Math.abs(x.net - 0.7) < 1e-9 && Math.abs(x.net2 - 0.4) < 1e-9);
});
test('verdict follows the pooled checks', () => {
  assert.equal(R.verdict.startsWith('PASS'), R.series.pool.pass);
  assert.equal(R.series.pool.pass, Object.values(R.series.pool.checks).every(Boolean));
  assert.ok(fs.readFileSync(new URL('../research/edge/pgm-vol-breakout/RESULT.md', import.meta.url), 'utf8').includes(R.verdict));
  assert.equal(typeof judge, 'function');
});
