// research/edge/grid6-eg-box-market/run.mjs - grid 6 of PREREGISTRATION.md (23 Nov 2026): engulf zones on D1 / H4 (fresh /
// any visit / failed and traded the other way) x the working-timeframe box (H1 / M15; out with the side / false break back in)
// x the confirmation (none, an engulf, a structure break) x session x stop (box / zone) x exit, MARKET entries only, per market
// and pooled, with a side-flipped placebo.
//   node --max-old-space-size=6000 research/edge/grid6-eg-box-market/run.mjs market <m> <dir>   one market -> <dir>/<m>.*.bin, <m>.json
//   node research/edge/grid6-eg-box-market/run.mjs cut <m> <dir>                                  cut test of one market
//   node research/edge/grid6-eg-box-market/run.mjs report <dir>                                   pool, the bar -> result.json
// Research only: reads the edgekit candle cache; imports edgekit, council/eg-methods (engulfAt), combo-grid-3 (frames,
// buildZones, exclusions), combo-grid-2 (COSTS) and dom-trade-through (manage, atr14, startIdx), none edited.
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import * as K from '../_lib/edgekit.mjs';
import { engulfAt } from '../../../council/eg-methods.mjs';
import { frames, buildZones, exclusions } from '../combo-grid-3/run.mjs';
import { COSTS } from '../combo-grid-2/run.mjs';
import { manage, atr14, startIdx } from '../dom-trade-through/run.mjs';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const y = (n) => Date.UTC(n, 0, 1) / 1000;
export const FROM = y(2010), TO = y(2020), HALF = y(2015), NM = 120, HM = 60;
export const MARKETS = ['xau', 'eurusd', 'gbpusd', 'usdjpy', 'audusd'];
export const STATES = ['fresh', 'any', 'ef'];            // reported; stored: fresh, later (visits 2-3), ef
export const ZTFS = ['1d', '4h'];
export const TFS = ['1h', '15m'];
export const MODES = ['out', 'false'];
export const CONFS = ['none', 'eg', 'sb'];
export const TODS = ['london', 'ny', 'other'];
export const STOPS = ['box', 'zone'];
export const EXITS = ['1R', '2R', '3R', 'trail', 'opp'];
const XSLOT = [0, 1, 2, 6, 5];                              // manage() R slots: 1R 2R 3R trail opp
export const WIN = 24, BACK_IN = 6, CONF_WIN = 3, MAX_VISIT = 3, CAP = 2 * 86400;
const LOOK = { '1d': 220 * 86400, '4h': 40 * 86400 };   // no zone of that timeframe lives longer (120 candles / 20 days)
const DIMS = [3, ZTFS.length, TFS.length, MODES.length, CONFS.length, TODS.length, STOPS.length, EXITS.length];
export const NCELL = DIMS.reduce((a, b) => a * b, 1);   // 2,160 stored
export const cellIndex = (v) => v.reduce((a, x, i) => a * DIMS[i] + x, 0);
export const monthIdx = (t) => { const d = new Date(t * 1000); return (d.getUTCFullYear() - 2010) * 12 + d.getUTCMonth(); };
const todOf = (ts) => { const h = new Date(ts * 1000).getUTCHours(); return h >= 7 && h < 12 ? 0 : h >= 12 && h < 17 ? 1 : 2; };
const conv = (B) => (B._c ||= B.map((b) => ({ time: b.t, open: b.o, high: b.h, low: b.l, close: b.c })));

