// tests/msnr-switch-fade.test.mjs - the moment after an MSNR switch: pre-registration, RESULT.md agrees with result.json, the
// verdict follows the bar, the 42 cells are as pre-registered, the cut test found no look-ahead, and the key-level target on
// hand-made candles. Offline.
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { cellName, cellIndex, ctrlIndex, controlsOf, NCELL, ageGroup, keyLevels, keyTarget, verdictOf } from '../research/edge/msnr-switch-fade/run.mjs';

const DIR = new URL('../research/edge/msnr-switch-fade/', import.meta.url);
const R = JSON.parse(fs.readFileSync(new URL('result.json', DIR), 'utf8'));
const md = fs.readFileSync(new URL('RESULT.md', DIR), 'utf8');
const pre = fs.readFileSync(new URL('PREREGISTRATION.md', DIR), 'utf8');
const f3 = (x) => (x >= 0 ? '+' : '-') + Math.abs(x).toFixed(3);

test('pre-registration names the cells, windows, bar, controls and assumed costs', () => {
  for (const w of ['42', '2005-01-01 to 2014-12-31', '2015-01-01 to 2026-10-31', 'Holm', 'ASSUMED', 'BEFORE costs', 'Welch t >= 2', 'plain fade', 'Cut test'])
    assert.ok(pre.includes(w), w);
});

test('the 42 cells are distinct and as pre-registered; controls map as written', () => {
  const names = Array.from({ length: NCELL }, (_, i) => cellName(i).name);
  assert.equal(NCELL, 42); assert.equal(new Set(names).size, 42);
  assert.equal(cellName(cellIndex(0, 0, 0)).name, 'L4 a0-1 1R');
  assert.equal(cellName(cellIndex(1, 6, 2)).name, 'LH c key');
  assert.deepEqual(R.cells.map((c) => c.cell), names);
  assert.deepEqual(controlsOf(cellIndex(1, 1, 1)), [ctrlIndex(1, 0, 1), ctrlIndex(1, 1, 1)]);
  assert.deepEqual(controlsOf(cellIndex(0, 4, 0)), [ctrlIndex(0, 2, 0)]);
  assert.deepEqual(controlsOf(cellIndex(0, 6, 2)), [ctrlIndex(0, 3, 2)]);
  assert.deepEqual([0, 1, 2, 5, 6, 20].map(ageGroup), [0, 0, 1, 1, 2, 2]);
});

test('line 3 is the verdict line and matches result.json', () => {
  const line = md.split('\n')[2];
  assert.ok(line.startsWith(`**Verdict: ${R.verdict}.`), line);
  assert.ok(line.includes(R.headline), 'headline');
  assert.ok(['PASS', 'FAIL', 'INCONCLUSIVE'].includes(R.verdict));
});

test('the verdict follows the pre-registered bar', () => {
  for (const c of R.cells) {
    const ctl = c.controls.every((k) => k.vsDisc != null && k.vsConf != null && k.vsDisc >= 2 && k.vsConf >= 2);
    const ok = c.disc.n >= 300 && c.conf.n >= 300 && c.disc.mean > 0 && c.conf.mean > 0 && c.disc.t >= 2 && c.conf.t >= 2 && c.holm < 0.05 && ctl;
    assert.equal(c.pass, ok, c.cell);
    assert.equal(c.checks.control, ctl, c.cell);
  }
  assert.deepEqual(R.passed, R.cells.filter((c) => c.pass).map((c) => c.cell));
  assert.equal(R.verdict, verdictOf(R.cells.map((c) => ({ pass: c.pass, checks: c.checks }))));
});

test('every cell row of RESULT.md carries the numbers of result.json', () => {
  for (const c of R.cells) {
    const row = md.split('\n').find((l) => l.startsWith(`| ${c.cell} |`)); assert.ok(row, c.cell);
    assert.ok(row.includes(f3(c.conf.mean)), c.cell + ' conf'); assert.ok(row.includes(f3(c.disc.mean)), c.cell + ' disc');
    assert.ok(row.includes(c.conf.n.toLocaleString('en-US')), c.cell + ' n');
  }
});

test('the cut test ran and found no look-ahead', () => {
  assert.ok(R.cut.length >= 10);
  for (const c of R.cut) { assert.equal(c.missing, 0, c.market + c.cut); assert.equal(c.extra, 0, c.market + c.cut); }
});

test('key-level target: nearest unbroken turn of the closes, known by the fill, on the right side', () => {
  const day = 86400, closes = [10, 11, 12, 11, 10, 9, 10, 11, 13, 12, 11, 10];
  const A = closes.map((c, i) => ({ t: i * day, o: c, h: c + 0.5, l: c - 0.5, c, e: (i + 1) * day }));
  const lv = keyLevels(A, 2); const byM = new Map(lv.map((x) => [x.m, x]));
  assert.deepEqual(lv.map((x) => [x.m, x.s, x.p]), [[2, -1, 12], [5, 1, 9], [8, -1, 13]]);
  // the A level of candle 2 (12) is known at the close of candle 4 and broken by the close of candle 8 (13)
  assert.equal(keyTarget(A, lv, byM, 1, 10, 5 * day), 12);
  assert.ok(Number.isNaN(keyTarget(A, lv, byM, 1, 10, 4 * day)), 'not known yet');
  assert.ok(Number.isNaN(keyTarget(A, lv, byM, 1, 11, 9 * day)), 'level 12 broken, level 13 not known yet');
  assert.equal(keyTarget(A, lv, byM, -1, 10, 8 * day), 9);
});
