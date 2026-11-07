// ICT A-setup exit variants on the replay's own closed A-trades (council-data ict/replay.json, Aug 2025 - Nov 2026): same entries and
// sizes for every exit (paired comparison), costs in. Exits run on OANDA 5m candles for NQ/ES/YM/GC (index CFDs / spot gold from
// meridianx.dev /md/bars, fetch-oanda.mjs; each trade's candles scaled onto the futures entry by the ratio at the signal close) and on
// the replay's own H1 path for RTY (no OANDA symbol; trades whose path ends before the exit are dropped and counted).
// node exits.mjs <dir with replay.json and oanda/{nq,es,ym,gc}.json> [out.json]   (GRID=1 adds the structure-trail grid)
import fs from 'node:fs';
import { sim, VARIANTS as V0, STRUCT_GRID, stats as st } from './engine.mjs';
const DIR = process.argv[2], OUT = process.argv[3];
const rep = JSON.parse(fs.readFileSync(`${DIR}/replay.json`));
const etH = new Intl.DateTimeFormat('en-US', { timeZone: 'America/New_York', hour: 'numeric', hourCycle: 'h23' });
const inHalt = (t) => +etH.format(new Date(t * 1000)) % 24 === 17;
const COST = { nq: 1.0, es: 0.5, ym: 4, rty: 0.3, gc: 0.3 };   // round-turn points (commission + slippage)
const OA = {}; for (const k of ['nq', 'es', 'ym', 'gc']) { const a = JSON.parse(fs.readFileSync(`${DIR}/oanda/${k}.json`)).filter((b) => !inHalt(b[0])); OA[k] = { a, t: a.map((b) => b[0]) }; }
const lb = (arr, x) => { let lo = 0, hi = arr.length; while (lo < hi) { const m = (lo + hi) >> 1; if (arr[m] < x) lo = m + 1; else hi = m; } return lo; };

// per-trade series in R units: [{hi, lo, cl, h (H1 candle index), last (last 5m bar of its H1 candle)}]
function series(x) {
  const s = x.side === 'buy' ? 1 : -1, O = OA[x.market];
  if (O) {
    const i0 = lb(O.t, x.signalAt), ip = i0 - 1;   // the 5m bar that closes at the signal close
    if (ip >= 0 && x.signalAt - O.t[ip] <= 900) {
      const k = x.entry / O.a[ip][4], R = (p) => (s * (p * k - x.entry)) / x.r0, out = []; let hb = -1, hk = null;
      for (let i = i0; i < O.a.length; i++) { const b = O.a[i], hr = Math.floor(b[0] / 3600);
        if (hr !== hk) { hk = hr; hb++; if (hb >= 72) break; }
        out.push({ hi: R(s > 0 ? b[2] : b[3]), lo: R(s > 0 ? b[3] : b[2]), cl: R(b[4]), h: hb, t: b[0] }); }
      for (let i = 0; i < out.length; i++) out[i].last = i === out.length - 1 || out[i + 1].h !== out[i].h;
      let ok = out.length > 0 && out[0].t - x.signalAt < 4 * 86400; for (let i = 1; i < out.length; i++) if (out[i].t - out[i - 1].t > 4 * 86400) ok = false;   // > 4-day hole: unknown, as the replay
      if (ok) return { src: 'oanda', bars: out };
    }
  }
  return { src: 'path', bars: x.path.map((p, i) => ({ hi: p[0], lo: p[1], cl: p[2], h: i, last: true })) };
}

