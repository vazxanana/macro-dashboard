// research/edge/msnr-main-6r/run.mjs - the earlier scalp method (the MSNR desk's msnrTrades) at 1R-6R on 2010-2019.
// node research/edge/msnr-main-6r/run.mjs market <m> <outDir>   one market: every target, placebo, paired 1R re-simulation
// node research/edge/msnr-main-6r/run.mjs report <outDir>        pool, tests of PREREGISTRATION.md, write result.json
// node research/edge/msnr-main-6r/run.mjs cut                     the cut test (gold 2009-2014, cut 2013-06-30)
// Research only: imports council/edge-desks.mjs (never edited) and edgekit; writes only <outDir> and its own result.json.
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import * as K from '../_lib/edgekit.mjs';
import { COSTS, exclusions } from '../combo-grid-2/run.mjs';
import { msnrTrades, MSNR } from '../../../council/edge-desks.mjs';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const D = (s) => Date.UTC(...s.split('-').map((x, i) => (i === 1 ? +x - 1 : +x))) / 1000;
export const FROM = D('2010-01-01'), SPLIT = D('2015-01-01'), END = D('2020-01-01'), WARM = D('2009-01-01');
export const TARGETS = [1, 2, 3, 4, 5, 6];
export const MARKETS = K.MARKETS;

// the desk's candles: { time, open, high, low, close }
const desk = (bars) => bars.map((b) => ({ time: b.t, open: b.o, high: b.h, low: b.l, close: b.c }));
export function frames(M5k) { return { '5m': desk(M5k), '1h': desk(K.resample(M5k, 3600)) }; }

// read with one target for both windows (the exported MSNR object, put back after)
export function readAt(B, market, rr, o = {}) {
  const keep = { rrMain: MSNR.rrMain, rrOther: MSNR.rrOther };
  try { MSNR.rrMain = rr; MSNR.rrOther = rr; return msnrTrades(B, { from: FROM, market, ...o }); }
  finally { MSNR.rrMain = keep.rrMain; MSNR.rrOther = keep.rrOther; }
}
// a copy of the desk's msnrSim (gated against the desk's own R)
export function sim(M5, i, c, rr, hold = MSNR.hold) {
  const s = c.side, target = c.entry + s * rr * c.r0;
  for (let k = i; k < M5.length; k++) { const b = M5[k];
    if (k > i && b.time >= c.t + hold) return { closed: b.time, px: b.open };
    if (k > i && (s > 0 ? b.open <= c.stop : b.open >= c.stop)) return { closed: b.time, px: b.open };
    if (s > 0 ? b.low <= c.stop : b.high >= c.stop) return { closed: b.time, px: c.stop };
    if (s > 0 ? b.high >= target : b.low <= target) return { closed: b.time, px: target }; }
  return null;
}
const idxOf = (M5, t) => { let lo = 0, hi = M5.length - 1; while (lo < hi) { const m = (lo + hi) >> 1; if (M5[m].time < t) lo = m + 1; else hi = m; } return M5[lo].time === t ? lo : -1; };
const inBad = (X, a, b) => X.some(([x, y]) => x <= b && y >= a);

