// research/edge/grid6-session-range/run.mjs - grid 6 of PREREGISTRATION.md (23 Nov 2026): session ranges (Asia, the previous
// trading day, the previous New York afternoon) x the event in London or New York (break and hold / sweep and reclaim) x a Daily
// key level touched today x the MSNR call x the H1 box state x the M15 confirmation x entry / stop x exit, per market and pooled,
// with a side-flipped placebo.
//   node --max-old-space-size=6000 research/edge/grid6-session-range/run.mjs market <m> <dir>   one market -> <dir>/<m>.*.bin, <m>.json
//   node research/edge/grid6-session-range/run.mjs cut <m> <dir>                                 cut test -> <dir>/<m>.cut.json
//   node research/edge/grid6-session-range/run.mjs report <dir>                                  pool, the bar -> result.json
// Research only: reads the edgekit candle cache; imports edgekit, council/eg-methods (engulfAt), combo-grid-3 (frames,
// buildZones), combo-grid-2 (COSTS, exclusions), grid5-msnr-box (h4Calls) and dom-trade-through (findFill, manage, atr14,
// startIdx), none edited.
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import * as K from '../_lib/edgekit.mjs';
import { engulfAt } from '../../../council/eg-methods.mjs';
import { frames, buildZones } from '../combo-grid-3/run.mjs';
import { COSTS, exclusions } from '../combo-grid-2/run.mjs';
import { h4Calls } from '../grid5-msnr-box/run.mjs';
import { findFill, manage, atr14, startIdx } from '../dom-trade-through/run.mjs';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const y = (n) => Date.UTC(n, 0, 1) / 1000;
export const FROM = y(2010), TO = y(2020), HALF = y(2015), NM = 120, HM = 60;
export const MARKETS = ['xau', 'eurusd', 'gbpusd', 'usdjpy', 'audusd'];
export const RANGES = ['asia', 'prev', 'nypm'];
export const EVENTS = ['hold', 'sweep'];
export const WINDOWS = ['london', 'ny'];
export const KEYS = ['yes', 'no', 'any'];                 // stored: yes, no
export const CALLS = ['with', 'against', 'any'];          // stored: with, against, zero
export const BOXES = ['inside', 'outWith', 'outAgainst', 'any']; // stored: the first three
export const CONFS = ['none', 'eg', 'sb'];
export const ENTRIES = ['mkt', 'lim'], STOPS = ['range', 'ext'];
export const EXITS = ['1R', '2R', 'range', 'close21', 'trail'];
const XSLOT = [0, 1, 5, 8, 6];                             // manage() R slots: 1R 2R opp (the range target) plain-stop trail
export const ZKINDS = ['av', 'eg', 'dom'];
export const CONF_WIN = 4, LIM_LIFE = 8 * 900, MIN_TGT_R = 0.5;
const WIN_H = [[7, 12], [12, 17]];
// stored cell: the three context states first (key 2 x call 3 x box 3), then the rest
const CTX = [2, 3, 3], REST_D = [RANGES.length, EVENTS.length, WINDOWS.length, CONFS.length, ENTRIES.length, STOPS.length, EXITS.length];
export const REST = REST_D.reduce((a, b) => a * b, 1);   // 720
export const NCTX = CTX.reduce((a, b) => a * b, 1);      // 18
export const NCELL = NCTX * REST;                          // 12,960 stored
export const CELLS_PER_SCOPE = REST * 3 * 3 * 4;           // 25,920
const restIndex = (v) => v.reduce((a, x, i) => a * REST_D[i] + x, 0);
export const cellIndex = (key, call, box, rest) => ((key * 3 + call) * 3 + box) * REST + rest;
export const monthIdx = (t) => { const d = new Date(t * 1000); return (d.getUTCFullYear() - 2010) * 12 + d.getUTCMonth(); };
const conv = (B) => (B._c ||= B.map((b) => ({ time: b.t, open: b.o, high: b.h, low: b.l, close: b.c })));
const DAY = 86400;

// ---- ranges of each UTC weekday ---------------------------------------------------------------------------------------
function rangeOf(M5, a, b, minN) { let i = startIdx(M5, a), n = 0, hi = -Infinity, lo = Infinity;
  for (; i < M5.length && M5[i].t < b; i++) { n++; if (M5[i].h > hi) hi = M5[i].h; if (M5[i].l < lo) lo = M5[i].l; }
  return n >= minN && hi > lo ? { hi, lo } : null; }
