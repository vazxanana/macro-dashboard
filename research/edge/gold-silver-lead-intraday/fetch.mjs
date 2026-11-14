// Candle download for gold-silver-lead-intraday (cache kept out of git).
//   node --use-env-proxy research/edge/gold-silver-lead-intraday/fetch.mjs <dir> [xau,xag]
// OANDA mid M5 through the site's candle proxy, from 2016-01-01 00:00 UTC (no candle before 2016, item 44), complete candles only.
// Writes <dir>/<sym>-5m.json.gz = [[time, open, high, low, close], ...] in time order, one row per candle start.
import fs from 'node:fs';
import path from 'node:path';
import zlib from 'node:zlib';

export const M5 = 300, FROM = Date.UTC(2016, 0, 1) / 1000;

async function one(dir, sym) {
  const now = Math.floor(Date.now() / 1000), all = [];
  let from = FROM;
  while (from < now) {
    const to = Math.min(now, from + 4990 * M5); let j = null;
    for (let a = 0; a < 5 && !j; a++) {
      try { const r = await fetch(`https://meridianx.dev/md/bars?sym=${sym}&tf=5m&from=${from}&to=${to}`); const x = await r.json(); if (r.ok) j = x; else throw new Error(`${r.status} ${x.error || ''}`); }
      catch (e) { process.stderr.write(`retry ${sym} ${from} ${e.message}\n`); await new Promise((s) => setTimeout(s, 5000 * (a + 1))); }
    }
    if (!j) throw new Error(`proxy failed ${sym} ${from}`);
    for (const b of j.bars || []) if (!b.live && b.time >= FROM && b.time + M5 <= now) all.push([b.time, b.open, b.high, b.low, b.close]);
    process.stderr.write(`${sym} ${new Date(from * 1000).toISOString().slice(0, 10)} ${all.length}\n`);
    from = to; await new Promise((s) => setTimeout(s, 2100));   // the firewall allows 30 API calls a minute per IP
  }
  const seen = new Set(), rows = all.filter((x) => !seen.has(x[0]) && seen.add(x[0])).sort((a, b) => a[0] - b[0]);
  fs.writeFileSync(path.join(dir, `${sym}-5m.json.gz`), zlib.gzipSync(JSON.stringify(rows)));
  process.stderr.write(`${sym} done ${rows.length}\n`);
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const [dir, list = 'xau,xag'] = process.argv.slice(2);
  if (!dir) { console.log('usage: fetch.mjs <dir> [xau,xag]'); process.exit(1); }
  fs.mkdirSync(dir, { recursive: true });
  for (const sym of list.split(',')) await one(dir, sym);
}
