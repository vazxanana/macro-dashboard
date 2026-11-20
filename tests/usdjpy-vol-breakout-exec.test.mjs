// usdjpy-vol-breakout-exec: USD/JPY T1 at the demo's own ticks (research/edge/usdjpy-vol-breakout-exec). Offline.
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { queriesOf, brokerTrade, verdictOf, NEAR, COMM, FROM, TO } from '../research/edge/usdjpy-vol-breakout-exec/run.mjs';
import { FILLS_MAX, FILLS_SPAN, MARKS_MAX } from '../council/tick-probe.mjs';

const DIR = new URL('../research/edge/usdjpy-vol-breakout-exec/', import.meta.url);

test('usdjpy exec: the pre-registered window, margin and commission; each probe file within the probe\'s limits', () => {
  assert.equal(FROM, '2023-11-24'); assert.equal(TO, '2026-11-19'); assert.equal(NEAR, 0.05); assert.equal(COMM * 2, 0.000045);
  for (const f of ['queries-a.json', 'queries-b.json']) {
    const q = JSON.parse(fs.readFileSync(new URL(f, DIR), 'utf8'));
    assert.ok(q.USDJPY.length > 0 && q.USDJPY.length <= MARKS_MAX, f); assert.ok(q.fills.USDJPY.length <= FILLS_MAX, f);
    for (const [, t0, t1] of q.fills.USDJPY) assert.ok(t1 > t0 && t1 - t0 <= FILLS_SPAN, f);
  }
});

test('usdjpy exec: queries and the broker trade (fill on the ask, stop on the bid for a buy; commission in R)', () => {
  const tr = { day: '2025-01-06', d0: 1736121600, side: 1, open: 157, up: 157.5, dn: 156.5, fillT: 1736121600 + 3600 };
  const bars = [{ t: tr.fillT, l: 157.4, h: 157.6 }, { t: tr.fillT + 300, l: 157.03, h: 157.3 }, { t: tr.fillT + 600, l: 157.2, h: 157.4 }];
  const q = queriesOf(tr, bars); assert.equal(q[0][0], '2025-01-06|e'); assert.equal(q[0][3], 157.5); assert.equal(q.length, 2, 'one stop window: the candle within NEAR of O');
  const F = new Map([['2025-01-06|e', ['2025-01-06|e', 1, 157.49, 157.51]], ['2025-01-06|s0', ['2025-01-06|s0', null]]]);
  const b = brokerTrade(tr, F, [157.8, 157.82]); assert.equal(b.how, 'time'); assert.ok(Math.abs(b.R - (157.8 - 157.51) / 0.5) < 1e-9);
  assert.ok(Math.abs(b.net - (b.R - 2 * COMM * 157.51 / 0.5)) < 1e-12);
  F.set('2025-01-06|s0', ['2025-01-06|s0', 2, 156.99, 157.01]); assert.equal(brokerTrade(tr, F, null).how, 'stop');
  assert.equal(brokerTrade(tr, new Map([['2025-01-06|e', ['2025-01-06|e', null]]]), null).filled, false);
  assert.equal(verdictOf({ n: 200, net: 1, monthT: 5 }), 'TOO FEW (200 filled)'); assert.equal(verdictOf({ n: 400, net: 0.1, monthT: 2.1 }), 'PASS'); assert.equal(verdictOf({ n: 400, net: 0.1, monthT: 1.9 }), 'FAIL');
});
