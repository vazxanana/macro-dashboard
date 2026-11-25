// usdchf-blk-exec: the researcher's USD/CHF lead as exact orders (mid candles, no tick read). node orders.mjs <cacheDir>
import fs from 'node:fs';
import { loadMarket, atr } from '../auto-researcher/engine.mjs';
export const FROM = Date.UTC(2023, 11, 1) / 1000, TO = Date.UTC(2026, 10, 20) / 1000;
export const RULE = { at: 19, H: 3, stop: 1, rr: 0.5, hold: 4 };   // the lead: blk H3 at 19 UTC, faded
export function orders(D) {
  const a = atr(D), out = []; let free = 0;
  for (let i = 210; i < D.n - 1; i++) {
    if (i + 1 < free || D.hour[i] !== RULE.at) continue;
    const t = D.t[i + 1]; if (t < FROM || t >= TO) continue;
    let H = -Infinity, L = Infinity, ok = true; for (let k = i - RULE.H; k < i; k++) { if (D.h[k] > H) H = D.h[k]; if (D.l[k] < L) L = D.l[k]; }
    const up = D.c[i] > H ? 1 : D.c[i] < L ? -1 : 0; if (!up) continue;
    const s = -up, A = a[i]; if (!(A > 0)) continue;
    const entry = D.o[i + 1], dist = RULE.stop * A; if (!(dist > 0) || D.cost / dist > 0.5) continue;
    const stop = entry - s * dist, tgt = entry + s * RULE.rr * dist;
    let ex = null, j = i + 1;
    for (; j <= i + RULE.hold && j < D.n; j++) { const o = j === i + 1 ? entry : D.o[j];
      if (s > 0 ? o <= stop : o >= stop) { ex = o; break; } if (s > 0 ? D.l[j] <= stop : D.h[j] >= stop) { ex = stop; break; } if (s > 0 ? D.h[j] >= tgt : D.l[j] <= tgt) { ex = tgt; break; } }
    const timeExit = ex == null; if (timeExit) { j = Math.min(i + RULE.hold, D.n - 1); ex = D.c[j]; }
    free = j + 1;
    out.push({ ts: t, side: s, fillM: entry, D: dist, stop, tgt, deadEnd: D.t[i + RULE.hold] + 3600, midR: +(((ex - entry) * s - D.cost) / dist).toFixed(4), timeExit });
  }
  return out;
}
if (process.argv[1] && process.argv[1].endsWith('orders.mjs')) {
  const D = await loadMarket('usdchf', process.argv[2]); const o = orders(D);
  const m = o.reduce((s, x) => s + x.midR, 0) / o.length;
  console.log('orders', o.length, 'mid mean R', m.toFixed(4), 'time exits', o.filter((x) => x.timeExit).length, 'cost', D.cost);
  fs.writeFileSync(new URL('./orders-USDCHF.json', import.meta.url), JSON.stringify(o));
}
