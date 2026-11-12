// Edge research · trend-breadth-h1: OANDA mid H1 and D1 candles through the site's keyless candle proxy (/md/bars), from the
// first candle OANDA serves (2004 for most markets, March 2006 for the metals) to the end of October 2026. Complete candles
// only, UTC buckets as the proxy serves them (D1 with the Sunday stub, as the live Trader's daily feed has it).
//   node --use-env-proxy fetch.mjs <outDir> [market ...]      (files <market>-1h.json.gz / -1d.json.gz, rows [t,o,h,l,c])
// Keep the output out of git.
import fs from 'node:fs';
import path from 'node:path';
import zlib from 'node:zlib';
import { MARKETS } from './markets.mjs';

const [OUT, ...ONLY] = process.argv.slice(2);
if (!OUT) throw new Error('usage: node fetch.mjs <outDir> [market ...]');
const BASE = process.env.MD_BASE || 'https://meridianx.dev/md/';
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const T = (s) => Date.parse(s + 'T00:00:00Z') / 1000;
const FROM = T('2004-01-01'), END = T('2026-11-01');
const NEED = { '1h': 3600, '1d': 86400 };

async function range(sym, tf, sec) {
  const m = new Map();
  for (let a = FROM; a < END;) {
    const b = Math.min(END, a + 4999 * sec);
    let j = null, err = null;
    for (let k = 0; k < 6 && !j; k++) {
      try { const r = await fetch(`${BASE}bars?sym=${sym}&tf=${tf}&from=${a}&to=${b}`, { signal: AbortSignal.timeout(40000) }); const x = r.ok ? await r.json() : null;
        if (x && x.src === 'OANDA' && Array.isArray(x.bars)) j = x; else err = x && x.error ? String(x.error) : `HTTP ${r.status}`; }
      catch (e) { err = String(e.message || e); }
      if (!j) await sleep(2000 * (k + 1));
    }
    if (!j) throw new Error(`${sym} ${tf} ${new Date(a * 1000).toISOString()}: ${err}`);
    for (const x of j.bars) if (!x.live && x.time >= a && x.time < b) m.set(+x.time, [+x.time, +x.open, +x.high, +x.low, +x.close]);
    a = b; await sleep(150);
  }
  return [...m.values()].sort((p, q) => p[0] - q[0]);
}
fs.mkdirSync(OUT, { recursive: true });
for (const sym of ['xau', ...Object.keys(MARKETS)]) {
  if (ONLY.length && !ONLY.includes(sym)) continue;
  for (const [tf, sec] of Object.entries(NEED)) {
    const f = path.join(OUT, `${sym}-${tf}.json.gz`);
    if (fs.existsSync(f)) { console.log(`${sym} ${tf}: exists`); continue; }
    const bars = await range(sym, tf, sec);
    fs.writeFileSync(f, zlib.gzipSync(JSON.stringify(bars)));
    console.log(`${sym} ${tf}: ${bars.length} candles ${new Date(bars[0][0] * 1000).toISOString().slice(0, 10)} → ${new Date(bars.at(-1)[0] * 1000).toISOString().slice(0, 10)}`);
  }
}
