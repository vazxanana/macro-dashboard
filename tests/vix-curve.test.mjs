import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { signals, rows } from '../research/edge/vix-curve/run.mjs';

const R = JSON.parse(fs.readFileSync(new URL('../research/edge/vix-curve/result.json', import.meta.url)));
test('signals: Friday readings, inverted when VIX > VIX3M', () => {
  const f = '2008-01-04', t = Date.parse(f + 'T00:00:00Z') / 1000;
  const s = signals([{ d: f, t, v: 30 }, { d: '2008-01-07', t: t + 3 * 86400, v: 30 }], [{ d: f, t, v: 25 }]);
  assert.equal(s.length, 1); assert.equal(s[0].inv, true);
});
test('rows start the outcome at the next weekday close (no look-ahead)', () => {
  const t = Date.parse('2008-01-04T00:00:00Z') / 1000, px = [];
  for (let i = 0; i < 40; i++) px.push({ t: t + i * 86400, v: 100 + i });
  const r = rows([{ day: '2008-01-04', t, inv: true }], px);
  assert.ok(Math.abs(r[0].fwd - Math.log(px[23].v / px[3].v)) < 1e-5);   // Monday = index 3
});
test('verdict follows the tests', () => {
  assert.ok(R.verdict.includes(`USD/JPY lower ${R.tests.J.pass ? 'PASS' : 'FAIL'}`) && R.verdict.includes(`gold higher ${R.tests.G.pass ? 'PASS' : 'FAIL'}`));
  assert.ok(fs.readFileSync(new URL('../research/edge/vix-curve/RESULT.md', import.meta.url), 'utf8').includes(R.verdict));
});
