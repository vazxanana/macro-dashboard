// tests/zone-use-count-2020.test.mjs - research/edge/zone-use-count-2020: the report's figures against result.json, the
// verdict against the pre-registered rules, the cut test on synthetic candles, and the two fill engines on hand-made candles.
// Offline and fast: no candle cache is needed.
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { touchTrades, sim2R, welch } from '../research/edge/zone-use-count-2020/run.mjs';
import { multi } from '../research/edge/combo-grid/run.mjs';

const DIR = path.join(path.dirname(fileURLToPath(import.meta.url)), '..', 'research', 'edge', 'zone-use-count-2020');
const R = JSON.parse(fs.readFileSync(path.join(DIR, 'result.json'), 'utf8'));
const MD = fs.readFileSync(path.join(DIR, 'RESULT.md'), 'utf8');
const T = (id) => R.tests.find((x) => x.id === id), B = (id) => R.bar.find((x) => x.id === id);
const f4 = (x) => (x > 0 ? '+' : '') + x.toFixed(4), comma = (n) => n.toLocaleString('en-US');

test('verdict line and the pre-registered decision', () => {
  const line = MD.split('\n')[2];
  assert.match(line, /^\*\*Verdict: (PASS|FAIL|INCONCLUSIVE)\. /);
  assert.ok(line.includes(`Verdict: ${R.verdict}.`));
  assert.equal(R.verdict, R.bar.some((x) => x.pass) ? 'PASS' : 'FAIL');
  assert.equal(R.tests.length, 4); assert.equal(R.bar.length, 6);
  for (const t of R.tests) assert.equal(t.holds, t.holm < 0.05 && t.sameSign);
  for (const b of R.bar) assert.equal(b.pass, b.disc.n >= 100 && b.disc.mean > 0 && b.disc.tMonth >= 2 && b.conf.n >= 50 && b.conf.mean > 0 && b.conf.tMonth >= 2 && b.holm < 0.05 && b.conf.mean2c > 0);
  assert.ok(line.includes(`${R.tests.filter((x) => x.holds).length} of 4`));
  assert.ok(line.includes(`n ${comma(B('eg-g1').n)}`) && line.includes(`month t ${B('eg-g1').tMonth}`));
  assert.ok(line.includes(`${B('eg-g1').mean.toFixed(3)}R`));
  assert.ok(line.includes(`${T('T2-EG').diff}R a trade, t ${T('T2-EG').t.toFixed(2)}`));
});

test('the difference table matches result.json', () => {
  for (const t of R.tests) {
    const row = MD.split('\n').find((l) => l.startsWith(`| ${t.id} `)); assert.ok(row, t.id);
    for (const s of [t.meanA.toFixed(4), t.meanB.toFixed(4), t.diff.toFixed(4).replace(/^0\./, '0.'), t.t.toFixed(2), String(t.holm),
      `(${t.disc.t.toFixed(2)})`, `(${t.conf.t.toFixed(2)})`, `t ${t.tGross.toFixed(2)}`]) assert.ok(row.includes(s), `${t.id}: ${s}`);
    assert.ok(row.includes(f4(t.disc.diff)) || row.includes(t.disc.diff.toFixed(4)));
  }
  assert.equal(R.nTrades, 1220067); assert.ok(MD.includes(comma(R.nTrades)));
});

