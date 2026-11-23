// research/edge/dom-trade-through/run.mjs - PREREGISTRATION.md (23 Nov 2026): the H1 dominant-zone limit of dom-placebo /
// dom-zone-holdout under stricter fill rules (F0 touch, F1 trade-through 0.1 x ATR14 of M5, F2 trade-through COSTS/2, F3 a
// close beyond the limit, MKT a market entry at the touching candle's close). Research only: reads the edgekit candle cache,
// writes <dir> and its own result.json.
//   node --max-old-space-size=6000 research/edge/dom-trade-through/run.mjs market <m> <dir>   one market -> <dir>/<m>.json
//   node research/edge/dom-trade-through/run.mjs report <dir>                                  pool, tests -> result.json
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import * as K from '../_lib/edgekit.mjs';
import { frames, signalsFor, multi, buildZones, exclusions, NONE } from '../combo-grid-3/run.mjs';
import { COSTS } from '../combo-grid-2/run.mjs';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const y = (n) => Date.UTC(n, 0, 1) / 1000;
export const FROM = y(2010), TO = y(2020), HALF = y(2015);
export const MARKETS = ['xau', 'eurusd', 'gbpusd', 'usdjpy', 'audusd'];
export const RULES = ['F0', 'F1', 'F2', 'F3', 'MKT'];
const RS = [1, 2, 3, 4, 6];

export function atr14(B) { const a = new Float64Array(B.length); let s = 0; const tr = (i) => Math.max(B[i].h - B[i].l, Math.abs(B[i].h - B[i - 1].c), Math.abs(B[i].l - B[i - 1].c));
  for (let i = 1; i < B.length; i++) { s += tr(i); if (i > 14) s -= tr(i - 14); a[i] = i >= 14 ? s / 14 : 0; } return a; }

// the first 5-minute candle at or after t0 (binary search)
export function startIdx(M5, t0) { let lo = 0, hi = M5.length; while (lo < hi) { const m = (lo + hi) >> 1; if (M5[m].t < t0) lo = m + 1; else hi = m; } return lo; }

// the fill of a resting limit under a rule; uses candles up to the fill only. rule: 'touch' | 'through' (thr) | 'close'.
// Returns { i, fill } or null (expired, or cancelled by a close past the stop before a fill).
export function findFill(M5, s, entry, stop, t0, expire, rule, thr = 0) {
  for (let i = startIdx(M5, t0); i < M5.length; i++) { const b = M5[i]; if (b.t >= expire) return null;
    const hit = rule === 'touch' ? (s > 0 ? b.l <= entry : b.h >= entry)
      : rule === 'through' ? (s > 0 ? b.l <= entry - thr : b.h >= entry + thr)
      : (s > 0 ? b.c < entry : b.c > entry);
    if (hit) return { i, fill: s > 0 ? Math.min(b.o, entry) : Math.max(b.o, entry) };
    if (s > 0 ? b.c < stop : b.c > stop) return null; }
  return null;
}

// multi()'s management from a known fill (copied so the fill can be chosen; F0 is checked against multi() itself).
// firstFull: the fill candle's high counts (a market entry); else on the fill candle only the stop counts.
export function manage(M5, s, fi, fill, stop, cap, firstFull, oppR = 2) {
  const risk = s * (fill - stop); if (!(risk > 0) || fi >= M5.length) return null;
  const NF = 7, lv = [...RS, oppR, null], slot = [0, 1, 2, 3, 4, 5, 7];
  const R = new Float64Array(9), done = new Uint8Array(9); let left = 9;
  const fin = (k, px) => { if (!done[k]) { done[k] = 1; R[k] = (s * (px - fill)) / risk; left--; } };
  done[7] = 1; R[7] = NaN; left--;
  let tStop = stop, best = fill; const eStop = stop; const deadline = M5[fi].t + cap;
  for (let j = fi; j < M5.length && left; j++) { const b = M5[j], first = j === fi;
    if (!first) { if (s * (b.o - stop) <= 0) for (let q = 0; q < NF; q++) fin(slot[q], b.o);
      for (let q = 0; q < NF - 1; q++) { const k = slot[q]; if (!done[k] && s * (b.o - (fill + s * lv[q] * risk)) >= 0) fin(k, b.o); }
      if (!done[6] && s * (b.o - tStop) <= 0) fin(6, b.o);
      if (!done[8] && s * (b.o - eStop) <= 0) fin(8, b.o); }
    const low = s > 0 ? b.l : b.h, high = s > 0 ? b.h : b.l;
    if (s * (low - stop) <= 0) for (let q = 0; q < NF; q++) fin(slot[q], stop);
    if (!done[6] && s * (low - tStop) <= 0) fin(6, tStop);
    if (!done[8] && s * (low - eStop) <= 0) fin(8, eStop);
    if (!(first && !firstFull)) {
      for (let q = 0; q < NF - 1; q++) { const k = slot[q]; if (!done[k] && s * (high - (fill + s * lv[q] * risk)) >= 0) fin(k, fill + s * lv[q] * risk); }
      if (s * (high - best) > 0) best = high;
      if (!done[6] && s * (best - fill) >= risk) { const ns = best - s * risk; if (s * (ns - tStop) > 0) tStop = ns; } }
    if (b.e >= deadline) for (let k = 0; k < 9; k++) fin(k, b.c);
  }
  if (left) return null;
  return { t: M5[fi].t, risk, R };
}

