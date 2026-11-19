// The MAX (lottery) effect across currencies, monthly rebalance (pre-registered 14 Nov 2026, PREREGISTRATION.md).
// Rank the 7 G10 currencies against USD by their largest daily close-to-close return over the calendar month ending on the
// signal day; sell the 2 highest, buy the 2 lowest at the next open, 1R = stop = 3 x ATR(20), hold to the next month-end close;
// net of the measured raw-spread cost model and a flat 0.004 % a night financing. Paper research only.
// The harness (series, inversion, calendar, ATR, legs, costs, financing, statistics, placebo) is copied unchanged from
// research/edge/fx-xs-momentum/run.mjs (branch fx-xs-momentum, commit 58bd018), which is not on main.
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
export const P = { ATR_N: 20, ATR_MULT: 3, TOP: 2, MIN_DAYS: 10, SPREAD_PIP: 0.3, SLIP_PIP_SIDE: 0.5, COMM_SIDE: 22.5e-6, FIN_NIGHT: 0.00004, SEEDS: 40 };
const DAY = 86400;
export const OOS = { from: '2015-01', to: '9999-12' }, IS = { from: '2005-01', to: '2014-12' };

// ─── the series (harness) ───
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

// ─── the signal: MAX over the calendar month ending on day d (closes up to and including d only) ───
export function maxReturn(bars, times, d) {
  const m = ym(times[d]); let best = null, k = 0;
  for (let i = d; i >= 1 && ym(times[i]) === m; i--) {
    const r = bars[i].close / bars[i - 1].close - 1;
    if (!Number.isFinite(r)) return null;
    best = best == null ? r : Math.max(best, r); k++;
  }
  return k >= P.MIN_DAYS ? best : null;
}
// highest MAX first; ties by list order
export function rankMax(X, times, ccys, d) {
  const r = ccys.map((c, k) => ({ c, k, r: maxReturn(X[c], times, d) }));
  if (r.some((x) => x.r == null)) return null;
  return r.sort((a, b) => b.r - a.r || a.k - b.k).map((x) => x.c);
}
// sell the highest-MAX two, buy the lowest-MAX two
export const maxPick = (ranked) => ({ long: ranked.slice(-P.TOP), short: ranked.slice(0, P.TOP) });

export function atr(bars, d, n = P.ATR_N) {
  if (d - n < 0) return null;
  let s = 0;
  for (let i = d - n + 1; i <= d; i++) { const b = bars[i], pc = bars[i - 1].close; s += Math.max(b.high - b.low, Math.abs(b.high - pc), Math.abs(b.low - pc)); }
  return s / n;
}

// ─── one leg (harness) ───
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
  return { ccy: pair.ccy, side, gross, costR, finR, nights: n, net: gross - costR - finR, how: L.how };
}

// ─── the book (harness; the ranking is the MAX rank) ───
export function runBook(D, pick) {
  const ends = monthEnds(D.times), months = [];
  const byCcy = Object.fromEntries(PAIRS.map((p) => [p.ccy, p]));
  for (let m = 0; m + 1 < ends.length; m++) {
    const d = ends[m], e = d + 1, x = ends[m + 1];
    const ranked = rankMax(D.X, D.times, PAIRS.map((p) => p.ccy), d);
    if (!ranked) continue;
    const pk = pick(ranked, m), legs = [];
    for (const [cs, side] of [[pk.long, 1], [pk.short, -1]]) for (const c of cs) {
      const a = atr(D.X[c], d); if (!a) continue;
      legs.push(legResult(D.X, D.Q, byCcy[c], e, x, side, P.ATR_MULT * a, D.times));
    }
    if (!legs.length) continue;
    const sum = (k) => legs.reduce((s, l) => s + l[k], 0);
    months.push({ month: ym(D.times[e]), long: pk.long, short: pk.short, legs, net: sum('net'), gross: sum('gross'), x2: sum('gross') - 2 * sum('costR') - 2 * sum('finR') });
  }
  return months;
}

