// research/edge/grid7-mosha-fade/run.mjs - the wide Mosha grid of PREREGISTRATION.md (23 Nov 2026): the storyline's CF (BO on the
// upper timeframe, VR = first lower break against it, CF = the next lower break back with it) traded WITH the CF and FADED, on
// H4>H1, H1>M15, M30>M5, CF clear of / inside the VR, exits 1R / 2R / structural; 54 cells, ten markets, discovery 2005-14,
// confirmation 2015 to Oct 2026, judged before costs on month sums and against the plain rule on the same lower timeframe.
// Research only: nothing live imports it, nothing is placed.
//   EDGE_DATA=<cache> node research/edge/grid7-mosha-fade/run.mjs market <m> <outDir>
//   EDGE_DATA=<cache> node research/edge/grid7-mosha-fade/run.mjs cut <m> <outDir>
//   node research/edge/grid7-mosha-fade/run.mjs report <outDir>
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import * as K from '../_lib/edgekit.mjs';
import { COSTS, exclusions } from '../combo-grid-2/run.mjs';
import { atr14, startIdx } from '../dom-trade-through/run.mjs';
import { MARKETS, ASSUMED, FROM, SPLIT, TO, NM, DM, monthOf, mstat, p1, welch } from '../grid7-wide-core/run.mjs';
import { breaks as fadeBreaks, exits, CAP } from '../grid7-wide-fade/run.mjs';
import { frames, storylines, cutFrames, sigKey } from '../grid6-mosha-market/run.mjs';

export { MARKETS, ASSUMED };
const HERE = path.dirname(fileURLToPath(import.meta.url));
export const SIDES = ['with', 'fade'], LADDERS = [['4h', '1h'], ['1h', '15m'], ['30m', '5m']], LNAME = ['H4>H1', 'H1>M15', 'M30>M5'];
export const PLACES = ['any', 'clear', 'inside'], EXITS = ['1R', '2R', 'struct'];
export const ATRK = 0.1, KSW = 3;
export const NCELL = 54, NFLIP = 54, NCTRL = 18, NALL = NCELL + NFLIP + NCTRL;
export const cellIndex = (sd, l, p, x) => ((sd * 3 + l) * 3 + p) * 3 + x;
export const ctrlIndex = (sd, l, x) => NCELL + NFLIP + (sd * 3 + l) * 3 + x;   // l = the ladder's lower timeframe
export function cellName(i) { const x = i % 3; let r = (i - x) / 3; const p = r % 3; r = (r - p) / 3; const l = r % 3; const sd = (r - l) / 3;
  return { side: SIDES[sd], ladder: LNAME[l], place: PLACES[p], exit: EXITS[x], sd, l, p, x, name: `${SIDES[sd]} ${LNAME[l]} ${PLACES[p]} ${EXITS[x]}` }; }
// the control's exit for a cell's exit: fade struct -> the fade rule's swing exit; with struct -> the with control's 2R
export const ctrlOf = (i) => { const n = cellName(i); return ctrlIndex(n.sd, n.l, n.x); };
export const CTRL_NAME = (sd, l, x) => `${SIDES[sd]} control ${LADDERS[l][1]} ${sd === 1 ? ['1R', '2R', 'swing'][x] : ['1R', '2R', '2R (struct)'][x]}`;

// ---- trades of one storyline: [{ sd, s, fi, stop, tg: [1R, 2R, struct] }] ---------------------------------------------------
export function storyTrades(M5, V, atrV, st) {
  const i = st.cfIdx, a = atrV[i]; if (!(a > 0)) return [];
  const fi = startIdx(M5, V[i].e); if (fi >= M5.length) return [];
  const fill = M5[fi].o, d = st.d, out = [];
  const mk = (sd, s, stop, struct) => { const risk = s * (fill - stop); if (!(risk > 0)) return;
    const k = (s * (struct - fill)) / risk; out.push({ sd, s, fi, fill, stop, risk, ks: [1, 2, k >= 1 ? k : NaN] }); };
  mk(0, d, st.vx - d * ATRK * a, st.x);                                   // (a) WITH the CF: stop past the VR leg's extreme
  mk(1, -d, (d > 0 ? V[i].h : V[i].l) + d * ATRK * a, st.L);               // (b) the fade: stop past the CF candle's extreme
  return out;
}

