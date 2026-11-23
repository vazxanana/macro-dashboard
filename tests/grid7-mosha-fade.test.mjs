// tests/grid7-mosha-fade.test.mjs - the wide Mosha grid (the CF traded with it and faded): pre-registration, RESULT.md agrees
// with result.json, the verdict follows the bar, the 54 cells, and every trade's stop on the losing side on hand-made candles.
// Offline.
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import * as K from '../research/edge/_lib/edgekit.mjs';
import { cellName, cellIndex, ctrlOf, ctrlIndex, NCELL, storyTrades, controlTrades } from '../research/edge/grid7-mosha-fade/run.mjs';
import { storylines, frames } from '../research/edge/grid6-mosha-market/run.mjs';
import { atr14 } from '../research/edge/dom-trade-through/run.mjs';

const DIR = new URL('../research/edge/grid7-mosha-fade/', import.meta.url);
const R = JSON.parse(fs.readFileSync(new URL('result.json', DIR), 'utf8'));
const md = fs.readFileSync(new URL('RESULT.md', DIR), 'utf8');
const pre = fs.readFileSync(new URL('PREREGISTRATION.md', DIR), 'utf8');
const f3 = (x) => (x >= 0 ? '+' : '-') + Math.abs(x).toFixed(3);

test('pre-registration names the cells, the windows, the controls and the bar', () => {
  for (const w of ['**54**', '2005-01-01 to 2014-12-31', '2015-01-01 to 2026-10-31', 'Holm', 'ASSUMED', 'Welch', 'H4 > H1, H1 > M15, M30 > M5', 'BEFORE any run'])
    assert.ok(pre.includes(w), w);
});

test('the 54 cells are distinct, as pre-registered, and map to the right control', () => {
  const names = Array.from({ length: NCELL }, (_, i) => cellName(i).name);
  assert.equal(new Set(names).size, 54);
  assert.equal(cellName(cellIndex(1, 2, 1, 2)).name, 'fade M30>M5 clear struct');
  assert.equal(cellName(cellIndex(0, 0, 0, 0)).name, 'with H4>H1 any 1R');
  assert.equal(ctrlOf(cellIndex(1, 1, 2, 1)), ctrlIndex(1, 1, 1));
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
    const ok = c.disc.n >= 300 && c.conf.n >= 300 && c.disc.mean > 0 && c.conf.mean > 0 && c.disc.t >= 2 && c.conf.t >= 2 && c.holm < 0.05
      && c.welch.disc != null && c.welch.conf != null && c.welch.disc >= 2 && c.welch.conf >= 2;
    assert.equal(c.pass, ok, c.cell);
  }
  assert.equal(R.verdict, R.markets.length < 8 ? 'INCONCLUSIVE' : R.cells.some((c) => c.pass) ? 'PASS' : 'FAIL');
  assert.deepEqual(R.passed, R.cells.filter((c) => c.pass).map((c) => c.cell));
  assert.deepEqual(R.assumedCosts, ['xag', 'nzdusd', 'usdcad', 'usdchf', 'eurjpy']);
});

test('RESULT.md lists every cell with its figures from result.json, and the cut test is clean', () => {
  for (const c of R.cells) {
    const row = md.split('\n').find((l) => l.startsWith(`| ${c.cell} |`)); assert.ok(row, c.cell);
    assert.ok(row.includes(f3(c.conf.mean)) && row.includes(c.conf.t.toFixed(2)), c.cell);
    assert.ok(row.includes(f3(c.disc.mean)) && row.includes(c.disc.t.toFixed(2)), c.cell);
  }
  assert.ok(R.cut.length >= 5);
  for (const x of R.cut) assert.equal(x.mismatches, 0, 'cut test ' + x.market + ' ' + x.cut);
});

test('every storyline trade and control trade has its stop on the losing side (hand-made candles)', () => {
  const rnd = K.rng(23); let p = 100; const M5 = [];
  for (let i = 0; i < 40000; i++) { const o = p, c = o + (rnd() - 0.5) * 0.4 + Math.sin(i / 900) * 0.02, h = Math.max(o, c) + rnd() * 0.2, l = Math.min(o, c) - rnd() * 0.2; p = c;
    M5.push({ t: i * 300, o, h, l, c, e: i * 300 + 300 }); }
  const F = frames(M5);
  const S = storylines(F, '30m', '5m', 'any', [], {}); assert.ok(S.length > 20, 'storylines ' + S.length);
  const a = atr14(M5); let n = 0;
  for (const s of S) for (const t of storyTrades(M5, M5, a, s)) { n++;
    assert.ok(t.s * (t.fill - t.stop) > 0); assert.equal(t.s, t.sd === 0 ? s.d : -s.d);
    assert.ok(M5[t.fi].t >= M5[s.cfIdx].e, 'fill after the CF close');
    if (Number.isFinite(t.ks[2])) assert.ok(t.ks[2] >= 1); }
  assert.ok(n > 20);
  for (const t of controlTrades(M5, M5, a)) assert.ok(t.s * (t.fill - t.stop) > 0);
});
