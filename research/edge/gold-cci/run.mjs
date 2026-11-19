// The Commodity Channel Index (Lambert 1980) on gold's daily chart (PREREGISTRATION.md, pushed first).
//   node research/edge/gold-cci/run.mjs fetch <dir>   copies council-data research/daily/xau.json to <dir> (git show, no network)
//   node research/edge/gold-cci/run.mjs full <dir>    runs the study and writes result.json next to this file
// A stand-alone rule: it does not read or change the gold book. Research only, nothing live.
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { execFileSync } from 'node:child_process';
import { nights, FIN, foldWeekend } from '../../../council/fills.mjs';

export const P = { n: 20, lvl: 100, atrN: 14, k: 2, maxHold: 30, cost: 0.60, warm: Date.UTC(2007, 0, 1) / 1000,
  isEnd: Date.UTC(2017, 0, 1) / 1000, half: Date.UTC(2022, 0, 1) / 1000, seeds: 40 };
export const TESTS = {
  T1: { name: 'Lambert trend, both sides (primary)', mode: 'trend', sides: [1, -1] },
  T2: { name: 'Lambert trend, long only', mode: 'trend', sides: [1] },
  T3: { name: 'Retail fade, both sides', mode: 'fade', sides: [1, -1] },
};
const ym = (t) => new Date(t * 1000).toISOString().slice(0, 7);

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
// CCI(n) of day i: reads days i-n+1 .. i only
export function cci(bars, n = P.n) {
  const tp = bars.map((b) => (b.high + b.low + b.close) / 3), out = new Array(bars.length).fill(null);
  for (let i = n - 1; i < bars.length; i++) {
    let m = 0; for (let k = i - n + 1; k <= i; k++) m += tp[k]; m /= n;
    let md = 0; for (let k = i - n + 1; k <= i; k++) md += Math.abs(tp[k] - m); md /= n;
    out[i] = md > 0 ? (tp[i] - m) / (0.015 * md) : 0;
  }
  return out;
}
// entry signal on the close of day i: +1 buy, -1 sell, 0 none
export function entrySig(C, i, mode, L = P.lvl) {
  if (i < 1 || C[i] == null || C[i - 1] == null) return 0;
  const a = C[i - 1], b = C[i];
  if (mode === 'trend') { if (a <= L && b > L) return 1; if (a >= -L && b < -L) return -1; return 0; }
  if (a > L && b <= L) return -1; if (a < -L && b >= -L) return 1; return 0;
}
// exit signal for an open trade of `side` on the close of day i
export function exitSig(C, i, side, mode) {
  if (C[i] == null) return false;
  if (mode === 'trend') return side > 0 ? C[i] < 0 : C[i] > 0;
  return side > 0 ? C[i] > 0 : C[i] < 0;
}

