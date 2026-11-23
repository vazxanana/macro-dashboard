// research/edge/chart-rules-2020/run.mjs - the two chart rules of PREREGISTRATION.md (23 Nov 2026).
// node research/edge/chart-rules-2020/run.mjs market <market> <outDir>   signals + simulations of one market -> <outDir>/<m>.json
// node research/edge/chart-rules-2020/run.mjs report <outDir>            pool the markets, apply the bar, write result.json
// node research/edge/chart-rules-2020/run.mjs cut <market>               look-ahead check on real candles (random cuts)
// Research only: imports edgekit, combo-grid (buildZones, multi) and combo-grid-2 (COSTS, exclusions); places nothing.
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import * as K from '../_lib/edgekit.mjs';
import { buildZones, multi } from '../combo-grid/run.mjs';
import { COSTS, exclusions } from '../combo-grid-2/run.mjs';

const HERE = path.dirname(fileURLToPath(import.meta.url));
export const MARKETS = ['xau', 'eurusd', 'gbpusd', 'usdjpy', 'audusd', 'nzdusd', 'usdcad', 'usdchf', 'eurjpy', 'xag',
  'gbpjpy', 'eurgbp', 'audjpy', 'cadjpy', 'euraud', 'nas100', 'spx500', 'de40'];
export const START = Date.UTC(2020, 0, 1) / 1000, SPLIT = Date.UTC(2024, 0, 1) / 1000;
export const P = { atrN: 14, atrK: 0.25, life: 24, minRR: 3, window: 24, K: 3, cap: { '1h': 5 * 86400, '4h': 10 * 86400 } };
export const TESTS = { T1: 'Barrier retest, H1 boxes', T2: 'Barrier retest, H4 boxes', T3: 'Sweep reversal, H1' };

// ATR(atrN) known at the close of candle i: mean true range of candles i-atrN+1 .. i
export function atrs(L, n = P.atrN) {
  const out = new Float64Array(L.length).fill(NaN); let s = 0; const tr = [];
  for (let i = 0; i < L.length; i++) {
    const b = L[i], pc = i ? L[i - 1].c : b.o; const x = Math.max(b.h - b.l, Math.abs(b.h - pc), Math.abs(b.l - pc));
    tr.push(x); s += x; if (tr.length > n) s -= tr[tr.length - 1 - n];
    if (i >= n - 1) out[i] = s / n;
  }
  return out;
}

// the target zones: engulf and failed-engulf zones of H4 and D1, sorted by the time they are known
export function targetZones(H4, D1) {
  const Z = [];
  for (const L of [H4, D1]) for (const k of ['eg', 'ef']) for (const z of buildZones(k, L)) Z.push({ d: z.d, bot: z.bot, top: z.top, at: z.at, end: z.end });
  return Z.sort((a, b) => a.at - b.at);
}
// for a buy (s = 1): the bottom of the nearest standing sell zone wholly above the entry; a sell mirrors it
export function targetFor(Z, s, entry, T) {
  let best = null;
  for (const z of Z) {
    if (z.at > T) break;
    if (!(T < z.end) || z.d !== -s) continue;
    if (s > 0 ? z.bot > entry && (best == null || z.bot < best) : z.top < entry && (best == null || z.top > best)) best = s > 0 ? z.bot : z.top;
  }
  return best;
}

// (A) barrier retest on the boxes of L (timeframe sec): one signal per box break
export function signalsA(L, sec, cost) {
  const A = atrs(L), out = [];
  for (const b of K.boxesClose(L)) {
    if (!b.dir || b.bi < 0 || !Number.isFinite(A[b.bi])) continue;
    const s = b.dir, T = L[b.bi].e, pad = P.atrK * A[b.bi] + cost / 2;
    const entry = s > 0 ? b.hi : b.lo, stop = s > 0 ? b.lo - pad : b.hi + pad;
    if (!(s * (entry - stop) > 0)) continue;
    out.push({ s, T, entry, stop, expire: T + P.life * sec });
  }
  return out;
}

