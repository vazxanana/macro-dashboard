// The low-volatility anomaly across national stock indices (research/edge/index-low-vol/PREREGISTRATION.md, committed first).
// Research only: nothing here is read by the council, the mirror or any page; no order code.
//   node research/edge/index-low-vol/run.mjs fetch <dir>   copies council-data research/daily/<key>.json of the 17 index keys
//                                                          and macro/cache.json into <dir> (outside git); git show from
//                                                          origin/council-data, no network
//   node research/edge/index-low-vol/run.mjs full <dir>    writes result.json and RESULT.md next to this file
// Month ends, ATR, the DGS2 as-of lookup, financing a rollover night, Newey-West and the seeded shuffle are copied from
// research/edge/index-long-reversal/run.mjs (branch index-long-reversal, not imported across branches); weekend folding and
// the rollover count come from council/fills.mjs (main).
import fs from 'node:fs';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { foldWeekend, nights } from '../../../council/fills.mjs';

const HERE = path.dirname(fileURLToPath(import.meta.url));

// ---- the pre-registered constants ----
export const KEYS = ['au200', 'ch20', 'cn50', 'de40', 'es35', 'eu50', 'fr40', 'hk33', 'in50', 'jp225', 'nas100', 'nl25', 'sg30', 'spx500', 'uk100', 'us2000', 'us30'];
export const P = { W: 12, minRet: 150, nLow: 3, nHigh: 3, minRanked: 6, atrN: 20, atrK: 3, staleDays: 7, volTarget: 0.01, monthDays: 21 };
export const VARIANT = { W: 6, minRet: 75 };
export const COST = { roundTrip: 0.0004, markup: 0.025, fallbackRate: 4 };
export const WIN = { decFrom: '2016-01', repTo: '2015-12', minRankedRep: 10 };
export const BAR = { minT: 2, nwLags: 3, placeboPct: 0.95, alpha: 0.05 };
export const PLACEBO = { draws: 40, seed: 20261114 };
export const SCALES = [0, 1, 2];

const DAY = 86400;
const r2 = (x) => (Number.isFinite(x) ? Math.round(x * 100) / 100 : null);
const r3 = (x) => (Number.isFinite(x) ? Math.round(x * 1000) / 1000 : null);
const r4 = (x) => (Number.isFinite(x) ? Math.round(x * 10000) / 10000 : null);

export const monthOf = (t) => { const d = new Date(t * 1000); return d.getUTCFullYear() * 12 + d.getUTCMonth(); };
export const monthLabel = (m) => `${Math.floor(m / 12)}-${String((m % 12) + 1).padStart(2, '0')}`;
export const monthFrom = (s) => { const [y, mo] = s.split('-').map(Number); return y * 12 + mo - 1; };
const monthEndT = (m) => Date.UTC(Math.floor((m + 1) / 12), (m + 1) % 12, 1) / 1000;

export function barsOf(file) {
  return foldWeekend(file.rows.map((r) => ({ time: r[0], open: r[1], high: r[2], low: r[3], close: r[4] })));
}
export function monthEnds(bars) {
  const m = new Map();
  bars.forEach((b, i) => m.set(monthOf(b.time), i));
  return m;
}
export function atrAt(bars, i, n = P.atrN) {
  if (i < n) return null;
  let tr = 0;
  for (let k = i - n + 1; k <= i; k++) tr += Math.max(bars[k].high - bars[k].low, Math.abs(bars[k].high - bars[k - 1].close), Math.abs(bars[k].low - bars[k - 1].close));
  return tr / n;
}

// trailing volatility at the end of month m: sample sd of daily log returns of the candles after the month m-W close up to
// and including the month-m candle. Null when the market is stale, lacks the month m-W close or has too few returns.
export function volAt(D, key, m, W = P.W, minRet = P.minRet) {
  const { bars, ends } = D[key];
  const i = ends.get(m), a = ends.get(m - W);
  if (i == null || a == null) return null;
  if (bars[i].time < monthEndT(m) - P.staleDays * DAY) return null;
  const xs = [];
  for (let k = a + 1; k <= i; k++) xs.push(Math.log(bars[k].close / bars[k - 1].close));
  if (xs.length < minRet) return null;
  const mu = xs.reduce((s, x) => s + x, 0) / xs.length;
  return { sigma: Math.sqrt(xs.reduce((s, x) => s + (x - mu) ** 2, 0) / (xs.length - 1)), n: xs.length };
}
// ranked ascending by volatility (ties by key): [{ key, sigma }]
export function rankAt(D, m, W = P.W, minRet = P.minRet) {
  const out = [];
  for (const key of Object.keys(D).sort()) { const v = volAt(D, key, m, W, minRet); if (v) out.push({ key, sigma: v.sigma }); }
  return out.sort((x, y) => x.sigma - y.sigma || (x.key < y.key ? -1 : 1));
}
// T2's notional weight of a leg: 1 % of the book a month by trailing volatility
export const weightOf = (sigma) => P.volTarget / (sigma * Math.sqrt(P.monthDays));

