// mosha-retrace-m15-oos: costs, month-sum t, Holm, placebo determinism, no look-ahead of the imported rule, report vs result.json
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { costed, monthT, monthsOf, holm, pOne, mulberry32, placeboRows, W } from '../research/edge/mosha-retrace-m15-oos/run.mjs';
import { run as chain } from '../research/edge/mosha-retrace/run.mjs';
import { aggregate } from '../research/edge/gold-systems/data.mjs';

const DIR = new URL('../research/edge/mosha-retrace-m15-oos/', import.meta.url);
const R = JSON.parse(fs.readFileSync(new URL('result.json', DIR), 'utf8'));
const MD = fs.readFileSync(new URL('RESULT.md', DIR), 'utf8');

test('costs: $0.30 / $0.60 per r0, financing on buys only, 2x doubles both', () => {
  const t0 = Date.UTC(2010, 0, 4, 12) / 1000, t1 = t0 + 2 * 86400;   // Monday noon -> Wednesday noon: Mon + Tue rollovers = 2 nights
  const b = costed({ side: 1, R: 1, r0: 2, entry: 1000, filled: t0, closed: t1 }), fin = 2 * 0.000148 * 1000 / 2;
  assert.ok(Math.abs(b.fin - fin) < 1e-12);
  assert.ok(Math.abs(b.net3 - (1 - 0.15 - fin)) < 1e-12 && Math.abs(b.net6 - (1 - 0.3 - fin)) < 1e-12 && Math.abs(b.net2x - (1 - 0.6 - 2 * fin)) < 1e-12);
  const s = costed({ side: -1, R: 1, r0: 2, entry: 1000, filled: t0, closed: t1 });
  assert.equal(s.fin, 0); assert.ok(Math.abs(s.net6 - 0.7) < 1e-12);
});

test('month-sum t counts empty months as zero; Holm; one-sided p', () => {
  const from = Date.UTC(2010, 0, 1) / 1000, to = Date.UTC(2010, 3, 1) / 1000;
  assert.deepEqual(monthsOf(from, to), ['2010-01', '2010-02', '2010-03']);
  const rows = [{ placed: from + 86400, x: 1 }, { placed: from + 40 * 86400, x: 2 }];   // Jan 1, Feb 2, Mar 0
  const { months, t } = monthT(rows, 'x', from, to);
  assert.equal(months, 3); assert.ok(Math.abs(t - 1 / (1 / Math.sqrt(3))) < 1e-9);   // mean 1, sd 1
  assert.deepEqual(holm([0.01, 0.04, 0.03]).map((x) => +x.toFixed(4)), [0.03, 0.06, 0.06]);
  assert.ok(Math.abs(pOne(1.96) - 0.025) < 1e-3);
  assert.equal(W.DEC_TO, W.REP_FROM); assert.equal(monthsOf(W.DEC_FROM, W.DEC_TO).length, 138);
});

// a deterministic random-walk gold path of 5-minute candles
function path(days, seed) {
  const rnd = mulberry32(seed), out = []; let px = 1000, t = Date.UTC(2010, 0, 4) / 1000;
  for (let i = 0; i < days * 288; i++, t += 300) {
    const o = px, c = o + (rnd() - 0.5) * 1.6 + Math.sin(i / 900) * 0.25, h = Math.max(o, c) + rnd() * 0.5, l = Math.min(o, c) - rnd() * 0.5;
    out.push({ time: t, open: o, high: h, low: l, close: c }); px = c;
  }
  return out;
}
const toC = (M5) => { const m = { n: M5.length, T: M5.map((b) => b.time), O: M5.map((b) => b.open), H: M5.map((b) => b.high), L: M5.map((b) => b.low), C: M5.map((b) => b.close) };
  return { M5, M15: aggregate(m, 900), H1: aggregate(m, 3600), H4: aggregate(m, 14400), F: M5 }; };

test('the imported M15 rule places orders and never reads candles after placement', () => {
  const M5 = path(120, 7), { orders } = chain(toC(M5), 'M15');
  assert.ok(orders.length >= 3, `orders ${orders.length}`);
  for (const o of orders) { assert.ok(o.side < 0 ? o.stop > o.entry : o.stop < o.entry, 'stop on the losing side'); assert.ok(Math.abs(o.target - o.entry) >= 2 * o.r0 - 1e-9); }
  const cut = orders[Math.floor(orders.length / 2)].placed;
  const M5b = M5.map((b) => (b.time + 300 > cut ? { time: b.time, open: b.open * 1.3, high: b.high * 1.3, low: b.low * 1.3, close: b.close * 1.3 } : b));
  const b = chain(toC(M5b), 'M15').orders, key = (o) => [o.placed, o.side, o.entry, o.stop, o.target].join('|');
  assert.deepEqual(b.filter((o) => o.placed <= cut).map(key), orders.filter((o) => o.placed <= cut).map(key));
});

test('placebo is seeded: same side, r0 and target distance; same seed same rows', () => {
  const M5 = path(40, 3), idx = new Map(); M5.forEach((b, i) => { const k = new Date(b.time * 1000).toISOString().slice(0, 7), e = idx.get(k); if (!e) idx.set(k, [i, i + 1]); else e[1] = i + 1; });
  const rows = [{ placed: M5[500].time, side: -1, r0: 3, entry: 1000, target: 991 }, { placed: M5[3000].time, side: 1, r0: 2, entry: 1000, target: 1005 }];
  const a = placeboRows(rows, M5, idx, mulberry32(5)), b = placeboRows(rows, M5, idx, mulberry32(5));
  assert.deepEqual(a, b); assert.ok(a.length >= 1);
  for (const x of a) assert.ok(Number.isFinite(x.net6));
});

test('report agrees with result.json; verdict follows the pre-registered bar', () => {
  assert.equal(R.topic, 'mosha-retrace-m15-oos');
  for (const k of ['T1', 'T2', 'T3']) {
    const T = R.tests[k], pass = T.decisive.t_net6 >= 2 && T.pHolm < 0.05 && T.decisive.net2x > 0 && T.placebo.beaten >= 38;
    assert.equal(T.pass, pass); assert.equal(T.placebo.t.length, 40);
    const row = MD.split('\n').find((l) => l.startsWith(`| ${k}`) && l.includes('decisive'));
    assert.ok(row.includes(`| ${T.decisive.n} |`), `${k} n`);
    assert.ok(row.includes(`(${T.decisive.t_net6.toFixed(2).replace('-', '−')})`), `${k} t`);
    assert.ok(row.includes(`${T.placebo.beaten} of 40`), `${k} placebo`);
  }
  assert.equal(R.verdict, R.tests.T1.pass ? 'PASS' : 'FAIL');
  const v = MD.match(/\*\*Verdict: ([^*]+)\*\*/)[1];
  assert.ok(v.startsWith(R.verdict) && v.length < 220);
  assert.ok(v.includes(`n ${R.tests.T1.decisive.n}`));
});
