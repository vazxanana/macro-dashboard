// research/edge/grid7-fade-into-level/run.mjs - PREREGISTRATION.md (23 Nov 2026): grid7-wide-fade's fade of the first structure
// break (M15 / H1, 1 ATR stop, exits 2R and swing) split by what lies ahead of the break on the Daily: into an opposite level,
// through one, or clear. 60 cells, 20 primary tests (into minus clear), ten markets, discovery 2005-14, confirmation 2015 to
// Oct 2026, judged before costs. Research only: nothing live imports it, nothing is placed.
//   EDGE_DATA=<cache> node research/edge/grid7-fade-into-level/run.mjs market <m> <outDir>
//   EDGE_DATA=<cache> node research/edge/grid7-fade-into-level/run.mjs cut <m> <outDir>
//   node research/edge/grid7-fade-into-level/run.mjs report <outDir>
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import * as K from '../_lib/edgekit.mjs';
import { frames, buildZones } from '../combo-grid-3/run.mjs';
import { COSTS, exclusions } from '../combo-grid-2/run.mjs';
import { atr14, startIdx } from '../dom-trade-through/run.mjs';
import { MARKETS, ASSUMED, FROM, SPLIT, TO, NM, DM, monthOf, mstat, welch } from '../grid7-wide-core/run.mjs';
import { signals as fadeSignals, exits, CAP as FCAP } from '../grid7-wide-fade/run.mjs';
import { zones as egZonesCouncil } from '../../../council/eg-methods.mjs';

const HERE = path.dirname(fileURLToPath(import.meta.url));
export { MARKETS, ASSUMED };
export const TFN = ['m15', 'h1'], TFK = ['15m', '1h'], SETS = ['eg', 'dom', 'av', 'pd', 'any'], PLACES = ['into', 'through', 'clear'], EXITS = ['2R', 'swing'];
export const NCELL = 2 * 5 * 3 * 2;   // 60
export const cellIndex = (tf, k, pl, x) => ((tf * 5 + k) * 3 + pl) * 2 + x;
export function cellName(i) { const x = i % 2; let r = (i - x) / 2; const pl = r % 3; r = (r - pl) / 3; const k = r % 5; const tf = (r - k) / 5;
  return { tf: TFN[tf], set: SETS[k], place: PLACES[pl], exit: EXITS[x], name: `${TFN[tf]} ${SETS[k]} ${PLACES[pl]} ${EXITS[x]}` }; }

// ---- the Daily levels: [{ k (0 eg, 1 dom, 2 av), d (+1 demand / -1 supply), bot, top, at (known from), end (gone at) }] -------
export function dailyLevels(D) {
  const C = D.map((b) => ({ time: b.e - 86400, open: b.o, high: b.h, low: b.l, close: b.c }));   // at = the completing close
  const out = [];
  for (const z of egZonesCouncil(C, '1d', 3)) out.push({ k: 0, d: z.dir, bot: z.bot, top: z.top, at: z.at, end: z.end });
  for (const z of buildZones('dom', D)) out.push({ k: 1, d: z.d, bot: z.bot, top: z.top, at: z.at, end: z.end });
  for (const z of buildZones('av', D)) out.push({ k: 2, d: z.d, bot: z.bot, top: z.top, at: z.at, end: z.end });
  return out.sort((a, b) => a.at - b.at);
}
// place of one level for a break of direction d at close P with Daily ATR A: 0 into, 1 through, 2 neither
export function placeOf(d, P, A, bot, top) {
  if (d > 0) { if (top > P && bot - P <= A) return 0; if (top <= P && P - top <= A) return 1; return 2; }
  if (bot < P && P - top <= A) return 0; if (bot >= P && bot - P <= A) return 1; return 2;
}
// for each signal (sorted by ts), places per set [eg, dom, av, pd, any]; closed Daily candles and standing levels only
export function classify(sigs, D) {
  const L = dailyLevels(D), datr = atr14(D); const order = sigs.map((_, i) => i).sort((a, b) => sigs[a].ts - sigs[b].ts);
  const out = new Array(sigs.length); let q = 0; const act = [];
  for (const i of order) { const g = sigs[i], ts = g.ts;
    while (q < L.length && L[q].at <= ts) act.push(L[q++]);
    for (let a = act.length - 1; a >= 0; a--) if (act[a].end <= ts) act.splice(a, 1);
    const di = K.closedCount(D, ts) - 1;
    if (di < 1 || !(datr[di] > 0)) { out[i] = null; continue; }
    const A = datr[di], P = g.close, d = g.d, best = [2, 2, 2, 2];
    for (const z of act) { if (z.d !== -d) continue; const p = placeOf(d, P, A, z.bot, z.top); if (p < best[z.k]) best[z.k] = p; }
    const pd = d > 0 ? D[di].h : D[di].l; best[3] = placeOf(d, P, A, pd, pd);
    out[i] = [...best, Math.min(...best)];
  }
  return out;
}

