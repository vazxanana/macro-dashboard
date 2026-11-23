// research/edge/mosha-cf-risk/run.mjs - low-risk CF (on the VR's timeframe) against high-risk CF (one timeframe lower) in the
// desk's Mosha sequence, 2010-2019. Pre-registered in PREREGISTRATION.md (committed alone first).
//   EDGE_DATA=<cache> node research/edge/mosha-cf-risk/run.mjs market <xau|eurusd|gbpusd|usdjpy|audusd> <out dir>
//   node research/edge/mosha-cf-risk/run.mjs report <out dir>        -> result.json beside this file, printed summary
// The reading is the desk's own: assets/mosha-sop.js sopTrades on the page's functions (council/mosha-desk.mjs loadFns), unchanged.
import fs from 'node:fs';
import path from 'node:path';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';
import * as K from '../_lib/edgekit.mjs';
import { COSTS, exclusions } from '../combo-grid-2/run.mjs';

const require = createRequire(import.meta.url);
const HERE = path.dirname(fileURLToPath(import.meta.url));
export const MARKETS = ['xau', 'eurusd', 'gbpusd', 'usdjpy', 'audusd'];
export const CHAINS = [['4h', '1h'], ['1h', '15m']];
export const YEARS = [2010, 2019], SPLIT = Date.UTC(2015, 0, 1) / 1000;
export const GATE = 0.8, MIN_N = 100;

const cv = (A) => A.map((b) => ({ time: b.t, open: b.o, high: b.h, low: b.l, close: b.c }));
const at = (A, t) => { let lo = 0, hi = A.length; while (lo < hi) { const m = (lo + hi) >> 1; if (A[m].time < t) lo = m + 1; else hi = m; } return lo; };

// the code's limit at the CF line, applied to a CF zone handed out by sopTrades (cfOut): see PREREGISTRATION.md
export function simLimit(SOP, mk, z, Cc, sec, fine) {
  const D = z.dir, entry = D > 0 ? z.hi : z.lo, far = D > 0 ? z.lo : z.hi, S = SOP.sizes(mk, entry), stop = D > 0 ? far - S.buf : far + S.buf, r = Math.abs(entry - stop), target = z.tgt;
  if (!(r > S.rmin && r <= S.rmax) || !(D > 0 ? stop < entry && target > entry : stop > entry && target < entry)) return null;
  let n = 0;
  for (let k = at(Cc, z.known); k < Cc.length; k++) { const c = Cc[k], tc = c.time + sec;
    let fT = null, done = false;
    for (let fi = at(fine, c.time); fi < fine.length && fine[fi].time < tc; fi++) { const fb = fine[fi];
      if (D > 0 ? fb.low <= entry : fb.high >= entry) { fT = fb.time; break; }
      if (D > 0 ? fb.high >= target : fb.low <= target) { done = true; break; } }
    if (fT != null) { const tr = { side: D, entry, stop, target, t: fT, known: z.known, cfClose: null }; Object.assign(tr, SOP.outcome(tr, fine, fT, true)); return tr; }
    if (done || (D > 0 ? c.close < far : c.close > far) || ++n >= SOP.CF_LIMIT) return null; }
  return null;
}

// a placebo of one trade: same side, stop distance and target distance, k CF-timeframe candles earlier (no structure)
export function placebo(SOP, tr, Cc, sec, fine, rnd, type) {
  const k = 5 + Math.floor(rnd() * 96), idx = at(Cc, (type === 'eg' ? tr.t : tr.known) - sec), j = idx - k;
  if (!(idx < Cc.length) || j < 0) return null;
  const D = tr.side, r0 = Math.abs(tr.entry - tr.stop), td = Math.abs(tr.target - tr.entry);
  if (type === 'eg') { const e = Cc[j].close, p = { side: D, entry: e, stop: e - D * r0, target: e + D * td, t: Cc[j].time + sec };
    return Object.assign(p, SOP.outcome(p, fine, p.t, false)); }
  const e = Cc[j].close + (tr.entry - Cc[idx].close);
  for (let q = j + 1, n = 0; q < Cc.length && n < SOP.CF_LIMIT; q++, n++) { const c = Cc[q];
    for (let fi = at(fine, c.time); fi < fine.length && fine[fi].time < c.time + sec; fi++) { const fb = fine[fi];
      if (D > 0 ? fb.low <= e : fb.high >= e) { const p = { side: D, entry: e, stop: e - D * r0, target: e + D * td, t: fb.time }; return Object.assign(p, SOP.outcome(p, fine, fb.time, true)); } } }
  return null;
}
export function flip(SOP, tr, fine) {
  const D = -tr.side, r0 = Math.abs(tr.entry - tr.stop), td = Math.abs(tr.target - tr.entry), p = { side: D, entry: tr.entry, stop: tr.entry - D * r0, target: tr.entry + D * td, t: tr.t };
  return Object.assign(p, SOP.outcome(p, fine, tr.t, false));
}

