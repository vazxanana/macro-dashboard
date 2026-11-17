// research/edge/replica-sides: the three pre-registered tests recomputed from the committed months.json must equal result.json,
// and the report must say what the result says. Offline: no candles are read.
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');
const DIR = path.join(ROOT, 'research/edge/replica-sides');
const S = await import('../research/edge/replica-sides/run.mjs');
const result = JSON.parse(fs.readFileSync(path.join(DIR, 'result.json'), 'utf8'));
const months = JSON.parse(fs.readFileSync(path.join(DIR, 'months.json'), 'utf8'));

test('replica-sides: the pre-registration names three tests, both windows and the Holm bar', () => {
  const pre = fs.readFileSync(path.join(DIR, 'PREREGISTRATION.md'), 'utf8');
  for (const s of ['T1 sells', 'T2 sells minus buys', 'T3 with the market', 'Holm over the **3 tests**', '2024-01-01 to 2026-10-31', 'OOS t ≥ 2']) assert.ok(pre.includes(s), s);
  assert.equal(S.RULE.nTests, 3); assert.equal(S.RULE.minT, 2); assert.equal(S.OOS_MONTHS.length, 34); assert.equal(S.IS_MONTHS.length, 48);
});

test('replica-sides: the tests recomputed from months.json equal result.json', () => {
  const ev = S.evaluate(months.cells);
  assert.deepEqual(ev, result.tests);
  for (const id of ['T1', 'T2', 'T3']) assert.equal(result.tests[id].pass, false, id);
  assert.match(result.verdict, /^FAIL, 0 of 3/);
});

test('replica-sides: the figures the report quotes', () => {
  const T = result.tests;
  assert.equal(T.T1.OOS.n, 44458); assert.equal(T.T1.OOS.net, -0.196); assert.equal(T.T1.OOS.t, -12.63);
  assert.equal(T.T2.OOS.mean, 0.007); assert.equal(T.T2.OOS.t, 0.38); assert.equal(T.T2.IS.t, 1.77);
  assert.equal(T.T3.OOS.net, -0.194);
  assert.equal(result.pool.all.IS.n + result.pool.all.OOS.n, 174316);
  const md = fs.readFileSync(path.join(DIR, 'RESULT.md'), 'utf8');
  for (const s of ['FAIL, 0 of 3', '−0.196R a trade (n 44,458, month t −12.63)', '+0.007R (34 months, t 0.38)', '174,316']) assert.ok(md.includes(s), s);
  // every market loses after costs out of sample, and none has a gross edge beyond 0.05R
  for (const [m, x] of Object.entries(result.markets)) { assert.ok(x.all.OOS.net < 0, m); assert.ok(Math.abs(x.all.OOS.gross) < 0.05, m); }
});

test('replica-sides: the coin cost model scales with the entry price', () => {
  const a = S.mmAt('sol', 72.58), b = S.mmAt('sol', 145.16);
  assert.equal(a.spread, 0.196); assert.ok(Math.abs(b.spread - 0.392) < 1e-12);
  assert.equal(S.mmAt('xau', 2000).spread, 0.06);
});
