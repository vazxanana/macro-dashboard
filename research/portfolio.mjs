// Portfolio and sizing study for Meridian (council/) + the ICT desk (ict/) as ONE book (research and paper only).
//   node research/portfolio.mjs <council-data dir> [out.json]
// <council-data dir> holds ict/replay.json, backtest.json and trades.json (e.g. `git show origin/council-data:<path>` copies).
// Nothing here is read by a live system. It never changes a rule, a limit or the cTrader mirror.
//
// Units: every trade carries R per ONE unit of risk, net of costs. A sizing scheme gives each trade a risk (fraction of
// equity per 1R, e.g. 0.005 = 0.5%); its P&L is risk x R, booked on the UTC day the trade closes; equity compounds daily.
import fs from 'node:fs';
import path from 'node:path';

export const DAY = 86400;
export const INDEX = new Set(['nq', 'es', 'ym', 'rty']);
// the markets the cTrader demo mirror can trade (council/ctrader-mirror.mjs SYMBOLS, crypto excluded: no symbol there)
export const MER_MIRROR = ['xau', 'eurusd', 'gbpusd', 'audusd', 'usdcad', 'usdchf'];
// CME micro round trip in index points (spread + fees + 1 tick slip each way), research/edge/costs RESULT.md
export const ICT_COST_PTS = { nq: 1.37, es: 1.0, ym: 5.5, rty: 0.55, gc: 0.42 };
// the council backtest's cost charge is one spread (council/backtest.mjs spreadOf): r0 = spread / cost
const MER_SPREAD = (m) => (m === 'xau' ? 0.3 : 0.0001);
// $ per 1.0 price move for 0.01 lot on the demo (cTrader volume in suite.json: XAUUSD 0.01 lot = 1 oz, EURUSD = 1,000 units).
// Index CFDs: ASSUMED 1 lot = $1 per point, so 0.01 lot = $0.01 per point; check the broker's lotSize before relying on it.
export const USD_PER_POINT_001 = { xau: 1, gc: 1, eurusd: 1000, gbpusd: 1000, audusd: 1000, usdcad: 1000 / 1.38, usdchf: 1000 / 0.8, nq: 0.01, es: 0.01, ym: 0.01, rty: 0.01 };

export const dayOf = (t) => new Date(t * 1000).toISOString().slice(0, 10);
export const monthOf = (d) => d.slice(0, 7);
const dayT = (d) => Date.parse(d + 'T00:00:00Z') / 1000;
export function daysBetween(from, to) { const out = []; for (let t = dayT(from); t <= dayT(to); t += DAY) out.push(dayOf(t)); return out; }
const q = (a, p) => { if (!a.length) return null; const s = [...a].sort((x, y) => x - y); return s[Math.min(s.length - 1, Math.max(0, Math.floor(p * (s.length - 1) + 1e-9)))]; };
const mean = (a) => (a.length ? a.reduce((x, y) => x + y, 0) / a.length : 0);
const r2 = (v, d = 2) => (v == null || !Number.isFinite(v) ? null : +v.toFixed(d));

