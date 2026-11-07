// node --test tests/coach-shrinkage.test.mjs — shrunk expectancy and the empirical-Bayes prior (council/coach.mjs)
import test from 'node:test';
import assert from 'node:assert/strict';
import { CC, shrink, ebTau, shrunkClear, Phi } from '../council/coach.mjs';

const near = (a, b, eps = 1e-3) => assert.ok(Math.abs(a - b) < eps, `${a} vs ${b}`);
const rep = (vals, n) => Array.from({ length: n }, (_, i) => vals[i % vals.length]);
// n values with mean m and (about) unit spread: m+1, m-1, ...
const grp = (m, n) => Array.from({ length: n }, (_, i) => m + (i % 2 ? 1 : -1));

test('posterior mean = tau²/(tau²+se²) x mean, worked by hand', () => {
  const s = shrink(rep([2, 0], 16), 0.25);       // mean 1, sd sqrt(16/15), se² = 1/15
  near(s.mean, 1); near(s.se ** 2, 1 / 15);
  const w = 0.0625 / (0.0625 + 1 / 15);
  near(s.w, w); near(s.post, w * 1); near(s.postSd, Math.sqrt(w) * Math.sqrt(1 / 15));
  near(s.pPos, Phi(s.post / s.postSd)); assert.ok(s.pPos > 0.99);
});

test('shrinkage pulls toward 0 by sample size; never flips the sign', () => {
  const small = shrink(grp(-0.4, 10)), big = shrink(grp(-0.4, 1000));
  assert.ok(small.post > -0.4 && small.post < 0);
  assert.ok(big.post < small.post, 'more trades, less shrinkage');
  near(big.post, -0.4, 0.01);
  assert.equal(shrink([]).post, 0);
  near(shrink(grp(0.3, 50), 100).post, 0.3, 1e-3);   // a very wide prior: the raw mean
  near(shrink(grp(0.3, 50), 1e-6).post, 0, 1e-6);     // a very tight prior: zero
});

test('a sample of identical results is not treated as certain (sd floor)', () => {
  const s = shrink([-1, -1], 0.25);                  // sd 0 -> floor 0.5, se² = 0.125
  near(s.w, 0.0625 / 0.1875); near(s.post, -1 / 3);
});

test('normal CDF', () => { near(Phi(0), 0.5, 1e-7); near(Phi(1.96), 0.975, 1e-4); near(Phi(-1), 0.158655, 1e-5); });

test('empirical-Bayes tau: from the spread of the group means beyond their noise', () => {
  const G = [grp(0.3, 100), grp(-0.3, 100), grp(0.3, 100), grp(-0.3, 100)];
  near(ebTau(G), Math.sqrt(0.09 - (100 / 99) / 100), 1e-3);
  assert.equal(ebTau([grp(0.3, 100), grp(-0.3, 100)]), CC.tau, 'fewer than 3 groups: the default prior');
  assert.equal(ebTau([grp(0, 40), grp(0.01, 40), grp(-0.01, 40)]), CC.tauMin, 'groups no different from noise: maximum shrinkage');
  assert.equal(ebTau([grp(2, 200), grp(-2, 200), grp(2, 200)]), CC.tauMax, 'clamped');
  assert.equal(ebTau([grp(1, 5), grp(1, 5), grp(1, 5)]), CC.tau, 'groups under 10 trades are ignored');
});

test('the shrinkage bar: big samples with a tiny edge and small noisy samples do not move a rule', () => {
  assert.equal(shrunkClear(grp(-0.12, 2000), -1), true);
  assert.equal(shrunkClear(grp(-0.08, 2000), -1), false, 't is about -3.6, but -0.08R is under the +/-0.10R effect bar');
  assert.equal(shrunkClear(grp(-0.25, 30), -1), true);  // shrunk to about -0.16R
  assert.equal(shrunkClear(grp(-0.15, 30), -1), false); // shrunk to about -0.10R... just short
  assert.equal(shrunkClear(grp(0.25, 30), 1), true);
  assert.equal(shrunkClear(grp(0.25, 30), -1), false);
});
