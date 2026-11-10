// ICT index long-only test (edge research, 7 Nov 2026). ict-universe found the gold A-rule (buys, stop 0.3-0.75x D1 ATR, size 1,
// no break-even) passes on NAS100/SPX cash. Is that an edge or just being long equities 2018-26? This script runs, per market:
//   goldbuy  : desk gold A-rule as is (isASetup(g,'gc')): buys only
//   goldsell : the exact mirror (sells with the same stop band, size 1, gold exit) - the drift test
//   index    : the desk's current index A-rule (isASetup(g,'nq'), sizeOf, break-even at +1.5R), both directions
//   ctrlbuy / ctrlsell : random H1-close entries (1 in 10 candles), stop 0.3-0.75x D1 ATR, gold exit, same costs
// and tags every trade with past-only regime features at the signal: last completed D1 close vs its 200-day MA, and the 20-day
// return sign. Signals/A-filters/sizing come from ict/tracker.mjs and exits from ict/replay.mjs simulate(), unchanged. The loader
// is copied from research/edge/ict-universe/universe.mjs (HistData -> UTC with council/histdata.mjs, +5 h before 10 Nov 2026, 5m / H1 / D1 17:00 NY, halt hour dropped).
//
//   ICTU_DATA=<dir with nsxusd-histdata/ spxusd-histdata/> node research/edge/ict-index-longonly/run.mjs <market> <out.json>
import fs from 'node:fs';
import path from 'node:path';
import zlib from 'node:zlib';
import { MIN_GRADE, signals, isASetup, sizeOf, inHalt, RISK_FLOOR, RISK_CAP } from '../../../ict/tracker.mjs';
import { simulate } from '../../../ict/replay.mjs';
import { histStampUtc } from '../../../council/histdata.mjs';   // the shared HistData clock

const DIR = process.env.ICTU_DATA || 'research/candles';
const KEY = process.argv[2], OUT = process.argv[3];
const U = {
  nas100: { dir: 'nsxusd-histdata', pre: 'NSXUSD', M: { label: 'NAS100 cash', short: 'NAS', tick: 0.25, dec: 2 }, cost: (p) => p * 0.0002 + 0.25 },
  spx:    { dir: 'spxusd-histdata', pre: 'SPXUSD', M: { label: 'SPX cash', short: 'SPX', tick: 0.25, dec: 2 },    cost: (p) => p * 0.0002 + 0.25 },
};
const u = U[KEY];

