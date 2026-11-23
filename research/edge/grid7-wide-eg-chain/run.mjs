// research/edge/grid7-wide-eg-chain/run.mjs - the three-timeframe engulf chain of PREREGISTRATION.md (23 Nov 2026): 36 cells
// (3 chains x 2 entries x 3 exits, with and without the Daily MSNR call agreeing), each against a matched control, ten markets,
// discovery 2005-14, confirmation 2015 to Oct 2026, judged before costs on month sums. Research only: nothing live imports it.
//   EDGE_DATA=<cache> node research/edge/grid7-wide-eg-chain/run.mjs market <m> <outDir>   one market's accumulators
//   EDGE_DATA=<cache> node research/edge/grid7-wide-eg-chain/run.mjs cut <m> <outDir>      the cut test of one market
//   node research/edge/grid7-wide-eg-chain/run.mjs report <outDir>                         result.json + RESULT.md
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import * as K from '../_lib/edgekit.mjs';
import { frames } from '../combo-grid-3/run.mjs';
import { COSTS, exclusions } from '../combo-grid-2/run.mjs';
import { atr14, startIdx } from '../dom-trade-through/run.mjs';
import { dailyCalls, mstat, p1, welch, monthOf, NM, DM, FROM, SPLIT, TO, MARKETS, ASSUMED } from '../grid7-wide-core/run.mjs';
import { zones } from '../../../council/eg-methods.mjs';

const HERE = path.dirname(fileURLToPath(import.meta.url));
export { MARKETS, ASSUMED };
export const CHAINS = [{ k: 'A', tfs: ['1d', '4h', '1h'], cap: 10 * 86400 }, { k: 'B', tfs: ['4h', '1h', '15m'], cap: 3 * 86400 }, { k: 'C', tfs: ['1h', '15m', '5m'], cap: 86400 }];
export const ENTRIES = ['mkt', 'lim50'], EXITS = ['1R', '2R', 'opp'], CALLS = ['all', 'agree'];
export const WAIT = 24, FILL = 24, ATRK = 0.1;
export const SEC = { '5m': 300, '15m': 900, '1h': 3600, '4h': 14400, '1d': 86400 };
export const NC = 36;
export const cellIndex = (ch, en, x, c) => ((ch * 2 + en) * 3 + x) * 2 + c;
export function cellName(i) { const c = i % 2; i = (i - c) / 2; const x = i % 3; i = (i - x) / 3; const en = i % 2; const ch = (i - en) / 2;
  return { chain: CHAINS[ch].k, tfs: CHAINS[ch].tfs, entry: ENTRIES[en], exit: EXITS[x], call: CALLS[c], ch, en, x, c }; }

const conv = (B) => B.map((b) => ({ time: b.t, open: b.o, high: b.h, low: b.l, close: b.c }));
const lower = (C, t) => { let lo = 0, hi = C.length; while (lo < hi) { const m = (lo + hi) >> 1; if (C[m].t < t) lo = m + 1; else hi = m; } return lo; };
const overlap = (a, b) => a.bot <= b.top && a.top >= b.bot;

