// H4 engulf failed (EF) to the next H4 engulf (EG): the rule of PREREGISTRATION.md (committed alone before this file), run on
// the shared toolkit. Pure functions + `node research/edge/h4-ef-to-eg/run.mjs` (reads the toolkit's candle cache, outside
// git; writes result.json and trades.json next to this file). Research only: nothing live reads it, it places nothing.
//
// The rule (a buy; a sell mirrors it), closed candles only:
//   1. H4 and M15 candles resampled from the 5-minute cache (UTC-aligned).
//   2. H4 engulf zones = council/eg-methods.mjs `zones(H4, '4h')` unchanged (EG_SPAN 3, the base candle wick to wick, `fail`
//      within the desk's life of 120 H4 candles).
//   3. A SELL zone with `fail` set (an H4 close above its top) is a BUY barrier from that close on.
//   4. Return: the first M15 candle starting at or after the fail that trades into it (low <= top), within 120 H4 candles.
//   5. Break: from the return candle on, the first M15 close above the last unbroken M15 swing high (edgekit.structure, K 3),
//      within 48 M15 candles; an M15 close below the bottom first ends the setup. One setup a barrier.
//   6. Order at that close: buy limit at the top, stop under the bottom by 10 % of the height, target the bottom of the nearest
//      alive H4 SELL zone wholly above the entry (skip under 2R, never a farther one), skip a risk under 4 x the round trip;
//      life 24 H4 candles, cancelled by an M15 close below the stop or the target trading first.
//   7. edgekit.simulate on 5-minute candles; time exit at the close of the 120th H4 candle after the fill candle.
//   8. One order or position at a time per market.
import fs from 'node:fs';
import * as K from '../_lib/edgekit.mjs';
import { zones as egZones } from '../../../council/eg-methods.mjs';
import { financing } from '../../../council/fills.mjs';

export const P = { K: 3, life: 120, breakWin: 48, orderLife: 24, hold: 120, bufFrac: 0.10, minRR: 2, minCostX: 4, seeds: 40, placeboNeed: 38 };
export const CUTOFF = Date.UTC(2026, 10, 16) / 1000; // entries placed from here on are left out (the week the rule was shaped)
export const WINDOWS = {
  REP: [Date.UTC(2010, 0, 1) / 1000, Date.UTC(2020, 0, 1) / 1000],
  IS: [Date.UTC(2020, 0, 1) / 1000, Date.UTC(2024, 0, 1) / 1000],
  OOS: [Date.UTC(2024, 0, 1) / 1000, null],
};

const desk = (bars) => bars.map((b) => ({ time: b.t, open: b.o, high: b.h, low: b.l, close: b.c }));
const lowerBound = (arr, v, f) => { let lo = 0, hi = arr.length; while (lo < hi) { const m = (lo + hi) >> 1; if (f(arr[m]) < v) lo = m + 1; else hi = m; } return lo; };

