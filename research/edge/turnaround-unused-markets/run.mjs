// Edge research · turnaround-unused-markets: the frozen Turnaround Tuesday rule (R2: the week's first local session closes more
// than 1 % below the previous close -> buy that close, sell the next session's close, stop 2 x ATR(20)) on the OANDA index CFDs
// that neither #857 (SPX500, NAS100) nor #862 (US30, US2000, DE40, EU50, UK100, JP225) used (PREREGISTRATION.md, pushed alone
// first). The rule's code is frozen.mjs (#857's run.mjs) and replicate.mjs (#862's run.mjs), both byte for byte and never
// edited; this file adds only the new markets' calendars (holidays.json), cash closes, costs and rates, then runs #862's bar.
//   node research/edge/turnaround-unused-markets/run.mjs <candleDir> [gateDir]   (the files fetch.mjs wrote; writes result.json)
import fs from 'node:fs';
import path from 'node:path';
import zlib from 'node:zlib';
import * as F from './frozen.mjs';
import * as P from './replicate.mjs';

export const FROZEN_SHA256 = '74527d362f9d65c996cdd4df25abadbbc6b723b9aa49141d6a29c88b19693871';
export const REPLICATE_SHA256 = '61cb6424546a299e3fd8f626c72a1f2cc0ec1f57a422bc438e2a9d4c263d4b18';
const here = path.dirname(new URL(import.meta.url).pathname);
export const HOL = JSON.parse(fs.readFileSync(path.join(here, 'holidays.json'), 'utf8'));

// #862's published decisive figures (gate) and #857's NAS100 R2 cell (for the Fisher line)
export const GATE_862 = { pool: { n: 411, R: 0.052, t: 2.63, monthT: 1.69, months: 131 },
  markets: { us30: [55, 0.018], us2000: [93, 0.061], de40: [64, 0.054], eu50: [74, 0.024], uk100: [50, 0.036], jp225: [75, 0.103] } };
export const ORIG_857 = { id: '#857 turnaround-tuesday: nas100-r2', n: 81, R: 0.098, t: 2.33 };
export const USED = { '#857': ['spx500', 'nas100'], '#862': ['us30', 'us2000', 'de40', 'eu50', 'uk100', 'jp225'] };

// Candidates (every OANDA index CFD key of api/_oanda.js not in USED). close / half = local cash close 'hh:mm'; the close
// used is the last H1 candle that ENDS at or before it. cost = stated round trip, share of the entry price (assumed).
export const CANDIDATES = {
  fr40: { name: 'France 40 (FR40)', inst: 'FR40_EUR', cal: 'TAR', zone: 'Europe/Paris', close: '17:30', half: '14:05', halfRule: 'dec2431', cost: 0.0005, rate: 'eur' },
  nl25: { name: 'Netherlands 25 (NL25)', inst: 'NL25_EUR', cal: 'TAR', zone: 'Europe/Amsterdam', close: '17:30', half: '14:05', halfRule: 'dec2431', cost: 0.0008, rate: 'eur' },
  es35: { name: 'Spain 35 (ES35)', inst: 'ESPIX_EUR', cal: 'XMAD', zone: 'Europe/Madrid', close: '17:30', half: '14:00', cost: 0.0008, rate: 'eur' },
  ch20: { name: 'Switzerland 20 (CH20)', inst: 'CH20_CHF', cal: 'XSWX', zone: 'Europe/Zurich', close: '17:30', cost: 0.0006, rate: 'chf' },
  au200: { name: 'Australia 200 (AU200)', inst: 'AU200_AUD', cal: 'XASX', zone: 'Australia/Sydney', close: '16:00', half: '14:10', cost: 0.0006, rate: 'aud' },
  hk33: { name: 'Hong Kong 33 (HK33)', inst: 'HK33_HKD', cal: 'XHKG', zone: 'Asia/Hong_Kong', close: '16:00', half: '12:00', cost: 0.0008, rate: 'us' },
  cn50: { name: 'China A50 (CN50)', inst: 'CN50_USD', cal: 'XSHG', zone: 'Asia/Shanghai', close: '15:00', cost: 0.0010, rate: 'us' },
  sg30: { name: 'Singapore 30 (SG30)', inst: 'SG30_SGD', cal: 'XSES', zone: 'Asia/Singapore', close: '17:00', half: '12:00', cost: 0.0010, rate: 'sgd' },
  in50: { name: 'India 50 (IN50)', inst: 'IN50_USD', cal: 'XNSE', zone: 'Asia/Kolkata', close: '15:30', cost: 0.0008, rate: 'us' },
};
export const DECISIVE_FROM = '2016-01-01', LAST_DAY = '2026-11-12';
export const QUAL = { coverage: 0.9, startBy: '2017-01-01', endFrom: '2026-10-01', minMarkets: 3 };
export const COST_X = 2;

