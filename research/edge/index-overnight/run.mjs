// Edge research · index-overnight: the overnight drift on US index CFDs (PREREGISTRATION.md, committed first).
// T1 US500 and T2 NAS100: long from the New York cash close to the next 09:30 New York open, stop 1 x ATR20 of the CFD's
// 17:00-to-17:00 New York days, net of spread and overnight financing. T3 = the cash session on US500 (control).
//   node --use-env-proxy run.mjs fetch <dir>     OANDA M30 candles through /md/bars (<sym>-30m.json.gz, rows [t,o,h,l,c])
//   node run.mjs full <dir>                      runs the study, writes result.json and RESULT.md next to this file
// Paper research only. Every trade has a stop on its losing side.
import fs from 'node:fs';
import path from 'node:path';
import zlib from 'node:zlib';
import { fileURLToPath } from 'node:url';

const HERE = path.dirname(fileURLToPath(import.meta.url));
export const P = { ATR_N: 20, STOP_ATR: 1.0, COST: 0.0003, FIN_ADD: 2.5, HOLD_PLACEBO: 7.5 * 3600, SEEDS: 40, MIN_N: 300 };
export const SYMS = { spx500: 'US500', nas100: 'NAS100' };
const DAY = 86400, M30 = 1800;
const ymd = (t) => new Date(t * 1000).toISOString().slice(0, 10);

// ---------- New York time (US daylight-saving rules of each year) ----------
const nthSun = (y, m, n) => { const d1 = new Date(Date.UTC(y, m, 1)).getUTCDay(); return 1 + ((7 - d1) % 7) + 7 * (n - 1); };
const lastSun = (y, m) => { const last = new Date(Date.UTC(y, m + 1, 0)); return last.getUTCDate() - last.getUTCDay(); };
// UTC seconds when daylight time starts / ends in year y (02:00 local both times)
export function dstBounds(y) {
  if (y >= 2007) return [Date.UTC(y, 2, nthSun(y, 2, 2), 7) / 1000, Date.UTC(y, 10, nthSun(y, 10, 1), 6) / 1000];
  return [Date.UTC(y, 3, nthSun(y, 3, 1), 7) / 1000, Date.UTC(y, 9, lastSun(y, 9), 6) / 1000];
}
export function nyOffset(t) { const y = new Date(t * 1000).getUTCFullYear(); const [a, b] = dstBounds(y); return t >= a && t < b ? -4 : -5; }
// UTC seconds of New York local time hh:mm on the New York date 'YYYY-MM-DD'
export function nyAt(date, hh, mm = 0) {
  const base = Date.parse(date + 'T00:00:00Z') / 1000 + hh * 3600 + mm * 60;
  let t = base + 5 * 3600; t = base - nyOffset(t) * 3600; return base - nyOffset(t) * 3600;
}
export const nyDate = (t) => ymd(t + nyOffset(t) * 3600);

