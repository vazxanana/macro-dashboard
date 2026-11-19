// Edge research · us-asia-lead: does the US cash session's direction lead the Asian index session that follows, measured
// from the Asian cash open (after the gap)? PREREGISTRATION.md, committed first.
// T1 JP225 every US day (00:00-06:00 UTC), T2 JP225 strong US days only, T3 HK33 every US day (01:30-08:00 UTC).
// Signal = sign of SPX500's 09:30-16:00 New York return. Stop 1 x ATR20 of the traded instrument, no target.
//   node --use-env-proxy run.mjs fetch <dir>     OANDA M15 candles through /md/bars (<sym>-15m.json.gz, rows [t,o,h,l,c])
//   node run.mjs full <dir>                      runs the study, writes result.json and RESULT.md next to this file
// Calendar, CFD day and ATR helpers copied from research/edge/index-overnight/run.mjs (not imported across branches).
// Paper research only. Every trade has a stop on its losing side.
import fs from 'node:fs';
import path from 'node:path';
import zlib from 'node:zlib';
import { fileURLToPath } from 'node:url';

const HERE = path.dirname(fileURLToPath(import.meta.url));
export const P = { ATR_N: 20, STOP_ATR: 1.0, COST: 0.0004, SD_N: 20, SEEDS: 40, MIN_N: 100, MIN_N_T2: 50 };
export const SYMS = { spx500: 'US500', jp225: 'JP225', hk33: 'HK33' };
const DAY = 86400, M15 = 900;
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


// ---------- the Asian session that follows a US cash day ----------
// next weekday after the New York date D (Friday → Monday)
export function asiaDay(date) {
  const w = new Date(date + 'T00:00:00Z').getUTCDay();
  return ymd(Date.parse(date + 'T00:00:00Z') / 1000 + (w === 5 ? 3 : w === 6 ? 2 : 1) * DAY);
}
// entry / exit times (UTC seconds) of each market's cash session on the UTC date A
export const SESS = { jp225: { open: 0, close: 6 * 3600 }, hk33: { open: 1.5 * 3600, close: 8 * 3600 } };
export function sessionTimes(mk, A) { const b = Date.parse(A + 'T00:00:00Z') / 1000; return { open: b + SESS[mk].open, close: b + SESS[mk].close }; }

// ---------- the US signal ----------
// one row per US cash day with both candles: { date, ret, closeT }
export function usSignals(S, from = '2005-01-01', to = '2026-11-13') {
  const out = [];
  for (const d of cashDays(from, to)) {
    const [ch, cm] = closeHour(d), open = nyAt(d, 9, 30), close = nyAt(d, ch, cm);
    const iO = S.at.get(open), iC = S.at.get(close - M15);
    if (iO == null || iC == null) continue;
    out.push({ date: d, ret: S.bars[iC][4] / S.bars[iO][1] - 1, closeT: close });
  }
  // sd of the SD_N returns before each day (sample sd; D excluded)
  for (let i = 0; i < out.length; i++) {
    if (i < P.SD_N) { out[i].sd = null; continue; }
    const xs = out.slice(i - P.SD_N, i).map((x) => x.ret), mu = xs.reduce((a, b) => a + b, 0) / xs.length;
    out[i].sd = Math.sqrt(xs.reduce((a, b) => a + (b - mu) ** 2, 0) / (xs.length - 1));
  }
  return out;
}

