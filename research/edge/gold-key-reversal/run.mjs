// The key reversal day and the outside reversal day on spot gold (PREREGISTRATION.md, pushed first).
//   node --use-env-proxy research/edge/gold-key-reversal/fetch.mjs <dir>   OANDA mid H1 gold (cache out of git)
//   node research/edge/gold-key-reversal/run.mjs <dir>                     the study -> result.json (+ prints a summary)
// Pure pieces are exported for the test.
import fs from 'node:fs';
import path from 'node:path';
import { days, nyDay } from '../gold-drd-long/run.mjs';
import { nights, FIN } from '../../../council/fills.mjs';

export const H = 3600;
export const SPREAD = 0.30, SLIP = SPREAD / 2, RT = SPREAD + 2 * SLIP;   // $0.60 a round trip
export const N = 20, ATR_N = 20, BUF = 0.30, FLOOR_ATR = 0.5, HOLD = 3;
export const WIN = { is: ['2008-01-01', '2016-12-31'], oos: ['2017-01-01', '2026-10-31'] };

// side of each signal on day i (-1 short, +1 long, 0 none); only data up to the close of day i is read
export function keyRev(ds, i) {
  if (i < N) return 0; let hh = -Infinity, ll = Infinity;
  for (let k = i - N; k < i; k++) { hh = Math.max(hh, ds[k].high); ll = Math.min(ll, ds[k].low); }
  const x = ds[i], p = ds[i - 1];
  if (x.high > hh && x.close < p.close) return -1;
  if (x.low < ll && x.close > p.close) return 1;
  return 0;
}
export function outsideRev(ds, i) {
  if (i < 1) return 0; const x = ds[i], p = ds[i - 1];
  if (!(x.high > p.high && x.low < p.low)) return 0;
  return x.close < p.close ? -1 : x.close > p.close ? 1 : 0;
}
export const TESTS = {
  T1: { name: 'T1 bearish key reversal at a 20-day high, short', sig: (ds, i) => (keyRev(ds, i) === -1 ? -1 : 0) },
  T2: { name: 'T2 bullish key reversal at a 20-day low, long', sig: (ds, i) => (keyRev(ds, i) === 1 ? 1 : 0) },
  T3: { name: 'T3 outside reversal day, both sides', sig: outsideRev },
};

export function enrich(ds) {
  const tr = ds.map((x, i) => (i ? Math.max(x.high, ds[i - 1].close) - Math.min(x.low, ds[i - 1].close) : null));
  return ds.map((x, i) => { let atr = null; if (i >= ATR_N) { let s = 0; for (let k = i - ATR_N + 1; k <= i; k++) s += tr[k]; atr = s / ATR_N; } return { ...x, atr }; });
}
export function dayIndex(h1) { const a = new Map(), b = new Map();
  h1.forEach((c, k) => { const d = nyDay(c.time); if (d == null) return; if (!a.has(d)) a.set(d, k); b.set(d, k); }); return { a, b }; }

