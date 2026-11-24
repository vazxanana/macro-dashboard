// tests/msnr-switch-complements.test.mjs - the MSNR switch with complements: pre-registration, RESULT.md agrees with
// result.json, selection uses the 2005-14 after-cost figures only, the verdict follows the bar, no look-ahead. Offline.
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { cellName, cellIndex, NCELL, dayHour, MAXSEL } from '../research/edge/msnr-switch-complements/run.mjs';

const DIR = new URL('../research/edge/msnr-switch-complements/', import.meta.url);
const R = JSON.parse(fs.readFileSync(new URL('result.json', DIR), 'utf8'));
const md = fs.readFileSync(new URL('RESULT.md', DIR), 'utf8');
const pre = fs.readFileSync(new URL('PREREGISTRATION.md', DIR), 'utf8');
const f3 = (x) => (x >= 0 ? '+' : '-') + Math.abs(x).toFixed(3);

test('pre-registration names the grid, selection, holdouts and assumed costs', () => {
  for (const w of ['96 cells', '2005-01-01 to 2014-12-31', 'AFTER costs', 'at most three', 'nas100', 'Holm', 'ASSUMED', 'Cut test', 'H2'])
    assert.ok(pre.includes(w), w);
});

test('the 96 cells are distinct and in result.json order', () => {
  const names = Array.from({ length: NCELL }, (_, i) => cellName(i).name);
  assert.equal(new Set(names).size, 96);
  assert.equal(cellName(cellIndex(2, 0, 1, 0, 0, 0)).name, 'L4 c watr all any 2R');
  assert.deepEqual(R.cells.map((c) => c.cell), names);
  assert.equal(dayHour(Date.UTC(2020, 0, 2, 7) / 1000), true); assert.equal(dayHour(Date.UTC(2020, 0, 2, 20) / 1000), false);
});

test('line 3 is the verdict line and matches result.json', () => {
  const line = md.split('\n')[2];
  assert.ok(line.startsWith(`**Verdict: ${R.verdict}.`), line);
  assert.ok(line.includes(R.headline));
});

test('selection reads only the 2005-14 after-cost figures and the verdict follows the bar', () => {
  const elig = R.cells.filter((c) => c.S.n >= 300 && c.S.meanNet > 0 && c.S.tNet >= 2);
  assert.deepEqual(R.cells.filter((c) => c.eligible).map((c) => c.cell), elig.map((c) => c.cell));
  const sel = [...elig].sort((a, b) => b.S.tNet - a.S.tNet).slice(0, MAXSEL).map((c) => c.cell);
  assert.deepEqual(R.selected, sel);
  for (const c of R.cells) if (!c.selected) assert.equal(c.pass, false, c.cell);
  for (const c of R.cells.filter((x) => x.selected)) {
    const h = c.H1; assert.equal(c.pass, h.n >= 300 && h.meanNet > 0 && h.tNet >= 2 && c.h1.holm < 0.05 && c.H2.meanNet > 0, c.cell); }
  if (!sel.length) assert.equal(R.verdict, 'FAIL');
  if (R.cells.some((c) => c.pass)) assert.equal(R.verdict, 'PASS');
});

test('every cell row of RESULT.md carries the numbers of result.json', () => {
  for (const c of R.cells) { const row = md.split('\n').find((l) => l.startsWith(`| ${c.cell} |`)); assert.ok(row, c.cell);
    assert.ok(row.includes(f3(c.S.meanNet)), c.cell); if (c.H1.n) assert.ok(row.includes(f3(c.H1.meanNet)), c.cell + ' H1'); }
});

test('the cut test ran and found no look-ahead', () => {
  assert.ok(R.cut.length >= 10);
  for (const c of R.cut) { assert.equal(c.missing, 0); assert.equal(c.extra, 0); }
});