const VARIANTS = { ...V0, ...(process.env.GRID ? STRUCT_GRID : {}) };
const A = rep.trades.filter((x) => x.aset && x.closed).sort((a, b) => a.opened - b.opened);
const rows = []; let agree = 0, srcN = {}, dropped = 0;
for (const x of A) {
  const S = series(x); srcN[S.src] = (srcN[S.src] || 0) + 1;
  const isIdx = x.market !== 'gc', size = x.size || 1, cost = (COST[x.market] / x.r0) * size, res = {}; let bad = false;
  for (const [k, v] of Object.entries(VARIANTS)) { const r = sim(S.bars, isIdx, v); if (!r) { bad = true; break; } res[k] = { R: r.R * size, net: r.R * size - cost, exit: r.exit }; }
  if (bad) { dropped++; continue; }   // the data ends before this exit (RTY path cut by a weekend)
  if (Math.abs(res.live.R / size - (x.Rraw ?? x.R)) < 0.15) agree++;
  rows.push({ x, res, recNet: x.R - cost });
}
const mid = rows[rows.length >> 1].x.opened;
const out = { from: rep.from, replayAt: rep.at, trades: A.length, compared: rows.length, dropped, src: srcN, halvesSplit: new Date(mid * 1000).toISOString().slice(0, 10),
  recordedLive: { gross: st(A.map((x) => x.R)), net: st(rows.map((r) => r.recNet)) }, liveResimWithin015R: `${agree}/${rows.length}`, variants: {} };
for (const k of Object.keys(VARIANTS)) {
  const v = rows.map((r) => ({ v: r.res[k].net, mk: r.x.market, t: r.x.opened, d: r.res[k].net - r.res.live.net }));
  const d = v.map((y) => y.d), dm = d.reduce((q, y) => q + y, 0) / d.length, dsd = Math.sqrt(d.reduce((q, y) => q + (y - dm) ** 2, 0) / (d.length - 1));
  const mk = {}; for (const m of ['nq', 'es', 'ym', 'rty', 'gc']) { const s = v.filter((y) => y.mk === m); mk[m] = { n: s.length, R: +s.reduce((q, y) => q + y.v, 0).toFixed(1), vsLive: +s.reduce((q, y) => q + y.d, 0).toFixed(1) }; }
  out.variants[k] = { all: st(v.map((y) => y.v)), h1: st(v.filter((y) => y.t < mid).map((y) => y.v)), h2: st(v.filter((y) => y.t >= mid).map((y) => y.v)),
    vsLive: { perTrade: +dm.toFixed(3), t: dsd > 0 ? +(dm / (dsd / Math.sqrt(d.length))).toFixed(2) : 0, h1: +v.filter((y) => y.t < mid).reduce((q, y) => q + y.d, 0).toFixed(1), h2: +v.filter((y) => y.t >= mid).reduce((q, y) => q + y.d, 0).toFixed(1) },
    markets: mk, marketsBetter: Object.values(mk).filter((m) => m.vsLive > 0).length };
}
if (OUT) fs.writeFileSync(OUT, JSON.stringify(out, null, 1));
console.log(`A-trades ${out.trades}, compared ${out.compared} (dropped ${dropped}), bars ${JSON.stringify(srcN)}, halves split ${out.halvesSplit}, live re-simulated within 0.15R of the record: ${out.liveResimWithin015R}`);
console.log('recorded live, gross', JSON.stringify(out.recordedLive.gross), '| net', JSON.stringify(out.recordedLive.net));
console.log('variant            |   n  win%   R/tr   totR    DD     t |  H1 R/tr   totR |  H2 R/tr   totR | vs live R/tr  t   H1    H2 | mk+ | nq es ym rty gc (R vs live)');
const p = (x, n) => String(x).padStart(n);
for (const [k, s] of Object.entries(out.variants)) console.log(`${k.padEnd(18)} | ${p(s.all.n, 3)} ${p(s.all.win, 5)} ${p(s.all.exp, 6)} ${p(s.all.R, 6)} ${p(s.all.dd, 5)} ${p(s.all.t, 5)} | ${p(s.h1.exp, 7)} ${p(s.h1.R, 6)} | ${p(s.h2.exp, 7)} ${p(s.h2.R, 6)} | ${p(s.vsLive.perTrade, 7)} ${p(s.vsLive.t, 5)} ${p(s.vsLive.h1, 5)} ${p(s.vsLive.h2, 5)} | ${s.marketsBetter} | ${Object.values(s.markets).map((m) => m.vsLive).join(' ')}`);
