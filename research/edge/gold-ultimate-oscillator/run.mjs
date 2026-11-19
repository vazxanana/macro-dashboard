// Williams' Ultimate Oscillator extremes on gold's daily chart, against the same-side trade on every day
// (PREREGISTRATION.md, pushed first).
//   node research/edge/gold-ultimate-oscillator/run.mjs fetch <dir>   copies council-data research/daily/xau.json to <dir> (git show, no network)
//   node research/edge/gold-ultimate-oscillator/run.mjs full <dir>    runs the study and writes result.json next to this file
// A stand-alone rule: it does not read or change the gold book. Research only, nothing live.
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { execFileSync } from 'node:child_process';
import { nights, FIN, foldWeekend } from '../../../council/fills.mjs';

export const P = { lo: 35, hi: 65, atrN: 14, k: 2, hold: 5, cost: 0.60, warm: Date.UTC(2007, 0, 1) / 1000,
  isEnd: Date.UTC(2017, 0, 1) / 1000, seeds: 40 };
export const TESTS = {
  T1: { name: 'Both sides pooled, excess over the same-side every-day trade', sides: [1, -1] },
  T2: { name: 'Long side (UO enters oversold), excess', sides: [1] },
  T3: { name: 'Short side (UO enters overbought), excess', sides: [-1] },
};
const ym = (t) => new Date(t * 1000).toISOString().slice(0, 7);
const r4 = (x) => +x.toFixed(4);

// rows [t,o,h,l,c,v] -> folded weekday bars, complete days only (a row dated `now`'s day or later is dropped)
export function barsOf(rows, now = Date.now() / 1000) {
  const today = Math.floor(now / 86400) * 86400;
  const raw = rows.filter((r) => r[0] < today).map(([t, o, h, l, c]) => ({ time: t, open: o, high: h, low: l, close: c }))
    .sort((a, b) => a.time - b.time);
  return foldWeekend(raw);
}
const trOf = (bars, i) => (i === 0 ? bars[0].high - bars[0].low
  : Math.max(bars[i].high, bars[i - 1].close) - Math.min(bars[i].low, bars[i - 1].close));
export function atr(bars, n = P.atrN) {
  const out = new Array(bars.length).fill(null), tr = bars.map((_, i) => trOf(bars, i));
  for (let i = n; i < bars.length; i++) { let s = 0; for (let k = i - n + 1; k <= i; k++) s += tr[k]; out[i] = s / n; }
  return out;
}
// Ultimate Oscillator (7, 14, 28): null until 28 days with a previous close exist. Reads days <= i only.
export function uo(bars) {
  const L = bars.length, out = new Array(L).fill(null), bp = new Array(L).fill(0), tr = new Array(L).fill(0);
  for (let i = 1; i < L; i++) { const pc = bars[i - 1].close; bp[i] = bars[i].close - Math.min(bars[i].low, pc); tr[i] = trOf(bars, i); }
  const avg = (i, n) => { let b = 0, t = 0; for (let k = i - n + 1; k <= i; k++) { b += bp[k]; t += tr[k]; } return t > 0 ? b / t : 0.5; };
  for (let i = 28; i < L; i++) out[i] = 100 * (4 * avg(i, 7) + 2 * avg(i, 14) + avg(i, 28)) / 7;
  return out;
}
// signal on the close of day i: +1 long (enters oversold), -1 short (enters overbought), 0 none
export function signals(bars, p = P) {
  const u = uo(bars);
  return u.map((x, i) => {
    if (i === 0 || x == null || u[i - 1] == null) return 0;
    if (x < p.lo && u[i - 1] >= p.lo) return 1;
    if (x > p.hi && u[i - 1] <= p.hi) return -1;
    return 0;
  });
}
// one trade after the close of day i: entry at bars[i+1].open, stop k x ATR(i), out at bars[i+1+hold].open
export function tradeAt(bars, A, i, side, p = P) {
  const a = A[i]; if (!(a > 0) || i + 1 + p.hold >= bars.length) return null;
  const e = i + 1, entry = bars[e].open, dist = p.k * a, stop = entry - side * dist;
  let exit = bars[e + p.hold].open, j = e + p.hold, why = 'time', stopped = false;
  for (let q = e; q < e + p.hold; q++) {
    const b = bars[q];
    if (side > 0 && b.low <= stop) { exit = Math.min(b.open, stop); j = q; why = 'stop'; stopped = true; break; }
    if (side < 0 && b.high >= stop) { exit = Math.max(b.open, stop); j = q; why = 'stop'; stopped = true; break; }
  }
  return { side, sigI: i, entryI: e, exitI: j, entry, exit, dist, stop, why,
    entryT: bars[e].time, exitT: bars[j].time + (stopped && exit !== bars[j].open ? 43200 : 0) };
}
// R of a trade: gross, cost, financing, net (costMul 1 or 2)
export function rOf(t, costMul = 1, p = P) {
  const gross = (t.exit - t.entry) * t.side / t.dist, cost = costMul * p.cost / t.dist;
  const nn = t.side > 0 ? nights(t.entryT, t.exitT) : 0;
  const fin = costMul * nn * (t.side > 0 ? FIN.xau.long : FIN.xau.short) * t.entry / t.dist;
  return { gross, cost, fin, nights: nn, net: gross - cost - fin };
}
const withR = (t, p) => { const r = rOf(t, 1, p), r2 = rOf(t, 2, p); return { ...t, gross: r.gross, fin: r.fin, net: r.net, net2: r2.net }; };

