// Three engulfing methods on the Engulfing desk (21 Nov 2026, owner: "improve the engulfing, learn from these documents").
// The owner's three private documents are read here in the desk's OWN words and are never copied into the repository:
//   plan    the Daily's last engulf gives the side; an H4 engulf zone of that side, or an opposite H4 zone that failed (it
//           turns, until an H4 candle closes back through it); a 15- or 30-minute engulf the same way whose zone lies wholly INSIDE
//           the H4 zone; then on 5-minute candles an opposite engulf zone FAILS (a close through it, which may come inside the
//           candle that completes the trigger) and the entry is a limit at the 5-minute engulf that same close completed (else
//           the last one behind the failure), at a price inside the H4 zone.
//   simple  the same entry in an H4 zone whose side is not the Daily's (the documents' short method names no Daily filter).
//   direct  a fresh H4 engulf zone that price leaves alone for the next two H4 candles, a fresh H1 zone INSIDE it (wholly),
//           a fresh 15-minute zone inside that: a limit at the 15-minute zone. Its document names no target: the stop is
//           trailed with the 5-minute EF (see `efTrail`), so a direct trade ends only at its stop, the first one or a trailed one
//           (until 21 Nov 2026 a 2R target, the desk's own choice).
// A trade ends at its stop or its target (the documents give no time exit; the desk closed at 24 hours until 21 Nov 2026).
// Every entry has a fixed stop of 30 pips on gold ($3.00) on the losing side; plan and simple have a target of 60 pips (2R).
// On another market the stop is 30 of ITS OWN pips (`stopSize`; until 22 Nov 2026 gold's $3.00 as a share of price):
// EUR/USD 0.0030, silver $0.30, an index 30 points. An engulf here (see `engulfAt` and `zones`) = a candle CLOSES
// beyond the HIGH (a buy) or the LOW (a sell) of the last candle of the other colour before it, however many candles that takes;
// its zone is that base candle, wick to wick. PAPER RECORD of one reading, before costs: not a tested
// rule, never an edge. No order, alert, mirror copy or Trader read.
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';
import { foldWeekend } from './fills.mjs';

const require = createRequire(import.meta.url);
const SOP = require(fileURLToPath(new URL('../assets/mosha-sop.js', import.meta.url)));
// THE STOP IS 30 PIPS IN THE MARKET'S OWN PIP (owner, 22 Nov 2026: "the stop is not 3$ but 30 pips so convert it to points").
// Until then every other market took gold's $3.00 as a share of its price (EUR/USD: about 8 pips). A pip here is ten points
// (the last-but-one decimal the market is quoted to): gold 0.10 (30 pips = 300 points = $3.00; the teacher's own "2000 pips"
// for a $200 move), silver 0.01, a five-decimal pair 0.0001 (30 pips = 0.0030), a yen pair 0.01, an index one index point.
export const PIP = { xau: 0.1, xag: 0.01, nas100: 1, spx500: 1, us30: 1, de40: 1 };
export const pipOfMarket = (market) => PIP[market] || (SOP.ALL[market] ? Math.pow(10, 1 - SOP.ALL[market].dec) : 0.1);
export const stopSize = (market) => EGM.stopPips * pipOfMarket(market);
export const EGM = { pips: 3.0, stopPips: 30, rr: 2, arm: 3 * 3600, efBack: 6 * 3600, egBack: 2 * 3600, fill: 12, hold: 86400, quiet: 2, directWait: 5 * 86400,
  life: { '4h': 120, '1h': 120, '30m': 200, '15m': 200, '5m': 150 } };
const SEC = { '1d': 86400, '4h': 14400, '1h': 3600, '30m': 1800, '15m': 900, '5m': 300, '1m': 60 }, NAME = { '4h': 'H4', '1h': 'H1', '30m': 'M30', '15m': 'M15', '5m': 'M5', '1m': 'M1' };
// 30-minute candles from the 15-minute ones (a candle with only one half on file is left out), and the trigger zones of both:
// the methods name the 15- or the 30-minute engulf as the trigger (21 Nov 2026, the documents checked page by page)
const m30of = (M15) => { const out = []; for (let i = 1; i < M15.length; i++) { const a = M15[i - 1], b = M15[i]; if (a.time % 1800 === 0 && b.time === a.time + 900) out.push({ time: a.time, open: a.open, high: Math.max(a.high, b.high), low: Math.min(a.low, b.low), close: b.close }); } return out; };
// An EF counts like an EG (owner, 21 Nov 2026: "the fail is the same logic as entry for other timeframes"; then "keep the msnr":
// the gold plan only, the Engulfing plan and short method keep EG triggers): an opposite 15- or 30-minute zone that FAILED (a
// close through it) triggers the other way, from the close that broke it, with its own box as the zone (`ef: true`)
const efsOf = (Z, C) => Z.filter((z) => z.fail != null).map((z) => ({ ...z, dir: -z.dir, at: z.fail, c: C[z.fi], ef: true }));
const triggers = (M15, ef = false, back = EG_SPAN) => { const M30 = m30of(M15), Z15 = zones(M15, '15m', back), Z30 = zones(M30, '30m', back);
  return Z15.map((z) => ({ ...z, c: M15[z.i] })).concat(Z30.map((z) => ({ ...z, c: M30[z.i] })), ef ? efsOf(Z15, M15).concat(efsOf(Z30, M30)) : []).sort((x, y) => x.at - y.at || (x.tf === '15m' ? -1 : 1) || (x.ef ? 1 : -1)); };
const zw = (m) => (m.ef ? ' EF (zone failed)' : ' EG zone');
// how many candles the engulf took, for the chart label (fewer is the better engulf; shown, not a filter)
export const egN = (z) => (z && z.n ? ` · ${z.n} candle${z.n === 1 ? '' : 's'}` : '');
// an H4 zone of side d as the methods mark it: an engulf zone of that side still standing, or a zone of the other side that
// FAILED (a close through it) and so turned
// A turned zone stops counting once an H4 candle closes BACK through it (the other side from the one it failed on): by the
// methods' own rule a zone closed through is failed, and no page uses a turned zone after such a close (21 Nov 2026; until
// then a turned zone counted for 20 days whatever happened next). `turnBack` stamps that close's time on the zone (`back`).
const h4Zone = (z, d, T) => (z.dir === d && z.at <= T && z.end > T) || (z.dir === -d && z.fail != null && z.fail <= T && T - z.fail < 20 * 86400 && !(z.back != null && z.back <= T));
export const turnBack = (C, Z, sec) => { for (const z of Z) { if (z.fail == null) continue;
  for (let j = z.fi + 1; j < C.length && C[j].time < z.fail + 20 * 86400; j++) if (z.dir > 0 ? C[j].close > z.top : C[j].close < z.bot) { z.back = C[j].time + sec; break; } } return Z; };
const word = (d) => (d > 0 ? 'buy' : 'sell');
const num = (a) => a.map((b) => ({ time: +b.time, open: +b.open, high: +b.high, low: +b.low, close: +b.close }));
const lower = (C, t) => { let lo = 0, hi = C.length; while (lo < hi) { const m = (lo + hi) >> 1; if (C[m].time < t) lo = m + 1; else hi = m; } return lo; };

