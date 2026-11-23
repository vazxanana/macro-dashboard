// research/edge/grid7-msnr-filter/run.mjs - the MSNR direction call as a filter (PREREGISTRATION.md, 23 Nov 2026): plain
// triggers (structure break, box close-out, engulf) taken WITH the call against AGAINST it, three ladders (D1 / 1w, H4 / 1d,
// H1 / 4h), 1R and 2R, ten markets, discovery 2005-14, confirmation 2015 to Oct 2026, judged before costs. Research only:
// nothing live imports it, nothing is placed.
//   EDGE_DATA=<cache> node research/edge/grid7-msnr-filter/run.mjs market <m> <outDir>
//   EDGE_DATA=<cache> node research/edge/grid7-msnr-filter/run.mjs cut <m> <outDir>
//   node research/edge/grid7-msnr-filter/run.mjs report <outDir>
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import * as K from '../_lib/edgekit.mjs';
import { frames } from '../combo-grid-3/run.mjs';
import { COSTS, exclusions } from '../combo-grid-2/run.mjs';
import { atr14, startIdx } from '../dom-trade-through/run.mjs';
import { MARKETS, ASSUMED, FROM, SPLIT, TO, NM, DM, monthOf, mstat, p1, welch, exits } from '../grid7-wide-core/run.mjs';
import { direction, zones } from '../../../council/eg-methods.mjs';

export { MARKETS, ASSUMED };
const HERE = path.dirname(fileURLToPath(import.meta.url));
export const LADDERS = [
  { name: 'D1', work: '1d', key: '1w', keySec: 604800, trig: '1h', cap: 2 * 86400 },
  { name: 'H4', work: '4h', key: '1d', keySec: 86400, trig: '15m', cap: 86400 },
  { name: 'H1', work: '1h', key: '4h', keySec: 14400, trig: '5m', cap: 8 * 3600 },
];
export const TRIGS = ['break', 'box', 'engulf'], EXITS = ['1R', '2R'], KINDS = ['with', 'against', 'fadeWith', 'fadeAgainst'];
export const ATRK = 0.1, NCELL = 18, NK = 4;
export const cellIndex = (l, tr, x) => (l * 3 + tr) * 2 + x;
export const cellName = (c) => { const x = c % 2, r = (c - x) / 2, tr = r % 3, l = (r - tr) / 3; return { l, tr, x, name: `${LADDERS[l].name} ${TRIGS[tr]} ${EXITS[x]}` }; };
const conv = (B) => B.map((b) => ({ time: b.t, open: b.o, high: b.h, low: b.l, close: b.c }));

// ---- the call of each closed working candle, and its age in working candles ----------------------------------------------
export function calls(F, L) {
  const W = F[L.work], A = F[L.key]; const keyOf = (t) => { const k = K.barAt(A, t); return k < 0 ? t : A[k].t; };
  const r = direction(conv(W), keyOf, L.keySec);
  const age = new Int32Array(W.length).fill(-1);
  for (let i = 0; i < W.length; i++) if (r.last[i] >= 0) age[i] = i - r.events[r.last[i]].i;
  return { W, call: r.call, age };
}

// ---- signals (closed candles only): { l, tr, j, d, tt, ts, swing, ext, a, call, age } ------------------------------------
export function signals(F) {
  const out = [];
  LADDERS.forEach((L, l) => {
    const T = F[L.trig], atr = atr14(T), C = calls(F, L);
    const push = (tr, j, d, swing) => { const a = atr[j]; if (!(a > 0)) return; const b = T[j];
      const wi = K.closedCount(C.W, b.e) - 1; const call = wi >= 0 ? C.call[wi] : 0, age = wi >= 0 ? C.age[wi] : -1;
      out.push({ l, tr, j, d, tt: b.t, ts: b.e, swing, ext: d > 0 ? b.h : b.l, a, call, age }); };
    for (const e of K.structure(T, 3).events) { let sw = e.dir > 0 ? Infinity : -Infinity;
      for (let q = e.from; q <= e.i; q++) sw = e.dir > 0 ? Math.min(sw, T[q].l) : Math.max(sw, T[q].h);
      push(0, e.i, e.dir, sw); }
    for (const b of K.boxesHL(T, 2)) if (b.dir && b.bi >= 0) push(1, b.bi, b.dir, b.dir > 0 ? b.lo : b.hi);
    const TC = conv(T);
    for (const z of zones(TC, L.trig, 3)) { const j = z.i, jb = j - z.n; let sw = z.dir > 0 ? Infinity : -Infinity;
      for (let q = jb; q <= j; q++) sw = z.dir > 0 ? Math.min(sw, T[q].l) : Math.max(sw, T[q].h);
      push(2, j, z.dir, sw); }
  });
  return out;
}

