// research/edge/direction-chain-gate/run.mjs - the timeframe-chain direction gate study (pre-registered 23 Nov 2026).
// Research only: reads the toolkit's candle cache, places nothing, reads no council file but council/fills.mjs (financing).
//   node research/edge/direction-chain-gate/run.mjs            -> result.json, trades.json (needs the candle cache)
// Everything below follows PREREGISTRATION.md; nothing is tuned. Interpretive choices the pre-registration leaves open are
// named in CHOICES and in RESULT.md.
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import * as K from '../_lib/edgekit.mjs';
import { nights, FIN } from '../../../council/fills.mjs';

const HERE = path.dirname(fileURLToPath(import.meta.url));
export const P = { K: 3, RR: 2, HOLD: 48 * 3600, MINSTOP: 5, TAP_WIN: 20 };
export const WIN = {
  REP: [Date.UTC(2010, 0, 1) / 1000, Date.UTC(2020, 0, 1) / 1000],
  IS: [Date.UTC(2020, 0, 1) / 1000, Date.UTC(2024, 0, 1) / 1000],
  OOS: [Date.UTC(2024, 0, 1) / 1000, Date.UTC(2026, 10, 14) / 1000],
};
export const CHOICES = [
  'Entries Monday to Friday = the UTC weekday of the fill.',
  'A tap = a working candle whose range touches a swing level (low <= level <= high) or overlaps an alive engulf zone. Swing levels stay usable for the rest of the history once known.',
  'The tap candle itself may be the one that closes beyond the reference swing (the 20-candle window is the tap candle and the 20 after it).',
  'Weekly candles = the Daily (17:00 New York) candles grouped by the Monday of their date; a week closes with its last Daily candle.',
  'Month-sum difference (T2 / T4) = the mean over calendar months of (agree month sum - disagree month sum), months with no trade = 0.',
  'One open position at a time per market and stream: a candidate is taken only if its fill is at or after the previous taken trade\'s exit.',
  'Windows are by fill time; month sums by exit month (edgekit.stats).',
];

// ---- weekly from daily (Monday weeks) ----------------------------------------------------------------------------
export function weekly(D) {
  const out = []; let cur = null;
  for (const d of D) {
    const day = Date.parse(d.date + 'T00:00:00Z') / 86400e3; const wd = new Date(day * 86400e3).getUTCDay();
    const key = day - ((wd + 6) % 7);
    if (!cur || cur.key !== key) { cur = { key, t: d.t, o: d.o, h: d.h, l: d.l, c: d.c, e: d.e }; out.push(cur); }
    else { if (d.h > cur.h) cur.h = d.h; if (d.l < cur.l) cur.l = d.l; cur.c = d.c; cur.e = d.e; }
  }
  return out;
}

