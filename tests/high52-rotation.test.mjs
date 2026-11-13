// research/edge/high52-rotation: the rule's pieces on hand-made candles (offline), and RESULT.md == result.json.
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import * as S from '../research/edge/high52-rotation/run.mjs';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const DIR = path.join(HERE, '../research/edge/high52-rotation');
const DAY = 86400, T0 = Date.UTC(2005, 0, 3) / 1000;

// weekday candles from a close path (open = previous close, range ±0.2 %)
function candles(closes, start = T0) {
  const out = []; let t = start, prev = closes[0];
  for (const c of closes) {
    while ([0, 6].includes(new Date(t * 1000).getUTCDay())) t += DAY;
    out.push({ time: t, open: prev, high: Math.max(prev, c) * 1.002, low: Math.min(prev, c) * 0.998, close: c });
    prev = c; t += DAY;
  }
  return out;
}
const path_ = (n, g, wob = 0.004, ph = 0) => Array.from({ length: n }, (_, i) => 100 * Math.exp(g * i) * (1 + wob * Math.sin(i * 1.7 + ph)));

test('score = close / 252-day closing high, read at the decision candle only (changing later prices changes nothing)', () => {
  const D = candles(path_(600, 0.0004));
  const ends = S.monthEnds(D), k = '2006-06', a = S.decide(D, ends, k);
  assert.ok(a && a.score > 0 && a.score <= 1);
  let hi = 0; for (let j = a.i - 251; j <= a.i; j++) hi = Math.max(hi, D[j].close);
  assert.equal(a.score, D[a.i].close / hi);
  const F = D.map((b, j) => (j > a.i ? { ...b, open: b.open * 3, high: b.high * 3, low: b.low * 3, close: b.close * 3 } : b));
  assert.deepEqual(S.decide(F, S.monthEnds(F), k), a, 'no look-ahead');
  assert.equal(S.decide(D, ends, '2005-06'), null, 'fewer than 252 closes: not eligible');
});

test('pick: the 3 highest scores (ties by key), inverse-volatility weights sum to 1; benchmark equal weight', () => {
  const dec = { a: { score: 0.9, vol: 0.01 }, b: { score: 1, vol: 0.02 }, c: { score: 0.95, vol: 0.01 }, d: { score: 0.95, vol: 0.04 }, e: null };
  assert.deepEqual(S.pickTop(dec), ['b', 'c', 'd']);
  const w = S.rotation(dec), s = 1 / 0.02 + 1 / 0.01 + 1 / 0.04;
  assert.ok(Math.abs(w.c - 100 / s) < 1e-12 && Math.abs(w.b + w.c + w.d - 1) < 1e-12);
  assert.deepEqual(S.benchEqual(dec), { a: 0.25, b: 0.25, c: 0.25, d: 0.25 });
  assert.deepEqual(S.pickTop({ a: dec.a, b: dec.b }), [], 'fewer than 3 eligible: no position');
});

test('rebalance timing: month m decides, the position runs from the first open of m+1 to its last close', () => {
  const D = candles(path_(700, 0.0005));
  const prep = S.prepare({ spx500: D });
  const seen = [];
  const sim = S.simulate(prep, (dec) => {
    const m = dec.spx500 ? S.ym(D[dec.spx500.i].time) : null; seen.push(m);
    return m === '2007-02' ? { spx500: 1 } : {};
  }, { costX: 0, finX: 0, noStop: true });
  const e = prep.ends.spx500, a = prep.starts.spx500.get('2007-03');
  // daily simple returns summed (constant equity of 1), starting from that month's first open
  let want = 0, prev = D[a].open;
  for (let j = a; j <= e.get('2007-03'); j++) { want += D[j].close / prev - 1; prev = D[j].close; }
  assert.ok(Math.abs(sim.monthly['2007-03'] - want) < 1e-12);
  assert.ok(!sim.monthly['2007-02'] && !sim.monthly['2007-04']);
  assert.ok(seen.includes('2007-02'));
});

test('catastrophe stop: a touch exits at the stop, a gap at the open, then flat for the month', () => {
  const bars = [
    { time: T0, open: 100, high: 101, low: 99.5, close: 100.5 },
    { time: T0 + DAY, open: 100.5, high: 101, low: 96, close: 97 },
    { time: T0 + 2 * DAY, open: 90, high: 91, low: 89, close: 90 },
  ];
  const r = S.holdMonth('spx500', bars, 100, 0, 1, 97, { costX: 0, finX: 0 });
  assert.ok(Math.abs(r.rows[1].ret - (97 / 100.5 - 1)) < 1e-12);
  assert.equal(r.rows[2].ret, 0); assert.equal(r.wEnd, 0); assert.equal(r.stopped, true);
  const g = S.holdMonth('spx500', [{ time: T0, open: 95, high: 96, low: 94, close: 95 }], 100, 1, 1, 97, { costX: 0, finX: 0 });
  assert.ok(Math.abs(g.rows[0].ret - (95 / 100 - 1)) < 1e-12, 'gap through the stop: the open');
});

test('costs: half the round trip on each weight change and stop exit; financing = (cash rate + 2.5 %) / 365 a night', () => {
  const bars = [{ time: Date.UTC(2024, 0, 2) / 1000, open: 100, high: 101, low: 99, close: 100 }];   // a Tuesday: one night
  const r = S.holdMonth('hk33', bars, 100, 0.2, 0.5, null);
  assert.ok(Math.abs(r.rows[0].cost - 0.3 * 0.0005 / 2) < 1e-15);
  assert.ok(Math.abs(r.rows[0].fin - 0.5 * (5.0 + 2.5) / 100 / 365) < 1e-15);
  assert.equal(S.cashRate('EUR', 2016), 0);
  assert.equal(S.cashRate('USD', 2030), S.cashRate('USD', 2026));
  const x2 = S.holdMonth('hk33', bars, 100, 0.2, 0.5, null, { costX: 2, finX: 2 });
  assert.ok(Math.abs(x2.rows[0].cost - 2 * r.rows[0].cost) < 1e-15 && Math.abs(x2.rows[0].fin - 2 * r.rows[0].fin) < 1e-15);
});

test('Newey-West t with no autocorrelation is close to the plain t; placebo is seeded', () => {
  const r = S.mulberry32(3), xs = Array.from({ length: 400 }, () => (r() - 0.5) * 0.06 + 0.003);
  const s = S.stats(xs);
  assert.ok(Math.abs(s.nwT - s.t) / Math.abs(s.t) < 0.3);
  const dec = Object.fromEntries('abcdefg'.split('').map((k, i) => [k, { score: 1, vol: 0.01 + i / 1000 }]));
  assert.deepEqual(S.placebo(7)(dec), S.placebo(7)(dec));
});

test('RESULT.md is the report of result.json, and the verdict follows the pre-registered bar', () => {
  const R = JSON.parse(fs.readFileSync(path.join(DIR, 'result.json'), 'utf8'));
  assert.equal(fs.readFileSync(path.join(DIR, 'RESULT.md'), 'utf8'), S.report(R));
  assert.deepEqual(R.verdict, S.verdictOf(R.replication, R.decisive, R.placebo.q95DecMeanPct));
  assert.equal(R.placebo.rows.length, 40);
  assert.equal(R.decisive.months.slice(0, 7), '2016-01');
  assert.ok(fs.existsSync(path.join(DIR, 'PREREGISTRATION.md')));
});
