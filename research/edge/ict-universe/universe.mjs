// ICT universe test (edge research, 7 Nov 2026). Does the live ICT desk's H1 iFVG model, with its rules UNCHANGED, have an
// edge outside GC? Drives the desk's own code: signals()/isASetup()/sizeOf()/MIN_GRADE from ict/tracker.mjs and simulate()
// (post-#413 gap guard) from ict/replay.mjs, over HistData M1 2018-2026 (council/histdata.mjs clock; fixed UTC-5 before 10 Nov 2026), resampled to 5m (exits),
// H1 (signals) and D1 (17:00 New York rollover, DST-aware). The CME halt hour (17:00 ET) is dropped like the tracker's feed.
// Busy rule as replay.mjs: one trade per market; an A-setup is blocked only by an open A-setup. Paper research only.
//
//   ICTU_DATA=<dir with research/candles/...> node research/edge/ict-universe/universe.mjs [out.json]
import fs from 'node:fs';
import path from 'node:path';
import zlib from 'node:zlib';
import { MARKETS, MIN_GRADE, signals, isASetup, sizeOf, inHalt } from '../../../ict/tracker.mjs';
import { simulate } from '../../../ict/replay.mjs';
import { histStampUtc } from '../../../council/histdata.mjs';   // the shared HistData clock

const DIR = process.env.ICTU_DATA || 'research/candles';
const OUT = process.argv[2] || 'research/edge/ict-universe/trades.json';
const ONLY = process.env.ICTU_ONLY ? process.env.ICTU_ONLY.split(',') : null;

// cost = one round-trip spread + 1 tick slippage, in price units (council backtest spreadOf() as the floor; JPY in its own pips,
// silver at a realistic CFD spread, gold as the ICT skill §12 test: 0.30 spread + 0.20 extra)
const U = {
  gc:     { dir: 'xau-histdata',    pre: 'XAUUSD', M: { ...MARKETS.gc },                                                 cost: () => 0.5 },
  nas100: { dir: 'nsxusd-histdata', pre: 'NSXUSD', M: { label: 'NAS100 cash', short: 'NAS', tick: 0.25, dec: 2 },        cost: (p) => p * 0.0002 + 0.25 },
  spx:    { dir: 'spxusd-histdata', pre: 'SPXUSD', M: { label: 'SPX cash', short: 'SPX', tick: 0.25, dec: 2 },           cost: (p) => p * 0.0002 + 0.25 },
  eurusd: { dir: 'EURUSD', pre: 'EURUSD', M: { label: 'EUR/USD', short: 'EURUSD', tick: 0.00005, dec: 5 }, cost: () => 0.00015 },
  gbpusd: { dir: 'GBPUSD', pre: 'GBPUSD', M: { label: 'GBP/USD', short: 'GBPUSD', tick: 0.00005, dec: 5 }, cost: () => 0.0002 },
  audusd: { dir: 'AUDUSD', pre: 'AUDUSD', M: { label: 'AUD/USD', short: 'AUDUSD', tick: 0.00005, dec: 5 }, cost: () => 0.00015 },
  usdcad: { dir: 'USDCAD', pre: 'USDCAD', M: { label: 'USD/CAD', short: 'USDCAD', tick: 0.00005, dec: 5 }, cost: () => 0.0002 },
  usdchf: { dir: 'USDCHF', pre: 'USDCHF', M: { label: 'USD/CHF', short: 'USDCHF', tick: 0.00005, dec: 5 }, cost: () => 0.0002 },
  usdjpy: { dir: 'USDJPY', pre: 'USDJPY', M: { label: 'USD/JPY', short: 'USDJPY', tick: 0.005, dec: 3 },   cost: () => 0.015 },
  xagusd: { dir: 'XAGUSD', pre: 'XAGUSD', M: { label: 'Silver', short: 'XAG', tick: 0.005, dec: 3 },       cost: () => 0.03 },
};

// M1 csv.gz (YYYYMMDD HHMMSS;o;h;l;c;v; clock: council/histdata.mjs) -> 5m bars in UTC, halt hour dropped
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
// New York offset (DST-aware) for the D1 rollover at 17:00 ET; a D1 candle is stamped so that time + 86400 = its close
const NYF = new Intl.DateTimeFormat('en-US', { timeZone: 'America/New_York', timeZoneName: 'shortOffset' });
const nyOff = (t) => { const p = NYF.formatToParts(new Date(t * 1000)).find((x) => x.type === 'timeZoneName').value; return p.includes('-4') ? 4 : 5; };
function daily(H) {
  const out = []; let cur = null, key = null;
  for (const b of H) { const off = nyOff(b.time), loc = b.time - off * 3600 + 7 * 3600;   // shift so 17:00 ET becomes midnight
    const day = Math.floor(loc / 86400);
    if (day !== key) { key = day; const closeUtc = (day + 1) * 86400 - 7 * 3600 + off * 3600; cur = { time: closeUtc - 86400, open: b.open, high: b.high, low: b.low, close: b.close }; out.push(cur); }
    else { cur.high = Math.max(cur.high, b.high); cur.low = Math.min(cur.low, b.low); cur.close = b.close; } }
  return out;
}
const lb = (A, t) => { let lo = 0, hi = A.length; while (lo < hi) { const m = (lo + hi) >> 1; if (A[m].time < t) lo = m + 1; else hi = m; } return lo; };

