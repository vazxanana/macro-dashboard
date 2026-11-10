// Edge research · mosha-cycle: the second half of the owner's Mosha trade (10 Nov 2026: "Close, then buy with H4"). After an H4 BO
// and the H1 retracement that mosha-retrace trades, price reaches the H4 barrier; the first H1 BO back in the H4 direction after
// that tap is traded with a limit at the broken H1 level (zone of the M5 break), target the high the retracement came from.
// Rule, variants and verdict: PREREGISTRATION.md (committed before this file produced a number). Shares the candle loader, the
// swing / BO / barrier definitions, the order simulation and the verdict rule with ../mosha-level and ../mosha-retrace.
// Paper research only: nothing here trades or changes a live rule.
//   GOLD_DIR=<folder with XAUUSD_M1_*.csv.gz> node run.mjs run        -> result.json (+ trades.json when OUT_DIR is set)
//   node run.mjs example                                             -> the cycles of the last days on the council's OANDA candles
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { K as K0, h4Context, simulate, stat, summarize, verdictOf } from '../mosha-level/run.mjs';
import { K as KR, boEvents, run as runRetrace } from '../mosha-retrace/run.mjs';

export const K = { W4: KR.W4, W1: KR.W1, BASE: KR.BASE, PAD: KR.PAD, LEVEL_AGE: KR.LEVEL_AGE, WAIT: 72 * 3600, MIN_R0: KR.MIN_R0, MIN_RR: KR.MIN_RR, H4: 14400, H1: 3600, M15: 900, M5: 300 };
export const VARIANTS = { P: {}, Z: { zoneStop: true }, M15: { m15: true }, T3: { fixed: 3 } };

const lowerT = (B, t) => { let a = 0, b = B.length; while (a < b) { const m = (a + b) >> 1; if (B[m].time < t) a = m + 1; else b = m; } return a; };
// the first H4 close through a zone's far side after it came to exist (Infinity when none within its 30 days)
function zoneDeaths(H4, zones) {
  for (const z of zones) { z.dead = Infinity; for (let i = lowerT(H4, z.born); i < H4.length && H4[i].time + K.H4 - z.born <= K.LEVEL_AGE; i++) if (z.side > 0 ? H4[i].close < z.bot : H4[i].close > z.top) { z.dead = H4[i].time + K.H4; break; } }
}

