// research/edge/gap-level-engulf/run.mjs - opening gaps as key levels, entered on an M15 engulf (PREREGISTRATION.md, 24 Nov 2026).
// Weekly gap (a hole of 40 h or more) and daily gap (the 17:00 New York roll) larger than 0.1 x Daily ATR(14); a return to the
// gap's range later in the week; an M15 engulf away from it; stop past the far side; 1R / 2R. Four cells, five markets.
// Research only: nothing live imports it, nothing is placed.
//   EDGE_DATA=<cache> node research/edge/gap-level-engulf/run.mjs run      (reads the cache, writes result.json + RESULT.md)
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import * as K from '../_lib/edgekit.mjs';
import { COSTS } from '../combo-grid-2/run.mjs';
import { engulfAt, EG_SPAN } from '../../../council/eg-methods.mjs';

const HERE = path.dirname(fileURLToPath(import.meta.url));
export const MARKETS = ['xau', 'eurusd', 'gbpusd', 'usdjpy', 'audusd'];
export const FROM = '2005-01-01', SPLIT = '2015-01-01', TO = '2026-11-01';
export const KINDS = ['weekly', 'daily'], MULTS = [1, 2];
export const CELLS = ['weekly 1R', 'weekly 2R', 'daily 1R', 'daily 2R'];
export const P = { hole: 40 * 3600, before: 1800, after: 3 * 3600, size: 0.1, atrN: 14, visit: 8, buf: 0.1, cap: 86400, span: EG_SPAN };
const sec = (d) => Date.parse(d + 'T00:00:00Z') / 1000;

// plain mean of the true range of the last n candles ending with each candle (null before n + 1 candles)
export function atrOf(B, n = P.atrN) {
  const out = new Array(B.length).fill(null); let sum = 0; const tr = new Array(B.length).fill(0);
  for (let i = 1; i < B.length; i++) {
    tr[i] = Math.max(B[i].h - B[i].l, Math.abs(B[i].h - B[i - 1].c), Math.abs(B[i].l - B[i - 1].c)); sum += tr[i];
    if (i > n) sum -= tr[i - n];
    if (i >= n) out[i] = sum / n;
  }
  return out;
}

// every gap over the size filter: { kind, lo, hi, t0 (the opening candle's start), i0 (its index), end (life ends), size, atr }
export function gaps(m5) {
  const days = K.dailyNY(m5), datr = atrOf(days);
  const out = []; const holes = [];
  for (let i = 1; i < m5.length; i++) if (m5[i].t - m5[i - 1].e >= P.hole) holes.push(i);
  let hk = 0;
  for (let i = 1; i < m5.length; i++) {
    const a = m5[i - 1], b = m5[i], hole = b.t - a.e; let kind = null;
    if (hole >= P.hole) kind = 'weekly';
    else if (hole > 0 || a.e % 3600 === 0) {
      const off = K.nyOffsetH(a.e), R = Math.floor((a.e - off * 3600) / 86400) * 86400 + 17 * 3600 + off * 3600;
      if (a.e <= R && b.t >= R && R - a.e <= P.before && b.t - R <= P.after) kind = 'daily';
    }
    if (!kind) continue;
    const n = K.closedCount(days, b.t); const atr = n ? datr[n - 1] : null; if (!(atr > 0)) continue;
    const lo = Math.min(a.c, b.o), hi = Math.max(a.c, b.o), size = hi - lo; if (!(size > P.size * atr)) continue;
    while (hk < holes.length && holes[hk] <= i) hk++;
    const end = hk < holes.length ? m5[holes[hk] - 1].e : Infinity; // the start of the next long hole; unknown yet = still alive
    out.push({ kind, lo, hi, t0: b.t, i0: i, end, size, atr });
  }
  return out;
}

// M15 candles of the 5-minute series, the newest bucket left out, with the fields engulfAt reads
export function m15Of(m5) {
  const M = K.resample(m5, 900); M.pop();
  for (const c of M) { c.open = c.o; c.high = c.h; c.low = c.l; c.close = c.c; }
  return M;
}

