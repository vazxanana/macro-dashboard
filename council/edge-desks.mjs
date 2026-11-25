// The LIT desk's and the Engulfing desk's trackers (21 Nov 2026, owner: "The same for LIT and the same for engulfing. Plenty of
// trades and same panel like ict"). Like the Mosha tracker (council/mosha-desk.mjs, whose candle reader, record cleaner and merge
// they share), each runs inside the council loop and RECORDS what one reading marks on five markets, so its desk shows stored
// trades with an Open now panel:
//   node council/edge-desks.mjs <council-data dir> [--days N] [--only lit|eg]   -> <dir>/lit/desk.json, <dir>/eg/desk.json
// - Engulfing: the live Gold daily engulf rule (the Trader's block: a candle closes beyond the last opposite candle of the 3
//   before it and on the right side of its 20-candle average; limit at that candle's edge, stop past its far edge, 10R, a 1R
//   trail from +2R, out after 10 candles), read on D1, H4 and H1 candles and mirrored for sells. The Trader runs it on gold's
//   daily candles, buys only, 3 orders at most: the other timeframes, the sells and the other markets are this desk's choice.
// - LIT: the council's own detector (council/lit.mjs: an M15 sweep of a level out of an accumulation, then an M5 break), with
//   the pre-registered execution where it gives an order and else the two looser "study" executions of the 8 Nov replay
//   (a limit at the order block with no quality filters, else market on the break). Costs are not charged.
// PAPER RECORD ONLY: no order, alert, broker or mirror; nothing of the Trader reads these files. Every record has a stop on
// the losing side of its entry or it is not recorded. Neither is a tested rule (the LIT study was inconclusive, the engulf's
// own book study failed its bar): never call a desk's total an edge.
import fs from 'node:fs';
import path from 'node:path';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';
import { readDesk, writeDesk } from './desk-store.mjs';
import { foldWeekend } from './fills.mjs';
import { bars, merge, settle } from './mosha-desk.mjs';
import { P, cleanBars, agg15, series, fbosCandidates, XAU, SESS_TRADE, nyInfo } from './lit.mjs';
import { managePosition } from '../research/edge/lit/run.mjs';
import * as MS from '../research/edge/msnr-entry/run.mjs';
import { methodTrades, m1Trades, sopTrades3, efTrades, snrTrades, direction, engulfAt, KEY_NAME } from './eg-methods.mjs';
import { DESKS2 } from './edge-desks-2.mjs';

const require = createRequire(import.meta.url);
const SOP = require(fileURLToPath(new URL('../assets/mosha-sop.js', import.meta.url)));
export const MARKETS = Object.keys(SOP.MARKETS);   // the Engulfing desk's five; the LIT and MSNR desks read ELEVEN (their setups are rarer)
// the eleven markets of the LIT and MSNR desks (SOP.ALL until 23 Nov 2026, when the passing-edge desks added three markets to it)
export const ELEVEN = ['xau', 'xag', 'eurusd', 'gbpusd', 'nas100', 'usdjpy', 'audusd', 'usdcad', 'spx500', 'us30', 'de40'];
const SEC = SOP.SEC, NAME = { '1d': 'D1', '4h': 'H4', '1h': 'H1', '15m': 'M15', '5m': 'M5' };
const word = (d) => (d > 0 ? 'buy' : 'sell');
const fx = (mk) => { const d = SOP.ALL[mk].dec; return (v) => (+v).toFixed(d); };

// ─── Engulfing ───
export const EG = { k: 3, life: 20, hold: 10, sma: 20, target: 10, trail: [2, 1], tfs: ['1d', '4h', '1h'],
  // owner, 22 Nov 2026 ("keep the best rr for each individual one"): on the D1 and H4 readings a plain 4R target did best on their own
  // closed 2026 records (1R-4R, each trade replayed alone for up to 5 days, before costs), so they take a 4R target with no trail
  // and a 5-day limit. The H1 reading's own exit (10R, the 1R trail from +2R, 10 candles) was best and stays. Picked in sample.
  fixed: { '1d': { rr: 4, hold: 5 }, '4h': { rr: 4, hold: 30 } } };
