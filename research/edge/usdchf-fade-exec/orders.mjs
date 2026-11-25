// usdchf-fade-exec: the researcher's USD/CHF fade lead as exact orders (mid candles, no tick read). node orders.mjs <cacheDir>
import fs from 'node:fs';
import { loadMarket, atr, simulate, WIN } from '../auto-researcher/engine.mjs';
export const FROM = Date.UTC(2023, 11, 1) / 1000, TO = Date.UTC(2026, 10, 20) / 1000;
// the lead's exact genome (worker 4, look at 25 Nov 2026 06:49 UTC): usdchf, fade N 5, short only, entry hours 20-22 UTC, stop 0.75 x ATR(14), target 1R, out after 12 H1 candles
export const G = { mk: 'usdchf', trig: [{ kind: 'fade', N: 5 }], side: 'short', hours: [20, 23], dows: null, trend: 'none', vol: 'none', volP: 0.7, stop: 0.75, rr: 1, hold: 12 };
export function orders(D, from = FROM, to = TO) {
  const a = atr(D), out = []; let free = 0;
  for (let i = 210; i < D.n - 1; i++) {
    if (i + 1 < free) continue;
    const t = D.t[i + 1]; if (t < from || t >= to) continue;
    const h = D.hour[i + 1]; if (!(h >= G.hours[0] && h < G.hours[1])) continue;
    let H = -Infinity; for (let k = i - G.trig[0].N; k < i; k++) if (D.h[k] > H) H = D.h[k];
    if (!(D.c[i] > H)) continue;                                  // fade of a close above the previous 5 highs = a sell
    const s = -1, A = a[i]; if (!(A > 0)) continue;
    const entry = D.o[i + 1], dist = G.stop * A; if (!(dist > 0) || D.cost / dist > 0.5) continue;
    const stop = entry - s * dist, tgt = entry + s * G.rr * dist;
    let ex = null, j = i + 1;
    for (; j <= i + G.hold && j < D.n; j++) { const o = j === i + 1 ? entry : D.o[j];
      if (o >= stop) { ex = o; break; } if (D.h[j] >= stop) { ex = stop; break; } if (D.l[j] <= tgt) { ex = tgt; break; } }
    const timeExit = ex == null; if (timeExit) { j = Math.min(i + G.hold, D.n - 1); ex = D.c[j]; }
    free = j + 1;
    out.push({ ts: t, side: s, fillM: entry, D: dist, stop, tgt, deadEnd: D.t[i + G.hold] + 3600, midR: +(((ex - entry) * s - D.cost) / dist).toFixed(4), timeExit });
  }
  return out;
}
if (process.argv[1] && process.argv[1].endsWith('orders.mjs')) {
  const D = await loadMarket('usdchf', process.argv[2]);
  const gate = orders(D, WIN.C[0], Infinity), eng = simulate(D, G, D.idx.C[0], D.idx.C[1]);
  console.log('gate 2020 on: orders', gate.length, 'mean', (gate.reduce((s, x) => s + x.midR, 0) / gate.length).toFixed(4), '| engine n', eng.n, 'mean', (eng.sum / eng.n).toFixed(4));
  const o = orders(D); const m = o.reduce((s, x) => s + x.midR, 0) / o.length;
  console.log('window orders', o.length, 'mid mean R', m.toFixed(4), 'time exits', o.filter((x) => x.timeExit).length, 'cost', D.cost);
  fs.writeFileSync(new URL('./orders-USDCHF.json', import.meta.url), JSON.stringify(o));
}
