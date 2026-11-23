// research/edge/eg-chain-50/run.mjs - the engulf chain with an entry at the confirming engulf's middle (pre-registered
// 23 Nov 2026, PREREGISTRATION.md). Research only: reads the toolkit's candle cache, places nothing, reads no council file.
//   node research/edge/eg-chain-50/run.mjs        -> result.json, trades.json (needs the candle cache)
// Everything follows PREREGISTRATION.md; nothing is tuned. Choices the pre-registration leaves open are listed in CHOICES
// and repeated in RESULT.md.
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import * as K from '../_lib/edgekit.mjs';

const HERE = path.dirname(fileURLToPath(import.meta.url));
export const P = { SPAN: 3, WIN2: 12, LIFE3: 12, MIN1R: 1.0, HOLD: 24 * 3600, HOLD_DAYS: 5, COST: K.COSTS.xau };
export const WIN = {
  REP: [Date.UTC(2010, 0, 1) / 1000, Date.UTC(2020, 0, 1) / 1000],
  IS: [Date.UTC(2020, 0, 1) / 1000, Date.UTC(2024, 0, 1) / 1000],
  OOS: [Date.UTC(2024, 0, 1) / 1000, Infinity],
};
export const CHOICES = [
  'Engulf: a buy base is the latest bearish candle; a later bearish candle replaces it; a bullish candle that closes above the base high completes it (a bearish candle never completes); a close below the base low cancels it; with no completion within 3 candles after the base (1 for S2) the base lapses. Dojis count among the 3 and are never a base.',
  'The TF2 touch: any TF2 candle starting at or after the TF1 zone is known whose range meets the zone, at or before the TF2 engulf\'s completing candle; the TF1 zone must still be alive at that completion.',
  'Several TF1 zones may qualify for one TF2 engulf: the chain counts as alive while any of them is alive. Several TF2 engulfs may qualify for one TF3 engulf: the most recent one gives the hard stop.',
  'The TF3 engulf\'s completing candle starts at or after the TF2 engulf\'s completion and closes no later than 12 TF2 candles after it.',
  'A setup whose hard stop (TF2 zone far side) is not on the losing side of the entry is skipped (rule 1: a stop always on the losing side).',
  'Roadblock: alive opposite TF1 / TF2 zones whose near edge is beyond the entry (a buy: a sell zone\'s low above the entry); the nearest one.',
  'On a 5-minute candle the fill is checked first; a candle that does not fill and reaches the target cancels the order.',
  'R = (exit - fill) / 1R with 1R = the planned entry to the TF3 zone far side; cost $0.30 / 1R.',
  'One position at a time per chain: while an order rests or a position is open no new setup is taken.',
  'S1 time limit: 5 trading days = the fill time moved by the gap between the end of its 17:00 New York trading day and the end of the trading day five days later.',
  'Windows are by fill time; month sums by exit month (edgekit.stats).',
];

// ---- engulf zones of one timeframe -------------------------------------------------------------------------------
// returns { side, h, l, bi (base index), ci (completing index), known (close of the completing candle), n, die }
export function engulfZones(bars, span = P.SPAN) {
  const out = [];
  const tr = [{ s: 1, b: -1 }, { s: -1, b: -1 }]; // buy tracker: base = bearish; sell tracker: base = bullish
  for (let i = 0; i < bars.length; i++) {
    const c = bars[i]; const col = c.c > c.o ? 1 : c.c < c.o ? -1 : 0;
    for (const T of tr) {
      if (T.b >= 0) {
        const b = bars[T.b];
        if (col === T.s && (T.s > 0 ? c.c > b.h : c.c < b.l)) { out.push({ side: T.s, h: b.h, l: b.l, bi: T.b, ci: i, known: c.e, n: i - T.b }); T.b = -1; continue; }
        if (col === -T.s) { T.b = i; continue; }
        if (T.s > 0 ? c.c < b.l : c.c > b.h) { T.b = -1; continue; }
        if (i - T.b >= span) T.b = -1;
      } else if (col === -T.s) T.b = i;
    }
  }
  markDeaths(bars, out);
  return out;
}

