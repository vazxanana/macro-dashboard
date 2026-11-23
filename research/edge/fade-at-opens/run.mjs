// research/edge/fade-at-opens/run.mjs - opening prices as levels (PREREGISTRATION.md, 23 Nov 2026): the New York midnight
// open, the 08:30 New York price, the Daily (UTC), Weekly and Monthly opens; a close across the open traded WITH it or FADED,
// and a failed cross traded back; 57 cells, ten markets, discovery 2005-14, confirmation 2015 to Oct 2026, judged before costs
// on month sums and against the plain grid7-wide-fade rule at matched times. Research only: nothing live imports it.
//   EDGE_DATA=<cache> node research/edge/fade-at-opens/run.mjs market <m> <outDir>
//   EDGE_DATA=<cache> node research/edge/fade-at-opens/run.mjs cut <m> <outDir>
//   node research/edge/fade-at-opens/run.mjs report <outDir>
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import * as K from '../_lib/edgekit.mjs';
import { frames } from '../combo-grid-3/run.mjs';
import { COSTS, exclusions } from '../combo-grid-2/run.mjs';
import { atr14, startIdx } from '../dom-trade-through/run.mjs';
import { MARKETS, ASSUMED, FROM, SPLIT, TO, NM, DM, monthOf, mstat, p1, welch } from '../grid7-wide-core/run.mjs';
import { breaks, exits, sessionOf } from '../grid7-wide-fade/run.mjs';

export { MARKETS, ASSUMED };
const HERE = path.dirname(fileURLToPath(import.meta.url));
export const KINDS = ['nymid', 'ny0830', 'dopen', 'wopen', 'mopen'];
export const LT = [['nymid', '15m'], ['ny0830', '15m'], ['dopen', '15m'], ['wopen', '15m'], ['wopen', '1h'], ['mopen', '15m'], ['mopen', '1h']];
export const LTN = LT.map(([k, t]) => `${k} ${t === '15m' ? 'm15' : 'h1'}`);
export const POOL_B = [0, 1, 2, 3, 5];                         // the five M15 level-timeframes (one per level)
export const EVS = ['with', 'fade', 'failed'], EXITS = ['1R', '2R'], CTXS = ['london', 'ny', 'other', 'first', 'later'];
export const FAIL_ATR = 0.2, FAIL_WIN = 3, ATRK = 0.1, MATCH = 2 * 3600, CAP = { '15m': 86400, '1h': 2 * 86400 };
export const NA = 42, NCELL = 57;
export const cellA = (lt, ev, x) => (lt * 3 + ev) * 2 + x;
export const cellB = (ev, cx) => NA + ev * 5 + cx;
export function cellName(i) {
  if (i < NA) { const x = i % 2, r = (i - x) / 2, ev = r % 3, lt = (r - ev) / 3;
    return { lt: LTN[lt], tf: LT[lt][1], event: EVS[ev], exit: EXITS[x], context: 'all', name: `${LTN[lt]} ${EVS[ev]} ${EXITS[x]}` }; }
  const j = i - NA, cx = j % 5, ev = (j - cx) / 5;
  return { lt: 'm15all', tf: '15m', event: EVS[ev], exit: '1R', context: CTXS[cx], name: `m15all ${EVS[ev]} 1R ${CTXS[cx]}` };
}

