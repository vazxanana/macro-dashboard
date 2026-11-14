// Edge research · gold-lbma-fix: the LBMA gold auctions on spot gold (OANDA mid M5), London time with BST, 2016 on.
// T1 run-in: M = price 14:55 - price 13:30 London; enter with M at 14:55, stop 3 x ATR(14) of M5, out at 15:05.
// T2 fade:   M = price 15:00 - price 13:30; enter against M at the close of the 15:00 candle, stop that candle's extreme
//            + $0.30, out at 16:30. Two tests, Holm; the AM auction (10:30), years, weekdays and a 40-seed placebo reported only.
//   node --use-env-proxy research/edge/gold-lbma-fix/run.mjs fetch <dir>   -> <dir>/xau-5m.json.gz (kept out of git)
//   node research/edge/gold-lbma-fix/run.mjs run <dir>                     -> result.json and RESULT.md here
import fs from 'node:fs';
import path from 'node:path';
import zlib from 'node:zlib';
import { fileURLToPath } from 'node:url';

const HERE = path.dirname(fileURLToPath(import.meta.url));

// ---- London time ---------------------------------------------------------------------------------------------------------
export const addD = (s, n) => new Date(Date.parse(s + 'T12:00:00Z') + n * 86400e3).toISOString().slice(0, 10);
export const dowOf = (s) => new Date(s + 'T12:00:00Z').getUTCDay();
export const isWeekday = (s) => { const w = dowOf(s); return w >= 1 && w <= 5; };
const LON = new Intl.DateTimeFormat('en-GB', { timeZone: 'Europe/London', hour: 'numeric', minute: 'numeric', hourCycle: 'h23' });
const offCache = new Map();
// London's offset from UTC in minutes on a date (read at 12:00 UTC; the clocks change at 01:00 UTC)
export function londonOffsetMin(ymd) {
  if (!offCache.has(ymd)) { const [h, m] = LON.format(new Date(ymd + 'T12:00:00Z')).split(':').map(Number); offCache.set(ymd, h * 60 + m - 720); }
  return offCache.get(ymd);
}
// UTC second of London wall-clock minute `min` on London date ymd
export const londonT = (ymd, min) => Date.parse(ymd + 'T00:00:00Z') / 1000 + (min - londonOffsetMin(ymd)) * 60;
export const hm = (min) => `${String(Math.floor(min / 60)).padStart(2, '0')}:${String(min % 60).padStart(2, '0')}`;

// ---- England and Wales bank holidays 2016-2026 (no LBMA auction) ---------------------------------------------------------
export const BANK_HOLIDAYS = new Set([
  '2016-01-01', '2016-03-25', '2016-03-28', '2016-05-02', '2016-05-30', '2016-08-29', '2016-12-26', '2016-12-27',
  '2017-01-02', '2017-04-14', '2017-04-17', '2017-05-01', '2017-05-29', '2017-08-28', '2017-12-25', '2017-12-26',
  '2018-01-01', '2018-03-30', '2018-04-02', '2018-05-07', '2018-05-28', '2018-08-27', '2018-12-25', '2018-12-26',
  '2019-01-01', '2019-04-19', '2019-04-22', '2019-05-06', '2019-05-27', '2019-08-26', '2019-12-25', '2019-12-26',
  '2020-01-01', '2020-04-10', '2020-04-13', '2020-05-08', '2020-05-25', '2020-08-31', '2020-12-25', '2020-12-28',
  '2021-01-01', '2021-04-02', '2021-04-05', '2021-05-03', '2021-05-31', '2021-08-30', '2021-12-27', '2021-12-28',
  '2022-01-03', '2022-04-15', '2022-04-18', '2022-05-02', '2022-06-02', '2022-06-03', '2022-08-29', '2022-09-19', '2022-12-26', '2022-12-27',
  '2023-01-02', '2023-04-07', '2023-04-10', '2023-05-01', '2023-05-08', '2023-05-29', '2023-08-28', '2023-12-25', '2023-12-26',
  '2024-01-01', '2024-03-29', '2024-04-01', '2024-05-06', '2024-05-27', '2024-08-26', '2024-12-25', '2024-12-26',
  '2025-01-01', '2025-04-18', '2025-04-21', '2025-05-05', '2025-05-26', '2025-08-25', '2025-12-25', '2025-12-26',
  '2026-01-01', '2026-04-03', '2026-04-06', '2026-05-04', '2026-05-25', '2026-08-31', '2026-12-25', '2026-12-28',
]);
const noPm = (d) => /-12-(24|31)$/.test(d);   // the PM auction is not held on 24 and 31 December

