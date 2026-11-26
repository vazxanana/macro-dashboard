import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { entryOf, tickOrder, verdictOf, nights, holm, inBand, SYM, N_MIN, UNRES_MAX, SWAP_LONG, W, W_BREAK, W_DAY } from '../research/edge/nq1-leads-exec/run.mjs';
import { LEADS, FROM, TO } from '../research/edge/nq1-leads-exec/orders.mjs';
const D = 'research/edge/nq1-leads-exec/';
const R = JSON.parse(fs.readFileSync(D + 'result.json', 'utf8'));
test('pre-registration names the rules, the bar and the amendment', () => {
  const p = fs.readFileSync(D + 'PREREGISTRATION.md', 'utf8').toLowerCase();
  for (const w of ['2,386', 'holm', 'financing', 'amendment']) assert.ok(p.includes(w), w);
  assert.deepEqual(LEADS.map((l) => l.id), ['l1', 'l2', 'l3', 'l4', 'l5', 'l6']);
  assert.equal(SYM, 'NAS100'); assert.equal(N_MIN, 100); assert.equal(UNRES_MAX, 0.1); assert.equal(SWAP_LONG, 0.62);
  assert.deepEqual([W, W_BREAK, W_DAY], [10, 25, 1]); assert.ok(FROM < TO);
});
test('entry at the ask for a buy, with the broker basis; a stale quote is no entry', () => {
  const M = new Map([[100, [100, 20000, 20000.8, 5]]]);
  const e = entryOf({ ts: 100, side: 1, fillM: 20016 }, M);
  assert.equal(e.A, 20000.8); assert.ok(Math.abs(e.b0 + 15.6) < 1e-9);
  assert.equal(entryOf({ ts: 100, side: -1, fillM: 20016 }, M).A, 20000);
  assert.equal(entryOf({ ts: 100, side: 1, fillM: 1 }, new Map([[100, [100, 1, 2, 99]]])), null);
});
test('stop books at the closing-side tick, target at its level, else the time-limit quote; financing on a buy', () => {
  const o = { id: 'a', ts: 100, deadEnd: 400, side: 1, D: 100, rr: 4, fillM: 20000, ns: 1, nt: 1 };
  const M = new Map([[100, [100, 20000, 20001, 5]]]), MD = new Map([[400, [400, 20050, 20051, 5]]]);
  const st = tickOrder(o, new Map([['a|s0', ['a|s0', 150000, 19899, 19900]], ['a|t0', ['a|t0', null]]]), M, MD);
  assert.equal(st.ex, 'stop'); assert.ok(st.R < -1);
  const tg = tickOrder(o, new Map([['a|s0', ['a|s0', null]], ['a|t0', ['a|t0', 150000, 20401, 20402]]]), M, MD);
  assert.equal(tg.ex, 'target'); assert.ok(Math.abs(tg.R - 4) < 1e-9);
  const tm = tickOrder(o, new Map([['a|s0', ['a|s0', null]], ['a|t0', ['a|t0', null]]]), M, MD);
  assert.equal(tm.ex, 'time'); assert.equal(tm.px, 20050);
  assert.equal(tickOrder(o, new Map(), M, MD).exitUnresolved, 'window not read');
  const mon = Date.UTC(2026, 10, 16, 20) / 1000;
  assert.equal(nights(mon, mon + 3 * 3600), 1); assert.equal(nights(mon + 4 * 86400, mon + 4 * 86400 + 3 * 3600), 3);
});
test('verdict rules, Holm and the daily break', () => {
  assert.equal(verdictOf({ unresolvedShare: 0.2, net: { n: 200, mean: 1, monthT: 3 } }, 0.01), 'INCONCLUSIVE');
  assert.equal(verdictOf({ unresolvedShare: 0, net: { n: 99, mean: 1, monthT: 3 } }, 0.01), 'TOO FEW');
  assert.equal(verdictOf({ unresolvedShare: 0, net: { n: 300, mean: 0.2, monthT: 2.5 } }, 0.06), 'FAIL');
  assert.equal(verdictOf({ unresolvedShare: 0, net: { n: 300, mean: 0.2, monthT: 2.5 } }, 0.01), 'PASS');
  assert.deepEqual(holm([0.01, 0.04, 0.03]), [0.03, 0.06, 0.06]);
  assert.ok(inBand(21 * 3600) && !inBand(15 * 3600));
});
test('result: 2 of 6 pass, every rule positive at the broker, and the report says what that does not show', () => {
  const md = fs.readFileSync(D + 'RESULT.md', 'utf8');
  assert.match(md.split('\n')[2], /^\*\*Verdict: 2 of 6 pass \(l1, l5\)/);
  assert.equal(R.rules.length, 6); assert.equal(R.rules.reduce((a, r) => a + r.stats.orders, 0), 2386);
  for (const r of R.rules) { assert.ok(r.stats.net.mean > 0, r.id); assert.equal(r.stats.exitUnresolved, 0); }
  assert.deepEqual(R.rules.filter((r) => r.verdict === 'PASS').map((r) => r.id), ['l1', 'l5']);
  assert.ok(md.includes('## What it means') && md.includes('never an edge') && md.includes('not new evidence'));
});
