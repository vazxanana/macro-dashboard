// research/edge/fade-evening/run.mjs - a tradable evening fade? (PREREGISTRATION.md, 24 Nov 2026). grid7-wide-fade's M15
// fade signals (imported, unchanged) with the rollover rule always on (no fill, no holding 21:00-22:59 UTC), a fixed 24-cell
// grid (hours x stop x entry x filter), one cell picked on 2005-14 after costs, judged once on 2015-26, HistData and five
// crosses. Research only: nothing live imports it, nothing is placed.
//   EDGE_DATA=<cache> node research/edge/fade-evening/run.mjs oanda <m> <outDir>     (the ten markets and the five crosses)
//   EDGE_DATA=<cache> node research/edge/fade-evening/run.mjs hist <m> <outDir>
//   node research/edge/fade-evening/run.mjs report <outDir>
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import * as K from '../_lib/edgekit.mjs';
import { frames } from '../combo-grid-3/run.mjs';
import { COSTS, exclusions } from '../combo-grid-2/run.mjs';
import { atr14, startIdx } from '../dom-trade-through/run.mjs';
import { MARKETS, ASSUMED, FROM, TO, NM, DM, monthOf, mstat, p1 } from '../grid7-wide-core/run.mjs';
import { signals, exits, CAP } from '../grid7-wide-fade/run.mjs';
import { histM5, B_FROM, BM0 } from '../fade-new-markets/run.mjs';
import { volLevel } from '../fade-conditions/run.mjs';

const HERE = path.dirname(fileURLToPath(import.meta.url));
export const CROSSES = ['gbpjpy', 'audjpy', 'cadjpy', 'eurgbp', 'euraud'];
export const HIST_MARKETS = ['xau', 'xag', 'eurusd', 'gbpusd', 'usdjpy', 'audusd', 'usdcad', 'usdchf'];
export const HOURS = { A: [20, 23], B: [17, 18, 19, 20, 23, 0, 1] }, HK = ['A', 'B'];
export const KS = [1, 1.5, 2], ENTRIES = ['mkt', 'lim'], FILTERS = ['all', 'calm'];
export const LIM_OFF = 0.25, LIM_LIFE = 12, TGT = 2, MIN_N = 1000;
export const NC = HK.length * KS.length * ENTRIES.length * FILTERS.length;   // 24
export const cellOf = (h, k, e, f) => ((h * KS.length + k) * ENTRIES.length + e) * FILTERS.length + f;
export function cellName(c) { const f = c % 2; let r = (c - f) / 2; const e = r % 2; r = (r - e) / 2; const k = r % 3; const h = (r - k) / 3;
  return { hours: HK[h], k: KS[k], entry: ENTRIES[e], filter: FILTERS[f], name: `${HK[h]} ${KS[k]}ATR ${ENTRIES[e]} ${FILTERS[f]}` }; }
const HOUR = (t) => new Date(t * 1000).getUTCHours();
export const inRoll = (t) => { const h = HOUR(t); return h === 21 || h === 22; };
// the 21:00 UTC line passed between two candles (a gap over the rollover, or a weekend) or the candle starts inside it
export const rollBetween = (prevE, t) => inRoll(t) || Math.floor((t - 75600) / 86400) !== Math.floor((prevE - 1 - 75600) / 86400);

// one trade from candle fj at price entry; roll = the rollover rule; onlyStop = a limit's fill candle (only the stop counts)
export function sim(M5, s, fj, entry, stop, tgt, dl, roll, onlyStop) {
  if (!(s * (entry - stop) > 0)) throw new Error('stop on the wrong side');
  const risk = s * (entry - stop), R = (px) => (s * (px - entry)) / risk;
  for (let j = fj; j < M5.length; j++) { const b = M5[j];
    if (j > fj) {
      if (roll && rollBetween(M5[j - 1].e, b.t)) return { R: R(M5[j - 1].c), e: M5[j - 1].e, how: 'flat' };
      if (s * (b.o - stop) <= 0) return { R: R(b.o), e: b.t, how: 'stop' };
      if (s * (b.o - tgt) >= 0) return { R: R(b.o), e: b.t, how: 'target' };
    }
    const low = s > 0 ? b.l : b.h, high = s > 0 ? b.h : b.l;
    if (s * (low - stop) <= 0) return { R: R(stop), e: b.e, how: 'stop' };
    if (!(onlyStop && j === fj) && s * (high - tgt) >= 0) return { R: R(tgt), e: b.e, how: 'target' };
    if (b.e >= dl) return { R: R(b.c), e: b.e, how: 'time' };
  }
  return null;
}

