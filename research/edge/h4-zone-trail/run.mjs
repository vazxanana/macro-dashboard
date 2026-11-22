// Edge research · h4-zone-trail (PREREGISTRATION.md): an H4 next-candle engulf zone, a limit at its near edge, the stop past
// its far edge, no target, the stop trailed 1R behind the best price from +2R, out after 40 H1 candles. Research only.
//   node run.mjs <candleDir> [--write]      (candles from fetch.mjs; --write saves result.json beside this file)
import fs from 'node:fs'; import path from 'node:path'; import zlib from 'node:zlib'; import { fileURLToPath } from 'node:url';
import { zones } from '../../../council/eg-methods.mjs';
import { nights, FIN } from '../../../council/fills.mjs';

export const P = { life: 80, hold: 40, pad: 0.0001, minRisk: 0.0002, trailFrom: 2, trailBy: 1, noFill: [17, 24] };
export const COST = { xau: (px) => 0.00005 * px, eurusd: (px) => 0.000045 * px + 0.00005, gbpusd: (px) => 0.000045 * px + 0.00005 };
export const FROM = Date.UTC(2007, 0, 1) / 1000, TO = Date.UTC(2020, 0, 1) / 1000, MID = Date.UTC(2014, 0, 1) / 1000;
const weekend = (t) => { const d = new Date(t * 1000), w = d.getUTCDay(), h = d.getUTCHours(); return w === 6 || (w === 5 && h >= 22) || (w === 0 && h < 22); };
export const clean = (rows) => rows.filter((r) => !weekend(r[0])).map((r) => ({ time: r[0], open: r[1], high: r[2], low: r[3], close: r[4] }));
export function h4of(H1) { const out = []; for (const b of H1) { const t = Math.floor(b.time / 14400) * 14400, l = out[out.length - 1];
    if (l && l.time === t) { l.high = Math.max(l.high, b.high); l.low = Math.min(l.low, b.low); l.close = b.close; } else out.push({ time: t, open: b.open, high: b.high, low: b.low, close: b.close }); } return out; }

// every zone's own trade, then one position at a time. o: { back (1 = next-candle engulf), late (fills 17-24 UTC allowed), target (fixed R, no trail) }
export function trades(H1, market, o = {}) {
  const back = o.back || 1, H4 = h4of(H1), Z = zones(H4, '4h', back), idx = new Map(H1.map((b, i) => [b.time, i])), cand = [];
  // the first H1 candle at or after a time
  const at = (t) => { let lo = 0, hi = H1.length; while (lo < hi) { const m = (lo + hi) >> 1; if (H1[m].time < t) lo = m + 1; else hi = m; } return lo; };
  for (const z of Z) { const d = z.dir, L = d > 0 ? z.top : z.bot, far = d > 0 ? z.bot : z.top, stop0 = far - d * P.pad * L;
    if (Math.abs(L - stop0) < P.minRisk * L) continue;
    let f = -1, entry = 0;
    for (let i = at(z.at), n = 0; i < H1.length && n < P.life; i++, n++) { const c = H1[i], h = new Date(c.time * 1000).getUTCHours(), okHour = o.late || !(h >= P.noFill[0] && h < P.noFill[1]);
      if (okHour && (d > 0 ? c.low <= L : c.high >= L)) { entry = d > 0 ? Math.min(L, c.open) : Math.max(L, c.open); f = i; break; }
      if (d > 0 ? c.close < far : c.close > far) break; }
    if (f < 0 || (d > 0 ? entry <= stop0 : entry >= stop0)) continue;
    const r0 = Math.abs(entry - stop0), c0 = H1[f]; let stop = stop0, best = entry, exit = null, how = '', xi = f;
    if (d > 0 ? c0.low <= stop : c0.high >= stop) { exit = stop; how = 'stop'; }
    for (let i = f + 1, n = 1; exit == null && i < H1.length; i++, n++) { const c = H1[i]; xi = i;
      if (d > 0 ? c.open < stop : c.open > stop) { exit = c.open; how = 'gap'; break; }
      if (d > 0 ? c.low <= stop : c.high >= stop) { exit = stop; how = stop === stop0 ? 'stop' : 'trail'; break; }
      if (o.target) { const tg = entry + d * o.target * r0; if (d > 0 ? c.high >= tg : c.low <= tg) { exit = tg; how = 'target'; break; } }
      else { best = d > 0 ? Math.max(best, c.high) : Math.min(best, c.low); if (d * (best - entry) / r0 >= P.trailFrom) { const s = best - d * P.trailBy * r0; stop = d > 0 ? Math.max(stop, s) : Math.min(stop, s); } }
      if (n >= P.hold) { exit = c.close; how = 'time'; break; } }
    if (exit == null) continue;
    const t = c0.time, endT = H1[xi].time + 3600, R = d * (exit - entry) / r0, cost = COST[market](entry) + (market === 'xau' && d > 0 ? nights(t, endT) * FIN.xau.long * entry : 0);
    cand.push({ market, t, endT, side: d, entry, stop: stop0, r0, R, cost: cost / r0, how }); }
  cand.sort((a, b) => a.t - b.t); const out = []; let free = 0;
  for (const c of cand) { if (c.t < free) continue; out.push(c); free = c.endT; }
  return out.filter((c) => c.t >= FROM && c.t < TO);
}

