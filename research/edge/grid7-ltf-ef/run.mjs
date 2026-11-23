// research/edge/grid7-ltf-ef/run.mjs - the failed engulf (EF) on M5 / M15 / H1 of PREREGISTRATION.md (23 Nov 2026): an engulf
// zone (council/eg-methods.mjs zones, 3-candle span) closed through on its far side within K candles of forming, traded the other
// way at market; 54 judged cells, ten markets, discovery 2005-14, confirmation 2015 to Oct 2026, judged before costs on month
// sums and against the plain grid7-wide-fade rule; (b) the engulf traded WITH it, reported. Research only: nothing is placed.
//   EDGE_DATA=<cache> node research/edge/grid7-ltf-ef/run.mjs market <m> <outDir>
//   EDGE_DATA=<cache> node research/edge/grid7-ltf-ef/run.mjs cut <m> <outDir>
//   node research/edge/grid7-ltf-ef/run.mjs report <outDir>
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import * as K from '../_lib/edgekit.mjs';
import { frames } from '../combo-grid-3/run.mjs';
import { COSTS, exclusions } from '../combo-grid-2/run.mjs';
import { atr14, startIdx } from '../dom-trade-through/run.mjs';
import { MARKETS, ASSUMED, FROM, SPLIT, TO, NM, DM, monthOf, mstat, p1, welch } from '../grid7-wide-core/run.mjs';
import { breaks, exits, signals as fadeSignals, CAP } from '../grid7-wide-fade/run.mjs';
import { zones } from '../../../council/eg-methods.mjs';

export { MARKETS, ASSUMED };
const HERE = path.dirname(fileURLToPath(import.meta.url));
export const TFS = ['5m', '15m', '1h'], TFN = ['m5', 'm15', 'h1'], KS = [3, 6, 12], CTXS = ['none', 'brk'], EXITS = ['1R', '2R', 'proj'];
export const ATRK = 0.1, BRKWIN = 24;
export const NA = 54, NB = 18, NCTL = 9, NALL = NA + NB + NCTL;
export const cellA = (tf, k, cx, x) => ((tf * 3 + k) * 2 + cx) * 3 + x;
export const cellB = (tf, cx, x) => NA + (tf * 2 + cx) * 3 + x;
export const cellCtl = (tf, x) => NA + NB + tf * 3 + x;
export function cellName(i) {
  if (i < NA) { const x = i % 3; let r = (i - x) / 3; const cx = r % 2; r = (r - cx) / 2; const k = r % 3; const tf = (r - k) / 3;
    return { part: 'a', tf: TFN[tf], K: KS[k], ctx: CTXS[cx], exit: EXITS[x], name: `${TFN[tf]} K${KS[k]} ${CTXS[cx]} ${EXITS[x]}` }; }
  if (i < NA + NB) { const j = i - NA, x = j % 3, r = (j - x) / 3, cx = r % 2, tf = (r - cx) / 2;
    return { part: 'b', tf: TFN[tf], ctx: CTXS[cx], exit: EXITS[x], name: `${TFN[tf]} with-EG ${CTXS[cx]} ${EXITS[x]}` }; }
  const j = i - NA - NB, x = j % 3, tf = (j - x) / 3;
  return { part: 'ctl', tf: TFN[tf], exit: ['1R', '2R', 'swing'][x], name: `${TFN[tf]} fade none ext ${['1R', '2R', 'swing'][x]}` };
}
export const controlOf = (i) => { const n = cellName(i); return cellCtl(TFN.indexOf(n.tf), EXITS.indexOf(n.exit)); };

const conv = (B) => B.map((b) => ({ time: b.t, open: b.o, high: b.h, low: b.l, close: b.c }));

