// research/edge/grid7-cf-engulf/run.mjs - grid 7 of PREREGISTRATION.md (23 Nov 2026): the Mosha CF that is also an engulf of
// the BO's side (EG) or closes through an engulf zone of the other side (EF), market entries with and against the BO, on ten
// markets, discovery 2005-2014, confirmation 2015 to Oct 2026, 48 cells fixed before any run.
// node research/edge/grid7-cf-engulf/run.mjs market <market> <outDir>   one market: signals and simulated trades
// node research/edge/grid7-cf-engulf/run.mjs report <outDir>            apply the pre-registered bar, write result.json
// node research/edge/grid7-cf-engulf/run.mjs cut <market> [n] [outDir]  the cut test (no look-ahead) on 2011-2012
// Research only: imports edgekit, grid5-mosha-cycle (storylines, manage, atr14, SEC), council/eg-methods.mjs (engulfAt,
// zones), combo-grid-2 (COSTS, exclusions), grid7-wide-mosha-cycle (statistics) and the page's structure engine through
// council/mosha-desk.mjs loadFns (read, never edited). Writes only to <outDir> and its own folder.
import fs from 'node:fs';
import path from 'node:path';
import zlib from 'node:zlib';
import { fileURLToPath } from 'node:url';
import * as K from '../_lib/edgekit.mjs';
import { COSTS, exclusions } from '../combo-grid-2/run.mjs';
import { storylines, manage, atr14, SEC as G5SEC } from '../grid5-mosha-cycle/run.mjs';
import { monthT, welch } from '../grid7-wide-mosha-cycle/run.mjs';
import { engulfAt, zones, EG_SPAN } from '../../../council/eg-methods.mjs';
import { loadFns } from '../../../council/mosha-desk.mjs';

const HERE = path.dirname(fileURLToPath(import.meta.url));
G5SEC['30m'] ||= 1800;      // grid 5's storylines read SEC[h] for its barrier factor; it has no 30m entry (value only, file not edited)
export const MARKETS = ['xau', 'xag', 'eurusd', 'gbpusd', 'usdjpy', 'audusd', 'nzdusd', 'usdcad', 'usdchf', 'eurjpy'];
export const ASSUMED_COST = ['xag', 'nzdusd', 'usdcad', 'usdchf', 'eurjpy'];
export const LOAD_FROM = '2004-01-01';
export const D0 = Date.UTC(2005, 0, 1) / 1000, SPLIT = Date.UTC(2015, 0, 1) / 1000, END = Date.UTC(2026, 10, 1) / 1000;
export const NM = 262, SPLIT_M = 120;
export const monthOf = (t) => { const d = new Date(t * 1000); return (d.getUTCFullYear() - 2005) * 12 + d.getUTCMonth(); };
export const ATR_K = 0.1, DAY = 86400;
export const LADDERS = [['4h', '1h', 5 * DAY], ['1h', '15m', 2 * DAY], ['30m', '5m', 1 * DAY]];
export const LNAME = ['H4>H1', 'H1>M15', 'M30>M5'];
export const SIGS = ['EG', 'EF'], PLACES = ['clear', 'inside'], EXITS = ['1R', '2R', 'ext'];
// 48 cells: with set 3 x 2 x 2 x 3 = 36, against set 3 x 2 x 2 = 12 (place pooled = -1)
export const CELLS = [];
for (let l = 0; l < 3; l++) for (let s = 0; s < 2; s++) for (let p = 0; p < 2; p++) for (let x = 0; x < 3; x++)
  CELLS.push({ set: 0, l, s, p, x, name: `with | ${LNAME[l]} | ${SIGS[s]} | ${PLACES[p]} | ${EXITS[x]}` });
for (let l = 0; l < 3; l++) for (let s = 0; s < 2; s++) for (let x = 0; x < 2; x++)
  CELLS.push({ set: 1, l, s, p: -1, x, name: `against | ${LNAME[l]} | ${SIGS[s]} | pooled | ${EXITS[x]}` });

