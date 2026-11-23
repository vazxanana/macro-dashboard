// research/edge/grid7-box-fade/run.mjs - the box grid of PREREGISTRATION.md (23 Nov 2026): the swing box (edgekit boxesHL,
// 2 a side) on M15 and H1, its close-out traded WITH it or FADED, and its false break traded back inside; by box size and by the
// higher timeframe's box state; 46 cells against the plain grid7-wide-fade rule as control, ten markets, discovery 2005-14,
// confirmation 2015 to Oct 2026, judged before costs on month sums. Research only: nothing live imports it, nothing is placed.
//   EDGE_DATA=<cache> node research/edge/grid7-box-fade/run.mjs market <m> <outDir>
//   EDGE_DATA=<cache> node research/edge/grid7-box-fade/run.mjs cut <m> <outDir>
//   node research/edge/grid7-box-fade/run.mjs report <outDir>
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import * as K from '../_lib/edgekit.mjs';
import { frames } from '../combo-grid-3/run.mjs';
import { COSTS, exclusions } from '../combo-grid-2/run.mjs';
import { atr14, startIdx } from '../dom-trade-through/run.mjs';
import { MARKETS, ASSUMED, FROM, SPLIT, TO, NM, DM, monthOf, mstat, p1, welch } from '../grid7-wide-core/run.mjs';
import { breaks, exits } from '../grid7-wide-fade/run.mjs';

export { MARKETS, ASSUMED };
const HERE = path.dirname(fileURLToPath(import.meta.url));
export const TFS = ['15m', '1h'], TFN = ['m15', 'h1'], HTF = { '15m': '1h', '1h': '4h' };
export const KBOX = 2, ATRK = 0.1, SMALL = 2, BACK = 2, CAP = { '15m': 86400, '1h': 2 * 86400 };
export const EVENTS = ['with', 'fade', 'false'], CTXS = ['small', 'large', 'htf-in', 'htf-same', 'htf-other'];
const EXITS_OF = { with: ['1R', '2R'], fade: ['1R', '2R', 'box'], false: ['1R', '2R', 'box'] };

// ---- the 46 cells, then 6 control rows (not cells) ----------------------------------------------------------------------
export const CELLS = [];
for (let tf = 0; tf < 2; tf++) for (const ev of EVENTS) for (const x of EXITS_OF[ev]) CELLS.push({ tf: TFN[tf], tfi: tf, event: ev, exit: x, ctx: 'all' });
for (let tf = 0; tf < 2; tf++) for (const ev of EVENTS) for (const cx of CTXS) CELLS.push({ tf: TFN[tf], tfi: tf, event: ev, exit: '1R', ctx: cx });
CELLS.forEach((c) => { c.name = `${c.tf} ${c.event} ${c.exit} ${c.ctx}`; });
export const NCELL = CELLS.length; // 46
export const CTL_EXITS = ['1R', '2R', 'swing'];
export const CONTROLS = []; for (let tf = 0; tf < 2; tf++) for (const x of CTL_EXITS) CONTROLS.push({ tf: TFN[tf], tfi: tf, exit: x, name: `control ${TFN[tf]} fade ext ${x}` });
export const NROW = NCELL + CONTROLS.length;
const IDX = new Map(CELLS.map((c, i) => [c.name, i]));
export const cellId = (tf, ev, x, cx) => IDX.get(`${TFN[tf]} ${ev} ${x} ${cx}`);
export const controlRow = (tf, x) => NCELL + tf * 3 + CTL_EXITS.indexOf(x);
export const controlOf = (c) => controlRow(CELLS[c].tfi, CELLS[c].exit === 'box' ? 'swing' : CELLS[c].exit);

// ---- the higher timeframe's box state per closed candle: 2 = a box stands, +1 / -1 = last close-out, 0 = none yet ----------
export function htfState(H) {
  const st = new Int8Array(H.length); const B = K.boxesHL(H, KBOX);
  for (let k = 0; k < B.length; k++) { const b = B[k], end = b.bi >= 0 ? b.bi : H.length;
    for (let c = b.s; c < end; c++) st[c] = 2;
    if (b.bi >= 0) { const to = k + 1 < B.length ? B[k + 1].s : H.length; for (let c = b.bi; c < to; c++) st[c] = b.dir; } }
  return st;
}
export const htfCtx = (st, d) => (st === 2 ? 'htf-in' : st === d ? 'htf-same' : st === -d ? 'htf-other' : null);

