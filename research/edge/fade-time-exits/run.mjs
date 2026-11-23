// research/edge/fade-time-exits/run.mjs - the fade over time (PREREGISTRATION.md, 23 Nov 2026): the grid7-wide-fade rule
// "none atr" on M5 / M15 / H1 (primary: M15), marked to market at 5, 15, 30, 60, 120, 240 minutes and 1 day after the fill
// (stop first), time exits at 15 / 30 / 60 / 240 minutes, beside the grid's 2R and swing exits; ten markets, discovery
// 2005-14, confirmation 2015 to Oct 2026, judged before costs on month sums. Research only: nothing live imports it.
//   EDGE_DATA=<cache> node research/edge/fade-time-exits/run.mjs market <m> <outDir>
//   EDGE_DATA=<cache> node research/edge/fade-time-exits/run.mjs cut <m> <outDir>
//   node research/edge/fade-time-exits/run.mjs report <outDir>
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import * as K from '../_lib/edgekit.mjs';
import { frames } from '../combo-grid-3/run.mjs';
import { COSTS, exclusions } from '../combo-grid-2/run.mjs';
import { startIdx } from '../dom-trade-through/run.mjs';
import { MARKETS, ASSUMED, FROM, SPLIT, TO, NM, DM, monthOf, mstat, p1 } from '../grid7-wide-core/run.mjs';
import { signals, exits, cutTest as gridCut, CAP } from '../grid7-wide-fade/run.mjs';

export { MARKETS, ASSUMED };
const HERE = path.dirname(fileURLToPath(import.meta.url));
export const TFS = ['5m', '15m', '1h'], TFN = ['m5', 'm15', 'h1'], PRIMARY_TF = 1;
export const MARKS = [5, 15, 30, 60, 120, 240, 1440];                  // minutes after the fill
export const TEX = [15, 30, 60, 240];                                  // the four time exits (primary, M15)
export const TEXI = TEX.map((x) => MARKS.indexOf(x));
// series per timeframe: 0..6 marks, 7 = 2R, 8 = swing, 9..12 = time exit - 2R, 13..16 = time exit - swing (swing trades only)
export const S2R = 7, SSW = 8, SD2R = 9, SDSW = 13, NS = 17;
export const SERIES = [...MARKS.map((x) => (x === 1440 ? '1 day' : x + ' min')), '2R', 'swing', ...TEX.map((x) => `${x} min - 2R`), ...TEX.map((x) => `${x} min - swing`)];
export const PIP = { xau: 0.1, xag: 0.01, usdjpy: 0.01, eurjpy: 0.01 };
export const pipOf = (m) => PIP[m] || 0.0001;

// ---- marks: R at the open of the first 5m candle starting at or after fill + X min; stop first (only candles that end by
// fill + X decide a stop; of the mark candle only the open is read). Returns { R: [..], px: [..] } or null (data ends). ------
export function marksOf(M5, s, fi, stop, mins = MARKS) {
  const fill = M5[fi].o, t0 = M5[fi].t, risk = s * (fill - stop); if (!(risk > 0)) return null;
  const R = new Array(mins.length), px = new Array(mins.length); let j = fi, out = null;
  for (let k = 0; k < mins.length; k++) {
    const T = t0 + mins[k] * 60;
    while (out == null && j < M5.length && M5[j].t < T) { const b = M5[j];
      if (j > fi && s * (b.o - stop) <= 0) out = b.o;                // a gap through the stop fills at the open
      else if (s * ((s > 0 ? b.l : b.h) - stop) <= 0) out = stop;
      j++; }
    if (out == null) { while (j < M5.length && M5[j].t < T) j++; if (j >= M5.length) return null; }
    const p = out != null ? out : M5[j].o; R[k] = (s * (p - fill)) / risk; px[k] = s * (p - fill);
  }
  return { fill, risk, R, px };
}

