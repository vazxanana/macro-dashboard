// rollAdjust (ict/tracker.mjs) on CNBC's own daily candles: the switches it finds, and how close the adjusted front-month series is to
// the current contract's own daily closes (NQZ26 / ESZ26 from the probe) and to the cash basis. node check-adjust.mjs <probe.json.gz> [cnbc.json.gz]
import fs from 'node:fs';
import zlib from 'node:zlib';
import { rollAdjust } from '../../../ict/tracker.mjs';
const P = JSON.parse(zlib.gunzipSync(fs.readFileSync(process.argv[2]))).series;
const bars = (k) => (P[k] || []).map((b) => ({ time: b[0], open: b[1], high: b[2], low: b[3], close: b[4] }));
const med = (a) => { const s = [...a].sort((x, y) => x - y); return s[s.length >> 1]; };
const iso = (t) => new Date(t * 1000).toISOString().slice(0, 10);
const out = {};
for (const [k, fut, cash, own] of [['nq', '@ND.1', '.NDX', 'NQZ26'], ['es', '@SP.1', '.SPX', 'ESZ26'], ['ym', '@DJ.1', '.DJI', null], ['rty', '@TFS.1', '.RUT', null]]) {
  const d1 = bars(`${fut}|1D`), r = rollAdjust(d1, bars(`${cash}|1D`));
  const o = { rolls: r.rolls };
  if (own) { const Z = new Map(bars(`${own}|1D`).map((b) => [b.time, b.close]));
    // residual: adjusted front close minus the current contract's own close, per roll segment (0 = exact)
    const res = r.d1.filter((b) => Z.has(b.time) && b.time >= Date.parse('2025-06-01') / 1000).map((b) => ({ t: b.time, d: b.close - Z.get(b.time), px: b.close }));
    const raw = d1.filter((b) => Z.has(b.time) && b.time >= Date.parse('2025-06-01') / 1000).map((b) => b.close - Z.get(b.time));
    o.vsOwnContract = { n: res.length, medianAbsRaw: +med(raw.map(Math.abs)).toFixed(2), medianAbsAdjusted: +med(res.map((x) => Math.abs(x.d))).toFixed(2), maxAbsAdjustedPct: +Math.max(...res.map((x) => 100 * Math.abs(x.d) / x.px)).toFixed(3) }; }
  // largest remaining day-over-day basis change near an expiry after adjustment (should be ordinary noise)
  const C = new Map(bars(`${cash}|1D`).map((b) => [iso(b.time), b.close]));
  const bas = r.d1.filter((b) => C.has(iso(b.time))).map((b) => ({ d: iso(b.time), v: b.close - C.get(iso(b.time)) }));
  const ch = bas.slice(1).map((x, i) => ({ d: x.d, c: +(x.v - bas[i].v).toFixed(2) })).sort((a, b) => Math.abs(b.c) - Math.abs(a.c));
  o.largestBasisChangesAfter = ch.slice(0, 4);
  out[k] = o; console.log(k, JSON.stringify(o));
}
if (process.argv[3]) fs.writeFileSync(process.argv[3], JSON.stringify(out, null, 1));
