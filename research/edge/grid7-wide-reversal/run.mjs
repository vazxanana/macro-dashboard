// research/edge/grid7-wide-reversal/run.mjs - the wide reversal grid of PREREGISTRATION.md (23 Nov 2026): reversal patterns
// (QM, failed engulf) on H1 / M15 at the first touch of a Daily key level (engulf zone, dominant zone, V / A turn of the closes,
// previous week's high / low), market entries, 1R / 2R / measured-move exits, each against its plain-structure-break control;
// ten markets, discovery 2005-14, confirmation 2015 to Oct 2026, judged before costs on month sums.
// Research only: nothing live imports it, nothing is placed. Imports edgekit, combo-grid-3, combo-grid-2, grid6-qm-keylevel,
// dom-trade-through and grid7-wide-core, none edited.
//   EDGE_DATA=<cache> node research/edge/grid7-wide-reversal/run.mjs market <m> <outDir>   one market's accumulators
//   EDGE_DATA=<cache> node research/edge/grid7-wide-reversal/run.mjs cut <m> <outDir>      the cut test of one market
//   node research/edge/grid7-wide-reversal/run.mjs report <outDir>                         result.json + RESULT.md
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import * as K from '../_lib/edgekit.mjs';
import { frames, buildZones, egZones } from '../combo-grid-3/run.mjs';
import { COSTS, exclusions } from '../combo-grid-2/run.mjs';
import { prevHL } from '../grid6-qm-keylevel/run.mjs';
import { atr14, startIdx } from '../dom-trade-through/run.mjs';
import { MARKETS, ASSUMED, FROM, SPLIT, TO, NM, DM, monthOf, mstat, p1, welch } from '../grid7-wide-core/run.mjs';

export { MARKETS, ASSUMED };
const HERE = path.dirname(fileURLToPath(import.meta.url));
export const FAMS = ['eg', 'dom', 'av', 'pw'], PATS = ['qm', 'ef', 'ctl'], TFS = ['1h', '15m'], EXITS = ['1R', '2R', 'mm'];
export const WIN = 24, EF_WIN = 6, ATRK = 0.1, KSW = 2, CAP = { '1h': 2 * 86400, '15m': 86400 };
export const NCELL = FAMS.length * PATS.length * TFS.length * EXITS.length;   // 72 = 48 under test + 24 controls
export const cellIndex = (f, p, t, x) => ((f * PATS.length + p) * TFS.length + t) * EXITS.length + x;
export function cellName(i) { const x = i % 3; i = (i - x) / 3; const t = i % 2; i = (i - t) / 2; const p = i % 3; const f = (i - p) / 3;
  return { fam: FAMS[f], pat: PATS[p], tf: TFS[t], exit: EXITS[x], f, p, t, x }; }
export const controlOf = (i) => { const n = cellName(i); return cellIndex(n.f, 2, n.t, n.x); };

export function levelZones(F) {
  return { eg: buildZones('eg', F['1d']), dom: buildZones('dom', F['1d']), av: buildZones('av', F['1d']), pw: prevHL(F['1w']) };
}

// ---- signals (closed candles only) ------------------------------------------------------------------------------------
// [{ f, p, t, s, j, ts (signal candle close), ext, lvl (pattern trigger level), stop, mm (measured-move target) }]
export function signals(F) {
  const Z = levelZones(F), out = [];
  TFS.forEach((tf, t) => {
    const T = F[tf], atr = atr14(T);
    const qmBy = new Map(); for (const q of K.qms(T, KSW)) qmBy.set(q.i, q);
    const brBy = new Map(); for (const e of K.structure(T, KSW).events) brBy.set(e.i, e);
    const efBy = new Map(); for (const z of egZones(T, 3)) if (z.fi >= 0 && z.fi - z.i <= EF_WIN) { const a = efBy.get(z.fi) || []; a.push(z); efBy.set(z.fi, a); }
    FAMS.forEach((fam, f) => {
      for (const z of Z[fam]) {
        const d = z.d; let k = startIdx(T, z.at);
        while (k < T.length && T[k].t < z.end && !(T[k].l <= z.top && T[k].h >= z.bot)) k++;
        if (k >= T.length || T[k].t >= z.end) continue;
        const found = [false, false, false]; let ext = d > 0 ? Infinity : -Infinity;
        for (let j = k; j < k + WIN && j < T.length && T[j].e < z.end; j++) {
          ext = d > 0 ? Math.min(ext, T[j].l) : Math.max(ext, T[j].h);
          const hits = [];
          const q = qmBy.get(j); if (!found[0] && q && q.side === d && q.headI >= k) hits.push([0, q.level]);
          if (!found[1]) { const ef = (efBy.get(j) || []).find((x) => x.d === -d && x.i >= k); if (ef) hits.push([1, d > 0 ? ef.top : ef.bot]); }
          const e = brBy.get(j); if (!found[2] && e && e.dir === d) hits.push([2, e.level]);
          for (const [p, lvl] of hits) { found[p] = true; const a = atr[j]; if (!(a > 0)) continue;
            out.push({ f, p, t, s: d, j, ts: T[j].e, ext, lvl, stop: ext - d * ATRK * a, mm: lvl + d * Math.abs(lvl - ext) }); }
          if (found[0] && found[1] && found[2]) break;
        }
      }
    });
  });
  return out;
}

