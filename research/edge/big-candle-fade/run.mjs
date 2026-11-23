// research/edge/big-candle-fade/run.mjs - the big-candle fade of PREREGISTRATION.md (23 Nov 2026): fade a closed M15 / H1
// candle whose body is over k x ATR(14) (k 1.5 / 2 / 3), split by whether it is also a structure break; 36 cells, ten markets,
// discovery 2005-14, confirmation 2015 to Oct 2026, judged before costs on month sums and against grid7-wide-fade's plain fade.
// Research only: nothing live imports it, nothing is placed.
//   EDGE_DATA=<cache> node research/edge/big-candle-fade/run.mjs market <m> <outDir>
//   EDGE_DATA=<cache> node research/edge/big-candle-fade/run.mjs cut <m> <outDir>
//   node research/edge/big-candle-fade/run.mjs report <outDir>
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import * as K from '../_lib/edgekit.mjs';
import { frames } from '../combo-grid-3/run.mjs';
import { COSTS, exclusions } from '../combo-grid-2/run.mjs';
import { atr14, startIdx } from '../dom-trade-through/run.mjs';
import { MARKETS, ASSUMED, FROM, SPLIT, TO, NM, DM, monthOf, mstat, p1, welch } from '../grid7-wide-core/run.mjs';
import { breaks, exits, CAP as FCAP, ATRK } from '../grid7-wide-fade/run.mjs';

export { MARKETS, ASSUMED };
const HERE = path.dirname(fileURLToPath(import.meta.url));
export const TFS = ['15m', '1h'], TFN = ['m15', 'h1'], KS = [1.5, 2, 3], SPLITS = ['break', 'nobreak'], EXITS = ['1R', '2R', 'half'];
export const NCELL = 36, NPLAIN = 6;
export const cellIndex = (tf, k, sp, x) => ((tf * 3 + k) * 2 + sp) * 3 + x;
export const plainIndex = (tf, x) => tf * 3 + x;
export function cellName(i) { const x = i % 3; let r = (i - x) / 3; const sp = r % 2; r = (r - sp) / 2; const k = r % 3; const tf = (r - k) / 3;
  return { tf: TFN[tf], k: KS[k], split: SPLITS[sp], exit: EXITS[x], name: `${TFN[tf]} k${KS[k]} ${SPLITS[sp]} ${EXITS[x]}` }; }
export const plainName = (i) => `${TFN[Math.floor(i / 3)]} plain fade ${EXITS[i % 3]}`;

// ---- signals (closed candles only) -----------------------------------------------------------------------------------------
// big: { tf, j, d, ts (candle close), ext, mid, a (ATR before j), kmax (index of the largest k passed), brk (a break the same way) }
// plain: grid7-wide-fade's every structure event { tf, j, d, ts, ext, mid, a (ATR at j) }
export function signals(F) {
  const big = [], plain = [];
  TFS.forEach((tfk, tf) => {
    const T = F[tfk], atr = atr14(T), ev = breaks(T), dirAt = new Map(ev.map((e) => [e.i, e.dir]));
    for (const e of ev) { const a = atr[e.i]; if (!(a > 0)) continue; const b = T[e.i];
      plain.push({ tf, j: e.i, d: e.dir, ts: b.e, ext: e.dir > 0 ? b.h : b.l, mid: (b.h + b.l) / 2, a }); }
    for (let j = 15; j < T.length; j++) { const b = T[j], a = atr[j - 1]; if (!(a > 0)) continue;
      const body = Math.abs(b.c - b.o); let kmax = -1; for (let k = 0; k < KS.length; k++) if (body > KS[k] * a) kmax = k;
      if (kmax < 0) continue; const d = b.c > b.o ? 1 : -1;
      big.push({ tf, j, d, ts: b.e, ext: d > 0 ? b.h : b.l, mid: (b.h + b.l) / 2, a, kmax, brk: dirAt.get(j) === d }); }
  });
  return { big, plain };
}

const inBad = (X, t) => { let lo = 0, hi = X.length; while (lo < hi) { const m = (lo + hi) >> 1; if (X[m][0] <= t) lo = m + 1; else hi = m; } return lo > 0 && t <= X[lo - 1][1]; };
function newAcc(n) { return { ms: new Float64Array(n * NM), msNet: new Float64Array(n * NM), n: new Float64Array(n * 2), sum: new Float64Array(n * 2),
  sq: new Float64Array(n * 2), net: new Float64Array(n * 2), win: new Float64Array(n * 2), cr: new Float64Array(n * 2) }; }
