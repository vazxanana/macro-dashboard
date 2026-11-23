// tests/grid7-sd-wide.test.mjs - the wide supply / demand grid: pre-registration, RESULT.md agrees with result.json, the verdict
// follows the bar, zones on hand-made candles, no look-ahead in the zone finder, the trade engine. Offline.
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { sdBaseZones, exits, entriesOf, bandsOf, cellName, cellsOf, shapeCell, strengthCell, NCELL } from '../research/edge/grid7-sd-wide/run.mjs';

const DIR = new URL('../research/edge/grid7-sd-wide/', import.meta.url);
const R = JSON.parse(fs.readFileSync(new URL('result.json', DIR), 'utf8'));
const md = fs.readFileSync(new URL('RESULT.md', DIR), 'utf8');
const f3 = (x) => (x >= 0 ? '+' : '-') + Math.abs(x).toFixed(3);
const bar = (t, o, h, l, c, sec = 300) => ({ t, o, h, l, c, e: t + sec });

test('pre-registration names the cells, the windows, the bar, the control and the assumed costs', () => {
  const p = fs.readFileSync(new URL('PREREGISTRATION.md', DIR), 'utf8');
  for (const w of ['56', '2005-01-01 to 2014-12-31', '2015-01-01 to 2026-10-31', 'Holm', 'Welch', 'ASSUMED', 'placebo', 'random bands', 'RBR', 'DBD', 'DBR', 'RBD', 'first touch'])
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
    const ok = c.disc.n >= 300 && c.conf.n >= 300 && c.disc.mean > 0 && c.conf.mean > 0 && c.disc.t >= 2 && c.conf.t >= 2
      && c.holm < 0.05 && c.vsControl.d != null && c.vsControl.c != null && c.vsControl.d >= 2 && c.vsControl.c >= 2;
    assert.equal(c.pass, ok, c.cell);
  }
  assert.equal(R.verdict, R.cells.some((c) => c.pass) ? 'PASS' : 'FAIL');
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
  for (let s = 0; s < 4; s++) for (let z = 0; z < 2; z++) for (let e = 0; e < 2; e++) for (let x = 0; x < 3; x++) seen.add(shapeCell(s, z, e, x));
  for (let g = 0; g < 2; g++) for (let z = 0; z < 2; z++) for (let e = 0; e < 2; e++) seen.add(strengthCell(g, z, e));
  assert.equal(seen.size, NCELL);
  assert.equal(cellName(shapeCell(2, 1, 0, 2)).name, 'DBR 4h touch ext');
  assert.equal(cellName(strengthCell(1, 0, 1)).name, 'all shapes 1d break 2R, leg out over 2.5 ATR');
  assert.deepEqual(cellsOf({ shape: 0, z: 0, e: 0, strength: 0 }).map((x) => x[1]), [0, 1, 2, 1]);
});

// hand-made Daily-like candles: steady ATR, then a rally, a 2-candle base, a strong rally (RBR demand)
function series() {
  const B = []; let p = 100;
  for (let i = 0; i < 20; i++) { const up = i % 2 === 0; B.push(bar(i * 86400, p, p + 1.2, p - 0.2, up ? p + 1 : p - 1, 86400)); p = up ? p + 1 : p - 1; }
  B.push(bar(20 * 86400, p, p + 1.1, p - 0.1, p + 1, 86400)); p += 1;              // leg in up
  B.push(bar(21 * 86400, p, p + 0.3, p - 0.4, p + 0.1, 86400));                    // base
  B.push(bar(22 * 86400, p + 0.1, p + 0.3, p - 0.2, p, 86400));                    // base
  B.push(bar(23 * 86400, p, p + 3.2, p - 0.1, p + 3, 86400));                      // leg out (body 3 > 1.5 ATR)
  return { B, base: [p - 0.4, p + 0.3], ext: p + 3.2 };
}

