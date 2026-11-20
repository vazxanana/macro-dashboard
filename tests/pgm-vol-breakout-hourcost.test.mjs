import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { NAMES, pickProbe } from '../research/edge/pgm-vol-breakout-hourcost/run.mjs';

const R = JSON.parse(fs.readFileSync(new URL('../research/edge/pgm-vol-breakout-hourcost/result.json', import.meta.url)));
test('broker names and probe pick', () => {
  assert.deepEqual(NAMES, { xpt: ['XPTUSD'], xpd: ['XPDUSD'] });
  assert.equal(pickProbe('xpt', {}), null);
  assert.equal(pickProbe('xpt', { XPTUSD: { hourProfile: [{ frac: 0.004 }] } }).name, 'XPTUSD');
});
test('the harness gate reproduced pgm-vol-breakout and the verdict follows the pool', () => {
  for (const g of Object.values(R.gate)) { assert.equal(g.n, g.want.n); assert.equal(g.netR, g.want.netR); }
  assert.equal(R.verdict.startsWith('PASS'), R.series.pool.pass);
  assert.ok(fs.readFileSync(new URL('../research/edge/pgm-vol-breakout-hourcost/RESULT.md', import.meta.url), 'utf8').includes(R.verdict));
});
