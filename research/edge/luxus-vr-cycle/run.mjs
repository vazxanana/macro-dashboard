// Edge research · luxus-vr-cycle (study 145): Luxus's own cycle from his lessons "10 nov, sell Gold" and "11 Nov buy", written as
// fixed rules. Test 1: with H4 AND H1 bullish (last BO a BO buy on each), price reaches a Level (a prior H4 / H1 / M30 high), an M5
// VR forms and its CF (a close below the VR) starts "a new cycle": sell on the return to the zone of the break, stop past the VR
// extreme, target the 50% of the H1 impulsion. Test 2: after that CF, the retracement reaches the 50%, an M5 VR forms at the low and
// its CF up is the buy with H4 and H1, target the impulsion's high. Test 3: both as one stream. Rule, costs, windows and the pass bar:
// PREREGISTRATION.md (committed alone before this file existed). Paper research for the owner only: nothing here trades, nothing
// live reads it, nothing is written to the Mosha desk.
//   node --use-env-proxy research/edge/mosha-sweep/run.mjs fetch <dir>   -> <dir>/xau-5m.json.gz (kept out of git)
//   CANDLES=<dir> node research/edge/luxus-vr-cycle/run.mjs run          -> result.json
import fs from 'node:fs';
import path from 'node:path';
import zlib from 'node:zlib';
import { fileURLToPath } from 'node:url';
import { swings, stat } from '../mosha-level/run.mjs';
import { agg } from '../mosha-sweep/run.mjs';
import { nights, FIN } from '../../../council/fills.mjs';

const D = (y, m, d) => Date.UTC(y, m - 1, d) / 1000;
export const K = { W: 2, W5: 1, LEVEL_AGE: 10 * 86400, EPISODE: 12 * 3600, VALID: 24 * 3600, HOLD: 72 * 3600, RETRACE: 72 * 3600, PAD: 0.30, COST: 0.60,
  M5: 300, M30: 1800, H1: 3600, H4: 14400, ATR: 14, SEEDS: 40, CTRL_DAYS: 5 };
export const WIN = { rep: [D(2007, 1, 1), D(2020, 1, 1)], is: [D(2020, 1, 1), D(2024, 1, 1)], oos: [D(2024, 1, 1), D(2026, 11, 1)] };
export const TESTS = { T1: 'sell at the zone of the break of an M5 VR at a Level, H4 and H1 bullish, target the H1 impulsion 50%',
  T2: 'buy at the zone of the break of an M5 VR at the 50% retracement, H4 and H1 still bullish, target the impulsion high', T3: 'tests 1 and 2 as one stream' };

const lowerT = (B, t) => { let a = 0, b = B.length; while (a < b) { const m = (a + b) >> 1; if (B[m].time < t) a = m + 1; else b = m; } return a; };

// BO events of a timeframe (his BO: a close above a high / below a low), on the most recent existing swing no close has broken yet.
// Each event: { at: close time, side, j (the BO candle), jh (the broken swing's candle), origin (buy: lowest low jh..j; sell: highest high) }
export function boEvents(B, w, sec) {
  const { hi, lo } = swings(B, w), ev = []; let H = null, L = null;
  for (let i = 0; i < B.length; i++) {
    const j = i - w; // a swing at j exists from the close of candle j + w = i, so it can be broken from candle i + 1 on
    const b = B[i];
    if (H && b.close > H.p) { let o = Infinity; for (let k = H.j; k <= i; k++) o = Math.min(o, B[k].low); ev.push({ at: b.time + sec, side: 1, j: i, jh: H.j, origin: o }); H = null; }
    else if (L && b.close < L.p) { let o = -Infinity; for (let k = L.j; k <= i; k++) o = Math.max(o, B[k].high); ev.push({ at: b.time + sec, side: -1, j: i, jh: L.j, origin: o }); L = null; }
    if (j >= 0 && hi[j]) H = { p: B[j].high, j };
    if (j >= 0 && lo[j]) L = { p: B[j].low, j };
  }
  return ev;
}
// swing-high Levels of a timeframe: { p, born, dead } (dead = close of the first own-timeframe candle that closes above it)
export function levelsOf(B, w, sec, tf) {
  const { hi } = swings(B, w), L = [];
  for (let j = 0; j + w < B.length; j++) if (hi[j]) {
    const born = B[j + w].time + sec; let dead = Infinity;
    for (let i = j + w + 1; i < B.length && B[i].time - born <= K.LEVEL_AGE; i++) if (B[i].close > B[j].high) { dead = B[i].time + sec; break; }
    L.push({ p: B[j].high, born, dead, tf });
  }
  return L;
}

