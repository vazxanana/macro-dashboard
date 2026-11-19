// Edge research · ecb-boj-days: OANDA mid M5 candles (whole day) through the site's keyless /md/bars proxy, the
// gotobi-replicate fetch.mjs pattern (pages of 4,999 candles, paced, progress saved per market).
//   node --use-env-proxy research/edge/ecb-boj-days/fetch.mjs <outDir> [endUnix]
// Writes <outDir>/eurusd-5m.json.gz and usdjpy-5m.json.gz (2009-11-01 -> end), rows [t, o, h, l, c]. A file already there is
// kept and only the stretches before its first and after its last candle are fetched (so a copy of another study's file
// can seed it). Keep the output out of git.
import fs from 'node:fs';
import path from 'node:path';
import zlib from 'node:zlib';

const [OUT, ENDARG] = process.argv.slice(2);
if (!OUT) throw new Error('usage: node fetch.mjs <outDir> [endUnix]');
const BASE = process.env.MD_BASE || 'https://meridianx.dev/md/';
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const T = (s) => Date.parse(s + 'T00:00:00Z') / 1000;
const SEC = 300, FROM = T('2009-11-01'), END = ENDARG ? +ENDARG : T('2026-11-14');

async function page(sym, a, b) {
  let err = null;
  for (let k = 0; k < 6; k++) {
    try {
      const r = await fetch(`${BASE}bars?sym=${sym}&tf=5m&from=${a}&to=${b}`, { signal: AbortSignal.timeout(30000) });
      const x = r.ok ? await r.json() : null;
      if (x && Array.isArray(x.bars)) return x.bars.filter((q) => !q.live && q.time >= a && q.time < b).map((q) => [+q.time, +q.open, +q.high, +q.low, +q.close]);
      err = x && x.error ? String(x.error) : `HTTP ${r.status}`;
    } catch (e) { err = String(e.message || e); }
    await sleep(2000 * (k + 1));
  }
  throw new Error(`${sym} ${new Date(a * 1000).toISOString()}: ${err}`);
}
async function span(sym, a, b) {
  let rows = [];
  for (let s = a; s < b; s += 4999 * SEC) {
    const e = Math.min(b, s + 4999 * SEC);
    rows = rows.concat(await page(sym, s, e));
    console.log(`${sym}: through ${new Date(e * 1000).toISOString().slice(0, 10)} (${rows.length} new candles)`);
    await sleep(400);
  }
  return rows;
}

fs.mkdirSync(OUT, { recursive: true });
for (const sym of ['eurusd', 'usdjpy']) {
  const f = path.join(OUT, `${sym}-5m.json.gz`);
  const have = fs.existsSync(f) ? JSON.parse(zlib.gunzipSync(fs.readFileSync(f))) : [];
  const first = have.length ? have[0][0] : END, last = have.length ? have.at(-1)[0] + SEC : END;
  const add = [...(first > FROM ? await span(sym, FROM, first) : []), ...(last < END ? await span(sym, last, END) : [])];
  const all = new Map(); for (const r of [...have, ...add]) all.set(r[0], r);
  const bars = [...all.values()].sort((p, q) => p[0] - q[0]);
  fs.writeFileSync(f, zlib.gzipSync(JSON.stringify(bars)));
  console.log(`${sym}: ${bars.length} candles ${new Date(bars[0][0] * 1000).toISOString().slice(0, 10)} -> ${new Date(bars.at(-1)[0] * 1000).toISOString().slice(0, 10)}`);
}