// ---- events (closed candles only): { tf, kind 'co' | 'fb', j, d, ts, hi, lo, ext, a, size, htf } ------------------------------
export function boxEvents(T, tfi, H) {
  const out = [], atr = atr14(T), st = htfState(H);
  const push = (kind, j, d, b, ext) => { const a = atr[j]; if (!(a > 0)) return; const ts = T[j].e;
    const c = K.closedCount(H, ts) - 1; out.push({ tf: tfi, kind, j, d, ts, hi: b.hi, lo: b.lo, ext, a, size: (b.hi - b.lo) / a, htf: c >= 0 ? htfCtx(st[c], d) : null }); };
  for (const b of K.boxesHL(T, KBOX)) {
    const last = b.bi >= 0 ? b.bi - 1 : T.length - 1;
    if (b.bi >= 0) push('co', b.bi, b.dir, b, b.dir > 0 ? T[b.bi].h : T[b.bi].l);
    for (const d of [1, -1]) {
      let done = false;
      for (let j = b.s + 1; j <= last; j++) { const x = T[j];
        if (d > 0 ? x.h > b.hi && x.c <= b.hi : x.l < b.lo && x.c >= b.lo) { push('fb', j, d, b, d > 0 ? x.h : x.l); done = true; break; } }
      if (done || b.bi < 0 || b.dir !== d) continue;
      let ext = d > 0 ? T[b.bi].h : T[b.bi].l;
      for (let j = b.bi + 1; j <= b.bi + BACK && j < T.length; j++) { const x = T[j]; ext = d > 0 ? Math.max(ext, x.h) : Math.min(ext, x.l);
        if (x.c <= b.hi && x.c >= b.lo) { push('fb', j, d, b, ext); break; } }
    }
  }
  return out;
}
export function signals(F) {
  const ev = [], ctl = [];
  TFS.forEach((tfk, tfi) => { const T = F[tfk]; ev.push(...boxEvents(T, tfi, F[HTF[tfk]]));
    const atr = atr14(T); for (const e of breaks(T)) { const a = atr[e.i]; if (!(a > 0)) continue; const b = T[e.i];
      ctl.push({ tf: tfi, d: e.dir, ts: b.e, ext: e.dir > 0 ? b.h : b.l, a, opp: e.opp }); } });
  return { ev, ctl };
}

const inBad = (X, t) => { let lo = 0, hi = X.length; while (lo < hi) { const m = (lo + hi) >> 1; if (X[m][0] <= t) lo = m + 1; else hi = m; } return lo > 0 && t <= X[lo - 1][1]; };
function newAcc() { return { ms: new Float64Array(NROW * NM), msNet: new Float64Array(NROW * NM), n: new Float64Array(NROW * 2), sum: new Float64Array(NROW * 2),
  sq: new Float64Array(NROW * 2), net: new Float64Array(NROW * 2), win: new Float64Array(NROW * 2), cr: new Float64Array(NROW * 2) }; }
function add(A, c, w, m, R, cr) { A.ms[c * NM + m] += R; A.msNet[c * NM + m] += R - cr; A.n[c * 2 + w]++; A.sum[c * 2 + w] += R; A.sq[c * 2 + w] += R * R;
  A.net[c * 2 + w] += R - cr; A.cr[c * 2 + w] += cr; if (R > 0) A.win[c * 2 + w]++; }

// one trade with targets given in R (NaN = no trade in that slot), and its side-flipped twin; null when not a trade
function trade(M5, fi, s, stop, ks, cap) {
  const fill = M5[fi].o, risk = s * (fill - stop); if (!(risk > 0)) return { bad: true };
  if (!(s * (fill - stop) > 0)) throw new Error('stop on the wrong side');
  const r = exits(M5, s, fi, stop, ks.map((k) => (Number.isFinite(k) ? fill + s * k * risk : NaN)), cap);
  const p = exits(M5, -s, fi, fill + s * risk, ks.map((k) => (Number.isFinite(k) ? fill - s * k * risk : NaN)), cap);
  return { fill, risk, r, p };
}

