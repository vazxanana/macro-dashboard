// Edge research · index-quarter-end: the quarter-end rebalancing flow on US500 (PREREGISTRATION.md).
// At the close of the quarter's sixth-to-last NYSE trading day (E), the SPX500-minus-USB10Y price return since the previous
// quarter's last trading day (P) decides the side: stocks beat bonds -> SELL, bonds beat stocks -> BUY; exit at the quarter's last
// close (X). Stop 1.5 x ATR(20) daily with gap fill; spread 0.0003 x entry and financing in R. In sample = first half of the
// quarters, out of sample = the rest; event t; 40-seed placebo of random 5-day windows with the same direction rule.
//   node research/edge/index-quarter-end/run.mjs <candleDir>   (spx500, nas100, us30, de40, usb10y .json from council-data
//                                                                research/daily; writes result.json beside this file)
// The calendar, fold, ATR, financing and statistics code is copied from research/edge/rebalance-flow (branch rebalance-flow).
import fs from 'node:fs';
import path from 'node:path';
import { cmeYear } from '../../../ict/calendar.mjs';

export const MARKETS = { spx500: 'S&P 500 (SPX500)', nas100: 'Nasdaq 100 (NAS100)', us30: 'Dow 30 (US30)', de40: 'DAX (DE40, DE30_EUR)' };
export const PRIMARY = 'spx500';
export const COST = 0.0003, FIN_ADD = 2.5, ATR_N = 20, STOP_ATR = 1.5, HOLD = 5, NEXT = 3, SEEDS = 40, SEEDS_NEED = 38;
export const FIRST_Q = '2003-Q2', LAST_Q = '2026-Q3';
export const SPECIAL = new Set(['2007-01-02', '2012-10-29', '2012-10-30', '2018-12-05', '2025-01-09']);
const NYSE_FROM_EARLY = new Set(['Martin Luther King Day', "Presidents' Day", 'Memorial Day', 'Juneteenth', 'Independence Day', 'Labor Day', 'Thanksgiving Day']);

export const ymdOf = (sec) => new Date(sec * 1000).toISOString().slice(0, 10);
export function isTradingDay(ymd) {
  const wd = new Date(ymd + 'T12:00:00Z').getUTCDay();
  if (wd === 0 || wd === 6 || SPECIAL.has(ymd)) return false;
  const Y = cmeYear(+ymd.slice(0, 4));
  if (Y.full.has(ymd)) return false;
  const e = Y.early.get(ymd);
  return !(e && NYSE_FROM_EARLY.has(e.name));
}
// quarters as 'YYYY-Qn'
export const addQ = (q, k) => { const y = +q.slice(0, 4), n = y * 4 + (+q.slice(6) - 1) + k; return `${Math.floor(n / 4)}-Q${n % 4 + 1}`; };
export function quarters(from = FIRST_Q, to = LAST_Q) { const out = []; for (let q = from; q <= to; q = addQ(q, 1)) out.push(q); return out; }
// the NYSE trading days of a quarter, in order
export function quarterDays(q) {
  const y = +q.slice(0, 4), m0 = (+q.slice(6) - 1) * 3, out = [];
  for (let t = Date.UTC(y, m0, 1); new Date(t).getUTCMonth() < m0 + 3 && new Date(t).getUTCFullYear() === y; t += 86400e3) {
    const s = ymdOf(t / 1000); if (isTradingDay(s)) out.push(s);
  }
  return out;
}

