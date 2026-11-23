// research/edge/dom-sd-choch-wide/run.mjs - zones (dom, fresh supply / demand, engulf, failed engulf) on 4h / 1d, first touch,
// confirmed by a change of character two timeframes lower; 48 cells on ten markets, discovery 2005-14, confirmation 2015 to
// Oct 2026, judged before costs on month sums against two controls (PREREGISTRATION.md). Research only: nothing live imports it.
//   EDGE_DATA=<cache> node research/edge/dom-sd-choch-wide/run.mjs market <m> <outDir>
//   EDGE_DATA=<cache> node research/edge/dom-sd-choch-wide/run.mjs cut <m> <outDir>
//   node research/edge/dom-sd-choch-wide/run.mjs report <outDir>
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import * as K from '../_lib/edgekit.mjs';
import { frames, buildZones } from '../combo-grid-3/run.mjs';
import { sdZones } from '../grid5-sd-eg/run.mjs';
import { COSTS, exclusions } from '../combo-grid-2/run.mjs';
import { atr14, startIdx, findFill } from '../dom-trade-through/run.mjs';
import { dailyCalls, mstat, p1, welch, monthOf } from '../grid7-wide-core/run.mjs';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const y = (Y, M = 0) => Date.UTC(Y, M, 1) / 1000;
export const MARKETS = ['xau', 'xag', 'eurusd', 'gbpusd', 'usdjpy', 'audusd', 'nzdusd', 'usdcad', 'usdchf', 'eurjpy'];
export const ASSUMED = ['xag', 'nzdusd', 'usdcad', 'usdchf', 'eurjpy'];
export const FAMS = ['dom', 'sd', 'eg', 'ef'], ZTF = ['4h', '1d'], ENTRIES = ['mkt', 'lim'], EXITS = ['1R', '2R', 'struct'];
export const TBELOW = { '4h': '15m', '1d': '1h' }, TSEC = { '15m': 900, '1h': 3600 }, CAP = { '1d': 2 * 86400, '4h': 86400 };
export const WIN = 24, ATRK = 0.1, KSW = 3, SHIFT = 96;
export const FROM = y(2005), SPLIT = y(2015), TO = y(2026, 10);
export const NM = 262, DM = 120, NCELL = 48;
export const VARS = ['all', 'msnrWith', 'msnrAgainst', 'legUnder', 'legOver'], NV = VARS.length;
export const KINDS = ['real', 'c1', 'c2', 'plac'];
export const cellIndex = (f, z, e, x) => ((f * 2 + z) * 2 + e) * 3 + x;
export function cellName(i) { const x = i % 3; i = (i - x) / 3; const e = i % 2; i = (i - e) / 2; const z = i % 2; const f = (i - z) / 2;
  return { fam: FAMS[f], ztf: ZTF[z], entry: ENTRIES[e], exit: EXITS[x], f, z, e, x }; }

function zonesOf(fam, Z) { return zonesRaw(fam, Z).sort((a, b) => a.at - b.at); }
function zonesRaw(fam, Z) {
  if (fam === 'sd') return sdZones(Z).map((q) => ({ d: q.d, bot: q.lo, top: q.hi, at: q.at, end: q.end, i: q.bi }));
  return buildZones(fam, Z).map((q) => ({ d: q.d, bot: q.bot, top: q.top, at: q.at, end: q.end, i: q.i }));
}
const inZone = (b, z) => b.l <= z.top && b.h >= z.bot;

// The ChoCh search from candle k (buy zone: the first close above the most recent swing high known by the previous close).
// Returns { j, level, ext } or null. zone (optional) aborts on a close through its far side.
export function chochFrom(T, swH, swL, s, k, zone) {
  let ext = s > 0 ? Infinity : -Infinity;
  for (let j = k; j < k + WIN && j < T.length; j++) {
    if (zone && T[j].e >= zone.end) return null;
    ext = s > 0 ? Math.min(ext, T[j].l) : Math.max(ext, T[j].h);
    const lv = (s > 0 ? swH : swL)[j]; // most recent swing high (low) known by the close of j-1
    if (lv != null && s * (T[j].c - lv) > 0) return { j, level: lv, ext };
    if (zone && (s > 0 ? T[j].c < zone.bot : T[j].c > zone.top)) return null;
  }
  return null;
}
// last known swing level at each candle (known by the close of j-1: swing ci <= j-1)
export function swingLevels(T) {
  const sw = K.swings(T, KSW), H = new Array(T.length).fill(null), L = new Array(T.length).fill(null);
  const byCi = new Map(); for (const w of sw) { if (!byCi.has(w.ci)) byCi.set(w.ci, []); byCi.get(w.ci).push(w); }
  let h = null, l = null, hi = -1, li = -1;
  for (let j = 0; j < T.length; j++) {
    H[j] = h; L[j] = l;
    for (const w of byCi.get(j) || []) { if (w.type === 'H' && w.i > hi) { h = w.price; hi = w.i; } if (w.type === 'L' && w.i > li) { l = w.price; li = w.i; } }
  }
  return { H, L };
}

