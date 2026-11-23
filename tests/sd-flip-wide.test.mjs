// tests/sd-flip-wide.test.mjs - the flip study: pre-registration, RESULT.md agrees with result.json, the verdict follows the
// bar, cells index correctly, the split membership. Offline.
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { cellIndex, cellName, NCELL, groupsOf, GROUPS } from '../research/edge/sd-flip-wide/run.mjs';

const DIR = new URL('../research/edge/sd-flip-wide/', import.meta.url);
const R = JSON.parse(fs.readFileSync(new URL('result.json', DIR), 'utf8'));
const md = fs.readFileSync(new URL('RESULT.md', DIR), 'utf8');
const f3 = (x) => (x >= 0 ? '+' : '-') + Math.abs(x).toFixed(3);

test('pre-registration names the cells, windows, controls and bar', () => {
  const p = fs.readFileSync(new URL('PREREGISTRATION.md', DIR), 'utf8');
  for (const w of ['56', '2005-01-01 to 2014-12-31', '2015-01-01 to 2026-10-31', 'Holm', 'Welch', 'ASSUMED', 'placebo', 'MSNR', 'Unbroken', 'Random band', 'cut test'])
    assert.ok(p.includes(w), w);
});

test('line 3 is the verdict line and matches result.json', () => {
  const line = md.split('\n')[2];
  assert.ok(line.startsWith(`**Verdict: ${R.verdict}.`), line);
  assert.ok(line.includes(R.headline), 'headline');
  assert.ok(['PASS', 'FAIL', 'INCONCLUSIVE'].includes(R.verdict));
});

test('the verdict follows the pre-registered bar', () => {
  assert.equal(R.cells.length, 56);
  for (const c of R.cells) {
    const ok = c.disc.n >= 300 && c.conf.n >= 300 && c.disc.mean > 0 && c.conf.mean > 0 && c.disc.t >= 2 && c.conf.t >= 2 && c.holm < 0.05
      && c.vsUnbroken.d >= 2 && c.vsUnbroken.c >= 2 && c.vsRandom.d >= 2 && c.vsRandom.c >= 2;
    assert.equal(c.pass, ok, c.cell);
  }
  const anyN = R.cells.some((c) => c.disc.n >= 300 && c.conf.n >= 300);
  assert.equal(R.verdict, R.cells.some((c) => c.pass) ? 'PASS' : anyN ? 'FAIL' : 'INCONCLUSIVE');
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

test('the cut test found nothing a cut series would not know', () => {
  assert.ok(R.cut.length >= 10);
  assert.ok(R.cut.every((x) => x.n > 0));
  assert.equal(R.cut.reduce((a, x) => a + x.missing + x.extra, 0), 0);
});

test('cells index correctly', () => {
  const seen = new Set();
  for (let i = 0; i < NCELL; i++) { const n = cellName(i); assert.equal(cellIndex(n.g, n.l, n.en, n.x), i); assert.equal(n.group, GROUPS[n.g]); seen.add(i); }
  assert.equal(seen.size, 56);
});

test('split membership: flips by distance, body and the call; the unbroken control in every pooled group', () => {
  assert.deepEqual(groupsOf({ fam: 0, s: 1, call: 1, dist: 0.5, body: 1.2 }, false), { own: [0], both: [2, 5, 6] });
  assert.deepEqual(groupsOf({ fam: 1, s: -1, call: 1, dist: 1, body: 0.3 }, false), { own: [1], both: [3, 4] });
  assert.deepEqual(groupsOf({ fam: 1, s: -1, call: -1, dist: 0, body: 0 }, true), { own: [1], both: [2, 3, 4, 5, 6] });
  assert.deepEqual(groupsOf({ fam: 0, s: 1, call: 0, dist: 0, body: 0 }, true), { own: [0], both: [2, 3, 4, 5] });
});
