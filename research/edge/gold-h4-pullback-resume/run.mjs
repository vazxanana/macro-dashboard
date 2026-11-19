// Gold: buy (sell) the end of a pullback inside an H4 closing-breakout trend (PREREGISTRATION.md, pushed first).
//   node research/edge/gold-h4-pullback-resume/run.mjs full <xau-h1.json> <xau-5m.json.gz>   the study -> result.json
// Candles are kept out of git: OANDA mid H1 rows [t,o,h,l,c] (an earlier study's proxy copy) and OANDA mid M5 rows (gzip).
// A stand-alone rule: never a gate, exit, entry or size of the live gold book. Pure pieces are exported for the test.
import fs from 'node:fs';
import zlib from 'node:zlib';
import { nights, FIN } from '../../../council/fills.mjs';
import { nyOffsetH } from '../../../council/histdata.mjs';

export const H = 3600, H4 = 4 * H, M5 = 300;
export const SPREAD = 0.30, SLIP = SPREAD / 2, RT = SPREAD + 2 * SLIP;   // $0.60 a round trip
export const N = 20, RECENT = 30, FIB = 0.382, LOOK = 5, BUF = 0.30, MIN_RR = 1.5, FIX_R = 2, HOLD = 48;
export const WIN = { is: ['2007-01-01', '2016-12-31'], oos: ['2017-01-01', '2026-10-31'] };
export const SEED = 20261114, SEEDS = 40;

// H4 block start (UTC) for an H1 candle opening at t: blocks start at 17, 21, 01, 05, 09, 13 New York time
export function h4Start(t) {
  const off = nyOffsetH(t) * H, local = t - off;
  return Math.floor((local - H) / H4) * H4 + H + off;
}
// H4 candles from H1 rows: { time, end, open, high, low, close, k0, k1 } (k0..k1 = the H1 rows inside)
export function toH4(h1) {
  const out = []; let cur = null;
  h1.forEach(([t, o, h, l, c], k) => {
    const s = h4Start(t);
    if (!cur || cur.time !== s) { cur = { time: s, end: s + H4, open: o, high: h, low: l, close: c, k0: k, k1: k }; out.push(cur); }
    else { cur.high = Math.max(cur.high, h); cur.low = Math.min(cur.low, l); cur.close = c; cur.k1 = k; }
  });
  return out;
}

// H4 closing breakout at candle j: +1 close above the highest close of the 20 before, -1 below the lowest, 0 none
export function breakout(c, j) {
  if (j < N) return 0; let hi = -Infinity, lo = Infinity;
  for (let k = j - N; k < j; k++) { hi = Math.max(hi, c[k].close); lo = Math.min(lo, c[k].close); }
  return c[j].close > hi ? 1 : c[j].close < lo ? -1 : 0;
}

// Every setup's first trigger (steps 1-6), in time order. Reads only candles closed by each H1 close.
export function triggers(h1, c) {
  const out = []; let s = null, j = 0;
  for (let k = 0; k < h1.length; k++) {
    const T = h1[k][0] + H;   // H1 candle k closes at T
    // close every H4 candle ended by T: expiry, then a new breakout replaces the setup
    for (; j < c.length && c[j].end <= T; j++) {
      if (s && j - s.j >= RECENT) s = null;   // the break is no longer among the last 30 closed H4 candles
      const b = breakout(c, j);
      if (b) {
        let L = b > 0 ? Infinity : -Infinity;
        for (let q = j - N; q < j; q++) L = b > 0 ? Math.min(L, c[q].low) : Math.max(L, c[q].high);
        s = { side: b, j, breakT: c[j].time, breakEnd: c[j].end, L, X: b > 0 ? c[j].high : c[j].low, P: null, p: null, on: false, done: false };
      }
    }
    if (!s || s.done || h1[k][0] < s.breakEnd) continue;
    const [, , hi, lo, cl] = h1[k], d = s.side;
    if (d > 0 ? cl < s.L : cl > s.L) { s.done = true; continue; }   // closed beyond the leg's start: setup over
    if (d > 0 ? hi > s.X : lo < s.X) { s.X = d > 0 ? hi : lo; s.P = null; s.p = null; s.on = false; continue; }   // new extreme
    const ex = d > 0 ? lo : hi;
    if (s.P == null || (d > 0 ? ex < s.P : ex > s.P)) { s.P = ex; s.p = k; }
    if (d * (s.X - s.P) >= FIB * d * (s.X - s.L)) s.on = true;
    if (!s.on || k <= s.p) continue;
    let ref = d > 0 ? -Infinity : Infinity;
    for (let q = Math.max(s.p, k - LOOK); q < k; q++) ref = d > 0 ? Math.max(ref, h1[q][2]) : Math.min(ref, h1[q][3]);
    if (d > 0 ? cl > ref : cl < ref) {
      s.done = true;
      out.push({ k, t: T, side: d, X: s.X, L: s.L, P: s.P, p: s.p, ref, breakT: s.breakT });
    }
  }
  return out;
}