// ---- signals (closed candles only) ----------------------------------------------------------------------------------
// [{ f, z, s, k0, j, tt (ChoCh candle start), ts (its close), level, stop, legAtr, call, zone, touchT, c1: {...}|null, c2: {...} }]
export function signals(F) {
  const out = [], calls = dailyCalls(F), D = F['1d'];
  const callAt = (t) => { const i = K.closedCount(D, t) - 1; return i >= 0 ? calls[i] : 0; };
  ZTF.forEach((zt, z) => {
    const Z = F[zt], T = F[TBELOW[zt]], atr = atr14(T), { H, L } = swingLevels(T);
    FAMS.forEach((fam, f) => {
      const zones = zonesOf(fam, Z);
      for (const zn of zones) {
        let k = startIdx(T, zn.at);
        while (k < T.length && T[k].t < zn.end && !inZone(T[k], zn)) k++;
        if (k >= T.length || T[k].t >= zn.end) continue;
        const s = zn.d, a0 = atr[k];
        // control (ii): the touch itself
        const c2 = a0 > 0 ? { ts: T[k].e, px: T[k].c, stop: (s > 0 ? T[k].l : T[k].h) - s * ATRK * a0 } : null;
        const ch = chochFrom(T, H, L, s, k, zn);
        if (!ch) { if (c2) out.push({ f, z, s, zone: zn, zones, touchT: T[k].t, k0: k, onlyC2: true, c2 }); continue; }
        const a = atr[ch.j]; if (!(a > 0)) { if (c2) out.push({ f, z, s, zone: zn, zones, touchT: T[k].t, k0: k, onlyC2: true, c2 }); continue; }
        const g = { f, z, s, zone: zn, zones, touchT: T[k].t, k0: k, j: ch.j, tt: T[ch.j].t, ts: T[ch.j].e, level: ch.level,
          stop: ch.ext - s * ATRK * a, legAtr: (s * (T[ch.j].c - ch.ext)) / a, call: callAt(T[ch.j].e), c2, c1: null };
        // control (i): the same search 96 candles earlier, no zone
        const k1 = k - SHIFT; let clean = k1 >= 0;
        for (let q = k1; clean && q < k1 + WIN; q++) if (inZone(T[q], zn)) clean = false;
        if (clean) { const c = chochFrom(T, H, L, s, k1, null); const a1 = c ? atr[c.j] : 0;
          if (c && a1 > 0) g.c1 = { ts: T[c.j].e, level: c.level, stop: c.ext - s * ATRK * a1 }; }
        out.push(g);
      }
    });
  });
  return out;
}

// struct target: nearer of the zone's leg-out extreme and the nearest opposite zone of the family standing at tKnown
export function structTarget(Z, zn, zones, s, touchT, tKnown, fill) {
  let best = null; const take = (p) => { if (s * (p - fill) > 0 && (best == null || s * (p - best) < 0)) best = p; };
  const last = K.closedCount(Z, touchT) - 1;
  if (zn.i != null && last >= zn.i) { let x = s > 0 ? -Infinity : Infinity; for (let q = zn.i; q <= last; q++) x = s > 0 ? Math.max(x, Z[q].h) : Math.min(x, Z[q].l); take(x); }
  for (const o of zones) { if (o.at > tKnown) break; if (o.d !== -s || o.end <= tKnown) continue; take(s > 0 ? o.bot : o.top); }
  return best;
}

