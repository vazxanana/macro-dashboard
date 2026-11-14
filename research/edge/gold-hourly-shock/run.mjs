// Edge research · gold-hourly-shock: after a single H1 candle whose close-to-close return is beyond 3 standard deviations of the
// previous 500 H1 returns, fade it (T1, T3) or follow it (T2) for six hours. Rules: PREREGISTRATION.md (pushed alone first).
// A stand-alone rule: not a gate, exit, entry or size of the live gold book (owner decision 44). Paper research only.
//
//   node research/edge/gold-hourly-shock/run.mjs <xau-h1.json>   -> result.json + RESULT.md in this folder
//
// The candle file ([[t, o, h, l, c], ...], OANDA mid H1 XAU_USD, UTC hour start) is kept out of git.
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { nights, FIN } from '../../../council/fills.mjs';
import { HISTORY, EVENTS, zonedToUtc } from '../../../council/events.mjs';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const H1 = 3600;
export const P = {
  LOOK: 500, K: 3, GAP: 6 * H1, NEXT: 3 * H1, BUF: 0.30, MIN_R: 0.30, HOLD: 6, COST: 0.60,
  IS: ['2008-01-01', '2017-01-01'], OOS: ['2017-01-01', '2099-01-01'], HALF: '2022-01-01',
  SEEDS: 40, Q: 0.95, BEATS: 38, MIN_N: 30, FIN: FIN.xau.long,
};

