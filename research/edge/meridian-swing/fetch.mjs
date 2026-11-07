// Edge research · meridian-swing: OANDA mid candles (the live Trader's gold/forex feed) through the site's /md/bars proxy,
// paged by from/to in windows of 4,999 candles, finished candles only (as council/backtest.mjs oandaRange). Cached as gzip JSON.
//   node fetch.mjs <outDir> [fromISO=2017-06-01] [toISO=now] [keys=xau,eurusd,gbpusd,audusd,usdcad,usdchf]
import fs from 'node:fs';
import path from 'node:path';
import zlib from 'node:zlib';
const [OUT, fromS = '2017-06-01', toS, keysS = 'xau,eurusd,gbpusd,audusd,usdcad,usdchf'] = process.argv.slice(2);
const BASE = process.env.MD_BASE || 'https://meridianx.dev/md/';
const from = Date.parse(fromS + 'T00:00:00Z') / 1000, to = toS ? Date.parse(toS + 'T00:00:00Z') / 1000 : Math.floor(Date.now() / 1000);
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
// warm-up before `from`: M5 none (the replay starts once 720 H1 exist), H1 60 days, H4 200 days, D1 3 years
const TF = [['5m', 300, 0], ['1h', 3600, 60 * 86400], ['4h', 14400, 200 * 86400], ['1d', 86400, 1100 * 86400]];
async function range(key, tf, sec, a0, b0) {
  const m = new Map();
  for (let a = a0; a < b0;) {
    const b = Math.min(b0, a + 4999 * sec);
    let j = null, err = null;
    for (let k = 0; k < 4 && !j; k++) {
      try { const r = await fetch(`${BASE}bars?sym=${key}&tf=${tf}&from=${a}&to=${b}`, { signal: AbortSignal.timeout(30000) }); const x = r.ok ? await r.json() : null;
        if (x && x.src === 'OANDA' && Array.isArray(x.bars)) j = x; else err = x && x.error ? String(x.error) : `HTTP ${r.status}`; }
      catch (e) { err = String(e.message || e); }
      if (!j) await sleep(1500 * (k + 1));
    }
    if (!j) throw new Error(`${key} ${tf} ${new Date(a * 1000).toISOString()}: ${err}`);
    for (const x of j.bars) if (!x.live && x.time >= a && x.time < b) m.set(+x.time, [+x.time, +x.open, +x.high, +x.low, +x.close]);
    a = b; await sleep(150);
  }
  return [...m.values()].sort((p, q) => p[0] - q[0]);
}
fs.mkdirSync(OUT, { recursive: true });
for (const key of keysS.split(',')) for (const [tf, sec, warm] of TF) {
  const f = path.join(OUT, `${key}-${tf}.json.gz`);
  if (fs.existsSync(f)) continue;
  const t = Date.now(), bars = await range(key, tf, sec, from - warm, to);
  fs.writeFileSync(f, zlib.gzipSync(JSON.stringify(bars)));
  console.log(`${key} ${tf}: ${bars.length} candles ${new Date(bars[0][0] * 1000).toISOString().slice(0, 10)} → ${new Date(bars.at(-1)[0] * 1000).toISOString().slice(0, 10)} (${((Date.now() - t) / 1000).toFixed(0)}s)`);
}