export function asOfRate(list) {
  const day = (t) => new Date(t * 1000).toISOString().slice(0, 10);
  return (t) => {
    const d = day(t); let lo = 0, hi = list.length - 1, v = null;
    while (lo <= hi) { const mid = (lo + hi) >> 1; if (list[mid][0] <= d) { v = list[mid][1]; lo = mid + 1; } else hi = mid - 1; }
    return v;
  };
}
export function nightRate(dgs2) {
  return (t) => { const v = dgs2(t); return (Math.max(0, v == null ? COST.fallbackRate : v) / 100 + COST.markup) / 365; };
}

// one leg formed at the end of month m, held through month m+1 with a 3 x ATR(20) stop. Its figures are in price units
// times `unit(entry, R)`: T1 passes 1 / R (R units), T2 passes w x 100 / entry (% of the book). Returns null when not
// entered, else { key, dir, m, entry, R, stop, exitPx, exitT, why, g, spr, fin }.
export function legOf(D, key, m, dir, rate, lastT, unit) {
  const { bars, ends } = D[key];
  const i = ends.get(m); if (i == null) return null;
  const e = i + 1; if (e >= bars.length) return null;
  const atr = atrAt(bars, i); if (!(atr > 0)) return null;
  const R = P.atrK * atr, entry = bars[e].open, stop = entry - dir * R, u = unit(entry, R), end = m + 1;
  let g = 0, spr = (COST.roundTrip / 2) * entry * u, fin = 0, ref = entry;
  for (let k = e; k < bars.length; k++) {
    const b = bars[k];
    let px = null, why = null;
    if (k > e && dir * (b.open - stop) <= 0) { px = b.open; why = 'stop-gap'; }
    else if (dir > 0 ? b.low <= stop : b.high >= stop) { px = stop; why = 'stop'; }
    if (px == null) {
      const fileEnds = k + 1 >= bars.length;
      if (!fileEnds && monthOf(bars[k + 1].time) > end) { px = b.close; why = 'time'; }
      else if (fileEnds && b.time < lastT - 10 * DAY) { px = b.close; why = 'data-end'; }
      else if (fileEnds) return null; // cannot happen inside complete months
    }
    if (px != null) {
      g += dir * (px - ref) * u; spr += (COST.roundTrip / 2) * px * u;
      return { key, dir, m, entry, R, stop, exitPx: px, exitT: b.time, why, g, spr, fin };
    }
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

// every month's book, formation months mFrom..mTo (book month = m + 1). Returns per formation month the T1 legs (long Low,
// short High, R units) and the T2 legs (long both books, % of the book, `book` 'low' | 'high').
export function booksOf(D, { W = P.W, minRet = P.minRet, mFrom, mTo, rate, lastT, order = null, memo = new Map() }) {
  const out = [];
  const leg = (id, key, m, dir, unit) => { if (!memo.has(id)) memo.set(id, legOf(D, key, m, dir, rate, lastT, unit)); return memo.get(id); };
  for (let m = mFrom; m <= mTo; m++) {
    let list = rankAt(D, m, W, minRet);
    if (list.length < P.minRanked) continue;
    if (order) list = order(list, m);
    const low = list.slice(0, P.nLow), high = list.slice(-P.nHigh);
    const t1 = [], t2 = [], missing = [];
    for (const [x, dir] of [...low.map((x) => [x, 1]), ...high.map((x) => [x, -1])]) {
      const lg = leg(`1|${x.key}|${m}|${dir}`, x.key, m, dir, (entry, R) => 1 / R);
      if (lg) t1.push(lg); else missing.push(x.key);
    }
    for (const [x, book] of [...low.map((x) => [x, 'low']), ...high.map((x) => [x, 'high'])]) {
      const w = weightOf(x.sigma);
      const lg = leg(`2|${x.key}|${m}|${W}|${r4(x.sigma * 1e6)}`, x.key, m, 1, (entry) => (w * 100) / entry);
      if (lg) t2.push({ ...lg, book, w });
    }
    out.push({ m, book: m + 1, ranked: list.length, low: low.map((x) => x.key), high: high.map((x) => x.key), sig: Object.fromEntries(list.map((x) => [x.key, x.sigma])), t1, t2, missing });
  }
  return out;
}

// monthly rows for book months bFrom..bTo at cost scale c. T1: mean of entered legs' R. T2: low book sum minus high book sum.
export function rowsOf(books, test, bFrom, bTo, c = 1, attr = null) {
  const rows = [];
  for (const h of books) {
    if (h.book < bFrom || h.book > bTo) continue;
    if (test === 1) {
      if (!h.t1.length) continue;
      const w = 1 / h.t1.length; let g = 0, spr = 0, fin = 0;
      for (const lg of h.t1) {
        g += w * lg.g; spr += w * lg.spr; fin += w * lg.fin;
        if (attr) { const k = `${lg.key}|${lg.dir > 0 ? 'long' : 'short'}`; attr.set(k, (attr.get(k) || 0) + w * (lg.g - c * (lg.spr + lg.fin))); }
      }
      rows.push({ m: h.book, g, spr, fin, net: g - c * (spr + fin) });
    } else {
      const side = { low: { g: 0, cost: 0 }, high: { g: 0, cost: 0 } };
      if (!h.t2.length) continue;
      let spr = 0, fin = 0;
      for (const lg of h.t2) {
        const s = lg.book === 'low' ? 1 : -1;
        side[lg.book].g += lg.g; side[lg.book].cost += lg.spr + lg.fin;
        spr += lg.spr; fin += lg.fin;
        if (attr) { const k = `${lg.key}|${lg.book}`; attr.set(k, (attr.get(k) || 0) + s * (lg.g - c * (lg.spr + lg.fin))); }
      }
      const lowNet = side.low.g - c * side.low.cost, highNet = side.high.g - c * side.high.cost;
      // net spread = low book net - high book net (each book is held long and pays its own costs); spr / fin = both books'
      // costs, shown as what holding the two books costs a month
      rows.push({ m: h.book, g: side.low.g - side.high.g, spr, fin, net: lowNet - highNet, lowNet, highNet });
    }
  }
  return rows;
}

export function nwT(xs, lags = BAR.nwLags) {
  const n = xs.length; if (n < 3) return null;
  const mu = xs.reduce((a, b) => a + b, 0) / n, d = xs.map((x) => x - mu);
  const gam = (l) => { let s = 0; for (let k = l; k < n; k++) s += d[k] * d[k - l]; return s / n; };
  let lrv = gam(0);
  for (let l = 1; l <= Math.min(lags, n - 1); l++) lrv += 2 * (1 - l / (lags + 1)) * gam(l);
  return lrv > 0 ? mu / Math.sqrt(lrv / n) : null;
}
export function statsOf(rows, f = 'net') {
  const xs = rows.map((r) => r[f]), n = xs.length;
  if (!n) return { months: 0 };
  const mean = xs.reduce((a, b) => a + b, 0) / n, sd = Math.sqrt(xs.reduce((a, b) => a + (b - mean) ** 2, 0) / Math.max(1, n - 1));
  let cum = 0, peak = 0, dd = 0;
  for (const x of xs) { cum += x; peak = Math.max(peak, cum); dd = Math.min(dd, cum - peak); }
  return { months: n, mean, sd, total: cum, tNW: nwT(xs), tPlain: sd > 0 ? mean / (sd / Math.sqrt(n)) : null, posShare: xs.filter((x) => x > 0).length / n, maxDD: dd, sharpe: sd > 0 ? (mean / sd) * Math.sqrt(12) : null };
}
const pct = (xs, p) => { const a = xs.slice().sort((x, y) => x - y), k = (a.length - 1) * p, lo = Math.floor(k), hi = Math.ceil(k); return a[lo] + (a[hi] - a[lo]) * (k - lo); };
// standard normal CDF (Abramowitz-Stegun 7.1.26 on erf)
export function phi(x) {
  const z = Math.abs(x) / Math.SQRT2, t = 1 / (1 + 0.3275911 * z);
  const erf = 1 - (((((1.061405429 * t - 1.453152027) * t) + 1.421413741) * t - 0.284496736) * t + 0.254829592) * t * Math.exp(-z * z);
  return x >= 0 ? 0.5 * (1 + erf) : 0.5 * (1 - erf);
}
// Holm over one-sided p values: returns pass flags in input order
export function holm(ps, alpha = BAR.alpha) {
  const idx = ps.map((p, i) => [p, i]).sort((a, b) => a[0] - b[0]);
  const ok = ps.map(() => false);
  for (let r = 0; r < idx.length; r++) { if (idx[r][0] <= alpha / (idx.length - r)) ok[idx[r][1]] = true; else break; }
  return ok;
}

// ---- the whole study on loaded data ----
export function study(D, dgsList, opts = {}) {
  const rate = nightRate(asOfRate(dgsList || []));
  let lastT = 0, firstM = Infinity;
  for (const k of Object.keys(D)) { const b = D[k].bars; lastT = Math.max(lastT, b[b.length - 1].time); firstM = Math.min(firstM, monthOf(b[0].time)); }
  const lastM = monthOf(lastT) - 1;
  const decFrom = monthFrom(WIN.decFrom), repTo = monthFrom(WIN.repTo);
  const one = (W, minRet) => {
    const memo = new Map(), B = booksOf(D, { W, minRet, mFrom: firstM, mTo: lastM - 1, rate, lastT, memo });
    let ften = null; for (const h of B) if (h.ranked >= WIN.minRankedRep) { ften = h.m; break; }
    const repFrom = ften + 1, res = { W, B, memo, ften, repFrom };
    for (const t of [1, 2]) {
      const dec = {}, rep = {};
      for (const c of SCALES) { dec[c] = statsOf(rowsOf(B, t, decFrom, lastM, c)); rep[c] = statsOf(rowsOf(B, t, repFrom, repTo, c)); }
      res[`t${t}`] = { dec, rep, decRows: rowsOf(B, t, decFrom, lastM), repRows: rowsOf(B, t, repFrom, repTo) };
    }
    return res;
  };
  const main = one(P.W, P.minRet), variant = one(VARIANT.W, VARIANT.minRet);
  const draws = { 1: [], 2: [] };
  if (!opts.noPlacebo) {
    for (let d = 0; d < PLACEBO.draws; d++) {
      const rnd = mulberry32(PLACEBO.seed + d);
      const B = booksOf(D, { mFrom: firstM, mTo: lastM - 1, rate, lastT, order: (list) => shuffle(list, rnd), memo: main.memo });
      for (const t of [1, 2]) draws[t].push(statsOf(rowsOf(B, t, decFrom, lastM)).mean);
    }
  }
  const attr = { 1: new Map(), 2: new Map() };
  for (const t of [1, 2]) rowsOf(main.B, t, decFrom, lastM, 1, attr[t]);
  return { lastM, decFrom, repTo, lastT, main, variant, draws, attr };
}

export function verdictOf(S) {
  const tests = [1, 2].map((t) => {
    const d = S.main[`t${t}`].dec[1], r = S.main[`t${t}`].rep[1], dr = S.draws[t];
    const p95 = dr.length ? pct(dr, BAR.placeboPct) : null;
    return { t, p: d.tNW == null ? 1 : 1 - phi(d.tNW), p95, d, r };
  });
  const hk = holm(tests.map((x) => x.p));
  return tests.map((x, i) => {
    const checks = { decPositive: x.d.mean > 0, repPositive: x.r.mean > 0, tNW: x.d.tNW >= BAR.minT, holm: hk[i], placebo: x.p95 != null && x.d.mean > x.p95 };
    return { test: `T${x.t}`, p: x.p, p95: x.p95, checks, pass: Object.values(checks).every(Boolean) };
  });
}

function legSummary(B, from, to, f) {
  const legs = B.filter((h) => h.book >= from && h.book <= to).flatMap((h) => h[f]);
  const why = {}; for (const lg of legs) why[lg.why] = (why[lg.why] || 0) + 1;
  return { legs: legs.length, why, notEntered: B.filter((h) => h.book >= from && h.book <= to).reduce((a, h) => a + h.missing.length, 0) };
}

// ---- result.json and RESULT.md ----
export function report(S) {
  const V = verdictOf(S), M = S.main;
  const sOut = (s) => ({ months: s.months, mean: r4(s.mean), sd: r4(s.sd), total: r2(s.total), tNW: r2(s.tNW), tPlain: r2(s.tPlain), posShare: r3(s.posShare), maxDD: r2(s.maxDD), sharpe: r2(s.sharpe) });
  const testOut = (T) => ({
    decisive: Object.fromEntries(SCALES.map((c) => [`x${c}`, sOut(T.dec[c])])),
    replication: Object.fromEntries(SCALES.map((c) => [`x${c}`, sOut(T.rep[c])])),
    costPerMonth: { decisive: { spread: r4(T.decRows.reduce((a, r) => a + r.spr, 0) / T.decRows.length), financing: r4(T.decRows.reduce((a, r) => a + r.fin, 0) / T.decRows.length) } },
  });
  const years = {};
  for (const t of [1, 2]) for (const r of [...M[`t${t}`].repRows, ...M[`t${t}`].decRows]) { const y = Math.floor(r.m / 12); (years[y] ||= { year: y, months: 0, t1: 0, t2: 0 }); if (t === 1) years[y].months++; years[y][`t${t}`] += r.net; }
  const attrList = (A) => [...A.entries()].map(([k, v]) => { const [key, side] = k.split('|'); return { key, side, net: r3(v) }; }).sort((a, b) => b.net - a.net);
  const picks = {};
  for (const h of M.B.filter((h) => h.book >= S.decFrom && h.book <= S.lastM)) {
    for (const k of h.low) (picks[k] ||= { low: 0, high: 0 }).low++;
    for (const k of h.high) (picks[k] ||= { low: 0, high: 0 }).high++;
  }
  const decT2 = M.t2.decRows, repT2 = M.t2.repRows;
  const book = (rows, f) => sOut(statsOf(rows, f));
  const sigmas = {}; // median trailing volatility (annualised %) of each market over the decisive formations
  for (const h of M.B.filter((h) => h.book >= S.decFrom && h.book <= S.lastM)) for (const [k, s] of Object.entries(h.sig)) (sigmas[k] ||= []).push(s * Math.sqrt(252) * 100);
  const pass = V.some((v) => v.pass);
  const out = {
    study: 'index-low-vol',
    built: '2026-11-14',
    verdict: pass ? 'PASS' : 'FAIL',
    statement: pass
      ? `the low-volatility anomaly across national indices passes the pre-registered bar (${V.filter((v) => v.pass).map((v) => v.test).join(', ')}).`
      : `0 of 2 tests pass: holding the three least volatile national indices against the three most volatile is not an edge after costs (T1 equal risk long / short ${r3(M.t1.dec[1].mean)}R a month, NW t ${r2(M.t1.dec[1].tNW)}; T2 equal-volatility long books, spread ${r3(M.t2.dec[1].mean)} % a month, NW t ${r2(M.t2.dec[1].tNW)}, decisive 2016-now).`,
    claim: 'Blitz & van Vliet (2007); Frazzini & Pedersen (2014): low-volatility assets, country indices included, earn better risk-adjusted returns than high-volatility ones.',
    related: ['index-long-reversal (branch, FAIL): same universe, cost model and stop, a 36-month return signal', 'vol-managed-index (branch, FAIL): volatility targeting of one index through time, not cross-sectional'],
    params: { ...P, variant: VARIANT, cost: COST, windows: WIN, bar: BAR, placebo: PLACEBO },
    universe: S.universe,
    windows: { decisive: { from: monthLabel(S.decFrom), to: monthLabel(S.lastM) }, replication: { firstTenRanked: monthLabel(M.ften), from: monthLabel(M.repFrom), to: monthLabel(S.repTo) } },
    tests: V.map((v) => ({ test: v.test, pOneSided: r4(v.p), checks: v.checks, pass: v.pass, placeboP95: r4(v.p95) })),
    t1: { ...testOut(M.t1), legs: { decisive: legSummary(M.B, S.decFrom, S.lastM, 't1'), replication: legSummary(M.B, M.repFrom, S.repTo, 't1') } },
    t2: {
      ...testOut(M.t2),
      books: { decisive: { low: book(decT2, 'lowNet'), high: book(decT2, 'highNet') }, replication: { low: book(repT2, 'lowNet'), high: book(repT2, 'highNet') } },
      legs: { decisive: legSummary(M.B, S.decFrom, S.lastM, 't2'), replication: legSummary(M.B, M.repFrom, S.repTo, 't2') },
    },
    perYear: Object.values(years).map((y) => ({ year: y.year, months: y.months, t1: r2(y.t1), t2: r2(y.t2) })),
    drivers: { t1: attrList(S.attr[1]), t2: attrList(S.attr[2]) },
    picks: { decisive: picks },
    medianVolPct: Object.fromEntries(Object.entries(sigmas).map(([k, xs]) => [k, r2(pct(xs, 0.5))]).sort((a, b) => a[1] - b[1])),
    variant: {
      name: '6-month volatility window', firstTenRanked: monthLabel(S.variant.ften), replicationFrom: monthLabel(S.variant.repFrom),
      t1: { decisive: sOut(S.variant.t1.dec[1]), replication: sOut(S.variant.t1.rep[1]) },
      t2: { decisive: sOut(S.variant.t2.dec[1]), replication: sOut(S.variant.t2.rep[1]) },
    },
    placebo: Object.fromEntries([1, 2].map((t) => {
      const dr = S.draws[t], real = M[`t${t}`].dec[1].mean;
      return [`t${t}`, { draws: dr.length, seed: PLACEBO.seed, real: r4(real), median: dr.length ? r4(pct(dr, 0.5)) : null, p5: dr.length ? r4(pct(dr, 0.05)) : null, p95: dr.length ? r4(pct(dr, 0.95)) : null, atOrAbove: dr.filter((x) => x >= real).length }];
    })),
  };
  return { json: out, md: mdOf(out) };
}

function mdOf(o) {
  const yn = (b) => (b ? 'yes' : 'no');
  const row = (name, s) => `| ${name} | ${s.months} | ${s.mean} | ${s.tNW} | ${s.tPlain} | ${s.total} | ${s.maxDD} | ${s.sharpe} | ${Math.round(s.posShare * 100)} % |`;
  const fmt = (x) => `${x.key} ${x.side} ${x.net > 0 ? '+' : ''}${x.net}`;
  const L = [];
  L.push('# Result: the low-volatility anomaly across national stock indices (14 Nov 2026)', '');
  L.push(`**Verdict: ${o.verdict}, ${o.statement}** Pre-registered in [PREREGISTRATION.md](PREREGISTRATION.md) (committed alone and pushed first). Paper research only; nothing live changed.`, '');
  L.push(`Claim: ${o.claim}`, '');
  L.push('Related: `index-long-reversal` (branch, FAIL) used the same 17 index CFDs, the same cost model and the same 3 x ATR(20) stop with a 36-month return signal; its code is copied here, not imported. `vol-managed-index` (branch, FAIL) tested volatility TARGETING of one index through time; this study is cross-sectional (which indices against which).', '');
  L.push(`Data: OANDA mid daily candles of ${o.universe.map((u) => u.key).join(', ')} (council-data research/daily/*.json, weekend stubs folded with \`foldWeekend\`), each in its own quote currency, not converted; price CFDs without dividends. DGS2 from council-data macro/cache.json \`score.fred.DGS2\`, a fixed 4 % before its first value.`, '');
  L.push('Rule: at each month end rank the markets with a fresh close and 13 months of history (150+ daily returns) by the sample sd of their daily log returns over the past 12 months; Low = the 3 lowest, High = the 3 highest; enter at the next open, stop 3 x ATR(20) from the entry (gap fills at the open), out at the close of the next month; rebalance monthly. **T1**: long Low, short High, each leg 1R = the stop distance; book R = mean leg R. **T2**: two long-only books, each leg weighted 1 % / (sigma x sqrt 21) of a notional book (1 % of the book a month per leg), same stop; figure = Low book return - High book return in % of the book. Costs: 0.04 % of price a leg round trip, financing (DGS2 + 2.5 %) / 365 a rollover night on every leg, longs and shorts alike.', '');
  for (const [t, name, unit] of [['t1', 'T1: equal risk, long Low 3 / short High 3', 'R a month'], ['t2', 'T2: equal volatility contribution, long Low 3 book minus long High 3 book', '% of the book a month']]) {
    const T = o[t], d = T.decisive, r = T.replication;
    L.push(`## ${name}`, '');
    L.push(`| Window, cost | Months | Mean (${unit}) | NW t (3 lags) | Plain t | Total | Worst drawdown | Sharpe (a year) | Months up |`, '|---|---|---|---|---|---|---|---|---|');
    L.push(row(`**Decisive ${o.windows.decisive.from} to ${o.windows.decisive.to}, net (1x)**`, d.x1));
    L.push(row('Decisive, gross (0x)', d.x0));
    L.push(row('Decisive, 2x costs', d.x2));
    L.push(row(`**Replication ${o.windows.replication.from} to ${o.windows.replication.to}, net (1x)**`, r.x1));
    L.push(row('Replication, gross (0x)', r.x0));
    L.push(row('Replication, 2x costs', r.x2), '');
    L.push(`Costs a month (base, decisive): spread ${T.costPerMonth.decisive.spread} + financing ${T.costPerMonth.decisive.financing} (${unit.split(' a month')[0]}).`, '');
    if (t === 't2') {
      L.push('Each long book alone (net at 1x, % of the book a month):', '');
      L.push('| Book | Window | Months | Mean | NW t | Total | Worst drawdown | Sharpe (a year) |', '|---|---|---|---|---|---|---|---|');
      for (const [w, wn] of [['decisive', 'decisive'], ['replication', 'replication']]) for (const b of ['low', 'high']) {
        const s = T.books[w][b]; L.push(`| ${b === 'low' ? 'Low 3' : 'High 3'} | ${wn} | ${s.months} | ${s.mean} | ${s.tNW} | ${s.total} | ${s.maxDD} | ${s.sharpe} |`);
      }
      L.push('');
    }
    const lw = (x) => Object.entries(x.why).map(([k, v]) => `${k} ${v}`).join(', ');
    L.push(`Legs: decisive ${T.legs.decisive.legs} (${lw(T.legs.decisive)}); replication ${T.legs.replication.legs} (${lw(T.legs.replication)}).`, '');
  }
  L.push('## Against the bar', '');
  L.push('| Test | Decisive mean > 0 | Replication mean > 0 | Decisive NW t >= 2 | Holm (one-sided p) | Above placebo 95th pct | Pass |', '|---|---|---|---|---|---|---|');
  for (const v of o.tests) {
    const T = o[v.test.toLowerCase()];
    L.push(`| ${v.test} | ${yn(v.checks.decPositive)} (${T.decisive.x1.mean}) | ${yn(v.checks.repPositive)} (${T.replication.x1.mean}) | ${yn(v.checks.tNW)} (${T.decisive.x1.tNW}) | ${yn(v.checks.holm)} (p ${v.pOneSided}) | ${yn(v.checks.placebo)} (${T.decisive.x1.mean} against ${v.placeboP95}) | ${v.pass ? '**yes**' : 'no'} |`);
  }
  L.push('');
  L.push(`## Placebo (random order of the ranked markets each month, same construction and costs; decisive window, ${o.placebo.t1.draws} seeded draws)`, '');
  L.push('| Test | Real mean | Draws median | 5th pct | 95th pct | Draws at or above the real |', '|---|---|---|---|---|---|');
  for (const t of ['t1', 't2']) { const p = o.placebo[t]; L.push(`| ${t.toUpperCase()} | ${p.real} | ${p.median} | ${p.p5} | ${p.p95} | ${p.atOrAbove} of ${p.draws} |`); }
  L.push('');
  L.push('## Variant: 6-month volatility window (reported only, not judged)', '');
  L.push('| Test | Window | Months | Mean net | NW t | Total | Worst drawdown | Sharpe (a year) |', '|---|---|---|---|---|---|---|---|');
  for (const t of ['t1', 't2']) for (const w of ['decisive', 'replication']) {
    const s = o.variant[t][w]; L.push(`| ${t.toUpperCase()} | ${w}${w === 'replication' ? ` from ${o.variant.replicationFrom}` : ''} | ${s.months} | ${s.mean} | ${s.tNW} | ${s.total} | ${s.maxDD} | ${s.sharpe} |`);
  }
  L.push('');
  L.push('## Per year (net at 1x, summed over the year\'s months; T1 in R, T2 in % of the book)', '');
  L.push('| Year | Months | T1 | T2 |', '|---|---|---|---|');
  for (const y of o.perYear) L.push(`| ${y.year} | ${y.months} | ${y.t1} | ${y.t2} |`);
  L.push('');
  L.push('## Which markets drive it (decisive, each leg\'s share of the net result, base costs)', '');
  L.push(`- T1 (R), largest contributions: ${o.drivers.t1.slice(0, 5).map(fmt).join(', ')}; largest drags: ${o.drivers.t1.slice(-5).reverse().map(fmt).join(', ')}.`);
  L.push(`- T2 (% of the book; a "high" leg's sign is flipped, it is the subtracted book), largest contributions: ${o.drivers.t2.slice(0, 5).map(fmt).join(', ')}; largest drags: ${o.drivers.t2.slice(-5).reverse().map(fmt).join(', ')}.`);
  const pk = Object.entries(o.picks.decisive).sort((a, b) => (b[1].low + b[1].high) - (a[1].low + a[1].high)).map(([k, v]) => `${k} ${v.low} Low / ${v.high} High`).join('; ');
  L.push(`- Months in each book (decisive, ${o.t1.decisive.x1.months} months): ${pk}.`);
  L.push(`- Median trailing 12-month volatility, annualised % (decisive formations): ${Object.entries(o.medianVolPct).map(([k, v]) => `${k} ${v}`).join(', ')}.`, '');
  L.push('## What it means, and what it does not', '');
  L.push(o.verdict === 'PASS'
    ? '- At least one test cleared every pre-registered check. A pass would only lead to a written proposal for a paper shadow; it is not a council rule.'
    : '- Neither test clears the pre-registered bar: on these 17 index CFDs, from 2016, holding the least volatile indices against the most volatile ones is not an edge after costs, whether each leg risks the same (T1) or contributes the same volatility (T2). Never call it one; not a council rule, no proposal written, nothing live changed.');
  L.push('- The ranking is very stable: the same markets sit in the same book for years (see the months in each book above), so the result rests on a few national stories rather than on 130 independent bets, and the monthly t overstates the evidence in either direction.');
  L.push('- The universe overlaps (US30 / SPX500 / NAS100 / US2000; EU50 / DE40 / FR40 / NL25 / ES35): a Low or High book can hold two or three versions of one market, so there are fewer independent countries than 17.');
  L.push('- Price CFDs without dividends and in local currency: low-volatility markets with high dividend yields (CH20, UK100, AU200) are understated against low-yield ones, and currency moves are left in each leg. The papers used dollar total returns (and, for Frazzini and Pedersen, beta rather than total volatility, with leverage on the low-beta side); this is the claim as a CFD trader could run it, not a replication of their data.');
  L.push('- T1 already gives each leg the same risk, so it is a test of return per unit of risk across the two groups, long / short; T2 holds both groups long at the same volatility, so its spread is the same question without shorting. At equal volatility the Low book holds more notional than the High book (about 1.6 times, by the median volatilities above), so it pays more financing: part of T2\'s cost gap is that, not the anomaly. Financing is charged on shorts too in T1 (conservative); the gross rows show each result with no cost at all. Every leg has a stop at 3 x ATR(20): the papers held without stops.');
  if (o.verdict !== 'PASS') {
    L.push(`- Post hoc reading, not a test: before costs T1 is close to zero in the decisive window (${o.t1.decisive.x0.mean}R a month, t ${o.t1.decisive.x0.tNW}) and negative in the replication window (${o.t1.replication.x0.mean}R, t ${o.t1.replication.x0.tNW}); the net loss is mostly the cost of holding six legs a month. In T2 the High book did better than the Low book in both windows (decisive ${o.t2.books.decisive.high.mean} against ${o.t2.books.decisive.low.mean} % a month; replication ${o.t2.books.replication.high.mean} against ${o.t2.books.replication.low.mean}). No sign of the anomaly on these markets in either window.`);
  }
  L.push('');
  L.push('To repeat: `node research/edge/index-low-vol/run.mjs fetch <dir>` (git show from origin/council-data, no network; candles kept out of git), then `node research/edge/index-low-vol/run.mjs full <dir>`. Tests: `tests/index-low-vol.test.mjs`.');
  return L.join('\n') + '\n';
}

// ---- command line ----
export function load(dir) {
  const D = {}, universe = [];
  for (const key of KEYS) {
    const f = path.join(dir, key + '.json');
    if (!fs.existsSync(f)) continue;
    const file = JSON.parse(fs.readFileSync(f, 'utf8'));
    const bars = barsOf(file);
    if (bars.length < 100) continue;
    D[key] = { bars, ends: monthEnds(bars) };
    universe.push({ key, inst: file.inst, first: new Date(bars[0].time * 1000).toISOString().slice(0, 10), last: new Date(bars[bars.length - 1].time * 1000).toISOString().slice(0, 10), days: bars.length });
  }
  const cache = JSON.parse(fs.readFileSync(path.join(dir, 'cache.json'), 'utf8'));
  return { D, universe, dgs: cache?.score?.fred?.DGS2 || [] };
}

async function main() {
  const [mode, dir] = process.argv.slice(2);
  if (mode === 'fetch' && dir) {
    fs.mkdirSync(dir, { recursive: true });
    for (const k of KEYS) fs.writeFileSync(path.join(dir, k + '.json'), execFileSync('git', ['show', `origin/council-data:research/daily/${k}.json`], { maxBuffer: 1 << 28 }));
    fs.writeFileSync(path.join(dir, 'cache.json'), execFileSync('git', ['show', 'origin/council-data:macro/cache.json'], { maxBuffer: 1 << 28 }));
    console.log('fetched into', dir); return;
  }
  if (mode !== 'full' || !dir) { console.log('usage: run.mjs fetch <dir> | full <dir>'); return; }
  const { D, universe, dgs } = load(dir);
  const S = study(D, dgs); S.universe = universe;
  const { json, md } = report(S);
  fs.writeFileSync(path.join(HERE, 'result.json'), JSON.stringify(json, null, 1) + '\n');
  fs.writeFileSync(path.join(HERE, 'RESULT.md'), md);
  console.log(md);
}
if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) main();
