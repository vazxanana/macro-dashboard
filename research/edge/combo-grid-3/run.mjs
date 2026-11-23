// research/edge/combo-grid-3/run.mjs - combination grid 3 of PREREGISTRATION.md (23 Nov 2026): grid 2's engine with 11 chains
// (M30 included), 14 filters, the VR -> CF of two QMs, fixed-30-pip and zone+ATR stops, the far HTF target and the M5 EF trail.
// node research/edge/combo-grid/run.mjs market <market> <outDir>   one market: signals, simulations, per-combination month sums
// node research/edge/combo-grid/run.mjs report <outDir>            pool the markets, apply the pre-registered bar, write result.json
// Research only: imports edgekit and council/eg-methods (engulfAt, direction); writes only to <outDir> and its own folder.
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import * as K from '../_lib/edgekit.mjs';
import { engulfAt, direction, pipOfMarket } from '../../../council/eg-methods.mjs';

const HERE = path.dirname(fileURLToPath(import.meta.url));
export const START = Date.UTC(2020, 0, 1) / 1000, SPLIT = Date.UTC(2024, 0, 1) / 1000;
export const MONTHS = (() => { const out = []; for (let y = 2020; y <= 2026; y++) for (let m = 0; m < 12; m++) { if (y === 2026 && m > 10) break; out.push(Date.UTC(y, m, 1) / 1000); } return out; })();
export const NM = MONTHS.length, IS_M = 48; // 2020-01 .. 2023-12 = 48 months; 2024-01 .. 2026-11 = 35
export const CHAINS = [['1d', '4h'], ['1d', '1h'], ['4h', '1h'], ['4h', '30m'], ['4h', '15m'], ['1h', '30m'], ['1h', '15m'], ['1h', '5m'], ['30m', '15m'], ['30m', '5m'], ['15m', '5m']];
export const ZONES = ['eg', 'egn', 'ef', 'dom', 'av', 'bar', 'qm', 'box', 'egb'];
export const VISITS = ['first2'];
export const DIRS = ['none', 'struct', 'structUp', 'msnr', 'd1eg', 'weekly', 'er20', 'er35', 'weeklyEr20', 'london', 'ny', 'sideways', 'half', 'boConf'];
export const EXTRA = ['gbpjpy', 'eurgbp', 'audjpy', 'cadjpy', 'euraud', 'nas100', 'spx500', 'de40'];
export const GRID_MARKETS = ['xau', 'eurusd', 'gbpusd'];
// round trips in price units (PREREGISTRATION.md amendment): the eight extra markets; the rest are edgekit's
export const COSTS = { ...K.COSTS, gbpjpy: 0.014, eurgbp: 0.00009, audjpy: 0.010, cadjpy: 0.010, euraud: 0.00013, nas100: 1.0, spx500: 0.4, de40: 1.5 };
export const TRIGS = ['eg', 'ef', 'bo', 'qm', 'vrcf', 'vrq'];   // + 'none' (index 6)
export const NONE = 6;
export const ENTRIES = ['mkt', 'half', 'edge'], STOPS = ['trig', 'zone', 'ext', 'fixed30', 'zatr'];
export const NONE_E = ['zedge', 'zhalf'], NONE_S = ['zone', 'fixed30', 'zatr'];
export const EXITS = ['1R', '2R', '3R', '4R', '6R', 'opp', 'trail', 'far', 'eftrail'];
export const NX = EXITS.length;
export const NTE = TRIGS.length * 15 + NONE_E.length * NONE_S.length; // 96
export const NCOMBO = CHAINS.length * ZONES.length * VISITS.length * DIRS.length * NTE * EXITS.length;
export const comboIndex = (ch, z, v, d, te, x) => (((((ch * ZONES.length + z) * VISITS.length + v) * DIRS.length + d) * NTE + te) * NX + x);
export function comboName(c) {
  const x = c % NX; c = (c - x) / NX; const te = c % NTE; c = (c - te) / NTE; const d = c % DIRS.length; c = (c - d) / DIRS.length; const v = c % VISITS.length; c = (c - v) / VISITS.length; const z = c % ZONES.length; const ch = (c - z) / ZONES.length;
  const none = te >= 90, trig = none ? 'none' : TRIGS[Math.floor(te / 15)];
  const es = none ? NONE_E[Math.floor((te - 90) / 3)] + '/' + NONE_S[(te - 90) % 3] : ENTRIES[Math.floor((te % 15) / 5)] + '/' + STOPS[te % 5];
  return { chain: CHAINS[ch].join('>'), zone: ZONES[z], visit: VISITS[v], dir: DIRS[d], trig, es, exit: EXITS[x] };
}
const SEC = K.TF; SEC['1w'] = 604800;
const W = 12, LIFE = 120, CAP = { '1d': 10 * 86400, '4h': 5 * 86400, '1h': 2 * 86400, '30m': 2 * 86400, '15m': 86400 }, ABOVE = { '1d': '1w', '4h': '1d', '1h': '4h', '30m': '4h', '15m': '1h' };
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
  const F = { '5m': M5, '15m': K.resample(M5, 900), '30m': K.resample(M5, 1800), '1h': K.resample(M5, 3600), '4h': K.resample(M5, 14400), '1d': K.dailyNY(M5) };
  F['1w'] = weekly(F['1d']); return F;
}
// the MSNR direction call of each closed candle of L, from key levels of the timeframe above
function msnrCalls(L, tf, F) {
  const A = F[ABOVE[tf]]; const keyOf = (t) => { const k = K.barAt(A, t); return k < 0 ? t : A[k].t; };
  return direction(conv(L), keyOf, SEC[ABOVE[tf]]).call;
}

