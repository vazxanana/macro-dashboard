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
const SEC = { '1d': 86400, '4h': 14400, '1h': 3600, '30m': 1800, '15m': 900, '5m': 300 }, NAME = { '4h': 'H4', '1h': 'H1', '30m': 'M30', '15m': 'M15', '5m': 'M5' };
// 30-minute candles from the 15-minute ones (a candle with only one half on file is left out), and the trigger zones of both:
// the methods name the 15- or the 30-minute engulf as the trigger (21 Nov 2026, the documents checked page by page)
const m30of = (M15) => { const out = []; for (let i = 1; i < M15.length; i++) { const a = M15[i - 1], b = M15[i]; if (a.time % 1800 === 0 && b.time === a.time + 900) out.push({ time: a.time, open: a.open, high: Math.max(a.high, b.high), low: Math.min(a.low, b.low), close: b.close }); } return out; };
// An EF counts like an EG (owner, 21 Nov 2026: "the fail is the same logic as entry for other timeframes"; then "keep the msnr":
// the gold plan only, the Engulfing plan and short method keep EG triggers): an opposite 15- or 30-minute zone that FAILED (a
// close through it) triggers the other way, from the close that broke it, with its own box as the zone (`ef: true`)
const efsOf = (Z, C) => Z.filter((z) => z.fail != null).map((z) => ({ ...z, dir: -z.dir, at: z.fail, c: C[z.fi], ef: true }));
const triggers = (M15, ef = false) => { const M30 = m30of(M15), Z15 = zones(M15, '15m'), Z30 = zones(M30, '30m');
  return Z15.map((z) => ({ ...z, c: M15[z.i] })).concat(Z30.map((z) => ({ ...z, c: M30[z.i] })), ef ? efsOf(Z15, M15).concat(efsOf(Z30, M30)) : []).sort((x, y) => x.at - y.at || (x.tf === '15m' ? -1 : 1) || (x.ef ? 1 : -1)); };