// rows [t, o, h, l, c, v] -> folded weekday candles { d, o, h, l, c }
export function fold(rows) {
  const out = []; let pend = null;
  for (const r of rows) {
    const d = ymdOf(r[0]), wd = new Date(r[0] * 1000).getUTCDay();
    if (wd === 0 || wd === 6) { pend = pend ? { o: pend.o, h: Math.max(pend.h, r[2]), l: Math.min(pend.l, r[3]) } : { o: r[1], h: r[2], l: r[3] }; continue; }
    const b = { d, o: r[1], h: r[2], l: r[3], c: r[4] };
    if (pend) { b.o = pend.o; b.h = Math.max(b.h, pend.h); b.l = Math.min(b.l, pend.l); pend = null; }
    out.push(b);
  }
  return out;
}
export function atrAt(B, k, n = ATR_N) {
  if (k - n < 0) return null;
  let s = 0;
  for (let j = k - n + 1; j <= k; j++) { const a = B[j], p = B[j - 1]; s += Math.max(a.h - a.l, Math.abs(a.h - p.c), Math.abs(a.l - p.c)); }
  return s / n;
}
// last weekly DGS2 on or before the date; before the first value, the first value (stated in the pre-registration)
export function rateOf(dgs2) {
  return (ymd) => { let v = dgs2[0][1]; for (const [d, x] of dgs2) { if (d > ymd) break; v = x; } return v; };
}
export const nights = (a, b) => Math.round((Date.parse(b + 'T12:00:00Z') - Date.parse(a + 'T12:00:00Z')) / 86400e3);

// one trade at three cost levels: side +1 buy / -1 sell, entry at the close of date sD, exit at the close of xD unless stopped
export function trade(B, idx, sD, xD, side, rate) {
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
  const r = rate(sD), n = nights(sD, exitD);
  const finCash = (side > 0 ? -(r + FIN_ADD) : (r - FIN_ADD)) / 100 / 365 * n * entry;   // + = received
  const gross = side * (exit - entry) / risk, costR = COST * entry / risk, finR = finCash / risk;
  return { sD, exitD, side, entry, stop, risk, exit, how, nights: n, gross, costR, finR, net: gross - costR + finR, net2: gross - 2 * costR + finR };
}

// stocks minus bonds price return from date a to date b (null when a candle is missing)
export function diffOf(Beq, Ieq, Bbd, Ibd, a, b) {
  const i = Ieq.get(a), j = Ieq.get(b), k = Ibd.get(a), l = Ibd.get(b);
  if ([i, j, k, l].some((v) => v == null)) return null;
  return (Beq[j].c / Beq[i].c - 1) - (Bbd[l].c / Bbd[k].c - 1);
}
export const sideOf = (diff) => diff == null || diff === 0 ? 0 : diff > 0 ? -1 : 1;

