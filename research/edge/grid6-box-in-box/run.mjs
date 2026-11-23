// research/edge/grid6-box-in-box/run.mjs - grid 6 of PREREGISTRATION.md (23 Nov 2026): boxes inside boxes down the timeframe
// ladder. A box = edgekit boxesHL(T, 2) (last swing low to last swing high, closed out by a close beyond it) on the top, middle
// and bottom timeframe of a chain (D1 -> H4 -> H1, H4 -> H1 -> M15, H1 -> M15 -> M5). The trade side is the top box's last
// close-out; factors: top position, middle close-out with the side, bottom trigger (out / false break), bottom size against the
// middle box, session, entry, stop, exit; per market and pooled, with a side-flipped placebo.
//   node --max-old-space-size=6000 research/edge/grid6-box-in-box/run.mjs market <m> <dir>   one market -> <dir>/<m>.*.bin, <m>.json
//   node research/edge/grid6-box-in-box/run.mjs cut <m> <dir>                                  cut test -> <dir>/<m>.cut.json
//   node research/edge/grid6-box-in-box/run.mjs report <dir>                                   pool, the bar -> result.json
// Research only: reads the edgekit candle cache; imports edgekit, combo-grid-3 (frames), combo-grid-2 (COSTS, exclusions) and
// dom-trade-through (findFill, manage, startIdx), none edited.
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import * as K from '../_lib/edgekit.mjs';
import { frames } from '../combo-grid-3/run.mjs';
import { COSTS, exclusions } from '../combo-grid-2/run.mjs';
import { findFill, manage, startIdx } from '../dom-trade-through/run.mjs';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const y = (n) => Date.UTC(n, 0, 1) / 1000;
export const FROM = y(2010), TO = y(2020), HALF = y(2015), NM = 120, HM = 60;
export const MARKETS = ['xau', 'eurusd', 'gbpusd', 'usdjpy', 'audusd'];
export const CHAINS = [['1d', '4h', '1h'], ['4h', '1h', '15m'], ['1h', '15m', '5m']];
export const CNAME = ['D1-H4-H1', 'H4-H1-M15', 'H1-M15-M5'];
export const CAPS = [5 * 86400, 2 * 86400, 86400];
const SEC = { '1h': 3600, '15m': 900, '5m': 300, '4h': 14400 };
export const TOPS = ['inside', 'outside'], MIDS = ['yes', 'no'], TRIGS = ['out', 'false'], SIZES = ['small', 'big'];
export const SESS = ['london', 'ny', 'other'], ENTRIES = ['mkt', 'lim'], STOPS = ['bot', 'mid'];
export const ES = ENTRIES.flatMap((e) => STOPS.map((s) => e + '/' + s));
export const EXITS = ['1R', '2R', '3R', 'trail', 'top'];
const XSLOT = [0, 1, 2, 6, 5];                               // manage() R slots: 1R 2R 3R trail opp(= top)
export const BACK_IN = 6, LIFE = 24;
export const DIMS = [CHAINS.length, 2, 2, 2, 2, 3, ES.length, EXITS.length];
export const NCELL = DIMS.reduce((a, b) => a * b, 1);       // 2,880 stored cells
export const cellIndex = (v) => v.reduce((a, x, i) => a * DIMS[i] + x, 0);
export const ANYDIMS = [1, 2, 4, 5];                         // dims with an 'any' level in the report
export const NVIEW = DIMS.reduce((a, d, i) => a * (ANYDIMS.includes(i) ? d + 1 : d), 1); // 12,960 cells a scope
export const monthIdx = (t) => { const d = new Date(t * 1000); return (d.getUTCFullYear() - 2010) * 12 + d.getUTCMonth(); };
const sessOf = (ts) => { const h = new Date(ts * 1000).getUTCHours(); return h >= 7 && h < 12 ? 0 : h >= 12 && h < 17 ? 1 : 2; };

