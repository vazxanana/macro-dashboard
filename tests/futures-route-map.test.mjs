// node --test tests/futures-route-map.test.mjs — research/edge/futures-route-map (accounting, no rule tested). Offline: reads the
// committed collected.json, result.json and RESULT.md; never needs another branch.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { CONTRACTS, futFrac, cfdFrac, tStat, monthT, monthRange, holm, bh, pOne, analyse, scaleOf } from '../research/edge/futures-route-map/run.mjs';

const DIR = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../research/edge/futures-route-map');
const J = JSON.parse(readFileSync(path.join(DIR, 'collected.json'), 'utf8'));
const R = JSON.parse(readFileSync(path.join(DIR, 'result.json'), 'utf8'));
const MD = readFileSync(path.join(DIR, 'RESULT.md'), 'utf8');
const near = (a, b, e = 1e-12) => assert.ok(Math.abs(a - b) <= e, `${a} vs ${b}`);

test('futures round trip: one tick a side and the fee a side, twice, as a fraction of price', () => {
  near(futFrac('spx500', 4000), (2 * (0.25 + 0.62 / 5)) / 4000);                 // MES
  near(futFrac('nas100', 20000), (2 * (0.25 + 0.62 / 2)) / 20000);               // MNQ
  near(futFrac('usb10y', 110), (2 * (0.015625 + 1.85 / 1000)) / 110);            // ZN: two ticks a round trip (one a side)
  near(futFrac('eurusd', 1.1), (2 * (0.00005 + 2.5 / 125000)) / 1.1);            // 6E, quoted the pair's way
  near(futFrac('usdjpy', 100), 2 * (0.0000005 + 2.5 / 12500000) * 100);          // 6J, quoted USD per JPY: the same fraction of price
  near(futFrac('usdcnh', 7), (2 * (0.0001 + (2.5 * 7) / 100000)) / 7);
  near(futFrac('xau', 2000), (2 * (0.1 + 1.06 / 10)) / 2000);                     // MGC, $2.12 a round trip
  near(futFrac('spx500', 4000, { feeMult: 0 }), 0.5 / 4000);
  assert.throws(() => futFrac('eurjpy', 160), /no route/);                        // crosses have no route
  assert.equal(CONTRACTS.nas100.root, 'MNQ'); assert.equal(CONTRACTS.usdjpy.root, '6J');
});

test('CFD round trip: the study\'s own transaction cost, never financing', () => {
  near(cfdFrac({ pips: 1.3, pip: 0.01, comm: 0.000045 }, 110), (1.3 * 0.01) / 110 + 0.000045);
  near(cfdFrac({ pts: 1.5 }, 15000), 1.5 / 15000);
  near(cfdFrac({ frac: 0.0004 }, 1), 0.0004);
});

test('statistics: t, month sums, Holm, BH, the scale rule', () => {
  near(tStat([1, 2, 3]), 2 / Math.sqrt(1 / 3));
  assert.deepEqual(monthRange('2025-11', '2026-02'), ['2025-11', '2025-12', '2026-01', '2026-02']);
  const rows = [['2026-01', 1], ['2026-01', 1], ['2026-03', 2]];
  assert.equal(monthT(rows, (r) => r[1]).months, 2);                                  // months with a trade
  assert.equal(monthT(rows, (r) => r[1], ['2026-01', '2026-03']).months, 3);          // every calendar month, empty = 0
  assert.deepEqual(holm([0.01, 0.04, 0.03]).map((x) => +x.toFixed(4)), [0.03, 0.06, 0.06]);
  assert.deepEqual(bh([0.01, 0.04, 0.03]).map((x) => +x.toFixed(4)), [0.03, 0.04, 0.04]);
  near(pOne(0), 0.5, 1e-7); assert.ok(Math.abs(pOne(1.96) - 0.025) < 1e-4);
  near(scaleOf({ gross: 0.2, net: 0.1, tGross: 4, tNet: 2 }), 0.05);
  near(scaleOf({ gross: 0.2, net: 0.1, tGross: null, tNet: 2 }), 0.05);
});