// ---- exits: 1R, 2R, struct (null target -> NaN). firstFull: the fill candle's favourable side counts (market entry)
export function exits(M5, s, fi, fill, stop, tgs, cap, firstFull) {
  const risk = s * (fill - stop); if (!(risk > 0) || fi >= M5.length) return null;
  const R = tgs.map((g) => (g == null ? NaN : null)); let left = R.filter((r) => r === null).length; if (!left) return R;
  const fin = (k, px) => { if (R[k] === null) { R[k] = (s * (px - fill)) / risk; left--; } };
  const all = (px) => { for (let k = 0; k < R.length; k++) fin(k, px); };
  const dl = M5[fi].t + cap;
  for (let j = fi; j < M5.length && left; j++) { const b = M5[j];
    if (j > fi) { if (s * (b.o - stop) <= 0) { all(b.o); break; } for (let k = 0; k < tgs.length; k++) if (tgs[k] != null && s * (b.o - tgs[k]) >= 0) fin(k, b.o); }
    if (s * ((s > 0 ? b.l : b.h) - stop) <= 0) { all(stop); break; }
    if (j > fi || firstFull) for (let k = 0; k < tgs.length; k++) if (tgs[k] != null && s * ((s > 0 ? b.h : b.l) - tgs[k]) >= 0) fin(k, tgs[k]);
    if (b.e >= dl) all(b.c); }
  return left ? null : R;
}

// one entry: { fi, fill, firstFull } or null
function enter(M5, e, s, ts, px, stop, cost, tsec) {
  if (e === 0) { const fi = startIdx(M5, ts); if (fi >= M5.length) return null; return { fi, fill: M5[fi].o, firstFull: true }; }
  const r = findFill(M5, s, px, stop, ts, ts + WIN * tsec, 'through', cost / 2); if (!r) return null;
  return { fi: r.i, fill: r.fill, firstFull: false };
}

const inBad = (X, t) => { let lo = 0, hi = X.length; while (lo < hi) { const m = (lo + hi) >> 1; if (X[m][0] <= t) lo = m + 1; else hi = m; } return lo > 0 && t <= X[lo - 1][1]; };
function newAcc() { const n = NCELL * NV; return { ms: new Float64Array(n * NM), msNet: new Float64Array(n * NM), n: new Float64Array(n * 2), sum: new Float64Array(n * 2),
  sq: new Float64Array(n * 2), net: new Float64Array(n * 2), win: new Float64Array(n * 2) }; }
function add(A, ci, v, w, m, R, cr) { const c = ci * NV + v; A.ms[c * NM + m] += R; A.msNet[c * NM + m] += R - cr; A.n[c * 2 + w]++; A.sum[c * 2 + w] += R; A.sq[c * 2 + w] += R * R; A.net[c * 2 + w] += R - cr; if (R > 0) A.win[c * 2 + w]++; }

