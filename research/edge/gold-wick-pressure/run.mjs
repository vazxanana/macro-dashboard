// gold-wick-pressure: ten days of lower-minus-upper wick imbalance on spot gold, judged against the same-side every-day
// baseline (PREREGISTRATION.md, pushed first). Paper research only: nothing live reads this file.
// Run: node research/edge/gold-wick-pressure/run.mjs   (reads origin/council-data research/daily/xau.json through git, no network)
import { execFileSync } from 'node:child_process';
import { writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import { FIN, nights, foldWeekend } from '../../../council/fills.mjs';

export const P = { wpN: 10, atrN: 14, look: 250, hi: 0.8, lo: 0.2, stopAtr: 1.5, hold: 5, holdLong: 10, cost: 0.60 };
export const IS = ['2007-01-01', '2016-12-31'];
export const OOS = ['2017-01-01', '2026-10-31'];
const DAY = 86400;
const ymd = (t) => new Date(t * 1000).toISOString().slice(0, 10);
export const windowOf = (t) => { const d = ymd(t); return d >= IS[0] && d <= IS[1] ? 'is' : d >= OOS[0] && d <= OOS[1] ? 'oos' : null; };

// ATR14 ending at i (mean true range of the 14 days ending i), null without 14 days
export function atrAt(b, i, n = P.atrN) {
  if (i < n) return null;
  let s = 0;
  for (let k = i - n + 1; k <= i; k++) s += Math.max(b[k].high - b[k].low, Math.abs(b[k].high - b[k - 1].close), Math.abs(b[k].low - b[k - 1].close));
  return s / n;
}
// WP(i): sum over the 10 days ending i of (lower wick - upper wick), over 10 x ATR14(i)
export function wpAt(b, i, n = P.wpN) {
  const a = atrAt(b, i);
  if (a == null || i < n - 1 || !(a > 0)) return null;
  let s = 0;
  for (let k = i - n + 1; k <= i; k++) {
    const x = b[k], lw = Math.min(x.open, x.close) - x.low, uw = x.high - Math.max(x.open, x.close);
    s += lw - uw;
  }
  return s / (n * a);
}
// percentile (linear interpolation) of a sorted array
export function pct(sorted, q) {
  if (!sorted.length) return null;
  const h = (sorted.length - 1) * q, lo = Math.floor(h), hi = Math.ceil(h);
  return sorted[lo] + (sorted[hi] - sorted[lo]) * (h - lo);
}
// signals: { i, side } read at the close of day i, thresholds from the 250 WP values BEFORE i
export function signals(b) {
  const wp = b.map((_, i) => wpAt(b, i)), out = [];
  for (let i = 0; i < b.length; i++) {
    if (wp[i] == null) continue;
    const past = [];
    for (let k = i - 1; k >= 0 && past.length < P.look; k--) if (wp[k] != null) past.push(wp[k]);
    if (past.length < P.look) continue;
    past.sort((x, y) => x - y);
    if (wp[i] >= pct(past, P.hi)) out.push({ i, side: 'buy', wp: wp[i] });
    else if (wp[i] <= pct(past, P.lo)) out.push({ i, side: 'sell', wp: wp[i] });
  }
  return out;
}
// one trade entered at the open of day e, stop dist = 1.5 x atr, out at the close of the hold-th day (e counts) or at the stop
export function trade(b, e, side, atr, hold = P.hold, costMul = 1) {
  if (e >= b.length || !(atr > 0)) return null;
  const last = e + hold - 1;
  if (last >= b.length) return null;
  const sell = side === 'sell', entry = b[e].open, risk = P.stopAtr * atr, stop = sell ? entry + risk : entry - risk;
  let px = null, x = last, how = 'time';
  for (let k = e; k <= last; k++) {
    const c = b[k];
    if (k > e && (sell ? c.open >= stop : c.open <= stop)) { px = c.open; x = k; how = 'gap'; break; }
    if (sell ? c.high >= stop : c.low <= stop) { px = stop; x = k; how = 'stop'; break; }
  }
  if (px == null) px = b[last].close;
  const gross = (sell ? entry - px : px - entry) / risk;
  const nn = sell ? 0 : nights(b[e].time, b[x].time + DAY - 1);
  const fin = sell ? 0 : nn * FIN.xau.long * entry / risk;
  const cost = costMul * (P.cost / risk + fin);
  return { e, x, side, entry, stop, risk, exitPx: px, how, gross, cost, net: gross - cost, nights: nn, t: b[e].time };
}
// the rule's trades: one at a time
export function ruleTrades(b, sigs, hold = P.hold, costMul = 1) {
  const out = []; let busyTo = -1;
  for (const s of sigs) {
    if (s.i < busyTo) continue;
    const tr = trade(b, s.i + 1, s.side, atrAt(b, s.i), hold, costMul);
    if (!tr) continue;
    out.push(tr); busyTo = tr.x;
  }
  return out;
}
// baseline: every trading day of each window, a buy and a sell, overlapping; mean net per side per window
export function baseline(b, hold = P.hold, costMul = 1, from = 0) {
  const acc = {};
  for (let e = Math.max(from, P.atrN + 1); e < b.length; e++) {
    const w = windowOf(b[e].time); if (!w) continue;
    for (const side of ['buy', 'sell']) {
      const tr = trade(b, e, side, atrAt(b, e - 1), hold, costMul); if (!tr) continue;
      const k = w + ':' + side; (acc[k] ||= { n: 0, net: 0, gross: 0 }); acc[k].n++; acc[k].net += tr.net; acc[k].gross += tr.gross;
    }
  }
  const m = {};
  for (const [k, v] of Object.entries(acc)) m[k] = { n: v.n, net: v.net / v.n, gross: v.gross / v.n };
  return m;
}
// t on calendar-month sums, every month of the window counted (zeros included)
export function monthT(rows, win, val) {
  const [a, z] = win === 'is' ? IS : OOS, sums = new Map();
  for (let y = +a.slice(0, 4); y <= +z.slice(0, 4); y++) for (let m = 1; m <= 12; m++) {
    const k = `${y}-${String(m).padStart(2, '0')}`; if (k >= a.slice(0, 7) && k <= z.slice(0, 7)) sums.set(k, 0);
  }
  for (const r of rows) { const k = ymd(r.t).slice(0, 7); if (sums.has(k)) sums.set(k, sums.get(k) + val(r)); }
  const v = [...sums.values()], n = v.length, mu = v.reduce((s, x) => s + x, 0) / n;
  const sd = Math.sqrt(v.reduce((s, x) => s + (x - mu) ** 2, 0) / (n - 1));
  return { months: n, t: sd > 0 ? mu / (sd / Math.sqrt(n)) : 0 };
}
const erf = (x) => { const s = Math.sign(x); x = Math.abs(x); const t = 1 / (1 + 0.3275911 * x); return s * (1 - (((((1.061405429 * t - 1.453152027) * t) + 1.421413741) * t - 0.284496736) * t + 0.254829592) * t * Math.exp(-x * x)); };
export const pTwo = (t) => 2 * (1 - 0.5 * (1 + erf(Math.abs(t) / Math.SQRT2)));
export function holm(ps) {
  const o = ps.map((p, i) => ({ p, i })).sort((a, b) => a.p - b.p), adj = Array(ps.length); let run = 0;
  o.forEach((x, r) => { run = Math.max(run, Math.min(1, (ps.length - r) * x.p)); adj[x.i] = run; });
  return adj;
}
export function mulberry32(a) { return () => { a |= 0; a = (a + 0x6D2B79F5) | 0; let t = Math.imul(a ^ (a >>> 15), 1 | a); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; }

const r3 = (x) => Math.round(x * 1000) / 1000, r2 = (x) => Math.round(x * 100) / 100;
function summary(trs, base, win) {
  const w = trs.filter((r) => windowOf(r.t) === win), n = w.length;
  const ex = (r) => r.net - base[win + ':' + r.side].net;
  const s = (f) => w.reduce((a, r) => a + f(r), 0);
  const stops = w.map((r) => r.risk).sort((a, b) => a - b);
  let cum = 0, peak = 0, dd = 0; for (const r of w) { cum += r.net; peak = Math.max(peak, cum); dd = Math.min(dd, cum - peak); }
  const side = (sd) => { const v = w.filter((r) => r.side === sd), m = v.length; return { n: m, gross: m ? r3(v.reduce((a, r) => a + r.gross, 0) / m) : null, net: m ? r3(v.reduce((a, r) => a + r.net, 0) / m) : null, excess: m ? r3(v.reduce((a, r) => a + ex(r), 0) / m) : null, base: r3(base[win + ':' + sd].net) }; };
  return {
    n, gross: r3(s((r) => r.gross) / n), net: r3(s((r) => r.net) / n), excess: r3(s(ex) / n), totalNet: r2(s((r) => r.net)),
    tGross: r2(monthT(w, win, (r) => r.gross).t), tNet: r2(monthT(w, win, (r) => r.net).t), tExcess: r2(monthT(w, win, ex).t),
    months: monthT(w, win, ex).months, win: r3(w.filter((r) => r.net > 0).length / n), dd: r2(dd),
    medianStop: r2(pct(stops, 0.5)), costShare: r3(s((r) => r.cost) / s((r) => Math.abs(r.gross))), buy: side('buy'), sell: side('sell'),
  };
}

export function study(b) {
  const sigs = signals(b);
  const t5 = ruleTrades(b, sigs, P.hold), t10 = ruleTrades(b, sigs, P.holdLong), t5x2 = ruleTrades(b, sigs, P.hold, 2);
  const b5 = baseline(b, P.hold), b10 = baseline(b, P.holdLong), b5x2 = baseline(b, P.hold, 2);
  const S = { T1: { is: summary(t5, b5, 'is'), oos: summary(t5, b5, 'oos') }, T3: { is: summary(t10, b10, 'is'), oos: summary(t10, b10, 'oos') },
    x2: { is: summary(t5x2, b5x2, 'is'), oos: summary(t5x2, b5x2, 'oos') } };
  const tests = [
    { id: 'T1', what: 'excess over same-side baseline, 5-day hold', t: S.T1.oos.tExcess, isMean: S.T1.is.excess },
    { id: 'T2', what: 'both-sided net R, 5-day hold', t: S.T1.oos.tNet, isMean: S.T1.is.net },
    { id: 'T3', what: 'excess over same-side baseline, 10-day hold', t: S.T3.oos.tExcess, isMean: S.T3.is.excess },
  ];
  const adj = holm(tests.map((x) => pTwo(x.t)));
  tests.forEach((x, k) => { x.p = +pTwo(x.t).toFixed(4); x.holm = +adj[k].toFixed(4); });
  // placebo: shuffle buy / sell labels among the actual trades, per window, seeds 1..40
  const oosT = t5.filter((r) => windowOf(r.t) === 'oos'), plac = [];
  for (let seed = 1; seed <= 40; seed++) {
    const rnd = mulberry32(seed), sides = oosT.map((r) => r.side);
    for (let k = sides.length - 1; k > 0; k--) { const j = Math.floor(rnd() * (k + 1)); [sides[k], sides[j]] = [sides[j], sides[k]]; }
    const rows = oosT.map((r, k) => { const tr = trade(b, r.e, sides[k], r.risk / P.stopAtr, P.hold); return tr; });
    plac.push(r2(monthT(rows, 'oos', (r) => r.net - b5['oos:' + r.side].net).t));
  }
  const ps = [...plac].sort((a, c) => a - c);
  const placebo = { draws: 40, median: pct(ps, 0.5), max: ps[ps.length - 1], atLeastActual: plac.filter((x) => x >= S.T1.oos.tExcess).length, ts: plac };
  const T1 = tests[0];
  const pass = T1.t >= 2 && T1.holm < 0.05 && S.T1.is.excess > 0 && S.x2.oos.excess > 0;
  const years = {};
  for (const r of t5) { const y = ymd(r.t).slice(0, 4); if (!windowOf(r.t)) continue; (years[y] ||= { n: 0, net: 0 }); years[y].n++; years[y].net += r.net; }
  for (const y of Object.keys(years)) years[y].net = r2(years[y].net);
  return { signals: sigs.length, baseline: { h5: b5, h10: b10, h5x2: b5x2 }, S, tests, placebo, years, verdict: pass ? 'PASS' : 'FAIL' };
}

export function loadBars() {
  const j = JSON.parse(execFileSync('git', ['show', 'origin/council-data:research/daily/xau.json'], { maxBuffer: 64 << 20 }).toString());
  const rows = j.rows.map(([t, o, h, l, c]) => ({ time: t, open: o, high: h, low: l, close: c }));
  return { bars: foldWeekend(rows), updated: j.updated };
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const { bars, updated } = loadBars();
  const res = study(bars);
  const rnd = (o) => JSON.parse(JSON.stringify(o, (k, v) => typeof v === 'number' ? Math.round(v * 10000) / 10000 : v));
  const out = { study: 'gold-wick-pressure', built: '2026-11-14', verdict: res.verdict,
    data: { src: 'council-data research/daily/xau.json (OANDA mid, UTC days, weekend folded)', updated, from: ymd(bars[0].time), to: ymd(bars[bars.length - 1].time), days: bars.length },
    params: P, windows: { is: IS, oos: OOS }, costs: { roundTrip: P.cost, finLong: FIN.xau.long, finSrc: FIN.src }, ...rnd(res) };
  writeFileSync(path.join(path.dirname(fileURLToPath(import.meta.url)), 'result.json'), JSON.stringify(out, null, 1) + '\n');
  console.log(JSON.stringify({ verdict: out.verdict, tests: out.tests, T1: out.S.T1, T3: out.S.T3, x2oos: out.S.x2.oos, placebo: { ...out.placebo, ts: undefined }, base: out.baseline.h5 }, null, 1));
}
