// RESEARCH ONLY (ICT edge): Dukascopy index CFD 1m → 5m candles, one gzip JSON per symbol and year.
import fs from 'node:fs'; import zlib from 'node:zlib';
import { dukaMinutes, dukaReset } from '../council/duka.mjs';
const [sym, y, out] = process.argv.slice(2);
const T = (s) => Date.parse(s + 'T00:00:00Z') / 1000;
const from = T(`${y}-01-01`), to = Math.min(T(`${+y + 1}-01-01`), Math.floor(Date.now() / 86400000) * 86400);
let m5 = new Map(), n = 0;
for (let d = from; d < to; d += 7 * 86400) {
  dukaReset();
  try { const b = await dukaMinutes(sym, d, Math.min(d + 7 * 86400, to), 1e3); n += b.length;
    for (const x of b) { const k = Math.floor(x.time / 300) * 300, c = m5.get(k);
      if (!c) m5.set(k, [k, x.open, x.high, x.low, x.close]); else { c[2] = Math.max(c[2], x.high); c[3] = Math.min(c[3], x.low); c[4] = x.close; } }
    console.log(sym, new Date(d * 1000).toISOString().slice(0, 10), b.length, b[0] && b[0].close);
  } catch (e) { console.log('fail', sym, new Date(d * 1000).toISOString().slice(0, 10), e.message); }
}
const rows = [...m5.values()].sort((a, b) => a[0] - b[0]);
fs.writeFileSync(out, zlib.gzipSync(JSON.stringify(rows)));
console.log('done', sym, y, 'm1', n, 'm5', rows.length);
