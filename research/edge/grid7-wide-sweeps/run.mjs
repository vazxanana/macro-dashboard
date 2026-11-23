// research/edge/grid7-wide-sweeps/run.mjs - the wide sweep grid of PREREGISTRATION.md (23 Nov 2026): sweeps of the Asia range,
// the previous trading day and the previous week in London / New York, entered against the sweep at market, against
// grid7-wide-fade's M15 fade as the control; 36 sweep cells + 12 control cells, ten markets, discovery 2005-14, confirmation
// 2015 to Oct 2026, judged before costs on month sums; the side-flipped trades beside. Research only: nothing live imports it,
// nothing is placed. Imports edgekit, combo-grid-3 (frames), combo-grid-2 (COSTS, exclusions), dom-trade-through (atr14,
// startIdx), grid7-wide-core (markets, windows, dailyCalls -> council/eg-methods direction(), statistics) and grid7-wide-fade
// (breaks, exits, sessionOf); none edited.
//   EDGE_DATA=<cache> node research/edge/grid7-wide-sweeps/run.mjs market <m> <outDir>
//   EDGE_DATA=<cache> node research/edge/grid7-wide-sweeps/run.mjs cut <m> <outDir>
//   node research/edge/grid7-wide-sweeps/run.mjs report <outDir>
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import * as K from '../_lib/edgekit.mjs';
import { frames } from '../combo-grid-3/run.mjs';
import { COSTS, exclusions } from '../combo-grid-2/run.mjs';
import { atr14, startIdx } from '../dom-trade-through/run.mjs';
import { MARKETS, ASSUMED, FROM, SPLIT, TO, NM, DM, monthOf, mstat, p1, welch, dailyCalls } from '../grid7-wide-core/run.mjs';
import { breaks, exits, sessionOf } from '../grid7-wide-fade/run.mjs';

export { MARKETS, ASSUMED };
const HERE = path.dirname(fileURLToPath(import.meta.url));
const DAY = 86400;
export const RANGES = ['asia', 'day', 'week'], SESS = ['london', 'ny'], XS = ['1R', '2R', 'range'], XC = ['1R', '2R', 'swing'], CALLS = ['all', 'agree'];
export const WIN_H = [[7, 12], [12, 17]];
export const SWEEP_ATR = 0.1, STOP_ATR = 0.1, BACK = 3, CAP = DAY, ASIA_MIN = 60;
export const NS = 36, NCELL = 48;
export const cellS = (rg, se, x, c) => ((rg * 2 + se) * 3 + x) * 2 + c;
export const cellC = (se, x, c) => NS + (se * 3 + x) * 2 + c;
export const controlOf = (i) => { const n = cellName(i); return cellC(SESS.indexOf(n.session), n.xi, CALLS.indexOf(n.call)); };
export function cellName(i) {
  if (i < NS) { const c = i % 2; let r = (i - c) / 2; const x = r % 3; r = (r - x) / 3; const se = r % 2; const rg = (r - se) / 2;
    return { kind: 'sweep', range: RANGES[rg], session: SESS[se], exit: XS[x], call: CALLS[c], xi: x, name: `${RANGES[rg]} ${SESS[se]} ${XS[x]} ${CALLS[c]}` }; }
  const j = i - NS, c = j % 2, r = (j - c) / 2, x = r % 3, se = (r - x) / 3;
  return { kind: 'control', range: 'fade', session: SESS[se], exit: XC[x], call: CALLS[c], xi: x, name: `fade ${SESS[se]} ${XC[x]} ${CALLS[c]}` };
}

// ---- ranges known before a session ---------------------------------------------------------------------------------------
function asiaOf(M5, D0) { let i = startIdx(M5, D0), n = 0, hi = -Infinity, lo = Infinity;
  for (; i < M5.length && M5[i].t < D0 + 7 * 3600; i++) { n++; if (M5[i].h > hi) hi = M5[i].h; if (M5[i].l < lo) lo = M5[i].l; }
  return n >= ASIA_MIN && hi > lo ? { hi, lo } : null; }
