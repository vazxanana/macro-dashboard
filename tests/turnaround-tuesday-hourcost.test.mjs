// turnaround-tuesday-hourcost: the cost route, the stored result against its report, the pre-registered bar (offline).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { shareOf, measurable, hourOf, CONDS, BROKER, MIN_WIN } from '../research/edge/turnaround-tuesday-hourcost/run.mjs';

const R = JSON.parse(fs.readFileSync(new URL('../research/edge/turnaround-tuesday-hourcost/result.json', import.meta.url)));
const MD = fs.readFileSync(new URL('../research/edge/turnaround-tuesday-hourcost/RESULT.md', import.meta.url), 'utf8');
const PRE = fs.readFileSync(new URL('../research/edge/turnaround-tuesday-hourcost/PREREGISTRATION.md', import.meta.url), 'utf8');

test('cost route: half the spread of the entry hour and of the exit hour, commission; C2 adds a stop slippage', () => {
  const prof = []; for (let h = 0; h < 24; h++) prof[h] = { frac: 3e-5, frac90: 4e-5, n: 44 };
  prof[19] = { frac: 5e-5, frac90: 6e-5, n: 44 };
  const t0 = Date.UTC(2024, 0, 8, 19) / 1000, bars = [];
  for (let i = 0; i < 30; i++) bars.push([t0 + i * 3600, 100, 102, 98, 101]);
  assert.equal(hourOf(bars[0][0]), 19);
  const c1 = shareOf(prof, 0, CONDS.C1, bars, 0, 1, 'time', 20000);
  assert.ok(Math.abs(c1 - (0.5 * 5e-5 + 0.5 * 3e-5)) < 1e-15);
  const c2 = shareOf(prof, 0, CONDS.C2, bars, 0, 20, 'stop', 20000);
  assert.ok(Math.abs(c2 - (0.5 * 6e-5 + 0.5 * 4e-5 + 0.1 * 4 / 20000)) < 1e-15);
  assert.equal(measurable(prof, [19, 20]), null); prof[20].n = MIN_WIN - 1; assert.match(measurable(prof, [19, 20]), /hour 20/);
  assert.deepEqual(BROKER, { spx500: 'US500', nas100: 'NAS100' });
});
test('result: gate held, NAS100 R2 passes every check of the study\'s bar at C1, the report quotes it', () => {
  assert.ok(R.gate.same, 'harness gate');
  const c = R.C1.cells['nas100-r2'], k = R.C1.checks['nas100-r2'];
  assert.equal(k.pass, true); assert.ok(Object.values(k.checks).every(Boolean));
  assert.equal(c.oos.n, 81); assert.ok(c.oos.R > 0 && c.oos.t >= 2 && k.holmP < 0.05 && c.placebo.beaten >= 38);
  assert.match(R.verdict, /^PASS \(accounting, no rule tested\)/);
  assert.ok(MD.includes(`+${c.oos.R}R a trade on 2016 → Nov 2026 (n ${c.oos.n}, t ${c.oos.t}, Holm p ${k.holmP}`));
  assert.ok(MD.includes(`month-sum t`) && MD.includes(`| ${c.oosMonthT.t} |`));
  for (const id of ['spx500-r1', 'spx500-r2', 'nas100-r1']) assert.equal(R.C1.checks[id].pass, false);
  assert.equal(R.original['nas100-r2'].oos.R, 0.098);
  assert.equal(R.forward.trades[0].Rassumed, -0.135);
  assert.ok(MD.includes(`${String(R.forward.trades[0].Rmeasured).replace("-", "−")}R at the measured cost`));
});
test('pre-registration: accounting, the study\'s own bar, imported rule', () => {
  assert.match(PRE, /no rule is tested/); assert.match(PRE, /verdictOf/); assert.match(PRE, /Harness gate/);
});