// signals: { kind, d, ts (the entry candle's close), stop, lo, hi, gapT, end }; closed M15 candles only
export function signals(m5) {
  const G = gaps(m5), M = m15Of(m5), a15 = atrOf(M); const out = [];
  let start = 0;
  for (const g of G) {
    while (start < M.length && M[start].t < Math.floor(g.t0 / 900) * 900) start++;
    let armed = 0, d = 0, v0 = -1;
    for (let j = start; j < M.length && M[j].e <= g.end; j++) {
      const c = M[j];
      if (v0 < 0) {
        if (c.l > g.hi) { armed = 1; continue; }
        if (c.h < g.lo) { armed = -1; continue; }
        if (!armed) continue;
        v0 = j; d = armed; armed = 0; // this candle trades into the range: the visit starts
      }
      let over = false;
      if (d > 0 ? c.c < g.lo : c.c > g.hi) over = true; // closed beyond the far side
      else {
        const e = engulfAt(M, j, P.span);
        if (e && e.dir === d && a15[j] > 0) { over = true;
          out.push({ kind: g.kind, d, ts: c.e, stop: d > 0 ? g.lo - P.buf * a15[j] : g.hi + P.buf * a15[j], lo: g.lo, hi: g.hi, gapT: g.t0, end: g.end }); }
      }
      if (over || j - v0 + 1 >= P.visit) { v0 = -1; d = 0; if (c.l > g.hi) armed = 1; else if (c.h < g.lo) armed = -1; }
    }
  }
  return { signals: out.sort((x, y) => x.ts - y.ts), gaps: G };
}

// one market trade from 5-minute candle fi on: R for each target multiple (stop first; opens past a level exit at the open)
export function exits(m5, fi, d, stop, mults = MULTS, cap = P.cap) {
  const fill = m5[fi].o, risk = d * (fill - stop); if (!(risk > 0)) return null;
  const tg = mults.map((k) => fill + d * k * risk), R = mults.map(() => null); let left = mults.length; const dead = m5[fi].t + cap;
  for (let j = fi; j < m5.length && left; j++) {
    const b = m5[j];
    if (j > fi) {
      if (d * (b.o - stop) <= 0) { const r = (d * (b.o - fill)) / risk; for (let k = 0; k < R.length; k++) if (R[k] == null) R[k] = r; left = 0; break; }
      for (let k = 0; k < R.length; k++) if (R[k] == null && d * (b.o - tg[k]) >= 0) { R[k] = (d * (b.o - fill)) / risk; left--; }
    }
    if (d > 0 ? b.l <= stop : b.h >= stop) { for (let k = 0; k < R.length; k++) if (R[k] == null) R[k] = -1; left = 0; break; }
    for (let k = 0; k < R.length; k++) if (R[k] == null && (d > 0 ? b.h >= tg[k] : b.l <= tg[k])) { R[k] = mults[k]; left--; }
    if (left && b.e >= dead) { const r = (d * (b.c - fill)) / risk; for (let k = 0; k < R.length; k++) if (R[k] == null) R[k] = r; left = 0; }
  }
  if (R.some((x) => x == null)) return null; // the candles ended before the trade did
  return { fill, risk, R };
}

// trades of one market: [{ kind, t (fill), d, R: [1R, 2R], c (cost in R) }]
export function trades(m5, cost) {
  const { signals: S, gaps: G } = signals(m5); const out = []; let i = 0;
  for (const s of S) {
    while (i < m5.length && m5[i].t < s.ts) i++;
    if (i >= m5.length || m5[i].t >= s.end) continue;
    const x = exits(m5, i, s.d, s.stop); if (!x || !(x.risk > cost)) continue;
    out.push({ kind: s.kind, t: m5[i].t, d: s.d, R: x.R, c: cost / x.risk, gapT: s.gapT });
  }
  return { trades: out, gaps: G };
}

// ---- statistics ---------------------------------------------------------------------------------------------------
function monthsOf(a, b) { const out = []; const A = new Date(a * 1000), B = new Date((b - 1) * 1000);
  for (let y = A.getUTCFullYear(), m = A.getUTCMonth(); y < B.getUTCFullYear() || (y === B.getUTCFullYear() && m <= B.getUTCMonth()); m === 11 ? (y++, (m = 0)) : m++) out.push(y * 12 + m);
  return out; }
const mk = (t) => { const d = new Date(t * 1000); return d.getUTCFullYear() * 12 + d.getUTCMonth(); };
export function tOf(xs) { const n = xs.length; if (n < 2) return null; const m = xs.reduce((a, b) => a + b, 0) / n;
  const sd = Math.sqrt(xs.reduce((a, b) => a + (b - m) ** 2, 0) / (n - 1)); return sd > 0 ? m / (sd / Math.sqrt(n)) : null; }