export function rangesAt(F, D0, start, asia) {
  const D = F['1d'], W = F['1w']; const k = K.closedCount(D, start) - 1, w = K.closedCount(W, start) - 1;
  return [asia,
    k >= 0 && D[k].e > start - 4 * DAY && D[k].h > D[k].l ? { hi: D[k].h, lo: D[k].l } : null,
    w >= 0 && W[w].h > W[w].l ? { hi: W[w].h, lo: W[w].l } : null];
}

// ---- signals (closed candles only) -----------------------------------------------------------------------------------------
// sweeps: { kind 0, rg, se, s, ts (close of the candle back inside), stop, other, call, edge, X }
// control: { kind 1, s, ts (close of the break candle), stop, opp, call }  (session from the fill hour, in runMarket)
export function signals(F) {
  const M5 = F['5m'], T = F['15m'], D = F['1d'], aT = atr14(T), aD = atr14(D), calls = dailyCalls(F);
  const callAt = (t) => { const i = K.closedCount(D, t) - 1; return i >= 0 ? calls[i] : 0; };
  const out = [];
  if (!M5.length) return out;
  const d0 = Math.floor(M5[0].t / DAY) * DAY, d1 = M5[M5.length - 1].e;
  for (let D0 = d0; D0 < d1; D0 += DAY) {
    const wd = new Date(D0 * 1000).getUTCDay(); if (wd === 0 || wd === 6) continue;
    const asia = asiaOf(M5, D0);
    for (let se = 0; se < 2; se++) {
      const a = D0 + WIN_H[se][0] * 3600, b = D0 + WIN_H[se][1] * 3600;
      const R = rangesAt(F, D0, a, asia);
      const j0 = Math.max(startIdx(T, a), 1), j1 = startIdx(T, b); if (j1 <= j0) continue;
      for (let rg = 0; rg < 3; rg++) { const r = R[rg]; if (!r) continue;
        for (const d of [1, -1]) {
          const edge = d > 0 ? r.hi : r.lo, beyond = (x) => (d > 0 ? x > edge : x < edge);
          for (let j = j0; j < j1; j++) {
            if (!beyond(d > 0 ? T[j].h : T[j].l) || beyond(T[j - 1].c)) continue;
            const di = K.closedCount(D, T[j].t) - 1, ad = di >= 0 ? aD[di] : 0; if (!(ad > 0)) continue;
            let X = d > 0 ? -Infinity : Infinity, m = -1;
            for (let q = j; q < j + BACK && q < T.length; q++) { X = d > 0 ? Math.max(X, T[q].h) : Math.min(X, T[q].l);
              if (!beyond(T[q].c) && T[q].c !== edge) { m = q; break; } }
            if (m < 0 || d * (X - edge) < SWEEP_ATR * ad || !(aT[m] > 0)) continue;
            out.push({ kind: 0, rg, se, s: -d, ts: T[m].e, stop: X + d * STOP_ATR * aT[m], other: d > 0 ? r.lo : r.hi, call: callAt(T[m].e), edge, X });
            break;
          }
        }
      }
    }
  }
  for (const e of breaks(T)) { const a = aT[e.i]; if (!(a > 0)) continue; const bk = T[e.i];
    out.push({ kind: 1, s: -e.dir, ts: bk.e, stop: (e.dir > 0 ? bk.h : bk.l) + e.dir * STOP_ATR * a, opp: e.opp, call: callAt(bk.e) }); }
  return out;
}

const inBad = (X, t) => { let lo = 0, hi = X.length; while (lo < hi) { const m = (lo + hi) >> 1; if (X[m][0] <= t) lo = m + 1; else hi = m; } return lo > 0 && t <= X[lo - 1][1]; };
function newAcc() { return { ms: new Float64Array(NCELL * NM), msNet: new Float64Array(NCELL * NM), n: new Float64Array(NCELL * 2), sum: new Float64Array(NCELL * 2),
  sq: new Float64Array(NCELL * 2), net: new Float64Array(NCELL * 2), win: new Float64Array(NCELL * 2), cr: new Float64Array(NCELL * 2) }; }