const mean = (x) => x.reduce((a, b) => a + b, 0) / (x.length || 1);
const tOf = (x) => { const n = x.length; if (n < 3) return null; const m = mean(x), sd = Math.sqrt(x.reduce((a, b) => a + (b - m) ** 2, 0) / (n - 1)); return sd ? m / (sd / Math.sqrt(n)) : null; };
const months = (from, to) => { const out = []; for (let d = new Date(from * 1000); d.getTime() / 1000 < to; d.setUTCMonth(d.getUTCMonth() + 1)) out.push(d.getUTCFullYear() * 12 + d.getUTCMonth()); return out; };
export function stats(T, k = 1, from = FROM, to = TO) { const S = T.filter((x) => x.t >= from && x.t < to), net = S.map((x) => x.R - k * x.cost), M = new Map(months(from, to).map((m) => [m, 0]));
  for (const x of S) { const d = new Date(x.t * 1000), m = d.getUTCFullYear() * 12 + d.getUTCMonth(); M.set(m, (M.get(m) || 0) + x.R - k * x.cost); }
  let eq = 0, pk = 0, dd = 0; for (const v of net) { eq += v; pk = Math.max(pk, eq); dd = Math.min(dd, eq - pk); }
  const r = (v, n = 3) => v == null ? null : +v.toFixed(n);
  return { n: S.length, win: r(S.filter((x) => x.R > 0).length / (S.length || 1), 3), gross: r(mean(S.map((x) => x.R))), net: r(mean(net)), total: r(net.reduce((a, b) => a + b, 0), 1), monthT: r(tOf([...M.values()]), 2), maxDD: r(dd, 1) }; }
const pOf = (t) => { if (t == null) return 1; const z = Math.abs(t), a = 1 / (1 + 0.2316419 * z), d = 0.3989423 * Math.exp(-z * z / 2); return 2 * d * a * (0.3193815 + a * (-0.3565638 + a * (1.781478 + a * (-1.821256 + a * 1.330274)))); };
export function report(by) { const all = Object.values(by).flat().sort((a, b) => a.t - b.t);
  const row = (T) => ({ all: stats(T), h1: stats(T, 1, FROM, MID), h2: stats(T, 1, MID, TO), x2: stats(T, 2) });
  const pooled = row(all), pass = (q) => q.all.net > 0 && q.all.monthT >= 2 && q.h1.net > 0 && q.h2.net > 0 && q.x2.net > 0;
  const mk = Object.fromEntries(Object.entries(by).map(([k, T]) => [k, row(T)])), ps = Object.entries(mk).map(([k, q]) => [k, q.all.monthT > 0 ? pOf(q.all.monthT) : 1]).sort((a, b) => a[1] - b[1]);
  let run = 0; ps.forEach(([k, p], i) => { run = Math.max(run, Math.min(1, p * (ps.length - i))); mk[k].holm = +run.toFixed(4); mk[k].counts = run < 0.05 && mk[k].all.monthT >= 2 && mk[k].h1.net > 0 && mk[k].h2.net > 0; });
  return { verdict: pass(pooled) ? 'PASS' : 'FAIL', pooled, markets: mk, buys: stats(all.filter((x) => x.side > 0)), sells: stats(all.filter((x) => x.side < 0)), exits: Object.fromEntries(['stop', 'gap', 'trail', 'time'].map((h) => [h, all.filter((x) => x.how === h).length])) }; }

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const dir = process.argv[2]; if (!dir) throw new Error('usage: node run.mjs <candleDir> [--write]');
  const H = Object.fromEntries(['xau', 'eurusd', 'gbpusd'].map((m) => [m, clean(JSON.parse(zlib.gunzipSync(fs.readFileSync(path.join(dir, m + '-1h.json.gz')))))]));
  const run = (o) => Object.fromEntries(Object.entries(H).map(([m, h]) => [m, trades(h, m, o)]));
  const main = report(run({})), also = { target2R: report(run({ target: 2 })).pooled, lateFills: report(run({ late: true })).pooled, anyCandle: report(run({ back: Infinity })).pooled };
  const res = { study: 'h4-zone-trail', built: '2026-11-22', window: '2007-01-01 to 2019-12-31', params: P, ...main, reported: also };
  console.log(JSON.stringify(res, null, 1)); if (process.argv.includes('--write')) fs.writeFileSync(path.join(path.dirname(fileURLToPath(import.meta.url)), 'result.json'), JSON.stringify(res, null, 1) + '\n');
}
