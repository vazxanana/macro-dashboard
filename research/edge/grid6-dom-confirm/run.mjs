// research/edge/grid6-dom-confirm/run.mjs - grid 6 of PREREGISTRATION.md (23 Nov 2026): the dominant (DOM) zone with a
// lower-timeframe confirmation and a MARKET entry at the next 5-minute open (no resting limit, so no touch fills).
//   node --max-old-space-size=8000 research/edge/grid6-dom-confirm/run.mjs market <m> <dir>   one market -> <dir>/<m>.json
//   node research/edge/grid6-dom-confirm/run.mjs report <dir>                                   pool, the bar -> result.json
// Research only: reads the edgekit candle cache, imports combo-grid-3 / combo-grid-2 / council direction() and engulfAt;
// writes <dir> and its own result.json. Places nothing.
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import * as K from '../_lib/edgekit.mjs';
import { frames, signalsFor, multi, buildZones, weekly, NONE } from '../combo-grid-3/run.mjs';
import { COSTS, exclusions } from '../combo-grid-2/run.mjs';
import { engulfAt, direction } from '../../../council/eg-methods.mjs';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const y = (n) => Date.UTC(n, 0, 1) / 1000;
export const FROM = y(2010), TO = y(2020), HALF = y(2015);
export const MARKETS = ['xau', 'eurusd', 'gbpusd', 'usdjpy', 'audusd'];
export const CHAINS = [['1d', '4h'], ['1d', '1h'], ['4h', '1h'], ['4h', '15m'], ['1h', '15m'], ['1h', '5m']];
export const VISITS = [1, 2];
export const CONFS = ['none', 'eg', 'bo', 'box', 'rej'];
export const MSNR = ['with', 'against', 'any'];
export const SESS = ['london', 'ny', 'other', 'any'];
export const STOPS = ['zone', 'swing'];
export const EXITS = ['1R', '2R', '3R', 'trail'];
const XSLOT = [0, 1, 2, 6]; // multi() R slots: 1R 2R 3R trail
export const NCELL = CHAINS.length * VISITS.length * CONFS.length * MSNR.length * SESS.length * STOPS.length * EXITS.length;
export const NM = 120; // 2010-01 .. 2019-12
export const W = 12, WICK = 0.6;
const CAP = { '1d': 10 * 86400, '4h': 5 * 86400, '1h': 2 * 86400 };
export const cellIndex = (ch, v, cf, ms, se, st, x) => ((((((ch * 2 + v) * 5 + cf) * 3 + ms) * 4 + se) * 2 + st) * 4 + x);
export function cellName(c) {
  const x = c % 4; c = (c - x) / 4; const st = c % 2; c = (c - st) / 2; const se = c % 4; c = (c - se) / 4; const ms = c % 3; c = (c - ms) / 3;
  const cf = c % 5; c = (c - cf) / 5; const v = c % 2; const ch = (c - v) / 2;
  return { chain: CHAINS[ch].join('>'), visit: VISITS[v], conf: CONFS[cf], msnr: MSNR[ms], session: SESS[se], stop: STOPS[st], exit: EXITS[x] };
}
export const sessionOf = (t) => { const h = new Date(t * 1000).getUTCHours(); return h >= 7 && h < 12 ? 0 : h >= 12 && h < 21 ? 1 : 2; };
export const monthIdx = (t) => { const d = new Date(t * 1000); return (d.getUTCFullYear() - 2010) * 12 + d.getUTCMonth(); };

export function atr14(B) { const a = new Float64Array(B.length); let s = 0; const tr = (i) => Math.max(B[i].h - B[i].l, Math.abs(B[i].h - B[i - 1].c), Math.abs(B[i].l - B[i - 1].c));
  for (let i = 1; i < B.length; i++) { s += tr(i); if (i > 14) s -= tr(i - 14); a[i] = i >= 14 ? s / 14 : 0; } return a; }

// a rejection candle of side d at zone z: it trades into the zone, the wick on the zone's side is over 60 % of its range,
// and it closes back out of the zone on the side of the trade
export function isRejection(b, z, d) {
  const rg = b.h - b.l; if (!(rg > 0)) return false;
  if (d > 0) return b.l <= z.top && Math.min(b.o, b.c) - b.l > WICK * rg && b.c > z.top;
  return b.h >= z.bot && b.h - Math.max(b.o, b.c) > WICK * rg && b.c < z.bot;
}

