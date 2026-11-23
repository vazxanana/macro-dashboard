// research/edge/eg-zone-quality-wide/run.mjs - which engulf zones hold? (PREREGISTRATION.md, 23 Nov 2026)
// D1 and H4 engulf zones (3-candle span) on ten markets, entered on a close inside the zone on its first (or second) return,
// with the zone and faded; six zone qualities as splits; a random band of the same height as the control.
// Discovery 2005-14, confirmation 2015 to Oct 2026, judged before costs. Research only: nothing live imports it, nothing is placed.
//   EDGE_DATA=<cache> node research/edge/eg-zone-quality-wide/run.mjs market <m> <outDir>
//   EDGE_DATA=<cache> node research/edge/eg-zone-quality-wide/run.mjs cut <m> <outDir>
//   node research/edge/eg-zone-quality-wide/run.mjs report <outDir>
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import * as K from '../_lib/edgekit.mjs';
import { frames, egZones, buildZones } from '../combo-grid-3/run.mjs';
import { COSTS, exclusions } from '../combo-grid-2/run.mjs';
import { atr14, startIdx } from '../dom-trade-through/run.mjs';
import { exits, dailyCalls, mstat, p1, welch, monthOf } from '../grid7-wide-core/run.mjs';
import { engulfAt } from '../../../council/eg-methods.mjs';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const y = (Y, M = 0) => Date.UTC(Y, M, 1) / 1000;
export const MARKETS = ['xau', 'xag', 'eurusd', 'gbpusd', 'usdjpy', 'audusd', 'nzdusd', 'usdcad', 'usdchf', 'eurjpy'];
export const ASSUMED = ['xag', 'nzdusd', 'usdcad', 'usdchf', 'eurjpy'];
export const SETS = ['with', 'fade'], LVLS = ['1d', '4h'], EXITS = ['1R', '2R'];
export const TBELOW = { '1d': '1h', '4h': '15m' }, CAP = { '1d': 2 * 86400, '4h': 86400 };
export const WIN = 24, ATRK = 0.1, LIFE = 120, MOVE = 2;
export const FROM = y(2005), SPLIT = y(2015), TO = y(2026, 10);
export const NM = 262, DM = 120, NS = 8, NL = 14, NCELL = NS * NL;
// cell levels: 0 all (visit 1); Q1 span 1 / 2-3; Q2 height <0.5 / 0.5-1 / >1 ATR; Q3 moved 2 ATR away / not; Q4 at a level yes / no;
// Q5 first / second return; Q6 Daily MSNR call with / against
export const LEVELS = ['all', 'span 1', 'span 2-3', 'height <0.5', 'height 0.5-1', 'height >1', 'moved away', 'not moved away',
  'at a level', 'not at a level', 'first return', 'second return', 'MSNR with', 'MSNR against'];
export const QUAL = [['Q1 span', [1, 2]], ['Q2 height', [3, 4, 5]], ['Q3 move away', [6, 7]], ['Q4 at a level', [8, 9]], ['Q5 return', [10, 11]], ['Q6 MSNR call', [12, 13]]];
export const streamIndex = (set, l, x) => (set * 2 + l) * 2 + x;
export const streamName = (s) => `${SETS[s >> 2]} ${LVLS[(s >> 1) & 1]} ${EXITS[s & 1]}`;
export function levelsOf(lab) { // the cells (levels) a trade counts in
  if (lab.v === 2) return [11];
  return [0, lab.span === 1 ? 1 : 2, lab.h < 0.5 ? 3 : lab.h <= 1 ? 4 : 5, lab.mv ? 6 : 7, lab.lvl ? 8 : 9, 10, lab.call ? 12 : 13];
}

const conv = (B) => B.map((b) => ({ time: b.t, open: b.o, high: b.h, low: b.l, close: b.c }));
const frac = (a, b) => { let h = 2166136261 >>> 0; for (const c of `${a}|${b}`) { h ^= c.charCodeAt(0); h = Math.imul(h, 16777619) >>> 0; } h ^= h >>> 15; h = Math.imul(h, 2246822519) >>> 0; h ^= h >>> 13; return (h >>> 0) / 4294967296; };
function closeEndLife(L, i, d, bot, top) { // a close through the far side after candle i, or the end of its life
  for (let j = i + 1; j < L.length && j <= i + LIFE; j++) if (d > 0 ? L[j].c < bot : L[j].c > top) return L[j].e;
  return i + LIFE < L.length ? L[i + LIFE].e : Infinity;
}

