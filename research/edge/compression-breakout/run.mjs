// research/edge/compression-breakout/run.mjs - the compression breakout study of PREREGISTRATION.md (23 Nov 2026): a close
// out of a tight M15 / H1 range (n8, n16, inside), traded WITH the break and FADED, against the ordinary first structure break
// (grid7-wide-fade's trigger) as control; 56 cells, ten markets, discovery 2005-14, confirmation 2015 to Oct 2026, judged
// before costs on month sums. Research only: nothing live imports it, nothing is placed.
//   EDGE_DATA=<cache> node research/edge/compression-breakout/run.mjs market <m> <outDir>
//   EDGE_DATA=<cache> node research/edge/compression-breakout/run.mjs cut <m> <outDir>
//   node research/edge/compression-breakout/run.mjs report <outDir>
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import * as K from '../_lib/edgekit.mjs';
import { frames } from '../combo-grid-3/run.mjs';
import { COSTS, exclusions } from '../combo-grid-2/run.mjs';
import { atr14, startIdx } from '../dom-trade-through/run.mjs';
import { MARKETS, ASSUMED, FROM, SPLIT, TO, NM, DM, monthOf, mstat, p1, welch } from '../grid7-wide-core/run.mjs';
import { breaks, sessionOf } from '../grid7-wide-fade/run.mjs';

export { MARKETS, ASSUMED };
const HERE = path.dirname(fileURLToPath(import.meta.url));
export const TFS = ['15m', '1h'], TFN = ['m15', 'h1'], COMPS = ['n8', 'n16', 'inside'], DIRS = ['with', 'fade'], EXITS = ['1R', '2R', 'trail'];
export const SPLITS = ['london', 'ny', 'other', 'dlow', 'dhigh'];
export const BOXK = 1.5, ATRK = 0.1, DAYK = 0.5, CAP = { '15m': 86400, '1h': 2 * 86400 };
export const NA = 36, NCELL = 56, NCTRL = 32;
export const cellA = (tf, cp, dr, x) => ((tf * 3 + cp) * 2 + dr) * 3 + x;
export const cellB = (tf, dr, sp) => NA + (tf * 2 + dr) * 5 + sp;
export const ctrlA = (tf, dr, x) => (tf * 2 + dr) * 3 + x;
export const ctrlB = (tf, dr, sp) => 12 + (tf * 2 + dr) * 5 + sp;
export const controlOf = (i) => { if (i < NA) { const x = i % 3; let r = (i - x) / 3; const dr = r % 2; r = (r - dr) / 2; const tf = Math.floor(r / 3); return ctrlA(tf, dr, x); }
  const j = i - NA, sp = j % 5, r = (j - sp) / 5, dr = r % 2, tf = (r - dr) / 2; return ctrlB(tf, dr, sp); };
export function cellName(i) {
  if (i < NA) { const x = i % 3; let r = (i - x) / 3; const dr = r % 2; r = (r - dr) / 2; const cp = r % 3; const tf = (r - cp) / 3;
    return { tf: TFN[tf], comp: COMPS[cp], dir: DIRS[dr], exit: EXITS[x], split: 'all', name: `${TFN[tf]} ${COMPS[cp]} ${DIRS[dr]} ${EXITS[x]} all` }; }
  const j = i - NA, sp = j % 5, r = (j - sp) / 5, dr = r % 2, tf = (r - dr) / 2;
  return { tf: TFN[tf], comp: 'n8', dir: DIRS[dr], exit: '2R', split: SPLITS[sp], name: `${TFN[tf]} n8 ${DIRS[dr]} 2R ${SPLITS[sp]}` };
}
export function ctrlName(i) {
  if (i < 12) { const x = i % 3, r = (i - x) / 3, dr = r % 2, tf = (r - dr) / 2; return `${TFN[tf]} break ${DIRS[dr]} ${EXITS[x]} all`; }
  const j = i - 12, sp = j % 5, r = (j - sp) / 5, dr = r % 2, tf = (r - dr) / 2; return `${TFN[tf]} break ${DIRS[dr]} 2R ${SPLITS[sp]}`;
}

