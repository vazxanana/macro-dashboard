// research/edge/mosha-weekly-er: the report's figures match result.json; the groups and the population are what the
// pre-registration fixed; the costs are desk-rigor's.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { inF1, inF2, known, isEntry, cost, stats, welch } from '../research/edge/mosha-weekly-er/run.mjs';
import { cost as rigorCost } from '../research/edge/desk-rigor/run.mjs';

const DIR = new URL('../research/edge/mosha-weekly-er/', import.meta.url);
const R = JSON.parse(fs.readFileSync(new URL('result.json', DIR), 'utf8'));
const MD = fs.readFileSync(new URL('RESULT.md', DIR), 'utf8');
const PRE = fs.readFileSync(new URL('PREREGISTRATION.md', DIR), 'utf8');
const f = (v) => (v >= 0 ? '+' : '−') + Math.abs(v).toFixed(3);

test('mosha-weekly-er: verdict line and headline match result.json', () => {
  assert.match(R.verdict, /^(PASS|FAIL)$/);
  const lines = MD.split('\n');
  assert.equal(lines[0], '# The Mosha sequence entries with the weekly side and a trending Daily');
  assert.match(lines[2], new RegExp(`^\\*\\*Verdict: ${R.verdict}\\. `));
  assert.ok(R.headline.startsWith(R.verdict));
  assert.equal(R.verdict === 'PASS', Object.values(R.tests).some((t) => t.verdict === 'PASS'));
});

test('mosha-weekly-er: every test row in RESULT.md is the figure in result.json', () => {
  for (const id of ['F1', 'F2']) for (const [w, lab] of [['A', '2020-2023'], ['B', '2024 on']]) {
    const x = R.tests[id][w], g = x.group;
    const row = `| ${id} | ${lab} | ${g.n} | ${g.win} | ${g.pf} | ${f(g.gross)} | ${f(g.mean)} | ${g.tMonth} | ${g.total} | ${x.rest.n} | ${f(x.rest.mean)} | ${f(x.vsRest.diff)} | ${x.vsRest.t} |`;
    assert.ok(MD.includes(row), 'missing row ' + row);
  }
  for (const id of ['F1', 'F2']) { const t = R.tests[id];
    assert.ok(MD.includes(`| ${t.p} | ${t.holm} |`));
    assert.equal(t.verdict === 'PASS', Object.values(t.checks).every(Boolean) && t.verdict === 'PASS');
    if (t.verdict === 'PASS') { assert.ok(t.A.group.n >= 100 && t.B.group.n >= 100); assert.ok(t.A.group.tMonth >= 2 && t.B.group.tMonth >= 2); assert.ok(t.holm < 0.05); } }
  const h = R.tests.F1;
  assert.ok(R.headline.includes(`n ${h.A.group.n}, month t ${h.A.group.tMonth}`) && R.headline.includes(`n ${h.B.group.n}, month t ${h.B.group.tMonth}`));
});

test('mosha-weekly-er: groups, population and costs are the pre-registered ones', () => {
  assert.ok(PRE.includes('`withWeekly === true` AND `er20 >= 0.2`') && PRE.includes('`withWeekly === true` AND `er20 >= 0.35`'));
  assert.equal(inF1({ withWeekly: true, er20: 0.2 }), true); assert.equal(inF1({ withWeekly: true, er20: 0.19 }), false);
  assert.equal(inF1({ withWeekly: false, er20: 0.9 }), false); assert.equal(inF2({ withWeekly: true, er20: 0.34 }), false);
  assert.equal(inF2({ withWeekly: true, er20: 0.35 }), true); assert.equal(known({ withWeekly: null, er20: 0.3 }), false);
  for (const id of ['sop-1h-1', 'eurusd:sop-i-15m-2', 'sop-4h-3']) assert.equal(isEntry({ kind: 'sop', id }), true, id);
  for (const id of ['sop-c2-1h-1', 'sop-l-1h-b1', 'sop-vr-1h-b1', 'sop-vc-1h-s1', 'sop-nv-5m-b1', 'gbpusd:sop-nc-5m-s1', 'bar-1h-1']) assert.equal(isEntry({ kind: 'sop', id }), false, id);
  for (const [mk, px] of [['xau', 2000], ['eurusd', 1.1], ['gbpusd', 1.3]]) assert.equal(cost(mk, px), rigorCost(mk, px));
});

test('mosha-weekly-er: the statistics on a hand-made set', () => {
  const t = (m) => Date.UTC(2021, m, 5) / 1000;
  const rows = [{ t: t(0), net: 1 }, { t: t(0), net: -1 }, { t: t(1), net: 2 }, { t: t(2), net: -0.5 }];
  const s = stats(rows); assert.equal(s.n, 4); assert.equal(s.months, 3); assert.equal(s.mean, 0.375); assert.equal(s.pf, 2); assert.equal(s.dd, 1);
  const w = welch([{ net: 1 }, { net: 2 }], [{ net: 0 }, { net: 0 }, { net: 1 }]); assert.equal(w.diff, 1.1667);
  assert.ok(!/\bedge\b/i.test(MD.replace(/Edge lab|research\/edge|not an edge|an edge on its own/gi, '')), 'RESULT.md must not call anything an edge');
});
