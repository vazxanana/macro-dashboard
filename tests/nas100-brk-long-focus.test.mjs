import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
const dir = new URL('../research/edge/nas100-brk-long-focus/', import.meta.url);
const J = JSON.parse(fs.readFileSync(new URL('result.json', dir), 'utf8')), R = fs.readFileSync(new URL('RESULT.md', dir), 'utf8');
test('the gate reproduced the lead on the full file', () => {
  assert.equal(J.gate.pass, true); assert.equal(J.engine.A.n, 1018); assert.equal(J.engine.B.n, 473); assert.ok(Math.abs(J.engine.C.mean - 0.4843) < 0.02);
  assert.ok(J.parity.every((p) => p.ok)); assert.ok(J.bars > 120000);
});
test('the verdict is the five tests and RESULT.md says the same', () => {
  assert.deepEqual(Object.keys(J.pass), ['T1', 'T2', 'T3', 'T4', 'T5']);
  assert.equal(Object.values(J.pass).every(Boolean), /^PASS/.test(J.verdict)); assert.match(R, /Verdict: PASS/);
  assert.equal(J.checks.T3.cells.length, 16); assert.ok(J.checks.T2.draws > 1900);
  assert.ok(R.includes(J.checks.T4.pooled.n.toLocaleString('en-US')) && R.includes('not an edge'));
});
test('the rule keeps a stop on every trade and costs are charged', () => {
  const src = fs.readFileSync(new URL('run.mjs', dir), 'utf8'); assert.match(src, /stop = entry - dist/); assert.ok(J.checks.T1.costs['6e-5'].C.mean < J.checks.T1.costs['2.7e-5'].C.mean);
});
