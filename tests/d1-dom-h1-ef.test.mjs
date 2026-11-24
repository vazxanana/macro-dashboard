// tests/d1-dom-h1-ef.test.mjs - Daily dominant zone + H1 failed engulf: the pre-registration, RESULT.md agrees with
// result.json, the verdict follows the bar, and on seeded candles the signal reads no later candle and keeps its stop on
// the losing side. Offline.
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import * as K from '../research/edge/_lib/edgekit.mjs';
import { frames } from '../research/edge/combo-grid-3/run.mjs';
import { signals, stopOf, cellName, cellIndex, NCELL, passOf } from '../research/edge/d1-dom-h1-ef/run.mjs';

const DIR = new URL('../research/edge/d1-dom-h1-ef/', import.meta.url);
const R = JSON.parse(fs.readFileSync(new URL('result.json', DIR), 'utf8'));
const md = fs.readFileSync(new URL('RESULT.md', DIR), 'utf8');
const pre = fs.readFileSync(new URL('PREREGISTRATION.md', DIR), 'utf8');
const f3 = (x) => (x >= 0 ? '+' : '-') + Math.abs(x).toFixed(3);

function seeded(seed, n = 120000) { const rnd = K.rng(seed); let p = 100; const B = []; const t0 = Date.UTC(2015, 0, 5) / 1000;
  for (let i = 0; i < n; i++) { const o = p, c = o + (rnd() - 0.5) * 0.2, h = Math.max(o, c) + rnd() * 0.05, l = Math.min(o, c) - rnd() * 0.05; p = c;
    B.push({ t: t0 + i * 300, o, h, l, c, e: t0 + i * 300 + 300 }); } return B; }
const key = (g) => [g.loc, g.k, g.ts, g.d, g.ext, g.a.toFixed(10), g.zat, g.touch].join('|');

test('pre-registration names the cells, the windows and the bar', () => {
  for (const w of ['2 x 2 x 3 = 12', '2005-01-01 to 2014-12-31', '2015-01-01 to 2026-10-31', 'Holm', 'AFTER costs', 'n >= 300', 'first return'.toUpperCase().slice(0, 5)])
    assert.ok(pre.includes(w), w);
});

test('the 12 cells are distinct and as pre-registered', () => {
  const names = Array.from({ length: NCELL }, (_, i) => cellName(i).name);
  assert.equal(new Set(names).size, 12);
  assert.equal(cellName(cellIndex(0, 0, 1)).name, 'visit W12 2R');
  assert.equal(cellName(cellIndex(1, 1, 2)).name, 'any W24 3R');
  assert.deepEqual(R.cells.map((c) => c.cell), names);
});

test('line 3 is the verdict line and matches result.json', () => {
  const line = md.split('\n')[2];
  assert.ok(line.startsWith(`**Verdict: ${R.verdict}.`), line);
  assert.ok(line.includes(R.headline), 'headline');
  assert.ok(['PASS', 'FAIL', 'INCONCLUSIVE'].includes(R.verdict));
});

test('the verdict follows the pre-registered bar (after costs)', () => {
  for (const c of R.cells) {
    const ok = c.disc.n >= 300 && c.conf.n >= 300 && c.disc.meanNet > 0 && c.conf.meanNet > 0 && c.disc.tNet >= 2 && c.conf.tNet >= 2 && c.holm < 0.05;
    assert.equal(c.pass, ok, c.cell);
    assert.equal(passOf({ d: c.disc, c: c.conf }, c.holm), ok);
    assert.ok(c.disc.meanNet <= c.disc.mean && c.conf.meanNet <= c.conf.mean, 'costs only take');
  }
  const enough = R.cells.some((c) => c.checks.n);
  assert.equal(R.verdict, R.cells.some((c) => c.pass) ? 'PASS' : enough ? 'FAIL' : 'INCONCLUSIVE');
  assert.deepEqual(R.passed, R.cells.filter((c) => c.pass).map((c) => c.cell));
  assert.deepEqual(R.markets, ['xau', 'eurusd', 'gbpusd', 'usdjpy', 'audusd']);
  // W12 cells are a subset of W24 cells
  for (const loc of ['visit', 'any']) for (const x of ['1R', '2R', '3R']) { const a = R.cells.find((c) => c.cell === `${loc} W12 ${x}`), b = R.cells.find((c) => c.cell === `${loc} W24 ${x}`);
    assert.ok(a.conf.n <= b.conf.n && a.disc.n <= b.disc.n); }
});