const inBad = (X, t) => { let lo = 0, hi = X.length; while (lo < hi) { const m = (lo + hi) >> 1; if (X[m][0] <= t) lo = m + 1; else hi = m; } return lo > 0 && t <= X[lo - 1][1]; };
const NC = TFS.length * NS;
function newAcc() { return { ms: new Float64Array(NC * NM), msNet: new Float64Array(NC * NM), n: new Float64Array(NC * 2), sum: new Float64Array(NC * 2),
  sq: new Float64Array(NC * 2), net: new Float64Array(NC * 2), win: new Float64Array(NC * 2), cr: new Float64Array(NC * 2), mv: new Float64Array(NC * 2), rk: new Float64Array(NC * 2) }; }
function add(A, c, w, m, R, cr, mv, rk) { A.ms[c * NM + m] += R; A.msNet[c * NM + m] += R - cr; A.n[c * 2 + w]++; A.sum[c * 2 + w] += R; A.sq[c * 2 + w] += R * R;
  A.net[c * 2 + w] += R - cr; A.cr[c * 2 + w] += cr; if (R > 0) A.win[c * 2 + w]++; A.mv[c * 2 + w] += mv; A.rk[c * 2 + w] += rk; }

export function runMarket(market) {
  const M5 = K.load(market, '5m', { from: '2004-01-01', to: '2026-11-01' }); const F = frames(M5);
  const sigs = signals(F).filter((g) => g.cx === 0), cost = COSTS[market], X = exclusions(market), A = newAcc();
  let dropped = 0, bad = 0, small = 0, open = 0, used = 0;
  for (const g of sigs) {
    const fi = startIdx(M5, g.ts); if (fi >= M5.length) continue; const t = M5[fi].t; if (t < FROM || t >= TO) continue;
    if (X.length && inBad(X, t)) { dropped++; continue; }
    const fill = M5[fi].o, s = -g.d, stop = fill + g.d * g.a, risk = s * (fill - stop);
    if (!(risk > 0)) { bad++; continue; }
    if (risk < cost) { small++; continue; }
    if (!(s * (fill - stop) > 0)) throw new Error('stop on the wrong side');
    const sr = g.opp == null ? NaN : (s * (g.opp - fill)) / risk; const ks = [2, sr > 0 ? sr : NaN];
    const r = exits(M5, s, fi, stop, ks.map((k) => (Number.isFinite(k) ? fill + s * k * risk : NaN)), CAP[TFS[g.tf]]);
    const mk = marksOf(M5, s, fi, stop);
    if (!r || !mk || !Number.isFinite(r.R[0])) { open++; continue; }
    used++; const cr = cost / risk, m = monthOf(t), w = t < SPLIT ? 0 : 1, base = g.tf * NS;
    for (let k = 0; k < MARKS.length; k++) add(A, base + k, w, m, mk.R[k], cr, mk.px[k], risk);
    add(A, base + S2R, w, m, r.R[0], cr, r.R[0] * risk, risk);
    const sw = Number.isFinite(r.R[1]); if (sw) add(A, base + SSW, w, m, r.R[1], cr, r.R[1] * risk, risk);
    TEXI.forEach((k, i) => { const d = mk.R[k] - r.R[0]; add(A, base + SD2R + i, w, m, d, 0, d * risk, risk);
      if (sw) { const e = mk.R[k] - r.R[1]; add(A, base + SDSW + i, w, m, e, 0, e * risk, risk); } });
  }
  const J = (o) => Object.fromEntries(Object.entries(o).map(([k, v]) => [k, Array.from(v, (z) => +z.toPrecision(10))]));
  return { market, cost, pip: pipOf(market), assumed: ASSUMED.includes(market), first: M5.length ? M5[0].t : null, last: M5.length ? M5[M5.length - 1].t : null,
    signals: sigs.length, used, dropped, bad, small, open, acc: J(A) };
}