// the pre-registered stop: beyond the signal day's extreme by $0.30, at least 0.5 x ATR(20) from the entry; null = skip
export function stopFor(sig, side, entry) {
  let stop = side < 0 ? sig.high + BUF : sig.low - BUF;
  if (side < 0 ? entry >= stop : entry <= stop) return null;
  if (Math.abs(stop - entry) < FLOOR_ATR * sig.atr) stop = entry - side * FLOOR_ATR * sig.atr;
  return stop;
}
// one trade from signal day i: entry at day i+1's first H1 open, held to day i+HOLD's close unless stopped on H1.
// riskAtr (placebo) = a stop distance in ATR units instead of the signal-day stop.
export function simulate(h1, idx, ds, i, side, riskAtr = null) {
  const sig = ds[i], last = i + HOLD;
  if (!(sig.atr > 0) || last >= ds.length) return null;
  const k0 = idx.a.get(ds[i + 1].d); if (k0 == null) return null;
  const entry = h1[k0].open, stop = riskAtr == null ? stopFor(sig, side, entry) : entry - side * riskAtr * sig.atr;
  if (stop == null) return null;
  const risk = Math.abs(entry - stop);
  let exit = null, exitT = null, how = null, j = i + 1;
  for (; j <= last; j++) {
    const ka = idx.a.get(ds[j].d), kb = idx.b.get(ds[j].d);
    for (let k = j === i + 1 ? k0 : ka; k <= kb; k++) { const c = h1[k];
      if (side > 0 ? c.low <= stop : c.high >= stop) { exit = side > 0 ? Math.min(c.open, stop) : Math.max(c.open, stop); exitT = c.time + H; how = 'stop'; break; } }
    if (exit != null) break;
    if (j === last) { exit = ds[j].close; exitT = h1[kb].time + H; how = 'time'; break; }
  }
  const entryT = h1[k0].time, gross = side * (exit - entry) / risk, nn = side > 0 ? nights(entryT, exitT) : 0;
  const cost = RT / risk, fin = side > 0 ? nn * FIN.xau.long * entry / risk : 0;
  return { i, exitDay: j, side, entryT, exitT, entry, stop, risk, riskAtr: risk / sig.atr, exit, how, nights: nn, gross, cost, fin, net: gross - cost - fin, net2: gross - 2 * cost - 2 * fin };
}
export function runTest(h1, idx, ds, test) {
  const out = []; let free = 0;
  for (let i = ATR_N; i < ds.length - 1; i++) {
    if (i < free) continue; const side = test.sig(ds, i); if (!side) continue;
    const tr = simulate(h1, idx, ds, i, side); if (!tr) continue;
    out.push(tr); free = tr.exitDay;
  }
  return out;
}

