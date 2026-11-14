// Cross-sectional momentum across national stock indices, 12-1 months, monthly rebalance (pre-registered 14 Nov 2026,
// PREREGISTRATION.md, pushed first). At each month's last close rank one index CFD per country by close(M-1) / close(M-12) - 1,
// long the top third and short the bottom third at the next month's first open, 1R = stop = 2 x ATR(20), out at the month's
// last close; net of a 0.03 % round trip and overnight financing (long r + 2.5 %, short max(0, 2.5 % - r)).
//   node research/edge/index-xs-momentum/run.mjs      reads council-data with git show, writes result.json and RESULT.md
// Paper research only: nothing live reads this file.
import fs from 'node:fs';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { foldWeekend, nights } from '../../../council/fills.mjs';

export const MARKETS = ['spx500', 'de40', 'uk100', 'fr40', 'ch20', 'nl25', 'es35', 'jp225', 'au200', 'hk33', 'cn50', 'sg30', 'in50'];
export const P = { LOOK: 12, SKIP: 1, MIN_RANKED: 9, ATR_N: 20, ATR_MULT: 2, COST_FRAC: 0.0003, MARKUP: 2.5, SEEDS: 40, BEAT: 38, NW_LAGS: 3 };
export const VARIANTS = { '12-1': 12, '6-1': 6, '3-1': 3 };
export const IS = { from: '2005-04', to: '2015-12' };
export const OOS = { from: '2016-01', to: '2026-10' };
export const CCY = {
  spx500: 'USD', jp225: 'USD', cn50: 'USD', in50: 'USD', de40: 'EUR', fr40: 'EUR', nl25: 'EUR', es35: 'EUR',
  uk100: 'GBP', ch20: 'CHF', au200: 'AUD', hk33: 'HKD', sg30: 'SGD',
};
// approximate year-average policy rates, % (PREREGISTRATION.md table), columns USD EUR GBP AUD HKD CHF SGD
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
// annual financing rate as a fraction for a side (long pays r + markup, short pays max(0, markup - r))
export function finRate(key, side, t) {
  const r = cashRate(CCY[key], new Date(t * 1000).getUTCFullYear());
  return (side > 0 ? r + P.MARKUP : Math.max(0, P.MARKUP - r)) / 100;
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
  return { key, bars, first, last };
}

// ─── the signal (closes up to and including signal month S only) ───
export function momentum(mk, S, look = P.LOOK, skip = P.SKIP) {
  if (!mk.last.has(S)) return null;
  const a = mk.last.get(shiftYm(S, -look)), b = mk.last.get(shiftYm(S, -skip));
  if (a == null || b == null) return null;
  return mk.bars[b].close / mk.bars[a].close - 1;
}
export function rankAt(mks, S, look = P.LOOK) {
  const r = [];
  mks.forEach((mk) => { const v = momentum(mk, S, look); if (v != null && Number.isFinite(v)) r.push({ key: mk.key, k: MARKETS.indexOf(mk.key), r: v }); });
  return r.sort((x, y) => y.r - x.r || x.k - y.k).map((x) => x.key);
}
// top third long, bottom third short (k = floor(N / 3))
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

export function leg(mk, S, H, side) {
  const d = mk.last.get(S), e = mk.first.get(H), x = mk.last.get(H);
  if (d == null || e == null || x == null) return null;
  const a = atr(mk.bars, d); if (!a) return null;
  const dist = P.ATR_MULT * a, L = simLeg(mk.bars, e, x, side, dist);
  if (!(dist > 0) || !(side > 0 ? L.stop < L.entry : L.stop > L.entry)) throw new Error(`leg without a stop on the losing side: ${mk.key} ${H}`);
  const gross = (side * (L.exit - L.entry)) / dist;
  const costR = (P.COST_FRAC * L.entry) / dist;
  const t0 = mk.bars[e].time, n = nights(t0, exitTime(mk.bars[L.exitIdx].time, L.how));
  const finR = (n * (finRate(mk.key, side, t0) / 365) * L.entry) / dist;
  return { key: mk.key, side, gross, costR, finR, nights: n, how: L.how };
}

