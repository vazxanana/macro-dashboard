// tests/fvg-plus.test.mjs - fair-value gap plus: pre-registration, RESULT.md agrees with result.json, the verdict follows
// the two-stage bar. Offline.
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { cellIndex, cellName, NCELL } from '../research/edge/fvg-plus/run.mjs';

const DIR = new URL('../research/edge/fvg-plus/', import.meta.url);
const R = JSON.parse(fs.readFileSync(new URL('result.json', DIR), 'utf8'));
const md = fs.readFileSync(new URL('RESULT.md', DIR), 'utf8');
const f3 = (x) => (x >= 0 ? '+' : '-') + Math.abs(x).toFixed(3);

test('pre-registration names the stages, the cells, the windows and the assumed costs', () => {
  const p = fs.readFileSync(new URL('PREREGISTRATION.md', DIR), 'utf8');
  for (const w of ['36 cells', 'AFTER costs', 'Stage 2', 'nas100', 'euraud', '2005-01-01 to 2014-12-31', 'Holm', 'ASSUMED', 'cannot pass']) assert.ok(p.includes(w), w);
});

test('line 3 is the verdict line and matches result.json', () => {
  const line = md.split('\n')[2];
  assert.ok(line.startsWith(`**Verdict: ${R.verdict}.`), line);
  assert.ok(line.includes(R.headline));
});

test('the verdict follows the two-stage bar', () => {
  assert.equal(R.cells.length, 36);
  for (const c of R.cells) {
    const ok = c.disc.n >= 300 && c.conf.n >= 300 && c.disc.meanNet > 0 && c.conf.meanNet > 0 && c.disc.tNet >= 2 && c.conf.tNet >= 2 && c.holm < 0.05;
    assert.equal(c.pass1, ok, c.cell);
  }
  assert.deepEqual(R.stage1Passed, R.cells.filter((c) => c.pass1).map((c) => c.cell));
  if (!R.stage1Passed.length) assert.ok(R.stage2.every((x) => !x.pass));
  for (const x of R.stage2) if (x.pass) assert.ok(x.n >= 300 && x.meanNet > 0 && x.tNet >= 2 && x.holm < 0.05);
  assert.equal(R.verdict, R.stage2.some((x) => x.pass) ? 'PASS' : 'FAIL');
  assert.deepEqual(R.stage2Read, ['nas100', 'spx500', 'de40', 'gbpjpy', 'audjpy', 'cadjpy', 'eurgbp', 'euraud']);
});

test('RESULT.md lists every cell with its after-cost figures', () => {
  for (const c of R.cells) {
    const row = md.split('\n').find((l) => l.startsWith(`| ${c.cell} |`)); assert.ok(row, c.cell);
    assert.ok(row.includes(`${f3(c.conf.meanNet)} (${c.conf.tNet.toFixed(2)})`), c.cell);
  }
});

test('the cut test is clean and cells index correctly', () => {
  assert.ok(R.cut.length >= 10);
  assert.equal(R.cut.reduce((a, x) => a + x.missing + x.extra, 0), 0);
  for (let i = 0; i < NCELL; i++) { const n = cellName(i); assert.equal(cellIndex(n.g, n.s, n.d, n.x), i); }
});