// per-timeframe lookups (each output at candle j depends on candles 0..j only: edgekit / eg-methods guarantees)
export function lookups(T) {
  const ev = new Map(); for (const e of K.structure(T, 2).events) ev.set(e.i, e.dir);
  const bx = new Map(); for (const b of K.boxesHL(T, 2)) if (b.dir && b.bi >= 0) bx.set(b.bi, b.dir);
  const C = T.map((b) => ({ time: b.t, open: b.o, high: b.h, low: b.l, close: b.c }));
  return { ev, bx, eg: (j) => engulfAt(C, j, 3) };
}

// the confirmations of one visit: for each kind, the first candle index j (or -1) and the extreme from the touch to j.
// Reads T[k0 .. j] only; the search ends at a close beyond the zone's far side, the zone's end or after W candles.
export function confirmations(T, lk, z, k0) {
  const d = z.d, out = CONFS.map(() => null); let ext = d > 0 ? Infinity : -Infinity, left = CONFS.length;
  for (let j = k0; j < T.length && j < k0 + W && T[j].t < z.end && left; j++) {
    const b = T[j];
    if (d > 0 ? b.c < z.bot : b.c > z.top) break; // closed beyond the far side: the visit ends with no trade
    ext = d > 0 ? Math.min(ext, b.l) : Math.max(ext, b.h);
    const set = (k) => { if (!out[k]) { out[k] = { j, ext }; left--; } };
    if (j === k0) set(0);
    if (!out[1]) { const e = lk.eg(j); if (e && e.dir === d) set(1); }
    if (!out[2] && lk.ev.get(j) === d) set(2);
    if (!out[3] && lk.bx.get(j) === d) set(3);
    if (!out[4] && isRejection(b, z, d)) set(4);
  }
  return out;
}

// the Daily MSNR call known after each closed D1 candle (as combo-grid-3 msnrCalls)
export function dailyCalls(F) {
  const D = F['1d'], Wk = F['1w'] || weekly(D);
  const keyOf = (t) => { const k = K.barAt(Wk, t); return k < 0 ? t : Wk[k].t; };
  return direction(D.map((b) => ({ time: b.t, open: b.o, high: b.h, low: b.l, close: b.c })), keyOf, 604800).call;
}

function inBad(X, t) { let lo = 0, hi = X.length; while (lo < hi) { const m = (lo + hi) >> 1; if (X[m][0] <= t) lo = m + 1; else hi = m; } return lo > 0 && t <= X[lo - 1][1]; }

// every trade of one market; acc collects month sums per cell (before costs and the cost share)
export function runMarket(market, M5, F, { from = FROM, to = TO, onTrade } = {}) {
  const cost = COSTS[market], X = exclusions(market), calls = dailyCalls(F), D = F['1d'];
  const acc = { n: new Uint32Array(NCELL * 2), msB: new Float64Array(NCELL * NM), msC: new Float64Array(NCELL * NM),
    pn: new Uint32Array(NCELL * 2), pB: new Float64Array(NCELL * NM), pC: new Float64Array(NCELL * NM) };
  let trades = 0, visits = 0, wrong = 0;
  CHAINS.forEach(([tfL, tfT], ch) => {
    const L = F[tfL], T = F[tfT], A = atr14(L), lk = lookups(T), cap = CAP[tfL];
    const Zc = { [tfL + 'dom']: buildZones('dom', L) };
    for (const sg of signalsFor(F, tfL, tfT, 'dom', Zc, from)) {
      if (sg.trig !== NONE) continue; visits++;
      const z = sg.z, d = z.d, v = sg.visit - 1, cf = confirmations(T, lk, z, sg.k0);
      cf.forEach((c, ci) => {
        if (!c) return;
        const ts = T[c.j].e; if (ts >= to) return;
        const li = K.closedCount(L, ts) - 1; if (li < 15) return;
        const di = K.closedCount(D, ts) - 1, call = di >= 0 ? calls[di] : 0;
        const mss = [2]; if (call === d) mss.push(0); else if (call === -d) mss.push(1);
        const ses = [3, sessionOf(ts)];
        const ref = T[c.j].c;
        const stops = [d > 0 ? z.bot - cost / 2 - 0.25 * A[li] : z.top + cost / 2 + 0.25 * A[li], d > 0 ? c.ext - cost / 2 : c.ext + cost / 2];
        stops.forEach((stop, st) => {
          const dist = d * (ref - stop); if (!(dist > 0)) return;
          const r = multi(M5, d, ref, stop, 'mkt', ts, null, 2, null, cap, null);
          if (!r || r.risk < 2 * cost || r.t < from || r.t >= to || inBad(X, r.t)) return;
          if (!(r.risk > 0) || !(d * (ref - stop) > 0)) { wrong++; throw new Error('stop on the wrong side'); }
          const mi = monthIdx(r.t), h = r.t >= HALF ? 1 : 0, cr = cost / r.risk; trades++;
          if (onTrade) onTrade({ ch, v, cf: ci, ts, t: r.t, d, stop, risk: r.risk, R: XSLOT.map((k) => r.R[k]) });
          // the side-flipped placebo: same time, side reversed, the stop the same distance on the other side of ref
          const p = multi(M5, -d, ref, ref + d * dist, 'mkt', ts, null, 2, null, cap, null);
          const pok = p && p.risk >= 2 * cost && !inBad(X, p.t);
          for (const ms of mss) for (const se of ses) for (let x = 0; x < 4; x++) {
            const c0 = cellIndex(ch, v, ci, ms, se, st, x);
            acc.n[c0 * 2 + h]++; acc.msB[c0 * NM + mi] += r.R[XSLOT[x]]; acc.msC[c0 * NM + mi] += cr;
            if (pok) { const pm = monthIdx(p.t), ph = p.t >= HALF ? 1 : 0; acc.pn[c0 * 2 + ph]++; acc.pB[c0 * NM + pm] += p.R[XSLOT[x]]; acc.pC[c0 * NM + pm] += cost / p.risk; }
          }
        });
      });
    }
  });
  return { acc, trades, visits, wrong };
}

