// tests/grid7-box-fade.test.mjs - the box grid: pre-registration, RESULT.md agrees with result.json, the verdict follows the
// bar, the 46 cells and their controls, and the box events on hand-made candles (no look-ahead). Offline.
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { CELLS, NCELL, CONTROLS, controlOf, cellId, boxEvents, htfCtx } from '../research/edge/grid7-box-fade/run.mjs';

const DIR = new URL('../research/edge/grid7-box-fade/', import.meta.url);
const R = JSON.parse(fs.readFileSync(new URL('result.json', DIR), 'utf8'));
const md = fs.readFileSync(new URL('RESULT.md', DIR), 'utf8');
const pre = fs.readFileSync(new URL('PREREGISTRATION.md', DIR), 'utf8');
const f3 = (x) => (x >= 0 ? '+' : '-') + Math.abs(x).toFixed(3);

test('pre-registration names the cells, windows, bar, control and assumed costs', () => {
  for (const w of ['46', '2005-01-01 to 2014-12-31', '2015-01-01 to 2026-10-31', 'Holm', 'ASSUMED', 'Welch t', 'BEFORE costs', 'grid7-wide-fade', 'boxesHL(T, 2)'])
    assert.ok(pre.includes(w), w);
});

test('the 46 cells are distinct, as pre-registered, each with its control', () => {
  assert.equal(NCELL, 46); assert.equal(new Set(CELLS.map((c) => c.name)).size, 46);
  assert.deepEqual(R.cells.map((c) => c.cell), CELLS.map((c) => c.name));
  assert.equal(CONTROLS[controlOf(cellId(0, 'fade', 'box', 'all')) - NCELL].name, 'control m15 fade ext swing');
  assert.equal(CONTROLS[controlOf(cellId(1, 'with', '2R', 'all')) - NCELL].name, 'control h1 fade ext 2R');
  assert.equal(CELLS.filter((c) => c.event === 'with' && c.exit === 'box').length, 0);
  assert.equal(htfCtx(2, 1), 'htf-in'); assert.equal(htfCtx(1, 1), 'htf-same'); assert.equal(htfCtx(-1, 1), 'htf-other'); assert.equal(htfCtx(0, 1), null);
});

test('line 3 is the verdict line and matches result.json', () => {
  const line = md.split('\n')[2];
  assert.ok(line.startsWith(`**Verdict: ${R.verdict}.`), line);
  assert.ok(line.includes(R.headline));
  assert.ok(['PASS', 'FAIL', 'INCONCLUSIVE'].includes(R.verdict));
});

test('the verdict follows the pre-registered bar', () => {
  for (const c of R.cells) {
    const ok = c.disc.n >= 300 && c.conf.n >= 300 && c.disc.mean > 0 && c.conf.mean > 0 && c.disc.t >= 2 && c.conf.t >= 2 && c.holm < 0.05
      && c.vsControl.disc != null && c.vsControl.conf != null && c.vsControl.disc >= 2 && c.vsControl.conf >= 2;
    assert.equal(c.pass, ok, c.cell);
  }
  const n = R.cells.filter((c) => c.pass).length;
  assert.equal(R.verdict, R.markets.length < 8 ? 'INCONCLUSIVE' : n ? 'PASS' : 'FAIL');
  assert.deepEqual(R.passed, R.cells.filter((c) => c.pass).map((c) => c.cell));
});

test('RESULT.md shows every cell as in result.json, and the cut test found nothing', () => {
  for (const c of R.cells) {
    const row = md.split('\n').find((l) => l.startsWith(`| ${c.cell} |`)); assert.ok(row, c.cell);
    assert.ok(row.includes(`${f3(c.conf.mean)} (${c.conf.t.toFixed(2)})`), c.cell);
  }
  assert.ok(R.cut.length >= 5);
  for (const x of R.cut) { assert.ok(x.n > 0); assert.equal(x.missing + x.extra, 0, x.market + ' ' + x.cut); }
});

// hand-made candles: two swing boxes, each closed out down and closed back inside within 2 candles
const bar = (i, o, h, l, c, sec = 900) => ({ t: i * sec, o, h, l, c, e: (i + 1) * sec });
function candles() {
  const px = [[10, 10.5, 9.5, 10], [10, 11, 9.8, 10.5], [10.5, 12, 10.2, 11.5], [11.5, 11.8, 10.6, 11], [11, 11.2, 10.4, 10.6],
    [10.6, 10.8, 9.6, 9.9], [9.9, 10.2, 9.0, 9.4], [9.4, 10.1, 9.2, 9.8], [9.8, 10.6, 9.6, 10.4], [10.4, 10.9, 10.2, 10.7],
    [10.7, 11.4, 10.5, 11.0], [11.0, 12.3, 10.9, 11.6], [11.6, 11.7, 10.8, 11.0], [11.0, 11.1, 9.5, 9.7], [9.7, 9.8, 8.6, 8.8],
    [8.8, 9.2, 8.5, 9.0], [9.0, 9.3, 8.8, 9.1]];
  const pre = Array.from({ length: 20 }, (_, i) => bar(i, 10, 10.4, 9.6, 10));
  return [...pre, ...px.map((p, k) => bar(20 + k, ...p))];
}

test('box events on hand-made candles: close-outs and false breaks as defined; nothing from later candles', () => {
  const T = candles(), H = T.filter((_, i) => i % 4 === 0).map((b, k) => ({ ...b, t: k * 3600, e: (k + 1) * 3600 }));
  const ev = boxEvents(T, 0, H);
  const co = ev.filter((e) => e.kind === 'co'), fb = ev.filter((e) => e.kind === 'fb');
  assert.ok(co.length >= 2 && fb.length >= 1, 'events found');
  for (const e of co) assert.ok(e.d > 0 ? T[e.j].c > e.hi : T[e.j].c < e.lo, 'a close-out closes beyond the box');
  for (const e of fb) { assert.ok(T[e.j].c <= e.hi && T[e.j].c >= e.lo, 'a false break closes back inside');
    assert.ok(e.d > 0 ? e.ext > e.hi : e.ext < e.lo, 'its extreme is beyond the edge'); }
  // every event equals the one computed on candles cut just after it
  for (const e of ev) {
    const cut = T.slice(0, e.j + 1), Hc = H.filter((b) => b.e <= T[e.j].e);
    assert.ok(boxEvents(cut, 0, Hc).some((x) => x.kind === e.kind && x.j === e.j && x.d === e.d && x.hi === e.hi && x.lo === e.lo && x.ext === e.ext), `${e.kind} ${e.j}`);
  }
});