// ---- the chain signals (closed candles only) ------------------------------------------------------------------------
// returns { sig: [...], pool: per chain, the confirmation-timeframe zones that are no confirmation of the chain }
// a signal: { ch, s, K, ci (index into the confirmation candles), cz (confirmation zone), ez (engulf zone), stop, entry50,
//             atr (engulf timeframe ATR at K), opp (near side of the nearest opposite zone-timeframe zone or null), call }
export function chainSignals(F) {
  const calls = dailyCalls(F), D = F['1d'];
  const callAt = (t) => { const i = K.closedCount(D, t) - 1; return i >= 0 ? calls[i] : 0; };
  const Z = {}; for (const tf of ['1d', '4h', '1h', '15m', '5m']) Z[tf] = zones(conv(F[tf]), tf);
  const ATR = {}; for (const tf of ['4h', '1h', '15m']) ATR[tf] = atr14(F[tf]);
  const sig = [], pool = [];
  CHAINS.forEach((chn, ch) => {
    const [zt, et, ct] = chn.tfs, CE = F[et], CC = F[ct], secE = SEC[et], ZZ = Z[zt], ZE = Z[et], ZC = Z[ct], atrE = ATR[et];
    // step 1 + the return: per marking zone, the close of the first engulf-timeframe candle after it is known that trades into it
    const marks = [];
    for (const z of ZZ) { for (let k = lower(CE, z.at); k < CE.length && CE[k].t + secE <= z.end; k++) if (z.dir > 0 ? CE[k].l <= z.top : CE[k].h >= z.bot) { marks.push({ z, ret: CE[k].t + secE }); break; } }
    marks.sort((a, b) => a.z.at - b.z.at);
    const maxLife = Math.max(...ZZ.map((z) => (z.end === Infinity ? 0 : z.end - z.at)), 0) + 1;
    // step 2: the engulf at the marking zone (the most recent marking zone that fits)
    const egs = [];
    for (const e of ZE) { let M = null; let lo = 0, hi = marks.length; const a0 = e.at - maxLife; while (lo < hi) { const m = (lo + hi) >> 1; if (marks[m].z.at < a0) lo = m + 1; else hi = m; }
      for (let q = lo; q < marks.length && marks[q].z.at <= e.at; q++) { const m = marks[q]; if (m.z.dir === e.dir && m.ret <= e.at && m.z.end > e.at && overlap(e, m.z) && (!M || m.z.at > M.z.at)) M = m; }
      if (M) egs.push({ e, M }); }
    // step 3: the confirmation, one order per confirmation zone
    const isConf = new Set();
    for (const c of ZC) { const d = c.dir, Kt = c.at; let X = null;
      const t0 = c.i >= WAIT ? CC[c.i - WAIT].t : -Infinity; let q0 = 0, q1 = egs.length; while (q0 < q1) { const m = (q0 + q1) >> 1; if (egs[m].e.at <= t0) q0 = m + 1; else q1 = m; }
      for (let q = q0; q < egs.length && egs[q].e.at < Kt; q++) { const x = egs[q], e = x.e; if (e.dir !== d || !(e.end > Kt) || !(x.M.z.end > Kt) || !overlap(c, e)) continue;
        if (c.i >= lower(CC, e.at) + WAIT) continue; if (!X || e.at > X.e.at) X = x; }
      if (!X) continue;
      const e = X.e, ia = K.closedCount(CE, Kt) - 1, atr = ia >= 0 ? atrE[ia] : 0; if (!(atr > 0)) continue;
      const stop = (d > 0 ? e.bot : e.top) - d * ATRK * atr;
      isConf.add(c);
      sig.push({ ch, s: d, K: Kt, ci: c.i, cz: c, entry50: (c.top + c.bot) / 2, stop, atr, oppOf: null, call: callAt(Kt) });
    }
    pool[ch] = ZC.filter((c) => !isConf.has(c));
  });
  return { sig, pool, Z, ATR, callAt };
}
// near side of the nearest opposite zone of the zone timeframe alive at K and ahead of px
export function oppTarget(ZZ, s, Kt, px) { let best = null;
  for (const o of ZZ) { if (o.at > Kt) break; if (o.dir !== -s || !(o.end > Kt)) continue; const p = s > 0 ? o.bot : o.top; if ((p - px) * s > 0 && (best == null || (p - px) * s < (best - px) * s)) best = p; }
  return best; }

// ---- one trade: every exit in one pass ------------------------------------------------------------------------------------
// targets: [price | NaN]. type 'mkt' | 'lim'. Returns null (no fill / no trade) or { fi, fill, risk, R: [..] } before costs.
export function trade(M5, s, type, entry, stop, t0, dead, targets, cap, thr, fixed = null) {
  let i = startIdx(M5, t0), fill;
  if (fixed) { i = fixed.fi; fill = fixed.fill; }
  else if (type === 'mkt') { if (i >= M5.length) return null; fill = M5[i].o; if (!(s * (fill - stop) > 0)) return null; }
  else { for (;; i++) { if (i >= M5.length) return null; const b = M5[i]; if (b.e > dead) return null;
      if (s > 0 ? b.l <= entry - thr : b.h >= entry + thr) { fill = s > 0 ? Math.min(b.o, entry) : Math.max(b.o, entry); break; } } }
  const fi = i, n = targets.length, R = new Array(n).fill(NaN);
  if (type === 'lim' && !(s * (fill - stop) > 0)) { for (let k = 0; k < n; k++) if (!Number.isNaN(targets[k])) R[k] = -1; return { fi, fill, risk: Math.abs(entry - stop), R, gap: true }; }
  const risk = s * (fill - stop), dl = M5[fi].t + cap; let left = targets.filter((x) => !Number.isNaN(x)).length;
  const fin = (k, px) => { if (Number.isNaN(R[k]) && !Number.isNaN(targets[k])) { R[k] = (s * (px - fill)) / risk; left--; } };
  for (let j = fi; j < M5.length && left > 0; j++) { const b = M5[j], first = j === fi;
    if (!first) { if (s * (b.o - stop) <= 0) { for (let k = 0; k < n; k++) fin(k, b.o); continue; } for (let k = 0; k < n; k++) if (s * (b.o - targets[k]) >= 0) fin(k, b.o); }
    if (s > 0 ? b.l <= stop : b.h >= stop) { for (let k = 0; k < n; k++) fin(k, stop); continue; }
    if (!(first && type === 'lim')) for (let k = 0; k < n; k++) if (s > 0 ? b.h >= targets[k] : b.l <= targets[k]) fin(k, targets[k]);
    if (b.e >= dl) for (let k = 0; k < n; k++) fin(k, b.c); }
  if (left > 0) return null;   // ran out of candles
  return { fi, fill, risk, R };
}