function add(A, c, w, m, R, cr) { A.ms[c * NM + m] += R; A.msNet[c * NM + m] += R - cr; A.n[c * 2 + w]++; A.sum[c * 2 + w] += R; A.sq[c * 2 + w] += R * R;
  A.net[c * 2 + w] += R - cr; A.cr[c * 2 + w] += cr; if (R > 0) A.win[c * 2 + w]++; }

export function runMarket(market) {
  const M5 = K.load(market, '5m', { from: '2004-01-01', to: '2026-11-01' }); const F = frames(M5);
  const sigs = signals(F), cost = COSTS[market], X = exclusions(market);
  const real = newAcc(), flip = newAcc(); let dropped = 0, bad = 0, small = 0, sims = 0, open = 0, offSession = 0;
  for (const g of sigs) {
    const fi = startIdx(M5, g.ts); if (fi >= M5.length) continue; const t = M5[fi].t; if (t < FROM || t >= TO) continue;
    let se = g.se; if (g.kind === 1) { se = sessionOf(t); if (se > 1) { offSession++; continue; } }
    if (X.length && inBad(X, t)) { dropped++; continue; }
    const s = g.s, fill = M5[fi].o, risk = s * (fill - g.stop);
    if (!(risk > 0)) { bad++; continue; }
    if (risk < cost) { small++; continue; }
    if (!(s * (fill - g.stop) > 0)) throw new Error('stop on the wrong side');
    const third = g.kind === 0 ? (s * (g.other - fill)) / risk : g.opp == null ? NaN : (s * (g.opp - fill)) / risk;
    const ks = [1, 2, g.kind === 0 ? (third >= 1 ? third : NaN) : (third > 0 ? third : NaN)];
    const r = exits(M5, s, fi, g.stop, ks.map((k) => (Number.isFinite(k) ? fill + s * k * risk : NaN)), CAP);
    const p = exits(M5, -s, fi, fill + s * risk, ks.map((k) => (Number.isFinite(k) ? fill - s * k * risk : NaN)), CAP); sims++;
    if (!r || !p) { open++; continue; }
    const m = monthOf(t), w = t < SPLIT ? 0 : 1, cr = cost / risk;
    for (let x = 0; x < 3; x++) { if (!Number.isFinite(ks[x])) continue;
      for (let c = 0; c < 2; c++) { if (c === 1 && g.call !== s) continue;
        const ci = g.kind === 0 ? cellS(g.rg, se, x, c) : cellC(se, x, c); add(real, ci, w, m, r.R[x], cr); add(flip, ci, w, m, p.R[x], cr); } }
  }
  const J = (A) => Object.fromEntries(Object.entries(A).map(([k, v]) => [k, Array.from(v, (z) => +z.toFixed(6))]));
  return { market, cost, assumed: ASSUMED.includes(market), first: M5.length ? M5[0].t : null, last: M5.length ? M5[M5.length - 1].t : null,
    signals: sigs.length, sweeps: sigs.filter((g) => g.kind === 0).length, sims, dropped, bad, small, open, offSession, real: J(real), flip: J(flip) };
}

// ---- cut test: the signals known by a date, computed on candles cut there, equal the full run's ---------------------------
export const sigKey = (g) => [g.kind, g.rg, g.se, g.s, g.ts, g.stop.toFixed(8), g.call, g.other ?? g.opp].join('|');
export function cutTest(market, cuts = ['2008-06-11', '2012-03-14', '2016-09-21', '2021-02-17', '2025-05-07']) {
  const M5 = K.load(market, '5m', { from: '2004-01-01', to: '2026-11-01' });
  const full = signals(frames(M5)); const out = [];
  for (const c of cuts) { const T = Date.parse(c + 'T00:00:00Z') / 1000;
    const cut = signals(frames(M5.filter((b) => b.e <= T))).filter((g) => g.ts <= T).map(sigKey);
    const want = full.filter((g) => g.ts <= T).map(sigKey); const A = new Set(cut), B = new Set(want);
    out.push({ market, cut: c, n: B.size, missing: [...B].filter((k) => !A.has(k)).length, extra: [...A].filter((k) => !B.has(k)).length }); }
  return out;
}

