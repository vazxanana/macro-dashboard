// Gold M1 loader + bar aggregation for the gold-systems edge study.
// Source: council-data research/candles/xau-histdata/XAUUSD_M1_*.csv.gz (HistData), converted to UTC with council/histdata.mjs
// (10 Nov 2026, research/edge/histdata-clock: the labels are New York time in 2018 and UTC-5 / UTC-4 on Europe's summer-time
// dates from 2019. Until then this loader read every year as New York time, one hour early in the weeks the US is on
// daylight time and Europe is not).
// Env: GOLD_DIR = folder with the .csv.gz files; parsed once and cached as GOLD_DIR/xau_m1.bin.
import fs from 'node:fs';
import zlib from 'node:zlib';
import path from 'node:path';
import { histToUtc } from '../../../council/histdata.mjs';   // the shared HistData clock

export function loadM1() {
  const dir = process.env.GOLD_DIR, cache = process.env.GOLD_CACHE || path.join(dir, 'xau_m1.bin');
  if (fs.existsSync(cache)) {
    const buf = fs.readFileSync(cache), n = buf.length / 40, f = new Float64Array(buf.buffer.slice(buf.byteOffset, buf.byteOffset + buf.length));
    const T = new Float64Array(n), O = new Float64Array(n), H = new Float64Array(n), L = new Float64Array(n), C = new Float64Array(n);
    for (let i = 0; i < n; i++) { T[i] = f[i * 5]; O[i] = f[i * 5 + 1]; H[i] = f[i * 5 + 2]; L[i] = f[i * 5 + 3]; C[i] = f[i * 5 + 4]; }
    return { T, O, H, L, C, n };
  }
  const files = fs.readdirSync(dir).filter((x) => /^XAUUSD_M1_\d+\.csv\.gz$/.test(x)).sort();
  const rows = [];
  for (const f of files) {
    const txt = zlib.gunzipSync(fs.readFileSync(path.join(dir, f))).toString('utf8');
    for (const line of txt.split('\n')) {
      if (line.length < 20) continue;
      const p = line.split(';'), s = p[0];
      const y = +s.slice(0, 4), mo = +s.slice(4, 6), d = +s.slice(6, 8), h = +s.slice(9, 11), mi = +s.slice(11, 13);
      const t = histToUtc(y, mo, d, h, mi);
      rows.push([t, +p[1], +p[2], +p[3], +p[4]]);
    }
  }
  rows.sort((a, b) => a[0] - b[0]);
  const out = []; let last = -1;
  for (const r of rows) { if (r[0] === last) continue; last = r[0]; out.push(r); }
  const n = out.length, f = new Float64Array(n * 5);
  out.forEach((r, i) => { for (let k = 0; k < 5; k++) f[i * 5 + k] = r[k]; });
  fs.writeFileSync(cache, Buffer.from(f.buffer));
  return loadM1();
}

// Aggregate to fixed UTC buckets of `sec` seconds. Daily: UTC days, Sunday's evening stub folded into Monday (spot gold
// opens Sun ~22:00 UTC). Returns [{time, open, high, low, close}] (time = bucket start, UTC seconds).
export function aggregate(m, sec) {
  const out = []; let cur = null;
  for (let i = 0; i < m.n; i++) {
    let k = Math.floor(m.T[i] / sec) * sec;
    if (sec === 86400) { const wd = new Date(k * 1000).getUTCDay(); if (wd === 0) k += 86400; if (wd === 6) continue; }
    if (!cur || cur.time !== k) { if (cur) out.push(cur); cur = { time: k, open: m.O[i], high: m.H[i], low: m.L[i], close: m.C[i] }; }
    else { if (m.H[i] > cur.high) cur.high = m.H[i]; if (m.L[i] < cur.low) cur.low = m.L[i]; cur.close = m.C[i]; }
  }
  if (cur) out.push(cur);
  return out;
}

// first index i in a sorted Float64Array with T[i] >= t
export function lowerBound(T, t) { let lo = 0, hi = T.length; while (lo < hi) { const md = (lo + hi) >> 1; if (T[md] < t) lo = md + 1; else hi = md; } return lo; }