// ---- zones with their static labels (Q1, Q2, Q4) and their control bands ---------------------------------------------------
export function zonesOf(L) {
  const C = conv(L), atr = atr14(L), zs = [];
  for (const z of egZones(L, 3)) { const e = engulfAt(C, z.i, 3); if (!e) continue; const a = atr[z.i]; if (!(a > 0)) continue;
    zs.push({ d: z.d, bot: z.bot, top: z.top, at: z.at, i: z.i, j: e.j, end: z.end, atr: a, span: z.i - e.j, h: (z.top - z.bot) / a }); }
  // Q4: an earlier standing engulf zone or V / A turn of the same side overlapping
  const prior = [...zs.map((z) => ({ ...z, k: 'eg' })), ...buildZones('av', L).map((z) => ({ d: z.d, bot: z.bot, top: z.top, at: z.at, end: z.end, i: z.i, k: 'av' }))]
    .sort((a, b) => a.at - b.at);
  let p = 0, act = [];
  for (const z of zs) {
    while (p < prior.length && prior[p].at <= z.at) act.push(prior[p++]);
    act = act.filter((x) => x.end > z.at);
    z.lvl = act.some((x) => x.d === z.d && !(x.k === 'eg' && x.i === z.i) && x.bot <= z.top && x.top >= z.bot);
  }
  return zs;
}
export function bandOf(L, z) { // the control: same height and side, near side at u x the zone's distance from the close
  const c = L[z.i].c, H = z.top - z.bot, u = 0.5 + frac(z.at, z.i), D = z.d > 0 ? c - z.top : z.bot - c;
  if (!(D > 0)) return null;
  const top = z.d > 0 ? c - u * D : c + u * D + H, bot = top - H;
  return { ...z, top, bot, end: closeEndLife(L, z.i, z.d, bot, top), ctl: true };
}

// ---- visits and entries of one zone (closed candles only) -------------------------------------------------------------------
// returns [{ v, q (entry T index), ts (its close), ext (touch..entry extreme against the fade), mv }]
export function entriesOf(L, T, z) {
  const out = [], d = z.d, inZ = (b) => b.l <= z.top && b.h >= z.bot, out_ = (b) => (d > 0 ? b.l > z.top : b.h < z.bot), dead = (b) => (d > 0 ? b.c < z.bot : b.c > z.top);
  let ext = d > 0 ? -Infinity : Infinity;
  for (let q = z.j + 1; q <= z.i; q++) ext = d > 0 ? Math.max(ext, L[q].h) : Math.min(ext, L[q].l);
  let k = startIdx(T, z.at);
  for (let v = 1; v <= 2; v++) {
    while (k < T.length && T[k].t < z.end && !inZ(T[k])) { ext = d > 0 ? Math.max(ext, T[k].h) : Math.min(ext, T[k].l); k++; }
    if (k >= T.length || T[k].t >= z.end) return out;
    const mv = d > 0 ? ext >= z.top + MOVE * z.atr : ext <= z.bot - MOVE * z.atr;
    let q = k, done = false, fx = d > 0 ? -Infinity : Infinity;   // the fade's extreme: highest high under a buy zone
    for (; q < T.length && T[q].t < z.end; q++) { const b = T[q];
      if (q > k && out_(b)) break;                       // the visit ended
      fx = d > 0 ? Math.max(fx, b.h) : Math.min(fx, b.l);
      if (dead(b)) return out;                           // a close through the far side: the zone is gone
      if (!done && q < k + WIN && b.c >= z.bot && b.c <= z.top) { out.push({ v, q, ts: b.e, fx, mv }); done = true; } }
    if (q >= T.length || T[q].t >= z.end) return out;
    k = q;                                               // q: the first candle wholly outside; look for the next visit
  }
  return out;
}

