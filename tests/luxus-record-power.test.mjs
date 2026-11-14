// The Luxus record-power proposal (research/proposals/2026-11-14-luxus-record-power.md) and its arithmetic
// (…-luxus-record-power.mjs → …-luxus-record-power.json): the committed numbers are the script's own output, a hand-checked
// case, the simulation against an exact binomial count, and every figure the page quotes. Offline.
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { build, tradeStats, zeroP, winMoments, powerCurve, firstN, phi, CASES, C, DRAWS, SEED, N_MAX, WIN_RATES, TAIL } from '../research/proposals/2026-11-14-luxus-record-power.mjs';

const rd = (p) => fs.readFileSync(new URL(p, import.meta.url), 'utf8');
const DOC = rd('../research/proposals/2026-11-14-luxus-record-power.md'), SRC = rd('../research/proposals/2026-11-14-luxus-record-power.mjs');
const J = JSON.parse(rd('../research/proposals/2026-11-14-luxus-record-power.json'));
const has = (s) => assert.ok(DOC.includes(s), `the proposal should say: ${s}`);
const near = (a, b, e, what) => assert.ok(Math.abs(a - b) <= e, `${what}: ${a} vs ${b}`);
const sg = (x) => `${x > 0 ? '+' : x < 0 ? '−' : ''}${Math.abs(x).toFixed(2)}`;

test('the committed numbers are the script\'s own output (deterministic, seeded)', () => {
  assert.deepEqual(JSON.parse(JSON.stringify(build())), J);
  assert.deepEqual([DRAWS, SEED, N_MAX], [20000, 1114, 1000]); assert.equal(C, 0.15);
  assert.deepEqual(WIN_RATES, [0.15, 0.2, 0.25, 0.3, 0.35, 0.4, 0.45, 0.5]);
  assert.equal((SRC.match(/^import /gm) || []).length, 3, 'node built-ins only: no market data, nothing live');
  assert.doesNotMatch(SRC, /fetch\(|https?:\/\//);
});

test('a hand-checked case: every win 3R at a 30 % win rate, 0.15R cost', () => {
  const w3 = CASES.find((c) => c.id === 'w3'), s = tradeStats(w3, 0.3);
  near(s.mean, 0.3 * 3 - 0.7 * 1 - 0.15, 1e-12, 'expectancy');          // +0.05R
  near(s.sd, Math.sqrt(0.3 * 9 + 0.7 - 0.2 ** 2), 1e-12, 'sd');          // √3.36 = 1.833
  near(zeroP(w3), 1.15 / 4, 1e-12, 'break-even win rate');               // 28.75 %
  near(zeroP(CASES[0]), 1.15 / 3, 1e-12, 'break-even win rate at 2R');
  // the heavy tail: share of wins at 15R or more, and the capped mean by a seeded check
  near(phi(1.96), 0.975, 1e-4, 'normal CDF'); near(J.tailShare15, 0.093, 0.001, 'share >= 15R');
  const m = winMoments(CASES[3]).m1; near(m, 6.231, 0.001, 'capped mean win'); assert.ok(m < TAIL.median * Math.exp(0.5));
});

test('the simulated power equals an exact binomial count for fixed wins', () => {
  // with a fixed win size the t of a record depends only on its number of wins k: count the exact chance of t >= 2
  const exact = (W, p, n) => {
    let pr = 0; const lc = (a) => { let s = 0; for (let i = 2; i <= a; i++) s += Math.log(i); return s; };
    for (let k = 0; k <= n; k++) {
      const s = k * (W - C) + (n - k) * (-1 - C), q = k * (W - C) ** 2 + (n - k) * (1 + C) ** 2, v = (q - s * s / n) / (n - 1);
      const t = v > 1e-12 ? (s / n) / Math.sqrt(v / n) : (s > 0 ? Infinity : -Infinity);
      if (t >= 2) pr += Math.exp(lc(n) - lc(k) - lc(n - k) + k * Math.log(p) + (n - k) * Math.log(1 - p));
    }
    return pr;
  };
  const w3 = J.cases.find((c) => c.id === 'w3'), r = w3.rows.find((x) => x.winRate === 0.4);
  for (const n of [20, 50, 100, 200]) near(r.powerAt[n], exact(3, 0.4, n), 0.015, `3R at 40 %, n ${n}`);
  near(w3.luck.falseAlarm[100], exact(3, zeroP(CASES[1]), 100), 0.004, 'zero-edge false alarm at 100');
  // and the trades needed is where the curve first reaches 80 %
  const curve = powerCurve(CASES[2], 0.5, 40, 4000, 7); assert.ok(curve[firstN(curve)] >= 0.8 && curve[firstN(curve) - 1] < 0.8);
});

test('every cell of the page\'s table is the json\'s', () => {
  for (const [i, p] of WIN_RATES.entries()) {
    const cells = J.cases.map((c) => { const r = c.rows[i]; return `${sg(r.expectancy)} · ${r.tradesNeeded != null ? r.tradesNeeded : (r.expectancy <= 0 ? 'no edge' : 'over 1,000')}`; });
    has(`| ${Math.round(p * 100)} % | ${cells.join(' | ')} |`);
  }
  const pc = (x) => (x * 100).toFixed(2) + ' %';
  for (const c of J.cases) has(`${(c.luck.winRate * 100).toFixed(1)} %: ${pc(c.luck.falseAlarm[20])} / ${pc(c.luck.falseAlarm[50])} / ${pc(c.luck.falseAlarm[100])}`);
});

test('the plain-words figures and the recommendation', () => {
  const tail = J.cases.find((c) => c.id === 'tail'), t30 = tail.rows.find((r) => r.winRate === 0.3);
  has(`only **${Math.round(t30.powerAt[20] * 100)} %**`); has(`(${t30.tradesNeeded} needed)`); assert.ok(t30.tradesNeeded <= 160);
  has(`${(tail.luck.falseAlarm[20] * 100).toFixed(2)} % of records at 20 trades and ${(tail.luck.falseAlarm[100] * 100).toFixed(2)} % at`);
  has(`sd ${t30.sd}R`); const b = J.barAt.avgR; has(`+${b[20]}R a trade at 20 trades, +${b[50]}R at\n   50, +${b[100]}R at 100, +${b[200]}R at 200`);
  has('judge the record at about 150 pre-entry trades, not 20'); has('**Arithmetic, not evidence.**'); has('setAt rule of PR #1226');
  has(`+${J.examples.meanAfterCost}R a trade after the assumed cost`); assert.deepEqual(J.examples.R, [2.8, 4.6, 2.1, 16.4, 5.6]);
  has(`mean win ${tail.meanWin.toFixed(2)}R`); has('**0.15R**'); assert.deepEqual(J.cost.rangeR, [0.12, 0.2]);
});
