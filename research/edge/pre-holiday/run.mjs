// Edge research · pre-holiday: the published pre-holiday effect on SPX500, NAS100 and US30 (PREREGISTRATION.md).
// Buy at the New York close of the trading day before the last trading day ahead of an NYSE holiday, sell at that day's close
// (one session); stop 2 x ATR(20) below the entry; costs and financing as stated; results in R. Tests on 2016-now: pooled net
// R t >= 2 (one observation per holiday), n >= 80 a market, the same sign on 2008-15, pre-holiday days against ordinary days
// (Welch), a 40-seed placebo of ordinary days; per-market claims with Holm over the three markets.
// Calendar, close and ATR conventions are those of the turn-of-month study (same day), copied here.
//   node research/edge/pre-holiday/run.mjs <candleDir>     (the files fetch.mjs wrote; writes result.json beside this file)
import fs from 'node:fs';
import path from 'node:path';
import zlib from 'node:zlib';
import { nyParts, cmeYear } from '../../../ict/calendar.mjs';

export const MARKETS = { spx500: { name: 'S&P 500 (SPX500)', cost: 0.0004 }, nas100: { name: 'Nasdaq 100 (NAS100)', cost: 0.0005 }, us30: { name: 'Dow 30 (US30)', cost: 0.0005 } };
export const FIN_ADD = 2.5;            // percent a year over the 2-year yield
export const ATR_N = 20, STOP_ATR = 2, SEEDS = 40, SEEDS_NEED = 38, MIN_N = 80;
export const SPLIT = 2016, FIRST = 2008;
// unscheduled NYSE closures: not trading days, but no trade is taken before them (nobody knew a day ahead)
export const SPECIAL = new Set(['2012-10-29', '2012-10-30', '2018-12-05', '2025-01-09']);
const NYSE_FROM_EARLY = new Set(['Martin Luther King Day', "Presidents' Day", 'Memorial Day', 'Juneteenth', 'Independence Day', 'Labor Day', 'Thanksgiving Day']);
const HALF = new Set(['Independence Day eve', 'Day after Thanksgiving', 'Christmas Eve']);

const ymdOf = (ms) => new Date(ms).toISOString().slice(0, 10);
const yr = (d) => +d.slice(0, 4);
// 'weekend' | 'special' | 'holiday' (scheduled NYSE full holiday) | 'half' | 'open'
export function dayKind(ymd) {
  const wd = new Date(ymd + 'T12:00:00Z').getUTCDay();
  if (wd === 0 || wd === 6) return 'weekend';
  if (SPECIAL.has(ymd)) return 'special';
  const Y = cmeYear(yr(ymd));
  if (Y.full.has(ymd)) return 'holiday';
  const e = Y.early.get(ymd);
  if (e && NYSE_FROM_EARLY.has(e.name)) return 'holiday';
  if (e && HALF.has(e.name)) return 'half';
  return 'open';
}
export const isTradingDay = (ymd) => { const k = dayKind(ymd); return k === 'open' || k === 'half'; };
export const isHoliday = (ymd) => dayKind(ymd) === 'holiday';
const eachDay = (from, to, f) => { for (let t = Date.parse(from + 'T12:00:00Z'); ymdOf(t) <= to; t += 86400e3) f(ymdOf(t)); };
export function tradingDays(from, to) { const out = []; eachDay(from, to, (d) => { if (isTradingDay(d)) out.push(d); }); return out; }
export function holidays(from, to) { const out = []; eachDay(from, to, (d) => { if (isHoliday(d)) out.push(d); }); return out; }
// pre-holiday days P (the last trading day before each scheduled holiday) and post-holiday days (the first one after)
export function holidayMarks(days) {
  const pre = new Map(), post = new Set();
  for (let k = 0; k + 1 < days.length; k++) {
    const a = days[k], b = days[k + 1];
    let hol = null;
    eachDay(ymdOf(Date.parse(a + 'T12:00:00Z') + 86400e3), ymdOf(Date.parse(b + 'T12:00:00Z') - 86400e3), (d) => { if (!hol && isHoliday(d)) hol = d; });
    if (hol) { pre.set(a, hol); post.add(b); }
  }
  return { pre, post };
}
// the unix start of the H1 candle that ends at the day's close (16:00 New York, 13:00 on a half day)
export function closeCandle(ymd) {
  const hr = dayKind(ymd) === 'half' ? 12 : 15;
  const [y, m, d] = ymd.split('-').map(Number);
  for (const off of [4, 5]) { const t = Date.UTC(y, m - 1, d, hr + off) / 1000; const p = nyParts(t); if (p.ymd === ymd && p.min === hr * 60) return t; }
  throw new Error('no close candle for ' + ymd);
}
// the New York days from H1 candles: close, and high / low of the candles after the previous close up to this close
export function buildDays(bars, days) {
  const at = new Map(bars.map((b, i) => [b[0], i]));
  const out = [];
  let prevEnd = null;
  for (const d of days) {
    const t = closeCandle(d), i = at.get(t);
    if (i == null) { out.push({ d, t, close: null }); prevEnd = null; continue; }
    let hi = -Infinity, lo = Infinity, j = i;
    for (; j >= 0 && (prevEnd == null ? j >= i - 23 : bars[j][0] > prevEnd); j--) { hi = Math.max(hi, bars[j][2]); lo = Math.min(lo, bars[j][3]); }
    out.push({ d, t, i, close: bars[i][4], hi, lo });
    prevEnd = t;
  }
  return out;
}
// ATR(n) of the n completed days before index k (true range against the previous close); null without n clean days
export function atrAt(D, k, n = ATR_N) {
  if (k - n < 1) return null;
  let s = 0;
  for (let j = k - n; j < k; j++) {
    const a = D[j], p = D[j - 1];
    if (a.close == null || p.close == null) return null;
    s += Math.max(a.hi - a.lo, Math.abs(a.hi - p.close), Math.abs(a.lo - p.close));
  }
  return s / n;
}
export function rateOf(dgs2) {
  return (ymd) => { let v = null; for (const [d, x] of dgs2) { if (d > ymd) break; v = x; } return v; };
}
export const nights = (a, b) => Math.round((Date.parse(b + 'T12:00:00Z') - Date.parse(a + 'T12:00:00Z')) / 86400e3);