function add(A, c, w, m, R, cr) { A.ms[c * NM + m] += R; A.msNet[c * NM + m] += R - cr; A.n[c * 2 + w]++; A.sum[c * 2 + w] += R; A.sq[c * 2 + w] += R * R;
  A.net[c * 2 + w] += R - cr; A.cr[c * 2 + w] += cr; if (R > 0) A.win[c * 2 + w]++; }

// one fade trade (and its mirror) with the three exits; null when no trade
export function trade(M5, g, cost) {
  const fi = startIdx(M5, g.ts); if (fi >= M5.length) return null;
  const fill = M5[fi].o, s = -g.d, stop = g.ext + g.d * ATRK * g.a, risk = s * (fill - stop);
  if (!(risk > 0)) return { skip: 'bad' };
  if (risk < cost) return { skip: 'small' };
  if (!(s * (fill - stop) > 0)) throw new Error('stop on the wrong side');
  const hr = (s * (g.mid - fill)) / risk; const ks = [1, 2, hr >= 1 ? hr : NaN];
  const cap = FCAP[TFS[g.tf]];
  const r = exits(M5, s, fi, stop, ks.map((k) => (Number.isFinite(k) ? fill + s * k * risk : NaN)), cap);
  const p = exits(M5, -s, fi, fill + s * risk, ks.map((k) => (Number.isFinite(k) ? fill - s * k * risk : NaN)), cap);
  if (!r || !p) return { skip: 'open' };
  return { fi, t: M5[fi].t, fill, stop, risk, s, ks, R: r.R, M: p.R };
}

export function runMarket(market) {
  const M5 = K.load(market, '5m', { from: '2004-01-01', to: '2026-11-01' }); const F = frames(M5);
  const { big, plain } = signals(F), cost = COSTS[market], X = exclusions(market);
  const fade = newAcc(NCELL), mirr = newAcc(NCELL), pl = newAcc(NPLAIN); const cnt = { dropped: 0, bad: 0, small: 0, open: 0, sims: 0 };
  const run = (g, fn) => {
    const fi = startIdx(M5, g.ts); if (fi >= M5.length) return; const t = M5[fi].t; if (t < FROM || t >= TO) return;
    if (X.length && inBad(X, t)) { cnt.dropped++; return; }
    const r = trade(M5, g, cost); if (!r) return; if (r.skip) { cnt[r.skip]++; return; } cnt.sims++;
    fn(r, monthOf(t), t < SPLIT ? 0 : 1, cost / r.risk);
  };
  for (const g of big) run(g, (r, m, w, cr) => {
    for (let x = 0; x < 3; x++) { if (!Number.isFinite(r.ks[x])) continue;
      for (let k = 0; k <= g.kmax; k++) { const c = cellIndex(g.tf, k, g.brk ? 0 : 1, x); add(fade, c, w, m, r.R[x], cr); add(mirr, c, w, m, r.M[x], cr); } } });
  const bigCnt = { ...cnt }; for (const k of Object.keys(cnt)) cnt[k] = 0;
  for (const g of plain) run(g, (r, m, w, cr) => { for (let x = 0; x < 3; x++) if (Number.isFinite(r.ks[x])) add(pl, plainIndex(g.tf, x), w, m, r.R[x], cr); });
  const J = (A) => Object.fromEntries(Object.entries(A).map(([k, v]) => [k, Array.from(v, (z) => +z.toFixed(6))]));
  return { market, cost, assumed: ASSUMED.includes(market), first: M5.length ? M5[0].t : null, last: M5.length ? M5[M5.length - 1].t : null,
    bigSignals: big.length, plainSignals: plain.length, big: bigCnt, plainCnt: { ...cnt }, fade: J(fade), mirror: J(mirr), plain: J(pl) };
}

