// research/edge/fade-htf/run.mjs - PREREGISTRATION.md (23 Nov 2026): fade the first structure break on H4 and D1 (enter AGAINST
// it at the next 5-minute open), with the WITH-the-break mirror beside; 24 cells, ten markets, discovery 2005-14, confirmation
// 2015 to Oct 2026, judged before costs on month sums (fade cells only). Research only: nothing live imports it, nothing is placed.
//   EDGE_DATA=<cache> node research/edge/fade-htf/run.mjs market <m> <outDir>
//   EDGE_DATA=<cache> node research/edge/fade-htf/run.mjs cut <m> <outDir>
//   node research/edge/fade-htf/run.mjs report <outDir>
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import * as K from '../_lib/edgekit.mjs';
import { COSTS, exclusions } from '../combo-grid-2/run.mjs';
import { atr14, startIdx } from '../dom-trade-through/run.mjs';
import { MARKETS, ASSUMED, FROM, SPLIT, TO, NM, DM, monthOf, mstat, p1 } from '../grid7-wide-core/run.mjs';
import { breaks, exits } from '../grid7-wide-fade/run.mjs';

export { MARKETS, ASSUMED };
const HERE = path.dirname(fileURLToPath(import.meta.url));
export const TFS = ['4h', '1d'], TFN = ['h4', 'd1'], STOPS = ['ext', 'atr'], EXITS = ['1R', '2R', 'swing'];
export const ATRK = 0.1, CAP = { '4h': 8 * 86400, '1d': 30 * 86400 };
export const NCELL = 12;
export const cellOf = (tf, st, x) => (tf * 2 + st) * 3 + x;
export function cellName(i, dir = 'fade') { const x = i % 3, r = (i - x) / 3, st = r % 2, tf = (r - st) / 2;
  return { tf: TFN[tf], stop: STOPS[st], exit: EXITS[x], dir, name: `${TFN[tf]} ${STOPS[st]} ${EXITS[x]} ${dir}` }; }
export const pipOf = (m) => (m === 'xau' || m === 'xag' ? 1 : /jpy$/.test(m) ? 0.01 : 0.0001);
export const unitOf = (m) => (m === 'xau' || m === 'xag' ? '$' : 'pips');

// UTC days with Saturday / Sunday folded into the next weekday (council/fills.mjs foldWeekend, on edgekit bars)
export function foldDays(D) {
  const out = []; let w = null;
  for (const b of D) {
    const wd = new Date(b.t * 1000).getUTCDay();
    if (wd === 0 || wd === 6) { w = w ? { o: w.o, h: Math.max(w.h, b.h), l: Math.min(w.l, b.l) } : { o: b.o, h: b.h, l: b.l }; continue; }
    out.push(w ? { ...b, o: w.o, h: Math.max(w.h, b.h), l: Math.min(w.l, b.l) } : b); w = null;
  }
  return out;
}
export const htf = (M5) => ({ '4h': K.resample(M5, 14400), '1d': foldDays(K.resample(M5, 86400)) });

// signals on closed candles only: { tf, j, d, ts (break close), ext, a (ATR at j), opp }
export function signals(F) {
  const out = [];
  TFS.forEach((k, tf) => { const T = F[k], atr = atr14(T);
    for (const e of breaks(T)) { const a = atr[e.i]; if (!(a > 0)) continue; const b = T[e.i];
      out.push({ tf, j: e.i, d: e.dir, ts: b.e, ext: e.dir > 0 ? b.h : b.l, a, opp: e.opp }); } });
  return out;
}

const inBad = (X, t) => { let lo = 0, hi = X.length; while (lo < hi) { const m = (lo + hi) >> 1; if (X[m][0] <= t) lo = m + 1; else hi = m; } return lo > 0 && t <= X[lo - 1][1]; };
function newAcc() { return { ms: new Float64Array(NCELL * NM), msNet: new Float64Array(NCELL * NM), n: new Float64Array(NCELL * 2), sum: new Float64Array(NCELL * 2),
  sq: new Float64Array(NCELL * 2), net: new Float64Array(NCELL * 2), win: new Float64Array(NCELL * 2), cr: new Float64Array(NCELL * 2) }; }
