// research/edge/grid7-wide-core/run.mjs - the wide core grid of PREREGISTRATION.md (23 Nov 2026): 96 cells (6 level families x
// 2 level timeframes x 2 triggers x 2 exits, with and without the Daily MSNR call agreeing), ten markets, discovery 2005-14,
// confirmation 2015 to Oct 2026, judged before costs on month sums. Research only: nothing live imports it, nothing is placed.
//   EDGE_DATA=<cache> node research/edge/grid7-wide-core/run.mjs market <m> <outDir>   one market's accumulators
//   EDGE_DATA=<cache> node research/edge/grid7-wide-core/run.mjs cut <m> <outDir>      the cut test of one market
//   node research/edge/grid7-wide-core/run.mjs report <outDir>                         result.json + RESULT.md
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import * as K from '../_lib/edgekit.mjs';
import { frames, buildZones } from '../combo-grid-3/run.mjs';
import { sdZones } from '../grid5-sd-eg/run.mjs';
import { COSTS, exclusions } from '../combo-grid-2/run.mjs';
import { atr14, startIdx } from '../dom-trade-through/run.mjs';
import { direction } from '../../../council/eg-methods.mjs';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const y = (Y, M = 0) => Date.UTC(Y, M, 1) / 1000;
export const MARKETS = ['xau', 'xag', 'eurusd', 'gbpusd', 'usdjpy', 'audusd', 'nzdusd', 'usdcad', 'usdchf', 'eurjpy'];
export const ASSUMED = ['xag', 'nzdusd', 'usdcad', 'usdchf', 'eurjpy'];
export const FAMS = ['eg', 'ef', 'dom', 'av', 'sd', 'none'], LVLS = ['1d', '4h'], TRIGS = ['break', 'box'], EXITS = ['1R', '2R'], CALLS = ['all', 'agree'];
export const TBELOW = { '1d': '1h', '4h': '15m' }, CAP = { '1d': 2 * 86400, '4h': 86400 };
export const WIN = 24, ATRK = 0.1, KSW = 2;
export const FROM = y(2005), SPLIT = y(2015), TO = y(2026, 10);   // fills 2005-01-01 .. 2026-10-31
export const NM = 262, DM = 120;                                   // months 2005-01 .. 2026-10; discovery 0..119
export const NCELL = 96;
export const cellIndex = (c, f, l, tr, x) => (((c * 6 + f) * 2 + l) * 2 + tr) * 2 + x;
export function cellName(i) { const x = i % 2; i = (i - x) / 2; const tr = i % 2; i = (i - tr) / 2; const l = i % 2; i = (i - l) / 2; const f = i % 6; const c = (i - f) / 6;
  return { call: CALLS[c], fam: FAMS[f], lvl: LVLS[l], trig: TRIGS[tr], exit: EXITS[x], c, f, l, tr, x }; }
export const controlOf = (i) => { const n = cellName(i); return cellIndex(n.c, 5, n.l, n.tr, n.x); };
export const monthOf = (t) => { const d = new Date(t * 1000); return (d.getUTCFullYear() - 2005) * 12 + d.getUTCMonth(); };

const conv = (B) => B.map((b) => ({ time: b.t, open: b.o, high: b.h, low: b.l, close: b.c }));
// the Daily MSNR call of each closed 1d candle, 1w key levels (combo-grid-3's msnrCalls for 1d)
export function dailyCalls(F) {
  const A = F['1w']; const keyOf = (t) => { const k = K.barAt(A, t); return k < 0 ? t : A[k].t; };
  return direction(conv(F['1d']), keyOf, 604800).call;
}
function zonesOf(fam, L) {
  if (fam === 'sd') return sdZones(L).map((z) => ({ d: z.d, bot: z.lo, top: z.hi, at: z.at, end: z.end }));
  return buildZones(fam, L).map((z) => ({ d: z.d, bot: z.bot, top: z.top, at: z.at, end: z.end }));
}