// ---- the levels: price = the open of the 5-minute candle starting at the level time -------------------------------------
const SAT0 = 2 * 86400;                                           // 1970-01-03, a Saturday 00:00 UTC
export function levels(M5) {
  const L = Object.fromEntries(KINDS.map((k) => [k, []]));
  let wk = null, mo = null;
  for (const b of M5) {
    const off = K.nyOffsetH(b.t), ny = b.t - off * 3600, nyMin = ((ny % 86400) + 86400) % 86400 / 60, nyWd = new Date(ny * 1000).getUTCDay();
    if (nyWd >= 1 && nyWd <= 5) { if (nyMin === 0) L.nymid.push({ t: b.t, px: b.o }); else if (nyMin === 510) L.ny0830.push({ t: b.t, px: b.o }); }
    const uWd = new Date(b.t * 1000).getUTCDay();
    if (b.t % 86400 === 0 && uWd >= 1 && uWd <= 5) L.dopen.push({ t: b.t, px: b.o });
    const w = Math.floor((b.t - SAT0) / 604800); if (w !== wk) { wk = w; L.wopen.push({ t: b.t, px: b.o }); }
    const d = new Date(b.t * 1000), m = d.getUTCFullYear() * 12 + d.getUTCMonth(); if (m !== mo) { mo = m; L.mopen.push({ t: b.t, px: b.o }); }
  }
  for (const k of KINDS) L[k].forEach((x, i, A) => { x.end = i + 1 < A.length ? A[i + 1].t : Infinity; });
  return L;
}

// ---- the events of one level list on T (closed candles only) --------------------------------------------------------------
// [{ ev: 'cross' | 'failed', k (event candle), ts (its close), s0 (the cross side d, or the side r returned to), stop (fade /
//    failed stop price), a (ATR of T at the event candle), ord (0 = first of its kind for this level) }]
export function levelEvents(T, atr, lv) {
  const out = [];
  for (const L of lv) {
    let j = startIdx(T, L.t), side = 0, nc = 0, nf = 0, fs = -1; const px = L.px;
    for (; j < T.length && T[j].e <= L.end; j++) {
      const b = T[j], before = side, sg = Math.sign(b.c - px);
      // (c) a failed cross starting at j (side established before j)
      if (before !== 0 && j >= fs) { const a = atr[j], r = before;
        if (a > 0 && (r < 0 ? b.h >= px + FAIL_ATR * a : b.l <= px - FAIL_ATR * a)) {
          let ext = r < 0 ? -Infinity : Infinity, k = -1;
          for (let q = j; q < j + FAIL_WIN && q < T.length && T[q].e <= L.end; q++) {
            ext = r < 0 ? Math.max(ext, T[q].h) : Math.min(ext, T[q].l);
            if (Math.sign(T[q].c - px) === r) { k = q; break; } }
          if (k >= 0) { const ak = atr[k]; if (ak > 0) out.push({ ev: 'failed', k, ts: T[k].e, s0: r, stop: ext - r * ATRK * ak, a: ak, ord: nf }); nf++; fs = k + 1; }
          else fs = j + FAIL_WIN;
        } }
      // (a) / (b) a cross
      if (sg !== 0) { if (side !== 0 && sg !== side) { const a = atr[j];
          if (a > 0) out.push({ ev: 'cross', k: j, ts: b.e, s0: sg, stop: (sg > 0 ? b.h : b.l) + sg * ATRK * a, a, ord: nc }); nc++; }
        side = sg; }
    }
  }
  return out;
}

export function signals(F, M5) {
  const L = levels(M5), out = [], atrs = { '15m': atr14(F['15m']), '1h': atr14(F['1h']) };
  LT.forEach(([kind, tf], lt) => { for (const e of levelEvents(F[tf], atrs[tf], L[kind])) out.push({ lt, tf, ...e }); });
  return out;
}

