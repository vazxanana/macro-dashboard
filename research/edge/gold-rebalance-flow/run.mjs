// Month-end rebalancing flow between equities and gold: a pre-registered stand-alone study (PREREGISTRATION.md, pushed alone first).
// node research/edge/gold-rebalance-flow/run.mjs  -> reads council-data research/daily/xau.json + spx500.json through git (no network), writes result.json
import fs from 'node:fs';
import { execFileSync } from 'node:child_process';
import { foldWeekend, nights, FIN } from '../../../council/fills.mjs';

export const P = { atrN: 20, stopAtr: 1.5, big: 0.04, minDays: 10, cost: 0.6, fin: FIN.xau.long };
export const IS = [2007, 2016], OOS = [2017, 2026];
export const OOS_LAST = 2026 * 12 + 9; // October 2026

const ym = (t) => { const d = new Date(t * 1000); return d.getUTCFullYear() * 12 + d.getUTCMonth(); };
const yr = (t) => new Date(t * 1000).getUTCFullYear();

export function atrAt(days, i, n = P.atrN) { // mean true range of the n days BEFORE index i
  if (i - n < 1) return null;
  let s = 0;
  for (let j = i - n; j < i; j++) { const b = days[j], pc = days[j - 1].close; s += Math.max(b.high - b.low, Math.abs(b.high - pc), Math.abs(b.low - pc)); }
  return s / n;
}

// S&P close at or before time t (sorted rows, binary search)
export function closeAt(spx, t) {
  let lo = 0, hi = spx.length - 1, k = -1;
  while (lo <= hi) { const m = (lo + hi) >> 1; if (spx[m].time <= t) { k = m; lo = m + 1; } else hi = m - 1; }
  return k < 0 ? null : spx[k].close;
}

// every eligible month: gold days grouped by calendar month; the signal reads only closes up to TD-4
export function months(days, spx) {
  const groups = [];
  for (let i = 0; i < days.length; i++) {
    const m = ym(days[i].time), g = groups[groups.length - 1];
    if (g && g.m === m) g.idx.push(i); else groups.push({ m, idx: [i] });
  }
  const out = [];
  for (let k = 1; k < groups.length; k++) {
    const g = groups[k], prev = groups[k - 1];
    if (g.idx.length < P.minDays || prev.m !== g.m - 1) continue;
    const L = g.idx.length, i4 = g.idx[L - 4], i3 = g.idx[L - 3], i1 = g.idx[L - 1], i0 = prev.idx[prev.idx.length - 1];
    const atr = atrAt(days, i3);
    const s0 = closeAt(spx, days[i0].time), s4 = closeAt(spx, days[i4].time);
    if (!atr || s0 == null || s4 == null) continue;
    const D = Math.log(days[i4].close / days[i0].close) - Math.log(s4 / s0);
    out.push({ t: days[i3].time, m: g.m, D, atr, rest: days.slice(i3, i1 + 1) });
  }
  return out;
}

export const signal = (w) => (w.D > 0 ? -1 : w.D < 0 ? 1 : 0);

// one TD-3-open to TD-1-close trade on side d, stop stopAtr x ATR, checked on daily candles
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
  return { t: w.t, d, D: w.D, entry, stop, exit, risk, stopped, gross, cost, net: gross - cost, nights: n };
}