// ─── the book: one row per holding month H (signal month S = H - 1) ───
export function runBook(mks, months, { look = P.LOOK, pick = thirds } = {}) {
  const byKey = Object.fromEntries(mks.map((m) => [m.key, m])), out = [];
  for (const H of months) {
    const S = shiftYm(H, -1), ranked = rankAt(mks, S, look);
    if (ranked.length < P.MIN_RANKED) continue;
    const pk = pick(ranked), legs = [], missing = [];
    for (const [ks, side] of [[pk.long, 1], [pk.short, -1]]) for (const k of ks) { const l = leg(byKey[k], S, H, side); if (l) legs.push(l); else missing.push(k); }
    if (!legs.length) continue;
    out.push({ month: H, ranked: ranked.length, long: pk.long, short: pk.short, missing, legs });
  }
  return out;
}
export const netOf = (l, k = 1) => l.gross - k * (l.costR + l.finR);
export function monthSum(m, k = 1) { return m.legs.reduce((s, l) => s + netOf(l, k), 0); }
// calendar-month sums over a window; a month with no trade is 0
export function monthSums(book, win, k = 1) {
  const by = new Map(book.map((m) => [m.month, m]));
  return monthsBetween(win.from, win.to).map((M) => (by.has(M) ? monthSum(by.get(M), k) : 0));
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
export function percentile(vals, q) { const s = [...vals].sort((a, b) => a - b), h = (s.length - 1) * q, lo = Math.floor(h); return lo + 1 < s.length ? s[lo] + (h - lo) * (s[lo + 1] - s[lo]) : s[lo]; }
export function mulberry32(seed) { let a = seed >>> 0; return () => { a = (a + 0x6d2b79f5) >>> 0; let t = a; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; }
export function randomPick(rng) { return (ranked) => { const c = [...ranked]; for (let i = c.length - 1; i > 0; i--) { const j = Math.floor(rng() * (i + 1)); [c[i], c[j]] = [c[j], c[i]]; } return thirds(c); }; }

function legStats(ms) {
  const legs = ms.flatMap((m) => m.legs), n = legs.length, avg = (f) => rd(legs.reduce((s, l) => s + f(l), 0) / n, 4);
  return {
    n, long: legs.filter((l) => l.side > 0).length, short: legs.filter((l) => l.side < 0).length,
    winPct: rd((legs.filter((l) => netOf(l) > 0).length / n) * 100, 1),
    stopped: legs.filter((l) => l.how !== 'close').length, gapFills: legs.filter((l) => l.how === 'gap').length,
    avgGross: avg((l) => l.gross), avgCost: avg((l) => l.costR), avgFin: avg((l) => l.finR), avgNet: avg((l) => netOf(l)), avgNet2x: avg((l) => netOf(l, 2)),
    longNet: rd(legs.filter((l) => l.side > 0).reduce((s, l) => s + netOf(l), 0), 2), shortNet: rd(legs.filter((l) => l.side < 0).reduce((s, l) => s + netOf(l), 0), 2),
  };
}
export function windowSummary(book, win) {
  const ms = book.filter((m) => m.month >= win.from && m.month <= win.to);
  return {
    from: win.from, to: win.to, months: monthsBetween(win.from, win.to).length, traded: ms.length,
    gross: stats(monthSums(book, win, 0)), net: stats(monthSums(book, win, 1)), net2x: stats(monthSums(book, win, 2)),
    legs: legStats(ms), missingLegs: ms.reduce((s, m) => s + m.missing.length, 0),
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
  const all = monthsBetween(IS.from, OOS.to), book = runBook(mks, all);
  const I = windowSummary(book, IS), O = windowSummary(book, OOS);
  const oosMonths = monthsBetween(OOS.from, OOS.to), placebo = [];
  for (let s = 1; s <= P.SEEDS; s++) {
    const b = runBook(mks, oosMonths, { pick: randomPick(mulberry32(s)) }), v = monthSums(b, OOS, 1);
    placebo.push({ seed: s, mean: rd(v.reduce((a, c) => a + c, 0) / v.length, 4), t: stats(v).t });
  }
  const pm = placebo.map((p) => p.mean), beaten = pm.filter((x) => O.net.mean > x).length;
  const checks = { oosT2: O.net.t >= 2, isPositive: I.net.mean > 0, oos2xPositive: O.net2x.mean > 0, beatsPlacebo: beaten >= P.BEAT };
  const variants = {};
  for (const [name, look] of Object.entries(VARIANTS)) {
    if (name === '12-1') continue;
    const b = runBook(mks, all, { look });
    variants[name] = { is: windowSummary(b, IS), oos: windowSummary(b, OOS) };
  }
  return {
    study: 'index-xs-momentum', built: '2026-11-14', lastCandle,
    rule: '12-1 cross-sectional across one index CFD per country, long the top third / short the bottom third, 1R = stop = 2 x ATR(20), monthly',
    params: P, universe: MARKETS, currency: CCY,
    data: Object.fromEntries(mks.map((m) => [m.key, { first: ym(m.bars[0].time), last: new Date(m.bars.at(-1).time * 1000).toISOString().slice(0, 10), candles: m.bars.length }])),
    windows: { is: IS, oos: OOS }, is: I, oos: O,
    placebo: { seeds: P.SEEDS, real: O.net.mean, beaten, p5: rd(percentile(pm, 0.05), 4), p50: rd(percentile(pm, 0.5), 4), p95: rd(percentile(pm, 0.95), 4), max: rd(Math.max(...pm), 4), runs: placebo },
    checks, verdict: Object.values(checks).every(Boolean) ? 'PASS' : 'FAIL',
    byYear: perYear(book), byMarket: { is: perMarket(book, IS), oos: perMarket(book, OOS) }, variants,
    months: book.map((m) => ({ month: m.month, ranked: m.ranked, long: m.long, short: m.short, legs: m.legs.length, gross: rd(monthSum(m, 0), 4), net: rd(monthSum(m, 1), 4) })),
  };
}

// ─── the report (RESULT.md is this function's output; the test regenerates it from result.json) ───
export function report(R) {
  const f = (x) => (x == null ? 'n/a' : (x > 0 ? '+' : '') + x), mk = (b) => (b ? 'met' : 'missed'), c = R.checks, L = [];
  const I = R.is, O = R.oos;
  L.push('# Cross-sectional momentum across national stock indices (12-1, monthly): result', '');
  L.push(`**Verdict: ${R.verdict}** (pre-registered bar: OOS month-sum t >= 2 ${mk(c.oosT2)}; IS net > 0 ${mk(c.isPositive)}; OOS net > 0 at 2x costs ${mk(c.oos2xPositive)}; beats >= ${R.params.BEAT} of ${R.placebo.seeds} placebo runs ${mk(c.beatsPlacebo)}).`, '');
  L.push(`Out of sample ${O.from} to ${O.to} (${O.months} months, ${O.legs.n} trades): ${f(O.legs.avgNet)}R a trade net (gross ${f(O.legs.avgGross)}R, spread ${O.legs.avgCost}R, financing ${O.legs.avgFin}R), ${f(O.net.mean)}R a month, month-sum t ${f(O.net.t)} (Newey-West ${f(O.net.tNW)}), total ${f(O.net.total)}R; at 2x costs ${f(O.net2x.mean)}R a month.`);
  L.push(`In sample ${I.from} to ${I.to} (${I.months} months, ${I.legs.n} trades): ${f(I.legs.avgNet)}R a trade net, ${f(I.net.mean)}R a month, t ${f(I.net.t)}, total ${f(I.net.total)}R.`);
  L.push(`Placebo (${R.placebo.seeds} seeds, random ranking each month, same thirds, stops and costs): the real OOS mean beats ${R.placebo.beaten} of ${R.placebo.seeds}; placebo 5th / 50th / 95th percentile ${f(R.placebo.p5)} / ${f(R.placebo.p50)} / ${f(R.placebo.p95)}R a month.`, '');
  L.push('Every trade has a stop at 1R = 2 x ATR(20) from its entry. Net of a 0.03 % round trip and overnight financing (long: the quote currency\'s policy rate + 2.5 % a year; short: max(0, 2.5 % - rate)). Paper research: no live rule, size, filter, stop or council member changed.', '');
  L.push('## Setup', '');
  L.push(`Universe (one index per country): ${R.universe.join(', ')}. Data: council-data \`research/daily/<key>.json\` (OANDA mid daily candles, weekend stubs folded into Monday), last candle ${R.lastCandle}.`, '');
  L.push('| Index | First month | Last candle | Candles | Currency |', '|---|---|---|---|---|');
  for (const k of R.universe) L.push(`| ${k} | ${R.data[k].first} | ${R.data[k].last} | ${R.data[k].candles} | ${R.currency[k]} |`);
  L.push('');
  L.push('## Windows', '', '| Window | Months (traded) | Trades (long / short) | Win % | Gross R a trade | Spread R | Financing R | Net R a trade | Net 2x R a trade | Stops (gap) | Missing legs |', '|---|---|---|---|---|---|---|---|---|---|---|');
  for (const [n, w] of [['In sample', I], ['Out of sample', O]]) L.push(`| ${n} ${w.from} to ${w.to} | ${w.months} (${w.traded}) | ${w.legs.n} (${w.legs.long} / ${w.legs.short}) | ${w.legs.winPct} | ${f(w.legs.avgGross)} | ${w.legs.avgCost} | ${w.legs.avgFin} | ${f(w.legs.avgNet)} | ${f(w.legs.avgNet2x)} | ${w.legs.stopped} (${w.legs.gapFills}) | ${w.missingLegs} |`);
  L.push('', '| Window | Costs | Mean R a month | t | Newey-West t | Sharpe | Positive months % | Total R | Worst drawdown R |', '|---|---|---|---|---|---|---|---|---|');
  for (const [n, w] of [['In sample', I], ['Out of sample', O]]) for (const [cn, s] of [['0', w.gross], ['base', w.net], ['2x', w.net2x]]) L.push(`| ${n} | ${cn} | ${f(s.mean)} | ${f(s.t)} | ${f(s.tNW)} | ${f(s.sharpe)} | ${s.posPct} | ${f(s.total)} | ${s.dd} |`);
  L.push('', `Long legs net ${f(I.legs.longNet)}R IS, ${f(O.legs.longNet)}R OOS; short legs net ${f(I.legs.shortNet)}R IS, ${f(O.legs.shortNet)}R OOS.`, '');
  L.push('## By year (net R, base costs)', '', '| Year | Months | Trades | Gross R | Net R |', '|---|---|---|---|---|');
  for (const [y, v] of Object.entries(R.byYear)) L.push(`| ${y} | ${v.months} | ${v.legs} | ${f(v.gross)} | ${f(v.net)} |`);
  L.push('', '## By index (net R, base costs)', '', '| Index | IS long / short | IS net R | OOS long / short | OOS net R |', '|---|---|---|---|---|');
  for (const k of R.universe) { const a = R.byMarket.is[k], b = R.byMarket.oos[k]; L.push(`| ${k} | ${a.long} / ${a.short} | ${f(a.netR)} | ${b.long} / ${b.short} | ${f(b.netR)} |`); }
  L.push('', '## Variants (reported only, never deciding)', '', '| Variant | Window | Trades | Net R a trade | Mean R a month | t | Newey-West t |', '|---|---|---|---|---|---|---|');
  for (const [n, v] of Object.entries(R.variants)) for (const [wn, w] of [['IS', v.is], ['OOS', v.oos]]) L.push(`| ${n} | ${wn} | ${w.legs.n} | ${f(w.legs.avgNet)} | ${f(w.net.mean)} | ${f(w.net.t)} | ${f(w.net.tNW)} |`);
  L.push('', '## Reading', '');
  if (R.verdict === 'PASS') L.push('- The bar was met: a paper shadow book may be proposed to the owner (`research/proposals/`); nothing is live, and it is not an edge without a forward record.');
  else L.push('- The pre-registered bar was not met: no proposal is written and nothing changes. A FAIL is not evidence that the opposite works. Any other look-back, bucket size, weighting or universe would be a new study with its own pre-registration on data it was not chosen on.');
  L.push('- Related, all FAIL as well: `high52-rotation` (long-only rotation by nearness to the 52-week high), `tsmom` / `tsmom-portfolio` (each market against its own past), `commodity-xs-momentum` and `fx-xs-momentum` (this rule on commodities and dollar pairs).');
  L.push('- The placebo holds the same number of indices long and short at random, with the same stops and costs: it shows what the cost and the stop alone do to a book of this shape.');
  L.push('', '## What this cannot show', '');
  L.push('- Price indices without dividends (a CFD long is credited the dividend, a short pays it; left out on both sides); each index earns in its own currency; policy rates are approximate year averages; the 0.03 % spread is assumed, not measured on the demo broker.');
  L.push('- Thirteen national indices (ten to twelve most months) is a small cross-section next to the published one.');
  L.push('', 'To repeat: `node research/edge/index-xs-momentum/run.mjs` (reads council-data with `git show`, no network). Tests: `tests/index-xs-momentum.test.mjs`.', '');
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
  for (const [n, w] of [['IS', res.is], ['OOS', res.oos]]) console.log(n, w.traded, 'net', w.net, '2x', w.net2x.mean, 'legs', w.legs);
  console.log('placebo', { ...res.placebo, runs: undefined });
  for (const [n, v] of Object.entries(res.variants)) console.log(n, 'IS', v.is.net.mean, v.is.net.t, 'OOS', v.oos.net.mean, v.oos.net.t);
}
