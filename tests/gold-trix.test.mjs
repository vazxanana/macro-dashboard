// gold-trix: the rule on hand-made candles, no look-ahead, and the report against result.json (offline).
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { ema, trix, cross, enrich, simulate, runRule, runBase, holm, monthT, WIN, RT, WARM, HOLD } from '../research/edge/gold-trix/run.mjs';

const dir = new URL('../research/edge/gold-trix/', import.meta.url);
const D = 86400, T0 = Date.UTC(2020, 0, 6) / 1000;
const bar = (c) => ({ open: c, high: c + 2, low: c - 2, close: c });
// 70 days falling slowly, then rising: the TRIX turns up and crosses its signal line after the low
function mk(closes) { return enrich(closes.map((c, k) => ({ t: T0 + k * D, ...bar(c) }))); }
const path = [...Array.from({ length: 70 }, (_, k) => 200 - k), ...Array.from({ length: 30 }, (_, k) => 131 + 3 * k)];

test('ema and trix: seeded with the first value, TRIX of a constant series is 0', () => {
  assert.deepEqual(ema([1, 1, 1], 9), [1, 1, 1]);
  const e = ema([0, 10], 9); assert.ok(Math.abs(e[1] - 2) < 1e-12);
  const t = trix(Array(30).fill(50)); assert.ok(t.tr.every((v) => v === 0) && t.sig.every((v) => v === 0));
});

test('setup: a bull cross after a turn up, a bear cross after a turn down, none in warm-up', () => {
  const ds = mk(path);
  const ups = ds.map((_, i) => cross(ds, i)).map((s, i) => [s, i]).filter(([s]) => s === 1).map(([, i]) => i);
  assert.equal(ups.length, 1); assert.ok(ups[0] > 70);
  const down = mk([...Array(70).fill(150), ...Array.from({ length: 30 }, (_, k) => 147 - 3 * k)]);
  assert.ok(down.some((_, i) => cross(down, i) === -1));
  for (let i = 0; i < WARM; i++) assert.equal(cross(ds, i), 0);
});

test('trade: market at the next open, stop 2 x ATR, out at the fifth close; entry-day stop counts as stopped', () => {
  const ds = mk(path); const i = 80, tr = simulate(ds, i, 1);
  assert.equal(tr.entry, ds[i + 1].open);
  assert.ok(Math.abs(tr.risk - 2 * ds[i].atr) < 1e-9 && Math.abs(tr.entry - tr.stop - tr.risk) < 1e-9);
  assert.equal(tr.how, 'time'); assert.equal(tr.exitDay, i + HOLD); assert.equal(tr.exit, ds[i + HOLD].close);
  assert.ok(Math.abs(tr.cost - RT / tr.risk) < 1e-12 && tr.fin > 0 && tr.net < tr.gross);
  const s = simulate(ds, i, -1); assert.equal(s.fin, 0); assert.ok(s.gross < 0);
  const dd = ds.map((x) => ({ ...x })); dd[i + 1] = { ...dd[i + 1], low: dd[i + 1].open - 100 };
  const st = simulate(dd, i, 1); assert.equal(st.how, 'stop1'); assert.ok(Math.abs(st.gross + 1) < 1e-9);
});

test('no look-ahead: later candles never change a setup or a closed trade', () => {
  const a = mk(path), b = mk([...path.slice(0, 90), 5, 500, 5, 500, 5, 500, 5, 500, 5, 500]);
  for (let i = 0; i < 90; i++) assert.equal(cross(a, i), cross(b, i));
  assert.deepEqual(simulate(a, 80, 1), simulate(b, 80, 1));
});

test('rule is one position at a time; baseline takes every day', () => {
  const ds = mk([...path, ...Array.from({ length: 60 }, (_, k) => 220 + 15 * Math.sin(k / 3))]);
  const R = runRule(ds, 1);
  for (let k = 1; k < R.length; k++) assert.ok(R[k].i >= R[k - 1].exitDay);
  assert.ok(runBase(ds, 1).length > R.length);
});

test('helpers: Holm and month-sum t', () => {
  assert.deepEqual(holm([0.01, 0.04, 0.03]), [0.03, 0.06, 0.06]);
  const T = [{ exitT: Date.UTC(2017, 0, 10) / 1000, net: 1 }, { exitT: Date.UTC(2017, 1, 10) / 1000, net: 2 }];
  assert.equal(monthT(T, ['2017-01-01', '2017-03-31'], 'net').months, 3);
});

test('the report agrees with result.json', () => {
  const r = JSON.parse(fs.readFileSync(new URL('result.json', dir), 'utf8'));
  const md = fs.readFileSync(new URL('RESULT.md', dir), 'utf8');
  assert.deepEqual(r.windows, WIN);
  assert.equal(r.verdict, 'FAIL');
  const line = md.split('\n').find((l) => l.startsWith('**Verdict:'));
  assert.ok(line && line.length < 230 && line.includes('FAIL'));
  const t1 = r.tests.T1;
  assert.ok(line.includes(t1.oos.mean.toFixed(3)) && line.includes(`n ${t1.oos.n}`) && line.includes(t1.oos.t.toFixed(2)) && line.includes(t1.is.mean.toFixed(3)));
  for (const k of ['T1', 'T2', 'T3']) { const x = r.tests[k];
    assert.equal(x.pass, false);
    assert.ok(md.includes(` ${x.oos.n} |`) && md.includes(x.oos.mean.toFixed(3)) && md.includes(`${x.placebo.beaten} of 40`), k); }
  for (const [k, b] of Object.entries(r.baseline)) assert.ok(md.includes(b.net.toFixed(3).replace(/^0/, '+0')), k);
});