// ---- the designs ---------------------------------------------------------------------------------------------------------
export const PM = 15 * 60, AM = 10 * 60 + 30;
export const ATR_N = 14, ATR_K = 3, PAD = 0.30, GAP_MAX = 900;
// every time of the two tests for an auction at London minute F
export function design(F) {
  return { w0: F - 90, w1: F + 90,
    T1: { m0: F - 90, m1: F - 5, entry: F - 5, exit: F + 5, atrFrom: F - 75, atrTo: F - 10 },
    T2: { m0: F - 90, m1: F, bar: F, exit: F + 90 } };
}

// ---- costs (council/fills.mjs costModel with council-data ctrader/symbols.json XAUUSD, 14 Nov 2026) ----------------------
export const SPREAD = 0.07, COMMISSION_RT = 0.000024, SLIP_SPREADS = 0.5;
export const costPx = (entry) => SPREAD + 2 * SLIP_SPREADS * SPREAD + COMMISSION_RT * entry;

// ---- prices --------------------------------------------------------------------------------------------------------------
export function index(bars) { const at = new Map(); bars.forEach((b, i) => at.set(b[0], i)); return { bars, at }; }
const iAt = (ix, t) => ix.at.get(t);
// the day's window check: every candle the rule reads exists, and no step over 15 min between candle starts in [w0, w1]
export function dayOk(ix, ymd, F) {
  const d = design(F), T = (m) => londonT(ymd, m);
  const need = [d.T1.m0, d.T1.m1, d.T1.exit, d.T2.bar, d.T2.exit];
  for (let m = d.T1.atrFrom - 5; m <= d.T1.atrTo; m += 5) need.push(m);
  if (need.some((m) => iAt(ix, T(m)) == null)) return false;
  const a = iAt(ix, T(d.w0)), b = iAt(ix, T(d.w1));
  for (let i = a + 1; i <= b; i++) if (ix.bars[i][0] - ix.bars[i - 1][0] > GAP_MAX) return false;
  return true;
}
export function atr(ix, ymd, F) {
  const d = design(F); let s = 0;
  for (let m = d.T1.atrFrom; m <= d.T1.atrTo; m += 5) {
    const b = ix.bars[iAt(ix, londonT(ymd, m))], p = ix.bars[iAt(ix, londonT(ymd, m - 5))];
    s += Math.max(b[2] - b[3], Math.abs(b[2] - p[4]), Math.abs(b[3] - p[4]));
  }
  return s / ATR_N;
}
// stop first, a gap through the stop at the candle's open; else out at the exit price
export function manage(ix, i0, exitT, side, entry, stop, exitPx) {
  for (let i = i0; i < ix.bars.length && ix.bars[i][0] < exitT; i++) {
    const [, o, h, l] = ix.bars[i];
    if (side > 0 ? o <= stop : o >= stop) return { exit: o, how: 'gap' };
    if (side > 0 ? l <= stop : h >= stop) return { exit: stop, how: 'stop' };
  }
  return { exit: exitPx, how: 'time' };
}
const mk = (ymd, F, id, side, entry, stop, out, M) => {
  const D = Math.abs(entry - stop), R = side * (out.exit - entry) / D, c = costPx(entry);
  return { day: ymd, F, id, side, M: +M.toFixed(3), entry, stop: +stop.toFixed(3), D: +D.toFixed(3), exit: out.exit, how: out.how,
    R, costPx: c, costR: c / D, net: R - c / D, net2: R - 2 * c / D };
};
// both trades of one auction on one day (null where M = 0); the caller has checked dayOk
export function trades(ix, ymd, F) {
  const d = design(F), T = (m) => londonT(ymd, m), px = (m) => ix.bars[iAt(ix, T(m))][1], out = {};
  const M1 = px(d.T1.m1) - px(d.T1.m0);
  if (M1 !== 0) {
    const side = Math.sign(M1), e = px(d.T1.entry), stop = e - side * ATR_K * atr(ix, ymd, F);
    out.T1 = mk(ymd, F, 'T1', side, e, stop, manage(ix, iAt(ix, T(d.T1.entry)), T(d.T1.exit), side, e, stop, px(d.T1.exit)), M1);
  }
  const M2 = px(d.T2.m1) - px(d.T2.m0);
  if (M2 !== 0) {
    const side = -Math.sign(M2), b = ix.bars[iAt(ix, T(d.T2.bar))], e = b[4], stop = side < 0 ? b[2] + PAD : b[3] - PAD;
    out.T2 = mk(ymd, F, 'T2', side, e, stop, manage(ix, iAt(ix, T(d.T2.bar)) + 1, T(d.T2.exit), side, e, stop, px(d.T2.exit)), M2);
  }
  return out;
}
// every trade of an auction anchored at F over the days; counts of skipped days
export function runAnchor(ix, days, F, { pm = true } = {}) {
  const out = { T1: [], T2: [] }, counts = { days: 0, holiday: 0, noAuction: 0, gap: 0, flat: { T1: 0, T2: 0 } };
  for (const d of days) {
    if (BANK_HOLIDAYS.has(d)) { counts.holiday++; continue; }
    if (pm && noPm(d)) { counts.noAuction++; continue; }
    if (!dayOk(ix, d, F)) { counts.gap++; continue; }
    counts.days++;
    const t = trades(ix, d, F);
    for (const id of ['T1', 'T2']) if (t[id]) out[id].push(t[id]); else counts.flat[id]++;
  }
  return { ...out, counts };
}

