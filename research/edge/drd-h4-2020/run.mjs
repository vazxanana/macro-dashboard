// research/edge/drd-h4-2020/run.mjs - the gold plan's direction rule as a trade (PREREGISTRATION.md, 23 Nov 2026).
// node research/edge/drd-h4-2020/run.mjs market <m> <outDir>   one market: signals, trades of T1-T3 -> <outDir>/<m>.json
// node research/edge/drd-h4-2020/run.mjs report <outDir>       pool, apply the pre-registered bar, write result.json
// node research/edge/drd-h4-2020/run.mjs cut <m>               look-ahead check: signals on cut candles = whole-file signals
// Research only: imports edgekit, council/eg-methods (snrSides, pipOfMarket) and combo-grid-2 (multi, COSTS, exclusions).
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import * as K from '../_lib/edgekit.mjs';
import { snrSides, pipOfMarket } from '../../../council/eg-methods.mjs';
import { multi, COSTS, exclusions } from '../combo-grid-2/run.mjs';

const HERE = path.dirname(fileURLToPath(import.meta.url));
export const MARKETS = ['xau', 'eurusd', 'gbpusd', 'usdjpy', 'audusd', 'nzdusd', 'usdcad', 'usdchf', 'eurjpy', 'xag', 'gbpjpy', 'eurgbp', 'audjpy', 'cadjpy', 'euraud', 'nas100', 'spx500', 'de40'];
export const START = Date.UTC(2020, 0, 1) / 1000, SPLIT = Date.UTC(2024, 0, 1) / 1000;
export const P = { stopPips: 30, rr: 3, life: 24 * 14400, cap: 30 * 86400, perDay: 2, atrN: 14, atrK: 1, t3Pad: 3 };
// The pre-registration's pip: gold 0.10, silver 0.01, indices 1, a five-decimal pair 0.0001, a yen pair 0.01. pipOfMarket
// (council/eg-methods.mjs) gives that for the markets the desk lists, but falls back to 0.1 for eight of these (nzdusd, usdchf,
// eurjpy, gbpjpy, audjpy, eurgbp, euraud, cadjpy); found after the first full run, those take the pre-registered pip here.
export const pip = (m) => (['xau', 'xag', 'nas100', 'spx500', 'de40'].includes(m) ? pipOfMarket(m) : m.endsWith('jpy') ? 0.01 : 0.0001);
const conv = (B, sec) => B.map((b) => ({ time: sec ? b.e - sec : b.t, open: b.o, high: b.h, low: b.l, close: b.c }));

// Signals from closed candles only: { side, t (known), level, boT, day, strong, rejLo, rejHi }
export function signals(M5) {
  const D = K.dailyNY(M5), H = K.resample(M5, 14400);
  const Dc = conv(D, 86400), Hc = conv(H);
  const sides = snrSides(Dc, Hc);
  const hIdx = new Map(H.map((b, i) => [b.t, i])), dIdx = new Map(Dc.map((b, i) => [b.time, i]));
  const out = [];
  for (const s of sides) {
    const bi = hIdx.get(s.boT - 14400); if (bi == null || bi < P.atrN) continue;
    let tr = 0; for (let j = bi - P.atrN; j < bi; j++) { const b = H[j], pc = H[j - 1] ? H[j - 1].c : b.o; tr += Math.max(b.h - b.l, Math.abs(b.h - pc), Math.abs(b.l - pc)); }
    const atr = tr / P.atrN, b = H[bi], body = (b.c - b.o) * s.dir;
    const di = dIdx.get(s.day); const rej = di == null ? null : D[di];
    out.push({ side: s.dir, t: s.t, level: s.level, boT: s.boT, day: s.day, strong: body >= P.atrK * atr, body, atr,
      rejLo: rej ? rej.l : null, rejHi: rej ? rej.h : null, key: s.key });
  }
  return out;
}

