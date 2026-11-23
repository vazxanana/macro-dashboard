// tests/big-candle-fade.test.mjs - the big-candle fade: pre-registration, RESULT.md agrees with result.json, the verdict follows
// the bar, the 36 cells are as pre-registered, and the signal and trade rules on hand-made candles (no look-ahead). Offline.
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import * as K from '../research/edge/_lib/edgekit.mjs';
import { atr14 } from '../research/edge/dom-trade-through/run.mjs';
import { breaks } from '../research/edge/grid7-wide-fade/run.mjs';
import { signals, trade, cellName, cellIndex, NCELL, KS } from '../research/edge/big-candle-fade/run.mjs';

const DIR = new URL('../research/edge/big-candle-fade/', import.meta.url);
const R = JSON.parse(fs.readFileSync(new URL('result.json', DIR), 'utf8'));
const md = fs.readFileSync(new URL('RESULT.md', DIR), 'utf8');
const pre = fs.readFileSync(new URL('PREREGISTRATION.md', DIR), 'utf8');
const f3 = (x) => (x >= 0 ? '+' : '-') + Math.abs(x).toFixed(3);

function market(n, seed = 5) { const rnd = K.rng(seed); let p = 100; const B = [];
  for (let i = 0; i < n; i++) { const big = rnd() < 0.01 ? (rnd() - 0.5) * 12 : 0; const o = p, c = o + (rnd() - 0.5) * 0.6 + big;
    const h = Math.max(o, c) + rnd() * 0.2, l = Math.min(o, c) - rnd() * 0.2; p = c; B.push({ t: i * 300, o, h, l, c, e: i * 300 + 300 }); }
  return B; }
const frames = (M5) => ({ '15m': K.resample(M5, 900), '1h': K.resample(M5, 3600) });

test('pre-registration names the cells, the windows, the bar, the comparison and the assumed costs', () => {
  for (const w of ['36', '2005-01-01 to 2014-12-31', '2015-01-01 to 2026-10-31', 'Holm', 'ASSUMED', 'mirror', 'Welch', 'BEFORE costs', 'k = **1.5, 2 or 3**'])
    assert.ok(pre.includes(w), w);
});

test('the 36 cells are distinct and as pre-registered', () => {
  const names = Array.from({ length: NCELL }, (_, i) => cellName(i).name);
  assert.equal(new Set(names).size, 36);
  assert.equal(cellName(cellIndex(0, 1, 0, 2)).name, 'm15 k2 break half');
  assert.equal(cellName(cellIndex(1, 2, 1, 0)).name, 'h1 k3 nobreak 1R');
  assert.deepEqual(R.cells.map((c) => c.cell), names);
});

test('a big candle is sized by the ATR of the candles before it, and split by the break', () => {
  const M5 = market(20000); const F = frames(M5); const { big } = signals(F);
  assert.ok(big.length > 20);
  for (const g of big) { const T = F[g.tf === 0 ? '15m' : '1h']; const b = T[g.j], a = atr14(T)[g.j - 1];
    assert.equal(g.a, a); const body = Math.abs(b.c - b.o); assert.ok(body > KS[g.kmax] * a);
    if (g.kmax < 2) assert.ok(!(body > KS[g.kmax + 1] * a));
    assert.equal(g.d, b.c > b.o ? 1 : -1); assert.equal(g.ts, b.e);
    assert.equal(g.brk, breaks(T).some((e) => e.i === g.j && e.dir === g.d)); }
});

test('no look-ahead: the signals known by a time are the same on candles cut there', () => {
  const M5 = market(20000, 9); const full = signals(frames(M5)).big;
  const key = (g) => [g.tf, g.ts, g.d, g.ext, g.a, g.kmax, g.brk].join('|');
  for (const T of [600000, 2400000, 5000000]) {
    const cut = signals(frames(M5.filter((b) => b.e <= T))).big.filter((g) => g.ts <= T).map(key);
    assert.deepEqual(cut, full.filter((g) => g.ts <= T).map(key), 'cut ' + T); }
});

test('every fade trade has its stop on the losing side; fill is the next 5-minute open', () => {
  const M5 = market(20000, 3); const { big } = signals(frames(M5)); let n = 0;
  for (const g of big) { const r = trade(M5, g, 0.01); if (!r || r.skip) continue; n++;
    assert.ok(r.s * (r.fill - r.stop) > 0); assert.equal(r.s, -g.d); assert.ok(r.t >= g.ts); assert.equal(r.fill, M5[r.fi].o); }
  assert.ok(n > 10);
});

test('line 3 is the verdict line and matches result.json; the verdict follows the bar', () => {
  const line = md.split('\n')[2];
  assert.ok(line.startsWith(`**Verdict: ${R.verdict}.`), line); assert.ok(line.includes(R.headline));
  for (const c of R.cells) {
    const ok = c.disc.n >= 300 && c.conf.n >= 300 && c.disc.mean > 0 && c.conf.mean > 0 && c.disc.t >= 2 && c.conf.t >= 2 && c.holm < 0.05
      && c.welchDisc != null && c.welchConf != null && c.welchDisc >= 2 && c.welchConf >= 2;
    assert.equal(c.pass, ok, c.cell); }
  assert.equal(R.verdict, R.markets.length < 8 ? 'INCONCLUSIVE' : R.cells.some((c) => c.pass) ? 'PASS' : 'FAIL');
  assert.deepEqual(R.passed, R.cells.filter((c) => c.pass).map((c) => c.cell));
  assert.deepEqual(R.assumedCosts, ['xag', 'nzdusd', 'usdcad', 'usdchf', 'eurjpy']);
});

test('RESULT.md lists every cell and the plain fade with their figures from result.json', () => {
  const lines = md.split('\n');
  for (const c of R.cells) { const row = lines.find((l) => l.startsWith(`| ${c.cell} |`)); assert.ok(row, c.cell);
    assert.ok(row.includes(f3(c.conf.mean)) && row.includes(c.conf.t.toFixed(2)), c.cell);
    assert.ok(row.includes(f3(c.disc.mean)) && row.includes(c.disc.t.toFixed(2)), c.cell); }
  for (const p of R.plainFade) { const row = lines.find((l) => l.startsWith(`| ${p.name} |`)); assert.ok(row, p.name); assert.ok(row.includes(f3(p.conf.mean))); }
  for (const x of R.cut) assert.equal(x.missing + x.extra, 0, 'cut test ' + x.market + ' ' + x.cut);
  assert.ok(R.cut.length >= 5);
});
