// Edge research · fx-home-hours: a currency weakens in its own home hours (Breedon and Ranaldo 2013), as one clock trade a
// weekday per pair on OANDA mid M5, with a 1x H1 ATR stop, after the raw-spread forex costs. Rules: PREREGISTRATION.md.
//   node research/edge/fx-home-hours/run.mjs run <candleDir>     (candles from fetch.mjs; writes result.json)
// Pure pieces are exported for tests/fx-home-hours.test.mjs.
import fs from 'node:fs';
import path from 'node:path';
import zlib from 'node:zlib';
import { fileURLToPath } from 'node:url';
import { usHolidays } from '../../../council/datacheck.mjs';
import { nyOffsetH, usDaylight } from '../../../council/histdata.mjs';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const DAY = 86400, HR = 3600, M5 = 300;
const T = (s) => Date.parse(s + 'T00:00:00Z') / 1000;

export const P = {
  REP: [T('2010-01-01'), T('2016-01-01')],        // replication: entries 2010-01-01 .. 2015-12-31
  DEC: [T('2016-01-01'), T('2026-11-01')],        // decisive: entries 2016-01-01 .. 2026-10-31
  ATR_N: 14, EXIT_SLACK: 1800,                    // ATR periods; the exit candle must open within 30 min of the window end
  SPREAD_PIPS: 0.3, SLIP_PIPS: 0.3,               // a round trip: spread 0.3 pip + half a spread on each of two market orders
  COMM_RT: 45e-6,                                 // 22.5 USD a million a side, as a fraction of the entry price
  MARKUP: 1,                                      // financing markup, percent a year
  SEEDS: 40,
  BAR: { nDec: 300, nRep: 150, t: 2.0, holm: 0.05, placeboAbove: 38 },
};

// one leg per pair: start / end hour relative to 00:00 UTC of the session date (AUD starts the day before at 22:00)
export const PAIRS = {
  T1: { sym: 'eurusd', name: 'EUR/USD', side: -1, from: 7, to: 12, pip: 1e-4, long: 'usd', short: 'eur' },
  T2: { sym: 'usdjpy', name: 'USD/JPY', side: 1, from: 0, to: 6, pip: 1e-2, long: 'usd', short: 'jpy' },
  T3: { sym: 'gbpusd', name: 'GBP/USD', side: -1, from: 7, to: 12, pip: 1e-4, long: 'usd', short: 'gbp' },
  T4: { sym: 'audusd', name: 'AUD/USD', side: -1, from: -2, to: 5, pip: 1e-4, long: 'usd', short: 'aud' },
};
export const startHour = (pr) => ((pr.from % 24) + 24) % 24;

const isoDay = (t) => new Date(t * 1000).toISOString().slice(0, 10);
export const windowOf = (t) => (t >= P.DEC[0] && t < P.DEC[1] ? 'dec' : t >= P.REP[0] && t < P.REP[1] ? 'rep' : null);

// session dates Monday-Friday not on the US holiday list, with their window in UTC
export function isTradingDay(d) {
  const wd = new Date(d * 1000).getUTCDay();
  if (wd === 0 || wd === 6) return false;
  const s = isoDay(d);
  return !usHolidays(+s.slice(0, 4)).has(s);
}
export function sessions(pr, from = P.REP[0] - DAY, to = P.DEC[1] + DAY) {
  const out = [];
  for (let d = from; d < to; d += DAY) {
    if (!isTradingDay(d)) continue;
    const start = d + pr.from * HR, end = d + pr.to * HR;
    if (!windowOf(start)) continue;
    out.push({ date: isoDay(d), day: d, start, end });
  }
  return out;
}