// ---- boxes and their close-outs (closed candles only) ----------------------------------------------------------------
function closeOuts(T) { // [{ bt, dir, hi, lo }] sorted by bt
  if (T._co) return T._co;
  return (T._co = K.boxesHL(T, 2).filter((b) => b.dir && b.bi >= 0).map((b) => ({ bt: b.bt, dir: b.dir, hi: b.hi, lo: b.lo, bi: b.bi })).sort((a, b) => a.bt - b.bt));
}
export function lastBy(list, ts) { let lo = 0, hi = list.length; while (lo < hi) { const m = (lo + hi) >> 1; if (list[m].bt <= ts) lo = m + 1; else hi = m; } return lo ? list[lo - 1] : null; }

// every signal of a market: { ch, d, ts, trig, top {hi,lo,dir}, mid {hi,lo,dir}|null, box {hi,lo}, edge, ext, c0, topPos, midW, size, sess }
export function signals(F, { from = FROM, to = TO } = {}) {
  const out = [];
  for (let ch = 0; ch < CHAINS.length; ch++) {
    const [tt, mt, bt] = CHAINS[ch], TOP = closeOuts(F[tt]), MID = closeOuts(F[mt]), B = F[bt];
    const add = (trig, d, j, box, edge, ext) => {
      const ts = B[j].e; if (ts < from - 3 * 86400 || ts >= to) return;
      const top = lastBy(TOP, ts); if (!top || top.dir !== d) return;
      const mid = lastBy(MID, ts), c0 = B[j].c;
      const midW = mid ? mid.hi - mid.lo : 0, size = midW > 0 && box.hi - box.lo < midW / 3 ? 0 : 1;
      out.push({ ch, d, ts, j, trig, top, mid, box, edge, ext, c0, topPos: c0 >= top.lo && c0 <= top.hi ? 0 : 1,
        midYes: mid && mid.dir === d ? 0 : 1, size, sess: sessOf(ts) });
    };
    for (const b of closeOuts(B)) {
      const box = { hi: b.hi, lo: b.lo };
      // out: the bottom box closes out; the side must be the top's
      add(0, b.dir, b.bi, box, b.dir > 0 ? b.hi : b.lo, null);
      // false: broke against the trade side, closes back inside past the broken edge within BACK_IN candles
      const d = -b.dir; let ext = b.dir > 0 ? -Infinity : Infinity;
      for (let m = b.bi; m <= b.bi + BACK_IN && m < B.length; m++) {
        ext = b.dir > 0 ? Math.max(ext, B[m].h) : Math.min(ext, B[m].l);
        if (m > b.bi && (b.dir > 0 ? B[m].c < b.hi : B[m].c > b.lo)) { add(1, d, m, box, b.dir > 0 ? b.hi : b.lo, ext); break; }
      }
    }
  }
  return out.sort((a, b) => a.ts - b.ts || a.ch - b.ch);
}

