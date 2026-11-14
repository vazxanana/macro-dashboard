// Betting against beta within asset classes (research/edge/xs-bab/PREREGISTRATION.md, committed and pushed first).
// Research only: nothing here is read by the council, the mirror or any page; no order code.
//   node research/edge/xs-bab/run.mjs fetch <dir>   copies council-data research/daily/<key>.json of the 36 keys and
//                                                   macro/cache.json into <dir> (outside git); git show from origin/council-data
//   node research/edge/xs-bab/run.mjs full <dir>    writes result.json and RESULT.md next to this file
// Month ends, ATR, the DGS2 as-of lookup, the leg walk, Newey-West, Holm and the seeded shuffle are copied from
// research/edge/index-low-vol/run.mjs (branch index-low-vol, not imported across branches); weekend folding and the rollover
// count come from council/fills.mjs (main).
import fs from 'node:fs';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { foldWeekend, nights } from '../../../council/fills.mjs';

const HERE = path.dirname(fileURLToPath(import.meta.url));

// ---- the pre-registered constants ----
export const GROUPS = {
  C: { name: 'Commodities', keys: ['xau', 'xag', 'xpt', 'xpd', 'xcu', 'bco', 'wtico', 'natgas', 'corn', 'wheat', 'soybn', 'sugar'] },
  F: { name: 'FX (currency against the dollar)', keys: ['eurusd', 'gbpusd', 'audusd', 'nzdusd', 'usdjpy', 'usdcad', 'usdchf'] },
  I: { name: 'Indices (reported group)', keys: ['au200', 'ch20', 'cn50', 'de40', 'es35', 'eu50', 'fr40', 'hk33', 'in50', 'jp225', 'nas100', 'nl25', 'sg30', 'spx500', 'uk100', 'us2000', 'us30'] },
};
export const INVERT = ['usdjpy', 'usdcad', 'usdchf'];
export const P = { betaDays: 250, shrinkW: 0.6, shrinkTo: 1, minGroupDay: 3, gapDays: 7, minRanked: 6, minLegBeta: 0.1, capK: 3, atrN: 20, atrK: 3, staleDays: 7 };
export const VARIANT = { volDays: 250, corrDays: 1250, corrMin: 750, overlap: 3 };
export const COST = {
  idx: { roundTrip: 0.0004 }, com: { roundTrip: 0.0006, fixed: { xau: 0.30, xag: 0.03 } }, fx: { pips: 2 },
  finIdxMarkup: 0.025, finIdxFallback: 4, finCom: 0.03, finFxNight: 0.00004,
};
export const WIN = { isTo: '2016-12', oosFrom: '2017-01' };
export const BAR = { minT: 2, alpha: 0.05, nwLags: 3, placeboPct: 0.95 };
export const PLACEBO = { draws: 40, seed: 20261114 };
export const SCALES = [0, 1, 2];
export const TESTS = ['P', 'C', 'F', 'I'];

const DAY = 86400;
const r2 = (x) => (Number.isFinite(x) ? Math.round(x * 100) / 100 : null);
const r3 = (x) => (Number.isFinite(x) ? Math.round(x * 1000) / 1000 : null);
const r4 = (x) => (Number.isFinite(x) ? Math.round(x * 10000) / 10000 : null);

export const monthOf = (t) => { const d = new Date(t * 1000); return d.getUTCFullYear() * 12 + d.getUTCMonth(); };
export const monthLabel = (m) => `${Math.floor(m / 12)}-${String((m % 12) + 1).padStart(2, '0')}`;
export const monthFrom = (s) => { const [y, mo] = s.split('-').map(Number); return y * 12 + mo - 1; };
const monthEndT = (m) => Date.UTC(Math.floor((m + 1) / 12), (m + 1) % 12, 1) / 1000;
const dayOf = (t) => Math.floor(t / DAY);

export function invertBars(bars) {
  return bars.map((b) => ({ time: b.time, open: 1 / b.open, high: 1 / b.low, low: 1 / b.high, close: 1 / b.close }));
}
export function barsOf(file, invert = false) {
  const b = foldWeekend(file.rows.map((r) => ({ time: r[0], open: r[1], high: r[2], low: r[3], close: r[4] })));
  return invert ? invertBars(b) : b;
}
export function monthEnds(bars) { const m = new Map(); bars.forEach((b, i) => m.set(monthOf(b.time), i)); return m; }
export function atrAt(bars, i, n = P.atrN) {
  if (i < n) return null;
  let tr = 0;
  for (let k = i - n + 1; k <= i; k++) tr += Math.max(bars[k].high - bars[k].low, Math.abs(bars[k].high - bars[k - 1].close), Math.abs(bars[k].low - bars[k - 1].close));
  return tr / n;
}