// every signal of one market: { ctl, l, q, ts, d, stopW, stopF, lab }
export function signals(F) {
  const out = [], calls = dailyCalls(F), D = F['1d'];
  const callAt = (t) => { const i = K.closedCount(D, t) - 1; return i >= 0 ? calls[i] : 0; };
  LVLS.forEach((lv, l) => { const L = F[lv], T = F[TBELOW[lv]];
    for (const z of zonesOf(L)) for (const zz of [z, bandOf(L, z)]) { if (!zz) continue;
      for (const e of entriesOf(L, T, zz)) {
        out.push({ ctl: !!zz.ctl, l, q: e.q, ts: e.ts, d: zz.d, at: zz.at,
          stopW: zz.d > 0 ? zz.bot - ATRK * zz.atr : zz.top + ATRK * zz.atr,
          stopF: zz.d > 0 ? e.fx + ATRK * zz.atr : e.fx - ATRK * zz.atr,
          lab: { v: e.v, span: zz.span, h: zz.h, mv: e.mv, lvl: zz.lvl, call: callAt(e.ts) === zz.d } }); } } });
  return out;
}

const inBad = (X, t) => { let lo = 0, hi = X.length; while (lo < hi) { const m = (lo + hi) >> 1; if (X[m][0] <= t) lo = m + 1; else hi = m; } return lo > 0 && t <= X[lo - 1][1]; };
function newAcc() { return { ms: new Float64Array(NCELL * NM), msNet: new Float64Array(NCELL * NM), n: new Float64Array(NCELL * 2), sum: new Float64Array(NCELL * 2),
  sq: new Float64Array(NCELL * 2), net: new Float64Array(NCELL * 2), win: new Float64Array(NCELL * 2) }; }
function add(A, c, w, m, R, cr) { A.ms[c * NM + m] += R; A.msNet[c * NM + m] += R - cr; A.n[c * 2 + w]++; A.sum[c * 2 + w] += R; A.sq[c * 2 + w] += R * R; A.net[c * 2 + w] += R - cr; if (R > 0) A.win[c * 2 + w]++; }

export function runMarket(market) {
  const M5 = K.load(market, '5m', { from: '2004-01-01', to: '2026-11-01' }); const F = frames(M5);
  const sigs = signals(F), cost = COSTS[market], X = exclusions(market);
  const real = newAcc(), ctl = newAcc(), seen = new Set(); const cnt = { dropped: 0, bad: 0, small: 0, trades: 0 };
  sigs.sort((a, b) => a.at - b.at);
  for (const g of sigs) {
    const fi = startIdx(M5, g.ts); if (fi >= M5.length) continue; const t = M5[fi].t; if (t < FROM || t >= TO) continue;
    if (X.length && inBad(X, t)) { cnt.dropped++; continue; }
    for (let set = 0; set < 2; set++) {
      const s = set ? -g.d : g.d, stop = set ? g.stopF : g.stopW;
      const key = `${g.ctl}|${set}|${g.l}|${g.q}|${s}`; if (seen.has(key)) continue; seen.add(key);
      const fill = M5[fi].o, risk = s * (fill - stop); if (!(risk > 0)) { cnt.bad++; continue; }
      if (risk < cost) { cnt.small++; continue; }
      const r = exits(M5, s, fi, stop, CAP[LVLS[g.l]]); if (!r) continue;
      if (!(s * (r.fill - stop) > 0)) throw new Error('stop on the wrong side');
      if (!g.ctl) cnt.trades++;
      const m = monthOf(t), w = t < SPLIT ? 0 : 1, cr = cost / risk, A = g.ctl ? ctl : real;
      for (let x = 0; x < 2; x++) { const st = streamIndex(set, g.l, x); for (const lv of levelsOf(g.lab)) add(A, st * NL + lv, w, m, r.R[x], cr); }
    }
  }
  const J = (A) => Object.fromEntries(Object.entries(A).map(([k, v]) => [k, Array.from(v, (z) => +z.toFixed(6))]));
  return { market, cost, assumed: ASSUMED.includes(market), first: M5.length ? M5[0].t : null, last: M5.length ? M5[M5.length - 1].t : null,
    signals: sigs.filter((g) => !g.ctl).length, ctlSignals: sigs.filter((g) => g.ctl).length, ...cnt, real: J(real), ctl: J(ctl) };
}

