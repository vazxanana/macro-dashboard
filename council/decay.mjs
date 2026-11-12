// Council · Edge-decay monitor (8 Nov 2026, owner: edges here are regime-bound and can fade without notice: crypto trend made
// nothing from June 2025 (#508), the NQ open run made nothing 2004-22 (#511), the gold replica fails out of sample (#512)).
// An early warning for every live system: Meridian (trades.json k replica, mosha-bo, gtrend, gtrend5, gtl, geg, gmp;
// research.json nq-open session nyflip) and the ICT desk's A-setups (ict/trades.json aset). STATUS AND ALERT ONLY: nothing
// here changes a rule, a filter, a size or a trade. The owner decides.
//
// Per system, on its record after costs (the council's replay up to the first forward trade, then the forward paper record;
// a gold add is folded into its first trade, so one point = one position, as the baselines count them):
//   - rolling expectancy: the last W trades (W = a year of trades, 10 to 30)
//   - two one-sided CUSUMs in units of the baseline's SD (Page 1954), allowance k = max(ref / 2sd, 0.1):
//       vs the backtest:  S = max(0, S + (ref − x) / sd − k)   rises while the system runs below about half its backtest edge
//       vs zero:          Z = max(0, Z + (0 − x) / sd − k)     rises only while it is losing money
//     Control limit h (per system, council/decay-base.json): the 95th percentile of the highest S over ONE YEAR of trades
//     resampled from the system's own baseline record, so a system that still behaves like its backtest crosses h in about
//     1 year in 20. Built and back-tested by research/edge/decay-monitor/run.mjs (RESULT.md there).
//   - drawdown of the record now, against the worst it may have: max(its worst historical drawdown, the 95th percentile of
//     reshuffled baseline orders, the owner's allowance (gold replica: 30-40R, #512))
// Status:
//   decaying  S >= h (below half its backtest edge, beyond what a year of normal luck gives), or the drawdown is beyond its limit
//   watch     S >= 3/4 of h, or the drawdown is past 3/4 of its limit
//   healthy   otherwise (also when there are too few trades to say anything: `few`)
// Written by the Trader to coach.json `decay` every 6 hours; the page's Research pane shows it; the daily digest
// (council/digest.mjs decayLine) adds one line only when a live system is decaying.
import fs from 'node:fs';
import { merNet, ictNet } from './digest.mjs';
import { ownStream, rowFinancing } from './fills.mjs';

export const DK = {
  q: 0.95,          // control limit: 95th percentile of a year's highest CUSUM under the baseline (≈ 1 false alarm in 20 years)
  kMin: 0.1,        // smallest CUSUM allowance in SDs (systems whose backtest edge is near zero)
  minH: 10,         // a "year" is at least this many trades when the limit is set
  watchFrac: 0.75,  // watch from 3/4 of the control limit
  ddWatch: 0.75,    // watch from 3/4 of the drawdown limit
  minN: 10,         // fewer trades than this: no verdict (status healthy, few)
  rollMin: 10, rollMax: 30,   // rolling window: a year of trades, 10 to 30 (shown, not a trigger: a 30-trade window of a
                              // system with 100+ trades a year goes flat most years by luck alone; RESULT.md)
  iters: 4000,
};
// The systems watched. Live since 11 Nov 2026 (owner, on the edge review: user rule supported-book): Gold trend and Gold daily
// engulf, and the ICT desk's A-setups (a separate edge). The others are paper shadows: shown, never alerted. `shadow` = the
// owner's rule, `since` = the day of the owner's decision; a shadow system's forward record is its own stream (fills.mjs
// ownStream: its live trades from before and the owner-shadow trades the same rule takes after), so its history is kept.
export const SHADOW_11NOV = '2026-11-11';
export const SYSTEMS = [
  { id: 'replica', name: 'Gold replica', desk: 'Meridian', k: 'replica', shadow: true, since: SHADOW_11NOV },
  { id: 'mosha-bo', name: 'Mosha BO', desk: 'Meridian', k: 'mosha-bo', shadow: true, since: SHADOW_11NOV },
  { id: 'gtrend', name: 'Gold trend', desk: 'Meridian', k: 'gtrend' },
  { id: 'gtrend5', name: 'Gold trend fast', desk: 'Meridian', k: 'gtrend5', shadow: true, since: '2026-11-07' },   // owner moved to shadow 7 Nov (#530): shown, never alerted
  { id: 'gtl', name: 'Gold H4 trendline', desk: 'Meridian', k: 'gtl', shadow: true, since: SHADOW_11NOV },
  { id: 'geg', name: 'Gold daily engulf', desk: 'Meridian', k: 'geg' },
  { id: 'gmp', name: 'Gold momentum pullback', desk: 'Meridian', k: 'gmp', shadow: true, since: SHADOW_11NOV },   // a test shadow since 6 Nov; listed as a shadow system from 11 Nov
  { id: 'nq-open', name: 'NQ New York open run', desk: 'Meridian', k: 'nq-open', session: 'nyflip', shadow: true, since: SHADOW_11NOV },
  { id: 'ict-a', name: 'ICT A-setups', desk: 'ICT' },
  { id: 'trend', name: 'Crypto trend', desk: 'Meridian', k: 'trend', shadow: true, since: '2026-11-07' },
];
export const BASE_FILE = new URL('./decay-base.json', import.meta.url);
export function loadBase(file = BASE_FILE) { try { return JSON.parse(fs.readFileSync(file, 'utf8')); } catch (e) { return null; } }

