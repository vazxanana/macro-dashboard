// Edge research · opex-week: the monthly options-expiry week on SPX500 and NAS100 (PREREGISTRATION.md).
// T1 / T3: buy at the close of the last NYSE trading day before the expiry week, sell at the expiry-day close (the third Friday,
// or the trading day before it when it is a holiday). T2 / T4: sell at the expiry-day close, buy back at the next week's last
// trading-day close. Stop 2.5 x ATR(20) daily with gap fill; spread and financing in R. Holm over four tests; 40-seed placebo of a
// random other week of the same month, same side.
//   node research/edge/opex-week/run.mjs <candleDir>   (spx500.json, nas100.json from council-data research/daily;
//                                                       writes result.json beside this file)
// The NYSE calendar, ATR / stop and financing code is copied from the turn-of-month / rebalance-flow studies (sibling branches).
import fs from 'node:fs';
import path from 'node:path';
import { cmeYear } from '../../../ict/calendar.mjs';
import { foldWeekend } from '../../../council/fills.mjs';

export const MARKETS = { spx500: { name: 'S&P 500 (SPX500)', pts: 1 }, nas100: { name: 'Nasdaq 100 (NAS100)', pts: 3 } };
export const FIN_ADD = 2.5;              // percent a year over / under the 2-year yield
export const ATR_N = 20, STOP_ATR = 2.5, SEEDS = 40, SEEDS_NEED = 38, TRIES = 50;
export const DEC = ['2016-01', '2026-10'], REP = ['2008-01', '2015-12'];
export const TESTS = { T1: { mk: 'spx500', leg: 'opex', side: 1 }, T2: { mk: 'spx500', leg: 'after', side: -1 }, T3: { mk: 'nas100', leg: 'opex', side: 1 }, T4: { mk: 'nas100', leg: 'after', side: -1 } };
export const LABEL = { T1: 'SPX500 long, expiry week', T2: 'SPX500 short, week after', T3: 'NAS100 long, expiry week', T4: 'NAS100 short, week after' };
// NYSE closures that are not on the CME calendar's list (stated in the pre-registration)
export const SPECIAL = new Set(['2007-01-02', '2012-10-29', '2012-10-30', '2018-12-05', '2025-01-09']);
const NYSE_FROM_EARLY = new Set(['Martin Luther King Day', "Presidents' Day", 'Memorial Day', 'Juneteenth', 'Independence Day', 'Labor Day', 'Thanksgiving Day']);

export const ymdOf = (sec) => new Date(sec * 1000).toISOString().slice(0, 10);
const addDays = (ymd, k) => ymdOf(Date.parse(ymd + 'T00:00:00Z') / 1000 + k * 86400);
const wdOf = (ymd) => new Date(ymd + 'T12:00:00Z').getUTCDay();
export function isTradingDay(ymd) {
  const wd = wdOf(ymd);
  if (wd === 0 || wd === 6 || SPECIAL.has(ymd)) return false;
  const Y = cmeYear(+ymd.slice(0, 4));
  if (Y.full.has(ymd)) return false;
  const e = Y.early.get(ymd);
  return !(e && NYSE_FROM_EARLY.has(e.name));
}
// the last NYSE trading day on or before ymd
export const onOrBefore = (ymd) => { let d = ymd; while (!isTradingDay(d)) d = addDays(d, -1); return d; };
export const addMonths = (ym, k) => { const [y, m] = ym.split('-').map(Number); const n = y * 12 + (m - 1) + k; return `${Math.floor(n / 12)}-${String(n % 12 + 1).padStart(2, '0')}`; };
// the third Friday of 'YYYY-MM'
export function thirdFriday(ym) {
  const first = ym + '-01', wd = wdOf(first);
  return addDays(first, ((5 - wd + 7) % 7) + 14);
}
// every date of the rule for month ym: F, expiry X, T1 entry E1 (last trading day before the expiry week's Monday), T2 exit Y
export function datesOf(ym) {
  const F = thirdFriday(ym), X = onOrBefore(F), E1 = onOrBefore(addDays(F, -5)), Y = onOrBefore(addDays(F, 7));
  return { F, X, E1, Y };
}
// the week-end days (last NYSE trading day of each Monday-Friday week) whose date is in month ym
export function weekEnds(ym) {
  const out = [];
  for (let fri = addDays(thirdFriday(ym), -14); fri.slice(0, 7) === ym; fri = addDays(fri, 7)) {
    const we = onOrBefore(fri);
    if (we >= addDays(fri, -4) && we.slice(0, 7) === ym) out.push(we);   // a week with no trading day has no week-end day
  }
  return out;
}
// the week-end day after a week-end day (the next week's last trading day)
export const nextWeekEnd = (we) => { const fri = addDays(we, (5 - wdOf(we) + 7) % 7); return onOrBefore(addDays(fri, 7)); };