// ---- one trade: targets at the given R multiples in one pass (market fill at the open of candle fi; stop first) ----------
export function exits(M5, s, fi, stop, mults, cap) {
  const fill = M5[fi].o, risk = s * (fill - stop); if (!(risk > 0)) return null;
  const n = mults.length, tg = mults.map((m) => (Number.isFinite(m) ? fill + m * s * risk : NaN)), R = new Array(n).fill(NaN);
  let left = 0; for (const x of tg) if (Number.isFinite(x)) left++;
  const dl = M5[fi].t + cap, fin = (k, px) => { if (Number.isFinite(tg[k]) && Number.isNaN(R[k])) { R[k] = (s * (px - fill)) / risk; left--; } };
  const all = (px) => { for (let k = 0; k < n; k++) fin(k, px); };
  for (let j = fi; j < M5.length && left; j++) { const b = M5[j];
    if (j > fi) { if (s * (b.o - stop) <= 0) all(b.o); else for (let k = 0; k < n; k++) if (s * (b.o - tg[k]) >= 0) fin(k, b.o); }
    const low = s > 0 ? b.l : b.h, high = s > 0 ? b.h : b.l;
    if (s * (low - stop) <= 0) all(stop);
    for (let k = 0; k < n; k++) if (s * (high - tg[k]) >= 0) fin(k, tg[k]);
    if (b.e >= dl) all(b.c); }
  return left ? null : { fill, risk, R };
}

const inBad = (X, t) => { let lo = 0, hi = X.length; while (lo < hi) { const m = (lo + hi) >> 1; if (X[m][0] <= t) lo = m + 1; else hi = m; } return lo > 0 && t <= X[lo - 1][1]; };
function newAcc() { return { ms: new Float64Array(NCELL * NM), msNet: new Float64Array(NCELL * NM), n: new Float64Array(NCELL * 2), sum: new Float64Array(NCELL * 2),
  sq: new Float64Array(NCELL * 2), net: new Float64Array(NCELL * 2), win: new Float64Array(NCELL * 2) }; }
function add(A, c, w, m, R, cr) { A.ms[c * NM + m] += R; A.msNet[c * NM + m] += R - cr; A.n[c * 2 + w]++; A.sum[c * 2 + w] += R; A.sq[c * 2 + w] += R * R; A.net[c * 2 + w] += R - cr; if (R > 0) A.win[c * 2 + w]++; }