// the detector. M5 oldest first. Returns the candidate orders of tests 1 and 2 and the funnel.
export function detect(M5) {
  const n = M5.length, M30 = agg(M5, K.M30), H1 = agg(M5, K.H1), H4 = agg(M5, K.H4);
  const ev4 = boEvents(H4, K.W, K.H4), ev1 = boEvents(H1, K.W, K.H1);
  const levels = [...levelsOf(H4, K.W, K.H4, 'H4'), ...levelsOf(H1, K.W, K.H1, 'H1'), ...levelsOf(M30, K.W, K.M30, 'M30')].sort((a, b) => a.born - b.born);
  const { hi, lo } = swings(M5, K.W5);
  const lastLo = new Int32Array(n).fill(-1), lastHi = new Int32Array(n).fill(-1);
  for (let i = 1; i < n; i++) { const j = i - K.W5 - 1; lastLo[i] = j >= 0 && lo[j] ? j : lastLo[i - 1]; lastHi[i] = j >= 0 && hi[j] ? j : lastHi[i - 1]; }
  const funnel = { levels: levels.length, touches: 0, cf: 0, sellNoTarget: 0, sellCand: 0, cycles: 0, retrace: 0, cfUp: 0, buyNoTarget: 0, buyNotBull: 0, buyCand: 0 };
  const cand = { T1: [], T2: [] }, live = [], cycles = [];
  let p4 = 0, p1 = 0, s4 = 0, s1 = 0, e1 = null, runMax = -Infinity, li = 0;
  const bull = () => s4 === 1 && s1 === 1;
  for (let i = 0; i < n; i++) {
    const b = M5[i], t = b.time, now = t + K.M5;
    // trend state from candles closed by the open of this candle
    for (; p4 < ev4.length && ev4[p4].at <= t; p4++) s4 = ev4[p4].side;
    for (; p1 < ev1.length && ev1[p1].at <= t; p1++) { s1 = ev1[p1].side; e1 = ev1[p1]; runMax = H1[e1.j].high; }
    for (; li < levels.length && levels[li].born <= t; li++) live.push({ ...levels[li], ep: null });
    // test 1: Levels, the VR, the CF
    let cfObj = null;
    for (let q = live.length - 1; q >= 0; q--) {
      const L = live[q], E = L.ep;
      if (!E) {
        if (L.dead <= t || t - L.born > K.LEVEL_AGE) { live.splice(q, 1); continue; }
        if (b.high >= L.p && bull()) { const j = lastLo[i]; if (j < 0) continue; L.ep = { startT: t, ext: b.high, v: M5[j].low }; funnel.touches++; }
        continue;
      }
      if (t - E.startT > K.EPISODE) { L.ep = null; continue; }
      if (b.high > E.ext) { const j = lastLo[i]; E.ext = b.high; if (j >= 0) E.v = M5[j].low; continue; }
      if (b.close < E.v) { live.splice(q, 1); if (!cfObj) cfObj = { v: E.v, ext: E.ext, lp: L.p, tf: L.tf }; }
    }
    runMax = Math.max(runMax, b.high);
    if (cfObj) {
      // at the CF's close: H4 and H1 must still be bullish (state through this candle's close)
      let a4 = s4, a1 = s1, ee = e1; for (let k = p4; k < ev4.length && ev4[k].at <= now; k++) a4 = ev4[k].side; for (let k = p1; k < ev1.length && ev1[k].at <= now; k++) { a1 = ev1[k].side; ee = ev1[k]; }
      const E = cfObj;
      if (a4 === 1 && a1 === 1 && ee && ee.side === 1) {
        funnel.cf++;
        const loI = ee.origin, hiI = ee === e1 ? runMax : Math.max(H1[ee.j].high, b.high), mid = (loI + hiI) / 2;
        const entry = E.v, stop = E.ext + K.PAD;
        cycles.push({ cfAt: now, cfI: i, mid, hi: hiI, lo: loI, st: 0 }); funnel.cycles++;
        if (mid < entry) { funnel.sellCand++; cand.T1.push(mk(-1, now, entry, stop, mid, { level: +E.lp.toFixed(3), tf: E.tf, ext: E.ext, v: E.v, imp: [loI, hiI] })); }
        else funnel.sellNoTarget++;
      }
    }
    // test 2: per open cycle, the retracement to the 50%, the buy VR at the low, the CF up
    for (let c = cycles.length - 1; c >= 0; c--) {
      const C = cycles[c]; if (i <= C.cfI) continue;
      if (C.st === 0) {
        if (t - C.cfAt >= K.RETRACE) { cycles.splice(c, 1); continue; }
        if (b.low <= C.mid) { const j = lastHi[i]; if (j < 0) continue; C.st = 1; C.startT = t; C.ext = b.low; C.v = M5[j].high; funnel.retrace++; }
        continue;
      }
      if (t - C.startT > K.EPISODE) { cycles.splice(c, 1); continue; }
      if (b.low < C.ext) { const j = lastHi[i]; C.ext = b.low; if (j >= 0) C.v = M5[j].high; continue; }
      if (b.close > C.v) {
        cycles.splice(c, 1); funnel.cfUp++;
        let a4 = s4, a1 = s1; for (let k = p4; k < ev4.length && ev4[k].at <= now; k++) a4 = ev4[k].side; for (let k = p1; k < ev1.length && ev1[k].at <= now; k++) a1 = ev1[k].side;
        if (!(a4 === 1 && a1 === 1)) { funnel.buyNotBull++; continue; }
        const entry = C.v, stop = C.ext - K.PAD;
        if (!(C.hi > entry)) { funnel.buyNoTarget++; continue; }
        funnel.buyCand++; cand.T2.push(mk(1, now, entry, stop, C.hi, { ext: C.ext, v: C.v, imp: [C.lo, C.hi], cycleAt: C.cfAt }));
      }
    }
  }
  return { cand, funnel };
}
function mk(side, placed, entry, stop, target, extra) {
  const r0 = Math.abs(stop - entry);
  return { side, placed, entry: +entry.toFixed(3), stop: +stop.toFixed(3), target: +target.toFixed(3), r0: +r0.toFixed(3), rr: +(Math.abs(target - entry) / r0).toFixed(2), ...extra };
}

