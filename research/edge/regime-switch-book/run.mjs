// research/edge/regime-switch-book/run.mjs - the pre-registered market-cycle regime book (PREREGISTRATION.md, 23 Nov 2026).
// Research only: nothing live reads it, it places nothing. It reads the trade lists the other studies of the night saved
// (never changes them) and the overnight toolkit's candle cache (research/edge/_lib/edgekit.mjs).
//   node research/edge/regime-switch-book/run.mjs     writes result.json, trades.json, RESULT.md
// The regime of a trading day (17:00 New York), from the H4 candles CLOSED at the day's first candle:
//   consolidation = the last H4 close is inside the H4 box still open (boxesHL(H4, 3)) and the box is known for 12+ H4 candles;
//   trend = not consolidation and the last H4 break of structure(H4, 3) is a BO made within the last 30 H4 candles;
//   transition = everything else. side = the H4 side of structure at that moment.
// The choice: per method, on 2020-2023 fills only, the menu filter with the highest month t of R after costs (30+ IS trades),
// "all days" unless one beats it. Tests T1 (book, OOS 2024-01-01 .. 2026-11-13), T2 (anchored walk-forward), T3 (gold of T1).
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import * as K from '../_lib/edgekit.mjs';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const EDGE = path.join(HERE, '..');
export const P = { swing: 3, knownMin: 12, boWithin: 30, minIS: 30, placebos: 200, seed: 20261123 };
const D = (s) => Date.UTC(+s.slice(0, 4), +s.slice(5, 7) - 1, +s.slice(8, 10)) / 1000;
export const W = {
  is: [D('2020-01-01'), D('2024-01-01')],
  oos: [D('2024-01-01'), D('2026-11-14')], // fills through 13 Nov 2026
  repIS: [D('2010-01-01'), D('2016-01-01')],
  repOOS: [D('2016-01-01'), D('2020-01-01')],
};
export const LISTS = ['barrier-qm-janda', 'box-touch-trend', 'daily-zone-retest', 'direction-chain-gate', 'eg-chain-50',
  'h4-pullback-end', 'session-sweep', 'storyline-daily-gold', 'storyline-qm-sop', 'vb-structure-filter'];
// states: C consolidation, T trend, X transition
export const FILTERS = [
  { id: 'all', name: 'all days', keep: () => true },
  { id: 'C', name: 'consolidation', keep: (g) => g.state === 'C' },
  { id: 'T', name: 'trend', keep: (g) => g.state === 'T' },
  { id: 'X', name: 'transition', keep: (g) => g.state === 'X' },
  { id: 'CT', name: 'consolidation + trend', keep: (g) => g.state === 'C' || g.state === 'T' },
  { id: 'CX', name: 'consolidation + transition', keep: (g) => g.state === 'C' || g.state === 'X' },
  { id: 'TX', name: 'trend + transition', keep: (g) => g.state === 'T' || g.state === 'X' },
  { id: 'CTX', name: 'all three states', keep: () => true },
  { id: 'Tw', name: 'trend days, with the H4 side', keep: (g, side) => g.state === 'T' && g.side === side },
];
export const filterOf = (id) => FILTERS.find((f) => f.id === id);

// ---- the regime of each trading day ----------------------------------------------------------------------------
// H4 candles and the trading days of one market -> [{ t, e, date, state, side, L }]; uses only H4 candles closed by d.t.
export function dayRegimes(H4, days, { swing = P.swing, knownMin = P.knownMin, boWithin = P.boWithin } = {}) {
  const boxes = K.boxesHL(H4, swing);
  const st = K.structure(H4, swing);
  const out = []; let bp = 0, ep = 0;
  for (const d of days) {
    const n = K.closedCount(H4, d.t); const L = n - 1;
    let state = 'X', side = 0;
    if (L >= 0) {
      side = st.side[L];
      while (bp < boxes.length && boxes[bp].bi !== -1 && boxes[bp].bi <= L) bp++;
      const b = bp < boxes.length ? boxes[bp] : null;
      const open = b && b.s <= L && (b.bi === -1 || b.bi > L);
      const c = H4[L].c;
      if (open && c <= b.hi && c >= b.lo && L - b.s >= knownMin) state = 'C';
      else {
        while (ep < st.events.length && st.events[ep].i <= L) ep++;
        const ev = ep ? st.events[ep - 1] : null;
        if (ev && ev.kind === 'BO' && L - ev.i < boWithin) state = 'T';
      }
    }
    out.push({ t: d.t, e: d.e, date: d.date, state, side, L });
  }
  return out;
}
// the trading day holding a moment: the last day with t <= moment
export function dayIndex(days, t) {
  let lo = 0, hi = days.length; while (lo < hi) { const m = (lo + hi) >> 1; if (days[m].t <= t) lo = m + 1; else hi = m; }
  return lo - 1;
}

