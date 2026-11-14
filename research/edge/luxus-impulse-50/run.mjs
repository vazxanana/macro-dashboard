// luxus-impulse-50 (study 144): the teacher's lesson "11 nov Gold": "The overall trend on Daily and weekly is bullish, then after
// price make impulsion buy it must retrace to the 50% at origin or create a new cf." Made mechanical on OANDA mid gold M5.
// Pre-registration: research/edge/luxus-impulse-50/PREREGISTRATION.md (pushed alone before any candle was read for this rule).
//   node --use-env-proxy research/edge/mosha-sweep/run.mjs fetch <dir>      OANDA mid M5 XAU/USD from June 2006 -> <dir>/xau-5m.json.gz
//   node research/edge/luxus-impulse-50/run.mjs full <dir>/xau-5m.json.gz   the study; writes result.json and RESULT.md
// Cache rows [t, o, h, l, c] (unix seconds), gzip JSON, kept outside git. Research only: nothing live reads this file.
// Buys are coded once; the sell mirror (Test 3) runs the same code on the negated price series.
import fs from 'node:fs';
import zlib from 'node:zlib';
import { FIN, nights, foldWeekend } from '../../../council/fills.mjs';

export const K = { P4: 3, PD: 2, PW: 2, P5: 1, BUF: 0.30, MIN_R0: 1.0, HOLD: 10 * 86400, CF_VALID: 24 * 3600, MIN_RR_CF: 1, COST: 0.60, ATR_N: 14 };
const M5 = 300, H4 = 14400, D = 86400;
const U = (y, m) => Date.UTC(y, m, 1) / 1000;
export const WIN = { rep: [U(2007, 0), U(2020, 0)], is: [U(2020, 0), U(2024, 0)], oos: [U(2024, 0), U(2026, 10)] };

// ─── candles ───
// columns of the M5 rows; sign -1 gives the mirrored (negated) series used for sells
export function cols(rows, sign = 1) {
  const n = rows.length, T = new Float64Array(n), O = new Float64Array(n), H = new Float64Array(n), L = new Float64Array(n), C = new Float64Array(n);
  for (let k = 0; k < n; k++) { const r = rows[k]; T[k] = r[0];
    if (sign > 0) { O[k] = r[1]; H[k] = r[2]; L[k] = r[3]; C[k] = r[4]; } else { O[k] = -r[1]; H[k] = -r[3]; L[k] = -r[2]; C[k] = -r[4]; } }
  return { n, T, O, H, L, C, sign };
}
// aggregate M5 into candles keyed by key(t); each candle { time, open, high, low, close, a, b (M5 index range), end (last M5 + 5 min) }
export function agg(m, key) {
  const out = []; let cur = null;
  for (let k = 0; k < m.n; k++) { const t = key(m.T[k]);
    if (!cur || cur.time !== t) { cur = { time: t, open: m.O[k], high: m.H[k], low: m.L[k], close: m.C[k], a: k, b: k + 1 }; out.push(cur); }
    else { if (m.H[k] > cur.high) cur.high = m.H[k]; if (m.L[k] < cur.low) cur.low = m.L[k]; cur.close = m.C[k]; cur.b = k + 1; } }
  for (const c of out) c.end = m.T[c.b - 1] + M5;
  return out;
}
const dayOf = (t) => Math.floor(t / D) * D;
// a weekend time belongs to the Monday after it (as foldWeekend)
export const tradeDay = (t) => { let d = dayOf(t); const w = new Date(d * 1000).getUTCDay(); if (w === 6) d += 2 * D; else if (w === 0) d += D; return d; };
export const weekOf = (t) => { const d = tradeDay(t), w = new Date(d * 1000).getUTCDay(); return d - ((w + 6) % 7) * D; };
export function frames(m) {
  const h4 = agg(m, (t) => Math.floor(t / H4) * H4);
  // D1: UTC days with the weekend folded into Monday (foldWeekend keeps the weekday's time; the end is the last M5 of the day)
  const raw = agg(m, dayOf), folded = foldWeekend(raw), byT = new Map(raw.map((c) => [c.time, c]));
  const d1 = folded.map((c) => ({ ...c, end: byT.get(c.time).end }));
  const w1 = agg(m, weekOf);
  return { h4, d1, w1 };
}

