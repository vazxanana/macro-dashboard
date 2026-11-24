// research/edge/big-candle-fade-plus/explore.mjs - EXPLORATION, IN SAMPLE (24 Nov 2026). Not a test and not evidence.
// On the ten markets big-candle-fade already read (2005 to Oct 2026), the big-candle fade (M15 body > 1.5 x ATR(14) of the
// candles before) is traded with pieces of the desk's other methods to see what turns a before-cost tilt into an after-cost
// one: an engulf-style confirmation candle (MSNR / engulfing desks), a limit entry inside the move, wider stops, the
// prior-day high / low sweep (ICT turtle soup / LIT inducement), the D1 trend and H4 structure side (direction desks), the US
// release clock, the candle's own wick. Whatever is picked here is only a candidate: it is pre-registered and judged on
// markets this study never read (see PREREGISTRATION.md). Research only; nothing live reads it.
//   EDGE_DATA=<cache> node research/edge/big-candle-fade-plus/explore.mjs rows <market> <outDir>
//   node research/edge/big-candle-fade-plus/explore.mjs table <outDir> [filter...]
import fs from 'node:fs';
import path from 'node:path';
import zlib from 'node:zlib';
import { fileURLToPath } from 'node:url';
import * as K from '../_lib/edgekit.mjs';
import { frames } from '../combo-grid-3/run.mjs';
import { COSTS, exclusions } from '../combo-grid-2/run.mjs';
import { atr14, startIdx } from '../dom-trade-through/run.mjs';
import { breaks } from '../grid7-wide-fade/run.mjs';

export const ENTRIES = ['mkt', 'conf', 'lim25'], STOPS = [0.1, 0.5, 1.0], EXITS = ['half', 'full', '2R'];
export const CAPS = 86400, KMIN = 1.5;

// one trade: side s, fill price at index fi (fillOnly = the fill candle can only stop it), targets in price; null if unresolved
export function sim(M5, s, fi, fill, stop, tg, cap, fillOnly) {
  const risk = s * (fill - stop); if (!(risk > 0)) return null;
  const R = tg.map(() => NaN); let left = tg.filter(Number.isFinite).length; const dl = M5[fi].t + cap;
  const fin = (k, px) => { if (Number.isFinite(tg[k]) && Number.isNaN(R[k])) { R[k] = (s * (px - fill)) / risk; left--; } };
  for (let j = fi; j < M5.length && left; j++) { const b = M5[j];
    if (j > fi) { if (s * (b.o - stop) <= 0) tg.forEach((_, k) => fin(k, b.o)); else tg.forEach((x, k) => { if (s * (b.o - x) >= 0) fin(k, b.o); }); }
    if (s * ((s > 0 ? b.l : b.h) - stop) <= 0) tg.forEach((_, k) => fin(k, stop));
    if (!(fillOnly && j === fi)) tg.forEach((x, k) => { if (s * ((s > 0 ? b.h : b.l) - x) >= 0) fin(k, x); });
    if (b.e >= dl) tg.forEach((_, k) => fin(k, b.c)); }
  return left ? null : R;
}

const inBad = (X, t) => { let lo = 0, hi = X.length; while (lo < hi) { const m = (lo + hi) >> 1; if (X[m][0] <= t) lo = m + 1; else hi = m; } return lo > 0 && t <= X[lo - 1][1]; };
const lastClosed = (B, t) => { let lo = 0, hi = B.length; while (lo < hi) { const m = (lo + hi) >> 1; if (B[m].e <= t) lo = m + 1; else hi = m; } return lo - 1; };