export function runMarket(market) {
  const M5 = K.load(market, '5m', { from: '2004-01-01', to: '2026-11-01' }); const F = frames(M5);
  const sigs = signals(F), cost = COSTS[market], X = exclusions(market);
  const acc = Object.fromEntries(KINDS.map((k) => [k, newAcc()])); const cnt = { real: 0, c1: 0, c2: 0, dropped: 0, bad: 0, small: 0, nostruct: 0 };
  const seen = new Set();
  // book one trade: returns R array or null
  const book = (kind, f, z, e, s, en, stop, tgs, vars, cap) => {
    const t = M5[en.fi].t; if (t < FROM || t >= TO) return null;
    if (X.length && inBad(X, t)) { cnt.dropped++; return null; }
    const risk = s * (en.fill - stop); if (!(risk > 0)) { cnt.bad++; return null; }
    if (risk < cost) { cnt.small++; return null; }
    const R = exits(M5, s, en.fi, en.fill, stop, tgs, cap, en.firstFull); if (!R) return null;
    const m = monthOf(t), w = t < SPLIT ? 0 : 1, cr = cost / risk;
    for (let x = 0; x < 3; x++) if (!Number.isNaN(R[x])) for (const v of vars) add(acc[kind], cellIndex(f, z, e, x), v, w, m, R[x], cr);
    cnt[kind] = (cnt[kind] || 0) + 1; return { R, risk, t };
  };
  for (const g of sigs) {
    const zt = ZTF[g.z], Z = F[zt], cap = CAP[zt], tsec = TSEC[TBELOW[zt]];
    // control (ii): every zone touch
    const k2 = 'c2|' + g.f + '|' + g.z + '|' + g.k0 + '|' + g.s;
    if (g.c2 && !seen.has(k2)) { seen.add(k2);
      for (let e = 0; e < 2; e++) { const en = enter(M5, e, g.s, g.c2.ts, g.c2.px, g.c2.stop, cost, tsec); if (!en) continue;
        const risk = g.s * (en.fill - g.c2.stop); const st = risk > 0 ? structTarget(Z, g.zone, g.zones, g.s, g.touchT, g.c2.ts, en.fill) : null;
        const sg = st != null && g.s * (st - en.fill) >= risk ? st : null;
        book('c2', g.f, g.z, e, g.s, en, g.c2.stop, [en.fill + g.s * risk, en.fill + 2 * g.s * risk, sg], [0], cap); } }
    if (g.onlyC2) continue;
    const key = g.f + '|' + g.z + '|' + g.j + '|' + g.s; if (seen.has(key)) continue; seen.add(key);
    const vars = [0]; if (g.call === g.s) vars.push(1); else if (g.call === -g.s) vars.push(2); vars.push(g.legAtr < 1 ? 3 : 4);
    for (let e = 0; e < 2; e++) {
      const en = enter(M5, e, g.s, g.ts, g.level, g.stop, cost, tsec); let mult = null;
      if (en) { const risk = g.s * (en.fill - g.stop);
        if (risk > 0) { const st = structTarget(Z, g.zone, g.zones, g.s, g.touchT, g.ts, en.fill); const sg = st != null && g.s * (st - en.fill) >= risk ? st : null;
          if (sg == null) cnt.nostruct++; else mult = (g.s * (sg - en.fill)) / risk;
          if (!(g.s * (en.fill - g.stop) > 0)) throw new Error('stop on the wrong side');
          const r = book('real', g.f, g.z, e, g.s, en, g.stop, [en.fill + g.s * risk, en.fill + 2 * g.s * risk, sg], vars, cap);
          // side-flipped placebo: same fill, other side, same distance
          if (r) { const ps = -g.s, pstop = en.fill + g.s * risk;
            book('plac', g.f, g.z, e, ps, en, pstop, [en.fill + ps * risk, en.fill + 2 * ps * risk, mult == null ? null : en.fill + ps * mult * risk], vars, cap); } } }
      // control (i): the same ChoCh 96 candles earlier, no zone; struct at the real trade's R multiple
      if (g.c1) { const c = g.c1, en1 = enter(M5, e, g.s, c.ts, c.level, c.stop, cost, tsec);
        if (en1) { const risk = g.s * (en1.fill - c.stop);
          if (risk > 0) book('c1', g.f, g.z, e, g.s, en1, c.stop, [en1.fill + g.s * risk, en1.fill + 2 * g.s * risk, mult == null ? null : en1.fill + g.s * mult * risk], [0], cap); } }
    }
  }
  const J = (A) => Object.fromEntries(Object.entries(A).map(([k, v]) => [k, Array.from(v, (q) => +q.toFixed(6))]));
  return { market, cost, assumed: ASSUMED.includes(market), first: M5.length ? M5[0].t : null, last: M5.length ? M5[M5.length - 1].t : null,
    signals: sigs.filter((g) => !g.onlyC2).length, touches: sigs.length, counts: cnt, acc: Object.fromEntries(KINDS.map((k) => [k, J(acc[k])])) };
}

// ---- cut test: signals known by a date, computed on candles cut there, equal the full run's ----------------------------
export function cutTest(market, cuts = ['2008-06-11', '2012-03-14', '2016-09-21', '2021-02-17', '2025-05-07']) {
  const M5 = K.load(market, '5m', { from: '2004-01-01', to: '2026-11-01' });
  const key = (g) => [g.f, g.z, g.s, g.tt, g.level.toFixed(8), g.stop.toFixed(8), g.call, g.legAtr.toFixed(6), g.touchT].join('|');
  const full = signals(frames(M5)).filter((g) => !g.onlyC2); const out = [];
  for (const c of cuts) { const T = Date.parse(c + 'T00:00:00Z') / 1000;
    const cut = signals(frames(M5.filter((b) => b.e <= T))).filter((g) => !g.onlyC2 && g.ts <= T).map(key);
    const want = full.filter((g) => g.ts <= T).map(key); const A = new Set(cut), B = new Set(want);
    out.push({ market, cut: c, n: B.size, missing: [...B].filter((k) => !A.has(k)).length, extra: [...A].filter((k) => !B.has(k)).length }); }
  return out;
}