// die = the close time of the first later candle that closes beyond the zone's far side (Infinity if none on file)
export function markDeaths(bars, zones) {
  const n = bars.length; let N = 1; while (N < n) N <<= 1;
  const mn = new Float64Array(2 * N).fill(Infinity), mx = new Float64Array(2 * N).fill(-Infinity);
  for (let i = 0; i < n; i++) { mn[N + i] = bars[i].c; mx[N + i] = bars[i].c; }
  for (let i = N - 1; i > 0; i--) { mn[i] = Math.min(mn[2 * i], mn[2 * i + 1]); mx[i] = Math.max(mx[2 * i], mx[2 * i + 1]); }
  // first index >= from with close < x (below) / close > x (above)
  function first(from, x, below) {
    if (from >= n) return -1;
    const ok = (k) => (below ? mn[k] < x : mx[k] > x);
    let k = N + from;
    if (ok(k)) return from;
    while (true) { // climb until a right sibling subtree holds a hit
      if (k === 1) return -1;
      if ((k & 1) === 0 && ok(k + 1)) { k = k + 1; break; }
      k >>= 1;
    }
    while (k < N) k = ok(2 * k) ? 2 * k : 2 * k + 1;
    const i = k - N; return i < n ? i : -1;
  }
  for (const z of zones) {
    const j = z.side > 0 ? first(z.ci + 1, z.l, true) : first(z.ci + 1, z.h, false);
    z.die = j < 0 ? Infinity : bars[j].e;
  }
  return zones;
}

const overlap = (a, b) => a.l <= b.h && a.h >= b.l;

// ---- setups ------------------------------------------------------------------------------------------------------
// tf: { b1, b2, b3 } bars of TF1, TF2, TF3; sec2 = TF2 length in seconds. Returns setups in placement order.
export function findSetups({ b1, b2, b3, sec2, span = P.SPAN }) {
  const Z1 = engulfZones(b1, span), Z2 = engulfZones(b2, span), Z3 = engulfZones(b3, span);
  // stage 2: TF2 engulfs at a touched, alive TF1 zone
  const z2byCi = new Map(); for (const z of Z2) { if (!z2byCi.has(z.ci)) z2byCi.set(z.ci, []); z2byCi.get(z.ci).push(z); }
  const stage2 = []; let p1 = 0; let active = [];
  for (let j = 0; j < b2.length; j++) {
    const c = b2[j];
    while (p1 < Z1.length && Z1[p1].known <= c.t) { active.push({ z: Z1[p1], touched: false }); p1++; }
    if (j % 64 === 0) active = active.filter((a) => a.z.die > c.t);
    for (const a of active) if (!a.touched && a.z.die > c.t && c.h >= a.z.l && c.l <= a.z.h) a.touched = true;
    const done = z2byCi.get(j); if (!done) continue;
    for (const z2 of done) {
      let die1 = -Infinity, n1 = 0;
      for (const a of active) if (a.touched && a.z.side === z2.side && a.z.die > z2.known && overlap(a.z, z2)) { n1++; if (a.z.die > die1) die1 = a.z.die; }
      if (n1) stage2.push({ z2, die1, end: z2.known + P.WIN2 * sec2 });
    }
  }
  // stage 3: TF3 engulfs at a stage-2 zone within 12 TF2 candles, TF1 and TF2 alive
  const setups = []; let p2 = 0; let open = [];
  const Z3s = Z3.slice().sort((a, b) => a.known - b.known);
  for (const z3 of Z3s) {
    const t3 = b3[z3.ci].t;
    while (p2 < stage2.length && stage2[p2].z2.known <= t3) { open.push(stage2[p2]); p2++; }
    open = open.filter((s) => s.end >= z3.known);
    let best = null;
    for (const s of open) {
      if (s.z2.side !== z3.side || s.z2.known > t3 || z3.known > s.end) continue;
      if (!(s.die1 > z3.known && s.z2.die > z3.known)) continue;
      if (!overlap(s.z2, z3)) continue;
      if (!best || s.z2.known > best.z2.known) best = s;
    }
    if (best) setups.push({ side: z3.side, z1die: best.die1, z2: best.z2, z3, place: z3.known });
  }
  return { setups, Z1, Z2, Z3 };
}

