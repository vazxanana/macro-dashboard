// tests/grid7-wide-trend-pullback.test.mjs - the wide trend-pullback grid: pre-registration, RESULT.md agrees with result.json,
// the verdict follows the bar, the cells index correctly, the trade engine and the signal walker on hand-made candles. Offline.
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { exits, cellIndex, cellName, NCELL, CTX, contextsOf, depthBucket, chainSignals } from '../research/edge/grid7-wide-trend-pullback/run.mjs';

const DIR = new URL('../research/edge/grid7-wide-trend-pullback/', import.meta.url);
const R = JSON.parse(fs.readFileSync(new URL('result.json', DIR), 'utf8'));
const md = fs.readFileSync(new URL('RESULT.md', DIR), 'utf8');
const f3 = (x) => (x >= 0 ? '+' : '-') + Math.abs(x).toFixed(3);

test('pre-registration names the cells, the windows, the bar, the control and the assumed costs', () => {
  const p = fs.readFileSync(new URL('PREREGISTRATION.md', DIR), 'utf8');
  for (const w of ['54', '2005-01-01 to 2014-12-31', '2015-01-01 to 2026-10-31', 'Holm', 'Welch', 'ASSUMED', 'side-flipped', 'control', 'grid7-wide-fade', '0.382', '0.618'])
    assert.ok(p.includes(w), w);
});

test('line 3 is the verdict line and matches result.json', () => {
  const line = md.split('\n')[2];
  assert.ok(line.startsWith(`**Verdict: ${R.verdict}.`), line);
  assert.ok(line.includes(R.headline), 'headline');
  assert.ok(['PASS', 'FAIL', 'INCONCLUSIVE'].includes(R.verdict));
  assert.equal(typeof R.headline, 'string');
});

test('the verdict follows the pre-registered bar', () => {
  assert.equal(R.cells.length, 54);
  for (const c of R.cells) {
    const ok = c.disc.n >= 300 && c.conf.n >= 300 && c.disc.mean > 0 && c.conf.mean > 0 && c.disc.t >= 2 && c.conf.t >= 2
      && c.holm < 0.05 && c.vsControl.d != null && c.vsControl.c != null && c.vsControl.d >= 2 && c.vsControl.c >= 2;
    assert.equal(c.pass, ok, c.cell);
  }
  assert.equal(R.verdict, R.cells.some((c) => c.pass) ? 'PASS' : 'FAIL');
  assert.deepEqual(R.passed, R.cells.filter((c) => c.pass).map((c) => c.cell));
  assert.deepEqual(R.assumedCosts, ['xag', 'nzdusd', 'usdcad', 'usdchf', 'eurjpy']);
  assert.equal(R.markets.length, 10);
});

test('RESULT.md lists every cell with its figures from result.json', () => {
  for (const c of R.cells) {
    const row = md.split('\n').find((l) => l.startsWith(`| ${c.cell} |`)); assert.ok(row, c.cell);
    assert.ok(row.includes(`${f3(c.disc.mean)} (${c.disc.t.toFixed(2)})`), c.cell + ' disc');
    assert.ok(row.includes(`${f3(c.conf.mean)} (${c.conf.t.toFixed(2)})`), c.cell + ' conf');
  }
  for (const f of R.fadeBeside) assert.ok(md.includes(`| ${f.cell} |`), f.cell);
});

test('the cut test found nothing that a cut series would not know', () => {
  assert.ok(R.cut.length >= 10);
  assert.ok(R.cut.every((x) => x.n > 0));
  assert.equal(R.cut.reduce((a, x) => a + x.missing + x.extra, 0), 0);
});

test('cells index correctly; contexts and depth buckets', () => {
  const seen = new Set();
  for (let i = 0; i < NCELL; i++) { const n = cellName(i); assert.equal(cellIndex(n.ch, n.x, n.k), i); seen.add(n.name); }
  assert.equal(seen.size, 54); assert.equal(CTX.length, 9);
  assert.equal(depthBucket(0.2), 'shallow'); assert.equal(depthBucket(0.5), 'mid'); assert.equal(depthBucket(0.7), 'deep');
  assert.deepEqual(contextsOf({ depth: 0.5, eg: true, dom: false }), [0, 3, 7]);
  assert.deepEqual(contextsOf({ depth: 0.9, eg: false, dom: false }), [0, 6]);
  assert.deepEqual(contextsOf({ depth: 0.1, eg: false, dom: true }), [0, 1, 8]);
});

