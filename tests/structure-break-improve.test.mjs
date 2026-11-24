// tests/structure-break-improve.test.mjs - the improvement search + holdout: the pre-registration, RESULT.md agrees with
// result.json, the 324 cells and the pick rule, the verdict follows the holdout bar, the trailing stop on hand-made candles,
// and no look-ahead on the holdout markets (cut test). Offline.
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { trail, cellName, cellOf, NCELL, HOLD } from '../research/edge/structure-break-improve/run.mjs';

const DIR = new URL('../research/edge/structure-break-improve/', import.meta.url);
const R = JSON.parse(fs.readFileSync(new URL('result.json', DIR), 'utf8'));
const md = fs.readFileSync(new URL('RESULT.md', DIR), 'utf8');
const pre = fs.readFileSync(new URL('PREREGISTRATION.md', DIR), 'utf8');

test('pre-registration fixes the grid, the pick, the holdout markets and the bar', () => {
  for (const w of ['324', 'top five', 'gbpjpy, eurgbp, audjpy, cadjpy, euraud, nas100, spx500, de40', 'Holm', 'ASSUMED', 'AFTER costs', 'NOT evidence'])
    assert.ok(pre.includes(w), w);
});

test('the 324 cells are distinct and named as pre-registered', () => {
  const names = Array.from({ length: NCELL }, (_, i) => cellName(i).name);
  assert.equal(NCELL, 324); assert.equal(new Set(names).size, 324);
  assert.equal(cellName(cellOf(1, 2, 3, 8)).name, 'fade h4 trail day');
  assert.deepEqual(R.search.map((c) => c.cell), names);
  assert.deepEqual(R.holdoutMarkets, HOLD);
});

test('line 3 is the verdict line and matches result.json', () => {
  const line = md.split('\n')[2];
  assert.ok(line.startsWith(`**Verdict: ${R.verdict}.`), line);
  assert.ok(line.includes(R.headline));
});

test('the pick follows the rule: eligible after costs in both windows, ranked by the smaller t, top five', () => {
  const ok = R.search.filter((r) => r.disc.n >= 300 && r.conf.n >= 300 && r.disc.meanNet > 0 && r.conf.meanNet > 0);
  assert.deepEqual(R.eligible, ok.map((r) => r.cell));
  const want = [...ok].sort((a, b) => Math.min(b.disc.tNet, b.conf.tNet) - Math.min(a.disc.tNet, a.conf.tNet)).slice(0, 5).map((r) => r.cell);
  assert.deepEqual(R.picked, want);
});

test('the verdict follows the holdout bar', () => {
  for (const h of R.holdout) assert.equal(h.pass, h.all.n >= 300 && h.all.meanNet > 0 && h.all.tNet >= 2 && h.holm < 0.05, h.cell);
  const n = R.holdout.filter((h) => h.pass).length;
  assert.equal(R.verdict, R.holdoutMarkets.length < 6 ? 'INCONCLUSIVE' : n ? 'PASS' : 'FAIL');
});

test('the cut test on the holdout markets found no look-ahead', () => {
  assert.ok(R.cut.length >= 5);
  for (const c of R.cut) { assert.equal(c.missing, 0); assert.equal(c.extra, 0); }
});

test('the trailing stop: arms at +1R, follows the best price 1R behind, never moves back, gaps fill at the open', () => {
  const bar = (t, o, h, l, c) => ({ t, o, h, l, c, e: t + 300 });
  // buy at 100, stop 99 (1R = 1). Up to 102.5, then down through 101.5 -> out at 101.5 = +1.5R
  const B = [bar(0, 100, 100.5, 99.8, 100.4), bar(300, 100.4, 102.5, 100.3, 102.2), bar(600, 102.2, 102.3, 101.0, 101.2)];
  assert.equal(trail(B, 1, 0, 99, 86400), 1.5);
  // never armed: stopped at the original stop
  assert.equal(trail([bar(0, 100, 100.5, 98.5, 99)], 1, 0, 99, 86400), -1);
  // gap below the trailed stop fills at the open
  const G = [bar(0, 100, 103, 99.9, 102.8), bar(300, 101.0, 101.2, 100.5, 100.8)];
  assert.equal(trail(G, 1, 0, 99, 86400), 1);
  // a sell mirrors
  assert.equal(trail([bar(0, 100, 100.2, 97.5, 97.8), bar(300, 97.8, 98.6, 97.7, 98.4)], -1, 0, 101, 86400), 1.5);
  // time limit: out at the close
  assert.ok(Math.abs(trail([bar(0, 100, 100.4, 99.6, 100.2)], 1, 0, 99, 300) - 0.2) < 1e-9);
});