function add(A, c, w, m, R, cr) { A.ms[c * NM + m] += R; A.msNet[c * NM + m] += R - cr; A.n[c * 2 + w]++; A.sum[c * 2 + w] += R; A.sq[c * 2 + w] += R * R;
  A.net[c * 2 + w] += R - cr; A.cr[c * 2 + w] += cr; if (R > 0) A.win[c * 2 + w]++; }
const med = (a) => { if (!a.length) return null; const s = [...a].sort((x, y) => x - y), h = s.length >> 1; return s.length % 2 ? s[h] : (s[h - 1] + s[h]) / 2; };

export function runMarket(market) {
  const M5 = K.load(market, '5m', { from: '2004-01-01', to: '2026-11-01' }); const F = htf(M5);
  const sigs = signals(F), cost = COSTS[market], X = exclusions(market), pip = pipOf(market);
  const fade = newAcc(), mirr = newAcc(); let dropped = 0, bad = 0, small = 0, sims = 0, open = 0;
  const risks = [[[], []], [[], []]], crs = [[0, 0], [0, 0]];
  for (const g of sigs) {
    const fi = startIdx(M5, g.ts); if (fi >= M5.length) continue; const t = M5[fi].t; if (t < FROM || t >= TO) continue;
    if (X.length && inBad(X, t)) { dropped++; continue; }
    const fill = M5[fi].o, s = -g.d, cap = CAP[TFS[g.tf]], m = monthOf(t), w = t < SPLIT ? 0 : 1;
    for (let st = 0; st < 2; st++) {
      const stop = st === 0 ? g.ext + g.d * ATRK * g.a : fill + g.d * g.a, risk = s * (fill - stop);
      if (!(risk > 0)) { bad++; continue; }
      if (risk < cost) { small++; continue; }
      if (!(s * (fill - stop) > 0)) throw new Error('stop on the wrong side');
      const sr = g.opp == null ? NaN : (s * (g.opp - fill)) / risk; const ks = [1, 2, sr > 0 ? sr : NaN];
      const r = exits(M5, s, fi, stop, ks.map((k) => (Number.isFinite(k) ? fill + s * k * risk : NaN)), cap);
      const p = exits(M5, -s, fi, fill + s * risk, ks.map((k) => (Number.isFinite(k) ? fill - s * k * risk : NaN)), cap); sims++;
      if (!r || !p) { open++; continue; }
      const cr = cost / risk; risks[g.tf][st].push(risk / pip); crs[g.tf][st] += cr;
      for (let x = 0; x < 3; x++) { if (!Number.isFinite(ks[x])) continue; const c = cellOf(g.tf, st, x);
        add(fade, c, w, m, r.R[x], cr); add(mirr, c, w, m, p.R[x], cr); }
    }
  }
  const stopSize = {}; TFN.forEach((tn, tf) => STOPS.forEach((sn, st) => { const a = risks[tf][st];
    stopSize[`${tn} ${sn}`] = a.length ? { n: a.length, mean: +(a.reduce((x, y) => x + y, 0) / a.length).toFixed(2), median: +med(a).toFixed(2),
      typical: +((cost / pip) / (crs[tf][st] / a.length)).toFixed(2) } : null; }));
  const J = (A) => Object.fromEntries(Object.entries(A).map(([k, v]) => [k, Array.from(v, (z) => +z.toFixed(6))]));
  return { market, cost, assumed: ASSUMED.includes(market), unit: unitOf(market), first: M5.length ? M5[0].t : null, last: M5.length ? M5[M5.length - 1].t : null,
    signals: sigs.length, sims, dropped, bad, small, open, stopSize, fade: J(fade), mirror: J(mirr) };
}

