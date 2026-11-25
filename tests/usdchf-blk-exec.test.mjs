import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { entryOf, tickOrder, verdictOf, overRoll, inBand, RR, N_MIN } from '../research/edge/usdchf-blk-exec/run.mjs';
import { RULE, FROM, TO } from '../research/edge/usdchf-blk-exec/orders.mjs';
const D = 'research/edge/usdchf-blk-exec/';
const R = JSON.parse(fs.readFileSync(D + 'result.json', 'utf8'));
test('pre-registration names the rule, the test and the bars', () => {
  const p = fs.readFileSync(D + 'PREREGISTRATION.md', 'utf8');
  for (const w of ['185 orders', 'month t >= 2', 'at least 150', 'one run', 'commission', 'closing side']) assert.ok(p.toLowerCase().includes(w.toLowerCase()), w);
  assert.deepEqual(RULE, { at: 19, H: 3, stop: 1, rr: 0.5, hold: 4 }); assert.equal(RR, 0.5); assert.equal(N_MIN, 150);
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
  assert.equal(verdictOf({ unresolvedShare: 0, net: { n: 185, mean: 0.1, monthT: 1.9 } }), 'FAIL');
  assert.equal(verdictOf({ unresolvedShare: 0, net: { n: 185, mean: 0.2, monthT: 2.1 } }), 'PASS');
  assert.ok(inBand(21 * 3600) && !inBand(19 * 3600));
  assert.ok(overRoll(20 * 3600, 24 * 3600) && !overRoll(10 * 3600, 14 * 3600));
});
test('result: FAIL at the broker, mid positive, every order resolved', () => {
  const md = fs.readFileSync(D + 'RESULT.md', 'utf8').split('\n');
  assert.match(md[2], /^\*\*Verdict: FAIL\./);
  assert.equal(R.primary.orders, 185); assert.equal(R.primary.entryUnresolved, 0); assert.equal(R.primary.exitUnresolved, 0);
  assert.ok(R.primary.mid.mean > 0.07 && R.primary.net.mean < 0.02);
  assert.ok(fs.readFileSync(D + 'RESULT.md', 'utf8').includes('## What it means'));
});