// ---- compression events on one timeframe (closed candles only; candle j's close is the event) ------------------------------
// { j, d, ts, hi, lo } ; hi / lo = the box. After an event the next box must start after candle j.
export function compressions(T, atr, comp) {
  const out = []; let after = -1;
  const N = comp === 'n8' ? 8 : comp === 'n16' ? 16 : 0;
  for (let j = 1; j < T.length; j++) {
    let hi, lo, start;
    if (N) { start = j - N; if (start < 0 || start <= after) continue;
      const a = atr[j - 1]; if (!(a > 0)) continue;
      hi = -Infinity; lo = Infinity; for (let i = start; i < j; i++) { if (T[i].h > hi) hi = T[i].h; if (T[i].l < lo) lo = T[i].l; }
      if (!(hi - lo < BOXK * a)) continue; }
    else { start = j - 4; if (start < 0 || start <= after) continue; const m = T[start];
      let ok = true; for (let i = j - 3; i < j; i++) if (T[i].h > m.h || T[i].l < m.l) { ok = false; break; }
      if (!ok) continue; hi = m.h; lo = m.l; }
    const c = T[j].c, d = c > hi ? 1 : c < lo ? -1 : 0; if (!d) continue;
    out.push({ j, d, ts: T[j].e, hi, lo }); after = j;
  }
  return out;
}

// ---- signals: kind 0..2 = compression, 3 = control (ordinary break) ----------------------------------------------------------
// { tf, kind, j, d, ts, ext (break candle extreme), a (ATR at j), other (box side / opposite swing, null = none) }
export function signals(F) {
  const out = [];
  TFS.forEach((tfk, tf) => {
    const T = F[tfk], atr = atr14(T);
    const push = (kind, j, d, other) => { const a = atr[j]; if (!(a > 0)) return; const b = T[j];
      out.push({ tf, kind, j, d, ts: b.e, ext: d > 0 ? b.h : b.l, a, other }); };
    COMPS.forEach((cp, k) => { for (const e of compressions(T, atr, cp)) push(k, e.j, e.d, e.d > 0 ? e.lo : e.hi); });
    for (const e of breaks(T)) push(3, e.i, e.dir, e.opp);
  });
  return out;
}

// ---- one trade: R at 1R, 2R and the 1R trail from +1R, one pass. null = unresolved at data end. ----------------------------
export function sim(M5, s, fi, stop, cap) {
  const fill = M5[fi].o, risk = s * (fill - stop); if (!(risk > 0)) return null;
  const tg = [fill + s * risk, fill + 2 * s * risk], R = [NaN, NaN, NaN], dl = M5[fi].t + cap;
  let left = 3, ts = stop, best = fill;
  const fin = (k, px) => { if (Number.isNaN(R[k])) { R[k] = (s * (px - fill)) / risk; left--; } };
  for (let j = fi; j < M5.length && left; j++) { const b = M5[j];
    if (j > fi) {
      if (s * (b.o - stop) <= 0) { fin(0, b.o); fin(1, b.o); } else for (let k = 0; k < 2; k++) if (s * (b.o - tg[k]) >= 0) fin(k, b.o);
      if (s * (b.o - ts) <= 0) fin(2, b.o);
    }
    const adv = s > 0 ? b.l : b.h, fav = s > 0 ? b.h : b.l;
    if (s * (adv - stop) <= 0) { fin(0, stop); fin(1, stop); }
    if (s * (adv - ts) <= 0) fin(2, ts);
    for (let k = 0; k < 2; k++) if (s * (fav - tg[k]) >= 0) fin(k, tg[k]);
    if (b.e >= dl) { fin(0, b.c); fin(1, b.c); fin(2, b.c); }
    if (s * (fav - best) > 0) best = fav;
    if (s * (best - fill) >= risk) { const nt = best - s * risk; if (s * (nt - ts) > 0) ts = nt; }
  }
  return left ? null : R;
}

