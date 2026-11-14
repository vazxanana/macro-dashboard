// TRIX signal-line crosses on spot gold, against the same trade on every day (PREREGISTRATION.md, pushed first).
//   git show origin/council-data:research/daily/xau.json > <dir>/xau.json   (cache kept out of git)
//   node research/edge/gold-trix/run.mjs <dir>                                the study -> result.json (+ prints a summary)
// Pure pieces are exported for the test.
import fs from 'node:fs';
import path from 'node:path';
import { nights, FIN, foldWeekend } from '../../../council/fills.mjs';

export const D = 86400;
export const SPREAD = 0.30, SLIP = SPREAD / 2, RT = SPREAD + 2 * SLIP;   // $0.60 a round trip
export const ATR_N = 20, TRIX_N = 9, SIG_N = 5, STOP_ATR = 2, HOLD = 5, WARM = 60;
export const WIN = { is: ['2007-01-01', '2016-12-31'], oos: ['2017-01-01', '2026-10-31'] };

export function ema(v, n) { const a = 2 / (n + 1), o = []; v.forEach((x, i) => o.push(i ? a * x + (1 - a) * o[i - 1] : x)); return o; }
// TRIX and its signal line; value at i uses closes 0..i only
export function trix(closes) {
  const e3 = ema(ema(ema(closes, TRIX_N), TRIX_N), TRIX_N);
  const tr = e3.map((x, i) => (i ? 100 * (x / e3[i - 1] - 1) : 0));
  return { tr, sig: ema(tr, SIG_N) };
}
// setup on the close of day i: +1 long (bull cross), -1 short (bear cross), 0 none.
export function cross(ds, i) {
  if (i < WARM || i < 1) return 0; const a = ds[i], b = ds[i - 1];
  if (a.trix > a.sig && b.trix <= b.sig) return 1;
  if (a.trix < a.sig && b.trix >= b.sig) return -1;
  return 0;
}
export function enrich(ds) {
  const tr = ds.map((x, i) => (i ? Math.max(x.high, ds[i - 1].close) - Math.min(x.low, ds[i - 1].close) : null));
  const T = trix(ds.map((x) => x.close));
  return ds.map((x, i) => { let atr = null; if (i >= ATR_N) { let s = 0; for (let k = i - ATR_N + 1; k <= i; k++) s += tr[k]; atr = s / ATR_N; }
    return { ...x, atr, trix: T.tr[i], sig: T.sig[i] }; });
}
// one trade from setup day i (rule and baseline alike): market at the open of day i+1, stop 2 x ATR, out at the close of i+HOLD
export function simulate(ds, i, side, mult = 1) {
  const sig = ds[i], last = i + HOLD;
  if (!(sig.atr > 0) || last >= ds.length) return null;
  const e = ds[i + 1], fill = e.open, risk = STOP_ATR * sig.atr, stop = fill - side * risk;
  let exit = null, how = null, j = i + 1;
  if (side > 0 ? e.low <= stop : e.high >= stop) { exit = stop; how = 'stop1'; }
  else for (j = i + 2; j <= last; j++) { const c = ds[j];
    if (side > 0 ? c.open <= stop : c.open >= stop) { exit = c.open; how = 'stop'; break; }
    if (side > 0 ? c.low <= stop : c.high >= stop) { exit = stop; how = 'stop'; break; }
    if (j === last) { exit = c.close; how = 'time'; break; } }
  const entryT = e.t, exitT = ds[j].t + D, gross = side * (exit - fill) / risk, nn = side > 0 ? nights(entryT, exitT) : 0;
  const cost = RT / risk, fin = side > 0 ? nn * FIN.xau.long * fill / risk : 0;
  return { i, exitDay: j, side, entryT, exitT, entry: fill, stop, risk, exit, how, nights: nn, gross, cost, fin,
    net: gross - mult * (cost + fin), net2: gross - 2 * (cost + fin) };
}
// the rule: one position at a time (a setup while a trade is open or its order is live is skipped)
export function runRule(ds, side) {
  const out = []; let free = 0;
  for (let i = WARM; i < ds.length - 1; i++) {
    if (i < free) continue; if (cross(ds, i) !== side) continue;
    const tr = simulate(ds, i, side); if (tr) { out.push(tr); free = tr.exitDay; }
  }
  return out;
}
// the baseline: the same order after every day, each its own trade
export function runBase(ds, side) {
  const out = []; for (let i = WARM; i < ds.length - 1; i++) { const tr = simulate(ds, i, side); if (tr) out.push(tr); } return out;
}

