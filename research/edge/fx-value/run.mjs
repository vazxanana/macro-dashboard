// Forex "value" as a five-year cross-sectional reversal, monthly rebalance (pre-registered 14 Nov 2026, PREREGISTRATION.md).
// Rank the 7 G10 currencies against USD by minus their 60-month return (variant: skip the latest 12 months) on each month's
// last trading day, buy the 2 cheapest and sell the 2 dearest at the next open, 1R = stop = 3 x ATR(20), hold to the next
// month-end close; net of the measured raw-spread cost model and a flat 0.004 % a night financing. Paper research only.
// The loader, calendar, ATR, stop, leg simulation, costs, statistics, Holm and placebo are copied from
// research/edge/fx-xs-momentum/run.mjs (branch fx-xs-momentum, not on main), unchanged except the signal and the cost scale.
import fs from 'node:fs';
import { execFileSync } from 'node:child_process';
import { foldWeekend, nights } from '../../../council/fills.mjs';

export const PAIRS = [
  { key: 'eurusd', ccy: 'EUR', inv: false, pip: 0.0001 },
  { key: 'gbpusd', ccy: 'GBP', inv: false, pip: 0.0001 },
  { key: 'audusd', ccy: 'AUD', inv: false, pip: 0.0001 },
  { key: 'nzdusd', ccy: 'NZD', inv: false, pip: 0.0001 },
  { key: 'usdcad', ccy: 'CAD', inv: true, pip: 0.0001 },
  { key: 'usdchf', ccy: 'CHF', inv: true, pip: 0.0001 },
  { key: 'usdjpy', ccy: 'JPY', inv: true, pip: 0.01 },
];
export const P = { LOOK: 60, SKIP: 12, ATR_N: 20, ATR_MULT: 3, TOP: 2, SPREAD_PIP: 0.3, SLIP_PIP_SIDE: 0.5, COMM_SIDE: 22.5e-6, FIN_NIGHT: 0.00004, SEEDS: 40 };
const DAY = 86400;
export const IS = { from: '2007-10', to: '2014-12' }, OOS = { from: '2015-01', to: '9999-12' };
export const SIGNALS = { primary: { skip: 0, name: '60-month return, no skip' }, skip12: { skip: P.SKIP, name: '60 to 12 months ago (skip the latest year)' } };

// ─── the series ───
export function invertBar(b) { return { time: b.time, open: 1 / b.open, high: 1 / b.low, low: 1 / b.high, close: 1 / b.close }; }
export function expressed(bars, inv) { return inv ? bars.map(invertBar) : bars.map((b) => ({ time: b.time, open: b.open, high: b.high, low: b.low, close: b.close })); }
export const rowsToBars = (rows) => rows.map(([time, open, high, low, close]) => ({ time, open, high, low, close }));
export function align(series) {
  const sets = series.map((s) => new Map(s.x.map((b, i) => [b.time, i])));
  const times = series[0].x.map((b) => b.time).filter((t) => sets.every((m) => m.has(t)));
  const X = {}, Q = {};
  series.forEach((s, k) => { X[s.ccy] = times.map((t) => s.x[sets[k].get(t)]); Q[s.ccy] = times.map((t) => s.q[sets[k].get(t)]); });
  return { times, X, Q };
}
export const ym = (t) => new Date(t * 1000).toISOString().slice(0, 7);
export function monthEnds(times) { const out = []; for (let i = 0; i < times.length; i++) if (i === times.length - 1 || ym(times[i + 1]) !== ym(times[i])) out.push(i); return out; }