// Every setup (an order) of one market. pre = { H4, M15, Z, ev } may be handed in. Returns { setups, counts }.
export function setups(m5, pre = {}) {
  const H4 = pre.H4 || K.resample(m5, K.TF['4h']), M15 = pre.M15 || K.resample(m5, K.TF['15m']);
  const Z = pre.Z || egZones(desk(H4), '4h');
  const ev = pre.ev || K.structure(M15, P.K).events;
  const brk = { 1: new Uint8Array(M15.length), '-1': new Uint8Array(M15.length) };
  for (const e of ev) brk[e.dir][e.i] = 1;
  const counts = { zones: Z.length, barriers: 0, noReturn: 0, returned: 0, farClose: 0, noBreak: 0, broke: 0, smallStop: 0, noTarget: 0, under2R: 0, orders: 0 };
  const out = [];
  for (const z of Z) {
    if (z.fail == null) continue;
    counts.barriers++;
    const s = -z.dir; // a failed sell zone (dir -1) is a buy barrier
    const top = z.top, bot = z.bot, h = top - bot;
    if (!(h > 0)) continue;
    const limT = z.fi + P.life < H4.length ? H4[z.fi + P.life].e : Infinity;
    // 4. the return
    let r = -1;
    for (let j = lowerBound(M15, z.fail, (b) => b.t); j < M15.length && M15[j].t < limT; j++) {
      if (s > 0 ? M15[j].l <= top : M15[j].h >= bot) { r = j; break; }
    }
    if (r < 0) { counts.noReturn++; continue; }
    counts.returned++;
    // 5. the break with the barrier
    let jb = -1, far = false;
    for (let j = r; j < M15.length && j < r + P.breakWin; j++) {
      if (s > 0 ? M15[j].c < bot : M15[j].c > top) { far = true; break; }
      if (brk[s][j]) { jb = j; break; }
    }
    if (far) { counts.farClose++; continue; }
    if (jb < 0) { counts.noBreak++; continue; }
    counts.broke++;
    // 6. the order
    const t = M15[jb].e;
    const entry = s > 0 ? top : bot, stop = s > 0 ? bot - P.bufFrac * h : top + P.bufFrac * h, risk = s * (entry - stop);
    if (!(risk >= P.minCostX * (pre.cost ?? 0))) { counts.smallStop++; continue; }
    let target = null;
    for (const y of Z) {
      if (y.at > t) break; // zones are in order of completion
      if (y.dir !== -s || y.end <= t) continue; // still alive: formed, not failed, life not over
      if (s > 0 ? y.bot > entry : y.top < entry) { const px = s > 0 ? y.bot : y.top; if (target == null || (s > 0 ? px < target : px > target)) target = px; }
    }
    if (target == null) { counts.noTarget++; continue; }
    const rr = (s * (target - entry)) / risk;
    if (!(rr >= P.minRR)) { counts.under2R++; continue; }
    let hk = K.barAt(H4, t); if (hk < 0) hk = K.closedCount(H4, t);
    let expire = hk + P.orderLife + 1 < H4.length ? H4[hk + P.orderLife + 1].t : t + (P.orderLife + 1) * K.TF['4h'];
    for (let j = jb + 1; j < M15.length && M15[j].e <= expire; j++) if (s > 0 ? M15[j].c < stop : M15[j].c > stop) { expire = M15[j].e; break; }
    counts.orders++;
    out.push({ side: s, t, entry, stop, target, rr, risk, expire, zbot: bot, ztop: top, failT: z.fail, returnT: M15[r].t, breakT: t });
  }
  out.sort((a, b) => a.t - b.t || a.entry - b.entry);
  return { setups: out, counts };
}

function targetFirst(m5, side, target, from, to) {
  for (let i = lowerBound(m5, from, (b) => b.t); i < m5.length && m5[i].t < to; i++) if (side > 0 ? m5[i].h >= target : m5[i].l <= target) return m5[i].t;
  return Infinity;
}
const finOf = (market, side, fill, risk, a, b) => (market === 'xau' && side > 0 ? financing({ market: 'xau', side: 'buy', entry: fill, r0: risk, filled: a, closed: b }).finR : 0);

// Trades of one market from its setups (one order or position at a time).
export function trade(U, m5, H4, market, cost) {
  const counts = { blocked: 0, nofill: 0, filled: 0, open: 0 };
  const trades = []; let busy = -Infinity;
  for (const u of U) {
    if (u.t < busy) { counts.blocked++; continue; }
    const expire = Math.min(u.expire, targetFirst(m5, u.side, u.target, u.t, u.expire));
    const base = { side: u.side, entry: u.entry, stop: u.stop, target: u.target, t: u.t, type: 'limit', expire };
    let r = K.simulate(base, m5, { cost });
    if (r.status === 'nofill' || r.status === 'bad') { counts.nofill++; busy = Math.max(busy, expire); continue; }
    let bi = K.barAt(H4, r.fillT); if (bi < 0) bi = K.closedCount(H4, r.fillT);
    const deadline = bi + P.hold < H4.length ? H4[bi + P.hold].e : Infinity;
    if (deadline !== Infinity) r = K.simulate({ ...base, maxHold: deadline - r.fillT }, m5, { cost });
    if (r.status === 'open' || deadline === Infinity) { counts.open++; busy = Infinity; continue; }
    counts.filled++; busy = r.exitT;
    const fin = finOf(market, u.side, r.fill, r.risk, r.fillT, r.exitT);
    const costR = cost / r.risk + fin;
    trades.push({ market, side: u.side, t: u.t, fillT: r.fillT, entry: u.entry, fill: r.fill, stop: u.stop, target: u.target, rr: u.rr,
      exitT: r.exitT, exit: r.exit, reason: r.reason, risk: r.risk, hold: deadline - r.fillT, R: r.R, Rnet: r.R - costR, R2: r.R - 2 * costR, finR: fin });
  }
  return { trades, counts };
}

