// gold-pre-holiday-hourcost: the cost route, the stored result against its report, the pre-registered bar (offline).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { costOf, legs, measurable, hourOf, CONDS, MIN_WIN } from '../research/edge/gold-pre-holiday-hourcost/run.mjs';

const R = JSON.parse(fs.readFileSync(new URL('../research/edge/gold-pre-holiday-hourcost/result.json', import.meta.url)));
const MD = fs.readFileSync(new URL('../research/edge/gold-pre-holiday-hourcost/RESULT.md', import.meta.url), 'utf8');
const PRE = fs.readFileSync(new URL('../research/edge/gold-pre-holiday-hourcost/PREREGISTRATION.md', import.meta.url), 'utf8');

test('cost route: entry hour and exit hour, commission; C2 adds a stop slippage; legs find the stop candle', () => {
  const prof = []; for (let h = 0; h < 24; h++) prof[h] = { frac: 2e-5, frac90: 3e-5, n: 44 };
  prof[22] = { frac: 4e-5, frac90: 5e-5, n: 24 };
  const t0 = Date.UTC(2024, 6, 3, 22) / 1000, h1 = [];
  for (let i = 0; i < 30; i++) h1.push({ time: t0 + i * 3600, open: 2400, high: 2402, low: 2398, close: 2401 });
  assert.equal(hourOf(h1[0].time), 22);
  const tr = { entry: 2400, stopped: false }, lg = { iIn: 0, iOut: 22 };
  assert.ok(Math.abs(costOf(prof, 0.000024, CONDS.C1, h1, tr, lg) - (0.5 * 4e-5 + 0.5 * 2e-5 + 0.000024) * 2400) < 1e-12);
  const st = { entry: 2400, stopped: true };
  assert.ok(Math.abs(costOf(prof, 0, CONDS.C2, h1, st, lg) - ((0.5 * 5e-5 + 0.5 * 3e-5) * 2400 + 0.1 * 4)) < 1e-12);
  const at = new Map(h1.map((c, i) => [c.time, i])), ds = [{ i0: 0 }];
  assert.equal(legs(at, ds, 0, { stopped: false, exitT: h1[5].time + 3600 }).iOut, 5);
  assert.equal(legs(at, ds, 0, { stopped: true, exitT: h1[7].time + 3600, exit: 2390, gapOpen: null }).iOut, 7);
  assert.equal(legs(at, ds, 0, { stopped: true, exitT: h1[7].time, exit: 2380, gapOpen: 2380 }).iOut, 7);
  assert.equal(measurable(prof, [22]), null); prof[22].n = MIN_WIN - 1; assert.match(measurable(prof, [22]), /hour 22/);
});
test('result: gate held, T1 passes every check of the study\'s bar at C1, the report quotes it', () => {
  assert.ok(R.gate.same, 'harness gate'); assert.equal(R.gate.data.h1, 125704);
  const t = R.C1.T1;
  assert.equal(t.pass, true); assert.ok(Object.values(t.checks).every(Boolean));
  assert.equal(t.oos.n, 92); assert.ok(t.oos.netR > 0 && t.oos.netT >= 2 && t.pHolm < 0.05 && t.placebo.beat >= 38 && t.oos.net2x > 0);
  assert.equal(R.C1.T3.pass, false);
  assert.match(R.verdict, /^PASS \(accounting, no rule tested\)/);
  assert.ok(MD.includes(`+${t.oos.netR}R a trade out of sample 2017 → Oct 2026 (n ${t.oos.n}, t ${t.oos.netT} per event, Holm p ${t.pHolm}`));
  assert.ok(MD.includes(`| ${t.oosMonthT} |`));
  assert.equal(R.original.T1.oos.netR, 0.133); assert.equal(R.commission, 0.000024);
});
test('pre-registration: accounting, the study\'s own bar, imported rule', () => {
  assert.match(PRE, /no rule is tested/); assert.match(PRE, /Harness gate/); assert.match(PRE, /owner item 44/);
});
