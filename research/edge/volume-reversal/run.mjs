// Volume-conditioned reversal of big daily moves on index, metal, energy and forex CFDs (pre-registered 14 Nov 2026,
// PREREGISTRATION.md, pushed first). A day whose absolute return is above at least 90 of its previous 100 is faded at its
// close (short after an up day, long after a down day), held 3 days, stop 1.5 x ATR(20). The day is low-volume when its
// OANDA quote count (a proxy for volume, not traded volume) is below the median of its previous 50, high-volume when above.
// Primary: low-volume fades, pooled, net. Secondary: low minus high.
//   node research/edge/volume-reversal/run.mjs      reads council-data with git show, writes result.json and RESULT.md
// Paper research only: nothing live reads this file.
import fs from 'node:fs';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { foldWeekend, nights, FIN } from '../../../council/fills.mjs';

export const GROUPS = {
  indices: ['spx500', 'nas100', 'us30', 'us2000', 'de40', 'uk100', 'fr40', 'eu50', 'ch20', 'nl25', 'es35', 'jp225', 'au200', 'hk33', 'cn50', 'sg30', 'in50'],
  metals: ['xau', 'xag', 'xpt', 'xpd', 'xcu'],
  energy: ['wtico', 'bco', 'natgas'],
  fx: ['eurusd', 'gbpusd', 'audusd', 'nzdusd', 'usdjpy', 'usdcad', 'usdchf'],
};
export const MARKETS = Object.values(GROUPS).flat();
export const groupOf = (k) => Object.keys(GROUPS).find((g) => GROUPS[g].includes(k));
export const P = { RLOOK: 100, RTOP: 90, VLOOK: 50, MIN_V: 10, ATR_N: 20, ATR_MULT: 1.5, H: 3, SEEDS: 40, BEAT: 38, NW_LAGS: 3, ALPHA: 0.05, FROM: '2005-01-01' };
export const IS = { from: '2005-01', to: '2016-12' };
export const OOS = { from: '2017-01', to: '2026-10' };
// round trip as a share of the entry price (trend-breadth COST, as volume-premium)
export const SPREAD = { index: 0.0003, fx: 0.00015, mid: 0.001, wide: 0.002, gold: 0.0002 };
export const COST_CLASS = { xau: 'gold', xag: 'mid', xcu: 'mid', xpt: 'wide', xpd: 'wide', wtico: 'mid', bco: 'mid', natgas: 'mid' };
export const costFrac = (k) => SPREAD[COST_CLASS[k] || (groupOf(k) === 'fx' ? 'fx' : 'index')];
// financing a rollover as a share of the entry price, charged on both sides (gold short: the broker's 0)
export const FIN_NIGHT = { goldLong: FIN.xau.long, goldShort: FIN.xau.short, other: 0.00015, fx: 0.00004 };
export const finNight = (k, side) => (k === 'xau' ? (side > 0 ? FIN_NIGHT.goldLong : FIN_NIGHT.goldShort) : groupOf(k) === 'fx' ? FIN_NIGHT.fx : FIN_NIGHT.other);
const DAY = 86400;
const rd = (v, k = 4) => (Number.isFinite(v) ? +v.toFixed(k) : null);

// ─── calendar ───
export const ym = (t) => new Date(t * 1000).toISOString().slice(0, 7);
export function shiftYm(s, k) { const [y, m] = s.split('-').map(Number), n = y * 12 + (m - 1) + k; return `${Math.floor(n / 12)}-${String((n % 12) + 1).padStart(2, '0')}`; }
export function monthsBetween(from, to) { const out = []; for (let s = from; s <= to; s = shiftYm(s, 1)) out.push(s); return out; }
export const rowsToBars = (rows) => rows.map(([time, open, high, low, close, v]) => ({ time, open, high, low, close, v }));
export function prepare(rows) {
  const from = Date.parse(P.FROM + 'T00:00:00Z') / 1000;
  return foldWeekend(rowsToBars(rows.filter((r) => r[0] >= from)));
}

