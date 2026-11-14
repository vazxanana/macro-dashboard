// Edge research · fx-cycle: OANDA mid H1 candles of the five forex majors through the site's keyless candle proxy (/md/bars),
// 1 Jan 2008 to the last complete candle. Complete candles only, UTC buckets as the proxy serves them.
//   node --use-env-proxy fetch.mjs <outDir> [market ...]
// Files <market>-1h.json.gz, rows [t, o, h, l, c] (t = the candle's UTC start); progress per market in <market>-1h.part.json.
// Keep the output out of git.
import fs from 'node:fs';
import path from 'node:path';
import zlib from 'node:zlib';

export const MARKETS = ['eurusd', 'gbpusd', 'usdjpy', 'audusd', 'usdcad'];
const [OUT, ...ONLY] = process.argv.slice(2);
if (!OUT) throw new Error('usage: node fetch.mjs <outDir> [market ...]');
const BASE = process.env.MD_BASE || 'https://meridianx.dev/md/';
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const FROM = Date.parse('2008-01-01T00:00:00Z') / 1000;
const END = Math.floor(Date.parse(process.env.FX_END || '2026-11-13T21:00:00Z') / 1000);

fs.mkdirSync(OUT, { recursive: true });
for (const sym of MARKETS) {
  if (ONLY.length && !ONLY.includes(sym)) continue;
  const f = path.join(OUT, `${sym}-1h.json.gz`), part = path.join(OUT, `${sym}-1h.part.json`);
  if (fs.existsSync(f)) { console.log(`${sym}: exists`); continue; }
  const st = fs.existsSync(part) ? JSON.parse(fs.readFileSync(part, 'utf8')) : { a: FROM, rows: [] };
  const m = new Map(st.rows.map((r) => [r[0], r]));
  for (let a = st.a; a < END;) {
    const b = Math.min(END, a + 4999 * 3600);
    let j = null, err = null;
    for (let k = 0; k < 6 && !j; k++) {
      try {
        const r = await fetch(`${BASE}bars?sym=${sym}&tf=1h&from=${a}&to=${b}`, { signal: AbortSignal.timeout(40000) });
        const x = r.ok ? await r.json() : null;
        if (x && x.src === 'OANDA' && Array.isArray(x.bars)) j = x; else err = x && x.error ? String(x.error) : `HTTP ${r.status}`;
      } catch (e) { err = String(e.message || e); }
      if (!j) await sleep(2000 * (k + 1));
    }
    if (!j) throw new Error(`${sym} ${new Date(a * 1000).toISOString()}: ${err}`);
    for (const x of j.bars) if (!x.live && x.time >= a && x.time < b && x.time + 3600 <= END) m.set(+x.time, [+x.time, +x.open, +x.high, +x.low, +x.close]);
    a = b;
    fs.writeFileSync(part, JSON.stringify({ a, rows: [...m.values()] }));
    await sleep(600);
  }
  const bars = [...m.values()].sort((p, q) => p[0] - q[0]);
  fs.writeFileSync(f, zlib.gzipSync(JSON.stringify(bars)));
  fs.rmSync(part, { force: true });
  console.log(`${sym}: ${bars.length} candles ${new Date(bars[0][0] * 1000).toISOString().slice(0, 10)} → ${new Date(bars.at(-1)[0] * 1000).toISOString().slice(0, 16)}`);
}
