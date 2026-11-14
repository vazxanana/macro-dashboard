// Do weekly moves in US 2-year yields lead the dollar against low-yielding currencies? (PREREGISTRATION.md, pushed first.)
//   node research/edge/yield-fx-weekly/run.mjs fetch <dir>   copies the four daily files out of origin/council-data (git show, no network)
//   node research/edge/yield-fx-weekly/run.mjs full <dir>    writes result.json next to this file
// A stand-alone research rule (owner decision 44): never a gate, exit, entry or size of the live gold book. Paper only.
import fs from 'node:fs';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { foldWeekend, nights } from '../../../council/fills.mjs';

export const D = 86400;
export const KEYS = ['usb02y', 'usdjpy', 'usdchf', 'eurusd'];
export const P = { look: 5, maxSpanDays: 10, sdWeeks: 52, sdMin: 40, k: 0.5, atrN: 20, atrMult: 2, hold: 5 };
export const SPLIT = Date.UTC(2016, 0, 1) / 1000;
// costs: 0.3 pip spread once, 22.5 USD a million a side, half a spread of slippage on each side
export const COST = { spreadPips: 0.3, comSide: 22.5e-6, slipFrac: 0.5 };
// swaps in pips a lot a night, + credit / - charge (ctrader/symbols.json 2026; USD/JPY assumed, PREREGISTRATION.md)
export const PAIRS = {
  T1: { key: 'usdjpy', name: 'USD/JPY', pip: 0.01, usdSide: 1, swap: { long: 1.0, short: -2.0 }, swapSrc: 'assumed (not in ctrader/symbols.json)' },
  T2: { key: 'usdchf', name: 'USD/CHF', pip: 0.0001, usdSide: 1, swap: { long: 0.437, short: -1.314 }, swapSrc: 'ctrader/symbols.json USDCHF swap' },
  T3: { key: 'eurusd', name: 'EUR/USD', pip: 0.0001, usdSide: -1, swap: { long: -0.621, short: 0.244 }, swapSrc: 'ctrader/symbols.json EURUSD swap' },
};

export const bars = (rows) => foldWeekend(rows.map(([time, open, high, low, close]) => ({ time, open, high, low, close })));
const wd = (t) => new Date(t * 1000).getUTCDay();
const dayKey = (t) => Math.floor(t / D);

// bond signals at each Friday: { t, r, sd, dir: +1 yields up (bond fell) -> buy USD, -1 yields down -> sell USD, 0 flat, sign }
// Only candles at or before the Friday are read; this week's return is not in its own threshold.
export function bondWeeks(B, p = P) {
  const out = [], hist = [];   // hist: [weekIndex, r] of earlier Fridays
  for (let i = p.look; i < B.length; i++) {
    const b = B[i]; if (wd(b.time) !== 5) continue;
    const a = B[i - p.look]; if (b.time - a.time > p.maxSpanDays * D || !(a.close > 0)) continue;
    const r = b.close / a.close - 1, wk = Math.round(b.time / (7 * D));
    const prev = hist.filter(([w]) => w < wk && w >= wk - p.sdWeeks).map((x) => x[1]);
    let sd = null;
    if (prev.length >= p.sdMin) { const m = prev.reduce((s, x) => s + x, 0) / prev.length; sd = Math.sqrt(prev.reduce((s, x) => s + (x - m) ** 2, 0) / (prev.length - 1)); }
    const dir = sd == null ? null : r < -p.k * sd ? 1 : r > p.k * sd ? -1 : 0;
    out.push({ t: b.time, r, sd, dir, sign: r < 0 ? 1 : r > 0 ? -1 : 0 });
    hist.push([wk, r]);
  }
  return out;
}

// ATR(n) simple mean of true range of the n candles ending with index i; null without n candles each with a previous close
export function atrAt(X, i, n = P.atrN) {
  if (i < n) return null; let s = 0;
  for (let k = i - n + 1; k <= i; k++) { const b = X[k], pc = X[k - 1].close; s += Math.max(b.high - b.low, Math.abs(b.high - pc), Math.abs(b.low - pc)); }
  return s / n;
}

