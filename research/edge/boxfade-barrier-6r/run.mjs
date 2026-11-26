// A Box fade signal as the entry at a Mosha barrier, with a 6R target, on gold (PREREGISTRATION.md, 26 Nov 2026).
// Research only: reads the edgekit candle cache (outside git), places nothing. The Box fade signal is the study code the
// tracker's boxfade adapter runs (grid6-box-in-box signals, the fade-breaks-holdout F1 cell); the barriers are the Mosha
// desk's own zones (assets/mosha-sop.js zonesOf, one-candle structure); the exit order is the tracker's walk(). All imported.
//   node research/edge/boxfade-barrier-6r/run.mjs year <Y> <outDir>              that year's signals, tags and outcomes
//   node research/edge/boxfade-barrier-6r/run.mjs cut <Y> <outDir>               the cut test (look-ahead check)
//   node research/edge/boxfade-barrier-6r/run.mjs report <outDir> <m6qDir>       result.json and RESULT.md (m6qDir: the
//                                                                               year files of mosha-6r-quality, control C2)
import fs from 'node:fs';
import path from 'node:path';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';
import * as K from '../_lib/edgekit.mjs';
import { frames } from '../combo-grid-3/run.mjs';
import { startIdx } from '../dom-trade-through/run.mjs';
import * as BOX from '../grid6-box-in-box/run.mjs';
import { CELLS } from '../fade-breaks-holdout/run.mjs';
import { group } from '../mosha-barrier-6r/run.mjs';
import { walk } from '../../../council/edge-desks-2.mjs';

const require = createRequire(import.meta.url), SOP = require('../../../assets/mosha-sop.js');
const HERE = path.dirname(fileURLToPath(import.meta.url));
export const COST = 0.30, RR = 6, HOLD = 5 * 86400, NEAR = 0.25, ZMIN = 0.5, MIN_N = 100;
export const BOX_RR = 1, BOX_HOLD = 86400;                       // the Box fade's own exit (control C3)
export const TFS = ['1d', '4h', '1h', '30m', '15m'];             // highest first: the label of a trade at several zones
export const YEARS = [2018, 2019, 2020, 2021, 2022, 2023, 2024, 2025, 2026];
export const IS = [Date.UTC(2018, 0, 1) / 1000, Date.UTC(2022, 0, 1) / 1000];
export const OOS = [Date.UTC(2022, 0, 1) / 1000, Date.UTC(2026, 10, 1) / 1000];
const DAY = 86400, T = (y) => Date.UTC(y, 0, 1) / 1000, TAIL = 12 * DAY;
const toDesk = (b) => ({ time: b.t, open: b.o, high: b.h, low: b.l, close: b.c });

// ─── the Box fade order of one signal (the tracker's boxTrades, plus the 2-cost skip of the pre-registration) ───
// sg: { d, c0, box { hi, lo } }; fillOpen: the open of the first 5-minute candle at or after the signal close.
export function plan(sg, fillOpen, cost = COST) {
  const d = sg.d, buf = cost / 2, stopR = d > 0 ? sg.box.lo - buf : sg.box.hi + buf;
  if (!(d * (sg.c0 - stopR) >= 2 * cost)) return null;
  const s = -d, stop = 2 * sg.c0 - stopR, risk = s * (fillOpen - stop);
  if (!(risk > 0) || !(risk >= cost) || !(risk >= 2 * cost)) return null;
  return { s, fill: fillOpen, stop, risk };
}