// ---- signals (closed candles only) -----------------------------------------------------------------------------------------
// kind 'ef': { tf, kind, s (= -dir), ts (failing candle close), stop, tg (proj target), brk, n (fi - i) }
// kind 'eg': { tf, kind, s (= dir), ts (completing candle close), stop, tg, brk }
export function signals(F) {
  const out = [];
  TFS.forEach((tfk, tf) => {
    const T = F[tfk], C = conv(T), atr = atr14(T), ev = breaks(T); let q = -1;
    const Z = zones(C, tfk);
    for (const z of Z) {   // zones come in order of their completing candle i
      const i = z.i, j = i - z.n, dir = z.dir; while (q + 1 < ev.length && ev[q + 1].i <= i) q++;
      const brk = q >= 0 && ev[q].dir === dir && i - ev[q].i <= BRKWIN;
      const rng = z.top - z.bot;
      // (b) the engulf WITH it, at the close of i
      { const a = atr[i]; if (a > 0) { let x = dir > 0 ? Infinity : -Infinity;
        for (let p = j; p <= i; p++) x = dir > 0 ? Math.min(x, T[p].l) : Math.max(x, T[p].h);
        out.push({ tf, kind: 'eg', s: dir, ts: T[i].e, stop: x - dir * ATRK * a, tg: (dir > 0 ? z.top : z.bot) + dir * rng, brk }); } }
      // (a) the failed engulf, the other way, at the close of fi
      if (z.fi == null || z.fi - i > KS[KS.length - 1]) continue;
      const fi = z.fi, a = atr[fi]; if (!(a > 0)) continue; const s = -dir; let x = s > 0 ? Infinity : -Infinity;
      for (let p = j; p <= fi; p++) x = s > 0 ? Math.min(x, T[p].l) : Math.max(x, T[p].h);
      out.push({ tf, kind: 'ef', s, ts: T[fi].e, stop: x - s * ATRK * a, tg: (dir > 0 ? z.bot : z.top) + s * rng, brk, n: fi - i });
    }
  });
  return out;
}

const inBad = (X, t) => { let lo = 0, hi = X.length; while (lo < hi) { const m = (lo + hi) >> 1; if (X[m][0] <= t) lo = m + 1; else hi = m; } return lo > 0 && t <= X[lo - 1][1]; };
function newAcc() { return { ms: new Float64Array(NALL * NM), msNet: new Float64Array(NALL * NM), n: new Float64Array(NALL * 2), sum: new Float64Array(NALL * 2),
  sq: new Float64Array(NALL * 2), net: new Float64Array(NALL * 2), win: new Float64Array(NALL * 2), cr: new Float64Array(NALL * 2) }; }
function add(A, c, w, m, R, cr) { A.ms[c * NM + m] += R; A.msNet[c * NM + m] += R - cr; A.n[c * 2 + w]++; A.sum[c * 2 + w] += R; A.sq[c * 2 + w] += R * R;
  A.net[c * 2 + w] += R - cr; A.cr[c * 2 + w] += cr; if (R > 0) A.win[c * 2 + w]++; }