// ---- control trades on one lower timeframe: [{ sd, s, fi, stop, ks }] ------------------------------------------------------
export function controlTrades(M5, V, atrV) {
  const out = [];
  for (const e of fadeBreaks(V, KSW)) { const a = atrV[e.i]; if (!(a > 0)) continue; const fi = startIdx(M5, e.t); if (fi >= M5.length) continue;
    const fill = M5[fi].o, s = -e.dir, stop = (e.dir > 0 ? V[e.i].h : V[e.i].l) + e.dir * ATRK * a, risk = s * (fill - stop);
    if (risk > 0) { const sr = e.opp == null ? NaN : (s * (e.opp - fill)) / risk; out.push({ sd: 1, s, fi, fill, stop, risk, ks: [1, 2, sr > 0 ? sr : NaN] }); } }
  for (const e of K.structure(V, KSW).events) { const a = atrV[e.i]; if (!(a > 0)) continue; const fi = startIdx(M5, e.t); if (fi >= M5.length) continue;
    let raw = e.dir > 0 ? Infinity : -Infinity; for (let q = e.from; q <= e.i; q++) raw = e.dir > 0 ? Math.min(raw, V[q].l) : Math.max(raw, V[q].h);
    const fill = M5[fi].o, s = e.dir, stop = raw - s * ATRK * a, risk = s * (fill - stop);
    if (risk > 0) out.push({ sd: 0, s, fi, fill, stop, risk, ks: [1, 2, 2] }); }
  return out;
}

const inBad = (X, t) => { let lo = 0, hi = X.length; while (lo < hi) { const m = (lo + hi) >> 1; if (X[m][0] <= t) lo = m + 1; else hi = m; } return lo > 0 && t <= X[lo - 1][1]; };
function newAcc() { return { ms: new Float64Array(NALL * NM), msNet: new Float64Array(NALL * NM), n: new Float64Array(NALL * 2), sum: new Float64Array(NALL * 2),
  sq: new Float64Array(NALL * 2), net: new Float64Array(NALL * 2), win: new Float64Array(NALL * 2), cr: new Float64Array(NALL * 2) }; }
function add(A, c, w, m, R, cr) { A.ms[c * NM + m] += R; A.msNet[c * NM + m] += R - cr; A.n[c * 2 + w]++; A.sum[c * 2 + w] += R; A.sq[c * 2 + w] += R * R;
  A.net[c * 2 + w] += R - cr; A.cr[c * 2 + w] += cr; if (R > 0) A.win[c * 2 + w]++; }

