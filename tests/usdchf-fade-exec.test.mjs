import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { entryOf, tickOrder, verdictOf, overRoll, inBand, RR, N_MIN, SYM } from '../research/edge/usdchf-fade-exec/run.mjs';
import { G, FROM, TO } from '../research/edge/usdchf-fade-exec/orders.mjs';
const D = 'research/edge/usdchf-fade-exec/';
test('pre-registration names the rule, the test and the bars', () => {
  const p = fs.readFileSync(D + 'PREREGISTRATION.md', 'utf8');
  for (const w of ['127 orders', 'month t >= 2', 'at least 100', 'one run', 'commission', 'closing side']) assert.ok(p.toLowerCase().includes(w.toLowerCase()), w);
  assert.deepEqual(G, { mk: 'usdchf', trig: [{ kind: 'fade', N: 5 }], side: 'short', hours: [20, 23], dows: null, trend: 'none', vol: 'none', volP: 0.7, stop: 0.75, rr: 1, hold: 12 }); assert.equal(RR, 1); assert.equal(N_MIN, 100); assert.equal(SYM, 'USDCHF');
  assert.ok(FROM < TO);
});
test('entry fills at the ask for a buy and the bid for a sell; no quote is unresolved', () => {
  const M = new Map([[100, [100, 0.9, 0.9002, 5]]]);
  assert.equal(entryOf({ ts: 100, side: 1 }, M).A, 0.9002); assert.equal(entryOf({ ts: 100, side: -1 }, M).A, 0.9);
  assert.equal(entryOf({ ts: 101, side: 1 }, M), null);
  assert.equal(entryOf({ ts: 100, side: 1 }, new Map([[100, [100, 0.9, 0.9002, 99]]])), null);
});
test('a stop on the closing side books at the tick, a target at its level, else the deadline quote', () => {
  const o = { id: 'c0', ts: 100, deadEnd: 400, side: 1, D: 0.001, fillM: 0.9, ns: 1, nt: 1 };
  const M = new Map([[100, [100, 0.9, 0.9002, 5]]]), MD = new Map([[400, [400, 0.8995, 0.8997, 5]]]);
  const stop = tickOrder(o, new Map([['c0|s0', ['c0|s0', 150000, 0.8990, 0.8992]], ['c0|t0', ['c0|t0', null]]]), M, MD);
  assert.equal(stop.ex, 'stop'); assert.ok(stop.R < -1);
  const tgt = tickOrder(o, new Map([['c0|s0', ['c0|s0', null]], ['c0|t0', ['c0|t0', 150000, 0.9008, 0.901]]]), M, MD);
  assert.equal(tgt.ex, 'target'); assert.ok(Math.abs(tgt.R - 0.5) < 1e-9);
  const time = tickOrder(o, new Map([['c0|s0', ['c0|s0', null]], ['c0|t0', ['c0|t0', null]]]), M, MD);
  assert.equal(time.ex, 'time'); assert.ok(Math.abs(time.px - 0.8995) < 1e-12);
});
test('verdict rules and rollover helpers', () => {
  assert.equal(verdictOf({ unresolvedShare: 0.2, net: { n: 200, mean: 1, monthT: 3 } }), 'INCONCLUSIVE');
  assert.equal(verdictOf({ unresolvedShare: 0, net: { n: 100, mean: 1, monthT: 3 } }), 'TOO FEW');
  assert.equal(verdictOf({ unresolvedShare: 0, net: { n: 127, mean: 0.1, monthT: 1.9 } }), 'FAIL');
  assert.equal(verdictOf({ unresolvedShare: 0, net: { n: 127, mean: 0.2, monthT: 2.1 } }), 'PASS');
  assert.ok(inBand(21 * 3600) && !inBand(19 * 3600));
  assert.ok(overRoll(20 * 3600, 24 * 3600) && !overRoll(10 * 3600, 14 * 3600));
});
