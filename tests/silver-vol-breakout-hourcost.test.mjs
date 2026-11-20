// research/edge/silver-vol-breakout-hourcost: the usability gate and the cost arithmetic (offline), and the report's verdict.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { usable, costFrac, chargeOne, EXIT_HOUR } from '../research/edge/silver-vol-breakout-hourcost/run.mjs';

const prof = Array.from({ length: 24 }, (_, h) => ({ hour: h, n: 40, frac: 4e-4, frac90: 5e-4 }));
test('usable needs 20 weekdays and 10 windows an hour to hour 20', () => {
  const hours = (n) => Array.from({ length: n }, (_, d) => ({ t: 1.79e9 + d * 86400 }));
  assert.equal(usable({ hourProfile: prof, hours: hours(30) }).ok, true);
  assert.equal(usable({ hourProfile: prof, hours: hours(10) }).ok, false);
});
test('a trade pays half the fill hour, half hour 20, commission and s x M', () => {
  assert.equal(EXIT_HOUR, 20);
  const x = { R: 0.5, finR: 0, entry: 30, r: 0.1, M: 0.02, fillMin: 130 };
  assert.ok(Math.abs(chargeOne(x, prof, 'frac', 2.4e-5, 0.05) - (0.5 - ((4e-4 + 2.4e-5) * 30 + 0.001) / 0.1)) < 1e-12);
  assert.ok(Math.abs(costFrac(prof, 2, 'frac90', 0) - 5e-4) < 1e-15);
});
test('the report carries the result\'s verdict', () => {
  const r = JSON.parse(fs.readFileSync(new URL('../research/edge/silver-vol-breakout-hourcost/result.json', import.meta.url), 'utf8'));
  assert.ok(r.gateOk); assert.equal(r.tests.filter((t) => t.holds).length, 0);
  assert.ok(fs.readFileSync(new URL('../research/edge/silver-vol-breakout-hourcost/RESULT.md', import.meta.url), 'utf8').includes(r.verdict));
});
