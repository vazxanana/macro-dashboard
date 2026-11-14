// Gold's move that the dollar, Treasuries and US equities do not explain (PREREGISTRATION.md, pushed first).
//   node research/edge/gold-factor-residual/run.mjs fetch <dir>   copies four council-data daily files to <dir> (git show, no network)
//   node research/edge/gold-factor-residual/run.mjs full <dir>    runs the study and writes result.json next to this file
// A stand-alone rule: it does not read or change the gold book. Research only, nothing live.
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { execFileSync } from 'node:child_process';
import { nights, FIN, foldWeekend } from '../../../council/fills.mjs';

export const KEYS = ['xau', 'eurusd', 'usb10y', 'spx500'];
export const P = { W: 60, gap: 5, zMin: 2, k: 2, atrN: 14, cost: 0.60, seeds: 40,
  isFrom: Date.UTC(2007, 0, 1) / 1000, isEnd: Date.UTC(2017, 0, 1) / 1000, half: Date.UTC(2022, 0, 1) / 1000,
  oosEnd: Date.UTC(2026, 10, 1) / 1000 };
export const TESTS = {
  T1: { name: 'fade a 5-day residual, hold 10 days', dir: -1, L: 5, H: 10 },
  T2: { name: 'fade a 20-day residual, hold 20 days', dir: -1, L: 20, H: 20 },
  T3: { name: 'follow a 5-day residual, hold 10 days', dir: 1, L: 5, H: 10 },
};
const ym = (t) => new Date(t * 1000).toISOString().slice(0, 7);
const r4 = (x) => +x.toFixed(4);

