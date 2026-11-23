// research/edge/grid7-wide-mosha-cycle/run.mjs - grid 7 of PREREGISTRATION.md (23 Nov 2026): the Mosha storyline, the
// cycle's pullback end and the continuation break, market entries, on ten markets, discovery 2005-2014, confirmation
// 2015 to Oct 2026, 54 cells fixed before any run.
// node research/edge/grid7-wide-mosha-cycle/run.mjs market <market> <outDir>   one market: signals and simulated trades
// node research/edge/grid7-wide-mosha-cycle/run.mjs report <outDir>            apply the pre-registered bar, write result.json
// node research/edge/grid7-wide-mosha-cycle/run.mjs cut <market> [n]           the cut test (no look-ahead) on 2011-2012
// Research only: imports edgekit, phase, grid5-mosha-cycle (storylines, frames, manage, atr14), grid5-msnr-box (h4Calls),
// combo-grid-2 (COSTS, exclusions) and the page's structure engine through council/mosha-desk.mjs loadFns (read, never
// edited). Writes only to <outDir> and its own folder.
import fs from 'node:fs';
import path from 'node:path';
import zlib from 'node:zlib';
import { fileURLToPath } from 'node:url';
import * as K from '../_lib/edgekit.mjs';
import { readPhase } from '../_lib/phase.mjs';
import { COSTS, exclusions } from '../combo-grid-2/run.mjs';
import { storylines, frames, manage, atr14 } from '../grid5-mosha-cycle/run.mjs';
import { h4Calls } from '../grid5-msnr-box/run.mjs';
import { loadFns } from '../../../council/mosha-desk.mjs';

const HERE = path.dirname(fileURLToPath(import.meta.url));
export const MARKETS = ['xau', 'xag', 'eurusd', 'gbpusd', 'usdjpy', 'audusd', 'nzdusd', 'usdcad', 'usdchf', 'eurjpy'];
export const ASSUMED_COST = ['xag', 'nzdusd', 'usdcad', 'usdchf', 'eurjpy'];
export const LOAD_FROM = '2004-01-01';
export const D0 = Date.UTC(2005, 0, 1) / 1000, SPLIT = Date.UTC(2015, 0, 1) / 1000, END = Date.UTC(2026, 10, 1) / 1000;
export const NM = 262, SPLIT_M = 120;      // months 2005-01 .. 2026-10; discovery = the first 120
export const monthOf = (t) => { const d = new Date(t * 1000); return (d.getUTCFullYear() - 2005) * 12 + d.getUTCMonth(); };
export const ATR_K = 0.1, DAY = 86400;
export const CAP5 = 5 * DAY, CAP2 = 2 * DAY;
export const GROUPS = ['mosha H4>H1 CF clear', 'mosha H4>H1 CF inside VR', 'mosha H1>M15 CF clear', 'mosha H1>M15 CF inside VR',
  'cycle pullback past 50%', 'cycle pullback under 50%', 'continuation pullback past 50%', 'continuation pullback under 50%', 'control every H1 break'];
export const CONTROL_G = 8;
export const EXITS = ['1R', '2R', 'ext'];
export const FILTERS = ['all', 'msnr agrees'];
// 54 cells: group x filter x exit
export const CELLS = [];
for (let g = 0; g < GROUPS.length; g++) for (let f = 0; f < 2; f++) for (let x = 0; x < 3; x++) CELLS.push({ g, f, x, name: `${GROUPS[g]} | ${FILTERS[f]} | ${EXITS[x]}` });
export const capOf = (g) => (g === 2 || g === 3 ? CAP2 : CAP5);

const lb = (B, t) => { let lo = 0, hi = B.length; while (lo < hi) { const m = (lo + hi) >> 1; if (B[m].t < t) lo = m + 1; else hi = m; } return lo; };

// ---- the H4 leg (readTf's external range) of the last H4 break known by T, on H4 candles closed by T -----------------
// returns { hi, lo, d4 } or null
export function legAt(H4, E4, T) {
  let lo = 0, hi = E4.length; while (lo < hi) { const m = (lo + hi) >> 1; if (E4[m].t <= T) lo = m + 1; else hi = m; }
  if (!lo) return null;
  const e = E4[lo - 1], n = K.closedCount(H4, T);
  let H = -Infinity, L = Infinity;
  if (e.dir > 0) { for (let i = e.from; i <= e.i; i++) L = Math.min(L, H4[i].l); for (let i = e.from; i < n; i++) H = Math.max(H, H4[i].h); }
  else { for (let i = e.from; i <= e.i; i++) H = Math.max(H, H4[i].h); for (let i = e.from; i < n; i++) L = Math.min(L, H4[i].l); }
  return { hi: H, lo: L, d4: e.dir };
}

