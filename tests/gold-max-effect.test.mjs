// research/edge/gold-max-effect: the rule's pieces on hand-made candles, and RESULT.md against result.json (offline)
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { maxN, ranks, signals, atrAt, trade, run, monthSums, holm, toDays, TESTS, P } from '../research/edge/gold-max-effect/run.mjs';
import { FIN, nights } from '../council/fills.mjs';

const D = 86400, T0 = Date.UTC(2020, 0, 6) / 1000; // a Monday
function days(closes) { const ds = []; let t = T0, k = 0; while (ds.length < closes.length) { const w = new Date(t * 1000).getUTCDay(); if (w && w !== 6) { const c = closes[k++]; ds.push({ time: t, open: c, high: c + 5, low: c - 5, close: c }); } t += D; } return ds; }
const wave = (n) => Array.from({ length: n }, (_, i) => 1000 + (i % 2 ? 2 : 0)); // returns of +-0.2 %

test('MAX20 is the largest daily return of the last 20 days', () => {
  const c = wave(40); c[25] = c[24] * 1.03; for (let i = 26; i < 40; i++) c[i] = c[25] + (i % 2 ? 2 : 0);
  const m = maxN(days(c));
  assert.equal(m[19], null); assert.ok(Math.abs(m[25] - 0.03) < 1e-12); assert.ok(Math.abs(m[39] - 0.03) < 1e-12);
  assert.ok(m[24] < 0.003);
});

test('rank against the previous 250 values; a big day is HIGH, a quiet stretch after volatile ones is LOW', () => {
  const c = wave(300); c[280] = c[279] * 1.04; for (let i = 281; i < 300; i++) c[i] = c[280] + (i % 2 ? 2 : 0);
  const ds = days(c), rk = ranks(ds);
  assert.equal(rk[268], null); assert.ok(rk[270] != null);
  assert.equal(rk[280], 1); assert.ok(signals(ds, TESTS[0], rk).includes(280)); assert.ok(!signals(ds, TESTS[2], rk).includes(280));
  assert.ok(rk[279] < 0.8);
});

test('no look-ahead: a rank and its ATR do not change with later days', () => {
  const c = wave(300), ds = days(c), rk = ranks(ds), a = atrAt(ds, 290);
  const more = days([...c, 5000, 9000, 100]);
  const rk2 = ranks(more);
  assert.deepEqual(rk2.slice(0, 300), rk); assert.equal(atrAt(more, 290), a);
  assert.equal(atrAt(ds, P.atrN - 1), null);
});

test('entry at the next open, 1.5 x ATR stop, close exit, financing on buys only', () => {
  const ds = days(Array(30).fill(1000)), i = 29; // ATR 10 -> risk 15
  ds.push(...days(Array(33).fill(0)).slice(30).map((d, k) => ({ ...d, open: 1000 + k, high: 1004 + k, low: 996 + k, close: 1001 + k })));
  const tr = trade(ds, i, 1, 3);
  assert.equal(tr.entry, 1000); assert.equal(tr.stop, 985); assert.equal(tr.why, 'time'); assert.equal(tr.exit, 1003); assert.equal(tr.xi, i + 3);
  assert.ok(Math.abs(tr.R - 0.2) < 1e-12); assert.ok(Math.abs(tr.costR - 0.04) < 1e-12);
  const nn = nights(ds[i + 1].time, ds[i + 3].time + D); assert.equal(tr.nights, nn);
  assert.ok(Math.abs(tr.finR - nn * FIN.xau.long * 1000 / 15) < 1e-12);
  const s = trade(ds, i, -1, 3); assert.equal(s.finR, 0); assert.ok(Math.abs(s.R + 0.2) < 1e-12);
});

test('one position at a time; month sums count empty months; Holm; weekend folded; preregistered parameters', () => {
  const ds = days(Array(45).fill(1000));
  assert.deepEqual(run(ds, [29, 30, 31, 32, 33, 34], 5, () => 1).map((x) => x.ei), [30, 35]);
  assert.deepEqual(monthSums([{ d: '2024-01-05', net: 1 }, { d: '2024-03-02', net: -2 }], '2024-01-01', '2024-04-30'), [1, 0, -2, 0]);
  assert.deepEqual(holm([0.01, 0.04, 0.03]), [0.03, 0.06, 0.06]);
  const sat = Date.UTC(2024, 0, 6) / 1000;
  const dd = toDays([[sat - D, 1, 2, 0.5, 1.5, 1], [sat + D, 1.5, 3, 1.4, 1.6, 1], [sat + 2 * D, 1.6, 1.7, 1.2, 1.3, 1]]);
  assert.equal(dd.length, 2); assert.equal(dd[1].high, 3);
  assert.equal(P.isFrom, '2007-01-01'); assert.equal(P.oosFrom, '2017-01-01'); assert.equal(P.cost, 0.60); assert.equal(P.seeds, 40);
  assert.deepEqual([P.maxN, P.rankN, P.hi, P.lo], [20, 250, 0.8, 0.2]);
  assert.deepEqual(TESTS.map((t) => [t.when, t.side, t.hold]), [['hi', -1, 5], ['hi', -1, 10], ['lo', 1, 5]]);
});

test('RESULT.md agrees with result.json', () => {
  const r = JSON.parse(fs.readFileSync(new URL('../research/edge/gold-max-effect/result.json', import.meta.url), 'utf8'));
  const md = fs.readFileSync(new URL('../research/edge/gold-max-effect/RESULT.md', import.meta.url), 'utf8');
  const vl = md.split('\n').find((l) => l.startsWith('**Verdict:'));
  assert.ok(vl.startsWith(`**Verdict: ${r.verdict}:`)); assert.ok(vl.length < 220);
  const f = (v) => (v > 0 ? '+' : v < 0 ? '-' : '') + Math.abs(v).toFixed(3);
  for (const id of ['T1', 'T2', 'T3']) {
    const g = r.gold.tests[id], c = r.gold.checks[id], row = md.split('\n').find((l) => l.startsWith(`| ${id} `));
    const cells = row.split('|').map((s) => s.trim()).filter(Boolean);
    assert.deepEqual(cells.slice(1), [String(g.is.n), f(g.isGross.mean), f(g.is.mean), g.is.monthT.toFixed(2), String(g.oos.n), f(g.oosGross.mean), f(g.oos.mean), g.oos.monthT.toFixed(2), String(c.holmP), f(g.oos2x.mean), f(g.vsBaseline.diff), g.vsBaseline.welchT.toFixed(2), `${g.placebo.beaten} of 40`, c.pass ? 'yes' : 'no']);
  }
  assert.equal(r.verdict, r.gold.passed.length ? 'PASS' : 'FAIL');
  assert.ok(md.includes(`${r.gold.data.days.toLocaleString('en-US')} trading days`));
  assert.ok(md.includes('Item 44'));
});