function tfTags(T) {
  if (T._g) return T._g;
  const box = new Map(); for (const b of K.boxesHL(T, 2)) if (b.dir && b.bi >= 0) { const a = box.get(b.bi) || []; a.push(b); box.set(b.bi, a); }
  const ev = new Map(); for (const e of K.structure(T, 2).events) ev.set(e.i, e);
  return (T._g = { box, ev });
}
// the zones of one timeframe: engulf zones (kind 0) and failed ones (kind 1), sorted by the time they become known
export function zonesOf(L) {
  return [...buildZones('eg', L).map((z) => ({ ...z, kind: 0 })), ...buildZones('ef', L).map((z) => ({ ...z, kind: 1 }))].sort((a, b) => a.at - b.at);
}
// every signal: { zt, st, tf, mode, conf, d, ts, j, tod, box, ext, z, c0 }
export function signals(F, { from = FROM, to = TO } = {}) {
  const out = [], Z = {};
  for (let zi = 0; zi < ZTFS.length; zi++) Z[ZTFS[zi]] = zonesOf(F[ZTFS[zi]]);
  for (let zi = 0; zi < ZTFS.length; zi++) for (let ti = 0; ti < TFS.length; ti++) {
    const T = F[TFS[ti]], C = conv(T), g = tfTags(T);
    for (const z of Z[ZTFS[zi]]) {
      if (z.at >= to || z.end < from - 10 * 86400) continue;
      const d = z.d;
      let k = K.closedCount(T, z.at); while (k < T.length && T[k].t < z.at) k++;
      let visit = 0;
      while (k < T.length && T[k].t < z.end && visit < MAX_VISIT) {
        while (k < T.length && T[k].t < z.end && !(T[k].l <= z.top && T[k].h >= z.bot)) k++;
        if (k >= T.length || T[k].t >= z.end) break;
        visit++; const k0 = k, st = z.kind === 1 ? 2 : visit === 1 ? 0 : 1;
        if (T[k0].t >= from - 3 * 86400 && T[k0].t < to) {
          const alive = (j) => j < T.length && T[j].t < z.end;
          for (let mi = 0; mi < 2; mi++) {
            let ev = null;
            for (let j = k0; j < k0 + WIN && alive(j); j++) { const bs = g.box.get(j); if (!bs) continue;
              const bx = bs.find((b) => b.dir === (mi === 0 ? d : -d)); if (!bx) continue;
              if (mi === 0) { ev = { e: j, box: bx, j0: j }; break; }
              for (let m = j + 1; m <= j + BACK_IN && alive(m); m++) if (d > 0 ? T[m].c > bx.lo : T[m].c < bx.hi) { ev = { e: m, box: bx, j0: j }; break; }
              break; }
            if (!ev) continue;
            const add = (conf, jj) => {
              const ts = T[jj].e;
              let ext = d > 0 ? Infinity : -Infinity; for (let q = ev.j0; q <= jj; q++) ext = d > 0 ? Math.min(ext, T[q].l) : Math.max(ext, T[q].h);
              out.push({ zt: zi, st, tf: ti, mode: mi, conf, d, ts, j: jj, tod: todOf(ts), box: ev.box, ext, z, c0: T[jj].c });
            };
            add(0, ev.e);
            for (let jj = ev.e; jj <= ev.e + CONF_WIN && alive(jj); jj++) { const eg = engulfAt(C, jj, 3); if (eg && eg.dir === d) { add(1, jj); break; } }
            for (let jj = ev.e; jj <= ev.e + CONF_WIN && alive(jj); jj++) { const e = g.ev.get(jj); if (e && e.dir === d) { add(2, jj); break; } }
          }
        }
        while (k < T.length && T[k].t < z.end && T[k].l <= z.top && T[k].h >= z.bot) k++;
        k++;
      }
    }
  }
  return { sigs: out, Z };
}

