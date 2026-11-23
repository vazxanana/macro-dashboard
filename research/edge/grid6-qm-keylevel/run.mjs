// research/edge/grid6-qm-keylevel/run.mjs - grid 6 of PREREGISTRATION.md (23 Nov 2026): the QM reversal (edgekit qms) on H1 /
// M15 / M5 right after a touch of a Daily or H4 key level of its side (V / A turn, engulf, failed engulf, DOM) or the previous
// day / week high or low, x the trend of the key level's timeframe x a sweep of a prior swing x session x entry (market, or a
// trade-through limit at the left shoulder) x exit (1R, 2R, 3R, measured move, trail), per market and pooled, with a placebo.
//   node --max-old-space-size=6000 research/edge/grid6-qm-keylevel/run.mjs market <m> <dir>   one market -> <dir>/<m>.*.bin
//   node research/edge/grid6-qm-keylevel/run.mjs cut <m> <dir>                                  cut test -> <dir>/<m>.cut.json
//   node research/edge/grid6-qm-keylevel/run.mjs report <dir>                                   pool, the bar -> result.json
// Research only: reads the edgekit candle cache; imports edgekit, combo-grid-3 (frames, buildZones, exclusions), combo-grid-2
// (COSTS) and dom-trade-through (findFill, manage, startIdx), none edited.
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import * as K from '../_lib/edgekit.mjs';
import { frames, buildZones, exclusions } from '../combo-grid-3/run.mjs';
import { COSTS } from '../combo-grid-2/run.mjs';
import { findFill, manage, startIdx } from '../dom-trade-through/run.mjs';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const y = (n) => Date.UTC(n, 0, 1) / 1000;
export const FROM = y(2010), TO = y(2020), HALF = y(2015), NM = 120, HM = 60;
export const MARKETS = ['xau', 'eurusd', 'gbpusd', 'usdjpy', 'audusd'];
export const KEYS = ['d1av', 'd1eg', 'd1ef', 'd1dom', 'h4av', 'h4eg', 'h4ef', 'h4dom', 'pd', 'pw'];
export const QTFS = ['1h', '15m', '5m'];
export const TRENDS = ['with', 'against', 'any'];        // stored: with, against, zero
export const SWEEPS = ['yes', 'no', 'any'];               // stored: yes, no
export const SESS = ['london', 'ny', 'other', 'any'];     // stored: london, ny, other
export const ENTRIES = ['mkt', 'lim'];
export const EXITS = ['1R', '2R', '3R', 'mm', 'trail'];
const XSLOT = [0, 1, 2, 5, 6];                            // manage() R slots: 1R 2R 3R opp(= the measured move) trail
export const TOUCH_N = 12, SWEEP_BACK = 48, LIFE_CANDLES = 24, CAP = 2 * 86400, QK = 3;
const SEC = { '1h': 3600, '15m': 900, '5m': 300 };
const DIMS = [KEYS.length, QTFS.length, 3, 2, 3, ENTRIES.length, EXITS.length];   // stored dims
export const NCELL = DIMS.reduce((a, b) => a * b, 1);                             // 5,400
export const NREPORT = KEYS.length * QTFS.length * 3 * 3 * 4 * ENTRIES.length * EXITS.length; // 10,800
export const cellIndex = (v) => v.reduce((a, x, i) => a * DIMS[i] + x, 0);
export const monthIdx = (t) => { const d = new Date(t * 1000); return (d.getUTCFullYear() - 2010) * 12 + d.getUTCMonth(); };
const sessOf = (ts) => { const h = new Date(ts * 1000).getUTCHours(); return h >= 7 && h < 12 ? 0 : h >= 12 && h < 17 ? 1 : 2; };

// ---- key levels --------------------------------------------------------------------------------------------------------
// previous candle high / low of L, live for the whole next candle: { d, bot, top, at, end }
export function prevHL(L) { const out = [];
  for (let k = 1; k < L.length; k++) { const p = L[k - 1];
    out.push({ d: -1, bot: p.h, top: p.h, at: p.e, end: L[k].e }, { d: 1, bot: p.l, top: p.l, at: p.e, end: L[k].e }); }
  return out; }