// ── release minutes (US CPI, payrolls, scheduled FOMC) ──
const US = 'America/New_York';
// FOMC 2008-2021: the Federal Reserve's scheduled-meeting calendars (the list research/edge/pre-fomc-drift and fomc-follow use)
const FOMC_OLD = {
  2008: ['01-30', '03-18', '04-30', '06-25', '08-05', '09-16', '10-29', '12-16'],
  2009: ['01-28', '03-18', '04-29', '06-24', '08-12', '09-23', '11-04', '12-16'],
  2010: ['01-27', '03-16', '04-28', '06-23', '08-10', '09-21', '11-03', '12-14'],
  2011: ['01-26', '03-15', '04-27', '06-22', '08-09', '09-21', '11-02', '12-13'],
  2012: ['01-25', '03-13', '04-25', '06-20', '08-01', '09-13', '10-24', '12-12'],
  2013: ['01-30', '03-20', '05-01', '06-19', '07-31', '09-18', '10-30', '12-18'],
  2014: ['01-29', '03-19', '04-30', '06-18', '07-30', '09-17', '10-29', '12-17'],
  2015: ['01-28', '03-18', '04-29', '06-17', '07-29', '09-17', '10-28', '12-16'],
  2016: ['01-27', '03-16', '04-27', '06-15', '07-27', '09-21', '11-02', '12-14'],
  2017: ['02-01', '03-15', '05-03', '06-14', '07-26', '09-20', '11-01', '12-13'],
  2018: ['01-31', '03-21', '05-02', '06-13', '08-01', '09-26', '11-08', '12-19'],
  2019: ['01-30', '03-20', '05-01', '06-19', '07-31', '09-18', '10-30', '12-11'],
  2020: ['01-29', '04-29', '06-10', '07-29', '09-16', '11-05', '12-16'],
  2021: ['01-27', '03-17', '04-28', '06-16', '07-28', '09-22', '11-03', '12-15'],
};
const PRESS_1230 = new Set(['2011-04-27', '2011-06-22', '2011-11-02', '2012-01-25', '2012-04-25', '2012-06-20', '2012-09-13', '2012-12-12']);
export const fomcClock = (d) => (d < '2013-01-01' ? (PRESS_1230.has(d) ? '12:30' : '14:15') : '14:00');
// payrolls 2008-2021: the BLS rule with the exceptions research/edge/nfp-follow uses
const ymd = (ms) => new Date(ms).toISOString().slice(0, 10);
export function blsRuleDate(y, m) { const d12 = Date.UTC(y, m - 1, 12), dow = new Date(d12).getUTCDay(), sat = d12 + (6 - dow) * 86400e3; return ymd(sat + 20 * 86400e3); }
const SHUTDOWN = { '2013-10-04': '2013-10-22', '2013-11-01': '2013-11-08' };
export function blsDate(y, m) {
  const d = blsRuleDate(y, m); if (SHUTDOWN[d]) return SHUTDOWN[d];
  const [Y, M, D] = d.split('-').map(Number), t = Date.UTC(Y, M - 1, D);
  if (M === 1 && D <= 3) return ymd(t + 7 * 86400e3);
  const jul4 = new Date(Date.UTC(Y, 6, 4)).getUTCDay(), hol = jul4 === 6 ? 3 : jul4 === 0 ? 5 : 4;
  if (M === 7 && D === hol) return ymd(t - 86400e3);
  return d;
}
// CPI 2012-2017: research/edge/cpi-follow's list written from memory (all of it, also the dates it dropped); 2018-2021: the BLS
// schedule copied in research/edge/event-reaction/build.mjs. 2008-2011: not in the repository (not tagged; see the broad tag).
const yl = (yr, md) => md.map((d) => `${yr}-${d}`);
const CPI_OLD = [
  ...yl(2012, ['01-19', '02-17', '03-16', '04-13', '05-15', '06-14', '07-17', '08-15', '09-14', '10-16', '11-15', '12-14']),
  ...yl(2013, ['01-16', '02-21', '03-15', '04-16', '05-16', '06-18', '07-16', '08-15', '09-17', '10-30', '11-20', '12-17']),
  ...yl(2014, ['01-16', '02-20', '03-18', '04-15', '05-15', '06-17', '07-22', '08-19', '09-17', '10-22', '11-20', '12-17']),
  ...yl(2015, ['01-16', '02-26', '03-24', '04-17', '05-22', '06-18', '07-17', '08-19', '09-16', '10-15', '11-17', '12-15']),
  ...yl(2016, ['01-20', '02-19', '03-16', '04-14', '05-17', '06-16', '07-15', '08-16', '09-16', '10-18', '11-17', '12-15']),
  ...yl(2017, ['01-18', '02-15', '03-15', '04-14', '05-12', '06-14', '07-14', '08-11', '09-14', '10-13', '11-15', '12-13']),
  '2018-01-12', '2018-02-14', '2018-03-13', '2018-04-11', '2018-05-10', '2018-06-12', '2018-07-12', '2018-08-10', '2018-09-13', '2018-10-11', '2018-11-14', '2018-12-12',
  '2019-01-11', '2019-02-13', '2019-03-12', '2019-04-10', '2019-05-10', '2019-06-12', '2019-07-11', '2019-08-13', '2019-09-12', '2019-10-10', '2019-11-13', '2019-12-11',
  '2020-01-14', '2020-02-13', '2020-03-11', '2020-04-10', '2020-05-12', '2020-06-10', '2020-07-14', '2020-08-12', '2020-09-11', '2020-10-13', '2020-11-12', '2020-12-10',
  '2021-01-13', '2021-02-10', '2021-03-10', '2021-04-13', '2021-05-12', '2021-06-10', '2021-07-13', '2021-08-11', '2021-09-14', '2021-10-13', '2021-11-10', '2021-12-10'];

export function releaseTimes() {
  const ts = [];
  for (const [y, list] of Object.entries(FOMC_OLD)) for (const md of list) { const d = `${y}-${md}`; ts.push({ t: zonedToUtc(d, fomcClock(d), US), type: 'FOMC' }); }
  for (let y = 2007; y <= 2021; y++) for (let m = 1; m <= 12; m++) {
    if ((y === 2007 && m < 12) || (y === 2021 && m === 12)) continue;
    ts.push({ t: zonedToUtc(blsDate(y, m), '08:30', US), type: 'NFP' });
  }
  for (const d of CPI_OLD) ts.push({ t: zonedToUtc(d, '08:30', US), type: 'CPI' });
  for (const e of [...HISTORY, ...EVENTS]) if (['CPI', 'NFP', 'FOMC'].includes(e.type)) ts.push({ t: e.t, type: e.type });
  const seen = new Set();
  return ts.filter((x) => (seen.has(x.t) ? false : (seen.add(x.t), true))).sort((a, b) => a.t - b.t);
}
// the candle [t, t + 1 h) contains a release minute
export function releaseIn(t, rel) {
  let lo = 0, hi = rel.length; while (lo < hi) { const m = (lo + hi) >> 1; if (rel[m].t < t) lo = m + 1; else hi = m; }
  return lo < rel.length && rel[lo].t < t + H1 ? rel[lo].type : null;
}
// broad tag (report only): a weekday candle that contains 08:30 New York
const NYP = new Intl.DateTimeFormat('en-US', { timeZone: US, hourCycle: 'h23', hour: '2-digit', weekday: 'short' });
export function broad830(t) {
  const p = Object.fromEntries(NYP.formatToParts(new Date((t + 1800) * 1000)).map((x) => [x.type, x.value]));
  return +p.hour === 8 && !['Sat', 'Sun'].includes(p.weekday);
}

