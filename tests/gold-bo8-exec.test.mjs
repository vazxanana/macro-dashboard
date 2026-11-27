import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { entryOf, tickOrder, verdictOf, RR, N_MIN, SYM, COMM } from '../research/edge/gold-bo8-exec/run.mjs';
import { G, FROM, TO, finR } from '../research/edge/gold-bo8-exec/orders.mjs';
import { nights, FIN } from '../council/fills.mjs';
const D = 'research/edge/gold-bo8-exec/';
test('pre-registration names the rule, the test and the bars', () => {
  const p = fs.readFileSync(D + 'PREREGISTRATION.md', 'utf8');
  for (const w of ['282 orders', 'month t >= 2', 'at least 100', 'one run', 'commission', 'financing', 'xau|bo8any|long|none|0.75|6']) assert.ok(p.toLowerCase().includes(w.toLowerCase()), w);
  assert.deepEqual(G, { mk: 'xau', trig: [{ kind: 'bo', P: 8, bo: 'any' }], side: 'long', hours: null, dows: null, trend: 'none', vol: 'none', volP: 0.7, stop: 0.75, rr: 6, hold: 24 });
  assert.equal(RR, 6); assert.equal(N_MIN, 100); assert.equal(SYM, 'XAUUSD'); assert.equal(COMM, 0.000024); assert.ok(FROM < TO);
});
test('the orders: every buy has its stop under the entry and its target 6R above, ids in order', () => {
  const O = JSON.parse(fs.readFileSync(D + 'orders-XAUUSD.json', 'utf8'));
  assert.equal(O.length, 282);
  for (const o of O) { assert.equal(o.side, 1); assert.ok(o.stop < o.fillM && o.tgt > o.fillM); assert.ok(Math.abs((o.tgt - o.fillM) - 6 * (o.fillM - o.stop)) < 1e-6); assert.ok(o.ts >= FROM && o.ts < TO); }
});
test('a buy fills at the ask; the stop books at the bid tick; financing is charged per rollover held', () => {
  const o = { id: 'g0', ts: 1764000000, deadEnd: 1764000000 + 86400, side: 1, D: 5, fillM: 3600, ns: 1, nt: 1 };
  const M = new Map([[o.ts, [o.ts, 3600, 3600.2, 5]]]), MD = new Map([[o.deadEnd, [o.deadEnd, 3610, 3610.2, 5]]]);
  assert.equal(entryOf(o, M).A, 3600.2);
  const stop = tickOrder(o, new Map([['g0|s0', ['g0|s0', (o.ts + 600) * 1000, 3594.9, 3595.1]], ['g0|t0', ['g0|t0', null]]]), M, MD);
  assert.equal(stop.ex, 'stop'); assert.ok(stop.R < -1); assert.equal(stop.fin, 0, 'no rollover in ten minutes');
  const time = tickOrder(o, new Map([['g0|s0', ['g0|s0', null]], ['g0|t0', ['g0|t0', null]]]), M, MD);
  assert.equal(time.ex, 'time'); const n = nights(o.ts, o.deadEnd); assert.ok(n >= 1);
  assert.ok(Math.abs(time.fin - (n * FIN.xau.long * 3600) / 5) < 1e-9);
  assert.ok(Math.abs(time.net - (time.R - (2 * COMM * 3600.2) / 5 - time.fin)) < 1e-9);
  assert.equal(finR(o, o.ts), 0);
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
  assert.equal(R.primary.orders, 282); assert.equal(R.primary.entryUnresolved, 2); assert.equal(R.primary.exitUnresolved, 0);
  assert.ok(R.primary.net.n === 280 && R.primary.net.mean > 0.7 && R.primary.net.monthT >= 4);
  assert.match(m, /Not an edge/); assert.match(m, /4 million looks/); assert.match(m, /not a finding/);
});
