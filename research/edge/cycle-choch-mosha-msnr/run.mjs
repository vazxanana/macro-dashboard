// research/edge/cycle-choch-mosha-msnr/run.mjs - the study of PREREGISTRATION.md (23 Nov 2026): every H1 ChoCh labelled
// with the H4 cycle position, the Daily MSNR call, whether it is a Mosha CF of an H4 BO and the H4 pullback depth; market
// entry at the next 5m open; 51 cells fixed before any run; ten markets, discovery 2005-2014, confirmation 2015 to Oct 2026.
// node research/edge/cycle-choch-mosha-msnr/run.mjs market <market> <outDir>   one market: signals and simulated trades
// node research/edge/cycle-choch-mosha-msnr/run.mjs report <outDir>            apply the pre-registered bar, write result.json
// node research/edge/cycle-choch-mosha-msnr/run.mjs cut <market> [n] [outDir]  the cut test (no look-ahead) on 2011-2012
// Research only: imports edgekit, phase, grid5-mosha-cycle (storylines, frames, manage, atr14), grid5-msnr-box (h4Calls),
// grid7-wide-mosha-cycle (legAt, monthT, welch), combo-grid-2 (COSTS, exclusions) and the page's structure engine through
// council/mosha-desk.mjs loadFns (read, never edited). Writes only to <outDir> and its own folder.
import fs from 'node:fs';
import path from 'node:path';
import zlib from 'node:zlib';
import { fileURLToPath } from 'node:url';
import * as K from '../_lib/edgekit.mjs';
import { readPhase } from '../_lib/phase.mjs';
import { COSTS, exclusions } from '../combo-grid-2/run.mjs';
import { storylines, frames, manage, atr14 } from '../grid5-mosha-cycle/run.mjs';
import { h4Calls } from '../grid5-msnr-box/run.mjs';
import { legAt, monthT, welch } from '../grid7-wide-mosha-cycle/run.mjs';
import { loadFns } from '../../../council/mosha-desk.mjs';

const HERE = path.dirname(fileURLToPath(import.meta.url));
export const MARKETS = ['xau', 'xag', 'eurusd', 'gbpusd', 'usdjpy', 'audusd', 'nzdusd', 'usdcad', 'usdchf', 'eurjpy'];
export const ASSUMED_COST = ['xag', 'nzdusd', 'usdcad', 'usdchf', 'eurjpy'];
export const LOAD_FROM = '2004-01-01';
export const D0 = Date.UTC(2005, 0, 1) / 1000, END = Date.UTC(2026, 10, 1) / 1000;
export const NM = 262, SPLIT_M = 120;
export const monthOf = (t) => { const d = new Date(t * 1000); return (d.getUTCFullYear() - 2005) * 12 + d.getUTCMonth(); };
export const ATR_K = 0.1, CAP = 5 * 86400;
export const EXITS = ['1R', '2R', 'ext'];
export const POS = ['pullback end', 'other, with', 'pullback start', 'other, against'];

// the 17 combinations (a: pos, b: msnr agrees, c: Mosha CF, d: past 50%), null = not split; the last one is the control
export const COMBOS = [];
for (const b of [1, 0]) for (const c of [1, 0]) for (const dd of [1, 0]) COMBOS.push({ a: 0, b, c, d: dd });
for (const b of [1, 0]) for (const c of [1, 0]) COMBOS.push({ a: 1, b, c, d: null });
for (const a of [2, 3]) for (const b of [1, 0]) COMBOS.push({ a, b, c: null, d: null });
COMBOS.push({ control: true });
export const comboName = (k) => k.control ? 'control: every H1 ChoCh' : [POS[k.a], k.b ? 'msnr agrees' : 'msnr not', k.c == null ? null : k.c ? 'Mosha CF' : 'not a CF',
  k.d == null ? null : k.d ? 'past 50%' : 'under 50%'].filter(Boolean).join(' | ');
