// The 11:05-12:05 ET candles the 12:00 exit variant needs, for every weekday the #511 cache holds (research/edge/nq-open-oos/fetch.mjs
// kept 09:30-11:05 only). Same proxy, same shape: <dir>/nas100-noon-<year>.json = { "<NY date>": [[unixSec, o, h, l, c, volume], ...] }.
//   node research/edge/nq-open-exits/fetch-noon.mjs <cacheDir>
import fs from 'node:fs';
import path from 'node:path';
import { nyParts, nyMidnight } from '../nq-open-oos/lib.mjs';

const [DIR] = process.argv.slice(2);
if (!DIR) { console.error('usage: fetch-noon.mjs <cacheDir>'); process.exit(1); }
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
async function get(url, tries = 6) {
  for (let k = 0; k < tries; k++) {
    try { const r = await fetch(url); if (r.ok) return await r.json(); if (r.status === 400) return { bars: [] }; } catch { /* retry */ }
    await sleep(1000 * (k + 1));
  }
  throw new Error('fetch failed ' + url);
}
for (const f of fs.readdirSync(DIR).filter((f) => /^nas100-\d{4}\.json$/.test(f)).sort()) {
  const y = f.slice(7, 11), out = path.join(DIR, `nas100-noon-${y}.json`);
  if (fs.existsSync(out)) { console.log(y, 'cached'); continue; }
  const days = Object.keys(JSON.parse(fs.readFileSync(path.join(DIR, f), 'utf8'))), res = {}; let i = 0;
  async function worker() {
    while (i < days.length) {
      const d = days[i++], m0 = nyMidnight(d);
      const j = await get(`https://meridianx.dev/md/bars?sym=nas100&tf=1m&from=${m0 + 11 * 3600 + 4 * 60}&to=${m0 + 12 * 3600 + 6 * 60}`);
      const keep = [];
      for (const b of j.bars || []) { if (b.live) continue; const p = nyParts(b.time); if (p.d !== d || p.m < 665 || p.m > 725) continue; keep.push([b.time, b.open, b.high, b.low, b.close, b.volume || 0]); }
      if (keep.length) res[d] = keep;
    }
  }
  await Promise.all(Array.from({ length: 8 }, worker));
  fs.writeFileSync(out, JSON.stringify(Object.fromEntries(Object.entries(res).sort())));
  console.log(y, Object.keys(res).length, 'of', days.length, 'days');
}
