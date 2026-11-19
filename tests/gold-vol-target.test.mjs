// Volatility targeting on a passive gold holding: the rule on hand-made data, no look-ahead, and the report against result.json.
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { sigma, managedWeight, isRebalance, simulate, maxDD, holm, monthly, weekdays, P } from '../research/edge/gold-vol-target/run.mjs';

const MON = 1793577600; // Monday 2 Nov 2026 00:00 UTC
const bars = (closes) => closes.map((close, i) => ({ time: MON + (Math.floor(i / 5) * 7 + (i % 5)) * 86400, close }));

test('weight = target / sigma, capped at 2x, null without enough history', () => {
  assert.equal(managedWeight(0.3), 0.5); assert.equal(managedWeight(0.05), 2); assert.equal(managedWeight(null), null);
  const b = bars([...Array(30)].map((_, i) => 100 * Math.exp(0.01 * (i % 2 ? 1 : -1) * i / 10)));
  assert.equal(sigma(b, 19, 20), null); assert.ok(sigma(b, 20, 20) > 0);
});

test('sigma at day i reads only closes up to i (no look-ahead)', () => {
  const a = bars([...Array(40)].map((_, i) => 100 + Math.sin(i) * 2)), c = a.map((x, i) => (i > 25 ? { ...x, close: 999 } : x));
  assert.equal(sigma(a, 25, 20), sigma(c, 25, 20));
  // the weight a rebalance uses is computed before the next close moves the price
  const seen = []; simulate(a, (i) => { seen.push(i); return 1; });
  assert.ok(seen.every((i) => isRebalance(a, i)));
  assert.deepEqual(seen.slice(0, 2), [4, 9]); // Fridays
});

test('accounting: units fixed between Fridays, $0.45 an ounce traded, financing on the long units every rollover', () => {
  const b = bars([100, 100, 100, 100, 100, 110, 110, 110, 110, 110, 110]);
  const d = simulate(b, () => 1, { p: { ...P, fin: 0 } });
  assert.ok(Math.abs(d[0].cost - 0.0045) < 1e-15); // open 0.01 oz at $0.45
  assert.ok(Math.abs(d[0].gross - 0.1) < 1e-12); // Fri 100 -> Mon 110, 0.01 oz
  const d2 = simulate(b, () => 1);
  assert.ok(Math.abs(d2[0].fin - 0.01 * 100 * P.fin * 1) < 1e-15); // Friday close -> Monday close: one rollover (Monday 22:00)
  const dx = simulate(b, () => 1, { costMult: 2, finMult: 2 });
  assert.ok(Math.abs(dx[0].cost - 2 * d2[0].cost) < 1e-15 && Math.abs(dx[0].fin - 2 * d2[0].fin) < 1e-15);
});

test('helpers: drawdown, Holm, months, weekend fold', () => {
  assert.equal(maxDD([0.1, -0.05, -0.1, 0.2, -0.3]), 0.3);
  assert.deepEqual(holm([0.01, 0.04, 0.03]).map((x) => +x.toFixed(4)), [0.03, 0.06, 0.06]);
  assert.equal(monthly([{ time: MON, pnl: 1 }, { time: MON + 86400 * 40, pnl: 2 }]).length, 2);
  const sat = 1793404800; // Saturday 31 Oct 2026
  assert.deepEqual(weekdays([[sat, 1, 2, 0.5, 1.5, 0], [sat + 2 * 86400, 1.5, 1.8, 1.4, 1.7, 0]]), [{ time: sat + 2 * 86400, close: 1.7 }]);
});

test('the report says what result.json holds, and FAIL', () => {
  const r = JSON.parse(fs.readFileSync(new URL('../research/edge/gold-vol-target/result.json', import.meta.url)));
  const md = fs.readFileSync(new URL('../research/edge/gold-vol-target/RESULT.md', import.meta.url), 'utf8');
  assert.equal(r.verdict, 'FAIL'); assert.match(md, /\*\*Verdict: FAIL, 0 of 3/);
  const f = (x) => (x >= 0 ? '+' : '-') + Math.abs(x).toFixed(3);
  for (const k of ['T1', 'T2', 'T3']) {
    const t = r.tests[k]; assert.equal(t.pass, false, k);
    assert.ok(md.includes(`| ${f(t.oos)} | ${f(t.is)} | ${f(t.oos2x)} | ${t.p.toFixed(3)} | ${t.pHolm.toFixed(3)} |`), k);
  }
  assert.ok(md.includes(`${r.placebo.T1.atLeastReal} of 40 reach the real`) && md.includes(`${r.placebo.T3.atLeastReal} of 40 reach the real`));
  assert.equal(r.strategies['M20-oos'].months, 118); assert.equal(r.strategies['M20-is'].months, 108);
  assert.ok(!/now live|live change/i.test(md.replace(/nothing live changed/gi, '')));
});
