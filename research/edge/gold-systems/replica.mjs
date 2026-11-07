// Gold replica on 2018-2026 spot gold M1, the live code path of council/trader.mjs:
//   replicaSignals (verbatim) on every M5 close, run 4 min later (the live entry lag); v5 = pass (clear of live H1 Origins or the
//   star engulfing, stop >= 1 M15 ATR) and the H4 trend against; goldD1With (D1 trend with); volatility gate goldVolPct (top fifth
//   of the last 365 daily 20-day ranges); risk rules (max 3 open, -1.5R day stop, half size under the 50-trade equity average);
//   replicaMsnrSize (1.5x when the H4 MSNR direction is against, 0.5x with); news veto 08:25-08:45 ET; round-number stops;
//   exits: BE at +2R, add at +1.5R (stop at first entry), after +4R trail 1R (cap 10R), out after 48 h.
// Usage: node replica.mjs  -> writes $OUT_DIR/replica.json
import fs from 'node:fs';
import { buildContext, step, unitR, marketOpen, nyMin, report, span, stats, COST, IS_END, yearOf } from './core.mjs';
import { LIVE } from './live.mjs';

const OUT = process.env.OUT_DIR || '.';
const ctx = buildContext(), { m, bars, A, trend, nClosed } = ctx;
console.error('context ready');

// ── 1. signals ──
const sigFile = `${OUT}/replica-signals.json`;
let SIG;
if (fs.existsSync(sigFile)) SIG = JSON.parse(fs.readFileSync(sigFile, 'utf8'));
else {
  SIG = []; const seen = new Set(), msnrCache = new Map();
  const h1ev = A.h1.events;
  const ph = { time: 0, open: 0, high: 0, low: 0, close: 0 };   // forming-bar placeholder (replicaSignals drops the last bar)
  for (let j = 120; j < bars.m5.length; j++) {
    const c = bars.m5[j].time + 300, T = c + 240;
    if (!marketOpen(T)) continue;
    const k0 = ctx.lb(T); if (k0 >= m.n || m.T[k0] - T > 120) continue;   // need the run's minute
    const price = m.C[k0 - 1];
    const n15 = nClosed('m15', T), nh = nClosed('h1', T);
    if (n15 < 40 || nh < 30) continue;
    const src = { '5m': { bars: bars.m5.slice(j + 1 - 120, j + 1).concat([ph]) }, '15m': { bars: bars.m15.slice(n15 - 60, n15).concat([ph]) }, '1h': { bars: bars.h1.slice(nh - 30, nh) } };
    let sigs; try { sigs = LIVE.replicaSignals(src); } catch (e) { continue; }
    for (const g of sigs) {
      const key = `${g.sell ? 's' : 'b'}|${g.tc}`; if (seen.has(key)) continue; seen.add(key);
      const entry = price, buf = Math.max(0.1 * g.atr, 0.3), stop0 = g.sell ? g.ext + buf : g.ext - buf, r00 = Math.abs(entry - stop0);
      if (!(r00 > 0) || (g.sell ? entry >= stop0 : entry <= stop0)) continue;
      let stop = stop0; { const rn = g.sell ? Math.ceil(stop0 / 10) * 10 : Math.floor(stop0 / 10) * 10; if (Math.abs(stop0 - rn) <= 2) stop = g.sell ? rn + 0.5 : rn - 0.5; }
      const r0 = Math.abs(entry - stop);
      let h1clear = true;
      for (let q = h1ev.length - 1; q >= 0; q--) { const e = h1ev[q]; if (e.breakIdx >= nh) continue; if (e.breakIdx < nh - 720) break;
        if ((e.endIdx == null || e.endIdx >= nh) && e.top > e.bot && entry <= e.top && entry >= e.bot) { h1clear = false; break; } }
      const riskAtr = r00 / g.atr, pass = (h1clear || g.star) && riskAtr >= 1;
      const nh4 = nClosed('h4', T), nd = nClosed('d1', T), dir = g.sell ? -1 : 1;
      const t4 = trend.h4[nh4 - 1], td = trend.d1[nd - 1];
      const h4 = t4 === -dir ? 'against' : t4 === dir ? 'with' : 'none', v5 = pass && h4 === 'against', d1w = td === dir;
      let msnr = null;
      if (v5) { const ck = nh4 * 100000 + nd; let md = msnrCache.get(ck);
        if (md == null) { try { md = LIVE.msnrDirection(bars.h4.slice(Math.max(0, nh4 - 720), nh4), bars.d1.slice(Math.max(0, nd - 720), nd)); } catch (e) { md = 0; } msnrCache.set(ck, md); }
        msnr = md === 0 ? 'none' : md === dir ? 'with' : 'against'; }
      const ny = nyMin(T), news = !['Sat', 'Sun'].includes(ny.wd) && ny.m >= 505 && ny.m <= 525;
      SIG.push({ T, k0, side: dir, entry, stop, r0, tc: g.tc, lag: T - g.tc - 300, pass, v5, h4, d1w, msnr, news, nd, star: g.star, h1clear });
    }
    if (j % 50000 === 0) console.error(new Date(T * 1000).toISOString().slice(0, 10), SIG.length);
  }
  fs.writeFileSync(sigFile, JSON.stringify(SIG));
}
console.error('signals', SIG.length, 'v5', SIG.filter((s) => s.v5).length, 'v5+d1', SIG.filter((s) => s.v5 && s.d1w).length);

