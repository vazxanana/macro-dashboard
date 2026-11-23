// research/edge/fade-breaks-holdout/run.mjs - four faded (side-flipped) rules asked once on data the three grids never read
// (PREREGISTRATION.md, 23 Nov 2026). Research only: reads the edgekit candle cache, places nothing.
//   node --max-old-space-size=8000 research/edge/fade-breaks-holdout/run.mjs market <set> <m> <dir>   one market of a set -> <dir>/<set>.<m>.json
//   node research/edge/fade-breaks-holdout/run.mjs cut <set> <m> <dir>                                 cut test -> <dir>/<set>.<m>.cut.json
//   node research/edge/fade-breaks-holdout/report.mjs <dir>                                             the bar -> result.json
// Sets: gate (2010-19 on the grids' five markets: must reproduce the picked cells' placebo figures), A (five markets
// 2005-09), B (holdout markets 2010-19, costs assumed), C (five markets 2020 to the last complete month).
// Rules F1-F3 are the grids' own code for one cell each (imported functions; the grids' per-signal loops copied and filtered
// to the cell, nothing edited); F4 is the plain rule written here. Every rule emits both sides: pl 1 = the faded side (the
// rule under test), pl 0 = the un-faded side (the grids' real trade), for contrast only.
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import * as K from '../_lib/edgekit.mjs';
import { COSTS, exclusions } from '../combo-grid-2/run.mjs';
import { frames as frames3, multi, signalsFor, buildZones, NONE } from '../combo-grid-3/run.mjs';
import { manage, startIdx } from '../dom-trade-through/run.mjs';
import * as BOX from '../grid6-box-in-box/run.mjs';
import * as DOM from '../grid6-dom-confirm/run.mjs';
import * as MOS from '../grid6-mosha-market/run.mjs';
import { atr14 } from '../grid5-mosha-cycle/run.mjs';

const y = (n) => Date.UTC(n, 0, 1) / 1000;
export const C_END = Date.UTC(2026, 10, 1) / 1000; // set C ends at the last complete month in the cache (fixed 23 Nov 2026)
export const SETS = {
  gate: { markets: K.MARKETS, from: y(2010), to: y(2020) },
  A: { markets: K.MARKETS, from: y(2005), to: y(2010) },
  B: { markets: K.HOLDOUT_MARKETS, from: y(2010), to: y(2020), assumedCosts: true },
  C: { markets: K.MARKETS, from: y(2020), to: C_END },
};
export const RULES = ['F1', 'F2', 'F3', 'F4'];
export const RULE_NAME = {
  F1: 'grid6-box-in-box placebo: fade an M5 box close-out (H1-M15-M5 chain), outside 07-17 UTC, market, bottom-box stop, 1R',
  F2: 'grid6-dom-confirm placebo: fade the M5 break (structure(M5, 2)) on the second touch of an H1 dominant zone, outside 07-21 UTC, market, swing stop, trailing exit',
  F3: 'grid6-mosha-market placebo: fade the M15 CF of an H1 BO (CF back at the BO level), market after the CF close, CF-zone stop, trailing exit',
  F4: 'plain: fade the first M5 structure break inside an H1 box, market, stop past the break candle + 0.1 M5 ATR, 1R',
};
// the cells, fixed in PREREGISTRATION.md (indices into each grid's own factor lists)
export const CELLS = {
  F1: { ch: 2, trig: 0, sess: 2, ei: 0, si: 0, x: 0 }, // H1-M15-M5, out, other, mkt/bot, 1R (top, mid, size any)
  F2: { ch: 5, v: 1, cf: 2, ms: 2, se: 2, st: 1, x: 3 }, // cell 5559: 1h>5m, visit 2, bo, msnr any, other, swing, trail
  F3: { li: 2, bi: 0, place: 1, es: 0, st: 1, x: 4, se: 0, ms: 0 }, // cell 6228: 1h>15m, any, back, MKT, cfz, trail, any, any
};
export const GEN = { boxK: 2, structK: 3, atrK: 0.1, cap: 86400 };

