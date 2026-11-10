// HistData clock audit: fetch the independent feed once (OANDA mid H1 candles, UTC, through the site's keyless proxy) and
// keep it OUTSIDE the repo. Two calls per symbol and year (a half-year of H1 is under the 5,000-candle limit), 180 in all.
//
//   node --use-env-proxy research/edge/histdata-clock/fetch.mjs <cache dir>
//
// A file that is already in the cache is not fetched again. Nothing here is read by a study or by the council.
import fs from 'node:fs';
import path from 'node:path';

const CACHE = process.argv[2], BASE = process.env.CLOCK_BARS_URL || 'https://meridianx.dev';
if (!CACHE) { console.error('usage: node research/edge/histdata-clock/fetch.mjs <cache dir>'); process.exit(1); }
fs.mkdirSync(CACHE, { recursive: true });
export const OANDA_SYMS = ['xau', 'xag', 'nas100', 'spx500', 'eurusd', 'gbpusd', 'usdjpy', 'audusd', 'usdcad', 'usdchf'];
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
let calls = 0;
for (const sym of OANDA_SYMS) for (let y = 2018; y <= 2026; y++) for (const half of [0, 1]) {
  const from = Date.UTC(y, half * 6, 1) / 1000, to = Math.min(Date.UTC(y, half * 6 + 6, 1) / 1000, Date.UTC(2026, 10, 1) / 1000);
  if (from >= to) continue;
  const file = path.join(CACHE, `${sym}-1h-${y}-${half + 1}.json`);
  if (fs.existsSync(file)) continue;
  let bars = null;
  for (let attempt = 0; attempt < 4 && !bars; attempt++) {
    const res = await fetch(`${BASE}/md/bars?sym=${sym}&tf=1h&from=${from}&to=${to}`); calls++;
    if (res.ok) bars = (await res.json()).bars; else { console.error(sym, y, half, 'HTTP', res.status); await sleep(5000 * (attempt + 1)); }
  }
  if (!bars) throw new Error(`no answer for ${sym} ${y} half ${half + 1}`);
  fs.writeFileSync(file, JSON.stringify(bars.map((b) => [b.time, b.close])));
  console.error(sym, y, half + 1, bars.length, 'candles');
  await sleep(1200);
}
console.error('done,', calls, 'calls');