// ---- cut tests: the grid's signal cut test, and marks recomputed on candles cut at each mark (mark candle's high, low,
// close replaced) equal the full run's ------------------------------------------------------------------------------------
export function markCut(market, nMax = 400) {
  const M5 = K.load(market, '5m', { from: '2004-01-01', to: '2026-11-01' }); const F = frames(M5);
  const sigs = signals(F).filter((g) => g.cx === 0 && g.tf === PRIMARY_TF); let n = 0, diff = 0; const step = Math.max(1, Math.floor(sigs.length / nMax));
  for (let q = 0; q < sigs.length && n < nMax; q += step) { const g = sigs[q]; const fi = startIdx(M5, g.ts); if (fi >= M5.length) continue;
    const s = -g.d, stop = M5[fi].o + g.d * g.a; const full = marksOf(M5, s, fi, stop); if (!full) continue;
    MARKS.forEach((x, k) => { const T = M5[fi].t + x * 60; const j = startIdx(M5, T); const cut = M5.slice(fi, j + 1).map((b) => ({ ...b }));   // nothing after the mark candle
      const last = cut[cut.length - 1]; last.h = last.o + 1e9; last.l = last.o - 1e9; last.c = NaN;   // only the open may be read
      const one = marksOf(cut, s, 0, stop, [x]); if (!one || Math.abs(one.R[0] - full.R[k]) > 1e-12) diff++; });
    n++; }
  return { market, trades: n, marks: n * MARKS.length, diff };
}

// ---- statistics ------------------------------------------------------------------------------------------------------------
export function pool(list) { const A = newAcc(); for (const d of list) for (const k of Object.keys(A)) for (let i = 0; i < A[k].length; i++) A[k][i] += d.acc[k][i]; return A; }
export function seriesStats(A, c) {
  const ms = A.ms.subarray(c * NM, (c + 1) * NM), msn = A.msNet.subarray(c * NM, (c + 1) * NM);
  const win = (w) => { const n = A.n[c * 2 + w], a = w ? DM : 0, b = w ? NM : DM;
    return { n, mean: n ? A.sum[c * 2 + w] / n : null, t: mstat(ms, a, b).t, meanNet: n ? A.net[c * 2 + w] / n : null, tNet: mstat(msn, a, b).t,
      win: n ? A.win[c * 2 + w] / n : null, costR: n ? A.cr[c * 2 + w] / n : null, move: n ? A.mv[c * 2 + w] / n : null, risk: n ? A.rk[c * 2 + w] / n : null, months: b - a }; };
  return { d: win(0), c: win(1) };
}
export const passOf = (x, h) => x.d.n >= 300 && x.c.n >= 300 && x.d.mean > 0 && x.c.mean > 0 && x.d.t >= 2 && x.c.t >= 2 && h < 0.05;
export function judge(data) {
  const A = pool(data), base = PRIMARY_TF * NS;
  const rows = TEX.map((x, i) => { const s = seriesStats(A, base + TEXI[i]); return { exit: `${x} min`, mins: x, d: s.d, c: s.c, p: p1(s.c.t, s.c.months - 1),
    vs2R: seriesStats(A, base + SD2R + i), vsSwing: seriesStats(A, base + SDSW + i) }; });
  const H = K.holm(rows.map((r) => r.p));
  rows.forEach((r, i) => { r.holm = H[i]; r.checks = { n: r.d.n >= 300 && r.c.n >= 300, disc: r.d.mean > 0 && r.d.t >= 2, conf: r.c.mean > 0 && r.c.t >= 2, holm: H[i] < 0.05 };
    r.pass = passOf(r, H[i]); });
  return { A, rows };
}

const f3 = (x) => (x == null ? 'n/a' : (x >= 0 ? '+' : '-') + Math.abs(x).toFixed(3)), f2 = (x) => (x == null || !Number.isFinite(x) ? 'n/a' : x.toFixed(2)), N = (x) => Math.round(x).toLocaleString('en-US');
const slim = (w) => ({ n: w.n, mean: w.mean == null ? null : +w.mean.toFixed(6), t: +w.t.toFixed(4), meanNet: w.meanNet == null ? null : +w.meanNet.toFixed(6),
  tNet: +w.tNet.toFixed(2), win: w.win == null ? null : +w.win.toFixed(3), costR: w.costR == null ? null : +w.costR.toFixed(4) });

