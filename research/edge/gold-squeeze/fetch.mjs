// Edge research · gold-squeeze: fetch OANDA mid XAU/USD H4 and D1 candles through the candle proxy (keyless), 4999-candle
// windows, into <dir>/xau-4h.json and <dir>/xau-1d.json ([[t, o, h, l, c, v], ...], complete candles only). Kept out of git.
//   node --use-env-proxy research/edge/gold-squeeze/fetch.mjs <dir>
import fs from 'node:fs';
import path from 'node:path';

const BASE = process.env.MD_BASE || 'https://meridianx.dev/md/bars';
const FROM = Date.parse('2015-06-01T00:00:00Z') / 1000;
const TF = { '4h': 14400, '1d': 86400 };
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

async function series(tf) {
  const step = TF[tf], now = Math.floor(Date.now() / 1000), out = new Map();
  for (let a = FROM; a < now; a += 4999 * step) {
    const b = Math.min(now, a + 4999 * step);
    const j = await get(`${BASE}?sym=xau&tf=${tf}&from=${a}&to=${b}`);
    for (const x of j.bars || []) out.set(x.time, [x.time, x.open, x.high, x.low, x.close, x.volume || 0]);
    await sleep(2500);
  }
  const rows = [...out.values()].sort((x, y) => x[0] - y[0]);
  return rows.filter((r) => r[0] + step <= now);   // complete candles only
}

const dir = process.argv[2];
if (!dir) { console.error('usage: fetch.mjs <dir>'); process.exit(1); }
fs.mkdirSync(dir, { recursive: true });
for (const tf of Object.keys(TF)) {
  const rows = await series(tf);
  fs.writeFileSync(path.join(dir, `xau-${tf}.json`), JSON.stringify(rows));
  console.log(tf, rows.length, new Date(rows[0][0] * 1000).toISOString(), new Date(rows.at(-1)[0] * 1000).toISOString());
}