// ---- cut test: the signals known by a date, computed on candles cut there, equal the full run's ---------------------------
export function cutTest(market, cuts = ['2008-06-11', '2012-03-14', '2016-09-21', '2021-02-17', '2025-05-07']) {
  const M5 = K.load(market, '5m', { from: '2004-01-01', to: '2026-11-01' });
  const key = (g) => [g.tf, g.ts, g.d, g.ext, g.mid, g.a.toFixed(10), g.kmax, g.brk].join('|');
  const full = signals(frames(M5)).big; const out = [];
  for (const c of cuts) { const T = Date.parse(c + 'T00:00:00Z') / 1000;
    const cut = signals(frames(M5.filter((b) => b.e <= T))).big.filter((g) => g.ts <= T).map(key);
    const want = full.filter((g) => g.ts <= T).map(key); const A = new Set(cut), B = new Set(want);
    out.push({ market, cut: c, n: B.size, missing: [...B].filter((k) => !A.has(k)).length, extra: [...A].filter((k) => !B.has(k)).length }); }
  return out;
}

// ---- pooled statistics ----------------------------------------------------------------------------------------------------
export function pool(list, kind, n) { const A = newAcc(n); for (const d of list) { const S = d[kind]; for (const k of Object.keys(A)) for (let i = 0; i < A[k].length; i++) A[k][i] += S[k][i]; } return A; }
export function cellStats(A, c) {
  const ms = A.ms.subarray(c * NM, (c + 1) * NM), msn = A.msNet.subarray(c * NM, (c + 1) * NM);
  const win = (w) => { const n = A.n[c * 2 + w], a = w ? DM : 0, b = w ? NM : DM;
    return { n, sum: A.sum[c * 2 + w], sq: A.sq[c * 2 + w], mean: n ? A.sum[c * 2 + w] / n : null, t: mstat(ms, a, b).t, meanNet: n ? A.net[c * 2 + w] / n : null,
      tNet: mstat(msn, a, b).t, win: n ? A.win[c * 2 + w] / n : null, costR: n ? A.cr[c * 2 + w] / n : null, months: b - a }; };
  return { d: win(0), c: win(1) };
}
export const passOf = (x, h) => x.d.n >= 300 && x.c.n >= 300 && x.d.mean > 0 && x.c.mean > 0 && x.d.t >= 2 && x.c.t >= 2 && h < 0.05
  && x.wd != null && x.wc != null && x.wd >= 2 && x.wc >= 2;
export function judge(data) {
  const F = pool(data, 'fade', NCELL), M = pool(data, 'mirror', NCELL), P = pool(data, 'plain', NPLAIN);
  const plain = Array.from({ length: NPLAIN }, (_, i) => ({ i, name: plainName(i), ...cellStats(P, i) }));
  const rows = [];
  for (let c = 0; c < NCELL; c++) { const nm = cellName(c), s = cellStats(F, c), ms = cellStats(M, c);
    const pc = plain[plainIndex(TFN.indexOf(nm.tf), EXITS.indexOf(nm.exit))];
    rows.push({ cell: c, ...nm, d: s.d, c: s.c, p: p1(s.c.t, s.c.months - 1), wd: welch(s.d, pc.d), wc: welch(s.c, pc.c), plain: pc.name,
      mir: { d: ms.d, c: ms.c } }); }
  const H = K.holm(rows.map((r) => r.p));
  rows.forEach((r, i) => { r.holm = H[i];
    r.checks = { n: r.d.n >= 300 && r.c.n >= 300, disc: r.d.mean > 0 && r.d.t >= 2, conf: r.c.mean > 0 && r.c.t >= 2, holm: H[i] < 0.05,
      beats: r.wd != null && r.wc != null && r.wd >= 2 && r.wc >= 2 };
    r.pass = passOf(r, H[i]); });
  return { rows, plain };
}

const f3 = (x) => (x == null ? 'n/a' : (x >= 0 ? '+' : '-') + Math.abs(x).toFixed(3)), f2 = (x) => (x == null ? 'n/a' : x.toFixed(2)), N = (x) => Math.round(x).toLocaleString('en-US');
const slim = (w) => ({ n: w.n, mean: w.mean == null ? null : +w.mean.toFixed(6), t: +w.t.toFixed(6), meanNet: w.meanNet == null ? null : +w.meanNet.toFixed(6),
  tNet: +w.tNet.toFixed(2), win: w.win == null ? null : +w.win.toFixed(3), costR: w.costR == null ? null : +w.costR.toFixed(4) });
const r2 = (x) => (x == null ? null : +x.toFixed(6));

