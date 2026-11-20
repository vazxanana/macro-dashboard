import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { slowRise } from '../research/edge/oil-hawkish/run.mjs';

const R = JSON.parse(fs.readFileSync(new URL('../research/edge/oil-hawkish/result.json', import.meta.url)));
test('slow rise needs +15 % over 63 sessions and a rise in each 21-session block', () => {
  const steady = Array.from({ length: 64 }, (_, i) => ({ t: i, v: 100 * (1 + 0.2 * i / 63) }));
  assert.equal(slowRise(steady, 63), true);
  const spike = Array.from({ length: 64 }, (_, i) => ({ t: i, v: i < 42 ? 100 - i * 0.1 : 130 }));
  assert.equal(slowRise(spike, 63), false);
  assert.equal(slowRise(steady, 10), false);
});
test('verdict follows the tests', () => {
  assert.ok(R.verdict.includes(`USD/JPY higher ${R.tests.D.pass ? 'PASS' : 'FAIL'}`) && R.verdict.includes(`gold lower ${R.tests.G.pass ? 'PASS' : 'FAIL'}`));
  assert.ok(fs.readFileSync(new URL('../research/edge/oil-hawkish/RESULT.md', import.meta.url), 'utf8').includes(R.verdict));
});
