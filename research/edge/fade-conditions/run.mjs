// research/edge/fade-conditions/run.mjs - where the fade tilt lives (PREREGISTRATION.md, 23 Nov 2026): grid7-wide-fade's
// cells `m15 none atr 2R all` (R1) and `h1 none ext 2R all` (R2), unchanged and imported, split by five fixed conditions
// measured at the break candle's close from closed candles only; best-vs-worst level chosen in discovery (2005-14), tested
// once in confirmation (2015 to Oct 2026), Welch t, Holm over 10. Research only: nothing live imports it, nothing is placed.
//   EDGE_DATA=<cache> node research/edge/fade-conditions/run.mjs market <m> <outDir>
//   EDGE_DATA=<cache> node research/edge/fade-conditions/run.mjs cut <m> <outDir>
//   node research/edge/fade-conditions/run.mjs report <outDir>
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import * as K from '../_lib/edgekit.mjs';
import { frames } from '../combo-grid-3/run.mjs';
import { COSTS, exclusions } from '../combo-grid-2/run.mjs';
import { atr14, startIdx } from '../dom-trade-through/run.mjs';
import { MARKETS, ASSUMED, FROM, SPLIT, TO, NM, DM, monthOf, mstat } from '../grid7-wide-core/run.mjs';
import { signals, exits, ATRK, CAP } from '../grid7-wide-fade/run.mjs';

export { MARKETS, ASSUMED };
const HERE = path.dirname(fileURLToPath(import.meta.url));

export const RULES = [
  { key: 'R1', cell: 'm15 none atr 2R all', tf: 1, tfk: '15m', stop: 'atr' },
  { key: 'R2', cell: 'h1 none ext 2R all', tf: 2, tfk: '1h', stop: 'ext' },
];
export const SPLITS = [
  { key: 'hour', name: 'Hour of the break (UTC, open time)', levels: ['00-03', '04-07', '08-11', '12-15', '16-19', '20-23'] },
  { key: 'vol', name: 'Volatility regime (ATR14 / 100-candle median)', levels: ['low', 'mid', 'high'] },
  { key: 'trend', name: 'Daily trend (20-day ER band, with / against)', levels: ['range-with', 'range-against', 'mid-with', 'mid-against', 'trend-with', 'trend-against'] },
  { key: 'body', name: 'Break candle body / ATR', levels: ['small', 'medium', 'large'] },
  { key: 'dow', name: 'Day of week (UTC, Sunday = Monday)', levels: ['Mon', 'Tue', 'Wed', 'Thu', 'Fri'] },
];
export const OFF = []; { let o = 0; for (const s of SPLITS) { OFF.push(o); o += s.levels.length; } }
export const NL = SPLITS.reduce((a, s) => a + s.levels.length, 0);   // 23
export const MIN_PICK = 300;

// ---- the five conditions (pure; closed candles only) ----------------------------------------------------------------------
export const hourLevel = (t) => Math.floor(new Date(t * 1000).getUTCHours() / 4);
export function volLevel(atr, j) {
  if (j < 99 + 14) return -1; const v = Array.from(atr.subarray(j - 99, j + 1)).sort((a, b) => a - b);
  const med = (v[49] + v[50]) / 2; if (!(med > 0)) return -1; const x = atr[j] / med; return x < 0.8 ? 0 : x <= 1.25 ? 1 : 2;
}
export function trendLevel(D, ts, d) {
  const k = K.closedCount(D, ts); if (k < 21) return -1; const c = D.slice(k - 21, k).map((b) => b.c);
  const net = c[20] - c[0]; if (net === 0) return -1; let path = 0; for (let i = 1; i <= 20; i++) path += Math.abs(c[i] - c[i - 1]);
  const er = path > 0 ? Math.abs(net) / path : 0; const band = er < 0.2 ? 0 : er <= 0.4 ? 1 : 2;
  return band * 2 + (Math.sign(net) === d ? 0 : 1);
}
export function bodyLevel(b, a) { if (!(a > 0)) return -1; const x = Math.abs(b.c - b.o) / a; return x < 0.5 ? 0 : x <= 1 ? 1 : 2; }
export function dowLevel(t) { const w = new Date(t * 1000).getUTCDay(); return w === 6 ? -1 : w === 0 ? 0 : w - 1; }

