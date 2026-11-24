// research/edge/tl3-m15-engulf/run.mjs - PREREGISTRATION.md (24 Nov 2026): an H1 trendline through two confirmed swing
// lows (rising, buys) or highs (falling, sells), its third touch on M15, an M15 engulf away from the line as the entry;
// beside it the control: every M15 engulf with no line. Four cells, five markets, discovery 2005-14, confirmation
// 2015 to Oct 2026, judged AFTER costs on calendar-month sums. Research only: nothing live imports it, nothing is placed.
//   EDGE_DATA=<cache> node research/edge/tl3-m15-engulf/run.mjs market <m> <outDir>
//   node research/edge/tl3-m15-engulf/run.mjs report <outDir>
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import * as K from '../_lib/edgekit.mjs';
import { engulfAt } from '../../../council/eg-methods.mjs';
import { COSTS, exclusions } from '../combo-grid-2/run.mjs';

const HERE = path.dirname(fileURLToPath(import.meta.url));
export const MARKETS = ['xau', 'eurusd', 'gbpusd', 'usdjpy', 'audusd'];
export const P = { K: 3, apart: 12, life: 150, tol: 0.10, wait: 3, span: 3, buf: 0.10, minCost: 3, swingMin: 0.5, keep: 5, cap: 48 * 3600 };
const y = (yr, mo = 0) => Date.UTC(yr, mo, 1) / 1000;
export const FROM = y(2005), SPLIT = y(2015), TO = y(2026, 10), NM = 262, DM = 120;   // fills 2005-01-01 .. 2026-10-31
export const monthOf = (t) => { const d = new Date(t * 1000); return (d.getUTCFullYear() - 2005) * 12 + d.getUTCMonth(); };
export const CELLS = ['line 2R', 'line swing', 'control 2R', 'control swing'];
const SIDE = ['line 2R buys', 'line 2R sells', 'line swing buys', 'line swing sells'];
const NC = 8;

export function atr14(B, n = 14) {
  const out = new Float64Array(B.length).fill(NaN); let s = 0; const tr = new Float64Array(B.length);
  for (let i = 0; i < B.length; i++) { tr[i] = i ? Math.max(B[i].h - B[i].l, Math.abs(B[i].h - B[i - 1].c), Math.abs(B[i].l - B[i - 1].c)) : B[i].h - B[i].l;
    s += tr[i]; if (i >= n) s -= tr[i - n]; if (i >= n - 1) out[i] = s / n; }
  return out;
}
export const startIdx = (B, t) => { let lo = 0, hi = B.length; while (lo < hi) { const m = (lo + hi) >> 1; if (B[m].t < t) lo = m + 1; else hi = m; } return lo; };

