// The numbers behind research/proposals/2026-11-14-luxus-record-power.md (14 Nov 2026). Arithmetic, not evidence: no market
// data, no candles, no trade of anyone's is read, and no rule is tested (owner item 44 untouched: nothing on the gold book).
// Question: how many of Luxus's time-stamped pre-entry trades must the Mosha desk's record hold before it can tell a trader
// with an edge from one without, and what a record would need to show.
// Model of one trade: a loss of -1R or a win of W R, both less a round-trip cost C in R. W is fixed (2R, 3R, 5R) or heavy
// tailed (a lognormal resembling the owner's five shown examples: median 4R, about one win in eleven of 15R or more, capped).
// For each case and win rate: the true expectancy a trade, the trades needed for a one-sided t >= 2 with 80 % power, and how
// often a trader with exactly zero expectancy after costs shows t >= 2 by luck at 20, 50 and 100 trades.
// Simulated, seeded (mulberry32), 20,000 records a case.
//   node research/proposals/2026-11-14-luxus-record-power.mjs     → writes 2026-11-14-luxus-record-power.json beside this file
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = path.dirname(fileURLToPath(import.meta.url));
export const OUT = path.join(HERE, '2026-11-14-luxus-record-power.json');
export const DRAWS = 20000, SEED = 1114;
export const N_MAX = 1000;                         // records are followed to 1,000 trades; "over 1,000" past that
export const T_BAR = 2, POWER = 0.8;
export const LUCK_N = [20, 50, 100];
export const WIN_RATES = [0.15, 0.2, 0.25, 0.3, 0.35, 0.4, 0.45, 0.5];
// cost: $0.60 a round trip (spread + commission + slippage on gold) on a typical stop of $4 ($3-5) → 0.15R (0.12-0.20R)
export const COST_USD = 0.6, STOP_USD = 4, STOP_RANGE = [3, 5];
export const C = COST_USD / STOP_USD;
// heavy tail: lognormal win size, median 4R, sigma 1 (P(W >= 15R) = 9.3 %), capped at 30R
export const TAIL = { median: 4, sigma: 1, cap: 30 };
export const CASES = [
  { id: 'w2', name: 'Every win 2R', fixed: 2 },
  { id: 'w3', name: 'Every win 3R', fixed: 3 },
  { id: 'w5', name: 'Every win 5R', fixed: 5 },
  { id: 'tail', name: 'Heavy tail: median 4R, 1 win in 11 of 15R or more (capped at 30R)', tail: TAIL },
];
export const EXAMPLES = [2.8, 4.6, 2.1, 16.4, 5.6];   // the owner's five shown trades (CLAUDE.md, Mosha level reversal study)

const rN = (d) => (x) => (x == null || !Number.isFinite(x) ? null : +x.toFixed(d));
const r2 = rN(2), r3 = rN(3), r4 = rN(4);
export function mulberry32(a) { return () => { a |= 0; a = (a + 0x6d2b79f5) | 0; let t = Math.imul(a ^ (a >>> 15), 1 | a); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; }
// standard normal CDF (Abramowitz and Stegun 7.1.26, error under 1.5e-7)
export function phi(x) {
  const z = Math.abs(x) / Math.SQRT2, t = 1 / (1 + 0.3275911 * z);
  const e = 1 - (((((1.061405429 * t - 1.453152027) * t) + 1.421413741) * t - 0.284496736) * t + 0.254829592) * t * Math.exp(-z * z);
  return x >= 0 ? (1 + e) / 2 : (1 - e) / 2;
}
// win size: mean, second moment, a draw
export function winMoments(cs) {
  if (cs.fixed) return { m1: cs.fixed, m2: cs.fixed * cs.fixed };
  const { median: m, sigma: s, cap } = cs.tail, a = Math.log(cap / m) / s;
  const m1 = m * Math.exp(s * s / 2) * phi(a - s) + cap * (1 - phi(a));
  const m2 = m * m * Math.exp(2 * s * s) * phi(a - 2 * s) + cap * cap * (1 - phi(a));
  return { m1, m2 };
}
export function winDraw(cs, rnd) {
  if (cs.fixed) return cs.fixed;
  let u = rnd(); while (u <= 0) u = rnd();
  const z = Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * rnd());
  return Math.min(cs.tail.cap, cs.tail.median * Math.exp(cs.tail.sigma * z));
}
// one trade's R after costs: mean and standard deviation
export function tradeStats(cs, p, c = C) {
  const { m1, m2 } = winMoments(cs);
  const mean = p * m1 - (1 - p) - c;
  const ex2 = p * m2 + (1 - p) * 1;                  // second moment before the cost (the cost is a constant shift)
  const sd = Math.sqrt(ex2 - (p * m1 - (1 - p)) ** 2);
  return { mean, sd };
}
// the win rate at which the expectancy after costs is exactly zero
export function zeroP(cs, c = C) { const { m1 } = winMoments(cs); return (1 + c) / (m1 + 1); }
// one-sided t of a record from its running sums
const tOf = (n, s, q) => { if (n < 2) return -Infinity; const v = (q - s * s / n) / (n - 1); return v > 1e-12 ? (s / n) / Math.sqrt(v / n) : (s > 0 ? Infinity : -Infinity); };
// simulate `draws` records of `nMax` trades; returns, for every n, the share of records with t >= bar at that n
export function powerCurve(cs, p, nMax, draws, seed, c = C, bar = T_BAR) {
  const rnd = mulberry32(seed), hit = new Float64Array(nMax + 1);
  for (let d = 0; d < draws; d++) {
    let s = 0, q = 0;
    for (let n = 1; n <= nMax; n++) {
      const r = (rnd() < p ? winDraw(cs, rnd) : -1) - c;
      s += r; q += r * r;
      if (tOf(n, s, q) >= bar) hit[n]++;
    }
  }
  for (let n = 0; n <= nMax; n++) hit[n] /= draws;
  return hit;
}
// the smallest n at which the share reaches the power wanted (null = not within nMax)
export const firstN = (curve, power = POWER) => { for (let n = 2; n < curve.length; n++) if (curve[n] >= power) return n; return null; };
// rough normal-theory count for comparison: ((t_bar + z_0.80) x sd / mean)^2
export const normalN = (mean, sd) => (mean > 0 ? Math.ceil(((T_BAR + 0.8416) * sd / mean) ** 2) : null);