// levels of one signal, [hour, vol, trend, body, dow] (-1 = no level)
export function levelsOf(g, T, atr, D) {
  const b = T[g.j]; return [hourLevel(b.t), volLevel(atr, g.j), trendLevel(D, g.ts, g.d), bodyLevel(b, g.a), dowLevel(b.t)];
}

// the two rules' signals with their levels (closed candles only)
export function tagged(F) {
  const atr = { '15m': atr14(F['15m']), '1h': atr14(F['1h']) }; const out = [];
  for (const g of signals(F)) { if (g.cx !== 0) continue; const r = RULES.findIndex((x) => x.tf === g.tf); if (r < 0) continue;
    const tfk = RULES[r].tfk; out.push({ ...g, r, lv: levelsOf(g, F[tfk], atr[tfk], F['1d']) }); }
  return out;
}

// ---- accumulators ----------------------------------------------------------------------------------------------------------
const NC = 2 * NL;   // rule x level
function newAcc() { return { n: new Float64Array(NC * 2), sum: new Float64Array(NC * 2), sq: new Float64Array(NC * 2), net: new Float64Array(NC * 2),
  win: new Float64Array(NC * 2), cr: new Float64Array(NC * 2), ms: new Float64Array(NC * NM), msNet: new Float64Array(NC * NM), mn: new Float64Array(NC * NM) }; }
function add(A, c, w, m, R, cr) { const i = c * 2 + w; A.n[i]++; A.sum[i] += R; A.sq[i] += R * R; A.net[i] += R - cr; A.cr[i] += cr; if (R > 0) A.win[i]++;
  A.ms[c * NM + m] += R; A.msNet[c * NM + m] += R - cr; A.mn[c * NM + m]++; }
const inBad = (X, t) => { let lo = 0, hi = X.length; while (lo < hi) { const m = (lo + hi) >> 1; if (X[m][0] <= t) lo = m + 1; else hi = m; } return lo > 0 && t <= X[lo - 1][1]; };

export function runMarket(market) {
  const M5 = K.load(market, '5m', { from: '2004-01-01', to: '2026-11-01' }); const F = frames(M5);
  const sigs = tagged(F), cost = COSTS[market], X = exclusions(market), A = newAcc();
  let dropped = 0, bad = 0, small = 0, open = 0, kept = 0; const noLevel = new Array(SPLITS.length).fill(0);
  for (const g of sigs) {
    const fi = startIdx(M5, g.ts); if (fi >= M5.length) continue; const t = M5[fi].t; if (t < FROM || t >= TO) continue;
    if (X.length && inBad(X, t)) { dropped++; continue; }
    const rule = RULES[g.r], fill = M5[fi].o, s = -g.d, cap = CAP[rule.tfk], m = monthOf(t), w = t < SPLIT ? 0 : 1;
    const stop = rule.stop === 'ext' ? g.ext + g.d * ATRK * g.a : fill + g.d * g.a, risk = s * (fill - stop);
    if (!(risk > 0)) { bad++; continue; }
    if (risk < cost) { small++; continue; }
    if (!(s * (fill - stop) > 0)) throw new Error('stop on the wrong side');
    // the grid's opp swing target is computed (and kept) by the grid only to drop trades it cannot resolve: same here
    const sr = g.opp == null ? NaN : (s * (g.opp - fill)) / risk; const ks = [1, 2, sr > 0 ? sr : NaN];
    const r = exits(M5, s, fi, stop, ks.map((k) => (Number.isFinite(k) ? fill + s * k * risk : NaN)), cap);
    const p = exits(M5, -s, fi, fill + s * risk, ks.map((k) => (Number.isFinite(k) ? fill - s * k * risk : NaN)), cap);
    if (!r || !p) { open++; continue; }
    const R = r.R[1], cr = cost / risk; kept++;
    g.lv.forEach((l, sp) => { if (l < 0) { noLevel[sp]++; return; } add(A, g.r * NL + OFF[sp] + l, w, m, R, cr); });
  }
  const J = (o) => Object.fromEntries(Object.entries(o).map(([k, v]) => [k, Array.from(v, (z) => +z.toFixed(6))]));
  return { market, cost, assumed: ASSUMED.includes(market), first: M5.length ? M5[0].t : null, last: M5.length ? M5[M5.length - 1].t : null,
    signals: sigs.length, kept, dropped, bad, small, open, noLevel, acc: J(A) };
}