export function runMarket(market) {
  const M5 = K.load(market, '5m', { from: '2004-01-01', to: '2026-11-01' }); const F = frames(M5);
  const cost = COSTS[market], X = exclusions(market), A = newAcc(), cache = {};
  const cnt = { storylines: 0, inside: 0, trades: 0, ctrlTrades: 0, dropped: 0, small: 0, open: 0, noStruct: 0 };
  // one simulation: returns false when it was not counted
  const sim = (tr, cells, flipCells, x0) => {
    const t = M5[tr.fi].t; if (t < FROM || t >= TO) return false;
    if (X.length && inBad(X, t)) { cnt.dropped++; return false; }
    if (tr.risk < cost) { cnt.small++; return false; }
    if (!(tr.s * (tr.fill - tr.stop) > 0)) throw new Error('stop on the wrong side');
    const cap = tr.cap, w = t < SPLIT ? 0 : 1, m = monthOf(t), cr = cost / tr.risk;
    const r = exits(M5, tr.s, tr.fi, tr.stop, tr.ks.map((k) => (Number.isFinite(k) ? tr.fill + tr.s * k * tr.risk : NaN)), cap);
    const p = flipCells ? exits(M5, -tr.s, tr.fi, tr.fill + tr.s * tr.risk, tr.ks.map((k) => (Number.isFinite(k) ? tr.fill - tr.s * k * tr.risk : NaN)), cap) : null;
    if (!r || (flipCells && !p)) { cnt.open++; return false; }
    for (let x = 0; x < 3; x++) { if (!Number.isFinite(tr.ks[x])) { if (x === 2 && x0 === 'cell') cnt.noStruct++; continue; }
      for (const c of cells(x)) add(A, c, w, m, r.R[x], cr);
      if (flipCells) for (const c of flipCells(x)) add(A, c, w, m, p.R[x], cr); }
    return true;
  };
  LADDERS.forEach(([h, v], l) => {
    const V = F[v], atrV = atr14(V), cap = CAP[v];
    const S = storylines(F, h, v, 'any', [], cache); cnt.storylines += S.length;
    for (const st of S) { if (st.inside) cnt.inside++;
      for (const tr of storyTrades(M5, V, atrV, st)) { tr.cap = cap; const pl = st.inside ? 2 : 1;
        if (sim(tr, (x) => [cellIndex(tr.sd, l, 0, x), cellIndex(tr.sd, l, pl, x)], (x) => [NCELL + cellIndex(tr.sd, l, 0, x), NCELL + cellIndex(tr.sd, l, pl, x)], 'cell')) cnt.trades++; } }
    for (const tr of controlTrades(M5, V, atrV)) { tr.cap = cap; if (sim(tr, (x) => [ctrlIndex(tr.sd, l, x)], null, 'ctrl')) cnt.ctrlTrades++; }
  });
  const J = (Z) => Object.fromEntries(Object.entries(Z).map(([k, v]) => [k, Array.from(v, (z) => +z.toFixed(6))]));
  return { market, cost, assumed: ASSUMED.includes(market), first: M5.length ? M5[0].t : null, last: M5.length ? M5[M5.length - 1].t : null, ...cnt, acc: J(A) };
}

// ---- cut test: storylines known by a date equal the ones computed on candles cut there ---------------------------------------
export function cutTest(market, cuts = ['2008-06-11', '2012-03-14', '2016-09-21', '2021-02-17', '2025-05-07']) {
  const M5 = K.load(market, '5m', { from: '2004-01-01', to: '2026-11-01' }); const Fw = frames(M5), cw = {};
  const whole = LADDERS.map(([h, v]) => storylines(Fw, h, v, 'any', [], cw)); const out = [];
  for (const c of cuts) { const T = Date.parse(c + 'T00:00:00Z') / 1000; const Fc = cutFrames(M5, T), cc = {}; let n = 0, bad = 0;
    LADDERS.forEach(([h, v], l) => { const a = whole[l].filter((s) => s.T <= T).map(sigKey), b = storylines(Fc, h, v, 'any', [], cc).filter((s) => s.T <= T).map(sigKey);
      n += a.length; const B = new Set(b), Aset = new Set(a); bad += a.filter((k) => !B.has(k)).length + b.filter((k) => !Aset.has(k)).length; });
    out.push({ market, cut: c, n, mismatches: bad }); }
  return out;
}

