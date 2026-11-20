// research/edge/gold-vol-breakout-hourcost: the verbatim copies, the usability gate and the hour-cost arithmetic (offline).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import crypto from 'node:crypto';
import { usable, costFrac, charge, hourOf, ORIG_SHA, COSTS_SHA, EXIT_HOUR } from '../research/edge/gold-vol-breakout-hourcost/run.mjs';

const D = new URL('../research/edge/gold-vol-breakout-hourcost/', import.meta.url);
const sha = (f) => crypto.createHash('sha256').update(fs.readFileSync(new URL(f, D))).digest('hex');

test('original.mjs and costs.mjs are the verbatim copies', () => {
  assert.equal(sha('original.mjs'), ORIG_SHA); assert.equal(sha('costs.mjs'), COSTS_SHA);
  assert.equal(fs.readFileSync(new URL('original.mjs', D), 'utf8'), fs.readFileSync(new URL('../research/edge/gold-vol-breakout-costs/original.mjs', import.meta.url), 'utf8'));
});

const prof = (n = 30) => Array.from({ length: 24 }, (_, h) => ({ hour: h, n, frac: h < 7 ? 4e-5 : 2e-5, frac90: h < 7 ? 8e-5 : 3e-5 }));
const hours = (days) => Array.from({ length: days }, (_, d) => ({ t: 1_790_000_000 + d * 86400 }));

test('usable: the stop conditions of the pre-registration', () => {
  assert.equal(usable(null).ok, false);
  assert.match(usable({ hourProfile: prof(), hours: hours(19) }).why, /19 weekdays/);
  const p = prof(); p[5].n = 9; assert.match(usable({ hourProfile: p, hours: hours(40) }).why, /hour 5/);
  const q = prof(); q[22].n = 0; assert.equal(usable({ hourProfile: q, hours: hours(40) }).ok, true);   // hours after 20 are not needed
});

test('cost: half the fill hour, half hour 20, plus commission; slippage s x M', () => {
  const p = prof(); assert.equal(EXIT_HOUR, 20);
  assert.ok(Math.abs(costFrac(p, 3, 'frac', 2.4e-5) - (0.5 * 4e-5 + 0.5 * 2e-5 + 2.4e-5)) < 1e-15);
  const x = { day: '2020-01-02', R: 1, finR: 0, entry: 2000, r: 10, M: 2, fillMin: 185 };
  assert.equal(hourOf(x), 3);
  const [c] = charge([x], p, 'frac', 2.4e-5, 0.05);
  assert.ok(Math.abs(c.net - (1 - ((0.5 * 4e-5 + 0.5 * 2e-5 + 2.4e-5) * 2000 + 0.1) / 10)) < 1e-12);
});
