// research/edge/gold-wide-day-half: the rule's pieces on hand-made candles, and RESULT.md against result.json (offline)
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { wideSide, signals, fillOf, tradeAt, run, atrAt, monthSums, holm, withExcess, row, verdictLine, toDays, TESTS, P } from '../research/edge/gold-wide-day-half/run.mjs';
import { FIN, nights } from '../council/fills.mjs';

const D = 86400, T0 = Date.UTC(2024, 0, 1) / 1000; // a Monday
function flat(n) { const ds = []; let t = T0; while (ds.length < n) { const w = new Date(t * 1000).getUTCDay(); if (w && w !== 6) ds.push({ time: t, open: 1000, high: 1005, low: 995, close: 1000 }); t += D; } return ds; }
const next = (ds) => { let t = ds.at(-1).time + D; while ([0, 6].includes(new Date(t * 1000).getUTCDay())) t += D; return t; };
const add = (ds, o, h, l, c) => { ds.push({ time: next(ds), open: o, high: h, low: l, close: c }); return ds.length - 1; };

test('a wide day: range >= 1.25 x ATR of the days before, close in the outer third', () => {
  const ds = flat(20); // ATR 10
  const up = add(ds, 1000, 1013, 1000, 1011);   // range 13, close loc 0.85
  const mid = add(ds, 1000, 1013, 1000, 1006);  // close in the middle third
  const dn = add(ds, 1000, 1000, 985, 987);     // range 15, close low
  assert.equal(wideSide(ds, up), 1); assert.equal(wideSide(ds, mid), 0); assert.equal(wideSide(ds, dn), -1);
  const narrow = flat(20); const k = add(narrow, 1000, 1012, 1000, 1011); // 12 < 12.5
  assert.equal(wideSide(narrow, k), 0);
  assert.deepEqual(signals(ds, [1]).map((x) => x.i), [up]); assert.deepEqual(signals(ds, [1, -1]).map((x) => x.side), [1, -1]);
});

test('no look-ahead: the signal and its ATR do not change with later days', () => {
  const ds = flat(20); const i = add(ds, 1000, 1013, 1000, 1011);
  const a = atrAt(ds, i), s = wideSide(ds, i);
  add(ds, 1011, 5000, 1, 4000); add(ds, 4000, 4001, 3999, 4000);
  assert.equal(atrAt(ds, i), a); assert.equal(wideSide(ds, i), s);
  assert.equal(atrAt(ds, P.atrN - 1), null);
});

test('the midpoint limit fills within three days, at the open when it opens through', () => {
  const ds = flat(20); const i = add(ds, 1000, 1020, 1000, 1018); // mid 1010
  add(ds, 1018, 1022, 1012, 1015); const j = add(ds, 1015, 1016, 1008, 1012);
  assert.deepEqual(fillOf(ds, i, 1), { j, px: 1010 });
  const g = flat(20); const k = add(g, 1000, 1020, 1000, 1018); const gj = add(g, 1005, 1009, 1001, 1004);
  assert.deepEqual(fillOf(g, k, 1), { j: gj, px: 1005 });
  const n = flat(20); const m = add(n, 1000, 1020, 1000, 1018); add(n, 1018, 1025, 1012, 1020); add(n, 1020, 1030, 1015, 1028); add(n, 1028, 1035, 1011, 1030); add(n, 1030, 1031, 1000, 1001);
  assert.equal(fillOf(n, m, 1), null); // the 4th day reaches it: too late
});