test('the trade engine: stop first, gaps at the open, three targets, the time limit', () => {
  const bar = (t, o, h, l, c) => ({ t, o, h, l, c, e: t + 300 });
  let M = [bar(0, 100, 100.5, 99.5, 100.2), bar(300, 100.2, 101.2, 100, 101), bar(600, 101, 103.5, 100.8, 103)];
  let r = exits(M, 1, 0, 99, [1, 2, 3], 86400); assert.deepEqual(r.R, [1, 2, 3]);
  // no ext target: NaN stays, the others still resolve
  r = exits(M, 1, 0, 99, [1, 2, NaN], 86400); assert.deepEqual(r.R.slice(0, 2), [1, 2]); assert.ok(Number.isNaN(r.R[2]));
  M = [bar(0, 100, 104, 98, 100)]; r = exits(M, 1, 0, 99, [1, 2, 3], 86400); assert.deepEqual(r.R, [-1, -1, -1]);
  M = [bar(0, 100, 100.4, 99.6, 100), bar(300, 98, 98.5, 97.5, 98)]; r = exits(M, 1, 0, 99, [1, 2, 3], 86400); assert.deepEqual(r.R, [-2, -2, -2]);
  M = [bar(0, 100, 100.4, 99.6, 99.8), bar(300, 99.8, 100.1, 99.5, 99.5)]; r = exits(M, -1, 0, 101, [1, 2, 4], 600); assert.deepEqual(r.R.map((x) => +x.toFixed(6)), [0.5, 0.5, 0.5]);
  assert.equal(exits([bar(0, 100, 101, 99, 100)], 1, 0, 100.5, [1, 2, 3], 600), null);
});

test('signals: closed candles only, every real trade with the move and its stop past the pullback extreme', () => {
  // a seeded random walk with drift changes, on 15m / 1h / 4h buckets of a 5-minute series
  let seed = 7; const rnd = () => { seed = (seed * 1103515245 + 12345) % 2147483648; return seed / 2147483648; };
  const M5 = []; let px = 100, t = Date.UTC(2010, 0, 4) / 1000, drift = 0.002;
  for (let i = 0; i < 60000; i++) { if (i % 3000 === 0) drift = -drift; const o = px; px += drift + (rnd() - 0.5) * 0.12;
    const h = Math.max(o, px) + rnd() * 0.04, l = Math.min(o, px) - rnd() * 0.04; M5.push({ t, o, h, l, c: px, e: t + 300 }); t += 300; }
  const rs = (sec) => { const out = []; let cur = null; for (const b of M5) { const k = Math.floor(b.t / sec) * sec;
    if (!cur || cur.t !== k) { cur = { t: k, o: b.o, h: b.h, l: b.l, c: b.c, e: k + sec }; out.push(cur); } else { cur.h = Math.max(cur.h, b.h); cur.l = Math.min(cur.l, b.l); cur.c = b.c; } } return out; };
  const F = { '5m': M5, '15m': rs(900), '1h': rs(3600), '4h': rs(14400) };
  const full = chainSignals(F, 1);
  assert.ok(full.filter((g) => g.kind === 'real').length > 5);
  for (const g of full) { assert.ok(g.depth >= 0 && g.depth < 1, 'depth'); if (g.kind === 'real') assert.ok(g.s * (g.ext - g.stop) > 0, 'ext beyond the stop'); }
  // cut: signals known by the cut equal the full run's
  const T = M5[40000].t, cut = {}; for (const k of Object.keys(F)) cut[k] = F[k].filter((b) => b.e <= T);
  const key = (g) => [g.kind, g.tt, g.s, g.stop, g.ext, g.depth, g.eg, g.dom].join('|');
  const a = chainSignals(cut, 1).filter((g) => g.ts <= T).map(key), b = full.filter((g) => g.ts <= T).map(key);
  assert.deepEqual(a, b);
});