// ---- reading the trade lists ------------------------------------------------------------------------------------
const sideOf = (x) => (x === 1 || x === 'buy' || x === 'b' || x === 'long' ? 1 : x === -1 || x === 'sell' || x === 's' || x === 'short' ? -1 : 0);
const tOf = (x) => (typeof x === 'number' ? x : typeof x === 'string' ? Math.floor(Date.parse(x.endsWith('Z') && x.length === 17 ? x.replace('Z', ':00Z') : x) / 1000) : null);
export function normalize(list, j) {
  const rows = [];
  const push = (method, o) => rows.push({ method: list + (method ? ':' + method : ''), market: o.market, side: sideOf(o.side), fillT: tOf(o.fillT),
    exitT: tOf(o.exitT), entry: o.entry, stop: o.stop, target: o.target ?? null, R: o.R, Rnet: o.Rnet });
  const C = (r, name) => r[j.cols.indexOf(name)];
  switch (list) {
    case 'barrier-qm-janda': for (const r of j.rows) push(r[0], { market: j.market || 'xau', side: r[2], fillT: r[3], entry: r[4], stop: r[5], target: r[6], exitT: r[7], R: r[10], Rnet: r[11] }); break;
    case 'box-touch-trend': for (const r of j.rows) push(C(r, 'test'), { market: C(r, 'market'), side: C(r, 'side'), fillT: C(r, 'entryT'), entry: C(r, 'entry'), stop: C(r, 'stop'), target: C(r, 'target'), exitT: C(r, 'exitT'), R: C(r, 'R'), Rnet: C(r, 'Rnet') }); break;
    case 'daily-zone-retest': for (const x of j.trades) push('', { market: x.m, side: x.s, fillT: x.et, entry: x.en, stop: x.st, target: x.tg, exitT: x.xt, R: x.R, Rnet: x.Rn }); break;
    case 'direction-chain-gate': for (const r of j.rows) push('', { market: r[0], side: r[1], fillT: r[2], entry: r[3], stop: r[4], target: r[5], exitT: r[6], R: r[8], Rnet: r[9] }); break;
    case 'eg-chain-50': for (const x of j) push(x.chain, { market: x.market, side: x.side, fillT: x.fillT, entry: x.fill ?? x.entry, stop: x.stop, target: x.target, exitT: x.exitT, R: x.R, Rnet: x.Rnet }); break;
    case 'h4-pullback-end': for (const r of j.rows) push(C(r, 'stream'), { market: C(r, 'market'), side: C(r, 'side'), fillT: C(r, 'entryT'), entry: C(r, 'entry'), stop: C(r, 'stop'), target: C(r, 'target'), exitT: C(r, 'exitT'), R: C(r, 'R'), Rnet: C(r, 'Rnet') }); break;
    case 'session-sweep': for (const x of j) push('', { market: x.market, side: x.side, fillT: x.entryT, entry: x.entry, stop: x.stop, target: x.target, exitT: x.exitT, R: x.R, Rnet: x.Rnet }); break;
    case 'storyline-daily-gold': for (const x of j) push(x.v, { market: x.market, side: x.side, fillT: x.fillT, entry: x.entry, stop: x.stop, target: x.target, exitT: x.exitT, R: x.R, Rnet: x.Rnet }); break;
    case 'storyline-qm-sop': for (const r of j.rows) push(r[0], { market: r[1], side: r[2], fillT: r[3], entry: r[4], stop: r[5], target: r[6], exitT: r[7], R: r[10], Rnet: r[11] }); break;
    case 'vb-structure-filter': for (const x of j) push('', { market: x.market, side: x.side, fillT: x.entryT, entry: x.entry, stop: x.stop, target: x.target, exitT: x.exitT, R: x.R, Rnet: x.Rnet }); break;
    default: throw new Error('unknown list ' + list);
  }
  return rows;
}
export function readLists(dir = EDGE) {
  const methods = {}, left = [];
  for (const list of LISTS) {
    const f = path.join(dir, list, 'trades.json');
    if (!fs.existsSync(f)) { left.push({ list, why: 'no trades.json' }); continue; }
    const rows = normalize(list, JSON.parse(fs.readFileSync(f, 'utf8')));
    for (const r of rows) (methods[r.method] ||= []).push(r);
  }
  const out = {};
  for (const [m, rows] of Object.entries(methods)) {
    const ok = rows.filter((r) => K.MARKETS.includes(r.market) && r.side && Number.isFinite(r.fillT) && Number.isFinite(r.exitT) && Number.isFinite(r.R) && Number.isFinite(r.Rnet));
    const bad = rows.length - ok.length;
    if (!ok.length) { left.push({ list: m, why: 'no row with market, side, fill time, R before and after costs' }); continue; }
    if (!ok.some((r) => r.fillT >= W.is[0] && r.fillT < W.is[1])) { left.push({ list: m, why: 'no trade in 2020-2023' }); continue; }
    out[m] = { rows: ok.sort((a, b) => a.fillT - b.fillT), dropped: bad };
  }
  return { methods: out, left };
}