// one order under every rule
export function rulesFor(M5, s, entry, stop, t0, expire, cap, atr5, cost) {
  const out = {};
  const i0 = startIdx(M5, t0), a = i0 > 0 ? atr5[i0 - 1] : 0;
  const lim = (rule, thr) => { const f = findFill(M5, s, entry, stop, t0, expire, rule, thr); return f ? manage(M5, s, f.i, f.fill, stop, cap, false) : null; };
  out.F0 = lim('touch');
  out.F1 = lim('through', 0.1 * a);
  out.F2 = lim('through', cost / 2);
  out.F3 = lim('close');
  const f0 = findFill(M5, s, entry, stop, t0, expire, 'touch');
  out.MKT = f0 && f0.i + 1 < M5.length ? manage(M5, s, f0.i + 1, M5[f0.i].c, stop, cap, true) : null;
  return out;
}

export function tradesOf(market, M5, F, from = FROM, to = TO) {
  const H = F['1h'], T = F['5m'], A = atr14(H), A5 = atr14(M5), cost = COSTS[market], X = exclusions(market);
  const bad = (t) => X.some(([a, b]) => t >= a && t <= b);
  const zones = buildZones('dom', H), out = []; let parity = 0;
  for (const sg of signalsFor(F, '1h', '5m', 'dom', { '1hdom': zones }, from)) {
    if (sg.trig !== NONE) continue;
    const z = sg.z, d = z.d, ts = T[sg.k0].t; if (ts >= to) continue;
    const li = K.closedCount(H, ts) - 1; if (li < 15) continue;
    const entry = d > 0 ? z.top : z.bot, stop = d > 0 ? z.bot - cost / 2 - 0.25 * A[li] : z.top + cost / 2 + 0.25 * A[li];
    if (!(d * (entry - stop) >= 2 * cost)) continue;
    const exp = ts + 12 * 300, cap = 2 * 86400;
    const rr = rulesFor(M5, d, entry, stop, ts, exp, cap, A5, cost);
    // parity: F0 must equal combo-grid-3 multi() exactly
    const ref = multi(M5, d, entry, stop, 'lim', ts, exp, 2, null, cap, null);
    if (!!ref !== !!rr.F0 || (ref && (ref.t !== rr.F0.t || Math.abs(ref.R[6] - rr.F0.R[6]) > 1e-12 || Math.abs(ref.R[1] - rr.F0.R[1]) > 1e-12))) throw new Error('F0 parity ' + market + ' ' + ts);
    parity++;
    const row = { side: d };
    for (const k of RULES) { const r = rr[k];
      if (!r || r.risk < cost || r.t < from || r.t >= to || bad(r.t)) { row[k] = null; continue; }
      if (!(r.risk > 0) || !(d * (entry - stop) > 0)) throw new Error('stop on the wrong side');
      row[k] = { t: r.t, cr: +(cost / r.risk).toFixed(5), trail: +r.R[6].toFixed(4), '2R': +r.R[1].toFixed(4) }; }
    if (RULES.some((k) => row[k])) out.push(row);
  }
  return { rows: out, parity };
}

// ---- statistics -----------------------------------------------------------------------------------------------------
const mom = (v) => { const n = v.length; if (!n) return { n: 0, mean: 0, sd: 0 }; const m = v.reduce((a, b) => a + b, 0) / n;
  return { n, mean: m, sd: n > 1 ? Math.sqrt(v.reduce((a, b) => a + (b - m) ** 2, 0) / (n - 1)) : 0 }; };
const mkey = (t) => new Date(t * 1000).toISOString().slice(0, 7);
export function monthT(trs, key, net) { const m = new Map(); for (const r of trs) m.set(mkey(r.t), (m.get(mkey(r.t)) || 0) + r[key] - (net ? r.cr : 0));
  const s = mom([...m.values()]); return s.n < 3 || !(s.sd > 0) ? null : +(s.mean / (s.sd / Math.sqrt(s.n))).toFixed(2); }
