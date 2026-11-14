// Cross-sectional return seasonality: the same calendar month in past years (pre-registered 14 Nov 2026, PREREGISTRATION.md,
// pushed first and alone). At each month's last close, within each asset group (index, metal, energy + agriculturals, fx),
// rank the markets by their mean return in the coming calendar month over every past year on file (at least 5), long the top
// third and short the bottom third at the next month's first open, 1R = stop = 3 x ATR(20), out at the month's last close;
// net of a round trip and overnight financing. Primary = the four groups together; the groups alone are secondary tests.
//   node research/edge/xs-seasonality/run.mjs      reads council-data with git show, writes result.json and RESULT.md
// Paper research only: nothing live reads this file.
import fs from 'node:fs';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { foldWeekend, nights, FIN } from '../../../council/fills.mjs';

export const GROUPS = {
  index: ['spx500', 'de40', 'uk100', 'fr40', 'ch20', 'nl25', 'es35', 'jp225', 'au200', 'hk33', 'cn50', 'sg30', 'in50'],
  metal: ['xau', 'xag', 'xpt', 'xpd', 'xcu'],
  energy: ['wtico', 'bco', 'natgas', 'corn', 'wheat', 'soybn', 'sugar'],
  fx: ['eurusd', 'gbpusd', 'audusd', 'nzdusd', 'usdjpy', 'usdcad', 'usdchf', 'usdsek', 'usdnok'],
};
export const MARKETS = Object.values(GROUPS).flat();
export const GROUP_OF = Object.fromEntries(Object.entries(GROUPS).flatMap(([g, ks]) => ks.map((k) => [k, g])));
// a USD-base pair is inverted: the ranked asset is the foreign currency, a long currency is a short pair
export const INV = new Set(['usdjpy', 'usdcad', 'usdchf', 'usdsek', 'usdnok']);
export const P = { MIN_YEARS: 5, ATR_N: 20, ATR_MULT: 3, MARKUP: 2.5, COMMOD_FIN: 0.03, FX_NIGHT: 0.00004, SEEDS: 40, BEAT: 38, NW_LAGS: 3, ALPHA: 0.05 };
export const IS_TO = '2016-12';
export const OOS = { from: '2017-01', to: '2026-10' };
export const BOOKS = ['all', 'index', 'metal', 'energy', 'fx'];

