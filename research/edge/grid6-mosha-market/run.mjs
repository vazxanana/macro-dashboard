// research/edge/grid6-mosha-market/run.mjs - grid 6 of PREREGISTRATION.md (23 Nov 2026): the Mosha storyline BO -> VR -> CF
// with market and trade-through entries only, on D1>H4, H4>H1, H1>M15, M30>M5, with the break type, the CF's place, the
// entry, the stop, the exit, the session and the Daily MSNR call.
// node research/edge/grid6-mosha-market/run.mjs market <market> <outDir>   one market: storylines, trades, cell month sums
// node research/edge/grid6-mosha-market/run.mjs report <outDir>            the pre-registered bar, report.json
// node research/edge/grid6-mosha-market/run.mjs cut <market> [n]           the cut test
// Research only: imports edgekit, combo-grid-2 (COSTS, exclusions), grid5-mosha-cycle (eventsOf, atr14, manage, mstat),
// council/eg-methods direction(); structure from edgekit structure() / qms() (see the amendment; nothing is edited).
import fs from 'node:fs';
import path from 'node:path';
import zlib from 'node:zlib';
import { fileURLToPath } from 'node:url';
import * as K from '../_lib/edgekit.mjs';
import { COSTS, exclusions } from '../combo-grid-2/run.mjs';
import { atr14, manage, mstat } from '../grid5-mosha-cycle/run.mjs';
import { direction } from '../../../council/eg-methods.mjs';

export const MARKETS = ['xau', 'eurusd', 'gbpusd', 'usdjpy', 'audusd'];
export const LADDERS = [['1d', '4h'], ['4h', '1h'], ['1h', '15m'], ['30m', '5m']];
export const SEC = { '5m': 300, '15m': 900, '30m': 1800, '1h': 3600, '4h': 14400, '1d': 86400 };
export const CAP = { '1d': 10 * 86400, '4h': 5 * 86400, '1h': 2 * 86400, '30m': 86400 };
export const N = 3, ATR_K = 0.1, EG_WAIT = 48, LIM_LIFE = 24;
export const BRK = ['any', 'qm'];
export const PLACE = ['any', 'back', 'inside', 'outside'];
export const ENTRY = ['MKT', 'EG', 'LIM'];
export const STOP = ['vr', 'cfz'];
export const EXITS = ['1R', '2R', '3R', 'VR', 'trail'];
export const SESS = ['any', 'london', 'newyork', 'other'];
export const MSNR = ['any', 'with', 'against'];
export const DIMS = [LADDERS.length, BRK.length, PLACE.length, ENTRY.length, STOP.length, EXITS.length, SESS.length, MSNR.length];
export const NCELL = DIMS.reduce((a, b) => a * b, 1); // 11,520
export const cellIndex = (v) => v.reduce((a, x, i) => a * DIMS[i] + x, 0);
export function cellName(c) {
  const v = []; for (let i = DIMS.length - 1; i >= 0; i--) { v[i] = c % DIMS[i]; c = Math.floor(c / DIMS[i]); }
  return { ladder: LADDERS[v[0]].join('>'), brk: BRK[v[1]], place: PLACE[v[2]], entry: ENTRY[v[3]], stop: STOP[v[4]], exit: EXITS[v[5]], session: SESS[v[6]], msnr: MSNR[v[7]] };
}
export const Y0 = 2010, NM = 120, SPLIT_M = 60;
export const monthOf = (t) => { const d = new Date(t * 1000); return (d.getUTCFullYear() - Y0) * 12 + d.getUTCMonth(); };
// session of a fill time (UTC hour): 1 London 07-11, 2 New York 12-16, 3 other
export const sessionOf = (t) => { const h = new Date(t * 1000).getUTCHours(); return h >= 7 && h < 12 ? 1 : h >= 12 && h < 17 ? 2 : 3; };