export const ymd = (t) => new Date(t * 1000).toISOString().slice(0, 10);
export const inWin = (T, [f, t]) => T.filter((x) => { const s = ymd(x.entryT); return s >= f && s <= t; });
export const mean = (T, k) => (T.length ? T.reduce((a, x) => a + x[k], 0) / T.length : 0);
export function monthT(T, [f, t], key) {
  const sums = new Map(); for (let y = +f.slice(0, 4), m = +f.slice(5, 7); `${y}-${String(m).padStart(2, '0')}` <= t.slice(0, 7); m === 12 ? (y++, m = 1) : m++) sums.set(`${y}-${String(m).padStart(2, '0')}`, 0);
  for (const x of T) { const k = ymd(x.exitT - 1).slice(0, 7); if (sums.has(k)) sums.set(k, sums.get(k) + x[key]); }
  const v = [...sums.values()], n = v.length, m = v.reduce((a, b) => a + b, 0) / n, sd = Math.sqrt(v.reduce((a, b) => a + (b - m) ** 2, 0) / (n - 1));
  return { months: n, t: sd ? m / (sd / Math.sqrt(n)) : 0 };
}
export const phi = (z) => 0.5 * (1 + erf(z / Math.SQRT2));
function erf(x) { const s = Math.sign(x); x = Math.abs(x); const t = 1 / (1 + 0.3275911 * x);
  return s * (1 - (((((1.061405429 * t - 1.453152027) * t) + 1.421413741) * t - 0.284496736) * t + 0.254829592) * t * Math.exp(-x * x)); }
export function holm(ps) { const o = ps.map((p, k) => [p, k]).sort((a, b) => a[0] - b[0]), adj = new Array(ps.length); let run = 0;
  o.forEach(([p, k], r) => { run = Math.max(run, Math.min(1, (ps.length - r) * p)); adj[k] = run; }); return adj; }
