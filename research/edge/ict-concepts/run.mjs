// Edge research (ict-concepts): replay three new ICT entry concepts (concepts.mjs) next to the live A-setup rule.
// CNBC (the replay's source) and Yahoo are not reachable from the research sandbox, so the candles are the replay's own fill
// sources in council-data research/candles/: HistData M1 NSXUSD (NQ), SPXUSD (ES), XAUUSD (GC), Dukascopy 5m USA30 (YM).
// RTY has no history there before Sep 2026, so it is not testable. Bars are built exactly as the replay would see them
// (5m without the 17:00 ET halt hour, H1 from 5m, D1 per 18:00-ET trading day), exits use replay.mjs simulate() unchanged.
// Usage: node research/edge/ict-concepts/run.mjs <council-data research/candles dir> <window|long> <out.json>
import fs from 'node:fs';
import path from 'node:path';
import zlib from 'node:zlib';
import { MARKETS, P, MIN_GRADE, agg, signals, inHalt, isASetup, sizeOf } from '../../../ict/tracker.mjs';
import { simulate, MAX_GAP } from '../../../ict/replay.mjs';
import { eqts, lbh, gaps, FILTERS, FLOOR } from './concepts.mjs';
import { histStampUtc } from '../../../council/histdata.mjs';   // HistData clock: UTC-5, UTC-4 in Europe's summer (2018: New York time)

const DIR = process.argv[2], MODE = process.argv[3] || 'window', OUT = process.argv[4] || `ict-concepts-${MODE}.json`;
const WIN = MODE === 'long' ? ['2018-03-01', '2025-08-01'] : ['2025-08-01', '2026-11-08'];
const FROM = Date.parse(WIN[0]) / 1000, TO = Date.parse(WIN[1]) / 1000, MID = (FROM + TO) / 2;
const MK = MODE === 'long' ? ['nq', 'es', 'gc'] : ['nq', 'es', 'ym', 'gc'];
// cost per round trip in price (research/edge/ict-exits): NQ 1 pt, ES 0.5, YM 2, GC 0.30
export const COST = { nq: 1.0, es: 0.5, ym: 2.0, rty: 0.2, gc: 0.3 };
const HD = { nq: 'nsxusd-histdata/NSXUSD', es: 'spxusd-histdata/SPXUSD', gc: 'xau-histdata/XAUUSD' }, DUKA = { ym: 'USA30IDXUSD' };