// ---- trades -------------------------------------------------------------------------------------------------------------
// one order (real or placebo): returns { t, risk, R (5 exits) } or null
export function trade(M5, s, type, entry, stop, ts, exp, oppR, cost, cap) {
  let fi, fill, full;
  if (type === 'mkt') { fi = startIdx(M5, ts); if (fi >= M5.length) return null; fill = M5[fi].o; full = true; }
  else { const f = findFill(M5, s, entry, stop, ts, exp, 'through', cost / 2); if (!f) return null; fi = f.i; fill = f.fill; full = false; }
  const r = manage(M5, s, fi, fill, stop, cap, full, oppR); if (!r || !(r.risk >= cost)) return null;
  if (!(s * (fill - stop) > 0)) throw new Error('stop on the wrong side');
  return { t: r.t, risk: r.risk, R: XSLOT.map((k) => r.R[k]) };
}
export function runMarket(market, { dir } = {}) {
  const M5 = K.load(market, '5m', { from: y(2009), to: TO }); const F = frames(M5);
  const cost = COSTS[market], X = exclusions(market);
  const inBad = (t) => X.some(([a, b]) => t >= a && t <= b);
  const sigs = signals(F);
  const acc = { n: new Uint32Array(NCELL * 2 * 2), ms: new Float64Array(NCELL * 2 * NM), cm: new Float64Array(NCELL * 2 * NM) }; // [placebo][cell]
  let ntr = 0, npl = 0, bad = 0;
  for (const sg of sigs) {
    const d = sg.d, buf = cost / 2, ts = sg.ts, B = F[CHAINS[sg.ch][2]], exp = ts + LIFE * SEC[CHAINS[sg.ch][2]], cap = CAPS[sg.ch];
    const botS = sg.trig === 0 ? (d > 0 ? sg.box.lo - buf : sg.box.hi + buf) : (d > 0 ? sg.ext - buf : sg.ext + buf);
    const midS = sg.mid ? (d > 0 ? sg.mid.lo - buf : sg.mid.hi + buf) : null;
    const tgt = d > 0 ? sg.top.hi : sg.top.lo;
    for (let ei = 0; ei < 2; ei++) for (let si = 0; si < 2; si++) {
      const stop = si === 0 ? botS : midS; if (stop == null) continue;
      const entry = ei === 0 ? null : sg.edge, type = ei === 0 ? 'mkt' : 'lim';
      const ref = entry ?? sg.c0; if (!(d * (ref - stop) >= 2 * cost)) continue;
      let oppR = (d * (tgt - ref)) / (d * (ref - stop)); if (!(oppR >= 1)) oppR = 2;
      for (let pl = 0; pl < 2; pl++) {
        const s = pl ? -d : d, en = entry == null ? null : pl ? 2 * sg.c0 - entry : entry, sp = pl ? 2 * sg.c0 - stop : stop;
        const r = trade(M5, s, type, en, sp, ts, exp, oppR, cost, cap);
        if (!r || r.t < FROM || r.t >= TO) continue; if (inBad(r.t)) { bad++; continue; }
        pl ? npl++ : ntr++;
        const m = monthIdx(r.t), half = r.t >= HALF ? 1 : 0, cr = cost / r.risk;
        for (let x = 0; x < EXITS.length; x++) {
          const c = pl * NCELL + cellIndex([sg.ch, sg.topPos, sg.midYes, sg.trig, sg.size, sg.sess, ei * 2 + si, x]);
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
export const sigKey = (s) => [s.ch, s.d, s.ts, s.trig, s.top.hi, s.top.lo, s.mid && s.mid.hi, s.mid && s.mid.lo, s.box.hi, s.box.lo, s.edge, s.ext, s.c0, s.topPos, s.midYes, s.size, s.sess].join('|');
export function cutTest(market, cuts = ['2011-06-15', '2013-02-20', '2015-09-09', '2017-04-12', '2019-08-21']) {
  const M5 = K.load(market, '5m', { from: y(2009), to: TO });
  const full = signals(frames(M5)); const out = [];
  for (const c of cuts) { const C = Date.parse(c + 'T13:37:00Z') / 1000;
    const part = signals(frames(M5.filter((b) => b.e <= C)), { to: C + 1 });
    const A = new Set(full.filter((s) => s.ts <= C).map(sigKey)), B = new Set(part.filter((s) => s.ts <= C).map(sigKey));
    let miss = 0, extra = 0; for (const k of A) if (!B.has(k)) miss++; for (const k of B) if (!A.has(k)) extra++;
    out.push({ cut: c, signals: A.size, missing: miss, extra }); }
  return out;
}

// ---- report -------------------------------------------------------------------------------------------------------------
function mstat(ms, a, b) { const n = b - a; let s = 0, q = 0; for (let m = a; m < b; m++) { s += ms[m]; q += ms[m] * ms[m]; }
  const mean = s / n, sd = Math.sqrt(Math.max(0, (q - n * mean * mean) / (n - 1))); return { sum: s, t: sd > 0 ? mean / (sd / Math.sqrt(n)) : 0 }; }
const p1 = (t, df) => { const p = K.pFromT(t, df); return p == null ? 1 : t > 0 ? p / 2 : 1 - p / 2; };
const r4 = (x) => (x == null || !Number.isFinite(x) ? null : +x.toFixed(4)), r2 = (x) => (x == null || !Number.isFinite(x) ? null : +x.toFixed(2));
const LV = [CNAME, TOPS, MIDS, TRIGS, SIZES, SESS, ES, EXITS];
const FN = ['chain', 'top', 'mid', 'trig', 'size', 'sess', 'es', 'exit'];
// every view: a vector where an ANYDIMS entry may be DIMS[i] (= any); its raw cells
export function views() {
  const out = [];
  const rec = (i, v) => { if (i === DIMS.length) { out.push(v.slice()); return; }
    const top = ANYDIMS.includes(i) ? DIMS[i] : DIMS[i] - 1; for (let x = 0; x <= top; x++) { v[i] = x; rec(i + 1, v); } };
  rec(0, []); return out;
}
export function rawCells(v) {
  let list = [[]];
  v.forEach((x, i) => { const opts = x === DIMS[i] ? [...Array(DIMS[i]).keys()] : [x]; list = list.flatMap((p) => opts.map((o) => [...p, o])); });
  return list.map(cellIndex);
}
export function report(dir, markets = MARKETS) {
  const P = {}; for (const m of markets) { const rd = (k, Tp) => { const b = fs.readFileSync(path.join(dir, `${m}.${k}.bin`)); return new Tp(b.buffer, b.byteOffset, b.byteLength / Tp.BYTES_PER_ELEMENT); };
    P[m] = { n: rd('n', Uint32Array), ms: rd('ms', Float64Array), cm: rd('cm', Float64Array), meta: JSON.parse(fs.readFileSync(path.join(dir, `${m}.json`), 'utf8')) }; }
  const scopes = ['pool', ...markets], rows = { 0: [], 1: [] }, V = views().map((v) => ({ v, cells: rawCells(v) }));
  const ms = new Float64Array(NM), cm = new Float64Array(NM);
  for (const pl of [0, 1]) for (const sc of scopes) { const list = sc === 'pool' ? markets : [sc];
    for (const { v, cells } of V) {
      ms.fill(0); cm.fill(0); let nI = 0, nO = 0;
      for (const m of list) { const A = P[m]; for (const c0 of cells) { const c = pl * NCELL + c0;
        nI += A.n[c * 2]; nO += A.n[c * 2 + 1]; for (let k = 0; k < NM; k++) { ms[k] += A.ms[c * NM + k]; cm[k] += A.cm[c * NM + k]; } } }
      if (nI < 100) continue;
      const a = mstat(ms, 0, HM), b = mstat(ms, HM, NM); const net = Float64Array.from(ms, (x, k) => x - cm[k]);
      const an = mstat(net, 0, HM), bn = mstat(net, HM, NM);
      rows[pl].push({ sc, v, nI, nO, isMean: a.sum / nI, isT: a.t, oosMean: nO ? b.sum / nO : null, oosT: b.t,
        isNet: an.sum / nI, isNetT: an.t, oosNet: nO ? bn.sum / nO : null, oosNetT: bn.t });
    } }
  const name = (r) => { const o = { scope: r.sc }; r.v.forEach((x, i) => { o[FN[i]] = x === DIMS[i] ? 'any' : LV[i][x]; });
    return { ...o, n1014: r.nI, mean1014: r4(r.isMean), t1014: r2(r.isT), n1519: r.nO, mean1519: r4(r.oosMean), t1519: r2(r.oosT),
      net1519: r4(r.oosNet), netT1519: r2(r.oosNetT), holm: r.holm == null ? null : +r.holm.toPrecision(3) }; };
  const bar = (R, net) => {
    const m1 = (r) => (net ? r.isNet : r.isMean), t1 = (r) => (net ? r.isNetT : r.isT), m2 = (r) => (net ? r.oosNet : r.oosMean), t2 = (r) => (net ? r.oosNetT : r.oosT);
    for (const r of R) r.holm = null;
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
  // marginal reading per factor level: pooled, every trade once, exit 2R, real trades
  const marg = {};
  [0, 1, 2, 3, 4, 5, 6].forEach((di) => { marg[FN[di]] = {}; LV[di].forEach((l, li) => { let nI = 0, nO = 0, sI = 0, sO = 0, cO = 0;
    for (let c = 0; c < NCELL; c++) { const v = decode(c); if (v[7] !== 1 || v[di] !== li) continue;
      for (const m of markets) { const A = P[m]; nI += A.n[c * 2]; nO += A.n[c * 2 + 1];
        for (let k = 0; k < NM; k++) { if (k < HM) sI += A.ms[c * NM + k]; else { sO += A.ms[c * NM + k]; cO += A.cm[c * NM + k]; } } } }
    marg[FN[di]][l] = { n1014: nI, mean1014: r4(sI / nI), n1519: nO, mean1519: r4(sO / nO), net1519: r4((sO - cO) / nO) }; }); });
  const verdict = real.confirmed === 0 ? 'FAIL' : real.confirmed > placebo.confirmed ? 'PASS' : 'INCONCLUSIVE';
  const meta = Object.fromEntries(markets.map((m) => [m, P[m].meta]));
  return { real, placebo, realNet, placeboNet, marg, verdict, meta };
}
function decode(c) { const v = []; for (let i = DIMS.length - 1; i >= 0; i--) { v[i] = c % DIMS[i]; c = (c - v[i]) / DIMS[i]; } return v; }

const main = process.argv[1] === fileURLToPath(import.meta.url);
if (main) {
  const [cmd, a, b] = process.argv.slice(2);
  if (cmd === 'market') { const t0 = Date.now(); const { meta } = runMarket(a, { dir: b }); console.log(JSON.stringify(meta), ((Date.now() - t0) / 1000).toFixed(0) + 's'); }
  else if (cmd === 'cut') { const r = cutTest(a); fs.mkdirSync(b, { recursive: true }); fs.writeFileSync(path.join(b, `${a}.cut.json`), JSON.stringify(r)); console.log(a, JSON.stringify(r)); }
  else if (cmd === 'report') { const R = report(a); fs.writeFileSync(path.join(a, 'report.json'), JSON.stringify(R, null, 1));
    const cut = MARKETS.flatMap((m) => { const f = path.join(a, `${m}.cut.json`); return fs.existsSync(f) ? JSON.parse(fs.readFileSync(f, 'utf8')).map((c) => ({ market: m, ...c })) : []; });
    const list = R.real.confirmedList.length ? R.real.confirmedList : R.real.rawList.length ? R.real.rawList : R.real.topDiscovery;
    const best = list[0] || null, f = (x) => (x >= 0 ? '+' : '-') + Math.abs(x).toFixed(3);
    const bestTxt = best ? `best ${best.scope} ${best.chain} ${best.trig} ${best.es} ${best.exit}: ${f(best.mean1519)}R a trade in 2015-19, n ${best.n1519.toLocaleString('en-US')}, month t ${best.t1519.toFixed(2)}` : 'no cell';
    const headline = `${R.verdict}: ${R.real.confirmed} of ${R.real.tested.toLocaleString('en-US')} cells confirmed before costs after Holm (placebo ${R.placebo.confirmed}); ${bestTxt}`;
    const out = { study: 'grid6-box-in-box', built: '2026-11-23', verdict: R.verdict, headline, basis: 'judged before costs (pre-registered); after costs beside',
      window: 'fills 2010-01-01 to 2019-12-31; discovery 2010-14, confirmation 2015-19', markets: MARKETS,
      factors: { CHAINS: CNAME, TOPS, MIDS, TRIGS, SIZES, SESS, ES, EXITS },
      real: R.real, placebo: { ...R.placebo, rawList: R.placebo.rawList.slice(0, 15), topDiscovery: R.placebo.topDiscovery.slice(0, 10) },
      realNet: { ...R.realNet, topDiscovery: R.realNet.topDiscovery.slice(0, 10) }, placeboNet: { ...R.placeboNet, topDiscovery: [], rawList: R.placeboNet.rawList.slice(0, 10) },
      best, marginals2R: R.marg, meta: R.meta, cut };
    fs.writeFileSync(path.join(HERE, 'result.json'), JSON.stringify(out, null, 1) + '\n'); console.log(headline);
    console.log(JSON.stringify({ verdict: R.verdict, real: { ...R.real, confirmedList: undefined, rawList: undefined, topDiscovery: undefined }, placebo: { ...R.placebo, confirmedList: undefined, rawList: undefined, topDiscovery: undefined } }, null, 1)); }
  else console.log('usage: run.mjs market <m> <dir> | cut <m> <dir> | report <dir>');
}