// ---- the control: the plain grid7-wide-fade rule (every break, faded, "ext" stop) on T, with 1R and 2R ----------------------
function controls(F, M5, tf, cost, X) {
  const T = F[tf], atr = atr14(T), ts = [], R1 = [], R2 = [];
  for (const e of breaks(T)) { const a = atr[e.i]; if (!(a > 0)) continue; const b = T[e.i];
    const fi = startIdx(M5, b.e); if (fi >= M5.length) continue; const t = M5[fi].t; if (t < FROM - 86400 * 2 || t >= TO + 86400 * 2) continue;
    if (X.length && inBad(X, t)) continue;
    const s = -e.dir, fill = M5[fi].o, stop = (e.dir > 0 ? b.h : b.l) + e.dir * ATRK * a, risk = s * (fill - stop);
    if (!(risk > 0) || risk < cost) continue;
    const r = exits(M5, s, fi, stop, [fill + s * risk, fill + 2 * s * risk], CAP[tf]); if (!r) continue;
    ts.push(t); R1.push(r.R[0]); R2.push(r.R[1]); }
  return { ts, R: [R1, R2] };
}
export function nearest(ts, t, win = MATCH) {          // index of the nearest time within win (earlier wins a tie), or -1
  let lo = 0, hi = ts.length; while (lo < hi) { const m = (lo + hi) >> 1; if (ts[m] < t) lo = m + 1; else hi = m; }
  let best = -1, bd = Infinity;
  for (const i of [lo - 1, lo]) if (i >= 0 && i < ts.length) { const d = Math.abs(ts[i] - t); if (d <= win && d < bd) { bd = d; best = i; } }
  return best;
}

const inBad = (X, t) => { let lo = 0, hi = X.length; while (lo < hi) { const m = (lo + hi) >> 1; if (X[m][0] <= t) lo = m + 1; else hi = m; } return lo > 0 && t <= X[lo - 1][1]; };
const F64 = (n) => new Float64Array(n);
function newAcc() { return { ms: F64(NCELL * NM), msNet: F64(NCELL * NM), n: F64(NCELL * 2), sum: F64(NCELL * 2), sq: F64(NCELL * 2), net: F64(NCELL * 2),
  win: F64(NCELL * 2), cr: F64(NCELL * 2), cn: F64(NCELL * 2), csum: F64(NCELL * 2), csq: F64(NCELL * 2) }; }
function add(A, c, w, m, R, cr, ctl) { A.ms[c * NM + m] += R; A.msNet[c * NM + m] += R - cr; const k = c * 2 + w; A.n[k]++; A.sum[k] += R; A.sq[k] += R * R;
  A.net[k] += R - cr; A.cr[k] += cr; if (R > 0) A.win[k]++; if (ctl != null) { A.cn[k]++; A.csum[k] += ctl; A.csq[k] += ctl * ctl; } }

export function runMarket(market) {
  const M5 = K.load(market, '5m', { from: '2004-01-01', to: '2026-11-01' }); const F = frames(M5);
  const sigs = signals(F, M5), cost = COSTS[market], X = exclusions(market);
  const CT = { '15m': controls(F, M5, '15m', cost, X), '1h': controls(F, M5, '1h', cost, X) };
  const real = newAcc(), flip = newAcc(); let dropped = 0, bad = 0, small = 0, sims = 0, open = 0, noCtl = 0;
  for (const g of sigs) {
    const fi = startIdx(M5, g.ts); if (fi >= M5.length) continue; const t = M5[fi].t; if (t < FROM || t >= TO) continue;
    if (X.length && inBad(X, t)) { dropped++; continue; }
    const fill = M5[fi].o, m = monthOf(t), w = t < SPLIT ? 0 : 1, se = sessionOf(t);
    const evs = g.ev === 'cross' ? [0, 1] : [2];
    for (const ev of evs) {
      const s = ev === 0 ? g.s0 : ev === 1 ? -g.s0 : g.s0;
      const stop = ev === 0 ? fill - s * g.a : g.stop, risk = s * (fill - stop);
      if (!(risk > 0)) { bad++; continue; }
      if (risk < cost) { small++; continue; }
      if (!(s * (fill - stop) > 0)) throw new Error('stop on the wrong side');
      const r = exits(M5, s, fi, stop, [fill + s * risk, fill + 2 * s * risk], CAP[g.tf]);
      const p = exits(M5, -s, fi, fill + s * risk, [fill - s * risk, fill - 2 * s * risk], CAP[g.tf]); sims++;
      if (!r || !p) { open++; continue; }
      const cr = cost / risk, C = CT[g.tf], ci = nearest(C.ts, t); if (ci < 0) noCtl++;
      for (let x = 0; x < 2; x++) { const c = cellA(g.lt, ev, x), ctl = ci < 0 ? null : C.R[x][ci];
        add(real, c, w, m, r.R[x], cr, ctl); add(flip, c, w, m, p.R[x], cr, ctl); }
      if (POOL_B.includes(g.lt)) { const ctl = ci < 0 ? null : C.R[0][ci];
        for (const cx of [se, g.ord === 0 ? 3 : 4]) { const c = cellB(ev, cx); add(real, c, w, m, r.R[0], cr, ctl); add(flip, c, w, m, p.R[0], cr, ctl); } }
    }
  }
  const J = (A) => Object.fromEntries(Object.entries(A).map(([k, v]) => [k, Array.from(v, (z) => +z.toFixed(6))]));
  return { market, cost, assumed: ASSUMED.includes(market), first: M5.length ? M5[0].t : null, last: M5.length ? M5[M5.length - 1].t : null,
    signals: sigs.length, controls: { '15m': CT['15m'].ts.length, '1h': CT['1h'].ts.length }, sims, dropped, bad, small, open, noCtl, real: J(real), flip: J(flip) };
}