export function runMarket(market) {
  const M5 = K.load(market, '5m', { from: '2004-01-01', to: '2026-11-01' }); const F = frames(M5);
  const sigs = signals(F), cost = COSTS[market], X = exclusions(market);
  const real = newAcc(), plac = newAcc(), seen = new Set(); let dropped = 0, bad = 0, small = 0, sims = 0, mmNear = 0;
  for (const g of sigs) {
    const key = g.f + '|' + g.p + '|' + g.t + '|' + g.j + '|' + g.s; if (seen.has(key)) continue; seen.add(key);
    const fi = startIdx(M5, g.ts); if (fi >= M5.length) continue; const t = M5[fi].t; if (t < FROM || t >= TO) continue;
    if (X.length && inBad(X, t)) { dropped++; continue; }
    const fill = M5[fi].o, risk = g.s * (fill - g.stop); if (!(risk > 0)) { bad++; continue; }
    if (risk < cost) { small++; continue; }
    if (!(g.s * (fill - g.stop) > 0)) throw new Error('stop on the wrong side');
    let mmR = (g.s * (g.mm - fill)) / risk; if (!(mmR >= 1)) { mmR = NaN; mmNear++; }
    const mults = [1, 2, mmR], cap = CAP[TFS[g.t]];
    const r = exits(M5, g.s, fi, g.stop, mults, cap), q = exits(M5, -g.s, fi, fill + g.s * risk, mults, cap); sims++;
    if (!r || !q) continue;
    const m = monthOf(t), w = t < SPLIT ? 0 : 1, cr = cost / risk;
    for (let x = 0; x < 3; x++) { if (Number.isNaN(r.R[x]) || Number.isNaN(q.R[x])) continue;
      const ci = cellIndex(g.f, g.p, g.t, x); add(real, ci, w, m, r.R[x], cr); add(plac, ci, w, m, q.R[x], cr); }
  }
  const J = (A) => Object.fromEntries(Object.entries(A).map(([k, v]) => [k, Array.from(v, (z) => +z.toFixed(6))]));
  return { market, cost, assumed: ASSUMED.includes(market), first: M5.length ? M5[0].t : null, last: M5.length ? M5[M5.length - 1].t : null,
    signals: sigs.length, sims, dropped, bad, small, mmNear, real: J(real), plac: J(plac) };
}

// ---- cut test: the signals known by a date, computed on candles cut there, equal the full run's ---------------------------
export function cutTest(market, cuts = ['2008-06-11', '2012-03-14', '2016-09-21', '2021-02-17', '2025-05-07']) {
  const M5 = K.load(market, '5m', { from: '2004-01-01', to: '2026-11-01' });
  const key = (g) => [g.f, g.p, g.t, g.ts, g.s, g.stop.toFixed(8), g.mm.toFixed(8)].join('|');
  const full = signals(frames(M5)); const out = [];
  for (const c of cuts) { const T = Date.parse(c + 'T00:00:00Z') / 1000;
    const cut = signals(frames(M5.filter((b) => b.e <= T))).filter((g) => g.ts <= T).map(key);
    const want = full.filter((g) => g.ts <= T).map(key); const A = new Set(cut), B = new Set(want);
    out.push({ market, cut: c, n: B.size, missing: [...B].filter((k) => !A.has(k)).length, extra: [...A].filter((k) => !B.has(k)).length }); }
  return out;
}

// ---- pooled statistics ----------------------------------------------------------------------------------------------------
export function pool(list, kind = 'real') { const A = newAcc(); for (const d of list) { const S = d[kind]; for (const k of Object.keys(A)) for (let i = 0; i < A[k].length; i++) A[k][i] += S[k][i]; } return A; }
export function cellStats(A, c) {
  const ms = A.ms.subarray(c * NM, (c + 1) * NM), msn = A.msNet.subarray(c * NM, (c + 1) * NM);
  const win = (w) => { const n = A.n[c * 2 + w], a = w ? DM : 0, b = w ? NM : DM;
    return { n, mean: n ? A.sum[c * 2 + w] / n : null, t: mstat(ms, a, b).t, meanNet: n ? A.net[c * 2 + w] / n : null, tNet: mstat(msn, a, b).t,
      win: n ? A.win[c * 2 + w] / n : null, months: b - a, sum: A.sum[c * 2 + w], sq: A.sq[c * 2 + w] }; };
  return { d: win(0), c: win(1) };
}
export const passBar = (r) => r.d.n >= 300 && r.c.n >= 300 && r.d.mean > 0 && r.c.mean > 0 && r.d.t >= 2 && r.c.t >= 2;
export function judge(data) {
  const R = pool(data, 'real'), P = pool(data, 'plac'); const rows = [];
  for (let c = 0; c < NCELL; c++) { const nm = cellName(c), s = cellStats(R, c), ps = cellStats(P, c), isCtl = nm.p === 2;
    const cs = isCtl ? null : cellStats(R, controlOf(c));
    rows.push({ cell: c, ...nm, isCtl, d: s.d, c: s.c, p: p1(s.c.t, s.c.months - 1), ctl: cs, vs: cs ? { d: welch(s.d, cs.d), c: welch(s.c, cs.c) } : null,
      plac: { d: ps.d, c: ps.c, p: p1(ps.c.t, ps.c.months - 1) } }); }
  const T = rows.filter((r) => !r.isCtl), H = K.holm(T.map((r) => r.p)), HP = K.holm(T.map((r) => r.plac.p));
  T.forEach((r, i) => { r.holm = H[i]; r.plac.holm = HP[i];
    r.checks = { n: r.d.n >= 300 && r.c.n >= 300, disc: r.d.mean > 0 && r.d.t >= 2, conf: r.c.mean > 0 && r.c.t >= 2, holm: H[i] < 0.05,
      control: !!(r.vs && r.vs.d != null && r.vs.c != null && r.vs.d >= 2 && r.vs.c >= 2) };
    r.pass = Object.values(r.checks).every(Boolean); r.plac.pass = passBar(r.plac) && HP[i] < 0.05; });
  return rows;
}
export function verdictOf(rows) {
  const T = rows.filter((r) => !r.isCtl);
  if (T.some((r) => r.pass)) return 'PASS';
  return T.filter((r) => r.checks.n).length < 24 ? 'INCONCLUSIVE' : 'FAIL';
}

