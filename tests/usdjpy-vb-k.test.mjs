import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { reading, KS } from '../research/edge/usdjpy-vb-k/run.mjs';

const R = JSON.parse(fs.readFileSync(new URL('../research/edge/usdjpy-vb-k/result.json', import.meta.url)));
test('the gate reproduced both published k 0.5 studies', () => {
  const g = R.rows.find((r) => r.k === 0.5);
  assert.equal(R.gate, true); assert.equal(g.early.n, 2089); assert.equal(g.late.n, 2079); assert.equal(g.early.net, 0.079); assert.equal(g.late.net, 0.063);
});
test('reading follows the pre-registered rule', () => {
  const x = reading(R.rows); assert.equal(R.verdict.startsWith(x.broad ? 'BROAD' : 'NARROW'), true);
  assert.deepEqual(R.rows.map((r) => r.k), KS);
  assert.equal(reading([{ k: 0.3, all: { net: -0.1, monthT: 3 } }, { k: 0.4, all: { net: 0.1, monthT: 3 } }, { k: 0.6, all: { net: 0.1, monthT: 3 } }, { k: 0.7, all: { net: 0.1, monthT: 3 } }]).broad, false);
  assert.ok(fs.readFileSync(new URL('../research/edge/usdjpy-vb-k/RESULT.md', import.meta.url), 'utf8').includes(R.verdict));
});