// ---- trades -------------------------------------------------------------------------------------------------------------
const near = (list, s, ref) => { let best = null; for (const e of list) if (s * (e - ref) > 0 && (best == null || s * (best - e) > 0)) best = e; return best; };
// one market order: returns { t, risk, R (5 exits) } or null
export function trade(M5, s, stop, ts, oppR, cost) {
  const fi = startIdx(M5, ts); if (fi >= M5.length) return null; const fill = M5[fi].o;
  if (!(s * (fill - stop) > 0)) return null;     // price already past the stop at the open: no trade (never a stop on the wrong side)
  const r = manage(M5, s, fi, fill, stop, CAP, true, oppR); if (!r || !(r.risk >= cost)) return null;
  if (!(s * (fill - stop) > 0)) throw new Error('stop on the wrong side');
  return { t: r.t, risk: r.risk, R: XSLOT.map((k) => r.R[k]) };
}
const lowerAt = (A, t) => { let lo = 0, hi = A.length; while (lo < hi) { const m = (lo + hi) >> 1; if (A[m].at < t) lo = m + 1; else hi = m; } return lo; };
export function runMarket(market, { dir } = {}) {
  const M5 = K.load(market, '5m', { from: y(2009), to: TO }); const F = frames(M5);
  const cost = COSTS[market], X = exclusions(market);
  const inBad = (t) => X.some(([a, b]) => t >= a && t <= b);
  const AT = { '1d': atr14(F['1d']), '4h': atr14(F['4h']) };
  const { sigs, Z } = signals(F);
  const acc = { n: new Uint32Array(NCELL * 2 * 2), ms: new Float64Array(NCELL * 2 * NM), cm: new Float64Array(NCELL * 2 * NM) }; // [placebo][cell]
  let ntr = 0, npl = 0, bad = 0, past = 0;
  for (const sg of sigs) {
    const ztf = ZTFS[sg.zt], L = F[ztf], d = sg.d, buf = cost / 2, ts = sg.ts;
    const li = K.closedCount(L, ts) - 1; if (li < 15) continue; const atrZ = AT[ztf][li];
    const all = Z[ztf], edges = { 1: [], '-1': [] };
    for (let q = lowerAt(all, ts - LOOK[ztf]); q < all.length; q++) { const o = all[q]; if (o.at > ts) break; if (o.end <= ts) continue; edges[-o.d].push(-o.d > 0 ? o.bot : o.top); }
    const boxS = sg.mode === 0 ? (d > 0 ? sg.box.lo - buf : sg.box.hi + buf) : (d > 0 ? sg.ext - buf : sg.ext + buf);
    const zoneS = d > 0 ? sg.z.bot - buf - 0.1 * atrZ : sg.z.top + buf + 0.1 * atrZ;
    for (let si = 0; si < 2; si++) {
      const stop = si === 0 ? boxS : zoneS;
      if (!(d * (sg.c0 - stop) >= 2 * cost)) continue;
      for (let pl = 0; pl < 2; pl++) {
        const s = pl ? -d : d, sp = pl ? 2 * sg.c0 - stop : stop, rf = sg.c0;
        const opp = near(edges[s], s, rf); let oppR = opp == null ? 2 : (s * (opp - rf)) / (s * (rf - sp)); if (!(oppR >= 1)) oppR = 2;
        const r = trade(M5, s, sp, ts, oppR, cost);
        if (!r) { past++; continue; }
        if (r.t < FROM || r.t >= TO) continue; if (inBad(r.t)) { bad++; continue; }
        pl ? npl++ : ntr++;
        const m = monthIdx(r.t), half = r.t >= HALF ? 1 : 0, cr = cost / r.risk;
        for (let x = 0; x < EXITS.length; x++) {
          const c = pl * NCELL + cellIndex([sg.st, sg.zt, sg.tf, sg.mode, sg.conf, sg.tod, si, x]);
          acc.n[c * 2 + half]++; acc.ms[c * NM + m] += r.R[x]; acc.cm[c * NM + m] += cr; }
      }
    }
  }
  const meta = { market, signals: sigs.length, trades: ntr, placebo: npl, droppedBad: bad, notTaken: past, bars: M5.length, last: new Date(M5[M5.length - 1].t * 1000).toISOString() };
  if (dir) { fs.mkdirSync(dir, { recursive: true }); for (const k of Object.keys(acc)) fs.writeFileSync(path.join(dir, `${market}.${k}.bin`), Buffer.from(acc[k].buffer));
    fs.writeFileSync(path.join(dir, `${market}.json`), JSON.stringify(meta)); }
  return { acc, meta };
}

