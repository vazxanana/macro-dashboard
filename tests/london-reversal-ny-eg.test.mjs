// tests/london-reversal-ny-eg.test.mjs - the London reversal day / New York pullback study: pre-registration, RESULT.md agrees
// with result.json, the verdict follows the bar, and on seeded candles the signal has no look-ahead and every stop is on the
// losing side. Offline.
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import * as K from '../research/edge/_lib/edgekit.mjs';
import { classify, setups, trade, cellName, cell, NCELL, cutTest, H } from '../research/edge/london-reversal-ny-eg/run.mjs';

const DIR = new URL('../research/edge/london-reversal-ny-eg/', import.meta.url);
const R = JSON.parse(fs.readFileSync(new URL('result.json', DIR), 'utf8'));
const md = fs.readFileSync(new URL('RESULT.md', DIR), 'utf8');
const pre = fs.readFileSync(new URL('PREREGISTRATION.md', DIR), 'utf8');
const f3 = (x) => (x == null ? 'n/a' : (x >= 0 ? '+' : '-') + Math.abs(x).toFixed(3));

function seeded(seed, days = 300) {
  const rnd = K.rng(seed); let p = 1.2; const B = []; const t0 = Date.UTC(2010, 0, 4) / 1000;
  for (let i = 0; i < 288 * days; i++) { const t = t0 + i * 300; const wd = new Date(t * 1000).getUTCDay(); if (wd === 0 || wd === 6) continue;
    const o = p, c = o + (rnd() - 0.5) * 0.0008, h = Math.max(o, c) + rnd() * 0.0003, l = Math.min(o, c) - rnd() * 0.0003; p = c; B.push({ t, o, h, l, c, e: t + 300 }); }
  return B;
}

test('pre-registration names the cells, the windows and the bar', () => {
  for (const w of ['2005-01-01 to 2014-12-31', '2015-01-01 to 2026-10-31', 'Holm', 'AFTER costs', 'n >= 300', 'Cells (8', 'INCONCLUSIVE', 'BEFORE any run'])
    assert.ok(pre.includes(w), w);
});

test('the 8 cells are distinct and as pre-registered', () => {
  const names = Array.from({ length: NCELL }, (_, i) => cellName(i));
  assert.equal(new Set(names).size, 8);
  assert.equal(cellName(cell(1, 0, 1)), 'other lon 2R');
  assert.deepEqual(R.cells.map((c) => c.cell), names);
});

test('line 3 is the verdict line and matches result.json', () => {
  const line = md.split('\n')[2];
  assert.ok(line.startsWith(`**Verdict: ${R.verdict}. `) && line.endsWith('.**'), line);
  assert.ok(line.includes(R.headline));
  const b = R.cells.find((c) => c.cell === R.best);
  assert.ok(R.headline.includes(f3(b.conf.meanNet)) && R.headline.includes(b.conf.tNet.toFixed(2)) && R.headline.includes(Math.round(b.conf.n).toLocaleString('en-US')));
});

test('the verdict follows the pre-registered bar', () => {
  for (const c of R.cells) {
    const ok = c.disc.n >= 300 && c.conf.n >= 300 && c.disc.meanNet > 0 && c.conf.meanNet > 0 && c.disc.tNet >= 2 && c.conf.tNet >= 2 && c.holm < 0.05;
    assert.equal(c.pass, ok, c.cell);
  }
  const any = R.cells.some((c) => c.pass), enough = R.cells.some((c) => c.disc.n >= 300 && c.conf.n >= 300);
  assert.equal(R.verdict, any ? 'PASS' : enough ? 'FAIL' : 'INCONCLUSIVE');
  assert.deepEqual(R.passed, R.cells.filter((c) => c.pass).map((c) => c.cell));
  assert.deepEqual(R.markets, ['xau', 'eurusd', 'gbpusd', 'usdjpy', 'audusd']);
});

