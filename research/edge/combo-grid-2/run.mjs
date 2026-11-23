// research/edge/combo-grid-2/run.mjs - combination grid 2 of PREREGISTRATION.md (23 Nov 2026): the first grid's engine with
// 11 filters, a ninth zone (the body engulf), ten markets and the data-quality exclusions.
// node research/edge/combo-grid/run.mjs market <market> <outDir>   one market: signals, simulations, per-combination month sums
// node research/edge/combo-grid/run.mjs report <outDir>            pool the markets, apply the pre-registered bar, write result.json
// Research only: imports edgekit and council/eg-methods (engulfAt, direction); writes only to <outDir> and its own folder.
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import * as K from '../_lib/edgekit.mjs';
import { engulfAt, direction } from '../../../council/eg-methods.mjs';

const HERE = path.dirname(fileURLToPath(import.meta.url));
export const START = Date.UTC(2020, 0, 1) / 1000, SPLIT = Date.UTC(2024, 0, 1) / 1000;
export const MONTHS = (() => { const out = []; for (let y = 2020; y <= 2026; y++) for (let m = 0; m < 12; m++) { if (y === 2026 && m > 10) break; out.push(Date.UTC(y, m, 1) / 1000); } return out; })();
export const NM = MONTHS.length, IS_M = 48; // 2020-01 .. 2023-12 = 48 months; 2024-01 .. 2026-11 = 35
export const CHAINS = [['1d', '4h'], ['4h', '1h'], ['4h', '15m'], ['1h', '15m'], ['1h', '5m']];
export const ZONES = ['eg', 'egn', 'ef', 'dom', 'av', 'bar', 'qm', 'box', 'egb'];
export const VISITS = ['first', 'first2'];
export const DIRS = ['none', 'struct', 'structUp', 'msnr', 'd1eg', 'weekly', 'er20', 'er35', 'weeklyEr20', 'london', 'ny'];
export const EXTRA = ['gbpjpy', 'eurgbp', 'audjpy', 'cadjpy', 'euraud', 'nas100', 'spx500', 'de40'];
export const GRID_MARKETS = [...K.MARKETS, ...K.HOLDOUT_MARKETS, ...EXTRA];
// round trips in price units (PREREGISTRATION.md amendment): the eight extra markets; the rest are edgekit's
export const COSTS = { ...K.COSTS, gbpjpy: 0.014, eurgbp: 0.00009, audjpy: 0.010, cadjpy: 0.010, euraud: 0.00013, nas100: 1.0, spx500: 0.4, de40: 1.5 };
export const TRIGS = ['eg', 'ef', 'bo', 'qm', 'vrcf'];          // + 'none' (index 5)
export const ENTRIES = ['mkt', 'half', 'edge'], STOPS = ['trig', 'zone', 'ext'];
export const NONE_ES = ['zedge', 'zhalf'];
export const EXITS = ['1R', '2R', '3R', '4R', '6R', 'opp', 'trail'];
export const NTE = TRIGS.length * 9 + NONE_ES.length; // 47
export const NCOMBO = CHAINS.length * ZONES.length * VISITS.length * DIRS.length * NTE * EXITS.length;
export const comboIndex = (ch, z, v, d, te, x) => (((((ch * ZONES.length + z) * VISITS.length + v) * DIRS.length + d) * NTE + te) * EXITS.length + x);
export function comboName(c) {
  const x = c % 7; c = (c - x) / 7; const te = c % NTE; c = (c - te) / NTE; const d = c % DIRS.length; c = (c - d) / DIRS.length; const v = c % 2; c = (c - v) / 2; const z = c % ZONES.length; const ch = (c - z) / ZONES.length;
  const trig = te >= 45 ? 'none' : TRIGS[Math.floor(te / 9)];
  const es = te >= 45 ? NONE_ES[te - 45] : ENTRIES[Math.floor((te % 9) / 3)] + '/' + STOPS[te % 3];
  return { chain: CHAINS[ch].join('>'), zone: ZONES[z], visit: VISITS[v], dir: DIRS[d], trig, es, exit: EXITS[x] };
}
const SEC = K.TF; SEC['1w'] = 604800;
const W = 12, LIFE = 120, CAP = { '1d': 10 * 86400, '4h': 5 * 86400, '1h': 2 * 86400 }, ABOVE = { '1d': '1w', '4h': '1d', '1h': '4h' };
const RS = [1, 2, 3, 4, 6];