export function runMarket(market) {
  const M5 = K.load(market, '5m', { from: '2004-01-01', to: '2026-11-01' }); const F = frames(M5);
  const { ev, ctl } = signals(F), cost = COSTS[market], X = exclusions(market);
  const real = newAcc(), flip = newAcc(); const meta = { dropped: 0, bad: 0, small: 0, open: 0, sims: 0 };
  const place = (ts) => { const fi = startIdx(M5, ts); if (fi >= M5.length) return null; const t = M5[fi].t; if (t < FROM || t >= TO) return null;
    if (X.length && inBad(X, t)) { meta.dropped++; return null; } return { fi, t, m: monthOf(t), w: t < SPLIT ? 0 : 1 }; };
  const run = (P, s, stop, ks, cap, book) => { const o = trade(M5, P.fi, s, stop, ks, cap); if (o.bad) { meta.bad++; return; }
    if (o.risk < cost) { meta.small++; return; } meta.sims++; if (!o.r || !o.p) { meta.open++; return; } const cr = cost / o.risk;
    book.forEach(([row, k]) => { if (row == null || !Number.isFinite(o.r.R[k])) return; add(real, row, P.w, P.m, o.r.R[k], cr); add(flip, row, P.w, P.m, o.p.R[k], cr); }); };
  for (const g of ev) {
    const P = place(g.ts); if (!P) continue; const cap = CAP[TFS[g.tf]], fill = M5[P.fi].o, other = g.d > 0 ? g.lo : g.hi;
    const ctx = [g.size < SMALL ? 'small' : 'large', g.htf].filter(Boolean);
    const ctxRows = (evn) => ctx.map((cx) => [cellId(g.tf, evn, '1R', cx), 0]);
    if (g.kind === 'co') {
      run(P, g.d, other - g.d * ATRK * g.a, [1, 2], cap, [[cellId(g.tf, 'with', '1R', 'all'), 0], [cellId(g.tf, 'with', '2R', 'all'), 1], ...ctxRows('with')]);
    }
    const evn = g.kind === 'co' ? 'fade' : 'false', s = -g.d, stop = g.ext + g.d * ATRK * g.a, risk = s * (fill - stop);
    const kb = risk > 0 ? (s * (other - fill)) / risk : NaN;
    run(P, s, stop, [1, 2, kb >= 1 ? kb : NaN], cap, [[cellId(g.tf, evn, '1R', 'all'), 0], [cellId(g.tf, evn, '2R', 'all'), 1], [cellId(g.tf, evn, 'box', 'all'), 2], ...ctxRows(evn)]);
  }
  for (const g of ctl) {
    const P = place(g.ts); if (!P) continue; const fill = M5[P.fi].o, s = -g.d, stop = g.ext + g.d * ATRK * g.a, risk = s * (fill - stop);
    const sr = g.opp == null || !(risk > 0) ? NaN : (s * (g.opp - fill)) / risk;
    run(P, s, stop, [1, 2, sr > 0 ? sr : NaN], CAP[TFS[g.tf]], CTL_EXITS.map((x, k) => [controlRow(g.tf, x), k]));
  }
  const J = (A) => Object.fromEntries(Object.entries(A).map(([k, v]) => [k, Array.from(v, (z) => +z.toFixed(6))]));
  return { market, cost, assumed: ASSUMED.includes(market), first: M5.length ? M5[0].t : null, last: M5.length ? M5[M5.length - 1].t : null,
    events: ev.length, controlSignals: ctl.length, ...meta, real: J(real), flip: J(flip) };
}

// ---- cut test: the events known by a date, computed on candles cut there, equal the full run's ----------------------------
export function cutTest(market, cuts = ['2008-06-11', '2012-03-14', '2016-09-21', '2021-02-17', '2025-05-07']) {
  const M5 = K.load(market, '5m', { from: '2004-01-01', to: '2026-11-01' });
  const key = (g) => [g.tf, g.kind, g.d, g.ts, g.hi, g.lo, g.ext, g.a.toFixed(10), g.htf].join('|');
  const full = signals(frames(M5)).ev; const out = [];
  for (const c of cuts) { const T = Date.parse(c + 'T00:00:00Z') / 1000;
    const cut = signals(frames(M5.filter((b) => b.e <= T))).ev.filter((g) => g.ts <= T).map(key);
    const want = full.filter((g) => g.ts <= T).map(key); const A = new Set(cut), B = new Set(want);
    out.push({ market, cut: c, n: B.size, missing: [...B].filter((k) => !A.has(k)).length, extra: [...A].filter((k) => !B.has(k)).length }); }
  return out;
}

