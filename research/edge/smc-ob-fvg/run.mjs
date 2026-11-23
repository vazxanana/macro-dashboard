// research/edge/smc-ob-fvg/run.mjs - PREREGISTRATION.md (23 Nov 2026): H1 order block with displacement, its placebo, and the
// H1 FVG 50% fill with the H4 structure. Research only: reads the edgekit candle cache, writes <dir> and its own result.json.
//   node --max-old-space-size=6000 research/edge/smc-ob-fvg/run.mjs market <m> <dir>   one market's trades -> <dir>/<m>.json
//   node research/edge/smc-ob-fvg/run.mjs report <dir>                                  pool, tests -> result.json
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import * as K from '../_lib/edgekit.mjs';
import { multi } from '../combo-grid-3/run.mjs';
import { COSTS, exclusions } from '../combo-grid-2/run.mjs';
import { welch, monthDiffT } from '../dom-placebo/run.mjs';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const y = (n) => Date.UTC(n, 0, 1) / 1000;
export const FROM = y(2010), TO = y(2020), HALF = y(2015);
export const MARKETS = ['xau', 'eurusd', 'gbpusd', 'usdjpy', 'audusd'];
export const P = { swingK: 3, obBack: 10, life: 120, buf: 0.1, rr: 2, cap: 5 * 86400, back: 24 };

const colour = (b) => (b.c > b.o ? 1 : b.c < b.o ? -1 : 0);
export function atr14(B) { const a = new Float64Array(B.length); let s = 0; const tr = (i) => Math.max(B[i].h - B[i].l, Math.abs(B[i].h - B[i - 1].c), Math.abs(B[i].l - B[i - 1].c));
  for (let i = 1; i < B.length; i++) { s += tr(i); if (i > 14) s -= tr(i - 14); a[i] = i >= 14 ? s / 14 : 0; } return a; }
// first H1 close through the far side after candle i (d = side of the trade), else the end of its life
export function deathOf(H, i, d, bot, top) {
  for (let j = i + 1; j < H.length && j <= i + P.life; j++) if (d > 0 ? H[j].c < bot : H[j].c > top) return H[j].e;
  return i + P.life < H.length ? H[i + P.life].e : Infinity;
}

// (A) order blocks: { d, bot, top, i (break candle), at (its close), ob (block index) }
export function obZones(H) {
  const out = [];
  for (const ev of K.structure(H, P.swingK).events) {
    const i = ev.i, d = ev.dir, s = ev.from;
    let o = s; // impulse origin: the extreme against the break among s+1..i
    for (let k = s + 1; k <= i; k++) if (d > 0 ? H[k].l < H[o].l : H[k].h > H[o].h) o = k;
    let ob = -1; for (let k = o; k >= Math.max(0, o - P.obBack); k--) if (colour(H[k]) === -d) { ob = k; break; }
    if (ob < 0) continue;
    let fvg = false; for (let k = ob + 2; k + 1 <= i; k++) if (d > 0 ? H[k + 1].l > H[k - 1].h : H[k + 1].h < H[k - 1].l) { fvg = true; break; }
    if (!fvg) continue;
    const bot = H[ob].l, top = H[ob].h; if (!(top > bot)) continue;
    let dead = false; for (let k = ob + 1; k <= i; k++) if (d > 0 ? H[k].c < bot : H[k].c > top) { dead = true; break; }
    if (dead) continue;
    if (!(d > 0 ? H[i].c > top : H[i].c < bot)) continue;
    out.push({ d, bot, top, i, at: H[i].e, ob });
  }
  return out;
}

// (B) FVGs with the H4 structure: { d, bot, top, i (k+1), at }
export function fvgZones(H, H4) {
  const side = K.structure(H4, P.swingK).side, out = [];
  for (let k = 1; k + 1 < H.length; k++) {
    const i = k + 1, d = H[i].l > H[k - 1].h ? 1 : H[i].h < H[k - 1].l ? -1 : 0; if (!d) continue;
    const n4 = K.closedCount(H4, H[i].e); if (n4 < 1 || side[n4 - 1] !== d) continue;
    const bot = d > 0 ? H[k - 1].h : H[i].h, top = d > 0 ? H[i].l : H[k - 1].l;
    out.push({ d, bot, top, i, at: H[i].e });
  }
  return out;
}