// (B) sweep reversal on H1 swings
export function signalsB(L, cost) {
  const A = atrs(L), sw = K.swings(L, P.K).sort((a, b) => a.ci - b.ci || a.i - b.i), out = [];
  let k = 0; const hs = [], ls = []; let lastL = null, lastH = null; const act = { 1: null, '-1': null };
  for (let j = 0; j < L.length; j++) {
    while (k < sw.length && sw[k].ci < j) { const x = sw[k++]; if (x.type === 'H') { hs.push(x); lastH = x; } else { ls.push(x); lastL = x; } }
    const b = L[j];
    // new sweeps (each swing swept once; a newer sweep replaces a waiting one)
    if (lastL && b.l < lastL.price) { act[1] = { start: j, ext: b.l, fresh: true }; lastL = null; }
    if (lastH && b.h > lastH.price) { act[-1] = { start: j, ext: b.h, fresh: true }; lastH = null; }
    for (const s of [1, -1]) {
      const a = act[s]; if (!a) continue;
      if (j > a.start + P.window) { act[s] = null; continue; }
      if (!a.fresh) { if (s > 0 ? b.c < a.ext : b.c > a.ext) { act[s] = null; continue; } a.ext = s > 0 ? Math.min(a.ext, b.l) : Math.max(a.ext, b.h); }
      a.fresh = false;
      // the most recent confirmed swing of the other kind that is a lower high (higher low for a sell) beyond the extreme
      const arr = s > 0 ? hs : ls; if (arr.length < 2) continue;
      const x = arr[arr.length - 1], prev = arr[arr.length - 2];
      if (!(s > 0 ? x.price < prev.price && x.price > a.ext : x.price > prev.price && x.price < a.ext)) continue;
      if (!(s > 0 ? b.c > x.price : b.c < x.price) || !Number.isFinite(A[j])) continue;
      const pad = P.atrK * A[j] + cost / 2, entry = x.price, stop = s > 0 ? a.ext - pad : a.ext + pad;
      if (s * (entry - stop) > 0) out.push({ s, T: b.e, entry, stop, expire: b.e + P.life * 3600 });
      act[s] = null;
    }
  }
  return out;
}

const inBad = (X, t) => { for (const [a, b] of X) if (t >= a && t <= b) return true; return false; };

export function frames(M5) { return { '1h': K.resample(M5, 3600), '4h': K.resample(M5, 14400), '1d': K.dailyNY(M5) }; }

export function runMarket(market, { from = '2019-01-01', to } = {}) {
  const M5 = K.load(market, '5m', { from, to }); const F = frames(M5); const cost = COSTS[market]; const X = exclusions(market);
  const Z = targetZones(F['4h'], F['1d']);
  const sets = { T1: [signalsA(F['1h'], 3600, cost), P.cap['1h']], T2: [signalsA(F['4h'], 14400, cost), P.cap['4h']], T3: [signalsB(F['1h'], cost), P.cap['1h']] };
  const trades = []; let dropped = 0;
  for (const [test, [sig, cap]] of Object.entries(sets)) {
    for (const g of sig) {
      if (g.T < START - 30 * 86400) continue;
      const risk0 = g.s * (g.entry - g.stop), tgt = targetFor(Z, g.s, g.entry, g.T);
      const rr = tgt == null ? null : (g.s * (tgt - g.entry)) / risk0;
      const zone = rr != null && rr >= P.minRR;
      const r = multi(M5, g.s, g.entry, g.stop, 'limit', g.T, g.expire, zone ? rr : 2, cap);
      if (!r || r.t < START) continue;
      if (inBad(X, r.t)) { dropped++; continue; }
      trades.push({ test, m: market, s: g.s, t: r.t, risk: +r.risk.toPrecision(6), c: +(cost / r.risk).toFixed(5), zone, rr: rr == null ? null : +rr.toFixed(2),
        R2: +r.R[1].toFixed(4), Rt: zone ? +r.R[5].toFixed(4) : null });
    }
  }
  return { market, cost, last: M5.length ? M5[M5.length - 1].e : null, dropped, signals: Object.fromEntries(Object.entries(sets).map(([k, v]) => [k, v[0].length])), trades };
}

