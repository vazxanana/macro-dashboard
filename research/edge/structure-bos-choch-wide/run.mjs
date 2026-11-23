// research/edge/structure-bos-choch-wide/run.mjs - the study of PREREGISTRATION.md (23 Nov 2026): structure breaks on M15 / H1 /
// H4 split by kind (BOS / ChoCh), by the BOS count of the leg and by the next timeframe up; entries WITH the break, FADED, and on
// the RETEST of the broken level; 51 cells, ten markets, discovery 2005-14, confirmation 2015 to Oct 2026, judged before costs on
// month sums, each cell against the plain grid7-wide-fade rule (fade every break, ext stop) on the same timeframe and exit.
// Research only: nothing live imports it, nothing is placed.
//   EDGE_DATA=<cache> node research/edge/structure-bos-choch-wide/run.mjs market <m> <outDir>
//   EDGE_DATA=<cache> node research/edge/structure-bos-choch-wide/run.mjs cut <m> <outDir>
//   node research/edge/structure-bos-choch-wide/run.mjs report <outDir>
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import * as K from '../_lib/edgekit.mjs';
import { frames } from '../combo-grid-3/run.mjs';
import { COSTS, exclusions } from '../combo-grid-2/run.mjs';
import { atr14, startIdx } from '../dom-trade-through/run.mjs';
import { MARKETS, ASSUMED, FROM, SPLIT, TO, NM, DM, monthOf, mstat, p1, welch } from '../grid7-wide-core/run.mjs';
import { exits } from '../grid7-wide-fade/run.mjs';

export { MARKETS, ASSUMED };
const HERE = path.dirname(fileURLToPath(import.meta.url));
export const TFS = ['15m', '1h', '4h'], TFN = ['m15', 'h1', 'h4'], LOWER = { '15m': '5m', '1h': '15m', '4h': '1h' }, UPPER = { '15m': '1h', '1h': '4h', '4h': '1d' };
export const ENTRIES = ['with', 'fade', 'retest'], KINDS = ['BOS', 'ChoCh'], EXITS = ['1R', '2R'], COUNTS = ['1st', '2nd', '3rd+'], HTF = ['with', 'against'];
export const KSW = 3, ATRK = 0.1, TOUCH_WIN = 24, CONF_WIN = 12, CAP = { '15m': 86400, '1h': 2 * 86400, '4h': 5 * 86400 };
export const NA = 36, NB = 9, NC = 6, NCELL = NA + NB + NC, NCTL = 6;
export const cellA = (tf, en, kd, x) => ((tf * 3 + en) * 2 + kd) * 2 + x;
export const cellB = (en, cnt) => NA + en * 3 + cnt;
export const cellC = (en, h) => NA + NB + en * 2 + h;
export const ctlOf = (tf, x) => tf * 2 + x;
export function cellName(i) {
  if (i < NA) { const x = i % 2; let r = (i - x) / 2; const kd = r % 2; r = (r - kd) / 2; const en = r % 3; const tf = (r - en) / 3;
    return { part: 'A', tf: TFN[tf], tfi: tf, entry: ENTRIES[en], split: KINDS[kd], exit: EXITS[x], xi: x, name: `${TFN[tf]} ${ENTRIES[en]} ${KINDS[kd]} ${EXITS[x]}` }; }
  if (i < NA + NB) { const j = i - NA, cnt = j % 3, en = (j - cnt) / 3;
    return { part: 'B', tf: 'all', tfi: -1, entry: ENTRIES[en], split: 'bos-' + COUNTS[cnt], exit: '1R', xi: 0, name: `all ${ENTRIES[en]} bos-${COUNTS[cnt]} 1R` }; }
  const j = i - NA - NB, h = j % 2, en = (j - h) / 2;
  return { part: 'C', tf: 'all', tfi: -1, entry: ENTRIES[en], split: 'htf-' + HTF[h], exit: '1R', xi: 0, name: `all ${ENTRIES[en]} htf-${HTF[h]} 1R` };
}

