// research/edge/grid7-wide-fade/run.mjs - the wide fade grid of PREREGISTRATION.md (23 Nov 2026): fade the first structure
// break (enter AGAINST it) on M5 / M15 / H1, with or without grid7-wide-core's H4 engulf-zone context; 54 cells, ten markets,
// discovery 2005-14, confirmation 2015 to Oct 2026, judged before costs on month sums; the WITH-the-break mirror beside.
// Research only: nothing live imports it, nothing is placed.
//   EDGE_DATA=<cache> node research/edge/grid7-wide-fade/run.mjs market <m> <outDir>
//   EDGE_DATA=<cache> node research/edge/grid7-wide-fade/run.mjs cut <m> <outDir>
//   node research/edge/grid7-wide-fade/run.mjs report <outDir>
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import * as K from '../_lib/edgekit.mjs';
import { frames, buildZones } from '../combo-grid-3/run.mjs';
import { COSTS, exclusions } from '../combo-grid-2/run.mjs';
import { atr14, startIdx } from '../dom-trade-through/run.mjs';
import { MARKETS, ASSUMED, FROM, SPLIT, TO, NM, DM, monthOf, mstat, p1 } from '../grid7-wide-core/run.mjs';

export { MARKETS, ASSUMED };
const HERE = path.dirname(fileURLToPath(import.meta.url));
export const TFS = ['5m', '15m', '1h'], TFN = ['m5', 'm15', 'h1'], CTXS = ['none', 'h4eg'], STOPS = ['ext', 'atr'], EXITS = ['1R', '2R', 'swing'];
export const SESS = ['london', 'ny', 'other'];
export const KSW = 3, WIN = 24, ATRK = 0.1, CAP = { '5m': 8 * 3600, '15m': 86400, '1h': 2 * 86400 };
export const NA = 36, NCELL = 54;
export const cellA = (tf, cx, st, x) => ((tf * 2 + cx) * 2 + st) * 3 + x;
export const cellB = (tf, cx, se) => NA + (tf * 2 + cx) * 3 + se;
export function cellName(i) {
  if (i < NA) { const x = i % 3; let r = (i - x) / 3; const st = r % 2; r = (r - st) / 2; const cx = r % 2; const tf = (r - cx) / 2;
    return { tf: TFN[tf], ctx: CTXS[cx], stop: STOPS[st], exit: EXITS[x], session: 'all', name: `${TFN[tf]} ${CTXS[cx]} ${STOPS[st]} ${EXITS[x]} all` }; }
  const j = i - NA, se = j % 3, r = (j - se) / 3, cx = r % 2, tf = (r - cx) / 2;
  return { tf: TFN[tf], ctx: CTXS[cx], stop: 'ext', exit: '1R', session: SESS[se], name: `${TFN[tf]} ${CTXS[cx]} ext 1R ${SESS[se]}` };
}
export const sessionOf = (t) => { const h = new Date(t * 1000).getUTCHours(); return h >= 7 && h < 12 ? 0 : h >= 12 && h < 17 ? 1 : 2; };

// edgekit structure() with the opposite swing standing at each break (the swing target); events must equal edgekit's
export function breaks(bars, Ksw = KSW) {
  const sw = K.swings(bars, Ksw).sort((a, b) => a.ci - b.ci || a.i - b.i); const ev = [];
  let H = null, L = null, s = 0, k = 0;
  for (let j = 0; j < bars.length; j++) {
    while (k < sw.length && sw[k].ci < j) { const x = sw[k++]; if (x.type === 'H') H = x; else L = x; }
    const c = bars[j].c;
    if (H && c > H.price) { ev.push({ i: j, t: bars[j].e, dir: 1, level: H.price, opp: L ? L.price : null }); s = 1; H = null; }
    else if (L && c < L.price) { ev.push({ i: j, t: bars[j].e, dir: -1, level: L.price, opp: H ? H.price : null }); s = -1; L = null; }
  }
  return ev;
}