// ---------- the trade ----------
// s = +1 buy, -1 sell. Candles [from, to] are checked (entry candle and exit candle included): an open through the stop
// exits at the open, else a range reaching it exits at the stop; not stopped → the exit candle's close.
export function simulate(bars, { s, entry, stop, from, to }) {
  if (!(s * (entry - stop) > 0)) throw new Error('stop must be on the losing side');
  const r0 = Math.abs(entry - stop);
  for (let i = from; i <= to; i++) {
    const b = bars[i];
    if (s > 0 ? b[1] <= stop : b[1] >= stop) return { exit: b[1], how: 'gap', R: s * (b[1] - entry) / r0, t1: b[0] };
    if (s > 0 ? b[3] <= stop : b[2] >= stop) return { exit: stop, how: 'stop', R: -1, t1: b[0] + M15 };
  }
  const x = bars[to][4];
  return { exit: x, how: 'time', R: s * (x - entry) / r0, t1: bars[to][0] + M15 };
}
// prepared per (market, US day): entry candle, exit candle, ATR, price at the US close; direction applied later
export function prepare(A_S, days, mk, sig) {
  const A = asiaDay(sig.date), { open, close } = sessionTimes(mk, A);
  const iE = A_S.at.get(open), iX = A_S.at.get(close - M15);
  if (iE == null || iX == null || iX < iE) return { drop: 'data' };
  const a = atrAt(days, open); if (a == null) return { drop: 'atr' };
  const iU = A_S.at.get(sig.closeT - M15), iP = A_S.at.get(sessionTimes(mk, sig.date).close - M15);
  // atClose = the instrument at the US cash close (pre-registered); prevClose = its own cash close BEFORE the US session
  // (the candle ending at the Asian close on the date D: added after the run, descriptive only)
  return { date: sig.date, asia: A, t0: open, iE, iX, entry: A_S.bars[iE][1], atr: a, atClose: iU == null ? null : A_S.bars[iU][4], prevClose: iP == null ? null : A_S.bars[iP][4] };
}
export function trade(A_S, p, s) {
  const stop = p.entry - s * P.STOP_ATR * p.atr, r0 = Math.abs(p.entry - stop);
  const tr = simulate(A_S.bars, { s, entry: p.entry, stop, from: p.iE, to: p.iX });
  const cost = P.COST * p.entry / r0;
  return { date: p.date, asia: p.asia, t0: p.t0, s, entry: p.entry, stop, ...tr, costR: cost, net: tr.R - cost, net2: tr.R - 2 * cost,
    gapR: p.atClose == null ? null : s * (p.entry - p.atClose) / r0 };
}

