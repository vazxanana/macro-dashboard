// research/edge/tsmom-portfolio: no look-ahead in the signal, volatility and scale; the report against result.json. Offline.
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import * as M from '../research/edge/tsmom-portfolio/run.mjs';

const DIR = new URL('../research/edge/tsmom-portfolio/', import.meta.url);
const res = JSON.parse(fs.readFileSync(new URL('result.json', DIR), 'utf8'));
const md = fs.readFileSync(new URL('RESULT.md', DIR), 'utf8');

function rng(seed) { let s = seed >>> 0; return () => { s = (s * 1664525 + 1013904223) >>> 0; return s / 2 ** 32; }; }
function walk(seed, from = Date.UTC(2015, 0, 1) / 1000, days = 1500) {
  const r = rng(seed), rows = []; let p = 100;
  for (let i = 0; i < days; i++) { const t = from + i * 86400; p *= 1 + (r() - 0.5) * 0.03 + 0.0003; rows.push([t, p, p, p, p, 1]); }
  return rows;
}
const mk = (seeds) => Object.fromEntries(seeds.map((s, i) => [['xau', 'spx500', 'eurusd'][i], M.series(walk(s))]));
const perturbFrom = (data, D, seed) => {
  const r = rng(seed), out = {};
  for (const [k, s] of Object.entries(data)) out[k] = { t: s.t.slice(), mi: s.mi.slice(), c: s.c.map((c, j) => (s.t[j] >= D ? c * (0.5 + r() * 1.5) : c)) };
  return out;
};

test('the universe is the 38 pre-registered markets, each with a cost', () => {
  assert.equal(M.UNIVERSE.length, 38);
  for (const k of M.UNIVERSE) assert.ok(M.COST_RT[k] > 0, k);
  for (const k of ['xaueur', 'eurgbp', 'usdtry', 'cn50']) assert.ok(!M.UNIVERSE.includes(k), k);
});

test('weekend candles are dropped, nothing else', () => {
  const s = M.series([[Date.UTC(2026, 10, 13) / 1000, 1, 1, 1, 2, 1], [Date.UTC(2026, 10, 15) / 1000, 1, 1, 1, 3, 1], [Date.UTC(2026, 10, 16) / 1000, 1, 1, 1, 4, 1]]);
  assert.deepEqual(s.c, [2, 4]);
});

test('signal and volatility read only closes strictly before the rebalance day', () => {
  const data = mk([1, 2, 3]), D = Date.UTC(2017, 5, 1) / 1000, m = 2017 * 12 + 5;
  for (const sp of Object.keys(M.SPECS)) for (const k of Object.keys(data)) {
    const a = M.marketAt(data[k], D, m, M.SPECS[sp]);
    assert.ok(a, `${k} eligible`);
    for (const seed of [7, 8, 9]) assert.deepEqual(M.marketAt(perturbFrom(data, D, seed)[k], D, m, M.SPECS[sp]), a);
    // a change one day before does move something (the test can fail)
    const before = { ...data[k], c: data[k].c.map((c, j) => (data[k].t[j] >= D - 86400 * 40 ? c * 3 : c)) };
    assert.notDeepEqual(M.marketAt(before, D, m, M.SPECS[sp]).vol, a.vol);
  }
});

test('the whole portfolio: weights and scale up to a month never change when later prices change', () => {
  const data = mk([11, 12, 13]), rate = () => 0.03;
  const base = M.simulate(data, rate);
  for (const q of [30, 40, 47]) {
    const D = base.rebs[q].D, alt = M.simulate(perturbFrom(data, D, q), rate);
    for (let i = 0; i <= q; i++) { assert.deepEqual(alt.rebs[i].w, base.rebs[i].w, `w ${i}`); assert.equal(alt.rebs[i].k, base.rebs[i].k, `k ${i}`); }
    // months before q are unchanged in full (they end at or before D's close)
    for (let i = 0; i < q - 1; i++) assert.equal(alt.months[i].net, base.months[i].net);
  }
});

test('costs and financing follow the pre-registered rule', () => {
  const data = mk([21, 22, 23]);
  const a = M.simulate(data, () => 0.04), b = M.simulate(data, () => 0.04, { fin: false }), c = M.simulate(data, () => 0.04, { costMult: 2 });
  const sum = (r, f) => r.months.reduce((s, m) => s + m[f], 0);
  assert.equal(sum(b, 'fin'), 0);
  assert.ok(Math.abs(sum(c, 'cost') - 2 * sum(a, 'cost')) < 1e-12);
  assert.ok(Math.abs(sum(a, 'gross') - sum(b, 'gross')) < 1e-12);
  assert.ok(sum(a, 'fin') > 0);
});

test('stats, Holm and the verdict rule', () => {
  const s = M.stats([0.01, -0.01, 0.02, 0.0]);
  assert.equal(s.n, 4); assert.equal(s.meanPct, 0.5); assert.equal(s.totalPct, 2); assert.equal(s.maxDDPct, -1);
  assert.ok(Math.abs(M.pOneSided(2.0, 30) - 0.0273) < 0.001);
  assert.deepEqual(M.holm([0.01, 0.04, 0.03]).map((x) => +x.toFixed(4)), [0.03, 0.06, 0.06]);
  const v = M.verdictOf(res.primary.net, res.primary.at2xCosts);
  assert.equal(v.verdict, res.verdict); assert.deepEqual(v.checks, res.checks);
});

test('result.json and RESULT.md say the same', () => {
  assert.equal(res.verdict, 'FAIL');
  assert.match(md, /\*\*Verdict: FAIL\.\*\*/);
  const n = res.primary.net, g = res.primary.gross, fix = (x, d) => (Math.round(Math.abs(x) * 10 ** d + 1e-6) / 10 ** d).toFixed(d);
  const f = (x, d) => (x < 0 ? '−' : '+') + fix(x, d), t2 = (x, d = 2) => (x < 0 ? '−' : '') + fix(x, d);
  const rows = [['replication 2005-19', 'replication'], ['in sample 2020-23', 'inSample'], ['out of sample 2024-01 → 2026-10', 'outOfSample']];
  for (const [label, w] of rows) {
    const line = md.split('\n').find((l) => l.startsWith(`| ${label} |`));
    assert.ok(line, label);
    const cells = line.split('|').map((x) => x.trim());
    assert.equal(cells[2], String(n[w].n));
    assert.equal(cells[3], f(n[w].meanPct, 3) + ' %');
    assert.equal(cells[4], t2(n[w].t)); assert.equal(cells[5], t2(n[w].sharpe));
    assert.equal(cells[6], t2(n[w].maxDDPct, 1) + ' %');
    assert.equal(cells[7], f(g[w].meanPct, 3) + ' %'); assert.equal(cells[8], t2(g[w].t)); assert.equal(cells[9], t2(g[w].sharpe));
  }
  for (const [sp, v] of Object.entries(res.specs)) {
    const line = md.split('\n').find((l) => l.startsWith(`| ${sp}`));
    assert.ok(line, sp);
    const cells = line.split('|').map((x) => x.trim());
    assert.equal(cells[2], f(v.net.outOfSample.meanPct, 2) + ' %'); assert.equal(cells[3], t2(v.net.outOfSample.t));
    assert.equal(cells[5], v.holmOOS.toFixed(2));
  }
  for (const w of ['replication', 'inSample', 'outOfSample']) {
    const s = res.shares[w];
    assert.ok(md.includes(`+${fix(s.grossPct, 1)} | ${fix(s.costPct, 1)} | ${fix(s.finPct, 1)} | ${f(s.netPct, 1)} |`), w);
  }
});
