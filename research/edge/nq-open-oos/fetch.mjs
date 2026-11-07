// OANDA NAS100_USD 1-minute mid candles for the NQ New York open run, through the site's own proxy
// (meridianx.dev/md/bars, keyless, no monthly cost). For every weekday it keeps only what the live rule reads:
// the 09:30-11:05 ET candles (signal, trade, 11:00 exit) and, for the midnight-open filter, the last candle before 00:00 ET
// plus the first candle from 00:00 to 00:59 ET (before ~2016 OANDA's overnight quotes are thin and often skip the 00:00 minute).
//   node research/edge/nq-open-oos/fetch.mjs <outDir> [fromYear=2003] [toISO=today]
// Output: <outDir>/nas100-<year>.json = { "<NY date>": [[unixSec, o, h, l, c, volume], ...] }. Re-runs skip finished years.
import fs from 'node:fs';
import path from 'node:path';
import { nyParts, nyMidnight } from './lib.mjs';

const [OUT, Y0 = '2003', TO] = process.argv.slice(2);
if (!OUT) { console.error('usage: fetch.mjs <outDir> [fromYear] [toISO]'); process.exit(1); }
fs.mkdirSync(OUT, { recursive: true });
const end = TO ? Date.parse(TO) / 1000 : Date.now() / 1000;
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function get(url, tries = 5) {
  for (let k = 0; k < tries; k++) {
    try { const r = await fetch(url); if (r.ok) return await r.json(); if (r.status === 400) return { bars: [] }; } catch { /* retry */ }
    await sleep(1000 * (k + 1));
  }
  throw new Error('fetch failed ' + url);
}

for (let y = +Y0; y <= new Date(end * 1000).getUTCFullYear(); y++) {
  const file = path.join(OUT, `nas100-${y}.json`), thisYear = y === new Date().getUTCFullYear();
  if (fs.existsSync(file) && !thisYear) { console.log(y, 'cached'); continue; }
  const days = [];
  for (let t = Date.UTC(y, 0, 1) / 1000 + 12 * 3600; t < Date.UTC(y + 1, 0, 1) / 1000 && t < end; t += 86400) {
    const p = nyParts(t); if (p.wd === 'Sat' || p.wd === 'Sun') continue; days.push(p.d);
  }
  const out = {}; let i = 0;
  async function worker() {
    while (i < days.length) {
      const d = days[i++], m0 = nyMidnight(d);
      const j = await get(`https://meridianx.dev/md/bars?sym=nas100&tf=1m&from=${m0 - 3600}&to=${m0 + 11 * 3600 + 6 * 60}`);
      const keep = []; let pre = null, night = null;
      for (const b of j.bars || []) { if (b.live) continue; const row = [b.time, b.open, b.high, b.low, b.close, b.volume || 0];
        if (b.time < m0) { pre = row; continue; } const p = nyParts(b.time); if (p.d !== d) continue;
        if (p.m < 60) { if (!night) night = row; continue; }
        if (p.m >= 570 && p.m <= 665) keep.push(row); }
      if (night) keep.unshift(night); if (pre) keep.unshift(pre);
      if (keep.length) out[d] = keep;
    }
  }
  await Promise.all(Array.from({ length: 8 }, worker));
  const sorted = Object.fromEntries(Object.entries(out).sort());
  fs.writeFileSync(file, JSON.stringify(sorted));
  console.log(y, Object.keys(sorted).length, 'days');
}
