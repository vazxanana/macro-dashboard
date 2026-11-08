// How thin is the current contract's own intraday history before it became the front month? Per week: H1 candles present per
// trading day, median hourly volume, and flat candles (open = high = low = close), from the dumped CNBC 1H of '.1' (the contract that
// is front at dump time). node liquidity.mjs <cnbc.json.gz> [out.json]
import fs from 'node:fs';
import zlib from 'node:zlib';
import { inHalt, cmeShut } from '../../../ict/tracker.mjs';
const [DUMP, OUT] = process.argv.slice(2);
const S = JSON.parse(zlib.gunzipSync(fs.readFileSync(DUMP))).series;
const med = (a) => { const s = [...a].sort((x, y) => x - y); return s.length ? s[s.length >> 1] : 0; };
const wk = (t) => new Date((Math.floor((t / 86400 + 3) / 7) * 7 - 3) * 86400e3).toISOString().slice(0, 10);   // Monday
const out = {};
for (const sym of ['@ND.1', '@SP.1', '@DJ.1', '@TFS.1', '@GC.1']) {
  const h = (S[`${sym}|1H|adjusted`] || []).filter((b) => !inHalt(b[0]) && !cmeShut(b[0]));
  const W = new Map(); for (const b of h) { const k = wk(b[0]); (W.get(k) || W.set(k, []).get(k)).push(b); }
  const ref = med(h.filter((b) => b[0] > h.at(-1)[0] - 30 * 86400).map((b) => b[5]));   // front-month hourly volume, last 30 days
  out[sym] = [...W].map(([k, a]) => { const days = new Set(a.map((b) => Math.floor((b[0] - 22 * 3600) / 86400))).size;
    return { week: k, perDay: +(a.length / days).toFixed(1), medVol: med(a.map((b) => b[5])), volPctOfFront: +(100 * med(a.map((b) => b[5])) / ref).toFixed(2), flat: +(100 * a.filter((b) => b[1] === b[2] && b[2] === b[3] && b[3] === b[4]).length / a.length).toFixed(0) }; });
  console.log(`== ${sym} (front hourly volume ${ref})`);
  console.log(out[sym].filter((w) => w.week >= '2026-03-01' && w.week <= '2026-10-01').map((w) => `${w.week.slice(5)} ${w.perDay}/d vol ${w.volPctOfFront}% flat ${w.flat}%`).join(' | '));
}
if (OUT) fs.writeFileSync(OUT, JSON.stringify(out, null, 1));
