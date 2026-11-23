// research/edge/grid6-msnr-ef-market/run.mjs - grid 6 of PREREGISTRATION.md (23 Nov 2026): failed engulfs (EF) as the signal,
// market entries. Zone timeframe (D1 / H4 / H1) x trigger (the EF candle itself / a return into the EF zone and an engulf, a
// structure break or a box close-out on a lower timeframe) x confirmation timeframe (one or two steps lower) x the Daily MSNR
// call (with / against / any) x visit (first / later / any) x session x stop (zone + 0.1 ATR / the confirmation swing) x exit
// (1R 2R 3R trail opp), per market and pooled, with a side-flipped placebo.
//   node --max-old-space-size=6000 research/edge/grid6-msnr-ef-market/run.mjs market <m> <dir>
//   node research/edge/grid6-msnr-ef-market/run.mjs cut <m> <dir>
//   node research/edge/grid6-msnr-ef-market/run.mjs report <dir>
// Research only: reads the edgekit candle cache; imports edgekit, council/eg-methods (zones, turnBack, engulfAt), grid5-msnr-box
// (h4Calls), combo-grid-3 (frames, exclusions), combo-grid-2 (COSTS) and dom-trade-through (manage, atr14, startIdx), none edited.
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import * as K from '../_lib/edgekit.mjs';
import { zones, turnBack, engulfAt } from '../../../council/eg-methods.mjs';
import { h4Calls } from '../grid5-msnr-box/run.mjs';
import { frames, exclusions } from '../combo-grid-3/run.mjs';
import { COSTS } from '../combo-grid-2/run.mjs';
import { manage, atr14, startIdx } from '../dom-trade-through/run.mjs';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const y = (n) => Date.UTC(n, 0, 1) / 1000;
export const FROM = y(2010), TO = y(2020), HALF = y(2015), NM = 120, HM = 60;
export const MARKETS = ['xau', 'eurusd', 'gbpusd', 'usdjpy', 'audusd'];
export const ZTF = ['1d', '4h', '1h'];
export const CONF = { '1d': ['4h', '1h'], '4h': ['1h', '15m'], '1h': ['15m', '5m'] };
export const TRIGS = ['ef', 'eg', 'sb', 'box'];
export const CALLS = ['with', 'against', 'any'];
export const VISITS = ['first', 'later', 'any'];
export const TODS = ['london', 'ny', 'other'];
export const STOPS = ['zone', 'swing'];
export const EXITS = ['1R', '2R', '3R', 'trail', 'opp'];
const XSLOT = [0, 1, 2, 6, 5];                              // manage() R slots: 1R 2R 3R trail opp
export const WIN = 24, MAXV = 3, EF_LIFE = 20 * 86400;
export const SEC = { '1d': 86400, '4h': 14400, '1h': 3600, '15m': 900, '5m': 300 };
export const CAP = { '1d': 5 * 86400, '4h': 3 * 86400, '1h': 2 * 86400 };
// a stored cell: call state (with / against / zero) x zone tf x trigger x conf x visit (first / later) x tod x stop x exit
const DIMS = [3, ZTF.length, TRIGS.length, 2, 2, TODS.length, STOPS.length, EXITS.length];
export const NCELL = DIMS.reduce((a, b) => a * b, 1);   // 4,320
export const cellIndex = (v) => v.reduce((a, x, i) => a * DIMS[i] + x, 0);
export const monthIdx = (t) => { const d = new Date(t * 1000); return (d.getUTCFullYear() - 2010) * 12 + d.getUTCMonth(); };
export const todOf = (ts) => { const h = new Date(ts * 1000).getUTCHours(); return h >= 7 && h < 12 ? 0 : h >= 12 && h < 17 ? 1 : 2; };
// candles for eg-methods: time = close - timeframe length, so every at / fail / back is the real close of a candle
const toC = (L, sec) => (L._c6 ||= L.map((b) => ({ time: b.e - sec, open: b.o, high: b.h, low: b.l, close: b.c })));