export const CELLS = [];
COMBOS.forEach((k, ci) => EXITS.forEach((x, xi) => CELLS.push({ ci, x: xi, control: !!k.control, name: `${comboName(k)} | ${x}` })));
export const ALIGNED = 0; // combo 0 = pullback end | msnr agrees | Mosha CF | past 50%
export const inCombo = (k, s) => k.control || (s.pos === k.a && s.msnr === k.b && (k.c == null || s.cf === k.c) && (k.d == null || s.deep === k.d));

const lb = (B, t) => { let lo = 0, hi = B.length; while (lo < hi) { const m = (lo + hi) >> 1; if (B[m].t < t) lo = m + 1; else hi = m; } return lo; };
const ub = (E, t) => { let lo = 0, hi = E.length; while (lo < hi) { const m = (lo + hi) >> 1; if (E[m].t <= t) lo = m + 1; else hi = m; } return lo; }; // events with t <= t

// ---- H4 stage just before T (phase.mjs's rules on whole-series events) ----------------------------------------------
export function stageBefore(E4, E1, T) {
  const n4 = ub(E4, T); if (!n4) return { d4: 0, stage: 'range' };
  const last = E4[n4 - 1], prev = E4[n4 - 2], prev2 = E4[n4 - 3], d4 = last.dir;
  const twoChoCh = last.kind === 'ChoCh' && prev && prev.kind === 'ChoCh';
  if (twoChoCh && !(prev2 && prev2.kind === 'BO' && prev2.dir === d4)) return { d4, stage: 'range', h4t: last.t };
  let against = false, back = false;
  for (let k = ub(E1, last.t); k < E1.length && E1[k].t < T; k++) { const e = E1[k];
    if (!against) { if (e.dir === -d4) against = true; } else if (e.dir === d4) { back = true; break; } }
  return { d4, stage: !against ? 'move' : back ? 'continuation' : 'pullback', h4t: last.t };
}

// ---- every H1 ChoCh of one market with its readings (closed candles only) ----------------------------------------------
// { d, T, stop, ext, pos, msnr, cf, deep, depth, stage, d4 }
export function signals(F, Fn) {
  const H4 = F['4h'], H1 = F['1h'];
  const E4 = K.structure(H4, 3).events, E1 = K.structure(H1, 3).events;
  const calls = h4Calls(F);
  const callAt = (T) => { const i = K.closedCount(H4, T) - 1; return i >= 0 ? calls[i] : 0; };
  const a1 = atr14(H1);
  const cfSet = new Set(); for (const s of storylines(F, Fn, '4h', '1h', '1h', {})) cfSet.add(s.d + '|' + s.T);
  const out = [];
  for (const e of E1) {
    if (e.kind !== 'ChoCh') continue;
    const d = e.dir, T = e.t;
    let x = d > 0 ? Infinity : -Infinity; for (let i = e.from; i <= e.i; i++) x = d > 0 ? Math.min(x, H1[i].l) : Math.max(x, H1[i].h);
    if (!(a1[e.i] > 0)) continue;
    const stop = x - d * ATR_K * a1[e.i];
    const { d4, stage } = stageBefore(E4, E1, T);
    const leg = legAt(H4, E4, T);
    const ext = leg ? (d > 0 ? leg.hi : leg.lo) : NaN;
    // depth: back from the H4 leg's extreme, on H1 candles closed by T from the H4 candle of the extreme on
    let depth = NaN;
    if (leg && leg.hi > leg.lo) {
      const n4 = K.closedCount(H4, T); let xi = -1, xv = leg.d4 > 0 ? -Infinity : Infinity;
      for (let i = n4 - 1; i >= 0 && H4[i].e > (leg.t0 ?? -Infinity); i--) { const p = leg.d4 > 0 ? H4[i].h : H4[i].l; if (p === (leg.d4 > 0 ? leg.hi : leg.lo)) { xi = i; break; } }
      if (xi >= 0) { const n1 = K.closedCount(H1, T); let back = leg.d4 > 0 ? leg.hi : leg.lo;
        for (let j = lb(H1, H4[xi].t); j < n1; j++) back = leg.d4 > 0 ? Math.min(back, H1[j].l) : Math.max(back, H1[j].h);
        depth = leg.d4 > 0 ? (leg.hi - back) / (leg.hi - leg.lo) : (back - leg.lo) / (leg.hi - leg.lo); }
    }
    const pos = stage === 'pullback' && d === d4 ? 0 : stage === 'move' && d === -d4 ? 2 : d === d4 ? 1 : 3;
    out.push({ d, T, stop, ext, pos, stage, d4, msnr: callAt(T) === d ? 1 : 0, cf: cfSet.has(d + '|' + T) ? 1 : 0, depth, deep: depth >= 0.5 ? 1 : 0 });
  }
  return out;
}

