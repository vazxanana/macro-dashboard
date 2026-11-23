// tests/compression-breakout.test.mjs - the compression breakout study: pre-registration, RESULT.md agrees with result.json, the
// verdict follows the bar, the 56 cells and their controls, the compression detector and the trade engine on hand-made candles.
// Offline.
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { compressions, sim, cellName, cellA, cellB, controlOf, ctrlName, NCELL } from '../research/edge/compression-breakout/run.mjs';

const DIR = new URL('../research/edge/compression-breakout/', import.meta.url);
const R = JSON.parse(fs.readFileSync(new URL('result.json', DIR), 'utf8'));
const md = fs.readFileSync(new URL('RESULT.md', DIR), 'utf8');
const pre = fs.readFileSync(new URL('PREREGISTRATION.md', DIR), 'utf8');
const f3 = (x) => (x >= 0 ? '+' : '-') + Math.abs(x).toFixed(3);
const bar = (t, o, h, l, c, sec = 300) => ({ t, o, h, l, c, e: t + sec });

test('pre-registration names the cells, the windows, the bar, the control and the assumed costs', () => {
  for (const w of ['56', '2005-01-01 to 2014-12-31', '2015-01-01 to 2026-10-31', 'Holm', 'ASSUMED', 'Welch', '1.5 x ATR(14)', 'BEFORE costs', 'grid7-wide-fade'])
    assert.ok(pre.includes(w), w);
});

test('the 56 cells are distinct, as pre-registered, each with the matching control', () => {
  const names = Array.from({ length: NCELL }, (_, i) => cellName(i).name);
  assert.equal(new Set(names).size, 56);
  assert.equal(cellName(cellA(1, 2, 1, 2)).name, 'h1 inside fade trail all');
  assert.equal(cellName(cellB(0, 0, 4)).name, 'm15 n8 with 2R dhigh');
  assert.equal(ctrlName(controlOf(cellA(1, 2, 1, 2))), 'h1 break fade trail all');
  assert.equal(ctrlName(controlOf(cellB(0, 0, 4))), 'm15 break with 2R dhigh');
  assert.deepEqual(R.cells.map((c) => c.cell), names);
  for (const c of R.cells) assert.equal(c.control.cell, ctrlName(controlOf(names.indexOf(c.cell))));
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
      && c.welchDisc != null && c.welchConf != null && c.welchDisc >= 2 && c.welchConf >= 2;
    assert.equal(c.pass, ok, c.cell);
  }
  assert.equal(R.verdict, R.markets.length < 8 ? 'INCONCLUSIVE' : R.cells.some((c) => c.pass) ? 'PASS' : 'FAIL');
  assert.deepEqual(R.passed, R.cells.filter((c) => c.pass).map((c) => c.cell));
  assert.deepEqual(R.assumedCosts, ['xag', 'nzdusd', 'usdcad', 'usdchf', 'eurjpy']);
});

test('RESULT.md lists every cell with its figures from result.json; the cut test is clean', () => {
  for (const c of R.cells) {
    const row = md.split('\n').find((l) => l.startsWith(`| ${c.cell} |`)); assert.ok(row, c.cell);
    assert.ok(row.includes(f3(c.conf.mean)) && row.includes(c.conf.t.toFixed(2)), c.cell);
    assert.ok(row.includes(f3(c.disc.mean)) && row.includes(c.disc.t.toFixed(2)), c.cell);
  }
  assert.ok(R.cut.length >= 5);
  for (const x of R.cut) assert.equal(x.missing + x.extra, 0, 'cut test ' + x.market + ' ' + x.cut);
});

test('compressions: a tight box, then the first close out of it; no look-ahead', () => {
  const B = []; for (let i = 0; i < 30; i++) B.push(bar(i * 900, 100, 102, 98, 100, 900));     // ATR 4
  for (let i = 30; i < 38; i++) B.push(bar(i * 900, 100, 101, 99.5, 100, 900));              // 8 candles spanning 1.5 < 1.5 x ATR
  B.push(bar(38 * 900, 100, 101.8, 99.9, 101.6, 900));                                        // close above the box
  const atr = new Float64Array(B.length).fill(4);
  const ev = compressions(B, atr, 'n8');
  const e = ev.find((x) => x.j === 38); assert.ok(e); assert.equal(e.d, 1); assert.equal(e.hi, 101); assert.equal(e.lo, 99.5);
  assert.equal(e.ts, B[38].e);
  // the same event when the candles after it do not exist yet
  const cut = compressions(B.slice(0, 39), atr, 'n8'); assert.ok(cut.some((x) => x.j === 38 && x.d === 1));
  // inside: three candles inside the one before them, then a close below it
  const I = [bar(0, 100, 103, 97, 100, 900), bar(900, 100, 102, 98, 101, 900), bar(1800, 101, 102, 99, 100, 900), bar(2700, 100, 101, 98, 99, 900), bar(3600, 99, 99, 96, 96.5, 900)];
  const ie = compressions(I, new Float64Array(5).fill(4), 'inside'); assert.equal(ie.length, 1); assert.equal(ie[0].d, -1); assert.equal(ie[0].hi, 103);
});

test('the trade engine: stop first, gaps, targets, the trail and the time limit', () => {
  // long at 100, stop 99: 1R 101, 2R 102. Candle 2 reaches 101.5, candle 3 falls through the trail (100.5) and the stop.
  let r = sim([bar(0, 100, 100.2, 99.8, 100), bar(300, 100, 101.5, 100, 101.2), bar(600, 101.2, 101.2, 98.5, 98.7)], 1, 0, 99, 86400);
  assert.equal(r[0], 1); assert.equal(r[1], -1); assert.equal(r[2], 0.5);
  // a candle holding stop and target: the stop first
  r = sim([bar(0, 100, 100, 100, 100), bar(300, 100, 102.2, 98.9, 100)], 1, 0, 99, 86400); assert.deepEqual(r, [-1, -1, -1]);
  // a gap through the stop fills at the open
  r = sim([bar(0, 100, 100, 100, 100), bar(300, 98, 98.5, 97.8, 98)], 1, 0, 99, 86400); assert.deepEqual(r, [-2, -2, -2]);
  // time limit: out at the close of the candle that reaches it
  r = sim([bar(0, 100, 100.1, 99.9, 100), bar(300, 100, 100.4, 99.6, 100.4)], 1, 0, 99, 600); assert.ok(Math.abs(r[0] - 0.4) < 1e-9);
  // a stop on the wrong side is no trade; a short mirrors
  assert.equal(sim([bar(0, 100, 100, 100, 100)], 1, 0, 101, 600), null);
  r = sim([bar(0, 100, 100.2, 99.8, 100), bar(300, 100, 100, 97.9, 98)], -1, 0, 101, 600); assert.equal(r[0], 1); assert.equal(r[1], 1); assert.equal(r[2], 2);
});