// ---- cut test: the events known by a date, computed on candles cut there, equal the full run's ---------------------------
export function cutTest(market, cuts = ['2008-06-11', '2012-03-14', '2016-09-21', '2021-02-17', '2025-05-07']) {
  const M5 = K.load(market, '5m', { from: '2004-01-01', to: '2026-11-01' });
  const key = (g) => [g.lt, g.ev, g.ts, g.s0, g.stop, g.a.toFixed(10), g.ord].join('|');
  const full = signals(frames(M5), M5); const out = [];
  for (const c of cuts) { const T = Date.parse(c + 'T00:00:00Z') / 1000; const M = M5.filter((b) => b.e <= T);
    const cut = signals(frames(M), M).filter((g) => g.ts <= T).map(key);
    const want = full.filter((g) => g.ts <= T).map(key); const A = new Set(cut), B = new Set(want);
    out.push({ market, cut: c, n: B.size, missing: [...B].filter((k) => !A.has(k)).length, extra: [...A].filter((k) => !B.has(k)).length }); }
  return out;
}

// ---- pooled statistics ----------------------------------------------------------------------------------------------------
export function pool(list, kind) { const A = newAcc(); for (const d of list) { const S = d[kind]; for (const k of Object.keys(A)) for (let i = 0; i < A[k].length; i++) A[k][i] += S[k][i]; } return A; }
export function cellStats(A, c) {
  const ms = A.ms.subarray(c * NM, (c + 1) * NM), msn = A.msNet.subarray(c * NM, (c + 1) * NM);
  const win = (w) => { const k = c * 2 + w, n = A.n[k], a = w ? DM : 0, b = w ? NM : DM;
    const ctl = A.cn[k] ? A.csum[k] / A.cn[k] : null, wt = welch({ n, sum: A.sum[k], sq: A.sq[k] }, { n: A.cn[k], sum: A.csum[k], sq: A.csq[k] });
    return { n, mean: n ? A.sum[k] / n : null, t: mstat(ms, a, b).t, meanNet: n ? A.net[k] / n : null, tNet: mstat(msn, a, b).t,
      win: n ? A.win[k] / n : null, costR: n ? A.cr[k] / n : null, months: b - a, ctlN: A.cn[k], ctl, diff: ctl == null || !n ? null : A.sum[k] / n - ctl, welch: wt }; };
  return { d: win(0), c: win(1) };
}
export const bars14 = (x, h) => x.d.n >= 300 && x.c.n >= 300 && x.d.mean > 0 && x.c.mean > 0 && x.d.t >= 2 && x.c.t >= 2 && h < 0.05;
export const beats = (x) => x.d.diff > 0 && x.c.diff > 0 && x.d.welch >= 2 && x.c.welch >= 2;
export function judge(data) {
  const R = pool(data, 'real'), P = pool(data, 'flip'); const rows = [];
  for (let c = 0; c < NCELL; c++) { const s = cellStats(R, c), f = cellStats(P, c);
    rows.push({ cell: c, ...cellName(c), d: s.d, c: s.c, p: p1(s.c.t, s.c.months - 1), flip: { d: f.d, c: f.c, p: p1(f.c.t, f.c.months - 1) } }); }
  const H = K.holm(rows.map((r) => r.p)), HF = K.holm(rows.map((r) => r.flip.p));
  rows.forEach((r, i) => { r.holm = H[i]; r.flip.holm = HF[i];
    r.checks = { n: r.d.n >= 300 && r.c.n >= 300, disc: r.d.mean > 0 && r.d.t >= 2, conf: r.c.mean > 0 && r.c.t >= 2, holm: H[i] < 0.05, control: beats(r) };
    r.pass = bars14(r, H[i]) && beats(r); r.flip.pass14 = bars14(r.flip, HF[i]); });
  return rows;
}