// ---- cut test ---------------------------------------------------------------------------------------------------------------
export function cutTest(market, cuts = ['2008-06-11', '2012-03-14', '2016-09-21', '2021-02-17', '2025-05-07']) {
  const M5 = K.load(market, '5m', { from: '2004-01-01', to: '2026-11-01' });
  const key = (g) => [g.ctl, g.l, g.ts, g.d, g.stopW.toFixed(8), g.stopF.toFixed(8), g.lab.v, g.lab.span, g.lab.h.toFixed(6), g.lab.mv, g.lab.lvl, g.lab.call].join('|');
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
      win: n ? A.win[c * 2 + w] / n : null, months: b - a, sum: A.sum[c * 2 + w], sq: A.sq[c * 2 + w] }; };
  return { d: win(0), c: win(1) };
}
const seOf = (x) => { if (x.n < 2) return Infinity; const m = x.sum / x.n; return Math.sqrt(Math.max(0, (x.sq - x.n * m * m) / (x.n - 1)) / x.n); };
export function judge(data) {
  const R = pool(data, 'real'), C = pool(data, 'ctl');
  const cells = [], splits = [];
  for (let c = 0; c < NCELL; c++) { const s = cellStats(R, c), k = cellStats(C, c);
    cells.push({ cell: c, stream: streamName(Math.floor(c / NL)), level: LEVELS[c % NL], d: s.d, c: s.c, ctl: k, vsCtl: welch(s.c, k.c),
      p: s.c.n ? p1(s.c.t, s.c.months - 1) : 1 }); }
  for (let st = 0; st < NS; st++) for (const [q, lv] of QUAL) {
    const D = lv.map((l) => cells[st * NL + l]).filter((x) => x.d.n >= 30);
    const sp = { stream: streamName(st), quality: q, best: null, worst: null, t: null, p: 1, ctlZ: null };
    if (D.length >= 2) { const so = [...D].sort((a, b) => b.d.mean - a.d.mean), B = so[0], W = so[so.length - 1];
      sp.best = B.level; sp.worst = W.level; sp.discDiff = B.d.mean - W.d.mean;
      sp.confDiff = B.c.n && W.c.n ? B.c.mean - W.c.mean : null; sp.nb = B.c.n; sp.nw = W.c.n;
      const t = welch(B.c, W.c); sp.t = t; sp.p = t == null ? 1 : p1(t, Math.min(B.c.n, W.c.n) - 1);
      const ctlDiff = B.ctl.c.n && W.ctl.c.n ? B.ctl.c.mean - W.ctl.c.mean : null; sp.ctlDiff = ctlDiff;
      if (sp.confDiff != null && ctlDiff != null) sp.ctlZ = (sp.confDiff - ctlDiff) / Math.sqrt(seOf(B.c) ** 2 + seOf(W.c) ** 2 + seOf(B.ctl.c) ** 2 + seOf(W.ctl.c) ** 2); }
    splits.push(sp); }
  const H = K.holm([...splits.map((s) => s.p), ...cells.map((c) => c.p)]);
  splits.forEach((s, i) => { s.holm = H[i]; s.pass = s.t != null && s.t >= 2 && s.holm < 0.05 && s.ctlZ != null && s.ctlZ >= 1; });
  cells.forEach((c, i) => { c.holm = H[splits.length + i];
    c.checks = { n: c.d.n >= 300 && c.c.n >= 300, disc: c.d.mean > 0 && c.d.t >= 2, conf: c.c.mean > 0 && c.c.t >= 2, holm: c.holm < 0.05, control: c.vsCtl != null && c.vsCtl >= 2 };
    c.pass = Object.values(c.checks).every(Boolean); });
  return { cells, splits };
}

const f3 = (x) => (x == null ? 'n/a' : (x >= 0 ? '+' : '-') + Math.abs(x).toFixed(3)), f2 = (x) => (x == null ? 'n/a' : x.toFixed(2)), N = (x) => Math.round(x).toLocaleString('en-US');
const slim = (w) => ({ n: w.n, mean: w.mean == null ? null : +w.mean.toFixed(6), t: +w.t.toFixed(8), meanNet: w.meanNet == null ? null : +w.meanNet.toFixed(6), tNet: +w.tNet.toFixed(2),
  win: w.win == null ? null : +w.win.toFixed(3) });
const r4 = (x) => (x == null ? null : +x.toFixed(8));

