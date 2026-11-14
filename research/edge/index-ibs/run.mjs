// Edge research · index-ibs: the "internal bar strength" daily reversal on SPX500, NAS100 and US30 (PREREGISTRATION.md).
// IBS = (close - low) / (high - low) of the New York cash session (the H1 candles of 09:00 to the 16:00 close, New York time,
// DST read with the zone). IBS < 0.2 -> buy the 16:00 close, sell the next trading day's close; stop 1 x ATR(20) below the
// entry, checked on H1 (a gap fills at the open); costs and rollover financing (Friday three). Tests on 2016-now: T1-T3 per
// market (Holm over three) and one pooled test; replication 2005-15; 40-seed placebo of random days. Mirror (IBS > 0.8 short)
// reported only.
// Calendar, close candle, day building, ATR and statistics code copied from turnaround-tuesday (branch turnaround-tuesday,
// not on main); the rollover count is the form of council/fills.mjs `nights`, copied, with Friday counting three.
//   node research/edge/index-ibs/run.mjs <candleDir>   (the files fetch.mjs wrote; writes result.json and RESULT.md)
import fs from 'node:fs';
import path from 'node:path';
import zlib from 'node:zlib';
import { nyParts, cmeYear } from '../../../ict/calendar.mjs';

export const MARKETS = {
  spx500: { test: 'T1', name: 'S&P 500 (SPX500)', cost: 0.0004 },
  nas100: { test: 'T2', name: 'Nasdaq 100 (NAS100)', cost: 0.0005 },
  us30: { test: 'T3', name: 'Dow 30 (US30)', cost: 0.0005 },
};
export const LO = 0.2, HI = 0.8;                 // long below LO; the mirror control shorts above HI
export const FIN_ADD = 2.5;                       // percent a year over / under the 2-year yield
export const ATR_N = 20, STOP_ATR = 1, SEEDS = 40, SEEDS_NEED = 38, MIN_N = 100;
export const FIRST = 2005, SPLIT = 2016;
export const SESSION_FROM = 9;                    // the first session candle starts 09:00 New York
export const SPECIAL = new Set(['2012-10-29', '2012-10-30', '2018-12-05', '2025-01-09']);
const NYSE_FROM_EARLY = new Set(['Martin Luther King Day', "Presidents' Day", 'Memorial Day', 'Juneteenth', 'Independence Day', 'Labor Day', 'Thanksgiving Day']);
const HALF = new Set(['Independence Day eve', 'Day after Thanksgiving', 'Christmas Eve']);

