// Mosha breakout system on 2018-2026 spot gold M1, the live code path of council/trader.mjs (config.moshaBo):
//   engine events (msAnalyze N=6) on M15 / H1 / H4; chain = H4 BO dir d, then H1 BO -d after it, then an M15 BO d (the newest);
//   limit at the broken M15 level, stop 0.3 past the M15 Origin (top/bot), r0 > 0.5, valid 24 h, out after 72 h;
//   moshaBoWeekly: the weekly structure (Monday weeks from the last 720 daily candles, msAnalyze swing 3) agrees;
//   moshaSlow 12: a pullback from the H1 VR extreme to the M15 CF under 12 H1 bars is shadow; cap 2 live open/pending (adds count);
//   live exits: BE at +1.5R, add at +1.5R, after +3R trail 1R (cap 10R). Approved base: fixed 3R, no BE/add.
import fs from 'node:fs';
import { buildContext, step, unitR, report, span, stats, IS_END, yearOf } from './core.mjs';
import { msAnalyze } from './live.mjs';

const OUT = process.env.OUT_DIR || '.';
const ctx = buildContext(), { m, bars, A, nClosed } = ctx;
const ev = (k, sec) => A[k].events.map((e) => ({ t: bars[k][e.breakIdx].time + sec, dir: e.dir, level: e.level, top: e.top, bot: e.bot, flip: e.structure }));
const E3 = ev('m15', 900), E2 = ev('h1', 3600), E1 = ev('h4', 14400);
const before = (E, t) => { let lo = 0, hi = E.length; while (lo < hi) { const md = (lo + hi) >> 1; if (E[md].t <= t) lo = md + 1; else hi = md; } return lo ? E[lo - 1] : null; };
function weeklyAt(t) {   // live: daily candles of the last 720 days, Monday weeks, swing 3; direction of the last BO on a closed week
  const D = bars.d1, nd = nClosed('d1', t) + 1;   // + the forming day (CNBC returns it)
  const dly = D.slice(0, nd).filter((b) => b.time >= t - 720 * 86400);
  const wk = [];
  for (const b of dly) { const k = Math.floor((b.time - 345600) / 604800) * 604800 + 345600, c = wk.at(-1);
    if (!c || c.time !== k) wk.push({ time: k, open: b.open, high: b.high, low: b.low, close: b.close }); else { c.high = Math.max(c.high, b.high); c.low = Math.min(c.low, b.low); c.close = b.close; } }
  const wEv = msAnalyze(wk, 3).events.map((e) => ({ t: wk[e.breakIdx].time + 604800, dir: e.dir })).filter((e) => e.t <= t);
  return (wEv.at(-1) || { dir: 0 }).dir;
}
const chains = [];
for (const e3 of E3) {
  const T = e3.t + 240, k0 = ctx.lb(T); if (k0 >= m.n || m.T[k0] - T > 3600) continue;
  const e2 = before(E2, e3.t), e1 = before(E1, e3.t), d = e3.dir;
  if (!(e1 && e2 && e1.dir === d && e2.dir === -d && e2.t > e1.t)) continue;
  const entry = e3.level, stop = d < 0 ? e3.top + 0.3 : e3.bot - 0.3, r0 = Math.abs(entry - stop);
  if (!(r0 > 0.5)) continue;
  const price = m.C[k0 - 1];
  // pull: H1 bars from the VR extreme (after the H1 BO) to the M15 CF (closed H1 bars only for the extreme)
  const hb = bars.h1; let pull = null;
  { const i2 = hb.findIndex((b) => b.time >= e2.t); let ext = d < 0 ? Infinity : -Infinity, iE = i2;
    if (i2 >= 0) { for (let i = i2; i < hb.length && hb[i].time + 3600 <= e3.t; i++) if (d < 0 ? hb[i].low < ext : hb[i].high > ext) { ext = d < 0 ? hb[i].low : hb[i].high; iE = i; }
      if (isFinite(ext)) { pull = 0; for (let i = iE + 1; i < hb.length && hb[i].time < e3.t; i++) pull++; } } }
  chains.push({ T, k0, d, entry, stop, r0, price, w1: weeklyAt(e3.t), flip: e3.flip, pull, priceOk: d < 0 ? price < stop : price > stop });
}
console.error('chains', chains.length);

