// Commodity cross-sectional skewness, 12 months, monthly rebalance (pre-registered 14 Nov 2026, PREREGISTRATION.md).
// At each month's last close rank twelve commodity CFDs by the skewness of their daily log returns over the past 12 months,
// long the most negatively skewed third and short the most positively skewed third at the next month's first open,
// 1R = stop = 2 x ATR(20), hold to the month's last close; net of an assumed round trip and 3 % a year financing on every leg.
// The harness (calendar, legs, stop, costs, statistics, placebo) is COPIED from research/edge/commodity-xs-momentum/run.mjs
// on branch commodity-xs-momentum (commit 5a6f3ed12, not merged), unchanged; the signal, the bucket and the windows differ.
// Paper research only: nothing live reads this file.
import fs from 'node:fs';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { foldWeekend, nights } from '../../../council/fills.mjs';

export const MARKETS = ['xau', 'xag', 'xpt', 'xpd', 'xcu', 'bco', 'wtico', 'natgas', 'corn', 'wheat', 'soybn', 'sugar'];
export const P = {
  LOOK: 12, MIN_RET: 200, MIN_RANKED: 10, ATR_N: 20, ATR_MULT: 2,
  COST_ABS: { xau: 0.30, xag: 0.03 }, COST_FRAC: 0.0006, FIN_YEAR: 0.03, JUMP: 0.03, SEEDS: 40, NW_LAGS: 3,
};
export const LAST = '2026-10';
const DAY = 86400;

// ─── calendar ───
export const ym = (t) => new Date(t * 1000).toISOString().slice(0, 7);
export function shiftYm(s, k) { const [y, m] = s.split('-').map(Number), n = y * 12 + (m - 1) + k; return `${Math.floor(n / 12)}-${String((n % 12) + 1).padStart(2, '0')}`; }
export const rowsToBars = (rows) => rows.map(([time, open, high, low, close]) => ({ time, open, high, low, close }));
// one market: bars plus, per calendar month, the index of its first and last candle
export function indexMarket(key, bars) {
  const first = new Map(), last = new Map();
  bars.forEach((b, i) => { const k = ym(b.time); if (!first.has(k)) first.set(k, i); last.set(k, i); });
  return { key, bars, first, last };
}

// ─── the signal (closes up to and including signal month S only) ───
// Pearson's moment skewness (1/N)sum(r-mu)^3 / ((1/N)sum(r-mu)^2)^1.5
export function skewness(r) {
  const n = r.length; if (n < 3) return null;
  const mu = r.reduce((a, b) => a + b, 0) / n;
  let m2 = 0, m3 = 0; for (const x of r) { const e = x - mu; m2 += e * e; m3 += e * e * e; }
  m2 /= n; m3 /= n;
  return m2 > 0 ? m3 / m2 ** 1.5 : null;
}
// daily log returns from the month-end candle of S-look to the month-end candle of S; null when S or S-look has no candle
export function returnsOf(mk, S, look = P.LOOK) {
  const b = mk.last.get(S), a = mk.last.get(shiftYm(S, -look));
  if (a == null || b == null) return null;
  const r = []; for (let i = a + 1; i <= b; i++) r.push(Math.log(mk.bars[i].close / mk.bars[i - 1].close));
  return r;
}
export function skewAt(mk, S, look = P.LOOK, minRet = P.MIN_RET) {
  const r = returnsOf(mk, S, look);
  if (!r || r.length < minRet) return null;
  return skewness(r);
}
// most negative skew first; ties by list order
export function rankAt(mks, S, look = P.LOOK, minRet = P.MIN_RET) {
  const r = [];
  mks.forEach((mk, k) => { const v = skewAt(mk, S, look, minRet); if (v != null && Number.isFinite(v)) r.push({ key: mk.key, k, r: v }); });
  return r.sort((x, y) => x.r - y.r || x.k - y.k).map((x) => x.key);
}
export const perSide = (n) => Math.floor(n / 3);
export const topBottom = (ranked, n = perSide(ranked.length)) => ({ long: ranked.slice(0, n), short: ranked.slice(-n) });

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
export const costOf = (key, px) => (P.COST_ABS[key] != null ? P.COST_ABS[key] : P.COST_FRAC * px);
// an open-to-previous-close jump above P.JUMP inside the holding window (after the entry candle)
export function jumped(bars, e, x) { for (let i = e + 1; i <= x; i++) if (Math.abs(bars[i].open / bars[i - 1].close - 1) > P.JUMP) return true; return false; }