// half a round trip in price units at price px for this market
export function halfCostFn(group, key, invert) {
  if (group === 'I') return (px) => (COST.idx.roundTrip / 2) * px;
  if (group === 'C') { const f = COST.com.fixed[key]; return f != null ? () => f / 2 : (px) => (COST.com.roundTrip / 2) * px; }
  const pip = key.includes('jpy') ? 0.01 : 0.0001, rt = COST.fx.pips * pip;
  // a cost of rt in the pair's price is rt x q^2 in the inverted price q = 1 / p
  return invert ? (q) => (rt / 2) * q * q : () => rt / 2;
}
export function asOfRate(list) {
  const day = (t) => new Date(t * 1000).toISOString().slice(0, 10);
  return (t) => {
    const d = day(t); let lo = 0, hi = list.length - 1, v = null;
    while (lo <= hi) { const mid = (lo + hi) >> 1; if (list[mid][0] <= d) { v = list[mid][1]; lo = mid + 1; } else hi = mid - 1; }
    return v;
  };
}
// financing a rollover night, as a fraction of notional
export function nightRateFn(group, dgs2) {
  if (group === 'I') return (t) => { const v = dgs2 ? dgs2(t) : null; return (Math.max(0, v == null ? COST.finIdxFallback : v) / 100 + COST.finIdxMarkup) / 365; };
  if (group === 'C') return () => COST.finCom / 365;
  return () => COST.finFxNight;
}

// ---- the group's daily average return and each market's returns ----
// D[key] = { bars, ends, ret: [{ day, r, i }] }; returns avg: Map day -> mean return (3+ markets)
export function groupAverage(D, keys) {
  const acc = new Map();
  for (const k of keys) {
    if (!D[k]) continue;
    const { bars } = D[k], ret = [];
    for (let i = 1; i < bars.length; i++) {
      if (bars[i].time - bars[i - 1].time > P.gapDays * DAY) continue;
      const r = bars[i].close / bars[i - 1].close - 1, d = dayOf(bars[i].time);
      ret.push({ day: d, r, i });
      const a = acc.get(d) || [0, 0]; a[0] += r; a[1]++; acc.set(d, a);
    }
    D[k].ret = ret;
  }
  const avg = new Map();
  for (const [d, [s, n]] of acc) if (n >= P.minGroupDay) avg.set(d, s / n);
  return avg;
}
// OLS beta of the market on the group average over the last `n` common days at or before bar index i
export function betaAt(D, key, avg, i, n = P.betaDays) {
  const ret = D[key].ret; if (!ret) return null;
  let j = ret.length - 1; while (j >= 0 && ret[j].i > i) j--;
  const xs = [], ys = [];
  for (; j >= 0 && xs.length < n; j--) { const g = avg.get(ret[j].day); if (g != null) { xs.push(g); ys.push(ret[j].r); } }
  if (xs.length < n) return null;
  const mx = xs.reduce((a, b) => a + b, 0) / n, my = ys.reduce((a, b) => a + b, 0) / n;
  let sxy = 0, sxx = 0; for (let k = 0; k < n; k++) { sxy += (xs[k] - mx) * (ys[k] - my); sxx += (xs[k] - mx) ** 2; }
  return sxx > 0 ? sxy / sxx : null;
}
// the variant: sigma from 250 daily log returns, correlation from overlapping 3-day log returns over 1,250 common days
export function paperBetaAt(D, key, avg, i) {
  const ret = D[key].ret; if (!ret) return null;
  let j = ret.length - 1; while (j >= 0 && ret[j].i > i) j--;
  const xs = [], ys = [];
  for (; j >= 0 && xs.length < VARIANT.corrDays; j--) { const g = avg.get(ret[j].day); if (g != null) { xs.push(Math.log(1 + g)); ys.push(Math.log(1 + ret[j].r)); } }
  if (xs.length < VARIANT.corrMin) return null;
  const sd = (a) => { const m = a.reduce((s, x) => s + x, 0) / a.length; return Math.sqrt(a.reduce((s, x) => s + (x - m) ** 2, 0) / (a.length - 1)); };
  const sI = sd(ys.slice(0, VARIANT.volDays)), sG = sd(xs.slice(0, VARIANT.volDays));
  const x3 = [], y3 = [];
  for (let k = 0; k + VARIANT.overlap <= xs.length; k++) { let a = 0, b = 0; for (let q = 0; q < VARIANT.overlap; q++) { a += xs[k + q]; b += ys[k + q]; } x3.push(a); y3.push(b); }
  const mx = x3.reduce((a, b) => a + b, 0) / x3.length, my = y3.reduce((a, b) => a + b, 0) / y3.length;
  let sxy = 0, sxx = 0, syy = 0; for (let k = 0; k < x3.length; k++) { sxy += (x3[k] - mx) * (y3[k] - my); sxx += (x3[k] - mx) ** 2; syy += (y3[k] - my) ** 2; }
  if (!(sxx > 0 && syy > 0 && sG > 0)) return null;
  return (sxy / Math.sqrt(sxx * syy)) * (sI / sG);
}
export const shrink = (b) => P.shrinkW * b + (1 - P.shrinkW) * P.shrinkTo;

