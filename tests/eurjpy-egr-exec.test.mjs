import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { entryOf, tickOrder, verdictOf, RR, N_MIN, SYM, COMM } from '../research/edge/eurjpy-egr-exec/run.mjs';
import { G, G2, FROM, TO, SWAP_SHORT, finR } from '../research/edge/eurjpy-egr-exec/orders.mjs';
import { nights } from '../council/fills.mjs';
const D = 'research/edge/eurjpy-egr-exec/';
test('pre-registration names the rule, the test and the bars', () => {
  const p = fs.readFileSync(D + 'PREREGISTRATION.md', 'utf8');
  for (const w of ['106 orders', 'month t >= 2', 'at least 100', 'one run', 'commission', 'swap', 'eurjpy|egr48|short|none|0.75|1.5']) assert.ok(p.toLowerCase().includes(w.toLowerCase()), w);
  assert.deepEqual(G, { mk: 'eurjpy', trig: [{ kind: 'egr', life: 48 }], side: 'short', hours: [10, 16], dows: null, trend: 'none', vol: 'high', volP: 0.7, stop: 0.75, rr: 1.5, hold: 24 });
  assert.equal(G2.trig[0].life, 12); assert.equal(RR, 1.5); assert.equal(N_MIN, 100); assert.equal(SYM, 'EURJPY'); assert.equal(COMM, 0.000045);
  assert.ok(Math.abs(SWAP_SHORT - 0.01007) < 1e-12); assert.ok(FROM < TO);
});
test('the orders: every sell has its stop above the entry and its target 1.5R below', () => {
  const O = JSON.parse(fs.readFileSync(D + 'orders-EURJPY.json', 'utf8'));
  assert.equal(O.filter((o) => o.lead === 1).length, 106); assert.equal(O.filter((o) => o.lead === 2).length, 176);
  for (const o of O) { assert.equal(o.side, -1); assert.ok(o.stop > o.fillM && o.tgt < o.fillM); assert.ok(Math.abs((o.fillM - o.tgt) - 1.5 * (o.stop - o.fillM)) < 1e-9); assert.ok(o.ts >= FROM && o.ts < TO); }
});
test('a sell fills at the bid; the stop books at the ask tick; the swap is charged per rollover held', () => {
  const o = { id: 'j0', ts: 1764000000, deadEnd: 1764000000 + 86400, side: -1, D: 0.2, fillM: 180, ns: 1, nt: 1 };
  const M = new Map([[o.ts, [o.ts, 180, 180.01, 5]]]), MD = new Map([[o.deadEnd, [o.deadEnd, 179.9, 179.91, 5]]]);
  assert.equal(entryOf(o, M).A, 180);
  const stop = tickOrder(o, new Map([['j0|s0', ['j0|s0', (o.ts + 600) * 1000, 180.19, 180.21]], ['j0|t0', ['j0|t0', null]]]), M, MD);
  assert.equal(stop.ex, 'stop'); assert.ok(stop.R < -1); assert.equal(stop.fin, 0);
  const time = tickOrder(o, new Map([['j0|s0', ['j0|s0', null]], ['j0|t0', ['j0|t0', null]]]), M, MD);
  assert.equal(time.ex, 'time'); assert.ok(Math.abs(time.px - 179.91) < 1e-12);
  const n = nights(o.ts, o.deadEnd); assert.ok(n >= 1); assert.ok(Math.abs(time.fin - (n * SWAP_SHORT) / 0.2) < 1e-9);
  assert.ok(Math.abs(time.net - (time.R - (COMM * 180) / 0.2 - time.fin)) < 1e-9); assert.equal(finR(o, o.ts), 0);
});
test('verdict rules', () => {
  assert.equal(verdictOf({ unresolvedShare: 0.2, net: { n: 200, mean: 1, monthT: 3 } }), 'INCONCLUSIVE');
  assert.equal(verdictOf({ unresolvedShare: 0, net: { n: 99, mean: 1, monthT: 3 } }), 'TOO FEW');
  assert.equal(verdictOf({ unresolvedShare: 0, net: { n: 200, mean: 0.3, monthT: 1.9 } }), 'FAIL');
  assert.equal(verdictOf({ unresolvedShare: 0, net: { n: 200, mean: 0.4, monthT: 2.1 } }), 'PASS');
});
test('result: PASS as pre-registered, read with its caveats', () => {
  const R = JSON.parse(fs.readFileSync(D + 'result.json', 'utf8')), m = fs.readFileSync(D + 'RESULT.md', 'utf8');
  assert.match(m.split('\n')[2], /^\*\*Verdict: PASS\./);
  assert.equal(R.primary.orders, 106); assert.equal(R.primary.entryUnresolved, 0); assert.equal(R.primary.exitUnresolved, 0);
  assert.ok(R.primary.net.n === 106 && R.primary.net.mean > 0.4 && R.primary.net.monthT >= 4);
  assert.equal(R.lead2.orders, 176);
  assert.match(m, /not an edge/); assert.match(m, /1\.1 million/); assert.match(m, /not new evidence/);
});