// one filled order on the 5-minute candles: the stop first when a candle holds both, the trail only ever tightens
export function egOutcome(tr, m5, fillI, until) {
  const d = tr.side, r0 = tr.r0, o = { status: 'open', R: null, endT: null, exit: null, mfe: 0 }; let stop = tr.stop, moved = false;
  for (let i = fillI; i < m5.length; i++) { const b = m5[i];
    if (b.time >= until) { o.status = 'time'; o.exit = b.open; o.R = d * (b.open - tr.entry) / r0; o.endT = b.time; return o; }
    if (d > 0 ? b.low <= stop : b.high >= stop) { const px = i > fillI && (d > 0 ? b.open < stop : b.open > stop) ? b.open : stop;   // a candle that OPENS beyond the stop exits at its open, worse than the stop
      o.status = moved ? 'trail' : 'stopped'; o.exit = px; o.R = d * (px - tr.entry) / r0; o.endT = b.time; return o; }
    // a limit fills INSIDE its candle, and that candle's favourable extreme may have come before the fill: on the fill candle only
    // the stop counts (the worst case), never the target, the best-so-far or the trail
    if (i === fillI) continue;
    if (d > 0 ? b.high >= tr.target : b.low <= tr.target) { o.status = 'target'; o.exit = tr.target; o.R = tr.rr || EG.target; o.endT = b.time; return o; }
    o.mfe = Math.max(o.mfe, d * ((d > 0 ? b.high : b.low) - tr.entry) / r0);
    if (!tr.rr && o.mfe >= EG.trail[0]) { const ns = tr.entry + d * (o.mfe - EG.trail[1]) * r0; if (d > 0 ? ns > stop : ns < stop) { stop = ns; moved = true; } } }
  if (m5.length) o.float = d * (m5[m5.length - 1].close - tr.entry) / r0;
  o.stopNow = stop; return o;
}
export function egTrades(B, { from, market = 'xau' } = {}) {
  const m5 = B['5m'] || [], out = [], f = fx(market), end = m5.length ? m5[m5.length - 1].time + 300 : 0, one = new Set();
  for (const tf of EG.tfs) { const seen = new Set(), sec = SEC[tf], C = tf === '1d' ? foldWeekend(B[tf] || []) : (B[tf] || []);
    // signals are read from before the window: an order lives EG.life candles and a trade EG.hold more, so a D1 order placed
    // before `from` can still fill or close inside it (it was dropped, and its open record then stayed open for good); EG.k
    // further back only to know which zones already had their order
    const lo = from - (EG.life + EG.hold) * sec;
    for (let m = EG.sma + EG.k; m < C.length; m++) { const last = C[m], T0 = last.time + sec; if (T0 < lo - EG.k * sec || T0 > end) continue;
      const d = last.close > last.open ? 1 : last.close < last.open ? -1 : 0; if (!d) continue;
      let sma = 0; for (let j = m + 1 - EG.sma; j <= m; j++) sma += C[j].close; sma /= EG.sma;
      if (d > 0 ? !(last.close > sma) : !(last.close < sma)) continue;
      const eg = engulfAt(C, m, EG.k), base = eg ? C[eg.j] : null;   // the one engulf definition (council/eg-methods.mjs), with the live rule's look-back of EG.k candles
      if (!base) continue;
      if (seen.has(d + '|' + base.time)) continue; seen.add(d + '|' + base.time);   // one order a zone: a second candle closing beyond the same candle adds nothing
      if (T0 < lo) continue;
      const Z = SOP.sizes(market, last.close), entry = d > 0 ? base.high : base.low, stop = d > 0 ? base.low - Z.buf : base.high + Z.buf, r0 = Math.abs(entry - stop);
      if (!(r0 > Z.rmin) || (d > 0 ? stop >= entry : stop <= entry)) continue;
      // the order's life: a close through the zone's far edge cancels it, and it expires after EG.life candles
      let dead = T0 + EG.life * sec; for (let j = m + 1; j < C.length; j++) { if (C[j].time + sec >= dead) break; if (d > 0 ? C[j].close < base.low : C[j].close > base.high) { dead = C[j].time + sec; break; } }
      let fi = -1, i0 = 0; { let lo = 0, hi = m5.length; while (lo < hi) { const q = (lo + hi) >> 1; if (m5[q].time < T0) lo = q + 1; else hi = q; } i0 = lo; }   // the first 5-minute candle at or after the order (a long history is searched, not walked)
      for (let i = i0; i < m5.length; i++) { const b = m5[i]; if (b.time >= dead) break; if (d > 0 ? b.low <= entry : b.high >= entry) { fi = i; break; } }
      if (fi < 0) continue;
      const fx4 = EG.fixed[tf] || null, fillT = m5[fi].time, tr = { id: `${market === 'xau' ? '' : market + ':'}eg-${tf}-${d > 0 ? 'b' : 's'}-${T0}`, market, kind: 'eg-' + tf, label: `${NAME[tf]} engulf zone`, h: tf, l: '5m', side: d, t: fillT,
        entry, stop, target: entry + d * (fx4 ? fx4.rr : EG.target) * r0, r0 };
      if (fx4) tr.rr = fx4.rr;
      const oc = egOutcome(tr, m5, fi, fillT + (fx4 ? fx4.hold : EG.hold) * sec);
      if (T0 < from && oc.endT != null && oc.endT < from) continue;   // an older order that also ended before the window
      Object.assign(tr, { status: oc.status, R: oc.R, endT: oc.endT, exit: oc.exit, mfe: oc.mfe, float: oc.float });
      tr.log = [
        { t: T0, text: `${NAME[tf]} engulf ${word(d)}: the candle closed ${d > 0 ? 'above the high' : 'below the low'} of the last ${d > 0 ? 'red' : 'green'} candle (${f(base.low)} to ${f(base.high)}) and ${d > 0 ? 'above' : 'below'} its 20-candle average ${f(sma)}. A ${word(d)} limit rests at ${f(entry)}, stop ${f(stop)}.` },
        { t: fillT, text: `Price came back to the zone: ${word(d)} ${f(entry)}, stop ${f(stop)} (risk ${f(r0)}), target ${f(tr.target)} ` + (fx4 ? `(${fx4.rr}R), no trail, out after ${fx4.hold} ${NAME[tf]} candles.` : `(${EG.target}R), a 1R trail from +2R, out after ${EG.hold} ${NAME[tf]} candles.`) },
        oc.status === 'target' ? { t: oc.endT, text: `Target reached: +${(fx4 ? fx4.rr : EG.target).toFixed(2)}R.` }
          : oc.status === 'stopped' ? { t: oc.endT, text: 'Stopped: −1.00R' + (oc.mfe >= 1 ? ` after running +${oc.mfe.toFixed(1)}R first.` : '.') }
            : oc.status === 'trail' ? { t: oc.endT, text: `Trailing stop: ${oc.R >= 0 ? '+' : '−'}${Math.abs(oc.R).toFixed(2)}R (best +${oc.mfe.toFixed(1)}R).` }
              : oc.status === 'time' ? { t: oc.endT, text: `Time limit: closed at ${f(oc.exit)}, ${oc.R >= 0 ? '+' : '−'}${Math.abs(oc.R).toFixed(2)}R.` }
                : { t: null, text: 'Still open on the last candle read' + (oc.float != null ? ` (${oc.float >= 0 ? '+' : '−'}${Math.abs(oc.float).toFixed(2)}R now` + (oc.stopNow !== stop ? `, stop trailed to ${f(oc.stopNow)}` : '') + ').' : '.') }];
      tr.marks = [{ kind: 'zone', top: base.high, bot: base.low, a: base.time, at: T0, label: `${NAME[tf]} engulf zone` }, { kind: 'level', p: sma, a: C[m + 1 - EG.sma].time, at: T0, label: '20-candle average', under: d > 0 }];
      // ONE order is recorded once (21 Nov 2026): when a base candle of a lower timeframe has the same high and low as the higher
      // one's, both readings are the same order (side, fill candle, entry, stop, target). The higher timeframe is read first and kept.
      const ok = [d, fillT, entry, stop, tr.target].join('|'); if (one.has(ok)) continue; one.add(ok);
      out.push(tr); } }
  return out.sort((a, b) => a.t - b.t);
}

