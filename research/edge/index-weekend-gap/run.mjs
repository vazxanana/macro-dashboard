// Edge research · index-weekend-gap: when a US index CFD (US500, NAS100, US30) reopens on Sunday 18:00 New York with a gap
// larger than 0.5 x its 20-day ATR against Friday's 17:00 close, fade it at the first M5 close: target Friday's close, stop
// 1 x ATR beyond the entry, out at Monday 09:30 New York. Net of the index spread (trend-breadth COST.index) and one night of
// financing. Decided on 2016 to now; 2008-15 replicates. Rules, costs, windows, placebo and bar: PREREGISTRATION.md
// (committed before this file existed). Paper research only: nothing here trades or changes a live rule.
//   node --use-env-proxy research/edge/index-weekend-gap/fetch.mjs <dir>    (candles, kept out of the repository)
//   node research/edge/index-weekend-gap/run.mjs full <dir>                  -> result.json + RESULT.md
import fs from 'node:fs';
import path from 'node:path';
import zlib from 'node:zlib';
import { fileURLToPath } from 'node:url';
import { nyOffsetH } from '../../../council/histdata.mjs';
import { cmeShut } from '../../../ict/calendar.mjs';

const HERE = path.dirname(fileURLToPath(import.meta.url));
export const MARKETS = { T1: 'spx500', T2: 'nas100', T3: 'us30' };
export const NAME = { spx500: 'US500', nas100: 'NAS100', us30: 'US30' };
export const K = {
  M5: 300, ATR_N: 20, DAY_MIN: 100, GAP_MIN: 0.5, STOP_ATR: 1, COST: 0.0003, FIN_ADD: 2.5, NIGHTS: 1,
  N_MIN: 30, N_MIN_P: 60, ALPHA: 0.02275, SEEDS: 40,
  REP: ['2008-01-01', '2015-12-31'], DEC_FROM: '2016-01-01',
};
export const BINS = [[0, 0.25], [0.25, 0.5], [0.5, 1.0], [1.0, Infinity]];

// ─── New York time ───
// unix time of a New York wall-clock moment (US daylight saving: council/histdata.mjs nyOffsetH)
export function nyTime(y, mo, d, h, mi = 0) { const u = Date.UTC(y, mo - 1, d, h, mi) / 1000; return u + nyOffsetH(u + 5 * 3600) * 3600; }
export function nyParts(t) { const d = new Date((t - nyOffsetH(t) * 3600) * 1000); return { y: d.getUTCFullYear(), mo: d.getUTCMonth() + 1, d: d.getUTCDate(), wd: d.getUTCDay(), h: d.getUTCHours(), mi: d.getUTCMinutes() }; }
export const dayNo = (p) => Date.UTC(p.y, p.mo - 1, p.d) / 86400000;
export const ofDayNo = (n) => { const d = new Date(n * 86400000); return { y: d.getUTCFullYear(), mo: d.getUTCMonth() + 1, d: d.getUTCDate() }; };
export const ymdOf = (n) => new Date(n * 86400000).toISOString().slice(0, 10);
export const lowerT = (B, t) => { let a = 0, b = B.length; while (a < b) { const m = (a + b) >> 1; if (B[m].time < t) a = m + 1; else b = m; } return a; };
// CFD weekend: Friday from 17:00 to Sunday 18:00 New York
const weekendShut = (p) => p.wd === 6 || (p.wd === 5 && p.h >= 17) || (p.wd === 0 && p.h < 18);
// is CME shut (holiday / early close / weekend) at the start of any 5-minute slot in [a, b)?
export function anyShut(a, b) { for (let t = a; t < b; t += K.M5) if (cmeShut(t)) return true; return false; }