// ─── structure: BO events (his "BO buy: a close above a high", "BO sell: a close below a low") ───
// A swing high is strictly above the P candles each side; usable from the candle after the P-th candle after it closes. A BO is a
// close beyond the most recent swing not yet closed beyond; every swing the close goes through is used up. For a BO buy the origin
// is the lowest low from the broken swing to the BO candle (a BO sell: the highest high). Events carry the candle's end (when known).
export function boEvents(bars, P) {
  const ev = [], hiS = [], loS = [];
  for (let j = 0; j < bars.length; j++) {
    const i = j - P - 1;
    if (i >= P) { let isH = true, isL = true;
      for (let k = i - P; k <= i + P; k++) { if (k === i) continue; if (!(bars[i].high > bars[k].high)) isH = false; if (!(bars[i].low < bars[k].low)) isL = false; }
      if (isH) hiS.push({ i, level: bars[i].high }); if (isL) loS.push({ i, level: bars[i].low }); }
    const b = bars[j];
    for (const [side, st] of [[1, hiS], [-1, loS]]) {
      if (!st.length) continue; const ref = st[st.length - 1];
      if (!(side > 0 ? b.close > ref.level : b.close < ref.level)) continue;
      let origin = side > 0 ? Infinity : -Infinity, ext = side > 0 ? -Infinity : Infinity;
      for (let k = ref.i; k <= j; k++) { if (side > 0) { origin = Math.min(origin, bars[k].low); } else origin = Math.max(origin, bars[k].high); }
      // the leg's extreme: the highest high (lowest low) from the origin candle to the BO candle
      let oi = ref.i; for (let k = ref.i; k <= j; k++) if (side > 0 ? bars[k].low === origin : bars[k].high === origin) { oi = k; break; }
      for (let k = oi; k <= j; k++) ext = side > 0 ? Math.max(ext, bars[k].high) : Math.min(ext, bars[k].low);
      for (let k = st.length - 1; k >= 0; k--) if (side > 0 ? b.close > st[k].level : b.close < st[k].level) st.splice(k, 1);
      ev.push({ j, end: b.end, side, level: ref.level, origin, ext });
    }
  }
  return ev;
}
// trend at time t = the side of the last event that ended at or before t (0 when none)
export function trendAt(ev, t) { let lo = 0, hi = ev.length; while (lo < hi) { const md = (lo + hi) >> 1; if (ev[md].end <= t) lo = md + 1; else hi = md; } return lo ? ev[lo - 1].side : 0; }
// the first time after t at which the D1 / W1 pair stops being bullish (Infinity when it never does in the data)
export function trendBreak(dEv, wEv, t) {
  const nx = (ev) => { let lo = 0, hi = ev.length; while (lo < hi) { const md = (lo + hi) >> 1; if (ev[md].end <= t) lo = md + 1; else hi = md; } for (let k = lo; k < ev.length; k++) if (ev[k].side < 0) return ev[k].end; return Infinity; };
  return Math.min(nx(dEv), nx(wEv));
}

const firstAt = (m, t) => { let lo = 0, hi = m.n; while (lo < hi) { const md = (lo + hi) >> 1; if (m.T[md] < t) lo = md + 1; else hi = md; } return lo; };

