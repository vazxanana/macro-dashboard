// Edge research · replica-oos: OANDA XAU/USD mid candles (the live Trader's gold feed) through the site's /md/bars proxy.
// Reuses an existing cache (CANDLES_IN, the meridian-swing layout: <key>-<tf>.json.gz, rows [t, o, h, l, c]) and only fetches
// the warm-up before it starts, so the 2017 replay has full 720-candle windows on every timeframe.
//   CANDLES_IN=<cache dir> node fetch.mjs <outDir>
// Finished candles only, paged by from/to in windows of 4,999 candles (as research/edge/meridian-swing/fetch.mjs).
import fs from 'node:fs';
import path from 'node:path';
import zlib from 'node:zlib';

const [OUT] = process.argv.slice(2);
if (!OUT) throw new Error('usage: node fetch.mjs <outDir>');
const IN = process.env.CANDLES_IN || null, BASE = process.env.MD_BASE || 'https://meridianx.dev/md/';
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const T = (s) => Date.parse(s + 'T00:00:00Z') / 1000;
// first candle each timeframe needs: M5 a week before 2017, H1 two months (720 candles), H4 seven months (720), D1 four years
const NEED = { '5m': [300, T('2016-12-20')], '1h': [3600, T('2016-10-20')], '4h': [14400, T('2016-05-01')], '1d': [86400, T('2013-06-01')] };
const END = T(process.env.OOS_TO || '2026-11-07');

async function range(tf, sec, a0, b0) {
  const m = new Map();
  for (let a = a0; a < b0;) {
    const b = Math.min(b0, a + 4999 * sec);
    let j = null, err = null;
    for (let k = 0; k < 4 && !j; k++) {
      try { const r = await fetch(`${BASE}bars?sym=xau&tf=${tf}&from=${a}&to=${b}`, { signal: AbortSignal.timeout(30000) }); const x = r.ok ? await r.json() : null;
        if (x && x.src === 'OANDA' && Array.isArray(x.bars)) j = x; else err = x && x.error ? String(x.error) : `HTTP ${r.status}`; }
      catch (e) { err = String(e.message || e); }
      if (!j) await sleep(1500 * (k + 1));
    }
    if (!j) throw new Error(`xau ${tf} ${new Date(a * 1000).toISOString()}: ${err}`);
    for (const x of j.bars) if (!x.live && x.time >= a && x.time < b) m.set(+x.time, [+x.time, +x.open, +x.high, +x.low, +x.close]);
    a = b; await sleep(150);
  }
  return [...m.values()];
}
fs.mkdirSync(OUT, { recursive: true });
for (const [tf, [sec, from]] of Object.entries(NEED)) {
  const f = path.join(OUT, `xau-${tf}.json.gz`);
  if (fs.existsSync(f)) { console.log(`${tf}: ${f} exists`); continue; }
  const cf = IN && path.join(IN, `xau-${tf}.json.gz`);
  const have = cf && fs.existsSync(cf) ? JSON.parse(zlib.gunzipSync(fs.readFileSync(cf))) : [];
  const first = have.length ? have[0][0] : END, last = have.length ? have.at(-1)[0] + sec : from;
  const pre = first > from ? await range(tf, sec, from, first) : [];
  const post = last < END ? await range(tf, sec, last, END) : [];
  const all = new Map(); for (const r of [...pre, ...have, ...post]) all.set(r[0], r);
  const bars = [...all.values()].sort((p, q) => p[0] - q[0]);
  fs.writeFileSync(f, zlib.gzipSync(JSON.stringify(bars)));
  console.log(`${tf}: ${bars.length} candles ${new Date(bars[0][0] * 1000).toISOString().slice(0, 10)} → ${new Date(bars.at(-1)[0] * 1000).toISOString().slice(0, 10)} (fetched ${pre.length} before, ${post.length} after the cache)`);
}