// Placebo: the same market, side, risk distance, target in R and allowed hold, entered at market at the open of a random M15
// candle of the same calendar month. Returns the placebo trades of one seed.
export function placebo(trades, m5ByMarket, M15ByMarket, seed) {
  const rnd = K.rng(seed); const out = [];
  for (const x of trades) {
    const M15 = M15ByMarket[x.market], m5 = m5ByMarket[x.market];
    const d = new Date(x.fillT * 1000), a = Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), 1) / 1000, b = Date.UTC(d.getUTCFullYear(), d.getUTCMonth() + 1, 1) / 1000;
    const i0 = lowerBound(M15, a, (c) => c.t), i1 = lowerBound(M15, b, (c) => c.t);
    if (i1 <= i0) continue;
    const t = M15[i0 + Math.floor(rnd() * (i1 - i0))].t;
    const fi = lowerBound(m5, t, (c) => c.t); if (fi >= m5.length) continue;
    const fill = m5[fi].o, stop = fill - x.side * x.risk, target = fill + x.side * x.rr * x.risk;
    const r = K.simulate({ side: x.side, entry: fill, stop, target, t, type: 'market', maxHold: x.hold }, m5, { cost: 0 });
    if (r.status !== 'win' && r.status !== 'loss' && r.status !== 'be') continue;
    const costR = K.COSTS[x.market] / r.risk + finOf(x.market, x.side, r.fill, r.risk, r.fillT, r.exitT);
    out.push({ market: x.market, side: x.side, fillT: r.fillT, exitT: r.exitT, R: r.R, Rnet: r.R - costR });
  }
  return out;
}