// ONE definition of the engulf for every desk reading (21 Nov 2026; the D1 / H4 / H1 engulf rule of council/edge-desks.mjs reads
// it too, with its own look-back of 3 candles). Candle i completes an engulf when it is a coloured candle that CLOSES beyond the
// HIGH (a buy) or the LOW (a sell) of the BASE = the last candle of the other colour before it, at most `back` candles back.
// Where the completing candle opened does not matter; a doji is never a base and never completes one.
// The owner (21 Nov 2026): an engulf may take "as many [candles] as it needs". What ends a pending base, as the methods' own
// multi-candle pictures and both engulf notes read it (a run of candles of the engulfing colour after the base, dojis passed over,
// "an opposite candle cancels it"): a NEWER candle of the base's colour takes its place (the base is always the LAST opposite
// candle, so an older base can no longer be completed), and (`zones`) a close through the base's other side before the
// completing close cancels it. No candle count ends it. Returns { dir, j (the base's index) } or null.
// THE ENGULF COMPLETES WITHIN FOUR CANDLES (owner, 22 Nov 2026: "the next 3 max 4 candles we must have a eg, more than that
// not"; he checked 35 marked examples on four charts: "yes all right"). The base (first candle) is the last candle of the other
// colour; a candle at most EG_SPAN candles after it that closes beyond its high (buy) / low (sell) completes the EG; later than
// that there is no EG. The zone is the first candle, wick to wick. Until then any later candle could complete it.
// THREE CANDLES ON EVERY DESK (owner, 22 Nov 2026, later the same day: "Change to 3 candles"): the 1st, 2nd or 3rd candle after the
// first candle completes the engulf, the 4th no longer does. The next-candle kinds (span 1) and the earlier scalp method's
// two-candle rule are unchanged. Stored records keep the older rule until the histories are rebuilt.
export const EG_SPAN = 3;
// The target of each reading, in R (owner, 22 Nov 2026: "keep the best rr for each individual one"): the best of a 1R / 2R / 3R / 4R
// target on that reading's own closed 2026 records, each replayed alone on 5-minute candles before costs. Picked in sample on one
// year: a choice of the owner's, not a tested result. A reading whose own exit was best keeps it and is not listed here; the
// direct entry keeps its document's exit (no target, the stop trailed with the M5 EF): 4R was 4.6R better on 44 trades, which is noise.
export const RR = { 'eg-plan': 1, 'eg-plan-n': 1, 'eg-simple': 1, 'eg-simple-n': 4, 'eg-m1': 2, 'msnr-sop': 2, 'msnr-qm': 3 };
export function engulfAt(C, i, back = EG_SPAN) {
  const c = C[i], dir = c.close > c.open ? 1 : c.close < c.open ? -1 : 0; if (!dir) return null;
  for (let j = i - 1; j >= 0 && j >= i - back; j--) { const b = C[j];
    if (dir > 0 ? b.open > b.close : b.open < b.close) return (dir > 0 ? c.close > b.high : c.close < b.low) ? { dir, j } : null; }
  return null;
}
// every engulf zone of one timeframe: { dir, top, bot, base (the engulfed candle's time), at (known from: the close of the
// completing candle, never earlier), i (the completing candle), touch, fail }. The box is the BASE candle wick to wick, as the
// methods draw it (until 21 Nov 2026: from the pair's wick to the base's open, and only the candle right after the base could
// complete it). One zone a base: the FIRST close beyond it.
// touch = the start of the first later candle that trades into the zone; fail = the close time of the first that closes through it
// `back`: how many candles back the base may be (1 = only the candle right before the completing one: the next-candle engulf)
export function zones(C, tf, back = EG_SPAN) {
  const sec = SEC[tf], life = EGM.life[tf] || 120, out = [];
  for (let i = 1; i < C.length; i++) { const e = engulfAt(C, i, back); if (!e) continue; const dir = e.dir, p = C[e.j], c = C[i];
    // the candles between the base and this one: an earlier one of this colour that closed beyond the base already made the zone;
    // a close through the base's other side cancelled the base
    let gone = false; for (let q = e.j + 1; q < i && !gone; q++) { const b = C[q]; gone = dir > 0 ? (b.close > b.open && b.close > p.high) || b.close < p.low : (b.close < b.open && b.close < p.low) || b.close > p.high; }
    if (gone) continue;
    const z = { tf, dir, top: p.high, bot: p.low, base: p.time, at: c.time + sec, touch: null, fail: null, i, n: i - e.j };   // n: candles the engulf took (owner: "the less candles the better")
    for (let j = i + 1; j < C.length && j <= i + life; j++) { const b = C[j];
      if (z.touch == null && (dir > 0 ? b.low <= z.top : b.high >= z.bot)) z.touch = b.time;
      if (dir > 0 ? b.close < z.bot : b.close > z.top) { z.fail = b.time + sec; z.fi = j; break; } }
    z.end = z.fail != null ? z.fail : i + life < C.length ? C[i + life].time + sec : Infinity;   // not used past its life; still alive at the newest candle = no end yet
    out.push(z); }
  return out;
}
// one filled trade on the 5-minute candles from candle fi on: the stop first when a candle holds both
export function outcome(M5, fi, d, entry, stop, target, until) {
  const r0 = Math.abs(entry - stop), o = { status: 'open', R: null, endT: null, exit: null, mfe: 0 };
  for (let k = fi; k < M5.length; k++) { const b = M5[k];
    if (k > fi && b.time >= until) { o.status = 'time'; o.exit = b.open; o.R = d * (b.open - entry) / r0; o.endT = b.time; return o; }
    if (d > 0 ? b.low <= stop : b.high >= stop) { const px = k > fi && (d > 0 ? b.open < stop : b.open > stop) ? b.open : stop;   // a candle that opens beyond the stop exits at its open
      o.status = 'stopped'; o.exit = px; o.R = d * (px - entry) / r0; o.endT = b.time; return o; }
    if (k === fi) continue;   // a limit fills inside its candle: that candle's favourable extreme may have come before the fill, so only the stop counts on it
    if (d > 0 ? b.high >= target : b.low <= target) { o.status = 'target'; o.exit = target; o.R = d * (target - entry) / r0; o.endT = b.time; return o; }
    o.mfe = Math.max(o.mfe, d * ((d > 0 ? b.high : b.low) - entry) / r0); }
  if (M5.length) o.float = d * (M5[M5.length - 1].close - entry) / r0; return o;
}
// the direct entry's exit as its document gives it: a 30-pip stop, then the stop trailed with the 5-minute EF, no target.
// The desk's reading of "trail with the M5 EF": after the fill, every 5-minute engulf zone of the OTHER side that fails (a
// candle closes through it) turns into an EF on the trade's side; from the candle after that close the stop moves to the EF's
// far edge (a buy: its bottom; a sell: its top) when that is tighter than the stop in force. The stop only ever tightens; the
// fill candle can only stop the trade at the first stop (no zone can have failed before it closed). A candle that opens
// beyond the stop exits at its open. Status 'trail' when the stop that took the trade out was a trailed one.
export function efTrail(M5, Z5, fi, d, entry, stop0) {
  const r0 = Math.abs(entry - stop0), fillClose = M5[fi].time + 300, o = { status: 'open', R: null, endT: null, exit: null, mfe: 0, stop: stop0, moves: 0, ef: null, movedAt: null };
  const efs = Z5.filter((z) => z.dir === -d && z.fail != null && z.fail >= fillClose).sort((a, b) => a.fail - b.fail); let q = 0;
  for (let k = fi; k < M5.length; k++) { const b = M5[k];
    while (q < efs.length && efs[q].fail <= b.time) { const z = efs[q++], ns = d > 0 ? z.bot : z.top;
      if (d > 0 ? ns > o.stop : ns < o.stop) { o.stop = ns; o.moves++; o.ef = z; o.movedAt = z.fail; } }
    if (d > 0 ? b.low <= o.stop : b.high >= o.stop) { const px = k > fi && (d > 0 ? b.open < o.stop : b.open > o.stop) ? b.open : o.stop;
      o.status = o.moves ? 'trail' : 'stopped'; o.exit = px; o.R = d * (px - entry) / r0; o.endT = b.time; return o; }
    if (k > fi) o.mfe = Math.max(o.mfe, d * ((d > 0 ? b.high : b.low) - entry) / r0); }
  if (M5.length) o.float = d * (M5[M5.length - 1].close - entry) / r0; return o;
}
// the Daily's side at time t: the last Daily engulf known by then (trading days: weekend candles folded)
function dailyZone(DZ, t) { let s = null; for (const z of DZ) { if (z.at > t) break; s = z; } return s; }

