// Trendline third touch and trendline break-and-retest, each with an engulf trigger (pre-registered 23 Nov 2026,
// PREREGISTRATION.md, committed before this file). Research only: nothing live reads it, nothing is placed.
//   node research/edge/trendline-engulf-2020/run.mjs [scratchDir]   reads the toolkit's candle cache (outside git), writes
//   result.json next to this file and, when scratchDir is given, the trades there (outside git).
//
// The rules, in the order of PREREGISTRATION.md (every reading on the test's own timeframe, H4 or H1, closed candles only):
//   lines(bars)      a line at each swing confirmation (edgekit.swings, 3 a side, wicks): the previous swing of the same type A
//                    and the new one B; falling (highs, B lower) or rising (lows, B higher); B.i - A.i in 5..100; |slope| per
//                    candle 0.02..0.50 x ATR14 at B's confirmation candle; no close beyond it from A.i + 1 to that candle.
//   scan(bars, L)    walks each line from the candle after its confirmation to its life end (150 candles after B):
//                    the first close beyond it is the break (rule B setup); the first wick within 0.10 ATR before that, not
//                    closing beyond, is the touch (rule A setup, the line spent for rule A; it may still break later).
//   Rule A trigger   engulfAt(.., j, 3) in the line's trend direction, touch <= j <= touch + 3, base >= touch - 3, no close
//                    beyond the line from the touch to j; stop = extreme of touch..j + 0.10 ATR(j).
//   Rule B trigger   retest = first candle of the 12 after the break with its wick within 0.10 ATR(break) of the line; a close
//                    back beyond the line before the retest, at it, or before the trigger cancels; engulfAt in the setup's
//                    direction at retest..retest+3, base >= retest - 3; stop = extreme of retest..j + 0.10 ATR(j).
//   Entry market at the first 5-minute open at or after j's close (edgekit.simulate), target 2R (1R / 3R descriptive), time
//   exit 48 candles of the timeframe after the fill, stop first. Risk under 3 x the round trip: skipped.
//   Streams: one position at a time per market and test. A trade whose fill falls in a data-quality bad interval is not
//   counted (the position still blocks the market until its exit, as it would have been held).
// Details the pre-registration leaves open, fixed here before the run: ATR14 = simple mean of the last 14 true ranges up to
// and including the candle read (the touch tolerance reads ATR at the touch candle); two lines giving a signal on the same
// trigger candle and side are one signal (the one whose B is newest).
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import * as K from '../_lib/edgekit.mjs';
import { engulfAt } from '../../../council/eg-methods.mjs';

export const P = { K: 3, minGap: 5, maxGap: 100, slopeMin: 0.02, slopeMax: 0.50, life: 150, tol: 0.10, trigWin: 3, baseBack: 3,
  retestWin: 12, stopPad: 0.10, rr: 2, rrDesc: [1, 3], hold: 48, minRiskCost: 3, atrN: 14 };
export const TFS = { H4: 14400, H1: 3600 };
export const TESTS = [{ id: 'T1', rule: 'A', tf: 'H4' }, { id: 'T2', rule: 'A', tf: 'H1' }, { id: 'T3', rule: 'B', tf: 'H4' }, { id: 'T4', rule: 'B', tf: 'H1' }];
export const MARKETS = ['xau', 'eurusd', 'gbpusd', 'usdjpy', 'audusd', 'nzdusd', 'usdcad', 'usdchf', 'eurjpy', 'xag', 'gbpjpy', 'eurgbp',
  'audjpy', 'cadjpy', 'euraud', 'nas100', 'spx500', 'de40'];
export const START = Date.UTC(2020, 0, 1) / 1000, SPLIT = Date.UTC(2024, 0, 1) / 1000, CUT = Date.UTC(2023, 5, 15) / 1000;