// ---- zones on the zone timeframe: the engulf zones (opp targets) and the EFs -------------------------------------------
export function zoneSets(L, tf) {
  const sec = SEC[tf], C = toC(L, sec), Z = turnBack(C, zones(C, tf, 3), sec);
  const eg = Z.map((z) => ({ d: z.dir, bot: z.bot, top: z.top, at: z.at, end: z.end })).sort((a, b) => a.at - b.at);
  const ef = Z.filter((z) => z.fail != null).map((z) => ({ d: -z.dir, bot: z.bot, top: z.top, at: z.fail, fi: z.fi,
    end: Math.min(z.fail + EF_LIFE, z.back != null ? z.back : Infinity) })).sort((a, b) => a.at - b.at);
  return { eg, ef };
}
function tags(T) {
  if (T._g6) return T._g6;
  const box = new Map(); for (const b of K.boxesHL(T, 2)) if (b.dir && b.bi >= 0) { const a = box.get(b.bi) || []; a.push(b); box.set(b.bi, a); }
  const ev = new Map(); for (const e of K.structure(T, 2).events) ev.set(e.i, e);
  return (T._g6 = { box, ev, C: T.map((b) => ({ time: b.t, open: b.o, high: b.h, low: b.l, close: b.c })) });
}

// ---- signals (closed candles only) --------------------------------------------------------------------------------------
// { ztf, trig, conf, visit (0 first / 1 later), d, ts, c0 (trigger close), ext (swing extreme), ef, call, tod }
export function signals(F, { from = FROM, to = TO } = {}) {
  const H4 = F['4h'], calls = h4Calls(F), out = [], sets = {};
  const callAt = (ts, d) => { const hi = K.closedCount(H4, ts) - 1, c = hi >= 0 ? calls[hi] : 0; return c === d ? 0 : c === -d ? 1 : 2; };
  for (let zi = 0; zi < ZTF.length; zi++) {
    const tf = ZTF[zi], L = F[tf], S = (sets[tf] = zoneSets(L, tf));
    for (const ef of S.ef) {
      if (ef.at >= to || ef.end < from - 10 * 86400) continue;
      const d = ef.d;
      // trigger ef: the EF candle itself
      if (ef.at >= from - 3 * 86400) { const b = L[ef.fi];
        out.push({ ztf: zi, trig: 0, conf: 0, visit: 0, d, ts: ef.at, c0: b.c, ext: d > 0 ? b.l : b.h, ef, call: callAt(ef.at, d), tod: todOf(ef.at) }); }
      // a return into the EF zone and a confirmation on a lower timeframe
      for (let ci = 0; ci < 2; ci++) {
        const T = F[CONF[tf][ci]], g = tags(T), alive = (j) => j < T.length && T[j].t < ef.end;
        let k = startIdx(T, ef.at); // the first candle starting at or after the fail close
        let visit = 0;
        while (alive(k) && visit < MAXV) {
          while (alive(k) && !(T[k].l <= ef.top && T[k].h >= ef.bot)) k++;
          if (!alive(k)) break;
          visit++; const k0 = k;
          if (T[k0].t >= from - 3 * 86400 && T[k0].t < to) {
            const found = [-1, -1, -1];
            for (let j = k0; j < k0 + WIN && alive(j); j++) {
              if (d > 0 ? T[j].c < ef.bot : T[j].c > ef.top) break;   // closed through the far side: the search stops
              if (found[0] < 0) { const e = engulfAt(g.C, j, 3); if (e && e.dir === d) found[0] = j; }
              if (found[1] < 0) { const e = g.ev.get(j); if (e && e.dir === d) found[1] = j; }
              if (found[2] < 0) { const bs = g.box.get(j); if (bs && bs.some((x) => x.dir === d)) found[2] = j; }
              if (found[0] >= 0 && found[1] >= 0 && found[2] >= 0) break;
            }
            for (let q = 0; q < 3; q++) { const j = found[q]; if (j < 0) continue;
              let ext = d > 0 ? Infinity : -Infinity; for (let m = k0; m <= j; m++) ext = d > 0 ? Math.min(ext, T[m].l) : Math.max(ext, T[m].h);
              const ts = T[j].e;
              out.push({ ztf: zi, trig: q + 1, conf: ci, visit: visit === 1 ? 0 : 1, d, ts, c0: T[j].c, ext, ef, call: callAt(ts, d), tod: todOf(ts) }); }
          }
          while (alive(k) && T[k].l <= ef.top && T[k].h >= ef.bot) k++;
          k++;
        }
      }
    }
  }
  return { sigs: out, sets };
}

