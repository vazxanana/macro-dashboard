// tests/h1-origin-h4-range.test.mjs - the H1 break-origin zone split by its place in the H4 dealing range: pre-registration,
// RESULT.md agrees with result.json, the verdict follows the bar, and on seeded candles the orders have no look-ahead, their
// stop on the losing side and their class as defined. Offline.
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import * as K from '../research/edge/_lib/edgekit.mjs';
import { orders, frames, trade, CELLS, P } from '../research/edge/h1-origin-h4-range/run.mjs';

const DIR = new URL('../research/edge/h1-origin-h4-range/', import.meta.url);
const R = JSON.parse(fs.readFileSync(new URL('result.json', DIR), 'utf8'));
const md = fs.readFileSync(new URL('RESULT.md', DIR), 'utf8');
const pre = fs.readFileSync(new URL('PREREGISTRATION.md', DIR), 'utf8');
const f3 = (x) => (x >= 0 ? '+' : '-') + Math.abs(x).toFixed(3);

function seeded(seed, n) {
  const rnd = K.rng(seed); let p = 100; const B = [];
  for (let i = 0; i < n; i++) { const o = p, c = o + (rnd() - 0.5) * 0.4, h = Math.max(o, c) + rnd() * 0.15, l = Math.min(o, c) - rnd() * 0.15; p = c; B.push({ t: i * 300, o, h, l, c, e: i * 300 + 300 }); }
  return B;
}
const key = (o) => [o.t, o.side, o.entry, o.stop, o.cls].join('|');

test('pre-registration names the cells, the windows and the bar', () => {
  for (const w of ['2005-01-01 to 2014-12-31', '2015-01-01 to 2026-10-31', 'Holm', 'n >= 300', 'AFTER costs', 'aligned', 'opposite', '1R', '2R', 'touches'.toUpperCase()])
    assert.ok(pre.includes(w), w);
  assert.deepEqual(R.cells.map((c) => c.cell), CELLS);
  assert.equal(CELLS.length, 4);
});

test('line 3 is the verdict line and matches result.json', () => {
  const line = md.split('\n')[2];
  assert.equal(line, `**Verdict: ${R.verdict}. ${R.headline}.**`);
  assert.ok(['PASS', 'FAIL', 'INCONCLUSIVE'].includes(R.verdict));
  const b = R.cells.find((c) => c.cell === R.best);
  assert.ok(R.headline.includes(f3(b.conf.mean)) && R.headline.includes(b.conf.t.toFixed(2)) && R.headline.includes(b.conf.n.toLocaleString('en-US')));
  assert.ok(R.headline.includes(f3(b.conf.gross)) && R.headline.includes(f3(b.disc.mean)));
});

test('the verdict follows the pre-registered bar and every cell is in RESULT.md', () => {
  for (const c of R.cells) {
    const ok = c.disc.n >= 300 && c.conf.n >= 300 && c.disc.mean > 0 && c.conf.mean > 0 && c.disc.t >= 2 && c.conf.t >= 2 && c.holm < 0.05;
    assert.equal(c.pass, ok, c.cell);
    const row = md.split('\n').find((l) => l.startsWith(`| ${c.cell} |`)); assert.ok(row, c.cell);
    for (const x of [f3(c.disc.gross), f3(c.disc.mean), c.disc.t.toFixed(2), f3(c.conf.gross), f3(c.conf.mean), c.conf.t.toFixed(2), String(c.conf.n)]) assert.ok(row.includes(x), c.cell + ' ' + x);
    assert.equal(c.disc.months, 120); assert.equal(c.conf.months, 142);
  }
  const enough = R.cells.some((c) => c.disc.n >= 300 && c.conf.n >= 300);
  assert.equal(R.verdict, R.cells.some((c) => c.pass) ? 'PASS' : enough ? 'FAIL' : 'INCONCLUSIVE');
  assert.deepEqual(R.passed, R.cells.filter((c) => c.pass).map((c) => c.cell));
  assert.equal(R.markets.length, 5);
  assert.ok(R.cut.length >= 15); for (const x of R.cut) assert.equal(x.missing + x.extra, 0, x.market + ' ' + x.cut);
});