// statistics
function lgamma(x) { const g = [76.18009172947146, -86.50532032941677, 24.01409824083091, -1.231739572450155, 0.1208650973866179e-2, -0.5395239384953e-5];
  let y = x, tmp = x + 5.5; tmp -= (x + 0.5) * Math.log(tmp); let s = 1.000000000190015; for (const c of g) s += c / ++y; return -tmp + Math.log(2.5066282746310005 * s / x); }
function betacf(a, b, x) { let qab = a + b, qap = a + 1, qam = a - 1, c = 1, d = 1 - qab * x / qap; if (Math.abs(d) < 1e-30) d = 1e-30; d = 1 / d; let h = d;
  for (let m = 1; m <= 200; m++) { const m2 = 2 * m; let aa = m * (b - m) * x / ((qam + m2) * (a + m2)); d = 1 + aa * d; if (Math.abs(d) < 1e-30) d = 1e-30; c = 1 + aa / c; if (Math.abs(c) < 1e-30) c = 1e-30; d = 1 / d; h *= d * c;
    aa = -(a + m) * (qab + m) * x / ((a + m2) * (qap + m2)); d = 1 + aa * d; if (Math.abs(d) < 1e-30) d = 1e-30; c = 1 + aa / c; if (Math.abs(c) < 1e-30) c = 1e-30; d = 1 / d; const del = d * c; h *= del; if (Math.abs(del - 1) < 3e-12) break; }
  return h; }
function ibeta(a, b, x) { if (x <= 0) return 0; if (x >= 1) return 1; const bt = Math.exp(lgamma(a + b) - lgamma(a) - lgamma(b) + a * Math.log(x) + b * Math.log(1 - x));
  return x < (a + 1) / (a + b + 2) ? bt * betacf(a, b, x) / a : 1 - bt * betacf(b, a, 1 - x) / b; }
