// tests/round-number-breaks.test.mjs - round numbers as levels: the pre-registration, RESULT.md agrees with result.json, the
// verdict follows the bar, the 48 cells, and the event detector on hand-made candles (no look-ahead). Offline.
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import * as K from '../research/edge/_lib/edgekit.mjs';
import { events, cellName, cellIndex, NCELL, STEPS, SHIFTS } from '../research/edge/round-number-breaks/run.mjs';
import { atr14 } from '../research/edge/dom-trade-through/run.mjs';

const DIR = new URL('../research/edge/round-number-breaks/', import.meta.url);
const R = JSON.parse(fs.readFileSync(new URL('result.json', DIR), 'utf8'));
const md = fs.readFileSync(new URL('RESULT.md', DIR), 'utf8');
const pre = fs.readFileSync(new URL('PREREGISTRATION.md', DIR), 'utf8');
const f3 = (x) => (x >= 0 ? '+' : '-') + Math.abs(x).toFixed(3);

test('pre-registration names the levels, cells, windows, bar, controls and assumed costs', () => {
  for (const w of ['48 cells', '2005-01-01 to 2014-12-31', '2015-01-01 to 2026-10-31', 'Holm', 'ASSUMED', 'Welch t >= 2', '0.23, 0.41,', '0.0050', '| xau | 10 | 50 |', 'BEFORE costs'])
    assert.ok(pre.includes(w), w);
  assert.deepEqual(STEPS.xau, [10, 50]); assert.deepEqual(STEPS.usdjpy, [0.5, 1]); assert.deepEqual(STEPS.eurusd, [0.005, 0.01]); assert.deepEqual(SHIFTS, [0.23, 0.41, 0.59, 0.77]);
});

test('the 48 cells are distinct and as pre-registered', () => {
  const names = Array.from({ length: NCELL }, (_, i) => cellName(i).name);
  assert.equal(new Set(names).size, 48);
  assert.equal(cellName(cellIndex(1, 1, 1)).name, 'fade big 2R');
  assert.equal(cellName(cellIndex(2, 3, 0)).name, 'failed first 1R');
  assert.deepEqual(R.cells.map((c) => c.cell), names);
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
      && c.disc.ctl.welch != null && c.conf.ctl.welch != null && c.disc.ctl.welch >= 2 && c.conf.ctl.welch >= 2;
    assert.equal(c.pass, ok, c.cell);
  }
  assert.equal(R.verdict, R.markets.length < 8 ? 'INCONCLUSIVE' : R.cells.some((c) => c.pass) ? 'PASS' : 'FAIL');
  assert.deepEqual(R.passed, R.cells.filter((c) => c.pass).map((c) => c.cell));
  assert.deepEqual(R.assumedCosts, ['xag', 'nzdusd', 'usdcad', 'usdchf', 'eurjpy']);
});

test('RESULT.md lists every cell with its figures from result.json, and the cut test is clean', () => {
  for (const c of R.cells) {
    const row = md.split('\n').find((l) => l.startsWith(`| ${c.cell} |`)); assert.ok(row, c.cell);
    if (c.conf.mean != null) assert.ok(row.includes(f3(c.conf.mean)) && row.includes(c.conf.t.toFixed(2)), c.cell);
    if (c.disc.mean != null) assert.ok(row.includes(f3(c.disc.mean)) && row.includes(c.disc.t.toFixed(2)), c.cell);
  }
  assert.ok(R.cut.length >= 5);
  for (const x of R.cut) assert.equal(x.missing + x.extra, 0, 'cut test ' + x.market + ' ' + x.cut);
});

// hand-made M15 candles
const bar = (i, o, h, l, c) => ({ t: i * 900, o, h, l, c, e: i * 900 + 900 });
function flat(n, px) { const B = []; for (let i = 0; i < n; i++) B.push(bar(i, px, px + 0.0004, px - 0.0004, px)); return B; }

test('a close beyond a round level is one event at the farthest level; big and first are set', () => {
  const B = flat(20, 1.0980); B.push(bar(20, 1.0980, 1.1060, 1.0978, 1.1055)); // crosses 1.1000 (big) and 1.1050 (small)
  const ev = events(B, atr14(B), { off: 0, S: 0.005, ratio: 2 }).filter((e) => e.type === 'cross');
  assert.equal(ev.length, 1); assert.equal(ev[0].d, 1); assert.ok(Math.abs(ev[0].L - 1.105) < 1e-12); assert.equal(ev[0].big, false); assert.equal(ev[0].first, true);
  B.push(bar(21, 1.1055, 1.1056, 1.1040, 1.1045)); B.push(bar(22, 1.1045, 1.1058, 1.1044, 1.1056)); // back under 1.1050, then over again: later
  const e2 = events(B, atr14(B), { off: 0, S: 0.005, ratio: 2 }).filter((e) => e.type === 'cross');
  assert.equal(e2.length, 3); assert.equal(e2[1].d, -1); assert.equal(e2[2].first, false);
});

test('a failed cross: a wick through by 0.2 ATR closed back within two candles, nothing without the close back', () => {
  const B = flat(20, 1.0990); const a = atr14(B)[19];
  B.push(bar(20, 1.0990, 1.1000 + 0.5 * a, 1.0988, 1.1004)); // closes above (a cross) ...
  B.push(bar(21, 1.1004, 1.1006, 1.0985, 1.0992));           // ... and back below on the next candle: failed
  const ev = events(B, atr14(B), { off: 0, S: 0.005, ratio: 2 });
  const f = ev.filter((e) => e.type === 'failed'); assert.equal(f.length, 1);
  assert.equal(f[0].d, 1); assert.equal(f[0].j, 20); assert.equal(f[0].k, 21); assert.equal(f[0].ts, B[21].e); assert.equal(f[0].big, true);
  assert.ok(Math.abs(f[0].ext - 1.1006) < 1e-12); // the highest high of the probe and the close-back candle
  const C = flat(20, 1.0990); C.push(bar(20, 1.0990, 1.1000 + 0.5 * a, 1.0988, 1.1004)); C.push(bar(21, 1.1004, 1.1010, 1.1001, 1.1008));
  assert.equal(events(C, atr14(C), { off: 0, S: 0.005, ratio: 2 }).filter((e) => e.type === 'failed').length, 0);
});

test('no look-ahead: events known by a cut equal the full run on random candles', () => {
  const rnd = K.rng(5); let p = 1.2; const B = [];
  for (let i = 0; i < 4000; i++) { const o = p, c = o + (rnd() - 0.5) * 0.004; B.push(bar(i, o, Math.max(o, c) + rnd() * 0.002, Math.min(o, c) - rnd() * 0.002, c)); p = c; }
  const g = { off: 0, S: 0.005, ratio: 2 }; const key = (e) => JSON.stringify(e);
  const full = events(B, atr14(B), g); assert.ok(full.length > 100);
  for (const n of [500, 1777, 3000]) { const T = B[n - 1].e; const cut = B.slice(0, n);
    assert.deepEqual(events(cut, atr14(cut), g).filter((e) => e.ts <= T).map(key), full.filter((e) => e.ts <= T).map(key)); }
});
