// energy-vol-breakout-hourcost: the energy T1 trades at the demo's measured hourly spreads. Offline.
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { NAMES, pickProbe } from '../research/edge/energy-vol-breakout-hourcost/run.mjs';

const DIR = new URL('../research/edge/energy-vol-breakout-hourcost/', import.meta.url);

test('energy hourcost: broker names in the pre-registered order; the first listed one is used', () => {
  assert.deepEqual(NAMES, { wtico: ['XTIUSD', 'USOIL', 'WTI'], bco: ['XBRUSD', 'UKOIL', 'BRENT'], natgas: ['XNGUSD', 'NGAS'] });
  const hp = [{ frac: 1 }];
  assert.equal(pickProbe('wtico', { USOIL: { hourProfile: hp }, XTIUSD: { error: 'not listed by the broker' } }).name, 'USOIL');
  assert.equal(pickProbe('wtico', { XTIUSD: { hourProfile: hp }, USOIL: { hourProfile: hp } }).name, 'XTIUSD');
  assert.equal(pickProbe('natgas', {}), null);
});

test('energy hourcost: the harness gate held and the report matches result.json', () => {
  const R = JSON.parse(fs.readFileSync(new URL('result.json', DIR), 'utf8')), md = fs.readFileSync(new URL('RESULT.md', DIR), 'utf8');
  for (const g of Object.values(R.gate)) { assert.equal(g.n, g.want.n); assert.equal(g.netR, g.want.netR); }
  assert.ok(md.includes(`**Verdict: ${R.verdict}**`));
  if (R.series.pool) assert.equal(R.verdict.startsWith('PASS'), R.series.pool.pass);
  const pre = fs.readFileSync(new URL('PREREGISTRATION.md', DIR), 'utf8'); assert.match(pre, /route C1/); assert.match(pre, /pushed alone, before the probe runs/);
});
