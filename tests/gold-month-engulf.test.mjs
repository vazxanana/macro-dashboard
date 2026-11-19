// research/edge/gold-month-engulf: the rule's pieces on hand-made candles, and RESULT.md against result.json (offline)
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { months, outside, bodyEngulf, atrAt, trade, signalsOf, monthSums, holm, toDays, P } from '../research/edge/gold-month-engulf/run.mjs';
import { FIN, nights } from '../council/fills.mjs';

const D = 86400;
// weekday candles from a UTC date for n calendar days, each from fn(dayIndex) -> [o, h, l, c]
function days(y, m, d, n, fn) {
  const ds = []; let t = Date.UTC(y, m - 1, d) / 1000;
  for (let k = 0; k < n; k++, t += D) { const w = new Date(t * 1000).getUTCDay(); if (w && w !== 6) { const [o, h, l, c] = fn(ds.length, t); ds.push({ time: t, open: o, high: h, low: l, close: c }); } }
  return ds;
}
const ym = (t) => new Date(t * 1000).toISOString().slice(0, 7);
// Jan 2024 flat around 1000 (range 990-1010), Feb 2024 an outside month closing up, March flat, April flat
function sample(febClose = 1030) {
  return days(2024, 1, 1, 121, (i, t) => {
    const k = ym(t);
    if (k === '2024-02') { const first = ym(t - D) !== '2024-02'; return first ? [1000, 1001, 980, 1000] : [1000, 1040, 999, febClose]; }
    return [1000, 1010, 990, 1000];
  });
}

test('months aggregate open / high / low / close of the trading days', () => {
  const M = months(sample());
  assert.deepEqual(M.map((m) => m.key), ['2024-01', '2024-02', '2024-03', '2024-04']);
  assert.equal(M[1].open, 1000); assert.equal(M[1].high, 1040); assert.equal(M[1].low, 980); assert.equal(M[1].close, 1030);
});

test('outside month: both extremes taken, side from the month body; body engulf needs the other colour', () => {
  const M = months(sample());
  assert.equal(outside(M, 1), 1);
  assert.equal(outside(months(sample(970)), 1), -1);
  assert.equal(outside(M, 2), 0); // March inside February
  assert.equal(outside(M, 0), 0);
  const mk = (o1, c1, o2, c2) => [{ open: o1, close: c1, high: 0, low: 0 }, { open: o2, close: c2, high: 0, low: 0 }];
  assert.equal(bodyEngulf(mk(1010, 1000, 995, 1020), 1), 1);
  assert.equal(bodyEngulf(mk(1000, 1010, 1015, 995), 1), -1);
  assert.equal(bodyEngulf(mk(1000, 1010, 995, 1020), 1), 0); // same colour
  assert.equal(bodyEngulf(mk(1010, 1000, 1002, 1008), 1), 0); // does not cover
  assert.equal(bodyEngulf(mk(1010, 1000, 1000, 1010), 1), 0); // the same body
  const s = signalsOf(M, outside); assert.deepEqual(s, [[1, 1]]);
});

test('no look-ahead: the signal and its ATR use only days up to the signal month end', () => {
  const ds = sample(), M = months(ds), i = M[1].last, a = atrAt(ds, i), sig = outside(M, 1);
  const ds2 = ds.map((d) => ({ ...d })); for (let j = M[2].first; j < ds2.length; j++) Object.assign(ds2[j], { open: 5000, high: 9000, low: 1, close: 4000 });
  const M2 = months(ds2);
  assert.equal(atrAt(ds2, i), a); assert.equal(outside(M2, 1), sig);
  assert.equal(atrAt(ds, P.atrN - 1), null);
});

