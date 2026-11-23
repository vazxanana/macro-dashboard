// tests/structure-bos-choch-wide.test.mjs - BOS / ChoCh structure-break study: the pre-registration, RESULT.md agrees with
// result.json, the verdict follows the bar, the 51 cells are the pre-registered ones, the break detector equals edgekit's,
// stops sit on the losing side, and signals computed on cut candles equal the full run's (no look-ahead). Offline.
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import * as K from '../research/edge/_lib/edgekit.mjs';
import { frames } from '../research/edge/combo-grid-3/run.mjs';
import { breaks, signals, cellName, cellA, cellB, cellC, NCELL } from '../research/edge/structure-bos-choch-wide/run.mjs';

const DIR = new URL('../research/edge/structure-bos-choch-wide/', import.meta.url);
const R = JSON.parse(fs.readFileSync(new URL('result.json', DIR), 'utf8'));
const md = fs.readFileSync(new URL('RESULT.md', DIR), 'utf8');
const pre = fs.readFileSync(new URL('PREREGISTRATION.md', DIR), 'utf8');

// a seeded 5-minute random walk, weekdays only
function market(days = 80, seed = 11) {
  const r = K.rng(seed); const out = []; let p = 1.2; const t0 = Date.UTC(2015, 0, 5) / 1000;
  for (let i = 0; i < days * 288; i++) { const t = t0 + i * 300; const wd = new Date(t * 1000).getUTCDay(); if (wd === 0 || wd === 6) continue;
    const o = p, c = o + (r() - 0.5) * 0.0012; const h = Math.max(o, c) + r() * 0.0004, l = Math.min(o, c) - r() * 0.0004; p = c;
    out.push({ t, o, h, l, c, e: t + 300 }); }
  return out;
}

test('pre-registration names the cells, the windows, the control and the bar', () => {
  for (const w of ['51', '2005-01-01 to 2014-12-31', '2015-01-01 to 2026-10-31', 'Holm', 'ASSUMED', 'Welch', 'BOS', 'ChoCh', 'retest'.toUpperCase(), 'BEFORE costs', 'grid7-wide-fade'])
    assert.ok(pre.includes(w), w);
});

test('the 51 cells are distinct and as pre-registered', () => {
  const names = Array.from({ length: NCELL }, (_, i) => cellName(i).name);
  assert.equal(NCELL, 51); assert.equal(new Set(names).size, 51);
  assert.equal(cellName(cellA(1, 2, 1, 1)).name, 'h1 retest ChoCh 2R');
  assert.equal(cellName(cellB(0, 2)).name, 'all with bos-3rd+ 1R');
  assert.equal(cellName(cellC(1, 1)).name, 'all fade htf-against 1R');
  assert.deepEqual(R.cells.map((c) => c.cell), names);
});

test('line 3 is the verdict line and matches result.json', () => {
  const line = md.split('\n')[2];
  assert.ok(line.startsWith(`**Verdict: ${R.verdict}.`), line);
  assert.ok(line.includes(R.headline), 'headline');
  assert.ok(['PASS', 'FAIL', 'INCONCLUSIVE'].includes(R.verdict));
});

test('the verdict follows the pre-registered bar, and every cell row is in RESULT.md', () => {
  for (const c of R.cells) {
    const ok = c.disc.n >= 300 && c.conf.n >= 300 && c.disc.mean > 0 && c.conf.mean > 0 && c.disc.t >= 2 && c.conf.t >= 2 && c.holm < 0.05
      && c.welchDisc >= 2 && c.welchConf >= 2;
    assert.equal(c.pass, ok, c.cell);
    assert.ok(md.includes(`| ${c.cell} |`), c.cell);
  }
  const n = R.cells.filter((c) => c.pass).length;
  assert.equal(R.verdict, R.markets.length < 8 ? 'INCONCLUSIVE' : n ? 'PASS' : 'FAIL');
  assert.deepEqual(R.passed, R.cells.filter((c) => c.pass).map((c) => c.cell));
});

test('the cut test found no look-ahead on the real candles', () => {
  assert.ok(R.cut.length >= 5);
  for (const c of R.cut) { assert.equal(c.missing, 0, c.market + c.cut); assert.equal(c.extra, 0, c.market + c.cut); }
});

test('breaks() equals edgekit structure(), with BOS counts per leg', () => {
  const M5 = market(); const F = frames(M5);
  for (const tf of ['15m', '1h', '4h']) {
    const ev = breaks(F[tf]), E = K.structure(F[tf], 3).events;
    assert.equal(ev.length, E.length);
    ev.forEach((e, i) => { assert.equal(e.i, E[i].i); assert.equal(e.dir, E[i].dir); assert.equal(e.kind, E[i].kind); assert.equal(e.level, E[i].level);
      if (e.kind === 'ChoCh') assert.equal(e.cnt, 0); else assert.ok(e.cnt >= 1 && (i === 0 || e.cnt === (ev[i - 1].kind === 'BO' ? ev[i - 1].cnt + 1 : 1))); });
  }
});

test('every signal has its stop on the losing side of the break close, and a retest comes after its break', () => {
  const M5 = market(); const F = frames(M5); const S = signals(F);
  assert.ok(S.length > 100); assert.ok(S.some((g) => g.en === 2));
  for (const g of S) {
    const px = M5[K.closedCount(M5, g.ts) - 1].c;
    if (g.en !== 1) assert.ok(g.s * (px - g.stop) > 0 || g.en === 2, 'with: stop on the losing side');
    if (g.en === 1) assert.equal(g.s, -g.d); else assert.equal(g.s, g.d);
    if (g.en === 2) assert.ok(g.ts > g.brk);
  }
});

test('signals computed on candles cut at a date equal the full run (synthetic)', () => {
  const M5 = market(); const F = frames(M5); const key = (g) => [g.tf, g.en, g.kd, g.cnt, g.h, g.ts, g.d, g.stop.toFixed(9)].join('|');
  const full = signals(F);
  for (const T of [M5[6000].e, M5[11000].e, M5[15000].e]) {
    const cut = new Set(signals(frames(M5.filter((b) => b.e <= T))).filter((g) => g.ts <= T).map(key));
    const want = new Set(full.filter((g) => g.ts <= T).map(key));
    assert.deepEqual([...want].filter((k) => !cut.has(k)), []); assert.deepEqual([...cut].filter((k) => !want.has(k)), []);
  }
});