// `orders`: an array handed in is filled with every plan / simple limit order that rested ({ kind, side, base, entry, stop,
// target, placed, until, fillT (null: it expired) }), before the one-position rule: a read-out for tests and counts, it changes nothing.
// BOTH ENGULFS, SIDE BY SIDE (owner, 22 Nov 2026: "Keep both"). `span: 'next'` reads the plan and the short method with the
// NEXT-CANDLE engulf only (the base is the candle right before the completing one, on every timeframe: Daily, H4, the 15- /
// 30-minute trigger and the M5 zones): kinds 'eg-plan-n' / 'eg-simple-n', their own one-position rule, no direct entry. The
// default is the any-number-of-candles engulf (kinds 'eg-plan' / 'eg-simple' / 'eg-direct', as before). On gold in 2026 the
// next-candle reading made a fifth of the trades and about a fifteenth of the loss (100 / -10R against 523 / -148R, plan):
// the desk shows the two apart so their forward records can be compared. Neither is a tested edge.
export function methodTrades(B, { from = 0, market = 'xau', orders = null, span = 'any' } = {}) {
  const back = span === 'next' ? 1 : EG_SPAN, sfx = span === 'next' ? '-n' : '', lab = span === 'next' ? ' · next-candle EG' : '';
  const M5 = num(B['5m'] || []), M15 = num(B['15m'] || []), H1 = num(B['1h'] || []), H4 = num(B['4h'] || []); if (M5.length < 100 || M15.length < 50 || H4.length < 20) return [];
  const D1 = foldWeekend(num(B['1d'] || [])), dec = SOP.ALL[market] ? SOP.ALL[market].dec : 2, f = (v) => (+v).toFixed(dec), pipOf = () => stopSize(market);   // 30 pips on gold's scale, from the trade's own price (not the newest: a stop must not change between two reads)
  const Z4 = turnBack(H4, zones(H4, '4h', back), SEC['4h']), Z1 = zones(H1, '1h', back), Z15 = zones(M15, '15m', back), Z5 = zones(M5, '5m', back), DZ = zones(D1, '1d', back), pre = market === 'xau' ? '' : market + ':', out = [];
  // the methods give a stop and a target only: no time exit (24 hours until 21 Nov 2026)
  const rec = (kind, label, d, fi, entry, T0, log, marks, trail = false) => { const rr = RR[kind] || EGM.rr, pip = pipOf(entry), stop = entry - d * pip, target = trail ? null : entry + d * rr * pip, fillT = M5[fi].time;
    const oc = trail ? efTrail(M5, Z5, fi, d, entry, stop) : outcome(M5, fi, d, entry, stop, target, Infinity), sg = (v) => `${v >= 0 ? '+' : '−'}${Math.abs(v).toFixed(2)}R`;
    const tr = { id: `${pre}${kind}-${d > 0 ? 'b' : 's'}-${T0}`, market, kind, label, h: '4h', l: '5m', side: d, t: fillT, entry, stop, target, r0: pip, status: oc.status, R: oc.R, endT: oc.endT, exit: oc.exit, mfe: oc.mfe, float: oc.float };
    if (trail && oc.moves) { tr.stopNow = oc.stop; tr.stopAt = oc.movedAt; }   // and WHEN it moved there: a settle must not apply it to candles before   // the trailed stop in force (the record's `stop` stays the opening stop: 1R is the opening risk)
    tr.log = log.concat([{ t: fillT, text: `Price came back to the zone: ${word(d)} ${f(entry)}, stop ${f(stop)} (30 pips), ` + (trail ? 'no target: the stop is trailed with the M5 EF.' : `target ${f(target)} (${rr}R).`) }],
      trail && oc.moves ? [{ t: oc.movedAt, text: `The stop was trailed ${oc.moves} time${oc.moves > 1 ? 's' : ''} with the M5 EF; the last M5 ${word(-d)} zone that failed, ${f(oc.ef.bot)} to ${f(oc.ef.top)}, put it at ${f(oc.stop)}.` }] : [],
      [oc.status === 'target' ? { t: oc.endT, text: `Target reached: +${rr.toFixed(2)}R.` } : oc.status === 'stopped' ? { t: oc.endT, text: `Stopped: ${oc.R >= 0 ? '+' : '−'}${Math.abs(oc.R).toFixed(2)}R` + (oc.mfe >= 1 ? ` after running +${oc.mfe.toFixed(1)}R first.` : '.') }
        : oc.status === 'trail' ? { t: oc.endT, text: `Trailed stop hit at ${f(oc.exit)}: ${sg(oc.R)}.` }
        : oc.status === 'time' ? { t: oc.endT, text: `Time limit: closed at ${f(oc.exit)}, ${sg(oc.R)}.` } : { t: null, text: 'Still open on the last candle read' + (oc.float != null ? ` (${oc.float >= 0 ? '+' : '−'}${Math.abs(oc.float).toFixed(2)}R now).` : '.') }]);
    tr.marks = marks.concat(trail && oc.moves && oc.status !== 'open' ? [{ kind: 'zone', top: oc.ef.top, bot: oc.ef.bot, a: oc.ef.base, at: oc.ef.fail, label: 'M5 EF · trailed stop' }] : []); out.push(tr); };
  // a limit at `entry`, valid over candles [i0, i1): the index of the candle that fills it, or -1
  const fillAt = (d, entry, i0, i1, tEnd = Infinity) => { for (let k = i0; k < Math.min(M5.length, i1) && M5[k].time < tEnd; k++) if (d > 0 ? M5[k].low <= entry : M5[k].high >= entry) return k; return -1; };

  // plan / simple: H4 zone, M15 engulf inside it, then the M5 failure and the M5 zone behind it
  const used = new Set(), sets = [], at5 = new Map(Z5.map((z) => [z.dir + ':' + z.at, z]));
  for (const m of triggers(M15, false, back)) { const d = m.dir, T = m.at, tn = NAME[m.tf], t0 = m.c.time;   // t0: the open of the candle that completed the 15- / 30-minute engulf
    // the 15- / 30-minute engulf is made INSIDE the H4 zone: its own zone (the base candle) lies wholly inside it, as each box of
    // the methods' pictures lies inside the one above (21 Nov 2026, second pass; until then reaching into the zone was enough)
    const Z = Z4.filter((z) => h4Zone(z, d, T) && m.bot >= z.bot && m.top <= z.top).pop(); if (!Z) continue; const turned = Z.dir !== d;
    // the first opposite M5 zone that fails after the M15 engulf, inside the arming time
    // it must be formed INTO or AT the zone (owner, 21 Nov 2026, on a EUR/USD buy whose "M5 EF" was a 1.4-pip sell engulf above
    // the H4 and M15 zones: "there is no eg sell fail on m5"; the method: the EF that counts is the close through the last opposite
    // engulf formed into or at the zone): its range touches the H4 zone or the M15 / M30 engulf zone
    const lo = Math.min(Z.bot, m.bot), hi = Math.max(Z.top, m.top), atZone = (z) => z.bot <= hi && z.top >= lo;
    // The failure may come INSIDE the candle that completes the 15- / 30-minute engulf (from that candle's open): in the short
    // method's own example the 5-minute close that completes the M5 engulf and breaks the opposite M5 zone is the first five
    // minutes of the 15-minute candle that completes the trigger (until 21 Nov 2026, second pass, only failures after that
    // candle had CLOSED were read, so the example's pair was thrown away). Nothing is known, and no order rests, before the
    // trigger candle has closed: the setup is dated K = the later of the two closes.
    let F = null; for (const z of Z5) { if (z.at > T + EGM.arm) break; if (z.dir !== -d || z.at < T - EGM.efBack || z.fail == null || z.fail <= t0 || z.fail > T + EGM.arm || !atZone(z)) continue; if (!F || z.fail < F.fail) F = z; }
    if (!F) continue; const K = Math.max(F.fail, T);
    // The entry zone = the M5 engulf COMPLETED by the candle that failed the opposite zone (the two boxes of the methods' pictures
    // are made by one candle), when there is one; it must be at the zone. Only when that candle completes no engulf: the last
    // M5 engulf of the side known by then, at the zone (the desk's choice until an owner answer).
    const P = at5.get(d + ':' + F.fail); let E = null;
    if (P) { if (atZone(P)) E = P; }
    else for (const z of Z5) { if (z.at > F.fail) break; if (z.dir === d && z.at >= F.fail - EGM.egBack && (z.fail == null || z.fail > F.fail) && atZone(z)) E = z; }
    if (!E || (E.fail != null && E.fail <= K)) continue;   // closed through before the setup was known: no zone to rest an order at
    const entry = d > 0 ? E.top : E.bot; if (entry < Z.bot || entry > Z.top) continue;   // the entry price is INSIDE the H4 zone: the methods buy FROM the zone (21 Nov 2026, second pass)
    // One order a zone, given to the setup that was KNOWN first (21 Nov 2026): the setups are collected here and the zone is
    // handed out below in the order of K. Until then it went to the trigger that closed first, whenever its own M5 failure came:
    // a trigger whose failure came late took the zone from one whose failure had come early, so an order that had already
    // rested (and could have filled) was never placed: a look ahead, shown by cutting the candles between the two.
    sets.push({ K, key: d + ':' + E.base, go: () => {
    if (K < M5[0].time) return;   // placed before the 5-minute candles on file: its window cannot be read
    const i0 = lower(M5, K), fi = fillAt(d, entry, i0, i0 + EGM.fill, K + EGM.fill * 300);   // an hour of clock time (12 candles could run over the daily break or a weekend)
    const dz = dailyZone(DZ, T), ds = dz ? dz.dir : 0, plan = ds === d;
    if (orders) orders.push({ kind: (plan ? 'eg-plan' : 'eg-simple') + sfx, side: d, base: E.base, entry, stop: entry - d * pipOf(entry), target: entry + d * (RR[(plan ? 'eg-plan' : 'eg-simple') + sfx] || EGM.rr) * pipOf(entry), placed: K, until: K + EGM.fill * 300, fillT: fi < 0 ? null : M5[fi].time });
    if (fi < 0) return;
    rec((plan ? 'eg-plan' : 'eg-simple') + sfx, (plan ? 'Plan · with the Daily' : 'Simple EG · H4 zone') + lab, d, fi, entry, E.base, [
      { t: T, text: (plan ? `The Daily's last engulf is a ${word(d)}. ` : `The Daily's last engulf is ${ds ? 'a ' + word(ds) : 'not on file'}, so this is the short method without the Daily. `) + `Price is in the H4 ${turned ? 'zone that failed and turned' : word(d) + ' engulf zone'} ${f(Z.bot)} to ${f(Z.top)} and ` + (m.ef ? `a ${tn} ${word(-d)} engulf zone failed (a close through it).` : `a ${tn} engulf ${word(d)} closed.`) },
      { t: K, text: `On M5 the ${word(-d)} engulf zone ${f(F.bot)} to ${f(F.top)} failed (a close through it). The M5 ${word(d)} engulf zone behind it is ${f(E.bot)} to ${f(E.top)}: a ${word(d)} limit rests at ${f(entry)} for an hour.` }],
    (plan && dz ? [{ kind: 'zone', top: dz.top, bot: dz.bot, a: dz.base, at: dz.at, label: 'Daily EG zone' }] : []).concat([{ kind: 'zone', top: Z.top, bot: Z.bot, a: Z.base, at: turned ? Z.fail : Z.at, label: turned ? 'H4 EF (zone failed)' : 'H4 EG zone' }, { kind: 'zone', top: m.top, bot: m.bot, a: m.base, at: m.at, label: tn + zw(m) },
      { kind: 'zone', top: F.top, bot: F.bot, a: F.base, at: F.fail, label: 'M5 EF (zone failed)' }, { kind: 'zone', top: E.top, bot: E.bot, a: E.base, at: E.at, label: 'M5 EG zone · entry' + egN(E) }])); } }); }
  sets.sort((a, b) => a.K - b.K);   // a stable sort: setups known at the same close keep the triggers' order
  for (const x of sets) { if (used.has(x.key)) continue; used.add(x.key); x.go(); }

  // direct: a fresh H4 zone left alone for two H4 candles, a fresh H1 zone inside it, a fresh M15 zone inside that
  const inside = (a, b) => a.top <= b.top && a.bot >= b.bot;   // INSIDE the zone above (until 21 Nov 2026 an overlap was enough)
  // "left alone for the next two H4 candles" counts two CLOSED H4 candles after the one that made the zone, not 8 hours of clock
  // time (until 21 Nov 2026: over a weekend or a missing candle no H4 candle, or one, had traded and the zone still counted)
  if (span !== 'next') for (const Z of Z4) { const d = Z.dir, qc = H4[Z.i + EGM.quiet]; if (!qc) continue; const tc = qc.time + SEC['4h']; if (Z.touch != null && Z.touch < tc) continue; if (Z.fail != null && Z.fail <= tc) continue;
    const win = (z) => z.dir === d && z.at <= tc && z.at >= Z.base - SEC['4h'] && (z.touch == null || z.touch >= tc);
    const h1 = Z1.filter((z) => win(z) && inside(z, Z)).pop(); if (!h1) continue;
    const m15 = Z15.filter((z) => win(z) && inside(z, h1)).pop(); if (!m15) continue;
    if (tc < M5[0].time) continue;
    const entry = d > 0 ? m15.top : m15.bot, i0 = lower(M5, tc), iEnd = lower(M5, Math.min(Z.fail != null ? Z.fail : Infinity, tc + EGM.directWait)), fi = fillAt(d, entry, i0, iEnd); if (fi < 0) continue;
    rec('eg-direct', 'Direct entry · M5 EF trail', d, fi, entry, Z.base, [
      { t: tc, text: `A fresh H4 ${word(d)} engulf zone ${f(Z.bot)} to ${f(Z.top)} was left alone for the next two H4 candles. Inside it: a fresh H1 zone ${f(h1.bot)} to ${f(h1.top)} and a fresh M15 zone ${f(m15.bot)} to ${f(m15.top)}. A ${word(d)} limit rests at ${f(entry)}.` }],
    [{ kind: 'zone', top: Z.top, bot: Z.bot, a: Z.base, at: Z.at, label: 'Fresh H4 EG zone' }, { kind: 'zone', top: h1.top, bot: h1.bot, a: h1.base, at: h1.at, label: 'Fresh H1 EG zone' }, { kind: 'zone', top: m15.top, bot: m15.bot, a: m15.base, at: m15.at, label: 'Fresh M15 EG · entry' }], true); }

  // one position at a time a market over the three methods; only entries inside the window are kept
  out.sort((a, b) => a.t - b.t); const keep = []; let busy = -Infinity;
  for (const r of out) { if (r.t <= busy) continue; busy = r.endT || Infinity; if (r.t >= from) keep.push(r); }
  return keep;
}