// ---- pooled statistics ----------------------------------------------------------------------------------------------------
export function pool(list, kind) { const A = newAcc(); for (const d of list) { const S = d[kind]; for (const k of Object.keys(A)) for (let i = 0; i < A[k].length; i++) A[k][i] += S[k][i]; } return A; }
export function rowStats(A, c) {
  const ms = A.ms.subarray(c * NM, (c + 1) * NM), msn = A.msNet.subarray(c * NM, (c + 1) * NM);
  const win = (w) => { const n = A.n[c * 2 + w], a = w ? DM : 0, b = w ? NM : DM;
    return { n, mean: n ? A.sum[c * 2 + w] / n : null, t: mstat(ms, a, b).t, meanNet: n ? A.net[c * 2 + w] / n : null, tNet: mstat(msn, a, b).t,
      win: n ? A.win[c * 2 + w] / n : null, costR: n ? A.cr[c * 2 + w] / n : null, months: b - a, sum: A.sum[c * 2 + w], sq: A.sq[c * 2 + w] }; };
  return { d: win(0), c: win(1) };
}
export const passOf = (r) => r.d.n >= 300 && r.c.n >= 300 && r.d.mean > 0 && r.c.mean > 0 && r.d.t >= 2 && r.c.t >= 2 && r.holm < 0.05
  && r.vs.d != null && r.vs.c != null && r.vs.d >= 2 && r.vs.c >= 2;
export function judge(data) {
  const A = pool(data, 'real'), B = pool(data, 'flip'); const rows = [];
  for (let c = 0; c < NCELL; c++) { const s = rowStats(A, c), f = rowStats(B, c), k = rowStats(A, controlOf(c));
    rows.push({ cell: c, ...CELLS[c], d: s.d, c: s.c, p: p1(s.c.t, s.c.months - 1), control: CONTROLS[controlOf(c) - NCELL].name,
      vs: { d: welch(s.d, k.d), c: welch(s.c, k.c) }, flip: { d: f.d, c: f.c } }); }
  const H = K.holm(rows.map((r) => r.p));
  rows.forEach((r, i) => { r.holm = H[i];
    r.checks = { n: r.d.n >= 300 && r.c.n >= 300, disc: r.d.mean > 0 && r.d.t >= 2, conf: r.c.mean > 0 && r.c.t >= 2, holm: H[i] < 0.05,
      control: r.vs.d != null && r.vs.c != null && r.vs.d >= 2 && r.vs.c >= 2 };
    r.pass = passOf(r); });
  const ctl = CONTROLS.map((x, i) => { const s = rowStats(A, NCELL + i), f = rowStats(B, NCELL + i); return { ...x, d: s.d, c: s.c, flip: { d: f.d, c: f.c } }; });
  return { rows, ctl };
}

const f3 = (x) => (x == null ? 'n/a' : (x >= 0 ? '+' : '-') + Math.abs(x).toFixed(3)), f2 = (x) => (x == null ? 'n/a' : x.toFixed(2)), N = (x) => Math.round(x).toLocaleString('en-US');
const slim = (w) => ({ n: w.n, mean: w.mean == null ? null : +w.mean.toFixed(6), t: +w.t.toFixed(6), meanNet: w.meanNet == null ? null : +w.meanNet.toFixed(6),
  tNet: +w.tNet.toFixed(2), win: w.win == null ? null : +w.win.toFixed(3), costR: w.costR == null ? null : +w.costR.toFixed(4) });
const r2 = (x) => (x == null ? null : +x.toFixed(4));

