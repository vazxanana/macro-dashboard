// research/edge/fade-mtf-context/run.mjs - PREREGISTRATION.md (23 Nov 2026): grid7-wide-fade's M15 fade (context none, stop
// 1 ATR, exits 2R and swing) split by the higher timeframes' structure at the break (H1 / H4 last break, H4 stage, counter-move
// against a fresh H1 break, prior-day extreme taken). 24 cells, ten markets, discovery 2005-14, confirmation 2015 to Oct 2026,
// judged before costs on month sums. Research only: nothing live imports it, nothing is placed.
//   EDGE_DATA=<cache> node research/edge/fade-mtf-context/run.mjs market <m> <outDir>
//   EDGE_DATA=<cache> node research/edge/fade-mtf-context/run.mjs cut <m> <outDir>
//   node research/edge/fade-mtf-context/run.mjs report <outDir>
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import * as K from '../_lib/edgekit.mjs';
import { readPhase } from '../_lib/phase.mjs';
import { frames } from '../combo-grid-3/run.mjs';
import { COSTS, exclusions } from '../combo-grid-2/run.mjs';
import { atr14, startIdx } from '../dom-trade-through/run.mjs';
import { MARKETS, ASSUMED, FROM, SPLIT, TO, NM, DM, monthOf, mstat, p1, welch } from '../grid7-wide-core/run.mjs';
import { breaks, exits } from '../grid7-wide-fade/run.mjs';

export { MARKETS, ASSUMED };
const HERE = path.dirname(fileURLToPath(import.meta.url));
export const EXITS = ['2R', 'swing'], CAP = 86400;
export const LEVELS = ['control', 'h1 same', 'h1 opposite', 'h4 same', 'h4 opposite', 'stage move', 'stage pullback', 'stage range',
  'counter yes', 'counter no', 'prior-day yes', 'prior-day no'];
export const NL = LEVELS.length, NCELL = NL * EXITS.length;
export const cellOf = (x, l) => x * NL + l;
export const cellName = (c) => `${LEVELS[c % NL]} ${EXITS[Math.floor(c / NL)]}`;
export const PRIMARY = [['P1', 'h1 opposite', 'h1 same'], ['P2', 'h4 opposite', 'h4 same'], ['P3', 'stage pullback', 'stage move'],
  ['P4', 'counter yes', 'counter no'], ['P5', 'prior-day yes', 'prior-day no']];
const STG = ['move', 'pullback', 'range'];

// H4 stage by phase.mjs's stageOf on the full closed series: u = index of H4's last event (or -1); h1 = H1 events closed by ts.
export function stageAt(e4, u, e1, k1) {
  if (u < 0) return 2;
  const last = e4[u], prev = e4[u - 1], prev2 = e4[u - 2];
  const twoChoCh = last.kind === 'ChoCh' && prev && prev.kind === 'ChoCh';
  if (twoChoCh && !(prev2 && prev2.kind === 'BO' && prev2.dir === last.dir)) return 2;
  const d = last.dir; let against = false;
  // forward pass over H1 events after the H4 break, closed by ts
  let a = k1; while (a >= 0 && e1[a].t > last.t) a--;
  for (let k = a + 1; k <= k1; k++) {
    if (!against) { if (e1[k].dir === -d) against = true; }
    else if (e1[k].dir === d) return 0;   // continuation: counted as move
  }
  return against ? 1 : 0;
}

// ---- signals (closed candles only) ----------------------------------------------------------------------------------
// [{ i, d, ts, a, opp, h1 (0 none, 1 same, 2 opposite), h4, stage (0 move, 1 pullback, 2 range), counter (0/1), pd (0/1) }]
export function signals(F) {
  const T = F['15m'], atr = atr14(T), ev = breaks(T), D = F['1d'];
  const e1 = K.structure(F['1h'], 3).events, e4 = K.structure(F['4h'], 3).events;
  const out = []; let k1 = -1, k4 = -1, seen = { 1: false, '-1': false };
  for (const e of ev) {
    const ts = T[e.i].e, d = e.dir;
    let moved = false; while (k1 + 1 < e1.length && e1[k1 + 1].t <= ts) { k1++; moved = true; }
    if (moved) seen = { 1: false, '-1': false };
    while (k4 + 1 < e4.length && e4[k4 + 1].t <= ts) k4++;
    const rel = (x) => (!x ? 0 : x.dir === d ? 1 : 2);
    const h1e = k1 >= 0 ? e1[k1] : null;
    const counter = h1e && h1e.dir === -d && ts > h1e.t && !seen[d] ? 1 : 0;
    seen[d] = true;
    const di = K.closedCount(D, ts) - 1, b = T[e.i];
    const pd = di >= 0 && (d > 0 ? b.h > D[di].h : b.l < D[di].l) ? 1 : 0;
    const a = atr[e.i]; if (!(a > 0)) continue;
    out.push({ i: e.i, d, ts, a, opp: e.opp, h1: rel(h1e), h4: rel(k4 >= 0 ? e4[k4] : null), stage: stageAt(e4, k4, e1, k1), counter, pd });
  }
  return out;
}
export function levelsOf(g) {
  const L = [0];
  if (g.h1) L.push(g.h1 === 1 ? 1 : 2);
  if (g.h4) L.push(g.h4 === 1 ? 3 : 4);
  L.push(5 + g.stage); L.push(g.counter ? 8 : 9); L.push(g.pd ? 10 : 11);
  return L;
}

