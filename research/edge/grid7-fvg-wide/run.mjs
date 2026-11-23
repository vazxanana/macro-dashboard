// research/edge/grid7-fvg-wide/run.mjs - the wide fair-value-gap grid of PREREGISTRATION.md (23 Nov 2026): 54 cells (3 gap
// timeframes x 3 entries x 3 subsets x 2 exits), each against random bands of the same height, ten markets, discovery
// 2005-14, confirmation 2015 to Oct 2026, judged before costs on month sums. Research only: nothing live imports it.
//   EDGE_DATA=<cache> node research/edge/grid7-fvg-wide/run.mjs market <m> <outDir>   one market's accumulators
//   EDGE_DATA=<cache> node research/edge/grid7-fvg-wide/run.mjs cut <m> <outDir>      the cut test of one market
//   node research/edge/grid7-fvg-wide/run.mjs report <outDir>                         result.json + RESULT.md
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import * as K from '../_lib/edgekit.mjs';
import { gapZones } from '../grid6-smc-market/run.mjs';
import { COSTS, exclusions } from '../combo-grid-2/run.mjs';
import { atr14, startIdx, manage } from '../dom-trade-through/run.mjs';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const y = (Y, M = 0) => Date.UTC(Y, M, 1) / 1000;
export const MARKETS = ['xau', 'xag', 'eurusd', 'gbpusd', 'usdjpy', 'audusd', 'nzdusd', 'usdcad', 'usdchf', 'eurjpy'];
export const ASSUMED = ['xag', 'nzdusd', 'usdcad', 'usdchf', 'eurjpy'];
export const GTF = ['15m', '1h', '4h'], SEC = { '15m': 900, '1h': 3600, '4h': 14400 }, CAP = { '15m': 86400, '1h': 2 * 86400, '4h': 5 * 86400 };
export const ENTRIES = ['mkt', 'lim50', 'ifvg'], SUBS = ['all', 'large', 'brk', 'small', 'nobrk'], EXITS = ['1R', '2R'];
export const NCELL_SUBS = 3;                         // subsets 0..2 are cells; 3, 4 are descriptive complements
export const LIFE = 120, ATRK = 0.1, KSW = 2, KMIN = 24, KMAX = 240;
export const FROM = y(2005), SPLIT = y(2015), TO = y(2026, 10);
export const NM = 262, DM = 120;
export const NSLOT = GTF.length * ENTRIES.length * SUBS.length * EXITS.length; // 90
export const slotIndex = (g, e, s, x) => ((g * ENTRIES.length + e) * SUBS.length + s) * EXITS.length + x;
export function slotName(i) { const x = i % 2; i = (i - x) / 2; const s = i % 5; i = (i - s) / 5; const e = i % 3; const g = (i - e) / 3;
  return { tf: GTF[g], entry: ENTRIES[e], sub: SUBS[s], exit: EXITS[x], g, e, s, x }; }
export const CELLS = Array.from({ length: NSLOT }, (_, i) => i).filter((i) => slotName(i).s < NCELL_SUBS); // 54
export const monthOf = (t) => { const d = new Date(t * 1000); return (d.getUTCFullYear() - 2005) * 12 + d.getUTCMonth(); };