function load(u) {
  const d = path.join(DIR, u.dir), files = fs.readdirSync(d).filter((f) => f.startsWith(u.pre) && f.endsWith('.csv.gz')).sort();
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
const aggH = (bars) => { const out = []; let cur = null; for (const b of bars) { const k = b.time - (b.time % 3600);
  if (cur && cur.time === k) { cur.high = Math.max(cur.high, b.high); cur.low = Math.min(cur.low, b.low); cur.close = b.close; } else { cur = { ...b, time: k }; out.push(cur); } } return out; };
const NYF = new Intl.DateTimeFormat('en-US', { timeZone: 'America/New_York', timeZoneName: 'shortOffset' });
const nyOff = (t) => { const p = NYF.formatToParts(new Date(t * 1000)).find((x) => x.type === 'timeZoneName').value; return p.includes('-4') ? 4 : 5; };
function daily(H) {
  const out = []; let cur = null, key = null;
  for (const b of H) { const off = nyOff(b.time), loc = b.time - off * 3600 + 7 * 3600;
    const day = Math.floor(loc / 86400);
    if (day !== key) { key = day; const closeUtc = (day + 1) * 86400 - 7 * 3600 + off * 3600; cur = { time: closeUtc - 86400, open: b.open, high: b.high, low: b.low, close: b.close }; out.push(cur); }
    else { cur.high = Math.max(cur.high, b.high); cur.low = Math.min(cur.low, b.low); cur.close = b.close; } }
  return out;
}
const lb = (A, t) => { let lo = 0, hi = A.length; while (lo < hi) { const m = (lo + hi) >> 1; if (A[m].time < t) lo = m + 1; else hi = m; } return lo; };

const t0 = Date.now(), m5 = load(u), H = aggH(m5), D = daily(H);
const days = new Map(); for (const b of m5) { const d = Math.floor(b.time / 86400); days.set(d, (days.get(d) || 0) + 1); }
const m5days = new Set([...days.entries()].filter(([, n]) => n >= 200).map(([d]) => d));
// past-only regime at time `close`: the last D1 candle that has closed by then
const ma = []; { let s = 0; for (let i = 0; i < D.length; i++) { s += D[i].close; if (i >= 200) s -= D[i - 200].close; ma.push(i >= 199 ? s / 200 : null); } }
const Dclose = D.map((d) => d.time + 86400);
function regime(close) {
  let lo = 0, hi = D.length; while (lo < hi) { const m = (lo + hi) >> 1; if (Dclose[m] <= close) lo = m + 1; else hi = m; } const di = lo - 1;
  if (di < 20) return { ma200: null, r20: null };
  return { ma200: ma[di] == null ? null : D[di].close > ma[di] ? 1 : -1, r20: D[di].close > D[di - 20].close ? 1 : -1 };
}
const out = { market: KEY, cols: ['stream', 'side', 'close', 'size', 'Rraw', 'costR', 'ma200', 'r20', 'atrR', 'exit'], trades: [] };
const push = (stream, side, close, size, R, c, atrR, exit) => { const rg = regime(close); out.trades.push([stream, side, close, size, +R.toFixed(3), +c.toFixed(4), rg.ma200, rg.r20, atrR == null ? null : +(+atrR).toFixed(3), exit]); };

const sig = signals(H, D, 1, u.M.tick).concat(signals(H, D, -1, u.M.tick)).filter((g) => g.grade.total >= MIN_GRADE).sort((a, b) => a.close - b.close);
const band = (g) => !!g.feat && g.feat.atrR != null && g.feat.atrR >= RISK_FLOOR && g.feat.atrR < RISK_CAP;
const STREAMS = {
  goldbuy: { A: (g) => isASetup(g, 'gc'), M: { ...u.M, aRule: 'gold' }, size: () => 1 },
  goldsell: { A: (g) => g.side < 0 && band(g), M: { ...u.M, aRule: 'gold' }, size: () => 1 },
  index: { A: (g) => isASetup(g, 'nq'), M: { ...u.M }, size: (g) => sizeOf(g, 'nq') },
};
for (const [name, S] of Object.entries(STREAMS)) {
  let busy = 0, gaps = 0;
  for (const g of sig) {
    if (!S.A(g) || g.close < busy) continue;
    const i = lb(H, g.close), j = lb(m5, g.close);
    const t = simulate(g, S.M, KEY, { H: H.slice(i, i + 120), m5: m5.slice(j, j + 12 * 24 * 12), m5days });
    if (!t) { gaps++; continue; } if (!t.closed) continue;
    push(name, t.side === 'buy' ? 1 : -1, g.close, S.size(g), t.R, u.cost(g.entry) / g.r0, g.feat.atrR, t.exit);
    busy = t.closed;
  }
  console.log(KEY, name, 'gaps', gaps);
}
// random controls (not rules): 1 in 10 H1 closes, both sides, stop 0.3-0.75x D1 ATR14, gold exit (trail from +2R, 36 H1, no BE)
let seed = 777; const rnd = () => ((seed = (seed * 1103515245 + 12345) % 2147483648) / 2147483648);
for (let i = 60; i < H.length - 40; i++) {
  if (rnd() > 0.1) continue;
  const close = H[i].time + 3600; let lo = 0, hi = D.length; while (lo < hi) { const m = (lo + hi) >> 1; if (Dclose[m] <= close) lo = m + 1; else hi = m; } const di = lo - 1; if (di < 14) continue;
  const atrD = D.slice(di - 13, di + 1).reduce((a, d) => a + (d.high - d.low), 0) / 14, k = 0.3 + 0.45 * rnd();
  for (const s of [1, -1]) {
    const e = H[i].close, r0 = k * atrD, g = { side: s, entry: e, r0, stop: e - s * r0, close, t: H[i].time, sweepT: H[i].time, swept: e, fvg: [e, e], ih: null, dol: null, valid: true, feat: {}, grade: { total: 0 } };
    const j = lb(m5, close), t = simulate(g, { ...u.M, aRule: 'gold' }, KEY, { H: H.slice(i + 1, i + 121), m5: m5.slice(j, j + 12 * 24 * 12), m5days });
    if (!t || !t.closed) continue;
    push(s > 0 ? 'ctrlbuy' : 'ctrlsell', s, close, 1, t.R, u.cost(e) / r0, k, t.exit);
  }
}
fs.writeFileSync(OUT, JSON.stringify(out));
console.log(KEY, 'trades', out.trades.length, 'H1', H.length, 'D1', D.length, ((Date.now() - t0) / 1000).toFixed(0) + 's');