// ─── LIT ───
// The two study executions (21 Nov 2026): when price runs past the sweep's extreme they no longer just follow it. A new extreme is a
// NEW sweep of the same level (`resweep`): the sweep tests are run again on its M15 candles (litResweep), at most LIT_RESWEEPS times,
// inside the one waiting period counted from the FIRST extreme, and the break level is the swing known at the new extreme. Both skip
// a stop nearer than LIT_MIN_STOP of the price (the method's smallest stop; a skip, never a wider or missing stop).
export const LIT_MIN_STOP = 0.00014, LIT_RESWEEPS = 2;
export const LIT_SETS = [
  { id: 'rule', label: 'LIT · the rule', mxReanchor: false, quality: true, minRR: P.minRR, cap: true, entry: 'limit', expiryBars: P.expiryBars },
  { id: 'loose', label: 'LIT · loose limit', mxReanchor: true, resweep: true, minStop: LIT_MIN_STOP, quality: false, minRR: 1.5, cap: false, entry: 'limit', expiryBars: 48 },
  { id: 'break', label: 'LIT · market on the break', mxReanchor: true, resweep: true, minStop: LIT_MIN_STOP, quality: false, minRR: 1.5, cap: false, entry: 'market' }];
// the same two executions as they were until 21 Nov 2026 (the extreme followed with no test, no smallest stop): `first: true` reads
// them, so the desk-slices study still reproduces; nothing on the desk does
export const litOldSet = (x) => ({ ...x, resweep: false, minStop: 0 });
// A sweep of the Asia session's own high (low) alone is not a level to fade: it counts only when the same move (the sweep candle to
// the candle that closed back, up to its extreme) also trades through structure from BEFORE that day's Asia session that was still
// untaken: a confirmed M15 swing high, or an earlier trading day's high, of the last LIT_ASIA_LOOK candles. A filter on the detector's
// candidates (the detector itself is the pre-registered one and is not changed). S15: the sign-normalised M15 series; true = Asia alone.
export const LIT_ASIA_LOOK = 960;
export function litAsiaAlone(S15, cd) {
  if (cd.kind !== 'ASIA') return false;
  const { h, ny, pivH, tick } = S15, day = ny[cd.s].day, lo = Math.max(0, cd.s - LIT_ASIA_LOOK), dayHi = new Map();
  for (let k = cd.s - 1; k >= lo; k--) { const dk = ny[k].day; if (dk !== day && !(dayHi.get(dk) >= h[k])) dayHi.set(dk, h[k]); }
  let rm = -Infinity;   // the highest high between the older candle and the sweep candle
  for (let k = cd.s - 1; k >= lo && rm < cd.MX; k--) {
    if (ny[k].day !== day && (pivH[k] || dayHi.get(ny[k].day) === h[k]) && rm < h[k] + tick && cd.MX >= h[k] + tick) return false;
    rm = Math.max(rm, h[k]); }
  return true;
}
// the detector's own sweep tests (council/lit.mjs `advance`, repeated here because that port is pinned) on a later M15 candle i0 that
// ran past the first sweep's extreme: in London or the New York morning and not the 09:30 candle, a close back inside the level within
// 3 candles, never two closes beyond it, no higher high after the close back, a vector within two candles either side. Returns
// { s, r, conf, MX } once the confirming candle is in (nothing later is read), else null.
export function litResweep(S15, cd, i0) {
  const { h, c, vec, ny, n } = S15; if (!(i0 > cd.conf && i0 < n) || !SESS_TRADE.includes(ny[i0].sess) || ny[i0].hm === 930) return null;
  let MX = -Infinity, above = 0, r = null;
  for (let i = i0; i < n; i++) {
    if (r == null) { if (i - i0 >= P.rejectBars) return null; MX = Math.max(MX, h[i]); if (c[i] < cd.L) r = i; else if (++above >= 2) return null; if (r == null) continue; }
    else if (h[i] > MX) return null;
    for (let j = Math.max(0, i0 - P.vecWindow); j <= Math.min(i, r + P.vecWindow); j++) if (vec[j]) return { s: i0, r, conf: i, MX };
    if (i >= r + P.vecWindow) return null; }
  return null;
}
const lowerBound = (arr, v) => { let lo = 0, hi = arr.length; while (lo < hi) { const m = (lo + hi) >> 1; if (arr[m] < v) lo = m + 1; else hi = m; } return lo; };
// an order from an M15 candidate on the (sign-normalised, short-side) M5 series: council/lit.mjs buildOrder with the study's switches
export function litOrder(S5, cd, M, set, S15 = null) {
  const { h, l, c, o, t, vec, pivL, atr, body, n } = S5;
  let j0 = lowerBound(t, cd.confEnd); const sIdx = lowerBound(t, cd.t), rEnd = lowerBound(t, cd.rEnd); if (j0 >= n || sIdx >= rEnd) return null;
  let mxIdx = sIdx; for (let k = sIdx; k < rEnd; k++) if (h[k] > h[mxIdx]) mxIdx = k;
  let MX = h[mxIdx];
  const swingBefore = (upto) => { for (let k = upto - 1; k >= Math.max(0, upto - 288); k--) if (pivL[k] && k + P.pivot < j0) return k; return -1; };
  let p = swingBefore(mxIdx); if (p < 0) return null;
  let level = l[p], b = -1, res = 0; const dead = mxIdx + P.rbosWait;   // the one waiting period, from the first extreme
  for (let k = mxIdx + 1; k <= Math.min(n - 2, set.resweep ? dead : mxIdx + P.rbosWait); k++) {
    if (h[k] > MX) { if (!set.mxReanchor) return null;
      if (set.resweep) {   // a new extreme is a new sweep of the same level: tested like the first, its own confirmation, the swing known by then
        if (!S15 || ++res > LIT_RESWEEPS) return null;
        const rs = litResweep(S15, cd, lowerBound(S15.t, Math.floor(t[k] / 900) * 900)); if (!rs) return null;
        j0 = lowerBound(t, S15.t[rs.conf] + 900); if (j0 >= n) return null;
        const e = lowerBound(t, S15.t[rs.r] + 900); mxIdx = k; for (let q = k; q < e; q++) if (h[q] > h[mxIdx]) mxIdx = q;
        MX = h[mxIdx]; p = swingBefore(mxIdx); if (p < 0) return null; level = l[p]; k = mxIdx; continue; }
      MX = h[k]; mxIdx = k; const p2 = swingBefore(k); if (p2 >= 0) level = l[p2]; continue; }
    if (l[k] <= level) { b = k; break; } }
  if (b < 0) return null;
  if (set.quality) { if (!(vec[b] || b - mxIdx <= P.rbosFast)) return null;
    let ov = 0, cnt = 0; for (let k = mxIdx + 1; k <= b; k++) { cnt++; const rng = h[k] - l[k], inter = Math.min(h[k], h[k - 1]) - Math.max(l[k], l[k - 1]); if (rng > 0 && inter / rng > P.overlapRatio) ov++; }
    if (cnt && ov / cnt > P.overlapShare) return null; if (c[b + 1] > level) return null; }
  let d = b; for (let k = mxIdx; k <= b; k++) if (vec[k] && c[k] < o[k]) { d = k; break; }
  let ob = -1; for (let k = d - 1; k >= mxIdx; k--) if (c[k] > o[k]) { ob = k; break; }
  if (ob < 0) for (let k = Math.max(mxIdx, d - 3); k <= d - 1; k++) if (ob < 0 || body[k] < body[ob]) ob = k;
  if (ob < 0) return null;
  const jA = Math.max(j0, b + 2); if (jA >= n) return null;
  // market on the break: at the close of the candle after the break, and never before the M15 sweep itself is confirmed
  // (the M5 break can come first; until 21 Nov 2026 the entry was then taken up to 20 minutes before the sweep was known)
  const mk = Math.min(n - 1, Math.max(b + 1, j0 - 1));
  const entry = set.entry === 'market' ? c[mk] : o[ob], stop = MX + M.stopExtra(atr[jA - 1], MX), risk = stop - entry; if (!(risk > 0)) return null;
  const target = cd.accLow, rr = (entry - target) / risk; if (!(rr > set.minRR)) return null;
  if (set.cap && !(risk <= P.capFrac * Math.abs(entry))) return null;
  if (set.minStop && !(risk >= set.minStop * Math.abs(entry))) return null;   // nearer than the method's smallest stop: no trade
  return { jA, entry, stop, target, risk, rr, MX, b, ob, mxIdx, level, mk, res, j0, p, market: set.entry === 'market' };
}
// the fill (a touch of the limit, or at once for a market order) and the study's own management of the position
export function litFill(S5, M, ord, set) {
  const { h, l, o, ny, n } = S5;
  if (ord.market) { const k = ord.mk; for (let q = ord.b + 1; q <= k; q++) if (h[q] > ord.MX || l[q] <= ord.target) return null;   // the sweep's extreme or the target went while waiting for the confirmation
    return ny[k].hm === 930 ? null : managePosition(S5, M, ord, ord.entry, k); }
  for (let k = ord.jA; k < Math.min(n, ord.jA + set.expiryBars); k++) {
    if (ny[k].hm !== 930 && h[k] >= ord.entry) { if (l[k] <= ord.target && !(h[k] >= ord.stop)) return null; const fp = Math.max(ord.entry, o[k]);
      // the fill candle also reaches the stop: stopped in that candle (the study's management starts a candle later and never saw it)
      if (h[k] >= ord.stop) { const risk = ord.stop - fp; return risk > 0 ? { filled: true, k, exitIdx: k, end: k, t: S5.t[k], tExit: S5.t[k], fp: S5.sign * fp, exit: S5.sign * ord.stop, risk, kind: 'stop', R: -1 } : null; }
      return managePosition(S5, M, ord, fp, k); }
    if (h[k] > ord.MX || l[k] <= ord.target) return null; }
  return null;
}
// the buffer scales from the trade's OWN price (the sweep's extreme), not the newest candle's: a stop must not change between two reads
const litM = (market) => { const dec = SOP.ALL[market].dec;
  return market === 'xau' ? { ...XAU, cost: () => 0 } : { key: market, sym: market, tick: Math.pow(10, -dec), stopExtra: (atr5, px) => { const q = Math.abs(px) / 4000; return 0.30 * q + Math.max(0.1 * atr5, 0.30 * q); }, skip: XAU.skip, cost: () => 0 }; };
