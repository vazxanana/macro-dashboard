// Multiple testing, update of the 13-14 Nov count: the statistics on hand-made p-values, Fisher, the collected snapshot's
// shape, and that result.json and RESULT.md are what run.mjs computes from collected.json. Offline: no git, no network.
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { holm, bh, by, fisher, chi2SfEven, Phi, pOneSided, tOfP, poisson95, family, testP, analyse, report, NEW, HYP } from '../research/edge/multiple-testing-update/run.mjs';

const DIR = new URL('../research/edge/multiple-testing-update/', import.meta.url);
const read = (f) => readFileSync(new URL(f, DIR), 'utf8');
const close = (a, b, eps = 1e-6) => assert.ok(Math.abs(a - b) < eps, `${a} vs ${b}`);

test('Holm and BH on hand-made p-values', () => {
  const ps = [0.01, 0.04, 0.03, 0.005];
  assert.deepEqual(holm(ps).map((v) => +v.toFixed(6)), [0.03, 0.06, 0.06, 0.02]);
  assert.deepEqual(bh(ps).map((v) => +v.toFixed(6)), [0.02, 0.04, 0.04, 0.02]);
  const c = 1 + 1 / 2 + 1 / 3 + 1 / 4;
  by(ps).forEach((v, i) => close(v, Math.min(1, bh(ps)[i] * c)));
  assert.deepEqual(holm([0.9, 0.95]), [1, 1]);
  // BH passes more than Holm on a set with several small p's: 10 tests, five at 0.008
  const set = [0.008, 0.008, 0.008, 0.008, 0.008, 0.5, 0.6, 0.7, 0.8, 0.9];
  assert.equal(holm(set).filter((v) => v <= 0.05).length, 0);
  assert.equal(bh(set).filter((v) => v <= 0.05).length, 5); // 0.008 x 10 / 5 = 0.016
});

test('normal p, Fisher and the Poisson range', () => {
  close(Phi(0), 0.5);
  close(pOneSided(2.74), 0.0030720, 2e-6);
  close(tOfP(pOneSided(1.7)), 1.7, 1e-6);
  close(chi2SfEven(2, 2), Math.exp(-1));
  close(chi2SfEven(9.487729, 4), 0.05, 1e-6);
  const f = fisher([0.05, 0.05]);
  close(f.x, -4 * Math.log(0.05)); assert.equal(f.df, 4);
  // #904's gotobi figure: original t 2.74 with USD/JPY 2005-09 t 3.80
  close(fisher([pOneSided(2.74), pOneSided(3.8)]).p, 3.63e-6, 0.01e-6);
  assert.deepEqual(poisson95(5.6), [2, 11]);
  const F = family([{ id: 'a', p: 0.001, t: 3.09 }, { id: 'b', p: 0.5, t: 0 }, { id: 'c', p: 0.02, t: 2.05 }]);
  assert.equal(F.t2.observed, 2); assert.deepEqual(F.holmPass, ['a', 'c']);
  // a two-sided stored p is used as is
  assert.equal(testP({ kind: 'p2', p: 0.4 }).p, 0.4);
  assert.equal(testP({ kind: 'x' }), null);
});

test('collected.json: #904 unchanged, every new study read, roles as pre-registered', () => {
  const C = JSON.parse(read('collected.json'));
  assert.equal(C.prior.rows.length, 82);
  const fam904 = C.prior.rows.filter((r) => r.role === 'family').flatMap((r) => r.tests).filter((x) => x.kind);
  assert.equal(fam904.length, 248);
  assert.deepEqual(C.rows.map((r) => r.pr), NEW.map((s) => s.pr));
  const role = (pr) => C.rows.find((r) => r.pr === pr).role;
  for (const pr of [920, 924, 928, 938]) assert.equal(role(pr), 'replication');
  for (const pr of [908, 912, 915, 937]) assert.equal(role(pr), 'robustness');
  assert.equal(role(900), 'excluded');
  for (const r of C.rows) {
    if (r.role === 'excluded' || r.role === 'robustness') { assert.equal(r.tests.length, 0); continue; }
    assert.ok(r.tests.length >= 1, `${r.pr}`);
    for (const x of r.tests) { assert.ok(x.kind, `${r.pr} ${x.test} unparsed`); assert.ok(x.path, `${r.pr} ${x.test}`); }
  }
  // spot checks against the studies' own reports
  const t = (pr, test) => C.rows.find((r) => r.pr === pr).tests.find((x) => x.test === test);
  assert.equal(t(928, 'R1 crosses 2020-26').t, 2.9878);
  assert.equal(t(938, 'S2 new pairs 2016-26').t, 3.1876);
  assert.equal(t(917, 'T1 other days').t, -2.37);
  assert.equal(t(934, 'T2 soybeans').ownP, 0.01195);
});

test('result.json is what run.mjs computes, and RESULT.md says it', () => {
  const C = JSON.parse(read('collected.json'));
  const R = analyse(C);
  const J = JSON.parse(read('result.json'));
  assert.deepEqual(J, JSON.parse(JSON.stringify(R)));
  assert.equal(R.family.N, 248 + R.counts.new);
  assert.equal(R.family.holmPass.length, 0);
  assert.equal(R.family.bh10.length, 0);
  close(R.family.t2.expected, R.family.N * (1 - Phi(2)));
  const g = R.hypotheses.find((h) => h.key === 'gotobi');
  close(g.fisherCalendarDisjoint.p, 3.63e-6, 0.01e-6);
  assert.deepEqual(R.standing, ['gotobi']);
  const w = R.hypotheses.find((h) => h.key === 'weekend-gap');
  assert.ok(w.fisherCalendarDisjoint.p > R.family.bonferroni.p && w.fisherAllCells.p < R.family.bonferroni.p);
  assert.equal(R.hypotheses.length, HYP.length);
  const md = read('RESULT.md');
  assert.equal(md, report(R));
  assert.ok(md.includes(`Holm across all ${R.family.N} decisive tests: 0 survive`));
  assert.ok(md.includes(`${R.family.t2.observed} observed against ${R.family.t2.expected.toFixed(1)} expected`));
  for (const k of ['#880', '#928', '#938', '#934', '#937', '#878', '#889', '#908', '#912', '#915', '#917']) assert.ok(md.includes(k), k);
});