export function atrs(B, n = P.atrN) { // simple mean of the last n true ranges up to and including i (fewer at the start)
  const tr = B.map((b, i) => (i ? Math.max(b.h - b.l, Math.abs(b.h - B[i - 1].c), Math.abs(b.l - B[i - 1].c)) : b.h - b.l));
  const out = new Float64Array(B.length); let s = 0;
  for (let i = 0; i < B.length; i++) { s += tr[i]; if (i >= n) s -= tr[i - n]; out[i] = s / Math.min(i + 1, n); }
  return out;
}
const conv = (B) => B.map((b) => ({ time: b.t, open: b.o, high: b.h, low: b.l, close: b.c }));
export const lineVal = (L, j) => L.A.price + L.m * (j - L.A.i);

// Lines: { s: +1 falling (through highs) / -1 rising (through lows), A, B, m (slope per candle), drawn (confirmation index) }.
export function lines(B, atr = atrs(B)) {
  const sw = K.swings(B, P.K).sort((a, b) => a.ci - b.ci || a.i - b.i);
  const last = { H: null, L: null }, out = [];
  for (const x of sw) {
    const A = last[x.type]; last[x.type] = x;
    if (!A) continue;
    const s = x.type === 'H' ? 1 : -1, gap = x.i - A.i;
    if (gap < P.minGap || gap > P.maxGap) continue;
    if (s > 0 ? !(x.price < A.price) : !(x.price > A.price)) continue;
    const m = (x.price - A.price) / gap, a = atr[x.ci];
    if (!(a > 0) || Math.abs(m) < P.slopeMin * a || Math.abs(m) > P.slopeMax * a) continue;
    const L = { s, A: { i: A.i, price: A.price }, B: { i: x.i, price: x.price }, m, drawn: x.ci };
    let ok = true;
    for (let y = A.i + 1; y <= x.ci && ok; y++) { const v = lineVal(L, y); if (s > 0 ? B[y].c > v : B[y].c < v) ok = false; }
    if (ok) out.push(L);
  }
  return out;
}

// Signals of one rule ('A' | 'B'): { rule, side (+1 buy / -1 sell), j (trigger index), t (its close), stop, at (touch or
// retest index), atr, line: [A.i, B.i] }. Every field depends only on candles 0..j.
export function signals(B, rule, atr = atrs(B)) {
  const C = conv(B), n = B.length, out = [];
  const eg = (j, dir, from) => { const e = engulfAt(C, j, 3); return e && e.dir === dir && e.j >= from ? e : null; };
  for (const L of lines(B, atr)) {
    const end = Math.min(n - 1, L.B.i + P.life), s = L.s;
    const beyond = (k) => (s > 0 ? B[k].c > lineVal(L, k) : B[k].c < lineVal(L, k));
    let touched = false, brk = -1;
    for (let k = L.drawn + 1; k <= end; k++) {
      if (beyond(k)) { brk = k; break; }
      if (touched || rule !== 'A') continue;
      const v = lineVal(L, k), tol = P.tol * atr[k];
      if (s > 0 ? B[k].h >= v - tol : B[k].l <= v + tol) {
        touched = true; const d = -s; // trade with the line's trend: a falling line sells, a rising line buys
        for (let j = k; j <= k + P.trigWin && j < n; j++) {
          if (beyond(j)) break;
          if (!eg(j, d, k - P.baseBack)) continue;
          let ext = d > 0 ? Infinity : -Infinity; for (let y = k; y <= j; y++) ext = d > 0 ? Math.min(ext, B[y].l) : Math.max(ext, B[y].h);
          out.push({ rule, side: d, j, t: B[j].e, stop: ext - d * P.stopPad * atr[j], at: k, atr: atr[j], line: [L.A.i, L.B.i] });
          break;
        }
      }
    }
    if (rule !== 'B' || brk < 0) continue;
    const d = s; // a close above a falling line buys, below a rising line sells
    const back = (k) => (d > 0 ? B[k].c < lineVal(L, k) : B[k].c > lineVal(L, k));
    const tol = P.tol * atr[brk];
    let r = -1;
    for (let k = brk + 1; k <= brk + P.retestWin && k < n; k++) {
      if (back(k)) break;
      const v = lineVal(L, k);
      if (d > 0 ? B[k].l <= v + tol : B[k].h >= v - tol) { r = k; break; }
    }
    if (r < 0) continue;
    for (let j = r; j <= r + P.trigWin && j < n; j++) {
      if (back(j)) break;
      if (!eg(j, d, r - P.baseBack)) continue;
      let ext = d > 0 ? Infinity : -Infinity; for (let y = r; y <= j; y++) ext = d > 0 ? Math.min(ext, B[y].l) : Math.max(ext, B[y].h);
      out.push({ rule, side: d, j, t: B[j].e, stop: ext - d * P.stopPad * atr[j], at: r, atr: atr[j], line: [L.A.i, L.B.i], brk });
      break;
    }
  }
  // one signal per trigger candle and side: the newest line's
  out.sort((a, b) => a.t - b.t || a.side - b.side || b.line[1] - a.line[1]);
  return out.filter((x, i) => i === 0 || !(x.t === out[i - 1].t && x.side === out[i - 1].side));
}