// ─── statistics (harness) ───
export function stats(vals) {
  const n = vals.length; if (!n) return { n: 0 };
  const mean = vals.reduce((a, b) => a + b, 0) / n;
  const sd = n > 1 ? Math.sqrt(vals.reduce((a, b) => a + (b - mean) ** 2, 0) / (n - 1)) : 0;
  let cum = 0, peak = 0, dd = 0; for (const v of vals) { cum += v; peak = Math.max(peak, cum); dd = Math.min(dd, cum - peak); }
  const r = (v, k = 3) => +v.toFixed(k);
  return { n, mean: r(mean), total: r(cum, 2), t: sd ? r((mean / sd) * Math.sqrt(n), 2) : 0, sharpe: sd ? r((mean / sd) * Math.sqrt(12), 2) : 0, dd: r(dd, 2), pos: r((vals.filter((v) => v > 0).length / n) * 100, 1) };
}
export const inWin = (w) => (m) => m.month >= w.from && m.month <= w.to;
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
    out[name] = { from: ms[0]?.month, to: ms.at(-1)?.month, net: stats(ms.map((m) => m.net)), gross: stats(ms.map((m) => m.gross)), x2: stats(ms.map((m) => m.x2)), legs: legStats(ms) };
  }
  return out;
}

// ─── data ───
export function loadSeries(read) {
  return PAIRS.map((p) => {
    const q = foldWeekend(rowsToBars(JSON.parse(read(p.key)).rows));
    return { ccy: p.ccy, q, x: expressed(q, p.inv) };
  });
}
const gitRead = (k) => execFileSync('git', ['show', `origin/council-data:research/daily/${k}.json`], { encoding: 'utf8', maxBuffer: 64 << 20 });

export function main(read = gitRead) {
  const series = loadSeries(read), D = align(series);
  const last = D.times.at(-1), lastMonthDone = ym(last + DAY) !== ym(last);
  const clip = (ms) => ms.filter((m) => lastMonthDone || m.month !== ym(last));
  const res = { built: '2026-11-14', data: { from: new Date(D.times[0] * 1000).toISOString().slice(0, 10), to: new Date(last * 1000).toISOString().slice(0, 10), days: D.times.length, src: 'council-data research/daily (OANDA mid, UTC daily), weekend stubs folded' }, params: P, windows: { is: IS, oos: OOS } };
  const book = clip(runBook(D, maxPick));
  Object.assign(res, summary(book));
  const years = {}; for (const m of book) { const y = m.month.slice(0, 4); years[y] = +((years[y] || 0) + m.net).toFixed(2); }
  res.years = years;
  const picks = {}; for (const m of book.filter(inWin(OOS))) { for (const c of m.long) (picks[c] ||= { long: 0, short: 0 }).long++; for (const c of m.short) (picks[c] ||= { long: 0, short: 0 }).short++; }
  res.picksOos = picks;
  // placebo: 40 seeded random books on the same months
  const plT = [], plMean = [];
  for (let seed = 1; seed <= P.SEEDS; seed++) {
    const ms = clip(runBook(D, randomPick(mulberry32(seed)))).filter(inWin(OOS)), st = stats(ms.map((m) => m.net));
    plT.push(st.t); plMean.push(st.mean);
  }
  const t = res.oos.net.t;
  res.placebo = { seeds: P.SEEDS, t: { p5: +percentile(plT, 0.05).toFixed(2), p50: +percentile(plT, 0.5).toFixed(2), p95: +percentile(plT, 0.95).toFixed(2) }, mean: { p5: +percentile(plMean, 0.05).toFixed(3), p50: +percentile(plMean, 0.5).toFixed(3), p95: +percentile(plMean, 0.95).toFixed(3) }, beaten: plT.filter((v) => t > v).length, tAll: plT };
  res.checks = { oosPositive: res.oos.net.mean > 0, oosT2: res.oos.net.t >= 2, isPositive: res.is.net.mean > 0, oosPositiveAt2x: res.oos.x2.mean > 0, placebo: t > res.placebo.t.p95 };
  res.pass = Object.values(res.checks).every(Boolean);
  res.verdict = res.pass ? 'PASS' : 'FAIL';
  return res;
}

if (process.argv[1] && import.meta.url === new URL(`file://${process.argv[1]}`).href) {
  const r = main();
  fs.writeFileSync(new URL('./result.json', import.meta.url), JSON.stringify(r, null, 1) + '\n');
  for (const w of ['oos', 'is']) console.log(w, r[w].from, r[w].to, JSON.stringify({ net: r[w].net, gross: r[w].gross, x2: r[w].x2, legs: r[w].legs }));
  console.log('years', JSON.stringify(r.years), 'picks', JSON.stringify(r.picksOos));
  console.log('placebo', JSON.stringify(r.placebo.t), JSON.stringify(r.placebo.mean), 'beaten', r.placebo.beaten, 'checks', JSON.stringify(r.checks), 'verdict', r.verdict, JSON.stringify(r.data));
}
