// tests/round-fade-net.test.mjs - the round-number fade judged after costs: the pre-registration, RESULT.md agrees with
// result.json, the verdict follows the bar, the 30 cells, and the filters on hand-made candles. Offline.
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { cellName, cellIndex, NCELL, filtersOf, MEASURED } from '../research/edge/round-fade-net/run.mjs';

const DIR = new URL('../research/edge/round-fade-net/', import.meta.url);
const R = JSON.parse(fs.readFileSync(new URL('result.json', DIR), 'utf8'));
const md = fs.readFileSync(new URL('RESULT.md', DIR), 'utf8');
const pre = fs.readFileSync(new URL('PREREGISTRATION.md', DIR), 'utf8');
const f3 = (x) => (x >= 0 ? '+' : '-') + Math.abs(x).toFixed(3);

test('pre-registration names the cells, the windows, the after-cost bar and the measured markets', () => {
  for (const w of ['30 cells', '2005-01-01 to 2014-12-31', '2015-01-01 to 2026-10-31', 'AFTER costs', 'Holm', 'ASSUMED', 'exhaust+dayext', '1.5 x ATR(14)', 'outer 20 %'])
    assert.ok(pre.includes(w), w);
  assert.deepEqual(MEASURED, ['xau', 'eurusd', 'gbpusd', 'usdjpy', 'audusd']);
});

test('the 30 cells are distinct and as pre-registered', () => {
  const names = Array.from({ length: NCELL }, (_, i) => cellName(i).name);
  assert.equal(new Set(names).size, 30);
  assert.equal(cellName(cellIndex(2, 4, 1)).name, 'h4 exhaust+dayext 3R');
  assert.deepEqual(R.cells.map((c) => c.cell), names);
});

test('line 3 is the verdict line and matches result.json; the verdict follows the bar', () => {
  const line = md.split('\n')[2];
  assert.ok(line.startsWith(`**Verdict: ${R.verdict}.`) && line.includes(R.headline), line);
  for (const c of R.cells) {
    const ok = c.disc.n >= 200 && c.conf.n >= 200 && c.disc.meanNet > 0 && c.conf.meanNet > 0 && c.disc.tNet >= 2 && c.conf.tNet >= 2 && c.holm < 0.05 && c.measured.meanNet > 0;
    assert.equal(c.pass, ok, c.cell);
  }
  assert.equal(R.verdict, R.markets.length < 8 ? 'INCONCLUSIVE' : R.cells.some((c) => c.pass) ? 'PASS' : 'FAIL');
});

test('RESULT.md lists every cell with its figures, and the cut test is clean', () => {
  for (const c of R.cells) {
    const row = md.split('\n').find((l) => l.startsWith(`| ${c.cell} |`)); assert.ok(row, c.cell);
    assert.ok(row.includes(f3(c.conf.meanNet)) && row.includes(c.conf.tNet.toFixed(2)) && row.includes(f3(c.disc.meanNet)), c.cell);
  }
  assert.ok(R.cut.length >= 5); for (const x of R.cut) assert.equal(x.missing + x.extra, 0, x.market + ' ' + x.cut);
});

test('filters: exhaustion candle, quiet hours and the daily-range edge', () => {
  const T = [{ h: 1.1031, l: 1.100 }];
  const D = Array.from({ length: 20 }, (_, i) => ({ t: i * 86400, e: (i + 1) * 86400, h: 1.11, l: 1.09 }));
  const t = 20 * 86400 + 18 * 3600; // 18:00 UTC, after 20 closed days
  const ev = { j: 0, d: 1, a: 0.002 };
  assert.deepEqual(filtersOf(ev, T, 1.107, t, D), [true, true, true, true, true]);     // range 1.5 ATR, quiet, top 20 %
  assert.deepEqual(filtersOf(ev, T, 1.100, t, D), [true, true, true, false, false]);    // middle of the range
  assert.deepEqual(filtersOf({ ...ev, d: -1 }, T, 1.092, t + 19 * 3600, D), [true, true, false, true, true]); // buy fade near the low, 13:00 next day (New York hours)
  assert.equal(filtersOf({ ...ev, a: 0.0025 }, T, 1.107, t, D)[1], false);              // 0.0031 < 1.5 x 0.0025
});
