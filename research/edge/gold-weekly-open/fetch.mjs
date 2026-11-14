// OANDA mid H1 XAU/USD from Sunday 3 January 2016 through the keyless candle proxy (PREREGISTRATION.md "Data").
//   node --use-env-proxy research/edge/gold-weekly-open/fetch.mjs <dir>   -> <dir>/xau-1h.json.gz  (rows [t, o, h, l, c]; keep outside git)
import fs from 'node:fs';
import path from 'node:path';
import zlib from 'node:zlib';

const H = 3600, FROM = Date.parse('2016-01-03T00:00:00Z') / 1000;
const dir = process.argv[2];
if (!dir) { console.log('usage: fetch.mjs <dir>'); process.exit(1); }
fs.mkdirSync(dir, { recursive: true });
const BASE = process.env.MD_BASE || 'https://meridianx.dev/md/', m = new Map(), END = Math.floor(Date.now() / 1000);
for (let a = FROM; a < END;) {
  const b = Math.min(END, a + 4999 * H); let j = null, err = null;
  for (let k = 0; k < 6 && !j; k++) {
    try {
      const r = await fetch(`${BASE}bars?sym=xau&tf=1h&from=${a}&to=${b}`, { signal: AbortSignal.timeout(40000) });
      const x = r.ok ? await r.json() : null;
      if (x && x.src === 'OANDA' && Array.isArray(x.bars)) j = x; else err = x && x.error ? String(x.error) : `HTTP ${r.status}`;
    } catch (e) { err = String(e.message || e); }
    if (!j) await new Promise((s) => setTimeout(s, 2000 * (k + 1)));
  }
  if (!j) throw new Error(`${new Date(a * 1000).toISOString()}: ${err}`);
  for (const x of j.bars) if (!x.live && x.time >= a && x.time < b && x.time >= FROM) m.set(+x.time, [+x.time, +x.open, +x.high, +x.low, +x.close]);
  process.stderr.write(`${new Date(a * 1000).toISOString().slice(0, 10)} ${m.size}\n`);
  a = b; await new Promise((s) => setTimeout(s, 300));
}
const rows = [...m.values()].sort((p, q) => p[0] - q[0]);
fs.writeFileSync(path.join(dir, 'xau-1h.json.gz'), zlib.gzipSync(JSON.stringify(rows)));
console.log(rows.length, 'candles', new Date(rows[0][0] * 1000).toISOString(), '->', new Date(rows.at(-1)[0] * 1000).toISOString());
