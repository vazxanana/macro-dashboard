// eurjpy-egr-exec: the researcher's EUR/JPY engulf-retest sell lead as exact orders on mid candles, no tick read. node orders.mjs <cacheDir>
import { loadMarket, atr, atrPct, sig, simulate } from '../auto-researcher/engine.mjs';
import { nights } from '../../../council/fills.mjs';
export const FROM = Date.UTC(2023, 11, 1) / 1000, TO = Date.UTC(2026, 10, 20) / 1000;
// the lead's exact genome (auto-3, eurjpy|egr48|short|none|0.75|1.5): the first return to a standing engulf zone up to 48 H1
// candles old that closes back out on the zone's side, sells only, entry hours 10-15 UTC, ATR in the top 70 % of its last 500
// readings, stop 0.75 x ATR(14), target 1.5R, out after 24 H1 candles, one at a time
export const G = { mk: 'eurjpy', trig: [{ kind: 'egr', life: 48 }], side: 'short', hours: [10, 16], dows: null, trend: 'none', vol: 'high', volP: 0.7, stop: 0.75, rr: 1.5, hold: 24 };
// the second lead (the same idea, 12-candle zones, 07-18 UTC, out after 96 candles): reported beside, no verdict
export const G2 = { mk: 'eurjpy', trig: [{ kind: 'egr', life: 12 }], side: 'short', hours: [7, 19], dows: null, trend: 'none', vol: 'high', volP: 0.7, stop: 0.75, rr: 1.5, hold: 96 };
// the demo's EUR/JPY swap on a short, 27 Nov 2026 (ctrader/symbols.json): -1.007 pips (0.01 yen) a unit a rollover, Wednesday three
export const SWAP_SHORT = 1.007 * 0.01;
const pass = (D, g, i) => { const h = D.hour[i + 1], [a, b] = g.hours; if (!(h >= a && h < b)) return false;
  const p = atrPct(D)[i]; return p === p && p >= 1 - g.volP; };
export function orders(D, g = G, from = FROM, to = TO) {
  const a = atr(D), out = []; let free = 0;
  for (let i = 210; i < D.n - 1; i++) {
    if (i + 1 < free) continue;
    const A = a[i]; if (!(A > 0)) continue;
    if (sig(D, g.trig[0], i) !== -1) continue;                     // a sell retest (the rule is short only)
    if (!pass(D, g, i)) continue;
    const t = D.t[i + 1], s = -1, entry = D.o[i + 1], dist = g.stop * A; if (!(dist > 0) || D.cost / dist > 0.5) continue;
    const stop = entry - s * dist, tgt = entry + s * g.rr * dist;
    let ex = null, j = i + 1;
    for (; j <= i + g.hold && j < D.n; j++) { const o = j === i + 1 ? entry : D.o[j];
      if (o >= stop) { ex = o; break; } if (D.h[j] >= stop) { ex = stop; break; } if (D.l[j] <= tgt) { ex = tgt; break; } }
    const timeExit = ex == null; if (timeExit) { j = Math.min(i + g.hold, D.n - 1); ex = D.c[j]; }
    free = j + 1;
    if (t < from || t >= to) continue;
    out.push({ ts: t, side: s, fillM: entry, D: dist, stop, tgt, deadEnd: D.t[Math.min(i + g.hold, D.n - 1)] + 3600, midR: +(((ex - entry) * s - D.cost) / dist).toFixed(4), timeExit });
  }
  return out;
}
export const finR = (o, at) => (nights(o.ts, at) * SWAP_SHORT) / o.D;   // a short pays the demo's swap each night held
if (process.argv[1] && process.argv[1].endsWith('orders.mjs')) {
  const D = await loadMarket('eurjpy', process.argv[2]);
  for (const [k, g] of [['lead 1', G], ['lead 2', G2]]) {
    const all = orders(D, g, Date.UTC(2024, 0, 1) / 1000, Infinity), e = simulate(D, g, D.idx2.C[0], D.n);
    console.log(k, 'gate 2024 on: orders', all.length, 'mean', (all.reduce((s, x) => s + x.midR, 0) / all.length).toFixed(4), '| engine n', e.n, 'mean', (e.sum / e.n).toFixed(4));
    const o = orders(D, g); const m = o.reduce((s, x) => s + x.midR, 0) / o.length, sd = Math.sqrt(o.reduce((s, x) => s + (x.midR - m) ** 2, 0) / (o.length - 1));
    console.log(k, 'window orders', o.length, 'mid mean R', m.toFixed(4), 'sd', sd.toFixed(3), 'time exits', o.filter((x) => x.timeExit).length, 'targets', o.filter((x) => x.midR > 1).length, 'cost', D.cost, 'median D', o.map((x) => x.D).sort((p, q) => p - q)[o.length >> 1].toFixed(4));
  }
}