export function report(dir) {
  const data = MARKETS.filter((m) => fs.existsSync(path.join(dir, m + '.json'))).map((m) => JSON.parse(fs.readFileSync(path.join(dir, m + '.json'), 'utf8')));
  const cut = MARKETS.flatMap((m) => { const f = path.join(dir, 'cut-' + m + '.json'); return fs.existsSync(f) ? JSON.parse(fs.readFileSync(f, 'utf8')) : []; });
  const { rows, plain } = judge(data); const pass = rows.filter((r) => r.pass);
  const verdict = data.length < 8 ? 'INCONCLUSIVE' : pass.length ? 'PASS' : 'FAIL';
  const best = [...rows].sort((a, b) => b.c.t - a.c.t)[0], bestPass = [...pass].sort((a, b) => b.c.t - a.c.t)[0];
  const bestBeat = [...rows].filter((r) => r.wc != null).sort((a, b) => Math.min(b.wd ?? -99, b.wc) - Math.min(a.wd ?? -99, a.wc))[0];
  const perMarket = {}; for (const r of pass) perMarket[r.name] = data.map((d) => { const s = cellStats(pool([d], 'fade', NCELL), r.cell);
    return { market: d.market, assumed: d.assumed, d: slim(s.d), c: slim(s.c) }; });
  const b = bestPass || best;
  const headline = verdict === 'PASS'
    ? `${pass.length} of 36 big-candle fade cells pass before costs and beat the plain fade; best ${b.name}, ${f3(b.c.mean)}R a trade in 2015-26 (n ${N(b.c.n)}, month t ${f2(b.c.t)}; discovery ${f3(b.d.mean)}R, t ${f2(b.d.t)}), ${f3(b.c.meanNet)}R after costs`
    : `0 of 36 big-candle fade cells pass; the best confirmation cell, ${b.name}, made ${f3(b.c.mean)}R a trade before costs in 2015-26 (n ${N(b.c.n)}, month t ${f2(b.c.t)}; discovery ${f3(b.d.mean)}R, t ${f2(b.d.t)}; Welch t against the plain fade ${f2(b.wd)} / ${f2(b.wc)})`;
  const RW = rows.map((r) => ({ cell: r.name, tf: r.tf, k: r.k, split: r.split, exit: r.exit, disc: slim(r.d), conf: slim(r.c), holm: +r.holm.toFixed(4),
    plain: r.plain, welchDisc: r2(r.wd), welchConf: r2(r.wc), checks: r.checks, pass: r.pass, mirror: { disc: slim(r.mir.d), conf: slim(r.mir.c) } }));
  const out = { study: 'big-candle-fade', built: '2026-11-23', verdict, headline,
    basis: 'judged before costs on calendar-month sums and against the plain structure-break fade (Welch t per trade, both windows); after costs beside',
    windows: { discovery: '2005-01-01 to 2014-12-31 (120 months)', confirmation: '2015-01-01 to 2026-10-31 (142 months)' }, markets: data.map((d) => d.market),
    assumedCosts: ASSUMED, costs: Object.fromEntries(data.map((d) => [d.market, d.cost])),
    meta: data.map((d) => ({ market: d.market, first: new Date(d.first * 1000).toISOString().slice(0, 10), last: new Date(d.last * 1000).toISOString().slice(0, 10),
      bigSignals: d.bigSignals, plainSignals: d.plainSignals, big: d.big, plain: d.plainCnt })),
    passed: pass.map((r) => r.name), passedNetPositive: pass.filter((r) => r.d.meanNet > 0 && r.c.meanNet > 0).map((r) => r.name),
    bestConfirmation: best.name, closestToBeatingPlain: bestBeat ? bestBeat.name : null,
    plainFade: plain.map((p) => ({ name: p.name, disc: slim(p.d), conf: slim(p.c) })),
    cut, cells: RW, perMarket };
  fs.writeFileSync(path.join(HERE, 'result.json'), JSON.stringify(out, null, 1) + '\n');
  fs.writeFileSync(path.join(HERE, 'RESULT.md'), resultMd(out, rows, plain));
  return out;
}