// ---- statistics -------------------------------------------------------------------------------------------------
const inW = (w) => (r) => r.fillT >= w[0] && r.fillT < w[1];
export function sumUp(trades) { // mean after costs, month t (exit months), 2x costs, before costs
  const s = K.stats(trades, { key: 'Rnet', time: 'exitT' });
  const two = K.stats(trades.map((x) => ({ ...x, R2: 2 * x.Rnet - x.R })), { key: 'R2', time: 'exitT' });
  const g = K.stats(trades, { key: 'R', time: 'exitT' });
  return { n: s.n, meanR: s.meanR, total: s.total, tMonth: s.tMonth, pMonth: s.pMonth, months: s.months, tTrade: s.tTrade,
    maxDD: s.maxDD, mean2x: two.meanR, meanBefore: g.meanR };
}
export function welch(a, b) {
  const m = (x) => x.reduce((p, q) => p + q, 0) / x.length;
  const v = (x, mu) => x.reduce((p, q) => p + (q - mu) ** 2, 0) / (x.length - 1);
  if (a.length < 2 || b.length < 2) return { t: null, diff: null, na: a.length, nb: b.length, meanA: a.length ? m(a) : null, meanB: b.length ? m(b) : null };
  const ma = m(a), mb = m(b), va = v(a, ma) / a.length, vb = v(b, mb) / b.length;
  const t = (ma - mb) / Math.sqrt(va + vb);
  const df = (va + vb) ** 2 / (va ** 2 / (a.length - 1) + vb ** 2 / (b.length - 1));
  return { t, df, p: K.pFromT(t, df), diff: ma - mb, na: a.length, nb: b.length, meanA: ma, meanB: mb };
}
// choose a filter on a window: highest month t of R after costs among filters with >= minIS trades; "all" unless beaten
export function choose(rows, regOf, window, minIS = P.minIS) {
  const sub = rows.filter(inW(window));
  const tm = (xs) => (xs.length ? K.stats(xs, { key: 'Rnet', time: 'exitT' }).tMonth : null);
  let best = { id: 'all', t: tm(sub), n: sub.length };
  for (const f of FILTERS) {
    if (f.id === 'all' || f.id === 'CTX') continue; // CTX keeps the same trades as "all"
    const kept = sub.filter((r) => f.keep(regOf(r), r.side));
    if (kept.length < minIS) continue;
    const t = tm(kept);
    if (t != null && (best.t == null || t > best.t)) best = { id: f.id, t, n: kept.length };
  }
  return best;
}
const split = (rows, regOf, id) => { const f = filterOf(id); const k = [], d = []; for (const r of rows) (f.keep(regOf(r), r.side) ? k : d).push(r); return [k, d]; };