// ---- every signal of one market (closed candles only) ------------------------------------------------------------------
// { g, d, T (trigger close), fill, stop, ext, msnr (call agrees), depth?, src }
export function signals(F, Fn) {
  const H4 = F['4h'], H1 = F['1h'];
  const E4 = K.structure(H4, 3).events, E1 = K.structure(H1, 3).events;
  const calls = h4Calls(F);
  const callAt = (T) => { const i = K.closedCount(H4, T) - 1; return i >= 0 ? calls[i] : 0; };
  const a1 = atr14(H1), out = [];
  const push = (g, d, T, fill, stop, extra = {}) => {
    if (!(d * (fill - stop) > 0)) return;            // the stop on the losing side, else not built
    const leg = legAt(H4, E4, T); const ext = leg ? (d > 0 ? leg.hi : leg.lo) : NaN;
    out.push({ g, d, T, fill, stop, ext, msnr: callAt(T) === d, ...extra });
  };
  // 1. Mosha storyline (grid 5's signals, CF on the VR timeframe, market at the CF close, stop past the CF zone)
  const cache = {};
  for (const [h, v, base] of [['4h', '1h', 0], ['1h', '15m', 2]]) {
    const C = F[v], ac = atr14(C);
    for (const s of storylines(F, Fn, h, v, v, cache)) {
      const a = ac[s.cfIdx]; if (!(a > 0)) continue;
      push(base + (s.inVR ? 1 : 0), s.d, s.T, C[s.cfIdx].c, s.origin - s.d * ATR_K * a);
    }
  }
  // stop of an H1-break trigger: the extreme from the broken swing to the break candle, past it by 0.1 ATR(14) of H1
  const h1Stop = (e) => { let x = e.dir > 0 ? Infinity : -Infinity;
    for (let i = e.from; i <= e.i; i++) x = e.dir > 0 ? Math.min(x, H1[i].l) : Math.max(x, H1[i].h);
    return a1[e.i] > 0 ? x - e.dir * ATR_K * a1[e.i] : NaN; };
  // 2 / 3. cycle and continuation, one H4 leg at a time
  let p = 0;
  for (let q = 0; q < E4.length; q++) {
    const e4 = E4[q], d = e4.dir, endT = q + 1 < E4.length ? E4[q + 1].t : Infinity;
    while (p < E1.length && E1[p].t <= e4.t) p++;
    let k = p, pbStart = -1, cyc = null;
    for (; k < E1.length && E1[k].t < endT; k++) { const e = E1[k];
      if (pbStart < 0) { if (e.dir === -d) pbStart = k; continue; }
      if (!cyc) { if (e.dir !== d) continue;
        // the pullback's extreme: H1 candles from the pullback's break candle to the trigger candle
        let pb = d > 0 ? Infinity : -Infinity; for (let i = E1[pbStart].i; i <= e.i; i++) pb = d > 0 ? Math.min(pb, H1[i].l) : Math.max(pb, H1[i].h);
        const leg = legAt(H4, E4, e.t); let depth = NaN;
        if (leg && leg.hi > leg.lo) depth = d > 0 ? (leg.hi - pb) / (leg.hi - leg.lo) : (pb - leg.lo) / (leg.hi - leg.lo);
        const past = depth >= 0.5;
        cyc = { past }; push(past ? 4 : 5, d, e.t, H1[e.i].c, h1Stop(e), { depth });
        continue; }
      if (e.dir === -d) break;                         // a second pullback: no continuation for this leg
      push(cyc.past ? 6 : 7, d, e.t, H1[e.i].c, h1Stop(e)); break;
    }
  }
  // 4. control: every H1 structure break
  for (const e of E1) push(CONTROL_G, e.dir, e.t, H1[e.i].c, h1Stop(e));
  return out;
}

