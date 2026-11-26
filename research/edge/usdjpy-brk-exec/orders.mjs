// usdjpy-brk-exec: the researcher's USD/JPY breakout-long near-lead as exact orders (mid candles, no tick read). node orders.mjs <cacheDir>
import fs from 'node:fs';
import { loadMarket, atr, sma, simulate, WIN } from '../auto-researcher/engine.mjs';
export const FROM = Date.UTC(2023, 11, 1) / 1000, TO = Date.UTC(2026, 10, 20) / 1000;
// the near-lead's exact genome: usdjpy, a close above the previous 10 H1 highs, long only, entry hours 07-12 UTC, Tuesday to Thursday,
// close above the 200-hour average, stop 3 x ATR(14), target 3R, out after 8 H1 candles
export const G = { mk: 'usdjpy', trig: [{ kind: 'brk', N: 10 }], side: 'long', hours: [7, 13], dows: [2, 3, 4], trend: 'with', vol: 'none', volP: 0.5, stop: 3, rr: 3, hold: 8 };
export function orders(D, from = FROM, to = TO) {
  const a = atr(D), ma = sma(D.c, 200), out = []; let free = 0;
  for (let i = 210; i < D.n - 1; i++) {
    if (i + 1 < free) continue;
    const A = a[i]; if (!(A > 0)) continue;
    let H = -Infinity; for (let k = i - G.trig[0].N; k < i; k++) if (D.h[k] > H) H = D.h[k];
    if (!(D.c[i] > H)) continue;                                  // a close above the previous 10 highs = a buy
    if (!(ma[i] === ma[i]) || !(D.c[i] > ma[i])) continue;        // with the 200-hour trend
    const h = D.hour[i + 1]; if (!(h >= G.hours[0] && h < G.hours[1])) continue;
    if (!G.dows.includes(D.dow[i + 1])) continue;
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
if (process.argv[1] && process.argv[1].endsWith('orders.mjs')) {
  const D = await loadMarket('usdjpy', process.argv[2]);
  const gate = orders(D, WIN.C[0], Infinity), eng = simulate(D, G, D.idx.C[0], D.idx.C[1]);
  console.log('gate 2020 on: orders', gate.length, 'mean', (gate.reduce((s, x) => s + x.midR, 0) / gate.length).toFixed(4), '| engine n', eng.n, 'mean', (eng.sum / eng.n).toFixed(4));
  const o = orders(D); const m = o.reduce((s, x) => s + x.midR, 0) / o.length, sd = Math.sqrt(o.reduce((s, x) => s + (x.midR - m) ** 2, 0) / (o.length - 1));
  console.log('window orders', o.length, 'mid mean R', m.toFixed(4), 'sd', sd.toFixed(3), 'time exits', o.filter((x) => x.timeExit).length, 'cost', D.cost, 'median D', o.map((x) => x.D).sort((a, b) => a - b)[o.length >> 1].toFixed(3));
  const hrs = {}; for (const x of o) { const h = new Date(x.ts * 1000).getUTCHours(); hrs[h] = (hrs[h] || 0) + 1; } console.log('entry hours', JSON.stringify(hrs));
}
