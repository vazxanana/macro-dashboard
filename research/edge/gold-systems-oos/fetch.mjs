// Edge research · gold-systems-oos: OANDA XAU/USD mid candles (the live Trader's gold feed since 7 Nov) through the site's free
// /md/bars proxy, from the first candle OANDA serves (2006-03-20) to OOS_TO. M5 (management and entries), H4 (trendline) and
// D1 (trend legs, engulf, MSNR levels), UTC buckets as the proxy serves them (D1 with OANDA's Sunday-evening stub, as live).
//   [CANDLES_IN=<cache dir, rows [t,o,h,l,c] in xau-<tf>.json.gz>] node fetch.mjs <outDir>
// Reuses a cache when given (research/edge/replica-oos layout) and fetches only what it lacks; finished candles only, paged by
// from/to in windows of 4,999 candles. Keep the output out of git.
import fs from 'node:fs';
import path from 'node:path';
import zlib from 'node:zlib';

const [OUT] = process.argv.slice(2);
if (!OUT) throw new Error('usage: node fetch.mjs <outDir>');
const IN = process.env.CANDLES_IN || null, BASE = process.env.MD_BASE || 'https://meridianx.dev/md/';
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const T = (s) => Date.parse(s + 'T00:00:00Z') / 1000;
const FROM = T('2006-03-01'), END = T(process.env.OOS_TO || '2026-11-07');
const NEED = { '5m': 300, '4h': 14400, '1d': 86400 };

async function range(tf, sec, a0, b0) {
  const m = new Map();
  for (let a = a0; a < b0;) {
    const b = Math.min(b0, a + 4999 * sec);
    let j = null, err = null;
    for (let k = 0; k < 5 && !j; k++) {
      try { const r = await fetch(`${BASE}bars?sym=xau&tf=${tf}&from=${a}&to=${b}`, { signal: AbortSignal.timeout(30000) }); const x = r.ok ? await r.json() : null;
        if (x && x.src === 'OANDA' && Array.isArray(x.bars)) j = x; else err = x && x.error ? String(x.error) : `HTTP ${r.status}`; }
      catch (e) { err = String(e.message || e); }
      if (!j) await sleep(1500 * (k + 1));
    }
    if (!j) throw new Error(`xau ${tf} ${new Date(a * 1000).toISOString()}: ${err}`);
    for (const x of j.bars) if (!x.live && x.time >= a && x.time < b) m.set(+x.time, [+x.time, +x.open, +x.high, +x.low, +x.close]);
    a = b; await sleep(120);
  }
  return [...m.values()];
}
fs.mkdirSync(OUT, { recursive: true });
for (const [tf, sec] of Object.entries(NEED)) {
  const f = path.join(OUT, `xau-${tf}.json.gz`);
  if (fs.existsSync(f)) { console.log(`${tf}: ${f} exists`); continue; }
  const cf = IN && path.join(IN, `xau-${tf}.json.gz`);
  const have = cf && fs.existsSync(cf) ? JSON.parse(zlib.gunzipSync(fs.readFileSync(cf))) : [];
  const first = have.length ? have[0][0] : END, last = have.length ? have.at(-1)[0] + sec : FROM;
  const pre = first > FROM ? await range(tf, sec, FROM, first) : [];
  const post = last < END ? await range(tf, sec, last, END) : [];
  const all = new Map(); for (const r of [...pre, ...have, ...post]) all.set(r[0], r);
  const bars = [...all.values()].sort((p, q) => p[0] - q[0]);
  fs.writeFileSync(f, zlib.gzipSync(JSON.stringify(bars)));
  console.log(`${tf}: ${bars.length} candles ${new Date(bars[0][0] * 1000).toISOString().slice(0, 10)} → ${new Date(bars.at(-1)[0] * 1000).toISOString().slice(0, 10)} (fetched ${pre.length} before, ${post.length} after the cache)`);
}
