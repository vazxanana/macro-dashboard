// ICT trend-side filter test (pre-registered in preregistration.md). Drives the desk's own code, unchanged: signals() / isASetup() /
// isAPlus() / sizeOf() / MIN_GRADE / MARKETS / inHalt() / cmeShut() / agg() / dailyNY() from ict/tracker.mjs and simulate() from
// ict/replay.mjs. For every index A-setup it records the pre-registered gate (sells only when the last closed daily close is below
// its 200-day simple average; buys always pass) and runs TWO streams with the replay's busy rule (one open A-setup per market):
//   U = the live A-setup stream (unfiltered)      F = the A-setups that pass the gate (the filtered stream, its own busy rule)
// A signal is simulated once; a trade is in U, in F or in both. Paper research only.
//   node research/edge/ict-trend-side/run.mjs oanda    <oanda5m cacheDir> <out.json> [toISO]   (OANDA 5m mid, research/edge/ict-oos-2008/fetch.mjs)
//   node research/edge/ict-trend-side/run.mjs histdata <dir with research/candles>  <out.json> [toISO]   (HistData M1, as research/edge/ict-universe)
// toISO: only signals closing before it are simulated (the pre-registration ran with 2018-01-01, before any 2018-26 result).
import fs from 'node:fs';
import path from 'node:path';
import zlib from 'node:zlib';
import { MARKETS, MIN_GRADE, signals, isASetup, isAPlus, sizeOf, inHalt, cmeShut, agg, dailyNY } from '../../../ict/tracker.mjs';
import { simulate } from '../../../ict/replay.mjs';
import { SMA_N, belowSma, passes as gate } from './gate.mjs';   // the pre-registered gate

const [SRC, DIR, OUT, TO = '2026-11-01'] = process.argv.slice(2);
import { histStampUtc } from '../../../council/histdata.mjs';   // the shared HistData clock
if (!SRC || !DIR || !OUT) { console.error('usage: run.mjs oanda|histdata <dir> <out.json> [toISO]'); process.exit(1); }
const T_END = Date.parse(TO) / 1000;

// desk key -> source files and one round-trip cost in price units (ict-oos-2008 / ict-universe costs, unchanged)
const SOURCES = {
  oanda: {
    gc: { sym: 'xau', cost: () => 0.5 },
    nq: { sym: 'nas100', cost: (p) => p * 0.0002 + 0.25 },
    es: { sym: 'spx500', cost: (p) => p * 0.0002 + 0.25 },
    ym: { sym: 'us30', cost: (p) => p * 0.0002 + 1 },
  },
  histdata: {   // HistData cash: NAS100 under NQ's rule, SPX under ES's rule (both the index default), gold under GC's
    gc: { dir: 'xau-histdata', pre: 'XAUUSD', cost: () => 0.5 },
    nq: { dir: 'nsxusd-histdata', pre: 'NSXUSD', cost: (p) => p * 0.0002 + 0.25 },
    es: { dir: 'spxusd-histdata', pre: 'SPXUSD', cost: (p) => p * 0.0002 + 0.25 },
  },
}[SRC];

function loadOanda(sym) {
  const files = fs.readdirSync(DIR).filter((f) => f.startsWith(sym + '-') && f.endsWith('.json.gz')).sort(), m5 = [];
  for (const f of files) for (const [t, o, h, l, c] of JSON.parse(zlib.gunzipSync(fs.readFileSync(path.join(DIR, f))))) {
    if (inHalt(t) || cmeShut(t)) continue;   // the live futures feed's closedBar()
    if (!(o > 0 && h > 0 && l > 0 && c > 0)) continue;
    m5.push({ time: t, open: o, high: Math.max(h, o, c), low: Math.min(l, o, c), close: c });
  }
  return m5.sort((a, b) => a.time - b.time);
}
// HistData M1 (council/histdata.mjs clock) -> 5m, halt hour dropped (ict-universe's loader)
function loadHist(u) {
  const d = path.join(DIR, 'research', 'candles', u.dir), files = fs.readdirSync(d).filter((f) => f.startsWith(u.pre) && f.endsWith('.csv.gz')).sort();
  const m5 = []; let cur = null;
  for (const f of files) for (const ln of zlib.gunzipSync(fs.readFileSync(path.join(d, f))).toString().split('\n')) {
    if (ln.length < 20) continue; const p = ln.split(';');
    const t = histStampUtc(ln);
    if (inHalt(t)) continue;
    const o = +p[1], h = +p[2], l = +p[3], c = +p[4]; if (!(o > 0 && h > 0 && l > 0 && c > 0)) continue;
    const k = t - (t % 300);
    if (cur && cur.time === k) { if (h > cur.high) cur.high = h; if (l < cur.low) cur.low = l; cur.close = c; }
    else if (!cur || k > cur.time) { cur = { time: k, open: o, high: h, low: l, close: c }; m5.push(cur); }
  }
  return m5;
}
const lb = (A, t) => { let lo = 0, hi = A.length; while (lo < hi) { const m = (lo + hi) >> 1; if (A[m].time < t) lo = m + 1; else hi = m; } return lo; };

