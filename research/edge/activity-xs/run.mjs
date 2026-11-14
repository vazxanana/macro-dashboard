// Activity across index CFDs, weekly cross-section (pre-registered 14 Nov 2026, PREREGISTRATION.md, pushed first).
// At each week's last close rank 14 index CFDs by (b) abnormal activity = mean quote count of the last 20 candles / mean of
// the last 250 (primary) or (a) Amihud illiquidity = mean of |log return| / quote count over the last 20 candles (secondary);
// long the top third, short the bottom third for the next week, 1R = stop = 3 x ATR(20); net of a 0.04 % round trip and
// overnight financing (long r + 2.5 %, short max(0, 2.5 % - r)). OANDA's `v` is a quote count: a proxy for activity.
//   node research/edge/activity-xs/run.mjs      reads council-data with git show, writes result.json and RESULT.md
// Paper research only: nothing live reads this file.
import fs from 'node:fs';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { nights } from '../../../council/fills.mjs';

export const MARKETS = ['spx500', 'nas100', 'us30', 'us2000', 'de40', 'uk100', 'fr40', 'eu50', 'ch20', 'nl25', 'jp225', 'au200', 'hk33', 'sg30'];
export const P = { SHORT: 20, LONG: 250, MIN_V: 10, MIN_RANKED: 9, ATR_N: 20, ATR_MULT: 3, COST_FRAC: 0.0004, MARKUP: 2.5, SEEDS: 40, NW_LAGS: 3 };
export const IS = { from: '2004-01', to: '2016-12' };
export const OOS = { from: '2017-01', to: '2026-10' };
export const CCY = {
  spx500: 'USD', nas100: 'USD', us30: 'USD', us2000: 'USD', jp225: 'USD', de40: 'EUR', fr40: 'EUR', eu50: 'EUR', nl25: 'EUR',
  uk100: 'GBP', ch20: 'CHF', au200: 'AUD', hk33: 'HKD', sg30: 'SGD',
};
// approximate year-average policy rates, %, columns USD EUR GBP AUD HKD CHF SGD: the table of index-xs-momentum, unchanged
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
export function finRate(key, side, t) {
  const r = cashRate(CCY[key], new Date(t * 1000).getUTCFullYear());
  return (side > 0 ? r + P.MARKUP : Math.max(0, P.MARKUP - r)) / 100;
}
const DAY = 86400, WEEK = 7 * DAY;

// ─── candles: weekend stubs folded into the next weekday, their quote count added to it ───
export const rowsToBars = (rows) => rows.map(([time, open, high, low, close, v]) => ({ time, open, high, low, close, v }));
export function foldWeekendV(bars) {
  const out = []; let w = null;
  for (const b of bars) {
    const wd = new Date(b.time * 1000).getUTCDay();
    if (wd === 0 || wd === 6) { w = w ? { open: w.open, high: Math.max(w.high, b.high), low: Math.min(w.low, b.low), v: w.v + b.v } : { open: b.open, high: b.high, low: b.low, v: b.v }; continue; }
    out.push(w ? { ...b, open: w.open, high: Math.max(w.high, b.high), low: Math.min(w.low, b.low), v: b.v + w.v } : b); w = null;
  }
  return out;
}
// week key = the Monday 00:00 UTC of the candle's week
export const weekOf = (t) => { const d = Math.floor(t / DAY), wd = (new Date(t * 1000).getUTCDay() + 6) % 7; return (d - wd) * DAY; };
export const ym = (t) => new Date(t * 1000).toISOString().slice(0, 7);
export function indexMarket(key, bars) {
  const first = new Map(), last = new Map();
  bars.forEach((b, i) => { const w = weekOf(b.time); if (!first.has(w)) first.set(w, i); last.set(w, i); });
  return { key, bars, first, last };
}

