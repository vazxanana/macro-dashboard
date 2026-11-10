// Shared loaders for the confluence study: HistData M1 (council/histdata.mjs clock; +5 h before 10 Nov 2026), aggregation, stats.
import fs from 'node:fs';
import path from 'node:path';
import zlib from 'node:zlib';
import { histStampUtc } from '../../../council/histdata.mjs';   // the shared HistData clock

export const RAW = process.env.CONFL_RAW || path.join(path.dirname(new URL(import.meta.url).pathname), 'raw');
export const MKT = {
  xau: { file: 'XAUUSD', label: 'XAU/USD', group: 'Metals', spot: true, dec: 2, tick: 0.1, ictCost: 0.3 + 0.1 },
  nas: { file: 'NSXUSD', label: 'NAS100', group: 'Index', dec: 2, tick: 0.25, ictCost: 1.0 + 0.25 },
  eurusd: { file: 'EURUSD', label: 'EUR/USD', group: 'Forex', dec: 5, tick: 0.00001, ictCost: 0.0001 + 0.00001 },
};
// M1 bars for one market from fromYear..toYear (inclusive), cached as a Float64 binary
export function loadM1(key, fromYear = 2018, toYear = 2026) {
  const M = MKT[key], cache = path.join(RAW, `${key}_${fromYear}_${toYear}.bin`);
  if (fs.existsSync(cache)) {
    const buf = fs.readFileSync(cache), a = new Float64Array(buf.buffer, buf.byteOffset, buf.byteLength / 8), out = new Array(a.length / 5);
    for (let i = 0; i < out.length; i++) out[i] = { time: a[5 * i], open: a[5 * i + 1], high: a[5 * i + 2], low: a[5 * i + 3], close: a[5 * i + 4] };
    return out;
  }
  const files = fs.readdirSync(RAW).filter((f) => f.startsWith(M.file + '_M1_') && f.endsWith('.csv.gz')).filter((f) => { const y = +f.split('_M1_')[1].slice(0, 4); return y >= fromYear && y <= toYear; }).sort();
  const m = new Map();
  for (const f of files) for (const ln of zlib.gunzipSync(fs.readFileSync(path.join(RAW, f))).toString().split('\n')) {
    if (!ln) continue; const [d, o, h, l, c] = ln.split(';');
    const t = histStampUtc(d);
    const O = +o, H = +h, L = +l, C = +c; if (![O, H, L, C].every((v) => isFinite(v) && v > 0)) continue;
    m.set(t, { time: t, open: O, high: Math.max(H, O, C), low: Math.min(L, O, C), close: C });
  }
  const out = [...m.values()].sort((a, b) => a.time - b.time);
  const a = new Float64Array(out.length * 5); out.forEach((b, i) => { a.set([b.time, b.open, b.high, b.low, b.close], 5 * i); });
  fs.writeFileSync(cache, Buffer.from(a.buffer));
  return out;
}
export function aggregate(m1, sec, shift = 0) {
  const out = []; let cur = null;
  for (const b of m1) {
    const t0 = Math.floor((b.time + shift) / sec) * sec - shift;
    if (!cur || cur.time !== t0) { cur = { time: t0, open: b.open, high: b.high, low: b.low, close: b.close }; out.push(cur); }
    else { cur.high = Math.max(cur.high, b.high); cur.low = Math.min(cur.low, b.low); cur.close = b.close; }
  }
  return out;
}
// trading day: 22:00 UTC rollover (shift +2 h)
export const daily = (m1) => aggregate(m1, 86400, 7200);
export const yearOf = (t) => new Date(t * 1000).getUTCFullYear();

export function stats(R) {
  const n = R.length; if (!n) return { n: 0, wr: null, exp: null, R: 0, maxDD: 0, streak: 0, t: null };
  let s = 0, peak = 0, dd = 0, w = 0, cur = 0, worst = 0, ss = 0;
  for (const r of R) { s += r; peak = Math.max(peak, s); dd = Math.min(dd, s - peak); if (r > 0) { w++; cur = 0; } else if (r < 0) { cur++; worst = Math.max(worst, cur); } ss += r * r; }
  const m = s / n, sd = Math.sqrt(Math.max(0, ss / n - m * m) * n / Math.max(1, n - 1));
  return { n, wr: +(w / n).toFixed(3), exp: +m.toFixed(3), R: +s.toFixed(1), maxDD: +dd.toFixed(1), streak: worst, t: sd > 0 ? +(m / (sd / Math.sqrt(n))).toFixed(2) : null };
}
