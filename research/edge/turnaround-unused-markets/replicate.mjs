// Edge research · turnaround-replicate: the frozen NAS100 "Turnaround Tuesday" cell (R2: the week's first session down more
// than 1 % close to close -> buy that close, sell the next session's close, stop 2 x ATR(20)) on six markets the study never
// saw: US30, US2000 (NYSE, 16:00 New York) and DE40, EU50 (17:30 Frankfurt), UK100 (16:30 London), JP225 (15:00 Tokyo) on their
// own local sessions (PREREGISTRATION.md). One pooled test: equal-risk pool net R > 0 with month-sum t >= 2, at least 4 of 6
// markets positive, and a 40-seed placebo of random down-1 % days. The rule's code is frozen.mjs, the turnaround-tuesday run.mjs
// copied byte for byte; this file only adds the local calendars, closes, rates and the pooling.
//   node research/edge/turnaround-replicate/run.mjs <candleDir>   (the files fetch.mjs wrote; writes result.json beside this file)
import fs from 'node:fs';
import path from 'node:path';
import zlib from 'node:zlib';
import * as F from './frozen.mjs';
import { goodFriday } from '../../../ict/calendar.mjs';

export const FROZEN_SHA256 = '74527d362f9d65c996cdd4df25abadbbc6b723b9aa49141d6a29c88b19693871';
export const DROP = F.RULES.r2.drop;                       // -1 %
export const SPLIT = F.SPLIT, FIRST = F.FIRST, SEEDS = F.SEEDS, SEEDS_NEED = F.SEEDS_NEED;
export const MONTH_T = 2, BREADTH = 4, LAST_MONTH = '2026-11';

// cal: the local calendar; zone + closeH: the cash close (the H1 candle ENDING at closeH local is the close; halfH on a half day)
export const MARKETS = {
  us30: { name: 'Dow 30 (US30)', cal: 'nyse', cost: 0.0004, rate: 'us' },
  us2000: { name: 'Russell 2000 (US2000)', cal: 'nyse', cost: 0.0008, rate: 'us' },
  de40: { name: 'Germany 40 (DE40)', cal: 'xetra', zone: 'Europe/Berlin', closeH: 17, cost: 0.0004, rate: 'eur' },
  eu50: { name: 'Euro Stoxx 50 (EU50)', cal: 'xetra', zone: 'Europe/Berlin', closeH: 17, cost: 0.0006, rate: 'eur' },
  uk100: { name: 'UK 100 (UK100)', cal: 'lse', zone: 'Europe/London', closeH: 16, halfH: 12, cost: 0.0005, rate: 'gbp' },
  jp225: { name: 'Japan 225 (JP225)', cal: 'tse', zone: 'Asia/Tokyo', closeH: 15, cost: 0.0006, rate: 'jpy' },
};

// Approximate yearly mean policy rates, % (ECB deposit facility, Bank of England Bank Rate, Bank of Japan policy rate). Stated,
// not fetched: one night at (rate + 2.5 %) / 365 is about 0.01R, so a point of error moves a trade by under 0.002R.
export const RATES = {
  eur: { 2007: 2.95, 2008: 2.9, 2009: 0.4, 2010: 0.25, 2011: 0.5, 2012: 0.15, 2013: 0, 2014: -0.05, 2015: -0.2, 2016: -0.35, 2017: -0.4, 2018: -0.4, 2019: -0.45, 2020: -0.5, 2021: -0.5, 2022: 0.1, 2023: 3.3, 2024: 3.6, 2025: 2.3, 2026: 2 },
  gbp: { 2007: 5.5, 2008: 4.7, 2009: 0.6, 2010: 0.5, 2011: 0.5, 2012: 0.5, 2013: 0.5, 2014: 0.5, 2015: 0.5, 2016: 0.4, 2017: 0.3, 2018: 0.6, 2019: 0.75, 2020: 0.2, 2021: 0.1, 2022: 1.5, 2023: 4.7, 2024: 5.1, 2025: 4.3, 2026: 3.9 },
  jpy: { 2007: 0.4, 2008: 0.45, 2009: 0.1, 2010: 0.1, 2011: 0.1, 2012: 0.1, 2013: 0.1, 2014: 0.1, 2015: 0.1, 2016: -0.1, 2017: -0.1, 2018: -0.1, 2019: -0.1, 2020: -0.1, 2021: -0.1, 2022: -0.1, 2023: -0.1, 2024: 0.15, 2025: 0.5, 2026: 0.75 },
};
export const yearRate = (cur) => (ymd) => { const T = RATES[cur]; let y = +ymd.slice(0, 4); while (T[y] == null && y > 2000) y--; return T[y] ?? null; };

