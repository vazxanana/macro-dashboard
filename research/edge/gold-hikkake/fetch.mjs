// Edge research · gold-hikkake: OANDA mid H1 XAU_USD through the site's keyless candle proxy (/md/bars), March 2006 to now.
//   node --use-env-proxy research/edge/gold-hikkake/fetch.mjs <dir>     -> <dir>/xau-h1.json, rows [t, o, h, l, c] (keep out of git)
import fs from 'node:fs';
import path from 'node:path';

const H = 3600, BASE = process.env.MD_BASE || 'https://meridianx.dev/md/';
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const dir = process.argv[2];
if (!dir) throw new Error('usage: node fetch.mjs <dir>');
fs.mkdirSync(dir, { recursive: true });
const now = Math.floor(Date.now() / 1000), m = new Map();
for (let a = Math.floor(Date.parse('2006-01-01T00:00:00Z') / 1000); a < now;) {
  const b = Math.min(now, a + 4990 * H);
  let j = null, err = null;
  for (let k = 0; k < 6 && !j; k++) {
    try { const r = await fetch(`${BASE}bars?sym=xau&tf=1h&from=${a}&to=${b}`, { signal: AbortSignal.timeout(40000) }); const x = r.ok ? await r.json() : null;
      if (x && Array.isArray(x.bars)) j = x; else err = x && x.error ? String(x.error) : `HTTP ${r.status}`; }
    catch (e) { err = String(e.message || e); }
    if (!j) await sleep(2500 * (k + 1));
  }
  if (!j) throw new Error(`${new Date(a * 1000).toISOString()}: ${err}`);
  for (const x of j.bars) if (!x.live && x.time >= a && x.time < b) m.set(+x.time, [+x.time, +x.open, +x.high, +x.low, +x.close]);
  process.stderr.write(`${new Date(a * 1000).toISOString().slice(0, 10)} ${m.size}\n`);
  a = b; await sleep(2200);
}
const rows = [...m.values()].sort((p, q) => p[0] - q[0]);
fs.writeFileSync(path.join(dir, 'xau-h1.json'), JSON.stringify(rows));
console.log(`xau 1h: ${rows.length} candles ${new Date(rows[0][0] * 1000).toISOString()} -> ${new Date(rows.at(-1)[0] * 1000).toISOString()}`);