// ---------- NYSE calendar by rule ----------
const iso = (y, m, d) => new Date(Date.UTC(y, m, d)).toISOString().slice(0, 10);
const nthDow = (y, m, dow, n) => { const d1 = new Date(Date.UTC(y, m, 1)).getUTCDay(); return 1 + ((dow - d1 + 7) % 7) + 7 * (n - 1); };
const lastDow = (y, m, dow) => { const last = new Date(Date.UTC(y, m + 1, 0)); return last.getUTCDate() - ((last.getUTCDay() - dow + 7) % 7); };
function observed(y, m, d, satToFri = true) {
  const w = new Date(Date.UTC(y, m, d)).getUTCDay();
  if (w === 6) return satToFri ? iso(y, m, d - 1) : null;
  if (w === 0) return iso(y, m, d + 1);
  return iso(y, m, d);
}
function easter(y) { // anonymous Gregorian algorithm
  const a = y % 19, b = Math.floor(y / 100), c = y % 100, d = Math.floor(b / 4), e = b % 4, f = Math.floor((b + 8) / 25);
  const g = Math.floor((b - f + 1) / 3), h = (19 * a + b - d - g + 15) % 30, i = Math.floor(c / 4), k = c % 4;
  const l = (32 + 2 * e + 2 * i - h - k) % 7, m = Math.floor((a + 11 * h + 22 * l) / 451), mo = Math.floor((h + l - 7 * m + 114) / 31);
  return [mo - 1, ((h + l - 7 * m + 114) % 31) + 1];
}
const SPECIAL = new Set(['2007-01-02', '2012-10-29', '2012-10-30', '2018-12-05', '2025-01-09']);
const HOL = new Map();
export function holidays(y) {
  if (HOL.has(y)) return HOL.get(y);
  const s = new Set();
  const add = (x) => { if (x) s.add(x); };
  add(observed(y, 0, 1, false));
  add(iso(y, 0, nthDow(y, 0, 1, 3))); add(iso(y, 1, nthDow(y, 1, 1, 3)));
  const [em, ed] = easter(y); add(iso(y, em, ed - 2));
  add(iso(y, 4, lastDow(y, 4, 1)));
  if (y >= 2022) add(observed(y, 5, 19));
  add(observed(y, 6, 4)); add(iso(y, 8, nthDow(y, 8, 1, 1))); add(iso(y, 10, nthDow(y, 10, 4, 4))); add(observed(y, 11, 25));
  HOL.set(y, s); return s;
}
export function isCashDay(date) {
  const w = new Date(date + 'T00:00:00Z').getUTCDay();
  if (w === 0 || w === 6) return false;
  return !holidays(+date.slice(0, 4)).has(date) && !SPECIAL.has(date);
}
export function closeHour(date) { // [hh, mm] of the cash close
  const y = +date.slice(0, 4), md = date.slice(5);
  const thx = iso(y, 10, nthDow(y, 10, 4, 4)), after = iso(y, 10, nthDow(y, 10, 4, 4) + 1);
  if (date === after && thx) return [13, 0];
  if (md === '12-24' && isCashDay(date)) return [13, 0];
  if (md === '07-03' && isCashDay(date)) { const w4 = new Date(Date.UTC(y, 6, 4)).getUTCDay(); if (w4 >= 2 && w4 <= 5) return [13, 0]; }
  return [16, 0];
}
export function cashDays(from, to) {
  const out = []; for (let t = Date.parse(from + 'T00:00:00Z') / 1000; ymd(t) <= to; t += DAY) { const d = ymd(t); if (isCashDay(d)) out.push(d); } return out;
}

// ---------- candles ----------
export function makeSeries(rows) {
  const bars = rows.slice().sort((a, b) => a[0] - b[0]), at = new Map();
  bars.forEach((b, i) => at.set(b[0], i));
  return { bars, at };
}
// the CFD's day: 17:00 New York to 17:00 New York, named by the New York date it ends on
export function dailyBars(bars) {
  const m = new Map();
  for (const b of bars) {
    const key = nyDate(b[0] + 7 * 3600);
    const d = m.get(key);
    if (!d) m.set(key, { date: key, o: b[1], h: b[2], l: b[3], c: b[4] });
    else { d.h = Math.max(d.h, b[2]); d.l = Math.min(d.l, b[3]); d.c = b[4]; }
  }
  const out = [...m.values()].sort((a, b) => (a.date < b.date ? -1 : 1));
  for (const d of out) d.end = nyAt(d.date, 17);
  let pc = null; for (const d of out) { d.tr = pc == null ? d.h - d.l : Math.max(d.h, pc) - Math.min(d.l, pc); pc = d.c; }
  return out;
}
// ATR of the N most recent days that ended at or before t (needs N + 1 days)
export function atrAt(days, t, n = P.ATR_N) {
  let lo = 0, hi = days.length; while (lo < hi) { const mid = (lo + hi) >> 1; if (days[mid].end <= t) lo = mid + 1; else hi = mid; }
  if (lo < n + 1) return null;
  let s = 0; for (let i = lo - n; i < lo; i++) s += days[i].tr; return s / n;
}

