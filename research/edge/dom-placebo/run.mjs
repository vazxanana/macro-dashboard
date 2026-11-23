// research/edge/dom-placebo/run.mjs - PREREGISTRATION.md (23 Nov 2026): the H1 dominant-zone limit against two controls
// built the same way from H1 candles that are not a dominant pair (C1 a random same-colour body among the 24 before the DOM's
// completion, C2 every candle's body). Research only: reads the edgekit candle cache, writes <dir> and its own result.json.
//   node --max-old-space-size=6000 research/edge/dom-placebo/run.mjs market <m> <dir>   one market's trades -> <dir>/<m>.json
//   node research/edge/dom-placebo/run.mjs report <dir>                                  pool, tests -> result.json
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
export const EX = { trail: 6, '2R': 1 };
const LIFE = 120, BACK = 24;

// the grid's zone end: the first H1 close through the far side after candle i, or 120 candles on
function closeEnd(L, i, d, bot, top) {
  for (let j = i + 1; j < L.length && j <= i + LIFE; j++) if (d > 0 ? L[j].c < bot : L[j].c > top) return { end: L[j].e, fi: j };
  return { end: i + LIFE < L.length ? L[i + LIFE].e : Infinity, fi: -1 };
}
const colour = (b) => (b.c > b.o ? 1 : b.c < b.o ? -1 : 0);
export function seedOf(market, k = 1) { let h = 2166136261; for (const ch of market + ':' + k) h = Math.imul(h ^ ch.charCodeAt(0), 16777619); return h >>> 0; }

// C1: one random body of the DOM's colour among candles i-24 .. i-2, known at the DOM's completion
export function c1Zones(L, seed) {
  const R = K.rng(seed), out = [];
  for (const z of buildZones('dom', L)) {
    const i = z.i, pool = [];
    for (let j = Math.max(0, i - BACK); j <= i - 2; j++) if (colour(L[j]) === z.d) pool.push(j);
    if (!pool.length) continue;
    const j = pool[Math.floor(R() * pool.length)], b = L[j];
    const bot = Math.min(b.o, b.c), top = Math.max(b.o, b.c); if (!(top > bot)) continue;
    out.push({ d: z.d, bot, top, at: z.at, i, src: j, ...closeEnd(L, i, z.d, bot, top) });
  }
  return out;
}
// C2: every closed H1 candle's body, its colour's side, known at its close
export function c2Zones(L) {
  const out = [];
  for (let i = 0; i < L.length; i++) { const b = L[i], d = colour(b); if (!d) continue;
    const bot = Math.min(b.o, b.c), top = Math.max(b.o, b.c);
    out.push({ d, bot, top, at: b.e, i, ...closeEnd(L, i, d, bot, top) }); }
  return out;
}
function atr14(B) { const a = new Float64Array(B.length); let s = 0; const tr = (i) => Math.max(B[i].h - B[i].l, Math.abs(B[i].h - B[i - 1].c), Math.abs(B[i].l - B[i - 1].c));
  for (let i = 1; i < B.length; i++) { s += tr(i); if (i > 14) s -= tr(i - 14); a[i] = i >= 14 ? s / 14 : 0; } return a; }

// the trade of dom-zone-holdout trades(), for any zone list
export function tradesOf(market, M5, F, zones, kind, from = FROM, to = TO) {
  const H = F['1h'], T = F['5m'], A = atr14(H), cost = COSTS[market], X = exclusions(market);
  const bad = (t) => X.some(([a, b]) => t >= a && t <= b);
  const out = [];
  for (const sg of signalsFor(F, '1h', '5m', kind, { ['1h' + kind]: zones }, from)) {
    if (sg.trig !== NONE) continue;
    const z = sg.z, d = z.d, ts = T[sg.k0].t; if (ts >= to) continue;
    const li = K.closedCount(H, ts) - 1; if (li < 15) continue;
    const entry = d > 0 ? z.top : z.bot, stop = d > 0 ? z.bot - cost / 2 - 0.25 * A[li] : z.top + cost / 2 + 0.25 * A[li];
    if (!(d * (entry - stop) >= 2 * cost)) continue;
    const r = multi(M5, d, entry, stop, 'lim', ts, ts + 12 * 300, 2, null, 2 * 86400, null);
    if (!r || r.risk < cost || r.t < from || r.t >= to || bad(r.t)) continue;
    if (!(d * (entry - stop) > 0)) throw new Error('stop on the wrong side');
    out.push({ t: r.t, side: d, cr: +(cost / r.risk).toFixed(5), trail: +r.R[EX.trail].toFixed(4), '2R': +r.R[EX['2R']].toFixed(4) });
  }
  return out;
}

