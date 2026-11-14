// NWOG / NDOG as the key level an ICT signal's sweep runs into (edge research, 14 Nov 2026; PREREGISTRATION.md).
// Pure apart from ict/calendar.mjs (CME hours, no network, no clock). It reads candles BEFORE the sweep candle to find and age the
// gaps, and the sweep candle itself only for the "ran into it" test, so it cannot look ahead.
//
// Fixed before any outcome was computed:
//   NWOG  the range between the close of the last H1 candle before a CME break that contains a Saturday (the weekend, or a weekend
//         joined to a holiday) and the open of the first H1 candle after it (the 18:00 New York reopen).
//   NDOG  the same for every other CME break: the daily 17:00 New York close (13:00 on an early-close day, the eve's 17:00 before a
//         weekday full holiday) to the next 18:00 reopen.
//   A break is found on the CME calendar (cmeShut) and the H1 candles the lab keeps: the reopen candle is a candle that is not shut,
//   whose previous hour was shut or in the 17:00 halt; the close candle is the last earlier candle that is not shut. CFD candles
//   printed while CME is shut are ignored (the gap is measured on the CME session).
//   width 0 (open = close) is no gap.
//   filled  a gap is fully filled once a candle from its reopen candle up to (not including) the sweep candle traded back to the
//           prior close (up gap: low <= close; down gap: high >= close).
//   recent  the 5 most recent NWOGs and the 5 most recent NDOGs whose reopen candle is BEFORE the sweep candle; of those, the ones
//           still not fully filled are live.
//   ran into  buy: the sweep candle's low <= the gap's top AND the top of its body >= the gap's bottom (its down-wick reached into or
//           through the gap from above); sell mirrors (high >= bottom AND body bottom <= top).
import { cmeShut, nyParts } from '../../../ict/calendar.mjs';

export const GAP = { last: 5 };

const shutOrHalt = (t) => cmeShut(t) || nyParts(t).min >= 17 * 60 && nyParts(t).min < 18 * 60;
const hasSaturday = (a, b) => { for (let t = a; t <= b; t += 3600) if (nyParts(t).wd === 'Sat') return true; return false; };

// every opening gap in H (candles sorted by time, the lab's cleaned H1): [{ kind, i (reopen index), j (close index), t, close, open, lo, hi }]
export function findGaps(H) {
  const out = [];
  for (let i = 1; i < H.length; i++) {
    const t = H[i].time;
    if (cmeShut(t) || !shutOrHalt(t - 3600)) continue;
    let j = i - 1; while (j >= 0 && cmeShut(H[j].time)) j--;
    if (j < 0) continue;
    const close = H[j].close, open = H[i].open;
    if (!(close !== open)) continue;
    out.push({ kind: hasSaturday(H[j].time + 3600, t - 3600) ? 'nwog' : 'ndog', i, j, t, close, open, lo: Math.min(close, open), hi: Math.max(close, open) });
  }
  return out;
}

// fully filled before candle s? (candles i .. s-1)
export function filledBefore(H, g, s) {
  const up = g.open > g.close;
  for (let k = g.i; k < s; k++) if (up ? H[k].low <= g.close : H[k].high >= g.close) return true;
  return false;
}

// the live gaps at sweep candle s: the last `last` of each kind with reopen before s, not fully filled
export function liveGaps(H, gaps, s, o = GAP) {
  const out = [];
  for (const kind of ['nwog', 'ndog']) {
    const before = gaps.filter((g) => g.kind === kind && g.i < s).slice(-o.last);
    for (const g of before) if (!filledBefore(H, g, s)) out.push(g);
  }
  return out;
}

// did sweep candle s (side +1 buy / -1 sell) run into a live gap? { gap: bool, kinds: [...], n }
export function ranInto(H, gaps, s, side, o = GAP) {
  const b = H[s], live = liveGaps(H, gaps, s, o);
  const hit = live.filter((g) => side > 0 ? b.low <= g.hi && Math.max(b.open, b.close) >= g.lo : b.high >= g.lo && Math.min(b.open, b.close) <= g.hi);
  return { gap: hit.length > 0, kinds: [...new Set(hit.map((g) => g.kind))], n: hit.length, live: live.length };
}

// one signal of signals(): g.sweepT = open time of the sweep candle
export function tagSignal(g, H, gaps, index, o = GAP) {
  const s = index ? index.get(g.sweepT) : H.findIndex((b) => b.time === g.sweepT);
  if (s == null || s < 0) return { gap: false, kinds: [], n: 0, live: 0 };
  return ranInto(H, gaps, s, g.side, o);
}
