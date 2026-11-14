// Trend quality (R squared of the 60-day log-price line) on gold's daily chart (PREREGISTRATION.md, pushed first).
//   node research/edge/gold-trend-r2/run.mjs fetch <dir>   copies council-data research/daily/xau.json to <dir> (git show, no network)
//   node research/edge/gold-trend-r2/run.mjs full <dir>    runs the study and writes result.json next to this file
// A stand-alone rule: it does not read or change the gold book. Research only, nothing live.
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { execFileSync } from 'node:child_process';
import { nights, FIN, foldWeekend } from '../../../council/fills.mjs';

export const P = { n: 60, r2Min: 0.70, hold: 10, atrN: 14, k: 2, cost: 0.60, warm: Date.UTC(2007, 0, 1) / 1000,
  isEnd: Date.UTC(2017, 0, 1) / 1000, half: Date.UTC(2022, 0, 1) / 1000, seeds: 40 };
export const TESTS = {
  T1: { name: 'Selection: signal trades minus the same-month same-side baseline (primary)' },
  T2: { name: 'Rule stand-alone, long and short, one at a time' },
  T3: { name: 'Rule stand-alone, shorts only, one at a time' },
};
const ym = (t) => new Date(t * 1000).toISOString().slice(0, 7);
const r4 = (x) => +x.toFixed(4);

export function barsOf(rows, now = Date.now() / 1000) {
  const today = Math.floor(now / 86400) * 86400;
  const raw = rows.filter((r) => r[0] < today).map(([t, o, h, l, c]) => ({ time: t, open: o, high: h, low: l, close: c }))
    .sort((a, b) => a.time - b.time);
  return foldWeekend(raw);
}
export function atr(bars, n = P.atrN) {
  const out = new Array(bars.length).fill(null), tr = bars.map((b, i) => i === 0 ? b.high - b.low
    : Math.max(b.high - b.low, Math.abs(b.high - bars[i - 1].close), Math.abs(b.low - bars[i - 1].close)));
  for (let i = n; i < bars.length; i++) { let s = 0; for (let k = i - n + 1; k <= i; k++) s += tr[k]; out[i] = s / n; }
  return out;
}
// OLS of ln(close) on 0..n-1 over the n closes up to and including day i: { slope, r2 } (null before n closes)
export function lineFit(bars, n = P.n) {
  const out = new Array(bars.length).fill(null), xm = (n - 1) / 2;
  let sxx = 0; for (let x = 0; x < n; x++) sxx += (x - xm) ** 2;
  for (let i = n - 1; i < bars.length; i++) {
    let ym0 = 0; for (let k = 0; k < n; k++) ym0 += Math.log(bars[i - n + 1 + k].close); ym0 /= n;
    let sxy = 0, syy = 0;
    for (let k = 0; k < n; k++) { const d = Math.log(bars[i - n + 1 + k].close) - ym0; sxy += (k - xm) * d; syy += d * d; }
    const slope = sxy / sxx, r2 = syy > 0 ? (sxy * sxy) / (sxx * syy) : 0;
    out[i] = { slope, r2 };
  }
  return out;
}
// one trade from signal day i: entry at bars[i+1].open, stop k x ATR(i), out at bars[i+1+hold].open or the stop
export function tradeAt(bars, A, i, side, p = P) {
  const e = i + 1, x = e + p.hold; if (x >= bars.length || !(A[i] > 0) || !side) return null;
  const entry = bars[e].open, dist = p.k * A[i], stop = entry - side * dist;
  for (let q = e; q < x; q++) { const b = bars[q];
    if (side > 0 && b.low <= stop) { const ex = Math.min(b.open, stop); return { side, entry, dist, stop, signalI: i, entryI: e, exitI: q, entryT: bars[e].time, exitT: b.time + (ex !== b.open ? 43200 : 0), exit: ex, why: 'stop' }; }
    if (side < 0 && b.high >= stop) { const ex = Math.max(b.open, stop); return { side, entry, dist, stop, signalI: i, entryI: e, exitI: q, entryT: bars[e].time, exitT: b.time + (ex !== b.open ? 43200 : 0), exit: ex, why: 'stop' }; }
  }
  return { side, entry, dist, stop, signalI: i, entryI: e, exitI: x, entryT: bars[e].time, exitT: bars[x].time, exit: bars[x].open, why: 'time' };
}
export function rOf(t, costMul = 1, p = P) {
  const gross = (t.exit - t.entry) * t.side / t.dist, cost = costMul * p.cost / t.dist;
  const nn = t.side > 0 ? nights(t.entryT, t.exitT) : 0;
  const fin = costMul * nn * (t.side > 0 ? FIN.xau.long : FIN.xau.short) * t.entry / t.dist;
  return { gross, cost, fin, nights: nn, net: gross - cost - fin };
}
const withR = (t, p) => { const r = rOf(t, 1, p), r2 = rOf(t, 2, p); return { ...t, gross: r.gross, cost: r.cost, fin: r.fin, nights: r.nights, net: r.net, net2: r2.net }; };