function newAcc() { return { ms: new Float64Array(NCELL * NM), msNet: new Float64Array(NCELL * NM), n: new Float64Array(NCELL * 2), sum: new Float64Array(NCELL * 2),
  sq: new Float64Array(NCELL * 2), net: new Float64Array(NCELL * 2), win: new Float64Array(NCELL * 2), cr: new Float64Array(NCELL * 2) }; }
function add(A, c, w, m, R, cr) { A.ms[c * NM + m] += R; A.msNet[c * NM + m] += R - cr; A.n[c * 2 + w]++; A.sum[c * 2 + w] += R; A.sq[c * 2 + w] += R * R;
  A.net[c * 2 + w] += R - cr; A.cr[c * 2 + w] += cr; if (R > 0) A.win[c * 2 + w]++; }
const inBad = (X, t) => { let lo = 0, hi = X.length; while (lo < hi) { const m = (lo + hi) >> 1; if (X[m][0] <= t) lo = m + 1; else hi = m; } return lo > 0 && t <= X[lo - 1][1]; };

export function runMarket(market) {
  const M5 = K.load(market, '5m', { from: '2004-01-01', to: '2026-11-01' }); const F = frames(M5);
  const sigs = signals(F), cost = COSTS[market], X = exclusions(market);
  const fade = newAcc(), mirr = newAcc(); const mix = {}; let dropped = 0, bad = 0, small = 0, sims = 0, open = 0;
  for (const g of sigs) {
    const fi = startIdx(M5, g.ts); if (fi >= M5.length) continue; const t = M5[fi].t; if (t < FROM || t >= TO) continue;
    if (X.length && inBad(X, t)) { dropped++; continue; }
    const fill = M5[fi].o, s = -g.d, m = monthOf(t), w = t < SPLIT ? 0 : 1;
    const stop = fill + g.d * g.a, risk = s * (fill - stop);
    if (!(risk > 0)) { bad++; continue; }
    if (risk < cost) { small++; continue; }
    if (!(s * (fill - stop) > 0)) throw new Error('stop on the wrong side');
    const sr = g.opp == null ? NaN : (s * (g.opp - fill)) / risk; const ks = [2, sr > 0 ? sr : NaN];
    const r = exits(M5, s, fi, stop, ks.map((k) => (Number.isFinite(k) ? fill + s * k * risk : NaN)), CAP);
    const p = exits(M5, -s, fi, fill + s * risk, ks.map((k) => (Number.isFinite(k) ? fill - s * k * risk : NaN)), CAP); sims++;
    if (!r || !p) { open++; continue; }
    const cr = cost / risk, L = levelsOf(g);
    const key = `${g.h1}${g.h4}${g.stage}${g.counter}${g.pd}`; mix[key] = (mix[key] || 0) + 1;
    for (let x = 0; x < 2; x++) { if (!Number.isFinite(ks[x])) continue;
      for (const l of L) { const c = cellOf(x, l); add(fade, c, w, m, r.R[x], cr); add(mirr, c, w, m, p.R[x], cr); } }
  }
  const J = (A) => Object.fromEntries(Object.entries(A).map(([k, v]) => [k, Array.from(v, (z) => +z.toFixed(6))]));
  return { market, cost, assumed: ASSUMED.includes(market), first: M5.length ? M5[0].t : null, last: M5.length ? M5[M5.length - 1].t : null,
    signals: sigs.length, sims, dropped, bad, small, open, mix, fade: J(fade), mirror: J(mirr) };
}