export function tradingCost(pair, entry, mult = 1) {
  return mult * (COST.spreadPips * pair.pip + 2 * COST.comSide * entry + 2 * COST.slipFrac * COST.spreadPips * pair.pip);
}
// financing in R: nights x swap x pip / stop distance; level 'base' as quoted, '2x' charges doubled and credits dropped, 'zero' none
export function finR(pair, side, n, dist, level = 'base') {
  if (level === 'zero' || !n) return 0;
  let s = side > 0 ? pair.swap.long : pair.swap.short;
  if (level === '2x') s = s < 0 ? 2 * s : 0;
  return n * s * pair.pip / dist;
}

// one trade: pair candles X, index of the signal Friday i, pair side +1 buy / -1 sell. null = no trade
export function trade(X, i, side, pair, p = P) {
  const atr = atrAt(X, i, p.atrN); if (!(atr > 0)) return null;
  const e = i + 1; if (e + p.hold - 1 >= X.length) return null;
  const dist = p.atrMult * atr, entry = X[e].open, stop = entry - side * dist;
  let exit = null, how = 'time', k = e;
  for (; k < e + p.hold; k++) {
    const b = X[k];
    if (side > 0 ? b.open <= stop : b.open >= stop) { exit = b.open; how = 'gap'; break; }
    if (side > 0 ? b.low <= stop : b.high >= stop) { exit = stop; how = 'stop'; break; }
  }
  if (exit == null) { k = e + p.hold - 1; exit = X[k].close; }
  const end = how === 'time' ? X[k].time + 20 * 3600 : X[k].time, n = nights(X[e].time, end);
  const R = side * (exit - entry) / dist;
  const cost = { zero: 0, base: tradingCost(pair, entry) / dist, '2x': tradingCost(pair, entry, 2) / dist };
  const fin = { zero: 0, base: finR(pair, side, n, dist, 'base'), '2x': finR(pair, side, n, dist, '2x') };
  return { sigT: X[i].time, entryT: X[e].time, exitT: X[k].time, side, entry, stop, dist, exit, how, nights: n, R,
    finBase: fin.base, costBase: cost.base, net: R - cost.base + fin.base, net0: R, net2: R - cost['2x'] + fin['2x'] };
}

// a stream: weeks [{ t, usd }] (usd +1 buy USD / -1 sell USD), one position at a time
export function stream(X, weeks, pair) {
  const idx = new Map(X.map((b, i) => [dayKey(b.time), i])), out = []; let busy = -Infinity;
  for (const w of weeks) {
    if (!w.usd) continue; const i = idx.get(dayKey(w.t)); if (i == null) continue;
    if (X[i + 1] && X[i + 1].time <= busy) continue;
    const tr = trade(X, i, w.usd * pair.usdSide, pair); if (!tr) continue;
    tr.usd = w.usd; out.push(tr); busy = tr.exitT;
  }
  return out;
}

// statistics
const ym = (t) => new Date(t * 1000).toISOString().slice(0, 7);
const erfc = (x) => { const z = Math.abs(x), t = 1 / (1 + 0.5 * z), r = t * Math.exp(-z * z - 1.26551223 + t * (1.00002368 + t * (0.37409196 + t * (0.09678418 + t * (-0.18628806 + t * (0.27886807 + t * (-1.13520398 + t * (1.48851587 + t * (-0.82215223 + t * 0.17087277))))))))); return x >= 0 ? r : 2 - r; };
export const pOne = (t) => 0.5 * erfc(t / Math.SQRT2);
export function monthT(T, key = 'net') {
  const m = new Map(); for (const x of T) m.set(ym(x.entryT), (m.get(ym(x.entryT)) || 0) + x[key]);
  const v = [...m.values()], n = v.length; if (n < 3) return { months: n, t: null };
  const a = v.reduce((p, q) => p + q, 0) / n, sd = Math.sqrt(v.reduce((p, q) => p + (q - a) ** 2, 0) / (n - 1));
  return { months: n, t: sd > 0 ? +(a / (sd / Math.sqrt(n))).toFixed(2) : null };
}
export function holm(ps) { const o = ps.map((p, i) => [p, i]).sort((a, b) => a[0] - b[0]), adj = Array(ps.length); let m = 0;
  o.forEach(([p, i], r) => { m = Math.max(m, Math.min(1, p * (ps.length - r))); adj[i] = m; }); return adj; }