// ─── barriers ───
// the moment (a candle's close) a zone is broken: the first candle of its timeframe, from `known` on, closing through its far side
export function brokenAt(z, H, sec) {
  let lo = 0, hi = H.length; while (lo < hi) { const m = (lo + hi) >> 1; if (H[m].time < z.known) lo = m + 1; else hi = m; }
  for (let k = lo; k < H.length; k++) if (z.dir > 0 ? H[k].close < z.lo : H[k].close > z.hi) return H[k].time + sec;
  return null;
}
// the desk's watch: 60 candles of the barrier's confirmation timeframe (BARRIER, BARRIER30, BARRIER_WATCH of assets/mosha-sop.js)
export const WATCH = { '1d': 60 * 3600, '4h': 60 * 900, '1h': 60 * 300, '30m': 60 * 300, '15m': 60 * 60 };
const lb = (A, t) => { let lo = 0, hi = A.length; while (lo < hi) { const m = (lo + hi) >> 1; if (A[m].time < t) lo = m + 1; else hi = m; } return lo; };
// the returns of price to a zone (the amendment): the close of each 5-minute candle that trades into it while it waits for
// one. It waits from `known`, and again once a candle of its own timeframe (H) has closed wholly outside it on the near side.
// Each return is decided by candles closed at or before it. Before the 5-minute candles on file a return is read on H (old).
export function returnsOf(z, H, sec, D5, life) {
  const out = [], first5 = D5.length ? D5[0].time : Infinity, lim = z.known + life, into = (b) => (z.dir > 0 ? b.low <= z.hi : b.high >= z.lo);
  let waiting = true, i = lb(D5, z.known), k = lb(H, z.known), ended = false;
  const scan5 = (until) => { for (; i < D5.length && D5[i].time < until; i++) { if (D5[i].time > lim) { ended = true; return; } if (waiting && into(D5[i])) { out.push(D5[i].time + 300); waiting = false; } } };
  for (; k < H.length && !ended; k++) { const c = H[k]; if (c.time > lim) { ended = true; break; }
    if (c.time >= first5) scan5(c.time + sec); else if (waiting && into(c)) waiting = false;
    if (z.dir > 0 ? c.close < z.lo : c.close > z.hi) return out;                 // broken at this close: no return after it
    if (z.dir > 0 ? c.low > z.hi : c.high < z.lo) waiting = true; }
  if (!ended) scan5(Infinity);                                                     // the 5-minute candles after the last closed candle of H
  return out;
}
export function zonesFor(B, F1) {
  const out = [];
  for (const tf of TFS) for (const z of SOP.zonesOf(tf, B, F1, {})) {
    if (!(z.hi - z.lo > ZMIN)) continue;
    const q = { tf, dir: z.dir, lo: z.lo, hi: z.hi, kind: z.kind, known: z.known, broken: brokenAt(z, B[tf], SOP.SEC[tf]) };
    q.returns = returnsOf(q, B[tf], SOP.SEC[tf], B['5m'], SOP.BACK[tf] * DAY);
    if (q.returns.length) out.push(q);
  }
  return out;
}
// in play at t: price returned to the zone at or before t, within the desk's watch
export function inPlay(z, t) { const w = WATCH[z.tf]; for (let i = z.returns.length - 1; i >= 0; i--) { const r = z.returns[i]; if (r <= t) return t < r + w; } return false; }
// the standing zones of side `side` in play that the fill is at, at the moment t (only what was known and closed by t)
export function atBarrier(zones, t, fill, side, atr) {
  const pad = NEAR * atr, hit = [];
  for (const z of zones) {
    if (z.dir !== side || z.known > t || t - z.known > SOP.BACK[z.tf] * DAY) continue;
    if (z.broken != null && z.broken <= t) continue;
    if (!inPlay(z, t)) continue;
    if (side > 0 ? fill >= z.lo && fill <= z.hi + pad : fill >= z.lo - pad && fill <= z.hi) hit.push(z);
  }
  hit.sort((a, b) => TFS.indexOf(a.tf) - TFS.indexOf(b.tf) || b.known - a.known);
  return hit;
}
export function atr14(bars, i) {
  if (i < 14) return null; let s = 0;
  for (let k = i - 13; k <= i; k++) { const b = bars[k], pc = bars[k - 1].close; s += Math.max(b.high - b.low, Math.abs(b.high - pc), Math.abs(b.low - pc)); }
  return s / 14;
}
const lastClosed = (bars, sec, t) => { let lo = 0, hi = bars.length; while (lo < hi) { const m = (lo + hi) >> 1; if (bars[m].time + sec <= t) lo = m + 1; else hi = m; } return lo - 1; };

