// Gold against its quarter-to-date move in the last days of a quarter (PREREGISTRATION.md, pushed first). A calendar study of
// its own: no book rule is read or touched. Paper only.
//   node research/edge/gold-quarter-end/run.mjs <xau-h1.json>
//     daily: council-data research/daily/xau.json (git show, no network, no cache written)
//     H1:    [[t, o, h, l, c], ...] OANDA mid XAU/USD, kept outside git (stops only)
//   -> result.json, prints the tables. Pure pieces are exported for the test.
import fs from 'node:fs';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { foldWeekend, nights, FIN, stopFill } from '../../../council/fills.mjs';

export const COST = 0.60, ATR_N = 20, ATR_K = 1.5, HOLD = 4, SEED = 20261114, SEEDS = 40, BEAT = 38, MED_N = 8;
export const IS = ['2007-01', '2016-12'], OOS = ['2017-01', '2026-09'];
const DAY = 86400;
export const dateOf = (t) => new Date(t * 1000).toISOString().slice(0, 10);
const mkOf = (t) => dateOf(t).slice(0, 7);
const isQ = (mk) => ['03', '06', '09', '12'].includes(mk.slice(5, 7));

// daily rows [t,o,h,l,c,(v)] and H1 rows [t,o,h,l,c] -> folded daily bars and H1 bars sorted by time
export function prepare(rows, h1 = []) {
  const bars = foldWeekend(rows.map(([time, open, high, low, close]) => ({ time, open, high, low, close })));
  const H = h1.map(([time, open, high, low, close]) => ({ time, open, high, low, close })).sort((a, b) => a.time - b.time);
  return { bars, h1: H };
}
// index of each month's last trading day (last folded candle dated in that month), keyed 'YYYY-MM'; the file's last month has none
export function monthEnds(bars) {
  const out = new Map();
  for (let i = 0; i + 1 < bars.length; i++) { const mk = mkOf(bars[i].time); if (mkOf(bars[i + 1].time) !== mk) out.set(mk, i); }
  return out;
}
// first H1 index with time >= t (binary search)
function lower(H, t) { let a = 0, b = H.length; while (a < b) { const m = (a + b) >> 1; if (H[m].time < t) a = m + 1; else b = m; } return a; }
export function atrAt(bars, i) {
  if (i < ATR_N) return null;
  let tr = 0;
  for (let k = i - ATR_N + 1; k <= i; k++) { const x = bars[k], pc = bars[k - 1].close; tr += Math.max(x.high - x.low, Math.abs(x.high - pc), Math.abs(x.low - pc)); }
  return tr / ATR_N;
}
// one trade: enter at the close of daily candle i, out at the close of candle j or at the stop (checked on H1 candles from the
// start of the UTC day after candle i to the end of candle j's UTC day; daily candles when H1 has none there).
export function trade(P, i, j, side, { cost = COST, finMult = 1 } = {}) {
  const { bars, h1 } = P;
  if (i == null || j == null || !(j > i) || j >= bars.length) return null;
  const atr = atrAt(bars, i); if (!(atr > 0)) return null;
  const entry = bars[i].close, risk = ATR_K * atr, stop = entry - side * risk;
  const t0 = bars[i].time + DAY, t1 = bars[j].time + DAY;
  let exit = bars[j].close, how = 'time', tOut = t1, src = 'h1';
  const a = lower(h1, t0), b = lower(h1, t1);
  const path = b > a ? h1.slice(a, b) : (src = 'daily', bars.slice(i + 1, j + 1));
  for (const x of path) {
    if (side > 0 ? x.low <= stop : x.high >= stop) { exit = stopFill(x, side < 0, stop, true); how = 'stop'; tOut = x.time + (src === 'h1' ? 3600 : DAY); break; }
  }
  const R = side * (exit - entry) / risk, nn = side > 0 ? nights(t0 - 3600, tOut) : 0;   // entry close = end of candle i's UTC day, after its 22:00 rollover
  const fin = finMult * nn * FIN.xau.long * entry / risk;
  return { a: dateOf(bars[i].time), b: dateOf(bars[j].time), side, entry, stop, risk, exit, how, src, nights: nn, R, fin,
    net: R - cost / risk - fin, net2: R - 2 * cost / risk - 2 * fin };
}
// period-to-date return at the close of candle i, from the close of candle p (the previous period's TD-1)
export const ptd = (bars, p, i) => bars[i].close / bars[p].close - 1;
// side rule: against the period-to-date move
export const sideOf = (q) => q > 0 ? -1 : q < 0 ? 1 : 0;

