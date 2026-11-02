// Dukascopy historical candles (free, no key): the forex history source for the backtest.
// Files are LZMA ("lzma alone") compressed; every candle is 24 bytes, big-endian:
//   int32 seconds from the file's start, int32 open, close, low, high (price × point), float32 volume.
// Minute candles: one file per UTC day; hour candles: one per month; day candles: one per year.
// Months in the URL are 0-based (January = 00). Empty files and zero-volume candles mean no trading.
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { execFileSync } from 'node:child_process';

const HOST = 'https://datafeed.dukascopy.com/datafeed';
const p2 = (n) => String(n).padStart(2, '0');
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

// Decode one .bi5 buffer. base = the file's start (unix s). Field order is checked against the candle rule
// low <= open, close <= high, so a different order can't silently scramble prices.
export function decodeBi5(buf, base, point = 1e5) {
  if (!buf || !buf.length) return [];
  const tmp = path.join(os.tmpdir(), `bi5-${process.pid}-${Math.random().toString(36).slice(2)}.lzma`);
  fs.writeFileSync(tmp, buf);
  let raw;
  try { raw = execFileSync('xz', ['--format=lzma', '-dc', tmp], { maxBuffer: 64 << 20 }); } finally { fs.unlinkSync(tmp); }
  const rows = [];
  for (let o = 0; o + 24 <= raw.length; o += 24) rows.push([raw.readInt32BE(o), raw.readInt32BE(o + 4), raw.readInt32BE(o + 8), raw.readInt32BE(o + 12), raw.readInt32BE(o + 16), raw.readFloatBE(o + 20)]);
  const ok = (o, h, l, c) => l <= Math.min(o, c) && h >= Math.max(o, c);
  const orders = { ocLH: (r) => [r[1], r[4], r[3], r[2]], ohLC: (r) => [r[1], r[2], r[3], r[4]] };   // → [open, high, low, close]
  let best = 'ocLH', score = -1;
  for (const [name, f] of Object.entries(orders)) { const sc = rows.filter((r) => ok(...f(r))).length; if (sc > score) { score = sc; best = name; } }
  const f = orders[best];
  return rows.filter((r) => r[5] > 0).map((r) => { const [o, h, l, c] = f(r); return { time: base + r[0], open: o / point, high: h / point, low: l / point, close: c / point }; });
}

async function get(url) {
  for (let a = 0; a < 4; a++) {
    try {
      const r = await fetch(url);
      if (r.status === 404) return null;
      if (!r.ok) throw new Error(`HTTP ${r.status}`);
      return Buffer.from(await r.arrayBuffer());
    } catch (e) { if (a === 3) throw new Error(`${url}: ${e.message || e}`); await sleep(800 * (a + 1)); }
  }
}

// 1m candles for [from, to), one file per UTC day, a few days in parallel
export async function dukaMinutes(sym, from, to, point = 1e5) {
  const days = [];
  for (let d = Math.floor(from / 86400) * 86400; d < to; d += 86400) days.push(d);
  const out = [];
  for (let i = 0; i < days.length; i += 6) {
    const part = await Promise.all(days.slice(i, i + 6).map(async (d) => {
      const t = new Date(d * 1000), buf = await get(`${HOST}/${sym}/${t.getUTCFullYear()}/${p2(t.getUTCMonth())}/${p2(t.getUTCDate())}/BID_candles_min_1.bi5`);
      return buf ? decodeBi5(buf, d, point) : [];
    }));
    for (const arr of part) out.push(...arr);
  }
  return out.filter((b) => b.time >= from && b.time < to).sort((a, b) => a.time - b.time);
}
// 1h candles: one file per month
export async function dukaHours(sym, from, to, point = 1e5) {
  const out = [];
  const d = new Date(from * 1000); d.setUTCDate(1); d.setUTCHours(0, 0, 0, 0);
  for (; d.getTime() / 1000 < to; d.setUTCMonth(d.getUTCMonth() + 1)) {
    const buf = await get(`${HOST}/${sym}/${d.getUTCFullYear()}/${p2(d.getUTCMonth())}/BID_candles_hour_1.bi5`);
    if (buf) out.push(...decodeBi5(buf, d.getTime() / 1000, point));
  }
  return out.filter((b) => b.time >= from && b.time < to).sort((a, b) => a.time - b.time);
}
// 1d candles: one file per year
export async function dukaDays(sym, from, to, point = 1e5) {
  const out = [];
  for (let y = new Date(from * 1000).getUTCFullYear(); y <= new Date(to * 1000).getUTCFullYear(); y++) {
    const buf = await get(`${HOST}/${sym}/${y}/BID_candles_day_1.bi5`);
    if (buf) out.push(...decodeBi5(buf, Date.UTC(y, 0, 1) / 1000, point));
  }
  return out.filter((b) => b.time >= from && b.time < to).sort((a, b) => a.time - b.time);
}