// ---- statistics on the pre-registered windows (by fill month, zero months included) ---------------------------------
const ym = (t) => { const d = new Date(t * 1000); return d.getUTCFullYear() * 12 + d.getUTCMonth(); };
export function windowStats(trades, [a, b], key = 'Rnet') {
  const xs = trades.filter((x) => x.fillT >= a && x.fillT < b);
  const n = xs.length, vals = xs.map((x) => x[key]);
  const mean = n ? vals.reduce((p, q) => p + q, 0) / n : null;
  const m0 = ym(a), m1 = ym(b - 1), sums = new Array(m1 - m0 + 1).fill(0);
  for (const x of xs) sums[ym(x.fillT) - m0] += x[key];
  const M = sums.length, mm = sums.reduce((p, q) => p + q, 0) / M;
  const sd = M > 1 ? Math.sqrt(sums.reduce((p, q) => p + (q - mm) ** 2, 0) / (M - 1)) : 0;
  const tMonth = sd > 0 && n ? mm / (sd / Math.sqrt(M)) : null;
  let cum = 0, peak = 0, dd = 0; for (const v of [...xs].sort((p, q) => p.exitT - q.exitT).map((x) => x[key])) { cum += v; peak = Math.max(peak, cum); dd = Math.min(dd, cum - peak); }
  return { n, wins: xs.filter((x) => x.R > 1e-9).length, meanR: mean, total: vals.reduce((p, q) => p + q, 0), months: M, tMonth,
    pMonth: tMonth == null ? null : K.pFromT(tMonth, M - 1), maxDD: dd };
}
export function evaluate(T, W) {
  const res = {};
  for (const w of ['REP', 'IS', 'OOS']) { res[w] = windowStats(T, W[w]); res[w + '_gross'] = windowStats(T, W[w], 'R'); res[w + '_2x'] = windowStats(T, W[w], 'R2'); }
  for (const w of ['REP', 'IS', 'OOS']) { res[w + '_buys'] = windowStats(T.filter((x) => x.side > 0), W[w]); res[w + '_sells'] = windowStats(T.filter((x) => x.side < 0), W[w]); }
  const byYear = {}, byReason = {};
  for (const x of T) {
    const y = new Date(x.fillT * 1000).getUTCFullYear(); const s = (byYear[y] ||= { n: 0, wins: 0, R: 0, Rnet: 0 }); s.n++; s.wins += x.R > 1e-9; s.R += x.R; s.Rnet += x.Rnet;
    const q = (byReason[x.reason] ||= { n: 0, Rnet: 0 }); q.n++; q.Rnet += x.Rnet;
  }
  for (const y of Object.keys(byYear)) byYear[y].meanRnet = byYear[y].Rnet / byYear[y].n;
  const rrs = T.map((x) => x.rr).sort((a, b) => a - b);
  res.targetR = rrs.length ? { median: rrs[Math.floor(rrs.length / 2)], p10: rrs[Math.floor(rrs.length * 0.1)], p90: rrs[Math.floor(rrs.length * 0.9)] } : null;
  res.byYear = byYear; res.byReason = byReason;
  return res;
}
export function bar(e, pHolm, plac) {
  const lines = {
    oosMeanPositive: e.OOS.meanR > 0,
    oosMonthT2: e.OOS.tMonth != null && e.OOS.tMonth >= 2,
    holmP05: pHolm != null && pHolm < 0.05 && e.OOS.tMonth > 0,
    isMeanPositive: e.IS.meanR > 0,
    oos2xPositive: e.OOS_2x.meanR > 0,
    oos30: e.OOS.n >= 30,
    repMeanPositive: e.REP.meanR > 0,
    placebo: plac != null && plac.beaten >= P.placeboNeed,
  };
  return { lines, pass: Object.values(lines).every(Boolean) };
}
export function verdictOf(e, b) {
  if (b.pass) return 'PASS';
  if (!(e.OOS.meanR > 0) || !(e.IS.meanR > 0) || !(e.OOS_2x.meanR > 0) || !(e.REP.meanR > 0)) return 'FAIL';
  return 'INCONCLUSIVE';
}

const r4 = (x) => (x == null || !Number.isFinite(x) ? x : Math.round(x * 1e4) / 1e4);
const round = (o) => JSON.parse(JSON.stringify(o, (k, v) => (typeof v === 'number' ? r4(v) : v)));
const keyOf = (u) => [u.side, u.t, u.entry, u.stop, u.target].join('|');