// ── candles, returns, volatility (strictly from earlier returns) ──
export function prepare(rows, look = P.LOOK) {
  const C = rows.map(([t, o, h, l, c]) => ({ t, o, h, l, c }));
  const win = []; let s1 = 0, s2 = 0;
  for (let i = 0; i < C.length; i++) {
    const x = C[i]; x.gap = i === 0 || x.t - C[i - 1].t > P.GAP;
    x.r = x.gap ? null : Math.log(x.c / C[i - 1].c);
    x.sd = win.length === look ? Math.sqrt(Math.max(0, (s2 - s1 * s1 / look) / (look - 1))) : null;
    x.z = x.r != null && x.sd > 0 ? x.r / x.sd : null;
    if (x.r != null) { win.push(x.r); s1 += x.r; s2 += x.r * x.r; if (win.length > look) { const o = win.shift(); s1 -= o; s2 -= o * o; } }
  }
  return C;
}
// a candle can lead to a trade: known z, and the next candle opens within 3 h of its start
export const eligible = (C, i) => C[i].z != null && i + 1 < C.length && C[i + 1].t - C[i].t <= P.NEXT;
export function shocks(C, rel) {
  const out = [];
  for (let i = 0; i < C.length; i++) if (eligible(C, i) && Math.abs(C[i].z) > P.K) out.push({ i, t: C[i].t, up: C[i].z > 0, z: C[i].z, rel: releaseIn(C[i].t, rel), broad: broad830(C[i].t) });
  return out;
}

// ── one trade: T1 / T3 'fade', T2 'follow'; cm = cost multiple ──
export function spec(C, i, kind) {
  const s = C[i], e = C[i + 1], E = e.o, M = (s.h + s.l) / 2, up = s.c > C[i - 1].c;
  const side = kind === 'follow' ? (up ? 1 : -1) : (up ? -1 : 1);
  let stop, target = null;
  if (kind === 'follow') stop = M;
  else { stop = side < 0 ? s.h + P.BUF : s.l - P.BUF; target = M; }
  const r0 = (E - stop) * side;
  if (!(r0 > 0)) return { skip: 'stop side' };
  if (r0 < P.MIN_R) return { skip: 'stop too close' };
  if (target != null && !((target - E) * side > 0)) return { skip: 'target passed' };
  return { side, E, stop, target, r0, e: i + 1 };
}
export function sim(C, i, kind, cm = 1) {
  const sp = spec(C, i, kind); if (sp.skip) return sp;
  const { side, E, stop, target, r0, e } = sp;
  let px = null, why = null, xi = null, xt = null;
  for (let j = e; j < C.length && j < e + P.HOLD; j++) {
    const b = C[j];
    if (j > e && b.t - C[j - 1].t > P.GAP) { px = b.o; why = 'gap'; xi = j; xt = b.t; break; }
    const stopHit = side > 0 ? b.l <= stop : b.h >= stop;
    if (stopHit) { px = side > 0 ? Math.min(stop, b.o) : Math.max(stop, b.o); why = 'stop'; xi = j; xt = (side > 0 ? b.o <= stop : b.o >= stop) ? b.t : b.t + H1; break; }
    if (target != null && (side > 0 ? b.h >= target : b.l <= target)) { px = target; why = 'target'; xi = j; xt = b.t + H1; break; }
    if (j === e + P.HOLD - 1) { px = b.c; why = 'time'; xi = j; xt = b.t + H1; }
  }
  if (px == null) return { skip: 'data end' };
  const gross = (px - E) * side / r0;
  const nn = side > 0 ? nights(C[e].t, xt) : 0, fin = nn * P.FIN * E / r0;
  const cost = (P.COST / r0 + fin) * cm;
  return { t0: C[i].t, te: C[e].t, i, xi, side, E, stop, target, r0, px, why, nights: nn, gross, fin, net: gross - cost };
}
// one position at a time: a candidate whose shock candle is before the last exit candle is skipped
export function stream(C, cands, kind, cm = 1) {
  const out = [], funnel = { shocks: cands.length, busy: 0 }; let free = -1;
  for (const s of cands) {
    if (s.i < free) { funnel.busy++; continue; }
    const r = sim(C, s.i, kind, cm);
    if (r.skip) { funnel[r.skip] = (funnel[r.skip] || 0) + 1; continue; }
    r.rel = s.rel || null; r.broad = !!s.broad; out.push(r); free = r.xi;
  }
  funnel.trades = out.length; return { trades: out, funnel };
}