const res = { at: new Date().toISOString(), src: SRC, to: TO, smaN: SMA_N, markets: {}, trades: [] };
for (const [key, u] of Object.entries(SOURCES)) {
  const t0 = Date.now(), M = MARKETS[key], m5 = SRC === 'oanda' ? loadOanda(u.sym) : loadHist(u), H = agg(m5, 3600), D = dailyNY(H);
  const days = new Map(); for (const b of m5) { const d = Math.floor(b.time / 86400); days.set(d, (days.get(d) || 0) + 1); }
  const m5days = new Set([...days.entries()].filter(([, n]) => n >= 200).map(([d]) => d));
  const sig = signals(H, D, 1, M.tick).concat(signals(H, D, -1, M.tick)).filter((g) => g.grade.total >= MIN_GRADE && g.close < T_END && isASetup(g, key)).sort((a, b) => a.close - b.close);
  const memo = new Map(), sim = (g) => { const id = `${g.side}-${g.t}`; if (!memo.has(id)) { const i = lb(H, g.close), j = lb(m5, g.close);
    memo.set(id, simulate(g, M, key, { H: H.slice(i, i + 120), m5: m5.slice(j, j + 12 * 24 * 12), m5days })); } return memo.get(id); };
  const rec = new Map(); let busyU = 0, busyF = 0, gaps = 0;
  const row = (g, t) => { const id = `${g.side}-${g.t}`; if (!rec.has(id)) { const b = g.side < 0 ? belowSma(g, D) : null;
    rec.set(id, { market: key, side: g.side, close: g.close, size: sizeOf(g, key), aplus: isAPlus(g, key) ? 1 : 0, Rraw: +t.R.toFixed(3), costR: +(u.cost(g.entry) / g.r0).toFixed(4),
      below: b == null ? null : b ? 1 : 0, pass: key === 'gc' || gate(g, D) ? 1 : 0, U: 0, F: 0, closed: t.closed, exit: t.exit }); } return rec.get(id); };
  for (const g of sig) {
    const pass = key === 'gc' || gate(g, D);   // GC unchanged (its rule takes buys only)
    if (g.close >= busyU) { const t = sim(g); if (!t) gaps++; else if (t.closed) { row(g, t).U = 1; busyU = t.closed; } }
    if (pass && g.close >= busyF) { const t = sim(g); if (t && t.closed) { row(g, t).F = 1; busyF = t.closed; } }
  }
  res.trades.push(...[...rec.values()].sort((a, b) => a.close - b.close));
  res.markets[key] = { m5: m5.length, h1: H.length, d1: D.length, from: new Date(m5[0].time * 1000).toISOString().slice(0, 10), to: new Date(m5.at(-1).time * 1000).toISOString().slice(0, 10), aSignals: sig.length, gaps, cost: u.cost.toString() };
  console.log(key, JSON.stringify(res.markets[key]), ((Date.now() - t0) / 1000).toFixed(0) + 's');
}
fs.mkdirSync(path.dirname(OUT), { recursive: true });
fs.writeFileSync(OUT, JSON.stringify(res));
console.log('trades', res.trades.length, '->', OUT);