export function frames(M5) {
  return { '5m': M5, '15m': K.resample(M5, 900), '30m': K.resample(M5, 1800), '1h': K.resample(M5, 3600), '4h': K.resample(M5, 14400), '1d': K.dailyNY(M5) };
}
const conv = (B) => B.map((b) => ({ time: b.t, open: b.o, high: b.h, low: b.l, close: b.c }));
const lb = (B, t) => { let lo = 0, hi = B.length; while (lo < hi) { const m = (lo + hi) >> 1; if (B[m].t < t) lo = m + 1; else hi = m; } return lo; };
const lbK = (E, k) => { let lo = 0, hi = E.length; while (lo < hi) { const m = (lo + hi) >> 1; if (E[m].k <= k) lo = m + 1; else hi = m; } return lo; };

// the Daily MSNR call (H4 working candles, D1 key levels) of each closed H4 candle
export function msnrCalls(F) {
  const D = F['1d'], H = F['4h'];
  const keyOf = (t) => { const k = K.barAt(D, t); return k < 0 ? t : D[k].t; };
  return direction(conv(H), keyOf, 86400).call;
}
// the call in force at T: the last H4 candle closed by T
export function callAt(F, calls, T) { const n = K.closedCount(F['4h'], T); return n > 0 ? calls[n - 1] : 0; }

// break events { dir, level, breakIdx, k (close of the breaking candle) }: 'any' = edgekit structure(), 'qm' = edgekit qms()
export function breaks(B, kind) {
  if (kind === 'qm') return K.qms(B, N).map((q) => ({ dir: q.side, level: q.level, breakIdx: q.i, k: B[q.i].e })).sort((a, b) => a.k - b.k);
  return K.structure(B, N).events.map((e) => ({ dir: e.dir, level: e.level, breakIdx: e.i, k: B[e.i].e }));
}
// ---- storylines of one ladder and break type --------------------------------------------------------------------------
// { d, T, h, v, brk, cfIdx, cfLevel, o (CF zone far side), vx (VR leg extreme), x, L, back, inside, call }
export function storylines(F, h, v, brk, calls, cache = {}) {
  const H = F[h], V = F[v];
  const AH = cache['any' + h] ||= breaks(H, 'any');
  const AV = cache[brk + v] ||= breaks(V, brk);
  const ok = () => true;
  const out = [];
  for (let q = 0; q < AH.length; q++) {
    const e = AH[q], d = e.dir, L = e.level, kH = e.k, endK = q + 1 < AH.length ? AH[q + 1].k : Infinity, boStart = H[e.breakIdx].t;
    let vr = null; for (let p = lbK(AV, kH); p < AV.length && AV[p].k < endK; p++) if (AV[p].dir === -d && ok(AV[p])) { vr = AV[p]; break; }
    if (!vr) continue;
    let x = d > 0 ? -Infinity : Infinity, xi = -1;
    for (let j = lb(V, boStart); j <= vr.breakIdx && j < V.length; j++) { const p = d > 0 ? V[j].h : V[j].l; if (d > 0 ? p > x : p < x) { x = p; xi = j; } }
    if (xi < 0) continue;
    let vx = d > 0 ? Infinity : -Infinity;
    for (let j = xi; j <= vr.breakIdx; j++) { const p = d > 0 ? V[j].l : V[j].h; if (d > 0 ? p < vx : p > vx) vx = p; }
    let cf = null;
    for (let p = lbK(AV, vr.k); p < AV.length && AV[p].k < endK; p++) { const a = AV[p]; if (a.dir !== d) continue;
      if (d > 0 ? a.level >= x : a.level <= x) break;
      if (ok(a)) { cf = a; break; } }
    if (!cf) continue;
    let hit = false; for (let j = vr.breakIdx + 1; j <= cf.breakIdx; j++) if (d > 0 ? V[j].h >= x : V[j].l <= x) { hit = true; break; }
    if (hit) continue;
    let o = d > 0 ? Infinity : -Infinity;
    for (let j = xi; j <= cf.breakIdx; j++) { const p = d > 0 ? V[j].l : V[j].h; if (d > 0 ? p < o : p > o) o = p; }
    if (!(d * (cf.level - o) > 0)) continue;
    const T = cf.k;
    let back = false; for (let j = vr.breakIdx; j <= cf.breakIdx; j++) if (d > 0 ? V[j].l <= L : V[j].h >= L) { back = true; break; }
    const boxLo = Math.min(x, vx), boxHi = Math.max(x, vx), zLo = Math.min(o, cf.level), zHi = Math.max(o, cf.level);
    const inside = zHi >= boxLo && zLo <= boxHi;
    const c = callAt(F, calls, T); const call = c === d ? 1 : c === -d ? 2 : 0;
    out.push({ d, T, h, v, brk, cfIdx: cf.breakIdx, cfLevel: cf.level, o, vx, x, L, back, inside, call });
  }
  return out;
}