// placebo: a random candle among the 24 before the signal candle (not the block) of colour col(z); same height; near edge at
// its body near edge; below the signal close for a buy (above for a sell)
export function placebo(H, zones, seed, col) {
  const R = K.rng(seed), out = [];
  for (const z of zones) {
    const pool = []; for (let j = Math.max(0, z.i - P.back); j <= z.i - 1; j++) if (j !== z.ob && colour(H[j]) === col(z)) pool.push(j);
    if (!pool.length) continue;
    const j = pool[Math.floor(R() * pool.length)], hgt = z.top - z.bot;
    const near = z.d > 0 ? Math.max(H[j].o, H[j].c) : Math.min(H[j].o, H[j].c);
    const bot = z.d > 0 ? near - hgt : near, top = z.d > 0 ? near : near + hgt;
    if (!(z.d > 0 ? top < H[z.i].c : bot > H[z.i].c)) continue;
    out.push({ d: z.d, bot, top, i: z.i, at: z.at, src: j });
  }
  return out;
}

export function trades(market, M5, H, zones, mode, from = FROM, to = TO) {
  const A = atr14(H), cost = COSTS[market], X = exclusions(market), bad = (t) => X.some(([a, b]) => t >= a && t <= b), out = [];
  for (const z of zones) {
    if (z.at < from - 10 * 86400 || z.at >= to || z.i < 15) continue;
    const d = z.d, buf = P.buf * A[z.i];
    const entry = mode === 'mid' ? (z.bot + z.top) / 2 : d > 0 ? z.top : z.bot;
    const stop = d > 0 ? z.bot - buf : z.top + buf;
    if (!(d * (entry - stop) > 0)) throw new Error('stop on the wrong side');
    const r = multi(M5, d, entry, stop, 'lim', z.at, deathOf(H, z.i, d, z.bot, z.top), P.rr, null, P.cap, null);
    if (!r || r.risk < cost || r.t < from || r.t >= to || bad(r.t)) continue;
    out.push({ t: r.t, side: d, cr: +(cost / r.risk).toFixed(5), R: +r.R[1].toFixed(4) });
  }
  return out;
}

// ---- statistics -------------------------------------------------------------------------------------------------------
const mom = (v) => { const n = v.length; if (!n) return { n: 0, mean: 0, sd: 0 }; const m = v.reduce((a, b) => a + b, 0) / n;
  return { n, mean: m, sd: n > 1 ? Math.sqrt(v.reduce((a, b) => a + (b - m) ** 2, 0) / (n - 1)) : 0 }; };
const mkey = (t) => new Date(t * 1000).toISOString().slice(0, 7);
export function monthT(rows, net) { // calendar months from the first to the last trade, empty months 0
  if (!rows.length) return null; const m = new Map(); for (const r of rows) m.set(mkey(r.t), (m.get(mkey(r.t)) || 0) + r.R - (net ? r.cr : 0));
  const ks = [...m.keys()].sort(); let [yy, mm] = ks[0].split('-').map(Number); const [y1, m1] = ks[ks.length - 1].split('-').map(Number); const v = [];
  while (yy < y1 || (yy === y1 && mm <= m1)) { v.push(m.get(`${yy}-${String(mm).padStart(2, '0')}`) || 0); mm === 12 ? (yy++, (mm = 1)) : mm++; }
  const s = mom(v); return s.n < 3 || !(s.sd > 0) ? null : +(s.mean / (s.sd / Math.sqrt(s.n))).toFixed(2);
}
export function summ(rows) {
  const n = rows.length; if (!n) return { n: 0 };
  const g = rows.reduce((a, r) => a + r.R, 0) / n, c = rows.reduce((a, r) => a + r.cr, 0) / n;
  return { n, win: +(rows.filter((r) => r.R > 0).length / n).toFixed(3), before: +g.toFixed(4), tBefore: monthT(rows, false), after: +(g - c).toFixed(4), tAfter: monthT(rows, true) };
}
const p1 = (t) => (t == null ? 1 : t > 0 ? K.pFromT(t, 1000) / 2 : 1 - K.pFromT(t, 1000) / 2);
const h1 = (r) => r.t < HALF, h2 = (r) => r.t >= HALF;