function run(rule) {
  const open = [], closed = [], pos = [];
  const advance = (kEnd) => {
    for (let q = 0; q < open.length; q++) { const x = open[q];
      for (let k = x.k; k < kEnd; k++) { const a = step(x, m, k); x.k = k + 1; if (a) { a.k = a.k0; a.parent = x.parent || x; (x.parent || x).legs.push(a); open.push(a); } if (x.done) break; } }
    for (let q = open.length - 1; q >= 0; q--) if (open[q].done) closed.push(open.splice(q, 1)[0]);
  };
  for (const c of chains) {
    advance(c.k0);
    if (rule.weekly && c.w1 !== c.d) continue;
    if (rule.flip && !c.flip) continue;
    if (!c.priceOk) continue;
    if (rule.slow && c.pull != null && c.pull < rule.slow) continue;
    if (rule.fast && !(c.pull != null && c.pull < rule.fast)) continue;
    if (rule.cap && open.length >= 2) continue;   // live counts open/pending mosha trades incl. adds
    const tr = { side: c.d, entry: c.entry, stop: c.stop, r0: c.r0, opened: c.T, status: 'pending', expireAt: c.T + 24 * 3600, maxHold: 72 * 3600, k0: c.k0, k: c.k0, size: 1 };
    if (rule.mg === 'live') Object.assign(tr, { t1: c.entry + c.d * 10 * c.r0, rr: 10, trail: [3, 1], beAt: 1.5, addAt: 1.5 });
    else Object.assign(tr, { t1: c.entry + c.d * 3 * c.r0, rr: 3 });
    tr.legs = [tr]; open.push(tr); pos.push(tr);
  }
  advance(m.n);
  for (const x of open) { const k = m.n - 1; x.R = x.status === 'pending' ? 0 : (x.side < 0 ? x.entry - m.C[k] : m.C[k] - x.entry) / x.r0; x.closed = m.T[k]; if (x.status === 'pending') x.status = 'expired'; }
  return pos.filter((p) => p.status !== 'expired' && p.status !== 'missed').map((p) => { let g = 0, n = 0, c = 0; for (const x of p.legs) { if (x.status === 'expired' || x.status === 'missed') continue; const u = unitR(x); g += u.g; n += u.n; c = Math.max(c, x.closed); } return { t: p.filled, c, g, n }; });
}
const VARS = {
  weekly_3R: { weekly: true, cap: true, mg: '3R' },                     // as approved 4 Nov (mosha-bo-weekly)
  weekly_slow_3R: { weekly: true, cap: true, slow: 12, mg: '3R' },      // + mosha-slow, base exit
  live: { weekly: true, cap: true, slow: 12, mg: 'live' },              // the live config
  weekly_live_noSlow: { weekly: true, cap: true, mg: 'live' },
  weekly_fast_3R: { weekly: true, cap: false, fast: 12, mg: '3R' },     // the blocked fast arrivals (diagnostic)
  noWeekly_3R: { weekly: false, cap: true, mg: '3R' },
  flip_3R: { weekly: false, flip: true, cap: true, mg: '3R' },          // the original 4 Nov rule (M15 flip)
};
const RES = { chains: chains.length, variants: {} };
for (const [k, r] of Object.entries(VARS)) { const rows = run(r); RES.variants[k] = { rule: r, ...report(rows), s2019_22: span(rows, 2019, 2022), s2023_24: span(rows, 2023, 2024), s2025_26: span(rows, 2025, 2026), s2023_26: span(rows, 2023, 2026) }; console.error(k, JSON.stringify({ is: RES.variants[k].is, oos: RES.variants[k].oos })); }
fs.writeFileSync(`${OUT}/mosha.json`, JSON.stringify(RES, null, 1));
