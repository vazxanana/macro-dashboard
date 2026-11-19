// Volatility targeting on a passive gold holding (PREREGISTRATION.md, committed alone first).
// A stand-alone allocation study of the gold price series: it reads no trade record of the gold book and changes nothing live.
// Run: node research/edge/gold-vol-target/run.mjs   (reads origin/council-data with git show, no network)
import fs from 'node:fs';
import path from 'node:path';
import { execSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { foldWeekend, nights, FIN } from '../../../council/fills.mjs';

const HERE = path.dirname(fileURLToPath(import.meta.url));
export const P = { target: 0.15, cap: 2, perOz: 0.45, fin: FIN.xau.long, block: 6, draws: 5000, seed: 20261114, placebo: 40,
  is: ['2008-01-01', '2016-12-31'], oos: ['2017-01-01', '2026-10-31'] };
const DAY = 86400;

// weekday closes: weekend candles folded into the next weekday (council/fills.mjs foldWeekend)
export function weekdays(rows) {
  return foldWeekend(rows.map(([time, open, high, low, close]) => ({ time, open, high, low, close }))).map((b) => ({ time: b.time, close: b.close }));
}
// annualised sample sd of the last n daily log returns ending at day i (null before n returns exist)
export function sigma(bars, i, n) {
  if (i < n) return null;
  const r = []; for (let j = i - n + 1; j <= i; j++) r.push(Math.log(bars[j].close / bars[j - 1].close));
  const m = r.reduce((a, b) => a + b, 0) / n, v = r.reduce((a, b) => a + (b - m) ** 2, 0) / (n - 1);
  return Math.sqrt(v * 252);
}
export const isoWeek = (t) => Math.floor((Math.floor(t / DAY) + 3) / 7);
// the last weekday close of each ISO week (and the last bar) is a rebalance
export const isRebalance = (bars, i) => i === bars.length - 1 || isoWeek(bars[i + 1].time) !== isoWeek(bars[i].time);
export const managedWeight = (s, p = P) => (s && s > 0 ? Math.min(p.cap, p.target / s) : null);

// daily P&L as a fraction of capital 1 (no compounding). weightAt(i) is called only at rebalance closes and may read bars[0..i].
// Returns per accrual day i+1: { time, pnl, gross, cost, fin, w } where w = the weight set at the last rebalance.
export function simulate(bars, weightAt, { costMult = 1, finMult = 1, p = P } = {}) {
  const out = []; let u = 0, w = null;
  for (let i = 0; i < bars.length - 1; i++) {
    let cost = 0;
    if (isRebalance(bars, i)) {
      const nw = weightAt(i);
      if (nw != null) { const nu = nw / bars[i].close; cost = Math.abs(nu - u) * p.perOz * costMult; u = nu; w = nw; }
    }
    if (w == null) continue;
    const c0 = bars[i].close, c1 = bars[i + 1].close;
    const gross = u * (c1 - c0), fin = u * c0 * p.fin * finMult * nights(bars[i].time + DAY, bars[i + 1].time + DAY);
    out.push({ time: bars[i + 1].time, pnl: gross - cost - fin, gross, cost, fin, w });
  }
  return out;
}
const ymd = (t) => new Date(t * 1000).toISOString().slice(0, 10);
export const inWin = (d, [a, b]) => { const s = ymd(d.time); return s >= a && s <= b; };
export function monthly(daily) {
  const m = new Map();
  for (const d of daily) { const k = ymd(d.time).slice(0, 7); m.set(k, (m.get(k) || 0) + d.pnl); }
  return [...m].map(([month, r]) => ({ month, r }));
}
const mean = (a) => a.reduce((x, y) => x + y, 0) / a.length;
const sd = (a) => { const m = mean(a); return Math.sqrt(a.reduce((x, y) => x + (y - m) ** 2, 0) / (a.length - 1)); };
export const sharpe = (r) => (mean(r) / sd(r)) * Math.sqrt(12);
export function maxDD(r) { let c = 0, hi = 0, dd = 0; for (const x of r) { c += x; hi = Math.max(hi, c); dd = Math.max(dd, hi - c); } return dd; }
export function memmel(a, b) { // Jobson-Korkie z with Memmel's correction, monthly Sharpe ratios; H1: a better
  const T = a.length, s1 = mean(a) / sd(a), s2 = mean(b) / sd(b), ma = mean(a), mb = mean(b);
  const rho = a.reduce((x, y, i) => x + (y - ma) * (b[i] - mb), 0) / (T - 1) / (sd(a) * sd(b));
  const v = (2 - 2 * rho + 0.5 * (s1 * s1 + s2 * s2) - s1 * s2 * rho * rho) / T;
  return (s1 - s2) / Math.sqrt(v);
}
export function rng(seed) { let s = seed >>> 0; return () => { s = (s + 0x6d2b79f5) >>> 0; let t = s; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; }
// paired circular block bootstrap, one-sided p of stat(a, b) > 0, centred on the null
export function bootP(a, b, stat, { block = P.block, draws = P.draws, seed = P.seed } = {}) {
  const n = a.length, obs = stat(a, b), R = rng(seed); let hit = 0;
  for (let k = 0; k < draws; k++) {
    const xa = [], xb = [];
    while (xa.length < n) { const s = Math.floor(R() * n); for (let j = 0; j < block && xa.length < n; j++) { xa.push(a[(s + j) % n]); xb.push(b[(s + j) % n]); } }
    if (stat(xa, xb) - obs >= obs) hit++;
  }
  return hit / draws;
}
export function holm(ps) {
  const o = ps.map((p, i) => [p, i]).sort((x, y) => x[0] - y[0]), adj = Array(ps.length); let run = 0;
  o.forEach(([p, i], k) => { run = Math.max(run, Math.min(1, (ps.length - k) * p)); adj[i] = run; });
  return adj;
}
const sdiff = (a, b) => sharpe(a) - sharpe(b), dddiff = (a, b) => maxDD(b) - maxDD(a); // a = managed, b = constant
const tOf = (r) => mean(r) / (sd(r) / Math.sqrt(r.length));
const r4 = (x) => Math.round(x * 1e4) / 1e4, r3 = (x) => Math.round(x * 1e3) / 1e3;
function stats(daily, win) {
  const d = daily.filter((x) => inWin(x, win)), m = monthly(d), r = m.map((x) => x.r), yrs = new Map();
  for (const x of m) yrs.set(x.month.slice(0, 4), (yrs.get(x.month.slice(0, 4)) || 0) + x.r);
  const nYears = r.length / 12, worst = [...yrs].sort((a, b) => a[1] - b[1])[0];
  return { months: r.length, sharpe: r3(sharpe(r)), t: r3(tOf(r)), annual: r4(r.reduce((a, b) => a + b, 0) / nYears), maxDD: r4(maxDD(r)),
    worstYear: { year: worst[0], r: r4(worst[1]) }, avgW: r3(mean(d.map((x) => x.w))), costYr: r4(d.reduce((a, x) => a + x.cost, 0) / nYears),
    finYr: r4(d.reduce((a, x) => a + x.fin, 0) / nYears), grossYr: r4(d.reduce((a, x) => a + x.gross, 0) / nYears) };
}
const series = (daily, win) => monthly(daily.filter((x) => inWin(x, win))).map((x) => x.r);
const avgW = (daily, win) => mean(daily.filter((x) => inWin(x, win)).map((x) => x.w));

// placebo: OOS managed weights grouped by calendar month (by rebalance), months shuffled as blocks
export function placeboWeights(bars, wFn, win, seed) {
  const groups = new Map(), idx = [];
  for (let i = 0; i < bars.length - 1; i++) if (isRebalance(bars, i) && inWin(bars[i + 1], win)) {
    const k = ymd(bars[i + 1].time).slice(0, 7); if (!groups.has(k)) groups.set(k, []); groups.get(k).push(i); idx.push(i);
  }
  const keys = [...groups.keys()], perm = keys.slice(), R = rng(seed);
  for (let i = perm.length - 1; i > 0; i--) { const j = Math.floor(R() * (i + 1)); [perm[i], perm[j]] = [perm[j], perm[i]]; }
  const map = new Map();
  keys.forEach((k, n) => { const src = groups.get(perm[n]), dst = groups.get(k); dst.forEach((i, j) => map.set(i, wFn(src[j % src.length]))); });
  return (i) => (map.has(i) ? map.get(i) : wFn(i));
}

export function analyse(bars, p = P) {
  const wN = (n) => (i) => managedWeight(sigma(bars, i, n), p);
  const res = { strategies: {}, tests: {}, placebo: {} };
  const runs = {};
  for (const n of [20, 60]) {
    const M = simulate(bars, wN(n), { p }), M2 = simulate(bars, wN(n), { costMult: 2, finMult: 2, p });
    for (const [wk, win] of [['is', p.is], ['oos', p.oos]]) {
      const k = avgW(M, win), K = simulate(bars, () => k, { p }), K2 = simulate(bars, () => k, { costMult: 2, finMult: 2, p });
      runs[`${n}-${wk}`] = { M, M2, K, K2, k, win };
      res.strategies[`M${n}-${wk}`] = stats(M, win);
      res.strategies[`K${n}-${wk}`] = { ...stats(K, win), k: r3(k) };
    }
    // share of rebalances at the cap, OOS and IS
    for (const [wk, win] of [['is', p.is], ['oos', p.oos]]) {
      let n0 = 0, nc = 0; for (let i = 0; i < bars.length - 1; i++) if (isRebalance(bars, i) && inWin(bars[i + 1], win)) { const w = wN(n)(i); if (w != null) { n0++; if (w >= p.cap) nc++; } }
      res.strategies[`M${n}-${wk}`].atCap = r3(nc / n0);
    }
  }
  const def = [['T1', 20, sdiff], ['T2', 60, sdiff], ['T3', 20, dddiff]];
  for (const [name, n, f] of def) {
    const o = runs[`${n}-oos`], i = runs[`${n}-is`];
    const a = series(o.M, p.oos), b = series(o.K, p.oos);
    const t = { lookback: n, stat: name === 'T3' ? 'maxDD(K) - maxDD(M), fraction of capital' : 'Sharpe(M) - Sharpe(K), monthly, annualised',
      oos: r4(f(a, b)), is: r4(f(series(i.M, p.is), series(i.K, p.is))), oos2x: r4(f(series(o.M2, p.oos), series(o.K2, p.oos))),
      p: bootP(a, b, f, { block: p.block, draws: p.draws, seed: p.seed }), retDiff: r4(mean(a.map((x, j) => x - b[j])) * 12), retDiffT: r3(tOf(a.map((x, j) => x - b[j]))) };
    if (name !== 'T3') t.memmel = r3(memmel(a, b));
    res.tests[name] = t;
  }
  const adj = holm(['T1', 'T2', 'T3'].map((k) => res.tests[k].p));
  ['T1', 'T2', 'T3'].forEach((k, j) => {
    const t = res.tests[k]; t.pHolm = r4(adj[j]); t.p = r4(t.p);
    t.checks = { oosPos: t.oos > 0 && t.pHolm < 0.05 && (k === 'T3' || t.memmel >= 2), isSame: t.is > 0, cost2x: t.oos2x > 0 };
    t.pass = Object.values(t.checks).every(Boolean);
  });
  // placebo on T1 and T3 (OOS, M20 weights shuffled by month against the same K20)
  const o = runs['20-oos'], b = series(o.K, p.oos), real1 = res.tests.T1.oos, real3 = res.tests.T3.oos, g1 = [], g3 = [];
  for (let s = 1; s <= p.placebo; s++) {
    const a = series(simulate(bars, placeboWeights(bars, wN(20), p.oos, p.seed + s), { p }), p.oos);
    g1.push(sdiff(a, b)); g3.push(dddiff(a, b));
  }
  const sum = (g, real) => ({ mean: r4(mean(g)), min: r4(Math.min(...g)), max: r4(Math.max(...g)), atLeastReal: g.filter((x) => x >= real).length, n: g.length });
  res.placebo = { T1: sum(g1, real1), T3: sum(g3, real3) };
  res.verdict = res.tests.T1.pass ? 'PASS' : (res.tests.T2.pass || res.tests.T3.pass) ? 'PARTLY' : 'FAIL';
  return res;
}

function main() {
  const raw = JSON.parse(execSync('git show origin/council-data:research/daily/xau.json', { maxBuffer: 64e6 }).toString());
  const bars = weekdays(raw.rows);
  const res = analyse(bars);
  const out = { study: 'gold-vol-target', built: '2026-11-14', verdict: res.verdict,
    data: { file: 'origin/council-data:research/daily/xau.json', first: ymd(bars[0].time), last: ymd(bars.at(-1).time), weekdays: bars.length },
    params: { ...P, finSrc: FIN.xau.src }, ...res };
  fs.writeFileSync(path.join(HERE, 'result.json'), JSON.stringify(out, null, 1) + '\n');
  console.log(JSON.stringify({ verdict: out.verdict, tests: out.tests, placebo: out.placebo }, null, 1));
  for (const k of Object.keys(out.strategies)) console.log(k, JSON.stringify(out.strategies[k]));
}
if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) main();