const ymdOf = (ms) => new Date(ms).toISOString().slice(0, 10);
const yr = (d) => +d.slice(0, 4);
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
const eachDay = (from, to, f) => { for (let t = Date.parse(from + 'T12:00:00Z'); ymdOf(t) <= to; t += 86400e3) f(ymdOf(t)); };
export function tradingDays(from, to) { const out = []; eachDay(from, to, (d) => { if (isTradingDay(d)) out.push(d); }); return out; }
// the H1 candle that ends at the New York close (16:00, 13:00 on a half day): its UTC start
export function closeCandle(ymd) {
  const hr = dayKind(ymd) === 'half' ? 12 : 15;
  const [y, m, d] = ymd.split('-').map(Number);
  for (const off of [4, 5]) { const t = Date.UTC(y, m - 1, d, hr + off) / 1000; const p = nyParts(t); if (p.ymd === ymd && p.min === hr * 60) return t; }
  throw new Error('no close candle for ' + ymd);
}
// the session candles of a day for IBS: starts 09:00 ... the close candle, New York time (7, or 4 on a half day)
export function sessionStarts(ymd) {
  const tc = closeCandle(ymd), n = (dayKind(ymd) === 'half' ? 12 : 15) - SESSION_FROM + 1, out = [];
  for (let k = n - 1; k >= 0; k--) out.push(tc - k * 3600);
  return out;
}
// D[k] = { d, t, i, close, hi, lo (the 24 h day since the previous close, for ATR), ibs, sHi, sLo }
export function buildDays(bars, days) {
  const at = new Map(bars.map((b, i) => [b[0], i]));
  const out = [];
  let prevEnd = null;
  for (const d of days) {
    const t = closeCandle(d), i = at.get(t);
    if (i == null) { out.push({ d, t, close: null, ibs: null }); prevEnd = null; continue; }
    let hi = -Infinity, lo = Infinity, j = i;
    for (; j >= 0 && (prevEnd == null ? j >= i - 23 : bars[j][0] > prevEnd); j--) { hi = Math.max(hi, bars[j][2]); lo = Math.min(lo, bars[j][3]); }
    let sHi = -Infinity, sLo = Infinity, full = true;
    for (const s of sessionStarts(d)) { const x = at.get(s); if (x == null) { full = false; break; } sHi = Math.max(sHi, bars[x][2]); sLo = Math.min(sLo, bars[x][3]); }
    const close = bars[i][4];
    const ibs = full && sHi > sLo ? (close - sLo) / (sHi - sLo) : null;
    out.push({ d, t, i, close, hi, lo, ibs, sHi: full ? sHi : null, sLo: full ? sLo : null });
    prevEnd = t;
  }
  return out;
}
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
// the 2-year yield on a date: the last weekly value on or before it; before the first, the stated 2005 figure
export function rateOf(dgs2, before = 3.85) {
  return (ymd) => { let v = before; for (const [d, x] of dgs2) { if (d > ymd) break; v = x; } return v; };
}
// rollovers strictly after t and before c (unix seconds): Monday-Friday 22:00 UTC, FRIDAY counts three (index CFDs).
// The form of council/fills.mjs `nights` (copied; there a Wednesday counts three)
export const FIN_DAY = 86400;
export function nights(t, c) {
  let n = 0;
  if (!Number.isFinite(t) || !Number.isFinite(c)) return 0;
  for (let d = Math.floor(t / FIN_DAY) * FIN_DAY + 22 * 3600; d < c; d += FIN_DAY) {
    if (d <= t) continue;
    const w = new Date(d * 1000).getUTCDay();
    if (w >= 1 && w <= 5) n += w === 5 ? 3 : 1;
  }
  return n;
}
// financing share of the notional a night: long (r + 2.5) / 365, short max(0, 2.5 - r) / 365, r floored at 0
export const finRate = (r, side) => { const y = Math.max(0, r == null ? 0 : r); return (side > 0 ? y + FIN_ADD : Math.max(0, FIN_ADD - y)) / 100 / 365; };