// ---------- loaders: everything becomes { id, sys, mkt, side, open, close, R, size, tier, r0 } ----------
// ICT replay (ict/replay.json): A-setups only by default (the only ICT trades the mirror sends). R per unit = Rraw (the
// record's R is already x size), minus the micro-futures round trip in R.
export function normIct(replay, { aOnly = true, cost = true } = {}) {
  const T = (replay && replay.trades) || [];
  return T.filter((x) => x.closed && Number.isFinite(x.R) && (!aOnly || x.aset)).map((x) => {
    const size = x.size || 1, raw = Number.isFinite(x.Rraw) ? x.Rraw : x.R / size;
    const c = cost && x.r0 > 0 ? (ICT_COST_PTS[x.market] || 0) / x.r0 : 0;
    return { id: x.id, sys: 'ict', mkt: x.market, side: x.side === 'sell' ? -1 : 1, open: x.opened, close: x.closed, R: raw - c, size, tier: x.aset ? (x.aplus ? 'A+' : 'A') : null, r0: x.r0 };
  });
}
// Meridian 30-day replay (backtest.json): closed, non-twin rows of one rule. Default = the last engine rule the owner put live
// (7 Nov: Scalp against the D1 trend, outside Asia) on the markets the mirror trades. No close time in the file: the close is
// estimated as fill + `hold` hours (median live/shadow Scalp hold in trades.json), used only for overlap counts and booking.
export function normMeridianBacktest(bt, { setup = 'scalp', d1 = 'against', noAsia = true, markets = MER_MIRROR, hold = 1.25, costMult = 1 } = {}) {
  const C = (bt && bt.tradeCols) || [], ix = Object.fromEntries(C.map((c, i) => [c, i]));
  const out = [];
  for (const r of (bt && bt.trades) || []) {
    const g = (k) => r[ix[k]];
    if (g('status') !== 'closed' || g('setup') !== setup || (d1 && g('d1') !== d1) || (noAsia && g('session') === 'asia')) continue;
    if (markets && !markets.includes(g('market'))) continue;
    const R = g('R_none'); if (!Number.isFinite(R)) continue;
    const open = g('filled') || g('opened'), cost = g('cost') || 0;
    out.push({ id: `mer-${g('market')}-${open}`, sys: 'mer', mkt: g('market'), side: g('side') === 'sell' ? -1 : 1, open, close: open + Math.round(hold * 3600),
      R: R - cost * costMult, size: 1, tier: null, r0: cost > 0 ? MER_SPREAD(g('market')) / cost : null });
  }
  return out.sort((a, b) => a.open - b.open);
}
// Meridian live paper (trades.json): every non-shadow trade that closed with a result, as recorded.
export function normMeridianLive(trades, { markets = null } = {}) {
  return (Array.isArray(trades) ? trades : []).filter((x) => !x.shadow && ['win', 'loss', 'be'].includes(x.status) && Number.isFinite(x.R) && x.closed && (!markets || markets.includes(x.market)))
    .map((x) => ({ id: x.id, sys: 'mer', mkt: x.market, side: x.side === 'sell' ? -1 : 1, open: x.filled || x.opened, close: x.closed, R: x.R / (x.size || 1), size: x.size || 1, tier: null, k: x.k, r0: Math.abs(x.entry - x.stop) || null }))
    .sort((a, b) => a.open - b.open);
}

// ---------- sizing schemes ----------
// s = { base, sizeBy: 'size'|'tier', aSize, cap, vol: {target, days, minDays, warm, max}, kelly: {frac, cap, window, minN, probe},
//       split, lots: {balance, lots}, sysMult: {ict, mer} }. Every estimate uses only trades that closed before the entry.
export function applyScheme(trades, s = {}) {
  const T = [...trades].sort((a, b) => a.open - b.open || a.close - b.close), base = s.base ?? 0.005, out = [];
  const bySys = {}; for (const t of T) (bySys[t.sys] = bySys[t.sys] || []).push(t);
  for (const k of Object.keys(bySys)) bySys[k] = [...bySys[k]].sort((a, b) => a.close - b.close);
  for (const t of T) {
    let risk = base, skip = false, why = null;
    const past = (bySys[t.sys] || []).filter((x) => x.close <= t.open);
    if (s.lots) { const v = USD_PER_POINT_001[t.mkt]; risk = t.r0 > 0 && v ? (t.r0 * v * (s.lots.lots / 0.01)) / s.lots.balance : base; }
    if (s.vol) {
      const V = { days: 20, minDays: 10, warm: 0.0025, max: 0.01, ...s.vol }, d0 = dayOf(t.open), D = new Map();
      for (const x of past) { const d = dayOf(x.close); if (d < d0) D.set(d, (D.get(d) || 0) + x.R); }
      const last = [...D.entries()].sort((a, b) => (a[0] < b[0] ? -1 : 1)).slice(-V.days).map((e) => e[1]);
      risk = last.length < V.minDays ? V.warm : Math.min(V.max, V.target / Math.max(1e-9, Math.sqrt(mean(last.map((v) => v * v)))));
    }
    if (s.kelly) {
      const K = { frac: 0.25, cap: 0.005, window: 100, minN: 20, probe: 0.001, ...s.kelly };
      let h = past.filter((x) => x.mkt === t.mkt).slice(-K.window); if (h.length < K.minN) h = past.slice(-K.window);
      if (h.length < K.minN) risk = K.probe;
      else { const R = h.map((x) => x.R), m = mean(R), v = mean(R.map((r) => (r - m) ** 2)); risk = Math.max(0, Math.min(K.cap, (K.frac * m) / Math.max(v, 1e-9))); }
    }
    if (s.sizeBy && t.sys === 'ict') risk *= s.sizeBy === 'tier' ? (t.tier === 'A+' ? 1 : s.aSize ?? 0.5) : t.size || 1;
    if (s.sysMult && s.sysMult[t.sys] != null) risk *= s.sysMult[t.sys];
    if ((s.cap != null || s.split) && t.sys === 'ict' && INDEX.has(t.mkt)) {
      const n = out.filter((o) => !o.skip && o.sys === 'ict' && INDEX.has(o.mkt) && o.side === t.side && o.open <= t.open && o.close > t.open).length;
      if (s.cap != null && n >= s.cap) { skip = true; why = 'cap'; }
      else if (s.split) risk /= n + 1;   // soft cap: the k-th same-direction index position takes 1/k of its risk
    }
    out.push({ ...t, risk: skip ? 0 : risk, skip, why });
  }
  return out;
}