// ─── CFD days (17:00 to 17:00 New York, named by the date they end on) and ATR20 ───
export function cfdDays(M5) {
  const out = [];
  for (const b of M5) {
    const p = nyParts(b.time); if (weekendShut(p)) continue;
    const key = dayNo(nyParts(b.time + 7 * 3600)), c = out.at(-1);
    if (!c || c.key !== key) out.push({ key, o: b.open, h: b.high, l: b.low, c: b.close, n: 1 });
    else { if (b.high > c.h) c.h = b.high; if (b.low < c.l) c.l = b.low; c.c = b.close; c.n++; }
  }
  return out.filter((d) => d.n >= K.DAY_MIN);
}
// ATR20 of the 20 complete CFD days ending with the day named `key` (that day included; nothing after it is read)
export function atrAt(days, key) {
  let a = 0, b = days.length; while (a < b) { const m = (a + b) >> 1; if (days[m].key <= key) a = m + 1; else b = m; }
  const j = a - 1; if (j < K.ATR_N || days[j].key !== key) return null;
  let s = 0; for (let i = j - K.ATR_N + 1; i <= j; i++) s += Math.max(days[i].h - days[i].l, Math.abs(days[i].h - days[i - 1].c), Math.abs(days[i].l - days[i - 1].c));
  return s / K.ATR_N;
}

// ─── costs ───
export function rateOf(dgs2, date) { let lo = 0, hi = dgs2.length; while (lo < hi) { const m = (lo + hi) >> 1; if (dgs2[m][0] <= date) lo = m + 1; else hi = m; } return lo ? dgs2[lo - 1][1] : dgs2[0][1]; }
// one night: a long pays US 2Y + 2.5 %, a short pays max(0, 2.5 % - US 2Y), a year, / 365
export function finRate(side, r2y) { return side > 0 ? (r2y + K.FIN_ADD) : Math.max(0, K.FIN_ADD - r2y); }

// ─── one trade: fade the move from `ref` at the close of candle iR, target ref, stop 1 x ATR, out at endT ───
export function fadeTrade(M5, iR, ref, atr, endT, r2y) {
  const gap = M5[iR].open - ref, side = gap > 0 ? -1 : 1, entry = M5[iR].close;
  if (side * (ref - entry) <= 0) return { skip: 'filled' };
  const r0 = K.STOP_ATR * atr, stop = entry - side * r0, target = ref;
  let lastK = iR, out = null;
  for (let k = iR + 1; k < M5.length && M5[k].time + K.M5 <= endT; k++) {
    const b = M5[k];
    if (side > 0 ? b.open <= stop : b.open >= stop) { out = [b.time, b.open, 'stop (gap)']; break; }
    if (side > 0 ? b.low <= stop : b.high >= stop) { out = [b.time, stop, 'stop']; break; }
    if (side > 0 ? b.high >= target : b.low <= target) { out = [b.time, target, 'target']; break; }
    lastK = k;
  }
  if (!out) out = [M5[lastK].time + K.M5, M5[lastK].close, 'time'];
  const [exitT, exitPx, exit] = out, R = (side * (exitPx - entry)) / r0;
  const spreadR = (K.COST * entry) / r0, finR = (K.NIGHTS * finRate(side, r2y) / 100 / 365 * entry) / r0;
  return { side, entry, ref, gap, atr, r0, stop, target, filledT: M5[iR].time + K.M5, exitT, exitPx, exit, R, spreadR, finR, net: R - spreadR - finR, net2: R - 2 * spreadR - finR };
}