// ---- Gate B: the direction procedure on one working timeframe ----------------------------------------------------
// Key levels of HT: swing highs (resistance) / lows (support), known at ct; two-candle engulf zones known at the second
// candle's close, alive until an HT candle closes through the far side. Returns side[] for W (0 until the first switch).
export function procedureSide(W, HT, Kn = P.K, win = P.TAP_WIN) {
  const hs = K.swings(HT, Kn); const lv = hs.map((s) => ({ at: s.ct, px: s.price, sup: s.type === 'L' })).sort((a, b) => a.at - b.at);
  const zs = [];
  for (let i = 1; i < HT.length; i++) {
    const a = HT[i - 1], b = HT[i];
    if (b.c > a.h) zs.push({ at: b.e, lo: a.l, hi: a.h, sup: true, from: i });
    else if (b.c < a.l) zs.push({ at: b.e, lo: a.l, hi: a.h, sup: false, from: i });
  }
  // when each zone dies: first HT candle after its second candle closing through the far side
  for (const z of zs) { z.dead = Infinity; for (let j = z.from + 1; j < HT.length; j++) { const c = HT[j].c; if (z.sup ? c < z.lo : c > z.hi) { z.dead = HT[j].e; break; } } }
  zs.sort((a, b) => a.at - b.at);
  const wsw = K.swings(W, Kn).sort((a, b) => a.ct - b.ct);
  const side = new Array(W.length).fill(0);
  const sorted = { sup: [], res: [] }; // swing levels known so far, sorted by price
  const ins = (arr, px) => { let lo = 0, hi = arr.length; while (lo < hi) { const m = (lo + hi) >> 1; if (arr[m] < px) lo = m + 1; else hi = m; } arr.splice(lo, 0, px); };
  const anyIn = (arr, l, h) => { let lo = 0, hi = arr.length; while (lo < hi) { const m = (lo + hi) >> 1; if (arr[m] < l) lo = m + 1; else hi = m; } return lo < arr.length && arr[lo] <= h; };
  let li = 0, zi = 0, si = 0; const alive = []; let lastH = null, lastL = null; let s = 0;
  const pendUp = [], pendDn = [];
  for (let j = 0; j < W.length; j++) {
    const b = W[j];
    // knowledge at the START of candle j for the reference swings, at its close for levels (a level must be known by the
    // time the candle trades into it: we take levels known by the candle's start, conservative)
    while (li < lv.length && lv[li].at <= b.t) { ins(lv[li].sup ? sorted.sup : sorted.res, lv[li].px); li++; }
    while (zi < zs.length && zs[zi].at <= b.t) alive.push(zs[zi++]);
    while (si < wsw.length && wsw[si].ct <= b.t) { const x = wsw[si++]; if (x.type === 'H') lastH = x.price; else lastL = x.price; }
    let supTap = anyIn(sorted.sup, b.l, b.h), resTap = anyIn(sorted.res, b.l, b.h);
    if (!supTap || !resTap) for (let k = alive.length - 1; k >= 0; k--) {
      const z = alive[k]; if (z.dead <= b.t) { alive.splice(k, 1); continue; }
      if (b.l <= z.hi && b.h >= z.lo) { if (z.sup) supTap = true; else resTap = true; if (supTap && resTap) break; }
    }
    if (supTap && lastH != null) pendUp.push({ exp: j + win, lv: lastH });
    if (resTap && lastL != null) pendDn.push({ exp: j + win, lv: lastL });
    while (pendUp.length && pendUp[0].exp < j) pendUp.shift();
    while (pendDn.length && pendDn[0].exp < j) pendDn.shift();
    const up = pendUp.some((p) => b.c > p.lv), dn = pendDn.some((p) => b.c < p.lv);
    if (up && !dn) s = 1; else if (dn && !up) s = -1;
    side[j] = s;
  }
  return side;
}

const sideAt = (bars, side, t) => { const n = K.closedCount(bars, t); return n ? side[n - 1] : 0; };

// ---- candidates for one market -----------------------------------------------------------------------------------
export function candidates(market, M5, { cost = K.COSTS[market] } = {}) {
  const H1 = K.resample(M5, 3600), H4 = K.resample(M5, 14400), D = K.dailyNY(M5), Wk = weekly(D);
  const last = M5.length ? M5[M5.length - 1].e : 0;
  // only closed resampled candles count: a bucket whose end is after the last 5m close is still forming
  const closed = (a) => a.filter((x) => x.e <= last);
  const h1 = closed(H1), h4 = closed(H4), d = closed(D), wk = closed(Wk);
  const sH1 = K.structure(h1, P.K).side, sH4 = K.structure(h4, P.K).side, sD = K.structure(d, P.K).side;
  const bH1 = procedureSide(h1, h4), bH4 = procedureSide(h4, d), bD = procedureSide(d, wk);
  const boxes = K.boxesHL(h1, P.K).filter((x) => x.dir);
  const out = [];
  for (const bx of boxes) {
    const side = bx.dir; if (sH1[bx.bi] !== side) continue;
    const bt = bx.bt; const fi = (() => { let lo = 0, hi = M5.length; while (lo < hi) { const m = (lo + hi) >> 1; if (M5[m].t < bt) lo = m + 1; else hi = m; } return lo; })();
    if (fi >= M5.length) continue;
    const fill = M5[fi].o, fillT = M5[fi].t; const wd = new Date(fillT * 1000).getUTCDay(); if (wd === 0 || wd === 6) continue;
    const stop = side > 0 ? bx.lo : bx.hi; const risk = side * (fill - stop);
    if (!(risk > 0)) continue; if (risk < P.MINSTOP * cost) continue;
    const target = fill + side * P.RR * risk;
    const r = K.simulate({ side, entry: fill, stop, target, t: bt, type: 'market', maxHold: P.HOLD }, M5, {});
    if (r.status === 'open' || r.status === 'bad' || r.status === 'nofill') continue;
    const fin = market === 'xau' && side > 0 ? nights(r.fillT, r.exitT) * FIN.xau.long * r.fill / r.risk : 0;
    const cR = cost / r.risk + fin;
    const dS = sideAt(d, sD, bt), h4S = sideAt(h4, sH4, bt);
    const dB = sideAt(d, bD, bt), h4B = sideAt(h4, bH4, bt), h1B = bH1[bx.bi];
    out.push({ market, side, sig: bt, fillT: r.fillT, entry: r.fill, stop, target, exitT: r.exitT, exit: r.exit, reason: r.reason,
      R: r.R, Rnet: r.R - cR, Rnet2: r.R - 2 * cR, costR: cR,
      gA: dS === side && h4S === side ? 1 : 0, gB: dB === side && h4B === side && h1B === side ? 1 : 0,
      dS, h4S, dB, h4B, h1B });
  }
  return out;
}