// ---------- statistics ----------
export const monthOf = (tr) => tr.date.slice(0, 7);
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
export function corr(a, b) {
  const n = a.length; if (n < 3) return null;
  const ma = a.reduce((x, y) => x + y, 0) / n, mb = b.reduce((x, y) => x + y, 0) / n;
  let sab = 0, saa = 0, sbb = 0; for (let i = 0; i < n; i++) { sab += (a[i] - ma) * (b[i] - mb); saa += (a[i] - ma) ** 2; sbb += (b[i] - mb) ** 2; }
  return saa > 0 && sbb > 0 ? sab / Math.sqrt(saa * sbb) : null;
}
const r3 = (x) => (x == null || !Number.isFinite(x) ? null : Math.round(x * 1000) / 1000), r2 = (x) => (x == null || !Number.isFinite(x) ? null : Math.round(x * 100) / 100);
const mean = (xs) => (xs.length ? xs.reduce((a, b) => a + b, 0) / xs.length : null);
export function summary(trades) {
  const n = trades.length; if (!n) return { n: 0 };
  const m = (k) => trades.reduce((a, t) => a + t[k], 0) / n;
  let cum = 0, pk = 0, dd = 0; for (const t of trades) { cum += t.net; pk = Math.max(pk, cum); dd = Math.max(dd, pk - cum); }
  const stopd = trades.map((t) => Math.abs(t.entry - t.stop) / t.entry * 100).sort((a, b) => a - b), gaps = trades.filter((t) => t.gapR != null).map((t) => t.gapR);
  return {
    n, months: monthSums(trades).size, buys: trades.filter((t) => t.s > 0).length, sells: trades.filter((t) => t.s < 0).length,
    win: r3(trades.filter((t) => t.net > 0).length / n), grossR: r3(m('R')), costR: r3(m('costR')), netR: r3(m('net')), net2R: r3(m('net2')),
    tGross: r2(tStat([...monthSums(trades, 'R').values()])), t: r2(tStat([...monthSums(trades).values()])), total: r2(cum), maxDD: r2(dd),
    stops: trades.filter((t) => t.how !== 'time').length, medStopPct: r3(stopd[n >> 1]), gapR: r3(mean(gaps)), gapN: gaps.length,
  };
}
export function mulberry32(a) { return () => { a |= 0; a = (a + 0x6D2B79F5) | 0; let t = Math.imul(a ^ (a >>> 15), 1 | a); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; }
const pct = (xs, q) => { const s = xs.slice().sort((a, b) => a - b); return s[Math.min(s.length - 1, Math.floor(q * (s.length - 1) + 0.5))]; };

// ---------- the study ----------
export const WIN = { decisive: ['2016-01-01', '2026-11-13'], replication: ['2005-01-01', '2015-12-31'] };
export const TESTS = { T1: { mk: 'jp225', strong: false }, T2: { mk: 'jp225', strong: true }, T3: { mk: 'hk33', strong: false } };
const inWin = (w) => (x) => x.date >= WIN[w][0] && x.date <= WIN[w][1];
export const signOf = (ret) => (ret > 0 ? 1 : ret < 0 ? -1 : 0);
export const isStrong = (sig) => sig.sd != null && Math.abs(sig.ret) > sig.sd;

// rows = [{ sig, p }] with a prepared trade; returns the real trades
export function runTest(A_S, rows, strong) {
  const out = [];
  for (const { sig, p } of rows) {
    const s = signOf(sig.ret); if (!s) continue;
    if (strong && !isStrong(sig)) continue;
    out.push({ ...trade(A_S, p, s), ret: sig.ret });
  }
  return out;
}
export function placebo(A_S, rows, strong, w, kind, seed) {
  const rnd = mulberry32(seed), pool = rows.filter((r) => inWin(w)(r.sig) && signOf(r.sig.ret)), out = [];
  for (const { sig, p } of pool) {
    if (strong && !isStrong(sig)) continue;
    const s = kind === 'sign' ? (rnd() < 0.5 ? 1 : -1) : signOf(pool[Math.floor(rnd() * pool.length)].sig.ret);
    out.push(trade(A_S, p, s));
  }
  return mean(out.map((t) => t.net));
}

function load(dir, sym) { return makeSeries(JSON.parse(zlib.gunzipSync(fs.readFileSync(path.join(dir, `${sym}-15m.json.gz`))))); }

function full(dir) {
  const S = Object.fromEntries(Object.keys(SYMS).map((k) => [k, load(dir, k)]));
  const span = Object.fromEntries(Object.entries(S).map(([k, s]) => [k, { candles: s.bars.length, first: ymd(s.bars[0][0]), last: ymd(s.bars.at(-1)[0]) }]));
  const sigs = usSignals(S.spx500), prep = {}, drop = {};
  for (const mk of ['jp225', 'hk33']) {
    const days = dailyBars(S[mk].bars); prep[mk] = []; drop[mk] = { data: 0, atr: 0 };
    for (const sig of sigs) { const p = prepare(S[mk], days, mk, sig); if (p.drop) { drop[mk][p.drop]++; continue; } prep[mk].push({ sig, p }); }
  }
  const tests = {}, real = {};
  for (const [k, T] of Object.entries(TESTS)) {
    const all = runTest(S[T.mk], prep[T.mk], T.strong); real[k] = all;
    tests[k] = { market: SYMS[T.mk], strongOnly: T.strong, session: T.mk === 'jp225' ? '00:00-06:00 UTC' : '01:30-08:00 UTC', dropped: drop[T.mk] };
    for (const w of Object.keys(WIN)) {
      const tr = all.filter(inWin(w)), s = summary(tr);
      const byYear = {}; for (const t of tr) (byYear[t.date.slice(0, 4)] ||= []).push(t);
      s.byYear = Object.fromEntries(Object.entries(byYear).map(([y, x]) => [y, { n: x.length, netR: r3(mean(x.map((t) => t.net))), total: r2(x.reduce((a, t) => a + t.net, 0)) }]));
      s.bySide = { buy: summary(tr.filter((t) => t.s > 0)), sell: summary(tr.filter((t) => t.s < 0)) };
      for (const side of ['buy', 'sell']) delete s.bySide[side].months;
      // correlations: US session return vs the gap and vs the Asian session move (per unit of price)
      const rows = prep[T.mk].filter((r) => inWin(w)(r.sig) && (!T.strong || isStrong(r.sig)) && r.p.atClose != null);
      const us = rows.map((r) => r.sig.ret), gap = rows.map((r) => r.p.entry / r.p.atClose - 1), ses = rows.map((r) => S[T.mk].bars[r.p.iX][4] / r.p.entry - 1);
      s.corr = { n: rows.length, usVsGap: r3(corr(us, gap)), usVsSession: r3(corr(us, ses)) };
      // added after the run (descriptive, not pre-registered): the cash-to-cash gap, the Asian market's own previous close
      // to its open, which spans the whole US session
      const rc = prep[T.mk].filter((r) => inWin(w)(r.sig) && (!T.strong || isStrong(r.sig)) && r.p.prevClose != null);
      s.cashGap = { n: rc.length, usVsCashGap: r3(corr(rc.map((r) => r.sig.ret), rc.map((r) => r.p.entry / r.p.prevClose - 1))),
        hit: r3(rc.filter((r) => signOf(r.sig.ret) * (r.p.entry - r.p.prevClose) > 0).length / (rc.length || 1)),
        usVsSession: r3(corr(rc.map((r) => r.sig.ret), rc.map((r) => S[T.mk].bars[r.p.iX][4] / r.p.entry - 1))) };
      const pl = {};
      for (const kind of ['sign', 'other']) {
        const ms = []; for (let i = 0; i < P.SEEDS; i++) ms.push(placebo(S[T.mk], prep[T.mk], T.strong, w, kind, i + (kind === 'sign' ? 1 : 101)));
        pl[kind] = { p5: r3(pct(ms, 0.05)), p50: r3(pct(ms, 0.5)), p95: r3(pct(ms, 0.95)), rankOfReal: ms.filter((x) => x < s.netR).length, above95: s.netR > pct(ms, 0.95) };
      }
      s.placebo = pl;
      tests[k][w] = s;
    }
  }
  const ks = Object.keys(TESTS), ps = ks.map((k) => pOne(tests[k].decisive.t)), adj = holm(ps);
  ks.forEach((k, i) => { tests[k].decisive.p = r3(ps[i]); tests[k].decisive.pHolm = r3(adj[i]); });
  const cond = {};
  for (const k of ks) {
    const d = tests[k].decisive, r = tests[k].replication, nMin = TESTS[k].strong ? P.MIN_N_T2 : P.MIN_N;
    const c = { decisivePositive: d.netR > 0, replicationPositive: r.netR > 0, holm: d.pHolm < 0.05, n: d.n >= nMin && r.n >= nMin };
    c.pass = Object.values(c).every(Boolean); cond[k] = c;
  }
  const verdictClass = ks.some((k) => cond[k].pass) ? 'PASS' : ks.some((k) => cond[k].decisivePositive && cond[k].replicationPositive) ? 'INCONCLUSIVE' : 'FAIL';
  const d = (k) => tests[k].decisive;
  const verdict = `${verdictClass}: the Asian session in the US cash session's direction, entered at the Asian open, after a 0.04 % round trip, 2016-26: JP225 ${f(d('T1').netR)}R a trade (n ${d('T1').n}, month-sum t ${f(d('T1').t, 2)}), JP225 on strong US days ${f(d('T2').netR)}R (n ${d('T2').n}, t ${f(d('T2').t, 2)}), HK33 ${f(d('T3').netR)}R (n ${d('T3').n}, t ${f(d('T3').t, 2)}); before costs ${f(d('T1').grossR)}R, ${f(d('T2').grossR)}R, ${f(d('T3').grossR)}R`;
  return {
    study: 'us-asia-lead', title: 'US cash session leading the Asian index session: JP225 and HK33 from the Asian open', built: '2026-11-14', verdict, verdictClass,
    data: { source: 'OANDA mid M15 via /md/bars', span, usSignals: sigs.length },
    params: P, windows: WIN, holmSet: ks, tests, conditions: cond,
  };
}

// ---------- RESULT.md from result.json ----------
const f = (x, d = 3) => (x == null ? 'n/a' : (x > 0 ? '+' : x < 0 ? '−' : '') + Math.abs(x).toFixed(d));
const WL = { decisive: '2016-26', replication: '2005-15' };
export function report(res) {
  const L = [], ks = Object.keys(res.tests), name = (k) => `${k} ${res.tests[k].market}${res.tests[k].strongOnly ? ' strong US days' : ''}`;
  L.push(`# ${res.title}: result`, '');
  L.push(`Pre-registered in PREREGISTRATION.md (committed before any trade was simulated). Built ${res.built}. Paper research only: nothing live changed.`, '');
  L.push(`## Verdict: ${res.verdict}.`, '');
  L.push('| Test | Window | n | Buys / sells | Gross R | Cost R | Net R | Net R at 2x cost | Month t gross | Month t net | Total net R | Max DD R | Gap in signal direction R |');
  L.push('|---|---|---:|---|---:|---:|---:|---:|---:|---:|---:|---:|---:|');
  for (const k of ks) for (const w of ['decisive', 'replication']) {
    const s = res.tests[k][w];
    L.push(`| ${name(k)} | ${WL[w]} | ${s.n} | ${s.buys} / ${s.sells} | ${f(s.grossR)} | ${f(-s.costR)} | ${f(s.netR)} | ${f(s.net2R)} | ${f(s.tGross, 2)} | ${f(s.t, 2)} | ${f(s.total, 1)} | ${s.maxDD.toFixed(1)} | ${f(s.gapR)} |`);
  }
  L.push('', '## Pass conditions', '', '| Test | net > 0 (2016-26) | net > 0 (2005-15) | Holm p < 0.05 | n ≥ 100 (T2: 50) each window | Pass |', '|---|---|---|---|---|---|');
  const yn = (b) => (b ? 'yes' : 'no');
  for (const k of ks) { const c = res.conditions[k], d = res.tests[k].decisive; L.push(`| ${k} | ${yn(c.decisivePositive)} | ${yn(c.replicationPositive)} | ${yn(c.holm)} (p ${d.p}, Holm ${d.pHolm}) | ${yn(c.n)} | ${yn(c.pass)} |`); }
  L.push('', '## Placebo (40 seeds, mean net R a trade; reported, not a pass condition)', '', '| Test | Window | Real | Random sign p5 / p50 / p95 (rank of real) | Other day\'s signal p5 / p50 / p95 (rank) |', '|---|---|---:|---|---|');
  for (const k of ks) for (const w of ['decisive', 'replication']) { const s = res.tests[k][w], a = s.placebo.sign, b = s.placebo.other; L.push(`| ${k} | ${WL[w]} | ${f(s.netR)} | ${f(a.p5)} / ${f(a.p50)} / ${f(a.p95)} (${a.rankOfReal} of 40) | ${f(b.p5)} / ${f(b.p50)} / ${f(b.p95)} (${b.rankOfReal} of 40) |`); }
  L.push('', '## What the gap took', '');
  for (const k of ks) for (const w of ['decisive', 'replication']) { const s = res.tests[k][w]; L.push(`- ${name(k)} ${WL[w]}: correlation of the US session return with the gap to the Asian open ${f(s.corr.usVsGap, 2)}, with the Asian session after it ${f(s.corr.usVsSession, 2)} (n ${s.corr.n}); the gap in the signal's direction averaged ${f(s.gapR)}R of the trade's stop.`); }
  L.push('', 'Added after the run (descriptive, not pre-registered): OANDA\'s JP225 trades through the US session, so the price "at the US close" above already holds the US move; the cash-to-cash gap, from the Asian market\'s own close BEFORE the US session to its next open, is the one that prices it:', '');
  for (const k of ks) for (const w of ['decisive', 'replication']) { const c = res.tests[k][w].cashGap; L.push(`- ${name(k)} ${WL[w]}: correlation of the US session return with the cash-to-cash gap ${f(c.usVsCashGap, 2)}, the gap in the US session's direction on ${(c.hit * 100).toFixed(1)} % of days, correlation with the Asian session after the open ${f(c.usVsSession, 2)} (n ${c.n}).`); }
  L.push('', '## Buy days and sell days apart', '');
  for (const k of ks) for (const w of ['decisive', 'replication']) { const b = res.tests[k][w].bySide; L.push(`- ${name(k)} ${WL[w]}: buys n ${b.buy.n}, ${f(b.buy.grossR)}R gross, ${f(b.buy.netR)}R net; sells n ${b.sell.n}, ${f(b.sell.grossR)}R gross, ${f(b.sell.netR)}R net.`); }
  L.push('', '## By year (net R a trade, total, n)', '', `| Year | ${ks.map(name).join(' | ')} |`, `|---|${ks.map(() => '---').join('|')}|`);
  const years = [...new Set(ks.flatMap((k) => ['replication', 'decisive'].flatMap((w) => Object.keys(res.tests[k][w].byYear))))].sort();
  for (const y of years) { const cell = (k) => { const b = res.tests[k][y >= '2016' ? 'decisive' : 'replication'].byYear[y]; return b ? `${f(b.netR)} (${f(b.total, 1)}, n ${b.n})` : '—'; }; L.push(`| ${y} | ${ks.map(cell).join(' | ')} |`); }
  L.push('', '## Detail', '');
  for (const k of ks) for (const w of ['decisive', 'replication']) { const s = res.tests[k][w]; L.push(`- ${name(k)} ${WL[w]}: win ${(s.win * 100).toFixed(1)} %, stopped ${s.stops}, median stop ${s.medStopPct} % of price, months ${s.months}; dropped US days (whole run) ${JSON.stringify(res.tests[k].dropped)}.`); }
  L.push('', '## Reading', '', READING[res.verdictClass] || '', '');
  const sp = res.data.span;
  L.push('## Data', '', `OANDA mid M15: ${Object.entries(sp).map(([k, v]) => `${SYMS[k]} ${v.candles} candles ${v.first} to ${v.last}`).join('; ')}; ${res.data.usSignals} US cash sessions with both candles. Asian exchange holidays are not excluded (pre-registered). Where the data reaches: OANDA's JP225 has no candles in Tokyo hours before mid 2010 and HK33 has no 01:30 UTC candle before March 2011 (Hong Kong opened at 10:00 HKT until then), so the replication window holds JP225 from 2010 and HK33 from 2011 (the dropped US days above). To repeat: \`node --use-env-proxy research/edge/us-asia-lead/run.mjs fetch <dir>\`, then \`node research/edge/us-asia-lead/run.mjs full <dir>\` (candles kept out of git).`, '');
  return L.join('\n');
}
export const READING = {
  FAIL: 'Not an edge, and not even the right sign. The US cash session does lead Asia, but through the opening gap: its return is correlated about +0.45 to +0.70 with the Tokyo and Hong Kong cash-to-cash gap (the gap goes the US way on 65-85 % of days), and that gap is already in the entry price. Inside the Asian session that follows, what is left is a slight reversal, not a continuation: correlation of the US return with the Asian session -0.04 to -0.12, gross R in the US direction negative in all six test-window cells (JP225 2016-26 -0.017R, month-sum t -2.16), and the real stream sits at or below the 5th percentile of both placebos in 2016-26. After the 0.04 % round trip (about 0.025R at a one-ATR stop) every cell loses (t -2.2 to -5.3). The reverse trade was not tested and is not proposed: its gross figure (+0.005 to +0.029R a trade) is about the size of the cost or smaller. Never call this an edge and never propose it as a council system; nothing live changed.',
  INCONCLUSIVE: 'Not proven. At least one test was positive in both windows but missed the Holm bar or the minimum n (tables above). Not an edge; a follow-up needs its own pre-registration on other data. Nothing live changed.',
  PASS: 'Passed the pre-registered bar. A pass is a hypothesis for a forward paper shadow, never a live rule before a forward record exists, and it is not an owner decision yet. Nothing live changed.',
};

// ---------- fetch ----------
async function fetchAll(dir) {
  const BASE = process.env.MD_BASE || 'https://meridianx.dev/md/', sleep = (ms) => new Promise((r) => setTimeout(r, ms));
  const FROM = Date.parse('2005-01-01T00:00:00Z') / 1000, END = Date.parse('2026-11-14T00:00:00Z') / 1000;
  fs.mkdirSync(dir, { recursive: true });
  for (const sym of Object.keys(SYMS)) {
    const file = path.join(dir, `${sym}-15m.json.gz`); if (fs.existsSync(file)) { console.log(`${sym}: exists`); continue; }
    const m = new Map();
    for (let a = FROM; a < END;) {
      const b = Math.min(END, a + 4999 * M15); let j = null, err = null;
      for (let k = 0; k < 6 && !j; k++) {
        try { const r = await fetch(`${BASE}bars?sym=${sym}&tf=15m&from=${a}&to=${b}`, { signal: AbortSignal.timeout(40000) }); const x = r.ok ? await r.json() : null;
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
    console.log(res.verdict);
  } else throw new Error('usage: node run.mjs fetch|full <dir>');
}