// candles: columns as typed arrays + time -> index
export function columns(rows) {
  const n = rows.length, t = new Float64Array(n), o = new Float64Array(n), h = new Float64Array(n), l = new Float64Array(n), c = new Float64Array(n), at = new Map();
  for (let i = 0; i < n; i++) { const r = rows[i]; t[i] = r[0]; o[i] = r[1]; h[i] = r[2]; l[i] = r[3]; c[i] = r[4]; at.set(r[0], i); }
  return { n, t, o, h, l, c, at };
}
// H1 candles built from M5 in UTC hour buckets, with prefix sums of the true range
export function hourly(B) {
  const H = [];
  for (let i = 0; i < B.n; i++) {
    const k = Math.floor(B.t[i] / HR), last = H[H.length - 1];
    if (last && last.k === k) { if (B.h[i] > last.h) last.h = B.h[i]; if (B.l[i] < last.l) last.l = B.l[i]; last.c = B.c[i]; }
    else H.push({ k, o: B.o[i], h: B.h[i], l: B.l[i], c: B.c[i] });
  }
  const pre = new Float64Array(H.length + 1);
  for (let j = 0; j < H.length; j++) {
    const x = H[j], pc = j ? H[j - 1].c : null;
    const tr = pc == null ? 0 : Math.max(x.h - x.l, Math.abs(x.h - pc), Math.abs(x.l - pc));
    pre[j + 1] = pre[j] + tr;
  }
  return { H, pre, end: H.map((x) => (x.k + 1) * HR) };
}
// the 14-period ATR from the H1 candles whose hour ended at or before E (needs 15 candles: the first only gives a close)
export function atrAt(HH, E, n = P.ATR_N) {
  let lo = 0, hi = HH.end.length - 1, j = -1;
  while (lo <= hi) { const m = (lo + hi) >> 1; if (HH.end[m] <= E) { j = m; lo = m + 1; } else hi = m - 1; }
  if (j < n) return null;
  return (HH.pre[j + 1] - HH.pre[j + 1 - n]) / n;
}

// the 17:00 New York rollovers in [a, b): [{ t, nights }] (Wednesday's counts three)
export function rollovers(a, b) {
  const out = [];
  for (let d = Math.floor(a / DAY) * DAY - DAY; d < b + DAY; d += DAY) {
    const t = d + (17 + nyOffsetH(d + 21 * HR)) * HR;
    if (t >= a && t < b) out.push({ t, nights: new Date(d * 1000).getUTCDay() === 3 ? 3 : 1 });
  }
  return out;
}
// the rate in force on a day (percent a year)
export function rateOn(R, ccy, day) {
  const D = R.decisions[ccy]; let v = D.from[1];
  for (const [d, x] of D.changes) { if (d <= day) v = x; else break; }
  return v;
}
// financing in price units (a positive number is a charge; a credit is never booked)
export function financing(R, pr, entry, entryT, exitT) {
  const ro = rollovers(entryT, exitT); if (!ro.length) return { fin: 0, nights: 0 };
  const day = isoDay(entryT), nights = ro.reduce((s, x) => s + x.nights, 0);
  const carry = (rateOn(R, pr.long, day) - rateOn(R, pr.short, day) - P.MARKUP) / 100 / 365;
  return { fin: Math.max(0, -carry) * nights * entry, nights };
}
export const tradeCost = (pr, entry) => (P.SPREAD_PIPS + P.SLIP_PIPS) * pr.pip + P.COMM_RT * entry;

// one clock trade: market at the open of the M5 candle at `start`, stop 1x ATR, out at the close of the last candle before `end`
export function simTrade(B, HH, pr, start, end, side = pr.side, R = null) {
  const i0 = B.at.get(start);
  if (i0 == null) return { skip: 'nodata' };
  let iz = i0; while (iz + 1 < B.n && B.t[iz + 1] < end) iz++;
  if (B.t[iz] < end - P.EXIT_SLACK) return { skip: 'nodata' };
  const r0 = atrAt(HH, start);
  if (!(r0 > 0)) return { skip: 'noatr' };
  const entry = B.o[i0], stop = entry - side * r0;
  let exit = null, how = 'time', exitT = B.t[iz] + M5;
  for (let i = i0; i <= iz; i++) {
    if (side > 0 ? B.o[i] <= stop : B.o[i] >= stop) { exit = B.o[i]; how = 'gap'; exitT = B.t[i]; break; }
    if (side > 0 ? B.l[i] <= stop : B.h[i] >= stop) { exit = stop; how = 'stop'; exitT = B.t[i] + M5; break; }
  }
  if (exit == null) exit = B.c[iz];
  const gross = side * (exit - entry) / r0;
  const cost = tradeCost(pr, entry), fn = R ? financing(R, pr, entry, start, exitT) : { fin: 0, nights: 0 };
  return { t: start, exitT, entry, stop, exit, r0, how, gross, costR: (cost + fn.fin) / r0, finR: fn.fin / r0, nights: fn.nights,
    net: gross - (cost + fn.fin) / r0, net2: gross - 2 * (cost + fn.fin) / r0, pips: side * (exit - entry) / pr.pip, r0p: r0 / pr.pip };
}