export function rng(seed) { let s = seed >>> 0; return () => { s = (s + 0x6D2B79F5) >>> 0; let t = s; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; }
const r3 = (v) => (v == null || !Number.isFinite(v) ? null : +v.toFixed(3)), r2 = (v) => (v == null || !Number.isFinite(v) ? null : +v.toFixed(2));

// adds x.ex (excess net) and x.ex2 (excess at 2x costs) against a window's baseline means
export function excess(T, b, b2) { return T.map((x) => ({ ...x, ex: x.net - b, ex2: x.net2 - b2 })); }
export function summary(T, w, key) {
  const n = T.length, mt = monthT(T, w, key), mg = monthT(T, w, 'gross');
  return { n, mean: r3(mean(T, key)), mean2x: r3(mean(T, key === 'ex' ? 'ex2' : 'net2')), gross: r3(mean(T, 'gross')), net: r3(mean(T, 'net')),
    cost: r3(mean(T, 'cost')), fin: r3(mean(T, 'fin')), total: r2(T.reduce((a, x) => a + x[key], 0)),
    win: n ? r2(T.filter((x) => x.net > 0).length / n * 100) : null, stops: T.filter((x) => x.how !== 'time').length,
    stopDay1: T.filter((x) => x.how === 'stop1').length, months: mt.months, t: r2(mt.t), tGross: r2(mg.t) };
}
// placebo: each real OOS trade -> the same order after a random day of the same year (no TRIX condition), same side
export function placebo(ds, real, side, key, base, seeds = 40) {
  const byYear = new Map(); for (let i = WARM; i < ds.length - HOLD - 1; i++) { const y = ymd(ds[i + 1].t).slice(0, 4); if (!byYear.has(y)) byYear.set(y, []); byYear.get(y).push(i); }
  const means = [];
  for (let s = 1; s <= seeds; s++) { const r = rng(7900 + s), v = [];
    for (const x of real) { const pool = byYear.get(ymd(x.entryT).slice(0, 4)) || []; let tr = null;
      for (let k = 0; k < 50 && !tr && pool.length; k++) tr = simulate(ds, pool[Math.floor(r() * pool.length)], side);
      if (tr) v.push(key === 'ex' ? tr.net - base : tr.net); }
    means.push(v.length ? v.reduce((a, b) => a + b, 0) / v.length : 0); }
  return means;
}

export function load(file) {
  const j = JSON.parse(fs.readFileSync(file, 'utf8'));
  const bars = j.rows.map(([time, open, high, low, close]) => ({ time, open, high, low, close }));
  return enrich(foldWeekend(bars).map((b) => ({ t: b.time, open: b.open, high: b.high, low: b.low, close: b.close })));
}

export const TESTS = {
  T1: { name: 'T1 long after a TRIX bull cross, excess over the same trade after every day', side: 1, key: 'ex' },
  T2: { name: 'T2 short after a TRIX bear cross, excess over the same trade after every day', side: -1, key: 'ex' },
  T3: { name: 'T3 long after a TRIX bull cross, absolute net R', side: 1, key: 'net' },
};

export function study(ds) {
  const out = { tests: {}, baseline: {} }, ps = [];
  const base = {}; for (const side of [1, -1]) { const all = runBase(ds, side); base[side] = {};
    for (const [w, win] of Object.entries(WIN)) { const T = inWin(all, win); base[side][w] = { n: T.length, net: mean(T, 'net'), net2: mean(T, 'net2'), gross: mean(T, 'gross') };
      out.baseline[`${side > 0 ? 'long' : 'short'}_${w}`] = { n: T.length, gross: r3(mean(T, 'gross')), net: r3(mean(T, 'net')), net2x: r3(mean(T, 'net2')), t: r2(monthT(T, win, 'net').t) }; } }
  for (const [k, test] of Object.entries(TESTS)) {
    const all = runRule(ds, test.side), res = {};
    for (const [w, win] of Object.entries(WIN)) res[w] = excess(inWin(all, win), base[test.side][w].net, base[test.side][w].net2);
    const so = summary(res.oos, WIN.oos, test.key), si = summary(res.is, WIN.is, test.key);
    const pl = placebo(ds, res.oos, test.side, test.key, base[test.side].oos.net), sorted = [...pl].sort((a, b) => a - b);
    const p = 1 - phi(so.t || 0); ps.push(p);
    const years = {}; for (const x of [...res.is, ...res.oos]) (years[ymd(x.entryT).slice(0, 4)] ||= []).push(x);
    out.tests[k] = { name: test.name, measure: test.key === 'ex' ? 'excess net R' : 'net R', oos: so, is: si, p: +p.toFixed(4),
      placebo: { beaten: pl.filter((m) => so.mean > m).length, of: pl.length, p5: r3(sorted[1]), median: r3(sorted[19]), p95: r3(sorted[37]) },
      years: Object.fromEntries(Object.entries(years).map(([y, T]) => [y, { n: T.length, mean: r3(mean(T, test.key)) }])) };
  }
  holm(ps).forEach((h, j) => { const x = Object.values(out.tests)[j]; x.holm = +h.toFixed(4);
    x.checks = { n: x.oos.n >= 60, oos: x.oos.mean > 0 && x.oos.t >= 2 && x.holm < 0.05, is: x.is.mean > 0, cost2x: x.oos.mean2x > 0, placebo: x.placebo.beaten >= 38 };
    x.pass = Object.values(x.checks).every(Boolean); });
  out.verdict = out.tests.T1.pass ? 'PASS' : 'FAIL';
  out.passAlone = ['T2', 'T3'].filter((k) => out.tests[k].pass);
  return out;
}

function main(dir) {
  const ds = load(path.join(dir, 'xau.json'));
  const res = study(ds);
  const out = { built: '2026-11-14', data: { src: 'council-data research/daily/xau.json (OANDA mid, UTC days), weekends folded (council/fills.mjs foldWeekend)', from: ymd(ds[0].t), to: ymd(ds.at(-1).t), days: ds.length },
    costs: { spread: SPREAD, slippagePerOrder: SLIP, roundTrip: RT, financing: { rate: FIN.xau.long, src: FIN.xau.src, side: 'longs only' } },
    rule: { trix: TRIX_N, signal: SIG_N, stopAtr: STOP_ATR, hold: HOLD, atr: ATR_N, warmup: WARM }, windows: WIN, ...res };
  fs.writeFileSync(new URL('./result.json', import.meta.url), JSON.stringify(out, null, 1) + '\n');
  console.log(JSON.stringify(out.baseline));
  for (const [k, x] of Object.entries(out.tests)) console.log(k, JSON.stringify({ oos: x.oos, is: x.is, holm: x.holm, placebo: x.placebo, checks: x.checks }));
  console.log(out.verdict, out.passAlone);
}
if (import.meta.url === `file://${process.argv[1]}`) main(process.argv[2]);
