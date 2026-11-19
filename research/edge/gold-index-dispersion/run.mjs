// Spot gold after a day of wide dispersion across 13 world equity index CFDs (PREREGISTRATION.md, pushed first).
// A stand-alone rule on gold: never a gate, entry, exit or size of the live gold book. Paper only.
//   node research/edge/gold-index-dispersion/run.mjs   reads council-data research/daily/<key>.json (git show, no network,
//                                                       no cache written) -> result.json, prints the tables
// Pure pieces are exported for the test.
import fs from 'node:fs';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { foldWeekend, nights, FIN, stopFill } from '../../../council/fills.mjs';

export const INDICES = ['au200', 'ch20', 'de40', 'eu50', 'fr40', 'hk33', 'jp225', 'nas100', 'sg30', 'spx500', 'uk100', 'us2000', 'us30'];
export const COST = 0.60, ATR_N = 20, ATR_K = 2, LOOK = 250, PCT = 0.9, MIN_MKTS = 10, GAP_DAYS = 5;
export const SEED = 20261114, SEEDS = 40, BEAT = 38;
export const HOLDS = { T1: 5, T2: 1, T3: 3 };
export const IS = ['2007-01', '2016-12'], OOS = ['2017-01', '2026-10'];
const H = 3600;
export const dateOf = (t) => new Date(t * 1000).toISOString().slice(0, 10);
const closeTime = (t) => t + (new Date(t * 1000).getUTCDay() === 5 ? 21 : 23) * H;
const toBars = (rows) => foldWeekend(rows.map(([time, open, high, low, close]) => ({ time, open, high, low, close })));

// per market: date -> log return against its previous candle (at most GAP_DAYS calendar days earlier)
export function returnsOf(bars) {
  const m = new Map();
  for (let i = 1; i < bars.length; i++) if (bars[i].time - bars[i - 1].time <= GAP_DAYS * 86400) m.set(dateOf(bars[i].time), Math.log(bars[i].close / bars[i - 1].close));
  return m;
}
// dispersion on each gold date: sample sd across markets with a return that date (>= MIN_MKTS), else null
export function dispersion(goldBars, rets) {
  return goldBars.map((b) => {
    const D = dateOf(b.time), v = rets.map((m) => m.get(D)).filter((x) => x != null);
    if (v.length < MIN_MKTS) return null;
    const mu = v.reduce((a, c) => a + c, 0) / v.length;
    return Math.sqrt(v.reduce((a, c) => a + (c - mu) ** 2, 0) / (v.length - 1));
  });
}
// event flags: dispersion above the PCT point of the LOOK previous readings (strictly earlier); nothing later is read
export function eventFlags(disp) {
  const hist = [], out = disp.map(() => false);
  disp.forEach((v, i) => {
    if (v == null) return;
    if (hist.length >= LOOK) { const s = hist.slice(-LOOK).sort((a, b) => a - b); out[i] = v > s[Math.floor(PCT * LOOK)]; }
    hist.push(v);
  });
  return out;
}

// one long trade: in at the close of candle i, out at the close of candle i + h or at the stop
export function trade(bars, i, h, { cost = COST, finMult = 1 } = {}) {
  const j = i + h;
  if (i < ATR_N || j >= bars.length) return null;
  let tr = 0;
  for (let k = i - ATR_N + 1; k <= i; k++) { const x = bars[k], pc = bars[k - 1].close; tr += Math.max(x.high - x.low, Math.abs(x.high - pc), Math.abs(x.low - pc)); }
  const entry = bars[i].close, risk = ATR_K * tr / ATR_N, stop = entry - risk;
  if (!(risk > 0)) return null;
  let exit = bars[j].close, how = 'time', tOut = closeTime(bars[j].time);
  for (let k = i + 1; k <= j; k++) { const x = bars[k]; if (x.low <= stop) { exit = stopFill(x, false, stop, true); how = 'stop'; tOut = closeTime(x.time); break; } }
  const R = (exit - entry) / risk, nn = nights(closeTime(bars[i].time), tOut), fin = finMult * nn * FIN.xau.long * entry / risk;
  return { i, a: dateOf(bars[i].time), entry, risk, exit, how, R, fin, net: R - cost / risk - fin };
}
// one at a time: keep an index only once the previous kept trade is out (its exit candle index is passed)
export function oneAtATime(bars, idxs, h, opt) {
  const out = []; let free = -1;
  for (const i of idxs) { if (i <= free) continue; const t = trade(bars, i, h, opt); if (!t) continue; out.push(t); free = i + h; }
  return out;
}
// baseline: mean net R by year of the long trade entered at every candle of that year
export function baseline(bars, h, opt) {
  const by = new Map();
  for (let i = 0; i < bars.length; i++) { const t = trade(bars, i, h, opt); if (!t) continue; const y = t.a.slice(0, 4); const s = by.get(y) || [0, 0]; s[0] += t.net; s[1]++; by.set(y, s); }
  return new Map([...by].map(([y, [s, n]]) => [y, s / n]));
}