export function runMarket(market, M5k) {
  const B = frames(M5k), M5 = B['5m'], X = exclusions(market), cost = COSTS[market];
  const keep = (tr) => tr.status !== 'open' && tr.endT != null && tr.t >= FROM && tr.t < END && tr.endT < END && !inBad(X, tr.t, tr.endT);
  const slim = (tr, extra) => {
    if (!(tr.side * (tr.entry - tr.stop) > 0)) throw new Error('stop not on the losing side ' + tr.id);
    return { t: tr.t, endT: tr.endT, kind: tr.kind === 'msnr-main' ? 'main' : 'other', side: tr.side, entry: tr.entry, stop: tr.stop, r0: tr.r0, R: +tr.R.toFixed(4), Rnet: +(tr.R - cost / tr.r0).toFixed(4), ...extra };
  };
  const out = { market, cost, streams: {}, gate: { n: 0, bad: 0 } };
  for (const rr of TARGETS) out.streams[rr] = readAt(B, market, rr).filter(keep).map((tr) => slim(tr));
  // paired: each 6R trade re-simulated alone at 1R (and at 6R as the gate)
  const six = readAt(B, market, 6).filter(keep);
  out.paired = six.map((tr) => { const i = idxOf(M5, tr.t); const g = sim(M5, i, tr, 6), o = sim(M5, i, tr, 1);
    out.gate.n++; if (!g || Math.abs(tr.side * (g.px - tr.entry) / tr.r0 - tr.R) > 1e-9) out.gate.bad++;
    const R1 = o ? tr.side * (o.px - tr.entry) / tr.r0 : null; return slim(tr, { R1: R1 == null ? null : +R1.toFixed(4) }); }).filter((x) => x.R1 != null);
  out.placebo = readAt(B, market, 6, { against: true }).filter(keep).map((tr) => slim(tr));
  // the desk's own mix (6R main / 3R other), reported only
  out.deskMix = msnrTrades(B, { from: FROM, market }).filter(keep).map((tr) => slim(tr));
  return out;
}

// ---- statistics ----
const mean = (a) => a.reduce((s, x) => s + x, 0) / (a.length || 1);
const sdv = (a) => { const m = mean(a); return a.length > 1 ? Math.sqrt(a.reduce((s, x) => s + (x - m) ** 2, 0) / (a.length - 1)) : 0; };
const mk = (t) => new Date(t * 1000).toISOString().slice(0, 7);
function monthsOf(a, b) { const o = []; for (let d = new Date(a * 1000); d.getTime() / 1000 < b; d.setUTCMonth(d.getUTCMonth() + 1)) o.push(d.toISOString().slice(0, 7)); return o; }
export function half(trades, key, a, b) {
  const xs = trades.filter((x) => x.t >= a && x.t < b && Number.isFinite(x[key])), v = xs.map((x) => x[key]);
  const ms = new Map(monthsOf(a, b).map((m) => [m, 0])); for (const x of xs) ms.set(mk(x.t), ms.get(mk(x.t)) + x[key]);
  const m = [...ms.values()], s = sdv(m), tM = s > 0 ? mean(m) / (s / Math.sqrt(m.length)) : null;
  const pOne = tM == null ? 1 : (tM > 0 ? K.pFromT(tM, m.length - 1) / 2 : 1 - K.pFromT(tM, m.length - 1) / 2);
  return { n: xs.length, meanR: xs.length ? +mean(v).toFixed(4) : null, total: +v.reduce((s2, x) => s2 + x, 0).toFixed(2),
    wins: xs.filter((x) => x[key] > 0).length, tMonth: tM == null ? null : +tM.toFixed(2), pOne: +pOne.toFixed(5) };
}
export const both = (trades, key) => ({ a: half(trades, key, FROM, SPLIT), b: half(trades, key, SPLIT, END), all: half(trades, key, FROM, END) });
const passHalf = (h) => h.n > 0 && h.meanR > 0 && h.tMonth != null && h.tMonth >= 2;