// the order of one signal under one entry: { type, entry, stop, t0, dead } (dead = the limit's expiry or cancel)
function orderOf(CC, secC, g, en, stop) {
  if (en === 0) return { type: 'mkt', entry: null, stop, t0: g.K, dead: Infinity };
  const entry = g.entry50, s = g.s; if (!(s * (entry - stop) > 0)) return null;
  let dead = CC[g.ci + FILL] ? CC[g.ci + FILL].t + secC : g.K + FILL * secC;
  for (let j = g.ci + 1; j < CC.length && CC[j].t + secC <= dead; j++) if (s > 0 ? CC[j].c < stop : CC[j].c > stop) { dead = CC[j].t + secC; break; }
  return { type: 'lim', entry, stop, t0: g.K, dead };
}

const inBad = (X, t) => { let lo = 0, hi = X.length; while (lo < hi) { const m = (lo + hi) >> 1; if (X[m][0] <= t) lo = m + 1; else hi = m; } return lo > 0 && t <= X[lo - 1][1]; };
export function newAcc() { return { ms: new Float64Array(NC * NM), msNet: new Float64Array(NC * NM), n: new Float64Array(NC * 2), sum: new Float64Array(NC * 2),
  sq: new Float64Array(NC * 2), net: new Float64Array(NC * 2), win: new Float64Array(NC * 2) }; }
function add(A, c, w, m, R, cr) { A.ms[c * NM + m] += R; A.msNet[c * NM + m] += R - cr; A.n[c * 2 + w]++; A.sum[c * 2 + w] += R; A.sq[c * 2 + w] += R * R; A.net[c * 2 + w] += R - cr; if (R > 0) A.win[c * 2 + w]++; }