// running high-low of the current 17:00 New York day, per 5-minute candle (including it)
export function dayRanges(M5, D) {
  const dr = new Float64Array(M5.length); let k = 0, hi = -Infinity, lo = Infinity;
  for (let i = 0; i < M5.length; i++) { let moved = false; while (k + 1 < D.length && M5[i].t >= D[k + 1].t) { k++; moved = true; }
    if (moved || i === 0) { hi = -Infinity; lo = Infinity; }
    if (M5[i].h > hi) hi = M5[i].h; if (M5[i].l < lo) lo = M5[i].l; dr[i] = hi - lo; }
  return dr;
}

const inBad = (X, t) => { let lo = 0, hi = X.length; while (lo < hi) { const m = (lo + hi) >> 1; if (X[m][0] <= t) lo = m + 1; else hi = m; } return lo > 0 && t <= X[lo - 1][1]; };
function newAcc(n) { return { ms: new Float64Array(n * NM), msNet: new Float64Array(n * NM), n: new Float64Array(n * 2), sum: new Float64Array(n * 2),
  sq: new Float64Array(n * 2), net: new Float64Array(n * 2), win: new Float64Array(n * 2), cr: new Float64Array(n * 2) }; }
function add(A, c, w, m, R, cr) { A.ms[c * NM + m] += R; A.msNet[c * NM + m] += R - cr; A.n[c * 2 + w]++; A.sum[c * 2 + w] += R; A.sq[c * 2 + w] += R * R;
  A.net[c * 2 + w] += R - cr; A.cr[c * 2 + w] += cr; if (R > 0) A.win[c * 2 + w]++; }

export function runMarket(market) {
  const M5 = K.load(market, '5m', { from: '2004-01-01', to: '2026-11-01' }); const F = frames(M5);
  const D = F['1d'], dATR = atr14(D), dr = dayRanges(M5, D);
  const sigs = signals(F), cost = COSTS[market], X = exclusions(market);
  const real = newAcc(NCELL), ctrl = newAcc(NCTRL); let dropped = 0, bad = 0, small = 0, sims = 0, open = 0, noOpp = 0;
  const count = [0, 0, 0, 0];
  for (const g of sigs) {
    const fi = startIdx(M5, g.ts); if (fi >= M5.length || fi < 1) continue; const t = M5[fi].t; if (t < FROM || t >= TO) continue;
    if (X.length && inBad(X, t)) { dropped++; continue; }
    const fill = M5[fi].o, cap = CAP[TFS[g.tf]], m = monthOf(t), w = t < SPLIT ? 0 : 1, se = sessionOf(t);
    // daily range so far: 5-minute candles of this NY day closed by the break's close (candle fi-1 ends at g.ts)
    let dsp = -1; const li = fi - 1; if (M5[li].e <= g.ts) { const nc = K.closedCount(D, g.ts), dk = K.barAt(D, M5[li].t);
      if (nc >= 15 && dk >= 0 && D[dk].e > g.ts && dATR[nc - 1] > 0) dsp = dr[li] < DAYK * dATR[nc - 1] ? 3 : 4; }
    count[g.kind]++;
    for (let di = 0; di < 2; di++) {
      const s = di === 0 ? g.d : -g.d;
      let stop;
      if (di === 0) { if (g.other == null) { noOpp++; continue; } stop = g.other - g.d * ATRK * g.a; }
      else stop = g.ext + g.d * ATRK * g.a;
      const risk = s * (fill - stop);
      if (!(risk > 0)) { bad++; continue; }
      if (risk < cost) { small++; continue; }
      if (!(s * (fill - stop) > 0)) throw new Error('stop on the wrong side');
      const r = sim(M5, s, fi, stop, cap); sims++;
      if (!r) { open++; continue; }
      const cr = cost / risk;
      if (g.kind < 3) {
        for (let x = 0; x < 3; x++) add(real, cellA(g.tf, g.kind, di, x), w, m, r[x], cr);
        if (g.kind === 0) { add(real, cellB(g.tf, di, se), w, m, r[1], cr); if (dsp >= 0) add(real, cellB(g.tf, di, dsp), w, m, r[1], cr); }
      } else {
        for (let x = 0; x < 3; x++) add(ctrl, ctrlA(g.tf, di, x), w, m, r[x], cr);
        add(ctrl, ctrlB(g.tf, di, se), w, m, r[1], cr); if (dsp >= 0) add(ctrl, ctrlB(g.tf, di, dsp), w, m, r[1], cr);
      }
    }
  }
  const J = (A) => Object.fromEntries(Object.entries(A).map(([k, v]) => [k, Array.from(v, (z) => +z.toFixed(6))]));
  return { market, cost, assumed: ASSUMED.includes(market), first: M5.length ? M5[0].t : null, last: M5.length ? M5[M5.length - 1].t : null,
    signals: sigs.length, events: { n8: count[0], n16: count[1], inside: count[2], control: count[3] }, sims, dropped, bad, small, noOpp, open,
    real: J(real), ctrl: J(ctrl) };
}

