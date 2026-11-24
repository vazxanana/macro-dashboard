// research/edge/equal-pool-m5-confirm/run.mjs - a pool of equal H1 highs / lows taken by one H1 candle, entered on a
// 5-minute close back through the last 5-minute swing made before the extreme (PREREGISTRATION.md, 24 Nov 2026). Five
// markets, discovery 2005-14, confirmation 2015 to Oct 2026, judged AFTER costs on month sums; control = a single swing
// taken the same way. Research only: nothing live imports it, nothing is placed.
//   EDGE_DATA=<cache> node research/edge/equal-pool-m5-confirm/run.mjs run <outDir>      (every market, one at a time, + cut test)
//   node research/edge/equal-pool-m5-confirm/run.mjs report <outDir>
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import * as K from '../_lib/edgekit.mjs';
import { COSTS, exclusions } from '../combo-grid-2/run.mjs';
import { atr14, startIdx } from '../dom-trade-through/run.mjs';
import { FROM, SPLIT, TO, NM, DM, monthOf, mstat, p1, welch } from '../grid7-wide-core/run.mjs';
import { exits, sessionOf } from '../grid7-wide-fade/run.mjs';
import { sweptSwings, equalPool } from '../ict-equal-lows/eq.mjs';

const HERE = path.dirname(fileURLToPath(import.meta.url));
export const MARKETS = ['xau', 'eurusd', 'gbpusd', 'usdjpy', 'audusd'];
export const KSW = 3, BACK = 36, ATRK = 0.1, CAP = 86400, TARGETS = [2, 3];
export const EXITS = ['2R', '3R'], SESSIONS = ['all', 'london', 'ny'];
export const NCELL = 6;
export const cellOf = (x, se) => x * 3 + se;                       // se: 0 all, 1 london, 2 ny
export const cellName = (i) => `pool ${EXITS[Math.floor(i / 3)]} ${SESSIONS[i % 3]}`;
export const CUT_MARKETS = ['xau', 'eurusd'];

// daily ATR(14) of the 17:00 New York days that ENDED at or before t (a day still running is never read)
export function dailyAtrE(D, t) {
  let lo = 0, hi = D.length; while (lo < hi) { const m = (lo + hi) >> 1; if (D[m].e <= t) lo = m + 1; else hi = m; }
  const di = lo - 1; if (di < 13) return null;
  let s = 0; for (let i = di - 13; i <= di; i++) s += D[i].h - D[i].l; return s / 14;
}