const LEVEL = { pd: "the previous day's", pw: "the previous week's", acc: "the accumulation's own", eqh: 'equal', ASIA: "the Asia session's", LONDON: "the London session's", NY_AM: "the New York morning's" };
// Each execution is its OWN stream (21 Nov 2026): every candidate is tried with every execution, one position at a time per
// execution. Until then a candidate was recorded under the first execution that filled, so "market on the break" held only the
// candidates whose limit orders later did not fill: chosen with knowledge of the future (desk-slices T3, INVALID).
// `first: true` is that old reading, kept only so the desk-slices study still reproduces (with the old executions, no Asia filter
// and no daily limits).
// The method's daily limits (21 Nov 2026; `limits`), on every execution, each its own stream: at most one fill from a London sweep
// and one from a New York-morning sweep a trading day (18:00 to 17:00 New York), no new trade that day after a win or once the
// day's closed result is at or under -1.5R. They are risk rules of the method, not of one execution, so the two study executions
// take them too. `asia`: a sweep of the Asia session's extreme alone gives no trade (litAsiaAlone).
export function litTrades(B, { from, market = 'xau', sets = LIT_SETS, first = false, limits = !first, asia = !first } = {}) {
  if (first) sets = sets.map(litOldSet);
  const raw = B['5m'] || []; if (!raw.length) return [];
  const M = litM(market), b5 = cleanBars(raw, M), m15 = agg15(b5), f = fx(market), out = [], lastT = b5.length ? b5[b5.length - 1].t : 0, meta = new Map();
  for (const dir of ['short', 'long']) { const mirror = dir === 'long', S15 = series(m15, mirror, M.tick), S5 = series(b5, mirror, M.tick), sg = S5.sign, d = dir === 'short' ? -1 : 1;
    for (const cd of fbosCandidates(S15)) { cd.confEnd = S15.t[cd.conf] + 900; cd.rEnd = S15.t[cd.r] + 900;
      if (asia && litAsiaAlone(S15, cd)) continue;
      const gots = [];
      for (const set of sets) { const od = litOrder(S5, cd, M, set, S15); if (!od) continue; const sim = litFill(S5, M, od, set); if (sim && sim.filled) { gots.push({ set, od, sim }); if (first) break; } }
      for (const { set, od, sim } of gots) { const fillT = sim.t + 300;
      const entry = sim.fp, stop = sg * od.stop, target = sg * od.target, r0 = Math.abs(entry - stop); if (!(r0 > 0) || (d > 0 ? stop >= entry : stop <= entry)) continue;
      if (set.minStop && !(r0 >= set.minStop * Math.abs(entry))) continue;   // a limit filled through a gap, nearer its stop than the smallest stop
      // the study's management calls the last candle read the "day's end": a trade whose exit is that candle is still OPEN
      const open = (sim.kind === 'dataEnd' || sim.kind === 'dayEnd') && sim.tExit >= lastT, status = open ? 'open' : sim.kind === 'target' ? 'target' : sim.kind === 'stop' ? 'stopped' : sim.kind === 'be' ? 'breakeven' : 'dayend';
      let mfe = 0; for (let q = sim.k + (od.market ? 0 : 1); q <= sim.exitIdx; q++) mfe = Math.max(mfe, (od.entry - S5.l[q]) / od.risk);
      const tr = { id: `${market === 'xau' ? '' : market + ':'}lit-${set.id}-${dir === 'short' ? 's' : 'b'}-${S5.t[od.jA]}`, market, kind: 'lit-' + set.id, label: set.label, h: '15m', l: '5m', side: d, t: fillT, entry, stop, target, r0,
        status, R: open ? null : sim.R, endT: open ? null : sim.tExit + 300, exit: open ? null : sim.exit, mfe, float: open ? sim.R : undefined };
      const lv = sg * cd.L, aLo = Math.min(sg * cd.accLow, sg * cd.accHigh), aHi = Math.max(sg * cd.accLow, sg * cd.accHigh), mx = sg * od.MX, obLo = Math.min(sg * S5.h[od.ob], sg * S5.l[od.ob]), obHi = Math.max(sg * S5.h[od.ob], sg * S5.l[od.ob]);
      tr.log = [
        { t: cd.t + 900, text: `M15 sweep: price ran ${d < 0 ? 'above' : 'below'} ${LEVEL[cd.kind] || cd.kind} ${d < 0 ? 'high' : 'low'} ${f(lv)} out of an accumulation of ${cd.accN} candles (${f(aLo)} to ${f(aHi)}) and closed back inside.` },
        { t: S5.t[od.b] + 300, text: `M5 break ${word(d)}: the extreme of the sweep is ${f(mx)}` + (od.res ? ` (the level was swept again ${od.res === 1 ? 'once' : od.res + ' times'}, each time closing back inside)` : '') + `; the order block is ${f(obLo)} to ${f(obHi)}.` },
        { t: fillT, text: `${set.entry === 'market' ? 'Market entry on the candle after the break' : 'The limit at the order block filled'}: ${word(d)} ${f(entry)}, stop ${f(stop)} (risk ${f(r0)}), target ${f(target)} (${(Math.abs(target - entry) / r0).toFixed(1)}R, the accumulation's far side).` + (set.id === 'rule' ? '' : ' A looser execution than the rule: for study.') },
        open ? { t: null, text: `Still open on the last candle read (${sim.R >= 0 ? '+' : '−'}${Math.abs(sim.R).toFixed(2)}R now).` }
          : { t: sim.tExit + 300, text: (status === 'target' ? 'Target reached' : status === 'stopped' ? 'Stopped' : status === 'breakeven' ? 'Stopped at break-even after two swing breaks' : 'Closed at the end of the New York day') + `: ${sim.R >= 0 ? '+' : '−'}${Math.abs(sim.R).toFixed(2)}R.` }];
      tr.marks = [{ kind: 'zone', top: aHi, bot: aLo, a: S15.t[Math.max(0, cd.s - cd.accN)], at: cd.t, label: 'Accumulation' }, { kind: 'level', p: lv, a: cd.t, at: cd.t + 900, label: 'Swept level', under: d > 0 },
        { kind: 'level', p: mx, a: S5.t[od.mxIdx], at: S5.t[od.b] + 300, label: 'MX', under: d > 0 }, { kind: d < 0 ? 'vr' : 'bvr', top: obHi, bot: obLo, a: S5.t[od.ob], at: S5.t[od.b] + 300, label: 'Order block' }];
      meta.set(tr, { sess: cd.sess, day: nyInfo(sim.t).day }); out.push(tr); } } }
  // one position at a time on a market per execution: a later entry inside an earlier trade's life is left out
  out.sort((a, b) => a.t - b.t); const keep = [], busy = {}, days = {}, ids = new Set();
  for (const r of out) { const k = first ? '' : r.kind; if (r.t < (busy[k] || 0) || (!first && ids.has(r.id))) continue;
    if (limits) { const m = meta.get(r), dk = k + '|' + m.day, ds = days[dk] || (days[dk] = { fills: {}, R: 0, won: false });
      if (ds.won || ds.R <= P.dayCapR || ds.fills[m.sess]) continue;   // the day is done, or that session has had its trade
      ds.fills[m.sess] = 1; if (r.R != null) { ds.R += r.R; if (r.R > 0) ds.won = true; } }   // an earlier trade is closed before a later one starts (one at a time)
    busy[k] = r.endT || Infinity; ids.add(r.id); if (r.t >= from) keep.push(r); }   // a trade from before the window still blocks
  return keep;
}

