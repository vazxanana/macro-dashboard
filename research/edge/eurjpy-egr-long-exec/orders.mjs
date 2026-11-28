// eurjpy-egr-long-exec: the researcher's EUR/JPY engulf-retest BUY lead as exact orders on mid candles, no tick read. node orders.mjs <cacheDir>
import { loadMarket, atr, atrPct, sig, simulate, sma } from '../auto-researcher/engine.mjs';
import { nights } from '../../../council/fills.mjs';
export const FROM = Date.UTC(2023, 11, 1) / 1000, TO = Date.UTC(2026, 10, 20) / 1000;
// the lead's exact genome (auto-3, eurjpy|egr12|long|against|2|0.5): the first return to a standing H1 engulf zone up to 12 candles
// old that closes back out on the zone's side, buys only, with the close BELOW its 200-candle average (against the trend), any hour,
// ATR in the top 70 % of its last 500 readings, stop 2 x ATR(14), target 0.5R, out after 240 H1 candles, one at a time
export const G = { mk: 'eurjpy', trig: [{ kind: 'egr', life: 12 }], side: 'long', hours: null, dows: null, trend: 'against', vol: 'high', volP: 0.7, stop: 2, rr: 0.5, hold: 240 };
// the demo's EUR/JPY swap on a long, 28 Nov 2026 (ctrader/symbols.json swap.long +0.298 pips): a CREDIT of 0.00298 yen a unit a rollover
export const SWAP_LONG = 0.298 * 0.01;
export function orders(D, g = G, from = FROM, to = TO) {
  const a = atr(D), ma = sma(D.c, 200), out = []; let free = 0;
  for (let i = 210; i < D.n - 1; i++) {
    if (i + 1 < free) continue;
    const A = a[i]; if (!(A > 0)) continue;
    if (sig(D, g.trig[0], i) !== 1) continue;                       // a buy retest (the rule is long only)
    const m = ma[i]; if (!(m === m) || D.c[i] > m) continue;        // against: the close at or below the 200-candle average
    const p = atrPct(D)[i]; if (!(p === p) || p < 1 - g.volP) continue;
    const t = D.t[i + 1], s = 1, entry = D.o[i + 1], dist = g.stop * A; if (!(dist > 0) || D.cost / dist > 0.5) continue;
    const stop = entry - dist, tgt = entry + g.rr * dist;
    let ex = null, j = i + 1;
    for (; j <= i + g.hold && j < D.n; j++) { const o = j === i + 1 ? entry : D.o[j];
      if (o <= stop) { ex = o; break; } if (D.l[j] <= stop) { ex = stop; break; } if (D.h[j] >= tgt) { ex = tgt; break; } }
    const timeExit = ex == null; if (timeExit) { j = Math.min(i + g.hold, D.n - 1); ex = D.c[j]; }
    free = j + 1;
    if (t < from || t >= to) continue;
    out.push({ ts: t, side: s, fillM: entry, D: dist, stop, tgt, deadEnd: D.t[Math.min(i + g.hold, D.n - 1)] + 3600, midR: +(((ex - entry) * s - D.cost) / dist).toFixed(4), timeExit, exitBar: D.t[j] });
  }
  return out;
}
export const finR = (o, at, rate = SWAP_LONG) => -(nights(o.ts, at) * rate) / o.D;   // a long is CREDITED the demo's swap each night (finR < 0 = a gain)
if (process.argv[1] && process.argv[1].endsWith('orders.mjs')) {
  const D = await loadMarket('eurjpy', process.argv[2]);
  const all = orders(D, G, Date.UTC(2024, 0, 1) / 1000, Infinity), e = simulate(D, G, D.idx2.C[0], D.n);
  console.log('gate 2024 on: orders', all.length, 'mean', (all.reduce((s, x) => s + x.midR, 0) / all.length).toFixed(4), '| engine n', e.n, 'mean', (e.sum / e.n).toFixed(4));
  const o = orders(D, G); const mm = o.reduce((s, x) => s + x.midR, 0) / o.length, sd = Math.sqrt(o.reduce((s, x) => s + (x.midR - mm) ** 2, 0) / (o.length - 1));
  const hold = o.map((x) => (x.exitBar - x.ts) / 3600).sort((p, q) => p - q);
  console.log('window orders', o.length, 'mid mean R', mm.toFixed(4), 'sd', sd.toFixed(3), 'time exits', o.filter((x) => x.timeExit).length, 'targets', o.filter((x) => x.midR > 0.3).length, 'stops', o.filter((x) => x.midR < -0.5).length, 'median D', o.map((x) => x.D).sort((p, q) => p - q)[o.length >> 1].toFixed(4), 'median hold h', hold[hold.length >> 1], 'p90 hold', hold[Math.floor(hold.length * 0.9)]);
}