export function dayRanges(M5, D, D0) {
  const out = { asia: rangeOf(M5, D0, D0 + 7 * 3600, 60) };
  const k = K.closedCount(D, D0 + 7 * 3600) - 1; out.prev = k >= 0 && D[k].h > D[k].l && D[k].e > D0 - 4 * DAY ? { hi: D[k].h, lo: D[k].l } : null;
  let P = null; for (let back = 1; back <= 4; back++) { const p = D0 - back * DAY, wd = new Date(p * 1000).getUTCDay(); if (wd === 0 || wd === 6) continue;
    const r = rangeOf(M5, p + 17 * 3600, p + 21 * 3600, 30); if (r) { P = r; break; } if (startIdx(M5, p) < startIdx(M5, p + DAY)) break; }
  out.nypm = P; return out;
}

// ---- signals (closed candles only) -------------------------------------------------------------------------------------
// every signal: { rg, ev, win, d, conf, ts, edge, other, height, ext, c0, call, box, day }
export function signals(F, { from = FROM - 3 * DAY, to = TO } = {}) {
  const M5 = F['5m'], T = F['15m'], H1 = F['1h'], D = F['1d'], C = conv(T), H4 = F['4h'];
  const calls = h4Calls(F);
  const sev = new Map(); for (const e of K.structure(T, 2).events) sev.set(e.i, e);
  const boxes = K.boxesHL(H1, 2);
  const out = [];
  const d0 = Math.floor(Math.max(from, M5[0].t) / DAY) * DAY, d1 = Math.min(to, M5[M5.length - 1].e);
  for (let D0 = d0; D0 < d1; D0 += DAY) {
    const wd = new Date(D0 * 1000).getUTCDay(); if (wd === 0 || wd === 6) continue;
    const R = dayRanges(M5, D, D0);
    for (let wi = 0; wi < 2; wi++) {
      const a = D0 + WIN_H[wi][0] * 3600, b = D0 + WIN_H[wi][1] * 3600;
      const nT = K.closedCount(T, to); // only closed M15 candles are read
      const j0 = Math.max(startIdx(T, a), 2), j1 = Math.min(startIdx(T, b), nT); if (j1 <= j0) continue;
      for (let ri = 0; ri < 3; ri++) { const r = R[RANGES[ri]]; if (!r) continue;
        for (const d of [1, -1]) {
          const edge = d > 0 ? r.hi : r.lo, beyond = (x) => (d > 0 ? x > edge : x < edge);
          // hold: two closes beyond the edge, the close before them not beyond; side d
          for (let j = j0 + 1; j < j1; j++) if (beyond(T[j - 1].c) && beyond(T[j].c) && !beyond(T[j - 2].c)) {
            emit(0, d, j, j - 1, edge, d > 0 ? r.lo : r.hi, r.hi - r.lo); break; }
          // sweep: a wick beyond the edge (the close before not beyond), then a close back inside on that candle or within 2; side -d
          for (let j = j0; j < j1; j++) { if (!(d > 0 ? T[j].h > edge : T[j].l < edge) || beyond(T[j - 1].c)) continue;
            let m = -1; for (let q = j; q <= j + 2 && q < nT; q++) if (!beyond(T[q].c) && T[q].c !== edge) { m = q; break; }
            if (m < 0) continue; emit(1, -d, m, j, edge, d > 0 ? r.lo : r.hi, r.hi - r.lo); break; }
        }
        function emit(ev, s, e, first, edgeP, otherP, height) {
          if (first < 1) return;
          const add = (conf, jj) => {
            const ts = T[jj].e; if (ts > to) return;
            let ext = s > 0 ? Infinity : -Infinity; for (let q = first; q <= jj; q++) ext = s > 0 ? Math.min(ext, T[q].l) : Math.max(ext, T[q].h);
            const hi4 = K.closedCount(H4, ts) - 1, c = hi4 >= 0 ? calls[hi4] : 0;
            const h = K.closedCount(H1, ts) - 1; let bx = 0;
            { let lo = 0, hh = boxes.length; while (lo < hh) { const m = (lo + hh) >> 1; if (boxes[m].s <= h) lo = m + 1; else hh = m; }
              const B = lo > 0 ? boxes[lo - 1] : null; bx = !B || B.bi < 0 || B.bi > h ? 0 : B.dir === s ? 1 : 2; }
            out.push({ rg: ri, ev, win: wi, d: s, conf, ts, edge: edgeP, other: otherP, height, ext, c0: T[jj].c, call: c === s ? 0 : c === -s ? 1 : 2, box: bx, day: D0 });
          };
          add(0, e);
          for (let jj = e; jj <= e + CONF_WIN && jj < nT; jj++) { const g = engulfAt(C, jj, 3); if (g && g.dir === s) { add(1, jj); break; } }
          for (let jj = e; jj <= e + CONF_WIN && jj < nT; jj++) { const v = sev.get(jj); if (v && v.dir === s) { add(2, jj); break; } }
        }
      }
    }
  }
  return out;
}

