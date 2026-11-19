// Edge research · local-preholiday: the pre-holiday effect on nine non-US index CFDs, each on its own exchange's holidays
// (PREREGISTRATION.md, pushed before any return was computed). Long from the close of the local trading day before P to the
// close of P (P = the last local trading day before a weekday closure), stop 2 x ATR(20), 0.04 % round trip + 6 % a year
// financing per calendar night. Pre-holiday days against all other local trading days, Welch t per market and pooled per date
// (equal weight), Holm over ten, IS to 2016, OOS 2017 on, a 40-seed placebo.
//   node research/edge/local-preholiday/run.mjs            (reads council-data with git show; writes result.json beside this file)
import fs from 'node:fs';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { isTradingDay, isClosed, addDays } from './holidays.mjs';

export const MARKETS = {
  de40: { name: 'DAX (DE40)', ex: 'xetra' },
  eu50: { name: 'Euro Stoxx 50 (EU50)', ex: 'xetra' },
  fr40: { name: 'CAC 40 (FR40)', ex: 'euronext' },
  nl25: { name: 'AEX (NL25)', ex: 'euronext' },
  uk100: { name: 'FTSE 100 (UK100)', ex: 'lse' },
  ch20: { name: 'SMI (CH20)', ex: 'six' },
  jp225: { name: 'Nikkei 225 (JP225)', ex: 'jpx' },
  au200: { name: 'ASX 200 (AU200)', ex: 'asx' },
  hk33: { name: 'Hang Seng (HK33)', ex: 'hkex' },
};
export const COST = 0.0004, FIN_YEAR = 0.06, ATR_N = 20, STOP_ATR = 2, SEEDS = 40, SEEDS_NEED = 38, OOS_FROM = '2017-01-01';
const dOf = (t) => new Date(t * 1000).toISOString().slice(0, 10);
const yr = (d) => +d.slice(0, 4);

// candles by UTC date; local trading days from the first to the last candle date
export function buildDays(rows, ex) {
  const byDate = new Map(rows.map((r) => [dOf(r[0]), r]));
  const dates = [...byDate.keys()].sort();
  const all = [];
  for (let d = dates[0]; d <= dates[dates.length - 1]; d = addDays(d, 1)) all.push(d);
  const D = [];
  let prev = null;
  for (const d of all) {
    if (!isTradingDay(ex, d)) continue;
    const c = byDate.get(d);
    let hi = -Infinity, lo = Infinity;
    for (let x = prev ? addDays(prev, 1) : d; x <= d; x = addDays(x, 1)) { const r = byDate.get(x); if (r) { hi = Math.max(hi, r[2]); lo = Math.min(lo, r[3]); } }
    D.push({ d, close: c ? c[4] : null, hi, lo });
    prev = d;
  }
  return { D, byDate };
}
// pre-holiday days P: the last local trading day before each weekday closure (one P for two closures)
export function preDays(D, ex) {
  const P = new Map();
  for (let k = 0; k + 1 < D.length; k++) {
    for (let x = addDays(D[k].d, 1); x < D[k + 1].d; x = addDays(x, 1)) if (isClosed(ex, x)) { if (!P.has(D[k].d)) P.set(D[k].d, x); }
  }
  return P;
}
// ATR of the 20 local trading days ending with index e (true range against the previous local trading day's close)
export function atrAt(D, e, n = ATR_N, skipMissing = false) {
  if (skipMissing) {  // sensitivity only (not pre-registered): the last n local trading days that have a candle and a previous close
    let s = 0, c = 0;
    for (let j = e; j >= 1 && c < n; j--) { const a = D[j], p = D[j - 1]; if (a.close == null || p.close == null || !Number.isFinite(a.hi)) continue; s += Math.max(a.hi - a.lo, Math.abs(a.hi - p.close), Math.abs(a.lo - p.close)); c++; }
    return c === n ? s / n : null;
  }
  if (e - n + 1 < 1) return null;
  let s = 0;
  for (let j = e - n + 1; j <= e; j++) {
    const a = D[j], p = D[j - 1];
    if (a.close == null || p.close == null || !Number.isFinite(a.hi)) return null;
    s += Math.max(a.hi - a.lo, Math.abs(a.hi - p.close), Math.abs(a.lo - p.close));
  }
  return s / n;
}
export const nights = (a, b) => Math.round((Date.parse(b + 'T12:00:00Z') - Date.parse(a + 'T12:00:00Z')) / 86400e3);
// one long trade: entry at D[k-1]'s close, exit at D[k]'s close; stop on every candle after the entry candle up to the exit candle
export function trade(D, byDate, k, atrSkip = false) {
  const E = D[k - 1], X = D[k];
  if (!E || !X || E.close == null || X.close == null) return null;
  const atr = atrAt(D, k - 1, ATR_N, atrSkip);
  if (!(atr > 0)) return null;
  const entry = E.close, risk = STOP_ATR * atr, stop = entry - risk;
  let exit = X.close, how = 'time';
  for (let x = addDays(E.d, 1); x <= X.d; x = addDays(x, 1)) {
    const r = byDate.get(x); if (!r) continue;
    if (r[1] <= stop) { exit = r[1]; how = 'stop-gap'; break; }
    if (r[3] <= stop) { exit = stop; how = 'stop'; break; }
  }
  const nt = nights(E.d, X.d), fin = FIN_YEAR / 365 * nt;
  const grossR = (exit - entry) / risk;
  return { d: X.d, entryD: E.d, entry, stop, exit, how, nights: nt, grossR,
    R: grossR - (COST + fin) * entry / risk, R2: grossR - 2 * (COST + fin) * entry / risk };
}