// ---------- equity, drawdowns, metrics ----------
export function dailyPnl(sized, from, to) {
  const m = new Map(); for (const t of sized) { if (!t.risk) continue; const d = dayOf(t.close); m.set(d, (m.get(d) || 0) + t.risk * t.R); }
  const days = daysBetween(from, to); return days.map((d) => ({ d, p: m.get(d) || 0 }));
}
export function equityOf(daily) { let e = 1; return daily.map(({ d, p }) => ({ d, p, e: (e *= 1 + p) })); }
export function drawdowns(eq) {
  const eps = []; let peak = 1, peakD = eq.length ? eq[0].d : null, cur = null;
  for (const { d, e } of eq) {
    if (e >= peak) { if (cur) { cur.recovered = d; eps.push(cur); cur = null; } peak = e; peakD = d; continue; }
    const dd = 1 - e / peak;
    if (!cur) cur = { peak: peakD, trough: d, depth: dd, recovered: null };
    else if (dd > cur.depth) { cur.depth = dd; cur.trough = d; }
  }
  if (cur) eps.push(cur);
  return eps.sort((a, b) => b.depth - a.depth);
}
export function metrics(daily) {
  const eq = equityOf(daily), end = eq.length ? eq[eq.length - 1].e : 1, dd = drawdowns(eq), maxDD = dd.length ? dd[0].depth : 0;
  const M = new Map(); for (const { d, p } of daily) M.set(monthOf(d), (M.get(monthOf(d)) ?? 1) * (1 + p));
  const months = [...M.entries()].map(([m, g]) => ({ m, r: g - 1 })), worst = months.reduce((a, x) => (!a || x.r < a.r ? x : a), null);
  const yrs = daily.length / 365, ann = yrs > 0 ? end ** (1 / yrs) - 1 : 0;
  const worstDay = daily.reduce((a, x) => Math.min(a, x.p), 0), daysBelow2 = daily.filter((x) => x.p <= -0.02).length;
  return { ret: end - 1, ann, maxDD, retDD: maxDD > 0 ? (end - 1) / maxDD : null, worstMonth: worst ? worst.r : 0, worstMonthAt: worst ? worst.m : null, worstDay, daysBelow2, months };
}