// ---- cut test: the signals known by a date, computed on candles cut there, equal the full run's ---------------------------
export function cutTest(market, cuts = ['2008-06-11', '2012-03-14', '2016-09-21', '2021-02-17', '2025-05-07']) {
  const M5 = K.load(market, '5m', { from: '2004-01-01', to: '2026-11-01' });
  const key = (g) => [g.tf, g.kind, g.ts, g.d, g.ext, g.a.toFixed(10), g.other].join('|');
  const full = signals(frames(M5)); const out = [];
  for (const c of cuts) { const T = Date.parse(c + 'T00:00:00Z') / 1000;
    const cut = signals(frames(M5.filter((b) => b.e <= T))).filter((g) => g.ts <= T).map(key);
    const want = full.filter((g) => g.ts <= T).map(key); const A = new Set(cut), B = new Set(want);
    out.push({ market, cut: c, n: B.size, missing: [...B].filter((k) => !A.has(k)).length, extra: [...A].filter((k) => !B.has(k)).length }); }
  return out;
}

// ---- pooled statistics ----------------------------------------------------------------------------------------------------
export function pool(list, kind, n) { const A = newAcc(n); for (const d of list) { const S = d[kind]; for (const k of Object.keys(A)) for (let i = 0; i < A[k].length; i++) A[k][i] += S[k][i]; } return A; }
export function cellStats(A, c) {
  const ms = A.ms.subarray(c * NM, (c + 1) * NM), msn = A.msNet.subarray(c * NM, (c + 1) * NM);
  const win = (w) => { const n = A.n[c * 2 + w], a = w ? DM : 0, b = w ? NM : DM;
    return { n, mean: n ? A.sum[c * 2 + w] / n : null, t: mstat(ms, a, b).t, meanNet: n ? A.net[c * 2 + w] / n : null, tNet: mstat(msn, a, b).t,
      win: n ? A.win[c * 2 + w] / n : null, costR: n ? A.cr[c * 2 + w] / n : null, months: b - a, sum: A.sum[c * 2 + w], sq: A.sq[c * 2 + w] }; };
  return { d: win(0), c: win(1) };
}
export const passOf = (r) => r.checks.n && r.checks.disc && r.checks.conf && r.checks.holm && r.checks.ctrl;
export function judge(data) {
  const RA = pool(data, 'real', NCELL), CA = pool(data, 'ctrl', NCTRL); const rows = [];
  for (let c = 0; c < NCELL; c++) { const s = cellStats(RA, c), k = controlOf(c), cs = cellStats(CA, k);
    rows.push({ cell: c, ...cellName(c), d: s.d, c: s.c, p: p1(s.c.t, s.c.months - 1), ctrl: { name: ctrlName(k), d: cs.d, c: cs.c },
      wd: welch(s.d, cs.d), wc: welch(s.c, cs.c) }); }
  const H = K.holm(rows.map((r) => r.p));
  rows.forEach((r, i) => { r.holm = H[i];
    r.checks = { n: r.d.n >= 300 && r.c.n >= 300, disc: r.d.mean > 0 && r.d.t >= 2, conf: r.c.mean > 0 && r.c.t >= 2, holm: H[i] < 0.05,
      ctrl: r.wd != null && r.wc != null && r.wd >= 2 && r.wc >= 2 };
    r.pass = passOf(r); });
  return rows;
}

