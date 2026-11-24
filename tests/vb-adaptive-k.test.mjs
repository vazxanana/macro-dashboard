// vb-adaptive-k: the mapping, no look-ahead in the ratio, and the committed figures (offline).
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { kOf, ratios } from '../research/edge/vb-adaptive-k/run.mjs';

const R = JSON.parse(fs.readFileSync(new URL('../research/edge/vb-adaptive-k/result.json', import.meta.url), 'utf8'));

test('vb-adaptive-k: the pre-registered mapping', () => {
  assert.equal(kOf(0.5), 0.3); assert.equal(kOf(0.7), 0.5); assert.equal(kOf(1), 0.5); assert.equal(kOf(1.3), 0.5); assert.equal(kOf(1.31), 0.7);
});

test('vb-adaptive-k: a day\'s ratio reads only its own and earlier ranges', () => {
  const days = Array.from({ length: 40 }, (_, i) => ({ day: `d${i}`, prevRange: 1 + (i % 7) * 0.3 }));
  const a = ratios(days);
  assert.equal(a[18], null); assert.ok(a[19] > 0);
  const b = ratios(days.map((d, i) => (i > 25 ? { ...d, prevRange: 99 } : d)));
  for (let i = 0; i <= 25; i++) assert.equal(a[i], b[i]);
});

test('vb-adaptive-k: committed result', () => {
  assert.ok(R.gate.usdjpy.exact && R.gate.xau.exact);
  assert.match(R.verdict, /^FAIL: 0 of 3/);
  const [g, j, p] = R.tests;
  assert.equal(p.conf.meanDay, 0.015); assert.equal(p.conf.monthT, 1.52); assert.equal(p.pHolm, 0.132);
  assert.equal(g.conf.monthT, 0.38); assert.equal(j.conf.monthT, 1.86);
  assert.ok(R.tests.every((x) => !x.pass && x.checks.posBoth));
  assert.equal(R.buckets.xau.disc.narrow.n, 371);
});