// manage an open buy filled on candle k0 at entry (the fill candle: stop only), to target / stop / 10 days. Stop first on a tie.
export function manage(m, k0, entry, stop, target) {
  const end = m.T[k0] + K.HOLD;
  if (m.L[k0] <= stop) return { k: k0, px: Math.min(m.O[k0], stop), how: 'stop' };
  for (let k = k0 + 1; k < m.n; k++) {
    if (m.O[k] <= stop) return { k, px: m.O[k], how: 'stop' };
    if (m.L[k] <= stop) return { k, px: stop, how: 'stop' };
    if (m.H[k] >= target) return { k, px: target, how: 'target' };
    if (m.T[k] + M5 >= end) return { k, px: m.C[k], how: 'time' };
  }
  return null; // still open at the end of the data
}
// costs in R: the round trip and, on real buys only, financing (nights x FIN x entry / risk)
export function costR(tr, mult = 1) {
  const fin = tr.side > 0 ? nights(tr.fillT, tr.exitT) * FIN.xau.long * tr.px / tr.risk : 0;
  return mult * (K.COST / tr.risk + fin);
}
function trade(m, side, k0, entry, stop, target, extra) {
  const ex = manage(m, k0, entry, stop, target); if (!ex) return null;
  const risk = entry - stop, R = (ex.px - entry) / risk;
  const tr = { ...extra, side, fillT: m.T[k0], exitT: m.T[ex.k] + M5, px: Math.abs(entry), entry: side * entry, stop: side * stop, target: side * target, risk, R, how: ex.how };
  tr.net = R - costR(tr); tr.net2 = R - costR(tr, 2); return tr;
}

// Test 1: limit at the 50 % at origin, the leg high following new highs while unfilled. Returns { status, trade?, until }.
export function order50(m, ev, kStart, cancelT) {
  const origin = ev.origin, stop = origin - K.BUF; let hh = ev.ext;
  if (origin + 0.5 * (hh - origin) - stop < K.MIN_R0) return { status: 'small', until: m.T[kStart] };
  for (let k = kStart; k < m.n; k++) {
    if (m.T[k] >= cancelT) return { status: 'cancelled', until: m.T[k] };
    const lim = origin + 0.5 * (hh - origin);
    if (m.O[k] <= stop) return { status: 'gapped', until: m.T[k] + M5 };
    if (m.L[k] <= lim) {
      const px = Math.min(m.O[k], lim), tr = trade(m, m.sign, k, px, stop, hh, { sigT: ev.end, origin: m.sign * origin, legHigh: m.sign * hh });
      return tr ? { status: 'filled', trade: tr, until: tr.exitT } : { status: 'dataEnd', until: Infinity };
    }
    if (m.H[k] > hh) hh = m.H[k];
    if (m.C[k] < origin) return { status: 'cancelled', until: m.T[k] + M5 };
  }
  return { status: 'dataEnd', until: Infinity };
}
// M5 swing highs (1 a side, as mosha-sweep: not below the candle before, strictly above the candle after)
export function swingHi(m, w = K.P5) {
  const hi = new Uint8Array(m.n);
  for (let j = w; j < m.n - w; j++) { let h = 1; for (let q = 1; q <= w && h; q++) if (m.H[j - q] > m.H[j] || m.H[j + q] >= m.H[j]) h = 0; hi[j] = h; }
  return hi;
}
// Test 2: before the 50 % is touched, the first M5 CF buy (close above the VR top: the last M5 swing high after the leg high and
// before the pullback's low); then a limit at the broken level, stop $0.30 under the break candle's low, 24 h, target the leg high.
export function orderCF(m, ev, kStart, cancelT, hi) {
  const origin = ev.origin; let hh = ev.ext, hhK = kStart - 1, ext = Infinity, v = null, last = -1;
  for (let j = kStart - 2; j >= 0 && j >= kStart - 400; j--) if (hi[j]) { last = j; break; }
  for (let k = kStart; k < m.n; k++) {
    if (m.T[k] >= cancelT) return { status: 'cancelled', until: m.T[k] };
    if (k - 2 >= 0 && hi[k - 2]) last = k - 2; // a swing high at k-2 is confirmed by k-1's close, known when k opens
    if (m.L[k] <= origin + 0.5 * (hh - origin)) return { status: 'touched50', until: m.T[k] + M5 };
    if (m.H[k] > hh) { hh = m.H[k]; hhK = k; ext = Infinity; v = null; continue; }
    if (m.L[k] < ext) { ext = m.L[k]; v = last > hhK ? m.H[last] : null; }
    if (v != null && m.C[k] > v) {
      const entry = v, base = m.L[k], stop = base - K.BUF, risk = entry - stop, target = hh, cfT = m.T[k] + M5;
      if (risk < K.MIN_R0) return { status: 'small', until: cfT };
      if (target - entry < K.MIN_RR_CF * risk) return { status: 'noRoom', until: cfT };
      const endT = Math.min(cfT + K.CF_VALID, cancelT);
      for (let q = k + 1; q < m.n; q++) {
        if (m.T[q] >= endT) return { status: 'expired', until: m.T[q] };
        if (m.O[q] <= stop) return { status: 'gapped', until: m.T[q] + M5 };
        if (m.L[q] <= entry) {
          const tr = trade(m, m.sign, q, Math.min(m.O[q], entry), stop, target, { sigT: ev.end, cfT, origin: m.sign * origin, legHigh: m.sign * hh });
          return tr ? { status: 'filled', trade: tr, until: tr.exitT } : { status: 'dataEnd', until: Infinity };
        }
        if (m.C[q] < base) return { status: 'cancelled', until: m.T[q] + M5 };
      }
      return { status: 'dataEnd', until: Infinity };
    }
  }
  return { status: 'dataEnd', until: Infinity };
}