export function runMarket(market) {
  const M5 = K.load(market, '5m', { from: '2004-01-01', to: '2026-11-01' }); const F = frames(M5);
  const { sig, pool, Z, ATR, callAt } = chainSignals(F);
  const cost = COSTS[market], X = exclusions(market), thr = cost / 2, rnd = K.rng(1000 + MARKETS.indexOf(market));
  const real = newAcc(), ctl = newAcc(), plac = newAcc(); const cnt = { signals: sig.length, ctlDrawn: 0, ctlNone: 0, nofill: 0, dropped: 0, small: 0, noOpp: 0, gaps: 0, trades: 0 };
  // the control pools by chain, side, month
  const byKey = CHAINS.map((_, ch) => { const m = new Map(); for (const z of pool[ch]) { const k = z.dir + '|' + monthOf(z.at); (m.get(k) || m.set(k, []).get(k)).push(z); } return m; });
  const runOne = (g, en, stop) => {   // one order of a signal (real or control) -> { t, cr, R[3], fill, risk, fi } or null
    const chn = CHAINS[g.ch], CC = F[chn.tfs[2]], secC = SEC[chn.tfs[2]], s = g.s;
    const o = orderOf(CC, secC, g, en, stop); if (!o) return null;
    // fill first (targets need the fill for R multiples); find it with a dummy target set, then rerun with the real targets
    let fi, fill;
    if (o.type === 'mkt') { fi = startIdx(M5, o.t0); if (fi >= M5.length) return null; fill = M5[fi].o; if (!(s * (fill - stop) > 0)) return null; }
    else { let i = startIdx(M5, o.t0); for (;; i++) { if (i >= M5.length) { cnt.nofill++; return null; } const b = M5[i]; if (b.e > o.dead) { cnt.nofill++; return null; }
        if (s > 0 ? b.l <= o.entry - thr : b.h >= o.entry + thr) { fill = s > 0 ? Math.min(b.o, o.entry) : Math.max(b.o, o.entry); fi = i; break; } } }
    const t = M5[fi].t; if (t < FROM || t >= TO) return null;
    if (X.length && inBad(X, t)) { cnt.dropped++; return null; }
    const risk = s * (fill - stop);
    if (risk > 0 && risk < cost) { cnt.small++; return null; }
    const ZZ = Z[chn.tfs[0]], ref = o.type === 'mkt' ? fill : o.entry, rk = Math.abs(ref - stop);
    let oppP = oppTarget(ZZ, s, g.K, ref); if (oppP != null && Math.abs(oppP - ref) < rk) oppP = null; if (oppP == null) cnt.noOpp++;
    const base = risk > 0 ? risk : rk;
    const tg = [fill + s * base, fill + 2 * s * base, oppP == null ? NaN : oppP];
    const r = trade(M5, s, o.type, o.entry, stop, o.t0, o.dead, tg, chn.cap, thr); if (!r) return null;
    if (r.fi !== fi) throw new Error('fill moved');
    if (!r.gap && !(s * (r.fill - stop) > 0)) throw new Error('stop on the wrong side');
    if (r.gap) cnt.gaps++;
    return { t, fi, fill, risk: base, R: r.R, cr: cost / base, tg, type: o.type, cap: chn.cap, gap: !!r.gap };
  };
  const flip = (g, x) => {   // the side-flipped trade: same fill candle and price, other side, stop the same distance, same R multiples
    const s = -g.s, stop = x.fill - s * x.risk; const mult = x.tg.map((p) => (Number.isNaN(p) ? NaN : Math.abs(p - x.fill) / x.risk));
    const tg = mult.map((m) => (Number.isNaN(m) ? NaN : x.fill + s * m * x.risk));
    if (x.gap) return null;
    const r = trade(M5, s, x.type, null, stop, M5[x.fi].t, Infinity, tg, x.cap, thr, { fi: x.fi, fill: x.fill });
    if (!r) return null; return r.R;
  };
  for (const g of sig) {
    const chn = CHAINS[g.ch];
    // the matched control signal for this chain signal
    const list = byKey[g.ch].get(g.s + '|' + monthOf(g.K)); let cg = null;
    if (list && list.length) { const z = list[Math.floor(rnd() * list.length)]; const ja = K.closedCount(F[chn.tfs[1]], z.at) - 1, ca = ja >= 0 ? ATR[chn.tfs[1]][ja] : 0;
      if (ca > 0) { const mult = Math.abs(g.entry50 - g.stop) / g.atr; cg = { ch: g.ch, s: g.s, K: z.at, ci: z.i, cz: z, entry50: (z.top + z.bot) / 2, atr: ca, mult, call: callAt(z.at) }; cnt.ctlDrawn++; } }
    else cnt.ctlNone++;
    for (let en = 0; en < 2; en++) {
      const x = runOne(g, en, g.stop);
      if (x) { cnt.trades++; const m = monthOf(x.t), w = x.t < SPLIT ? 0 : 1; const pR = flip(g, x);
        for (let k = 0; k < 3; k++) { if (Number.isNaN(x.R[k])) continue; for (let c = 0; c < 2; c++) { if (c === 1 && g.call !== g.s) continue; const ci = cellIndex(g.ch, en, k, c);
          add(real, ci, w, m, x.R[k], x.cr); if (pR && !Number.isNaN(pR[k])) add(plac, ci, w, m, pR[k], x.cr); } } }
      if (cg) {   // the control: same entry rule from its own zone, a stop at the matched ATR distance (from the 50 % line of its zone)
        const stopC = cg.entry50 - cg.s * cg.mult * cg.atr, y = runOne(cg, en, stopC);
        if (y) { const m = monthOf(y.t), w = y.t < SPLIT ? 0 : 1;
          for (let k = 0; k < 3; k++) { if (Number.isNaN(y.R[k])) continue; for (let c = 0; c < 2; c++) { if (c === 1 && cg.call !== cg.s) continue; add(ctl, cellIndex(g.ch, en, k, c), w, m, y.R[k], y.cr); } } }
      }
    }
  }
  const J = (A) => Object.fromEntries(Object.entries(A).map(([k, v]) => [k, Array.from(v, (z) => +z.toFixed(6))]));
  const perChain = CHAINS.map((_, ch) => sig.filter((g) => g.ch === ch).length);
  return { market, cost, assumed: ASSUMED.includes(market), first: M5.length ? M5[0].t : null, last: M5.length ? M5[M5.length - 1].t : null,
    ...cnt, perChain, real: J(real), ctl: J(ctl), plac: J(plac) };
}