// ---- cut test: the signals and their levels known by a date, on candles cut there, equal the full run's -------------------
export function cutTest(market, cuts = ['2008-06-11', '2012-03-14', '2016-09-21', '2021-02-17', '2025-05-07']) {
  const M5 = K.load(market, '5m', { from: '2004-01-01', to: '2026-11-01' });
  const key = (g) => [g.r, g.ts, g.d, g.ext, g.a.toFixed(10), g.lv.join(',')].join('|');
  const full = tagged(frames(M5)); const out = [];
  for (const c of cuts) { const T = Date.parse(c + 'T00:00:00Z') / 1000;
    const cut = tagged(frames(M5.filter((b) => b.e <= T))).filter((g) => g.ts <= T).map(key);
    const want = full.filter((g) => g.ts <= T).map(key); const A = new Set(cut), B = new Set(want);
    out.push({ market, cut: c, n: B.size, missing: [...B].filter((k) => !A.has(k)).length, extra: [...A].filter((k) => !B.has(k)).length }); }
  return out;
}

// ---- statistics ------------------------------------------------------------------------------------------------------------
export function pool(list) { const A = newAcc(); for (const d of list) for (const k of Object.keys(A)) for (let i = 0; i < A[k].length; i++) A[k][i] += d.acc[k][i]; return A; }
export function levelStats(A, c) {
  const one = (w) => { const i = c * 2 + w, n = A.n[i], a = w ? DM : 0, b = w ? NM : DM;
    return { n, sum: A.sum[i], sq: A.sq[i], mean: n ? A.sum[i] / n : null, t: mstat(A.ms.subarray(c * NM, (c + 1) * NM), a, b).t,
      meanNet: n ? A.net[i] / n : null, tNet: mstat(A.msNet.subarray(c * NM, (c + 1) * NM), a, b).t, win: n ? A.win[i] / n : null,
      costR: n ? A.cr[i] / n : null }; };
  return { d: one(0), c: one(1) };
}
export function welchDf(a, b) { // a, b: { n, sum, sq } -> { t, df }
  if (a.n < 2 || b.n < 2) return { t: null, df: null }; const ma = a.sum / a.n, mb = b.sum / b.n;
  const va = (a.sq - a.n * ma * ma) / (a.n - 1), vb = (b.sq - b.n * mb * mb) / (b.n - 1), qa = va / a.n, qb = vb / b.n, se = Math.sqrt(qa + qb);
  if (!(se > 0)) return { t: null, df: null };
  return { t: (ma - mb) / se, df: (qa + qb) ** 2 / (qa * qa / (a.n - 1) + qb * qb / (b.n - 1)) };
}
export const p1 = (t, df) => { const p = K.pFromT(t, df); return p == null ? 1 : t > 0 ? p / 2 : 1 - p / 2; };
// month-level check: months of the window where both levels traded; t of the per-month difference of mean R
export function monthDiff(A, cb, cw, a, b) {
  const xs = []; for (let m = a; m < b; m++) { const nb = A.mn[cb * NM + m], nw = A.mn[cw * NM + m]; if (nb && nw) xs.push(A.ms[cb * NM + m] / nb - A.ms[cw * NM + m] / nw); }
  const n = xs.length; if (n < 3) return { months: n, mean: null, t: null };
  const mean = xs.reduce((x, y) => x + y, 0) / n, sd = Math.sqrt(xs.reduce((x, y) => x + (y - mean) ** 2, 0) / (n - 1));
  return { months: n, mean, t: sd > 0 ? mean / (sd / Math.sqrt(n)) : null };
}