const inBad = (X, t) => { let lo = 0, hi = X.length; while (lo < hi) { const m = (lo + hi) >> 1; if (X[m][0] <= t) lo = m + 1; else hi = m; } return lo > 0 && t <= X[lo - 1][1]; };
function newAcc() { return { ms: new Float64Array(NCELL * NM), msNet: new Float64Array(NCELL * NM), n: new Float64Array(NCELL * 2), sum: new Float64Array(NCELL * 2),
  sq: new Float64Array(NCELL * 2), net: new Float64Array(NCELL * 2), win: new Float64Array(NCELL * 2), cr: new Float64Array(NCELL * 2) }; }
function add(A, c, w, m, R, cr) { A.ms[c * NM + m] += R; A.msNet[c * NM + m] += R - cr; A.n[c * 2 + w]++; A.sum[c * 2 + w] += R; A.sq[c * 2 + w] += R * R;
  A.net[c * 2 + w] += R - cr; A.cr[c * 2 + w] += cr; if (R > 0) A.win[c * 2 + w]++; }

// the fade signals of PREREGISTRATION.md: context "none", M15 and H1, with the break candle's close
export function signals(F) {
  return fadeSignals(F).filter((g) => g.cx === 0 && g.tf >= 1).map((g) => ({ ...g, tf2: g.tf - 1, close: F[TFK[g.tf - 1]][g.j].c }));
}

export function runMarket(market) {
  const M5 = K.load(market, '5m', { from: '2004-01-01', to: '2026-11-01' }); const F = frames(M5);
  const sigs = signals(F), pl = classify(sigs, F['1d']), cost = COSTS[market], X = exclusions(market);
  const A = newAcc(); const gate = new Float64Array(2 * 2 * 2 * 4);   // [tf][x][w] n, sum (every fade trade), n, sum unplaced (no Daily ATR yet)
  let dropped = 0, bad = 0, small = 0, sims = 0, open = 0, noD = 0;
  sigs.forEach((g, i) => {
    const fi = startIdx(M5, g.ts); if (fi >= M5.length) return; const t = M5[fi].t; if (t < FROM || t >= TO) return;
    if (X.length && inBad(X, t)) { dropped++; return; }
    const fill = M5[fi].o, s = -g.d, stop = fill + g.d * g.a, risk = s * (fill - stop);
    if (!(risk > 0)) { bad++; return; }
    if (risk < cost) { small++; return; }
    if (!(s * (fill - stop) > 0)) throw new Error('stop on the wrong side');
    const sr = g.opp == null ? NaN : (s * (g.opp - fill)) / risk; const ks = [1, 2, sr > 0 ? sr : NaN];
    const cap = FCAP[TFK[g.tf2]];
    const r = exits(M5, s, fi, stop, ks.map((k) => (Number.isFinite(k) ? fill + s * k * risk : NaN)), cap);
    const p = exits(M5, -s, fi, fill + s * risk, ks.map((k) => (Number.isFinite(k) ? fill - s * k * risk : NaN)), cap); sims++;
    if (!r || !p) { open++; return; }
    const P = pl[i]; if (!P) noD++;
    const m = monthOf(t), w = t < SPLIT ? 0 : 1, cr = cost / risk;
    [1, 2].forEach((xi, x) => { if (!Number.isFinite(ks[xi])) return; const R = r.R[xi];
      const gi = ((g.tf2 * 2 + x) * 2 + w) * 4; gate[gi]++; gate[gi + 1] += R;
      if (!P) { gate[gi + 2]++; gate[gi + 3] += R; return; }
      for (let k = 0; k < 5; k++) add(A, cellIndex(g.tf2, k, P[k], x), w, m, R, cr); });
  });
  const J = (Z) => Object.fromEntries(Object.entries(Z).map(([k, v]) => [k, Array.from(v, (z) => +z.toFixed(6))]));
  return { market, cost, assumed: ASSUMED.includes(market), first: M5.length ? M5[0].t : null, last: M5.length ? M5[M5.length - 1].t : null,
    signals: sigs.length, sims, dropped, bad, small, open, noDaily: noD, acc: J(A), gate: Array.from(gate, (z) => +z.toFixed(6)) };
}

