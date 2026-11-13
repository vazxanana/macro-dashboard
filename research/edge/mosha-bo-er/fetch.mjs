// Edge research · mosha-bo-er: OANDA mid gold candles through the site's candle proxy, in mosha-oos/run.mjs's file shape
// (xau-<tf>.json.gz = [[time, o, h, l, c], ...], closed candles only). Keep <dir> out of git.
//   node --use-env-proxy research/edge/mosha-bo-er/fetch.mjs <dir>
import fs from 'node:fs';
import path from 'node:path';
import zlib from 'node:zlib';

const DIR = process.argv[2];
if (!DIR) { console.error('usage: fetch.mjs <dir>'); process.exit(1); }
const BASE = process.env.MD_BASE || 'https://meridianx.dev/md/', END = Math.floor(Date.now() / 1000);
const T = (s) => Date.parse(s + 'T00:00:00Z') / 1000, sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const NEED = { '1d': [86400, T('2016-01-01')], '4h': [14400, T('2019-06-01')], '1h': [3600, T('2019-06-01')], '15m': [900, T('2019-06-01')], '5m': [300, T('2019-06-01')] };
fs.mkdirSync(DIR, { recursive: true });
for (const [tf, [sec, from]] of Object.entries(NEED)) {
  const f = path.join(DIR, `xau-${tf}.json.gz`); if (fs.existsSync(f)) { console.log(`${tf}: exists`); continue; }
  const got = new Map();
  for (let a = from; a < END;) {
    const b = Math.min(END, a + 4999 * sec); let j = null, err = null;
    for (let k = 0; k < 6 && !j; k++) {
      try { const r = await fetch(`${BASE}bars?sym=xau&tf=${tf}&from=${a}&to=${b}`, { signal: AbortSignal.timeout(40000) }); const x = r.ok ? await r.json() : null;
        if (x && x.src === 'OANDA' && Array.isArray(x.bars)) j = x; else err = x && x.error ? String(x.error) : `HTTP ${r.status}`; } catch (e) { err = String(e.message || e); }
      if (!j) await sleep(2000 * (k + 1));
    }
    if (!j) throw new Error(`xau ${tf} ${new Date(a * 1000).toISOString()}: ${err}`);
    for (const x of j.bars) if (!x.live && x.time >= a && x.time < b && +x.time + sec <= END) got.set(+x.time, [+x.time, +x.open, +x.high, +x.low, +x.close]);
    a = b; await sleep(150);
  }
  const rows = [...got.values()].sort((p, q) => p[0] - q[0]);
  fs.writeFileSync(f, zlib.gzipSync(JSON.stringify(rows)));
  console.log(`${tf}: ${rows.length} candles ${new Date(rows[0][0] * 1000).toISOString().slice(0, 10)} -> ${new Date(rows.at(-1)[0] * 1000).toISOString().slice(0, 16)}`);
}