// discovery-window median of the call age, per ladder, from the signals alone (no outcome read)
export function ageMedians(sigs) {
  return LADDERS.map((_, l) => { const a = sigs.filter((g) => g.l === l && g.call !== 0 && g.ts >= FROM && g.ts < SPLIT).map((g) => g.age).sort((p, q) => p - q);
    return a.length ? a[(a.length - 1) >> 1] : null; });
}

const inBad = (X, t) => { let lo = 0, hi = X.length; while (lo < hi) { const m = (lo + hi) >> 1; if (X[m][0] <= t) lo = m + 1; else hi = m; } return lo > 0 && t <= X[lo - 1][1]; };
const S = NCELL * NK;
function newAcc() { return { ms: new Float64Array(S * NM), msNet: new Float64Array(S * NM), mc: new Float64Array(S * NM),
  n: new Float64Array(S * 2), sum: new Float64Array(S * 2), sq: new Float64Array(S * 2), net: new Float64Array(S * 2), win: new Float64Array(S * 2),
  age: new Float64Array(S * 2 * 2 * 3) }; }   // [slot][window][young/old][n,sum,sq]
function add(A, slot, w, m, R, cr, old) { A.ms[slot * NM + m] += R; A.msNet[slot * NM + m] += R - cr; A.mc[slot * NM + m]++;
  const k = slot * 2 + w; A.n[k]++; A.sum[k] += R; A.sq[k] += R * R; A.net[k] += R - cr; if (R > 0) A.win[k]++;
  if (old != null) { const b = ((slot * 2 + w) * 2 + old) * 3; A.age[b]++; A.age[b + 1] += R; A.age[b + 2] += R * R; } }

export function runMarket(market) {
  const M5 = K.load(market, '5m', { from: '2004-01-01', to: '2026-11-01' }); const F = frames(M5);
  const sigs = signals(F), med = ageMedians(sigs), cost = COSTS[market], X = exclusions(market);
  const A = newAcc(); let dropped = 0, bad = 0, small = 0, sims = 0, open = 0, noCall = 0;
  for (const g of sigs) {
    if (!g.call) { noCall++; continue; }
    const fi = startIdx(M5, g.ts); if (fi >= M5.length) continue; const t = M5[fi].t; if (t < FROM || t >= TO) continue;
    if (X.length && inBad(X, t)) { dropped++; continue; }
    const fill = M5[fi].o, cap = LADDERS[g.l].cap, m = monthOf(t), w = t < SPLIT ? 0 : 1;
    const old = med[g.l] == null ? null : g.age > med[g.l] ? 1 : 0;
    // the trigger in its own direction
    const stop = g.swing - g.d * ATRK * g.a, risk = g.d * (fill - stop);
    if (!(risk > 0)) bad++; else if (risk < cost) small++; else {
      if (!(g.d * (fill - stop) > 0)) throw new Error('stop on the wrong side');
      const r = exits(M5, g.d, fi, stop, cap); sims++;
      if (!r) open++; else { const k = g.d === g.call ? 0 : 1, cr = cost / risk;
        for (let x = 0; x < 2; x++) add(A, cellIndex(g.l, g.tr, x) * NK + k, w, m, r.R[x], cr, old); }
    }
    // the fade: against d, stop past the trigger candle's extreme
    const s = -g.d, fstop = g.ext + g.d * ATRK * g.a, frisk = s * (fill - fstop);
    if (frisk > 0 && frisk >= cost) {
      if (!(s * (fill - fstop) > 0)) throw new Error('fade stop on the wrong side');
      const r = exits(M5, s, fi, fstop, cap); sims++;
      if (r) { const k = s === g.call ? 2 : 3, cr = cost / frisk; for (let x = 0; x < 2; x++) add(A, cellIndex(g.l, g.tr, x) * NK + k, w, m, r.R[x], cr, old); }
    }
  }
  const J = (o) => Object.fromEntries(Object.entries(o).map(([k, v]) => [k, Array.from(v, (z) => +z.toFixed(6))]));
  return { market, cost, assumed: ASSUMED.includes(market), first: M5.length ? M5[0].t : null, last: M5.length ? M5[M5.length - 1].t : null,
    signals: sigs.length, noCall, sims, dropped, bad, small, open, ageMedian: med, acc: J(A) };
}

