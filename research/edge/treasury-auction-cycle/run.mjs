// The Treasury auction cycle in bond CFD prices (pre-registered: PREREGISTRATION.md, pushed alone first, 14 Nov 2026).
// T1: short the 10-year note CFD from the close 5 US trading days before the (rule-derived) 10-year auction to the auction
// day's close; stop 1.5 x ATR(20). Reported only: the long after it, and the same on the 30-year and 5-year CFDs.
//   node research/edge/treasury-auction-cycle/run.mjs fetch <dir>   (git show from origin/council-data, no network; out of git)
//   node research/edge/treasury-auction-cycle/run.mjs full <dir>    (writes result.json beside this file)
// Research only: nothing live reads this file.
import fs from 'node:fs';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { usHolidays } from '../../../council/datacheck.mjs';

const HERE = path.dirname(fileURLToPath(import.meta.url));
export const ATR_N = 20, STOP_ATR = 1.5, HOLD = 5, FIN_YEAR = 0.03, SEEDS = 40, FROM_YEAR = 2009, SHIFT_MAX = 10;
export const MARKETS = {
  usb10y: { label: 'US 10-year note (USB10Y)', cost: 0.0003, auction: 'a10', fut: { root: 'ZN', pts: 1 / 64 + 0.0037 } },
  usb30y: { label: 'US 30-year bond (USB30Y)', cost: 0.0005, auction: 'a30', fut: { root: 'ZB', pts: 1 / 32 + 0.0037 } },
  usb05y: { label: 'US 5-year note (USB05Y)', cost: 0.0003, auction: 'a5', fut: { root: 'ZF', pts: 1 / 128 + 0.0037 } },
};
// streams: market, side, window relative to the auction day index A (entry close, exit close)
export const STREAMS = {
  T1: { market: 'usb10y', side: -1, from: -HOLD, to: 0, judged: true, what: 'short 10-year, A10-5 close to A10 close' },
  L10: { market: 'usb10y', side: 1, from: 0, to: HOLD, what: 'long 10-year, A10 close to A10+5 close' },
  S30: { market: 'usb30y', side: -1, from: -HOLD, to: 0, what: 'short 30-year, A30-5 close to A30 close' },
  L30: { market: 'usb30y', side: 1, from: 0, to: HOLD, what: 'long 30-year, A30 close to A30+5 close' },
  S5: { market: 'usb05y', side: -1, from: -HOLD, to: 0, what: 'short 5-year, A5-5 close to A5 close' },
  L5: { market: 'usb05y', side: 1, from: 0, to: HOLD, what: 'long 5-year, A5 close to A5+5 close' },
};

// ─── US bond-market trading days (copied unchanged from research/edge/bond-month-end/run.mjs, branch bond-month-end) ───
const iso = (ms) => new Date(ms).toISOString().slice(0, 10);
const SPECIAL = new Set(['2004-06-11', '2007-01-02', '2012-10-29', '2012-10-30', '2018-12-05', '2025-01-09']);
const HOLCACHE = new Map();
export function usBondHolidays(y) {
  if (HOLCACHE.has(y)) return HOLCACHE.get(y);
  const s = new Set();
  for (const d of usHolidays(y).keys()) if (+d.slice(0, 4) === y) s.add(d);
  const nov1 = new Date(Date.UTC(y, 10, 1)).getUTCDay(), thanks = 1 + ((4 - nov1 + 7) % 7) + 21;
  s.delete(iso(Date.UTC(y, 10, thanks + 1)));
  if (new Date(Date.UTC(y, 11, 25)).getUTCDay() !== 6) s.delete(`${y}-12-24`);
  if (y < 2022) for (const d of [...s]) if (d.slice(5, 7) === '06' && +d.slice(8) >= 18 && +d.slice(8) <= 20) s.delete(d);
  const oct1 = new Date(Date.UTC(y, 9, 1)).getUTCDay(); s.add(iso(Date.UTC(y, 9, 1 + ((1 - oct1 + 7) % 7) + 7)));
  const v = new Date(Date.UTC(y, 10, 11)).getUTCDay(); s.add(iso(Date.UTC(y, 10, 11 + (v === 6 ? -1 : v === 0 ? 1 : 0))));
  for (const d of SPECIAL) if (+d.slice(0, 4) === y) s.add(d);
  HOLCACHE.set(y, s); return s;
}
export function isUsTradingDay(ymd) {
  const w = new Date(ymd + 'T00:00:00Z').getUTCDay();
  return w >= 1 && w <= 5 && !usBondHolidays(+ymd.slice(0, 4)).has(ymd);
}
export function calendar(from, to) {
  const out = []; for (let t = Date.parse(from + 'T00:00:00Z'), e = Date.parse(to + 'T00:00:00Z'); t <= e; t += 86400e3) { const d = iso(t); if (isUsTradingDay(d)) out.push(d); }
  return out;
}