export function report(dir) {
  const data = MARKETS.filter((m) => fs.existsSync(path.join(dir, m + '.json'))).map((m) => JSON.parse(fs.readFileSync(path.join(dir, m + '.json'), 'utf8')));
  const cut = MARKETS.flatMap((m) => { const f = path.join(dir, 'cut-' + m + '.json'); return fs.existsSync(f) ? JSON.parse(fs.readFileSync(f, 'utf8')) : []; });
  const { rows, ctl } = judge(data); const pass = rows.filter((r) => r.pass);
  const verdict = data.length < 8 ? 'INCONCLUSIVE' : pass.length ? 'PASS' : 'FAIL';
  const best = [...rows].sort((a, b) => b.c.t - a.c.t)[0], b = [...pass].sort((a, b2) => b2.c.t - a.c.t)[0] || best;
  const perMarket = {}; for (const r of pass) perMarket[r.name] = data.map((d) => { const s = rowStats(pool([d], 'real'), r.cell); return { market: d.market, assumed: d.assumed, d: slim(s.d), c: slim(s.c) }; });
  const headline = verdict === 'PASS'
    ? `${pass.length} of 46 box cells pass before costs; best ${b.name}, ${f3(b.c.mean)}R a trade in 2015-26 (n ${N(b.c.n)}, month t ${f2(b.c.t)}; discovery ${f3(b.d.mean)}R, t ${f2(b.d.t)}; Welch t vs the plain fade ${f2(b.vs.d)} / ${f2(b.vs.c)}), ${f3(b.c.meanNet)}R after costs`
    : `0 of 46 box cells pass; the best confirmation cell, ${b.name}, made ${f3(b.c.mean)}R a trade before costs in 2015-26 (n ${N(b.c.n)}, month t ${f2(b.c.t)}; discovery ${f3(b.d.mean)}R, t ${f2(b.d.t)}), Welch t against the plain fade ${f2(b.vs.d)} / ${f2(b.vs.c)}`;
  const out = { study: 'grid7-box-fade', built: '2026-11-23', verdict, headline, basis: 'judged before costs on calendar-month sums (pre-registered); after costs beside',
    windows: { discovery: '2005-01-01 to 2014-12-31 (120 months)', confirmation: '2015-01-01 to 2026-10-31 (142 months)' }, markets: data.map((d) => d.market),
    assumedCosts: ASSUMED, costs: Object.fromEntries(data.map((d) => [d.market, d.cost])),
    meta: data.map((d) => ({ market: d.market, first: new Date(d.first * 1000).toISOString().slice(0, 10), last: new Date(d.last * 1000).toISOString().slice(0, 10),
      events: d.events, controlSignals: d.controlSignals, sims: d.sims, dropped: d.dropped, bad: d.bad, small: d.small, open: d.open })),
    passed: pass.map((r) => r.name), bestConfirmation: best.name,
    passedNetPositive: pass.filter((r) => r.d.meanNet > 0 && r.c.meanNet > 0).map((r) => r.name),
    checkCounts: Object.fromEntries(['n', 'disc', 'conf', 'holm', 'control'].map((k) => [k, rows.filter((r) => r.checks[k]).length])),
    flipPassedBar14: rows.filter((r) => r.flip.d.n >= 300 && r.flip.c.n >= 300 && r.flip.d.mean > 0 && r.flip.c.mean > 0 && r.flip.d.t >= 2 && r.flip.c.t >= 2).map((r) => r.name),
    cut,
    controls: ctl.map((x) => ({ name: x.name, disc: slim(x.d), conf: slim(x.c), flip: { disc: slim(x.flip.d), conf: slim(x.flip.c) } })),
    cells: rows.map((r) => ({ cell: r.name, tf: r.tf, event: r.event, exit: r.exit, ctx: r.ctx, disc: slim(r.d), conf: slim(r.c), holm: +r.holm.toFixed(4),
      control: r.control, vsControl: { disc: r2(r.vs.d), conf: r2(r.vs.c) }, checks: r.checks, pass: r.pass, flip: { disc: slim(r.flip.d), conf: slim(r.flip.c) } })),
    perMarket };
  fs.writeFileSync(path.join(HERE, 'result.json'), JSON.stringify(out, null, 1) + '\n');
  fs.writeFileSync(path.join(HERE, 'RESULT.md'), resultMd(out, rows, ctl));
  return out;
}

