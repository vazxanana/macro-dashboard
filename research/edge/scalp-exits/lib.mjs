// Shared helpers for the scalp-exits study: load histdata M1 (council/histdata.mjs clock; +5 h before 9 Nov), aggregate, the live markets' meta.
import fs from 'node:fs';
import path from 'node:path';
import zlib from 'node:zlib';
import { histStampUtc } from '../../../council/histdata.mjs';   // HistData clock: UTC-5, UTC-4 in Europe's summer (2018: New York time)

export const MARKETS = {
  xau: { file: 'XAUUSD', label: 'XAU/USD', group: 'Metals', spot: true, dec: 2 },
  eurusd: { file: 'EURUSD', label: 'EUR/USD', group: 'Forex', dec: 5 },
  gbpusd: { file: 'GBPUSD', label: 'GBP/USD', group: 'Forex', dec: 5 },
  usdcad: { file: 'USDCAD', label: 'USD/CAD', group: 'Forex', dec: 5 },
  usdchf: { file: 'USDCHF', label: 'USD/CHF', group: 'Forex', dec: 5 },
};
// backtest.mjs spreadOf: one spread per round trip (forex 1 pip, gold 0.30)
export const spreadOf = (M, price) => M.group === 'Forex' ? 0.0001 : M.spot ? 0.3 : price * 0.0002;
export const sessionOf = (t) => { const h = new Date(t * 1000).getUTCHours(); return h < 7 ? 'asia' : h < 12 ? 'london' : h < 16 ? 'overlap' : h < 21 ? 'newyork' : 'late'; };
export const marketOpen = (t) => { const d = new Date(t * 1000), wd = d.getUTCDay(), h = d.getUTCHours(); return !(wd === 6 || (wd === 0 && h < 23) || (wd === 5 && h >= 21)); };

// histdata rows: "YYYYMMDD HHMMSS;O;H;L;C;V" (file clock: council/histdata.mjs)
export function loadM1(dir, file) {
  const fl = fs.readdirSync(dir).filter((f) => f.startsWith(file + '_M1_')).sort();
  const out = [];
  for (const f of fl) {
    const txt = zlib.gunzipSync(fs.readFileSync(path.join(dir, f))).toString();
    for (const ln of txt.split('\n')) {
      if (ln.length < 20) continue;
      const p = ln.split(';'), d = p[0];
      const t = histStampUtc(d);
      out.push({ time: t, open: +p[1], high: +p[2], low: +p[3], close: +p[4] });
    }
  }
  out.sort((a, b) => a.time - b.time);
  const ded = [];
  for (const b of out) if (!ded.length || ded[ded.length - 1].time !== b.time) ded.push(b);
  return ded;
}
// cleaned M1 (clean.mjs, forex lone-wick rule) cached as a Float64 file next to the data, so repeated runs load in seconds
export function loadClean(dir, key, cleanBars) {
  const M = MARKETS[key], cf = path.join(dir, `cache_${key}.f64`);
  if (fs.existsSync(cf)) {
    const buf = fs.readFileSync(cf), a = new Float64Array(buf.buffer, buf.byteOffset, buf.length / 8), out = new Array(a.length / 5);
    for (let i = 0; i < out.length; i++) out[i] = { time: a[5 * i], open: a[5 * i + 1], high: a[5 * i + 2], low: a[5 * i + 3], close: a[5 * i + 4] };
    return out;
  }
  const m1 = loadM1(dir, M.file);
  cleanBars(m1, M.group === 'Forex' ? { wickK: 15 } : {});
  const a = new Float64Array(m1.length * 5);
  m1.forEach((b, i) => { a.set([b.time, b.open, b.high, b.low, b.close], 5 * i); });
  fs.writeFileSync(cf, Buffer.from(a.buffer));
  return m1;
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
export function atrOf(bars, n = 14) { const b = bars.slice(-n - 1); let s = 0; for (let i = 1; i < b.length; i++) s += Math.max(b[i].high - b[i].low, Math.abs(b[i].high - b[i - 1].close), Math.abs(b[i].low - b[i - 1].close)); return b.length > 1 ? s / (b.length - 1) : 0; }
// first index with time >= t
export function lowerBound(arr, t) { let lo = 0, hi = arr.length; while (lo < hi) { const m = (lo + hi) >> 1; if (arr[m].time < t) lo = m + 1; else hi = m; } return lo; }
