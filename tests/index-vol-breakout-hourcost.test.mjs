// index-vol-breakout-hourcost: the cost route, the stored result against its report, the pre-registration's fixed bar.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { hourCost, charge, measurable, CONDS, EXIT_H, BROKER } from '../research/edge/index-vol-breakout-hourcost/run.mjs';

const R = JSON.parse(fs.readFileSync(new URL('../research/edge/index-vol-breakout-hourcost/result.json', import.meta.url)));
const MD = fs.readFileSync(new URL('../research/edge/index-vol-breakout-hourcost/RESULT.md', import.meta.url), 'utf8');

test('hour cost: half the spread at the fill hour and at the 20:00 exit, commission, slippage', () => {
  const hp = []; for (let h = 0; h < 24; h++) hp[h] = { frac: 2e-5, frac90: 3e-5, n: 44 };
  hp[3] = { frac: 4e-5, frac90: 5e-5, n: 44 };
  const c = hourCost(hp, 0, CONDS.C1, 20000, 3, 10);
  assert.ok(Math.abs(c - ((0.5 * 4e-5 + 0.5 * 2e-5) * 20000 + 0.05 * 10)) < 1e-9);
  assert.equal(EXIT_H, 20);
  const x = charge({ R: 1, r: 50, finR: 0 }, 2); assert.equal(x.net, 1 - 2 / 50); assert.equal(x.net2, 1 - 4 / 50);
});
test('not measurable when an hour has too few windows', () => {
  const hp = []; for (let h = 0; h < 24; h++) hp[h] = { frac: 1e-5, frac90: 1e-5, n: 44 };
  assert.equal(measurable(hp), null); hp[7].n = 3; assert.match(measurable(hp), /hour 7/);
});
test('result: gate held, FAIL 0 of 2, the report quotes the stored numbers', () => {
  assert.ok(R.gate.nas100.same && R.gate.spx500.same);
  assert.match(R.verdict, /^FAIL, 0 of 2/);
  const n = R.C1.markets.nas100.ALL, d = R.C1.decision.nas100;
  assert.equal(d.pass, false); assert.equal(d.checks.placebo, false); assert.ok(d.placeboBeaten < 38);
  assert.ok(MD.includes(`+${n.netR}R a trade (n ${n.n.toLocaleString('en-US')}`)); assert.ok(MD.includes(`${d.placeboBeaten} of 40`));
  assert.deepEqual(BROKER, { nas100: 'NAS100', spx500: 'US500' });
});