const res = { at: new Date().toISOString(), cost: {}, src: {}, trades: [] };
for (const [key, u] of Object.entries(U)) {
  if (ONLY && !ONLY.includes(key)) continue;
  const t0 = Date.now(), m5 = load(u), H = aggH(m5), D = daily(H);
  const days = new Map(); for (const b of m5) { const d = Math.floor(b.time / 86400); days.set(d, (days.get(d) || 0) + 1); }
  const m5days = new Set([...days.entries()].filter(([, n]) => n >= 200).map(([d]) => d));
  res.src[key] = { m5: m5.length, h1: H.length, d1: D.length, from: new Date(m5[0].time * 1000).toISOString().slice(0, 10), to: new Date(m5.at(-1).time * 1000).toISOString().slice(0, 10) };
  // the desk runs each new market under one of its two unchanged rule sets: the index default (no aRule: A = against the daily
  // bias, grade >= 7, stop 0.3-0.75x ATR (+ tight A+ at half size), DOL sizing, break-even at +1.5R) or the gold rule (aRule
  // 'gold': A = buys with a 0.3-0.75x ATR stop, size 1, no break-even). Every market is run under both; GC as live (gold).
  const cfgs = key === 'gc' ? ['gold', 'index'] : ['index', 'gold'];
  for (const cfg of cfgs) {
    const M = { ...u.M, aRule: cfg === 'gold' ? 'gold' : undefined }, mk = cfg === 'gold' ? 'gc' : 'nq';   // mk: which rule isASetup()/sizeOf() apply
    const sig = signals(H, D, 1, M.tick).concat(signals(H, D, -1, M.tick)).filter((g) => g.grade.total >= MIN_GRADE).sort((a, b) => a.close - b.close);
    let busyAll = 0, busyA = 0, gaps = 0;
    for (const g of sig) {
      const a = isASetup(g, mk); if (g.close < (a ? busyA : busyAll)) continue;
      const i = lb(H, g.close), j = lb(m5, g.close);
      const src = { H: H.slice(i, i + 120), m5: m5.slice(j, j + 12 * 24 * 12), m5days };
      const t = simulate(g, M, key, src); if (!t) { gaps++; continue; }
      if (!t.closed) continue;
      const size = a ? sizeOf(g, mk) : 1, c = u.cost(g.entry) / g.r0;
      res.trades.push([key, cfg, t.side === 'buy' ? 1 : -1, g.close, a ? 1 : 0, size, +t.R.toFixed(3), +c.toFixed(4), g.feat.session, g.feat.atrR, g.feat.bias === 'against' ? 1 : 0, g.grade.total, t.exit, t.res, t.closed]);
      const end = t.closed; busyAll = Math.max(busyAll, end); if (a) busyA = end;
    }
    res.src[key][cfg] = { signals: sig.length, gaps };
  }
  // drift control (not a rule): random H1-close entries, buys ('ctrlbuy') and sells ('ctrlsell'), stop 0.3-0.75x the daily ATR14
  // (the gold rule's band), same simulate() exit as the gold rule (trail from +2R, 36 H1 max, no break-even), same costs.
  // Tells how much of a buys-only rule's R is just the market's drift in that year.
  let seed = 12345; const rnd = () => ((seed = (seed * 1103515245 + 12345) % 2147483648) / 2147483648);
  for (let i = 60; i < H.length - 40; i++) {
    if (rnd() > 0.04) continue;
    const close = H[i].time + 3600, di = D.findLastIndex((d) => d.time + 86400 <= close); if (di < 14) continue;
    const atrD = D.slice(di - 13, di + 1).reduce((a, d) => a + (d.high - d.low), 0) / 14, k = 0.3 + 0.45 * rnd();
    for (const s of [1, -1]) {
      const e = H[i].close, r0 = k * atrD, g = { side: s, entry: e, r0, stop: e - s * r0, close, t: H[i].time, sweepT: H[i].time, swept: e, fvg: [e, e], ih: null, dol: null, valid: true, feat: {}, grade: { total: 0 } };
      const j = lb(m5, close), t = simulate(g, { ...u.M, aRule: 'gold' }, key, { H: H.slice(i + 1, i + 121), m5: m5.slice(j, j + 12 * 24 * 12), m5days });
      if (!t || !t.closed) continue;
      res.trades.push([key, s > 0 ? 'ctrlbuy' : 'ctrlsell', s, close, 1, 1, +t.R.toFixed(3), +(u.cost(e) / r0).toFixed(4), null, +k.toFixed(3), null, null, t.exit, t.res, t.closed]);
    }
  }
  res.cost[key] = u.cost.toString();
  console.log(key, JSON.stringify(res.src[key]), ((Date.now() - t0) / 1000).toFixed(0) + 's');
}
res.cols = ['market', 'cfg', 'side', 'close', 'aset', 'size', 'Rraw', 'costR', 'session', 'atrR', 'against', 'grade', 'exit', 'res', 'closed'];   // closed (exit time) added for research/edge/ict-smile's halves
fs.mkdirSync(path.dirname(OUT), { recursive: true });
fs.writeFileSync(OUT, JSON.stringify(res));
console.log('trades', res.trades.length);