// ─── the two measures at candle d (candles up to and including d only) ───
export function abnormal(bars, d) {
  if (d - P.LONG + 1 < 0) return null;
  let s = 0, l = 0;
  for (let i = d - P.LONG + 1; i <= d; i++) { const v = bars[i].v; if (!(v >= P.MIN_V)) return null; l += v; if (i > d - P.SHORT) s += v; }
  return s / P.SHORT / (l / P.LONG);
}
export function amihud(bars, d) {
  if (abnormal(bars, d) == null) return null; // the same 250-candle history and placeholder rule as (b)
  let s = 0;
  for (let i = d - P.SHORT + 1; i <= d; i++) s += Math.abs(Math.log(bars[i].close / bars[i - 1].close)) / bars[i].v;
  return s / P.SHORT;
}
export const MEASURES = { b: abnormal, a: amihud };

export function rankAt(mks, W, measure) {
  const r = [];
  mks.forEach((mk) => { const d = mk.last.get(W); if (d == null) return; const v = measure(mk.bars, d); if (v != null && Number.isFinite(v)) r.push({ key: mk.key, k: MARKETS.indexOf(mk.key), r: v }); });
  return r.sort((x, y) => y.r - x.r || x.k - y.k).map((x) => x.key);
}
export function thirds(ranked) { const k = Math.floor(ranked.length / 3); return { long: ranked.slice(0, k), short: k ? ranked.slice(-k) : [] }; }

export function atr(bars, d, n = P.ATR_N) {
  if (d - n < 0) return null;
  let s = 0;
  for (let i = d - n + 1; i <= d; i++) { const b = bars[i], pc = bars[i - 1].close; s += Math.max(b.high - b.low, Math.abs(b.high - pc), Math.abs(b.low - pc)); }
  return s / n;
}

// ─── one leg: entry at bars[e].open, stop at 1R (gap fill at the open), else out at bars[x].close ───
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

export function leg(mk, W, side) {
  const d = mk.last.get(W), H = W + WEEK, e = mk.first.get(H), x = mk.last.get(H);
  if (d == null || e == null || x == null) return null;
  const a = atr(mk.bars, d); if (!a) return null;
  const dist = P.ATR_MULT * a, L = simLeg(mk.bars, e, x, side, dist);
  if (!(dist > 0) || !(side > 0 ? L.stop < L.entry : L.stop > L.entry)) throw new Error(`leg without a stop on the losing side: ${mk.key} ${W}`);
  const gross = (side * (L.exit - L.entry)) / dist;
  const costR = (P.COST_FRAC * L.entry) / dist;
  const t0 = mk.bars[e].time, n = nights(t0, exitTime(mk.bars[L.exitIdx].time, L.how));
  const finR = (n * (finRate(mk.key, side, t0) / 365) * L.entry) / dist;
  return { key: mk.key, side, gross, costR, finR, nights: n, how: L.how };
}

// ─── the book: one row per holding week (signal week W, held W + 1), booked in the month of the holding Monday ───
export function allWeeks(mks) {
  const s = new Set(); for (const m of mks) for (const w of m.last.keys()) s.add(w);
  return [...s].sort((a, b) => a - b);
}
export function runBook(mks, measure, { pick = thirds, weeks = allWeeks(mks) } = {}) {
  const byKey = Object.fromEntries(mks.map((m) => [m.key, m])), out = [];
  for (const W of weeks) {
    const ranked = rankAt(mks, W, measure);
    if (ranked.length < P.MIN_RANKED) continue;
    const pk = pick(ranked), legs = [];
    for (const [ks, side] of [[pk.long, 1], [pk.short, -1]]) for (const k of ks) { const l = leg(byKey[k], W, side); if (l) legs.push(l); }
    if (!legs.length) continue;
    out.push({ week: new Date((W + WEEK) * 1000).toISOString().slice(0, 10), month: ym(W + WEEK), ranked: ranked.length, long: pk.long, short: pk.short, legs });
  }
  return out;
}
export const netOf = (l, k = 1) => l.gross - k * (l.costR + l.finR);
export const weekSum = (w, k = 1, side = 0) => w.legs.reduce((s, l) => s + (side && l.side !== side ? 0 : netOf(l, k)), 0);