// ---- pooled statistics ------------------------------------------------------------------------------------------------------
export function pool(list) { const A = newAcc(); for (const d of list) for (const k of Object.keys(A)) for (let i = 0; i < A[k].length; i++) A[k][i] += d.acc[k][i]; return A; }
export function cellStats(A, c) {
  const ms = A.ms.subarray(c * NM, (c + 1) * NM), msn = A.msNet.subarray(c * NM, (c + 1) * NM);
  const win = (w) => { const n = A.n[c * 2 + w], a = w ? DM : 0, b = w ? NM : DM;
    return { n, sum: A.sum[c * 2 + w], sq: A.sq[c * 2 + w], mean: n ? A.sum[c * 2 + w] / n : null, t: mstat(ms, a, b).t, meanNet: n ? A.net[c * 2 + w] / n : null,
      tNet: mstat(msn, a, b).t, win: n ? A.win[c * 2 + w] / n : null, costR: n ? A.cr[c * 2 + w] / n : null, months: b - a }; };
  return { d: win(0), c: win(1) };
}
const bar3 = (s) => s.d.n >= 300 && s.c.n >= 300 && s.d.mean > 0 && s.c.mean > 0 && s.d.t >= 2 && s.c.t >= 2;
export function judge(data) {
  const A = pool(data); const rows = [];
  for (let c = 0; c < NCELL; c++) { const s = cellStats(A, c), f = cellStats(A, NCELL + c), k = cellStats(A, ctrlOf(c));
    rows.push({ cell: c, ...cellName(c), d: s.d, c: s.c, p: p1(s.c.t, s.c.months - 1), flip: f, ctrl: k, ctrlName: CTRL_NAME(cellName(c).sd, cellName(c).l, cellName(c).x),
      wD: welch(s.d, k.d), wC: welch(s.c, k.c) }); }
  const H = K.holm(rows.map((r) => r.p)), HF = K.holm(rows.map((r) => p1(r.flip.c.t, r.flip.c.months - 1)));
  rows.forEach((r, i) => { r.holm = H[i]; r.flipHolm = HF[i];
    r.checks = { n: r.d.n >= 300 && r.c.n >= 300, disc: r.d.mean > 0 && r.d.t >= 2, conf: r.c.mean > 0 && r.c.t >= 2, holm: H[i] < 0.05,
      control: r.wD != null && r.wC != null && r.wD >= 2 && r.wC >= 2 };
    r.pass = Object.values(r.checks).every(Boolean); r.flipPass = bar3(r.flip) && HF[i] < 0.05; });
  const ctrls = []; for (let sd = 0; sd < 2; sd++) for (let l = 0; l < 3; l++) for (let x = 0; x < 3; x++) { if (sd === 0 && x === 2) continue;
    ctrls.push({ name: CTRL_NAME(sd, l, x), ...cellStats(A, ctrlIndex(sd, l, x)) }); }
  return { rows, ctrls };
}

const f3 = (x) => (x == null || !Number.isFinite(x) ? 'n/a' : (x >= 0 ? '+' : '-') + Math.abs(x).toFixed(3)), f2 = (x) => (x == null || !Number.isFinite(x) ? 'n/a' : x.toFixed(2));
const N = (x) => Math.round(x).toLocaleString('en-US');
const slim = (w) => ({ n: w.n, mean: w.mean == null ? null : +w.mean.toFixed(6), t: +w.t.toFixed(4), meanNet: w.meanNet == null ? null : +w.meanNet.toFixed(6),
  tNet: +w.tNet.toFixed(2), win: w.win == null ? null : +w.win.toFixed(3), costR: w.costR == null ? null : +w.costR.toFixed(4) });