const lb = (B, t) => { let lo = 0, hi = B.length; while (lo < hi) { const m = (lo + hi) >> 1; if (B[m].t < t) lo = m + 1; else hi = m; } return lo; };
const conv = (B) => B.map((b) => ({ time: b.t, open: b.o, high: b.h, low: b.l, close: b.c }));
export const frames = (M5) => ({ '5m': M5, '15m': K.resample(M5, 900), '30m': K.resample(M5, 1800), '1h': K.resample(M5, 3600), '4h': K.resample(M5, 14400) });
// the stage factor of storylines is not used: a stub memo keeps it from being computed (and lets M30 run)
const noStage = () => ({ get: () => 'n/a', set() {} });

// the EG / EF flags of every candle of one lower timeframe: eg[i] = side of an engulf completed by candle i (0 none);
// ef[i] = side d when candle i is the first close through an engulf zone of side -d (0 none)
export function flags(V, tf) {
  const C = conv(V), eg = new Int8Array(V.length), ef = new Int8Array(V.length);
  for (let i = 1; i < V.length; i++) { const e = engulfAt(C, i, EG_SPAN); if (e) eg[i] = e.dir; }
  for (const z of zones(C, tf, EG_SPAN)) if (z.fi != null) ef[z.fi] = -z.dir;
  return { eg, ef };
}

// every CF signal of one market (closed candles only): { l, d, T, ci, fillT, origin, x, inVR, eg, ef, stopW, stopA, atr }
export function signals(F, Fn) {
  const out = [];
  for (let l = 0; l < 3; l++) {
    const [h, v] = LADDERS[l], V = F[v], a = atr14(V), fl = flags(V, v);
    const cache = { ['ph' + h]: noStage() };
    for (const s of storylines(F, Fn, h, v, v, cache)) {
      const i = s.cfIdx, at = a[i]; if (!(at > 0)) continue;
      out.push({ l, d: s.d, T: s.T, ci: i, origin: s.origin, x: s.x, inVR: s.inVR ? 1 : 0, eg: fl.eg[i] === s.d ? 1 : 0, ef: fl.ef[i] === s.d ? 1 : 0,
        stopW: s.origin - s.d * ATR_K * at, stopA: (s.d > 0 ? V[i].h : V[i].l) + s.d * ATR_K * at, atr: at });
    }
  }
  return out;
}

// one trade: side, market at the open of the first 5m candle starting at or after T
function sim(M5, side, T, stop, ext, cap) {
  const j = lb(M5, T); if (j >= M5.length) return null;
  const fill = M5[j].o, r = manage(M5, j, -1, fill, side, stop, Number.isFinite(ext) ? ext : fill - side, cap);
  if (!r || r.instant) return r;
  const xR = Number.isFinite(ext) ? side * (ext - fill) / r.risk : -1;
  return { fill, fillT: r.fillT, exitT: r.exitT, risk: r.risk, R: [r.R[0], r.R[1], xR >= 1 ? r.R[3] : NaN] };
}
const rnd = (x) => (Number.isFinite(x) ? +x.toFixed(5) : null);