const f3 = (x) => (x == null ? 'n/a' : (x >= 0 ? '+' : '-') + Math.abs(x).toFixed(3)), f2 = (x) => (x == null ? 'n/a' : x.toFixed(2)), N = (x) => Math.round(x).toLocaleString('en-US');
const slim = (w) => ({ n: w.n, mean: w.mean == null ? null : +w.mean.toFixed(6), t: +w.t.toFixed(6), meanNet: w.meanNet == null ? null : +w.meanNet.toFixed(6),
  tNet: +w.tNet.toFixed(2), win: w.win == null ? null : +w.win.toFixed(3), costR: w.costR == null ? null : +w.costR.toFixed(4) });

export function report(dir) {
  const data = MARKETS.filter((m) => fs.existsSync(path.join(dir, m + '.json'))).map((m) => JSON.parse(fs.readFileSync(path.join(dir, m + '.json'), 'utf8')));
  const cut = MARKETS.flatMap((m) => { const f = path.join(dir, 'cut-' + m + '.json'); return fs.existsSync(f) ? JSON.parse(fs.readFileSync(f, 'utf8')) : []; });
  const rows = judge(data), pass = rows.filter((r) => r.pass);
  const verdict = data.length < 8 ? 'INCONCLUSIVE' : pass.length ? 'PASS' : 'FAIL';
  const best = [...rows].sort((a, b) => b.c.t - a.c.t)[0], bestPass = [...pass].sort((a, b) => b.c.t - a.c.t)[0];
  const perMarket = {}; for (const r of pass) perMarket[r.name] = data.map((d) => { const s = cellStats(pool([d], 'real', NCELL), r.cell); return { market: d.market, assumed: d.assumed, d: slim(s.d), c: slim(s.c) }; });
  const b = bestPass || best;
  const headline = verdict === 'PASS'
    ? `${pass.length} of 56 cells pass before costs and beat the ordinary break; best ${b.name}, ${f3(b.c.mean)}R a trade in 2015-26 (n ${N(b.c.n)}, month t ${f2(b.c.t)}; discovery ${f3(b.d.mean)}R, t ${f2(b.d.t)}), ${f3(b.c.meanNet)}R after costs`
    : `0 of 56 cells pass; the best confirmation cell, ${b.name}, made ${f3(b.c.mean)}R a trade before costs in 2015-26 (n ${N(b.c.n)}, month t ${f2(b.c.t)}; discovery ${f3(b.d.mean)}R, t ${f2(b.d.t)}; Welch t against the ordinary break ${f2(b.wd)} / ${f2(b.wc)})`;
  const RW = rows.map((r) => ({ cell: r.name, tf: r.tf, comp: r.comp, dir: r.dir, exit: r.exit, split: r.split, disc: slim(r.d), conf: slim(r.c),
    holm: +r.holm.toFixed(4), control: { cell: r.ctrl.name, disc: slim(r.ctrl.d), conf: slim(r.ctrl.c) },
    welchDisc: r.wd == null ? null : +r.wd.toFixed(2), welchConf: r.wc == null ? null : +r.wc.toFixed(2), checks: r.checks, pass: r.pass }));
  const out = { study: 'compression-breakout', built: '2026-11-23', verdict, headline,
    basis: 'judged before costs on calendar-month sums, Holm over 56, and Welch t >= 2 against the ordinary break in both windows (pre-registered); after costs beside',
    windows: { discovery: '2005-01-01 to 2014-12-31 (120 months)', confirmation: '2015-01-01 to 2026-10-31 (142 months)' }, markets: data.map((d) => d.market),
    assumedCosts: ASSUMED, costs: Object.fromEntries(data.map((d) => [d.market, d.cost])),
    meta: data.map((d) => ({ market: d.market, first: new Date(d.first * 1000).toISOString().slice(0, 10), last: new Date(d.last * 1000).toISOString().slice(0, 10),
      signals: d.signals, events: d.events, sims: d.sims, dropped: d.dropped, bad: d.bad, small: d.small, noOpp: d.noOpp, open: d.open })),
    passed: pass.map((r) => r.name), bestConfirmation: best.name,
    passedNetPositive: pass.filter((r) => r.d.meanNet > 0 && r.c.meanNet > 0).map((r) => r.name),
    cut, cells: RW, perMarket };
  fs.writeFileSync(path.join(HERE, 'result.json'), JSON.stringify(out, null, 1) + '\n');
  fs.writeFileSync(path.join(HERE, 'RESULT.md'), resultMd(out, rows));
  return out;
}

