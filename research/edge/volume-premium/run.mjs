// The high-volume return premium on index, metal, energy and forex CFDs, daily (pre-registered 14 Nov 2026, PREREGISTRATION.md,
// pushed first). A day whose OANDA quote count is above at least 45 of its previous 50 days (and whose absolute return is not in
// the top decile of its previous 50) is bought at its close, held H = 5 (primary) / 20 days, stop 2 x ATR(20). Compared with the
// same long on every eligible day of that market and month (high - all), net of spread and overnight financing.
//   node research/edge/volume-premium/run.mjs      reads council-data with git show, writes result.json and RESULT.md
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
export const P = { LOOK: 50, TOP: 45, MIN_V: 10, ATR_N: 20, ATR_MULT: 2, H: 5, H2: 20, SEEDS: 40, BEAT: 38, NW_LAGS: 3, ALPHA: 0.05, FROM: '2005-01-01' };
export const IS = { from: '2005-01', to: '2016-12' };
export const OOS = { from: '2017-01', to: '2026-10' };
// round trip as a share of the entry price (trend-breadth COST; gold written in the pre-registration)
export const SPREAD = { index: 0.0003, fx: 0.00015, mid: 0.001, wide: 0.002, gold: 0.0002 };
export const COST_CLASS = { xau: 'gold', xag: 'mid', xcu: 'mid', xpt: 'wide', xpd: 'wide', wtico: 'mid', bco: 'mid', natgas: 'mid' };
export const costFrac = (k) => SPREAD[COST_CLASS[k] || (groupOf(k) === 'fx' ? 'fx' : 'index')];
// financing a rollover as a share of the entry price
export const FIN_NIGHT = { gold: FIN.xau.long, other: 0.00015, fx: 0.00004 };
export const finNight = (k) => (k === 'xau' ? FIN_NIGHT.gold : groupOf(k) === 'fx' ? FIN_NIGHT.fx : FIN_NIGHT.other);
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
// { high, low, eligible } or null when there is not enough clean history
export function signalAt(bars, d, { cap = true } = {}) {
  const L = P.LOOK;
  if (d - L - 1 < 0) return null;
  const b = bars[d]; if (!(b.v >= P.MIN_V) || !(b.close > 0) || !(bars[d - 1].close > 0)) return null;
  let above = 0, below = 0, rBelow = 0;
  const r = Math.abs(Math.log(b.close / bars[d - 1].close));
  for (let i = d - L; i < d; i++) {
    const v = bars[i].v; if (!(v >= P.MIN_V)) return null;
    if (v < b.v) above++; else if (v > b.v) below++;
    const ri = Math.abs(Math.log(bars[i].close / bars[i - 1].close));
    if (ri < r) rBelow++;
  }
  const eligible = cap ? rBelow < P.TOP : true;
  return { above, below, rBelow, eligible, high: eligible && above >= P.TOP, low: eligible && below >= P.TOP };
}

// ─── one long: entry at the close of d, stop 1R below, out at the close of d + H ───
export function simLong(bars, d, H, dist) {
  const entry = bars[d].close, stop = entry - dist, x = d + H;
  if (x >= bars.length) return null;
  for (let i = d + 1; i <= x; i++) {
    const b = bars[i];
    if (b.low <= stop) { const gap = b.open <= stop; return { entry, stop, exit: gap ? b.open : stop, exitIdx: i, how: gap ? 'gap' : 'stop' }; }
  }
  return { entry, stop, exit: bars[x].close, exitIdx: x, how: 'close' };
}
export const exitTime = (t, how) => (how === 'close' ? t + DAY : how === 'gap' ? t : t + DAY / 2);