// load windows: each grid's own convention, so the gate reproduces it exactly (box and Mosha grids: from 1 January of the
// year before the first fill to the end; the dominant-zone grid: 400 days before to 15 days after)
const yearBefore = (t) => Date.UTC(new Date(t * 1000).getUTCFullYear() - 1, 0, 1) / 1000;
function loadFor(rule, market, S) {
  if (rule === 'F1' || rule === 'F3') return K.load(market, '5m', { from: yearBefore(S.from), to: S.to });
  return K.load(market, '5m', { from: S.from - 400 * 86400, to: S.to + 15 * 86400 });
}

// ---- F1: grid6-box-in-box's per-signal step (runMarket), the one cell ---------------------------------------------------
export function rowsF1(M5, market, S, { signalsOnly = false } = {}) {
  const F = frames3(M5), cost = COSTS[market], X = exclusions(market), inBad = (t) => X.some(([a, b]) => t >= a && t <= b);
  const c = CELLS.F1, out = [];
  for (const sg of BOX.signals(F, { from: S.from, to: S.to })) {
    if (sg.ch !== c.ch || sg.trig !== c.trig || sg.sess !== c.sess) continue;
    const d = sg.d, buf = cost / 2, ts = sg.ts, cap = BOX.CAPS[sg.ch], exp = ts + BOX.LIFE * 300;
    const stop = sg.trig === 0 ? (d > 0 ? sg.box.lo - buf : sg.box.hi + buf) : (d > 0 ? sg.ext - buf : sg.ext + buf);
    const tgt = d > 0 ? sg.top.hi : sg.top.lo, ref = sg.c0;
    if (!(d * (ref - stop) >= 2 * cost)) continue;
    let oppR = (d * (tgt - ref)) / (d * (ref - stop)); if (!(oppR >= 1)) oppR = 2;
    if (signalsOnly) { out.push({ key: [ts, d, stop].join('|'), ts }); continue; }
    for (let pl = 0; pl < 2; pl++) {
      const s = pl ? -d : d, sp = pl ? 2 * sg.c0 - stop : stop;
      const r = BOX.trade(M5, s, 'mkt', null, sp, ts, exp, oppR, cost, cap);
      if (!r || r.t < S.from || r.t >= S.to) continue; if (inBad(r.t)) continue;
      out.push({ pl, t: r.t, R: r.R[c.x], cr: cost / r.risk });
    }
  }
  return out;
}

// ---- F2: grid6-dom-confirm's runMarket loop, the one cell ---------------------------------------------------------------
export function rowsF2(M5, market, S, { signalsOnly = false } = {}) {
  const c = CELLS.F2; if (!c) throw new Error('F2 cell not set');
  const F = frames3(M5), cost = COSTS[market], X = exclusions(market), calls = DOM.dailyCalls(F), D = F['1d'];
  const inBad = (t) => { let lo = 0, hi = X.length; while (lo < hi) { const m = (lo + hi) >> 1; if (X[m][0] <= t) lo = m + 1; else hi = m; } return lo > 0 && t <= X[lo - 1][1]; };
  const XSLOT = [0, 1, 2, 6], CAP = { '1d': 10 * 86400, '4h': 5 * 86400, '1h': 2 * 86400 };
  const [tfL, tfT] = DOM.CHAINS[c.ch], L = F[tfL], T = F[tfT], A = DOM.atr14(L), lk = DOM.lookups(T), cap = CAP[tfL];
  const Zc = { [tfL + 'dom']: buildZones('dom', L) }, out = [];
  for (const sg of signalsFor(F, tfL, tfT, 'dom', Zc, S.from)) {
    if (sg.trig !== NONE) continue;
    const z = sg.z, d = z.d; if (sg.visit - 1 !== c.v) continue;
    const cf = DOM.confirmations(T, lk, z, sg.k0)[c.cf]; if (!cf) continue;
    const ts = T[cf.j].e; if (ts >= S.to) continue;
    const li = K.closedCount(L, ts) - 1; if (li < 15) continue;
    const di = K.closedCount(D, ts) - 1, call = di >= 0 ? calls[di] : 0;
    if (c.ms === 0 && call !== d) continue; if (c.ms === 1 && call !== -d) continue;
    if (c.se !== 3 && DOM.sessionOf(ts) !== c.se) continue;
    const ref = T[cf.j].c;
    const stop = c.st === 0 ? (d > 0 ? z.bot - cost / 2 - 0.25 * A[li] : z.top + cost / 2 + 0.25 * A[li]) : (d > 0 ? cf.ext - cost / 2 : cf.ext + cost / 2);
    const dist = d * (ref - stop); if (!(dist > 0)) continue;
    if (signalsOnly) { out.push({ key: [ts, d, stop].join('|'), ts }); continue; }
    const r = multi(M5, d, ref, stop, 'mkt', ts, null, 2, null, cap, null);
    if (!r || r.risk < 2 * cost || r.t < S.from || r.t >= S.to || inBad(r.t)) continue;
    out.push({ pl: 0, t: r.t, R: r.R[XSLOT[c.x]], cr: cost / r.risk });
    const p = multi(M5, -d, ref, ref + d * dist, 'mkt', ts, null, 2, null, cap, null);
    if (p && p.risk >= 2 * cost && !inBad(p.t)) out.push({ pl: 1, t: p.t, R: p.R[XSLOT[c.x]], cr: cost / p.risk });
  }
  return out;
}