// edgekit structure() events with the opposite swing standing at each break and the BOS count of the leg; the events (i, dir,
// kind, level) must equal edgekit's (checked by the test).
export function breaks(bars, Ksw = KSW) {
  const sw = K.swings(bars, Ksw).sort((a, b) => a.ci - b.ci || a.i - b.i); const ev = [];
  let H = null, L = null, s = 0, k = 0, cnt = 0;
  for (let j = 0; j < bars.length; j++) {
    while (k < sw.length && sw[k].ci < j) { const x = sw[k++]; if (x.type === 'H') H = x; else L = x; }
    const c = bars[j].c; let e = null;
    if (H && c > H.price) { e = { i: j, t: bars[j].e, dir: 1, kind: s === 1 ? 'BO' : 'ChoCh', level: H.price, opp: L ? L.price : null }; s = 1; H = null; }
    else if (L && c < L.price) { e = { i: j, t: bars[j].e, dir: -1, kind: s === -1 ? 'BO' : 'ChoCh', level: L.price, opp: H ? H.price : null }; s = -1; L = null; }
    if (e) { cnt = e.kind === 'BO' ? cnt + 1 : 0; e.cnt = e.kind === 'BO' ? cnt : 0; ev.push(e); }
  }
  return ev;
}

// ---- signals (closed candles only) --------------------------------------------------------------------------------------
// { tf, en, kd (0 BOS, 1 ChoCh), cnt (0 1st, 1 2nd, 2 3rd+, -1 ChoCh), h (0 with, 1 against, -1 none), d (break direction),
//   s (trade side), ts (time from which the fill is taken), stop }
export function signals(F) {
  const out = [];
  TFS.forEach((tfk, tf) => {
    const T = F[tfk], atr = atr14(T), ev = breaks(T), U = F[UPPER[tfk]], uside = K.structure(U, KSW).side, Lw = F[LOWER[tfk]];
    const secT = K.TF[tfk];
    for (const e of ev) {
      const a = atr[e.i]; if (!(a > 0)) continue; const b = T[e.i];
      const kd = e.kind === 'BO' ? 0 : 1, cnt = kd ? -1 : Math.min(e.cnt, 3) - 1;
      const ui = K.closedCount(U, b.e) - 1, us = ui >= 0 ? uside[ui] : 0, h = us === 0 ? -1 : us === e.dir ? 0 : 1;
      const base = { tf, kd, cnt, h, d: e.dir, brk: b.e };
      // (b) fade: stop past the break candle's extreme
      out.push({ ...base, en: 1, s: -e.dir, ts: b.e, stop: (e.dir > 0 ? b.h : b.l) + e.dir * ATRK * a });
      if (e.opp == null) continue;
      const stopW = e.opp - e.dir * ATRK * a;
      // (a) with: stop past the opposite swing
      out.push({ ...base, en: 0, s: e.dir, ts: b.e, stop: stopW });
      // (c) retest on the timeframe one step lower
      let k = startIdx(Lw, b.e); const touchEnd = b.e + TOUCH_WIN * secT; let touch = -1;
      for (; k < Lw.length && Lw[k].t < touchEnd; k++) {
        const c = Lw[k];
        if (e.dir * (c.c - e.opp) < 0) break;                                           // closed beyond the opposite swing: cancelled
        if (e.dir > 0 ? c.l <= e.level : c.h >= e.level) { touch = k; break; }
      }
      if (touch < 0) continue;
      for (let q = touch; q < Lw.length && q < touch + CONF_WIN; q++) {
        const c = Lw[q];
        if (e.dir * (c.c - e.opp) < 0) break;
        if (e.dir * (c.c - e.level) > 0 && e.dir * (c.c - c.o) > 0) { out.push({ ...base, en: 2, s: e.dir, ts: c.e, stop: stopW }); break; }
      }
    }
  });
  return out;
}

const inBad = (X, t) => { let lo = 0, hi = X.length; while (lo < hi) { const m = (lo + hi) >> 1; if (X[m][0] <= t) lo = m + 1; else hi = m; } return lo > 0 && t <= X[lo - 1][1]; };
function newAcc(n) { return { ms: new Float64Array(n * NM), msNet: new Float64Array(n * NM), n: new Float64Array(n * 2), sum: new Float64Array(n * 2),
  sq: new Float64Array(n * 2), net: new Float64Array(n * 2), win: new Float64Array(n * 2), cr: new Float64Array(n * 2) }; }