export const ymd = (t) => new Date(t * 1000).toISOString().slice(0, 10);
export const inWin = (T, [f, t]) => T.filter((x) => { const s = ymd(x.entryT); return s >= f && s <= t; });
export function monthT(T, [f, t], key = 'net') {
  const sums = new Map(); for (let y = +f.slice(0, 4), m = +f.slice(5, 7); `${y}-${String(m).padStart(2, '0')}` <= t.slice(0, 7); m === 12 ? (y++, m = 1) : m++) sums.set(`${y}-${String(m).padStart(2, '0')}`, 0);
  for (const x of T) { const k = ymd(x.exitT).slice(0, 7); if (sums.has(k)) sums.set(k, sums.get(k) + x[key]); }
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
export function summary(T, w) {
  const n = T.length, mean = (k) => (n ? T.reduce((a, x) => a + x[k], 0) / n : null), mt = monthT(T, w), m2 = monthT(T, w, 'gross');
  let eq = 0, pk = 0, dd = 0; for (const x of T) { eq += x.net; pk = Math.max(pk, eq); dd = Math.min(dd, eq - pk); }
  return { n, gross: r3(mean('gross')), net: r3(mean('net')), net2x: r3(mean('net2')), cost: r3(mean('cost')), fin: r3(mean('fin')),
    total: r2(T.reduce((a, x) => a + x.net, 0)), win: n ? r2(T.filter((x) => x.net > 0).length / n * 100) : null,
    stops: T.filter((x) => x.how === 'stop').length, riskAtr: r2(mean('riskAtr')), longs: T.filter((x) => x.side > 0).length,
    months: mt.months, t: r2(mt.t), tGross: r2(m2.t), dd: r2(dd) };
}
// placebo: each real OOS trade -> a random trading day of the same year, same side, same stop in ATR units, held HOLD days
export function placebo(h1, idx, ds, real, seeds = 40) {
  const byYear = new Map(); for (let e = ATR_N + 1; e < ds.length - HOLD; e++) { const y = ymd(ds[e].t).slice(0, 4); if (!byYear.has(y)) byYear.set(y, []); byYear.get(y).push(e); }
  const means = [];
  for (let s = 1; s <= seeds; s++) { const r = rng(2000 + s), T = [];
    for (const x of real) { const pool = byYear.get(ymd(x.entryT).slice(0, 4)); let tr = null;
      for (let k = 0; k < 20 && !tr; k++) { const e = pool[Math.floor(r() * pool.length)]; tr = simulate(h1, idx, ds, e - 1, x.side, x.riskAtr); }
      if (tr) T.push(tr.net); }
    means.push(T.length ? T.reduce((a, b) => a + b, 0) / T.length : 0); }
  return means;
}
// before costs: move in the reversal direction from the next open to the close of day i+h, % of price
export function forward(ds, w, sigFn) {
  const out = {};
  for (let h = 1; h <= 5; h++) { const v = [], all = [];
    for (let i = N; i < ds.length - h; i++) { const s = ymd(ds[i + 1].t); if (s < w[0] || s > w[1]) continue;
      const mv = (ds[i + h].close / ds[i + 1].open - 1) * 100; all.push(mv); const side = sigFn(ds, i); if (side) v.push(side * mv); }
    const m = (a) => (a.length ? +(a.reduce((p, q) => p + q, 0) / a.length).toFixed(3) : null);
    const sd = v.length > 1 ? Math.sqrt(v.reduce((a, b) => a + (b - m(v)) ** 2, 0) / (v.length - 1)) : null;
    out[h] = { n: v.length, mean: m(v), t: sd ? +(m(v) / (sd / Math.sqrt(v.length))).toFixed(2) : null, everyDayUp: m(all) };
  }
  return out;
}

function main(dir) {
  const h1 = JSON.parse(fs.readFileSync(path.join(dir, 'xau-h1.json'), 'utf8')).map(([time, open, high, low, close]) => ({ time, open, high, low, close }));
  const ds = enrich(days(h1)), idx = dayIndex(h1);
  const out = { built: '2026-11-14', data: { src: 'OANDA mid H1 XAU_USD via the site proxy (fetch.mjs), 17:00 New York days (gold-drd-long days())', from: ymd(ds[0].t), to: ymd(ds.at(-1).t), days: ds.length, h1: h1.length },
    costs: { spread: SPREAD, slippagePerOrder: SLIP, roundTrip: RT, financing: { rate: FIN.xau.long, src: FIN.xau.src, side: 'longs only' } },
    rule: { N, buffer: BUF, floorAtr: FLOOR_ATR, hold: HOLD }, windows: WIN, tests: {} };
  const ps = [];
  for (const [k, test] of Object.entries(TESTS)) {
    const all = runTest(h1, idx, ds, test), oos = inWin(all, WIN.oos), is = inWin(all, WIN.is);
    const so = summary(oos, WIN.oos), si = summary(is, WIN.is), pl = placebo(h1, idx, ds, oos), sorted = [...pl].sort((a, b) => a - b);
    const beaten = pl.filter((m) => so.net > m).length, p = 1 - phi(so.t || 0); ps.push(p);
    const years = {}; for (const x of all) { const y = ymd(x.entryT).slice(0, 4); (years[y] ||= []).push(x); }
    out.tests[k] = { name: test.name, oos: so, is: si, p: +p.toFixed(4),
      placebo: { beaten, of: pl.length, p5: r3(sorted[1]), median: r3(sorted[19]), p95: r3(sorted[37]), mean: r3(pl.reduce((a, b) => a + b, 0) / pl.length) },
      forward: { oos: forward(ds, WIN.oos, test.sig), is: forward(ds, WIN.is, test.sig) },
      years: Object.fromEntries(Object.entries(years).filter(([y]) => y >= '2008').map(([y, T]) => [y, { n: T.length, net: r3(T.reduce((a, x) => a + x.net, 0) / T.length) }])) };
  }
  holm(ps).forEach((h, j) => { const x = Object.values(out.tests)[j]; x.holm = +h.toFixed(4);
    x.checks = { n: x.oos.n >= 60, oos: x.oos.net > 0 && x.oos.t >= 2 && x.holm < 0.05, is: x.is.net > 0, cost2x: x.oos.net2x > 0, placebo: x.placebo.beaten >= 38 };
    x.pass = Object.values(x.checks).every(Boolean); });
  out.verdict = out.tests.T1.pass ? 'PASS' : 'FAIL';
  out.passAlone = ['T2', 'T3'].filter((k) => out.tests[k].pass);
  fs.writeFileSync(new URL('./result.json', import.meta.url), JSON.stringify(out, null, 1) + '\n');
  for (const [k, x] of Object.entries(out.tests)) console.log(k, JSON.stringify({ oos: x.oos, is: x.is, holm: x.holm, placebo: x.placebo, checks: x.checks, fwdOos: x.forward.oos, fwdIs: x.forward.is }));
}
if (import.meta.url === `file://${process.argv[1]}`) main(process.argv[2]);