// ─── costs ───
export const CCY = {
  spx500: 'USD', jp225: 'USD', cn50: 'USD', in50: 'USD', de40: 'EUR', fr40: 'EUR', nl25: 'EUR', es35: 'EUR',
  uk100: 'GBP', ch20: 'CHF', au200: 'AUD', hk33: 'HKD', sg30: 'SGD',
};
const COLS = ['USD', 'EUR', 'GBP', 'AUD', 'HKD', 'CHF', 'SGD'];
const RATES = {
  2007: [5.0, 3.9, 5.5, 6.5, 5.0, 2.5, 2.4], 2008: [2.0, 3.9, 4.7, 6.7, 2.0, 2.1, 1.0], 2009: [0.2, 1.3, 0.6, 3.3, 0.2, 0.25, 0.7],
  2010: [0.2, 1.0, 0.5, 4.4, 0.2, 0.25, 0.4], 2011: [0.1, 1.3, 0.5, 4.7, 0.2, 0.05, 0.4], 2012: [0.1, 0.9, 0.5, 3.7, 0.2, 0, 0.4],
  2013: [0.1, 0.6, 0.5, 2.8, 0.2, 0, 0.4], 2014: [0.1, 0.2, 0.5, 2.5, 0.2, 0, 0.5], 2015: [0.1, 0.05, 0.5, 2.1, 0.2, -0.75, 1.0],
  2016: [0.4, 0, 0.4, 1.6, 0.4, -0.75, 1.0], 2017: [1.0, 0, 0.3, 1.5, 1.0, -0.75, 1.1], 2018: [1.8, 0, 0.6, 1.5, 1.8, -0.75, 1.7],
  2019: [2.2, 0, 0.75, 1.1, 2.2, -0.75, 1.8], 2020: [0.4, 0, 0.2, 0.3, 0.5, -0.75, 0.6], 2021: [0.1, 0, 0.1, 0.1, 0.1, -0.75, 0.4],
  2022: [1.7, 0.3, 1.5, 1.3, 1.8, 0, 2.0], 2023: [5.0, 3.3, 4.7, 3.9, 4.6, 1.5, 3.9], 2024: [5.1, 3.9, 5.1, 4.35, 5.0, 1.25, 3.6],
  2025: [4.2, 2.3, 4.3, 4.0, 4.0, 0.25, 2.3], 2026: [3.7, 2.0, 3.8, 3.6, 3.6, 0, 1.6],
};
export function cashRate(ccy, year) { const y = Math.min(2026, Math.max(2007, year)); return Math.max(0, RATES[y][COLS.indexOf(ccy)]); }
// round trip as a fraction of the (pair) price
export function costFrac(key, price) {
  const g = GROUP_OF[key];
  if (g === 'index') return 0.0004;
  if (key === 'xau') return 0.30 / price;
  if (key === 'xag') return 0.03 / price;
  if (g === 'metal' || g === 'energy') return 0.0006;
  if (key === 'usdsek' || key === 'usdnok') return 0.0004;
  const pip = key === 'usdjpy' ? 0.01 : 0.0001;
  return (1.3 * pip) / price + 0.000045;
}
// financing per night as a fraction of the (pair) price, for a PAIR side (+1 long the instrument)
export function finNight(key, pairSide, t) {
  const g = GROUP_OF[key];
  if (g === 'index') {
    const r = cashRate(CCY[key], new Date(t * 1000).getUTCFullYear());
    return (pairSide > 0 ? r + P.MARKUP : Math.max(0, P.MARKUP - r)) / 100 / 365;
  }
  if (key === 'xau' && pairSide > 0) return FIN.xau.long;
  if (g === 'metal' || g === 'energy') return P.COMMOD_FIN / 365;
  return P.FX_NIGHT;
}
const DAY = 86400;

// ─── calendar ───
export const ym = (t) => new Date(t * 1000).toISOString().slice(0, 7);
export function shiftYm(s, k) { const [y, m] = s.split('-').map(Number), n = y * 12 + (m - 1) + k; return `${Math.floor(n / 12)}-${String((n % 12) + 1).padStart(2, '0')}`; }
export function monthsBetween(from, to) { const out = []; for (let s = from; s <= to; s = shiftYm(s, 1)) out.push(s); return out; }
export const rowsToBars = (rows) => rows.map(([time, open, high, low, close]) => ({ time, open, high, low, close }));
export function indexMarket(key, bars) {
  const first = new Map(), last = new Map();
  bars.forEach((b, i) => { const k = ym(b.time); if (!first.has(k)) first.set(k, i); last.set(k, i); });
  // monthly returns of the ranked asset (inverted for a USD-base pair)
  const ret = new Map();
  for (const [M, i] of last) {
    const j = last.get(shiftYm(M, -1)); if (j == null) continue;
    const a = bars[j].close, b = bars[i].close;
    ret.set(M, INV.has(key) ? a / b - 1 : b / a - 1);
  }
  return { key, group: GROUP_OF[key], bars, first, last, ret };
}