// ---- cut test: the chain signals known by a date, computed on candles cut there, equal the full run's ----------------------
export function cutTest(market, cuts = ['2008-06-11', '2012-03-14', '2016-09-21', '2021-02-17', '2025-05-07']) {
  const M5 = K.load(market, '5m', { from: '2004-01-01', to: '2026-11-01' });
  const key = (g) => [g.ch, g.s, g.K, g.entry50.toFixed(8), g.stop.toFixed(8), g.call].join('|');
  const full = chainSignals(frames(M5)).sig; const out = [];
  for (const c of cuts) { const T = Date.parse(c + 'T00:00:00Z') / 1000;
    const cut = chainSignals(frames(M5.filter((b) => b.e <= T))).sig.filter((g) => g.K <= T).map(key);
    const want = full.filter((g) => g.K <= T).map(key); const A = new Set(cut), B = new Set(want);
    out.push({ market, cut: c, n: B.size, missing: [...B].filter((k) => !A.has(k)).length, extra: [...A].filter((k) => !B.has(k)).length }); }
  return out;
}

// ---- pooled statistics ----------------------------------------------------------------------------------------------------
export function pool(list, kind) { const A = newAcc(); for (const d of list) { const S = d[kind]; for (const k of Object.keys(A)) for (let i = 0; i < A[k].length; i++) A[k][i] += S[k][i]; } return A; }
export function cellStats(A, c) {
  const ms = A.ms.subarray(c * NM, (c + 1) * NM), msn = A.msNet.subarray(c * NM, (c + 1) * NM);
  const win = (w) => { const n = A.n[c * 2 + w], a = w ? DM : 0, b = w ? NM : DM;
    return { n, mean: n ? A.sum[c * 2 + w] / n : null, t: mstat(ms, a, b).t, meanNet: n ? A.net[c * 2 + w] / n : null, tNet: mstat(msn, a, b).t,
      win: n ? A.win[c * 2 + w] / n : null, months: b - a, sum: A.sum[c * 2 + w], sq: A.sq[c * 2 + w] }; };
  return { d: win(0), c: win(1) };
}
export function judge(data) {
  const R = pool(data, 'real'), C = pool(data, 'ctl'), P = pool(data, 'plac'); const rows = [];
  for (let c = 0; c < NC; c++) { const s = cellStats(R, c), cs = cellStats(C, c), ps = cellStats(P, c);
    rows.push({ cell: c, ...cellName(c), d: s.d, c: s.c, p: p1(s.c.t, s.c.months - 1), ctl: { d: cs.d, c: cs.c }, vs: { d: welch(s.d, cs.d), c: welch(s.c, cs.c) },
      plac: { d: ps.d, c: ps.c, p: p1(ps.c.t, ps.c.months - 1) } }); }
  const H = K.holm(rows.map((r) => r.p)), HP = K.holm(rows.map((r) => r.plac.p));
  const ok3 = (x, h) => x.d.n >= 300 && x.c.n >= 300 && x.d.mean > 0 && x.c.mean > 0 && x.d.t >= 2 && x.c.t >= 2 && h < 0.05;
  rows.forEach((r, i) => { r.holm = H[i]; r.plac.holm = HP[i];
    r.checks = { n: r.d.n >= 300 && r.c.n >= 300, disc: r.d.mean > 0 && r.d.t >= 2, conf: r.c.mean > 0 && r.c.t >= 2, holm: H[i] < 0.05,
      control: !!(r.vs.d != null && r.vs.c != null && r.vs.d >= 2 && r.vs.c >= 2) };
    r.pass = Object.values(r.checks).every(Boolean); r.plac.pass = ok3(r.plac, HP[i]); });
  return rows;
}

const f3 = (x) => (x == null ? 'n/a' : (x >= 0 ? '+' : '-') + Math.abs(x).toFixed(3)), f2 = (x) => (x == null ? 'n/a' : (x < 0 ? '-' : '') + Math.abs(x).toFixed(2)), N = (x) => Math.round(x).toLocaleString('en-US');
const TFN = { '1d': 'D1', '4h': 'H4', '1h': 'H1', '15m': 'M15', '5m': 'M5' };
export const cname = (r) => `${r.tfs.map((x) => TFN[x]).join('>')} ${r.entry} ${r.exit}${r.call === 'agree' ? ' +MSNR' : ''}`;
const slim = (w) => ({ n: w.n, mean: w.mean == null ? null : +w.mean.toFixed(6), t: +w.t.toFixed(6), meanNet: w.meanNet == null ? null : +w.meanNet.toFixed(6), tNet: +w.tNet.toFixed(2),
  win: w.win == null ? null : +w.win.toFixed(3) });

