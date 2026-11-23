// tests/fade-at-opens.test.mjs - opening prices as levels: pre-registration, RESULT.md agrees with result.json, the verdict
// follows the bar, the 57 cells, the levels and events on hand-made candles, the control matching. Offline.
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { levels, levelEvents, nearest, cellName, cellA, cellB, NCELL } from '../research/edge/fade-at-opens/run.mjs';

const DIR = new URL('../research/edge/fade-at-opens/', import.meta.url);
const R = JSON.parse(fs.readFileSync(new URL('result.json', DIR), 'utf8'));
const md = fs.readFileSync(new URL('RESULT.md', DIR), 'utf8');
const pre = fs.readFileSync(new URL('PREREGISTRATION.md', DIR), 'utf8');
const f3 = (x) => (x >= 0 ? '+' : '-') + Math.abs(x).toFixed(3);
const U = (y, m, d, h = 0, mi = 0) => Date.UTC(y, m, d, h, mi) / 1000;

test('pre-registration names the cells, windows, bar, control and assumed costs', () => {
  for (const w of ['57', '2005-01-01 to 2014-12-31', '2015-01-01 to 2026-10-31', 'Holm', 'ASSUMED', 'BEFORE costs', 'Welch t >= 2', 'within 2 hours', 'side-flipped'])
    assert.ok(pre.includes(w), w);
});

test('the 57 cells are distinct and as pre-registered', () => {
  const names = Array.from({ length: NCELL }, (_, i) => cellName(i).name);
  assert.equal(new Set(names).size, 57);
  assert.equal(cellName(cellA(0, 1, 0)).name, 'nymid m15 fade 1R');
  assert.equal(cellName(cellA(6, 2, 1)).name, 'mopen h1 failed 2R');
  assert.equal(cellName(cellB(2, 3)).name, 'm15all failed 1R first');
  assert.deepEqual(R.cells.map((c) => c.cell), names);
});

test('levels: New York midnight and 08:30 follow daylight time; Daily on UTC weekdays; Weekly and Monthly first candles', () => {
  const B = [];   // 5-minute candles 2020-03-05 (EST) .. 2020-03-10 (EDT from 8 Mar), with a weekend gap
  for (let t = U(2020, 2, 5); t < U(2020, 2, 10, 12); t += 300) { const wd = new Date(t * 1000).getUTCDay(), h = new Date(t * 1000).getUTCHours();
    if (wd === 6 || (wd === 0 && h < 21) || (wd === 5 && h >= 21)) continue; B.push({ t, o: t / 1e6, h: 1, l: 0, c: 1, e: t + 300 }); }
  const L = levels(B);
  assert.ok(L.nymid.some((x) => x.t === U(2020, 2, 5, 5)), 'EST midnight = 05:00 UTC');
  assert.ok(L.nymid.some((x) => x.t === U(2020, 2, 9, 4)), 'EDT midnight = 04:00 UTC');
  assert.ok(L.ny0830.some((x) => x.t === U(2020, 2, 6, 13, 30)) && L.ny0830.some((x) => x.t === U(2020, 2, 9, 12, 30)));
  assert.ok(L.dopen.every((x) => x.t % 86400 === 0 && [1, 2, 3, 4, 5].includes(new Date(x.t * 1000).getUTCDay())));
  assert.ok(L.wopen.some((x) => x.t === U(2020, 2, 8, 21)), 'the Sunday reopen');
  assert.equal(L.mopen[0].t, B[0].t);
  for (const k of Object.keys(L)) for (const x of L[k]) assert.equal(x.px, B.find((b) => b.t === x.t).o);
});

test('events: the first candle sets the side; a cross; a failed cross with its stop', () => {
  const T = []; const c = [99, 101, 102, 99.5, 100.4, 98, 97];   // level 100, ATR 1
  const hi = [99.5, 101.5, 102.5, 101, 100.5, 101, 98], lo = [98.5, 99, 101, 99, 99, 97.5, 96];
  for (let i = 0; i < c.length; i++) T.push({ t: 1000 + i * 900, o: 100, h: hi[i], l: lo[i], c: c[i], e: 1900 + i * 900 });
  const atr = new Float64Array(T.length).fill(1);
  const ev = levelEvents(T, atr, [{ t: 1000, px: 100, end: Infinity }]);
  const cross = ev.filter((e) => e.ev === 'cross').map((e) => [e.k, e.s0]);
  assert.deepEqual(cross, [[1, 1], [3, -1], [4, 1], [5, -1]]);
  const up = ev.find((e) => e.ev === 'cross' && e.k === 1); assert.ok(Math.abs(up.stop - 101.6) < 1e-9, 'fade stop past the high + 0.1 ATR');
  // failed: from below, candle 1 trades 1.5 ATR through, candles 1-2 close above, candle 3 closes back below (within 3): sell,
  // stop past the highest high 102.5 + 0.1; then candle 4 pokes 0.5 ATR above and candle 5 closes back below: stop 101 + 0.1
  const f = ev.filter((e) => e.ev === 'failed').map((e) => [e.k, e.s0, +e.stop.toFixed(9), e.ord]);
  assert.deepEqual(f, [[3, -1, 102.6, 0], [5, -1, 101.1, 1]]);
  for (const e of ev) assert.ok(e.ev === 'cross' ? true : e.s0 * (T[e.k].c - e.stop) > 0, 'stop on the losing side');
});

test('control matching: nearest fill within 2 hours, earlier wins a tie', () => {
  const ts = [1000, 5000, 9000];
  assert.equal(nearest(ts, 3000), 0); assert.equal(nearest(ts, 5100), 1); assert.equal(nearest(ts, 20000), -1); assert.equal(nearest(ts, 9000 + 7201), -1);
});

test('line 3 is the verdict line and matches result.json', () => {
  const line = md.split('\n')[2];
  assert.ok(line.startsWith(`**Verdict: ${R.verdict}.`), line);
  assert.ok(line.includes(R.headline), 'headline');
  assert.ok(['PASS', 'FAIL', 'INCONCLUSIVE'].includes(R.verdict));
});

test('the verdict follows the pre-registered bar', () => {
  for (const c of R.cells) {
    const b4 = c.disc.n >= 300 && c.conf.n >= 300 && c.disc.mean > 0 && c.conf.mean > 0 && c.disc.t >= 2 && c.conf.t >= 2 && c.holm < 0.05;
    const ctl = c.disc.diff > 0 && c.conf.diff > 0 && c.disc.welch >= 2 && c.conf.welch >= 2;
    assert.equal(c.pass, b4 && ctl, c.cell);
  }
  assert.equal(R.verdict, R.cells.some((c) => c.pass) ? 'PASS' : 'FAIL');
  assert.deepEqual(R.passed, R.cells.filter((c) => c.pass).map((c) => c.cell));
  assert.deepEqual(R.assumedCosts, ['xag', 'nzdusd', 'usdcad', 'usdchf', 'eurjpy']);
  assert.equal(R.markets.length, 10);
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