// ─── the M1 EF entry inside an entry zone (22 Nov 2026, owner: "inside the entry zone i want m1 buy eg to become ef to entry for
// sells, for buy i want in the entry area a sell m1 eg to fail thats my moment to entry"; six marked examples passed, with one
// correction: "use the recent one") ───
// Entry zone: a 15-minute engulf zone of the trade's side, alive. Inside it (wholly, and formed after the zone is known) a
// one-minute engulf of the OTHER side; when a one-minute candle closes through that engulf's far side it has failed (an EF on
// the trade's side): enter at that close. Of several such one-minute engulfs the MOST RECENT one is the one that counts: an older
// one failing while a newer one still stands is no entry. A zone can give more than one entry (the owner's first example is a second visit); one position at a time a market.
// The desk's own choices, shown on the six examples and not the owner's words: the stop sits past the extreme made between the
// one-minute engulf's first candle and the failing candle, by 0.01 % of price; the target is 2R; results are read on the
// one-minute candles from the candle after the entry (stop first when one candle holds both, a gap books at the open).
export const M1E = { rr: 2, pad: 0.0001 };
export function m1Trades(B, { from = 0, market = 'xau' } = {}) {
  const M1 = num(B['1m'] || []), M15 = num(B['15m'] || []); if (M1.length < 100 || M15.length < 50) return [];
  const dec = SOP.ALL[market] ? SOP.ALL[market].dec : 2, f = (v) => (+v).toFixed(dec), pre = market === 'xau' ? '' : market + ':', t0 = M1[0].time, out = [];
  const Z1 = zones(M1, '1m'), sg = (v) => `${v >= 0 ? '+' : '−'}${Math.abs(v).toFixed(2)}R`;
  for (const Z of zones(M15, '15m')) { const d = Z.dir; if (Z.at < t0) continue;
    // Z1 is in the order its zones became known: only the stretch inside this zone's life is read (a year of one-minute candles otherwise takes hours)
    const In = []; let lo = 0, hi = Z1.length; while (lo < hi) { const m = (lo + hi) >> 1; if (Z1[m].at <= Z.at) lo = m + 1; else hi = m; }
    for (let k = lo; k < Z1.length && Z1[k].at <= Z.end; k++) { const q = Z1[k]; if (q.dir === -d && q.top <= Z.top && q.bot >= Z.bot) In.push(q); }
    for (const q of In.filter((a) => a.fail != null && a.fail <= Z.end && !In.some((b) => b.at > a.at && b.at <= a.fail && (b.fail == null || b.fail > a.fail)))) {
    const fi = q.fi, bi = lower(M1, q.base), c = M1[fi], entry = c.close; let ext = d > 0 ? Infinity : -Infinity;
    for (let k = bi; k <= fi; k++) ext = d > 0 ? Math.min(ext, M1[k].low) : Math.max(ext, M1[k].high);
    const stop = ext - d * entry * M1E.pad, r0 = Math.abs(entry - stop), target = entry + d * RR['eg-m1'] * r0; if (!(r0 > 0) || (d > 0 ? stop >= entry : stop <= entry)) continue;
    const o = { status: 'open', R: null, endT: null, exit: null, mfe: 0 };
    for (let k = fi + 1; k < M1.length; k++) { const b = M1[k];
      if (d > 0 ? b.low <= stop : b.high >= stop) { const px = (d > 0 ? b.open < stop : b.open > stop) ? b.open : stop; o.status = 'stopped'; o.exit = px; o.R = d * (px - entry) / r0; o.endT = b.time; break; }
      if (d > 0 ? b.high >= target : b.low <= target) { o.status = 'target'; o.exit = target; o.R = RR['eg-m1']; o.endT = b.time; break; }
      o.mfe = Math.max(o.mfe, d * ((d > 0 ? b.high : b.low) - entry) / r0); }
    if (o.status === 'open') o.float = d * (M1[M1.length - 1].close - entry) / r0;
    const tr = { id: `${pre}eg-m1-${d > 0 ? 'b' : 's'}-${q.fail}`, market, kind: 'eg-m1', label: 'M15 EG zone · M1 EF entry', h: '15m', l: '1m', side: d, t: q.fail, entry, stop, target, r0, status: o.status, R: o.R, endT: o.endT, exit: o.exit, mfe: o.mfe, float: o.float };
    tr.log = [{ t: Z.at, text: `A 15-minute ${word(d)} engulf zone ${f(Z.bot)} to ${f(Z.top)} is the entry zone.` },
      { t: q.at, text: `Inside it a one-minute ${word(-d)} engulf formed (${f(q.bot)} to ${f(q.top)}), the most recent one before the entry.` },
      { t: q.fail, text: `A one-minute candle closed through it: it failed (EF). ${d > 0 ? 'Buy' : 'Sell'} at that close ${f(entry)}, stop ${f(stop)} past the extreme made since the engulf, target ${f(target)} (${RR['eg-m1']}R; the stop and target are the desk's own choice).` }];
    if (o.status !== 'open') tr.log.push({ t: o.endT, text: `${o.status === 'target' ? 'Target reached' : 'Stopped'}: ${sg(o.R)}.` });
    tr.marks = [{ kind: 'zone', top: Z.top, bot: Z.bot, a: Z.base, at: Z.at, label: 'M15 EG zone · entry zone' + egN(Z) }, { kind: 'zone', top: q.top, bot: q.bot, a: q.base, at: q.fail, label: `M1 ${word(-d)} EG that failed (EF)` }];
    out.push(tr); } }
  // one order found in two overlapping 15-minute zones is one trade; one position at a time a market
  out.sort((a, b) => a.t - b.t); const keep = []; let busy = -Infinity;
  for (const r of out) { if (r.t <= busy) continue; busy = r.endT || Infinity; if (r.t >= from) keep.push(r); }
  return keep;
}

// ─── the three-timeframe SOP (22 Nov 2026; the owner's table: marking zone / engulf at the zone / confirmation = Daily / H4 /
// H1, H4 / H1 / M15, H1 / M15 / M5, and three pictures of an engulf completed by the 1st, 2nd or 3rd candle) ───
// An engulf completes within THREE candles (EG_SPAN, the same on every desk since the owner's "Change to 3 candles"): the first candle is the last
// candle of the other colour and the 1st, 2nd or 3rd candle after it closes beyond its high (a buy) / low (a sell); the zone is the
// first candle, wick to wick. For each chain [zone, engulf, confirmation]:
//   1. marking zone: an engulf zone on the zone timeframe, still alive (not closed through, within its life). Its side is the trade's.
//   2. price comes back into it (a candle of the engulf timeframe trades into it after the zone is known); from that candle's close
//      on, an engulf of the SAME side completes on the engulf timeframe while the marking zone is alive, its zone touching the
//      marking zone (an overlap, the file's "at the zone" test).
//   3. confirmation: after that engulf is known, an engulf of the same side completes on the confirmation timeframe, its zone
//      touching the engulf's zone, while both higher zones are alive, within SOP3.wait confirmation candles (the desk's choice).
// Entry: a limit at the MIDDLE (50 %) of the confirmation engulf's zone, alive for SOP3.fill confirmation candles (the desk's
// choice), cancelled when a confirmation candle closes through the far side of the engulf's zone. On its fill candle only the
// stop counts. Stop: past the far side of the ENGULF timeframe's zone (never just past the confirmation zone) by the desk's
// buffer ($0.30 on gold, the same share of price elsewhere, from the zone's own price). Target SOP3.rr = 2R (the method's
// minimum; taking exactly 2R is the desk's choice). A trade ends at its stop or its target. One order a confirmation zone (the
// most recent engulf zone behind it, then the most recent marking zone); one position at a time per chain and market: a fill
// while one is open is passed over, and of two fills in one candle the order known first wins. Every step reads candles closed
// by that step's time. PAPER READING of the owner's table, before costs: not a tested rule, never an edge.
export const SOP3 = { wait: 24, fill: 24, rr: 2,
  chains: [{ tfs: ['1d', '4h', '1h'], style: 'swing' }, { tfs: ['4h', '1h', '15m'], style: 'intraday' }, { tfs: ['1h', '15m', '5m'], style: 'scalp' }] };