// ─── fills (M5): a limit order from placement; stop first; a gap through the stop exits at the open ───
const costOf = (o, fill, closed, mult) => { const fin = o.side > 0 ? nights(fill, closed) * FIN.xau.long * o.entry / o.r0 : 0; return { c: (mult * K.COST) / o.r0 + mult * fin, fin }; };
function done(o, fill, t, px, exit) {
  const R = (o.side * (px - o.entry)) / o.r0, c1 = costOf(o, fill, t, 1), c2 = costOf(o, fill, t, 2);
  return { status: 'closed', filled: fill, closed: t, exitPx: +px.toFixed(3), exit, R: +R.toFixed(4), fin: +c1.fin.toFixed(4), net: +(R - c1.c).toFixed(4), net2: +(R - c2.c).toFixed(4) };
}
// management of an open position from candle k (the first candle after the fill candle)
function manage(F, o, k, fill) {
  const s = o.side, n = F.length;
  for (; k < n; k++) { const b = F[k];
    if (s < 0 ? b.open >= o.stop : b.open <= o.stop) return done(o, fill, b.time, b.open, 'stop (gap)');
    if (s < 0 ? b.high >= o.stop : b.low <= o.stop) return done(o, fill, b.time, o.stop, 'stop');
    if (s < 0 ? b.low <= o.target : b.high >= o.target) return done(o, fill, b.time, o.target, 'target');
    if (b.time + K.M5 >= fill + K.HOLD) return done(o, fill, b.time + K.M5, b.close, 'time'); }
  return { status: 'open' };
}
export function simLimit(F, o) {
  const s = o.side, n = F.length;
  for (let k = lowerT(F, o.placed); k < n; k++) { const b = F[k];
    if (b.time >= o.placed + K.VALID) return { status: 'expired', closed: b.time };
    if (s < 0 ? b.open >= o.stop : b.open <= o.stop) return { status: 'cancelled', closed: b.time };          // gapped past the VR: it failed
    const touch = s < 0 ? b.high >= o.entry : b.low <= o.entry, tgt = s < 0 ? b.low <= o.target : b.high >= o.target;
    if (!touch) { if (tgt) return { status: 'missed', closed: b.time }; continue; }
    const fill = b.time;
    if (s < 0 ? b.high >= o.stop : b.low <= o.stop) return done(o, fill, b.time, o.stop, 'stop');
    if (tgt) { if (s < 0 ? b.open >= o.entry : b.open <= o.entry) return done(o, fill, b.time, o.target, 'target'); return { status: 'missed', closed: b.time }; }
    return manage(F, o, k + 1, fill);
  }
  return { status: 'open' };
}
// a market entry at the close of candle k (placebo and control)
export function simMarketAt(F, k, side, r0, tdist) {
  const entry = F[k].close, o = { side, entry, r0, stop: entry - side * r0, target: entry + side * tdist };
  return manage(F, o, k + 1, F[k].time + K.M5);
}
// one order or position at a time within a test
export function book(F, cands) {
  let busy = -Infinity; const out = [];
  for (const c of [...cands].sort((a, b) => a.placed - b.placed)) { if (c.placed < busy) continue; const r = simLimit(F, c), o = { ...c, ...r }; out.push(o); busy = r.closed ?? Infinity; }
  return out;
}