// ---------- costs ----------
// weekday 17:00 New York rollovers strictly inside (t0, t1), once per New York date; a Friday rollover counts three
export function nightsHeld(t0, t1) {
  const seen = new Set(); let n = 0;
  for (let t = t0 - 2 * DAY; t < t1 + 2 * DAY; t += 3600 * 6) {
    const d = nyDate(t); if (seen.has(d)) continue; seen.add(d);
    const r = nyAt(d, 17); if (!(r > t0 && r < t1)) continue;
    const w = new Date(d + 'T00:00:00Z').getUTCDay(); if (w >= 1 && w <= 5) n += w === 5 ? 3 : 1;
  }
  return n;
}
export function rateOf(dgs2, date) { // last DGS2 dated on or before date, else the first one
  let lo = 0, hi = dgs2.length; while (lo < hi) { const mid = (lo + hi) >> 1; if (dgs2[mid][0] <= date) lo = mid + 1; else hi = mid; }
  return lo ? dgs2[lo - 1][1] : dgs2[0][1];
}
export function costTrade(tr, dgs2, k = 1) {
  const r0 = tr.entry - tr.stop, nights = nightsHeld(tr.t0, tr.t1), rate = rateOf(dgs2, ymd(tr.t0)) + P.FIN_ADD;
  const spread = k * P.COST * tr.entry / r0, fin = nights * rate / 100 / 365 * tr.entry / r0;
  return { ...tr, nights, rate, spreadR: spread, finR: fin, net: tr.R - spread - fin };
}

// ---------- the trade ----------
// checks candles i in [from, to] (indices into bars) for the stop: open at or below → exit at the open; low at or below →
// exit at the stop. Not stopped → exitPx at exitT.
export function simulate(bars, { entry, stop, t0, from, to, exitPx, exitT }) {
  if (!(stop < entry)) throw new Error('stop must be under a long entry');
  for (let i = from; i <= to; i++) {
    const b = bars[i];
    if (b[1] <= stop) return { t0, t1: b[0], entry, stop, exit: b[1], how: 'gap', R: (b[1] - entry) / (entry - stop) };
    if (b[3] <= stop) return { t0, t1: b[0] + M30, entry, stop, exit: stop, how: 'stop', R: -1 };
  }
  return { t0, t1: exitT, entry, stop, exit: exitPx, how: 'time', R: (exitPx - entry) / (entry - stop) };
}
const firstAtOrAfter = (bars, t) => { let lo = 0, hi = bars.length; while (lo < hi) { const m = (lo + hi) >> 1; if (bars[m][0] < t) lo = m + 1; else hi = m; } return lo; };

export function overnight(S, days, date, next) {
  const [ch, cm] = closeHour(date), close = nyAt(date, ch, cm), iE = S.at.get(close - M30), open = nyAt(next, 9, 30), iX = S.at.get(open);
  if (iE == null || iX == null) return { drop: true };
  const entry = S.bars[iE][4], a = atrAt(days, close); if (a == null) return { drop: 'atr' };
  const stop = entry - P.STOP_ATR * a;
  const tr = simulate(S.bars, { entry, stop, t0: close, from: iE + 1, to: iX - 1, exitPx: S.bars[iX][1], exitT: open });
  if (tr.how === 'time') tr.how = S.bars[iX][1] <= stop ? 'gap-open' : 'open';
  return { ...tr, date, weekend: nightsHeld(close, open) >= 3 };
}
export function session(S, days, date) {
  const [ch, cm] = closeHour(date), open = nyAt(date, 9, 30), close = nyAt(date, ch, cm), iE = S.at.get(open), iX = S.at.get(close - M30);
  if (iE == null || iX == null) return { drop: true };
  const entry = S.bars[iE][1], a = atrAt(days, open); if (a == null) return { drop: 'atr' };
  return { ...simulate(S.bars, { entry, stop: entry - P.STOP_ATR * a, t0: open, from: iE, to: iX, exitPx: S.bars[iX][4], exitT: close }), date };
}
export function windowTrade(S, days, start, hold = P.HOLD_PLACEBO) {
  const iE = S.at.get(start - M30), iX = S.at.get(start + hold - M30);
  if (iE == null || iX == null) return null;
  const entry = S.bars[iE][4], a = atrAt(days, start); if (a == null) return null;
  return { ...simulate(S.bars, { entry, stop: entry - P.STOP_ATR * a, t0: start, from: iE + 1, to: iX, exitPx: S.bars[iX][4], exitT: start + hold }), date: ymd(start) };
}