// nearest alive opposite TF1 / TF2 zone ahead of the entry at moment t
export function roadblock(zones, side, entry, t) {
  let best = null;
  for (const z of zones) {
    if (z.side !== -side || z.known > t || z.die <= t) continue;
    const edge = side > 0 ? z.l : z.h;
    if (side > 0 ? edge > entry : edge < entry) if (best == null || (side > 0 ? edge < best : edge > best)) best = edge;
  }
  return best;
}

// index of the first bar with t >= x
function lowerT(bars, x) { let lo = 0, hi = bars.length; while (lo < hi) { const m = (lo + hi) >> 1; if (bars[m].t < x) lo = m + 1; else hi = m; } return lo; }

// ---- one order / trade on 5-minute candles -----------------------------------------------------------------------
// o: { side, entry, stop (hard), cutAt (TF3 zone far side), target|null, place, expire, deadlineFn(fillT) }
// m5: 5-minute bars; endsTF3(k) = true when 5-minute candle k is the last of its TF3 candle (that candle's close).
export function runOrder(o, m5, endsTF3, cost = P.COST) {
  const s = o.side; const oneR = Math.abs(o.entry - o.cutAt);
  let k = lowerT(m5, o.place);
  let fill = null, fk = -1;
  for (; k < m5.length; k++) {
    const b = m5[k]; if (b.t >= o.expire) return { status: 'nofill', reason: 'expired', end: o.expire };
    if (s > 0 ? b.l <= o.entry : b.h >= o.entry) { fill = s > 0 ? Math.min(b.o, o.entry) : Math.max(b.o, o.entry); fk = k; break; }
    if (o.target != null && (s > 0 ? b.h >= o.target : b.l <= o.target)) return { status: 'nofill', reason: 'target first', end: b.e };
    if (endsTF3(k) && (s > 0 ? b.c < o.cutAt : b.c > o.cutAt)) return { status: 'nofill', reason: 'cut before fill', end: b.e };
  }
  if (fk < 0) return { status: 'open', reason: 'end of data' };
  const fillT = m5[fk].t; const deadline = o.deadlineFn(fillT);
  const out = (px, at, reason) => { const R = (s * (px - fill)) / oneR; return { status: 'closed', fill, fillT, exit: px, exitT: at, reason, oneR, R, Rnet: R - cost / oneR, Rnet2: R - (2 * cost) / oneR }; };
  for (let j = fk; j < m5.length; j++) {
    const b = m5[j], first = j === fk;
    if (s * (fill - o.stop) <= 0) return out(fill, b.t, 'stop'); // filled at an open already past the stop
    if (!first && s * (b.o - o.stop) <= 0) return out(b.o, b.t, 'stop');
    if (!first && o.target != null && s * (b.o - o.target) >= 0) return out(b.o, b.t, 'target');
    if (s > 0 ? b.l <= o.stop : b.h >= o.stop) return out(o.stop, b.e, 'stop');
    if (!first && o.target != null && (s > 0 ? b.h >= o.target : b.l <= o.target)) return out(o.target, b.e, 'target');
    if (endsTF3(j) && (s > 0 ? b.c < o.cutAt : b.c > o.cutAt)) return out(b.c, b.e, 'cut');
    if (b.e >= deadline) return out(b.c, b.e, 'time');
  }
  return { status: 'open', reason: 'end of data', fill, fillT };
}