export function stats(xs) {
  const n = xs.length; if (!n) return { n: 0, mean: null, sd: null, t: null };
  const mean = xs.reduce((a, b) => a + b, 0) / n, sd = n > 1 ? Math.sqrt(xs.reduce((a, b) => a + (b - mean) ** 2, 0) / (n - 1)) : 0;
  return { n, mean, sd, t: sd > 0 ? mean / (sd / Math.sqrt(n)) : null };
}
export function welch(a, b) {
  const A = stats(a), B = stats(b);
  if (A.n < 2 || B.n < 2) return { diff: null, t: null };
  return { diff: A.mean - B.mean, t: (A.mean - B.mean) / Math.sqrt(A.sd ** 2 / A.n + B.sd ** 2 / B.n) };
}
const erf = (x) => { const s = Math.sign(x); x = Math.abs(x); const t = 1 / (1 + 0.3275911 * x); return s * (1 - ((((1.061405429 * t - 1.453152027) * t + 1.421413741) * t - 0.284496736) * t + 0.254829592) * t * Math.exp(-x * x)); };
export const pOneSided = (t) => (t == null ? 1 : 0.5 * (1 - erf(t / Math.SQRT2)));
export function holm(ps) {
  const idx = ps.map((p, i) => [p, i]).sort((a, b) => a[0] - b[0]);
  const out = new Array(ps.length); let run = 0;
  idx.forEach(([p, i], r) => { run = Math.max(run, Math.min(1, (ps.length - r) * p)); out[i] = run; });
  return out;
}
export function mulberry32(a) { return () => { a |= 0; a = (a + 0x6D2B79F5) | 0; let t = Math.imul(a ^ (a >>> 15), 1 | a); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; }
// per-date equal-weight means of a list of { d, v }
export function perDate(items) {
  const m = new Map();
  for (const { d, v } of items) { if (!m.has(d)) m.set(d, []); m.get(d).push(v); }
  return [...m.entries()].sort((a, b) => (a[0] < b[0] ? -1 : 1)).map(([d, vs]) => ({ d, v: vs.reduce((a, b) => a + b, 0) / vs.length }));
}
const inIS = (d) => d < OOS_FROM, inOOS = (d) => d >= OOS_FROM;
const r4 = (x) => (x == null || !Number.isFinite(x) ? null : Math.round(x * 1e4) / 1e4);
const r2 = (x) => (x == null || !Number.isFinite(x) ? null : Math.round(x * 100) / 100);

function windowStats(pre, other, inW) {
  const p = pre.filter((x) => inW(x.d)), o = other.filter((x) => inW(x.d));
  const g = (a, k) => a.map((x) => x[k]);
  const sP = stats(g(p, 'R')), sPg = stats(g(p, 'grossR')), sP2 = stats(g(p, 'R2')), sO = stats(g(o, 'R')), sOg = stats(g(o, 'grossR'));
  const w = welch(g(p, 'R'), g(o, 'R')), wg = welch(g(p, 'grossR'), g(o, 'grossR'));
  return { n: sP.n, nOther: sO.n, gross: r4(sPg.mean), tGross: r2(sPg.t), net: r4(sP.mean), tNet: r2(sP.t), net2x: r4(sP2.mean),
    otherGross: r4(sOg.mean), otherNet: r4(sO.mean), diffNet: r4(w.diff), welchNet: r2(w.t), diffGross: r4(wg.diff), welchGross: r2(wg.t),
    won: sP.n ? r4(p.filter((x) => x.R > 0).length / sP.n) : null, stopped: p.filter((x) => x.how !== 'time').length, first: p[0]?.d || null, last: p[p.length - 1]?.d || null };
}

export function run(loadRows, { atrSkip = false, placebo: doPlacebo = true } = {}) {
  const per = {}, allPre = [], allOther = [], byMkt = {};
  for (const [k, M] of Object.entries(MARKETS)) {
    const rows = loadRows(k);
    const { D, byDate } = buildDays(rows, M.ex);
    const P = preDays(D, M.ex);
    const pre = [], other = []; let skipped = 0, skippedPre = 0;
    for (let i = 1; i < D.length; i++) {
      const isP = P.has(D[i].d);
      const t = trade(D, byDate, i, atrSkip);
      if (!t) { if (i > ATR_N) { skipped++; if (isP) skippedPre++; } continue; }
      t.hol = isP ? P.get(D[i].d) : null;
      (isP ? pre : other).push(t);
    }
    byMkt[k] = { pre, other };
    per[k] = { name: M.name, exchange: M.ex, from: D[0].d, to: D[D.length - 1].d, preDays: P.size, skipped, skippedPre,
      IS: windowStats(pre, other, inIS), OOS: windowStats(pre, other, inOOS) };
    pre.forEach((x) => allPre.push({ d: x.d, x, k })); other.forEach((x) => allOther.push({ d: x.d, x, k }));
  }
  const pooledOf = (inW, key) => {
    const pr = perDate(allPre.filter((o) => inW(o.d)).map((o) => ({ d: o.d, v: o.x[key] })));
    const ot = perDate(allOther.filter((o) => inW(o.d)).map((o) => ({ d: o.d, v: o.x[key] })));
    const w = welch(pr.map((o) => o.v), ot.map((o) => o.v)), s = stats(pr.map((o) => o.v)), so = stats(ot.map((o) => o.v));
    return { dates: s.n, datesOther: so.n, mean: r4(s.mean), t: r2(s.t), otherMean: r4(so.mean), diff: r4(w.diff), welch: r2(w.t), _mean: s.mean };
  };
  const pooled = {};
  for (const [wName, inW] of [['IS', inIS], ['OOS', inOOS]]) {
    const net = pooledOf(inW, 'R'), gross = pooledOf(inW, 'grossR'), x2 = pooledOf(inW, 'R2');
    pooled[wName] = { dates: net.dates, datesOther: net.datesOther, net: net.mean, tNet: net.t, otherNet: net.otherMean, diffNet: net.diff, welchNet: net.welch,
      gross: gross.mean, tGross: gross.t, otherGross: gross.otherMean, diffGross: gross.diff, welchGross: gross.welch, net2x: x2.mean, welch2x: x2.welch };
  }
  const ruleStat = pooledOf(inOOS, 'R')._mean;
  // placebo: per seed, market and year, as many other days (without replacement) as P trades that year
  const placebo = [];
  for (let s = 1; doPlacebo && s <= SEEDS; s++) {
    const rnd = mulberry32(s), drawn = [];
    for (const k of Object.keys(MARKETS)) {
      const { pre, other } = byMkt[k], need = new Map(), pool = new Map();
      pre.forEach((x) => need.set(yr(x.d), (need.get(yr(x.d)) || 0) + 1));
      other.forEach((x) => { if (!pool.has(yr(x.d))) pool.set(yr(x.d), []); pool.get(yr(x.d)).push(x); });
      for (const [y, n] of [...need.entries()].sort((a, b) => a[0] - b[0])) {
        const arr = (pool.get(y) || []).slice();
        for (let i = 0; i < n && arr.length; i++) { const j = Math.floor(rnd() * arr.length); drawn.push({ d: arr[j].d, v: arr[j].R }); arr.splice(j, 1); }
      }
    }
    placebo.push(stats(perDate(drawn.filter((o) => inOOS(o.d))).map((o) => o.v)).mean);
  }
  const above = placebo.filter((p) => ruleStat > p).length;
  const sortedP = placebo.slice().sort((a, b) => a - b);
  // Holm over the ten out-of-sample tests (nine markets + pooled), one-sided p of the net Welch t
  const keys = [...Object.keys(MARKETS), 'pooled'];
  const ts = keys.map((k) => (k === 'pooled' ? pooled.OOS.welchNet : per[k].OOS.welchNet));
  const ps = ts.map(pOneSided), hp = holm(ps);
  keys.forEach((k, i) => { const o = k === 'pooled' ? pooled.OOS : per[k].OOS; o.p = r4(ps[i]); o.holmP = r4(hp[i]); });
  const checks = {
    c1: { what: 'pooled OOS Welch t >= 2 with Holm p < 0.05', t: pooled.OOS.welchNet, holmP: pooled.OOS.holmP, met: pooled.OOS.welchNet >= 2 && pooled.OOS.holmP < 0.05 },
    c2: { what: 'pooled IS difference > 0', diff: pooled.IS.diffNet, welch: pooled.IS.welchNet, met: pooled.IS.diffNet > 0 },
    c3: { what: 'pooled OOS pre mean net R > 0 at 2x costs', net2x: pooled.OOS.net2x, met: pooled.OOS.net2x > 0 },
    c4: { what: 'above the placebo in >= 38 of 40 seeds', above, of: SEEDS, placeboMedian: r4((sortedP[19] + sortedP[20]) / 2), ruleStat: r4(ruleStat), met: above >= SEEDS_NEED },
  };
  const verdict = Object.values(checks).every((c) => c.met) ? 'PASS' : 'FAIL';
  const claims = Object.keys(MARKETS).filter((k) => per[k].OOS.holmP < 0.05 && per[k].OOS.welchNet >= 2);
  // descriptive: pooled OOS net R by holiday name is not computed (no names); by market only
  return { study: 'local-preholiday', built: '2026-11-14', verdict, checks, claims,
    rule: { cost: COST, financingYear: FIN_YEAR, atrN: ATR_N, stopAtr: STOP_ATR, oosFrom: OOS_FROM, seeds: SEEDS },
    data: 'council-data research/daily/<key>.json (OANDA mid UTC daily candles), git show origin/council-data',
    pooled, markets: per, placebo: { seeds: placebo.map(r4), above, of: SEEDS } };
}

const here = path.dirname(fileURLToPath(import.meta.url));
if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const load = (k) => JSON.parse(execFileSync('git', ['show', `origin/council-data:research/daily/${k}.json`], { maxBuffer: 1 << 28 }).toString()).rows;
  const res = run(load);
  // sensitivity, reported only (not pre-registered, not judged): the ATR read over the last 20 days that HAVE a candle, so a
  // missing candle (hk33's dropped lunar holidays, jp225's Good Friday and Christmas) does not void the next 20 trades
  const sens = run(load, { atrSkip: true, placebo: false });
  res.sensitivity = { what: 'ATR over the last 20 local trading days with a candle (reported only, not pre-registered, not judged)',
    pooled: sens.pooled, markets: Object.fromEntries(Object.entries(sens.markets).map(([k, m]) => [k, { skipped: m.skipped, IS: { n: m.IS.n, net: m.IS.net, welchNet: m.IS.welchNet }, OOS: { n: m.OOS.n, net: m.OOS.net, welchNet: m.OOS.welchNet } }])) };
  fs.writeFileSync(path.join(here, 'result.json'), JSON.stringify(res, null, 1) + '\n');
  console.log(res.verdict, JSON.stringify(res.checks));
  console.log('pooled', JSON.stringify(res.pooled));
  for (const [k, m] of Object.entries(res.markets)) console.log(k, m.preDays, m.skipped, m.skippedPre, 'IS', JSON.stringify(m.IS), '\nOOS', JSON.stringify(m.OOS));
}
