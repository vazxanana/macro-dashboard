// Edge research · gold-squeeze (PREREGISTRATION.md, pushed first): Bollinger 20/2 inside Keltner 20/1.5 ATR for 6+ candles,
// then a close out of the Bollinger Bands; market at the next open in that direction, stop 1.5 ATR(20), out on a close back
// through the 20-period middle line or after N candles. T1 H4, T2 D1, T3 H4 with the SMA(50) slope. Spot gold, OANDA mid,
// $0.30 spread + half a spread of slippage each way, financing on buys (council/fills.mjs FIN). IS 2016-20, OOS 2021-now,
// t on calendar-month sums, Holm over three, 40-seed random-entry placebo. A stand-alone rule: not the gold book (item 44).
//   node research/edge/gold-squeeze/run.mjs <dir>    (dir from fetch.mjs) -> result.json next to this file
// Paper research: nothing here is read by the council, the mirror or the page.
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { foldWeekend, nights, FIN } from '../../../council/fills.mjs';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const T = (s) => Date.parse(s + 'T00:00:00Z') / 1000;
const r3 = (v) => (Number.isFinite(v) ? +v.toFixed(3) : null), r2 = (v) => (Number.isFinite(v) ? +v.toFixed(2) : null);

export const P = {
  LEN: 20, BBK: 2, KCK: 1.5, MINRUN: 6, RECENT: 5, STOP_ATR: 1.5, SLOPE_LEN: 50, SLOPE_LAG: 10,
  SPREAD: 0.30, SLIP: 0.5, SEEDS: 40,
  IS: ['2016-01-01', '2021-01-01'], OOS: ['2021-01-01', '2100-01-01'],
};
export const TESTS = {
  T1: { tf: '4h', hold: 30, slope: false, label: 'H4, both sides (primary)' },
  T2: { tf: '1d', hold: 20, slope: false, label: 'D1, both sides' },
  T3: { tf: '4h', hold: 30, slope: true, label: 'H4, with the SMA(50) slope' },
};

export const toBars = (rows) => rows.map(([t, o, h, l, c]) => ({ time: t, open: o, high: h, low: l, close: c }));

// ── indicators on closed candles (index i uses candles 0..i only) ──
export function indicators(bars, p = P) {
  const n = bars.length, L = p.LEN;
  const mid = new Array(n).fill(null), bbU = [...mid], bbL = [...mid], kcU = [...mid], kcL = [...mid], atr = [...mid], sq = new Array(n).fill(false), sma50 = [...mid];
  const tr = bars.map((b, i) => (i ? Math.max(b.high - b.low, Math.abs(b.high - bars[i - 1].close), Math.abs(b.low - bars[i - 1].close)) : b.high - b.low));
  for (let i = L; i < n; i++) {   // i >= L so every true range in the window has a previous close
    let s = 0, a = 0;
    for (let j = i - L + 1; j <= i; j++) { s += bars[j].close; a += tr[j]; }
    const m = s / L; let v = 0;
    for (let j = i - L + 1; j <= i; j++) v += (bars[j].close - m) ** 2;
    const sd = Math.sqrt(v / L); a /= L;
    mid[i] = m; bbU[i] = m + p.BBK * sd; bbL[i] = m - p.BBK * sd; atr[i] = a; kcU[i] = m + p.KCK * a; kcL[i] = m - p.KCK * a;
    sq[i] = bbU[i] < kcU[i] && bbL[i] > kcL[i];
  }
  for (let i = p.SLOPE_LEN - 1; i < n; i++) { let s = 0; for (let j = i - p.SLOPE_LEN + 1; j <= i; j++) s += bars[j].close; sma50[i] = s / p.SLOPE_LEN; }
  const slope = sma50.map((v, i) => (v != null && i >= p.SLOPE_LAG && sma50[i - p.SLOPE_LAG] != null ? v - sma50[i - p.SLOPE_LAG] : null));
  return { mid, bbU, bbL, kcU, kcL, atr, sq, slope };
}

// ── signals: the first band close after a squeeze run of MINRUN+ candles that ended in the last RECENT candles ──
export function signals(bars, ind, p = P) {
  const out = []; let run = 0, runEnd = -1, runLen = 0, used = true;
  for (let i = 0; i < bars.length; i++) {
    // state through i-1 is known here; check bar i as a signal before adding bar i to the run state
    if (ind.mid[i] != null && !used && runLen >= p.MINRUN && runEnd >= i - p.RECENT && runEnd <= i - 1) {
      const c = bars[i].close, side = c > ind.bbU[i] ? 1 : c < ind.bbL[i] ? -1 : 0;
      if (side) { out.push({ i, side, atr: ind.atr[i], slope: ind.slope[i] }); used = true; }
    }
    if (ind.sq[i]) { run++; if (run === 1) used = false; runEnd = i; runLen = run; } else run = 0;
  }
  return out;
}