const inBad = (X, t) => { let lo = 0, hi = X.length; while (lo < hi) { const m = (lo + hi) >> 1; if (X[m][0] <= t) lo = m + 1; else hi = m; } return lo > 0 && t <= X[lo - 1][1]; };

// One stream: one position at a time, the given target in R. Returns counted trades and counts.
export function stream(m5, S, { cost, tfSec, rr = P.rr, bad = [], from = START }) {
  const trades = [], c = { signals: 0, blocked: 0, smallRisk: 0, bad: 0, open: 0, excluded: 0 }; let busy = -Infinity;
  for (const u of S) {
    if (u.t < from) continue;
    c.signals++;
    if (u.t < busy) { c.blocked++; continue; }
    let f = 0, g = m5.length; while (f < g) { const h = (f + g) >> 1; if (m5[h].t < u.t) f = h + 1; else g = h; }
    if (f >= m5.length) { c.open++; continue; }
    const fill = m5[f].o, risk = u.side * (fill - u.stop);
    if (!(risk > 0)) { c.bad++; continue; }
    if (risk < P.minRiskCost * cost) { c.smallRisk++; continue; }
    const r = K.simulate({ side: u.side, entry: fill, stop: u.stop, target: fill + u.side * rr * risk, t: u.t, type: 'market', maxHold: P.hold * tfSec }, m5, { cost });
    if (r.status === 'bad' || r.status === 'nofill') { c.bad++; continue; }
    if (r.status === 'open') { c.open++; busy = Infinity; continue; }
    busy = r.exitT;
    if (inBad(bad, r.fillT)) { c.excluded++; continue; }
    trades.push({ side: u.side, t: u.t, fillT: r.fillT, entry: r.fill, stop: u.stop, exitT: r.exitT, exit: r.exit, reason: r.reason,
      risk: r.risk, R: r.R, Rnet: r.Rnet, R2: r.R - (2 * cost) / r.risk });
  }
  return { trades, counts: c };
}