// ─── the auction date rule (pre-registered) ───
// weekday wd (0 Sun .. 6 Sat) falling on day `lo` to `lo + 6` of the month; a non-trading day moves to the previous trading day
export function weekdayIn(y, m, wd, lo) {
  const dow = new Date(Date.UTC(y, m - 1, lo)).getUTCDay();
  return iso(Date.UTC(y, m - 1, lo + ((wd - dow + 7) % 7)));
}
export function auctionDay(kind, y, m) {
  const plain = kind === 'a10' ? weekdayIn(y, m, 3, 7) : kind === 'a30' ? weekdayIn(y, m, 4, 8) : weekdayIn(y, m, 3, 21);
  let t = Date.parse(plain + 'T00:00:00Z');
  while (!isUsTradingDay(iso(t))) t -= 86400e3;
  return { d: iso(t), plain, moved: iso(t) !== plain };
}
// known dates: two from the Forex Factory calendar in council-data macro/cache.json; the rest written FROM MEMORY, not opened
export const KNOWN = [
  { kind: 'a10', d: '2026-11-10', src: 'council-data macro/cache.json (Forex Factory calendar, "10-y Bond Auction", USD, 18:01 UTC)' },
  { kind: 'a30', d: '2026-11-12', src: 'council-data macro/cache.json (Forex Factory calendar, "30-y Bond Auction", USD, 18:01 UTC)' },
  ...['2024-02-07', '2024-03-12', '2024-04-10', '2024-05-08', '2024-06-11', '2024-07-10', '2024-08-07', '2024-09-11', '2024-10-09', '2024-11-13']
    .map((d) => ({ kind: 'a10', d, src: 'from memory, not opened' })),
];
export function tdDiff(a, b) { // trading days from a to b (b later = positive)
  if (a === b) return 0; const s = a < b ? 1 : -1, [x, y] = s > 0 ? [a, b] : [b, a];
  return s * (calendar(x, y).length - (isUsTradingDay(x) ? 1 : 0));
}

// ─── bars (weekend / holiday candles folded into the next trading day; as bond-month-end) ───
export function buildDays(rows, days) {
  const byD = new Map(rows.map((r, i) => [iso(r[0] * 1000), i]));
  const D = []; let ri = 0;
  for (const d of days) {
    const own = byD.get(d), end = Date.parse(d + 'T00:00:00Z') / 1000;
    const from = ri; while (ri < rows.length && rows[ri][0] <= end) ri++;
    if (own == null) { D.push({ d, c: null, ri: null }); continue; }
    const seg = rows.slice(from, ri);
    D.push({ d, t: rows[own][0], o: seg[0][1], h: Math.max(...seg.map((r) => r[2])), l: Math.min(...seg.map((r) => r[3])), c: rows[own][4], ri: own });
  }
  return D;
}
export function atrAt(D, k, n = ATR_N) {
  if (k < n) return null; let s = 0;
  for (let j = k - n + 1; j <= k; j++) { const x = D[j], p = D[j - 1]; if (x.c == null || p.c == null) return null; s += Math.max(x.h - x.l, Math.abs(x.h - p.c), Math.abs(x.l - p.c)); }
  return s / n;
}
const nights = (a, b) => Math.round((Date.parse(b + 'T00:00:00Z') - Date.parse(a + 'T00:00:00Z')) / 86400e3);