export function keyZones(F) {
  const Z = {};
  for (const [tf, p] of [['1d', 'd1'], ['4h', 'h4']]) for (const k of ['av', 'eg', 'ef', 'dom']) Z[p + k] = buildZones(k, F[tf]);
  Z.pd = prevHL(F['1d']); Z.pw = prevHL(F['1w']);
  return Z;
}
const KEY_TF = (k) => (k.startsWith('d1') || k === 'pd' ? '1d' : k.startsWith('h4') ? '4h' : '1w');
// per candle of T and side: 1 when that candle starts while a zone of the side is alive and trades into it
function touchMarks(T, zones) {
  const up = new Uint8Array(T.length), dn = new Uint8Array(T.length);
  for (const z of zones) { const m = z.d > 0 ? up : dn;
    for (let j = startIdx(T, z.at); j < T.length && T[j].t < z.end; j++) if (T[j].l <= z.top && T[j].h >= z.bot) m[j] = 1; }
  const pre = (m) => { const p = new Uint32Array(m.length + 1); for (let i = 0; i < m.length; i++) p[i + 1] = p[i] + m[i]; return p; };
  return { 1: pre(up), '-1': pre(dn) };
}

// ---- signals (closed candles only) -------------------------------------------------------------------------------------
// every QM of the three timeframes with what it touched: { tf, i, ts, d, head, shoulder, level, c0, brk, keys (bits), trend[],
// sweep, sess }
export function signals(F, { from = FROM, to = TO } = {}) {
  const Z = keyZones(F), out = [];
  const st = { '1d': K.structure(F['1d'], 3).side, '4h': K.structure(F['4h'], 3).side, '1w': K.structure(F['1w'], 3).side };
  for (let ti = 0; ti < QTFS.length; ti++) {
    const T = F[QTFS[ti]], marks = KEYS.map((k) => touchMarks(T, Z[k]));
    const sw = K.swings(T, QK);
    const swH = sw.filter((s) => s.type === 'H'), swL = sw.filter((s) => s.type === 'L');
    for (const q of K.qms(T, QK)) {
      const ts = q.t; if (ts < from - 3 * 86400 || ts >= to) continue;
      const d = q.side, i = q.i, a = Math.max(0, i - TOUCH_N + 1);
      let keys = 0; KEYS.forEach((k, ki) => { const p = marks[ki][d]; if (p[i + 1] - p[a] > 0) keys |= 1 << ki; });
      if (!keys) continue;
      const trend = KEYS.map((k) => { const L = F[KEY_TF(k)], li = K.closedCount(L, ts) - 1, s = li >= 0 ? st[KEY_TF(k)][li] : 0;
        return s === d ? 0 : s === -d ? 1 : 2; });
      // sweep: the head beyond a swing (same side as the shoulder) confirmed before the head, made within 48 candles before it,
      // beyond the left shoulder
      const list = d < 0 ? swH : swL; let sweep = 1;
      for (const s of list) { if (s.i < q.headI - SWEEP_BACK || s.ci >= q.headI) continue;
        if (d < 0 ? s.price > q.shoulder && q.head > s.price : s.price < q.shoulder && q.head < s.price) { sweep = 0; break; } }
      const brk = d < 0 ? T[i].l : T[i].h;
      out.push({ tf: ti, i, ts, d, head: q.head, shoulder: q.shoulder, level: q.level, c0: T[i].c, brk, keys, trend, sweep, sess: sessOf(ts) });
    }
  }
  return { sigs: out };
}