// one test as a stream on one view (buys on the series as given; Test 3 passes the negated series), one order or position at a time
export function stream(m, kind, F = frames(m), hi = kind === 'CF' ? swingHi(m) : null) {
  const h4 = boEvents(F.h4, K.P4), dEv = boEvents(F.d1, K.PD), wEv = boEvents(F.w1, K.PW);
  const T = [], cnt = { h4bo: 0, trendOk: 0, busy: 0 }; let free = -Infinity;
  for (let e = 0; e < h4.length; e++) {
    const ev = h4[e]; if (ev.side < 0) continue; cnt.h4bo++;
    if (!(trendAt(dEv, ev.end) > 0 && trendAt(wEv, ev.end) > 0)) continue; cnt.trendOk++;
    if (ev.end < free) { cnt.busy++; continue; }
    // the next H4 BO (either side) cancels / replaces a waiting T1 order; a BO sell cancels the CF watch and its limit
    let nextAny = Infinity, nextSell = Infinity; for (let q = e + 1; q < h4.length; q++) { if (nextAny === Infinity) nextAny = h4[q].end; if (h4[q].side < 0) { nextSell = h4[q].end; break; } }
    const cancelT = Math.min(kind === 'CF' ? nextSell : nextAny, trendBreak(dEv, wEv, ev.end)), k0 = firstAt(m, ev.end);
    const r = kind === 'CF' ? orderCF(m, ev, k0, cancelT, hi) : order50(m, ev, k0, cancelT);
    cnt[r.status] = (cnt[r.status] || 0) + 1;
    if (r.trade) T.push(r.trade);
    free = r.until;
  }
  return { T, cnt };
}