// one trade: entry at the close of D[e], exit at the close of D[x]; side +1 long, -1 short; the stop on every raw candle after entry
export function trade(rows, D, e, x, side, cost) {
  const E = D[e], X = D[x]; if (!E || !X || E.c == null || X.c == null) return null;
  const atr = atrAt(D, e); if (atr == null || !(atr > 0)) return null;
  const entry = E.c, dist = STOP_ATR * atr, stop = entry - side * dist;
  let exit = X.c, how = 'time', exitD = X.d;
  for (let i = E.ri + 1; i <= X.ri; i++) {
    const r = rows[i];
    if (side > 0 ? r[1] <= stop : r[1] >= stop) { exit = r[1]; how = 'gap'; exitD = iso(r[0] * 1000); break; }
    if (side > 0 ? r[3] <= stop : r[2] >= stop) { exit = stop; how = 'stop'; exitD = iso(r[0] * 1000); break; }
  }
  const n = nights(E.d, exitD);
  return { entryD: E.d, exitD, entry, stop: +stop.toFixed(5), dist, exit, how, nights: n, side,
    gross: side * (exit - entry) / dist, costR: cost * entry / dist, finR: FIN_YEAR / 365 * n * entry / dist };
}
export const netOf = (t, mult = 1) => t.gross - mult * (t.costR + t.finR);
export const futNetOf = (t, pts, mult = 1) => t.gross - mult * pts / t.dist;