// key level touched today: a Daily zone of the trade's side, standing, traded into by a 5-minute candle of the day closed by ts
export function touchedToday(M5, Z, s, D0, ts) {
  const i1 = K.closedCount(M5, ts);
  for (const z of Z) { if (z.d !== s || z.at >= ts || z.end <= D0) continue;
    for (let i = startIdx(M5, Math.max(D0, z.at)); i < i1; i++) { const b = M5[i]; if (b.t >= z.end) break; if (b.l <= z.top && b.h >= z.bot) return true; } }
  return false;
}

// ---- one order: { t, risk, R (5 exits; NaN where the range target is under 0.5R) } or null ------------------------------------
export function trade(M5, s, type, entry, stop, tgt, ts, cost) {
  let fi, fill, full;
  if (type === 'mkt') { fi = startIdx(M5, ts); if (fi >= M5.length) return null; fill = M5[fi].o; full = true; }
  else { const f = findFill(M5, s, entry, stop, ts, ts + LIM_LIFE, 'through', cost / 2); if (!f) return null; fi = f.i; fill = f.fill; full = false; }
  const day = Math.floor(M5[fi].t / DAY) * DAY, dl = day + 21 * 3600; if (M5[fi].t >= dl) return null;
  const risk = s * (fill - stop); if (!(risk >= cost)) return null;
  let tR = (s * (tgt - fill)) / risk; const tOk = tR >= MIN_TGT_R; if (!tOk) tR = 1e9;
  const r = manage(M5, s, fi, fill, stop, dl - M5[fi].t, full, tR); if (!r) return null;
  if (!(s * (fill - stop) > 0)) throw new Error('stop on the wrong side');
  const R = XSLOT.map((k) => r.R[k]); if (!tOk) R[2] = NaN;
  return { t: r.t, risk: r.risk, R };
}

export function runMarket(market, { dir } = {}) {
  const M5 = K.load(market, '5m', { from: y(2009), to: TO }); const F = frames(M5);
  const cost = COSTS[market], X = exclusions(market), D = F['1d'], AD = atr14(D);
  const inBad = (t) => X.some(([a, b]) => t >= a && t <= b);
  const Z = ZKINDS.flatMap((k) => buildZones(k, D));
  const sigs = signals(F);
  const acc = { n: new Uint32Array(NCELL * 2 * 2), ms: new Float64Array(NCELL * 2 * NM), cm: new Float64Array(NCELL * 2 * NM) };
  let ntr = 0, npl = 0, bad = 0; const touchCache = new Map();
  for (const sg of sigs) {
    const d = sg.d, buf = cost / 2, ts = sg.ts;
    const di = K.closedCount(D, ts) - 1; if (di < 15) continue; const atrD = AD[di];
    const tk = sg.day + ':' + d + ':' + ts; let touched = touchCache.get(tk);
    if (touched == null) { touched = touchedToday(M5, Z, d, sg.day, ts); touchCache.set(tk, touched); }
    const keyS = touched ? 0 : 1;
    const stops = [sg.other - d * buf, sg.ext - d * 0.1 * atrD];
    const tgt = sg.ev === 0 ? sg.edge + d * sg.height : sg.other;
    for (let ei = 0; ei < 2; ei++) for (let si = 0; si < 2; si++) {
      const stop = stops[si], entry = ei === 0 ? null : sg.edge, type = ei === 0 ? 'mkt' : 'lim';
      const ref = entry ?? sg.c0; if (!(d * (ref - stop) >= 2 * cost)) continue;
      for (let pl = 0; pl < 2; pl++) {
        const s = pl ? -d : d, mir = (x) => (pl ? 2 * sg.c0 - x : x);
        const r = trade(M5, s, type, entry == null ? null : mir(entry), mir(stop), mir(tgt), ts, cost);
        if (!r || r.t < FROM || r.t >= TO) continue; if (inBad(r.t)) { bad++; continue; }
        pl ? npl++ : ntr++;
        const m = monthIdx(r.t), half = r.t >= HALF ? 1 : 0, cr = cost / r.risk;
        for (let x = 0; x < EXITS.length; x++) { if (!Number.isFinite(r.R[x])) continue;
          const c = pl * NCELL + cellIndex(keyS, sg.call, sg.box, restIndex([sg.rg, sg.ev, sg.win, sg.conf, ei, si, x]));
          acc.n[c * 2 + half]++; acc.ms[c * NM + m] += r.R[x]; acc.cm[c * NM + m] += cr; }
      }
    }
  }
  const meta = { market, signals: sigs.length, trades: ntr, placebo: npl, droppedBad: bad, bars: M5.length, last: new Date(M5[M5.length - 1].t * 1000).toISOString() };
  if (dir) { fs.mkdirSync(dir, { recursive: true }); for (const k of Object.keys(acc)) fs.writeFileSync(path.join(dir, `${market}.${k}.bin`), Buffer.from(acc[k].buffer));
    fs.writeFileSync(path.join(dir, `${market}.json`), JSON.stringify(meta)); }
  return { acc, meta };
}

