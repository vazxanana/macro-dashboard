// research/edge/dom-filters/run.mjs - the 13 combo-grid-3 filters on the H1 dominant-zone limit, 2010-2019 (PREREGISTRATION.md).
// node --max-old-space-size=6000 research/edge/dom-filters/run.mjs market <m> <dir>   one market's trades with their filter flags
// node research/edge/dom-filters/run.mjs report <dir>                                pool, test, write result.json
// Research only. The trades are dom-zone-holdout's trades() (same signals, entry, stop, exits; checked per market at run time);
// each filter is computed as combo-grid-3 runMarket computes it (faithful copy below), from candles closed by the touch.
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import * as K from '../_lib/edgekit.mjs';
import { frames, signalsFor, multi, COSTS, exclusions, NONE, egZones } from '../combo-grid-3/run.mjs';
import { trades as holdoutTrades } from '../dom-zone-holdout/run.mjs';
import { direction } from '../../../council/eg-methods.mjs';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const y = (n) => Date.UTC(n, 0, 1) / 1000;
export const FROM = y(2010), MID = y(2015), TO = y(2020);
export const MARKETS = ['xau', 'eurusd', 'gbpusd', 'usdjpy', 'audusd'];
export const FILTERS = ['struct', 'structUp', 'msnr', 'd1eg', 'weekly', 'er20', 'er35', 'weeklyEr20', 'london', 'ny', 'sideways', 'half', 'boConf'];
export const EX = { trail: 6, '1R': 0, '2R': 1, '4R': 3 };
const SEC = { ...K.TF, '1w': 604800 };

function atr14(B) { const a = new Float64Array(B.length); let s = 0; const tr = (i) => Math.max(B[i].h - B[i].l, Math.abs(B[i].h - B[i - 1].c), Math.abs(B[i].l - B[i - 1].c));
  for (let i = 1; i < B.length; i++) { s += tr(i); if (i > 14) s -= tr(i - 14); a[i] = i >= 14 ? s / 14 : 0; } return a; }
const conv = (B) => B.map((b) => ({ time: b.t, open: b.o, high: b.h, low: b.l, close: b.c }));
const upto = (arr, t) => { let lo = 0, hi = arr.length; while (lo < hi) { const m = (lo + hi) >> 1; if (arr[m] <= t) lo = m + 1; else hi = m; } return lo; };

// the 13 flags of one trade (combo-grid-3 runMarket, key timeframe H1, timeframe above H4)
export function filterFlags(ctx, z, ts) {
  const { L, A, D, Wk, tg, d1z, er } = ctx, d = z.d;
  const li = K.closedCount(L, ts) - 1, ai = K.closedCount(A, ts) - 1;
  const w = K.closedCount(Wk, ts), wk = (w >= 2 ? Math.sign(Wk[w - 1].c - Wk[w - 2].c) : 0) === d;
  const di = K.closedCount(D, ts) - 1, e20 = di >= 20 ? er[di] : 0, hr = new Date(ts * 1000).getUTCHours();
  let n = 0, hi = d1z.length; while (n < hi) { const m = (n + hi) >> 1; if (d1z[m].at <= ts) n = m + 1; else hi = m; } const d1 = n ? d1z[n - 1].d : 0;
  const sideways = z.i + 2 < L.length && L[z.i + 2].e <= ts && !(L[z.i + 1].l <= z.top && L[z.i + 1].h >= z.bot) && !(L[z.i + 2].l <= z.top && L[z.i + 2].h >= z.bot);
  const ref0 = d > 0 ? z.top : z.bot;
  let half = false; { const k = upto(tg.swT, ts); let H = null, Lo = null; for (let q = k - 1; q >= 0 && (H == null || Lo == null); q--) { const s = tg.sw[q]; if (s.type === 'H' && H == null) H = s.price; if (s.type === 'L' && Lo == null) Lo = s.price; }
    if (H != null && Lo != null && H > Lo) { const mid = (H + Lo) / 2; half = d > 0 ? ref0 <= mid : ref0 >= mid; } }
  const ne = upto(tg.evT, ts), le = ne ? tg.ev[ne - 1] : null, boConf = !!le && le.dir === d && le.kind === 'BO';
  return { struct: tg.st[li] === d, structUp: ai >= 0 && tg.up[ai] === d, msnr: tg.ms[li] === d, d1eg: d1 === d, weekly: wk, er20: e20 >= 0.2, er35: e20 >= 0.35,
    weeklyEr20: wk && e20 >= 0.2, london: hr >= 7 && hr < 12, ny: hr >= 12 && hr < 17, sideways, half, boConf };
}