export function report(dir) {
  const data = MARKETS.map((m) => JSON.parse(fs.readFileSync(path.join(dir, m + '.json'), 'utf8')));
  const cut = MARKETS.flatMap((m) => { const f = path.join(dir, 'cut-' + m + '.json'); return fs.existsSync(f) ? JSON.parse(fs.readFileSync(f, 'utf8')) : []; });
  const rows = judge(data), pass = rows.filter((r) => r.pass), plPass = rows.filter((r) => r.plac.pass);
  const anyN = rows.some((r) => r.checks.n);
  const verdict = pass.length ? 'PASS' : anyN ? 'FAIL' : 'INCONCLUSIVE';
  const bestC = [...rows].sort((a, b) => b.c.t - a.c.t)[0], bestBoth = [...rows].sort((a, b) => Math.min(b.d.t, b.c.t) - Math.min(a.d.t, a.c.t))[0];
  const bestVs = [...rows].sort((a, b) => Math.min(b.vs.d ?? -9, b.vs.c ?? -9) - Math.min(a.vs.d ?? -9, a.vs.c ?? -9))[0];
  const perMarket = {}; for (const r of pass) perMarket[r.cell] = data.map((d) => { const s = cellStats(pool([d], 'real'), r.cell); return { market: d.market, d: slim(s.d), c: slim(s.c) }; });
  const headline = verdict === 'PASS'
    ? `${pass.length} of 36 cells pass: best ${cname(pass[0])}, ${f3(pass[0].c.mean)}R a trade before costs in 2015-26 (n ${N(pass[0].c.n)}, month t ${f2(pass[0].c.t)})`
    : `0 of 36 cells pass; the best confirmation cell, ${cname(bestC)}, made ${f3(bestC.c.mean)}R a trade before costs in 2015-26 (n ${N(bestC.c.n)}, month t ${f2(bestC.c.t)}; its control ${f3(bestC.ctl.c.mean)}R, Welch t ${f2(bestC.vs.c)})`;
  const RW = rows.map((r) => ({ cell: cname(r), chain: r.chain, entry: r.entry, exit: r.exit, call: r.call, disc: slim(r.d), conf: slim(r.c), holm: +r.holm.toFixed(4),
    control: { disc: slim(r.ctl.d), conf: slim(r.ctl.c) }, vsControl: { d: r.vs.d == null ? null : +r.vs.d.toFixed(2), c: r.vs.c == null ? null : +r.vs.c.toFixed(2) }, checks: r.checks, pass: r.pass,
    flipped: { disc: slim(r.plac.d), conf: slim(r.plac.c), holm: +r.plac.holm.toFixed(4), pass: r.plac.pass } }));
  const out = { study: 'grid7-wide-eg-chain', built: '2026-11-23', verdict, headline, basis: 'judged before costs on calendar-month sums (pre-registered); after costs beside',
    windows: { discovery: '2005-01-01 to 2014-12-31 (120 months)', confirmation: '2015-01-01 to 2026-10-31 (142 months)' }, markets: MARKETS,
    assumedCosts: ASSUMED, costs: Object.fromEntries(data.map((d) => [d.market, d.cost])),
    meta: data.map((d) => ({ market: d.market, first: new Date(d.first * 1000).toISOString().slice(0, 10), last: new Date(d.last * 1000).toISOString().slice(0, 10),
      signals: d.signals, perChain: d.perChain, trades: d.trades, nofill: d.nofill, dropped: d.dropped, small: d.small, noOpp: d.noOpp, gaps: d.gaps, ctlDrawn: d.ctlDrawn, ctlNone: d.ctlNone })),
    passed: pass.map(cname), flippedPassed: plPass.map(cname), bestConfirmation: cname(bestC), bestBothWindows: cname(bestBoth), bestVsControl: cname(bestVs),
    counts: { n: rows.filter((r) => r.checks.n).length, disc: rows.filter((r) => r.checks.disc).length, conf: rows.filter((r) => r.checks.conf).length,
      both: rows.filter((r) => r.checks.disc && r.checks.conf).length, holm: rows.filter((r) => r.checks.holm).length, control: rows.filter((r) => r.checks.control).length },
    cut, cells: RW, perMarket };
  fs.writeFileSync(path.join(HERE, 'result.json'), JSON.stringify(out, null, 1) + '\n');
  fs.writeFileSync(path.join(HERE, 'RESULT.md'), resultMd(out, rows, bestBoth, bestVs));
  return out;
}