export function report(dir) {
  const data = MARKETS.map((m) => JSON.parse(fs.readFileSync(path.join(dir, m + '.json'), 'utf8')));
  const cut = MARKETS.flatMap((m) => { const f = path.join(dir, 'cut-' + m + '.json'); return fs.existsSync(f) ? JSON.parse(fs.readFileSync(f, 'utf8')) : []; });
  const { cells, splits } = judge(data);
  const passC = cells.filter((c) => c.pass), passS = splits.filter((s) => s.pass);
  const thin = cells.filter((c) => c.level === 'all').every((c) => c.c.n < 300);
  const verdict = thin ? 'INCONCLUSIVE' : passC.length || passS.length ? 'PASS' : 'FAIL';
  const allC = cells.filter((c) => c.level === 'all');
  const bestCell = [...cells].sort((a, b) => Math.min(b.d.t, b.c.t) - Math.min(a.d.t, a.c.t))[0];
  const bestSplit = [...splits].filter((s) => s.t != null).sort((a, b) => b.t - a.t)[0];
  const nm = (c) => `${c.stream} ${c.level}`;
  const headline = verdict === 'PASS'
    ? `${passS.length} of 48 quality splits and ${passC.length} of 112 cells pass before costs; ${passC.length ? `best cell ${nm(passC[0])}: ${f3(passC[0].c.mean)}R a trade in 2015-26 (n ${N(passC[0].c.n)}, month t ${f2(passC[0].c.t)}), ${f3(passC[0].c.meanNet)}R after costs` : `best split ${passS[0].stream} ${passS[0].quality} (${passS[0].best} over ${passS[0].worst}, Welch t ${f2(passS[0].t)})`}`
    : `0 of 48 quality splits and 0 of 112 cells pass; the best cell on both windows, ${nm(bestCell)}, made ${f3(bestCell.c.mean)}R a trade before costs in 2015-26 (n ${N(bestCell.c.n)}, month t ${f2(bestCell.c.t)}; discovery ${f3(bestCell.d.mean)}R, t ${f2(bestCell.d.t)})`;
  const perMarket = {}; for (const c of passC) perMarket[nm(c)] = data.map((d) => { const s = cellStats(pool([d], 'real'), c.cell); return { market: d.market, d: slim(s.d), c: slim(s.c) }; });
  const out = { study: 'eg-zone-quality-wide', built: '2026-11-23', verdict, headline,
    basis: 'judged before costs on calendar-month sums (pre-registered); after costs beside',
    windows: { discovery: '2005-01-01 to 2014-12-31 (120 months)', confirmation: '2015-01-01 to 2026-10-31 (142 months)' }, markets: MARKETS,
    assumedCosts: ASSUMED, costs: Object.fromEntries(data.map((d) => [d.market, d.cost])),
    meta: data.map((d) => ({ market: d.market, first: new Date(d.first * 1000).toISOString().slice(0, 10), last: new Date(d.last * 1000).toISOString().slice(0, 10),
      signals: d.signals, ctlSignals: d.ctlSignals, trades: d.trades, dropped: d.dropped, bad: d.bad, small: d.small })),
    tests: { splits: 48, cells: 112, holmOver: 160 }, passedSplits: passS.map((s) => `${s.stream} ${s.quality}`), passedCells: passC.map(nm),
    bestCellBothWindows: nm(bestCell), bestSplit: bestSplit ? `${bestSplit.stream} ${bestSplit.quality}` : null,
    allCells: Object.fromEntries(allC.map((c) => [c.stream, { disc: slim(c.d), conf: slim(c.c) }])), cut,
    splits: splits.map((s) => ({ stream: s.stream, quality: s.quality, best: s.best, worst: s.worst, discDiff: r4(s.discDiff), confDiff: r4(s.confDiff), nBest: s.nb, nWorst: s.nw,
      welchT: r4(s.t), holm: +s.holm.toFixed(4), ctlDiff: r4(s.ctlDiff), ctlZ: r4(s.ctlZ), pass: s.pass })),
    cells: cells.map((c) => ({ stream: c.stream, level: c.level, disc: slim(c.d), conf: slim(c.c), control: { disc: slim(c.ctl.d), conf: slim(c.ctl.c) },
      vsControl: r4(c.vsCtl), holm: +c.holm.toFixed(4), checks: c.checks, pass: c.pass })), perMarket };
  fs.writeFileSync(path.join(HERE, 'result.json'), JSON.stringify(out, null, 1) + '\n');
  fs.writeFileSync(path.join(HERE, 'RESULT.md'), resultMd(out, cells, splits));
  return out;
}