// trades of one test on one market (after the 2-a-day cap). test: 'T1' | 'T2' | 'T3'
export function trades(M5, sigs, market, test, X = []) {
  const pp = pip(market), cost = COSTS[market], out = [];
  for (const s of sigs) {
    if (s.t < START) continue;
    if ((test === 'T1' || test === 'T3') && !s.strong) continue;
    const entry = s.level;
    let stop = entry - s.side * P.stopPips * pp;
    if (test === 'T3') { if (s.rejLo == null) continue; stop = s.side > 0 ? s.rejLo - P.t3Pad * pp : s.rejHi + P.t3Pad * pp; }
    if (!(s.side * (entry - stop) > 0)) continue;
    const r = multi(M5, s.side, entry, stop, 'limit', s.t, s.t + P.life, P.rr, P.cap);
    if (!r) continue;
    if (X.length && X.some(([a, b]) => r.t >= a && r.t <= b)) continue;
    const R = r.R[2], c = cost / r.risk;
    out.push({ t: r.t, side: s.side, entry, stop, R, Rnet: R - c, R2: R - 2 * c, costR: c, sig: s.t });
  }
  out.sort((a, b) => a.t - b.t);
  const per = new Map(), kept = [];
  for (const x of out) { const d = Math.floor(x.t / 86400); const n = per.get(d) || 0; if (n >= P.perDay) continue; per.set(d, n + 1); kept.push(x); }
  return kept;
}

export function runMarket(market) {
  const M5 = K.load(market, '5m', { from: '2019-01-01' });
  const sigs = signals(M5), X = exclusions(market), res = { market, nsig: sigs.filter((s) => s.t >= START).length, last: M5[M5.length - 1].e, T: {} };
  for (const T of ['T1', 'T2', 'T3']) res.T[T] = trades(M5, sigs, market, T, X);
  return res;
}

// window stats: n, mean R after costs, month-sum t (fill months), mean at 2x cost
export function win(xs, key = 'Rnet') {
  const s = K.stats(xs.map((x) => ({ t: x.t, R: x[key] })), { key: 'R', time: 't' });
  return { n: s.n, meanR: s.meanR, tMonth: s.tMonth, months: s.months, total: s.total, wins: s.wins };
}
export function judge(xs) {   // the bar reads R before costs (amendment before the run); after costs and 2x cost reported
  const D = xs.filter((x) => x.t < SPLIT), C = xs.filter((x) => x.t >= SPLIT);
  const d = win(D, 'R'), c = win(C, 'R'), dn = win(D), cn = win(C), d2 = win(D, 'R2'), c2 = win(C, 'R2');
  const p1 = c.tMonth == null ? 1 : (c.tMonth > 0 ? K.pFromT(c.tMonth, c.months - 1) / 2 : 1 - K.pFromT(c.tMonth, c.months - 1) / 2);
  return { disc: d, conf: c, discNet: dn, confNet: cn, disc2x: { meanR: d2.meanR }, conf2x: { meanR: c2.meanR }, pConf: p1 };
}
const r3 = (x) => (x == null ? null : +x.toFixed(3)), r2 = (x) => (x == null ? null : +x.toFixed(2));

