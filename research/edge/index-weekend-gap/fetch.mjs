// Edge research · index-weekend-gap: OANDA mid M5 candles of spx500, nas100 and us30 through the site's keyless candle proxy
// (/md/bars), 1 Oct 2007 to 14 Nov 2026, complete candles only, UTC buckets as the proxy serves them. The pattern of
// research/edge/gap-fill/fetch.mjs (pages of 4,999 candles, paced), with progress saved per market so a cut run resumes.
//   node --use-env-proxy research/edge/index-weekend-gap/fetch.mjs <outDir> [market ...]   (files <market>-5m.json.gz, rows [t,o,h,l,c])
// Keep the output out of the repository.
import fs from 'node:fs';
import path from 'node:path';
import zlib from 'node:zlib';

const [OUT, ...ONLY] = process.argv.slice(2);
if (!OUT) throw new Error('usage: node fetch.mjs <outDir> [market ...]');
const BASE = process.env.MD_BASE || 'https://meridianx.dev/md/';
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const T = (s) => Date.parse(s + 'T00:00:00Z') / 1000;
const FROM = T('2007-10-01'), END = T('2026-11-14'), SEC = 300;

async function page(sym, a, b) {
  let err = null;
  for (let k = 0; k < 6; k++) {
    try {
      const r = await fetch(`${BASE}bars?sym=${sym}&tf=5m&from=${a}&to=${b}`, { signal: AbortSignal.timeout(40000) });
      const x = r.ok ? await r.json() : null;
      if (x && x.src === 'OANDA' && Array.isArray(x.bars)) return x.bars.filter((q) => !q.live && q.time >= a && q.time < b).map((q) => [+q.time, +q.open, +q.high, +q.low, +q.close]);
      err = x && x.error ? String(x.error) : `HTTP ${r.status}`;
    } catch (e) { err = String(e.message || e); }
    await sleep(2000 * (k + 1));
  }
  throw new Error(`${sym} ${new Date(a * 1000).toISOString()}: ${err}`);
}

fs.mkdirSync(OUT, { recursive: true });
for (const sym of ['spx500', 'nas100', 'us30']) {
  if (ONLY.length && !ONLY.includes(sym)) continue;
  const f = path.join(OUT, `${sym}-5m.json.gz`);
  if (fs.existsSync(f)) { console.log(`${sym}: exists`); continue; }
  const part = path.join(OUT, `${sym}.part.json`);
  let st = fs.existsSync(part) ? JSON.parse(fs.readFileSync(part, 'utf8')) : { next: FROM, rows: [] }, n = 0;
  while (st.next < END) {
    const b = Math.min(END, st.next + 4999 * SEC);
    st = { next: b, rows: st.rows.concat(await page(sym, st.next, b)) };
    if (++n % 25 === 0) { fs.writeFileSync(part, JSON.stringify(st)); console.log(`${sym}: through ${new Date(b * 1000).toISOString().slice(0, 10)} (${st.rows.length})`); }
    await sleep(150);
  }
  const m = new Map(); for (const r of st.rows) m.set(r[0], r);
  const bars = [...m.values()].sort((p, q) => p[0] - q[0]);
  fs.writeFileSync(f, zlib.gzipSync(JSON.stringify(bars)));
  fs.rmSync(part, { force: true });
  console.log(`${sym}: ${bars.length} candles ${new Date(bars[0][0] * 1000).toISOString().slice(0, 10)} → ${new Date(bars.at(-1)[0] * 1000).toISOString().slice(0, 10)}`);
}