// ---- entries: [{ es, st, type 'mkt'|'lim', j (first managed 5m candle), fill, stop } | lim: { t0, entry, stop, cancelT }] ----
export function entries(s, F, atrV, M5, cost) {
  const V = F[s.v], d = s.d, i = s.cfIdx, out = [];
  const stopsAt = (a) => [s.vx - d * ATR_K * a, s.o - d * ATR_K * a];
  const mkt = (es, e, a) => { const j = lb(M5, e); if (j >= M5.length) return; const fill = M5[j].o;
    stopsAt(a).forEach((stop, st) => { if (d * (fill - stop) > 0) out.push({ es, st, type: 'mkt', j, fill, stop }); else out.push({ es, st, gate: true }); }); };
  const a = atrV[i]; if (!(a > 0)) return out;
  // MKT: the next 5m open after the CF close
  mkt(0, V[i].e, a);
  // EG after a pullback into the CF zone, market at the next 5m open
  { let k0 = -1, base = null;
    for (let j = i + 1; j < V.length && j <= i + EG_WAIT; j++) { const b = V[j];
      if (d > 0 ? b.c < s.o : b.c > s.o) break;
      if (d > 0 ? b.h >= s.x : b.l <= s.x) break;
      if (k0 < 0) { if (d > 0 ? b.l <= s.cfLevel : b.h >= s.cfLevel) k0 = j; else continue; }
      if (base && (d > 0 ? b.c > base.h : b.c < base.l)) { mkt(1, b.e, atrV[j] > 0 ? atrV[j] : a); break; }
      if (d > 0 ? b.c < b.o : b.c > b.o) base = b; } }
  // LIM at the CF line, filled only when traded through by half the round trip
  { let cancelT = V[i].e + LIM_LIFE * SEC[s.v];
    for (let j = i + 1; j < V.length && j <= i + LIM_LIFE; j++) if (d > 0 ? V[j].c < s.o : V[j].c > s.o) { cancelT = Math.min(cancelT, V[j].e); break; }
    stopsAt(a).forEach((stop, st) => { if (d * (s.cfLevel - stop) > 0) out.push({ es: 2, st, type: 'lim', t0: V[i].e, entry: s.cfLevel, stop, cancelT, through: cost / 2 }); else out.push({ es: 2, st, gate: true }); }); }
  return out;
}

// one trade on 5m candles -> null | { instant } | { fillT, exitT, risk, fill, R[5] }
export function simulate(M5, o, d, x, cap) {
  if (o.type === 'mkt') return manage(M5, o.j, -1, o.fill, d, o.stop, x, cap);
  for (let j = lb(M5, o.t0); j < M5.length; j++) { const b = M5[j]; if (b.t >= o.cancelT) return null;
    const lvl = o.entry - d * o.through;
    if (d > 0 ? b.l <= lvl : b.h >= lvl) return manage(M5, j, j, d > 0 ? Math.min(b.o, o.entry) : Math.max(b.o, o.entry), d, o.stop, x, cap);
    if (d > 0 ? b.h >= x : b.l <= x) return null; }
  return null;
}
export function placebo(M5, o, s, r) {
  const j = lb(M5, r.fillT), p = manage(M5, j, o.type === 'mkt' ? -1 : j, r.fill, -s.d, 2 * r.fill - o.stop, 2 * r.fill - s.x, CAP[s.h]);
  return p && !p.instant ? p : null;
}