export function pTwo(t, df) { if (!Number.isFinite(t) || df < 1) return 1; return ibeta(df / 2, 0.5, df / (df + t * t)); }
export function holm(ps) {
  const idx = ps.map((p, i) => [p, i]).sort((a, b) => a[0] - b[0]), out = new Array(ps.length); let run = 0;
  idx.forEach(([p, i], r) => { run = Math.max(run, Math.min(1, (ps.length - r) * p)); out[i] = run; });
  return out;
}
// every calendar month from `from` to `to` (unix), sums of `key` by exit month
export function monthT(trades, from, to, key = 'ex') {
  const months = []; const d = new Date(from * 1000); let y = d.getUTCFullYear(), m = d.getUTCMonth();
  const end = ym(to - 1);
  for (;;) { const s = `${y}-${String(m + 1).padStart(2, '0')}`; months.push(s); if (s >= end) break; m++; if (m > 11) { m = 0; y++; } }
  const sum = Object.fromEntries(months.map((s) => [s, 0]));
  for (const t of trades) { const s = ym(t.exitT); if (s in sum) sum[s] += t[key]; }
  const v = months.map((s) => sum[s]), n = v.length, mean = v.reduce((a, b) => a + b, 0) / n;
  const sd = Math.sqrt(v.reduce((a, b) => a + (b - mean) ** 2, 0) / (n - 1));
  const t = sd > 0 ? mean / (sd / Math.sqrt(n)) : 0;
  return { months: n, t: +t.toFixed(3), p: +pTwo(t, n - 1).toFixed(5) };
}
export function mulberry32(a) { return () => { a |= 0; a = (a + 0x6D2B79F5) | 0; let t = Math.imul(a ^ (a >>> 15), 1 | a); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; }

// baseline: the same trade after EVERY day of the window, per side; mean net and net2
export function baseline(bars, A, from, to, side, p = P) {
  let n = 0, s = 0, s2 = 0, g = 0;
  for (let i = 0; i < bars.length; i++) {
    const t0 = bars[i + 1]?.time; if (t0 == null || t0 < from || t0 >= to) continue;
    const t = tradeAt(bars, A, i, side, p); if (!t) continue;
    const r = withR(t, p); n++; s += r.net; s2 += r.net2; g += r.gross;
  }
  return { n, gross: n ? g / n : 0, net: n ? s / n : 0, net2: n ? s2 / n : 0 };
}
function summary(trades, from, to) {
  const n = trades.length, avg = (k) => (n ? trades.reduce((a, t) => a + t[k], 0) / n : 0);
  let eq = 0, hi = 0, dd = 0; for (const t of trades) { eq += t.net; hi = Math.max(hi, eq); dd = Math.min(dd, eq - hi); }
  const plain = monthT(trades, from, to, 'net');
  return { n, win: n ? r4(trades.filter((t) => t.net > 0).length / n) : 0, gross: r4(avg('gross')), net: r4(avg('net')), net2: r4(avg('net2')),
    excess: r4(avg('ex')), excess2: r4(avg('ex2')), total: +trades.reduce((a, t) => a + t.net, 0).toFixed(2), maxDD: +dd.toFixed(2),
    stops: trades.filter((t) => t.why === 'stop').length, ...monthT(trades, from, to, 'ex'), tNet: plain.t };
}

export function study(bars, p = P) {
  const end = bars[bars.length - 1].time + 86400, A = atr(bars, p.atrN), sig = signals(bars, p);
  const W = { IS: [p.warm, p.isEnd], OOS: [p.isEnd, end] };
  const base = {}; for (const [w, [f, t]] of Object.entries(W)) for (const s of [1, -1]) base[w + s] = baseline(bars, A, f, t, s, p);
  const all = [];
  sig.forEach((s, i) => { if (!s) return; const t = tradeAt(bars, A, i, s, p); if (!t || t.entryT < p.warm) return;
    const w = t.entryT < p.isEnd ? 'IS' : 'OOS', b = base[w + s], r = withR(t, p);
    all.push({ ...r, w, ex: r.net - b.net, ex2: r.net2 - b.net2 }); });
  // placebo pool: every OOS day's trade per side, with its excess
  const pool = { 1: [], '-1': [] };
  for (let i = 0; i < bars.length; i++) { const t0 = bars[i + 1]?.time; if (t0 == null || t0 < p.isEnd) continue;
    for (const s of [1, -1]) { const t = tradeAt(bars, A, i, s, p); if (t) { const r = withR(t, p); pool[s].push(r.net - base['OOS' + s].net); } } }
  const out = { tests: {}, baseline: Object.fromEntries(Object.entries(base).map(([k, v]) => [k, { n: v.n, gross: r4(v.gross), net: r4(v.net), net2: r4(v.net2) }])) };
  const ps = [];
  for (const [id, T] of Object.entries(TESTS)) {
    const L = all.filter((t) => T.sides.includes(t.side)), IS = L.filter((t) => t.w === 'IS'), OOS = L.filter((t) => t.w === 'OOS');
    const o = summary(OOS, ...W.OOS), pl = [];
    for (let seed = 1; seed <= p.seeds; seed++) { const rnd = mulberry32(seed); let s = 0, n = 0;
      for (const side of T.sides) { const P2 = pool[side], k = OOS.filter((t) => t.side === side).length; for (let j = 0; j < k; j++) { s += P2[Math.floor(rnd() * P2.length)]; n++; } }
      pl.push(r4(n ? s / n : 0)); }
    out.tests[id] = { ...T, IS: summary(IS, ...W.IS), OOS: o,
      placebo: { seeds: pl, beaten: pl.filter((x) => o.excess > x).length, median: r4([...pl].sort((a, b) => a - b)[Math.floor(pl.length / 2)]) },
      trades: OOS.map((t) => [new Date(t.entryT * 1000).toISOString().slice(0, 10), t.side, +t.entry.toFixed(2), +t.dist.toFixed(2), +t.exit.toFixed(2), t.why, +t.net.toFixed(3)]) };
    ps.push(o.p);
  }
  const adj = holm(ps);
  Object.keys(TESTS).forEach((id, i) => {
    const x = out.tests[id]; x.holmP = +adj[i].toFixed(5);
    const checks = { oosExcess: x.OOS.excess > 0 && x.OOS.t >= 2 && x.holmP < 0.05, isSign: x.IS.excess > 0, costs2x: x.OOS.excess2 > 0,
      oosNet: x.OOS.net > 0, placebo: x.placebo.beaten >= 38, n: x.OOS.n >= (id === 'T1' ? 100 : 30) };
    x.checks = checks; x.pass = Object.values(checks).every(Boolean);
  });
  out.window = { is: '2007-01-01..2016-12-31', oos: `2017-01-01..${new Date((end - 86400) * 1000).toISOString().slice(0, 10)}`, candles: bars.length };
  out.pass = out.tests.T1.pass;
  return out;
}

const here = path.dirname(fileURLToPath(import.meta.url));
if (process.argv[1] && fileURLToPath(import.meta.url) === path.resolve(process.argv[1])) {
  const [cmd, dir] = process.argv.slice(2);
  if (cmd === 'fetch') {
    fs.mkdirSync(dir, { recursive: true });
    fs.writeFileSync(path.join(dir, 'xau.json'), execFileSync('git', ['show', 'origin/council-data:research/daily/xau.json'], { maxBuffer: 1 << 26 }));
    console.log('wrote', path.join(dir, 'xau.json'));
  } else if (cmd === 'full') {
    const f = JSON.parse(fs.readFileSync(path.join(dir, 'xau.json'), 'utf8'));
    const bars = barsOf(f.rows, Date.parse(f.updated) / 1000 + 86400);
    const r = study(bars);
    const res = { topic: 'gold-ultimate-oscillator', built: '2026-11-14', data: `council-data research/daily/xau.json (${f.src}, updated ${f.updated})`,
      verdict: r.pass ? 'PASS' : 'FAIL', ...r };
    fs.writeFileSync(path.join(here, 'result.json'), JSON.stringify(res, null, 1) + '\n');
    for (const [id, x] of Object.entries(r.tests)) console.log(id, x.name, '\nIS', JSON.stringify(x.IS), '\nOOS', JSON.stringify(x.OOS),
      '\nholm', x.holmP, 'placebo', x.placebo.beaten, 'med', x.placebo.median, 'pass', x.pass, JSON.stringify(x.checks));
    console.log('baseline', JSON.stringify(r.baseline), r.window, 'verdict', res.verdict);
  } else console.log('usage: run.mjs fetch|full <dir>');
}
