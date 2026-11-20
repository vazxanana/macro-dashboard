import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { rows, tests } from '../research/edge/audjpy-leads/run.mjs';

const R = JSON.parse(fs.readFileSync(new URL('../research/edge/audjpy-leads/result.json', import.meta.url)));
test('rows classify divergence on the same 4 weeks and measure the next 20 sessions', () => {
  const a = [], x = [];
  for (let i = 0; i < 60; i++) { const t = Date.UTC(2007, 0, 1) / 1000 + i * 86400; a.push({ t, v: 80 + i * 0.1 }); x.push({ t, v: 1500 - i }); }
  const r = rows(a, x); assert.ok(r.length > 0 && r.every((z) => z.cls === 'divUp' && z.fwd < 0));
});
test('verdict counts the passes; all four were run', () => {
  const p = Object.values(R.tests).filter((o) => o.pass).length;
  assert.equal(Object.keys(R.tests).length, 4); assert.ok(R.verdict.startsWith(`${p ? 'PASS' : 'FAIL'}, ${p} of 4`));
  assert.ok(fs.readFileSync(new URL('../research/edge/audjpy-leads/RESULT.md', import.meta.url), 'utf8').includes(R.verdict));
});