export function report(dir) {
  const data = MARKETS.filter((m) => fs.existsSync(path.join(dir, m + '.json'))).map((m) => JSON.parse(fs.readFileSync(path.join(dir, m + '.json'), 'utf8')));
  const cut = MARKETS.flatMap((m) => { const f = path.join(dir, 'cut-' + m + '.json'); return fs.existsSync(f) ? JSON.parse(fs.readFileSync(f, 'utf8')) : []; });
  const { rows, ctrls } = judge(data); const pass = rows.filter((r) => r.pass);
  const verdict = data.length < 8 ? 'INCONCLUSIVE' : pass.length ? 'PASS' : 'FAIL';
  const bar13 = rows.filter((r) => r.checks.n && r.checks.disc && r.checks.conf && r.checks.holm);
  const best = [...rows].sort((a, b) => b.c.t - a.c.t)[0], b = pass.length ? [...pass].sort((p, q) => q.c.t - p.c.t)[0] : best;
  const headline = verdict === 'PASS'
    ? `${pass.length} of 54 cells pass before costs and beat their control; best ${b.name}, ${f3(b.c.mean)}R a trade in 2015-26 (n ${N(b.c.n)}, month t ${f2(b.c.t)}), ${f3(b.c.meanNet)}R after costs`
    : `0 of 54 cells pass; ${bar13.length} clear the before-cost bar but none beats its control in both windows; best confirmation cell ${b.name}, ${f3(b.c.mean)}R a trade before costs in 2015-26 (n ${N(b.c.n)}, month t ${f2(b.c.t)}), ${f3(b.c.meanNet)}R after costs`;
  const perMarket = {}; for (const r of pass) perMarket[r.name] = data.map((d) => { const s = cellStats(pool([d]), r.cell); return { market: d.market, assumed: d.assumed, d: slim(s.d), c: slim(s.c) }; });
  const out = { study: 'grid7-mosha-fade', built: '2026-11-23', verdict, headline,
    basis: 'judged before costs on calendar-month sums and against the plain rule on the same lower timeframe (pre-registered); after costs beside',
    windows: { discovery: '2005-01-01 to 2014-12-31 (120 months)', confirmation: '2015-01-01 to 2026-10-31 (142 months)' },
    markets: data.map((d) => d.market), assumedCosts: ASSUMED, costs: Object.fromEntries(data.map((d) => [d.market, d.cost])),
    meta: data.map((d) => ({ market: d.market, first: new Date(d.first * 1000).toISOString().slice(0, 10), last: new Date(d.last * 1000).toISOString().slice(0, 10),
      storylines: d.storylines, inside: d.inside, trades: d.trades, ctrlTrades: d.ctrlTrades, dropped: d.dropped, small: d.small, open: d.open, noStruct: d.noStruct })),
    passed: pass.map((r) => r.name), clearBeforeCostBar: bar13.map((r) => r.name), flipPassed: rows.filter((r) => r.flipPass).map((r) => r.name),
    passedNetPositive: pass.filter((r) => r.d.meanNet > 0 && r.c.meanNet > 0).map((r) => r.name), bestConfirmation: best.name,
    cut, cells: rows.map((r) => ({ cell: r.name, side: r.side, ladder: r.ladder, place: r.place, exit: r.exit, disc: slim(r.d), conf: slim(r.c), holm: +r.holm.toFixed(4),
      control: { name: r.ctrlName, disc: slim(r.ctrl.d), conf: slim(r.ctrl.c) }, welch: { disc: r.wD == null ? null : +r.wD.toFixed(2), conf: r.wC == null ? null : +r.wC.toFixed(2) },
      checks: r.checks, pass: r.pass, flip: { disc: slim(r.flip.d), conf: slim(r.flip.c), holm: +r.flipHolm.toFixed(4), pass: r.flipPass } })),
    controls: ctrls.map((k) => ({ name: k.name, disc: slim(k.d), conf: slim(k.c) })), perMarket };
  fs.writeFileSync(path.join(HERE, 'result.json'), JSON.stringify(out, null, 1) + '\n');
  fs.writeFileSync(path.join(HERE, 'RESULT.md'), resultMd(out, rows, ctrls));
  return out;
}

