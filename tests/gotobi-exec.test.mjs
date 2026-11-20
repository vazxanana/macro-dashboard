// research/edge/gotobi-exec: the executable fade on made-up quotes and candles (offline).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { execTrade, usableDay, costPips, MAX_AGE } from '../research/edge/gotobi-exec/run.mjs';
import { index } from '../research/edge/gotobi/run.mjs';

const day = '2026-11-20', d0 = Date.parse(day + 'T00:00:00Z') / 1000;
const bars = (hi) => index(Array.from({ length: 70 }, (_, k) => { const t = d0 + 3300 + k * 300; return [t, 155, Math.max(155, hi(t)), 154.9, 155]; }));
const g = { day, entry: { bid: 155.0, ask: 155.002, ageS: 1, spread: 0.002 }, exit: { bid: 154.8, ask: 154.802, ageS: 3, spread: 0.002 } };

test('sell at the bid, buy back at the ask; commission on top', () => {
  const t = execTrade(bars(() => 155), g, 0.2);
  assert.equal(t.how, 'time'); assert.ok(Math.abs(t.R - (155.0 - 154.802) / 0.2) < 1e-9); assert.ok(t.net < t.R);
  assert.ok(Math.abs(costPips(g) - (0.1 + 0.1 + 2 * 22.5e-6 * 155 / 0.01)) < 1e-9);
});

test('a stop on the mid highs fills at the stop plus half the spread; extra slippage worsens both ends', () => {
  const t = execTrade(bars((tt) => (tt === d0 + 3600 ? 155.3 : 155)), g, 0.2);
  assert.equal(t.how, 'stop'); assert.ok(Math.abs(t.exit - (155.2 + 0.001)) < 1e-9); assert.ok(t.R < -1);
  const a = execTrade(bars(() => 155), g, 0.2), b = execTrade(bars(() => 155), g, 0.2, 0.003);
  assert.ok(Math.abs(a.R - b.R - 0.006 / 0.2) < 1e-9);
});

test('a day needs fresh quotes at both marks', () => {
  assert.equal(usableDay(g), true);
  assert.equal(usableDay({ ...g, exit: { ...g.exit, ageS: MAX_AGE + 1 } }), false);
  assert.equal(usableDay({ ...g, entry: null }), false);
});
