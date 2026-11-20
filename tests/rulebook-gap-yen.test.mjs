import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { yen } from '../research/edge/rulebook-gap-yen/run.mjs';

const R = JSON.parse(fs.readFileSync(new URL('../research/edge/rulebook-gap-yen/result.json', import.meta.url)));
test('the yen series is 1 / USD/JPY', () => { assert.equal(yen([{ t: 1, v: 150 }])[0].v, 1 / 150); });
test('verdict follows the imported testB passes', () => {
  assert.ok(R.verdict.includes(`B1 hikes priced → USD/JPY up ${R.tests.B1.pass ? 'PASS' : 'FAIL'}`));
  assert.ok(R.verdict.includes(`B2 cuts priced → USD/JPY down ${R.tests.B2.pass ? 'PASS' : 'FAIL'}`));
  assert.ok(fs.readFileSync(new URL('../research/edge/rulebook-gap-yen/RESULT.md', import.meta.url), 'utf8').includes(R.verdict));
  assert.ok(R.weeks > 900);
});