export function rows(market, costIn = COSTS[market]) {
  const costOf = typeof costIn === 'function' ? costIn : () => costIn;
  const M5 = K.load(market, '5m', { from: '2004-01-01', to: '2026-11-01' }); const F = frames(M5);
  const T = F['15m'], D = F['1d'], H4 = F['4h'], atr = atr14(T), dAtr = atr14(D), X = exclusions(market);
  const brkAt = new Map(breaks(T).map((e) => [e.i, e.dir])), h4side = K.structure(H4, 3).side;
  const dSma = D.map((_, i) => (i >= 20 ? D.slice(i - 19, i + 1).reduce((a, b) => a + b.c, 0) / 20 : NaN));
  const out = [];
  for (let j = 15; j < T.length - 1; j++) {
    const b = T[j], a = atr[j - 1]; if (!(a > 0)) continue; const body = Math.abs(b.c - b.o); if (!(body > KMIN * a)) continue;
    const d = b.c > b.o ? 1 : -1, s = -d, ext = d > 0 ? b.h : b.l, mid = (b.h + b.l) / 2, rng = b.h - b.l;
    const di = lastClosed(D, b.e), hi = lastClosed(H4, b.e); if (di < 21 || hi < 0) continue;
    const pd = D[di], feat = {
      k: body / a, brk: brkAt.get(j) === d ? 1 : 0, h: new Date(b.t * 1000).getUTCHours(), m: new Date(b.t * 1000).getUTCMinutes(),
      d1: Math.sign(pd.c - dSma[di]) === d ? 1 : -1, h4: h4side[hi] === d ? 1 : h4side[hi] === -d ? -1 : 0,
      sweep: d > 0 ? (b.h > pd.h ? (b.c > pd.h ? 2 : 1) : 0) : (b.l < pd.l ? (b.c < pd.l ? 2 : 1) : 0),
      wick: rng > 0 ? (d > 0 ? b.h - b.c : b.c - b.l) / rng : 0, rel: dAtr[di] > 0 ? rng / dAtr[di] : 0 };
    const nx = T[j + 1]; feat.conf = (d > 0 ? nx.c < nx.o : nx.c > nx.o) ? 1 : 0;
    const R = {}; let t0 = null;
    for (const en of ENTRIES) {
      let fi, fill, fillOnly = false;
      if (en === 'mkt') { fi = startIdx(M5, b.e); if (fi >= M5.length) continue; fill = M5[fi].o; }
      else if (en === 'conf') { if (!feat.conf) continue; fi = startIdx(M5, nx.e); if (fi >= M5.length) continue; fill = M5[fi].o; }
      else { const L = b.c + d * 0.25 * rng; fi = startIdx(M5, b.e); const end = b.e + 3600; fill = L; fillOnly = true;
        while (fi < M5.length && M5[fi].t < end && !(d > 0 ? M5[fi].h >= L : M5[fi].l <= L)) fi++;
        if (fi >= M5.length || M5[fi].t >= end) continue; if (d > 0 ? M5[fi].o > L : M5[fi].o < L) fill = M5[fi].o; }
      const t = M5[fi].t; if (t < Date.UTC(2005, 0, 1) / 1000 || t >= Date.UTC(2026, 10, 1) / 1000) continue; if (X.length && inBad(X, t)) continue;
      if (en === 'mkt') t0 = t;
      const cost = costOf(fill);
      for (const sk of STOPS) { const stop = ext + d * sk * a, risk = s * (fill - stop); if (!(risk > cost)) continue;
        const tg = [mid, b.o, fill + s * 2 * risk].map((p, x) => (x === 2 || s * (p - fill) >= risk ? p : NaN));
        const r = sim(M5, s, fi, fill, stop, tg, CAPS, fillOnly); if (!r) continue;
        R[`${en}|${sk}`] = [...r.map((v) => (Number.isFinite(v) ? +v.toFixed(4) : null)), +(cost / risk).toFixed(4)]; }
    }
    if (t0 == null) continue;
    out.push({ t: t0, d, f: Object.fromEntries(Object.entries(feat).map(([k, v]) => [k, typeof v === 'number' ? +v.toFixed(3) : v])), R });
  }
  return out;
}

// ---- table: mean R before / after costs, n, month t, by window, for one variant and a filter -----------------------------
export function group(list, key, x, filt = () => true) {
  const W = [{ n: 0, s: 0, sn: 0, ms: new Map() }, { n: 0, s: 0, sn: 0, ms: new Map() }];
  for (const r of list) { if (!filt(r)) continue; const v = r.R[key]; if (!v || v[x] == null) continue; const w = r.t < Date.UTC(2015, 0, 1) / 1000 ? 0 : 1;
    const g = W[w], net = v[x] - v[3]; g.n++; g.s += v[x]; g.sn += net; const mo = new Date(r.t * 1000).toISOString().slice(0, 7); g.ms.set(mo, (g.ms.get(mo) || 0) + net); }
  return W.map((g, w) => { const months = w ? 142 : 120, a = [...g.ms.values()]; while (a.length < months) a.push(0);
    const m = a.reduce((p, q) => p + q, 0) / months, sd = Math.sqrt(a.reduce((p, q) => p + (q - m) ** 2, 0) / (months - 1));
    return { n: g.n, gross: g.n ? g.s / g.n : null, net: g.n ? g.sn / g.n : null, tNet: sd > 0 ? m / (sd / Math.sqrt(months)) : 0 }; });
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const [cmd, a, b] = process.argv.slice(2);
  if (cmd === 'rows') { fs.mkdirSync(b, { recursive: true }); const r = rows(a); fs.writeFileSync(path.join(b, a + '.json.gz'), zlib.gzipSync(JSON.stringify(r))); console.log(a, r.length); }
}