// ─── MSNR ───
// Kinds msnr-main / msnr-other are the owner's earlier scalp method (direction call + M15 / M5 engulf), the entry of the desk's
// own MSNR study: not an entry of any of the owner's documents (the gold plan's entries are kinds msnr-sop / msnr-qm).
// The direction call of the desk's own MSNR study (research/edge/msnr-entry, its functions imported and not edited): on H4
// candles, a close beyond the last swing level that stood before price first touched a live Daily key level turns the call.
// The entry is that study's: a 15-minute body engulf, then within 45 minutes a 5-minute body engulf the same way, market at
// the next 5-minute open, stop a buffer past the trigger pair, target 1.5R, out after 12 hours. Only entries WITH the call are
// recorded, one position at a time a market. On a market other than gold the buffer and the smallest stop are the same share
// of price as gold's (the desk's own choice). The study FAILED after costs (0 of 3): a paper record, never an edge.
// rr / hold: the study's 1.5R and 12 hours until 22 Nov 2026. Owner ("keep the best rr for each individual one"): 4R in the
// 12-16 UTC window and 3R at other hours did best on the method's own closed 2026 records (1R-4R, each trade alone for up to
// 5 days, before costs), so those are the targets and the time limit is 5 days. Picked in sample, not a tested result.
export const MSNR = { rr: 1.5, rrMain: 6, rrOther: 3, hold: 120 * 3600, main: [12, 16] };
// the study's own simulate at full precision: a gap through the stop exits at the open, the stop before the target in one
// candle, the first candle opening 12 hours or more after the entry exits at its open; null = still open
function msnrSim(M5, c, r0, rr, hold = MS.P.HOLD) { const s = c.side, target = c.entry + s * rr * r0;
  for (let k = c.i; k < M5.length; k++) { const b = M5[k];
    if (k > c.i && b.time >= c.t + hold) return { closed: b.time, exitPx: b.open, exit: 'time' };
    if (k > c.i && (s > 0 ? b.open <= c.stop : b.open >= c.stop)) return { closed: b.time, exitPx: b.open, exit: 'stop' };
    if (s > 0 ? b.low <= c.stop : b.high >= c.stop) return { closed: b.time, exitPx: c.stop, exit: 'stop' };
    if (s > 0 ? b.high >= target : b.low <= target) return { closed: b.time, exitPx: target, exit: 'target' }; }
  return null; }