// ─── the signal: mean return in calendar month `mo` ('01'..'12') over years before H's year; null with < MIN_YEARS ───
export function seasonal(mk, H, mo = H.slice(5, 7), { dedrift = false } = {}) {
  const S = shiftYm(H, -1); if (!mk.last.has(S)) return null;
  const Y = +H.slice(0, 4), v = [], all = [];
  for (const [M, r] of mk.ret) {
    const y = +M.slice(0, 4); if (y >= Y) continue;
    if (M.slice(5, 7) === mo) v.push(r);
    all.push(r);
  }
  if (v.length < P.MIN_YEARS) return null;
  const m = v.reduce((a, b) => a + b, 0) / v.length;
  return dedrift ? m - all.reduce((a, b) => a + b, 0) / all.length : m;
}
export function rankGroup(mks, H, opt = {}) {
  const r = [];
  for (const mk of mks) { const v = seasonal(mk, H, opt.mo || H.slice(5, 7), opt); if (v != null && Number.isFinite(v)) r.push({ key: mk.key, k: MARKETS.indexOf(mk.key), v }); }
  return r.sort((x, y) => y.v - x.v || x.k - y.k).map((x) => x.key);
}
export function thirds(ranked) { const k = Math.floor(ranked.length / 3); return { long: ranked.slice(0, k), short: k ? ranked.slice(-k) : [] }; }

export function atr(bars, d, n = P.ATR_N) {
  if (d - n < 0) return null;
  let s = 0;
  for (let i = d - n + 1; i <= d; i++) { const b = bars[i], pc = bars[i - 1].close; s += Math.max(b.high - b.low, Math.abs(b.high - pc), Math.abs(b.low - pc)); }
  return s / n;
}
// one leg on the instrument: entry at bars[e].open, stop at dist (gap fill at the open), else out at bars[x].close
export function simLeg(bars, e, x, side, dist) {
  const entry = bars[e].open, stop = side > 0 ? entry - dist : entry + dist;
  for (let i = e; i <= x; i++) {
    const b = bars[i];
    if (side > 0 && b.low <= stop) { const gap = b.open <= stop; return { entry, stop, exit: gap ? b.open : stop, exitIdx: i, how: gap ? 'gap' : 'stop' }; }
    if (side < 0 && b.high >= stop) { const gap = b.open >= stop; return { entry, stop, exit: gap ? b.open : stop, exitIdx: i, how: gap ? 'gap' : 'stop' }; }
  }
  return { entry, stop, exit: bars[x].close, exitIdx: x, how: 'close' };
}
export const exitTime = (t, how) => (how === 'close' ? t + DAY : how === 'gap' ? t : t + DAY / 2);

// side = +1 long the ranked asset (for an inverted pair that is a short pair)
export function leg(mk, H, side) {
  const S = shiftYm(H, -1), d = mk.last.get(S), e = mk.first.get(H), x = mk.last.get(H);
  if (d == null || e == null || x == null) return null;
  const a = atr(mk.bars, d); if (!a) return null;
  const ps = INV.has(mk.key) ? -side : side, dist = P.ATR_MULT * a, L = simLeg(mk.bars, e, x, ps, dist);
  if (!(dist > 0) || !(ps > 0 ? L.stop < L.entry : L.stop > L.entry)) throw new Error(`leg without a stop on the losing side: ${mk.key} ${H}`);
  const gross = (ps * (L.exit - L.entry)) / dist;
  const costR = (costFrac(mk.key, L.entry) * L.entry) / dist;
  const t0 = mk.bars[e].time, n = nights(t0, exitTime(mk.bars[L.exitIdx].time, L.how));
  const finR = (n * finNight(mk.key, ps, t0) * L.entry) / dist;
  return { key: mk.key, group: mk.group, side, gross, costR, finR, nights: n, how: L.how };
}