// ---- statistics on the pre-registered windows (month sums by fill month, empty months zero) ----------------------------
const ym = (t) => { const d = new Date(t * 1000); return d.getUTCFullYear() * 12 + d.getUTCMonth(); };
export function windowStats(trades, a, b, key = 'Rnet') {
  const xs = trades.filter((x) => x.fillT >= a && x.fillT < b), n = xs.length;
  const m0 = ym(a), m1 = ym(b - 1), sums = new Array(m1 - m0 + 1).fill(0);
  for (const x of xs) sums[ym(x.fillT) - m0] += x[key];
  const M = sums.length, mm = sums.reduce((p, q) => p + q, 0) / M;
  const sd = M > 1 ? Math.sqrt(sums.reduce((p, q) => p + (q - mm) ** 2, 0) / (M - 1)) : 0;
  const tMonth = sd > 0 && n ? mm / (sd / Math.sqrt(M)) : null;
  const total = xs.reduce((p, x) => p + x[key], 0);
  return { n, wins: xs.filter((x) => x.R > 1e-9).length, meanR: n ? total / n : null, total, months: M, tMonth,
    pOne: tMonth == null ? 1 : tMonth > 0 ? K.pFromT(tMonth, M - 1) / 2 : 1 - K.pFromT(tMonth, M - 1) / 2 };
}
export function evaluate(T, end) {
  const w = (a, b) => ({ net: windowStats(T, a, b), x2: windowStats(T, a, b, 'R2'), gross: windowStats(T, a, b, 'R') });
  return { disc: w(START, SPLIT), conf: w(SPLIT, end) };
}
export function bar(e, pHolm) {
  const lines = {
    discN100: e.disc.net.n >= 100, discMeanPos: e.disc.net.meanR > 0, discT2: e.disc.net.tMonth != null && e.disc.net.tMonth >= 2,
    confN50: e.conf.net.n >= 50, confMeanPos: e.conf.net.meanR > 0, confT2: e.conf.net.tMonth != null && e.conf.net.tMonth >= 2,
    holm05: pHolm < 0.05, x2Pos: e.disc.x2.meanR > 0 && e.conf.x2.meanR > 0,
  };
  return { lines, pass: Object.values(lines).every(Boolean), onlyN: !lines.discN100 || !lines.confN50 ? Object.entries(lines).every(([k, v]) => v || k === 'discN100' || k === 'confN50') : false };
}

// ---- no look-ahead on the real candles -----------------------------------------------------------------------------
export function cutCheck(m5, cut = CUT) {
  const res = {};
  const kept = m5.filter((b) => b.t < cut);
  for (const [tf, sec] of Object.entries(TFS)) for (const rule of ['A', 'B']) {
    const k = (x) => [x.side, x.t, x.stop, x.at, x.line.join(':')].join('|');
    const full = signals(K.resample(m5, sec), rule).filter((x) => x.t <= cut).map(k);
    const part = signals(K.resample(kept, sec), rule).filter((x) => x.t <= cut).map(k);
    res[rule + tf] = { compared: full.length, identical: JSON.stringify(full) === JSON.stringify(part) };
  }
  return res;
}

const r4 = (x) => (typeof x === 'number' ? +x.toFixed(4) : x);
function round(o) { return JSON.parse(JSON.stringify(o, (k, v) => (typeof v === 'number' ? +v.toPrecision(6) : v))); }

