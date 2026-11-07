// ICT 2008-2017 out-of-sample test (pre-registered in preregistration.md, committed before this ran). Drives the desk's own
// code, unchanged: signals() / isASetup() / isAPlus() / sizeOf() / MIN_GRADE / MARKETS / inHalt() / cmeShut() / agg() /
// dailyNY() from ict/tracker.mjs and simulate() from ict/replay.mjs, over OANDA 5m mid candles (fetch.mjs). One pass over
// 2007-06 .. 2026-10; analyse.mjs splits the test window (2008-2017) from the 2018-26 reference window. Paper research only.
//   node research/edge/ict-oos-2008/run.mjs <cacheDir> [trades.json]
import fs from 'node:fs';
import path from 'node:path';
import zlib from 'node:zlib';
import { MARKETS, MIN_GRADE, signals, isASetup, isAPlus, sizeOf, inHalt, cmeShut, agg, dailyNY } from '../../../ict/tracker.mjs';
import { simulate } from '../../../ict/replay.mjs';

const [DIR, OUT = path.join(DIR || '.', 'trades.json')] = process.argv.slice(2);
if (!DIR) { console.error('usage: run.mjs <cacheDir> [trades.json]'); process.exit(1); }
// desk key -> OANDA proxy symbol and one round-trip cost in price units (preregistration.md)
const U = {
  gc: { sym: 'xau', cost: () => 0.5 },
  nq: { sym: 'nas100', cost: (p) => p * 0.0002 + 0.25 },
  es: { sym: 'spx500', cost: (p) => p * 0.0002 + 0.25 },
  ym: { sym: 'us30', cost: (p) => p * 0.0002 + 1 },
};

function load(sym) {
  const files = fs.readdirSync(DIR).filter((f) => f.startsWith(sym + '-') && f.endsWith('.json.gz')).sort(), m5 = [];
  for (const f of files) for (const [t, o, h, l, c] of JSON.parse(zlib.gunzipSync(fs.readFileSync(path.join(DIR, f))))) {
    if (inHalt(t) || cmeShut(t)) continue;   // the live futures feed's closedBar()
    if (!(o > 0 && h > 0 && l > 0 && c > 0)) continue;
    m5.push({ time: t, open: o, high: Math.max(h, o, c), low: Math.min(l, o, c), close: c });
  }
  return m5.sort((a, b) => a.time - b.time);
}
const lb = (A, t) => { let lo = 0, hi = A.length; while (lo < hi) { const m = (lo + hi) >> 1; if (A[m].time < t) lo = m + 1; else hi = m; } return lo; };

const res = { at: new Date().toISOString(), src: {}, cost: {}, coverage: {}, trades: [] };
for (const [key, u] of Object.entries(U)) {
  const t0 = Date.now(), M = MARKETS[key], m5 = load(u.sym), H = agg(m5, 3600), D = dailyNY(H);
  const days = new Map(); for (const b of m5) { const d = Math.floor(b.time / 86400); days.set(d, (days.get(d) || 0) + 1); }
  const m5days = new Set([...days.entries()].filter(([, n]) => n >= 200).map(([d]) => d));
  // coverage per year: 5m candles, H1 candles, share of trading days with 5m exits
  const cov = {}; for (const b of H) { const y = new Date(b.time * 1000).getUTCFullYear(); (cov[y] = cov[y] || { h1: 0, m5: 0, days: 0, m5days: 0 }).h1++; }
  for (const [d, n] of days) { const y = new Date(d * 86400000).getUTCFullYear(); if (!cov[y]) continue; cov[y].m5 += n; cov[y].days++; if (n >= 200) cov[y].m5days++; }
  res.coverage[key] = cov;
  const sig = signals(H, D, 1, M.tick).concat(signals(H, D, -1, M.tick)).filter((g) => g.grade.total >= MIN_GRADE).sort((a, b) => a.close - b.close);
  let busyAll = 0, busyA = 0, gaps = 0;
  for (const g of sig) {
    const a = isASetup(g, key); if (g.close < (a ? busyA : busyAll)) continue;
    const i = lb(H, g.close), j = lb(m5, g.close);
    const t = simulate(g, M, key, { H: H.slice(i, i + 120), m5: m5.slice(j, j + 12 * 24 * 12), m5days }); if (!t) { gaps++; continue; }
    if (!t.closed) continue;
    const size = a ? sizeOf(g, key) : 1, c = u.cost(g.entry) / g.r0;
    res.trades.push([key, 'rule', g.side, g.close, a ? 1 : 0, a && isAPlus(g, key) ? 1 : 0, size, +t.R.toFixed(3), +c.toFixed(4), g.feat.session, g.feat.atrR, g.grade.total, t.exit, t.res, t.closed]);
    busyAll = Math.max(busyAll, t.closed); if (a) busyA = t.closed;
  }
  res.src[key] = { sym: u.sym, m5: m5.length, h1: H.length, d1: D.length, from: new Date(m5[0].time * 1000).toISOString().slice(0, 10), to: new Date(m5.at(-1).time * 1000).toISOString().slice(0, 10), signals: sig.length, gaps };
  res.cost[key] = u.cost.toString();
  // GC drift control (reported only), as ict-universe: random H1-close gold buys, stop 0.3-0.75x the daily ATR14, the gold exit, same costs
  if (key === 'gc') {
    let seed = 12345; const rnd = () => ((seed = (seed * 1103515245 + 12345) % 2147483648) / 2147483648);
    for (let i = 60; i < H.length - 40; i++) {
      if (rnd() > 0.04) continue;
      const close = H[i].time + 3600, di = D.findLastIndex((d) => d.time + 86400 <= close); if (di < 14) continue;
      const atrD = D.slice(di - 13, di + 1).reduce((s, d) => s + (d.high - d.low), 0) / 14, k = 0.3 + 0.45 * rnd(), e = H[i].close, r0 = k * atrD;
      const g = { side: 1, entry: e, r0, stop: e - r0, close, t: H[i].time, sweepT: H[i].time, swept: e, fvg: [e, e], ih: null, dol: null, valid: true, feat: {}, grade: { total: 0 } };
      const j = lb(m5, close), t = simulate(g, M, key, { H: H.slice(i + 1, i + 121), m5: m5.slice(j, j + 12 * 24 * 12), m5days });
      if (!t || !t.closed) continue;
      res.trades.push([key, 'ctrlbuy', 1, close, 0, 0, 1, +t.R.toFixed(3), +(u.cost(e) / r0).toFixed(4), null, +k.toFixed(3), null, t.exit, t.res, t.closed]);
    }
  }
  console.log(key, JSON.stringify(res.src[key]), ((Date.now() - t0) / 1000).toFixed(0) + 's');
}
res.cols = ['market', 'cfg', 'side', 'close', 'aset', 'aplus', 'size', 'Rraw', 'costR', 'session', 'atrR', 'grade', 'exit', 'res', 'closed'];
fs.writeFileSync(OUT, JSON.stringify(res));
console.log('trades', res.trades.length, '->', OUT);