// one full run of the choice procedure (used for the real labels and for every placebo)
export function bookRun(methods, regOf) {
  const choice = {}, keptOOS = [], dropOOS = [], keptIS = [], poolOOS = [];
  for (const [m, { rows }] of Object.entries(methods)) {
    const c = choose(rows, regOf, W.is); choice[m] = c;
    const oos = rows.filter(inW(W.oos)); const is = rows.filter(inW(W.is));
    const [k, d] = split(oos, regOf, c.id); keptOOS.push(...k); dropOOS.push(...d); poolOOS.push(...oos);
    keptIS.push(...split(is, regOf, c.id)[0]);
  }
  return { choice, keptOOS, dropOOS, keptIS, poolOOS };
}
const mean = (xs) => (xs.length ? xs.reduce((a, b) => a + b.Rnet, 0) / xs.length : null);

// ---- main -------------------------------------------------------------------------------------------------------
async function main() {
  const t0 = Date.now();
  const { methods, left } = readLists();
  const names = Object.keys(methods);
  // regimes per market
  const REG = {};
  for (const m of K.MARKETS) {
    const b5 = K.load(m, '5m', { from: '2010-01-01' });
    const H4 = K.resample(b5, 14400); const days = K.dailyNY(b5);
    REG[m] = dayRegimes(H4, days);
    console.log(m, 'days', REG[m].length, ((Date.now() - t0) / 1000).toFixed(0) + 's');
  }
  // attach the day index to every trade
  for (const nm of names) for (const r of methods[nm].rows) { r.di = dayIndex(REG[r.market], r.fillT); }
  for (const nm of names) { const before = methods[nm].rows.length; methods[nm].rows = methods[nm].rows.filter((r) => r.di >= 0); methods[nm].noDay = before - methods[nm].rows.length; }
  const regReal = (r) => REG[r.market][r.di];

  // T1
  const R1 = bookRun(methods, regReal);
  const sBook = sumUp(R1.keptOOS), sIS = sumUp(R1.keptIS), sPool = sumUp(R1.poolOOS), sDrop = sumUp(R1.dropOOS);
  const wKD = welch(R1.keptOOS.map((x) => x.Rnet), R1.dropOOS.map((x) => x.Rnet));
  // T2: anchored walk-forward (filter re-chosen before each year on every year of the list before it)
  const t2Kept = [], t2Choice = {};
  for (const nm of names) {
    t2Choice[nm] = {};
    for (const y of [2024, 2025, 2026]) {
      const c = choose(methods[nm].rows, regReal, [-Infinity, D(y + '-01-01')]); t2Choice[nm][y] = c.id;
      const yr = methods[nm].rows.filter((r) => r.fillT >= D(y + '-01-01') && r.fillT < Math.min(D(y + 1 + '-01-01'), W.oos[1]));
      t2Kept.push(...split(yr, regReal, c.id)[0]);
    }
  }
  const sT2 = sumUp(t2Kept);
  // T3: gold trades of T1
  const goldK = R1.keptOOS.filter((r) => r.market === 'xau'), goldPool = R1.poolOOS.filter((r) => r.market === 'xau');
  const sT3 = sumUp(goldK), sT3pool = sumUp(goldPool);
  const holm = K.holm([sBook.pMonth, sT2.pMonth, sT3.pMonth].map((p, i) => ([sBook, sT2, sT3][i].tMonth > 0 ? p : 1)));

  // placebo: shuffle labels (state + side together) across the trading days of each market, same procedure
  const rnd = K.rng(P.seed); const plc = [];
  for (let k = 0; k < P.placebos; k++) {
    const perm = {};
    for (const m of K.MARKETS) { const a = REG[m].map((x) => x); for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(rnd() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; } perm[m] = a; }
    const run = bookRun(methods, (r) => perm[r.market][r.di]);
    plc.push(mean(run.keptOOS));
  }
  plc.sort((a, b) => a - b);
  const plcBeat = plc.filter((x) => sBook.meanR > x).length / plc.length;
  const plc95 = plc[Math.floor(0.95 * plc.length) - 1];

  // replication: choose on 2010-2015, test on 2016-2019, methods with trades in both windows
  const repKept = [], repPool = [], repChoice = {};
  for (const nm of names) {
    const rows = methods[nm].rows;
    if (!rows.some(inW(W.repIS)) || !rows.some(inW(W.repOOS))) continue;
    const c = choose(rows, regReal, W.repIS); repChoice[nm] = c.id;
    const o = rows.filter(inW(W.repOOS)); repPool.push(...o); repKept.push(...split(o, regReal, c.id)[0]);
  }
  const sRep = repKept.length ? sumUp(repKept) : null, sRepPool = repPool.length ? sumUp(repPool) : null;

  // verdicts
  const lines = {
    oosMean: sBook.meanR > 0, oosT: sBook.tMonth >= 2, holm: holm[0] < 0.05, isMean: sIS.meanR > 0, twoX: sBook.mean2x > 0,
    n30: sBook.n >= 30, keptBeatsDropped: wKD.t != null && wKD.t >= 2, aboveUnfiltered: sBook.meanR > sPool.meanR,
    placebo: plcBeat >= 0.95, repMean: !!sRep && sRep.meanR > 0, repAbovePool: !!sRep && sRep.meanR > sRepPool.meanR,
  };
  let verdict;
  const failHard = !lines.oosMean || !lines.isMean || !lines.twoX || !(wKD.diff > 0) || (sRep && !lines.repMean);
  if (failHard) verdict = 'FAIL';
  else if (Object.values(lines).every(Boolean)) verdict = 'PASS';
  else verdict = 'INCONCLUSIVE';
  const own = (s, pool, h) => (s.meanR <= 0 || s.mean2x <= 0 ? 'FAIL' : s.meanR > 0 && s.tMonth >= 2 && h < 0.05 && s.mean2x > 0 && s.n >= 30 && s.meanR > pool.meanR ? 'PASS' : 'INCONCLUSIVE');
  const vT2 = own(sT2, sPool, holm[1]), vT3 = own(sT3, sT3pool, holm[2]);

  // reported only
  const perMethod = {};
  for (const nm of names) {
    const rows = methods[nm].rows; const c = R1.choice[nm];
    const oos = rows.filter(inW(W.oos)), is = rows.filter(inW(W.is));
    const [k, d] = split(oos, regReal, c.id);
    const share = {}; for (const r of is) { const g = regReal(r).state; share[g] = (share[g] || 0) + 1; }
    perMethod[nm] = { n: rows.length, leftOut: methods[nm].dropped + methods[nm].noDay, choice: c.id, choiceT: rnd4(c.t), choiceN: c.n, isStates: share,
      isAll: brief(sumUp(is)), isKept: brief(is.length ? sumUp(split(is, regReal, c.id)[0]) : null),
      oosAll: brief(oos.length ? sumUp(oos) : null), oosKept: brief(k.length ? sumUp(k) : null), oosDropped: brief(d.length ? sumUp(d) : null),
      t2: t2Choice[nm], rep: repChoice[nm] ?? null };
  }
  const perMarket = {};
  for (const m of K.MARKETS) {
    const k = R1.keptOOS.filter((r) => r.market === m), p = R1.poolOOS.filter((r) => r.market === m), ki = R1.keptIS.filter((r) => r.market === m);
    perMarket[m] = { oosKept: brief(k.length ? sumUp(k) : null), oosPool: brief(p.length ? sumUp(p) : null), isKept: brief(ki.length ? sumUp(ki) : null) };
  }
  const byYear = {};
  const allKeptByYear = [...R1.keptIS, ...R1.keptOOS];
  const allPoolYear = names.flatMap((nm) => methods[nm].rows);
  for (let y = 2010; y <= 2026; y++) {
    const inY = (r) => new Date(r.fillT * 1000).getUTCFullYear() === y;
    const p = allPoolYear.filter(inY); const k = allKeptByYear.filter(inY);
    byYear[y] = { pool: brief(p.length ? sumUp(p) : null), book: y >= 2020 ? brief(k.length ? sumUp(k) : null) : null };
  }
  const regShare = {}; for (const m of K.MARKETS) { const c = { C: 0, T: 0, X: 0 }; for (const d of REG[m]) c[d.state]++; regShare[m] = c; }

  const result = {
    study: 'regime-switch-book', built: new Date().toISOString().slice(0, 10), verdict, verdictT2: vT2, verdictT3: vT3,
    note: 'R after each list\'s own costs (toolkit COSTS); t on calendar-month sums by exit month; windows by fill time; p two-sided; each kept trade 1R; before costs = the lists\' R.',
    params: P, windows: { is: '2020-01-01..2023-12-31', oos: '2024-01-01..2026-11-13', repChoose: '2010-2015', repTest: '2016-2019' },
    methods: names.length, leftOut: left, regimeShare: regShare,
    T1: { book: round(sBook), isBook: round(sIS), unfiltered: round(sPool), dropped: round(sDrop), keptVsDropped: round(wKD), holmP: rnd4(holm[0]),
      placebo: { n: P.placebos, beatShare: rnd4(plcBeat), p95: rnd4(plc95), median: rnd4(plc[Math.floor(plc.length / 2)]), statistic: 'book OOS mean R after costs' }, lines },
    T2: { book: round(sT2), holmP: rnd4(holm[1]), anchoredFrom: 'the first trade of each list' },
    T3: { book: round(sT3), unfiltered: round(sT3pool), holmP: rnd4(holm[2]) },
    replication: { methods: Object.keys(repChoice).length, book: sRep && round(sRep), unfiltered: sRepPool && round(sRepPool) },
    perMethod, perMarket, byYear,
  };
  fs.writeFileSync(path.join(HERE, 'result.json'), JSON.stringify(result, null, 1));

  // trades.json: every trade with its regime (compact rows)
  const mIdx = names, kIdx = K.MARKETS;
  const kept = new Set(R1.keptOOS.concat(R1.keptIS));
  const rows = [];
  for (const nm of names) for (const r of methods[nm].rows) {
    const g = regReal(r);
    rows.push([mIdx.indexOf(nm), kIdx.indexOf(r.market), r.side, r.fillT, r.exitT, +r.entry.toPrecision(7), +r.stop.toPrecision(7), r.target == null ? null : +(+r.target).toPrecision(7), +r.R.toFixed(3), +r.Rnet.toFixed(3), g.state, g.side, kept.has(r) ? 1 : 0]);
  }
  let tj = { cols: ['method', 'market', 'side', 'fillT', 'exitT', 'entry', 'stop', 'target', 'R', 'Rnet', 'state(C/T/X)', 'h4Side', 'keptT1'], methods: mIdx, markets: kIdx,
    note: 'every qualifying trade of the read lists; times unix s UTC; R before costs, Rnet after; state of the trading day holding the fill; keptT1 = kept by the method\'s 2020-2023 filter (IS and OOS windows only)', rows };
  let s = JSON.stringify(tj);
  if (s.length > 3e6) { // drop to the essential fields
    tj = { ...tj, cols: ['method', 'market', 'side', 'fillT', 'exitT', 'R', 'Rnet', 'state', 'h4Side', 'keptT1'], rows: rows.map((r) => [r[0], r[1], r[2], r[3], r[4], r[8], r[9], r[10], r[11], r[12]]),
      note: tj.note + '; entry / stop / target dropped to keep the file under 3 MB (they are in each study\'s own trades.json)' };
    s = JSON.stringify(tj);
    if (s.length > 3e6) { // times as minutes: fill = minutes since 2010-01-01 UTC, exit = minutes after the fill
      const B = W.repIS[0];
      tj = { ...tj, cols: ['method', 'market', 'side', 'fillMin(since 2010-01-01 UTC)', 'holdMin', 'R', 'Rnet', 'state', 'h4Side', 'keptT1'],
        rows: tj.rows.map((r) => [r[0], r[1], r[2], Math.round((r[3] - B) / 60), Math.round((r[4] - r[3]) / 60), r[5], r[6], r[7], r[8], r[9]]),
        note: tj.note + '; times stored as minutes to stay under 3 MB' };
      s = JSON.stringify(tj);
    }
  }
  fs.writeFileSync(path.join(HERE, 'trades.json'), s);
  fs.writeFileSync(path.join(HERE, 'RESULT.md'), report(result));
  console.log(verdict, JSON.stringify(result.T1.book), 'trades.json', (s.length / 1e6).toFixed(2) + ' MB', ((Date.now() - t0) / 1000).toFixed(0) + 's');
}
const rnd4 = (x) => (x == null || !Number.isFinite(x) ? null : Math.round(x * 1e4) / 1e4);
function round(o) { if (!o) return o; const out = {}; for (const [k, v] of Object.entries(o)) out[k] = typeof v === 'number' ? rnd4(v) : v; return out; }
function brief(s) { return s ? { n: s.n, meanR: rnd4(s.meanR), tMonth: rnd4(s.tMonth), mean2x: rnd4(s.mean2x), meanBefore: rnd4(s.meanBefore) } : null; }