export function summ(trs, key) {
  const n = trs.length; if (!n) return { n: 0 };
  const g = trs.reduce((a, r) => a + r[key], 0) / n, c = trs.reduce((a, r) => a + r.cr, 0) / n;
  return { n, before: +g.toFixed(4), tBefore: monthT(trs, key, false), after: +(g - c).toFixed(4), tAfter: monthT(trs, key, true) };
}
const p1 = (t) => (t == null ? 1 : t > 0 ? K.pFromT(t, 1000) / 2 : 1 - K.pFromT(t, 1000) / 2);
const pick = (rows, k) => rows.map((r) => r[k]).filter(Boolean);
const block = (rows) => Object.fromEntries(RULES.map((k) => [k, { trail: summ(pick(rows, k), 'trail'), '2R': summ(pick(rows, k), '2R') }]));
function dropped(rows, k) { const f0 = rows.filter((r) => r.F0), gone = f0.filter((r) => !r[k]).map((r) => r.F0), kept = f0.filter((r) => r[k]).map((r) => r.F0);
  return { f0: f0.length, dropped: gone.length, share: f0.length ? +(gone.length / f0.length).toFixed(4) : null,
    droppedF0: { trail: summ(gone, 'trail'), '2R': summ(gone, '2R') }, keptF0: { trail: summ(kept, 'trail'), '2R': summ(kept, '2R') } }; }

export function report(all) {
  const rows = MARKETS.flatMap((m) => all[m].rows);
  const half = (k, lo) => pick(rows, k).filter((x) => (lo ? x.t < HALF : x.t >= HALF));
  const test = (k) => { const a = summ(half(k, true), 'trail'), b = summ(half(k, false), 'trail');
    return { k, '2010-14': a, '2015-19': b, p: Math.max(p1(a.tBefore), p1(b.tBefore)), halvesPass: a.before > 0 && a.tBefore >= 2 && b.before > 0 && b.tBefore >= 2 }; };
  const T1 = test('F1'), T2 = test('F2'), holm = K.holm([T1.p, T2.p]);
  T1.holm = +holm[0].toPrecision(3); T2.holm = +holm[1].toPrecision(3);
  T1.pass = T1.halvesPass && holm[0] < 0.05; T2.pass = T2.halvesPass && holm[1] < 0.05;
  const verdict = T1.pass && T2.pass ? 'PASS' : !T1.pass && !T2.pass ? 'FAIL' : 'INCONCLUSIVE';
  const perMarket = {}; for (const m of MARKETS) perMarket[m] = { ...block(all[m].rows), dropF1: dropped(all[m].rows, 'F1'), dropF2: dropped(all[m].rows, 'F2') };
  return { study: 'dom-trade-through', built: '2026-11-23', basis: 'judged before costs (pre-registered); after costs beside',
    window: '2010-01-01 to 2019-12-31', markets: MARKETS, verdict, T1, T2,
    parity: Object.fromEntries(MARKETS.map((m) => [m, all[m].parity])),
    pooled: block(rows), halves: { '2010-14': block(rows.map((r) => sub(r, true))), '2015-19': block(rows.map((r) => sub(r, false))) },
    drop: { F1: dropped(rows, 'F1'), F2: dropped(rows, 'F2'), F3: dropped(rows, 'F3') }, perMarket };
}
function sub(r, early) { const o = {}; for (const k of RULES) o[k] = r[k] && (early ? r[k].t < HALF : r[k].t >= HALF) ? r[k] : null; return o; }

const main = process.argv[1] === fileURLToPath(import.meta.url);
if (main && process.argv[2] === 'market') {
  const m = process.argv[3], dir = process.argv[4]; fs.mkdirSync(dir, { recursive: true });
  const M5 = K.load(m, '5m', { from: FROM - 200 * 86400, to: TO }), F = frames(M5);
  const o = tradesOf(m, M5, F);
  fs.writeFileSync(path.join(dir, m + '.json'), JSON.stringify(o));
  console.log(m, o.rows.length, 'signals, F0 parity checked on', o.parity);
}
if (main && process.argv[2] === 'report') {
  const dir = process.argv[3], all = {};
  for (const m of MARKETS) all[m] = JSON.parse(fs.readFileSync(path.join(dir, m + '.json'), 'utf8'));
  const res = report(all), p = res.pooled, f = (x) => (x >= 0 ? '+' : '') + x.toFixed(3);
  res.headline = `Before costs, trail exit, 2010-2019 pooled: touch fill ${f(p.F0.trail.before)}R a trade (n ${p.F0.trail.n}, month t ${p.F0.trail.tBefore}); trade-through 0.1 ATR ${f(p.F1.trail.before)}R (n ${p.F1.trail.n}, t ${p.F1.trail.tBefore}); trade-through half the cost ${f(p.F2.trail.before)}R (n ${p.F2.trail.n}, t ${p.F2.trail.tBefore}); close beyond ${f(p.F3.trail.before)}R (n ${p.F3.trail.n}); market at the touch close ${f(p.MKT.trail.before)}R (n ${p.MKT.trail.n}).`;
  fs.writeFileSync(path.join(HERE, 'result.json'), JSON.stringify(res, null, 1) + '\n');
  console.log(JSON.stringify({ verdict: res.verdict, T1: res.T1, T2: res.T2, drop: res.drop, headline: res.headline }, null, 1));
}