// ── one trade from signal s: entry at bars[s.i+1].open; returns { side, t, c, fill, r0, R, exitIdx, why, held } or null ──
export function trade(bars, ind, s, hold, p = P) {
  const e = s.i + 1; if (e >= bars.length) return null;
  const side = s.side, fill = bars[e].open, r0 = p.STOP_ATR * s.atr, stop = fill - side * r0;
  const done = (px, k, why, c) => ({ side, t: bars[e].time, c, fill, stop, r0, R: side * (px - fill) / r0, exitIdx: k, why, held: k - e + 1 });
  for (let k = e; k < bars.length; k++) {
    const b = bars[k], span = (bars[k + 1]?.time ?? b.time + (bars[k].time - bars[k - 1].time)) - b.time;
    const hit = side > 0 ? b.low <= stop : b.high >= stop;
    if (hit) { const gap = k > e && (side > 0 ? b.open < stop : b.open > stop); return done(gap ? b.open : stop, k, gap ? 'gap' : 'stop', b.time + span); }
    if (k - e + 1 >= hold) return done(b.close, k, 'time', b.time + span);
    if (ind.mid[k] != null && (side > 0 ? b.close < ind.mid[k] : b.close > ind.mid[k])) {
      if (k + 1 >= bars.length) return null;   // exit candle not yet printed: trade still open, left out
      return done(bars[k + 1].open, k + 1, 'mid', bars[k + 1].time);
    }
  }
  return null;
}

// ── costs in R ──
export function costs(tr, mult = 1, p = P) {
  const price = (p.SPREAD + 2 * p.SLIP * p.SPREAD) * mult;   // spread + half a spread in + half a spread out
  const nn = nights(tr.t, tr.c), fin = tr.side > 0 ? mult * nn * FIN.xau.long * tr.fill / tr.r0 : 0;
  return { spread: price / tr.r0, fin, nights: nn };
}
export const withNet = (tr) => { const c1 = costs(tr, 1), c2 = costs(tr, 2); return { ...tr, net: tr.R - c1.spread - c1.fin, net2: tr.R - c2.spread - c2.fin, fin: c1.fin, nights: c1.nights }; };

// ── a stream: one position at a time ──
export function stream(bars, ind, test) {
  const out = []; let busy = -1, skipped = 0;
  for (const s of signals(bars, ind)) {
    if (test.slope && !(s.slope != null && Math.sign(s.slope) === s.side)) continue;
    if (s.i < busy) { skipped++; continue; }
    const tr = trade(bars, ind, s, test.hold);
    if (!tr) continue;
    out.push(withNet({ ...tr, sig: s.i })); busy = tr.exitIdx;
  }
  return { trades: out, skipped };
}