// ---- one market -------------------------------------------------------------------------------------------------------
export function runMarket(market, { from = LOAD_FROM, to = END, Fn = loadFns(), seed = 20261123 } = {}) {
  const M5 = K.load(market, '5m', { from, to }); const F = frames(M5); const cost = COSTS[market];
  const bad = exclusions(market); const badHit = (a, b) => bad.some(([x, y]) => x <= b && y >= a);
  const S = signals(F, Fn);
  // pools of the secondary control: candles of each lower timeframe carrying EG / EF of side d, not a CF of that ladder
  const pools = [];
  for (let l = 0; l < 3; l++) { const v = LADDERS[l][1], V = F[v], fl = flags(V, v), a = atr14(V);
    const cfs = new Set(S.filter((s) => s.l === l).map((s) => s.ci)), P = new Map();
    for (let i = 15; i < V.length; i++) { if (cfs.has(i) || !(a[i] > 0)) continue; const T = V[i].e; if (T < D0 || T >= END) continue;
      for (const [k, side] of [['EG', fl.eg[i]], ['EF', fl.ef[i]]]) if (side) { const key = k + '|' + monthOf(T) + '|' + side; (P.get(key) || P.set(key, []).get(key)).push(i); } }
    pools.push({ V, a, P }); }
  const rng = K.rng(seed + MARKETS.indexOf(market));
  const trades = []; let gate = 0, nbad = 0, open = 0;
  for (const s of S) {
    if (s.T < D0 || s.T >= END) continue;
    const cap = LADDERS[s.l][2];
    for (const set of [0, 1]) {
      const side = set ? -s.d : s.d, stop = set ? s.stopA : s.stopW, ext = set ? NaN : s.x;
      const r = sim(M5, side, s.T, stop, ext, cap);
      if (!r) { open++; continue; } if (r.instant || !(r.risk > 0)) { gate++; continue; }
      if (badHit(r.fillT, r.exitT)) { nbad++; continue; }
      const pl = sim(M5, -side, s.T, 2 * r.fill - stop, set ? NaN : 2 * r.fill - ext, cap);
      // secondary controls (one draw per flag the trade carries)
      const C2 = {};
      for (const [k, on] of [['EG', s.eg], ['EF', s.ef]]) { if (!on) continue;
        const pool = pools[s.l].P.get(k + '|' + monthOf(s.T) + '|' + s.d); if (!pool || !pool.length) continue;
        const ci = pool[Math.floor(rng() * pool.length)], Vc = pools[s.l].V, Tc = Vc[ci].e, jc = lb(M5, Tc); if (jc >= M5.length) continue;
        const fc = M5[jc].o, riskC = (r.risk / s.atr) * pools[s.l].a[ci], xR = set ? NaN : side * (ext - r.fill) / r.risk;
        const rc = sim(M5, side, Tc, fc - side * riskC, Number.isFinite(xR) && xR >= 1 ? fc + side * xR * riskC : NaN, cap);
        if (rc && !rc.instant && rc.risk > 0 && !badHit(rc.fillT, rc.exitT)) C2[k] = rc.R.map(rnd); }
      trades.push({ l: s.l, set, eg: s.eg, ef: s.ef, p: s.inVR, T: s.T, m: monthOf(s.T), risk: +r.risk.toPrecision(6), cr: +(cost / r.risk).toFixed(5),
        R: r.R.map(rnd), P: pl && !pl.instant ? pl.R.map(rnd) : null, C2 });
    }
  }
  return { market, signals: S.length, flagged: { eg: S.filter((s) => s.eg).length, ef: S.filter((s) => s.ef).length, both: S.filter((s) => s.eg && s.ef).length },
    trades, gate, nbad, open };
}
export function save(dir, out) { fs.mkdirSync(dir, { recursive: true }); fs.writeFileSync(path.join(dir, out.market + '.json.gz'), zlib.gzipSync(JSON.stringify(out))); }
const loadOne = (dir, m) => JSON.parse(zlib.gunzipSync(fs.readFileSync(path.join(dir, m + '.json.gz'))).toString());