// ─── statistics ───
const ym = (t) => { const d = new Date(t * 1000); return d.getUTCFullYear() * 12 + d.getUTCMonth(); };
export function monthT(T, from, to, key = 'net') {
  const a = ym(from), b = ym(to - 1), s = new Array(b - a + 1).fill(0);
  for (const x of T) if (x.fillT >= from && x.fillT < to) s[ym(x.fillT) - a] += x[key];
  const n = s.length, mu = s.reduce((p, v) => p + v, 0) / n, sd = Math.sqrt(s.reduce((p, v) => p + (v - mu) ** 2, 0) / (n - 1));
  return { months: n, t: sd > 0 ? +(mu / (sd / Math.sqrt(n))).toFixed(2) : 0 };
}
function erfc(x) { const z = Math.abs(x), t = 1 / (1 + 0.5 * z); const r = t * Math.exp(-z * z - 1.26551223 + t * (1.00002368 + t * (0.37409196 + t * (0.09678418 + t * (-0.18628806 + t * (0.27886807 + t * (-1.13520398 + t * (1.48851587 + t * (-0.82215223 + t * 0.17087277))))))))); return x >= 0 ? r : 2 - r; }
export const pOne = (t) => 0.5 * erfc(t / Math.SQRT2);
export function holm(ps) { const o = ps.map((p, i) => [p, i]).sort((a, b) => a[0] - b[0]), out = new Array(ps.length); let run = 0;
  o.forEach(([p, i], r) => { run = Math.max(run, Math.min(1, p * (ps.length - r))); out[i] = run; }); return out; }