function resultMd(o, rows, ctl) {
  const nCut = o.cut.reduce((a, x) => a + x.n, 0), bad = o.cut.reduce((a, x) => a + x.missing + x.extra, 0), L = [];
  L.push('# Box grid: the swing box\'s close-out with it, faded, and its false break, on ten markets (result)', '', `**Verdict: ${o.verdict}. ${o.headline}.**`, '',
    'Run 23 Nov 2026 as pre-registered (`PREREGISTRATION.md`, committed and pushed alone first). Research only: nothing live',
    'changed, nothing is proposed. One run, no variants.', '',
    '## What was run', '',
    'The box from the last confirmed swing low to the last confirmed swing high (2 candles a side, `edgekit` `boxesHL`) on M15 and',
    'H1, closed out by a candle closing beyond it. Events: the close-out traded WITH it (stop past the box\'s other side + 0.1 ATR),',
    'the close-out FADED, and the first false break of each edge (a wick beyond with the close inside, or a close-out closed back',
    'inside within 2 candles) traded back into the box (both: stop past the break\'s extreme + 0.1 ATR). Market entry at the next',
    '5-minute open; exits 1R, 2R or the box\'s other side (only when 1R or more away). Context at 1R: box size under / over 2 ATR,',
    'and the higher timeframe\'s box (H1 for M15, H4 for H1) standing, last closed out the same way, or the other way. 46 cells,',
    'ten markets pooled, discovery = fills 2005-2014, confirmation = 2015 to October 2026, judged before costs on month sums, Holm',
    'over the 46 confirmation tests, and each cell against the plain `grid7-wide-fade` rule on its timeframe and exit (Welch t >= 2',
    'in both windows).',
    `Costs beside: the demo figures for gold and the four majors; **ASSUMED, not measured** for ${o.assumedCosts.join(', ')}.`, '',
    '## The bar, cell by cell', '',
    `- n >= 300 in both windows: ${o.checkCounts.n} of 46.`,
    `- Mean R > 0 and month t >= 2 in discovery: ${o.checkCounts.disc}; in confirmation: ${o.checkCounts.conf}.`,
    `- Holm-adjusted p < 0.05: ${o.checkCounts.holm}.`,
    `- Beats its control (Welch t >= 2 in both windows): ${o.checkCounts.control}.`,
    `- **All five: ${o.passed.length}${o.passed.length ? ' (' + o.passed.join('; ') + ')' : ''}.**`,
    `- Of those, positive after costs in both windows: ${o.passedNetPositive.length}${o.passedNetPositive.length ? ' (' + o.passedNetPositive.join('; ') + ')' : ''}.`,
    `- Side-flipped cells clearing bars 1-3 (n, discovery, confirmation): ${o.flipPassedBar14.length}${o.flipPassedBar14.length ? ' (' + o.flipPassedBar14.join('; ') + ')' : ''}.`, '',
    '## The controls (the plain fade, `grid7-wide-fade` rule)', '',
    '| Control | n 05-14 | R 05-14 (t) | net 05-14 | n 15-26 | R 15-26 (t) | net 15-26 | flipped R 15-26 (t) |', '|---|---:|---:|---:|---:|---:|---:|---:|');
  for (const x of ctl) L.push(`| ${x.name} | ${N(x.d.n)} | ${f3(x.d.mean)} (${f2(x.d.t)}) | ${f3(x.d.meanNet)} | ${N(x.c.n)} | ${f3(x.c.mean)} (${f2(x.c.t)}) | ${f3(x.c.meanNet)} | ${f3(x.flip.c.mean)} (${f2(x.flip.c.t)}) |`);
  L.push('', '## Every cell', '',
    'R a trade before costs (month-sum t), after costs beside; "vs ctl" = Welch t of the cell\'s R against its control\'s, discovery /',
    'confirmation; flipped = the same cell traded the other way.', '',
    '| Cell | n 05-14 | R 05-14 (t) | net 05-14 | n 15-26 | R 15-26 (t) | net 15-26 | Holm | vs ctl | Flipped R 15-26 (t) | Pass |',
    '|---|---:|---:|---:|---:|---:|---:|---:|---:|---:|---|');
  for (const r of rows) L.push(`| ${r.name} | ${N(r.d.n)} | ${f3(r.d.mean)} (${f2(r.d.t)}) | ${f3(r.d.meanNet)} | ${N(r.c.n)} | ${f3(r.c.mean)} (${f2(r.c.t)}) | ${f3(r.c.meanNet)} | ${r.holm.toFixed(3)} | ${f2(r.vs.d)} / ${f2(r.vs.c)} | ${f3(r.flip.c.mean)} (${f2(r.flip.c.t)}) | ${r.pass ? 'yes' : 'no'} |`);
  L.push('');
  if (o.passed.length) { L.push('## Per market, passing cells', '', 'Before costs (after costs in brackets); * = cost ASSUMED.', '');
    for (const [name, list] of Object.entries(o.perMarket)) { L.push(`### ${name}`, '', '| Market | n 05-14 | R (t) [net] | n 15-26 | R (t) [net] | cost R 15-26 |', '|---|---:|---:|---:|---:|---:|');
      for (const x of list) L.push(`| ${x.market}${x.assumed ? '*' : ''} | ${N(x.d.n)} | ${f3(x.d.mean)} (${f2(x.d.t)}) [${f3(x.d.meanNet)}] | ${N(x.c.n)} | ${f3(x.c.mean)} (${f2(x.c.t)}) [${f3(x.c.meanNet)}] | ${x.c.costR == null ? 'n/a' : x.c.costR.toFixed(3)} |`);
      L.push(''); } }
  L.push('## Checks', '',
    `- Cut test: ${o.cut.length} cuts on ${[...new Set(o.cut.map((x) => x.market))].join(', ')}: ${N(nCut)} events known by the cut dates, ${bad} missing or extra when the candles are cut there.`,
    '- Every trade has its stop on the losing side of the fill (the run throws otherwise); a fill at or past the stop and a risk under the round-trip cost are no trades.',
    '- Exclusions: the data-quality audit\'s bad intervals (`combo-grid-2` `exclusions`).', '',
    '| Market | candles from | box events | control signals | trades simulated | dropped (bad data) | past the stop | risk under cost | unresolved |', '|---|---|---:|---:|---:|---:|---:|---:|---:|');
  for (const m of o.meta) L.push(`| ${m.market} | ${m.first} | ${N(m.events)} | ${N(m.controlSignals)} | ${N(m.sims)} | ${m.dropped} | ${N(m.bad)} | ${N(m.small)} | ${m.open} |`);
  L.push('', '## What it means', '');
  if (o.verdict === 'PASS') L.push(`${o.passed.length} box cells clear the pre-registered bar before costs in both decades AND beat the plain fade. ${o.passedNetPositive.length ? o.passedNetPositive.length + ' stay positive after costs in both windows.' : 'None stays positive after costs in both windows.'}`,
    'A before-cost tilt, not an edge: never adopted without a forward record and the owner. One run, no variants on these years.');
  else L.push('No box cell clears the bar: on ten markets and 22 years the box\'s close-out, faded or traded with it, and its false break',
    'do not beat the plain fade of the first structure break before costs in both decades (and the plain fade itself loses after',
    'costs). Do not re-test variants of these 46 cells on these years. Nothing live changed; no rule is proposed.');
  L.push('');
  return L.join('\n');
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const [cmd, a, b] = process.argv.slice(2);
  if (cmd === 'market') { fs.mkdirSync(b, { recursive: true }); const t0 = Date.now(); const r = runMarket(a);
    fs.writeFileSync(path.join(b, a + '.json'), JSON.stringify(r)); console.log(a, 'events', r.events, 'sims', r.sims, ((Date.now() - t0) / 1000).toFixed(0) + 's'); }
  else if (cmd === 'cut') { fs.mkdirSync(b, { recursive: true }); const r = cutTest(a); fs.writeFileSync(path.join(b, 'cut-' + a + '.json'), JSON.stringify(r)); console.log(JSON.stringify(r)); }
  else if (cmd === 'report') { const o = report(a); console.log(o.verdict, o.headline); }
  else console.log('usage: run.mjs market <m> <dir> | cut <m> <dir> | report <dir>');
}
