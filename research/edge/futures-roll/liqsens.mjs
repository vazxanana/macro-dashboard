// liquidFrom's cut day for several thresholds on the dumped CNBC 1H (halt / shut hours dropped as cnbcBars does).
// node liqsens.mjs <cnbc.json.gz>
import fs from 'node:fs';
import zlib from 'node:zlib';
import { inHalt, cmeShut } from '../../../ict/tracker.mjs';
import { liquidFrom, LIQ } from '../../../ict/replay.mjs';
const S = JSON.parse(zlib.gunzipSync(fs.readFileSync(process.argv[2]))).series;
const base = LIQ.min;
for (const sym of ['@ND.1', '@SP.1', '@DJ.1', '@TFS.1', '@GC.1']) {
  const h1 = S[`${sym}|1H|adjusted`].filter((b) => !inHalt(b[0]) && !cmeShut(b[0])).map((b) => ({ time: b[0], open: b[1], high: b[2], low: b[3], close: b[4], volume: b[5] }));
  const row = [0.05, 0.07, 0.1, 0.2, 0.3, 0.5].map((m) => { LIQ.min = m; const t = liquidFrom(h1); return `${m}:${t ? new Date(t * 1000).toISOString().slice(0, 10) : '-'}`; });
  console.log(sym.padEnd(7), row.join('  '));
}
LIQ.min = base;
