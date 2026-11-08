// Daily candle cache for research: keeps council-data research/daily/<sym>.json (OANDA D1 mid candles, full history, UTC days)
// for every market in api/_oanda.js, through the site's own keyless proxy (meridianx.dev/md/bars; no monthly cost), so studies
// can read daily data from /cdata/research/daily/<sym>.json without hitting OANDA. Run weekly by .github/workflows/daily-cache.yml.
//   node scripts/daily-cache.mjs <dataDir> [sym ...]          (dataDir = checkout of council-data; env MD_BASE overrides the proxy)
// File shape (compact, ~50 bytes a day): { sym, inst, tf: "D", src: "OANDA", updated, cols: ["t","o","h","l","c","v"], rows: [[unixSec, o, h, l, c, volume], ...] }
// Only complete candles are kept (no `live` bar). A re-run fetches from the last stored day minus a week and merges by time.
// research/daily/_index.json lists every symbol with rows / first / last / status, so a market OANDA does not serve shows up as
// status "error" with the proxy's message instead of failing the run.
import fs from 'node:fs';
import path from 'node:path';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';

const require = createRequire(import.meta.url);
const { SYM, GROUP } = require('../api/_oanda.js');
export const DAY = 86400, CAP = 4999, START = Date.UTC(2000, 0, 1) / 1000;   // OANDA answers at most 5000 candles a call
export const COLS = ['t', 'o', 'h', 'l', 'c', 'v'];

/** Windows of at most CAP days from `from` up to `to`: [[from, to], ...] */
export function windows(from, to) {
  const out = [];
  for (let a = from; a < to; a += CAP * DAY) out.push([a, Math.min(to, a + CAP * DAY)]);
  return out;
}
/** Merge candle rows by time (new rows win), sorted, complete candles only. */
export function merge(oldRows, bars) {
  const m = new Map(oldRows.map((r) => [r[0], r]));
  for (const b of bars) { if (b.live || !(b.time > 0)) continue; m.set(b.time, [b.time, b.open, b.high, b.low, b.close, b.volume || 0]); }
  return [...m.values()].sort((x, y) => x[0] - y[0]);
}
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
async function get(url, tries = 4) {
  let last = '';
  for (let k = 0; k < tries; k++) {
    try {
      const r = await fetch(url, { signal: AbortSignal.timeout(20000) });
      const j = await r.json().catch(() => ({}));
      if (r.ok) return j;
      last = `${r.status} ${j.error || ''}`.trim();
      if (r.status === 400) throw new Error(last);           // unknown sym / bad range: no point retrying
      if (r.status === 502 && /OANDA 4\d\d/.test(last)) throw new Error(last);   // OANDA rejects the instrument
    } catch (e) { if (/^(400|502) /.test(e.message)) throw e; last = e.message; }
    await sleep(1500 * (k + 1));
  }
  throw new Error(last || 'fetch failed');
}

/** Refresh one symbol's file; returns the index entry. */
export async function refresh(dir, sym, base, now = Math.floor(Date.now() / 1000)) {
  const file = path.join(dir, `${sym}.json`);
  let old = null; try { old = JSON.parse(fs.readFileSync(file, 'utf8')); } catch { /* new */ }
  let rows = Array.isArray(old?.rows) ? old.rows : [];
  const from = rows.length ? rows[rows.length - 1][0] - 7 * DAY : START;
  const entry = { inst: SYM[sym], group: GROUP[sym], rows: rows.length, first: rows[0]?.[0] ?? null, last: rows[rows.length - 1]?.[0] ?? null, status: 'ok' };
  try {
    for (const [a, b] of windows(from, now)) {
      const j = await get(`${base}?sym=${sym}&tf=D&from=${a}&to=${b}`);
      rows = merge(rows, j.bars || []);
    }
    fs.writeFileSync(file, JSON.stringify({ sym, inst: SYM[sym], tf: 'D', src: 'OANDA', updated: new Date(now * 1000).toISOString(), cols: COLS, rows }));
    Object.assign(entry, { rows: rows.length, first: rows[0]?.[0] ?? null, last: rows[rows.length - 1]?.[0] ?? null });
  } catch (e) { entry.status = 'error'; entry.error = String(e.message || e).slice(0, 200); }
  return entry;
}

export async function main(argv = process.argv.slice(2), base = process.env.MD_BASE || 'https://meridianx.dev/md/bars') {
  const [root, ...only] = argv;
  if (!root) { console.error('usage: daily-cache.mjs <dataDir> [sym ...]'); process.exit(1); }
  const dir = path.join(root, 'research', 'daily'); fs.mkdirSync(dir, { recursive: true });
  const syms = only.length ? only.filter((s) => SYM[s]) : Object.keys(SYM);
  const idxFile = path.join(dir, '_index.json');
  let idx = { symbols: {} }; try { idx = JSON.parse(fs.readFileSync(idxFile, 'utf8')); } catch { /* new */ }
  let i = 0, bad = 0;
  async function worker() {
    while (i < syms.length) {
      const s = syms[i++], e = await refresh(dir, s, base);
      idx.symbols[s] = e; if (e.status !== 'ok') bad++;
      console.log(s.padEnd(8), e.inst.padEnd(11), e.status === 'ok' ? `${e.rows} days, ${e.first ? new Date(e.first * 1000).toISOString().slice(0, 10) : '-'} .. ${e.last ? new Date(e.last * 1000).toISOString().slice(0, 10) : '-'}` : `ERROR ${e.error}`);
    }
  }
  await Promise.all(Array.from({ length: 3 }, worker));   // 3 at a time: well inside the /md 900 requests a minute limit
  idx.updated = new Date().toISOString(); idx.tf = 'D'; idx.src = 'OANDA via meridianx.dev/md/bars'; idx.cols = COLS;
  idx.symbols = Object.fromEntries(Object.entries(idx.symbols).sort());
  fs.writeFileSync(idxFile, JSON.stringify(idx, null, 1));
  console.log(`${syms.length - bad} ok, ${bad} failed`);
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) main();