// ---- signals (closed candles only) -----------------------------------------------------------------------------------------
// Each: { kind 'line' | 'ctl', d (+1 buy / -1 sell), j (M15 trigger candle), ts (its close), ext (extreme the stop sits past),
//         a (M15 ATR at j), sw (up to 5 confirmed H1 swing prices on the target side, newest first), touch, base }.
// An H1 candle is used only once an M15 candle STARTS at or after its close.
export function signals(H1, M15, o = {}) {
  const want = o.control !== false;
  const sw = K.swings(H1, P.K).sort((a, b) => a.ci - b.ci || a.i - b.i);
  const aH = atr14(H1), aM = atr14(M15);
  const C = M15.map((b) => ({ open: b.o, high: b.h, low: b.l, close: b.c }));
  const out = [], count = { lines: 0, touched: 0, closedThrough: 0, noEngulf: 0, brokenBefore: 0, expired: 0, replaced: 0 };
  const line = { 1: null, '-1': null }, pts = { 1: [], '-1': [] };   // pts[1] = swing lows (rising line), pts[-1] = swing highs
  const val = (L, k) => L.p0 + L.slope * (k - L.i0);
  let k = 0, hc = 0;
  for (let m = 0; m < M15.length; m++) {
    const b = M15[m];
    while (hc < H1.length && H1[hc].e <= b.t) {
      const j = hc, c = H1[j].c;
      for (const d of [1, -1]) { const L = line[d]; if (!L) continue;
        if (L.touch == null && d * (c - val(L, j)) < 0) { line[d] = null; count.brokenBefore++; }
        else if (L.touch == null && j - L.bi > P.life) { line[d] = null; count.expired++; } }
      while (k < sw.length && sw[k].ci === j) {
        const s = sw[k++], d = s.type === 'L' ? 1 : -1, list = pts[d], A = list[list.length - 1]; list.push(s);
        if (!A || !(d * (s.price - A.price) > 0) || s.i - A.i < P.apart || !(aH[j] > 0)) continue;
        const L = { d, i0: A.i, p0: A.price, slope: (s.price - A.price) / (s.i - A.i), bi: s.i, ci: j, from: H1[j].e, tol: P.tol * aH[j], touch: null };
        let ok = true; for (let q = A.i + 1; q <= j && ok; q++) if (d * (H1[q].c - val(L, q)) < 0) ok = false;
        if (!ok) continue;
        if (line[d]) count.replaced++;
        line[d] = L; count.lines++;
      }
      hc++;
    }
    const eg = m >= 1 ? engulfAt(C, m, P.span) : null;
    const snap = (d) => { const list = pts[-d], r = []; for (let q = list.length - 1; q >= 0 && r.length < P.keep; q--) r.push(list[q].price); return r; };
    const ext = (d, from) => { let x = d > 0 ? Infinity : -Infinity; for (let q = from; q <= m; q++) x = d > 0 ? Math.min(x, M15[q].l) : Math.max(x, M15[q].h); return x; };
    for (const d of [1, -1]) { const L = line[d]; if (!L || b.t < L.from) continue;
      const v = val(L, hc);
      if (L.touch == null) { if (d > 0 ? b.l <= v + L.tol : b.h >= v - L.tol) { L.touch = m; count.touched++; } else continue; }
      if (m > L.touch + P.wait) { line[d] = null; count.noEngulf++; continue; }
      if (d * (b.c - v) < 0) { line[d] = null; count.closedThrough++; continue; }
      if (eg && eg.dir === d && aM[m] > 0) { const from = Math.min(L.touch, eg.j);
        out.push({ kind: 'line', d, j: m, ts: b.e, ext: ext(d, from), a: aM[m], sw: snap(d), touch: L.touch, base: eg.j }); line[d] = null; }
    }
    if (want && eg && aM[m] > 0) out.push({ kind: 'ctl', d: eg.dir, j: m, ts: b.e, ext: ext(eg.dir, eg.j), a: aM[m], sw: snap(eg.dir), touch: null, base: eg.j });
  }
  out.count = count;
  return out;
}

// the stop and the targets of one signal at its fill: null = no trade (a stop on the wrong side never leaves here)
export function plan(g, fill, cost) {
  const stop = g.ext - g.d * P.buf * g.a, risk = g.d * (fill - stop);
  if (!(risk > 0)) return { skip: 'bad' };
  if (risk < P.minCost * cost) return { skip: 'small' };
  let swing = NaN; for (const p of g.sw) if (g.d * (p - fill) >= P.swingMin * risk) { swing = p; break; }
  return { stop, risk, targets: [fill + g.d * 2 * risk, swing] };
}

// one trade, several targets in one pass (NaN = no such target). Stop first in a candle that holds both; a candle opening
// past the stop or a target exits at its open; out at the close of the first candle closing at or after fill time + cap.
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
const KEYS = ['n', 'sum', 'sq', 'net', 'nsq', 'win', 'cr'];
function newAcc() { const A = { ms: new Float64Array(NC * NM), msNet: new Float64Array(NC * NM) }; for (const k of KEYS) A[k] = new Float64Array(NC * 2); return A; }
function add(A, c, w, m, R, cr) { const N = R - cr; A.ms[c * NM + m] += R; A.msNet[c * NM + m] += N; const i = c * 2 + w;
  A.n[i]++; A.sum[i] += R; A.sq[i] += R * R; A.net[i] += N; A.nsq[i] += N * N; A.cr[i] += cr; if (N > 0) A.win[i]++; }