// ─── the weekends ───
const HOL = new Map(); // Friday day number -> holiday weekend? (the same for every market)
export function holidayWeekend(n) {
  if (HOL.has(n)) return HOL.get(n);
  const fr = ofDayNo(n), su = ofDayNo(n + 2), mo = ofDayNo(n + 3);
  const v = anyShut(nyTime(fr.y, fr.mo, fr.d, 12), nyTime(fr.y, fr.mo, fr.d, 17)) || anyShut(nyTime(su.y, su.mo, su.d, 18), nyTime(mo.y, mo.mo, mo.d, 9, 30));
  HOL.set(n, v); return v;
}
export function weeks(M5, days = cfdDays(M5)) {
  const out = [], last = M5.at(-1).time;
  let n = dayNo(nyParts(M5[0].time)); while (new Date(n * 86400000).getUTCDay() !== 5) n++;
  for (; ; n += 7) {
    const fr = ofDayNo(n), su = ofDayNo(n + 2), mo = ofDayNo(n + 3);
    const F = nyTime(fr.y, fr.mo, fr.d, 17), sun18 = nyTime(su.y, su.mo, su.d, 18), sun21 = nyTime(su.y, su.mo, su.d, 21), end = nyTime(mo.y, mo.mo, mo.d, 9, 30);
    if (end > last + K.M5) break;
    const w = { fri: ymdOf(n), F, sun18, end };
    if (holidayWeekend(n)) { out.push({ ...w, skip: 'holiday' }); continue; }
    const iF = lowerT(M5, F) - 1, pf = iF >= 0 ? nyParts(M5[iF].time) : null;
    if (!pf || dayNo(pf) !== n || pf.h < 12) { out.push({ ...w, skip: 'friday' }); continue; }
    const iR = lowerT(M5, sun18);
    if (iR >= M5.length || M5[iR].time >= sun21) { out.push({ ...w, skip: 'reopen' }); continue; }
    const atr = atrAt(days, n); if (atr == null) { out.push({ ...w, skip: 'atr' }); continue; }
    const fc = M5[iF].close, gap = M5[iR].open - fc;
    out.push({ ...w, iF, iR, fc, gap, atr, gapAtr: Math.abs(gap) / atr });
  }
  return out;
}
const touched = (M5, a, endT, px) => { for (let k = a; k < M5.length && M5[k].time + K.M5 <= endT; k++) if (M5[k].low <= px && M5[k].high >= px) return true; return false; };

// ─── placebo pool: Monday to Thursday evenings, the move from 14:00 to the 18:00 reopen ───
export function evenings(M5, days = cfdDays(M5)) {
  const out = [], first = dayNo(nyParts(M5[0].time)), lastN = dayNo(nyParts(M5.at(-1).time));
  for (let n = first; n < lastN; n++) {
    const wd = new Date(n * 86400000).getUTCDay(); if (wd < 1 || wd > 4) continue;
    const d = ofDayNo(n), nx = ofDayNo(n + 1);
    const t12 = nyTime(d.y, d.mo, d.d, 12), t14 = nyTime(d.y, d.mo, d.d, 14), t17 = nyTime(d.y, d.mo, d.d, 17), t18 = nyTime(d.y, d.mo, d.d, 18), t21 = nyTime(d.y, d.mo, d.d, 21), end = nyTime(nx.y, nx.mo, nx.d, 9, 30);
    if (anyShut(t14, t17) || anyShut(t18, end)) continue;
    const iRef = lowerT(M5, t14) - 1; if (iRef < 0 || M5[iRef].time < t12) continue;
    const iR = lowerT(M5, t18); if (iR >= M5.length || M5[iR].time >= t21) continue;
    const atr = atrAt(days, n); if (atr == null) continue;
    const ref = M5[iRef].close, move = M5[iR].open - ref;
    if (Math.abs(move) > K.GAP_MIN * atr) out.push({ date: ymdOf(n), iR, ref, atr, end });
  }
  return out;
}

