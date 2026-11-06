// every signal independent, H1 from Dukascopy 5m, paths for exit study (same as nqrec3)
import fs from 'node:fs'; import zlib from 'node:zlib';
import { signals, letter, agg, isASetup, isAPlus } from '/home/user/macro-dashboard/ict/tracker.mjs';
const [sym, short, tick, out] = process.argv.slice(2);
let m5 = [];
for (const y of [2023, 2024, 2025, 2026]) m5 = m5.concat(JSON.parse(zlib.gunzipSync(fs.readFileSync(`${process.env.CD}/research/candles/idx/${sym}_${y}.json.gz`))).map((r) => ({ time: r[0], open: r[1], high: r[2], low: r[3], close: r[4] })));
m5.sort((a, b) => a.time - b.time);
const H = agg(m5, 3600);
const sh = m5.map((b) => ({ ...b, time: b.time + 7200 })), D = agg(sh, 86400).map((b) => ({ ...b, time: b.time - 7200 }));   // day rolls at 22:00 UTC
let all = [];
for (let off = 0; off < H.length; off += 2000) { const w = H.slice(Math.max(0, off - 200), off + 2000);
  for (const s of [1, -1]) all = all.concat(signals(w, D, s, +tick).filter((g) => g.t >= (H[off] || {}).time)); }
const seen = new Set(); all = all.filter((g) => !seen.has(g.side + ':' + g.t) && seen.add(g.side + ':' + g.t)).sort((a, b) => a.t - b.t);
const idx = new Map(H.map((b, i) => [b.time, i]));
const recs = all.map((g) => { const i = idx.get(g.t), s = g.side;
  const path = H.slice(i + 1, i + 73).map((b) => [+(((s > 0 ? b.high : -b.low) - s * g.entry) / g.r0).toFixed(2), +(((s > 0 ? b.low : -b.high) - s * g.entry) / g.r0).toFixed(2), +((s * (b.close - g.entry)) / g.r0).toFixed(2)]);
  return { market: short.toLowerCase(), side: s > 0 ? 'buy' : 'sell', signalAt: g.close, r0: g.r0, entry: g.entry, feat: g.feat, grade: { ...g.grade, letter: letter(g.grade.total) }, valid: g.valid, dol: g.dol, aset: isASetup(g), aplus: isAPlus(g), path }; });
fs.writeFileSync(out, JSON.stringify(recs)); console.log(short, 'H1', H.length, 'D1', D.length, 'signals', recs.length);
