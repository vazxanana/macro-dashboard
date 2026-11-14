// Edge research · gold-regime-switch: fetch OANDA mid XAU/USD H4 candles through the candle proxy (keyless), 4999-candle
// windows from 2016-01-01, into <dir>/xau-4h.json ([[t, o, h, l, c, v], ...], complete candles only). Kept out of git.
//   node --use-env-proxy research/edge/gold-regime-switch/fetch.mjs <dir>
import fs from 'node:fs';
import path from 'node:path';

const BASE = process.env.MD_BASE || 'https://meridianx.dev/md/bars';
const FROM = Date.parse('2016-01-01T00:00:00Z') / 1000;   // no candle before 2016 (docs/owner-decisions.md item 44)
const STEP = 14400;
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function get(url) {
  for (let k = 0; k < 4; k++) {
    try {
      const r = await fetch(url);
      if (r.ok) return await r.json();
      if (r.status < 500 && r.status !== 429) throw new Error(`${r.status} ${url}`);
    } catch (e) { if (k === 3) throw e; }
    await sleep(3000 * (k + 1));
  }
  throw new Error('failed ' + url);
}

const dir = process.argv[2];
if (!dir) { console.error('usage: fetch.mjs <dir>'); process.exit(1); }
fs.mkdirSync(dir, { recursive: true });
const now = Math.floor(Date.now() / 1000), out = new Map();
for (let a = FROM; a < now; a += 4999 * STEP) {
  const b = Math.min(now, a + 4999 * STEP);
  const j = await get(`${BASE}?sym=xau&tf=4h&from=${a}&to=${b}`);
  for (const x of j.bars || []) if (x.time >= FROM) out.set(x.time, [x.time, x.open, x.high, x.low, x.close, x.volume || 0]);
  await sleep(2500);
}
const rows = [...out.values()].sort((x, y) => x[0] - y[0]).filter((r) => r[0] + STEP <= now);   // complete candles only
fs.writeFileSync(path.join(dir, 'xau-4h.json'), JSON.stringify(rows));
console.log('4h', rows.length, new Date(rows[0][0] * 1000).toISOString(), new Date(rows.at(-1)[0] * 1000).toISOString());
