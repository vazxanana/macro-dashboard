// The weekly open as a level on gold (PREREGISTRATION.md, committed alone first).
//   node --use-env-proxy research/edge/gold-weekly-open/fetch.mjs <dir>   OANDA mid H1 gold from 3 Jan 2016 (kept out of git)
//   node research/edge/gold-weekly-open/run.mjs <dir>                    the study -> result.json (+ prints the tables)
// Pure pieces are exported for the test.
import fs from 'node:fs';
import path from 'node:path';
import zlib from 'node:zlib';
import { fileURLToPath } from 'node:url';
import { FIN, nights } from '../../../council/fills.mjs';
import { nyParts, cmeShut } from '../../../ict/calendar.mjs';

export const H = 3600, D = 86400, SPREAD = 0.30, SLIP = 0.15, ATR_N = 14, K_ENTRY = 0.25, K_FADE = 0.5, K_STOP = 0.5;
const DIR = path.dirname(fileURLToPath(import.meta.url));
const WD = { Sun: 0, Mon: 1, Tue: 2, Wed: 3, Thu: 4, Fri: 5, Sat: 6 };
const dnum = (ymd) => Date.parse(ymd + 'T00:00:00Z') / 1000 / D;

// where an H1 candle (start t, UTC) sits: { week: Monday's New York day number, wd: 0-5, min } or null (shut / weekend)
export function place(t) {
  if (cmeShut(t)) return null;
  const p = nyParts(t), wd = WD[p.wd], d = dnum(p.ymd);
  if (wd === 6 || (wd === 0 && p.min < 18 * 60) || (wd === 5 && p.min >= 17 * 60)) return null;
  return { week: wd === 0 ? d + 1 : d - (wd - 1), wd, min: p.min };
}

// rows [t,o,h,l,c] -> weeks [{ k, bars, W0, H, L, C, exitIdx, ok }] in time order
export function weeksOf(rows) {
  const out = []; let cur = null;
  for (const r of rows) {
    const p = place(r[0]); if (!p) continue;
    if (!cur || cur.k !== p.week) { cur = { k: p.week, bars: [] }; out.push(cur); }
    cur.bars.push({ t: r[0], o: r[1], h: r[2], l: r[3], c: r[4], wd: p.wd, min: p.min });
  }
  for (const w of out) {
    const b = w.bars, f = b[0];
    w.W0 = f.o; w.H = Math.max(...b.map((x) => x.h)); w.L = Math.min(...b.map((x) => x.l)); w.C = b.at(-1).c;
    w.ok = f.wd === 0 || (f.wd === 1 && f.min < 18 * 60);
    w.exitIdx = -1; for (let k = b.length - 1; k >= 0; k--) if (!(b[k].wd === 5 && b[k].min >= 16 * 60)) { w.exitIdx = k; break; }
  }
  return out;
}

// weekly ATR of week i: the mean true range of the ATR_N completed weeks before it (each needing its own previous close)
export function atrOf(weeks, i) {
  if (i < ATR_N + 1) return null;
  let s = 0; for (let j = i - ATR_N; j < i; j++) { const w = weeks[j], pc = weeks[j - 1].C; s += Math.max(w.H, pc) - Math.min(w.L, pc); }
  return s / ATR_N;
}

// manage a filled trade from candle kf: stop (checked on the fill candle too), target from the next candle, else the exit close
export function manage(bars, kf, side, fill, stop, target, exitIdx) {
  if (kf > exitIdx) return null;
  const risk = Math.abs(fill - stop); let exit = null, how = 'time', k = kf;
  if (side > 0 ? bars[kf].l <= stop : bars[kf].h >= stop) { exit = stop; how = 'stop'; }
  else for (k = kf + 1; k <= exitIdx; k++) { const b = bars[k];
    if (side > 0 ? b.l <= stop : b.h >= stop) { exit = side > 0 ? Math.min(b.o, stop) : Math.max(b.o, stop); how = 'stop'; break; }
    if (target != null && (side > 0 ? b.h >= target : b.l <= target)) { exit = target; how = 'target'; break; } }
  if (exit == null) { k = exitIdx; exit = bars[exitIdx].c; }
  const entryT = bars[kf].t, exitT = bars[Math.min(k, exitIdx)].t + H;
  return { side, entryT, exitT, entry: fill, stop, target, risk, exit, how, R: side * (exit - fill) / risk, nights: side > 0 ? nights(entryT, exitT) : 0 };
}
// net R of a trade at a cost multiple
export function netOf(x, mult = 1) {
  const fin = x.side > 0 ? x.nights * FIN.xau.long * x.entry / x.risk : 0;
  return x.R - mult * ((SPREAD + (x.how === 'target' ? 0 : SLIP)) / x.risk + fin);
}

