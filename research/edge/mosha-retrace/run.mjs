// Edge research · mosha-retrace: the owner's correction of the Mosha reading (10 Nov 2026): "after a H4 we can look for H1 to know
// when the retracement or pullback starts, then we use M15 or M5 to trade that retracement". H4 BO → H1 BO the other way → limit at
// the broken H1 level, zone refined on M5, target the H4 engulf barrier. Rule, variants and verdict: PREREGISTRATION.md (committed
// before this file produced a number). Shares the candle loader, the swing / barrier definitions, the order simulation and the
// verdict rule with ../mosha-level/run.mjs. Paper research only: nothing here trades or changes a live rule.
//   GOLD_DIR=<folder with XAUUSD_M1_*.csv.gz> node run.mjs run        -> result.json (+ trades.json when OUT_DIR is set)
//   node run.mjs example                                             -> the chain on the council's OANDA candles of the last days
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { K as K0, swings, h4Context, simulate, summarize, verdictOf } from '../mosha-level/run.mjs';
import { msAnalyze } from '../../../council/engine.mjs';

export const K = { W4: 3, W1: 1, BASE: K0.BASE, PAD: K0.PAD, TOL: K0.TOL, LEVEL_AGE: K0.LEVEL_AGE, TAP_WINDOW: 24 * 3600, MIN_R0: K0.MIN_R0, MIN_RR: K0.MIN_RR,
  H4: 14400, H1: 3600, M15: 900, M5: 300, WEEK: 604800 };
export const VARIANTS = { P: {}, M15: { m15: true }, A: { weekly: true }, K: { key: true }, T3: { fixed: 3 } };

// BO events of one timeframe: a close beyond the most recent swing that existed when the candle opened; each level is broken once
export function boEvents(B, w, sec) {
  const { hi, lo } = swings(B, w), ev = [];
  let a = -1, v = -1, aDone = false, vDone = false;
  for (let i = 0; i < B.length; i++) {
    const j = i - w - 1;
    if (j >= 0) { if (hi[j]) { a = j; aDone = false; } if (lo[j]) { v = j; vDone = false; } }
    if (a >= 0 && !aDone && B[i].close > B[a].high) { ev.push({ t: B[i].time + sec, dir: 1, level: B[a].high, born: B[a + w].time + sec, i }); aDone = true; }
    if (v >= 0 && !vDone && B[i].close < B[v].low) { ev.push({ t: B[i].time + sec, dir: -1, level: B[v].low, born: B[v + w].time + sec, i }); vDone = true; }
  }
  return ev;
}
// the first H4 close through a level or a zone after it came to exist (Infinity when none)
function deaths(H4, items, through) {
  const at = (t) => { let a = 0, b = H4.length; while (a < b) { const m = (a + b) >> 1; if (H4[m].time + K.H4 <= t) a = m + 1; else b = m; } return a; };   // first candle closing after t
  for (const x of items) { x.dead = Infinity; for (let i = at(x.born); i < H4.length && H4[i].time + K.H4 - x.born <= K.LEVEL_AGE; i++) if (through(x, H4[i].close)) { x.dead = H4[i].time + K.H4; break; } }
}
// weekly direction as the live Trader reads it: Monday-aligned weeks (a Sunday candle belongs to the week that follows), msAnalyze(weeks, 3)
export function weeklyEvents(F) {
  const wk = [];
  for (const b of F) { const day = Math.floor(b.time / 86400) * 86400, k = Math.floor((day + (new Date(day * 1000).getUTCDay() === 0 ? 86400 : 0) - 345600) / K.WEEK) * K.WEEK + 345600, c = wk.at(-1);
    if (!c || c.time !== k) wk.push({ time: k, open: b.open, high: b.high, low: b.low, close: b.close }); else { if (b.high > c.high) c.high = b.high; if (b.low < c.low) c.low = b.low; c.close = b.close; } }
  return msAnalyze(wk, 3).events.map((e) => ({ t: wk[e.breakIdx].time + K.WEEK, dir: e.dir }));
}
const lowerT = (B, t) => { let a = 0, b = B.length; while (a < b) { const m = (a + b) >> 1; if (B[m].time < t) a = m + 1; else b = m; } return a; };