// ---- statistics -----------------------------------------------------------------------------------------------------
const mom = (v) => { const n = v.length; if (!n) return { n: 0, mean: 0, sd: 0 }; const m = v.reduce((a, b) => a + b, 0) / n;
  return { n, mean: m, sd: n > 1 ? Math.sqrt(v.reduce((a, b) => a + (b - m) ** 2, 0) / (n - 1)) : 0 }; };
const mkey = (t) => new Date(t * 1000).toISOString().slice(0, 7);
export function monthSums(rows, key, net) { const m = new Map(); for (const r of rows) m.set(mkey(r.t), (m.get(mkey(r.t)) || 0) + r[key] - (net ? r.cr : 0)); return m; }
export function monthT(rows, key, net) { const v = [...monthSums(rows, key, net).values()], s = mom(v); return s.n < 3 || !(s.sd > 0) ? null : +(s.mean / (s.sd / Math.sqrt(s.n))).toFixed(2); }
export function summ(rows, key) {
  const n = rows.length; if (!n) return { n: 0 };
  const g = rows.reduce((a, r) => a + r[key], 0) / n, c = rows.reduce((a, r) => a + r.cr, 0) / n;
  return { n, before: +g.toFixed(4), tBefore: monthT(rows, key, false), after: +(g - c).toFixed(4), tAfter: monthT(rows, key, true) };
}
export function welch(a, b, key, net = false) {
  const A = mom(a.map((r) => r[key] - (net ? r.cr : 0))), B = mom(b.map((r) => r[key] - (net ? r.cr : 0)));
  if (A.n < 2 || B.n < 2) return { diff: null, t: null };
  const se = Math.sqrt(A.sd ** 2 / A.n + B.sd ** 2 / B.n), df = (A.sd ** 2 / A.n + B.sd ** 2 / B.n) ** 2 / ((A.sd ** 2 / A.n) ** 2 / (A.n - 1) + (B.sd ** 2 / B.n) ** 2 / (B.n - 1));
  return { diff: +(A.mean - B.mean).toFixed(4), t: +((A.mean - B.mean) / se).toFixed(2), df: Math.round(df) };
}
// month-sum t of the per-month difference of MEAN R (months where both streams traded)
export function monthDiffT(a, b, key) {
  const mm = (rows) => { const s = new Map(), c = new Map(); for (const r of rows) { const k = mkey(r.t); s.set(k, (s.get(k) || 0) + r[key]); c.set(k, (c.get(k) || 0) + 1); } return [s, c]; };
  const [sa, ca] = mm(a), [sb, cb] = mm(b), v = [];
  for (const k of sa.keys()) if (sb.has(k)) v.push(sa.get(k) / ca.get(k) - sb.get(k) / cb.get(k));
  const s = mom(v); return s.n < 3 || !(s.sd > 0) ? null : +(s.mean / (s.sd / Math.sqrt(s.n))).toFixed(2);
}
const p1 = (t) => (t == null ? 1 : t > 0 ? K.pFromT(t, 1000) / 2 : 1 - K.pFromT(t, 1000) / 2);