// ---- cut test: signals and their places known by a date, computed on candles cut there, equal the full run's ----------------
export function cutTest(market, cuts = ['2008-06-11', '2012-03-14', '2016-09-21', '2021-02-17', '2025-05-07']) {
  const M5 = K.load(market, '5m', { from: '2004-01-01', to: '2026-11-01' });
  const run = (B) => { const F = frames(B), S = signals(F), P = classify(S, F['1d']); return S.map((g, i) => [g.tf2, g.ts, g.d, g.close, g.a.toFixed(10), g.opp, P[i] ? P[i].join('') : 'x'].join('|')).map((k, i) => ({ k, ts: S[i].ts })); };
  const full = run(M5); const out = [];
  for (const c of cuts) { const T = Date.parse(c + 'T00:00:00Z') / 1000;
    const cut = run(M5.filter((b) => b.e <= T)).filter((x) => x.ts <= T).map((x) => x.k);
    const want = full.filter((x) => x.ts <= T).map((x) => x.k); const Aa = new Set(cut), B = new Set(want);
    out.push({ market, cut: c, n: B.size, missing: [...B].filter((k) => !Aa.has(k)).length, extra: [...Aa].filter((k) => !B.has(k)).length }); }
  return out;
}

// ---- pooled statistics ----------------------------------------------------------------------------------------------------
export function pool(list) { const A = newAcc(); for (const d of list) for (const k of Object.keys(A)) for (let i = 0; i < A[k].length; i++) A[k][i] += d.acc[k][i]; return A; }
export function cellStats(A, c) {
  const ms = A.ms.subarray(c * NM, (c + 1) * NM), msn = A.msNet.subarray(c * NM, (c + 1) * NM);
  const win = (w) => { const n = A.n[c * 2 + w], a = w ? DM : 0, b = w ? NM : DM;
    return { n, sum: A.sum[c * 2 + w], sq: A.sq[c * 2 + w], mean: n ? A.sum[c * 2 + w] / n : null, t: mstat(ms, a, b).t, meanNet: n ? A.net[c * 2 + w] / n : null,
      tNet: mstat(msn, a, b).t, win: n ? A.win[c * 2 + w] / n : null, costR: n ? A.cr[c * 2 + w] / n : null, months: b - a }; };
  return { d: win(0), c: win(1) };
}
// paired monthly difference of two cells' month sums (month t)
export function monthDiffT(A, c1, c2, w) { const a = w ? DM : 0, b = w ? NM : DM, diff = new Float64Array(NM);
  for (let m = a; m < b; m++) diff[m] = A.ms[c1 * NM + m] - A.ms[c2 * NM + m]; return mstat(diff, a, b).t; }
const normP1 = (t) => (t == null ? 1 : 0.5 * erfc(t / Math.SQRT2));
function erfc(x) { const z = Math.abs(x), t = 1 / (1 + 0.5 * z);
  const r = t * Math.exp(-z * z - 1.26551223 + t * (1.00002368 + t * (0.37409196 + t * (0.09678418 + t * (-0.18628806 + t * (0.27886807 + t * (-1.13520398 + t * (1.48851587 + t * (-0.82215223 + t * 0.17087277)))))))));
  return x >= 0 ? r : 2 - r; }
export { normP1 };