// ---- report --------------------------------------------------------------------------------------------------------
const r3 = (x) => (x == null || !Number.isFinite(x) ? null : +x.toFixed(3));
function summ(tr, key, mult = 1) {
  const xs = tr.map((x) => ({ R: x[key] - mult * x.c, t: x.t }));
  const st = K.stats(xs, { key: 'R', time: 't' });
  const pick = (o) => ({ n: o.n, won: o.wins, mean: r3(o.meanR), total: r3(o.total), tTrade: r3(o.tTrade), tMonth: r3(o.tMonth), pMonth: o.pMonth == null ? null : +o.pMonth.toPrecision(3), months: o.months, maxDD: r3(o.maxDD) });
  return { all: pick(st), discovery: pick(st.IS), confirmation: pick(st.OOS) };
}
export function judge(rows, padj) {
  return Object.keys(rows).map((k, i) => {
    const r = rows[k], d = r.net.discovery, c = r.net.confirmation, d2 = r.cost2.discovery, c2 = r.cost2.confirmation;
    const checks = {
      discovery: d.n >= 100 && d.mean > 0 && d.tMonth >= 2,
      confirmation: c.n >= 50 && c.mean > 0 && c.tMonth >= 2 && padj[i] < 0.05,
      doubleCost: d2.mean > 0 && c2.mean > 0,
    };
    const countOnly = !(d.n >= 100 && c.n >= 50) && (d.n < 100 ? true : d.mean > 0 && d.tMonth >= 2) && (c.n < 50 ? true : c.mean > 0 && c.tMonth >= 2);
    return { test: k, pass: checks.discovery && checks.confirmation && checks.doubleCost, checks, countOnly, holmP: +padj[i].toPrecision(3) };
  });
}
export function report(dir, markets = MARKETS) {
  const all = [], meta = {};
  for (const m of markets) { const f = path.join(dir, m + '.json'); if (!fs.existsSync(f)) throw new Error('missing ' + f); const o = JSON.parse(fs.readFileSync(f, 'utf8')); all.push(...o.trades); meta[m] = { signals: o.signals, dropped: o.dropped, last: o.last, cost: o.cost }; }
  const rows = {}, desc = {};
  for (const k of Object.keys(TESTS)) {
    const tz = all.filter((x) => x.test === k && x.zone);
    rows[k] = { name: TESTS[k], net: summ(tz, 'Rt'), gross: summ(tz, 'Rt', 0), cost2: summ(tz, 'Rt', 2),
      medianRR: r3(tz.map((x) => x.rr).sort((a, b) => a - b)[Math.floor(tz.length / 2)] ?? null),
      byMarket: Object.fromEntries(markets.map((m) => { const s = summ(tz.filter((x) => x.m === m), 'Rt').all; return [m, { n: s.n, mean: s.mean, tMonth: s.tMonth }]; })) };
    desc[k] = { sameSignals2R: summ(tz, 'R2').all, sameSignals2Rconf: summ(tz, 'R2').confirmation,
      allSignals2R: summ(all.filter((x) => x.test === k), 'R2').all, allSignals2Rgross: summ(all.filter((x) => x.test === k), 'R2', 0).all };
  }
  const p = Object.keys(rows).map((k) => rows[k].net.confirmation.pMonth ?? 1);
  const padj = K.holm(p); const J = judge(rows, padj);
  const nPass = J.filter((x) => x.pass).length;
  const verdict = nPass ? 'PASS' : J.every((x) => x.pass || x.countOnly) ? 'INCONCLUSIVE' : 'FAIL';
  const best = J.map((x) => ({ ...x, r: rows[x.test].net.confirmation })).sort((a, b) => (b.r.tMonth ?? -9) - (a.r.tMonth ?? -9))[0];
  const headline = `${nPass} of 3 tests pass; ` + Object.keys(rows).map((k) => { const c = rows[k].net.confirmation; return `${k} confirmation ${c.mean >= 0 ? '+' : ''}${c.mean?.toFixed(3)}R a trade (n ${c.n}, month t ${c.tMonth?.toFixed(2)})`; }).join(', ') + '.';
  const out = { study: 'chart-rules-2020', built: '2026-11-23', verdict, headline, window: { from: '2020-01-01', split: '2024-01-01', to: new Date(Math.max(...Object.values(meta).map((x) => x.last)) * 1000).toISOString().slice(0, 10) },
    params: P, tests: rows, judged: J, descriptive: desc, markets: meta, best: best.test };
  fs.writeFileSync(path.join(HERE, 'result.json'), JSON.stringify(out, null, 1) + '\n');
  return out;
}

// ---- look-ahead check on real candles --------------------------------------------------------------------------------
export function cutCheck(market, cuts = 6, seed = 5) {
  const M5 = K.load(market, '5m', { from: '2023-01-01', to: '2024-07-01' }); const cost = COSTS[market]; const F = frames(M5);
  const full = { A1: signalsA(F['1h'], 3600, cost), A4: signalsA(F['4h'], 14400, cost), B: signalsB(F['1h'], cost) };
  const Zf = targetZones(F['4h'], F['1d']); const r = K.rng(seed); let checked = 0, bad = 0;
  for (let c = 0; c < cuts; c++) {
    const cut = M5[Math.floor(M5.length * (0.3 + 0.6 * r()))].t; const G = frames(M5.filter((b) => b.e <= cut));
    const part = { A1: signalsA(G['1h'], 3600, cost), A4: signalsA(G['4h'], 14400, cost), B: signalsB(G['1h'], cost) };
    const Zc = targetZones(G['4h'], G['1d']);
    for (const k of Object.keys(full)) {
      const a = full[k].filter((x) => x.T <= cut).map((x) => [x.s, x.T, x.entry, x.stop, targetFor(Zf, x.s, x.entry, x.T)].join());
      const b = part[k].filter((x) => x.T <= cut).map((x) => [x.s, x.T, x.entry, x.stop, targetFor(Zc, x.s, x.entry, x.T)].join());
      checked += a.length; if (a.join('|') !== b.join('|')) bad++;
    }
  }
  return { market, cuts, signalsChecked: checked, mismatchedSets: bad };
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const [cmd, a, b] = process.argv.slice(2);
  if (cmd === 'market') { const t0 = Date.now(); const o = runMarket(a); fs.mkdirSync(b, { recursive: true }); fs.writeFileSync(path.join(b, a + '.json'), JSON.stringify(o)); console.log(a, o.signals, o.trades.length, 'trades', ((Date.now() - t0) / 1000).toFixed(0) + 's'); }
  else if (cmd === 'report') { const o = report(a); console.log(o.verdict, o.headline); console.log(JSON.stringify(o.judged)); }
  else if (cmd === 'cut') console.log(JSON.stringify(cutCheck(a)));
  else console.log('usage: run.mjs market <m> <dir> | report <dir> | cut <m>');
}