// M5 lookup: hour start -> [first, last+1] index in the M5 rows (rows sorted by time)
export function m5Index(m5) {
  const idx = new Map();
  for (let i = 0; i < m5.length; i++) { const hs = Math.floor(m5[i][0] / H) * H, e = idx.get(hs); if (e) e[1] = i + 1; else idx.set(hs, [i, i + 1]); }
  return idx;
}

// one trade: entry at H1 candle e's open, managed to the close of candle e+HOLD-1 (M5 inside an hour when present)
export function simulate(h1, m5, idx, e, side, stop, target, k = 1) {
  const last = e + HOLD - 1; if (last >= h1.length) return null;
  const entry = h1[e][1]; if (side > 0 ? entry <= stop : entry >= stop) return null;
  const risk = Math.abs(entry - stop);
  let exit = null, how = null, exitT = null;
  for (let q = e; q <= last && exit == null; q++) {
    const hs = h1[q][0], r = idx && idx.get(hs), bars = r ? m5.slice(r[0], r[1]) : [h1[q]], len = r ? M5 : H;
    for (const [t, o, hi, lo] of bars) {
      if (side > 0 ? lo <= stop : hi >= stop) { exit = side > 0 ? Math.min(o, stop) : Math.max(o, stop); how = 'stop'; exitT = t + len; break; }
      if (target != null && (side > 0 ? hi >= target : lo <= target)) { exit = side > 0 ? Math.max(o, target) : Math.min(o, target); how = 'target'; exitT = t + len; break; }
    }
    if (exit == null && q === last) { exit = h1[q][4]; how = 'time'; exitT = hs + H; }
  }
  const entryT = h1[e][0], gross = side * (exit - entry) / risk, nn = side > 0 ? nights(entryT, exitT) : 0;
  const cost = RT / risk, fin = side > 0 ? nn * FIN.xau.long * entry / risk : 0;
  return { e, side, entryT, exitT, entry, stop, target, risk, exit, how, nights: nn, gross, cost, fin,
    net: gross - k * (cost + fin), net2: gross - 2 * (cost + fin) };
}

export const TESTS = {
  T1: { name: 'T1 both sides, target the leg extreme (>= 1.5R away)', sides: [1, -1], tgt: 'leg' },
  T2: { name: 'T2 both sides, target 2R fixed', sides: [1, -1], tgt: 'fixed' },
  T3: { name: 'T3 buys only, target the leg extreme (>= 1.5R away)', sides: [1], tgt: 'leg' },
};
// levels for a trigger and an entry price: { stop, target } or null (skipped)
export function levels(tr, entry, tgt) {
  const d = tr.side, stop = tr.P - d * BUF, risk = d * (entry - stop);
  if (!(risk > 0)) return null;
  if (tgt === 'fixed') return { stop, target: entry + d * FIX_R * risk };
  if (d * (tr.X - entry) < MIN_RR * risk) return null;
  return { stop, target: tr.X };
}
export function runTest(h1, m5, idx, trig, test) {
  const out = []; let free = -Infinity;
  for (const tr of trig) {
    if (!test.sides.includes(tr.side)) continue;
    const e = tr.k + 1; if (e >= h1.length || h1[e][0] < free) continue;   // a position is open: the signal is skipped
    const lv = levels(tr, h1[e][1], test.tgt); if (!lv) continue;
    const x = simulate(h1, m5, idx, e, tr.side, lv.stop, lv.target); if (!x) continue;
    x.trig = tr; out.push(x); free = x.exitT;
  }
  return out;
}