// ---- signals (closed candles only): { tf, cx, j, d, ts (break close), ext (break candle extreme), a (ATR), opp } ----------
export function signals(F) {
  const out = []; const zones = buildZones('eg', F['4h']);
  TFS.forEach((tfk, tf) => {
    const T = F[tfk], atr = atr14(T), ev = breaks(T), byI = new Map(ev.map((e) => [e.i, e]));
    const push = (cx, e) => { const a = atr[e.i]; if (!(a > 0)) return; const b = T[e.i];
      out.push({ tf, cx, j: e.i, d: e.dir, ts: b.e, ext: e.dir > 0 ? b.h : b.l, a, opp: e.opp }); };
    for (const e of ev) push(0, e);
    const seen = new Set();
    for (const z of zones) {
      let k = startIdx(T, z.at);
      while (k < T.length && T[k].t < z.end && !(T[k].l <= z.top && T[k].h >= z.bot)) k++;
      if (k >= T.length || T[k].t >= z.end) continue;
      for (let j = k; j < k + WIN && j < T.length && T[j].e < z.end; j++) { const e = byI.get(j);
        if (e && e.dir === z.d) { const key = j + '|' + e.dir; if (!seen.has(key)) { seen.add(key); push(1, e); } break; } }
    }
  });
  return out;
}

// ---- one trade, several targets in one pass. tg: target prices (NaN = none). Stop first in a candle that holds both. -------
export function exits(M5, s, fi, stop, tg, cap) {
  const fill = M5[fi].o, risk = s * (fill - stop); if (!(risk > 0)) return null;
  const R = tg.map(() => NaN), dl = M5[fi].t + cap; let left = tg.filter((x) => Number.isFinite(x)).length; if (!left) return { fill, risk, R };
  const fin = (k, px) => { if (Number.isFinite(tg[k]) && Number.isNaN(R[k])) { R[k] = (s * (px - fill)) / risk; left--; } };
  for (let j = fi; j < M5.length && left; j++) { const b = M5[j];
    if (j > fi) { if (s * (b.o - stop) <= 0) tg.forEach((_, k) => fin(k, b.o)); else tg.forEach((x, k) => { if (s * (b.o - x) >= 0) fin(k, b.o); }); }
    const low = s > 0 ? b.l : b.h, high = s > 0 ? b.h : b.l;
    if (s * (low - stop) <= 0) tg.forEach((_, k) => fin(k, stop));
    tg.forEach((x, k) => { if (s * (high - x) >= 0) fin(k, x); });
    if (b.e >= dl) tg.forEach((_, k) => fin(k, b.c)); }
  return left ? null : { fill, risk, R };
}

const inBad = (X, t) => { let lo = 0, hi = X.length; while (lo < hi) { const m = (lo + hi) >> 1; if (X[m][0] <= t) lo = m + 1; else hi = m; } return lo > 0 && t <= X[lo - 1][1]; };
function newAcc() { return { ms: new Float64Array(NCELL * NM), msNet: new Float64Array(NCELL * NM), n: new Float64Array(NCELL * 2), sum: new Float64Array(NCELL * 2),
  sq: new Float64Array(NCELL * 2), net: new Float64Array(NCELL * 2), win: new Float64Array(NCELL * 2), cr: new Float64Array(NCELL * 2) }; }
function add(A, c, w, m, R, cr) { A.ms[c * NM + m] += R; A.msNet[c * NM + m] += R - cr; A.n[c * 2 + w]++; A.sum[c * 2 + w] += R; A.sq[c * 2 + w] += R * R;
  A.net[c * 2 + w] += R - cr; A.cr[c * 2 + w] += cr; if (R > 0) A.win[c * 2 + w]++; }