test('RESULT.md lists every cell with its figures from result.json', () => {
  for (const c of R.cells) {
    const row = md.split('\n').find((l) => l.startsWith(`| ${c.cell} |`)); assert.ok(row, c.cell);
    assert.ok(row.includes(f3(c.conf.mean)) && row.includes(f3(c.conf.meanNet)) && row.includes(c.conf.tNet.toFixed(2)), c.cell);
    assert.ok(row.includes(f3(c.disc.mean)) && row.includes(f3(c.disc.meanNet)) && row.includes(c.disc.tNet.toFixed(2)), c.cell);
  }
  for (const x of R.cut) assert.equal(x.missing + x.extra, 0, 'cut test ' + x.market + ' ' + x.cut);
  assert.ok(R.cut.length >= 5);
});

test('seeded candles: signals exist, the stop is on the losing side, the engulf rule and window hold', () => {
  const M5 = seeded(5); const F = frames(M5); const S = signals(F); const H = F['1h'];
  assert.ok(S.length > 20, 'signals ' + S.length); assert.ok(S.some((g) => g.d > 0) && S.some((g) => g.d < 0));
  assert.ok(S.some((g) => g.loc === 0) && S.some((g) => g.loc === 1));
  for (const g of S) {
    const j = K.closedCount(H, g.ts) - 1, b = H[j]; assert.equal(b.e, g.ts);
    const stop = stopOf(g, 0.01);
    assert.ok(g.d > 0 ? stop < b.c && stop < g.ext : stop > b.c && stop > g.ext, 'stop side');
    assert.ok(g.k >= 0 && g.k < 24); assert.ok(g.touch >= g.zat && g.ts > g.touch && g.ts > g.zat);
    // the failing candle closes with the zone's side and not beyond the zone's far side
    assert.ok(g.d > 0 ? b.c >= g.bot : b.c <= g.top);
    // the extreme is the extreme of the H1 candles from the touch through the failing candle
    const ti = j - g.k; assert.equal(H[ti].t, g.touch); let e = g.d > 0 ? Infinity : -Infinity;
    for (let q = ti; q <= j; q++) e = g.d > 0 ? Math.min(e, H[q].l) : Math.max(e, H[q].h); assert.equal(e, g.ext);
    assert.ok(g.d > 0 ? H[ti].l <= g.top : H[ti].h >= g.bot, 'the touch candle trades into the zone');
  }
  // one signal at most per Daily zone and engulf rule; the "visit" signal is never earlier than the "any" one
  const seen = new Set(); for (const g of S) { const k = g.loc + '|' + g.zat + '|' + g.d + '|' + g.top; assert.ok(!seen.has(k)); seen.add(k); }
  for (const g of S.filter((x) => x.loc === 0)) { const a = S.find((x) => x.loc === 1 && x.zat === g.zat && x.top === g.top && x.d === g.d); assert.ok(a && a.ts <= g.ts); }
});

test('seeded candles: no look-ahead (cut after a date, and later prices changed, leave earlier signals unchanged)', () => {
  const M5 = seeded(9); const full = signals(frames(M5));
  for (const frac of [0.35, 0.6, 0.85]) { const T = M5[Math.floor(M5.length * frac)].t;
    const want = full.filter((g) => g.ts <= T).map(key);
    const cut = signals(frames(M5.filter((b) => b.e <= T))).filter((g) => g.ts <= T).map(key);
    assert.deepEqual(cut, want, 'cut ' + frac);
    const rnd = K.rng(77); const alt = M5.map((b) => (b.t < T ? b : { ...b, o: b.o + 3, h: b.h + 3 + rnd(), l: b.l + 3 - rnd(), c: b.c + 3 }));
    assert.deepEqual(signals(frames(alt)).filter((g) => g.ts <= T).map(key), want, 'changed ' + frac);
    assert.ok(want.length > 5); }
});
