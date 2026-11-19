// Gold against the S&P 500: 3-month relative strength as a gold timing rule (pre-registered, PREREGISTRATION.md).
// Usage: node research/edge/gold-spx-rs/run.mjs <dir with xau.json and spx500.json from council-data research/daily/>
// The pure pieces are exported for tests/gold-spx-rs.test.mjs; the run writes result.json next to this file.
import { readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { nights, FIN, foldWeekend } from '../../../council/fills.mjs';

export const P = { look: 3, atrN: 20, stopK: 3, cost: 0.60, fin: FIN.xau.long, isFrom: '2007-01', isTo: '2016-12', oosFrom: '2017-01', oosTo: '2026-10', seeds: 40 };

export const ym = (t) => new Date(t * 1000).toISOString().slice(0, 7);
const mAdd = (m, k) => { let [y, mo] = m.split('-').map(Number); mo += k; while (mo < 1) { mo += 12; y--; } while (mo > 12) { mo -= 12; y++; } return `${y}-${String(mo).padStart(2, '0')}`; };
export { mAdd };

export const toBars = (rows) => foldWeekend(rows.map(([t, o, h, l, c]) => ({ time: t, open: o, high: h, low: l, close: c })));

// month -> index of its last weekday candle
export function monthEnds(bars) {
  const e = new Map();
  bars.forEach((b, i) => e.set(ym(b.time), i));
  return e;
}

export function atr(bars, i, n = P.atrN) {
  if (i < n) return null;
  let s = 0;
  for (let k = i - n + 1; k <= i; k++) s += Math.max(bars[k].high - bars[k].low, Math.abs(bars[k].high - bars[k - 1].close), Math.abs(bars[k].low - bars[k - 1].close));
  return s / n;
}

// signal at gold's month end of month m: RS, gold's own 3-month return; only closes at or before that month end are read
export function signalAt(g, gE, s, sE, m, look = P.look) {
  const ig = gE.get(m), ig0 = gE.get(mAdd(m, -look)), is = sE.get(m), is0 = sE.get(mAdd(m, -look));
  if (ig == null || ig0 == null || is == null || is0 == null) return null;
  if (s[is].time > g[ig].time) return null;   // never read a later close
  const gr = Math.log(g[ig].close / g[ig0].close), sr = Math.log(s[is].close / s[is0].close);
  return { rs: gr - sr, gr, sr, i: ig };
}

// one holding month: entry at the open after month end index i, exit at the open after the next month end, fixed 3 x ATR stop
export function trade(g, gE, m, side, opt = {}) {
  const costX = opt.costX ?? 1, i = gE.get(m), j = gE.get(mAdd(m, 1));
  if (i == null || j == null || j + 1 >= g.length || i + 1 > j) return null;
  const a = atr(g, i); if (!a) return null;
  const dir = side === 'buy' ? 1 : -1, r0 = P.stopK * a, e = g[i + 1].open, stop = e - dir * r0;
  let exit = g[j + 1].open, closed = g[j + 1].time, how = 'month';
  for (let k = i + 1; k <= j; k++) {
    const b = g[k];
    if (k > i + 1 && (dir > 0 ? b.open <= stop : b.open >= stop)) { exit = b.open; closed = b.time + 22 * 3600; how = 'stop'; break; }
    if (dir > 0 ? b.low <= stop : b.high >= stop) { exit = stop; closed = b.time + 22 * 3600; how = 'stop'; break; }
  }
  const gross = dir * (exit - e) / r0;
  const nn = dir > 0 ? nights(g[i + 1].time, closed) : 0;
  const fin = dir > 0 ? nn * P.fin * e / r0 : 0, spread = P.cost / r0;
  return { m: mAdd(m, 1), side, entry: e, stop, r0, exit, how, gross, spread, fin, nights: nn, net: gross - costX * (spread + fin) };
}

export function tstat(xs) {
  const n = xs.length; if (n < 2) return { n, mean: n ? xs[0] : 0, t: 0, sd: 0 };
  const mean = xs.reduce((a, b) => a + b, 0) / n, sd = Math.sqrt(xs.reduce((a, b) => a + (b - mean) ** 2, 0) / (n - 1));
  return { n, mean, sd, t: sd > 0 ? mean / (sd / Math.sqrt(n)) : 0 };
}
export function welch(a, b) {
  const A = tstat(a), B = tstat(b), se = Math.sqrt(A.sd ** 2 / A.n + B.sd ** 2 / B.n);
  const df = (A.sd ** 2 / A.n + B.sd ** 2 / B.n) ** 2 / ((A.sd ** 2 / A.n) ** 2 / (A.n - 1) + (B.sd ** 2 / B.n) ** 2 / (B.n - 1));
  return { nA: A.n, nB: B.n, meanA: A.mean, meanB: B.mean, diff: A.mean - B.mean, t: se > 0 ? (A.mean - B.mean) / se : 0, df };
}
// regularized incomplete beta (continued fraction), for Student's t p-values
function betacf(a, b, x) {
  let qab = a + b, qap = a + 1, qam = a - 1, c = 1, d = 1 - qab * x / qap; if (Math.abs(d) < 1e-30) d = 1e-30; d = 1 / d; let h = d;
  for (let m = 1; m <= 300; m++) {
    const m2 = 2 * m; let aa = m * (b - m) * x / ((qam + m2) * (a + m2));
    d = 1 + aa * d; if (Math.abs(d) < 1e-30) d = 1e-30; c = 1 + aa / c; if (Math.abs(c) < 1e-30) c = 1e-30; d = 1 / d; h *= d * c;
    aa = -(a + m) * (qab + m) * x / ((a + m2) * (qap + m2));
    d = 1 + aa * d; if (Math.abs(d) < 1e-30) d = 1e-30; c = 1 + aa / c; if (Math.abs(c) < 1e-30) c = 1e-30; d = 1 / d; const del = d * c; h *= del;
    if (Math.abs(del - 1) < 3e-12) break;
  }
  return h;
}
function lgamma(z) { const g = 7, c = [0.99999999999980993, 676.5203681218851, -1259.1392167224028, 771.32342877765313, -176.61502916214059, 12.507343278686905, -0.13857109526572012, 9.9843695780195716e-6, 1.5056327351493116e-7]; if (z < 0.5) return Math.log(Math.PI / Math.sin(Math.PI * z)) - lgamma(1 - z); z -= 1; let x = c[0]; for (let i = 1; i < g + 2; i++) x += c[i] / (z + i); const t = z + g + 0.5; return 0.5 * Math.log(2 * Math.PI) + (z + 0.5) * Math.log(t) - t + Math.log(x); }
function ibeta(a, b, x) { if (x <= 0) return 0; if (x >= 1) return 1; const bt = Math.exp(lgamma(a + b) - lgamma(a) - lgamma(b) + a * Math.log(x) + b * Math.log(1 - x)); return x < (a + 1) / (a + b + 2) ? bt * betacf(a, b, x) / a : 1 - bt * betacf(b, a, 1 - x) / b; }
export const pTwo = (t, df) => (df > 0 ? ibeta(df / 2, 0.5, df / (df + t * t)) : 1);
export function holm(ps) {
  const idx = ps.map((p, i) => [p, i]).sort((a, b) => a[0] - b[0]), out = Array(ps.length); let run = 0;
  idx.forEach(([p, i], k) => { run = Math.max(run, Math.min(1, (ps.length - k) * p)); out[i] = run; });
  return out;
}
export function mulberry32(a) { return () => { a |= 0; a = (a + 0x6d2b79f5) | 0; let t = Math.imul(a ^ (a >>> 15), 1 | a); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; }
const pct = (xs, q) => { const s = [...xs].sort((a, b) => a - b); const k = (s.length - 1) * q, lo = Math.floor(k); return s[lo] + (s[Math.min(lo + 1, s.length - 1)] - s[lo]) * (k - lo); };
const r3 = (x) => Math.round(x * 1000) / 1000, r2 = (x) => Math.round(x * 100) / 100;
const inWin = (m, a, b) => m >= a && m <= b;

// every holding month: the signal, the switch trade, the always-buy trade (both at 1x and 2x costs)
export function build(g, s) {
  const gE = monthEnds(g), sE = monthEnds(s), rows = [];
  for (const m of gE.keys()) {
    const hm = mAdd(m, 1); if (hm < P.isFrom || hm > P.oosTo) continue;
    const sg = signalAt(g, gE, s, sE, m); if (!sg || sg.rs === 0) continue;
    const side = sg.rs > 0 ? 'buy' : 'sell', T = trade(g, gE, m, side), T2 = trade(g, gE, m, side, { costX: 2 }), B = trade(g, gE, m, 'buy');
    if (!T || !B) continue;
    rows.push({ m: hm, rs: sg.rs, gr: sg.gr, sr: sg.sr, side, sw: T, net2: T2.net, buy: B, alt: Math.sign(sg.rs) !== Math.sign(sg.gr) });
  }
  return { rows, gE };
}

function summ(rows, f) { const x = rows.map(f); const st = tstat(x); return { n: st.n, mean: r3(st.mean), t: r2(st.t), sum: r2(x.reduce((a, b) => a + b, 0)), p: pTwo(st.t, st.n - 1) }; }

export function analyse(g, s) {
  const { rows, gE } = build(g, s), W = { is: [P.isFrom, P.isTo], oos: [P.oosFrom, P.oosTo] }, res = { tests: {} };
  const win = (k) => rows.filter((r) => inWin(r.m, ...W[k]));
  const T1 = {}, T2 = {}, T3 = {};
  for (const k of ['is', 'oos']) {
    const R = win(k), A = R.filter((r) => r.alt);
    T1[k] = { net: summ(R, (r) => r.sw.net), gross: summ(R, (r) => r.sw.gross), net2: summ(R, (r) => r.net2), buys: R.filter((r) => r.side === 'buy').length, sells: R.filter((r) => r.side === 'sell').length,
      buySide: summ(R.filter((r) => r.side === 'buy'), (r) => r.sw.net), sellSide: summ(R.filter((r) => r.side === 'sell'), (r) => r.sw.net), stops: R.filter((r) => r.sw.how === 'stop').length,
      medR0: r2(pct(R.map((r) => r.sw.r0), 0.5)), spreadR: r3(R.reduce((a, r) => a + r.sw.spread, 0) / R.length), finR: r3(R.reduce((a, r) => a + r.sw.fin, 0) / R.length) };
    const up = R.filter((r) => r.rs > 0), dn = R.filter((r) => r.rs < 0), wn = welch(up.map((r) => r.buy.net), dn.map((r) => r.buy.net)), wg = welch(up.map((r) => r.buy.gross), dn.map((r) => r.buy.gross));
    T2[k] = { net: { nUp: wn.nA, nDn: wn.nB, meanUp: r3(wn.meanA), meanDn: r3(wn.meanB), diff: r3(wn.diff), t: r2(wn.t), p: pTwo(wn.t, wn.df) }, gross: { meanUp: r3(wg.meanA), meanDn: r3(wg.meanB), diff: r3(wg.diff), t: r2(wg.t) },
      baseline: summ(R, (r) => r.buy.net), baselineGross: summ(R, (r) => r.buy.gross) };
    T3[k] = { net: summ(A, (r) => r.sw.net), gross: summ(A, (r) => r.sw.gross), net2: summ(A, (r) => r.net2) };
  }
  // placebo, out of sample
  const O = win('oos'), OA = O.filter((r) => r.alt), pl = { T1: [], T2: [], T3: [] };
  for (let seed = 1; seed <= P.seeds; seed++) {
    let rnd = mulberry32(seed);
    const side = (r) => (rnd() < 0.5 ? 'buy' : 'sell'), pick = (r, sd) => (sd === 'buy' ? r.buy.net : trade(g, gE, mAdd(r.m, -1), 'sell').net);
    pl.T1.push(tstat(O.map((r) => pick(r, side(r)))).t);
    rnd = mulberry32(seed + 1000);
    const signs = O.map((r) => r.rs > 0); for (let i = signs.length - 1; i > 0; i--) { const j = Math.floor(rnd() * (i + 1)); [signs[i], signs[j]] = [signs[j], signs[i]]; }
    pl.T2.push(welch(O.filter((_, i) => signs[i]).map((r) => r.buy.net), O.filter((_, i) => !signs[i]).map((r) => r.buy.net)).t);
    rnd = mulberry32(seed + 2000);
    pl.T3.push(tstat(OA.map((r) => pick(r, side(r)))).t);
  }
  const placebo = {};
  for (const k of ['T1', 'T2', 'T3']) { const act = (k === 'T1' ? T1 : k === 'T2' ? T2 : T3).oos.net.t; placebo[k] = { p95: r2(pct(pl[k], 0.95)), median: r2(pct(pl[k], 0.5)), atOrAbove: pl[k].filter((x) => x >= act).length, of: P.seeds }; }
  const hp = holm([T1.oos.net.p, T2.oos.net.p, T3.oos.net.p]);
  const checks = { oosT: T1.oos.net.t >= 2, holm: hp[0] < 0.05, isSign: T1.is.net.mean > 0, cost2: T1.oos.net2.mean > 0, placebo: T1.oos.net.t > placebo.T1.p95 };
  const pass = Object.values(checks).every(Boolean);
  // year by year (switch, net)
  const years = {}; for (const r of rows) { const y = r.m.slice(0, 4); (years[y] ||= []).push(r.sw.net); }
  const byYear = Object.fromEntries(Object.entries(years).map(([y, x]) => [y, { n: x.length, sum: r2(x.reduce((a, b) => a + b, 0)) }]));
  for (const T of [T1, T2, T3]) for (const k of ['is', 'oos']) for (const o of Object.values(T[k])) if (o && o.p != null) o.p = r3(o.p);
  return { T1, T2, T3, holm: { T1: r3(hp[0]), T2: r3(hp[1]), T3: r3(hp[2]) }, placebo, checks, pass, byYear, months: rows.length };
}

if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
  const dir = process.argv[2]; if (!dir) { console.error('usage: run.mjs <dir with xau.json, spx500.json>'); process.exit(2); }
  const g = toBars(JSON.parse(readFileSync(join(dir, 'xau.json'), 'utf8')).rows), s = toBars(JSON.parse(readFileSync(join(dir, 'spx500.json'), 'utf8')).rows);
  const a = analyse(g, s);
  const out = { study: 'gold-spx-rs', built: '2026-11-14', verdict: a.pass ? 'PASS' : 'FAIL', rule: 'Monthly: buy gold for the next month when its 3-month log return beats the S&P 500 (SPX500), sell when it lags; 3 x ATR(20) stop; $0.60 a round trip, financing on buys.',
    data: { gold: 'council-data research/daily/xau.json (OANDA mid, UTC days, weekends folded)', spx: 'council-data research/daily/spx500.json', goldFrom: ym(g[0].time), goldTo: new Date(g.at(-1).time * 1000).toISOString().slice(0, 10) }, params: P, ...a };
  writeFileSync(join(dirname(fileURLToPath(import.meta.url)), 'result.json'), JSON.stringify(out, null, 1) + '\n');
  console.log(JSON.stringify({ verdict: out.verdict, checks: a.checks, T1: a.T1, T2: a.T2, T3: a.T3, holm: a.holm, placebo: a.placebo }, null, 1));
}