test('trade: 1.5 x ATR stop from the fill, 5 days held, same-day stop counts, financing on buys only', () => {
  const ds = flat(30), i = 29; // ATR 10 -> risk 15
  for (let k = 0; k < 5; k++) add(ds, 1000, 1004, 996, 1000 + k);
  const tr = tradeAt(ds, i, i + 1, 1000, 1);
  assert.equal(tr.stop, 985); assert.equal(tr.why, 'time'); assert.equal(tr.xi, i + 5); assert.equal(tr.exit, 1004);
  assert.ok(Math.abs(tr.R - 4 / 15) < 1e-12); assert.ok(Math.abs(tr.costR - 0.04) < 1e-12);
  const nn = nights(ds[i + 1].time + D / 2, ds[i + 5].time + D); assert.equal(tr.nights, nn);
  assert.ok(Math.abs(tr.finR - nn * FIN.xau.long * 1000 / 15) < 1e-12);
  assert.equal(tradeAt(ds, i, i + 1, 1000, -1).finR, 0);
  const s = flat(30); add(s, 1000, 1004, 980, 990); for (let k = 0; k < 4; k++) add(s, 990, 995, 985, 990);
  const ts = tradeAt(s, 29, 30, 1000, 1); assert.equal(ts.why, 'stop'); assert.equal(ts.xi, 30); assert.equal(ts.exit, 985);
});

test('one limit or position at a time; month sums; Holm; same-year excess; weekend folded; preregistered parameters', () => {
  const ds = flat(20); const i = add(ds, 1000, 1020, 1000, 1018); const i2 = add(ds, 1018, 1045, 1012, 1043);
  for (let k = 0; k < 6; k++) add(ds, 1012, 1016, 1008, 1012);
  const T = run(ds, signals(ds, [1]));
  assert.equal(T.length, 1); assert.equal(T[0].si, i); assert.equal(T[0].ei, i2 + 1); // the second wide day comes while the first limit waits: skipped
  assert.deepEqual(monthSums([{ d: '2024-01-05', net: 1 }, { d: '2024-03-02', net: -2 }], '2024-01-01', '2024-04-30'), [1, 0, -2, 0]);
  assert.deepEqual(holm([0.01, 0.04, 0.03]), [0.03, 0.06, 0.06]);
  assert.deepEqual(withExcess([{ d: '2020-02-01', side: 1, net: 0.5 }], { 1: { 2020: 0.2 }, '-1': {} }).map((x) => +x.ex.toFixed(9)), [0.3]);
  const sat = Date.UTC(2024, 0, 6) / 1000;
  const days = toDays([[sat - D, 1, 2, 0.5, 1.5, 1], [sat + D, 1.5, 3, 1.4, 1.6, 1], [sat + 2 * D, 1.6, 1.7, 1.2, 1.3, 1]]);
  assert.equal(days.length, 2); assert.equal(days[1].high, 3);
  assert.equal(P.isFrom, '2007-01-01'); assert.equal(P.oosFrom, '2017-01-01'); assert.equal(P.cost, 0.60); assert.equal(P.seeds, 40);
  assert.equal(P.wide, 1.25); assert.equal(P.wait, 3); assert.equal(P.hold, 5); assert.equal(P.stopAtr, 1.5);
  assert.deepEqual(TESTS.map((t) => t.sides), [[1], [-1], [1, -1]]);
});

test('RESULT.md agrees with result.json', () => {
  const r = JSON.parse(fs.readFileSync(new URL('../research/edge/gold-wide-day-half/result.json', import.meta.url), 'utf8'));
  const md = fs.readFileSync(new URL('../research/edge/gold-wide-day-half/RESULT.md', import.meta.url), 'utf8');
  const vl = md.split('\n').find((l) => l.startsWith('**Verdict:'));
  assert.equal(vl, verdictLine(r)); assert.ok(vl.startsWith(`**Verdict: ${r.verdict}:`)); assert.ok(vl.length < 220);
  for (const id of ['T1', 'T2', 'T3']) assert.ok(md.includes(row(id, r.gold.tests[id], r.gold.checks[id])));
  assert.equal(r.verdict, r.gold.passed.length ? 'PASS' : 'FAIL');
  for (const id of ['T1', 'T2', 'T3']) assert.equal(r.gold.tests[id].placebo.draws.length, 40);
  assert.ok(md.includes(`${r.gold.data.days.toLocaleString('en-US')} trading days`));
  assert.ok(md.includes('Item 44'));
});
