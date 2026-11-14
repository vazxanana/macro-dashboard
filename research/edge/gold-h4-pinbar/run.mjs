// The pin bar at a new 20-candle extreme on spot gold H4 (PREREGISTRATION.md, pushed first).
//   node --use-env-proxy research/edge/gold-h4-pinbar/run.mjs fetch <dir>   OANDA mid H1 gold -> <dir>/xau-h1.json (keep out of git)
//   node research/edge/gold-h4-pinbar/run.mjs full <dir>                    the study -> result.json (+ prints a summary)
// A stand-alone rule: never a gate, exit, entry or size of the live gold book. Pure pieces are exported for the test.
import fs from 'node:fs';
import path from 'node:path';
import { nights, FIN } from '../../../council/fills.mjs';

export const H = 3600, H4 = 4 * H, DAY = 86400;
export const SPREAD = 0.30, SLIP = SPREAD / 2, RT = SPREAD + 2 * SLIP;   // $0.60 a round trip
export const N = 20, ATR_N = 14, BUF = 0.30, HOLD = 12, TGT = 2, SMA_N = 100, WICK = 2 / 3;
export const WIN = { is: ['2008-01-01', '2016-12-31'], oos: ['2017-01-01', '2026-10-31'] };
export const SEED = 20261114, SEEDS = 40;

// H4 bucket start, boundaries at 22 / 02 / 06 / 10 / 14 / 18 UTC; Sunday hours before 22:00 go to the Sunday 22:00 candle
export function h4Start(t) {
  const d = new Date(t * 1000);
  if (d.getUTCDay() === 0 && d.getUTCHours() < 22) return Math.floor(t / DAY) * DAY + 22 * H;
  return Math.floor((t - 2 * H) / H4) * H4 + 2 * H;
}
// D1 = 22:00 to 22:00 UTC (Sunday hours with Monday); key = the day's end time
export function d1End(t) {
  const d = new Date(t * 1000);
  if (d.getUTCDay() === 0 && d.getUTCHours() < 22) return Math.floor(t / DAY) * DAY + 22 * H + DAY;
  return Math.floor((t + 2 * H) / DAY) * DAY + 22 * H;
}
function group(h1, keyOf) {
  const out = []; let cur = null;
  for (const [t, o, h, l, c] of h1) {
    const k = keyOf(t);
    if (!cur || cur.key !== k) { cur = { key: k, time: t, open: o, high: h, low: l, close: c, last: t }; out.push(cur); }
    else { cur.high = Math.max(cur.high, h); cur.low = Math.min(cur.low, l); cur.close = c; cur.last = t; }
  }
  return out;
}
// H4 candles: time = bucket start, end = last H1 open + 1 h (when the candle is known closed), atr = simple ATR(14)
export function toH4(h1) {
  const c = group(h1, h4Start).map((x) => ({ time: x.key, open: x.open, high: x.high, low: x.low, close: x.close, end: x.last + H }));
  const tr = c.map((x, i) => (i ? Math.max(x.high, c[i - 1].close) - Math.min(x.low, c[i - 1].close) : x.high - x.low));
  c.forEach((x, i) => { if (i >= ATR_N - 1) { let s = 0; for (let k = i - ATR_N + 1; k <= i; k++) s += tr[k]; x.atr = s / ATR_N; } else x.atr = null; });
  return c;
}
export function toD1(h1) { return group(h1, d1End).map((x) => ({ end: x.key, close: x.close, lastH1: x.last })); }

// D1 filter at the pin's close: last completed D1 close > SMA(100) of completed D1 closes. Only days ended by `at` are read.
export function d1Above(d1, at) {
  let lo = 0, hi = d1.length;   // count of days with end <= at (the day is complete once its last H1 candle has closed)
  while (lo < hi) { const m = (lo + hi) >> 1; if (d1[m].lastH1 + H <= at) lo = m + 1; else hi = m; }
  if (lo < SMA_N) return false;
  let s = 0; for (let k = lo - SMA_N; k < lo; k++) s += d1[k].close;
  return d1[lo - 1].close > s / SMA_N;
}

