// tests/fade-htf.test.mjs - the H4 / D1 fade: pre-registration, RESULT.md agrees with result.json, the verdict follows the bar,
// the 12 fade cells (+ 12 "with" rows) are the pre-registered ones, the weekend fold, and no look-ahead on hand-made candles.
// Offline.
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import * as K from '../research/edge/_lib/edgekit.mjs';
import { foldDays, htf, signals, cellName, cellOf, NCELL, pipOf } from '../research/edge/fade-htf/run.mjs';

const DIR = new URL('../research/edge/fade-htf/', import.meta.url);
const R = JSON.parse(fs.readFileSync(new URL('result.json', DIR), 'utf8'));
const md = fs.readFileSync(new URL('RESULT.md', DIR), 'utf8');
const pre = fs.readFileSync(new URL('PREREGISTRATION.md', DIR), 'utf8');
const f3 = (x) => (x >= 0 ? '+' : '-') + Math.abs(x).toFixed(3);

test('pre-registration names the cells, the windows, the bar and the assumed costs', () => {
  for (const w of ['24', '2005-01-01 to 2014-12-31', '2015-01-01 to 2026-10-31', 'Holm', 'ASSUMED', 'foldWeekend', 'BEFORE costs', 'too few to judge'])
    assert.ok(pre.includes(w), w);
});

test('the 12 fade cells are distinct and as pre-registered', () => {
  const names = Array.from({ length: NCELL }, (_, i) => cellName(i).name);
  assert.equal(new Set(names).size, 12);
  assert.equal(cellName(cellOf(1, 0, 2)).name, 'd1 ext swing fade');
  assert.equal(cellName(cellOf(0, 1, 1), 'with').name, 'h4 atr 2R with');
  assert.deepEqual(R.cells.map((c) => c.cell), names);
  assert.deepEqual(R.cells.map((c) => c.with.cell), names.map((n) => n.replace(/fade$/, 'with')));
  assert.equal(pipOf('usdjpy'), 0.01); assert.equal(pipOf('eurusd'), 0.0001); assert.equal(pipOf('xau'), 1);
});

test('line 3 is the verdict line and matches result.json', () => {
  const line = md.split('\n')[2];
  assert.ok(line.startsWith(`**Verdict: ${R.verdict}.`), line);
  assert.ok(line.includes(R.headline), 'headline');
  assert.ok(['PASS', 'FAIL', 'INCONCLUSIVE'].includes(R.verdict));
});

test('the verdict follows the pre-registered bar', () => {
  for (const c of R.cells) {
    const enough = c.disc.n >= 300 && c.conf.n >= 300;
    const ok = enough && c.disc.mean > 0 && c.conf.mean > 0 && c.disc.t >= 2 && c.conf.t >= 2 && c.holm < 0.05;
    assert.equal(c.pass, ok, c.cell);
    assert.equal(c.status, !enough ? 'too few' : ok ? 'pass' : 'fail', c.cell);
  }
  const judged = R.cells.filter((c) => c.status !== 'too few');
  assert.equal(R.verdict, R.markets.length < 8 || !judged.length ? 'INCONCLUSIVE' : R.cells.some((c) => c.pass) ? 'PASS' : 'FAIL');
  assert.deepEqual(R.passed, R.cells.filter((c) => c.pass).map((c) => c.cell));
  assert.deepEqual(R.assumedCosts, ['xag', 'nzdusd', 'usdcad', 'usdchf', 'eurjpy']);
});

test('RESULT.md lists every cell and its mirror with the figures of result.json', () => {
  for (const c of R.cells) for (const [name, x] of [[c.cell, c], [c.with.cell, c.with]]) {
    const row = md.split('\n').find((l) => l.startsWith(`| ${name} |`)); assert.ok(row, name);
    assert.ok(row.includes(f3(x.conf.mean)) && row.includes(x.conf.t.toFixed(2)), name);
    assert.ok(row.includes(f3(x.disc.mean)) && row.includes(x.disc.t.toFixed(2)), name);
  }
  for (const x of R.cut) assert.equal(x.missing + x.extra, 0, 'cut test ' + x.market + ' ' + x.cut);
  assert.ok(R.cut.length >= 5);
  for (const s of R.stopSize) assert.ok(md.includes(`| ${s.market}`), s.market);
});

test('foldDays folds Saturday and Sunday into the next weekday', () => {
  const day = (y, m, d, o, h, l, c) => { const t = Date.UTC(y, m, d) / 1000; return { t, o, h, l, c, e: t + 86400 }; };
  const D = [day(2026, 10, 20, 1, 2, 0.5, 1.5), day(2026, 10, 22, 1.4, 1.6, 1.3, 1.5), day(2026, 10, 23, 1.5, 1.7, 1.45, 1.6)];
  const F = foldDays(D);
  assert.equal(F.length, 2);
  assert.deepEqual([F[1].t, F[1].o, F[1].h, F[1].l, F[1].c], [D[2].t, 1.4, 1.7, 1.3, 1.6]);
});

test('signals on cut candles equal the full run (no look-ahead), stops on the losing side', () => {
  const rnd = K.rng(5); let p = 100; const M5 = [];
  const t0 = Date.UTC(2020, 0, 6) / 1000;
  for (let i = 0; i < 40000; i++) { const o = p, c = o + (rnd() - 0.5) * 0.4, h = Math.max(o, c) + rnd() * 0.2, l = Math.min(o, c) - rnd() * 0.2; p = c;
    M5.push({ t: t0 + i * 300, o, h, l, c, e: t0 + i * 300 + 300 }); }
  const key = (g) => [g.tf, g.ts, g.d, g.ext, g.a, g.opp].join('|');
  const full = signals(htf(M5));
  assert.ok(full.some((g) => g.tf === 0) && full.some((g) => g.tf === 1));
  for (const g of full) { const fill = g.ext, s = -g.d; assert.ok(s * (fill - (g.ext + g.d * 0.1 * g.a)) > 0); }
  for (const frac of [0.3, 0.55, 0.8]) {
    const T = M5[Math.floor(M5.length * frac)].e;
    const cut = signals(htf(M5.filter((b) => b.e <= T))).filter((g) => g.ts <= T).map(key);
    assert.deepEqual(cut, full.filter((g) => g.ts <= T).map(key));
  }
});