export const p1 = (t, df) => (t == null ? 1 : t > 0 ? K.pFromT(t, df) / 2 : 1 - K.pFromT(t, df) / 2);
export function windowStat(rows, from, to) { // rows: [{ t, g (before), n (after) }]
  const xs = rows.filter((r) => r.t >= from && r.t < to); const months = monthsOf(from, to);
  const sumG = new Map(months.map((m) => [m, 0])), sumN = new Map(months.map((m) => [m, 0]));
  for (const r of xs) { const k = mk(r.t); sumG.set(k, sumG.get(k) + r.g); sumN.set(k, sumN.get(k) + r.n); }
  const n = xs.length, mean = (f) => (n ? xs.reduce((a, r) => a + r[f], 0) / n : null);
  return { n, win: n ? xs.filter((r) => r.g > 0).length / n : null, before: mean('g'), after: mean('n'), months: months.length,
    tBefore: tOf([...sumG.values()]), tAfter: tOf([...sumN.values()]) };
}
export function judge(cells) { // cells: [{ cell, disc, conf }] -> adds p, holm, pass; returns the verdict
  const ps = cells.map((c) => p1(c.conf.tAfter, c.conf.months - 1)), hs = K.holm(ps);
  cells.forEach((c, i) => { c.p = ps[i]; c.holm = hs[i];
    c.enough = c.disc.n >= 300 && c.conf.n >= 300;
    c.pass = c.enough && c.disc.after > 0 && c.conf.after > 0 && c.disc.tAfter >= 2 && c.conf.tAfter >= 2 && c.holm < 0.05; });
  return cells.some((c) => c.pass) ? 'PASS' : cells.some((c) => c.enough) ? 'FAIL' : 'INCONCLUSIVE';
}

const f3 = (x) => (x == null ? 'n/a' : (x >= 0 ? '+' : '-') + Math.abs(x).toFixed(3));
const f2 = (x) => (x == null ? 'n/a' : x.toFixed(2));
const pc = (x) => (x == null ? 'n/a' : Math.round(x * 100) + ' %');

function run() {
  const a = sec(FROM), s = sec(SPLIT), b = sec(TO);
  const rows = CELLS.map(() => []), per = {}, counts = {};
  for (const m of MARKETS) {
    let m5 = K.load(m, '5m', { from: FROM, to: '2026-11-08' });
    const { trades: T, gaps: G } = trades(m5, COSTS[m]); m5 = null;
    counts[m] = {}; per[m] = [];
    KINDS.forEach((kind, ki) => {
      const g = G.filter((x) => x.kind === kind && x.t0 >= a && x.t0 < b), t = T.filter((x) => x.kind === kind && x.t >= a && x.t < b);
      counts[m][kind] = { gaps: g.length, gapsWithTrade: new Set(t.map((x) => x.gapT)).size, trades: t.length };
      MULTS.forEach((_, xi) => { const ci = ki * 2 + xi; const rr = t.map((x) => ({ t: x.t, g: x.R[xi], n: x.R[xi] - x.c }));
        for (const r of rr) rows[ci].push(r);
        per[m].push({ cell: CELLS[ci], disc: windowStat(rr, a, s), conf: windowStat(rr, s, b) }); });
    });
    console.error(m, JSON.stringify(counts[m]));
  }
  const cells = CELLS.map((cell, i) => ({ cell, disc: windowStat(rows[i], a, s), conf: windowStat(rows[i], s, b) }));
  const verdict = judge(cells);
  const pool = cells.filter((c) => c.enough).length ? cells.filter((c) => c.enough) : cells;
  const best = [...pool].sort((x, y) => (y.conf.after ?? -9) - (x.conf.after ?? -9))[0];
  const headline = verdict === 'INCONCLUSIVE'
    ? `no cell has 300 trades in both windows; the largest, ${best.cell}, made ${f3(best.conf.after)}R a trade after costs in 2015-26 (n ${best.conf.n}, month t ${f2(best.conf.tAfter)})`
    : `${cells.filter((c) => c.pass).length} of 4 cells pass; the best, ${best.cell}, made ${f3(best.conf.after)}R a trade after costs in 2015-26 (n ${best.conf.n}, month t ${f2(best.conf.tAfter)}; before costs ${f3(best.conf.before)}R)`;
  const R = { topic: 'gap-level-engulf', built: '2026-11-24', verdict, headline, best: best.cell, passed: cells.filter((c) => c.pass).map((c) => c.cell),
    windows: { discovery: [FROM, '2014-12-31'], confirmation: [SPLIT, '2026-10-31'] }, markets: MARKETS, costs: Object.fromEntries(MARKETS.map((m) => [m, COSTS[m]])),
    params: P, cells, perMarket: per, counts };
  fs.writeFileSync(path.join(HERE, 'result.json'), JSON.stringify(R, null, 1) + '\n');
  fs.writeFileSync(path.join(HERE, 'RESULT.md'), report(R));
  console.log(verdict + ': ' + headline);
}

