// Multiple testing across the studies of 13-14 Nov 2026: the statistics on hand-made sets, the inputs' shape, and that
// RESULT.md says what result.json holds. Offline.
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { holm, bh, by, fisher, chi2SfEven, Phi, pOneSided, poisson95, family, analyse, report } from '../research/edge/multiple-testing-1314nov/run.mjs';

const DIR = new URL('../research/edge/multiple-testing-1314nov/', import.meta.url);
const read = (f) => readFileSync(new URL(f, DIR), 'utf8');
const close = (a, b, eps = 1e-6) => assert.ok(Math.abs(a - b) < eps, `${a} vs ${b}`);

test('Holm and BH on a hand-made set', () => {
  const ps = [0.01, 0.04, 0.03, 0.005];
  // Holm: sorted 0.005 x4 = 0.02, 0.01 x3 = 0.03, 0.03 x2 = 0.06, 0.04 x1 = 0.04 -> monotone 0.06
  assert.deepEqual(holm(ps).map((v) => +v.toFixed(6)), [0.03, 0.06, 0.06, 0.02]);
  // BH: sorted 0.005*4/1 = 0.02, 0.01*4/2 = 0.02, 0.03*4/3 = 0.04, 0.04*4/4 = 0.04
  assert.deepEqual(bh(ps).map((v) => +v.toFixed(6)), [0.02, 0.04, 0.04, 0.02]);
  // BH step-up monotonicity: a larger p never gets a smaller q
  const q = bh([0.001, 0.2, 0.021, 0.022, 0.9]);
  close(q[2], q[3]);
  assert.ok(q[1] <= 1 && q[4] === 0.9 * 5 / 5);
  // BY = BH x (1 + 1/2 + 1/3 + 1/4), capped
  const c = 1 + 1 / 2 + 1 / 3 + 1 / 4;
  by(ps).forEach((v, i) => close(v, Math.min(1, bh(ps)[i] * c)));
  assert.deepEqual(holm([0.9, 0.95]), [1, 1]);
  assert.deepEqual(holm([0.02, 0.9]), [0.04, 0.9]);
});

test('normal p, Fisher and the Poisson range', () => {
  close(Phi(0), 0.5);
  close(pOneSided(1.959964), 0.025, 2e-6);
  close(pOneSided(-2), 1 - 0.0227501, 2e-6);
  close(pOneSided(2.74), 0.0030720, 2e-6);
  close(chi2SfEven(2, 2), Math.exp(-1));
  close(chi2SfEven(9.487729, 4), 0.05, 1e-6);
  const f = fisher([0.05, 0.05]);
  close(f.x, -4 * Math.log(0.05)); assert.equal(f.df, 4);
  assert.deepEqual(poisson95(5.6), [2, 11]);
  const F = family([{ id: 'a', p: 0.001, t: 3.09 }, { id: 'b', p: 0.5, t: 0 }, { id: 'c', p: 0.02, t: 2.05 }]);
  assert.equal(F.N, 3); assert.equal(F.t2.observed, 2);
  assert.deepEqual(F.holmPass, ['a', 'c']); // 0.001 x 3, then 0.02 x 2 = 0.04
});

test('inputs.json rows carry the fields', () => {
  const I = JSON.parse(read('inputs.json'));
  assert.ok(I.rows.length >= 80);
  const prs = new Set();
  for (const r of I.rows) {
    for (const k of ['row', 'pr', 'branch', 'role', 'tests']) assert.ok(k in r, `${r.pr} lacks ${k}`);
    assert.ok(['family', 'replication', 'excluded'].includes(r.role));
    assert.ok(!prs.has(r.pr), `PR ${r.pr} twice`); prs.add(r.pr);
    if (r.role === 'excluded') { assert.ok(r.why); assert.equal(r.tests.length, 0); continue; }
    assert.ok(r.topic && r.window && r.what, `${r.pr}`);
    assert.ok(r.tests.length >= 1, `${r.pr} has no test`);
    for (const x of r.tests) {
      assert.ok(x.test, `${r.pr}`);
      if (x.kind === 't') assert.equal(typeof x.t, 'number');
      else if (x.kind === 'p') assert.ok(x.p >= 0 && x.p <= 1);
      else assert.ok(x.why, `${r.pr} ${x.test} unparsed without a reason`);
      if (x.kind) assert.ok(x.path, `${r.pr} ${x.test} has no source`);
    }
  }
  for (const pr of [827, 893, 897]) assert.equal(I.rows.find((r) => r.pr === pr).role, 'excluded');
  for (const pr of [844, 862, 873, 889, 894]) assert.equal(I.rows.find((r) => r.pr === pr).role, 'replication');
  const g = I.rows.find((r) => r.pr === 878).tests.find((x) => x.test === 'T2');
  assert.equal(g.t, 2.74); assert.equal(g.n, 771);
});

test('result.json is the run of inputs.json, and RESULT.md says what it holds', () => {
  const I = JSON.parse(read('inputs.json'));
  const R = JSON.parse(read('result.json'));
  assert.deepEqual(JSON.parse(JSON.stringify(analyse(I))), R);
  const md = read('RESULT.md');
  assert.equal(md, report(R));
  const F = R.family, G = R.gotobi;
  assert.ok(md.includes(`**N = ${F.N}**`));
  assert.ok(md.includes(`**${F.t2.observed}** had t ≥ 2 against **${F.t2.expected.toFixed(1)}** expected`));
  assert.ok(md.includes(`BH q across all ${F.N} = **${G.a_bh10.q.toFixed(4)}**`));
  assert.ok(md.includes(`Holm across all = **${G.b_holm.pAdj.toFixed(4)}**`));
  assert.ok(md.includes(G.a_bh10.pass ? '**survives** q 0.10' : '**does not survive** q 0.10'));
  // the gotobi figures follow from the inputs
  close(G.p, +pOneSided(2.74).toFixed(6));
  close(G.fisher.newDaysOnly.p, fisher([pOneSided(2.74), pOneSided(3.8)]).p, 1e-12);
  close(G.fisher.primary.p, fisher([pOneSided(2.74), pOneSided(3.8), pOneSided(2.34)]).p, 1e-12);
  assert.ok(!md.toLowerCase().includes('edge is proven'));
});