function add(A, c, w, m, R, cr) { A.ms[c * NM + m] += R; A.msNet[c * NM + m] += R - cr; A.n[c * 2 + w]++; A.sum[c * 2 + w] += R; A.sq[c * 2 + w] += R * R;
  A.net[c * 2 + w] += R - cr; A.cr[c * 2 + w] += cr; if (R > 0) A.win[c * 2 + w]++; }

export function runMarket(market) {
  const M5 = K.load(market, '5m', { from: '2004-01-01', to: '2026-11-01' }); const F = frames(M5);
  const sigs = signals(F), cost = COSTS[market], X = exclusions(market);
  const cells = newAcc(NCELL), ctl = newAcc(NCTL); let dropped = 0, bad = 0, small = 0, sims = 0, open = 0;
  const byEn = [0, 0, 0];
  for (const g of sigs) {
    const fi = startIdx(M5, g.ts); if (fi >= M5.length) continue; const t = M5[fi].t; if (t < FROM || t >= TO) continue;
    if (X.length && inBad(X, t)) { dropped++; continue; }
    const s = g.s, fill = M5[fi].o, risk = s * (fill - g.stop);
    if (!(risk > 0)) { bad++; continue; }
    if (risk < cost) { small++; continue; }
    if (!(s * (fill - g.stop) > 0)) throw new Error('stop on the wrong side');
    const r = exits(M5, s, fi, g.stop, [fill + s * risk, fill + 2 * s * risk], CAP[TFS[g.tf]]); sims++;
    if (!r) { open++; continue; }
    byEn[g.en]++;
    const m = monthOf(t), w = t < SPLIT ? 0 : 1, cr = cost / risk;
    for (let x = 0; x < 2; x++) {
      add(cells, cellA(g.tf, g.en, g.kd, x), w, m, r.R[x], cr);
      if (g.en === 1) add(ctl, ctlOf(g.tf, x), w, m, r.R[x], cr);
    }
    if (g.cnt >= 0) add(cells, cellB(g.en, g.cnt), w, m, r.R[0], cr);
    if (g.h >= 0) add(cells, cellC(g.en, g.h), w, m, r.R[0], cr);
  }
  const J = (A) => Object.fromEntries(Object.entries(A).map(([k, v]) => [k, Array.from(v, (z) => +z.toFixed(6))]));
  return { market, cost, assumed: ASSUMED.includes(market), first: M5.length ? M5[0].t : null, last: M5.length ? M5[M5.length - 1].t : null,
    signals: sigs.length, sims, dropped, bad, small, open, byEntry: byEn, cells: J(cells), control: J(ctl) };
}

// ---- cut test: the signals known by a date, computed on candles cut there, equal the full run's ---------------------------
export function cutTest(market, cuts = ['2008-06-11', '2012-03-14', '2016-09-21', '2021-02-17', '2025-05-07']) {
  const M5 = K.load(market, '5m', { from: '2004-01-01', to: '2026-11-01' });
  const key = (g) => [g.tf, g.en, g.kd, g.cnt, g.h, g.ts, g.d, g.stop.toFixed(8)].join('|');
  const full = signals(frames(M5)); const out = [];
  for (const c of cuts) { const T = Date.parse(c + 'T00:00:00Z') / 1000;
    const cut = signals(frames(M5.filter((b) => b.e <= T))).filter((g) => g.ts <= T).map(key);
    const want = full.filter((g) => g.ts <= T).map(key); const A = new Set(cut), B = new Set(want);
    out.push({ market, cut: c, n: B.size, missing: [...B].filter((k) => !A.has(k)).length, extra: [...A].filter((k) => !B.has(k)).length }); }
  return out;
}

// ---- pooled statistics ----------------------------------------------------------------------------------------------------
export function pool(list, kind) { const n = kind === 'cells' ? NCELL : NCTL; const A = newAcc(n);
  for (const d of list) { const S = d[kind]; for (const k of Object.keys(A)) for (let i = 0; i < A[k].length; i++) A[k][i] += S[k][i]; } return A; }