export function report(R) {
  const row = (c) => `| ${c.cell} | ${c.disc.n} | ${pc(c.disc.win)} | ${f3(c.disc.before)} | ${f3(c.disc.after)} | ${f2(c.disc.tAfter)} | ${c.conf.n} | ${pc(c.conf.win)} | ${f3(c.conf.before)} | ${f3(c.conf.after)} | ${f2(c.conf.tBefore)} | ${f2(c.conf.tAfter)} | ${c.holm == null ? '' : f2(c.holm)} | ${c.pass == null ? '' : c.pass ? 'yes' : c.enough ? 'no' : 'no (too few)'} |`;
  const head = '| cell | n 2005-14 | won | R before costs | R after costs | month t after | n 2015-26 | won | R before costs | R after costs | month t before | month t after | Holm p | passes |\n|---|---|---|---|---|---|---|---|---|---|---|---|---|---|';
  const L = [];
  L.push('# Result: opening gaps as key levels, entered on an M15 engulf (24 Nov 2026)', '');
  L.push(`**Verdict: ${R.verdict}. ${R.headline}.**`, '');
  L.push('Pre-registered in `PREREGISTRATION.md` (committed alone before any run). Written by `run.mjs` from `result.json`. Research only: nothing live changed, no rule is proposed.', '');
  L.push('## The rule, in short', '');
  L.push('A weekly gap (a closure of 40 hours or more) or a daily gap (across the 17:00 New York roll) larger than 0.1 x the Daily ATR(14) is a zone for the rest of its week. After an M15 candle wholly outside it, the first M15 candle that trades back into it opens a visit of 8 candles; the first engulf in the direction away from the gap (completed within 3 candles) is a market entry at the next 5-minute open, stop past the gap\'s far side by 0.1 x ATR(14) of M15, target 1R or 2R, out after 24 hours. OANDA mid 5-minute candles, xau, eurusd, gbpusd, usdjpy, audusd; costs of `combo-grid-2` charged on every trade; R in units of the trade\'s own risk.', '');
  L.push('## The four cells (five markets pooled)', '', head, ...R.cells.map(row), '');
  L.push('Month t = the t of calendar-month sums of R (120 months in 2005-14, 142 in 2015-26, empty months as 0). Holm p: one-sided, from the confirmation month t after costs, over the four cells.', '');
  L.push('## By market (context only, no verdict)', '');
  for (const m of R.markets) { L.push(`**${m}** (round trip ${R.costs[m]})`, '', head, ...R.perMarket[m].map(row), ''); }
  L.push('## How many gaps', '', '| market | weekly gaps over the filter | gave a trade | trades | daily gaps over the filter | gave a trade | trades |', '|---|---|---|---|---|---|---|');
  for (const m of R.markets) { const w = R.counts[m].weekly, d = R.counts[m].daily; L.push(`| ${m} | ${w.gaps} | ${w.gapsWithTrade} | ${w.trades} | ${d.gaps} | ${d.gapsWithTrade} | ${d.trades} |`); }
  L.push('', '## Limits', '');
  L.push('- Mid candles: the spread at and after a reopen is wider than the flat cost charged here (`fx-weekend-gap-exec` measured about 11 pips quoted at the Sunday reopen on the demo account). Entries here come later in the week, but a Sunday-evening entry is flattered.');
  L.push('- The cost is today\'s demo figure charged on every year.');
  L.push('- On forex these candles have no closure at the 17:00 New York roll, so a daily gap over the filter is rare outside gold; the daily cells are mostly gold.');
  L.push('- Trades overlap (several visits of one gap, several markets), so the per-trade count overstates the independent evidence; the month t is the figure to read.');
  L.push('- One run of the pre-registered rule; no variant was tried. Never call any cell an edge.', '');
  return L.join('\n');
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  if (process.argv[2] === 'run') run(); else console.error('usage: run.mjs run');
}