// the markets with a beta at the end of month m, ascending by shrunk beta: [{ key, beta, sb, atrPct }]
export function rankAt(D, keys, avg, m, betaFn = betaAt) {
  const out = [];
  for (const key of keys.slice().sort()) {
    if (!D[key]) continue;
    const { bars, ends } = D[key], i = ends.get(m);
    if (i == null || bars[i].time < monthEndT(m) - P.staleDays * DAY) continue;
    const b = betaFn(D, key, avg, i); if (b == null) continue;
    const atr = atrAt(bars, i); if (!(atr > 0)) continue;
    out.push({ key, beta: b, sb: shrink(b), atrPct: atr / bars[i].close });
  }
  return out.sort((x, y) => x.sb - y.sb || (x.key < y.key ? -1 : 1));
}
const median = (xs) => { const a = xs.slice().sort((x, y) => x - y), n = a.length; return n % 2 ? a[(n - 1) / 2] : (a[n / 2 - 1] + a[n / 2]) / 2; };
// the BAB book of one group at month m from its ranked list (in the order to split): [{ key, dir, w, cap, capped }] or null
export function bookOf(list) {
  if (list.length < P.minRanked) return null;
  const h = Math.floor(list.length / 2), low = list.slice(0, h), high = list.slice(-h);
  const bL = low.reduce((a, x) => a + x.sb, 0) / h, bH = high.reduce((a, x) => a + x.sb, 0) / h;
  if (!(bL >= P.minLegBeta && bH >= P.minLegBeta)) return null;
  const medAtr = median(list.map((x) => x.atrPct));
  const pos = [];
  for (const [leg, dir, beta] of [[low, 1, bL], [high, -1, bH]]) {
    for (const x of leg) {
      const raw = 1 / (leg.length * beta), cap = P.capK * (1 / leg.length) * (medAtr / x.atrPct);
      pos.push({ key: x.key, dir, sb: x.sb, raw, cap, w: Math.min(raw, cap), capped: raw > cap });
    }
  }
  return { bL, bH, low: low.map((x) => x.key), high: high.map((x) => x.key), pos };
}

// one position formed at the end of month m, held through month m+1 with a 3 x ATR(20) stop, at weight 1 (100 % of the book):
// figures in % of the book; multiply by the weight. Null when not entered.
export function legOf(M, m, dir, lastT) {
  const { bars, ends, half, rate } = M;
  const i = ends.get(m); if (i == null) return null;
  const e = i + 1; if (e >= bars.length) return null;
  const atr = atrAt(bars, i); if (!(atr > 0)) return null;
  const R = P.atrK * atr, entry = bars[e].open, stop = entry - dir * R, u = 100 / entry, end = m + 1;
  let g = 0, spr = half(entry) * u, fin = 0, ref = entry;
  for (let k = e; k < bars.length; k++) {
    const b = bars[k];
    let px = null, why = null;
    if (k > e && dir * (b.open - stop) <= 0) { px = b.open; why = 'stop-gap'; }
    else if (dir > 0 ? b.low <= stop : b.high >= stop) { px = stop; why = 'stop'; }
    if (px == null) {
      const fileEnds = k + 1 >= bars.length;
      if (!fileEnds && monthOf(bars[k + 1].time) > end) { px = b.close; why = 'time'; }
      else if (fileEnds && b.time < lastT - 10 * DAY) { px = b.close; why = 'data-end'; }
      else if (fileEnds) return null;
    }
    if (px != null) { g += dir * (px - ref) * u; spr += half(px) * u; return { entry, stop, exitPx: px, why, g, spr, fin }; }
    g += dir * (b.close - ref) * u;
    fin += nights(b.time, bars[k + 1].time) * rate(b.time) * b.close * u;
    ref = b.close;
  }
  return null;
}