// ---- cut test (signals and their labels known by a date, on candles cut there) + stage agreement with readPhase -------
export function cutTest(market, cuts = ['2008-06-11', '2012-03-14', '2016-09-21', '2021-02-17', '2025-05-07']) {
  const M5 = K.load(market, '5m', { from: '2004-01-01', to: '2026-11-01' });
  const key = (g) => [g.ts, g.d, g.a.toFixed(10), g.opp, g.h1, g.h4, g.stage, g.counter, g.pd].join('|');
  const F = frames(M5); const full = signals(F); const out = [];
  for (const c of cuts) { const T = Date.parse(c + 'T00:00:00Z') / 1000;
    const cut = signals(frames(M5.filter((b) => b.e <= T))).filter((g) => g.ts <= T).map(key);
    const want = full.filter((g) => g.ts <= T).map(key); const A = new Set(cut), B = new Set(want);
    out.push({ market, cut: c, n: B.size, missing: [...B].filter((k) => !A.has(k)).length, extra: [...A].filter((k) => !B.has(k)).length }); }
  // stage agreement: readPhase (600-candle tails) against the full-series stage, 400 signals spread over the history
  const rnd = K.rng(5); let n = 0, same = 0; const W = full.filter((g) => g.ts >= FROM);
  for (let q = 0; q < 400 && W.length; q++) { const g = W[Math.floor(rnd() * W.length)];
    const ph = readPhase({ '1d': F['1d'], '4h': F['4h'], '1h': F['1h'], '15m': F['15m'], '5m': M5 }, g.ts);
    const st = ph.tf['4h'].stage, mine = STG[g.stage]; n++; if ((st === 'continuation' ? 'move' : st) === mine) same++; }
  return { cut: out, stage: { market, n, same } };
}

// ---- statistics ---------------------------------------------------------------------------------------------------------
export function pool(list, kind) { const A = newAcc(); for (const d of list) { const S = d[kind]; for (const k of Object.keys(A)) for (let i = 0; i < A[k].length; i++) A[k][i] += S[k][i]; } return A; }
const W3 = (A, c, w) => ({ n: A.n[c * 2 + w], sum: A.sum[c * 2 + w], sq: A.sq[c * 2 + w] });
export function cellStats(A, c) {
  const ms = A.ms.subarray(c * NM, (c + 1) * NM), msn = A.msNet.subarray(c * NM, (c + 1) * NM);
  const win = (w) => { const n = A.n[c * 2 + w], a = w ? DM : 0, b = w ? NM : DM;
    return { n, mean: n ? A.sum[c * 2 + w] / n : null, t: mstat(ms, a, b).t, meanNet: n ? A.net[c * 2 + w] / n : null, tNet: mstat(msn, a, b).t,
      win: n ? A.win[c * 2 + w] / n : null, costR: n ? A.cr[c * 2 + w] / n : null, months: b - a }; };
  return { d: win(0), c: win(1) };
}
const pNorm1 = (z) => (z == null ? 1 : 0.5 * erfc(z / Math.SQRT2));
function erfc(x) { const z = Math.abs(x), t = 1 / (1 + 0.5 * z);
  const r = t * Math.exp(-z * z - 1.26551223 + t * (1.00002368 + t * (0.37409196 + t * (0.09678418 + t * (-0.18628806 + t * (0.27886807 + t * (-1.13520398 + t * (1.48851587 + t * (-0.82215223 + t * 0.17087277)))))))));
  return x >= 0 ? r : 2 - r; }
export const passCell = (x, h) => x.d.n >= 300 && x.c.n >= 300 && x.d.mean > 0 && x.c.mean > 0 && x.d.t >= 2 && x.c.t >= 2 && h < 0.05 && x.vsD >= 2 && x.vsC >= 2;

