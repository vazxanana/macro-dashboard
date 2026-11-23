// research/edge/limit-random/run.mjs - PREREGISTRATION.md (23 Nov 2026): random resting limits near the market against the
// H1 dominant-zone limit. Research only: reads the edgekit candle cache, writes <dir> and its own result.json.
//   node --max-old-space-size=6000 research/edge/limit-random/run.mjs market <m> <dir>   one market -> <dir>/<m>.json
//   node research/edge/limit-random/run.mjs report <dir>                                  pool, tests -> result.json
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import * as K from '../_lib/edgekit.mjs';
import { frames, signalsFor, multi, buildZones, exclusions, NONE } from '../combo-grid-3/run.mjs';
import { COSTS } from '../combo-grid-2/run.mjs';
import { tradesOf, summ, welch, monthDiffT, seedOf } from '../dom-placebo/run.mjs';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const y = (n) => Date.UTC(n, 0, 1) / 1000;
export const FROM = y(2010), TO = y(2020), HALF = y(2015);
export const MARKETS = ['xau', 'eurusd', 'gbpusd', 'usdjpy', 'audusd'];
export const EX = { trail: 6, '2R': 1 };
export const FIXED = [0.25, 0.5, 1.0];
export const PICK = 0.25;

export function atr14(B) { const a = new Float64Array(B.length); let s = 0; const tr = (i) => Math.max(B[i].h - B[i].l, Math.abs(B[i].h - B[i - 1].c), Math.abs(B[i].l - B[i - 1].c));
  for (let i = 1; i < B.length; i++) { s += tr(i); if (i > 14) s -= tr(i - 14); a[i] = i >= 14 ? s / 14 : 0; } return a; }
const median = (v) => { const a = [...v].sort((x, y) => x - y), n = a.length; return n ? (n % 2 ? a[(n - 1) / 2] : (a[n / 2 - 1] + a[n / 2]) / 2) : null; };

// the DOM's entry distance from the last closed H1 close (u) and its stop distance (s), in ATR(14) of that candle
export function domDistances(market, F, from = FROM, to = TO) {
  const H = F['1h'], T = F['5m'], A = atr14(H), cost = COSTS[market];
  const u = [], s = []; let all = 0;
  for (const sg of signalsFor(F, '1h', '5m', 'dom', {}, from)) {
    if (sg.trig !== NONE) continue;
    const z = sg.z, d = z.d, ts = T[sg.k0].t; if (ts >= to) continue;
    const li = K.closedCount(H, ts) - 1; if (li < 15 || !(A[li] > 0)) continue;
    const entry = d > 0 ? z.top : z.bot, stop = d > 0 ? z.bot - cost / 2 - 0.25 * A[li] : z.top + cost / 2 + 0.25 * A[li];
    if (!(d * (entry - stop) >= 2 * cost)) continue;
    all++; s.push((d * (entry - stop)) / A[li]);
    const x = (d * (H[li].c - entry)) / A[li]; if (x > 0) u.push(x);
  }
  return { u, s, all, S: median(s) };
}

// random resting limits at H1 closes; uOf(R) gives U for one order; pick = the same selected candles for every stream
export function selectCandles(H, seed, from = FROM, to = TO) {
  const R = K.rng(seed), out = [];
  for (let i = 15; i < H.length; i++) { const pick = R() < PICK; if (pick && H[i].e >= from - 86400 && H[i].e < to) out.push(i); }
  return out;
}
export function randomTrades(market, M5, H, picks, S, uOf, from = FROM, to = TO) {
  const A = atr14(H), cost = COSTS[market], X = exclusions(market);
  const bad = (t) => X.some(([a, b]) => t >= a && t <= b);
  const out = []; let orders = 0;
  for (const i of picks) {
    if (!(A[i] > 0)) continue;
    const ts = H[i].e, C = H[i].c;
    for (const d of [1, -1]) {
      const U = uOf(), entry = C - d * U * A[i], stop = entry - d * S * A[i];
      if (!(d * (entry - stop) > 0)) throw new Error('stop on the wrong side');
      if (!(d * (entry - stop) >= 2 * cost)) continue;
      orders++;
      const r = multi(M5, d, entry, stop, 'lim', ts, ts + 12 * 300, 2, null, 2 * 86400, null);
      if (!r || r.risk < cost || r.t < from || r.t >= to || bad(r.t)) continue;
      out.push({ t: r.t, side: d, u: +U.toFixed(3), cr: +(cost / r.risk).toFixed(5), trail: +r.R[EX.trail].toFixed(4), '2R': +r.R[EX['2R']].toFixed(4) });
    }
  }
  return { rows: out, orders };
}

