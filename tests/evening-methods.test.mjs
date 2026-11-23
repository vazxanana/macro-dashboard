// tests/evening-methods.test.mjs - the owner's methods in the 20-23 UTC window: pre-registration, RESULT.md agrees with
// result.json, the verdict follows the bar, the gate and cut test, and the pure helpers (hour buckets, Holm, the six-figure
// judge) on hand-made data. Offline.
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { bucketOf, holm, judgeOne, READINGS, MIN_N } from '../research/edge/evening-methods/run.mjs';

const DIR = new URL('../research/edge/evening-methods/', import.meta.url);
const R = JSON.parse(fs.readFileSync(new URL('result.json', DIR), 'utf8'));
const md = fs.readFileSync(new URL('RESULT.md', DIR), 'utf8');
const pre = fs.readFileSync(new URL('PREREGISTRATION.md', DIR), 'utf8');
const f3 = (x) => (x >= 0 ? '+' : '-') + Math.abs(x).toFixed(3);

test('pre-registration fixes the readings, the hours, the bar and Holm', () => {
  for (const w of ['BEFORE any run', 'R1', 'R10', 'plain fade', '20, 21, 22, 23', '07 to 16', 'Welch t >= 2', 'month-sum t >= 2',
    'Holm over the 10 tests', 'WEAKEST', 'n >= 300', 'ASSUMED', 'Not an edge']) assert.ok(pre.includes(w), w);
});

test('line 3 is the verdict line and matches result.json', () => {
  const line = md.split('\n')[2];
  assert.ok(line.startsWith(`**Verdict: ${R.verdict}.`), line);
  assert.ok(line.includes(R.headline), 'headline');
  assert.ok(['PASS', 'FAIL', 'INCONCLUSIVE'].includes(R.verdict));
});

test('gate, cut test and the verdict follow the bar', () => {
  for (const g of R.gate) assert.ok(g.ok, g.what);
  assert.ok(R.cutsOk); assert.ok(R.cuts.length >= 10);
  assert.equal(R.tests.length, 10); assert.equal(R.meta.length, 10);
  for (const t of R.tests) { assert.equal(t.pass, t.nOk && t.meanOk && t.tsOk && t.holm < 0.05, t.k);
    assert.equal(t.tsOk, t.figs.every((f) => f.t != null && f.t >= 2), t.k + ' ts'); }
  const passN = R.tests.filter((t) => t.pass).length;
  assert.equal(R.verdict, passN ? 'PASS' : R.tests.some((t) => t.nOk) ? 'FAIL' : 'INCONCLUSIVE');
  assert.equal(R.perMarket.length, passN);
});

test('RESULT.md carries every test and every cell from result.json', () => {
  const lines = md.split('\n');
  for (const t of R.tests) { const l = lines.find((x) => x.startsWith(`| ${t.k} | ${t.name} |`)); assert.ok(l, t.k);
    const e = R.rows.find((x) => x.k === t.k).buckets[0]; assert.ok(l.includes(f3(e.A.mean)) && l.includes(f3(e.B.mean)), t.k + ' means');
    assert.ok(l.includes(t.pass ? '| yes |' : '| no |'), t.k + ' pass'); }
  for (const x of R.rows) for (const b of [...x.buckets, { bucket: 'all', ...x.all }]) {
    const l = lines.find((y) => y.startsWith(`| ${x.k} ${x.name} | ${b.bucket} |`)); assert.ok(l, x.k + ' ' + b.bucket);
    if (b.B.n) assert.ok(l.includes(f3(b.B.mean)) && l.includes(f3(b.B.meanNet)), x.k + ' ' + b.bucket + ' B'); }
  assert.equal(R.rows.length, READINGS.length);
});

test('hour buckets, Holm and the judge on hand-made figures', () => {
  assert.deepEqual([20, 21, 22, 23].map(bucketOf), [0, 0, 0, 0]);
  assert.deepEqual([7, 12, 16].map(bucketOf), [1, 1, 1]);
  assert.deepEqual([0, 6, 17, 19].map(bucketOf), [2, 2, 2, 2]);
  assert.deepEqual(holm([0.01, 0.04, 0.03]).map((p) => +p.toFixed(4)), [0.03, 0.06, 0.06]);
  const S = (n, mean, sd, t, months = 120) => ({ n, sum: n * mean, sq: (n - 1) * sd * sd + n * mean * mean, mean, t, months });
  const good = judgeOne({ A: S(1000, 0.3, 1, 3), B: S(1000, 0.3, 1, 3) }, { A: S(1000, 0, 1, 0), B: S(1000, 0, 1, 0) }, { A: S(1000, 0.05, 1, 2), B: S(1000, 0.05, 1, 2) });
  assert.ok(good.tsOk && good.nOk && good.meanOk); assert.ok(good.p < 0.01);
  const weak = judgeOne({ A: S(200, 0.3, 1, 3), B: S(1000, 0.01, 1, -1) }, { A: S(1000, 0, 1, 0), B: S(1000, 0, 1, 0) }, { A: S(1000, 0, 1, 0), B: S(1000, 0, 1, 0) });
  assert.ok(!weak.nOk && !weak.tsOk); assert.equal(weak.weakest, 'evening cell, B (month sums)'); assert.ok(MIN_N === 300);
});