// ─── statistics: t on calendar-month sums (every month of the window, empty months = 0) ───
export const Phi = (x) => { const z = Math.abs(x) / Math.SQRT2, a = 1 / (1 + 0.3275911 * z), e = 1 - (((((1.061405429 * a - 1.453152027) * a) + 1.421413741) * a - 0.284496736) * a + 0.254829592) * a * Math.exp(-z * z); return 0.5 * (1 + Math.sign(x) * e); };
const monthKey = (t) => { const d = new Date(t * 1000); return d.getUTCFullYear() * 12 + d.getUTCMonth(); };
export function monthT(trades, [a, b], key = 'net') {
  const m0 = monthKey(a), m1 = monthKey(b - 1), sums = new Array(m1 - m0 + 1).fill(0);
  for (const o of trades) if (o.placed >= a && o.placed < b) sums[monthKey(o.placed) - m0] += o[key];
  const n = sums.length, mu = sums.reduce((x, y) => x + y, 0) / n, sd = Math.sqrt(sums.reduce((x, y) => x + (y - mu) ** 2, 0) / (n - 1));
  return { months: n, t: sd > 0 ? +(mu / (sd / Math.sqrt(n))).toFixed(2) : 0 };
}
export function summary(trades, win) {
  const tr = trades.filter((o) => o.status === 'closed' && o.placed >= win[0] && o.placed < win[1]);
  const one = (key) => ({ ...stat(tr.map((o) => o[key])), mt: monthT(tr, win, key).t });
  const S = { net: one('net'), gross: one('R'), net2: one('net2'), months: monthT(tr, win).months };
  S.p = +(1 - Phi(S.net.mt)).toFixed(4);
  return S;
}
export const closedOf = (orders) => orders.filter((o) => o.status === 'closed');

