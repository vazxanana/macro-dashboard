// Relative equal lows / highs as the liquidity an ICT signal swept (edge research, 11 Nov 2026; PREREGISTRATION.md).
// Pure: no import, no I/O, no clock. It reads candles at or before the sweep candle only, so it cannot look ahead.
//
// The desk's signal (ict/tracker.mjs signals()) starts when an H1 candle trades through a confirmed H1 swing. This file answers one
// question about that candle: did it take a POOL of relative equal lows (two or more separate, still untouched swing lows at about
// the same price: the skill's "engineered liquidity"), or one swing low only? Sells are the mirror (equal highs).
//
// Fixed before any outcome was computed:
//   piv  3   a swing low has 3 candles each side with no lower low (the tracker's P.piv)
//   look 96  only swings of the last 96 H1 candles before the sweep candle (the tracker's P.look)
//   tol  0.1 two lows are "equal" when they are within 0.1 x the daily ATR(14) of each other (as research/edge/ict-concepts eqts)
//   sep  4   the two swings are at least 4 candles apart (two separate swings, not one flat low)
export const EQ = { piv: 3, look: 96, tol: 0.1, sep: 4 };

const mirror = (b) => ({ time: b.time, open: -b.open, high: -b.low, low: -b.high, close: -b.close });

// Confirmed, still untouched swing lows that candle `s` trades through (side +1: lows; side -1: highs, in mirrored prices).
// A swing at j counts only when its right-hand candles are all in before the sweep candle (j + piv <= s - 1), it is at most `look`
// candles old, and no candle between it and `s` traded below it.
export function sweptSwings(Hraw, s, side = 1, o = EQ) {
  if (!(s >= 0 && s < Hraw.length)) return [];
  const from = Math.max(0, s - o.look - o.piv), H = (side > 0 ? Hraw.slice(from, s + 1) : Hraw.slice(from, s + 1).map(mirror)), e = H.length - 1, out = [];
  for (let j = Math.max(o.piv, e - o.look); j + o.piv <= e - 1; j++) {
    const lo = H[j].low; if (!(H[e].low < lo)) continue;
    let ok = true;
    for (let k = j - o.piv; k <= j + o.piv && ok; k++) if (H[k].low < lo) ok = false;          // a swing low
    for (let k = j + o.piv + 1; k < e && ok; k++) if (H[k].low < lo) ok = false;                // untouched until the sweep candle
    if (ok) out.push({ i: from + j, time: Hraw[from + j].time, level: side * lo });
  }
  return out;
}

// The pool test. `atrD` = the daily ATR(14) known at the signal (null → not judged, eq false).
// Returns { eq, swings, pool, width }: eq = at least two swept swings, >= sep candles apart, within tol x atrD of each other;
// pool = the largest number of swept swings (each >= sep candles from the next) whose levels fit inside one tol x atrD band.
export function equalPool(Hraw, s, side, atrD, o = EQ) {
  const sw = sweptSwings(Hraw, s, side, o);
  if (!(atrD > 0) || sw.length < 2) return { eq: false, swings: sw.length, pool: Math.min(sw.length, 1), width: null };
  const band = o.tol * atrD, by = [...sw].sort((a, b) => a.level - b.level);
  let best = 1, width = null;
  for (let a = 0; a < by.length; a++) {
    const grp = by.filter((x) => x.level >= by[a].level && x.level - by[a].level <= band).sort((x, y) => x.i - y.i);
    const kept = []; for (const x of grp) if (!kept.length || x.i - kept.at(-1).i >= o.sep) kept.push(x);
    if (kept.length > best) { best = kept.length; const lv = kept.map((x) => x.level); width = Math.max(...lv) - Math.min(...lv); }
  }
  return { eq: best >= 2, swings: sw.length, pool: best, width: width == null ? null : +(width / atrD).toFixed(4) };
}

// The daily ATR(14) the tracker itself uses for a signal (feat.atrR): the 14 daily candles closed before the signal candle's close.
export function dailyAtr(D, closeT) {
  let di = -1; for (let i = D.length - 1; i >= 0; i--) if (D[i].time + 86400 <= closeT) { di = i; break; }
  if (di < 14) return null;
  let s = 0; for (let i = di - 13; i <= di; i++) s += D[i].high - D[i].low;
  return s / 14;
}

// One signal of signals(): g.sweepT is the open time of the sweep candle, g.close the close time of the signal candle.
export function tagSignal(g, Hraw, D, index, o = EQ) {
  const s = index ? index.get(g.sweepT) : Hraw.findIndex((b) => b.time === g.sweepT);
  if (s == null || s < 0) return { eq: false, swings: 0, pool: 0, width: null };
  return equalPool(Hraw, s, g.side, dailyAtr(D, g.close), o);
}
