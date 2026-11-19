// Edge research · fx-home-hours: OANDA mid M5 candles through the site's keyless /md/bars proxy (the gotobi-replicate
// fetch.mjs pattern: pages of 4,999 candles, paced, progress saved per market). Whole days are kept (the H1 ATR reads the
// hours before each window).
//   node --use-env-proxy research/edge/fx-home-hours/fetch.mjs <outDir> [seedDir ...]
// Writes <outDir>/<sym>-5m.json.gz ([[unixSec, o, h, l, c], ...]) for eurusd, usdjpy, gbpusd, audusd, 1 Nov 2009 -> 1 Nov
// 2026. A seed dir holding <sym>-5m.json.gz in the same shape (another study's copy from the same proxy) is reused: its
// candles inside the span are kept and only the missing span before / after it is fetched. Keep the output out of git.
import fs from 'node:fs';
import path from 'node:path';
import zlib from 'node:zlib';

const [OUT, ...SEEDS] = process.argv.slice(2);
if (!OUT) throw new Error('usage: node fetch.mjs <outDir> [seedDir ...]');
const BASE = process.env.MD_BASE || 'https://meridianx.dev/md/';
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const T = (s) => Date.parse(s + 'T00:00:00Z') / 1000;
const SEC = 300, FROM = T('2009-11-01'), TO = T('2026-11-01');
const SYMS = process.env.SYMS ? process.env.SYMS.split(',') : ['eurusd', 'usdjpy', 'gbpusd', 'audusd'];

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

async function span(sym, a, b, tag) {
  let rows = [];
  for (let t = a; t < b;) {
    const e = Math.min(b, t + 4999 * SEC);
    rows = rows.concat(await page(sym, t, e));
    console.log(`${sym} ${tag}: through ${new Date(e * 1000).toISOString().slice(0, 10)} (${rows.length} candles)`);
    t = e; await sleep(400);
  }
  return rows;
}

fs.mkdirSync(OUT, { recursive: true });
for (const sym of SYMS) {
  const f = path.join(OUT, `${sym}-5m.json.gz`);
  if (fs.existsSync(f)) { console.log(`${sym}: ${f} exists`); continue; }
  let seed = [];
  for (const d of SEEDS) {
    const s = path.join(d, `${sym}-5m.json.gz`);
    if (fs.existsSync(s)) { seed = JSON.parse(zlib.gunzipSync(fs.readFileSync(s))).filter((r) => r[0] >= FROM && r[0] < TO); console.log(`${sym}: seed ${s} (${seed.length} candles)`); break; }
  }
  let rows = seed;
  if (!seed.length) rows = await span(sym, FROM, TO, 'all');
  else {
    const a = seed[0][0], z = seed.at(-1)[0] + SEC;
    if (a - FROM > 86400) rows = (await span(sym, FROM, a, 'before')).concat(rows);
    if (TO - z > 86400) rows = rows.concat(await span(sym, z, TO, 'after'));
  }
  const all = new Map(); for (const r of rows) all.set(r[0], r);
  const bars = [...all.values()].sort((p, q) => p[0] - q[0]);
  fs.writeFileSync(f, zlib.gzipSync(JSON.stringify(bars)));
  console.log(`${sym}: ${bars.length} candles ${new Date(bars[0][0] * 1000).toISOString().slice(0, 10)} -> ${new Date(bars.at(-1)[0] * 1000).toISOString().slice(0, 10)}`);
}