function loadM1(prefix, y0, y1) {
  const dir = path.join(DIR, path.dirname(prefix)), base = path.basename(prefix), out = [];
  for (const f of fs.readdirSync(dir).filter((f) => f.startsWith(base + '_M1_') && f.endsWith('.csv.gz')).sort()) {
    const y = +f.slice(base.length + 4, base.length + 8); if (y < y0 || y > y1) continue;
    for (const ln of zlib.gunzipSync(fs.readFileSync(path.join(dir, f))).toString().split('\n')) {
      if (!ln) continue; const [d, o, h, l, c] = ln.split(';');
      const t = histStampUtc(d);
      out.push({ time: t, open: +o, high: +h, low: +l, close: +c });
    }
  }
  return out.sort((a, b) => a.time - b.time);
}
const nyH = new Intl.DateTimeFormat('en-US', { timeZone: 'America/New_York', year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', hourCycle: 'h23' });
const nyParts = (t) => Object.fromEntries(nyH.formatToParts(new Date(t * 1000)).map((p) => [p.type, p.value]));
// D1 per CME trading day (18:00 -> 17:00 New York), stamped at its 18:00 start (research/edge/ict-filters/driver.mjs)
function daily(m5) {
  const m = new Map();
  for (const b of m5) { const p = nyParts(b.time); let day = Date.UTC(+p.year, +p.month - 1, +p.day) / 86400000; if (+p.hour >= 18) day += 1;
    const c = m.get(day); if (!c) m.set(day, { day, first: b.time, open: b.open, high: b.high, low: b.low, close: b.close, n: 1 });
    else { c.high = Math.max(c.high, b.high); c.low = Math.min(c.low, b.low); c.close = b.close; c.n++; } }
  return [...m.values()].filter((d) => d.n >= 24).sort((a, b) => a.day - b.day)
    .map((d) => { const s = nyParts(d.first); const start = d.first - ((+s.hour - 18 + 24) % 24) * 3600 - (d.first % 3600); return { time: start, open: d.open, high: d.high, low: d.low, close: d.close }; });
}
function bars(key) {
  const y0 = new Date((FROM - 400 * 86400) * 1000).getUTCFullYear(), y1 = new Date(TO * 1000).getUTCFullYear();
  let m5;
  if (HD[key]) m5 = agg(loadM1(HD[key], y0, y1), 300);
  else { m5 = []; for (let y = y0; y <= y1; y++) { try { m5 = m5.concat(JSON.parse(zlib.gunzipSync(fs.readFileSync(path.join(DIR, 'idx', `${DUKA[key]}_${y}.json.gz`)))).map((r) => ({ time: r[0], open: r[1], high: r[2], low: r[3], close: r[4] }))); } catch (e) { /* year missing */ } }
    const by = new Map(); for (const b of m5) by.set(b.time, b); m5 = [...by.values()].sort((a, b) => a.time - b.time); }
  m5 = m5.filter((b) => b.time < TO + 3 * 86400 && !inHalt(b.time));
  const H = agg(m5, 3600), D = daily(m5);
  const days = new Map(); for (const b of m5) { const d = Math.floor(b.time / 86400); days.set(d, (days.get(d) || 0) + 1); }
  return { m5, H, D, m5days: new Set([...days.entries()].filter(([, n]) => n >= 200).map(([d]) => d)) };
}
const lb = (A, t) => { let lo = 0, hi = A.length; while (lo < hi) { const m = (lo + hi) >> 1; if (A[m].time < t) lo = m + 1; else hi = m; } return lo; };
const sub = (src, t) => { const i = lb(src.H, t), j = lb(src.m5, t); return { H: src.H.slice(i, i + 200), m5: src.m5.slice(j, j + 3000), m5days: src.m5days, cnbcFrom: null }; };

// the gap model's own exit: target = the prior close, stop beyond the first candle, 36 H1 candles max; stop first on a tie
function simGap(g, src) {
  const s = g.side, hb = src.H.filter((b) => b.time >= g.close).slice(0, P.holdH); if (hb.length < P.holdH) return null;
  { let p = g.close; for (const b of hb) { if (b.time - p > MAX_GAP) return null; p = b.time + 3600; } }
  const end = hb.at(-1).time + 3600, use5 = src.m5days.has(Math.floor(g.close / 86400));
  const B = (use5 ? src.m5 : src.H).filter((b) => b.time >= g.close && b.time < end), step = use5 ? 300 : 3600;
  for (const b of B) {
    if (s > 0 ? b.low <= g.stop : b.high >= g.stop) return { R: -1, closed: b.time + step, exit: 'stop' };
    if (s > 0 ? b.high >= g.target : b.low <= g.target) return { R: +((s * (g.target - g.entry)) / g.r0).toFixed(3), closed: b.time + step, exit: 'target' };
  }
  const px = B.length ? B.at(-1).close : g.entry; return { R: +((s * (px - g.entry)) / g.r0).toFixed(3), closed: end, exit: 'time' };
}

const out = { at: new Date().toISOString(), mode: MODE, window: WIN, mid: new Date(MID * 1000).toISOString().slice(0, 10), cost: COST, src: {}, trades: [] };
for (const key of MK) {
  const M = MARKETS[key], src = bars(key), inWin = (g) => g.close >= FROM && g.close < TO;
  out.src[key] = { m5: src.m5.length, h1: src.H.length, d1: src.D.length, first: new Date(src.H[0].time * 1000).toISOString().slice(0, 10), last: new Date(src.H.at(-1).time * 1000).toISOString().slice(0, 10) };
  const push = (stream, g, t, size = 1) => { if (!t || !t.closed) return; const Rg = t.R * size, Rn = Rg - (size * COST[key]) / g.r0;
    out.trades.push({ stream, market: key, side: g.side, at: g.close, closed: t.closed, r0: +g.r0.toPrecision(6), size, Rg: +Rg.toFixed(3), R: +Rn.toFixed(3), exit: t.exit, feat: g.feat }); };
  // baseline: the live A-setup rule (sized, as the CNBC replay), one open A-setup per market
  { let busy = 0; for (const g of signals(src.H, src.D, 1, M.tick).concat(signals(src.H, src.D, -1, M.tick)).filter((g) => inWin(g) && g.grade.total >= MIN_GRADE && isASetup(g, key)).sort((a, b) => a.close - b.close)) {
      if (g.close < busy) continue; const t = simulate(g, M, key, sub(src, g.close), Infinity); if (!t || !t.closed) continue; push('A', g, t, sizeOf(g, key)); busy = t.closed; } }
  // concepts: every filter its own stream, one open trade per market per stream, unit size, the desk's live exit
  for (const [name, fn] of [['eqts', eqts], ['lbh', lbh]]) {
    const sig = fn(src.H, src.D, 1, M.tick).concat(fn(src.H, src.D, -1, M.tick)).filter(inWin).sort((a, b) => a.close - b.close);
    for (const [fl, ok] of Object.entries(FILTERS)) { let busy = 0;
      for (const g of sig) { if (g.close < busy || !ok(g)) continue; const t = simulate(g, M, key, sub(src, g.close), Infinity); if (!t || !t.closed) continue; push(`${name}-${fl}`, g, t); busy = t.closed; } }
  }
  { const sig = gaps(src.H, src.D, M.tick).filter(inWin);
    for (const kind of ['nwog', 'ndog']) for (const fl of ['', '-floor']) { let busy = 0;
      for (const g of sig.filter((x) => x.model === kind && (!fl || x.feat.atrR >= FLOOR))) { if (g.close < busy) continue; const t = simGap(g, src); if (!t) continue; push(`gap-${kind}${fl}`, g, t); busy = t.closed; } } }
  console.log(key, JSON.stringify(out.src[key]), Object.entries(out.trades.filter((t) => t.market === key).reduce((a, t) => ((a[t.stream] = (a[t.stream] || 0) + 1), a), {})).map((x) => x.join(':')).join(' '));
}

export function stats(A) {
  const r = A.map((t) => t.R), n = r.length; if (!n) return { n: 0 };
  const sum = r.reduce((a, x) => a + x, 0), m = sum / n, sd = Math.sqrt(r.reduce((a, x) => a + (x - m) ** 2, 0) / Math.max(1, n - 1));
  let eq = 0, pk = 0, dd = 0; for (const x of r) { eq += x; pk = Math.max(pk, eq); dd = Math.max(dd, pk - eq); }
  return { n, wr: +(r.filter((x) => x > 0).length / n).toFixed(3), exp: +m.toFixed(3), R: +sum.toFixed(1), maxDD: +dd.toFixed(1), t: +(sd ? (m / sd) * Math.sqrt(n) : 0).toFixed(2) };
}
out.trades.sort((a, b) => a.closed - b.closed);
out.summary = {};
for (const st of [...new Set(out.trades.map((t) => t.stream))]) {
  const T = out.trades.filter((t) => t.stream === st), h1 = T.filter((t) => t.at < MID), h2 = T.filter((t) => t.at >= MID);
  const all = stats(T), a = stats(h1), b = stats(h2);
  out.summary[st] = { all, h1: a, h2: b, buys: stats(T.filter((t) => t.side > 0)), sells: stats(T.filter((t) => t.side < 0)),
    byMarket: Object.fromEntries(MK.map((k) => [k, stats(T.filter((t) => t.market === k))])),
    pass: all.n >= 30 && Math.abs(all.t) >= 2 && a.R > 0 && b.R > 0 };
}
fs.writeFileSync(OUT, JSON.stringify(out));
const f = (s) => (s.n ? `${s.n} ${(s.wr * 100).toFixed(0)}% ${s.exp >= 0 ? '+' : ''}${s.exp} ${s.R >= 0 ? '+' : ''}${s.R}R dd${s.maxDD} t${s.t}` : '0');
for (const [st, s] of Object.entries(out.summary)) console.log(st.padEnd(10), f(s.all).padEnd(40), '| H1', f(s.h1).padEnd(36), '| H2', f(s.h2).padEnd(36), s.pass ? 'PASS' : 'fail', '|', Object.entries(s.byMarket).map(([k, v]) => `${k} ${v.n ? `${v.n}/${v.R}R` : '-'}`).join(' '));