export function runMarket(market) {
  const M5 = K.load(market, '5m', { from: '2004-01-01', to: '2026-11-01' }); const F = frames(M5);
  const sigs = signals(F), cost = COSTS[market], X = exclusions(market);
  const fade = newAcc(), mirr = newAcc(); let dropped = 0, bad = 0, small = 0, sims = 0, open = 0;
  for (const g of sigs) {
    const fi = startIdx(M5, g.ts); if (fi >= M5.length) continue; const t = M5[fi].t; if (t < FROM || t >= TO) continue;
    if (X.length && inBad(X, t)) { dropped++; continue; }
    const fill = M5[fi].o, s = -g.d, cap = CAP[TFS[g.tf]], m = monthOf(t), w = t < SPLIT ? 0 : 1, se = sessionOf(t);
    for (let st = 0; st < 2; st++) {
      const stop = st === 0 ? g.ext + g.d * ATRK * g.a : fill + g.d * g.a, risk = s * (fill - stop);
      if (!(risk > 0)) { bad++; continue; }
      if (risk < cost) { small++; continue; }
      if (!(s * (fill - stop) > 0)) throw new Error('stop on the wrong side');
      const sr = g.opp == null ? NaN : (s * (g.opp - fill)) / risk; const ks = [1, 2, sr > 0 ? sr : NaN];
      const r = exits(M5, s, fi, stop, ks.map((k) => (Number.isFinite(k) ? fill + s * k * risk : NaN)), cap);
      const p = exits(M5, -s, fi, fill + s * risk, ks.map((k) => (Number.isFinite(k) ? fill - s * k * risk : NaN)), cap); sims++;
      if (!r || !p) { open++; continue; }
      const cr = cost / risk;
      for (let x = 0; x < 3; x++) { if (!Number.isFinite(ks[x])) continue; const c = cellA(g.tf, g.cx, st, x);
        add(fade, c, w, m, r.R[x], cr); add(mirr, c, w, m, p.R[x], cr); }
      if (st === 0) { const c = cellB(g.tf, g.cx, se); add(fade, c, w, m, r.R[0], cr); add(mirr, c, w, m, p.R[0], cr); }
    }
  }
  const J = (A) => Object.fromEntries(Object.entries(A).map(([k, v]) => [k, Array.from(v, (z) => +z.toFixed(6))]));
  return { market, cost, assumed: ASSUMED.includes(market), first: M5.length ? M5[0].t : null, last: M5.length ? M5[M5.length - 1].t : null,
    signals: sigs.length, sims, dropped, bad, small, open, fade: J(fade), mirror: J(mirr) };
}

// ---- cut test: the signals known by a date, computed on candles cut there, equal the full run's ---------------------------
export function cutTest(market, cuts = ['2008-06-11', '2012-03-14', '2016-09-21', '2021-02-17', '2025-05-07']) {
  const M5 = K.load(market, '5m', { from: '2004-01-01', to: '2026-11-01' });
  const key = (g) => [g.tf, g.cx, g.ts, g.d, g.ext, g.a.toFixed(10), g.opp].join('|');
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
    return { n, mean: n ? A.sum[c * 2 + w] / n : null, t: mstat(ms, a, b).t, meanNet: n ? A.net[c * 2 + w] / n : null, tNet: mstat(msn, a, b).t,
      win: n ? A.win[c * 2 + w] / n : null, costR: n ? A.cr[c * 2 + w] / n : null, months: b - a }; };
  return { d: win(0), c: win(1) };
}
export const passOf = (x, h) => x.d.n >= 300 && x.c.n >= 300 && x.d.mean > 0 && x.c.mean > 0 && x.d.t >= 2 && x.c.t >= 2 && h < 0.05;
export function judge(data) {
  const F = pool(data, 'fade'), M = pool(data, 'mirror'); const rows = [];
  for (let c = 0; c < NCELL; c++) { const s = cellStats(F, c), ms = cellStats(M, c);
    rows.push({ cell: c, ...cellName(c), d: s.d, c: s.c, p: p1(s.c.t, s.c.months - 1), mir: { d: ms.d, c: ms.c, p: p1(ms.c.t, ms.c.months - 1) } }); }
  const H = K.holm(rows.map((r) => r.p)), HM = K.holm(rows.map((r) => r.mir.p));
  rows.forEach((r, i) => { r.holm = H[i]; r.mir.holm = HM[i];
    r.checks = { n: r.d.n >= 300 && r.c.n >= 300, disc: r.d.mean > 0 && r.d.t >= 2, conf: r.c.mean > 0 && r.c.t >= 2, holm: H[i] < 0.05 };
    r.pass = passOf(r, H[i]); r.mir.pass = passOf(r.mir, HM[i]); });
  return rows;
}

const f3 = (x) => (x == null ? 'n/a' : (x >= 0 ? '+' : '-') + Math.abs(x).toFixed(3)), f2 = (x) => (x == null ? 'n/a' : x.toFixed(2)), N = (x) => Math.round(x).toLocaleString('en-US');
const slim = (w) => ({ n: w.n, mean: w.mean == null ? null : +w.mean.toFixed(6), t: +w.t.toFixed(6), meanNet: w.meanNet == null ? null : +w.meanNet.toFixed(6),
  tNet: +w.tNet.toFixed(2), win: w.win == null ? null : +w.win.toFixed(3), costR: w.costR == null ? null : +w.costR.toFixed(4) });
