// tests/sweep-m5-engulf-limit.test.mjs - the M15 sweep with an M5 engulf limit entry: the pre-registration, RESULT.md against
// result.json, the verdict against the bar, a hand-made sweep, no look-ahead and the stop side on seeded candles. Offline.
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import * as K from '../research/edge/_lib/edgekit.mjs';
import { signals, trades, sigKey, cellName, cellIndex, judge, headline, markdown, NCELL, MIN_N } from '../research/edge/sweep-m5-engulf-limit/run.mjs';

const DIR = new URL('../research/edge/sweep-m5-engulf-limit/', import.meta.url);
const R = JSON.parse(fs.readFileSync(new URL('result.json', DIR), 'utf8'));
const md = fs.readFileSync(new URL('RESULT.md', DIR), 'utf8');
const pre = fs.readFileSync(new URL('PREREGISTRATION.md', DIR), 'utf8');

function walk(days, seed, t0 = Date.UTC(2021, 0, 4) / 1000) {
  const r = K.rng(seed), B = []; let p = 100;
  for (let i = 0, t = t0; i < 288 * days; i++, t += 300) {
    const wd = new Date(t * 1000).getUTCDay(); if (wd === 0 || wd === 6) continue;
    const o = p, c = o + (r() - 0.5) * 0.2, h = Math.max(o, c) + r() * 0.08, l = Math.min(o, c) - r() * 0.08;
    B.push({ t, o, h, l, c, e: t + 300 }); p = c;
  }
  return B;
}

test('pre-registration fixes the cells, the windows, the bar and the entry', () => {
  for (const w of ['8, fixed here', '2005-01-01 to 2014-12-31', '2015-01-01 to 2026-10-31', 'Holm', 'n >= 300', 'engulfAt(C, k, 3)',
    'limit at the zone\'s near edge', 'AFTER costs', 'Stop first', '0.1 x ATR(14)'].filter((x) => x !== 'Stop first'))
    assert.ok(pre.includes(w), w);
  assert.ok(pre.includes('stop comes first when one candle holds both'));
});

test('the 8 cells are as pre-registered', () => {
  const names = Array.from({ length: NCELL }, (_, i) => cellName(i));
  assert.equal(new Set(names).size, 8);
  assert.equal(cellName(cellIndex(0, 0, 0)), 'asia london 2R'); assert.equal(cellName(cellIndex(1, 1, 1)), 'day ny far');
  assert.deepEqual(R.cells.map((c) => c.cell), names);
});

test('RESULT.md line 3 is the verdict line; headline, verdict and document follow result.json', () => {
  const line = md.split('\n')[2];
  assert.equal(line, `**Verdict: ${R.verdict}. ${R.headline}.**`);
  assert.equal(R.headline, headline(R));
  assert.equal(md, markdown(R));
  const cells = JSON.parse(JSON.stringify(R.cells)), J = judge(cells);
  assert.equal(J.verdict, R.verdict); assert.equal(J.best, R.best); assert.deepEqual(J.passed, R.passed);
  for (const c of R.cells) {
    const ok = c.disc.n >= MIN_N && c.conf.n >= MIN_N && c.disc.after > 0 && c.conf.after > 0 && c.disc.tAfter >= 2 && c.conf.tAfter >= 2 && c.holm < 0.05;
    assert.equal(c.pass, ok, c.cell);
    assert.ok(c.conf.after <= c.conf.before + 1e-12 && c.disc.after <= c.disc.before + 1e-12, 'costs only take');
  }
  assert.equal(R.verdict === 'PASS', R.passed.length > 0);
  assert.ok(!/\bedge\b/i.test(R.headline));
});