async function market(mk, outDir) {
  const SOP = require('../../../assets/mosha-sop.js');
  const { loadFns } = await import('../../../council/mosha-desk.mjs');
  const F = loadFns(), cost = COSTS[mk], X = exclusions(mk), rnd = K.rng(1);
  const bad = (a, b) => X.some((x) => x[0] <= b && x[1] >= a);
  const rows = { eg: [], lim: [], egP: [], limP: [], egFlip: [], gate: { code: 0, sim: 0, matched: 0 }, open: 0, excluded: 0 };
  const keep = (tr, Y, chain, risk, kind) => {
    if (!(tr.t >= Date.UTC(Y, 0, 1) / 1000 && tr.t < Date.UTC(Y + 1, 0, 1) / 1000)) return null;
    if (tr.R == null) { rows.open++; return null; }
    if (bad(tr.t, tr.endT)) { rows.excluded++; return null; }
    const r0 = Math.abs(tr.entry - tr.stop);
    return { mk, chain, risk, kind, side: tr.side, t: tr.t, exitT: tr.endT, R: +tr.R.toFixed(4), Rnet: +(tr.R - cost / r0).toFixed(4), r0 };
  };
  for (let Y = YEARS[0]; Y <= YEARS[1]; Y++) {
    const M5 = K.load(mk, '5m', { from: `${Y - 1}-01-01`, to: `${Y + 1}-02-01` }); if (!M5.length) continue;
    const last = M5[M5.length - 1].e, B = { '5m': cv(M5) };
    for (const [tf, s] of [['15m', 900], ['1h', 3600], ['4h', 14400]]) B[tf] = cv(K.resample(M5, s)).filter((b) => b.time + s <= last);
    const fine = B['5m'], from = Date.UTC(Y, 0, 1) / 1000;
    for (const pair of CHAINS) {
      SOP.LADDER.length = 0; SOP.LADDER.push(pair);
      const chain = pair.join('>'), l = pair[1], hiTf = SOP.CFTF[l];
      for (const risk of ['low', 'high']) {
        const cfo = [], tf = risk === 'low' ? l : hiTf, Cc = B[tf], sec = SOP.SEC[tf];
        const recs = SOP.sopTrades(B, F, { from, market: mk, nest: false, case2: false, cfOut: cfo, ...(risk === 'low' ? { cf: 'same' } : {}) });
        const id = (r) => String(r.id).replace(/^[a-z]+:/, '');
        for (const r of recs.filter((x) => /^sop-(i-)?(1h|15m)-\d+$/.test(id(x)))) {
          if (r.case2 || r.cfLimit || r.retest) continue;
          const k = keep(r, Y, chain, risk, 'eg'); if (!k) continue; rows.eg.push(k);
          if (risk === 'low') { const p = placebo(SOP, r, Cc, sec, fine, rnd, 'eg'); const kp = p && keep(p, Y, chain, risk, 'egP'); if (kp) rows.egP.push(kp);
            const f = flip(SOP, r, fine); const kf = keep(f, Y, chain, risk, 'egFlip'); if (kf) rows.egFlip.push(kf); } }
        const cfz = cfo.filter((z) => z.kind === 'cf'), sims = [];
        for (const z of cfz) { const s = simLimit(SOP, mk, z, Cc, sec, fine); if (s) { s.cfClose = Cc[at(Cc, z.known - sec)]?.close; sims.push(s); } }
        if (risk === 'high') {   // the gate: the simulator against the code's own limits
          const code = recs.filter((x) => x.cfLimit && x.t >= from && x.t < Date.UTC(Y + 1, 0, 1) / 1000), simY = sims.filter((s) => s.t >= from && s.t < Date.UTC(Y + 1, 0, 1) / 1000);
          const key = (x) => `${x.side}|${x.t}|${(+x.entry).toPrecision(9)}`, S = new Set(simY.map(key));
          rows.gate.code += code.length; rows.gate.sim += simY.length; rows.gate.matched += code.filter((x) => S.has(key(x))).length;
          for (const r of code) { const k = keep(r, Y, chain, risk, 'lim'); if (k) rows.lim.push(k); }
        } else {
          const seen = new Set();
          for (const s of sims) { const kk = `${s.side}|${s.t}|${s.entry}`; if (seen.has(kk)) continue; seen.add(kk);
            const k = keep(s, Y, chain, risk, 'lim'); if (!k) continue; rows.lim.push(k);
            const p = placebo(SOP, s, Cc, sec, fine, rnd, 'lim'); const kp = p && keep(p, Y, chain, risk, 'limP'); if (kp) rows.limP.push(kp); }
        }
      }
    }
    console.log(mk, Y, 'eg', rows.eg.length, 'lim', rows.lim.length, 'gate', JSON.stringify(rows.gate));
  }
  fs.mkdirSync(outDir, { recursive: true });
  fs.writeFileSync(path.join(outDir, mk + '.json'), JSON.stringify(rows));
}