// ─── the book: one row per holding month, legs of every group (each ranked within its group) ───
export function runBook(mks, months, { moOf = (H) => H.slice(5, 7), dedrift = false } = {}) {
  const out = [];
  for (const H of months) {
    const mo = moOf(H), legs = [], missing = [], picks = {};
    for (const g of Object.keys(GROUPS)) {
      const gm = mks.filter((m) => m.group === g), ranked = rankGroup(gm, H, { mo, dedrift }), pk = thirds(ranked);
      picks[g] = { ranked: ranked.length, long: pk.long, short: pk.short };
      const by = Object.fromEntries(gm.map((m) => [m.key, m]));
      for (const [ks, side] of [[pk.long, 1], [pk.short, -1]]) for (const k of ks) { const l = leg(by[k], H, side); if (l) legs.push(l); else missing.push(k); }
    }
    if (legs.length) out.push({ month: H, picks, missing, legs });
  }
  return out;
}
export const netOf = (l, k = 1) => l.gross - k * (l.costR + l.finR);
const inBook = (l, b) => b === 'all' || l.group === b;
export function monthSum(m, k = 1, b = 'all') { return m.legs.filter((l) => inBook(l, b)).reduce((s, l) => s + netOf(l, k), 0); }
export function monthSums(book, win, k = 1, b = 'all') {
  const by = new Map(book.map((m) => [m.month, m]));
  return monthsBetween(win.from, win.to).map((M) => (by.has(M) ? monthSum(by.get(M), k, b) : 0));
}