// ---- zones on the key-level timeframe ------------------------------------------------------------------------------
const conv = (B) => B.map((b) => ({ time: b.t, open: b.o, high: b.h, low: b.l, close: b.c }));
function closeEnd(L, i, d, bot, top) { // the first close through the far side after candle i, or the end of its life
  for (let j = i + 1; j < L.length && j <= i + LIFE; j++) if (d > 0 ? L[j].c < bot : L[j].c > top) return { end: L[j].e, fi: j };
  return { end: i + LIFE < L.length ? L[i + LIFE].e : Infinity, fi: -1 };
}
export function egZones(L, span = 3) {
  const C = conv(L), out = [];
  for (let i = 1; i < L.length; i++) { const e = engulfAt(C, i, span); if (!e) continue; const p = L[e.j]; let gone = false;
    for (let q = e.j + 1; q < i && !gone; q++) { const b = L[q]; gone = e.dir > 0 ? (b.c > b.o && b.c > p.h) || b.c < p.l : (b.c < b.o && b.c < p.l) || b.c > p.h; }
    if (gone || !(p.h > p.l)) continue;
    const z = { d: e.dir, bot: p.l, top: p.h, at: L[i].e, i }; Object.assign(z, closeEnd(L, i, z.d, z.bot, z.top)); out.push(z); }
  return out;
}
export function buildZones(kind, L) {
  const out = [];
  if (kind === 'egb') { for (let i = 1; i < L.length; i++) { const c = L[i], p = L[i - 1], pb = Math.abs(p.c - p.o), cb = Math.abs(c.c - c.o);
      if (!(p.h > p.l) || pb < 0.4 * (p.h - p.l)) continue;
      const d = c.c > c.o && p.c < p.o ? 1 : c.c < c.o && p.c > p.o ? -1 : 0; if (!d) continue;
      if (!(cb > pb && Math.max(c.o, c.c) >= Math.max(p.o, p.c) && Math.min(c.o, c.c) <= Math.min(p.o, p.c))) continue;
      out.push({ d, bot: p.l, top: p.h, at: c.e, i, ...closeEnd(L, i, d, p.l, p.h) }); } return out; }
  if (kind === 'eg') return egZones(L, 3);
  if (kind === 'egn') return egZones(L, 1);
  if (kind === 'ef') { for (const z of egZones(L, 3)) { if (z.fi < 0) continue; const d = -z.d, at = z.end; let end = at + 20 * 86400;
      for (let j = z.fi + 1; j < L.length && L[j].e < end; j++) if (d > 0 ? L[j].c < z.bot : L[j].c > z.top) { end = L[j].e; break; }
      out.push({ d, bot: z.bot, top: z.top, at, i: z.fi, end }); } return out; }
  if (kind === 'dom') { for (let i = 1; i < L.length; i++) { const c = L[i], p = L[i - 1];
      const up = c.c > c.o && p.c > p.o && c.h > p.h && c.c > p.h, dn = c.c < c.o && p.c < p.o && c.l < p.l && c.c < p.l; if (!up && !dn) continue;
      const d = up ? 1 : -1, bot = Math.min(p.o, p.c), top = Math.max(p.o, p.c); if (!(top > bot)) continue;
      out.push({ d, bot, top, at: c.e, i, ...closeEnd(L, i, d, bot, top) }); } return out; }
  if (kind === 'av') { for (let i = 4; i < L.length; i++) { const m = i - 2, x = L[m]; let lo = true, hi = true;
      for (let j = 1; j <= 2; j++) { if (!(x.c < L[m - j].c && x.c < L[m + j].c)) lo = false; if (!(x.c > L[m - j].c && x.c > L[m + j].c)) hi = false; }
      if (lo && x.c > x.l) out.push({ d: 1, bot: x.l, top: x.c, at: L[i].e, i, ...closeEnd(L, i, 1, x.l, x.c) });
      if (hi && x.h > x.c) out.push({ d: -1, bot: x.c, top: x.h, at: L[i].e, i, ...closeEnd(L, i, -1, x.c, x.h) }); } return out; }
  if (kind === 'bar') { for (const ev of K.structure(L, 3).events) { let o = -1;
      for (let j = ev.from; j <= ev.i; j++) if (o < 0 || (ev.dir > 0 ? L[j].l < L[o].l : L[j].h > L[o].h)) o = j;
      const b = L[o]; if (!(b.h > b.l)) continue; out.push({ d: ev.dir, bot: b.l, top: b.h, at: L[ev.i].e, i: ev.i, ...closeEnd(L, ev.i, ev.dir, b.l, b.h) }); } return out; }
  if (kind === 'qm') { for (const q of K.qms(L, 3)) { const bot = q.zone.lo, top = q.zone.hi; if (!(top > bot)) continue;
      out.push({ d: q.side, bot, top, at: L[q.i].e, i: q.i, ...closeEnd(L, q.i, q.side, bot, top) }); } return out; }
  if (kind === 'box') { for (const b of K.boxesHL(L, 3)) { if (!b.dir || b.bi < 0) continue; const mid = (b.hi + b.lo) / 2;
      const bot = b.dir > 0 ? mid : b.lo, top = b.dir > 0 ? b.hi : mid; if (!(top > bot)) continue;
      out.push({ d: b.dir, bot, top, at: L[b.bi].e, i: b.bi, ...closeEnd(L, b.bi, b.dir, bot, top) }); } return out; }
  throw new Error('zone ' + kind);
}

