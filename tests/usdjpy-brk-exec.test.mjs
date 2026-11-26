import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { entryOf, tickOrder, verdictOf, overRoll, inBand, RR, N_MIN, SYM } from '../research/edge/usdjpy-brk-exec/run.mjs';
import { G, FROM, TO } from '../research/edge/usdjpy-brk-exec/orders.mjs';
const D = 'research/edge/usdjpy-brk-exec/';
const R = JSON.parse(fs.readFileSync(D + 'result.json', 'utf8'));
test('pre-registration names the rule, the test and the bars', () => {
  const p = fs.readFileSync(D + 'PREREGISTRATION.md', 'utf8');
  for (const w of ['131 orders', 'month t >= 2', 'at least 100', 'one run', 'commission', 'closing side']) assert.ok(p.toLowerCase().includes(w.toLowerCase()), w);
  assert.deepEqual(G, { mk: 'usdjpy', trig: [{ kind: 'brk', N: 10 }], side: 'long', hours: [7, 13], dows: [2, 3, 4], trend: 'with', vol: 'none', volP: 0.5, stop: 3, rr: 3, hold: 8 }); assert.equal(RR, 3); assert.equal(N_MIN, 100); assert.equal(SYM, 'USDJPY');
  assert.ok(FROM < TO);
});
test('entry fills at the ask for a buy and the bid for a sell; no quote is unresolved', () => {
  const M = new Map([[100, [100, 0.9, 0.9002, 5]]]);
  assert.equal(entryOf({ ts: 100, side: 1 }, M).A, 0.9002); assert.equal(entryOf({ ts: 100, side: -1 }, M).A, 0.9);
  assert.equal(entryOf({ ts: 101, side: 1 }, M), null);
  assert.equal(entryOf({ ts: 100, side: 1 }, new Map([[100, [100, 0.9, 0.9002, 99]]])), null);
});
test('a stop on the closing side books at the tick, a target at its level, else the deadline quote (a buy)', () => {
  const o = { id: 'j0', ts: 100, deadEnd: 400, side: 1, D: 0.5, fillM: 150, ns: 1, nt: 1 };
  const M = new Map([[100, [100, 150, 150.01, 5]]]), MD = new Map([[400, [400, 150.3, 150.31, 5]]]);
  const stop = tickOrder(o, new Map([['j0|s0', ['j0|s0', 150000, 149.49, 149.5]], ['j0|t0', ['j0|t0', null]]]), M, MD);
  assert.equal(stop.ex, 'stop'); assert.ok(stop.R < -1);
  const tgt = tickOrder(o, new Map([['j0|s0', ['j0|s0', null]], ['j0|t0', ['j0|t0', 150000, 151.52, 151.53]]]), M, MD);
  assert.equal(tgt.ex, 'target'); assert.ok(Math.abs(tgt.R - 3) < 1e-9);
  const time = tickOrder(o, new Map([['j0|s0', ['j0|s0', null]], ['j0|t0', ['j0|t0', null]]]), M, MD);
  assert.equal(time.ex, 'time'); assert.ok(Math.abs(time.px - 150.3) < 1e-12);
});
test('verdict rules and rollover helpers', () => {
  assert.equal(verdictOf({ unresolvedShare: 0.2, net: { n: 200, mean: 1, monthT: 3 } }), 'INCONCLUSIVE');
  assert.equal(verdictOf({ unresolvedShare: 0, net: { n: 99, mean: 1, monthT: 3 } }), 'TOO FEW');
  assert.equal(verdictOf({ unresolvedShare: 0, net: { n: 127, mean: 0.1, monthT: 1.9 } }), 'FAIL');
  assert.equal(verdictOf({ unresolvedShare: 0, net: { n: 127, mean: 0.2, monthT: 2.1 } }), 'PASS');
  assert.ok(inBand(21 * 3600) && !inBand(19 * 3600));
  assert.ok(overRoll(20 * 3600, 24 * 3600) && !overRoll(10 * 3600, 14 * 3600));
});
test('result: PASS as pre-registered, every order quoted and resolved, the broker fill equals the mid result', () => {
  const md = fs.readFileSync(D + 'RESULT.md', 'utf8').split('\n');
  assert.match(md[2], /^\*\*Verdict: PASS\./);
  assert.equal(R.primary.orders, 131); assert.equal(R.primary.entryUnresolved, 0); assert.equal(R.primary.exitUnresolved, 0);
  assert.ok(R.primary.net.n === 131 && R.primary.net.mean > 0.2 && R.primary.net.monthT >= 2 && Math.abs(R.primary.net.mean - R.primary.mid.mean) < 0.02);
  const m = fs.readFileSync(D + 'RESULT.md', 'utf8'); assert.ok(m.includes('## What it means')); assert.match(m, /Not an edge/); assert.match(m, /Holm p 0\.067/);
});