// cut test: the signals known by a date, computed on candles cut there, equal the full run's
export function cutTest(market, cuts = ['2008-06-11', '2012-03-14', '2016-09-21', '2021-02-17', '2025-05-07']) {
  const M5 = K.load(market, '5m', { from: '2004-01-01', to: '2026-11-01' });
  const key = (g) => [g.tf, g.ts, g.d, g.ext, g.a.toFixed(10), g.opp].join('|');
  const full = signals(htf(M5)); const out = [];
  for (const c of cuts) { const T = Date.parse(c + 'T00:00:00Z') / 1000;
    const cut = signals(htf(M5.filter((b) => b.e <= T))).filter((g) => g.ts <= T).map(key);
    const want = full.filter((g) => g.ts <= T).map(key); const A = new Set(cut), B = new Set(want);
    out.push({ market, cut: c, n: B.size, missing: [...B].filter((k) => !A.has(k)).length, extra: [...A].filter((k) => !B.has(k)).length }); }
  return out;
}

export function pool(list, kind) { const A = newAcc(); for (const d of list) { const S = d[kind]; for (const k of Object.keys(A)) for (let i = 0; i < A[k].length; i++) A[k][i] += S[k][i]; } return A; }
export function cellStats(A, c) {
  const ms = A.ms.subarray(c * NM, (c + 1) * NM), msn = A.msNet.subarray(c * NM, (c + 1) * NM);
  const win = (w) => { const n = A.n[c * 2 + w], a = w ? DM : 0, b = w ? NM : DM;
    return { n, mean: n ? A.sum[c * 2 + w] / n : null, t: mstat(ms, a, b).t, meanNet: n ? A.net[c * 2 + w] / n : null, tNet: mstat(msn, a, b).t,
      win: n ? A.win[c * 2 + w] / n : null, costR: n ? A.cr[c * 2 + w] / n : null, months: b - a }; };
  return { d: win(0), c: win(1) };
}
export const enough = (x) => x.d.n >= 300 && x.c.n >= 300;
export const passOf = (x, h) => enough(x) && x.d.mean > 0 && x.c.mean > 0 && x.d.t >= 2 && x.c.t >= 2 && h < 0.05;
export function judge(data) {
  const F = pool(data, 'fade'), M = pool(data, 'mirror'); const rows = [];
  for (let c = 0; c < NCELL; c++) { const s = cellStats(F, c), ms = cellStats(M, c);
    rows.push({ cell: c, ...cellName(c), d: s.d, c: s.c, p: p1(s.c.t, s.c.months - 1), mir: { ...cellName(c, 'with'), d: ms.d, c: ms.c } }); }
  const H = K.holm(rows.map((r) => r.p));
  rows.forEach((r, i) => { r.holm = H[i];
    r.checks = { n: enough(r), disc: r.d.mean > 0 && r.d.t >= 2, conf: r.c.mean > 0 && r.c.t >= 2, holm: H[i] < 0.05 };
    r.pass = passOf(r, H[i]); r.status = !r.checks.n ? 'too few' : r.pass ? 'pass' : 'fail'; });
  return rows;
}

const f3 = (x) => (x == null ? 'n/a' : (x >= 0 ? '+' : '-') + Math.abs(x).toFixed(3)), f2 = (x) => (x == null || !Number.isFinite(x) ? 'n/a' : x.toFixed(2)), N = (x) => Math.round(x).toLocaleString('en-US');
const r6 = (x) => (x == null || !Number.isFinite(x) ? null : +x.toFixed(6));
const slim = (w) => ({ n: w.n, mean: r6(w.mean), t: r6(w.t), meanNet: r6(w.meanNet), tNet: w.tNet == null || !Number.isFinite(w.tNet) ? null : +w.tNet.toFixed(2),
  win: w.win == null ? null : +w.win.toFixed(3), costR: w.costR == null ? null : +w.costR.toFixed(4) });

// grid7-wide-fade's typical stop (cost / mean cost R over both windows) from its committed result, for comparison
export function lowerStops() {
  const g = JSON.parse(fs.readFileSync(path.join(HERE, '../grid7-wide-fade/result.json'), 'utf8'));
  return g.costByMarket.map((m) => { const pip = pipOf(m.market), o = { market: m.market };
    for (const k of ['m5 ext', 'm5 atr', 'm15 ext', 'm15 atr', 'h1 ext', 'h1 atr']) o[k] = m[k] ? +((m.cost / pip) / m[k]).toFixed(2) : null; return o; });
}