// one trade: side +1 buy / -1 sell at close(D[e]), out at close(D[x]) unless stopped (1 x ATR(20), checked on H1)
export function trade(bars, D, e, x, { cost, rate, side = 1 }) {
  const E = D[e], X = D[x];
  if (!E || !X || E.close == null || X.close == null) return null;
  const atr = atrAt(D, e);
  if (atr == null || !(atr > 0)) return null;
  const entry = E.close, risk = STOP_ATR * atr, stop = entry - side * risk;
  let exit = X.close, how = 'time', exitT = X.t + 3600;
  for (let j = E.i + 1; j <= X.i; j++) {
    const b = bars[j];
    if (side > 0 ? b[1] <= stop : b[1] >= stop) { exit = b[1]; how = 'stop-gap'; exitT = b[0]; break; }
    if (side > 0 ? b[3] <= stop : b[2] >= stop) { exit = stop; how = 'stop'; exitT = b[0]; break; }
  }
  const nn = nights(E.t + 3600, exitT), finShare = nn * finRate(rate(E.d), side);
  const move = side * (exit - entry);
  return { entryD: E.d, exitD: X.d, entry, stop, exit, how, nights: nn, side,
    grossR: move / risk, R: (move - (cost + finShare) * entry) / risk,
    costR: cost * entry / risk, finR: finShare * entry / risk, pct: 100 * move / entry };
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
// every calendar month from (fromY, Jan) to the month of `toYmd`, inclusive: 'YYYY-MM'
export function monthsBetween(fromY, toYmd) {
  const out = []; let y = fromY, m = 1; const ty = yr(toYmd), tm = +toYmd.slice(5, 7);
  while (y < ty || (y === ty && m <= tm)) { out.push(`${y}-${String(m).padStart(2, '0')}`); if (++m > 12) { m = 1; y++; } }
  return out;
}
// month-sum t: the trades' R summed by entry month over every month of the window (an empty month counts 0)
export function monthT(trades, months) {
  const sum = new Map(months.map((k) => [k, 0]));
  for (const t of trades) { const k = t.entryD.slice(0, 7); if (sum.has(k)) sum.set(k, sum.get(k) + t.R); }
  return { months: months.length, ...stats([...sum.values()]) };
}
const r3 = (x) => x == null || !Number.isFinite(x) ? null : +x.toFixed(3), r2 = (x) => x == null || !Number.isFinite(x) ? null : +x.toFixed(2);
export const pctile = (xs, q) => { const s = xs.filter((x) => x != null).sort((a, b) => a - b); return s.length ? s[Math.round(q * (s.length - 1))] : null; };

export function summ(ts, months) {
  const s = stats(ts.map((t) => t.R)), g = stats(ts.map((t) => t.grossR)), mt = monthT(ts, months);
  const mean = (f) => ts.length ? ts.reduce((a, t) => a + f(t), 0) / ts.length : null;
  return { n: s.n, R: r3(s.mean), grossR: r3(g.mean), finR: r3(mean((t) => t.finR)), costR: r3(mean((t) => t.costR)), tTrade: r2(s.t),
    monthT: r2(mt.t), months: mt.months, win: s.n ? r2(100 * ts.filter((t) => t.R > 0).length / s.n) : null,
    stops: ts.filter((t) => t.how !== 'time').length, gaps: ts.filter((t) => t.how === 'stop-gap').length,
    totalR: r2(ts.reduce((a, t) => a + t.R, 0)), pct: r3(mean((t) => t.pct)) };
}

// one market, one side: the rule's trades and the placebo draws (decisive window)
export function marketRun(k, bars, days, rate, side, lastDay) {
  const D = buildDays(bars, days), opt = { cost: MARKETS[k].cost, rate, side };
  const sig = (x) => side > 0 ? x.ibs != null && x.ibs < LO : x.ibs != null && x.ibs > HI;
  const trades = [], skipped = [], entries = new Set();
  let ibsN = 0;
  for (let e = 0; e + 1 < D.length; e++) {
    if (yr(D[e].d) < FIRST) continue;
    if (D[e].ibs != null) ibsN++;
    if (!sig(D[e])) continue;
    entries.add(e);
    const t = trade(bars, D, e, e + 1, opt);
    if (t) trades.push(t); else skipped.push(D[e].d);
  }
  const rep = trades.filter((t) => yr(t.entryD) < SPLIT), dec = trades.filter((t) => yr(t.entryD) >= SPLIT);
  const mRep = monthsBetween(FIRST, `${SPLIT - 1}-12-31`), mDec = monthsBetween(SPLIT, lastDay);
  // every day's close-to-close return (before costs), as the rule's days are measured
  const allDays = (inW) => { const xs = []; for (let e = 0; e + 1 < D.length; e++) if (inW(D[e].d) && D[e].close != null && D[e + 1].close != null) xs.push(100 * side * (D[e + 1].close / D[e].close - 1)); return stats(xs); };
  const ruleDays = (ts) => stats(ts.map((t) => 100 * side * (D[D.findIndex((x) => x.d === t.exitD)].close / t.entry - 1)));
  // placebo pool: decisive-window trading days that are not a rule entry and trade (close, next close, ATR), per year
  const pool = new Map();
  for (let e = 0; e + 1 < D.length; e++) {
    if (yr(D[e].d) < SPLIT || entries.has(e)) continue;
    const t = trade(bars, D, e, e + 1, opt);
    if (t) { if (!pool.has(yr(t.entryD))) pool.set(yr(t.entryD), []); pool.get(yr(t.entryD)).push(t.R); }
  }
  const counts = new Map(); for (const t of dec) counts.set(yr(t.entryD), (counts.get(yr(t.entryD)) || 0) + 1);
  const draws = [];
  for (let s = 1; s <= SEEDS; s++) {
    const Rn = rng(s), obs = [];
    for (const [y, n] of [...counts].sort((a, b) => a[0] - b[0])) { const P = pool.get(y) || []; for (let j = 0; j < n && P.length; j++) obs.push(P[Math.floor(Rn() * P.length)]); }
    draws.push(obs);
  }
  const byYear = {}; for (const t of trades) (byYear[yr(t.entryD)] ||= []).push(t.R);
  const ibsDays = D.filter((x) => yr(x.d) >= FIRST && x.close != null);
  return { D, trades, dec, rep, draws, mRep, mDec,
    out: { market: k, side: side > 0 ? 'long' : 'short', name: MARKETS[k].name,
      decisive: summ(dec, mDec), replication: summ(rep, mRep), skipped: skipped.length,
      noIbs: ibsDays.filter((x) => x.ibs == null).length, days: ibsDays.length, signalShare: r3(ibsN ? entries.size / ibsN : null),
      allDaysPct: { decisive: r3(allDays((d) => yr(d) >= SPLIT).mean), replication: r3(allDays((d) => yr(d) >= FIRST && yr(d) < SPLIT).mean) },
      ruleDaysPct: { decisive: r3(ruleDays(dec).mean), replication: r3(ruleDays(rep).mean) },
      byYear: Object.fromEntries(Object.entries(byYear).map(([y, xs]) => { const s = stats(xs); return [y, { n: s.n, R: r3(s.mean) }]; })),
      trades: trades.map((t) => [t.entryD, t.how, t.nights, r3(t.grossR), r3(t.R)]) } };
}
const placeboOf = (ruleMean, draws) => {
  const seeds = draws.map((o) => o.length ? o.reduce((a, b) => a + b, 0) / o.length : null);
  return { seeds: seeds.map(r3), beaten: seeds.filter((m) => m != null && ruleMean != null && ruleMean > m).length, need: SEEDS_NEED,
    p5: r3(pctile(seeds, 0.05)), p50: r3(pctile(seeds, 0.5)), p95: r3(pctile(seeds, 0.95)) };
};

export function study(M, rates) {
  const keys = Object.keys(MARKETS).filter((k) => M[k]);
  const first = keys.map((k) => nyParts(M[k][0][0]).ymd).sort().at(-1), last = keys.map((k) => nyParts(M[k].at(-1)[0]).ymd).sort()[0];
  const days = tradingDays(first, last), rate = rateOf(rates.DGS2, rates.before2006);
  const lastDay = days.at(-1);
  const res = { from: first, to: last, tests: {}, pooled: null, mirror: {} };
  const runs = {};
  for (const k of keys) {
    const L = marketRun(k, M[k], days, rate, 1, lastDay);
    runs[k] = L;
    res.tests[MARKETS[k].test] = { ...L.out, pOne: pOneSided(monthT(L.dec, L.mDec).t),
      placebo: placeboOf(stats(L.dec.map((t) => t.R)).mean, L.draws) };
    const S = marketRun(k, M[k], days, rate, -1, lastDay);
    res.mirror[k] = { name: S.out.name, side: 'short', decisive: S.out.decisive, replication: S.out.replication, skipped: S.out.skipped, _dec: S.dec, _rep: S.rep };
  }
  const L0 = runs[keys[0]], decAll = keys.flatMap((k) => runs[k].dec), repAll = keys.flatMap((k) => runs[k].rep);
  const pooledDraws = Array.from({ length: SEEDS }, (_, s) => keys.flatMap((k) => runs[k].draws[s]));
  res.pooled = { decisive: summ(decAll, L0.mDec), replication: summ(repAll, L0.mRep),
    placebo: placeboOf(stats(decAll.map((t) => t.R)).mean, pooledDraws) };
  const mDec = [...keys.flatMap((k) => res.mirror[k]._dec)], mRep = [...keys.flatMap((k) => res.mirror[k]._rep)];
  for (const k of keys) { delete res.mirror[k]._dec; delete res.mirror[k]._rep; }
  res.mirror.pooled = { decisive: summ(mDec, L0.mDec), replication: summ(mRep, L0.mRep) };
  return res;
}

export function verdictOf(S) {
  const ids = Object.keys(S.tests), adj = holm(ids.map((id) => S.tests[id].pOne)), checks = {};
  ids.forEach((id, i) => {
    const c = S.tests[id], o = c.decisive;
    const ch = { a: o.n >= MIN_N, b: o.R > 0, c: o.monthT != null && o.monthT >= 2 && adj[i] < 0.05, d: c.replication.R > 0, e: c.placebo.beaten >= SEEDS_NEED };
    checks[id] = { holmP: +adj[i].toFixed(4), checks: ch, pass: Object.values(ch).every(Boolean) };
  });
  const P = S.pooled, pch = { b: P.decisive.R > 0, c: P.decisive.monthT != null && P.decisive.monthT >= 2, d: P.replication.R > 0, e: P.placebo.beaten >= SEEDS_NEED };
  checks.P = { checks: pch, pass: Object.values(pch).every(Boolean) };
  const passed = Object.entries(checks).filter(([, c]) => c.pass).map(([id]) => id);
  return { verdict: passed.length ? 'PASS' : 'FAIL', passed, checks };
}

const f3 = (x) => x == null ? '–' : (x >= 0 ? '+' : '') + x.toFixed(3), f2 = (x) => x == null ? '–' : x.toFixed(2);
export function report(res) {
  const L = [];
  const v = res.checks, T = res.tests;
  L.push('# Result: the IBS daily reversal on US indices (14 Nov 2026)', '');
  L.push(`**Verdict: ${res.verdict}**${res.passed.length ? ` (passed: ${res.passed.join(', ')})` : ''}. Pre-registered in PREREGISTRATION.md (pushed alone first, commit ${res.prereg}). Four chances in all: T1-T3 (Holm over three) and the pooled test P.`, '');
  L.push(`Rule: IBS = (close - low) / (high - low) of the New York session built from OANDA mid H1 (candles 09:00 to the 16:00 close, New York time); IBS < ${LO} → buy the 16:00 close, sell the next trading day's 16:00 close; stop ${STOP_ATR} x ATR(20) of the 20 New York days before, checked on H1 (a gap fills at the open). Costs: SPX500 0.04 %, NAS100 0.05 %, US30 0.05 % of price a round trip; financing (DGS2 + 2.5 %) / 365 a rollover night, Friday three. Data ${res.from} to ${res.to}. Decisive window 2016 to now, replication 2005-2015 (by entry date). t = month-sum t (every calendar month, empty months 0).`, '');
  L.push('## Tests (long, IBS < 0.2)', '');
  L.push('| Test | Window | n | Gross R | Net R | Cost R | Financing R | Win % | Stops (gaps) | Month-sum t | Total R |');
  L.push('|---|---|---|---|---|---|---|---|---|---|---|');
  const row = (name, w, s) => L.push(`| ${name} | ${w} | ${s.n} | ${f3(s.grossR)} | ${f3(s.R)} | ${f3(s.costR)} | ${f3(s.finR)} | ${f2(s.win)} | ${s.stops} (${s.gaps}) | ${f2(s.monthT)} | ${f2(s.totalR)} |`);
  for (const [id, c] of Object.entries(T)) { row(`${id} ${c.name}`, '2016-now', c.decisive); row(`${id} ${c.name}`, '2005-2015', c.replication); }
  row('P pooled', '2016-now', res.pooled.decisive); row('P pooled', '2005-2015', res.pooled.replication);
  L.push('', '## Checks', '');
  L.push('| Test | (a) n >= 100 | (b) net R > 0 | (c) month t >= 2, Holm p < 0.05 | (d) 2005-15 net R > 0 | (e) placebo beaten >= 38 / 40 | Holm p | Pass |');
  L.push('|---|---|---|---|---|---|---|---|');
  const yn = (b) => b == null ? '–' : b ? 'yes' : 'no';
  for (const [id, c] of Object.entries(v)) L.push(`| ${id} | ${yn(c.checks.a)} | ${yn(c.checks.b)} | ${yn(c.checks.c)} | ${yn(c.checks.d)} | ${yn(c.checks.e)} | ${c.holmP == null ? '–' : c.holmP.toFixed(4)} | ${c.pass ? 'PASS' : 'fail'} |`);
  L.push('', 'The pooled test P has no n check and no Holm adjustment (one test of its own, as pre-registered).', '');
  L.push('## Placebo: random trading days, the rule\'s count per year, traded the same way (2016-now, 40 seeds)', '');
  L.push('| Test | Rule net R | Seeds beaten | Seed mean 5th pct | Median | 95th pct |');
  L.push('|---|---|---|---|---|---|');
  for (const [id, c] of Object.entries(T)) L.push(`| ${id} ${c.name} | ${f3(c.decisive.R)} | ${c.placebo.beaten} / ${SEEDS} | ${f3(c.placebo.p5)} | ${f3(c.placebo.p50)} | ${f3(c.placebo.p95)} |`);
  L.push(`| P pooled | ${f3(res.pooled.decisive.R)} | ${res.pooled.placebo.beaten} / ${SEEDS} | ${f3(res.pooled.placebo.p5)} | ${f3(res.pooled.placebo.p50)} | ${f3(res.pooled.placebo.p95)} |`);
  L.push('', '## Before costs: the rule\'s days against every day (close to close, % a day)', '');
  L.push('| Market | Rule days 2016-now | Every day 2016-now | Rule days 2005-15 | Every day 2005-15 | Signal share of days | Days without IBS | Skipped signals |');
  L.push('|---|---|---|---|---|---|---|---|');
  for (const [id, c] of Object.entries(T)) L.push(`| ${id} ${c.name} | ${f3(c.ruleDaysPct.decisive)} | ${f3(c.allDaysPct.decisive)} | ${f3(c.ruleDaysPct.replication)} | ${f3(c.allDaysPct.replication)} | ${f2(100 * c.signalShare)} % | ${c.noIbs} of ${c.days} | ${c.skipped} |`);
  L.push('', '## Mirror control, reported only (IBS > 0.8 → sell the close, stop 1 x ATR above)', '');
  L.push('| Market | Window | n | Gross R | Net R | Financing R | Month-sum t |');
  L.push('|---|---|---|---|---|---|---|');
  for (const [k, c] of Object.entries(res.mirror)) for (const [w, s] of [['2016-now', c.decisive], ['2005-2015', c.replication]]) L.push(`| ${k === 'pooled' ? 'pooled' : c.name} | ${w} | ${s.n} | ${f3(s.grossR)} | ${f3(s.R)} | ${f3(s.finR)} | ${f2(s.monthT)} |`);
  L.push('', '## By year (long rule, net R a trade, n)', '');
  const years = [...new Set(Object.values(T).flatMap((c) => Object.keys(c.byYear)))].sort();
  L.push(`| Year | ${Object.entries(T).map(([id, c]) => `${id} ${c.name}`).join(' | ')} |`);
  L.push(`|---|${Object.keys(T).map(() => '---').join('|')}|`);
  for (const y of years) L.push(`| ${y} | ${Object.values(T).map((c) => c.byYear[y] ? `${f3(c.byYear[y].R)} (${c.byYear[y].n})` : '–').join(' | ')} |`);
  L.push('', '## What this does and does not say', '');
  L.push(...res.reading);
  return L.join('\n') + '\n';
}

// the plain reading of the result, written after the numbers were seen (not part of any test)
export const READING = [
  '- **No test passed (0 of 4).** The best single market, NAS100, made +0.056R a trade net on 2016-now (n 473, month-sum t 1.65, Holm p 0.149) and beat all 40 placebo seeds, but it did not replicate on 2005-2015 (+0.010R, t 0.34). SPX500 is the other way round: +0.071R and t 2.66 on 2005-2015, then +0.013R, t 0.37 on 2016-now. US30 lost on 2016-now. The pooled test: +0.020R a trade, t 0.64.',
  '- **The effect is there before costs and too small after them.** On every market and both windows the day after a low-IBS close rose more than the average day (for example NAS100 2016-now +0.29 % against +0.08 %), as the literature says. In R that is about +0.05 to +0.12R a trade gross, and costs (0.03-0.04R) plus one night of financing (0.01-0.02R) take most of it. One trade a day held one session pays the full round trip each time.',
  '- **It has weakened since publication on the S&P 500 and the Dow**, the markets the published work mostly used (gross +0.115R → +0.062R on SPX500, +0.094R → +0.049R on US30, 2005-15 → 2016-now).',
  '- **The mirror short loses even before costs on 2016-now** (gross −0.02 to −0.03R a trade, net t −2.2 to −2.6): a high close inside the day is not followed by a fall; shorting US indices for a day fights their upward drift.',
  '- Limits, fixed before the results: the session high and low include the 09:00-09:30 pre-open half hour (the H1 grid); one fixed threshold (0.2), one holding period (one session), one stop (1 x ATR(20)). Other thresholds, holding until a high close, or the ETFs instead of CFDs were not tested and would need their own pre-registration on other data. Not an edge here; nothing live changed and no proposal follows.',
];

if (import.meta.url === `file://${process.argv[1]}`) {
  const dir = process.argv[2]; if (!dir) throw new Error('usage: node run.mjs <candleDir>');
  const here = path.dirname(new URL(import.meta.url).pathname);
  const rates = JSON.parse(fs.readFileSync(path.join(here, 'rates.json'), 'utf8'));
  const M = {};
  for (const k of Object.keys(MARKETS)) M[k] = JSON.parse(zlib.gunzipSync(fs.readFileSync(path.join(dir, `${k}-1h.json.gz`))));
  const S = study(M, rates), v = verdictOf(S);
  const out = { built: '2026-11-14', study: 'index-ibs', title: 'The IBS daily reversal on US indices', prereg: '4274ca30b',
    system: 'SPX500 / NAS100 / US30 IBS < 0.2 next-day long (not a council system)',
    verdict: v.verdict, passed: v.passed, checks: v.checks,
    data: { src: 'OANDA mid H1 via the site candle proxy (fetch.mjs); session = H1 candles 09:00 to the 16:00 close, New York time; 2-year yield FRED DGS2 weekly (rates.json)', costs: Object.fromEntries(Object.entries(MARKETS).map(([k, m]) => [k, m.cost])), financing: `long DGS2 + ${FIN_ADD} %, short max(0, ${FIN_ADD} % - DGS2), a year, per 22:00 UTC rollover, Friday three` },
    ...S, reading: READING };
  fs.writeFileSync(path.join(here, 'result.json'), JSON.stringify(out, null, 1) + '\n');
  fs.writeFileSync(path.join(here, 'RESULT.md'), report(out));
  console.log(v.verdict, JSON.stringify(v.checks));
  for (const [id, c] of Object.entries(S.tests)) console.log(id, 'DEC', JSON.stringify(c.decisive), 'REP', JSON.stringify(c.replication), 'placebo', JSON.stringify({ b: c.placebo.beaten, p5: c.placebo.p5, p50: c.placebo.p50, p95: c.placebo.p95 }), 'noIbs', c.noIbs, c.days, 'skip', c.skipped);
  console.log('POOLED', JSON.stringify(S.pooled.decisive), JSON.stringify(S.pooled.replication), JSON.stringify({ b: S.pooled.placebo.beaten, p5: S.pooled.placebo.p5, p50: S.pooled.placebo.p50, p95: S.pooled.placebo.p95 }));
  for (const [k, c] of Object.entries(S.mirror)) console.log('MIRROR', k, JSON.stringify(c.decisive), JSON.stringify(c.replication));
}
