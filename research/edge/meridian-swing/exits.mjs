// Edge research · meridian-swing: the exit variants, all run on the same fill and managed candle by candle (M5 in replay.mjs).
// Inside a candle the stop is checked before the target, and a +1R move only arms the variant after both (as backtest.mjs manage).
//   none     stop / target 1 (the live default)
//   be1      stop to entry once +1R
//   part     half off at +1R, stop to entry, the rest to target 1
//   tp2      hold to target 2 (the Origin height past target 1)
//   trail    from +1R the stop trails the last confirmed H1 swing less buf x H1 ATR; no fixed target (10R cap, out after 10 days)
//   trailT1  the same trail, target 1 kept
export const VAR = ['none', 'be1', 'part', 'tp2', 'trail', 'trailT1'];
export const newVariants = (tr) => VAR.map((n) => ({ n, stop: tr.stop, armed: false, bank: 0, left: 1, done: false, R: null }));
const atr = (B, n = 14) => { let s = 0, k = 0; for (let i = Math.max(1, B.length - n); i < B.length; i++) { const b = B[i], pc = B[i - 1].close; s += Math.max(b.high - b.low, Math.abs(b.high - pc), Math.abs(b.low - pc)); k++; } return k ? s / k : 0; };
// pivotAt(sell, t): the last H1 swing low (buy) / high (sell) confirmed by 2 closed candles each side at time t, with the H1 ATR(14)
export function h1Pivots(H1) {
  return (sell, t) => {
    let p = H1.length - 1; while (p >= 0 && H1[p].time + 3600 > t) p--;
    for (let j = p - 2; j >= Math.max(2, p - 120); j--) {
      const x = H1[j]; let ok = true;
      for (let k = 1; k <= 2 && ok; k++) ok = sell ? H1[j - k].high <= x.high && H1[j + k].high < x.high : H1[j - k].low >= x.low && H1[j + k].low > x.low;
      if (ok) return { p: sell ? x.high : x.low, atr: atr(H1.slice(Math.max(0, p - 15), p + 1)) };
    }
    return null;
  };
}
// b: one candle {time, high, low, close} of `sec` seconds; tr: { side, entry, stop, t1, t2, r0, filled, v: newVariants(tr) }
export function manage(tr, b, pivotAt, buf = 0.15, sec = 300) {
  const s = tr.side === 'sell', sg = s ? -1 : 1, r0 = tr.r0, fav = (s ? tr.entry - b.low : b.high - tr.entry) / r0;
  for (const v of tr.v) {
    if (v.done) continue;
    if (s ? b.high >= v.stop : b.low <= v.stop) { v.R = v.bank + v.left * (v.stop - tr.entry) * sg / r0; v.done = true; v.closed = b.time; continue; }
    const tgt = v.n === 'tp2' ? tr.t2 : v.n === 'trail' ? tr.entry + sg * 10 * r0 : tr.t1;
    if (s ? b.low <= tgt : b.high >= tgt) {
      const tR = (tgt - tr.entry) * sg / r0;
      if (v.n === 'part' && !v.armed && tR >= 1) { v.bank = 0.5; v.left = 0.5; }   // the target candle passed +1R on its way: the half was taken there
      v.R = v.bank + v.left * tR; v.done = true; v.closed = b.time; continue;
    }
    if (v.n === 'trail' && b.time - tr.filled >= 10 * 86400) { v.R = v.bank + v.left * (b.close - tr.entry) * sg / r0; v.done = true; v.closed = b.time; continue; }
    if (fav >= 1 && !v.armed) {
      v.armed = true;
      if (v.n === 'be1' || v.n === 'part') v.stop = tr.entry;
      if (v.n === 'part') { v.bank = 0.5; v.left = 0.5; }
    }
    if (v.armed && (v.n === 'trail' || v.n === 'trailT1') && (b.time + sec) % 3600 === 0 && pivotAt) {   // at each H1 close
      const pv = pivotAt(s, b.time + sec);
      if (pv) { const ns = pv.p - sg * buf * pv.atr; if ((ns - v.stop) * sg > 0 && (b.close - ns) * sg > 0) v.stop = ns; }
    }
  }
}