// ---- one chain end to end ----------------------------------------------------------------------------------------
// cfg: { name, m5, b1, b2, b3, sec2, sec3, span, deadlineFn }
export function runChain(cfg) {
  const { m5, b1, b2, b3, sec2, sec3 } = cfg;
  const { setups, Z1, Z2 } = findSetups({ b1, b2, b3, sec2, span: cfg.span });
  const opp = Z1.concat(Z2);
  const ends = new Uint8Array(m5.length);
  for (let k = 0; k < m5.length; k++) ends[k] = k === m5.length - 1 || Math.floor(m5[k + 1].t / sec3) !== Math.floor(m5[k].t / sec3) ? 1 : 0;
  const endsTF3 = sec3 === 300 ? () => true : (k) => ends[k] === 1;
  const count = { setups: setups.length, smallRisk: 0, stopWrongSide: 0, targetUnder1R: 0, noRoadblock: 0, busy: 0, orders: 0, nofill: 0, open: 0, trades: 0 };
  const trades = []; let busy = -Infinity;
  for (const st of setups) {
    const s = st.side, z3 = st.z3;
    const entry = (z3.h + z3.l) / 2, cutAt = s > 0 ? z3.l : z3.h, oneR = Math.abs(entry - cutAt);
    if (oneR < P.MIN1R) { count.smallRisk++; continue; }
    const stop = s > 0 ? st.z2.l : st.z2.h;
    if (!(s * (entry - stop) > 0)) { count.stopWrongSide++; continue; }
    if (st.place < busy) { count.busy++; continue; }
    const target = roadblock(opp, s, entry, st.place);
    if (target != null && Math.abs(target - entry) < oneR) { count.targetUnder1R++; continue; }
    if (target == null) count.noRoadblock++;
    count.orders++;
    const o = { side: s, entry, stop, cutAt, target, place: st.place, expire: st.place + P.LIFE3 * sec3, deadlineFn: cfg.deadlineFn };
    const r = runOrder(o, m5, endsTF3);
    if (r.status === 'nofill') { count.nofill++; busy = r.end; continue; }
    if (r.status === 'open') { count.open++; busy = Infinity; continue; }
    busy = r.exitT; count.trades++;
    trades.push({ chain: cfg.name, market: 'xau', side: s > 0 ? 'buy' : 'sell', place: st.place, fillT: r.fillT, entry: rnd(entry), fill: rnd(r.fill), stop: rnd(stop),
      cut: rnd(cutAt), target: target == null ? null : rnd(target), exitT: r.exitT, exit: rnd(r.exit), reason: r.reason, oneR: rnd(oneR),
      R: rnd4(r.R), Rnet: rnd4(r.Rnet), Rnet2: rnd4(r.Rnet2), eg3n: z3.n });
  }
  return { trades, count };
}
const rnd = (x) => Math.round(x * 1000) / 1000, rnd4 = (x) => Math.round(x * 1e4) / 1e4;

// ---- statistics by window ----------------------------------------------------------------------------------------
export function windowStats(trades, key = 'Rnet') {
  const pick = (w) => trades.filter((x) => x.fillT >= w[0] && x.fillT < w[1]);
  const one = (xs) => { const s = K.stats(xs, { key, time: 'exitT' }); return { n: s.n, wins: s.wins, total: s.total, meanR: s.meanR, tTrade: s.tTrade, months: s.months, tMonth: s.tMonth, pMonth: s.pMonth, maxDD: s.maxDD }; };
  return { REP: one(pick(WIN.REP)), IS: one(pick(WIN.IS)), OOS: one(pick(WIN.OOS)), all: one(trades) };
}
export function byYear(trades) {
  const o = {}; for (const x of trades) { const y = new Date(x.fillT * 1000).getUTCFullYear(); (o[y] ||= []).push(x); }
  for (const y of Object.keys(o)) { const xs = o[y]; o[y] = { n: xs.length, Rnet: rnd4(xs.reduce((a, x) => a + x.Rnet, 0)), meanRnet: rnd4(xs.reduce((a, x) => a + x.Rnet, 0) / xs.length), meanR: rnd4(xs.reduce((a, x) => a + x.R, 0) / xs.length) }; }
  return o;
}
export function breakdown(trades) {
  const g = (f) => { const o = {}; for (const x of trades) { const k = f(x); (o[k] ||= { n: 0, Rnet: 0 }); o[k].n++; o[k].Rnet += x.Rnet; } for (const k of Object.keys(o)) { o[k].Rnet = rnd4(o[k].Rnet); o[k].meanRnet = rnd4(o[k].Rnet / o[k].n); } return o; };
  return { side: g((x) => x.side), exit: g((x) => x.reason), roadblock: g((x) => (x.target == null ? 'none' : 'zone')) };
}

// ---- verdict -----------------------------------------------------------------------------------------------------
export function judge(w, w2, holmP) {
  const checks = {
    c1_oosMeanPositive_n30: w.OOS.n >= 30 && w.OOS.meanR > 0,
    c2_oosMonthT2_holm: w.OOS.tMonth != null && w.OOS.tMonth >= 2 && holmP < 0.05,
    c3_isMeanPositive: w.IS.n > 0 && w.IS.meanR > 0,
    c4_repMeanPositive_n30: w.REP.n >= 30 && w.REP.meanR > 0,
    c5_oos2xCostPositive: w2.OOS.n > 0 && w2.OOS.meanR > 0,
  };
  return { checks, pass: Object.values(checks).every(Boolean) };
}