export function report(all) {
  const pool = (k) => MARKETS.flatMap((m) => all[m][k]);
  const OB = pool('ob'), OP = pool('obP'), FV = pool('fvg'), FP = pool('fvgP');
  const T1 = { all: summ(OB), a: summ(OB.filter(h1)), b: summ(OB.filter(h2)) };
  const T2 = { all: welch(OB, OP, 'R'), a: welch(OB.filter(h1), OP.filter(h1), 'R'), b: welch(OB.filter(h2), OP.filter(h2), 'R'), monthDiffT: monthDiffT(OB, OP, 'R'), after: welch(OB, OP, 'R', true) };
  const T3 = { all: summ(FV), a: summ(FV.filter(h1)), b: summ(FV.filter(h2)) };
  const fvgVsP = welch(FV, FP, 'R');
  const holm = K.holm([p1(T1.all.tBefore), p1(T2.all.t), p1(T3.all.tBefore)]);
  const lvl = (T) => T.a.before > 0 && T.b.before > 0 && T.a.tBefore >= 2 && T.b.tBefore >= 2;
  const passes = [lvl(T1) && holm[0] < 0.05, T2.a.diff > 0 && T2.b.diff > 0 && T2.all.t >= 2 && holm[1] < 0.05, lvl(T3) && holm[2] < 0.05];
  const fvgBeats = fvgVsP.diff > 0 && fvgVsP.t >= 2;
  const verdict = (passes[0] && passes[1]) || (passes[2] && fvgBeats) ? 'PASS' : OB.length < 200 || FV.length < 200 ? 'INCONCLUSIVE' : 'FAIL';
  const seeds = {}; for (const s of [2, 3, 4, 5]) { const a = MARKETS.flatMap((m) => all[m]['obP' + s] || []); seeds[s] = { placebo: summ(a), obMinus: welch(OB, a, 'R') }; }
  const perMarket = {}; for (const m of MARKETS) { const o = all[m];
    perMarket[m] = { ob: summ(o.ob), obPlacebo: summ(o.obP), obMinus: welch(o.ob, o.obP, 'R'), fvg: summ(o.fvg), fvgPlacebo: summ(o.fvgP), fvgMinus: welch(o.fvg, o.fvgP, 'R') }; }
  return { study: 'smc-ob-fvg', built: '2026-11-23', basis: 'judged before costs; after costs beside', window: '2010-01-01 to 2019-12-31',
    markets: MARKETS, params: P, verdict, passes, holm: holm.map((x) => +x.toPrecision(3)), fvgBeatsPlacebo: fvgBeats,
    T1, T2, T3, fvgMinusPlacebo: fvgVsP, pooled: { ob: summ(OB), obPlacebo: summ(OP), fvg: summ(FV), fvgPlacebo: summ(FP) }, seeds, perMarket };
}

const main = process.argv[1] === fileURLToPath(import.meta.url);
if (main && process.argv[2] === 'market') {
  const m = process.argv[3], dir = process.argv[4]; fs.mkdirSync(dir, { recursive: true });
  const M5 = K.load(m, '5m', { from: y(2009), to: TO }), H = K.resample(M5, 3600), H4 = K.resample(M5, 14400);
  const seed = (k) => { let h = 2166136261; for (const ch of m + ':' + k) h = Math.imul(h ^ ch.charCodeAt(0), 16777619); return h >>> 0; };
  const OBZ = obZones(H), FVZ = fvgZones(H, H4);
  const o = { ob: trades(m, M5, H, OBZ, 'near'), obP: trades(m, M5, H, placebo(H, OBZ, seed(1), (z) => -z.d), 'near'),
    fvg: trades(m, M5, H, FVZ, 'mid'), fvgP: trades(m, M5, H, placebo(H, FVZ, seed(11), (z) => z.d), 'mid') };
  for (const s of [2, 3, 4, 5]) o['obP' + s] = trades(m, M5, H, placebo(H, OBZ, seed(s), (z) => -z.d), 'near');
  fs.writeFileSync(path.join(dir, m + '.json'), JSON.stringify(o));
  console.log(m, { zones: { ob: OBZ.length, fvg: FVZ.length } }, Object.fromEntries(Object.entries(o).map(([k, v]) => [k, v.length])));
}
if (main && process.argv[2] === 'report') {
  const dir = process.argv[3], all = {};
  for (const m of MARKETS) all[m] = JSON.parse(fs.readFileSync(path.join(dir, m + '.json'), 'utf8'));
  const res = report(all), s = res.pooled, f = (x) => (x >= 0 ? '+' : '') + x.toFixed(3);
  res.headline = `Before costs, 2010-2019 pooled, 2R: order block ${f(s.ob.before)}R a trade (n ${s.ob.n}, month t ${s.ob.tBefore}), its placebo ${f(s.obPlacebo.before)}R (n ${s.obPlacebo.n}; difference Welch t ${res.T2.all.t}); FVG 50% fill ${f(s.fvg.before)}R (n ${s.fvg.n}, month t ${s.fvg.tBefore}). After costs: ${f(s.ob.after)}R and ${f(s.fvg.after)}R.`;
  fs.writeFileSync(path.join(HERE, 'result.json'), JSON.stringify(res, null, 1) + '\n');
  console.log(JSON.stringify({ verdict: res.verdict, passes: res.passes, holm: res.holm, headline: res.headline }, null, 1));
}