// ─── statistics ───
const r3 = (x) => (x == null || !Number.isFinite(x) ? null : Math.round(x * 1000) / 1000);
const r2 = (x) => (x == null || !Number.isFinite(x) ? null : Math.round(x * 100) / 100);
const mean = (a) => (a.length ? a.reduce((s, x) => s + x, 0) / a.length : null);
const sd = (a) => { if (a.length < 2) return null; const m = mean(a); return Math.sqrt(a.reduce((s, x) => s + (x - m) ** 2, 0) / (a.length - 1)); };
export const monthOf = (t) => isoDay(t).slice(0, 7);
export function monthSums(trades, key = 'net') { const m = new Map(); for (const x of trades) m.set(monthOf(x.t), (m.get(monthOf(x.t)) || 0) + x[key]); return m; }
export function tOf(vals) { const s = sd(vals); return s > 0 ? mean(vals) / s * Math.sqrt(vals.length) : null; }
export const monthT = (trades, key = 'net') => tOf([...monthSums(trades, key).values()]);
export function normP(t) {   // one-sided p of a z
  if (t == null) return 1;
  const z = Math.abs(t) / Math.SQRT2, k = 1 / (1 + 0.3275911 * z);
  const erf = 1 - (((((1.061405429 * k - 1.453152027) * k) + 1.421413741) * k - 0.284496736) * k + 0.254829592) * k * Math.exp(-z * z);
  const p = 0.5 * (1 - erf); return t >= 0 ? p : 1 - p;
}
export function holm(ps) {
  const idx = ps.map((p, i) => [p, i]).sort((a, b) => a[0] - b[0]), out = new Array(ps.length); let run = 0;
  idx.forEach(([p, i], k) => { run = Math.max(run, Math.min(1, (ps.length - k) * p)); out[i] = run; });
  return out;
}
export function stats(trades) {
  const net = trades.map((x) => x.net); let cum = 0, peak = 0, dd = 0;
  for (const v of net) { cum += v; peak = Math.max(peak, cum); dd = Math.min(dd, cum - peak); }
  const months = monthSums(trades);
  const med = (a) => { if (!a.length) return null; const s = [...a].sort((p, q) => p - q); return s[s.length >> 1]; };
  return { n: trades.length, months: months.size, exp: r3(mean(net)), gross: r3(mean(trades.map((x) => x.gross))), exp2: r3(mean(trades.map((x) => x.net2))),
    costR: r3(mean(trades.map((x) => x.costR))), finR: r3(mean(trades.map((x) => x.finR))), R: r2(cum), t: r2(monthT(trades)), tGross: r2(monthT(trades, 'gross')),
    wr: r3(trades.length ? net.filter((v) => v > 0).length / trades.length : null), maxDD: r2(dd),
    exits: { time: trades.filter((x) => x.how === 'time').length, stop: trades.filter((x) => x.how === 'stop').length, gap: trades.filter((x) => x.how === 'gap').length },
    pips: r2(mean(trades.map((x) => x.pips))), r0pips: r2(med(trades.map((x) => x.r0p))) };
}

