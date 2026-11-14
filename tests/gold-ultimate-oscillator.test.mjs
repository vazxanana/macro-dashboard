// research/edge/gold-ultimate-oscillator: the Ultimate Oscillator, its signals, the trade, costs and the report (offline)
import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { uo, signals, atr, tradeAt, rOf, holm, baseline, monthT, P } from '../research/edge/gold-ultimate-oscillator/run.mjs';

const dir = new URL('../research/edge/gold-ultimate-oscillator/', import.meta.url);
const R = JSON.parse(fs.readFileSync(new URL('result.json', dir), 'utf8'));
const md = fs.readFileSync(new URL('RESULT.md', dir), 'utf8');
const day = (i) => Date.UTC(2010, 0, 4) / 1000 + i * 86400;
const mk = (closes) => closes.map((c, i) => ({ time: day(i), open: c, high: c + 1, low: c - 1, close: c }));

test('UO: defined from bar 28; closes at the high read 100, at the low read 0; hand value', () => {
  const up = Array.from({ length: 40 }, (_, i) => ({ time: day(i), open: 100 + i, high: 101 + i, low: 99 + i, close: 101 + i }));
  const u = uo(up);
  assert.equal(u[27], null); assert.ok(u[28] != null);
  // BP = close - min(low, prev close) = 101+i - (99+i) = 2; TR = max(high, prev close) - min(low, prev close) = 2 -> 100
  assert.ok(Math.abs(u[39] - 100) < 1e-9);
  const dn = Array.from({ length: 40 }, (_, i) => ({ time: day(i), open: 200 - i, high: 201 - i, low: 199 - i, close: 199 - i }));
  assert.ok(Math.abs(uo(dn)[39]) < 1e-9);
  // flat bars closing mid-range: BP 1, TR 2 -> 50
  assert.ok(Math.abs(uo(mk(Array.from({ length: 40 }, () => 100)))[35] - 50) < 1e-9);
});

test('signals: a close INTO < 35 is long, INTO > 65 is short, staying inside is not a new signal', () => {
  const b = [];
  for (let i = 0; i < 40; i++) b.push({ time: day(i), open: 100, high: 101, low: 99, close: 100 });        // UO 50
  for (let i = 40; i < 60; i++) b.push({ time: day(i), open: 100, high: 101, low: 99, close: 99.05 });     // falls
  for (let i = 60; i < 90; i++) b.push({ time: day(i), open: 100, high: 101, low: 99, close: 100.95 });    // rises
  const s = signals(b), u = uo(b);
  const longs = s.map((x, i) => (x === 1 ? i : -1)).filter((i) => i >= 0), shorts = s.map((x, i) => (x === -1 ? i : -1)).filter((i) => i >= 0);
  assert.equal(longs.length, 1); assert.equal(shorts.length, 1);
  assert.ok(u[longs[0]] < 35 && u[longs[0] - 1] >= 35);
  assert.ok(u[shorts[0]] > 65 && u[shorts[0] - 1] <= 65);
});

test('no look-ahead: changing every bar after day k leaves UO and signals up to k unchanged', () => {
  const c = Array.from({ length: 150 }, (_, i) => 100 + Math.sin(i / 5) * 8 + i * 0.05);
  const k = 100, b1 = mk(c), b2 = mk(c.map((x, i) => (i > k ? x * 3 : x)));
  assert.deepEqual(uo(b1).slice(0, k + 1), uo(b2).slice(0, k + 1));
  assert.deepEqual(signals(b1).slice(0, k + 1), signals(b2).slice(0, k + 1));
  assert.deepEqual(atr(b1).slice(0, k + 1), atr(b2).slice(0, k + 1));
});