// ---- events (closed 5-minute candles only) ---------------------------------------------------------------------------------
// M5 = 5-minute candles, T = their UTC hour buckets, D = 17:00 New York days. One event at most per (H1 bucket, side):
// { side (+1 lows taken, bought; -1 highs taken, sold), s (H1 index), q (the confirming 5-minute candle), ts (its close),
//   xi, X (the extreme), L (the deepest swept level), lvl (the 5-minute swing closed through), grp 'pool' | 'single', n, a }
export function events(M5, T, D) {
  const out = [], atr = atr14(T), H = T.map((b) => ({ time: b.t, open: b.o, high: b.h, low: b.l, close: b.c }));
  const sw = K.swings(M5, KSW), SH = [], SL = []; for (const x of sw) (x.type === 'H' ? SH : SL).push(x.i);
  const first = new Int32Array(T.length + 1); { let p = 0; for (let s = 0; s < T.length; s++) { while (p < M5.length && M5[p].t < T[s].t) p++; first[s] = p; } first[T.length] = M5.length; }
  const lastLE = (A, lim) => { let lo = 0, hi = A.length; while (lo < hi) { const m = (lo + hi) >> 1; if (A[m] <= lim) lo = m + 1; else hi = m; } return lo ? A[lo - 1] : -1; };
  for (let s = 1; s < T.length; s++) for (const side of [1, -1]) {
    // speed only: nothing can be swept unless the whole hour went past the previous H1 candle and past some untouched swing
    if (side > 0 ? !(T[s].l < T[s - 1].l) : !(T[s].h > T[s - 1].h)) continue;
    if (!sweptSwings(H, s, side).length) continue;
    const next = s + 1 < T.length && T[s + 1].t === T[s].t + 3600, end = next ? first[s + 2] : first[s + 1], own = first[s + 1];
    const S = side > 0 ? SH : SL, keep = side > 0 ? H[s].low : H[s].high;
    let X = side > 0 ? Infinity : -Infinity, xi = -1;
    for (let q = first[s]; q < end; q++) {
      const b = M5[q], ext = side > 0 ? b.l : b.h;
      if (side > 0 ? ext < X : ext > X) { if (q >= own) break; X = ext; xi = q; continue; }
      const i = lastLE(S, Math.min(xi - 1, q - KSW - 1)); if (i < 0 || i < xi - BACK) continue;
      const lvl = side > 0 ? M5[i].h : M5[i].l; if (!(side * (b.c - lvl) > 0)) continue;
      // what the part of the hour seen so far has taken: candle s carries the extreme so far, never the hour's final low / high
      if (side > 0) H[s].low = X; else H[s].high = X;
      const took = sweptSwings(H, s, side); let grp = null, L = null;
      if (took.length) { const lv = took.map((x) => x.level); L = side > 0 ? Math.min(...lv) : Math.max(...lv);
        if (side * (b.c - L) > 0) { if (took.length === 1) grp = 'single'; else { const aD = dailyAtrE(D, T[s].t); grp = aD > 0 && equalPool(H, s, side, aD).eq ? 'pool' : 'none'; } } }
      if (side > 0) H[s].low = keep; else H[s].high = keep;
      if (!grp) continue;                      // nothing taken yet, or not back past the deepest level: keep walking
      if (grp !== 'none') out.push({ side, s, q, ts: b.e, xi, X, L, lvl, grp, n: took.length, a: atr[s - 1] });
      break;                                   // the first candle that meets the rules decides this hour and side
    }
  }
  return out.sort((a, b) => a.ts - b.ts || b.side - a.side);
}

// one event as a trade: null (no trade) or { fi, t, fill, stop, risk, why }
export function tradeOf(M5, g, cost) {
  const fi = startIdx(M5, g.ts); if (fi >= M5.length) return { why: 'end' };
  const fill = M5[fi].o, stop = g.X - g.side * ATRK * g.a, risk = g.side * (fill - stop);
  if (!(g.a > 0) || !(risk > 0)) return { why: 'bad' };
  if (risk < cost) return { why: 'small' };
  if (!(g.side * (fill - stop) > 0)) throw new Error('stop on the wrong side');
  return { fi, t: M5[fi].t, fill, stop, risk, why: null };
}

const inBad = (X, t) => { let lo = 0, hi = X.length; while (lo < hi) { const m = (lo + hi) >> 1; if (X[m][0] <= t) lo = m + 1; else hi = m; } return lo > 0 && t <= X[lo - 1][1]; };
const WKEYS = ['n', 'sum', 'sq', 'net', 'netSq', 'win', 'cr'];
function newAcc() { const A = { ms: new Float64Array(NCELL * NM), msNet: new Float64Array(NCELL * NM) }; for (const k of WKEYS) A[k] = new Float64Array(NCELL * 2); return A; }
function add(A, c, w, m, R, cr) { const i = c * 2 + w, N = R - cr; A.ms[c * NM + m] += R; A.msNet[c * NM + m] += N; A.n[i]++; A.sum[i] += R; A.sq[i] += R * R;
  A.net[i] += N; A.netSq[i] += N * N; A.cr[i] += cr; if (N > 0) A.win[i]++; }