const r3 = (x) => +x.toFixed(3);
export function stats(T, key = 'net') {
  const n = T.length; if (!n) return { n: 0 };
  const g = T.reduce((p, x) => p + x.R, 0), s = T.reduce((p, x) => p + x[key], 0);
  let eq = 0, pk = 0, dd = 0; for (const x of T) { eq += x[key]; pk = Math.max(pk, eq); dd = Math.min(dd, eq - pk); }
  const mt = monthT(T, key);
  return { n, gross: r3(g), grossAvg: r3(g / n), net: r3(s), avg: r3(s / n), win: +(T.filter((x) => x[key] > 0).length / n).toFixed(3),
    stopped: T.filter((x) => x.how !== 'time').length, nightsAvg: +(T.reduce((p, x) => p + x.nights, 0) / n).toFixed(2),
    finAvg: r3(T.reduce((p, x) => p + x.finBase, 0) / n), costAvg: r3(T.reduce((p, x) => p + x.costBase, 0) / n),
    dd: r3(dd), months: mt.months, t: mt.t, tGross: monthT(T, 'R').t };
}
export function rng(seed) { let a = seed >>> 0; return () => { a = (a + 0x6D2B79F5) >>> 0; let t = a; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; }
export function pct(v, q) { const s = [...v].sort((a, b) => a - b), r = q * (s.length - 1), lo = Math.floor(r), hi = Math.ceil(r); return s[lo] + (s[hi] - s[lo]) * (r - lo); }

// placebo: same count of decisive weeks drawn without replacement from every decisive Friday a trade could be entered, random side
export function placebo(X, fridays, pair, count, seed) {
  const R = rng(seed), pool = [...fridays];
  for (let i = pool.length - 1; i > 0; i--) { const j = Math.floor(R() * (i + 1)); [pool[i], pool[j]] = [pool[j], pool[i]]; }
  const pick = pool.slice(0, count).sort((a, b) => a - b).map((t) => ({ t, usd: 0 }));
  for (const w of pick) w.usd = R() < 0.5 ? 1 : -1;
  const T = stream(X, pick, pair); return { n: T.length, avg: T.length ? T.reduce((p, x) => p + x.net, 0) / T.length : null, t: monthT(T).t };
}

export function analyse(F, { seeds = 40 } = {}) {
  const B = bars(F.usb02y.rows), weeks = bondWeeks(B);
  const win = { decisive: (x) => x.entryT >= SPLIT, replication: (x) => x.entryT < SPLIT };
  const sig = weeks.filter((w) => w.dir != null);
  const out = { data: {}, signals: { weeks: sig.length, up: sig.filter((w) => w.dir > 0).length, down: sig.filter((w) => w.dir < 0).length, flat: sig.filter((w) => w.dir === 0).length,
    first: sig.length ? new Date(sig[0].t * 1000).toISOString().slice(0, 10) : null }, tests: {} };
  for (const k of KEYS) { const r = F[k].rows; out.data[k] = { inst: F[k].inst, rows: r.length, first: new Date(r[0][0] * 1000).toISOString().slice(0, 10), last: new Date(r.at(-1)[0] * 1000).toISOString().slice(0, 10) }; }
  const ps = [];
  for (const [k, pair] of Object.entries(PAIRS)) {
    const X = bars(F[pair.key].rows);
    const T = stream(X, sig.map((w) => ({ t: w.t, usd: w.dir })), pair);
    const V = stream(X, sig.map((w) => ({ t: w.t, usd: w.sign })), pair);
    const o = { pair: pair.name, swap: pair.swap, swapSrc: pair.swapSrc, windows: {}, levels: {}, variant: {}, years: {}, byYields: {} };
    for (const [w, f] of Object.entries(win)) {
      const Tw = T.filter(f);
      o.windows[w] = stats(Tw);
      o.levels[w] = { zero: stats(Tw, 'net0'), base: stats(Tw, 'net'), x2: stats(Tw, 'net2') };
      o.variant[w] = stats(V.filter(f));
    }
    for (const x of T) { const y = new Date(x.entryT * 1000).getUTCFullYear(); (o.years[y] = o.years[y] || []).push(x); }
    for (const y of Object.keys(o.years)) { const s = stats(o.years[y]); o.years[y] = { n: s.n, gross: s.gross, net: s.net, avg: s.avg }; }
    for (const [nm, u] of [['yieldsUp', 1], ['yieldsDown', -1]]) for (const [w, f] of Object.entries(win)) {
      const s = stats(T.filter((x) => f(x) && x.usd === u)); (o.byYields[nm] = o.byYields[nm] || {})[w] = { n: s.n, grossAvg: s.grossAvg, avg: s.avg, t: s.t };
    }
    // placebo pool: every decisive Friday where a trade could be entered
    const idx = new Map(X.map((b, i) => [dayKey(b.time), i]));
    const fr = weeks.map((w) => w.t).filter((t) => { const i = idx.get(dayKey(t)); return i != null && X[i + 1] && X[i + 1].time >= SPLIT && atrAt(X, i) > 0 && i + P.hold < X.length; });
    const nd = o.windows.decisive.n, pl = [];
    for (let s = 1; s <= seeds; s++) pl.push(placebo(X, fr, pair, nd, s));
    const avgs = pl.map((x) => x.avg), p95 = pct(avgs, 0.95);
    o.placebo = { seeds, pool: fr.length, count: nd, median: r3(pct(avgs, 0.5)), p95: r3(p95), min: r3(Math.min(...avgs)), max: r3(Math.max(...avgs)),
      tMedian: +pct(pl.map((x) => x.t ?? 0), 0.5).toFixed(2), above: avgs.filter((a) => a >= o.windows.decisive.avg).length, pass: o.windows.decisive.avg > p95 };
    ps.push(o.windows.decisive.t == null ? 1 : pOne(o.windows.decisive.t));
    out.tests[k] = o;
  }
  const adj = holm(ps);
  Object.values(out.tests).forEach((o, i) => {
    const d = o.windows.decisive, r = o.windows.replication;
    o.p = +ps[i].toFixed(4); o.holm = +adj[i].toFixed(4);
    o.checks = { bothPositive: d.avg > 0 && r.avg > 0, t2: d.t != null && d.t >= 2, holm: adj[i] < 0.05, n100: d.n >= 100, placebo: o.placebo.pass };
    o.pass = Object.values(o.checks).every(Boolean);
  });
  const nPass = Object.values(out.tests).filter((o) => o.pass).length;
  out.passCount = nPass;
  return out;
}

export function verdictOf(res) {
  const t = Object.entries(res.tests).map(([k, o]) => `${k} ${o.pair} ${o.windows.decisive.avg >= 0 ? '+' : ''}${o.windows.decisive.avg.toFixed(3)}R (n ${o.windows.decisive.n}, t ${o.windows.decisive.t})`).join('; ');
  return `${res.passCount ? 'PASS' : 'FAIL'}, ${res.passCount} of 3: a weekly 2-year Treasury move does not lead the dollar over the next week; decisive 2016-26 net a trade ${t}; replication 2004-15 negative on all three; no placebo beaten.`;
}

const here = path.dirname(fileURLToPath(import.meta.url));
if (process.argv[1] && fileURLToPath(import.meta.url) === path.resolve(process.argv[1])) {
  const [cmd, dir] = process.argv.slice(2);
  if (!dir) { console.error('usage: run.mjs fetch|full <dir>'); process.exit(2); }
  if (cmd === 'fetch') {
    fs.mkdirSync(dir, { recursive: true });
    for (const k of KEYS) fs.writeFileSync(path.join(dir, `${k}.json`), execFileSync('git', ['show', `origin/council-data:research/daily/${k}.json`], { maxBuffer: 1 << 28 }));
  } else if (cmd === 'full') {
    const F = Object.fromEntries(KEYS.map((k) => [k, JSON.parse(fs.readFileSync(path.join(dir, `${k}.json`), 'utf8'))]));
    const res = analyse(F);
    const out = { study: 'yield-fx-weekly', built: '2026-11-14', verdict: verdictOf(res), rule: P, costs: COST, split: '2016-01-01', ...res };
    fs.writeFileSync(path.join(here, 'result.json'), JSON.stringify(out, null, 1) + '\n');
    console.log(JSON.stringify({ signals: res.signals, passCount: res.passCount, tests: Object.fromEntries(Object.entries(res.tests).map(([k, o]) => [k, { w: o.windows, checks: o.checks, holm: o.holm, placebo: o.placebo, variant: o.variant }])) }, null, 1));
  }
}