// ---- one trade, every exit in one pass ------------------------------------------------------------------------------
// returns null (no fill / bad) or { t (fill time), risk, R: Float64Array(9) } R before costs:
// 1R 2R 3R 4R 6R opp trail far(NaN when no far target) eftrail. efMap: 5m index -> [{ d, top, bot }] of M5 engulf zones failing there.
export function multi(M5, s, entry, stop, type, t0, expire, oppR, farR, cap, efMap) {
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
  const NF = 7; // fixed-level exits: 1R 2R 3R 4R 6R opp far (far stored at slot 7)
  const lv = [...RS, oppR, farR], slot = [0, 1, 2, 3, 4, 5, 7];
  const R = new Float64Array(9), done = new Uint8Array(9); let left = 9;
  const fin = (k, px) => { if (!done[k]) { done[k] = 1; R[k] = (s * (px - fill)) / risk; left--; } };
  if (farR == null) { done[7] = 1; R[7] = NaN; left--; }
  let tStop = stop, best = fill, eStop = stop; const deadline = M5[i].t + cap, fi = i;
  for (let j = fi; j < M5.length && left; j++) { const b = M5[j], first = j === fi;
    if (!first) { if (s * (b.o - stop) <= 0) for (let q = 0; q < NF; q++) fin(slot[q], b.o);
      for (let q = 0; q < NF; q++) { const k = slot[q]; if (!done[k] && s * (b.o - (fill + s * lv[q] * risk)) >= 0) fin(k, b.o); }
      if (!done[6] && s * (b.o - tStop) <= 0) fin(6, b.o);
      if (!done[8] && s * (b.o - eStop) <= 0) fin(8, b.o); }
    const low = s > 0 ? b.l : b.h, high = s > 0 ? b.h : b.l;
    if (s * (low - stop) <= 0) for (let q = 0; q < NF; q++) fin(slot[q], stop);
    if (!done[6] && s * (low - tStop) <= 0) fin(6, tStop);
    if (!done[8] && s * (low - eStop) <= 0) fin(8, eStop);
    if (!(first && type !== 'mkt')) {
      for (let q = 0; q < NF; q++) { const k = slot[q]; if (!done[k] && s * (high - (fill + s * lv[q] * risk)) >= 0) fin(k, fill + s * lv[q] * risk); }
      if (s * (high - best) > 0) best = high;
      if (!done[6] && s * (best - fill) >= risk) { const ns = best - s * risk; if (s * (ns - tStop) > 0) tStop = ns; } }
    // the M5 EF trail: an opposite M5 engulf zone failing at this candle's close moves the stop to its far side (from the next candle)
    if (!done[8] && efMap) { const a = efMap.get(j); if (a) for (const z of a) if (z.d === -s) { const ns = s > 0 ? z.bot : z.top; if (s * (ns - eStop) > 0 && s * (b.c - ns) > 0) eStop = ns; } }
    if (b.e >= deadline) for (let k = 0; k < 9; k++) fin(k, b.c);
  }
  if (left) return null;
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
        out.push({ z, visit, k0, trig: NONE }); // no trigger: a limit at the zone from the touch candle's start
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
          { const q = qmAt(T, j); if (q) {
              if (q.side === z.d && !got.has(3)) { got.add(3); out.push({ z, visit, k0, trig: 3, j, tz: [q.zone.lo, q.zone.hi], ext }); }
              if (q.side === -z.d) got.add('qagainst');
              else if (q.side === z.d && got.has('qagainst') && !got.has(5)) { got.add(5); out.push({ z, visit, k0, trig: 5, j, tz: [q.zone.lo, q.zone.hi], ext }); } } }
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
const KEYS = ['1d', '4h', '1h', '30m', '15m'];
function atr14(B) { const a = new Float64Array(B.length); let s = 0; for (let i = 1; i < B.length; i++) { const tr = Math.max(B[i].h - B[i].l, Math.abs(B[i].h - B[i - 1].c), Math.abs(B[i].l - B[i - 1].c));
    s += tr; if (i > 14) s -= Math.max(B[i - 14].h - B[i - 14].l, Math.abs(B[i - 14].h - B[i - 15].c), Math.abs(B[i - 14].l - B[i - 15].c)); a[i] = i >= 14 ? s / 14 : 0; } return a; }
export function runMarket(market, { from = '2019-03-01', to } = {}) {
  const M5 = K.load(market, '5m', { from, to }); const F = frames(M5); const cost = COSTS[market], pip = pipOfMarket(market);
  const acc = { n: new Uint32Array(NCOMBO * 2), ms: new Float32Array(NCOMBO * NM), c2: new Float32Array(NCOMBO), cm: new Float32Array(NCOMBO * NM) }; // cm: cost / risk by month (before costs = ms + cm)
  const tags = {};
  for (const tf of KEYS) { const st = K.structure(F[tf], 3); const A = F[ABOVE[tf]];
    const sw = K.swings(A, 3).sort((x, y) => x.ct - y.ct);
    tags[tf] = { st: st.side, ev: st.events, evT: st.events.map((e) => e.t), up: K.structure(A, 3).side, ms: msnrCalls(F[tf], tf, F), atr: atr14(F[tf]), sw, swT: sw.map((x) => x.ct) }; }
  const d1z = egZones(F['1d'], 3).sort((a, b) => a.at - b.at);
  const D = F['1d'], Wk = F['1w'], X = exclusions(market); let dropped = 0;
  const er = new Float64Array(D.length); for (let i = 20; i < D.length; i++) { let p = 0; for (let j = i - 19; j <= i; j++) p += Math.abs(D[j].c - D[j - 1].c); er[i] = p > 0 ? Math.abs(D[i].c - D[i - 20].c) / p : 0; }
  const wkSide = (t) => { const w = K.closedCount(Wk, t); return w >= 2 ? Math.sign(Wk[w - 1].c - Wk[w - 2].c) : 0; };
  const erAt = (t) => { const i = K.closedCount(D, t) - 1; return i >= 20 ? er[i] : 0; };
  const d1side = (t) => { let lo = 0, hi = d1z.length; while (lo < hi) { const m = (lo + hi) >> 1; if (d1z[m].at <= t) lo = m + 1; else hi = m; } return lo ? d1z[lo - 1].d : 0; };
  const upto = (arr, t) => { let lo = 0, hi = arr.length; while (lo < hi) { const m = (lo + hi) >> 1; if (arr[m] <= t) lo = m + 1; else hi = m; } return lo; };
  // M5 engulf zones failing at each 5-minute candle (the EF trail)
  const efMap = new Map(); for (const z of egZones(M5, 3)) if (z.fi >= 0) { const a = efMap.get(z.fi) || []; a.push({ d: z.d, top: z.top, bot: z.bot }); efMap.set(z.fi, a); }
  const Zcache = {}; let nsig = 0, nsim = 0;
  // the far target's zones: H4 and D1 engulf and failed-engulf zones
  const FAR = []; for (const tf of ['4h', '1d']) for (const k of ['eg', 'ef']) FAR.push(...(Zcache[tf + k] ||= buildZones(k, F[tf])));
  const mIdx = (t) => { let lo = 0, hi = NM; while (lo < hi) { const m = (lo + hi) >> 1; if (MONTHS[m] <= t) lo = m + 1; else hi = m; } return lo - 1; };
  CHAINS.forEach(([tfL, tfT], ch) => {
    const L = F[tfL], T = F[tfT], tg = tags[tfL], cap = CAP[tfL];
    ZONES.forEach((kind, zi) => {
      const S = signalsFor(F, tfL, tfT, kind, Zcache); nsig += S.length;
      const Z = Zcache[tfL + kind];
      for (const sg of S) {
        const z = sg.z, d = z.d, ts = sg.trig === NONE ? T[sg.k0].t : T[sg.j].e;
        const li = K.closedCount(L, ts) - 1; if (li < 0) continue;
        const ai = K.closedCount(F[ABOVE[tfL]], ts) - 1;
        const wk = wkSide(ts) === d, e20 = erAt(ts), hr = new Date(ts * 1000).getUTCHours();
        // sideways: the 2 key-timeframe candles after the zone formed did not touch it (known at the second one's close)
        const sideways = z.i + 2 < L.length && L[z.i + 2].e <= ts && !(L[z.i + 1].l <= z.top && L[z.i + 1].h >= z.bot) && !(L[z.i + 2].l <= z.top && L[z.i + 2].h >= z.bot);
        // the half: the reference price in the buyer's (lower) half of the timeframe above's last swing range
        const ref0 = sg.trig === NONE ? (d > 0 ? z.top : z.bot) : T[sg.j].c;
        let half = false; { const n = upto(tg.swT, ts); let H = null, Lo = null; for (let q = n - 1; q >= 0 && (H == null || Lo == null); q--) { const w = tg.sw[q]; if (w.type === 'H' && H == null) H = w.price; if (w.type === 'L' && Lo == null) Lo = w.price; }
          if (H != null && Lo != null && H > Lo) { const mid = (H + Lo) / 2; half = d > 0 ? ref0 <= mid : ref0 >= mid; } }
        // a confirmed side: the key timeframe's last structure event closed by ts is a BO in the trade's direction
        const ne = upto(tg.evT, ts), le = ne ? tg.ev[ne - 1] : null, boConf = !!le && le.dir === d && le.kind === 'BO';
        const dirOk = [true, tg.st[li] === d, ai >= 0 && tg.up[ai] === d, tg.ms[li] === d, d1side(ts) === d, wk, e20 >= 0.2, e20 >= 0.35, wk && e20 >= 0.2, hr >= 7 && hr < 12, hr >= 12 && hr < 17, sideways, half, boConf];
        const edges = { 1: [], '-1': [] }; for (const o of Z) { if (o.at > ts || o.end <= ts) continue; edges[-o.d].push(-o.d > 0 ? o.bot : o.top); }
        const near = (list, s, ref) => { let best = null; for (const edge of list) if (s * (edge - ref) > 0 && (best == null || s * (best - edge) > 0)) best = edge; return best; };
        const far = { 1: [], '-1': [] }; for (const o of FAR) { if (o.at > ts || o.end <= ts) continue; far[-o.d].push(-o.d > 0 ? o.bot : o.top); }
        const buf = cost / 2, exp = ts + W * SEC[tfT], atrL = tg.atr[li] || 0, fx = 30 * pip;
        const zStop = d > 0 ? z.bot - buf : z.top + buf, zaStop = d > 0 ? z.bot - buf - 0.25 * atrL : z.top + buf + 0.25 * atrL;
        const variants = [];
        if (sg.trig === NONE) { [d > 0 ? z.top : z.bot, (z.top + z.bot) / 2].forEach((px, ei) => [zStop, px - d * fx, zaStop].forEach((sp, si) => variants.push([90 + ei * 3 + si, 'lim', px, sp]))); }
        else { const [tlo, thi] = sg.tz; const c0 = T[sg.j].c;
          [['mkt', null], ['lim', (tlo + thi) / 2], ['lim', d > 0 ? thi : tlo]].forEach(([ty, px], ei) => {
            const ref = px ?? c0;
            [d > 0 ? tlo - buf : thi + buf, zStop, d > 0 ? sg.ext - buf : sg.ext + buf, ref - d * fx, zaStop].forEach((sp, si) => variants.push([sg.trig * 15 + ei * 5 + si, ty, px, sp])); }); }
        for (const [te, ty, entry, stop] of variants) {
          const s = d;
          if (entry != null && !(s * (entry - stop) > 0)) continue;
          const refPx = entry ?? T[sg.j].c, rk0 = s * (refPx - stop);
          if (!(rk0 >= 2 * cost)) continue;
          const opp = near(edges[s], s, refPx); let oppR = opp == null ? 2 : (s * (opp - refPx)) / rk0; if (!(oppR >= 1)) oppR = 2;
          const fz = near(far[s], s, refPx); const farR = fz != null && (s * (fz - refPx)) / rk0 >= 3 ? (s * (fz - refPx)) / rk0 : null;
          const r = multi(F['5m'], s, entry, stop, ty, ts, exp, oppR, farR, cap, efMap); nsim++;
          if (!r || r.risk < cost) continue;
          const m = mIdx(r.t); if (m < 0 || r.t < START) continue;
          if (X.length && inBad(X, r.t)) { dropped++; continue; }
          const oos = r.t >= SPLIT ? 1 : 0, cr = cost / r.risk;
          for (let di = 0; di < DIRS.length; di++) { if (!dirOk[di]) continue;
            for (let x = 0; x < NX; x++) { const R = r.R[x]; if (!Number.isFinite(R)) continue; const c = comboIndex(ch, zi, 0, di, te, x);
              acc.n[c * 2 + oos]++; acc.ms[c * NM + m] += R - cr; acc.cm[c * NM + m] += cr; if (oos) acc.c2[c] += cr; } }
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

// gross: judge before costs (month sums + cost / risk; owner, 23 Nov 2026: "I only want to know before costs")
export function report(dir, markets = GRID_MARKETS, { gross = false } = {}) {
  const scopes = ['pool', ...markets]; const P = {};
  for (const m of markets) P[m] = { n: loadBin(dir, m, 'n', Uint32Array), ms: loadBin(dir, m, 'ms', Float32Array), c2: loadBin(dir, m, 'c2', Float32Array), cm: gross ? loadBin(dir, m, 'cm', Float32Array) : null };
  const rows = []; const ms = new Float64Array(NM);
  for (const sc of scopes) { const list = sc === 'pool' ? markets : [sc];
    for (let c = 0; c < NCOMBO; c++) {
      ms.fill(0); let nI = 0, nO = 0, c2 = 0;
      for (const m of list) { const A = P[m]; nI += A.n[c * 2]; nO += A.n[c * 2 + 1]; c2 += A.c2[c]; for (let k = 0; k < NM; k++) ms[k] += A.ms[c * NM + k] + (A.cm ? A.cm[c * NM + k] : 0); }
      if (gross) c2 = 0;
      if (nI >= 100) { const a = mstat(ms, 0, IS_M), b = mstat(ms, IS_M, NM);
        rows.push({ sc, c, nI, nO, isMean: a.sum / nI, isT: a.t, oosMean: nO ? b.sum / nO : null, oosT: b.t, oos2c: nO ? (b.sum - c2) / nO : null }); } } }
  const disc = rows.filter((r) => r.isMean > 0 && r.isT >= 2);
  const p1 = (t, df) => { const p = K.pFromT(t, df); return t > 0 ? p / 2 : 1 - p / 2; };
  const ok = disc.filter((r) => r.nO >= 50); const adj = K.holm(ok.map((r) => p1(r.oosT, NM - IS_M - 1)));
  ok.forEach((r, i) => { r.holm = adj[i]; r.pass = r.oosMean > 0 && r.oosT >= 2 && r.holm < 0.05 && (r.oos2c == null || r.oos2c > 0); r.raw = r.oosMean > 0 && r.oosT >= 2; });
  const name = (r) => ({ scope: r.sc, ...comboName(r.c), isN: r.nI, isMean: +r.isMean.toFixed(4), isT: +r.isT.toFixed(2), oosN: r.nO, oosMean: r.oosMean == null ? null : +r.oosMean.toFixed(4),
    oosT: +r.oosT.toFixed(2), oos2c: r.oos2c == null ? null : +r.oos2c.toFixed(4), holm: r.holm == null ? null : +r.holm.toPrecision(3) });
  return { tested: rows.length, discovery: disc.length, discoveryWithOOS: ok.length, confirmed: ok.filter((r) => r.pass).length, rawOOS: ok.filter((r) => r.raw).length,
    expectedByChance: +(ok.length * 0.0228).toFixed(1), confirmedList: ok.filter((r) => r.pass).map(name), rawList: ok.filter((r) => r.raw).sort((a, b) => b.oosT - a.oosT).slice(0, 200).map(name),
    topDiscovery: disc.sort((a, b) => b.isT - a.isT).slice(0, 50).map(name), rows };
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const [cmd, a, b] = process.argv.slice(2);
  if (cmd === 'market') { const t0 = Date.now(); const out = runMarket(a); save(b, a, out); console.log(a, out.nsig, 'signals', out.nsim, 'sims', ((Date.now() - t0) / 1000).toFixed(0) + 's'); }
  else if (cmd === 'gross') { const R = report(a, undefined, { gross: true }); const { rows, prow, ...rest } = R; fs.writeFileSync(path.join(a, 'report-gross.json'), JSON.stringify(rest, null, 1));
    console.log(JSON.stringify({ basis: 'before costs', tested: R.tested, discovery: R.discovery, rawOOS: R.rawOOS, confirmed: R.confirmed, expectedByChance: R.expectedByChance }, null, 1)); }
  else if (cmd === 'report') { const R = report(a); const { rows, ...rest } = R; fs.writeFileSync(path.join(a, 'report-full.json'), JSON.stringify(rest, null, 1));
    console.log(JSON.stringify({ tested: R.tested, discovery: R.discovery, discoveryWithOOS: R.discoveryWithOOS, rawOOS: R.rawOOS, confirmed: R.confirmed, expectedByChance: R.expectedByChance }, null, 1)); }
  else console.log('usage: run.mjs market <m> <dir> | report <dir> | gross <dir> (the same bar before costs)');
}