// ---- signals (closed candles only) ------------------------------------------------------------------------------------
// [{ f, l, tr, s, j, tt (trigger candle start), ts (its close), stop, call }] for every family (f = 5: the control)
export function signals(F) {
  const out = [], calls = dailyCalls(F), D = F['1d'];
  const callAt = (t) => { const i = K.closedCount(D, t) - 1; return i >= 0 ? calls[i] : 0; };
  LVLS.forEach((lv, l) => {
    const L = F[lv], T = F[TBELOW[lv]], atr = atr14(T);
    // trigger events by candle index: [break, box] = { dir, raw }
    const trig = [new Map(), new Map()];
    for (const e of K.structure(T, KSW).events) { let raw = e.dir > 0 ? Infinity : -Infinity;
      for (let q = e.from; q <= e.i; q++) raw = e.dir > 0 ? Math.min(raw, T[q].l) : Math.max(raw, T[q].h);
      trig[0].set(e.i, { dir: e.dir, raw }); }
    for (const b of K.boxesHL(T, KSW)) if (b.dir && b.bi >= 0) trig[1].set(b.bi, { dir: b.dir, raw: b.dir > 0 ? b.lo : b.hi });
    const push = (f, tr, j, ev) => { const s = ev.dir, a = atr[j]; if (!(a > 0)) return;
      out.push({ f, l, tr, s, j, tt: T[j].t, ts: T[j].e, stop: ev.raw - s * ATRK * a, call: callAt(T[j].e) }); };
    // (f) the control: every trigger event
    for (let tr = 0; tr < 2; tr++) for (const [j, ev] of trig[tr]) push(5, tr, j, ev);
    // (a)-(e): the first touch of each zone, then the first trigger of its side within WIN trigger candles
    for (let f = 0; f < 5; f++) for (const z of zonesOf(FAMS[f], L)) {
      let k = startIdx(T, z.at);
      while (k < T.length && T[k].t < z.end && !(T[k].l <= z.top && T[k].h >= z.bot)) k++;
      if (k >= T.length || T[k].t >= z.end) continue;
      for (let tr = 0; tr < 2; tr++) for (let j = k; j < k + WIN && j < T.length && T[j].e < z.end; j++) {
        const ev = trig[tr].get(j); if (ev && ev.dir === z.d) { push(f, tr, j, ev); break; } }
    }
  });
  return out;
}

// ---- one trade: 1R and 2R in one pass (market fill at the open of candle fi; stop first in a candle that holds both) -------
export function exits(M5, s, fi, stop, cap) {
  const fill = M5[fi].o, risk = s * (fill - stop); if (!(risk > 0)) return null;
  const tg = [fill + s * risk, fill + 2 * s * risk], R = [NaN, NaN], dl = M5[fi].t + cap; let left = 2;
  const fin = (k, px) => { if (Number.isNaN(R[k])) { R[k] = (s * (px - fill)) / risk; left--; } };
  for (let j = fi; j < M5.length && left; j++) { const b = M5[j];
    if (j > fi) { if (s * (b.o - stop) <= 0) { fin(0, b.o); fin(1, b.o); } else for (let k = 0; k < 2; k++) if (s * (b.o - tg[k]) >= 0) fin(k, b.o); }
    const low = s > 0 ? b.l : b.h, high = s > 0 ? b.h : b.l;
    if (s * (low - stop) <= 0) { fin(0, stop); fin(1, stop); }
    for (let k = 0; k < 2; k++) if (s * (high - tg[k]) >= 0) fin(k, tg[k]);
    if (b.e >= dl) { fin(0, b.c); fin(1, b.c); } }
  return left ? null : { fill, risk, R };
}

const inBad = (X, t) => { let lo = 0, hi = X.length; while (lo < hi) { const m = (lo + hi) >> 1; if (X[m][0] <= t) lo = m + 1; else hi = m; } return lo > 0 && t <= X[lo - 1][1]; };
function newAcc() { return { ms: new Float64Array(NCELL * NM), msNet: new Float64Array(NCELL * NM), n: new Float64Array(NCELL * 2), sum: new Float64Array(NCELL * 2),
  sq: new Float64Array(NCELL * 2), net: new Float64Array(NCELL * 2), win: new Float64Array(NCELL * 2) }; }