export function judge(data, kind = 'fade') {
  const A = pool(data, kind); const cells = [];
  for (let c = 0; c < NCELL; c++) { const s = cellStats(A, c), ctl = c - (c % NL);
    cells.push({ cell: c, name: cellName(c), level: LEVELS[c % NL], exit: EXITS[Math.floor(c / NL)], control: c % NL === 0, d: s.d, c: s.c,
      p: p1(s.c.t, s.c.months - 1), vsD: welch(W3(A, c, 0), W3(A, ctl, 0)), vsC: welch(W3(A, c, 1), W3(A, ctl, 1)) }); }
  const lv = cells.filter((x) => !x.control), H = K.holm(lv.map((x) => x.p));
  lv.forEach((x, i) => { x.holm = H[i]; x.pass = passCell(x, H[i]); });
  cells.filter((x) => x.control).forEach((x) => { x.holm = null; x.pass = false; });
  const prim = [];
  for (let x = 0; x < 2; x++) for (const [id, hi, lo] of PRIMARY) {
    const a = cellOf(x, LEVELS.indexOf(hi)), b = cellOf(x, LEVELS.indexOf(lo));
    const dD = A.sum[a * 2] / A.n[a * 2] - A.sum[b * 2] / A.n[b * 2], dC = A.sum[a * 2 + 1] / A.n[a * 2 + 1] - A.sum[b * 2 + 1] / A.n[b * 2 + 1];
    const tD = welch(W3(A, a, 0), W3(A, b, 0)), tC = welch(W3(A, a, 1), W3(A, b, 1));
    prim.push({ id: `${id} ${EXITS[x]}`, test: `${hi} minus ${lo}, ${EXITS[x]}`, diffD: dD, tD, diffC: dC, tC, p: pNorm1(tC) }); }
  const HP = K.holm(prim.map((q) => q.p));
  prim.forEach((q, i) => { q.holm = HP[i]; q.holds = q.diffD > 0 && q.diffC > 0 && q.tD >= 2 && q.tC >= 2 && HP[i] < 0.05; });
  return { cells, prim, A };
}

const f3 = (x) => (x == null || !Number.isFinite(x) ? 'n/a' : (x >= 0 ? '+' : '-') + Math.abs(x).toFixed(3)), f2 = (x) => (x == null || !Number.isFinite(x) ? 'n/a' : x.toFixed(2));
const N = (x) => Math.round(x).toLocaleString('en-US');
const slim = (w) => ({ n: w.n, mean: w.mean == null ? null : +w.mean.toFixed(6), t: +w.t.toFixed(6), meanNet: w.meanNet == null ? null : +w.meanNet.toFixed(6),
  tNet: +w.tNet.toFixed(2), win: w.win == null ? null : +w.win.toFixed(3), costR: w.costR == null ? null : +w.costR.toFixed(4) });
const r6 = (x) => (x == null || !Number.isFinite(x) ? null : +x.toFixed(6));

