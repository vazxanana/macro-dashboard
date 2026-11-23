// tests/grid7-wide-core.test.mjs - the wide core grid: pre-registration, RESULT.md agrees with result.json, the verdict follows
// the bar, and the trade engine on hand-made candles. Offline.
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { exits, cellIndex, cellName, controlOf, NCELL, welch } from '../research/edge/grid7-wide-core/run.mjs';

const DIR = new URL('../research/edge/grid7-wide-core/', import.meta.url);
const R = JSON.parse(fs.readFileSync(new URL('result.json', DIR), 'utf8'));
const md = fs.readFileSync(new URL('RESULT.md', DIR), 'utf8');
const f3 = (x) => (x >= 0 ? '+' : '-') + Math.abs(x).toFixed(3);

test('pre-registration names the cells, the windows, the bar and the assumed costs', () => {
  const p = fs.readFileSync(new URL('PREREGISTRATION.md', DIR), 'utf8');
  for (const w of ['96', '2005-01-01 to 2014-12-31', '2015-01-01 to 2026-10-31', 'Holm', 'Welch', 'ASSUMED', 'placebo', 'MSNR', 'first touch'.replace('first', 'First')])
    assert.ok(p.includes(w), w);
});

test('line 3 is the verdict line and matches result.json', () => {
  const line = md.split('\n')[2];
  assert.ok(line.startsWith(`**Verdict: ${R.verdict}.`), line);
  assert.ok(line.includes(R.headline), 'headline');
  assert.ok(['PASS', 'FAIL', 'INCONCLUSIVE'].includes(R.verdict));
});

test('the verdict follows the pre-registered bar', () => {
  assert.equal(R.cells.length, 96);
  for (const c of R.cells) {
    const ok = c.fam !== 'none' && c.disc.n >= 300 && c.conf.n >= 300 && c.disc.mean > 0 && c.conf.mean > 0 && c.disc.t >= 2 && c.conf.t >= 2
      && c.holm < 0.05 && c.vsControl && c.vsControl.d >= 2 && c.vsControl.c >= 2;
    assert.equal(c.pass, ok, c.cell);
  }
  assert.equal(R.verdict, R.cells.some((c) => c.pass) ? 'PASS' : 'FAIL');
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
  const seen = new Set();
  for (let i = 0; i < NCELL; i++) { const n = cellName(i); assert.equal(cellIndex(n.c, n.f, n.l, n.tr, n.x), i); seen.add(i);
    const c = cellName(controlOf(i)); assert.equal(c.fam, 'none'); assert.deepEqual([c.c, c.l, c.tr, c.x], [n.c, n.l, n.tr, n.x]); }
  assert.equal(seen.size, 96);
});

test('the trade engine: stop first, gaps at the open, 1R and 2R, the time limit', () => {
  const bar = (t, o, h, l, c) => ({ t, o, h, l, c, e: t + 300 });
  // a buy filled at 100, stop 99: the second candle reaches 101 (1R) then 102 (2R)
  let M = [bar(0, 100, 100.5, 99.5, 100.2), bar(300, 100.2, 101.2, 100, 101), bar(600, 101, 102.5, 100.8, 102)];
  let r = exits(M, 1, 0, 99, 86400); assert.deepEqual(r.R, [1, 2]);
  // a candle holding the stop and both targets is a stop
  M = [bar(0, 100, 103, 98, 100)]; r = exits(M, 1, 0, 99, 86400); assert.deepEqual(r.R, [-1, -1]);
  // a gap through the stop exits at the open (worse than -1R)
  M = [bar(0, 100, 100.4, 99.6, 100), bar(300, 98, 98.5, 97.5, 98)]; r = exits(M, 1, 0, 99, 86400); assert.deepEqual(r.R, [-2, -2]);
  // a sell mirrors it; the time limit closes at the candle's close
  M = [bar(0, 100, 100.4, 99.6, 99.8), bar(300, 99.8, 100.1, 99.5, 99.5)]; r = exits(M, -1, 0, 101, 600); assert.deepEqual(r.R.map((x) => +x.toFixed(6)), [0.5, 0.5]);
  // a stop on the wrong side is no trade
  assert.equal(exits([bar(0, 100, 101, 99, 100)], 1, 0, 100.5, 600), null);
});

test('welch is zero for equal groups and signed', () => {
  assert.equal(welch({ n: 3, sum: 3, sq: 5 }, { n: 3, sum: 3, sq: 5 }), 0);
  assert.ok(welch({ n: 10, sum: 5, sq: 10 }, { n: 10, sum: 0, sq: 10 }) > 0);
});
