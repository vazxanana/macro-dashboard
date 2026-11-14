// Edge research · gotobi: OANDA mid M5 candles of USD/JPY and EUR/JPY through the site's keyless /md/bars proxy.
//   [CANDLES_IN=<dir with usdjpy-5m.json.gz, eurjpy-5m.json.gz>] node --use-env-proxy research/edge/gotobi/fetch.mjs <outDir>
// Reuses the cache when given and fetches only what it lacks before its first candle (from FROM). Progress is saved per
// market after every page (<outDir>/<sym>-pre.part.json), so a stopped run picks up where it was. Finished candles only,
// rows [t, o, h, l, c], windows of 4,999 candles, paced. Keep the output out of git.
import fs from 'node:fs';
import path from 'node:path';
import zlib from 'node:zlib';

const [OUT] = process.argv.slice(2);
if (!OUT) throw new Error('usage: node fetch.mjs <outDir>');
const IN = process.env.CANDLES_IN || null, BASE = process.env.MD_BASE || 'https://meridianx.dev/md/';
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const T = (s) => Date.parse(s + 'T00:00:00Z') / 1000;
const FROM = T('2009-11-01'), SEC = 300;
export const SYMS = ['usdjpy', 'eurjpy'];

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

fs.mkdirSync(OUT, { recursive: true });
for (const sym of SYMS) {
  const f = path.join(OUT, `${sym}-5m.json.gz`);
  if (fs.existsSync(f)) { console.log(`${sym}: ${f} exists`); continue; }
  const cf = IN && path.join(IN, `${sym}-5m.json.gz`);
  const have = cf && fs.existsSync(cf) ? JSON.parse(zlib.gunzipSync(fs.readFileSync(cf))) : [];
  const end = have.length ? have[0][0] : Math.floor(Date.now() / 1000 / SEC) * SEC - SEC;
  const part = path.join(OUT, `${sym}-pre.part.json`);
  let st = fs.existsSync(part) ? JSON.parse(fs.readFileSync(part, 'utf8')) : { next: FROM, rows: [] };
  while (st.next < end) {
    const b = Math.min(end, st.next + 4999 * SEC);
    const rows = await page(sym, st.next, b);
    st = { next: b, rows: st.rows.concat(rows) };
    fs.writeFileSync(part, JSON.stringify(st));
    console.log(`${sym}: through ${new Date(b * 1000).toISOString().slice(0, 10)} (${st.rows.length} candles)`);
    await sleep(400);
  }
  const all = new Map(); for (const r of [...st.rows, ...have]) all.set(r[0], r);
  const bars = [...all.values()].sort((p, q) => p[0] - q[0]);
  fs.writeFileSync(f, zlib.gzipSync(JSON.stringify(bars)));
  fs.rmSync(part, { force: true });
  console.log(`${sym}: ${bars.length} candles ${new Date(bars[0][0] * 1000).toISOString().slice(0, 10)} -> ${new Date(bars.at(-1)[0] * 1000).toISOString().slice(0, 10)}`);
}