// ---- streams, one open position at a time --------------------------------------------------------------------------
export function oneAtATime(list) {
  const xs = [...list].sort((a, b) => a.fillT - b.fillT || a.sig - b.sig); const out = []; let free = -Infinity;
  for (const x of xs) if (x.fillT >= free) { out.push(x); free = x.exitT; }
  return out;
}
export const STREAMS = {
  all: () => true, Aagree: (x) => x.gA === 1, Adis: (x) => x.gA === 0, Bagree: (x) => x.gB === 1, Bdis: (x) => x.gB === 0,
};
export function streamsOf(cands) {
  const by = {}; for (const k of Object.keys(STREAMS)) by[k] = [];
  const mk = [...new Set(cands.map((x) => x.market))];
  for (const m of mk) { const c = cands.filter((x) => x.market === m); for (const [k, f] of Object.entries(STREAMS)) by[k].push(...oneAtATime(c.filter(f))); }
  return by;
}

const inWin = (xs, w) => xs.filter((x) => x.fillT >= w[0] && x.fillT < w[1]);
function sumUp(xs, key) {
  const s = K.stats(xs, { key, time: 'exitT' });
  return { n: s.n, wins: s.wins, total: +s.total.toFixed(3), meanR: s.meanR == null ? null : +s.meanR.toFixed(4),
    tTrade: s.tTrade == null ? null : +s.tTrade.toFixed(2), tMonth: s.tMonth == null ? null : +s.tMonth.toFixed(2),
    pMonth: s.pMonth, months: s.months, maxDD: +s.maxDD.toFixed(2) };
}
export function welch(a, b) {
  const m = (x) => x.reduce((p, q) => p + q, 0) / x.length; const v = (x, mu) => x.reduce((p, q) => p + (q - mu) ** 2, 0) / (x.length - 1);
  if (a.length < 2 || b.length < 2) return { diff: null, t: null, p: null, df: null };
  const ma = m(a), mb = m(b), va = v(a, ma), vb = v(b, mb); const se = Math.sqrt(va / a.length + vb / b.length);
  const t = (ma - mb) / se; const df = (va / a.length + vb / b.length) ** 2 / ((va / a.length) ** 2 / (a.length - 1) + (vb / b.length) ** 2 / (b.length - 1));
  return { diff: ma - mb, t, p: K.pFromT(t, df), df };
}
function monthDiff(a, b, key, w) {
  const mk = (t) => new Date(t * 1000).toISOString().slice(0, 7); const S = new Map();
  for (const x of a) S.set(mk(x.exitT), (S.get(mk(x.exitT)) || 0) + x[key]);
  for (const x of b) S.set(mk(x.exitT), (S.get(mk(x.exitT)) || 0) - x[key]);
  // every calendar month of the window
  const d0 = new Date(w[0] * 1000), d1 = new Date(w[1] * 1000); const vals = [];
  for (let y = d0.getUTCFullYear(), mo = d0.getUTCMonth(); y < d1.getUTCFullYear() || (y === d1.getUTCFullYear() && mo <= d1.getUTCMonth()); mo === 11 ? (y++, mo = 0) : mo++) {
    vals.push(S.get(`${y}-${String(mo + 1).padStart(2, '0')}`) || 0);
  }
  return vals.length ? vals.reduce((p, q) => p + q, 0) / vals.length : null;
}

