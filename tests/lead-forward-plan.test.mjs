// lead-forward-plan: accounting / design only (no rule tested). Offline: reads the committed inputs.json and result.json.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import crypto from 'node:crypto';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { simulate } from '../research/proposals/2026-11-12-path-to-live.mjs';
import { IN, OUT, MD, GATES, VERDICT, GRID, gateStats, gateCheck, simulateT, blocks, netsAt, planStream, monthsToT2, monthList, report } from '../research/edge/lead-forward-plan/run.mjs';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const I = JSON.parse(fs.readFileSync(IN, 'utf8'));
const O = JSON.parse(fs.readFileSync(OUT, 'utf8'));
const DIR = path.join(ROOT, 'research/edge/lead-forward-plan');

test('lead-forward-plan: every stream reproduces its study\'s published decisive-window figures', () => {
  assert.deepEqual(Object.keys(I.streams).sort(), Object.keys(GATES).sort());
  for (const [k, s] of Object.entries(I.streams)) {
    const g = gateCheck(k, gateStats(s));
    assert.ok(g.pass, `${k}: ${JSON.stringify(g)}`);
    assert.deepEqual(O.streams[k].gate, g);
  }
});

test('lead-forward-plan: the bootstrap is path-to-live\'s, imported and pinned', () => {
  const sha = crypto.createHash('sha256').update(fs.readFileSync(path.join(ROOT, 'research/proposals/2026-11-12-path-to-live.mjs'))).digest('hex');
  assert.equal(sha, '4d4d54fc8c4916b8c1802411822985b669405ca2aded83ef7b572eb2cf957665');
  const run = fs.readFileSync(path.join(DIR, 'run.mjs'), 'utf8');
  assert.match(run, /from '\.\.\/\.\.\/proposals\/2026-11-12-path-to-live\.mjs'/);
  for (const k of ['L2', 'L3']) {
    const s = I.streams[k], B = blocks(s, netsAt(s, 1));
    const a = simulate(B, [6, 12, 24], 400, 12), b = simulateT(B, [6, 12, 24], 400, 12);
    for (const h of [6, 12, 24]) { assert.deepEqual(Array.from(b.cum[h]), Array.from(a.cum[h])); assert.deepEqual(Array.from(b.dd[h]), Array.from(a.dd[h])); }
  }
});

test('lead-forward-plan: months and months-to-t-2 on hand-made series', () => {
  assert.deepEqual(monthList('2025-11', '2026-02'), ['2025-11', '2025-12', '2026-01', '2026-02']);
  const s = { monthFrom: '2026-01', monthTo: '2026-03', trades: [['2026-01-05', 1, 0], ['2026-03-02', -1, 0], ['2026-03-09', 2, 0]] };
  assert.deepEqual(blocks(s, [1, -1, 2]), [[1], [], [-1, 2]]);
  const m = monthsToT2([1, 2, 3, 2], [1, 2, 3, 2], 4);
  assert.ok(Math.abs(m.monthly - (2 * Math.sqrt(2 / 3) / 2) ** 2) < 1e-12);
  assert.equal(monthsToT2([-1, 0, 1, -2], [-1, 0, 1, -2], 4).monthly, null);
  // a path's monthly-sum t: one month block of +1 and one of -1, every path's t is finite or signed infinity
  const r = simulateT([[1], [-1, 0.5]], [6], 50, 3);
  assert.equal(r.t[6].length, 50);
});

test('lead-forward-plan: the bond stream rebuilt in full equals result.json', () => {
  const plan = JSON.parse(JSON.stringify(planStream(I.streams.L3)));
  assert.deepEqual(plan, O.streams.L3.plan);
  assert.deepEqual(Object.keys(plan).map(Number).sort((a, b) => a - b), GRID);
  // the world shifts: "no edge" has mean 0, "losing" minus the 1x mean's magnitude
  for (const m of GRID) { assert.equal(plan[m].worlds.none.mean, 0); assert.equal(plan[m].worlds.losing.mean, -Math.abs(O.streams.L3.plan[1].mean)); }
});

test('lead-forward-plan: RESULT.md is the report of result.json and says what it is and is not', () => {
  const md = fs.readFileSync(MD, 'utf8');
  assert.equal(md, report(O));
  assert.equal(O.verdict, VERDICT);
  assert.ok(md.includes(`**Verdict: ${VERDICT}.**`));
  assert.ok(md.includes('This is not a proposal to trade anything'));
  assert.ok(md.includes('absolute rule 3'));
  assert.ok(md.includes('No lead is an edge'));
  assert.doesNotMatch(md.split('No lead is an edge').join(''), /\bPASS\b|is an edge|proven edge/);
  const pre = fs.readFileSync(path.join(DIR, 'PREREGISTRATION.md'), 'utf8');
  assert.ok(pre.includes('PLAN COMPUTED (no rule tested)'));
});

test('lead-forward-plan: the demo snapshot carries symbols only, never an account or token', () => {
  const raw = JSON.stringify(I.demo) + JSON.stringify(O.demo);
  assert.ok(!('account' in I.demo));
  assert.doesNotMatch(raw, /token|accessToken|refresh|ctidTraderAccountId|traderLogin/i);
  assert.equal(O.demo.L1.onList.USDJPY, false);
  assert.equal(O.demo.L4.onList.NAS100, true);
});
