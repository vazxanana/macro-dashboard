// gold-ote-retrace: a limit at the 0.705 retracement of an H1 leg that broke structure, on OANDA mid gold M5 2016 to now.
// Pre-registration: research/edge/gold-ote-retrace/PREREGISTRATION.md (pushed before any trade was computed).
//   node --use-env-proxy research/edge/gold-ote-retrace/run.mjs fetch <file.json.gz>   OANDA mid M5 XAU/USD from 2015-12-01
//   node research/edge/gold-ote-retrace/run.mjs full <file.json.gz>                    the study; writes result.json
// The cache is [[t, o, h, l, c, v], ...] (unix seconds, M5), gzip JSON, kept outside git. Research only: nothing live reads this.
import fs from 'node:fs';
import zlib from 'node:zlib';
import { FIN, nights, foldWeekend } from '../../../council/fills.mjs';

export const PIV = 3, ATR_N = 14, MIN_LEG = 1.5, FIB = 0.705, EXT = 0.27, BUF = 0.30, VALID = 24, HOLD = 72, COST = 0.60, SMA_N = 50;
export const START = Date.UTC(2016, 0, 1) / 1000, OOS = Date.UTC(2021, 0, 1) / 1000;
const H = 3600, D = 86400;

// H1 candles from M5 rows: { time, open, high, low, close, a, b } with a..b-1 the M5 indices of the hour
export function h1From(m5) {
  const out = []; let cur = null;
  for (let k = 0; k < m5.length; k++) {
    const [t, o, h, l, c] = m5[k], hr = Math.floor(t / H) * H;
    if (!cur || cur.time !== hr) { cur = { time: hr, open: o, high: h, low: l, close: c, a: k, b: k + 1 }; out.push(cur); }
    else { cur.high = Math.max(cur.high, h); cur.low = Math.min(cur.low, l); cur.close = c; cur.b = k + 1; }
  }
  return out;
}
// D1 candles (UTC days, the weekend folded into Monday)
export function d1From(m5) {
  const out = []; let cur = null;
  for (const [t, o, h, l, c] of m5) {
    const d = Math.floor(t / D) * D;
    if (!cur || cur.time !== d) { cur = { time: d, open: o, high: h, low: l, close: c }; out.push(cur); }
    else { cur.high = Math.max(cur.high, h); cur.low = Math.min(cur.low, l); cur.close = c; }
  }
  return foldWeekend(out);
}
// Wilder ATR through each candle (null until N candles exist)
export function atr(bars, n = ATR_N) {
  const out = new Array(bars.length).fill(null); let a = null, s = 0;
  for (let i = 0; i < bars.length; i++) {
    const b = bars[i], tr = i ? Math.max(b.high - b.low, Math.abs(b.high - bars[i - 1].close), Math.abs(b.low - bars[i - 1].close)) : b.high - b.low;
    if (i < n) { s += tr; if (i === n - 1) a = s / n; } else a = (a * (n - 1) + tr) / n;
    out[i] = a;
  }
  return out;
}
// the day key of a time (a weekend time belongs to the following Monday, as foldWeekend does)
const dayKey = (t) => { let d = Math.floor(t / D) * D; const w = new Date(d * 1000).getUTCDay(); if (w === 6) d += 2 * D; else if (w === 0) d += D; return d; };
// 1 when the last completed D1 close before time t is above its SMA_N average, -1 below, null without SMA_N completed days
export function trendAt(d1, t) {
  const key = dayKey(t); let lo = 0, hi = d1.length; // first index with time >= key
  while (lo < hi) { const m = (lo + hi) >> 1; if (d1[m].time < key) lo = m + 1; else hi = m; }
  const last = lo - 1; if (last < SMA_N - 1) return null;
  let s = 0; for (let i = last - SMA_N + 1; i <= last; i++) s += d1[i].close;
  const c = d1[last].close, m = s / SMA_N; return c > m ? 1 : c < m ? -1 : 0;
}
// Impulses: candle j closes beyond the most recent unbroken confirmed 3-a-side swing (confirmed by candle j-1 at the latest),
// leg from the lowest low (highest high) after that swing to candle j's extreme, at least MIN_LEG x ATR(14). Only what is known at
// candle j's close is read.
export function impulses(h1, A = atr(h1)) {
  const out = [], hiS = [], loS = [];
  for (let j = 0; j < h1.length; j++) {
    const i = j - PIV - 1; // the pivot that candle j-1 confirms
    if (i >= PIV) {
      let isH = true, isL = true;
      for (let k = i - PIV; k <= i + PIV; k++) { if (k === i) continue; if (!(h1[i].high > h1[k].high)) isH = false; if (!(h1[i].low < h1[k].low)) isL = false; }
      if (isH) hiS.push({ i, level: h1[i].high }); if (isL) loS.push({ i, level: h1[i].low });
    }
    const b = h1[j];
    for (const [side, st] of [[1, hiS], [-1, loS]]) {
      if (!st.length) continue;
      const ref = st[st.length - 1];
      if (!(side > 0 ? b.close > ref.level : b.close < ref.level)) continue;
      let origin = side > 0 ? Infinity : -Infinity;
      for (let k = ref.i + 1; k <= j; k++) origin = side > 0 ? Math.min(origin, h1[k].low) : Math.max(origin, h1[k].high);
      const ext = side > 0 ? b.high : b.low, leg = Math.abs(ext - origin);
      // every swing this close broke is used up
      for (let k = st.length - 1; k >= 0; k--) if (side > 0 ? b.close > st[k].level : b.close < st[k].level) st.splice(k, 1);
      if (A[j] == null || leg < MIN_LEG * A[j]) continue;
      const entry = ext - side * FIB * leg, stop = origin - side * BUF;
      out.push({ j, time: b.time, side, origin, ext, leg, entry, stop, t1: ext, t2: ext + side * EXT * leg });
    }
  }
  return out;
}
// manage an open position from M5 index k0 (the fill candle: stop only), to the close of M5 index kEnd. Stop first on a tie.
export function manage(m5, k0, kEnd, side, stop, target) {
  { const [, o, h, l] = m5[k0]; if (side > 0 ? l <= stop : h >= stop) return { k: k0, px: side > 0 ? Math.min(o, stop) : Math.max(o, stop), how: 'stop' }; }
  for (let k = k0 + 1; k <= kEnd; k++) {
    const [, o, h, l] = m5[k];
    if (side > 0 ? o <= stop : o >= stop) return { k, px: o, how: 'stop' };
    if (side > 0 ? l <= stop : h >= stop) return { k, px: stop, how: 'stop' };
    if (side > 0 ? h >= target : l <= target) return { k, px: target, how: 'target' };
  }
  return { k: kEnd, px: m5[kEnd][4], how: 'time' };
}
// costs of one trade in R: spread + financing on buys
export function costR(tr, mult = 1) {
  const risk = Math.abs(tr.entry - tr.stop), fin = tr.side > 0 ? nights(tr.fillT, tr.exitT) * FIN.xau.long * tr.entry / risk : 0;
  return mult * (COST / risk + fin);
}
const finish = (m5, h1, fillK, side, entry, stop, target, base) => {
  const f = h1.idx[fillK], last = f + HOLD - 1;
  if (last >= h1.length) return null; // the hold runs past the data
  const ex = manage(m5, fillK, h1[last].b - 1, side, stop, target);
  const R = side * (ex.px - entry) / Math.abs(entry - stop);
  const tr = { ...base, side, entry, stop, target, fillK, fillT: m5[fillK][0], exitT: m5[ex.k][0] + 300, exitPx: ex.px, how: ex.how, R };
  tr.net = R - costR(tr); tr.net2 = R - costR(tr, 2); return tr;
};
// one signal as an order: { status: 'filled' | 'cancelled' | 'expired' | 'dataEnd', trade, endK }
export function order(m5, h1, sg, target) {
  const from = sg.j + 1, to = Math.min(sg.j + VALID, h1.length - 1);
  if (from >= h1.length) return { status: 'dataEnd', endK: m5.length };
  for (let k = h1[from].a; k < h1[to].b; k++) {
    const [, o, h, l] = m5[k], s = sg.side;
    if (s > 0 ? o <= sg.stop : o >= sg.stop) return { status: 'cancelled', endK: k };
    if (s > 0 ? l <= sg.entry : h >= sg.entry) {
      const px = s > 0 ? Math.min(sg.entry, o) : Math.max(sg.entry, o);
      const trade = finish(m5, h1, k, s, px, sg.stop, target, { sigT: sg.time, leg: sg.leg });
      if (!trade) return { status: 'dataEnd', endK: m5.length };
      return { status: 'filled', trade, endK: null };
    }
  }
  return { status: to < sg.j + VALID ? 'dataEnd' : 'expired', endK: h1[to].b };
}
// a test as one stream, one order or position at a time
export function stream(m5, h1, sigs, test, d1) {
  const T = [], cnt = { signals: 0, filtered: 0, busy: 0, cancelled: 0, expired: 0, filled: 0, dataEnd: 0 }; let free = -Infinity;
  for (const sg of sigs) {
    if (sg.time < START) continue;
    cnt.signals++;
    if (test === 'T3') { const tr = trendAt(d1, sg.time); if (tr !== sg.side) { cnt.filtered++; continue; } }
    const placed = sg.time + H; // the close of candle j
    if (placed < free) { cnt.busy++; continue; }
    const r = order(m5, h1, sg, test === 'T2' ? sg.t2 : sg.t1);
    cnt[r.status]++;
    if (r.status === 'filled') { T.push(r.trade); free = r.trade.exitT; }
    else free = r.endK < m5.length ? m5[r.endK][0] + (r.status === 'expired' ? 0 : 300) : Infinity;
  }
  return { T, cnt };
}
// placebo: the same fills (time, entry, stop and target distances), a random side, managed and costed the same way
export function mulberry(seed) { let a = seed >>> 0; return () => { a = (a + 0x6D2B79F5) >>> 0; let t = a; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; }
export function placebo(m5, h1, T, seed) {
  const rnd = mulberry(seed), out = [];
  for (const x of T) {
    const side = rnd() < 0.5 ? 1 : -1;
    if (side === x.side) { out.push(x); continue; }
    const tr = finish(m5, h1, x.fillK, side, x.entry, 2 * x.entry - x.stop, 2 * x.entry - x.target, { sigT: x.sigT, leg: x.leg });
    if (tr) out.push(tr);
  }
  return out;
}
// statistics
const ym = (t) => { const d = new Date(t * 1000); return d.getUTCFullYear() * 12 + d.getUTCMonth(); };
export function monthT(T, from, to, key = 'net') { // calendar months of [from, to), zeros included
  const a = ym(from), b = ym(to - 1), s = new Array(b - a + 1).fill(0);
  for (const x of T) if (x.fillT >= from && x.fillT < to) s[ym(x.fillT) - a] += x[key];
  const m = s.length, mu = s.reduce((p, v) => p + v, 0) / m, sd = Math.sqrt(s.reduce((p, v) => p + (v - mu) ** 2, 0) / (m - 1));
  return { months: m, t: sd > 0 ? mu / (sd / Math.sqrt(m)) : 0 };
}
export const pOne = (t) => 0.5 * erfc(t / Math.SQRT2);
function erfc(x) { const z = Math.abs(x), t = 1 / (1 + 0.5 * z); const r = t * Math.exp(-z * z - 1.26551223 + t * (1.00002368 + t * (0.37409196 + t * (0.09678418 + t * (-0.18628806 + t * (0.27886807 + t * (-1.13520398 + t * (1.48851587 + t * (-0.82215223 + t * 0.17087277))))))))); return x >= 0 ? r : 2 - r; }
export function holm(ps) { const o = ps.map((p, i) => [p, i]).sort((a, b) => a[0] - b[0]), out = new Array(ps.length); let run = 0;
  o.forEach(([p, i], r) => { run = Math.max(run, Math.min(1, p * (ps.length - r))); out[i] = run; }); return out; }
export function summary(T, key = 'net') {
  const n = T.length; if (!n) return { n: 0, avg: 0, total: 0, wr: 0, pf: null, dd: 0 };
  let tot = 0, peak = 0, dd = 0, win = 0, gp = 0, gl = 0;
  for (const x of [...T].sort((a, b) => a.exitT - b.exitT)) { const v = x[key]; tot += v; peak = Math.max(peak, tot); dd = Math.min(dd, tot - peak); if (v > 0) { win++; gp += v; } else gl -= v; }
  return { n, avg: +(tot / n).toFixed(3), total: +tot.toFixed(1), wr: +(100 * win / n).toFixed(1), pf: gl ? +(gp / gl).toFixed(2) : null, dd: +dd.toFixed(1) };
}
export const P_T2 = 0.02275; // one-sided p of t = 2

export function analyse(m5) {
  const h1 = h1From(m5); h1.idx = new Int32Array(m5.length); h1.forEach((b, i) => { for (let k = b.a; k < b.b; k++) h1.idx[k] = i; });
  const d1 = d1From(m5), sigs = impulses(h1), end = m5[m5.length - 1][0] + 300;
  const res = { built: '2026-11-14', data: { from: new Date(m5[0][0] * 1000).toISOString().slice(0, 10), to: new Date(m5.at(-1)[0] * 1000).toISOString().slice(0, 10), m5: m5.length, h1: h1.length, d1: d1.length, src: 'OANDA mid M5 XAU/USD via the site proxy' },
    rule: { PIV, ATR_N, MIN_LEG, FIB, EXT, BUF, VALID, HOLD, COST, SMA_N, fin: FIN.xau.long }, impulses: sigs.filter((s) => s.time >= START).length, tests: {} };
  const W = { is: [START, OOS], oos: [OOS, end] }, win = (T, [f, t]) => T.filter((x) => x.fillT >= f && x.fillT < t);
  for (const test of ['T1', 'T2', 'T3']) {
    const { T, cnt } = stream(m5, h1, sigs, test, d1), r = { counts: cnt };
    for (const [w, rng] of Object.entries(W)) {
      const X = win(T, rng);
      r[w] = { net: summary(X), gross: summary(X, 'R'), net2: summary(X, 'net2'), tNet: +monthT(T, ...rng).t.toFixed(2), tGross: +monthT(T, ...rng, 'R').t.toFixed(2), months: monthT(T, ...rng).months,
        long: summary(X.filter((x) => x.side > 0)), short: summary(X.filter((x) => x.side < 0)), exits: { stop: X.filter((x) => x.how === 'stop').length, target: X.filter((x) => x.how === 'target').length, time: X.filter((x) => x.how === 'time').length } };
    }
    const years = {}; for (const x of T) { const y = new Date(x.fillT * 1000).getUTCFullYear(); (years[y] ||= []).push(x); }
    r.years = Object.fromEntries(Object.entries(years).map(([y, X]) => [y, { n: X.length, net: +X.reduce((p, x) => p + x.net, 0).toFixed(1), gross: +X.reduce((p, x) => p + x.R, 0).toFixed(1) }]));
    const pl = []; for (let s = 1; s <= 40; s++) pl.push(summary(win(placebo(m5, h1, T, s), W.oos)).avg);
    r.placebo = { draws: pl, beaten: pl.filter((v) => r.oos.net.avg > v).length, median: +[...pl].sort((a, b) => a - b)[20].toFixed(3) };
    r.medianRisk = +[...T].map((x) => Math.abs(x.entry - x.stop)).sort((a, b) => a - b)[T.length >> 1].toFixed(2);
    r.p = pOne(r.oos.tNet); res.tests[test] = r;
  }
  const ks = ['T1', 'T2', 'T3'], adj = holm(ks.map((k) => res.tests[k].p));
  ks.forEach((k, i) => { const r = res.tests[k]; r.pHolm = +adj[i].toFixed(4); r.p = +r.p.toFixed(4);
    r.checks = { oosPos: r.oos.net.avg > 0, holmT2: adj[i] <= P_T2, isPos: r.is.net.avg > 0, cost2: r.oos.net2.avg > 0, placebo: r.placebo.beaten >= 38, n30: r.oos.net.n >= 30 };
    r.pass = Object.values(r.checks).every(Boolean); });
  res.verdict = ks.some((k) => res.tests[k].pass) ? 'PASS' : 'FAIL';
  return res;
}

async function fetchAll(file) {
  let from = Date.UTC(2015, 11, 1) / 1000; const now = Math.floor(Date.now() / 1000), all = [];
  while (from < now) { const to = Math.min(now, from + 4990 * 300);
    const r = await fetch(`https://meridianx.dev/md/bars?sym=xau&tf=5m&from=${from}&to=${to}`); const j = await r.json();
    if (!r.ok) throw new Error(`proxy ${r.status} ${j.error || ''}`);
    for (const b of j.bars || []) if (!b.live) all.push([b.time, b.open, b.high, b.low, b.close, b.volume || 0]);
    from = to; await new Promise((s) => setTimeout(s, 2200)); }
  const seen = new Set(), rows = all.filter((x) => !seen.has(x[0]) && seen.add(x[0])).sort((a, b) => a[0] - b[0]);
  fs.writeFileSync(file, zlib.gzipSync(JSON.stringify(rows)));
}

if (process.argv[1] && import.meta.url === new URL(`file://${process.argv[1]}`).href) {
  const [cmd, file] = process.argv.slice(2);
  if (cmd === 'fetch') await fetchAll(file);
  else if (cmd === 'full') {
    const m5 = JSON.parse(zlib.gunzipSync(fs.readFileSync(file))).filter((r) => r[0] < Date.UTC(2026, 10, 14) / 1000);
    const res = analyse(m5);
    fs.writeFileSync(new URL('./result.json', import.meta.url), JSON.stringify(res, null, 1) + '\n');
    for (const [k, r] of Object.entries(res.tests)) console.log(k, JSON.stringify({ c: r.counts, is: [r.is.net, r.is.gross.avg, r.is.tNet], oos: [r.oos.net, r.oos.gross.avg, r.oos.tNet, r.oos.tGross], n2: r.oos.net2.avg, pl: r.placebo.beaten, pH: r.pHolm, pass: r.pass }));
    console.log(res.verdict);
  } else console.log('usage: run.mjs fetch|full <file.json.gz>');
}