test('RESULT.md lists every cell with its figures from result.json; the cut check found no difference', () => {
  for (const c of R.cells) {
    const row = md.split('\n').find((l) => l.startsWith(`| ${c.cell} | `) && l.split('|').length > 15); assert.ok(row, c.cell);
    for (const w of [c.disc, c.conf]) for (const x of [f3(w.mean), f3(w.meanNet), w.tNet.toFixed(2)]) assert.ok(row.includes(x), c.cell + ' ' + x);
  }
  assert.ok(R.cut.length >= 5); for (const x of R.cut) assert.equal(x.missing + x.extra, 0, x.market + ' ' + x.cut);
});

test('classify: a swept Asia high and a London close under the middle / the low; closed candles of the morning only', () => {
  const d0 = Date.UTC(2020, 0, 6) / 1000, B = [];
  for (let i = 0; i < 144; i++) { const t = d0 + i * 300; let o = 100, h = 100.5, l = 99.5, c = 100;      // Asia 99.5-100.5
    if (i >= 84) { h = 100.2; l = 99.8; }
    if (i === 90) h = 101;                                                                                // London sweeps the high
    if (i === 143) { c = 99.7; l = 99.6; }                                                                // closes under the middle 100
    B.push({ t, o, h, l, c, e: t + 300 }); }
  let d = classify(B, d0); assert.equal(d.dir, -1); assert.equal(d.other, false); assert.equal(d.mid, 100);
  B[143].c = 99.4; B[143].l = 99.3; d = classify(B, d0); assert.equal(d.dir, -1); assert.equal(d.other, true);
  B[90].h = 100.2; assert.equal(classify(B, d0).dir, 0);                                                  // no sweep, no reversal
  assert.equal(classify(B.slice(0, 120), d0), null);                                                      // London not complete
});

test('seeded candles: orders exist, every stop is on the losing side, fills are in New York hours, exits by 20:00 UTC', () => {
  const B = seeded(5), S = setups(B); let n = 0;
  for (const s of S) for (const o of [...s.orders, ...s.ctl[1], ...s.ctl[-1]]) { if (!o) continue; n++;
    assert.ok(o.side * (o.entry - o.stop) > 0, 'stop side');
    assert.ok(o.t >= s.day.d0 + 12 * H && o.t < s.day.d0 + 16 * H, 'fill hour');
    assert.ok(o.at >= s.day.d0 + 8 * H && o.at <= o.t, 'zone known before the fill');
    for (const k of [1, 2]) { const r = trade(B, o, s.day.d0, k, 0.00006);
      assert.ok(['win', 'loss', 'be'].includes(r.status)); assert.equal(r.fillT, o.t);
      assert.ok(r.exitT <= s.day.d0 + 20 * H, 'out by 20:00'); assert.ok(r.R >= -1 - 1e-9 || r.reason === 'stop');
      assert.ok(r.Rnet < r.R); }
    if (s.day.dir) assert.ok(s.orders.every((x) => !x || x.side === s.day.dir)); }
  assert.ok(n > 50, 'orders ' + n);
  assert.ok(S.some((s) => s.day.dir && s.orders[1]));
});

test('seeded candles: no look-ahead (cut series, and every later price changed)', () => {
  const B = seeded(9, 260);
  for (const x of cutTest('seeded', B, ['2010-04-14', '2010-07-07', '2010-09-22'])) { assert.ok(x.n > 20); assert.equal(x.missing + x.extra, 0, x.cut); }
  const T = Date.UTC(2010, 5, 16) / 1000, rnd = K.rng(77);
  const B2 = B.map((b) => (b.t < T ? b : { ...b, o: b.o + 0.01 * rnd(), h: b.h + 0.03, l: b.l - 0.03 * rnd(), c: b.c - 0.01 * rnd() }));
  const key = (s) => JSON.stringify([s.day, s.orders, s.ctl]);
  const a = setups(B).filter((s) => s.day.d0 + 16 * H <= T).map(key), b = setups(B2).filter((s) => s.day.d0 + 16 * H <= T).map(key);
  assert.ok(a.length > 50); assert.deepEqual(a, b);
});