// ---- one market -----------------------------------------------------------------------------------------------------
export function runMarket(market, { from = LOAD_FROM, to = END, Fn = loadFns() } = {}) {
  const M5 = K.load(market, '5m', { from, to }); const F = frames(M5); const cost = COSTS[market];
  const bad = exclusions(market); const badHit = (a, b) => bad.some(([x, y]) => x <= b && y >= a);
  const S = signals(F, Fn);
  const trades = []; let gate = 0, nbad = 0, open = 0;
  const sim = (d, j, fill, stop, ext) => {
    const r = manage(M5, j, -1, fill, d, stop, ext, CAP); if (!r || r.instant) return r;
    const xR = d * (ext - fill) / r.risk; return { fillT: r.fillT, exitT: r.exitT, risk: r.risk, R: [r.R[0], r.R[1], xR >= 1 ? r.R[3] : NaN] };
  };
  for (const s of S) {
    if (s.T < D0 || s.T >= END) continue;
    const j = lb(M5, s.T); if (j >= M5.length) { open++; continue; }
    const fill = M5[j].o;
    if (!(s.d * (fill - s.stop) > 0)) { gate++; continue; }   // the stop must be on the losing side of the fill
    const r = sim(s.d, j, fill, s.stop, s.ext);
    if (!r) { open++; continue; } if (r.instant) { gate++; continue; }
    if (badHit(r.fillT, r.exitT)) { nbad++; continue; }
    const pl = sim(-s.d, j, fill, 2 * fill - s.stop, Number.isFinite(s.ext) ? 2 * fill - s.ext : NaN);
    const rnd = (x) => (Number.isFinite(x) ? +x.toFixed(5) : null);
    trades.push({ d: s.d, T: s.T, m: monthOf(s.T), pos: s.pos, msnr: s.msnr, cf: s.cf, deep: s.deep, risk: +r.risk.toPrecision(6),
      cr: +(cost / r.risk).toFixed(5), R: r.R.map(rnd), P: pl && !pl.instant ? pl.R.map(rnd) : null });
  }
  // (a) against phase.mjs readPhase itself on the first 60 ChoChs from 2005 (agreement reported, not judged)
  let seen = 0, same = 0;
  for (const s of S) { if (s.T < D0) continue; if (seen >= 60) break; seen++;
    const st = readPhase({ '4h': F['4h'], '1h': F['1h'] }, s.T - 1, { window: 600 }).tf['4h'].stage; if (st === s.stage) same++; }
  const counts = {}; for (const s of S) if (s.T >= D0 && s.T < END) { const k = POS[s.pos]; counts[k] = (counts[k] || 0) + 1; counts.cf = (counts.cf || 0) + s.cf; }
  return { market, signals: S.length, trades, gate, nbad, open, phaseCheck: { compared: seen, agree: same }, counts };
}
export function save(dir, out) {
  fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(path.join(dir, out.market + '.json.gz'), zlib.gzipSync(JSON.stringify(out)));
}
const loadOne = (dir, m) => JSON.parse(zlib.gunzipSync(fs.readFileSync(path.join(dir, m + '.json.gz'))).toString());