export function runMarket(market, cuts = ['2009-06-10', '2016-09-21', '2023-03-15']) {
  const M5 = K.load(market, '5m', { from: '2004-01-01', to: '2026-11-01' });
  const M15 = K.resample(M5, 900), H1 = K.resample(M5, 3600);
  const sigs = signals(H1, M15), cost = COSTS[market], X = exclusions(market), A = newAcc();
  const meta = { line: 0, ctl: 0, dropped: 0, bad: 0, small: 0, open: 0, lineBad: 0, lineSmall: 0, lineNoSwing: 0 };
  for (const g of sigs) {
    const isL = g.kind === 'line'; meta[isL ? 'line' : 'ctl']++;
    const fi = startIdx(M5, g.ts); if (fi >= M5.length) continue; const t = M5[fi].t; if (t < FROM || t >= TO) continue;
    if (X.length && inBad(X, t)) { meta.dropped++; continue; }
    const fill = M5[fi].o, pl = plan(g, fill, cost);
    if (pl.skip) { meta[pl.skip]++; if (isL) meta[pl.skip === 'bad' ? 'lineBad' : 'lineSmall']++; continue; }
    if (!(g.d * (fill - pl.stop) > 0)) throw new Error('stop on the wrong side');
    const r = exits(M5, g.d, fi, pl.stop, pl.targets, P.cap); if (!r) { meta.open++; continue; }
    if (isL && !Number.isFinite(pl.targets[1])) meta.lineNoSwing++;
    const cr = cost / pl.risk, m = monthOf(t), w = t < SPLIT ? 0 : 1;
    for (let x = 0; x < 2; x++) { if (!Number.isFinite(r.R[x])) continue;
      add(A, (isL ? 0 : 2) + x, w, m, r.R[x], cr);
      if (isL) add(A, 4 + x * 2 + (g.d > 0 ? 0 : 1), w, m, r.R[x], cr); }
  }
  // cut test: the signals known by a date, computed on candles cut there, equal the full run's
  const key = (g) => [g.kind, g.d, g.ts, g.ext, g.a.toFixed(10), g.sw.join(','), g.touch, g.base].join('|');
  const cut = cuts.map((c) => { const T = Date.parse(c + 'T00:00:00Z') / 1000;
    const got = new Set(signals(H1.filter((b) => b.e <= T), M15.filter((b) => b.e <= T)).filter((g) => g.ts <= T).map(key));
    const wantS = new Set(sigs.filter((g) => g.ts <= T).map(key));
    return { market, cut: c, n: wantS.size, missing: [...wantS].filter((q) => !got.has(q)).length, extra: [...got].filter((q) => !wantS.has(q)).length }; });
  const J = Object.fromEntries(Object.entries(A).map(([q, v]) => [q, Array.from(v, (z) => +z.toFixed(6))]));
  return { market, cost, first: M5.length ? M5[0].t : null, last: M5.length ? M5[M5.length - 1].t : null, count: sigs.count, meta, cut, acc: J };
}

// ---- pooled statistics ----------------------------------------------------------------------------------------------------
export function mstat(ms, a, b) { const n = b - a; let s = 0, q = 0; for (let m = a; m < b; m++) { s += ms[m]; q += ms[m] * ms[m]; }
  const mean = s / n, sd = Math.sqrt(Math.max(0, (q - n * mean * mean) / (n - 1))); return { months: n, t: sd > 0 ? mean / (sd / Math.sqrt(n)) : 0 }; }
export const p1 = (t, df) => { const p = K.pFromT(t, df); return p == null ? 1 : t > 0 ? p / 2 : 1 - p / 2; };
export function pool(list) { const A = newAcc(); for (const d of list) for (const q of Object.keys(A)) for (let i = 0; i < A[q].length; i++) A[q][i] += d.acc[q][i]; return A; }
export function cellStats(A, c) {
  const ms = A.ms.subarray(c * NM, (c + 1) * NM), msn = A.msNet.subarray(c * NM, (c + 1) * NM);
  const win = (w) => { const i = c * 2 + w, n = A.n[i], a = w ? DM : 0, b = w ? NM : DM;
    return { n, mean: n ? A.sum[i] / n : null, t: mstat(ms, a, b).t, meanNet: n ? A.net[i] / n : null, tNet: mstat(msn, a, b).t,
      win: n ? A.win[i] / n : null, costR: n ? A.cr[i] / n : null, months: b - a, sumNet: A.net[i], sqNet: A.nsq[i] }; };
  return { d: win(0), c: win(1) };
}
export function welch(a, b) { // { n, sumNet, sqNet }: mean(a) - mean(b) and its Welch t
  if (a.n < 2 || b.n < 2) return { diff: null, t: null };
  const ma = a.sumNet / a.n, mb = b.sumNet / b.n, va = (a.sqNet - a.n * ma * ma) / (a.n - 1), vb = (b.sqNet - b.n * mb * mb) / (b.n - 1);
  const se = Math.sqrt(va / a.n + vb / b.n); return { diff: ma - mb, t: se > 0 ? (ma - mb) / se : null };
}
export const passOf = (x, h) => x.d.n >= 300 && x.c.n >= 300 && x.d.meanNet > 0 && x.c.meanNet > 0 && x.d.tNet >= 2 && x.c.tNet >= 2 && h < 0.05;
export function verdictOf(cells) { const L = cells.slice(0, 2);
  if (L.some((c) => c.pass)) return 'PASS';
  if (L.every((c) => c.disc.n < 300 || c.conf.n < 300)) return 'INCONCLUSIVE';
  return 'FAIL'; }