export function report(dir) {
  const data = MARKETS.filter((m) => fs.existsSync(path.join(dir, m + '.json'))).map((m) => JSON.parse(fs.readFileSync(path.join(dir, m + '.json'), 'utf8')));
  const cutF = MARKETS.map((m) => path.join(dir, 'cut-' + m + '.json')).filter((f) => fs.existsSync(f)).map((f) => JSON.parse(fs.readFileSync(f, 'utf8')));
  const cut = cutF.flatMap((x) => x.cut), stage = cutF.map((x) => x.stage);
  const J = judge(data), M = judge(data, 'mirror');
  const held = J.prim.filter((q) => q.holds), passed = J.cells.filter((x) => x.pass);
  const verdict = data.length < 8 ? 'INCONCLUSIVE' : held.length ? 'PASS' : 'FAIL';
  const best = [...J.prim].sort((a, b) => Math.min(b.tD, b.tC) - Math.min(a.tD, a.tC))[0];
  const ctl = J.cells[cellOf(0, 0)];
  const headline = verdict === 'PASS'
    ? `${held.length} of 10 primary tests hold before costs; best ${best.test}: ${f3(best.diffC)}R a trade in 2015-26 (Welch t ${f2(best.tC)}; 2005-14 ${f3(best.diffD)}R, t ${f2(best.tD)}) on a rule that makes ${f3(ctl.c.mean)}R a trade (n ${N(ctl.c.n)}, month t ${f2(ctl.c.t)}) and ${f3(ctl.c.meanNet)}R after costs`
    : `0 of 10 primary tests hold; the unsplit 2R fade made ${f3(ctl.c.mean)}R a trade before costs in 2015-26 (n ${N(ctl.c.n)}, month t ${f2(ctl.c.t)}); the strongest difference, ${best.test}, ${f3(best.diffC)}R (Welch t ${f2(best.tC)}; 2005-14 ${f3(best.diffD)}R, t ${f2(best.tD)})`;
  const perMarket = {};
  const want = [...new Set([...passed.map((x) => x.cell), ...held.flatMap((q) => { const [x, h, l] = [EXITS.indexOf(q.id.split(' ')[1]), ...PRIMARY.find((p) => p[0] === q.id.split(' ')[0]).slice(1)]; return [cellOf(x, LEVELS.indexOf(h)), cellOf(x, LEVELS.indexOf(l))]; })])];
  for (const c of want) perMarket[cellName(c)] = data.map((d) => { const s = cellStats(pool([d], 'fade'), c); return { market: d.market, assumed: d.assumed, d: slim(s.d), c: slim(s.c) }; });
  const out = { study: 'fade-mtf-context', built: '2026-11-23', verdict, headline, basis: 'judged before costs (pre-registered); after costs beside',
    windows: { discovery: '2005-01-01 to 2014-12-31 (120 months)', confirmation: '2015-01-01 to 2026-10-31 (142 months)' }, markets: data.map((d) => d.market),
    assumedCosts: ASSUMED, costs: Object.fromEntries(data.map((d) => [d.market, d.cost])),
    meta: data.map((d) => ({ market: d.market, first: new Date(d.first * 1000).toISOString().slice(0, 10), last: new Date(d.last * 1000).toISOString().slice(0, 10),
      signals: d.signals, sims: d.sims, dropped: d.dropped, bad: d.bad, small: d.small, open: d.open })),
    primary: J.prim.map((q, i) => ({ id: q.id, test: q.test, diffD: r6(q.diffD), tD: r6(q.tD), diffC: r6(q.diffC), tC: r6(q.tC), holm: r6(q.holm), holds: q.holds,
      mirror: { diffD: r6(M.prim[i].diffD), tD: r6(M.prim[i].tD), diffC: r6(M.prim[i].diffC), tC: r6(M.prim[i].tC) } })),
    held: held.map((q) => q.id), passedCells: passed.map((x) => x.name),
    cells: J.cells.map((x, i) => ({ cell: x.name, level: x.level, exit: x.exit, control: x.control, disc: slim(x.d), conf: slim(x.c), vsControlD: r6(x.vsD), vsControlC: r6(x.vsC),
      holm: r6(x.holm), pass: x.pass, mirror: { disc: slim(M.cells[i].d), conf: slim(M.cells[i].c) } })),
    perMarket, cut, stage };
  fs.writeFileSync(path.join(HERE, 'result.json'), JSON.stringify(out, null, 1) + '\n');
  fs.writeFileSync(path.join(HERE, 'RESULT.md'), resultMd(out));
  return out;
}