// trades; a decision read on day i-1's close is filled at day i's open; every trade has a 2 x ATR(14) stop
export function simulate(bars, T, p = P) {
  const C = cci(bars, p.n), A = atr(bars, p.atrN), trades = [];
  let pos = null;
  const close = (exit, i, why, stopped) => {
    trades.push({ ...pos, exit, exitI: i, exitT: bars[i].time + (stopped && exit !== bars[i].open ? 43200 : 0), why, bars: i - pos.entryI });
    pos = null;
  };
  for (let i = 2; i < bars.length; i++) {
    const j = i - 1, live = bars[j].time >= p.warm;
    if (pos) {
      if (exitSig(C, j, pos.side, T.mode)) close(bars[i].open, i, 'cci', false);
      else if (i - pos.entryI >= p.maxHold) close(bars[i].open, i, 'time', false);
    }
    const s = live ? entrySig(C, j, T.mode, p.lvl) : 0;
    if (s && T.sides.includes(s)) {
      if (pos && pos.side !== s) close(bars[i].open, i, 'reverse', false);
      const a = A[j];
      if (!pos && a > 0) { const entry = bars[i].open, dist = p.k * a; pos = { side: s, entry, stop: entry - s * dist, dist, entryI: i, entryT: bars[i].time, k: p.k }; }
    }
    if (pos) {
      const b = bars[i];
      if (pos.side > 0 && b.low <= pos.stop) close(Math.min(b.open, pos.stop), i, 'stop', true);
      else if (pos.side < 0 && b.high >= pos.stop) close(Math.max(b.open, pos.stop), i, 'stop', true);
    }
  }
  if (pos) { const i = bars.length - 1; trades.push({ ...pos, exit: bars[i].close, exitI: i, exitT: bars[i].time + 79200, why: 'open', bars: i - pos.entryI }); }
  return trades;
}
export function rOf(t, costMul = 1, p = P) {
  const gross = (t.exit - t.entry) * t.side / t.dist, cost = costMul * p.cost / t.dist;
  const nn = t.side > 0 ? nights(t.entryT, t.exitT) : 0;
  const fin = costMul * nn * (t.side > 0 ? FIN.xau.long : FIN.xau.short) * t.entry / t.dist;
  return { gross, cost, fin, nights: nn, net: gross - cost - fin };
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
// every calendar month from `from` to `to` (unix), sums of net by exit month
export function monthT(trades, from, to, key = 'net') {
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
const r4 = (x) => +x.toFixed(4);
const med = (xs) => { const s = [...xs].sort((a, b) => a - b); return s.length ? s[Math.floor(s.length / 2)] : null; };
export function summary(trades, from, to) {
  const n = trades.length, avg = (k) => (n ? trades.reduce((a, t) => a + t[k], 0) / n : 0);
  let eq = 0, hi = 0, dd = 0; for (const t of trades) { eq += t.net; hi = Math.max(hi, eq); dd = Math.min(dd, eq - hi); }
  return { n, long: trades.filter((t) => t.side > 0).length, win: n ? r4(trades.filter((t) => t.net > 0).length / n) : 0,
    gross: r4(avg('gross')), net: r4(avg('net')), net2: r4(avg('net2')),
    total: +trades.reduce((a, t) => a + t.net, 0).toFixed(2), maxDD: +dd.toFixed(2), stops: trades.filter((t) => t.why === 'stop').length,
    medStop: n ? +med(trades.map((t) => t.dist)).toFixed(2) : null, medBars: n ? med(trades.map((t) => t.bars)) : null, ...monthT(trades, from, to) };
}
export function mulberry32(a) { return () => { a |= 0; a = (a + 0x6D2B79F5) | 0; let t = Math.imul(a ^ (a >>> 15), 1 | a); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; }
// placebo = unconditional same-side baseline: same count, sides, holding lengths and 2 ATR stops, random OOS entry days
export function placebo(bars, real, seed, from, p = P) {
  const A = atr(bars, p.atrN), rnd = mulberry32(seed), first = bars.findIndex((b) => b.time >= from), last = bars.length - 1;
  let sum = 0, n = 0;
  for (const rt of real) {
    const len = Math.max(1, rt.bars), hi = last - len; if (hi <= first) continue;
    const i = first + Math.floor(rnd() * (hi - first + 1)), a = A[i - 1]; if (!(a > 0)) continue;
    const entry = bars[i].open, dist = p.k * a, stop = entry - rt.side * dist;
    let exit = bars[i + len].open, j = i + len, stopped = false;
    for (let q = i; q < i + len; q++) { const b = bars[q];
      if (rt.side > 0 && b.low <= stop) { exit = Math.min(b.open, stop); j = q; stopped = true; break; }
      if (rt.side < 0 && b.high >= stop) { exit = Math.max(b.open, stop); j = q; stopped = true; break; } }
    sum += rOf({ side: rt.side, entry, dist, entryT: bars[i].time, exitT: bars[j].time + (stopped && exit !== bars[j].open ? 43200 : 0), exit }).net; n++;
  }
  return n ? sum / n : 0;
}

export function study(bars, p = P) {
  const end = bars[bars.length - 1].time + 86400, out = { tests: {} }, ps = [];
  for (const [id, T] of Object.entries(TESTS)) {
    const trades = simulate(bars, T, p).map((t) => { const r = rOf(t, 1, p), r2 = rOf(t, 2, p);
      return { ...t, gross: r.gross, cost: r.cost, fin: r.fin, nights: r.nights, net: r.net, net2: r2.net }; });
    const IS = trades.filter((t) => t.entryT >= p.warm && t.entryT < p.isEnd), OOS = trades.filter((t) => t.entryT >= p.isEnd);
    const h1 = OOS.filter((t) => t.entryT < p.half), h2 = OOS.filter((t) => t.entryT >= p.half);
    const pl = []; for (let s = 1; s <= p.seeds; s++) pl.push(r4(placebo(bars, OOS, s, p.isEnd, p)));
    const o = summary(OOS, p.isEnd, end), sum = (L, k) => L.reduce((a, t) => a + t[k], 0);
    const g = sum(OOS, 'gross'), costShare = g > 0 ? +((sum(OOS, 'cost') + sum(OOS, 'fin')) / g).toFixed(3) : null;
    out.tests[id] = { ...T, IS: summary(IS, p.warm, p.isEnd), OOS: o, oosH1: summary(h1, p.isEnd, p.half), oosH2: summary(h2, p.half, end),
      bySide: { OOSlong: summary(OOS.filter((t) => t.side > 0), p.isEnd, end).net, OOSshort: summary(OOS.filter((t) => t.side < 0), p.isEnd, end).net },
      costR: { cost: r4(sum(OOS, 'cost') / (o.n || 1)), fin: r4(sum(OOS, 'fin') / (o.n || 1)), share: costShare },
      placebo: { seeds: pl, beaten: pl.filter((x) => o.net > x).length, median: r4(med(pl)) },
      openAtEnd: trades.filter((t) => t.why === 'open').length,
      exits: Object.fromEntries(['cci', 'time', 'stop', 'reverse', 'open'].map((w) => [w, OOS.filter((t) => t.why === w).length])),
      trades: OOS.map((t) => [new Date(t.entryT * 1000).toISOString().slice(0, 10), t.side, +t.entry.toFixed(2), +t.dist.toFixed(2), +t.exit.toFixed(2), t.why, +t.net.toFixed(3)]) };
    ps.push(o.p);
  }
  const adj = holm(ps);
  Object.keys(TESTS).forEach((id, i) => {
    const x = out.tests[id]; x.holmP = +adj[i].toFixed(5);
    const checks = { oosNetT: x.OOS.net > 0 && x.OOS.t >= 2 && x.holmP < 0.05, signs: x.IS.net > 0 && x.oosH1.net > 0 && x.oosH2.net > 0,
      costs2x: x.OOS.net2 > 0, placebo: x.placebo.beaten >= 38, nStop: x.OOS.n >= 30 && x.OOS.medStop >= 10 };
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
    const res = { topic: 'gold-cci', built: '2026-11-14', data: `council-data research/daily/xau.json (${f.src}, updated ${f.updated})`,
      verdict: r.pass ? 'PASS' : 'FAIL', ...r };
    fs.writeFileSync(path.join(here, 'result.json'), JSON.stringify(res, null, 1) + '\n');
    for (const [id, x] of Object.entries(r.tests)) console.log(id, x.name, '\nIS', JSON.stringify(x.IS), '\nOOS', JSON.stringify(x.OOS), '\nH1', x.oosH1.net, x.oosH1.n, 'H2', x.oosH2.net, x.oosH2.n,
      'holm', x.holmP, 'placebo', x.placebo.beaten, 'med', x.placebo.median, JSON.stringify(x.bySide), JSON.stringify(x.costR), JSON.stringify(x.exits), 'pass', x.pass, JSON.stringify(x.checks));
    console.log(r.window, 'verdict', res.verdict);
  } else console.log('usage: run.mjs fetch|full <dir>');
}