// ---------- correlation and exposure ----------
export function corr(a, b) {
  const n = Math.min(a.length, b.length); if (n < 3) return null;
  const ma = mean(a.slice(0, n)), mb = mean(b.slice(0, n)); let sab = 0, saa = 0, sbb = 0;
  for (let i = 0; i < n; i++) { const x = a[i] - ma, y = b[i] - mb; sab += x * y; saa += x * x; sbb += y * y; }
  return saa > 0 && sbb > 0 ? sab / Math.sqrt(saa * sbb) : null;
}
export function dailyR(trades, from, to, key = () => 'all') {
  const days = daysBetween(from, to), idx = new Map(days.map((d, i) => [d, i])), out = {};
  for (const t of trades) { const d = dayOf(t.close); if (!idx.has(d)) continue; const k = key(t); (out[k] = out[k] || new Array(days.length).fill(0))[idx.get(d)] += t.R; }
  return { days, series: out };
}
export function corrMatrix(series) {
  const K = Object.keys(series).sort(), m = {};
  for (const a of K) { m[a] = {}; for (const b of K) m[a][b] = r2(corr(series[a], series[b])); }
  return m;
}
// correlation only over days on which both markets closed a trade (sparse daily series understate co-movement)
export function coActiveCorr(series) {
  const K = Object.keys(series).sort(), m = {};
  for (const a of K) { m[a] = {}; for (const b of K) { const A = [], B = []; series[a].forEach((v, i) => { if (v !== 0 && series[b][i] !== 0) { A.push(v); B.push(series[b][i]); } }); m[a][b] = A.length >= 8 ? { r: r2(corr(A, B)), n: A.length } : { r: null, n: A.length }; } }
  return m;
}
// daily close-to-close return correlation of the markets themselves (ict/bars.json d1: [t, o, h, l, c])
export function priceCorr(bars, tf = 'd1') {
  const R = {};
  for (const [k, v] of Object.entries(bars || {})) { const a = (v && v[tf]) || [], m = new Map(); for (let i = 1; i < a.length; i++) m.set(dayOf(a[i][0]), Math.log(a[i][4] / a[i - 1][4])); R[k] = m; }
  const K = Object.keys(R).sort(), out = {};
  for (const a of K) { out[a] = {}; for (const b of K) { const d = [...R[a].keys()].filter((x) => R[b].has(x)); out[a][b] = r2(corr(d.map((x) => R[a].get(x)), d.map((x) => R[b].get(x)))); } }
  return { n: K.length ? R[K[0]].size : 0, matrix: out };
}
// pairs of trades on different index markets, same direction, open at the same time
export function indexPairs(trades) {
  const I = trades.filter((t) => INDEX.has(t.mkt)).sort((a, b) => a.open - b.open), A = [], B = [];
  let both = 0, firstLoss = 0, simul = 0;
  for (let i = 0; i < I.length; i++) for (let j = i + 1; j < I.length && I[j].open < I[i].close; j++) {
    const a = I[i], b = I[j]; if (a.mkt === b.mkt || a.side !== b.side) continue;
    A.push(a.R); B.push(b.R); if (a.R < 0) { firstLoss++; if (b.R < 0) both++; } if (Math.abs(a.open - b.open) <= 3600) simul++;
  }
  const loss = I.filter((t) => t.R < 0).length;
  return { pairs: A.length, corrR: r2(corr(A, B)), pLossGivenLoss: firstLoss ? r2(both / firstLoss) : null, baseLoss: I.length ? r2(loss / I.length) : null, within1h: simul };
}
// open-position count through time; `max` = the mirror's maxOpen: arrivals that would find `max` already open
export function exposure(trades, { max = 5, minCluster = 3 } = {}) {
  const T = [...trades].sort((a, b) => a.open - b.open), ev = [];
  for (const t of T) { ev.push([t.open, 1, t]); ev.push([t.close, -1, t]); }
  ev.sort((a, b) => a[0] - b[0] || a[1] - b[1]);
  let n = 0, last = ev.length ? ev[0][0] : 0, peak = 0; const time = {};
  for (const [t, dlt] of ev) { time[n] = (time[n] || 0) + (t - last); last = t; n += dlt; peak = Math.max(peak, n); }
  const total = Object.values(time).reduce((a, b) => a + b, 0) || 1, share = {};
  for (const [k, v] of Object.entries(time)) share[k] = r2(v / total, 3);
  const over = T.filter((t) => T.filter((o) => o !== t && o.open <= t.open && o.close > t.open).length >= max);
  // clusters: episodes with >= minCluster same-direction index positions open at once; overlapping groups merge, R counts each trade once
  const clusters = [];
  for (const t of T) { if (!INDEX.has(t.mkt)) continue;
    const g = T.filter((o) => INDEX.has(o.mkt) && o.side === t.side && o.open <= t.open && o.close > t.open); if (g.length < minCluster) continue;
    const c = clusters.find((x) => x.side === t.side && g.some((o) => x.ids.has(o)));
    if (c) { g.forEach((o) => c.ids.add(o)); c.peak = Math.max(c.peak, g.length); } else clusters.push({ at: dayOf(t.open), side: t.side, ids: new Set(g), peak: g.length }); }
  const cl = clusters.map((c) => ({ at: c.at, side: c.side > 0 ? 'buy' : 'sell', peak: c.peak, trades: c.ids.size, R: r2([...c.ids].reduce((a, x) => a + x.R, 0)), losers: [...c.ids].filter((x) => x.R < 0).length }));
  return { peak, timeShare: share, arrivalsAtMax: over.length, arrivalsAtMaxR: r2(over.reduce((a, x) => a + x.R, 0)), clusters: cl };
}