export function stats(xs) {
  const n = xs.length; if (!n) return { n: 0, mean: null, sd: null, t: null };
  const mean = xs.reduce((a, b) => a + b, 0) / n, sd = n > 1 ? Math.sqrt(xs.reduce((a, b) => a + (b - mean) ** 2, 0) / (n - 1)) : 0;
  return { n, mean, sd, t: sd > 0 ? mean / (sd / Math.sqrt(n)) : null };
}
export function rng(seed) { let a = seed >>> 0; return () => { a = (a + 0x6D2B79F5) >>> 0; let t = a; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; }

const r3 = (x) => x == null ? null : +x.toFixed(3), r2 = (x) => x == null ? null : +x.toFixed(2);
export function summ(ts) {
  const s = stats(ts.map((t) => t.net)), g = stats(ts.map((t) => t.gross)), s2 = stats(ts.map((t) => t.net2));
  return { n: s.n, net: r3(s.mean), t: r2(s.t), sd: r3(s.sd), gross: r3(g.mean), tGross: r2(g.t), net2x: r3(s2.mean), t2x: r2(s2.t),
    win: s.n ? r2(100 * ts.filter((t) => t.net > 0).length / s.n) : null, stops: ts.filter((t) => t.how !== 'time').length,
    total: r2(ts.reduce((a, t) => a + t.net, 0)), cost: r3(s.n ? ts.reduce((a, t) => a + t.costR, 0) / s.n : null),
    fin: r3(s.n ? ts.reduce((a, t) => a + t.finR, 0) / s.n : null), buys: ts.filter((t) => t.side > 0).length, sells: ts.filter((t) => t.side < 0).length,
    needT2: s.n > 1 ? r3(2 * s.sd / Math.sqrt(s.n)) : null };
}

// split of the fixed quarter list: first half in sample, the rest out of sample
export function split(qs) { const h = Math.floor(qs.length / 2); return { is: new Set(qs.slice(0, h)), oos: new Set(qs.slice(h)) }; }

export function prepare(files) {
  const F = {}; for (const [k, rows] of Object.entries(files)) { const B = fold(rows); F[k] = { B, idx: new Map(B.map((b, i) => [b.d, i])) }; }
  return F;
}

// the rule's trades (quarter-end, kind 'qe') or the next-quarter reading (kind 'next') on one market
export function ruleTrades(F, mk, rate, kind = 'qe', qs = quarters()) {
  const eq = F.spx500, bd = F.usb10y, M = F[mk], out = [], counts = { noDiff: 0, flat: 0, noCandle: 0 };
  for (const q of qs) {
    const days = quarterDays(q), P = quarterDays(addQ(q, -1)).at(-1), X = days.at(-1);
    const E = kind === 'qe' ? days.at(-1 - HOLD) : X, exit = kind === 'qe' ? X : quarterDays(addQ(q, 1))[NEXT - 1];
    const d = diffOf(eq.B, eq.idx, bd.B, bd.idx, P, E), s = sideOf(d);
    if (d == null) { counts.noDiff++; continue; }
    if (!s) { counts.flat++; continue; }
    const t = trade(M.B, M.idx, E, exit, s, rate);
    if (!t) { counts.noCandle++; continue; }
    out.push({ q, diff: d, ...t });
  }
  return { trades: out, counts };
}

// placebo: per seed and out-of-sample quarter, a random 5-trading-day window ending no later than the rule's entry E
export function placebo(F, mk, rate, oosQs) {
  const eq = F.spx500, bd = F.usb10y, M = F[mk], seeds = { zero: [], base: [], x2: [] };
  for (let s = 1; s <= SEEDS; s++) {
    const R = rng(s), ts = [];
    for (const q of oosQs) {
      const days = quarterDays(q), P = quarterDays(addQ(q, -1)).at(-1), eIdx = days.length - 1 - HOLD;
      const k = Math.floor(R() * (eIdx - HOLD + 1));   // entry index 0 .. eIdx - HOLD, so the exit index k + HOLD <= eIdx
      const sD = days[k], xD = days[k + HOLD], side = sideOf(diffOf(eq.B, eq.idx, bd.B, bd.idx, P, sD));
      if (!side) continue;
      const t = trade(M.B, M.idx, sD, xD, side, rate);
      if (t) ts.push(t);
    }
    seeds.zero.push(r3(stats(ts.map((t) => t.gross)).mean));
    seeds.base.push(r3(stats(ts.map((t) => t.net)).mean));
    seeds.x2.push(r3(stats(ts.map((t) => t.net2)).mean));
  }
  return seeds;
}
const rank = (v, xs) => xs.filter((m) => v > m).length;
const pct = (xs, p) => { const s = [...xs].sort((a, b) => a - b); return s[Math.ceil(p * s.length) - 1]; };

export function runMarket(F, mk, rate, qs = quarters()) {
  const { is, oos } = split(qs);
  const rt = ruleTrades(F, mk, rate, 'qe', qs), nx = ruleTrades(F, mk, rate, 'next', qs);
  const part = (ts, set) => ts.filter((t) => set.has(t.q));
  const IS = part(rt.trades, is), OOS = part(rt.trades, oos);
  const pl = placebo(F, mk, rate, qs.filter((q) => oos.has(q)));
  const o = summ(OOS), g = stats(OOS.map((t) => t.gross)).mean, n2 = stats(OOS.map((t) => t.net2)).mean, nb = stats(OOS.map((t) => t.net)).mean;
  return {
    is: summ(IS), oos: o, counts: rt.counts,
    bySide: { is: { buy: summ(IS.filter((t) => t.side > 0)), sell: summ(IS.filter((t) => t.side < 0)) }, oos: { buy: summ(OOS.filter((t) => t.side > 0)), sell: summ(OOS.filter((t) => t.side < 0)) } },
    byYear: Object.fromEntries([...new Set(rt.trades.map((t) => t.q.slice(0, 4)))].map((y) => [y, r2(rt.trades.filter((t) => t.q.startsWith(y)).reduce((a, t) => a + t.net, 0))])),
    placebo: {
      seeds: pl, need: SEEDS_NEED,
      beaten: { zero: rank(r3(g), pl.zero), base: rank(r3(nb), pl.base), x2: rank(r3(n2), pl.x2) },
      median: { zero: pct(pl.zero, 0.5), base: pct(pl.base, 0.5), x2: pct(pl.x2, 0.5) },
      p95: { zero: pct(pl.zero, 0.95), base: pct(pl.base, 0.95), x2: pct(pl.x2, 0.95) },
    },
    next: { is: summ(part(nx.trades, is)), oos: summ(part(nx.trades, oos)), counts: nx.counts },
    trades: rt.trades.map((t) => [t.q, t.sD, t.exitD, t.side, t.how, r3(t.diff * 100), r3(t.gross), r3(t.net)]),
  };
}

export function verdictOf(m) {
  const c = { oosT: m.oos.t != null && m.oos.t >= 2, isNet: m.is.net > 0, oos2x: m.oos.net2x > 0, placebo: m.placebo.beaten.base >= SEEDS_NEED };
  return { verdict: Object.values(c).every(Boolean) ? 'PASS' : 'FAIL', checks: c };
}

export function runAll(files, dgs2) {
  const F = prepare(files), rate = rateOf(dgs2), qs = quarters(), { is, oos } = split(qs), M = {};
  for (const mk of Object.keys(MARKETS)) if (F[mk]) M[mk] = runMarket(F, mk, rate, qs);
  return { M, v: verdictOf(M[PRIMARY]), windows: { is: [[...is][0], [...is].at(-1)], oos: [[...oos][0], [...oos].at(-1)], quarters: qs.length } };
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const dir = process.argv[2]; if (!dir) throw new Error('usage: node run.mjs <candleDir>');
  const here = path.dirname(new URL(import.meta.url).pathname);
  const rates = JSON.parse(fs.readFileSync(path.join(here, 'rates.json'), 'utf8'));
  const files = {}, meta = {};
  for (const k of [...Object.keys(MARKETS), 'usb10y']) { const j = JSON.parse(fs.readFileSync(path.join(dir, k + '.json'), 'utf8')); files[k] = j.rows; meta[k] = { inst: j.inst || j.sym, updated: j.updated, rows: j.rows.length, from: ymdOf(j.rows[0][0]), to: ymdOf(j.rows.at(-1)[0]) }; }
  const { M, v, windows } = runAll(files, rates.DGS2);
  for (const [k, m] of Object.entries(M)) console.log(k, 'IS', JSON.stringify(m.is), '\n  OOS', JSON.stringify(m.oos), '\n  placebo', JSON.stringify(m.placebo.beaten), JSON.stringify(m.placebo.median), JSON.stringify(m.placebo.p95), '\n  next', JSON.stringify(m.next.oos), m.counts);
  const out = { built: '2026-11-14', study: 'index-quarter-end', title: 'Quarter-end rebalancing flow on US500, by the quarter\'s stock-minus-bond return',
    system: 'US500 CFD (OANDA SPX500_USD), daily', verdict: v.verdict, checks: v.checks, windows,
    data: { src: 'OANDA mid daily candles, council-data research/daily (commit 147124a93), weekend candles folded into the next weekday; 2-year yield FRED DGS2 weekly (rates.json)', files: meta,
      cost: `${COST} x entry a round trip (2x = ${2 * COST})`, financing: `buy pays DGS2 + ${FIN_ADD}% a year, sell receives DGS2 - ${FIN_ADD}% a year, calendar nights`,
      signal: 'SPX500 minus USB10Y price return from the previous quarter\'s last NYSE trading day to the quarter\'s sixth-to-last; > 0 sell, < 0 buy',
      hold: `close of TD-6 to close of TD-1 (${HOLD} trading days)`, stop: `${STOP_ATR} x ATR(${ATR_N}) daily, gap fill` },
    markets: M };
  fs.writeFileSync(path.join(here, 'result.json'), JSON.stringify(out, null, 1) + '\n');
  console.log(v.verdict, JSON.stringify(v.checks), JSON.stringify(windows));
}