// ─── the signal at day d (candles 0..d only) ───
export function atr(bars, d, n = P.ATR_N) {
  if (d - n < 0) return null;
  let s = 0;
  for (let i = d - n + 1; i <= d; i++) { const b = bars[i], pc = bars[i - 1].close; s += Math.max(b.high - b.low, Math.abs(b.high - pc), Math.abs(b.low - pc)); }
  return s / n;
}
export function median(vals) { const s = [...vals].sort((a, b) => a - b), n = s.length; return n % 2 ? s[(n - 1) / 2] : (s[n / 2 - 1] + s[n / 2]) / 2; }
// { big, r, rBelow, cls: 'low' | 'high' | 'mid' } or null when there is not enough clean history
export function signalAt(bars, d) {
  if (d - P.RLOOK - 1 < 0) return null;
  const b = bars[d];
  if (!(b.v >= P.MIN_V) || !(b.close > 0) || !(bars[d - 1].close > 0)) return null;
  const r = Math.log(b.close / bars[d - 1].close), a = Math.abs(r);
  let rBelow = 0;
  for (let i = d - P.RLOOK; i < d; i++) {
    if (!(bars[i].close > 0) || !(bars[i - 1].close > 0)) return null;
    if (Math.abs(Math.log(bars[i].close / bars[i - 1].close)) < a) rBelow++;
  }
  const vs = [];
  for (let i = d - P.VLOOK; i < d; i++) { if (!(bars[i].v >= P.MIN_V)) return null; vs.push(bars[i].v); }
  const M = median(vs), cls = b.v < M ? 'low' : b.v > M ? 'high' : 'mid';
  return { r, rBelow, big: rBelow >= P.RTOP && r !== 0, med: M, cls };
}

// ─── one trade: side +1 long / -1 short, entry at the close of d, stop 1R against, out at the close of d + H ───
export function simTrade(bars, d, side, H, dist) {
  const entry = bars[d].close, stop = entry - side * dist, x = d + H;
  if (x >= bars.length) return null;
  for (let i = d + 1; i <= x; i++) {
    const b = bars[i];
    const hit = side > 0 ? b.low <= stop : b.high >= stop;
    if (hit) { const gap = side > 0 ? b.open <= stop : b.open >= stop; return { entry, stop, exit: gap ? b.open : stop, exitIdx: i, how: gap ? 'gap' : 'stop' }; }
  }
  return { entry, stop, exit: bars[x].close, exitIdx: x, how: 'close' };
}
export const exitTime = (t, how) => (how === 'close' ? t + DAY : how === 'gap' ? t : t + DAY / 2);

export function tradeAt(key, bars, d, side, H = P.H) {
  const a = atr(bars, d); if (!(a > 0)) return null;
  const dist = P.ATR_MULT * a, L = simTrade(bars, d, side, H, dist); if (!L) return null;
  if (!(side * (L.entry - L.stop) > 0)) throw new Error(`trade without a stop on its losing side: ${key} ${d}`);
  const gross = (side * (L.exit - L.entry)) / dist, costR = (costFrac(key) * L.entry) / dist;
  const n = nights(bars[d].time + DAY, exitTime(bars[L.exitIdx].time, L.how));
  const finR = (n * finNight(key, side) * L.entry) / dist;
  return { side, gross, costR, finR, nights: n, how: L.how };
}
export const netOf = (t, k = 1) => t.gross - k * (t.costR + t.finR);

// every day of a market with a full history: { key, d, month, big, cls, trade (the fade, big days only) }
export function daysOf(key, bars, H = P.H) {
  const out = [];
  for (let d = 0; d < bars.length; d++) {
    const s = signalAt(bars, d); if (!s) continue;
    if (!(atr(bars, d) > 0) || d + H >= bars.length) continue;
    const x = { key, d, month: ym(bars[d].time), big: s.big, cls: s.cls };
    if (s.big) x.trade = tradeAt(key, bars, d, s.r > 0 ? -1 : 1, H);
    out.push(x);
  }
  return out;
}

// per calendar month of the window: the sum of net R of the picked trades; 0 for a month with none
export function monthValues(picked, win, k = 1, tradeOf = (x) => x.trade) {
  const by = new Map();
  for (const x of picked) by.set(x.month, (by.get(x.month) || 0) + netOf(tradeOf(x), k));
  return monthsBetween(win.from, win.to).map((M) => by.get(M) || 0);
}