// statistics
const mean = (a) => a.reduce((x, y) => x + y, 0) / a.length;
const sdOf = (a) => { const m = mean(a); return Math.sqrt(a.reduce((x, y) => x + (y - m) ** 2, 0) / (a.length - 1)); };
function betacf(a, b, x) {
  let qab = a + b, qap = a + 1, qam = a - 1, c = 1, d = 1 - qab * x / qap; if (Math.abs(d) < 1e-30) d = 1e-30; d = 1 / d; let h = d;
  for (let m = 1; m <= 300; m++) { const m2 = 2 * m; let aa = m * (b - m) * x / ((qam + m2) * (a + m2));
    d = 1 + aa * d; if (Math.abs(d) < 1e-30) d = 1e-30; c = 1 + aa / c; if (Math.abs(c) < 1e-30) c = 1e-30; d = 1 / d; h *= d * c;
    aa = -(a + m) * (qab + m) * x / ((a + m2) * (qap + m2));
    d = 1 + aa * d; if (Math.abs(d) < 1e-30) d = 1e-30; c = 1 + aa / c; if (Math.abs(c) < 1e-30) c = 1e-30; d = 1 / d;
    const del = d * c; h *= del; if (Math.abs(del - 1) < 3e-14) break; }
  return h;
}
function lgamma(z) { const g = [76.18009172947146, -86.50532032941677, 24.01409824083091, -1.231739572450155, 0.1208650973866179e-2, -0.5395239384953e-5];
  let x = z, y = z, t = x + 5.5; t -= (x + 0.5) * Math.log(t); let s = 1.000000000190015; for (const c of g) s += c / ++y; return -t + Math.log(2.5066282746310005 * s / x); }
function ibeta(x, a, b) {
  if (x <= 0) return 0; if (x >= 1) return 1;
  const bt = Math.exp(lgamma(a + b) - lgamma(a) - lgamma(b) + a * Math.log(x) + b * Math.log(1 - x));
  return x < (a + 1) / (a + b + 2) ? bt * betacf(a, b, x) / a : 1 - bt * betacf(b, a, 1 - x) / b;
}
export const pUpper = (t, df) => { const p2 = ibeta(df / (df + t * t), df / 2, 0.5) / 2; return t >= 0 ? p2 : 1 - p2; };
export function holm(ps) {
  const o = ps.map((p, i) => [p, i]).sort((x, y) => x[0] - y[0]), out = Array(ps.length); let run = 0;
  o.forEach(([p, i], r) => { run = Math.max(run, Math.min(1, (ps.length - r) * p)); out[i] = run; });
  return out;
}
export function mulberry32(a) { return () => { a |= 0; a = a + 0x6D2B79F5 | 0; let t = Math.imul(a ^ a >>> 15, 1 | a); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; }; }
export function monthT(T, key) {
  const by = new Map(); for (const x of T) { const k = x.a.slice(0, 7); by.set(k, (by.get(k) || 0) + x[key]); }
  const v = [...by.values()], n = v.length; if (n < 3) return { months: n, t: null, p: null };
  const sd = sdOf(v), t = sd ? mean(v) / (sd / Math.sqrt(n)) : 0;
  return { months: n, t, p: pUpper(t, n - 1) };
}
const inW = (a, w) => a.slice(0, 7) >= w[0] && a.slice(0, 7) <= w[1];
const r3 = (x) => x == null ? null : +x.toFixed(3), r2 = (x) => x == null ? null : +x.toFixed(2), r4 = (x) => x == null ? null : +x.toFixed(4);
const withEx = (T, base) => T.map((t) => ({ ...t, ex: t.net - base.get(t.a.slice(0, 4)) }));
export function summary(T) {
  const me = monthT(T, 'ex'), mn = monthT(T, 'net'), mg = monthT(T, 'R');
  return { n: T.length, excess: r3(mean(T.map((x) => x.ex))), tExcess: r2(me.t), p: r4(me.p), months: me.months,
    net: r3(mean(T.map((x) => x.net))), tNet: r2(mn.t), gross: r3(mean(T.map((x) => x.R))), tGross: r2(mg.t),
    baseline: r3(mean(T.map((x) => x.net - x.ex))), win: r2(100 * T.filter((x) => x.net > 0).length / T.length),
    stops: T.filter((x) => x.how === 'stop').length, total: r2(T.reduce((s, x) => s + x.net, 0)) };
}
// placebo: per seed, the out-of-sample events replaced by random non-event candles of the same years (same count a year),
// then one at a time; statistic = mean excess
export function placebo(bars, flags, evIdx, h, base, seeds = SEEDS, seed = SEED) {
  const byYear = new Map();
  for (const i of evIdx) { const y = dateOf(bars[i].time).slice(0, 4); byYear.set(y, (byYear.get(y) || 0) + 1); }
  const pool = new Map();
  bars.forEach((b, i) => { const a = dateOf(b.time), y = a.slice(0, 4); if (!byYear.has(y) || flags[i] || !inW(a, OOS)) return; if (!pool.has(y)) pool.set(y, []); pool.get(y).push(i); });
  const out = [];
  for (let s = 0; s < seeds; s++) {
    const rng = mulberry32(seed + s), pick = [];
    for (const [y, n] of byYear) { const c = [...(pool.get(y) || [])]; for (let k = 0; k < n && c.length; k++) pick.push(c.splice(Math.floor(rng() * c.length), 1)[0]); }
    pick.sort((a, b) => a - b);
    const T = withEx(oneAtATime(bars, pick, h), base);
    out.push(mean(T.map((x) => x.ex)));
  }
  return out;
}