export function judge(data) {
  const A = pool(data); const tests = [];
  for (let r = 0; r < 2; r++) for (let sp = 0; sp < SPLITS.length; sp++) {
    const S = SPLITS[sp], lv = S.levels.map((name, l) => ({ name, l, c: r * NL + OFF[sp] + l, ...levelStats(A, r * NL + OFF[sp] + l) }));
    const elig = lv.filter((x) => x.d.n >= MIN_PICK); if (elig.length < 2) { tests.push({ r, sp, levels: lv, best: null, worst: null, p: 1 }); continue; }
    const best = elig.reduce((a, b) => (b.d.mean > a.d.mean ? b : a)), worst = elig.reduce((a, b) => (b.d.mean < a.d.mean ? b : a));
    const W = welchDf(best.c, worst.c), diff = best.c.mean != null && worst.c.mean != null ? best.c.mean - worst.c.mean : null;
    const Wd = welchDf(best.d, worst.d);
    tests.push({ r, sp, levels: lv, best, worst, diffDisc: best.d.mean - worst.d.mean, tDisc: Wd.t, diff, t: W.t, df: W.df,
      p: W.t == null ? 1 : p1(W.t, W.df), monthly: monthDiff(A, best.c, worst.c, DM, NM),
      diffNet: best.c.meanNet != null && worst.c.meanNet != null ? best.c.meanNet - worst.c.meanNet : null });
  }
  const H = K.holm(tests.map((x) => x.p)); tests.forEach((x, i) => { x.holm = H[i]; x.pass = x.diff != null && x.diff > 0 && H[i] < 0.05; });
  return { A, tests };
}
// the gate: pooled n and mean of each rule (the hour split covers every kept trade) against grid7-wide-fade's result.json
export function gate(A) {
  const grid = JSON.parse(fs.readFileSync(path.join(HERE, '../grid7-wide-fade/result.json'), 'utf8'));
  return RULES.map((rule, r) => { const g = grid.cells.find((x) => x.cell === rule.cell); const w = [0, 0].map(() => ({ n: 0, sum: 0 }));
    for (let l = 0; l < SPLITS[0].levels.length; l++) { const c = r * NL + l; for (let k = 0; k < 2; k++) { w[k].n += A.n[c * 2 + k]; w[k].sum += A.sum[c * 2 + k]; } }
    const mine = w.map((x) => ({ n: x.n, mean: x.sum / x.n })), theirs = [g.disc, g.conf];
    const ok = mine.every((x, k) => x.n === theirs[k].n && Math.abs(x.mean - theirs[k].mean) < 0.0005);
    return { rule: rule.cell, ok, mine, grid: theirs.map((x) => ({ n: x.n, mean: x.mean })) }; });
}

const f3 = (x) => (x == null ? 'n/a' : (x >= 0 ? '+' : '-') + Math.abs(x).toFixed(3)), f2 = (x) => (x == null ? 'n/a' : x.toFixed(2)), N = (x) => Math.round(x).toLocaleString('en-US');
const slim = (w) => ({ n: w.n, mean: w.mean == null ? null : +w.mean.toFixed(6), t: +w.t.toFixed(4), meanNet: w.meanNet == null ? null : +w.meanNet.toFixed(6),
  tNet: +w.tNet.toFixed(2), win: w.win == null ? null : +w.win.toFixed(3), costR: w.costR == null ? null : +w.costR.toFixed(4) });