// ─── calendar ───
export function shiftYm(s, k) { const [y, m] = s.split('-').map(Number), n = y * 12 + (m - 1) + k; return `${Math.floor(n / 12)}-${String((n % 12) + 1).padStart(2, '0')}`; }
export function monthsBetween(from, to) { const out = []; for (let s = from; s <= to; s = shiftYm(s, 1)) out.push(s); return out; }
// calendar-month sums over a window; a month with no week = 0; the window starts at its first traded month
export function monthSums(book, win, k = 1, side = 0) {
  const by = new Map(); for (const w of book) by.set(w.month, (by.get(w.month) || 0) + weekSum(w, k, side));
  const traded = book.filter((w) => w.month >= win.from && w.month <= win.to);
  if (!traded.length) return [];
  return monthsBetween(traded[0].month < win.from ? win.from : traded[0].month, win.to).map((M) => by.get(M) || 0);
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
  const n = vals.length; if (!n) return { n: 0, mean: 0, t: 0 };
  const mean = vals.reduce((a, b) => a + b, 0) / n;
  const sd = n > 1 ? Math.sqrt(vals.reduce((a, b) => a + (b - mean) ** 2, 0) / (n - 1)) : 0;
  let cum = 0, peak = 0, dd = 0; for (const v of vals) { cum += v; peak = Math.max(peak, cum); dd = Math.min(dd, cum - peak); }
  return { n, mean: rd(mean, 4), total: rd(cum, 2), t: sd ? rd((mean / sd) * Math.sqrt(n), 2) : 0, tNW: rd(neweyWestT(vals), 2), dd: rd(dd, 2), posPct: rd((vals.filter((v) => v > 0).length / n) * 100, 1) };
}
// two-sided p from a t, normal approximation (Abramowitz-Stegun 7.1.26)
export function pOf(t) {
  const x = Math.abs(t) / Math.SQRT2, k = 1 / (1 + 0.3275911 * x);
  const erf = 1 - (((((1.061405429 * k - 1.453152027) * k) + 1.421413741) * k - 0.284496736) * k + 0.254829592) * k * Math.exp(-x * x);
  return 1 - erf;
}
export function holm(ps) {
  const o = ps.map((p, i) => ({ p, i })).sort((a, b) => a.p - b.p), out = Array(ps.length); let run = 0;
  o.forEach((x, r) => { run = Math.max(run, Math.min(1, (ps.length - r) * x.p)); out[x.i] = run; });
  return out;
}
export function percentile(vals, q) { const s = [...vals].sort((a, b) => a - b), h = (s.length - 1) * q, lo = Math.floor(h); return lo + 1 < s.length ? s[lo] + (h - lo) * (s[lo + 1] - s[lo]) : s[lo]; }
export function mulberry32(seed) { let a = seed >>> 0; return () => { a = (a + 0x6d2b79f5) >>> 0; let t = a; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; }
export function randomPick(rng) { return (ranked) => { const c = [...ranked]; for (let i = c.length - 1; i > 0; i--) { const j = Math.floor(rng() * (i + 1)); [c[i], c[j]] = [c[j], c[i]]; } return thirds(c); }; }

function legStats(ws) {
  const legs = ws.flatMap((w) => w.legs), n = legs.length; if (!n) return { n: 0 };
  const avg = (f) => rd(legs.reduce((s, l) => s + f(l), 0) / n, 4);
  return {
    n, long: legs.filter((l) => l.side > 0).length, short: legs.filter((l) => l.side < 0).length,
    winPct: rd((legs.filter((l) => netOf(l) > 0).length / n) * 100, 1),
    stopped: legs.filter((l) => l.how !== 'close').length, gapFills: legs.filter((l) => l.how === 'gap').length,
    avgGross: avg((l) => l.gross), avgCost: avg((l) => l.costR), avgFin: avg((l) => l.finR), avgNet: avg((l) => netOf(l)), avgNet2x: avg((l) => netOf(l, 2)),
    longNet: rd(legs.filter((l) => l.side > 0).reduce((s, l) => s + netOf(l), 0), 2), shortNet: rd(legs.filter((l) => l.side < 0).reduce((s, l) => s + netOf(l), 0), 2),
  };
}
export function windowSummary(book, win) {
  const ws = book.filter((w) => w.month >= win.from && w.month <= win.to);
  const net = monthSums(book, win, 1);
  return {
    from: ws.length ? ws[0].month : win.from, to: win.to, months: net.length, weeks: ws.length,
    gross: stats(monthSums(book, win, 0)), net: stats(net), net2x: stats(monthSums(book, win, 2)),
    longNet: stats(monthSums(book, win, 1, 1)), shortNet: stats(monthSums(book, win, 1, -1)),
    legs: legStats(ws),
  };
}
// how often the long / short sets change from one week to the next
function turnover(book) {
  let ch = 0, n = 0;
  for (let i = 1; i < book.length; i++) { const a = book[i - 1], b = book[i]; n++; if (a.long.join() !== b.long.join() || a.short.join() !== b.short.join()) ch++; }
  return { weeks: n, changed: ch, changedPct: n ? rd((ch / n) * 100, 1) : 0 };
}
function holdShare(book, win) {
  const o = Object.fromEntries(MARKETS.map((k) => [k, { long: 0, short: 0 }]));
  for (const w of book) if (w.month >= win.from && w.month <= win.to) { for (const k of w.long) o[k].long++; for (const k of w.short) o[k].short++; }
  return o;
}
function perYear(book) {
  const o = {};
  for (const w of book) { if (w.month > OOS.to) continue; const y = w.month.slice(0, 4); (o[y] ||= { weeks: 0, gross: 0, net: 0 }); o[y].weeks++; o[y].gross += weekSum(w, 0); o[y].net += weekSum(w, 1); }
  for (const y in o) { o[y].gross = rd(o[y].gross, 2); o[y].net = rd(o[y].net, 2); }
  return o;
}

// ─── the whole study ───
export function study(mks, lastCandle) {
  const weeks = allWeeks(mks), tests = {}, books = {};
  for (const [id, m] of [['T1', 'b'], ['T2', 'a']]) {
    const book = runBook(mks, MEASURES[m], { weeks });
    books[id] = book;
    const is = windowSummary(book, IS), oos = windowSummary(book, OOS);
    const placebo = [];
    for (let s = 1; s <= P.SEEDS; s++) {
      const b = runBook(mks, MEASURES[m], { weeks, pick: randomPick(mulberry32(s)) }), v = monthSums(b, OOS, 1);
      placebo.push(rd(v.reduce((a, c) => a + c, 0) / v.length, 4));
    }
    tests[id] = {
      measure: m === 'b' ? 'abnormal activity (20-day / 250-day mean quote count), long the highest third' : 'Amihud illiquidity (20-day mean |log return| / quote count), long the highest third',
      is, oos, p: rd(pOf(oos.net.t), 5),
      placebo: { seeds: P.SEEDS, real: oos.net.mean, beaten: placebo.filter((x) => oos.net.mean > x).length, p5: rd(percentile(placebo, 0.05), 4), p50: rd(percentile(placebo, 0.5), 4), p95: rd(percentile(placebo, 0.95), 4), runs: placebo },
      turnover: turnover(book), holds: { is: holdShare(book, IS), oos: holdShare(book, OOS) }, byYear: perYear(book),
    };
  }
  const hp = holm([tests.T1.p, tests.T2.p]);
  for (const [i, id] of ['T1', 'T2'].entries()) {
    const T = tests[id]; T.holmP = rd(hp[i], 5);
    T.checks = { oosT2Holm: T.oos.net.t >= 2 && T.holmP <= 0.05, isSameSign: T.is.net.mean > 0, oos2xPositive: T.oos.net2x.mean > 0 };
    T.passes = Object.values(T.checks).every(Boolean);
  }
  return {
    study: 'activity-xs', built: '2026-11-14', lastCandle,
    rule: 'weekly cross-section of 14 index CFDs ranked by quote-count activity; long the top third, short the bottom third for one week, equal risk, stop 1R = 3 x ATR(20)',
    params: P, universe: MARKETS, currency: CCY, windows: { is: IS, oos: OOS },
    data: Object.fromEntries(mks.map((m) => [m.key, { first: new Date(m.bars[0].time * 1000).toISOString().slice(0, 10), last: new Date(m.bars.at(-1).time * 1000).toISOString().slice(0, 10), candles: m.bars.length }])),
    tests, verdict: tests.T1.passes ? 'PASS' : 'FAIL',
    weeks: books.T1.map((w) => ({ week: w.week, ranked: w.ranked, long: w.long, short: w.short, net: rd(weekSum(w, 1), 4) })),
  };
}

// ─── the report (RESULT.md is this function's output; the test regenerates it from result.json) ───
export function report(R) {
  const f = (x) => (x == null ? 'n/a' : (x > 0 ? '+' : '') + x), mk = (b) => (b ? 'met' : 'missed'), L = [];
  const pf = (p) => (p < 0.0001 ? '< 0.0001' : String(p));
  const T1 = R.tests.T1, T2 = R.tests.T2;
  L.push('# Activity and relative return across index CFDs (weekly cross-section, quote-count proxy): result', '');
  const sgn = T1.oos.net.t < 0 ? ', the wrong sign' : '';
  L.push(`**Verdict: ${R.verdict}. Primary (abnormal activity) OOS ${f(T1.oos.net.mean)}R a month net, t ${f(T1.oos.net.t)}${sgn} (bar t >= 2), gross t ${f(T1.oos.gross.t)}; Amihud ${f(T2.oos.net.mean)}R, t ${f(T2.oos.net.t)}.**`, '');
  L.push(`Pre-registered bar for the primary (PREREGISTRATION.md, pushed alone first): OOS net month-sum t >= 2 with Holm p <= 0.05 ${mk(T1.checks.oosT2Holm)}; in-sample net mean positive ${mk(T1.checks.isSameSign)}; OOS net positive at 2x costs ${mk(T1.checks.oos2xPositive)}.`, '');
  for (const [id, T] of [['T1 (primary, abnormal activity)', T1], ['T2 (secondary, Amihud illiquidity)', T2]]) {
    L.push(`**${id}.** Out of sample ${T.oos.from} to ${T.oos.to} (${T.oos.months} months, ${T.oos.weeks} weeks, ${T.oos.legs.n} legs): ${f(T.oos.net.mean)}R a month net (gross ${f(T.oos.gross.mean)}R), t ${f(T.oos.net.t)} (Newey-West ${f(T.oos.net.tNW)}), total ${f(T.oos.net.total)}R; at 2x costs ${f(T.oos.net2x.mean)}R a month. In sample ${T.is.from} to ${T.is.to} (${T.is.months} months, ${T.is.legs.n} legs): ${f(T.is.net.mean)}R a month net, t ${f(T.is.net.t)}. Placebo (${T.placebo.seeds} seeds, random order of the same ranked indices each week): the real OOS mean beats ${T.placebo.beaten} of ${T.placebo.seeds}; 5th / 50th / 95th percentile ${f(T.placebo.p5)} / ${f(T.placebo.p50)} / ${f(T.placebo.p95)}R a month.`, '');
  }
  L.push('Every leg has a stop at 1R = 3 x ATR(20) from its entry and is sized to risk 1R (equal risk by inverse ATR). Net of a 0.04 % round trip and overnight financing (long: the quote currency\'s policy rate + 2.5 % a year; short: max(0, 2.5 % - rate); assumed, the table of `index-xs-momentum`). The activity is OANDA\'s daily quote count, a proxy for trading volume, not volume itself. Paper research: no live rule, size, filter, stop or council member changed.', '');
  L.push('## Setup', '');
  L.push(`Universe (every council-data index key with candles from 2008 or earlier): ${R.universe.join(', ')}. Data: council-data \`research/daily/<key>.json\` (OANDA mid daily candles, weekend stubs folded into Monday with their quote count), last candle ${R.lastCandle}. At least ${R.params.MIN_RANKED} indices ranked a week; thirds = floor(N / 3) a side.`, '');
  L.push('| Index | First candle | Last candle | Candles | Currency |', '|---|---|---|---|---|');
  for (const k of R.universe) L.push(`| ${k} | ${R.data[k].first} | ${R.data[k].last} | ${R.data[k].candles} | ${R.currency[k]} |`);
  L.push('', '## The two tests (calendar-month sums of weekly net R)', '');
  L.push('| Test | Window | Costs | Mean R a month | t | Newey-West t | Positive months % | Total R | Worst drawdown R |', '|---|---|---|---|---|---|---|---|---|');
  for (const [id, T] of [['T1', T1], ['T2', T2]]) for (const [wn, w] of [['IS', T.is], ['OOS', T.oos]]) for (const [cn, s] of [['0', w.gross], ['base', w.net], ['2x', w.net2x]]) L.push(`| ${id} | ${wn} | ${cn} | ${f(s.mean)} | ${f(s.t)} | ${f(s.tNW)} | ${s.posPct} | ${f(s.total)} | ${s.dd} |`);
  L.push('', '| Test | OOS t | p | Holm p | t >= 2 after Holm | IS same sign | OOS 2x > 0 | Passes |', '|---|---|---|---|---|---|---|---|');
  for (const [id, T] of [['T1', T1], ['T2', T2]]) L.push(`| ${id} | ${f(T.oos.net.t)} | ${pf(T.p)} | ${pf(T.holmP)} | ${mk(T.checks.oosT2Holm)} | ${mk(T.checks.isSameSign)} | ${mk(T.checks.oos2xPositive)} | ${T.passes ? 'yes' : 'no'} |`);
  L.push('', '## Legs', '', '| Test | Window | Legs (long / short) | Win % | Gross R a leg | Spread R | Financing R | Net R a leg | Net 2x R a leg | Stops (gap) | Long legs net R | Short legs net R |', '|---|---|---|---|---|---|---|---|---|---|---|---|');
  for (const [id, T] of [['T1', T1], ['T2', T2]]) for (const [wn, w] of [['IS', T.is], ['OOS', T.oos]]) L.push(`| ${id} | ${wn} | ${w.legs.n} (${w.legs.long} / ${w.legs.short}) | ${w.legs.winPct} | ${f(w.legs.avgGross)} | ${w.legs.avgCost} | ${w.legs.avgFin} | ${f(w.legs.avgNet)} | ${f(w.legs.avgNet2x)} | ${w.legs.stopped} (${w.legs.gapFills}) | ${f(w.legs.longNet)} | ${f(w.legs.shortNet)} |`);
  L.push('', '## How static the rankings are (reported only)', '');
  L.push(`Weeks whose long or short set differs from the previous week: T1 ${T1.turnover.changed} of ${T1.turnover.weeks} (${T1.turnover.changedPct} %), T2 ${T2.turnover.changed} of ${T2.turnover.weeks} (${T2.turnover.changedPct} %).`, '');
  L.push('| Index | T1 OOS weeks long / short | T2 OOS weeks long / short |', '|---|---|---|');
  for (const k of R.universe) L.push(`| ${k} | ${T1.holds.oos[k].long} / ${T1.holds.oos[k].short} | ${T2.holds.oos[k].long} / ${T2.holds.oos[k].short} |`);
  L.push('', '## By year (net R, base costs)', '', '| Year | T1 weeks | T1 gross R | T1 net R | T2 net R |', '|---|---|---|---|---|');
  for (const [y, v] of Object.entries(T1.byYear)) L.push(`| ${y} | ${v.weeks} | ${f(v.gross)} | ${f(v.net)} | ${f(T2.byYear[y]?.net ?? null)} |`);
  L.push('', '## Reading', '');
  if (R.verdict === 'PASS') L.push('- The bar was met: a paper shadow book may be proposed to the owner (`research/proposals/`); nothing is live, and it is not an edge without a forward record.');
  else L.push('- The pre-registered bar was not met: no proposal is written and nothing changes. A FAIL is not evidence that the opposite works; any other window, holding period or universe would be a new study with its own pre-registration.');
  L.push(`- The \`volume-premium\` line that motivated this (high-activity days on index CFDs followed by higher returns than other days of the same market, OOS t 3.52) was a non-primary, after-the-fact reading; this cross-section does not confirm it as a long-short book: before any cost the primary book made ${f(T1.is.gross.mean)}R a month in sample (t ${f(T1.is.gross.t)}) and ${f(T1.oos.gross.mean)}R out of sample (t ${f(T1.oos.gross.t)}), and it beat ${T1.placebo.beaten} of ${T1.placebo.seeds} random-order books.`);
  L.push('- Measure (a) ranks OANDA\'s quoting rate of each CFD more than the underlying market\'s liquidity, so some indices sit on the same side almost every week (the table above): it is partly a fixed long-short pair of index groups, not a clean test of Amihud\'s effect.');
  L.push('', '## What this cannot show', '');
  L.push('- The quote count is not traded volume; price indices without dividends (a CFD long is credited the dividend, a short pays it; left out on both sides); policy rates are approximate year averages, 2004-06 take the 2007 row; the 0.04 % spread is assumed, not measured.');
  L.push('- Fourteen indices, four or five a side, several of them the same economy (four US, four euro area): a small and correlated cross-section next to the published stock samples.');
  L.push('', 'To repeat: `node research/edge/activity-xs/run.mjs` (reads council-data with `git show`, no network). Tests: `tests/activity-xs.test.mjs`.', '');
  return L.join('\n');
}

// ─── data ───
const gitRead = (k) => execFileSync('git', ['show', `origin/council-data:research/daily/${k}.json`], { encoding: 'utf8', maxBuffer: 64 << 20 });
export function loadMarkets(read = gitRead) { return MARKETS.map((k) => indexMarket(k, foldWeekendV(rowsToBars(JSON.parse(read(k)).rows)))); }

if (process.argv[1] && fs.realpathSync(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const mks = loadMarkets();
  const last = new Date(Math.max(...mks.map((m) => m.bars.at(-1).time)) * 1000).toISOString().slice(0, 10);
  const res = study(mks, last);
  fs.writeFileSync(new URL('./result.json', import.meta.url), JSON.stringify(res, null, 1) + '\n');
  fs.writeFileSync(new URL('./RESULT.md', import.meta.url), report(res));
  console.log(res.verdict);
  for (const id of ['T1', 'T2']) { const T = res.tests[id]; console.log(id, 'IS', T.is.from, T.is.net, 'OOS', T.oos.net, '2x', T.oos.net2x.mean, 'gross', T.oos.gross.mean, T.oos.gross.t, 'holm', T.holmP, 'placebo', T.placebo.beaten, T.placebo.p50, 'turn', T.turnover.changedPct, 'IS gross', T.is.gross.mean, T.is.gross.t); }
}