test('trade: next open entry, stop 2 x ATR on the losing side, out five days later, a gap fills at the open', () => {
  const bars = mk(Array.from({ length: 40 }, () => 100)), A = atr(bars);
  const t = tradeAt(bars, A, 20, 1);
  assert.equal(t.entryI, 21); assert.equal(t.exitI, 26); assert.equal(t.why, 'time'); assert.equal(t.exit, bars[26].open);
  assert.equal(t.dist, 2 * A[20]); assert.ok(t.stop < t.entry);
  const s = tradeAt(bars, A, 20, -1); assert.ok(s.stop > s.entry);
  const b2 = mk(Array.from({ length: 40 }, () => 100)); b2[23] = { ...b2[23], open: 90, low: 89, high: 91, close: 90 };
  const g = tradeAt(b2, atr(b2), 20, 1); assert.equal(g.why, 'stop'); assert.equal(g.exit, 90); assert.equal(g.exitI, 23);
  assert.equal(tradeAt(bars, A, 34, 1), null);   // fewer than six candles after the signal
});

test('costs: $0.60 a round trip and financing on buys only, doubled at 2x; Holm; baseline averages every day', () => {
  const t = { side: 1, entry: 2000, exit: 2040, dist: 20, entryT: Date.UTC(2020, 0, 6) / 1000, exitT: Date.UTC(2020, 0, 13) / 1000 };
  const r = rOf(t), r2 = rOf(t, 2);
  assert.equal(r.gross, 2); assert.equal(r.cost, 0.03); assert.equal(r.nights, 7);
  assert.ok(Math.abs(r.fin - 7 * 0.000148 * 2000 / 20) < 1e-12);
  assert.ok(Math.abs(r2.fin - 2 * r.fin) < 1e-12 && Math.abs(r2.cost - 0.06) < 1e-12);
  assert.equal(rOf({ ...t, side: -1 }).fin, 0);
  assert.deepEqual(holm([0.01, 0.04, 0.03]), [0.03, 0.06, 0.06]);
  const bars = mk(Array.from({ length: 60 }, () => 100)), A = atr(bars);
  const b = baseline(bars, A, day(20), day(40), -1, P);
  assert.equal(b.n, 20); assert.ok(Math.abs(b.gross) < 1e-12 && b.net < 0);
  const m = monthT([{ exitT: Date.UTC(2020, 0, 5) / 1000, ex: 1 }, { exitT: Date.UTC(2020, 1, 5) / 1000, ex: 1 }], Date.UTC(2020, 0, 1) / 1000, Date.UTC(2020, 3, 1) / 1000);
  assert.equal(m.months, 3);
});

test('the report matches result.json', () => {
  assert.equal(R.verdict, 'FAIL'); assert.equal(R.pass, false);
  const v = md.match(/\*\*Verdict:[^*]*\*\*/)[0];
  assert.match(v, /^\*\*Verdict: FAIL, 0 of 3: /);
  assert.ok(v.length < 220, `verdict line ${v.length} chars`);
  const f = (x) => (x >= 0 ? '+' : '-') + Math.abs(x).toFixed(3);
  for (const id of ['T1', 'T2', 'T3']) {
    const x = R.tests[id];
    assert.equal(x.pass, false);
    for (const w of ['IS', 'OOS']) {
      assert.ok(md.includes(`| ${x[w].n} |`), `${id} ${w} n`);
      for (const k of ['gross', 'net', 'net2', 'excess', 'excess2']) assert.ok(md.includes(f(x[w][k])), `${id} ${w} ${k}`);
      assert.ok(md.includes(` ${x[w].t.toFixed(2)} |`), `${id} ${w} t`);
      assert.ok(md.includes(` ${x[w].tNet.toFixed(2)} |`), `${id} ${w} tNet`);
    }
    assert.ok(md.includes(`(${x.placebo.beaten})`), `${id} placebo`);
    assert.equal(x.placebo.seeds.length, 40);
  }
  for (const k of ['OOS1', 'OOS-1', 'IS1', 'IS-1']) assert.ok(md.includes(f(R.baseline[k].net)), `baseline ${k}`);
});