// ─── statistics ───
export function neweyWestT(v, lags = P.NW_LAGS) {
  const n = v.length; if (n < 2) return 0;
  const mu = v.reduce((a, b) => a + b, 0) / n, e = v.map((x) => x - mu);
  const g = (l) => { let s = 0; for (let i = l; i < n; i++) s += e[i] * e[i - l]; return s / n; };
  let lrv = g(0); for (let l = 1; l <= lags; l++) lrv += 2 * (1 - l / (lags + 1)) * g(l);
  return lrv > 0 ? mu / Math.sqrt(lrv / n) : 0;
}
const rd = (v, k = 3) => +v.toFixed(k);
export function stats(vals) {
  const n = vals.length; if (!n) return { n: 0 };
  const mean = vals.reduce((a, b) => a + b, 0) / n;
  const sd = n > 1 ? Math.sqrt(vals.reduce((a, b) => a + (b - mean) ** 2, 0) / (n - 1)) : 0;
  let cum = 0, peak = 0, dd = 0; for (const v of vals) { cum += v; peak = Math.max(peak, cum); dd = Math.min(dd, cum - peak); }
  return { n, mean: rd(mean, 4), total: rd(cum, 2), t: sd ? rd((mean / sd) * Math.sqrt(n), 2) : 0, tNW: rd(neweyWestT(vals), 2), sharpe: sd ? rd((mean / sd) * Math.sqrt(12), 2) : 0, dd: rd(dd, 2), posPct: rd((vals.filter((v) => v > 0).length / n) * 100, 1) };
}
// two-sided normal p of t (Abramowitz-Stegun 7.1.26 for erf)
export function pOfT(t) {
  const x = Math.abs(t) / Math.SQRT2, u = 1 / (1 + 0.3275911 * x);
  const erf = 1 - (((((1.061405429 * u - 1.453152027) * u) + 1.421413741) * u - 0.284496736) * u + 0.254829592) * u * Math.exp(-x * x);
  return Math.min(1, Math.max(0, 1 - erf));
}
export function holm(ps) {
  const idx = ps.map((p, i) => [p, i]).sort((a, b) => a[0] - b[0]), m = ps.length, adj = new Array(m);
  let run = 0;
  idx.forEach(([p, i], r) => { run = Math.max(run, Math.min(1, (m - r) * p)); adj[i] = run; });
  return adj;
}
export function percentile(vals, q) { const s = [...vals].sort((a, b) => a - b), h = (s.length - 1) * q, lo = Math.floor(h); return lo + 1 < s.length ? s[lo] + (h - lo) * (s[lo + 1] - s[lo]) : s[lo]; }
export function mulberry32(seed) { let a = seed >>> 0; return () => { a = (a + 0x6d2b79f5) >>> 0; let t = a; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; }
// a random OTHER calendar month for each holding month (one draw a month, shared by the groups)
export function otherMonth(rng) { return (H) => { const own = +H.slice(5, 7), o = 1 + Math.floor(rng() * 11); return String(o >= own ? o + 1 : o).padStart(2, '0'); }; }

function legStats(ms, b) {
  const legs = ms.flatMap((m) => m.legs.filter((l) => inBook(l, b))), n = legs.length;
  if (!n) return { n: 0 };
  const avg = (f) => rd(legs.reduce((s, l) => s + f(l), 0) / n, 4);
  return {
    n, long: legs.filter((l) => l.side > 0).length, short: legs.filter((l) => l.side < 0).length,
    winPct: rd((legs.filter((l) => netOf(l) > 0).length / n) * 100, 1),
    stopped: legs.filter((l) => l.how !== 'close').length, gapFills: legs.filter((l) => l.how === 'gap').length,
    avgGross: avg((l) => l.gross), avgCost: avg((l) => l.costR), avgFin: avg((l) => l.finR), avgNet: avg((l) => netOf(l)), avgNet2x: avg((l) => netOf(l, 2)),
    longNet: rd(legs.filter((l) => l.side > 0).reduce((s, l) => s + netOf(l), 0), 2), shortNet: rd(legs.filter((l) => l.side < 0).reduce((s, l) => s + netOf(l), 0), 2),
  };
}
export function windowSummary(book, win, b = 'all') {
  const ms = book.filter((m) => m.month >= win.from && m.month <= win.to);
  return {
    from: win.from, to: win.to, months: monthsBetween(win.from, win.to).length, traded: ms.filter((m) => m.legs.some((l) => inBook(l, b))).length,
    gross: stats(monthSums(book, win, 0, b)), net: stats(monthSums(book, win, 1, b)), net2x: stats(monthSums(book, win, 2, b)), legs: legStats(ms, b),
  };
}
function perMarket(book, win) {
  const o = Object.fromEntries(MARKETS.map((k) => [k, { long: 0, short: 0, netR: 0 }]));
  for (const m of book) if (m.month >= win.from && m.month <= win.to) for (const l of m.legs) { const r = o[l.key]; r[l.side > 0 ? 'long' : 'short']++; r.netR += netOf(l); }
  for (const k of MARKETS) o[k].netR = rd(o[k].netR, 2);
  return o;
}
function perYear(book) {
  const o = {};
  for (const m of book) { if (m.month > OOS.to) continue; const y = m.month.slice(0, 4); (o[y] ||= { months: 0, legs: 0, gross: 0, net: 0 }); o[y].months++; o[y].legs += m.legs.length; o[y].gross += monthSum(m, 0); o[y].net += monthSum(m, 1); }
  for (const y in o) { o[y].gross = rd(o[y].gross, 2); o[y].net = rd(o[y].net, 2); }
  return o;
}

// ─── the whole study ───
export function study(mks, lastCandle) {
  const all = monthsBetween('2003-01', OOS.to), book = runBook(mks, all);
  const start = book.find((m) => m.month <= OOS.to)?.month;
  const IS = { from: start, to: IS_TO }, books = {};
  for (const b of BOOKS) {
    const bIS = book.find((m) => m.legs.some((l) => inBook(l, b)))?.month;
    books[b] = { firstMonth: bIS, is: windowSummary(book, { from: start, to: IS_TO }, b), oos: windowSummary(book, OOS, b) };
  }
  const ps = BOOKS.map((b) => pOfT(books[b].oos.net.t)), adj = holm(ps);
  BOOKS.forEach((b, i) => {
    const B = books[b];
    B.p = rd(ps[i], 4); B.holmP = rd(adj[i], 4);
    B.lines = { oosT2Holm: B.oos.net.t >= 2 && adj[i] < P.ALPHA, isPositive: B.is.net.mean > 0, oos2xPositive: B.oos.net2x.mean > 0 };
  });
  const oosMonths = monthsBetween(OOS.from, OOS.to), placebo = [];
  for (let s = 1; s <= P.SEEDS; s++) {
    const b = runBook(mks, oosMonths, { moOf: otherMonth(mulberry32(s)) }), v = monthSums(b, OOS, 1);
    placebo.push({ seed: s, mean: rd(v.reduce((a, c) => a + c, 0) / v.length, 4), t: stats(v).t });
  }
  const pm = placebo.map((p) => p.mean), real = books.all.oos.net.mean, beaten = pm.filter((x) => real > x).length;
  const checks = { ...books.all.lines, beatsPlacebo: beaten >= P.BEAT };
  const dd = runBook(mks, all, { dedrift: true }), dedrift = {};
  for (const b of BOOKS) dedrift[b] = { is: windowSummary(dd, { from: start, to: IS_TO }, b).net, oos: windowSummary(dd, OOS, b).net };
  return {
    study: 'xs-seasonality', built: '2026-11-14', lastCandle,
    rule: 'within each asset group rank by the mean return of the coming calendar month over past years (>= 5), long the top third / short the bottom third, 1R = stop = 3 x ATR(20), monthly; primary = all groups',
    params: P, groups: GROUPS, inverted: [...INV],
    data: Object.fromEntries(mks.map((m) => [m.key, { first: ym(m.bars[0].time), last: new Date(m.bars.at(-1).time * 1000).toISOString().slice(0, 10), candles: m.bars.length }])),
    windows: { is: IS, oos: OOS }, books,
    placebo: { seeds: P.SEEDS, real, beaten, p5: rd(percentile(pm, 0.05), 4), p50: rd(percentile(pm, 0.5), 4), p95: rd(percentile(pm, 0.95), 4), max: rd(Math.max(...pm), 4), runs: placebo },
    checks, verdict: Object.values(checks).every(Boolean) ? 'PASS' : 'FAIL',
    byYear: perYear(book), byMarket: { is: perMarket(book, IS), oos: perMarket(book, OOS) }, dedrift,
    months: book.map((m) => ({ month: m.month, picks: m.picks, legs: m.legs.length, gross: rd(monthSum(m, 0), 4), net: rd(monthSum(m, 1), 4) })),
  };
}

// ─── the report (RESULT.md is this function's output; the test regenerates it from result.json) ───
export function report(R) {
  const f = (x) => (x == null ? 'n/a' : (x > 0 ? '+' : '') + x), mk = (b) => (b ? 'met' : 'missed'), c = R.checks, L = [];
  const A = R.books.all, I = A.is, O = A.oos;
  L.push('# Cross-sectional return seasonality (same calendar month in past years): result', '');
  L.push(`**Verdict: ${R.verdict}: all four groups' book made ${f(O.net.mean)}R a month net out of sample (n ${O.net.n} months, t ${f(O.net.t)}, Holm p ${A.holmP}), in sample ${f(I.net.mean)}R (t ${f(I.net.t)}).**`, '');
  L.push(`Pre-registered bar (primary book): OOS month-sum t >= 2 with Holm p < 0.05 over five tests ${mk(c.oosT2Holm)}; IS net > 0 ${mk(c.isPositive)}; OOS net > 0 at 2x costs ${mk(c.oos2xPositive)}; beats >= ${R.params.BEAT} of ${R.placebo.seeds} placebo runs ${mk(c.beatsPlacebo)}.`, '');
  L.push(`Out of sample ${O.from} to ${O.to} (${O.months} months, ${O.legs.n} trades): ${f(O.legs.avgNet)}R a trade net (gross ${f(O.legs.avgGross)}R, spread ${O.legs.avgCost}R, financing ${O.legs.avgFin}R); gross ${f(O.gross.mean)}R a month (t ${f(O.gross.t)}), net ${f(O.net.mean)}R (t ${f(O.net.t)}, Newey-West ${f(O.net.tNW)}), at 2x costs ${f(O.net2x.mean)}R; total net ${f(O.net.total)}R.`);
  L.push(`In sample ${I.from} to ${I.to} (${I.months} months, ${I.legs.n} trades): ${f(I.legs.avgNet)}R a trade net; gross ${f(I.gross.mean)}R a month (t ${f(I.gross.t)}), net ${f(I.net.mean)}R (t ${f(I.net.t)}), total ${f(I.net.total)}R.`);
  L.push(`Placebo (${R.placebo.seeds} seeds, each month ranked on a random OTHER calendar month's past average, same thirds, stops and costs): the real OOS mean beats ${R.placebo.beaten} of ${R.placebo.seeds}; placebo 5th / 50th / 95th percentile ${f(R.placebo.p5)} / ${f(R.placebo.p50)} / ${f(R.placebo.p95)}R a month.`, '');
  L.push('Every trade has a stop at 1R = 3 x ATR(20) from its entry. Net of a round trip (index 0.04 %, gold $0.30, silver $0.03, other commodities 0.06 %, FX majors the demo raw-spread model, SEK / NOK 0.04 %) and overnight financing (index: policy rate + 2.5 % long, max(0, 2.5 % - rate) short; gold long the demo broker\'s measured rate; other commodities 3 % a year both sides; FX 0.004 % a night both sides). Paper research: no live rule, size, filter, stop or council member changed.', '');
  L.push('## The five tests (net R, base costs; Holm over the five)', '');
  L.push('| Book | First month | IS months / trades | IS gross R a month (t) | IS net R a month (t) | OOS trades | OOS gross R a month (t) | OOS net R a month (t) | OOS 2x R a month | p | Holm p | Lines |', '|---|---|---|---|---|---|---|---|---|---|---|---|');
  for (const b of Object.keys(R.books)) {
    const B = R.books[b], l = B.lines;
    L.push(`| ${b} | ${B.firstMonth} | ${B.is.months} / ${B.is.legs.n} | ${f(B.is.gross.mean)} (${f(B.is.gross.t)}) | ${f(B.is.net.mean)} (${f(B.is.net.t)}) | ${B.oos.legs.n} | ${f(B.oos.gross.mean)} (${f(B.oos.gross.t)}) | ${f(B.oos.net.mean)} (${f(B.oos.net.t)}) | ${f(B.oos.net2x.mean)} | ${B.p} | ${B.holmP} | t/Holm ${mk(l.oosT2Holm)}, IS ${mk(l.isPositive)}, 2x ${mk(l.oos2xPositive)} |`);
  }
  L.push('', '## Per trade', '', '| Book | Window | Trades (long / short) | Win % | Gross R | Spread R | Financing R | Net R | Net 2x R | Stops (gap) | Long net R | Short net R |', '|---|---|---|---|---|---|---|---|---|---|---|---|');
  for (const b of Object.keys(R.books)) for (const [wn, w] of [['IS', R.books[b].is], ['OOS', R.books[b].oos]]) { const g = w.legs; if (!g.n) continue; L.push(`| ${b} | ${wn} | ${g.n} (${g.long} / ${g.short}) | ${g.winPct} | ${f(g.avgGross)} | ${g.avgCost} | ${g.avgFin} | ${f(g.avgNet)} | ${f(g.avgNet2x)} | ${g.stopped} (${g.gapFills}) | ${f(g.longNet)} | ${f(g.shortNet)} |`); }
  L.push('', '## Primary book: month sums', '', '| Window | Costs | Mean R a month | t | Newey-West t | Sharpe | Positive months % | Total R | Worst drawdown R |', '|---|---|---|---|---|---|---|---|---|');
  for (const [n, w] of [['In sample', I], ['Out of sample', O]]) for (const [cn, s] of [['0', w.gross], ['base', w.net], ['2x', w.net2x]]) L.push(`| ${n} | ${cn} | ${f(s.mean)} | ${f(s.t)} | ${f(s.tNW)} | ${f(s.sharpe)} | ${s.posPct} | ${f(s.total)} | ${s.dd} |`);
  L.push('', '## By year (primary, base costs)', '', '| Year | Months | Trades | Gross R | Net R |', '|---|---|---|---|---|');
  for (const [y, v] of Object.entries(R.byYear)) L.push(`| ${y} | ${v.months} | ${v.legs} | ${f(v.gross)} | ${f(v.net)} |`);
  L.push('', '## By market (net R, base costs)', '', '| Market | Group | IS long / short | IS net R | OOS long / short | OOS net R |', '|---|---|---|---|---|---|');
  for (const [g, ks] of Object.entries(R.groups)) for (const k of ks) { const a = R.byMarket.is[k], b = R.byMarket.oos[k]; L.push(`| ${k} | ${g} | ${a.long} / ${a.short} | ${f(a.netR)} | ${b.long} / ${b.short} | ${f(b.netR)} |`); }
  L.push('', '## De-drifted variant (reported only, never deciding)', '', 'Ranked on the same-month average minus the market\'s average over all months of the same past years.', '', '| Book | IS net R a month (t) | OOS net R a month (t) |', '|---|---|---|');
  for (const [b, v] of Object.entries(R.dedrift)) L.push(`| ${b} | ${f(v.is.mean)} (${f(v.is.t)}) | ${f(v.oos.mean)} (${f(v.oos.t)}) |`);
  L.push('', '## Reading', '');
  if (R.verdict === 'PASS') L.push('- The bar was met: a paper shadow book may be proposed to the owner (`research/proposals/`). With 333 decisive tests already run in this repository it is a lead to replicate, not an edge without a forward record.');
  else L.push('- The pre-registered bar was not met: no proposal is written and nothing changes. A FAIL is not evidence that the opposite works. Another universe, look-back, minimum history, stop or weighting would be a new study with its own pre-registration on data it was not chosen on.');
  L.push('- The backlog (candidate 3) named cost as the weak point: compare the gross and net columns above to see how much of any effect the spread and financing take.');
  L.push('- The placebo ranks on another calendar month\'s past average, so it keeps each market\'s long-run drift and the book\'s shape, stops and costs: it shows what the same-month part adds over a ranking on the market\'s general past.');
  L.push('', '## What this cannot show', '');
  L.push('- Price indices without dividends; each index in its own currency; approximate policy rates; assumed spreads for most CFDs; FX without the rate differential; unadjusted commodity rolls.');
  L.push('- 3 to 13 markets a group and at most about 8 to 17 past years per average: a small cross-section and a short history next to the published ones.');
  L.push('', 'To repeat: `node research/edge/xs-seasonality/run.mjs` (reads council-data with `git show`, no network). Tests: `tests/xs-seasonality.test.mjs`.', '');
  return L.join('\n');
}

// ─── data ───
const gitRead = (k) => execFileSync('git', ['show', `origin/council-data:research/daily/${k}.json`], { encoding: 'utf8', maxBuffer: 64 << 20 });
export function loadMarkets(read = gitRead) { return MARKETS.map((k) => indexMarket(k, foldWeekend(rowsToBars(JSON.parse(read(k)).rows)))); }

if (process.argv[1] && fs.realpathSync(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const mks = loadMarkets();
  const last = new Date(Math.max(...mks.map((m) => m.bars.at(-1).time)) * 1000).toISOString().slice(0, 10);
  const res = study(mks, last);
  fs.writeFileSync(new URL('./result.json', import.meta.url), JSON.stringify(res, null, 1) + '\n');
  fs.writeFileSync(new URL('./RESULT.md', import.meta.url), report(res));
  console.log(res.verdict, res.checks);
  for (const b of BOOKS) { const B = res.books[b]; console.log(b, B.firstMonth, 'IS', B.is.legs.n, B.is.gross.mean, B.is.net.mean, B.is.net.t, '| OOS', B.oos.legs.n, B.oos.gross.mean, B.oos.gross.t, B.oos.net.mean, B.oos.net.t, B.oos.net2x.mean, 'holm', B.holmP); }
  console.log('placebo', { ...res.placebo, runs: undefined });
}
