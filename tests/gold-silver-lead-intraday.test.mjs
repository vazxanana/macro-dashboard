// gold-silver-lead-intraday: the rule on hand-made candles (offline), no look-ahead, and the report against result.json.
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { join, moments, shocks, allowed, rangeBlocks, rangeCursor, trade, stream, stats, holm, placeboSigs, P, M5, COST, START, SPLIT } from '../research/edge/gold-silver-lead-intraday/run.mjs';

const DIR = new URL('../research/edge/gold-silver-lead-intraday/', import.meta.url);
const T0 = Date.UTC(2021, 2, 1) / 1000;   // Monday 1 March 2021 00:00 UTC, no CME holiday nearby

// correlated random walks, every 5 minutes for `days` days (weekends included: `allowed` judges them)
function walk(days, seed = 1) {
  let a = seed >>> 0; const r = () => { a = (a * 1664525 + 1013904223) >>> 0; return a / 4294967296 - 0.5; };
  const G = [], S = []; let g = 1800, s = 25;
  for (let i = 0; i < days * 288; i++) {
    const t = T0 + i * M5, c = r(), eg = r(), es = r();
    const g1 = g * Math.exp(0.0006 * (c + 0.5 * eg)), s1 = s * Math.exp(0.0009 * (c + 0.5 * es));
    G.push({ time: t, open: g, high: Math.max(g, g1) + 0.2, low: Math.min(g, g1) - 0.2, close: g1 });
    S.push({ time: t, open: s, high: Math.max(s, s1) + 0.01, low: Math.min(s, s1) - 0.01, close: s1 });
    g = g1; s = s1;
  }
  return { G, S };
}

test('join keeps only candle times both metals have', () => {
  const G = [{ time: 0, open: 1, high: 1, low: 1, close: 1 }, { time: 300, open: 1, high: 1, low: 1, close: 2 }, { time: 600, open: 2, high: 2, low: 2, close: 3 }];
  const S = [{ time: 0, close: 5 }, { time: 600, close: 6 }];
  const J = join(G, S);
  assert.deepEqual(J.t, [0, 600]); assert.deepEqual(J.gc, [1, 3]); assert.deepEqual(J.sc, [5, 6]);
  const m = moments(J); assert.ok(Number.isNaN(m.g[1]), 'no return across a missing candle');
});

test('a silver shock with gold lagging is a buy (sell) of gold; a gold shock silver ignores is faded', () => {
  const { G, S } = walk(34);
  const k = 32 * 288 + 150;   // a Wednesday afternoon candle, after the 28-day window is full
  S[k].close = S[k - 1].close * 1.01; S[k].high = S[k].close;          // silver +1 % in five minutes
  G[k].close = G[k - 1].close;                                           // gold flat
  const J = join(G, S), m = moments(J);
  assert.ok(m.beta[k] > 0 && m.sdS[k] > 0);
  const sS = shocks(J, m, 's');
  assert.ok(sS.some((x) => x.i === k && x.side === 1));
  // the same move with gold following fully is not a lag
  const G2 = G.map((b) => ({ ...b })); G2[k].close = G2[k - 1].close * Math.exp(m.beta[k] * Math.log(1.01));
  assert.ok(!shocks(join(G2, S), moments(join(G2, S)), 's').some((x) => x.i === k));
  // a gold shock silver did not confirm: faded
  const G3 = G.map((b) => ({ ...b })), S3 = S.map((b) => ({ ...b })); S3[k].close = S3[k - 1].close; G3[k].close = G3[k - 1].close * 0.99;
  const J3 = join(G3, S3), sG = shocks(J3, moments(J3), 'g');
  assert.ok(sG.some((x) => x.i === k && x.side === 1), 'gold fell alone: buy gold');
});

test('moments use only candles before the signal (no look-ahead)', () => {
  const { G, S } = walk(31);
  const k = 30 * 288 + 100, J = join(G, S), m = moments(J);
  const G2 = G.map((b, i) => i >= k ? { ...b, close: b.close * (1 + (i % 7) / 50) } : b);   // change candle k and everything after
  const m2 = moments(join(G2, S));
  assert.equal(m2.sdG[k], m.sdG[k]); assert.equal(m2.beta[k], m.beta[k]); assert.equal(m2.sdS[k], m.sdS[k]);
  const blocks = rangeBlocks(G), blocks2 = rangeBlocks(G2);
  assert.equal(rangeCursor(blocks2)(G[k].time - 1800), rangeCursor(blocks)(G[k].time - 1800));
});

test('allowed: no holiday or early close, nothing near the 17:00 New York halt', () => {
  const at = (iso) => Date.parse(iso) / 1000;
  assert.equal(allowed(at('2021-03-03T15:00:00Z'), 1800), true);            // Wednesday 10:00 New York
  assert.equal(allowed(at('2021-03-03T21:10:00Z'), 1800), false);           // 16:10 + 35 min reaches 16:30
  assert.equal(allowed(at('2021-03-03T20:50:00Z'), 1800), true);            // 15:50 New York, out by 16:25
  assert.equal(allowed(at('2021-03-03T20:50:00Z'), 3600), false);           // the 60-minute hold reaches 16:30
  assert.equal(allowed(at('2021-11-25T15:00:00Z'), 1800), false);           // Thanksgiving (early close)
  assert.equal(allowed(at('2021-04-02T15:00:00Z'), 1800), false);           // Good Friday
  assert.equal(allowed(at('2021-03-06T15:00:00Z'), 1800), false);           // Saturday
});