export function report(dir) {
  const data = MARKETS.filter((m) => fs.existsSync(path.join(dir, m + '.json'))).map((m) => JSON.parse(fs.readFileSync(path.join(dir, m + '.json'), 'utf8')));
  const cut = MARKETS.flatMap((m) => { const f = path.join(dir, 'cut-' + m + '.json'); return fs.existsSync(f) ? JSON.parse(fs.readFileSync(f, 'utf8')) : []; });
  const rows = judge(data), pass = rows.filter((r) => r.pass), judged = rows.filter((r) => r.checks.n);
  const verdict = data.length < 8 || !judged.length ? 'INCONCLUSIVE' : pass.length ? 'PASS' : 'FAIL';
  const best = [...(judged.length ? judged : rows)].sort((a, b) => b.c.t - a.c.t)[0], bestPass = [...pass].sort((a, b) => b.c.t - a.c.t)[0];
  const perMarket = {}; for (const r of pass) perMarket[r.name] = data.map((d) => { const s = cellStats(pool([d], 'fade'), r.cell); return { market: d.market, assumed: d.assumed, d: slim(s.d), c: slim(s.c) }; });
  const b = bestPass || best;
  const headline = verdict === 'PASS'
    ? `${pass.length} of 12 fade cells pass before costs; best ${b.name}, ${f3(b.c.mean)}R a trade in 2015-26 (n ${N(b.c.n)}, month t ${f2(b.c.t)}; discovery ${f3(b.d.mean)}R, t ${f2(b.d.t)}), ${f3(b.c.meanNet)}R after costs`
    : `0 of 12 fade cells pass (${rows.length - judged.length} too few to judge); the best judged cell, ${b.name}, made ${f3(b.c.mean)}R a trade before costs in 2015-26 (n ${N(b.c.n)}, month t ${f2(b.c.t)}; discovery ${f3(b.d.mean)}R, t ${f2(b.d.t)})`;
  const RW = rows.map((r) => ({ cell: r.name, tf: r.tf, stop: r.stop, exit: r.exit, disc: slim(r.d), conf: slim(r.c), holm: +r.holm.toFixed(4), checks: r.checks,
    status: r.status, pass: r.pass, with: { cell: r.mir.name, disc: slim(r.mir.d), conf: slim(r.mir.c) } }));
  const out = { study: 'fade-htf', built: '2026-11-23', verdict, headline, basis: 'judged before costs on calendar-month sums (pre-registered); after costs beside',
    windows: { discovery: '2005-01-01 to 2014-12-31 (120 months)', confirmation: '2015-01-01 to 2026-10-31 (142 months)' }, markets: data.map((d) => d.market),
    assumedCosts: ASSUMED, costs: Object.fromEntries(data.map((d) => [d.market, d.cost])),
    meta: data.map((d) => ({ market: d.market, first: new Date(d.first * 1000).toISOString().slice(0, 10), last: new Date(d.last * 1000).toISOString().slice(0, 10),
      signals: d.signals, sims: d.sims, dropped: d.dropped, bad: d.bad, small: d.small, open: d.open })),
    passed: pass.map((r) => r.name), tooFew: rows.filter((r) => !r.checks.n).map((r) => r.name), bestConfirmation: best.name,
    passedNetPositive: pass.filter((r) => r.d.meanNet > 0 && r.c.meanNet > 0).map((r) => r.name),
    cut, cells: RW, perMarket, stopSize: data.map((d) => ({ market: d.market, unit: d.unit, ...d.stopSize })), lowerStops: lowerStops() };
  fs.writeFileSync(path.join(HERE, 'result.json'), JSON.stringify(out, null, 1) + '\n');
  fs.writeFileSync(path.join(HERE, 'RESULT.md'), resultMd(out, rows));
  return out;
}

