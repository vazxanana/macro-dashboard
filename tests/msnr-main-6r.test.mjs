// tests/msnr-main-6r.test.mjs - offline: the report pins result.json, the re-simulation copy and the target switch.
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { sim, readAt, half, TARGETS } from '../research/edge/msnr-main-6r/run.mjs';
import { MSNR } from '../council/edge-desks.mjs';

const DIR = new URL('../research/edge/msnr-main-6r/', import.meta.url);
const R = JSON.parse(fs.readFileSync(new URL('result.json', DIR), 'utf8'));
const MD = fs.readFileSync(new URL('RESULT.md', DIR), 'utf8');

test('RESULT.md line 3 carries the verdict of result.json', () => {
  const l3 = MD.split('\n')[2];
  assert.match(l3, new RegExp(`^\\*\\*Verdict: ${R.verdict}\\.`));
  assert.ok(['PASS', 'FAIL', 'INCONCLUSIVE'].includes(R.verdict));
});

test('the figures quoted in RESULT.md are those of result.json', () => {
  const T = R.tests;
  for (const v of [T.T1.all.n, T.T1.a.tMonth, T.T1.b.tMonth, T.T2.a.tMonth, T.T2.b.tMonth, T.T3.a.tMonth, T.T3.b.tMonth]) assert.ok(MD.includes(String(v)), 'missing ' + v);
  assert.ok(MD.includes(Math.abs(T.T1.all.meanR).toFixed(3)));
});

test('the verdict follows the pre-registered rule', () => {
  const ok = (h) => h.n > 0 && h.meanR > 0 && h.tMonth >= 2;
  for (const k of ['T1', 'T2', 'T3']) assert.equal(R.tests[k].pass, ok(R.tests[k].a) && ok(R.tests[k].b) && R.tests[k].holm < 0.05);
  const pass = R.tests.T1.pass && R.tests.T2.pass && R.placeboOk;
  assert.equal(R.verdict, R.tests.T1.a.n < 100 || R.tests.T1.b.n < 100 ? 'INCONCLUSIVE' : pass ? 'PASS' : 'FAIL');
  for (const g of R.gate) assert.equal(g.bad, 0);
});

test('the re-simulation copy: stop first in one candle, gap at the open, time limit', () => {
  const c = { side: 1, entry: 100, stop: 99, r0: 1, t: 0 };
  const bar = (time, open, high, low, close) => ({ time, open, high, low, close });
  assert.deepEqual(sim([bar(0, 100, 100, 100, 100), bar(300, 100, 102, 98.9, 101)], 0, c, 1), { closed: 300, px: 99 });
  assert.deepEqual(sim([bar(0, 100, 100, 100, 100), bar(300, 98, 98, 97, 97)], 0, c, 1), { closed: 300, px: 98 });
  assert.deepEqual(sim([bar(0, 100, 100, 100, 100), bar(300, 100, 101.5, 99.5, 101)], 0, c, 1), { closed: 300, px: 101 });
  assert.deepEqual(sim([bar(0, 100, 100, 100, 100), bar(10, 100.2, 100.3, 99.5, 100), bar(20, 100.1, 100.4, 99.6, 100)], 0, c, 6, 15), { closed: 20, px: 100.1 });
});

test('readAt puts the desk targets back and month t counts empty months', () => {
  const keep = [MSNR.rrMain, MSNR.rrOther];
  assert.deepEqual(readAt({ '5m': [], '1h': [] }, 'xau', 2), []);
  assert.deepEqual([MSNR.rrMain, MSNR.rrOther], keep);
  assert.deepEqual(TARGETS, [1, 2, 3, 4, 5, 6]);
  const h = half([{ t: Date.UTC(2010, 0, 5) / 1000, R: 1 }, { t: Date.UTC(2010, 2, 5) / 1000, R: 1 }], 'R', Date.UTC(2010, 0, 1) / 1000, Date.UTC(2010, 3, 1) / 1000);
  assert.equal(h.n, 2); assert.equal(h.total, 2); assert.equal(h.tMonth, 2);
});
