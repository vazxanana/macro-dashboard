// mosha-barrier-wide: offline checks of the study's pieces and that RESULT.md says what result.json holds.
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import * as S from '../research/edge/mosha-barrier-wide/run.mjs';

const DIR = new URL('../research/edge/mosha-barrier-wide/', import.meta.url);
const R = JSON.parse(fs.readFileSync(new URL('result.json', DIR), 'utf8'));
const MD = fs.readFileSync(new URL('RESULT.md', DIR), 'utf8');

test('36 cells, named and indexed one to one', () => {
  const seen = new Set();
  for (let i = 0; i < S.NCELL; i++) { const n = S.cellName(i); assert.equal(S.cellIndex(n.itf, n.ik, n.idr, n.ix), i); seen.add(S.cname(n)); }
  assert.equal(seen.size, 36); assert.equal(R.cells.length, 36);
});

test('sizes: gold in dollars, other markets the same share of price', () => {
  assert.deepEqual(S.sizes('xau', 2000), { buf: 0.3, rmin: 0.8, rmax: 25, zmin: 0.5 });
  const e = S.sizes('eurusd', 1.2); assert.ok(Math.abs(e.buf - 0.3 * 1.2 / 4000) < 1e-12);
});

test('exits: market fill at the open, stop first in a candle holding both, gap at the open', () => {
  const b = (time, open, high, low, close) => ({ time, open, high, low, close });
  // buy at 100, stop 99: 1R = 101, 3R = 103, 6R = 106
  const M = [b(0, 100, 101.5, 99.5, 101), b(300, 101, 103.2, 100.5, 103), b(600, 103, 103, 98, 98.5)];
  const r = S.exits(M, 1, 0, 99);
  assert.equal(r.R[0], 1); assert.equal(r.R[1], 3); assert.equal(r.R[2], -1);
  const both = S.exits([b(0, 100, 102, 98, 100)], 1, 0, 99); assert.deepEqual(both.R, [-1, -1, -1]);
  const gap = S.exits([b(0, 100, 100.5, 99.5, 100), b(300, 98, 98.5, 97, 98)], 1, 0, 99); assert.deepEqual(gap.R, [-2, -2, -2]);
  assert.equal(S.exits(M, 1, 0, 100.5), null);   // a stop on the winning side is no trade
});

test('the cut test found no look-ahead', () => {
  assert.ok(R.cut.length >= 5);
  assert.ok(new Set(R.cut.map((x) => x.market)).size >= 2);
  for (const c of R.cut) { assert.equal(c.missing, 0); assert.equal(c.extra, 0); }
});

test('the verdict follows the pre-registered bar', () => {
  const passed = R.cells.filter((c) => c.checks.n && c.checks.disc && c.checks.conf && c.checks.holm && c.checks.control);
  assert.deepEqual(passed.map((c) => c.cell), R.passed);
  assert.equal(R.verdict, passed.length ? 'PASS' : 'FAIL');
  for (const c of R.cells) assert.equal(c.checks.n, c.disc.n >= 300 && c.conf.n >= 300);
});

test('RESULT.md line 3 states result.json', () => {
  const line = MD.split('\n')[2];
  assert.equal(line, `**Verdict: ${R.verdict}. ${R.headline}.**`);
  assert.match(line, /n [\d,]+/); assert.match(line, /t -?\d/);
  assert.ok(fs.existsSync(new URL('PREREGISTRATION.md', DIR)));
  for (const c of R.cells) assert.ok(MD.includes(`| ${c.cell} |`), c.cell);
});