export function study(goldRows, indexRows) {
  const bars = toBars(goldRows), rets = INDICES.map((k) => returnsOf(toBars(indexRows[k])));
  const disp = dispersion(bars, rets), flags = eventFlags(disp);
  const idx = flags.map((f, i) => f ? i : -1).filter((i) => i >= 0 && (inW(dateOf(bars[i].time), IS) || inW(dateOf(bars[i].time), OOS)));
  const out = { data: { first: dateOf(bars[0].time), last: dateOf(bars.at(-1).time), candles: bars.length, noReading: disp.filter((v) => v == null).length,
      markets: INDICES, fold: 'UTC days, weekends folded into Monday (fills.mjs foldWeekend)' },
    rules: { cost: COST, cost2x: 2 * COST, atr: `${ATR_K} x ATR(${ATR_N})`, look: LOOK, pct: PCT, minMarkets: MIN_MKTS, holds: HOLDS, fin: FIN.xau.long, IS, OOS },
    events: { is: idx.filter((i) => inW(dateOf(bars[i].time), IS)).length, oos: idx.filter((i) => inW(dateOf(bars[i].time), OOS)).length }, tests: {} };
  const ps = [], keys = Object.keys(HOLDS);
  for (const k of keys) {
    const h = HOLDS[k], base = baseline(bars, h), base2 = baseline(bars, h, { cost: 2 * COST, finMult: 2 });
    const T = withEx(oneAtATime(bars, idx, h), base), T2 = withEx(oneAtATime(bars, idx, h, { cost: 2 * COST, finMult: 2 }), base2), r = { hold: h };
    for (const [w, W] of [['is', IS], ['oos', OOS]]) {
      const f = (x) => inW(x.a, W), s2 = T2.filter(f);
      r[w] = { ...summary(T.filter(f)), excess2x: r3(mean(s2.map((x) => x.ex))), net2x: r3(mean(s2.map((x) => x.net))) };
    }
    const pl = placebo(bars, flags, idx.filter((i) => inW(dateOf(bars[i].time), OOS)), h, base), want = r.oos.excess;
    r.placebo = { seeds: SEEDS, beaten: pl.filter((v) => want > v).length, mean: r3(mean(pl)), max: r3(Math.max(...pl)), min: r3(Math.min(...pl)) };
    out.tests[k] = r; ps.push(r.oos.p);
  }
  const adj = holm(ps);
  keys.forEach((k, i) => { const r = out.tests[k]; r.holm = r4(adj[i]);
    r.checks = { oosExcessT2: r.oos.excess > 0 && r.oos.tExcess >= 2, holm: adj[i] < 0.05, isSameSign: r.is.excess > 0, cost2x: r.oos.excess2x > 0,
      oosNetPos: r.oos.net > 0, placebo: r.placebo.beaten >= BEAT };
    r.pass = Object.values(r.checks).every(Boolean); });
  out.verdict = out.tests.T1.pass ? 'PASS' : 'FAIL';
  out.passed = keys.filter((k) => out.tests[k].pass);
  return out;
}

const here = path.dirname(fileURLToPath(import.meta.url));
if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const read = (k) => JSON.parse(execFileSync('git', ['show', `origin/council-data:research/daily/${k}.json`], { maxBuffer: 64e6 }).toString()).rows;
  const res = { study: 'gold-index-dispersion', built: '2026-11-14', ...study(read('xau'), Object.fromEntries(INDICES.map((k) => [k, read(k)]))) };
  fs.writeFileSync(path.join(here, 'result.json'), JSON.stringify(res, null, 1) + '\n');
  console.log(JSON.stringify({ verdict: res.verdict, data: res.data, events: res.events }));
  for (const [k, r] of Object.entries(res.tests)) console.log(k, JSON.stringify({ hold: r.hold, is: r.is, oos: r.oos, placebo: r.placebo, holm: r.holm, checks: r.checks }));
}