test('an RBR zone is the base range, known at the leg out close, with its extreme', () => {
  const { B, base, ext } = series();
  const Z = sdBaseZones(B); assert.equal(Z.length, 1);
  const z = Z[0];
  assert.equal(z.shape, 'RBR'); assert.equal(z.d, 1);
  assert.ok(Math.abs(z.lo - base[0]) < 1e-9 && Math.abs(z.hi - base[1]) < 1e-9);
  assert.equal(z.at, B[23].e); assert.ok(Math.abs(z.ext - ext) < 1e-9);
  // a zone is never known before its leg out closes: cut the series before it
  assert.equal(sdBaseZones(B.slice(0, 23)).length, 0);
  // the mirror (a drop, base, strong drop) is DBD supply
  const M = B.map((b) => ({ ...b, o: 200 - b.o, c: 200 - b.c, h: 200 - b.l, l: 200 - b.h }));
  const Y = sdBaseZones(M); assert.equal(Y.length, 1); assert.equal(Y[0].shape, 'DBD'); assert.equal(Y[0].d, -1);
});

test('the first touch: touch entry, a break entry only of the zone side and before the zone dies', () => {
  const z = { d: 1, lo: 10, hi: 11, at: 0, end: 1e9 };
  const T = [bar(0, 12, 12.5, 11.5, 12), bar(300, 12, 12, 10.5, 10.8), bar(600, 10.8, 11.5, 10.6, 11.4), bar(900, 11.4, 12, 11.3, 11.9)];
  let e = entriesOf(T, z, new Map([[3, 1]])); assert.deepEqual(e.map((x) => [x.e, x.j]), [[0, 1], [1, 3]]);
  e = entriesOf(T, z, new Map([[3, -1]])); assert.deepEqual(e.map((x) => x.e), [0]);
  // a touch candle closing below the zone: no trade
  const T2 = [bar(0, 12, 12.5, 11.5, 12), bar(300, 12, 12, 9.5, 9.8)];
  assert.deepEqual(entriesOf(T2, z, new Map()), []);
});

test('bands keep the side and height and only start after 50 earlier zones', () => {
  const Z = Array.from({ length: 80 }, (_, i) => ({ d: i % 2 ? 1 : -1, lo: 10, hi: 11, ref: 12, a: 1, ext: i % 2 ? 13 : 9, at: i, end: 1e9 }));
  const B = bandsOf(Z, 7); assert.equal(B.length, 30);
  for (const b of B) { assert.ok(Math.abs(b.hi - b.lo - 1) < 1e-9); assert.equal(b.d, Z[b.src].d);
    const near = b.d > 0 ? b.hi : b.lo, rnear = b.d > 0 ? 11 : 10; assert.ok(Math.abs((b.ext - near) - (Z[b.src].ext - rnear)) < 1e-9); }
});

test('the trade engine: stop first, gaps at the open, three targets, the time limit', () => {
  let M = [bar(0, 100, 100.5, 99.5, 100.2), bar(300, 100.2, 101.2, 100, 101), bar(600, 101, 102.5, 100.8, 102)];
  let r = exits(M, 1, 0, 99, [1, 2, 1.5], 86400); assert.deepEqual(r.R, [1, 2, 1.5]);
  M = [bar(0, 100, 103, 98, 100)]; r = exits(M, 1, 0, 99, [1, 2, 3], 86400); assert.deepEqual(r.R, [-1, -1, -1]);
  M = [bar(0, 100, 100.4, 99.6, 100), bar(300, 98, 98.5, 97.5, 98)]; r = exits(M, 1, 0, 99, [1, 2, 3], 86400); assert.deepEqual(r.R, [-2, -2, -2]);
  M = [bar(0, 100, 100.4, 99.6, 99.8), bar(300, 99.8, 100.1, 99.5, 99.5)]; r = exits(M, -1, 0, 101, [1, 2, 3], 600); assert.deepEqual(r.R.map((x) => +x.toFixed(6)), [0.5, 0.5, 0.5]);
  assert.equal(exits([bar(0, 100, 101, 99, 100)], 1, 0, 100.5, [1], 600), null);
});
