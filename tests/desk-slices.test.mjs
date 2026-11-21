// The desk-slices study (21 Nov 2026): the report says what result.json says, and the pre-registered pass of T3 is never
// presented as a result (its stream is chosen with knowledge of the future).
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

const dir = new URL('../research/edge/desk-slices/', import.meta.url);
const J = JSON.parse(fs.readFileSync(new URL('result.json', dir), 'utf8')), R = fs.readFileSync(new URL('RESULT.md', dir), 'utf8'), P = fs.readFileSync(new URL('PREREGISTRATION.md', dir), 'utf8');
const f3 = (v) => (v < 0 ? '-' : '+') + Math.abs(v).toFixed(3) + 'R';

test('desk slices: no test is a pass, and the verdict line says so', () => {
  assert.equal(J.verdict, 'FAIL (0 of 3: two fail, one invalid)'); assert.ok(R.includes('**Verdict: FAIL (0 of 3: two fail, one invalid).**'));
  assert.equal(J.tests.T1.verdict, 'FAIL'); assert.equal(J.tests.T2.verdict, 'FAIL'); assert.equal(J.tests.T3.verdict, 'INVALID');
  assert.ok(R.includes('None of the three slices is an edge') && R.includes('Not an edge.'), 'the report says in words that nothing is an edge');
});
test('desk slices: the report quotes the numbers of result.json', () => {
  for (const id of ['T1', 'T2', 'T3']) { const t = J.tests[id];
    assert.ok(R.includes(`n ${t.oos.net.n.toLocaleString('en-US')}, ${f3(t.oos.net.mean)} a trade, month t ${t.oos.net.tMonth.toFixed(2)}`), id + ' out of sample');
    assert.ok(R.includes(`n ${t.is.net.n.toLocaleString('en-US')}, ${f3(t.is.net.mean)}, t ${t.is.net.tMonth.toFixed(2)}`), id + ' in sample'); }
  const e = J.tests.T3.afterTheResult; assert.ok(R.includes(`n ${e.oos.net.n}, 28 % winners, ${f3(e.oos.net.mean)} a trade`)); assert.ok(R.includes(`month t ${e.oos.net.tMonth.toFixed(2)}`)); assert.ok(R.includes(`n ${e.is.net.n}, ${f3(e.is.net.mean)}, month t ${e.is.net.tMonth.toFixed(2)}`));
});
test('desk slices: both engulf slices lose after costs in both windows, and T3 keeps its pre-registered checks beside the reason it is invalid', () => {
  for (const id of ['T1', 'T2']) { const t = J.tests[id]; assert.ok(t.is.net.mean < 0 && t.oos.net.mean < 0); assert.ok(Math.abs(t.oos.gross.mean) < 0.05, 'nothing before costs'); assert.equal(t.checks.oosPositive, false); }
  const t = J.tests.T3; assert.equal(t.onPreRegisteredChecks, 'PASS'); assert.match(t.why, /known after the market entry/); assert.ok(t.afterTheResult.oos.net.tMonth < 2);
});
test('desk slices: the pre-registration fixed the windows, costs and bar the run used', () => {
  assert.ok(P.includes('2024-01-01') && P.includes('2026-08-22') && P.includes('2020-01-01')); assert.ok(/Holm/.test(P)); assert.deepEqual(J.windows, { inSample: '2020-01-01 to 2023-12-31', outOfSample: '2024-01-01 to 2026-08-22' });
  const run = fs.readFileSync(new URL('run.mjs', dir), 'utf8'); assert.ok(run.includes("from '../../../council/edge-desks.mjs'"), 'the desk\'s own code');
});