export function analyse(cands) {
  const S = streamsOf(cands);
  const win = (k, w, key = 'Rnet') => sumUp(inWin(S[k], w), key);
  const streams = {};
  for (const k of Object.keys(STREAMS)) streams[k] = {
    OOS: win(k, WIN.OOS), IS: win(k, WIN.IS), REP: win(k, WIN.REP), OOS2x: win(k, WIN.OOS, 'Rnet2'), OOSgross: win(k, WIN.OOS, 'R'),
    ISgross: win(k, WIN.IS, 'R'), REPgross: win(k, WIN.REP, 'R'),
  };
  const level = (k) => { const s = streams[k]; return { OOS: s.OOS, IS: s.IS, REP: s.REP, OOS2x: s.OOS2x }; };
  const diff = (a, b) => {
    const out = {};
    for (const [nm, w] of Object.entries({ OOS: WIN.OOS, IS: WIN.IS, REP: WIN.REP })) {
      const A = inWin(S[a], w), B = inWin(S[b], w); const wl = welch(A.map((x) => x.Rnet), B.map((x) => x.Rnet));
      out[nm] = { nA: A.length, nB: B.length, diff: wl.diff == null ? null : +wl.diff.toFixed(4), t: wl.t == null ? null : +wl.t.toFixed(2), p: wl.p,
        monthDiff: (() => { const v = monthDiff(A, B, 'Rnet', w); return v == null ? null : +v.toFixed(4); })() };
    }
    return out;
  };
  const tests = { T1: level('Aagree'), T2: diff('Aagree', 'Adis'), T3: level('Bagree'), T4: diff('Bagree', 'Bdis') };
  const praw = [tests.T1.OOS.pMonth, tests.T2.OOS.p, tests.T3.OOS.pMonth, tests.T4.OOS.p];
  // one-sided direction enters through the bars (mean / t > 0); Holm on the two-sided p values as written
  const ph = K.holm(praw.map((p) => (p == null ? 1 : p)));
  const verdicts = {};
  const lev = (T, i) => {
    const o = T.OOS; const checks = {
      oosMean: o.meanR > 0, oosT: o.tMonth >= 2, holm: ph[i] < 0.05, isMean: T.IS.meanR > 0, oos2x: T.OOS2x.meanR > 0, n30: o.n >= 30 };
    const bar = Object.values(checks).every(Boolean); const rep = T.REP.meanR > 0;
    return { holmP: ph[i], checks, bar, replication: rep, verdict: o.n < 30 ? 'INCONCLUSIVE' : bar ? (rep ? 'PASS' : 'INCONCLUSIVE') : 'FAIL' };
  };
  const dif = (T, i) => {
    const o = T.OOS; const checks = { oosDiff: o.diff > 0, welchT: o.t >= 2, holm: ph[i] < 0.05, monthDiff: o.monthDiff > 0, isDiff: T.IS.diff > 0, n30: o.nA >= 30 && o.nB >= 30 };
    const bar = Object.values(checks).every(Boolean); const rep = T.REP.diff > 0;
    return { holmP: ph[i], checks, bar, replication: rep, verdict: o.nA < 30 || o.nB < 30 ? 'INCONCLUSIVE' : bar ? (rep ? 'PASS' : 'INCONCLUSIVE') : 'FAIL' };
  };
  verdicts.T1 = lev(tests.T1, 0); verdicts.T2 = dif(tests.T2, 1); verdicts.T3 = lev(tests.T3, 2); verdicts.T4 = dif(tests.T4, 3);
  const vs = Object.values(verdicts).map((v) => v.verdict);
  const verdict = vs.includes('PASS') ? 'PASS' : vs.includes('INCONCLUSIVE') ? 'INCONCLUSIVE' : 'FAIL';
  return { S, streams, tests, verdicts, verdict };
}