// seeded generator (mulberry32)
export function rng(seed) { let a = seed >>> 0; return () => { a = (a + 0x6D2B79F5) >>> 0; let t = a; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; }
// a placebo start hour: uniform over the 23 whole hours other than the rule's own
export function placeboHour(u, own) { const k = Math.floor(u * 23); return k >= own ? k + 1 : k; }

// ─── the study ───
export function study(candles, R) {
  const tests = {}, trades = {}, place = {};
  for (const [k, pr] of Object.entries(PAIRS)) {
    const B = columns(candles[pr.sym]), HH = hourly(B), S = sessions(pr), L = pr.to - pr.from;
    const fun = { sessions: S.length, nodata: 0, noatr: 0, trades: 0 }, list = [];
    for (const s of S) { const x = simTrade(B, HH, pr, s.start, s.end, pr.side, R); if (x.skip) { fun[x.skip]++; continue; } x.date = s.date; list.push(x); }
    fun.trades = list.length; trades[k] = list;
    const dec = list.filter((x) => windowOf(x.t) === 'dec'), rep = list.filter((x) => windowOf(x.t) === 'rep');
    const years = {}; for (const x of list) { const y = isoDay(x.t).slice(0, 4); (years[y] = years[y] || []).push(x); }
    tests[k] = { pair: pr.name, side: pr.side > 0 ? 'buy' : 'sell', window: `${String(startHour(pr)).padStart(2, '0')}:00 -> ${String(pr.to).padStart(2, '0')}:00 UTC`, funnel: fun,
      dec: stats(dec), rep: stats(rep), years: Object.fromEntries(Object.entries(years).map(([y, a]) => [y, { n: a.length, exp: r3(mean(a.map((x) => x.net))), gross: r3(mean(a.map((x) => x.gross))) }])) };
    if (k === 'T4') tests[k].dst = { summer: stats(dec.filter((x) => usDaylight(x.t))), winter: stats(dec.filter((x) => !usDaylight(x.t))) };
    // placebo: same session dates as the rule's trades, same length and side, a random other start hour
    const days = list.map((x) => ({ day: Math.floor((x.t + (pr.from < 0 ? -pr.from * HR : 0)) / DAY) * DAY }));
    const means = [];
    for (let s = 1; s <= P.SEEDS; s++) {
      const u = rng(s * 1000 + +k.slice(1)), got = [];
      for (const d of days) { const h = placeboHour(u(), startHour(pr)), a = d.day + h * HR, x = simTrade(B, HH, pr, a, a + L * HR, pr.side, R); if (!x.skip && windowOf(x.t) === 'dec') got.push(x.net); }
      means.push(mean(got));
    }
    place[k] = means;
  }
  // Holm over T1-T4 (decisive month t)
  const keys = Object.keys(PAIRS), ps = keys.map((k) => normP(tests[k].dec.t)), adj = holm(ps);
  const pct = (a, q) => { const s = [...a].sort((x, y) => x - y); return s[Math.min(s.length - 1, Math.floor(q * (s.length - 1) + 0.5))]; };
  keys.forEach((k, i) => {
    const X = tests[k], pm = place[k];
    X.p = r3(ps[i]); X.pHolm = r3(adj[i]);
    X.placebo = { p5: r3(pct(pm, 0.05)), p50: r3(pct(pm, 0.5)), p95: r3(pct(pm, 0.95)), above: pm.filter((m) => m < X.dec.exp).length, of: pm.length, means: pm.map(r3) };
    X.conditions = { n: X.dec.n >= P.BAR.nDec && X.rep.n >= P.BAR.nRep, t: X.dec.exp > 0 && X.dec.t >= P.BAR.t, holm: X.pHolm < P.BAR.holm, rep: X.rep.exp > 0, cost2: X.dec.exp2 > 0, placebo: X.placebo.above >= P.BAR.placeboAbove };
    X.pass = Object.values(X.conditions).every(Boolean);
  });
  // T5 pooled, equal weight: monthly mean over pairs of each pair's month sum
  const pooled = (key) => { const ms = keys.map((k) => monthSums(trades[k].filter((x) => windowOf(x.t) === key))), all = new Set(ms.flatMap((m) => [...m.keys()]));
    return [...all].sort().map((mo) => { const v = ms.filter((m) => m.has(mo)).map((m) => m.get(mo)); return mean(v); }); };
  const pooled2 = () => { const ms = keys.map((k) => monthSums(trades[k].filter((x) => windowOf(x.t) === 'dec'), 'net2')), all = new Set(ms.flatMap((m) => [...m.keys()])); return [...all].map((mo) => mean(ms.filter((m) => m.has(mo)).map((m) => m.get(mo)))); };
  const eq = (w, f) => r3(mean(keys.map((k) => tests[k][w][f])));
  const pm5 = Array.from({ length: P.SEEDS }, (_, s) => mean(keys.map((k) => place[k][s])));
  const T5 = { dec: { exp: eq('dec', 'exp'), exp2: eq('dec', 'exp2'), gross: eq('dec', 'gross'), months: pooled('dec').length, t: r2(tOf(pooled('dec'))), month2: r3(mean(pooled2())) },
    rep: { exp: eq('rep', 'exp'), gross: eq('rep', 'gross'), months: pooled('rep').length, t: r2(tOf(pooled('rep'))) } };
  T5.placebo = { p5: r3(pct(pm5, 0.05)), p50: r3(pct(pm5, 0.5)), p95: r3(pct(pm5, 0.95)), above: pm5.filter((m) => m < T5.dec.exp).length, of: pm5.length };
  T5.conditions = { t: T5.dec.exp > 0 && T5.dec.t >= P.BAR.t, rep: T5.rep.exp > 0, cost2: T5.dec.exp2 > 0, placebo: T5.placebo.above >= P.BAR.placeboAbove };
  T5.pass = Object.values(T5.conditions).every(Boolean);
  const passed = keys.filter((k) => tests[k].pass);
  const verdict = passed.length ? 'PASS' : keys.some((k) => tests[k].conditions.t && tests[k].conditions.rep) || T5.pass ? 'INCONCLUSIVE' : 'FAIL';
  return { tests, T5, verdict, passed, trades };
}

// ─── run ───
const MODE = process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url) ? process.argv[2] : null;
if (MODE === 'run') {
  const DIR = process.argv[3]; if (!DIR) throw new Error('usage: node run.mjs run <candleDir>');
  const R = JSON.parse(fs.readFileSync(path.join(HERE, 'rates.json'), 'utf8')), candles = {}, info = {};
  for (const pr of Object.values(PAIRS)) {
    candles[pr.sym] = JSON.parse(zlib.gunzipSync(fs.readFileSync(path.join(DIR, `${pr.sym}-5m.json.gz`))));
    const c = candles[pr.sym]; info[pr.sym] = { m5: c.length, from: isoDay(c[0][0]), to: isoDay(c.at(-1)[0]) };
  }
  const S = study(candles, R), sg = (x) => (x == null ? 'n/a' : `${x >= 0 ? '+' : ''}${x}`);
  const lab = (s) => ({ exp: s.exp, R: s.R, n: s.n, wr: s.wr, maxDD: s.maxDD, t: s.t });
  const head = Object.keys(PAIRS).map((k) => `${PAIRS[k].name} ${S.tests[k].side} ${sg(S.tests[k].dec.exp)}R (n ${S.tests[k].dec.n}, t ${S.tests[k].dec.t})`).join('; ');
  const out = { topic: 'fx-home-hours', built: '2026-11-14',
    system: 'a currency weakens in its own home hours (Breedon and Ranaldo 2013): one clock trade a weekday per pair (EUR/USD and GBP/USD sold 07-12 UTC, USD/JPY bought 00-06 UTC, AUD/USD sold 22-05 UTC), stop 1x the 14-period H1 ATR, OANDA mid M5, raw-spread forex costs',
    window: { rep: '2010-01-01 to 2015-12-31 (replication)', dec: '2016-01-01 to 2026-10-31 (decisive)' }, params: P, pairs: PAIRS, candles: info,
    unit: 'exp = mean net R a trade after costs (0.3 pip spread + 0.3 pip slippage + 45 USD a million commission a round trip + financing over 17:00 New York, credits never booked); t = t of calendar-month sums of net R',
    verdict: `${S.verdict}: ${S.verdict === 'FAIL' ? 'no pair is positive with month t >= 2 in 2016-26 and positive in 2010-15' : S.verdict === 'PASS' ? `${S.passed.map((k) => PAIRS[k].name).join(', ')} pass every condition` : 'a pair is positive in both windows with t >= 2 in 2016-26 but fails another condition, or only the pooled test passes'}. 2016-26 net: ${head}`,
    tests: S.tests, T5: S.T5,
    baseline: { is: { exp: S.T5.rep.exp, t: S.T5.rep.t }, oos: { exp: S.T5.dec.exp, t: S.T5.dec.t } },
    candidates: Object.keys(PAIRS).map((k) => ({ rule: `${k} ${PAIRS[k].name} ${S.tests[k].side} ${S.tests[k].window}`, verdict: S.tests[k].pass ? 'PASS' : 'FAIL', is: lab(S.tests[k].rep), oos: lab(S.tests[k].dec), years: S.tests[k].years })) };
  fs.writeFileSync(path.join(HERE, 'result.json'), JSON.stringify(out, null, 1) + '\n');
  for (const k of Object.keys(PAIRS)) { const X = S.tests[k]; console.error(k, X.pair, JSON.stringify(X.funnel), '\n dec', JSON.stringify(X.dec), '\n rep', JSON.stringify(X.rep), '\n p', X.p, 'holm', X.pHolm, 'placebo', JSON.stringify({ ...X.placebo, means: undefined }), JSON.stringify(X.conditions)); }
  console.error('T5', JSON.stringify(S.T5)); console.error(out.verdict);
}