export function runMarket(market) {
  const M5 = K.load(market, '5m', { from: '2004-01-01', to: '2026-11-01' }); const T = K.resample(M5, 3600), D = K.dailyNY(M5);
  const ev = events(M5, T, D), cost = COSTS[market], X = exclusions(market);
  const real = newAcc(), ctrl = newAcc(); const cnt = { pool: 0, single: 0 }; let dropped = 0, bad = 0, small = 0, open = 0;
  for (const g of ev) {
    const tr = tradeOf(M5, g, cost); if (tr.why === 'end') continue;
    if (tr.why === null && (tr.t < FROM || tr.t >= TO)) continue;
    if (tr.why === 'bad') { const t = M5[startIdx(M5, g.ts)].t; if (t >= FROM && t < TO) bad++; continue; }
    if (tr.why === 'small') { const t = M5[startIdx(M5, g.ts)].t; if (t >= FROM && t < TO) small++; continue; }
    if (X.length && inBad(X, tr.t)) { dropped++; continue; }
    const r = exits(M5, g.side, tr.fi, tr.stop, TARGETS.map((k) => tr.fill + g.side * k * tr.risk), CAP);
    if (!r) { open++; continue; }
    cnt[g.grp]++;
    const cr = cost / tr.risk, m = monthOf(tr.t), w = tr.t < SPLIT ? 0 : 1, se = sessionOf(tr.t), A = g.grp === 'pool' ? real : ctrl;
    for (let x = 0; x < 2; x++) { add(A, cellOf(x, 0), w, m, r.R[x], cr); if (se < 2) add(A, cellOf(x, se + 1), w, m, r.R[x], cr); }
  }
  const J = (A) => Object.fromEntries(Object.entries(A).map(([k, v]) => [k, Array.from(v, (z) => +z.toFixed(6))]));
  const out = { market, cost, first: M5[0].t, last: M5[M5.length - 1].t, events: ev.length, dropped, bad, small, open, counts: cnt, real: J(real), ctrl: J(ctrl) };
  if (CUT_MARKETS.includes(market)) out.cut = cutTest(market, M5, ev);
  return out;
}

// ---- cut test: the events known by a date, computed on candles cut there, equal the full run's -----------------------------
export const evKey = (g) => [g.side, g.ts, g.xi, g.X, g.L, g.lvl, g.grp, g.n, g.a.toFixed(10)].join('|');
export function cutTest(market, M5, full, cuts = ['2008-06-11', '2012-03-14', '2016-09-21', '2021-02-17', '2025-05-07']) {
  const out = [];
  for (const c of cuts) { const t = Date.parse(c + 'T00:00:00Z') / 1000, B = M5.filter((b) => b.e <= t);
    const cut = events(B, K.resample(B, 3600), K.dailyNY(B)).filter((g) => g.ts <= t).map(evKey), want = full.filter((g) => g.ts <= t).map(evKey);
    const A = new Set(cut), W = new Set(want);
    out.push({ market, cut: c, n: W.size, missing: [...W].filter((k) => !A.has(k)).length, extra: [...A].filter((k) => !W.has(k)).length }); }
  return out;
}

// ---- pooled statistics ----------------------------------------------------------------------------------------------------
function pool(list, kind) { const A = newAcc(); for (const d of list) { const S = d[kind]; for (const k of Object.keys(A)) for (let i = 0; i < A[k].length; i++) A[k][i] += S[k][i]; } return A; }
export function cellStats(A, c) {
  const ms = A.ms.subarray(c * NM, (c + 1) * NM), msn = A.msNet.subarray(c * NM, (c + 1) * NM);
  const win = (w) => { const i = c * 2 + w, n = A.n[i], a = w ? DM : 0, b = w ? NM : DM;
    return { n, mean: n ? A.sum[i] / n : null, t: mstat(ms, a, b).t, meanNet: n ? A.net[i] / n : null, tNet: mstat(msn, a, b).t, win: n ? A.win[i] / n : null,
      costR: n ? A.cr[i] / n : null, months: b - a, w: { n, sum: A.net[i], sq: A.netSq[i] } }; };
  return { d: win(0), c: win(1) };
}
export function passes(r) { return r.checks.n && r.checks.disc && r.checks.conf && r.checks.holm; }
export function judge(data) {
  const R = pool(data, 'real'), C = pool(data, 'ctrl'), rows = [];
  for (let c = 0; c < NCELL; c++) { const s = cellStats(R, c), k = cellStats(C, c);
    rows.push({ cell: c, name: cellName(c), d: s.d, c: s.c, ctl: k, wd: welch(s.d.w, k.d.w), wc: welch(s.c.w, k.c.w), p: p1(s.c.tNet, s.c.months - 1) }); }
  const Hm = K.holm(rows.map((r) => r.p));
  rows.forEach((r, i) => { r.holm = Hm[i];
    r.checks = { n: r.d.n >= 300 && r.c.n >= 300, disc: r.d.meanNet > 0 && r.d.tNet >= 2, conf: r.c.meanNet > 0 && r.c.tNet >= 2, holm: Hm[i] < 0.05 };
    r.pass = passes(r); });
  return rows;
}