// ---- one market -----------------------------------------------------------------------------------------------------
export function runMarket(market, { from = LOAD_FROM, to = END, Fn = loadFns() } = {}) {
  const M5 = K.load(market, '5m', { from, to }); const F = frames(M5); const cost = COSTS[market];
  const bad = exclusions(market); const badHit = (a, b) => bad.some(([x, y]) => x <= b && y >= a);
  const S = signals(F, Fn);
  const trades = []; let gate = 0, nbad = 0, open = 0;
  const sim = (d, fill, stop, ext, cap, T) => {
    const j = lb(M5, T); if (j >= M5.length) return null;
    const r = manage(M5, j, -1, fill, d, stop, ext, cap); if (!r || r.instant) return r;
    const xR = d * (ext - fill) / r.risk; return { fillT: r.fillT, exitT: r.exitT, risk: r.risk, R: [r.R[0], r.R[1], xR >= 1 ? r.R[3] : NaN] };
  };
  for (const s of S) {
    if (s.T < D0 || s.T >= END) continue;
    const caps = s.g === CONTROL_G ? [CAP5, CAP2] : [capOf(s.g)];
    const rs = caps.map((c) => sim(s.d, s.fill, s.stop, s.ext, c, s.T));
    if (rs.some((r) => r && r.instant) || !rs[0] || !(rs[0].risk > 0)) { if (!rs[0]) open++; else gate++; continue; }
    if (rs.some((r) => !r)) { open++; continue; }
    if (badHit(rs[0].fillT, Math.max(...rs.map((r) => r.exitT)))) { nbad++; continue; }
    // placebo: the other side at the same fill, stop and ext mirrored
    const pl = sim(-s.d, s.fill, 2 * s.fill - s.stop, 2 * s.fill - s.ext, caps[0], s.T);
    const rnd = (x) => (Number.isFinite(x) ? +x.toFixed(5) : null);
    trades.push({ g: s.g, d: s.d, f: s.msnr ? 1 : 0, T: s.T, m: monthOf(s.T), risk: +rs[0].risk.toPrecision(6), cr: +(cost / rs[0].risk).toFixed(5),
      R: rs[0].R.map(rnd), R2: rs[1] ? rs[1].R.map(rnd) : undefined, P: pl && !pl.instant ? pl.R.map(rnd) : null });
  }
  // a look at phase.mjs: at the first 40 cycle triggers, the H4 stage readPhase gives (expected 'continuation')
  const ph = {}; let seen = 0;
  for (const s of S) { if (s.g !== 4 && s.g !== 5) continue; if (s.T < D0) continue; if (++seen > 40) break;
    const st = readPhase({ '4h': F['4h'], '1h': F['1h'] }, s.T, { window: 600 }).tf['4h'].stage; ph[st] = (ph[st] || 0) + 1; }
  return { market, signals: S.length, trades, gate, nbad, open, phaseCheck: ph };
}
export function save(dir, out) {
  fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(path.join(dir, out.market + '.json.gz'), zlib.gzipSync(JSON.stringify(out)));
}
const loadOne = (dir, m) => JSON.parse(zlib.gunzipSync(fs.readFileSync(path.join(dir, m + '.json.gz'))).toString());

// ---- statistics -------------------------------------------------------------------------------------------------------
export function monthT(rows, key, a, b) { // month sums over months [a, b), empty months 0
  const ms = new Float64Array(b - a); for (const r of rows) if (r.m >= a && r.m < b) ms[r.m - a] += r[key];
  const n = b - a; let s = 0, q = 0; for (const x of ms) { s += x; q += x * x; }
  const mean = s / n, sd = Math.sqrt(Math.max(0, (q - n * mean * mean) / (n - 1)));
  return sd > 0 ? mean / (sd / Math.sqrt(n)) : 0;
}
export function welch(a, b) {
  const mv = (x) => { const n = x.length, m = x.reduce((p, q) => p + q, 0) / n; return [n, m, x.reduce((p, q) => p + (q - m) ** 2, 0) / (n - 1)]; };
  if (a.length < 2 || b.length < 2) return null; const [n1, m1, v1] = mv(a), [n2, m2, v2] = mv(b); const se = Math.sqrt(v1 / n1 + v2 / n2);
  return se > 0 ? (m1 - m2) / se : null;
}
const r4 = (x) => (x == null || !Number.isFinite(x) ? null : +x.toFixed(4));
const r2 = (x) => (x == null || !Number.isFinite(x) ? null : +x.toFixed(2));

