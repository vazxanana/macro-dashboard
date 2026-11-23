// tests/mosha-market-holdout.test.mjs - the grid-6 cell holdout study: RESULT.md agrees with result.json; offline.
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

const DIR = new URL('../research/edge/mosha-market-holdout/', import.meta.url);
const R = JSON.parse(fs.readFileSync(new URL('result.json', DIR), 'utf8'));
const md = fs.readFileSync(new URL('RESULT.md', DIR), 'utf8');
const f3 = (x) => (x >= 0 ? '+' : '-') + Math.abs(x).toFixed(3);

test('pre-registration exists and names the gate, the sets and the bar', () => {
  const p = fs.readFileSync(new URL('PREREGISTRATION.md', DIR), 'utf8');
  for (const w of ['Set A', 'Set B', 'Set C', 'Gate', 'ASSUMED', 'Holm', 'month-sum t', 'placebo']) assert.ok(p.includes(w), w);
});

test('verdict line on line 3 matches result.json', () => {
  const line = md.split('\n')[2];
  assert.ok(line.startsWith(`**Verdict: ${R.verdict}.`), line);
  for (const s of ['A', 'B', 'C']) { const x = R.sets[s].real.r1;
    assert.ok(line.includes(`${f3(x.mean)}R`) && line.includes(`n ${x.n}`) && line.includes(x.t.toFixed(2)), s); }
  assert.ok(R.headline.startsWith(R.verdict));
});

test('the gate reproduced the grid and the cut test found nothing', () => {
  assert.equal(R.gate.ok, true);
  assert.deepEqual([R.gate.n1014, R.gate.mean1014, R.gate.t1014, R.gate.n1519, R.gate.mean1519, R.gate.t1519], [302, 0.1141, 2.16, 290, 0.2249, 4.25]);
  for (const s of ['A', 'B', 'C']) { const c = R.sets[s].cut; assert.ok(c.length >= 4); assert.equal(c.reduce((a, x) => a + x.missing + x.extra, 0), 0); }
});

test('the verdict follows the pre-registered bar', () => {
  const ok = (x) => x.n >= 50 && x.mean > 0 && x.t >= 2;
  const a = ok(R.sets.A.real.r1) && R.holm.A < 0.05, b = ok(R.sets.B.real.r1) && R.holm.B < 0.05;
  const few = R.sets.A.real.r1.n < 50 || R.sets.B.real.r1.n < 50;
  assert.equal(R.verdict, a && b ? 'PASS' : few || a || b ? 'INCONCLUSIVE' : 'FAIL');
  assert.equal(R.sets.B.assumedCosts, true);
});

test('RESULT.md table figures come from result.json', () => {
  for (const s of ['A', 'B', 'C']) { const x = R.sets[s].real;
    assert.ok(md.includes(`${f3(x.r1.mean)} (${x.r1.t.toFixed(2)})`), s + ' r1');
    assert.ok(md.includes(`${f3(x.trail.mean)} (${x.trail.t.toFixed(2)})`), s + ' trail');
    assert.ok(md.includes(f3(x.r1Net.mean)), s + ' net');
    assert.ok(md.includes(`${f3(x.placebo1R.mean)} (${x.placebo1R.t.toFixed(2)})`), s + ' placebo'); }
  for (const [m, v] of Object.entries(R.sets.B.perMarket)) assert.ok(md.includes(`| ${m} | ${v.r1.n} | ${f3(v.r1.mean)} (${v.r1.t.toFixed(2)})`), m);
  assert.ok(md.includes(`adjusted one-sided p ${R.holm.A.toFixed(2)} (A) and ${R.holm.B.toFixed(2)} (B)`));
});
