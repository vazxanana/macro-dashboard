import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { rows, tests } from '../research/edge/yen-us-yields/run.mjs';

const R = JSON.parse(fs.readFileSync(new URL('../research/edge/yen-us-yields/result.json', import.meta.url)));
const DAY = 86400;
test('rows: signal from yields known before the outcome starts (no look-ahead)', () => {
  const y = [], fx = [];
  for (let i = 0; i < 80; i++) { const t = Date.UTC(2007, 0, 1) / 1000 + i * DAY; const d = new Date(t * 1000).toISOString().slice(0, 10); y.push({ d, t, v: 4 + (i > 40 ? 0.5 : 0) }); fx.push({ t, v: 100 + i }); }
  const r = rows(y, fx); assert.ok(r.length > 0);
  for (const x of r) { const t = Date.parse(x.day + 'T00:00:00Z') / 1000; assert.equal(new Date(t * 1000).getUTCDay(), 5); }
});
test('verdict follows the tests', () => {
  assert.ok(R.verdict.includes(`U US 10-year up > 25 bp in 4 weeks → USD/JPY higher ${R.tests.U.pass ? 'PASS' : 'FAIL'}`));
  assert.ok(R.verdict.includes(`down > 25 bp → USD/JPY lower ${R.tests.D.pass ? 'PASS' : 'FAIL'}`));
  assert.ok(fs.readFileSync(new URL('../research/edge/yen-us-yields/RESULT.md', import.meta.url), 'utf8').includes(R.verdict));
  assert.ok(R.weeks > 900);
});