// events: quarter ends (kind 'q') or non-quarter month ends (kind 'm'), each with entry i = TD-5, exit j = TD-1, the previous
// period's TD-1 index p and q. Quarter-to-date runs from the previous QUARTER end; month-to-date from the previous month end.
export function events(P, kind) {
  const E = [...monthEnds(P.bars)].sort((x, y) => x[1] - y[1]), out = [];
  let prevQ = null, prevM = null;
  for (const [mk, e] of E) {
    const q = isQ(mk), p = kind === 'q' ? prevQ : prevM;
    if ((kind === 'q') === q && p != null) {
      const i = e - HOLD;
      if (i > p) { const r = ptd(P.bars, p, i); out.push({ mk, i, j: e, p, q: r, side: sideOf(r) }); }
    }
    prevM = e; if (q) prevQ = e;
  }
  return out;
}
// T3 filter: |q| above the median |q| of the 8 previous quarter events (past only)
export function largeOnly(qev) {
  const out = [];
  qev.forEach((e, k) => {
    if (k < MED_N) return;
    const v = qev.slice(k - MED_N, k).map((x) => Math.abs(x.q)).sort((a, b) => a - b), med = (v[3] + v[4]) / 2;
    if (Math.abs(e.q) > med) out.push({ ...e, med });
  });
  return out;
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
// t on calendar-month sums (trades grouped by the month of their entry)
export function monthT(T, key = 'net') {
  const by = new Map(); for (const x of T) { const k = x.a.slice(0, 7); by.set(k, (by.get(k) || 0) + x[key]); }
  const v = [...by.values()], n = v.length; if (n < 3) return { months: n, t: null, p: null };
  const sd = sdOf(v), t = sd ? mean(v) / (sd / Math.sqrt(n)) : 0;
  return { months: n, t, p: pUpper(t, n - 1) };
}
const inW = (mk, w) => mk >= w[0] && mk <= w[1];
const r3 = (x) => x == null ? null : +x.toFixed(3), r2 = (x) => x == null ? null : +x.toFixed(2), r4 = (x) => x == null ? null : +x.toFixed(4);
export function summary(T) {
  if (!T.length) return { n: 0 };
  const mt = monthT(T), mg = monthT(T, 'R'), m2 = monthT(T, 'net2');
  const sub = (s) => { const x = T.filter((y) => y.side === s); return x.length ? { n: x.length, net: r3(mean(x.map((y) => y.net))), t: r2(monthT(x).t) } : { n: 0 }; };
  return { n: T.length, net: r3(mean(T.map((x) => x.net))), gross: r3(mean(T.map((x) => x.R))), net2: r3(mean(T.map((x) => x.net2))),
    tNet: r2(mt.t), tGross: r2(mg.t), tNet2: r2(m2.t), p: r4(mt.p), months: mt.months,
    win: r2(100 * T.filter((x) => x.net > 0).length / T.length), stops: T.filter((x) => x.how === 'stop').length,
    total: r2(T.reduce((s, x) => s + x.net, 0)), buys: sub(1), sells: sub(-1), dailyStops: T.filter((x) => x.src === 'daily').length };
}
// placebo: each event -> a window of the same length whose entry is a random candle of the same period (after its first candle,
// ending at least 5 candles before the event's entry), side from the rule at that entry; statistic = mean net R
export function placebo(P, evs, seeds = SEEDS, seed = SEED) {
  const out = [];
  for (let s = 0; s < seeds; s++) {
    const rng = mulberry32(seed + s), got = [];
    for (const e of evs) {
      const lo = e.p + 1, hi = e.i - HOLD - 1;            // entry k with k + HOLD <= e.i - 1
      if (hi < lo) continue;
      const k = lo + Math.floor(rng() * (hi - lo + 1)), side = sideOf(ptd(P.bars, e.p, k));
      if (!side) continue;
      const t = trade(P, k, k + HOLD, side); if (t) got.push(t.net);
    }
    out.push(mean(got));
  }
  return out;
}

export function run(P) {
  const qev = events(P, 'q'), mev = events(P, 'm');
  const sets = { T1: qev, T2: mev, T3: largeOnly(qev) };
  const res = {}, trades = {};
  for (const [k, evs] of Object.entries(sets)) {
    const T = [];
    for (const e of evs) { if (!e.side) continue; const t = trade(P, e.i, e.j, e.side); if (t) T.push({ ...t, q: r4(e.q), mk: e.mk }); }
    trades[k] = T;
    const tis = T.filter((x) => inW(x.a.slice(0, 7), IS)), too = T.filter((x) => inW(x.a.slice(0, 7), OOS));
    const by = {}; for (const x of T) { const y = x.a.slice(0, 4); (by[y] ||= []).push(x.net); }
    const oosEv = evs.filter((e) => e.side && inW(P.bars[e.i] ? mkOf(P.bars[e.i].time) : '', OOS));
    const pl = placebo(P, oosEv), om = too.length ? mean(too.map((x) => x.net)) : null;
    const sp = [...pl].sort((a, b) => a - b);
    res[k] = { IS: summary(tis), OOS: summary(too),
      byYear: Object.fromEntries(Object.entries(by).map(([y, v]) => [y, { n: v.length, net: r3(mean(v)), total: r2(v.reduce((a, b) => a + b, 0)) }])),
      placebo: { beaten: pl.filter((x) => om > x).length, of: pl.length, median: r3(sp[Math.floor(sp.length / 2)]), p95: r3(sp[Math.floor(sp.length * 0.95)]) } };
  }
  const keys = Object.keys(res), ps = keys.map((k) => res[k].OOS.p ?? 1), hp = holm(ps);
  keys.forEach((k, n) => {
    const r = res[k]; r.holm = r4(hp[n]);
    r.checks = { oosT: (r.OOS.net > 0) && r.OOS.tNet >= 2, holm: hp[n] < 0.05, isSign: r.IS.net > 0, cost2x: r.OOS.net2 > 0, placebo: r.placebo.beaten >= BEAT };
    r.pass = Object.values(r.checks).every(Boolean);
  });
  return { res, trades };
}

// parity: the last H1 close of each UTC day against the daily close (same feed, same mid)
export function parity(P) {
  const byDay = new Map(); for (const x of P.h1) byDay.set(Math.floor(x.time / DAY) * DAY, x.close);
  let n = 0, same = 0, worst = 0;
  for (const b of P.bars) { const c = byDay.get(b.time); if (c == null) continue; n++; const d = Math.abs(c - b.close); if (d < 0.02) same++; worst = Math.max(worst, d); }
  return { days: n, within2c: same, worst: r2(worst) };
}

const here = path.dirname(fileURLToPath(import.meta.url));
if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const h1File = process.argv[2]; if (!h1File) { console.error('usage: run.mjs <xau-h1.json>'); process.exit(2); }
  const daily = JSON.parse(execFileSync('git', ['show', 'origin/council-data:research/daily/xau.json'], { maxBuffer: 1 << 28, cwd: here }).toString());
  const P = prepare(daily.rows, JSON.parse(fs.readFileSync(h1File, 'utf8')));
  const { res, trades } = run(P);
  const out = { study: 'gold-quarter-end', built: '2026-11-14', verdict: res.T1.pass ? 'PASS' : 'FAIL', passed: Object.keys(res).filter((k) => res[k].pass),
    data: { daily: 'council-data research/daily/xau.json (OANDA mid, UTC days, weekends folded)', dailyFrom: dateOf(P.bars[0].time), dailyTo: dateOf(P.bars.at(-1).time),
      h1From: dateOf(P.h1[0].time), h1To: dateOf(P.h1.at(-1).time), h1Bars: P.h1.length, parity: parity(P) },
    rules: { IS, OOS, COST, ATR_N, ATR_K, HOLD, MED_N, fin: FIN.xau.long, seeds: SEEDS, seed: SEED, beat: BEAT },
    results: res, trades };
  fs.writeFileSync(path.join(here, 'result.json'), JSON.stringify(out, null, 1) + '\n');
  for (const [k, r] of Object.entries(res)) {
    console.log(k, 'IS', JSON.stringify(r.IS)); console.log(k, 'OOS', JSON.stringify(r.OOS));
    console.log(k, 'placebo', JSON.stringify(r.placebo), 'holm', r.holm, 'checks', JSON.stringify(r.checks), 'pass', r.pass);
  }
  console.log('parity', JSON.stringify(out.data.parity));
}