// ---- F3: grid6-mosha-market's runMarket loop, the one cell --------------------------------------------------------------
export function rowsF3(M5, market, S, { signalsOnly = false } = {}) {
  const c = CELLS.F3; if (!c) throw new Error('F3 cell not set');
  const F = MOS.frames(M5), cost = COSTS[market], bad = exclusions(market), badHit = (a, b) => bad.some(([p, q]) => p <= b && q >= a);
  const calls = MOS.msnrCalls(F), [h, v] = MOS.LADDERS[c.li], atrV = atr14(F[v]), out = [];
  for (const s of MOS.storylines(F, h, v, MOS.BRK[c.bi], calls, {})) {
    if (c.place === 1 && !s.back) continue; if (c.place === 2 && !s.inside) continue; if (c.place === 3 && s.inside) continue;
    if (c.ms !== 0 && s.call !== c.ms) continue;
    for (const o of MOS.entries(s, F, atrV, M5, cost)) {
      if (o.gate || o.es !== c.es || o.st !== c.st) continue;
      if (signalsOnly) { out.push({ key: [s.T, s.d, o.stop, o.type].join('|'), ts: s.T }); continue; }
      const r = MOS.simulate(M5, o, s.d, s.x, MOS.CAP[h]); if (!r) continue;
      if (r.instant || !(r.risk > 0) || !(s.d * (r.fill - o.stop) > 0)) continue;
      if (r.fillT < S.from || r.fillT >= S.to) continue;
      if (badHit(r.fillT, r.exitT)) continue;
      if (c.se !== 0 && MOS.sessionOf(r.fillT) !== c.se) continue;
      if (Number.isFinite(r.R[c.x])) out.push({ pl: 0, t: r.fillT, R: r.R[c.x], cr: cost / r.risk });
      const p = MOS.placebo(M5, o, s, r);
      // the grid books the placebo in the REAL trade's month (add(acc.plac, base, m, ...)); kept so for the gate
      if (p && Number.isFinite(p.R[c.x])) out.push({ pl: 1, t: r.fillT, R: p.R[c.x], cr: cost / p.risk });
    }
  }
  return out;
}