// new 20-candle extreme: -1 new low, +1 new high, 0 none (both is impossible to call; returns 0)
export function extreme(c, i) {
  if (i < N - 1) return 0; let hh = -Infinity, ll = Infinity;
  for (let k = i - N + 1; k < i; k++) { hh = Math.max(hh, c[k].high); ll = Math.min(ll, c[k].low); }
  const lo = c[i].low < ll, hi = c[i].high > hh;
  return lo && !hi ? -1 : hi && !lo ? 1 : 0;
}
// pin bar on candle i: +1 bullish pin (long), -1 bearish pin (short), 0 none
export function pin(c, i) {
  const x = c[i]; if (!(x.atr > 0)) return 0;
  const R = x.high - x.low; if (!(R > 0) || R < x.atr) return 0;
  const e = extreme(c, i), bLo = Math.min(x.open, x.close), bHi = Math.max(x.open, x.close);
  if (e === -1 && bLo - x.low >= WICK * R && bLo >= x.low + WICK * R) return 1;
  if (e === 1 && x.high - bHi >= WICK * R && bHi <= x.low + (1 - WICK) * R) return -1;
  return 0;
}
// placebo candidate: new extreme + range >= ATR, no wick or body condition; reversal side
export function cand(c, i) {
  const x = c[i]; if (!(x.atr > 0) || x.high - x.low < x.atr) return 0;
  const e = extreme(c, i); return e === -1 ? 1 : e === 1 ? -1 : 0;
}

export const TESTS = {
  T1: { name: 'T1 both sides, target 2R', tgt: TGT, sig: (c, i) => pin(c, i), plc: (c, i) => cand(c, i) },
  T2: { name: 'T2 both sides, no target, time exit after 12 H4 candles', tgt: null, sig: (c, i) => pin(c, i), plc: (c, i) => cand(c, i) },
  T3: { name: 'T3 bullish pins only, target 2R, D1 close above its 100-day average', tgt: TGT, d1: true,
    sig: (c, i) => (pin(c, i) === 1 ? 1 : 0), plc: (c, i) => (cand(c, i) === 1 ? 1 : 0) },
};
const sigOf = (test, c, d1, i, fn) => { const s = fn(c, i); if (!s) return 0; if (test.d1 && !d1Above(d1, c[i].end)) return 0; return s; };