// ---- cut test ---------------------------------------------------------------------------------------------------------
export function cutTest(market, cuts = ['2008-06-11', '2012-03-14', '2016-09-21', '2021-02-17', '2025-05-07']) {
  const M5 = K.load(market, '5m', { from: '2004-01-01', to: '2026-11-01' });
  const key = (g) => [g.l, g.tr, g.tt, g.d, g.swing, g.ext, g.a.toFixed(10), g.call, g.age].join('|');
  const full = signals(frames(M5)); const out = [];
  for (const c of cuts) { const T = Date.parse(c + 'T00:00:00Z') / 1000;
    const cut = signals(frames(M5.filter((b) => b.e <= T))).filter((g) => g.ts <= T).map(key);
    const want = full.filter((g) => g.ts <= T).map(key); const A = new Set(cut), B = new Set(want);
    out.push({ market, cut: c, n: B.size, missing: [...B].filter((k) => !A.has(k)).length, extra: [...A].filter((k) => !B.has(k)).length }); }
  return out;
}

// ---- pooled statistics ----------------------------------------------------------------------------------------------------
export function pool(list) { const A = newAcc(); for (const d of list) for (const k of Object.keys(A)) for (let i = 0; i < A[k].length; i++) A[k][i] += d.acc[k][i]; return A; }
export function side(A, slot, w) {
  const k = slot * 2 + w, n = A.n[k], a = w ? DM : 0, b = w ? NM : DM;
  return { n, mean: n ? A.sum[k] / n : null, t: mstat(A.ms.subarray(slot * NM, (slot + 1) * NM), a, b).t, meanNet: n ? A.net[k] / n : null,
    tNet: mstat(A.msNet.subarray(slot * NM, (slot + 1) * NM), a, b).t, win: n ? A.win[k] / n : null, sum: A.sum[k], sq: A.sq[k] };
}
// month series of (mean WITH - mean AGAINST), months holding both sides
export function monthDiff(A, sw, sa, w) { const a = w ? DM : 0, b = w ? NM : DM, xs = [];
  for (let m = a; m < b; m++) { const nw = A.mc[sw * NM + m], na = A.mc[sa * NM + m]; if (nw && na) xs.push(A.ms[sw * NM + m] / nw - A.ms[sa * NM + m] / na); }
  const n = xs.length; if (n < 3) return { months: n, mean: null, t: null };
  const mean = xs.reduce((p, q) => p + q, 0) / n, sd = Math.sqrt(xs.reduce((p, q) => p + (q - mean) ** 2, 0) / (n - 1));
  return { months: n, mean, t: sd > 0 ? mean / (sd / Math.sqrt(n)) : null }; }