// ---- F4: the plain rule, written here ---------------------------------------------------------------------------------
// H1 box = edgekit boxesHL(H1, 2); it stands from the close of the H1 candle that completes it (index s) until the close of
// the H1 candle that closes outside it. The first M5 structure break (edgekit structure(M5, 3)) whose break candle closes
// inside the standing box, with that close after the box stands and before its close-out, is faded once per box: market at
// the next 5-minute open; stop past the break candle's extreme by 0.1 x ATR14(M5) at the break candle; target 1R; out at
// the close of the first candle ending a day after the fill. Skipped when the stop is not on the losing side of the fill,
// or the filled risk is under 2 round trips.
export function signalsF4(M5, S) {
  const H = K.resample(M5, 3600), boxes = K.boxesHL(H, GEN.boxK), ev = K.structure(M5, GEN.structK).events, atr = atr14(M5);
  const out = []; let e = 0;
  for (const b of boxes) {
    const start = H[b.s].e, end = b.bi >= 0 ? H[b.bi].e : Infinity;
    while (e < ev.length && M5[ev[e].i].e <= start) e++;
    for (let q = e; q < ev.length; q++) { const x = ev[q], bar = M5[x.i]; if (bar.e >= end) break;
      if (bar.c < b.lo || bar.c > b.hi) continue;
      if (bar.e < S.from - 86400 || bar.e >= S.to) break;
      const d = x.dir, a = atr[x.i];
      out.push({ ts: bar.e, i: x.i, d, hi: bar.h, lo: bar.l, a, key: [bar.e, d, bar.h, bar.l, a].join('|') });
      break; }
  }
  return out;
}
export function rowsF4(M5, market, S, { signalsOnly = false } = {}) {
  const cost = COSTS[market], X = exclusions(market), inBad = (t) => X.some(([a, b]) => t >= a && t <= b), out = [];
  for (const sg of signalsF4(M5, S)) {
    if (signalsOnly) { out.push({ key: sg.key, ts: sg.ts }); continue; }
    const fi = startIdx(M5, sg.ts); if (fi >= M5.length) continue;
    const fill = M5[fi].o;
    for (let pl = 0; pl < 2; pl++) {
      const s = pl ? -sg.d : sg.d;                      // pl 1 = fade: against the break
      const stop = s < 0 ? sg.hi + GEN.atrK * sg.a : sg.lo - GEN.atrK * sg.a;
      if (!(s * (fill - stop) > 0)) continue;
      const r = manage(M5, s, fi, fill, stop, GEN.cap, true, 2); if (!r || r.risk < 2 * cost) continue;
      if (r.t < S.from || r.t >= S.to || inBad(r.t)) continue;
      if (!(s * (fill - stop) > 0)) throw new Error('stop on the wrong side');
      out.push({ pl, t: r.t, R: r.R[0], cr: cost / r.risk });
    }
  }
  return out;
}
const ROWS = { F1: rowsF1, F2: rowsF2, F3: rowsF3, F4: rowsF4 };

// ---- statistics -------------------------------------------------------------------------------------------------------
const mIdx = (t, from) => { const a = new Date(from * 1000), d = new Date(t * 1000); return (d.getUTCFullYear() - a.getUTCFullYear()) * 12 + d.getUTCMonth() - a.getUTCMonth(); };
export function nMonths(from, to) { return mIdx(to - 1, from) + 1; }
export function tMonth(sums) { const n = sums.length, m = sums.reduce((a, b) => a + b, 0) / n;
  const sd = Math.sqrt(sums.reduce((a, b) => a + (b - m) ** 2, 0) / (n - 1)); return sd > 0 ? m / (sd / Math.sqrt(n)) : 0; }
export function statOf(rows, from, to) {
  const NM = nMonths(from, to), g = new Array(NM).fill(0), net = new Array(NM).fill(0); let n = 0, s = 0, sn = 0, w = 0;
  for (const r of rows) { if (r.t < from || r.t >= to) continue; const m = mIdx(r.t, from); n++; s += r.R; sn += r.R - r.cr; if (r.R > 0) w++; g[m] += r.R; net[m] += r.R - r.cr; }
  const t = tMonth(g), tn = tMonth(net);
  return { n, meanR: n ? +(s / n).toFixed(4) : null, win: n ? +(w / n).toFixed(3) : null, tMonth: +t.toFixed(2), months: NM,
    pOne: +(t > 0 ? K.pFromT(t, NM - 1) / 2 : 1 - K.pFromT(t, NM - 1) / 2).toPrecision(4),
    netR: n ? +(sn / n).toFixed(4) : null, tNet: +tn.toFixed(2) };
}

// ---- one market of a set ------------------------------------------------------------------------------------------------
export function runMarket(set, market, dir) {
  const S = SETS[set], res = {}, meta = { set, market, cost: COSTS[market] };
  for (const rule of RULES) {
    const M5 = loadFor(rule, market, S); if (!M5.length) throw new Error('no candles ' + market);
    const rows = ROWS[rule](M5, market, S);
    res[rule] = rows.map((r) => [r.pl, r.t, +r.R.toFixed(6), +r.cr.toFixed(6)]);
    meta[rule] = { bars: M5.length, first: new Date(M5[0].t * 1000).toISOString().slice(0, 10), faded: rows.filter((r) => r.pl).length, real: rows.filter((r) => !r.pl).length };
  }
  if (dir) { fs.mkdirSync(dir, { recursive: true }); fs.writeFileSync(path.join(dir, `${set}.${market}.json`), JSON.stringify({ meta, rows: res })); }
  return { meta, rows: res };
}