export function monthT(rows, key, y0, y1) { // t of calendar-month sums, every month of the window counts
  const sums = new Map();
  const last = y1 === OOS[1] ? OOS_LAST : y1 * 12 + 11;
  for (let m = y0 * 12; m <= last; m++) sums.set(m, 0);
  for (const r of rows) { const m = ym(r.t); if (sums.has(m)) sums.set(m, sums.get(m) + r[key]); }
  const v = [...sums.values()], n = v.length, mu = v.reduce((a, b) => a + b, 0) / n;
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

export function study(days, spx, costX = 1) {
  const W = months(days, spx), win = (w, [a, b]) => yr(w.t) >= a && yr(w.t) <= b && (b !== OOS[1] || w.m <= OOS_LAST);
  const res = {};
  for (const [name, range] of [['is', IS], ['oos', OOS]]) {
    const ws = W.filter((w) => win(w, range));
    const base = { 1: mean(ws.map((w) => trade(w, 1, P, costX).net)), [-1]: mean(ws.map((w) => trade(w, -1, P, costX).net)) };
    const sig = ws.filter((w) => signal(w)).map((w) => { const tr = trade(w, signal(w), P, costX); return { ...tr, excess: tr.net - base[tr.d] }; });
    const summ = (rows) => ({ n: rows.length, gross: r3(mean(rows.map((r) => r.gross))), net: r3(mean(rows.map((r) => r.net))), excess: r3(mean(rows.map((r) => r.excess))),
      tNet: r2(monthT(rows, 'net', ...range)), tExcess: r2(monthT(rows, 'excess', ...range)), costShare: r3(mean(rows.map((r) => r.cost)) / Math.abs(mean(rows.map((r) => r.gross)) || 1e-9)),
      stopped: rows.filter((r) => r.stopped).length });
    res[name] = { months: ws.length, baseline: { long: r3(base[1]), short: r3(base[-1]) },
      T1: summ(sig), T2: summ(sig.filter((r) => Math.abs(r.D) >= P.big)), T3: summ(sig.filter((r) => r.d > 0)),
      medianStop: r2([...sig.map((r) => r.risk)].sort((a, b) => a - b)[Math.floor(sig.length / 2)]), rows: sig, ws, base };
  }
  return res;
}

export function placebo(o, draws = 40) {
  const nb = o.rows.filter((r) => r.d > 0).length, out = [];
  for (let s = 1; s <= draws; s++) {
    const rnd = mulberry32(s), sides = o.rows.map((_, i) => (i < nb ? 1 : -1));
    for (let i = sides.length - 1; i > 0; i--) { const j = Math.floor(rnd() * (i + 1)); [sides[i], sides[j]] = [sides[j], sides[i]]; }
    const ws = o.ws.filter((w) => signal(w));
    const rows = ws.map((w, i) => { const tr = trade(w, sides[i]); return { ...tr, excess: tr.net - o.base[tr.d] }; });
    out.push(r2(monthT(rows, 'excess', ...OOS)));
  }
  return out;
}

const show = (key) => JSON.parse(execFileSync('git', ['show', `origin/council-data:research/daily/${key}.json`], { maxBuffer: 64 << 20 }).toString());
export function loadData() {
  const days = foldWeekend(show('xau').rows.map(([time, open, high, low, close]) => ({ time, open, high, low, close })));
  const spx = show('spx500').rows.map(([time, open, high, low, close]) => ({ time, open, high, low, close })).sort((a, b) => a.time - b.time);
  return { days, spx };
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const { days, spx } = loadData(), s1 = study(days, spx), s2 = study(days, spx, 2);
  const tests = ['T1', 'T2', 'T3'], ps = tests.map((k) => pTwo(s1.oos[k].tExcess)), adj = holm(ps), pl = placebo(s1.oos);
  const beat = pl.filter((t) => t < s1.oos.T1.tExcess).length;
  const strip = (o) => ({ months: o.months, baseline: o.baseline, T1: o.T1, T2: o.T2, T3: o.T3, medianStop: o.medianStop });
  const checks = { oosT: s1.oos.T1.tExcess >= 2 && adj[0] < 0.05, sameSignIS: Math.sign(s1.is.T1.excess) === Math.sign(s1.oos.T1.excess) && s1.oos.T1.excess !== 0,
    net2x: s2.oos.T1.net > 0, placebo: beat >= 38 };
  const verdict = Object.values(checks).every(Boolean) ? 'PASS' : 'FAIL';
  const out = { study: 'gold-rebalance-flow', built: '2026-11-14', verdict, params: P, windows: { is: IS, oos: [2017, '2026-10'] },
    data: { src: 'council-data research/daily/xau.json (traded, weekend folded) + spx500.json (signal only); OANDA mid, UTC days',
      first: new Date(days[0].time * 1000).toISOString().slice(0, 10), last: new Date(days[days.length - 1].time * 1000).toISOString().slice(0, 10) },
    is: strip(s1.is), oos: strip(s1.oos), x2: { is: strip(s2.is), oos: strip(s2.oos) },
    holm: Object.fromEntries(tests.map((k, i) => [k, { p: r3(ps[i]), adj: r3(adj[i]) }])),
    placebo: { draws: pl, beatenBy: beat, of: pl.length }, checks };
  fs.writeFileSync(new URL('./result.json', import.meta.url), JSON.stringify(out, null, 1) + '\n');
  console.log(JSON.stringify({ ...out, x2: { is: s2.is.T1, oos: s2.oos.T1 }, placebo: { beatenBy: beat, sorted: [...pl].sort((a, b) => a - b) } }, null, 1));
}