export const ymd = (t) => new Date(t * 1000).toISOString().slice(0, 10);
export const inWin = (T, [f, t]) => T.filter((x) => { const s = ymd(x.entryT); return s >= f && s <= t; });
export function monthT(T, [f, t], key = 'net') {
  const sums = new Map();
  for (let y = +f.slice(0, 4), m = +f.slice(5, 7); `${y}-${String(m).padStart(2, '0')}` <= t.slice(0, 7); m === 12 ? (y++, m = 1) : m++) sums.set(`${y}-${String(m).padStart(2, '0')}`, 0);
  for (const x of T) { const k = ymd(x.exitT).slice(0, 7); if (sums.has(k)) sums.set(k, sums.get(k) + x[key]); }
  const v = [...sums.values()], n = v.length, m = v.reduce((a, b) => a + b, 0) / n, sd = Math.sqrt(v.reduce((a, b) => a + (b - m) ** 2, 0) / (n - 1));
  return { months: n, t: sd ? m / (sd / Math.sqrt(n)) : 0 };
}
export const phi = (z) => 0.5 * (1 + erf(z / Math.SQRT2));
function erf(x) { const s = Math.sign(x); x = Math.abs(x); const t = 1 / (1 + 0.3275911 * x);
  return s * (1 - (((((1.061405429 * t - 1.453152027) * t) + 1.421413741) * t - 0.284496736) * t + 0.254829592) * t * Math.exp(-x * x)); }
export function holm(ps) { const o = ps.map((p, k) => [p, k]).sort((a, b) => a[0] - b[0]), adj = new Array(ps.length); let run = 0;
  o.forEach(([p, k], r) => { run = Math.max(run, Math.min(1, (ps.length - r) * p)); adj[k] = run; }); return adj; }