// C: { M5, M15, H1, H4, F (fill candles) }. Returns the orders, the funnel and, per H4 BO, how far its cycle got (for the example).
export function run(C, variant = 'P') {
  const V = VARIANTS[variant], { M5, H1, H4, F } = C, Zc = V.m15 ? C.M15 : M5, zs = V.m15 ? K.M15 : K.M5;
  const E4 = boEvents(H4, K.W4, K.H4), E1 = boEvents(H1, K.W1, K.H1), { zones } = h4Context(H4);
  zoneDeaths(H4, zones);
  const funnel = { h4bo: E4.length, retracements: 0, noBarrier: 0, taps: 0, h1back: 0, small: 0, lowRR: 0, busy: 0, orders: 0 }, cand = [], cycles = [];
  let a = 0;
  for (let q = 0; q < E4.length; q++) {
    const e4 = E4[q], d = e4.dir, nextT = q + 1 < E4.length ? E4[q + 1].t : Infinity;
    let oppT = Infinity; for (let k = q + 1; k < E4.length; k++) if (E4[k].dir === -d) { oppT = E4[k].t; break; }
    const cy = { h4At: e4.t, dir: d, stage: 'h4' }; cycles.push(cy);
    // 1. the first H1 BO the other way after the H4 BO, before a newer H4 BO
    while (a < E1.length && E1[a].t < e4.t) a++;
    let e1 = null; for (let k = a; k < E1.length && E1[k].t < nextT; k++) if (E1[k].dir === -d) { e1 = E1[k]; break; }
    if (!e1) continue;
    funnel.retracements++; cy.stage = 'retracement'; cy.h1At = e1.t;
    // 2. the barrier: the nearest live engulf zone on the H4's side beyond the broken H1 level
    let Z = null;
    for (const z of zones) { if (z.born > e1.t) break; if (e1.t - z.born > K.LEVEL_AGE || z.dead <= e1.t || z.side !== d) continue; const px = d > 0 ? z.top : z.bot; if (d > 0 ? px >= e1.level : px <= e1.level) continue; if (!Z || (d > 0 ? px > Z.top : px < Z.bot)) Z = z; }
    if (!Z) { funnel.noBarrier++; continue; }
    const edgeZ = d > 0 ? Z.top : Z.bot; cy.barrier = +edgeZ.toFixed(3);
    // 3. the retracement reaches it
    const end3 = Math.min(nextT, Z.dead, Z.born + K.LEVEL_AGE); let tapI = -1;
    for (let i = lowerT(M5, e1.t); i < M5.length && M5[i].time + K.M5 <= end3; i++) if (d > 0 ? M5[i].low <= edgeZ : M5[i].high >= edgeZ) { tapI = i; break; }
    if (tapI < 0) continue;
    const tapT = M5[tapI].time + K.M5; funnel.taps++; cy.stage = 'tapped'; cy.tapAt = tapT;
    // 4. the first H1 BO back in the H4 direction after the tap
    let e2 = null; for (let k = a; k < E1.length && E1[k].t <= tapT + K.WAIT; k++) { const e = E1[k]; if (e.t < tapT || e.dir !== d) continue; if (e.t > Math.min(Z.dead, oppT)) break; e2 = e; break; }
    if (!e2) continue;
    funnel.h1back++; cy.stage = 'h1 back'; cy.backAt = e2.t;
    // 5-7. the zone of the break, the order, the target
    let edge = null, breakAt = null;
    for (let k = lowerT(Zc, e2.born); k < Zc.length && Zc[k].time + zs <= e2.t; k++) if (d > 0 ? Zc[k].close > e2.level : Zc[k].close < e2.level) {
      edge = d > 0 ? Infinity : -Infinity; for (let m = Math.max(0, k - K.BASE); m <= k; m++) edge = d > 0 ? Math.min(edge, Zc[m].low) : Math.max(edge, Zc[m].high); breakAt = Zc[k].time; break; }
    if (edge == null) edge = d > 0 ? H1[e2.i].low : H1[e2.i].high;
    if (V.zoneStop) edge = d > 0 ? Z.bot : Z.top;
    const entry = e2.level, stop = +(edge - d * K.PAD).toFixed(3), r0 = d * (entry - stop);
    if (!(r0 >= K.MIN_R0)) { funnel.small++; continue; }
    let ext = d > 0 ? -Infinity : Infinity; for (let i = lowerT(M5, e4.t); i <= tapI; i++) ext = d > 0 ? Math.max(ext, M5[i].high) : Math.min(ext, M5[i].low);
    const target = V.fixed ? entry + d * V.fixed * r0 : ext;
    if (!(d * (target - entry) >= K.MIN_RR * r0)) { funnel.lowRR++; continue; }
    cand.push({ cy, o: { id: `xau-mc-${d > 0 ? 'b' : 's'}-${e2.t}`, side: d, h4At: e4.t, retraceAt: e1.t, barrier: +edgeZ.toFixed(3), tapAt: tapT, breakAt, placed: e2.t,
      entry: +entry.toFixed(3), stop, target: +target.toFixed(3), r0: +r0.toFixed(3), rr: +((d * (target - entry)) / r0).toFixed(2) } });
  }
  cand.sort((x, y) => x.o.placed - y.o.placed);
  const orders = []; let busyUntil = -Infinity;
  for (const { cy, o } of cand) { if (o.placed < busyUntil) { funnel.busy++; cy.stage = 'busy'; continue; } Object.assign(o, simulate(F, o)); orders.push(o); funnel.orders++; busyUntil = o.closed; cy.stage = 'order'; cy.order = o; }
  return { orders, funnel, cycles };
}

