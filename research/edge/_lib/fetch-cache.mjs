// research/edge/_lib/fetch-cache.mjs - fill the edgekit candle cache (OANDA mid candles through the site candle proxy).
// node --use-env-proxy research/edge/_lib/fetch-cache.mjs <market> <5m|1d> <firstYear> [lastYear]
// Writes $EDGE_DATA/<market>/<tf>-<year>.json.gz ([[t,o,h,l,c]], t = candle start, unix s, UTC); a finished year is never
// fetched again. Set EDGE_DATA (edgekit reads the same variable). Then run research/edge/data-quality/audit.mjs.
import fs from 'node:fs'; import zlib from 'node:zlib';
const OUT = process.env.EDGE_DATA || '/tmp/claude-0/-workspace-macro-dashboard/70c7c5c7-1744-58d1-abc7-8a850c1b63a7/scratchpad/edge-data';
const BASE = process.env.MD_BASE || 'https://aureumdesk.co.uk/md/';
const [mk, tf, Y0, Y1] = process.argv.slice(2);
const step = tf === '5m' ? 300 : 86400;
const span = tf === '5m' ? 16 * 86400 : 4000 * 86400;
const y0 = +Y0;
const now = Math.floor(Date.now() / 1000);
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
async function get(from, to) {
  const u = `${BASE}bars?sym=${mk}&tf=${tf}&from=${from}&to=${to}`;
  for (let i = 0; i < 4; i++) {
    try {
      const r = await fetch(u);
      if (r.ok) { const j = await r.json(); return j.bars || []; }
      console.error(mk, tf, 'HTTP', r.status, from);
    } catch (e) { console.error(mk, tf, 'ERR', e.message, from); }
    await sleep(1500 * (i + 1));
  }
  throw new Error('failed ' + u);
}
fs.mkdirSync(`${OUT}/${mk}`, { recursive: true });
const thisYear = new Date().getUTCFullYear(); const yEnd = Y1 ? +Y1 : thisYear;
for (let y = y0; y <= yEnd; y++) {
  const file = `${OUT}/${mk}/${tf}-${y}.json.gz`;
  if (fs.existsSync(file) && y < thisYear) continue;
  const a = Date.UTC(y, 0, 1) / 1000, b = Math.min(Date.UTC(y + 1, 0, 1) / 1000, now);
  const map = new Map();
  for (let f = a; f < b; f += span) {
    const t = Math.min(f + span, b);
    const bars = await get(f, t);
    if (tf === '5m' && bars.length >= 4999) console.error(mk, 'window full', f);
    for (const x of bars) if (x.time >= a && x.time < b) map.set(x.time, [x.time, x.open, x.high, x.low, x.close]);
    await sleep(300);
  }
  // drop a still-forming last candle
  let rows = [...map.values()].sort((p, q) => p[0] - q[0]);
  rows = rows.filter((r) => r[0] + step <= now);
  if (!rows.length) { console.log(mk, tf, y, 0, 'empty, no file'); continue; }
  fs.writeFileSync(file + '.tmp', zlib.gzipSync(JSON.stringify(rows)));
  fs.renameSync(file + '.tmp', file);
  console.log(mk, tf, y, rows.length);
}