async function main() {
  const t0 = Date.now(), scratch = process.argv[2];
  const { COSTS, exclusions } = await import('../combo-grid-2/run.mjs');
  const all = {}; for (const T of TESTS) { all[T.id] = []; for (const rr of P.rrDesc) all[T.id + '_' + rr + 'R'] = []; }
  const perMarket = {}, counts = {}, cut = {}; let end = 0;
  for (const mk of MARKETS) {
    const m5 = K.load(mk, '5m', { from: '2019-06-01' }); end = Math.max(end, m5[m5.length - 1].e);
    const cost = COSTS[mk], bad = exclusions(mk); perMarket[mk] = { cost, badIntervals: bad.length, first: new Date(m5[0].t * 1000).toISOString().slice(0, 10) };
    if (mk === 'xau' || mk === 'eurusd') cut[mk] = cutCheck(m5);
    const S = {};
    for (const [tf, sec] of Object.entries(TFS)) { const B = K.resample(m5, sec), atr = atrs(B); S['A' + tf] = signals(B, 'A', atr); S['B' + tf] = signals(B, 'B', atr); }
    for (const T of TESTS) {
      const sig = S[T.rule + T.tf], tfSec = TFS[T.tf];
      const r = stream(m5, sig, { cost, tfSec, bad });
      for (const x of r.trades) all[T.id].push({ market: mk, ...x });
      (counts[T.id] ||= {})[mk] = { ...r.counts, trades: r.trades.length };
      for (const rr of P.rrDesc) for (const x of stream(m5, sig, { cost, tfSec, bad, rr }).trades) all[T.id + '_' + rr + 'R'].push({ market: mk, ...x });
    }
    console.error(mk, 'done', ((Date.now() - t0) / 1000).toFixed(0) + 's');
  }
  const tests = {};
  for (const T of TESTS) tests[T.id] = { rule: T.rule, tf: T.tf, ...evaluate(all[T.id], end) };
  const ph = K.holm(TESTS.map((T) => tests[T.id].conf.net.pOne));
  TESTS.forEach((T, i) => { tests[T.id].pHolm = ph[i]; tests[T.id].bar = bar(tests[T.id], ph[i]); });
  const passed = TESTS.filter((T) => tests[T.id].bar.pass).map((T) => T.id);
  const verdict = passed.length ? 'PASS' : TESTS.every((T) => tests[T.id].bar.onlyN) ? 'INCONCLUSIVE' : 'FAIL';
  const desc = {};
  for (const T of TESTS) {
    const gold = all[T.id].filter((x) => x.market === 'xau');
    const bySide = {}; for (const s of [1, -1]) bySide[s > 0 ? 'buy' : 'sell'] = evaluate(all[T.id].filter((x) => x.side === s), end);
    const byYear = {}; for (const x of all[T.id]) { const y = new Date(x.fillT * 1000).getUTCFullYear(); const o = (byYear[y] ||= { n: 0, Rnet: 0 }); o.n++; o.Rnet += x.Rnet; }
    for (const y of Object.keys(byYear)) byYear[y].meanRnet = byYear[y].Rnet / byYear[y].n;
    const byMarket = {}; for (const mk of MARKETS) { const xs = all[T.id].filter((x) => x.market === mk); byMarket[mk] = { n: xs.length, meanRnet: xs.length ? xs.reduce((p, x) => p + x.Rnet, 0) / xs.length : null }; }
    desc[T.id] = { gold: evaluate(gold, end), bySide, byYear, byMarket,
      targets: Object.fromEntries(P.rrDesc.map((rr) => [rr + 'R', evaluate(all[T.id + '_' + rr + 'R'], end)])) };
  }
  const head = (id) => { const e = tests[id]; return `${id} conf n ${e.conf.net.n}, ${e.conf.net.meanR?.toFixed(3)}R, t ${e.conf.net.tMonth?.toFixed(2)}`; };
  const result = round({
    study: 'trendline-engulf-2020', built: new Date().toISOString().slice(0, 10), verdict, passed,
    headline: `${verdict}: ${passed.length} of 4 tests pass. ` + TESTS.map((T) => head(T.id)).join('; ') + '.',
    windows: { discovery: '2020-01-01 to 2023-12-31', confirmation: '2024-01-01 to ' + new Date(end * 1000).toISOString().slice(0, 16) + 'Z' },
    params: P, markets: MARKETS, perMarket, setupCounts: counts, cutCheck: cut, cutDate: new Date(CUT * 1000).toISOString().slice(0, 10),
    tests, holmOver: TESTS.map((T) => T.id), holmNote: 'one-sided p of the confirmation month-sum t (t <= 0 gives p >= 0.5)',
    descriptive: desc, monthKey: 'fill time', note: 'Mean R per trade after costs unless named gross / x2; month t on calendar-month sums, empty months zero.',
  });
  const dir = path.dirname(fileURLToPath(import.meta.url));
  fs.writeFileSync(path.join(dir, 'result.json'), JSON.stringify(result, null, 1) + '\n');
  if (scratch) { fs.mkdirSync(scratch, { recursive: true });
    fs.writeFileSync(path.join(scratch, 'trades.json'), JSON.stringify(Object.fromEntries(Object.entries(all).map(([k, v]) => [k, v.map((x) => Object.fromEntries(Object.entries(x).map(([a, b]) => [a, r4(b)])))])))); }
  console.error('done', verdict, passed, ((Date.now() - t0) / 1000).toFixed(0) + 's');
}

if (process.argv[1] && fileURLToPath(import.meta.url) === fs.realpathSync(process.argv[1])) main();