const COSTCELLS = () => { const L = []; for (let tf = 0; tf < 3; tf++) for (let st = 0; st < 2; st++) L.push({ cell: cellA(tf, 0, st, 0), label: `${TFN[tf]} ${STOPS[st]}` }); return L; };

export function report(dir) {
  const data = MARKETS.map((m) => JSON.parse(fs.readFileSync(path.join(dir, m + '.json'), 'utf8')));
  const cut = MARKETS.flatMap((m) => { const f = path.join(dir, 'cut-' + m + '.json'); return fs.existsSync(f) ? JSON.parse(fs.readFileSync(f, 'utf8')) : []; });
  const rows = judge(data), pass = rows.filter((r) => r.pass), mPass = rows.filter((r) => r.mir.pass);
  const verdict = data.length < 8 ? 'INCONCLUSIVE' : pass.length ? 'PASS' : 'FAIL';
  const best = [...rows].sort((a, b) => b.c.t - a.c.t)[0], bestPass = [...pass].sort((a, b) => b.c.t - a.c.t)[0];
  const perMarket = {}; for (const r of pass) perMarket[r.name] = data.map((d) => { const s = cellStats(pool([d], 'fade'), r.cell); return { market: d.market, assumed: d.assumed, d: slim(s.d), c: slim(s.c) }; });
  const costByMarket = data.map((d) => { const A = pool([d], 'fade'); const o = { market: d.market, cost: d.cost, assumed: d.assumed };
    for (const x of COSTCELLS()) { const s = cellStats(A, x.cell); const n = s.d.n + s.c.n; o[x.label] = n ? +(((s.d.costR || 0) * s.d.n + (s.c.costR || 0) * s.c.n) / n).toFixed(4) : null; } return o; });
  const b = bestPass || best;
  const headline = verdict === 'PASS'
    ? `${pass.length} of 54 fade cells pass before costs; best ${b.name}, ${f3(b.c.mean)}R a trade in 2015-26 (n ${N(b.c.n)}, month t ${f2(b.c.t)}; discovery ${f3(b.d.mean)}R, t ${f2(b.d.t)}), but ${f3(b.c.meanNet)}R after costs`
    : `0 of 54 fade cells pass; the best confirmation cell, ${b.name}, made ${f3(b.c.mean)}R a trade before costs in 2015-26 (n ${N(b.c.n)}, month t ${f2(b.c.t)}; discovery ${f3(b.d.mean)}R, t ${f2(b.d.t)})`;
  const RW = rows.map((r) => ({ cell: r.name, tf: r.tf, ctx: r.ctx, stop: r.stop, exit: r.exit, session: r.session, disc: slim(r.d), conf: slim(r.c), holm: +r.holm.toFixed(4),
    checks: r.checks, pass: r.pass, mirror: { disc: slim(r.mir.d), conf: slim(r.mir.c), holm: +r.mir.holm.toFixed(4), pass: r.mir.pass } }));
  const out = { study: 'grid7-wide-fade', built: '2026-11-23', verdict, headline, basis: 'judged before costs on calendar-month sums (pre-registered); after costs beside',
    windows: { discovery: '2005-01-01 to 2014-12-31 (120 months)', confirmation: '2015-01-01 to 2026-10-31 (142 months)' }, markets: MARKETS,
    assumedCosts: ASSUMED, costs: Object.fromEntries(data.map((d) => [d.market, d.cost])),
    meta: data.map((d) => ({ market: d.market, first: new Date(d.first * 1000).toISOString().slice(0, 10), last: new Date(d.last * 1000).toISOString().slice(0, 10),
      signals: d.signals, sims: d.sims, dropped: d.dropped, bad: d.bad, small: d.small, open: d.open })),
    passed: pass.map((r) => r.name), mirrorPassed: mPass.map((r) => r.name), bestConfirmation: best.name,
    passedNetPositive: pass.filter((r) => r.d.meanNet > 0 && r.c.meanNet > 0).map((r) => r.name),
    cut, cells: RW, perMarket, costByMarket };
  fs.writeFileSync(path.join(HERE, 'result.json'), JSON.stringify(out, null, 1) + '\n');
  fs.writeFileSync(path.join(HERE, 'RESULT.md'), resultMd(out, rows));
  return out;
}