const ageSide = (A, slot, w, old) => { const b = ((slot * 2 + w) * 2 + old) * 3; return { n: A.age[b], sum: A.age[b + 1], sq: A.age[b + 2] }; };
export function judge(data) {
  const A = pool(data); const rows = [];
  for (let c = 0; c < NCELL; c++) { const nm = cellName(c), sw = c * NK, sa = c * NK + 1, fw = c * NK + 2, fa = c * NK + 3;
    const win = (w) => { const W = side(A, sw, w), G = side(A, sa, w), md = monthDiff(A, sw, sa, w);
      const ages = [0, 1].map((o) => { const x = ageSide(A, sw, w, o), y = ageSide(A, sa, w, o);
        return { withN: x.n, withMean: x.n ? x.sum / x.n : null, againstN: y.n, againstMean: y.n ? y.sum / y.n : null, welch: welch(x, y) }; });
      const FW = side(A, fw, w), FA = side(A, fa, w);
      return { with: W, against: G, diff: W.n && G.n ? W.mean - G.mean : null, welch: welch(W, G), month: md, young: ages[0], old: ages[1],
        fadeWith: FW, fadeAgainst: FA, fadeDiff: FW.n && FA.n ? FW.mean - FA.mean : null, fadeWelch: welch(FW, FA) }; };
    const d = win(0), cf = win(1);
    rows.push({ cell: c, ...nm, d, c: cf, p: cf.welch == null ? 1 : p1(cf.welch, cf.with.n + cf.against.n - 2) }); }
  const H = K.holm(rows.map((r) => r.p));
  rows.forEach((r, i) => { r.holm = H[i];
    r.checks = { n: r.d.with.n >= 300 && r.d.against.n >= 300 && r.c.with.n >= 300 && r.c.against.n >= 300,
      welch: r.d.diff > 0 && r.c.diff > 0 && r.d.welch >= 2 && r.c.welch >= 2,
      month: r.d.month.t != null && r.c.month.t != null && r.d.month.t >= 2 && r.c.month.t >= 2, holm: H[i] < 0.05 };
    r.pass = Object.values(r.checks).every(Boolean); });
  return rows;
}

const f3 = (x) => (x == null ? 'n/a' : (x >= 0 ? '+' : '-') + Math.abs(x).toFixed(3)), f2 = (x) => (x == null ? 'n/a' : x.toFixed(2)), N = (x) => Math.round(x).toLocaleString('en-US');
const sl = (s) => ({ n: s.n, mean: s.mean == null ? null : +s.mean.toFixed(5), t: +s.t.toFixed(3), meanNet: s.meanNet == null ? null : +s.meanNet.toFixed(5), tNet: +s.tNet.toFixed(3), win: s.win == null ? null : +s.win.toFixed(3) });
const r5 = (x) => (x == null ? null : +x.toFixed(5));
const slimW = (x) => ({ with: sl(x.with), against: sl(x.against), diff: r5(x.diff), welch: r5(x.welch), month: { months: x.month.months, mean: r5(x.month.mean), t: r5(x.month.t) },
  young: { ...x.young, withMean: r5(x.young.withMean), againstMean: r5(x.young.againstMean), welch: r5(x.young.welch) },
  old: { ...x.old, withMean: r5(x.old.withMean), againstMean: r5(x.old.againstMean), welch: r5(x.old.welch) },
  fadeWith: sl(x.fadeWith), fadeAgainst: sl(x.fadeAgainst), fadeDiff: r5(x.fadeDiff), fadeWelch: r5(x.fadeWelch) });

