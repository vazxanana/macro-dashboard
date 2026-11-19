// research/edge/rsi2-replicate: the frozen RSI(2) pullback on six non-US indices. Offline.
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import crypto from 'node:crypto';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import * as O from '../research/edge/rsi2-replicate/rsi2-pullback.mjs';
import { MARKETS, RATES, WINDOWS, placeboTrades, study } from '../research/edge/rsi2-replicate/run.mjs';

const DIR = path.join(path.dirname(fileURLToPath(import.meta.url)), '..', 'research', 'edge', 'rsi2-replicate');
const read = (f) => fs.readFileSync(path.join(DIR, f), 'utf8');
const DAY = 86400, T0 = Date.parse('2019-01-07T00:00:00Z') / 1000;

// weekday candles from a list of closes (open = previous close, high/low around the bar)
function series(closes) {
  const out = []; let t = T0;
  closes.forEach((c, i) => {
    while ([0, 6].includes(new Date(t * 1000).getUTCDay())) t += DAY;
    const o = i ? closes[i - 1] : c;
    out.push([t, o, Math.max(o, c) + 0.5, Math.min(o, c) - 0.5, c, 1]); t += DAY;
  });
  return out;
}
// 260 days drifting up, a two-day drop (still far above SMA200), then a recovery
const closes = [...Array(260)].map((_, i) => 100 + i * 0.5);
closes.push(225, 221, 222, 226, 232, 233, 234);
for (let i = 0; i < 30; i++) closes.push(234 + i * 0.5);

test('the rule file is the original, unchanged (sha256 of rsi2-pullback/run.mjs on branch rsi2-pullback)', () => {
  const h = crypto.createHash('sha256').update(fs.readFileSync(path.join(DIR, 'rsi2-pullback.mjs'))).digest('hex');
  assert.equal(h, 'edade889f2825fa71d911e039bfe5b9fdaaf5677e7b2fd55742e742830d5ab65');
  assert.deepEqual(O.P, { SMA_LONG: 200, SMA_EXIT: 5, RSI_N: 2, RSI_MAX: 10, ATR_N: 20, STOP_ATR: 3, FIN_ADD: 2.5, SEEDS: 40 });
});

test('the rule on a hand-made series: signal on the drop, fill next open, out at the open after the first close > SMA5', () => {
  const D = O.candles(series(closes));
  const tr = O.simulate(D);
  assert.equal(tr.length, 1);
  const t = tr[0], rs = O.rsi(D.map((b) => b.close)), s5 = O.sma(D, 5), s200 = O.sma(D, 200);
  assert.ok(rs[t.sig] < 10 && D[t.sig].close > s200[t.sig]);
  assert.equal(t.i, t.sig + 1); assert.equal(t.entry, D[t.i].open);
  assert.ok(Math.abs(t.risk - 3 * O.atr(D, t.sig)) < 1e-9); assert.ok(t.stop < t.entry);
  const firstUp = D.findIndex((b, k) => k >= t.i && b.close > s5[k]);
  assert.equal(t.j, firstUp + 1); assert.equal(t.exit, D[firstUp + 1].open); assert.equal(t.why, 'sma5');
});

test('costs: round-trip points + (local rate + 2.5 %) a night; rates match the pre-registration', () => {
  const tr = { entry: 10000, exit: 10100, risk: 200, tIn: Date.parse('2023-07-03T00:00:00Z') / 1000, tOut: Date.parse('2023-07-07T00:00:00Z') / 1000 };
  const n = O.net(tr, MARKETS.de40.cost, RATES.ecb); // ECB 3.50 in force from 2023-06-21; 4 nights
  const fin = 4 * (3.5 + 2.5) / 100 / 365 * 10000;
  assert.equal(n.nights, 4); assert.equal(n.rate, 3.5);
  assert.ok(Math.abs(n.R - (100 - 2.5 - fin) / 200) < 1e-12);
  const pre = read('PREREGISTRATION.md');
  for (const k of Object.keys(RATES)) for (const [d, v] of RATES[k]) assert.ok(pre.includes(`${d} ${v.toFixed(2)}`), `${k} ${d}`);
  for (const [k, m] of Object.entries(MARKETS)) assert.match(pre, new RegExp('`' + k + '` \\| ' + m.inst + ' \\| ' + m.cost.toFixed(1)));
  assert.deepEqual(WINDOWS.B[0], '2016-01-01');
});

test('placeboTrades repeats the original placebo (same mean for the same seed)', () => {
  const D = O.candles(series(closes.concat([...Array(60)].map((_, i) => 249 - (i % 7) * 3 + i * 0.2))));
  const real = O.simulate(D).map((t) => O.net(t, 2, RATES.ecb));
  assert.ok(real.length >= 1);
  for (const s of [1, 7, 40]) {
    const mine = placeboTrades(D, real, 2, RATES.ecb, '2019-01-01', '2020-12-31', s);
    const m = mine.reduce((a, t) => a + t.ret, 0) / mine.length;
    assert.ok(Math.abs(m - O.placebo(D, real, 2, RATES.ecb, '2019-01-01', '2020-12-31', s)) < 1e-12);
  }
});

test('study() runs end to end on hand-made data and applies the four checks', () => {
  const data = Object.fromEntries(Object.keys(MARKETS).map((k) => [k, { rows: series(closes) }]));
  const r = study(data);
  assert.deepEqual(Object.keys(r.checks), ['positive', 'tMonths', 'markets4of6', 'placebo']);
  assert.equal(r.verdict, Object.values(r.checks).every(Boolean) ? 'PASS' : 'FAIL');
});

test('RESULT.md says what result.json says', () => {
  const j = JSON.parse(read('result.json')), md = read('RESULT.md');
  assert.match(md, new RegExp(`\\*\\*Verdict: ${j.verdict}\\*\\*`));
  const B = j.pool.B, A = j.pool.A, sg = (v, d = 3) => (v >= 0 ? '+' : '-') + Math.abs(v).toFixed(d);
  assert.ok(md.includes(`| B: 2016 - Nov 2026 (decisive) | ${B.n} | ${sg(B.avgR)} | ${sg(B.avgGrossR)} | ${B.wr} % | ${B.tTradesR} | ${B.tMonthsR} |`));
  assert.ok(md.includes(`| A: 2008 - 2015 (reported) | ${A.n} | ${sg(A.avgR)} |`));
  assert.ok(md.includes(`95th percentile ${sg(B.placebo.p95)}R`));
  for (const [k, m] of Object.entries(j.markets)) {
    const row = `| ${k.toUpperCase()} | ${m.B.n} | ${sg(m.B.avgRet)} | ${sg(m.B.avgR)} | ${m.B.wr} % | ${m.B.tTrades} | ${m.B.tMonthsR} |`;
    assert.ok(md.includes(row), row);
  }
  assert.equal(j.checks.tMonths, B.tMonthsR >= 2);
  assert.equal(j.checks.markets4of6, B.positiveMarkets >= 4);
});