// ---- pooled statistics ----------------------------------------------------------------------------------------------
export function pool(list, kind) { const A = newAcc(); for (const d of list) { const S = d.acc[kind]; for (const k of Object.keys(A)) for (let i = 0; i < A[k].length; i++) A[k][i] += S[k][i]; } return A; }
export function cellStats(A, ci, v = 0) { const c = ci * NV + v;
  const ms = A.ms.subarray(c * NM, (c + 1) * NM), msn = A.msNet.subarray(c * NM, (c + 1) * NM);
  const win = (w) => { const n = A.n[c * 2 + w], a = w ? DM : 0, b = w ? NM : DM;
    return { n, mean: n ? A.sum[c * 2 + w] / n : null, t: mstat(ms, a, b).t, meanNet: n ? A.net[c * 2 + w] / n : null, tNet: mstat(msn, a, b).t,
      win: n ? A.win[c * 2 + w] / n : null, months: b - a, sum: A.sum[c * 2 + w], sq: A.sq[c * 2 + w] }; };
  return { d: win(0), c: win(1) };
}
export function judge(data) {
  const P = Object.fromEntries(KINDS.map((k) => [k, pool(data, k)])); const rows = [];
  for (let c = 0; c < NCELL; c++) { const s = cellStats(P.real, c), c1 = cellStats(P.c1, c), c2 = cellStats(P.c2, c), pl = cellStats(P.plac, c);
    rows.push({ cell: c, ...cellName(c), d: s.d, c: s.c, p: p1(s.c.t, s.c.months - 1), c1, c2,
      vs1: { d: welch(s.d, c1.d), c: welch(s.c, c1.c) }, vs2: { d: welch(s.d, c2.d), c: welch(s.c, c2.c) },
      plac: { d: pl.d, c: pl.c, p: p1(pl.c.t, pl.c.months - 1) },
      splits: Object.fromEntries(VARS.slice(1).map((vn, i) => { const x = cellStats(P.real, c, i + 1); return [vn, { d: x.d, c: x.c }]; })) }); }
  const H = K.holm(rows.map((r) => r.p)), HP = K.holm(rows.map((r) => r.plac.p));
  const ok3 = (x, h) => x.d.n >= 300 && x.c.n >= 300 && x.d.mean > 0 && x.c.mean > 0 && x.d.t >= 2 && x.c.t >= 2 && h < 0.05;
  const ge2 = (v) => !!(v.d != null && v.c != null && v.d >= 2 && v.c >= 2);
  rows.forEach((r, i) => { r.holm = H[i]; r.plac.holm = HP[i];
    r.checks = { n: r.d.n >= 300 && r.c.n >= 300, disc: r.d.mean > 0 && r.d.t >= 2, conf: r.c.mean > 0 && r.c.t >= 2, holm: H[i] < 0.05, ctlChoch: ge2(r.vs1), ctlTouch: ge2(r.vs2) };
    r.pass = Object.values(r.checks).every(Boolean); r.plac.pass = ok3(r.plac, HP[i]); });
  return rows;
}

const f3 = (x) => (x == null || Number.isNaN(x) ? 'n/a' : (x >= 0 ? '+' : '-') + Math.abs(x).toFixed(3)), f2 = (x) => (x == null || Number.isNaN(x) ? 'n/a' : x.toFixed(2)), N = (x) => Math.round(x).toLocaleString('en-US');
export const cname = (r) => `${r.fam} ${r.ztf} ${r.entry} ${r.exit}`;
const slim = (w) => ({ n: w.n, mean: w.mean == null ? null : +w.mean.toFixed(6), t: +w.t.toFixed(4), meanNet: w.meanNet == null ? null : +w.meanNet.toFixed(6), tNet: +w.tNet.toFixed(2),
  win: w.win == null ? null : +w.win.toFixed(3) });