test('seeded candles: stop on the losing side, the zone behind the break, the class as defined', () => {
  const M5 = seeded(5, 40000); const { h1, h4 } = frames(M5); const O = orders(h1, h4, 0.001);
  assert.ok(O.length > 100); const seen = new Set();
  for (const o of O) {
    assert.ok(o.side * (o.entry - o.stop) > 0, 'stop side');
    assert.ok(o.side > 0 ? o.entry === o.zone[1] && o.stop < o.zone[0] : o.entry === o.zone[0] && o.stop > o.zone[1]);
    const b = h1[o.j]; assert.equal(o.t, b.e); assert.ok(o.side > 0 ? o.zone[1] < b.c : o.zone[0] > b.c);
    assert.ok(o.side * (o.entry - o.stop) >= P.minCost * 0.001);
    if (o.cls !== 'outside') {
      const [lo, hi] = o.range, mid = (lo + hi) / 2; assert.ok(o.entry >= lo && o.entry <= hi);
      assert.equal(o.cls, (o.side > 0) === (o.entry < mid) ? 'aligned' : 'opposite');
      // the range is the last H4 swings confirmed by the order time
      const sw = K.swings(h4, P.K4).filter((s) => s.ct <= o.t);
      assert.equal(hi, sw.filter((s) => s.type === 'H').sort((a, b) => a.ct - b.ct).pop().price);
      assert.equal(lo, sw.filter((s) => s.type === 'L').sort((a, b) => a.ct - b.ct).pop().price);
    }
    seen.add(o.cls);
  }
  assert.deepEqual([...seen].sort(), ['aligned', 'opposite', 'outside']);
});

test('no look-ahead: cutting the candles, or changing every later price, leaves the earlier orders as they were', () => {
  const M5 = seeded(9, 30000); const F = frames(M5); const full = orders(F.h1, F.h4, 0.001);
  for (const n of [9000, 17003, 25500]) {
    const C = M5.slice(0, n), T = C[C.length - 1].e;
    const a = orders(...Object.values(frames(C)), 0.001).map(key), b = full.filter((o) => o.t <= T).map(key);
    assert.deepEqual(a, b, 'cut ' + n);
    const X = M5.map((x, i) => (i < n ? x : { ...x, o: x.o * 3, h: x.h * 3, l: x.l * 3, c: x.c * 3 }));
    const c = orders(...Object.values(frames(X)), 0.001).filter((o) => o.t <= T - 3600).map(key);
    assert.deepEqual(c, full.filter((o) => o.t <= T - 3600).map(key), 'changed ' + n);
  }
});

test('the trade: a limit at the entry, only the stop on the fill candle, stop first, targets from the entry', () => {
  const bar = (t, o, h, l, c) => ({ t, o, h, l, c, e: t + 300 });
  const o = { side: 1, entry: 100, stop: 99, t: 0, expire: 3000 };
  // fill candle reaches +1R too: not counted there; the next candle holds stop and target: a stop
  let r = trade(o, [bar(0, 100.5, 101.2, 99.9, 100.5), bar(300, 100.5, 101.5, 98.5, 100)], 0.1, 1);
  assert.equal(r.fill, 100); assert.equal(r.reason, 'stop'); assert.equal(r.R, -1); assert.ok(Math.abs(r.Rnet + 1.1) < 1e-9);
  r = trade(o, [bar(0, 100.5, 100.6, 99.9, 100.2), bar(300, 100.2, 102.1, 100.1, 102)], 0.1, 2);
  assert.equal(r.reason, 'target'); assert.equal(r.R, 2);
  // never touched before the order expires: no trade
  assert.equal(trade(o, [bar(0, 100.5, 100.6, 100.1, 100.2), bar(3000, 100, 100, 99.5, 99.6)], 0.1, 1).status, 'nofill');
});