// ---- timeframes ----------------------------------------------------------------------------------------------------
export function weekly(D) { const out = []; let cur = null;
  for (const b of D) { const day = Math.floor((b.e - 1) / 86400), wk = Math.floor((day - 4) / 7);
    if (!cur || cur.wk !== wk) { cur = { wk, t: b.t, o: b.o, h: b.h, l: b.l, c: b.c, e: b.e }; out.push(cur); }
    else { cur.h = Math.max(cur.h, b.h); cur.l = Math.min(cur.l, b.l); cur.c = b.c; cur.e = b.e; } }
  return out; }
export function frames(M5) {
  const F = { '5m': M5, '15m': K.resample(M5, 900), '1h': K.resample(M5, 3600), '4h': K.resample(M5, 14400), '1d': K.dailyNY(M5) };
  F['1w'] = weekly(F['1d']); return F;
}
// the MSNR direction call of each closed candle of L, from key levels of the timeframe above
function msnrCalls(L, tf, F) {
  const A = F[ABOVE[tf]]; const keyOf = (t) => { const k = K.barAt(A, t); return k < 0 ? t : A[k].t; };
  return direction(conv(L), keyOf, SEC[ABOVE[tf]]).call;
}

// ---- one trade, every exit in one pass ------------------------------------------------------------------------------
// returns null (no fill / bad) or { t (fill time), risk, R: Float64Array(7) } R before costs: 1R 2R 3R 4R 6R opp trail
export function multi(M5, s, entry, stop, type, t0, expire, oppR, cap) {
  let lo = 0, hi = M5.length; while (lo < hi) { const m = (lo + hi) >> 1; if (M5[m].t < t0) lo = m + 1; else hi = m; }
  let i = lo, fill = null;
  if (type === 'mkt') { if (i >= M5.length) return null; fill = M5[i].o; }
  else { for (; i < M5.length; i++) { const b = M5[i]; if (b.t >= expire) return null;
      // the fill first: a candle that reaches the limit fills it, even when it also closes past the stop (it is then stopped on
      // that candle). Until 23 Nov 2026 such a candle cancelled the order, which flattered limit entries (found by the zone-use study).
      if (s > 0 ? b.l <= entry : b.h >= entry) { fill = s > 0 ? Math.min(b.o, entry) : Math.max(b.o, entry); break; }
      if (s > 0 ? b.c < stop : b.c > stop) return null; }
    if (fill == null) return null; }
  const risk = s * (fill - stop); if (!(risk > 0)) return null;
  const lv = [...RS, oppR], R = new Float64Array(7), done = new Uint8Array(7); let left = 7;
  let tStop = stop, best = fill; const deadline = M5[i].t + cap, fi = i;
  const fin = (k, px) => { if (!done[k]) { done[k] = 1; R[k] = (s * (px - fill)) / risk; left--; } };
  for (let j = fi; j < M5.length && left; j++) { const b = M5[j], first = j === fi;
    if (!first) { if (s * (b.o - stop) <= 0) for (let k = 0; k < 6; k++) fin(k, b.o);
      for (let k = 0; k < 6; k++) if (!done[k] && s * (b.o - (fill + s * lv[k] * risk)) >= 0) fin(k, b.o);
      if (!done[6] && s * (b.o - tStop) <= 0) fin(6, b.o); }
    const low = s > 0 ? b.l : b.h, high = s > 0 ? b.h : b.l;
    if (s * (low - stop) <= 0) for (let k = 0; k < 6; k++) fin(k, stop);
    if (!done[6] && s * (low - tStop) <= 0) fin(6, tStop);
    if (!(first && type !== 'mkt')) {
      for (let k = 0; k < 6; k++) if (!done[k] && s * (high - (fill + s * lv[k] * risk)) >= 0) fin(k, fill + s * lv[k] * risk);
      if (s * (high - best) > 0) best = high;
      if (!done[6] && s * (best - fill) >= risk) { const ns = best - s * risk; if (s * (ns - tStop) > 0) tStop = ns; } }
    if (b.e >= deadline) for (let k = 0; k < 7; k++) fin(k, b.c);
  }
  if (left) return null; // still open at the end of the file: not counted
  return { t: M5[fi].t, risk, R };
}