const f3 = (x) => (x == null ? 'n/a' : (x >= 0 ? '+' : '-') + Math.abs(x).toFixed(3)), f2 = (x) => (x == null ? 'n/a' : x.toFixed(2)), N = (x) => Math.round(x).toLocaleString('en-US');
const pc = (x) => (x == null ? 'n/a' : (100 * x).toFixed(1) + ' %');
const slim = (w) => ({ n: w.n, mean: w.mean == null ? null : +w.mean.toFixed(6), t: +w.t.toFixed(6), meanNet: w.meanNet == null ? null : +w.meanNet.toFixed(6),
  tNet: +w.tNet.toFixed(6), win: w.win == null ? null : +w.win.toFixed(4), costR: w.costR == null ? null : +w.costR.toFixed(4) });

export function report(dir) {
  const data = MARKETS.filter((m) => fs.existsSync(path.join(dir, m + '.json'))).map((m) => JSON.parse(fs.readFileSync(path.join(dir, m + '.json'), 'utf8')));
  const rows = judge(data), pass = rows.filter((r) => r.pass), cut = data.flatMap((d) => d.cut || []);
  const verdict = data.length < MARKETS.length || !rows.some((r) => r.checks.n) ? 'INCONCLUSIVE' : pass.length ? 'PASS' : 'FAIL';
  const best = [...(pass.length ? pass : rows.filter((r) => r.c.n > 0))].sort((a, b) => b.c.tNet - a.c.tNet)[0];
  const headline = `${pass.length} of 6 cells pass; best ${best.name}: ${f3(best.c.meanNet)}R a trade after costs in 2015-26 (n ${N(best.c.n)}, month t ${f2(best.c.tNet)}; ${f3(best.c.mean)}R before), ${f3(best.d.meanNet)}R in 2005-14 (n ${N(best.d.n)}, t ${f2(best.d.tNet)})`;
  const out = { study: 'equal-pool-m5-confirm', built: '2026-11-24', verdict, headline,
    basis: 'judged after costs on calendar-month sums (pre-registered); the control (a single swing taken the same way) is reported beside, not part of the bar',
    windows: { discovery: '2005-01-01 to 2014-12-31 (120 months)', confirmation: '2015-01-01 to 2026-10-31 (142 months)' }, markets: data.map((d) => d.market),
    costs: Object.fromEntries(data.map((d) => [d.market, d.cost])),
    meta: data.map((d) => ({ market: d.market, first: new Date(d.first * 1000).toISOString().slice(0, 10), last: new Date(d.last * 1000).toISOString().slice(0, 10),
      events: d.events, pool: d.counts.pool, single: d.counts.single, dropped: d.dropped, bad: d.bad, small: d.small, open: d.open })),
    passed: pass.map((r) => r.name), best: best.name, cut,
    cells: rows.map((r) => ({ cell: r.name, disc: slim(r.d), conf: slim(r.c), control: { disc: slim(r.ctl.d), conf: slim(r.ctl.c) },
      welchDisc: r.wd == null ? null : +r.wd.toFixed(4), welchConf: r.wc == null ? null : +r.wc.toFixed(4), holm: +r.holm.toFixed(4), checks: r.checks, pass: r.pass })),
    perMarket: Object.fromEntries([0, 3].map((c) => [cellName(c), data.map((d) => { const s = cellStats(pool([d], 'real'), c), k = cellStats(pool([d], 'ctrl'), c);
      return { market: d.market, disc: slim(s.d), conf: slim(s.c), control: { disc: slim(k.d), conf: slim(k.c) } }; })])) };
  fs.writeFileSync(path.join(HERE, 'result.json'), JSON.stringify(out, null, 1) + '\n');
  fs.writeFileSync(path.join(HERE, 'RESULT.md'), resultMd(out));
  return out;
}

