// Optional, manual, needs the network: check the research candles' clock against a correctly stamped feed.
//
//   ACADEMY_CANDLES=/tmp/academy-candles node academy/gen/clock-check.mjs        (add --use-env-proxy behind a proxy)
//
// For three weeks of every year (one in the March stretch when New York is on daylight time and Europe is not, the one
// around 1 November, and an ordinary week in May) it reads OANDA XAU_USD H1 candles from the site's keyless proxy
// (/md/bars, the feed the Academy page replays) and compares them with the HistData H1 candles as the gold studies stamp
// them (research/edge/gold-systems/data.mjs, which converts with council/histdata.mjs), moved by -1, 0 and +1 hour. The
// smallest mean |open/high/low/close difference| says how far the studies' clock is off: 0 in every week since the clock
// correction of 10 Nov 2026 (the full audit, every week and symbol, is research/edge/histdata-clock). Writes academy/data/clock-check.json; run.mjs quotes it in
// quality.json when it is there and does not need it.
import fs from 'node:fs';
import path from 'node:path';
import { DATA_DIR } from './study.mjs';
import { usEuDstMismatch } from '../quality.mjs';

const CANDLES = process.env.ACADEMY_CANDLES, BASE = process.env.ACADEMY_BARS_URL || 'https://meridianx.dev';
if (!CANDLES) { console.error('Set ACADEMY_CANDLES (see academy/gen/run.mjs).'); process.exit(1); }
process.env.GOLD_DIR = path.join(CANDLES, 'research/candles/xau-histdata');
process.env.GOLD_CACHE = path.join(process.env.ACADEMY_SCRATCH || path.join(CANDLES, 'academy-scratch'), 'xau_m1.bin'); fs.mkdirSync(path.dirname(process.env.GOLD_CACHE), { recursive: true });
const { loadM1, aggregate } = await import('../../research/edge/gold-systems/data.mjs');
const m = loadM1(), H = aggregate(m, 3600), byT = new Map(H.map((b) => [b.time, b])), end = m.T[m.n - 1];

const monday = (y, mo, d) => { const t = Date.UTC(y, mo - 1, d) / 1000, wd = new Date(t * 1000).getUTCDay(); return t + ((8 - wd) % 7) * 86400; };   // first Monday on or after
const weeks = [];
for (let y = 2018; y <= 2026; y++) {
  const sun2 = 8 + ((7 - new Date(Date.UTC(y, 2, 8)).getUTCDay()) % 7), lastOct = 31 - new Date(Date.UTC(y, 9, 31)).getUTCDay();
  weeks.push(monday(y, 3, sun2 + 1), monday(y, 5, 8), monday(y, 10, lastOct + 1));
}
const rows = [];
for (const wk of weeks) {
  if (wk + 4 * 86400 > end) continue;
  const res = await fetch(`${BASE}/md/bars?sym=xau&tf=1h&from=${wk}&to=${wk + 4 * 86400}`); if (!res.ok) throw new Error(`/md/bars ${res.status}`);
  const j = await res.json(), diff = {};
  for (const k of [-1, 0, 1]) { let s = 0, n = 0; for (const o of j.bars) { const h = byT.get(o.time + k * 3600); if (!h) continue; s += Math.abs(h.open - o.open) + Math.abs(h.high - o.high) + Math.abs(h.low - o.low) + Math.abs(h.close - o.close); n++; } diff[k] = n ? +(s / (4 * n)).toFixed(3) : null; }
  const best = [-1, 0, 1].filter((k) => diff[k] != null).sort((a, b) => diff[a] - diff[b])[0];
  rows.push({ week: new Date(wk * 1000).toISOString().slice(0, 10), mismatchWeek: usEuDstMismatch(wk + 2 * 86400 + 43200), bars: j.bars.length, meanAbsDiff: { '-1h': diff[-1], '0h': diff[0], '+1h': diff[1] }, studyClockEarlySec: best ? -best * 3600 : 0 });
  console.error(rows.at(-1).week, rows.at(-1).mismatchWeek ? 'mismatch' : 'normal  ', JSON.stringify(rows.at(-1).meanAbsDiff), 'early by', rows.at(-1).studyClockEarlySec);
}
const out = { checked: new Date().toISOString().slice(0, 10), feed: `${new URL(BASE).host} /md/bars sym=xau tf=1h (OANDA XAU_USD)`, against: 'HistData XAUUSD M1 -> H1 as research/edge/gold-systems/data.mjs stamps it (council/histdata.mjs)',
  method: 'mean |open, high, low, close difference| ($) between the HistData candle at t + k and the OANDA candle at t, Monday-Thursday of the week; the k with the smallest difference is the clock offset',
  reading: 'studyClockEarlySec 3600 = the study stamps a candle one hour before its true time; 0 = the clocks agree', weeks: rows };
fs.writeFileSync(path.join(DATA_DIR, 'clock-check.json'), JSON.stringify(out, null, 1) + '\n');
console.error('wrote academy/data/clock-check.json');