export function report(dir) {
  const per = MARKETS.map((m) => JSON.parse(fs.readFileSync(path.join(dir, m + '.json'), 'utf8')));
  const pool = (f) => per.flatMap(f);
  const by = (arr, kind) => arr.filter((x) => x.kind === kind);
  const diff = pool((p) => by(p.paired, 'main').map((x) => ({ ...x, D: +(x.R - x.R1).toFixed(4) })));
  const T1 = both(pool((p) => by(p.streams[6], 'main')), 'R'), T2 = both(diff, 'D'), T3 = both(pool((p) => by(p.streams[6], 'other')), 'R');
  const PL = both(pool((p) => by(p.placebo, 'main')), 'R');
  const tests = { T1, T2, T3 }, ps = Object.values(tests).map((x) => Math.max(x.a.pOne, x.b.pOne)), adj = K.holm(ps);
  Object.keys(tests).forEach((k, i) => { tests[k] = { ...tests[k], p: +ps[i].toFixed(5), holm: +adj[i].toFixed(5), pass: passHalf(tests[k].a) && passHalf(tests[k].b) && adj[i] < 0.05 }; });
  const placeboOk = T1.a.meanR > PL.a.meanR && T1.b.meanR > PL.b.meanR;
  const thin = T1.a.n < 100 || T1.b.n < 100;
  const verdict = thin ? 'INCONCLUSIVE' : tests.T1.pass && tests.T2.pass && placeboOk ? 'PASS' : 'FAIL';
  const table = {}; for (const rr of TARGETS) for (const kind of ['main', 'other']) for (const key of ['R', 'Rnet']) {
    const k = `${kind}.${rr}.${key}`; table[k] = { pool: both(pool((p) => by(p.streams[rr], kind)), key) };
    for (const p of per) table[k][p.market] = both(by(p.streams[rr], kind), key).all; }
  const afterCost = { T1: both(pool((p) => by(p.streams[6], 'main')), 'Rnet'), T3: both(pool((p) => by(p.streams[6], 'other')), 'Rnet'), placebo: both(pool((p) => by(p.placebo, 'main')), 'Rnet') };
  const deskMix = { main: both(pool((p) => by(p.deskMix, 'main')), 'R'), other: both(pool((p) => by(p.deskMix, 'other')), 'R') };
  const gate = per.map((p) => ({ market: p.market, ...p.gate }));
  const f = (x) => (x >= 0 ? '+' : '−') + Math.abs(x).toFixed(3);
  const headline = `msnr-main at 6R on 2010-2019, five markets, before costs: ${f(T1.all.meanR)}R a trade (n ${T1.all.n}; 2010-14 month t ${T1.a.tMonth}, 2015-19 ${T1.b.tMonth}); 6R minus 1R by trade ${f(T2.all.meanR)}R (t ${T2.a.tMonth} / ${T2.b.tMonth}).`;
  return { study: 'msnr-main-6r', verdict, headline, built: '2026-11-23', tests, placebo: PL, placeboOk, afterCost, deskMix, gate, table };
}

export async function cutTest() {
  const M5k = K.load('xau', '5m', { from: '2009-01-01', to: '2015-01-01' }), cut = D('2013-06-30');
  const A = readAt(frames(M5k), 'xau', 6), Bc = readAt(frames(M5k.filter((b) => b.e <= cut)), 'xau', 6);
  const key = (x) => `${x.id}|${x.R}|${x.endT}`, done = (x) => x.endT != null && x.endT <= cut - 86400 * 5 && x.t < cut - 86400 * 5;
  const a = A.filter(done).map(key), b = Bc.filter(done).map(key);
  return { n: a.length, same: a.length === b.length && a.every((x, i) => x === b[i]) };
}

if (process.argv[1] && fileURLToPath(import.meta.url) === path.resolve(process.argv[1])) {
  const [cmd, a, b] = process.argv.slice(2);
  if (cmd === 'market') { const t0 = Date.now(); const out = runMarket(a, K.load(a, '5m', { from: WARM, to: END })); fs.mkdirSync(b, { recursive: true });
    fs.writeFileSync(path.join(b, a + '.json'), JSON.stringify(out)); console.log(a, TARGETS.map((r) => out.streams[r].length).join(' '), 'gate', JSON.stringify(out.gate), ((Date.now() - t0) / 1000).toFixed(0) + 's'); }
  else if (cmd === 'report') { const R = report(a); fs.writeFileSync(path.join(HERE, 'result.json'), JSON.stringify(R, null, 1)); console.log(R.verdict, R.headline); }
  else if (cmd === 'cut') console.log(JSON.stringify(await cutTest()));
  else console.log('usage: run.mjs market <m> <dir> | report <dir> | cut');
}
