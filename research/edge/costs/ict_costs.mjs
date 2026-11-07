// ICT desk replay (council-data ict/replay.json) under CME micro-futures costs and entry latency.
// The replay books every trade at the inversion candle's H1 close with no cost. Here each trade pays, in points:
//   1 tick spread (crossed once per round trip) + $1.24 round-trip commission/fees (MNQ, MES, MYM, M2K, MGC) +
//   1 tick slippage on the market entry + 1 tick on the exit (stop / trail / break-even are stop orders; time exits are market).
// Latency: the order lands d minutes after the H1 close; the entry moves by the cash-index / spot-gold M1 drift over those
// d minutes (HistData NSXUSD for NQ, SPXUSD for ES, XAUUSD for GC, scaled to the futures level). YM and RTY have no M1
// history in the repo, and trades after Oct 2026 are past the M1 files: they take the mean latency R of the matched index trades.
// The stop and the trail levels stay where the replay put them, so a worse entry means a bigger loss per stop-out.
//   node research/edge/costs/ict_costs.mjs <replay.json> <dataRoot> <out.json>
import fs from 'node:fs';
import { futCost, stats, FUT } from './costs.mjs';
import { loadM1 } from './load.mjs';

const [RP, ROOT, OUT] = process.argv.slice(2);
const J = JSON.parse(fs.readFileSync(RP, 'utf8'));
const T = J.trades.filter((x) => x.closed && x.R != null);
const M1 = { nq: loadM1(ROOT, 'NSXUSD', 2025, 2026), es: loadM1(ROOT, 'SPXUSD', 2025, 2026), gc: loadM1(ROOT, 'XAUUSD', 2025, 2026) };
const idx = (A, t) => { let lo = 0, hi = A.length; while (lo < hi) { const m = (lo + hi) >> 1; if (A[m].time < t) lo = m + 1; else hi = m; } return lo; };
const LATS = [1, 2, 3, 10];
// drift (points, signed so + = against the trade) between the H1 close and the open of the minute the order lands in
function drift(x, d) {
  const A = M1[x.market]; if (!A) return null;
  const k0 = idx(A, x.signalAt - 60); if (k0 >= A.length || A[k0].time !== x.signalAt - 60) return null;
  const kd = idx(A, x.signalAt + d * 60); if (kd >= A.length || A[kd].time > x.signalAt + d * 60 + 120) return null;
  const s = x.side === 'sell' ? -1 : 1, scale = x.entry / A[k0].close;
  return s * (A[kd].open - A[k0].close) * scale;
}
const rows = T.map((x) => {
  const F = FUT[x.short], c = futCost(x.short), s = x.side === 'sell' ? -1 : 1, size = x.size || 1, raw = x.Rraw != null ? x.Rraw : x.R;
  const exitSlip = x.exit === 'time' ? c.slipM : c.slipS;
  const costPts = c.spread + c.comm + c.slipM + exitSlip, costR = costPts / x.r0;
  const lat = {}; for (const d of LATS) { const v = drift(x, d); lat[d] = v == null ? null : v / x.r0; }
  return { m: x.market, short: x.short, micro: F.micro, side: x.side, t: x.signalAt, y: new Date(x.signalAt * 1000).getUTCFullYear(), aset: !!x.aset, session: x.feat && x.feat.session, grade: x.grade && x.grade.letter,
    exit: x.exit, r0: x.r0, size, gross: raw * size, costR: costR * size, net: (raw - costR) * size, lat, stopTicks: x.r0 / F.tick, costPts };
});
// impute missing latency with the mean of the matched index trades (by delay)
const meanLat = {}; for (const d of LATS) { const v = rows.filter((r) => r.lat[d] != null && r.m !== 'gc').map((r) => r.lat[d]); meanLat[d] = v.reduce((a, b) => a + b, 0) / v.length; }
const meanLatGc = {}; for (const d of LATS) { const v = rows.filter((r) => r.lat[d] != null && r.m === 'gc').map((r) => r.lat[d]); meanLatGc[d] = v.length ? v.reduce((a, b) => a + b, 0) / v.length : meanLat[d]; }
let imputed = 0;
for (const r of rows) { for (const d of LATS) if (r.lat[d] == null) { r.lat[d] = r.m === 'gc' ? meanLatGc[d] : meanLat[d]; if (d === 2) imputed++; } for (const d of LATS) r['net' + d] = r.net - r.lat[d] * r.size; }

const groups = { all: () => true, 'A-setups': (r) => r.aset, 'not A': (r) => !r.aset };
for (const m of Object.keys(FUT)) groups[`${m} (${FUT[m].micro})`] = (r) => r.short === m;
for (const s of [...new Set(rows.map((r) => r.session))]) groups[`session ${s}`] = (r) => r.session === s;
for (const s of [...new Set(rows.filter((r) => r.aset).map((r) => r.session))]) groups[`A ${s}`] = (r) => r.aset && r.session === s;
groups['A gold'] = (r) => r.aset && r.m === 'gc'; groups['A indices'] = (r) => r.aset && r.m !== 'gc';
const out = { source: { at: J.at, from: J.from, trades: T.length }, cost: 'micro futures: 1 tick spread + $1.24 RT + 1 tick entry slip + 1 tick exit slip', latencyImputed: imputed, meanLatencyR: meanLat, groups: {} };
for (const [g, f] of Object.entries(groups)) {
  const a = rows.filter(f); if (!a.length) continue;
  out.groups[g] = { gross: stats(a.map((r) => r.gross)), net: stats(a.map((r) => r.net)), ...Object.fromEntries(LATS.map((d) => ['net_lat' + d, stats(a.map((r) => r['net' + d]))])),
    costR: +(a.reduce((p, r) => p + r.costR, 0) / a.length).toFixed(4), medStopTicks: a.map((r) => r.stopTicks).sort((p, q) => p - q)[a.length >> 1] };
}
// cost share by stop size (ticks)
const bands = [[0, 40], [40, 80], [80, 160], [160, 400], [400, 1e9]];
out.byStopTicks = bands.map(([a, b]) => { const s = rows.filter((r) => r.stopTicks >= a && r.stopTicks < b); return { band: `${a}-${b === 1e9 ? '' : b} ticks`, n: s.length, gross: stats(s.map((r) => r.gross)).exp, net_lat2: stats(s.map((r) => r.net2)).exp, costR: s.length ? +(s.reduce((p, r) => p + r.costR, 0) / s.length).toFixed(3) : null }; });
out.byYear = {}; for (const y of [...new Set(rows.map((r) => r.y))]) { const a = rows.filter((r) => r.y === y); out.byYear[y] = { all: { gross: stats(a.map((r) => r.gross)), net_lat2: stats(a.map((r) => r.net2)) }, A: { gross: stats(a.filter((r) => r.aset).map((r) => r.gross)), net_lat2: stats(a.filter((r) => r.aset).map((r) => r.net2)) } }; }
fs.writeFileSync(OUT, JSON.stringify(out, null, 1));
console.log('imputed latency', imputed, 'meanLatR', JSON.stringify(meanLat), 'gold', JSON.stringify(meanLatGc));
for (const [g, s] of Object.entries(out.groups)) console.log(g.padEnd(26), 'n', String(s.gross.n).padStart(4), 'gross', s.gross.exp, 'net', s.net.exp, 'lat1', s.net_lat1.exp, 'lat2', s.net_lat2.exp, 'lat3', s.net_lat3.exp, 'lat10', s.net_lat10.exp, '| costR', s.costR, 'medStop', s.medStopTicks.toFixed(0), 't2', s.net_lat2.t);
console.log(JSON.stringify(out.byStopTicks));