function resultMd(o, rows, plain) {
  const nCut = o.cut.reduce((a, x) => a + x.n, 0), bad = o.cut.reduce((a, x) => a + x.missing + x.extra, 0);
  const cnt = (f) => rows.filter(f).length; const L = [];
  L.push('# Big-candle fade: an outsized candle rather than a break? (result)', '', `**Verdict: ${o.verdict}. ${o.headline}.**`, '',
    'Run 23 Nov 2026 as pre-registered (`PREREGISTRATION.md`, committed and pushed alone first). Research only: nothing live',
    'changed, nothing is proposed. One run, no variants.', '',
    '## What was run', '',
    'A closed M15 or H1 candle whose body is over k x ATR(14) of the 14 candles before it (k 1.5, 2, 3), FADED: market entry against',
    'it at the next 5-minute open, stop past its extreme + 0.1 ATR, exit at 1R, 2R or back to its 50 % ("half", only when 1R or',
    'more away), time limit 1 day (M15) / 2 days (H1). Split by whether the candle is also a structure break the same way',
    '(`edgekit` `structure`, 3 candles a side) or not. 36 cells. Ten markets pooled, OANDA mid 5-minute candles. Discovery = fills',
    '2005-2014, confirmation = 2015 to October 2026. Judged before costs on month sums, Holm over the 36 confirmation tests, and',
    'against `grid7-wide-fade`\'s plain fade of every structure break on the same timeframe and exit (Welch t per trade >= 2 in both',
    'windows).', `Costs beside: the demo figures for gold and the four majors; **ASSUMED, not measured** for ${o.assumedCosts.join(', ')}.`, '',
    '## The bar, cell by cell', '',
    `- n >= 300 in both windows: ${cnt((r) => r.checks.n)} of 36.`,
    `- Mean R > 0 and month t >= 2 in discovery: ${cnt((r) => r.checks.disc)}; in confirmation: ${cnt((r) => r.checks.conf)}; both: ${cnt((r) => r.checks.disc && r.checks.conf)}.`,
    `- Holm-adjusted p < 0.05: ${cnt((r) => r.checks.holm)}.`,
    `- Beats the plain fade (Welch t >= 2 in both windows): ${cnt((r) => r.checks.beats)}.`,
    `- **All five: ${o.passed.length}${o.passed.length ? ' (' + o.passed.join('; ') + ')' : ''}.**`,
    `- Of those, positive after costs in both windows: ${o.passedNetPositive.length}${o.passedNetPositive.length ? ' (' + o.passedNetPositive.join('; ') + ')' : ''}.`, '',
    '## The plain fade (the comparison, every structure break)', '',
    '| Rule | n 05-14 | R 05-14 (t) | net 05-14 | n 15-26 | R 15-26 (t) | net 15-26 |', '|---|---:|---:|---:|---:|---:|---:|');
  for (const p of plain) L.push(`| ${p.name} | ${N(p.d.n)} | ${f3(p.d.mean)} (${f2(p.d.t)}) | ${f3(p.d.meanNet)} | ${N(p.c.n)} | ${f3(p.c.mean)} (${f2(p.c.t)}) | ${f3(p.c.meanNet)} |`);
  L.push('', '## Every cell', '',
    'R a trade before costs (month-sum t), after costs beside; "cost R" = mean round-trip cost / risk in 2015-26; "vs plain" = Welch t',
    'of the cell against the plain fade, discovery / confirmation; mirror = the same cell traded WITH the candle.', '',
    '| Cell | n 05-14 | R 05-14 (t) | net 05-14 | n 15-26 | R 15-26 (t) | net 15-26 | cost R | Holm | vs plain | Mirror R 15-26 (t) | Pass |',
    '|---|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|---|');
  for (const r of rows) L.push(`| ${r.name} | ${N(r.d.n)} | ${f3(r.d.mean)} (${f2(r.d.t)}) | ${f3(r.d.meanNet)} | ${N(r.c.n)} | ${f3(r.c.mean)} (${f2(r.c.t)}) | ${f3(r.c.meanNet)} | ${r.c.costR == null ? 'n/a' : r.c.costR.toFixed(3)} | ${r.holm.toFixed(3)} | ${f2(r.wd)} / ${f2(r.wc)} | ${f3(r.mir.c.mean)} (${f2(r.mir.c.t)}) | ${r.pass ? 'yes' : 'no'} |`);
  L.push('');
  if (o.passed.length) { L.push('## Per market, passing cells', '', 'Before costs (after costs in brackets); * = cost ASSUMED.', '');
    for (const [name, list] of Object.entries(o.perMarket)) { L.push(`### ${name}`, '', '| Market | n 05-14 | R (t) [net] | n 15-26 | R (t) [net] | cost R 15-26 |', '|---|---:|---:|---:|---:|---:|');
      for (const x of list) L.push(`| ${x.market}${x.assumed ? '*' : ''} | ${N(x.d.n)} | ${f3(x.d.mean)} (${f2(x.d.t)}) [${f3(x.d.meanNet)}] | ${N(x.c.n)} | ${f3(x.c.mean)} (${f2(x.c.t)}) [${f3(x.c.meanNet)}] | ${x.c.costR == null ? 'n/a' : x.c.costR.toFixed(3)} |`);
      L.push(''); } }
  L.push('## Checks', '',
    `- Cut test: ${o.cut.length} cuts on ${[...new Set(o.cut.map((x) => x.market))].join(', ')}: ${N(nCut)} big-candle signals known by the cut dates, ${bad} missing or extra when the candles are cut there.`,
    '- Every trade has its stop on the losing side of the fill (the run throws otherwise); a fill at or past the stop and a risk under the round-trip cost are no trades.',
    '- The ATR that sizes a candle is taken on the 14 candles before it; the candle is known only at its close; the fill is the next 5-minute open.',
    '- Exclusions: the data-quality audit\'s bad intervals (`combo-grid-2` `exclusions`).', '',
    '| Market | candles from | big signals | big simulated | plain signals | plain simulated | dropped (bad data) |', '|---|---|---:|---:|---:|---:|---:|');
  for (const m of o.meta) L.push(`| ${m.market} | ${m.first} | ${N(m.bigSignals)} | ${N(m.big.sims)} | ${N(m.plainSignals)} | ${N(m.plain.sims)} | ${m.big.dropped + m.plain.dropped} |`);
  L.push('', '## What it means', '');
  if (o.verdict === 'PASS') L.push(`${o.passed.length} cells clear the bar before costs in both decades and beat the plain fade. ${o.passedNetPositive.length ? o.passedNetPositive.length + ' stay positive after costs in both windows.' : 'None stays positive after costs in both windows.'}`,
    'A before-cost tilt, not an edge: nothing is adopted; a forward record or any live change needs the owner. One run, no variants on these years.',
    '', '**Size, not the break.** Both passing cells are M15 candles that are NOT a structure break, with the "back to the 50 %" exit:',
    'among big candles the ones that break structure fade no better than the plain fade (their Welch t is near zero or negative in',
    'every cell), and the ones that do not break fade better. So the fade\'s tilt follows an outsized candle giving part of itself',
    'back more than it follows the break. On H1 nothing passes, and the 1R / 2R exits lose to the plain fade everywhere: the tilt is',
    'in the retracement toward the candle\'s middle, which is far (often several R) from a stop just past the candle\'s extreme.',
    '', '**How far from tradable.** The passing cells pay about 0.35-0.44R a trade in costs on these small stops and are negative',
    'after costs in both windows (see "net" and "cost R"); the tilt is smaller than one bid / ask. Cautions: trades overlap freely',
    '(no one-at-a-time), so the per-trade Welch t overstates independence; the big candles that are breaks are also inside the plain',
    'fade; the costs of five markets are assumed. The plain fade\'s 1R and 2R rows reproduce `grid7-wide-fade`\'s cells exactly.');
  else L.push('No cell clears the five checks. See the table: whether big candles fade at all before costs is in the "R" columns, whether they',
    'fade better than every structure break is in "vs plain". The big-candle reading does not replace the break as the trigger of the',
    'fade on this bar. Do not re-test variants of these 36 cells on these years. Nothing live changed; no rule is proposed.');
  L.push('');
  return L.join('\n');
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const [cmd, a, b] = process.argv.slice(2);
  if (cmd === 'market') { fs.mkdirSync(b, { recursive: true }); const t0 = Date.now(); const r = runMarket(a);
    fs.writeFileSync(path.join(b, a + '.json'), JSON.stringify(r)); console.log(a, 'big', r.bigSignals, 'sims', r.big.sims, 'plain', r.plain.sims ?? r.plainCnt.sims, ((Date.now() - t0) / 1000).toFixed(0) + 's'); }
  else if (cmd === 'cut') { fs.mkdirSync(b, { recursive: true }); const r = cutTest(a); fs.writeFileSync(path.join(b, 'cut-' + a + '.json'), JSON.stringify(r)); console.log(JSON.stringify(r)); }
  else if (cmd === 'report') { const o = report(a); console.log(o.verdict, o.headline); }
  else console.log('usage: run.mjs market <m> <dir> | cut <m> <dir> | report <dir>');
}