// ---- one market -----------------------------------------------------------------------------------------------------
export function runMarket(market, { from = '2009-01-01', to = '2020-01-01' } = {}) {
  const M5 = K.load(market, '5m', { from, to }); const F = frames(M5); const cost = COSTS[market];
  const bad = exclusions(market), badHit = (a, b) => bad.some(([p, q]) => p <= b && q >= a);
  const calls = msnrCalls(F), cache = {}, atr = {};
  const acc = { real: newAcc(), plac: newAcc() };
  const cnt = { storylines: 0, trades: 0, dropped: 0, gate: 0, instant: 0, byLadder: {} };
  for (let li = 0; li < LADDERS.length; li++) { const [h, v] = LADDERS[li]; atr[v] ||= atr14(F[v]);
    for (let bi = 0; bi < BRK.length; bi++) {
      const S = storylines(F, h, v, BRK[bi], calls, cache); cnt.storylines += S.length; cnt.byLadder[h + '>' + v + ':' + BRK[bi]] = S.length;
      for (const s of S) for (const o of entries(s, F, atr[v], M5, cost)) {
        if (o.gate) { cnt.gate++; continue; }
        const r = simulate(M5, o, s.d, s.x, CAP[h]); if (!r) continue;
        if (r.instant || !(r.risk > 0) || !(s.d * (r.fill - o.stop) > 0)) { cnt.instant++; continue; }
        const m = monthOf(r.fillT); if (m < 0 || m >= NM) continue;
        if (badHit(r.fillT, r.exitT)) { cnt.dropped++; continue; }
        cnt.trades++;
        const base = [li, bi, s.back, s.inside, o.es, o.st, sessionOf(r.fillT), s.call];
        add(acc.real, base, m, r.R, cost / r.risk);
        const pl = placebo(M5, o, s, r); if (pl) add(acc.plac, base, m, pl.R, cost / pl.risk);
      } } }
  return { market, ...cnt, acc };
}
function newAcc() { return { n: new Uint32Array(NCELL * 2), g: new Float64Array(NCELL * NM), net: new Float64Array(NCELL * NM) }; }
export function add(A, base, m, R, cr) {
  const [li, bi, back, inside, es, st, se, ms] = base;
  const pl = [0, inside ? 2 : 3]; if (back) pl.push(1);
  const sl = [0, se], ml = ms ? [0, ms] : [0];
  for (const p of pl) for (const a of sl) for (const b of ml) for (let x = 0; x < 5; x++) {
    const R0 = R[x]; if (!Number.isFinite(R0)) continue;
    const c = cellIndex([li, bi, p, es, st, x, a, b]);
    A.n[c * 2 + (m < SPLIT_M ? 0 : 1)]++; A.g[c * NM + m] += R0; A.net[c * NM + m] += R0 - cr;
  }
}
const CNT = ['storylines', 'trades', 'dropped', 'gate', 'instant', 'byLadder'];
export function save(dir, out) {
  fs.mkdirSync(dir, { recursive: true });
  const enc = (a) => Buffer.from(a.buffer).toString('base64');
  const one = (A) => ({ n: enc(A.n), g: enc(A.g), net: enc(A.net) });
  const body = { market: out.market, ...Object.fromEntries(CNT.map((k) => [k, out[k]])), real: one(out.acc.real), plac: one(out.acc.plac) };
  fs.writeFileSync(path.join(dir, out.market + '.json.gz'), zlib.gzipSync(JSON.stringify(body)));
}
function loadOne(dir, m) {
  const j = JSON.parse(zlib.gunzipSync(fs.readFileSync(path.join(dir, m + '.json.gz'))).toString());
  const dec = (s, T) => { const b = Buffer.from(s, 'base64'); return new T(b.buffer, b.byteOffset, b.byteLength / T.BYTES_PER_ELEMENT); };
  const one = (x) => ({ n: dec(x.n, Uint32Array), g: dec(x.g, Float64Array), net: dec(x.net, Float64Array) });
  return { ...j, real: one(j.real), plac: one(j.plac) };
}

