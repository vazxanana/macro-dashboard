// tests/bigfade-hourcost.test.mjs - the big-candle fade at measured hourly spreads: result figures, cost rule, gate.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { costFrac, charged, MEASURED, APART, COMM } from '../research/edge/bigfade-hourcost/run.mjs';

const R = JSON.parse(fs.readFileSync(new URL('../research/edge/bigfade-hourcost/result.json', import.meta.url), 'utf8'));
const MD = fs.readFileSync(new URL('../research/edge/bigfade-hourcost/RESULT.md', import.meta.url), 'utf8');

test('verdict, gate and the four tests as reported', () => {
  assert.equal(R.verdict, 'FAIL');
  assert.ok(MD.startsWith('# ') && MD.includes('**Verdict: FAIL. 0 of 4 tests pass'));
  assert.ok(R.gate.ok);
  assert.deepEqual([R.gate.d.n, R.gate.c.n], [47354, 54443]);
  assert.deepEqual(R.tests.map((x) => x.key), ['xau', 'xag', 'usdjpy', 'pool']);
  assert.ok(R.tests.every((x) => !x.pass));
  const pool = R.tests.find((x) => x.key === 'pool');
  assert.equal(pool.c.n, 11634);
  assert.ok(pool.c.gross > 0 && pool.c.mean < 0 && pool.c.t < -2);
  const gold = R.tests.find((x) => x.key === 'xau');
  assert.equal(gold.c.n, 4593);
  assert.ok(gold.d.mean > 0 && gold.c.mean < 0 && gold.twoX < 0);
  assert.equal(R.missingHours.length, 0);
});

test('only gold, silver and USD/JPY are judged; the others apart', () => {
  assert.deepEqual(MEASURED, ['xau', 'xag', 'usdjpy']);
  assert.equal(APART.length, 7);
  assert.deepEqual(R.apart.map((a) => a.market).sort(), [...APART].sort());
});

test('cost rule: half spread in and out, commission, half more on a stop exit; mirror and 2x', () => {
  const hours = Array.from({ length: 24 }, (_, h) => ({ hour: h, frac: h === 1 ? 0.0002 : 0.0001, frac90: 0.0003 }));
  assert.ok(Math.abs(costFrac(hours, 0, 1, 1, 0.00002) - (0.00005 + 0.0001 + 0.00002)) < 1e-12);
  assert.ok(Math.abs(costFrac(hours, 0, 1, 0, 0.00002) - (0.00005 + 0.0001 + 0.00002 + 0.0001)) < 1e-12);
  // row: [fillT, R, mirrorR, fill, risk, exitAt, kind, mirrorExitAt, mirrorKind]; 1970-01-01 00:00 -> hour 0, 3600 -> hour 1
  const row = [0, 1, -1, 100, 1, 3600, 1, 0, 0];
  const [a] = charged([row], hours, 0.00002), [b] = charged([row], hours, 0.00002, { mult: 2 }), [m] = charged([row], hours, 0.00002, { mirror: true });
  assert.ok(Math.abs(a.net - (1 - 0.017)) < 1e-9);
  assert.ok(Math.abs(b.net - (1 - 0.034)) < 1e-9);
  assert.ok(Math.abs(m.net - (-1 - 100 * (0.00005 + 0.00005 + 0.00002 + 0.00005))) < 1e-9);
  assert.equal(COMM.usdjpy, 0.000045);
});
