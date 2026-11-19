// Edge research · ecb-ref-fix: fade the 13:45-14:14 CET move into the ECB's 14:10 CET reference-rate concertation, at 14:15 CET,
// on EUR/USD (T1 exit 15:00, T2 exit 14:45) and EUR/GBP + EUR/JPY + EUR/CHF pooled (T3 exit 15:00), OANDA mid M5, stop 1x the
// 20-day median of that window's |move|, after the raw-spread forex costs. Rules: PREREGISTRATION.md. Method copied from the
// wmr-fix-reversal study's run.mjs (branch wmr-fix-reversal) and edited here; nothing is imported across branches.
//   node research/edge/ecb-ref-fix/run.mjs run <candleDir>     (candles from fetch.mjs; writes result.json)
// Pure pieces are exported for tests/ecb-ref-fix.test.mjs.
import fs from 'node:fs';
import path from 'node:path';
import zlib from 'node:zlib';
import { fileURLToPath } from 'node:url';
import { euSummer, usDaylight } from '../../../council/histdata.mjs';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const DAY = 86400, HR = 3600;
const T = (s) => Date.parse(s + 'T00:00:00Z') / 1000;

export const P = {
  REP: [T('2010-01-01'), T('2016-01-01')],        // replication: entries 2010-01-01 .. 2015-12-31
  DEC: [T('2016-01-01'), T('2026-11-14')],        // decisive: entries 2016-01-01 .. 2026-11-13
  FROM: T('2009-11-02'),                          // first Frankfurt date read (warm-up for the 20-day median)
  HOUR: 14,                                       // the move (H-1):45 -> close of H:10, entry H:15 CET
  REF_N: 20, REF_SPAN: 42,                        // 20 earlier days with a move, all within 42 calendar days
  EVENT: 0.5, STOP: 1,                            // |M| > 0.5 x ref; stop 1 x ref
  EXIT_SLACK: 900,                                // the exit candle must open within 15 min of the exit time
  SPREAD_PIPS: 0.3, SLIP_PIPS: 0.3,               // a round trip: spread 0.3 pip + half a spread on each of two market orders
  COMM_RT: 45e-6,                                 // 22.5 USD a million a side, as a fraction of the entry price
  SEEDS: 40, PLACEBO_HOURS: [2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 18, 19, 20, 21],
  BAR: { n: 100, pHolm: 0.05, placeboAbove: 38 },
};
export const PAIRS = [
  { sym: 'eurusd', name: 'EUR/USD', pip: 1e-4 }, { sym: 'eurgbp', name: 'EUR/GBP', pip: 1e-4 },
  { sym: 'eurjpy', name: 'EUR/JPY', pip: 1e-2 }, { sym: 'eurchf', name: 'EUR/CHF', pip: 1e-4 },
];
// exit minutes after the entry (H:15): 45 = H+1:00 (15:00 CET), 30 = H:45 (14:45 CET)
export const TESTS = {
  T1: { name: 'EUR/USD, exit 15:00 CET', pairs: ['eurusd'], exitMin: 45 },
  T2: { name: 'EUR/USD, exit 14:45 CET', pairs: ['eurusd'], exitMin: 30 },
  T3: { name: 'EUR/GBP + EUR/JPY + EUR/CHF pooled, exit 15:00 CET', pairs: ['eurgbp', 'eurjpy', 'eurchf'], exitMin: 45 },
};

export const isoDay = (t) => new Date(t * 1000).toISOString().slice(0, 10);
export const windowOf = (t) => (t >= P.DEC[0] && t < P.DEC[1] ? 'dec' : t >= P.REP[0] && t < P.REP[1] ? 'rep' : null);
// Frankfurt wall clock on a Frankfurt date (day = 00:00 UTC of that date) -> UTC seconds. CET = UTC+1, CEST = UTC+2.
export const cetOff = (day) => (euSummer(day + 12 * HR) ? 2 : 1);
export const cet = (day, h, m = 0) => day + h * HR + m * 60 - cetOff(day) * HR;
export function weekdays(from = P.FROM, to = P.DEC[1]) {
  const out = []; for (let d = from; d < to; d += DAY) { const w = new Date(d * 1000).getUTCDay(); if (w && w < 6) out.push(d); } return out;
}
// the weeks the US is on daylight time and Europe is not (08:30 New York = 13:30 CET then)
export const mismatch = (t) => usDaylight(t) !== euSummer(t);