const f3 = (x) => (x == null ? 'n/a' : (x >= 0 ? '+' : '-') + Math.abs(x).toFixed(3)), f2 = (x) => (x == null ? 'n/a' : x.toFixed(2)), N = (x) => Math.round(x).toLocaleString('en-US');
export const cname = (r) => `${r.fam} ${r.pat} ${r.tf} ${r.exit}`;
const slim = (w) => ({ n: w.n, mean: w.mean == null ? null : +w.mean.toFixed(6), t: +w.t.toFixed(6), meanNet: w.meanNet == null ? null : +w.meanNet.toFixed(6), tNet: +w.tNet.toFixed(2),
  win: w.win == null ? null : +w.win.toFixed(3) });

export function report(dir) {
  const data = MARKETS.map((m) => JSON.parse(fs.readFileSync(path.join(dir, m + '.json'), 'utf8')));
  const cut = MARKETS.flatMap((m) => { const f = path.join(dir, 'cut-' + m + '.json'); return fs.existsSync(f) ? JSON.parse(fs.readFileSync(f, 'utf8')) : []; });
  const rows = judge(data), T = rows.filter((r) => !r.isCtl), pass = T.filter((r) => r.pass), plPass = T.filter((r) => r.plac.pass);
  const verdict = verdictOf(rows);
  const bestC = [...T].sort((a, b) => b.c.t - a.c.t)[0], bestBoth = [...T].sort((a, b) => Math.min(b.d.t, b.c.t) - Math.min(a.d.t, a.c.t))[0];
  const perMarket = {}; for (const r of pass) perMarket[r.cell] = data.map((d) => { const s = cellStats(pool([d]), r.cell); return { market: d.market, d: slim(s.d), c: slim(s.c) }; });
  const headline = verdict === 'PASS'
    ? `${pass.length} of 48 cells pass the pre-registered bar: best ${cname(pass[0])}, ${f3(pass[0].c.mean)}R a trade before costs in 2015-26 (n ${N(pass[0].c.n)}, month t ${f2(pass[0].c.t)})`
    : `0 of 48 cells pass; the best confirmation cell, ${cname(bestC)}, made ${f3(bestC.c.mean)}R a trade before costs in 2015-26 (n ${N(bestC.c.n)}, month t ${f2(bestC.c.t)}; discovery ${f3(bestC.d.mean)}R, t ${f2(bestC.d.t)}; vs its control t ${f2(bestC.vs.d)} / ${f2(bestC.vs.c)})`;
  const RW = rows.map((r) => ({ cell: cname(r), fam: r.fam, pat: r.pat, tf: r.tf, exit: r.exit, control: r.isCtl, disc: slim(r.d), conf: slim(r.c),
    holm: r.holm == null ? null : +r.holm.toFixed(4),
    vsControl: r.vs ? { d: r.vs.d == null ? null : +r.vs.d.toFixed(2), c: r.vs.c == null ? null : +r.vs.c.toFixed(2) } : null, checks: r.checks || null, pass: !!r.pass,
    flipped: { disc: slim(r.plac.d), conf: slim(r.plac.c), holm: r.plac.holm == null ? null : +r.plac.holm.toFixed(4), pass: !!r.plac.pass } }));
  const out = { study: 'grid7-wide-reversal', built: '2026-11-23', verdict, headline, basis: 'judged before costs on calendar-month sums (pre-registered); after costs beside',
    windows: { discovery: '2005-01-01 to 2014-12-31 (120 months)', confirmation: '2015-01-01 to 2026-10-31 (142 months)' }, markets: MARKETS,
    assumedCosts: ASSUMED, costs: Object.fromEntries(data.map((d) => [d.market, d.cost])),
    meta: data.map((d) => ({ market: d.market, first: new Date(d.first * 1000).toISOString().slice(0, 10), last: new Date(d.last * 1000).toISOString().slice(0, 10),
      signals: d.signals, sims: d.sims, dropped: d.dropped, bad: d.bad, small: d.small, mmNear: d.mmNear })),
    passed: pass.map(cname), flippedPassed: plPass.map(cname), bestConfirmation: cname(bestC), bestBothWindows: cname(bestBoth),
    reachN: T.filter((r) => r.checks.n).length, cut, cells: RW, perMarket };
  fs.writeFileSync(path.join(HERE, 'result.json'), JSON.stringify(out, null, 1) + '\n');
  fs.writeFileSync(path.join(HERE, 'RESULT.md'), resultMd(out, rows, bestBoth));
  return out;
}