// ---- the bar -------------------------------------------------------------------------------------------------------
function discovery(A) {
  const rows = [];
  for (let c = 0; c < NCELL; c++) { const n1 = A.n[c * 2], n2 = A.n[c * 2 + 1]; if (n1 < 100) continue;
    const k = mstat(A.g, c * NM, 0, SPLIT_M); rows.push({ c, n1, mean1: k.sum / n1, t1: k.t, n2 }); }
  const disc = rows.filter((r) => r.mean1 > 0 && r.t1 >= 2);
  for (const r of disc) { const k = mstat(A.g, r.c * NM, SPLIT_M, NM); r.mean2 = r.n2 ? k.sum / r.n2 : null; r.t2 = k.t; r.p2 = K.pFromT(k.t, SPLIT_M - 1) ?? 1;
    const kn = mstat(A.net, r.c * NM, SPLIT_M, NM), kn1 = mstat(A.net, r.c * NM, 0, SPLIT_M); r.net1 = kn1.sum / r.n1; r.net2 = r.n2 ? kn.sum / r.n2 : null; r.tNet2 = kn.t; }
  return { eligible: rows.length, disc };
}
export const passes = (r) => r.n2 >= 100 && r.mean2 > 0 && r.t2 >= 2 && r.holm <= 0.05;
export function report(dir) {
  const per = MARKETS.map((m) => loadOne(dir, m));
  const pool = (kind) => { const A = newAcc(); for (const p of per) for (const k of ['n', 'g', 'net']) { const s = p[kind][k]; for (let i = 0; i < s.length; i++) A[k][i] += s[i]; } return A; };
  const scopes = [...MARKETS.map((m, i) => ({ scope: m, real: per[i].real, plac: per[i].plac })), { scope: 'pooled', real: pool('real'), plac: pool('plac') }];
  const fam = (kind) => { const all = []; const by = scopes.map((s) => { const g = discovery(s[kind]); g.disc.forEach((r) => { r.scope = s.scope; all.push(r); }); return { label: s.scope, ...g }; });
    const adj = K.holm(all.map((r) => r.p2)); all.forEach((r, i) => { r.holm = adj[i]; r.pass = passes(r); });
    return { by, all }; };
  const R = fam('real'), P = fam('plac');
  const f4 = (x) => (x == null || !Number.isFinite(x) ? null : +x.toFixed(4));
  const fmt = (r) => ({ scope: r.scope, ...cellName(r.c), discovery: { n: r.n1, meanR: f4(r.mean1), tMonth: +r.t1.toFixed(2), netR: f4(r.net1) },
    confirmation: { n: r.n2, meanR: f4(r.mean2), tMonth: +r.t2.toFixed(2), netR: f4(r.net2), tNet: +r.tNet2.toFixed(2), holm: +r.holm.toPrecision(3) }, pass: r.pass });
  const sum = (G) => { const el = G.by.reduce((a, b) => a + b.eligible, 0);
    return { eligible: el, discovery: G.all.length, expectedByChance: +(el * 0.023).toFixed(1), confirmed: G.all.filter((r) => r.pass).length,
      confirmedRaw: G.all.filter((r) => r.n2 >= 100 && r.mean2 > 0 && r.t2 >= 2).length,
      byScope: Object.fromEntries(G.by.map((g) => [g.label, { eligible: g.eligible, discovery: g.disc.length, confirmed: g.disc.filter((r) => r.pass).length }])) }; };
  const real = sum(R), plac = sum(P);
  const top = [...R.all].sort((a, b) => b.t2 - a.t2).slice(0, 25).map(fmt);
  // the plain storyline (place, session, msnr = any), pooled
  const A = scopes[scopes.length - 1], base = [];
  for (let li = 0; li < LADDERS.length; li++) for (let bi = 0; bi < 2; bi++) for (let es = 0; es < 3; es++) for (let st = 0; st < 2; st++) for (const x of [1, 4]) {
    const c = cellIndex([li, bi, 0, es, st, x, 0, 0]);
    const row = { ladder: LADDERS[li].join('>'), brk: BRK[bi], entry: ENTRY[es], stop: STOP[st], exit: EXITS[x] };
    for (const [k, G] of [['real', A.real], ['placebo', A.plac]]) for (const [p2, a, b] of [['disc', 0, SPLIT_M], ['conf', SPLIT_M, NM]]) {
      const n = G.n[c * 2 + (a ? 1 : 0)], m = mstat(G.g, c * NM, a, b), mn = mstat(G.net, c * NM, a, b);
      row[k + '_' + p2] = { n, meanR: n ? f4(m.sum / n) : null, tMonth: +m.t.toFixed(2), netR: n ? f4(mn.sum / n) : null }; }
    base.push(row); }
  // each factor level alone (every other factor any), pooled, MKT / cfz / 2R as the reference row, for the reader
  const verdict = real.eligible < 20 ? 'INCONCLUSIVE' : real.confirmed > 0 && plac.confirmed < real.confirmed ? 'PASS' : 'FAIL';
  return { verdict, per: per.map((p) => ({ market: p.market, storylines: p.storylines, trades: p.trades, droppedBadData: p.dropped, notBuiltStopWrongSide: p.gate, instantAtOpenPastStop: p.instant, byLadder: p.byLadder })),
    real, placebo: plac, confirmed: R.all.filter((r) => r.pass).map(fmt), topConfirmation: top, baseline: base };
}