// frames and the filters' inputs of one 5-minute series
export function context(M5) {
  const F = frames(M5), H = F['1h'];
  const A = F['4h'], st = K.structure(H, 3), sw = K.swings(A, 3).sort((p, q) => p.ct - q.ct);
  const keyOf = (t) => { const k = K.barAt(A, t); return k < 0 ? t : A[k].t; };
  const tg = { st: st.side, ev: st.events, evT: st.events.map((e) => e.t), up: K.structure(A, 3).side, ms: direction(conv(H), keyOf, SEC['4h']).call, sw, swT: sw.map((p) => p.ct) };
  const D = F['1d'], er = new Float64Array(D.length);
  for (let i = 20; i < D.length; i++) { let p = 0; for (let j = i - 19; j <= i; j++) p += Math.abs(D[j].c - D[j - 1].c); er[i] = p > 0 ? Math.abs(D[i].c - D[i - 20].c) / p : 0; }
  const ctx = { L: H, A, D, Wk: F['1w'], tg, d1z: egZones(D, 3).sort((p, q) => p.at - q.at), er };
  return { F, ctx };
}

export function trades(market, from = FROM, to = TO) {
  const M5 = K.load(market, '5m', { from: from - 200 * 86400, to }); if (!M5.length) return [];
  const { F, ctx } = context(M5), H = F['1h'], T = F['5m'], AT = atr14(H), cost = COSTS[market], X = exclusions(market);
  const bad = (t) => X.some(([a, b]) => t >= a && t <= b);
  const out = [];
  for (const sg of signalsFor(F, '1h', '5m', 'dom', {}, from)) {   // dom-zone-holdout trades(), line for line
    if (sg.trig !== NONE) continue;
    const z = sg.z, d = z.d, ts = T[sg.k0].t; if (ts >= to) continue;
    const li = K.closedCount(H, ts) - 1; if (li < 15) continue;
    const entry = d > 0 ? z.top : z.bot, stop = d > 0 ? z.bot - cost / 2 - 0.25 * AT[li] : z.top + cost / 2 + 0.25 * AT[li];
    if (!(d * (entry - stop) >= 2 * cost)) continue;
    const r = multi(M5, d, entry, stop, 'lim', ts, ts + 12 * 300, 2, null, 2 * 86400, null);
    if (!r || r.risk < cost || r.t < from || r.t >= to || bad(r.t)) continue;
    if (!(d * (entry - stop) > 0)) throw new Error('stop on the winning side');
    const row = { market, t: r.t, ts, side: d, cr: cost / r.risk, f: filterFlags(ctx, z, ts) };
    for (const [k, i] of Object.entries(EX)) row[k] = r.R[i];
    out.push(row);
  }
  return out;
}