export function mulberry32(a) {
  return () => { a |= 0; a = (a + 0x6d2b79f5) | 0; let t = Math.imul(a ^ (a >>> 15), 1 | a); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
}
export function shuffle(xs, rnd) {
  const a = xs.slice();
  for (let k = a.length - 1; k > 0; k--) { const j = Math.floor(rnd() * (k + 1)); [a[k], a[j]] = [a[j], a[k]]; }
  return a;
}

// every book month of one group: [{ m: book month, g, spr, fin, n, capped, bL, bH, low, high, why }]
export function groupRows(D, gk, ranks, lastT, memo, order = null) {
  const rows = [];
  for (const [m, list0] of ranks) {
    const list = order ? order(list0, m) : list0;
    const bk = bookOf(list); if (!bk) continue;
    let g = 0, spr = 0, fin = 0, n = 0, capped = 0, gross = 0; const why = {};
    for (const p of bk.pos) {
      const id = `${p.key}|${m}|${p.dir}`;
      if (!memo.has(id)) memo.set(id, legOf(D[p.key], m, p.dir, lastT));
      const lg = memo.get(id); if (!lg) continue;
      g += p.w * lg.g; spr += p.w * lg.spr; fin += p.w * lg.fin; n++; gross += p.w; if (p.capped) capped++;
      why[lg.why] = (why[lg.why] || 0) + 1;
    }
    if (!n) continue;
    rows.push({ m: m + 1, g, spr, fin, n, capped, gross, bL: bk.bL, bH: bk.bH, low: bk.low, high: bk.high, why });
  }
  return rows;
}
export const netOf = (r, c) => r.g - c * (r.spr + r.fin);
// equal-weighted mean of several groups' rows, months where all exist
export function combine(rowsList) {
  const maps = rowsList.map((rs) => new Map(rs.map((r) => [r.m, r])));
  const out = [];
  for (const r of rowsList[0]) {
    const xs = maps.map((mp) => mp.get(r.m)); if (xs.some((x) => !x)) continue;
    const k = xs.length;
    out.push({ m: r.m, g: xs.reduce((a, x) => a + x.g, 0) / k, spr: xs.reduce((a, x) => a + x.spr, 0) / k, fin: xs.reduce((a, x) => a + x.fin, 0) / k });
  }
  return out;
}

export function nwT(xs, lags = BAR.nwLags) {
  const n = xs.length; if (n < 3) return null;
  const mu = xs.reduce((a, b) => a + b, 0) / n, d = xs.map((x) => x - mu);
  const gam = (l) => { let s = 0; for (let k = l; k < n; k++) s += d[k] * d[k - l]; return s / n; };
  let lrv = gam(0);
  for (let l = 1; l <= Math.min(lags, n - 1); l++) lrv += 2 * (1 - l / (lags + 1)) * gam(l);
  return lrv > 0 ? mu / Math.sqrt(lrv / n) : null;
}
export function statsOf(xs) {
  const n = xs.length;
  if (!n) return { months: 0 };
  const mean = xs.reduce((a, b) => a + b, 0) / n, sd = Math.sqrt(xs.reduce((a, b) => a + (b - mean) ** 2, 0) / Math.max(1, n - 1));
  let cum = 0, peak = 0, dd = 0;
  for (const x of xs) { cum += x; peak = Math.max(peak, cum); dd = Math.min(dd, cum - peak); }
  return { months: n, mean, sd, total: cum, t: sd > 0 ? mean / (sd / Math.sqrt(n)) : null, tNW: nwT(xs), posShare: xs.filter((x) => x > 0).length / n, maxDD: dd, sharpe: sd > 0 ? (mean / sd) * Math.sqrt(12) : null };
}
export const windowRows = (rows, from, to) => rows.filter((r) => r.m >= from && r.m <= to);
export const pct = (xs, p) => { const a = xs.slice().sort((x, y) => x - y), k = (a.length - 1) * p, lo = Math.floor(k), hi = Math.ceil(k); return a[lo] + (a[hi] - a[lo]) * (k - lo); };
export function phi(x) {
  const z = Math.abs(x) / Math.SQRT2, t = 1 / (1 + 0.3275911 * z);
  const erf = 1 - (((((1.061405429 * t - 1.453152027) * t) + 1.421413741) * t - 0.284496736) * t + 0.254829592) * t * Math.exp(-z * z);
  return x >= 0 ? 0.5 * (1 + erf) : 0.5 * (1 - erf);
}
export function holm(ps, alpha = BAR.alpha) {
  const idx = ps.map((p, i) => [p, i]).sort((a, b) => a[0] - b[0]);
  const ok = ps.map(() => false);
  for (let r = 0; r < idx.length; r++) { if (idx[r][0] <= alpha / (idx.length - r)) ok[idx[r][1]] = true; else break; }
  return ok;
}

// ---- the whole study on loaded data ----
export function prepare(D) {
  const avg = {};
  for (const gk of Object.keys(GROUPS)) avg[gk] = groupAverage(D, GROUPS[gk].keys);
  let lastT = 0, firstM = Infinity;
  for (const k of Object.keys(D)) { const b = D[k].bars; lastT = Math.max(lastT, b[b.length - 1].time); firstM = Math.min(firstM, monthOf(b[0].time)); }
  return { avg, lastT, firstM, lastM: monthOf(lastT) - 1 };
}
export function ranksOf(D, prep, gk, betaFn = betaAt) {
  const out = [];
  for (let m = prep.firstM; m <= prep.lastM - 1; m++) { const l = rankAt(D, GROUPS[gk].keys, prep.avg[gk], m, betaFn); if (l.length) out.push([m, l]); }
  return out;
}
export function study(D, opts = {}) {
  const prep = prepare(D), memo = new Map();
  const ranks = {}, rows = {}, rowsV = {};
  for (const gk of Object.keys(GROUPS)) { ranks[gk] = ranksOf(D, prep, gk); rows[gk] = groupRows(D, gk, ranks[gk], prep.lastT, memo); }
  const series = (R) => ({ P: combine([R.C, R.F]), C: R.C, F: R.F, I: R.I, ALL: combine([R.C, R.F, R.I]) });
  const main = series(rows);
  for (const gk of Object.keys(GROUPS)) rowsV[gk] = groupRows(D, gk, ranksOf(D, prep, gk, paperBetaAt), prep.lastT, memo);
  const variant = series(rowsV);
  const draws = Object.fromEntries(TESTS.map((t) => [t, []]));
  const oosFrom = monthFrom(WIN.oosFrom), isTo = monthFrom(WIN.isTo);
  if (!opts.noPlacebo) {
    for (let d = 0; d < PLACEBO.draws; d++) {
      const rnd = mulberry32(PLACEBO.seed + d), R = {};
      for (const gk of Object.keys(GROUPS)) R[gk] = groupRows(D, gk, ranks[gk], prep.lastT, memo, (l) => shuffle(l, rnd));
      const s = series(R);
      for (const t of TESTS) draws[t].push(statsOf(windowRows(s[t], oosFrom, prep.lastM).map((r) => netOf(r, 1))).mean);
    }
  }
  return { prep, ranks, rows, main, variant, draws, oosFrom, isTo };
}
const winStats = (rows, from, to, c) => statsOf(windowRows(rows, from, to).map((r) => netOf(r, c)));
export function verdictOf(S) {
  const tests = TESTS.map((t) => {
    const rows = S.main[t], oos = winStats(rows, S.oosFrom, S.prep.lastM, 1), is = winStats(rows, -Infinity, S.isTo, 1), oos2 = winStats(rows, S.oosFrom, S.prep.lastM, 2);
    const dr = S.draws[t], p95 = dr.length ? pct(dr, BAR.placeboPct) : null;
    return { t, p: oos.t == null ? 1 : 1 - phi(oos.t), oos, is, oos2, p95 };
  });
  const hk = holm(tests.map((x) => x.p));
  return tests.map((x, i) => {
    const checks = { oosPositive: x.oos.mean > 0, tMin: x.oos.t >= BAR.minT, holm: hk[i], isPositive: x.is.mean > 0, cost2x: x.oos2.mean > 0, placebo: x.p95 != null && x.oos.mean > x.p95 };
    return { test: x.t, p: x.p, p95: x.p95, checks, pass: Object.values(checks).every(Boolean) };
  });
}

// ---- result.json and RESULT.md ----
export function report(S) {
  const V = verdictOf(S), M = S.main, last = S.prep.lastM;
  const sOut = (s) => ({ months: s.months, mean: r4(s.mean), sd: r4(s.sd), total: r2(s.total), t: r2(s.t), tNW: r2(s.tNW), posShare: r3(s.posShare), maxDD: r2(s.maxDD), sharpe: r2(s.sharpe) });
  const win = (rows) => {
    const first = rows.length ? rows[0].m : null;
    return {
      is: { from: first != null ? monthLabel(first) : null, to: WIN.isTo, ...Object.fromEntries(SCALES.map((c) => [`x${c}`, sOut(winStats(rows, -Infinity, S.isTo, c))])) },
      oos: { from: WIN.oosFrom, to: monthLabel(last), ...Object.fromEntries(SCALES.map((c) => [`x${c}`, sOut(winStats(rows, S.oosFrom, last, c))])) },
    };
  };
  const costs = (rows) => { const o = windowRows(rows, S.oosFrom, last); return { spread: r4(o.reduce((a, r) => a + r.spr, 0) / o.length), financing: r4(o.reduce((a, r) => a + r.fin, 0) / o.length) }; };
  const grp = (gk) => {
    const o = windowRows(S.rows[gk], S.oosFrom, last), why = {};
    for (const r of o) for (const [k, v] of Object.entries(r.why)) why[k] = (why[k] || 0) + v;
    const picks = {};
    for (const r of o) { for (const k of r.low) (picks[k] ||= { low: 0, high: 0 }).low++; for (const k of r.high) (picks[k] ||= { low: 0, high: 0 }).high++; }
    const betas = {};
    for (const [m, l] of S.ranks[gk]) if (m + 1 >= S.oosFrom && m + 1 <= last) for (const x of l) (betas[x.key] ||= []).push(x.beta);
    return {
      name: GROUPS[gk].name, keys: GROUPS[gk].keys,
      oosPositions: o.reduce((a, r) => a + r.n, 0), oosCapped: o.reduce((a, r) => a + r.capped, 0), exits: why,
      meanBetaLow: r3(o.reduce((a, r) => a + r.bL, 0) / o.length), meanBetaHigh: r3(o.reduce((a, r) => a + r.bH, 0) / o.length),
      meanGrossNotional: r3(o.reduce((a, r) => a + r.gross, 0) / o.length),
      picks, medianBeta: Object.fromEntries(Object.entries(betas).map(([k, xs]) => [k, r3(pct(xs, 0.5))]).sort((a, b) => a[1] - b[1])),
    };
  };
  const years = {};
  for (const t of ['P', 'C', 'F', 'I']) for (const r of M[t]) { const y = Math.floor((r.m) / 12); (years[y] ||= { year: y }); years[y][t] = r2((years[y][t] || 0) + netOf(r, 1)); }
  const pP = V.find((v) => v.test === 'P'), pass = pP.pass;
  const oP = winStats(M.P, S.oosFrom, last, 1);
  const out = {
    study: 'xs-bab',
    built: '2026-11-14',
    verdict: pass ? 'PASS' : 'FAIL',
    statement: pass
      ? `betting against beta within commodities and FX passes the pre-registered bar (OOS ${r3(oP.mean)} % of the book a month, t ${r2(oP.t)}, n ${oP.months}).`
      : `${V.filter((v) => v.pass).length} of 4 tests pass: betting against beta within commodities and FX is not an edge after costs (OOS 2017-26 ${r3(oP.mean)} % a month, n ${oP.months}, t ${r2(oP.t)}).`,
    claim: 'Frazzini & Pedersen (2014), Betting Against Beta: within an asset class, low-beta markets earn higher risk-adjusted returns than high-beta ones; long low-beta levered to beta 1, short high-beta delevered to beta 1.',
    related: ['index-low-vol (branch, FAIL): low total volatility against high within 17 index CFDs; indices are therefore a reported group here, not part of the primary test', 'commodity-xs-momentum, fx-xs-momentum (branches, FAIL): same market sets and cost assumptions, another signal'],
    params: { ...P, variant: VARIANT, cost: COST, windows: WIN, bar: BAR, placebo: PLACEBO, invert: INVERT },
    universe: S.universe,
    tests: V.map((v) => ({ test: v.test, pOneSided: r4(v.p), checks: v.checks, pass: v.pass, placeboP95: r4(v.p95) })),
    series: Object.fromEntries(['P', 'C', 'F', 'I', 'ALL'].map((t) => [t, { ...win(M[t]), costPerMonthOOS: costs(M[t]) }])),
    groups: Object.fromEntries(['C', 'F', 'I'].map((g) => [g, grp(g)])),
    variant: { name: 'paper beta: sigma 250 days x correlation of overlapping 3-day log returns over 1,250 days, shrunk', ...Object.fromEntries(['P', 'C', 'F', 'I'].map((t) => [t, { is: sOut(winStats(S.variant[t], -Infinity, S.isTo, 1)), oos: sOut(winStats(S.variant[t], S.oosFrom, last, 1)) }])) },
    placebo: Object.fromEntries(TESTS.map((t) => {
      const dr = S.draws[t], real = winStats(M[t], S.oosFrom, last, 1).mean;
      return [t, { draws: dr.length, seed: PLACEBO.seed, real: r4(real), median: dr.length ? r4(pct(dr, 0.5)) : null, p5: dr.length ? r4(pct(dr, 0.05)) : null, p95: dr.length ? r4(pct(dr, 0.95)) : null, atOrAbove: dr.filter((x) => x >= real).length }];
    })),
    perYear: Object.values(years).sort((a, b) => a.year - b.year),
  };
  return { json: out, md: mdOf(out) };
}

const NAMES = { P: 'P (primary): commodities + FX, equal weight', C: 'C: commodities', F: 'F: FX', I: 'I: indices (reported group)', ALL: 'All three groups, equal weight (reported only)' };
function mdOf(o) {
  const yn = (b) => (b ? 'yes' : 'no');
  const row = (name, s) => `| ${name} | ${s.months} | ${s.mean} | ${s.t} | ${s.tNW} | ${s.total} | ${s.maxDD} | ${s.sharpe} | ${Math.round(s.posShare * 100)} % |`;
  const L = [];
  L.push('# Result: betting against beta within asset classes (14 Nov 2026)', '');
  L.push(`**Verdict: ${o.verdict}, ${o.statement}** Pre-registered in [PREREGISTRATION.md](PREREGISTRATION.md) (committed alone and pushed first). Paper research only; nothing live changed.`, '');
  L.push(`Claim: ${o.claim}`, '');
  L.push('Related: `index-low-vol` (branch, FAIL) ranked 17 index CFDs by total volatility, so the indices are a reported group here, not part of the primary test; `commodity-xs-momentum` and `fx-xs-momentum` (branches, FAIL) used the same market sets and cost assumptions with a momentum signal.', '');
  L.push(`Data: OANDA mid daily candles (council-data research/daily/*.json, weekend stubs folded with \`foldWeekend\`): commodities ${o.groups.C.keys.join(' ')}; FX ${o.groups.F.keys.join(' ')} (usdjpy, usdcad, usdchf inverted: each market is the currency against the dollar); indices ${o.groups.I.keys.join(' ')}. DGS2 from council-data macro/cache.json for index financing.`, '');
  L.push('Rule: at each month end, within each group, beta = OLS slope of a market\'s daily return on the group\'s equal-weighted average over the last 250 common days, shrunk 0.6 x beta + 0.4; long the low-beta half at 1 / (n x mean low beta) of the book each, short the high-beta half at 1 / (n x mean high beta) each (each leg ex-ante beta 1), each position capped at 3 x its inverse-ATR size; enter at the next open, stop 3 x ATR(20), out at the close of the next month. Figures are % of the book a month. Costs: round trip indices 0.04 %, commodities 0.06 % (gold $0.30, silver $0.03), FX 2 pips; financing a night on every position, longs and shorts: indices (DGS2 + 2.5 %) / 365, commodities 3 % a year, FX 0.004 %.', '');
  L.push('## Against the bar (OOS 2017-01 to ' + o.series.P.oos.to + ', net at base costs; Holm over P, C, F, I)', '');
  L.push('| Test | OOS mean > 0 | OOS t >= 2 | Holm (one-sided p) | IS mean > 0 | OOS at 2x costs > 0 | Above placebo 95th pct | Pass |', '|---|---|---|---|---|---|---|---|');
  for (const v of o.tests) {
    const s = o.series[v.test];
    L.push(`| ${NAMES[v.test]} | ${yn(v.checks.oosPositive)} (${s.oos.x1.mean}) | ${yn(v.checks.tMin)} (${s.oos.x1.t}) | ${yn(v.checks.holm)} (p ${v.pOneSided}) | ${yn(v.checks.isPositive)} (${s.is.x1.mean}) | ${yn(v.checks.cost2x)} (${s.oos.x2.mean}) | ${yn(v.checks.placebo)} (against ${v.placeboP95}) | ${v.pass ? '**yes**' : 'no'} |`);
  }
  L.push('');
  for (const t of ['P', 'C', 'F', 'I', 'ALL']) {
    const s = o.series[t];
    L.push(`## ${NAMES[t]}`, '');
    L.push('| Window, cost | Months | Mean (% of the book a month) | t (months) | NW t (3 lags) | Total | Worst drawdown | Sharpe (a year) | Months up |', '|---|---|---|---|---|---|---|---|---|');
    L.push(row(`**OOS ${s.oos.from} to ${s.oos.to}, net (1x)**`, s.oos.x1));
    L.push(row('OOS, gross (0x)', s.oos.x0));
    L.push(row('OOS, 2x costs', s.oos.x2));
    L.push(row(`**IS ${s.is.from} to ${s.is.to}, net (1x)**`, s.is.x1));
    L.push(row('IS, gross (0x)', s.is.x0));
    L.push(row('IS, 2x costs', s.is.x2), '');
    L.push(`Costs a month (base, OOS): spread ${s.costPerMonthOOS.spread} + financing ${s.costPerMonthOOS.financing} (% of the book).`, '');
  }
  L.push('## The groups (OOS)', '');
  L.push('| Group | Positions | Capped | Exits | Mean shrunk beta, Low / High | Mean gross notional (books) |', '|---|---|---|---|---|---|');
  for (const g of ['C', 'F', 'I']) {
    const x = o.groups[g];
    L.push(`| ${x.name} | ${x.oosPositions} | ${x.oosCapped} | ${Object.entries(x.exits).map(([k, v]) => `${k} ${v}`).join(', ')} | ${x.meanBetaLow} / ${x.meanBetaHigh} | ${x.meanGrossNotional} |`);
  }
  L.push('');
  for (const g of ['C', 'F', 'I']) {
    const x = o.groups[g];
    L.push(`- ${x.name}, median raw beta (OOS formations): ${Object.entries(x.medianBeta).map(([k, v]) => `${k} ${v}`).join(', ')}. Months in each half: ${Object.entries(x.picks).sort((a, b) => (b[1].low - b[1].high) - (a[1].low - a[1].high)).map(([k, v]) => `${k} ${v.low} Low / ${v.high} High`).join('; ')}.`);
  }
  L.push('');
  L.push(`## Placebo (random halves each month within each group, same construction and costs; OOS, ${o.placebo.P.draws} seeded draws)`, '');
  L.push('| Test | Real mean | Draws median | 5th pct | 95th pct | Draws at or above the real |', '|---|---|---|---|---|---|');
  for (const t of ['P', 'C', 'F', 'I']) { const p = o.placebo[t]; L.push(`| ${t} | ${p.real} | ${p.median} | ${p.p5} | ${p.p95} | ${p.atOrAbove} of ${p.draws} |`); }
  L.push('');
  L.push('## Variant: the paper\'s beta (reported only, not judged)', '');
  L.push('| Test | Window | Months | Mean net | t | NW t | Total | Worst drawdown |', '|---|---|---|---|---|---|---|---|');
  for (const t of ['P', 'C', 'F', 'I']) for (const w of ['is', 'oos']) { const s = o.variant[t][w]; L.push(`| ${t} | ${w.toUpperCase()} | ${s.months} | ${s.mean} | ${s.t} | ${s.tNW} | ${s.total} | ${s.maxDD} |`); }
  L.push('');
  L.push('## Per year (net at 1x, % of the book, summed over the year\'s months)', '');
  L.push('| Year | P | C | F | I |', '|---|---|---|---|---|');
  for (const y of o.perYear) L.push(`| ${y.year} | ${y.P ?? ''} | ${y.C ?? ''} | ${y.F ?? ''} | ${y.I ?? ''} |`);
  L.push('');
  L.push('## What it means, and what it does not', '');
  L.push(o.verdict === 'PASS'
    ? '- The primary test cleared every pre-registered check. A pass would only lead to a written proposal for a paper shadow; it is not a council rule.'
    : '- The primary test does not clear the pre-registered bar: on these OANDA CFDs, long the low-beta half levered to a beta of 1 against the high-beta half within commodities and within the dollar pairs is not an edge after costs. Never call it one; not a council rule, no proposal written, nothing live changed.');
  if (o.verdict !== 'PASS') {
    const s = o.series;
    L.push(`- Post hoc reading, not a test: before any cost the primary book was positive in both windows (OOS ${s.P.oos.x0.mean} % a month, t ${s.P.oos.x0.t}; IS ${s.P.is.x0.mean}, t ${s.P.is.x0.t}), commodities (${s.C.oos.x0.mean}, t ${s.C.oos.x0.t}) and FX (${s.F.oos.x0.mean}, t ${s.F.oos.x0.t}) alike, and never significant; the book holds about two books of gross notional and pays ${s.P.costPerMonthOOS.financing} % a month of financing and ${s.P.costPerMonthOOS.spread} % of spread, which turns it negative. Indices lose before costs too (OOS ${s.I.oos.x0.mean}, t ${s.I.oos.x0.t}), as \`index-low-vol\` found for low volatility. The commodity placebo's random halves lose more than the beta halves (the real C is above ${o.placebo.C.draws - o.placebo.C.atOrAbove} of ${o.placebo.C.draws} draws), but the real book is still negative net, and its 2026 gain (see per year) is one year in eleven.`);
  }
  L.push('- The halves are small (6 and 3 markets a side in commodities and FX, up to 8 in indices) and stable for long stretches (months in each half above), so the monthly t overstates the number of independent bets in either direction.');
  L.push('- The low-beta side is levered (its notional is about 1 / its mean shrunk beta) and every position pays financing, longs and shorts alike: the gross rows show the result before any cost. Daily betas across markets closing at different hours are biased toward zero (the paper-beta variant uses 3-day correlations for that reason). No dividends on indices, no FX carry beyond the flat financing, CFD prices on commodities, and a 3 x ATR(20) stop on every position (the paper held without stops): this is the claim as a CFD trader could run it, not a replication of the paper\'s data.');
  L.push('');
  L.push('To repeat: `node research/edge/xs-bab/run.mjs fetch <dir>` (git show from origin/council-data, no network; candles kept out of git), then `node research/edge/xs-bab/run.mjs full <dir>`. Tests: `tests/xs-bab.test.mjs`.');
  return L.join('\n') + '\n';
}

// ---- command line ----
export const ALL_KEYS = Object.values(GROUPS).flatMap((g) => g.keys);
export function load(dir) {
  const cache = JSON.parse(fs.readFileSync(path.join(dir, 'cache.json'), 'utf8'));
  const dgs = asOfRate(cache?.score?.fred?.DGS2 || []);
  const D = {}, universe = [];
  for (const [gk, G] of Object.entries(GROUPS)) for (const key of G.keys) {
    const f = path.join(dir, key + '.json'); if (!fs.existsSync(f)) continue;
    const file = JSON.parse(fs.readFileSync(f, 'utf8')), inv = INVERT.includes(key);
    const bars = barsOf(file, inv); if (bars.length < 300) continue;
    D[key] = { bars, ends: monthEnds(bars), half: halfCostFn(gk, key, inv), rate: nightRateFn(gk, dgs) };
    universe.push({ group: gk, key, inst: file.inst, inverted: inv, first: new Date(bars[0].time * 1000).toISOString().slice(0, 10), last: new Date(bars[bars.length - 1].time * 1000).toISOString().slice(0, 10), days: bars.length });
  }
  return { D, universe };
}
async function main() {
  const [mode, dir] = process.argv.slice(2);
  if (mode === 'fetch' && dir) {
    fs.mkdirSync(dir, { recursive: true });
    for (const k of ALL_KEYS) fs.writeFileSync(path.join(dir, k + '.json'), execFileSync('git', ['show', `origin/council-data:research/daily/${k}.json`], { maxBuffer: 1 << 28 }));
    fs.writeFileSync(path.join(dir, 'cache.json'), execFileSync('git', ['show', 'origin/council-data:macro/cache.json'], { maxBuffer: 1 << 28 }));
    console.log('fetched into', dir); return;
  }
  if (mode !== 'full' || !dir) { console.log('usage: run.mjs fetch <dir> | full <dir>'); return; }
  const { D, universe } = load(dir);
  const S = study(D); S.universe = universe;
  const { json, md } = report(S);
  fs.writeFileSync(path.join(HERE, 'result.json'), JSON.stringify(json, null, 1) + '\n');
  fs.writeFileSync(path.join(HERE, 'RESULT.md'), md);
  console.log(md);
}
if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) main();