export function judge(data) {
  const A = pool(data); const cells = []; for (let c = 0; c < NCELL; c++) cells.push({ cell: c, ...cellName(c), ...cellStats(A, c) });
  const tests = [];
  for (let tf = 0; tf < 2; tf++) for (let k = 0; k < 5; k++) for (let x = 0; x < 2; x++) {
    const ci = cellIndex(tf, k, 0, x), cb = cellIndex(tf, k, 1, x), cc = cellIndex(tf, k, 2, x);
    const a = cells[ci], b = cells[cb], c = cells[cc];
    const W = (u, v, w) => welch(u[w], v[w]);
    const T = { name: `${TFN[tf]} ${SETS[k]} ${EXITS[x]}`, tf: TFN[tf], set: SETS[k], exit: EXITS[x],
      diff: { d: a.d.mean - c.d.mean, c: a.c.mean - c.c.mean }, welch: { d: W(a, c, 'd'), c: W(a, c, 'c') },
      monthT: { d: monthDiffT(A, ci, cc, 0), c: monthDiffT(A, ci, cc, 1) },
      through: { d: b.d.mean - c.d.mean, c: b.c.mean - c.c.mean, welchD: W(b, c, 'd'), welchC: W(b, c, 'c') },
      netDiff: { d: a.d.meanNet - c.d.meanNet, c: a.c.meanNet - c.c.meanNet },
      nOk: a.d.n >= 300 && a.c.n >= 300 && c.d.n >= 300 && c.c.n >= 300 };
    T.p = normP1(T.welch.c); tests.push(T); }
  const H = K.holm(tests.map((t) => t.p));
  tests.forEach((t, i) => { t.holm = H[i];
    t.checks = { n: t.nOk, disc: t.diff.d > 0 && t.welch.d >= 2, conf: t.diff.c > 0 && t.welch.c >= 2, holm: H[i] < 0.05 };
    t.pass = t.checks.n && t.checks.disc && t.checks.conf && t.checks.holm; });
  return { cells, tests };
}

// the gate: "any" set, three places summed = grid7-wide-fade's atr cells (n and mean, both windows)
export function gateCheck(data, fadeResult) {
  const out = [];
  for (let tf = 0; tf < 2; tf++) for (let x = 0; x < 2; x++) for (let w = 0; w < 2; w++) {
    let n = 0, s = 0, nu = 0, su = 0; for (const d of data) { const gi = ((tf * 2 + x) * 2 + w) * 4; n += d.gate[gi]; s += d.gate[gi + 1]; nu += d.gate[gi + 2]; su += d.gate[gi + 3]; }
    let n3 = 0, s3 = 0; for (const d of data) for (let pl = 0; pl < 3; pl++) { const c = cellIndex(tf, 4, pl, x); n3 += d.acc.n[c * 2 + w]; s3 += d.acc.sum[c * 2 + w]; }
    const name = `${TFN[tf]} none atr ${EXITS[x]} all`, ref = fadeResult.cells.find((r) => r.cell === name), rw = ref[w ? 'conf' : 'disc'];
    const nAll = n3 + nu, mAll = nAll ? (s3 + su) / nAll : null;
    out.push({ cell: name, window: w ? 'confirmation' : 'discovery', n: nAll, mean: mAll == null ? null : +mAll.toFixed(6), unplaced: nu, refN: rw.n, refMean: rw.mean,
      ok: nAll === n && nAll === rw.n && Math.abs(mAll - rw.mean) < 5e-6 }); }
  return out;
}

const f3 = (x) => (x == null || !Number.isFinite(x) ? 'n/a' : (x >= 0 ? '+' : '-') + Math.abs(x).toFixed(3)), f2 = (x) => (x == null || !Number.isFinite(x) ? 'n/a' : x.toFixed(2)), N = (x) => Math.round(x).toLocaleString('en-US');
const slim = (w) => ({ n: w.n, mean: w.mean == null ? null : +w.mean.toFixed(6), t: +w.t.toFixed(4), meanNet: w.meanNet == null ? null : +w.meanNet.toFixed(6),
  tNet: +w.tNet.toFixed(2), win: w.win == null ? null : +w.win.toFixed(3), costR: w.costR == null ? null : +w.costR.toFixed(4) });
const r4 = (x) => (x == null || !Number.isFinite(x) ? null : +x.toFixed(4));