test('trade: entry at the next open, stop 1 x the range mean, stop first, cost in R', () => {
  const G = [], t0 = Date.parse('2021-03-03T15:00:00Z') / 1000;
  for (let i = 0; i < 20; i++) G.push({ time: t0 + i * M5, open: 100, high: 100.5, low: 99.5, close: 100 });
  const gi = new Map(G.map((b, i) => [b.time, i])), js = new Set(G.map((b) => b.time)), rangeAt = () => 2;
  let tr = trade(G, gi, js, rangeAt, t0, 1, 1800);
  assert.equal(tr.entry, 100); assert.equal(tr.stop, 98); assert.equal(tr.how, 'time'); assert.equal(tr.R, 0); assert.equal(tr.net, -COST / 2);
  assert.equal(tr.exitT, t0 + M5 + 1800);
  G[3] = { ...G[3], low: 97.5 }; tr = trade(G, gi, js, rangeAt, t0, 1, 1800);
  assert.equal(tr.how, 'stop'); assert.equal(tr.R, -1);
  G[3] = { ...G[3], open: 97, low: 96.5 }; tr = trade(G, gi, js, rangeAt, t0, 1, 1800);
  assert.equal(tr.exit, 97, 'gapped through: the open');
  // one position at a time
  G[3] = { time: G[3].time, open: 100, high: 100.5, low: 99.5, close: 100 };
  const ctx = { G, gi, js, rangeAt: () => rangeAt };
  const s = stream(ctx, [{ t: t0, side: 1 }, { t: t0 + 2 * M5, side: -1 }, { t: t0 + 7 * M5, side: -1 }], 1800);
  assert.deepEqual(s.map((x) => x.t), [t0, t0 + 7 * M5]);
});

test('statistics: month t, Holm, seeded placebo keeps the side and the year', () => {
  const T = [1, -0.5, 2, 0.5].map((v, i) => ({ entryT: Date.UTC(2021, i, 5) / 1000, R: v, net: v - 0.1, how: 'time' }));
  const s = stats(T); assert.equal(s.n, 4); assert.equal(s.months, 4); assert.ok(s.t > 0);
  assert.deepEqual(holm([0.01, 0.04, 0.03]), [0.03, 0.06, 0.06]);
  const pool = new Map([[2021, [1, 2, 3, 4, 5].map((k) => Date.UTC(2021, 5, k) / 1000)]]);
  const sig = [{ t: Date.UTC(2021, 1, 1) / 1000, side: -1 }, { t: Date.UTC(2021, 2, 1) / 1000, side: 1 }];
  const a = placeboSigs(sig, pool, 7), b = placeboSigs(sig, pool, 7);
  assert.deepEqual(a, b); assert.deepEqual(a.map((x) => x.side).sort(), [-1, 1]);
  assert.ok(a.every((x) => pool.get(2021).includes(x.t)));
});

test('pre-registered parameters', () => {
  assert.equal(P.k, 2); assert.equal(P.frac, 0.5); assert.equal(P.winDays, 28); assert.equal(P.holdT1, 1800); assert.equal(P.holdT2, 3600); assert.equal(P.holdT3, 1800);
  assert.equal(COST, 0.6); assert.equal(START, Date.UTC(2016, 0, 1) / 1000); assert.equal(SPLIT, Date.UTC(2021, 0, 1) / 1000);
});

test('the report matches result.json', () => {
  const R = JSON.parse(fs.readFileSync(new URL('result.json', DIR), 'utf8'));
  const md = fs.readFileSync(new URL('RESULT.md', DIR), 'utf8');
  const v = md.match(/\*\*Verdict: ([^*]+)\*\*/); assert.ok(v, 'bold verdict line'); assert.ok(v[0].length < 220);
  assert.ok(v[1].startsWith(R.verdict));
  assert.ok(R.data.xau.from >= '2016-01-01' && R.data.xag.from >= '2016-01-01', 'no candle before 2016');
  for (const k of ['T1', 'T2', 'T3']) {
    const o = R.tests[k], w = o.windows;
    for (const x of [w.inSample, w.outOfSample]) { assert.ok(md.includes(String(x.n)), `${k} n ${x.n}`); assert.ok(md.includes(x.avg.toFixed(3).replace('-', '−')) || md.includes(x.avg.toFixed(3)), `${k} avg ${x.avg}`); }
    assert.equal(o.pass, Object.values(o.checks).every(Boolean));
    assert.equal(o.placebo.runs.length, 40);
  }
  assert.equal(R.verdict, ['T1', 'T2', 'T3'].some((k) => R.tests[k].pass) ? 'PASS' : 'FAIL');
});
