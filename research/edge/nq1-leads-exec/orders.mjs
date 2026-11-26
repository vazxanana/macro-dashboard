// nq1-leads-exec: the auto-researcher's NAS100 leads as exact orders (mid candles, no tick read). node orders.mjs
import { loadMarket, atr, sma, sig, atrPct, simulate } from '../auto-researcher/engine.mjs';
import { NQ1_LEADS } from '../../../council/edge-desks-2.mjs';
export const FROM = Date.UTC(2023, 11, 1) / 1000, TO = Date.UTC(2026, 10, 20) / 1000;
// the five leads of the NQ1 desk (frozen genomes) and l3, the rule of nas100-brk-long-focus
export const LEADS = [...NQ1_LEADS.map((L) => ({ id: L.id, name: L.name, g: { mk: 'nas100', ...L.g } })),
  { id: 'l3', name: '20-hour breakout with the trend, long', g: { mk: 'nas100', trig: [{ kind: 'brk', N: 20 }], side: 'long', hours: [14, 22], dows: null, trend: 'with', vol: 'none', volP: 0.3, stop: 1, rr: 4, hold: 96 } }]
  .sort((a, b) => a.id.localeCompare(b.id));
const passes = (D, g, i) => {
  if (g.hours) { const h = D.hour[i + 1], [a, b] = g.hours; if (a <= b ? !(h >= a && h < b) : !(h >= a || h < b)) return false; }
  if (g.dows && !g.dows.includes(D.dow[i + 1])) return false;
  if (g.vol !== 'none') { const p = atrPct(D)[i]; if (!(p === p)) return false; if (g.vol === 'low' ? !(p <= g.volP) : !(p >= 1 - g.volP)) return false; }
  return true; };
// the engine's simulate(), order by order, on [lo, hi) (bar indexes), cost 0 as the search ran
export function orders(D, g, lo, hi) {
  const a = atr(D), ma = g.trend === 'none' ? null : sma(D.c, 200), out = []; let free = lo;
  for (let i = Math.max(lo - 1, 210); i < hi - 1; i++) {
    if (i + 1 < free) continue;
    const A = a[i]; if (!(A > 0)) continue;
    let s = 0; for (const tr of g.trig) { const q = sig(D, tr, i); if (q === 0 || (s !== 0 && q !== s)) { s = 0; break; } s = q; } if (s === 0) continue;
    if (g.side === 'long' && s < 0 || g.side === 'short' && s > 0) continue;
    if (ma) { const m = ma[i]; if (!(m === m)) continue; const up = D.c[i] > m ? 1 : -1; if (g.trend === 'with' ? up !== s : up === s) continue; }
    if (!passes(D, g, i)) continue;
    const entry = D.o[i + 1], dist = g.stop * A; if (!(dist > 0)) continue;
    const stop = entry - s * dist, tgt = entry + s * g.rr * dist;
    let ex = null, j = i + 1;
    for (; j <= i + g.hold && j < D.n; j++) { const o = j === i + 1 ? entry : D.o[j];
      if (s > 0 ? o <= stop : o >= stop) { ex = o; break; }
      if (s > 0 ? D.l[j] <= stop : D.h[j] >= stop) { ex = stop; break; }
      if (s > 0 ? D.h[j] >= tgt : D.l[j] <= tgt) { ex = tgt; break; } }
    const timeExit = ex == null; if (timeExit) { j = Math.min(i + g.hold, D.n - 1); ex = D.c[j]; }
    free = j + 1;
    out.push({ ts: D.t[i + 1], side: s, fillM: entry, D: dist, rr: g.rr, deadEnd: D.t[Math.min(i + g.hold, D.n - 1)] + 3600, cut: i + g.hold > D.n - 1, midR: +(((ex - entry) * s) / dist).toFixed(4), timeExit });
  }
  return out;
}
export const idxOf = (D, t) => { let lo = 0, hi = D.n; while (lo < hi) { const m = (lo + hi) >> 1; if (D.t[m] < t) lo = m + 1; else hi = m; } return lo; };
export async function build() {
  const D = await loadMarket('nas100'); D.cost = 0; D.costRel = 0;
  const lo = idxOf(D, FROM), hi = idxOf(D, TO), all = [], gate = {};
  for (const L of LEADS) { const o = orders(D, L.g, lo, hi), e = simulate(D, L.g, lo, hi);
    gate[L.id] = { orders: o.length, mean: +(o.reduce((s, x) => s + x.midR, 0) / o.length).toFixed(4), engineN: e.n, engineMean: +(e.sum / e.n).toFixed(4), timeExits: o.filter((x) => x.timeExit).length, cut: o.filter((x) => x.cut).length };
    o.filter((x) => !x.cut).forEach((x, k) => all.push({ ...x, lead: L.id, id: `${L.id}-${String(k).padStart(3, '0')}` })); }
  return { all, gate, last: D.t[D.n - 1] };
}
if (process.argv[1] && process.argv[1].endsWith('orders.mjs')) { const r = await build(); console.log(JSON.stringify(r.gate, null, 1), r.all.length, new Set(r.all.map((x) => x.ts)).size, new Set(r.all.map((x) => x.deadEnd)).size);
  const sd = (v) => { const m = v.reduce((s, x) => s + x, 0) / v.length; return Math.sqrt(v.reduce((s, x) => s + (x - m) ** 2, 0) / (v.length - 1)); };
  for (const L of LEADS) { const v = r.all.filter((x) => x.lead === L.id); console.log(L.id, v.length, 'sd', sd(v.map((x) => x.midR)).toFixed(2), 'median D', v.map((x) => x.D).sort((a, b) => a - b)[v.length >> 1].toFixed(1), 'mean hold h', (v.reduce((s, x) => s + (x.deadEnd - x.ts) / 3600, 0) / v.length).toFixed(0)); } }