async function main() {
  const t0 = Date.now(); const log = (...a) => console.error(...a, ((Date.now() - t0) / 1000).toFixed(0) + 's');
  const m5s = {}, M15s = {}, H4s = {}, all = [], per = {}, counts = {}; let end = 0;
  for (const mk of K.MARKETS) {
    const m5 = K.load(mk, '5m', { from: '2010-01-01' });
    end = Math.max(end, m5[m5.length - 1].e);
    const H4 = K.resample(m5, K.TF['4h']), M15 = K.resample(m5, K.TF['15m']);
    m5s[mk] = m5; M15s[mk] = M15; H4s[mk] = H4;
    const S = setups(m5, { H4, M15, cost: K.COSTS[mk] });
    const U = S.setups.filter((u) => u.t < CUTOFF);
    const r = trade(U, m5, H4, mk, K.COSTS[mk]);
    counts[mk] = { ...S.counts, leftOutAfterCutoff: S.setups.length - U.length, ...r.counts };
    per[mk] = r.trades; all.push(...r.trades);
    log(mk, JSON.stringify(counts[mk]));
  }
  const W = { ...WINDOWS, OOS: [WINDOWS.OOS[0], end] };
  // cut-series check on gold: the orders known by a moment are the same when the series ends there
  const cut = [];
  for (const frac of [0.3, 0.55, 0.8]) {
    const m5 = m5s.xau, ci = Math.floor(m5.length * frac), T = m5[ci].e;
    const full = setups(m5, { H4: H4s.xau, M15: M15s.xau, cost: K.COSTS.xau }).setups.filter((u) => u.t <= T).map(keyOf);
    const part = setups(m5.slice(0, ci + 1), { cost: K.COSTS.xau }).setups.filter((u) => u.t <= T).map(keyOf);
    cut.push({ at: new Date(T * 1000).toISOString(), orders: full.length, same: JSON.stringify(full) === JSON.stringify(part) });
  }
  log('cut', JSON.stringify(cut));
  // tests: pool + each market
  const ids = ['P', ...K.MARKETS];
  const evals = { P: evaluate(all, W) };
  for (const mk of K.MARKETS) evals[mk] = evaluate(per[mk], W);
  // placebo
  const plOOS = Object.fromEntries(ids.map((id) => [id, []]));
  for (let s = 1; s <= P.seeds; s++) {
    const pl = placebo(all, m5s, M15s, 1000 + s);
    plOOS.P.push(windowStats(pl, W.OOS).meanR);
    for (const mk of K.MARKETS) plOOS[mk].push(windowStats(pl.filter((x) => x.market === mk), W.OOS).meanR);
  }
  log('placebo done');
  const plac = {};
  for (const id of ids) {
    const real = evals[id].OOS.meanR, xs = plOOS[id].filter((v) => v != null).sort((a, b) => a - b);
    plac[id] = { runs: xs.length, beaten: real == null ? 0 : xs.filter((v) => real > v).length, median: xs[Math.floor(xs.length / 2)], p95: xs[Math.floor(xs.length * 0.95)] ?? null };
  }
  const ph = K.holm(ids.map((id) => evals[id].OOS.pMonth ?? 1));
  const tests = {};
  ids.forEach((id, i) => { const b = bar(evals[id], ph[i], plac[id]); tests[id] = { pHolm: ph[i], bar: b, verdict: verdictOf(evals[id], b), placebo: plac[id], ...evals[id] }; });
  const result = round({
    study: 'h4-ef-to-eg', built: new Date().toISOString().slice(0, 10), verdict: tests.P.verdict, primary: 'P', markets: K.MARKETS,
    windows: { REP: '2010-01-01 to 2019-12-31', IS: '2020-01-01 to 2023-12-31', OOS: '2024-01-01 to ' + new Date(W.OOS[1] * 1000).toISOString().slice(0, 10) + ' (exclusive; entries placed from 2026-11-16 left out)', by: 'fill time' },
    cost: { roundTrip: K.COSTS, financing: 'council/fills.mjs financing on gold buys only', twoX: 'round trip and financing doubled' },
    params: P, harness: 'gold H4 zones of November 2026: both of the example\'s H4 sell engulf zones found to the cent before the run (checked outside this file; the example is not written here)',
    cutCheck: cut, counts, tests,
  });
  const dir = new URL('.', import.meta.url).pathname;
  fs.writeFileSync(dir + 'result.json', JSON.stringify(result, null, 1) + '\n');
  const rows = all.map((x) => [x.market, x.side, x.t, x.fillT, r4(x.entry), r4(x.stop), r4(x.target), x.exitT, r4(x.exit), ({ stop: 's', target: 'g', time: 'x' })[x.reason] || x.reason, r4(x.R), r4(x.Rnet)]);
  fs.writeFileSync(dir + 'trades.json', JSON.stringify({ cols: ['market', 'side', 'orderTime', 'fillTime', 'entry', 'stop', 'target', 'exitTime', 'exit', 'reason(s=stop,g=target,x=time)', 'R', 'Rnet'],
    note: 'times unix s UTC; prices OANDA mid; Rnet after edgekit.COSTS and gold-buy financing', rows }) + '\n');
  log('done', tests.P.verdict);
}

if (process.argv[1] && new URL(import.meta.url).pathname === fs.realpathSync(process.argv[1])) main();