// ---- cut test: the signals before a cut are the same when the candles stop at the cut -------------------------------------
const sigKey = (s) => [s.rg, s.ev, s.win, s.d, s.conf, s.ts, s.edge, s.other, s.ext, s.c0, s.call, s.box].join('|');
export function cutTest(market, cuts = ['2011-06-15', '2013-02-20', '2015-09-09', '2017-04-12', '2019-08-21']) {
  const M5 = K.load(market, '5m', { from: y(2009), to: TO });
  const full = signals(frames(M5)); const out = [];
  for (const c of cuts) { const C = Date.parse(c + 'T13:37:00Z') / 1000;
    const part = signals(frames(M5.filter((b) => b.e <= C)), { to: C });
    const A = new Set(full.filter((s) => s.ts <= C).map(sigKey)), B = new Set(part.filter((s) => s.ts <= C).map(sigKey));
    let miss = 0, extra = 0; for (const k of A) if (!B.has(k)) miss++; for (const k of B) if (!A.has(k)) extra++;
    out.push({ cut: c, signals: A.size, missing: miss, extra }); }
  return out;
}

// ---- report -------------------------------------------------------------------------------------------------------------
function mstat(ms, a, b) { const n = b - a; let s = 0, q = 0; for (let m = a; m < b; m++) { s += ms[m]; q += ms[m] * ms[m]; }
  const mean = s / n, sd = Math.sqrt(Math.max(0, (q - n * mean * mean) / (n - 1))); return { sum: s, t: sd > 0 ? mean / (sd / Math.sqrt(n)) : 0 }; }
const p1 = (t, df) => { const p = K.pFromT(t, df); return p == null ? 1 : t > 0 ? p / 2 : 1 - p / 2; };
function decodeRest(c) { const v = []; for (let i = REST_D.length - 1; i >= 0; i--) { v[i] = c % REST_D[i]; c = (c - v[i]) / REST_D[i]; } return v; }
const r4 = (x) => (x == null || !Number.isFinite(x) ? null : +x.toFixed(4)), r2 = (x) => (x == null || !Number.isFinite(x) ? null : +x.toFixed(2));
const statesOf = (lvl, nStored) => (lvl === nStored ? [...Array(nStored).keys()] : [lvl]);