test('collected.json: the 43 tests of cost-floor-map plus the replicate pool, crosses have no route', () => {
  assert.equal(J.tests.length, 44);
  const cls = J.tests.map((t) => t.cls);
  assert.equal(cls.filter((c) => c === 'cost-blocked').length, 31); assert.equal(cls.filter((c) => c === 'net-t2').length, 12);
  assert.ok(J.tests.some((t) => t.topic === 'bond-month-end-replicate' && t.test === 'pool'));
  const none = J.tests.filter((t) => t.route === 'none');
  assert.equal(none.length, 7);
  for (const t of none) assert.ok(/cross/i.test(t.why), t.topic);
  for (const r of Object.values(J.refs)) assert.ok(r.median > 0 && r.days > 100, r.key);
});

test('every per-trade re-cost that kept its list reproduces the study\'s published figures (the gate)', () => {
  const A = analyse(JSON.parse(readFileSync(path.join(DIR, 'collected.json'), 'utf8')));
  const gated = A.rows.filter((r) => r.gate);
  assert.equal(gated.length, 10);
  const passed = gated.filter((r) => r.gate.pass).map((r) => `${r.topic} ${r.test}`).sort();
  assert.deepEqual(passed, ['bond-month-end USB10Y', 'bond-month-end-replicate pool', 'cb-days-other pooled five banks', 'index-ibs T2', 'index-overnight T1', 'index-overnight T2', 'pre-fomc-drift spx500']);
  for (const r of gated.filter((x) => !x.gate.pass)) { assert.match(r.method, /failed its gate/); assert.ok(r.gate.skipped > 0); }
  // and the analysis is what result.json holds
  assert.equal(A.verdict, R.verdict); assert.deepEqual(A.counts, R.counts);
});

test('the bar: Step A, Step B and the route-only count', () => {
  for (const r of R.rows) {
    if (r.route === 'none') { assert.equal(r.tFut, undefined); continue; }
    assert.equal(r.stepA, r.futNet > 0 && r.tFut >= 2, `${r.topic} ${r.test}`);
    if (r.wouldPass) { assert.ok(r.stepA); assert.ok(Object.values(r.stepB.conditions).every((v) => v === true)); }
  }
  const pass = R.rows.filter((r) => r.wouldPass).map((r) => `${r.topic} ${r.test}`).sort();
  assert.equal(pass.length, R.counts.wouldPass);
  assert.equal(R.rows.filter((r) => r.routeOnly).length, R.counts.routeOnly);
  // the major-pair fixes: a futures route is dearer than the studies' ECN assumption (USD/CNH's assumed 6-pip CFD spread is not)
  for (const r of R.rows.filter((x) => x.topic === 'wmr-fix-reversal' || x.topic === 'ecb-ref-fix')) assert.ok(r.futNet < r.cfdNet, r.test);   // majors: CME currency futures cost more than the ECN assumption
});

test('RESULT.md says what result.json says, and never calls anything an edge or proposes a route', () => {
  assert.ok(MD.includes(`**Verdict: ${R.verdict}.**`));
  assert.ok(MD.includes(R.verdictNote[0].toUpperCase() + R.verdictNote.slice(1)));
  assert.match(R.verdict, /^(NOT ROUTE-SENSITIVE|ROUTE-SENSITIVE: \d+ tests? would pass at futures cost \(Holm \d+\)) \(accounting, no rule tested: inconclusive as evidence for any rule\)$/);
  for (const r of R.rows.filter((x) => x.tFut != null)) assert.ok(MD.includes(`| ${r.test} |`), r.test);
  assert.ok(MD.includes('demo accounts trade CFDs only'));
  assert.ok(MD.includes('nothing here is called an edge'));
  assert.ok(!/\bis an edge\b|\bfound an edge\b|propose (a|the) (futures )?route/i.test(MD));
  assert.ok(MD.includes(`Holm ${R.in333.holm05.length}`));
});