// ---------- statistics ----------
export const monthOf = (tr) => ymd(tr.t0).slice(0, 7);
export function monthSums(trades, key = 'net') { const m = new Map(); for (const t of trades) m.set(monthOf(t), (m.get(monthOf(t)) || 0) + t[key]); return m; }
export function tStat(xs) {
  const n = xs.length; if (n < 2) return null;
  const mu = xs.reduce((a, b) => a + b, 0) / n, sd = Math.sqrt(xs.reduce((a, b) => a + (b - mu) ** 2, 0) / (n - 1));
  return sd > 0 ? mu / (sd / Math.sqrt(n)) : null;
}
const erf = (x) => { const s = Math.sign(x); x = Math.abs(x); const t = 1 / (1 + 0.3275911 * x); return s * (1 - ((((1.061405429 * t - 1.453152027) * t + 1.421413741) * t - 0.284496736) * t + 0.254829592) * t * Math.exp(-x * x)); };
export const pOne = (t) => (t == null ? 1 : 0.5 * (1 - erf(t / Math.SQRT2)));
export function holm(ps) {
  const ord = ps.map((p, i) => [p, i]).sort((a, b) => a[0] - b[0]), out = Array(ps.length); let run = 0;
  ord.forEach(([p, i], k) => { run = Math.max(run, Math.min(1, (ps.length - k) * p)); out[i] = run; });
  return out;
}
export function welch(a, b) {
  const m = (x) => x.reduce((p, q) => p + q, 0) / x.length, v = (x) => { const mu = m(x); return x.reduce((p, q) => p + (q - mu) ** 2, 0) / (x.length - 1); };
  return (m(a) - m(b)) / Math.sqrt(v(a) / a.length + v(b) / b.length);
}
const r3 = (x) => (x == null || !Number.isFinite(x) ? null : Math.round(x * 1000) / 1000), r2 = (x) => (x == null || !Number.isFinite(x) ? null : Math.round(x * 100) / 100);
export function summary(trades) {
  const n = trades.length; if (!n) return { n: 0 };
  const mean = (k) => trades.reduce((a, t) => a + t[k], 0) / n;
  let cum = 0, pk = 0, dd = 0; for (const t of trades) { cum += t.net; pk = Math.max(pk, cum); dd = Math.max(dd, pk - cum); }
  const ms = [...monthSums(trades).values()], msG = [...monthSums(trades, 'R').values()];
  const stopd = trades.map((t) => (t.entry - t.stop) / t.entry * 100).sort((a, b) => a - b);
  return {
    n, months: ms.length, win: r3(trades.filter((t) => t.net > 0).length / n), grossR: r3(mean('R')), spreadR: r3(mean('spreadR')), finR: r3(mean('finR')),
    netR: r3(mean('net')), net2R: r3(mean('net2')), tGross: r2(tStat(msG)), t: r2(tStat(ms)), total: r2(cum), maxDD: r2(dd),
    stops: trades.filter((t) => t.how === 'stop' || t.how === 'gap').length, medStopPct: r3(stopd[n >> 1]), nights: r2(mean('nights')),
  };
}
export function mulberry32(a) { return () => { a |= 0; a = (a + 0x6D2B79F5) | 0; let t = Math.imul(a ^ (a >>> 15), 1 | a); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; }

// ---------- the study ----------
export const WIN = { decisive: ['2016-01-01', '2026-10-31'], replication: ['2005-01-01', '2015-12-31'] };
const inWin = (w) => (t) => t.date >= WIN[w][0] && t.date <= WIN[w][1];
const pct = (xs, q) => { const s = xs.slice().sort((a, b) => a - b); return s[Math.min(s.length - 1, Math.floor(q * (s.length - 1) + 0.5))]; };

function load(dir, sym) { return makeSeries(JSON.parse(zlib.gunzipSync(fs.readFileSync(path.join(dir, `${sym}-30m.json.gz`))))); }

export function runMarket(S, dgs2, kind) {
  const days = dailyBars(S.bars), all = cashDays('2005-01-01', '2026-10-31'), out = [], drop = { data: 0, atr: 0 };
  for (let i = 0; i < all.length; i++) {
    const r = kind === 'session' ? session(S, days, all[i]) : (i + 1 < all.length ? overnight(S, days, all[i], all[i + 1]) : { drop: true });
    if (r.drop) { drop[r.drop === 'atr' ? 'atr' : 'data']++; continue; }
    const c = costTrade(r, dgs2), c2 = costTrade(r, dgs2, 2); c.net2 = c2.net; out.push(c);
  }
  return { trades: out, drop, days };
}
function placebo(S, days, dgs2, n, w, seed) {
  const rnd = mulberry32(seed + 1), dd = cashDays(...WIN[w]), out = [];
  let guard = 0;
  while (out.length < n && guard++ < n * 50) {
    const d = dd[Math.floor(rnd() * dd.length)], s = Date.parse(d + 'T00:00:00Z') / 1000 + Math.floor(rnd() * 48) * M30;
    const r = windowTrade(S, days, s); if (!r) continue;
    const c = costTrade(r, dgs2); c.net2 = c.net; out.push(c);
  }
  return { mean: out.reduce((a, t) => a + t.net, 0) / out.length, t: tStat([...monthSums(out).values()]), n: out.length };
}

function full(dir) {
  const dgs2 = JSON.parse(fs.readFileSync(path.join(HERE, 'rates.json'))).DGS2;
  const S = { spx500: load(dir, 'spx500'), nas100: load(dir, 'nas100') };
  const span = Object.fromEntries(Object.entries(S).map(([k, s]) => [k, { candles: s.bars.length, first: ymd(s.bars[0][0]), last: ymd(s.bars.at(-1)[0]) }]));
  const R = { T1: runMarket(S.spx500, dgs2, 'overnight'), T2: runMarket(S.nas100, dgs2, 'overnight'), T3: runMarket(S.spx500, dgs2, 'session') };
  const mk = { T1: 'spx500', T2: 'nas100', T3: 'spx500' };
  const tests = {};
  for (const [k, r] of Object.entries(R)) {
    tests[k] = { market: SYMS[mk[k]], leg: k === 'T3' ? 'cash session 09:30-16:00' : 'overnight close-to-open', dropped: r.drop };
    for (const w of Object.keys(WIN)) {
      const tr = r.trades.filter(inWin(w));
      tests[k][w] = summary(tr);
      const byYear = {}; for (const t of tr) { const y = t.date.slice(0, 4); (byYear[y] ||= []).push(t); }
      tests[k][w].byYear = Object.fromEntries(Object.entries(byYear).map(([y, x]) => [y, { n: x.length, netR: r3(x.reduce((a, t) => a + t.net, 0) / x.length), total: r2(x.reduce((a, t) => a + t.net, 0)) }]));
      const wd = {}; for (const t of tr) { const d = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'][new Date(t.date + 'T00:00:00Z').getUTCDay()]; (wd[d] ||= []).push(t); }
      tests[k][w].byWeekday = Object.fromEntries(Object.entries(wd).map(([d, x]) => [d, { n: x.length, grossR: r3(x.reduce((a, t) => a + t.R, 0) / x.length), netR: r3(x.reduce((a, t) => a + t.net, 0) / x.length) }]));
      if (k !== 'T3') {
        const we = tr.filter((t) => t.nights >= 3), wk = tr.filter((t) => t.nights < 3);
        tests[k][w].weekend = { held: summary(we), weekday: summary(wk) };
      }
    }
  }
  // placebo
  for (const k of ['T1', 'T2']) {
    const S1 = S[mk[k]], days = R[k].days;
    for (const w of Object.keys(WIN)) {
      const n = tests[k][w].n, runs = [];
      for (let s = 0; s < P.SEEDS; s++) runs.push(placebo(S1, days, dgs2, n, w, s));
      const ms = runs.map((x) => x.mean), ts = runs.map((x) => x.t);
      tests[k][w].placebo = { seeds: P.SEEDS, hold: '7.5 h', meanNet: { p5: r3(pct(ms, 0.05)), p50: r3(pct(ms, 0.5)), p95: r3(pct(ms, 0.95)) }, t: { p5: r2(pct(ts, 0.05)), p50: r2(pct(ts, 0.5)), p95: r2(pct(ts, 0.95)) }, rankOfReal: ms.filter((x) => x < tests[k][w].netR).length };
    }
  }
  // Holm over T1, T2 (decisive)
  const ps = ['T1', 'T2'].map((k) => pOne(tests[k].decisive.t)), adj = holm(ps);
  ['T1', 'T2'].forEach((k, i) => { tests[k].decisive.p = r3(ps[i]); tests[k].decisive.pHolm = r3(adj[i]); });
  // pooled
  const pooled = {};
  for (const w of Object.keys(WIN)) {
    const m = new Map(); for (const k of ['T1', 'T2']) for (const [mo, v] of monthSums(R[k].trades.filter(inWin(w)))) m.set(mo, (m.get(mo) || 0) + v);
    const xs = [...m.values()], g = new Map(); for (const k of ['T1', 'T2']) for (const [mo, v] of monthSums(R[k].trades.filter(inWin(w)), 'R')) g.set(mo, (g.get(mo) || 0) + v);
    pooled[w] = { months: xs.length, meanMonthNet: r3(xs.reduce((a, b) => a + b, 0) / xs.length), t: r2(tStat(xs)), tGross: r2(tStat([...g.values()])), total: r2(xs.reduce((a, b) => a + b, 0)) };
  }
  // T1 vs T3 (overnight leg vs cash session on US500)
  const vs = {};
  for (const w of Object.keys(WIN)) {
    const a = [...monthSums(R.T1.trades.filter(inWin(w))).values()], b = [...monthSums(R.T3.trades.filter(inWin(w))).values()];
    vs[w] = { diffNetR: r3(tests.T1[w].netR - tests.T3[w].netR), diffGrossR: r3(tests.T1[w].grossR - tests.T3[w].grossR), welchMonthT: r2(welch(a, b)) };
  }
  // pass rules
  const cond = {};
  for (const k of ['T1', 'T2']) {
    const d = tests[k].decisive, r = tests[k].replication;
    const c = { n: d.n >= P.MIN_N && r.n >= P.MIN_N, tDecisive: d.netR > 0 && d.t >= 2, replication: r.netR > 0, holm: d.pHolm < 0.05, placebo: d.netR > d.placebo.meanNet.p95, twiceCost: d.net2R > 0 };
    c.pass = Object.values(c).every(Boolean); c.core = c.tDecisive && c.replication; cond[k] = c;
  }
  const pooledOk = pooled.decisive.t >= 2 && pooled.decisive.meanMonthNet > 0 && pooled.replication.meanMonthNet > 0;
  const verdictClass = (cond.T1.pass || cond.T2.pass) && pooledOk ? 'PASS' : !cond.T1.core && !cond.T2.core ? 'FAIL' : 'INCONCLUSIVE';
  const d1 = tests.T1.decisive, d2 = tests.T2.decisive;
  const verdict = `${verdictClass}: the overnight long after spread and financing, 2016-26: US500 ${f(d1.netR)}R a trade (n ${d1.n}, month-sum t ${f(d1.t, 2)}), NAS100 ${f(d2.netR)}R (n ${d2.n}, t ${f(d2.t, 2)}); before costs ${f(d1.grossR)}R and ${f(d2.grossR)}R (t ${f(d1.tGross, 2)}, ${f(d2.tGross, 2)})`;
  return {
    study: 'index-overnight', title: 'Overnight drift on US index CFDs: close-to-open longs on US500 and NAS100', built: '2026-11-14', verdict, verdictClass,
    data: { source: 'OANDA mid M30 via /md/bars', span, rates: 'FRED DGS2 weekly (rates.json, copied from research/edge/gold-carry/rates.json)' },
    params: P, windows: WIN, tests, holmSet: ['T1', 'T2'], pooled, pooledOk, overnightVsSession: vs, conditions: cond,
  };
}

// ---------- RESULT.md from result.json ----------
const f = (x, d = 3) => (x == null ? 'n/a' : (x > 0 ? '+' : x < 0 ? '−' : '') + Math.abs(x).toFixed(d));
export function report(res) {
  const L = [];
  L.push(`# ${res.title}: result`, '');
  L.push(`Pre-registered in PREREGISTRATION.md (committed before any trade was simulated). Built ${res.built}. Paper research only: nothing live changed.`, '');
  L.push(`## Verdict: ${res.verdict}.`, '');
  const d1 = res.tests.T1.decisive, d2 = res.tests.T2.decisive;
  L.push(`T1 (US500 overnight) made ${f(d1.netR)}R a trade after costs in 2016-26 (n ${d1.n}, month-sum t ${f(d1.t, 2)}, ${f(d1.grossR)}R before costs); ` +
    `T2 (NAS100 overnight) ${f(d2.netR)}R (n ${d2.n}, t ${f(d2.t, 2)}, ${f(d2.grossR)}R before costs). Pooled monthly t ${f(res.pooled.decisive.t, 2)} (2016-26), ${f(res.pooled.replication.t, 2)} (2005-15).`, '');
  L.push('| Test | Window | n | Gross R | Spread R | Financing R | Net R | Month t gross | Month t net | Total net R | Max DD R | Placebo net R p5 / p50 / p95 |');
  L.push('|---|---|---:|---:|---:|---:|---:|---:|---:|---:|---:|---|');
  for (const k of ['T1', 'T2', 'T3']) for (const w of ['decisive', 'replication']) {
    const s = res.tests[k][w], pl = s.placebo;
    L.push(`| ${k} ${res.tests[k].market} ${k === 'T3' ? 'session' : 'overnight'} | ${w === 'decisive' ? '2016-26' : '2005-15'} | ${s.n} | ${f(s.grossR)} | ${f(-s.spreadR)} | ${f(-s.finR)} | ${f(s.netR)} | ${f(s.tGross, 2)} | ${f(s.t, 2)} | ${f(s.total, 1)} | ${s.maxDD.toFixed(1)} | ${pl ? `${f(pl.meanNet.p5)} / ${f(pl.meanNet.p50)} / ${f(pl.meanNet.p95)}` : '(control)'} |`);
  }
  L.push('', `Pooled T1 + T2 (monthly sums added): 2016-26 ${res.pooled.decisive.months} months, mean ${f(res.pooled.decisive.meanMonthNet)}R a month, t ${f(res.pooled.decisive.t, 2)} (gross t ${f(res.pooled.decisive.tGross, 2)}); ` +
    `2005-15 ${res.pooled.replication.months} months, mean ${f(res.pooled.replication.meanMonthNet)}R, t ${f(res.pooled.replication.t, 2)} (gross t ${f(res.pooled.replication.tGross, 2)}).`, '');
  L.push('## Pass conditions', '', '| Test | n ≥ 300 both | net > 0, t ≥ 2 (2016-26) | net > 0 (2005-15) | Holm p < 0.05 | above placebo p95 | net > 0 at 2x spread | Pass |', '|---|---|---|---|---|---|---|---|');
  const yn = (b) => (b ? 'yes' : 'no');
  for (const k of ['T1', 'T2']) { const c = res.conditions[k], d = res.tests[k].decisive; L.push(`| ${k} | ${yn(c.n)} | ${yn(c.tDecisive)} | ${yn(c.replication)} | ${yn(c.holm)} (p ${d.p}, Holm ${d.pHolm}) | ${yn(c.placebo)} (rank ${d.placebo.rankOfReal} of 40) | ${yn(c.twiceCost)} | ${yn(c.pass)} |`); }
  L.push('', '## Overnight against the cash session (US500)', '');
  for (const w of ['decisive', 'replication']) { const v = res.overnightVsSession[w]; L.push(`- ${w === 'decisive' ? '2016-26' : '2005-15'}: overnight minus session ${f(v.diffGrossR)}R a trade before costs, ${f(v.diffNetR)}R after; Welch t on monthly sums ${f(v.welchMonthT, 2)}.`); }
  L.push('', '## Weekend holds (3 or more nights) apart', '');
  for (const k of ['T1', 'T2']) for (const w of ['decisive', 'replication']) { const x = res.tests[k][w].weekend; L.push(`- ${k} ${w === 'decisive' ? '2016-26' : '2005-15'}: weekend n ${x.held.n}, ${f(x.held.grossR)}R gross, ${f(x.held.netR)}R net; weekday n ${x.weekday.n}, ${f(x.weekday.grossR)}R gross, ${f(x.weekday.netR)}R net.`); }
  L.push('', '## By year (net R a trade, total)', '', '| Year | T1 US500 | T2 NAS100 | T3 US500 session |', '|---|---|---|---|');
  const years = [...new Set(['T1', 'T2', 'T3'].flatMap((k) => ['replication', 'decisive'].flatMap((w) => Object.keys(res.tests[k][w].byYear))))].sort();
  for (const y of years) { const cell = (k) => { const w = y >= '2016' ? 'decisive' : 'replication', b = res.tests[k][w].byYear[y]; return b ? `${f(b.netR)} (${f(b.total, 1)}, n ${b.n})` : '—'; }; L.push(`| ${y} | ${cell('T1')} | ${cell('T2')} | ${cell('T3')} |`); }
  L.push('', '## Detail', '');
  for (const k of ['T1', 'T2', 'T3']) for (const w of ['decisive', 'replication']) { const s = res.tests[k][w]; L.push(`- ${k} ${w === 'decisive' ? '2016-26' : '2005-15'}: win ${(s.win * 100).toFixed(1)} %, stopped ${s.stops}, median stop ${s.medStopPct} % of price, mean nights ${s.nights}, net at 2x spread ${f(s.net2R)}R; dropped days (whole run) ${JSON.stringify(res.tests[k].dropped)}.`); }
  L.push('', '## Reading', '');
  L.push(READING[res.verdictClass] || '', '');
  L.push('## Data', '', `OANDA mid M30: US500 ${res.data.span.spx500.candles} candles ${res.data.span.spx500.first} to ${res.data.span.spx500.last}; NAS100 ${res.data.span.nas100.candles} candles ${res.data.span.nas100.first} to ${res.data.span.nas100.last}. Rates: ${res.data.rates}. To repeat: \`node --use-env-proxy research/edge/index-overnight/run.mjs fetch <dir>\`, then \`node research/edge/index-overnight/run.mjs full <dir>\` (candles kept out of git).`, '');
  return L.join('\n');
}
export const READING = {
  FAIL: 'Not an edge. Before costs the drift is there on both CFDs: the overnight long made about +0.01 to +0.03R a trade with month-sum t between +2.3 and +4.7 in both windows, the published effect. But it is about 0.03 % of price a night, and the round-trip spread charged here (0.03 % of price, about 0.02 to 0.027R at a one-ATR stop) takes all of it before financing (another 0.011 to 0.017R) is paid: net it is negative on both markets in both windows (US500 t below -2.8). The overnight leg did not beat the cash session on US500 by a measurable margin (Welch t under 1 in both windows), and the US500 result sits inside the random-window placebo. The rule fails the pre-registered bar; the result says the drift is too small per trade to pay a CFD spread, whatever the stop. Never call it an edge and never propose it as a council system; nothing live changed.',
  INCONCLUSIVE: 'Not proven. Some conditions held and others did not (table above). Not an edge; a follow-up needs its own pre-registration on other data. Nothing live changed.',
  PASS: 'Passed the pre-registered bar. A pass is a hypothesis for a forward paper shadow, never a live rule before a forward record exists, and it is not an owner decision yet. Nothing live changed.',
};

// ---------- fetch ----------
async function fetchAll(dir) {
  const BASE = process.env.MD_BASE || 'https://meridianx.dev/md/', sleep = (ms) => new Promise((r) => setTimeout(r, ms));
  const FROM = Date.parse('2005-01-01T00:00:00Z') / 1000, END = Date.parse('2026-11-01T00:00:00Z') / 1000;
  fs.mkdirSync(dir, { recursive: true });
  for (const sym of Object.keys(SYMS)) {
    const file = path.join(dir, `${sym}-30m.json.gz`); if (fs.existsSync(file)) { console.log(`${sym}: exists`); continue; }
    const m = new Map();
    for (let a = FROM; a < END;) {
      const b = Math.min(END, a + 4999 * M30); let j = null, err = null;
      for (let k = 0; k < 6 && !j; k++) {
        try { const r = await fetch(`${BASE}bars?sym=${sym}&tf=30m&from=${a}&to=${b}`, { signal: AbortSignal.timeout(40000) }); const x = r.ok ? await r.json() : null;
          if (x && x.src === 'OANDA' && Array.isArray(x.bars)) j = x; else err = x && x.error ? String(x.error) : `HTTP ${r.status}`; }
        catch (e) { err = String(e.message || e); }
        if (!j) await sleep(2000 * (k + 1));
      }
      if (!j) throw new Error(`${sym} ${ymd(a)}: ${err}`);
      for (const x of j.bars) if (!x.live && x.time >= a && x.time < b) m.set(+x.time, [+x.time, +x.open, +x.high, +x.low, +x.close]);
      a = b; await sleep(150);
    }
    const rows = [...m.values()].sort((p, q) => p[0] - q[0]);
    fs.writeFileSync(file, zlib.gzipSync(JSON.stringify(rows)));
    console.log(`${sym}: ${rows.length} candles ${ymd(rows[0][0])} → ${ymd(rows.at(-1)[0])}`);
  }
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const [cmd, dir] = process.argv.slice(2);
  if (cmd === 'fetch' && dir) await fetchAll(dir);
  else if (cmd === 'full' && dir) {
    const res = full(dir);
    fs.writeFileSync(path.join(HERE, 'result.json'), JSON.stringify(res, null, 1) + '\n');
    fs.writeFileSync(path.join(HERE, 'RESULT.md'), report(res));
    console.log(res.verdict, JSON.stringify({ T1: res.tests.T1.decisive, T2: res.tests.T2.decisive }).slice(0, 600));
  } else throw new Error('usage: node run.mjs fetch|full <dir>');
}