export function report(dir, markets = MARKETS) {
  const P = {}; for (const m of markets) { const rd = (k, Tp) => { const b = fs.readFileSync(path.join(dir, `${m}.${k}.bin`)); return new Tp(b.buffer, b.byteOffset, b.byteLength / Tp.BYTES_PER_ELEMENT); };
    P[m] = { n: rd('n', Uint32Array), ms: rd('ms', Float64Array), cm: rd('cm', Float64Array), meta: JSON.parse(fs.readFileSync(path.join(dir, `${m}.json`), 'utf8')) }; }
  const scopes = ['pool', ...markets], rows = { 0: [], 1: [] };
  const ms = new Float64Array(NM), cm = new Float64Array(NM);
  let tested = { 0: 0, 1: 0 };
  for (const pl of [0, 1]) for (const sc of scopes) { const list = sc === 'pool' ? markets : [sc];
    for (let rest = 0; rest < REST; rest++) for (let kl = 0; kl < 3; kl++) for (let cl = 0; cl < 3; cl++) for (let bl = 0; bl < 4; bl++) {
      ms.fill(0); cm.fill(0); let nI = 0, nO = 0;
      for (const m of list) { const A = P[m];
        for (const ks of statesOf(kl, 2)) for (const cs of statesOf(cl, 3)) for (const bs of statesOf(bl, 3)) {
          const c = pl * NCELL + cellIndex(ks, cs, bs, rest); const a = A.n[c * 2], b = A.n[c * 2 + 1]; if (!a && !b) continue;
          nI += a; nO += b; for (let k = 0; k < NM; k++) { ms[k] += A.ms[c * NM + k]; cm[k] += A.cm[c * NM + k]; } } }
      if (nI < 100) continue; tested[pl]++;
      const a = mstat(ms, 0, HM), b = mstat(ms, HM, NM); const net = Float64Array.from(ms, (x, k) => x - cm[k]);
      const an = mstat(net, 0, HM), bn = mstat(net, HM, NM);
      rows[pl].push({ sc, kl, cl, bl, rest, nI, nO, isMean: a.sum / nI, isT: a.t, oosMean: nO ? b.sum / nO : null, oosT: b.t,
        isNet: an.sum / nI, isNetT: an.t, oosNet: nO ? bn.sum / nO : null, oosNetT: bn.t });
    } }
  const name = (r) => { const v = decodeRest(r.rest); return { scope: r.sc, range: RANGES[v[0]], event: EVENTS[v[1]], window: WINDOWS[v[2]], key: KEYS[r.kl], call: CALLS[r.cl], box: BOXES[r.bl],
    conf: CONFS[v[3]], entry: ENTRIES[v[4]], stop: STOPS[v[5]], exit: EXITS[v[6]],
    n1014: r.nI, mean1014: r4(r.isMean), t1014: r2(r.isT), net1014: r4(r.isNet), n1519: r.nO, mean1519: r4(r.oosMean), t1519: r2(r.oosT), net1519: r4(r.oosNet), netT1519: r2(r.oosNetT),
    holm: r.holm == null ? null : +r.holm.toPrecision(3) }; };
  const bar = (R, net) => {
    const m1 = (r) => (net ? r.isNet : r.isMean), t1 = (r) => (net ? r.isNetT : r.isT), m2 = (r) => (net ? r.oosNet : r.oosMean), t2 = (r) => (net ? r.oosNetT : r.oosT);
    const disc = R.filter((r) => m1(r) > 0 && t1(r) >= 2);
    const pv = disc.map((r) => (r.nO >= 100 && m2(r) > 0 ? p1(t2(r), NM - HM - 1) : 1)); const adj = K.holm(pv);
    disc.forEach((r, i) => { r.holm = adj[i]; });
    const raw = disc.filter((r) => r.nO >= 100 && m2(r) > 0 && t2(r) >= 2), conf = raw.filter((r) => r.holm < 0.05);
    return { tested: R.length, discovery: disc.length, discoveryExpected: +(R.length * 0.0228).toFixed(1), rawConfirmed: raw.length,
      rawExpected: +(disc.length * 0.0228).toFixed(1), confirmed: conf.length,
      confirmedList: conf.sort((a, b) => t2(b) - t2(a)).slice(0, 60).map(name), rawList: raw.sort((a, b) => t2(b) - t2(a)).slice(0, 40).map(name),
      topDiscovery: disc.sort((a, b) => t1(b) - t1(a)).slice(0, 25).map(name) };
  };
  const real = bar(rows[0], false), placebo = bar(rows[1], false), realNet = bar(rows[0], true), placeboNet = bar(rows[1], true);
  // marginals: pooled real trades, exit 2R, each factor level over all other levels
  const marg = {}; const restNames = [['range', RANGES], ['event', EVENTS], ['window', WINDOWS], ['conf', CONFS], ['entry', ENTRIES], ['stop', STOPS]];
  const ctxNames = [['key', ['yes', 'no']], ['call', ['with', 'against', 'zero']], ['box', ['inside', 'outWith', 'outAgainst']]];
  const addUp = (pred) => { let nI = 0, nO = 0, sI = 0, sO = 0, cO = 0;
    for (let c = 0; c < NCELL; c++) { const rest = c % REST, ctx = (c - rest) / REST, v = decodeRest(rest); if (v[6] !== 1) continue;
      const cx = [Math.floor(ctx / 9), Math.floor(ctx / 3) % 3, ctx % 3]; if (!pred(v, cx)) continue;
      for (const m of markets) { const A = P[m]; nI += A.n[c * 2]; nO += A.n[c * 2 + 1];
        for (let k = 0; k < NM; k++) { if (k < HM) sI += A.ms[c * NM + k]; else { sO += A.ms[c * NM + k]; cO += A.cm[c * NM + k]; } } } }
    return { n1014: nI, mean1014: r4(sI / nI), n1519: nO, mean1519: r4(sO / nO), net1519: r4((sO - cO) / nO) }; };
  restNames.forEach(([nm, lv], di) => { marg[nm] = {}; lv.forEach((l, li) => { marg[nm][l] = addUp((v) => v[di] === li); }); });
  ctxNames.forEach(([nm, lv], di) => { marg[nm] = {}; lv.forEach((l, li) => { marg[nm][l] = addUp((v, cx) => cx[di] === li); }); });
  const verdict = real.confirmed === 0 ? 'FAIL' : real.confirmed > placebo.confirmed ? 'PASS' : 'INCONCLUSIVE';
  const meta = Object.fromEntries(markets.map((m) => [m, P[m].meta]));
  return { real, placebo, realNet, placeboNet, marg, verdict, meta };
}