const inBad = (X, t) => { let lo = 0, hi = X.length; while (lo < hi) { const m = (lo + hi) >> 1; if (X[m][0] <= t) lo = m + 1; else hi = m; } return lo > 0 && t <= X[lo - 1][1]; };
const FLD = 5;   // per cell and month: n, sum R, sum net R, sum net R at 2x cost, wins

export function runSeries(M5, { market, cost = COSTS[market], X = [], from = FROM, to = TO }) {
  const F = frames(M5), T = F['15m'], atr = atr14(T), A = new Float64Array(NC * NM * FLD);
  const gate = { n: 0, sum: 0, mism: 0 }; let dropped = 0, small = 0, open = 0, nofill = 0, rollSkip = 0;
  const add = (c, m, R, cr) => { const i = (c * NM + m) * FLD; A[i]++; A[i + 1] += R; A[i + 2] += R - cr; A[i + 3] += R - 2 * cr; if (R > 0) A[i + 4]++; };
  for (const g of signals(F)) {
    if (g.cx !== 0 || g.tf !== 1) continue;
    const fi = startIdx(M5, g.ts); if (fi >= M5.length) continue; const t0 = M5[fi].t; if (t0 < from || t0 >= to) continue;
    if (X.length && inBad(X, t0)) { dropped++; continue; }
    const hr = HOUR(T[g.j].t), s = -g.d, a = g.a, cap = CAP['15m'], dl = t0 + cap, calm = volLevel(atr, g.j) === 0;
    // gate: the grid's own path (rollover rule off, 1 ATR, market), break hours 20-23; my sim must give the same R
    if (hr >= 20) { const fill = M5[fi].o, stop = fill + g.d * a, risk = s * (fill - stop);
      if (risk > 0 && risk >= cost) { const sr = g.opp == null ? NaN : (s * (g.opp - fill)) / risk; const ks = [1, 2, sr > 0 ? sr : NaN];
        const r = exits(M5, s, fi, stop, ks.map((k) => (Number.isFinite(k) ? fill + s * k * risk : NaN)), cap);
        const p = exits(M5, -s, fi, fill + s * risk, ks.map((k) => (Number.isFinite(k) ? fill - s * k * risk : NaN)), cap);
        if (r && p && t0 >= Date.UTC(2015, 0, 1) / 1000) { gate.n++; gate.sum += r.R[1];
          const x = sim(M5, s, fi, fill, stop, fill + s * 2 * risk, dl, false, false); if (!x || Math.abs(x.R - r.R[1]) > 1e-9) gate.mism++; } } }
    const hk = HK.map((k) => HOURS[k].includes(hr)); if (!hk[0] && !hk[1]) continue;
    for (let e = 0; e < 2; e++) {
      // the entry: market at fi, or a limit LIM_OFF x ATR better, valid LIM_LIFE candles; never filled in the rollover
      let fj = -1, entry = NaN;
      if (e === 0) { if (!inRoll(M5[fi].t)) { fj = fi; entry = M5[fi].o; } else rollSkip++; }
      else { const L = M5[fi].o - s * LIM_OFF * a;
        for (let j = fi; j < fi + LIM_LIFE && j < M5.length; j++) { const b = M5[j]; if (inRoll(b.t) || (j > fi && rollBetween(M5[j - 1].e, b.t))) break;
          if (s > 0 ? b.l <= L : b.h >= L) { fj = j; entry = s > 0 ? Math.min(b.o, L) : Math.max(b.o, L); break; } }
        if (fj < 0) nofill++; }
      if (fj < 0) continue; const m = monthOf(M5[fj].t);
      for (let k = 0; k < KS.length; k++) {
        const risk = KS[k] * a; if (risk < cost) { small++; continue; }
        const stop = entry - s * risk, x = sim(M5, s, fj, entry, stop, entry + s * TGT * risk, dl, true, e === 1);
        if (!x) { open++; continue; }
        for (let h = 0; h < 2; h++) { if (!hk[h]) continue;
          for (let f = 0; f < 2; f++) { if (f === 1 && !calm) continue; add(cellOf(h, k, e, f), m, x.R, cost / risk); } }
      }
    }
  }
  return { market, cost, assumed: ASSUMED.includes(market) || CROSSES.includes(market), first: M5.length ? M5[0].t : null, last: M5.length ? M5[M5.length - 1].t : null,
    candles: M5.length, dropped, small, open, nofill, rollSkip, gate, acc: Array.from(A, (z) => +z.toFixed(6)) };
}