function resultMd(o, rows, bestBoth, bestVs) {
  const nCut = o.cut.reduce((a, x) => a + x.n, 0), bad = o.cut.reduce((a, x) => a + x.missing + x.extra, 0);
  const L = [];
  L.push('# Wide grid: the three-timeframe engulf chain (result)', '', `**Verdict: ${o.verdict}. ${o.headline}.**`, '',
    'Run 23 Nov 2026 as pre-registered (`PREREGISTRATION.md`, committed and pushed alone first). Research only: nothing live',
    'changed, nothing is proposed. One run, no variants.', '',
    '## What was run', '',
    'Three chains [zone, engulf, confirmation] (D1>H4>H1, H4>H1>M15, H1>M15>M5) with `council/eg-methods.mjs` `zones` (3-candle',
    'span): an engulf zone on the first timeframe gives the side; price comes back into it and an engulf of that side completes on',
    'the second timeframe touching it; then one completes on the third timeframe touching the second, within 24 candles. Entry a',
    'market order at the next 5-minute open, or a limit at the middle of the third zone filled only when traded through by half the',
    'round trip (24 candles, cancelled by a close past the stop). Stop past the second zone\'s far side + 0.1 ATR of the second',
    'timeframe; exits 1R, 2R, or the nearest opposite zone of the first timeframe (only when 1R or more away). The same 18 cells',
    'with the Daily MSNR call agreeing: 36. Each cell against a control: a third-timeframe engulf of the same side and month with',
    'no higher zones, drawn at random, the same entry and a stop at the matched ATR distance. Ten markets pooled, OANDA mid',
    '5-minute candles; discovery = fills 2005-2014, confirmation = 2015 to October 2026.',
    `Costs after the fact only: the demo figures for gold and the four majors; **ASSUMED, not measured** for ${o.assumedCosts.join(', ')}.`, '',
    '## The bar, cell by cell', '',
    `- n >= 300 in both windows: ${o.counts.n} of 36.`,
    `- Mean R > 0 and month t >= 2 in discovery: ${o.counts.disc}; in confirmation: ${o.counts.conf}; both: ${o.counts.both}.`,
    `- Holm-adjusted p < 0.05 over the 36 confirmation tests: ${o.counts.holm}.`,
    `- Beats its control (Welch t >= 2 in both windows): ${o.counts.control} of 36.`,
    `- **All four: ${o.passed.length}${o.passed.length ? ' (' + o.passed.join('; ') + ')' : ''}.**`,
    `- Side-flipped check passing bars 1-3: ${o.flippedPassed.length}${o.flippedPassed.length ? ' (' + o.flippedPassed.join('; ') + ')' : ''}.`, '',
    `Best confirmation cell: ${o.bestConfirmation}. Best on the weaker of the two windows: ${o.bestBothWindows} (discovery`,
    `${f3(bestBoth.d.mean)}R, t ${f2(bestBoth.d.t)}; confirmation ${f3(bestBoth.c.mean)}R, t ${f2(bestBoth.c.t)}). Best against its control: ${o.bestVsControl}`,
    `(Welch t ${f2(bestVs.vs.d)} / ${f2(bestVs.vs.c)}).`, '',
    '## Every cell', '',
    'R a trade before costs (month-sum t), after costs beside; "ctl" = its control in confirmation; "vs ctl" = Welch t of the cell',
    'against its control (discovery / confirmation); Holm on the confirmation test; "flip" = the side-flipped check in confirmation.', '',
    '| Cell | n 05-14 | R 05-14 (t) | net 05-14 | n 15-26 | R 15-26 (t) | net 15-26 | ctl 15-26 (n) | vs ctl | Holm | flip 15-26 (t) | Pass |',
    '|---|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|---|');
  for (const r of rows) L.push(`| ${cname(r)} | ${N(r.d.n)} | ${f3(r.d.mean)} (${f2(r.d.t)}) | ${f3(r.d.meanNet)} | ${N(r.c.n)} | ${f3(r.c.mean)} (${f2(r.c.t)}) | ${f3(r.c.meanNet)} | ${f3(r.ctl.c.mean)} (${N(r.ctl.c.n)}) | ${f2(r.vs.d)} / ${f2(r.vs.c)} | ${r.holm.toFixed(3)} | ${f3(r.plac.c.mean)} (${f2(r.plac.c.t)}) | ${r.pass ? 'yes' : 'no'} |`);
  L.push('');
  if (o.passed.length) { L.push('## Per market, passing cells', ''); for (const [c, list] of Object.entries(o.perMarket)) { L.push(`### ${cname(rows[c])}`, '', '| Market | n 05-14 | R (t) | n 15-26 | R (t) | net 15-26 |', '|---|---:|---:|---:|---:|---:|');
    for (const x of list) L.push(`| ${x.market} | ${N(x.d.n)} | ${f3(x.d.mean)} (${f2(x.d.t)}) | ${N(x.c.n)} | ${f3(x.c.mean)} (${f2(x.c.t)}) | ${f3(x.c.meanNet)} |`); L.push(''); } }
  L.push('## Checks', '',
    `- Cut test: ${o.cut.length} cuts on ${[...new Set(o.cut.map((x) => x.market))].join(', ')}: ${N(nCut)} chain signals known by the cut dates, ${bad} missing or extra when the candles are cut there.`,
    '- Every trade has its stop on the losing side of the fill (the run throws otherwise); a market fill at or past the stop and a trade whose risk is under the round-trip cost are no trades; a limit whose fill candle opens past the stop is booked at -1R.',
    '- Exclusions: the data-quality audit\'s bad intervals (`combo-grid-2` `exclusions`).', '',
    '| Market | candles from | signals (A / B / C) | orders filled | limits unfilled | dropped | risk under cost | no opp target | controls drawn / none |', '|---|---|---:|---:|---:|---:|---:|---:|---:|');
  for (const m of o.meta) L.push(`| ${m.market} | ${m.first} | ${m.perChain.join(' / ')} | ${N(m.trades)} | ${N(m.nofill)} | ${m.dropped} | ${N(m.small)} | ${N(m.noOpp)} | ${N(m.ctlDrawn)} / ${N(m.ctlNone)} |`);
  L.push('', '## What it means', '');
  if (o.verdict === 'PASS') L.push('A passing cell is a candidate for its own forward record and an owner decision, nothing more: it is not adopted, and never called an edge before a forward record.');
  else L.push('Trades taken after the full three-timeframe engulf chain, with a market entry or a trade-through limit, do not clear the',
    'pre-registered bar on ten markets over 22 years, and the chain does not pick better trades than a matched engulf with no',
    'higher zones in a way that makes money (see below). Do not re-test variants of these 36 cells on these years. Nothing live',
    'changed; no rule is proposed.');
  const cw = rows.filter((r) => r.checks.control);
  if (cw.length) L.push('', `**Beating the control is not a profit.** ${cw.length} cells beat their control in both windows (${cw.map(cname).join('; ')}).`,
    'In each the chain trades themselves sit at about zero before costs (none has a month t of 2 in either window) while the',
    'matched third-timeframe engulfs with no higher zones LOSE before costs; so the chain avoids part of a loss a plain engulf',
    `entry carries, nothing more. After costs every one of them loses (confirmation: ${cw.map((r) => f3(r.c.meanNet) + 'R').join(', ')}).`);
  const pp = rows.filter((r) => r.plac.pass);
  if (pp.length) { const big = [...pp].sort((a, b) => b.plac.c.n - a.plac.c.n)[0];
    L.push('', `**The side-flipped check.** ${pp.length} flipped cells clear bars 1-3 (${pp.map(cname).join('; ')}). With fixed R targets the`,
      'flipped trade mirrors the real one, so this says only that the real trades lose a few hundredths of an R before costs. It is',
      `not a fade rule: after costs the flipped trades lose heavily (${cname(big)} flipped: ${f3(big.plac.c.mean)}R before costs, t ${f2(big.plac.c.t)};`,
      `${f3(big.plac.c.meanNet)}R after costs, t ${f2(big.plac.c.tNet)}, n ${N(big.plac.c.n)} in 2015-26). A check is not a rule.`); }
  const lim = rows[cellIndex(2, 1, 0, 0)], mkt = rows[cellIndex(2, 0, 0, 0)];
  L.push('', `The trade-through limit at the middle of the third zone does worse than the market entry (${cname(lim)}: ${f3(lim.c.mean)}R a trade before`,
    `costs in 2015-26 against ${f3(mkt.c.mean)}R at market): once a touch no longer counts as a fill, the orders that fill are the ones price runs through.`);
  L.push('');
  return L.join('\n');
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const [cmd, a, b] = process.argv.slice(2);
  if (cmd === 'market') { fs.mkdirSync(b, { recursive: true }); const t0 = Date.now(); const r = runMarket(a);
    fs.writeFileSync(path.join(b, a + '.json'), JSON.stringify(r)); console.log(a, 'signals', r.signals, r.perChain.join('/'), 'trades', r.trades, ((Date.now() - t0) / 1000).toFixed(0) + 's'); }
  else if (cmd === 'cut') { fs.mkdirSync(b, { recursive: true }); const r = cutTest(a); fs.writeFileSync(path.join(b, 'cut-' + a + '.json'), JSON.stringify(r)); console.log(JSON.stringify(r)); }
  else if (cmd === 'report') { const o = report(a); console.log(o.verdict, o.headline); }
  else console.log('usage: run.mjs market <m> <dir> | cut <m> <dir> | report <dir>');
}
