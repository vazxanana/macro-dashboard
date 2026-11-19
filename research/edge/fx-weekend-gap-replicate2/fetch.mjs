// Edge research · fx-weekend-gap-replicate2: OANDA mid M5 candles through the site's keyless candle proxy (/md/bars) (the
// fetch of fx-weekend-gap-replicate, #928, with its sets changed): S1 = #928's six crosses 1 Nov 2009 to 11 Jan 2020; S2 = six
// pairs neither study used, 1 Nov 2015 to 14 Nov 2026; GATE = #880's six majors 1 Nov 2015 to 13 Nov 2026 (the gate files).
// Complete candles only; a window whose answer is not OANDA's is retried, then the run stops.
//   node --use-env-proxy fetch.mjs <outDir>      (files <pair>-5m.json.gz, rows [t, o, h, l, c]; keep them out of git)
import fs from 'node:fs';
import path from 'node:path';
import zlib from 'node:zlib';

const OUT = process.argv[2];
const ONLY = process.argv[3] ? process.argv[3].split(',') : null;
if (!OUT) throw new Error('usage: node fetch.mjs <outDir>');
const BASE = process.env.MD_BASE || 'https://meridianx.dev/md/';
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const T = (s) => Date.parse(s + 'T00:00:00Z') / 1000;
export const SETS = {
  S1: { pairs: ['eurgbp', 'gbpjpy', 'audjpy', 'euraud', 'gbpaud', 'eurchf'], from: T('2009-11-01'), to: T('2020-01-11') },
  S2: { pairs: ['nzdusd', 'usdcad', 'cadjpy', 'nzdjpy', 'audnzd', 'audcad'], from: T('2015-11-01'), to: T('2026-11-14') },
  GATE: { pairs: ['eurusd', 'gbpusd', 'usdjpy', 'audusd', 'usdchf', 'eurjpy'], from: T('2015-11-01'), to: T('2026-11-13') },
};
const SEC = 300;

async function range(sym, from, to) {
  const m = new Map();
  for (let a = from; a < to;) {
    const b = Math.min(to, a + 4999 * SEC);
    let j = null, err = null;
    for (let k = 0; k < 6 && !j; k++) {
      try { const r = await fetch(`${BASE}bars?sym=${sym}&tf=5m&from=${a}&to=${b}`, { signal: AbortSignal.timeout(40000) }); const x = r.ok ? await r.json() : null;
        if (x && x.src === 'OANDA' && Array.isArray(x.bars)) j = x; else err = x && x.error ? String(x.error) : `HTTP ${r.status}`; }
      catch (e) { err = String(e.message || e); }
      if (!j) await sleep(2000 * (k + 1));
    }
    if (!j) throw new Error(`${sym} ${new Date(a * 1000).toISOString()}: ${err}`);
    for (const x of j.bars) if (!x.live && x.time >= a && x.time < b) m.set(+x.time, [+x.time, +x.open, +x.high, +x.low, +x.close]);
    a = b; await sleep(120);
  }
  return [...m.values()].sort((p, q) => p[0] - q[0]);
}
fs.mkdirSync(OUT, { recursive: true });
for (const [set, { pairs, from, to }] of Object.entries(SETS)) for (const p of pairs) {
  if (ONLY && !ONLY.includes(set)) continue;
  const f = path.join(OUT, `${set}-${p}-5m.json.gz`);
  if (fs.existsSync(f)) { console.log(`${set} ${p}: exists`); continue; }
  const bars = await range(p, from, to);
  fs.writeFileSync(f, zlib.gzipSync(JSON.stringify(bars)));
  console.log(`${set} ${p}: ${bars.length} candles ${new Date(bars[0][0] * 1000).toISOString().slice(0, 10)} → ${new Date(bars.at(-1)[0] * 1000).toISOString().slice(0, 10)}`);
}