// ---- statistics -------------------------------------------------------------------------------------------------------
export function pool(list) { const A = new Float64Array(NC * NM * FLD); for (const d of list) for (let i = 0; i < A.length; i++) A[i] += d.acc[i]; return A; }
export function cellStat(A, c, a, b) {
  let n = 0, s = 0, net = 0, net2 = 0, w = 0; const ms = new Float64Array(NM), mn = new Float64Array(NM), m2 = new Float64Array(NM);
  for (let m = a; m < b; m++) { const i = (c * NM + m) * FLD; n += A[i]; s += A[i + 1]; net += A[i + 2]; net2 += A[i + 3]; w += A[i + 4];
    ms[m] = A[i + 1]; mn[m] = A[i + 2]; m2[m] = A[i + 3]; }
  const tNet = mstat(mn, a, b).t;
  return { n, mean: n ? s / n : null, t: n ? mstat(ms, a, b).t : null, meanNet: n ? net / n : null, tNet: n ? tNet : null,
    meanNet2: n ? net2 / n : null, tNet2: n ? mstat(m2, a, b).t : null, win: n ? w / n : null, months: b - a, pNet: n ? p1(tNet, b - a - 1) : 1, mn };
}
const r6 = (x) => (x == null ? null : +x.toFixed(6)), r2 = (x) => (x == null ? null : +x.toFixed(2));
const slim = (x) => ({ n: x.n, mean: r6(x.mean), t: r2(x.t), meanNet: r6(x.meanNet), tNet: r2(x.tNet), meanNet2: r6(x.meanNet2), tNet2: r2(x.tNet2), win: x.win == null ? null : +x.win.toFixed(3) });
const read = (dir, f) => (fs.existsSync(path.join(dir, f)) ? JSON.parse(fs.readFileSync(path.join(dir, f), 'utf8')) : null);
const corr = (x, y) => { const n = x.length; if (n < 3) return null; const mx = x.reduce((a, b) => a + b, 0) / n, my = y.reduce((a, b) => a + b, 0) / n;
  let sxy = 0, sx = 0, sy = 0; for (let i = 0; i < n; i++) { sxy += (x[i] - mx) * (y[i] - my); sx += (x[i] - mx) ** 2; sy += (y[i] - my) ** 2; } return sx && sy ? sxy / Math.sqrt(sx * sy) : null; };
const tOf = (v) => { const n = v.length, m = v.reduce((a, b) => a + b, 0) / n, sd = Math.sqrt(v.reduce((a, b) => a + (b - m) ** 2, 0) / (n - 1)); return sd > 0 ? m / (sd / Math.sqrt(n)) : null; };
const ym = (m) => `${2005 + Math.floor(m / 12)}-${String((m % 12) + 1).padStart(2, '0')}`;

