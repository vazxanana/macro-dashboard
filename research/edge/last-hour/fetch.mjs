// Edge research · last-hour: OANDA mid M5 candles of nas100, spx500 and us30 through the site's keyless candle proxy
// (/md/bars), complete candles only, 4999-candle windows, paced. Same file format as research/edge/pre-fomc-drift and
// intraday-momentum (<market>-5m.json.gz, rows [t, o, h, l, c]), so a cache made there is reused as it is.
//   node --use-env-proxy research/edge/last-hour/fetch.mjs <outDir> [market ...]
// Progress is saved per market in <outDir>/<market>-5m.part.json (resumes after an interruption). Keep the output out of git.
import fs from 'node:fs';
import path from 'node:path';
import zlib from 'node:zlib';

const [OUT, ...ONLY] = process.argv.slice(2);
if (!OUT) throw new Error('usage: node fetch.mjs <outDir> [market ...]');
const BASE = process.env.MD_BASE || 'https://meridianx.dev/md/';
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const T = (s) => Date.parse(s + 'T00:00:00Z') / 1000;
const FROM = T('2009-10-01'), END = T('2026-11-13'), SEC = 300;

async function range(sym, part) {
  const st = fs.existsSync(part) ? JSON.parse(fs.readFileSync(part, 'utf8')) : { next: FROM, rows: [] };
  for (let a = st.next; a < END;) {
    const b = Math.min(END, a + 4999 * SEC);
    let j = null, err = null;
    for (let k = 0; k < 6 && !j; k++) {
      try {
        const r = await fetch(`${BASE}bars?sym=${sym}&tf=5m&from=${a}&to=${b}`, { signal: AbortSignal.timeout(40000) });
        const x = r.ok ? await r.json() : null;
        if (x && x.src === 'OANDA' && Array.isArray(x.bars)) j = x; else err = x && x.error ? String(x.error) : `HTTP ${r.status}`;
      } catch (e) { err = String(e.message || e); }
      if (!j) await sleep(2000 * (k + 1));
    }
    if (!j) throw new Error(`${sym} ${new Date(a * 1000).toISOString()}: ${err}`);
    for (const x of j.bars) if (!x.live && x.time >= a && x.time < b) st.rows.push([+x.time, +x.open, +x.high, +x.low, +x.close]);
    a = b; st.next = b;
    fs.writeFileSync(part, JSON.stringify(st));
    await sleep(150);
  }
  const m = new Map(st.rows.map((r) => [r[0], r]));
  return [...m.values()].sort((p, q) => p[0] - q[0]);
}
fs.mkdirSync(OUT, { recursive: true });
for (const sym of ['nas100', 'spx500', 'us30']) {
  if (ONLY.length && !ONLY.includes(sym)) continue;
  const f = path.join(OUT, `${sym}-5m.json.gz`), part = path.join(OUT, `${sym}-5m.part.json`);
  if (fs.existsSync(f)) { console.log(`${sym}: exists`); continue; }
  const bars = await range(sym, part);
  fs.writeFileSync(f, zlib.gzipSync(JSON.stringify(bars)));
  fs.rmSync(part, { force: true });
  console.log(`${sym}: ${bars.length} candles ${new Date(bars[0][0] * 1000).toISOString().slice(0, 10)} → ${new Date(bars.at(-1)[0] * 1000).toISOString().slice(0, 10)}`);
}