// ---- statistics ----------------------------------------------------------------------------------------------------------
const mean = (a) => a.reduce((s, v) => s + v, 0) / a.length;
const sd = (a) => { const m = mean(a); return Math.sqrt(a.reduce((s, v) => s + (v - m) ** 2, 0) / (a.length - 1)); };
const median = (a) => { const s = [...a].sort((p, q) => p - q), n = s.length; return n % 2 ? s[(n - 1) / 2] : (s[n / 2 - 1] + s[n / 2]) / 2; };
export function monthT(tr, key = 'net') {
  const m = new Map(); for (const t of tr) { const k = t.day.slice(0, 7); m.set(k, (m.get(k) || 0) + t[key]); }
  const v = [...m.values()]; if (v.length < 3) return { months: v.length, t: null };
  return { months: v.length, t: mean(v) / (sd(v) / Math.sqrt(v.length)) };
}
export function normCdf(z) {   // Abramowitz-Stegun 7.1.26
  const x = Math.abs(z) / Math.SQRT2, k = 1 / (1 + 0.3275911 * x);
  const erf = 1 - (((((1.061405429 * k - 1.453152027) * k) + 1.421413741) * k - 0.284496736) * k + 0.254829592) * k * Math.exp(-x * x);
  return z >= 0 ? 0.5 * (1 + erf) : 0.5 * (1 - erf);
}
const r = (v, d = 4) => (v == null ? null : Math.round(v * 10 ** d) / 10 ** d);
export function summary(tr) {
  if (!tr.length) return { n: 0 };
  const net = tr.map((t) => t.net), mt = monthT(tr), mt2 = monthT(tr, 'net2');
  return { n: tr.length, netR: r(mean(net)), grossR: r(mean(tr.map((t) => t.R))), costR: r(mean(tr.map((t) => t.costR))),
    costUsd: r(mean(tr.map((t) => t.costPx)), 3), net2R: r(mean(tr.map((t) => t.net2))), totalR: r(net.reduce((s, v) => s + v, 0), 2),
    months: mt.months, t: r(mt.t, 2), t2: r(mt2.t, 2), win: r(tr.filter((t) => t.net > 0).length / tr.length),
    stopShare: r(tr.filter((t) => t.how !== 'time').length / tr.length), stopUsd: r(median(tr.map((t) => t.D)), 3) };
}
export function holm(ps, alpha = 0.05) {
  const o = ps.map((p, i) => ({ p, i })).sort((a, b) => a.p - b.p), ok = ps.map(() => false), adj = ps.map(() => 1);
  let run = 0, go = true;
  o.forEach(({ p, i }, k) => { run = Math.max(run, Math.min(1, p * (ps.length - k))); adj[i] = run; if (go && p <= alpha / (ps.length - k)) ok[i] = true; else go = false; });
  return { ok, adj };
}
export function mulberry32(a) { return () => { a |= 0; a = (a + 0x6D2B79F5) | 0; let t = Math.imul(a ^ (a >>> 15), 1 | a); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; }

// ---- the study -----------------------------------------------------------------------------------------------------------
export const IS = ['2016-01-01', '2020-12-31'], OOS = ['2021-01-01', null];
export const inWin = (d, [a, b]) => d >= a && (b == null || d <= b);
export const T_BAR = 2, ALPHA = 0.05, MIN_OOS = 100, SEEDS = 40;
// placebo anchors: the whole window F-90..F+90 inside 01:30-21:00 and clear of 13:00-16:30 (F in 03:00-11:30 or 18:00-19:30)
export const PLACEBO_F = (() => { const a = []; for (let F = 180; F <= 1170; F += 5) if (F <= 690 || F >= 1080) a.push(F); return a; })();
export const placeboF = (seed) => PLACEBO_F[Math.floor(mulberry32(seed)() * PLACEBO_F.length)];
export const TESTS = [
  { id: 'T1', name: 'Run-in through the PM auction (sign of 13:30 -> 14:55, in 14:55, out 15:05, stop 3 x ATR(14) M5)' },
  { id: 'T2', name: 'Fade after the PM auction (against 13:30 -> 15:00, in at the 15:00 candle close, stop its extreme + $0.30, out 16:30)' },
];
export function windowed(tr) { return { is: summary(tr.filter((t) => inWin(t.day, IS))), oos: summary(tr.filter((t) => inWin(t.day, OOS))) }; }
export function judge(res) {
  const ps = TESTS.map(({ id }) => (res[id].oos.t == null ? 1 : 1 - normCdf(res[id].oos.t))), h = holm(ps, ALPHA);
  const out = {};
  TESTS.forEach(({ id }, k) => {
    const { is, oos } = res[id], checks = {
      netBoth: is.n > 0 && oos.n > 0 && is.netR > 0 && oos.netR > 0,
      tOos: oos.t != null && oos.t >= T_BAR,
      twiceCost: is.n > 0 && oos.n > 0 && is.net2R > 0 && oos.net2R > 0,
      holm: h.ok[k] };
    const pass = Object.values(checks).every(Boolean);
    out[id] = { checks, p: r(ps[k], 6), pHolm: r(h.adj[k], 6), pass, enough: oos.n >= MIN_OOS };
  });
  const passed = TESTS.filter(({ id }) => out[id].pass).map(({ id }) => id);
  const thin = TESTS.filter(({ id }) => !out[id].pass && !out[id].enough).map(({ id }) => id);
  const verdict = passed.length ? 'PASS' : thin.length ? `NOT MEASURABLE (inconclusive: fewer than ${MIN_OOS} out-of-sample trades in ${thin.join(', ')})` : 'FAIL';
  return { tests: out, passed, verdict };
}
export function study(bars, firstDay, lastDay) {
  const ix = index(bars), days = [];
  for (let d = firstDay; d <= lastDay; d = addD(d, 1)) if (isWeekday(d)) days.push(d);
  const pm = runAnchor(ix, days, PM), am = runAnchor(ix, days, AM, { pm: false });
  const res = Object.fromEntries(TESTS.map(({ id }) => [id, windowed(pm[id])]));
  const j = judge(res);
  const byYear = {}, byDow = {};
  for (const { id } of TESTS) {
    const ys = [...new Set(pm[id].map((t) => t.day.slice(0, 4)))].sort();
    byYear[id] = Object.fromEntries(ys.map((y) => { const s = summary(pm[id].filter((t) => t.day.startsWith(y))); return [y, { n: s.n, netR: s.netR, grossR: s.grossR, totalR: s.totalR }]; }));
    byDow[id] = Object.fromEntries(['Mon', 'Tue', 'Wed', 'Thu', 'Fri'].map((n, k) => { const s = summary(pm[id].filter((t) => dowOf(t.day) === k + 1)); return [n, { n: s.n, netR: s.netR, grossR: s.grossR }]; }));
  }
  const amRes = Object.fromEntries(TESTS.map(({ id }) => [id, windowed(am[id])]));
  const placebo = [];
  for (let s = 1; s <= SEEDS; s++) {
    const F = placeboF(s), run = runAnchor(ix, days, F);
    placebo.push({ seed: s, at: hm(F), T1: windowed(run.T1).oos, T2: windowed(run.T2).oos });
  }
  const plSum = Object.fromEntries(TESTS.map(({ id }) => {
    const v = placebo.map((p) => p[id].netR), real = res[id].oos.netR;
    return [id, { real, below: v.filter((x) => x < real).length, of: v.length, median: r(median(v)), tOver2: placebo.filter((p) => p[id].t != null && p[id].t >= T_BAR).length }];
  }));
  return { res, judge: j, counts: { pm: pm.counts, am: am.counts }, byYear, byDow, am: amRes, placebo, placeboSummary: plSum,
    trades: Object.fromEntries(TESTS.map(({ id }) => [id, pm[id].filter((t) => inWin(t.day, OOS) || inWin(t.day, IS))])) };
}

// ---- report --------------------------------------------------------------------------------------------------------------
const sg = (v, d = 3) => (v == null ? 'n/a' : `${v >= 0 ? '+' : '−'}${Math.abs(v).toFixed(d)}`);
const row = (lab, s) => `| ${lab} | ${s.n} | ${sg(s.grossR)} | ${s.costR == null ? 'n/a' : s.costR.toFixed(3)} ($${s.costUsd == null ? 'n/a' : s.costUsd.toFixed(2)}) | ${sg(s.netR)} | ${sg(s.net2R)} | ${s.t == null ? 'n/a' : s.t.toFixed(2)} | ${s.months} | $${s.stopUsd == null ? 'n/a' : s.stopUsd.toFixed(2)} | ${s.stopShare == null ? 'n/a' : (100 * s.stopShare).toFixed(0)}% |`;
export function report(o) {
  const L = [], J = { tests: o.checks }, R = o.result;
  L.push('# Gold LBMA auctions: the run into the PM auction and the fade after it', '');
  L.push(`Pre-registered in PREREGISTRATION.md (pushed before any result). Spot gold, OANDA mid M5 ${o.candles.from.slice(0, 10)} to ${o.candles.to.slice(0, 10)}, London time with BST, net of the measured gold cost model.`, '');
  L.push(`**Verdict: ${o.verdict}.** Nothing here is an edge; nothing live changed.`, '');
  L.push('## The two tests (PM auction, 15:00 London)', '');
  L.push('| Test / window | n | gross R | cost R ($) | net R | net R at 2x cost | month t (net) | months | median stop | stopped |', '|---|---|---|---|---|---|---|---|---|---|');
  for (const { id, name } of TESTS) { L.push(row(`${id} in sample 2016-20`, R[id].is), row(`${id} out of sample 2021-now`, R[id].oos)); }
  L.push('', TESTS.map(({ id, name }) => `- ${id}: ${name}.`).join('\n'), '');
  L.push('Pass checks (all must hold):', '');
  for (const { id } of TESTS) { const c = J.tests[id].checks; L.push(`- ${id}: net > 0 both windows ${c.netBoth ? 'yes' : 'no'}; out-of-sample month t >= 2 ${c.tOos ? 'yes' : 'no'}; net > 0 at 2x cost both windows ${c.twiceCost ? 'yes' : 'no'}; Holm (p ${J.tests[id].p}, adjusted ${J.tests[id].pHolm}) ${c.holm ? 'yes' : 'no'}.`); }
  L.push('', `Costs: spread $${SPREAD.toFixed(2)} (median quote) + commission ${COMMISSION_RT} x price + half a spread of slippage on each market order = $${(2 * SPREAD).toFixed(2)} + ${COMMISSION_RT} x price a round trip (the "cost R ($)" column is the mean per trade).`, '');
  const c = o.counts.pm; L.push(`Days (PM): ${c.days} traded, ${c.holiday} bank holidays, ${c.noAuction} on 24 / 31 December, ${c.gap} with a gap; M = 0 on ${c.flat.T1} (T1) / ${c.flat.T2} (T2).`, '');
  L.push('## Reported only', '', '### The AM auction (10:30 London), same designs shifted by -4 h 30 min', '');
  L.push('| Test / window | n | gross R | cost R ($) | net R | net R at 2x cost | month t (net) | months | median stop | stopped |', '|---|---|---|---|---|---|---|---|---|---|');
  for (const { id } of TESTS) L.push(row(`AM ${id} in sample`, o.am[id].is), row(`AM ${id} out of sample`, o.am[id].oos));
  L.push('', '### PM tests by year (net R a trade, n)', '', '| Year | T1 n | T1 net R | T2 n | T2 net R |', '|---|---|---|---|---|');
  for (const y of Object.keys(o.byYear.T1)) { const a = o.byYear.T1[y], b = o.byYear.T2[y] || {}; L.push(`| ${y} | ${a.n} | ${sg(a.netR)} | ${b.n ?? 0} | ${sg(b.netR)} |`); }
  L.push('', '### PM tests by London weekday (all years)', '', '| Day | T1 n | T1 net R | T2 n | T2 net R |', '|---|---|---|---|---|');
  for (const dn of Object.keys(o.byDow.T1)) { const a = o.byDow.T1[dn], b = o.byDow.T2[dn]; L.push(`| ${dn} | ${a.n} | ${sg(a.netR)} | ${b.n} | ${sg(b.netR)} |`); }
  L.push('', '### Placebo: 40 seeded anchors outside 13:00-16:30 London, same designs (out of sample, net R a trade)', '');
  for (const { id } of TESTS) { const p = o.placeboSummary[id]; L.push(`- ${id}: the auction's ${sg(p.real)}R is above ${p.below} of ${p.of} placebo runs (placebo median ${sg(p.median)}R); ${p.tOver2} placebo runs reach month t >= 2.`); }
  L.push('', 'Context only, not part of the verdict.', '');
  L.push('## Reading', '', ...o.reading, '');
  L.push('## To repeat', '', '`node --use-env-proxy research/edge/gold-lbma-fix/run.mjs fetch <dir>` (candles outside git), then `node research/edge/gold-lbma-fix/run.mjs run <dir>`. Tests: `tests/gold-lbma-fix.test.mjs`.', '');
  return L.join('\n');
}

// written after the first run (the figures are read from result.json by the test)
export const READING = [
  '- **Before costs there is nothing to trade.** T1 (riding the 13:30-14:55 move through the auction) makes −0.006R a trade before costs in 2016-20 and +0.003R in 2021-now: the direction of the run-in says nothing about the auction minutes. Its 3 x ATR stop is hit on about 3 % of trades, so its R is mostly the ten-minute move divided by a wide stop, and the cost (0.02-0.04R) decides the sign.',
  '- **The fade after the PM auction made +0.068R a trade before costs in 2016-20 (2018-20 positive every year) and −0.019R in 2021-now**: the reversal some published studies describe was there in the late 2010s and is not there since. Its stop ($0.30 past the auction candle, median $1.13 / $2.03) is tight, so the $0.17-0.20 cost is 0.14-0.19R a trade and the fade loses net in both windows (month t −1.92 and −2.81).',
  '- The AM auction (10:30) is no better: the run-in is about zero before costs in both windows; the fade is −0.040R before costs in 2016-20 and +0.049R since (−0.310R and −0.171R after costs), the PM pattern the other way round in time.',
  '- The placebo anchors outside 13:00-16:30 lose more a trade (median −0.046R for T1, −0.218R for T2), mainly because quieter hours give smaller stops and so more R of cost; the auction is better than most placebo runs only in losing less. No placebo run reaches month t 2.',
  '- Departures from the pre-registration, none affecting a figure of the verdict: the candle file is one fetched through the same proxy on 13-14 Nov 2026 for another study (spot-checked candle for candle against a fresh proxy answer), cut to 1 Dec 2015 on; the placebo anchors are those of the parenthesis (03:00-11:30, 18:00-19:30), so an 11:30 anchor ends its window at the 13:00 open.',
  '- So: no run into the gold PM auction and no fade after it, in the form tested, as with the forex 16:00 fix (`london-fix`). Not a council rule, no proposal. A wider stop or a size filter on the move were not tested and would need their own pre-registration on other data.',
];

// ---- CLI -----------------------------------------------------------------------------------------------------------------
const MODE = process.argv[2], DIR = process.argv[3];
const iso = (t) => new Date(t * 1000).toISOString();
if (MODE === 'fetch') {
  const BASE = process.env.MD_BASE || 'https://meridianx.dev/md/', sleep = (ms) => new Promise((res) => setTimeout(res, ms));
  const from = Date.UTC(2015, 11, 1) / 1000, end = Math.floor(Date.now() / 1000 / 86400) * 86400, m = new Map();
  for (let a = from; a < end;) {
    const b = Math.min(end, a + 4999 * 300); let j = null, err = '';
    for (let k = 0; k < 6 && !j; k++) { try { const res = await fetch(`${BASE}bars?sym=xau&tf=5m&from=${a}&to=${b}`, { signal: AbortSignal.timeout(40000) }); const x = res.ok ? await res.json() : null; if (x && x.src === 'OANDA' && Array.isArray(x.bars)) j = x; else err = `HTTP ${res.status}`; } catch (e) { err = String(e.message || e); } if (!j) await sleep(2000 * (k + 1)); }
    if (!j) throw new Error(`xau 5m ${iso(a)}: ${err}`);
    for (const x of j.bars) if (!x.live && x.time >= a && x.time < b) m.set(+x.time, [+x.time, +x.open, +x.high, +x.low, +x.close]);
    a = b; await sleep(80);
  }
  const rows = [...m.values()].sort((p, q) => p[0] - q[0]);
  fs.mkdirSync(DIR, { recursive: true }); fs.writeFileSync(path.join(DIR, 'xau-5m.json.gz'), zlib.gzipSync(JSON.stringify(rows)));
  console.log(`xau 5m: ${rows.length} candles ${iso(rows[0][0])} -> ${iso(rows.at(-1)[0])}`);
}
if (MODE === 'run') {
  const bars = JSON.parse(zlib.gunzipSync(fs.readFileSync(path.join(DIR, 'xau-5m.json.gz')))).filter((b) => b[0] >= Date.UTC(2015, 11, 1) / 1000);
  const lastDay = iso(bars.at(-1)[0]).slice(0, 10);
  const S = study(bars, '2016-01-01', lastDay);
  const out = { topic: 'gold-lbma-fix', built: '2026-11-14', at: new Date().toISOString(),
    system: 'LBMA gold PM auction (15:00 London): run-in through it and fade after it, spot gold OANDA mid M5, net of the measured gold cost model',
    candles: { m5: bars.length, from: iso(bars[0][0]), to: iso(bars.at(-1)[0]) },
    windows: { inSample: '2016-01-01 to 2020-12-31', outOfSample: `2021-01-01 to ${lastDay}` },
    params: { PM: hm(PM), AM: hm(AM), ATR_N, ATR_K, PAD, GAP_MAX, SPREAD, COMMISSION_RT, SLIP_SPREADS, T_BAR, ALPHA, MIN_OOS, SEEDS },
    result: S.res, checks: S.judge.tests, verdict: '', counts: S.counts, am: S.am, byYear: S.byYear, byDow: S.byDow, placebo: S.placebo, placeboSummary: S.placeboSummary };
  const J = S.judge, R = S.res;
  out.verdict = `${J.verdict}: ` + TESTS.map(({ id }) => `${id} ${J.tests[id].pass ? 'PASS' : 'FAIL'} (out of sample ${sg(R[id].oos.netR)}R a trade net, n ${R[id].oos.n}, month t ${R[id].oos.t}; in sample ${sg(R[id].is.netR)}R, n ${R[id].is.n})`).join('; ');
  out.candidates = TESTS.map(({ id, name }) => ({ rule: `${id}: ${name}`, verdict: J.tests[id].pass ? 'PASS' : 'FAIL', is: R[id].is, oos: R[id].oos }));
  const best = TESTS.map(({ id }) => id).sort((a, b) => (R[b].oos.t ?? -99) - (R[a].oos.t ?? -99))[0];
  out.tradesOf = best;
  out.trades = S.trades[best].sort((a, b) => a.day.localeCompare(b.day)).map((t) => ({ d: t.day, side: t.side > 0 ? 'buy' : 'sell', R: +t.net.toFixed(4) }));
  out.reading = READING;
  fs.writeFileSync(path.join(HERE, 'result.json'), JSON.stringify(out, null, 1) + '\n');
  fs.writeFileSync(path.join(HERE, 'RESULT.md'), report(out));
  console.log(out.verdict);
  for (const { id } of TESTS) console.log(id, JSON.stringify(R[id]));
  console.log('AM', JSON.stringify(S.am)); console.log('counts', JSON.stringify(S.counts)); console.log('placebo', JSON.stringify(S.placeboSummary));
  console.log('byYear', JSON.stringify(S.byYear));
}
