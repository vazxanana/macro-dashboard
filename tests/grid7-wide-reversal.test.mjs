// tests/grid7-wide-reversal.test.mjs - the wide reversal grid: pre-registration, RESULT.md agrees with result.json, the verdict
// follows the bar, and the trade engine on hand-made candles. Offline.
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { exits, cellIndex, cellName, controlOf, NCELL } from '../research/edge/grid7-wide-reversal/run.mjs';

const DIR = new URL('../research/edge/grid7-wide-reversal/', import.meta.url);
const R = JSON.parse(fs.readFileSync(new URL('result.json', DIR), 'utf8'));
const md = fs.readFileSync(new URL('RESULT.md', DIR), 'utf8');
const f3 = (x) => (x >= 0 ? '+' : '-') + Math.abs(x).toFixed(3);

test('pre-registration names the cells, the windows, the bar and the assumed costs', () => {
  const p = fs.readFileSync(new URL('PREREGISTRATION.md', DIR), 'utf8');
  for (const w of ['48 cells', '2005-01-01 to 2014-12-31', '2015-01-01 to 2026-10-31', 'Holm', 'Welch', 'ASSUMED', 'side-flipped', 'First touch', 'control'])
    assert.ok(p.includes(w), w);
});

test('line 3 is the verdict line and matches result.json', () => {
  const line = md.split('\n')[2];
  assert.ok(line.startsWith(`**Verdict: ${R.verdict}.`), line);
  assert.ok(line.includes(R.headline), 'headline');
  assert.ok(['PASS', 'FAIL', 'INCONCLUSIVE'].includes(R.verdict));
  assert.equal(R.study, 'grid7-wide-reversal');
});

test('the verdict follows the pre-registered bar', () => {
  assert.equal(R.cells.length, 72);
  const judged = R.cells.filter((c) => !c.control);
  assert.equal(judged.length, 48);
  for (const c of judged) {
    const ok = c.disc.n >= 300 && c.conf.n >= 300 && c.disc.mean > 0 && c.conf.mean > 0 && c.disc.t >= 2 && c.conf.t >= 2
      && c.holm < 0.05 && c.vsControl && c.vsControl.d >= 2 && c.vsControl.c >= 2;
    assert.equal(c.pass, ok, c.cell);
  }
  for (const c of R.cells.filter((x) => x.control)) assert.equal(c.pass, false);
  const reach = judged.filter((c) => c.disc.n >= 300 && c.conf.n >= 300).length;
  assert.equal(R.reachN, reach);
  assert.equal(R.verdict, judged.some((c) => c.pass) ? 'PASS' : reach < 24 ? 'INCONCLUSIVE' : 'FAIL');
  assert.deepEqual(R.assumedCosts, ['xag', 'nzdusd', 'usdcad', 'usdchf', 'eurjpy']);
  assert.equal(R.markets.length, 10);
});

test('RESULT.md lists every cell with its figures from result.json', () => {
  for (const c of R.cells) {
    const row = md.split('\n').find((l) => l.startsWith(`| ${c.cell} |`)); assert.ok(row, c.cell);
    assert.ok(row.includes(`${f3(c.disc.mean)} (${c.disc.t.toFixed(2)})`), c.cell + ' disc');
    assert.ok(row.includes(`${f3(c.conf.mean)} (${c.conf.t.toFixed(2)})`), c.cell + ' conf');
  }
});

test('the cut test found nothing that a cut series would not know', () => {
  assert.ok(R.cut.length >= 10);
  assert.ok(R.cut.every((x) => x.n > 0));
  assert.equal(R.cut.reduce((a, x) => a + x.missing + x.extra, 0), 0);
});

test('cells and controls index correctly', () => {
  assert.equal(NCELL, 72);
  for (let i = 0; i < NCELL; i++) { const n = cellName(i); assert.equal(cellIndex(n.f, n.p, n.t, n.x), i);
    const c = cellName(controlOf(i)); assert.equal(c.pat, 'ctl'); assert.deepEqual([c.fam, c.tf, c.exit], [n.fam, n.tf, n.exit]); }
});

test('the trade engine: stop first, gaps at the open, R multiples, no target, the time limit', () => {
  const bar = (t, o, h, l, c) => ({ t, o, h, l, c, e: t + 300 });
  let M = [bar(0, 100, 100.5, 99.5, 100.2), bar(300, 100.2, 101.2, 100, 101), bar(600, 101, 103.6, 100.8, 103)];
  let r = exits(M, 1, 0, 99, [1, 2, 3.5], 86400); assert.deepEqual(r.R, [1, 2, 3.5]);
  // an mm target under 1R is NaN: that exit is not taken, the others are
  r = exits(M, 1, 0, 99, [1, 2, NaN], 86400); assert.deepEqual(r.R.slice(0, 2), [1, 2]); assert.ok(Number.isNaN(r.R[2]));
  M = [bar(0, 100, 103, 98, 100)]; r = exits(M, 1, 0, 99, [1, 2, 3], 86400); assert.deepEqual(r.R, [-1, -1, -1]);
  M = [bar(0, 100, 100.4, 99.6, 100), bar(300, 98, 98.5, 97.5, 98)]; r = exits(M, 1, 0, 99, [1, 2, 3], 86400); assert.deepEqual(r.R, [-2, -2, -2]);
  M = [bar(0, 100, 100.4, 99.6, 99.8), bar(300, 99.8, 100.1, 99.5, 99.5)]; r = exits(M, -1, 0, 101, [1, 2, 3], 600); assert.deepEqual(r.R.map((x) => +x.toFixed(6)), [0.5, 0.5, 0.5]);
  assert.equal(exits([bar(0, 100, 101, 99, 100)], 1, 0, 100.5, [1, 2, 3], 600), null);
});