// a cell's rows: { m, r (before costs), n (after costs), d, market }
function cellRows(all, cell, side = 'real') {
  const out = [];
  for (const t of all) { if (t.g !== cell.g || (cell.f && !t.f)) continue;
    const R = side === 'real' ? t.R[cell.x] : t.P ? t.P[cell.x] : null; if (R == null) continue;
    out.push({ m: t.m, r: R, n: R - t.cr, d: side === 'real' ? t.d : -t.d, market: t.market }); }
  return out;
}
function windowStats(rows, a, b) {
  const w = rows.filter((x) => x.m >= a && x.m < b), n = w.length;
  return { n, meanR: n ? r4(w.reduce((p, x) => p + x.r, 0) / n) : null, tMonth: r2(monthT(rows, 'r', a, b)),
    netR: n ? r4(w.reduce((p, x) => p + x.n, 0) / n) : null, tMonthNet: r2(monthT(rows, 'n', a, b)) };
}
// matched control: one random control trade a real trade, same market, month, side, exit, time limit, valid target
function matched(rows, ctrl, cell, rng) {
  const cap2 = capOf(cell.g) === CAP2, out = [];
  for (const x of rows) { const pool = ctrl.get(x.market + '|' + x.m + '|' + x.d); if (!pool) continue;
    const ok = pool.filter((t) => (cap2 ? t.R2 : t.R)[cell.x] != null); if (!ok.length) continue;
    const t = ok[Math.floor(rng() * ok.length)]; out.push({ m: x.m, r: (cap2 ? t.R2 : t.R)[cell.x] }); }
  return out;
}
export function evaluate(all, { seed = 20261123 } = {}) {
  const ctrl = new Map(); for (const t of all) if (t.g === CONTROL_G) { const k = t.market + '|' + t.m + '|' + t.d; (ctrl.get(k) || ctrl.set(k, []).get(k)).push(t); }
  const one = (side) => {
    const rng = K.rng(seed + (side === 'real' ? 0 : 1));
    const res = CELLS.map((cell) => {
      const rows = cellRows(all, cell, side);
      const disc = windowStats(rows, 0, SPLIT_M), conf = windowStats(rows, SPLIT_M, NM);
      conf.p = r4(K.pFromT(conf.tMonth, NM - SPLIT_M - 1) ?? 1);
      let ctl = null;
      if (cell.g !== CONTROL_G) { const mc = matched(rows, ctrl, cell, rng);
        const sub = (arr, a, b) => arr.filter((x) => x.m >= a && x.m < b).map((x) => x.r);
        const mean = (x) => (x.length ? x.reduce((p, q) => p + q, 0) / x.length : null);
        ctl = { disc: { n: sub(mc, 0, SPLIT_M).length, meanR: r4(mean(sub(mc, 0, SPLIT_M))), welchT: r2(welch(sub(rows, 0, SPLIT_M), sub(mc, 0, SPLIT_M))) },
          conf: { n: sub(mc, SPLIT_M, NM).length, meanR: r4(mean(sub(mc, SPLIT_M, NM))), welchT: r2(welch(sub(rows, SPLIT_M, NM), sub(mc, SPLIT_M, NM))) } }; }
      return { cell: cell.name, g: cell.g, f: cell.f, x: cell.x, disc, conf, control: ctl, rows };
    });
    const adj = K.holm(res.map((r) => r.conf.p)); res.forEach((r, i) => { r.conf.holm = +adj[i].toPrecision(3);
      r.bar = { n: r.disc.n >= 300 && r.conf.n >= 300, disc: r.disc.meanR > 0 && r.disc.tMonth >= 2, conf: r.conf.meanR > 0 && r.conf.tMonth >= 2,
        holm: r.conf.holm <= 0.05, control: !!(r.control && r.control.disc.welchT >= 2 && r.control.conf.welchT >= 2) };
      r.pass = Object.values(r.bar).every(Boolean); });
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
  const sizeable = E.real.filter((r) => r.g !== CONTROL_G && r.bar.n).length;
  const verdict = sizeable < 10 ? 'INCONCLUSIVE' : passes.length && plPass.length < passes.length ? 'PASS' : 'FAIL';
  const perMarket = passes.map((r) => ({ cell: r.cell, markets: MARKETS.map((m) => { const rows = r.rows.filter((x) => x.market === m);
    return { market: m, disc: windowStats(rows, 0, SPLIT_M), conf: windowStats(rows, SPLIT_M, NM) }; }) }));
  const cut = fs.readdirSync(dir).filter((f) => /^cut-.*\.json$/.test(f)).map((f) => JSON.parse(fs.readFileSync(path.join(dir, f), 'utf8')));
  const cutTest = { markets: cut, compared: cut.reduce((x, c) => x + c.compared, 0), mismatches: cut.reduce((x, c) => x + c.mismatches, 0) };
  return { verdict, passes: passes.length, cutTest, placeboPasses: plPass.length, sizeable,
    markets: per.map((p) => ({ market: p.market, signals: p.signals, trades: p.trades.length, droppedBadData: p.nbad, gateFail: p.gate, unfinished: p.open, phaseCheck: p.phaseCheck })),
    cells: E.real.map(strip), placebo: E.placebo.map(strip), perMarket };
}

// ---- cut test ---------------------------------------------------------------------------------------------------------
export function cutFrames(M5, cut) { const F = frames(M5.filter((b) => b.e <= cut)); for (const k of Object.keys(F)) F[k] = F[k].filter((b) => b.e <= cut); return F; }
export const sigKey = (s) => [s.g, s.d, s.T, s.fill, s.stop, s.ext, s.msnr, s.depth ?? ''].join('|');
export function cutCheck(M5, Fn, cuts) {
  const whole = signals(frames(M5), Fn); let compared = 0, bad = 0;
  for (const cut of cuts) { const a = whole.filter((s) => s.T <= cut).map(sigKey).sort(), b = signals(cutFrames(M5, cut), Fn).filter((s) => s.T <= cut).map(sigKey).sort();
    compared += a.length; if (a.join('\n') !== b.join('\n')) bad++; }
  return { cuts: cuts.length, compared, mismatches: bad };
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const [cmd, a, b] = process.argv.slice(2);
  if (cmd === 'market') { const t0 = Date.now(); const out = runMarket(a); save(b, out);
    console.log(a, out.signals, 'signals', out.trades.length, 'trades', out.nbad, 'dropped', out.gate, 'gate', out.open, 'open', JSON.stringify(out.phaseCheck), ((Date.now() - t0) / 1000).toFixed(0) + 's'); }
  else if (cmd === 'report') { const R = report(a); fs.writeFileSync(path.join(a, 'report.json'), JSON.stringify(R, null, 1));
    const best = R.cells.filter((c) => c.g !== CONTROL_G && c.disc.n >= 300 && c.conf.n >= 300).sort((p, q) => q.conf.tMonth - p.conf.tMonth)[0];
    const sg = (x) => (x >= 0 ? '+' : '') + x.toFixed(3);
    const headline = `${R.passes} of ${CELLS.length} cells passed (placebo ${R.placeboPasses}); the best confirmation cell, ${best.cell}, made ${sg(best.conf.meanR)}R a trade before costs in 2015-26 (n ${best.conf.n}, month t ${best.conf.tMonth.toFixed(2)}) after ${sg(best.disc.meanR)}R in 2005-14 (n ${best.disc.n}, t ${best.disc.tMonth.toFixed(2)}).`;
    const out = { study: 'grid7-wide-mosha-cycle', built: '2026-11-23', verdict: R.verdict, headline, best: best.cell, assumedCost: ASSUMED_COST,
      windows: { discovery: '2005-01 to 2014-12', confirmation: '2015-01 to 2026-10' }, ...R };
    fs.writeFileSync(path.join(HERE, 'result.json'), JSON.stringify(out, null, 1) + '\n'); console.log(R.verdict, headline); }
  else if (cmd === 'cut') { const M5 = K.load(a, '5m', { from: '2011-01-01', to: '2013-01-01' }); const r = K.rng(20261123), cuts = [];
    for (let i = 0; i < +(b || 20); i++) cuts.push(Math.floor(M5[20000].t + r() * (M5[M5.length - 1].t - M5[20000].t)));
    const res = { market: a, ...cutCheck(M5, loadFns(), cuts) }; console.log(JSON.stringify(res));
    if (process.argv[5]) fs.writeFileSync(path.join(process.argv[5], 'cut-' + a + '.json'), JSON.stringify(res)); }
  else console.log('usage: run.mjs market <m> <dir> | report <dir> | cut <m> [n] [outDir]');
}
