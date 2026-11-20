import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { around, usdjpyEvents, COST } from '../research/edge/usdjpy-red-folder/run.mjs';

const R = JSON.parse(fs.readFileSync(new URL('../research/edge/usdjpy-red-folder/result.json', import.meta.url)));

test('around reads T-5 close, T+5 close and T+60 close', () => {
  const t = 1e9 - (1e9 % 300), c = new Map([[t - 300, [t - 300, 0, 0, 0, 100]], [t, [t, 0, 0, 0, 101]], [t + 3300, [t + 3300, 0, 0, 0, 99.99]]]);
  const r = around(c, t); assert.ok(Math.abs(r.j5 - 1) < 1e-9); assert.ok(Math.abs(r.j60 + 0.01) < 1e-9);
  assert.equal(around(new Map(), t), null);
});
test('hot = dollar up = USD/JPY up (the gold study direction flipped)', () => {
  const t = 1e9 - (1e9 % 300), c = new Map([[t - 300, [0, 0, 0, 0, 100]], [t, [0, 0, 0, 0, 100.1]], [t + 3300, [0, 0, 0, 0, 100.3]]]);
  const { E } = usdjpyEvents([{ type: 'CPI', d: '2023-01-12', t, cons: 0.3, act: 0.4, surprise: 0.1, dir: -1, oos: true }], c);
  assert.equal(E[0].dir, 1); assert.ok(E[0].R > 0 && Math.abs(E[0].R - (E[0].g5to60 - COST)) < 1e-4);
});
test('verdict follows the pre-registered bar', () => {
  const pass = R.T2.inSample.mean > 0 && R.T2.outOfSample.mean > 0 && R.T2.outOfSample.t >= 2;
  assert.equal(R.verdict.startsWith('PASS'), pass);
  assert.ok(fs.readFileSync(new URL('../research/edge/usdjpy-red-folder/RESULT.md', import.meta.url), 'utf8').includes(R.verdict));
});