// ---- trades -------------------------------------------------------------------------------------------------------------
// one order: returns { t, risk, R (5 exits) } or null
export function trade(M5, s, type, entry, stop, ts, exp, mmR, cost) {
  let fi, fill, full;
  if (type === 'mkt') { fi = startIdx(M5, ts); if (fi >= M5.length) return null; fill = M5[fi].o; full = true; }
  else { const f = findFill(M5, s, entry, stop, ts, exp, 'through', cost / 2); if (!f) return null; fi = f.i; fill = f.fill; full = false; }
  if (!(s * (fill - stop) > 0)) return null;           // a market fill already past the stop: not taken
  const r = manage(M5, s, fi, fill, stop, CAP, full, mmR); if (!r || !(r.risk >= cost)) return null;
  return { t: r.t, risk: r.risk, R: XSLOT.map((k) => r.R[k]) };
}
export function runMarket(market, { dir } = {}) {
  const M5 = K.load(market, '5m', { from: y(2009), to: TO }); const F = frames(M5);
  const cost = COSTS[market], X = exclusions(market), buf = cost / 2;
  const inBad = (t) => X.some(([a, b]) => t >= a && t <= b);
  const { sigs } = signals(F);
  const acc = { n: new Uint32Array(NCELL * 2 * 2), ms: new Float64Array(NCELL * 2 * NM), cm: new Float64Array(NCELL * 2 * NM) }; // [placebo][cell]
  let ntr = 0, npl = 0, bad = 0;
  for (const sg of sigs) {
    const d = sg.d, ts = sg.ts, exp = ts + LIFE_CANDLES * SEC[QTFS[sg.tf]];
    const stop = sg.head - d * buf, target = sg.brk - d * Math.abs(sg.head - sg.brk);
    for (let ei = 0; ei < 2; ei++) {
      const entry = ei === 0 ? null : sg.shoulder, ref = entry ?? sg.c0;
      if (!(d * (ref - stop) >= 2 * cost)) continue;
      let mmR = (d * (target - ref)) / (d * (ref - stop)); if (!(mmR >= 1)) mmR = 1;
      for (let pl = 0; pl < 2; pl++) {
        const s = pl ? -d : d, en = entry == null ? null : pl ? 2 * sg.c0 - entry : entry, sp = pl ? 2 * sg.c0 - stop : stop;
        if (!(s * ((en ?? sg.c0) - sp) > 0)) throw new Error('stop on the wrong side');
        const r = trade(M5, s, ei === 0 ? 'mkt' : 'lim', en, sp, ts, exp, mmR, cost);
        if (!r || r.t < FROM || r.t >= TO) continue; if (inBad(r.t)) { bad++; continue; }
        pl ? npl++ : ntr++;
        const m = monthIdx(r.t), half = r.t >= HALF ? 1 : 0, cr = cost / r.risk;
        for (let ki = 0; ki < KEYS.length; ki++) { if (!(sg.keys & (1 << ki))) continue;
          for (let x = 0; x < EXITS.length; x++) {
            const c = pl * NCELL + cellIndex([ki, sg.tf, sg.trend[ki], sg.sweep, sg.sess, ei, x]);
            acc.n[c * 2 + half]++; acc.ms[c * NM + m] += r.R[x]; acc.cm[c * NM + m] += cr; } }
      }
    }
  }
  const meta = { market, signals: sigs.length, trades: ntr, placebo: npl, droppedBad: bad, bars: M5.length, last: new Date(M5[M5.length - 1].t * 1000).toISOString() };
  if (dir) { fs.mkdirSync(dir, { recursive: true }); for (const k of Object.keys(acc)) fs.writeFileSync(path.join(dir, `${market}.${k}.bin`), Buffer.from(acc[k].buffer));
    fs.writeFileSync(path.join(dir, `${market}.json`), JSON.stringify(meta)); }
  return { acc, meta };
}

// ---- cut test -----------------------------------------------------------------------------------------------------------
export const sigKey = (s) => [s.tf, s.i, s.ts, s.d, s.head, s.shoulder, s.level, s.c0, s.brk, s.keys, s.trend.join(''), s.sweep, s.sess].join('|');
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