// ---- cut test: the signals before a cut are the same when the candles stop at the cut -------------------------------------
const sigKey = (s) => [s.zt, s.st, s.tf, s.mode, s.conf, s.d, s.ts, s.tod, s.box.hi, s.box.lo, s.ext, s.z.bot, s.z.top, s.c0].join('|');
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
function decode(c) { const v = []; for (let i = DIMS.length - 1; i >= 0; i--) { v[i] = c % DIMS[i]; c = (c - v[i]) / DIMS[i]; } return v; }
const r4 = (x) => (x == null || !Number.isFinite(x) ? null : +x.toFixed(4)), r2 = (x) => (x == null || !Number.isFinite(x) ? null : +x.toFixed(2));
const STATE_OF = [[0], [0, 1], [2]];                     // reported state -> stored states

export function report(dir, markets = MARKETS) {
  const P = {}; for (const m of markets) { const rd = (k, Tp) => { const b = fs.readFileSync(path.join(dir, `${m}.${k}.bin`)); return new Tp(b.buffer, b.byteOffset, b.byteLength / Tp.BYTES_PER_ELEMENT); };
    P[m] = { n: rd('n', Uint32Array), ms: rd('ms', Float64Array), cm: rd('cm', Float64Array), meta: JSON.parse(fs.readFileSync(path.join(dir, `${m}.json`), 'utf8')) }; }
  const scopes = ['pool', ...markets], rows = { 0: [], 1: [] }, per = NCELL / 3;
  const ms = new Float64Array(NM), cm = new Float64Array(NM);
  for (const pl of [0, 1]) for (const sc of scopes) { const list = sc === 'pool' ? markets : [sc];
    for (let rest = 0; rest < per; rest++) for (let sl = 0; sl < 3; sl++) {
      ms.fill(0); cm.fill(0); let nI = 0, nO = 0;
      for (const m of list) { const A = P[m]; for (const st of STATE_OF[sl]) { const c = pl * NCELL + st * per + rest;
        nI += A.n[c * 2]; nO += A.n[c * 2 + 1]; for (let k = 0; k < NM; k++) { ms[k] += A.ms[c * NM + k]; cm[k] += A.cm[c * NM + k]; } } }
      if (nI < 100) continue;
      const a = mstat(ms, 0, HM), b = mstat(ms, HM, NM); const net = Float64Array.from(ms, (x, k) => x - cm[k]);
      const an = mstat(net, 0, HM), bn = mstat(net, HM, NM);
      rows[pl].push({ sc, sl, rest, nI, nO, isMean: a.sum / nI, isT: a.t, oosMean: nO ? b.sum / nO : null, oosT: b.t,
        isNet: an.sum / nI, isNetT: an.t, oosNet: nO ? bn.sum / nO : null, oosNetT: bn.t });
    } }
  const name = (r) => { const v = decode(r.rest); return { scope: r.sc, state: STATES[r.sl], zone: ZTFS[v[1]], tf: TFS[v[2]], box: MODES[v[3]], conf: CONFS[v[4]], tod: TODS[v[5]], stop: STOPS[v[6]], exit: EXITS[v[7]],
    n1014: r.nI, mean1014: r4(r.isMean), t1014: r2(r.isT), n1519: r.nO, mean1519: r4(r.oosMean), t1519: r2(r.oosT), net1014: r4(r.isNet), netT1014: r2(r.isNetT), net1519: r4(r.oosNet), netT1519: r2(r.oosNetT), holm: r.holm == null ? null : +r.holm.toPrecision(3) }; };
  const bar = (R, net) => {
    const m1 = (r) => (net ? r.isNet : r.isMean), t1 = (r) => (net ? r.isNetT : r.isT), m2 = (r) => (net ? r.oosNet : r.oosMean), t2 = (r) => (net ? r.oosNetT : r.oosT);
    const disc = R.filter((r) => m1(r) > 0 && t1(r) >= 2);
    const pv = disc.map((r) => (r.nO >= 50 && m2(r) > 0 ? p1(t2(r), NM - HM - 1) : 1)); const adj = K.holm(pv);
    disc.forEach((r, i) => { r.holm = adj[i]; });
    const raw = disc.filter((r) => r.nO >= 50 && m2(r) > 0 && t2(r) >= 2), conf = raw.filter((r) => r.holm < 0.05);
    const out = { tested: R.length, discovery: disc.length, discoveryExpected: +(R.length * 0.0228).toFixed(1), rawConfirmed: raw.length,
      rawExpected: +(disc.length * 0.0228).toFixed(1), confirmed: conf.length,
      confirmedList: conf.sort((a, b) => t2(b) - t2(a)).slice(0, 60).map(name), rawList: raw.sort((a, b) => t2(b) - t2(a)).slice(0, 40).map(name),
      topDiscovery: disc.sort((a, b) => t1(b) - t1(a)).slice(0, 25).map(name) };
    disc.forEach((r) => { delete r.holm; });
    return out;
  };
  const real = bar(rows[0], false), placebo = bar(rows[1], false), realNet = bar(rows[0], true), placeboNet = bar(rows[1], true);
  // marginal reading per factor level: pooled, exit 2R, real trades (stored states: fresh, later, ef)
  const marg = {}; const dimName = [['state', ['fresh', 'later', 'ef']], ['zone', ZTFS], ['tf', TFS], ['box', MODES], ['conf', CONFS], ['tod', TODS], ['stop', STOPS]];
  dimName.forEach(([nm, lv], di) => { marg[nm] = {}; lv.forEach((l, li) => { let nI = 0, nO = 0, sI = 0, sO = 0, cO = 0;
    for (let c = 0; c < NCELL; c++) { const v = decode(c); if (v[7] !== 1 || v[di] !== li) continue;
      for (const m of markets) { const A = P[m]; nI += A.n[c * 2]; nO += A.n[c * 2 + 1];
        for (let k = 0; k < NM; k++) { if (k < HM) sI += A.ms[c * NM + k]; else { sO += A.ms[c * NM + k]; cO += A.cm[c * NM + k]; } } } }
    marg[nm][l] = { n1014: nI, mean1014: r4(sI / nI), n1519: nO, mean1519: r4(sO / nO), net1519: r4((sO - cO) / nO) }; }); });
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
    const bestTxt = best ? `best ${best.scope} ${best.zone} ${best.state} ${best.tf} ${best.box} ${best.conf} ${best.tod} ${best.stop} ${best.exit}: ${f(best.mean1519)}R a trade in 2015-19, n ${best.n1519.toLocaleString('en-US')}, month t ${best.t1519.toFixed(2)}` : 'no cell';
    const headline = `${R.verdict}: ${R.real.confirmed} of ${R.real.tested.toLocaleString('en-US')} cells confirmed before costs after Holm (placebo ${R.placebo.confirmed}); ${bestTxt}`;
    const out = { study: 'grid6-eg-box-market', built: '2026-11-23', verdict: R.verdict, headline, basis: 'judged before costs (pre-registered); after costs beside',
      window: 'fills 2010-01-01 to 2019-12-31; discovery 2010-14, confirmation 2015-19', markets: MARKETS, factors: { STATES, ZTFS, TFS, MODES, CONFS, TODS, STOPS, EXITS },
      real: R.real, placebo: { ...R.placebo, rawList: R.placebo.rawList.slice(0, 15), topDiscovery: R.placebo.topDiscovery.slice(0, 10) },
      realNet: { ...R.realNet, topDiscovery: R.realNet.topDiscovery.slice(0, 10) }, placeboNet: { ...R.placeboNet, topDiscovery: [], rawList: R.placeboNet.rawList.slice(0, 10) },
      best, marginals2R: R.marg, meta: R.meta, cut };
    fs.writeFileSync(path.join(HERE, 'result.json'), JSON.stringify(out, null, 1) + '\n'); console.log(headline);
    console.log(JSON.stringify({ verdict: R.verdict, real: { ...R.real, confirmedList: undefined, rawList: undefined, topDiscovery: undefined }, placebo: { ...R.placebo, confirmedList: undefined, rawList: undefined, topDiscovery: undefined }, realNet: { ...R.realNet, confirmedList: undefined, rawList: undefined, topDiscovery: undefined } }, null, 1)); }
  else console.log('usage: run.mjs market <m> <dir> | cut <m> <dir> | report <dir>');
}
