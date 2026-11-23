// research/edge/grid5-msnr-box/run.mjs - grid 5 of PREREGISTRATION.md (23 Nov 2026): the MSNR direction call (with / against /
// any) x a Daily key level (av, eg, ef, dom, sd) x the working-timeframe box (H1 / M15; out with the side / false break back
// in) x the trigger (box, eg1, eg3, sb) x time of day x entry / stop x exit, per market and pooled, with a side-flipped placebo.
//   node --max-old-space-size=6000 research/edge/grid5-msnr-box/run.mjs market <m> <dir>   one market -> <dir>/<m>.*.bin, <m>.json
//   node research/edge/grid5-msnr-box/run.mjs cut <m> <dir>                                  cut test of one market -> <dir>/<m>.cut.json
//   node research/edge/grid5-msnr-box/run.mjs report <dir>                                   pool, the bar -> result.json
// Research only: reads the edgekit candle cache; imports edgekit, council/eg-methods (direction, engulfAt), combo-grid-3
// (frames, buildZones, exclusions), combo-grid-2 (COSTS) and dom-trade-through (findFill, manage), none edited.
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import * as K from '../_lib/edgekit.mjs';
import { direction, engulfAt } from '../../../council/eg-methods.mjs';
import { frames, buildZones, exclusions } from '../combo-grid-3/run.mjs';
import { COSTS } from '../combo-grid-2/run.mjs';
import { findFill, manage, atr14, startIdx } from '../dom-trade-through/run.mjs';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const y = (n) => Date.UTC(n, 0, 1) / 1000;
export const FROM = y(2010), TO = y(2020), HALF = y(2015), NM = 120, HM = 60;
export const MARKETS = ['xau', 'eurusd', 'gbpusd', 'usdjpy', 'audusd'];
export const DIRS = ['with', 'against', 'any'];          // stored call states: with, against, zero (any = all three)
export const KEYS = ['av', 'eg', 'ef', 'dom', 'sd'];
export const TFS = ['1h', '15m'];
export const MODES = ['out', 'false'];
export const TRIGS = ['box', 'eg1', 'eg3', 'sb'];
export const TODS = ['london', 'ny', 'other'];
export const ENTRIES = ['mkt', 'limBox', 'limEg'], STOPS = ['box', 'key'];
export const ES = ENTRIES.flatMap((e) => STOPS.map((s) => e + '/' + s));
export const EXITS = ['1R', '2R', '3R', 'trail', 'opp'];
const XSLOT = [0, 1, 2, 6, 5];                              // manage() R slots: 1R 2R 3R trail opp
export const WIN = 24, BACK_IN = 6, TRIG_WIN = 6, LIFE_CANDLES = 24, CAP = 2 * 86400;
const SEC = { '1h': 3600, '15m': 900 };
// a stored cell: call state (3: with / against / zero) x the other factors
const DIMS = [3, KEYS.length, TFS.length, MODES.length, TRIGS.length, TODS.length, ES.length, EXITS.length];
export const DIMS_OK = DIMS.length === 8 && DIMS[0] === 3;
export const NCELL = DIMS.reduce((a, b) => a * b, 1);   // 21,600
export const cellIndex = (v) => v.reduce((a, x, i) => a * DIMS[i] + x, 0);
export const monthIdx = (t) => { const d = new Date(t * 1000); return (d.getUTCFullYear() - 2010) * 12 + d.getUTCMonth(); };
const todOf = (ts) => { const h = new Date(ts * 1000).getUTCHours(); return h >= 7 && h < 12 ? 0 : h >= 12 && h < 17 ? 1 : 2; };
const conv = (B) => (B._c ||= B.map((b) => ({ time: b.t, open: b.o, high: b.h, low: b.l, close: b.c })));