// rows [t,o,h,l,c,v] -> folded weekday bars, complete days only
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
// joined days: gold bar index + the four closes on that day; returns vs the previous joined day
export function join(gold, factors) {
  const maps = factors.map((f) => new Map(f.map((b) => [b.time, b.close])));
  const J = [];
  gold.forEach((b, gi) => { const cs = maps.map((m) => m.get(b.time)); if (cs.every((c) => c > 0)) J.push({ gi, t: b.time, c: [b.close, ...cs] }); });
  for (let j = 0; j < J.length; j++) J[j].r = j ? J[j].c.map((c, q) => Math.log(c / J[j - 1].c[q])) : null;
  return J;
}
// ordinary least squares y = X b (X rows include the 1 for the intercept); returns { b, s } (s with n - p degrees of freedom)
export function ols(X, y) {
  const p = X[0].length, A = Array.from({ length: p }, () => new Array(p + 1).fill(0));
  for (let r = 0; r < X.length; r++) for (let i = 0; i < p; i++) { for (let j = 0; j < p; j++) A[i][j] += X[r][i] * X[r][j]; A[i][p] += X[r][i] * y[r]; }
  for (let c = 0; c < p; c++) {
    let piv = c; for (let r = c + 1; r < p; r++) if (Math.abs(A[r][c]) > Math.abs(A[piv][c])) piv = r;
    [A[c], A[piv]] = [A[piv], A[c]]; if (Math.abs(A[c][c]) < 1e-18) return null;
    for (let r = 0; r < p; r++) if (r !== c) { const f = A[r][c] / A[c][c]; for (let k = c; k <= p; k++) A[r][k] -= f * A[c][k]; }
  }
  const b = A.map((row, i) => row[p] / row[i]);
  let ss = 0; for (let r = 0; r < X.length; r++) { const e = y[r] - X[r].reduce((a, x, i) => a + x * b[i], 0); ss += e * e; }
  return { b, s: Math.sqrt(ss / (X.length - p)) };
}
const xrow = (r) => [1, r[1], r[2], r[3]];
// z of the last L joined days at joined index j (reads joined returns up to j only); null when not computable
export function zAt(J, j, L, p = P) {
  const fitEnd = j - L - p.gap, fitFrom = fitEnd - p.W + 1;
  if (fitFrom < 1) return null;
  const X = [], y = []; for (let q = fitFrom; q <= fitEnd; q++) { X.push(xrow(J[q].r)); y.push(J[q].r[0]); }
  const f = ols(X, y); if (!f || !(f.s > 0)) return null;
  let sum = 0; for (let q = j - L + 1; q <= j; q++) sum += J[q].r[0] - xrow(J[q].r).reduce((a, x, i) => a + x * f.b[i], 0);
  return sum / (f.s * Math.sqrt(L));
}
// sig[gi] = side to take at bars[gi+1].open (0 = none)
export function signals(bars, J, T, p = P) {
  const sig = new Array(bars.length).fill(0);
  for (let j = 0; j < J.length; j++) { const z = zAt(J, j, T.L, p); if (z == null) continue;
    if (z >= p.zMin) sig[J[j].gi] = T.dir; else if (z <= -p.zMin) sig[J[j].gi] = -T.dir; }
  return sig;
}
// one fixed-hold trade entered at bars[i].open; stop k x ATR of day i-1; exit at bars[i+H].open unless stopped first
export function trade(bars, A, i, side, H, k) {
  const a = A[i - 1]; if (!(a > 0) || i + H >= bars.length) return null;
  const entry = bars[i].open, dist = k * a, stop = entry - side * dist;
  let exit = bars[i + H].open, j = i + H, why = 'time', stopped = false;
  for (let q = i; q < i + H; q++) { const b = bars[q];
    if (side > 0 && b.low <= stop) { exit = Math.min(b.open, stop); j = q; stopped = true; break; }
    if (side < 0 && b.high >= stop) { exit = Math.max(b.open, stop); j = q; stopped = true; break; } }
  if (stopped) why = 'stop';
  return { side, entry, stop, dist, exit, entryI: i, exitI: j, entryT: bars[i].time,
    exitT: bars[j].time + (stopped && exit !== bars[j].open ? 43200 : 0), why, bars: j - i, k };
}
export function rOf(t, costMul = 1, p = P) {
  const gross = (t.exit - t.entry) * t.side / t.dist, cost = costMul * p.cost / t.dist;
  const nn = t.side > 0 ? nights(t.entryT, t.exitT) : 0;
  const fin = costMul * nn * (t.side > 0 ? FIN.xau.long : FIN.xau.short) * t.entry / t.dist;
  return { gross, cost, fin, nights: nn, net: gross - cost - fin };
}
const withR = (t, p) => { const r = rOf(t, 1, p), r2 = rOf(t, 2, p); return { ...t, gross: r.gross, cost: r.cost, fin: r.fin, nights: r.nights, net: r.net, net2: r2.net }; };
// one position at a time; entries only inside [from, to)
export function simulate(bars, sig, T, from, to, p = P) {
  const A = atr(bars, p.atrN), out = []; let free = 0;
  for (let i = 1; i < bars.length; i++) {
    const s = sig[i - 1]; if (!s || i < free || bars[i].time < from || bars[i].time >= to) continue;
    const t = trade(bars, A, i, s, T.H, p.k); if (!t) continue;
    out.push(withR(t, p)); free = t.exitI + (t.why === 'time' ? 0 : 1);
  }
  return out;
}
// same-side every-day baseline: mean net R (and n) of the trade entered at every open in [from, to)
export function baseline(bars, side, H, from, to, p = P) {
  const A = atr(bars, p.atrN); let s = 0, s2 = 0, n = 0;
  for (let i = 1; i < bars.length; i++) { if (bars[i].time < from || bars[i].time >= to) continue;
    const t = trade(bars, A, i, side, H, p.k); if (!t) continue; const r = rOf(t, 1, p), r2 = rOf(t, 2, p); s += r.net; s2 += r2.net; n++; }
  return { n, net: n ? s / n : 0, net2: n ? s2 / n : 0 };
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
// t on calendar-month sums (by exit month) over every month of [from, to)
export function monthT(trades, from, to, key = 'net') {
  const months = []; const d = new Date(from * 1000); let y = d.getUTCFullYear(), m = d.getUTCMonth();
  const end = ym(to - 1);
  for (;;) { const s = `${y}-${String(m + 1).padStart(2, '0')}`; months.push(s); if (s >= end) break; m++; if (m > 11) { m = 0; y++; } }
  const sum = Object.fromEntries(months.map((s) => [s, 0]));
  for (const t of trades) { const s = ym(Math.min(t.exitT, to - 1)); if (s in sum) sum[s] += t[key]; }
  const v = months.map((s) => sum[s]), n = v.length, mean = v.reduce((a, b) => a + b, 0) / n;
  const sd = Math.sqrt(v.reduce((a, b) => a + (b - mean) ** 2, 0) / (n - 1));
  const t = sd > 0 ? mean / (sd / Math.sqrt(n)) : 0;
  return { months: n, t: +t.toFixed(3), p: +pTwo(t, n - 1).toFixed(5) };
}
const median = (xs) => { const s = [...xs].sort((a, b) => a - b); return s.length ? s[Math.floor(s.length / 2)] : null; };
export function summary(trades, from, to) {
  const n = trades.length, avg = (k) => (n ? trades.reduce((a, t) => a + t[k], 0) / n : 0);
  let eq = 0, hi = 0, dd = 0; for (const t of trades) { eq += t.net; hi = Math.max(hi, eq); dd = Math.min(dd, eq - hi); }
  const g = trades.reduce((a, t) => a + t.gross, 0), c = trades.reduce((a, t) => a + t.cost + t.fin, 0);
  const mt = monthT(trades, from, to, 'net'), mx = monthT(trades, from, to, 'excess');
  return { n, buys: trades.filter((t) => t.side > 0).length, win: n ? r4(trades.filter((t) => t.net > 0).length / n) : 0,
    gross: r4(avg('gross')), net: r4(avg('net')), net2: r4(avg('net2')), excess: r4(avg('excess')),
    total: +trades.reduce((a, t) => a + t.net, 0).toFixed(2), maxDD: +dd.toFixed(2), stops: trades.filter((t) => t.why === 'stop').length,
    medianStop: n ? +median(trades.map((t) => t.dist)).toFixed(2) : null, costShare: Math.abs(g) > 1e-9 ? r4(c / Math.abs(g)) : null,
    costR: r4(n ? c / n : 0), months: mt.months, t: mt.t, p: mt.p, tExcess: mx.t, pExcess: mx.p };
}
export function mulberry32(a) { return () => { a |= 0; a = (a + 0x6D2B79F5) | 0; let t = Math.imul(a ^ (a >>> 15), 1 | a); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; }
// placebo: same count, sides, stop multiple and hold, random entry days in [from, to); mean net R a trade
export function placebo(bars, real, H, seed, from, to, p = P) {
  const A = atr(bars, p.atrN), rnd = mulberry32(seed), idx = [];
  for (let i = 1; i < bars.length; i++) if (bars[i].time >= from && bars[i].time < to && i + H < bars.length) idx.push(i);
  let sum = 0, n = 0;
  for (const rt of real) { const t = trade(bars, A, idx[Math.floor(rnd() * idx.length)], rt.side, H, p.k); if (!t) continue; sum += rOf(t, 1, p).net; n++; }
  return n ? sum / n : 0;
}

export function study(bars, J, p = P) {
  const out = { tests: {} }, ps = [];
  for (const [id, T] of Object.entries(TESTS)) {
    const sig = signals(bars, J, T, p), res = {};
    for (const [w, from, to] of [['IS', p.isFrom, p.isEnd], ['OOS', p.isEnd, p.oosEnd]]) {
      const base = { buy: baseline(bars, 1, T.H, from, to, p), sell: baseline(bars, -1, T.H, from, to, p) };
      const tr = simulate(bars, sig, T, from, to, p).map((t) => ({ ...t, excess: t.net - (t.side > 0 ? base.buy.net : base.sell.net) }));
      res[w] = { tr, base, sum: summary(tr, from, to) };
    }
    const O = res.OOS.tr, h1 = O.filter((t) => t.entryT < p.half), h2 = O.filter((t) => t.entryT >= p.half);
    const pl = []; for (let s = 1; s <= p.seeds; s++) pl.push(r4(placebo(bars, O, T.H, s, p.isEnd, p.oosEnd, p)));
    const bOut = (b) => ({ buy: { n: b.buy.n, net: r4(b.buy.net), net2: r4(b.buy.net2) }, sell: { n: b.sell.n, net: r4(b.sell.net), net2: r4(b.sell.net2) } });
    const bySide = (L, from, to) => ({ buy: summary(L.filter((t) => t.side > 0), from, to), sell: summary(L.filter((t) => t.side < 0), from, to) });
    out.tests[id] = { ...T, IS: res.IS.sum, OOS: res.OOS.sum, oosH1: summary(h1, p.isEnd, p.half), oosH2: summary(h2, p.half, p.oosEnd),
      sides: { IS: bySide(res.IS.tr, p.isFrom, p.isEnd), OOS: bySide(O, p.isEnd, p.oosEnd) },
      baseline: { IS: bOut(res.IS.base), OOS: bOut(res.OOS.base) },
      placebo: { seeds: pl, beaten: pl.filter((x) => res.OOS.sum.net > x).length, median: r4(median(pl)) },
      trades: O.map((t) => [new Date(t.entryT * 1000).toISOString().slice(0, 10), t.side, +t.entry.toFixed(2), +t.dist.toFixed(2), +t.exit.toFixed(2), t.why, +t.net.toFixed(3)]) };
    ps.push(res.OOS.sum.pExcess);
  }
  const adj = holm(ps);
  Object.keys(TESTS).forEach((id, i) => {
    const x = out.tests[id]; x.holmP = +adj[i].toFixed(5);
    const checks = { monthT: x.OOS.tExcess >= 2 && x.holmP < 0.05, isSign: x.IS.excess > 0, costs2x: x.OOS.net2 > 0,
      placebo: x.placebo.beaten >= 38, n: x.OOS.n >= 30 && x.OOS.medianStop >= 10 };
    x.checks = checks; x.pass = Object.values(checks).every(Boolean);
  });
  out.window = { is: '2007-01-01..2016-12-31', oos: '2017-01-01..2026-10-31', candles: bars.length, joined: J.length };
  out.pass = out.tests.T1.pass;
  return out;
}

const here = path.dirname(fileURLToPath(import.meta.url));
if (process.argv[1] && fileURLToPath(import.meta.url) === path.resolve(process.argv[1])) {
  const [cmd, dir] = process.argv.slice(2);
  if (cmd === 'fetch') {
    fs.mkdirSync(dir, { recursive: true });
    for (const k of KEYS) fs.writeFileSync(path.join(dir, `${k}.json`), execFileSync('git', ['show', `origin/council-data:research/daily/${k}.json`], { maxBuffer: 1 << 26 }));
    console.log('wrote', KEYS.length, 'files to', dir);
  } else if (cmd === 'full') {
    const F = KEYS.map((k) => JSON.parse(fs.readFileSync(path.join(dir, `${k}.json`), 'utf8')));
    const now = Date.parse(F[0].updated) / 1000 + 86400, B = F.map((f) => barsOf(f.rows, now));
    const J = join(B[0], B.slice(1)), r = study(B[0], J);
    const res = { topic: 'gold-factor-residual', built: '2026-11-14',
      data: `council-data research/daily/{${KEYS.join(',')}}.json (${F[0].src}, updated ${F[0].updated})`,
      verdict: r.pass ? 'PASS' : 'FAIL', ...r };
    fs.writeFileSync(path.join(here, 'result.json'), JSON.stringify(res, null, 1) + '\n');
    for (const [id, x] of Object.entries(r.tests)) console.log(id, x.name, '\nIS', JSON.stringify(x.IS), '\nOOS', JSON.stringify(x.OOS),
      '\nH1', x.oosH1.net, x.oosH1.excess, 'H2', x.oosH2.net, x.oosH2.excess, 'holm', x.holmP, 'placebo', x.placebo.beaten, 'med', x.placebo.median,
      '\nbase', JSON.stringify(x.baseline), '\nsides', JSON.stringify({ IS: [x.sides.IS.buy.n, x.sides.IS.buy.excess, x.sides.IS.sell.n, x.sides.IS.sell.excess], OOS: [x.sides.OOS.buy.n, x.sides.OOS.buy.excess, x.sides.OOS.sell.n, x.sides.OOS.sell.excess] }),
      'pass', x.pass, JSON.stringify(x.checks));
    console.log(r.window, 'verdict', res.verdict);
  } else console.log('usage: run.mjs fetch|full <dir>');
}