// ---- trades -------------------------------------------------------------------------------------------------------------
// the near edge of the nearest engulf zone of side -s standing at ts beyond ref (null when none)
export function oppEdge(eg, s, ts, ref, sec) {
  let lo = 0, hi = eg.length; while (lo < hi) { const m = (lo + hi) >> 1; if (eg[m].at <= ts) lo = m + 1; else hi = m; }
  const back = ts - 200 * sec * 1.6; let best = null;
  for (let i = lo - 1; i >= 0 && eg[i].at >= back; i--) { const z = eg[i]; if (z.d !== -s || !(z.end > ts)) continue;
    const e = s > 0 ? z.bot : z.top; if (s * (e - ref) > 0 && (best == null || s * (best - e) > 0)) best = e; }
  return best;
}
export function runMarket(market, { dir } = {}) {
  const M5 = K.load(market, '5m', { from: y(2009), to: TO }); const F = frames(M5);
  const cost = COSTS[market], X = exclusions(market), buf = cost / 2;
  const inBad = (t) => X.some(([a, b]) => t >= a && t <= b);
  const { sigs, sets } = signals(F);
  const ATR = Object.fromEntries(ZTF.map((tf) => [tf, atr14(F[tf])]));
  const acc = { n: new Uint32Array(NCELL * 2 * 2), ms: new Float64Array(NCELL * 2 * NM), cm: new Float64Array(NCELL * 2 * NM) };
  let ntr = 0, npl = 0, bad = 0;
  for (const sg of sigs) {
    const tf = ZTF[sg.ztf], L = F[tf], d = sg.d, ts = sg.ts, ef = sg.ef;
    const li = K.closedCount(L, ts) - 1; if (li < 15) continue; const atr = ATR[tf][li];
    const stops = [d > 0 ? ef.bot - buf - 0.1 * atr : ef.top + buf + 0.1 * atr, d > 0 ? sg.ext - buf : sg.ext + buf];
    const fi = startIdx(M5, ts); if (fi >= M5.length) continue;
    for (let si = 0; si < 2; si++) {
      const stop = stops[si]; if (!(d * (sg.c0 - stop) >= 2 * cost)) continue;
      for (let pl = 0; pl < 2; pl++) {
        const s = pl ? -d : d, sp = pl ? 2 * sg.c0 - stop : stop;
        const opp = oppEdge(sets[tf].eg, s, ts, sg.c0, SEC[tf]); const oppR = opp == null ? null : (s * (opp - sg.c0)) / (s * (sg.c0 - sp));
        const fill = M5[fi].o, r = manage(M5, s, fi, fill, sp, CAP[tf], true, oppR != null && oppR >= 1 ? oppR : 2);
        if (!r || !(r.risk >= cost)) continue;
        if (!(s * (fill - sp) > 0)) throw new Error('stop on the wrong side');
        if (r.t < FROM || r.t >= TO) continue; if (inBad(r.t)) { bad++; continue; }
        pl ? npl++ : ntr++;
        const m = monthIdx(r.t), half = r.t >= HALF ? 1 : 0, cr = cost / r.risk;
        for (let x = 0; x < EXITS.length; x++) {
          if (x === 4 && !(oppR != null && oppR >= 1)) continue;   // opp: only when the opposite zone is 1R or more away
          const c = pl * NCELL + cellIndex([sg.call, sg.ztf, sg.trig, sg.conf, sg.visit, sg.tod, si, x]);
          acc.n[c * 2 + half]++; acc.ms[c * NM + m] += r.R[XSLOT[x]]; acc.cm[c * NM + m] += cr; }
      }
    }
  }
  const meta = { market, signals: sigs.length, trades: ntr, placebo: npl, droppedBad: bad, bars: M5.length, last: new Date(M5[M5.length - 1].t * 1000).toISOString() };
  if (dir) { fs.mkdirSync(dir, { recursive: true }); for (const k of Object.keys(acc)) fs.writeFileSync(path.join(dir, `${market}.${k}.bin`), Buffer.from(acc[k].buffer));
    fs.writeFileSync(path.join(dir, `${market}.json`), JSON.stringify(meta)); }
  return { acc, meta };
}