function add(A, c, w, m, R, cr) { A.ms[c * NM + m] += R; A.msNet[c * NM + m] += R - cr; A.n[c * 2 + w]++; A.sum[c * 2 + w] += R; A.sq[c * 2 + w] += R * R; A.net[c * 2 + w] += R - cr; if (R > 0) A.win[c * 2 + w]++; }

export function runMarket(market) {
  const M5 = K.load(market, '5m', { from: '2004-01-01', to: '2026-11-01' }); const F = frames(M5);
  const sigs = signals(F), cost = COSTS[market], X = exclusions(market);
  const real = newAcc(), plac = newAcc(), seen = new Set(); let dropped = 0, bad = 0, small = 0, sims = 0;
  for (const g of sigs) {
    const key = g.f + '|' + g.l + '|' + g.tr + '|' + g.j + '|' + g.s; if (seen.has(key)) continue; seen.add(key);
    const fi = startIdx(M5, g.ts); if (fi >= M5.length) continue; const t = M5[fi].t; if (t < FROM || t >= TO) continue;
    if (X.length && inBad(X, t)) { dropped++; continue; }
    const fill = M5[fi].o, risk = g.s * (fill - g.stop); if (!(risk > 0)) { bad++; continue; }
    if (risk < cost) { small++; continue; }
    const cap = CAP[LVLS[g.l]], r = exits(M5, g.s, fi, g.stop, cap), p = exits(M5, -g.s, fi, fill + g.s * risk, cap); sims++;
    if (!r || !p) continue;
    if (!(g.s * (fill - g.stop) > 0)) throw new Error('stop on the wrong side');
    const m = monthOf(t), w = t < SPLIT ? 0 : 1, cr = cost / risk;
    for (let x = 0; x < 2; x++) for (let c = 0; c < 2; c++) { if (c === 1 && g.call !== g.s) continue;
      const ci = cellIndex(c, g.f, g.l, g.tr, x); add(real, ci, w, m, r.R[x], cr); add(plac, ci, w, m, p.R[x], cr); }
  }
  const J = (A) => Object.fromEntries(Object.entries(A).map(([k, v]) => [k, Array.from(v, (z) => +z.toFixed(6))]));
  return { market, cost, assumed: ASSUMED.includes(market), first: M5.length ? M5[0].t : null, last: M5.length ? M5[M5.length - 1].t : null,
    signals: sigs.length, sims, dropped, bad, small, real: J(real), plac: J(plac) };
}

// ---- cut test: the signals known by a date, computed on candles cut there, equal the full run's ---------------------------
export function cutTest(market, cuts = ['2008-06-11', '2012-03-14', '2016-09-21', '2021-02-17', '2025-05-07']) {
  const M5 = K.load(market, '5m', { from: '2004-01-01', to: '2026-11-01' });
  const key = (g) => [g.f, g.l, g.tr, g.tt, g.s, g.stop.toFixed(8), g.call].join('|');
  const full = signals(frames(M5)); const out = [];
  for (const c of cuts) { const T = Date.parse(c + 'T00:00:00Z') / 1000;
    const cut = signals(frames(M5.filter((b) => b.e <= T))).filter((g) => g.ts <= T).map(key);
    const want = full.filter((g) => g.ts <= T).map(key); const A = new Set(cut), B = new Set(want);
    out.push({ market, cut: c, n: B.size, missing: [...B].filter((k) => !A.has(k)).length, extra: [...A].filter((k) => !B.has(k)).length }); }
  return out;
}

// ---- pooled statistics ----------------------------------------------------------------------------------------------------
export function mstat(ms, a, b) { const n = b - a; let s = 0, q = 0; for (let m = a; m < b; m++) { s += ms[m]; q += ms[m] * ms[m]; }
  const mean = s / n, sd = Math.sqrt(Math.max(0, (q - n * mean * mean) / (n - 1))); return { months: n, t: sd > 0 ? mean / (sd / Math.sqrt(n)) : 0 }; }
