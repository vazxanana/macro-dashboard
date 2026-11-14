// Does Monday tell the rest of gold's week? A pre-registered stand-alone study (PREREGISTRATION.md, pushed alone first).
// node research/edge/gold-monday-tell/run.mjs  -> reads council-data research/daily/xau.json through git (no network), writes result.json
import fs from 'node:fs';
import { execFileSync } from 'node:child_process';
import { foldWeekend, nights, FIN } from '../../../council/fills.mjs';

export const P = { atrN: 20, k: 0.5, stopAtr: 1.5, cost: 0.6, fin: FIN.xau.long };
export const IS = [2007, 2016], OOS = [2017, 2026];
export const OOS_END = Date.UTC(2026, 10, 1) / 1000; // last complete week before 1 Nov 2026

const wd = (t) => new Date(t * 1000).getUTCDay();
const ym = (t) => { const d = new Date(t * 1000); return d.getUTCFullYear() * 12 + d.getUTCMonth(); };
const yr = (t) => new Date(t * 1000).getUTCFullYear();

export function atrAt(days, i, n = P.atrN) { // mean true range of the n days BEFORE index i
  if (i - n < 1) return null;
  let s = 0;
  for (let j = i - n; j < i; j++) { const b = days[j], pc = days[j - 1].close; s += Math.max(b.high - b.low, Math.abs(b.high - pc), Math.abs(b.low - pc)); }
  return s / n;
}

// every eligible week: Monday, Tuesday and Friday present (folded days). Reads only Monday and the days before it for the signal.
export function weeks(days) {
  const out = [];
  for (let i = 1; i < days.length; i++) {
    if (wd(days[i].time) !== 1) continue;
    const mon = days[i], atr = atrAt(days, i);
    if (!atr) continue;
    const rest = [];
    for (let j = i + 1; j < days.length && days[j].time < mon.time + 5 * 86400; j++) rest.push(days[j]);
    if (!rest.length || wd(rest[0].time) !== 2 || wd(rest[rest.length - 1].time) !== 5) continue;
    out.push({ t: mon.time, M: mon.close - days[i - 1].close, atr, rest });
  }
  return out;
}

// one Tuesday-open to Friday-close trade on side d (+1 buy, -1 sell), stop stopAtr x ATR, checked on daily candles
export function trade(w, d, p = P, costX = 1) {
  const entry = w.rest[0].open, risk = p.stopAtr * w.atr, stop = entry - d * risk;
  let exit = null, exitT = null, stopped = false;
  for (const b of w.rest) {
    if (d > 0 ? b.open <= stop : b.open >= stop) { exit = b.open; exitT = b.time; stopped = true; break; }
    if (d > 0 ? b.low <= stop : b.high >= stop) { exit = stop; exitT = b.time + 12 * 3600; stopped = true; break; }
  }
  if (exit == null) { const f = w.rest[w.rest.length - 1]; exit = f.close; exitT = f.time + 21 * 3600; }
  const gross = d * (exit - entry) / risk;
  const n = d > 0 ? nights(w.rest[0].time, exitT) : 0;
  const cost = costX * (p.cost + (d > 0 ? n * p.fin * entry : 0)) / risk;
  return { t: w.t, d, entry, stop, exit, risk, stopped, gross, cost, net: gross - cost, nights: n };
}

export const signal = (w, p = P) => (Math.abs(w.M) >= p.k * w.atr ? Math.sign(w.M) : 0);