const f3 = (x) => (x == null ? 'n/a' : (x >= 0 ? '+' : '-') + Math.abs(x).toFixed(3)), f2 = (x) => (x == null ? 'n/a' : x.toFixed(2)), N = (x) => Math.round(x).toLocaleString('en-US');
const slim = (w) => ({ n: w.n, mean: w.mean == null ? null : +w.mean.toFixed(6), t: +w.t.toFixed(6), meanNet: w.meanNet == null ? null : +w.meanNet.toFixed(6),
  tNet: +w.tNet.toFixed(6), win: w.win == null ? null : +w.win.toFixed(4), costR: w.costR == null ? null : +w.costR.toFixed(4) });

export function report(dir) {
  const data = MARKETS.map((m) => JSON.parse(fs.readFileSync(path.join(dir, m + '.json'), 'utf8')));
  const A = pool(data), S = CELLS.map((_, c) => cellStats(A, c));
  const H = K.holm(S.map((s) => p1(s.c.tNet, s.c.months - 1)));
  const cells = CELLS.map((name, c) => ({ cell: name, disc: slim(S[c].d), conf: slim(S[c].c), holm: +H[c].toFixed(4),
    checks: { n: S[c].d.n >= 300 && S[c].c.n >= 300, disc: S[c].d.meanNet > 0 && S[c].d.tNet >= 2, conf: S[c].c.meanNet > 0 && S[c].c.tNet >= 2, holm: H[c] < 0.05 },
    pass: passOf(S[c], H[c]) }));
  const verdict = verdictOf(cells);
  const vs = [0, 1].map((x) => { const d = welch(S[x].d, S[x + 2].d), c = welch(S[x].c, S[x + 2].c);
    return { exit: x ? 'swing' : '2R', disc: { diff: +d.diff.toFixed(6), t: +d.t.toFixed(4) }, conf: { diff: +c.diff.toFixed(6), t: +c.t.toFixed(4) } }; });
  const bySide = SIDE.map((name, q) => { const s = cellStats(A, 4 + q); return { cell: name, disc: slim(s.d), conf: slim(s.c) }; });
  const byMarket = data.map((d) => { const B = pool([d]); return { market: d.market, cost: d.cost, cells: CELLS.map((name, c) => { const s = cellStats(B, c); return { cell: name, disc: slim(s.d), conf: slim(s.c) }; }) }; });
  const best = [...cells.slice(0, 2)].sort((a, b) => b.conf.tNet - a.conf.tNet)[0];
  const headline = `0 of 2 line cells pass; the better one, ${best.cell}, made ${f3(best.conf.meanNet)}R a trade after costs in 2015-26 (n ${N(best.conf.n)}, month t ${f2(best.conf.tNet)}; ${f3(best.conf.mean)}R before costs) and ${f3(best.disc.meanNet)}R in 2005-14 (n ${N(best.disc.n)}, month t ${f2(best.disc.tNet)})`;
  const headPass = `${cells.slice(0, 2).filter((c) => c.pass).map((c) => c.cell).join(' and ')} pass${cells.slice(0, 2).filter((c) => c.pass).length === 1 ? 'es' : ''}; ${best.cell} made ${f3(best.conf.meanNet)}R a trade after costs in 2015-26 (n ${N(best.conf.n)}, month t ${f2(best.conf.tNet)}) and ${f3(best.disc.meanNet)}R in 2005-14 (n ${N(best.disc.n)}, month t ${f2(best.disc.tNet)})`;
  const sumC = (q) => data.reduce((a, d) => a + (d.count[q] || 0), 0), sumM = (q) => data.reduce((a, d) => a + (d.meta[q] || 0), 0);
  const out = { study: 'tl3-m15-engulf', built: '2026-11-24', verdict, headline: verdict === 'PASS' ? headPass : headline, best: best.cell,
    basis: 'judged after costs on calendar-month sums by fill month (pre-registered); before costs beside',
    windows: { discovery: '2005-01-01 to 2014-12-31 (120 months)', confirmation: '2015-01-01 to 2026-10-31 (142 months)' },
    markets: MARKETS, costs: Object.fromEntries(data.map((d) => [d.market, d.cost])), params: P,
    cells, lineVsControl: vs, bySide, byMarket,
    counts: { lines: sumC('lines'), touched: sumC('touched'), brokenBeforeTouch: sumC('brokenBefore'), expired: sumC('expired'), replaced: sumC('replaced'),
      closedThrough: sumC('closedThrough'), noEngulf: sumC('noEngulf'), lineSignals: sumM('line'), controlSignals: sumM('ctl'),
      dropped: sumM('dropped'), pastStop: sumM('bad'), riskUnder3Cost: sumM('small'), unresolved: sumM('open'), lineRiskUnder3Cost: sumM('lineSmall'), lineNoSwingTarget: sumM('lineNoSwing') },
    meta: data.map((d) => ({ market: d.market, first: new Date(d.first * 1000).toISOString().slice(0, 10), last: new Date(d.last * 1000).toISOString().slice(0, 10), ...d.count, ...d.meta })),
    cut: data.flatMap((d) => d.cut) };
  fs.writeFileSync(path.join(HERE, 'result.json'), JSON.stringify(out, null, 1) + '\n');
  fs.writeFileSync(path.join(HERE, 'RESULT.md'), resultMd(out));
  return out;
}

