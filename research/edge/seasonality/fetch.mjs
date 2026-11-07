// Edge research · seasonality: OANDA 5-minute mid candles for NAS100, SPX500 and XAU/USD through the site's free /md/bars
// proxy (keyless, no monthly cost), 2006-01-01 to OOS_TO (default 2026-11-07). UTC buckets as the proxy serves them.
//   [CANDLES_IN=<dir with xau-5m.json.gz from research/edge/gold-systems-oos>] node fetch.mjs <outDir> [sym ...]
// Output: <outDir>/<sym>-5m.json.gz = [[unixSec, o, h, l, c], ...], finished candles only, paged in windows of 4,999 candles.
// A cache in CANDLES_IN is reused and only the missing ends are fetched. Keep the output out of git.
import fs from 'node:fs';
import path from 'node:path';
import zlib from 'node:zlib';

const [OUT, ...SYMS0] = process.argv.slice(2);
if (!OUT) throw new Error('usage: node fetch.mjs <outDir> [sym ...]');
const SYMS = SYMS0.length ? SYMS0 : ['nas100', 'spx500', 'xau'];
const IN = process.env.CANDLES_IN || null, BASE = process.env.MD_BASE || 'https://meridianx.dev/md/';
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const T = (s) => Date.parse(s + 'T00:00:00Z') / 1000;
const FROM = T('2006-01-01'), END = T(process.env.OOS_TO || '2026-11-07'), SEC = 300;

async function range(sym, a0, b0) {
  const m = new Map();
  const wins = []; for (let a = a0; a < b0; a += 4999 * SEC) wins.push([a, Math.min(b0, a + 4999 * SEC)]);
  let i = 0;
  async function worker() {
    while (i < wins.length) {
      const [a, b] = wins[i++]; let j = null, err = null;
      for (let k = 0; k < 6 && !j; k++) {
        try { const r = await fetch(`${BASE}bars?sym=${sym}&tf=5m&from=${a}&to=${b}`, { signal: AbortSignal.timeout(40000) }); const x = r.ok ? await r.json() : null;
          if (x && x.src === 'OANDA' && Array.isArray(x.bars)) j = x; else err = x && x.error ? String(x.error) : `HTTP ${r.status}`; }
        catch (e) { err = String(e.message || e); }
        if (!j) await sleep(1500 * (k + 1));
      }
      if (!j) throw new Error(`${sym} 5m ${new Date(a * 1000).toISOString()}: ${err}`);
      for (const x of j.bars) if (!x.live && x.time >= a && x.time < b) m.set(+x.time, [+x.time, +x.open, +x.high, +x.low, +x.close]);
    }
  }
  await Promise.all(Array.from({ length: 4 }, worker));
  return [...m.values()];
}
fs.mkdirSync(OUT, { recursive: true });
for (const sym of SYMS) {
  const f = path.join(OUT, `${sym}-5m.json.gz`);
  if (fs.existsSync(f)) { console.log(`${sym}: ${f} exists`); continue; }
  const cf = IN && path.join(IN, `${sym}-5m.json.gz`);
  const have = cf && fs.existsSync(cf) ? JSON.parse(zlib.gunzipSync(fs.readFileSync(cf))) : [];
  const first = have.length ? have[0][0] : END, last = have.length ? have.at(-1)[0] + SEC : FROM;
  const pre = first > FROM ? await range(sym, FROM, first) : [];
  const post = last < END ? await range(sym, last, END) : [];
  const all = new Map(); for (const r of [...pre, ...have, ...post]) if (r[0] >= FROM && r[0] < END) all.set(r[0], r);
  const bars = [...all.values()].sort((p, q) => p[0] - q[0]);
  fs.writeFileSync(f, zlib.gzipSync(JSON.stringify(bars)));
  console.log(`${sym}: ${bars.length} candles ${new Date(bars[0][0] * 1000).toISOString().slice(0, 10)} → ${new Date(bars.at(-1)[0] * 1000).toISOString().slice(0, 10)}`);
}