// ---- statistics -------------------------------------------------------------------------------------------------------
const r4 = (x) => (x == null || !Number.isFinite(x) ? null : +x.toFixed(4));
const r2 = (x) => (x == null || !Number.isFinite(x) ? null : +x.toFixed(2));
const sigOf = (t, s) => (s === 0 ? t.eg : t.ef);
const inCell = (t, c) => t.l === c.l && t.set === c.set && (c.p < 0 || t.p === c.p);
// rows: { m, r, n (after costs), market }; kind = 'real' | 'placebo' | 'plain' | 'c2'
export function cellRows(all, c, kind = 'real') {
  const out = [];
  for (const t of all) { if (!inCell(t, c)) continue;
    const on = sigOf(t, c.s);
    let R = null;
    if (kind === 'real' && on) R = t.R[c.x]; else if (kind === 'placebo' && on) R = t.P ? t.P[c.x] : null;
    else if (kind === 'plain' && !on) R = t.R[c.x]; else if (kind === 'c2' && on) { const z = t.C2 && t.C2[SIGS[c.s]]; R = z ? z[c.x] : null; }
    if (R == null) continue; out.push({ m: t.m, r: R, n: R - t.cr, market: t.market }); }
  return out;
}
export function windowStats(rows, a, b) {
  const w = rows.filter((x) => x.m >= a && x.m < b), n = w.length;
  return { n, meanR: n ? r4(w.reduce((p, x) => p + x.r, 0) / n) : null, tMonth: r2(monthT(rows, 'r', a, b)),
    netR: n ? r4(w.reduce((p, x) => p + x.n, 0) / n) : null, tMonthNet: r2(monthT(rows, 'n', a, b)) };
}
const sub = (rows, a, b) => rows.filter((x) => x.m >= a && x.m < b).map((x) => x.r);
const meanOf = (x) => (x.length ? x.reduce((p, q) => p + q, 0) / x.length : null);
const ctl = (rows, cr) => ({ disc: { n: sub(cr, 0, SPLIT_M).length, meanR: r4(meanOf(sub(cr, 0, SPLIT_M))), welchT: r2(welch(sub(rows, 0, SPLIT_M), sub(cr, 0, SPLIT_M))) },
  conf: { n: sub(cr, SPLIT_M, NM).length, meanR: r4(meanOf(sub(cr, SPLIT_M, NM))), welchT: r2(welch(sub(rows, SPLIT_M, NM), sub(cr, SPLIT_M, NM))) } });