export const p1 = (t, df) => { const p = K.pFromT(t, df); return p == null ? 1 : t > 0 ? p / 2 : 1 - p / 2; };
export function welch(a, b) { // a, b: { n, sum, sq }
  if (a.n < 2 || b.n < 2) return null; const ma = a.sum / a.n, mb = b.sum / b.n;
  const va = (a.sq - a.n * ma * ma) / (a.n - 1), vb = (b.sq - b.n * mb * mb) / (b.n - 1); const se = Math.sqrt(va / a.n + vb / b.n);
  return se > 0 ? (ma - mb) / se : null; }
export function pool(list, kind = 'real') { const A = newAcc(); for (const d of list) { const S = d[kind]; for (const k of Object.keys(A)) for (let i = 0; i < A[k].length; i++) A[k][i] += S[k][i]; } return A; }
export function cellStats(A, c) {
  const ms = A.ms.subarray(c * NM, (c + 1) * NM), msn = A.msNet.subarray(c * NM, (c + 1) * NM);
  const win = (w) => { const n = A.n[c * 2 + w], a = w ? DM : 0, b = w ? NM : DM;
    return { n, mean: n ? A.sum[c * 2 + w] / n : null, t: mstat(ms, a, b).t, meanNet: n ? A.net[c * 2 + w] / n : null, tNet: mstat(msn, a, b).t,
      win: n ? A.win[c * 2 + w] / n : null, months: b - a, sum: A.sum[c * 2 + w], sq: A.sq[c * 2 + w] }; };
  return { d: win(0), c: win(1) };
}
export function judge(data) {
  const R = pool(data, 'real'), P = pool(data, 'plac'); const rows = [];
  for (let c = 0; c < NCELL; c++) { const s = cellStats(R, c), ps = cellStats(P, c), cs = cellStats(R, controlOf(c)), nm = cellName(c);
    const isCtl = nm.f === 5;
    const vs = isCtl ? null : { d: welch(s.d, cs.d), c: welch(s.c, cs.c) };
    rows.push({ cell: c, ...nm, d: s.d, c: s.c, p: p1(s.c.t, s.c.months - 1), ctl: isCtl ? null : { d: cs.d, c: cs.c }, vs, plac: { d: ps.d, c: ps.c, p: p1(ps.c.t, ps.c.months - 1) } }); }
  const H = K.holm(rows.map((r) => r.p)), HP = K.holm(rows.map((r) => r.plac.p));
  const ok3 = (x, h) => x.d.n >= 300 && x.c.n >= 300 && x.d.mean > 0 && x.c.mean > 0 && x.d.t >= 2 && x.c.t >= 2 && h < 0.05;
  rows.forEach((r, i) => { r.holm = H[i]; r.plac.holm = HP[i];
    r.checks = { n: r.d.n >= 300 && r.c.n >= 300, disc: r.d.mean > 0 && r.d.t >= 2, conf: r.c.mean > 0 && r.c.t >= 2, holm: H[i] < 0.05,
      control: !!(r.vs && r.vs.d >= 2 && r.vs.c >= 2) };
    r.pass = r.f !== 5 && Object.values(r.checks).every(Boolean); r.plac.pass = ok3(r.plac, HP[i]); });
  return rows;
}

const f3 = (x) => (x == null ? 'n/a' : (x >= 0 ? '+' : '-') + Math.abs(x).toFixed(3)), f2 = (x) => (x == null ? 'n/a' : x.toFixed(2)), N = (x) => Math.round(x).toLocaleString('en-US');
const cname = (r) => `${r.fam} ${r.lvl} ${r.trig} ${r.exit}${r.call === 'agree' ? ' +MSNR' : ''}`;
const slim = (w) => ({ n: w.n, mean: w.mean == null ? null : +w.mean.toFixed(6), t: +w.t.toFixed(6), meanNet: w.meanNet == null ? null : +w.meanNet.toFixed(6), tNet: +w.tNet.toFixed(2),
  win: w.win == null ? null : +w.win.toFixed(3) });