// seeded stream (mulberry32)
export function rng(seed) { let a = seed >>> 0; return () => { a = (a + 0x6d2b79f5) >>> 0; let t = a; t = Math.imul(t ^ (t >>> 15), t | 1);
  t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; }
const seedOf = (market, tf) => { let h = 2166136261; for (const ch of market + '|' + tf) { h ^= ch.charCodeAt(0); h = Math.imul(h, 16777619); } return h >>> 0; };

export const frames = (M5) => ({ M15: K.resample(M5, 900), '15m': K.resample(M5, 900), '1h': K.resample(M5, 3600), '4h': K.resample(M5, 14400) });

// the gaps of one timeframe with their labels, and one control band each. ratio = height / ATR(14) at formation.
export function bandsOf(G, market, tf) {
  const atr = atr14(G), ev = K.structure(G, KSW).events, brkAt = new Map(); for (const e of ev) brkAt.set(e.i, e.dir);
  const rnd = rng(seedOf(market, tf)), out = [];
  for (const z of gapZones(G)) { const i = z.i, a = atr[i]; if (!(a > 0)) continue;
    const h = z.top - z.bot, brk = brkAt.get(i) === z.d || brkAt.get(i - 1) === z.d;
    const real = { ctl: 0, rt: G[i].e, d: z.d, bot: z.bot, top: z.top, i, at: G[i].e, atr: a, ratio: h / a, brk };
    out.push(real);
    const k = KMIN + Math.floor(rnd() * (KMAX - KMIN + 1)), j = i - k;     // one draw per gap, always
    if (j < 20 || !(atr[j] > 0)) continue;
    const dist = (z.bot + z.top) / 2 - G[i].c, mid = G[j].c + dist;
    out.push({ ctl: 1, d: z.d, bot: mid - h / 2, top: mid + h / 2, i: j, at: G[j].e, atr: atr[j], ratio: h / a, brk, of: i, rt: G[i].e });
  }
  return out;
}

// events of one band (closed candles only). Returns [{ kind 0 mkt | 1 lim50 | 2 ifvg, s, et (known at), fi (fill 5m index),
// fill, stop, firstFull }]. lifeEnd: close of G candle i + LIFE.
export function eventsOf(b, G, M15, atr15, M5, cost) {
  const out = [], lifeEnd = b.i + LIFE < G.length ? G[b.i + LIFE].e : Infinity, d = b.d;
  const far = (c) => (d > 0 ? c < b.bot : c > b.top), inside = (c) => c >= b.bot && c <= b.top;
  let j = startIdx(M15, b.at), seenIn = false, farJ = -1;
  for (; j < M15.length && M15[j].e <= lifeEnd; j++) { const c = M15[j].c;
    if (far(c)) { farJ = j; break; }
    if (!seenIn && inside(c)) { seenIn = true; const fi = startIdx(M5, M15[j].e);
      if (fi < M5.length) out.push({ kind: 0, s: d, et: M15[j].e, fi, fill: M5[fi].o, stop: (d > 0 ? b.bot : b.top) - d * ATRK * b.atr, firstFull: true }); } }
  if (farJ >= 0 && atr15[farJ] > 0) { const C = M15[farJ], fi = startIdx(M5, C.e);
    if (fi < M5.length) out.push({ kind: 2, s: -d, et: C.e, fi, fill: M5[fi].o, stop: (d > 0 ? C.h : C.l) + d * ATRK * atr15[farJ], firstFull: true }); }
  // (a2) the trade-through limit at the middle, resting from formation until the far-side close or the life's end
  const expire = farJ >= 0 ? M15[farJ].e : lifeEnd, mid = (b.bot + b.top) / 2, thr = cost / 2;
  for (let q = startIdx(M5, b.at); q < M5.length && M5[q].t < expire; q++) { const m = M5[q];
    if (d > 0 ? m.l <= mid - thr : m.h >= mid + thr) {
      out.push({ kind: 1, s: d, et: m.e, fi: q, fill: d > 0 ? Math.min(m.o, mid) : Math.max(m.o, mid), stop: (d > 0 ? b.bot : b.top) - d * ATRK * b.atr, firstFull: false }); break; } }
  return out;
}

// every band and event of a market; med = { tf: median ratio } (discovery gaps); null = compute from the bands
export function signals(M5, market, med = null) {
  const F = frames(M5), cost = COSTS[market], atr15 = atr14(F.M15), outMed = {}, sigs = [];
  GTF.forEach((tf, g) => { const G = F[tf], bands = bandsOf(G, market, tf);
    let m = med && med[tf];
    if (m == null) { const r = bands.filter((b) => !b.ctl && b.at >= FROM && b.at < SPLIT).map((b) => b.ratio).sort((p, q) => p - q); m = r.length ? r[r.length >> 1] : 0; }
    outMed[tf] = m;
    for (const b of bands) for (const e of eventsOf(b, G, F.M15, atr15, M5, cost)) sigs.push({ g, ctl: b.ctl, large: b.ratio > m, brk: b.brk, bt: b.at, rt: b.rt, ft: M5[e.fi].t, ...e }); });
  return { sigs, med: outMed };
}

function newAcc() { return { ms: new Float64Array(NSLOT * NM), msNet: new Float64Array(NSLOT * NM), n: new Float64Array(NSLOT * 2), sum: new Float64Array(NSLOT * 2),
  sq: new Float64Array(NSLOT * 2), net: new Float64Array(NSLOT * 2), win: new Float64Array(NSLOT * 2) }; }
function add(A, c, w, m, R, cr) { A.ms[c * NM + m] += R; A.msNet[c * NM + m] += R - cr; A.n[c * 2 + w]++; A.sum[c * 2 + w] += R; A.sq[c * 2 + w] += R * R; A.net[c * 2 + w] += R - cr; if (R > 0) A.win[c * 2 + w]++; }
const inBad = (X, t) => { let lo = 0, hi = X.length; while (lo < hi) { const m = (lo + hi) >> 1; if (X[m][0] <= t) lo = m + 1; else hi = m; } return lo > 0 && t <= X[lo - 1][1]; };
export const subsOf = (sg) => [0, sg.large ? 1 : 3, sg.brk ? 2 : 4];

export function runMarket(market) {
  const M5 = K.load(market, '5m', { from: '2004-01-01', to: '2026-11-01' });
  const { sigs, med } = signals(M5, market), cost = COSTS[market], X = exclusions(market);
  const real = newAcc(), ctl = newAcc(), flip = newAcc(); let dropped = 0, bad = 0, small = 0, sims = 0, nReal = 0, nCtl = 0;
  for (const sg of sigs) { const t = M5[sg.fi].t; if (t < FROM || t >= TO) continue;
    if (X.length && inBad(X, t)) { dropped++; continue; }
    const risk = sg.s * (sg.fill - sg.stop); if (!(risk > 0)) { bad++; continue; }
    if (risk < cost) { small++; continue; }
    const cap = CAP[GTF[sg.g]], r = manage(M5, sg.s, sg.fi, sg.fill, sg.stop, cap, sg.firstFull); sims++;
    if (!r) continue;
    if (!(sg.s * (sg.fill - sg.stop) > 0)) throw new Error('stop on the wrong side');
    const m = monthOf(t), w = t < SPLIT ? 0 : 1, cr = cost / risk;
    if (sg.ctl) { nCtl++; for (const s of subsOf(sg)) for (let x = 0; x < 2; x++) add(ctl, slotIndex(sg.g, sg.kind, s, x), w, m, r.R[x], cr); continue; }
    nReal++;
    const p = manage(M5, -sg.s, sg.fi, sg.fill, sg.fill + sg.s * risk, cap, sg.firstFull);
    for (const s of subsOf(sg)) for (let x = 0; x < 2; x++) { const ci = slotIndex(sg.g, sg.kind, s, x); add(real, ci, w, m, r.R[x], cr); if (p) add(flip, ci, w, m, p.R[x], cr); }
  }
  const J = (A) => Object.fromEntries(Object.entries(A).map(([k, v]) => [k, Array.from(v, (z) => +z.toFixed(6))]));
  return { market, cost, assumed: ASSUMED.includes(market), first: M5.length ? M5[0].t : null, last: M5.length ? M5[M5.length - 1].t : null, med,
    signals: sigs.length, sims, nReal, nCtl, dropped, bad, small, real: J(real), ctl: J(ctl), flip: J(flip) };
}

// ---- cut test (a control band counts once its real gap is known): the events known (and filled) by a date, computed on candles cut there, equal the full run's ----------------------------
export function cutTest(market, cuts = ['2008-06-11', '2012-03-14', '2016-09-21', '2021-02-17', '2025-05-07']) {
  const M5 = K.load(market, '5m', { from: '2004-01-01', to: '2026-11-01' });
  const key = (g) => [g.g, g.ctl, g.bt, g.kind, g.s, g.et, g.fill, g.stop.toFixed(8), g.large, g.brk].join('|');
  const full = signals(M5, market); const out = [];
  for (const c of cuts) { const T = Date.parse(c + 'T00:00:00Z') / 1000; const C5 = M5.filter((b) => b.e <= T);
    const cut = signals(C5, market, full.med).sigs.filter((g) => g.et <= T && g.ft < T && g.rt <= T).map(key);
    const want = full.sigs.filter((g) => g.et <= T && g.ft < T && g.rt <= T).map(key); const A = new Set(cut), B = new Set(want);
    out.push({ market, cut: c, n: B.size, missing: [...B].filter((k) => !A.has(k)).length, extra: [...A].filter((k) => !B.has(k)).length }); }
  return out;
}

// ---- pooled statistics ----------------------------------------------------------------------------------------------------
export function mstat(ms, a, b) { const n = b - a; let s = 0, q = 0; for (let m = a; m < b; m++) { s += ms[m]; q += ms[m] * ms[m]; }
  const mean = s / n, sd = Math.sqrt(Math.max(0, (q - n * mean * mean) / (n - 1))); return { months: n, t: sd > 0 ? mean / (sd / Math.sqrt(n)) : 0 }; }
export const p1 = (t, df) => { const p = K.pFromT(t, df); return p == null ? 1 : t > 0 ? p / 2 : 1 - p / 2; };
export function welch(a, b) {
  if (a.n < 2 || b.n < 2) return null; const ma = a.sum / a.n, mb = b.sum / b.n;
  const va = (a.sq - a.n * ma * ma) / (a.n - 1), vb = (b.sq - b.n * mb * mb) / (b.n - 1); const se = Math.sqrt(va / a.n + vb / b.n);
  return se > 0 ? (ma - mb) / se : null; }
export function pool(list, kind) { const A = newAcc(); for (const d of list) { const S = d[kind]; for (const k of Object.keys(A)) for (let i = 0; i < A[k].length; i++) A[k][i] += S[k][i]; } return A; }
export function slotStats(A, c) {
  const ms = A.ms.subarray(c * NM, (c + 1) * NM), msn = A.msNet.subarray(c * NM, (c + 1) * NM);
  const win = (w) => { const n = A.n[c * 2 + w], a = w ? DM : 0, b = w ? NM : DM;
    return { n, mean: n ? A.sum[c * 2 + w] / n : null, t: mstat(ms, a, b).t, meanNet: n ? A.net[c * 2 + w] / n : null, tNet: mstat(msn, a, b).t,
      win: n ? A.win[c * 2 + w] / n : null, months: b - a, sum: A.sum[c * 2 + w], sq: A.sq[c * 2 + w] }; };
  return { d: win(0), c: win(1) };
}
export const bar13 = (x) => x.d.n >= 300 && x.c.n >= 300 && x.d.mean > 0 && x.c.mean > 0 && x.d.t >= 2 && x.c.t >= 2;
export function judge(data) {
  const R = pool(data, 'real'), C = pool(data, 'ctl'), P = pool(data, 'flip');
  const rows = [];
  for (let c = 0; c < NSLOT; c++) { const s = slotStats(R, c), cs = slotStats(C, c), ps = slotStats(P, c);
    rows.push({ slot: c, ...slotName(c), cell: slotName(c).s < NCELL_SUBS, d: s.d, c: s.c, p: p1(s.c.t, s.c.months - 1),
      ctl: cs, vs: { d: welch(s.d, cs.d), c: welch(s.c, cs.c) }, flip: { d: ps.d, c: ps.c, p: p1(ps.c.t, ps.c.months - 1) } }); }
  const cells = rows.filter((r) => r.cell), H = K.holm(cells.map((r) => r.p)), HF = K.holm(cells.map((r) => r.flip.p));
  cells.forEach((r, i) => { r.holm = H[i]; r.flip.holm = HF[i];
    r.checks = { n: r.d.n >= 300 && r.c.n >= 300, disc: r.d.mean > 0 && r.d.t >= 2, conf: r.c.mean > 0 && r.c.t >= 2, holm: H[i] < 0.05,
      control: r.vs.d != null && r.vs.c != null && r.vs.d >= 2 && r.vs.c >= 2 };
    r.pass = Object.values(r.checks).every(Boolean); r.flip.pass = bar13(r.flip) && HF[i] < 0.05; });
  return rows;
}

const f3 = (x) => (x == null ? 'n/a' : (x >= 0 ? '+' : '-') + Math.abs(x).toFixed(3)), f2 = (x) => (x == null ? 'n/a' : x.toFixed(2)), N = (x) => Math.round(x).toLocaleString('en-US');
export const cname = (r) => `${r.tf} ${r.entry} ${r.sub} ${r.exit}`;
const slim = (w) => ({ n: w.n, mean: w.mean == null ? null : +w.mean.toFixed(6), t: +w.t.toFixed(6), meanNet: w.meanNet == null ? null : +w.meanNet.toFixed(6), tNet: +w.tNet.toFixed(2),
  win: w.win == null ? null : +w.win.toFixed(3) });

export function report(dir) {
  const data = MARKETS.map((m) => JSON.parse(fs.readFileSync(path.join(dir, m + '.json'), 'utf8')));
  const cut = MARKETS.flatMap((m) => { const f = path.join(dir, 'cut-' + m + '.json'); return fs.existsSync(f) ? JSON.parse(fs.readFileSync(f, 'utf8')) : []; });
  const rows = judge(data), cells = rows.filter((r) => r.cell), pass = cells.filter((r) => r.pass), flipPass = cells.filter((r) => r.flip.pass);
  const verdict = pass.length ? 'PASS' : 'FAIL';
  const bestC = [...cells].sort((a, b) => b.c.t - a.c.t)[0], bestBoth = [...cells].sort((a, b) => Math.min(b.d.t, b.c.t) - Math.min(a.d.t, a.c.t))[0];
  const perMarket = {}; for (const r of pass) perMarket[cname(r)] = data.map((d) => { const s = slotStats(pool([d], 'real'), r.slot); return { market: d.market, d: slim(s.d), c: slim(s.c) }; });
  const headline = verdict === 'PASS'
    ? `${pass.length} of 54 cells pass the pre-registered bar; best ${cname(pass[0])}, ${f3(pass[0].c.mean)}R a trade before costs in 2015-26 (n ${N(pass[0].c.n)}, month t ${f2(pass[0].c.t)}; vs random bands Welch t ${f2(pass[0].vs.c)}), ${f3(pass[0].c.meanNet)}R after costs`
    : `0 of 54 cells pass; the best confirmation cell, ${cname(bestC)}, made ${f3(bestC.c.mean)}R a trade before costs in 2015-26 (n ${N(bestC.c.n)}, month t ${f2(bestC.c.t)}; vs random bands Welch t ${f2(bestC.vs.c)}), ${f3(bestC.c.meanNet)}R after costs`;
  const RW = (r) => ({ cell: cname(r), tf: r.tf, entry: r.entry, sub: r.sub, exit: r.exit, disc: slim(r.d), conf: slim(r.c),
    control: { disc: slim(r.ctl.d), conf: slim(r.ctl.c) }, vsControl: { d: r.vs.d == null ? null : +r.vs.d.toFixed(2), c: r.vs.c == null ? null : +r.vs.c.toFixed(2) },
    flipped: { disc: slim(r.flip.d), conf: slim(r.flip.c), ...(r.cell ? { holm: +r.flip.holm.toFixed(4), pass: r.flip.pass } : {}) },
    ...(r.cell ? { holm: +r.holm.toFixed(4), checks: r.checks, pass: r.pass } : {}) });
  const out = { study: 'grid7-fvg-wide', built: '2026-11-23', verdict, headline, basis: 'judged before costs on calendar-month sums (pre-registered); after costs beside',
    windows: { discovery: '2005-01-01 to 2014-12-31 (120 months)', confirmation: '2015-01-01 to 2026-10-31 (142 months)' }, markets: MARKETS,
    assumedCosts: ASSUMED, costs: Object.fromEntries(data.map((d) => [d.market, d.cost])),
    meta: data.map((d) => ({ market: d.market, first: new Date(d.first * 1000).toISOString().slice(0, 10), last: new Date(d.last * 1000).toISOString().slice(0, 10),
      medians: Object.fromEntries(Object.entries(d.med).map(([k, v]) => [k, +v.toFixed(4)])), signals: d.signals, sims: d.sims, real: d.nReal, control: d.nCtl,
      dropped: d.dropped, bad: d.bad, small: d.small })),
    passed: pass.map(cname), flippedPassed: flipPass.map(cname), bestConfirmation: cname(bestC), bestBothWindows: cname(bestBoth),
    cut, cells: cells.map(RW), complements: rows.filter((r) => !r.cell).map(RW), perMarket };
  fs.writeFileSync(path.join(HERE, 'result.json'), JSON.stringify(out, null, 1) + '\n');
  fs.writeFileSync(path.join(HERE, 'RESULT.md'), resultMd(out, rows, bestC, bestBoth));
  return out;
}

function resultMd(o, rows, bestC, bestBoth) {
  const cells = rows.filter((r) => r.cell), comp = rows.filter((r) => !r.cell), cnt = (f) => cells.filter(f).length;
  const nCut = o.cut.reduce((a, x) => a + x.n, 0), badCut = o.cut.reduce((a, x) => a + x.missing + x.extra, 0);
  const L = ['# Wide fair-value-gap grid: 54 cells on ten markets (result)', '', `**Verdict: ${o.verdict}. ${o.headline}.**`, '',
    'Run 23 Nov 2026 as pre-registered (`PREREGISTRATION.md`, committed and pushed alone first). Research only: nothing live',
    'changed, nothing is proposed. One run, no variants.', '',
    '## What was run', '',
    'Three-candle fair-value gaps on M15, H1 and H4 (`grid6-smc-market` `gapZones`). Three entries: **mkt** = market with the gap',
    'at the next 5-minute open after the first M15 close inside the gap; **lim50** = a limit at the gap\'s middle filled only when',
    'traded through by half the round trip; **ifvg** = market AGAINST the gap after the first M15 close through its far side (an',
    'inverse gap). Stops past the gap\'s far side (mkt, lim50) or past the closing M15 candle\'s extreme (ifvg), + 0.1 ATR. Exits',
    '1R and 2R; time limits 1 day (M15 gaps), 2 days (H1), 5 days (H4). Subsets: every gap, large gaps (height / ATR over the',
    'market\'s discovery median), gaps formed with a structure break. Each cell against its control: random bands of the same',
    'height, side and distance from price, formed 24-240 candles earlier, through the same events. Ten markets pooled, OANDA mid',
    '5-minute candles; discovery = fills 2005-2014, confirmation = 2015 to October 2026; judged before costs on month sums.',
    `Costs beside: the demo figures for gold and the four majors; **ASSUMED, not measured** for ${o.assumedCosts.join(', ')}.`, '',
    '## The bar, cell by cell', '',
    `- n >= 300 in both windows: ${cnt((r) => r.checks.n)} of 54.`,
    `- Mean R > 0 and month t >= 2 in discovery: ${cnt((r) => r.checks.disc)}; in confirmation: ${cnt((r) => r.checks.conf)}; both: ${cnt((r) => r.checks.disc && r.checks.conf)}.`,
    `- Holm-adjusted p < 0.05 over the 54 confirmation tests: ${cnt((r) => r.checks.holm)}.`,
    `- Beats its random-band control (Welch t >= 2 in both windows): ${cnt((r) => r.checks.control)}.`,
    `- **All four: ${o.passed.length}${o.passed.length ? ' (' + o.passed.join('; ') + ')' : ''}.**`,
    `- Side-flipped check passing bars 1-3 with Holm: ${o.flippedPassed.length}${o.flippedPassed.length ? ' (' + o.flippedPassed.join('; ') + ')' : ''}.`, '',
    `Best confirmation cell: ${o.bestConfirmation}. Best on the weaker of the two windows: ${o.bestBothWindows} (discovery`,
    `${f3(bestBoth.d.mean)}R, t ${f2(bestBoth.d.t)}; confirmation ${f3(bestBoth.c.mean)}R, t ${f2(bestBoth.c.t)}).`, '',
    '## Every cell', '',
    'R a trade before costs (month-sum t), after costs beside; "ctl" = the random bands of the same cell; "vs ctl" = Welch t of',
    'the cell against its control (discovery / confirmation); Holm on the confirmation test; "flip" = the side-flipped check.', '',
    '| Cell | n 05-14 | R 05-14 (t) | net 05-14 | n 15-26 | R 15-26 (t) | net 15-26 | ctl R 05-14 / 15-26 | vs ctl | Holm | flip R 15-26 (t) | Pass |',
    '|---|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|---|'];
  for (const r of cells) L.push(`| ${cname(r)} | ${N(r.d.n)} | ${f3(r.d.mean)} (${f2(r.d.t)}) | ${f3(r.d.meanNet)} | ${N(r.c.n)} | ${f3(r.c.mean)} (${f2(r.c.t)}) | ${f3(r.c.meanNet)} | ${f3(r.ctl.d.mean)} / ${f3(r.ctl.c.mean)} | ${f2(r.vs.d)} / ${f2(r.vs.c)} | ${r.holm.toFixed(3)} | ${f3(r.flip.c.mean)} (${f2(r.flip.c.t)}) | ${r.pass ? 'yes' : 'no'} |`);
  L.push('', '## Complements (descriptive, not tested)', '', '| Rows | n 05-14 | R 05-14 (t) | n 15-26 | R 15-26 (t) | net 15-26 | vs ctl |', '|---|---:|---:|---:|---:|---:|---:|');
  for (const r of comp) L.push(`| ${cname(r)} | ${N(r.d.n)} | ${f3(r.d.mean)} (${f2(r.d.t)}) | ${N(r.c.n)} | ${f3(r.c.mean)} (${f2(r.c.t)}) | ${f3(r.c.meanNet)} | ${f2(r.vs.d)} / ${f2(r.vs.c)} |`);
  L.push('');
  if (o.passed.length) { L.push('## Per market, passing cells', ''); for (const [c, list] of Object.entries(o.perMarket)) { L.push(`### ${c}`, '', '| Market | n 05-14 | R (t) | net | n 15-26 | R (t) | net |', '|---|---:|---:|---:|---:|---:|---:|');
    for (const x of list) L.push(`| ${x.market} | ${N(x.d.n)} | ${f3(x.d.mean)} (${f2(x.d.t)}) | ${f3(x.d.meanNet)} | ${N(x.c.n)} | ${f3(x.c.mean)} (${f2(x.c.t)}) | ${f3(x.c.meanNet)} |`); L.push(''); } }
  L.push('## Checks', '',
    `- Cut test: ${o.cut.length} cuts on ${[...new Set(o.cut.map((x) => x.market))].join(', ')}: ${N(nCut)} events known by the cut dates, ${badCut} missing or extra when the candles are cut there.`,
    '- Every trade has its stop on the losing side of the fill (the run throws otherwise); fills at or past the stop and trades whose risk is under the round-trip cost are no trades.',
    '- Exclusions: the data-quality audit\'s bad intervals (`combo-grid-2` `exclusions`).', '',
    '| Market | candles from | median gap / ATR (M15, H1, H4) | events | simulated | real | control | dropped | past the stop | risk under cost |', '|---|---|---|---:|---:|---:|---:|---:|---:|---:|');
  for (const m of o.meta) L.push(`| ${m.market} | ${m.first} | ${m.medians['15m']}, ${m.medians['1h']}, ${m.medians['4h']} | ${N(m.signals)} | ${N(m.sims)} | ${N(m.real)} | ${N(m.control)} | ${m.dropped} | ${m.bad} | ${N(m.small)} |`);
  L.push('', '## What it means', '');
  if (o.verdict === 'PASS') L.push('A passing cell is a candidate for its own holdout and forward record, nothing more: before costs only, not adopted, never called an edge',
    'before a forward record. The after-cost column is what an account would see.');
  if (o.verdict === 'PASS') { const P = cells.filter((r) => r.pass), W = (r) => `${cname(r)} ${f3(r.c.meanNet)}R`;
    const pm = Object.entries(o.perMarket).map(([c, l]) => `${c}: ${l.filter((x) => x.c.t >= 2).length} of 10 markets at month t >= 2 in 2015-26`);
    L.push('', 'Read with care:', '',
      `- Every passing cell is a market entry at the first M15 close back inside an H1 or H4 gap (${P.map(cname).join('; ')}); the`,
      '  tilt is a few hundredths of an R before costs and it beats bands of the same height, so the gap itself adds a little.',
      `- After costs every passing cell loses in 2015-26 (${P.map(W).join('; ')}). Nothing here can be traded at the demo`,
      '  figures; it is the same family as the before-cost pull-back tilts of `grid7-wide-fade` and `dom-touch-market`.',
      `- Per market (table above): ${pm.join('; ')}. Gold's H4 cells are about zero in 2015-26.`,
      '- The trade-through limit at the gap\'s middle loses heavily on every timeframe (a candle that trades half a round trip',
      '  through the middle of a small gap often reaches the stop in the same candle), and its random bands lose as much.',
      `- The inverse gap traded against the gap loses; its side-flipped check (back WITH the old gap) clears bars 1-3 in ${o.flippedPassed.length}`,
      '  cells. That is the flip of a losing rule before costs, not a tested rule, and it was not pre-registered as a cell.',
      '- Next, if the owner wants it: the four cells on data this grid never read (other markets, a second feed), as',
      '  `fade-new-markets` did for the fade rules. Do not re-test variants of these 54 cells on these years.'); }
  else L.push('No fair-value-gap cell clears the bar: on ten markets over 22 years, coming back to a gap, resting at its middle or',
    'trading the inverse gap does not beat random bands of the same height and distance in both windows. Do not re-test variants',
    'of these 54 cells on these years. Nothing live changed; no rule is proposed.');
  L.push('');
  return L.join('\n');
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const [cmd, a, b] = process.argv.slice(2);
  if (cmd === 'market') { fs.mkdirSync(b, { recursive: true }); const t0 = Date.now(); const r = runMarket(a);
    fs.writeFileSync(path.join(b, a + '.json'), JSON.stringify(r)); console.log(a, 'events', r.signals, 'sims', r.sims, ((Date.now() - t0) / 1000).toFixed(0) + 's'); }
  else if (cmd === 'cut') { fs.mkdirSync(b, { recursive: true }); const r = cutTest(a); fs.writeFileSync(path.join(b, 'cut-' + a + '.json'), JSON.stringify(r)); console.log(JSON.stringify(r)); }
  else if (cmd === 'report') { const o = report(a); console.log(o.verdict, o.headline); }
  else console.log('usage: run.mjs market <m> <dir> | cut <m> <dir> | report <dir>');
}