function resultMd(o, rows) {
  const nCut = o.cut.reduce((a, x) => a + x.n, 0), badCut = o.cut.reduce((a, x) => a + x.missing + x.extra, 0);
  const cnt = (f) => rows.filter(f).length; const L = [];
  L.push('# Fade on H4 and D1: fading the first structure break on the higher timeframes (result)', '', `**Verdict: ${o.verdict}. ${o.headline}.**`, '',
    'Run 23 Nov 2026 as pre-registered (`PREREGISTRATION.md`, committed and pushed alone first). Research only: nothing live',
    'changed, nothing is proposed. One run, no variants.', '',
    '## What was run', '',
    'The first structure break (a close beyond the last confirmed swing, 3 candles a side; `grid7-wide-fade` `breaks`) on H4 (UTC',
    '4-hour buckets) or D1 (UTC days, weekend candles folded into the next weekday), FADED: market entry against the break at the',
    'next 5-minute open; the "with" mirror beside (same fill, same stop distance on the other side, same targets in R). Stop past the',
    'break candle\'s extreme + 0.1 ATR(14) ("ext") or 1 ATR(14) ("atr"); exit at 1R, 2R or the opposite swing ("swing"); time limit',
    'H4 8 days, D1 30 days. Ten markets pooled, OANDA mid 5-minute candles. Discovery = fills 2005-2014, confirmation = 2015 to',
    'October 2026. Judged before costs on month sums; Holm over the 12 fade confirmation tests.',
    `Costs beside: the demo figures for gold and the four majors; **ASSUMED, not measured** for ${o.assumedCosts.join(', ')}.`, '',
    '## The bar, fade cells', '',
    `- n >= 300 in both windows: ${cnt((r) => r.checks.n)} of 12 (too few to judge: ${o.tooFew.length ? o.tooFew.join('; ') : 'none'}).`,
    `- Mean R > 0 and month t >= 2 in discovery: ${cnt((r) => r.checks.disc)}; in confirmation: ${cnt((r) => r.checks.conf)}; both: ${cnt((r) => r.checks.disc && r.checks.conf)}.`,
    `- Holm-adjusted p < 0.05: ${cnt((r) => r.checks.holm)}.`,
    `- **All four: ${o.passed.length}${o.passed.length ? ' (' + o.passed.join('; ') + ')' : ''}.**`,
    `- Of those, positive after costs in both windows: ${o.passedNetPositive.length}${o.passedNetPositive.length ? ' (' + o.passedNetPositive.join('; ') + ')' : ''}.`, '',
    '## Every cell', '',
    'R a trade before costs (month-sum t), after costs beside; "cost R" = mean round-trip cost / risk in 2015-26. The "with" row is',
    'the same cell traded WITH the break (reported, not judged).', '',
    '| Cell | n 05-14 | R 05-14 (t) | net 05-14 | n 15-26 | R 15-26 (t) | net 15-26 (t) | cost R | Holm | Status |',
    '|---|---:|---:|---:|---:|---:|---:|---:|---:|---|');
  for (const r of rows) {
    L.push(`| ${r.name} | ${N(r.d.n)} | ${f3(r.d.mean)} (${f2(r.d.t)}) | ${f3(r.d.meanNet)} | ${N(r.c.n)} | ${f3(r.c.mean)} (${f2(r.c.t)}) | ${f3(r.c.meanNet)} (${f2(r.c.tNet)}) | ${r.c.costR == null ? 'n/a' : r.c.costR.toFixed(3)} | ${r.holm.toFixed(3)} | ${r.status} |`);
  }
  for (const r of rows) { const m = r.mir;
    L.push(`| ${m.name} | ${N(m.d.n)} | ${f3(m.d.mean)} (${f2(m.d.t)}) | ${f3(m.d.meanNet)} | ${N(m.c.n)} | ${f3(m.c.mean)} (${f2(m.c.t)}) | ${f3(m.c.meanNet)} (${f2(m.c.tNet)}) | ${m.c.costR == null ? 'n/a' : m.c.costR.toFixed(3)} | - | not judged |`); }
  L.push('');
  if (o.passed.length) { L.push('## Per market, passing cells', '', 'Before costs (after costs in brackets); * = cost ASSUMED.', '');
    for (const [name, list] of Object.entries(o.perMarket)) { L.push(`### ${name}`, '', '| Market | n 05-14 | R (t) [net] | n 15-26 | R (t) [net] | cost R 15-26 |', '|---|---:|---:|---:|---:|---:|');
      for (const x of list) L.push(`| ${x.market}${x.assumed ? '*' : ''} | ${N(x.d.n)} | ${f3(x.d.mean)} (${f2(x.d.t)}) [${f3(x.d.meanNet)}] | ${N(x.c.n)} | ${f3(x.c.mean)} (${f2(x.c.t)}) [${f3(x.c.meanNet)}] | ${x.c.costR == null ? 'n/a' : x.c.costR.toFixed(3)} |`);
      L.push(''); } }
  L.push('## Stop size', '', 'Risk of the fade trades over both windows, in pips (0.01 on yen pairs, 0.0001 on other pairs) or dollars (gold, silver):',
    'mean / median / typical (= cost / mean(cost / risk), the harmonic mean). The lower-timeframe columns are the same "typical" figure',
    'for `grid7-wide-fade`\'s cells, from its committed result. * = cost ASSUMED.', '',
    '| Market | unit | h4 ext | h4 atr | d1 ext | d1 atr | m5 ext / atr | m15 ext / atr | h1 ext / atr |', '|---|---|---:|---:|---:|---:|---:|---:|---:|');
  const fmt = (s) => (s ? `${s.mean} / ${s.median} / ${s.typical}` : 'n/a');
  for (const s of o.stopSize) { const lo = o.lowerStops.find((x) => x.market === s.market) || {}; const a = o.costs[s.market] != null && o.assumedCosts.includes(s.market) ? '*' : '';
    L.push(`| ${s.market}${a} | ${s.unit} | ${fmt(s['h4 ext'])} | ${fmt(s['h4 atr'])} | ${fmt(s['d1 ext'])} | ${fmt(s['d1 atr'])} | ${lo['m5 ext']} / ${lo['m5 atr']} | ${lo['m15 ext']} / ${lo['m15 atr']} | ${lo['h1 ext']} / ${lo['h1 atr']} |`); }
  L.push('', '## Checks', '',
    `- Cut test: ${o.cut.length} cuts on ${[...new Set(o.cut.map((x) => x.market))].join(', ')}: ${N(nCut)} H4 / D1 signals known by the cut dates, ${badCut} missing or extra when the candles are cut there.`,
    '- Every trade has its stop on the losing side of the fill (the run throws otherwise); a fill at or past the stop and a risk under the round-trip cost are no trades (same for fade and mirror).',
    '- Exclusions: the data-quality audit\'s bad intervals (`combo-grid-2` `exclusions`).', '',
    '| Market | candles from | signals | simulated | dropped (bad data) | past the stop | risk under cost | unresolved at data end |', '|---|---|---:|---:|---:|---:|---:|---:|');
  for (const m of o.meta) L.push(`| ${m.market} | ${m.first} | ${N(m.signals)} | ${N(m.sims)} | ${m.dropped} | ${N(m.bad)} | ${N(m.small)} | ${m.open} |`);
  L.push('', '## What it means', '');
  if (o.verdict === 'PASS') {
    L.push(`${o.passed.length} fade cell(s) clear the pre-registered bar before costs in both decades; ${o.passedNetPositive.length} stay positive after costs in both windows.`,
      'A before-cost tilt is not an edge. Nothing is adopted; a forward record or any live change needs the owner. One run, no variants on these years.');
  } else if (o.verdict === 'FAIL') {
    L.push('No fade cell clears the bar on H4 or D1. With stops many times the spread, the tilt the lower-timeframe fades show before',
      'costs is not there to be captured, which fits the reading that the M5 / M15 tilt is a reversal of the mid quote at the scale',
      'of the spread. Do not re-test variants of these cells on these years. Nothing live changed; no rule is proposed.');
  } else L.push('Too few trades to judge. Nothing live changed; no rule is proposed.');
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