export function report(dir) {
  const data = MARKETS.map((m) => JSON.parse(fs.readFileSync(path.join(dir, m + '.json'), 'utf8')));
  const cut = MARKETS.flatMap((m) => { const f = path.join(dir, 'cut-' + m + '.json'); return fs.existsSync(f) ? JSON.parse(fs.readFileSync(f, 'utf8')) : []; });
  const rows = judge(data), pass = rows.filter((r) => r.pass), plPass = rows.filter((r) => r.plac.pass);
  const verdict = pass.length ? 'PASS' : 'FAIL';
  const zr = rows.filter((r) => r.f !== 5);
  const bestC = [...zr].sort((a, b) => b.c.t - a.c.t)[0], bestBoth = [...zr].sort((a, b) => Math.min(b.d.t, b.c.t) - Math.min(a.d.t, a.c.t))[0];
  const tot = (w) => { let n = 0, s = 0; for (const r of rows.filter((x) => x.call === 'all' && x.exit === '1R')) { n += r[w].n; s += r[w].mean * r[w].n; } return { n, mean: s / n }; };
  const perMarket = {}; for (const r of pass) perMarket[r.cell] = data.map((d) => { const A = pool([d]); const s = cellStats(A, r.cell); return { market: d.market, d: slim(s.d), c: slim(s.c) }; });
  const headline = verdict === 'PASS'
    ? `${pass.length} of 96 cells pass the pre-registered bar: best ${cname(pass[0])}, ${f3(pass[0].c.mean)}R a trade in 2015-26 (n ${N(pass[0].c.n)}, month t ${f2(pass[0].c.t)})`
    : `0 of 96 cells pass; the best confirmation cell, ${cname(bestC)}, made ${f3(bestC.c.mean)}R a trade before costs in 2015-26 (n ${N(bestC.c.n)}, month t ${f2(bestC.c.t)}; discovery ${f3(bestC.d.mean)}R, t ${f2(bestC.d.t)})`;
  const RW = rows.map((r) => ({ cell: cname(r), call: r.call, fam: r.fam, lvl: r.lvl, trig: r.trig, exit: r.exit, disc: slim(r.d), conf: slim(r.c), holm: +r.holm.toFixed(4),
    vsControl: r.vs ? { d: r.vs.d == null ? null : +r.vs.d.toFixed(2), c: r.vs.c == null ? null : +r.vs.c.toFixed(2) } : null, checks: r.checks, pass: r.pass,
    placebo: { disc: slim(r.plac.d), conf: slim(r.plac.c), holm: +r.plac.holm.toFixed(4), pass: r.plac.pass } }));
  const out = { study: 'grid7-wide-core', built: '2026-11-23', verdict, headline, basis: 'judged before costs on calendar-month sums (pre-registered); after costs beside',
    windows: { discovery: '2005-01-01 to 2014-12-31 (120 months)', confirmation: '2015-01-01 to 2026-10-31 (142 months)' }, markets: MARKETS,
    assumedCosts: ASSUMED, costs: Object.fromEntries(data.map((d) => [d.market, d.cost])),
    meta: data.map((d) => ({ market: d.market, first: new Date(d.first * 1000).toISOString().slice(0, 10), last: new Date(d.last * 1000).toISOString().slice(0, 10),
      signals: d.signals, sims: d.sims, dropped: d.dropped, bad: d.bad, small: d.small })),
    passed: pass.map(cname), placeboPassed: plPass.map(cname), bestConfirmation: cname(bestC), bestBothWindows: cname(bestBoth),
    pooledAll1R: { disc: tot('d'), conf: tot('c') }, cut, cells: RW, perMarket };
  fs.writeFileSync(path.join(HERE, 'result.json'), JSON.stringify(out, null, 1) + '\n');
  fs.writeFileSync(path.join(HERE, 'RESULT.md'), resultMd(out, rows, bestC, bestBoth));
  return out;
}

