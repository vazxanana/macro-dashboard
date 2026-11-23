// tests/combo-grid-4.test.mjs - combination grid 4 (research/edge/combo-grid-4): the rule count, the month layout, the bar on a
// hand-made accumulator, no look-ahead on seeded candles, and RESULT.md pinned to result.json. Offline.
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { NRULE, NM, IS_M, MONTHS, MARKETS, ruleIndex, ruleName, tradesOf, accumulate, bar } from '../research/edge/combo-grid-4/run.mjs';

const DIR = new URL('../research/edge/combo-grid-4/', import.meta.url);
const R = JSON.parse(fs.readFileSync(new URL('result.json', DIR), 'utf8'));
const MD = fs.readFileSync(new URL('RESULT.md', DIR), 'utf8');

test('891 rules, 120 months split 60 / 60', () => {
  assert.equal(NRULE, 9 * 11 * 9); assert.equal(NM, 120); assert.equal(IS_M, 60);
  assert.equal(MONTHS[0], Date.UTC(2010, 0, 1) / 1000); assert.equal(MONTHS[IS_M], Date.UTC(2015, 0, 1) / 1000);
  assert.deepEqual(ruleName(ruleIndex(7, 3, 6)), { chain: '1h>5m', zone: 'dom', exit: 'trail' });
});

test('the bar: a rule positive in both halves passes, a flat one does not', () => {
  const rows = [];
  for (let m = 0; m < NM; m++) for (let k = 0; k < 4; k++) {
    const t = MONTHS[m] + 86400 * (1 + k);
    const g = new Array(9).fill(NaN); g[0] = (k % 2 ? 1 : -1) + 0.4 + 0.01 * (m % 3); rows.push([7, 3, t, 0.01, ...g]);
    const f = new Array(9).fill(NaN); f[0] = k % 2 ? 1 : -1; rows.push([0, 0, t, 0.01, ...f]);
  }
  const P = {}; for (const m of MARKETS) P[m] = m === 'xau' ? accumulate(rows) : accumulate([]);
  const B = bar(P, 'before'), keys = B.confirmedList.map((x) => `${x.scope} ${x.chain} ${x.zone} ${x.exit}`);
  assert.ok(keys.includes('pool 1h>5m dom 1R') && keys.includes('xau 1h>5m dom 1R'));
  assert.ok(!keys.some((k) => k.includes('1d>4h eg 1R')));
});

function seeded(n, seed = 5) {
  let a = seed, px = 1.2; const out = []; const t0 = Date.UTC(2014, 9, 1) / 1000;
  for (let i = 0; i < n; i++) { a = (a * 1103515245 + 12345) % 2147483648; const r = a / 2147483648 - 0.5; const o = px; px = Math.max(0.5, px + r * 0.0015);
    const h = Math.max(o, px) + Math.abs(r) * 0.0005, l = Math.min(o, px) - Math.abs(r) * 0.0005; const t = t0 + i * 300;
    if (new Date(t * 1000).getUTCDay() === 6) continue; out.push({ t, o, h, l, c: px, e: t + 300 }); }
  return out;
}
test('no look-ahead: trades on cut candles equal the full run, every trade with its stop on the losing side', () => {
  const M5 = seeded(40000), cut = M5[30000].t, start = M5[9000].t;
  const str = (r) => r.map((v) => (Number.isFinite(v) ? +v.toPrecision(10) : String(v))).join(',');
  const safe = (r) => r[2] + 22 * 86400 < cut;
  const A = tradesOf(M5, 'eurusd', { start, end: cut }).filter(safe), B = tradesOf(M5.filter((b) => b.t < cut), 'eurusd', { start, end: cut }).filter(safe);
  assert.ok(A.length > 100);
  assert.deepEqual(A.map(str).sort(), B.map(str).sort());
  for (const r of A) assert.ok(r[3] > 0 && Number.isFinite(r[4]));   // a positive risk (stop on the losing side) and a 1R result
});

test('RESULT.md is pinned to result.json', () => {
  const line3 = MD.split('\n')[2];
  assert.match(line3, new RegExp(`^\\*\\*Verdict: ${R.verdict}\\. `));
  assert.equal(R.verdict, 'PASS'); assert.ok(R.headline);
  const b = R.before, a = R.after, f = (n) => n.toLocaleString('en-GB');
  assert.equal(b.tested, 5346); assert.ok(MD.includes(`${b.holmConfirmed} of ${f(b.tested)} cells`));
  assert.ok(MD.includes(`| Confirmed after Holm | **${b.holmConfirmed}** | **${a.holmConfirmed}** |`));
  assert.ok(MD.includes(`| ${f(b.discovery)} | ${a.discovery} |`) && MD.includes(`| ${b.rawConfirmed} | ${a.rawConfirmed} |`));
  assert.ok(MD.includes(`| ${f(b.withN100)} | ${f(a.withN100)} |`));
  assert.ok(MD.includes(`| dom (dominant) | ${b.cellsWithN100ByZone.dom} | ${b.discoveryByZone.dom} | ${b.rawByZone.dom} | **${b.holmByZone.dom}** |`));
  for (const z of ['ef', 'av', 'eg']) assert.ok(MD.includes(`| ${b.discoveryByZone[z]} | ${b.rawByZone[z]} | ${b.holmByZone[z]} |`), z);
  const d = R.domCell.pool.trail;
  assert.ok(line3.includes(`+${d.before['2015-19'].mean.toFixed(3)}R a trade in 2015-19, n ${f(d.before['2015-19'].n)}, month t ${d.before['2015-19'].t})`));
  assert.ok(line3.includes(`after costs ${a.holmConfirmed} confirmed (${d.after['2015-19'].mean.toFixed(3)}R)`));
  assert.ok(MD.includes(`| trail | +${d.before['2010-14'].mean.toFixed(3)} (${d.before['2010-14'].t}) | +${d.before['2015-19'].mean.toFixed(3)} (${d.before['2015-19'].t}) |`));
  assert.ok(R.cuts.length && R.cuts.every((c) => c.ok && c.diff === 0));
  assert.ok(MD.includes(f(Object.values(R.meta).reduce((s, m) => s + m.trades, 0)) + ' trades'));
});
