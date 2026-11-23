// tests/fade-mtf-context.test.mjs - the M15 fade split by the higher timeframes: pre-registration, RESULT.md agrees with
// result.json, the verdict follows the bar, the 24 cells, the stage rule, and no look-ahead on hand-made candles. Offline.
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import * as K from '../research/edge/_lib/edgekit.mjs';
import { frames } from '../research/edge/combo-grid-3/run.mjs';
import { signals, stageAt, levelsOf, cellName, NCELL, LEVELS } from '../research/edge/fade-mtf-context/run.mjs';

const DIR = new URL('../research/edge/fade-mtf-context/', import.meta.url);
const R = JSON.parse(fs.readFileSync(new URL('result.json', DIR), 'utf8'));
const md = fs.readFileSync(new URL('RESULT.md', DIR), 'utf8');
const pre = fs.readFileSync(new URL('PREREGISTRATION.md', DIR), 'utf8');
const f3 = (x) => (x >= 0 ? '+' : '-') + Math.abs(x).toFixed(3);

test('pre-registration names the splits, windows, bar and assumed costs', () => {
  for (const w of ['24 cells', '2005-01-01 to 2014-12-31', '2015-01-01 to 2026-10-31', 'Holm', 'ASSUMED', 'BEFORE costs', 'P1', 'P5', 'Welch t >= 2', 'closed'])
    assert.ok(pre.includes(w), w);
});

test('the 24 cells are distinct and in result.json', () => {
  const names = Array.from({ length: NCELL }, (_, i) => cellName(i));
  assert.equal(new Set(names).size, 24); assert.equal(LEVELS.length, 12);
  assert.deepEqual(R.cells.map((c) => c.cell), names);
});

test('line 3 is the verdict line and matches result.json', () => {
  const line = md.split('\n')[2];
  assert.ok(line.startsWith(`**Verdict: ${R.verdict}.`), line);
  assert.ok(line.includes(R.headline));
});

test('the verdict and the cell passes follow the pre-registered bar', () => {
  for (const q of R.primary) assert.equal(q.holds, q.diffD > 0 && q.diffC > 0 && q.tD >= 2 && q.tC >= 2 && q.holm < 0.05, q.id);
  assert.equal(R.primary.length, 10);
  assert.equal(R.verdict, R.primary.some((q) => q.holds) ? 'PASS' : 'FAIL');
  for (const c of R.cells) if (!c.control)
    assert.equal(c.pass, c.disc.n >= 300 && c.conf.n >= 300 && c.disc.mean > 0 && c.conf.mean > 0 && c.disc.t >= 2 && c.conf.t >= 2 && c.holm < 0.05 && c.vsControlD >= 2 && c.vsControlC >= 2, c.cell);
  assert.deepEqual(R.assumedCosts, ['xag', 'nzdusd', 'usdcad', 'usdchf', 'eurjpy']);
  assert.equal(R.markets.length, 10);
  for (const x of R.cut) assert.equal(x.missing + x.extra, 0, 'cut ' + x.market + ' ' + x.cut);
  assert.ok(R.cut.length >= 5);
});

test('RESULT.md carries every cell and primary test from result.json', () => {
  for (const c of R.cells) { const row = md.split('\n').find((l) => l.startsWith(`| ${c.cell} |`)); assert.ok(row, c.cell);
    assert.ok(row.includes(f3(c.conf.mean)) && row.includes(c.conf.t.toFixed(2)) && row.includes(f3(c.disc.mean)), c.cell); }
  for (const q of R.primary) { const row = md.split('\n').find((l) => l.startsWith(`| ${q.test} |`)); assert.ok(row, q.test);
    assert.ok(row.includes(f3(q.diffC)) && row.includes(q.tC.toFixed(2)), q.test); }
});

test('stage: move, pullback, continuation as move, range', () => {
  const e4 = [{ t: 100, dir: 1, kind: 'ChoCh' }, { t: 200, dir: 1, kind: 'BO' }];
  const e1 = [{ t: 150, dir: -1 }, { t: 250, dir: -1 }, { t: 300, dir: 1 }];
  assert.equal(stageAt(e4, 1, e1, 0), 0);   // no H1 event after the H4 break: move
  assert.equal(stageAt(e4, 1, e1, 1), 1);   // H1 against after it: pullback
  assert.equal(stageAt(e4, 1, e1, 2), 0);   // then back with it: continuation, counted as move
  assert.equal(stageAt(e4, -1, e1, 2), 2);  // no H4 break: range
  const rng2 = [{ t: 1, dir: 1, kind: 'ChoCh' }, { t: 2, dir: -1, kind: 'ChoCh' }, { t: 3, dir: 1, kind: 'ChoCh' }];
  assert.equal(stageAt(rng2, 2, [], -1), 2);
  assert.deepEqual(levelsOf({ h1: 2, h4: 1, stage: 1, counter: 1, pd: 0 }), [0, 2, 3, 6, 8, 11]);
});

test('no look-ahead: signals and labels known by a time equal those computed on candles cut there', () => {
  const rnd = K.rng(3); let p = 100; const B = []; const t0 = Date.UTC(2010, 0, 4) / 1000;
  for (let i = 0; i < 30000; i++) { const o = p, c = o + (rnd() - 0.5) * 0.3, h = Math.max(o, c) + rnd() * 0.1, l = Math.min(o, c) - rnd() * 0.1; p = c; const t = t0 + i * 300; B.push({ t, o, h, l, c, e: t + 300 }); }
  const key = (g) => [g.ts, g.d, g.a.toFixed(10), g.opp, g.h1, g.h4, g.stage, g.counter, g.pd].join('|');
  const full = signals(frames(B));
  assert.ok(full.some((g) => g.counter) && full.some((g) => g.pd) && full.some((g) => g.stage === 1));
  for (const T of [B[12345].e, B[25000].e + 77]) {
    const cut = new Set(signals(frames(B.filter((b) => b.e <= T))).filter((g) => g.ts <= T).map(key));
    const want = full.filter((g) => g.ts <= T).map(key);
    assert.equal(cut.size, want.length); for (const k of want) assert.ok(cut.has(k));
  }
});
