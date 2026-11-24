// tests/fade-condition-stack.test.mjs - the stacked fade conditions at measured hourly spreads (research only, offline).
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { stackOf, judge, STACKS, N_MIN } from '../research/edge/fade-condition-stack/run.mjs';

const R = JSON.parse(fs.readFileSync(new URL('../research/edge/fade-condition-stack/result.json', import.meta.url), 'utf8'));
const MD = fs.readFileSync(new URL('../research/edge/fade-condition-stack/RESULT.md', import.meta.url), 'utf8');
const T = (s) => Date.parse(s) / 1000;

test('stack rules: evening signal, no rollover fill, low vol, Monday', () => {
  const x = { sigT: T('2024-05-06T20:15:00Z'), fillT: T('2024-05-06T20:30:00Z'), vol: 0, dow: 0 };
  assert.deepEqual(stackOf(x), { S0: true, S1: true, S2: true, S3: true, P1: false });
  assert.equal(stackOf({ ...x, fillT: T('2024-05-06T21:05:00Z') }).S1, false);   // rollover fill
  assert.equal(stackOf({ ...x, vol: 1 }).S2, false);
  assert.equal(stackOf({ ...x, dow: 1 }).S3, false);
  assert.equal(stackOf({ ...x, sigT: T('2024-05-06T19:45:00Z') }).S1, false);
  assert.equal(stackOf({ ...x, sigT: T('2024-05-06T09:00:00Z'), fillT: T('2024-05-06T09:15:00Z') }).P1, true);
  assert.deepEqual(STACKS, ['S0', 'S1', 'S2', 'S3', 'P1']);
});

test('result: gate, cut test, verdict line and the nine tests recomputed', () => {
  assert.ok(R.gate.every((g) => g.ok));
  for (const c of R.cuts) for (const x of c.cuts) assert.equal(x.diff, 0, `${c.market} ${x.cut}`);
  const tests = judge(R.summary);
  assert.equal(tests.length, 9);
  tests.forEach((x, i) => { assert.equal(x.pass, R.tests[i].pass); assert.ok(Math.abs(x.m2 - R.tests[i].m2) < 1e-9); });
  assert.equal(R.verdict, 'FAIL');
  assert.equal(tests.filter((x) => x.pass).length, 0);
  assert.ok(MD.startsWith('# ') && MD.includes('**Verdict: FAIL. 0 of 9'));
  // every S1 cell loses after measured costs in confirmation, and S2 is below S1 before costs on the break fade
  for (const r of ['fade', 'big', 'box']) assert.ok(R.summary.judged[`${r}|S1`].net.m2 < 0);
  assert.ok(R.summary.judged['fade|S2'].gross.m2 < R.summary.judged['fade|S1'].gross.m2);
  assert.ok(R.summary.judged['big|S3'].net.n2 < N_MIN);
});