export function report(dir) {
  const data = MARKETS.map((m) => JSON.parse(fs.readFileSync(path.join(dir, m + '.json'), 'utf8')));
  const cut = MARKETS.flatMap((m) => { const f = path.join(dir, 'cut-' + m + '.json'); return fs.existsSync(f) ? JSON.parse(fs.readFileSync(f, 'utf8')) : []; });
  const rows = judge(data), pass = rows.filter((r) => r.pass), nOk = rows.filter((r) => r.checks.n).length;
  const verdict = pass.length ? 'PASS' : nOk < 9 ? 'INCONCLUSIVE' : 'FAIL';
  const best = [...rows].sort((a, b) => Math.min(b.d.welch ?? -99, b.c.welch ?? -99) - Math.min(a.d.welch ?? -99, a.c.welch ?? -99))[0];
  const tot = (w, k) => { let n = 0, s = 0; for (const r of rows.filter((x) => x.x === 0)) { n += r[w][k].n; s += r[w][k].mean * r[w][k].n; } return { n, mean: s / n }; };
  const pooled = { with: { d: tot('d', 'with'), c: tot('c', 'with') }, against: { d: tot('d', 'against'), c: tot('c', 'against') } };
  const head = (r) => `${r.name}: WITH ${f3(r.c.with.mean)}R vs AGAINST ${f3(r.c.against.mean)}R a trade in 2015-26 (n ${N(r.c.with.n)} / ${N(r.c.against.n)}, Welch t ${f2(r.c.welch)}; 2005-14 t ${f2(r.d.welch)})`;
  const headline = verdict === 'PASS' ? `${pass.length} of 18 cells pass; ${head(pass[0])}`
    : `${pass.length} of 18 cells pass; WITH the call made ${f3(pooled.with.c.mean)}R a trade before costs in 2015-26 against ${f3(pooled.against.c.mean)}R AGAINST it (1R cells, ${N(pooled.with.c.n)} / ${N(pooled.against.c.n)} trades); best cell ${head(best)}`;
  const perMarket = data.map((d) => { const A = pool([d]); const sw = best.cell * NK, sa = sw + 1;
    return { market: d.market, d: { with: sl(side(A, sw, 0)), against: sl(side(A, sa, 0)) }, c: { with: sl(side(A, sw, 1)), against: sl(side(A, sa, 1)) } }; });
  const out = { study: 'grid7-msnr-filter', built: '2026-11-23', verdict, headline, basis: 'judged before costs (pre-registered); after costs beside',
    windows: { discovery: '2005-01-01 to 2014-12-31 (120 months)', confirmation: '2015-01-01 to 2026-10-31 (142 months)' }, markets: MARKETS,
    assumedCosts: ASSUMED, costs: Object.fromEntries(data.map((d) => [d.market, d.cost])),
    meta: data.map((d) => ({ market: d.market, first: new Date(d.first * 1000).toISOString().slice(0, 10), last: new Date(d.last * 1000).toISOString().slice(0, 10),
      signals: d.signals, noCall: d.noCall, sims: d.sims, dropped: d.dropped, bad: d.bad, small: d.small, open: d.open, ageMedian: d.ageMedian })),
    passed: pass.map((r) => r.name), cellsWithN: nOk, best: best.name, pooled1R: pooled, cut,
    cells: rows.map((r) => ({ cell: r.name, ladder: LADDERS[r.l].name, trigger: TRIGS[r.tr], exit: EXITS[r.x], disc: slimW(r.d), conf: slimW(r.c), holm: +r.holm.toFixed(4), checks: r.checks, pass: r.pass })),
    perMarketBest: perMarket };
  fs.writeFileSync(path.join(HERE, 'result.json'), JSON.stringify(out, null, 1) + '\n');
  fs.writeFileSync(path.join(HERE, 'RESULT.md'), resultMd(out, rows));
  return out;
}