function resultMd(o, rows, bestC, bestBoth) {
  const vline = `**Verdict: ${o.verdict}. ${o.headline}.**`;
  const nCut = o.cut.reduce((a, x) => a + x.n, 0), bad = o.cut.reduce((a, x) => a + x.missing + x.extra, 0);
  const cnt = (f) => rows.filter(f).length;
  const L = [];
  L.push('# Wide core grid: 96 cells on ten markets (result)', '', vline, '',
    'Run 23 Nov 2026 as pre-registered (`PREREGISTRATION.md`, committed and pushed alone first). Research only: nothing live',
    'changed, nothing is proposed. One run, no variants.', '',
    '## What was run', '',
    'Six level families on the Daily or H4 chart (engulf zone, failed engulf traded the other way, dominant zone, V / A turn of',
    'the closes, fresh supply / demand, and a control with no level), first touch only; then on the timeframe two steps lower',
    '(Daily -> H1, H4 -> M15) the first structure break or box close-out with the level\'s side within 24 candles; market entry at',
    'the next 5-minute open, stop past the trigger\'s swing + 0.1 ATR, a 1R or 2R target (time limit 2 days / 1 day). The same 48',
    'cells again with the Daily MSNR call agreeing: 96. Ten markets pooled (xau, xag, eurusd, gbpusd, usdjpy, audusd, nzdusd,',
    'usdcad, usdchf, eurjpy), OANDA mid 5-minute candles. Discovery = fills 2005-2014, confirmation = 2015 to October 2026.',
    `Costs after the fact only: the demo figures for gold and the four majors; **ASSUMED, not measured** for ${o.assumedCosts.join(', ')}.`, '',
    '## The bar, cell by cell', '',
    `- n >= 300 in both windows: ${cnt((r) => r.checks.n)} of 96.`,
    `- Mean R > 0 and month t >= 2 in discovery: ${cnt((r) => r.checks.disc)}; in confirmation: ${cnt((r) => r.checks.conf)}; both: ${cnt((r) => r.checks.disc && r.checks.conf)}.`,
    `- Holm-adjusted p < 0.05 over the 96 confirmation tests: ${cnt((r) => r.checks.holm)}.`,
    `- Beats its own control (Welch t >= 2 in both windows): ${cnt((r) => r.checks.control)} of 80.`,
    `- **All four (a level family, not the control): ${o.passed.length}${o.passed.length ? ' (' + o.passed.join('; ') + ')' : ''}.**`,
    `- Side-flipped placebo passing bars 1-3: ${o.placeboPassed.length}${o.placeboPassed.length ? ' (' + o.placeboPassed.join('; ') + ')' : ''}.`, '',
    `Best confirmation cell: ${o.bestConfirmation}. Best on the weaker of the two windows: ${o.bestBothWindows} (discovery`,
    `${f3(bestBoth.d.mean)}R, t ${f2(bestBoth.d.t)}; confirmation ${f3(bestBoth.c.mean)}R, t ${f2(bestBoth.c.t)}).`, '',
    `All cells without the MSNR condition at 1R, pooled (trades counted once per cell): discovery ${f3(o.pooledAll1R.disc.mean)}R a trade over`,
    `${N(o.pooledAll1R.disc.n)} cell-trades, confirmation ${f3(o.pooledAll1R.conf.mean)}R over ${N(o.pooledAll1R.conf.n)}.`, '',
    '## Every cell', '',
    'R a trade before costs (month-sum t), after costs beside; "vs ctl" = Welch t of the cell against its control (discovery /',
    'confirmation); Holm on the confirmation test.', '',
    '| Cell | n 05-14 | R 05-14 (t) | net 05-14 | n 15-26 | R 15-26 (t) | net 15-26 | vs ctl | Holm | Placebo R 15-26 (t) | Pass |',
    '|---|---:|---:|---:|---:|---:|---:|---:|---:|---:|---|');
  for (const r of rows) L.push(`| ${cname(r)} | ${N(r.d.n)} | ${f3(r.d.mean)} (${f2(r.d.t)}) | ${f3(r.d.meanNet)} | ${N(r.c.n)} | ${f3(r.c.mean)} (${f2(r.c.t)}) | ${f3(r.c.meanNet)} | ${r.vs ? f2(r.vs.d) + ' / ' + f2(r.vs.c) : 'control'} | ${r.holm.toFixed(3)} | ${f3(r.plac.c.mean)} (${f2(r.plac.c.t)}) | ${r.pass ? 'yes' : 'no'} |`);
  L.push('');
  if (o.passed.length) { L.push('## Per market, passing cells', ''); for (const [c, list] of Object.entries(o.perMarket)) { L.push(`### ${cname(rows[c])}`, '', '| Market | n 05-14 | R (t) | n 15-26 | R (t) |', '|---|---:|---:|---:|---:|');
    for (const x of list) L.push(`| ${x.market} | ${N(x.d.n)} | ${f3(x.d.mean)} (${f2(x.d.t)}) | ${N(x.c.n)} | ${f3(x.c.mean)} (${f2(x.c.t)}) |`); L.push(''); } }
  L.push('## Checks', '',
    `- Cut test: ${o.cut.length} cuts on ${[...new Set(o.cut.map((x) => x.market))].join(', ')}: ${N(nCut)} signals known by the cut dates, ${bad} missing or extra when the candles are cut there.`,
    '- Every trade has its stop on the losing side of the fill (the run throws otherwise); fills at or past the stop and trades whose risk is under the round-trip cost are no trades (same for every cell).',
    '- Exclusions: the data-quality audit\'s bad intervals (`combo-grid-2` `exclusions`).', '',
    '| Market | candles from | signals | simulated | dropped (bad data) | past the stop | risk under cost |', '|---|---|---:|---:|---:|---:|---:|');
  for (const m of o.meta) L.push(`| ${m.market} | ${m.first} | ${N(m.signals)} | ${N(m.sims)} | ${m.dropped} | ${m.bad} | ${N(m.small)} |`);
  L.push('', '## What it means', '');
  if (o.verdict === 'PASS') L.push('A passing cell is a candidate for its own forward record and an owner decision, nothing more: it is not adopted, and never called an edge before a forward record.');
  else L.push('No core family, read this simply, beats its own control on ten markets over 22 years. With this many trades a real',
    'tilt of a few hundredths of an R would have shown: the level families do not pick better triggers than the triggers alone.',
    'Do not re-test variants of these 96 cells on these years. Nothing live changed; no rule is proposed.');
  const pp = rows.filter((r) => r.plac.pass);
  if (pp.length) { const big = [...pp].sort((a, b) => b.plac.c.n - a.plac.c.n)[0];
    L.push('', `**The placebo.** ${pp.length} side-flipped cells clear bars 1-3, mostly the H4 (M15-trigger) controls. With a 1R exit the`,
      'flipped trade is the mirror of the real one (its stop is the real target, its target the real stop), so this says only that',
      'the real trades lose a few hundredths of an R before costs: buying the next 5-minute open after an M15 break or box',
      `close-out gives some of it back. It is not a fade rule: after costs the flipped trades lose too (${cname(big)} flipped:`,
      `${f3(big.plac.c.mean)}R before costs, t ${f2(big.plac.c.t)}; ${f3(big.plac.c.meanNet)}R after costs, t ${f2(big.plac.c.tNet)}, n ${N(big.plac.c.n)} in 2015-26).`,
      'The pre-registration expected about nothing here; it is reported as found, and it is not a candidate (a placebo is not a rule).'); }
  L.push('');
  return L.join('\n');
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const [cmd, a, b] = process.argv.slice(2);
  if (cmd === 'market') { fs.mkdirSync(b, { recursive: true }); const t0 = Date.now(); const r = runMarket(a);
    fs.writeFileSync(path.join(b, a + '.json'), JSON.stringify(r)); console.log(a, 'signals', r.signals, 'sims', r.sims, ((Date.now() - t0) / 1000).toFixed(0) + 's'); }
  else if (cmd === 'cut') { fs.mkdirSync(b, { recursive: true }); const r = cutTest(a); fs.writeFileSync(path.join(b, 'cut-' + a + '.json'), JSON.stringify(r)); console.log(JSON.stringify(r)); }
  else if (cmd === 'report') { const o = report(a); console.log(o.verdict, o.headline); }
  else console.log('usage: run.mjs market <m> <dir> | cut <m> <dir> | report <dir>');
}