export function report(dir) {
  const per = MARKETS.map((m) => JSON.parse(fs.readFileSync(path.join(dir, m + '.json'), 'utf8')));
  const tests = {}, ps = [];
  for (const T of ['T1', 'T2', 'T3']) { const all = per.flatMap((x) => x.T[T]); tests[T] = judge(all); ps.push(tests[T].pConf); }
  const H = K.holm(ps);
  ['T1', 'T2', 'T3'].forEach((T, i) => { const j = tests[T]; j.pConfHolm = H[i];
    const ok = j.disc.n >= 100 && j.disc.meanR > 0 && j.disc.tMonth >= 2 && j.conf.n >= 50 && j.conf.meanR > 0 && j.conf.tMonth >= 2 && H[i] <= 0.0228;
    j.pass = ok; j.enough = j.disc.n >= 100 && j.conf.n >= 50; });
  const nPass = Object.values(tests).filter((j) => j.pass).length, enough = Object.values(tests).every((j) => j.enough);
  const verdict = nPass ? 'PASS' : enough ? 'FAIL' : 'INCONCLUSIVE';
  const rows = per.map((x) => ({ market: x.market, signals: x.nsig, ...Object.fromEntries(['T1', 'T2', 'T3'].map((T) => { const j = judge(x.T[T]);
    return [T, { discN: j.disc.n, discR: r3(j.disc.meanR), discT: r2(j.disc.tMonth), confN: j.conf.n, confR: r3(j.conf.meanR), confT: r2(j.conf.tMonth), discNetR: r3(j.discNet.meanR), confNetR: r3(j.confNet.meanR) }]; })) }));
  const slim = (j) => ({ disc: { n: j.disc.n, meanR: r3(j.disc.meanR), tMonth: r2(j.disc.tMonth), total: r2(j.disc.total), wins: j.disc.wins },
    conf: { n: j.conf.n, meanR: r3(j.conf.meanR), tMonth: r2(j.conf.tMonth), total: r2(j.conf.total), wins: j.conf.wins },
    discNet: { meanR: r3(j.discNet.meanR), tMonth: r2(j.discNet.tMonth) }, confNet: { meanR: r3(j.confNet.meanR), tMonth: r2(j.confNet.tMonth) },
    disc2x: r3(j.disc2x.meanR), conf2x: r3(j.conf2x.meanR),
    pConf: r3(j.pConf), pConfHolm: r3(j.pConfHolm), pass: j.pass });
  const T1 = tests.T1;
  const headline = `${nPass} of 3 tests pass. T1 (strong H4 body, 30-pip stop, 3R) on 18 markets, before costs: confirmation ${T1.conf.n} trades, ${r3(T1.conf.meanR)}R a trade, month t ${r2(T1.conf.tMonth)} (discovery ${T1.disc.n}, ${r3(T1.disc.meanR)}R, t ${r2(T1.disc.tMonth)}).`;
  const cut = fs.existsSync(path.join(dir, 'cut.json')) ? JSON.parse(fs.readFileSync(path.join(dir, 'cut.json'), 'utf8')) : null;
  const out = { topic: 'drd-h4-2020', judgedOn: 'R before costs (amendment before the run)', built: new Date().toISOString().slice(0, 10), verdict, headline, params: P, markets: MARKETS,
    windows: { discovery: '2020-01-01..2023-12-31', confirmation: '2024-01-01..' + new Date(Math.max(...per.map((x) => x.last)) * 1000).toISOString().slice(0, 10) },
    tests: Object.fromEntries(Object.entries(tests).map(([k, j]) => [k, slim(j)])), perMarket: rows, gold: rows.find((r) => r.market === 'xau'), cutTest: cut };
  fs.writeFileSync(path.join(HERE, 'result.json'), JSON.stringify(out, null, 1) + '\n');
  return out;
}

// look-ahead: signals from candles cut at moment T equal the whole-file signals known by T
export function cutTest(market, cuts = 6) {
  const M5 = K.load(market, '5m', { from: '2019-01-01' }); const full = signals(M5);
  const key = (s) => [s.side, s.t, s.level, s.boT, s.strong, s.rejLo, s.rejHi].join('|');
  const t0 = Date.UTC(2020, 6, 1) / 1000, t1 = M5[M5.length - 1].e; let checked = 0, bad = 0;
  for (let k = 0; k < cuts; k++) { const T = Math.floor(t0 + ((t1 - t0) * (k + 0.37)) / cuts);
    const cut = signals(M5.filter((b) => b.e <= T)).filter((s) => s.t <= T).map(key), want = full.filter((s) => s.t <= T).map(key);
    checked += want.length; if (cut.length !== want.length || cut.some((x, i) => x !== want[i])) bad++; }
  return { market, cuts, signalsChecked: checked, mismatchedCuts: bad };
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const [cmd, a, b] = process.argv.slice(2);
  if (cmd === 'market') { const t0 = Date.now(); const r = runMarket(a); fs.mkdirSync(b, { recursive: true }); fs.writeFileSync(path.join(b, a + '.json'), JSON.stringify(r));
    console.log(a, r.nsig, 'signals', Object.entries(r.T).map(([k, v]) => k + ' ' + v.length).join(' '), ((Date.now() - t0) / 1000).toFixed(0) + 's'); }
  else if (cmd === 'cut') { const r = cutTest(a); console.log(JSON.stringify(r)); if (b) fs.writeFileSync(b, JSON.stringify(r)); }
  else if (cmd === 'report') { const r = report(a); console.log(r.verdict, r.headline); console.log(JSON.stringify(r.tests, null, 1)); }
  else console.log('usage: run.mjs market <m> <dir> | cut <m> [file] | report <dir>');
}