// ─── statistics ───
export function neweyWestT(v, lags = P.NW_LAGS) {
  const n = v.length; if (n < 2) return 0;
  const mu = v.reduce((a, b) => a + b, 0) / n, e = v.map((x) => x - mu);
  const g = (l) => { let s = 0; for (let i = l; i < n; i++) s += e[i] * e[i - l]; return s / n; };
  let lrv = g(0); for (let l = 1; l <= lags; l++) lrv += 2 * (1 - l / (lags + 1)) * g(l);
  return lrv > 0 ? mu / Math.sqrt(lrv / n) : 0;
}
export function stats(vals) {
  const n = vals.length; if (!n) return { n: 0, mean: 0, t: 0 };
  const mean = vals.reduce((a, b) => a + b, 0) / n;
  const sd = n > 1 ? Math.sqrt(vals.reduce((a, b) => a + (b - mean) ** 2, 0) / (n - 1)) : 0;
  return { n, mean: rd(mean), total: rd(mean * n, 2), t: sd ? rd((mean / sd) * Math.sqrt(n), 2) : 0, tNW: rd(neweyWestT(vals), 2), posPct: rd((vals.filter((v) => v > 0).length / n) * 100, 1) };
}
export function normCdf(z) {
  const x = Math.abs(z) / Math.SQRT2, t = 1 / (1 + 0.3275911 * x);
  const erf = 1 - (((((1.061405429 * t - 1.453152027) * t) + 1.421413741) * t - 0.284496736) * t + 0.254829592) * t * Math.exp(-x * x);
  return z >= 0 ? 0.5 * (1 + erf) : 0.5 * (1 - erf);
}
export const pTwo = (t) => 2 * (1 - normCdf(Math.abs(t)));
export function holm(ps) {
  const e = Object.entries(ps).sort((a, b) => a[1] - b[1]), m = e.length, out = {};
  let run = 0;
  e.forEach(([k, p], i) => { run = Math.max(run, Math.min(1, (m - i) * p)); out[k] = run; });
  return out;
}
export function mulberry32(seed) { let a = seed >>> 0; return () => { a = (a + 0x6d2b79f5) >>> 0; let t = a; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; }
export function sample(arr, n, rng) { const c = [...arr]; for (let i = 0; i < n; i++) { const j = i + Math.floor(rng() * (c.length - i)); [c[i], c[j]] = [c[j], c[i]]; } return c.slice(0, n); }
export function percentile(vals, q) { const s = [...vals].sort((a, b) => a - b), h = (s.length - 1) * q, lo = Math.floor(h); return lo + 1 < s.length ? s[lo] + (h - lo) * (s[lo + 1] - s[lo]) : s[lo]; }

const inWin = (x, w) => x.month >= w.from && x.month <= w.to;
function tradeStats(list) {
  const n = list.length; if (!n) return { n: 0 };
  const avg = (f) => rd(list.reduce((s, x) => s + f(x.trade), 0) / n);
  return { n, gross: avg((t) => t.gross), spread: avg((t) => t.costR), fin: avg((t) => t.finR), net: avg((t) => netOf(t)), net2x: avg((t) => netOf(t, 2)), stops: list.filter((x) => x.trade.how !== 'close').length, gaps: list.filter((x) => x.trade.how === 'gap').length };
}
// one window's block for a set of markets' days
export function block(days, win) {
  const w = days.filter((x) => inWin(x, win)), big = w.filter((x) => x.big && x.trade);
  const lo = big.filter((x) => x.cls === 'low'), hi = big.filter((x) => x.cls === 'high');
  const mv = (set, k) => monthValues(set, win, k);
  const diff = (k) => { const a = mv(lo, k), b = mv(hi, k); return a.map((v, i) => v - b[i]); };
  return {
    signals: { days: w.length, big: big.length, low: lo.length, high: hi.length, mid: big.length - lo.length - hi.length },
    trades: { low: tradeStats(lo), high: tradeStats(hi), all: tradeStats(big) },
    low: { gross: stats(mv(lo, 0)), net: stats(mv(lo, 1)), net2x: stats(mv(lo, 2)) },
    high: { gross: stats(mv(hi, 0)), net: stats(mv(hi, 1)), net2x: stats(mv(hi, 2)) },
    all: { gross: stats(mv(big, 0)), net: stats(mv(big, 1)) },
    lowMinusHigh: { gross: stats(diff(0)), net: stats(diff(1)), net2x: stats(diff(2)) },
  };
}
// deciding placebo: per market as many OOS big-move days (any volume class) as it had OOS low-volume fades, each faded
export function placebo(days, win, seeds = P.SEEDS) {
  const big = days.filter((x) => inWin(x, win) && x.big && x.trade), by = {};
  for (const x of big) (by[x.key] ||= []).push(x);
  const out = [];
  for (let s = 1; s <= seeds; s++) {
    const rng = mulberry32(s), pick = [];
    for (const k of Object.keys(by)) { const n = by[k].filter((x) => x.cls === 'low').length; pick.push(...sample(by[k], n, rng)); }
    out.push(rd(stats(monthValues(pick, win, 1)).mean));
  }
  return out;
}
// reported placebo: random eligible days of any move size, random side
export function placeboRandom(key2bars, days, win, seeds = P.SEEDS) {
  const w = days.filter((x) => inWin(x, win)), by = {};
  for (const x of w) (by[x.key] ||= []).push(x);
  const out = [];
  for (let s = 1; s <= seeds; s++) {
    const rng = mulberry32(1000 + s), pick = [];
    for (const k of Object.keys(by)) {
      const n = by[k].filter((x) => x.big && x.trade && x.cls === 'low').length;
      for (const x of sample(by[k], n, rng)) { const tr = tradeAt(k, key2bars[k], x.d, rng() < 0.5 ? 1 : -1); if (tr) pick.push({ month: x.month, trade: tr }); }
    }
    out.push(rd(stats(monthValues(pick, win, 1)).mean));
  }
  return out;
}

// ─── the whole study ───
export function study(data, lastCandle) {
  const byKey = Object.fromEntries(MARKETS.filter((k) => data[k]).map((k) => [k, daysOf(k, data[k])]));
  const sets = { pooled: MARKETS, ...GROUPS };
  const pick = (keys) => keys.flatMap((k) => byKey[k] || []);
  const blocks = Object.fromEntries(Object.entries(sets).map(([n, keys]) => [n, { is: block(pick(keys), IS), oos: block(pick(keys), OOS) }]));
  const T = { T1: blocks.pooled.oos.low.net, T2: blocks.pooled.oos.lowMinusHigh.net };
  for (const [i, g] of Object.keys(GROUPS).entries()) T[`T${i + 3}`] = blocks[g].oos.low.net;
  const names = { T1: 'low-volume fades, pooled', T2: 'low minus high, pooled', T3: 'low-volume fades, indices', T4: 'low-volume fades, metals', T5: 'low-volume fades, energy', T6: 'low-volume fades, fx' };
  const tests = Object.fromEntries(Object.entries(T).map(([k, s]) => [k, { name: names[k], mean: s.mean, t: s.t, p: rd(pTwo(s.t), 5) }]));
  const adj = holm(Object.fromEntries(Object.entries(tests).map(([n, v]) => [n, v.p])));
  for (const n of Object.keys(tests)) { tests[n].pHolm = rd(adj[n], 5); tests[n].pass = tests[n].t >= 2 && adj[n] <= P.ALPHA; }
  const all = pick(MARKETS), pm = placebo(all, OOS), pr = placeboRandom(data, all, OOS), real = blocks.pooled.oos.low.net.mean;
  const beaten = pm.filter((x) => real > x).length, beatenR = pr.filter((x) => real > x).length;
  const po = blocks.pooled;
  const checks = {
    oosT2Holm: tests.T1.mean > 0 && tests.T1.pass,
    isPositive: po.is.low.net.mean > 0,
    oos2xPositive: po.oos.low.net2x.mean > 0,
    beatsPlacebo: beaten >= P.BEAT,
  };
  const byMarket = {};
  for (const k of MARKETS) {
    if (!data[k]) continue;
    const a = block(byKey[k], IS), b = block(byKey[k], OOS);
    byMarket[k] = { group: groupOf(k), first: new Date(data[k][0].time * 1000).toISOString().slice(0, 10), last: new Date(data[k].at(-1).time * 1000).toISOString().slice(0, 10), candles: data[k].length,
      isLow: a.signals.low, isLowNet: a.trades.low.net ?? null, isHigh: a.signals.high, isHighNet: a.trades.high.net ?? null,
      oosLow: b.signals.low, oosLowNet: b.trades.low.net ?? null, oosHigh: b.signals.high, oosHighNet: b.trades.high.net ?? null };
  }
  const byYear = {};
  for (const x of all) {
    if (!x.big || !x.trade || x.month > OOS.to) continue;
    const y = x.month.slice(0, 4), v = (byYear[y] ||= { low: 0, lowNet: 0, high: 0, highNet: 0 });
    if (x.cls === 'low') { v.low++; v.lowNet += netOf(x.trade); } else if (x.cls === 'high') { v.high++; v.highNet += netOf(x.trade); }
  }
  for (const y in byYear) { const v = byYear[y]; byYear[y] = { low: v.low, lowNet: rd(v.lowNet / (v.low || 1)), high: v.high, highNet: rd(v.highNet / (v.high || 1)) }; }
  return {
    study: 'volume-reversal', built: '2026-11-14', lastCandle,
    title: 'Volume-conditioned reversal of big daily moves (OANDA quote count), index, metal, energy and forex CFDs',
    system: 'fade a top-decile daily move (of its last 100) at the close, hold 3 days, stop 1.5 x ATR(20); low- vs high-volume day by the quote count against the median of its last 50',
    params: P, groups: GROUPS, spread: SPREAD, costClass: COST_CLASS, finNight: FIN_NIGHT, windows: { is: IS, oos: OOS },
    blocks, tests,
    placebo: { seeds: P.SEEDS, real, beaten, p5: rd(percentile(pm, 0.05)), p50: rd(percentile(pm, 0.5)), p95: rd(percentile(pm, 0.95)), max: rd(Math.max(...pm)), runs: pm },
    placeboRandom: { seeds: P.SEEDS, beaten: beatenR, p5: rd(percentile(pr, 0.05)), p50: rd(percentile(pr, 0.5)), p95: rd(percentile(pr, 0.95)), runs: pr },
    byMarket, byYear, checks, verdict: Object.values(checks).every(Boolean) ? 'PASS' : 'FAIL',
  };
}

// ─── the report (RESULT.md is this function's output; the test regenerates it from result.json) ───
export function report(R) {
  const f = (x) => (x == null ? 'n/a' : (x > 0 ? '+' : '') + x), mk = (b) => (b ? 'met' : 'missed'), c = R.checks, L = [];
  const B = R.blocks, po = B.pooled.oos, pi = B.pooled.is, t1 = R.tests.T1, t2 = R.tests.T2;
  const r2 = (x) => f(+(+x).toFixed(2));
  L.push('# Volume-conditioned reversal of big daily moves on index, metal, energy and forex CFDs: result', '');
  const why = R.verdict === 'PASS'
    ? `PASS. Low-volume fades pooled OOS ${r2(po.low.net.mean)}R a month net, t ${f(t1.t)}, Holm p ${(+t1.pHolm).toFixed(3)}; positive in sample, at 2x costs and above ${R.placebo.beaten} of ${R.placebo.seeds} placebos. A lead, not an edge.`
    : `FAIL. Low-volume fades pooled OOS ${r2(po.low.net.mean)}R a month net, t ${f(t1.t)}, Holm p ${(+t1.pHolm).toFixed(3)} (bar: t >= 2 after Holm); low minus high t ${f(t2.t)}.`;
  L.push(`**Verdict: ${why}**`, '');
  L.push(`Pre-registered bar (PREREGISTRATION.md, pushed alone first): T1 OOS t >= 2 with Holm p <= 0.05 ${mk(c.oosT2Holm)}; T1 IS > 0 ${mk(c.isPositive)}; T1 OOS > 0 at 2x costs ${mk(c.oos2xPositive)}; above >= ${R.params.BEAT} of ${R.placebo.seeds} placebos ${mk(c.beatsPlacebo)}.`, '');
  L.push(`Out of sample ${R.windows.oos.from} to ${R.windows.oos.to}, pooled: ${po.signals.big} big-move days (${po.signals.low} low-volume, ${po.signals.high} high-volume). Low-volume fades ${f(po.trades.low.net)}R a trade net (gross ${f(po.trades.low.gross)}R); high-volume fades ${f(po.trades.high.net)}R (gross ${f(po.trades.high.gross)}R). Month sums: low ${f(po.low.net.mean)}R net (t ${f(po.low.net.t)}, gross t ${f(po.low.gross.t)}), 2x costs ${f(po.low.net2x.mean)}R; low minus high ${f(po.lowMinusHigh.net.mean)}R (t ${f(po.lowMinusHigh.net.t)}).`);
  L.push(`In sample ${R.windows.is.from} to ${R.windows.is.to}, pooled: ${pi.signals.low} low-volume and ${pi.signals.high} high-volume fades; low ${f(pi.low.net.mean)}R a month net (t ${f(pi.low.net.t)}, gross ${f(pi.low.gross.mean)}R, t ${f(pi.low.gross.t)}); low minus high ${f(pi.lowMinusHigh.net.mean)}R (t ${f(pi.lowMinusHigh.net.t)}).`);
  L.push(`Placebo (deciding, ${R.placebo.seeds} seeds: per market as many random OOS big-move days of any volume class as it had low-volume fades, faded): the real ${f(R.placebo.real)}R a month beats ${R.placebo.beaten} of ${R.placebo.seeds}; 5th / 50th / 95th percentile ${f(R.placebo.p5)} / ${f(R.placebo.p50)} / ${f(R.placebo.p95)}R. Reported placebo (random eligible days, random side): beats ${R.placeboRandom.beaten} of ${R.placeboRandom.seeds}; median ${f(R.placeboRandom.p50)}R.`, '');
  L.push('Every trade is a fade with a stop at 1R = 1.5 x ATR(20) against it. Net of a round-trip spread (indices 0.03 %, forex 0.015 %, gold 0.02 %, silver / copper / energies 0.10 %, platinum / palladium 0.20 %) and overnight financing per rollover on both sides (gold long 0.0148 %, gold short 0, other markets 0.015 %, forex 0.004 % of the entry price; assumed, today\'s rate for every year). Volume is OANDA\'s quote count, a proxy for volume, not traded volume. Paper research: no live rule, size, filter, stop or council member changed.', '');
  L.push('## The six tests (OOS, base costs, calendar-month sums; Holm over the six)', '', '| Test | Set | IS gross R/month (t) | IS net R/month (t) | OOS gross R/month (t) | OOS net R/month (t) | Newey-West t | OOS 2x R/month | p | Holm p | Passes |', '|---|---|---|---|---|---|---|---|---|---|---|');
  const setOf = { T1: ['pooled', 'low'], T2: ['pooled', 'lowMinusHigh'], T3: ['indices', 'low'], T4: ['metals', 'low'], T5: ['energy', 'low'], T6: ['fx', 'low'] };
  for (const [k, t] of Object.entries(R.tests)) {
    const [s, q] = setOf[k], a = B[s].is[q], b = B[s].oos[q];
    L.push(`| ${k} | ${t.name} | ${f(a.gross.mean)} (${f(a.gross.t)}) | ${f(a.net.mean)} (${f(a.net.t)}) | ${f(b.gross.mean)} (${f(b.gross.t)}) | ${f(b.net.mean)} (${f(b.net.t)}) | ${f(b.net.tNW)} | ${f(b.net2x.mean)} | ${t.p} | ${t.pHolm} | ${t.pass ? 'yes' : 'no'} |`);
  }
  L.push('', '## The four groups, low and high (month sums, net, base costs; reported)', '', '| Set | Kind | IS fades | IS R/month (t) | OOS fades | OOS R/month (t) | OOS gross R/month (t) |', '|---|---|---|---|---|---|---|');
  for (const n of Object.keys(B)) for (const kind of ['low', 'high']) {
    const a = B[n].is, b = B[n].oos;
    L.push(`| ${n} | ${kind} | ${a.signals[kind]} | ${f(a[kind].net.mean)} (${f(a[kind].net.t)}) | ${b.signals[kind]} | ${f(b[kind].net.mean)} (${f(b[kind].net.t)}) | ${f(b[kind].gross.mean)} (${f(b[kind].gross.t)}) |`);
  }
  L.push('', '## Per trade (base costs)', '', '| Set | Window | Kind | n | Gross R | Spread R | Financing R | Net R | Net 2x R | Stops (gap) |', '|---|---|---|---|---|---|---|---|---|---|');
  for (const n of Object.keys(B)) for (const [wn, w] of [['IS', B[n].is], ['OOS', B[n].oos]]) for (const kind of ['low', 'high', 'all']) {
    const s = w.trades[kind]; if (!s.n) continue;
    L.push(`| ${n} | ${wn} | ${kind} | ${s.n} | ${f(s.gross)} | ${s.spread} | ${s.fin} | ${f(s.net)} | ${f(s.net2x)} | ${s.stops} (${s.gaps}) |`);
  }
  L.push('', '## By market (net R a trade)', '', '| Market | Group | First | Last | Candles | IS low n | IS low R | IS high n | IS high R | OOS low n | OOS low R | OOS high n | OOS high R |', '|---|---|---|---|---|---|---|---|---|---|---|---|---|');
  for (const [k, m] of Object.entries(R.byMarket)) L.push(`| ${k} | ${m.group} | ${m.first} | ${m.last} | ${m.candles} | ${m.isLow} | ${f(m.isLowNet)} | ${m.isHigh} | ${f(m.isHighNet)} | ${m.oosLow} | ${f(m.oosLowNet)} | ${m.oosHigh} | ${f(m.oosHighNet)} |`);
  L.push('', '## By year (pooled, net R a trade)', '', '| Year | Low-volume fades | Low net R | High-volume fades | High net R |', '|---|---|---|---|---|');
  for (const [y, v] of Object.entries(R.byYear).sort()) L.push(`| ${y} | ${v.low} | ${f(v.lowNet)} | ${v.high} | ${f(v.highNet)} |`);
  L.push('', '## Reading', '');
  if (R.verdict === 'PASS') L.push('- The bar was met. With hundreds of decisive tests run before this one, this is a lead to replicate on markets or years it did not use, not an edge; nothing live changes.');
  else L.push('- The pre-registered bar was not met: no proposal is written and nothing changes. A FAIL is not evidence that the opposite (following low-volume moves) works, and it does not test the idea on real traded volume: the quote count may simply not carry it.');
  L.push(`- Low minus high (T2) is ${f(po.lowMinusHigh.net.mean)}R a month OOS (t ${f(po.lowMinusHigh.net.t)}) and ${f(pi.lowMinusHigh.net.mean)}R IS (t ${f(pi.lowMinusHigh.net.t)}); the pre-registration read a negative sign as agreeing with Campbell, Grossman and Wang (high-volume moves reverse more). Said plainly: a difference of month SUMS also carries the count, and high-volume fades are about ${Math.round(po.signals.high / Math.max(1, po.signals.low))} times as many as low-volume ones, all losing after costs; per trade the OOS difference is ${f(rd(po.trades.low.net - po.trades.high.net))}R net (${f(rd(po.trades.low.gross - po.trades.high.gross))}R gross), and neither set clears its costs.`);
  L.push('- The deciding placebo draws big-move days of any volume class: it asks whether the volume split adds anything to fading a big move.');
  L.push('', '## What this cannot show', '');
  L.push('- A quote count is not traded volume; spot forex and metals have no central volume. Price series without dividends; assumed spreads and financing, today\'s rates for every year. Overlapping trades and co-moving markets: only calendar-month sums are tested.');
  L.push('', 'To repeat: `node research/edge/volume-reversal/run.mjs` (reads council-data with `git show`, no network). Tests: `tests/volume-reversal.test.mjs`.', '');
  return L.join('\n');
}

// ─── data ───
const gitRead = (k) => execFileSync('git', ['show', `origin/council-data:research/daily/${k}.json`], { encoding: 'utf8', maxBuffer: 64 << 20 });
export function loadData(read = gitRead) { return Object.fromEntries(MARKETS.map((k) => [k, prepare(JSON.parse(read(k)).rows)])); }

if (process.argv[1] && fs.realpathSync(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const data = loadData();
  const last = new Date(Math.max(...Object.values(data).map((b) => b.at(-1).time)) * 1000).toISOString().slice(0, 10);
  const res = study(data, last);
  fs.writeFileSync(new URL('./result.json', import.meta.url), JSON.stringify(res, null, 1) + '\n');
  fs.writeFileSync(new URL('./RESULT.md', import.meta.url), report(res));
  console.log(res.verdict, res.checks, res.tests, { ...res.placebo, runs: undefined }, { ...res.placeboRandom, runs: undefined });
}