export function report(all) {
  const pool = (k) => MARKETS.flatMap((m) => all[m][k]);
  const D = pool('dom'), C1 = pool('c1'), C2 = pool('c2');
  const T1 = welch(D, C1, 'trail'), T2 = welch(D, C2, 'trail'), T3 = summ(D, 'trail');
  const pv = [p1(T1.t), p1(T2.t), p1(T3.tBefore)], holm = K.holm(pv);
  const passes = [T1.diff > 0 && T1.t >= 2 && holm[0] < 0.05, T2.diff > 0 && T2.t >= 2 && holm[1] < 0.05, T3.before > 0 && T3.tBefore >= 2 && holm[2] < 0.05];
  const streams = (rows) => ({ trail: summ(rows, 'trail'), '2R': summ(rows, '2R') });
  const block = (f) => { const d = D.filter(f), a = C1.filter(f), b = C2.filter(f);
    return { dom: streams(d), c1: streams(a), c2: streams(b), domMinusC1: welch(d, a, 'trail'), domMinusC2: welch(d, b, 'trail') }; };
  const perMarket = {}; for (const m of MARKETS) { const d = all[m].dom, a = all[m].c1, b = all[m].c2;
    perMarket[m] = { dom: streams(d), c1: streams(a), c2: streams(b), domMinusC1: welch(d, a, 'trail'), domMinusC2: welch(d, b, 'trail') }; }
  const seeds = {}; for (const s of [2, 3, 4, 5]) { const a = MARKETS.flatMap((m) => all[m]['c1s' + s] || []); seeds[s] = { c1: summ(a, 'trail'), domMinusC1: welch(D, a, 'trail') }; }
  const verdict = passes.every(Boolean) ? 'PASS' : 'FAIL'; // the DOM must beat both controls and be positive itself
  return { study: 'dom-placebo', built: '2026-11-23', basis: 'judged before costs (owner); after costs beside', window: '2010-01-01 to 2019-12-31',
    markets: MARKETS, verdict, passes, holm: holm.map((x) => +x.toPrecision(3)),
    T1: { ...T1, monthDiffT: monthDiffT(D, C1, 'trail'), after: welch(D, C1, 'trail', true) },
    T2: { ...T2, monthDiffT: monthDiffT(D, C2, 'trail'), after: welch(D, C2, 'trail', true) },
    T3, pooled: { dom: streams(D), c1: streams(C1), c2: streams(C2), domMinusC1_2R: welch(D, C1, '2R'), domMinusC2_2R: welch(D, C2, '2R') },
    halves: { '2010-14': block((r) => r.t < HALF), '2015-19': block((r) => r.t >= HALF) }, seeds, perMarket };
}

const main = process.argv[1] === fileURLToPath(import.meta.url);
if (main && process.argv[2] === 'market') {
  const m = process.argv[3], dir = process.argv[4]; fs.mkdirSync(dir, { recursive: true });
  const M5 = K.load(m, '5m', { from: FROM - 200 * 86400, to: TO }), F = frames(M5), H = F['1h'];
  const o = { dom: tradesOf(m, M5, F, buildZones('dom', H), 'dom'), c1: tradesOf(m, M5, F, c1Zones(H, seedOf(m, 1)), 'c1'), c2: tradesOf(m, M5, F, c2Zones(H), 'c2') };
  for (const s of [2, 3, 4, 5]) o['c1s' + s] = tradesOf(m, M5, F, c1Zones(H, seedOf(m, s)), 'c1s' + s);
  fs.writeFileSync(path.join(dir, m + '.json'), JSON.stringify(o)); console.log(m, Object.fromEntries(Object.entries(o).map(([k, v]) => [k, v.length])));
}
if (main && process.argv[2] === 'report') {
  const dir = process.argv[3], all = {};
  for (const m of MARKETS) all[m] = JSON.parse(fs.readFileSync(path.join(dir, m + '.json'), 'utf8'));
  const res = report(all);
  const s = res.pooled, f = (x) => (x >= 0 ? '+' : '') + x.toFixed(3);
  res.headline = `Before costs, trail exit, 2010-2019 pooled: DOM ${f(s.dom.trail.before)}R a trade (n ${s.dom.trail.n}, month t ${s.dom.trail.tBefore}), random same-colour body ${f(s.c1.trail.before)}R (n ${s.c1.trail.n}), any candle body ${f(s.c2.trail.before)}R (n ${s.c2.trail.n}); DOM minus C1 Welch t ${res.T1.t}, DOM minus C2 Welch t ${res.T2.t}.`;
  fs.writeFileSync(path.join(HERE, 'result.json'), JSON.stringify(res, null, 1) + '\n');
  console.log(JSON.stringify({ verdict: res.verdict, passes: res.passes, holm: res.holm, T1: res.T1, T2: res.T2, T3: res.T3, headline: res.headline }, null, 1));
}