// ---- statistics -------------------------------------------------------------------------------------------------------
const r4 = (x) => (x == null || !Number.isFinite(x) ? null : +x.toFixed(4));
const r2 = (x) => (x == null || !Number.isFinite(x) ? null : +x.toFixed(2));
function cellRows(all, cell, side = 'real') {
  const k = COMBOS[cell.ci], out = [];
  for (const t of all) { if (!inCombo(k, t)) continue;
    const R = side === 'real' ? t.R[cell.x] : t.P ? t.P[cell.x] : null; if (R == null) continue;
    out.push({ m: t.m, r: R, n: R - t.cr, market: t.market }); }
  return out;
}
export function windowStats(rows, a, b) {
  const w = rows.filter((x) => x.m >= a && x.m < b), n = w.length;
  return { n, meanR: n ? r4(w.reduce((p, x) => p + x.r, 0) / n) : null, tMonth: r2(monthT(rows, 'r', a, b)),
    netR: n ? r4(w.reduce((p, x) => p + x.n, 0) / n) : null, tMonthNet: r2(monthT(rows, 'n', a, b)) };
}
export function evaluate(all) {
  const one = (side) => {
    const rows = CELLS.map((c) => cellRows(all, c, side));
    const ctlOf = (x) => rows[CELLS.findIndex((c) => c.control && c.x === x)];
    const sub = (arr, a, b) => arr.filter((q) => q.m >= a && q.m < b).map((q) => q.r);
    const res = CELLS.map((cell, i) => {
      const R = rows[i], disc = windowStats(R, 0, SPLIT_M), conf = windowStats(R, SPLIT_M, NM);
      conf.p = r4(K.pFromT(conf.tMonth, NM - SPLIT_M - 1) ?? 1);
      const C = ctlOf(cell.x);
      const vs = cell.control ? null : { disc: r2(welch(sub(R, 0, SPLIT_M), sub(C, 0, SPLIT_M))), conf: r2(welch(sub(R, SPLIT_M, NM), sub(C, SPLIT_M, NM))) };
      return { cell: cell.name, ci: cell.ci, x: cell.x, control: cell.control, disc, conf, vsControl: vs, rows: R };
    });
    const judged = res.filter((r) => !r.control);
    const adj = K.holm(judged.map((r) => r.conf.p)); judged.forEach((r, i) => { r.conf.holm = +adj[i].toPrecision(3); });
    for (const r of res) {
      if (r.control) { r.pass = false; continue; }
      r.bar = { n: r.disc.n >= 300 && r.conf.n >= 300, disc: r.disc.meanR > 0 && r.disc.tMonth >= 2, conf: r.conf.meanR > 0 && r.conf.tMonth >= 2,
        holm: r.conf.holm <= 0.05, control: !!(r.vsControl && r.vsControl.disc >= 2 && r.vsControl.conf >= 2) };
      r.pass = Object.values(r.bar).every(Boolean);
    }
    return res;
  };
  return { real: one('real'), placebo: one('placebo') };
}
export function report(dir) {
  const per = MARKETS.map((m) => loadOne(dir, m));
  const all = []; for (const p of per) for (const t of p.trades) all.push({ ...t, market: p.market });
  const E = evaluate(all);
  const strip = (r) => { const { rows, ...rest } = r; return rest; };
  const passes = E.real.filter((r) => r.pass), plPass = E.placebo.filter((r) => r.pass);
  const sizeable = E.real.filter((r) => !r.control && r.bar.n).length;
  const verdict = sizeable < 10 ? 'INCONCLUSIVE' : passes.length && plPass.length < passes.length ? 'PASS' : 'FAIL';
  const perMarket = passes.map((r) => ({ cell: r.cell, markets: MARKETS.map((m) => { const rows = r.rows.filter((x) => x.market === m);
    return { market: m, disc: windowStats(rows, 0, SPLIT_M), conf: windowStats(rows, SPLIT_M, NM) }; }) }));
  const cut = fs.readdirSync(dir).filter((f) => /^cut-.*\.json$/.test(f)).map((f) => JSON.parse(fs.readFileSync(path.join(dir, f), 'utf8')));
  const cutTest = { markets: cut, compared: cut.reduce((x, c) => x + c.compared, 0), mismatches: cut.reduce((x, c) => x + c.mismatches, 0) };
  return { verdict, passes: passes.length, placeboPasses: plPass.length, sizeable, cutTest,
    markets: per.map((p) => ({ market: p.market, signals: p.signals, trades: p.trades.length, droppedBadData: p.nbad, gateFail: p.gate, unfinished: p.open, counts: p.counts, phaseCheck: p.phaseCheck })),
    cells: E.real.map(strip), placebo: E.placebo.map(strip), perMarket };
}