const r2 = (x) => (x == null ? null : +x.toFixed(2));

export function report(dir) {
  const data = MARKETS.map((m) => JSON.parse(fs.readFileSync(path.join(dir, m + '.json'), 'utf8')));
  const cut = MARKETS.flatMap((m) => { const f = path.join(dir, 'cut-' + m + '.json'); return fs.existsSync(f) ? JSON.parse(fs.readFileSync(f, 'utf8')) : []; });
  const rows = judge(data), pass = rows.filter((r) => r.pass), plPass = rows.filter((r) => r.plac.pass);
  const enough = rows.filter((r) => r.checks.n).length;
  const verdict = pass.length ? 'PASS' : enough < 12 ? 'INCONCLUSIVE' : 'FAIL';
  const big = rows.filter((r) => r.checks.n), bestC = [...(big.length ? big : rows)].sort((a, b) => b.c.t - a.c.t)[0];
  const perMarket = {}; for (const r of pass) perMarket[cname(r)] = data.map((d) => { const s = cellStats(pool([d], 'real'), r.cell); return { market: d.market, d: slim(s.d), c: slim(s.c) }; });
  const headline = verdict === 'PASS'
    ? `${pass.length} of 48 cells pass; best ${cname(pass[0])}, ${f3(pass[0].c.mean)}R a trade before costs in 2015-26 (n ${N(pass[0].c.n)}, month t ${f2(pass[0].c.t)})`
    : `${pass.length} of 48 cells pass; the best confirmation cell, ${cname(bestC)}, made ${f3(bestC.c.mean)}R a trade before costs in 2015-26 (n ${N(bestC.c.n)}, month t ${f2(bestC.c.t)}; discovery ${f3(bestC.d.mean)}R, t ${f2(bestC.d.t)}; ${f3(bestC.c.meanNet)}R after costs)`;
  const RW = rows.map((r) => ({ cell: cname(r), fam: r.fam, ztf: r.ztf, entry: r.entry, exit: r.exit, disc: slim(r.d), conf: slim(r.c), holm: +r.holm.toFixed(4),
    controlChoch: { disc: slim(r.c1.d), conf: slim(r.c1.c) }, controlTouch: { disc: slim(r.c2.d), conf: slim(r.c2.c) },
    vsChoch: { d: r2(r.vs1.d), c: r2(r.vs1.c) }, vsTouch: { d: r2(r.vs2.d), c: r2(r.vs2.c) }, checks: r.checks, pass: r.pass,
    placebo: { disc: slim(r.plac.d), conf: slim(r.plac.c), holm: +r.plac.holm.toFixed(4), pass: r.plac.pass },
    splits: Object.fromEntries(Object.entries(r.splits).map(([k, v]) => [k, { disc: slim(v.d), conf: slim(v.c) }])) }));
  const out = { study: 'dom-sd-choch-wide', built: '2026-11-23', verdict, headline, basis: 'judged before costs on calendar-month sums (pre-registered); after costs beside',
    windows: { discovery: '2005-01-01 to 2014-12-31 (120 months)', confirmation: '2015-01-01 to 2026-10-31 (142 months)' }, markets: MARKETS,
    assumedCosts: ASSUMED, costs: Object.fromEntries(data.map((d) => [d.market, d.cost])),
    meta: data.map((d) => ({ market: d.market, first: new Date(d.first * 1000).toISOString().slice(0, 10), last: new Date(d.last * 1000).toISOString().slice(0, 10),
      touches: d.touches, signals: d.signals, ...d.counts })),
    cellsWithEnough: enough, passed: pass.map(cname), placeboPassed: plPass.map(cname), bestConfirmation: cname(bestC), cut, cells: RW, perMarket };
  fs.writeFileSync(path.join(HERE, 'result.json'), JSON.stringify(out, null, 1) + '\n');
  fs.writeFileSync(path.join(HERE, 'RESULT.md'), resultMd(out, rows));
  return out;
}