// ---- cut test: the signals before a cut are the same when the candles stop at the cut -------------------------------------
const sigKey = (s) => [s.ztf, s.trig, s.conf, s.visit, s.d, s.ts, s.c0, s.ext, s.ef.bot, s.ef.top, s.ef.at, s.call, s.tod].join('|');
export function cutTest(market, cuts = ['2011-06-15', '2013-02-20', '2015-09-09', '2017-04-12', '2019-08-21']) {
  const M5 = K.load(market, '5m', { from: y(2009), to: TO });
  const full = signals(frames(M5)).sigs; const out = [];
  for (const c of cuts) { const C = Date.parse(c + 'T13:37:00Z') / 1000;
    const part = signals(frames(M5.filter((b) => b.e <= C)), { to: C }).sigs;
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
// the reported cells: { z, trig, conf (-1 = none), visit (0 first, 1 later, 2 any; -1 none), call, tod, stop, exit }
export function reportedCells() {
  const out = [];
  for (let z = 0; z < 3; z++) for (let tr = 0; tr < 4; tr++) for (const cf of tr === 0 ? [-1] : [0, 1]) for (const v of tr === 0 ? [-1] : [0, 1, 2])
    for (let cl = 0; cl < 3; cl++) for (let td = 0; td < 3; td++) for (let st = 0; st < 2; st++) for (let x = 0; x < 5; x++) out.push({ z, tr, cf, v, cl, td, st, x });
  return out;
}
const storedOf = (r) => { const calls = r.cl === 2 ? [0, 1, 2] : [r.cl], vis = r.v === -1 ? [0] : r.v === 2 ? [0, 1] : [r.v], cf = r.cf < 0 ? 0 : r.cf;
  const out = []; for (const c of calls) for (const v of vis) out.push(cellIndex([c, r.z, r.tr, cf, v, r.td, r.st, r.x])); return out; };

export function report(dir, markets = MARKETS) {
  const P = {}; for (const m of markets) { const rd = (k, Tp) => { const b = fs.readFileSync(path.join(dir, `${m}.${k}.bin`)); return new Tp(b.buffer, b.byteOffset, b.byteLength / Tp.BYTES_PER_ELEMENT); };
    P[m] = { n: rd('n', Uint32Array), ms: rd('ms', Float64Array), cm: rd('cm', Float64Array), meta: JSON.parse(fs.readFileSync(path.join(dir, `${m}.json`), 'utf8')) }; }
  const scopes = ['pool', ...markets], rows = { 0: [], 1: [] }, cells = reportedCells();
  const ms = new Float64Array(NM), cm = new Float64Array(NM);
  for (const pl of [0, 1]) for (const sc of scopes) { const list = sc === 'pool' ? markets : [sc];
    for (const cell of cells) {
      ms.fill(0); cm.fill(0); let nI = 0, nO = 0;
      for (const m of list) { const A = P[m]; for (const st of storedOf(cell)) { const c = pl * NCELL + st;
        nI += A.n[c * 2]; nO += A.n[c * 2 + 1]; for (let k = 0; k < NM; k++) { ms[k] += A.ms[c * NM + k]; cm[k] += A.cm[c * NM + k]; } } }
      if (nI < 100) continue;
      const a = mstat(ms, 0, HM), b = mstat(ms, HM, NM); const net = Float64Array.from(ms, (x, k) => x - cm[k]);
      const an = mstat(net, 0, HM), bn = mstat(net, HM, NM);
      rows[pl].push({ sc, cell, nI, nO, isMean: a.sum / nI, isT: a.t, oosMean: nO ? b.sum / nO : null, oosT: b.t,
        isNet: an.sum / nI, isNetT: an.t, oosNet: nO ? bn.sum / nO : null, oosNetT: bn.t });
    } }
  const name = (r) => { const c = r.cell; return { scope: r.sc, zone: ZTF[c.z], trig: TRIGS[c.tr], conf: c.cf < 0 ? '-' : CONF[ZTF[c.z]][c.cf], visit: c.v < 0 ? '-' : VISITS[c.v],
    call: CALLS[c.cl], tod: TODS[c.td], stop: STOPS[c.st], exit: EXITS[c.x],
    n1014: r.nI, mean1014: r4(r.isMean), t1014: r2(r.isT), n1519: r.nO, mean1519: r4(r.oosMean), t1519: r2(r.oosT),
    net1014: r4(r.isNet), net1519: r4(r.oosNet), netT1519: r2(r.oosNetT), holm: r.holm == null ? null : +r.holm.toPrecision(3) }; };
  const bar = (R, net) => {
    const m1 = (r) => (net ? r.isNet : r.isMean), t1 = (r) => (net ? r.isNetT : r.isT), m2 = (r) => (net ? r.oosNet : r.oosMean), t2 = (r) => (net ? r.oosNetT : r.oosT);
    const disc = R.filter((r) => m1(r) > 0 && t1(r) >= 2);
    const pv = disc.map((r) => (r.nO >= 100 && m2(r) > 0 ? p1(t2(r), NM - HM - 1) : 1)); const adj = K.holm(pv);
    disc.forEach((r, i) => { r.holm = adj[i]; });
    const raw = disc.filter((r) => r.nO >= 100 && m2(r) > 0 && t2(r) >= 2), conf = raw.filter((r) => r.holm < 0.05);
    return { tested: R.length, discovery: disc.length, discoveryExpected: +(R.length * 0.0228).toFixed(1), rawConfirmed: raw.length,
      rawExpected: +(disc.length * 0.0228).toFixed(1), confirmed: conf.length,
      confirmedList: [...conf].sort((a, b) => t2(b) - t2(a)).slice(0, 60).map(name), rawList: [...raw].sort((a, b) => t2(b) - t2(a)).slice(0, 40).map(name),
      topDiscovery: [...disc].sort((a, b) => t1(b) - t1(a)).slice(0, 25).map(name) };
  };
  const real = bar(rows[0], false), placebo = bar(rows[1], false), realNet = bar(rows[0], true), placeboNet = bar(rows[1], true);
  // marginal reading per factor level: pooled, exit 2R, real trades, every stored combination once
  const marg = {}; const dim = [['call', ['with', 'against', 'zero'], 0], ['zone', ZTF, 1], ['trig', TRIGS, 2], ['conf', ['step1', 'step2'], 3], ['visit', ['first', 'later'], 4], ['tod', TODS, 5], ['stop', STOPS, 6]];
  const decode = (c) => { const v = []; for (let i = DIMS.length - 1; i >= 0; i--) { v[i] = c % DIMS[i]; c = (c - v[i]) / DIMS[i]; } return v; };
  for (const [nm, lv, di] of dim) { marg[nm] = {}; lv.forEach((l, li) => { let nI = 0, nO = 0, sI = 0, sO = 0, cO = 0;
    for (let c = 0; c < NCELL; c++) { const v = decode(c); if (v[7] !== 1 || v[di] !== li) continue;
      for (const m of markets) { const A = P[m]; nI += A.n[c * 2]; nO += A.n[c * 2 + 1];
        for (let k = 0; k < NM; k++) { if (k < HM) sI += A.ms[c * NM + k]; else { sO += A.ms[c * NM + k]; cO += A.cm[c * NM + k]; } } } }
    marg[nm][l] = { n1014: nI, mean1014: r4(sI / nI), n1519: nO, mean1519: r4(sO / nO), net1519: r4((sO - cO) / nO) }; }); }
  const verdict = real.confirmed === 0 ? 'FAIL' : real.confirmed > placebo.confirmed ? 'PASS' : 'INCONCLUSIVE';
  const meta = Object.fromEntries(markets.map((m) => [m, P[m].meta]));
  return { real, placebo, realNet, placeboNet, marg, verdict, meta };
}

const main = process.argv[1] === fileURLToPath(import.meta.url);
if (main) {
  const [cmd, a, b] = process.argv.slice(2);
  if (cmd === 'market') { const t0 = Date.now(); const { meta } = runMarket(a, { dir: b }); console.log(JSON.stringify(meta), ((Date.now() - t0) / 1000).toFixed(0) + 's'); }
  else if (cmd === 'cut') { const r = cutTest(a); fs.mkdirSync(b, { recursive: true }); fs.writeFileSync(path.join(b, `${a}.cut.json`), JSON.stringify(r)); console.log(a, JSON.stringify(r)); }
  else if (cmd === 'report') { const R = report(a); fs.writeFileSync(path.join(a, 'report.json'), JSON.stringify(R, null, 1));
    const cut = MARKETS.flatMap((m) => { const f = path.join(a, `${m}.cut.json`); return fs.existsSync(f) ? JSON.parse(fs.readFileSync(f, 'utf8')).map((c) => ({ market: m, ...c })) : []; });
    const list = R.real.confirmedList.length ? R.real.confirmedList : R.real.rawList.length ? R.real.rawList : R.real.topDiscovery;
    const best = list[0] || null, f = (x) => (x >= 0 ? '+' : '-') + Math.abs(x).toFixed(3);
    const bestTxt = best ? `best ${best.scope} ${best.zone} EF, trigger ${best.trig}${best.conf !== '-' ? ' on ' + best.conf : ''}, ${best.call}, ${best.tod}, stop ${best.stop}, exit ${best.exit}: ${f(best.mean1519)}R a trade in 2015-19, n ${best.n1519.toLocaleString('en-US')}, month t ${best.t1519.toFixed(2)}` : 'no cell';
    const headline = `${R.verdict}: ${R.real.confirmed} of ${R.real.tested.toLocaleString('en-US')} cells confirmed before costs after Holm (placebo ${R.placebo.confirmed}); ${bestTxt}`;
    const out = { study: 'grid6-msnr-ef-market', built: '2026-11-23', verdict: R.verdict, headline, basis: 'judged before costs (pre-registered); after costs beside',
      window: 'fills 2010-01-01 to 2019-12-31; discovery 2010-14, confirmation 2015-19', markets: MARKETS, factors: { ZTF, CONF, TRIGS, CALLS, VISITS, TODS, STOPS, EXITS },
      real: R.real, placebo: { ...R.placebo, rawList: R.placebo.rawList.slice(0, 15), topDiscovery: R.placebo.topDiscovery.slice(0, 10) },
      realNet: { ...R.realNet, topDiscovery: R.realNet.topDiscovery.slice(0, 10) }, placeboNet: { ...R.placeboNet, topDiscovery: [], rawList: R.placeboNet.rawList.slice(0, 10) },
      best, marginals2R: R.marg, meta: R.meta, cut };
    fs.writeFileSync(path.join(HERE, 'result.json'), JSON.stringify(out, null, 1) + '\n'); console.log(headline);
    const strip = (o) => ({ ...o, confirmedList: undefined, rawList: undefined, topDiscovery: undefined });
    console.log(JSON.stringify({ verdict: R.verdict, real: strip(R.real), placebo: strip(R.placebo), realNet: strip(R.realNet), placeboNet: strip(R.placeboNet) }, null, 1)); }
  else console.log('usage: run.mjs market <m> <dir> | cut <m> <dir> | report <dir>');
}
