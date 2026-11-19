// research/edge/gold-quarter-open: the level, arming, fills, stops and the report against result.json (offline)
import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { levels, simulate, rOf, holm, atr, placeboLevels, quarterOf, P } from '../research/edge/gold-quarter-open/run.mjs';

const dir = new URL('../research/edge/gold-quarter-open/', import.meta.url);
const R = JSON.parse(fs.readFileSync(new URL('result.json', dir), 'utf8'));
const md = fs.readFileSync(new URL('RESULT.md', dir), 'utf8');
const p = { ...P, start: 0 };
const t0 = Date.UTC(2020, 0, 1) / 1000;   // a quarter's first day
// flat days of range 2 (ATR 2) around `c`; edit single days by index
const flat = (n, c = 100) => Array.from({ length: n }, (_, i) => ({ time: t0 + i * 86400, open: c, high: c + 1, low: c - 1, close: c }));
const set = (bars, i, b) => { bars[i] = { ...bars[i], ...b }; return bars; };

test('the level is the open of the quarter\'s first bar, one per quarter', () => {
  const bars = flat(100); bars[0].open = 99.5;
  const L = levels(bars, p);
  assert.equal(L.get(quarterOf(t0)).level, 99.5);
  assert.equal(L.get(quarterOf(t0)).first, 0);
  assert.equal(L.size, 2);   // 100 days cross into Q2 2020
  assert.equal(L.get(quarterOf(t0 + 91 * 86400)).first, 91);
});

test('T1: armed by a close 2 ATR away, filled at the level on the touch, stop 1.5 ATR, out after 5 days', () => {
  const bars = flat(60);
  for (let i = 20; i < 25; i++) set(bars, i, { open: 106, high: 107, low: 105, close: 106 });   // close 106 >= 100 + 2 x ATR
  set(bars, 25, { open: 104, high: 104.5, low: 99.5, close: 100.5 });                           // touches 100 from above
  const L = levels(bars, p), tr = simulate(bars, L, 'hold', p);
  assert.equal(tr.length, 1);
  const x = tr[0], a = atr(bars)[24];
  assert.equal(x.side, 1); assert.equal(x.entry, 100); assert.equal(x.entryI, 25);
  assert.ok(Math.abs(x.dist - 1.5 * a) < 1e-12 && x.stop < x.entry);
  assert.equal(x.why, 'time'); assert.equal(x.exitI, 30);
  // a touch day whose low also reaches the stop is a stop on that day
  const b2 = flat(60); for (let i = 20; i < 25; i++) set(b2, i, { open: 106, high: 107, low: 105, close: 106 });
  set(b2, 25, { open: 104, high: 104.5, low: 90, close: 91 });
  const s = simulate(b2, levels(b2, p), 'hold', p)[0];
  assert.equal(s.why, 'stop'); assert.equal(s.exitI, 25); assert.equal(s.exit, s.stop);
  // never armed (no 2 ATR close): no trade
  assert.equal(simulate(flat(60), levels(flat(60), p), 'hold', p).length, 0);
});

test('T2 sells the next open after a close through the level; T3 fades a 3 ATR stretch toward the level', () => {
  const bars = flat(60);
  for (let i = 20; i < 25; i++) set(bars, i, { open: 106, high: 107, low: 105, close: 106 });
  set(bars, 25, { open: 104, high: 104, low: 98.5, close: 99 });   // close below 100
  const t2 = simulate(bars, levels(bars, p), 'break', p);
  assert.equal(t2[0].side, -1); assert.equal(t2[0].entryI, 26); assert.equal(t2[0].entry, bars[26].open);
  assert.ok(t2[0].stop > t2[0].entry);
  const b3 = flat(60);
  set(b3, 20, { open: 108, high: 109, low: 107, close: 108 });     // 108 >= 100 + 3 x ATR(2.6...)
  set(b3, 21, { open: 107, high: 107.5, low: 99.5, close: 100 });   // reaches the target 100
  const t3 = simulate(b3, levels(b3, p), 'magnet', p);
  assert.equal(t3[0].side, -1); assert.equal(t3[0].entryI, 21); assert.equal(t3[0].target, 100);
  assert.equal(t3[0].why, 'target'); assert.equal(t3[0].exit, 100);
});

