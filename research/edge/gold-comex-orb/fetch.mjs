// Edge research · gold-comex-orb: OANDA mid XAU/USD M5 candles through the site's keyless candle proxy (/md/bars),
// 1 Dec 2015 to 14 Nov 2026 (complete candles only, UTC buckets as the proxy serves them). The same fetch as research/edge/ict-silver-bullet-gold/fetch.mjs (same proxy, same file), after
// research/edge/orb-nas100/fetch.mjs, other market.
//   node --use-env-proxy research/edge/gold-comex-orb/fetch.mjs <outDir>   (file xau-5m.json.gz, rows [t,o,h,l,c])
// Keep the output out of git.
import fs from 'node:fs';
import path from 'node:path';
import zlib from 'node:zlib';

const [OUT] = process.argv.slice(2);
if (!OUT) throw new Error('usage: node fetch.mjs <outDir>');
const BASE = process.env.MD_BASE || 'https://meridianx.dev/md/';
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const T = (s) => Date.parse(s + 'T00:00:00Z') / 1000;
const FROM = T('2015-12-01'), END = T('2026-11-14'), SEC = 300;

async function range(sym) {
  const m = new Map();
  for (let a = FROM; a < END;) {
    const b = Math.min(END, a + 4999 * SEC);
    let j = null, err = null;
    for (let k = 0; k < 6 && !j; k++) {
      try { const r = await fetch(`${BASE}bars?sym=${sym}&tf=5m&from=${a}&to=${b}`, { signal: AbortSignal.timeout(40000) }); const x = r.ok ? await r.json() : null;
        if (x && x.src === 'OANDA' && Array.isArray(x.bars)) j = x; else err = x && x.error ? String(x.error) : `HTTP ${r.status}`; }
      catch (e) { err = String(e.message || e); }
      if (!j) await sleep(2000 * (k + 1));
    }
    if (!j) throw new Error(`${sym} ${new Date(a * 1000).toISOString()}: ${err}`);
    for (const x of j.bars) if (!x.live && x.time >= a && x.time < b) m.set(+x.time, [+x.time, +x.open, +x.high, +x.low, +x.close]);
    a = b; await sleep(120);
  }
  return [...m.values()].sort((p, q) => p[0] - q[0]);
}
fs.mkdirSync(OUT, { recursive: true });
const f = path.join(OUT, 'xau-5m.json.gz');
if (fs.existsSync(f)) console.log('xau: exists');
else {
  const bars = await range('xau');
  fs.writeFileSync(f, zlib.gzipSync(JSON.stringify(bars)));
  console.log(`xau: ${bars.length} candles ${new Date(bars[0][0] * 1000).toISOString().slice(0, 10)} → ${new Date(bars.at(-1)[0] * 1000).toISOString().slice(0, 10)}`);
}