export function report(dir) {
  const O = MARKETS.map((m) => read(dir, `O-${m}.json`)).filter((d) => d && d.candles), H = HIST_MARKETS.map((m) => read(dir, `H-${m}.json`)).filter((d) => d && d.candles);
  const X = CROSSES.map((m) => read(dir, `O-${m}.json`)).filter((d) => d && d.candles);
  const PO = pool(O), PH = pool(H), PX = pool(X);
  const gn = O.reduce((a, d) => a + d.gate.n, 0), gs = O.reduce((a, d) => a + d.gate.sum, 0), gm = O.reduce((a, d) => a + d.gate.mism, 0);
  const gate = { want: { n: 27671, mean: 0.169408 }, got: { n: gn, mean: r6(gs / gn) }, simMismatches: gm };
  gate.ok = gn === 27671 && Math.abs(gs / gn - 0.169408) < 0.0005 && gm === 0;
  const cells = Array.from({ length: NC }, (_, c) => ({ cell: c, ...cellName(c), disc: cellStat(PO, c, 0, DM), conf: cellStat(PO, c, DM, NM), hist: cellStat(PH, c, BM0, NM), cross: cellStat(PX, c, 0, NM) }));
  const elig = cells.filter((x) => x.disc.n >= MIN_N); const sel = elig.length ? elig.reduce((a, b) => (b.disc.meanNet > a.disc.meanNet ? b : a)) : null;
  let primary = [], verdict;
  if (sel) {
    primary = [['P1', 'OANDA ten markets, 2015-01 .. 2026-10', sel.conf], ['P2', 'HistData eight markets, 2018-02 .. 2026-10', sel.hist], ['P3', 'five crosses, OANDA, 2005-01 .. 2026-10', sel.cross]]
      .map(([key, what, x]) => ({ key, what, n: x.n, mean: r6(x.mean), meanNet: r6(x.meanNet), tNet: r2(x.tNet), meanNet2: r6(x.meanNet2), p: x.pNet, cond: x.meanNet > 0 && x.tNet >= 2 }));
    const hm = K.holm(primary.map((x) => x.p)); primary.forEach((x, i) => { x.holm = +hm[i].toPrecision(4); x.p = +x.p.toPrecision(4); x.pass = x.cond && hm[i] < 0.05; });
  }
  verdict = !gate.ok || !sel || O.length < 8 || H.length < 6 || X.length < 4 ? 'INCONCLUSIVE' : primary.every((x) => x.pass) ? 'PASS' : 'FAIL';
  const ci = sel ? sel.cell : null;
  const perMarket = sel ? [...O.map((d) => ['oanda', d, 0, NM]), ...H.map((d) => ['hist', d, BM0, NM]), ...X.map((d) => ['cross', d, 0, NM])]
    .map(([feed, d, a, b]) => { const P = pool([d]); return { feed, market: d.market, assumed: d.assumed, disc: slim(cellStat(P, ci, 0, Math.min(DM, b))), conf: slim(cellStat(P, ci, Math.max(DM, a), b)) }; }) : [];
  const years = sel ? Array.from({ length: 22 }, (_, i) => { const y = 2005 + i, a = i * 12, b = Math.min(a + 12, NM); return { year: y, oanda: slim(cellStat(PO, ci, a, b)), cross: slim(cellStat(PX, ci, a, b)) }; }) : [];
  // complement: the selected cell's monthly net R (OANDA ten markets) beside the two passing volatility breakouts (daily R after their costs)
  const comp = {};
  if (sel) { const fade = cellStat(PO, ci, 0, NM).mn; const fadeX = cellStat(PX, ci, 0, NM).mn;
    const vb = (f) => { const rows = JSON.parse(fs.readFileSync(path.join(HERE, '..', f, 'baseline.json'), 'utf8')).rows; const m = new Float64Array(NM); const seen = new Set();
      for (const [d, R] of rows) { const k = monthOf(Date.parse(d + 'T00:00:00Z') / 1000); if (k >= 0 && k < NM) { m[k] += R; seen.add(k); } } return { m, first: Math.min(...seen) }; };
    const gv = vb('gold-vol-breakout-forward'), uv = vb('usdjpy-vol-breakout-forward');
    for (const [name, v] of [['gold breakout (2021-01 .. 2026-10)', gv], ['USD/JPY breakout (2016-01 .. 2026-10)', uv]]) {
      const ms = []; for (let m = v.first; m < NM; m++) ms.push(m); const f = ms.map((m) => fade[m] + fadeX[m]), b = ms.map((m) => v.m[m]);
      comp[name] = { months: ms.length, from: ym(ms[0]), corr: r2(corr(f, b)), fadeT: r2(tOf(f)), breakoutT: r2(tOf(b)), bookT: r2(tOf(f.map((x, i) => x + b[i]))),
        fadePerMonth: r2(f.reduce((a, x) => a + x, 0) / f.length), breakoutPerMonth: r2(b.reduce((a, x) => a + x, 0) / b.length) }; } }
  const fmt = (x) => `${x.meanNet >= 0 ? '+' : '-'}${Math.abs(x.meanNet).toFixed(3)}R`;
  const headline = verdict === 'INCONCLUSIVE' ? (gate.ok ? 'not judged: too few markets or no cell with 1,000 trades in discovery' : 'the gate did not reproduce fade-hour-check; nothing judged')
    : verdict === 'PASS' ? `the picked cell ${sel.name} stays positive after costs everywhere: ${fmt(sel.conf)} a trade in 2015-26 (n ${sel.conf.n.toLocaleString('en-US')}, month t ${r2(sel.conf.tNet)}), ${fmt(sel.hist)} on HistData (t ${r2(sel.hist.tNet)}), ${fmt(sel.cross)} on five new crosses (t ${r2(sel.cross.tNet)})`
      : `the picked cell ${sel.name} (${fmt(sel.disc)} a trade after costs in 2005-14, n ${sel.disc.n.toLocaleString('en-US')}) ${primary.filter((x) => !x.pass).map((x) => `${x.key} ${x.meanNet >= 0 ? '+' : '-'}${Math.abs(x.meanNet).toFixed(3)}R (n ${x.n.toLocaleString('en-US')}, t ${x.tNet})`).join('; ')} after costs`;
  const out = { study: 'fade-evening', built: '2026-11-24', verdict, headline, basis: 'judged AFTER costs on calendar-month sums (pre-registered); one cell picked on 2005-14; Holm over 3',
    markets: O.map((d) => d.market), histMarkets: H.map((d) => d.market), crosses: X.map((d) => d.market), assumedCosts: [...ASSUMED, ...CROSSES], gate,
    selected: sel ? { cell: sel.cell, name: sel.name, disc: slim(sel.disc) } : null, primary,
    cells: cells.map((x) => ({ cell: x.cell, name: x.name, disc: slim(x.disc), conf: slim(x.conf), hist: slim(x.hist), cross: slim(x.cross) })),
    perMarket, years, complement: comp,
    meta: [...O, ...H, ...X].map((d) => ({ market: d.market, first: d.first && new Date(d.first * 1000).toISOString().slice(0, 10), dropped: d.dropped, small: d.small, open: d.open, nofill: d.nofill, rollSkip: d.rollSkip })) };
  fs.writeFileSync(path.join(HERE, 'result.json'), JSON.stringify(out, null, 1) + '\n');
  fs.writeFileSync(path.join(HERE, 'RESULT.md'), resultMd(out));
  return out;
}