// ── 2. portfolio (the live risk rules) ──
const GATES = {
  p80: (s) => { const th = ctx.volPct(s.nd, 80); return th != null && ctx.vol20[s.nd] >= th; },
  p67: (s) => { const th = ctx.volPct(s.nd, 66.67); return th != null && ctx.vol20[s.nd] >= th; },
  p50: (s) => { const th = ctx.volPct(s.nd, 50); return th != null && ctx.vol20[s.nd] >= th; },
  none: () => true,
  fix15: (s) => ctx.vol20[s.nd] >= 1.5,
  p80or15: (s) => { const th = ctx.volPct(s.nd, 80); return ctx.vol20[s.nd] >= 1.5 || (th != null && ctx.vol20[s.nd] >= th); },
};
function mkTrade(s, size, mg) {
  const r0 = s.r0, d = s.side;
  const tr = { side: d, entry: s.entry, stop: s.stop, r0, size, opened: s.T, filled: s.T, status: 'open', k0: s.k0, maxHold: 48 * 3600, sig: s };
  if (mg === 'live') Object.assign(tr, { t1: s.entry + d * 10 * r0, rr: 10, trail: [4, 1], beAt: 2, addAt: 1.5 });
  else if (mg === 'fixed4be') Object.assign(tr, { t1: s.entry + d * 4 * r0, rr: 4, beAt: 2 });
  return tr;
}
// rules: {gate, d1With, msnrSize, risk, news, mg}
function portfolio(rule) {
  const gate = GATES[rule.gate];
  const open = [], closed = [], positions = [];
  let kNow = 0;
  const advance = (kEnd) => {   // run every open leg through M1 bars [its pointer, kEnd)
    for (let q = 0; q < open.length; q++) { const x = open[q];
      for (let k = Math.max(x.k ?? x.k0, x.k0); k < kEnd; k++) { const a = step(x, m, k); x.k = k + 1; if (a) { a.k = a.k0; a.parent = x.parent || x; (x.parent || x).legs.push(a); open.push(a); } if (x.done) break; } }
    for (let q = open.length - 1; q >= 0; q--) if (open[q].done) closed.push(open.splice(q, 1)[0]);
  };
  for (const s of SIG) {
    if (!s.v5) continue;
    advance(s.k0); kNow = s.k0;
    if (s.lag > 480) continue;
    if (!gate(s)) continue;
    if (rule.d1With && !s.d1w) continue;
    if (rule.news && s.news) continue;
    if (rule.risk) {
      if (open.filter((x) => !x.parent).length >= 3) continue;
      const day = Math.floor(s.T / 86400), dayR = closed.filter((x) => Math.floor(x.closed / 86400) === day).reduce((a, x) => a + x.R * (x.size || 1), 0);
      if (dayR <= -1.5) continue;
    }
    let size = 1;
    if (rule.risk) { const hist = closed.slice().sort((a, b) => a.closed - b.closed);
      if (hist.length > 50) { let e = 0; const eq = hist.map((x) => (e += x.R)); const avg = eq.slice(-50).reduce((a, v) => a + v, 0) / 50; if (eq.at(-1) < avg) size = 0.5; } }
    if (rule.msnrSize) { if (s.msnr === 'against') size *= 1.5; else if (s.msnr === 'with') size *= 0.5; }
    const tr = mkTrade(s, size, rule.mg || 'live'); tr.legs = [tr]; open.push(tr); positions.push(tr);
  }
  advance(m.n);
  for (const x of open) { const k = m.n - 1; x.R = (x.side < 0 ? x.entry - m.C[k] : m.C[k] - x.entry) / x.r0; x.closed = m.T[k]; x.done = true; }
  return positions.map((p) => { let g = 0, n = 0, c = 0; for (const x of p.legs) { const u = unitR(x); g += u.g; n += u.n; c = Math.max(c, x.closed); } return { t: p.opened, c, g, n, msnr: p.sig.msnr, nd: p.sig.nd }; });
}