// placebo / control: per trade a random candle (seeded), same side, distances as the trade's
export function rng(seed) { let x = (seed * 2654435761) >>> 0 || 1; return () => { x ^= x << 13; x >>>= 0; x ^= x >>> 17; x ^= x << 5; x >>>= 0; return x / 4294967296; }; }
export function atrAt(H1) { const a = new Float64Array(H1.length); let s = 0; for (let i = 1; i < H1.length; i++) { const p = H1[i - 1].close, tr = Math.max(H1[i].high - H1[i].low, Math.abs(H1[i].high - p), Math.abs(H1[i].low - p)); s = i <= K.ATR ? s + tr / K.ATR : s + (tr - s) / K.ATR; a[i] = s; } return (t) => { const i = lowerT(H1, t) - 1; return i >= K.ATR ? a[i] : null; }; }
export function randomRuns(F, trades, win, kind, seeds, atr) {
  const tr = trades.filter((o) => o.status === 'closed' && o.placed >= win[0] && o.placed < win[1]), out = [];
  if (!tr.length) return out;
  const a = lowerT(F, win[0]), b = lowerT(F, win[1]) - 1;
  for (let s = 1; s <= seeds; s++) { const r = rng(s * 7919 + (kind === 'control' ? 1 : 0)), nets = [];
    for (const o of tr) {
      let k, r0 = o.r0, td = Math.abs(o.target - o.entry);
      if (kind === 'placebo') k = a + Math.floor(r() * (b - a));
      else { const lo = lowerT(F, o.filled - K.CTRL_DAYS * 86400), hi = lowerT(F, o.filled + K.CTRL_DAYS * 86400) - 1; k = lo + Math.floor(r() * Math.max(1, hi - lo));
        const x0 = atr(o.filled), x1 = atr(F[k].time); if (x0 && x1) { r0 *= x1 / x0; td *= x1 / x0; } }
      const m = simMarketAt(F, k, o.side, r0, td); if (m.status === 'closed') nets.push(m.net);
    }
    out.push(+(nets.reduce((x, y) => x + y, 0) / Math.max(1, nets.length)).toFixed(4)); }
  return out;
}