export function evaluate(all) {
  const one = (kind) => {
    const res = CELLS.map((c) => {
      const rows = cellRows(all, c, kind), disc = windowStats(rows, 0, SPLIT_M), conf = windowStats(rows, SPLIT_M, NM);
      conf.p = r4(K.pFromT(conf.tMonth, NM - SPLIT_M - 1) ?? 1);
      // the plain-CF control: for the placebo, the plain CFs traded the other way too
      const plain = kind === 'real' ? cellRows(all, c, 'plain') : all.filter((t) => inCell(t, c) && !sigOf(t, c.s) && t.P && t.P[c.x] != null).map((t) => ({ m: t.m, r: t.P[c.x] }));
      const out = { cell: c.name, set: c.set, l: c.l, s: c.s, p: c.p, x: c.x, disc, conf, plain: ctl(rows, plain), rows };
      if (kind === 'real') out.noStory = ctl(rows, cellRows(all, c, 'c2'));
      return out;
    });
    const adj = K.holm(res.map((r) => r.conf.p));
    res.forEach((r, i) => { r.conf.holm = +adj[i].toPrecision(3);
      r.bar = { n: r.disc.n >= 300 && r.conf.n >= 300, disc: r.disc.meanR > 0 && r.disc.tMonth >= 2, conf: r.conf.meanR > 0 && r.conf.tMonth >= 2,
        holm: r.conf.holm <= 0.05, control: !!(r.plain.disc.welchT >= 2 && r.plain.conf.welchT >= 2) };
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
  const sizeable = E.real.filter((r) => r.bar.n).length;
  const verdict = sizeable < 10 ? 'INCONCLUSIVE' : passes.length && plPass.length < passes.length ? 'PASS' : 'FAIL';
  const perMarket = passes.map((r) => ({ cell: r.cell, markets: MARKETS.map((m) => { const rows = r.rows.filter((x) => x.market === m);
    return { market: m, disc: windowStats(rows, 0, SPLIT_M), conf: windowStats(rows, SPLIT_M, NM) }; }) }));
  const cut = fs.readdirSync(dir).filter((f) => /^cut-.*\.json$/.test(f)).map((f) => JSON.parse(fs.readFileSync(path.join(dir, f), 'utf8')));
  const cutTest = { markets: cut, compared: cut.reduce((x, c) => x + c.compared, 0), mismatches: cut.reduce((x, c) => x + c.mismatches, 0) };
  // the plain CF itself (every CF, with the BO, 2R) per ladder, for the report
  const baseline = LADDERS.map((_, l) => { const rows = all.filter((t) => t.l === l && t.set === 0 && t.R[1] != null).map((t) => ({ m: t.m, r: t.R[1], n: t.R[1] - t.cr }));
    return { ladder: LNAME[l], with2R: { disc: windowStats(rows, 0, SPLIT_M), conf: windowStats(rows, SPLIT_M, NM) } }; });
  return { verdict, passes: passes.length, placeboPasses: plPass.length, sizeable, cutTest,
    markets: per.map((p) => ({ market: p.market, signals: p.signals, flagged: p.flagged, trades: p.trades.length, droppedBadData: p.nbad, gateFail: p.gate, unfinished: p.open })),
    baseline, cells: E.real.map(strip), placebo: E.placebo.map(strip), perMarket };
}

// ---- cut test ---------------------------------------------------------------------------------------------------------
export function cutFrames(M5, cut) { const F = frames(M5.filter((b) => b.e <= cut)); for (const k of Object.keys(F)) F[k] = F[k].filter((b) => b.e <= cut); return F; }
export const sigKey = (s) => [s.l, s.d, s.T, s.ci, s.origin, s.x, s.inVR, s.eg, s.ef, s.stopW, s.stopA].join('|');
export function cutCheck(M5, Fn, cuts) {
  const whole = signals(frames(M5), Fn); let compared = 0, bad = 0;
  for (const cut of cuts) { const a = whole.filter((s) => s.T <= cut).map(sigKey).sort(), b = signals(cutFrames(M5, cut), Fn).filter((s) => s.T <= cut).map(sigKey).sort();
    compared += a.length; if (a.join('\n') !== b.join('\n')) bad++; }
  return { cuts: cuts.length, compared, mismatches: bad };
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const [cmd, a, b] = process.argv.slice(2);
  if (cmd === 'market') { const t0 = Date.now(); const out = runMarket(a); save(b, out);
    console.log(a, out.signals, 'signals', JSON.stringify(out.flagged), out.trades.length, 'trades', out.nbad, 'dropped', out.gate, 'gate', out.open, 'open', ((Date.now() - t0) / 1000).toFixed(0) + 's'); }
  else if (cmd === 'report') { const R = report(a); fs.writeFileSync(path.join(a, 'report.json'), JSON.stringify(R, null, 1));
    const best = R.cells.filter((c) => c.disc.n >= 300 && c.conf.n >= 300).sort((p, q) => q.conf.tMonth - p.conf.tMonth)[0];
    const sg = (x) => (x >= 0 ? '+' : '') + x.toFixed(3);
    const headline = best ? `${R.passes} of ${CELLS.length} cells passed (placebo ${R.placeboPasses}); the best confirmation cell, ${best.cell}, made ${sg(best.conf.meanR)}R a trade before costs in 2015-26 (n ${best.conf.n}, month t ${best.conf.tMonth.toFixed(2)}) after ${sg(best.disc.meanR)}R in 2005-14 (n ${best.disc.n}, t ${best.disc.tMonth.toFixed(2)}).`
      : `${R.passes} of ${CELLS.length} cells passed; ${R.sizeable} cells reached n >= 300 in both windows.`;
    const out = { study: 'grid7-cf-engulf', built: '2026-11-23', verdict: R.verdict, headline, best: best ? best.cell : null, assumedCost: ASSUMED_COST,
      windows: { discovery: '2005-01 to 2014-12', confirmation: '2015-01 to 2026-10' }, ...R };
    fs.writeFileSync(path.join(HERE, 'result.json'), JSON.stringify(out, null, 1) + '\n'); console.log(R.verdict, headline); }
  else if (cmd === 'cut') { const M5 = K.load(a, '5m', { from: '2011-01-01', to: '2013-01-01' }); const r = K.rng(20261123), cuts = [];
    for (let i = 0; i < +(b || 10); i++) cuts.push(Math.floor(M5[20000].t + r() * (M5[M5.length - 1].t - M5[20000].t)));
    const res = { market: a, ...cutCheck(M5, loadFns(), cuts) }; console.log(JSON.stringify(res));
    if (process.argv[5]) fs.writeFileSync(path.join(process.argv[5], 'cut-' + a + '.json'), JSON.stringify(res)); }
  else console.log('usage: run.mjs market <m> <dir> | report <dir> | cut <m> [n] [outDir]');
}
