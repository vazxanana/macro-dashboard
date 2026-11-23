// dom-tick-exec: the tick evaluation on hand-made probe answers (offline). The result itself is pinned once RESULT.md exists.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { tickOrder, spans, sample, C } from '../research/edge/dom-tick-exec/run.mjs';

const HERE = new URL('../research/edge/dom-tick-exec/', import.meta.url);
const ms = (s) => s * 1000;

test('a sell order\'s target is below its entry (the 23 Nov fix), in every stored order', () => {
  for (const sym of ['XAUUSD', 'USDJPY']) {
    const O = JSON.parse(fs.readFileSync(new URL(`orders-${sym}.json`, HERE), 'utf8'));
    assert.equal(O.length, 1200);
    for (const o of O) {
      assert.ok(o.side * (o.L - o.S) > 0, `${o.id}: stop on the losing side`);
      assert.ok(Math.abs(o.T - (o.L + 2 * (o.L - o.S))) < 1e-9, `${o.id}: target = L + 2 x (L - S)`);
      assert.ok(o.side * (o.T - o.L) > 0, `${o.id}: target on the winning side`);
    }
  }
});

test('the query files ask only for corrected target ids (|u) and no wrong ones (|t)', () => {
  for (const f of fs.readdirSync(HERE).filter((x) => /^(fills|batch-c)/.test(x))) {
    const j = JSON.parse(fs.readFileSync(new URL(f, HERE), 'utf8'));
    for (const list of Object.values(j.fills)) for (const q of list) assert.ok(!/\|t\d+$/.test(q[0]), `${f}: ${q[0]}`);
  }
});

const buy = { id: 'b', side: 1, L: 100, S: 99, T: 102, ts: 1000, deadEnd: 1000 + 86400, mark: null };
const sell = { id: 's', side: -1, L: 100, S: 101, T: 98, ts: 1000, deadEnd: 1000 + 86400, mark: null };

test('a buy filled through its level: R is measured from the fill against the planned risk', () => {
  const F = new Map([
    ['b|e0', ['b|e0', ms(1100), 99.9, 99.95]], ['b|e1', ['b|e1', ms(1100), 99.7, 99.8]],
    ['b|s0', ['b|s0', ms(1500), 98.98, 99.1]],
  ]);
  const r = tickOrder(buy, 'XAUUSD', F, new Map());
  assert.equal(r.ex, 'stop'); assert.equal(r.how, 'through'); assert.ok(Math.abs(r.R - (98.98 - 99.95)) < 1e-9); // the ask filled 0.05 better than the limit
  F.set('b|u0', ['b|u0', ms(1400), 102.05, 102.25]);
  const w = tickOrder(buy, 'XAUUSD', F, new Map());
  assert.equal(w.ex, 'target'); assert.ok(Math.abs(w.R - (102 - 99.95) / 1) < 1e-9);
});

test('a sell at its target scores +2R off its fill (the bug scored -2R)', () => {
  const F = new Map([
    ['s|e0', ['s|e0', ms(1100), 100.0, 100.1]], ['s|e1', ['s|e1', ms(1100), 100.2, 100.3]],
    ['s|u0', ['s|u0', ms(1600), 97.9, 97.95]],
  ]);
  const r = tickOrder(sell, 'XAUUSD', F, new Map());
  assert.equal(r.ex, 'target'); assert.ok(Math.abs(r.R - 2) < 1e-9);
});

test('a target tick before the fill does not count, an old |t answer is never read', () => {
  const F = new Map([
    ['s|e0', ['s|e0', ms(1100), 100.0, 100.1]], ['s|e1', ['s|e1', ms(1100), 100.2, 100.3]],
    ['s|u0', ['s|u0', ms(1050), 97.9, 97.95]], ['s|t0', ['s|t0', ms(1200), 103, 103.1]],
  ]);
  const r = tickOrder(sell, 'XAUUSD', F, new Map());
  assert.equal(r.filled, true); assert.equal(r.unresolvedExit, true);
});

test('no touch, and a touch whose ask never reached a buy limit, are not fills', () => {
  assert.equal(tickOrder(buy, 'XAUUSD', new Map([['b|e0', ['b|e0', null]], ['b|e1', ['b|e1', null]]]), new Map()).why, 'no touch');
  const r = tickOrder(buy, 'XAUUSD', new Map([['b|e0', ['b|e0', ms(1100), 99.95, 100.15]], ['b|e1', ['b|e1', null]]]), new Map());
  assert.equal(r.filled, false); assert.equal(r.unresolvedFill, true);
});

test('helpers: spans join neighbouring candles into 30-minute windows; the sample is seeded', () => {
  const w = spans([0, 300, 600, 3600]);
  assert.ok(w.length >= 2); for (const [a, b] of w) assert.ok(b - a <= 1800 && b > a);
  const L = Array.from({ length: 50 }, (_, i) => ({ ts: i }));
  assert.deepEqual(sample(L, 10, 7), sample(L, 10, 7));
  assert.ok(C.XAUUSD > 0 && C.USDJPY > 0);
});
