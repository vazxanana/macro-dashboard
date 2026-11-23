// tests/dom-gold-hourcost.test.mjs - the study's report against its result.json, and its pieces on hand-made candles (offline).
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { walk, costR, COMMISSION } from '../research/edge/dom-gold-hourcost/run.mjs';
import { multi } from '../research/edge/combo-grid-3/run.mjs';

const DIR = new URL('../research/edge/dom-gold-hourcost/', import.meta.url);
const R = JSON.parse(fs.readFileSync(new URL('result.json', DIR), 'utf8'));
const MD = fs.readFileSync(new URL('RESULT.md', DIR), 'utf8');
const PRE = fs.readFileSync(new URL('PREREGISTRATION.md', DIR), 'utf8');

test('RESULT.md line 3 carries the verdict and headline of result.json', () => {
  const l3 = MD.split('\n')[2];
  assert.match(l3, new RegExp('^\\*\\*Verdict: ' + R.verdict + '\\. '));
  assert.ok(l3.includes(R.headline), 'headline on line 3');
  assert.ok(['PASS', 'FAIL', 'INCONCLUSIVE', 'STOPPED'].includes(R.verdict));
});

test('the gates held and the verdict follows the tests', () => {
  assert.deepEqual(R.gates, { G1: true, G2: true, G3: true });
  for (const c of R.cut) assert.ok(c.same && c.compared > 100);
  const passed = R.tests.filter((t) => t.pass).map((t) => t.id);
  assert.deepEqual(passed, R.passed);
  assert.equal(R.verdict, passed.length ? 'PASS' : 'FAIL');
  for (const t of R.tests) assert.equal(t.pass, t.A.R > 0 && t.A.t >= 2 && t.B.R > 0 && t.B.t >= 2 && t.holm < 0.05);
});

test('every figure quoted in RESULT.md tables comes from result.json', () => {
  for (const t of R.tests) for (const w of ['A', 'B']) assert.ok(MD.includes(String(t[w].n)), `n ${t[w].n}`);
  for (const [k, s] of Object.entries(R.share)) assert.ok(MD.includes((s.share * 100).toFixed(0) + ' %'), `cost share ${k}`);
  assert.ok(MD.includes('three grids'), 'the in-sample caution');
});

test('the pre-registration fixed the bar and the costs before the run', () => {
  assert.match(PRE, /T1\*\* 4R exit/);
  assert.match(PRE, /T2\*\* 1R trail/);
  assert.match(PRE, /0459ec37/);
  assert.equal(COMMISSION, 0.000024);
});

// hand-made candles: a buy limit at 100, stop 99, the walk must equal multi() for every exit it tracks
const bar = (t, o, h, l, c) => ({ t, o, h, l, c, e: t + 300 });
function path(prices) { return prices.map((p, i) => bar(1e6 + i * 300, ...p)); }
test('walk() equals multi() on hand-made paths, every tracked exit', () => {
  const paths = [
    [[101, 101.2, 99.9, 100.5], [100.5, 101.6, 100.4, 101.5], [101.5, 102.2, 101.4, 102.1], [102.1, 104.1, 102, 104], [104, 104.5, 103, 103.2], [103.2, 103.3, 98, 98.5]],
    [[101, 101.1, 99.95, 100.1], [100.1, 100.2, 98.9, 99.0], [99, 99.5, 98, 99]],
    [[101, 101.1, 100, 100.3], [100.3, 101.3, 100.2, 101.2], [101.2, 101.3, 100.1, 100.15], [97, 97.5, 96, 96.5], [96, 96, 96, 96]],
  ];
  for (const p of paths) {
    const B = path(p); const r = multi(B, 1, 100, 99, 'lim', B[0].t, B[0].t + 3600, 2, null, 2 * 86400, null);
    if (!r) continue; // a path that does not finish every exit on file
    const fill = 99 + r.risk;
    for (const [k, slot] of Object.entries({ '2R': 1, '3R': 2, '4R': 3, trail: 6 })) { const w = walk(B, 1, 0, fill, 99, r.risk, k); assert.ok(w); assert.ok(Math.abs(w.R - r.R[slot]) < 1e-9, k); }
  }
});

test('costR: half the spread of each hour, commission, slippage and long financing, in R', () => {
  const prof = Array.from({ length: 24 }, (_, h) => ({ frac: h === 3 ? 0.00002 : 0.00004, frac90: 0.00005 }));
  const t = Date.UTC(2025, 0, 6, 3, 0) / 1000; // Monday 03:00 UTC
  const row = { t, side: -1, fill: 4000, risk: 5, M: 1, ex: { '4R': { te: t + 7200, end: t + 7500 } } };
  const want = ((0.5 * 0.00002 + 0.5 * 0.00004 + COMMISSION) * 4000 + 0.05) / 5;
  assert.ok(Math.abs(costR(row, '4R', prof, 'C1') - want) < 1e-12);
  const long = { ...row, side: 1, ex: { '4R': { te: t + 86400 + 7200, end: t + 86400 + 7500 } } }; // over one 22:00 rollover
  assert.ok(Math.abs(costR(long, '4R', prof, 'C1') - (want + 0.000148 * 4000 / 5)) < 1e-12);
  assert.equal(costR(row, '4R', prof, 'flat'), 0.3 / 5);
});
