// research/edge/tsmom-portfolio: the rule's pieces on hand-made candles (offline), and RESULT.md == result.json.
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import * as S from '../research/edge/tsmom-portfolio/run.mjs';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const DIR = path.join(HERE, '../research/edge/tsmom-portfolio');
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
const trend = (n, g, wob = 0.004) => Array.from({ length: n }, (_, i) => 100 * Math.exp(g * i) * (1 + wob * Math.sin(i * 1.7)));

test('signal = sign of the 12-month return, read at the month-end close', () => {
  const up = candles(trend(700, 0.0005)), dn = candles(trend(700, -0.0005));
  const k = '2007-06';
  const a = S.decide(up, S.monthEnds(up), k), b = S.decide(dn, S.monthEnds(dn), k);
  assert.equal(a.s, 1); assert.equal(b.s, -1);
  assert.ok(a.ret > 0 && b.ret < 0);
  assert.equal(new Date(up[a.i].time * 1000).toISOString().slice(0, 7), k);
  assert.equal(S.decide(up, S.monthEnds(up), '2005-06'), null, 'no 12-month history and too few returns');
});

test('EWMA volatility: constant ±1 % returns give about 1 % x sqrt(261); needs 260 returns', () => {
  const c = [100]; for (let i = 1; i < 400; i++) c.push(c[i - 1] * (i % 2 ? 1.01 : 0.99));
  const D = candles(c);
  assert.equal(S.ewmaVol(D, 200), null);
  const v = S.ewmaVol(D, 399);
  assert.ok(Math.abs(v - 0.01 * Math.sqrt(261)) < 0.01, `vol ${v}`);
});

test('weights: 40 % volatility a market, equal weight over N, per-market cap 10, gross cap 3', () => {
  const w = S.weights({ a: { s: 1, sigma: 0.2 }, b: { s: -1, sigma: 0.1 }, c: null });
  assert.ok(Math.abs(w.a - 2 / 2) < 1e-12 && Math.abs(w.b + 4 / 2) < 1e-12, JSON.stringify(w));   // N = 2: 2/2 and -4/2 → gross 3 exactly
  const capped = S.weights({ a: { s: 1, sigma: 0.01 } });                                           // 40x → per-market 10 → gross cap 3
  assert.ok(Math.abs(capped.a - 3) < 1e-12);
  const g = S.weights({ a: { s: 1, sigma: 0.05 }, b: { s: 1, sigma: 0.05 } });                     // 8/2 each = 8 gross → scaled to 3
  assert.ok(Math.abs(Math.abs(g.a) + Math.abs(g.b) - 3) < 1e-12);
});

test('catastrophe stop: a touch exits at the stop, a gap at the open, then flat for the month', () => {
  const bars = [
    { time: T0, open: 100, high: 101, low: 99.5, close: 100.5 },
    { time: T0 + DAY, open: 100.5, high: 101, low: 96, close: 97 },        // touches 97 stop → exits at 97
    { time: T0 + 2 * DAY, open: 90, high: 91, low: 89, close: 90 },
  ];
  const r = S.holdMonth('spx500', bars, 100, 0, 1, 1, 97, { costX: 0, finX: 0 });
  assert.ok(Math.abs(r.rows[1].ret - (97 / 100.5 - 1)) < 1e-12);
  assert.equal(r.rows[2].ret, 0); assert.equal(r.wEnd, 0); assert.equal(r.stopped, true);
  const gap = [{ time: T0, open: 100, high: 100, low: 100, close: 100 }, { time: T0 + DAY, open: 104, high: 105, low: 103, close: 104 }];
  const g = S.holdMonth('spx500', gap, 100, 0, -1, -1, 103, { costX: 0, finX: 0 });               // short, stop 103, gaps to 104
  assert.ok(Math.abs(g.rows[1].ret - (-1 * (104 / 100 - 1))) < 1e-12);
  assert.equal(g.wEnd, 0);
  const s = S.holdMonth('spx500', gap, 100, 0, 1, 1, 90, { costX: 1, finX: 0 });                   // costs: half a round trip on |Δw|
  assert.ok(Math.abs(s.rows[0].cost - 0.0003 / 2) < 1e-12);
});

test('rebalance: the old position earns the close → open gap, the new one starts at the open', () => {
  const bars = [{ time: T0, open: 102, high: 103, low: 101, close: 103 }];
  const r = S.holdMonth('eurusd', bars, 100, 0.5, -0.25, -1, 200, { costX: 0, finX: 0 });
  assert.ok(Math.abs(r.rows[0].ret - (0.5 * (102 / 100 - 1) - 0.25 * (103 / 102 - 1))) < 1e-12);
});

test('financing: gold longs at FIN per rollover, gold shorts nothing, others the markup both ways', async () => {
  const { FIN } = await import('../council/fills.mjs');
  const tue = Date.UTC(2024, 0, 2) / 1000, wed = tue + DAY;
  const b = (t) => [{ time: t, open: 100, high: 100, low: 100, close: 100 }];
  assert.ok(Math.abs(S.holdMonth('xau', b(tue), 100, 1, 1, 1, 50).rows[0].fin - FIN.xau.long) < 1e-15);
  assert.ok(Math.abs(S.holdMonth('xau', b(wed), 100, 1, 1, 1, 50).rows[0].fin - 3 * FIN.xau.long) < 1e-15);
  assert.equal(S.holdMonth('xau', b(tue), 100, -1, -1, -1, 150).rows[0].fin, 0);
  assert.ok(Math.abs(S.holdMonth('usdjpy', b(tue), 100, -2, -2, -1, 150).rows[0].fin - 2 * S.P.MARKUP) < 1e-15);
});

test('no look-ahead: changing every candle after a month-end leaves that decision unchanged', () => {
  const base = trend(900, 0.0004), D1 = candles(base);
  const k = '2007-03', d1 = S.decide(D1, S.monthEnds(D1), k);
  const alt = base.map((c, i) => (i > d1.i ? c * (2 + Math.cos(i)) : c)), D2 = candles(alt);
  const d2 = S.decide(D2, S.monthEnds(D2), k);
  assert.deepEqual(d2, d1);
  // and the portfolio's returns up to that month are the same
  const s1 = S.simulate({ spx500: D1 }), s2 = S.simulate({ spx500: D2 });
  for (const m of Object.keys(s1.monthly).filter((m) => m <= k)) assert.equal(s1.monthly[m].all, s2.monthly[m].all, m);
});

test('result: universe as pre-registered, verdict from the bar, RESULT.md is the report of result.json', () => {
  const R = JSON.parse(fs.readFileSync(path.join(DIR, 'result.json'), 'utf8'));
  assert.deepEqual(Object.values(R.universe).flat().sort(), S.KEYS.slice().sort());
  assert.equal(S.KEYS.length, 20);
  assert.deepEqual(R.dropped, []);
  assert.deepEqual(R.verdict, S.verdictOf(R.confirmation, R.post));
  assert.equal(R.confirmation.n, 120);
  assert.equal(fs.readFileSync(path.join(DIR, 'RESULT.md'), 'utf8'), S.report(R));
  const md = fs.readFileSync(path.join(DIR, 'RESULT.md'), 'utf8');
  assert.ok(md.startsWith('# ') && md.split('\n')[2].startsWith(`**Verdict: ${R.verdict.pass ? 'PASS' : 'FAIL'}**`));
  assert.ok(!fs.existsSync(path.join(HERE, '../research/proposals/2026-11-13-tsmom-portfolio.md')) || R.verdict.pass, 'a proposal only on a pass');
});
