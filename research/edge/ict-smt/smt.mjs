// SMT divergence at the sweep of an ICT index A-setup (edge research, 14 Nov 2026; PREREGISTRATION.md).
// Pure: no I/O, no clock. It reads candles at or before the sweep candle only, on BOTH markets, so it cannot look ahead.
//
// The question for one signal: when its sweep candle took a confirmed H1 swing low (a buy; sells mirror), did the partner index
// trade below its own low of the same hours, or did it hold a higher low? Holding = SMT divergence.
//
// Fixed before any outcome was computed:
//   swings   ict-equal-lows' detector (eq.mjs sweptSwings, imported): 3 candles a side, last 96 H1 candles, confirmed before the
//            sweep candle, untouched until it; the swing judged is the MOST RECENT one the sweep candle took
//   partner  NQ -> ES, ES -> NQ, YM -> ES, RTY -> ES
//   ref      the partner's lowest low over the 7 candles centred on the swing's time (swing time +-3 h, the swing's own window);
//            at least 5 of those 7 partner candles must exist
//   held     every partner candle after that window, up to AND including the candle at the sweep time, stays at or above ref;
//            the partner must have a candle at the sweep time
import { EQ, sweptSwings } from '../ict-equal-lows/eq.mjs';

export const SMT = { piv: EQ.piv, look: EQ.look, win: 3, minWin: 5 };
export const PARTNER = { nq: 'es', es: 'nq', ym: 'es', rty: 'es' };

// side +1: compare lows; side -1: highs (mirrored, so "lower" means "beyond the level" in both cases)
const lowOf = (b, side) => (side > 0 ? b.low : -b.high);

// first index with time >= t (H sorted by time)
const firstAt = (H, t) => { let lo = 0, hi = H.length; while (lo < hi) { const m = (lo + hi) >> 1; if (H[m].time < t) lo = m + 1; else hi = m; } return lo; };

// The partner's reading. Hp = partner candles; swingT = the signal swing's time; sweepT = the sweep candle's time.
// Returns { judged, held, ref, why }. Only partner candles with time <= sweepT are read.
export function partnerHeld(Hp, swingT, sweepT, side, o = SMT) {
  const P = Hp.slice(0, firstAt(Hp, sweepT + 1));              // candles at or before the sweep candle, nothing later
  if (!P.length || P.at(-1).time !== sweepT) return { judged: false, held: false, ref: null, why: 'no partner candle at the sweep time' };
  const a = firstAt(P, swingT - o.win * 3600), b = firstAt(P, swingT + o.win * 3600 + 1), W = P.slice(a, b);
  if (W.length < o.minWin) return { judged: false, held: false, ref: null, why: 'partner candles missing around the swing' };
  const ref = Math.min(...W.map((x) => lowOf(x, side)));
  let held = true; for (let k = b; k < P.length; k++) if (lowOf(P[k], side) < ref) { held = false; break; }
  return { judged: true, held, ref: side * ref, why: held ? 'partner held' : 'partner took its own low too' };
}

// One signal: Hs = the signal market's candles, s = index of the sweep candle in Hs, Hp = the partner's candles.
// smt = the sweep took a confirmed swing AND the partner held. Not judged (no swing found, or partner candles missing) = no SMT.
export function smtAt(Hs, s, side, Hp, o = SMT) {
  if (!(s >= 0 && s < Hs.length)) return { smt: false, judged: false, why: 'no sweep candle' };
  const sw = sweptSwings(Hs, s, side, { ...EQ, piv: o.piv, look: o.look });
  if (!sw.length) return { smt: false, judged: false, why: 'no confirmed swing taken (detector)' };
  const last = sw.reduce((x, y) => (y.i > x.i ? y : x));
  const p = partnerHeld(Hp, last.time, Hs[s].time, side, o);
  return { smt: p.judged && p.held, judged: p.judged, why: p.why, swingT: last.time, level: last.level, partnerRef: p.ref, swings: sw.length };
}

// A signal of signals(): g.sweepT = open time of the sweep candle.
export function tagSignal(g, Hs, Hp, index, o = SMT) {
  const s = index ? index.get(g.sweepT) : Hs.findIndex((b) => b.time === g.sweepT);
  if (s == null || s < 0) return { smt: false, judged: false, why: 'sweep candle not found' };
  return smtAt(Hs, s, g.side, Hp, o);
}