// cut test: every rule's signals known by a cut are the same when the candles stop at the cut
export function cutTest(set, market) {
  const S = SETS[set], out = [];
  for (const rule of RULES) {
    const M5 = loadFor(rule, market, S);
    const full = ROWS[rule](M5, market, S, { signalsOnly: true });
    const span = S.to - S.from;
    for (const f of [0.3, 0.6, 0.9]) {
      const C = S.from + Math.round(span * f / 86400) * 86400 + 13 * 3600 + 37 * 60;
      const part = ROWS[rule](M5.filter((b) => b.e <= C), market, { from: S.from, to: S.to }, { signalsOnly: true });
      // keep signals decided by C - 1 day, so a signal on the cut's own candle that still waits on later structure is not counted
      const A = new Set(full.filter((s) => s.ts <= C - 86400).map((s) => s.key)), B = new Set(part.filter((s) => s.ts <= C - 86400).map((s) => s.key));
      let miss = 0, extra = 0; for (const k of A) if (!B.has(k)) miss++; for (const k of B) if (!A.has(k)) extra++;
      out.push({ rule, cut: new Date(C * 1000).toISOString().slice(0, 16), signals: A.size, missing: miss, extra });
    }
  }
  return out;
}

// ---- report -------------------------------------------------------------------------------------------------------------
export const PASS_T = 2, MIN_N = 50;
export function load(dir, set) {
  const out = {};
  for (const m of SETS[set].markets) { const f = path.join(dir, `${set}.${m}.json`); if (!fs.existsSync(f)) continue;
    const j = JSON.parse(fs.readFileSync(f, 'utf8')); out[m] = { meta: j.meta, rows: Object.fromEntries(RULES.map((r) => [r, j.rows[r].map(([pl, t, R, cr]) => ({ pl, t, R, cr, m }))])) }; }
  return out;
}
export function setStats(D, set, rule, pl) {
  const S = SETS[set], all = Object.values(D).flatMap((x) => x.rows[rule].filter((r) => r.pl === pl));
  return { pooled: statOf(all, S.from, S.to), perMarket: Object.fromEntries(Object.entries(D).map(([m, x]) => [m, statOf(x.rows[rule].filter((r) => r.pl === pl), S.from, S.to)])) };
}
export const ok = (s) => s.n >= MIN_N && s.meanR > 0 && s.tMonth >= PASS_T;
export function judge(primary) { // primary: [{ rule, set, stat }] -> Holm over all primary one-sided p
  const adj = K.holm(primary.map((x) => x.stat.pOne));
  primary.forEach((x, i) => { x.holm = +adj[i].toPrecision(4); x.pass = ok(x.stat) && adj[i] < 0.05; });
  const byRule = Object.fromEntries(RULES.map((r) => { const a = primary.find((x) => x.rule === r && x.set === 'A'), b = primary.find((x) => x.rule === r && x.set === 'B');
    return [r, { A: a.pass, B: b.pass, pass: a.pass && b.pass }]; }));
  const passed = RULES.filter((r) => byRule[r].pass), one = RULES.filter((r) => byRule[r].A !== byRule[r].B);
  const verdict = passed.length ? 'PASS' : one.length ? 'INCONCLUSIVE' : 'FAIL';
  return { byRule, passed, verdict };
}

const main = process.argv[1] === fileURLToPath(import.meta.url);
if (main) {
  const [cmd, a, b, c] = process.argv.slice(2);
  if (cmd === 'market') { const t0 = Date.now(); const { meta } = runMarket(a, b, c); console.log(JSON.stringify(meta), ((Date.now() - t0) / 1000).toFixed(0) + 's'); }
  else if (cmd === 'cut') { const r = cutTest(a, b); fs.mkdirSync(c, { recursive: true }); fs.writeFileSync(path.join(c, `${a}.${b}.cut.json`), JSON.stringify(r)); console.log(a, b, JSON.stringify(r)); }
  else console.log('usage: run.mjs market <set> <m> <dir> | cut <set> <m> <dir>   (then: node report.mjs <dir>)');
}