// a two-candle engulf: p is the first (left) candle, c the second; c is of the other colour and closes beyond p's high / low
export const eg2 = (p, c, d) => !!p && !!c && (d > 0 ? p.close < p.open && c.close > c.open && c.close > p.high : p.close > p.open && c.close < c.open && c.close < p.low);
export function msnrTrades(B, { from, market = 'xau', against = false } = {}) {   // against: research only, the entries opposite to the direction
  const raw = B['5m'] || [], H1 = B['1h'] || []; if (raw.length < 50 || H1.length < 200) return [];
  const M5 = raw.map((b) => ({ time: b.time, open: +b.open, high: +b.high, low: +b.low, close: +b.close })), f = fx(market), lastT = M5[M5.length - 1].time;
  // the buffer and the smallest stop scale from each trade's OWN entry price (not the newest candle's: a stop must not change
  // between two reads), so the study's candidates are listed without either and both are applied below
  const keep = { PAD: MS.P.PAD, MIN_R0: MS.P.MIN_R0 }, qOf = (px) => (market === 'xau' ? 1 : px / 4000); let cand;
  try { MS.P.PAD = 0; MS.P.MIN_R0 = 0; cand = MS.candidates(M5).cand; } finally { MS.P.PAD = keep.PAD; MS.P.MIN_R0 = keep.MIN_R0; }
  // the call from a long H4 history (hourly candles grouped into the study's own UTC 4-hour buckets), as known at the trigger's close
  const H4 = MS.group(H1.map((b) => ({ time: b.time, open: +b.open, high: +b.high, low: +b.low, close: +b.close })), MS.bucket(MS.P.H4)), D = direction(H4, MS.dayKey, 86400), dir = D.call;
  const M15g = MS.group(M5, MS.bucket(MS.P.M15)), lower15 = (t) => { let lo = 0, hi = M15g.length - 1; while (lo < hi) { const m = (lo + hi + 1) >> 1; if (M15g[m].time <= t) lo = m; else hi = m - 1; } return lo; };
  const out = []; let h = -1, busy = -Infinity;
  for (const c of cand) {
    while (h + 1 < H4.length && H4[h + 1].time + MS.P.H4 <= c.trig + MS.P.M5) h++;
    const call = h >= 0 ? dir[h] : 0; if (!call || c.side !== (against ? -call : call) || c.t <= busy) continue;
    const ev = D.last[h] >= 0 ? D.events[D.last[h]] : null;
    // the stop and the result are worked out here at full precision: the study's own code rounds prices to 3 decimals (it was
    // written for gold), which on a 5-decimal market put every stop on a 0.001 grid and booked "target" trades at odd R
    const d = c.side, a = M5[c.i - 1], b0 = M5[c.i - 2], pad = keep.PAD * qOf(c.entry), stop = d > 0 ? Math.min(a.low, b0.low) - pad : Math.max(a.high, b0.high) + pad, r0 = d * (c.entry - stop); if (!(r0 >= keep.MIN_R0 * qOf(c.entry))) continue; c.stop = stop;
    // AN EG IS TWO CANDLES (owner, 22 Nov 2026: "eg is a 2 candle pattern that the second (right) engulfs the first candle (left)",
    // "next candle needs to close"): the second candle is of the other colour and CLOSES beyond the first one's high (buy) / low
    // (sell). The study's candidates are body engulfs; one whose 15-minute pair or 5-minute pair does not close beyond the first
    // candle is not taken. The zone drawn is the FIRST candle, wick to wick (it was the range of both candles).
    const j15 = lower15(c.setup - MS.P.M15), e15 = j15 > 0 && M15g[j15].time === c.setup - MS.P.M15 ? [M15g[j15 - 1], M15g[j15]] : null;
    if (!eg2(b0, a, d) || (e15 && !eg2(e15[0], e15[1], d))) continue;
    const main = c.hour >= MSNR.main[0] && c.hour < MSNR.main[1], rr = main ? MSNR.rrMain : MSNR.rrOther, o = msnrSim(M5, c, r0, rr, MSNR.hold), target = c.entry + d * rr * r0;
    busy = o ? o.closed : Infinity; if (c.t < from) continue;
    let mfe = 0, endI = o ? M5.findIndex((b) => b.time === o.closed) : M5.length - 1; for (let k = c.i; k <= endI && k < M5.length; k++) mfe = Math.max(mfe, d * ((d > 0 ? M5[k].high : M5[k].low) - c.entry) / r0);
    const status = !o ? 'open' : o.exit === 'target' ? 'target' : o.exit === 'time' ? 'time' : 'stopped', R = o ? d * (o.exitPx - c.entry) / r0 : null, fl = o ? undefined : d * (M5[M5.length - 1].close - c.entry) / r0;
    const tr = { id: `${market === 'xau' ? '' : market + ':'}msnr-${d > 0 ? 'b' : 's'}-${c.t}`, market, kind: main ? 'msnr-main' : 'msnr-other', label: main ? 'Earlier scalp method · 12-16 UTC' : 'Earlier scalp method · other hours', h: '4h', l: '5m', side: d, t: c.t,
      entry: c.entry, stop: c.stop, target, r0, status, R, endT: o ? o.closed : null, exit: o ? o.exitPx : null, mfe, float: fl };
    tr.log = [
      ...(ev ? [{ t: ev.zoneAt, text: `Daily ${d > 0 ? 'buy' : 'sell'}-side key level: ${KEY_NAME[ev.kind]} ${f(ev.bottom)} to ${f(ev.top)}.` },
        { t: ev.tapT, text: `Price tapped it while H4 was still breaking ${d > 0 ? 'down' : 'up'}. The last H4 ${d > 0 ? 'A' : 'V'} level before the tap, ${f(ev.level)}, is the external one.` },
        { t: ev.t + MS.P.H4, text: `An H4 candle closed ${d > 0 ? 'above' : 'below'} ${f(ev.level)}: an external BO ${word(d)} after a tapped Daily level. Direction ${word(d)}.` }]
        : [{ t: H4[h].time + MS.P.H4, text: `Direction ${word(d)} on H4 with the Daily key levels (as known at the close of the last H4 candle).` }]),
      { t: c.setup, text: `A 15-minute engulf ${word(d)} closed (the second candle closed ${d > 0 ? 'above the high' : 'below the low'} of the first): the entry is armed for 45 minutes.` },
      { t: c.trig + MS.P.M5, text: `A 5-minute engulf ${word(d)} closed inside that time. ${d > 0 ? 'Buy' : 'Sell'} at the next 5-minute open ${f(c.entry)}, stop ${f(c.stop)} (risk ${f(r0)}), target ${f(target)} (${rr}R), out after 5 days.` },
      !o ? { t: null, text: 'Still open on the last candle read' + (fl != null ? ` (${fl >= 0 ? '+' : '−'}${Math.abs(fl).toFixed(2)}R now).` : '.') }
        : status === 'target' ? { t: o.closed, text: `Target reached: +${rr.toFixed(2)}R.` }
          : status === 'time' ? { t: o.closed, text: `Time limit: closed at ${f(o.exitPx)}, ${R >= 0 ? '+' : '−'}${Math.abs(R).toFixed(2)}R.` }
            : { t: o.closed, text: `Stopped: ${R >= 0 ? '+' : '−'}${Math.abs(R).toFixed(2)}R` + (mfe >= 1 ? ` after running +${mfe.toFixed(1)}R first.` : '.') }];
    const i0 = c.i - 1;
    tr.marks = (ev ? [{ kind: 'zone', top: ev.top, bot: ev.bottom, a: ev.zoneT, at: ev.zoneAt, label: 'Daily ' + ({ v: 'V level', a: 'A level', eg: 'EG zone', ef: 'EF zone', dom: 'DOM zone', oc: 'OC level' })[ev.kind] },
      { kind: 'level', p: ev.level, a: ev.levelT, at: ev.t + MS.P.H4, label: `H4 ${d > 0 ? 'A' : 'V'} level · BO ${word(d)}`, under: d < 0 }] : [])
      .concat(e15 ? [{ kind: 'zone', top: e15[0].high, bot: e15[0].low, a: e15[0].time, at: c.setup, label: 'M15 EG' }] : [],
        [{ kind: 'zone', top: M5[i0 - 1].high, bot: M5[i0 - 1].low, a: M5[i0 - 1].time, at: c.trig + MS.P.M5, label: 'M5 EG' }]);
    out.push(tr); }
  return out;
}

