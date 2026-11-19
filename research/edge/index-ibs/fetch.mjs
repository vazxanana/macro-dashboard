// Edge research · index-ibs: OANDA mid H1 candles of SPX500, NAS100 and US30 through the site's keyless candle proxy
// (/md/bars), 1 January 2004 to 14 November 2026, complete candles only (UTC hours as the proxy serves them).
//   node --use-env-proxy research/edge/index-ibs/fetch.mjs <outDir>      (files <market>-1h.json.gz, rows [t,o,h,l,c])
// Keep the output out of git.
import fs from 'node:fs';
import path from 'node:path';
import zlib from 'node:zlib';

export const MARKETS = ['spx500', 'nas100', 'us30'];
const BASE = process.env.MD_BASE || 'https://meridianx.dev/md/';
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const FROM = Date.parse('2004-01-01T00:00:00Z') / 1000, END = Date.parse('2026-11-14T00:00:00Z') / 1000;

async function range(sym) {
  const m = new Map();
  for (let a = FROM; a < END;) {
    const b = Math.min(END, a + 4999 * 3600);
    let j = null, err = null;
    for (let k = 0; k < 6 && !j; k++) {
      try { const r = await fetch(`${BASE}bars?sym=${sym}&tf=1h&from=${a}&to=${b}`, { signal: AbortSignal.timeout(40000) }); const x = r.ok ? await r.json() : null;
        if (x && x.src === 'OANDA' && Array.isArray(x.bars)) j = x; else err = x && x.error ? String(x.error) : `HTTP ${r.status}`; }
      catch (e) { err = String(e.message || e); }
      if (!j) await sleep(2000 * (k + 1));
    }
    if (!j) throw new Error(`${sym} ${new Date(a * 1000).toISOString()}: ${err}`);
    for (const x of j.bars) if (!x.live && x.time >= a && x.time < b) m.set(+x.time, [+x.time, +x.open, +x.high, +x.low, +x.close]);
    a = b; await sleep(200);
  }
  return [...m.values()].sort((p, q) => p[0] - q[0]);
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const OUT = process.argv[2];
  if (!OUT) throw new Error('usage: node fetch.mjs <outDir>');
  fs.mkdirSync(OUT, { recursive: true });
  for (const sym of MARKETS) {
    const f = path.join(OUT, `${sym}-1h.json.gz`);
    if (fs.existsSync(f)) { console.log(`${sym}: exists`); continue; }
    const bars = await range(sym);
    fs.writeFileSync(f, zlib.gzipSync(JSON.stringify(bars)));
    console.log(`${sym}: ${bars.length} candles ${new Date(bars[0][0] * 1000).toISOString().slice(0, 10)} → ${new Date(bars.at(-1)[0] * 1000).toISOString().slice(0, 10)}`);
  }
}