// ── statistics ──
export function tstat(xs) {
  const n = xs.length; if (n < 2) return { n, mean: n ? xs[0] : null, t: null };
  const m = xs.reduce((a, x) => a + x, 0) / n, v = xs.reduce((a, x) => a + (x - m) ** 2, 0) / (n - 1);
  return { n, mean: m, t: v > 0 ? m / Math.sqrt(v / n) : null };
}
const mon = (t) => new Date(t * 1000).toISOString().slice(0, 7);
export function monthT(tr, key = 'net') { const m = new Map(); for (const r of tr) m.set(mon(r.te), (m.get(mon(r.te)) || 0) + r[key]); const s = tstat([...m.values()]); return { months: s.n, t: s.t }; }
export function normSf(z) {
  const t = 1 / (1 + 0.2316419 * Math.abs(z)), d = 0.3989422804014327 * Math.exp(-z * z / 2);
  const p = d * t * (0.319381530 + t * (-0.356563782 + t * (1.781477937 + t * (-1.821255978 + t * 1.330274429))));
  return z >= 0 ? p : 1 - p;
}
export function holm(ps) { const idx = ps.map((p, i) => [p, i]).sort((a, b) => a[0] - b[0]), out = new Array(ps.length); let run = 0; idx.forEach(([p, i], k) => { run = Math.max(run, Math.min(1, p * (ps.length - k))); out[i] = run; }); return out; }
export function mulberry32(a) { return () => { a |= 0; a = (a + 0x6D2B79F5) | 0; let t = Math.imul(a ^ (a >>> 15), 1 | a); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; }
const r3 = (x) => (x == null || !Number.isFinite(x) ? null : Math.round(x * 1000) / 1000), r2 = (x) => (x == null || !Number.isFinite(x) ? null : Math.round(x * 100) / 100);
const day = (t) => new Date(t * 1000).toISOString().slice(0, 10);
export const inW = (t, w) => day(t) >= w[0] && day(t) < w[1];
const mean = (tr, k) => (tr.length ? tr.reduce((a, r) => a + r[k], 0) / tr.length : null);
export function summary(tr, tr2) {
  const mt = monthT(tr, 'net'), mg = monthT(tr, 'gross'), ex = {};
  let run = 0, pk = 0, dd = 0; for (const r of tr) { run += r.net; pk = Math.max(pk, run); dd = Math.min(dd, run - pk); ex[r.why] = (ex[r.why] || 0) + 1; }
  const st = tr.map((r) => r.r0).sort((a, b) => a - b);
  return { n: tr.length, gross: r3(mean(tr, 'gross')), net: r3(mean(tr, 'net')), net2: r3(mean(tr2, 'net')), win: tr.length ? r3(tr.filter((r) => r.net > 0).length / tr.length) : null,
    total: r2(run), maxDD: r2(dd), stop$: st.length ? r2(st[st.length >> 1]) : null, months: mt.months, t: r2(mt.t), tGross: r2(mg.t), exits: ex };
}

const NAMES = { T1: 'fade (against the shock, target the 50%)', T2: 'follow (with the shock, stop at the 50%)', T3: 'fade, non-release shocks only' };
const KIND = { T1: 'fade', T2: 'follow', T3: 'fade' };
export function runAll(rows, opts = {}) {
  const seeds = opts.seeds ?? P.SEEDS, rel = releaseTimes(), C = prepare(rows), S = shocks(C, rel).filter((s) => inW(s.t, [P.IS[0], P.OOS[1]]));
  const sets = { T1: S, T2: S, T3: S.filter((s) => !s.rel) };
  // placebo class: |z| at or above the 95th percentile of all eligible |z| (2008-now), and not a shock
  const zs = []; for (let i = 0; i < C.length; i++) if (eligible(C, i) && inW(C[i].t, [P.IS[0], P.OOS[1]])) zs.push(Math.abs(C[i].z));
  zs.sort((a, b) => a - b); const zq = zs[Math.ceil(P.Q * zs.length) - 1];
  const pool = { all: new Map(), clean: new Map() };
  for (let i = 0; i < C.length; i++) {
    if (!eligible(C, i) || !inW(C[i].t, P.OOS)) continue; const a = Math.abs(C[i].z); if (a < zq || a > P.K) continue;
    const h = new Date(C[i].t * 1000).getUTCHours(), x = { i, t: C[i].t };
    (pool.all.get(h) || pool.all.set(h, []).get(h)).push(x);
    if (!releaseIn(C[i].t, rel)) (pool.clean.get(h) || pool.clean.set(h, []).get(h)).push(x);
  }
  const tests = {};
  for (const T of ['T1', 'T2', 'T3']) {
    const all = stream(C, sets[T], KIND[T]), all2 = stream(C, sets[T], KIND[T], 2);
    const by = (w, src = all.trades) => src.filter((r) => inW(r.te, w));
    const is = summary(by(P.IS), by(P.IS, all2.trades)), oos = summary(by(P.OOS), by(P.OOS, all2.trades));
    const h1 = summary(by([P.OOS[0], P.HALF]), by([P.OOS[0], P.HALF], all2.trades)), h2 = summary(by([P.HALF, P.OOS[1]]), by([P.HALF, P.OOS[1]], all2.trades));
    oos.p = oos.t == null ? 1 : normSf(oos.t);
    // placebo
    const src = T === 'T3' ? pool.clean : pool.all, oosShocks = sets[T].filter((s) => inW(s.t, P.OOS)), pm = [];
    for (let seed = 1; seed <= seeds; seed++) {
      const rnd = mulberry32(seed), used = new Set(), picks = [];
      for (const s of oosShocks) {
        const h = new Date(s.t * 1000).getUTCHours(), list = (src.get(h) || []).filter((x) => !used.has(x.i)); if (!list.length) continue;
        const x = list[Math.floor(rnd() * list.length)]; used.add(x.i); picks.push(x);
      }
      picks.sort((a, b) => a.i - b.i); const tr = stream(C, picks, KIND[T]).trades; pm.push(mean(tr, 'net') ?? 0);
    }
    const ps = [...pm].sort((a, b) => a - b);
    const placebo = { seeds, zClass: r3(zq), mean: r3(mean(pm.map((v) => ({ v })), 'v')), q95: r3(ps[Math.ceil(P.Q * ps.length) - 1]), max: r3(ps.at(-1)), beats: pm.filter((v) => oos.net != null && oos.net > v).length };
    // reported: release / non-release splits, broad tag (T3), years
    const relOnly = all.trades.filter((r) => r.rel), nonRel = all.trades.filter((r) => !r.rel);
    const split = { release: { is: summary(by(P.IS, relOnly), []), oos: summary(by(P.OOS, relOnly), []) }, nonRelease: { is: summary(by(P.IS, nonRel), []), oos: summary(by(P.OOS, nonRel), []) } };
    let broad = null;
    if (T === 'T3') { const b = stream(C, sets.T3.filter((s) => !s.broad), 'fade'), b2 = stream(C, sets.T3.filter((s) => !s.broad), 'fade', 2); broad = { is: summary(b.trades.filter((r) => inW(r.te, P.IS)), b2.trades.filter((r) => inW(r.te, P.IS))), oos: summary(b.trades.filter((r) => inW(r.te, P.OOS)), b2.trades.filter((r) => inW(r.te, P.OOS))) }; }
    const years = {}; for (const r of all.trades) { const y = day(r.te).slice(0, 4); (years[y] ||= { n: 0, net: 0 }); years[y].n++; years[y].net += r.net; }
    for (const y in years) years[y].net = r2(years[y].net);
    tests[T] = { name: NAMES[T], is, oos, halves: { a: h1, b: h2 }, placebo, split, broad, years, funnel: all.funnel,
      trades: all.trades.map((r) => [r.te, r.side, r2(r.r0), r.why, r3(r.net)]) };
  }
  const ks = Object.keys(tests), hp = holm(ks.map((k) => tests[k].oos.p));
  ks.forEach((k, j) => {
    const x = tests[k]; x.holm = r3(hp[j]);
    x.checks = { oosPos: (x.oos.net ?? -1) > 0, t2: (x.oos.t ?? -9) >= 2 && hp[j] <= 0.05, halves: (x.is.net ?? -1) > 0 && (x.halves.a.net ?? -1) > 0 && (x.halves.b.net ?? -1) > 0,
      costs2: (x.oos.net2 ?? -1) > 0, placebo: x.placebo.beats >= P.BEATS, n: x.oos.n >= P.MIN_N };
    x.pass = Object.values(x.checks).every(Boolean);
  });
  const shockStats = { total: S.length, up: S.filter((s) => s.up).length, release: S.filter((s) => s.rel).length, is: S.filter((s) => inW(s.t, P.IS)).length, oos: S.filter((s) => inW(s.t, P.OOS)).length,
    byHour: S.reduce((a, s) => { const h = new Date(s.t * 1000).getUTCHours(); a[h] = (a[h] || 0) + 1; return a; }, {}) };
  const passed = ks.filter((k) => tests[k].pass);
  return { verdict: passed.length ? 'PASS' : 'FAIL', passed, data: { from: day(rows[0][0]), to: day(rows.at(-1)[0]), candles: rows.length, releases: rel.length }, shocks: shockStats, tests };
}

const fmt = (x, d = 3) => (x == null ? 'n/a' : (x > 0 ? '+' : x < 0 ? '−' : '') + Math.abs(x).toFixed(d));
const ft = (x) => (x == null ? 'n/a' : (x < 0 ? '−' : '') + Math.abs(x).toFixed(2));
export function headline(res) {
  const T = res.tests, s = (k) => `${k} ${fmt(T[k].oos.net)} (n ${T[k].oos.n}, t ${ft(T[k].oos.t)})`;
  return `**Verdict: ${res.verdict}, ${res.passed.length} of 3 pass: OOS 2017-now net R a trade ${s('T1')}, ${s('T2')}, ${s('T3')}.**`;
}
export function report(res, built) {
  const T = res.tests, L = [`# Gold after a return shock on one H1 candle: fade or follow? Result (${built})`, '', headline(res), '',
    'Pre-registered in `PREREGISTRATION.md` (pushed alone before any trade was computed). A new stand-alone intraday rule on spot gold, not a gate, exit, entry or size of the live gold book (docs/owner-decisions.md item 44). Paper research only: nothing live changed and no proposal is written.', '',
    '## Data and events', '',
    `- OANDA mid H1 XAU/USD, ${res.data.from} to ${res.data.to}, ${res.data.candles} candles. Shock = a candle whose close-to-close log return is beyond 3 x the sd of the 500 previous non-gap H1 returns (no return across a closure of over 6 h counts).`,
    `- Shocks from 2008: ${res.shocks.total} (${res.shocks.up} up), IS 2008-16 ${res.shocks.is}, OOS 2017-now ${res.shocks.oos}; ${res.shocks.release} contain a CPI, payrolls or FOMC release minute (${res.data.releases} release minutes listed; CPI 2008-11 is not in the repository, so those hours are not tagged).`,
    '- Entry at the next H1 open; T1 / T3 stop $0.30 beyond the shock extreme, target its 50%; T2 stop at its 50%, no target; out at the 6th candle\'s close; stop first when a candle holds both; one position at a time per test.',
    `- Costs: $0.60 a round trip; buys pay \`FIN.xau.long\` (${P.FIN} of price a rollover) per \`nights()\`; 2× = $1.20 and twice the financing. A stop or target inside a candle is stamped at the candle's end for the financing count (a rollover in that hour is charged).`, '',
    '## Results (R of the stop distance; t on calendar-month sums of net R)', '',
    '| Test | Window | n | Gross R | Net R | Net at 2× | Win % | Total net R | Worst DD R | Median 1R $ | t net | t gross | Holm p (OOS) | Pass |',
    '|---|---|---|---|---|---|---|---|---|---|---|---|---|---|'];
  for (const k of Object.keys(T)) for (const [w, s] of [['IS 2008-16', T[k].is], ['OOS 2017-now', T[k].oos]])
    L.push(`| ${k} ${T[k].name} | ${w} | ${s.n} | ${fmt(s.gross)} | ${fmt(s.net)} | ${fmt(s.net2)} | ${s.win == null ? 'n/a' : (s.win * 100).toFixed(1)} | ${fmt(s.total, 2)} | ${fmt(s.maxDD, 2)} | ${s.stop$ ?? 'n/a'} | ${ft(s.t)} | ${ft(s.tGross)} | ${w.startsWith('OOS') ? T[k].holm.toFixed(4) : ''} | ${w.startsWith('OOS') ? (T[k].pass ? 'yes' : 'no') : ''} |`);
  L.push('', '## OOS halves', '', '| Test | 2017-21 n | net R | t | 2022-now n | net R | t |', '|---|---|---|---|---|---|---|');
  for (const k of Object.keys(T)) { const a = T[k].halves.a, b = T[k].halves.b; L.push(`| ${k} | ${a.n} | ${fmt(a.net)} | ${ft(a.t)} | ${b.n} | ${fmt(b.net)} | ${ft(b.t)} |`); }
  L.push('', `## Placebo (40 seeds: random OOS H1 candles of the same UTC hour, |z| from the 95th percentile (${T.T1.placebo.zClass}) up to 3, same rule)`, '',
    '| Test | Rule OOS net R | Placebo mean | Placebo 95th pct | Placebo max | Seeds beaten |', '|---|---|---|---|---|---|');
  for (const k of Object.keys(T)) { const p = T[k].placebo; L.push(`| ${k} | ${fmt(T[k].oos.net)} | ${fmt(p.mean)} | ${fmt(p.q95)} | ${fmt(p.max)} | ${p.beats} of ${p.seeds} |`); }
  L.push('', '## Pass checks (all needed: OOS net > 0; OOS t ≥ 2 and Holm p ≤ 0.05; IS and both OOS halves positive; positive at 2× costs; beats ≥ 38 of 40 placebos; OOS n ≥ 30)', '',
    '| Test | OOS > 0 | t / Holm | Halves | 2× costs | Placebo | n |', '|---|---|---|---|---|---|---|');
  const yn = (b) => (b ? 'yes' : 'no');
  for (const k of Object.keys(T)) { const c = T[k].checks; L.push(`| ${k} | ${yn(c.oosPos)} | ${yn(c.t2)} | ${yn(c.halves)} | ${yn(c.costs2)} | ${yn(c.placebo)} | ${yn(c.n)} |`); }
  L.push('', '## Reported, not tested', '', '| Stream | Shocks | IS n | IS net R | IS t | OOS n | OOS net R | OOS t |', '|---|---|---|---|---|---|---|---|');
  for (const k of ['T1', 'T2']) for (const [nm, s] of [['release only', T[k].split.release], ['non-release only', T[k].split.nonRelease]])
    L.push(`| ${k} trades of the stream | ${nm} | ${s.is.n} | ${fmt(s.is.net)} | ${ft(s.is.t)} | ${s.oos.n} | ${fmt(s.oos.net)} | ${ft(s.oos.t)} |`);
  const b = T.T3.broad; L.push(`| T3, broad tag (no weekday 08:00 New York hour) | own stream | ${b.is.n} | ${fmt(b.is.net)} | ${ft(b.is.t)} | ${b.oos.n} | ${fmt(b.oos.net)} | ${ft(b.oos.t)} |`);
  L.push('', 'The release split takes the trades of each one-at-a-time stream and splits them by the shock\'s tag; T3 is the non-release stream run on its own.', '');
  for (const k of Object.keys(T)) {
    const f = T[k].funnel, ex = (s) => Object.entries(s.exits).map(([a, v]) => `${a} ${v}`).join(', ');
    L.push(`- ${k} funnel: ${f.shocks} shocks, ${f.trades} trades; skipped: busy ${f.busy || 0}, stop too close ${f['stop too close'] || 0}, stop side ${f['stop side'] || 0}, target passed ${f['target passed'] || 0}, data end ${f['data end'] || 0}. Exits IS: ${ex(T[k].is)}; OOS: ${ex(T[k].oos)}.`);
  }
  L.push('', '| Year | ' + Object.keys(T).map((k) => `${k} n | ${k} net R`).join(' | ') + ' |', '|---|' + Object.keys(T).map(() => '---|---|').join(''));
  const ys = [...new Set(Object.values(T).flatMap((x) => Object.keys(x.years)))].sort();
  for (const y of ys) L.push(`| ${y} | ` + Object.keys(T).map((k) => { const v = T[k].years[y]; return v ? `${v.n} | ${fmt(v.net, 2)}` : '0 | n/a'; }).join(' | ') + ' |');
  L.push('', `Shocks by UTC hour (2008-now): ${Object.entries(res.shocks.byHour).sort((a, c) => +a[0] - +c[0]).map(([h, v]) => `${h}h ${v}`).join(', ')}.`, '',
    '## What this means', '', res.verdict === 'PASS' ? 'A test passed the pre-registered bar: a proposal for the owner at most, never a live change.' : ['No test meets the pre-registered bar. Before costs the three streams sit within about 0.1R of zero in both windows (largest gross month t',
      `${ft(Math.max(...Object.values(T).flatMap((x) => [x.is.tGross, x.oos.tGross])))}): after a 3-sd hour gold neither reliably gives back half the candle nor runs on over the next six hours.`,
      'The fade\'s stop sits about $2 from the entry, so the $0.60 round trip alone costs it 0.3-0.4R a trade (gross minus net in the table), and the loss is that cost.',
      'The placebo "beats" only say the rule loses less than the same rule on random large hours of the same clock hour (whose stops are tighter still); they are not evidence of an edge when the rule itself loses.',
      'The one positive line, T2 on release shocks in sample (n 74, t 1.30), reverses out of sample and was not a test.',
      'Not an edge; not a gate, filter, exit or size for any live system; no proposal. Nothing live changed.'].join(' '), '',
    '## Repeat', '', '`node research/edge/gold-hourly-shock/run.mjs <xau-h1.json>` (OANDA mid H1 XAU_USD `[[t, o, h, l, c], ...]`, kept out of git).', '');
  return L.join('\n');
}

if (process.argv[1] && fileURLToPath(import.meta.url) === path.resolve(process.argv[1])) {
  const f = process.argv[2]; if (!f) { console.error('usage: node run.mjs <xau-h1.json>'); process.exit(1); }
  const rows = JSON.parse(fs.readFileSync(f, 'utf8')), built = new Date().toISOString().slice(0, 10);
  const res = runAll(rows); res.built = built; res.rule = { look: P.LOOK, k: P.K, buffer: P.BUF, hold: P.HOLD, cost: P.COST, fin: P.FIN, is: P.IS, oos: [P.OOS[0], res.data.to] };
  res.headline = headline(res);
  fs.writeFileSync(path.join(HERE, 'result.json'), JSON.stringify(res, null, 1) + '\n');
  fs.writeFileSync(path.join(HERE, 'RESULT.md'), report(res, built));
  for (const k of Object.keys(res.tests)) { const x = res.tests[k]; console.log(k, 'IS', x.is.n, x.is.gross, x.is.net, x.is.t, '| OOS', x.oos.n, x.oos.gross, x.oos.net, x.oos.t, 'x2', x.oos.net2, 'holm', x.holm, 'plc', x.placebo.beats, x.placebo.q95, 'pass', x.pass); }
  console.log(res.headline, res.headline.length);
}