const f3 = (x) => (x == null ? 'n/a' : (x >= 0 ? '+' : '-') + Math.abs(x).toFixed(3)), f2 = (x) => (x == null ? 'n/a' : x.toFixed(2)), N = (x) => Math.round(x).toLocaleString('en-US');
const slim = (w) => ({ n: w.n, mean: w.mean == null ? null : +w.mean.toFixed(6), t: +w.t.toFixed(6), meanNet: w.meanNet == null ? null : +w.meanNet.toFixed(6),
  tNet: +w.tNet.toFixed(2), win: w.win == null ? null : +w.win.toFixed(3), costR: w.costR == null ? null : +w.costR.toFixed(4),
  ctlN: w.ctlN, ctl: w.ctl == null ? null : +w.ctl.toFixed(6), diff: w.diff == null ? null : +w.diff.toFixed(6), welch: w.welch == null ? null : +w.welch.toFixed(4) });

export function report(dir) {
  const data = MARKETS.filter((m) => fs.existsSync(path.join(dir, m + '.json'))).map((m) => JSON.parse(fs.readFileSync(path.join(dir, m + '.json'), 'utf8')));
  const cut = MARKETS.flatMap((m) => { const f = path.join(dir, 'cut-' + m + '.json'); return fs.existsSync(f) ? JSON.parse(fs.readFileSync(f, 'utf8')) : []; });
  const rows = judge(data), pass = rows.filter((r) => r.pass);
  const verdict = data.length < 8 ? 'INCONCLUSIVE' : pass.length ? 'PASS' : 'FAIL';
  const best = [...rows].sort((a, b) => b.c.t - a.c.t)[0], bestPass = [...pass].sort((a, b) => b.c.t - a.c.t)[0], b = bestPass || best;
  const perMarket = {}; for (const r of pass) perMarket[r.name] = data.map((d) => { const s = cellStats(pool([d], 'real'), r.cell); return { market: d.market, assumed: d.assumed, d: slim(s.d), c: slim(s.c) }; });
  const near = rows.filter((r) => r.checks.n && r.checks.disc && r.checks.conf && r.checks.holm);
  const headline = verdict === 'PASS'
    ? `${pass.length} of 57 cells pass before costs; best ${b.name}, ${f3(b.c.mean)}R a trade in 2015-26 (n ${N(b.c.n)}, month t ${f2(b.c.t)}; discovery ${f3(b.d.mean)}R, t ${f2(b.d.t)}), control difference Welch t ${f2(b.d.welch)} / ${f2(b.c.welch)}, ${f3(b.c.meanNet)}R after costs`
    : `0 of 57 cells pass; the best confirmation cell, ${b.name}, made ${f3(b.c.mean)}R a trade before costs in 2015-26 (n ${N(b.c.n)}, month t ${f2(b.c.t)}; discovery ${f3(b.d.mean)}R, t ${f2(b.d.t)}) against ${f3(b.c.ctl)}R for the plain fade rule at matched times (Welch t ${f2(b.c.welch)})`;
  const RW = rows.map((r) => ({ cell: r.name, levelTf: r.lt, tf: r.tf, event: r.event, exit: r.exit, context: r.context, disc: slim(r.d), conf: slim(r.c),
    holm: +r.holm.toFixed(4), checks: r.checks, pass: r.pass, flipped: { disc: slim(r.flip.d), conf: slim(r.flip.c), holm: +r.flip.holm.toFixed(4), pass14: r.flip.pass14 } }));
  const out = { study: 'fade-at-opens', built: '2026-11-23', verdict, headline,
    basis: 'judged before costs on calendar-month sums and against the plain grid7-wide-fade rule at matched times (pre-registered); after costs beside',
    windows: { discovery: '2005-01-01 to 2014-12-31 (120 months)', confirmation: '2015-01-01 to 2026-10-31 (142 months)' }, markets: data.map((d) => d.market),
    assumedCosts: ASSUMED, costs: Object.fromEntries(data.map((d) => [d.market, d.cost])),
    meta: data.map((d) => ({ market: d.market, first: new Date(d.first * 1000).toISOString().slice(0, 10), last: new Date(d.last * 1000).toISOString().slice(0, 10),
      signals: d.signals, controls: d.controls, sims: d.sims, dropped: d.dropped, bad: d.bad, small: d.small, open: d.open, noControl: d.noCtl })),
    passed: pass.map((r) => r.name), passBars1to4: near.map((r) => r.name), flippedPass1to4: rows.filter((r) => r.flip.pass14).map((r) => r.name),
    bestConfirmation: best.name, passedNetPositive: pass.filter((r) => r.d.meanNet > 0 && r.c.meanNet > 0).map((r) => r.name), cut, cells: RW, perMarket };
  fs.writeFileSync(path.join(HERE, 'result.json'), JSON.stringify(out, null, 1) + '\n');
  fs.writeFileSync(path.join(HERE, 'RESULT.md'), resultMd(out, rows));
  return out;
}