// ---- statistics ------------------------------------------------------------------------------------------------------
export function welch(a, b) {
  const m = (x) => x.reduce((s, v) => s + v, 0) / x.length, v = (x, mu) => x.reduce((s, q) => s + (q - mu) ** 2, 0) / (x.length - 1);
  if (a.length < 2 || b.length < 2) return { diff: null, t: null, df: null };
  const ma = m(a), mb = m(b), va = v(a, ma) / a.length, vb = v(b, mb) / b.length, se = Math.sqrt(va + vb);
  const df = (va + vb) ** 2 / (va ** 2 / (a.length - 1) + vb ** 2 / (b.length - 1));
  return { diff: ma - mb, t: se > 0 ? (ma - mb) / se : null, df };
}
export function monthT(rows, key, net) {
  const m = new Map(); for (const r of rows) { const k = new Date(r.t * 1000).toISOString().slice(0, 7); m.set(k, (m.get(k) || 0) + r[key] - (net ? r.cr : 0)); }
  const v = [...m.values()], n = v.length; if (n < 3) return null;
  const mean = v.reduce((a, b) => a + b, 0) / n, sd = Math.sqrt(v.reduce((a, b) => a + (b - mean) ** 2, 0) / (n - 1));
  return sd > 0 ? mean / (sd / Math.sqrt(n)) : null;
}
const r4 = (x) => (x == null ? null : +x.toFixed(4)), r2 = (x) => (x == null ? null : +x.toFixed(2));
export function summ(rows, key = 'trail') {
  const n = rows.length; if (!n) return { n: 0 };
  const g = rows.reduce((a, r) => a + r[key], 0) / n, c = rows.reduce((a, r) => a + r.cr, 0) / n;
  return { n, before: r4(g), tBefore: r2(monthT(rows, key, false)), after: r4(g - c), tAfter: r2(monthT(rows, key, true)) };
}
export const p1 = (t, df = 1000) => (t == null ? 1 : t > 0 ? K.pFromT(t, df) / 2 : 1 - K.pFromT(t, df) / 2);
export function compare(rows, f, key = 'trail', net = false) {
  const val = (r) => r[key] - (net ? r.cr : 0);
  const kept = rows.filter((r) => r.f[f]), drop = rows.filter((r) => !r.f[f]), w = welch(kept.map(val), drop.map(val));
  return { kept: summ(kept, key), dropped: summ(drop, key), diff: r4(w.diff), t: r2(w.t), p: w.t == null ? 1 : p1(w.t, w.df) };
}
export function evaluate(rows) {
  const halves = { '2010-14': rows.filter((r) => r.t < MID), '2015-19': rows.filter((r) => r.t >= MID) };
  const tests = FILTERS.map((f) => { const h = {}; for (const [k, R] of Object.entries(halves)) h[k] = compare(R, f);
    const qual = Object.values(h).every((x) => x.diff > 0 && x.t >= 2), p = Math.max(...Object.values(h).map((x) => x.p));
    const after = {}; for (const [k, R] of Object.entries(halves)) { const c = compare(R, f, 'trail', true); after[k] = { diff: c.diff, t: c.t }; }
    const exits = {}; for (const x of ['1R', '2R', '4R']) { exits[x] = {}; for (const [k, R] of Object.entries(halves)) { const c = compare(R, f, x); exits[x][k] = { diff: c.diff, t: c.t }; } }
    const byMarket = {}; for (const m of MARKETS) { const c = compare(rows.filter((r) => r.market === m), f); byMarket[m] = { diff: c.diff, t: c.t, keptN: c.kept.n }; }
    return { filter: f, halves: h, qual, p, after, exits, byMarket, keptAll: summ(rows.filter((r) => r.f[f])), keepShare: +(rows.filter((r) => r.f[f]).length / rows.length).toFixed(3) }; });
  const adj = K.holm(tests.map((x) => x.p)); tests.forEach((x, i) => { x.holm = +adj[i].toPrecision(3); x.pass = x.qual && adj[i] < 0.05; x.p = +x.p.toPrecision(3); });
  const ref = { all: summ(rows), '2010-14': summ(halves['2010-14']), '2015-19': summ(halves['2015-19']) };
  const refExits = {}; for (const x of Object.keys(EX)) refExits[x] = summ(rows, x);
  const perMarket = {}; for (const m of MARKETS) perMarket[m] = summ(rows.filter((r) => r.market === m));
  return { ref, refExits, perMarket, tests, passes: tests.filter((x) => x.pass).length };
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const [cmd, a, b] = process.argv.slice(2);
  if (cmd === 'market') {
    fs.mkdirSync(b, { recursive: true }); const t0 = Date.now(); const rows = trades(a);
    const ref = holdoutTrades(a, FROM, TO);                       // the same trade list as dom-zone-holdout, or stop
    const same = ref.length === rows.length && ref.every((r, i) => r.t === rows[i].t && r.side === rows[i].side && r.trail === rows[i].trail);
    if (!same) throw new Error(`${a}: trade list differs from dom-zone-holdout (${rows.length} vs ${ref.length})`);
    fs.writeFileSync(path.join(b, a + '.json'), JSON.stringify(rows)); console.log(a, rows.length, 'trades, same as holdout', ((Date.now() - t0) / 1000).toFixed(0) + 's');
  } else if (cmd === 'report') {
    const rows = MARKETS.flatMap((m) => JSON.parse(fs.readFileSync(path.join(a, m + '.json'), 'utf8')));
    const E = evaluate(rows), best = [...E.tests].sort((p, q) => p.holm - q.holm)[0];
    const verdict = E.passes ? 'PASS' : 'FAIL';
    const headline = `${E.passes} of 13 filters pass before costs; unfiltered rule ${E.ref.all.before >= 0 ? '+' : ''}${E.ref.all.before}R a trade (n ${E.ref.all.n}, month t ${E.ref.all.tBefore}); best filter ${best.filter} kept minus dropped ${best.halves['2010-14'].diff} / ${best.halves['2015-19'].diff}R (Welch t ${best.halves['2010-14'].t} / ${best.halves['2015-19'].t}, Holm p ${best.holm})`;
    const res = { study: 'dom-filters', built: '2026-11-23', basis: 'judged before costs (owner); after costs beside', verdict, headline,
      window: '2010-01-01 to 2019-12-31', markets: MARKETS, exit: 'trail', trades: rows.length, sameAsHoldout: true, ...E };
    fs.writeFileSync(path.join(HERE, 'result.json'), JSON.stringify(res, null, 1));
    console.log(JSON.stringify({ verdict, headline, ref: E.ref, tests: E.tests.map((x) => ({ f: x.filter, h: x.halves, after: x.after, holm: x.holm, pass: x.pass, share: x.keepShare, kept: x.keptAll })) }, null, 1));
  } else console.log('usage: run.mjs market <m> <dir> | report <dir>');
}