function resultMd(o, rows, bestBoth) {
  const T = rows.filter((r) => !r.isCtl), cnt = (f) => T.filter(f).length;
  const nCut = o.cut.reduce((a, x) => a + x.n, 0), badCut = o.cut.reduce((a, x) => a + x.missing + x.extra, 0);
  const L = [];
  L.push('# Wide reversal grid: reversal patterns at Daily key levels, ten markets (result)', '', `**Verdict: ${o.verdict}. ${o.headline}.**`, '',
    'Run 23 Nov 2026 as pre-registered (`PREREGISTRATION.md`, committed and pushed alone first). Research only: nothing live',
    'changed, nothing is proposed. One run, no variants.', '',
    '## What was run', '',
    'Four Daily key-level families (engulf zone, dominant zone, V / A turn of the closes, previous week\'s high / low), first touch',
    'only; then on H1 or M15, within 24 candles of the touch, a reversal with the level\'s side (against the move into it): a QM whose',
    'new extreme is made at the level, or a failed engulf of the move\'s side (its zone closed through within 6 candles). The',
    'control is the first plain structure break with the level\'s side. Market entry at the next 5-minute open, stop past the',
    'extreme made at the level + 0.1 ATR(14) of the pattern timeframe, exits 1R, 2R or the measured move (extreme to the trigger',
    'level, projected 1:1 beyond it, only when 1R or more away); time limit 2 days (H1) / 1 day (M15). 48 cells under test, 24',
    'controls. Ten markets pooled, OANDA mid 5-minute candles; discovery = fills 2005-2014, confirmation = 2015 to October 2026.',
    `Costs after the fact only: the demo figures for gold and the four majors; **ASSUMED, not measured** for ${o.assumedCosts.join(', ')}.`, '',
    '## The bar, cell by cell', '',
    `- n >= 300 in both windows: ${cnt((r) => r.checks.n)} of 48.`,
    `- Mean R > 0 and month t >= 2 in discovery: ${cnt((r) => r.checks.disc)}; in confirmation: ${cnt((r) => r.checks.conf)}; both: ${cnt((r) => r.checks.disc && r.checks.conf)}.`,
    `- Holm-adjusted p < 0.05 over the 48 confirmation tests: ${cnt((r) => r.checks.holm)}.`,
    `- Beats its own control (Welch t >= 2 in both windows): ${cnt((r) => r.checks.control)} of 48.`,
    `- **All four: ${o.passed.length}${o.passed.length ? ' (' + o.passed.join('; ') + ')' : ''}.**`,
    `- Side-flipped check passing bars 1-3: ${o.flippedPassed.length}${o.flippedPassed.length ? ' (' + o.flippedPassed.join('; ') + ')' : ''}.`, '',
    `Best confirmation cell: ${o.bestConfirmation}. Best on the weaker of the two windows: ${o.bestBothWindows} (discovery`,
    `${f3(bestBoth.d.mean)}R, t ${f2(bestBoth.d.t)}; confirmation ${f3(bestBoth.c.mean)}R, t ${f2(bestBoth.c.t)}).`, '',
    '## Every cell', '',
    'R a trade before costs (month-sum t), after costs beside; "vs ctl" = Welch t of the cell against its control (discovery /',
    'confirmation); Holm on the 48 confirmation tests. Controls are listed last and are not judged.', '',
    '| Cell | n 05-14 | R 05-14 (t) | net 05-14 | n 15-26 | R 15-26 (t) | net 15-26 | vs ctl | Holm | Flipped R 15-26 (t) | Pass |',
    '|---|---:|---:|---:|---:|---:|---:|---:|---:|---:|---|');
  for (const r of [...T, ...rows.filter((x) => x.isCtl)]) L.push(`| ${cname(r)} | ${N(r.d.n)} | ${f3(r.d.mean)} (${f2(r.d.t)}) | ${f3(r.d.meanNet)} | ${N(r.c.n)} | ${f3(r.c.mean)} (${f2(r.c.t)}) | ${f3(r.c.meanNet)} | ${r.vs ? f2(r.vs.d) + ' / ' + f2(r.vs.c) : 'control'} | ${r.holm == null ? '-' : r.holm.toFixed(3)} | ${f3(r.plac.c.mean)} (${f2(r.plac.c.t)}) | ${r.isCtl ? '-' : r.pass ? 'yes' : 'no'} |`);
  L.push('');
  if (o.passed.length) { L.push('## Per market, passing cells', ''); for (const [c, list] of Object.entries(o.perMarket)) { L.push(`### ${cname(rows[c])}`, '', '| Market | n 05-14 | R (t) | n 15-26 | R (t) |', '|---|---:|---:|---:|---:|');
    for (const x of list) L.push(`| ${x.market} | ${N(x.d.n)} | ${f3(x.d.mean)} (${f2(x.d.t)}) | ${N(x.c.n)} | ${f3(x.c.mean)} (${f2(x.c.t)}) |`); L.push(''); } }
  L.push('## Checks', '',
    `- Cut test: ${o.cut.length} cuts on ${[...new Set(o.cut.map((x) => x.market))].join(', ')}: ${N(nCut)} signals known by the cut dates, ${badCut} missing or extra when the candles are cut there.`,
    '- Every trade has its stop on the losing side of the fill (the run throws otherwise); fills at or past the stop and trades whose risk is under the round trip are no trades (same for every cell).',
    '- Exclusions: the data-quality audit\'s bad intervals (`combo-grid-2` `exclusions`).', '',
    '| Market | candles from | signals | simulated | dropped (bad data) | past the stop | risk under cost | mm under 1R |', '|---|---|---:|---:|---:|---:|---:|---:|');
  for (const m of o.meta) L.push(`| ${m.market} | ${m.first} | ${N(m.signals)} | ${N(m.sims)} | ${m.dropped} | ${m.bad} | ${N(m.small)} | ${N(m.mmNear)} |`);
  const mmN = o.meta.reduce((a, m) => a + m.mmNear, 0), simN = o.meta.reduce((a, m) => a + m.sims, 0);
  L.push('', '## The measured-move exit, said plainly', '',
    `The measured move as registered (extreme to the trigger level, projected 1:1 beyond it) was under 1R on ${N(mmN)} of ${N(simN)}`,
    'simulated signals: the signal candle closes beyond the trigger level, so the projection is shorter than the risk (extreme plus',
    'buffer to the fill) almost by construction. The mm cells are therefore nearly empty and fail bar 1. This was seen in a code check',
    'on 2005-2008 EUR/USD candles before the full run (the only figures looked at before it); the registered definition was kept',
    'unchanged rather than amended after that look. The 1R and 2R cells decide the verdict.');
  L.push('', '## What it means', '');
  if (o.verdict === 'PASS') L.push('A passing cell is a candidate for its own forward record and an owner decision, nothing more: it is not adopted, and never called an edge before a forward record.');
  else L.push('Read this simply, no reversal pattern at a Daily key level beats a plain structure break at the same level on ten',
    'markets over 22 years, before costs. With this many trades a real tilt of a few hundredths of an R would have shown. Do not',
    're-test variants of these cells on these years. Nothing live changed; no rule is proposed.');
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