export function report(dir) {
  const data = MARKETS.filter((m) => fs.existsSync(path.join(dir, m + '.json'))).map((m) => JSON.parse(fs.readFileSync(path.join(dir, m + '.json'), 'utf8')));
  const cut = MARKETS.flatMap((m) => { const f = path.join(dir, 'cut-' + m + '.json'); return fs.existsSync(f) ? [JSON.parse(fs.readFileSync(f, 'utf8'))] : []; });
  const { A, rows } = judge(data), pass = rows.filter((r) => r.pass);
  const verdict = data.length < 8 ? 'INCONCLUSIVE' : pass.length ? 'PASS' : 'FAIL';
  const curve = TFN.map((tfn, tf) => ({ tf: tfn, primary: tf === PRIMARY_TF, series: [...MARKS.map((x, k) => k), S2R, SSW].map((k) => { const s = seriesStats(A, tf * NS + k);
    return { at: SERIES[k], disc: slim(s.d), conf: slim(s.c) }; }) }));
  const pips = data.map((d) => { const P = pool([d]); const o = { market: d.market, assumed: d.assumed, pip: d.pip, costPips: +(d.cost / d.pip).toFixed(2) };
    const r = seriesStats(P, PRIMARY_TF * NS); o.n = r.d.n + r.c.n; o.riskPips = o.n ? +(((r.d.risk || 0) * r.d.n + (r.c.risk || 0) * r.c.n) / o.n / d.pip).toFixed(2) : null;
    o.move = MARKS.map((x, k) => { const s = seriesStats(P, PRIMARY_TF * NS + k); const n = s.d.n + s.c.n;
      return { at: SERIES[k], pips: n ? +(((s.d.move || 0) * s.d.n + (s.c.move || 0) * s.c.n) / n / d.pip).toFixed(3) : null,
        disc: s.d.move == null ? null : +(s.d.move / d.pip).toFixed(3), conf: s.c.move == null ? null : +(s.c.move / d.pip).toFixed(3) }; });
    return o; });
  const perMarket = {}; for (const r of pass) perMarket[r.exit] = data.map((d) => { const s = seriesStats(pool([d]), PRIMARY_TF * NS + MARKS.indexOf(r.mins));
    return { market: d.market, assumed: d.assumed, d: slim(s.d), c: slim(s.c) }; });
  const best = [...rows].sort((a, b) => b.c.t - a.c.t)[0], b = pass.length ? [...pass].sort((x, y) => y.c.t - x.c.t)[0] : best;
  const r2 = seriesStats(A, PRIMARY_TF * NS + S2R);
  const headline = verdict === 'PASS'
    ? `${pass.length} of 4 time exits of m15 none atr pass before costs; best ${b.exit}, ${f3(b.c.mean)}R a trade in 2015-26 (n ${N(b.c.n)}, month t ${f2(b.c.t)}; discovery ${f3(b.d.mean)}R, t ${f2(b.d.t)}), ${f3(b.c.meanNet)}R after costs`
    : `0 of 4 time exits of m15 none atr pass before costs; the best, ${b.exit}, made ${f3(b.c.mean)}R a trade in 2015-26 (n ${N(b.c.n)}, month t ${f2(b.c.t)}; discovery ${f3(b.d.mean)}R, t ${f2(b.d.t)})`;
  const out = { study: 'fade-time-exits', built: '2026-11-23', verdict, headline, rule: 'grid7-wide-fade m15 none atr (fade the first M15 structure break, market entry, stop 1 x ATR(14) of M15)',
    basis: 'judged before costs on calendar-month sums (pre-registered); after costs beside',
    windows: { discovery: '2005-01-01 to 2014-12-31 (120 months)', confirmation: '2015-01-01 to 2026-10-31 (142 months)' }, markets: data.map((d) => d.market),
    assumedCosts: ASSUMED, costs: Object.fromEntries(data.map((d) => [d.market, d.cost])),
    meta: data.map((d) => ({ market: d.market, first: new Date(d.first * 1000).toISOString().slice(0, 10), last: new Date(d.last * 1000).toISOString().slice(0, 10),
      signals: d.signals, used: d.used, dropped: d.dropped, bad: d.bad, small: d.small, open: d.open })),
    passed: pass.map((r) => r.exit), passedNetPositive: pass.filter((r) => r.d.meanNet > 0 && r.c.meanNet > 0).map((r) => r.exit),
    grid2R: { disc: slim(r2.d), conf: slim(r2.c) },
    timeExits: rows.map((r) => ({ exit: r.exit, disc: slim(r.d), conf: slim(r.c), p: +r.p.toPrecision(4), holm: +r.holm.toPrecision(4), checks: r.checks, pass: r.pass,
      vs2R: { disc: slim(r.vs2R.d), conf: slim(r.vs2R.c) }, vsSwing: { disc: slim(r.vsSwing.d), conf: slim(r.vsSwing.c) } })),
    curve, pips, perMarket, cut };
  fs.writeFileSync(path.join(HERE, 'result.json'), JSON.stringify(out, null, 1) + '\n');
  fs.writeFileSync(path.join(HERE, 'RESULT.md'), resultMd(out));
  return out;
}