// ---- main --------------------------------------------------------------------------------------------------------
async function main() {
  const m5 = K.load('xau', '5m');
  const m15 = K.resample(m5, 900), h1 = K.resample(m5, 3600), h4 = K.resample(m5, 14400), d1 = K.dailyNY(m5);
  const dEnds = d1.map((d) => d.e);
  const daysFn = (fillT) => { let lo = 0, hi = d1.length - 1; while (lo < hi) { const m = (lo + hi) >> 1; if (dEnds[m] <= fillT) lo = m + 1; else hi = m; }
    const j = Math.min(lo + P.HOLD_DAYS, d1.length - 1); return fillT + (dEnds[j] - dEnds[lo]) + (lo + P.HOLD_DAYS > d1.length - 1 ? 1e12 : 0); };
  const hourFn = (fillT) => fillT + P.HOLD;
  const chains = {
    P: { name: 'P', desc: 'H1 zone -> M15 engulf -> M5 confirmation', m5, b1: h1, b2: m15, b3: m5, sec2: 900, sec3: 300, span: 3, deadlineFn: hourFn },
    S1: { name: 'S1', desc: 'D1 zone -> H4 engulf -> H1 confirmation (5 trading days)', m5, b1: d1, b2: h4, b3: h1, sec2: 14400, sec3: 3600, span: 3, deadlineFn: daysFn },
    S2: { name: 'S2', desc: 'P with the engulf completed by the next candle only', m5, b1: h1, b2: m15, b3: m5, sec2: 900, sec3: 300, span: 1, deadlineFn: hourFn },
  };
  const res = {}; const all = [];
  for (const [k, c] of Object.entries(chains)) {
    const t0 = Date.now(); const r = runChain(c); console.log(k, r.count, ((Date.now() - t0) / 1000).toFixed(1) + 's');
    const w = windowStats(r.trades, 'Rnet'), w2 = windowStats(r.trades, 'Rnet2'), w0 = windowStats(r.trades, 'R');
    res[k] = { desc: c.desc, count: r.count, net: w, cost2x: w2, gross: w0, byYear: byYear(r.trades), breakdown: breakdown(r.trades) };
    all.push(...r.trades);
  }
  const ps = ['P', 'S1', 'S2'].map((k) => res[k].net.OOS.pMonth);
  const hp = K.holm(ps);
  ['P', 'S1', 'S2'].forEach((k, i) => { res[k].holmP = hp[i]; res[k].judge = judge(res[k].net, res[k].cost2x, hp[i]); });
  const p = res.P;
  const verdict = p.net.OOS.n < 30 || p.net.REP.n < 30 ? 'INCONCLUSIVE' : p.judge.pass ? 'PASS' : 'FAIL';
  const last = m5[m5.length - 1].e;
  const headline = `${verdict}: H1 zone -> M15 engulf -> M5 confirmation on gold, ${p.net.OOS.n} trades out of sample at ${p.net.OOS.meanR.toFixed(3)}R a trade after costs`;
  const result = { study: 'eg-chain-50', built: new Date().toISOString().slice(0, 10), verdict, headline, market: 'xau', costPerRoundTrip: P.COST,
    data: { source: 'OANDA mid 5-minute candles (toolkit cache)', first: new Date(m5[0].t * 1000).toISOString(), last: new Date(last * 1000).toISOString() },
    windows: { replication: '2010-01-01..2019-12-31', inSample: '2020-01-01..2023-12-31', outOfSample: '2024-01-01..' + new Date(last * 1000).toISOString().slice(0, 10) },
    params: P, choices: CHOICES, chains: res };
  fs.writeFileSync(path.join(HERE, 'result.json'), JSON.stringify(result, null, 1));
  fs.writeFileSync(path.join(HERE, 'trades.json'), JSON.stringify(all));
  console.log('verdict', verdict, JSON.stringify(p.net.OOS), p.judge);
}
if (process.argv[1] && fileURLToPath(import.meta.url) === path.resolve(process.argv[1])) main();
