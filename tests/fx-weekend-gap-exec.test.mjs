// research/edge/fx-weekend-gap-exec: the measured-spread charge, the stale-quote rule, and the mark list (offline).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { spreadAt, charge, PAIRS18, MAX_AGE } from '../research/edge/fx-weekend-gap-exec/run.mjs';

test('spread at a mark: the median in the window, else ask - bid; stale or missing quotes are refused', () => {
  const m = new Map([[100, [100, 1.1, 1.10012, 3, 0.0001]], [200, [200, 1.1, 1.1002, 5, null]], [300, [300, 1.1, 1.1001, MAX_AGE + 1, 0.0001]]]);
  assert.equal(spreadAt(m, 100), 0.0001); assert.ok(Math.abs(spreadAt(m, 200) - 0.0002) < 1e-12);
  assert.equal(spreadAt(m, 300), null); assert.equal(spreadAt(m, 400), null);
});

test('charge: half the spread at each end, commission, stress slippage a side', () => {
  const t = { pair: 'eurusd', entry: 1.1, r0: 0.002, R: 1 };
  const a = charge(t, 0.0002, 0.0001), b = charge(t, 0.0002, 0.0001, 0.5);
  const cost = 0.0001 + 0.00005 + 2 * 22.5e-6 * 1.1;
  assert.ok(Math.abs(a.net - (1 - cost / 0.002)) < 1e-12);
  assert.ok(Math.abs(a.net - b.net - 0.0001 / 0.002) < 1e-12);
  assert.ok(Math.abs(a.costPips - cost / 0.0001) < 1e-9);
  assert.ok(Math.abs(charge({ ...t, pair: 'usdjpy', entry: 150, r0: 0.3 }, 0.02, 0.02).costPips - (0.02 + 2 * 22.5e-6 * 150) / 0.01) < 1e-9);
});

test('the mark list holds every trade\'s entry and exit, for the 18 pairs only', () => {
  const T = JSON.parse(fs.readFileSync(new URL('../research/edge/fx-weekend-gap-exec/trades.json', import.meta.url), 'utf8'));
  const M = JSON.parse(fs.readFileSync(new URL('../research/edge/fx-weekend-gap-exec/marks.json', import.meta.url), 'utf8'));
  assert.deepEqual(Object.keys(M).sort(), PAIRS18.map((p) => p.toUpperCase()).sort());
  for (const t of T) { const s = new Set(M[t.pair.toUpperCase()]); assert.ok(s.has(t.filled) && s.has(t.exitT)); assert.ok(t.r0 > 0); }
  assert.ok(Object.values(M).every((v) => v.length <= 600));
});