export function monthT(rows, key, y0, y1) { // t of calendar-month sums, every month of the window counts
  const sums = new Map();
  for (let m = y0 * 12; m <= y1 * 12 + 11; m++) sums.set(m, 0);
  for (const r of rows) { const m = ym(r.t); if (sums.has(m)) sums.set(m, sums.get(m) + r[key]); }
  let last = y1 * 12 + 11; if (y1 === OOS[1]) last = 2026 * 12 + 9; // out of sample ends October 2026
  const v = [...sums].filter(([m]) => m <= last).map(([, s]) => s), n = v.length, mu = v.reduce((a, b) => a + b, 0) / n;
  const sd = Math.sqrt(v.reduce((a, b) => a + (b - mu) ** 2, 0) / (n - 1));
  return sd > 0 ? mu / (sd / Math.sqrt(n)) : 0;
}
const erf = (x) => { const s = Math.sign(x); x = Math.abs(x); const t = 1 / (1 + 0.3275911 * x); return s * (1 - (((((1.061405429 * t - 1.453152027) * t) + 1.421413741) * t - 0.284496736) * t + 0.254829592) * t * Math.exp(-x * x)); };
export const pTwo = (t) => 1 - erf(Math.abs(t) / Math.SQRT2);
export function holm(ps) {
  const o = ps.map((p, i) => [p, i]).sort((a, b) => a[0] - b[0]), adj = Array(ps.length); let run = 0;
  o.forEach(([p, i], r) => { run = Math.max(run, Math.min(1, p * (ps.length - r))); adj[i] = run; });
  return adj;
}
export function mulberry32(a) { return () => { a |= 0; a = (a + 0x6D2B79F5) | 0; let t = Math.imul(a ^ (a >>> 15), 1 | a); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; }

const mean = (a) => (a.length ? a.reduce((x, y) => x + y, 0) / a.length : 0);
const r3 = (x) => +x.toFixed(3), r2 = (x) => +x.toFixed(2);

export function study(days, costX = 1) {
  const W = weeks(days), win = (w, [a, b]) => yr(w.t) >= a && yr(w.t) <= b && (b !== OOS[1] || w.t + 5 * 86400 <= OOS_END);
  const res = {};
  for (const [name, range] of [['is', IS], ['oos', OOS]]) {
    const ws = W.filter((w) => win(w, range));
    const base = { 1: mean(ws.map((w) => trade(w, 1, P, costX).net)), [-1]: mean(ws.map((w) => trade(w, -1, P, costX).net)) };
    const sig = ws.filter((w) => signal(w)).map((w) => { const tr = trade(w, signal(w), P, costX); return { ...tr, excess: tr.net - base[tr.d] }; });
    const summ = (rows) => ({ n: rows.length, gross: r3(mean(rows.map((r) => r.gross))), net: r3(mean(rows.map((r) => r.net))), excess: r3(mean(rows.map((r) => r.excess))),
      tNet: r2(monthT(rows, 'net', ...range)), tExcess: r2(monthT(rows, 'excess', ...range)), costShare: r3(mean(rows.map((r) => r.cost)) / Math.abs(mean(rows.map((r) => r.gross)) || 1e-9)),
      stopped: rows.filter((r) => r.stopped).length });
    res[name] = { weeks: ws.length, baseline: { long: r3(base[1]), short: r3(base[-1]) },
      T1: summ(sig), T2: summ(sig.filter((r) => r.d > 0)), T3: summ(sig.filter((r) => r.d < 0)),
      medianStop: r2([...sig.map((r) => r.risk)].sort((a, b) => a - b)[Math.floor(sig.length / 2)]), rows: sig, ws, base };
  }
  return res;
}

export function placebo(o, draws = 40) {
  const nb = o.rows.filter((r) => r.d > 0).length, n = o.rows.length, out = [];
  for (let s = 1; s <= draws; s++) {
    const rnd = mulberry32(s), idx = o.ws.map((_, i) => i);
    for (let i = idx.length - 1; i > 0; i--) { const j = Math.floor(rnd() * (i + 1)); [idx[i], idx[j]] = [idx[j], idx[i]]; }
    const pick = idx.slice(0, n), sides = pick.map((_, i) => (i < nb ? 1 : -1));
    for (let i = sides.length - 1; i > 0; i--) { const j = Math.floor(rnd() * (i + 1)); [sides[i], sides[j]] = [sides[j], sides[i]]; }
    const rows = pick.map((k, i) => { const tr = trade(o.ws[k], sides[i]); return { ...tr, excess: tr.net - o.base[tr.d] }; });
    out.push(r2(monthT(rows, 'excess', ...OOS)));
  }
  return out;
}

export function loadDays() {
  const raw = JSON.parse(execFileSync('git', ['show', 'origin/council-data:research/daily/xau.json'], { maxBuffer: 64 << 20 }).toString());
  return foldWeekend(raw.rows.map(([time, open, high, low, close]) => ({ time, open, high, low, close })));
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const days = loadDays(), s1 = study(days), s2 = study(days, 2);
  const tests = ['T1', 'T2', 'T3'], ps = tests.map((k) => pTwo(s1.oos[k].tExcess)), adj = holm(ps), pl = placebo(s1.oos);
  const beat = pl.filter((t) => t < s1.oos.T1.tExcess).length;
  const strip = (o) => ({ weeks: o.weeks, baseline: o.baseline, T1: o.T1, T2: o.T2, T3: o.T3, medianStop: o.medianStop });
  const checks = { oosT: s1.oos.T1.tExcess >= 2 && adj[0] < 0.05, sameSignIS: Math.sign(s1.is.T1.excess) === Math.sign(s1.oos.T1.excess) && s1.oos.T1.excess !== 0,
    net2x: s2.oos.T1.net > 0, placebo: beat >= 38 };
  const verdict = Object.values(checks).every(Boolean) ? 'PASS' : 'FAIL';
  const out = { study: 'gold-monday-tell', built: '2026-11-14', verdict, params: P, windows: { is: IS, oos: [2017, '2026-10'] },
    data: { src: 'council-data research/daily/xau.json (OANDA mid, UTC days, weekend folded)', first: new Date(days[0].time * 1000).toISOString().slice(0, 10), last: new Date(days[days.length - 1].time * 1000).toISOString().slice(0, 10) },
    is: strip(s1.is), oos: strip(s1.oos), x2: { is: strip(s2.is), oos: strip(s2.oos) },
    holm: Object.fromEntries(tests.map((k, i) => [k, { p: r3(ps[i]), adj: r3(adj[i]) }])),
    placebo: { draws: pl, beatenBy: beat, of: pl.length }, checks };
  fs.writeFileSync(new URL('./result.json', import.meta.url), JSON.stringify(out, null, 1) + '\n');
  console.log(JSON.stringify({ ...out, placebo: { beatenBy: beat, sorted: [...pl].sort((a, b) => a - b) } }, null, 1));
}