const NAME3 = { ...NAME, '1d': 'D1' };
// Variants for the owner's comparison (22 Nov 2026; the defaults are the desk's reading and change nothing): conf 'inside' = the
// confirmation zone wholly inside the engulf's zone (default 'touch'); stop 'conf' = past the confirmation zone's far side, 'pips' =
// 30 pips from the entry (default 'eg' = past the engulf zone); target 'zone' = the near side of the nearest opposite engulf-timeframe
// zone alive ahead of the entry when it is 1R or more away (else rr), default 'rr'; rr = the R multiple (default SOP3.rr).
export function sopTrades3(B, { from = 0, market = 'xau', conf = 'touch', stop: stopAt = 'eg', target: tgtAt = 'rr', rr = SOP3.rr } = {}) {
  const M5 = num(B['5m'] || []); if (M5.length < 100) return [];
  const dec = SOP.ALL[market] ? SOP.ALL[market].dec : 2, f = (v) => (+v).toFixed(dec), pre = market === 'xau' ? '' : market + ':', sg = (v) => `${v >= 0 ? '+' : '−'}${Math.abs(v).toFixed(2)}R`, pl = (n) => `${n} candle${n === 1 ? '' : 's'}`, out = [];
  const C = {}, Z = {}; for (const tf of ['1d', '4h', '1h', '15m', '5m']) { C[tf] = tf === '5m' ? M5 : tf === '1d' ? foldWeekend(num(B[tf] || [])) : num(B[tf] || []); Z[tf] = zones(C[tf], tf); }
  const touch = (a, b) => a.bot <= b.top && a.top >= b.bot;
  for (const ch of SOP3.chains) { const [zt, et, ct] = ch.tfs, CE = C[et], CC = C[ct], secE = SEC[et], secC = SEC[ct], got = [];
    if (!Z[zt].length || !Z[et].length || !Z[ct].length) continue;
    // step 1 and the return of step 2, per marking zone: ret = the close of the first engulf-timeframe candle that trades into it
    const marks = Z[zt].map((z) => { let ret = null; for (let k = lower(CE, z.at); k < CE.length && CE[k].time + secE <= z.end; k++) if (z.dir > 0 ? CE[k].low <= z.top : CE[k].high >= z.bot) { ret = CE[k].time + secE; break; } return { z, ret }; }).filter((m) => m.ret != null);
    // step 2: the engulf at the marking zone (the most recent marking zone that fits), known at e.at
    const egs = []; for (const e of Z[et]) { let M = null; for (const m of marks) if (m.z.dir === e.dir && m.ret <= e.at && m.z.end > e.at && touch(e, m.z) && (!M || m.z.at > M.z.at)) M = m; if (M) egs.push({ e, M }); }
    // step 3: the confirmation, one order a confirmation zone
    for (const c of Z[ct]) { const d = c.dir, K = c.at; let X = null;
      const t0 = c.i >= SOP3.wait ? CC[c.i - SOP3.wait].time : -Infinity; let q0 = 0, q1 = egs.length; while (q0 < q1) { const m = (q0 + q1) >> 1; if (egs[m].e.at <= t0) q0 = m + 1; else q1 = m; }   // engulfs older than the wait cannot count
      for (let q = q0; q < egs.length && egs[q].e.at < K; q++) { const x = egs[q], e = x.e; if (e.dir !== d || !(e.at < K) || !(e.end > K) || !(x.M.z.end > K) || !(conf === 'inside' ? c.top <= e.top && c.bot >= e.bot : touch(c, e))) continue;
        if (c.i >= lower(CC, e.at) + SOP3.wait) continue;   // within SOP3.wait confirmation candles of the engulf
        if (!X || e.at > X.e.at) X = x; }
      if (!X || K < M5[0].time) continue;   // an order placed before the 5-minute candles on file cannot be read
      const e = X.e, MZ = X.M.z, entry = (c.top + c.bot) / 2, fz = stopAt === 'conf' ? c : e, far = d > 0 ? fz.bot : fz.top, buf = SOP.sizes(market, far).buf, stop = stopAt === 'pips' ? entry - d * stopSize(market) : far - d * buf, r0 = Math.abs(entry - stop);
      if (!(r0 > 0) || (d > 0 ? stop >= entry : stop <= entry)) continue;   // never a record without a stop on the losing side
      let target = entry + d * rr * r0;
      if (tgtAt === 'zone') { let nz = null; for (const o of Z[et]) if (o.dir === -d && o.at <= K && o.end > K) { const p = d > 0 ? o.bot : o.top; if ((p - entry) * d >= r0 && (!nz || (p - entry) * d < (nz - entry) * d)) nz = p; } if (nz != null) target = nz; }
      // the order's life: SOP3.fill confirmation candles, or a confirmation candle closing through the engulf zone's far side
      let dead = CC[c.i + SOP3.fill] ? CC[c.i + SOP3.fill].time + secC : Infinity;
      for (let j = c.i + 1; j < CC.length && CC[j].time + secC <= dead; j++) if (d > 0 ? CC[j].close < e.bot : CC[j].close > e.top) { dead = CC[j].time + secC; break; }
      let fi = -1; for (let k = lower(M5, K); k < M5.length && M5[k].time + 300 <= dead; k++) if (d > 0 ? M5[k].low <= entry : M5[k].high >= entry) { fi = k; break; }
      if (fi < 0) continue;
      const fillT = M5[fi].time, oc = outcome(M5, fi, d, entry, stop, target, Infinity), zn = NAME3[zt], en = NAME3[et], cn = NAME3[ct];
      const tr = { id: `${pre}eg3-${zt}-${d > 0 ? 'b' : 's'}${K}`, market, kind: 'eg-sop3', label: `${zn} zone → ${en} EG → ${cn} CF`, style: ch.style, h: zt, l: ct, side: d, t: fillT, K, entry, stop, target, r0, status: oc.status, R: oc.R, endT: oc.endT, exit: oc.exit, mfe: oc.mfe, float: oc.float };
      tr.log = [{ t: MZ.at, text: `Marking zone: a ${zn} ${word(d)} engulf zone ${f(MZ.bot)} to ${f(MZ.top)} (the engulf took ${pl(MZ.n)}).` },
        { t: X.M.ret, text: `Price came back into the ${zn} zone (a closed ${en} candle traded into it).` },
        { t: e.at, text: `At the zone a ${en} engulf ${word(d)} closed, completed in ${pl(e.n)} (3 at most): its zone is ${f(e.bot)} to ${f(e.top)}.` },
        { t: K, text: `Confirmation: a ${cn} engulf ${word(d)} closed at the ${en} zone, completed in ${pl(c.n)} (zone ${f(c.bot)} to ${f(c.top)}). A ${word(d)} limit rests at its middle ${f(entry)} for ${SOP3.fill} ${cn} candles; stop ${f(stop)} past the ${en} zone, target ${f(target)} (${SOP3.rr}R; desk's choice).` },
        { t: fillT, text: `The limit filled: ${word(d)} ${f(entry)}, risk ${f(r0)}.` },
        oc.status === 'target' ? { t: oc.endT, text: `Target reached: +${(Math.abs(target - entry) / r0).toFixed(2)}R.` } : oc.status === 'stopped' ? { t: oc.endT, text: `Stopped: ${sg(oc.R)}` + (oc.mfe >= 1 ? ` after running +${oc.mfe.toFixed(1)}R first.` : '.') }
          : { t: null, text: 'Still open on the last candle read' + (oc.float != null ? ` (${sg(oc.float)} now).` : '.') }];
      tr.marks = [{ kind: 'zone', top: MZ.top, bot: MZ.bot, a: MZ.base, at: MZ.at, label: zn + ' EG zone' }, { kind: 'zone', top: e.top, bot: e.bot, a: e.base, at: e.at, label: en + ' EG zone' + egN(e) },
        { kind: 'zone', top: c.top, bot: c.bot, a: c.base, at: c.at, label: cn + ' EG zone · entry' }, { kind: 'level', p: entry, a: c.base, at: c.at, label: '50 % · limit' }];
      got.push(tr); }
    // one position at a time per chain and market: by fill time, the order known first when two fill in one candle
    got.sort((a, b) => a.t - b.t || a.K - b.K); let busy = -Infinity;
    for (const r of got) { if (r.t <= busy) continue; busy = r.endT || Infinity; delete r.K; if (r.t >= from) out.push(r); } }
  return out.sort((a, b) => a.t - b.t);
}

// ─── an H4 EF barrier to the next H4 EG zone (23 Nov 2026, the owner's gold trade of 22-23 Nov) ───
// An H4 engulf zone (`zones`, completed within EG_SPAN candles) FAILS: an H4 candle closes through its far side (a sell zone: a
// close above its top). It turns: a failed sell zone is a BUY barrier (an EF), a failed buy zone a sell barrier. Then:
//   1. price comes back into it: a closed 15-minute candle, starting at or after the failing H4 close, trades into the zone;
//   2. an M15 BO with the barrier: from that candle on, an M15 candle closes beyond the last M15 A level (a buy; a V level for a
//      sell: a turn of the M15 CLOSES, EFB.piv candles a side, known by the candle's open and not closed beyond since it formed,
//      as every A / V level on these desks) AND beyond the zone itself (the price has left the zone with the break);
//   3. long at the retest: a buy limit at the zone's top (a sell limit at its bottom); stop past the zone's far side by the desk's
//      buffer ($0.30 on gold, the same share of price elsewhere); target the near side of the NEAREST H4 engulf zone of the other
//      side still standing ahead of the entry when the order is placed (a sell EG zone above a buy: not closed through, within its
//      life), and only when that is 2R or more away (a nearer zone under 2R is a roadblock: no trade). No such zone: no trade.
// The owner gave the zone, the return, the M15 BO, the entry, the stop and the target. The desk's own choices, said here: the
// barrier counts for 20 days after it failed and until an H4 candle closes back through it (as `h4Zone`); the M15 BO must come
// within EFB.wait 15-minute candles of the return, before a 15-minute close back through the zone's far side; the order lives
// EFB.fill 15-minute candles and is cancelled by a 15-minute close through the zone's far side or by price reaching the target
// first; one setup a barrier (its first BO); one position at a time a market. On its fill candle only the stop counts. Every step
// reads candles closed by that step's time. PAPER READING of the owner's trade, before costs: not a tested rule, never an edge.
export const EFB = { piv: 2, life: 20 * 86400, wait: 48, fill: 24, minRR: 2 };
export function efTrades(B, { from = 0, market = 'xau' } = {}) {
  const M5 = num(B['5m'] || []), M15 = num(B['15m'] || []), H4 = num(B['4h'] || []); if (M5.length < 100 || M15.length < 50 || H4.length < 20) return [];
  const dec = SOP.ALL[market] ? SOP.ALL[market].dec : 2, f = (v) => (+v).toFixed(dec), pre = market === 'xau' ? '' : market + ':', sg = (v) => `${v >= 0 ? '+' : '−'}${Math.abs(v).toFixed(2)}R`;
  const Z4 = turnBack(H4, zones(H4, '4h'), SEC['4h']), k = EFB.piv, piv = [], got = [];
  // the M15 turns of the closes: s 1 = an A level (a high turn), -1 = a V level (a low turn); known at the close of candle j + k
  for (let j = k; j + k < M15.length; j++) { let lo = true, hi = true;
    for (let q = 1; q <= k; q++) { if (!(M15[j].close < M15[j - q].close && M15[j].close < M15[j + q].close)) lo = false; if (!(M15[j].close > M15[j - q].close && M15[j].close > M15[j + q].close)) hi = false; }
    if (hi) piv.push({ j, s: 1, p: M15[j].close, known: M15[j + k].time + 900 }); if (lo) piv.push({ j, s: -1, p: M15[j].close, known: M15[j + k].time + 900 }); }
  // the last level of side s known by the open of candle q and not closed beyond by any candle after it and before q
  const levelAt = (q, s) => { const t = M15[q].time; for (let n = piv.length - 1; n >= 0; n--) { const L = piv[n]; if (L.known > t || L.s !== s) continue; if (L.j < q - 400) return null;
    let ok = true; for (let m = L.j + 1; m < q && ok; m++) if (s > 0 ? M15[m].close > L.p : M15[m].close < L.p) ok = false; if (ok) return L; } return null; };
  for (const Z of Z4) { if (Z.fail == null) continue; const d = -Z.dir, F = Z.fail, dead = Math.min(F + EFB.life, Z.back != null ? Z.back : Infinity);
    // 1. the return into the barrier
    let ret = -1; for (let i = lower(M15, F); i < M15.length && M15[i].time + 900 <= dead; i++) if (d > 0 ? M15[i].low <= Z.top : M15[i].high >= Z.bot) { ret = i; break; }
    if (ret < 0) continue;
    // 2. the M15 BO with the barrier, before a 15-minute close back through its far side
    let bo = -1, L = null;
    for (let q = ret; q < M15.length && q <= ret + EFB.wait && M15[q].time + 900 <= dead; q++) { const c = M15[q]; if (d > 0 ? c.close < Z.bot : c.close > Z.top) break;
      const lv = levelAt(q, d); if (lv && (d > 0 ? c.close > lv.p && c.close > Z.top : c.close < lv.p && c.close < Z.bot)) { bo = q; L = lv; break; } }
    if (bo < 0) continue;
    const K = M15[bo].time + 900; if (K < M5[0].time) continue;   // placed before the 5-minute candles on file: its window cannot be read
    // 3. the order: entry at the barrier's near side, stop past its far side, target the nearest opposite H4 EG zone standing ahead
    const entry = d > 0 ? Z.top : Z.bot, far = d > 0 ? Z.bot : Z.top, stop = far - d * SOP.sizes(market, far).buf, r0 = Math.abs(entry - stop);
    if (!(r0 > 0) || (d > 0 ? stop >= entry : stop <= entry)) continue;   // never a record without a stop on the losing side
    let T = null; for (const o of Z4) { if (o.dir !== -d || !(o.at <= K) || !(o.fail == null || o.fail > K) || !(o.end > K)) continue; const p = d > 0 ? o.bot : o.top; if ((p - entry) * d > 0 && (!T || (p - entry) * d < ((d > 0 ? T.bot : T.top) - entry) * d)) T = o; }
    if (!T) continue; const target = d > 0 ? T.bot : T.top, rr = Math.abs(target - entry) / r0; if (rr < EFB.minRR) continue;
    // the order's life: EFB.fill 15-minute candles, a 15-minute close through the barrier's far side, or the target reached first
    let until = M15[bo + EFB.fill] ? M15[bo + EFB.fill].time + 900 : K + EFB.fill * 900;
    for (let j = bo + 1; j < M15.length && M15[j].time + 900 <= until; j++) if (d > 0 ? M15[j].close < Z.bot : M15[j].close > Z.top) { until = M15[j].time + 900; break; }
    let fi = -1; for (let q = lower(M5, K); q < M5.length && M5[q].time + 300 <= until; q++) { const b = M5[q]; if (d > 0 ? b.low <= entry : b.high >= entry) { fi = q; break; } if (d > 0 ? b.high >= target : b.low <= target) break; }
    if (fi < 0) continue;
    const fillT = M5[fi].time, oc = outcome(M5, fi, d, entry, stop, target, Infinity), lvN = d > 0 ? 'A' : 'V';
    const tr = { id: `${pre}eg-ef-${d > 0 ? 'b' : 's'}-${Z.base}`, market, kind: 'eg-ef', label: 'H4 EF barrier → next H4 EG', h: '4h', l: '15m', side: d, t: fillT, K, entry, stop, target, r0, status: oc.status, R: oc.R, endT: oc.endT, exit: oc.exit, mfe: oc.mfe, float: oc.float };
    tr.log = [{ t: Z.at, text: `An H4 ${word(-d)} engulf zone ${f(Z.bot)} to ${f(Z.top)} (the engulf took ${Z.n} candle${Z.n === 1 ? '' : 's'}).` },
      { t: F, text: `An H4 candle closed ${d > 0 ? 'above' : 'below'} it: the zone failed (EF) and turned into a ${word(d)} barrier.` },
      { t: M15[ret].time + 900, text: `Price came back into the EF zone (a closed M15 candle traded into it).` },
      { t: K, text: `M15 BO ${word(d)}: a close ${d > 0 ? 'above' : 'below'} the M15 ${lvN} level ${f(L.p)} and out of the zone. A ${word(d)} limit rests at ${f(entry)} for ${EFB.fill} M15 candles; stop ${f(stop)} past the zone.` },
      { t: K, text: `Target ${f(target)}: the near side of the next H4 ${word(-d)} EG zone still standing, ${f(T.bot)} to ${f(T.top)} (${rr.toFixed(2)}R; 2R at least).` },
      { t: fillT, text: `The limit filled: ${word(d)} ${f(entry)}, risk ${f(r0)}.` },
      oc.status === 'target' ? { t: oc.endT, text: `Target reached: ${sg(oc.R)}.` } : oc.status === 'stopped' ? { t: oc.endT, text: `Stopped: ${sg(oc.R)}` + (oc.mfe >= 1 ? ` after running +${oc.mfe.toFixed(1)}R first.` : '.') }
        : { t: null, text: 'Still open on the last candle read' + (oc.float != null ? ` (${sg(oc.float)} now).` : '.') }];
    tr.marks = [{ kind: 'zone', top: Z.top, bot: Z.bot, a: Z.base, at: F, label: `H4 EF · ${word(d)} barrier` }, { kind: 'level', p: L.p, a: M15[L.j].time, at: K, label: `M15 ${lvN} level · BO ${word(d)}`, under: d < 0 },
      { kind: 'zone', top: T.top, bot: T.bot, a: T.base, at: T.at, label: `H4 ${word(-d)} EG · target` }];
    got.push(tr); }
  // one position at a time a market: by fill time, the order known first when two fill in one candle
  got.sort((a, b) => a.t - b.t || a.K - b.K); const out = []; let busy = -Infinity;
  for (const r of got) { if (r.t <= busy) continue; busy = r.endT || Infinity; delete r.K; if (r.t >= from) out.push(r); }
  return out;
}