test('entry at the next month open, 3 x ATR stop, exit at its last close, financing on buys only', () => {
  const ds = sample(), M = months(ds), atr = atrAt(ds, M[1].last), risk = 3 * atr;
  const tr = trade(ds, M, 1, 1);
  assert.equal(tr.m, '2024-03'); assert.equal(tr.entry, 1000); assert.ok(Math.abs(tr.stop - (1000 - risk)) < 1e-9);
  assert.equal(tr.why, 'time'); assert.equal(tr.exit, 1000); assert.equal(tr.R, 0);
  assert.ok(Math.abs(tr.costR - 0.6 / risk) < 1e-12);
  const nn = nights(ds[M[2].first].time, ds[M[2].last].time + D); assert.equal(tr.nights, nn); assert.ok(nn >= 20);
  assert.ok(Math.abs(tr.finR - nn * FIN.xau.long * 1000 / risk) < 1e-12);
  const sh = trade(ds, M, 1, -1); assert.equal(sh.finR, 0); assert.equal(sh.nights, 0);
  const x2 = trade(ds, M, 1, 1, 2); assert.ok(Math.abs(x2.finR - 2 * tr.finR) < 1e-12);
  assert.equal(trade(ds, M, 3, 1), null); // no following month
});

test('stop on the losing side, a gap through it fills at the open', () => {
  const ds = sample(), M = months(ds), risk = 3 * atrAt(ds, M[1].last);
  const a = ds.map((d) => ({ ...d })); a[M[2].first + 2].low = 1000 - risk - 5;
  const t1 = trade(a, M, 1, 1); assert.equal(t1.why, 'stop'); assert.ok(Math.abs(t1.R + 1) < 1e-12);
  const g = ds.map((d) => ({ ...d })); Object.assign(g[M[2].first + 3], { open: 850, low: 840, high: 855 });
  const t2 = trade(g, M, 1, 1); assert.equal(t2.why, 'gap'); assert.equal(t2.exit, 850);
});

test('month sums count empty months; Holm; weekend folded; parameters', () => {
  assert.deepEqual(monthSums([{ m: '2024-01', net: 1 }, { m: '2024-03', net: -2 }], '2024-01', '2024-04'), [1, 0, -2, 0]);
  assert.deepEqual(holm([0.01, 0.04, 0.03]), [0.03, 0.06, 0.06]);
  const sat = Date.UTC(2024, 0, 6) / 1000;
  const f = toDays([[sat - D, 1, 2, 0.5, 1.5, 1], [sat + D, 1.5, 3, 1.4, 1.6, 1], [sat + 2 * D, 1.6, 1.7, 1.2, 1.3, 1]]);
  assert.equal(f.length, 2);
  assert.equal(P.atrN, 20); assert.equal(P.stopAtr, 3); assert.equal(P.cost, 0.60); assert.equal(P.seeds, 40);
});

test('RESULT.md agrees with result.json', () => {
  const r = JSON.parse(fs.readFileSync(new URL('../research/edge/gold-month-engulf/result.json', import.meta.url), 'utf8'));
  const md = fs.readFileSync(new URL('../research/edge/gold-month-engulf/RESULT.md', import.meta.url), 'utf8');
  const vl = md.split('\n').find((l) => l.startsWith('**Verdict:'));
  assert.ok(vl.startsWith(`**Verdict: ${r.verdict},`)); assert.ok(vl.length < 220);
  const f = (v) => (v === 0 ? '0' : (v > 0 ? '+' : '-') + Math.abs(v).toFixed(3));
  const tt = (v) => (v === 0 ? '0' : v.toFixed(2));
  for (const id of ['T1', 'T2', 'T3']) {
    const g = r.gold.tests[id], c = r.gold.checks[id], row = md.split('\n').find((l) => l.startsWith(`| ${id} `));
    const cells = row.split('|').map((s) => s.trim()).filter(Boolean);
    assert.deepEqual(cells.slice(1, 10), [String(g.is.n), f(g.isGross.mean), f(g.is.mean), tt(g.is.monthT), String(g.oos.n), f(g.oosGross.mean), f(g.oos.mean), tt(g.oosGross.monthT), tt(g.oos.monthT)]);
    assert.ok(Math.abs(+cells[10] - c.holmP) < 0.001);
    assert.deepEqual(cells.slice(11), [f(g.oos2x.mean), f(g.half1.mean), f(g.half2.mean), c.pass ? 'yes' : 'no']);
  }
  assert.equal(r.verdict, r.gold.checks.T1.pass ? 'PASS' : 'FAIL');
  assert.ok(md.includes(`beats ${r.gold.tests.T1.placebo.beaten} of 40`));
  assert.ok(md.includes(`${r.gold.data.days.toLocaleString('en-US')} trading days`));
  assert.ok(md.includes('Item 44'));
});