// ─── the files ───
export const DESKS = {
  eg: { tfs: ['1d', '4h', '1h', '15m', '5m', '1m'], markets: MARKETS, read: (B, o) => egTrades(B, o).concat(methodTrades(B, o), methodTrades(B, { ...o, span: 'next' }), m1Trades(B, o), sopTrades3(B, o), efTrades(B, o)), note: 'A paper record of the desk\'s readings of the engulf on five markets, buys and sells: the engulf rule on D1, H4 and H1 candles, and three zone methods (the plan with the Daily, the short method in an H4 zone, the direct entry on fresh zones) with a 30-pip stop; the plan and the short method take the target the owner picked for each on the 2026 records (1R; the short method with the next-candle engulf 4R), the direct entry none: its stop is trailed with the 5-minute engulf zones that fail. The plan and the short method are recorded twice, apart: with the engulf completed within three candles, and with the next-candle engulf only. A fifth reading, apart: inside a 15-minute engulf zone, the most recent one-minute engulf of the other side fails and the entry is that close (the stop past the extreme made since, a 2R target: the desk\'s own choice). A sixth reading, apart, the three-timeframe SOP on three chains (Daily / H4 / H1, H4 / H1 / M15, H1 / M15 / M5): an engulf zone on the first timeframe, price back in it and an engulf at it on the second, an engulf at that one on the third, each completed within three candles; a limit at the middle of the last zone, the stop past the second timeframe\'s zone, a 2R target (the order\'s life and the exact target are the desk\'s own choice). A seventh reading, apart, from a gold example of 20-23 Nov 2026: an H4 engulf zone that failed (an H4 close through it) turns into a barrier the other way (an EF); price comes back into it, an M15 BO with it (a close beyond the last M15 A / V level and out of the zone), then a limit at the zone\'s near side, the stop past its far side, the target the near side of the nearest H4 engulf zone of the other side still standing, only when it is 2R or more away (the barrier\'s 20 days, the BO\'s window and the order\'s life are the desk\'s own choice). Nothing is traded, results are before costs, and none is a tested rule.' },
  msnr: { tfs: ['1d', '4h', '1h', '15m', '5m'], extra: { '1h': 170 }, markets: ELEVEN, read: (B, o) => msnrTrades(B, o).concat(snrTrades(B, o)), note: 'A paper record of two MSNR readings. On eleven markets: the owner\'s earlier scalp method (direction call + M15 / M5 engulf): the direction call (H4, with Daily key levels) in front of an M15 then M5 engulf entry, entries with the call only; it is not an entry of the plan documents, and the desk\'s own study of it failed after costs. On gold: the plan with a fresh Daily level rejected (V, A or open-close level) and an H4 break within three trading days for the side, H4 zones, a 15- or 30-minute engulf entry or a 15- or 30-minute QM entry at its left shoulder, one entry a visit to a zone, a 30-pip stop and the target the owner picked on the 2026 records (60 pips on the engulf entry, 90 on the QM entry; the plan\'s own figure is 90). Nothing is traded and results are before costs.' },
  lit: { tfs: ['5m'], markets: ELEVEN, read: litTrades, note: 'A paper record of the LIT detector on eleven markets, with the rule\'s execution where it gives an order and two looser study executions otherwise: nothing is traded, results are before costs, and it is not a tested rule.' },
  // the seven desks of the passing edges (23 Nov 2026, council/edge-desks-2.mjs)
  ...DESKS2 };
