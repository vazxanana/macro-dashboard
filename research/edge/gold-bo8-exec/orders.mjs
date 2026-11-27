// gold-bo8-exec: the researcher's gold result (xau|bo8any|long|none|0.75|6) as exact orders on mid candles, no tick read. node orders.mjs <cacheDir>
import { loadMarket, atr, sig, simulate } from '../auto-researcher/engine.mjs';
import { nights, FIN } from '../../../council/fills.mjs';
export const FROM = Date.UTC(2023, 11, 1) / 1000, TO = Date.UTC(2026, 10, 20) / 1000;
// the exact genome: gold, a close beyond the last unbroken 8-a-side H1 swing (any break), long only, no hour / weekday / trend /
// volatility filter, stop 0.75 x ATR(14), target 6R, out after 24 H1 candles, one at a time
export const G = { mk: 'xau', trig: [{ kind: 'bo', P: 8, bo: 'any' }], side: 'long', hours: null, dows: null, trend: 'none', vol: 'none', volP: 0.7, stop: 0.75, rr: 6, hold: 24 };
export function orders(D, from = FROM, to = TO) {
  const a = atr(D), out = []; let free = 0;
  for (let i = 210; i < D.n - 1; i++) {
    if (i + 1 < free) continue;
    const A = a[i]; if (!(A > 0)) continue;
    if (sig(D, G.trig[0], i) !== 1) continue;                       // a buy break (the rule is long only)
    const t = D.t[i + 1], s = 1, entry = D.o[i + 1], dist = G.stop * A; if (!(dist > 0) || D.cost / dist > 0.5) continue;
    const stop = entry - s * dist, tgt = entry + s * G.rr * dist;
    let ex = null, j = i + 1;
    for (; j <= i + G.hold && j < D.n; j++) { const o = j === i + 1 ? entry : D.o[j];
      if (o <= stop) { ex = o; break; } if (D.l[j] <= stop) { ex = stop; break; } if (D.h[j] >= tgt) { ex = tgt; break; } }
    const timeExit = ex == null; if (timeExit) { j = Math.min(i + G.hold, D.n - 1); ex = D.c[j]; }
    free = j + 1;
    if (t < from || t >= to) continue;
    out.push({ ts: t, side: s, fillM: entry, D: dist, stop, tgt, deadEnd: D.t[Math.min(i + G.hold, D.n - 1)] + 3600, midR: +(((ex - entry) * s - D.cost) / dist).toFixed(4), timeExit });
  }
  return out;
}
export const finR = (o, at) => (nights(o.ts, at) * FIN.xau.long * o.fillM) / o.D;   // a gold buy pays the demo's rollover each night held
if (process.argv[1] && process.argv[1].endsWith('orders.mjs')) {
  const D = await loadMarket('xau', process.argv[2]);
  const g = orders(D, Date.UTC(2023, 0, 1) / 1000, Infinity), e = simulate(D, G, D.idx2.C[0], D.n);
  console.log('gate 2023 on: orders', g.length, 'mean', (g.reduce((s, x) => s + x.midR, 0) / g.length).toFixed(4), '| engine n', e.n, 'mean', (e.sum / e.n).toFixed(4));
  const o = orders(D); const m = o.reduce((s, x) => s + x.midR, 0) / o.length, sd = Math.sqrt(o.reduce((s, x) => s + (x.midR - m) ** 2, 0) / (o.length - 1));
  console.log('window orders', o.length, 'mid mean R', m.toFixed(4), 'sd', sd.toFixed(3), 'time exits', o.filter((x) => x.timeExit).length, 'targets', o.filter((x) => x.midR > 5).length, 'cost', D.cost, 'median D', o.map((x) => x.D).sort((p, q) => p - q)[o.length >> 1].toFixed(3));
}