const r2 = (v) => Number.isFinite(v) ? Math.round(v * 100) / 100 : v;
const r3 = (v) => Number.isFinite(v) ? Math.round(v * 1000) / 1000 : v;
const fR = (v) => `${v > 0.004 ? '+' : v < -0.004 ? '−' : ''}${Math.abs(+v || 0).toFixed(2)}R`;
const DONE = new Set(['win', 'loss', 'be']);

// ─── statistics ───
export const allowance = (ref, sd) => Math.max(ref / (2 * sd), DK.kMin);
export function describe(xs) {
  const n = xs.length; if (!n) return { n: 0, mean: 0, sd: 0, t: 0, sum: 0 };
  const sum = xs.reduce((s, x) => s + x, 0), mean = sum / n, sd = n > 1 ? Math.sqrt(xs.reduce((s, x) => s + (x - mean) ** 2, 0) / (n - 1)) : 0;
  return { n, mean, sd, t: sd > 0 ? mean / (sd / Math.sqrt(n)) : 0, sum };
}
// one-sided lower CUSUM: S_i = max(0, S_{i-1} + (target − x_i) / sd − k); path holds S after each point
export function cusum(xs, target, sd, k) {
  let s = 0, max = 0; const path = [];
  for (const x of xs) { s = Math.max(0, s + (target - x) / sd - k); if (s > max) max = s; path.push(s); }
  return { s, max, path };
}
// drawdown of the cumulative R: { cur (now, from the running peak), max (worst so far) }, both as positive R
export function drawdown(xs) {
  let eq = 0, pk = 0, max = 0;
  for (const x of xs) { eq += x; if (eq > pk) pk = eq; if (pk - eq > max) max = pk - eq; }
  return { cur: pk - eq, max };
}
export const rollWindow = (perYear) => Math.max(DK.rollMin, Math.min(DK.rollMax, Math.round(perYear || DK.rollMax)));
// small deterministic PRNG (mulberry32), so the limits are reproducible
export function rng(seed = 7) { let s = seed >>> 0; return () => { s = (s + 0x6D2B79F5) >>> 0; let t = s; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; }
// control limit: the q-quantile of the highest CUSUM over H trades drawn (with replacement) from the baseline record
export function controlLimit(R, { ref, sd, k, H, q = DK.q, iters = DK.iters, seed = 7 }) {
  const r = rng(seed), mx = new Float64Array(iters);
  for (let i = 0; i < iters; i++) { let s = 0, m = 0; for (let j = 0; j < H; j++) { s = Math.max(0, s + (ref - R[Math.floor(r() * R.length)]) / sd - k); if (s > m) m = s; } mx[i] = m; }
  mx.sort(); return mx[Math.min(iters - 1, Math.floor(q * iters))];
}
// 95th percentile of the max drawdown over reshuffled orders of the baseline record (as research/robustness.mjs mcDrawdown)
export function mcDrawdown(R, { iters = 2000, seed = 11, q = 0.95 } = {}) {
  const r = rng(seed), a = R.slice(), out = new Float64Array(iters);
  for (let i = 0; i < iters; i++) { for (let j = a.length - 1; j > 0; j--) { const m = Math.floor(r() * (j + 1)); [a[j], a[m]] = [a[m], a[j]]; } out[i] = drawdown(a).max; }
  out.sort(); return out[Math.min(iters - 1, Math.floor(q * iters))];
}
// a baseline entry from a record of net R per position: { ref, sd, k, h, H, W, perYear, maxDD, mcDD, ddAllow, ddLimit, n }
export function makeBase(R, { perYear, maxDD = 0, ddAllow = 0, src = '', note = '' } = {}) {
  const d = describe(R), sd = d.sd > 0 ? d.sd : 1, k = allowance(d.mean, sd), H = Math.max(DK.minH, Math.round(perYear || DK.minH));
  const h = controlLimit(R, { ref: d.mean, sd, k, H }), own = drawdown(R).max, mc = mcDrawdown(R);
  const hist = Math.max(maxDD || 0, own);
  return { n: d.n, ref: r3(d.mean), sd: r3(sd), k: r3(k), H, h: r2(h), W: rollWindow(perYear), perYear: r2(perYear), maxDD: r2(hist), mcDD: r2(mc), ddAllow: ddAllow || 0,
    ddLimit: r2(Math.max(hist, mc, ddAllow || 0)), src, ...(note ? { note } : {}) };
}

// ─── one system ───
// points: [{ t, R, src: 'replay' | 'live' | 'hist' }] in close order; b: its baseline entry
export function assess(points, b) {
  const P = (points || []).filter((p) => p && Number.isFinite(+p.R)), xs = P.map((p) => +p.R), n = xs.length;
  const live = P.filter((p) => p.src === 'live').map((p) => +p.R), L = describe(live);
  const W = b.W || DK.rollMax, roll = describe(xs.slice(-W));
  const S = cusum(xs, b.ref, b.sd, b.k), Z = cusum(xs, 0, b.sd, b.k), dd = drawdown(xs);
  const nOf = (src) => P.filter((p) => p.src === src).length;
  const o = { n, nLive: live.length, nReplay: nOf('replay'), nHist: nOf('hist'), from: P.length ? P[0].t : null, to: P.length ? P[n - 1].t : null, ref: b.ref, sd: b.sd,
    fwd: { n: L.n, exp: r2(L.mean), R: r2(L.sum) }, roll: { n: roll.n, W, exp: r2(roll.mean), t: r2(roll.t), R: r2(roll.sum) },
    cusRef: { s: r2(S.s), h: b.h, max: r2(S.max) }, cusZero: { s: r2(Z.s), h: b.h }, dd: { cur: r2(dd.cur), max: r2(dd.max), limit: b.ddLimit, hist: b.maxDD } };
  const why = [], few = n < DK.minN;
  const sr = b.h > 0 ? S.s / b.h : 0, ddr = b.ddLimit > 0 ? dd.cur / b.ddLimit : 0;
  if (few) { why.push(`only ${n} trade${n === 1 ? '' : 's'} on record: no verdict yet`); return { ...o, few: true, status: 'healthy', why }; }
  // no council replay of this rule (the record is its research rebuild): the rebuild is shown, not judged. Three rebuilds of the
  // live Mosha BO rule disagree on 2018-22 and share a minority of trades (research/edge/mosha-oos, 8 Nov), so a flag read on
  // the last rebuild trades measured the baseline choice, not the rule. The forward record alone counts, once it has minN trades.
  if (o.nHist && !o.nReplay && live.length < DK.minN) {
    why.push(`${live.length} forward trade${live.length === 1 ? '' : 's'} of ${DK.minN} needed: no council replay of this rule, and its research rebuilds disagree, so the rebuild record shown here is not judged`);
    return { ...o, few: true, status: 'healthy', why };
  }
  let status = 'healthy';
  if (S.s >= b.h) { status = 'decaying'; why.push(`running below half its backtest edge (${fR(b.ref)} a trade): CUSUM ${r2(S.s)} past its limit ${b.h}`); }
  if (dd.cur > b.ddLimit) { status = 'decaying'; why.push(`drawdown ${r2(dd.cur)}R beyond its limit ${b.ddLimit}R`); }
  if (Z.s >= b.h) why.push(`losing money, not only short of its backtest: CUSUM vs zero ${r2(Z.s)} past ${b.h}`);
  if (status !== 'decaying') {
    if (sr >= DK.watchFrac) { status = 'watch'; why.push(`CUSUM vs its backtest ${r2(S.s)}, close to its limit ${b.h}`); }
    if (ddr >= DK.ddWatch) { status = 'watch'; why.push(`drawdown ${r2(dd.cur)}R, ${Math.round(ddr * 100)}% of its limit ${b.ddLimit}R`); }
  }
  if (!why.length) why.push(`in line with its backtest: last ${roll.n} trades ${fR(roll.mean)} a trade, CUSUM ${r2(S.s)} of ${b.h}`);
  if (o.nHist) why.push(`read on the last ${o.nHist} trades of its research rebuild${o.nLive ? ` and ${o.nLive} forward` : ''}: there is no council replay of this rule`);
  return { ...o, status, why };
}

// ─── records ───
// fold a pyramid add (addOf) into its first trade: one point = one position
export function fold(list, net) {
  const out = new Map(), adds = [];
  for (const x of list) { if (x.addOf) adds.push(x); else out.set(x.id, { id: x.id, t: x.closed || x.exitAt || x.opened, R: net(x), opened: x.opened }); }
  for (const a of adds) { const q = out.get(a.addOf), t = a.closed || a.exitAt || a.opened; if (q) { q.R += net(a); q.t = Math.max(q.t, t); } else out.set(a.id, { id: a.id, t, R: net(a), opened: a.opened }); }
  return [...out.values()].filter((p) => Number.isFinite(p.R) && Number.isFinite(p.t));
}
// A council replay row after costs AND overnight financing (11 Nov 2026): the replay's R is after the spread only, so a long gold
// row pays the Trader's own financing (fills.mjs rowFinancing) when it is read, here and in the baseline build
// (research/edge/decay-monitor/run.mjs), so the record under watch and its baseline are costed alike. Nothing stored changes.
export const replayNet = (x) => merNet(x) - rowFinancing(x).finR * (x.rawR != null && x.size ? x.size : 1);
const closed = (x) => x && DONE.has(x.status) && Number.isFinite(+x.R) && (x.closed || x.exitAt);
// the council's replay up to the first forward trade, then the forward record (where they overlap, the forward record counts)
export function joinRecord(replay, live, hist = []) {
  const first = live.length ? Math.min(...live.map((p) => p.opened || p.t)) : Infinity;
  const pre = (replay.length ? replay : hist).filter((p) => (p.opened || p.t) < first);
  const tag = (a, src) => a.map((p) => ({ t: p.t, R: r3(p.R), src }));
  return tag(pre, replay.length ? 'replay' : 'hist').concat(tag(live, 'live')).sort((a, b) => a.t - b.t);
}
// D: { trades, research, ictTrades, replay (research/replay-2w.json), ictReplay (ict/replay.json) }; b: the base entry (hist)
export function recordOf(sys, D, b = {}) {
  const hist = (b.hist || []).map(([t, R]) => ({ t, R, opened: t }));
  if (sys.desk === 'ICT') {
    const rp = ((D.ictReplay && D.ictReplay.trades) || []).filter((x) => x.aset && closed(x) && x.valid !== false);
    const lv = (Array.isArray(D.ictTrades) ? D.ictTrades : []).filter((x) => x.aset && closed(x));
    return joinRecord(fold(rp, ictNet), fold(lv, ictNet), hist);
  }
  const mine = (x) => x.k === sys.k && (!sys.session || x.session === sys.session);
  const rp = ((D.replay && D.replay.trades) || []).filter((x) => mine(x) && closed(x));
  const fwd = sys.session ? (Array.isArray(D.research) ? D.research : []) : (Array.isArray(D.trades) ? D.trades : []);
  const lv = fwd.filter((x) => mine(x) && closed(x) && (sys.shadow ? ownStream(x) : !x.shadow));
  return joinRecord(fold(rp, replayNet), fold(lv, merNet), hist);
}

// ─── all systems: coach.json `decay` ───
export function buildDecay(D, { now = Math.floor(Date.now() / 1000), base = loadBase() } = {}) {
  const at = new Date(now * 1000).toISOString();
  if (!base || !base.systems) return { at, v: 1, error: 'no baseline file (council/decay-base.json)', systems: [], decaying: [], watch: [] };
  const systems = [];
  for (const sys of SYSTEMS) {
    const b = base.systems[sys.id]; if (!b) continue;
    let a; try { a = assess(recordOf(sys, D, b), b); } catch (e) { a = { status: 'healthy', few: true, why: [`could not read the record: ${e.message}`] }; }
    systems.push({ id: sys.id, name: sys.name, desk: sys.desk, live: !sys.shadow, ...(sys.shadow && sys.since ? { shadowSince: sys.since } : {}), base: b.src, ...a });
  }
  const ids = (st) => systems.filter((s) => s.live && s.status === st).map((s) => s.id);
  return { at, v: 1, baseAt: base.at, ...(base.financing ? { financing: { asOf: base.financing.asOf, rate: base.financing.rate, systems: base.financing.systems } } : {}), rule: 'status and alert only: the monitor never changes a rule; the owner decides', systems, decaying: ids('decaying'), watch: ids('watch') };
}