function resultMd(o, rows) {
  const cnt = (f) => rows.filter(f).length, nCut = o.cut.reduce((a, x) => a + x.n, 0), badCut = o.cut.reduce((a, x) => a + x.missing + x.extra, 0);
  const L = ['# The MSNR direction call as a filter: WITH against AGAINST (result)', '', `**Verdict: ${o.verdict}. ${o.headline}.**`, '',
    'Run 23 Nov 2026 as pre-registered (`PREREGISTRATION.md`, committed and pushed alone first). Research only: nothing live changed,',
    'nothing is proposed. One run, no variants.', '',
    '## What was run', '',
    'The desk\'s direction call (`council/eg-methods.mjs` `direction()`, unchanged) on three ladders: D1 working with weekly key levels',
    '(triggers on H1), H4 with Daily key levels (triggers on M15), H1 with H4 key levels (triggers on M5). Three plain triggers on the',
    'trigger chart: a structure break (3 a side), a swing-low-to-swing-high box closed out (2 a side), an engulf completing within 3',
    'candles. Each taken in its own direction at the next 5-minute open, stop past the trigger\'s swing + 0.1 ATR, 1R or 2R target',
    '(time limit 2 days / 1 day / 8 hours). Split by whether the trigger\'s direction equals the call. Ten markets pooled (xau, xag,',
    'eurusd, gbpusd, usdjpy, audusd, nzdusd, usdcad, usdchf, eurjpy), OANDA mid 5-minute candles; discovery = fills 2005-2014,',
    `confirmation = 2015 to October 2026. Costs after the fact only; **ASSUMED, not measured** for ${o.assumedCosts.join(', ')}.`, '',
    '## The bar', '',
    `- n >= 300 a side in both windows: ${cnt((r) => r.checks.n)} of 18.`,
    `- WITH beats AGAINST, Welch t >= 2 in both windows: ${cnt((r) => r.checks.welch)}.`,
    `- Month series of the difference, month t >= 2 in both windows: ${cnt((r) => r.checks.month)}.`,
    `- Holm p < 0.05 (confirmation): ${cnt((r) => r.checks.holm)}.`,
    `- **All four: ${o.passed.length}${o.passed.length ? ' (' + o.passed.join('; ') + ')' : ''}.**`, '',
    `Pooled over the nine 1R cells: WITH ${f3(o.pooled1R.with.d.mean)}R (n ${N(o.pooled1R.with.d.n)}) vs AGAINST ${f3(o.pooled1R.against.d.mean)}R (n ${N(o.pooled1R.against.d.n)}) in 2005-14;`,
    `WITH ${f3(o.pooled1R.with.c.mean)}R (n ${N(o.pooled1R.with.c.n)}) vs AGAINST ${f3(o.pooled1R.against.c.mean)}R (n ${N(o.pooled1R.against.c.n)}) in 2015-26 (before costs).`, '',
    '## Every cell', '',
    'R a trade before costs (calendar-month-sum t); after costs beside; "diff t" = Welch t of WITH minus AGAINST; "month t" = t of the',
    'month series of the difference.', '',
    '| Cell | Window | WITH n | WITH R (t) | WITH net | AGAINST n | AGAINST R (t) | AGAINST net | diff | diff t | month t | Holm | Pass |',
    '|---|---|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|---|'];
  for (const r of rows) for (const [w, x] of [['05-14', r.d], ['15-26', r.c]])
    L.push(`| ${r.name} | ${w} | ${N(x.with.n)} | ${f3(x.with.mean)} (${f2(x.with.t)}) | ${f3(x.with.meanNet)} | ${N(x.against.n)} | ${f3(x.against.mean)} (${f2(x.against.t)}) | ${f3(x.against.meanNet)} | ${f3(x.diff)} | ${f2(x.welch)} | ${f2(x.month.t)} | ${w === '15-26' ? r.holm.toFixed(3) : ''} | ${w === '15-26' ? (r.pass ? 'yes' : 'no') : ''} |`);
  L.push('', '## Call age (reported, not judged)', '',
    'Young = call age at or under the median of the discovery signals (per market and ladder), old = over it. WITH vs AGAINST mean R',
    'and Welch t in each half.', '',
    '| Cell | Window | young WITH | young AGAINST | young t | old WITH | old AGAINST | old t |', '|---|---|---:|---:|---:|---:|---:|---:|');
  for (const r of rows.filter((x) => x.x === 0)) for (const [w, x] of [['05-14', r.d], ['15-26', r.c]])
    L.push(`| ${r.name} | ${w} | ${f3(x.young.withMean)} (${N(x.young.withN)}) | ${f3(x.young.againstMean)} (${N(x.young.againstN)}) | ${f2(x.young.welch)} | ${f3(x.old.withMean)} (${N(x.old.withN)}) | ${f3(x.old.againstMean)} (${N(x.old.againstN)}) | ${f2(x.old.welch)} |`);
  L.push('', '## The fade, split by the call (reported, not judged)', '',
    'The same trigger entered against its direction, stop past the trigger candle\'s extreme + 0.1 ATR; "fade WITH" = the fade\'s side',
    'equals the call.', '',
    '| Cell | Window | fade WITH n | fade WITH R (t) | net | fade AGAINST n | fade AGAINST R (t) | net | diff t |', '|---|---|---:|---:|---:|---:|---:|---:|---:|');
  for (const r of rows) for (const [w, x] of [['05-14', r.d], ['15-26', r.c]])
    L.push(`| ${r.name} | ${w} | ${N(x.fadeWith.n)} | ${f3(x.fadeWith.mean)} (${f2(x.fadeWith.t)}) | ${f3(x.fadeWith.meanNet)} | ${N(x.fadeAgainst.n)} | ${f3(x.fadeAgainst.mean)} (${f2(x.fadeAgainst.t)}) | ${f3(x.fadeAgainst.meanNet)} | ${f2(x.fadeWelch)} |`);
  L.push('', `## Per market, ${o.best}`, '', '| Market | WITH 05-14 | AGAINST 05-14 | WITH 15-26 | AGAINST 15-26 |', '|---|---:|---:|---:|---:|');
  for (const x of o.perMarketBest) L.push(`| ${x.market} | ${f3(x.d.with.mean)} (${N(x.d.with.n)}) | ${f3(x.d.against.mean)} (${N(x.d.against.n)}) | ${f3(x.c.with.mean)} (${N(x.c.with.n)}) | ${f3(x.c.against.mean)} (${N(x.c.against.n)}) |`);
  L.push('', '## Checks', '',
    `- Cut test: ${o.cut.length} cuts on ${[...new Set(o.cut.map((x) => x.market))].join(', ')}: ${N(nCut)} signals (with their call and age) known by the cut dates, ${badCut} missing or extra when the candles are cut there.`,
    '- Every trade has its stop on the losing side of the fill (the run throws otherwise); fills at or past the stop and risks under the round trip are no trades.',
    '- Exclusions: the data-quality audit\'s bad intervals (`combo-grid-2` `exclusions`). Triggers before the first call switch (call 0) are in neither side.', '',
    '| Market | candles from | signals | no call yet | simulated | dropped (bad data) | past the stop | risk under cost | age medians D1 / H4 / H1 |', '|---|---|---:|---:|---:|---:|---:|---:|---|');
  for (const m of o.meta) L.push(`| ${m.market} | ${m.first} | ${N(m.signals)} | ${N(m.noCall)} | ${N(m.sims)} | ${m.dropped} | ${m.bad} | ${N(m.small)} | ${m.ageMedian.join(' / ')} |`);
  L.push('', '## What it means', '');
  if (o.verdict === 'PASS') L.push('A passing cell says that, for that trigger, the call separates better from worse trades on ten markets in both windows. It is a',
    'candidate for its own forward record and an owner decision, nothing more: a filter on trades that do not make money after costs is not an edge.');
  else if (o.verdict === 'FAIL') L.push('Taking these plain triggers with the direction call did not do measurably better than taking them against it, on ten',
    'markets over 22 years, in both windows. Read simply, the call does not sort these entries into better and worse ones. Do not re-test',
    'variants of these 18 cells on these years. Nothing live changed; no rule is proposed.');
  else L.push('Too few trades a side to judge most cells. Nothing live changed; no rule is proposed.');
  L.push('');
  return L.join('\n');
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const [cmd, a, b] = process.argv.slice(2);
  if (cmd === 'market') { fs.mkdirSync(b, { recursive: true }); const t0 = Date.now(); const r = runMarket(a);
    fs.writeFileSync(path.join(b, a + '.json'), JSON.stringify(r)); console.log(a, 'signals', r.signals, 'sims', r.sims, Math.round((Date.now() - t0) / 1000) + 's'); }
  else if (cmd === 'cut') { fs.mkdirSync(b, { recursive: true }); const r = cutTest(a); fs.writeFileSync(path.join(b, 'cut-' + a + '.json'), JSON.stringify(r)); console.log(r); }
  else if (cmd === 'report') { const o = report(a); console.log(o.verdict, o.headline); }
  else console.log('usage: market <m> <out> | cut <m> <out> | report <out>');
}