function resultMd(o, rows) {
  const nCut = o.cut.reduce((a, x) => a + x.n, 0), bad = o.cut.reduce((a, x) => a + x.missing + x.extra, 0), cnt = (f) => rows.filter(f).length;
  const L = [];
  L.push('# Zones confirmed by a change of character, ten markets (result)', '', `**Verdict: ${o.verdict}. ${o.headline}.**`, '',
    'Run 23 Nov 2026 as pre-registered (`PREREGISTRATION.md`, committed and pushed alone first). Research only: nothing live',
    'changed, nothing is proposed. One run, no variants.', '',
    '## What was run', '',
    'Four zone families on the H4 or Daily chart (dominant zone, fresh supply / demand, engulf zone, failed engulf traded the other',
    'way), first touch only. After the touch, on the timeframe two steps lower (H4 -> M15, Daily -> H1), the change of character:',
    'the first close beyond the most recent 3-a-side swing the move into the zone left (a swing high for a buy zone), within 24',
    'candles and before a close through the zone\'s far side. Stop past the extreme made in the zone + 0.1 ATR. Entry at market (next',
    '5-minute open) or a trade-through limit at the broken swing; exits 1R, 2R or the structural target (leg-out extreme or next',
    'opposite zone, only when 1R or more away). 48 cells, ten markets pooled, OANDA mid 5-minute candles; discovery 2005-2014,',
    `confirmation 2015 to October 2026. Costs after the fact only; **ASSUMED, not measured** for ${o.assumedCosts.join(', ')}.`, '',
    'Controls: (i) the same ChoCh search 96 trigger candles before the touch with no zone in its window; (ii) the zone touch itself',
    'with no ChoCh (market at the next open, or a trade-through limit at the touch close; stop past the touch candle).', '',
    '## The bar, cell by cell', '',
    `- n >= 300 in both windows: ${cnt((r) => r.checks.n)} of 48.`,
    `- Mean R > 0 and month t >= 2 in discovery: ${cnt((r) => r.checks.disc)}; in confirmation: ${cnt((r) => r.checks.conf)}; both: ${cnt((r) => r.checks.disc && r.checks.conf)}.`,
    `- Holm-adjusted p < 0.05 over the 48 confirmation tests: ${cnt((r) => r.checks.holm)}.`,
    `- Beats control (i), the ChoCh with no zone (Welch t >= 2 both windows): ${cnt((r) => r.checks.ctlChoch)}.`,
    `- Beats control (ii), the touch with no ChoCh: ${cnt((r) => r.checks.ctlTouch)}.`,
    `- **All: ${o.passed.length}${o.passed.length ? ' (' + o.passed.join('; ') + ')' : ''}.**`,
    `- Side-flipped placebo passing bars 1-3: ${o.placeboPassed.length}${o.placeboPassed.length ? ' (' + o.placeboPassed.join('; ') + ')' : ''}.`, '',
    '## Every cell', '',
    'R a trade before costs (month-sum t), after costs beside; "vs i / vs ii" = Welch t of the cell against each control',
    '(discovery / confirmation); Holm on the confirmation test.', '',
    '| Cell | n 05-14 | R 05-14 (t) | net 05-14 | n 15-26 | R 15-26 (t) | net 15-26 | ctl i R 15-26 | ctl ii R 15-26 | vs i | vs ii | Holm | Placebo R 15-26 (t) | Pass |',
    '|---|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|---|');
  for (const r of rows) L.push(`| ${cname(r)} | ${N(r.d.n)} | ${f3(r.d.mean)} (${f2(r.d.t)}) | ${f3(r.d.meanNet)} | ${N(r.c.n)} | ${f3(r.c.mean)} (${f2(r.c.t)}) | ${f3(r.c.meanNet)} | ${f3(r.c1.c.mean)} | ${f3(r.c2.c.mean)} | ${f2(r.vs1.d)} / ${f2(r.vs1.c)} | ${f2(r.vs2.d)} / ${f2(r.vs2.c)} | ${r.holm.toFixed(3)} | ${f3(r.plac.c.mean)} (${f2(r.plac.c.t)}) | ${r.pass ? 'yes' : 'no'} |`);
  L.push('', '## Splits (descriptive, not tested)', '', 'R a trade before costs (month t) in each window.', '',
    '| Cell | with MSNR 05-14 | with MSNR 15-26 | against MSNR 05-14 | against MSNR 15-26 | leg < 1 ATR 05-14 | leg < 1 ATR 15-26 | leg >= 1 ATR 05-14 | leg >= 1 ATR 15-26 |',
    '|---|---:|---:|---:|---:|---:|---:|---:|---:|');
  const sx = (w) => `${f3(w.mean)} (${f2(w.t)}, n ${N(w.n)})`;
  for (const r of rows) { const S = r.splits; L.push(`| ${cname(r)} | ${sx(S.msnrWith.d)} | ${sx(S.msnrWith.c)} | ${sx(S.msnrAgainst.d)} | ${sx(S.msnrAgainst.c)} | ${sx(S.legUnder.d)} | ${sx(S.legUnder.c)} | ${sx(S.legOver.d)} | ${sx(S.legOver.c)} |`); }
  L.push('');
  if (o.passed.length) { L.push('## Per market, passing cells', ''); for (const [c, list] of Object.entries(o.perMarket)) { L.push(`### ${c}`, '', '| Market | n 05-14 | R (t) | n 15-26 | R (t) |', '|---|---:|---:|---:|---:|');
    for (const x of list) L.push(`| ${x.market} | ${N(x.d.n)} | ${f3(x.d.mean)} (${f2(x.d.t)}) | ${N(x.c.n)} | ${f3(x.c.mean)} (${f2(x.c.t)}) |`); L.push(''); } }
  L.push('## Checks', '',
    `- Cut test: ${o.cut.length} cuts on ${[...new Set(o.cut.map((x) => x.market))].join(', ') || 'none'}: ${N(nCut)} signals known by the cut dates, ${bad} missing or extra when the candles are cut there.`,
    '- Every trade has its stop on the losing side of the fill (the run throws otherwise); fills at or past the stop and trades whose risk is under the round trip are no trades (every set).',
    '- Exclusions: the data-quality audit\'s bad intervals (`combo-grid-2` `exclusions`).', '',
    '| Market | candles from | touches | ChoCh signals | real trades | ctl i | ctl ii | dropped | past stop | risk under cost | no struct target |', '|---|---|---:|---:|---:|---:|---:|---:|---:|---:|---:|');
  for (const m of o.meta) L.push(`| ${m.market} | ${m.first} | ${N(m.touches)} | ${N(m.signals)} | ${N(m.real)} | ${N(m.c1)} | ${N(m.c2)} | ${m.dropped} | ${m.bad} | ${N(m.small)} | ${N(m.nostruct)} |`);
  L.push('', '## What it means', '');
  if (o.verdict === 'PASS') L.push('A passing cell is a candidate for its own forward record and an owner decision, nothing more: it is not adopted, and never called an edge before a forward record.');
  else L.push('No zone family confirmed by a change of character beats both its controls on ten markets over 22 years before costs.',
    'Do not re-test variants of these 48 cells on these years. Nothing live changed; no rule is proposed.', '',
    'How to read the controls (after the result, descriptive): no cell is positive with month t >= 2 in either window, so the',
    'control comparisons cannot rescue any. Control (ii), the touch at market, is above zero before costs in several 4h cells (the',
    'short pull-back `dom-touch-market` found); waiting for the change of character gives that up. Control (i) moves a lot with',
    'the family (shifting 96 candles back lands before an engulf zone fails, or before a supply / demand base forms), so its Welch',
    't says more about the shift than about the zone. The side-flipped placebo is mostly a few hundredths of an R above zero: as in',
    '`grid7-wide-core`, entering WITH a lower-timeframe turn gives a little back before costs. After costs every cell loses.');
  L.push('');
  return L.join('\n');
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const [cmd, a, b] = process.argv.slice(2);
  if (cmd === 'market') { fs.mkdirSync(b, { recursive: true }); const t0 = Date.now(); const r = runMarket(a);
    fs.writeFileSync(path.join(b, a + '.json'), JSON.stringify(r)); console.log(a, 'touches', r.touches, 'signals', r.signals, JSON.stringify(r.counts), ((Date.now() - t0) / 1000).toFixed(0) + 's'); }
  else if (cmd === 'cut') { fs.mkdirSync(b, { recursive: true }); const r = cutTest(a); fs.writeFileSync(path.join(b, 'cut-' + a + '.json'), JSON.stringify(r)); console.log(JSON.stringify(r)); }
  else if (cmd === 'report') { const o = report(a); console.log(o.verdict, o.headline); }
  else console.log('usage: run.mjs market <m> <dir> | cut <m> <dir> | report <dir>');
}
