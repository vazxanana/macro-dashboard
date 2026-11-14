// Edge research · natgas-storage-day: fetch OANDA mid M5 NATGAS_USD through the site's keyless candle proxy.
//   node --use-env-proxy research/edge/natgas-storage-day/fetch.mjs <dir>   -> <dir>/natgas-5m.json.gz ([t, o, h, l, c] rows)
// Keep <dir> out of git. Same loop as oil-wednesday's fetch (4999 candles a request, retries, complete candles only).
import fs from 'node:fs';
import path from 'node:path';
import zlib from 'node:zlib';

const M5 = 300, FROM = Date.parse('2005-01-01T00:00:00Z') / 1000;
const BASE = process.env.MD_BASE || 'https://meridianx.dev/md/', sleep = (ms) => new Promise((r) => setTimeout(r, ms));

export async function fetchAll(dir) {
  const END = Math.floor(Date.now() / 1000 / M5) * M5, m = new Map();
  for (let a = FROM; a < END;) {
    const b = Math.min(END, a + 4999 * M5); let j = null, err = null;
    for (let k = 0; k < 6 && !j; k++) {
      try {
        const r = await fetch(`${BASE}bars?sym=natgas&tf=5m&from=${a}&to=${b}`, { signal: AbortSignal.timeout(40000) });
        const x = r.ok ? await r.json() : null;
        if (x && x.src === 'OANDA' && Array.isArray(x.bars)) j = x; else err = x && x.error ? String(x.error) : `HTTP ${r.status}`;
      } catch (e) { err = String(e.message || e); }
      if (!j) await sleep(2000 * (k + 1));
    }
    if (!j) throw new Error(`natgas 5m ${new Date(a * 1000).toISOString()}: ${err}`);
    for (const x of j.bars) if (!x.live && x.time >= a && x.time < b) m.set(+x.time, [+x.time, +x.open, +x.high, +x.low, +x.close]);
    a = b; await sleep(150);
  }
  const bars = [...m.values()].sort((p, q) => p[0] - q[0]).filter((x) => x[0] + M5 <= END);
  fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(path.join(dir, 'natgas-5m.json.gz'), zlib.gzipSync(JSON.stringify(bars)));
  console.log(`natgas 5m: ${bars.length} candles ${new Date(bars[0][0] * 1000).toISOString()} -> ${new Date(bars.at(-1)[0] * 1000).toISOString()}`);
}

const dir = process.argv[2];
if (!dir) throw new Error('usage: fetch.mjs <dir>');
await fetchAll(dir);