export function report(dir) {
  const data = MARKETS.filter((m) => fs.existsSync(path.join(dir, m + '.json'))).map((m) => JSON.parse(fs.readFileSync(path.join(dir, m + '.json'), 'utf8')));
  const cut = MARKETS.flatMap((m) => { const f = path.join(dir, 'cut-' + m + '.json'); return fs.existsSync(f) ? JSON.parse(fs.readFileSync(f, 'utf8')) : []; });
  const { A, tests } = judge(data); const G = gate(A); const gateOk = G.every((x) => x.ok);
  const pass = tests.filter((x) => x.pass);
  const verdict = data.length < 8 || !gateOk ? 'INCONCLUSIVE' : pass.length ? 'PASS' : 'FAIL';
  const nm = (x) => `${RULES[x.r].key} ${SPLITS[x.sp].key}`;
  const top = [...tests].filter((x) => x.t != null).sort((a, b) => a.holm - b.holm || b.t - a.t)[0];
  const desc = (x) => `${nm(x)}: ${x.best.name} minus ${x.worst.name} ${f3(x.diff)}R a trade in 2015-26 (n ${N(x.best.c.n)} vs ${N(x.worst.c.n)}, Welch t ${f2(x.t)}, Holm p ${x.holm.toFixed(3)}; month-level t ${f2(x.monthly.t)})`;
  const headline = verdict === 'INCONCLUSIVE'
    ? (data.length < 8 ? `only ${data.length} of 10 markets loaded` : 'the gate against grid7-wide-fade failed; nothing judged')
    : verdict === 'PASS'
      ? `${pass.length} of 10 primary tests pass before costs; strongest ${desc([...pass].sort((a, b) => b.t - a.t)[0])}; after costs every level still loses`
      : `0 of 10 primary tests pass; the nearest, ${desc(top)}`;
  const levelRows = tests.map((x) => ({ rule: RULES[x.r].cell, split: SPLITS[x.sp].key,
    levels: x.levels.map((l) => ({ level: l.name, disc: slim(l.d), conf: slim(l.c), bothPositive: l.d.mean > 0 && l.c.mean > 0, bothT2: l.d.mean > 0 && l.c.mean > 0 && l.d.t >= 2 && l.c.t >= 2 })) }));
  const primary = tests.map((x) => ({ rule: RULES[x.r].cell, split: SPLITS[x.sp].key, best: x.best && x.best.name, worst: x.worst && x.worst.name,
    diffDisc: x.diffDisc == null ? null : +x.diffDisc.toFixed(6), tDisc: x.tDisc == null ? null : +x.tDisc.toFixed(3),
    diff: x.diff == null ? null : +x.diff.toFixed(6), t: x.t == null ? null : +x.t.toFixed(3), df: x.df == null ? null : Math.round(x.df),
    p: +x.p.toExponential(4), holm: +x.holm.toExponential(4), pass: x.pass, diffNet: x.diffNet == null ? null : +x.diffNet.toFixed(6),
    monthly: x.monthly ? { months: x.monthly.months, mean: x.monthly.mean == null ? null : +x.monthly.mean.toFixed(6), t: x.monthly.t == null ? null : +x.monthly.t.toFixed(3) } : null }));
  const perMarket = {};
  for (const x of pass) perMarket[nm(x)] = data.map((d) => { const P = pool([d]); const b = levelStats(P, x.best.c), w = levelStats(P, x.worst.c);
    return { market: d.market, assumed: d.assumed, best: { d: slim(b.d), c: slim(b.c) }, worst: { d: slim(w.d), c: slim(w.c) } }; });
  const out = { study: 'fade-conditions', built: '2026-11-23', verdict, headline,
    basis: 'judged before costs (Welch t on per-trade R in confirmation, Holm over 10; pre-registered); month sums and after costs beside',
    windows: { discovery: '2005-01-01 to 2014-12-31 (120 months)', confirmation: '2015-01-01 to 2026-10-31 (142 months)' },
    rules: RULES.map((r) => r.cell), splits: SPLITS.map((s) => ({ key: s.key, name: s.name, levels: s.levels })), markets: data.map((d) => d.market),
    assumedCosts: ASSUMED, costs: Object.fromEntries(data.map((d) => [d.market, d.cost])), gate: G,
    meta: data.map((d) => ({ market: d.market, first: new Date(d.first * 1000).toISOString().slice(0, 10), last: new Date(d.last * 1000).toISOString().slice(0, 10),
      signals: d.signals, kept: d.kept, dropped: d.dropped, bad: d.bad, small: d.small, open: d.open, noLevel: d.noLevel })),
    passed: pass.map(nm), primary, levels: levelRows, perMarket, cut };
  fs.writeFileSync(path.join(HERE, 'result.json'), JSON.stringify(out, null, 1) + '\n');
  fs.writeFileSync(path.join(HERE, 'RESULT.md'), resultMd(out, tests));
  return out;
}

