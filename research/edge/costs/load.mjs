// HistData M1 loader (BID quotes, New York local time with DST → UTC). Files from council-data research/candles/,
// extracted with: git archive -o c.tar origin/council-data research/candles/<DIR> ... ; tar -xf c.tar
import fs from 'node:fs';
import path from 'node:path';
import zlib from 'node:zlib';
import { histToUtc } from '../../../council/histdata.mjs';   // HistData clock: UTC-5, UTC-4 in Europe's summer (2018: New York time)

export const DIRS = { XAUUSD: 'xau-histdata', NSXUSD: 'nsxusd-histdata', SPXUSD: 'spxusd-histdata' };
export function loadM1(root, sym, y0, y1) {
  const dir = path.join(root, 'research', 'candles', DIRS[sym] || sym);
  const files = fs.readdirSync(dir).filter((f) => f.endsWith('.csv.gz')).filter((f) => { const y = +f.match(/_M1_(\d{4})/)[1]; return y >= y0 && y <= y1; }).sort();
  const T = [], O = [], H = [], L = [], C = [];
  for (const f of files) {
    const txt = zlib.gunzipSync(fs.readFileSync(path.join(dir, f))).toString();
    let i = 0;
    while (i < txt.length) {
      let j = txt.indexOf('\n', i); if (j < 0) j = txt.length;
      const ln = txt.slice(i, j); i = j + 1;
      if (ln.length < 20) continue;
      const p = ln.split(';');
      const d = p[0];
      T.push(histToUtc(+d.slice(0, 4), +d.slice(4, 6), +d.slice(6, 8), +d.slice(9, 11), +d.slice(11, 13)));
      O.push(+p[1]); H.push(+p[2]); L.push(+p[3]); C.push(+p[4]);
    }
  }
  // sort + dedupe (DST fall-back hour can duplicate stamps)
  const idx = T.map((_, k) => k).sort((a, b) => T[a] - T[b]);
  const bars = []; let last = -1;
  for (const k of idx) { if (T[k] === last) continue; last = T[k]; bars.push({ time: T[k], open: O[k], high: H[k], low: L[k], close: C[k] }); }
  return bars;
}
export function aggregate(m1, sec) {
  const out = []; let cur = null;
  for (const b of m1) {
    const t0 = Math.floor(b.time / sec) * sec;
    if (!cur || cur.time !== t0) { cur = { time: t0, open: b.open, high: b.high, low: b.low, close: b.close }; out.push(cur); }
    else { if (b.high > cur.high) cur.high = b.high; if (b.low < cur.low) cur.low = b.low; cur.close = b.close; }
  }
  return out;
}