export function report(dir) {
  const data = MARKETS.filter((m) => fs.existsSync(path.join(dir, m + '.json'))).map((m) => JSON.parse(fs.readFileSync(path.join(dir, m + '.json'), 'utf8')));
  const cut = MARKETS.flatMap((m) => { const f = path.join(dir, 'cut-' + m + '.json'); return fs.existsSync(f) ? JSON.parse(fs.readFileSync(f, 'utf8')) : []; });
  const fade = JSON.parse(fs.readFileSync(path.join(HERE, '../grid7-wide-fade/result.json'), 'utf8'));
  const gate = gateCheck(data, fade), gateOk = data.length === MARKETS.length && gate.every((g) => g.ok);
  const { cells, tests } = judge(data); const pass = tests.filter((t) => t.pass);
  const verdict = data.length < 8 || !gateOk ? 'INCONCLUSIVE' : pass.length ? 'PASS' : 'FAIL';
  const ranked = [...tests].sort((a, b) => (b.welch.c ?? -99) - (a.welch.c ?? -99)), best = pass.length ? [...pass].sort((a, b) => b.welch.c - a.welch.c)[0] : ranked[0];
  const cI = (t, pl) => cells[cellIndex(TFN.indexOf(t.tf), SETS.indexOf(t.set), pl, EXITS.indexOf(t.exit))];
  const ba = cI(best, 0), bc = cI(best, 2);
  const headline = `${pass.length} of 20 into-minus-clear tests pass before costs; ${pass.length ? 'best' : 'largest confirmation Welch t'} ${best.name}: into ${f3(ba.c.mean)}R a trade (n ${N(ba.c.n)}, month t ${f2(ba.c.t)}) against clear ${f3(bc.c.mean)}R (n ${N(bc.c.n)}) in 2015-26, Welch t ${f2(best.welch.c)} (discovery ${f2(best.welch.d)})`;
  const out = { study: 'grid7-fade-into-level', built: '2026-11-23', verdict, headline,
    basis: 'judged before costs (pre-registered): into minus clear, Welch t >= 2 in both windows, Holm over 20; month-sum t and after-cost figures beside',
    windows: { discovery: '2005-01-01 to 2014-12-31 (120 months)', confirmation: '2015-01-01 to 2026-10-31 (142 months)' }, markets: MARKETS,
    assumedCosts: ASSUMED, costs: Object.fromEntries(data.map((d) => [d.market, d.cost])), gate, gateOk,
    meta: data.map((d) => ({ market: d.market, first: new Date(d.first * 1000).toISOString().slice(0, 10), last: new Date(d.last * 1000).toISOString().slice(0, 10),
      signals: d.signals, sims: d.sims, dropped: d.dropped, bad: d.bad, small: d.small, open: d.open, noDaily: d.noDaily })),
    passed: pass.map((t) => t.name), best: best.name, cut,
    tests: tests.map((t) => ({ test: t.name, tf: t.tf, set: t.set, exit: t.exit, diffD: r4(t.diff.d), diffC: r4(t.diff.c), welchD: r4(t.welch.d), welchC: r4(t.welch.c),
      monthTD: r4(t.monthT.d), monthTC: r4(t.monthT.c), throughD: r4(t.through.d), throughC: r4(t.through.c), throughWelchD: r4(t.through.welchD), throughWelchC: r4(t.through.welchC),
      netDiffD: r4(t.netDiff.d), netDiffC: r4(t.netDiff.c), p: +t.p.toExponential(4), holm: +t.holm.toFixed(4), checks: t.checks, pass: t.pass })),
    cells: cells.map((c) => ({ cell: c.name, tf: c.tf, set: c.set, place: c.place, exit: c.exit, disc: slim(c.d), conf: slim(c.c) })) };
  fs.writeFileSync(path.join(HERE, 'result.json'), JSON.stringify(out, null, 1) + '\n');
  fs.writeFileSync(path.join(HERE, 'RESULT.md'), resultMd(out, tests, cells));
  return out;
}