// ---- signals (closed candles only) -------------------------------------------------------------------------------------
// the MSNR call of each closed H4 candle, Daily key levels (the trading day) as the timeframe above
export function h4Calls(F) {
  const H4 = F['4h'], D = F['1d'];
  const keyOf = (t) => { const k = K.barAt(D, t); return k < 0 ? t : D[k].t; };
  return direction(conv(H4), keyOf, 86400).call;
}
function tfTags(T) {
  if (T._g) return T._g;
  const box = new Map(); for (const b of K.boxesHL(T, 2)) if (b.dir && b.bi >= 0) { const a = box.get(b.bi) || []; a.push(b); box.set(b.bi, a); }
  const ev = new Map(); for (const e of K.structure(T, 2).events) ev.set(e.i, e);
  return (T._g = { box, ev });
}
// every signal of the market: { key, tf, mode, trig, d, ts, j (trigger candle), call, tod, box, ext, egZ, z, c0 }
export function signals(F, { from = FROM, to = TO } = {}) {
  const D = F['1d'], H4 = F['4h'], calls = h4Calls(F), out = [];
  const Z = {}; for (const k of KEYS) Z[k] = buildZones(k === 'sd' ? 'bar' : k, D);
  for (let ti = 0; ti < TFS.length; ti++) {
    const T = F[TFS[ti]], C = conv(T), g = tfTags(T);
    for (let ki = 0; ki < KEYS.length; ki++) for (const z of Z[KEYS[ki]]) {
      if (z.at >= to || z.end < from - 10 * 86400) continue;
      const d = z.d, maxVisit = KEYS[ki] === 'sd' ? 1 : 2;
      let k = K.closedCount(T, z.at); while (k < T.length && T[k].t < z.at) k++;
      let visit = 0;
      while (k < T.length && T[k].t < z.end && visit < maxVisit) {
        while (k < T.length && T[k].t < z.end && !(T[k].l <= z.top && T[k].h >= z.bot)) k++;
        if (k >= T.length || T[k].t >= z.end) break;
        visit++; const k0 = k;
        if (T[k0].t >= from - 3 * 86400 && T[k0].t < to) {
          const alive = (j) => j < T.length && T[j].t < z.end;
          // mode out: the first box ending with a close out with the side
          for (let mi = 0; mi < 2; mi++) {
            let ev = null;
            for (let j = k0; j < k0 + WIN && alive(j); j++) { const bs = g.box.get(j); if (!bs) continue;
              const bx = bs.find((b) => b.dir === (mi === 0 ? d : -d)); if (!bx) continue;
              if (mi === 0) { ev = { e: j, box: bx, j0: j }; break; }
              // false break: a close back inside past the broken edge within BACK_IN candles
              for (let m = j + 1; m <= j + BACK_IN && alive(m); m++) if (d > 0 ? T[m].c > bx.lo : T[m].c < bx.hi) { ev = { e: m, box: bx, j0: j }; break; }
              break; }
            if (!ev) continue;
            const add = (trig, jj, egZ) => {
              const ts = T[jj].e, hi = K.closedCount(H4, ts) - 1, c = hi >= 0 ? calls[hi] : 0;
              let ext = d > 0 ? Infinity : -Infinity; for (let q = ev.j0; q <= jj; q++) ext = d > 0 ? Math.min(ext, T[q].l) : Math.max(ext, T[q].h);
              out.push({ key: ki, tf: ti, mode: mi, trig, d, ts, j: jj, call: c === d ? 0 : c === -d ? 1 : 2, tod: todOf(ts), box: ev.box, ext, egZ, z, c0: T[jj].c, visit });
            };
            add(0, ev.e, null);
            for (const [tr, span] of [[1, 1], [2, 3]]) for (let jj = ev.e; jj <= ev.e + TRIG_WIN && alive(jj); jj++) {
              const eg = engulfAt(C, jj, span); if (eg && eg.dir === d) { add(tr, jj, [T[eg.j].l, T[eg.j].h]); break; } }
            for (let jj = ev.e; jj <= ev.e + TRIG_WIN && alive(jj); jj++) { const e = g.ev.get(jj); if (e && e.dir === d) { add(3, jj, null); break; } }
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
// one order (real or placebo): returns { t, risk, R (5 exits) } or null
export function trade(M5, s, type, entry, stop, ts, exp, oppR, cost) {
  let fi, fill, full;
  if (type === 'mkt') { fi = startIdx(M5, ts); if (fi >= M5.length) return null; fill = M5[fi].o; full = true; }
  else { const f = findFill(M5, s, entry, stop, ts, exp, 'through', cost / 2); if (!f) return null; fi = f.i; fill = f.fill; full = false; }
  const r = manage(M5, s, fi, fill, stop, CAP, full, oppR); if (!r || !(r.risk >= cost)) return null;
  if (!(s * (fill - stop) > 0)) throw new Error('stop on the wrong side');
  return { t: r.t, risk: r.risk, R: XSLOT.map((k) => r.R[k]) };
}
export function runMarket(market, { dir } = {}) {
  const M5 = K.load(market, '5m', { from: y(2009), to: TO }); const F = frames(M5);
  const cost = COSTS[market], X = exclusions(market), D = F['1d'], AD = atr14(D);
  const inBad = (t) => X.some(([a, b]) => t >= a && t <= b);
  const { sigs, Z } = signals(F);
  const all = KEYS.flatMap((k) => Z[k]).sort((a, b) => a.at - b.at);
  const acc = { n: new Uint32Array(NCELL * 2 * 2), ms: new Float64Array(NCELL * 2 * NM), cm: new Float64Array(NCELL * 2 * NM) }; // [placebo][cell]
  let ntr = 0, npl = 0, bad = 0;
  for (const sg of sigs) {
    const T = F[TFS[sg.tf]], d = sg.d, buf = cost / 2, ts = sg.ts, exp = ts + LIFE_CANDLES * SEC[TFS[sg.tf]];
    const di = K.closedCount(D, ts) - 1; if (di < 15) continue; const atrD = AD[di];
    const edges = { 1: [], '-1': [] }; for (const o of all) { if (o.at > ts) break; if (o.end <= ts) continue; edges[-o.d].push(-o.d > 0 ? o.bot : o.top); }
    const boxE = sg.mode === 0 ? (d > 0 ? sg.box.hi : sg.box.lo) : (d > 0 ? sg.box.lo : sg.box.hi);
    const boxS = sg.mode === 0 ? (d > 0 ? sg.box.lo - buf : sg.box.hi + buf) : (d > 0 ? sg.ext - buf : sg.ext + buf);
    const keyS = d > 0 ? sg.z.bot - buf - 0.1 * atrD : sg.z.top + buf + 0.1 * atrD;
    const entries = [null, boxE, sg.egZ ? (d > 0 ? sg.egZ[1] : sg.egZ[0]) : undefined];
    for (let ei = 0; ei < 3; ei++) { if (entries[ei] === undefined) continue;
      for (let si = 0; si < 2; si++) {
        const stop = si === 0 ? boxS : keyS, entry = entries[ei], type = ei === 0 ? 'mkt' : 'lim';
        const ref = entry ?? sg.c0; if (!(d * (ref - stop) >= 2 * cost)) continue;
        for (let pl = 0; pl < 2; pl++) {
          // placebo: the side flipped, entry and stop mirrored around the trigger close (market: the same stop distance)
          const s = pl ? -d : d, en = entry == null ? null : pl ? 2 * sg.c0 - entry : entry, sp = pl ? 2 * sg.c0 - stop : stop, rf = en ?? sg.c0;
          const opp = near(edges[s], s, rf); let oppR = opp == null ? 2 : (s * (opp - rf)) / (s * (rf - sp)); if (!(oppR >= 1)) oppR = 2;
          const r = trade(M5, s, type, en, sp, ts, exp, oppR, cost);
          if (!r || r.t < FROM || r.t >= TO) continue; if (inBad(r.t)) { bad++; continue; }
          pl ? npl++ : ntr++;
          const m = monthIdx(r.t), half = r.t >= HALF ? 1 : 0, cr = cost / r.risk;
          for (let x = 0; x < EXITS.length; x++) {
            const c = pl * NCELL + cellIndex([sg.call, sg.key, sg.tf, sg.mode, sg.trig, sg.tod, ei * 2 + si, x]);
            acc.n[c * 2 + half]++; acc.ms[c * NM + m] += r.R[x]; acc.cm[c * NM + m] += cr; }
        }
      }
    }
  }
  const meta = { market, signals: sigs.length, trades: ntr, placebo: npl, droppedBad: bad, bars: M5.length, last: new Date(M5[M5.length - 1].t * 1000).toISOString() };
  if (dir) { fs.mkdirSync(dir, { recursive: true }); for (const k of Object.keys(acc)) fs.writeFileSync(path.join(dir, `${market}.${k}.bin`), Buffer.from(acc[k].buffer));
    fs.writeFileSync(path.join(dir, `${market}.json`), JSON.stringify(meta)); }
  return { acc, meta };
}

// ---- cut test: the signals before a cut are the same when the candles stop at the cut -------------------------------------
const sigKey = (s) => [s.key, s.tf, s.mode, s.trig, s.d, s.ts, s.call, s.tod, s.box.hi, s.box.lo, s.ext, s.egZ && s.egZ.join(), s.z.bot, s.z.top, s.c0].join('|');
export function cutTest(market, cuts = ['2011-06-15', '2013-02-20', '2015-09-09', '2017-04-12', '2019-08-21']) {
  const M5 = K.load(market, '5m', { from: y(2009), to: TO });
  const full = signals(frames(M5)).sigs; const out = [];
  for (const c of cuts) { const C = Date.parse(c + 'T13:37:00Z') / 1000, lim = C;
    const part = signals(frames(M5.filter((b) => b.e <= C)), { to: C }).sigs;
    const A = new Set(full.filter((s) => s.ts <= lim).map(sigKey)), B = new Set(part.filter((s) => s.ts <= lim).map(sigKey));
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

export function report(dir, markets = MARKETS) {
  const P = {}; for (const m of markets) { const rd = (k, Tp) => { const b = fs.readFileSync(path.join(dir, `${m}.${k}.bin`)); return new Tp(b.buffer, b.byteOffset, b.byteLength / Tp.BYTES_PER_ELEMENT); };
    P[m] = { n: rd('n', Uint32Array), ms: rd('ms', Float64Array), cm: rd('cm', Float64Array), meta: JSON.parse(fs.readFileSync(path.join(dir, `${m}.json`), 'utf8')) }; }
  const scopes = ['pool', ...markets], rows = { 0: [], 1: [] };
  const per = NCELL / 3; // cells without the call state
  const ms = new Float64Array(NM), cm = new Float64Array(NM);
  for (const pl of [0, 1]) for (const sc of scopes) { const list = sc === 'pool' ? markets : [sc];
    for (let rest = 0; rest < per; rest++) for (let dl = 0; dl < 3; dl++) {
      ms.fill(0); cm.fill(0); let nI = 0, nO = 0;
      const states = dl === 2 ? [0, 1, 2] : [dl];
      for (const m of list) { const A = P[m]; for (const st of states) { const c = pl * NCELL + st * per + rest;
        nI += A.n[c * 2]; nO += A.n[c * 2 + 1]; for (let k = 0; k < NM; k++) { ms[k] += A.ms[c * NM + k]; cm[k] += A.cm[c * NM + k]; } } }
      if (nI < 100) continue;
      const a = mstat(ms, 0, HM), b = mstat(ms, HM, NM); const net = Float64Array.from(ms, (x, k) => x - cm[k]);
      const an = mstat(net, 0, HM), bn = mstat(net, HM, NM);
      rows[pl].push({ sc, dl, rest, nI, nO, isMean: a.sum / nI, isT: a.t, oosMean: nO ? b.sum / nO : null, oosT: b.t,
        isNet: an.sum / nI, isNetT: an.t, oosNet: nO ? bn.sum / nO : null, oosNetT: bn.t });
    } }
  const name = (r) => { const v = decode(r.rest); return { scope: r.sc, dir: DIRS[r.dl], key: KEYS[v[1]], tf: TFS[v[2]], box: MODES[v[3]], trig: TRIGS[v[4]], tod: TODS[v[5]], es: ES[v[6]], exit: EXITS[v[7]],
    n1014: r.nI, mean1014: r4(r.isMean), t1014: r2(r.isT), n1519: r.nO, mean1519: r4(r.oosMean), t1519: r2(r.oosT), net1519: r4(r.oosNet), netT1519: r2(r.oosNetT), holm: r.holm == null ? null : +r.holm.toPrecision(3) }; };
  const bar = (R, net) => {
    const m1 = (r) => (net ? r.isNet : r.isMean), t1 = (r) => (net ? r.isNetT : r.isT), m2 = (r) => (net ? r.oosNet : r.oosMean), t2 = (r) => (net ? r.oosNetT : r.oosT);
    const disc = R.filter((r) => m1(r) > 0 && t1(r) >= 2);
    const pv = disc.map((r) => (r.nO >= 50 && m2(r) > 0 ? p1(t2(r), NM - HM - 1) : 1)); const adj = K.holm(pv);
    disc.forEach((r, i) => { r.holm = adj[i]; });
    const raw = disc.filter((r) => r.nO >= 50 && m2(r) > 0 && t2(r) >= 2), conf = raw.filter((r) => r.holm < 0.05);
    return { tested: R.length, discovery: disc.length, discoveryExpected: +(R.length * 0.0228).toFixed(1), rawConfirmed: raw.length,
      rawExpected: +(disc.length * 0.0228).toFixed(1), confirmed: conf.length,
      confirmedList: conf.sort((a, b) => t2(b) - t2(a)).slice(0, 60).map(name), rawList: raw.sort((a, b) => t2(b) - t2(a)).slice(0, 40).map(name),
      topDiscovery: disc.sort((a, b) => t1(b) - t1(a)).slice(0, 25).map(name) };
  };
  const real = bar(rows[0], false), placebo = bar(rows[1], false), realNet = bar(rows[0], true), placeboNet = bar(rows[1], true);
  // marginal reading per factor level: pooled, every trade-variant once, exit 2R, real trades
  const marg = {}; const dimName = [['call', ['with', 'against', 'zero']], ['key', KEYS], ['tf', TFS], ['box', MODES], ['trig', TRIGS], ['tod', TODS], ['es', ES]];
  dimName.forEach(([nm, lv], di) => { marg[nm] = {}; lv.forEach((l, li) => { let nI = 0, nO = 0, sI = 0, sO = 0, cI = 0, cO = 0;
    for (let c = 0; c < NCELL; c++) { const v = decode(c); if (v[7] !== 1 || v[di] !== li) continue;
      for (const m of markets) { const A = P[m]; nI += A.n[c * 2]; nO += A.n[c * 2 + 1];
        for (let k = 0; k < NM; k++) { if (k < HM) { sI += A.ms[c * NM + k]; cI += A.cm[c * NM + k]; } else { sO += A.ms[c * NM + k]; cO += A.cm[c * NM + k]; } } } }
    marg[nm][l] = { n1014: nI, mean1014: r4(sI / nI), n1519: nO, mean1519: r4(sO / nO), net1519: r4((sO - cO) / nO) }; }); });
  let verdict = real.confirmed === 0 ? 'FAIL' : real.confirmed > placebo.confirmed ? 'PASS' : 'INCONCLUSIVE';
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
    const bestTxt = best ? `best ${best.scope} ${best.key} ${best.tf} ${best.box} ${best.trig} ${best.es} ${best.exit}, ${best.dir}: ${f(best.mean1519)}R a trade in 2015-19, n ${best.n1519.toLocaleString('en-US')}, month t ${best.t1519.toFixed(2)}` : 'no cell';
    const headline = `${R.verdict}: ${R.real.confirmed} of ${R.real.tested.toLocaleString('en-US')} cells confirmed before costs after Holm (placebo ${R.placebo.confirmed}); ${bestTxt}`;
    const { confirmedList, rawList, topDiscovery, ...realC } = R.real;
    const out = { study: 'grid5-msnr-box', built: '2026-11-23', verdict: R.verdict, headline, basis: 'judged before costs (pre-registered); after costs beside',
      window: 'fills 2010-01-01 to 2019-12-31; discovery 2010-14, confirmation 2015-19', markets: MARKETS, factors: { DIRS, KEYS, TFS, MODES, TRIGS, TODS, ES, EXITS },
      real: R.real, placebo: { ...R.placebo, rawList: R.placebo.rawList.slice(0, 15), topDiscovery: R.placebo.topDiscovery.slice(0, 10) },
      realNet: { ...R.realNet, topDiscovery: R.realNet.topDiscovery.slice(0, 10) }, placeboNet: { ...R.placeboNet, topDiscovery: [], rawList: R.placeboNet.rawList.slice(0, 10) },
      best, marginals2R: R.marg, meta: R.meta, cut };
    fs.writeFileSync(path.join(HERE, 'result.json'), JSON.stringify(out, null, 1) + '\n'); console.log(headline);
    console.log(JSON.stringify({ verdict: R.verdict, real: { ...R.real, confirmedList: undefined, rawList: undefined, topDiscovery: undefined }, placebo: { ...R.placebo, confirmedList: undefined, rawList: undefined, topDiscovery: undefined } }, null, 1)); }
  else console.log('usage: run.mjs market <m> <dir> | cut <m> <dir> | report <dir>');
}