const zw = (m) => (m.ef ? ' EF (zone failed)' : ' EG zone');
// an H4 zone of side d as the methods mark it: an engulf zone of that side still standing, or a zone of the other side that
// FAILED (a close through it) and so turned
// A turned zone stops counting once an H4 candle closes BACK through it (the other side from the one it failed on): by the
// methods' own rule a zone closed through is failed, and no page uses a turned zone after such a close (21 Nov 2026; until
// then a turned zone counted for 20 days whatever happened next). `turnBack` stamps that close's time on the zone (`back`).
const h4Zone = (z, d, T) => (z.dir === d && z.at <= T && z.end > T) || (z.dir === -d && z.fail != null && z.fail <= T && T - z.fail < 20 * 86400 && !(z.back != null && z.back <= T));
const turnBack = (C, Z, sec) => { for (const z of Z) { if (z.fail == null) continue;
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
export function engulfAt(C, i, back = Infinity) {
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
export function zones(C, tf) {
  const sec = SEC[tf], life = EGM.life[tf] || 120, out = [];
  for (let i = 1; i < C.length; i++) { const e = engulfAt(C, i); if (!e) continue; const dir = e.dir, p = C[e.j], c = C[i];
    // the candles between the base and this one: an earlier one of this colour that closed beyond the base already made the zone;
    // a close through the base's other side cancelled the base
    let gone = false; for (let q = e.j + 1; q < i && !gone; q++) { const b = C[q]; gone = dir > 0 ? (b.close > b.open && b.close > p.high) || b.close < p.low : (b.close < b.open && b.close < p.low) || b.close > p.high; }
    if (gone) continue;
    const z = { tf, dir, top: p.high, bot: p.low, base: p.time, at: c.time + sec, touch: null, fail: null, i };
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
export function methodTrades(B, { from = 0, market = 'xau', orders = null } = {}) {
  const M5 = num(B['5m'] || []), M15 = num(B['15m'] || []), H1 = num(B['1h'] || []), H4 = num(B['4h'] || []); if (M5.length < 100 || M15.length < 50 || H4.length < 20) return [];
  const D1 = foldWeekend(num(B['1d'] || [])), dec = SOP.ALL[market] ? SOP.ALL[market].dec : 2, f = (v) => (+v).toFixed(dec), pipOf = () => stopSize(market);   // 30 pips on gold's scale, from the trade's own price (not the newest: a stop must not change between two reads)
  const Z4 = turnBack(H4, zones(H4, '4h'), SEC['4h']), Z1 = zones(H1, '1h'), Z15 = zones(M15, '15m'), Z5 = zones(M5, '5m'), DZ = zones(D1, '1d'), pre = market === 'xau' ? '' : market + ':', out = [];
  // the methods give a stop and a target only: no time exit (24 hours until 21 Nov 2026)
  const rec = (kind, label, d, fi, entry, T0, log, marks, trail = false) => { const pip = pipOf(entry), stop = entry - d * pip, target = trail ? null : entry + d * EGM.rr * pip, fillT = M5[fi].time;
    const oc = trail ? efTrail(M5, Z5, fi, d, entry, stop) : outcome(M5, fi, d, entry, stop, target, Infinity), sg = (v) => `${v >= 0 ? '+' : '−'}${Math.abs(v).toFixed(2)}R`;
    const tr = { id: `${pre}${kind}-${d > 0 ? 'b' : 's'}-${T0}`, market, kind, label, h: '4h', l: '5m', side: d, t: fillT, entry, stop, target, r0: pip, status: oc.status, R: oc.R, endT: oc.endT, exit: oc.exit, mfe: oc.mfe, float: oc.float };
    if (trail && oc.moves) { tr.stopNow = oc.stop; tr.stopAt = oc.movedAt; }   // and WHEN it moved there: a settle must not apply it to candles before   // the trailed stop in force (the record's `stop` stays the opening stop: 1R is the opening risk)
    tr.log = log.concat([{ t: fillT, text: `Price came back to the zone: ${word(d)} ${f(entry)}, stop ${f(stop)} (30 pips), ` + (trail ? 'no target: the stop is trailed with the M5 EF.' : `target ${f(target)} (${EGM.rr}R).`) }],
      trail && oc.moves ? [{ t: oc.movedAt, text: `The stop was trailed ${oc.moves} time${oc.moves > 1 ? 's' : ''} with the M5 EF; the last M5 ${word(-d)} zone that failed, ${f(oc.ef.bot)} to ${f(oc.ef.top)}, put it at ${f(oc.stop)}.` }] : [],
      [oc.status === 'target' ? { t: oc.endT, text: `Target reached: +${EGM.rr.toFixed(2)}R.` } : oc.status === 'stopped' ? { t: oc.endT, text: `Stopped: ${oc.R >= 0 ? '+' : '−'}${Math.abs(oc.R).toFixed(2)}R` + (oc.mfe >= 1 ? ` after running +${oc.mfe.toFixed(1)}R first.` : '.') }
        : oc.status === 'trail' ? { t: oc.endT, text: `Trailed stop hit at ${f(oc.exit)}: ${sg(oc.R)}.` }
        : oc.status === 'time' ? { t: oc.endT, text: `Time limit: closed at ${f(oc.exit)}, ${sg(oc.R)}.` } : { t: null, text: 'Still open on the last candle read' + (oc.float != null ? ` (${oc.float >= 0 ? '+' : '−'}${Math.abs(oc.float).toFixed(2)}R now).` : '.') }]);
    tr.marks = marks.concat(trail && oc.moves && oc.status !== 'open' ? [{ kind: 'zone', top: oc.ef.top, bot: oc.ef.bot, a: oc.ef.base, at: oc.ef.fail, label: 'M5 EF · trailed stop' }] : []); out.push(tr); };
  // a limit at `entry`, valid over candles [i0, i1): the index of the candle that fills it, or -1
  const fillAt = (d, entry, i0, i1, tEnd = Infinity) => { for (let k = i0; k < Math.min(M5.length, i1) && M5[k].time < tEnd; k++) if (d > 0 ? M5[k].low <= entry : M5[k].high >= entry) return k; return -1; };

  // plan / simple: H4 zone, M15 engulf inside it, then the M5 failure and the M5 zone behind it
  const used = new Set(), sets = [], at5 = new Map(Z5.map((z) => [z.dir + ':' + z.at, z]));
  for (const m of triggers(M15)) { const d = m.dir, T = m.at, tn = NAME[m.tf], t0 = m.c.time;   // t0: the open of the candle that completed the 15- / 30-minute engulf
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
    if (orders) orders.push({ kind: plan ? 'eg-plan' : 'eg-simple', side: d, base: E.base, entry, stop: entry - d * pipOf(entry), target: entry + d * EGM.rr * pipOf(entry), placed: K, until: K + EGM.fill * 300, fillT: fi < 0 ? null : M5[fi].time });
    if (fi < 0) return;
    rec(plan ? 'eg-plan' : 'eg-simple', plan ? 'Plan · with the Daily' : 'Simple EG · H4 zone', d, fi, entry, E.base, [
      { t: T, text: (plan ? `The Daily's last engulf is a ${word(d)}. ` : `The Daily's last engulf is ${ds ? 'a ' + word(ds) : 'not on file'}, so this is the short method without the Daily. `) + `Price is in the H4 ${turned ? 'zone that failed and turned' : word(d) + ' engulf zone'} ${f(Z.bot)} to ${f(Z.top)} and ` + (m.ef ? `a ${tn} ${word(-d)} engulf zone failed (a close through it).` : `a ${tn} engulf ${word(d)} closed.`) },
      { t: K, text: `On M5 the ${word(-d)} engulf zone ${f(F.bot)} to ${f(F.top)} failed (a close through it). The M5 ${word(d)} engulf zone behind it is ${f(E.bot)} to ${f(E.top)}: a ${word(d)} limit rests at ${f(entry)} for an hour.` }],
    (plan && dz ? [{ kind: 'zone', top: dz.top, bot: dz.bot, a: dz.base, at: dz.at, label: 'Daily EG zone' }] : []).concat([{ kind: 'zone', top: Z.top, bot: Z.bot, a: Z.base, at: turned ? Z.fail : Z.at, label: turned ? 'H4 EF (zone failed)' : 'H4 EG zone' }, { kind: 'zone', top: m.top, bot: m.bot, a: m.base, at: m.at, label: tn + zw(m) },
      { kind: 'zone', top: F.top, bot: F.bot, a: F.base, at: F.fail, label: 'M5 EF (zone failed)' }, { kind: 'zone', top: E.top, bot: E.bot, a: E.base, at: E.at, label: 'M5 EG zone · entry' }])); } }); }
  sets.sort((a, b) => a.K - b.K);   // a stable sort: setups known at the same close keep the triggers' order
  for (const x of sets) { if (used.has(x.key)) continue; used.add(x.key); x.go(); }

  // direct: a fresh H4 zone left alone for two H4 candles, a fresh H1 zone inside it, a fresh M15 zone inside that
  const inside = (a, b) => a.top <= b.top && a.bot >= b.bot;   // INSIDE the zone above (until 21 Nov 2026 an overlap was enough)
  // "left alone for the next two H4 candles" counts two CLOSED H4 candles after the one that made the zone, not 8 hours of clock
  // time (until 21 Nov 2026: over a weekend or a missing candle no H4 candle, or one, had traded and the zone still counted)
  for (const Z of Z4) { const d = Z.dir, qc = H4[Z.i + EGM.quiet]; if (!qc) continue; const tc = qc.time + SEC['4h']; if (Z.touch != null && Z.touch < tc) continue; if (Z.fail != null && Z.fail <= tc) continue;
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

// ─── the gold plan with Daily levels (the MSNR desk; the owner's fourth document, read in the desk's own words) ───
// Side: a Daily candle REJECTS a Daily level (a turn of the Daily CLOSES in the last 60 trading days, 2 candles a side: a V level
// at a low turn, an A level at a high turn, as on a line chart) that is still FRESH (no wick on it since it formed, see `snrSides`): it trades through the level and closes back on the other side; then, from the tap of that level until 3 TRADING days after the rejection day, an H4
// candle closes beyond the last H4 A / V level (a turn of the H4 closes, complete by the close of the tap candle) that stood before the tap, the same way. That side holds until the opposite pair completes. Zones: H4 engulf
// zones of that side, and opposite H4 zones that failed (they turn, until an H4 candle closes back through them). ONE entry a
// visit of price to such a zone (the first order that fills; see `snrTrades`). Entry, either type: (1) with price in such a zone a 15- or
// 30-minute engulf the same way, a limit at that engulf's zone for two hours; (2) a 15- or 30-minute QM whose head is in such a
// zone, a limit at its left shoulder for two hours (kind 'msnr-qm', see `qmSetups`). The Daily levels are V, A and OC levels
// (`snrSides`). "Strong" H4 BO: the plan shows it in a picture only, so any close beyond the last H4 A / V level counts. Stop 30 pips ($3.00), target 90 pips (3R), at most 2 entries a UTC day; a trade ends at its stop
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
    const pip = stopSize('xau'), stop = entry - d * pip, target = entry + d * SNR.rr * pip, oc = outcome(M5, fi, d, entry, stop, target, Infinity); if (fillT < from) continue;
    const turned = Z.dir !== d, tr = { id: oid, market, kind: qm ? 'msnr-qm' : 'msnr-sop', label: qm ? 'EG x SNR · gold plan, QM' : 'EG x SNR · gold plan', h: '4h', l: m.tf, side: d, t: fillT, entry, stop, target, r0: pip, status: oc.status, R: oc.R, endT: oc.endT, exit: oc.exit, mfe: oc.mfe, float: oc.float };
    tr.log = [{ t: S.t, text: `Side ${word(d)}: the Daily candle of ${new Date(S.day * 1000).toISOString().slice(0, 10)} rejected the Daily ${S.key.kind} level ${f(S.key.p)} (${S.key.kind === 'OC' ? 'where two Daily candles of one colour met' : 'a turn of the Daily closes'}), and an H4 candle closed ${d > 0 ? 'above' : 'below'} ${f(S.level)}, the last H4 ${d > 0 ? 'A' : 'V'} level (a turn of the H4 closes) that stood before price tapped the Daily level.` },
      qm ? { t: T, text: `${NAME[m.tf]} QM ${word(d)}: shoulder ${f(m.level)}, ${d > 0 ? 'high' : 'low'} ${f(m.mid)}, head ${f(m.head.close)} in the H4 ${turned ? 'EF' : 'EG'} zone ${f(Z.bot)} to ${f(Z.top)}, then a close ${d > 0 ? 'above' : 'below'} ${f(m.mid)}: a ${word(d)} limit at the shoulder, ${f(entry)}, for two hours.` }
        : { t: T, text: `Price is in the H4 ${turned ? 'zone that failed and turned' : word(d) + ' engulf zone'} ${f(Z.bot)} to ${f(Z.top)} and ` + (m.ef ? `a ${NAME[m.tf]} ${word(-d)} engulf zone failed (a close through it)` : `a ${NAME[m.tf]} engulf ${word(d)} closed`) + `: a ${word(d)} limit rests at its zone, ${f(entry)}, for two hours.` },
      { t: fillT, text: `Filled: ${word(d)} ${f(entry)}, stop ${f(stop)} (30 pips), target ${f(target)} (90 pips, ${SNR.rr}R).` },
      oc.status === 'target' ? { t: oc.endT, text: `Target reached: +${SNR.rr.toFixed(2)}R.` } : oc.status === 'stopped' ? { t: oc.endT, text: `Stopped: ${oc.R >= 0 ? '+' : '−'}${Math.abs(oc.R).toFixed(2)}R` + (oc.mfe >= 1 ? ` after running +${oc.mfe.toFixed(1)}R first.` : '.') }
        : oc.status === 'time' ? { t: oc.endT, text: `Time limit: closed at ${f(oc.exit)}, ${oc.R >= 0 ? '+' : '−'}${Math.abs(oc.R).toFixed(2)}R.` } : { t: null, text: 'Still open on the last candle read' + (oc.float != null ? ` (${oc.float >= 0 ? '+' : '−'}${Math.abs(oc.float).toFixed(2)}R now).` : '.') }];
    tr.marks = [{ kind: 'level', p: S.key.p, a: S.key.t, at: S.day + 86400, label: `Daily ${S.key.kind} level`, under: d > 0 }, { kind: 'level', p: S.level, a: S.levelT, at: S.t, label: `H4 ${d > 0 ? 'A' : 'V'} level · BO ${word(d)}`, under: d < 0 },
      { kind: 'zone', top: Z.top, bot: Z.bot, a: Z.base, at: turned ? Z.fail : Z.at, label: turned ? 'H4 EF (zone failed)' : 'H4 EG zone' }]
      .concat(qm ? [{ kind: 'level', p: m.mid, a: m.midT, at: m.at, label: `${NAME[m.tf]} QM · BO ${word(d)}`, under: d < 0 }, { kind: 'zone', top: m.top, bot: m.bot, a: m.base, at: m.at, label: NAME[m.tf] + ' QM zone · entry' }]
        : [{ kind: 'zone', top: m.top, bot: m.bot, a: m.base, at: m.at, label: NAME[m.tf] + (m.ef ? ' EF zone · entry' : ' EG zone · entry') }]);
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