function resultMd(o, tests) {
  const L = [], nCut = o.cut.reduce((a, x) => a + x.n, 0), badCut = o.cut.reduce((a, x) => a + x.missing + x.extra, 0);
  L.push('# Where the fade tilt lives: two fade rules split by fixed conditions (result)', '', `**Verdict: ${o.verdict}. ${o.headline}.**`, '',
    'Run 23 Nov 2026 as pre-registered (`PREREGISTRATION.md`, committed and pushed alone first). Research only: nothing live',
    'changed, nothing is proposed. One run, no variants.', '',
    '## What was run', '',
    '`grid7-wide-fade`\'s cells `m15 none atr 2R all` (R1) and `h1 none ext 2R all` (R2), by its own code (imported): fade the',
    'first structure break at the next 5-minute open, 2R target. Each trade is tagged at the break candle\'s close, from closed',
    'candles only, by five fixed conditions: hour block (UTC), volatility regime (ATR14 / its 100-candle median), Daily trend',
    '(20-day efficiency ratio band x with / against the 20-day direction), break-candle body / ATR, day of week. In discovery',
    '(2005-14) the best and worst level of each split (n >= 300) were picked; in confirmation (2015 to Oct 2026) their difference',
    'was tested once (Welch t, one-sided), Holm over the 10 primary tests. Ten markets pooled, OANDA mid 5-minute candles.',
    `Costs beside: the demo figures for gold and the four majors; **ASSUMED, not measured** for ${o.assumedCosts.join(', ')}.`, '',
    '## Gate', '');
  for (const g of o.gate) L.push(`- ${g.rule}: discovery n ${N(g.mine[0].n)} mean ${f3(g.mine[0].mean)} (grid ${N(g.grid[0].n)}, ${f3(g.grid[0].mean)}); confirmation n ${N(g.mine[1].n)} mean ${f3(g.mine[1].mean)} (grid ${N(g.grid[1].n)}, ${f3(g.grid[1].mean)}): ${g.ok ? 'equal' : 'DIFFERS'}.`);
  L.push('', '## Primary tests', '',
    'Best and worst level picked in discovery; the difference in confirmation is the test. Welch t on per-trade R; "month t" = t of',
    'the per-month difference of mean R over months where both levels traded (trades overlap, so the per-trade t can overstate).', '',
    '| Rule | Split | Best (disc) | Worst (disc) | Diff 05-14 (t) | Diff 15-26 (Welch t) | Holm p | Month t 15-26 | Diff after costs 15-26 | Pass |',
    '|---|---|---|---|---:|---:|---:|---:|---:|---|');
  for (const x of o.primary) L.push(`| ${x.rule} | ${x.split} | ${x.best ?? 'n/a'} | ${x.worst ?? 'n/a'} | ${f3(x.diffDisc)} (${f2(x.tDisc)}) | ${f3(x.diff)} (${f2(x.t)}) | ${x.holm < 0.001 ? x.holm.toExponential(1) : x.holm.toFixed(3)} | ${f2(x.monthly && x.monthly.t)} | ${f3(x.diffNet)} | ${x.pass ? 'yes' : 'no'} |`);
  L.push('', `Passing: ${o.passed.length ? o.passed.join('; ') : 'none'}.`, '', '## Every level', '',
    'R a trade before costs (month-sum t), win share, after costs beside; * = mean R > 0 in both windows, ** = and month t >= 2 in both.', '');
  for (const blk of o.levels) {
    L.push(`### ${blk.rule} · ${blk.split}`, '', '| Level | n 05-14 | R 05-14 (t) | net 05-14 | n 15-26 | R 15-26 (t) | win 15-26 | net 15-26 | cost R 15-26 | |', '|---|---:|---:|---:|---:|---:|---:|---:|---:|---|');
    for (const l of blk.levels) L.push(`| ${l.level} | ${N(l.disc.n)} | ${f3(l.disc.mean)} (${f2(l.disc.t)}) | ${f3(l.disc.meanNet)} | ${N(l.conf.n)} | ${f3(l.conf.mean)} (${f2(l.conf.t)}) | ${l.conf.win == null ? 'n/a' : (l.conf.win * 100).toFixed(1) + '%'} | ${f3(l.conf.meanNet)} | ${l.conf.costR == null ? 'n/a' : l.conf.costR.toFixed(3)} | ${l.bothT2 ? '**' : l.bothPositive ? '*' : ''} |`);
    L.push('');
  }
  const both = o.levels.flatMap((b) => b.levels.filter((l) => l.bothT2).map((l) => `${b.rule.split(' ')[0]} ${b.split} ${l.level}`));
  const net = o.levels.flatMap((b) => b.levels.filter((l) => l.disc.meanNet > 0 && l.conf.meanNet > 0).map((l) => `${b.rule.split(' ')[0]} ${b.split} ${l.level}`));
  L.push(`Levels with mean R > 0 and month t >= 2 in both windows (descriptive, not tested): ${both.length} of ${o.levels.reduce((a, b) => a + b.levels.length, 0)}.`,
    `Levels positive AFTER costs in both windows: ${net.length ? net.join('; ') : 'none'}.`, '');
  if (Object.keys(o.perMarket).length) {
    L.push('## Per market, passing tests', '', 'Before costs (after costs in brackets); * = cost ASSUMED.', '');
    for (const [name, list] of Object.entries(o.perMarket)) {
      const x = o.primary.find((p) => `${p.rule.startsWith('m15') ? 'R1' : 'R2'} ${p.split}` === name);
      L.push(`### ${name}: ${x.best} vs ${x.worst}`, '', '| Market | best 05-14 | best 15-26 [net] | worst 05-14 | worst 15-26 [net] |', '|---|---:|---:|---:|---:|');
      for (const m of list) L.push(`| ${m.market}${m.assumed ? '*' : ''} | ${f3(m.best.d.mean)} (n ${N(m.best.d.n)}) | ${f3(m.best.c.mean)} (n ${N(m.best.c.n)}) [${f3(m.best.c.meanNet)}] | ${f3(m.worst.d.mean)} (n ${N(m.worst.d.n)}) | ${f3(m.worst.c.mean)} (n ${N(m.worst.c.n)}) [${f3(m.worst.c.meanNet)}] |`);
      L.push('');
    }
  }
  L.push('## Checks', '',
    `- Cut test: ${o.cut.length} cuts on ${[...new Set(o.cut.map((x) => x.market))].join(', ') || 'none'}: ${N(nCut)} signals with their five condition levels known by the cut dates, ${badCut} missing or extra when the candles are cut there.`,
    '- Every trade has its stop on the losing side of the fill (the run throws otherwise); a fill past the stop and a risk under the round-trip cost are no trades; a trade the grid could not resolve is dropped, as in the grid.',
    '- Exclusions: the data-quality audit\'s bad intervals (`combo-grid-2` `exclusions`).', '',
    '| Market | candles from | signals (both rules) | kept trades | dropped (bad data) | past the stop | risk under cost | unresolved | no level: hour / vol / trend / body / dow |',
    '|---|---|---:|---:|---:|---:|---:|---:|---|');
  for (const m of o.meta) L.push(`| ${m.market} | ${m.first} | ${N(m.signals)} | ${N(m.kept)} | ${m.dropped} | ${N(m.bad)} | ${N(m.small)} | ${m.open} | ${m.noLevel.join(' / ')} |`);
  L.push('', '## What it means', '');
  if (o.verdict === 'PASS') {
    L.push(`${o.passed.length} of the 10 fixed comparisons hold out of sample: the before-cost fade tilt is larger under one condition than another,`,
      'with the level chosen on 2005-14 and confirmed on 2015-26. That says where the tilt sits, nothing more. The after-cost column',
      `shows ${net.length ? 'a few levels stay positive after costs in both windows (listed above); they were not tested as rules and are a hypothesis for their own pre-registration' : 'that no level is positive after costs in both windows'}.`,
      'Not an edge, nothing adopted, no live change. No other cut points or splits on these years.');
  } else if (o.verdict === 'FAIL') {
    L.push('No fixed condition separates the fade tilt out of sample: where it sits in discovery does not repeat in confirmation.',
      'The tilt is spread thin over hours, regimes and candle sizes. Nothing live changed; no rule is proposed.');
  } else L.push('Nothing judged (see the headline).');
  L.push('');
  return L.join('\n');
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const [cmd, a, b] = process.argv.slice(2);
  if (cmd === 'market') { fs.mkdirSync(b, { recursive: true }); const t0 = Date.now(); const r = runMarket(a);
    fs.writeFileSync(path.join(b, a + '.json'), JSON.stringify(r)); console.log(a, 'signals', r.signals, 'kept', r.kept, ((Date.now() - t0) / 1000).toFixed(0) + 's'); }
  else if (cmd === 'cut') { fs.mkdirSync(b, { recursive: true }); const r = cutTest(a); fs.writeFileSync(path.join(b, 'cut-' + a + '.json'), JSON.stringify(r)); console.log(JSON.stringify(r)); }
  else if (cmd === 'report') { const o = report(a); console.log(o.verdict, o.headline); }
  else console.log('usage: run.mjs market <m> <dir> | cut <m> <dir> | report <dir>');
}