// ---- signals of one chain and one zone kind --------------------------------------------------------------------------
export function signalsFor(F, tfL, tfT, kind, Zcache, start = START) {
  const L = F[tfL], T = F[tfT];
  const Z = Zcache[tfL + kind] ||= buildZones(kind, L);
  const out = [];
  for (const z of Z) {
    if (z.at < start - 30 * 86400) continue;
    let k = K.closedCount(T, z.at); // first trigger-timeframe candle starting at or after the zone is known
    while (k < T.length && T[k].t < z.at) k++;
    let visit = 0;
    while (k < T.length && T[k].t < z.end && visit < 2) {
      // next touch
      while (k < T.length && T[k].t < z.end && !(T[k].l <= z.top && T[k].h >= z.bot)) k++;
      if (k >= T.length || T[k].t >= z.end) break;
      visit++; const k0 = k;
      if (T[k0].t >= start) {
        out.push({ z, visit, k0, trig: 5 }); // no trigger: a limit at the zone from the touch candle's start
        const got = new Set();
        let ext = z.d > 0 ? Infinity : -Infinity;
        for (let j = k0; j < T.length && j < k0 + W && T[j].e < z.end; j++) {
          ext = z.d > 0 ? Math.min(ext, T[j].l) : Math.max(ext, T[j].h);
          // engulf of the side completed by candle j
          if (!got.has(0)) { const e = engulfAt(Tc(T), j, 3); if (e && e.dir === z.d) { const p = T[e.j]; got.add(0); out.push({ z, visit, k0, trig: 0, j, tz: [p.l, p.h], ext }); } }
          if (!got.has(1)) { const f = efAt(T, j, z.d); if (f) { got.add(1); out.push({ z, visit, k0, trig: 1, j, tz: f, ext }); } }
          if (!got.has(2) || !got.has(4)) { const ev = evAt(T, j); if (ev) {
              if (ev.dir === z.d && !got.has(2)) { got.add(2); out.push({ z, visit, k0, trig: 2, j, tz: z.d > 0 ? [ext, ev.level] : [ev.level, ext], ext }); }
              if (ev.dir === -z.d) got.add('against');
              if (ev.dir === z.d && got.has('against') && !got.has(4)) { got.add(4); out.push({ z, visit, k0, trig: 4, j, tz: z.d > 0 ? [ext, ev.level] : [ev.level, ext], ext }); } } }
          if (!got.has(3)) { const q = qmAt(T, j); if (q && q.side === z.d) { got.add(3); out.push({ z, visit, k0, trig: 3, j, tz: [q.zone.lo, q.zone.hi], ext }); } }
        }
      }
      // the visit ends at a closed candle wholly outside the zone
      while (k < T.length && T[k].t < z.end && T[k].l <= z.top && T[k].h >= z.bot) k++;
      k++;
    }
  }
  return out;
}
// per-timeframe lookups, cached on the bars array
const Tc = (T) => (T._c ||= conv(T));
function efAt(T, j, d) { // an engulf of the other side failing at candle j's close: its zone
  if (!T._ef) { T._ef = new Map(); for (const z of egZones(T, 3)) if (z.fi >= 0) { const a = T._ef.get(z.fi) || []; a.push(z); T._ef.set(z.fi, a); } }
  const a = T._ef.get(j); if (!a) return null; const z = a.find((x) => x.d === -d); return z ? [z.bot, z.top] : null;
}
function evAt(T, j) { if (!T._ev) { T._ev = new Map(); for (const e of K.structure(T, 2).events) T._ev.set(e.i, e); } return T._ev.get(j) || null; }
function qmAt(T, j) { if (!T._qm) { T._qm = new Map(); for (const q of K.qms(T, 2)) T._qm.set(q.i, q); } return T._qm.get(j) || null; }