// ---- calendars -------------------------------------------------------------------------------------------------------
const ymdU = (y, m, d) => new Date(Date.UTC(y, m - 1, d)).toISOString().slice(0, 10);   // m 1-12, d may overflow
const dowU = (s) => new Date(s + 'T12:00:00Z').getUTCDay();
const addD = (s, n) => new Date(Date.parse(s + 'T12:00:00Z') + n * 86400e3).toISOString().slice(0, 10);
const nthMon = (y, m, n) => { const first = ymdU(y, m, 1); return addD(first, ((1 - dowU(first) + 7) % 7) + 7 * (n - 1)); };
const lastMon = (y, m) => { const last = ymdU(y, m + 1, 0); return addD(last, -((dowU(last) + 6) % 7)); };
const easterMon = (y) => addD(goodFriday(y), 3);
const cache = new Map();
const memo = (k, f) => { if (!cache.has(k)) cache.set(k, f()); return cache.get(k); };

export function xetraHolidays(y) {
  return memo('x' + y, () => new Set([ymdU(y, 1, 1), goodFriday(y), easterMon(y), ymdU(y, 5, 1), ymdU(y, 12, 24), ymdU(y, 12, 25), ymdU(y, 12, 26), ymdU(y, 12, 31)]));
}
export function lseHolidays(y) {
  return memo('l' + y, () => {
    const s = new Set();
    const nyd = ymdU(y, 1, 1), w = dowU(nyd); s.add(w === 6 ? ymdU(y, 1, 3) : w === 0 ? ymdU(y, 1, 2) : nyd);
    s.add(goodFriday(y)); s.add(easterMon(y));
    s.add(y === 2020 ? '2020-05-08' : nthMon(y, 5, 1));
    if (y === 2012) { s.add('2012-06-04'); s.add('2012-06-05'); } else if (y === 2022) { s.add('2022-06-02'); s.add('2022-06-03'); } else s.add(lastMon(y, 5));
    s.add(lastMon(y, 8));
    const xm = ymdU(y, 12, 25), xw = dowU(xm);
    if (xw === 6) { s.add(ymdU(y, 12, 27)); s.add(ymdU(y, 12, 28)); }
    else if (xw === 0) { s.add(ymdU(y, 12, 26)); s.add(ymdU(y, 12, 27)); }
    else if (xw === 5) { s.add(xm); s.add(ymdU(y, 12, 28)); }
    else { s.add(xm); s.add(ymdU(y, 12, 26)); }
    for (const d of ['2011-04-29', '2022-09-19', '2023-05-08']) if (+d.slice(0, 4) === y) s.add(d);
    return s;
  });
}
export const lseHalf = (ymd) => /-12-(24|31)$/.test(ymd) && dowU(ymd) % 6 !== 0 && !lseHolidays(+ymd.slice(0, 4)).has(ymd);
// Japan's national holidays (the law as amended; the 2019-21 one-off moves), then the Tokyo Stock Exchange's own closed days
export function jpHolidays(y) {
  return memo('j' + y, () => {
    const s = new Set(), add = (d) => s.add(d);
    const vern = Math.floor(20.8431 + 0.242194 * (y - 1980) - Math.floor((y - 1980) / 4));
    const aut = Math.floor(23.2488 + 0.242194 * (y - 1980) - Math.floor((y - 1980) / 4));
    add(ymdU(y, 1, 1)); add(nthMon(y, 1, 2)); add(ymdU(y, 2, 11));
    if (y <= 2018) add(ymdU(y, 12, 23)); if (y >= 2020) add(ymdU(y, 2, 23));
    add(ymdU(y, 3, vern)); add(ymdU(y, 4, 29)); add(ymdU(y, 5, 3)); add(ymdU(y, 5, 4)); add(ymdU(y, 5, 5));
    add(y === 2020 ? '2020-07-23' : y === 2021 ? '2021-07-22' : nthMon(y, 7, 3));
    if (y >= 2016) add(y === 2020 ? '2020-08-10' : y === 2021 ? '2021-08-08' : ymdU(y, 8, 11));
    add(nthMon(y, 9, 3)); add(ymdU(y, 9, aut));
    add(y === 2020 ? '2020-07-24' : y === 2021 ? '2021-07-23' : nthMon(y, 10, 2));
    add(ymdU(y, 11, 3)); add(ymdU(y, 11, 23));
    if (y === 2019) { add('2019-05-01'); add('2019-10-22'); }
    const base = [...s].sort();
    for (const d of base) if (dowU(d) === 0) { let x = addD(d, 1); while (s.has(x)) x = addD(x, 1); s.add(x); }   // substitute
    for (const d of [...s].sort()) { const x = addD(d, 2); if (s.has(x) && !s.has(addD(d, 1)) && dowU(addD(d, 1)) !== 0) s.add(addD(d, 1)); } // citizen's
    return s;
  });
}
export function tseHolidays(y) {
  return memo('t' + y, () => { const s = new Set(jpHolidays(y)); for (const d of [ymdU(y, 1, 1), ymdU(y, 1, 2), ymdU(y, 1, 3), ymdU(y, 12, 31)]) s.add(d); return s; });
}
const HOL = { xetra: xetraHolidays, lse: lseHolidays, tse: tseHolidays };
export const isLocalTradingDay = (cal, ymd) => { const w = dowU(ymd); return w !== 0 && w !== 6 && !HOL[cal](+ymd.slice(0, 4)).has(ymd); };
export function localTradingDays(cal, from, to) {
  if (cal === 'nyse') return F.tradingDays(from, to);
  const out = []; for (let d = from; d <= to; d = addD(d, 1)) if (isLocalTradingDay(cal, d)) out.push(d);
  return out;
}

