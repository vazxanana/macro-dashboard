// Edge research · gold-round-numbers: fetch OANDA mid M5 XAU/USD from 2015-12-01 through the keyless candle proxy
// (4,999-candle windows, paced), complete candles only. The file is kept OUT of git.
//   node --use-env-proxy research/edge/gold-round-numbers/fetch.mjs <dir>   -> <dir>/xau-5m.json.gz  ([t, o, h, l, c] rows)
import fs from 'node:fs';
import path from 'node:path';
import zlib from 'node:zlib';

const STEP = 300, FROM = Date.UTC(2015, 11, 1) / 1000, DAY = 86400;
const BASE = process.env.MD_BASE || 'https://meridianx.dev/md/', sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const iso = (t) => new Date(t * 1000).toISOString().slice(0, 16).replace('T', ' ');

async function range(sym, a0, b0) {
  const m = new Map();
  for (let a = a0; a < b0;) {
    const b = Math.min(b0, a + 4999 * STEP); let j = null, err = null;
    for (let k = 0; k < 6 && !j; k++) {
      try { const r = await fetch(`${BASE}bars?sym=${sym}&tf=5m&from=${a}&to=${b}`, { signal: AbortSignal.timeout(40000) }); const x = r.ok ? await r.json() : null;
        if (x && x.src === 'OANDA' && Array.isArray(x.bars)) j = x; else err = x && x.error ? String(x.error) : `HTTP ${r.status}`; } catch (e) { err = String(e.message || e); }
      if (!j) await sleep(2000 * (k + 1));
    }
    if (!j) throw new Error(`${sym} 5m ${iso(a)}: ${err}`);
    for (const x of j.bars) if (!x.live && x.time >= a && x.time < b) m.set(+x.time, [+x.time, +x.open, +x.high, +x.low, +x.close]);
    a = b; await sleep(150);
  }
  return [...m.values()].sort((p, q) => p[0] - q[0]);
}

const OUT = process.argv[2];
if (!OUT) { console.error('usage: fetch.mjs <dir>'); process.exit(2); }
fs.mkdirSync(OUT, { recursive: true });
const end = Math.floor(Date.now() / 1000 / DAY) * DAY, rows = await range('xau', FROM, end);
fs.writeFileSync(path.join(OUT, 'xau-5m.json.gz'), zlib.gzipSync(JSON.stringify(rows)));
console.log(`xau: ${rows.length} candles ${iso(rows[0][0])} → ${iso(rows.at(-1)[0])}`);