// ─── modes ───
const HERE = path.dirname(fileURLToPath(import.meta.url));
const MODE = process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url) ? process.argv[2] : null;
const iso = (t) => (t == null ? '-' : new Date(t * 1000).toISOString().slice(0, 16).replace('T', ' '));
const toBars = (rows) => rows.map((r) => ({ time: r[0], open: r[1], high: r[2], low: r[3], close: r[4] }));
export function holm(ps) { const idx = ps.map((p, i) => [p, i]).sort((x, y) => x[0] - y[0]), adj = new Array(ps.length); let top = 0; idx.forEach(([p, i], r) => { top = Math.max(top, Math.min(1, p * (ps.length - r))); adj[i] = +top.toFixed(4); }); return adj; }
export function verdictOf(T1) {
  const lines = { 'OOS net t >= 2 on month sums': T1.oos.net.mt >= 2, 'Holm-adjusted p < 0.05': T1.pHolm < 0.05, 'same sign in sample': T1.is.net.n > 0 && Math.sign(T1.is.net.avg) === Math.sign(T1.oos.net.avg) && T1.oos.net.avg > 0,
    'OOS net at 2x costs > 0': T1.oos.net2.n > 0 && T1.oos.net2.avg > 0 };
  const v = Object.values(lines).every(Boolean) ? 'PASS' : T1.is.net.avg > 0 && T1.oos.net.avg > 0 ? 'INCONCLUSIVE' : 'FAIL';
  return { verdict: v, lines };
}
if (MODE === 'run') {
  const M5 = toBars(JSON.parse(zlib.gunzipSync(fs.readFileSync(path.join(process.env.CANDLES, 'xau-5m.json.gz')))));
  console.error(`M5 ${M5.length} (${iso(M5[0].time)} → ${iso(M5.at(-1).time)})`);
  const { cand, funnel } = detect(M5), T = { T1: book(M5, cand.T1), T2: book(M5, cand.T2) };
  T.T3 = [...T.T1, ...T.T2].sort((a, b) => a.placed - b.placed);
  const atr = atrAt(agg(M5, K.H1)), out = { topic: 'luxus-vr-cycle', built: '2026-11-14', at: new Date().toISOString(),
    system: "Luxus's VR cycle on spot gold (H4 and H1 bullish, a Level, the M5 VR and CF, zone-of-the-break entry, target the H1 impulsion 50%; then the buy at the 50%), OANDA M5",
    windows: { is: '2020-01-01 to 2023-12-31', oos: '2024-01-01 to 2026-10-31', replication: '2007-01-01 to 2019-12-31' }, params: K, costs: { roundTrip: K.COST, financingLong: FIN.xau.long, financingSrc: FIN.src },
    candles: { m5: M5.length, from: iso(M5[0].time), to: iso(M5.at(-1).time) }, funnel, tests: {} };
  for (const k of Object.keys(TESTS)) {
    const os = T[k], st = {}; for (const s of ['expired', 'cancelled', 'missed', 'closed', 'open']) st[s] = os.filter((o) => o.placed >= WIN.rep[0] && o.status === s).length;
    const c = closedOf(os), exits = {}; for (const o of c) if (o.placed >= WIN.is[0] && o.placed < WIN.oos[1]) { const e = o.exit.replace(' (gap)', ''); exits[e] = (exits[e] || 0) + 1; }
    const years = {}; for (const o of c) { const y = new Date(o.placed * 1000).getUTCFullYear(); (years[y] ||= []).push(o.net); }
    const med = (a) => (a.length ? +[...a].sort((x, y) => x - y)[a.length >> 1].toFixed(2) : null), w20 = c.filter((o) => o.placed >= WIN.is[0] && o.placed < WIN.oos[1]);
    out.tests[k] = { rule: TESTS[k], orders: st, exits, is: summary(os, WIN.is), oos: summary(os, WIN.oos), rep: summary(os, WIN.rep), all2020: summary(os, [WIN.is[0], WIN.oos[1]]),
      sells: stat(w20.filter((o) => o.side < 0).map((o) => o.net)), buys: stat(w20.filter((o) => o.side > 0).map((o) => o.net)),
      medianR0: med(w20.map((o) => o.r0)), medianRR: med(w20.map((o) => o.rr)), years: Object.fromEntries(Object.entries(years).map(([y, l]) => [y, stat(l)])),
      placebo: { is: randomRuns(M5, os, WIN.is, 'placebo', K.SEEDS, atr), oos: randomRuns(M5, os, WIN.oos, 'placebo', K.SEEDS, atr) },
      control: { is: randomRuns(M5, os, WIN.is, 'control', K.SEEDS, atr), oos: randomRuns(M5, os, WIN.oos, 'control', K.SEEDS, atr) } };
    const X = out.tests[k]; for (const w of ['is', 'oos']) for (const q of ['placebo', 'control']) { const a = X[q][w], r = X[w].net.avg ?? 0; X[q][`${w}AtOrAbove`] = a.filter((v) => v >= r).length; X[q][`${w}Mean`] = a.length ? +(a.reduce((x, y) => x + y, 0) / a.length).toFixed(4) : null; }
    console.error(k, 'IS', JSON.stringify(X.is.net), 'OOS', JSON.stringify(X.oos.net), 'REP', JSON.stringify(X.rep.net));
  }
  const adj = holm(['T1', 'T2', 'T3'].map((k) => out.tests[k].oos.p)); ['T1', 'T2', 'T3'].forEach((k, i) => { out.tests[k].pHolm = adj[i]; });
  out.primary = verdictOf(out.tests.T1);
  const S = out.tests;
  out.candidates = Object.keys(TESTS).map((k) => ({ rule: `${k}: ${TESTS[k]}`, verdict: k === 'T1' ? out.primary.verdict : (S[k].oos.net.mt >= 2 && S[k].pHolm < 0.05 && S[k].is.net.avg > 0 && S[k].oos.net2.avg > 0 ? 'PASS' : 'FAIL'), is: S[k].is.net, oos: S[k].oos.net, pHolm: S[k].pHolm }));
  // Luxus's own trades of 10 and 11 Nov 2026: what the detector placed around them (reported, not tuned for)
  out.example = Object.fromEntries(['T1', 'T2'].map((k) => [k, T[k].filter((o) => o.placed >= D(2026, 11, 9) && o.placed < D(2026, 11, 13)).map((o) => ({ placed: iso(o.placed), side: o.side < 0 ? 'sell' : 'buy', entry: o.entry, stop: o.stop, target: o.target, status: o.status, exit: o.exit || null, R: o.R ?? null }))]));
  out.trades = closedOf(T.T3).filter((o) => o.placed >= WIN.is[0] && o.placed < WIN.oos[1]).map((o) => ({ d: new Date(o.closed * 1000).toISOString().slice(0, 10), side: o.side < 0 ? 'sell' : 'buy', R: o.net }));
  fs.writeFileSync(path.join(HERE, 'result.json'), JSON.stringify(out, null, 1) + '\n');
  console.error(JSON.stringify(funnel)); console.error(JSON.stringify(out.example, null, 0));
}