// ─── one stretch of candles: every Box fade signal (any hour), its tags and both exits ───
export function candles(Y, end = T(Y + 1) + TAIL) {
  const M5 = K.load('xau', '5m', { from: T(Y - 1), to: end }).filter((b) => b.e <= end);
  const back = (tf) => T(Y) - SOP.BACK[tf] * DAY, D5 = M5.map(toDesk), B = { '5m': D5 };
  B['1d'] = K.load('xau', '1d', { from: back('1d'), to: end }).map(toDesk).filter((b) => b.time + DAY <= end);
  for (const [tf, sec] of [['15m', 900], ['30m', 1800], ['1h', 3600], ['4h', 14400]]) B[tf] = group(D5.filter((b) => b.time >= back(tf)), sec);
  return { M5, B };
}
export function rowsOf({ M5, B }, F1, from, to) {
  const c = CELLS.F1, zones = zonesFor(B, F1), rows = []; let wrong = 0;
  for (const sg of BOX.signals(frames(M5), { from, to })) {
    if (sg.ch !== c.ch || sg.trig !== c.trig) continue;
    const fi = startIdx(M5, sg.ts); if (fi >= M5.length) continue;
    const ft = M5[fi].t; if (ft < from || ft >= to) continue;
    const p = plan(sg, M5[fi].o); if (!p) continue;
    if (!(p.s * (p.fill - p.stop) > 0)) { wrong++; continue; }
    const ai = lastClosed(B['15m'], 900, sg.ts), a = ai >= 0 ? atr14(B['15m'], ai) : null; if (a == null) continue;
    const same = atBarrier(zones, sg.ts, p.fill, p.s, a), opp = atBarrier(zones, sg.ts, p.fill, -p.s, a);
    const o6 = walk(M5, p.s, fi, p.fill, p.stop, p.fill + p.s * RR * p.risk, ft + HOLD, true);
    const o1 = walk(M5, p.s, fi, p.fill, p.stop, p.fill + p.s * BOX_RR * p.risk, ft + BOX_HOLD, true);
    rows.push({ ts: sg.ts, t: ft, s: p.s, fill: p.fill, stop: p.stop, risk: p.risk, sess: sg.sess, atr: a,
      at: same.length ? { tf: same[0].tf, kind: same[0].kind, n: same.length } : null, opp: opp.length > 0,
      R6: o6.R, end6: o6.endT, st6: o6.status, R1: o1.R, end1: o1.endT, st1: o1.status });
  }
  return { rows, zones: zones.length, wrong };
}
async function fns() { const { loadFns } = await import('../../../council/mosha-desk.mjs'); return SOP.oneCandle(loadFns()); }
async function year(Y, dir) {
  const t0 = Date.now(), F1 = await fns(), C = candles(Y), r = rowsOf(C, F1, T(Y), T(Y + 1));
  fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(path.join(dir, `y${Y}.json`), JSON.stringify({ year: Y, zones: r.zones, wrong: r.wrong, last: C.M5[C.M5.length - 1].e, rows: r.rows }));
  console.log(Y, r.rows.length, 'signals', r.rows.filter((x) => x.at).length, 'at a barrier', r.zones, 'zones', ((Date.now() - t0) / 1000).toFixed(0) + 's');
}
// cut test: the trades closed before a moment are the same when every candle after it is removed
async function cutTest(Y, dir) {
  const F1 = await fns(), at = T(Y) + 120 * DAY, full = candles(Y, at + 40 * DAY), short = candles(Y, at);
  const sig = (C) => rowsOf(C, F1, T(Y), at).rows.filter((r) => r.end6 != null && r.end6 + 300 <= at)
    .map((r) => [r.s, r.t, r.fill, r.stop, r.sess, r.at ? r.at.tf + r.at.kind + r.at.n : '-', r.opp, r.R6, r.end6, r.R1, r.end1].join('|')).sort();
  const a = sig(full), b = sig(short), out = { year: Y, at: new Date(at * 1000).toISOString(), full: a.length, cut: b.length, atBarrier: a.filter((x) => !x.includes('|-|')).length, same: a.length === b.length && a.every((x, i) => x === b[i]) };
  console.log('cut', out); fs.mkdirSync(dir, { recursive: true }); fs.writeFileSync(path.join(dir, `cut${Y}.json`), JSON.stringify(out));
}