// one long trade from day index e (entry close) to day index x (exit close); stop checked on every H1 candle in between
export function trade(bars, D, e, x, { cost, rate }) {
  const E = D[e], X = D[x];
  if (!E || !X || E.close == null || X.close == null) return null;
  const atr = atrAt(D, e);
  if (atr == null || !(atr > 0)) return null;
  const entry = E.close, risk = STOP_ATR * atr, stop = entry - risk;
  let exit = X.close, exitD = X.d, how = 'time';
  for (let j = E.i + 1; j <= X.i; j++) {
    const b = bars[j];
    if (b[1] <= stop) { exit = b[1]; how = 'stop-gap'; break; }
    if (b[3] <= stop) { exit = stop; how = 'stop'; break; }
  }
  const r = rate(E.d), finShare = ((r == null ? 0 : Math.max(0, r)) + FIN_ADD) / 100 / 365 * nights(E.d, exitD);
  const gross = (exit - entry) / entry;
  return { entryD: E.d, exitD, entry, stop, exit, how, nights: nights(E.d, exitD),
    gross: gross * 100, net: (gross - cost - finShare) * 100, fin: finShare * 100,
    grossR: (exit - entry) / risk, R: (exit - entry - (cost + finShare) * entry) / risk };
}

export function stats(xs) {
  const n = xs.length; if (!n) return { n: 0, mean: null, sd: null, t: null };
  const mean = xs.reduce((a, b) => a + b, 0) / n, sd = n > 1 ? Math.sqrt(xs.reduce((a, b) => a + (b - mean) ** 2, 0) / (n - 1)) : 0;
  return { n, mean, sd, t: sd > 0 ? mean / (sd / Math.sqrt(n)) : null };
}
export function welch(a, b) {
  const A = stats(a), B = stats(b);
  return { diff: A.mean - B.mean, t: (A.mean - B.mean) / Math.sqrt(A.sd ** 2 / A.n + B.sd ** 2 / B.n) };
}
const erf = (x) => { const s = Math.sign(x); x = Math.abs(x); const t = 1 / (1 + 0.3275911 * x); return s * (1 - ((((1.061405429 * t - 1.453152027) * t + 1.421413741) * t - 0.284496736) * t + 0.254829592) * t * Math.exp(-x * x)); };
export const pOneSided = (t) => t == null ? 1 : 0.5 * (1 - erf(t / Math.SQRT2));
export function holm(ps) {
  const order = ps.map((p, i) => [p, i]).sort((a, b) => a[0] - b[0]), adj = new Array(ps.length);
  let run = 0;
  order.forEach(([p, i], k) => { run = Math.max(run, Math.min(1, p * (ps.length - k))); adj[i] = run; });
  return adj;
}
export function rng(seed) { let a = seed >>> 0; return () => { a = (a + 0x6D2B79F5) >>> 0; let t = a; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; }
const meanOf = (xs) => xs.reduce((a, b) => a + b, 0) / xs.length;
const r3 = (x) => x == null ? null : +x.toFixed(3), r2 = (x) => x == null ? null : +x.toFixed(2);

// Everything for a set of markets on one shared trading-day list. M: { key: bars }
export function study(M, dgs2) {
  const keys = Object.keys(M);
  const first = keys.map((k) => nyParts(M[k][0][0]).ymd).sort().at(-1), last = keys.map((k) => nyParts(M[k].at(-1)[0]).ymd).sort()[0];
  const days = tradingDays(first, last), { pre, post } = holidayMarks(days), rate = rateOf(dgs2);
  const D = Object.fromEntries(keys.map((k) => [k, buildDays(M[k], days)]));
  const opt = (k) => ({ cost: MARKETS[k].cost, rate });
  const tradeAt = (k, x) => trade(M[k], D[k], x - 1, x, opt(k));
  // the rule
  const per = Object.fromEntries(keys.map((k) => [k, { trades: [], skipped: [] }]));
  const pooled = [];
  days.forEach((d, x) => {
    if (!pre.has(d) || x < 1 || yr(d) < FIRST) return;
    const rs = [];
    for (const k of keys) { const t = tradeAt(k, x); if (t) { t.holiday = pre.get(d); per[k].trades.push(t); rs.push(t.R); } else per[k].skipped.push(d); }
    if (rs.length) pooled.push({ d, holiday: pre.get(d), R: meanOf(rs), n: rs.length });
  });
  const isW = (d) => yr(d) >= FIRST && yr(d) < SPLIT, oosW = (d) => yr(d) >= SPLIT;
  const sumR = (xs) => { const s = stats(xs); return { n: s.n, mean: r3(s.mean), t: r2(s.t) }; };
  const pooledIS = sumR(pooled.filter((p) => isW(p.d)).map((p) => p.R)), pooledOOS = sumR(pooled.filter((p) => oosW(p.d)).map((p) => p.R));
  const summ = (ts) => { const s = stats(ts.map((t) => t.R)), g = stats(ts.map((t) => t.grossR)), pc = stats(ts.map((t) => t.net)), pg = stats(ts.map((t) => t.gross));
    return { n: s.n, R: r3(s.mean), t: r2(s.t), grossR: r3(g.mean), tGross: r2(g.t), netPct: r3(pc.mean), grossPct: r3(pg.mean), win: s.n ? r2(100 * ts.filter((t) => t.R > 0).length / s.n) : null, stops: ts.filter((t) => t.how !== 'time').length, totalR: r2(ts.reduce((a, t) => a + t.R, 0)) }; };
  const markets = {};
  for (const k of keys) {
    const ts = per[k].trades, OOS = ts.filter((t) => oosW(t.exitD));
    markets[k] = { name: MARKETS[k].name, cost: MARKETS[k].cost, candles: M[k].length, is: summ(ts.filter((t) => isW(t.exitD))), oos: summ(OOS),
      skipped: per[k].skipped, pOne: pOneSided(stats(OOS.map((t) => t.R)).t),
      trades: ts.map((t) => [t.holiday, t.entryD, t.exitD, t.how, t.nights, r3(t.gross), r3(t.net), r3(t.R)]) };
  }
  // T4: pooled daily % returns, pre-holiday days against ordinary days
  const ordinary = (d) => !pre.has(d) && !post.has(d);
  const dayRet = (x) => { const v = []; for (const k of keys) { const a = D[k][x], p = D[k][x - 1]; if (a.close != null && p && p.close != null) v.push(100 * (a.close / p.close - 1)); } return v.length ? meanOf(v) : null; };
  const daily = (inW) => { const P = [], O = []; days.forEach((d, x) => { if (x < 1 || !inW(d)) return; const r = dayRet(x); if (r == null) return; if (pre.has(d)) P.push(r); else if (ordinary(d)) O.push(r); }); const w = welch(P, O); return { preN: P.length, preMean: r3(stats(P).mean), ordN: O.length, ordMean: r3(stats(O).mean), diff: r3(w.diff), t: r2(w.t) }; };
  // T5: placebo of ordinary days, the same counts per year as the rule's pooled observations
  const counts = new Map(); for (const p of pooled) if (oosW(p.d)) counts.set(yr(p.d), (counts.get(yr(p.d)) || 0) + 1);
  const byYear = new Map(); days.forEach((d, x) => { if (x >= 1 && ordinary(d)) { if (!byYear.has(yr(d))) byYear.set(yr(d), []); byYear.get(yr(d)).push(x); } });
  const ruleMean = pooledOOS.mean, seeds = [];
  for (let s = 1; s <= SEEDS; s++) {
    const R = rng(s), obs = [];
    for (const [y, n] of counts) {
      const K = byYear.get(y) || []; let got = 0, tries = 0;
      while (got < n && tries < n * 50) { tries++; const x = K[Math.floor(R() * K.length)]; const rs = keys.map((k) => tradeAt(k, x)).filter(Boolean).map((t) => t.R); if (rs.length) { obs.push(meanOf(rs)); got++; } }
    }
    seeds.push(r3(meanOf(obs)));
  }
  const beaten = seeds.filter((m) => pooledOOS.mean != null && meanOf(pooled.filter((p) => oosW(p.d)).map((p) => p.R)) > m).length;
  const placebo = { seeds, ruleMean, beaten, need: SEEDS_NEED, median: r3([...seeds].sort((a, b) => a - b)[SEEDS / 2]) };
  const byHoliday = {};
  for (const p of pooled.filter((q) => oosW(q.d))) { const h = holidayName(p.holiday); (byHoliday[h] ||= []).push(p.R); }
  const byYr = {};
  for (const p of pooled) (byYr[yr(p.d)] ||= []).push(p.R);
  return { from: first, to: last, holidays: pre.size, pooled: { is: pooledIS, oos: pooledOOS, rows: pooled.map((p) => [p.d, p.holiday, r3(p.R), p.n]) },
    byHoliday: Object.fromEntries(Object.entries(byHoliday).map(([h, xs]) => [h, sumR(xs)])),
    byYear: Object.fromEntries(Object.entries(byYr).map(([y, xs]) => [y, sumR(xs)])),
    daysIS: daily(isW), daysOOS: daily(oosW), placebo, markets };
}
export function holidayName(ymd) {
  const Y = cmeYear(yr(ymd));
  return Y.full.get(ymd) || (Y.early.get(ymd) || {}).name || '?';
}

export function verdictOf(S) {
  const keys = Object.keys(S.markets), adj = holm(keys.map((k) => S.markets[k].pOne));
  const perMarket = {};
  keys.forEach((k, i) => { const o = S.markets[k].oos; perMarket[k] = { holmP: +adj[i].toFixed(4), claim: o.R > 0 && o.t >= 2 && adj[i] < 0.05 }; });
  const checks = {
    t1: S.pooled.oos.mean > 0 && S.pooled.oos.t >= 2,
    t2: keys.every((k) => S.markets[k].oos.n >= MIN_N),
    t3: S.pooled.is.mean > 0,
    t4: S.daysOOS.diff > 0 && S.daysOOS.t >= 2,
    t5: S.placebo.beaten >= SEEDS_NEED,
  };
  return { verdict: Object.values(checks).every(Boolean) ? 'PASS' : 'FAIL', checks, perMarket };
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const dir = process.argv[2]; if (!dir) throw new Error('usage: node run.mjs <candleDir>');
  const here = path.dirname(new URL(import.meta.url).pathname);
  const rates = JSON.parse(fs.readFileSync(path.join(here, 'rates.json'), 'utf8'));
  const M = {};
  for (const k of Object.keys(MARKETS)) M[k] = JSON.parse(zlib.gunzipSync(fs.readFileSync(path.join(dir, `${k}-1h.json.gz`))));
  const S = study(M, rates.DGS2), v = verdictOf(S);
  const out = { built: '2026-11-13', study: 'pre-holiday', title: 'The pre-holiday effect on US indices, out of sample', verdict: v.verdict, checks: v.checks, perMarket: v.perMarket,
    data: { src: 'OANDA mid H1 via the site candle proxy (fetch.mjs); close = the H1 candle ending 16:00 New York (13:00 half days); 2-year yield FRED DGS2 weekly (rates.json)', costs: Object.fromEntries(Object.entries(MARKETS).map(([k, m]) => [k, m.cost])), financing: `DGS2 + ${FIN_ADD}% a year, calendar nights` },
    ...S };
  fs.writeFileSync(path.join(here, 'result.json'), JSON.stringify(out, null, 1) + '\n');
  console.log(v.verdict, JSON.stringify(v.checks), JSON.stringify(S.pooled.oos), JSON.stringify(S.pooled.is), JSON.stringify(S.daysOOS), 'placebo', S.placebo.beaten, S.placebo.median);
  for (const k of Object.keys(MARKETS)) console.log(k, JSON.stringify(S.markets[k].oos), JSON.stringify(S.markets[k].is), S.markets[k].skipped.length, v.perMarket[k]);
}