function resultMd(o, cells, splits) {
  const nCut = o.cut.reduce((a, x) => a + x.n, 0), bad = o.cut.reduce((a, x) => a + x.missing + x.extra, 0);
  const L = [];
  L.push('# Which engulf zones hold? Zone qualities on ten markets (result)', '', `**Verdict: ${o.verdict}. ${o.headline}.**`, '',
    'Run 23 Nov 2026 as pre-registered (`PREREGISTRATION.md`, committed and pushed alone first). Research only: nothing live',
    'changed, nothing is proposed. One run, no variants.', '',
    '## What was run', '',
    'D1 and H4 engulf zones (the base candle of a close beyond it within 3 candles, wick to wick), ten markets (xau, xag, eurusd,',
    'gbpusd, usdjpy, audusd, nzdusd, usdcad, usdchf, eurjpy), OANDA mid 5-minute candles. Entry: market at the next 5-minute open',
    'after the first H1 (D1 zone) or M15 (H4 zone) close inside the zone on its first or second return; set "with" (the zone\'s side,',
    'stop past the far side + 0.1 ATR) and set "fade" (the other way, stop past the touch-to-entry extreme + 0.1 ATR); 1R and 2R',
    'targets, a 2-day / 1-day time limit. Six qualities as splits (14 cells a stream, 8 streams). Control: a band of the same height',
    'at a matched random distance (0.5-1.5x the zone\'s), the same entries. Discovery 2005-2014, confirmation 2015 to October 2026.',
    `Costs after the fact only: demo figures for gold and the four majors; **ASSUMED, not measured** for ${o.assumedCosts.join(', ')}.`, '',
    '## The "all" cell of each stream (visit-1 trades)', '',
    '| Stream | n 05-14 | R (t) | net | n 15-26 | R (t) | net (t) | control R 15-26 (t) |', '|---|---:|---:|---:|---:|---:|---:|---:|');
  for (const c of cells.filter((x) => x.level === 'all')) L.push(`| ${c.stream} | ${N(c.d.n)} | ${f3(c.d.mean)} (${f2(c.d.t)}) | ${f3(c.d.meanNet)} | ${N(c.c.n)} | ${f3(c.c.mean)} (${f2(c.c.t)}) | ${f3(c.c.meanNet)} (${f2(c.c.tNet)}) | ${f3(c.ctl.c.mean)} (${f2(c.ctl.c.t)}) |`);
  L.push('', '## (A) Quality splits: best level in discovery against worst, tested in confirmation (48 tests)', '',
    'R a trade before costs. Welch t on confirmation trades, one-sided; Holm over all 160 tests; "ctl z" = the real difference',
    'against the same difference in the control bands (needs >= 1).', '',
    '| Stream | Quality | best / worst (discovery) | diff 05-14 | diff 15-26 | n best / worst | Welch t | Holm | control diff | ctl z | Pass |',
    '|---|---|---|---:|---:|---:|---:|---:|---:|---:|---|');
  for (const s of splits) L.push(`| ${s.stream} | ${s.quality} | ${s.best ?? 'n/a'} / ${s.worst ?? 'n/a'} | ${f3(s.discDiff)} | ${f3(s.confDiff)} | ${s.nb == null ? 'n/a' : N(s.nb) + ' / ' + N(s.nw)} | ${f2(s.t)} | ${s.holm.toFixed(3)} | ${f3(s.ctlDiff)} | ${f2(s.ctlZ)} | ${s.pass ? 'yes' : 'no'} |`);
  L.push('', '## (B) Every cell (112 tests)', '',
    'n >= 300 both windows, mean > 0 and month t >= 2 both windows, Holm < 0.05, beats its control (Welch t >= 2 in confirmation).', '',
    '| Stream | Level | n 05-14 | R 05-14 (t) | net 05-14 | n 15-26 | R 15-26 (t) | net 15-26 | control 15-26 | vs ctl | Holm | Pass |',
    '|---|---|---:|---:|---:|---:|---:|---:|---:|---:|---:|---|');
  for (const c of cells) L.push(`| ${c.stream} | ${c.level} | ${N(c.d.n)} | ${f3(c.d.mean)} (${f2(c.d.t)}) | ${f3(c.d.meanNet)} | ${N(c.c.n)} | ${f3(c.c.mean)} (${f2(c.c.t)}) | ${f3(c.c.meanNet)} | ${f3(c.ctl.c.mean)} (${f2(c.ctl.c.t)}) | ${f2(c.vsCtl)} | ${c.holm.toFixed(3)} | ${c.pass ? 'yes' : 'no'} |`);
  L.push('');
  if (Object.keys(o.perMarket).length) { L.push('## Per market, passing cells', ''); for (const [k, list] of Object.entries(o.perMarket)) { L.push(`### ${k}`, '', '| Market | n 05-14 | R (t) | n 15-26 | R (t) | net 15-26 |', '|---|---:|---:|---:|---:|---:|');
    for (const x of list) L.push(`| ${x.market} | ${N(x.d.n)} | ${f3(x.d.mean)} (${f2(x.d.t)}) | ${N(x.c.n)} | ${f3(x.c.mean)} (${f2(x.c.t)}) | ${f3(x.c.meanNet)} |`); L.push(''); } }
  L.push('## Checks', '',
    `- Cut test: ${o.cut.length} cuts on ${[...new Set(o.cut.map((x) => x.market))].join(', ')}: ${N(nCut)} signals (zones and control bands, with their labels) known by the cut dates, ${bad} missing or extra when the candles are cut there.`,
    '- Every trade has its stop on the losing side of the fill (the run throws otherwise); a fill at or past the stop and a risk under the round-trip cost are no trades.',
    '- Exclusions: the data-quality audit\'s bad intervals (`combo-grid-2` `exclusions`).', '',
    '| Market | candles from | zone signals | control signals | trades (both sets) | dropped (bad data) | past the stop | risk under cost |', '|---|---|---:|---:|---:|---:|---:|---:|');
  for (const m of o.meta) L.push(`| ${m.market} | ${m.first} | ${N(m.signals)} | ${N(m.ctlSignals)} | ${N(m.trades)} | ${m.dropped} | ${m.bad} | ${N(m.small)} |`);
  L.push('', '## What it means', '');
  if (o.verdict === 'PASS') L.push('A passing split or cell is a candidate for its own holdout or forward record and an owner decision, nothing more: not',
    'adopted, never called an edge before that. Read the after-cost column beside it: a pass is judged before costs.');
  else L.push('No zone quality picked better trades on the confirmation years after being chosen on the discovery years, and no cell',
    'cleared the bar. Do not re-test variants of these splits on these years. Nothing live changed; no rule is proposed.');
  const w = cells.find((c) => c.stream === 'with 4h 1R' && c.level === 'all'), fd = cells.find((c) => c.stream === 'fade 4h 1R' && c.level === 'all');
  if (w && fd) L.push('', `**The zone is not what it measures.** Buying (selling) an H4 engulf zone on an M15 close inside it on its first return made`,
    `${f3(w.c.mean)}R a trade before costs in 2015-26 (n ${N(w.c.n)}, month t ${f2(w.c.t)}; discovery ${f3(w.d.mean)}R, t ${f2(w.d.t)}), but a random band of the`,
    `same height at a matched distance, entered the same way, made ${f3(w.ctl.c.mean)}R (t ${f2(w.ctl.c.t)}; Welch t of the difference ${f2(w.vsCtl)}). The small`,
    'tilt is the short pull-back into any level below (above) the price, not the engulf. After costs it loses',
    `(${f3(w.c.meanNet)}R, t ${f2(w.c.tNet)}). The fade of the same moment loses before costs (${f3(fd.c.mean)}R, t ${f2(fd.c.t)}): the fade that`,
    '`grid7-wide-fade` found works after lower-timeframe breaks, not on a close back inside a higher-timeframe zone.');
  L.push('');
  return L.join('\n');
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const [cmd, a, b] = process.argv.slice(2);
  if (cmd === 'market') { fs.mkdirSync(b, { recursive: true }); const t0 = Date.now(); const r = runMarket(a);
    fs.writeFileSync(path.join(b, a + '.json'), JSON.stringify(r)); console.log(a, 'signals', r.signals, 'trades', r.trades, ((Date.now() - t0) / 1000).toFixed(0) + 's'); }
  else if (cmd === 'cut') { fs.mkdirSync(b, { recursive: true }); const r = cutTest(a); fs.writeFileSync(path.join(b, 'cut-' + a + '.json'), JSON.stringify(r)); console.log(JSON.stringify(r)); }
  else if (cmd === 'report') { const o = report(a); console.log(o.verdict, o.headline); }
  else console.log('usage: run.mjs market <m> <dir> | cut <m> <dir> | report <dir>');
}
