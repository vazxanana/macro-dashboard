// Edge research · eu-gap-fade: does a European index cash session partly reverse the overnight gap? Fade the gap from the
// 08:00 London open, stop 1 x ATR20, out at the 16:30 London close. PREREGISTRATION.md, committed first.
// T1 DE40, T2 UK100 + EU50 pooled, T3 DE40 only when the gap has the sign of the prior US cash session (SPX500).
//   node --use-env-proxy research/edge/eu-gap-fade/run.mjs fetch <dir>   OANDA M15 candles (<sym>-15m.json.gz, rows [t,o,h,l,c])
//   node research/edge/eu-gap-fade/run.mjs full <dir>                    writes result.json and RESULT.md next to this file
// The NYSE calendar, New York time, the CFD day and the ATR are copied from research/edge/us-asia-lead/run.mjs (not on main,
// so not imported). London summer time is council/histdata.mjs euSummer. Paper research only: every trade has a stop.
import fs from 'node:fs';
import path from 'node:path';
import zlib from 'node:zlib';
import { fileURLToPath } from 'node:url';
import { euSummer } from '../../../council/histdata.mjs';

const HERE = path.dirname(fileURLToPath(import.meta.url));
export const P = { MED_N: 20, TRIG: 0.5, ATR_N: 20, STOP_ATR: 1.0, COST: 0.0004, SEEDS: 40, MIN_N: 200, MIN_N_T3: 100 };
export const SYMS = { de40: 'DE40', uk100: 'UK100', eu50: 'EU50', spx500: 'US500' };
export const EU = ['de40', 'uk100', 'eu50'];
const DAY = 86400, M15 = 900;
const ymd = (t) => new Date(t * 1000).toISOString().slice(0, 10);

// ---------- London time ----------
// UTC seconds of London local hh:mm on the London date 'YYYY-MM-DD'
export function ldnAt(date, hh, mm = 0) {
  const base = Date.parse(date + 'T00:00:00Z') / 1000 + hh * 3600 + mm * 60;
  return euSummer(base - 3600) ? base - 3600 : base;
}

// ---------- New York time (copied from us-asia-lead) ----------
const nthSun = (y, m, n) => { const d1 = new Date(Date.UTC(y, m, 1)).getUTCDay(); return 1 + ((7 - d1) % 7) + 7 * (n - 1); };
const lastSun = (y, m) => { const last = new Date(Date.UTC(y, m + 1, 0)); return last.getUTCDate() - last.getUTCDay(); };
export function dstBounds(y) {
  if (y >= 2007) return [Date.UTC(y, 2, nthSun(y, 2, 2), 7) / 1000, Date.UTC(y, 10, nthSun(y, 10, 1), 6) / 1000];
  return [Date.UTC(y, 3, nthSun(y, 3, 1), 7) / 1000, Date.UTC(y, 9, lastSun(y, 9), 6) / 1000];
}
export function nyOffset(t) { const y = new Date(t * 1000).getUTCFullYear(); const [a, b] = dstBounds(y); return t >= a && t < b ? -4 : -5; }
export function nyAt(date, hh, mm = 0) {
  const base = Date.parse(date + 'T00:00:00Z') / 1000 + hh * 3600 + mm * 60;
  let t = base + 5 * 3600; t = base - nyOffset(t) * 3600; return base - nyOffset(t) * 3600;
}
export const nyDate = (t) => ymd(t + nyOffset(t) * 3600);

