// research/edge/gold-vol-breakout-exec: spans, the stop windows and the broker-priced trade (offline, made-up ticks).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { spans, queriesOf, brokerTrade, SPAN } from '../research/edge/gold-vol-breakout-exec/run.mjs';

test('spans merge consecutive candles up to SPAN seconds', () => {
  assert.deepEqual(spans([0, 300, 600, 1200]), [[0, 900], [1200, 1500]]);
  const many = Array.from({ length: 10 }, (_, k) => k * 300); assert.ok(spans(many).every(([a, b]) => b - a <= SPAN));
});

const tr = { day: '2026-01-05', d0: 0, side: 1, open: 100, up: 102, dn: 98, fillT: 3600 };
test('queries: the entry crossing and the stop windows near the open', () => {
  const bars = [{ t: 3600, l: 101, h: 103 }, { t: 3900, l: 100.4, h: 101 }, { t: 4200, l: 101.5, h: 102 }, { t: 9000, l: 99.9, h: 101 }];
  const q = queriesOf(tr, bars);
  assert.deepEqual(q[0], ['2026-01-05|e', 3600, 4200, 102, 1]);
  assert.deepEqual(q.slice(1).map((x) => [x[1], x[2], x[3], x[4]]), [[3900, 4200, 100, -1], [9000, 9300, 100, -1]]);
});

test('broker trade: fill at the ask, the earliest stop after the entry, else the 21:00 bid', () => {
  const F = new Map([['2026-01-05|e', ['e', 3700e3, 102.0, 102.1]], ['2026-01-05|s0', ['s0', 3500e3, 99.9, 100]], ['2026-01-05|s1', ['s1', 9100e3, 99.8, 99.9]]]);
  const b = brokerTrade(tr, F, [104, 104.1]);
  assert.equal(b.how, 'stop'); assert.equal(b.fill, 102.1); assert.equal(b.exit, 99.8); assert.ok(Math.abs(b.slipE - 0.1) < 1e-9); assert.ok(Math.abs(b.R - (99.8 - 102.1) / 2) < 1e-9);
  const t = brokerTrade(tr, new Map([['2026-01-05|e', ['e', 3700e3, 102, 102.05]]]), [104, 104.1]); assert.equal(t.how, 'time'); assert.equal(t.exit, 104);
  assert.deepEqual(brokerTrade(tr, new Map([['2026-01-05|e', ['e', null]]]), null), { filled: false, R: 0, net: 0 });
});