export function tradeAt(key, bars, d, H) {
  const a = atr(bars, d); if (!(a > 0)) return null;
  const dist = P.ATR_MULT * a, L = simLong(bars, d, H, dist); if (!L) return null;
  if (!(L.stop < L.entry)) throw new Error(`trade without a stop below its entry: ${key} ${d}`);
  const gross = (L.exit - L.entry) / dist, costR = (costFrac(key) * L.entry) / dist;
  const n = nights(bars[d].time + DAY, exitTime(bars[L.exitIdx].time, L.how));
  const finR = (n * finNight(key) * L.entry) / dist;
  return { gross, costR, finR, nights: n, how: L.how };
}
export const netOf = (t, k = 1) => t.gross - k * (t.costR + t.finR);

// every eligible day of a market with its trade at H: { d, month, high, low, eligible, trade }
export function daysOf(key, bars, H, opts) {
  const out = [];
  for (let d = 0; d < bars.length; d++) {
    const s = signalAt(bars, d, opts); if (!s || !s.eligible) continue;
    const tr = tradeAt(key, bars, d, H); if (!tr) continue;
    out.push({ key, d, month: ym(bars[d].time), high: s.high, low: s.low, trade: tr });
  }
  return out;
}

// ─── month values: d(i) = net(i) - mean net of the all-days trades of that market and month ───
export function benchMap(days, k = 1) {
  const acc = new Map();
  for (const x of days) { const id = x.key + '|' + x.month, a = acc.get(id) || [0, 0]; a[0] += netOf(x.trade, k); a[1]++; acc.set(id, a); }
  return new Map([...acc].map(([id, [s, n]]) => [id, s / n]));
}
// per calendar month of the window: the sum over the picked days of (net - bench); 0 for a month with none
export function monthValues(picked, bench, win, k = 1, { diff = true } = {}) {
  const by = new Map();
  for (const x of picked) { const v = netOf(x.trade, k) - (diff ? bench.get(x.key + '|' + x.month) : 0); by.set(x.month, (by.get(x.month) || 0) + v); }
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
// standard normal CDF (Abramowitz-Stegun 7.1.26 on erf)
export function normCdf(z) {
  const x = Math.abs(z) / Math.SQRT2, t = 1 / (1 + 0.3275911 * x);
  const erf = 1 - (((((1.061405429 * t - 1.453152027) * t) + 1.421413741) * t - 0.284496736) * t + 0.254829592) * t * Math.exp(-x * x);
  return z >= 0 ? 0.5 * (1 + erf) : 0.5 * (1 - erf);
}
export const pTwo = (t) => 2 * (1 - normCdf(Math.abs(t)));
// Holm step-down: adjusted p per name
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
// one horizon's full block for a set of markets' days
export function block(days, win) {
  const w = days.filter((x) => inWin(x, win)), hi = w.filter((x) => x.high), lo = w.filter((x) => x.low);
  const b0 = benchMap(w, 0), b1 = benchMap(w, 1), b2 = benchMap(w, 2);
  const hmL = (k, b) => { const h = monthValues(hi, b, win, k), l = monthValues(lo, b, win, k); return h.map((v, i) => v - l[i]); };
  return {
    signals: { high: hi.length, low: lo.length, all: w.length },
    trades: { high: tradeStats(hi), low: tradeStats(lo), all: tradeStats(w) },
    highMinusAll: { gross: stats(monthValues(hi, b0, win, 0)), net: stats(monthValues(hi, b1, win, 1)), net2x: stats(monthValues(hi, b2, win, 2)) },
    lowMinusAll: { net: stats(monthValues(lo, b1, win, 1)) },
    highMinusLow: { net: stats(hmL(1, b1)) },
    highOwn: { gross: stats(monthValues(hi, b0, win, 0, { diff: false })), net: stats(monthValues(hi, b1, win, 1, { diff: false })), net2x: stats(monthValues(hi, b2, win, 2, { diff: false })) },
  };
}
export function placebo(days, win, seeds = P.SEEDS) {
  const w = days.filter((x) => inWin(x, win)), b1 = benchMap(w, 1), by = {};
  for (const x of w) (by[x.key] ||= []).push(x);
  const out = [];
  for (let s = 1; s <= seeds; s++) {
    const rng = mulberry32(s), pick = [];
    for (const k of Object.keys(by)) { const n = by[k].filter((x) => x.high).length; pick.push(...sample(by[k], n, rng)); }
    out.push(rd(stats(monthValues(pick, b1, win, 1)).mean));
  }
  return out;
}

// ─── the whole study ───
export function study(data, lastCandle) {
  const H = {}, uncapped = {};
  for (const h of [P.H, P.H2]) H[h] = Object.fromEntries(MARKETS.filter((k) => data[k]).map((k) => [k, daysOf(k, data[k], h)]));
  for (const k of MARKETS) if (data[k]) uncapped[k] = daysOf(k, data[k], P.H, { cap: false });
  const sets = { pooled: MARKETS, ...GROUPS };
  const pick = (byKey, keys) => keys.flatMap((k) => byKey[k] || []);
  const horizons = {};
  for (const h of [P.H, P.H2]) {
    horizons[h] = {};
    for (const [name, keys] of Object.entries(sets)) horizons[h][name] = { is: block(pick(H[h], keys), IS), oos: block(pick(H[h], keys), OOS) };
  }
  const tests = Object.fromEntries(Object.keys(sets).map((n) => { const s = horizons[P.H][n].oos.highMinusAll.net; return [n, { mean: s.mean, t: s.t, p: rd(pTwo(s.t), 5) }]; }));
  const adj = holm(Object.fromEntries(Object.entries(tests).map(([n, v]) => [n, v.p])));
  for (const n of Object.keys(tests)) { tests[n].pHolm = rd(adj[n], 5); tests[n].pass = tests[n].t >= 2 && adj[n] <= P.ALPHA; }
  const pm = placebo(pick(H[P.H], MARKETS), OOS), real = horizons[P.H].pooled.oos.highMinusAll.net.mean;
  const beaten = pm.filter((x) => real > x).length;
  const pooled = horizons[P.H].pooled;
  const checks = {
    oosT2Holm: tests.pooled.mean > 0 && tests.pooled.pass,
    isPositive: pooled.is.highMinusAll.net.mean > 0,
    oos2xPositive: pooled.oos.highMinusAll.net2x.mean > 0 && pooled.oos.highOwn.net2x.mean > 0,
    beatsPlacebo: beaten >= P.BEAT,
  };
  const unc = { is: block(pick(uncapped, MARKETS), IS).highMinusAll.net, oos: block(pick(uncapped, MARKETS), OOS).highMinusAll.net };
  const byMarket = {};
  for (const k of MARKETS) {
    if (!data[k]) continue;
    const b = block(H[P.H][k], OOS), bi = block(H[P.H][k], IS);
    byMarket[k] = { group: groupOf(k), first: new Date(data[k][0].time * 1000).toISOString().slice(0, 10), last: new Date(data[k].at(-1).time * 1000).toISOString().slice(0, 10), candles: data[k].length,
      isHigh: bi.signals.high, isMean: bi.highMinusAll.net.mean, oosHigh: b.signals.high, oosMean: b.highMinusAll.net.mean, oosT: b.highMinusAll.net.t };
  }
  const byYear = {};
  for (const x of pick(H[P.H], MARKETS)) {
    const y = x.month.slice(0, 4); if (x.month > OOS.to) continue;
    (byYear[y] ||= { high: 0, all: 0, highNet: 0, allNet: 0 });
    byYear[y].all++; byYear[y].allNet += netOf(x.trade);
    if (x.high) { byYear[y].high++; byYear[y].highNet += netOf(x.trade); }
  }
  for (const y in byYear) { const v = byYear[y]; byYear[y] = { high: v.high, highNet: rd(v.highNet / (v.high || 1)), all: v.all, allNet: rd(v.allNet / v.all) }; }
  return {
    study: 'volume-premium', built: '2026-11-14', lastCandle,
    title: 'High-volume return premium (OANDA quote count), index, metal, energy and forex CFDs',
    rule: 'long at the close of a day whose quote count is above 45 of its previous 50 (absolute return not above 45 of its previous 50), H = 5 / 20 days, stop 2 x ATR(20); high - all days of that market and month, net',
    params: P, groups: GROUPS, spread: SPREAD, costClass: COST_CLASS, finNight: FIN_NIGHT, windows: { is: IS, oos: OOS },
    horizons, tests, placebo: { seeds: P.SEEDS, real, beaten, p5: rd(percentile(pm, 0.05)), p50: rd(percentile(pm, 0.5)), p95: rd(percentile(pm, 0.95)), max: rd(Math.max(...pm)), runs: pm },
    uncapped: unc, byMarket, byYear, checks, verdict: Object.values(checks).every(Boolean) ? 'PASS' : 'FAIL',
  };
}

// ─── the report (RESULT.md is this function's output; the test regenerates it from result.json) ───
export function report(R) {
  const f = (x) => (x == null ? 'n/a' : (x > 0 ? '+' : '') + x), mk = (b) => (b ? 'met' : 'missed'), c = R.checks, L = [];
  const h5 = R.horizons[R.params.H], h20 = R.horizons[R.params.H2], po = h5.pooled.oos, pi = h5.pooled.is, tp = R.tests.pooled;
  L.push('# The high-volume return premium on index, metal, energy and forex CFDs: result', '');
  const r2 = (x) => f(+(+x).toFixed(2)), ti = R.tests.indices;
  const why = R.verdict === 'PASS'
    ? `PASS. Pooled OOS high-minus-all ${r2(po.highMinusAll.net.mean)}R a month net, t ${f(tp.t)}, Holm p ${(+tp.pHolm).toFixed(3)}; positive in sample, at 2x costs and above ${R.placebo.beaten} of ${R.placebo.seeds} placebos. A lead to replicate, not an edge.`
    : `FAIL. Pooled OOS high-minus-all ${r2(po.highMinusAll.net.mean)}R a month net, t ${f(tp.t)}, Holm p ${(+tp.pHolm).toFixed(3)} (bar: t >= 2 after Holm); indices alone t ${f(ti.t)}, reported, not the primary.`;
  L.push(`**Verdict: ${why}**`, '');
  L.push(`Pre-registered bar (PREREGISTRATION.md, pushed alone first): pooled OOS H = 5 t >= 2 with Holm p <= 0.05 ${mk(c.oosT2Holm)}; pooled IS > 0 ${mk(c.isPositive)}; OOS > 0 at 2x costs, the difference and the high-volume longs themselves ${mk(c.oos2xPositive)}; above >= ${R.params.BEAT} of ${R.placebo.seeds} placebos ${mk(c.beatsPlacebo)}.`, '');
  L.push(`Out of sample ${R.windows.oos.from} to ${R.windows.oos.to}: ${po.signals.high} high-volume days of ${po.signals.all} eligible (pooled, H = 5). High-volume longs ${f(po.trades.high.net)}R a trade net (gross ${f(po.trades.high.gross)}R) against all days ${f(po.trades.all.net)}R (gross ${f(po.trades.all.gross)}R). High minus all, month sums: gross ${f(po.highMinusAll.gross.mean)}R (t ${f(po.highMinusAll.gross.t)}), net ${f(po.highMinusAll.net.mean)}R (t ${f(po.highMinusAll.net.t)}, Newey-West ${f(po.highMinusAll.net.tNW)}), 2x costs ${f(po.highMinusAll.net2x.mean)}R.`);
  L.push(`In sample ${R.windows.is.from} to ${R.windows.is.to}: ${pi.signals.high} high-volume days; high minus all net ${f(pi.highMinusAll.net.mean)}R a month (t ${f(pi.highMinusAll.net.t)}), gross ${f(pi.highMinusAll.gross.mean)}R (t ${f(pi.highMinusAll.gross.t)}).`);
  L.push(`Placebo (${R.placebo.seeds} seeds, the same number of random eligible days per market, OOS): the real pooled mean ${f(R.placebo.real)}R beats ${R.placebo.beaten} of ${R.placebo.seeds}; placebo 5th / 50th / 95th percentile ${f(R.placebo.p5)} / ${f(R.placebo.p50)} / ${f(R.placebo.p95)}R a month.`, '');
  L.push('Every trade is a long with a stop at 1R = 2 x ATR(20) below its entry. Net of a round-trip spread (indices 0.03 %, forex 0.015 %, gold 0.02 %, silver / copper / energies 0.10 %, platinum / palladium 0.20 %) and overnight financing per rollover (gold 0.0148 %, other longs 0.015 %, forex 0.004 % of the entry price; assumed, today\'s rate for every year). The volume is OANDA\'s quote count, a noisy proxy for traded volume. Paper research: no live rule, size, filter, stop or council member changed.', '');
  L.push('## The five tests (H = 5, base costs, high minus all, calendar-month sums)', '');
  L.push('| Set | IS high days | IS gross R/month (t) | IS net R/month (t) | OOS high days | OOS gross R/month (t) | OOS net R/month (t) | Newey-West t | OOS 2x R/month | p | Holm p | Passes |', '|---|---|---|---|---|---|---|---|---|---|---|---|');
  for (const n of Object.keys(R.tests)) {
    const a = h5[n].is, b = h5[n].oos, t = R.tests[n];
    L.push(`| ${n} | ${a.signals.high} | ${f(a.highMinusAll.gross.mean)} (${f(a.highMinusAll.gross.t)}) | ${f(a.highMinusAll.net.mean)} (${f(a.highMinusAll.net.t)}) | ${b.signals.high} | ${f(b.highMinusAll.gross.mean)} (${f(b.highMinusAll.gross.t)}) | ${f(b.highMinusAll.net.mean)} (${f(b.highMinusAll.net.t)}) | ${f(b.highMinusAll.net.tNW)} | ${f(b.highMinusAll.net2x.mean)} | ${t.p} | ${t.pHolm} | ${t.pass ? 'yes' : 'no'} |`);
  }
  L.push('', '## Per trade (H = 5, base costs)', '', '| Set | Window | Kind | n | Gross R | Spread R | Financing R | Net R | Net 2x R | Stops (gap) |', '|---|---|---|---|---|---|---|---|---|---|');
  for (const n of Object.keys(R.tests)) for (const [wn, w] of [['IS', h5[n].is], ['OOS', h5[n].oos]]) for (const kind of ['high', 'low', 'all']) {
    const s = w.trades[kind]; if (!s.n) continue;
    L.push(`| ${n} | ${wn} | ${kind} | ${s.n} | ${f(s.gross)} | ${s.spread} | ${s.fin} | ${f(s.net)} | ${f(s.net2x)} | ${s.stops} (${s.gaps}) |`);
  }
  L.push('', '## Reported only (never deciding)', '', '| Comparison | Window | Mean R/month (t) |', '|---|---|---|');
  for (const [wn, w] of [['IS', h5.pooled.is], ['OOS', h5.pooled.oos]]) {
    L.push(`| H = 5 pooled, high-volume longs alone (net) | ${wn} | ${f(w.highOwn.net.mean)} (${f(w.highOwn.net.t)}) |`);
    L.push(`| H = 5 pooled, low minus all (net) | ${wn} | ${f(w.lowMinusAll.net.mean)} (${f(w.lowMinusAll.net.t)}) |`);
    L.push(`| H = 5 pooled, high minus low (net) | ${wn} | ${f(w.highMinusLow.net.mean)} (${f(w.highMinusLow.net.t)}) |`);
  }
  L.push(`| H = 5 pooled, high minus all, no return cap (net) | IS | ${f(R.uncapped.is.mean)} (${f(R.uncapped.is.t)}) |`);
  L.push(`| H = 5 pooled, high minus all, no return cap (net) | OOS | ${f(R.uncapped.oos.mean)} (${f(R.uncapped.oos.t)}) |`);
  for (const n of Object.keys(R.tests)) for (const [wn, w] of [['IS', h20[n].is], ['OOS', h20[n].oos]]) L.push(`| H = 20 ${n}, high minus all (net; Newey-West t ${f(w.highMinusAll.net.tNW)}) | ${wn} | ${f(w.highMinusAll.net.mean)} (${f(w.highMinusAll.net.t)}) |`);
  for (const [wn, w] of [['IS', h20.pooled.is], ['OOS', h20.pooled.oos]]) {
    L.push(`| H = 20 pooled, high minus low (net) | ${wn} | ${f(w.highMinusLow.net.mean)} (${f(w.highMinusLow.net.t)}) |`);
  }
  L.push('', '## By market (H = 5, high minus all, net R a month)', '', '| Market | Group | First | Last | Candles | IS high days | IS R/month | OOS high days | OOS R/month (t) |', '|---|---|---|---|---|---|---|---|---|');
  for (const [k, m] of Object.entries(R.byMarket)) L.push(`| ${k} | ${m.group} | ${m.first} | ${m.last} | ${m.candles} | ${m.isHigh} | ${f(m.isMean)} | ${m.oosHigh} | ${f(m.oosMean)} (${f(m.oosT)}) |`);
  L.push('', '## By year (H = 5, pooled, net R a trade)', '', '| Year | High-volume days | High net R | All days | All net R |', '|---|---|---|---|---|');
  for (const [y, v] of Object.entries(R.byYear)) L.push(`| ${y} | ${v.high} | ${f(v.highNet)} | ${v.all} | ${f(v.allNet)} |`);
  L.push('', '## Reading', '');
  if (R.verdict === 'PASS') L.push('- The bar was met. With 333 decisive tests run before this one and none surviving a family correction, this is a lead to replicate on markets or years it did not use, not an edge; nothing live changes.');
  else L.push('- The pre-registered bar was not met: no proposal is written and nothing changes. A FAIL is not evidence that shorting high-activity days works, and it does not test the effect on real traded volume: the quote count may simply not carry it.');
  { const a = h5.indices; L.push(`- Reported, not deciding: the index group alone passes its own Holm test (OOS ${f(a.oos.highMinusAll.net.mean)}R a month, t ${f(R.tests.indices.t)}; IS t ${f(a.is.highMinusAll.net.t)}), while metals, energies and forex are negative in both windows. The high-volume index longs themselves make ${f(a.oos.trades.high.net)}R a trade net OOS and ${f(a.oos.trades.high.net2x)}R at 2x costs, so the premium is relative to other days, not a trade that clears its costs. Chosen after seeing the groups, an index-only rule would need its own pre-registration on other data (other years or real futures volume).`); }
  L.push('- The comparison is the same long on any eligible day of that market in that month, so the market\'s drift cancels; the costs of the two longs nearly cancel too, which is why the bar also asks the high-volume longs themselves to stay positive at 2x costs.');
  L.push('- The placebo draws as many random eligible days per market as there were high-volume days: it shows how far a random set of days strays from the benchmark.');
  L.push('', '## What this cannot show', '');
  L.push('- A quote count is not traded volume; spot forex and metals have no central volume. Price series without dividends; assumed spreads and financing, today\'s rates for every year. Overlapping trades and co-moving markets: only calendar-month sums are tested.');
  L.push('', 'To repeat: `node research/edge/volume-premium/run.mjs` (reads council-data with `git show`, no network). Tests: `tests/volume-premium.test.mjs`.', '');
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
  console.log(res.verdict, res.checks, res.tests, { ...res.placebo, runs: undefined });
}