// every day's baseline trade (side = slope sign) and whether that day is a signal day
export function dayTrades(bars, p = P) {
  const fit = lineFit(bars, p.n), A = atr(bars, p.atrN), out = [];
  for (let i = 0; i < bars.length; i++) {
    if (bars[i].time < p.warm || !fit[i]) continue;
    const side = Math.sign(fit[i].slope), t = tradeAt(bars, A, i, side, p);
    if (t) out.push({ ...withR(t, p), r2: fit[i].r2, sig: fit[i].r2 >= p.r2Min });
  }
  return out;
}
// one position at a time over the signal days (sides: 'both' | 'short')
export function oneAtATime(days, sides = 'both') {
  const out = []; let freeAt = -1;
  for (const d of days) {
    if (!d.sig || (sides === 'short' && d.side > 0)) continue;
    if (d.entryI <= freeAt) continue;
    out.push(d); freeAt = d.exitI;
  }
  return out;
}

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
export function mulberry32(a) { return () => { a |= 0; a = (a + 0x6D2B79F5) | 0; let t = Math.imul(a ^ (a >>> 15), 1 | a); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; }
function monthsOf(from, to) {
  const months = []; const d = new Date(from * 1000); let y = d.getUTCFullYear(), m = d.getUTCMonth(); const end = ym(to - 1);
  for (;;) { const s = `${y}-${String(m + 1).padStart(2, '0')}`; months.push(s); if (s >= end) break; m++; if (m > 11) { m = 0; y++; } }
  return months;
}
// month t over every calendar month of [from, to): values v summed by month of the item's time field
export function monthT(items, from, to, key = 'net', tf = 'exitT') {
  const months = monthsOf(from, to), sum = Object.fromEntries(months.map((s) => [s, 0]));
  for (const t of items) { const s = ym(t[tf]); if (s in sum) sum[s] += t[key]; }
  const v = months.map((s) => sum[s]), n = v.length, mean = v.reduce((a, b) => a + b, 0) / n;
  const sd = Math.sqrt(v.reduce((a, b) => a + (b - mean) ** 2, 0) / (n - 1));
  const t = sd > 0 ? mean / (sd / Math.sqrt(n)) : 0;
  return { months: n, t: +t.toFixed(3), p: +pTwo(t, n - 1).toFixed(5) };
}
// excess of each signal trade over the mean net (and net2) of the baseline trades entered in the same calendar month
export function excessOf(days) {
  const by = {};
  for (const d of days) { const s = ym(d.entryT); (by[s] ||= { n: 0, net: 0, net2: 0 }); by[s].n++; by[s].net += d.net; by[s].net2 += d.net2; }
  return days.filter((d) => d.sig).map((d) => { const b = by[ym(d.entryT)];
    return { ...d, ex: d.net - b.net / b.n, ex2: d.net2 - b.net2 / b.n }; });
}
const med = (a) => { const s = [...a].sort((x, y) => x - y); return s.length ? s[Math.floor(s.length / 2)] : 0; };
export function summary(trades, from, to, tf = 'exitT') {
  const n = trades.length, avg = (k) => (n ? trades.reduce((a, t) => a + t[k], 0) / n : 0);
  let eq = 0, hi = 0, dd = 0; for (const t of trades) { eq += t.net; hi = Math.max(hi, eq); dd = Math.min(dd, eq - hi); }
  const g = trades.reduce((a, t) => a + t.gross, 0), c = trades.reduce((a, t) => a + t.cost + t.fin, 0);
  return { n, win: n ? r4(trades.filter((t) => t.net > 0).length / n) : 0, gross: r4(avg('gross')), net: r4(avg('net')), net2: r4(avg('net2')),
    total: +trades.reduce((a, t) => a + t.net, 0).toFixed(2), maxDD: +dd.toFixed(2), stops: trades.filter((t) => t.why === 'stop').length,
    long: trades.filter((t) => t.side > 0).length, medStop: +med(trades.map((t) => t.dist)).toFixed(2),
    costShare: g > 0 ? r4(c / g) : null, ...monthT(trades, from, to, 'net', tf) };
}
export function exSummary(ex, from, to) {
  const n = ex.length, avg = (k) => (n ? ex.reduce((a, t) => a + t[k], 0) / n : 0), m = monthT(ex, from, to, 'ex', 'entryT');
  return { n, ex: r4(avg('ex')), ex2: r4(avg('ex2')), sigNet: r4(avg('net')), sigGross: r4(avg('gross')), ...m, t2: monthT(ex, from, to, 'ex2', 'entryT').t };
}
// T1 placebo: per calendar year, the same number of random days from that year's baseline days marked as signals
export function placeboT1(days, seed, from, to) {
  const rnd = mulberry32(seed), W = days.filter((d) => d.entryT >= from && d.entryT < to), byY = {};
  for (const d of W) (byY[ym(d.entryT).slice(0, 4)] ||= []).push(d);
  const fake = [];
  for (const L of Object.values(byY)) {
    const k = L.filter((d) => d.sig).length, idx = L.map((_, i) => i);
    for (let j = idx.length - 1; j > 0; j--) { const r = Math.floor(rnd() * (j + 1)); [idx[j], idx[r]] = [idx[r], idx[j]]; }
    const pick = new Set(idx.slice(0, k)); L.forEach((d, i) => fake.push({ ...d, sig: pick.has(i) }));
  }
  return monthT(excessOf(fake), from, to, 'ex', 'entryT').t;
}
// T2 / T3 placebo: same count and sides, random OOS days, same stop and hold; mean net R
export function placeboRule(bars, real, seed, from, p = P) {
  const A = atr(bars, p.atrN), rnd = mulberry32(seed), first = bars.findIndex((b) => b.time >= from), hi = bars.length - 2 - p.hold;
  let s = 0, n = 0;
  for (const rt of real) { const i = first - 1 + Math.floor(rnd() * (hi - first + 2)); const t = tradeAt(bars, A, i, rt.side, p); if (t) { s += rOf(t, 1, p).net; n++; } }
  return n ? s / n : 0;
}

export function study(bars, p = P) {
  const end = bars[bars.length - 1].time + 86400, days = dayTrades(bars, p), out = { tests: {} };
  const inW = (L, a, b) => L.filter((t) => t.entryT >= a && t.entryT < b);
  // baseline (every day, same side) for reference
  out.baseline = { IS: summary(inW(days, p.warm, p.isEnd), p.warm, p.isEnd, 'entryT'), OOS: summary(inW(days, p.isEnd, end), p.isEnd, end, 'entryT'),
    sigShare: { IS: r4(inW(days, p.warm, p.isEnd).filter((d) => d.sig).length / inW(days, p.warm, p.isEnd).length),
      OOS: r4(inW(days, p.isEnd, end).filter((d) => d.sig).length / inW(days, p.isEnd, end).length) } };
  // T1: excess computed within each window's own days
  const exIS = excessOf(inW(days, p.warm, p.isEnd)), exOOS = excessOf(inW(days, p.isEnd, end));
  const t1 = { ...TESTS.T1, IS: exSummary(exIS, p.warm, p.isEnd), OOS: exSummary(exOOS, p.isEnd, end),
    oosH1: exSummary(excessOf(inW(days, p.isEnd, p.half)), p.isEnd, p.half), oosH2: exSummary(excessOf(inW(days, p.half, end)), p.half, end),
    sigIS: summary(inW(days, p.warm, p.isEnd).filter((d) => d.sig), p.warm, p.isEnd, 'entryT'),
    sigOOS: summary(inW(days, p.isEnd, end).filter((d) => d.sig), p.isEnd, end, 'entryT') };
  const pl1 = []; for (let s = 1; s <= p.seeds; s++) pl1.push(placeboT1(days, s, p.isEnd, end));
  t1.placebo = { seeds: pl1, beaten: pl1.filter((x) => t1.OOS.t > x).length, median: med(pl1) };
  out.tests.T1 = t1;
  for (const [id, sides] of [['T2', 'both'], ['T3', 'short']]) {
    const tr = oneAtATime(days, sides), IS = inW(tr, p.warm, p.isEnd), OOS = inW(tr, p.isEnd, end);
    const o = summary(OOS, p.isEnd, end), pl = []; for (let s = 1; s <= p.seeds; s++) pl.push(r4(placeboRule(bars, OOS, s, p.isEnd, p)));
    out.tests[id] = { ...TESTS[id], IS: summary(IS, p.warm, p.isEnd), OOS: o, oosH1: summary(inW(tr, p.isEnd, p.half), p.isEnd, p.half),
      oosH2: summary(inW(tr, p.half, end), p.half, end), placebo: { seeds: pl, beaten: pl.filter((x) => o.net > x).length, median: med(pl) },
      trades: OOS.map((t) => [new Date(t.entryT * 1000).toISOString().slice(0, 10), t.side, +t.entry.toFixed(2), +t.dist.toFixed(2), +t.exit.toFixed(2), t.why, +t.net.toFixed(3)]) };
  }
  const ids = Object.keys(TESTS), adj = holm(ids.map((id) => out.tests[id].OOS.p));
  ids.forEach((id, i) => {
    const x = out.tests[id]; x.holmP = +adj[i].toFixed(5);
    const checks = id === 'T1'
      ? { monthT: x.OOS.t >= 2 && x.holmP < 0.05, isSign: x.IS.ex > 0, costs2x: out.tests.T2.OOS.net2 > 0, placebo: x.placebo.beaten >= 38, n: x.OOS.n >= 30 }
      : { oosNet: x.OOS.net > 0, monthT: x.OOS.t >= 2 && x.holmP < 0.05, isSign: x.IS.net > 0, costs2x: x.OOS.net2 > 0, placebo: x.placebo.beaten >= 38, n: x.OOS.n >= 30 };
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
    const res = { topic: 'gold-trend-r2', built: '2026-11-14', data: `council-data research/daily/xau.json (${f.src}, updated ${f.updated})`,
      verdict: r.pass ? 'PASS' : 'FAIL', ...r };
    fs.writeFileSync(path.join(here, 'result.json'), JSON.stringify(res, null, 1) + '\n');
    console.log('baseline', JSON.stringify(r.baseline));
    for (const [id, x] of Object.entries(r.tests)) { const { trades, placebo, ...rest } = x; console.log(id, JSON.stringify(rest), 'placebo', placebo.beaten, placebo.median); }
    console.log(r.window, 'verdict', res.verdict);
  } else console.log('usage: run.mjs fetch|full <dir>');
}