export function build() {
  const cases = CASES.map((cs, ci) => {
    const { m1 } = winMoments(cs);
    const rows = WIN_RATES.map((p, pi) => {
      const { mean, sd } = tradeStats(cs, p);
      const row = { winRate: p, expectancy: r3(mean), sd: r2(sd) };
      if (mean <= 0) { row.tradesNeeded = null; row.why = 'no edge after costs: nothing to find'; return row; }
      const curve = powerCurve(cs, p, N_MAX, DRAWS, SEED + 1000 * ci + pi);
      row.tradesNeeded = firstN(curve);
      if (row.tradesNeeded == null) row.why = `over ${N_MAX}`;
      row.normalApprox = normalN(mean, sd);
      row.powerAt = Object.fromEntries([20, 50, 100, 200].map((n) => [n, r3(curve[n])]));
      return row;
    });
    // a trader with zero expectancy after costs, same win sizes: how often luck alone gives t >= 2
    const p0 = zeroP(cs), z = tradeStats(cs, p0);
    const lc = powerCurve(cs, p0, Math.max(...LUCK_N), DRAWS, SEED + 1000 * ci + 999);
    const luck = { winRate: r4(p0), expectancy: r4(z.mean), sd: r2(z.sd), falseAlarm: Object.fromEntries(LUCK_N.map((n) => [n, r4(lc[n])])) };
    return { id: cs.id, name: cs.name, meanWin: r3(m1), rows, luck };
  });
  // the bar a record must clear at a given size: average R a trade for t >= 2, for the heavy-tailed case at its 30 % row
  const tail = cases.find((x) => x.id === 'tail'), t30 = tail.rows.find((r) => r.winRate === 0.3);
  const bar = Object.fromEntries([20, 50, 100, 200].map((n) => [n, r2(T_BAR * t30.sd / Math.sqrt(n))]));
  const ex = EXAMPLES.map((w) => w - C), exMean = ex.reduce((s, x) => s + x, 0) / ex.length;
  return {
    asOf: '2026-11-14',
    kind: 'arithmetic, not evidence: no market data, no trade record, no rule tested',
    method: { draws: DRAWS, seed: SEED, nMax: N_MAX, tBar: T_BAR, power: POWER, oneSided: true, rng: 'mulberry32' },
    cost: { usd: COST_USD, stopUsd: STOP_USD, stopRange: STOP_RANGE, R: r3(C), rangeR: STOP_RANGE.map((s) => r3(COST_USD / s)).reverse() },
    tail: TAIL,
    tailShare15: r3(1 - phi(Math.log(15 / TAIL.median) / TAIL.sigma)),
    cases,
    barAt: { case: 'tail', winRate: 0.3, sd: t30.sd, avgR: bar },
    examples: { R: EXAMPLES, n: EXAMPLES.length, meanAfterCost: r2(exMean), note: 'chosen by the owner after the fact: not an estimate of anything' },
  };
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const o = build();
  fs.writeFileSync(OUT, JSON.stringify(o, null, 1) + '\n');
  console.log(`wrote ${OUT}`);
}
