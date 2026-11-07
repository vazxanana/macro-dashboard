// OANDA 5-minute mid candles for the ICT 2008-2017 out-of-sample test, through the site's own keyless proxy
// (meridianx.dev/md/bars, api/bars.js: OANDA's 5000-candle cap per request, no monthly cost). Same source and access path as
// research/edge/nq-open-oos/fetch.mjs (there 1m NAS100 back to 2004); 5m is all the ICT code path reads (H1 signals, D1 bias
// and 5m exits are all built from it, as ict-universe built them from M1).
//   node research/edge/ict-oos-2008/fetch.mjs <cacheDir> [fromISO=2007-06-01] [toISO=2026-11-01] [syms=xau,nas100,spx500,us30]
// Output: <cacheDir>/<sym>-<year>.json.gz = [[unixSec, o, h, l, c], ...] (complete candles only). Re-runs skip finished years.
// The proxy has no Russell 2000 (OANDA US2000_USD is not in api/_oanda.js), so RTY has no pre-2018 data here.
import fs from 'node:fs';
import path from 'node:path';
import zlib from 'node:zlib';

const [OUT, FROM = '2007-06-01', TO = '2026-11-01', SYMS = 'xau,nas100,spx500,us30'] = process.argv.slice(2);
if (!OUT) { console.error('usage: fetch.mjs <cacheDir> [fromISO] [toISO] [syms]'); process.exit(1); }
fs.mkdirSync(OUT, { recursive: true });
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const STEP = 4999 * 300;   // one request = 4999 five-minute candles of wall-clock time

async function get(url, tries = 6) {
  for (let k = 0; k < tries; k++) {
    try { const r = await fetch(url, { signal: AbortSignal.timeout(40000) }); if (r.ok) return await r.json(); if (r.status === 400) return { bars: [] }; } catch { /* retry */ }
    await sleep(1500 * (k + 1));
  }
  throw new Error('fetch failed ' + url);
}

const t0 = Date.parse(FROM) / 1000, t1 = Math.min(Date.parse(TO) / 1000, Math.floor(Date.now() / 1000));
for (const sym of SYMS.split(',')) {
  for (let y = new Date(t0 * 1000).getUTCFullYear(); y <= new Date(t1 * 1000).getUTCFullYear(); y++) {
    const file = path.join(OUT, `${sym}-${y}.json.gz`);
    if (fs.existsSync(file)) { console.log(sym, y, 'cached'); continue; }
    const a = Math.max(t0, Date.UTC(y, 0, 1) / 1000), b = Math.min(t1, Date.UTC(y + 1, 0, 1) / 1000), wins = [];
    for (let t = a; t < b; t += STEP) wins.push([t, Math.min(b, t + STEP)]);
    const got = new Map(); let i = 0;
    async function worker() { while (i < wins.length) { const [f, to] = wins[i++];
      const j = await get(`https://meridianx.dev/md/bars?sym=${sym}&tf=5m&from=${f}&to=${to}`);
      for (const x of j.bars || []) if (!x.live && x.time >= f && x.time < to) got.set(x.time, [x.time, x.open, x.high, x.low, x.close]); } }
    await Promise.all(Array.from({ length: 6 }, worker));
    const rows = [...got.values()].sort((p, q) => p[0] - q[0]);
    fs.writeFileSync(file, zlib.gzipSync(JSON.stringify(rows)));
    console.log(sym, y, rows.length, 'candles');
  }
}