test('a hand-made sweep of the Asia high in London gives a sell limit at the engulfed candle\'s low, stop above the extreme', () => {
  const D0 = Date.UTC(2021, 2, 10) / 1000, B = [];
  for (let t = D0 - 3 * 86400; t < D0 + 86400; t += 300) {      // flat market at 100 with a little wiggle
    const up = (t / 300) % 2 === 0; B.push({ t, o: up ? 100 : 100.02, h: 100.05, l: 99.97, c: up ? 100.02 : 100, e: t + 300 });
  }
  const at = (h, m) => B.find((b) => b.t === D0 + h * 3600 + m * 60);
  // 08:00 candle spikes over the Asia high (100.05) and closes back under it; 08:15 an up candle (the base), 08:20 closes under its low
  Object.assign(at(8, 0), { o: 100.02, h: 100.60, l: 100.00, c: 100.01 }); Object.assign(at(8, 5), { o: 100.01, h: 100.03, l: 99.99, c: 100.00 });
  Object.assign(at(8, 10), { o: 100.00, h: 100.03, l: 99.98, c: 100.00 });
  Object.assign(at(8, 15), { o: 100.00, h: 100.04, l: 99.99, c: 100.03 });   // base: up candle
  Object.assign(at(8, 20), { o: 100.03, h: 100.04, l: 99.90, c: 99.92 });    // closes below the base's low: the engulf
  const S = signals(B).filter((g) => g.lv === 0 && g.se === 0 && g.s === -1 && g.t > D0);
  assert.equal(S.length, 1); const g = S[0];
  assert.equal(g.t, D0 + 8 * 3600 + 25 * 60); assert.equal(g.edge, 100.05); assert.equal(g.X, 100.60);
  assert.equal(g.entry, 99.99); assert.ok(g.stop > g.X); assert.equal(g.far, 99.97);
  // 08:25 trades back up to the limit, then price falls through the 2R target
  Object.assign(at(8, 25), { o: 99.92, h: 100.00, l: 99.90, c: 99.95 });
  const risk = g.stop - g.entry; for (const b of B) if (b.t >= D0 + 8 * 3600 + 30 * 60 && b.t < D0 + 10 * 3600) { b.o = 99.9; b.h = 99.95; b.l = 99.99 - 3 * risk; b.c = 99.9; }
  const tr = trades(g, B, 0.001); const two = tr.find((x) => x.x === 0);
  assert.equal(two.fill, 99.99); assert.equal(two.reason, 'target'); assert.ok(Math.abs(two.R - 2) < 1e-9); assert.ok(two.Rnet < two.R);
  assert.equal(tr.find((x) => x.x === 1), undefined, 'the far side is under 1R away: not in the far cell');
});

test('no look-ahead: later prices do not change the orders known by a moment; every stop is on the losing side', () => {
  const B = walk(90, 9), cutT = Date.UTC(2021, 2, 10, 13) / 1000;
  const all = signals(B), before = all.filter((g) => g.t <= cutT).map(sigKey);
  assert.ok(before.length > 20, 'orders exist');
  const B2 = B.map((b) => (b.t >= cutT ? { ...b, o: b.o * 1.3, h: b.h * 1.3 + 1, l: b.l * 1.3 - 1, c: b.c * 1.3 } : b));
  assert.deepEqual(signals(B2).filter((g) => g.t <= cutT).map(sigKey), before);
  assert.deepEqual(signals(B.filter((b) => b.e <= cutT)).map(sigKey), before);
  let n = 0;
  for (const g of all) {
    assert.ok(g.s * (g.entry - g.stop) > 0, 'stop on the losing side of the entry');
    assert.ok(g.s * (g.X - g.stop) > 0, 'stop past the sweep extreme');
    assert.ok(g.s < 0 ? g.X > g.edge : g.X < g.edge, 'the extreme is beyond the level');
    assert.ok(g.t > g.mE && g.t <= g.mE + 3600, 'the engulf closes within the hour after the sweep');
    for (const r of trades(g, B, 0.001)) { n++; assert.ok(r.fillT >= g.t && r.fillT < g.t + 3600, 'filled after the order, within its hour');
      assert.ok(r.R >= -1 - 1e-9 || r.reason === 'stop', 'a loss beyond -1R only through a gapped stop'); }
  }
  assert.ok(n > 20, 'trades exist');
});