export function leg(mk, S, H, side) {
  const d = mk.last.get(S), e = mk.first.get(H), x = mk.last.get(H);
  if (d == null || e == null || x == null) return null;
  const a = atr(mk.bars, d); if (!a) return null;
  const dist = P.ATR_MULT * a, L = simLeg(mk.bars, e, x, side, dist);
  const gross = (side * (L.exit - L.entry)) / dist;
  const costR = costOf(mk.key, L.entry) / dist;
  const n = nights(mk.bars[e].time, exitTime(mk.bars[L.exitIdx].time, L.how));
  const finR = (n * (P.FIN_YEAR / 365) * L.entry) / dist;
  return { key: mk.key, side, gross, costR, finR, nights: n, how: L.how, jump: jumped(mk.bars, e, L.exitIdx) };
}

// ─── the book: one row per holding month H (signal month S = H - 1) ───
// pick(ranked, H) -> { long, short }; k = cost multiplier applied when the month's net is formed
export function runBook(mks, months, { look = P.LOOK, minRet = P.MIN_RET, pick = (r) => topBottom(r) } = {}) {
  const byKey = Object.fromEntries(mks.map((m) => [m.key, m])), out = [];
  for (const H of months) {
    const S = shiftYm(H, -1), ranked = rankAt(mks, S, look, minRet);
    if (ranked.length < P.MIN_RANKED) continue;
    const pk = pick(ranked, H), legs = [], missing = [];
    for (const [ks, side] of [[pk.long, 1], [pk.short, -1]]) for (const k of ks) { const l = leg(byKey[k], S, H, side); if (l) legs.push(l); else missing.push(k); }
    if (!legs.length) continue;
    out.push({ month: H, ranked: ranked.length, long: pk.long, short: pk.short, missing, legs });
  }
  return out;
}
export function monthR(m, k = 1) { return m.legs.reduce((s, l) => s + l.gross - k * (l.costR + l.finR), 0) / m.legs.length; }