// ─── the gold plan with Daily levels (the MSNR desk; the owner's fourth document, read in the desk's own words) ───
// Side: a Daily candle REJECTS a Daily level (a turn of the Daily CLOSES in the last 60 trading days, 2 candles a side: a V level
// at a low turn, an A level at a high turn, as on a line chart) that is still FRESH (no wick on it since it formed, see `snrSides`): it trades through the level and closes back on the other side; then, from the tap of that level until 3 TRADING days after the rejection day, an H4
// candle closes beyond the last H4 A / V level (a turn of the H4 closes, complete by the close of the tap candle) that stood before the tap, the same way. That side holds until the opposite pair completes. Zones: H4 engulf
// zones of that side, and opposite H4 zones that failed (they turn, until an H4 candle closes back through them). ONE entry a
// visit of price to such a zone (the first order that fills; see `snrTrades`). Entry, either type: (1) with price in such a zone a 15- or
// 30-minute engulf the same way, a limit at that engulf's zone for two hours; (2) a 15- or 30-minute QM whose head is in such a
// zone, a limit at its left shoulder for two hours (kind 'msnr-qm', see `qmSetups`). The Daily levels are V, A and OC levels
// (`snrSides`). "Strong" H4 BO: the plan shows it in a picture only, so any close beyond the last H4 A / V level counts. Stop 30 pips ($3.00), target 60 pips (2R, `RR`: the owner's pick of 22 Nov 2026; the plan's own figure is 90 pips), at most 2 entries a UTC day; a trade ends at its stop
// or its target (no one-at-a-time rule and no time exit: the plan names neither). Gold only.
export const SNR = { rr: 3, piv: 2, look: 60, boDays: 3, wait: 24, perDay: 2 };
export function snrSides(D1, H4) {
  const ev = [], k = SNR.piv;
  for (let i = 2 * k + 1; i < D1.length; i++) { const c = D1[i], lv = [];
    for (let j = Math.max(k, i - SNR.look); j + k < i; j++) { const b = D1[j]; let lo = true, hi = true;
      for (let q = 1; q <= k; q++) { if (!(b.close < D1[j - q].close && b.close < D1[j + q].close)) lo = false; if (!(b.close > D1[j - q].close && b.close > D1[j + q].close)) hi = false; }
      if (lo || hi) lv.push({ p: b.close, t: b.time, kind: lo ? 'V' : 'A', f: j }); }   // a V level (a low turn) or an A level (a high turn) of the CLOSES, as on a line chart
    // an OC level (the plan's third type of level): two Daily candles of one colour in a row; the level is where the first closed
    // and the second opened (the first's close). Both candles closed before candle i. Listed after the turns, so a turn at the
    // same place is named first only when it is the later level.
    for (let j = Math.max(1, i - SNR.look); j + 1 < i; j++) { const a = D1[j], b = D1[j + 1];
      if ((a.close > a.open && b.close > b.open) || (a.close < a.open && b.close < b.open)) lv.push({ p: a.close, t: b.time, kind: 'OC', f: j }); }
    lv.sort((x, y) => x.t - y.t);
    // The rejected level must be FRESH (21 Nov 2026, second pass; the plan shows it in its picture, the SnR notes say it in
    // words): since the level formed no Daily candle has put a WICK on it. A candle whose BODY goes through the level (it opens
    // on one side and closes on the other) makes it fresh again; the last such contact decides. The candle right after the
    // level's own (the second candle of the pair that makes it) is not counted. Only candles closed before the rejecting one.
    const fresh = (L) => { let ok = true; for (let q = L.f + 2; q < i; q++) { const b = D1[q]; if (b.low > L.p || b.high < L.p) continue; ok = (b.open < L.p && b.close > L.p) || (b.open > L.p && b.close < L.p); } return ok; };
    const upL = lv.filter((L) => c.low <= L.p && c.close > L.p && c.open > L.p && fresh(L)).pop(), dnL = lv.filter((L) => c.high >= L.p && c.close < L.p && c.open < L.p && fresh(L)).pop();
    if (!upL !== !dnL) { const k0 = upL || dnL; ev.push({ t: c.time + 86400, dir: upL ? 1 : -1, day: c.time, from: D1[i - 1].time + 86400, key: { p: k0.p, t: k0.t, kind: k0.kind } }); } }
  // The H4 break that confirms a rejection ("strong BO"): a close beyond the last H4 A level (V level for a sell), a turn of the
  // H4 CLOSES, 2 candles a side, as every A / V level on these desks. Since 21 Nov 2026 the level is the EXTERNAL one: the last
  // such level that was known, and still unbroken, when price TAPPED the Daily level (the first H4 candle of the rejecting Daily
  // candle that trades to it); a level formed after the tap is internal and is not read (until then: the latest level at each
  // candle). The break is looked for from the tap candle on, so a break made on the rejection day itself counts (until then:
  // only from the Daily close), for SNR.boDays days after that day. The side is known at the later of the break's close and the
  // Daily close (the rejection is not a rejection before its day has closed).
  const sides = [], turn = (j, dir) => { const b = H4[j]; for (let q = 1; q <= k; q++) if (dir > 0 ? !(b.close > H4[j - q].close && b.close > H4[j + q].close) : !(b.close < H4[j - q].close && b.close < H4[j + q].close)) return false; return true; };
  // SNR.boDays are TRADING days (21 Nov 2026, second pass; calendar days until then, so a Friday rejection had one trading day
  // where a Monday one had three): the window ends with the close of the boDays-th weekday after the rejection day.
  const boEnd = (day) => { let t = day, n = 0; while (n < SNR.boDays) { t += 86400; const w = new Date(t * 1000).getUTCDay(); if (w !== 0 && w !== 6) n++; } return t + 86400; };
  for (const e of ev) { const iEnd = lower(H4, e.t), end = boEnd(e.day); let tap = iEnd;
    for (let i = lower(H4, e.from); i < iEnd; i++) if (e.dir > 0 ? H4[i].low <= e.key.p : H4[i].high >= e.key.p) { tap = i; break; }
    let L = null, lj = -1, ext = e.dir > 0 ? -Infinity : Infinity;   // ext: the most extreme close between a candidate level and the tap (a level closed beyond is broken)
    for (let j = tap - 1; j >= k && j > tap - 60; j--) { const b = H4[j];
      // a turn completed by the CLOSE of the tap candle counts (21 Nov 2026, second pass: the plan's own example breaks an A level
      // with one candle between it and the tap candle; until then the turn had to be complete before the tap candle opened).
      // The tap candle then closed on the level's near side, so the break can only come from the candle after it.
      if (j + k <= tap && turn(j, e.dir) && (e.dir > 0 ? b.close >= ext : b.close <= ext)) { L = b.close; lj = j; break; }
      ext = e.dir > 0 ? Math.max(ext, b.close) : Math.min(ext, b.close); }
    if (L == null) continue;
    for (let i = tap; i < H4.length && H4[i].time < end; i++) if (e.dir > 0 ? H4[i].close > L : H4[i].close < L) { const boT = H4[i].time + 14400;
      sides.push({ t: Math.max(boT, e.t), boT, dir: e.dir, day: e.day, level: L, levelT: H4[lj].time, tapT: H4[tap].time, key: e.key }); break; } }
  return sides.sort((a, b) => a.t - b.t);
}
// The plan's second entry type, a 15- / 30-minute QM zone. The plan draws it only as a sketch (no words): a low, a high, a LOWER
// low, then a break above that high, and price comes back to the first low. The desk's reading, on the line chart of the closes
// like every A / V level here (SNR.piv candles a side): for a buy, the last V level before the head is the left shoulder, the A
// level between them is the high, the head is a V level with a LOWER close than the shoulder, and the QM is complete at the first
// close above that A level (none before it since the A level formed), after the head and within QM.wait candles of it. A break
// right after the head counts (until 21 Nov 2026 it was dropped): the QM is then known once the head is a known turn, SNR.piv
// candles after it, so it is dated at the later of the break's close and that candle's close. The zone is the shoulder candle from its close to its wick (a V level's zone);
// the limit rests at the shoulder's close. A sell mirrors it. QM.wait is the desk's own choice.
export const QM = { wait: 20 };
export function qmSetups(M15) {
  const out = [], k = SNR.piv;
  for (const [tf, C] of [['15m', M15], ['30m', m30of(M15)]]) { const sec = SEC[tf], piv = [];
    for (let m = k; m + k < C.length; m++) { let lo = true, hi = true;
      for (let q = 1; q <= k; q++) { if (!(C[m].close < C[m - q].close && C[m].close < C[m + q].close)) lo = false; if (!(C[m].close > C[m - q].close && C[m].close > C[m + q].close)) hi = false; }
      if (lo) piv.push({ m, s: 1 }); if (hi) piv.push({ m, s: -1 }); }
    for (let h = 0; h < piv.length; h++) { const H = piv[h], d = H.s;   // the head: a V turn for a buy, an A turn for a sell
      let mid = null, sh = null; for (let j = h - 1; j >= 0; j--) { if (!mid) { if (piv[j].s === -d) mid = piv[j]; } else if (piv[j].s === d) { sh = piv[j]; break; } }
      if (!mid || !sh) continue; const head = C[H.m], L = C[sh.m].close, M = C[mid.m].close;
      if (!(d > 0 ? head.close < L && M > L : head.close > L && M < L)) continue;
      let bo = -1; for (let i = mid.m + 1; i < C.length && i <= H.m + QM.wait; i++) { if (d > 0 ? C[i].close > M : C[i].close < M) { bo = i; break; } }
      if (bo <= H.m) continue;   // broken before the head (or never): not this shape
      const s = C[sh.m], at = C[Math.max(bo, H.m + k)].time + sec; if (out.some((x) => x.tf === tf && x.dir === d && x.base === s.time && x.at === at)) continue;   // the same QM again (two heads, one shoulder and break)
      out.push({ tf, dir: d, at, level: L, mid: M, midT: C[mid.m].time, head, base: s.time, top: d > 0 ? L : s.high, bot: d > 0 ? s.low : L }); } }
  return out.sort((a, b) => a.at - b.at);
}
// `orders`: an array handed in is filled with every order that filled and what became of it ({ id, t, side, took: 'trade' |
// 'visit' (not the first of its visit) | 'day' (the 2-a-day limit) | 'same' (the order another trigger already gave) }): a read-out for tests and counts, it changes nothing.
export function snrTrades(B, { from = 0, market = 'xau', orders = null } = {}) {
  if (market !== 'xau') return [];
  const M5 = num(B['5m'] || []), M15 = num(B['15m'] || []), H4 = num(B['4h'] || []), D1 = foldWeekend(num(B['1d'] || [])); if (M5.length < 100 || M15.length < 50 || H4.length < 30 || D1.length < 20) return [];
  const f = (v) => (+v).toFixed(2), sides = snrSides(D1, H4), Z4 = turnBack(H4, zones(H4, '4h'), SEC['4h']), out = [], perDay = {};
  const sideAt = (t) => { let s = null; for (const x of sides) { if (x.t > t) break; s = x; } return s; };
  // every order that fills, then the book in the order of the FILLS: one position at a time and 2 a UTC day are decided when
  // an order fills, on what had filled before it (until 21 Nov 2026 a signal was dropped because an earlier signal's limit
  // would fill later: a look ahead)
  const cands = [];
  for (const m of triggers(M15, true)) { const d = m.dir, T = m.at, S = sideAt(T); if (!S || S.dir !== d) continue; const c = m.c;
    const inZ = (z) => (d > 0 ? c.low <= z.top && c.close >= z.bot : c.high >= z.bot && c.close <= z.top);
    const Z = Z4.filter((z) => z.at >= S.t - 20 * 86400 && inZ(z) && ((z.dir === d && z.at <= T && z.end > T) || (z.dir === -d && h4Zone(z, d, T)))).pop(); if (!Z) continue;   // a turned zone: until an H4 candle closes back through it
    if (T < M5[0].time) continue;
    const entry = d > 0 ? m.top : m.bot, i0 = lower(M5, T); let fi = -1; for (let q = i0; q < Math.min(M5.length, i0 + SNR.wait) && M5[q].time < T + SNR.wait * 300; q++) if (d > 0 ? M5[q].low <= entry : M5[q].high >= entry) { fi = q; break; }
    if (fi >= 0) cands.push({ m, d, T, S, Z, entry, fi }); }
  // the plan's SECOND entry type: a 15- or 30-minute QM zone (see `qmSetups`), its head in an H4 zone of the side
  for (const q of qmSetups(M15)) { const d = q.dir, T = q.at, S = sideAt(T); if (!S || S.dir !== d) continue; const h = q.head;
    const Z = Z4.filter((z) => z.at >= S.t - 20 * 86400 && (d > 0 ? h.low <= z.top && h.close >= z.bot : h.high >= z.bot && h.close <= z.top)
      && ((z.dir === d && z.at <= h.time + SEC[q.tf] && z.end > T) || (z.dir === -d && h4Zone(z, d, T)))).pop(); if (!Z) continue;
    if (T < M5[0].time) continue;
    const entry = q.level, i0 = lower(M5, T); let fi = -1; for (let k = i0; k < Math.min(M5.length, i0 + SNR.wait) && M5[k].time < T + SNR.wait * 300; k++) if (d > 0 ? M5[k].low <= entry : M5[k].high >= entry) { fi = k; break; }
    if (fi >= 0) cands.push({ m: q, d, T, S, Z, entry, fi, qm: true }); }
  cands.sort((x, y) => x.fi - y.fi || x.T - y.T);
  // the plan's own limits: 2 trades a day, a stop and a target (no one-at-a-time rule and no time exit: both were the desk's until 21 Nov 2026)
  // ONE entry a setup (21 Nov 2026, second pass; the plan: take entry on any ONE type of its entry model): within one visit of
  // price to an H4 zone on one side only the FIRST order that fills is a trade, whatever its type (M15 EG, M30 EG, EF, QM). A
  // visit ends when a closed 15-minute candle lies wholly outside the zone. Decided in the order of the fills, on what had
  // filled before; the 2-a-day limit is applied after it (an entry the limit refuses was still its visit's entry).
  const visit = new Map(), took = new Set(), left = (Z, a, b) => { for (let q = lower(M15, a - a % 900 + 900); q < M15.length && M15[q].time + 900 <= b; q++) if (M15[q].low > Z.top || M15[q].high < Z.bot) return true; return false; };
  for (const { m, d, T, S, Z, entry, fi, qm } of cands) { const fillT = M5[fi].time, vk = d + ':' + Z.dir + ':' + Z.base, pv = visit.get(vk), oid = `msnr-${qm ? 'qm' : 'sop'}-${d > 0 ? 'b' : 's'}-${m.base}${m.tf === '30m' ? '-30' : ''}${m.ef ? '-ef' : ''}`;
    const note = (took) => { if (orders) orders.push({ id: oid, t: fillT, side: d, zone: { base: Z.base, dir: Z.dir, top: Z.top, bot: Z.bot }, took }); };
    // ONE order is recorded once and counts once (21 Nov 2026): a 15-minute and a 30-minute trigger (or an EG and an EF) can give
    // the same order (side, entry, so stop and target, and fill candle) and pick different H4 zones, so the visit rule did not
    // see it and the pair used both of the day's entries. The later one is the order already taken: it is its own zone's
    // entry of this visit too, and nothing more.
    const ok = d + '|' + fillT + '|' + entry; if (took.has(ok)) { note('same'); if (pv == null || left(Z, pv, fillT)) visit.set(vk, fillT); continue; }
    if (pv != null && !left(Z, pv, fillT)) { note('visit'); continue; } visit.set(vk, fillT); took.add(ok);
    const dk = Math.floor(fillT / 86400); if ((perDay[dk] || 0) >= SNR.perDay) { note('day'); continue; } perDay[dk] = (perDay[dk] || 0) + 1; note('trade');
    const rr = RR[qm ? 'msnr-qm' : 'msnr-sop'], pip = stopSize('xau'), stop = entry - d * pip, target = entry + d * rr * pip, oc = outcome(M5, fi, d, entry, stop, target, Infinity); if (fillT < from) continue;
    const turned = Z.dir !== d, tr = { id: oid, market, kind: qm ? 'msnr-qm' : 'msnr-sop', label: qm ? 'EG x SNR · gold plan, QM' : 'EG x SNR · gold plan', h: '4h', l: m.tf, side: d, t: fillT, entry, stop, target, r0: pip, status: oc.status, R: oc.R, endT: oc.endT, exit: oc.exit, mfe: oc.mfe, float: oc.float };
    tr.log = [{ t: S.t, text: `Side ${word(d)}: the Daily candle of ${new Date(S.day * 1000).toISOString().slice(0, 10)} rejected the Daily ${S.key.kind} level ${f(S.key.p)} (${S.key.kind === 'OC' ? 'where two Daily candles of one colour met' : 'a turn of the Daily closes'}), and an H4 candle closed ${d > 0 ? 'above' : 'below'} ${f(S.level)}, the last H4 ${d > 0 ? 'A' : 'V'} level (a turn of the H4 closes) that stood before price tapped the Daily level.` },
      qm ? { t: T, text: `${NAME[m.tf]} QM ${word(d)}: shoulder ${f(m.level)}, ${d > 0 ? 'high' : 'low'} ${f(m.mid)}, head ${f(m.head.close)} in the H4 ${turned ? 'EF' : 'EG'} zone ${f(Z.bot)} to ${f(Z.top)}, then a close ${d > 0 ? 'above' : 'below'} ${f(m.mid)}: a ${word(d)} limit at the shoulder, ${f(entry)}, for two hours.` }
        : { t: T, text: `Price is in the H4 ${turned ? 'zone that failed and turned' : word(d) + ' engulf zone'} ${f(Z.bot)} to ${f(Z.top)} and ` + (m.ef ? `a ${NAME[m.tf]} ${word(-d)} engulf zone failed (a close through it)` : `a ${NAME[m.tf]} engulf ${word(d)} closed`) + `: a ${word(d)} limit rests at its zone, ${f(entry)}, for two hours.` },
      { t: fillT, text: `Filled: ${word(d)} ${f(entry)}, stop ${f(stop)} (30 pips), target ${f(target)} (${30 * rr} pips, ${rr}R).` },
      oc.status === 'target' ? { t: oc.endT, text: `Target reached: +${rr.toFixed(2)}R.` } : oc.status === 'stopped' ? { t: oc.endT, text: `Stopped: ${oc.R >= 0 ? '+' : '−'}${Math.abs(oc.R).toFixed(2)}R` + (oc.mfe >= 1 ? ` after running +${oc.mfe.toFixed(1)}R first.` : '.') }
        : oc.status === 'time' ? { t: oc.endT, text: `Time limit: closed at ${f(oc.exit)}, ${oc.R >= 0 ? '+' : '−'}${Math.abs(oc.R).toFixed(2)}R.` } : { t: null, text: 'Still open on the last candle read' + (oc.float != null ? ` (${oc.float >= 0 ? '+' : '−'}${Math.abs(oc.float).toFixed(2)}R now).` : '.') }];
    tr.marks = [{ kind: 'level', p: S.key.p, a: S.key.t, at: S.day + 86400, label: `Daily ${S.key.kind} level`, under: d > 0 }, { kind: 'level', p: S.level, a: S.levelT, at: S.t, label: `H4 ${d > 0 ? 'A' : 'V'} level · BO ${word(d)}`, under: d < 0 },
      { kind: 'zone', top: Z.top, bot: Z.bot, a: Z.base, at: turned ? Z.fail : Z.at, label: turned ? 'H4 EF (zone failed)' : 'H4 EG zone' }]
      .concat(qm ? [{ kind: 'level', p: m.mid, a: m.midT, at: m.at, label: `${NAME[m.tf]} QM · BO ${word(d)}`, under: d < 0 }, { kind: 'zone', top: m.top, bot: m.bot, a: m.base, at: m.at, label: NAME[m.tf] + ' QM zone · entry' }]
        : [{ kind: 'zone', top: m.top, bot: m.bot, a: m.base, at: m.at, label: NAME[m.tf] + (m.ef ? ' EF zone · entry' : ' EG zone · entry' + egN(m)) }]);
    out.push(tr); }
  return out;
}