export function columns(rows) {
  const n = rows.length, t = new Float64Array(n), o = new Float64Array(n), h = new Float64Array(n), l = new Float64Array(n), c = new Float64Array(n), at = new Map();
  for (let i = 0; i < n; i++) { const r = rows[i]; t[i] = r[0]; o[i] = r[1]; h[i] = r[2]; l[i] = r[3]; c[i] = r[4]; at.set(r[0], i); }
  return { n, t, o, h, l, c, at };
}
// the move into H:15 CET: close of the H:10 candle - open of the (H-1):45 candle; null without both
export function moveOf(B, day, H) {
  const i0 = B.at.get(cet(day, H - 1, 45)), i1 = B.at.get(cet(day, H, 10));
  return i0 == null || i1 == null ? null : B.c[i1] - B.o[i0];
}
export function median(a) {
  const s = [...a].sort((x, y) => x - y), n = s.length; if (!n) return null;
  return n % 2 ? s[n >> 1] : (s[n / 2 - 1] + s[n / 2]) / 2;
}
// per day: { day, M, ref } with ref from the 20 earlier days that have a move (all within 42 calendar days), else null
export function moves(B, days, H) {
  const hist = [], out = [];
  for (const d of days) {
    let ref = null;
    if (hist.length >= P.REF_N) { const last = hist.slice(-P.REF_N); if (last[0].day >= d - P.REF_SPAN * DAY) ref = median(last.map((x) => x.a)); }
    const M = moveOf(B, d, H);
    out.push({ day: d, M, ref });
    if (M != null) hist.push({ day: d, a: Math.abs(M) });
  }
  return out;
}
export const tradeCost = (pr, entry, k = 1) => k * ((P.SPREAD_PIPS + P.SLIP_PIPS) * pr.pip + P.COMM_RT * entry);