// ── statistics ──
export function erfc(x) { const z = Math.abs(x), t = 1 / (1 + 0.5 * z); const r = t * Math.exp(-z * z - 1.26551223 + t * (1.00002368 + t * (0.37409196 + t * (0.09678418 + t * (-0.18628806 + t * (0.27886807 + t * (-1.13520398 + t * (1.48851587 + t * (-0.82215223 + t * 0.17087277))))))))); return x >= 0 ? r : 2 - r; }
export const pOne = (t) => (Number.isFinite(t) ? 0.5 * erfc(t / Math.SQRT2) : 1);
const ym = (t) => { const d = new Date(t * 1000); return d.getUTCFullYear() * 12 + d.getUTCMonth(); };
export function monthT(rows, from, to, key = 'net') {
  const a = ym(from), b = ym(to), s = new Array(b - a + 1).fill(0);
  for (const r of rows) { const k = ym(r.c) - a; if (k >= 0 && k < s.length) s[k] += r[key]; }
  const n = s.length, mu = s.reduce((x, y) => x + y, 0) / n, sd = Math.sqrt(s.reduce((x, y) => x + (y - mu) ** 2, 0) / (n - 1));
  return { months: n, t: sd > 0 ? mu / sd * Math.sqrt(n) : null };
}
export function maxDD(rows) { let eq = 0, hi = 0, dd = 0; for (const r of rows) { eq += r.net; hi = Math.max(hi, eq); dd = Math.min(dd, eq - hi); } return dd; }
export function summary(rows, from, to) {
  const n = rows.length, mean = (k) => (n ? rows.reduce((a, r) => a + r[k], 0) / n : null);
  const m = monthT(rows, from, to), g = monthT(rows, from, to, 'R');
  const why = {}; for (const r of rows) why[r.why] = (why[r.why] || 0) + 1;
  return { n, buys: rows.filter((r) => r.side > 0).length, gross: r3(mean('R')), net: r3(mean('net')), net2: r3(mean('net2')), fin: r3(mean('fin')),
    totalNet: r2(rows.reduce((a, r) => a + r.net, 0)), win: n ? r3(rows.filter((r) => r.net > 0).length / n) : null, maxDD: r2(maxDD(rows)),
    months: m.months, t: r2(m.t), tGross: r2(g.t), p: +pOne(m.t).toFixed(4), heldMedian: n ? [...rows].map((r) => r.held).sort((a, b) => a - b)[n >> 1] : null, why };
}
export function holm(ps, alpha = 0.05) {
  const idx = ps.map((p, i) => [p, i]).sort((x, y) => x[0] - y[0]), adj = new Array(ps.length).fill(1); let run = 0;
  idx.forEach(([p, i], k) => { run = Math.max(run, Math.min(1, (ps.length - k) * p)); adj[i] = run; });
  return adj.map((a) => ({ adj: +a.toFixed(4), ok: a <= alpha }));
}
export function rng(seed) { let s = seed >>> 0; return () => { s = (s + 0x6D2B79F5) >>> 0; let t = s; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; }

// placebo: each real OOS trade -> a random candle of the OOS window, same side, 1.5 ATR stop, held its candles unless stopped
export function placebo(bars, ind, real, from, to, seeds = P.SEEDS) {
  const pool = []; for (let i = 0; i < bars.length - 1; i++) if (bars[i + 1].time >= from && bars[i + 1].time < to && ind.atr[i] != null) pool.push(i);
  const means = [];
  for (let s = 1; s <= seeds; s++) {
    const r = rng(s), rows = [];
    for (const x of real) {
      for (let tries = 0; tries < 50; tries++) {
        const i = pool[Math.floor(r() * pool.length)];
        const tr = trade(bars, { mid: [] }, { i, side: x.side, atr: ind.atr[i] }, x.held);
        if (tr) { rows.push(withNet(tr)); break; }
      }
    }
    means.push(rows.reduce((a, y) => a + y.net, 0) / rows.length);
  }
  means.sort((a, b) => a - b);
  const q = (f) => means[Math.min(means.length - 1, Math.floor(f * means.length))];
  return { seeds, median: r3(q(0.5)), p95: r3(q(0.95)), min: r3(means[0]), max: r3(means.at(-1)) };
}

export function load(dir) {
  const h4 = toBars(JSON.parse(fs.readFileSync(path.join(dir, 'xau-4h.json'), 'utf8')));
  const d1 = foldWeekend(toBars(JSON.parse(fs.readFileSync(path.join(dir, 'xau-1d.json'), 'utf8'))));
  return { '4h': h4, '1d': d1 };
}

export function run(data) {
  const now = data['4h'].at(-1).time, res = {}, ps = [];
  const isF = T(P.IS[0]), isT = T(P.IS[1]), oF = T(P.OOS[0]);
  for (const [k, test] of Object.entries(TESTS)) {
    const bars = data[test.tf], ind = indicators(bars), { trades, skipped } = stream(bars, ind, test);
    const isR = trades.filter((r) => r.t >= isF && r.t < isT), oR = trades.filter((r) => r.t >= oF);
    const oos = summary(oR, oF, now), ins = summary(isR, isF, isT - 1);
    const pl = placebo(bars, ind, oR, oF, now + 1);
    const years = {}; for (const r of trades.filter((x) => x.t >= isF)) { const y = new Date(r.t * 1000).getUTCFullYear(); (years[y] ||= { n: 0, net: 0 }); years[y].n++; years[y].net += r.net; }
    for (const y in years) years[y].net = r2(years[y].net);
    res[k] = { ...test, skipped, is: ins, oos, placebo: pl, years,
      bySide: { buy: summary(oR.filter((r) => r.side > 0), oF, now), sell: summary(oR.filter((r) => r.side < 0), oF, now) } };
    ps.push(oos.p);
  }
  const h = holm(ps);
  Object.keys(TESTS).forEach((k, j) => {
    const r = res[k];
    r.holm = h[j];
    r.checks = { tHolm: (r.oos.t ?? 0) >= 2 && h[j].ok, isSign: r.is.net > 0, x2: r.oos.net2 > 0, placebo: r.oos.net > r.placebo.p95 };
    r.pass = Object.values(r.checks).every(Boolean);
  });
  const verdict = res.T1.pass ? 'PASS' : 'FAIL';
  return { study: 'gold-squeeze', title: 'Gold volatility squeeze breakout (Bollinger inside Keltner, H4 and D1)', built: new Date().toISOString().slice(0, 10),
    verdict, data: { h4: { n: data['4h'].length, from: data['4h'][0].time, to: data['4h'].at(-1).time }, d1: { n: data['1d'].length, from: data['1d'][0].time, to: data['1d'].at(-1).time } },
    params: P, costs: { spread: P.SPREAD, slippageEachWay: P.SLIP * P.SPREAD, financingLong: FIN.xau.long, financingSrc: FIN.xau.src }, tests: res };
}

if (process.argv[1] && fileURLToPath(import.meta.url) === path.resolve(process.argv[1])) {
  const dir = process.argv[2]; if (!dir) { console.error('usage: run.mjs <dir>'); process.exit(1); }
  const out = run(load(dir));
  fs.writeFileSync(path.join(HERE, 'result.json'), JSON.stringify(out, null, 1) + '\n');
  for (const [k, r] of Object.entries(out.tests)) console.log(k, JSON.stringify({ is: r.is, oos: r.oos, placebo: r.placebo, holm: r.holm, checks: r.checks }));
  console.log('verdict', out.verdict);
}
