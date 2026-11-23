// tests/eg-ef-choch-ladder.test.mjs - engulf / failed-engulf zones with a ChoCh or EF turn down the ladder: the pre-registration,
// RESULT.md agrees with result.json, the verdict follows the bar, the cell index, and the small pure pieces. Offline.
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { NC, NMAIN, cellName, cellMain, cellCall, cname, lastSwings, extreme, oppTarget } from '../research/edge/eg-ef-choch-ladder/run.mjs';

const DIR = new URL('../research/edge/eg-ef-choch-ladder/', import.meta.url);
const R = JSON.parse(fs.readFileSync(new URL('result.json', DIR), 'utf8'));
const md = fs.readFileSync(new URL('RESULT.md', DIR), 'utf8');
const f3 = (x) => (x >= 0 ? '+' : '-') + Math.abs(x).toFixed(3);

test('pre-registration names the cells, windows, controls, bar and the assumed costs', () => {
  const p = fs.readFileSync(new URL('PREREGISTRATION.md', DIR), 'utf8');
  for (const w of ['56', '2005-01-01 to 2014-12-31', '2015-01-01 to 2026-10-31', 'Holm', 'Welch', 'ASSUMED', 'placebo', 'MSNR', 'First return',
    'trigger alone', 'zone return at market', 'ChoCh', 'EF'])
    assert.ok(p.includes(w), w);
});

test('line 3 is the verdict line and matches result.json', () => {
  const line = md.split('\n')[2];
  assert.ok(line.startsWith(`**Verdict: ${R.verdict}.`), line);
  assert.ok(line.includes(R.headline), 'headline');
  assert.ok(['PASS', 'FAIL', 'INCONCLUSIVE'].includes(R.verdict));
  assert.equal(typeof R.headline, 'string');
});

test('the verdict follows the pre-registered bar', () => {
  assert.equal(R.cells.length, 56);
  const ge2 = (v) => v.d != null && v.c != null && v.d >= 2 && v.c >= 2;
  for (const c of R.cells) {
    const ok = c.disc.n >= 300 && c.conf.n >= 300 && c.disc.mean > 0 && c.conf.mean > 0 && c.disc.t >= 2 && c.conf.t >= 2
      && c.holm < 0.05 && ge2(c.ctl1.welch) && ge2(c.ctl2.welch);
    assert.equal(c.pass, ok, c.cell);
  }
  const want = R.cells.some((c) => c.pass) ? 'PASS' : R.cells.some((c) => c.disc.n >= 300 && c.conf.n >= 300) ? 'FAIL' : 'INCONCLUSIVE';
  assert.equal(R.verdict, want);
  assert.deepEqual(R.assumedCosts, ['xag', 'nzdusd', 'usdcad', 'usdchf', 'eurjpy']);
  assert.equal(R.markets.length, 10);
});

test('RESULT.md lists every cell with its figures from result.json', () => {
  for (const c of R.cells) {
    const row = md.split('\n').find((l) => l.startsWith(`| ${c.cell} |`)); assert.ok(row, c.cell);
    if (c.disc.n) assert.ok(row.includes(`${f3(c.disc.mean)} (${c.disc.t.toFixed(2)})`), c.cell + ' disc');
    if (c.conf.n) assert.ok(row.includes(`${f3(c.conf.mean)} (${c.conf.t.toFixed(2)})`), c.cell + ' conf');
  }
});

test('the cut test found nothing that a cut series would not know', () => {
  assert.ok(R.cut.length >= 10);
  assert.ok(R.cut.every((x) => x.n > 0));
  assert.equal(R.cut.reduce((a, x) => a + x.missing + x.extra, 0), 0);
});

test('cells index correctly', () => {
  const seen = new Set();
  for (let l = 0; l < 2; l++) for (let tu = 0; tu < 3; tu++) for (let tr = 0; tr < 2; tr++) for (let x = 0; x < 4; x++) {
    const i = cellMain(l, tu, tr, x), n = cellName(i); assert.deepEqual([n.l, n.tu, n.tr, n.x, n.call], [l, tu, tr, x, 'all']); seen.add(i); }
  assert.equal(seen.size, NMAIN);
  for (let l = 0; l < 2; l++) for (let cc = 0; cc < 2; cc++) for (let x = 0; x < 2; x++) {
    const i = cellCall(l, cc, x), n = cellName(i); assert.deepEqual([n.l, n.cc, n.x, n.turn, n.trig], [l, cc, x, 'either', 'either']); seen.add(i); }
  assert.equal(seen.size, NC);
  assert.equal(new Set([...Array(NC).keys()].map((i) => cname(cellName(i)))).size, NC);
});

test('swings are used only after they are confirmed; the extreme and the opposite target read no later candle', () => {
  const B = [5, 6, 9, 6, 5, 4, 5, 6, 7].map((h, i) => ({ t: i * 300, o: h - 1, h, l: h - 2, c: h - 0.5, e: i * 300 + 300 }));
  const { H } = lastSwings(B);
  // the swing high at i = 2 (9) is confirmed at the close of candle 4 (2 a side): usable from candle 5 on
  assert.ok(Number.isNaN(H[4])); assert.equal(H[5], 9);
  assert.equal(extreme(B, 1, 0, 900), 3);       // lows of candles 0-2: 3, 4, 7
  assert.equal(extreme(B, -1, 300, 1200), 9);
  const HZ = [{ d: -1, bot: 10, top: 11, at: 0, end: 5000 }, { d: -1, bot: 12, top: 13, at: 100, end: 5000 }, { d: -1, bot: 9.5, top: 9.8, at: 2000, end: 5000 }];
  assert.equal(oppTarget(HZ, 1, 1000, 8), 10);   // the zone known at 2000 is not seen at 1000
  assert.equal(oppTarget(HZ, 1, 3000, 8), 9.5);
  assert.equal(oppTarget(HZ, -1, 3000, 8), null);
});