// rows [t, o, h, l, c, v] -> folded weekday candles { d, o, h, l, c } (council/fills.mjs foldWeekend)
export function fold(rows) {
  return foldWeekend(rows.map((r) => ({ time: r[0], open: r[1], high: r[2], low: r[3], close: r[4] })))
    .map((b) => ({ d: ymdOf(b.time), o: b.open, h: b.high, l: b.low, c: b.close }));
}
// ATR(n) of the n folded candles ending with index k (true range against the previous close); null without n + 1 candles
export function atrAt(B, k, n = ATR_N) {
  if (k - n < 0) return null;
  let s = 0;
  for (let j = k - n + 1; j <= k; j++) { const a = B[j], p = B[j - 1]; s += Math.max(a.h - a.l, Math.abs(a.h - p.c), Math.abs(a.l - p.c)); }
  return s / n;
}
export function rateOf(dgs2) {
  return (ymd) => { let v = null; for (const [d, x] of dgs2) { if (d > ymd) break; v = x; } return v; };
}
export const nights = (a, b) => Math.round((Date.parse(b + 'T12:00:00Z') - Date.parse(a + 'T12:00:00Z')) / 86400e3);
// financing a night as a fraction of the notional: a long pays r + 2.5 %, a short pays max(0, 2.5 - r) % (never credited)
export const finRate = (side, r) => (side > 0 ? r + FIN_ADD : Math.max(0, FIN_ADD - r)) / 100 / 365;

// one trade: side +1 buy / -1 sell, entry at the close of date sD, exit at the close of date xD unless stopped
export function trade(B, idx, sD, xD, side, { pts, rate }) {
  const e = idx.get(sD), x = idx.get(xD);
  if (e == null || x == null || x <= e) return null;
  const atr = atrAt(B, e);
  if (atr == null || !(atr > 0)) return null;
  const entry = B[e].c, risk = STOP_ATR * atr, stop = entry - side * risk;
  let exit = B[x].c, exitD = xD, how = 'time';
  for (let j = e + 1; j <= x; j++) {
    const b = B[j];
    if (side > 0 ? b.o <= stop : b.o >= stop) { exit = b.o; how = 'stop-gap'; exitD = b.d; break; }
    if (side > 0 ? b.l <= stop : b.h >= stop) { exit = stop; how = 'stop'; exitD = b.d; break; }
  }
  const r = rate(sD) ?? 0, n = nights(sD, exitD);
  const finCash = finRate(side, r) * n * entry;
  const gross = side * (exit - entry) / risk, costR = pts / risk, finR = finCash / risk;
  return { sD, exitD, side, entry, stop, risk, exit, how, nights: n, gross, costR, finR, net: gross - costR - finR };
}