const p1 = (t) => (t == null ? 1 : t > 0 ? K.pFromT(t, 1000) / 2 : 1 - K.pFromT(t, 1000) / 2);
export function report(all) {
  const pool = (k) => MARKETS.flatMap((m) => all[m][k]);
  const D = pool('dom'), Rn = pool('rnd');
  const early = summ(Rn.filter((r) => r.t < HALF), 'trail'), late = summ(Rn.filter((r) => r.t >= HALF), 'trail');
  const T2 = welch(D, Rn, 'trail');
  const pv = [Math.max(p1(early.tBefore), p1(late.tBefore)), p1(T2.t)], holm = K.holm(pv);
  const passes = [early.before > 0 && early.tBefore >= 2 && late.before > 0 && late.tBefore >= 2 && holm[0] < 0.05,
    T2.diff > 0 && T2.t >= 2 && holm[1] < 0.05];
  const streams = (rows) => ({ trail: summ(rows, 'trail'), '2R': summ(rows, '2R') });
  const keys = ['dom', 'rnd', ...FIXED.map((u) => 'u' + u)];
  const pooled = Object.fromEntries(keys.map((k) => [k, streams(pool(k))]));
  const halves = {}; for (const [h, f] of [['2010-14', (r) => r.t < HALF], ['2015-19', (r) => r.t >= HALF]])
    halves[h] = Object.fromEntries(keys.map((k) => [k, summ(pool(k).filter(f), 'trail')]));
  const perMarket = {}; for (const m of MARKETS) perMarket[m] = { ...Object.fromEntries(keys.map((k) => [k, summ(all[m][k], 'trail')])),
    domMinusRnd: welch(all[m].dom, all[m].rnd, 'trail'), dist: all[m].dist, fills: all[m].fills };
  const fixedVsDom = Object.fromEntries(FIXED.map((u) => ['u' + u, welch(D, pool('u' + u), 'trail')]));
  return { study: 'limit-random', built: '2026-11-23', basis: 'judged before costs (owner); after costs beside', window: '2010-01-01 to 2019-12-31',
    markets: MARKETS, verdict: passes[0] ? 'PASS' : 'FAIL', passes, holm: holm.map((x) => +x.toPrecision(3)),
    T1: { early, late }, T2: { ...T2, monthDiffT: monthDiffT(D, Rn, 'trail'), after: welch(D, Rn, 'trail', true), r2: welch(D, Rn, '2R') },
    pooled, halves, fixedVsDom, perMarket };
}

const main = process.argv[1] === fileURLToPath(import.meta.url);
if (main && process.argv[2] === 'market') {
  const m = process.argv[3], dir = process.argv[4]; fs.mkdirSync(dir, { recursive: true });
  const M5 = K.load(m, '5m', { from: FROM - 200 * 86400, to: TO }), F = frames(M5), H = F['1h'];
  const dd = domDistances(m, F);
  const q = (v, p) => { const a = [...v].sort((x, y) => x - y); return a.length ? +a[Math.floor(p * (a.length - 1))].toFixed(3) : null; };
  const dist = { signals: dd.all, kept: dd.u.length, keptShare: +(dd.u.length / dd.all).toFixed(3), S: +dd.S.toFixed(4),
    u: { p10: q(dd.u, 0.1), p50: q(dd.u, 0.5), p90: q(dd.u, 0.9) }, s: { p10: q(dd.s, 0.1), p50: q(dd.s, 0.5), p90: q(dd.s, 0.9) } };
  const picks = selectCandles(H, seedOf(m, 1));
  const ru = K.rng(seedOf(m, 2));
  const rnd = randomTrades(m, M5, H, picks, dd.S, () => dd.u[Math.floor(ru() * dd.u.length)]);
  const o = { dom: tradesOf(m, M5, F, buildZones('dom', H), 'dom'), rnd: rnd.rows, dist, fills: { picks: picks.length, rnd: [rnd.orders, rnd.rows.length] } };
  for (const u of FIXED) { const x = randomTrades(m, M5, H, picks, dd.S, () => u); o['u' + u] = x.rows; o.fills['u' + u] = [x.orders, x.rows.length]; }
  fs.writeFileSync(path.join(dir, m + '.json'), JSON.stringify(o));
  console.log(m, JSON.stringify(dist), JSON.stringify(o.fills), 'dom', o.dom.length);
}
if (main && process.argv[2] === 'report') {
  const dir = process.argv[3], all = {};
  for (const m of MARKETS) all[m] = JSON.parse(fs.readFileSync(path.join(dir, m + '.json'), 'utf8'));
  const res = report(all);
  const s = res.pooled, f = (x) => (x >= 0 ? '+' : '') + x.toFixed(3);
  res.headline = `Before costs, trail exit, 2010-2019 pooled: random resting limits ${f(s.rnd.trail.before)}R a trade (n ${s.rnd.trail.n}, month t ${s.rnd.trail.tBefore}; 2010-14 t ${res.T1.early.tBefore}, 2015-19 t ${res.T1.late.tBefore}), DOM ${f(s.dom.trail.before)}R (n ${s.dom.trail.n}); DOM minus random Welch t ${res.T2.t}.`;
  fs.writeFileSync(path.join(HERE, 'result.json'), JSON.stringify(res, null, 1) + '\n');
  console.log(JSON.stringify({ verdict: res.verdict, passes: res.passes, holm: res.holm, T1: res.T1, T2: res.T2, pooled: res.pooled, headline: res.headline }, null, 1));
}