export function runMarket(market) {
  const M5 = K.load(market, '5m', { from: '2004-01-01', to: '2026-11-01' }); const F = frames(M5);
  const sigs = signals(F), cost = COSTS[market], X = exclusions(market);
  const main = newAcc(), mirr = newAcc(); const cnt = { ef: 0, eg: 0, dropped: 0, bad: 0, small: 0, open: 0, ctl: 0 };
  // one trade: fill, R at 1R / 2R / proj (mirror beside), accumulate into the cells listed
  const trade = (s, ts, tfk, stopPx, tgPx, cellsOf) => {
    const fi = startIdx(M5, ts); if (fi >= M5.length) return; const t = M5[fi].t; if (t < FROM || t >= TO) return;
    if (X.length && inBad(X, t)) { cnt.dropped++; return; }
    const fill = M5[fi].o, risk = s * (fill - stopPx); if (!(risk > 0)) { cnt.bad++; return; }
    if (risk < cost) { cnt.small++; return; }
    if (!(s * (fill - stopPx) > 0)) throw new Error('stop on the wrong side');
    const kp = Number.isFinite(tgPx) ? (s * (tgPx - fill)) / risk : NaN; const ks = [1, 2, kp >= 1 ? kp : NaN];
    const r = exits(M5, s, fi, stopPx, ks.map((k) => (Number.isFinite(k) ? fill + s * k * risk : NaN)), CAP[tfk]);
    const p = exits(M5, -s, fi, fill + s * risk, ks.map((k) => (Number.isFinite(k) ? fill - s * k * risk : NaN)), CAP[tfk]);
    if (!r || !p) { cnt.open++; return; }
    const cr = cost / risk, m = monthOf(t), w = t < SPLIT ? 0 : 1;
    for (let x = 0; x < 3; x++) { if (!Number.isFinite(ks[x])) continue; for (const c of cellsOf(x)) { add(main, c, w, m, r.R[x], cr); add(mirr, c, w, m, p.R[x], cr); } }
  };
  for (const g of sigs) {
    const tfk = TFS[g.tf];
    if (g.kind === 'eg') { cnt.eg++; trade(g.s, g.ts, tfk, g.stop, g.tg, (x) => (g.brk ? [cellB(g.tf, 0, x), cellB(g.tf, 1, x)] : [cellB(g.tf, 0, x)])); continue; }
    cnt.ef++;
    trade(g.s, g.ts, tfk, g.stop, g.tg, (x) => { const L = []; KS.forEach((k, ki) => { if (g.n <= k) { L.push(cellA(g.tf, ki, 0, x)); if (g.brk) L.push(cellA(g.tf, ki, 1, x)); } }); return L; });
  }
  // the control: grid7-wide-fade's own signals, context none, stop ext, exits 1R / 2R / swing
  for (const g of fadeSignals(F)) { if (g.cx !== 0) continue; const tfk = TFS[g.tf];
    const fi = startIdx(M5, g.ts); if (fi >= M5.length) continue; const t = M5[fi].t; if (t < FROM || t >= TO) continue; if (X.length && inBad(X, t)) continue;
    const fill = M5[fi].o, s = -g.d, stop = g.ext + g.d * ATRK * g.a, risk = s * (fill - stop); if (!(risk > 0) || risk < cost) continue;
    const sr = g.opp == null ? NaN : (s * (g.opp - fill)) / risk; const ks = [1, 2, sr > 0 ? sr : NaN];
    const r = exits(M5, s, fi, stop, ks.map((k) => (Number.isFinite(k) ? fill + s * k * risk : NaN)), CAP[tfk]); if (!r) continue;
    const cr = cost / risk, m = monthOf(t), w = t < SPLIT ? 0 : 1; cnt.ctl++;
    for (let x = 0; x < 3; x++) if (Number.isFinite(ks[x])) add(main, cellCtl(g.tf, x), w, m, r.R[x], cr); }
  const J = (A) => Object.fromEntries(Object.entries(A).map(([k, v]) => [k, Array.from(v, (z) => +z.toFixed(6))]));
  return { market, cost, assumed: ASSUMED.includes(market), first: M5.length ? M5[0].t : null, last: M5.length ? M5[M5.length - 1].t : null,
    signals: sigs.length, ...cnt, main: J(main), mirror: J(mirr) };
}