export function stats(xs) {
  const n = xs.length; if (!n) return { n: 0, mean: null, sd: null, t: null };
  const mean = xs.reduce((a, b) => a + b, 0) / n, sd = n > 1 ? Math.sqrt(xs.reduce((a, b) => a + (b - mean) ** 2, 0) / (n - 1)) : 0;
  return { n, mean, sd, t: sd > 0 ? mean / (sd / Math.sqrt(n)) : null };
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

const r3 = (x) => x == null ? null : +x.toFixed(3), r2 = (x) => x == null ? null : +x.toFixed(2);
const inWin = (ym, w) => ym >= w[0] && ym <= w[1];
export function summ(ts) {
  const s = stats(ts.map((t) => t.net)), g = stats(ts.map((t) => t.gross));
  return { n: s.n, net: r3(s.mean), t: r2(s.t), gross: r3(g.mean), tGross: r2(g.t), win: s.n ? r2(100 * ts.filter((t) => t.net > 0).length / s.n) : null,
    stops: ts.filter((t) => t.how !== 'time').length, total: r2(ts.reduce((a, t) => a + t.net, 0)), cost: r3(s.n ? ts.reduce((a, t) => a + t.costR, 0) / s.n : null), fin: r3(s.n ? ts.reduce((a, t) => a + t.finR, 0) / s.n : null) };
}

// the rule's trades of one test on one market's folded candles
export function ruleTrades(B, idx, leg, side, opt) {
  const out = [], counts = { noCandle: 0 };
  for (let ym = REP[0]; ym <= DEC[1]; ym = addMonths(ym, 1)) {
    const D = datesOf(ym), [sD, xD] = leg === 'opex' ? [D.E1, D.X] : [D.X, D.Y];
    const t = trade(B, idx, sD, xD, side, opt);
    if (!t) { counts.noCandle++; continue; }
    out.push({ ym, ...t, expiry: D.X, thirdFriday: D.F });
  }
  return { trades: out, counts };
}

// one seed's placebo mean: per rule trade, the same side over a random other week of the same month
export function placeboMean(B, idx, trades, side, opt, seed) {
  const R = rng(seed), nets = [];
  for (const t of trades) {
    const W = weekEnds(t.sD.slice(0, 7)).filter((w) => w !== t.sD);
    for (let k = 0; k < TRIES && W.length; k++) {
      const w = W[Math.floor(R() * W.length)], p = trade(B, idx, w, nextWeekEnd(w), side, opt);
      if (p) { nets.push(p.net); break; }
    }
  }
  return stats(nets).mean;
}

export function runTest(B, idx, test, opt) {
  const { trades, counts } = ruleTrades(B, idx, test.leg, test.side, opt);
  const dec = trades.filter((t) => inWin(t.ym, DEC)), rep = trades.filter((t) => inWin(t.ym, REP));
  const ruleMean = stats(dec.map((t) => t.net)).mean;
  const seeds = [];
  for (let s = 1; s <= SEEDS; s++) seeds.push(placeboMean(B, idx, dec, test.side, opt, s));
  const sorted = [...seeds].sort((a, b) => a - b);
  const d = summ(dec);
  const years = [...new Set(dec.map((t) => t.ym.slice(0, 4)))];
  return {
    mk: test.mk, leg: test.leg, side: test.side, counts, dec: d, rep: summ(rep), pOne: pOneSided(d.t),
    placebo: { seeds: seeds.map(r3), ruleMean: r3(ruleMean), beaten: seeds.filter((m) => ruleMean > m).length, need: SEEDS_NEED,
      median: r3((sorted[19] + sorted[20]) / 2), p95: r3(sorted[37] + 0.05 * (sorted[38] - sorted[37])) },
    byYear: Object.fromEntries(years.map((y) => [y, summ(dec.filter((t) => t.ym.startsWith(y)))])),
    trades: trades.map((t) => [t.ym, t.sD, t.exitD, t.how, r3(t.gross), r3(t.net)]),
  };
}

export function verdictOf(T) {
  const keys = Object.keys(TESTS), adj = holm(keys.map((k) => T[k].pOne)), checks = {};
  keys.forEach((k, i) => {
    const x = T[k];
    const c = { netPos: x.dec.net > 0, t2: x.dec.t != null && x.dec.t >= 2, repSame: x.rep.net > 0, holmP: +adj[i].toFixed(4), placebo: x.placebo.beaten >= SEEDS_NEED };
    c.holm = c.holmP < 0.05;
    c.pass = c.netPos && c.t2 && c.repSame && c.holm && c.placebo;
    checks[k] = c;
  });
  const passed = keys.filter((k) => checks[k].pass);
  return { verdict: passed.length ? 'PASS' : 'FAIL', passed, checks };
}

export function runAll(rowsBy, dgs2) {
  const T = {}, info = {};
  for (const mk of Object.keys(MARKETS)) {
    const B = fold(rowsBy[mk]), idx = new Map(B.map((b, i) => [b.d, i]));
    info[mk] = { candles: B.length, from: B[0].d, to: B.at(-1).d };
    for (const [k, test] of Object.entries(TESTS)) if (test.mk === mk) T[k] = runTest(B, idx, test, { pts: MARKETS[mk].pts, rate: rateOf(dgs2) });
  }
  return { T, info, v: verdictOf(T) };
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const dir = process.argv[2]; if (!dir) throw new Error('usage: node run.mjs <candleDir>');
  const here = path.dirname(new URL(import.meta.url).pathname);
  const rates = JSON.parse(fs.readFileSync(path.join(here, 'rates.json'), 'utf8'));
  const rowsBy = {};
  for (const mk of Object.keys(MARKETS)) rowsBy[mk] = JSON.parse(fs.readFileSync(path.join(dir, `${mk}.json`), 'utf8')).rows;
  const { T, info, v } = runAll(rowsBy, rates.DGS2);
  for (const k of Object.keys(T)) console.log(k, 'dec', JSON.stringify(T[k].dec), 'rep', JSON.stringify(T[k].rep), 'placebo', T[k].placebo.beaten, T[k].placebo.median, T[k].placebo.p95, 'counts', JSON.stringify(T[k].counts));
  const out = { built: '2026-11-14', study: 'opex-week', title: 'The monthly options-expiry week on US indices, out of sample', verdict: v.verdict, passed: v.passed, checks: v.checks,
    data: { src: 'OANDA mid daily candles, council-data research/daily (b10aea762, last candle 2026-11-06), weekend stubs folded (council/fills.mjs foldWeekend); close = 00:00 UTC, not the NYSE close; 2-year yield FRED DGS2 weekly (rates.json)',
      markets: info, spreadPts: Object.fromEntries(Object.entries(MARKETS).map(([k, m]) => [k, m.pts])), financing: `long pays DGS2 + ${FIN_ADD}% a year, short pays max(0, ${FIN_ADD}% - DGS2), calendar nights`,
      stop: `${STOP_ATR} x ATR(${ATR_N}) daily, gap fill`, windows: { decisive: DEC, replication: REP } },
    labels: LABEL, tests: T };
  fs.writeFileSync(path.join(here, 'result.json'), JSON.stringify(out, null, 1) + '\n');
  console.log(v.verdict, JSON.stringify(v.checks));
}