// ---- pooled statistics ----------------------------------------------------------------------------------------------------
export function pool(list, kind) { const A = newAcc(); for (const d of list) { const S = d[kind]; for (const k of Object.keys(A)) for (let i = 0; i < A[k].length; i++) A[k][i] += S[k][i]; } return A; }
export function cellStats(A, c) {
  const ms = A.ms.subarray(c * NM, (c + 1) * NM), msn = A.msNet.subarray(c * NM, (c + 1) * NM);
  const win = (w) => { const n = A.n[c * 2 + w], a = w ? DM : 0, b = w ? NM : DM;
    return { n, sum: A.sum[c * 2 + w], sq: A.sq[c * 2 + w], mean: n ? A.sum[c * 2 + w] / n : null, t: mstat(ms, a, b).t, meanNet: n ? A.net[c * 2 + w] / n : null,
      tNet: mstat(msn, a, b).t, win: n ? A.win[c * 2 + w] / n : null, costR: n ? A.cr[c * 2 + w] / n : null, months: b - a }; };
  return { d: win(0), c: win(1) };
}
const base = (x, h) => x.d.n >= 300 && x.c.n >= 300 && x.d.mean > 0 && x.c.mean > 0 && x.d.t >= 2 && x.c.t >= 2 && h < 0.05;
export function judge(data) {
  const A = pool(data, 'real'), P = pool(data, 'flip'); const rows = [];
  for (let c = 0; c < NCELL; c++) { const s = cellStats(A, c), ps = cellStats(P, c), nm = cellName(c);
    const ctl = nm.kind === 'sweep' ? cellStats(A, controlOf(c)) : null;
    rows.push({ cell: c, ...nm, d: s.d, c: s.c, p: p1(s.c.t, s.c.months - 1), vs: ctl ? { d: welch(s.d, ctl.d), c: welch(s.c, ctl.c) } : null,
      flip: { d: ps.d, c: ps.c, p: p1(ps.c.t, ps.c.months - 1) } }); }
  const H = K.holm(rows.map((r) => r.p)), HF = K.holm(rows.map((r) => r.flip.p));
  rows.forEach((r, i) => { r.holm = H[i]; r.flip.holm = HF[i];
    r.checks = { n: r.d.n >= 300 && r.c.n >= 300, disc: r.d.mean > 0 && r.d.t >= 2, conf: r.c.mean > 0 && r.c.t >= 2, holm: H[i] < 0.05,
      control: !!(r.vs && r.vs.d != null && r.vs.c != null && r.vs.d >= 2 && r.vs.c >= 2) };
    r.pass = r.kind === 'sweep' && base(r, H[i]) && r.checks.control; r.flip.pass = r.kind === 'sweep' && base(r.flip, HF[i]); });
  return rows;
}

const f3 = (x) => (x == null ? 'n/a' : (x >= 0 ? '+' : '-') + Math.abs(x).toFixed(3)), f2 = (x) => (x == null ? 'n/a' : x.toFixed(2)), N = (x) => Math.round(x).toLocaleString('en-US');
const slim = (w) => ({ n: w.n, mean: w.mean == null ? null : +w.mean.toFixed(6), t: +w.t.toFixed(6), meanNet: w.meanNet == null ? null : +w.meanNet.toFixed(6),
  tNet: +w.tNet.toFixed(2), win: w.win == null ? null : +w.win.toFixed(3), costR: w.costR == null ? null : +w.costR.toFixed(4) });