// first fill of a limit in candles k0..k1 -> { k, fill } or null
export function limitFill(bars, k0, k1, side, L) {
  for (let k = k0; k <= k1; k++) { const b = bars[k]; if (side > 0 ? b.l <= L : b.h >= L) return { k, fill: side > 0 ? Math.min(b.o, L) : Math.max(b.o, L) }; }
  return null;
}
const tueWed = (bars) => { let k0 = -1, k1 = -1; bars.forEach((b, k) => { if (b.wd === 2 && k0 < 0) k0 = k; if (b.wd === 3) k1 = k; }); return [k0, k1]; };
const lastWed = (bars) => { let k1 = -1; bars.forEach((b, k) => { if (b.wd <= 3) k1 = k; }); return k1; };

// T1 / T2 in one week: side +1 needs the prior week up, -1 down; anchor = W0 unless a placebo anchor index is given
export function trendTrade(wk, prev, A, side, anchorIdx = 0) {
  if (side > 0 ? !(prev.C > prev.W0) : !(prev.C < prev.W0)) return null;
  const [k0, k1] = tueWed(wk.bars); if (k0 < 0 || k1 < k0) return null;
  const anc = wk.bars[anchorIdx].o, L = anc - side * K_ENTRY * A;
  const f = limitFill(wk.bars, Math.max(k0, anchorIdx), k1, side, L); if (!f) return null;
  return manage(wk.bars, f.k, side, f.fill, f.fill - side * K_STOP * A, null, wk.exitIdx);
}
// T3 in one week: two limits 0.5 A either side of the anchor from the anchor candle through Wednesday, target the anchor
export function magnetTrade(wk, A, anchorIdx = 0) {
  const b = wk.bars, k1 = lastWed(b), anc = b[anchorIdx].o, lb = anc - K_FADE * A, ls = anc + K_FADE * A;
  for (let k = anchorIdx; k <= k1; k++) {
    const buy = b[k].l <= lb, sell = b[k].h >= ls;
    if (buy && sell) return { skip: 'both in one candle' };
    if (buy || sell) { const side = buy ? 1 : -1, fill = buy ? Math.min(b[k].o, lb) : Math.max(b[k].o, ls);
      return manage(b, k, side, fill, fill - side * K_STOP * A, anc, wk.exitIdx); }
  }
  return null;
}

// every trade of a test; rnd (placebo) draws the anchor candle
export function trades(weeks, test, rnd = null) {
  const out = []; let skipped = 0;
  for (let i = 1; i < weeks.length; i++) {
    const wk = weeks[i], prev = weeks[i - 1]; if (!wk.ok) continue;
    const A = atrOf(weeks, i); if (!A) continue;
    let anchorIdx = 0;
    if (rnd) { const lim = test === 'T3' ? wk.bars.filter((b) => b.wd <= 2).length : tueWed(wk.bars)[0]; if (lim <= 0) continue; anchorIdx = Math.floor(rnd() * lim); }
    let x;
    if (test === 'T3') x = magnetTrade(wk, A, anchorIdx);
    else { if (wk.k - prev.k !== 7) continue; x = trendTrade(wk, prev, A, test === 'T1' ? 1 : -1, anchorIdx); }
    if (x && x.skip) { skipped++; continue; }
    if (x) out.push({ ...x, week: wk.k, A });
  }
  out.skipped = skipped;
  return out;
}