// ─── statistics (as bond-month-end) ───
export function stats(xs) {
  const n = xs.length; if (!n) return { n: 0, mean: null, sd: null, t: null };
  const mean = xs.reduce((a, b) => a + b, 0) / n, sd = n > 1 ? Math.sqrt(xs.reduce((a, b) => a + (b - mean) ** 2, 0) / (n - 1)) : 0;
  return { n, mean, sd, t: sd > 0 ? mean / (sd / Math.sqrt(n)) : null };
}
export function rng(seed) { let a = seed >>> 0; return () => { a = (a + 0x6D2B79F5) >>> 0; let t = a; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; }
const r3 = (x) => x == null ? null : +x.toFixed(3), r2 = (x) => x == null ? null : +x.toFixed(2);
const yr = (d) => +d.slice(0, 4);
// calendar-month sums: one value per month that has a trade (month of the auction)
export function monthSums(ts, f) { const m = new Map(); for (const t of ts) m.set(t.month, (m.get(t.month) || 0) + f(t)); return [...m.values()]; }
function summ(ts, f = (t) => netOf(t)) {
  const s = stats(monthSums(ts, f)), g = stats(monthSums(ts, (t) => t.gross));
  return { n: s.n, net: r3(s.mean), t: r2(s.t), gross: r3(g.mean), tGross: r2(g.t), win: s.n ? r2(100 * ts.filter((t) => f(t) > 0).length / ts.length) : null,
    stops: ts.filter((t) => t.how !== 'time').length, gapStops: ts.filter((t) => t.how === 'gap').length, total: r2(ts.reduce((a, t) => a + f(t), 0)) };
}

export function prep(json) {
  const rows = json.rows.filter((r) => r.every(Number.isFinite));
  const first = iso(rows[0][0] * 1000), last = iso(rows.at(-1)[0] * 1000);
  const days = calendar(first, iso(Date.parse(last + 'T00:00:00Z') + 40 * 86400e3)), D = buildDays(rows, days);
  return { rows, first, last, D, idx: new Map(D.map((x, i) => [x.d, i])) };
}
// the months of the test: January FROM_YEAR to the last month whose trade has its exit candle on file
export function monthsOf(P, kind, from, to) {
  const out = []; const [ly, lm] = P.last.split('-').map(Number);
  for (let y = FROM_YEAR; y <= ly; y++) for (let m = 1; m <= 12; m++) {
    if (y === ly && m > lm) break;
    const a = auctionDay(kind, y, m), ai = P.idx.get(a.d); if (ai == null) continue;
    const xi = ai + to; if (xi >= P.D.length || P.D[xi].d > P.last) continue;
    out.push({ month: `${y}-${String(m).padStart(2, '0')}`, a, ai, e: ai + from, x: xi });
  }
  return out;
}
export function streamTrades(P, S, shift = 0) {
  const M = MARKETS[S.market], out = [], skipped = [];
  for (const mo of monthsOf(P, M.auction, S.from + shift, S.to + shift)) {
    const t = trade(P.rows, P.D, mo.e, mo.x, S.side, M.cost);
    if (t) out.push({ ...t, month: mo.month, auction: mo.a.d, moved: mo.a.moved }); else skipped.push(mo.month);
  }
  return { trades: out, skipped };
}
export function placebo(P, counts, side, cost, seed) {
  const R = rng(seed), elig = {};
  for (let e = 0; e + HOLD < P.D.length; e++) { const y = yr(P.D[e].d); if (!(y in counts) || P.D[e + HOLD].d > P.last) continue; const t = trade(P.rows, P.D, e, e + HOLD, side, cost); if (t) (elig[y] ||= []).push(t); }
  const nets = [];
  for (const [y, n] of Object.entries(counts)) { const pool = elig[y] || []; for (let i = 0; i < n && pool.length; i++) nets.push(netOf(pool[Math.floor(R() * pool.length)])); }
  return stats(nets).mean;
}

export function runStream(key, P) {
  const S = STREAMS[key], M = MARKETS[S.market], all = streamTrades(P, S);
  const ts = all.trades, half = Math.floor(ts.length / 2);
  // the split is by months of the test (first floor(N / 2) months in sample); with no skipped month it equals the trade split
  const months = monthsOf(P, M.auction, S.from, S.to).map((x) => x.month), cut = months[Math.floor(months.length / 2)];
  const is = ts.filter((t) => t.month < cut), oos = ts.filter((t) => t.month >= cut);
  const counts = {}; for (const t of oos) counts[yr(t.month)] = (counts[yr(t.month)] || 0) + 1;
  const pl = []; for (let s = 1; s <= SEEDS; s++) pl.push(placebo(P, counts, S.side, M.cost, s));
  const oosMean = stats(oos.map((t) => netOf(t))).mean, sorted = [...pl].sort((a, b) => a - b);
  const shifts = [];
  for (let s = -SHIFT_MAX; s <= SHIFT_MAX; s++) {
    const w = streamTrades(P, S, s).trades, wo = w.filter((t) => t.month >= cut), wi = w.filter((t) => t.month < cut);
    shifts.push({ shift: s, oos: (({ n, net, t, gross }) => ({ n, net, t, gross }))(summ(wo)), is: (({ n, net, t }) => ({ n, net, t }))(summ(wi)) });
  }
  const perYear = {}; for (const t of ts) (perYear[yr(t.month)] ||= []).push(t);
  return {
    stream: key, what: S.what, market: S.market, label: M.label, side: S.side > 0 ? 'long' : 'short', judged: !!S.judged, costPct: M.cost * 100,
    months: months.length, firstMonth: months[0], lastMonth: months.at(-1), oosFrom: cut, half,
    datesMoved: ts.filter((t) => t.moved).length,
    inSample: summ(is), outOfSample: summ(oos), all: summ(ts),
    cost: Object.fromEntries([0, 1, 2].map((m) => [`x${m}`, { inSample: (({ n, net, t }) => ({ n, net, t }))(summ(is, (t) => netOf(t, m))), outOfSample: (({ n, net, t }) => ({ n, net, t }))(summ(oos, (t) => netOf(t, m))) }])),
    futures: { root: M.fut.root, roundTripPts: +M.fut.pts.toFixed(6), costR: r3(stats(oos.map((t) => M.fut.pts / t.dist)).mean),
      ...Object.fromEntries([0, 1, 2].map((m) => [`x${m}`, { inSample: (({ n, net, t }) => ({ n, net, t }))(summ(is, (t) => futNetOf(t, M.fut.pts, m))), outOfSample: (({ n, net, t }) => ({ n, net, t }))(summ(oos, (t) => futNetOf(t, M.fut.pts, m))) }])) },
    placebo: { seeds: SEEDS, means: pl.map(r3), median: r3(sorted[19] / 2 + sorted[20] / 2), p95: r3(sorted[37] + (sorted[38] - sorted[37]) * 0.05), beaten: pl.filter((p) => oosMean > p).length, ruleMean: r3(oosMean) },
    shiftMinus5: shifts.find((x) => x.shift === -5), shiftPlus5: shifts.find((x) => x.shift === 5), shifts,
    rankOfZero: 1 + shifts.filter((x) => x.shift !== 0 && x.oos.net > shifts.find((y) => y.shift === 0).oos.net).length,
    perYear: Object.fromEntries(Object.entries(perYear).map(([y, a]) => [y, { n: a.length, net: r3(stats(a.map((t) => netOf(t))).mean), total: r2(a.reduce((s, t) => s + netOf(t), 0)) }])),
    skipped: all.skipped,
    trades: ts.map((t) => [t.month, t.auction, t.entryD, t.exitD, +t.entry.toFixed(4), t.stop, +t.exit.toFixed(4), t.how, r3(t.gross), r3(netOf(t))]),
  };
}

export function verdictOf(T) {
  const c = { oosT2: T.outOfSample.t != null && T.outOfSample.t >= 2, isPositive: T.inSample.net > 0, oosPositive2x: T.cost.x2.outOfSample.net > 0, placebo95: T.placebo.beaten >= 38 };
  return { checks: c, verdict: Object.values(c).every(Boolean) ? 'PASS' : 'FAIL' };
}
export function dateCheck() {
  return KNOWN.map((k) => { const [y, m] = k.d.split('-').map(Number), a = auctionDay(k.kind, y, m); return { kind: k.kind, known: k.d, rule: a.d, diffTradingDays: tdDiff(k.d, a.d), src: k.src }; });
}
export function dateTally(from = FROM_YEAR, to = 2026, toMonth = 10) {
  const out = {};
  for (const kind of ['a10', 'a30', 'a5']) { let n = 0, moved = 0; for (let y = from; y <= to; y++) for (let m = 1; m <= 12; m++) { if (y === to && m > toMonth) break; n++; if (auctionDay(kind, y, m).moved) moved++; } out[kind] = { months: n, plainWeekday: n - moved, movedByHoliday: moved }; }
  return out;
}

function fetchAll(dir) {
  fs.mkdirSync(dir, { recursive: true });
  for (const k of Object.keys(MARKETS)) fs.writeFileSync(path.join(dir, `${k}.json`), execFileSync('git', ['show', `origin/council-data:research/daily/${k}.json`], { maxBuffer: 1 << 28 }));
  console.log('wrote', dir);
}
function full(dir) {
  const P = {}; for (const k of Object.keys(MARKETS)) P[k] = prep(JSON.parse(fs.readFileSync(path.join(dir, `${k}.json`), 'utf8')));
  const S = {}; for (const k of Object.keys(STREAMS)) S[k] = runStream(k, P[STREAMS[k].market]);
  const V = verdictOf(S.T1);
  const out = { study: 'treasury-auction-cycle', built: '2026-11-14', verdict: V.verdict, checks: V.checks,
    rule: 'short usb10y from the close 5 US trading days before the rule-derived 10-year auction to the auction close; stop 1.5 x ATR(20); costs + 3 % a year financing',
    dates: { rule: 'A10 = Wednesday on the 7th-13th, A30 = Thursday on the 8th-14th, A5 = Wednesday on the 21st-27th; a non-trading day moves to the previous US trading day; from January 2009',
      officialSource: 'not reachable (treasurydirect.gov and api.fiscaldata.treasury.gov refused by the session proxy, 14 Nov 2026)',
      check: dateCheck(), tally: dateTally(), verified: 2 },
    data: Object.fromEntries(Object.entries(P).map(([k, p]) => [k, { first: p.first, last: p.last }])),
    streams: S };
  fs.writeFileSync(path.join(HERE, 'result.json'), JSON.stringify(out, null, 1) + '\n');
  for (const k of Object.keys(S)) { const s = S[k]; console.log(k, 'IS', JSON.stringify(s.inSample), 'OOS', JSON.stringify(s.outOfSample), 'x2', JSON.stringify(s.cost.x2.outOfSample), 'fut', JSON.stringify(s.futures.x1.outOfSample), 'pl', s.placebo.p95, s.placebo.beaten, 'sh-5', JSON.stringify(s.shiftMinus5.oos), 'sh+5', JSON.stringify(s.shiftPlus5.oos), 'rank', s.rankOfZero); }
  console.log(JSON.stringify(out.dates.check), JSON.stringify(out.dates.tally));
  console.log(JSON.stringify(V));
}

if (process.argv[1] && fileURLToPath(import.meta.url) === path.resolve(process.argv[1])) {
  const [cmd, dir] = process.argv.slice(2);
  if (cmd === 'fetch') fetchAll(dir); else if (cmd === 'full') full(dir); else console.log('usage: run.mjs fetch|full <dir>');
}