function resultMd(o, rows) {
  const nCut = o.cut.reduce((a, x) => a + x.n, 0), bad = o.cut.reduce((a, x) => a + x.missing + x.extra, 0);
  const cnt = (f) => rows.filter(f).length; const L = [];
  L.push('# Wide fade grid: fading the first structure break on ten markets (result)', '', `**Verdict: ${o.verdict}. ${o.headline}.**`, '',
    'Run 23 Nov 2026 as pre-registered (`PREREGISTRATION.md`, committed and pushed alone first). Research only: nothing live',
    'changed, nothing is proposed. One run, no variants.', '',
    '## What was run', '',
    'The first structure break (a close beyond the last confirmed swing, 3 candles a side; `edgekit` `structure`) on M5, M15 or H1,',
    'FADED: market entry against the break at the next 5-minute open. Context: every break ("none"), or the first break WITH an',
    'H4 engulf zone after its first touch (`grid7-wide-core`\'s family, "h4eg"). Stop past the break candle\'s extreme + 0.1 ATR',
    '("ext") or 1 ATR ("atr"); exit at 1R, 2R or the opposite swing ("swing"); time limit 8 h / 1 day / 2 days. 36 cells over all',
    'sessions plus 18 by session (ext, 1R): 54. Ten markets pooled, OANDA mid 5-minute candles. Discovery = fills 2005-2014,',
    'confirmation = 2015 to October 2026. Judged before costs on month sums; Holm over the 54 confirmation tests.',
    `Costs beside: the demo figures for gold and the four majors; **ASSUMED, not measured** for ${o.assumedCosts.join(', ')}.`, '',
    '## The bar, cell by cell', '',
    `- n >= 300 in both windows: ${cnt((r) => r.checks.n)} of 54.`,
    `- Mean R > 0 and month t >= 2 in discovery: ${cnt((r) => r.checks.disc)}; in confirmation: ${cnt((r) => r.checks.conf)}; both: ${cnt((r) => r.checks.disc && r.checks.conf)}.`,
    `- Holm-adjusted p < 0.05: ${cnt((r) => r.checks.holm)}.`,
    `- **All four: ${o.passed.length}${o.passed.length ? ' (' + o.passed.join('; ') + ')' : ''}.**`,
    `- Of those, positive after costs in both windows: ${o.passedNetPositive.length}${o.passedNetPositive.length ? ' (' + o.passedNetPositive.join('; ') + ')' : ''}.`,
    `- The mirror (traded WITH the break) passing the same bar: ${o.mirrorPassed.length}${o.mirrorPassed.length ? ' (' + o.mirrorPassed.join('; ') + ')' : ''}.`, '',
    '## Every cell', '',
    'R a trade before costs (month-sum t), after costs beside; "cost R" = mean round-trip cost / risk in 2015-26; mirror = the same',
    'cell traded WITH the break (same fill, same stop distance on the other side, same targets in R).', '',
    '| Cell | n 05-14 | R 05-14 (t) | net 05-14 | n 15-26 | R 15-26 (t) | net 15-26 | cost R | Holm | Mirror R 15-26 (t) | Pass |',
    '|---|---:|---:|---:|---:|---:|---:|---:|---:|---:|---|');
  for (const r of rows) L.push(`| ${r.name} | ${N(r.d.n)} | ${f3(r.d.mean)} (${f2(r.d.t)}) | ${f3(r.d.meanNet)} | ${N(r.c.n)} | ${f3(r.c.mean)} (${f2(r.c.t)}) | ${f3(r.c.meanNet)} | ${r.c.costR == null ? 'n/a' : r.c.costR.toFixed(3)} | ${r.holm.toFixed(3)} | ${f3(r.mir.c.mean)} (${f2(r.mir.c.t)}) | ${r.pass ? 'yes' : 'no'} |`);
  L.push('');
  if (o.passed.length) { L.push('## Per market, passing cells', '', 'Before costs (after costs in brackets); * = cost ASSUMED.', '');
    for (const [name, list] of Object.entries(o.perMarket)) { L.push(`### ${name}`, '', '| Market | n 05-14 | R (t) [net] | n 15-26 | R (t) [net] | cost R 15-26 |', '|---|---:|---:|---:|---:|---:|');
      for (const x of list) L.push(`| ${x.market}${x.assumed ? '*' : ''} | ${N(x.d.n)} | ${f3(x.d.mean)} (${f2(x.d.t)}) [${f3(x.d.meanNet)}] | ${N(x.c.n)} | ${f3(x.c.mean)} (${f2(x.c.t)}) [${f3(x.c.meanNet)}] | ${x.c.costR == null ? 'n/a' : x.c.costR.toFixed(3)} |`);
      L.push(''); } }
  L.push('## Cost in R by market', '', 'Mean round-trip cost / risk over both windows, "none" context, 1R exit (the share of 1R the bid / ask takes); * = ASSUMED.', '',
    '| Market | cost | m5 ext | m5 atr | m15 ext | m15 atr | h1 ext | h1 atr |', '|---|---:|---:|---:|---:|---:|---:|---:|');
  for (const m of o.costByMarket) L.push(`| ${m.market}${m.assumed ? '*' : ''} | ${m.cost} | ${['m5 ext', 'm5 atr', 'm15 ext', 'm15 atr', 'h1 ext', 'h1 atr'].map((k) => (m[k] == null ? 'n/a' : m[k].toFixed(3))).join(' | ')} |`);
  L.push('', '## Checks', '',
    `- Cut test: ${o.cut.length} cuts on ${[...new Set(o.cut.map((x) => x.market))].join(', ')}: ${N(nCut)} signals known by the cut dates, ${bad} missing or extra when the candles are cut there.`,
    '- Every trade has its stop on the losing side of the fill (the run throws otherwise); a fill at or past the stop and a risk under the round-trip cost are no trades (same for every cell and for the mirror).',
    '- Exclusions: the data-quality audit\'s bad intervals (`combo-grid-2` `exclusions`).', '',
    '| Market | candles from | signals | simulated | dropped (bad data) | past the stop | risk under cost | unresolved at data end |', '|---|---|---:|---:|---:|---:|---:|---:|');
  for (const m of o.meta) L.push(`| ${m.market} | ${m.first} | ${N(m.signals)} | ${N(m.sims)} | ${m.dropped} | ${N(m.bad)} | ${N(m.small)} | ${m.open} |`);
  L.push('', '## What it means', '');
  if (o.verdict === 'PASS') {
    L.push(`${o.passed.length} fade cells clear the pre-registered bar before costs in both decades. ${o.passedNetPositive.length ? o.passedNetPositive.length + ' of them stay positive after costs in both windows.' : 'None of them stays positive after costs in both windows: the bid / ask takes more than the tilt.'}`,
      'This is a before-cost tilt, not an edge: the "cost R" column and the market table show how much of each trade the spread',
      'takes, and on the lower timeframes it is larger than the tilt. Nothing is adopted; a forward record or a live change needs',
      'the owner. One run, no variants on these years.');
    const pr = rows.filter((r) => r.pass).map((r) => ({ name: r.name, k: r.c.mean / r.c.costR })).sort((a, b) => b.k - a.k);
    const m1 = rows.filter((r) => r.exit === '1R' && r.session === 'all').map((r) => r.c.mean + r.mir.c.mean);
    L.push('', `**How far from tradable.** In 2015-26 the passing cells' tilt is ${pr[pr.length - 1].k.toFixed(2)} to ${pr[0].k.toFixed(2)} times the round trip they`,
      `pay (best: ${pr[0].name}): the whole tilt is a fraction of one bid / ask. It is largest where the stop is smallest (M5, the`,
      'break-candle stop) and gone where the stop is wide (H1, 1 ATR: +0.011R, t 2.12, Holm 0.54), which is what a reversal of the',
      'mid quote at the scale of the spread would look like, not a move a taker can capture.',
      '', `**The mirror.** Traded WITH the break the same cells lose before costs (${o.mirrorPassed.length} of 54 pass). At 1R the fade and the mirror do not`,
      `sum to zero (fade + mirror in 2015-26: ${Math.min(...m1).toFixed(3)} to ${Math.max(...m1).toFixed(3)}R) because a 5-minute candle that holds both the stop`,
      'and the target is booked as the stop for both sides (the pre-registered rule): with stops of a few pips that is common, and',
      'it makes every small-stop 1R cell look worse on both sides.');
  } else {
    L.push('No fade cell clears the bar: fading the first structure break does not make money before costs in both decades, so the',
      'small losses of trading WITH the break in `grid7-wide-core` are the spread of a near-zero bet, not a mirror edge. Do not',
      're-test variants of these 54 cells on these years. Nothing live changed; no rule is proposed.');
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