function resultMd(o, rows) {
  const nCut = o.cut.reduce((a, x) => a + x.n, 0), badCut = o.cut.reduce((a, x) => a + x.missing + x.extra, 0);
  const cnt = (f) => rows.filter(f).length; const L = [];
  L.push('# Compression breakout: a break out of a tight range against the ordinary break (result)', '', `**Verdict: ${o.verdict}. ${o.headline}.**`, '',
    'Run 23 Nov 2026 as pre-registered (`PREREGISTRATION.md`, committed and pushed alone first). Research only: nothing live',
    'changed, nothing is proposed. One run, no variants.', '',
    '## What was run', '',
    'A close out of a tight M15 or H1 range: the last 8 (n8) or 16 (n16) closed candles spanning under 1.5 ATR(14), or three',
    'candles inside the one before them (inside). Traded WITH the break (stop past the box\'s other side + 0.1 ATR) and FADED',
    '(stop past the break candle\'s extreme + 0.1 ATR), at market at the next 5-minute open; exits 1R, 2R, or a 1R trail from +1R;',
    'time limit 1 day (M15) / 2 days (H1). 36 cells over all sessions plus 20 splits (n8, 2R: London / New York / other, daily',
    'range so far under / over half the daily ATR): 56. Control = `grid7-wide-fade`\'s ordinary first structure break, same',
    'timeframe, direction, exit and split (with-stop past the opposite swing). Ten markets pooled, OANDA mid 5-minute candles;',
    'discovery 2005-2014, confirmation 2015 to October 2026. Judged before costs.',
    `Costs beside: the demo figures for gold and the four majors; **ASSUMED, not measured** for ${o.assumedCosts.join(', ')}.`, '',
    '## The bar, cell by cell', '',
    `- n >= 300 in both windows: ${cnt((r) => r.checks.n)} of 56.`,
    `- Mean R > 0 and month t >= 2 in discovery: ${cnt((r) => r.checks.disc)}; in confirmation: ${cnt((r) => r.checks.conf)}; both: ${cnt((r) => r.checks.disc && r.checks.conf)}.`,
    `- Holm-adjusted p < 0.05: ${cnt((r) => r.checks.holm)}.`,
    `- Welch t >= 2 against the ordinary break in both windows: ${cnt((r) => r.checks.ctrl)}.`,
    `- **All five: ${o.passed.length}${o.passed.length ? ' (' + o.passed.join('; ') + ')' : ''}.**`,
    `- Of those, positive after costs in both windows: ${o.passedNetPositive.length}.`, '',
    '## Every cell', '',
    'R a trade before costs (month-sum t), after costs ("net") beside; control = the ordinary break, same timeframe, direction,',
    'exit and split; Welch = cell minus control per trade, discovery / confirmation.', '',
    '| Cell | n 05-14 | R 05-14 (t) | net 05-14 | n 15-26 | R 15-26 (t) | net 15-26 | Holm | Control R 05-14 / 15-26 | Welch | Pass |',
    '|---|---:|---:|---:|---:|---:|---:|---:|---:|---:|---|');
  for (const r of rows) L.push(`| ${r.name} | ${N(r.d.n)} | ${f3(r.d.mean)} (${f2(r.d.t)}) | ${f3(r.d.meanNet)} | ${N(r.c.n)} | ${f3(r.c.mean)} (${f2(r.c.t)}) | ${f3(r.c.meanNet)} | ${r.holm.toFixed(3)} | ${f3(r.ctrl.d.mean)} / ${f3(r.ctrl.c.mean)} | ${f2(r.wd)} / ${f2(r.wc)} | ${r.pass ? 'yes' : 'no'} |`);
  L.push('');
  if (o.passed.length) { L.push('## Per market, passing cells', '', 'Before costs (after costs in brackets); * = cost ASSUMED.', '');
    for (const [name, list] of Object.entries(o.perMarket)) { L.push(`### ${name}`, '', '| Market | n 05-14 | R (t) [net] | n 15-26 | R (t) [net] | cost R 15-26 |', '|---|---:|---:|---:|---:|---:|');
      for (const x of list) L.push(`| ${x.market}${x.assumed ? '*' : ''} | ${N(x.d.n)} | ${f3(x.d.mean)} (${f2(x.d.t)}) [${f3(x.d.meanNet)}] | ${N(x.c.n)} | ${f3(x.c.mean)} (${f2(x.c.t)}) [${f3(x.c.meanNet)}] | ${x.c.costR == null ? 'n/a' : x.c.costR.toFixed(3)} |`);
      L.push(''); } }
  L.push('## Checks', '',
    `- Cut test: ${o.cut.length} cuts on ${[...new Set(o.cut.map((x) => x.market))].join(', ')}: ${N(nCut)} signals known by the cut dates, ${badCut} missing or extra when the candles are cut there.`,
    '- Every trade has its stop on the losing side of the fill (the run throws otherwise); a fill at or past the stop and a risk under the round-trip cost are no trades.',
    '- Exclusions: the data-quality audit\'s bad intervals (`combo-grid-2` `exclusions`).', '',
    '| Market | candles from | n8 | n16 | inside | control breaks | simulated | dropped | past the stop | risk under cost | no opposite swing | unresolved |', '|---|---|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|');
  for (const m of o.meta) L.push(`| ${m.market} | ${m.first} | ${N(m.events.n8)} | ${N(m.events.n16)} | ${N(m.events.inside)} | ${N(m.events.control)} | ${N(m.sims)} | ${m.dropped} | ${N(m.bad)} | ${N(m.small)} | ${N(m.noOpp)} | ${m.open} |`);
  L.push('', '## What it means', '');
  if (o.verdict === 'PASS') L.push(`${o.passed.length} cells clear the bar before costs and beat the ordinary break in both decades; ${o.passedNetPositive.length} stay positive after costs in both windows.`,
    'A before-cost tilt, not an edge. Nothing is adopted; a forward record or a live change needs the owner. One run, no variants on these years.');
  else L.push('No compression cell clears the bar: a close out of a tight M15 / H1 range does not behave, before costs and in both decades,',
    'unlike the ordinary first structure break in a way that the pre-registered bar can see. Do not re-test variants of these 56',
    'cells on these years. Nothing live changed; no rule is proposed.');
  L.push('');
  return L.join('\n');
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const [cmd, a, b] = process.argv.slice(2);
  if (cmd === 'market') { fs.mkdirSync(b, { recursive: true }); const t0 = Date.now(); const r = runMarket(a);
    fs.writeFileSync(path.join(b, a + '.json'), JSON.stringify(r)); console.log(a, JSON.stringify(r.events), 'sims', r.sims, ((Date.now() - t0) / 1000).toFixed(0) + 's'); }
  else if (cmd === 'cut') { fs.mkdirSync(b, { recursive: true }); const r = cutTest(a); fs.writeFileSync(path.join(b, 'cut-' + a + '.json'), JSON.stringify(r)); console.log(JSON.stringify(r)); }
  else if (cmd === 'report') { const o = report(a); console.log(o.verdict, o.headline); }
  else console.log('usage: run.mjs market <m> <dir> | cut <m> <dir> | report <dir>');
}