export function rng(seed) { let s = seed >>> 0; return () => { s = (s + 0x6D2B79F5) >>> 0; let t = s; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; }
const r3 = (v) => (v == null || !Number.isFinite(v) ? null : +v.toFixed(3)), r2 = (v) => (v == null || !Number.isFinite(v) ? null : +v.toFixed(2));
const median = (a) => { if (!a.length) return null; const s = [...a].sort((x, y) => x - y), m = s.length >> 1; return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2; };
export function summary(T, w) {
  const n = T.length, mean = (k) => (n ? T.reduce((a, x) => a + x[k], 0) / n : null), mt = monthT(T, w), mg = monthT(T, w, 'gross'), m2 = monthT(T, w, 'net2');
  let eq = 0, pk = 0, dd = 0; for (const x of T) { eq += x.net; pk = Math.max(pk, eq); dd = Math.min(dd, eq - pk); }
  return { n, gross: r3(mean('gross')), net: r3(mean('net')), net2x: r3(mean('net2')), cost: r3(mean('cost')), fin: r3(mean('fin')),
    total: r2(T.reduce((a, x) => a + x.net, 0)), win: n ? r2(T.filter((x) => x.net > 0).length / n * 100) : null,
    stops: T.filter((x) => x.how === 'stop').length, targets: T.filter((x) => x.how === 'target').length, times: T.filter((x) => x.how === 'time').length,
    longs: T.filter((x) => x.side > 0).length, medianStop: r2(median(T.map((x) => x.risk))),
    months: mt.months, t: r2(mt.t), tGross: r2(mg.t), t2x: r2(m2.t), dd: r2(dd) };
}
// placebo: each real OOS trade -> an entry at a random H1 candle's open on the same UTC day, same side, same $ stop and target distance
export function placebo(h1, m5, idx, real, test, seeds = SEEDS) {
  const byDay = new Map(); h1.forEach((r, q) => { const d = ymd(r[0]); if (!byDay.has(d)) byDay.set(d, []); byDay.get(d).push(q); });
  const means = [];
  for (let s = 1; s <= seeds; s++) {
    const r = rng(SEED + s), T = [];
    for (const x of real) {
      const P = byDay.get(ymd(x.entryT)); if (!P) continue; let tr = null;
      for (let a = 0; a < 20 && !tr; a++) {
        const e = P[Math.floor(r() * P.length)], en = h1[e][1];
        const tg = test.tgt === 'fixed' ? en + x.side * FIX_R * x.risk : en + x.side * Math.abs(x.target - x.entry);
        tr = simulate(h1, m5, idx, e, x.side, en - x.side * x.risk, tg);
      }
      if (tr) T.push(tr.net);
    }
    means.push(T.length ? T.reduce((a, b) => a + b, 0) / T.length : 0);
  }
  return means;
}

function full(h1File, m5File) {
  const h1 = JSON.parse(fs.readFileSync(h1File, 'utf8'));
  const m5 = JSON.parse(zlib.gunzipSync(fs.readFileSync(m5File)));
  const idx = m5Index(m5), c = toH4(h1), trig = triggers(h1, c);
  const out = { built: '2026-11-14',
    data: { src: 'OANDA mid H1 XAU_USD (site proxy copy), H4 built on 17:00 New York blocks (DST correct); OANDA mid M5 for fills inside each hour',
      from: ymd(h1[0][0]), to: ymd(h1.at(-1)[0]), h1: h1.length, h4: c.length, m5: m5.length, m5From: ymd(m5[0][0]),
      hoursWithM5: idx.size, triggers: trig.length, triggersLong: trig.filter((x) => x.side > 0).length },
    costs: { spread: SPREAD, slippagePerOrder: SLIP, roundTrip: RT, financing: { rate: FIN.xau.long, src: FIN.xau.src, side: 'buys only' } },
    rule: { N, recent: RECENT, fib: FIB, look: LOOK, buffer: BUF, minRR: MIN_RR, fixedR: FIX_R, holdH1: HOLD }, windows: WIN, seed: SEED, tests: {} };
  const ps = [];
  for (const [key, test] of Object.entries(TESTS)) {
    const all = runTest(h1, m5, idx, trig, test), oos = inWin(all, WIN.oos), is = inWin(all, WIN.is);
    const so = summary(oos, WIN.oos), si = summary(is, WIN.is), pl = placebo(h1, m5, idx, oos, test), sorted = [...pl].sort((a, b) => a - b);
    const beaten = pl.filter((m) => so.net > m).length, p = 1 - phi(so.t || 0); ps.push(p);
    const years = {}; for (const x of all) { const s = ymd(x.entryT), y = s.slice(0, 4); if (s < WIN.is[0] || s > WIN.oos[1]) continue; (years[y] ||= []).push(x); }
    const side = (T, sd, w) => summary(T.filter((x) => x.side === sd), w);
    out.tests[key] = { name: test.name, oos: so, is: si, p: +p.toFixed(4),
      bySide: { oosLong: side(oos, 1, WIN.oos), oosShort: side(oos, -1, WIN.oos), isLong: side(is, 1, WIN.is), isShort: side(is, -1, WIN.is) },
      placebo: { beaten, of: pl.length, p5: r3(sorted[1]), median: r3(sorted[19]), p95: r3(sorted[37]), mean: r3(pl.reduce((a, b) => a + b, 0) / pl.length) },
      years: Object.fromEntries(Object.entries(years).map(([y, T]) => [y, { n: T.length, gross: r3(T.reduce((a, x) => a + x.gross, 0) / T.length), net: r3(T.reduce((a, x) => a + x.net, 0) / T.length) }])) };
  }
  holm(ps).forEach((h, j) => { const x = Object.values(out.tests)[j]; x.holm = +h.toFixed(4);
    x.checks = { oosNet: x.oos.net > 0, oosT: x.oos.t >= 2 && x.holm < 0.05, is: x.is.net > 0, cost2x: x.oos.net2x > 0, placebo: x.placebo.beaten >= 38, n: x.oos.n >= 100 };
    x.pass = Object.values(x.checks).every(Boolean); });
  out.verdict = out.tests.T1.pass ? 'PASS' : 'FAIL';
  out.passAlone = ['T2', 'T3'].filter((k) => out.tests[k].pass);
  fs.writeFileSync(new URL('./result.json', import.meta.url), JSON.stringify(out, null, 1) + '\n');
  console.log(JSON.stringify(out.data));
  for (const [k, x] of Object.entries(out.tests)) console.log(k, JSON.stringify({ oos: x.oos, is: x.is, holm: x.holm, placebo: x.placebo, checks: x.checks, bySide: x.bySide }));
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const [cmd, a, b] = process.argv.slice(2);
  if (cmd !== 'full' || !a || !b) throw new Error('usage: run.mjs full <xau-h1.json> <xau-5m.json.gz>');
  full(a, b);
}
