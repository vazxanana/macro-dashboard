// Long-history check: the tracker's own signals / isASetup / sizeOf on HistData M1 2018 -> Oct 2026 (cash NQ/ES, spot gold),
// every A-setup its own trade, exits from engine.mjs on M1 sub-bars. Writes per-trade net R for every variant.
// node hist.mjs <council-data research/candles> nas|spx|xau <out.json>   (then: node hist-an.mjs, in the folder with the h-*.json files)
import fs from 'node:fs'; import zlib from 'node:zlib'; import path from 'node:path';
const [dir, mk, out] = process.argv.slice(2);
import { signals, agg, inHalt, isASetup, sizeOf, MIN_GRADE } from '../../../ict/tracker.mjs';
import { sim, VARIANTS, STRUCT_GRID } from './engine.mjs';
import { histStampUtc } from '../../../council/histdata.mjs';   // HistData clock: UTC-5, UTC-4 in Europe's summer (2018: New York time)
const CFG = { nas: { file: 'nsxusd-histdata/NSXUSD', key: 'nq', tick: 0.25, cost: 1.0 }, spx: { file: 'spxusd-histdata/SPXUSD', key: 'es', tick: 0.25, cost: 0.5 },
  xau: { file: 'xau-histdata/XAUUSD', key: 'gc', tick: 0.1, cost: 0.30 } }[mk];
const base = path.join(dir, path.dirname(CFG.file)), pre = path.basename(CFG.file);
const map = new Map();
for (const f of fs.readdirSync(base).filter((f) => f.startsWith(pre) && f.endsWith('.csv.gz')).sort())
  for (const ln of zlib.gunzipSync(fs.readFileSync(path.join(base, f))).toString().split('\n')) { if (ln.length < 20) continue; const [d, o, h, l, c] = ln.split(';');
    const t = histStampUtc(d); map.set(t, [t, +o, +h, +l, +c]); }
const m1a = [...map.values()].sort((a, b) => a[0] - b[0]); map.clear();
const T = Int32Array.from(m1a.map((b) => b[0]));
const m1 = m1a.map((b) => ({ time: b[0], open: b[1], high: b[2], low: b[3], close: b[4] }));
const H = agg(m1, 3600).filter((b) => !inHalt(b.time));
const D = agg(m1.map((b) => ({ ...b, time: b.time + 7200 })), 86400).map((b) => ({ ...b, time: b.time - 7200 }));
const lb = (t) => { let lo = 0, hi = T.length; while (lo < hi) { const m = (lo + hi) >> 1; if (T[m] < t) lo = m + 1; else hi = m; } return lo; };
let all = [];
for (let off = 0; off < H.length; off += 2000) { const w = H.slice(Math.max(0, off - 200), off + 2000);
  for (const s of [1, -1]) all = all.concat(signals(w, D, s, CFG.tick).filter((g) => g.t >= H[off].time)); }
{ const seen = new Set(); all = all.filter((g) => !seen.has(g.side + ':' + g.t) && seen.add(g.side + ':' + g.t)).sort((a, b) => a.t - b.t); }
all = all.filter((g) => g.grade.total >= MIN_GRADE && isASetup(g, CFG.key));
const hIdx = new Map(H.map((b, i) => [b.time, i]));
const V = { ...VARIANTS, ...STRUCT_GRID };
const recs = [];
for (const g of all) {
  const i = hIdx.get(g.t); if (i == null) continue;
  const hb = H.slice(i + 1, i + 1 + 36); if (hb.length < 36) continue;
  { let p = H[i].time + 3600, bad = false; for (const b of hb) { if (b.time - p > 4 * 86400) bad = true; p = b.time + 3600; } if (bad) continue; }
  const s = g.side, e = g.entry, r0 = g.r0, Rr = (p) => (s * (p - e)) / r0;
  const hset = new Map(hb.map((b, q) => [b.time, q])), a = lb(H[i].time + 3600), z = lb(hb[35].time + 3600), B = [];
  for (let k = a; k < z; k++) { const b = m1a[k], hq = hset.get(Math.floor(b[0] / 3600) * 3600); if (hq == null) continue;
    B.push({ hi: Rr(s > 0 ? b[2] : b[3]), lo: Rr(s > 0 ? b[3] : b[2]), cl: Rr(b[4]), h: hq }); }
  for (let q = 0; q < B.length; q++) B[q].last = q === B.length - 1 || B[q + 1].h !== B[q].h;
  const size = sizeOf(g, CFG.key), cost = (CFG.cost / r0) * size, r = {};
  let ok = true; for (const [n, v] of Object.entries(V)) { const x = sim(B, CFG.key !== 'gc', v); if (!x) { ok = false; break; } r[n] = +(x.R * size - cost).toFixed(4); }
  if (ok) recs.push({ t: g.close, mk: CFG.key, size, r });
}
fs.writeFileSync(out, JSON.stringify(recs));
console.log(mk, 'H1', H.length, 'A-setups', all.length, 'trades', recs.length);