// ─── streams and statistics ───
// one position at a time: a signal whose fill comes before the open trade's exit candle has ended is not taken
export function oneAtATime(rows, Rk, endK) {
  const out = []; let free = -Infinity, skipped = 0, open = 0;
  for (const r of [...rows].sort((a, b) => a.t - b.t)) {
    if (r.t < free) { skipped++; continue; }
    if (r[Rk] == null) { open++; free = Infinity; continue; }
    out.push({ t: r.t, R: r[Rk], risk: r.risk, tf: r.at ? r.at.tf : null, kind: r.at ? r.at.kind : null }); free = r[endK] + 300;
  }
  return { trades: out, skipped, open };
}
const monthOf = (t) => new Date(t * 1000).toISOString().slice(0, 7);
export function monthT(rows, f) {
  const m = new Map(); for (const r of rows) m.set(monthOf(r.t), (m.get(monthOf(r.t)) || 0) + f(r));
  const v = [...m.values()]; if (v.length < 2) return { months: v.length, t: null };
  const mm = v.reduce((a, b) => a + b, 0) / v.length, sd = Math.sqrt(v.reduce((a, b) => a + (b - mm) ** 2, 0) / (v.length - 1));
  return { months: v.length, t: sd > 0 ? +(mm / (sd / Math.sqrt(v.length))).toFixed(2) : null };
}
const net = (r, k = 1) => r.R - (k * COST) / r.risk;
const median = (v) => { if (!v.length) return null; const s = [...v].sort((a, b) => a - b), i = s.length >> 1; return s.length % 2 ? s[i] : (s[i - 1] + s[i]) / 2; };
export function stats(rows) {
  const n = rows.length; if (!n) return { n: 0, win: null, gross: null, net: null, net2: null, t: null, months: 0, costShare: null, total: null };
  const mean = (f) => rows.reduce((s, r) => s + f(r), 0) / n, mt = monthT(rows, (r) => net(r));
  return { n, win: +(100 * rows.filter((r) => r.R > 0).length / n).toFixed(1), gross: +mean((r) => r.R).toFixed(4), net: +mean((r) => net(r)).toFixed(4), net2: +mean((r) => net(r, 2)).toFixed(4),
    t: mt.t, months: mt.months, costShare: +median(rows.map((r) => COST / r.risk)).toFixed(3), total: +rows.reduce((s, r) => s + net(r), 0).toFixed(1) };
}
export function welch(a, b) {
  if (a.length < 2 || b.length < 2) return null;
  const m = (v) => v.reduce((x, y) => x + y, 0) / v.length, va = (v, mm) => v.reduce((x, y) => x + (y - mm) ** 2, 0) / (v.length - 1);
  const ma = m(a), mb = m(b), se = Math.sqrt(va(a, ma) / a.length + va(b, mb) / b.length);
  return se > 0 ? +((ma - mb) / se).toFixed(2) : null;
}
const inW = (r, w) => r.t >= w[0] && r.t < w[1];
const both = (trades) => ({ is: stats(trades.filter((r) => inW(r, IS))), oos: stats(trades.filter((r) => inW(r, OOS))) });

// the pre-registered bar
export function judge(P, w) {
  const checks = { n: P.oos.n >= MIN_N, mean: (P.oos.net ?? -1) > 0, monthT: (P.oos.t ?? 0) >= 2, inSample: (P.is.net ?? -1) > 0, twiceCost: (P.oos.net2 ?? -1) > 0, beatsC1: (w ?? 0) >= 2 };
  return { checks, verdict: !checks.n ? 'TOO FEW' : Object.values(checks).every(Boolean) ? 'PASS' : 'FAIL' };
}