function resultMd(o, tests, cells) {
  const nCut = o.cut.reduce((a, x) => a + x.n, 0), badCut = o.cut.reduce((a, x) => a + x.missing + x.extra, 0);
  const cnt = (f) => tests.filter(f).length; const L = [];
  L.push('# Fading the first structure break: into an opposite Daily level against a clear way (result)', '', `**Verdict: ${o.verdict}. ${o.headline}.**`, '',
    'Run 23 Nov 2026 as pre-registered (`PREREGISTRATION.md`, committed and pushed alone first). Research only: nothing live',
    'changed, nothing is proposed. One run, no variants.', '',
    '## What was run', '',
    '`grid7-wide-fade`\'s own fade trades (imported, not edited): the first structure break on M15 or H1 ("none" context), entered',
    'AGAINST it at the next 5-minute open, stop 1 ATR of the trigger timeframe, exit 2R or the opposite swing. Each trade is placed',
    'by what lies ahead of the break on the Daily (17:00 New York candles, closed by the break; levels known and standing then):',
    'an opposite level (supply above an up break, demand below a down break) of four kinds: Daily engulf zone (`council/eg-methods.mjs`',
    '`zones`, 3-candle span), DOM zone (`combo-grid-3` `buildZones(\'dom\')`), V / A turn of the closes (`buildZones(\'av\')`), the',
    'previous day\'s high / low; and "any" of them. Places: **into** = the close has not fully crossed it and it is within 1 Daily',
    'ATR ahead (inside counts); **through** = crossed, within 1 Daily ATR behind; **clear** = neither. Discovery = fills 2005-14,',
    'confirmation = 2015 to October 2026. Primary test: into minus clear, Welch t >= 2 in both windows and Holm over 20.',
    `Costs beside: the demo figures for gold and the four majors; **ASSUMED, not measured** for ${o.assumedCosts.join(', ')}.`, '',
    '## Gate', '',
    `The "any" set's three places summed reproduce \`grid7-wide-fade\`'s four atr cells: **${o.gateOk ? 'yes' : 'NO'}**.`, '',
    '| Fade cell | Window | n here | of which unplaced | R here | n fade | R fade |', '|---|---|---:|---:|---:|---:|---:|');
  for (const g of o.gate) L.push(`| ${g.cell} | ${g.window} | ${N(g.n)} | ${N(g.unplaced)} | ${f3(g.mean)} | ${N(g.refN)} | ${f3(g.refMean)} |`);
  L.push('', '**Deviation from the pre-registration (said here, decided before any result was seen):** gold and silver candles start on',
    '19 March 2006, so their first fade trades come before 15 Daily candles exist and have no Daily ATR. The pre-registration does',
    'not say where they go. They are kept out of every place ("unplaced", counted in the table above) and the gate compares',
    'places + unplaced with the fade. They are a few dozen trades of March-April 2006, all in discovery.');
  L.push('', '## The bar, test by test', '',
    `- n >= 300 in into and clear in both windows: ${cnt((t) => t.checks.n)} of 20.`,
    `- Into minus clear > 0 with Welch t >= 2 in discovery: ${cnt((t) => t.checks.disc)}; in confirmation: ${cnt((t) => t.checks.conf)}; both: ${cnt((t) => t.checks.disc && t.checks.conf)}.`,
    `- Holm-adjusted p < 0.05: ${cnt((t) => t.checks.holm)}.`,
    `- **All four: ${o.passed.length}${o.passed.length ? ' (' + o.passed.join('; ') + ')' : ''}.**`, '',
    '## The 20 tests', '',
    'Into minus clear, R a trade before costs; Welch t (trade level); month t = the paired monthly difference of the two cells\'',
    'month sums; through minus clear beside; net = the same difference after costs.', '',
    '| Test | diff 05-14 | Welch 05-14 | month t 05-14 | diff 15-26 | Welch 15-26 | month t 15-26 | Holm | through - clear 05-14 / 15-26 (Welch) | net diff 15-26 | Pass |',
    '|---|---:|---:|---:|---:|---:|---:|---:|---:|---:|---|');
  for (const t of tests) L.push(`| ${t.name} | ${f3(t.diff.d)} | ${f2(t.welch.d)} | ${f2(t.monthT.d)} | ${f3(t.diff.c)} | ${f2(t.welch.c)} | ${f2(t.monthT.c)} | ${t.holm.toFixed(3)} | ${f3(t.through.d)} (${f2(t.through.welchD)}) / ${f3(t.through.c)} (${f2(t.through.welchC)}) | ${f3(t.netDiff.c)} | ${t.pass ? 'yes' : 'no'} |`);
  L.push('', '## Every cell', '', 'R a trade before costs (month-sum t), after costs beside; share = the place\'s share of that timeframe and exit\'s trades in the window.', '',
    '| Cell | n 05-14 | share | R 05-14 (t) | net 05-14 | n 15-26 | share | R 15-26 (t) | net 15-26 | cost R 15-26 |', '|---|---:|---:|---:|---:|---:|---:|---:|---:|---:|');
  for (const c of cells) { const base = [0, 1, 2].map((pl) => cells[cellIndex(TFN.indexOf(c.tf), SETS.indexOf(c.set), pl, EXITS.indexOf(c.exit))]);
    const sh = (w) => { const tot = base.reduce((a, b) => a + b[w].n, 0); return tot ? ((100 * c[w].n) / tot).toFixed(1) + '%' : 'n/a'; };
    L.push(`| ${c.name} | ${N(c.d.n)} | ${sh('d')} | ${f3(c.d.mean)} (${f2(c.d.t)}) | ${f3(c.d.meanNet)} | ${N(c.c.n)} | ${sh('c')} | ${f3(c.c.mean)} (${f2(c.c.t)}) | ${f3(c.c.meanNet)} | ${c.c.costR == null ? 'n/a' : c.c.costR.toFixed(3)} |`); }
  L.push('', '## Checks', '',
    `- Cut test: ${o.cut.length} cuts on ${[...new Set(o.cut.map((x) => x.market))].join(', ')}: ${N(nCut)} signals with their places known by the cut dates, ${badCut} missing or extra when the candles are cut there.`,
    '- Every trade has its stop on the losing side of the fill (the run throws otherwise); the fade\'s own no-trade rules apply unchanged.',
    '- Exclusions: the data-quality audit\'s bad intervals (`combo-grid-2` `exclusions`).', '',
    '| Market | candles from | signals | simulated | dropped (bad data) | past the stop | risk under cost | unresolved | no Daily ATR yet |', '|---|---|---:|---:|---:|---:|---:|---:|---:|');
  for (const m of o.meta) L.push(`| ${m.market} | ${m.first} | ${N(m.signals)} | ${N(m.sims)} | ${m.dropped} | ${N(m.bad)} | ${N(m.small)} | ${m.open} | ${m.noDaily} |`);
  L.push('', '## What it means', '');
  if (o.verdict === 'PASS') {
    L.push(`${o.passed.length} of 20 tests clear the bar: the fade's before-cost tilt is larger where the break runs into an opposite Daily level`,
      'than where the way is clear, in both decades. That says where the tilt lives, not that it is tradable: read the net columns.',
      'Nothing adopted, never called an edge, no live change; one run, no variants on these years.');
  } else if (o.verdict === 'FAIL') {
    L.push('No test clears the bar: on these ten markets and both decades, the fade does not do measurably better when the break runs',
      'into an opposite Daily level than when the way is clear (by the pre-registered bar). The before-cost tilt of `grid7-wide-fade`',
      'is not concentrated at Daily levels of these four kinds. Do not re-test variants of these 60 cells on these years. Nothing',
      'live changed; no rule is proposed.');
    const neg = tests.filter((t) => t.diff.c < 0 && t.welch.c <= -2).map((t) => t.name);
    const ci = (set, pl) => cells[cellIndex(0, SETS.indexOf(set), pl, 0)], tot = [0, 1, 2].reduce((a, pl) => a + ci('any', pl).c.n, 0);
    L.push('', `**Where the breaks are.** On M15 (2R) in 2015-26 ${((100 * ci('any', 0).c.n) / tot).toFixed(1)}% of the fade trades have an opposite Daily level of`,
      `some kind within 1 Daily ATR ahead and only ${((100 * ci('any', 2).c.n) / tot).toFixed(1)}% are clear: "into a level" is the usual case, not a special one.`,
      `The other way round: ${neg.length} of the 20 tests show into WORSE than clear with Welch t <= -2 in 2015-26${neg.length ? ' (' + neg.join('; ') + ')' : ''};`,
      'that is the opposite of the reading tested, and it is not a pre-registered test either.',
      '', '**The month t column** is the paired difference of the two cells\' month SUMS, so it mostly measures that "into" holds far more',
      'trades than "clear" (a positive tilt times more trades), not that a trade into a level does better: the Welch t on R a trade is',
      'the pre-registered test.');
  } else L.push('The run could not be judged (markets missing or the gate failed); nothing is concluded.');
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