function resultMd(o) {
  const nCut = o.cut.reduce((a, x) => a + x.n, 0), bad = o.cut.reduce((a, x) => a + x.missing + x.extra, 0);
  const sN = o.stage.reduce((a, x) => a + x.n, 0), sS = o.stage.reduce((a, x) => a + x.same, 0);
  const L = [];
  L.push('# Fade of the M15 break, split by the higher timeframes (result)', '', `**Verdict: ${o.verdict}. ${o.headline}.**`, '',
    'Run 23 Nov 2026 as pre-registered (`PREREGISTRATION.md`, committed and pushed alone first). Research only: nothing live',
    'changed, nothing is proposed. One run, no variants.', '',
    '## What was run', '',
    '`grid7-wide-fade`\'s M15 fade (every M15 structure break, entered AGAINST it at the next 5-minute open, stop 1 ATR(14) of M15,',
    'exits 2R or the opposite M15 swing, time limit 1 day), split five ways by what the higher timeframes showed at the break\'s',
    'close (closed candles only): the H1 and H4 last break (same direction as the M15 break / opposite), the H4 stage (phase.mjs\'s',
    'move / pullback / range), whether the break is the first M15 one against a fresh H1 break, and whether its candle ran the prior',
    'New York day\'s high (up) or low (down). Ten markets pooled, discovery 2005-14, confirmation 2015 to October 2026, before costs',
    `on month sums; after costs beside (**ASSUMED, not measured** for ${o.assumedCosts.join(', ')}).`, '',
    '## Primary tests (the level named first was expected higher: the break AGAINST the higher timeframe)', '',
    'Difference of mean R a trade, trade-level Welch t; Holm over the 10 tests on the confirmation t. Mirror = the same split traded',
    'WITH the break.', '',
    '| Test | 2005-14 diff (t) | 2015-26 diff (t) | Holm | Holds | Mirror 2005-14 (t) | Mirror 2015-26 (t) |', '|---|---:|---:|---:|---|---:|---:|');
  for (const q of o.primary) L.push(`| ${q.test} | ${f3(q.diffD)} (${f2(q.tD)}) | ${f3(q.diffC)} (${f2(q.tC)}) | ${f2(q.holm)} | ${q.holds ? 'yes' : 'no'} | ${f3(q.mirror.diffD)} (${f2(q.mirror.tD)}) | ${f3(q.mirror.diffC)} (${f2(q.mirror.tC)}) |`);
  L.push('', `Held: ${o.held.length ? o.held.join('; ') : 'none'}.`, '',
    '## Every cell', '',
    'R a trade before costs (month-sum t), after costs beside; "vs control" = Welch t of the cell against the unsplit rule; a level',
    'cell passes with n >= 300, mean > 0 and month t >= 2 in both windows, Holm < 0.05 over the 22 level cells, and vs control >= 2',
    'in both windows.', '',
    '| Cell | n 05-14 | R 05-14 (t) | net 05-14 | n 15-26 | R 15-26 (t) | net 15-26 | vs control 05-14 / 15-26 | Holm | Mirror R 15-26 (t) | Pass |',
    '|---|---:|---:|---:|---:|---:|---:|---:|---:|---:|---|');
  for (const x of o.cells) L.push(`| ${x.cell} | ${N(x.disc.n)} | ${f3(x.disc.mean)} (${f2(x.disc.t)}) | ${f3(x.disc.meanNet)} | ${N(x.conf.n)} | ${f3(x.conf.mean)} (${f2(x.conf.t)}) | ${f3(x.conf.meanNet)} | ${x.control ? '-' : f2(x.vsControlD) + ' / ' + f2(x.vsControlC)} | ${x.holm == null ? '-' : x.holm.toFixed(3)} | ${f3(x.mirror.conf.mean)} (${f2(x.mirror.conf.t)}) | ${x.control ? 'control' : x.pass ? 'yes' : 'no'} |`);
  L.push('', `Cells passing the cell bar: ${o.passedCells.length ? o.passedCells.join('; ') : 'none'}.`, '');
  if (Object.keys(o.perMarket).length) {
    L.push('## Per market', '', 'Before costs [after costs]; * = cost ASSUMED.', '');
    for (const [name, list] of Object.entries(o.perMarket)) { L.push(`### ${name}`, '', '| Market | n 05-14 | R (t) [net] | n 15-26 | R (t) [net] |', '|---|---:|---:|---:|---:|');
      for (const x of list) L.push(`| ${x.market}${x.assumed ? '*' : ''} | ${N(x.d.n)} | ${f3(x.d.mean)} (${f2(x.d.t)}) [${f3(x.d.meanNet)}] | ${N(x.c.n)} | ${f3(x.c.mean)} (${f2(x.c.t)}) [${f3(x.c.meanNet)}] |`);
      L.push(''); } }
  L.push('## Checks', '',
    `- Cut test: ${o.cut.length} cuts: ${N(nCut)} signals (with their five labels) known by the cut dates, ${bad} missing or extra when the candles are cut there.`,
    `- H4 stage against \`phase.mjs\` \`readPhase\` (600-candle tails) on ${sN} sampled signals: the same stage on ${sS} (${sN ? Math.round((100 * sS) / sN) : 0} %); the rest differ because the tail starts the structure later.`,
    '- Every trade has its stop on the losing side of the fill (the run throws otherwise); a fill at or past the stop and a risk under the round-trip cost are no trades.',
    '- Exclusions: the data-quality audit\'s bad intervals (`combo-grid-2` `exclusions`).', '',
    '| Market | candles from | signals | simulated | dropped (bad data) | past the stop | risk under cost | unresolved |', '|---|---|---:|---:|---:|---:|---:|---:|');
  for (const m of o.meta) L.push(`| ${m.market} | ${m.first} | ${N(m.signals)} | ${N(m.sims)} | ${m.dropped} | ${N(m.bad)} | ${N(m.small)} | ${m.open} |`);
  L.push('', '## What it means', '');
  if (o.verdict === 'PASS') L.push(`${o.held.length} of the pre-registered differences hold in both decades: the fade's before-cost tilt is larger where the M15 break runs`,
    'against that higher-timeframe reading. It stays a before-cost tilt inside a rule that loses after costs (the "net" columns):',
    'it says where the tilt lives, not that anything is tradable. Never an edge; nothing adopted; one run, no variants on these years.');
  else L.push('None of the pre-registered differences holds in both decades: reading the higher timeframes\' structure at the break does',
    'not pick the fades that work better. The unsplit tilt stays a before-cost figure that the spread takes. Nothing adopted;',
    'do not re-test variants of these splits on these years.');
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