// ─── statistics ───
export function mulberry(seed) { let a = seed >>> 0; return () => { a = (a + 0x6d2b79f5) >>> 0; let t = a; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; }
const mean = (a) => (a.length ? a.reduce((s, x) => s + x, 0) / a.length : 0);
const sd = (a) => { if (a.length < 2) return 0; const m = mean(a); return Math.sqrt(a.reduce((s, x) => s + (x - m) ** 2, 0) / (a.length - 1)); };
export const tOf = (a) => { const s = sd(a); return s > 0 ? mean(a) / (s / Math.sqrt(a.length)) : 0; };
export const normP = (t) => { // one-sided p = P(Z >= t)
  const z = t / Math.SQRT2, x = Math.abs(z), k = 1 / (1 + 0.3275911 * x), e = 1 - (((((1.061405429 * k - 1.453152027) * k) + 1.421413741) * k - 0.284496736) * k + 0.254829592) * k * Math.exp(-x * x);
  return 0.5 * (1 - (z >= 0 ? e : -e)); };
export function holm(ps, alpha = K.ALPHA) { const o = ps.map((p, i) => [p, i]).sort((a, b) => a[0] - b[0]), ok = ps.map(() => false);
  for (let r = 0; r < o.length; r++) { if (o[r][0] <= alpha / (o.length - r)) ok[o[r][1]] = true; else break; } return ok; }
const r4 = (x) => +x.toFixed(4);
export function monthSums(T) { const m = new Map(); for (const t of T) { const k = t.fri.slice(0, 7); m.set(k, (m.get(k) || 0) + t.net); } return m; }
export function stats(T0) {
  const T = T0.slice().sort((a, b) => a.filledT - b.filledT), net = T.map((t) => t.net), ex = {};
  for (const t of T) ex[t.exit] = (ex[t.exit] || 0) + 1;
  let cum = 0, hi = 0, dd = 0; for (const x of net) { cum += x; if (cum > hi) hi = cum; if (hi - cum > dd) dd = hi - cum; }
  const mon = monthSums(T);
  return { n: T.length, fill: T.length ? r4(T.filter((t) => t.exit === 'target').length / T.length) : 0, win: T.length ? r4(T.filter((t) => t.R > 0).length / T.length) : 0,
    gross: r4(mean(T.map((t) => t.R))), spreadR: r4(mean(T.map((t) => t.spreadR))), finR: r4(mean(T.map((t) => t.finR))), net: r4(mean(net)), net2: r4(mean(T.map((t) => t.net2))),
    t: r4(tOf(net)), months: mon.size, tMonth: r4(tOf([...mon.values()])), total: r4(cum), maxDD: r4(dd), exits: ex };
}
const inWin = (w) => (t) => (w === 'rep' ? t.fri >= K.REP[0] && t.fri <= K.REP[1] : t.fri >= K.DEC_FROM);
const byYear = (T) => { const by = {}; for (const t of T) (by[t.fri.slice(0, 4)] ||= []).push(t);
  return Object.fromEntries(Object.entries(by).sort().map(([y, a]) => [y, { n: a.length, net: r4(mean(a.map((t) => t.net))), total: r4(a.reduce((s, t) => s + t.net, 0)) }])); };

// one market: weeks, trades, plain fill rows, placebo pool
export function marketStudy(sym, M5, dgs2) {
  const days = cfdDays(M5), W = weeks(M5, days).filter((w) => w.fri >= K.REP[0]), skipped = {}, noTrade = {}, trades = [];
  for (const w of W) if (w.skip) skipped[w.skip] = (skipped[w.skip] || 0) + 1;
  const used = W.filter((w) => !w.skip);
  for (const w of used) {
    if (w.gapAtr <= K.GAP_MIN) continue;
    const tr = fadeTrade(M5, w.iR, w.fc, w.atr, w.end, rateOf(dgs2, w.fri));
    if (tr.skip) { noTrade[tr.skip] = (noTrade[tr.skip] || 0) + 1; continue; }
    trades.push({ sym, fri: w.fri, gapAtr: w.gapAtr, ...tr });
  }
  const fillW = used.map((w) => ({ fri: w.fri, gap: w.gap, gapAtr: w.gapAtr, filled: touched(M5, w.iR, w.end, w.fc) }));
  const pool = evenings(M5, days).filter((e) => e.date >= K.REP[0]);
  return { sym, weeks: { total: W.length, used: used.length, skipped, eligible: used.filter((w) => w.gapAtr > K.GAP_MIN).length }, noTrade, trades, fillW, pool, M5, dgs2 };
}
function fillTable(fw) {
  const row = (a) => { const k = a.filter((w) => w.filled).length; return { n: a.length, filled: k, rate: a.length ? r4(k / a.length) : null }; };
  const out = {}; for (const win of ['rep', 'dec']) out[win] = BINS.map(([a, b]) => { const ws = fw.filter((w) => inWin(win)(w) && w.gapAtr >= a && w.gapAtr < b);
    return { bin: `${a}-${b === Infinity ? 'up' : b}`, all: row(ws), up: row(ws.filter((w) => w.gap > 0)), down: row(ws.filter((w) => w.gap < 0)) }; });
  return out;
}
// placebo: per seed, per market and window, as many pool evenings as the real trades, the same fade
function placebo(S) {
  const runs = [];
  for (let seed = 1; seed <= K.SEEDS; seed++) {
    const rnd = mulberry(seed), all = [];
    for (const s of S) for (const win of ['rep', 'dec']) {
      const need = s.trades.filter(inWin(win)).length, pool = s.pool.filter((e) => inWin(win)({ fri: e.date }));
      if (!need || !pool.length) continue;
      const pick = [];
      if (pool.length >= need) { const idx = pool.map((_, i) => i); for (let i = 0; i < need; i++) { const j = i + Math.floor(rnd() * (idx.length - i)); [idx[i], idx[j]] = [idx[j], idx[i]]; pick.push(pool[idx[i]]); } }
      else for (let i = 0; i < need; i++) pick.push(pool[Math.floor(rnd() * pool.length)]);
      for (const e of pick) { const tr = fadeTrade(s.M5, e.iR, e.ref, e.atr, e.end, rateOf(s.dgs2, e.date)); if (!tr.skip) all.push({ ...tr, fri: e.date, win }); }
    }
    runs.push({ seed, dec: r4(mean(all.filter((x) => x.win === 'dec').map((x) => x.net))), rep: r4(mean(all.filter((x) => x.win === 'rep').map((x) => x.net))),
      decN: all.filter((x) => x.win === 'dec').length });
  }
  const pd = runs.map((p) => p.dec).sort((a, b) => a - b), q = (f) => pd[Math.min(pd.length - 1, Math.floor(f * pd.length))];
  return { seeds: K.SEEDS, pools: Object.fromEntries(S.map((s) => [s.sym, { rep: s.pool.filter((e) => e.date <= K.REP[1]).length, dec: s.pool.filter((e) => e.date >= K.DEC_FROM).length }])),
    dec: { min: pd[0], p5: q(0.05), p50: q(0.5), p95: q(0.95), max: pd.at(-1) }, runs };
}

export function study(data, dgs2) { // data: { sym: M5 }
  const S = Object.entries(data).map(([sym, M5]) => marketStudy(sym, M5, dgs2));
  const bySym = Object.fromEntries(S.map((s) => [s.sym, s]));
  const tests = {};
  for (const [k, sym] of Object.entries(MARKETS)) { const T = bySym[sym].trades;
    tests[k] = { market: NAME[sym], sym, weeks: bySym[sym].weeks, noTrade: bySym[sym].noTrade, rep: stats(T.filter(inWin('rep'))), dec: stats(T.filter(inWin('dec'))), byYear: byYear(T) }; }
  const all = S.flatMap((s) => s.trades), noP = {};
  for (const s of S) for (const [x, n] of Object.entries(s.noTrade)) noP[x] = (noP[x] || 0) + n;
  tests.P = { market: 'pooled', noTrade: noP, rep: stats(all.filter(inWin('rep'))), dec: stats(all.filter(inWin('dec'))), byYear: byYear(all) };
  const ks = ['T1', 'T2', 'T3'], ps = ks.map((k) => normP(tests[k].dec.tMonth)), hok = holm(ps);
  ks.forEach((k, i) => { tests[k].p = r4(ps[i]); tests[k].holm = hok[i]; });
  tests.P.p = r4(normP(tests.P.dec.tMonth)); tests.P.holm = tests.P.p <= K.ALPHA;
  for (const k of [...ks, 'P']) { const d = tests[k].dec, r = tests[k].rep;
    const c = { netPos: d.net > 0, net2Pos: d.net2 > 0, tPass: tests[k].holm, nMin: d.n >= (k === 'P' ? K.N_MIN_P : K.N_MIN), repPos: r.net > 0 };
    tests[k].checks = c; tests[k].pass = Object.values(c).every(Boolean); }
  const pl = placebo(S);
  pl.realP = tests.P.dec.net; pl.atOrAbove = pl.runs.filter((x) => x.dec >= tests.P.dec.net).length;
  const pass = [...ks, 'P'].some((k) => tests[k].pass), robust = tests.P.dec.net > pl.dec.p95;
  return { tests, pass, robust, placebo: pl,
    fill: { pooled: fillTable(S.flatMap((s) => s.fillW)), bySym: Object.fromEntries(S.map((s) => [s.sym, fillTable(s.fillW)])) },
    trades: all.sort((a, b) => a.filledT - b.filledT).map((t) => [t.sym, t.fri, t.side, +t.gapAtr.toFixed(3), +t.entry.toFixed(2), +t.ref.toFixed(2), +t.r0.toFixed(2), +t.exitPx.toFixed(2), t.exit, r4(t.R), r4(t.net), r4(t.net2)]) };
}

// ─── RESULT.md from result.json ───
const f = (x, d = 3) => (x == null ? 'n/a' : (x > 0 ? '+' : x < 0 ? '−' : '') + Math.abs(x).toFixed(d));
const pc = (x) => (x == null ? 'n/a' : `${(x * 100).toFixed(1)} %`);
const yn = (b) => (b ? 'yes' : 'no');
export function report(res) {
  const L = [], T = res.tests, pl = res.placebo;
  L.push('# US index CFDs\' Sunday-reopen gap fade: result', '');
  L.push(`Pre-registered in PREREGISTRATION.md (committed before this study's code existed or any trade was simulated). Built ${res.built}. Paper research only: nothing live changed.`, '');
  L.push(`## Verdict: ${res.verdict}`, '');
  L.push(`Decisive window ${res.window.decisive}: pooled ${f(T.P.dec.net)}R a trade after costs (n ${T.P.dec.n}, month-sum t ${f(T.P.dec.tMonth, 2)}, ${f(T.P.dec.gross)}R before costs, fill rate ${pc(T.P.dec.fill)}); ` +
    `US500 ${f(T.T1.dec.net)}R (n ${T.T1.dec.n}, t ${f(T.T1.dec.tMonth, 2)}), NAS100 ${f(T.T2.dec.net)}R (n ${T.T2.dec.n}, t ${f(T.T2.dec.tMonth, 2)}), US30 ${f(T.T3.dec.net)}R (n ${T.T3.dec.n}, t ${f(T.T3.dec.tMonth, 2)}). ` +
    `Placebo (weekday evenings, same rule, 40 seeds): decisive pooled mean p5 / p50 / p95 ${f(pl.dec.p5)} / ${f(pl.dec.p50)} / ${f(pl.dec.p95)}R; ${pl.atOrAbove} of 40 at or above the real ${f(pl.realP)}R.`, '');
  L.push('| Test | Window | n | Fill rate | Win | Gross R | Spread R | Financing R | Net R | Net R at 2x spread | Trade t | Month-sum t | Total net R | Max DD R |');
  L.push('|---|---|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|');
  for (const k of ['T1', 'T2', 'T3', 'P']) for (const w of ['dec', 'rep']) { const s = T[k][w];
    L.push(`| ${k} ${T[k].market} | ${w === 'dec' ? '2016-26' : '2008-15'} | ${s.n} | ${pc(s.fill)} | ${pc(s.win)} | ${f(s.gross)} | ${f(-s.spreadR)} | ${f(-s.finR)} | ${f(s.net)} | ${f(s.net2)} | ${f(s.t, 2)} | ${f(s.tMonth, 2)} | ${f(s.total, 1)} | ${s.maxDD.toFixed(1)} |`); }
  L.push('', '## Pass conditions (decisive window)', '', '| Test | net > 0 | net > 0 at 2x spread | month-sum t (Holm for T1-T3, alone for P) | n ≥ 30 / 60 | replication net > 0 | Pass |', '|---|---|---|---|---|---|---|');
  for (const k of ['T1', 'T2', 'T3', 'P']) { const c = T[k].checks; L.push(`| ${k} | ${yn(c.netPos)} | ${yn(c.net2Pos)} | ${yn(c.tPass)} (p ${T[k].p}) | ${yn(c.nMin)} | ${yn(c.repPos)} | ${yn(T[k].pass)} |`); }
  L.push('', '## Placebo', '', `Weekday (Monday-Thursday) evenings with a 14:00 → 18:00 New York move over 0.5 × ATR20, faded the same way (target the 14:00 price, 1 × ATR stop, out at 09:30 the next day, the same costs), drawn to the real trade counts per market and window. Pool sizes: ${Object.entries(pl.pools).map(([s, p]) => `${NAME[s]} ${p.rep} (2008-15) / ${p.dec} (2016-26)`).join(', ')}. Decisive pooled mean net R over 40 seeds: min ${f(pl.dec.min)}, p5 ${f(pl.dec.p5)}, median ${f(pl.dec.p50)}, p95 ${f(pl.dec.p95)}, max ${f(pl.dec.max)}; the real pooled ${f(pl.realP)}R (${pl.atOrAbove} of 40 seeds at or above it).`, '');
  L.push('## How often the gap fills (every used week, before Monday 09:30 New York, pooled)', '', '| |gap| / ATR20 | 2008-15 weeks | filled | rate | 2016-26 weeks | filled | rate |', '|---|---:|---:|---:|---:|---:|---:|');
  res.fill.pooled.dec.forEach((d, i) => { const r = res.fill.pooled.rep[i]; L.push(`| ${d.bin} | ${r.all.n} | ${r.all.filled} | ${pc(r.all.rate)} | ${d.all.n} | ${d.all.filled} | ${pc(d.all.rate)} |`); });
  L.push('', '## Exits, skipped weeks', '');
  for (const k of ['T1', 'T2', 'T3']) L.push(`- ${k} ${T[k].market}: weeks from 2008 ${T[k].weeks.total}, used ${T[k].weeks.used}, skipped ${JSON.stringify(T[k].weeks.skipped)}, eligible (gap > 0.5 ATR) ${T[k].weeks.eligible}, no trade ${JSON.stringify(T[k].noTrade)}; exits 2016-26 ${JSON.stringify(T[k].dec.exits)}, 2008-15 ${JSON.stringify(T[k].rep.exits)}.`);
  L.push('', '## By year (pooled, net R a trade, total, n)', '', '| Year | Net R | Total | n |', '|---|---:|---:|---:|');
  for (const [y, b] of Object.entries(T.P.byYear)) L.push(`| ${y} | ${f(b.net)} | ${f(b.total, 2)} | ${b.n} |`);
  L.push('', '## Reading', '', res.reading, '');
  L.push('## Data', '', `OANDA mid M5 through /md/bars: ${Object.entries(res.candles).map(([s, c]) => `${NAME[s]} ${c.m5} candles ${c.from} to ${c.to}`).join('; ')}. Rates: FRED DGS2 weekly (rates.json, copied from research/edge/index-overnight/rates.json). Holidays: ict/calendar.mjs cmeShut. To repeat: \`node --use-env-proxy research/edge/index-weekend-gap/fetch.mjs <dir>\`, then \`node research/edge/index-weekend-gap/run.mjs full <dir>\` (candles kept out of the repository).`, '');
  return L.join('\n');
}

// ─── run ───
export const toBars = (rows) => rows.map((r) => ({ time: r[0], open: r[1], high: r[2], low: r[3], close: r[4] }));
const iso = (t) => new Date(t * 1000).toISOString().slice(0, 16).replace('T', ' ');
const MAIN = process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url);
if (MAIN && !['full', 'report'].includes(process.argv[2])) throw new Error('usage: node run.mjs full <dir> | report');
if (MAIN && process.argv[2] === 'full') {
  const dir = process.argv[3];
  const dgs2 = JSON.parse(fs.readFileSync(path.join(HERE, 'rates.json'), 'utf8')).DGS2, data = {}, candles = {};
  for (const sym of Object.values(MARKETS)) { const M5 = toBars(JSON.parse(zlib.gunzipSync(fs.readFileSync(path.join(dir, `${sym}-5m.json.gz`)))));
    data[sym] = M5; candles[sym] = { m5: M5.length, from: iso(M5[0].time), to: iso(M5.at(-1).time) }; }
  const r = study(data, dgs2), last = Math.min(...Object.values(data).map((M) => M.at(-1).time)), T = r.tests;
  const verdict = r.pass ? `PASS${r.robust ? '' : ' (not robust: the pooled mean is inside the placebo band)'}` : 'FAIL';
  const out = { topic: 'index-weekend-gap', built: '2026-11-14', at: new Date().toISOString(),
    system: 'US index CFDs (US500, NAS100, US30) Sunday-reopen gap fade: gap over 0.5 x ATR20, enter against it at the first M5 close, target Friday 17:00 close, stop 1 x ATR20, out Monday 09:30 New York',
    prereg: 'research/edge/index-weekend-gap/PREREGISTRATION.md', markets: MARKETS, candles,
    window: { replication: `${K.REP[0]} to ${K.REP[1]}`, decisive: `${K.DEC_FROM} to ${iso(last).slice(0, 10)}` }, params: K,
    verdict, verdictLine: `${verdict}: pooled ${f(T.P.dec.net)}R a trade after costs on 2016-26 (n ${T.P.dec.n}, month-sum t ${f(T.P.dec.tMonth, 2)}), ${f(T.P.rep.net)}R on 2008-15 (n ${T.P.rep.n})`,
    ...r };
  out.verdict = out.verdictLine;
  try { out.reading = JSON.parse(fs.readFileSync(path.join(HERE, 'result.json'), 'utf8')).reading || ''; } catch { out.reading = ''; }   // the author's paragraph is kept
  fs.writeFileSync(path.join(HERE, 'result.json'), JSON.stringify(out, null, 1) + '\n');
  console.log(out.verdictLine);
  for (const k of ['T1', 'T2', 'T3', 'P']) console.log(k, JSON.stringify({ dec: T[k].dec, rep: T[k].rep, p: T[k].p, checks: T[k].checks, noTrade: T[k].noTrade, weeks: T[k].weeks }));
  console.log('placebo', JSON.stringify({ ...r.placebo, runs: undefined }));
  console.log('fill', JSON.stringify(r.fill.pooled));
}
// RESULT.md is written by `node run.mjs report` from result.json (its `reading` paragraph is the author's, added after the run)
if (MAIN && process.argv[2] === 'report') {
  fs.writeFileSync(path.join(HERE, 'RESULT.md'), report(JSON.parse(fs.readFileSync(path.join(HERE, 'result.json'), 'utf8'))));
}