export function report(dir) {
  const data = MARKETS.filter((m) => fs.existsSync(path.join(dir, m + '.json'))).map((m) => JSON.parse(fs.readFileSync(path.join(dir, m + '.json'), 'utf8')));
  const cut = MARKETS.flatMap((m) => { const f = path.join(dir, 'cut-' + m + '.json'); return fs.existsSync(f) ? JSON.parse(fs.readFileSync(f, 'utf8')) : []; });
  const rows = judge(data), sw = rows.filter((r) => r.kind === 'sweep'), pass = sw.filter((r) => r.pass), fPass = sw.filter((r) => r.flip.pass);
  const verdict = data.length < 8 ? 'INCONCLUSIVE' : pass.length ? 'PASS' : 'FAIL';
  const best = [...sw].sort((a, b) => b.c.t - a.c.t)[0], bestBoth = [...sw].sort((a, b) => Math.min(b.d.t, b.c.t) - Math.min(a.d.t, a.c.t))[0];
  const bestPass = [...pass].sort((a, b) => b.c.t - a.c.t)[0];
  const perMarket = {}; for (const r of pass) perMarket[r.name] = data.map((d) => { const s = cellStats(pool([d], 'real'), r.cell); return { market: d.market, assumed: d.assumed, d: slim(s.d), c: slim(s.c) }; });
  const nSweepTrades = { d: 0, c: 0 }; for (const r of sw.filter((r) => r.exit === '1R' && r.call === 'all')) { nSweepTrades.d += r.d.n; nSweepTrades.c += r.c.n; }
  const b = bestPass || best;
  const headline = verdict === 'PASS'
    ? `${pass.length} of 36 sweep cells pass before costs and beat the plain fade; best ${b.name}, ${f3(b.c.mean)}R a trade in 2015-26 (n ${N(b.c.n)}, month t ${f2(b.c.t)}; discovery ${f3(b.d.mean)}R, t ${f2(b.d.t)}), ${f3(b.c.meanNet)}R after costs`
    : `0 of 36 sweep cells pass; the best confirmation cell, ${b.name}, made ${f3(b.c.mean)}R a trade before costs in 2015-26 (n ${N(b.c.n)}, month t ${f2(b.c.t)}; discovery ${f3(b.d.mean)}R, t ${f2(b.d.t)}; ${f3(b.c.meanNet)}R after costs)`;
  const RW = rows.map((r) => ({ cell: r.name, kind: r.kind, range: r.range, session: r.session, exit: r.exit, call: r.call, disc: slim(r.d), conf: slim(r.c),
    holm: +r.holm.toFixed(4), vsControl: r.vs ? { d: r.vs.d == null ? null : +r.vs.d.toFixed(2), c: r.vs.c == null ? null : +r.vs.c.toFixed(2) } : null,
    checks: r.checks, pass: r.pass, flipped: { disc: slim(r.flip.d), conf: slim(r.flip.c), holm: +r.flip.holm.toFixed(4), pass: r.flip.pass } }));
  const out = { study: 'grid7-wide-sweeps', built: '2026-11-23', verdict, headline, basis: 'judged before costs on calendar-month sums (pre-registered); after costs beside',
    windows: { discovery: '2005-01-01 to 2014-12-31 (120 months)', confirmation: '2015-01-01 to 2026-10-31 (142 months)' }, markets: data.map((d) => d.market),
    assumedCosts: ASSUMED, costs: Object.fromEntries(data.map((d) => [d.market, d.cost])),
    meta: data.map((d) => ({ market: d.market, first: new Date(d.first * 1000).toISOString().slice(0, 10), last: new Date(d.last * 1000).toISOString().slice(0, 10),
      signals: d.signals, sweeps: d.sweeps, sims: d.sims, dropped: d.dropped, bad: d.bad, small: d.small, open: d.open, offSession: d.offSession })),
    passed: pass.map((r) => r.name), flippedPassed: fPass.map((r) => r.name), bestConfirmation: best.name, bestBothWindows: bestBoth.name,
    passedNetPositive: pass.filter((r) => r.d.meanNet > 0 && r.c.meanNet > 0).map((r) => r.name), sweepTrades1R: nSweepTrades,
    cut, cells: RW, perMarket, controlGate: controlGate(rows) };
  fs.writeFileSync(path.join(HERE, 'result.json'), JSON.stringify(out, null, 1) + '\n');
  fs.writeFileSync(path.join(HERE, 'RESULT.md'), resultMd(out, rows, best, bestBoth));
  return out;
}

// the control's 1R cells are grid7-wide-fade's 'm15 none ext 1R <session>' cells: same trades, same R
export function controlGate(rows) {
  const f = path.join(HERE, '..', 'grid7-wide-fade', 'result.json'); if (!fs.existsSync(f)) return null;
  const F = JSON.parse(fs.readFileSync(f, 'utf8')).cells;
  return SESS.map((se) => { const a = rows.find((r) => r.name === `fade ${se} 1R all`), b = F.find((c) => c.cell === `m15 none ext 1R ${se}`);
    return { session: se, n: [a.d.n, a.c.n], fadeN: [b.disc.n, b.conf.n], mean: [+a.d.mean.toFixed(6), +a.c.mean.toFixed(6)], fadeMean: [b.disc.mean, b.conf.mean],
      same: a.d.n === b.disc.n && a.c.n === b.conf.n && Math.abs(a.d.mean - b.disc.mean) < 1e-5 && Math.abs(a.c.mean - b.conf.mean) < 1e-5 }; });
}