// C: { M5, M15, H1, H4, F (fill candles), W (weekly events, for variant A) }
export function run(C, variant = 'P') {
  const V = VARIANTS[variant], { M5, H1, H4, F } = C, Z = V.m15 ? C.M15 : M5, zs = V.m15 ? K.M15 : K.M5;
  const E4 = boEvents(H4, K.W4, K.H4), E1 = boEvents(H1, K.W1, K.H1), { levels, zones } = h4Context(H4);
  deaths(H4, zones, (z, c) => (z.side > 0 ? c < z.bot : c > z.top)); deaths(H4, levels, (l, c) => (l.side < 0 ? c > l.p : c < l.p));
  const funnel = { h4bo: E4.length, h1bo: E1.length, signals: 0, filtered: 0, small: 0, noBarrier: 0, lowRR: 0, busy: 0, orders: 0 }, orders = [];
  const barrier = (s, entry, now) => { let best = null; for (const z of zones) { if (z.born > now) break; if (now - z.born > K.LEVEL_AGE || z.dead <= now || z.side !== -s) continue; const px = s < 0 ? z.top : z.bot; if (s < 0 ? px >= entry : px <= entry) continue; if (best == null || (s < 0 ? px > best : px < best)) best = px; } return best; };
  const tapped = (s, t) => {   // variant K: in the 24 h before the H1 BO an M5 candle reached a live H4 level on the trade's side
    const L = levels.filter((l) => l.side === s && l.born <= t && l.born >= t - K.TAP_WINDOW - K.LEVEL_AGE);
    for (let i = lowerT(M5, t - K.TAP_WINDOW); i < M5.length && M5[i].time < t; i++) for (const l of L) { const ct = M5[i].time; if (l.born <= ct && ct - l.born <= K.LEVEL_AGE && l.dead > ct && (s < 0 ? M5[i].high >= l.p * (1 - K.TOL) : M5[i].low <= l.p * (1 + K.TOL))) return true; }
    return false;
  };
  let q = -1, w = -1, busyUntil = -Infinity;
  for (const e of E1) {
    while (q + 1 < E4.length && E4[q + 1].t <= e.t) q++;
    const e4 = q >= 0 ? E4[q] : null; if (!e4 || e4.dir !== -e.dir || e4.used) continue;
    e4.used = true; funnel.signals++;
    const s = e.dir, now = e.t;
    if (V.weekly) { while (w + 1 < C.W.length && C.W[w + 1].t <= now) w++; if (w < 0 || C.W[w].dir !== s) { funnel.filtered++; continue; } }
    if (V.key && !tapped(s, now)) { funnel.filtered++; continue; }
    // the zone: the first fine candle (from the level's birth to the H1 BO close) closing through the level, and the BASE candles before it
    let edge = null, breakAt = null;
    for (let k = lowerT(Z, e.born); k < Z.length && Z[k].time + zs <= now; k++) if (s < 0 ? Z[k].close < e.level : Z[k].close > e.level) {
      edge = s < 0 ? -Infinity : Infinity; for (let m = Math.max(0, k - K.BASE); m <= k; m++) edge = s < 0 ? Math.max(edge, Z[m].high) : Math.min(edge, Z[m].low); breakAt = Z[k].time; break; }
    if (edge == null) edge = s < 0 ? H1[e.i].high : H1[e.i].low;
    const entry = e.level, stop = +(edge - s * K.PAD).toFixed(3), r0 = Math.abs(stop - entry);
    if (r0 < K.MIN_R0) { funnel.small++; continue; }
    const target = V.fixed ? entry + s * V.fixed * r0 : barrier(s, entry, now);
    if (target == null) { funnel.noBarrier++; continue; }
    if (Math.abs(target - entry) < K.MIN_RR * r0) { funnel.lowRR++; continue; }
    if (now < busyUntil) { funnel.busy++; continue; }
    const o = { id: `xau-mr-${s < 0 ? 's' : 'b'}-${now}`, side: s, h4At: e4.t, h4Level: +e4.level.toFixed(3), h1Level: +e.level.toFixed(3), breakAt, placed: now,
      entry: +entry.toFixed(3), stop, target: +target.toFixed(3), r0: +r0.toFixed(3), rr: +(Math.abs(target - entry) / r0).toFixed(2) };
    Object.assign(o, simulate(F, o)); orders.push(o); funnel.orders++; busyUntil = o.closed;
  }
  return { orders, funnel };
}