function report(cands, A) {
  const S = A.S;
  const sideSplit = (k) => ({ buys: sumUp(inWin(S[k].filter((x) => x.side > 0), WIN.OOS), 'Rnet'), sells: sumUp(inWin(S[k].filter((x) => x.side < 0), WIN.OOS), 'Rnet') });
  const exits = (k) => { const o = {}; for (const x of inWin(S[k], WIN.OOS)) o[x.reason] = (o[x.reason] || 0) + 1; return o; };
  const years = (k) => { const o = {}; for (const x of S[k]) { const y = new Date(x.fillT * 1000).getUTCFullYear(); (o[y] ||= { n: 0, total: 0 }); o[y].n++; o[y].total += x.Rnet; }
    for (const y of Object.keys(o)) { o[y].total = +o[y].total.toFixed(2); o[y].meanR = +(o[y].total / o[y].n).toFixed(3); } return o; };
  const per = {};
  for (const m of K.MARKETS) {
    const c = cands.filter((x) => x.market === m); const s = streamsOf(c); per[m] = {};
    for (const k of Object.keys(STREAMS)) per[m][k] = { OOS: sumUp(inWin(s[k], WIN.OOS), 'Rnet'), IS: sumUp(inWin(s[k], WIN.IS), 'Rnet'), REP: sumUp(inWin(s[k], WIN.REP), 'Rnet') };
  }
  const extra = {};
  for (const k of Object.keys(STREAMS)) extra[k] = { sides: sideSplit(k), exits: exits(k), years: years(k) };
  const gatedMinusAll = {
    A: +((A.streams.Aagree.OOS.meanR ?? 0) - (A.streams.all.OOS.meanR ?? 0)).toFixed(4),
    B: +((A.streams.Bagree.OOS.meanR ?? 0) - (A.streams.all.OOS.meanR ?? 0)).toFixed(4),
  };
  return { perMarket: per, extra, gatedMinusAll };
}

async function main() {
  const t0 = Date.now(); const cands = [];
  for (const m of K.MARKETS) {
    const M5 = K.load(m, '5m', { from: '2010-01-01' });
    const c = candidates(m, M5); cands.push(...c);
    console.log(m, M5.length, 'candles', c.length, 'candidates', ((Date.now() - t0) / 1000).toFixed(0) + 's');
  }
  const A = analyse(cands); const R = report(cands, A);
  const res = {
    study: 'direction-chain-gate', built: new Date().toISOString().slice(0, 10), verdict: A.verdict, params: P,
    windows: { REP: '2010-01-01..2019-12-31', IS: '2020-01-01..2023-12-31', OOS: '2024-01-01..2026-11-13' }, choices: CHOICES,
    costs: K.COSTS, financing: { xauLong: FIN.xau.long }, candidates: cands.length,
    verdicts: A.verdicts, tests: A.tests, streams: A.streams, ...R,
  };
  fs.writeFileSync(path.join(HERE, 'result.json'), JSON.stringify(res, null, 1));
  const keep = cands.map((x) => [x.market, x.side, x.fillT, +x.entry.toPrecision(7), +x.stop.toPrecision(7), +x.target.toPrecision(7), x.exitT,
    x.reason[0], +x.R.toFixed(3), +x.Rnet.toFixed(3), x.gA, x.gB, x.dS, x.h4S, x.dB, x.h4B, x.h1B]);
  fs.writeFileSync(path.join(HERE, 'trades.json'), JSON.stringify({ cols: ['market', 'side', 'fillT', 'entry', 'stop', 'target', 'exitT', 'exit(s/t/T)', 'R', 'Rnet', 'gateA', 'gateB', 'dailySide', 'h4Side', 'dailyProc', 'h4Proc', 'h1Proc'],
    note: 'every candidate signal (before the one-position-at-a-time rule, which each stream applies on its own list)', rows: keep }));
  console.log(JSON.stringify({ verdict: A.verdict, v: Object.fromEntries(Object.entries(A.verdicts).map(([k, v]) => [k, v.verdict])) }));
}
if (process.argv[1] && fileURLToPath(import.meta.url) === path.resolve(process.argv[1])) main();