export function mulberry32(a) { return () => { a |= 0; a = (a + 0x6D2B79F5) | 0; let t = Math.imul(a ^ (a >>> 15), 1 | a); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; }
const phi = (z) => { const t = 1 / (1 + 0.3275911 * Math.abs(z) / Math.SQRT2), y = 1 - (((((1.061405429 * t - 1.453152027) * t) + 1.421413741) * t - 0.284496736) * t + 0.254829592) * t * Math.exp(-z * z / 2); return z >= 0 ? (1 + y) / 2 : (1 - y) / 2; };
export const pOne = (t) => (Number.isFinite(t) ? 1 - phi(t) : 1);
export function holm(ps) { const ix = ps.map((p, i) => [p, i]).sort((a, b) => a[0] - b[0]), m = ps.length, adj = Array(m); let run = 0;
  ix.forEach(([p, i], k) => { run = Math.max(run, Math.min(1, (m - k) * p)); adj[i] = run; }); return adj; }
const r3 = (x) => +x.toFixed(3), r2 = (x) => +x.toFixed(2);
const ym = (t) => { const d = new Date(t * 1000); return d.getUTCFullYear() * 12 + d.getUTCMonth(); };
// t on calendar-month sums of net R (booked by the exit's UTC month), every month from..to counted
export function monthT(T, from, to, mult = 1) {
  const a = ym(from), b = ym(to), s = Array(b - a + 1).fill(0);
  for (const x of T) { const m = ym(x.exitT) - a; if (m >= 0 && m < s.length) s[m] += netOf(x, mult); }
  const n = s.length, mu = s.reduce((p, q) => p + q, 0) / n, sd = Math.sqrt(s.reduce((p, q) => p + (q - mu) ** 2, 0) / (n - 1));
  return { months: n, t: sd ? mu / (sd / Math.sqrt(n)) : 0 };
}
export function stats(T, from, to, mult = 1) {
  const net = T.map((x) => netOf(x, mult)), n = T.length, s = net.reduce((a, v) => a + v, 0), g = T.reduce((a, x) => a + x.R, 0);
  const win = net.filter((v) => v > 0).reduce((a, v) => a + v, 0), loss = -net.filter((v) => v < 0).reduce((a, v) => a + v, 0);
  let eq = 0, pk = 0, dd = 0; for (const v of net) { eq += v; pk = Math.max(pk, eq); dd = Math.min(dd, eq - pk); }
  const mo = monthT(T, from, to, mult);
  return { n, avg: n ? r3(s / n) : 0, gross: n ? r3(g / n) : 0, total: r2(s), wr: n ? r2(net.filter((v) => v > 0).length / n * 100) : 0, pf: loss ? r2(win / loss) : null, dd: r2(dd), tMonth: r2(mo.t), months: mo.months,
    stops: T.filter((x) => x.how === 'stop').length, targets: T.filter((x) => x.how === 'target').length, medRisk: n ? r2(T.map((x) => x.risk).sort((p, q) => p - q)[Math.floor(n / 2)]) : null };
}

const T0 = (s) => Date.parse(s + 'T00:00:00Z') / 1000;
export const TESTS = ['T1', 'T2', 'T3'];
export const IS = [T0('2016-01-01'), T0('2021-01-01') - 1], OOS_FROM = T0('2021-01-01');

export function study(rows) {
  let weeks = weeksOf(rows);
  const lw = weeks.at(-1); if (lw && !lw.bars.some((b) => b.wd === 5 && b.min >= 15 * 60)) weeks = weeks.slice(0, -1);   // last week only when complete
  const end = weeks.at(-1).bars.at(-1).t + H, OOS = [OOS_FROM, end], out = { tests: {} };
  const inW = (T, [a, b]) => T.filter((x) => x.entryT >= a && x.entryT <= b);
  for (const name of TESTS) {
    const T = trades(weeks, name), is = inW(T, IS), oos = inW(T, OOS);
    const sIs = stats(is, ...IS), sO = stats(oos, ...OOS), sO2 = stats(oos, ...OOS, 2), sIs0 = stats(is, ...IS, 0), sO0 = stats(oos, ...OOS, 0);
    const years = {}; for (const x of T) (years[new Date(x.entryT * 1000).getUTCFullYear()] ||= []).push(x);
    const yr = Object.fromEntries(Object.entries(years).map(([y, a]) => { const s = a.reduce((p, q) => p + netOf(q), 0); return [y, { n: a.length, avg: r3(s / a.length), total: r2(s) }]; }));
    const pl = []; for (let s = 1; s <= 40; s++) { const P = inW(trades(weeks, name, mulberry32(s)), OOS); pl.push(P.length ? P.reduce((a, x) => a + netOf(x), 0) / P.length : 0); }
    const sides = name === 'T3' ? { buy: stats(oos.filter((x) => x.side > 0), ...OOS), sell: stats(oos.filter((x) => x.side < 0), ...OOS) } : undefined;
    out.tests[name] = { is: sIs, oos: sO, oos2x: { n: sO2.n, avg: sO2.avg, tMonth: sO2.tMonth }, gross: { is: { avg: sIs0.avg, tMonth: sIs0.tMonth }, oos: { avg: sO0.avg, tMonth: sO0.tMonth } },
      skipped: T.skipped, years: yr, sides, placebo: { seeds: 40, beat: pl.filter((v) => sO.avg > v).length, median: r3([...pl].sort((a, b) => a - b)[20]), min: r3(Math.min(...pl)), max: r3(Math.max(...pl)) }, p: pOne(sO.tMonth) };
  }
  const adj = holm(TESTS.map((k) => out.tests[k].p));
  TESTS.forEach((k, i) => { const r = out.tests[k]; r.p = +r.p.toFixed(4); r.holmP = +adj[i].toFixed(4);
    r.checks = { oos: r.oos.avg > 0 && r.oos.tMonth >= 2 && r.holmP <= 0.05, is: r.is.avg > 0, cost2x: r.oos2x.avg > 0, n: r.oos.n >= 60, placebo: r.placebo.beat >= 38 };
    r.pass = Object.values(r.checks).every(Boolean); });
  out.verdict = out.tests.T1.pass ? 'PASS' : (out.tests.T2.pass || out.tests.T3.pass) ? 'PARTLY' : 'FAIL';
  out.data = { src: 'OANDA mid H1 XAU/USD via /md/bars', from: new Date(rows[0][0] * 1000).toISOString().slice(0, 10), to: new Date(end * 1000).toISOString().slice(0, 16), candles: rows.length, weeks: weeks.length };
  out.costs = { spread: SPREAD, slippage: SLIP, slippageOn: 'stop and time exits (market orders); limit entries and target exits pay none', financing: { rate: FIN.xau.long, asOf: FIN.xau.asOf, longsOnly: true } };
  out.windows = { inSample: '2016-01-01 to 2020-12-31', outOfSample: `2021-01-01 to ${out.data.to.slice(0, 10)}` };
  return out;
}

if (process.argv[1] && fileURLToPath(import.meta.url) === path.resolve(process.argv[1])) {
  const dir = process.argv[2];
  if (!dir) { console.log('usage: run.mjs <dir>'); process.exit(1); }
  const rows = JSON.parse(zlib.gunzipSync(fs.readFileSync(path.join(dir, 'xau-1h.json.gz'))));
  const r = study(rows);
  const res = { built: '2026-11-14', verdict: r.verdict, data: r.data, costs: r.costs, windows: r.windows, tests: r.tests };
  fs.writeFileSync(path.join(DIR, 'result.json'), JSON.stringify(res, null, 1) + '\n');
  for (const [k, v] of Object.entries(r.tests)) console.log(k, JSON.stringify({ is: v.is, oos: v.oos, oos2x: v.oos2x, gross: v.gross, placebo: v.placebo, holmP: v.holmP, checks: v.checks, skipped: v.skipped, sides: v.sides && { b: v.sides.buy.avg, bn: v.sides.buy.n, s: v.sides.sell.avg, sn: v.sides.sell.n } }));
  for (const [k, v] of Object.entries(r.tests)) console.log(k, JSON.stringify(v.years));
  console.log('verdict', r.verdict, r.data);
}