function resultMd(o, rows) {
  const nCut = o.cut.reduce((a, x) => a + x.n, 0), badCut = o.cut.reduce((a, x) => a + x.missing + x.extra, 0), cnt = (f) => rows.filter(f).length, L = [];
  L.push('# Opening prices as levels: cross, fade, failed cross (result)', '', `**Verdict: ${o.verdict}. ${o.headline}.**`, '',
    'Run 23 Nov 2026 as pre-registered (`PREREGISTRATION.md`, committed and pushed alone first). Research only: nothing live',
    'changed, nothing is proposed. One run, no variants.', '',
    '## What was run', '',
    'Five opening prices as levels (the open of the 5-minute candle at 00:00 New York, at 08:30 New York, at 00:00 UTC, the',
    'first candle of the week and of the month). On M15 (and H1 for the Weekly and Monthly opens): a close across the level',
    'traded WITH it (1 ATR stop) or FADED (stop past the cross candle + 0.1 ATR), and a failed cross (through the level by 0.2 ATR,',
    'a close back within 3 candles) traded back (stop past the extreme + 0.1 ATR); market entry at the next 5-minute open; 1R or',
    '2R. 42 cells by level and timeframe, 15 by session and first / later cross (M15 levels pooled, 1R): 57. Ten markets pooled,',
    'OANDA mid 5-minute candles; discovery = fills 2005-2014, confirmation = 2015 to October 2026. Judged before costs on month',
    'sums, Holm over the 57 confirmation tests, and against the plain `grid7-wide-fade` rule (every structure break on the same',
    'timeframe, faded, same exit) at the nearest fill within 2 hours (trade-level Welch t >= 2 in both windows).',
    `Costs beside: the demo figures for gold and the four majors; **ASSUMED, not measured** for ${o.assumedCosts.join(', ')}.`, '',
    '## The bar, cell by cell', '',
    `- n >= 300 in both windows: ${cnt((r) => r.checks.n)} of 57.`,
    `- Mean R > 0 and month t >= 2 in discovery: ${cnt((r) => r.checks.disc)}; in confirmation: ${cnt((r) => r.checks.conf)}; both: ${cnt((r) => r.checks.disc && r.checks.conf)}.`,
    `- Holm-adjusted p < 0.05: ${cnt((r) => r.checks.holm)}. Bars 1-4 together: ${o.passBars1to4.length}${o.passBars1to4.length ? ' (' + o.passBars1to4.join('; ') + ')' : ''}.`,
    `- Beats the plain fade rule at matched times in both windows (Welch t >= 2): ${cnt((r) => r.checks.control)}.`,
    `- **All five: ${o.passed.length}${o.passed.length ? ' (' + o.passed.join('; ') + ')' : ''}.**`,
    `- Of those, positive after costs in both windows: ${o.passedNetPositive.length}${o.passedNetPositive.length ? ' (' + o.passedNetPositive.join('; ') + ')' : ''}.`,
    `- Side flipped (same fills, traded the other way) passing bars 1-4: ${o.flippedPass1to4.length}${o.flippedPass1to4.length ? ' (' + o.flippedPass1to4.join('; ') + ')' : ''}.`, '',
    '## Every cell', '',
    'R a trade before costs (month-sum t), after costs ("net") beside; "ctl" = the matched plain-fade trades\' mean R, "W" = the',
    'Welch t of the cell minus its control; "cost R" = mean round-trip cost / risk in 2015-26; "flip" = the same fills traded the',
    'other way, before costs in 2015-26.', '',
    '| Cell | n 05-14 | R 05-14 (t) | net | ctl (W) 05-14 | n 15-26 | R 15-26 (t) | net | ctl (W) 15-26 | cost R | Holm | flip 15-26 (t) | Pass |',
    '|---|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|---|');
  for (const r of rows) L.push(`| ${r.name} | ${N(r.d.n)} | ${f3(r.d.mean)} (${f2(r.d.t)}) | ${f3(r.d.meanNet)} | ${f3(r.d.ctl)} (${f2(r.d.welch)}) | ${N(r.c.n)} | ${f3(r.c.mean)} (${f2(r.c.t)}) | ${f3(r.c.meanNet)} | ${f3(r.c.ctl)} (${f2(r.c.welch)}) | ${r.c.costR == null ? 'n/a' : r.c.costR.toFixed(3)} | ${r.holm.toFixed(3)} | ${f3(r.flip.c.mean)} (${f2(r.flip.c.t)}) | ${r.pass ? 'yes' : 'no'} |`);
  L.push('');
  if (o.passed.length) { L.push('## Per market, passing cells', '', 'Before costs (after costs in brackets); * = cost ASSUMED.', '');
    for (const [name, list] of Object.entries(o.perMarket)) { L.push(`### ${name}`, '', '| Market | n 05-14 | R (t) [net] | n 15-26 | R (t) [net] | ctl 15-26 | cost R 15-26 |', '|---|---:|---:|---:|---:|---:|---:|');
      for (const x of list) L.push(`| ${x.market}${x.assumed ? '*' : ''} | ${N(x.d.n)} | ${f3(x.d.mean)} (${f2(x.d.t)}) [${f3(x.d.meanNet)}] | ${N(x.c.n)} | ${f3(x.c.mean)} (${f2(x.c.t)}) [${f3(x.c.meanNet)}] | ${f3(x.c.ctl)} | ${x.c.costR == null ? 'n/a' : x.c.costR.toFixed(3)} |`);
      L.push(''); } }
  L.push('## Checks', '',
    `- Cut test: ${o.cut.length} cuts on ${[...new Set(o.cut.map((x) => x.market))].join(', ') || 'none'}: ${N(nCut)} events known by the cut dates, ${badCut} missing or extra when the candles are cut there.`,
    '- Every trade has its stop on the losing side of the fill (the run throws otherwise); a fill at or past the stop and a risk under the round-trip cost are no trades (same for the side-flipped check and the control).',
    '- Exclusions: the data-quality audit\'s bad intervals (`combo-grid-2` `exclusions`). The control is the plain fade rule with the same filters; a cell trade with no control fill within 2 hours counts in the cell but not in the control comparison.', '',
    '| Market | candles from | events | control M15 / H1 | simulated | dropped (bad data) | past the stop | risk under cost | unresolved | no control |', '|---|---|---:|---:|---:|---:|---:|---:|---:|---:|');
  for (const m of o.meta) L.push(`| ${m.market} | ${m.first} | ${N(m.signals)} | ${N(m.controls['15m'])} / ${N(m.controls['1h'])} | ${N(m.sims)} | ${m.dropped} | ${N(m.bad)} | ${N(m.small)} | ${m.open} | ${N(m.noControl)} |`);
  L.push('', '## What it means', '');
  if (o.verdict === 'PASS') L.push(`${o.passed.length} cell(s) clear the pre-registered bar before costs in both decades and beat the plain fade rule at the same times. ${o.passedNetPositive.length ? o.passedNetPositive.length + ' stay positive after costs in both windows.' : 'None stays positive after costs in both windows: the bid / ask takes more than the tilt.'}`,
    'A before-cost tilt, not an edge; nothing is adopted; a forward record or a live change needs the owner. One run, no variants.');
  else L.push('No cell clears the bar. Opening prices as levels do not pick trades that beat the plain fade-the-break rule at the same',
    'times in both decades, before costs. Do not re-test variants of these 57 cells on these years. Nothing live changed; no rule is proposed.');
  const b4 = rows.filter((r) => o.passBars1to4.includes(r.name));
  if (b4.length) L.push('', `**The near misses.** ${b4.length} cell(s) clear bars 1-4 (${b4.map((r) => `${r.name} ${f3(r.c.mean)}R, t ${f2(r.c.t)}`).join('; ')}),`,
    `but each does worse than or no better than the plain fade rule at the same times (2015-26 control ${b4.map((r) => f3(r.c.ctl)).join(' / ')}R;`,
    `Welch t ${b4.map((r) => f2(r.c.welch)).join(' / ')}): fading a cross of an opening price is the general short-term pull-back`,
    '`grid7-wide-fade` already measured, and the opening price adds nothing to it. After costs every one loses (about -0.35R a trade:',
    'the stop past the cross candle is small, so the round trip is about 0.4R).');
  if (o.flippedPass1to4.length) L.push('', `**Side flipped.** ${o.flippedPass1to4.length} flipped cells clear bars 1-4 (the "with" cells traded against the cross with a`,
    '1 ATR stop): +0.01 to +0.02R a trade before costs, about a tenth of their round trip. Not pre-registered as cells, not a',
    'finding: the same pull-back tilt again. The fade-at-1R cells (and their flips) are depressed by the pre-registered rule that',
    'books a 5-minute candle holding both stop and target as the stop, which hits small stops hardest.');
  L.push('');
  return L.join('\n');
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const [cmd, a, b] = process.argv.slice(2);
  if (cmd === 'market') { fs.mkdirSync(b, { recursive: true }); const t0 = Date.now(); const r = runMarket(a);
    fs.writeFileSync(path.join(b, a + '.json'), JSON.stringify(r)); console.log(a, 'events', r.signals, 'sims', r.sims, ((Date.now() - t0) / 1000).toFixed(0) + 's'); }
  else if (cmd === 'cut') { fs.mkdirSync(b, { recursive: true }); const r = cutTest(a); fs.writeFileSync(path.join(b, 'cut-' + a + '.json'), JSON.stringify(r)); console.log(JSON.stringify(r)); }
  else if (cmd === 'report') { const o = report(a); console.log(o.verdict, o.headline); }
  else console.log('usage: run.mjs market <m> <dir> | cut <m> <dir> | report <dir>');
}
