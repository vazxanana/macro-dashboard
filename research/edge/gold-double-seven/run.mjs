// The "double seven" pullback buy on gold's daily chart, judged against gold's own drift (PREREGISTRATION.md, pushed first).
//   node research/edge/gold-double-seven/run.mjs fetch <dir>   copies council-data research/daily/xau.json to <dir> (git show, no network)
//   node research/edge/gold-double-seven/run.mjs full <dir>    runs the study and writes result.json next to this file
// A stand-alone rule: it does not read or change the gold book. Research only, nothing live.
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { execFileSync } from 'node:child_process';
import { nights, FIN, foldWeekend } from '../../../council/fills.mjs';

export const P = { look: 7, sma: 200, atrN: 14, k: 2, maxH: 15, cost: 0.60, warm: Date.UTC(2007, 0, 1) / 1000,
  isEnd: Date.UTC(2017, 0, 1) / 1000, half: Date.UTC(2022, 0, 1) / 1000, seeds: 40, minN: 100 };
// filter: +1 close above SMA200, -1 below, 0 none
export const TESTS = {
  T1: { name: 'Low-7 buy above the 200-day average (primary)', trig: -1, side: 1, filter: 1 },
  T2: { name: 'High-7 sell below the 200-day average', trig: 1, side: -1, filter: -1 },
  T3: { name: 'Low-7 buy, no average filter', trig: -1, side: 1, filter: 0 },
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
export function sma(bars, n = P.sma) {
  const out = new Array(bars.length).fill(null); let s = 0;
  for (let i = 0; i < bars.length; i++) { s += bars[i].close; if (i >= n) s -= bars[i - n].close; if (i >= n - 1) out[i] = s / n; }
  return out;
}
// +1 = close of day i is higher than every close of the look-1 days before it, -1 = lower than every one, 0 otherwise.
export function ext7(bars, i, look = P.look) {
  if (i < look - 1) return 0;
  let hi = true, lo = true;
  for (let k = i - look + 1; k < i; k++) { if (bars[i].close <= bars[k].close) hi = false; if (bars[i].close >= bars[k].close) lo = false; }
  return hi ? 1 : lo ? -1 : 0;
}
// one trade after the close of day i: enter at open i+1, stop k x ATR(i), out at the open after the first opposite
// seven-day extreme close (from the entry day on), else at the open of e+maxH. null when the candles end first.
export function trade(bars, A, i, side, p = P) {
  const e = i + 1, a = A[i];
  if (e >= bars.length || !(a > 0)) return null;
  const entry = bars[e].open, dist = p.k * a, stop = entry - side * dist;
  for (let q = e; q < e + p.maxH; q++) {
    if (q >= bars.length) return null;
    const b = bars[q];
    if (side > 0 && b.low <= stop) return fin({ i, side, entry, dist, exit: Math.min(b.open, stop), entryT: bars[e].time, exitT: b.time + (b.open <= stop ? 0 : 43200), exitIdx: q, why: 'stop' }, p);
    if (side < 0 && b.high >= stop) return fin({ i, side, entry, dist, exit: Math.max(b.open, stop), entryT: bars[e].time, exitT: b.time + (b.open >= stop ? 0 : 43200), exitIdx: q, why: 'stop' }, p);
    if (ext7(bars, q, p.look) === side) {
      if (q + 1 >= bars.length) return null;
      return fin({ i, side, entry, dist, exit: bars[q + 1].open, entryT: bars[e].time, exitT: bars[q + 1].time, exitIdx: q + 1, why: 'exit7' }, p);
    }
  }
  const x = e + p.maxH; if (x >= bars.length) return null;
  return fin({ i, side, entry, dist, exit: bars[x].open, entryT: bars[e].time, exitT: bars[x].time, exitIdx: x, why: 'time' }, p);
}
function fin(t, p) { return { ...t, ...rOf(t, p) }; }
export function rOf(t, p = P) {
  const gross = (t.exit - t.entry) * t.side / t.dist;
  const nn = t.side > 0 ? nights(t.entryT, t.exitT) : 0;
  const finR = nn * (t.side > 0 ? FIN.xau.long : FIN.xau.short) * t.entry / t.dist, costR = p.cost / t.dist;
  return { gross, net: gross - costR - finR, net2: gross - 2 * costR - 2 * finR, nights: nn };
}
// is day i eligible for the test's filter? (needs the average)
export function eligible(bars, S, i, filter) {
  if (filter === 0) return true;
  if (S[i] == null) return false;
  return filter > 0 ? bars[i].close > S[i] : bars[i].close < S[i];
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
// values summed by the calendar month of entry over every month from..to (empty month = 0)
export function monthT(items, from, to, val) {
  const months = []; const d = new Date(from * 1000); let y = d.getUTCFullYear(), m = d.getUTCMonth();
  const end = ym(to - 1);
  for (;;) { const s = `${y}-${String(m + 1).padStart(2, '0')}`; months.push(s); if (s >= end) break; m++; if (m > 11) { m = 0; y++; } }
  const sum = Object.fromEntries(months.map((s) => [s, 0]));
  for (const t of items) { const s = ym(t.entryT); if (s in sum) sum[s] += val(t); }
  const v = months.map((s) => sum[s]), n = v.length, mean = v.reduce((a, b) => a + b, 0) / n;
  const sd = Math.sqrt(v.reduce((a, b) => a + (b - mean) ** 2, 0) / (n - 1));
  const t = sd > 0 ? mean / (sd / Math.sqrt(n)) : 0;
  return { months: n, t: +t.toFixed(3), p: +pTwo(t, n - 1).toFixed(5) };
}
const mean = (L, k) => (L.length ? L.reduce((a, t) => a + t[k], 0) / L.length : 0);
export function mulberry32(a) { return () => { a |= 0; a = (a + 0x6D2B79F5) | 0; let t = Math.imul(a ^ (a >>> 15), 1 | a); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; }

export function windowStats(sigT, baseT, from, to) {
  const S = sigT.filter((t) => t.entryT >= from && t.entryT < to), B = baseT.filter((t) => t.entryT >= from && t.entryT < to);
  const bNet = mean(B, 'net'), bNet2 = mean(B, 'net2');
  const ex = monthT(S, from, to, (t) => t.net - bNet), plain = monthT(S, from, to, (t) => t.net);
  return { n: S.length, win: S.length ? r4(S.filter((t) => t.net > 0).length / S.length) : 0, gross: r4(mean(S, 'gross')), net: r4(mean(S, 'net')),
    baseN: B.length, baseGross: r4(mean(B, 'gross')), baseNet: r4(bNet), excess: r4(mean(S, 'net') - bNet), excess2: r4(mean(S, 'net2') - bNet2),
    stops: S.filter((t) => t.why === 'stop').length, timeOuts: S.filter((t) => t.why === 'time').length, t: ex.t, p: ex.p, months: ex.months, plainT: plain.t };
}

// signal and baseline trades of one test
export function streams(bars, T, p = P) {
  const A = atr(bars, p.atrN), S = sma(bars, p.sma), base = [], sig = [];
  let busyUntil = -1; // index of the open at which the stream's last trade exited
  for (let i = 0; i < bars.length; i++) {
    if (bars[i + 1] == null || bars[i + 1].time < p.warm) continue;
    if (!eligible(bars, S, i, T.filter)) continue;
    const t = trade(bars, A, i, T.side, p); if (!t) continue;
    base.push(t);
    if (ext7(bars, i, p.look) === T.trig && i + 1 >= busyUntil) { sig.push(t); busyUntil = t.why === 'stop' ? t.exitIdx + 1 : t.exitIdx; }
  }
  return { base, sig };
}

export function study(bars, p = P) {
  const last = bars[bars.length - 1].time, end = last + 86400;
  const out = { tests: {} }, ps = [];
  for (const [id, T] of Object.entries(TESTS)) {
    const { base, sig } = streams(bars, T, p);
    const IS = windowStats(sig, base, p.warm, p.isEnd), OOS = windowStats(sig, base, p.isEnd, end);
    const h1 = windowStats(sig, base, p.isEnd, p.half), h2 = windowStats(sig, base, p.half, end);
    const pool = base.filter((t) => t.entryT >= p.isEnd), pl = [];
    for (let s = 1; s <= p.seeds; s++) { const rnd = mulberry32(s); let sum = 0;
      for (let k = 0; k < OOS.n; k++) sum += pool[Math.floor(rnd() * pool.length)].net;
      pl.push(r4(OOS.n ? sum / OOS.n - OOS.baseNet : 0)); }
    out.tests[id] = { ...T, IS, OOS, oosH1: h1, oosH2: h2,
      placebo: { seeds: pl, beaten: pl.filter((x) => OOS.excess > x).length, median: r4([...pl].sort((a, b) => a - b)[Math.floor(pl.length / 2)]) },
      trades: sig.filter((t) => t.entryT >= p.isEnd).map((t) => [new Date(t.entryT * 1000).toISOString().slice(0, 10), +t.entry.toFixed(2), +t.dist.toFixed(2), +t.exit.toFixed(2), t.why, +t.net.toFixed(3)]) };
    ps.push(OOS.p);
  }
  const adj = holm(ps);
  Object.keys(TESTS).forEach((id, i) => {
    const x = out.tests[id]; x.holmP = +adj[i].toFixed(5);
    x.checks = { monthT: x.OOS.t >= 2 && x.holmP < 0.05, isSign: x.IS.excess > 0, costs2x: x.OOS.excess2 > 0,
      placebo: x.placebo.beaten >= 38, n: x.IS.n >= p.minN && x.OOS.n >= p.minN };
    x.pass = Object.values(x.checks).every(Boolean);
  });
  out.window = { is: '2007-01-01..2016-12-31', oos: `2017-01-01..${new Date(last * 1000).toISOString().slice(0, 10)}`, candles: bars.length };
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
    const bars = barsOf(f.rows, Date.parse(f.updated) / 1000);
    const r = study(bars);
    const res = { topic: 'gold-double-seven', built: '2026-11-14', data: `council-data research/daily/xau.json (${f.src}, updated ${f.updated})`,
      verdict: r.pass ? 'PASS' : 'FAIL', ...r };
    fs.writeFileSync(path.join(here, 'result.json'), JSON.stringify(res, null, 1) + '\n');
    for (const [id, x] of Object.entries(r.tests)) console.log(id, x.name, '\nIS', JSON.stringify(x.IS), '\nOOS', JSON.stringify(x.OOS),
      '\nH1', x.oosH1.excess, x.oosH1.n, x.oosH1.t, 'H2', x.oosH2.excess, x.oosH2.n, x.oosH2.t, 'holm', x.holmP, 'placebo', x.placebo.beaten, 'med', x.placebo.median, 'pass', x.pass, JSON.stringify(x.checks));
    console.log(r.window, 'verdict', res.verdict);
  } else console.log('usage: run.mjs fetch|full <dir>');
}