export function summary(T, key = 'net') {
  const n = T.length; if (!n) return { n: 0, avg: 0, total: 0, wr: 0, pf: null, dd: 0 };
  let tot = 0, peak = 0, dd = 0, win = 0, gp = 0, gl = 0;
  for (const x of [...T].sort((a, b) => a.exitT - b.exitT)) { const v = x[key]; tot += v; peak = Math.max(peak, tot); dd = Math.min(dd, tot - peak); if (v > 0) { win++; gp += v; } else gl -= v; }
  return { n, avg: +(tot / n).toFixed(3), total: +tot.toFixed(1), wr: +(100 * win / n).toFixed(1), pf: gl ? +(gp / gl).toFixed(2) : null, dd: +dd.toFixed(1) };
}
export function mulberry(seed) { let a = seed >>> 0; return () => { a = (a + 0x6D2B79F5) >>> 0; let t = a; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; }
// market entry at the open of M5 candle k with the given distances (on the view's own series, so always a buy there)
function marketTrade(m, side, k, stopD, tgtD) { const e = m.O[k]; return trade(m, side, k, e, e - stopD, e + tgtD, {}); }
// placebo: the same number of entries at random M5 opens of the window, each with the distances of a randomly drawn real trade
export function placebo(m, X, [from, to], seed) {
  if (!X.length) return [];
  const rnd = mulberry(seed), a = firstAt(m, from), b = firstAt(m, to), out = [];
  for (let i = 0; i < X.length; i++) { const x = X[Math.floor(rnd() * X.length)], k = a + Math.floor(rnd() * (b - a));
    const tr = marketTrade(m, x.side, k, x.risk, Math.abs(x.target - x.entry)); if (tr) out.push(tr); }
  return out;
}
// control keeping drift and volatility: a market entry at every H4 open of the window, the test's median stop / target in H4 ATRs
export function control(m, h4, X, [from, to]) {
  if (!X.length) return null;
  const A = new Array(h4.length).fill(null); let a = null, s = 0;
  for (let i = 0; i < h4.length; i++) { const b = h4[i], tr = i ? Math.max(b.high - b.low, Math.abs(b.high - h4[i - 1].close), Math.abs(b.low - h4[i - 1].close)) : b.high - b.low;
    if (i < K.ATR_N) { s += tr; if (i === K.ATR_N - 1) a = s / K.ATR_N; } else a = (a * (K.ATR_N - 1) + tr) / K.ATR_N; A[i] = a; }
  const med = (v) => [...v].sort((p, q) => p - q)[v.length >> 1], idx = new Map(h4.map((b, i) => [b.time, i]));
  const atrAt = (t) => { const i = idx.get(Math.floor(t / H4) * H4); return i > 0 ? A[i - 1] : null; };
  const mS = med(X.map((x) => x.risk / atrAt(x.fillT)).filter(Number.isFinite)), mT = med(X.map((x) => Math.abs(x.target - x.entry) / atrAt(x.fillT)).filter(Number.isFinite));
  const out = []; const side = X[0].side;
  for (let i = 1; i < h4.length; i++) { const b = h4[i]; if (b.time < from || b.time >= to || A[i - 1] == null) continue;
    const tr = marketTrade(m, side, b.a, mS * A[i - 1], mT * A[i - 1]); if (tr) out.push(tr); }
  return { mStop: +mS.toFixed(2), mTarget: +mT.toFixed(2), net: summary(out), gross: summary(out, 'R') };
}

export const TESTS = { T1: { side: 1, kind: '50', rule: 'buy limit at the 50 % at origin of an H4 BO buy, Daily and Weekly bullish' },
  T2: { side: 1, kind: 'CF', rule: 'buy at the zone of the break of an M5 CF made before the 50 % is touched, Daily and Weekly bullish' },
  T3: { side: -1, kind: '50', rule: 'sell limit at the 50 % at origin of an H4 BO sell, Daily and Weekly bearish (mirror of T1)' } };
export const P_T2 = 0.02275;

export function analyse(rows) {
  const views = { 1: cols(rows, 1), '-1': cols(rows, -1) }, fr = { 1: frames(views[1]), '-1': frames(views[-1]) };
  const end = rows[rows.length - 1][0] + M5;
  const res = { topic: 'luxus-impulse-50', built: '2026-11-14', data: { from: new Date(rows[0][0] * 1000).toISOString().slice(0, 10), to: new Date((end - M5) * 1000).toISOString().slice(0, 10), m5: rows.length, h4: fr[1].h4.length, d1: fr[1].d1.length, w1: fr[1].w1.length, src: 'OANDA mid M5 XAU/USD via the site proxy' },
    rule: { ...K, fin: FIN.xau.long }, windows: { rep: '2007-01 to 2019-12', is: '2020-01 to 2023-12', oos: '2024-01 to 2026-10' }, tests: {} };
  for (const [name, def] of Object.entries(TESTS)) {
    const m = views[def.side], { T, cnt } = stream(m, def.kind, fr[def.side]), r = { rule: def.rule, counts: cnt };
    for (const [w, rng] of Object.entries(WIN)) {
      const X = T.filter((x) => x.fillT >= rng[0] && x.fillT < rng[1]);
      r[w] = { net: summary(X), gross: summary(X, 'R'), net2: summary(X, 'net2'), tNet: monthT(T, ...rng).t, tGross: monthT(T, ...rng, 'R').t, tNet2: monthT(T, ...rng, 'net2').t, months: monthT(T, ...rng).months,
        exits: { stop: X.filter((x) => x.how === 'stop').length, target: X.filter((x) => x.how === 'target').length, time: X.filter((x) => x.how === 'time').length },
        medianRisk: X.length ? +[...X].map((x) => x.risk).sort((a, b) => a - b)[X.length >> 1].toFixed(2) : null };
      const pl = []; for (let s = 1; s <= 40; s++) pl.push(summary(placebo(m, X, rng, s)).avg);
      r[w].placebo = { beaten: pl.filter((v) => r[w].net.avg > v).length, median: +[...pl].sort((a, b) => a - b)[20].toFixed(3) };
      const c = control(m, fr[def.side].h4, X, rng); r[w].control = c && { ...c, excess: +(r[w].net.avg - c.net.avg).toFixed(3) };
    }
    const years = {}; for (const x of T) { const y = new Date(x.fillT * 1000).getUTCFullYear(); (years[y] ||= []).push(x); }
    r.years = Object.fromEntries(Object.entries(years).map(([y, X]) => [y, { n: X.length, net: +X.reduce((p, x) => p + x.net, 0).toFixed(1), gross: +X.reduce((p, x) => p + x.R, 0).toFixed(1) }]));
    r.p = pOne(r.oos.tNet); res.tests[name] = r;
    r.trades = T.filter((x) => x.fillT >= WIN.is[0] && x.fillT < WIN.oos[1]).map((x) => ({ d: new Date(x.fillT * 1000).toISOString().slice(0, 16), side: x.side > 0 ? 'buy' : 'sell', entry: +x.entry.toFixed(2), stop: +x.stop.toFixed(2), target: +x.target.toFixed(2), how: x.how, R: +x.R.toFixed(3), net: +x.net.toFixed(3) }));
  }
  const ks = Object.keys(TESTS), adj = holm(ks.map((k) => res.tests[k].p));
  ks.forEach((k, i) => { const r = res.tests[k]; r.p = +r.p.toFixed(4); r.pHolm = +adj[i].toFixed(4);
    r.checks = { oosT2: r.oos.tNet >= 2, holm: adj[i] < 0.05, isPos: r.is.net.avg > 0, cost2: r.oos.net2.avg > 0, n30: r.oos.net.n >= 30 };
    r.pass = Object.values(r.checks).every(Boolean); });
  res.verdict = res.tests.T1.pass ? 'PASS' : 'FAIL';
  res.passed = ks.filter((k) => res.tests[k].pass).length;
  return res;
}

// ─── the report ───
const sg = (v, d = 3) => (v > 0 ? '+' : v < 0 ? '−' : '') + Math.abs(v).toFixed(d);
export function headline(res) {
  const t1 = res.tests.T1;
  return `**Verdict: ${res.verdict}, ${res.passed} of 3: a limit at the 50 % of an H4 BO buy leg with Daily and Weekly bullish made ${sg(t1.oos.net.avg)}R a trade net out of sample (n ${t1.oos.net.n}, month t ${t1.oos.tNet}).**`;
}
export function report(res) {
  const L = [`# Result: Luxus's "retrace to the 50 % at origin, or a new CF" on gold (14 Nov 2026)`, '', headline(res), '',
    'Pre-registration: `PREREGISTRATION.md` (pushed alone, before any candle was read for this rule). Paper research only: a',
    'stand-alone rule, never a gate, exit, entry or size of the live gold book; nothing live changed, nothing was written to the Mosha',
    'desk. This page is written by `run.mjs` from `result.json`.', '',
    `Data: ${res.data.src}, ${res.data.from} to ${res.data.to} (${res.data.m5.toLocaleString('en-US')} M5 candles; H4 ${res.data.h4}, D1 ${res.data.d1}, W1 ${res.data.w1}).`,
    `Costs: $${K.COST.toFixed(2)} a round trip plus financing on buys (nights x ${FIN.xau.long} x entry / risk). t on calendar-month sums of the window, empty months 0;`,
    'Holm over the three tests on the out-of-sample one-sided p. Windows by fill time: replication 2007-19, in sample 2020-23, out of sample 2024 to Oct 2026.', '',
    '| Test | Window | n | Win % | Gross R a trade | Net R a trade | Month t gross | Month t net | Net at 2x costs | PF net | Worst DD | Median risk $ |',
    '|---|---|---|---|---|---|---|---|---|---|---|---|'];
  const WN = { rep: 'Replication 2007-19', is: 'In sample 2020-23', oos: 'Out of sample 2024-26' };
  for (const [k, r] of Object.entries(res.tests)) for (const w of ['rep', 'is', 'oos']) { const x = r[w];
    L.push(`| ${w === 'rep' ? `${k}` : ''} | ${WN[w]} | ${x.net.n} | ${x.net.wr} | ${sg(x.gross.avg)} | ${sg(x.net.avg)} | ${x.tGross} | ${x.tNet} | ${sg(x.net2.avg)} | ${x.net.pf ?? '-'} | ${x.net.dd}R | ${x.medianRisk ?? '-'} |`); }
  L.push('', '| Test | One-sided p (OOS) | Holm p | Placebo draws beaten, OOS (of 40) | Placebo median OOS | Control net OOS | Test minus control OOS | Checks met |', '|---|---|---|---|---|---|---|---|');
  for (const [k, r] of Object.entries(res.tests)) { const o = r.oos, met = Object.entries(r.checks).filter(([, v]) => v).map(([n]) => n).join(', ') || 'none';
    L.push(`| ${k} | ${r.p} | ${r.pHolm} | ${o.placebo.beaten} | ${sg(o.placebo.median)} | ${o.control ? sg(o.control.net.avg) : '-'} | ${o.control ? sg(o.control.excess) : '-'} | ${met} |`); }
  L.push('', '## The tests', '');
  for (const [k, r] of Object.entries(res.tests)) {
    const c = r.counts, o = r.oos;
    L.push(`- **${k}**: ${r.rule}. H4 BOs on its side: ${c.h4bo}; with Daily and Weekly agreeing: ${c.trendOk}; skipped while busy: ${c.busy}; ` +
      `orders: ${Object.entries(c).filter(([n]) => !['h4bo', 'trendOk', 'busy'].includes(n)).map(([n, v]) => `${n} ${v}`).join(', ')}. ` +
      `Out of sample exits: ${o.exits.stop} stopped, ${o.exits.target} target, ${o.exits.time} time. Control (every H4 open, ${o.control ? `${o.control.mStop} ATR stop, ${o.control.mTarget} ATR target` : 'none'}). ` +
      `Years (net R): ${Object.entries(r.years).filter(([y]) => +y >= 2020).map(([y, v]) => `${y} ${sg(v.net, 1)}`).join(', ')}.`);
  }
  const t1 = res.tests.T1;
  L.push('', '## What it means', '',
    `Pass bar (pre-registered): out-of-sample net month t >= 2 with Holm p < 0.05, the in-sample net mean positive, the out-of-sample net mean still positive at 2x costs, 30+ out-of-sample trades; the study passes only on Test 1. ${res.verdict === 'PASS' ? 'Test 1 meets it.' : `Test 1 does not (${Object.entries(t1.checks).filter(([, v]) => !v).map(([n]) => n).join(', ')} not met).`}`,
    '', 'Closest prior study: `gold-ote-retrace` (a limit at the 0.705 of an H1 structure-break leg, FAIL, out of sample -0.230R a trade). This one',
    'differs by the H4 BO leg, the 50 % at origin, the Daily AND Weekly last-BO agreement and the CF branch (see the pre-registration).',
    '', 'This tests a mechanical reading of one lesson: the structure (a close beyond the last swing), the 50 % of the H4 leg from its origin, the',
    'Daily and Weekly agreement, and, for the CF branch, the desk\'s unconfirmed VR. It does not judge the teacher\'s own discretionary',
    'reading of a chart. Assumptions A1-A11 are listed in the pre-registration. Nothing live changed and no proposal is made.', '');
  return L.join('\n');
}

if (process.argv[1] && import.meta.url === new URL(`file://${process.argv[1]}`).href) {
  const [cmd, file] = process.argv.slice(2);
  if (cmd === 'full') {
    const rows = JSON.parse(zlib.gunzipSync(fs.readFileSync(file))).filter((r) => r[0] < Date.UTC(2026, 10, 14) / 1000);
    const res = analyse(rows);
    fs.writeFileSync(new URL('./result.json', import.meta.url), JSON.stringify(res, null, 1) + '\n');
    fs.writeFileSync(new URL('./RESULT.md', import.meta.url), report(res));
    for (const [k, r] of Object.entries(res.tests)) console.log(k, JSON.stringify({ c: r.counts, rep: [r.rep.net.n, r.rep.net.avg, r.rep.tNet], is: [r.is.net.n, r.is.gross.avg, r.is.net.avg, r.is.tNet], oos: [r.oos.net.n, r.oos.gross.avg, r.oos.net.avg, r.oos.tNet, r.oos.tGross], n2: r.oos.net2.avg, pl: r.oos.placebo, ctl: r.oos.control && r.oos.control.excess, pH: r.pHolm, pass: r.pass }));
    console.log(res.verdict);
  } else console.log('usage: run.mjs full <xau-5m.json.gz>');
}