// ─── statistics ───
export function neweyWestT(v, lags = P.NW_LAGS) {
  const n = v.length; if (n < 2) return 0;
  const mu = v.reduce((a, b) => a + b, 0) / n, e = v.map((x) => x - mu);
  const g = (l) => { let s = 0; for (let i = l; i < n; i++) s += e[i] * e[i - l]; return s / n; };
  let lrv = g(0); for (let l = 1; l <= lags; l++) lrv += 2 * (1 - l / (lags + 1)) * g(l);
  return lrv > 0 ? mu / Math.sqrt(lrv / n) : 0;
}
const r3 = (v, k = 3) => +v.toFixed(k);
export function stats(vals) {
  const n = vals.length; if (!n) return { n: 0 };
  const mean = vals.reduce((a, b) => a + b, 0) / n;
  const sd = n > 1 ? Math.sqrt(vals.reduce((a, b) => a + (b - mean) ** 2, 0) / (n - 1)) : 0;
  let cum = 0, peak = 0, dd = 0; for (const v of vals) { cum += v; peak = Math.max(peak, cum); dd = Math.min(dd, cum - peak); }
  return { n, mean: r3(mean), total: r3(cum, 2), tNW: r3(neweyWestT(vals), 2), tPlain: sd ? r3((mean / sd) * Math.sqrt(n), 2) : 0, sharpe: sd ? r3((mean / sd) * Math.sqrt(12), 2) : 0, dd: r3(dd, 2), posPct: r3((vals.filter((v) => v > 0).length / n) * 100, 1) };
}
export function percentile(vals, q) { const s = [...vals].sort((a, b) => a - b), h = (s.length - 1) * q, lo = Math.floor(h); return lo + 1 < s.length ? s[lo] + (h - lo) * (s[lo + 1] - s[lo]) : s[lo]; }
export function mulberry32(seed) { let a = seed >>> 0; return () => { a = (a + 0x6d2b79f5) >>> 0; let t = a; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; }
export function randomPick(rng, n = null) { return (ranked) => { const c = [...ranked]; for (let i = c.length - 1; i > 0; i--) { const j = Math.floor(rng() * (i + 1)); [c[i], c[j]] = [c[j], c[i]]; } return topBottom(c, n == null ? perSide(c.length) : n); }; }

export function monthsBetween(from, to) { const out = []; for (let s = from; s <= to; s = shiftYm(s, 1)) out.push(s); return out; }
function legStats(ms) {
  const legs = ms.flatMap((m) => m.legs), n = legs.length, sum = (f) => legs.reduce((s, l) => s + f(l), 0);
  const j = legs.filter((l) => l.jump);
  return {
    n, long: legs.filter((l) => l.side > 0).length, short: legs.filter((l) => l.side < 0).length,
    winPct: r3((legs.filter((l) => l.gross - l.costR - l.finR > 0).length / n) * 100, 1),
    stopped: legs.filter((l) => l.how !== 'close').length, gapFills: legs.filter((l) => l.how === 'gap').length,
    avgGross: r3(sum((l) => l.gross) / n), avgNet: r3(sum((l) => l.gross - l.costR - l.finR) / n), avgCost: r3(sum((l) => l.costR) / n), avgFin: r3(sum((l) => l.finR) / n),
    jumpLegs: j.length, jumpNetR: r3(j.reduce((s, l) => s + l.gross - l.costR - l.finR, 0), 2),
  };
}
// the window's monthly R with the jump legs left out (descriptive)
function withoutJumps(ms) { return ms.map((m) => { const l = m.legs.filter((x) => !x.jump); return l.length ? monthR({ legs: l }) : 0; }); }
export function windowSummary(ms) {
  return {
    from: ms[0]?.month, to: ms.at(-1)?.month,
    gross: stats(ms.map((m) => monthR(m, 0))), net: stats(ms.map((m) => monthR(m, 1))), net2x: stats(ms.map((m) => monthR(m, 2))),
    netNoJumps: stats(withoutJumps(ms)), legs: legStats(ms), missingLegs: ms.reduce((s, m) => s + m.missing.length, 0),
  };
}
function perMarket(ms) {
  const o = Object.fromEntries(MARKETS.map((k) => [k, { long: 0, short: 0, netR: 0, grossR: 0 }]));
  for (const m of ms) for (const l of m.legs) { const r = o[l.key]; r[l.side > 0 ? 'long' : 'short']++; r.netR += l.gross - l.costR - l.finR; r.grossR += l.gross; }
  for (const k of MARKETS) { o[k].netR = r3(o[k].netR, 2); o[k].grossR = r3(o[k].grossR, 2); }
  return o;
}
function perYear(ms) {
  const o = {};
  for (const m of ms) { const y = m.month.slice(0, 4); (o[y] ||= { months: 0, gross: 0, net: 0 }); o[y].months++; o[y].gross += monthR(m, 0); o[y].net += monthR(m, 1); }
  for (const y in o) { o[y].gross = r3(o[y].gross, 2); o[y].net = r3(o[y].net, 2); }
  return o;
}

// ─── the whole study ───
const mean4 = (ms, k = 1) => { const v = ms.map((m) => monthR(m, k)); return r3(v.reduce((a, b) => a + b, 0) / v.length, 4); };
export function splitHalves(ms) { const h = Math.floor(ms.length / 2); return { is: ms.slice(0, h), oos: ms.slice(h) }; }
export function study(mks, lastMonth = LAST) {
  const all = monthsBetween('2003-01', lastMonth);
  const primary = runBook(mks, all);
  const { is, oos } = splitHalves(primary);
  const oosMonths = monthsBetween(oos[0].month, lastMonth);
  const placebo = [];
  for (let s = 1; s <= P.SEEDS; s++) {
    const ms = runBook(mks, oosMonths, { pick: randomPick(mulberry32(s)) });
    const v = ms.map((m) => monthR(m, 1));
    placebo.push({ seed: s, mean: r3(v.reduce((a, b) => a + b, 0) / v.length, 4), tNW: r3(neweyWestT(v), 2) });
  }
  const pm = placebo.map((p) => p.mean), real = mean4(oos);
  const I = windowSummary(is), O = windowSummary(oos);
  const p95 = r3(percentile(pm, 0.95), 4);
  const checks = { oosT2: O.net.tNW >= 2, isPositive: I.net.mean > 0, oos2xPositive: O.net2x.mean > 0, abovePlacebo95: real > p95 };
  const inW = (a, b) => (m) => m.month >= a && m.month <= b;
  const variants = {};
  for (const [name, opt] of Object.entries({ '6m': { look: 6, minRet: 100 }, '12m-3a-side': { pick: (r) => topBottom(r, 3) } })) {
    const ms = runBook(mks, all, opt);
    variants[name] = { is: windowSummary(ms.filter(inW(is[0].month, is.at(-1).month))), oos: windowSummary(ms.filter(inW(oos[0].month, lastMonth))) };
  }
  const sideSplit = (ms) => Object.fromEntries([['long', 1], ['short', -1]].map(([n, sd]) => {
    const l = ms.flatMap((m) => m.legs).filter((x) => x.side === sd);
    return [n, { n: l.length, netPerLeg: r3(l.reduce((a, x) => a + x.gross - x.costR - x.finR, 0) / l.length) }];
  }));
  return {
    study: 'commodity-skewness', built: '2026-11-14', rule: '12-month daily-return skewness, cross-sectional: long the most negative third, short the most positive third, 1R = 2 x ATR(20) stop, monthly',
    params: P, universe: MARKETS, lastMonth,
    data: Object.fromEntries(mks.map((m) => [m.key, { first: ym(m.bars[0].time), last: new Date(m.bars.at(-1).time * 1000).toISOString().slice(0, 10), candles: m.bars.length }])),
    windows: { is: { from: is[0].month, to: is.at(-1).month, n: is.length }, oos: { from: oos[0].month, to: oos.at(-1).month, n: oos.length } },
    is: I, oos: O, sides: { is: sideSplit(is), oos: sideSplit(oos) },
    placebo: { seeds: P.SEEDS, real, p5: r3(percentile(pm, 0.05), 4), p50: r3(percentile(pm, 0.5), 4), p95, max: r3(Math.max(...pm), 4), above: pm.filter((x) => x >= real).length, runs: placebo },
    checks, verdict: Object.values(checks).every(Boolean) ? 'PASS' : 'FAIL',
    byYear: perYear(primary),
    byMarket: { is: perMarket(is), oos: perMarket(oos) },
    variants,
    months: primary.map((m) => ({ month: m.month, ranked: m.ranked, long: m.long, short: m.short, legs: m.legs.length, gross: r3(monthR(m, 0), 4), net: r3(monthR(m, 1), 4) })),
  };
}

// ─── data ───
const gitRead = (k) => execFileSync('git', ['show', `origin/council-data:research/daily/${k}.json`], { encoding: 'utf8', maxBuffer: 64 << 20 });
export function loadMarkets(read = gitRead) { return MARKETS.map((k) => indexMarket(k, foldWeekend(rowsToBars(JSON.parse(read(k)).rows)))); }

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const mks = loadMarkets();
  const res = study(mks, LAST);
  fs.writeFileSync(new URL('./result.json', import.meta.url), JSON.stringify(res, null, 1) + '\n');
  console.log(res.verdict, res.checks, res.windows);
  for (const n of ['is', 'oos']) { const w = res[n]; console.log(n, 'gross', w.gross, 'net', w.net, 'net2x', w.net2x, 'legs', w.legs, 'noJumps', w.netNoJumps.mean, w.netNoJumps.tNW); }
  console.log('sides', JSON.stringify(res.sides));
  console.log('placebo', { ...res.placebo, runs: undefined });
  for (const [n, v] of Object.entries(res.variants)) console.log(n, 'is', v.is.net, 'oos', v.oos.net);
  console.log(res.byYear); console.log(JSON.stringify(res.byMarket));
}