function resultMd(o) {
  const nCut = o.cut.reduce((a, x) => a + x.n, 0), badCut = o.cut.reduce((a, x) => a + x.missing + x.extra, 0), C = o.cells, L = [];
  const cnt = (f) => C.filter(f).length;
  L.push('# Equal highs / lows taken by one H1 candle, entered on an M5 break back (result)', '', `**Verdict: ${o.verdict}. ${o.headline}.**`, '',
    'Run 24 Nov 2026 as pre-registered (`PREREGISTRATION.md`, committed alone first). Research only: nothing live changed,',
    'nothing is proposed. One run, no variants.', '',
    '## What was run', '',
    'An H1 candle trades through two or more equal, untouched H1 swing lows / highs (the detector of',
    '`research/edge/ict-equal-lows/eq.mjs`: 3 candles a side, last 96 candles, within 0.1 x the daily ATR, 4+ candles apart),',
    'judged on the part of the hour seen so far. In that hour or the next, the first 5-minute candle that closes back through the',
    'last 5-minute swing (3 a side) made before the extreme, and back past the deepest swept level, is the signal: market at the',
    'next 5-minute open against the sweep, stop past the extreme by 0.1 x the H1 ATR(14), target 2R or 3R, out after one day.',
    'Gold and four forex majors pooled, OANDA mid 5-minute candles; discovery = fills 2005-2014, confirmation = 2015 to October',
    '2026. Judged AFTER costs (the demo account\'s round trips) on calendar-month sums. Control = exactly one swing taken the',
    'same way.', '',
    '## The bar, cell by cell', '',
    `- n >= 300 in both windows: ${cnt((r) => r.checks.n)} of 6.`,
    `- Mean R after costs > 0 and month t >= 2 in discovery: ${cnt((r) => r.checks.disc)}; in confirmation: ${cnt((r) => r.checks.conf)}; both: ${cnt((r) => r.checks.disc && r.checks.conf)}.`,
    `- Holm-adjusted p < 0.05: ${cnt((r) => r.checks.holm)}.`,
    `- **All three: ${o.passed.length}${o.passed.length ? ' (' + o.passed.join('; ') + ')' : ''}.**`, '',
    '## Every cell', '',
    'R a trade before costs ("gross") and after costs ("net", with its month-sum t); "ctrl" = the same cell on single-swing',
    'events, after costs; W = Welch t of pool minus control, after costs, trade by trade.', '');
  for (const [w, lab] of [['disc', '2005-14'], ['conf', '2015-26']]) {
    L.push(`### ${lab === '2005-14' ? 'Discovery' : 'Confirmation'} ${lab}`, '',
      `| Cell | n | win | gross R (t) | cost R | net R (t) | ctrl n | ctrl net R (t) | W |${w === 'conf' ? ' Holm | Pass |' : ''}`,
      `|---|---:|---:|---:|---:|---:|---:|---:|---:|${w === 'conf' ? '---:|---|' : ''}`);
    for (const r of C) { const s = r[w], k = r.control[w], W = w === 'disc' ? r.welchDisc : r.welchConf;
      L.push(`| ${r.cell} | ${N(s.n)} | ${pc(s.win)} | ${f3(s.mean)} (${f2(s.t)}) | ${f2(s.costR)} | ${f3(s.meanNet)} (${f2(s.tNet)}) | ${N(k.n)} | ${f3(k.meanNet)} (${f2(k.tNet)}) | ${f2(W)} |${w === 'conf' ? ` ${r.holm.toFixed(3)} | ${r.pass ? 'PASS' : 'no'} |` : ''}`); }
    L.push(''); }
  L.push('## Per market, all hours', '', 'After costs (before costs in brackets), pool events; "ctrl" = single-swing events after costs.', '');
  for (const [name, list] of Object.entries(o.perMarket)) { L.push(`### ${name}`, '', '| Market | n 05-14 | net R (t) [gross] | ctrl net 05-14 | n 15-26 | net R (t) [gross] | ctrl net 15-26 |', '|---|---:|---:|---:|---:|---:|---:|');
    for (const x of list) L.push(`| ${x.market} | ${N(x.disc.n)} | ${f3(x.disc.meanNet)} (${f2(x.disc.tNet)}) [${f3(x.disc.mean)}] | ${f3(x.control.disc.meanNet)} | ${N(x.conf.n)} | ${f3(x.conf.meanNet)} (${f2(x.conf.tNet)}) [${f3(x.conf.mean)}] | ${f3(x.control.conf.meanNet)} |`);
    L.push(''); }
  L.push('## Checks', '',
    `- Cut test: ${o.cut.length} cuts on ${[...new Set(o.cut.map((x) => x.market))].join(', ') || 'none'}: ${N(nCut)} events known by the cut dates, ${badCut} missing or extra when the candles are cut there.`,
    '- Every trade has its stop on the losing side of the fill (the run throws otherwise); a fill at or past the stop and a risk under the round-trip cost are no trades.',
    '- Exclusions: the data-quality audit\'s bad intervals (`combo-grid-2` `exclusions`).',
    '- Reading of the pre-registration, fixed in the code before the run: when the first confirming candle finds two or more swept swings that are not an equal pool, that hour and side give no event (the walk stops).', '',
    '| Market | candles from | events | pool trades | single trades | dropped (bad data) | past the stop | risk under cost | unresolved |',
    '|---|---|---:|---:|---:|---:|---:|---:|---:|');
  for (const m of o.meta) L.push(`| ${m.market} | ${m.first} | ${N(m.events)} | ${N(m.pool)} | ${N(m.single)} | ${m.dropped} | ${m.bad} | ${m.small} | ${m.open} |`);
  const a2 = C[0], a3 = C[3], beat = cnt((r) => r.welchDisc >= 2 && r.welchConf >= 2);
  L.push('', '## What it means', '');
  if (o.verdict === 'PASS') L.push(`${o.passed.length} of 6 cells clear the pre-registered bar after costs. One study on in-sample years is not a forward record: nothing is adopted, and a paper record or any live change is the owner's decision.`);
  else if (o.verdict === 'INCONCLUSIVE') L.push('No cell has 300 trades in both windows: too few to judge.');
  else L.push(`No cell clears the bar. All hours pooled, the 2R cell makes ${f3(a2.conf.mean)}R a trade before costs and ${f3(a2.conf.meanNet)}R after in 2015-26`,
    `(n ${N(a2.conf.n)}, month t ${f2(a2.conf.tNet)}; 2005-14 ${f3(a2.disc.mean)}R before, ${f3(a2.disc.meanNet)}R after), the 3R cell ${f3(a3.conf.mean)}R before and ${f3(a3.conf.meanNet)}R after`,
    `(month t ${f2(a3.conf.tNet)}). The stop sits just past a 5-minute extreme, so the round trip costs about ${f2(a2.conf.costR)}R a trade.`,
    `A pool of equal swings does ${beat ? 'better than' : 'no better than'} a single swing taken the same way (${beat} of 6 cells with Welch t >= 2 in both windows).`,
    'Waiting for the 5-minute break back does not turn the sweep of equal highs / lows into a rule that pays after costs on',
    'these five markets. Do not re-test variants of these cells on these years. Nothing live changed; no rule is proposed.');
  L.push('');
  return L.join('\n');
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const [cmd, a] = process.argv.slice(2);
  if (cmd === 'run') { fs.mkdirSync(a, { recursive: true });
    for (const m of MARKETS) { const t0 = Date.now(); const r = runMarket(m); fs.writeFileSync(path.join(a, m + '.json'), JSON.stringify(r));
      console.log(m, 'events', r.events, JSON.stringify(r.counts), 'bad', r.bad, 'small', r.small, 'cut', JSON.stringify((r.cut || []).map((x) => x.missing + x.extra)), ((Date.now() - t0) / 1000).toFixed(0) + 's'); } }
  else if (cmd === 'report') { const o = report(a); console.log(o.verdict, o.headline, o.headline.length); }
  else console.log('usage: run.mjs run <dir> | report <dir>');
}