export function report(dir, markets = MARKETS) {
  const P = {}; for (const m of markets) { const rd = (k, Tp) => { const b = fs.readFileSync(path.join(dir, `${m}.${k}.bin`)); return new Tp(b.buffer, b.byteOffset, b.byteLength / Tp.BYTES_PER_ELEMENT); };
    P[m] = { n: rd('n', Uint32Array), ms: rd('ms', Float64Array), cm: rd('cm', Float64Array), meta: JSON.parse(fs.readFileSync(path.join(dir, `${m}.json`), 'utf8')) }; }
  const scopes = ['pool', ...markets], rows = { 0: [], 1: [] };
  const ms = new Float64Array(NM), cm = new Float64Array(NM);
  const TRS = [[0], [1], [0, 1, 2]], SWS = [[0], [1], [0, 1]], SSS = [[0], [1], [2], [0, 1, 2]];
  for (const pl of [0, 1]) for (const sc of scopes) { const list = sc === 'pool' ? markets : [sc];
    for (let ki = 0; ki < KEYS.length; ki++) for (let tf = 0; tf < QTFS.length; tf++) for (let ei = 0; ei < 2; ei++) for (let x = 0; x < EXITS.length; x++)
      for (let tr = 0; tr < 3; tr++) for (let sw = 0; sw < 3; sw++) for (let ss = 0; ss < 4; ss++) {
        ms.fill(0); cm.fill(0); let nI = 0, nO = 0;
        for (const m of list) { const A = P[m];
          for (const a of TRS[tr]) for (const b of SWS[sw]) for (const c3 of SSS[ss]) { const c = pl * NCELL + cellIndex([ki, tf, a, b, c3, ei, x]);
            nI += A.n[c * 2]; nO += A.n[c * 2 + 1]; for (let k = 0; k < NM; k++) { ms[k] += A.ms[c * NM + k]; cm[k] += A.cm[c * NM + k]; } } }
        if (nI < 100) continue;
        const a = mstat(ms, 0, HM), b = mstat(ms, HM, NM); const net = Float64Array.from(ms, (v, k) => v - cm[k]);
        const an = mstat(net, 0, HM), bn = mstat(net, HM, NM);
        rows[pl].push({ sc, v: [ki, tf, tr, sw, ss, ei, x], nI, nO, isMean: a.sum / nI, isT: a.t, oosMean: nO ? b.sum / nO : null, oosT: b.t,
          isNet: an.sum / nI, isNetT: an.t, oosNet: nO ? bn.sum / nO : null, oosNetT: bn.t });
      } }
  const name = (r) => { const v = r.v; return { scope: r.sc, key: KEYS[v[0]], tf: QTFS[v[1]], trend: TRENDS[v[2]], sweep: SWEEPS[v[3]], sess: SESS[v[4]], entry: ENTRIES[v[5]], exit: EXITS[v[6]],
    n1014: r.nI, mean1014: r4(r.isMean), t1014: r2(r.isT), n1519: r.nO, mean1519: r4(r.oosMean), t1519: r2(r.oosT), net1519: r4(r.oosNet), netT1519: r2(r.oosNetT), holm: r.holm == null ? null : +r.holm.toPrecision(3) }; };
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
  // marginals: pooled, real trades, exit 2R, every other stored level once
  const marg = {}; const dn = [['key', KEYS], ['tf', QTFS], ['trend', ['with', 'against', 'zero']], ['sweep', ['yes', 'no']], ['sess', ['london', 'ny', 'other']], ['entry', ENTRIES]];
  const decode = (c) => { const v = []; for (let i = DIMS.length - 1; i >= 0; i--) { v[i] = c % DIMS[i]; c = (c - v[i]) / DIMS[i]; } return v; };
  dn.forEach(([nm, lv], di) => { marg[nm] = {}; lv.forEach((l, li) => { let nI = 0, nO = 0, sI = 0, sO = 0, cO = 0;
    for (let c = 0; c < NCELL; c++) { const v = decode(c); if (v[6] !== 1 || v[di] !== li) continue;
      for (const m of markets) { const A = P[m]; nI += A.n[c * 2]; nO += A.n[c * 2 + 1];
        for (let k = 0; k < NM; k++) { if (k < HM) sI += A.ms[c * NM + k]; else { sO += A.ms[c * NM + k]; cO += A.cm[c * NM + k]; } } } }
    marg[nm][l] = { n1014: nI, mean1014: r4(sI / nI), n1519: nO, mean1519: r4(sO / nO), net1519: r4((sO - cO) / nO) }; }); });
  const verdict = real.confirmed === 0 ? 'FAIL' : real.confirmed > placebo.confirmed ? 'PASS' : 'INCONCLUSIVE';
  return { real, placebo, realNet, placeboNet, marg, verdict, meta: Object.fromEntries(markets.map((m) => [m, P[m].meta])) };
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
    const bestTxt = best ? `best ${best.scope} ${best.key} ${best.tf} QM, trend ${best.trend}, sweep ${best.sweep}, ${best.sess}, ${best.entry} ${best.exit}: ${f(best.mean1519)}R a trade in 2015-19, n ${best.n1519.toLocaleString('en-US')}, month t ${best.t1519.toFixed(2)}` : 'no cell';
    const headline = `${R.verdict}: ${R.real.confirmed} of ${R.real.tested.toLocaleString('en-US')} cells confirmed before costs after Holm (placebo ${R.placebo.confirmed}); ${bestTxt}`;
    const out = { study: 'grid6-qm-keylevel', built: '2026-11-23', verdict: R.verdict, headline, basis: 'judged before costs (pre-registered); after costs beside',
      window: 'fills 2010-01-01 to 2019-12-31; discovery 2010-14, confirmation 2015-19', markets: MARKETS, factors: { KEYS, QTFS, TRENDS, SWEEPS, SESS, ENTRIES, EXITS },
      real: R.real, placebo: { ...R.placebo, rawList: R.placebo.rawList.slice(0, 15), topDiscovery: R.placebo.topDiscovery.slice(0, 10) },
      realNet: { ...R.realNet, topDiscovery: R.realNet.topDiscovery.slice(0, 10) }, placeboNet: { ...R.placeboNet, topDiscovery: [], rawList: R.placeboNet.rawList.slice(0, 10) },
      best, marginals2R: R.marg, meta: R.meta, cut };
    fs.writeFileSync(path.join(HERE, 'result.json'), JSON.stringify(out, null, 1) + '\n'); console.log(headline);
    console.log(JSON.stringify({ verdict: R.verdict, real: { ...R.real, confirmedList: undefined, rawList: undefined, topDiscovery: undefined }, placebo: { ...R.placebo, confirmedList: undefined, rawList: undefined, topDiscovery: undefined } }, null, 1)); }
  else console.log('usage: run.mjs market <m> <dir> | cut <m> <dir> | report <dir>');
}