function report(dir, m6q) {
  const files = YEARS.map((y) => JSON.parse(fs.readFileSync(path.join(dir, `y${y}.json`), 'utf8')));
  const all = files.flatMap((f) => f.rows).filter((r) => r.t >= IS[0] && r.t < OOS[1]), own = all.filter((r) => r.sess === CELLS.F1.sess);
  const S = { primary: oneAtATime(own.filter((r) => r.at), 'R6', 'end6'), C1: oneAtATime(own.filter((r) => !r.at), 'R6', 'end6'),
    C3: oneAtATime(own.filter((r) => r.at), 'R1', 'end1'), opposite: oneAtATime(own.filter((r) => r.opp && !r.at), 'R6', 'end6'),
    anyHour: oneAtATime(all.filter((r) => r.at), 'R6', 'end6') };
  const streams = Object.fromEntries(Object.entries(S).map(([k, v]) => [k, { ...both(v.trades), skippedOpenPosition: v.skipped, stillOpen: v.open }]));
  // C2: the desk's own 6R barrier entries (mosha-6r-quality's year files), every entry, net of the same cost
  let c2 = null;
  if (m6q && fs.existsSync(path.join(m6q, 'y2018.json'))) {
    const rows = YEARS.flatMap((y) => JSON.parse(fs.readFileSync(path.join(m6q, `y${y}.json`), 'utf8')).rows).filter((r) => r.R != null).map((r) => ({ t: r.t, R: r.R, risk: r.r0 }));
    c2 = both(rows);
  }
  const P = streams.primary, oosOf = (k) => S[k].trades.filter((r) => inW(r, OOS)).map((r) => net(r));
  const w = welch(oosOf('primary'), oosOf('C1')), wIs = welch(S.primary.trades.filter((r) => inW(r, IS)).map((r) => net(r)), S.C1.trades.filter((r) => inW(r, IS)).map((r) => net(r)));
  const J = judge(P, w);
  const split = (rows, f) => { const m = {}; for (const r of rows) (m[f(r)] ||= []).push(r); return Object.fromEntries(Object.entries(m).sort().map(([k, v]) => [k, stats(v)])); };
  const pt = S.primary.trades, byYear = split(pt, (r) => String(new Date(r.t * 1000).getUTCFullYear())), byTf = split(pt, (r) => r.tf), byKind = split(pt, (r) => r.kind);
  const c1Year = split(S.C1.trades, (r) => String(new Date(r.t * 1000).getUTCFullYear()));
  const cuts = YEARS.map((y) => path.join(dir, `cut${y}.json`)).filter((f) => fs.existsSync(f)).map((f) => JSON.parse(fs.readFileSync(f, 'utf8')));
  const counts = { signalsAnyHour: all.length, signalsOwnHours: own.length, atBarrier: own.filter((r) => r.at).length, notAtBarrier: own.filter((r) => !r.at).length, stopWrongSide: files.reduce((s, f) => s + f.wrong, 0), zones: Object.fromEntries(files.map((f) => [f.year, f.zones])) };
  const headline = `The Box fade entry at a Mosha barrier with a 6R target made ${f(P.oos.net)}R a trade after costs on gold out of sample, 2022 to Oct 2026 (n ${P.oos.n}, month t ${P.oos.t ?? 'n/a'}). Before costs ${f(P.oos.gross)}R, ${P.oos.win}% winners; in sample 2018-21 ${f(P.is.net)}R (n ${P.is.n}); the same signals away from a barrier ${f(streams.C1.oos.net)}R (n ${streams.C1.oos.n}), Welch t ${w ?? 'n/a'}`;
  const res = { study: 'boxfade-barrier-6r', built: new Date().toISOString().slice(0, 10), verdict: J.verdict, headline,
    system: 'The Equinox Box fade signal (grid6-box-in-box signals, the fade-breaks-holdout F1 cell, its 07-17 UTC filter kept) taken only at a standing Mosha barrier zone of its own side (assets/mosha-sop.js zonesOf, one-candle structure, D1 to M15; inside it or within 0.25 x ATR(14, M15) of its near edge), the Box fade stop, a 6R target, out after 5 days, one position at a time; gold OANDA mid M5; in sample 2018-21, out of sample 2022 to Oct 2026; $0.30 a round trip.',
    market: 'xau', cost: COST, rr: RR, windows: { inSample: '2018-01-01 to 2021-12-31', outOfSample: '2022-01-01 to 2026-10-31' },
    checks: J.checks, welchVsC1: { oos: w, inSample: wIs }, counts, streams, C2: c2, byYear, c1ByYear: c1Year, byTimeframe: byTf, byKind, cutTest: cuts };
  fs.writeFileSync(path.join(HERE, 'result.json'), JSON.stringify(res, null, 1) + '\n');
  fs.writeFileSync(path.join(HERE, 'RESULT.md'), markdown(res));
  console.log(J.verdict, headline);
}
function f(v, d = 3) { return v == null ? 'n/a' : (v >= 0 ? '+' : '−') + Math.abs(v).toFixed(d); }
export function markdown(res) {
  const L = [], st = res.streams, row = (name, x) => `| ${name} | ${x.n} | ${x.win ?? 'n/a'} | ${f(x.gross)} | ${f(x.net)} | ${x.t ?? 'n/a'} | ${f(x.net2)} | ${x.costShare ?? 'n/a'} |`;
  const head = ['| Stream | n | win % | R before costs | R after costs | month t | at 2x cost | cost / risk (median) |', '|---|---|---|---|---|---|---|---|'];
  const names = [['primary', 'Primary: Box fade at a barrier of its side, 6R'], ['C1', 'C1: Box fade NOT at a barrier, 6R'], ['C2', 'C2: the desk\'s own 6R barrier entries (every entry)'], ['C3', 'C3: Box fade at a barrier, its own 1R / 1 day exit'], ['opposite', 'Context: at a barrier of the opposite side only, 6R'], ['anyHour', 'Context: primary with the hours filter dropped, 6R']];
  const get = (k) => (k === 'C2' ? res.C2 : st[k]);
  const c = res.checks, yn = (b) => (b ? 'yes' : 'no'), P = st.primary, k = res.counts;
  L.push('# A Box fade signal as the entry at a Mosha barrier, 6R target, gold 2018-2026', '',
    `**Verdict: ${res.verdict}. ${res.headline}.**`, '',
    `Built ${res.built}. Pre-registered (PREREGISTRATION.md, committed alone before any run; one amendment, committed alone before any result was read: see "The amendment" below). Paper research only; nothing live changed.`, '',
    '## What it means', '',
    `- **The idea does not make money after costs.** Out of sample the Box fade entry at a barrier with a 6R target made ${f(P.oos.gross)}R a trade before costs and ${f(P.oos.net)}R after them (n ${P.oos.n}, month t ${P.oos.t ?? 'n/a'}); in sample it lost (${f(P.is.net)}R, n ${P.is.n}). At twice the cost it loses in both windows. It wins about ${P.oos.win}% of the time, which is roughly what a 6R target needs just to break even after costs (about one in six).`,
    `- **"At a barrier" selects almost nothing.** ${k.atBarrier} of the ${k.signalsOwnHours} Box fade signals (${(100 * k.atBarrier / k.signalsOwnHours).toFixed(0)}%) are at a standing barrier of their own side that price had just come back to. The desk draws so many zones (BO, iBO and engulf boxes on five timeframes, about 17,000 a year) that price is nearly always at one. So the barrier adds little: this is close to "the Box fade with a 6R target".`,
    `- **The barrier did not pick the better trades.** At a barrier against not at one: Welch t ${res.welchVsC1.oos ?? 'n/a'} out of sample and ${res.welchVsC1.inSample ?? 'n/a'} in sample (the sign flips between the two windows; C1 is small, ${st.C1.oos.n} and ${st.C1.is.n} trades).`,
    `- **Against the desk's own barrier entry (C2)** the Box fade entry loses less after costs (${f(P.oos.net)}R against ${f(res.C2 ? res.C2.oos.net : null)}R out of sample), mostly because its stop is wider, so the cost is a smaller share of the risk (${P.oos.costShare} against ${res.C2 ? res.C2.oos.costShare : 'n/a'}, median). Losing less is not making money.`,
    `- **The 6R target against the Box fade's own 1R exit (C3):** ${f(P.oos.net)}R against ${f(st.C3.oos.net)}R out of sample, ${f(P.is.net)}R against ${f(st.C3.is.net)}R in sample: the far target is not reliably better, and both are at or below zero after costs.`,
    '- The splits by year, timeframe and kind below are descriptive. No row is a rule: the best-looking ones are small (the M15 row, 2024, 2026) and were not chosen before the run.',
    '- Nothing live changed. The Box fade desk and the Mosha 6R barrier demo copy are as they were.', '',
    '## The pre-registered bar (out of sample, after costs)', '',
    '| Check | Needed | Got | Met |', '|---|---|---|---|',
    `| Trades | n >= 100 | ${st.primary.oos.n} | ${yn(c.n)} |`,
    `| Mean R after costs | > 0 | ${f(st.primary.oos.net)} | ${yn(c.mean)} |`,
    `| t of calendar-month sums | >= 2 | ${st.primary.oos.t ?? 'n/a'} | ${yn(c.monthT)} |`,
    `| In sample mean R after costs | > 0 | ${f(st.primary.is.net)} | ${yn(c.inSample)} |`,
    `| Mean R at twice the cost | > 0 | ${f(st.primary.oos.net2)} | ${yn(c.twiceCost)} |`,
    `| Better than C1 (Welch t, per trade) | >= 2 | ${res.welchVsC1.oos ?? 'n/a'} | ${yn(c.beatsC1)} |`, '',
    '## Out of sample: fills 2022-01-01 to 2026-10-31', '', ...head);
  for (const [k, n] of names) if (get(k)) L.push(row(n, get(k).oos));
  L.push('', '## In sample: fills 2018-01-01 to 2021-12-31', '', ...head);
  for (const [k, n] of names) if (get(k)) L.push(row(n, get(k).is));
  L.push('', `Welch t of the primary against C1, per-trade R after costs: out of sample ${res.welchVsC1.oos ?? 'n/a'}, in sample ${res.welchVsC1.inSample ?? 'n/a'}.`);
  const tbl = (title, m, order) => { L.push('', `## ${title}`, '', '| | n | win % | R before costs | R after costs | month t |', '|---|---|---|---|---|---|');
    for (const k of (order || Object.keys(m)).filter((k) => m[k])) L.push(`| ${k} | ${m[k].n} | ${m[k].win} | ${f(m[k].gross)} | ${f(m[k].net)} | ${m[k].t ?? 'n/a'} |`); };
  tbl('Primary by year (both windows)', res.byYear);
  tbl('C1 by year (both windows)', res.c1ByYear);
  tbl('Primary by the barrier\'s timeframe (both windows; the highest timeframe when several zones qualify)', res.byTimeframe, TFS);
  tbl('Primary by the barrier\'s kind (both windows)', res.byKind, ['bo', 'ibo', 'eg']);
  L.push('', '## The amendment', '',
    'As first written, a zone counted for as long as it stood unbroken (up to 1,500 days for a daily zone). A first run of one year counted the signals that qualified, and nothing else (no result of any trade was printed or read): 1,995 of 2,009. The condition was tightened, in a commit of its own before any result was read, to the desk\'s own use of a barrier: price must have come back to the zone within the desk\'s watch (60 candles of the barrier\'s confirmation timeframe: D1 60 hours, H4 15 hours, H1 and M30 5 hours, M15 1 hour). Even so about nine signals in ten qualify. No further change was made.');
  L.push('', '## Counts and notes', '',
    `- Box fade signals 2018 to Oct 2026 after the skips: ${k.signalsOwnHours} in the rule's own hours (${k.signalsAnyHour} at any hour); ${k.atBarrier} at a standing barrier of their side, ${k.notAtBarrier} not.`,
    `- One position at a time: the primary skipped ${st.primary.skippedOpenPosition} at-barrier signals that came while its trade was open (C1 ${st.C1.skippedOpenPosition}, C3 ${st.C3.skippedOpenPosition}). Still open at the end of the candles and left out: primary ${st.primary.stillOpen}, C1 ${st.C1.stillOpen}, C3 ${st.C3.stillOpen}.`,
    `- A stop on the wrong side of its fill: ${k.stopWrongSide} (such a trade does not exist).`,
    `- Cost: $${res.cost.toFixed(2)} a round trip, R − ${res.cost.toFixed(2)} / filled risk; a trade whose filled risk is under $${(2 * res.cost).toFixed(2)} is skipped.`,
    '- C2 counts every desk entry (several open at once), as mosha-6r-quality did; the Box fade streams hold one position at a time.',
    `- Cut test: ${res.cutTest.length ? res.cutTest.map((x) => `${x.year} at ${x.at.slice(0, 10)}: ${x.full} trades closed before the cut (${x.atBarrier} at a barrier), ${x.same ? 'identical with the later candles removed' : 'DIFFERENT'}`).join('; ') : 'not run'}.`,
    '- Not built, as the pre-registration says: the swept-swing barriers and the CF / VR zones the sequence hands over (no "broken" moment of their own in the desk\'s code). The barriers here are the BO / iBO origin boxes and the engulf boxes of D1, H4, H1, M30 and M15.',
    '- No variant is tested on these years after this run.');
  return L.join('\n') + '\n';
}

if (process.argv[1] && fileURLToPath(import.meta.url) === path.resolve(process.argv[1])) {
  const [cmd, a, b, c] = process.argv.slice(2);
  if (cmd === 'year') await year(+a, b); else if (cmd === 'cut') await cutTest(+a, b); else if (cmd === 'report') report(a, b);
  else if (cmd === 'markdown') fs.writeFileSync(path.join(HERE, 'RESULT.md'), markdown(JSON.parse(fs.readFileSync(path.join(HERE, 'result.json'), 'utf8'))));
  void c;
}