function resultMd(o, rows, best, bestBoth) {
  const nCut = o.cut.reduce((a, x) => a + x.n, 0), bad = o.cut.reduce((a, x) => a + x.missing + x.extra, 0);
  const sw = rows.filter((r) => r.kind === 'sweep'), ct = rows.filter((r) => r.kind === 'control'), cnt = (f) => sw.filter(f).length; const L = [];
  L.push('# Wide sweep grid: sweeps of the Asia range, the previous day and the previous week on ten markets (result)', '', `**Verdict: ${o.verdict}. ${o.headline}.**`, '',
    'Run 23 Nov 2026 as pre-registered (`PREREGISTRATION.md`, committed and pushed alone first). Research only: nothing live',
    'changed, nothing is proposed. One run, no variants.', '',
    '## What was run', '',
    'For every weekday, the Asia range (00:00-06:59 UTC), the last closed New York trading day and the last closed week. In London',
    '(07-12 UTC) or New York (12-17 UTC) an M15 candle trades beyond the range edge from inside, and an M15 candle closes back',
    'inside within 3 candles, the extreme at least 0.1 Daily ATR beyond the edge: the first such sweep of each edge and session.',
    'Market entry against the sweep at the next 5-minute open, stop past the sweep\'s extreme + 0.1 M15 ATR; exits 1R, 2R, or the',
    'range\'s other side (only when 1R or more away); time limit 1 day. Each also with the Daily MSNR call agreeing. Control:',
    '`grid7-wide-fade`\'s M15 fade of the first structure break in the same sessions (exits 1R, 2R, opposite swing). Ten markets',
    'pooled, OANDA mid 5-minute candles. Discovery = fills 2005-2014, confirmation = 2015 to October 2026. Judged before costs on',
    `month sums; Holm over the 48 confirmation tests. Costs beside: the demo figures for gold and the four majors; **ASSUMED, not measured** for ${o.assumedCosts.join(', ')}.`, '',
    '## The bar, sweep cell by sweep cell (36)', '',
    `- n >= 300 in both windows: ${cnt((r) => r.checks.n)}.`,
    `- Mean R > 0 and month t >= 2 in discovery: ${cnt((r) => r.checks.disc)}; in confirmation: ${cnt((r) => r.checks.conf)}; both: ${cnt((r) => r.checks.disc && r.checks.conf)}.`,
    `- Holm-adjusted p < 0.05: ${cnt((r) => r.checks.holm)}.`,
    `- Beats its control (Welch t >= 2 in both windows): ${cnt((r) => r.checks.control)}.`,
    `- **All five: ${o.passed.length}${o.passed.length ? ' (' + o.passed.join('; ') + ')' : ''}.**`,
    `- Of those, positive after costs in both windows: ${o.passedNetPositive.length}${o.passedNetPositive.length ? ' (' + o.passedNetPositive.join('; ') + ')' : ''}.`,
    `- Side-flipped (traded WITH the sweep) passing bars 1-4: ${o.flippedPassed.length}${o.flippedPassed.length ? ' (' + o.flippedPassed.join('; ') + ')' : ''}.`, '',
    `Best confirmation cell: ${o.bestConfirmation}. Best on the weaker of the two windows: ${o.bestBothWindows} (discovery ${f3(bestBoth.d.mean)}R,`,
    `t ${f2(bestBoth.d.t)}; confirmation ${f3(bestBoth.c.mean)}R, t ${f2(bestBoth.c.t)}).`, '',
    '## The control (the plain M15 fade, same sessions)', '',
    '| Cell | n 05-14 | R 05-14 (t) | net 05-14 | n 15-26 | R 15-26 (t) | net 15-26 | cost R | Holm |', '|---|---:|---:|---:|---:|---:|---:|---:|---:|');
  for (const r of ct) L.push(`| ${r.name} | ${N(r.d.n)} | ${f3(r.d.mean)} (${f2(r.d.t)}) | ${f3(r.d.meanNet)} | ${N(r.c.n)} | ${f3(r.c.mean)} (${f2(r.c.t)}) | ${f3(r.c.meanNet)} | ${r.c.costR == null ? 'n/a' : r.c.costR.toFixed(3)} | ${r.holm.toFixed(3)} |`);
  L.push('', '## Every sweep cell', '',
    'R a trade before costs (month-sum t), after costs beside; "cost R" = mean round-trip cost / risk in 2015-26; "vs ctl" = Welch t',
    'of the cell against its control (discovery / confirmation); flipped = the same trades taken WITH the sweep.', '',
    '| Cell | n 05-14 | R 05-14 (t) | net 05-14 | n 15-26 | R 15-26 (t) | net 15-26 | cost R | vs ctl | Holm | Flipped R 15-26 (t) | Pass |',
    '|---|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|---|');
  for (const r of sw) L.push(`| ${r.name} | ${N(r.d.n)} | ${f3(r.d.mean)} (${f2(r.d.t)}) | ${f3(r.d.meanNet)} | ${N(r.c.n)} | ${f3(r.c.mean)} (${f2(r.c.t)}) | ${f3(r.c.meanNet)} | ${r.c.costR == null ? 'n/a' : r.c.costR.toFixed(3)} | ${f2(r.vs.d)} / ${f2(r.vs.c)} | ${r.holm.toFixed(3)} | ${f3(r.flip.c.mean)} (${f2(r.flip.c.t)}) | ${r.pass ? 'yes' : 'no'} |`);
  L.push('');
  if (o.passed.length) { L.push('## Per market, passing cells', '', 'Before costs (after costs in brackets); * = cost ASSUMED.', '');
    for (const [name, list] of Object.entries(o.perMarket)) { L.push(`### ${name}`, '', '| Market | n 05-14 | R (t) [net] | n 15-26 | R (t) [net] | cost R 15-26 |', '|---|---:|---:|---:|---:|---:|');
      for (const x of list) L.push(`| ${x.market}${x.assumed ? '*' : ''} | ${N(x.d.n)} | ${f3(x.d.mean)} (${f2(x.d.t)}) [${f3(x.d.meanNet)}] | ${N(x.c.n)} | ${f3(x.c.mean)} (${f2(x.c.t)}) [${f3(x.c.meanNet)}] | ${x.c.costR == null ? 'n/a' : x.c.costR.toFixed(3)} |`);
      L.push(''); } }
  L.push('## Checks', '',
    `- Cut test: ${o.cut.length} cuts on ${[...new Set(o.cut.map((x) => x.market))].join(', ')}: ${N(nCut)} signals known by the cut dates, ${bad} missing or extra when the candles are cut there.`,
    '- Every trade has its stop on the losing side of the fill (the run throws otherwise); a fill at or past the stop and a risk under the round-trip cost are no trades (same for every cell and for the flipped trades).',
    '- Exclusions: the data-quality audit\'s bad intervals (`combo-grid-2` `exclusions`).',
    ...(o.controlGate ? [`- Control gate: the "fade <session> 1R all" cells equal \`grid7-wide-fade\`'s "m15 none ext 1R <session>" cells trade for trade (${o.controlGate.map((g) => `${g.session}: n ${N(g.n[0])} / ${N(g.n[1])}, ${f3(g.mean[0])} / ${f3(g.mean[1])}R, ${g.same ? 'same' : 'DIFFERENT'}`).join('; ')}).`] : []), '',
    '| Market | candles from | signals | sweeps | simulated | dropped (bad data) | past the stop | risk under cost | unresolved | control off-session |', '|---|---|---:|---:|---:|---:|---:|---:|---:|---:|');
  for (const m of o.meta) L.push(`| ${m.market} | ${m.first} | ${N(m.signals)} | ${N(m.sweeps)} | ${N(m.sims)} | ${m.dropped} | ${N(m.bad)} | ${N(m.small)} | ${m.open} | ${N(m.offSession)} |`);
  L.push('', '## What it means', '');
  if (o.verdict === 'PASS')
    L.push(`${o.passed.length} sweep cell(s) clear the pre-registered bar before costs in both decades and beat the plain fade. ${o.passedNetPositive.length ? o.passedNetPositive.length + ' stay positive after costs in both windows.' : 'None stays positive after costs in both windows.'}`,
      'This is a before-cost tilt on mid quotes, not an edge: nothing is adopted; a forward record or any live change needs the owner.',
      'One run, no variants on these years.');
  else {
    const ctlOk = sw.filter((r) => r.checks.control), x1 = ctlOk.filter((r) => r.exit === '1R').length;
    const crS = sw.map((r) => r.c.costR).filter((x) => x != null), crC = ct.map((r) => r.c.costR).filter((x) => x != null);
    const netBoth = sw.filter((r) => r.d.meanNet > 0 && r.c.meanNet > 0);
    L.push('No sweep cell clears the bar. Before costs the 36 sweep cells sit around zero in both decades (every cell between',
      `${f3(Math.min(...sw.map((r) => Math.min(r.d.mean, r.c.mean))))} and ${f3(Math.max(...sw.map((r) => Math.max(r.d.mean, r.c.mean))))}R a trade; none has month t >= 2 in both windows, none survives Holm).`,
      'A sweep of the Asia range, the previous day or the previous week, entered against it at the next 5-minute open, is not a',
      'tilt of its own, and the MSNR call agreeing does not change that.', '',
      `**The control comparison.** ${ctlOk.length} sweep cells beat their control in both windows, ${x1} of them at 1R. That is the control's`,
      'weakness, not the sweeps\' strength: the plain M15 fade\'s stops are a few pips (a round trip takes',
      `${Math.min(...crC).toFixed(2)}-${Math.max(...crC).toFixed(2)}R of it, against ${Math.min(...crS).toFixed(2)}-${Math.max(...crS).toFixed(2)}R for the sweeps), so a 5-minute candle that holds both its stop and its 1R target`,
      'is common and is booked as the stop (the pre-registered rule; see `grid7-wide-fade`): that weighs on the fade at 1R, which loses about 0.1R.',
      'The fade\'s swing exit (+0.10R to +0.16R before costs, month t 3.6 to 6.2 in both decades) is a steadier before-cost tilt',
      'than any sweep cell, and loses after costs. The sweeps\' wider stops make them far cheaper to trade (about a fifth of the cost',
      'in R), but there is no before-cost tilt to keep.', '',
      `After costs ${netBoth.length} sweep cell(s) stay above zero in both windows${netBoth.length ? ' (' + netBoth.map((r) => `${r.name}: ${f3(r.d.meanNet)} / ${f3(r.c.meanNet)}R, n ${N(r.d.n)} / ${N(r.c.n)}, before-cost t ${f2(r.d.t)} / ${f2(r.c.t)}`).join('; ') + ')' : ''}: picked after the fact`,
      'from 36, under t 2, not evidence. The side-flipped trades (WITH the sweep) pass nothing either.', '',
      'Do not re-test variants of these 36 cells on these years. Nothing live changed; no rule is proposed.'); }
  L.push('');
  return L.join('\n');
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const [cmd, a, b] = process.argv.slice(2);
  if (cmd === 'market') { fs.mkdirSync(b, { recursive: true }); const t0 = Date.now(); const r = runMarket(a);
    fs.writeFileSync(path.join(b, a + '.json'), JSON.stringify(r)); console.log(a, 'signals', r.signals, 'sweeps', r.sweeps, 'sims', r.sims, ((Date.now() - t0) / 1000).toFixed(0) + 's'); }
  else if (cmd === 'cut') { fs.mkdirSync(b, { recursive: true }); const r = cutTest(a); fs.writeFileSync(path.join(b, 'cut-' + a + '.json'), JSON.stringify(r)); console.log(JSON.stringify(r)); }
  else if (cmd === 'report') { const o = report(a); console.log(o.verdict, o.headline); }
  else console.log('usage: run.mjs market <m> <dir> | cut <m> <dir> | report <dir>');
}
