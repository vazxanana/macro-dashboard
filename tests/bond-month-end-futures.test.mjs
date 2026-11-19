// The bond month-end rule at Treasury futures cost: the frozen copy of #939's code, the cost conversion on a hand-made trade,
// the verdict logic, and the report against result.json. Offline.
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import crypto from 'node:crypto';
import { roundTripPts, costR, futNet, verdictOf, CONTRACTS } from '../research/edge/bond-month-end-futures/run.mjs';

const DIR = new URL('../research/edge/bond-month-end-futures/', import.meta.url);
const R = JSON.parse(fs.readFileSync(new URL('result.json', DIR), 'utf8'));
const MD = fs.readFileSync(new URL('RESULT.md', DIR), 'utf8');
const f3 = (x) => (x > 0 ? '+' : x < 0 ? '-' : '') + Math.abs(x).toFixed(3);

test('frozen.mjs is #939 run.mjs byte for byte', () => {
  const h = crypto.createHash('sha256').update(fs.readFileSync(new URL('frozen.mjs', DIR))).digest('hex');
  assert.equal(h, '624ac805a9b361949906bf5e0c94e576433d2d019e2e3470f9b57f5d8f630144');
  assert.equal(R.gate.frozenSha256, h);
});

test('the gate passed: frozen rows, tests block and placebo means reproduced', () => {
  assert.equal(R.gate.pass, true);
  for (const v of [R.gate.g1.usb10y, R.gate.g1.usb30y, R.gate.g1.tests, R.gate.g2.usb10y, R.gate.g2.usb30y]) assert.equal(v, true);
  assert.deepEqual([R.gate.published.T1.net, R.gate.published.T1.t, R.gate.published.T1.gross], [0.036, 0.77, 0.107]);
  assert.deepEqual([R.gate.published.T2.net, R.gate.published.T2.t, R.gate.published.T2.gross], [0.015, 0.32, 0.061]);
});

test('cost conversion on a hand-made trade', () => {
  // ZN: one tick 1/64 + 2 x ($1.00 + $0.85) / $1,000 a point = 0.015625 + 0.0037
  assert.ok(Math.abs(roundTripPts('usb10y') - 0.019325) < 1e-12);
  assert.ok(Math.abs(roundTripPts('usb30y') - 0.03495) < 1e-12);
  assert.ok(Math.abs(roundTripPts('usb10y', 2) - 0.03865) < 1e-12);
  assert.equal(CONTRACTS.usb10y.root, 'ZN'); assert.equal(CONTRACTS.usb30y.root, 'ZB');
  const t = { entryD: '2020-03-26', gross: 0.5, dist: 0.5 };              // stop 0.5 pt under the entry
  assert.ok(Math.abs(costR('usb10y', t) - 0.03865) < 1e-12);
  assert.ok(Math.abs(futNet('usb10y', t) - 0.46135) < 1e-12);           // no financing line
  assert.ok(Math.abs(futNet('usb10y', t, 0) - 0.5) < 1e-12);
  assert.ok(Math.abs(futNet('usb10y', t, 1, true) - 0.46135) < 1e-12);  // March: no roll charge
  const may = { ...t, entryD: '2020-05-26' };
  assert.ok(Math.abs(futNet('usb10y', may, 1, true) - (0.5 - 2 * 0.03865)) < 1e-12);
});

test('verdict logic: all five checks, Holm over two', () => {
  const m = (t, net, rep, mean, p95) => ({ test: 'T', key: 'k', contract: 'C', decisive: { net, t }, replication: { net: rep }, placebo: { ruleMean: mean, p95 } });
  const V = verdictOf({ usb10y: m(3, 0.1, 0.05, 0.1, 0), usb30y: m(1.91, 0.1, 0.05, 0.1, 0) });
  assert.equal(V.tests[0].pass, true); assert.equal(V.tests[1].pass, false);
  assert.equal(V.verdict, 'PASSES AT FUTURES COST');
  assert.equal(verdictOf({ usb10y: m(3, 0.1, -0.01, 0.1, 0), usb30y: m(3, 0.1, 0.05, 0.1, 0.2) }).verdict, 'FAILS AT FUTURES COST');
});

test('the report says what result.json says', () => {
  assert.equal(R.verdict, 'FAILS AT FUTURES COST'); assert.equal(R.passed, 0);
  assert.ok(MD.startsWith('# Result') && MD.includes(`**Verdict: ${R.verdict}, ${R.passed} of 2 tests.**`));
  for (const k of ['usb10y', 'usb30y']) {
    const x = R.markets[k], T = R.tests.find((t) => t.market === k);
    const line = MD.split('\n').find((l) => l.startsWith(`| ${x.test} | ${x.contract} |`));
    assert.ok(line, x.test);
    for (const s of [String(x.decisive.n), f3(x.decisive.gross), f3(x.decisive.net), x.decisive.t.toFixed(2), f3(x.decisive.cfdNet),
      String(x.replication.n), f3(x.replication.net), x.replication.t.toFixed(2), f3(x.placebo.p95), `${x.placebo.beaten} / 40`, T.holmP.toFixed(3)])
      assert.ok(line.includes(s), `${x.test} ${s} in ${line}`);
    for (const m of ['x0', 'x1', 'x2']) assert.ok(MD.includes(`${f3(x.cost[m].decisive.net)}, t ${x.cost[m].decisive.t.toFixed(2)}`));
    assert.ok(MD.includes(`${f3(x.rollExtra.decisive.net)}, t ${x.rollExtra.decisive.t.toFixed(2)}`));
    assert.ok(MD.includes(x.roundTripPts.toFixed(4)));
  }
  assert.match(MD, /nothing here is\s+tradable\s+on\s+the\s+current\s+account/); assert.match(MD, /Not tradable on what the desk has/);
});