// ─── modes ───
const HERE = path.dirname(fileURLToPath(import.meta.url));
const MODE = process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url) ? process.argv[2] : null;
const iso = (t) => (t == null ? '-' : new Date(t * 1000).toISOString().slice(0, 16).replace('T', ' '));
if (MODE === 'example') {
  const BASE = process.env.MD_BASE || 'https://meridianx.dev/md/';
  const get = async (tf, n) => { const r = await fetch(`${BASE}bars?sym=xau&tf=${tf}&n=${n}`, { signal: AbortSignal.timeout(40000) }); const j = await r.json(); return j.bars.filter((b) => !b.live).map((b) => ({ time: +b.time, open: +b.open, high: +b.high, low: +b.low, close: +b.close })); };
  const C = { M5: await get('5m', 3000), M15: await get('15m', 1200), H1: await get('1h', 400), H4: await get('4h', 400) }; C.F = C.M5;
  console.log(`OANDA M5 ${iso(C.M5[0].time)} → ${iso(C.M5.at(-1).time)} (fills judged on M5 here; the weekly variant is not run)`);
  for (const v of ['P', 'M15', 'K', 'T3']) {
    const { orders, funnel } = run(C, v); console.log(`\n${v}: ${JSON.stringify(funnel)}`);
    for (const o of orders.filter((x) => x.placed >= C.M5[0].time).slice(-6)) console.log(`  H4 BO ${iso(o.h4At)} | H1 BO ${iso(o.placed)} ${o.side < 0 ? 'SELL' : 'BUY '} break ${iso(o.breakAt)} entry ${o.entry} stop ${o.stop} target ${o.target} (${o.rr}R) → ${o.status}${o.exit ? ' ' + o.exit : ''} ${o.net != null ? o.net + 'R' : ''}`);
  }
}
if (MODE === 'run') {
  const { loadM1, aggregate } = await import('../gold-systems/data.mjs');
  const m = loadM1(), M1 = new Array(m.n); for (let i = 0; i < m.n; i++) M1[i] = { time: m.T[i], open: m.O[i], high: m.H[i], low: m.L[i], close: m.C[i] };
  const C = { M5: aggregate(m, K.M5), M15: aggregate(m, K.M15), H1: aggregate(m, K.H1), H4: aggregate(m, K.H4), F: M1 }; C.W = weeklyEvents(C.H1);
  console.error(`M1 ${m.n} (${iso(M1[0].time)} → ${iso(M1.at(-1).time)}), M5 ${C.M5.length}, M15 ${C.M15.length}, H1 ${C.H1.length}, H4 ${C.H4.length}, weekly BOs ${C.W.length}`);
  const out = { topic: 'mosha-retrace', built: '2026-11-10', at: new Date().toISOString(), system: 'Mosha retracement chain (H4 BO, H1 BO the other way, limit at the broken H1 level with the zone refined on M5, target the H4 engulf barrier), spot gold HistData M1',
    window: { from: '2020-01-01', split: '2024-01-01', to: '2026-10-31' }, params: { ...K, VALID: K0.VALID, HOLD: K0.HOLD, COST: K0.COST }, candles: { m1: m.n, m5: C.M5.length, m15: C.M15.length, h1: C.H1.length, h4: C.H4.length, from: iso(M1[0].time), to: iso(M1.at(-1).time) }, variants: {} };
  const keep = {};
  for (const v of Object.keys(VARIANTS)) { const r = run(C, v); keep[v] = r.orders; out.variants[v] = { funnel: r.funnel, ...summarize(r.orders) }; console.error(v, JSON.stringify(out.variants[v].all), 'IS', JSON.stringify(out.variants[v].is), 'OOS', JSON.stringify(out.variants[v].oos)); }
  const holm = (rows, key) => { const ps = [...rows].sort((a, b) => a.p - b.p); let top = 0; ps.forEach((r, i) => { top = Math.max(top, Math.min(1, r.p * (ps.length - i))); r.o[key] = +top.toFixed(4); }); };
  const mine = Object.keys(VARIANTS).map((v) => ({ p: out.variants[v].p, o: out.variants[v] }));
  holm(mine, 'pHolm');
  const first = JSON.parse(fs.readFileSync(path.join(HERE, '../mosha-level/result.json'), 'utf8')), firstRows = Object.keys(first.variants).map((v) => ({ p: first.variants[v].p, o: {} }));
  holm([...mine, ...firstRows], 'pHolmNine');   // over the nine tests of the two Mosha studies of 10 Nov
  const vd = verdictOf(out.variants.P); out.primary = vd; out.variantsTried = 5;
  const P = out.variants.P, sg = (x) => `${x >= 0 ? '+' : ''}${x}`;
  out.verdict = `${vd.verdict}: the pre-registered chain made ${sg(P.all.avg)}R a trade after costs over ${P.all.n} trades (2020 to October 2026), t ${P.all.t}; in sample ${sg(P.is.avg)}R (n ${P.is.n}), out of sample ${sg(P.oos.avg)}R (n ${P.oos.n})`;
  const label = { P: 'P: H4 BO, H1 BO against, M5 zone, barrier target', M15: 'M15: the entry zone on M15', A: 'A: only with the weekly direction', K: 'K: only at an H4 key level', T3: 'T3: fixed 3R target' };
  out.candidates = Object.keys(VARIANTS).map((v) => ({ rule: label[v], verdict: v === 'P' ? vd.verdict : 'variant, reported only', is: out.variants[v].is, oos: out.variants[v].oos, years: out.variants[v].years }));
  out.trades = keep.P.filter((o) => o.status === 'closed' && o.placed >= K0.FROM && o.placed < K0.TO).sort((a, b) => a.closed - b.closed).map((o) => ({ d: new Date(o.closed * 1000).toISOString().slice(0, 10), side: o.side < 0 ? 'sell' : 'buy', R: o.net }));
  fs.writeFileSync(path.join(HERE, 'result.json'), JSON.stringify(out, null, 1) + '\n');
  if (process.env.OUT_DIR) { fs.mkdirSync(process.env.OUT_DIR, { recursive: true }); fs.writeFileSync(path.join(process.env.OUT_DIR, 'trades-retrace.json'), JSON.stringify(keep)); }
  console.error(out.verdict);
}