const main = process.argv[1] === fileURLToPath(import.meta.url);
if (main) {
  const [cmd, a, b] = process.argv.slice(2);
  if (cmd === 'market') { const t0 = Date.now(); const { meta } = runMarket(a, { dir: b }); console.log(JSON.stringify(meta), ((Date.now() - t0) / 1000).toFixed(0) + 's'); }
  else if (cmd === 'cut') { const r = cutTest(a); fs.mkdirSync(b, { recursive: true }); fs.writeFileSync(path.join(b, `${a}.cut.json`), JSON.stringify(r)); console.log(a, JSON.stringify(r)); }
  else if (cmd === 'report') { const R = report(a);
    const cut = MARKETS.flatMap((m) => { const f = path.join(a, `${m}.cut.json`); return fs.existsSync(f) ? JSON.parse(fs.readFileSync(f, 'utf8')).map((c) => ({ market: m, ...c })) : []; });
    const list = R.real.confirmedList.length ? R.real.confirmedList : R.real.rawList.length ? R.real.rawList : R.real.topDiscovery;
    const best = list[0] || null, f = (x) => (x >= 0 ? '+' : '-') + Math.abs(x).toFixed(3);
    const bestTxt = best ? `best ${best.scope} ${best.range} ${best.event} ${best.window} key ${best.key} call ${best.call} box ${best.box} ${best.conf} ${best.entry}/${best.stop} ${best.exit}: ${f(best.mean1519)}R a trade in 2015-19, n ${best.n1519.toLocaleString('en-US')}, month t ${best.t1519.toFixed(2)}` : 'no cell';
    const headline = `${R.verdict}: ${R.real.confirmed} of ${R.real.tested.toLocaleString('en-US')} cells confirmed before costs after Holm (placebo ${R.placebo.confirmed}); ${bestTxt}`;
    const out = { study: 'grid6-session-range', built: '2026-11-23', verdict: R.verdict, headline, basis: 'judged before costs (pre-registered); after costs beside',
      window: 'fills 2010-01-01 to 2019-12-31; discovery 2010-14, confirmation 2015-19', markets: MARKETS,
      factors: { RANGES, EVENTS, WINDOWS, KEYS, CALLS, BOXES, CONFS, ENTRIES, STOPS, EXITS },
      real: R.real, placebo: { ...R.placebo, rawList: R.placebo.rawList.slice(0, 15), topDiscovery: R.placebo.topDiscovery.slice(0, 10) },
      realNet: { ...R.realNet, topDiscovery: R.realNet.topDiscovery.slice(0, 10) }, placeboNet: { ...R.placeboNet, topDiscovery: [], rawList: R.placeboNet.rawList.slice(0, 10) },
      best, marginals2R: R.marg, meta: R.meta, cut };
    fs.writeFileSync(path.join(HERE, 'result.json'), JSON.stringify(out, null, 1) + '\n'); console.log(headline);
    console.log(JSON.stringify({ verdict: R.verdict, real: { ...R.real, confirmedList: undefined, rawList: undefined, topDiscovery: undefined }, placebo: { ...R.placebo, confirmedList: undefined, rawList: undefined, topDiscovery: undefined }, marg: R.marg }, null, 1)); }
  else console.log('usage: run.mjs market <m> <dir> | cut <m> <dir> | report <dir>');
}