// yearly approximate mean policy rates, % (stated, not fetched; eur from replicate.mjs RATES, unchanged)
export const RATES = {
  eur: P.RATES.eur,
  chf: { 2007: 2.5, 2008: 2.3, 2009: 0.25, 2010: 0.25, 2011: 0.1, 2012: 0, 2013: 0, 2014: 0, 2015: -0.75, 2016: -0.75, 2017: -0.75, 2018: -0.75, 2019: -0.75, 2020: -0.75, 2021: -0.75, 2022: 0, 2023: 1.5, 2024: 1.25, 2025: 0.25, 2026: 0 },
  aud: { 2007: 6.5, 2008: 6.9, 2009: 3.3, 2010: 4.4, 2011: 4.7, 2012: 3.6, 2013: 2.8, 2014: 2.5, 2015: 2.1, 2016: 1.6, 2017: 1.5, 2018: 1.5, 2019: 1.1, 2020: 0.4, 2021: 0.1, 2022: 1.3, 2023: 3.9, 2024: 4.35, 2025: 3.9, 2026: 3.6 },
  sgd: { 2007: 2.3, 2008: 1.0, 2009: 0.2, 2010: 0.2, 2011: 0.2, 2012: 0.2, 2013: 0.1, 2014: 0.1, 2015: 0.6, 2016: 0.6, 2017: 0.7, 2018: 1.3, 2019: 1.6, 2020: 0.3, 2021: 0.1, 2022: 1.6, 2023: 3.3, 2024: 3.4, 2025: 2.0, 2026: 1.5 },
};
export const yearRate = (cur) => (ymd) => { const T = RATES[cur]; let y = +ymd.slice(0, 4); while (T[y] == null && y > 2000) y--; return T[y] ?? null; };

// ---- calendars ---------------------------------------------------------------------------------------------------------
const addD = (s, n) => new Date(Date.parse(s + 'T12:00:00Z') + n * 86400e3).toISOString().slice(0, 10);
const dowU = (s) => new Date(s + 'T12:00:00Z').getUTCDay();
const sets = new Map();
const closedSet = (cal) => { if (!sets.has(cal)) sets.set(cal, { closed: new Set(HOL.closed[cal]), half: new Set(HOL.half[cal]) }); return sets.get(cal); };
// the first date the calendar is defined (the package defines XHKG from 2014 only)
export const calFrom = (cal) => `${HOL.from[cal]}-01-01`;
export function isHalf(k, ymd) {
  const M = CANDIDATES[k];
  if (!M.half) return false;
  if (M.halfRule === 'dec2431') return /-12-(24|31)$/.test(ymd);
  return closedSet(M.cal).half.has(ymd);
}
export function localDays(cal, from, to) {
  const S = closedSet(cal), out = [];
  for (let d = from < calFrom(cal) ? calFrom(cal) : from; d <= to; d = addD(d, 1)) { const w = dowU(d); if (w !== 0 && w !== 6 && !S.closed.has(d)) out.push(d); }
  return out;
}