// ---------- Monte Carlo: one year of days, 5-day blocks drawn per system (independent: measured correlation ~0) ----------
export function rng(seed = 1) { let a = seed >>> 0; return () => { a = (a + 0x6d2b79f5) >>> 0; let t = a; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; }
export function monteCarlo(series, { paths = 10000, days = 365, block = 5, seed = 7, ddAt = 0.1, scale = 1 } = {}) {
  const S = Object.values(series).filter((a) => a.length), R = rng(seed), dds = [], rets = [], worst = [];
  let hit = 0, lossYr = 0;
  for (let p = 0; p < paths; p++) {
    const day = new Array(days).fill(0);
    for (const a of S) for (let i = 0; i < days; ) { const s0 = Math.floor(R() * a.length); for (let k = 0; k < block && i < days; k++, i++) day[i] += a[(s0 + k) % a.length] * scale; }
    let e = 1, pk = 1, dd = 0, wm = Infinity, m0 = 1;
    for (let i = 0; i < days; i++) { e *= 1 + day[i]; if (e > pk) pk = e; dd = Math.max(dd, 1 - e / pk); if ((i + 1) % 30 === 0) { wm = Math.min(wm, e / m0 - 1); m0 = e; } }
    dds.push(dd); rets.push(e - 1); worst.push(wm); if (dd >= ddAt) hit++; if (e < 1) lossYr++;
  }
  return { paths, pDD: hit / paths, ddP50: q(dds, 0.5), ddP95: q(dds, 0.95), retP50: q(rets, 0.5), retP05: q(rets, 0.05), worstMonthP50: q(worst, 0.5), pLossYear: lossYr / paths };
}
// the largest scale of `series` whose P(DD >= ddAt within a year) stays at or under `target` (bisection on the scale)
export function scaleFor(series, { target = 0.05, ddAt = 0.1, paths = 4000, seed = 11 } = {}) {
  let lo = 0, hi = 4;
  for (let i = 0; i < 14; i++) { const mid = (lo + hi) / 2; if (monteCarlo(series, { paths, seed, ddAt, scale: mid }).pDD <= target) lo = mid; else hi = mid; }
  return lo;
}

// ---------- the study ----------
export function sysDaily(sized, sys, from, to) { return dailyPnl(sized.filter((t) => t.sys === sys), from, to).map((x) => x.p); }
export function runStudy({ replay, backtest, live, bars }, opt = {}) {
  const ict = normIct(replay), ictAll = normIct(replay, { aOnly: false }), mer = normMeridianBacktest(backtest, opt.mer), merLive = normMeridianLive(live);
  const merCrypto = normMeridianBacktest(backtest, { ...(opt.mer || {}), markets: null });
  const book = ict.concat(mer).sort((a, b) => a.open - b.open);
  const first = (a) => dayOf(Math.min(...a.map((t) => t.open))), lastC = (a) => dayOf(Math.max(...a.map((t) => t.close)));
  const W = { from: first(book), to: lastC(book), ictFrom: first(ict), ictTo: lastC(ict), merFrom: backtest && backtest.from ? backtest.from.slice(0, 10) : first(mer), merTo: lastC(mer) };
  const st = (a) => ({ n: a.length, R: r2(a.reduce((x, t) => x + t.R, 0)), exp: r2(mean(a.map((t) => t.R)), 3), wr: r2(a.filter((t) => t.R > 0).length / (a.length || 1)) });
  const byKey = (a, f) => { const o = {}; for (const t of a) (o[f(t)] = o[f(t)] || []).push(t); return Object.fromEntries(Object.entries(o).sort().map(([k, v]) => [k, st(v)])); };

  // 1. combined daily curve at fixed 1R = 0.5%
  const fixed = applyScheme(book, { base: 0.005 }), curve = equityOf(dailyPnl(fixed, W.from, W.to));
  // 2. correlation
  const sysR = dailyR(ict.concat(mer), W.merFrom, W.merTo, (t) => t.sys), sysAll = dailyR(ictAll.concat(mer), W.merFrom, W.merTo, (t) => t.sys);
  const liveFrom = merLive.length ? first(merLive) : W.merTo, sysLive = dailyR(ict.concat(merLive), liveFrom, W.merTo, (t) => t.sys);
  const ictMk = dailyR(ictAll, W.ictFrom, W.ictTo, (t) => t.mkt), ictMkA = dailyR(ict, W.ictFrom, W.ictTo, (t) => t.mkt), merMk = dailyR(mer, W.merFrom, W.merTo, (t) => t.mkt);
  const offDiag = (m) => { const v = []; const K = Object.keys(m); for (let i = 0; i < K.length; i++) for (let j = i + 1; j < K.length; j++) if (m[K[i]][K[j]] != null) v.push(m[K[i]][K[j]]); return r2(mean(v)); };
  const idxOnly = (s) => Object.fromEntries(Object.entries(s).filter(([k]) => INDEX.has(k)));
  const correlation = {
    systems: { window: [W.merFrom, W.merTo], ictA_vs_meridian: r2(corr(sysR.series.ict || [], sysR.series.mer || [])), ictAll_vs_meridian: r2(corr(sysAll.series.ict || [], sysAll.series.mer || [])),
      ictA_vs_meridianLive: r2(corr(sysLive.series.ict || [], sysLive.series.mer || [])), liveWindow: [liveFrom, W.merTo] },
    ictMarketsAll: corrMatrix(ictMk.series), ictMarketsA: corrMatrix(ictMkA.series), meridianMarkets: corrMatrix(merMk.series),
    avgPairwise: { ictIndexAll: offDiag(corrMatrix(idxOnly(ictMk.series))), ictIndexA: offDiag(corrMatrix(idxOnly(ictMkA.series))), meridian: offDiag(corrMatrix(merMk.series)) },
    indexPairsAll: indexPairs(ictAll), indexPairsA: indexPairs(ict), ictMarketsCoActive: coActiveCorr(ictMk.series),
    prices: bars ? priceCorr(bars) : null,
  };
  // 3. exposure (ICT over its window; combined only where Meridian exists)
  const inMer = (t) => t.open >= dayT(W.merFrom);
  const goldPairs = (() => { let n = 0, same = 0; const G = book.filter((t) => t.mkt === 'gc' || t.mkt === 'xau');
    for (const a of G) for (const b of G) if (a.sys === 'ict' && b.sys === 'mer' && b.open < a.close && b.close > a.open) { n++; if (a.side === b.side) same++; } return { overlaps: n, sameSide: same }; })();
  const exposureOut = { ictA: exposure(ict), combinedMerWindow: exposure(book.filter(inMer)), goldIctVsMeridian: goldPairs };
  exposureOut.ictA.clusterCount = exposureOut.ictA.clusters.length; exposureOut.ictA.clusterR = r2(exposureOut.ictA.clusters.reduce((a, c) => a + c.R, 0));
  // 4. worst drawdowns of the combined fixed-1R book and what made them
  const eps = drawdowns(curve).slice(0, 5).map((e) => {
    const lo = dayT(e.peak), hi = dayT(e.trough) + DAY, inDD = fixed.filter((t) => t.risk && t.close > lo && t.close <= hi);
    const by = {}; for (const t of inDD) by[`${t.sys}:${t.mkt}`] = r2((by[`${t.sys}:${t.mkt}`] || 0) + t.R);
    const ix = inDD.filter((t) => INDEX.has(t.mkt)), sameDir = ix.length ? Math.max(ix.filter((t) => t.side > 0).length, ix.filter((t) => t.side < 0).length) / ix.length : null;
    return { ...e, depth: r2(e.depth, 4), trades: inDD.length, R: r2(inDD.reduce((a, t) => a + t.R, 0)), losers: inDD.filter((t) => t.R < 0).length, byMarket: by, indexSameDirShare: r2(sameDir) };
  });

  // 5. sizing schemes (base 0.5% per 1R), on two books: Meridian at the same R as ICT, and Meridian at 0.1x
  const runs = [];
  for (const b of opt.books || BOOKS) for (const sc of opt.schemes || SCHEMES) {
    if (sc.only && sc.only !== b.id) continue;
    const s = b.mer === 1 ? sc.s : { ...sc.s, sysMult: { ...(sc.s.sysMult || {}), mer: ((sc.s.sysMult || {}).mer ?? 1) * b.mer } };
    const sized = applyScheme(book, s), daily = dailyPnl(sized, W.from, W.to), m = metrics(daily);
    const merWin = metrics(dailyPnl(sized, W.merFrom, W.merTo));
    const ser = { ict: sysDaily(sized, 'ict', W.ictFrom, W.ictTo), mer: sysDaily(sized, 'mer', W.merFrom, W.merTo) };
    const mc = monteCarlo(ser, { paths: opt.paths || 10000 }), k5 = scaleFor(ser, { paths: opt.scalePaths || 3000 }), at5 = monteCarlo(ser, { paths: opt.paths || 10000, scale: k5 });
    const taken = sized.filter((t) => t.risk > 0), avg = (sys) => r2(mean(sized.filter((t) => t.sys === sys).map((t) => t.risk)) * 100, 3);
    runs.push({ book: b.id, id: sc.id, name: sc.name, s, taken: taken.length, skipped: sized.length - taken.length, avgRisk: { ict: avg('ict'), mer: avg('mer') },
      hist: { ret: r2(m.ret * 100), ann: r2(m.ann * 100), maxDD: r2(m.maxDD * 100), retDD: r2(m.retDD), worstMonth: r2(m.worstMonth * 100), worstMonthAt: m.worstMonthAt, worstDay: r2(m.worstDay * 100), daysBelow2: m.daysBelow2 },
      merWindow: { ret: r2(merWin.ret * 100), maxDD: r2(merWin.maxDD * 100) },
      mc: { retP50: r2(mc.retP50 * 100), retP05: r2(mc.retP05 * 100), ddP50: r2(mc.ddP50 * 100), ddP95: r2(mc.ddP95 * 100), pDD10: r2(mc.pDD, 3), worstMonthP50: r2(mc.worstMonthP50 * 100), pLossYear: r2(mc.pLossYear, 3) },
      at5: { scale: r2(k5, 3), ictRiskPerR: r2(avg('ict') * k5, 3), merRiskPerR: r2(avg('mer') * k5, 3), retP50: r2(at5.retP50 * 100), ddP95: r2(at5.ddP95 * 100), pLossYear: r2(at5.pLossYear, 3) } });
  }
  const schemes = runs;

  // 6. the recommended budget (ICT 0.20% per 1R x the size field, Meridian 0.1x of that per 1R), as replayed and with the ICT
  // replay's expectancy cut to the 2018-26 long-history level (research/edge/portfolio: about +0.11R a trade net)
  const REC = opt.rec || { base: 0.002, sizeBy: 'size', sysMult: { mer: 0.1 } }, cut = opt.haircut ?? 0.2;
  const recRun = (bk) => { const sized = applyScheme(bk, REC), daily = dailyPnl(sized, W.from, W.to), m = metrics(daily);
    const ser = { ict: sysDaily(sized, 'ict', W.ictFrom, W.ictTo), mer: sysDaily(sized, 'mer', W.merFrom, W.merTo) }, mc = monteCarlo(ser, { paths: opt.paths || 10000 });
    const k5 = scaleFor(ser, { paths: opt.scalePaths || 3000 }), byDay = new Map(); for (const t of sized) if (t.risk) { const d = dayOf(t.close); byDay.set(d, (byDay.get(d) || 0) + t.risk * t.R); }
    const ex = exposure(sized.filter((t) => t.risk > 0 && t.open >= dayT(W.merFrom)));
    // largest open risk at any moment (sum of risk of open positions, counted at each entry)
    const T = sized.filter((t) => t.risk > 0); let peakOpenRisk = 0; for (const t of T) peakOpenRisk = Math.max(peakOpenRisk, T.filter((o) => o.open <= t.open && o.close > t.open).reduce((a, o) => a + o.risk, 0));
    return { hist: { ret: r2(m.ret * 100), ann: r2(m.ann * 100), maxDD: r2(m.maxDD * 100), retDD: r2(m.retDD), worstMonth: r2(m.worstMonth * 100), worstDay: r2(m.worstDay * 100), daysBelow2: m.daysBelow2 },
      mc: { retP50: r2(mc.retP50 * 100), retP05: r2(mc.retP05 * 100), ddP50: r2(mc.ddP50 * 100), ddP95: r2(mc.ddP95 * 100), pDD10: r2(mc.pDD, 3), pLossYear: r2(mc.pLossYear, 3), worstMonthP50: r2(mc.worstMonthP50 * 100) },
      scaleFor5pct: r2(k5, 3), ictRiskPerRAt5: r2(REC.base * k5 * 100, 3), peakOpenRisk: r2(peakOpenRisk * 100, 2), arrivalsAt5Open: ex.arrivalsAtMax, arrivalsAt5OpenR: ex.arrivalsAtMaxR }; };
  const recommended = { s: REC, haircutR: cut, asReplayed: recRun(book), ictHaircut: recRun(book.map((t) => (t.sys === 'ict' ? { ...t, R: t.R - cut } : t))) };

  return {
    windows: W,
    inputs: { ictA: st(ict), ictAll: st(ictAll), meridianSleeve: st(mer), meridianSleeveWithCrypto: st(merCrypto), meridianLive: st(merLive),
      ictByMarket: byKey(ict, (t) => t.mkt), ictByTier: byKey(ict, (t) => `${t.mkt === 'gc' ? 'gold' : 'index'} ${t.tier}`), meridianByMarket: byKey(mer, (t) => t.mkt), meridianLiveBySetup: byKey(merLive, (t) => t.k),
      r0: Object.fromEntries([...new Set(book.map((t) => t.mkt))].sort().map((m) => { const a = book.filter((t) => t.mkt === m && t.r0 > 0).map((t) => t.r0); return [m, { p10: r2(q(a, 0.1), 5), p50: r2(q(a, 0.5), 5), p90: r2(q(a, 0.9), 5) }]; })) },
    curve: curve.map(({ d, p, e }) => ({ d, p: r2(p * 100, 3), e: r2(e, 5) })),
    curveMonthly: metrics(dailyPnl(fixed, W.from, W.to)).months.map((x) => ({ m: x.m, r: r2(x.r * 100),
      ictR: r2(ict.filter((t) => monthOf(dayOf(t.close)) === x.m).reduce((a, t) => a + t.R, 0)), merR: r2(mer.filter((t) => monthOf(dayOf(t.close)) === x.m).reduce((a, t) => a + t.R, 0)) })),
    correlation, exposure: { ...exposureOut, ictA: { ...exposureOut.ictA, clusters: exposureOut.ictA.clusters.slice(0, 40) } }, drawdowns: eps, schemes, recommended,
  };
}

export const SCHEMES = [
  { id: 'fixed', name: 'Fixed 1R', s: { base: 0.005 } },
  { id: 'size', name: 'ICT size field (sizeOf)', s: { base: 0.005, sizeBy: 'size' } },
  { id: 'tier', name: 'ICT grade: A+ 1R, A 0.5R', s: { base: 0.005, sizeBy: 'tier', aSize: 0.5 } },
  { id: 'cap1', name: 'Index cap 1 (same direction)', s: { base: 0.005, cap: 1 } },
  { id: 'cap2', name: 'Index cap 2 (same direction)', s: { base: 0.005, cap: 2 } },
  { id: 'split', name: 'Index split (k-th position 1/k)', s: { base: 0.005, split: true } },
  { id: 'vol', name: 'Vol target 0.5%/day per system', s: { vol: { target: 0.005 } } },
  { id: 'kelly', name: 'Quarter Kelly, cap 0.5%', s: { kelly: { frac: 0.25, cap: 0.005 } } },
  { id: 'tierSplit', name: 'Grade A+/A + index split', s: { base: 0.005, sizeBy: 'tier', aSize: 0.5, split: true } },
  { id: 'ictOnly', name: 'ICT only, fixed 1R (reference)', s: { base: 0.005, sysMult: { mer: 0 } }, only: 'equal' },
  { id: 'lots', name: 'Mirror as coded: 0.01 lot, $1,000', s: { lots: { balance: 1000, lots: 0.01 } }, only: 'equal' },
];
// Meridian's R relative to ICT's: equal, and 0.1x (keeps Meridian's share of the book's daily variance near 1/8)
export const BOOKS = [{ id: 'equal', mer: 1 }, { id: 'mer01', mer: 0.1 }];

if (process.argv[1] && process.argv[1].endsWith('portfolio.mjs')) {
  const dir = process.argv[2], out = process.argv[3] || path.join(path.dirname(new URL(import.meta.url).pathname), 'portfolio.json');
  if (!dir) { console.error('usage: node research/portfolio.mjs <council-data dir> [out.json]'); process.exit(1); }
  const rd = (p) => JSON.parse(fs.readFileSync(path.join(dir, p), 'utf8'));
  let bars = null; try { bars = rd('ict/bars.json'); } catch (e) {}
  const res = runStudy({ replay: rd('ict/replay.json'), backtest: rd('backtest.json'), live: rd('trades.json'), bars }, { paths: +(process.env.PATHS || 10000) });
  fs.writeFileSync(out, JSON.stringify({ at: new Date().toISOString(), source: 'council-data ict/replay.json + backtest.json + trades.json', ...res }, null, 1));
  console.log(JSON.stringify(res.inputs, null, 1));
  console.log('corr', JSON.stringify(res.correlation.systems), JSON.stringify(res.correlation.avgPairwise), JSON.stringify(res.correlation.indexPairsA), JSON.stringify(res.correlation.indexPairsAll));
  console.log('exposure', JSON.stringify({ ...res.exposure.ictA, clusters: undefined }), JSON.stringify({ ...res.exposure.combinedMerWindow, clusters: res.exposure.combinedMerWindow.clusters.length }), JSON.stringify(res.exposure.goldIctVsMeridian));
  console.log('prices', JSON.stringify(res.correlation.prices), '\ncoactive', JSON.stringify(res.correlation.ictMarketsCoActive));
  console.log('recommended', JSON.stringify(res.recommended, null, 1));
  console.log('drawdowns', JSON.stringify(res.drawdowns, null, 0));
  for (const b of BOOKS) {
    console.log(`\nbook ${b.id}\n| scheme | trades | avg risk ICT / Mer % | return % | max DD % | return/DD | worst month % | worst day % | MC 1y return p50 % | MC DD p95 % | P(DD>=10%) | at P=5%: ICT / Mer risk per R % | at P=5%: 1y return p50 % |`);
    console.log('|---|---|---|---|---|---|---|---|---|---|---|---|---|');
    for (const s of res.schemes.filter((x) => x.book === b.id)) console.log(`| ${s.name} | ${s.taken} | ${s.avgRisk.ict} / ${s.avgRisk.mer} | ${s.hist.ret} | ${s.hist.maxDD} | ${s.hist.retDD} | ${s.hist.worstMonth} | ${s.hist.worstDay} | ${s.mc.retP50} | ${s.mc.ddP95} | ${s.mc.pDD10} | ${s.at5.ictRiskPerR} / ${s.at5.merRiskPerR} | ${s.at5.retP50} |`);
  }
}