// ─── modes ───
const HERE = path.dirname(fileURLToPath(import.meta.url));
const MODE = process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url) ? process.argv[2] : null;
const iso = (t) => (t == null ? '-' : new Date(t * 1000).toISOString().slice(0, 16).replace('T', ' '));
if (MODE === 'example') {
  const BASE = process.env.MD_BASE || 'https://meridianx.dev/md/';
  const get = async (tf, n) => { const r = await fetch(`${BASE}bars?sym=xau&tf=${tf}&n=${n}`, { signal: AbortSignal.timeout(40000) }); const j = await r.json(); return j.bars.filter((b) => !b.live).map((b) => ({ time: +b.time, open: +b.open, high: +b.high, low: +b.low, close: +b.close })); };
  const C = { M5: await get('5m', 3000), M15: await get('15m', 1200), H1: await get('1h', 400), H4: await get('4h', 400) }; C.F = C.M5;
  console.log(`OANDA M5 ${iso(C.M5[0].time)} → ${iso(C.M5.at(-1).time)} (fills judged on M5 here)`);
  const { funnel, cycles } = run(C, 'P'); console.log(JSON.stringify(funnel));
  for (const c of cycles.filter((x) => x.h4At >= C.M5[0].time)) console.log(`  H4 BO ${c.dir > 0 ? 'buy ' : 'sell'} ${iso(c.h4At)} | retracement ${iso(c.h1At)} | barrier ${c.barrier ?? '-'} | tap ${iso(c.tapAt)} | H1 back ${iso(c.backAt)} | ${c.stage}${c.order ? `: ${c.order.side > 0 ? 'BUY' : 'SELL'} ${c.order.entry} stop ${c.order.stop} target ${c.order.target} (${c.order.rr}R) → ${c.order.status}${c.order.exit ? ' ' + c.order.exit : ''} ${c.order.net != null ? c.order.net + 'R' : ''}` : ''}`);
}
if (MODE === 'run') {
  const { loadM1, aggregate } = await import('../gold-systems/data.mjs');
  const m = loadM1(), M1 = new Array(m.n); for (let i = 0; i < m.n; i++) M1[i] = { time: m.T[i], open: m.O[i], high: m.H[i], low: m.L[i], close: m.C[i] };
  const C = { M5: aggregate(m, K.M5), M15: aggregate(m, K.M15), H1: aggregate(m, K.H1), H4: aggregate(m, K.H4), F: M1, W: [] };
  console.error(`M1 ${m.n} (${iso(M1[0].time)} → ${iso(M1.at(-1).time)}), M5 ${C.M5.length}, H1 ${C.H1.length}, H4 ${C.H4.length}`);
  const out = { topic: 'mosha-cycle', built: '2026-11-10', at: new Date().toISOString(), system: 'Mosha cycle, second half (H4 BO, H1 retracement into the H4 engulf barrier, the first H1 BO back with the H4, limit at the broken H1 level with the zone refined on M5, target the high the retracement came from), spot gold HistData M1',
    window: { from: '2020-01-01', split: '2024-01-01', to: '2026-10-31' }, params: { ...K, VALID: K0.VALID, HOLD: K0.HOLD, COST: K0.COST }, candles: { m1: m.n, m5: C.M5.length, m15: C.M15.length, h1: C.H1.length, h4: C.H4.length, from: iso(M1[0].time), to: iso(M1.at(-1).time) }, variants: {} };
  const keep = {};
  for (const v of Object.keys(VARIANTS)) { const r = run(C, v); keep[v] = r.orders; out.variants[v] = { funnel: r.funnel, ...summarize(r.orders) }; console.error(v, JSON.stringify(out.variants[v].all), 'IS', JSON.stringify(out.variants[v].is), 'OOS', JSON.stringify(out.variants[v].oos)); }
  const holm = (rows, key) => { const ps = [...rows].sort((x, y) => x.p - y.p); let top = 0; ps.forEach((r, i) => { top = Math.max(top, Math.min(1, r.p * (ps.length - i))); r.o[key] = +top.toFixed(4); }); };
  const mine = Object.keys(VARIANTS).map((v) => ({ p: out.variants[v].p, o: out.variants[v] }));
  holm(mine, 'pHolm');
  const others = ['mosha-level', 'mosha-retrace'].flatMap((t) => Object.values(JSON.parse(fs.readFileSync(path.join(HERE, `../${t}/result.json`), 'utf8')).variants).map((x) => ({ p: x.p, o: {} })));
  holm([...mine, ...others], 'pHolmAll');   // over the thirteen tests of the three Mosha studies of 10 Nov
  const vd = verdictOf(out.variants.P); out.primary = vd; out.variantsTried = 4;
  const P = out.variants.P, sg = (x) => `${x >= 0 ? '+' : ''}${x}`;
  out.verdict = `${vd.verdict}: the buy at the barrier made ${sg(P.all.avg)}R a trade after costs over ${P.all.n} trades (2020 to October 2026), t ${P.all.t}; in sample ${sg(P.is.avg)}R (n ${P.is.n}), out of sample ${sg(P.oos.avg)}R (n ${P.oos.n})`;
  // the whole cycle as the owner trades it: the retracement trade (mosha-retrace P) and this trade on one timeline. Descriptive, no test.
  const inWin = (o) => o.status === 'closed' && o.placed >= K0.FROM && o.placed < K0.TO, first = runRetrace(C, 'P').orders.filter(inWin), second = keep.P.filter(inWin);
  const both = [...first, ...second].sort((x, y) => x.closed - y.closed);
  out.cycle = { note: 'descriptive: mosha-retrace P and this P added on one timeline, no test', retrace: stat(first.map((o) => o.net)), barrier: stat(second.map((o) => o.net)), both: stat(both.map((o) => o.net)),
    is: stat(both.filter((o) => o.placed < K0.SPLIT).map((o) => o.net)), oos: stat(both.filter((o) => o.placed >= K0.SPLIT).map((o) => o.net)) };
  const label = { P: 'P: buy at the barrier on the H1 BO back, M5 zone, target the leg high', Z: 'Z: stop under the barrier', M15: 'M15: the entry zone on M15', T3: 'T3: fixed 3R target' };
  out.candidates = Object.keys(VARIANTS).map((v) => ({ rule: label[v], verdict: v === 'P' ? vd.verdict : 'variant, reported only', is: out.variants[v].is, oos: out.variants[v].oos, years: out.variants[v].years }));
  out.trades = second.sort((x, y) => x.closed - y.closed).map((o) => ({ d: new Date(o.closed * 1000).toISOString().slice(0, 10), side: o.side < 0 ? 'sell' : 'buy', R: o.net }));
  fs.writeFileSync(path.join(HERE, 'result.json'), JSON.stringify(out, null, 1) + '\n');
  if (process.env.OUT_DIR) { fs.mkdirSync(process.env.OUT_DIR, { recursive: true }); fs.writeFileSync(path.join(process.env.OUT_DIR, 'trades-cycle.json'), JSON.stringify(keep)); }
  console.error(out.verdict); console.error('cycle', JSON.stringify(out.cycle.both), 'IS', JSON.stringify(out.cycle.is), 'OOS', JSON.stringify(out.cycle.oos));
}