test('touch numbers and the bar table match result.json', () => {
  for (const n of ['1', '2', '3', '4', '5', '6+']) {
    const row = MD.split('\n').find((l) => l.startsWith(`| ${n} |`)); assert.ok(row, n);
    const eg = R.byTouch.eg.find((x) => x.touch === n), ef = R.byTouch.ef.find((x) => x.touch === n);
    for (const s of [comma(eg.n), eg.mean.toFixed(4), f4(eg.meanGross), eg.tMonth.toFixed(2), comma(ef.n), ef.mean.toFixed(4), f4(ef.meanGross), ef.tMonth.toFixed(2)])
      assert.ok(row.includes(s), `${n}: ${s}`);
  }
  const names = { g1: 'touch 1', g23: 'touches 2-3', g4: 'touches 4+' };
  for (const b of R.bar) {
    const row = MD.split('\n').find((l) => l.startsWith(`| ${b.kind.toUpperCase()} ${names[b.g]} |`)); assert.ok(row, b.id);
    for (const s of [`${comma(b.disc.n)}, ${b.disc.mean.toFixed(4)}, ${b.disc.tMonth.toFixed(2)}`, `${comma(b.conf.n)}, ${b.conf.mean.toFixed(4)}, ${b.conf.tMonth.toFixed(2)}`, b.conf.mean2c.toFixed(4)])
      assert.ok(row.includes(s), `${b.id}: ${s}`);
  }
  // markets where the earlier group did better (descriptive line of the report)
  for (const [k, a, c] of [['eg', 7, 8], ['ef', 9, 8]]) { const M = R.byMarket[k]; const ms = Object.values(M);
    assert.equal(ms.filter((m) => m.g1.mean > m.g23.mean).length, a); assert.equal(ms.filter((m) => m.g23.mean > m.g4.mean).length, c); }
  const s = R.sensitivity; assert.ok(MD.includes(`${s.byTouch.eg[0].mean.toFixed(4)}R, n ${comma(s.byTouch.eg[0].n)}`));
  const st = s.tests.find((x) => x.id === 'T2-EG'); assert.ok(MD.includes(`${st.diff}R, t ${st.t.toFixed(2)}, Holm p ${st.holm.toFixed(2)}`));
  assert.ok(R.cut.length >= 2 && R.cut.every((c) => c.equal && c.missing === 0));
});

// synthetic 5-minute candles: a seeded random walk with trends, so engulfs, failures and touches all occur
function walk(n, seed = 3) {
  let a = seed >>> 0; const r = () => { a = (a + 0x6d2b79f5) >>> 0; let t = a; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
  const out = []; let p = 100, drift = 0; const t0 = Date.UTC(2020, 0, 6) / 1000;
  for (let i = 0; i < n; i++) { if (i % 300 === 0) drift = (r() - 0.5) * 0.02; const o = p; p = Math.max(1, p + drift + (r() - 0.5) * 0.3);
    const h = Math.max(o, p) + r() * 0.1, l = Math.min(o, p) - r() * 0.1; const t = t0 + i * 300; out.push({ t, o, h, l, c: p, e: t + 300 }); }
  return out;
}

test('cut test on synthetic candles: trades closed before the cut do not change', () => {
  const M5 = walk(40000), cut = M5[24000].t - (M5[24000].t % 86400);
  const full = touchTrades(M5, 0.02).rows, part = touchTrades(M5.filter((b) => b.e <= cut), 0.02).rows;
  const done = (r) => r[3] + 6 * 86400 < cut, key = (r) => JSON.stringify(r.map((x) => (Number.isNaN(x) ? 'nan' : x)));
  const a = full.filter(done).map(key), b = part.filter(done).map(key);
  assert.ok(a.length > 200, 'enough trades: ' + a.length);
  assert.deepEqual(b, a);
  assert.ok(full.some((r) => r[2] >= 3), 'later touches occur');
});

test('fill engines on hand-made candles: the same-candle close past the stop', () => {
  const c = (i, o, h, l, cl) => ({ t: 1000 + i * 300, o, h, l, c: cl, e: 1300 + i * 300 });
  // a buy limit at 10, stop 9: the first candle reaches 10 and closes at 8.5, past the stop
  const M = [c(0, 11, 11, 8.4, 8.5), c(1, 8.5, 9, 8, 8.2), c(2, 8.2, 13, 8.2, 12.5)];
  // the grid's multi() cancelled such an order until 23 Nov 2026 (this study found it); since the fix it fills and stops too
  assert.equal(multi(M, 1, 10, 9, 'lim', 1000, 1e9, 2, 1e6).R[0], -1);
  assert.deepEqual(sim2R(M, 1, 10, 9, 1000, 1e9, 1e6), { t: 1000, risk: 1, R: -1 }); // a resting limit is filled and stopped
  // a clean win: fill on candle 0, target 12 on candle 1
  const W = [c(0, 11, 11, 9.8, 10.5), c(1, 10.5, 12.2, 10.4, 12.1)];
  assert.equal(sim2R(W, 1, 10, 9, 1000, 1e9, 1e6).R, 2);
  assert.equal(multi(W, 1, 10, 9, 'lim', 1000, 1e9, 2, 1e6)?.R[1], undefined); // multi waits for its other exits (6R, trail)
  const w = welch([1, 2, 3, 4], [0, 1, 2, 3]); assert.equal(w.diff, 1); assert.ok(w.t > 0 && w.p > 0 && w.p < 1);
});