function resultMd(o) {
  const L = []; const C = o.curve.find((c) => c.primary);
  L.push('# The fade over time: mark-to-market and time exits (result)', '', `**Verdict: ${o.verdict}. ${o.headline}.**`, '',
    'Run 23 Nov 2026 as pre-registered (`PREREGISTRATION.md`, committed and pushed alone first). Research only: nothing live',
    'changed, nothing is proposed. One run, no variants.', '',
    '## What was run', '',
    `The rule of \`grid7-wide-fade\` cell **m15 none atr**, imported unchanged: fade the first M15 structure break (a close beyond the`,
    'last confirmed swing, 3 candles a side), market entry against it at the next 5-minute open, stop 1 x ATR(14) of M15 from the',
    'fill. Marked to market at the open of the first 5-minute candle at or after 5, 15, 30, 60, 120, 240 minutes and 1 day (stop',
    'first: a trade stopped before the mark counts at its stop, -1R or worse on a gap). Time exits at 15 / 30 / 60 / 240 minutes are',
    'those marks; the grid\'s 2R and swing exits beside. Ten markets pooled, OANDA mid 5-minute candles; discovery = fills 2005-14,',
    'confirmation = 2015 to October 2026; judged before costs on month sums, Holm over the 4 confirmation tests.',
    `Costs beside: the demo figures for gold and the four majors; **ASSUMED, not measured** for ${o.assumedCosts.join(', ')}.`, '',
    '## The bar: the four time exits (M15)', '',
    '| Exit | n 05-14 | R 05-14 (t) | net 05-14 | n 15-26 | R 15-26 (t) | net 15-26 | cost R | Holm | Pass |', '|---|---:|---:|---:|---:|---:|---:|---:|---:|---|');
  for (const r of o.timeExits) L.push(`| ${r.exit} | ${N(r.disc.n)} | ${f3(r.disc.mean)} (${f2(r.disc.t)}) | ${f3(r.disc.meanNet)} | ${N(r.conf.n)} | ${f3(r.conf.mean)} (${f2(r.conf.t)}) | ${f3(r.conf.meanNet)} | ${r.conf.costR.toFixed(3)} | ${r.holm.toFixed(3)} | ${r.pass ? 'yes' : 'no'} |`);
  L.push(`| grid 2R (beside) | ${N(o.grid2R.disc.n)} | ${f3(o.grid2R.disc.mean)} (${f2(o.grid2R.disc.t)}) | ${f3(o.grid2R.disc.meanNet)} | ${N(o.grid2R.conf.n)} | ${f3(o.grid2R.conf.mean)} (${f2(o.grid2R.conf.t)}) | ${f3(o.grid2R.conf.meanNet)} | ${o.grid2R.conf.costR.toFixed(3)} | | |`, '',
    `Passed: ${o.passed.length ? o.passed.join(', ') : 'none'}. Of those, positive after costs in both windows: ${o.passedNetPositive.length ? o.passedNetPositive.join(', ') : 'none'}.`, '',
    '## Secondary: each time exit against the grid\'s exits, paired by trade', '',
    'Mean of (time-exit R - other exit R) per trade, month t of the month sums. Costs are the same on both sides of a pair.', '',
    '| Exit | vs 2R 05-14 (t) | vs 2R 15-26 (t) | vs swing 05-14 (t) | vs swing 15-26 (t) |', '|---|---:|---:|---:|---:|');
  for (const r of o.timeExits) L.push(`| ${r.exit} | ${f3(r.vs2R.disc.mean)} (${f2(r.vs2R.disc.t)}) | ${f3(r.vs2R.conf.mean)} (${f2(r.vs2R.conf.t)}) | ${f3(r.vsSwing.disc.mean)} (${f2(r.vsSwing.disc.t)}) | ${f3(r.vsSwing.conf.mean)} (${f2(r.vsSwing.conf.t)}) |`);
  L.push('', '## The curve (descriptive)', '', 'Mean R at each mark before costs (month t), after costs beside. A trade stopped before a mark counts at its stop at that',
    'mark and every later one, so "win" (share of trades above the fill) falls as the hold grows; the 2R and swing rows are the grid\'s exits.', '');
  for (const c of o.curve) { L.push(`### ${c.tf} none atr${c.primary ? ' (the primary rule)' : ''}`, '', '| At | n 05-14 | R 05-14 (t) | net 05-14 | n 15-26 | R 15-26 (t) | net 15-26 | win 15-26 |', '|---|---:|---:|---:|---:|---:|---:|---:|');
    for (const s of c.series) L.push(`| ${s.at} | ${N(s.disc.n)} | ${f3(s.disc.mean)} (${f2(s.disc.t)}) | ${f3(s.disc.meanNet)} | ${N(s.conf.n)} | ${f3(s.conf.mean)} (${f2(s.conf.t)}) | ${f3(s.conf.meanNet)} | ${s.conf.win == null ? 'n/a' : (s.conf.win * 100).toFixed(1) + '%'} |`);
    L.push(''); }
  L.push('## The move in pips (M15), beside the spread', '', 'Mean signed move per trade in the trade\'s direction at each mark, both windows together, in pips (gold: 1 pip = $0.10;',
    'silver $0.01; yen pairs 0.01; other pairs 0.0001), with the mean stop distance and the round-trip cost in pips; * = cost ASSUMED.', '',
    `| Market | stop | cost | ${o.pips[0].move.map((x) => x.at).join(' | ')} |`, `|---|---:|---:|${o.pips[0].move.map(() => '---:').join('|')}|`);
  for (const p of o.pips) L.push(`| ${p.market}${p.assumed ? '*' : ''} | ${p.riskPips} | ${p.costPips} | ${p.move.map((x) => (x.pips == null ? 'n/a' : x.pips.toFixed(2))).join(' | ')} |`);
  if (Object.keys(o.perMarket).length) { L.push('', '## Per market, passing time exits', '', 'Before costs (after costs in brackets); * = cost ASSUMED.', '');
    for (const [name, list] of Object.entries(o.perMarket)) { L.push(`### ${name}`, '', '| Market | n 05-14 | R (t) [net] | n 15-26 | R (t) [net] |', '|---|---:|---:|---:|---:|');
      for (const x of list) L.push(`| ${x.market}${x.assumed ? '*' : ''} | ${N(x.d.n)} | ${f3(x.d.mean)} (${f2(x.d.t)}) [${f3(x.d.meanNet)}] | ${N(x.c.n)} | ${f3(x.c.mean)} (${f2(x.c.t)}) [${f3(x.c.meanNet)}] |`);
      L.push(''); } }
  L.push('', '## Checks', '');
  for (const c of o.cut) L.push(`- ${c.market}: grid signal cut test ${c.grid.reduce((a, x) => a + x.n, 0).toLocaleString('en-US')} signals at ${c.grid.length} cut dates, ${c.grid.reduce((a, x) => a + x.missing + x.extra, 0)} missing or extra; marks recomputed on candles cut at each mark (the mark candle's high, low and close replaced) on ${c.marks.trades} trades: ${c.marks.diff} of ${c.marks.marks} differ.`);
  L.push('- Every trade has its stop on the losing side of the fill (the run throws otherwise); a fill past the stop and a risk under the round-trip cost are no trades.',
    '- Exclusions: the data-quality audit\'s bad intervals (`combo-grid-2` `exclusions`). A trade counts only when every mark and the 2R exit resolve.', '',
    '| Market | candles from | signals (3 timeframes) | used | dropped (bad data) | past the stop | risk under cost | unresolved |', '|---|---|---:|---:|---:|---:|---:|---:|');
  for (const m of o.meta) L.push(`| ${m.market} | ${m.first} | ${N(m.signals)} | ${N(m.used)} | ${m.dropped} | ${N(m.bad)} | ${N(m.small)} | ${m.open} |`);
  const cells = o.pips.flatMap((p) => p.move.map((x) => ({ m: p.market, at: x.at, k: x.pips / p.costPips })));
  const over = cells.filter((c) => c.k >= 1), top = [...cells].sort((a, b) => b.k - a.k)[0];
  const C15 = o.curve.find((c) => c.primary).series;
  L.push('', '## What it means', '', o.verdict === 'PASS'
    ? `${o.passed.length} time exit(s) clear the pre-registered bar before costs in both decades. ${o.passedNetPositive.length ? 'Some stay positive after costs.' : 'None stays positive after costs.'} A before-cost tilt, not an edge; nothing is adopted, no live change, no variant on these years.`
    : 'No time exit clears the bar. Nothing is adopted, no live change, no variant on these years.',
    '', `**The shape.** On M15 the tilt starts at once (${f3(C15[0].conf.mean)}R at 5 minutes in 2015-26) and grows slowly with the hold (${f3(C15[3].conf.mean)}R at 1 hour, ${f3(C15[5].conf.mean)}R at 4 hours, ${f3(C15[6].conf.mean)}R at a day); the`,
    'time exits do not keep it with a shorter hold: against the grid\'s 2R exit, 15 and 30 minutes are worse in both windows, 1 hour is',
    'level and 4 hours a little better (secondary, paired). On H1 the tilt is near zero for the first hour; on M5 it peaks near 2 hours.',
    '', `**Beside the spread.** In pips the mean move in the trade\'s direction is under the round-trip cost on ${cells.length - over.length} of ${cells.length} market x mark cells${over.length ? ' (at or over it: ' + over.map((c) => c.m + ' ' + c.at).join(', ') + ', on an ASSUMED cost)' : ''}; the largest is ${top.m} at ${top.at}, ${(top.k * 100).toFixed(0)} % of the cost`,
    '(gold: under 2 pips, $0.19, at a day against a $0.30 round trip). The fade is a reversal of the mid quote about the size of the',
    'bid / ask or smaller: no time exit is positive after costs pooled in either window, and in 2015-26 none is on any market (in 2005-14 only the 4-hour exit on EUR/USD, GBP/USD and USD/CAD sits at +0.001 to +0.008R, t under 0.6). Silver loses over half its',
    'signals to the risk-under-cost rule (its cost is assumed); the other markets lose under 4 %.');
  L.push('');
  return L.join('\n');
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const [cmd, a, b] = process.argv.slice(2);
  if (cmd === 'market') { fs.mkdirSync(b, { recursive: true }); const t0 = Date.now(); const r = runMarket(a);
    fs.writeFileSync(path.join(b, a + '.json'), JSON.stringify(r)); console.log(a, 'signals', r.signals, 'used', r.used, ((Date.now() - t0) / 1000).toFixed(0) + 's'); }
  else if (cmd === 'cut') { fs.mkdirSync(b, { recursive: true }); const r = { market: a, grid: gridCut(a, ['2008-06-11', '2016-09-21', '2025-05-07']), marks: markCut(a) };
    fs.writeFileSync(path.join(b, 'cut-' + a + '.json'), JSON.stringify(r)); console.log(JSON.stringify(r)); }
  else if (cmd === 'report') { const o = report(a); console.log(o.verdict, o.headline); }
  else console.log('usage: run.mjs market <m> <dir> | cut <m> <dir> | report <dir>');
}