// ---- statistics -----------------------------------------------------------------------------------------------------
export function monthT(sums) { const n = sums.length, m = sums.reduce((a, b) => a + b, 0) / n;
  const sd = Math.sqrt(sums.reduce((a, b) => a + (b - m) ** 2, 0) / (n - 1)); return sd > 0 ? m / (sd / Math.sqrt(n)) : null; }
const p1 = (t, df) => (t == null ? 1 : t > 0 ? K.pFromT(t, df) / 2 : 1 - K.pFromT(t, df) / 2);
export function half(n, B, C, c, h) {
  const cnt = n[c * 2 + h], a = h * 60, sb = [], sa = []; let tb = 0, tc = 0;
  for (let m = a; m < a + 60; m++) { const b = B[c * NM + m], k = C[c * NM + m]; sb.push(b); sa.push(b - k); tb += b; tc += k; }
  const tB = monthT(sb), tA = monthT(sa);
  return { n: cnt, before: cnt ? +(tb / cnt).toFixed(4) : null, tBefore: tB == null ? null : +tB.toFixed(2), p: p1(tB, 59),
    after: cnt ? +((tb - tc) / cnt).toFixed(4) : null, tAfter: tA == null ? null : +tA.toFixed(2) };
}
const okHalf = (s) => s.n >= 100 && s.before > 0 && s.tBefore >= 2;
export function grade(n, B, C) {
  const cells = []; let eligible = 0;
  for (let c = 0; c < NCELL; c++) { const a = half(n, B, C, c, 0); if (a.n >= 100) eligible++; if (okHalf(a)) cells.push({ c, disc: a, conf: half(n, B, C, c, 1) }); }
  const holm = K.holm(cells.map((x) => x.conf.p));
  cells.forEach((x, i) => { x.holm = +holm[i].toPrecision(3); x.pass = okHalf(x.conf) && holm[i] < 0.05; });
  return { eligible, discovery: cells.length, passed: cells.filter((x) => x.pass), cells };
}

const b64 = (a) => Buffer.from(a.buffer).toString('base64');
const unb = (s, T) => { const b = Buffer.from(s, 'base64'); return new T(b.buffer, b.byteOffset, b.byteLength / T.BYTES_PER_ELEMENT); };