function resultMd(o, rows, ctrls) {
  const nCut = o.cut.reduce((a, x) => a + x.n, 0), bad = o.cut.reduce((a, x) => a + x.mismatches, 0);
  const cnt = (f) => rows.filter(f).length; const L = [];
  L.push('# Wide Mosha grid: the storyline\'s CF traded with it and faded (result)', '', `**Verdict: ${o.verdict}. ${o.headline}.**`, '',
    'Run 23 Nov 2026 as pre-registered (`PREREGISTRATION.md`, committed and pushed alone first). Research only: nothing live',
    'changed, nothing is proposed. One run, no variants.', '',
    '## What was run', '',
    'The storyline of `grid6-mosha-market` (imported): a BO = a structure break on the upper timeframe; the VR = the first',
    'lower-timeframe break against it; the CF = the next lower-timeframe break back with it (3 candles a side, closed candles',
    'only). Ladders H4>H1, H1>M15, M30>M5. At the next 5-minute open after the CF candle\'s close: (a) WITH the CF, stop past the VR',
    'leg\'s extreme + 0.1 ATR, exits 1R / 2R / the move\'s extreme; (b) the FADE, stop past the CF candle\'s extreme + 0.1 ATR, exits',
    '1R / 2R / the BO level (a structural target only when 1R or more away). CF place: any, clear of the VR box, inside it. 54 cells.',
    'Controls on the same lower timeframe: (b) every structure break faded (`grid7-wide-fade`\'s rule, "ext" stop; struct against its',
    'swing exit); (a) every structure break traded with it, stop past the break leg\'s origin (struct against its 2R). Ten markets',
    'pooled, OANDA mid 5-minute candles; discovery = fills 2005-2014, confirmation = 2015 to October 2026; before costs on month',
    `sums, Holm over 54. Costs beside: demo figures for gold and the four majors; **ASSUMED, not measured** for ${o.assumedCosts.join(', ')}.`, '',
    '## The bar, cell by cell', '',
    `- n >= 300 in both windows: ${cnt((r) => r.checks.n)} of 54.`,
    `- Mean R > 0 and month t >= 2 in discovery: ${cnt((r) => r.checks.disc)}; in confirmation: ${cnt((r) => r.checks.conf)}; both: ${cnt((r) => r.checks.disc && r.checks.conf)}.`,
    `- Holm-adjusted p < 0.05: ${cnt((r) => r.checks.holm)}.`,
    `- Bars 1-3 (the before-cost bar): ${o.clearBeforeCostBar.length}${o.clearBeforeCostBar.length ? ' (' + o.clearBeforeCostBar.join('; ') + ')' : ''}.`,
    `- Beat the control (Welch t >= 2 in both windows): ${cnt((r) => r.checks.control)}.`,
    `- **All five: ${o.passed.length}${o.passed.length ? ' (' + o.passed.join('; ') + ')' : ''}.**`,
    `- Side-flipped cells clearing bars 1-3 with Holm: ${o.flipPassed.length}${o.flipPassed.length ? ' (' + o.flipPassed.join('; ') + ')' : ''}.`, '',
    '## Every cell', '',
    'R a trade before costs (month-sum t), after costs beside; Welch = the cell against its control, per trade, before costs.', '',
    '| Cell | n 05-14 | R 05-14 (t) | net 05-14 | n 15-26 | R 15-26 (t) | net 15-26 | Holm | Control R 05-14 / 15-26 | Welch 05-14 / 15-26 | Flipped R 15-26 (t) | Pass |',
    '|---|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|---|');
  for (const r of rows) L.push(`| ${r.name} | ${N(r.d.n)} | ${f3(r.d.mean)} (${f2(r.d.t)}) | ${f3(r.d.meanNet)} | ${N(r.c.n)} | ${f3(r.c.mean)} (${f2(r.c.t)}) | ${f3(r.c.meanNet)} | ${r.holm.toFixed(3)} | ${f3(r.ctrl.d.mean)} / ${f3(r.ctrl.c.mean)} | ${f2(r.wD)} / ${f2(r.wC)} | ${f3(r.flip.c.mean)} (${f2(r.flip.c.t)}) | ${r.pass ? 'yes' : 'no'} |`);
  L.push('', '## The controls', '', '| Control | n 05-14 | R 05-14 (t) | net 05-14 | n 15-26 | R 15-26 (t) | net 15-26 |', '|---|---:|---:|---:|---:|---:|---:|');
  for (const k of ctrls) L.push(`| ${k.name} | ${N(k.d.n)} | ${f3(k.d.mean)} (${f2(k.d.t)}) | ${f3(k.d.meanNet)} | ${N(k.c.n)} | ${f3(k.c.mean)} (${f2(k.c.t)}) | ${f3(k.c.meanNet)} |`);
  L.push('');
  if (o.passed.length) { L.push('## Per market, passing cells', '', 'Before costs (after costs in brackets); * = cost ASSUMED.', '');
    for (const [name, list] of Object.entries(o.perMarket)) { L.push(`### ${name}`, '', '| Market | n 05-14 | R (t) [net] | n 15-26 | R (t) [net] |', '|---|---:|---:|---:|---:|');
      for (const x of list) L.push(`| ${x.market}${x.assumed ? '*' : ''} | ${N(x.d.n)} | ${f3(x.d.mean)} (${f2(x.d.t)}) [${f3(x.d.meanNet)}] | ${N(x.c.n)} | ${f3(x.c.mean)} (${f2(x.c.t)}) [${f3(x.c.meanNet)}] |`);
      L.push(''); } }
  L.push('## Checks', '',
    `- Cut test: ${o.cut.length} cuts on ${[...new Set(o.cut.map((x) => x.market))].join(', ') || 'none'}: ${N(nCut)} storylines known by the cut dates, ${bad} missing or extra when the candles are cut there.`,
    '- Every trade has its stop on the losing side of the fill (the run throws otherwise); a fill at or past the stop and a risk under the round-trip cost are no trades (cells, flips and controls alike).',
    '- The fade cells\' CF breaks are among the control\'s breaks, so each fade cell is a subset of its control (the Welch t compares a subset with the whole: it can only understate a real difference a little).', '',
    '| Market | candles from | storylines | CF inside the VR | cell trades | control trades | dropped (bad data) | risk under cost | unresolved | no struct target |', '|---|---|---:|---:|---:|---:|---:|---:|---:|---:|');
  for (const m of o.meta) L.push(`| ${m.market} | ${m.first} | ${N(m.storylines)} | ${N(m.inside)} | ${N(m.trades)} | ${N(m.ctrlTrades)} | ${N(m.dropped)} | ${N(m.small)} | ${N(m.open)} | ${N(m.noStruct)} |`);
  L.push('', '## What it means', '');
  if (o.verdict === 'PASS') L.push(`${o.passed.length} cell(s) clear every pre-registered check before costs, including beating the plain rule on the same lower`,
    `timeframe. ${o.passedNetPositive.length ? o.passedNetPositive.length + ' stay positive after costs in both windows.' : 'None stays positive after costs in both windows.'} A before-cost result on one run of a fixed grid:`,
    'a hypothesis for its own holdout or forward record, never an edge. Nothing live changed.');
  else L.push('No cell clears every check. Where the storyline\'s fade looks positive before costs it is the general fade tilt of',
    '`grid7-wide-fade` (its control does as well or better), and the storyline traded with the CF does not make money before costs.',
    'The grid-6 placebo result is explained by the general fade of a structure break, not by the storyline. Do not re-test',
    'variants of these cells on these years. Nothing live changed; no rule is proposed.');
  L.push('');
  return L.join('\n');
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const [cmd, a, b] = process.argv.slice(2);
  if (cmd === 'market') { fs.mkdirSync(b, { recursive: true }); const t0 = Date.now(); const r = runMarket(a);
    fs.writeFileSync(path.join(b, a + '.json'), JSON.stringify(r)); console.log(a, 'storylines', r.storylines, 'trades', r.trades, 'ctrl', r.ctrlTrades, ((Date.now() - t0) / 1000).toFixed(0) + 's'); }
  else if (cmd === 'cut') { fs.mkdirSync(b, { recursive: true }); const r = cutTest(a); fs.writeFileSync(path.join(b, 'cut-' + a + '.json'), JSON.stringify(r)); console.log(JSON.stringify(r)); }
  else if (cmd === 'report') { const o = report(a); console.log(o.verdict, o.headline); }
  else console.log('usage: run.mjs market <m> <dir> | cut <m> <dir> | report <dir>');
}