// ---- local closes ----------------------------------------------------------------------------------------------------
const fmts = new Map();
export function localParts(zone, t) {
  if (!fmts.has(zone)) fmts.set(zone, new Intl.DateTimeFormat('en-GB', { timeZone: zone, year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', hourCycle: 'h23' }));
  const o = {}; for (const p of fmts.get(zone).formatToParts(new Date(t * 1000))) o[p.type] = p.value;
  return { ymd: `${o.year}-${o.month}-${o.day}`, min: +o.hour * 60 + +o.minute };
}
// the start (unix s) of the H1 candle that ENDS at hourEnd local time on ymd
export function localCloseCandle(zone, ymd, hourEnd) {
  const [y, m, d] = ymd.split('-').map(Number), h = hourEnd - 1;
  for (let off = -12; off <= 14; off++) { const t = Date.UTC(y, m - 1, d, h - off) / 1000; const p = localParts(zone, t); if (p.ymd === ymd && p.min === h * 60) return t; }
  throw new Error('no close candle for ' + zone + ' ' + ymd);
}
export const closeOfMarket = (k) => { const M = MARKETS[k]; return (ymd) => localCloseCandle(M.zone, ymd, M.cal === 'lse' && lseHalf(ymd) ? M.halfH : M.closeH); };

// The frozen buildDays with its one call closeCandle(d) replaced by closeOf(d) (the test compares the two texts).
export function buildDaysAt(bars, days, closeOf) {
  const at = new Map(bars.map((b, i) => [b[0], i]));
  const out = [];
  let prevEnd = null;
  for (const d of days) {
    const t = closeOf(d), i = at.get(t);
    if (i == null) { out.push({ d, t, close: null }); prevEnd = null; continue; }
    let hi = -Infinity, lo = Infinity, j = i;
    for (; j >= 0 && (prevEnd == null ? j >= i - 23 : bars[j][0] > prevEnd); j--) { hi = Math.max(hi, bars[j][2]); lo = Math.min(lo, bars[j][3]); }
    out.push({ d, t, i, close: bars[i][4], hi, lo });
    prevEnd = t;
  }
  return out;
}

// ---- one market: the rule's trades and the placebo pool (the frozen cellsFor, R2 only) ----------------------------------
const yr = (d) => +d.slice(0, 4);
const r3 = (x) => x == null ? null : +x.toFixed(3), r2 = (x) => x == null ? null : +x.toFixed(2);
export function marketRun(k, bars, rate) {
  const M = MARKETS[k];
  const first = '2007-10-01', last = new Date(bars.at(-1)[0] * 1000).toISOString().slice(0, 10);
  const days = localTradingDays(M.cal, first, last);
  const D = M.cal === 'nyse' ? F.buildDays(bars, days) : buildDaysAt(bars, days, closeOfMarket(k));
  const pairs = F.weekPairs(days), opt = { cost: M.cost, rate };
  const trades = [], skipped = [], entryIdx = new Set();
  for (const p of pairs) {
    const d = days[p.m];
    if (yr(d) < FIRST) continue;
    if (!F.ruleOn(F.dayChg(D, p.m), DROP)) continue;
    entryIdx.add(p.m);
    const t = F.trade(bars, D, p.m, p.x, opt);
    if (!t) { skipped.push(d); continue; }
    trades.push(t);
  }
  const pool = new Map();
  days.forEach((d, x) => { if (x >= 1 && x + 1 < days.length && !entryIdx.has(x) && F.ruleOn(F.dayChg(D, x), DROP)) { if (!pool.has(yr(d))) pool.set(yr(d), []); pool.get(yr(d)).push(x); } });
  const closes = D.filter((x) => x.close != null).length;
  return { k, days, D, bars, opt, trades, skipped, pool, closes, from: days[0], to: days.at(-1) };
}
// draw this market's placebo trades for one seed (the frozen sampler; counts = the rule's decisive-window trades per year)
export function placeboDraw(run, counts, Rn) {
  const obs = [];
  for (const [y, n] of counts) {
    const K = run.pool.get(y) || []; let got = 0, tries = 0;
    while (K.length && got < n && tries < n * 50) { tries++; const x = K[Math.floor(Rn() * K.length)]; const t = F.trade(run.bars, run.D, x, x + 1, run.opt); if (t) { obs.push(t.R); got++; } }
  }
  return obs;
}

export function summ(ts) {
  const s = F.stats(ts.map((t) => t.R)), g = F.stats(ts.map((t) => t.grossR)), pc = F.stats(ts.map((t) => t.net));
  return { n: s.n, R: r3(s.mean), t: r2(s.t), grossR: r3(g.mean), tGross: r2(g.t), netPct: r3(pc.mean), win: s.n ? r2(100 * ts.filter((t) => t.R > 0).length / s.n) : null, stops: ts.filter((t) => t.how !== 'time').length, totalR: r2(ts.reduce((a, t) => a + t.R, 0)) };
}
// t of calendar-month sums from fromYm to toYm inclusive (a month with no trade counts 0); month = the entry date's
export function monthT(ts, fromYm, toYm) {
  const sums = new Map();
  for (let [y, m] = fromYm.split('-').map(Number); `${y}-${String(m).padStart(2, '0')}` <= toYm; m === 12 ? (y++, m = 1) : m++) sums.set(`${y}-${String(m).padStart(2, '0')}`, 0);
  for (const t of ts) { const ym = t.entryD.slice(0, 7); if (sums.has(ym)) sums.set(ym, sums.get(ym) + t.R); }
  const s = F.stats([...sums.values()]);
  return { months: s.n, mean: r3(s.mean), t: r2(s.t), withTrade: ts.length ? new Set(ts.map((t) => t.entryD.slice(0, 7))).size : 0 };
}

export function study(bars, dgs2) {
  const us = F.rateOf(dgs2), runs = {};
  for (const k of Object.keys(MARKETS)) if (bars[k]) runs[k] = marketRun(k, bars[k], MARKETS[k].rate === 'us' ? us : yearRate(MARKETS[k].rate));
  const keys = Object.keys(runs), oosOf = (r) => r.trades.filter((t) => yr(t.entryD) >= SPLIT), isOf = (r) => r.trades.filter((t) => yr(t.entryD) < SPLIT);
  const poolOOS = keys.flatMap((k) => oosOf(runs[k])), poolIS = keys.flatMap((k) => isOf(runs[k]));
  const poolMean = F.stats(poolOOS.map((t) => t.R)).mean;
  const counts = Object.fromEntries(keys.map((k) => { const c = new Map(); for (const t of oosOf(runs[k])) c.set(yr(t.entryD), (c.get(yr(t.entryD)) || 0) + 1); return [k, c]; }));
  const seeds = [], perMk = Object.fromEntries(keys.map((k) => [k, []]));
  for (let s = 1; s <= SEEDS; s++) {
    const Rn = F.rng(s), all = [];
    for (const k of keys) { const o = placeboDraw(runs[k], counts[k], Rn); perMk[k].push(o.length ? o.reduce((a, b) => a + b, 0) / o.length : null); all.push(...o); }
    seeds.push(all.length ? all.reduce((a, b) => a + b, 0) / all.length : null);
  }
  const beaten = seeds.filter((m) => m != null && poolMean != null && poolMean > m).length;
  const markets = {};
  for (const k of keys) {
    const r = runs[k], o = oosOf(r), mMean = F.stats(o.map((t) => t.R)).mean, byYear = {};
    for (const t of r.trades) (byYear[yr(t.entryD)] ||= []).push(t.R);
    markets[k] = { name: MARKETS[k].name, cal: MARKETS[k].cal, cost: MARKETS[k].cost, from: r.from, to: r.to, closes: r.closes,
      firstBar: new Date(r.bars[0][0] * 1000).toISOString().slice(0, 10), lastBar: new Date(r.bars.at(-1)[0] * 1000).toISOString().slice(0, 10),
      is: summ(isOf(r)), oos: summ(o), skipped: r.skipped,
      placebo: { beaten: perMk[k].filter((m) => m != null && mMean != null && mMean > m).length, median: r3([...perMk[k]].filter((x) => x != null).sort((a, b) => a - b)[Math.floor(SEEDS / 2)] ?? null) },
      byYear: Object.fromEntries(Object.entries(byYear).map(([y, xs]) => { const s = F.stats(xs); return [y, { n: s.n, R: r3(s.mean) }]; })),
      trades: r.trades.map((t) => [t.entryD, t.exitD, t.how, t.nights, r3(t.gross), r3(t.net), r3(t.R)]) };
  }
  const pool = { oos: { ...summ(poolOOS), month: monthT(poolOOS, `${SPLIT}-01`, LAST_MONTH) }, is: { ...summ(poolIS), month: monthT(poolIS, `${FIRST}-01`, `${SPLIT - 1}-12`) },
    placebo: { seeds: seeds.map(r3), beaten, need: SEEDS_NEED, median: r3([...seeds].sort((a, b) => a - b)[SEEDS / 2]) } };
  return { markets, pool };
}

export function verdictOf(S) {
  const o = S.pool.oos, pos = Object.values(S.markets).filter((m) => m.oos.R > 0).length;
  const checks = {
    p1: o.R > 0 && o.month.t >= MONTH_T,
    p2: pos >= BREADTH,
    p3: S.pool.placebo.beaten >= SEEDS_NEED,
  };
  return { verdict: Object.values(checks).every(Boolean) ? 'PASS' : 'FAIL', checks, positive: pos, of: Object.keys(S.markets).length };
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const dir = process.argv[2]; if (!dir) throw new Error('usage: node run.mjs <candleDir>');
  const here = path.dirname(new URL(import.meta.url).pathname);
  const rates = JSON.parse(fs.readFileSync(path.join(here, 'rates.json'), 'utf8'));
  const bars = {};
  for (const k of Object.keys(MARKETS)) bars[k] = JSON.parse(zlib.gunzipSync(fs.readFileSync(path.join(dir, `${k}-1h.json.gz`))));
  const S = study(bars, rates.DGS2), v = verdictOf(S);
  const out = { built: '2026-11-13', study: 'turnaround-replicate', title: 'The NAS100 Turnaround Tuesday cell on six markets it never saw', verdict: v.verdict,
    checks: v.checks, positive: v.positive, of: v.of, supportsNas100: v.verdict === 'PASS', frozen: { file: 'frozen.mjs', sha256: FROZEN_SHA256, from: 'branch turnaround-tuesday, research/edge/turnaround-tuesday/run.mjs (commit 568a1c94b)' },
    data: { src: 'OANDA mid H1 via the site candle proxy (fetch.mjs); local closes per PREREGISTRATION.md; US rate FRED DGS2 weekly (rates.json), other rates yearly (RATES)', financing: `rate + ${F.FIN_ADD}% a year, calendar nights` },
    ...S };
  fs.writeFileSync(path.join(here, 'result.json'), JSON.stringify(out, null, 1) + '\n');
  console.log(v.verdict, JSON.stringify(v));
  for (const [k, m] of Object.entries(S.markets)) console.log(k, m.from, m.firstBar, m.lastBar, 'closes', m.closes, 'OOS', JSON.stringify(m.oos), 'IS', JSON.stringify(m.is), 'plc', JSON.stringify(m.placebo), 'skip', m.skipped.length);
  console.log('pool', JSON.stringify(S.pool.oos), JSON.stringify(S.pool.is), 'placebo', S.pool.placebo.beaten, S.pool.placebo.median);
}