// ---- cut test ------------------------------------------------------------------------------------------------------
export function cutFrames(M5, cut) { const F = frames(M5.filter((b) => b.e <= cut)); for (const k of Object.keys(F)) F[k] = F[k].filter((b) => b.e <= cut); return F; }
export const sigKey = (s) => [s.h, s.v, s.brk, s.d, s.T, s.cfLevel, s.o, s.vx, s.x, s.back, s.inside, s.call].join('|');
export function cutCheck(M5, cuts) {
  const Fw = frames(M5), cw = {}, callsW = msnrCalls(Fw); let compared = 0, bad = 0;
  const whole = {}; for (const [h, v] of LADDERS) for (const b of BRK) whole[h + v + b] = storylines(Fw, h, v, b, callsW, cw);
  for (const cut of cuts) { const Fc = cutFrames(M5, cut), cc = {}, callsC = msnrCalls(Fc);
    for (const [h, v] of LADDERS) for (const b of BRK) {
      const a = whole[h + v + b].filter((s) => s.T <= cut).map(sigKey), c = storylines(Fc, h, v, b, callsC, cc).filter((s) => s.T <= cut).map(sigKey);
      compared += a.length; if (a.join('\n') !== c.join('\n')) bad++; } }
  return { cuts: cuts.length, compared, mismatches: bad };
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const [cmd, a, b] = process.argv.slice(2);
  if (cmd === 'market') { const t0 = Date.now(); const out = runMarket(a); save(b, out); console.log(a, out.storylines, 'storylines', out.trades, 'trades', out.dropped, 'dropped', out.gate, 'gate', ((Date.now() - t0) / 1000).toFixed(0) + 's'); }
  else if (cmd === 'report') { const R = report(a); fs.writeFileSync(path.join(a, 'report.json'), JSON.stringify(R, null, 1)); console.log(JSON.stringify({ verdict: R.verdict, real: R.real, placebo: R.placebo, top: R.topConfirmation.slice(0, 5) }, null, 1)); }
  else if (cmd === 'cut') { const M5 = K.load(a, '5m', { from: '2011-01-01', to: '2013-01-01' }); const r = K.rng(20261123), cuts = []; for (let i = 0; i < +(b || 30); i++) cuts.push(Math.floor(M5[20000].t + r() * (M5[M5.length - 1].t - M5[20000].t))); console.log(JSON.stringify({ market: a, ...cutCheck(M5, cuts) })); }
  else console.log('usage: run.mjs market <m> <dir> | report <dir> | cut <m> [n]');
}
