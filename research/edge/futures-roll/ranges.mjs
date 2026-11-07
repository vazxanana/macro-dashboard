// H1 candle ranges of the dumped CNBC contract vs OANDA cash in the same hour, by month: a deferred contract's thin prints show up as
// a range ratio well below 1 (and many hours missing). node ranges.mjs <cnbc.json.gz> <oanda dir> [out.json]
import fs from 'node:fs';
import zlib from 'node:zlib';
import { inHalt, cmeShut } from '../../../ict/tracker.mjs';
const [DUMP, OA, OUT] = process.argv.slice(2);
const S = JSON.parse(zlib.gunzipSync(fs.readFileSync(DUMP))).series;
const med = (a) => { const s = [...a].sort((x, y) => x - y); return s.length ? s[s.length >> 1] : null; };
const out = {};
for (const [k, sym] of [['nq', '@ND.1'], ['es', '@SP.1'], ['ym', '@DJ.1'], ['gc', '@GC.1']]) {
  const O = new Map(JSON.parse(fs.readFileSync(`${OA}/${k}-1h.json`)).map((b) => [b[0], b]));
  const M = new Map();
  for (const b of S[`${sym}|1H|adjusted`].filter((x) => !inHalt(x[0]) && !cmeShut(x[0]))) { const o = O.get(b[0]); if (!o || o[2] - o[3] <= 0) continue;
    const m = new Date(b[0] * 1000).toISOString().slice(0, 7); (M.get(m) || M.set(m, []).get(m)).push((b[2] - b[3]) / (o[2] - o[3])); }
  const cash = [...O.values()].filter((b) => !inHalt(b[0]) && !cmeShut(b[0])), have = new Set(S[`${sym}|1H|adjusted`].map((b) => b[0]));
  out[k] = [...M].filter(([m]) => m >= '2026-03').map(([m, r]) => { const hrs = cash.filter((b) => new Date(b[0] * 1000).toISOString().slice(0, 7) === m);
    return { month: m, rangeRatio: +med(r).toFixed(2), hoursPresent: +(100 * hrs.filter((b) => have.has(b[0])).length / hrs.length).toFixed(0) }; });
  console.log(k.padEnd(3), out[k].map((x) => `${x.month.slice(2)} ${x.rangeRatio}/${x.hoursPresent}%`).join(' | '));
}
if (OUT) fs.writeFileSync(OUT, JSON.stringify(out, null, 1));