// ─── the signal: closes at month-ends only, up to and including ends[m] ───
// value = -(close(ends[m - skip]) / close(ends[m - LOOK]) - 1); null when the history is too short
export function valueSignal(bars, ends, m, skip = 0, look = P.LOOK) {
  if (m - look < 0) return null;
  return -(bars[ends[m - skip]].close / bars[ends[m - look]].close - 1);
}
// cheapest (highest value signal) first; ties by the list order
export function rankValue(X, ccys, ends, m, skip = 0, look = P.LOOK) {
  const r = ccys.map((c, k) => ({ c, k, v: valueSignal(X[c], ends, m, skip, look) }));
  if (r.some((x) => x.v == null || !Number.isFinite(x.v))) return null;
  return r.sort((a, b) => b.v - a.v || a.k - b.k).map((x) => x.c);
}
export const value = (ranked) => ({ long: ranked.slice(0, P.TOP), short: ranked.slice(-P.TOP) });
export function atr(bars, d, n = P.ATR_N) {
  if (d - n < 0) return null;
  let s = 0;
  for (let i = d - n + 1; i <= d; i++) { const b = bars[i], pc = bars[i - 1].close; s += Math.max(b.high - b.low, Math.abs(b.high - pc), Math.abs(b.low - pc)); }
  return s / n;
}

// ─── one leg ───
export function simLeg(bars, e, x, side, dist) {
  const entry = bars[e].open, stop = side > 0 ? entry - dist : entry + dist;
  for (let i = e; i <= x; i++) {
    const b = bars[i];
    if (side > 0 && b.low <= stop) { const gap = i > e && b.open <= stop; return { entry, stop, exit: gap ? b.open : stop, exitIdx: i, how: gap ? 'gap' : 'stop' }; }
    if (side < 0 && b.high >= stop) { const gap = i > e && b.open >= stop; return { entry, stop, exit: gap ? b.open : stop, exitIdx: i, how: gap ? 'gap' : 'stop' }; }
  }
  return { entry, stop, exit: bars[x].close, exitIdx: x, how: 'close' };
}
export function costFrac(pairPx, pip) { return ((P.SPREAD_PIP + 2 * P.SLIP_PIP_SIDE) * pip) / pairPx + 2 * P.COMM_SIDE; }
export function exitTime(t, how) { return how === 'close' ? t + DAY : how === 'gap' ? t : t + DAY / 2; }
export function legResult(X, Q, pair, e, x, side, dist, times) {
  const L = simLeg(X[pair.ccy], e, x, side, dist);
  const gross = (side * (L.exit - L.entry)) / dist;
  const costR = (costFrac(Q[pair.ccy][e].open, pair.pip) * L.entry) / dist;
  const n = nights(times[e], exitTime(times[L.exitIdx], L.how));
  const finR = (n * P.FIN_NIGHT * L.entry) / dist;
  return { ccy: pair.ccy, side, gross, costR, finR, nights: n, net: gross - costR - finR, net2x: gross - 2 * costR - 2 * finR, how: L.how };
}

// ─── the book: pick(ranked, m) -> { long, short } ───
export function runBook(D, skip, pick) {
  const ends = monthEnds(D.times), months = [];
  const byCcy = Object.fromEntries(PAIRS.map((p) => [p.ccy, p]));
  for (let m = 0; m + 1 < ends.length; m++) {
    const d = ends[m], e = d + 1, x = ends[m + 1];
    const ranked = rankValue(D.X, PAIRS.map((p) => p.ccy), ends, m, skip);
    if (!ranked) continue;
    const pk = pick(ranked, m), legs = [];
    for (const [cs, side] of [[pk.long, 1], [pk.short, -1]]) for (const c of cs) {
      const a = atr(D.X[c], d); if (!a) continue;
      legs.push(legResult(D.X, D.Q, byCcy[c], e, x, side, P.ATR_MULT * a, D.times));
    }
    const sum = (k) => legs.reduce((s, l) => s + l[k], 0);
    months.push({ month: ym(D.times[e]), long: pk.long, short: pk.short, legs, net: sum('net'), net2x: sum('net2x'), gross: sum('gross'), noFin: sum('gross') - sum('costR') });
  }
  return months;
}

