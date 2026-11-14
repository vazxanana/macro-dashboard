// Edge research · gold-london-reversal: OANDA mid M5 XAU/USD through the site's keyless candle proxy (/md/bars), 2016-01-01 to
// the end of the last complete UTC day. Complete candles only. No candle before 2016 is asked for (item 44).
//   node --use-env-proxy research/edge/gold-london-reversal/fetch.mjs <outDir>   (file xau-5m.json.gz, rows [t,o,h,l,c])
// Keep the output out of git.
import fs from 'node:fs';
import path from 'node:path';
import zlib from 'node:zlib';

const [OUT] = process.argv.slice(2);
if (!OUT) throw new Error('usage: node fetch.mjs <outDir>');
const BASE = process.env.MD_BASE || 'https://meridianx.dev/md/';
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const FROM = Date.parse('2016-01-01T00:00:00Z') / 1000, END = Math.floor(Date.now() / 86400000) * 86400, SEC = 300;

const m = new Map();
for (let a = FROM; a < END;) {
  const b = Math.min(END, a + 4999 * SEC);
  let j = null, err = null;
  for (let k = 0; k < 6 && !j; k++) {
    try { const r = await fetch(`${BASE}bars?sym=xau&tf=5m&from=${a}&to=${b}`, { signal: AbortSignal.timeout(40000) }); const x = r.ok ? await r.json() : null;
      if (x && x.src === 'OANDA' && Array.isArray(x.bars)) j = x; else err = x && x.error ? String(x.error) : `HTTP ${r.status}`; }
    catch (e) { err = String(e.message || e); }
    if (!j) await sleep(2000 * (k + 1));
  }
  if (!j) throw new Error(`xau ${new Date(a * 1000).toISOString()}: ${err}`);
  for (const x of j.bars) if (!x.live && x.time >= a && x.time < b) m.set(+x.time, [+x.time, +x.open, +x.high, +x.low, +x.close]);
  a = b; await sleep(150);
}
const bars = [...m.values()].sort((p, q) => p[0] - q[0]);
fs.mkdirSync(OUT, { recursive: true });
fs.writeFileSync(path.join(OUT, 'xau-5m.json.gz'), zlib.gzipSync(JSON.stringify(bars)));
console.log(`xau 5m: ${bars.length} candles ${new Date(bars[0][0] * 1000).toISOString()} → ${new Date(bars.at(-1)[0] * 1000).toISOString()}`);