export function report(all) {
  const sum = (k, T) => { const o = new T(k === 'n' || k === 'pn' ? NCELL * 2 : NCELL * NM); for (const m of MARKETS) { const a = all[m][k]; for (let i = 0; i < o.length; i++) o[i] += a[i]; } return o; };
  const n = sum('n', Uint32Array), B = sum('msB', Float64Array), C = sum('msC', Float64Array);
  const pn = sum('pn', Uint32Array), pB = sum('pB', Float64Array), pC = sum('pC', Float64Array);
  const real = grade(n, B, C), plac = grade(pn, pB, pC);
  const verdict = real.passed.length === 0 ? 'FAIL' : plac.passed.length < real.passed.length ? 'PASS' : 'INCONCLUSIVE';
  const row = (x) => ({ ...cellName(x.c), h2010: x.disc, h2015: x.conf, holm: x.holm, pass: x.pass });
  const byConf = (list) => Object.fromEntries(CONFS.map((k) => [k, list.filter((x) => cellName(x.c).conf === k).length]));
  // a fixed view: msnr any, session any, the whole decade, per chain x confirmation x stop, first visit, trailing exit and 2R
  const whole = (c) => { const a = half(n, B, C, c, 0), b = half(n, B, C, c, 1); const cnt = a.n + b.n; const sb = [], sa = []; let tb = 0, tc = 0;
    for (let m = 0; m < NM; m++) { sb.push(B[c * NM + m]); sa.push(B[c * NM + m] - C[c * NM + m]); tb += B[c * NM + m]; tc += C[c * NM + m]; }
    return { n: cnt, before: cnt ? +(tb / cnt).toFixed(4) : null, tBefore: +(monthT(sb) ?? 0).toFixed(2), after: cnt ? +((tb - tc) / cnt).toFixed(4) : null, tAfter: +(monthT(sa) ?? 0).toFixed(2), d2010: a, d2015: b }; };
  const view = [];
  CHAINS.forEach((chn, ch) => CONFS.forEach((cf, ci) => STOPS.forEach((st, si) => {
    view.push({ chain: chn.join('>'), conf: cf, stop: st, trail: whole(cellIndex(ch, 0, ci, 2, 3, si, 3)), '2R': whole(cellIndex(ch, 0, ci, 2, 3, si, 1)) }); })));
  const top = [...real.cells].sort((a, b) => b.disc.tBefore - a.disc.tBefore).slice(0, 15).map(row);
  return { study: 'grid6-dom-confirm', built: '2026-11-23', basis: 'judged before costs (pre-registered); after costs beside',
    window: 'fills 2010-01-01 to 2019-12-31; discovery 2010-2014, confirmation 2015-2019', markets: MARKETS, cells: NCELL, verdict,
    real: { eligible: real.eligible, discovery: real.discovery, expectedDiscovery: +(real.eligible * 0.025).toFixed(1),
      expectedConfirmation: +(real.discovery * 0.025).toFixed(2), passed: real.passed.length, passedByConf: byConf(real.passed), discoveryByConf: byConf(real.cells), passes: real.passed.map(row),
      confirmedRaw: real.cells.filter((x) => okHalf(x.conf)).length },
    placebo: { eligible: plac.eligible, discovery: plac.discovery, passed: plac.passed.length, passedByConf: byConf(plac.passed), passes: plac.passed.map(row), confirmedRaw: plac.cells.filter((x) => okHalf(x.conf)).length },
    trades: Object.fromEntries(MARKETS.map((m) => [m, all[m].trades])), visits: Object.fromEntries(MARKETS.map((m) => [m, all[m].visits])),
    topDiscovery: top, view };
}

const main = process.argv[1] === fileURLToPath(import.meta.url);
if (main && process.argv[2] === 'market') {
  const m = process.argv[3], dir = process.argv[4]; fs.mkdirSync(dir, { recursive: true });
  const M5 = K.load(m, '5m', { from: FROM - 400 * 86400, to: TO + 15 * 86400 }), F = frames(M5);
  const o = runMarket(m, M5, F);
  fs.writeFileSync(path.join(dir, m + '.json'), JSON.stringify({ trades: o.trades, visits: o.visits, n: b64(o.acc.n), msB: b64(o.acc.msB), msC: b64(o.acc.msC), pn: b64(o.acc.pn), pB: b64(o.acc.pB), pC: b64(o.acc.pC) }));
  console.log(m, o.visits, 'visits,', o.trades, 'trades');
}
if (main && process.argv[2] === 'report') {
  const dir = process.argv[3], all = {};
  for (const m of MARKETS) { const j = JSON.parse(fs.readFileSync(path.join(dir, m + '.json'), 'utf8'));
    all[m] = { trades: j.trades, visits: j.visits, n: unb(j.n, Uint32Array), msB: unb(j.msB, Float64Array), msC: unb(j.msC, Float64Array), pn: unb(j.pn, Uint32Array), pB: unb(j.pB, Float64Array), pC: unb(j.pC, Float64Array) }; }
  const res = report(all);
  fs.writeFileSync(path.join(HERE, 'result.json'), JSON.stringify(res, null, 1) + '\n');
  console.log(JSON.stringify({ verdict: res.verdict, real: { ...res.real, passes: res.real.passes.slice(0, 5) }, placebo: res.placebo, top: res.topDiscovery.slice(0, 5) }, null, 1));
}