// ─── statistics (copied) ───
export function stats(vals) {
  const n = vals.length; if (!n) return { n: 0 };
  const mean = vals.reduce((a, b) => a + b, 0) / n;
  const sd = n > 1 ? Math.sqrt(vals.reduce((a, b) => a + (b - mean) ** 2, 0) / (n - 1)) : 0;
  let cum = 0, peak = 0, dd = 0; for (const v of vals) { cum += v; peak = Math.max(peak, cum); dd = Math.min(dd, cum - peak); }
  const r = (v, k = 3) => +v.toFixed(k);
  return { n, mean: r(mean), total: r(cum, 2), t: sd ? r((mean / sd) * Math.sqrt(n), 2) : 0, sharpe: sd ? r((mean / sd) * Math.sqrt(12), 2) : 0, dd: r(dd, 2), pos: r((vals.filter((v) => v > 0).length / n) * 100, 1) };
}
export const inWin = (w) => (m) => m.month >= w.from && m.month <= w.to;
export function pOneSided(t) {
  const z = Math.abs(t), k = 1 / (1 + 0.2316419 * z), d = Math.exp(-z * z / 2) / Math.sqrt(2 * Math.PI);
  const up = d * k * (0.31938153 + k * (-0.356563782 + k * (1.781477937 + k * (-1.821255978 + k * 1.330274429))));
  return t >= 0 ? up : 1 - up;
}
export function holm(ps) {
  const order = ps.map((p, i) => ({ p, i })).sort((a, b) => a.p - b.p), adj = Array(ps.length);
  let prev = 0;
  order.forEach((o, j) => { prev = Math.max(prev, Math.min(1, (ps.length - j) * o.p)); adj[o.i] = prev; });
  return adj;
}
export function percentile(vals, q) {
  const s = [...vals].sort((a, b) => a - b), h = (s.length - 1) * q, lo = Math.floor(h);
  return lo + 1 < s.length ? s[lo] + (h - lo) * (s[lo + 1] - s[lo]) : s[lo];
}
export function mulberry32(seed) { let a = seed >>> 0; return () => { a = (a + 0x6d2b79f5) >>> 0; let t = a; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; }
export function randomPick(rng) {
  return () => { const c = PAIRS.map((p) => p.ccy); for (let i = c.length - 1; i > 0; i--) { const j = Math.floor(rng() * (i + 1)); [c[i], c[j]] = [c[j], c[i]]; } return { long: c.slice(0, 2), short: c.slice(2, 4) }; };
}
function legStats(months) {
  const legs = months.flatMap((m) => m.legs), n = legs.length;
  return { n, win: +((legs.filter((l) => l.net > 0).length / n) * 100).toFixed(1), stopped: +((legs.filter((l) => l.how !== 'close').length / n) * 100).toFixed(1), gaps: legs.filter((l) => l.how === 'gap').length, avgNet: +(legs.reduce((s, l) => s + l.net, 0) / n).toFixed(3), avgGross: +(legs.reduce((s, l) => s + l.gross, 0) / n).toFixed(3), avgCost: +(legs.reduce((s, l) => s + l.costR, 0) / n).toFixed(3), avgFin: +(legs.reduce((s, l) => s + l.finR, 0) / n).toFixed(3) };
}
function summary(months) {
  const out = {};
  for (const [name, w] of [['oos', OOS], ['is', IS]]) {
    const ms = months.filter(inWin(w));
    out[name] = { from: ms[0]?.month, to: ms.at(-1)?.month, net: stats(ms.map((m) => m.net)), net2x: stats(ms.map((m) => m.net2x)), gross: stats(ms.map((m) => m.gross)), noFinancing: stats(ms.map((m) => m.noFin)), legs: legStats(ms) };
  }
  return out;
}

// ─── data ───
export function loadSeries(read) {
  return PAIRS.map((p) => { const q = foldWeekend(rowsToBars(JSON.parse(read(p.key)).rows)); return { ccy: p.ccy, q, x: expressed(q, p.inv) }; });
}
const gitRead = (k) => execFileSync('git', ['show', `origin/council-data:research/daily/${k}.json`], { encoding: 'utf8', maxBuffer: 64 << 20 });

export function main(read = gitRead) {
  const series = loadSeries(read), D = align(series);
  const last = D.times.at(-1), lastMonthDone = ym(last + DAY) !== ym(last);
  const clip = (ms) => ms.filter((m) => lastMonthDone || m.month !== ym(last));
  const res = { built: '2026-11-14', data: { from: new Date(D.times[0] * 1000).toISOString().slice(0, 10), to: new Date(last * 1000).toISOString().slice(0, 10), days: D.times.length, src: 'council-data research/daily (OANDA mid, UTC daily), weekend stubs folded' }, params: P, windows: { is: IS, oos: OOS }, signals: {} };
  const books = {};
  for (const [k, S] of Object.entries(SIGNALS)) {
    books[k] = clip(runBook(D, S.skip, value));
    const s = summary(books[k]);
    const years = {}; for (const m of books[k]) { const y = m.month.slice(0, 4); years[y] = +((years[y] || 0) + m.net).toFixed(2); }
    const picks = {}; for (const m of books[k].filter(inWin(OOS))) { for (const c of m.long) (picks[c] ||= { long: 0, short: 0 }).long++; for (const c of m.short) (picks[c] ||= { long: 0, short: 0 }).short++; }
    res.signals[k] = { name: S.name, skip: S.skip, ...s, years, picksOOS: picks };
  }
  // placebo: 40 seeded random books on the same months
  const plT = [], plMean = [];
  for (let seed = 1; seed <= P.SEEDS; seed++) {
    const ms = clip(runBook(D, 0, randomPick(mulberry32(seed)))).filter(inWin(OOS)), st = stats(ms.map((m) => m.net));
    plT.push(st.t); plMean.push(st.mean);
  }
  res.placebo = { seeds: P.SEEDS, t: { p5: +percentile(plT, 0.05).toFixed(2), p50: +percentile(plT, 0.5).toFixed(2), p95: +percentile(plT, 0.95).toFixed(2) }, mean: { p5: +percentile(plMean, 0.05).toFixed(3), p50: +percentile(plMean, 0.5).toFixed(3), p95: +percentile(plMean, 0.95).toFixed(3) }, tAll: plT };
  const keys = Object.keys(SIGNALS), ps = keys.map((k) => pOneSided(res.signals[k].oos.net.t)), adj = holm(ps);
  keys.forEach((k, i) => {
    const L = res.signals[k];
    L.placeboBeaten = plT.filter((t) => L.oos.net.t > t).length;
    L.checks = { oosPositive: L.oos.net.mean > 0, oosT2: L.oos.net.t >= 2, isPositive: L.is.net.mean > 0, oos2xPositive: L.oos.net2x.mean > 0, holm: adj[i] <= 0.05, placebo: L.oos.net.t > res.placebo.t.p95 };
    L.pOneSided = +ps[i].toFixed(4); L.pHolm = +adj[i].toFixed(4);
    L.pass = Object.values(L.checks).every(Boolean);
  });
  res.verdict = res.signals.primary.pass ? 'PASS' : res.signals.skip12.pass ? 'PASS (skip variant only)' : 'FAIL';
  return res;
}

if (process.argv[1] && import.meta.url === new URL(`file://${process.argv[1]}`).href) {
  const r = main();
  fs.writeFileSync(new URL('./result.json', import.meta.url), JSON.stringify(r, null, 1) + '\n');
  for (const k of Object.keys(SIGNALS)) { const L = r.signals[k]; console.log(k, JSON.stringify({ oos: L.oos.net, oos2x: L.oos.net2x, oosG: L.oos.gross, oosNoFin: L.oos.noFinancing, is: L.is.net, isG: L.is.gross, legs: L.oos.legs, isLegs: L.is.legs, checks: L.checks, p: L.pHolm, beaten: L.placeboBeaten, years: L.years, picks: L.picksOOS })); }
  console.log('placebo', JSON.stringify(r.placebo.t), JSON.stringify(r.placebo.mean), 'verdict', r.verdict, JSON.stringify(r.data));
}