// ---- statistics ------------------------------------------------------------------------------------------------------
const oneSided = (t, p) => (t == null || p == null ? 1 : t > 0 ? p / 2 : 1 - p / 2);
export function block(arr, key = 'R') {
  const s = (a) => { const x = K.stats(a, { key, time: 'exitT' }); return { n: x.n, meanR: x.meanR == null ? null : +x.meanR.toFixed(4), total: +x.total.toFixed(2), tMonth: x.tMonth == null ? null : +x.tMonth.toFixed(2), pMonth: x.pMonth }; };
  return { all: s(arr), h1: s(arr.filter((x) => x.exitT < SPLIT)), h2: s(arr.filter((x) => x.exitT >= SPLIT)) };
}
export function welch(a, b) {
  const m = (x) => x.reduce((p, q) => p + q, 0) / x.length, v = (x, mu) => x.reduce((p, q) => p + (q - mu) ** 2, 0) / (x.length - 1);
  if (a.length < 2 || b.length < 2) return { diff: null, t: null, p: null };
  const ma = m(a), mb = m(b), va = v(a, ma) / a.length, vb = v(b, mb) / b.length, t = (ma - mb) / Math.sqrt(va + vb);
  const df = (va + vb) ** 2 / (va ** 2 / (a.length - 1) + vb ** 2 / (b.length - 1));
  return { diff: +(ma - mb).toFixed(4), t: +t.toFixed(2), p: K.pFromT(t, df) };
}
const pick = (rows, f) => rows.filter(f);
export function judge(rows) {
  const eg = (risk) => pick(rows.eg, (x) => x.risk === risk), low = eg('low'), high = eg('high'), limLow = pick(rows.lim, (x) => x.risk === 'low');
  const R = (a) => a.map((x) => x.R), half = (a, h) => a.filter((x) => (h === 1 ? x.exitT < SPLIT : x.exitT >= SPLIT));
  const T1 = block(low), T3 = block(limLow), P1 = welch(R(low), R(rows.egP)), P3 = welch(R(limLow), R(rows.limP));
  const T2 = { all: welch(R(low), R(high)), h1: welch(R(half(low, 1)), R(half(high, 1))), h2: welch(R(half(low, 2)), R(half(high, 2))) };
  const gateRate = rows.gate.code ? rows.gate.matched / rows.gate.code : 0, gateOk = gateRate >= GATE;
  const p = [oneSided(T1.all.tMonth, T1.all.pMonth), oneSided(T2.all.t, T2.all.p), oneSided(T3.all.tMonth, T3.all.pMonth)], hp = K.holm(p);
  const halves = (b) => b.h1.meanR > 0 && b.h1.tMonth >= 2 && b.h2.meanR > 0 && b.h2.tMonth >= 2;
  const pass1 = halves(T1) && P1.diff > 0 && P1.t >= 2 && hp[0] <= 0.05;
  const pass2 = T2.h1.diff > 0 && T2.h2.diff > 0 && T2.all.t >= 2 && hp[1] <= 0.05;
  const pass3 = gateOk && halves(T3) && P3.diff > 0 && P3.t >= 2 && hp[2] <= 0.05;
  const verdict = low.length < MIN_N ? 'INCONCLUSIVE' : pass1 || pass3 ? 'PASS' : 'FAIL';
  return { verdict, T1: { ...T1, net: block(low, 'Rnet'), placebo: { ...block(rows.egP), vs: P1 }, flipped: block(rows.egFlip), holmP: hp[0], pass: pass1 },
    T2: { ...T2, high: block(high), highNet: block(high, 'Rnet'), holmP: hp[1], pass: pass2 },
    T3: { ...T3, net: block(limLow, 'Rnet'), placebo: { ...block(rows.limP), vs: P3 }, holmP: hp[2], pass: pass3, gate: { ...rows.gate, rate: +gateRate.toFixed(3), ok: gateOk } },
    highLimit: { gross: block(pick(rows.lim, (x) => x.risk === 'high')), net: block(pick(rows.lim, (x) => x.risk === 'high'), 'Rnet') } };
}
function breakdown(rows) {
  const out = {};
  for (const [name, a] of [['lowEG', rows.eg.filter((x) => x.risk === 'low')], ['highEG', rows.eg.filter((x) => x.risk === 'high')], ['lowLimit', rows.lim.filter((x) => x.risk === 'low')], ['highLimit', rows.lim.filter((x) => x.risk === 'high')]]) {
    const g = (f) => { const b = K.stats(a.filter(f), { key: 'R', time: 'exitT' }); return { n: b.n, meanR: b.n ? +b.meanR.toFixed(3) : null, tMonth: b.tMonth == null ? null : +b.tMonth.toFixed(2) }; };
    out[name] = { byChain: Object.fromEntries(CHAINS.map((c) => [c.join('>'), g((x) => x.chain === c.join('>'))])), byMarket: Object.fromEntries(MARKETS.map((m) => [m, g((x) => x.mk === m)])),
      byYear: Object.fromEntries(Array.from({ length: 10 }, (_, i) => 2010 + i).map((y) => [y, g((x) => new Date(x.exitT * 1000).getUTCFullYear() === y)])) };
  }
  return out;
}
export function report(dir) {
  const rows = { eg: [], lim: [], egP: [], limP: [], egFlip: [], gate: { code: 0, sim: 0, matched: 0 }, open: 0, excluded: 0 };
  for (const m of MARKETS) { const f = path.join(dir, m + '.json'); if (!fs.existsSync(f)) throw new Error('missing ' + f);
    const r = JSON.parse(fs.readFileSync(f, 'utf8')); for (const k of ['eg', 'lim', 'egP', 'limP', 'egFlip']) rows[k].push(...r[k]);
    for (const k of ['code', 'sim', 'matched']) rows.gate[k] += r.gate[k]; rows.open += r.open; rows.excluded += r.excluded; }
  const J = judge(rows), f3 = (v) => (v == null ? 'n/a' : (v >= 0 ? '+' : '') + v.toFixed(3));
  const headline = `T1 low-risk CF, EG entry: ${f3(J.T1.all.meanR)}R a trade before costs (n ${J.T1.all.n}, month t ${J.T1.all.tMonth}); high-risk ${f3(J.T2.high.all.meanR)}R (n ${J.T2.high.all.n}); T3 limit at the CF line ${f3(J.T3.all.meanR)}R (n ${J.T3.all.n}, month t ${J.T3.all.tMonth}).`;
  const res = { topic: 'mosha-cf-risk', built: '2026-11-23', verdict: J.verdict, headline, system: 'Mosha sequence (desk reading), BO > VR > CF, low-risk vs high-risk CF',
    data: 'OANDA mid 5m, xau eurusd gbpusd usdjpy audusd, trades 2010-2019', chains: CHAINS.map((c) => c.join('>')), open: rows.open, excluded: rows.excluded, ...J, breakdown: breakdown(rows) };
  fs.writeFileSync(path.join(HERE, 'result.json'), JSON.stringify(res, null, 1) + '\n');
  console.log(JSON.stringify({ verdict: J.verdict, headline, T1: J.T1.all, T1h: [J.T1.h1, J.T1.h2], T1net: J.T1.net.all, P1: J.T1.placebo.vs, T2: J.T2.all, T2h: [J.T2.h1, J.T2.h2], T3: J.T3.all, T3h: [J.T3.h1, J.T3.h2], T3net: J.T3.net.all, P3: J.T3.placebo.vs, gate: J.T3.gate, holm: [J.T1.holmP, J.T2.holmP, J.T3.holmP] }, null, 1));
  return res;
}

if (process.argv[1] && fileURLToPath(import.meta.url) === path.resolve(process.argv[1])) {
  const [cmd, a, b] = process.argv.slice(2);
  if (cmd === 'market') market(a, b).catch((e) => { console.error(e); process.exit(1); });
  else if (cmd === 'report') report(a);
  else console.error('usage: run.mjs market <mk> <out> | report <out>');
}