// ---- cut test ---------------------------------------------------------------------------------------------------------
export function cutFrames(M5, cut) { const F = frames(M5.filter((b) => b.e <= cut)); for (const k of Object.keys(F)) F[k] = F[k].filter((b) => b.e <= cut); return F; }
export const sigKey = (s) => [s.d, s.T, s.stop, s.ext, s.pos, s.stage, s.msnr, s.cf, s.deep, Number.isFinite(s.depth) ? s.depth.toFixed(9) : ''].join('|');
export function cutCheck(M5, Fn, cuts) {
  const whole = signals(frames(M5), Fn); let compared = 0, bad = 0;
  for (const cut of cuts) { const a = whole.filter((s) => s.T <= cut).map(sigKey).sort(), b = signals(cutFrames(M5, cut), Fn).filter((s) => s.T <= cut).map(sigKey).sort();
    compared += a.length; if (a.join('\n') !== b.join('\n')) bad++; }
  return { cuts: cuts.length, compared, mismatches: bad };
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const [cmd, a, b] = process.argv.slice(2);
  if (cmd === 'market') { const t0 = Date.now(); const out = runMarket(a); save(b, out);
    console.log(a, out.signals, 'signals', out.trades.length, 'trades', out.nbad, 'dropped', out.gate, 'gate', out.open, 'open', JSON.stringify(out.counts), JSON.stringify(out.phaseCheck), ((Date.now() - t0) / 1000).toFixed(0) + 's'); }
  else if (cmd === 'report') { const R = report(a); fs.writeFileSync(path.join(a, 'report.json'), JSON.stringify(R, null, 1));
    const sg = (x) => (x >= 0 ? '+' : '') + x.toFixed(3);
    const best = R.cells.filter((c) => !c.control && c.disc.n >= 300 && c.conf.n >= 300).sort((p, q) => q.conf.tMonth - p.conf.tMonth)[0];
    const al = R.cells.filter((c) => c.ci === ALIGNED);
    const alTxt = al.map((c) => `${EXITS[c.x]} ${c.conf.meanR == null ? 'n/a' : sg(c.conf.meanR)}R (n ${c.conf.n})`).join(', ');
    const headline = `${R.passes} of 48 cells passed (placebo ${R.placeboPasses}); the best confirmation cell, ${best.cell}, made ${sg(best.conf.meanR)}R a trade before costs in 2015-26 (n ${best.conf.n}, month t ${best.conf.tMonth.toFixed(2)}) after ${sg(best.disc.meanR)}R in 2005-14 (n ${best.disc.n}, t ${best.disc.tMonth.toFixed(2)}); the all-aligned cell in 2015-26: ${alTxt}.`;
    const out = { study: 'cycle-choch-mosha-msnr', built: '2026-11-23', verdict: R.verdict, headline, best: best.cell, assumedCost: ASSUMED_COST,
      windows: { discovery: '2005-01 to 2014-12', confirmation: '2015-01 to 2026-10' }, ...R };
    fs.writeFileSync(path.join(HERE, 'result.json'), JSON.stringify(out, null, 1) + '\n'); console.log(R.verdict, headline); }
  else if (cmd === 'cut') { const M5 = K.load(a, '5m', { from: '2011-01-01', to: '2013-01-01' }); const r = K.rng(20261123), cuts = [];
    for (let i = 0; i < +(b || 20); i++) cuts.push(Math.floor(M5[20000].t + r() * (M5[M5.length - 1].t - M5[20000].t)));
    const res = { market: a, ...cutCheck(M5, loadFns(), cuts) }; console.log(JSON.stringify(res));
    if (process.argv[5]) fs.writeFileSync(path.join(process.argv[5], 'cut-' + a + '.json'), JSON.stringify(res)); }
  else console.log('usage: run.mjs market <m> <dir> | report <dir> | cut <m> [n] [outDir]');
}