// one trade from signal candle i: entry at candle i+1's open; managed on H4 candles i+1 .. i+HOLD
export function simulate(c, i, side, tgt, k = 1) {
  const sig = c[i], e0 = i + 1, last = i + HOLD; if (last >= c.length) return null;
  const entry = c[e0].open, stop = side > 0 ? sig.low - BUF : sig.high + BUF;
  if (side > 0 ? entry <= stop : entry >= stop) return null;
  const risk = Math.abs(entry - stop), target = tgt == null ? null : entry + side * tgt * risk;
  let exit = null, how = null, j = e0;
  for (; j <= last; j++) { const x = c[j];
    const hitS = side > 0 ? x.low <= stop : x.high >= stop;
    if (hitS) { exit = side > 0 ? Math.min(x.open, stop) : Math.max(x.open, stop); how = 'stop'; break; }
    if (target != null && (side > 0 ? x.high >= target : x.low <= target)) { exit = side > 0 ? Math.max(x.open, target) : Math.min(x.open, target); how = 'target'; break; }
    if (j === last) { exit = x.close; how = 'time'; break; }
  }
  const entryT = c[e0].time, exitT = c[j].end, gross = side * (exit - entry) / risk, nn = side > 0 ? nights(entryT, exitT) : 0;
  const cost = RT / risk, fin = side > 0 ? nn * FIN.xau.long * entry / risk : 0;
  return { i, exitIdx: j, side, entryT, exitT, entry, stop, target, risk, exit, how, nights: nn, gross, cost, fin,
    net: gross - k * (cost + fin), net2: gross - 2 * (cost + fin) };
}
export function runTest(c, d1, test, fn = test.sig) {
  const out = []; let free = 0;
  for (let i = N; i < c.length - 1; i++) {
    if (i < free) continue; const side = sigOf(test, c, d1, i, fn); if (!side) continue;
    const tr = simulate(c, i, side, test.tgt); if (!tr) continue;
    out.push(tr); free = tr.exitIdx;
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
export function summary(T, w) {
  const n = T.length, mean = (k) => (n ? T.reduce((a, x) => a + x[k], 0) / n : null), mt = monthT(T, w), mg = monthT(T, w, 'gross'), m2 = monthT(T, w, 'net2');
  let eq = 0, pk = 0, dd = 0; for (const x of T) { eq += x.net; pk = Math.max(pk, eq); dd = Math.min(dd, eq - pk); }
  return { n, gross: r3(mean('gross')), net: r3(mean('net')), net2x: r3(mean('net2')), cost: r3(mean('cost')), fin: r3(mean('fin')),
    total: r2(T.reduce((a, x) => a + x.net, 0)), win: n ? r2(T.filter((x) => x.net > 0).length / n * 100) : null,
    stops: T.filter((x) => x.how === 'stop').length, targets: T.filter((x) => x.how === 'target').length, longs: T.filter((x) => x.side > 0).length,
    months: mt.months, t: r2(mt.t), tGross: r2(mg.t), t2x: r2(m2.t), dd: r2(dd) };
}
// placebo: each real OOS trade -> a random candidate (new extreme, range >= ATR, no wick rule) of the same side and calendar year
export function placebo(c, d1, test, real, seeds = SEEDS) {
  const pool = new Map();
  for (let i = N; i < c.length - HOLD - 1; i++) { const s = sigOf(test, c, d1, i, test.plc); if (!s) continue;
    const key = `${ymd(c[i + 1].time).slice(0, 4)}:${s}`; if (!pool.has(key)) pool.set(key, []); pool.get(key).push(i); }
  const means = [];
  for (let s = 1; s <= seeds; s++) { const r = rng(SEED + s), T = [];
    for (const x of real) { const P = pool.get(`${ymd(x.entryT).slice(0, 4)}:${x.side}`); if (!P) continue; let tr = null;
      for (let k = 0; k < 20 && !tr; k++) tr = simulate(c, P[Math.floor(r() * P.length)], x.side, test.tgt);
      if (tr) T.push(tr.net); }
    means.push(T.length ? T.reduce((a, b) => a + b, 0) / T.length : 0); }
  return means;
}

async function fetchH1(dir) {
  const BASE = process.env.MD_BASE || 'https://meridianx.dev/md/', sleep = (ms) => new Promise((r) => setTimeout(r, ms));
  fs.mkdirSync(dir, { recursive: true });
  const now = Math.floor(Date.now() / 1000), m = new Map();
  for (let a = Math.floor(Date.parse('2006-01-01T00:00:00Z') / 1000); a < now;) {
    const b = Math.min(now, a + 4990 * H); let j = null, err = null;
    for (let k = 0; k < 6 && !j; k++) {
      try { const r = await fetch(`${BASE}bars?sym=xau&tf=1h&from=${a}&to=${b}`, { signal: AbortSignal.timeout(40000) }); const x = r.ok ? await r.json() : null;
        if (x && Array.isArray(x.bars)) j = x; else err = x && x.error ? String(x.error) : `HTTP ${r.status}`; }
      catch (e) { err = String(e.message || e); }
      if (!j) await sleep(2500 * (k + 1));
    }
    if (!j) throw new Error(`${new Date(a * 1000).toISOString()}: ${err}`);
    for (const x of j.bars) if (!x.live && x.time >= a && x.time < b) m.set(+x.time, [+x.time, +x.open, +x.high, +x.low, +x.close]);
    a = b; await sleep(2200);
  }
  const rows = [...m.values()].sort((p, q) => p[0] - q[0]);
  fs.writeFileSync(path.join(dir, 'xau-h1.json'), JSON.stringify(rows));
  console.log(`xau 1h: ${rows.length} candles`);
}

function full(dir) {
  const h1 = JSON.parse(fs.readFileSync(path.join(dir, 'xau-h1.json'), 'utf8'));
  const c = toH4(h1), d1 = toD1(h1);
  const out = { built: '2026-11-14',
    data: { src: 'OANDA mid H1 XAU_USD via the site proxy, aggregated to H4 on fixed UTC boundaries 22/02/06/10/14/18 (Sunday hours before 22:00 into the Sunday 22:00 candle)',
      from: ymd(c[0].time), to: ymd(c.at(-1).time), h4: c.length, h1: h1.length, d1: d1.length },
    costs: { spread: SPREAD, slippagePerOrder: SLIP, roundTrip: RT, financing: { rate: FIN.xau.long, src: FIN.xau.src, side: 'longs only' } },
    rule: { N, atrN: ATR_N, wick: '2/3', buffer: BUF, hold: HOLD, target: TGT, smaN: SMA_N }, windows: WIN, seed: SEED, tests: {} };
  const ps = [];
  for (const [k, test] of Object.entries(TESTS)) {
    const all = runTest(c, d1, test), oos = inWin(all, WIN.oos), is = inWin(all, WIN.is);
    const so = summary(oos, WIN.oos), si = summary(is, WIN.is), pl = placebo(c, d1, test, oos), sorted = [...pl].sort((a, b) => a - b);
    const beaten = pl.filter((m) => so.net > m).length, p = 1 - phi(so.t || 0); ps.push(p);
    const years = {}; for (const x of all) { const y = ymd(x.entryT).slice(0, 4); if (y < '2008' || ymd(x.entryT) > WIN.oos[1]) continue; (years[y] ||= []).push(x); }
    const side = (T, s, w) => summary(T.filter((x) => x.side === s), w);
    out.tests[k] = { name: test.name, oos: so, is: si, p: +p.toFixed(4),
      bySide: { oosLong: side(oos, 1, WIN.oos), oosShort: side(oos, -1, WIN.oos) },
      placebo: { beaten, of: pl.length, p5: r3(sorted[1]), median: r3(sorted[19]), p95: r3(sorted[37]), mean: r3(pl.reduce((a, b) => a + b, 0) / pl.length) },
      years: Object.fromEntries(Object.entries(years).map(([y, T]) => [y, { n: T.length, net: r3(T.reduce((a, x) => a + x.net, 0) / T.length) }])) };
  }
  holm(ps).forEach((h, j) => { const x = Object.values(out.tests)[j]; x.holm = +h.toFixed(4);
    x.checks = { oosNet: x.oos.net > 0, oosT: x.oos.t >= 2 && x.holm < 0.05, is: x.is.net > 0, cost2x: x.oos.net2x > 0, placebo: x.placebo.beaten >= 38, n: x.oos.n >= 30 };
    x.pass = Object.values(x.checks).every(Boolean); });
  out.verdict = out.tests.T1.pass ? 'PASS' : 'FAIL';
  out.passAlone = ['T2', 'T3'].filter((k) => out.tests[k].pass);
  fs.writeFileSync(new URL('./result.json', import.meta.url), JSON.stringify(out, null, 1) + '\n');
  for (const [k, x] of Object.entries(out.tests)) console.log(k, JSON.stringify({ oos: x.oos, is: x.is, holm: x.holm, placebo: x.placebo, checks: x.checks, bySide: x.bySide }));
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const [cmd, dir] = process.argv.slice(2);
  if (!dir) throw new Error('usage: run.mjs fetch|full <dir>');
  if (cmd === 'fetch') await fetchH1(dir); else full(dir);
}