// one fade: entry at the open of the candle at `start` against M, stop 1 x ref, out at the close of the last candle before `end`
export function simFade(B, pr, M, ref, start, end) {
  if (M == null || !(ref > 0) || !(Math.abs(M) > P.EVENT * ref)) return { skip: 'noevent' };
  const i0 = B.at.get(start);
  if (i0 == null) return { skip: 'nodata' };
  let iz = i0; while (iz + 1 < B.n && B.t[iz + 1] < end) iz++;
  if (B.t[iz] < end - P.EXIT_SLACK || B.t[iz] >= end) return { skip: 'nodata' };
  const side = M > 0 ? -1 : 1, entry = B.o[i0], r0 = P.STOP * ref, stop = entry - side * r0;
  let exit = null, how = 'time';
  for (let i = i0; i <= iz; i++) {
    if (side > 0 ? B.o[i] <= stop : B.o[i] >= stop) { exit = B.o[i]; how = 'gap'; break; }
    if (side > 0 ? B.l[i] <= stop : B.h[i] >= stop) { exit = stop; how = 'stop'; break; }
  }
  if (exit == null) exit = B.c[iz];
  const gross = side * (exit - entry) / r0, cost = tradeCost(pr, entry);
  return { t: start, side, entry, stop, exit, r0, how, gross, costR: cost / r0, net: gross - cost / r0, net2: gross - 2 * cost / r0, sym: pr.sym };
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
  return { n: trades.length, months: monthSums(trades).size, gross: r3(mean(trades.map((x) => x.gross))), costR: r3(mean(trades.map((x) => x.costR))),
    exp: r3(mean(net)), exp2: r3(mean(trades.map((x) => x.net2))), R: r2(cum), grossR: r2(trades.reduce((s, x) => s + x.gross, 0)),
    t: r2(monthT(trades)), tGross: r2(monthT(trades, 'gross')), wr: r3(trades.length ? net.filter((v) => v > 0).length / trades.length : null), maxDD: r2(dd),
    exits: { time: trades.filter((x) => x.how === 'time').length, stop: trades.filter((x) => x.how === 'stop').length, gap: trades.filter((x) => x.how === 'gap').length } };
}
export function rng(seed) { let a = seed >>> 0; return () => { a = (a + 0x6D2B79F5) >>> 0; let t = a; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; }
export const placeboHour = (u) => P.PLACEBO_HOURS[Math.floor(u * P.PLACEBO_HOURS.length)];

// trades of the rule at hour H for one market (every weekday), for an exit `exitMin` minutes after the entry
export function tradesAt(B, pr, mv, H, exitMin) {
  const out = [], fun = { days: 0, nomove: 0, noref: 0, noevent: 0, nodata: 0, trades: 0 };
  for (const x of mv) {
    const start = cet(x.day, H, 15);
    if (!windowOf(start)) continue;
    fun.days++;
    if (x.M == null) { fun.nomove++; continue; }
    if (x.ref == null) { fun.noref++; continue; }
    const r = simFade(B, pr, x.M, x.ref, start, start + exitMin * 60);
    if (r.skip) { fun[r.skip]++; continue; }
    r.day = x.day; out.push(r);
  }
  fun.trades = out.length;
  return { list: out, fun };
}

// ─── the study ───
export function study(candles, ecbDays = []) {
  const days = weekdays(), data = {}, ecb = new Set(ecbDays);
  const syms = [...new Set(Object.values(TESTS).flatMap((x) => x.pairs))];
  for (const s of syms) {
    const pr = PAIRS.find((p) => p.sym === s), B = columns(candles[s]), mv = {};
    for (const h of [P.HOUR, ...P.PLACEBO_HOURS]) mv[h] = moves(B, days, h);
    data[s] = { B, mv, pr };
  }
  const tests = {}, keys = Object.keys(TESTS);
  for (const k of keys) {
    const X = TESTS[k], all = [], funnel = {}, byPair = {};
    for (const s of X.pairs) {
      const D = data[s], r = tradesAt(D.B, D.pr, D.mv[P.HOUR], P.HOUR, X.exitMin);
      funnel[s] = r.fun; all.push(...r.list);
      byPair[D.pr.name] = { dec: stats(r.list.filter((x) => windowOf(x.t) === 'dec')), rep: stats(r.list.filter((x) => windowOf(x.t) === 'rep')) };
    }
    all.sort((a, b) => a.t - b.t);
    const dec = all.filter((x) => windowOf(x.t) === 'dec'), rep = all.filter((x) => windowOf(x.t) === 'rep');
    const years = {}; for (const x of all) { const y = isoDay(x.t).slice(0, 4); (years[y] = years[y] || []).push(x); }
    // placebo: random other CET hour per market per day, the same rule
    const means = [];
    for (let seed = 1; seed <= P.SEEDS; seed++) {
      const got = [];
      X.pairs.forEach((s) => {
        const D = data[s], u = rng(seed * 1000 + PAIRS.findIndex((p) => p.sym === s));
        D.mv[P.HOUR].forEach((_, i) => {
          const h = placeboHour(u()), x = D.mv[h][i], start = cet(x.day, h, 15);
          if (windowOf(start) !== 'dec' || x.M == null || x.ref == null) return;
          const r = simFade(D.B, D.pr, x.M, x.ref, start, start + X.exitMin * 60); if (!r.skip) got.push(r.net);
        });
      });
      means.push(mean(got));
    }
    tests[k] = { name: X.name, pairs: X.pairs, exitMin: X.exitMin, funnel, dec: stats(dec), rep: stats(rep), byPair: X.pairs.length > 1 ? byPair : undefined,
      season: { summer: stats(dec.filter((x) => euSummer(x.t))), winter: stats(dec.filter((x) => !euSummer(x.t))) },
      splits: { noEcbDays: stats(dec.filter((x) => !ecb.has(isoDay(x.day)))), ecbDays: stats(dec.filter((x) => ecb.has(isoDay(x.day)))),
        noMismatchWeeks: stats(dec.filter((x) => !mismatch(x.t))) },
      years: Object.fromEntries(Object.entries(years).map(([y, a]) => [y, { n: a.length, exp: r3(mean(a.map((x) => x.net))), gross: r3(mean(a.map((x) => x.gross))) }])),
      placeboMeans: means };
  }
  const ps = keys.map((k) => normP(tests[k].dec.t)), adj = holm(ps);
  const pct = (a, q) => { const s = [...a].sort((x, y) => x - y); return s[Math.min(s.length - 1, Math.floor(q * (s.length - 1) + 0.5))]; };
  keys.forEach((k, i) => {
    const X = tests[k], pm = X.placeboMeans;
    X.p = r3(ps[i]); X.pHolm = r3(adj[i]);
    X.placebo = { p5: r3(pct(pm, 0.05)), p50: r3(pct(pm, 0.5)), p95: r3(pct(pm, 0.95)), above: pm.filter((m) => m < X.dec.exp).length, of: pm.length, means: pm.map(r3) };
    delete X.placeboMeans;
    X.conditions = { net: X.dec.exp > 0 && X.rep.exp > 0, holm: X.dec.t != null && X.dec.t > 0 && adj[i] < P.BAR.pHolm, n: X.dec.n >= P.BAR.n };
    X.pass = Object.values(X.conditions).every(Boolean);
    X.robust = X.pass && X.dec.exp2 > 0 && X.placebo.above >= P.BAR.placeboAbove;
    X.nearMiss = !X.pass && X.dec.exp > 0 && X.dec.t >= 2;
  });
  const passed = keys.filter((k) => tests[k].pass);
  return { tests, verdict: passed.length ? 'PASS' : 'FAIL', passed };
}

// ─── run ───
const MODE = process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url) ? process.argv[2] : null;
if (MODE === 'run') {
  const DIR = process.argv[3]; if (!DIR) throw new Error('usage: node run.mjs run <candleDir>');
  const candles = {}, info = {};
  for (const pr of PAIRS) {
    candles[pr.sym] = JSON.parse(zlib.gunzipSync(fs.readFileSync(path.join(DIR, `${pr.sym}-5m.json.gz`))));
    const c = candles[pr.sym]; info[pr.sym] = { m5: c.length, from: isoDay(c[0][0]), to: isoDay(c.at(-1)[0]) };
  }
  const ecbDays = JSON.parse(fs.readFileSync(path.join(HERE, 'ecb-days.json'), 'utf8')).ecbDecisionDays;
  const S = study(candles, ecbDays), sg = (x) => (x == null ? 'n/a' : `${x >= 0 ? '+' : ''}${x}`);
  const lab = (s) => ({ exp: s.exp, R: s.R, n: s.n, wr: s.wr, maxDD: s.maxDD, t: s.t });
  const head = Object.keys(TESTS).map((k) => `${k} ${sg(S.tests[k].dec.exp)}R a trade (n ${S.tests[k].dec.n}, t ${S.tests[k].dec.t})`).join('; ');
  const out = { topic: 'ecb-ref-fix', built: '2026-11-14',
    system: 'fade the 13:45-14:14 CET move into the ECB euro reference-rate concertation (about 14:10 CET) when it exceeds 0.5x its 20-day median: enter against it at 14:15 CET, stop 1x that median, out at 15:00 CET (T1, T3) or 14:45 CET (T2); EUR/USD (T1, T2) and EUR/GBP + EUR/JPY + EUR/CHF pooled (T3), OANDA mid M5, raw-spread forex costs',
    window: { rep: '2010-01-01 to 2015-12-31 (replication)', dec: '2016-01-01 to 2026-11-13 (decisive)' }, params: P, pairs: PAIRS, testsDef: TESTS, candles: info,
    unit: 'exp = mean net R a trade after costs (0.3 pip spread + 0.3 pip slippage + 45 USD a million commission a round trip; no financing); 1R = the 20-day median |move| of 13:45-14:14 CET; t = t of calendar-month sums of net R',
    verdict: `${S.verdict}: ${S.verdict === 'PASS' ? `${S.passed.join(', ')} pass the bar${S.passed.every((k) => S.tests[k].robust) ? ' and are robust' : ' (not robust: 2x cost or placebo)'}` : 'no test is positive in both windows with a Holm-adjusted p under 0.05 in 2016-26'}. 2016-26 net: ${head}`,
    tests: S.tests,
    baseline: { is: { exp: S.tests.T1.rep.exp, t: S.tests.T1.rep.t }, oos: { exp: S.tests.T1.dec.exp, t: S.tests.T1.dec.t } },
    candidates: Object.keys(TESTS).map((k) => ({ rule: `${k} ${TESTS[k].name}`, verdict: S.tests[k].pass ? 'PASS' : 'FAIL', is: lab(S.tests[k].rep), oos: lab(S.tests[k].dec), years: S.tests[k].years })) };
  fs.writeFileSync(path.join(HERE, 'result.json'), JSON.stringify(out, null, 1) + '\n');
  for (const k of Object.keys(TESTS)) { const X = S.tests[k]; console.error(k, X.name, JSON.stringify(X.funnel), '\n dec', JSON.stringify(X.dec), '\n rep', JSON.stringify(X.rep), '\n p', X.p, 'holm', X.pHolm, 'placebo', JSON.stringify({ ...X.placebo, means: undefined }), JSON.stringify(X.conditions), 'robust', X.robust, 'nearMiss', X.nearMiss, '\n season', JSON.stringify(X.season), '\n splits', JSON.stringify(X.splits), '\n years', JSON.stringify(X.years)); if (X.byPair) for (const [n, v] of Object.entries(X.byPair)) console.error('  ', n, 'dec', v.dec.exp, v.dec.gross, v.dec.n, v.dec.t, 'rep', v.rep.exp, v.rep.gross, v.rep.n, v.rep.t); }
  console.error(out.verdict);
}