// stats of one row (or the sum of several rows) of an accumulator
export function rowStats(A, idx) {
  const L = Array.isArray(idx) ? idx : [idx]; const ms = new Float64Array(NM), msn = new Float64Array(NM);
  for (const c of L) for (let m = 0; m < NM; m++) { ms[m] += A.ms[c * NM + m]; msn[m] += A.msNet[c * NM + m]; }
  const tot = (k, w) => L.reduce((a, c) => a + A[k][c * 2 + w], 0);
  const win = (w) => { const n = tot('n', w), a = w ? DM : 0, b = w ? NM : DM;
    return { n, sum: tot('sum', w), sq: tot('sq', w), mean: n ? tot('sum', w) / n : null, t: mstat(ms, a, b).t, meanNet: n ? tot('net', w) / n : null,
      tNet: mstat(msn, a, b).t, win: n ? tot('win', w) / n : null, costR: n ? tot('cr', w) / n : null, months: b - a }; };
  return { d: win(0), c: win(1) };
}
export const controlRows = (i) => { const n = cellName(i); return n.tfi >= 0 ? [ctlOf(n.tfi, n.xi)] : [0, 1, 2].map((tf) => ctlOf(tf, 0)); };
export function judge(data) {
  const C = pool(data, 'cells'), T = pool(data, 'control'); const rows = [];
  for (let i = 0; i < NCELL; i++) { const s = rowStats(C, i), k = rowStats(T, controlRows(i));
    rows.push({ cell: i, ...cellName(i), d: s.d, c: s.c, p: p1(s.c.t, s.c.months - 1), ctl: k, wd: welch(s.d, k.d) ?? 0, wc: welch(s.c, k.c) ?? 0 }); }
  const H = K.holm(rows.map((r) => r.p));
  rows.forEach((r, i) => { r.holm = H[i];
    r.checks = { n: r.d.n >= 300 && r.c.n >= 300, disc: r.d.mean > 0 && r.d.t >= 2, conf: r.c.mean > 0 && r.c.t >= 2, holm: H[i] < 0.05, control: r.wd >= 2 && r.wc >= 2 };
    r.pass = Object.values(r.checks).every(Boolean); });
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
  const best = [...rows].sort((a, b) => b.c.t - a.c.t)[0], bestPass = [...pass].sort((a, b) => b.c.t - a.c.t)[0], b = bestPass || best;
  const perMarket = {}; for (const r of pass) perMarket[r.name] = data.map((d) => { const s = rowStats(pool([d], 'cells'), r.cell); return { market: d.market, assumed: d.assumed, d: slim(s.d), c: slim(s.c) }; });
  const headline = verdict === 'PASS'
    ? `${pass.length} of ${NCELL} cells pass before costs; best ${b.name}, ${f3(b.c.mean)}R a trade in 2015-26 (n ${N(b.c.n)}, month t ${f2(b.c.t)}; against its control Welch t ${f2(b.wc)}), ${f3(b.c.meanNet)}R after costs`
    : `0 of ${NCELL} cells pass; the best confirmation cell, ${b.name}, made ${f3(b.c.mean)}R a trade before costs in 2015-26 (n ${N(b.c.n)}, month t ${f2(b.c.t)}; against its control Welch t ${f2(b.wc)}), ${f3(b.c.meanNet)}R after costs`;
  const RW = rows.map((r) => ({ cell: r.name, part: r.part, tf: r.tf, entry: r.entry, split: r.split, exit: r.exit, disc: slim(r.d), conf: slim(r.c),
    holm: +r.holm.toFixed(4), welchDisc: +r.wd.toFixed(2), welchConf: +r.wc.toFixed(2), control: { disc: slim(r.ctl.d), conf: slim(r.ctl.c) }, checks: r.checks, pass: r.pass }));
  const out = { study: 'structure-bos-choch-wide', built: '2026-11-23', verdict, headline,
    basis: 'judged before costs on calendar-month sums and against the plain fade control (pre-registered); after costs beside',
    windows: { discovery: '2005-01-01 to 2014-12-31 (120 months)', confirmation: '2015-01-01 to 2026-10-31 (142 months)' }, markets: data.map((d) => d.market),
    assumedCosts: ASSUMED, costs: Object.fromEntries(data.map((d) => [d.market, d.cost])),
    meta: data.map((d) => ({ market: d.market, first: new Date(d.first * 1000).toISOString().slice(0, 10), last: new Date(d.last * 1000).toISOString().slice(0, 10),
      signals: d.signals, sims: d.sims, dropped: d.dropped, bad: d.bad, small: d.small, open: d.open, byEntry: d.byEntry })),
    passed: pass.map((r) => r.name), bestConfirmation: best.name, passedNetPositive: pass.filter((r) => r.d.meanNet > 0 && r.c.meanNet > 0).map((r) => r.name),
    beforeCostBar: rows.filter((r) => r.checks.n && r.checks.disc && r.checks.conf && r.checks.holm).map((r) => r.name),
    cut, cells: RW, perMarket };
  fs.writeFileSync(path.join(HERE, 'result.json'), JSON.stringify(out, null, 1) + '\n');
  fs.writeFileSync(path.join(HERE, 'RESULT.md'), resultMd(out, rows));
  return out;
}