// ---- cut test: the signals known by a date, computed on candles cut there, equal the full run's ---------------------------
export function cutTest(market, cuts = ['2008-06-11', '2012-03-14', '2016-09-21', '2021-02-17', '2025-05-07']) {
  const M5 = K.load(market, '5m', { from: '2004-01-01', to: '2026-11-01' });
  const key = (g) => [g.tf, g.kind, g.s, g.ts, g.stop.toFixed(10), g.tg.toFixed(10), g.brk, g.n].join('|');
  const full = signals(frames(M5)); const out = [];
  for (const c of cuts) { const T = Date.parse(c + 'T00:00:00Z') / 1000;
    const cut = signals(frames(M5.filter((b) => b.e <= T))).filter((g) => g.ts <= T).map(key);
    const want = full.filter((g) => g.ts <= T).map(key); const A = new Set(cut), B = new Set(want);
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
export const bars13 = (x) => x.d.n >= 300 && x.c.n >= 300 && x.d.mean > 0 && x.c.mean > 0 && x.d.t >= 2 && x.c.t >= 2;
export const passOf = (r) => bars13(r) && r.holm < 0.05 && r.wd != null && r.wc != null && r.wd >= 2 && r.wc >= 2;
export function judge(data) {
  const A = pool(data, 'main'), M = pool(data, 'mirror'); const rows = [];
  for (let c = 0; c < NA + NB; c++) { const s = cellStats(A, c), ms = cellStats(M, c), ct = cellStats(A, controlOf(c));
    rows.push({ cell: c, ...cellName(c), d: s.d, c: s.c, p: p1(s.c.t, s.c.months - 1), ctl: { name: cellName(controlOf(c)).name, d: ct.d, c: ct.c },
      wd: welch(s.d, ct.d), wc: welch(s.c, ct.c), mir: { d: ms.d, c: ms.c } }); }
  const H = K.holm(rows.slice(0, NA).map((r) => r.p));
  rows.forEach((r, i) => { r.holm = i < NA ? H[i] : null; r.bars13 = bars13(r); r.mir.bars13 = bars13(r.mir);
    r.checks = { n: r.d.n >= 300 && r.c.n >= 300, disc: r.d.mean > 0 && r.d.t >= 2, conf: r.c.mean > 0 && r.c.t >= 2, holm: i < NA && H[i] < 0.05,
      control: r.wd != null && r.wc != null && r.wd >= 2 && r.wc >= 2 };
    r.pass = i < NA && passOf(r); });
  return rows;
}

const f3 = (x) => (x == null ? 'n/a' : (x >= 0 ? '+' : '-') + Math.abs(x).toFixed(3)), f2 = (x) => (x == null || !Number.isFinite(x) ? 'n/a' : x.toFixed(2)), N = (x) => Math.round(x).toLocaleString('en-US');
const slim = (w) => ({ n: w.n, mean: w.mean == null ? null : +w.mean.toFixed(6), t: +w.t.toFixed(6), meanNet: w.meanNet == null ? null : +w.meanNet.toFixed(6),
  tNet: +w.tNet.toFixed(2), win: w.win == null ? null : +w.win.toFixed(3), costR: w.costR == null ? null : +w.costR.toFixed(4) });

export function report(dir) {
  const data = MARKETS.filter((m) => fs.existsSync(path.join(dir, m + '.json'))).map((m) => JSON.parse(fs.readFileSync(path.join(dir, m + '.json'), 'utf8')));
  const cut = MARKETS.flatMap((m) => { const f = path.join(dir, 'cut-' + m + '.json'); return fs.existsSync(f) ? JSON.parse(fs.readFileSync(f, 'utf8')) : []; });
  const rows = judge(data), A = rows.slice(0, NA), B = rows.slice(NA), pass = A.filter((r) => r.pass);
  const verdict = data.length < 8 ? 'INCONCLUSIVE' : pass.length ? 'PASS' : 'FAIL';
  const best = [...A].sort((a, b) => b.c.t - a.c.t)[0], b = [...pass].sort((a, b) => b.c.t - a.c.t)[0] || best;
  const perMarket = {}; for (const r of pass) perMarket[r.name] = data.map((d) => { const s = cellStats(pool([d], 'main'), r.cell); return { market: d.market, assumed: d.assumed, d: slim(s.d), c: slim(s.c) }; });
  const headline = verdict === 'PASS'
    ? `${pass.length} of 54 failed-engulf cells pass before costs and beat the plain fade; best ${b.name}, ${f3(b.c.mean)}R a trade in 2015-26 (n ${N(b.c.n)}, month t ${f2(b.c.t)}; discovery ${f3(b.d.mean)}R, t ${f2(b.d.t)}), ${f3(b.c.meanNet)}R after costs`
    : `0 of 54 failed-engulf cells pass; the best confirmation cell, ${b.name}, made ${f3(b.c.mean)}R a trade before costs in 2015-26 (n ${N(b.c.n)}, month t ${f2(b.c.t)}; discovery ${f3(b.d.mean)}R, t ${f2(b.d.t)}; against the plain fade Welch t ${f2(b.wd)} / ${f2(b.wc)})`;
  const RW = rows.map((r) => ({ cell: r.name, part: r.part, tf: r.tf, K: r.K ?? null, ctx: r.ctx, exit: r.exit, disc: slim(r.d), conf: slim(r.c),
    holm: r.holm == null ? null : +r.holm.toFixed(4), control: { cell: r.ctl.name, disc: slim(r.ctl.d), conf: slim(r.ctl.c) },
    welchDisc: r.wd == null ? null : +r.wd.toFixed(3), welchConf: r.wc == null ? null : +r.wc.toFixed(3), bars13: r.bars13, checks: r.checks, pass: r.pass,
    mirror: { disc: slim(r.mir.d), conf: slim(r.mir.c), bars13: r.mir.bars13 } }));
  const out = { study: 'grid7-ltf-ef', built: '2026-11-23', verdict, headline,
    basis: 'judged before costs on calendar-month sums and per-trade Welch t against the plain grid7-wide-fade rule (pre-registered); after costs beside',
    windows: { discovery: '2005-01-01 to 2014-12-31 (120 months)', confirmation: '2015-01-01 to 2026-10-31 (142 months)' }, markets: data.map((d) => d.market),
    assumedCosts: ASSUMED, costs: Object.fromEntries(data.map((d) => [d.market, d.cost])),
    meta: data.map((d) => ({ market: d.market, first: new Date(d.first * 1000).toISOString().slice(0, 10), last: new Date(d.last * 1000).toISOString().slice(0, 10),
      signals: d.signals, ef: d.ef, eg: d.eg, control: d.ctl, dropped: d.dropped, bad: d.bad, small: d.small, open: d.open })),
    passed: pass.map((r) => r.name), passedNetPositive: pass.filter((r) => r.d.meanNet > 0 && r.c.meanNet > 0).map((r) => r.name),
    bars13A: A.filter((r) => r.bars13).map((r) => r.name), mirrorBars13A: A.filter((r) => r.mir.bars13).map((r) => r.name),
    withEgBars13: B.filter((r) => r.bars13).map((r) => r.name), withEgMirrorBars13: B.filter((r) => r.mir.bars13).map((r) => r.name),
    bestConfirmation: best.name, cut, cells: RW, perMarket };
  fs.writeFileSync(path.join(HERE, 'result.json'), JSON.stringify(out, null, 1) + '\n');
  fs.writeFileSync(path.join(HERE, 'RESULT.md'), resultMd(out, rows));
  return out;
}

function resultMd(o, rows) {
  const A = rows.slice(0, NA), B = rows.slice(NA); const nCut = o.cut.reduce((a, x) => a + x.n, 0), bad = o.cut.reduce((a, x) => a + x.missing + x.extra, 0);
  const cnt = (f) => A.filter(f).length; const L = [];
  L.push('# The failed engulf (EF) on the lower timeframes, ten markets (result)', '', `**Verdict: ${o.verdict}. ${o.headline}.**`, '',
    'Run 23 Nov 2026 as pre-registered (`PREREGISTRATION.md`, committed and pushed alone first). Research only: nothing live',
    'changed, nothing is proposed. One run, no variants.', '',
    '## What was run', '',
    'An engulf zone on M5, M15 or H1 (`council/eg-methods.mjs` `zones`, 3-candle span, the base candle wick to wick) that a',
    'later candle of the same timeframe closes through on its far side within K = 3, 6 or 12 candles of the engulf completing',
    '(it FAILED), traded the other way at market at the next 5-minute open. Context "none" (every zone) or "brk" (the last',
    'structure break known when the engulf completed was of its own side, at most 24 candles earlier). Stop past the extreme',
    'between the base and the failing candle + 0.1 ATR(14); exit 1R, 2R or "proj" (the base range projected 1:1 from the side',
    'closed through, only when 1R or more away); time limit 8 h / 1 day / 2 days. 54 cells. Control per cell: the plain',
    '`grid7-wide-fade` rule (context none, stop past the break candle) on the same timeframe and exit (proj against its swing',
    'exit), run here on the same candles. Ten markets pooled, OANDA mid 5-minute candles; discovery = fills 2005-2014,',
    'confirmation = 2015 to October 2026. Judged before costs on month sums, Holm over the 54 confirmation tests, and a per-trade',
    `Welch t >= 2 against the control in both windows. Costs beside: **ASSUMED, not measured** for ${o.assumedCosts.join(', ')}.`, '',
    '## The bar, cell by cell', '',
    `- n >= 300 in both windows: ${cnt((r) => r.checks.n)} of 54.`,
    `- Mean R > 0 and month t >= 2 in discovery: ${cnt((r) => r.checks.disc)}; in confirmation: ${cnt((r) => r.checks.conf)}; both: ${cnt((r) => r.checks.disc && r.checks.conf)}.`,
    `- Holm-adjusted p < 0.05: ${cnt((r) => r.checks.holm)}.`,
    `- Welch t >= 2 against the plain fade in both windows: ${cnt((r) => r.checks.control)}.`,
    `- **All five: ${o.passed.length}${o.passed.length ? ' (' + o.passed.join('; ') + ')' : ''}.**`,
    `- Of those, positive after costs in both windows: ${o.passedNetPositive.length}${o.passedNetPositive.length ? ' (' + o.passedNetPositive.join('; ') + ')' : ''}.`,
    `- Side-flipped (traded WITH the failed zone) clearing bars 1-3: ${o.mirrorBars13A.length}${o.mirrorBars13A.length ? ' (' + o.mirrorBars13A.join('; ') + ')' : ''}.`, '',
    '## Every judged cell', '',
    'R a trade before costs (month-sum t), after costs beside; "cost R" = mean round-trip cost / risk in 2015-26; "vs fade" = per-trade',
    'Welch t of the cell against its control (discovery / confirmation); mirror = the cell traded the other way.', '',
    '| Cell | n 05-14 | R 05-14 (t) | net 05-14 | n 15-26 | R 15-26 (t) | net 15-26 | cost R | Holm | Control R 05-14 / 15-26 | vs fade | Mirror R 15-26 (t) | Pass |',
    '|---|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|---|');
  for (const r of A) L.push(`| ${r.name} | ${N(r.d.n)} | ${f3(r.d.mean)} (${f2(r.d.t)}) | ${f3(r.d.meanNet)} | ${N(r.c.n)} | ${f3(r.c.mean)} (${f2(r.c.t)}) | ${f3(r.c.meanNet)} | ${r.c.costR == null ? 'n/a' : r.c.costR.toFixed(3)} | ${r.holm.toFixed(3)} | ${f3(r.ctl.d.mean)} / ${f3(r.ctl.c.mean)} | ${f2(r.wd)} / ${f2(r.wc)} | ${f3(r.mir.c.mean)} (${f2(r.mir.c.t)}) | ${r.pass ? 'yes' : 'no'} |`);
  L.push('', '## (b) The engulf traded WITH it at completion (reported, not judged)', '',
    'Same zones, entered with the engulf at the next 5-minute open after it completes; stop past the base-to-completion extreme',
    '+ 0.1 ATR. Not in the Holm family; "bars 1-3" = n, discovery and confirmation as for the judged cells.', '',
    '| Row | n 05-14 | R 05-14 (t) | net 05-14 | n 15-26 | R 15-26 (t) | net 15-26 | cost R | Mirror R 05-14 (t) | Mirror R 15-26 (t) | bars 1-3 |',
    '|---|---:|---:|---:|---:|---:|---:|---:|---:|---:|---|');
  for (const r of B) L.push(`| ${r.name} | ${N(r.d.n)} | ${f3(r.d.mean)} (${f2(r.d.t)}) | ${f3(r.d.meanNet)} | ${N(r.c.n)} | ${f3(r.c.mean)} (${f2(r.c.t)}) | ${f3(r.c.meanNet)} | ${r.c.costR == null ? 'n/a' : r.c.costR.toFixed(3)} | ${f3(r.mir.d.mean)} (${f2(r.mir.d.t)}) | ${f3(r.mir.c.mean)} (${f2(r.mir.c.t)}) | ${r.bars13 ? 'yes' : r.mir.bars13 ? 'mirror' : 'no'} |`);
  L.push('');
  if (o.passed.length) { L.push('## Per market, passing cells', '', 'Before costs (after costs in brackets); * = cost ASSUMED.', '');
    for (const [name, list] of Object.entries(o.perMarket)) { L.push(`### ${name}`, '', '| Market | n 05-14 | R (t) [net] | n 15-26 | R (t) [net] | cost R 15-26 |', '|---|---:|---:|---:|---:|---:|');
      for (const x of list) L.push(`| ${x.market}${x.assumed ? '*' : ''} | ${N(x.d.n)} | ${f3(x.d.mean)} (${f2(x.d.t)}) [${f3(x.d.meanNet)}] | ${N(x.c.n)} | ${f3(x.c.mean)} (${f2(x.c.t)}) [${f3(x.c.meanNet)}] | ${x.c.costR == null ? 'n/a' : x.c.costR.toFixed(3)} |`);
      L.push(''); } }
  L.push('## Checks', '',
    `- Cut test: ${o.cut.length} cuts on ${[...new Set(o.cut.map((x) => x.market))].join(', ')}: ${N(nCut)} signals known by the cut dates, ${bad} missing or extra when the candles are cut there.`,
    '- Every trade has its stop on the losing side of the fill (the run throws otherwise); a fill at or past the stop and a risk under the round-trip cost are no trades (same for the control).',
    '- Exclusions: the data-quality audit\'s bad intervals (`combo-grid-2` `exclusions`).', '',
    '| Market | candles from | zone signals | EF | with-EG | control trades | dropped (bad data) | past the stop | risk under cost | unresolved |', '|---|---|---:|---:|---:|---:|---:|---:|---:|---:|');
  for (const m of o.meta) L.push(`| ${m.market} | ${m.first} | ${N(m.signals)} | ${N(m.ef)} | ${N(m.eg)} | ${N(m.control)} | ${m.dropped} | ${N(m.bad)} | ${N(m.small)} | ${m.open} |`);
  L.push('', '## What it means', '');
  if (o.verdict === 'PASS') L.push(`${o.passed.length} failed-engulf cells clear the pre-registered bar before costs in both decades and beat the plain fade. ${o.passedNetPositive.length ? o.passedNetPositive.length + ' stay positive after costs in both windows.' : 'None stays positive after costs in both windows: the bid / ask takes more than the tilt.'}`,
    'A before-cost tilt, not an edge. Nothing is adopted; a forward record or a live change needs the owner. One run, no variants.');
  else {
    const g = (n) => rows.find((r) => r.name === n);
    const a1 = g('m15 K12 none 1R'), a2 = g('m15 K12 none 2R'), pj = A.filter((r) => r.exit === 'proj' && r.checks.n);
    const bp = B.filter((r) => r.bars13).map((r) => r.name);
    L.push('No failed-engulf cell clears the bar. What the cells show:', '',
      `- **The EF side itself loses before costs at 1R and 2R.** Traded the other way after an engulf fails, the 1R / 2R cells are`,
      `  negative in confirmation on every timeframe and K (for example m15 K12 none: 1R ${f3(a1.c.mean)}R, t ${f2(a1.c.t)}; 2R ${f3(a2.c.mean)}R,`,
      `  t ${f2(a2.c.t)}). Their M5 / M15 1R cells "beat" the plain fade by a large Welch t only because the fade's own 1R cells are negative`,
      '  (the stop-first booking of a 5-minute candle that holds both, with stops of a few pips); at 2R the fade is better.',
      `- **The side-flipped check is the small tilt.** Traded WITH the failed zone (fading the failure, which is itself a break),`,
      `  ${o.mirrorBars13A.length} cells clear bars 1-3, at about +0.01 to +0.03R a trade against a round trip of 0.09-0.16R on M5 / M15: the`,
      '  same fraction-of-a-spread reversal of the mid quote `grid7-wide-fade` found, not a move a taker can capture.',
      `- **The projection cells are a small, selected sample.** The 1:1 projection is 1R or more away on few failures (${pj.map((r) => N(r.c.n)).join(', ')} trades`,
      '  in 2015-26 across the M5 / M15 proj cells with n >= 300); several are positive before costs with month t over 3 in',
      '  confirmation, but none has discovery t >= 2 together with a Welch t >= 2 against the fade\'s swing exit in both windows,',
      '  and after costs they are mostly negative on M5. Picking them now would be choosing after the result.',
      `- **(b), reported only:** the engulf traded WITH it at completion loses at 1R / 2R everywhere; its mirror is the same small`,
      `  tilt. ${bp.length ? 'Rows clearing bars 1-3 (not judged, not in Holm): ' + bp.join('; ') + '.' : ''} These are not tested here and are not`,
      '  evidence: they would need their own pre-registration on other data.', '',
      'Do not re-test variants of these 54 cells on these years. Nothing live changed; no rule is proposed.', '',
      'Correction to the pre-registration\'s "Why": the plain fade\'s M15 break-candle stop, 2R cell had discovery month t 19.57',
      '(+0.094R), not 11.4 as quoted there; the confirmation figure (+0.054R, t 12.2) was right. Nothing in the design depended on it.');
  }
  L.push('');
  return L.join('\n');
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const [cmd, a, b] = process.argv.slice(2);
  if (cmd === 'market') { fs.mkdirSync(b, { recursive: true }); const t0 = Date.now(); const r = runMarket(a);
    fs.writeFileSync(path.join(b, a + '.json'), JSON.stringify(r)); console.log(a, 'signals', r.signals, 'ef', r.ef, 'ctl', r.ctl, ((Date.now() - t0) / 1000).toFixed(0) + 's'); }
  else if (cmd === 'cut') { fs.mkdirSync(b, { recursive: true }); const r = cutTest(a); fs.writeFileSync(path.join(b, 'cut-' + a + '.json'), JSON.stringify(r)); console.log(JSON.stringify(r)); }
  else if (cmd === 'report') { const o = report(a); console.log(o.verdict, o.headline); }
  else console.log('usage: run.mjs market <m> <dir> | cut <m> <dir> | report <dir>');
}
