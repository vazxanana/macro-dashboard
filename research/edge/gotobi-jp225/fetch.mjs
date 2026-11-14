// Edge research · gotobi-jp225: OANDA mid M5 candles of JP225 (JP225_USD) through the site's keyless /md/bars proxy, the
// gotobi branch's fetch.mjs pattern (pages of 4,999 candles, paced, progress saved). Only candles that start between 00:00 and
// 06:55 UTC are kept (the fade window 00:55-06:00 UTC and its 20-day lookback read nothing else). Keep the output out of git.
//   node --use-env-proxy research/edge/gotobi-jp225/fetch.mjs <outDir> [sym=jp225]
import fs from 'node:fs';
import path from 'node:path';
import zlib from 'node:zlib';

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const T = (s) => Date.parse(s + 'T00:00:00Z') / 1000;
const SEC = 300;
export const KEEP = (t) => (t % 86400) < 7 * 3600;   // candles starting 00:00-06:55 UTC

async function page(base, sym, a, b) {
  let err = null;
  for (let k = 0; k < 6; k++) {
    try {
      const r = await fetch(`${base}bars?sym=${sym}&tf=5m&from=${a}&to=${b}`, { signal: AbortSignal.timeout(30000) });
      const x = r.ok ? await r.json() : null;
      if (x && Array.isArray(x.bars)) return x.bars.filter((q) => !q.live && q.time >= a && q.time < b).map((q) => [+q.time, +q.open, +q.high, +q.low, +q.close]);
      err = x && x.error ? String(x.error) : `HTTP ${r.status}`;
    } catch (e) { err = String(e.message || e); }
    await sleep(2000 * (k + 1));
  }
  throw new Error(`${sym} ${new Date(a * 1000).toISOString()}: ${err}`);
}

async function main() {
  const [OUT, SYM = 'jp225'] = process.argv.slice(2);
  if (!OUT) throw new Error('usage: node fetch.mjs <outDir> [sym]');
  const BASE = process.env.MD_BASE || 'https://meridianx.dev/md/';
  const FROM = T(process.env.FROM || '2009-11-01'), END = T(process.env.END || '2026-11-13');
  fs.mkdirSync(OUT, { recursive: true });
  const f = path.join(OUT, `${SYM}-5m.json.gz`), part = path.join(OUT, `${SYM}.part.json`);
  if (fs.existsSync(f)) { console.log(`${f} exists`); return; }
  let st = fs.existsSync(part) ? JSON.parse(fs.readFileSync(part, 'utf8')) : { next: FROM, rows: [] };
  while (st.next < END) {
    const b = Math.min(END, st.next + 4999 * SEC);
    const rows = (await page(BASE, SYM, st.next, b)).filter((r) => KEEP(r[0]));
    st = { next: b, rows: st.rows.concat(rows) };
    fs.writeFileSync(part, JSON.stringify(st));
    console.log(`${SYM}: through ${new Date(b * 1000).toISOString().slice(0, 10)} (${st.rows.length} candles kept)`);
    await sleep(400);
  }
  const all = new Map(); for (const r of st.rows) all.set(r[0], r);
  const bars = [...all.values()].sort((p, q) => p[0] - q[0]);
  fs.writeFileSync(f, zlib.gzipSync(JSON.stringify(bars)));
  fs.rmSync(part, { force: true });
  console.log(`${SYM}: ${bars.length} candles ${new Date(bars[0][0] * 1000).toISOString().slice(0, 10)} -> ${new Date(bars.at(-1)[0] * 1000).toISOString().slice(0, 10)}`);
}

if (process.argv[1] && path.resolve(process.argv[1]).endsWith(path.join('gotobi-jp225', 'fetch.mjs'))) main();