const f3 = (x) => (x == null ? 'n/a' : (x >= 0 ? '+' : '-') + Math.abs(x).toFixed(3)), f2 = (x) => (x == null ? 'n/a' : x.toFixed(2)), N = (x) => Math.round(x).toLocaleString('en-US');
function resultMd(o) {
  const L = [], c = (x) => `${N(x.n)} | ${f3(x.mean)} | ${f3(x.meanNet)} (${f2(x.tNet)}) | ${f3(x.meanNet2)}`;
  L.push('# A tradable evening fade? (result)', '', `**Verdict: ${o.verdict}. ${o.headline}.**`, '',
    'Run 24 Nov 2026 as pre-registered (`PREREGISTRATION.md`, committed and pushed alone first). Research only: nothing live',
    'changed, nothing is proposed. One run, no variants after it. Judged AFTER costs.', '', '## What was run', '',
    '`grid7-wide-fade` M15 fade signals (imported) with the rollover rule always on: no fill and no holding between 21:00 and 22:59',
    'UTC (a trade still open is closed at the close of the last candle before 21:00), out after a day, target 2R. Grid of 24 cells:',
    'break hours A (20, 23) or B (17-20, 23, 00, 01) x stop 1 / 1.5 / 2 x ATR(14) of M15 x market or limit (0.25 ATR better, 12',
    'candles) x all or calm (ATR below 0.8 of its 100-candle median). One cell picked on OANDA 2005-14 after costs (n >= 1,000).',
    `Costs: the demo figures; **ASSUMED** for ${o.assumedCosts.join(', ')}.`, '', '## Gate', '',
    `- Rollover rule off, 1 ATR, market, break hours 20-23, 2015-26: n ${N(o.gate.got.n)}, ${f3(o.gate.got.mean)}R (fade-hour-check: n ${N(o.gate.want.n)}, ${f3(o.gate.want.mean)}R); this study's simulator against the grid's exits: ${o.gate.simMismatches} trades differ. ${o.gate.ok ? 'Equal.' : 'DIFFERS.'}`, '');
  if (o.selected) L.push('## The picked cell', '', `**${o.selected.name}**: 2005-14 n ${N(o.selected.disc.n)}, ${f3(o.selected.disc.mean)}R before costs, ${f3(o.selected.disc.meanNet)}R after (month t ${f2(o.selected.disc.tNet)}).`, '');
  L.push('## Primary tests (after costs)', '', '| Test | What | n | R before | R after (month t) | at 2x cost | Holm p | Pass |', '|---|---|---:|---:|---:|---:|---:|---|');
  for (const x of o.primary) L.push(`| ${x.key} | ${x.what} | ${N(x.n)} | ${f3(x.mean)} | ${f3(x.meanNet)} (${f2(x.tNet)}) | ${f3(x.meanNet2)} | ${x.holm < 0.001 ? x.holm.toExponential(1) : x.holm.toFixed(3)} | ${x.pass ? 'yes' : 'no'} |`);
  L.push('', '## Every cell', '', 'n | R before | R after (month t) | R at 2x cost, per window.', '',
    '| Cell | 05-14 n | before | after (t) | 2x | 15-26 n | before | after (t) | 2x | HistData n | before | after (t) | 2x | crosses n | before | after (t) | 2x |',
    '|---|' + '---:|'.repeat(16));
  for (const x of o.cells) L.push(`| ${x.name}${o.selected && x.cell === o.selected.cell ? ' **(picked)**' : ''} | ${c(x.disc)} | ${c(x.conf)} | ${c(x.hist)} | ${c(x.cross)} |`);
  if (o.perMarket.length) {
    L.push('', '## The picked cell by market', '', '| Feed | Market | 2005-14 n | after (t) | 2015-26 n | after (t) |', '|---|---|---:|---:|---:|---:|');
    for (const m of o.perMarket) L.push(`| ${m.feed} | ${m.market}${m.assumed ? '*' : ''} | ${N(m.disc.n)} | ${f3(m.disc.meanNet)} (${f2(m.disc.tNet)}) | ${N(m.conf.n)} | ${f3(m.conf.meanNet)} (${f2(m.conf.tNet)}) |`);
    L.push('', '\\* cost assumed. HistData rows: 2015-26 column = Feb 2018 on.', '', '## The picked cell by year (after costs)', '', '| Year | ten markets n | after | crosses n | after |', '|---|---:|---:|---:|---:|');
    for (const y of o.years) L.push(`| ${y.year} | ${N(y.oanda.n)} | ${f3(y.oanda.meanNet)} | ${N(y.cross.n)} | ${f3(y.cross.meanNet)} |`);
  }
  if (Object.keys(o.complement).length) {
    L.push('', '## Beside the two passing breakouts (descriptive)', '', 'Monthly sums of R after costs, 1R a trade, fade = the picked cell on the ten markets and the five crosses. No weights fitted.', '',
      '| Breakout | months | from | correlation | fade R / month (t) | breakout R / month (t) | combined t |', '|---|---:|---|---:|---:|---:|---:|');
    for (const [k, v] of Object.entries(o.complement)) L.push(`| ${k} | ${v.months} | ${v.from} | ${f2(v.corr)} | ${f2(v.fadePerMonth)} (${f2(v.fadeT)}) | ${f2(v.breakoutPerMonth)} (${f2(v.breakoutT)}) | ${f2(v.bookT)} |`);
  }
  L.push('', '## Checks', '', '- Every trade has its stop on the losing side of its entry (the simulator throws otherwise); closed candles only; no fill and',
    '  no holding in 21:00-22:59 UTC, also across a data gap or a weekend; a limit\'s fill candle can only stop the trade.', '',
    '| Market | from | dropped (bad data) | risk under cost | unresolved | limit not filled | market fill in rollover |', '|---|---|---:|---:|---:|---:|---:|');
  for (const m of o.meta) L.push(`| ${m.market} | ${m.first} | ${m.dropped} | ${N(m.small)} | ${m.open} | ${N(m.nofill)} | ${N(m.rollSkip)} |`);
  L.push('', '## What it means', '', MEANING(o), '');
  return L.join('\n');
}
export const MEANING = (o) => (o.meaning ? o.meaning : '(written after the run)');

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const [cmd, a, b] = process.argv.slice(2); const t0 = Date.now();
  if (cmd === 'oanda') { fs.mkdirSync(b, { recursive: true }); const M5 = K.load(a, '5m', { from: '2004-01-01', to: '2026-11-01' });
    const r = runSeries(M5, { market: a, X: exclusions(a) }); fs.writeFileSync(path.join(b, `O-${a}.json`), JSON.stringify(r));
    console.log('O', a, 'gate', r.gate.n, r.gate.mism, ((Date.now() - t0) / 1000).toFixed(0) + 's'); }
  else if (cmd === 'hist') { fs.mkdirSync(b, { recursive: true });
    const Hm = histM5(a, path.join(K.DATA_DIR, 'hist')).filter((x) => x.t >= Date.UTC(2018, 0, 1) / 1000 && x.t < Date.UTC(2026, 10, 1) / 1000);
    const r = runSeries(Hm, { market: a, from: B_FROM }); fs.writeFileSync(path.join(b, `H-${a}.json`), JSON.stringify(r)); console.log('H', a, ((Date.now() - t0) / 1000).toFixed(0) + 's'); }
  else if (cmd === 'report') { const o = report(a); console.log(o.verdict, o.headline); }
  else console.log('usage: run.mjs oanda <m> <dir> | hist <m> <dir> | report <dir>');
}