const RES = { variants: {} };
const LIVE_RULE = { gate: 'p80', d1With: true, msnrSize: true, risk: true, news: true, mg: 'live' };
const VARS = {
  live: LIVE_RULE,
  gate_p67: { ...LIVE_RULE, gate: 'p67' },
  gate_p50: { ...LIVE_RULE, gate: 'p50' },
  gate_none: { ...LIVE_RULE, gate: 'none' },
  gate_fix15: { ...LIVE_RULE, gate: 'fix15' },
  gate_p80or15: { ...LIVE_RULE, gate: 'p80or15' },
  live_noMsnrSize: { ...LIVE_RULE, msnrSize: false },
  live_fixed4be: { ...LIVE_RULE, mg: 'fixed4be', msnrSize: false },
  v5_d1_unfiltered: { gate: 'none', d1With: true, msnrSize: false, risk: false, news: false, mg: 'live' },
};
for (const [name, rule] of Object.entries(VARS)) {
  const rows = portfolio(rule);
  RES.variants[name] = { rule, ...report(rows), s2023_24: span(rows, 2023, 2024), s2025_26: span(rows, 2025, 2026), s2019_22: span(rows, 2019, 2022) };
  if (name === 'v5_d1_unfiltered') {
    // signal-level split by volatility rank (each v5 + D1-with signal as an independent unit position with the live exits)
    const bk = [[0, 50], [50, 67], [67, 80], [80, 101]];
    RES.volBuckets = {};
    for (const [a, b] of bk) {
      const sel = rows.filter((r) => { const v = ctx.volRank(r.nd); return v != null && v >= a && v < b; });
      RES.volBuckets[`${a}-${Math.min(b, 100)}`] = { is: stats(sel.filter((r) => r.t < IS_END)), oos: stats(sel.filter((r) => r.t >= IS_END)), years: Object.fromEntries([2019, 2020, 2021, 2022, 2023, 2024, 2025, 2026].map((y) => [y, stats(sel.filter((r) => yearOf(r.t) === y)).R])) };
    }
  }
  console.error(name, JSON.stringify({ is: RES.variants[name].is, oos: RES.variants[name].oos }));
}
// current gate reading on the last day of data
const ndL = bars.d1.length;
RES.gateNow = { date: new Date(bars.d1[ndL - 1].time * 1000).toISOString().slice(0, 10), vol20: +ctx.vol20[ndL].toFixed(3), p80: +ctx.volPct(ndL, 80).toFixed(3), p67: +ctx.volPct(ndL, 66.67).toFixed(3), p50: +ctx.volPct(ndL, 50).toFixed(3) };
// fraction of days each gate is open, per year
RES.gateOpenDays = {};
for (const g of ['p80', 'p67', 'p50', 'fix15']) { RES.gateOpenDays[g] = {};
  for (let y = 2019; y <= 2026; y++) { const ds = []; for (let nd = 21; nd <= ndL; nd++) if (yearOf(bars.d1[nd - 1].time) === y) ds.push(nd); RES.gateOpenDays[g][y] = +(ds.filter((nd) => GATES[g]({ nd })).length / Math.max(1, ds.length)).toFixed(2); } }
fs.writeFileSync(`${OUT}/replica.json`, JSON.stringify(RES, null, 1));
console.error('gate now', RES.gateNow);
