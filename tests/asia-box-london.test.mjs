// tests/asia-box-london.test.mjs - the Asia box study: pre-registration, RESULT.md agrees with result.json, the verdict follows
// the bar, the 44 cells, the box and the events on hand-made candles, the trade engine, and the cut test. Offline.
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { asiaBoxes, sim, cellName, mainCell, splitCell, heightBucket, NCELL } from '../research/edge/asia-box-london/run.mjs';

const DIR = new URL('../research/edge/asia-box-london/', import.meta.url);
const R = JSON.parse(fs.readFileSync(new URL('result.json', DIR), 'utf8'));
const md = fs.readFileSync(new URL('RESULT.md', DIR), 'utf8');
const pre = fs.readFileSync(new URL('PREREGISTRATION.md', DIR), 'utf8');
const f3 = (x) => (x >= 0 ? '+' : '-') + Math.abs(x).toFixed(3);

test('pre-registration names the events, windows, bar, controls and assumed costs', () => {
  for (const w of ['(a) the break, WITH it', '(b) the break, FADED', '(c) a false break', '(d) the second break', '44', '2005-01-01 to 2014-12-31',
    '2015-01-01 to 2026-10-31', 'Holm', 'ASSUMED', 'Welch t', 'BEFORE costs', 'random', 'grid7-wide-fade', '21:00'])
    assert.ok(pre.includes(w), w);
});

test('the 44 cells are distinct and as pre-registered', () => {
  const names = Array.from({ length: NCELL }, (_, i) => cellName(i).name);
  assert.equal(NCELL, 44); assert.equal(new Set(names).size, 44);
  assert.equal(cellName(mainCell(1, 2)).name, 'b fade box');
  assert.equal(cellName(splitCell(3, 6)).name, 'd second break 2R New York');
  assert.deepEqual(R.cells.map((c) => c.cell), names);
  assert.equal(heightBucket(0.29), 0); assert.equal(heightBucket(0.3), 1); assert.equal(heightBucket(0.6), 1); assert.equal(heightBucket(0.61), 2);
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
      && c.vs.d != null && c.vs.c != null && c.vs.d >= 2 && c.vs.c >= 2;
    assert.equal(c.pass, ok, c.cell);
  }
  assert.equal(R.verdict, R.markets.length < 8 ? 'INCONCLUSIVE' : R.cells.some((c) => c.pass) ? 'PASS' : 'FAIL');
  assert.deepEqual(R.passed, R.cells.filter((c) => c.pass).map((c) => c.cell));
  assert.deepEqual(R.assumedCosts, ['xag', 'nzdusd', 'usdcad', 'usdchf', 'eurjpy']);
});

test('RESULT.md lists every cell with its figures from result.json; the cut test found nothing', () => {
  for (const c of R.cells) {
    const row = md.split('\n').find((l) => l.startsWith(`| ${c.cell} |`)); assert.ok(row, c.cell);
    assert.ok(row.includes(f3(c.conf.mean)) && row.includes(c.conf.t.toFixed(2)), c.cell);
    assert.ok(row.includes(f3(c.disc.mean)) && row.includes(c.disc.t.toFixed(2)), c.cell);
  }
  assert.ok(R.cut.length >= 5);
  for (const x of R.cut) assert.equal(x.missing + x.extra, 0, 'cut test ' + x.market + ' ' + x.cut);
});

test('the Asia box: weekday candles starting 00:00-07:00 UTC, at least 60', () => {
  const D = Date.UTC(2020, 0, 6) / 1000; const B = [];   // a Monday
  for (let i = 0; i < 96; i++) { const t = D + i * 300; B.push({ t, o: 1, h: 1 + (i < 84 ? i / 1000 : 9), l: 1 - (i < 84 ? 0.001 : 9), c: 1, e: t + 300 }); }
  const x = asiaBoxes(B).get(D); assert.ok(x); assert.equal(x.n, 84); assert.equal(+x.hi.toFixed(3), 1.083); assert.equal(x.lo, 0.999);
  assert.equal(asiaBoxes(B.slice(0, 59)).size, 0);                            // under 60 candles: no box
  const Sat = Date.UTC(2020, 0, 4) / 1000; assert.equal(asiaBoxes(B.map((b) => ({ ...b, t: b.t - D + Sat, e: b.e - D + Sat }))).size, 0);
});

test('the trade engine: stop first, targets, the 21:00 close, gaps', () => {
  const D = Date.UTC(2020, 0, 6) / 1000, t0 = D + 8 * 3600;
  const mk = (rows) => rows.map(([o, h, l, c], i) => ({ t: t0 + i * 300, o, h, l, c, e: t0 + i * 300 + 300 }));
  // buy at 100, stop 99: 1R 101, 2R 102, box (H 1.5) 101.5
  let r = sim(mk([[100, 100.5, 99.8, 100.2], [100.2, 101.6, 100.1, 101.5], [101.5, 102.2, 101.4, 102]]), 1, 0, 99, 1.5, D);
  assert.deepEqual(r.R.slice(0, 3).map((x) => +x.toFixed(6)), [1, 2, 1.5]); assert.equal(+r.R[3].toFixed(6), 2);
  r = sim(mk([[100, 101.2, 98.9, 100]]), 1, 0, 99, 1.5, D);                  // one candle holds the stop and 1R: the stop
  assert.equal(r.R[0], -1);
  r = sim(mk([[100, 100.2, 99.9, 100], [98.5, 98.6, 98.4, 98.5]]), 1, 0, 99, 1.5, D);   // gap through the stop fills at the open
  assert.equal(+r.R[0].toFixed(6), -1.5);
  const late = mk([[100, 100.2, 99.9, 100.1]]).map((b) => ({ ...b, t: D + 21 * 3600 - 300, e: D + 21 * 3600 }));
  r = sim([...late, { t: D + 21 * 3600, o: 101, h: 103, l: 100, c: 102, e: D + 21 * 3600 + 300 }], 1, 0, 99, 1.5, D);
  assert.equal(+r.R[3].toFixed(6), 0.1); assert.equal(+r.R[1].toFixed(6), 0.1);  // closed at 21:00, nothing after it read
  assert.equal(sim(mk([[100, 100, 100, 100]]), 1, 0, 100.5, 1, D), null);  // stop on the wrong side: no trade
});
