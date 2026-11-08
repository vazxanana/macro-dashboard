// OANDA mid candles for the open run at the cash open of the markets in markets.mjs, through the site's own keyless proxy
// (meridianx.dev/md/bars, no monthly cost). Same logic as research/edge/open-run-breadth/fetch.mjs (#543), with the session
// taken from markets.mjs and an optional timeframe for the pre-registered 5-minute fallback. For every local weekday it keeps
// only what the rule reads: the candles from the session open to open + 95 min, the last candle before local midnight and
// the first candle in 00:00-00:59 local.
//   node research/edge/open-run-breadth-2/fetch.mjs <outDir> <sym> [fromYear=2003] [toISO=today] [tf=1m] [workers=6]
// Output: <outDir>/<sym>-<year>.json (1m) or <outDir>/<sym>-5m-<year>.json = { "<local date>": [[unixSec, o, h, l, c, volume], ...] }.
// Re-runs skip finished years. Cache lives in the session scratchpad, not git.
import fs from 'node:fs';
import path from 'node:path';
import { partsIn } from '../open-run-breadth/lib.mjs';
import { MARKETS2, midnightIn2 as midnightIn } from './markets.mjs';

const [OUT, SYM, Y0 = '2003', TO, TF = '1m', W = '6'] = process.argv.slice(2);
const M = MARKETS2[SYM];
if (!OUT || !M || !['1m', '5m'].includes(TF)) { console.error('usage: fetch.mjs <outDir> <' + Object.keys(MARKETS2).join('|') + '> [fromYear] [toISO] [1m|5m] [workers]'); process.exit(1); }
fs.mkdirSync(OUT, { recursive: true });
const end = TO ? Date.parse(TO) / 1000 : Date.now() / 1000;
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const tag = TF === '1m' ? '' : '-5m';

async function get(url, tries = 8) {
  for (let k = 0; k < tries; k++) {
    try {
      const r = await fetch(url);
      if (r.ok) return await r.json();
      if (r.status === 400) return { bars: [] };
      if (r.status === 429) { await sleep(5000 + 3000 * k); continue; }
    } catch { /* retry */ }
    await sleep(1000 * (k + 1));
  }
  throw new Error('fetch failed ' + url);
}

for (let y = +Y0; y <= new Date(end * 1000).getUTCFullYear(); y++) {
  const file = path.join(OUT, `${SYM}${tag}-${y}.json`), thisYear = y === new Date().getUTCFullYear();
  if (fs.existsSync(file) && !thisYear) { await fill(file, y); continue; }
  const days = [];
  for (let t = Date.UTC(y, 0, 1) / 1000 + 12 * 3600; t < Date.UTC(y + 1, 0, 1) / 1000 && t < end; t += 86400) {
    const p = partsIn(M.tz, t); if (p.wd === 'Sat' || p.wd === 'Sun') continue; days.push(p.d);
  }
  if (!days.length) continue;
  const out = {}; let i = 0;
  async function worker() {
    while (i < days.length) {
      const d = days[i++], m0 = midnightIn(M.tz, d);
      const j = await get(`https://meridianx.dev/md/bars?sym=${SYM}&tf=${TF}&from=${m0 - 3 * 3600}&to=${m0 + (M.open + 96) * 60}`);
      const keep = []; let pre = null, night = null;
      for (const b of j.bars || []) { if (b.live) continue; const row = [b.time, b.open, b.high, b.low, b.close, b.volume || 0];
        if (b.time < m0) { pre = row; continue; } const p = partsIn(M.tz, b.time); if (p.d !== d) continue;
        if (p.m < 60) { if (!night) night = row; continue; }
        if (p.m >= M.open && p.m <= M.open + 95) keep.push(row); }
      if (night) keep.unshift(night); if (pre) keep.unshift(pre);
      if (keep.length) out[d] = keep;
    }
  }
  await Promise.all(Array.from({ length: +W }, worker));
  const sorted = Object.fromEntries(Object.entries(out).sort());
  fs.writeFileSync(file, JSON.stringify(sorted));
  console.log(SYM, TF, y, Object.keys(sorted).length, 'days');
  await fill(file, y);
}

// Midnight price fallback: the close of the last candle before 00:00 local, however far back (preregistration.md). The request
// above looks back 3 hours; for days with neither a 00:00 candle nor an earlier candle the last 5-minute candle of the previous
// 4 days is added (its close is the last price before midnight). Same as #543.
async function fill(file, y) {
  const j = JSON.parse(fs.readFileSync(file, 'utf8')), todo = [];
  for (const [d, rows] of Object.entries(j)) { const m0 = midnightIn(M.tz, d); if (!rows.some((r) => r[0] < m0 || r[0] === m0)) todo.push(d); }
  let i = 0, added = 0;
  async function worker() {
    while (i < todo.length) {
      const d = todo[i++], m0 = midnightIn(M.tz, d);
      const r = await get(`https://meridianx.dev/md/bars?sym=${SYM}&tf=5m&from=${m0 - 4 * 86400}&to=${m0}`);
      const pre = (r.bars || []).filter((b) => !b.live && b.time + 300 <= m0).at(-1);
      if (pre) { j[d].unshift([pre.time, pre.open, pre.high, pre.low, pre.close, pre.volume || 0]); added++; }
    }
  }
  await Promise.all(Array.from({ length: +W }, worker));
  if (added) fs.writeFileSync(file, JSON.stringify(j));
  if (todo.length) console.log(SYM, TF, y, 'midnight fill', added, 'of', todo.length);
}