test('no look-ahead, a stop on every trade, costs and the placebo levels', () => {
  const bars = flat(150).map((b, i) => { const c = 100 + 8 * Math.sin(i / 5); return { ...b, open: c, high: c + 1.2, low: c - 1.2, close: c + 0.3 }; });
  for (const kind of ['hold', 'break', 'magnet']) {
    const a = simulate(bars, levels(bars, p), kind, p);
    for (const x of a) assert.ok(x.dist > 0 && (x.stop - x.entry) * x.side < 0, kind);
    const k = 100, b2 = bars.map((b, i) => (i > k ? { ...b, open: b.open * 2, high: b.high * 2, low: b.low * 2, close: b.close * 2 } : b));
    const c = simulate(b2, levels(b2, p), kind, p);
    const before = (L) => L.filter((x) => x.exitI <= k).map((x) => [x.entryI, x.exitI, x.exit, x.why]);
    assert.deepEqual(before(a), before(c), kind);
  }
  const t = { side: 1, entry: 2000, exit: 2030, dist: 30, entryT: Date.UTC(2020, 0, 6) / 1000, exitT: Date.UTC(2020, 0, 13) / 1000 };
  const r = rOf(t), r2 = rOf(t, 2);
  assert.equal(r.gross, 1); assert.equal(r.cost, 0.02); assert.equal(r.nights, 7);
  assert.ok(Math.abs(r.fin - 7 * 0.000148 * 2000 / 30) < 1e-12 && Math.abs(r2.fin - 2 * r.fin) < 1e-12);
  assert.equal(rOf({ ...t, side: -1 }).fin, 0);
  assert.deepEqual(holm([0.01, 0.04, 0.03]), [0.03, 0.06, 0.06]);
  const L = levels(bars, p), A = atr(bars), pl = placeboLevels(bars, L, 7, p);
  for (const [q, x] of pl) { const d = Math.abs(x.level - L.get(q).level), a = A[x.first - 1] || A[x.first] || 0; assert.ok(a === 0 || (d >= a - 1e-9 && d <= 3 * a + 1e-9)); }
  assert.deepEqual([...placeboLevels(bars, L, 7, p)], [...pl]);
});

test('the report matches result.json', () => {
  assert.equal(R.verdict, 'FAIL'); assert.equal(R.pass, false); assert.deepEqual(R.secondary, []);
  const v = md.match(/\*\*Verdict:[^*]*\*\*/)[0];
  assert.match(v, /^\*\*Verdict: FAIL, 0 of 3: /); assert.ok(v.length < 220);
  const f = (x) => (x >= 0 ? '+' : '-') + Math.abs(x).toFixed(3);
  for (const id of ['T1', 'T2', 'T3']) {
    const x = R.tests[id];
    assert.equal(x.pass, false);
    for (const w of ['IS', 'OOS']) {
      assert.ok(md.includes(`| ${x[w].n} |`), `${id} ${w} n`);
      assert.ok(md.includes(f(x[w].net)), `${id} ${w} net`);
      assert.ok(md.includes(f(x[w].gross)), `${id} ${w} gross`);
      assert.ok(md.includes(x[w].t.toFixed(2)), `${id} ${w} t`);
    }
    assert.ok(md.includes(`(${x.placebo.beaten}; placebo median`), `${id} placebo`);
    assert.ok(md.includes(`Holm p ${x.holmP.toFixed(2)}`), `${id} holm`);
  }
  assert.ok(md.includes(f(R.tests.T1.OOS.net) + 'R a trade net out of sample (n ' + R.tests.T1.OOS.n));
});