// ---- data-quality exclusions (research/edge/data-quality/quality.json) ---------------------------------------------------
const toS = (x) => (typeof x === 'number' ? (x > 1e12 ? x / 1000 : x) : Math.floor(Date.parse(x) / 1000));
export function exclusions(market) {
  const f = path.join(HERE, '..', 'data-quality', 'quality.json'); if (!fs.existsSync(f)) return [];
  const q = JSON.parse(fs.readFileSync(f, 'utf8')); const m = (q.markets || q)[market] || {};
  const list = m.exclude || m.exclusions || m.bad || m.badIntervals || [];
  return list.map((x) => (Array.isArray(x) ? [toS(x[0]), toS(x[1])] : [toS(x.from), toS(x.to)])).filter((x) => x[0] <= x[1]).sort((a, b) => a[0] - b[0]);
}
const inBad = (X, t) => { let lo = 0, hi = X.length; while (lo < hi) { const m = (lo + hi) >> 1; if (X[m][0] <= t) lo = m + 1; else hi = m; } return lo > 0 && t <= X[lo - 1][1]; };

// ---- one market ----------------------------------------------------------------------------------------------------
export function runMarket(market, { from = '2019-03-01', to } = {}) {
  const M5 = K.load(market, '5m', { from, to }); const F = frames(M5); const cost = COSTS[market];
  const acc = { n: new Uint32Array(NCOMBO * 2), ms: new Float32Array(NCOMBO * NM), c2: new Float32Array(NCOMBO), // n IS/OOS; month sums; OOS cost/risk sum
    pms: new Float32Array(NCOMBO * NM), pn: new Uint32Array(NCOMBO * 2) };                                          // placebo: the side flipped
  const tags = {}; for (const tf of ['1d', '4h', '1h']) tags[tf] = { st: K.structure(F[tf], 3).side, up: K.structure(F[ABOVE[tf]], 3).side, ms: msnrCalls(F[tf], tf, F) };
  const d1z = egZones(F['1d'], 3).sort((a, b) => a.at - b.at);
  const D = F['1d'], Wk = F['1w'], X = exclusions(market); let dropped = 0;
  const er = new Float64Array(D.length); for (let i = 20; i < D.length; i++) { let p = 0; for (let j = i - 19; j <= i; j++) p += Math.abs(D[j].c - D[j - 1].c); er[i] = p > 0 ? Math.abs(D[i].c - D[i - 20].c) / p : 0; }
  const wkSide = (t) => { const w = K.closedCount(Wk, t); return w >= 2 ? Math.sign(Wk[w - 1].c - Wk[w - 2].c) : 0; };
  const erAt = (t) => { const i = K.closedCount(D, t) - 1; return i >= 20 ? er[i] : 0; };
  const d1side = (t) => { let lo = 0, hi = d1z.length; while (lo < hi) { const m = (lo + hi) >> 1; if (d1z[m].at <= t) lo = m + 1; else hi = m; } return lo ? d1z[lo - 1].d : 0; };
  const Zcache = {}; let nsig = 0, nsim = 0;
  const mIdx = (t) => { let lo = 0, hi = NM; while (lo < hi) { const m = (lo + hi) >> 1; if (MONTHS[m] <= t) lo = m + 1; else hi = m; } return lo - 1; };
  CHAINS.forEach(([tfL, tfT], ch) => {
    const L = F[tfL], T = F[tfT], tg = tags[tfL], cap = CAP[tfL];
    ZONES.forEach((kind, zi) => {
      const S = signalsFor(F, tfL, tfT, kind, Zcache); nsig += S.length;
      const Z = Zcache[tfL + kind];
      for (const sg of S) {
        const z = sg.z, d = z.d, ts = sg.trig === 5 ? T[sg.k0].t : T[sg.j].e;
        const li = K.closedCount(L, ts) - 1; if (li < 0) continue;
        const ai = K.closedCount(F[ABOVE[tfL]], ts) - 1;
        const wk = wkSide(ts) === d, e20 = erAt(ts), hr = new Date(ts * 1000).getUTCHours();
        const dirOk = [true, tg.st[li] === d, ai >= 0 && tg.up[ai] === d, tg.ms[li] === d, d1side(ts) === d, wk, e20 >= 0.2, e20 >= 0.35, wk && e20 >= 0.2, hr >= 7 && hr < 12, hr >= 12 && hr < 17];
        // nearest opposite zone of the same kind standing at ts, ahead of the price
        const edges = { 1: [], '-1': [] }; for (const o of Z) { if (o.at > ts || o.end <= ts) continue; edges[-o.d].push(-o.d > 0 ? o.bot : o.top); }
        const oppNear = (s, ref) => { let best = null; for (const edge of edges[s]) if (s * (edge - ref) > 0 && (best == null || s * (best - edge) > 0)) best = edge; return best; };
        const buf = cost / 2, exp = (sg.trig === 5 ? T[sg.k0].t : T[sg.j].e) + W * SEC[tfT];
        const variants = [];
        if (sg.trig === 5) { variants.push([45, 'lim', d > 0 ? z.top : z.bot, d > 0 ? z.bot - buf : z.top + buf]);
          variants.push([46, 'lim', (z.top + z.bot) / 2, d > 0 ? z.bot - buf : z.top + buf]); }
        else { const [tlo, thi] = sg.tz; const stops = [d > 0 ? tlo - buf : thi + buf, d > 0 ? z.bot - buf : z.top + buf, d > 0 ? sg.ext - buf : sg.ext + buf];
          const ents = [['mkt', null], ['lim', (tlo + thi) / 2], ['lim', d > 0 ? thi : tlo]];
          ents.forEach(([ty, px], ei) => stops.forEach((sp, si) => variants.push([sg.trig * 9 + ei * 3 + si, ty, px, sp]))); }
        for (const [te, ty, px, sp] of variants) {
          for (const flip of [1, -1]) {
            const s = d * flip;
            let stop = sp, entry = px;
            if (flip < 0) { // placebo: the same entry, the stop mirrored to the other side at the same distance
              const ref = entry ?? T[sg.j].c; stop = ref + (ref - sp); }
            if (entry != null && !(s * (entry - stop) > 0)) continue;
            const refPx = entry ?? T[sg.j].c, rk0 = s * (refPx - stop);
            if (!(rk0 >= 2 * cost)) continue;
            const opp = oppNear(s, refPx); let oppR = opp == null ? 2 : (s * (opp - refPx)) / rk0; if (!(oppR >= 1)) oppR = 2;
            const r = multi(F['5m'], s, entry, stop, ty, ts, exp, oppR, cap); nsim++;
            if (!r || r.risk < 2 * cost * 0.5) continue;
            const m = mIdx(r.t); if (m < 0 || r.t < START) continue;
            if (X.length && inBad(X, r.t)) { dropped++; continue; }
            const oos = r.t >= SPLIT ? 1 : 0, cr = cost / r.risk;
            for (let v = 0; v < 2; v++) { if (v === 0 && sg.visit !== 1) continue;
              for (let di = 0; di < DIRS.length; di++) { if (!dirOk[di]) continue;
                for (let x = 0; x < 7; x++) { const c = comboIndex(ch, zi, v, di, te, x), Rn = r.R[x] - cr;
                  if (flip > 0) { acc.n[c * 2 + oos]++; acc.ms[c * NM + m] += Rn; if (oos) acc.c2[c] += cr; }
                  else { acc.pn[c * 2 + oos]++; acc.pms[c * NM + m] += Rn; } } } }
          }
        }
      }
      process.stderr.write(`${market} ${tfL}>${tfT} ${kind}: ${S.length} signals\n`);
    });
  });
  return { acc, nsig, nsim, dropped, excluded: X.length, bars: M5.length, last: M5[M5.length - 1].t };
}