// ─── the direction reading of the MSNR desk (21 Nov 2026, owner: "make sure you are marking the key levels … V level, engulfing,
// EG fail, BO"). The desk's own words of the direction procedure, candle by candle, nothing at a candle reads a later one:
//   levels   an A level is a HIGH turn of the CLOSES (a peak on the line chart), a V level a LOW turn, DIR.K candles a side, known
//            once the last of those candles has closed. A level on the timeframe above is a zone from that close to its wick.
//   zones    on the timeframe above: A / V levels, engulf zones (as `zones`: the base candle wick to wick), an engulf zone that
//            FAILED (a close through it: it turns and serves the other side, "EF") and the dominant pair (two candles of one
//            colour, the second beyond the first's extreme and closing beyond it: the first candle's body).
//   switch   price taps a buy-side zone of the timeframe above; the last A level that existed BEFORE the tap and is still
//            unbroken is the external one. The working chart must have made a BO DOWN (its last break down at the tap, or a
//            close below its last V level after it: "a BO sell, then the BO buy"; until 21 Nov 2026 only the state AT the
//            tap counted, so a zone tapped just before that BO sell was lost); a working candle closing above it, within DIR.WAIT candles of the
//            timeframe above, turns the direction to BUY. Mirrored for a sell. A break of a level formed after the tap is
//            internal and changes nothing; without a tapped zone the direction stays what it was.
//   oc       an open-close level: two candles of one colour in a row that are not a dominant pair; the level where the first
//            closed and the second opened (a buy level after two up candles, a sell level after two down ones). Added 21 Nov 2026.
// events[] carries what the chart must show for each switch.
export const DIR = { K: 2, AGE: 60, WAIT: 10 };
export const KEY_NAME = { v: 'V level', a: 'A level', oc: 'open-close level', eg: 'engulf zone', ef: 'engulf zone that failed (EF)', dom: 'dominant zone' };
export function direction(work, keyOf, htfSec) {
  const K = DIR.K, n = work.length, call = new Int8Array(n), last = new Int32Array(n).fill(-1), events = [];
  const H = []; let cur = null, zones = [], pend = [], lastA = null, lastV = null, st = 0, dir = 0;
  const add = (s, kind, bottom, top, t) => { if (top > bottom || (kind === 'oc' && top >= bottom)) zones.push({ s, kind, bottom, top, t, known: H[H.length - 1].time + htfSec, born: H.length, tapped: false, dead: false }); };
  const onClose = () => {
    const c = H[H.length - 1], flips = [];
    for (const z of zones) { if (z.dead) continue;
      if (z.s > 0 ? c.close < z.bottom : c.close > z.top) { z.dead = true; if (z.kind === 'eg') flips.push(z); }
      else if (H.length - z.born >= DIR.AGE) z.dead = true; }
    zones = zones.filter((z) => !z.dead);
    for (const z of flips) add(-z.s, 'ef', z.bottom, z.top, c.time);
    const m = H.length - 1 - K;
    if (m >= K) { const x = H[m]; let lo = true, hi = true;
      for (let j = 1; j <= K; j++) { if (!(x.close < H[m - j].close && x.close < H[m + j].close)) lo = false; if (!(x.close > H[m - j].close && x.close > H[m + j].close)) hi = false; }
      if (lo) add(1, 'v', x.low, x.close, x.time);
      if (hi) add(-1, 'a', x.close, x.high, x.time); }
    if (H.length >= 2) { const p = H[H.length - 2], up = (b) => b.close > b.open, dn = (b) => b.close < b.open;
      // an engulf zone of the timeframe above: the SAME definition as `zones` (a close beyond the base's high / low, however
      // many candles it takes, the first such close, the base candle wick to wick); until 21 Nov 2026 a body engulf of two candles
      const eg = engulfAt(H, H.length - 1);
      if (eg) { const g = H[eg.j]; let gone = false; for (let q = eg.j + 1; q < H.length - 1 && !gone; q++) { const b = H[q]; gone = eg.dir > 0 ? (up(b) && b.close > g.high) || b.close < g.low : (dn(b) && b.close < g.low) || b.close > g.high; }
        if (!gone) add(eg.dir, 'eg', g.low, g.high, g.time); }
      const domU = up(c) && up(p) && c.high > p.high && c.close > p.high, domD = dn(c) && dn(p) && c.low < p.low && c.close < p.low;
      if (domU) add(1, 'dom', p.open, p.close, p.time);
      if (domD) add(-1, 'dom', p.close, p.open, p.time);
      // an open-close level: two candles of one colour where the second does NOT close beyond the first's extreme (else it is a
      // DOM, whose zone already holds that level). The level is where the first closed and the second opened; a buy level after
      // two up candles, a sell level after two down candles
      if (up(c) && up(p) && !domU) add(1, 'oc', Math.min(p.close, c.open), Math.max(p.close, c.open), p.time);
      if (dn(c) && dn(p) && !domD) add(-1, 'oc', Math.min(p.close, c.open), Math.max(p.close, c.open), p.time); }
  };
  for (let i = 0; i < n; i++) {
    const b = work[i], k = keyOf(b.time);
    if (!cur || cur.time !== k) { if (cur) { H.push(cur); onClose(); } cur = { time: k, open: b.open, high: b.high, low: b.low, close: b.close }; }
    else { if (b.high > cur.high) cur.high = b.high; if (b.low < cur.low) cur.low = b.low; cur.close = b.close; }
    // the tap first: a candle that taps the level and closes beyond the swing is the breakout candle itself
    for (const z of zones) { if (z.tapped || b.low > z.top || b.high < z.bottom) continue;
      z.tapped = true; const L = z.s > 0 ? lastA : lastV;
      if (L && !L.broken) pend.push({ opp: st === -z.s, s: z.s, zone: z, level: L.p, levelT: L.t, tapT: b.time, tapH: H.length }); }
    if (pend.length) { const keep = [];
      for (const q of pend) {
        if (q.zone.dead || H.length - q.tapH > DIR.WAIT) continue;
        if (st === -q.s) q.opp = true;   // a BO the other way, at the tap or after it: "a BO sell, then the BO buy"
        if (q.s > 0 ? b.close > q.level : b.close < q.level) { if (!q.opp) continue;   // a break with no BO the other way before it is a continuation: the level is spent
          if (dir !== q.s) events.push({ i, t: b.time, s: q.s, kind: q.zone.kind, bottom: q.zone.bottom, top: q.zone.top, zoneT: q.zone.t, zoneAt: q.zone.known, tapT: q.tapT, level: q.level, levelT: q.levelT });
          dir = q.s; }
        else keep.push(q); }
      pend = keep; }
    if (lastA && !lastA.broken && b.close > lastA.p) { lastA.broken = true; st = 1; }
    if (lastV && !lastV.broken && b.close < lastV.p) { lastV.broken = true; st = -1; }
    const m = i - K;
    if (m >= K) { const x = work[m]; let lo = true, hi = true;
      for (let j = 1; j <= K; j++) { if (!(x.close < work[m - j].close && x.close < work[m + j].close)) lo = false; if (!(x.close > work[m - j].close && x.close > work[m + j].close)) hi = false; }
      if (hi) lastA = { p: x.close, t: x.time, broken: false };
      if (lo) lastV = { p: x.close, t: x.time, broken: false }; }
    call[i] = dir; last[i] = events.length - 1;
  }
  return { call, last, events };
}