function resultMd(o, rows) {
  const nCut = o.cut.reduce((a, x) => a + x.n, 0), bad = o.cut.reduce((a, x) => a + x.missing + x.extra, 0);
  const cnt = (f) => rows.filter(f).length; const L = [];
  L.push('# Structure breaks by kind: BOS against ChoCh, three entries, ten markets (result)', '', `**Verdict: ${o.verdict}. ${o.headline}.**`, '',
    'Run 23 Nov 2026 as pre-registered (`PREREGISTRATION.md`, committed and pushed alone first). Research only: nothing live',
    'changed, nothing is proposed. One run, no variants.', '',
    '## What was run', '',
    'Every structure break (a close beyond the last confirmed swing, 3 candles a side; `edgekit` `structure`) on M15, H1 or H4,',
    'labelled BOS (with the structure side before it) or ChoCh (the first break against it), with the BOS count of its leg and',
    'the structure side of the next timeframe up (M15 -> H1, H1 -> H4, H4 -> D1). Entries: WITH the break at the next 5-minute',
    'open (stop past the opposite swing + 0.1 ATR), FADED (stop past the break candle\'s extreme + 0.1 ATR), and on the RETEST',
    '(price back to the broken level on the timeframe one step lower, then a close back beyond it in the break\'s direction;',
    'stop as WITH). Exits 1R / 2R, time limit 1 / 2 / 5 days. 36 cells by kind per timeframe, 9 by BOS count and 6 by the next',
    'timeframe up (timeframes pooled, 1R): 51. Ten markets pooled, OANDA mid 5-minute candles; discovery = fills 2005-2014,',
    'confirmation = 2015 to October 2026. Judged before costs on month sums, Holm over the 51 confirmation tests, and each cell',
    'against its control (the plain `grid7-wide-fade` rule: fade every break, ext stop, same timeframe and exit) by a per-trade',
    `Welch t >= 2 in both windows. Costs beside; **ASSUMED, not measured** for ${o.assumedCosts.join(', ')}.`, '',
    '## The bar, cell by cell', '',
    `- n >= 300 in both windows: ${cnt((r) => r.checks.n)} of ${rows.length}.`,
    `- Mean R > 0 and month t >= 2 in discovery: ${cnt((r) => r.checks.disc)}; in confirmation: ${cnt((r) => r.checks.conf)}; both: ${cnt((r) => r.checks.disc && r.checks.conf)}.`,
    `- Holm-adjusted p < 0.05: ${cnt((r) => r.checks.holm)}.`,
    `- First four checks together (the before-cost bar without the control): ${o.beforeCostBar.length}${o.beforeCostBar.length ? ' (' + o.beforeCostBar.join('; ') + ')' : ''}.`,
    `- Beats its control (Welch t >= 2 in both windows): ${cnt((r) => r.checks.control)}.`,
    `- **All five: ${o.passed.length}${o.passed.length ? ' (' + o.passed.join('; ') + ')' : ''}.**`,
    `- Of those, positive after costs in both windows: ${o.passedNetPositive.length}${o.passedNetPositive.length ? ' (' + o.passedNetPositive.join('; ') + ')' : ''}.`, '',
    '## Every cell', '',
    'R a trade before costs (month-sum t), after costs beside; "cost R" = mean round-trip cost / risk in 2015-26; control = the',
    'plain fade rule on the same timeframe and exit (pooled timeframes for parts B and C); Welch = cell against control, per trade.', '',
    '| Cell | n 05-14 | R 05-14 (t) | net 05-14 | n 15-26 | R 15-26 (t) | net 15-26 | cost R | Holm | control R 05-14 / 15-26 | Welch 05-14 / 15-26 | Pass |',
    '|---|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|---|');
  for (const r of rows) L.push(`| ${r.name} | ${N(r.d.n)} | ${f3(r.d.mean)} (${f2(r.d.t)}) | ${f3(r.d.meanNet)} | ${N(r.c.n)} | ${f3(r.c.mean)} (${f2(r.c.t)}) | ${f3(r.c.meanNet)} | ${r.c.costR == null ? 'n/a' : r.c.costR.toFixed(3)} | ${r.holm.toFixed(3)} | ${f3(r.ctl.d.mean)} / ${f3(r.ctl.c.mean)} | ${f2(r.wd)} / ${f2(r.wc)} | ${r.pass ? 'yes' : 'no'} |`);
  L.push('');
  if (o.passed.length) { L.push('## Per market, passing cells', '', 'Before costs (after costs in brackets); * = cost ASSUMED.', '');
    for (const [name, list] of Object.entries(o.perMarket)) { L.push(`### ${name}`, '', '| Market | n 05-14 | R (t) [net] | n 15-26 | R (t) [net] | cost R 15-26 |', '|---|---:|---:|---:|---:|---:|');
      for (const x of list) L.push(`| ${x.market}${x.assumed ? '*' : ''} | ${N(x.d.n)} | ${f3(x.d.mean)} (${f2(x.d.t)}) [${f3(x.d.meanNet)}] | ${N(x.c.n)} | ${f3(x.c.mean)} (${f2(x.c.t)}) [${f3(x.c.meanNet)}] | ${x.c.costR == null ? 'n/a' : x.c.costR.toFixed(3)} |`);
      L.push(''); } }
  L.push('## Checks', '',
    `- Cut test: ${o.cut.length} cuts on ${[...new Set(o.cut.map((x) => x.market))].join(', ') || 'none'}: ${N(nCut)} signals known by the cut dates, ${bad} missing or extra when the candles are cut there.`,
    '- Every trade has its stop on the losing side of the fill (the run throws otherwise); a fill at or past the stop and a risk under the round-trip cost are no trades.',
    '- Exclusions: the data-quality audit\'s bad intervals (`combo-grid-2` `exclusions`).', '',
    '| Market | candles from | signals | simulated (with / fade / retest kept) | dropped (bad data) | past the stop | risk under cost | unresolved |', '|---|---|---:|---:|---:|---:|---:|---:|');
  for (const m of o.meta) L.push(`| ${m.market} | ${m.first} | ${N(m.signals)} | ${N(m.sims)} (${m.byEntry.map(N).join(' / ')}) | ${m.dropped} | ${N(m.bad)} | ${N(m.small)} | ${m.open} |`);
  L.push('', '## What it means', '');
  if (o.verdict === 'PASS') {
    L.push(`${o.passed.length} cells clear the whole pre-registered bar before costs. ${o.passedNetPositive.length ? o.passedNetPositive.length + ' of them stay positive after costs in both windows.' : 'None stays positive after costs in both windows: the bid / ask takes more than the tilt.'}`,
      'A before-cost result is a tilt, not an edge; nothing is adopted, and a forward record or a live change needs the owner.');
  } else {
    L.push('No cell clears the whole bar. Naming a break BOS or ChoCh, counting the BOS of the leg, checking the next timeframe up,',
      'or waiting for the retest does not give a trade that makes money before costs in both decades AND beats simply fading every',
      'break. Do not re-test variants of these 51 cells on these years. Nothing live changed; no rule is proposed.');
    const beat = rows.filter((r) => r.checks.control), tilt = rows.filter((r) => r.checks.n && r.checks.disc && r.checks.conf && r.checks.holm);
    if (tilt.length) L.push('', `The only cells positive before costs in both decades (${tilt.map((r) => r.name).join('; ')}) are FADES at 2R: the`,
      '`grid7-wide-fade` tilt again. Split by kind they are no better than fading every break (Welch t under 2 in at least one window),',
      `and after costs they lose (${tilt.map((r) => f3(r.c.meanNet) + 'R').join(', ')} a trade in 2015-26).`);
    if (beat.length) L.push('', `The cells that beat their control in both windows (${beat.map((r) => r.name).join('; ')}) lose money before costs`,
      'themselves; they only lose less than fading every break at 1R does.');
  }
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
