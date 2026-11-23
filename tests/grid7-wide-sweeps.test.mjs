// tests/grid7-wide-sweeps.test.mjs - the wide sweep grid: pre-registration, RESULT.md agrees with result.json, the verdict
// follows the bar, the cells are the pre-registered 48, the sweep detector on hand-made candles and a no-look-ahead check.
// Offline.
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import * as K from '../research/edge/_lib/edgekit.mjs';
import { frames } from '../research/edge/combo-grid-3/run.mjs';
import { signals, sigKey, cellName, cellS, cellC, controlOf, NCELL, NS } from '../research/edge/grid7-wide-sweeps/run.mjs';

const DIR = new URL('../research/edge/grid7-wide-sweeps/', import.meta.url);
const R = JSON.parse(fs.readFileSync(new URL('result.json', DIR), 'utf8'));
const md = fs.readFileSync(new URL('RESULT.md', DIR), 'utf8');
const pre = fs.readFileSync(new URL('PREREGISTRATION.md', DIR), 'utf8');
const f3 = (x) => (x >= 0 ? '+' : '-') + Math.abs(x).toFixed(3);

test('pre-registration names the cells, the windows, the bar, the control and the assumed costs', () => {
  for (const w of ['48', '2005-01-01 to 2014-12-31', '2015-01-01 to 2026-10-31', 'Holm', 'ASSUMED', 'Side-flipped', 'BEFORE costs',
    'Welch', 'grid7-wide-fade', 'direction()', '0.1 x ATR(14) of the Daily'])
    assert.ok(pre.includes(w), w);
});

test('the 48 cells are distinct and as pre-registered; each sweep cell has its control', () => {
  const names = Array.from({ length: NCELL }, (_, i) => cellName(i).name);
  assert.equal(new Set(names).size, 48); assert.equal(NS, 36);
  assert.equal(cellName(cellS(0, 0, 0, 0)).name, 'asia london 1R all');
  assert.equal(cellName(cellS(2, 1, 2, 1)).name, 'week ny range agree');
  assert.equal(cellName(cellC(1, 2, 0)).name, 'fade ny swing all');
  assert.equal(cellName(controlOf(cellS(1, 1, 2, 1))).name, 'fade ny swing agree');
  assert.equal(cellName(controlOf(cellS(2, 0, 1, 0))).name, 'fade london 2R all');
  assert.deepEqual(R.cells.map((c) => c.cell), names);
});

test('line 3 is the verdict line and matches result.json', () => {
  const line = md.split('\n')[2];
  assert.ok(line.startsWith(`**Verdict: ${R.verdict}.`), line);
  assert.ok(line.includes(R.headline), 'headline');
  assert.ok(['PASS', 'FAIL', 'INCONCLUSIVE'].includes(R.verdict));
});

test('the verdict follows the pre-registered bar', () => {
  for (const c of R.cells) {
    const ok = c.kind === 'sweep' && c.disc.n >= 300 && c.conf.n >= 300 && c.disc.mean > 0 && c.conf.mean > 0 && c.disc.t >= 2 && c.conf.t >= 2 && c.holm < 0.05
      && c.vsControl && c.vsControl.d >= 2 && c.vsControl.c >= 2;
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
    assert.ok(row.includes(f3(c.conf.mean)) && row.includes(c.conf.t.toFixed(2)), c.cell);
    assert.ok(row.includes(f3(c.disc.mean)) && row.includes(c.disc.t.toFixed(2)), c.cell);
  }
  for (const x of R.cut) assert.equal(x.missing + x.extra, 0, 'cut test ' + x.market + ' ' + x.cut);
  assert.ok(R.cut.length >= 5);
  assert.equal(R.controlGate.length, 2);
  for (const g of R.controlGate) assert.ok(g.same, 'control equals grid7-wide-fade ' + g.session);
});

// hand-made 5-minute candles: a quiet random walk, weekdays only
function walk(days, seed, t0 = Date.UTC(2021, 0, 4) / 1000) {
  const rnd = K.rng(seed); let p = 100; const B = [];
  for (let t = t0; t < t0 + days * 86400; t += 300) { const wd = new Date(t * 1000).getUTCDay(); if (wd === 0 || wd === 6) continue;
    const o = p, c = o + (rnd() - 0.5) * 0.2, h = Math.max(o, c) + rnd() * 0.08, l = Math.min(o, c) - rnd() * 0.08; p = c; B.push({ t, o, h, l, c, e: t + 300 }); }
  return B;
}

test('a sweep of the Asia high in London is found, sold, with the stop above the extreme', () => {
  const B = walk(40, 3); const D0 = Date.UTC(2021, 1, 10) / 1000;   // a Wednesday
  const asia = B.filter((b) => b.t >= D0 && b.t < D0 + 7 * 3600); const hi = Math.max(...asia.map((b) => b.h));
  // 07:00-08:14 flat under the high; 08:00-08:14: from inside, a spike 2 above the Asia high, closing back inside within the M15 candle
  for (const b of B) if (b.t >= D0 + 7 * 3600 && b.t < D0 + 8 * 3600 + 900) { const m = hi - 0.5; b.o = m; b.c = m; b.h = m + 0.05; b.l = m - 0.05; }
  const sp = B.find((b) => b.t === D0 + 8 * 3600 + 300); sp.h = hi + 2;
  const g = signals(frames(B)).find((x) => x.kind === 0 && x.rg === 0 && x.se === 0 && x.ts > D0 && x.ts < D0 + DAYS(1) && x.s === -1);
  assert.ok(g, 'sweep found'); assert.equal(g.ts, D0 + 8 * 3600 + 900); assert.equal(g.X, hi + 2);
  assert.ok(g.stop > g.X && g.edge === hi, 'stop above the extreme (the losing side of a sell)');
});
const DAYS = (n) => n * 86400;

test('no look-ahead: changing every price after a moment leaves the signals known by then unchanged', () => {
  const B = walk(90, 9), F = frames(B), cutT = Date.UTC(2021, 2, 10, 13) / 1000;
  const before = signals(F).filter((g) => g.ts <= cutT).map(sigKey);
  const B2 = B.map((b) => (b.t >= cutT ? { ...b, o: b.o * 1.3, h: b.h * 1.3 + 1, l: b.l * 1.3 - 1, c: b.c * 1.3 } : b));
  const after = signals(frames(B2)).filter((g) => g.ts <= cutT).map(sigKey);
  assert.ok(before.length > 20, 'signals exist'); assert.deepEqual(after, before);
  const cut = signals(frames(B.filter((b) => b.e <= cutT))).filter((g) => g.ts <= cutT).map(sigKey);
  assert.deepEqual(new Set(cut), new Set(before));
  for (const g of signals(F)) if (g.kind === 0) assert.ok(g.s * (g.X - g.stop) > 0 && g.s * (g.edge - g.stop) > 0, 'stop past the extreme');
});