const f = (x, d = 3) => (x == null ? 'n/a' : (x >= 0 ? '+' : '−') + Math.abs(x).toFixed(d));
const ft = (x) => (x == null ? 'n/a' : (x < 0 ? '−' : '') + Math.abs(x).toFixed(2));
export function report(r) {
  const T = r.T1, L = [];
  const missed = Object.entries(T.lines).filter(([, v]) => !v).map(([k]) => k);
  L.push('# Market-cycle regime book: each method only in its own H4 regime: result (23 Nov 2026)', '');
  L.push(`**Verdict: ${r.verdict}.** T1 (the regime book, ${r.methods} methods): ${f(T.book.meanR)}R a trade after costs out of sample (n ${T.book.n}, month t ${ft(T.book.tMonth)}, Holm p ${ft(T.holmP)}); the same methods unfiltered ${f(T.unfiltered.meanR)}R (n ${T.unfiltered.n}). In sample the book made ${f(T.isBook.meanR)}R (n ${T.isBook.n}). Lines missed: ${missed.join(', ') || 'none'}. T2 (walk-forward) ${r.verdictT2}, T3 (gold) ${r.verdictT3}.`, '');
  L.push('Pre-registered in PREREGISTRATION.md (committed before any regime label was computed); run by `run.mjs` on the toolkit\'s OANDA mid 5m cache and the trade lists the other studies of the night saved. R after each list\'s own costs; t on calendar-month sums (by exit month); windows by fill time; p two-sided; each kept trade 1R.', '');
  L.push('| Test | Window | n | R a trade after costs | month t | at 2x costs | before costs | Holm p | passes |', '|---|---|---|---|---|---|---|---|---|');
  const row = (name, w, s, h, v) => L.push(`| ${name} | ${w} | ${s ? s.n : 0} | ${s ? f(s.meanR) : 'n/a'} | ${s ? ft(s.tMonth) : 'n/a'} | ${s ? f(s.mean2x) : 'n/a'} | ${s ? f(s.meanBefore) : 'n/a'} | ${h == null ? '' : ft(h)} | ${v} |`);
  row('T1 regime book', '2020-2023 (IS, filters chosen here)', T.isBook, null, '');
  row('T1 regime book', '2024 - 13 Nov 2026 (OOS)', T.book, T.holmP, r.verdict === 'PASS' ? 'yes' : 'no');
  row('Unfiltered pool (reported)', '2024 - 13 Nov 2026 (OOS)', T.unfiltered, null, '');
  row('Dropped by the filters (reported)', '2024 - 13 Nov 2026 (OOS)', T.dropped, null, '');
  row('T2 anchored walk-forward', '2024 - 13 Nov 2026 (OOS)', r.T2.book, r.T2.holmP, r.verdictT2 === 'PASS' ? 'yes' : 'no');
  row('T3 gold trades of T1', '2024 - 13 Nov 2026 (OOS)', r.T3.book, r.T3.holmP, r.verdictT3 === 'PASS' ? 'yes' : 'no');
  row('T3 gold, unfiltered (reported)', '2024 - 13 Nov 2026 (OOS)', r.T3.unfiltered, null, '');
  row('Replication book (choose 2010-15)', '2016-2019', r.replication.book, null, '');
  row('Replication unfiltered (reported)', '2016-2019', r.replication.unfiltered, null, '');
  L.push('', `Kept against dropped out of sample: ${f(T.keptVsDropped.meanA)}R against ${f(T.keptVsDropped.meanB)}R, Welch t ${ft(T.keptVsDropped.t)} (bar 2). Placebo (${T.placebo.n} shufflings of the day labels per market, same choice): the book's out-of-sample mean beats ${(T.placebo.beatShare * 100).toFixed(1)} % of them (bar 95 %; their median ${f(T.placebo.median)}R, 95th percentile ${f(T.placebo.p95)}R).`);
  L.push('', '## Each method: the filter chosen on 2020-2023, and what it kept', '', '| Method | chosen filter (IS month t, n) | IS all | OOS all | OOS kept | OOS dropped | walk-forward 2024 / 25 / 26 | replication choice |', '|---|---|---|---|---|---|---|---|');
  const b = (x) => (x ? `${f(x.meanR)} (${x.n})` : 'n/a');
  for (const [m, x] of Object.entries(r.perMethod)) L.push(`| ${m} | ${x.choice} (${ft(x.choiceT)}, ${x.choiceN}) | ${b(x.isAll)} | ${b(x.oosAll)} | ${b(x.oosKept)} | ${b(x.oosDropped)} | ${x.t2[2024]} / ${x.t2[2025]} / ${x.t2[2026]} | ${x.rep ?? 'n/a'} |`);
  L.push('', 'Filter names: all = every day; C consolidation; T trend; X transition; CT, CX, TX = two states; Tw = trend days, with the H4 side.');
  if (r.leftOut.length) L.push('', 'Left out: ' + r.leftOut.map((x) => `${x.list} (${x.why})`).join('; ') + '.');
  L.push('', '## Per market, out of sample (R a trade after costs, n)', '', '| Market | book | unfiltered | book in sample |', '|---|---|---|---|');
  for (const [m, x] of Object.entries(r.perMarket)) L.push(`| ${m} | ${b(x.oosKept)} | ${b(x.oosPool)} | ${b(x.isKept)} |`);
  L.push('', '## By year (fill year; R a trade after costs, n)', '');
  L.push(Object.entries(r.byYear).map(([y, x]) => `${y} all ${b(x.pool)}${x.book ? ', book ' + b(x.book) : ''}`).join(' · '));
  L.push('', '## Share of trading days in each state (2010 on)', '');
  L.push(Object.entries(r.regimeShare).map(([m, c]) => `${m}: consolidation ${c.C}, trend ${c.T}, transition ${c.X}`).join(' · '));
  L.push('', '## In plain words', '');
  L.push(`Each method was allowed to trade only in the H4 states where it did best in 2020-2023. Out of sample that book made ${f(T.book.meanR)}R a trade after costs against ${f(T.unfiltered.meanR)}R for the same methods on every day; the trades the filters dropped made ${f(T.keptVsDropped.meanB)}R. ${r.verdict === 'PASS' ? 'It cleared every line of the bar.' : 'It did not clear the bar (' + (missed.join(', ') || 'see above') + ').'}`);
  L.push('', '## What it does NOT show', '');
  L.push('- It does not show that any method works: the trade lists are each study\'s own, mostly FAIL verdicts; a regime filter cannot turn a losing rule into an edge unless the losing trades sit in one state, and this tests only that.');
  L.push('- The regime is one fixed reading of the H4 market cycle (swing size 3, 12 and 30 candles); no other reading was tried and none should be after this result.');
  L.push('- Lists overlap (the same market move can be traded by several methods), so the pooled trades are not independent; the month t counts each month once, which only partly allows for that.');
  L.push('- The direction-chain-gate list holds every candidate signal before its own one-position rule; it is used as saved.');
  L.push('- Choices this run made where the pre-registration is silent: "known for 12 H4 candles" = 12 or more closed H4 candles since the box was confirmed; "within the last 30" = the break is one of the last 30 closed H4 candles; the walk-forward (T2) chooses on every year of a list before the test year; the placebo compares the book\'s out-of-sample mean R; Holm uses two-sided p (stricter than one-sided); T2 and T3 pass only on mean > 0, month t >= 2 with Holm p < 0.05, positive at 2x costs, 30+ trades and above their unfiltered pool. Nine box-touch rows are limits filled at an open already past the stop (closed at once, 0R before costs): used as saved.');
  L.push('- Nothing live changed. A pass would earn a forward paper record only.');
  return L.join('\n') + '\n';
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) main().catch((e) => { console.error(e); process.exit(1); });