// ---------- NYSE calendar by rule (copied from us-asia-lead) ----------
const iso = (y, m, d) => new Date(Date.UTC(y, m, d)).toISOString().slice(0, 10);
const nthDow = (y, m, dow, n) => { const d1 = new Date(Date.UTC(y, m, 1)).getUTCDay(); return 1 + ((dow - d1 + 7) % 7) + 7 * (n - 1); };
const lastDow = (y, m, dow) => { const last = new Date(Date.UTC(y, m + 1, 0)); return last.getUTCDate() - ((last.getUTCDay() - dow + 7) % 7); };
function observed(y, m, d, satToFri = true) {
  const w = new Date(Date.UTC(y, m, d)).getUTCDay();
  if (w === 6) return satToFri ? iso(y, m, d - 1) : null;
  if (w === 0) return iso(y, m, d + 1);
  return iso(y, m, d);
}
function easter(y) {
  const a = y % 19, b = Math.floor(y / 100), c = y % 100, d = Math.floor(b / 4), e = b % 4, f = Math.floor((b + 8) / 25);
  const g = Math.floor((b - f + 1) / 3), h = (19 * a + b - d - g + 15) % 30, i = Math.floor(c / 4), k = c % 4;
  const l = (32 + 2 * e + 2 * i - h - k) % 7, m = Math.floor((a + 11 * h + 22 * l) / 451), mo = Math.floor((h + l - 7 * m + 114) / 31);
  return [mo - 1, ((h + l - 7 * m + 114) % 31) + 1];
}
const SPECIAL = new Set(['2007-01-02', '2012-10-29', '2012-10-30', '2018-12-05', '2025-01-09']);
const HOL = new Map();
export function holidays(y) {
  if (HOL.has(y)) return HOL.get(y);
  const s = new Set(), add = (x) => { if (x) s.add(x); };
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
export function closeHour(date) {
  const y = +date.slice(0, 4), md = date.slice(5);
  const after = iso(y, 10, nthDow(y, 10, 4, 4) + 1);
  if (date === after) return [13, 0];
  if (md === '12-24' && isCashDay(date)) return [13, 0];
  if (md === '07-03' && isCashDay(date)) { const w4 = new Date(Date.UTC(y, 6, 4)).getUTCDay(); if (w4 >= 2 && w4 <= 5) return [13, 0]; }
  return [16, 0];
}
export function cashDays(from, to) {
  const out = []; for (let t = Date.parse(from + 'T00:00:00Z') / 1000; ymd(t) <= to; t += DAY) { const d = ymd(t); if (isCashDay(d)) out.push(d); } return out;
}

// ---------- candles (copied from us-asia-lead) ----------
export function makeSeries(rows) {
  const bars = rows.slice().sort((a, b) => a[0] - b[0]), at = new Map();
  bars.forEach((b, i) => at.set(b[0], i));
  return { bars, at };
}
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
export function atrAt(days, t, n = P.ATR_N) {
  let lo = 0, hi = days.length; while (lo < hi) { const mid = (lo + hi) >> 1; if (days[mid].end <= t) lo = mid + 1; else hi = mid; }
  if (lo < n + 1) return null;
  let s = 0; for (let i = lo - n; i < lo; i++) s += days[i].tr; return s / n;
}

// ---------- European sessions ----------
// one row per session day (both the 08:00 and the 16:15 London candle exist): { date, tO, tC, iO, iX, O, C }
export function euSessions(S, from = '2005-01-01', to = '2026-11-14') {
  const out = [];
  for (let t = Date.parse(from + 'T00:00:00Z') / 1000; ymd(t) <= to; t += DAY) {
    const d = ymd(t), w = new Date(t * 1000).getUTCDay(); if (w === 0 || w === 6) continue;
    const tO = ldnAt(d, 8), tC = ldnAt(d, 16, 30), iO = S.at.get(tO), iX = S.at.get(tC - M15);
    if (iO == null || iX == null || iX < iO) continue;
    out.push({ date: d, tO, tC, iO, iX, O: S.bars[iO][1], C: S.bars[iX][4] });
  }
  return out;
}
const median = (xs) => { const s = xs.slice().sort((a, b) => a - b), n = s.length; return n % 2 ? s[n >> 1] : (s[n / 2 - 1] + s[n / 2]) / 2; };
// gaps and the trigger: each row gets { prev, g, med, trig }; the median uses the MED_N previous gaps only (today excluded)
export function gaps(sess) {
  const out = [];
  for (let i = 1; i < sess.length; i++) {
    const s = sess[i], p = sess[i - 1], g = s.O - p.C;
    const hist = out.slice(-P.MED_N).map((x) => Math.abs(x.g));
    const med = hist.length === P.MED_N ? median(hist) : null;
    out.push({ ...s, prevDate: p.date, prevC: p.C, prevT: p.tC, g, med, trig: med != null && g !== 0 && Math.abs(g) > P.TRIG * med });
  }
  return out;
}

// ---------- the US cash session (T3) ----------
export function usSessions(S, from = '2005-01-01', to = '2026-11-14') {
  const out = [];
  for (const d of cashDays(from, to)) {
    const [ch, cm] = closeHour(d), open = nyAt(d, 9, 30), close = nyAt(d, ch, cm);
    const iO = S.at.get(open), iC = S.at.get(close - M15);
    out.push({ date: d, closeT: close, ret: iO == null || iC == null ? null : S.bars[iC][4] / S.bars[iO][1] - 1 });
  }
  return out;
}
// the latest US cash session closing after the previous European close and at or before today's open (or null)
export function priorUS(us, prevT, tO) {
  let lo = 0, hi = us.length; while (lo < hi) { const mid = (lo + hi) >> 1; if (us[mid].closeT <= tO) lo = mid + 1; else hi = mid; }
  const u = us[lo - 1]; return u && u.closeT > prevT ? u : null;
}

// ---------- the trade ----------
// s = +1 buy, -1 sell; candles [from, to] checked: an open through the stop exits at the open, a range reaching it at the stop
export function simulate(bars, { s, entry, stop, from, to }) {
  if (!(s * (entry - stop) > 0)) throw new Error('stop must be on the losing side');
  const r0 = Math.abs(entry - stop);
  for (let i = from; i <= to; i++) {
    const b = bars[i];
    if (s > 0 ? b[1] <= stop : b[1] >= stop) return { exit: b[1], how: 'gap', R: s * (b[1] - entry) / r0 };
    if (s > 0 ? b[3] <= stop : b[2] >= stop) return { exit: stop, how: 'stop', R: -1 };
  }
  const x = bars[to][4];
  return { exit: x, how: 'time', R: s * (x - entry) / r0 };
}
export function trade(S, row, atr, s, mk) {
  const entry = row.O, stop = entry - s * P.STOP_ATR * atr, r0 = Math.abs(entry - stop);
  const tr = simulate(S.bars, { s, entry, stop, from: row.iO, to: row.iX });
  const cost = P.COST * entry / r0;
  return { mk, date: row.date, s, entry, stop, ...tr, costR: cost, net: tr.R - cost, net2: tr.R - 2 * cost };
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
  const n = trades.length; if (!n) return { n: 0, months: 0, grossR: null, costR: null, netR: null, net2R: null, t: null, tGross: null, total: 0, maxDD: 0, byYear: {} };
  const tr = trades.slice().sort((a, b) => (a.date < b.date ? -1 : a.date > b.date ? 1 : 0));
  const m = (k) => tr.reduce((a, t) => a + t[k], 0) / n;
  let cum = 0, pk = 0, dd = 0; for (const t of tr) { cum += t.net; pk = Math.max(pk, cum); dd = Math.max(dd, pk - cum); }
  const stopd = tr.map((t) => Math.abs(t.entry - t.stop) / t.entry * 100).sort((a, b) => a - b);
  const byYear = {}; for (const t of tr) { const y = t.date.slice(0, 4); (byYear[y] ||= { n: 0, net: 0 }); byYear[y].n++; byYear[y].net += t.net; }
  for (const y in byYear) byYear[y] = { n: byYear[y].n, netR: r3(byYear[y].net / byYear[y].n), total: r2(byYear[y].net) };
  return {
    n, months: monthSums(tr).size, buys: tr.filter((t) => t.s > 0).length, sells: tr.filter((t) => t.s < 0).length,
    win: r3(tr.filter((t) => t.net > 0).length / n), grossR: r3(m('R')), costR: r3(m('costR')), netR: r3(m('net')), net2R: r3(m('net2')),
    tGross: r2(tStat([...monthSums(tr, 'R').values()])), t: r2(tStat([...monthSums(tr).values()])), total: r2(cum), maxDD: r2(dd),
    stops: tr.filter((t) => t.how !== 'time').length, medStopPct: r3(stopd[n >> 1]), byYear,
  };
}
export function mulberry32(a) { return () => { a |= 0; a = (a + 0x6D2B79F5) | 0; let t = Math.imul(a ^ (a >>> 15), 1 | a); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; }
const pct = (xs, q) => { const s = xs.slice().sort((a, b) => a - b); return s[Math.min(s.length - 1, Math.floor(q * (s.length - 1) + 0.5))]; };

// ---------- the study ----------
export const WIN = { decisive: ['2016-01-01', '2099-12-31'], replication: ['2000-01-01', '2015-12-31'] };
export const TESTS = { T1: { mks: ['de40'], usLed: false }, T2: { mks: ['uk100', 'eu50'], usLed: false }, T3: { mks: ['de40'], usLed: true } };
const inWin = (w) => (x) => x.date >= WIN[w][0] && x.date <= WIN[w][1];
export const signOf = (v) => (v > 0 ? 1 : v < 0 ? -1 : 0);

// candidates of one market: triggered days with an ATR → { row, atr, us }
export function candidates(S, us) {
  const days = dailyBars(S.bars), out = [], drop = { noTrigger: 0, warmup: 0, atr: 0 };
  for (const r of gaps(euSessions(S))) {
    if (r.med == null) { drop.warmup++; continue; }
    if (!r.trig) { drop.noTrigger++; continue; }
    const atr = atrAt(days, r.tO); if (atr == null || !(atr > 0)) { drop.atr++; continue; }
    out.push({ row: r, atr, us: us ? priorUS(us, r.prevT, r.tO) : null });
  }
  return { out, drop };
}
const usLedOk = (c) => c.us && c.us.ret != null && c.us.ret !== 0 && signOf(c.us.ret) === signOf(c.row.g);

function load(dir, sym) { return makeSeries(JSON.parse(zlib.gunzipSync(fs.readFileSync(path.join(dir, `${sym}-15m.json.gz`))))); }

export function study(S) {
  const span = Object.fromEntries(Object.entries(S).map(([k, s]) => [k, { candles: s.bars.length, first: ymd(s.bars[0][0]), last: ymd(s.bars.at(-1)[0]) }]));
  const us = usSessions(S.spx500), cand = {}, drop = {}, desc = {};
  for (const mk of EU) {
    const c = candidates(S[mk], us); cand[mk] = c.out; drop[mk] = c.drop;
    // descriptive: European session return vs the gap (all session days with a previous session), and vs the prior US session
    const g = gaps(euSessions(S[mk]));
    desc[mk] = {};
    for (const w of Object.keys(WIN)) {
      const rows = g.filter(inWin(w)), ses = rows.map((r) => r.C / r.O - 1), gp = rows.map((r) => r.O / r.prevC - 1);
      const ur = rows.map((r) => ({ r, u: priorUS(us, r.prevT, r.tO) })).filter((x) => x.u && x.u.ret != null);
      desc[mk][w] = { sessions: rows.length, sessionVsGap: r3(corr(gp, ses)), usN: ur.length,
        usVsGap: r3(corr(ur.map((x) => x.u.ret), ur.map((x) => x.r.O / x.r.prevC - 1))), usVsSession: r3(corr(ur.map((x) => x.u.ret), ur.map((x) => x.r.C / x.r.O - 1))),
        triggered: rows.filter((r) => r.trig).length };
    }
  }
  const tests = {};
  for (const [k, T] of Object.entries(TESTS)) {
    const pool = T.mks.flatMap((mk) => cand[mk].filter((c) => !T.usLed || usLedOk(c)).map((c) => ({ ...c, mk })));
    const usDrop = T.usLed ? cand.de40.length - pool.length : 0;
    const real = pool.map((c) => trade(S[c.mk], c.row, c.atr, -signOf(c.row.g), c.mk));
    tests[k] = { markets: T.mks.map((m) => SYMS[m]), usLed: T.usLed, ...(T.usLed ? { notUsLed: usDrop } : {}) };
    for (const w of Object.keys(WIN)) {
      const tr = real.filter(inWin(w)), s = summary(tr);
      if (T.mks.length > 1) s.byMarket = Object.fromEntries(T.mks.map((mk) => { const x = summary(tr.filter((t) => t.mk === mk)); return [SYMS[mk], { n: x.n, grossR: x.grossR, netR: x.netR, t: x.t }]; }));
      const pw = pool.filter((c) => inWin(w)(c.row)), ms = [];
      for (let seed = 1; seed <= P.SEEDS; seed++) { const rnd = mulberry32(seed); ms.push(mean(pw.map((c) => trade(S[c.mk], c.row, c.atr, rnd() < 0.5 ? 1 : -1, c.mk).net))); }
      s.placebo = ms.length && pw.length ? { p5: r3(pct(ms, 0.05)), p50: r3(pct(ms, 0.5)), p95: r3(pct(ms, 0.95)), rankOfReal: ms.filter((x) => x < s.netR).length, above95: s.netR > pct(ms, 0.95) } : null;
      tests[k][w] = s;
    }
  }
  const ks = Object.keys(TESTS), ps = ks.map((k) => pOne(tests[k].decisive.t)), adj = holm(ps);
  ks.forEach((k, i) => { tests[k].decisive.p = r3(ps[i]); tests[k].decisive.pHolm = r3(adj[i]); });
  const cond = {};
  for (const k of ks) {
    const d = tests[k].decisive, r = tests[k].replication, nMin = TESTS[k].usLed ? P.MIN_N_T3 : P.MIN_N;
    const c = { decisivePositive: d.netR > 0, replicationPositive: r.netR > 0, holm: d.pHolm < 0.05, n: d.n >= nMin };
    c.pass = Object.values(c).every(Boolean); cond[k] = c;
  }
  const verdictClass = ks.some((k) => cond[k].pass) ? 'PASS' : ks.some((k) => cond[k].decisivePositive && cond[k].replicationPositive) ? 'INCONCLUSIVE' : 'FAIL';
  const d = (k) => tests[k].decisive;
  const verdict = `${verdictClass}: fading the European index overnight gap from the 08:00 London open to the 16:30 close, stop 1 x ATR20, after a 0.04 % round trip, 2016 → now: ` +
    `DE40 ${f(d('T1').netR)}R a trade (n ${d('T1').n}, month-sum t ${f(d('T1').t, 2)}), UK100 + EU50 ${f(d('T2').netR)}R (n ${d('T2').n}, t ${f(d('T2').t, 2)}), ` +
    `DE40 on US-led gaps ${f(d('T3').netR)}R (n ${d('T3').n}, t ${f(d('T3').t, 2)}); before costs ${f(d('T1').grossR)}R, ${f(d('T2').grossR)}R, ${f(d('T3').grossR)}R`;
  return {
    study: 'eu-gap-fade', title: 'Fading the overnight gap on European indices (DE40, UK100, EU50)', built: '2026-11-14', verdict, verdictClass,
    preregistration: 'research/edge/eu-gap-fade/PREREGISTRATION.md',
    source: 'us-asia-lead (#913): the post-hoc reversal of the US-led gap in the Asian session; JP225 / HK33 excluded for that reason',
    data: { source: 'OANDA mid M15 via /md/bars', span, usSessions: us.filter((u) => u.ret != null).length, dropped: drop },
    params: P, windows: WIN, holmSet: ks, tests, conditions: cond, describe: desc,
  };
}

// ---------- RESULT.md from result.json ----------
const f = (x, d = 3) => (x == null ? 'n/a' : (x > 0 ? '+' : x < 0 ? '−' : '') + Math.abs(x).toFixed(d));
const WL = { decisive: '2016 → now (decides)', replication: 'start → 2015 (replication)' };
const NAME = { T1: 'T1 DE40', T2: 'T2 UK100 + EU50', T3: 'T3 DE40, US-led gaps' };
export function report(res) {
  const L = [], ks = Object.keys(res.tests), yn = (b) => (b ? 'yes' : 'no');
  L.push(`# ${res.title}: result`, '');
  L.push(`Pre-registered in PREREGISTRATION.md (committed alone, before any candle of these markets was fetched). Built ${res.built}. Source of the idea: ${res.source}. Paper research only: nothing live changed.`, '');
  L.push(`## Verdict: ${res.verdict}.`, '');
  L.push('| Test | Window | n | Buys / sells | Win | Gross R | Cost R | Net R | Net R at 2x cost | Month t gross | Month t net | Total net R | Max DD R | Stopped |');
  L.push('|---|---|---:|---|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|');
  for (const k of ks) for (const w of ['decisive', 'replication']) {
    const s = res.tests[k][w];
    L.push(`| ${NAME[k]} | ${WL[w]} | ${s.n} | ${s.buys ?? 0} / ${s.sells ?? 0} | ${s.win == null ? 'n/a' : (s.win * 100).toFixed(1) + ' %'} | ${f(s.grossR)} | ${f(s.costR == null ? null : -s.costR)} | ${f(s.netR)} | ${f(s.net2R)} | ${f(s.tGross, 2)} | ${f(s.t, 2)} | ${f(s.total, 1)} | ${(s.maxDD ?? 0).toFixed(1)} | ${s.stops ?? 0} |`);
  }
  L.push('', '## Pass conditions', '', '| Test | net > 0 (2016 → now) | net > 0 (to 2015) | Holm p < 0.05 | n ≥ 200 (T3: 100), decisive | Pass |', '|---|---|---|---|---|---|');
  for (const k of ks) { const c = res.conditions[k], d = res.tests[k].decisive; L.push(`| ${k} | ${yn(c.decisivePositive)} | ${yn(c.replicationPositive)} | ${yn(c.holm)} (p ${d.p}, Holm ${d.pHolm}) | ${yn(c.n)} | ${yn(c.pass)} |`); }
  L.push('', '## Placebo (40 seeds, random side on the same days, mean net R a trade; reported, not a pass condition)', '', '| Test | Window | Real | Random side p5 / p50 / p95 | Rank of real (of 40) |', '|---|---|---:|---|---:|');
  for (const k of ks) for (const w of ['decisive', 'replication']) { const s = res.tests[k][w], a = s.placebo; L.push(`| ${NAME[k]} | ${WL[w]} | ${f(s.netR)} | ${a ? `${f(a.p5)} / ${f(a.p50)} / ${f(a.p95)}` : 'n/a'} | ${a ? a.rankOfReal : 'n/a'} |`); }
  const t2 = res.tests.T2;
  L.push('', '## T2 by market (descriptive)', '');
  for (const w of ['decisive', 'replication']) if (t2[w].byMarket) L.push(`- ${WL[w]}: ` + Object.entries(t2[w].byMarket).map(([m, x]) => `${m} n ${x.n}, ${f(x.grossR)}R gross, ${f(x.netR)}R net, t ${f(x.t, 2)}`).join('; ') + '.');
  L.push('', '## Gap and session (descriptive, every session day with a previous session)', '');
  for (const mk of Object.keys(res.describe)) for (const w of ['decisive', 'replication']) {
    const x = res.describe[mk][w];
    L.push(`- ${SYMS[mk]} ${WL[w]}: ${x.sessions} sessions, ${x.triggered} triggered; correlation of the gap with the session after it ${f(x.sessionVsGap, 2)}; prior US session vs the gap ${f(x.usVsGap, 2)}, vs the European session ${f(x.usVsSession, 2)} (n ${x.usN}).`);
  }
  L.push('', '## By year (net R a trade, total, n)', '', `| Year | ${ks.map((k) => NAME[k]).join(' | ')} |`, `|---|${ks.map(() => '---').join('|')}|`);
  const years = [...new Set(ks.flatMap((k) => ['replication', 'decisive'].flatMap((w) => Object.keys(res.tests[k][w].byYear || {}))))].sort();
  for (const y of years) { const cell = (k) => { const b = (res.tests[k][y >= '2016' ? 'decisive' : 'replication'].byYear || {})[y]; return b ? `${f(b.netR)} (${f(b.total, 1)}, n ${b.n})` : '—'; }; L.push(`| ${y} | ${ks.map(cell).join(' | ')} |`); }
  L.push('', '## Reading', '', res.reading || READING[res.verdictClass] || '', '');
  const sp = res.data.span;
  L.push('## Data', '', `OANDA mid M15: ${Object.entries(sp).map(([k, v]) => `${SYMS[k]} ${v.candles} candles ${v.first} to ${v.last}`).join('; ')}; ${res.data.usSessions} US cash sessions with both candles. ` +
    `Days dropped before a trade: ${Object.entries(res.data.dropped).map(([k, v]) => `${SYMS[k]} ${v.warmup} warm-up, ${v.noTrigger} under the trigger, ${v.atr} without an ATR`).join('; ')}; T3 left out ${res.tests.T3.notUsLed} DE40 trades whose gap did not have the prior US session's sign (or had no prior US session). ` +
    'European exchange holidays are not excluded by a calendar (pre-registered): a day counts when the CFD printed both the 08:00 and the 16:15 London candle. ' +
    'To repeat: `node --use-env-proxy research/edge/eu-gap-fade/run.mjs fetch <dir>`, then `node research/edge/eu-gap-fade/run.mjs full <dir>` (candles kept out of git).', '');
  return L.join('\n');
}
export const READING = {
  FAIL: 'Not an edge. See the tables: no test is net-positive in both windows. Never call this an edge and never propose it as a council system; nothing live changed.',
  INCONCLUSIVE: 'Not proven. At least one test was net-positive in both windows but missed the Holm bar or the minimum n. Not an edge; a follow-up needs its own pre-registration on other data. Nothing live changed.',
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
    const S = Object.fromEntries(Object.keys(SYMS).map((k) => [k, load(dir, k)]));
    const file = path.join(HERE, 'result.json'), old = fs.existsSync(file) ? JSON.parse(fs.readFileSync(file, 'utf8')) : {};
    const res = { ...study(S), ...(old.reading ? { reading: old.reading } : {}) };
    fs.writeFileSync(file, JSON.stringify(res, null, 1) + '\n');
    fs.writeFileSync(path.join(HERE, 'RESULT.md'), report(res));
    console.log(res.verdict);
  } else throw new Error('usage: node run.mjs fetch|full <dir>');
}
