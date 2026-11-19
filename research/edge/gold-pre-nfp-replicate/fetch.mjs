// Edge research · gold-pre-nfp-replicate: OANDA mid gold through the site's keyless candle proxy (/md/bars).
//   node --use-env-proxy research/edge/gold-pre-nfp-replicate/fetch.mjs <outDir>
// Writes <outDir>/xau-h1.json (rows [t,o,h,l,c], 1 Mar 2006 to 14 Nov 2026) and <outDir>/xau-m5-nfp.json ({ <derived date>:
// rows } for every derived payroll date 2006-2021 and each hand-written exception, from date − 9 days to date + 9 days; the check reads − 9 to + 8).
// Complete candles only. Keep the output out of git.
import fs from 'node:fs';
import path from 'node:path';
import { payrolls } from './dates.mjs';

const [OUT] = process.argv.slice(2);
if (!OUT) throw new Error('usage: node fetch.mjs <outDir>');
const BASE = process.env.MD_BASE || 'https://meridianx.dev/md/';
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const T = (s) => Date.parse(s + 'T00:00:00Z') / 1000;

async function get(tf, a, b) {
  let err = null;
  for (let k = 0; k < 6; k++) {
    try {
      const r = await fetch(`${BASE}bars?sym=xau&tf=${tf}&from=${a}&to=${b}`, { signal: AbortSignal.timeout(40000) }); const x = r.ok ? await r.json() : null;
      if (x && x.src === 'OANDA' && Array.isArray(x.bars)) return x.bars.filter((y) => !y.live && y.time >= a && y.time < b).map((y) => [+y.time, +y.open, +y.high, +y.low, +y.close]);
      err = x && x.error ? String(x.error) : `HTTP ${r.status}`;
    } catch (e) { err = String(e.message || e); }
    await sleep(2000 * (k + 1));
  }
  throw new Error(`xau ${tf} ${new Date(a * 1000).toISOString()}: ${err}`);
}

fs.mkdirSync(OUT, { recursive: true });
const h1f = path.join(OUT, 'xau-h1.json');
if (!fs.existsSync(h1f)) {
  const m = new Map();
  for (let a = T('2006-03-01'), END = T('2026-11-14'); a < END;) {
    const b = Math.min(END, a + 4999 * 3600);
    for (const r of await get('1h', a, b)) m.set(r[0], r);
    a = b; await sleep(150);
  }
  const bars = [...m.values()].sort((p, q) => p[0] - q[0]);
  fs.writeFileSync(h1f, JSON.stringify(bars));
  console.log(`xau H1: ${bars.length} candles`);
}
const m5f = path.join(OUT, 'xau-m5-nfp.json');
const m5 = fs.existsSync(m5f) ? JSON.parse(fs.readFileSync(m5f, 'utf8')) : {};
for (const d of new Set(payrolls().flatMap((p) => [p.derived, p.d]))) {
  if (m5[d]) continue;
  const c = T(d);
  m5[d] = await get('5m', c - 9 * 86400, c + 9 * 86400);
  await sleep(150);
}
fs.writeFileSync(m5f, JSON.stringify(m5));
console.log(`xau M5 windows: ${Object.keys(m5).length}`);