// ---- cash closes: the start (unix s) of the last H1 candle ending at or before the local time hh:mm on ymd ----------------
const fmts = new Map();
function partsAt(zone, t) {
  if (!fmts.has(zone)) fmts.set(zone, new Intl.DateTimeFormat('en-GB', { timeZone: zone, year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', hourCycle: 'h23' }));
  const o = {}; for (const p of fmts.get(zone).formatToParts(new Date(t * 1000))) o[p.type] = p.value;
  return { ymd: `${o.year}-${o.month}-${o.day}`, min: +o.hour * 60 + +o.minute };
}
export function localInstant(zone, ymd, hhmm) {
  const [y, m, d] = ymd.split('-').map(Number), [h, mi] = hhmm.split(':').map(Number);
  for (let off = -14 * 60; off <= 14 * 60; off += 15) { const t = Date.UTC(y, m - 1, d, h, mi) / 1000 - off * 60; const p = partsAt(zone, t); if (p.ymd === ymd && p.min === h * 60 + mi) return t; }
  throw new Error('no instant for ' + zone + ' ' + ymd + ' ' + hhmm);
}
export const closeCandleAt = (zone, ymd, hhmm) => Math.floor(localInstant(zone, ymd, hhmm) / 3600) * 3600 - 3600;
export const closeOfCandidate = (k) => { const M = CANDIDATES[k]; return (ymd) => closeCandleAt(M.zone, ymd, isHalf(k, ymd) ? M.half : M.close); };

// ---- availability (counts only, read before the pre-registration was written) ----------------------------------------
const ymdOf = (t) => new Date(t * 1000).toISOString().slice(0, 10);
export function availability(k, bars) {
  const M = CANDIDATES[k], have = new Set(bars.map((b) => b[0])), co = closeOfCandidate(k);
  const first = ymdOf(bars[0][0]), last = ymdOf(bars.at(-1)[0]);
  const from = first > DECISIVE_FROM ? first : DECISIVE_FROM;
  const days = localDays(M.cal, from, last), closes = days.filter((d) => have.has(co(d))).length;
  const cover = days.length ? closes / days.length : 0;
  const reasons = [];
  if (first > QUAL.startBy) reasons.push(`candles start ${first}, after ${QUAL.startBy}`);
  if (last < QUAL.endFrom) reasons.push(`candles end ${last}, before ${QUAL.endFrom}`);
  if (cover < QUAL.coverage) reasons.push(`close candle on ${(100 * cover).toFixed(1)} % of local trading days from ${from}`);
  const daysIS = localDays(M.cal, '2008-01-01', '2015-12-31'), closesIS = daysIS.filter((d) => have.has(co(d))).length;
  return { firstBar: first, lastBar: last, days: days.length, closes, cover: +cover.toFixed(4), daysIS: daysIS.length, closesIS, qualifies: !reasons.length, reasons };
}

// ---- one market: the rule's trades and the two placebo pools (P.marketRun's body, with the local calendar and close) ----
const yr = (d) => +d.slice(0, 4);
const r3 = (x) => x == null ? null : +x.toFixed(3), r2 = (x) => x == null ? null : +x.toFixed(2);
export function marketRun(k, bars, rate) {
  const M = CANDIDATES[k];
  const first = '2007-10-01', last = ymdOf(bars.at(-1)[0]);
  const days = localDays(M.cal, first, last);
  const D = P.buildDaysAt(bars, days, closeOfCandidate(k));
  const pairs = F.weekPairs(days), opt = { cost: M.cost, rate };
  const trades = [], skipped = [], entryIdx = new Set();
  for (const p of pairs) {
    const d = days[p.m];
    if (yr(d) < F.FIRST) continue;
    if (!F.ruleOn(F.dayChg(D, p.m), P.DROP)) continue;
    entryIdx.add(p.m);
    const t = F.trade(bars, D, p.m, p.x, opt);
    if (!t) { skipped.push(d); continue; }
    trades.push(t);
  }
  const isM = (x) => x >= 1 && F.weekOf(days[x - 1]) !== F.weekOf(days[x]);
  const pool = new Map(), wpool = new Map(), put = (m, x) => { const y = yr(days[x]); if (!m.has(y)) m.set(y, []); m.get(y).push(x); };
  days.forEach((d, x) => {
    if (!(x >= 1 && x + 1 < days.length)) return;
    if (!entryIdx.has(x) && F.ruleOn(F.dayChg(D, x), P.DROP)) put(pool, x);   // #862's P3 pool: down > 1 % days, not an M of the rule
    if (!isM(x)) put(wpool, x);                                                 // step-5 pool: any trading day that is not the week's first
  });
  const closes = D.filter((x) => x.close != null).length;
  return { k, days, D, bars, opt, trades, skipped, pool, wpool, closes, from: days[0], to: days.at(-1) };
}

// worst closed drawdown of a trade list, in R, trades in exit order
export function drawdown(ts) {
  let eq = 0, peak = 0, dd = 0;
  for (const t of [...ts].sort((a, b) => (a.exitD < b.exitD ? -1 : a.exitD > b.exitD ? 1 : a.entryD < b.entryD ? -1 : 1))) { eq += t.R; peak = Math.max(peak, eq); dd = Math.min(dd, eq - peak); }
  return r2(dd);
}
// R at COST_X times the stated round trip (financing once): R - (x - 1) * cost * entry / risk
export const atCost = (t, cost, x) => ({ ...t, R: t.R - (x - 1) * cost * t.entry / (t.entry - t.stop) });

// ---- statistics for the Fisher line: multiple-testing-update's functions, copied (its branch is not on main) -------------
export function erfc(x) {
  const z = Math.abs(x); const t = 1 / (1 + 0.5 * z);
  const r = t * Math.exp(-z * z - 1.26551223 + t * (1.00002368 + t * (0.37409196 + t * (0.09678418 + t * (-0.18628806
    + t * (0.27886807 + t * (-1.13520398 + t * (1.48851587 + t * (-0.82215223 + t * 0.17087277)))))))));
  return x >= 0 ? r : 2 - r;
}
export const Phi = (x) => 0.5 * erfc(-x / Math.SQRT2);
export const pOneSided = (t) => 1 - Phi(t);
export function chi2SfEven(x, df) {
  if (df % 2) throw new Error('even df only');
  let term = 1, sum = 1; for (let k = 1; k < df / 2; k++) { term *= x / 2 / k; sum += term; }
  return Math.exp(-x / 2) * sum;
}
export function fisher(ps) { const x = -2 * ps.reduce((a, p) => a + Math.log(p), 0); const df = 2 * ps.length; return { x, df, p: chi2SfEven(x, df) }; }
export function PhiInv(p) { let lo = -40, hi = 40; for (let i = 0; i < 200; i++) { const m = (lo + hi) / 2; if (Phi(m) < p) lo = m; else hi = m; } return (lo + hi) / 2; }

// ---- gate: #862's study through replicate.mjs, on #862's six markets -----------------------------------------------------
export function gate(bars6, dgs2) {
  const S = P.study(bars6, dgs2), o = S.pool.oos;
  const mk = Object.fromEntries(Object.entries(S.markets).map(([k, m]) => [k, [m.oos.n, m.oos.R]]));
  const got = { n: o.n, R: o.R, t: o.t, monthT: o.month.t, months: o.month.months };
  const ok = JSON.stringify(got) === JSON.stringify(GATE_862.pool) && Object.entries(GATE_862.markets).every(([k, v]) => JSON.stringify(mk[k]) === JSON.stringify(v));
  return { ok, got: { pool: got, markets: mk } };
}

// ---- the study -----------------------------------------------------------------------------------------------------------
export const breadthNeed = (n) => Math.ceil((2 * n) / 3);          // #862: 4 of 6
export function study(bars, dgs2, keys) {
  const us = F.rateOf(dgs2), runs = {};
  for (const k of keys) runs[k] = marketRun(k, bars[k], CANDIDATES[k].rate === 'us' ? us : yearRate(CANDIDATES[k].rate));
  const oosOf = (r) => r.trades.filter((t) => t.entryD >= DECISIVE_FROM), isOf = (r) => r.trades.filter((t) => yr(t.entryD) < F.SPLIT);
  const poolOOS = keys.flatMap((k) => oosOf(runs[k])), poolIS = keys.flatMap((k) => isOf(runs[k]));
  const poolMean = F.stats(poolOOS.map((t) => t.R)).mean;
  const counts = Object.fromEntries(keys.map((k) => { const c = new Map(); for (const t of oosOf(runs[k])) c.set(yr(t.entryD), (c.get(yr(t.entryD)) || 0) + 1); return [k, c]; }));
  // P3 (#862's placebo, its sampler): random down > 1 % days; step 5: random trading days that are not the week's first
  const P3 = [], W = [], perMk = Object.fromEntries(keys.map((k) => [k, []]));
  for (let s = 1; s <= F.SEEDS; s++) {
    const Rn = F.rng(s), all = [];
    for (const k of keys) { const o = P.placeboDraw(runs[k], counts[k], Rn); perMk[k].push(o.length ? o.reduce((a, b) => a + b, 0) / o.length : null); all.push(...o); }
    P3.push(all.length ? all.reduce((a, b) => a + b, 0) / all.length : null);
    const Rw = F.rng(s), wall = [];
    for (const k of keys) wall.push(...P.placeboDraw({ ...runs[k], pool: runs[k].wpool }, counts[k], Rw));
    W.push(wall.length ? wall.reduce((a, b) => a + b, 0) / wall.length : null);
  }
  const beat = (xs) => xs.filter((m) => m != null && poolMean != null && poolMean > m).length;
  const med = (xs) => r3([...xs].filter((x) => x != null).sort((a, b) => a - b)[Math.floor(xs.length / 2)] ?? null);
  const markets = {};
  for (const k of keys) {
    const r = runs[k], o = oosOf(r), i = isOf(r), mMean = F.stats(o.map((t) => t.R)).mean, byYear = {}, c = CANDIDATES[k].cost;
    for (const t of r.trades) (byYear[yr(t.entryD)] ||= []).push(t.R);
    markets[k] = { name: CANDIDATES[k].name, inst: CANDIDATES[k].inst, cal: CANDIDATES[k].cal, cost: c, from: r.from, to: r.to, closes: r.closes,
      firstBar: ymdOf(r.bars[0][0]), lastBar: ymdOf(r.bars.at(-1)[0]),
      oos: { ...P.summ(o), cost2x: r3(F.stats(o.map((t) => atCost(t, c, COST_X).R)).mean), dd: drawdown(o) }, is: P.summ(i), skipped: r.skipped,
      placebo: { beaten: perMk[k].filter((m) => m != null && mMean != null && mMean > m).length, median: med(perMk[k]) },
      byYear: Object.fromEntries(Object.entries(byYear).map(([y, xs]) => { const s = F.stats(xs); return [y, { n: s.n, R: r3(s.mean) }]; })),
      trades: r.trades.map((t) => [t.entryD, t.exitD, t.how, t.nights, r3(t.gross), r3(t.net), r3(t.R)]) };
  }
  // per-market Holm over the qualifying markets (secondary): one-sided p of the trade t
  const ps = keys.map((k) => markets[k].oos.t == null ? 1 : F.pOneSided(markets[k].oos.t)), adj = F.holm(ps);
  keys.forEach((k, j) => { markets[k].oos.p = +ps[j].toFixed(4); markets[k].oos.holm = +adj[j].toFixed(4); });
  const cost2x = poolOOS.map((t) => atCost(t, CANDIDATES[keys.find((k) => runs[k].trades.includes(t))].cost, COST_X));
  const lastYm = LAST_DAY.slice(0, 7);
  const pool = {
    oos: { ...P.summ(poolOOS), month: P.monthT(poolOOS, DECISIVE_FROM.slice(0, 7), lastYm), dd: drawdown(poolOOS),
      gross: { R: r3(F.stats(poolOOS.map((t) => t.grossR)).mean), month: P.monthT(poolOOS.map((t) => ({ ...t, R: t.grossR })), DECISIVE_FROM.slice(0, 7), lastYm) },
      cost2x: { R: r3(F.stats(cost2x.map((t) => t.R)).mean), month: P.monthT(cost2x, DECISIVE_FROM.slice(0, 7), lastYm) } },
    is: { ...P.summ(poolIS), month: P.monthT(poolIS, `${F.FIRST}-01`, `${F.SPLIT - 1}-12`), dd: drawdown(poolIS) },
    placebo: { seeds: P3.map(r3), beaten: beat(P3), need: F.SEEDS_NEED, median: med(P3) },
    weekdayPlacebo: { seeds: W.map(r3), beaten: beat(W), need: F.SEEDS_NEED, median: med(W) },
  };
  return { markets, pool };
}

export function verdictOf(S, g, nQual) {
  if (!g.ok) return { verdict: 'NOT MEASURABLE', why: 'inconclusive: gate, #862 not reproduced', checks: null };
  if (nQual < QUAL.minMarkets) return { verdict: 'NOT MEASURABLE', why: `inconclusive: ${nQual} markets qualify, under ${QUAL.minMarkets}`, checks: null };
  const o = S.pool.oos, n = Object.keys(S.markets).length, pos = Object.values(S.markets).filter((m) => m.oos.R > 0).length;
  const checks = { p1: o.R > 0 && o.month.t >= P.MONTH_T, p2: pos >= breadthNeed(n), p3: S.pool.placebo.beaten >= F.SEEDS_NEED };
  return { verdict: Object.values(checks).every(Boolean) ? 'REPLICATES' : 'DOES NOT REPLICATE', checks, positive: pos, of: n, need: breadthNeed(n) };
}

export function fisherBlock(monthT) {
  const p857 = pOneSided(ORIG_857.t), p862 = pOneSided(GATE_862.pool.monthT), pThis = pOneSided(monthT);
  const f = fisher([p857, p862, pThis]), f2 = fisher([p857, pThis]);
  const out = (x) => ({ x: +x.x.toFixed(4), df: x.df, p: +x.p.toPrecision(4), z: +(-PhiInv(x.p)).toFixed(2) });
  return { p857: +p857.toPrecision(4), p862: +p862.toPrecision(4), pThis: +pThis.toPrecision(4),
    calendarDisjoint: null, calendarNote: 'no cell lies on years #857 never used: #857 read 2008-now, #862 and this study 2016-now (decisive) and 2008-15 (reported)',
    allCells: { ids: ['#857 nas100-r2', '#862 pooled', 'this study pooled'], ...out(f), overstated: true },
    original2: { ids: ['#857 nas100-r2', 'this study pooled'], ...out(f2), overstated: true } };
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const dir = process.argv[2], gdir = process.argv[3] || dir; if (!dir) throw new Error('usage: node run.mjs <candleDir> [gateDir]');
  const rates = JSON.parse(fs.readFileSync(path.join(here, 'rates.json'), 'utf8'));
  const load = (d, k) => JSON.parse(zlib.gunzipSync(fs.readFileSync(path.join(d, `${k}-1h.json.gz`))));
  const bars = {}, av = {};
  for (const k of Object.keys(CANDIDATES)) { bars[k] = load(dir, k); av[k] = availability(k, bars[k]); }
  if (process.argv.includes('--availability')) { for (const [k, a] of Object.entries(av)) console.log(k, JSON.stringify(a)); process.exit(0); }
  const g = gate(Object.fromEntries(Object.keys(P.MARKETS).map((k) => [k, load(gdir, k)])), rates.DGS2);
  const keys = Object.keys(CANDIDATES).filter((k) => av[k].qualifies);
  const S = g.ok && keys.length >= QUAL.minMarkets ? study(bars, rates.DGS2, keys) : null;
  const v = verdictOf(S, g, keys.length);
  const fis = S ? fisherBlock(S.pool.oos.month.t) : null;
  const res = { built: '2026-11-14', study: 'turnaround-unused-markets', title: 'Turnaround Tuesday on the index CFDs neither study used', verdict: v.verdict, why: v.why || null,
    checks: v.checks, positive: v.positive, of: v.of, need: v.need, used: USED, qualifying: keys, availability: av,
    frozen: { file: 'frozen.mjs', sha256: FROZEN_SHA256, replicate: 'replicate.mjs', replicateSha256: REPLICATE_SHA256 }, gate: g,
    data: { src: 'OANDA mid H1 via the site candle proxy (fetch.mjs), 1 Oct 2007 - 12 Nov 2026; local calendars holidays.json (PyPI holidays 0.108); US rate FRED DGS2 weekly (rates.json); other rates yearly (RATES)', financing: `rate + ${F.FIN_ADD}% a year, calendar nights` },
    fisher: fis, ...(S || {}) };
  fs.writeFileSync(path.join(here, 'result.json'), JSON.stringify(res, null, 1) + '\n');
  console.log(v.verdict, JSON.stringify(v), 'gate', g.ok);
  if (S) {
    for (const [k, m] of Object.entries(S.markets)) console.log(k, 'OOS', JSON.stringify(m.oos), 'IS', JSON.stringify(m.is), 'plc', JSON.stringify(m.placebo), 'skip', m.skipped.length);
    console.log('pool', JSON.stringify(S.pool.oos), '\nIS', JSON.stringify(S.pool.is), '\nP3', S.pool.placebo.beaten, S.pool.placebo.median, 'W', S.pool.weekdayPlacebo.beaten, S.pool.weekdayPlacebo.median, '\nfisher', JSON.stringify(fis));
  }
}