function resultMd(o) {
  const L = [], row = (c) => `| ${c.cell} | ${N(c.disc.n)} | ${f3(c.disc.mean)} (${f2(c.disc.t)}) | ${f3(c.disc.meanNet)} (${f2(c.disc.tNet)}) | ${N(c.conf.n)} | ${f3(c.conf.mean)} (${f2(c.conf.t)}) | ${f3(c.conf.meanNet)} (${f2(c.conf.tNet)}) | ${c.conf.win == null ? 'n/a' : (c.conf.win * 100).toFixed(1) + ' %'} | ${c.conf.costR == null ? 'n/a' : c.conf.costR.toFixed(3)} |`;
  const nCut = o.cut.reduce((a, x) => a + x.n, 0), badCut = o.cut.reduce((a, x) => a + x.missing + x.extra, 0), k = o.counts;
  L.push('# H1 trendline, third touch, M15 engulf away from the line: result (24 Nov 2026)', '', `**Verdict: ${o.verdict}. ${o.headline}.**`, '',
    'Run once, as pre-registered (`PREREGISTRATION.md`, committed alone before this code). Research only: nothing live changed,',
    'nothing is proposed. Code: `run.mjs` (the shared toolkit, `engulfAt` of `council/eg-methods.mjs`, the costs and data-quality',
    'exclusions of `combo-grid-2`). Data: OANDA mid 5-minute candles of xau, eurusd, gbpusd, usdjpy, audusd, grouped to UTC M15 and H1.', '',
    '## What was run', '',
    'A rising H1 line through two confirmed swing lows (3 candles a side, the second higher, at least 12 H1 candles apart, never',
    'closed below); its third touch = the first M15 candle that comes within 0.1 H1 ATR of it; within that candle and the next three,',
    'an M15 engulf up (a close above the high of the last opposite candle, 3 candles back at most) with no M15 close below the line:',
    'buy at the next 5-minute open, stop 0.1 M15 ATR under the lowest low since the touch, target 2R or the last H1 swing high at',
    'least 0.5R away, out after 48 hours. Sells mirror it on a falling line through two swing highs. Control: every M15 engulf, no',
    'line, same stop rule and exits. A trade risking under 3 round trips is skipped. Costs are taken off every trade.', '',
    '## Every cell', '',
    'R a trade (month-sum t in brackets), before and after costs; win rate and mean cost in R are the confirmation window\'s, after costs.', '',
    '| Cell | n 05-14 | before costs 05-14 (t) | after costs 05-14 (t) | n 15-26 | before costs 15-26 (t) | after costs 15-26 (t) | winners | cost R | Holm | Pass |',
    '|---|---:|---:|---:|---:|---:|---:|---:|---:|---:|---|');
  for (const c of o.cells) L.push(row(c) + ` ${c.holm.toFixed(3)} | ${c.pass ? 'yes' : 'no'} |`);
  L.push('', '## Does the line pick better engulfs?', '', 'Line minus control, R a trade after costs (Welch t on trades; descriptive, no verdict).', '',
    '| Exit | 2005-14 | 2015-26 |', '|---|---:|---:|');
  for (const v of o.lineVsControl) L.push(`| ${v.exit} | ${f3(v.disc.diff)} (t ${f2(v.disc.t)}) | ${f3(v.conf.diff)} (t ${f2(v.conf.t)}) |`);
  L.push('', '## The line cells by side and by market (descriptive)', '',
    '| Cell | n 05-14 | before costs 05-14 (t) | after costs 05-14 (t) | n 15-26 | before costs 15-26 (t) | after costs 15-26 (t) | winners | cost R |', '|---|---:|---:|---:|---:|---:|---:|---:|---:|');
  for (const c of o.bySide) L.push(row(c));
  for (const m of o.byMarket) for (const c of m.cells.slice(0, 2)) L.push(row({ ...c, cell: `${m.market} ${c.cell}` }));
  L.push('', '## Counts and checks', '',
    `- Lines accepted: ${N(k.lines)}. Ended before a touch: ${N(k.brokenBeforeTouch)} by an H1 close through, ${N(k.expired)} by age, ${N(k.replaced)} replaced by a newer line. Touched a third time: ${N(k.touched)}.`,
    `- Of the touched: ${N(k.closedThrough)} cancelled by an M15 close through the line, ${N(k.noEngulf)} with no engulf in four candles, ${N(k.lineSignals)} signals.`,
    `- Line signals skipped for a risk under 3 round trips: ${N(k.lineRiskUnder3Cost)}; with no swing target at least 0.5R away (2R cell only): ${N(k.lineNoSwingTarget)}.`,
    `- Control signals: ${N(k.controlSignals)}. All streams: dropped for bad data ${N(k.dropped)}, fill at or past the stop ${N(k.pastStop)}, risk under 3 round trips ${N(k.riskUnder3Cost)}, unresolved at the data's end ${N(k.unresolved)}.`,
    `- Cut test: ${o.cut.length} cuts over the five markets, ${N(nCut)} signals known by the cut dates, ${badCut} missing or extra when the candles are cut there.`,
    '- Every trade has its stop on the losing side of the fill (the run throws otherwise). Stop first when a 5-minute candle holds both.', '',
    '## What it means', '');
  const l2 = o.cells[0], c2 = o.cells[2], v = o.lineVsControl;
  if (o.verdict === 'PASS') L.push('A line cell clears the pre-registered bar. One run on one set of rules: a result to confirm on other markets with its own',
    'pre-registration before anything is said of it. Nothing is adopted.');
  else L.push(`No line cell clears the bar. With the 2R target the trendline entry made ${f3(l2.conf.mean)}R a trade before costs and ${f3(l2.conf.meanNet)}R after`,
    `them in 2015-26 (${f3(l2.disc.mean)}R and ${f3(l2.disc.meanNet)}R in 2005-14); the same engulf with no line made ${f3(c2.conf.mean)}R before and ${f3(c2.conf.meanNet)}R after`,
    `(${f3(c2.disc.mean)}R and ${f3(c2.disc.meanNet)}R). The line's difference from the control is ${f3(v[0].conf.diff)}R (t ${f2(v[0].conf.t)}) at 2R and ${f3(v[1].conf.diff)}R (t ${f2(v[1].conf.t)}) at the`,
    `swing target in 2015-26, ${f3(v[0].disc.diff)}R (t ${f2(v[0].disc.t)}) and ${f3(v[1].disc.diff)}R (t ${f2(v[1].disc.t)}) in 2005-14.`,
    'Read it with the earlier trendline studies (`trendline-engulf-2020`, `tl-third-touch`, `trendline-qm`): a mechanical line through',
    'the last two swings, touched a third time, does not turn an engulf into a trade that pays its costs. It does not judge a line',
    'chosen by eye. No variant is run on these years. Nothing live changed; no rule is proposed.');
  L.push('');
  return L.join('\n');
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const [cmd, a, b] = process.argv.slice(2);
  if (cmd === 'market') { fs.mkdirSync(b, { recursive: true }); const t0 = Date.now(); const r = runMarket(a);
    fs.writeFileSync(path.join(b, a + '.json'), JSON.stringify(r)); console.log(a, JSON.stringify(r.count), JSON.stringify(r.meta), JSON.stringify(r.cut), ((Date.now() - t0) / 1000).toFixed(0) + 's'); }
  else if (cmd === 'report') { const o = report(a); console.log(o.verdict, o.headline); }
  else console.log('usage: run.mjs market <m> <dir> | report <dir>');
}
