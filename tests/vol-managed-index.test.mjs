// research/edge/vol-managed-index: the pure pieces on hand-made data, and the report against result.json (offline).
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import * as V from '../research/edge/vol-managed-index/run.mjs';

const dir = new URL('../research/edge/vol-managed-index/', import.meta.url);
const R = JSON.parse(fs.readFileSync(new URL('result.json', dir), 'utf8'));
const MD = fs.readFileSync(new URL('RESULT.md', dir), 'utf8');
const PRE = fs.readFileSync(new URL('PREREGISTRATION.md', dir), 'utf8');

test('weekend candles are dropped, returns are close over close', () => {
  const t0 = Date.UTC(2026, 0, 2) / 1000; // a Friday
  const rows = [[t0, 0, 0, 0, 100, 0], [t0 + 86400 * 2, 0, 0, 0, 999, 0], [t0 + 86400 * 3, 0, 0, 0, 110, 0]];
  const b = V.weekdays(rows);
  assert.deepEqual(b.map((x) => x.c), [100, 110]);
  const s = V.series(b);
  assert.ok(Math.abs(s.r[1] - 0.1) < 1e-12);
});

test('sigma20 at day i uses returns up to i only (no look-ahead)', () => {
  const bars = Array.from({ length: 40 }, (_, i) => ({ t: i * 86400, d: String(i), c: 100 * (1 + 0.01 * Math.sin(i)) }));
  const a = V.series(bars).s;
  bars[30].c *= 3; // change a later price
  const b = V.series(bars).s;
  for (let i = 0; i < 30; i++) assert.equal(a[i], b[i]);
});

test('c gives an average capped weight of 1; weights capped at 2', () => {
  const sigs = [0.05, 0.1, 0.15, 0.2, 0.4, 0.8];
  for (const k of ['B', 'C']) {
    const c = V.fitC(k, sigs), avg = sigs.reduce((a, s) => a + V.weightOf(k, c, s), 0) / sigs.length;
    assert.ok(Math.abs(avg - 1) < 1e-9);
    for (const s of sigs) assert.ok(V.weightOf(k, c, s) <= 2);
  }
  assert.equal(V.weightOf('A', 123, 0.3), 1);
});

test('the financing rate is the latest DGS2 dated before the day, else the 4 % fallback', () => {
  const f = V.rateFn([['2006-01-06', 4.36], ['2006-01-13', -1]]);
  assert.deepEqual(f('2006-01-06'), { y: 4, fallback: true });
  assert.deepEqual(f('2006-01-07'), { y: 4.36, fallback: false });
  assert.deepEqual(f('2006-01-20'), { y: 0, fallback: false });
});

test('statistics: drawdown, Holm, bootstrap sign, normal CDF', () => {
  assert.ok(Math.abs(V.maxDD([0.1, -0.5, 0.2]) + 0.5) < 1e-12);
  assert.deepEqual(V.holm([0.01, 0.04, 0.03]).map((x) => +x.toFixed(4)), [0.03, 0.06, 0.06]);
  assert.ok(Math.abs(V.phi(0) - 0.5) < 1e-6 && Math.abs(V.phi(1.96) - 0.975) < 1e-3);
  const R0 = V.rng(1), a = Array.from({ length: 600 }, () => (R0() - 0.5) * 0.02);
  const better = a.map((x) => x + 0.002);
  assert.ok(V.bootP(a, better, { draws: 300 }).p < 0.05);
  assert.ok(V.bootP(better, a, { draws: 300 }).p > 0.5);
  const sh = V.blockShuffle([...Array(50).keys()], 3);
  assert.deepEqual([...sh].sort((x, y) => x - y), [...Array(50).keys()]);
});

test('a constant strategy pays the spread once and financing by calendar days', () => {
  const t0 = Date.UTC(2026, 0, 5) / 1000; // Monday
  const bars = [], days = [0, 1, 2, 3, 4, 7];
  days.forEach((d, i) => bars.push({ t: t0 + d * 86400, d: new Date((t0 + d * 86400) * 1000).toISOString().slice(0, 10), c: 100 }));
  const ser = { r: [null, 0, 0, 0, 0, 0], s: [0.2, 0.2, 0.2, 0.2, 0.2, 0.2] };
  const sim = V.simulate(bars, ser, [1, 2, 3, 4, 5], 'A', () => ({ y: 0, fallback: false }));
  assert.ok(Math.abs(sim.spread - V.COST) < 1e-15);
  const fin = V.MARKUP / 365;
  assert.ok(Math.abs(sim.rets[4].ret + 3 * fin) < 1e-15); // Friday to Monday: three days
});

test('result.json: the verdict follows the pre-registered bar', () => {
  assert.equal(R.study, 'vol-managed-index');
  assert.equal(R.tests.length, 3);
  for (const t of R.tests) {
    const pass = t.gainDecisive > 0 && t.gainReplication > 0 && t.pHolm < 0.05 && t.maxDDManaged >= t.maxDDA;
    assert.equal(t.pass, pass, t.id);
  }
  const t1 = R.tests[0];
  assert.equal(R.verdict, t1.pass ? (t1.gainDecisive2x > 0 ? 'PASS' : 'PASS, not robust to costs') : 'FAIL');
  assert.equal(R.windows.decisive[0], '2016-01-01');
  assert.equal(R.params.DRAWS, 5000);
  assert.equal(R.placebo.B.seeds, 40);
});

test('RESULT.md quotes result.json', () => {
  assert.match(MD, new RegExp(`\\*\\*Verdict: ${R.verdict}`));
  const f = (x) => (x < 0 ? '−' : '+') + Math.abs(x).toFixed(3);
  for (const t of R.tests) {
    assert.ok(MD.includes(f(t.gainDecisive)) && MD.includes(f(t.gainReplication)) && MD.includes(f(t.gainDecisive2x)), t.id);
    assert.ok(MD.includes(t.pBoot.toFixed(3)), t.id);
  }
  const sp = R.markets.spx500.decisive;
  for (const k of ['A', 'B', 'C']) assert.ok(MD.includes(`| spx500 | decisive | ${k} | ${sp[k].sharpe.toFixed(2)} |`), k);
  assert.ok(MD.includes(`${R.placebo.B.atLeastReal} of 40`));
});

test('scope: no gold candle read, no live code imported, stops stated', () => {
  const src = fs.readFileSync(new URL('run.mjs', dir), 'utf8');
  assert.ok(!/xau|gold/i.test(src.replace(/\/\/.*$/gm, '')));
  assert.ok(!/from '\.\.\/\.\.\/\.\.\/(council|api|ict)\//.test(src));
  assert.match(PRE, /stop rule does not apply/i);
  assert.match(PRE, /owner's approval/);
});