// ---- statistics on month sums ----------------------------------------------------------------------------------------
export function mstat(ms, a, b) { let n = b - a, s = 0, q = 0; for (let m = a; m < b; m++) { s += ms[m]; q += ms[m] * ms[m]; }
  const mean = s / n, sd = Math.sqrt(Math.max(0, (q - n * mean * mean) / (n - 1))); return { sum: s, t: sd > 0 ? mean / (sd / Math.sqrt(n)) : 0 }; }

function save(dir, market, out) {
  fs.mkdirSync(dir, { recursive: true });
  for (const k of Object.keys(out.acc)) fs.writeFileSync(path.join(dir, `${market}.${k}.bin`), Buffer.from(out.acc[k].buffer));
  fs.writeFileSync(path.join(dir, `${market}.json`), JSON.stringify({ market, nsig: out.nsig, nsim: out.nsim, dropped: out.dropped, excluded: out.excluded, bars: out.bars, last: new Date(out.last * 1000).toISOString() }));
}
function loadBin(dir, market, k, T) { const b = fs.readFileSync(path.join(dir, `${market}.${k}.bin`)); return new T(b.buffer, b.byteOffset, b.byteLength / T.BYTES_PER_ELEMENT); }

export function report(dir, markets = GRID_MARKETS) {
  const scopes = ['pool', ...markets]; const P = {};
  for (const m of markets) P[m] = { n: loadBin(dir, m, 'n', Uint32Array), ms: loadBin(dir, m, 'ms', Float32Array), c2: loadBin(dir, m, 'c2', Float32Array),
    pms: loadBin(dir, m, 'pms', Float32Array), pn: loadBin(dir, m, 'pn', Uint32Array) };
  const rows = [], prow = []; const ms = new Float64Array(NM), pms = new Float64Array(NM);
  for (const sc of scopes) { const list = sc === 'pool' ? markets : [sc];
    for (let c = 0; c < NCOMBO; c++) {
      ms.fill(0); pms.fill(0); let nI = 0, nO = 0, c2 = 0, pI = 0, pO = 0;
      for (const m of list) { const A = P[m]; nI += A.n[c * 2]; nO += A.n[c * 2 + 1]; c2 += A.c2[c]; pI += A.pn[c * 2]; pO += A.pn[c * 2 + 1];
        for (let k = 0; k < NM; k++) { ms[k] += A.ms[c * NM + k]; pms[k] += A.pms[c * NM + k]; } }
      if (nI >= 100) { const a = mstat(ms, 0, IS_M), b = mstat(ms, IS_M, NM);
        rows.push({ sc, c, nI, nO, isMean: a.sum / nI, isT: a.t, oosMean: nO ? b.sum / nO : null, oosT: b.t, oos2c: nO ? (b.sum - c2) / nO : null }); }
      // the placebo of a rule with no trigger is not valid (as in the first grid): its order is placed at the start of a candle chosen because it
      // touches the zone, so the flipped side (a sell moving with that candle) knows where the candle goes. Left out.
      if (pI >= 100 && (Math.floor(c / 7) % NTE) < 45) { const a = mstat(pms, 0, IS_M), b = mstat(pms, IS_M, NM); prow.push({ sc, c, nI: pI, nO: pO, isMean: a.sum / pI, isT: a.t, oosMean: pO ? b.sum / pO : null, oosT: b.t }); }
    } }
  const disc = rows.filter((r) => r.isMean > 0 && r.isT >= 2), pdisc = prow.filter((r) => r.isMean > 0 && r.isT >= 2);
  const p1 = (t, df) => { const p = K.pFromT(t, df); return t > 0 ? p / 2 : 1 - p / 2; };
  const judge = (list) => { const ok = list.filter((r) => r.nO >= 50); const adj = K.holm(ok.map((r) => p1(r.oosT, NM - IS_M - 1)));
    ok.forEach((r, i) => { r.holm = adj[i]; r.pass = r.oosMean > 0 && r.oosT >= 2 && r.holm < 0.05 && (r.oos2c == null || r.oos2c > 0); r.raw = r.oosMean > 0 && r.oosT >= 2; }); return ok; };
  const J = judge(disc), PJ = judge(pdisc);
  const pass = J.filter((r) => r.pass), raw = J.filter((r) => r.raw);
  const name = (r) => ({ scope: r.sc, ...comboName(r.c), isN: r.nI, isMean: +r.isMean.toFixed(4), isT: +r.isT.toFixed(2), oosN: r.nO, oosMean: r.oosMean == null ? null : +r.oosMean.toFixed(4),
    oosT: +r.oosT.toFixed(2), oos2c: r.oos2c == null ? null : +r.oos2c.toFixed(4), holm: r.holm == null ? null : +r.holm.toPrecision(3) });
  const tested = rows.length;
  return { tested, placeboTested: prow.length, discovery: disc.length, discoveryWithOOS: J.length, confirmed: pass.length, rawOOS: raw.length,
    expectedByChance: +(J.length * 0.0228).toFixed(1), placebo: { discovery: pdisc.length, rawOOS: PJ.filter((r) => r.raw).length, confirmed: PJ.filter((r) => r.pass).length },
    confirmedList: pass.map(name), rawList: raw.sort((a, b) => b.oosT - a.oosT).slice(0, 200).map(name),
    topDiscovery: disc.sort((a, b) => b.isT - a.isT).slice(0, 50).map(name),
    rows, prow };
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const [cmd, a, b] = process.argv.slice(2);
  if (cmd === 'market') { const t0 = Date.now(); const out = runMarket(a); save(b, a, out); console.log(a, out.nsig, 'signals', out.nsim, 'sims', ((Date.now() - t0) / 1000).toFixed(0) + 's'); }
  else if (cmd === 'report') { const R = report(a); const { rows, prow, ...rest } = R; fs.writeFileSync(path.join(a, 'report-full.json'), JSON.stringify(rest, null, 1));
    console.log(JSON.stringify({ tested: R.tested, discovery: R.discovery, discoveryWithOOS: R.discoveryWithOOS, rawOOS: R.rawOOS, confirmed: R.confirmed, expectedByChance: R.expectedByChance, placebo: R.placebo }, null, 1)); }
  else console.log('usage: run.mjs market <m> <dir> | report <dir>');
}