// the desks the council loop runs on its older line; the passing-edge desks run on a line of their own (council.yml)
export const OLD = ['eg', 'msnr', 'lit'];
export function buildDesk(name, perMarket, prev, now, days, fromT = null) {
  let records = (prev && prev.records) || [], through = (prev && prev.through) || 0; const read = [];
  // a record of a market the desk no longer reads leaves it (owner, 25 Nov 2026: gold, silver and USD/CAD left the Box fade desk)
  records = records.filter((r) => DESKS[name].markets.includes(r.market || 'xau'));
  for (const [market, B] of perMarket) { if (!B['5m'] || !B['5m'].length) continue;
    const last = B['5m'][B['5m'].length - 1].time + 300, from = fromT != null ? Math.max(fromT, last - days * 86400) : last - days * 86400;
    const fresh = DESKS[name].read(B, { from, market }); records = settle(merge(records, fresh, now), new Set(fresh.map((r) => r.id)), B['5m'], market); read.push(market); through = Math.max(through, last); }
  const s = SOP.summary(records);
  return { v: 1, desk: name, at: new Date(now * 1000).toISOString(), markets: [...new Set(records.map((r) => r.market || 'xau'))], read, feed: 'OANDA', through, days,
    since: records.length ? records[records.length - 1].t : null, counts: { n: s.n, closed: s.closed, open: s.open, live: records.filter((r) => r.src === 'live').length }, note: DESKS[name].note, records };
}
export async function main(dir, { now = Math.floor(Date.now() / 1000), days = SOP.DAYS, only = null, from = null, get = fetch } = {}) {
  const out = {}, want = only ? String(only).split(',').map((x) => x.trim()).filter(Boolean) : null, cache = new Map();
  // one read of a market's candles serves every desk of the run (the passing-edge desks all read the same 5-minute candles)
  const read = (tf, m, d) => { const key = `${m}|${tf}|${d}`; if (!cache.has(key)) cache.set(key, bars(tf, now, get, d, m)); return cache.get(key); };
  for (const name of Object.keys(DESKS)) { if (want && !want.includes(name)) continue;
    let prev = null; try { prev = readDesk(dir, name); } catch (e) { console.log(e.message); continue; }   // the logs live in <name>/detail/ (council/desk-store.mjs)
    const per = [];
    for (const m of DESKS[name].markets) { try { const B = {}; for (const tf of DESKS[name].tfs) B[tf] = await read(tf, m, days + ((DESKS[name].extra || {})[tf] || 0)); per.push([m, B]); } catch (e) { console.log(`${name} desk: ${m} skipped (${e && e.message || e})`); } }
    if (!per.length) { console.log(`${name} desk: no candles, file left as it is`); continue; }
    const o = out[name] = buildDesk(name, per, prev, now, days, from);
    writeDesk(dir, name, o);
    console.log(`${name} desk: ${o.counts.n} records (${o.counts.open} open, ${o.counts.live} seen live), ${o.read.length} markets read`); }
  return out;
}
if (process.argv[1] && fileURLToPath(import.meta.url) === path.resolve(process.argv[1])) { const a = process.argv, arg = (k) => (a.includes(k) ? a[a.indexOf(k) + 1] : null);
  main(a[2] || 'data', { days: Math.min(365, Math.max(SOP.DAYS, +(arg('--days') || process.env.DESK_DAYS) || SOP.DAYS)), only: arg('--only'), from: arg('--from') ? Date.parse(arg('--from') + 'T00:00:00Z') / 1000 : null }).catch((e) => { console.error('Edge desks failed: ' + (e && e.message || e)); process.exit(1); }); }
