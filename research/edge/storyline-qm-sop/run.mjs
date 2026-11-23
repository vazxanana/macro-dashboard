// Breakout sequence with QM breaks only (pre-registered 23 Nov 2026, PREREGISTRATION.md, committed before this file).
// Pure functions + `node research/edge/storyline-qm-sop/run.mjs` (reads the toolkit's candle cache, outside git; writes
// result.json and trades.json next to this file). Research only: nothing live reads it, nothing is placed.
//
// The rule, in the order of PREREGISTRATION.md (closed candles only):
//   BO  = every break (BO or ChoCh) of edgekit.structure on the setup timeframe S; side = its direction.
//   BO zone = the broken level to the extreme of the leg the break came from (S candles from the broken swing to the break).
//   VR  = the FIRST QM against the BO on L (one timeframe lower), completed after the BO candle closed and before the next
//         break on S. VR box = its zone, VR extreme = its head.
//   CF  = the first QM with the BO on L after the VR, before the next S break and before an L close beyond the VR extreme.
//         Rejected (counted, no second CF waited for): (a) CF zone overlaps the VR box; (b) CF zone does not touch the BO zone.
//   Entry = limit at the CF shoulder, placed at the CF candle's close, alive 24 L candles; cancelled by an L close beyond the
//         CF head, or when price reaches the target first. Stop = CF head + one round-trip cost. Target = VR extreme.
//         Skip if the target is under 1R or the risk under 3x the round-trip cost.
//   Fills / exits on 5-minute candles (edgekit.simulate); time exit after 5 trading days (= 7 calendar days from a fill);
//   one position at a time per market and S (an order still resting also holds the slot: known at the time).
import fs from 'node:fs';
import * as K from '../_lib/edgekit.mjs';

export const P = { K: 3, life: 24, hold: 7 * 86400, minRR: 1, minRiskCosts: 3 };
export const LOWER = { '4h': '1h', '1h': '30m', '30m': '15m' };
export const WINDOWS = {
  REP: [Date.UTC(2010, 0, 1) / 1000, Date.UTC(2020, 0, 1) / 1000],
  IS: [Date.UTC(2020, 0, 1) / 1000, Date.UTC(2024, 0, 1) / 1000],
  OOS: [Date.UTC(2024, 0, 1) / 1000, null], // end = the last complete UTC day in the cache (set at run time)
};
export const TESTS = [
  { id: 'T1', markets: ['xau'], S: '1h', primary: true, label: 'gold, setup H1 (VR and CF M30)' },
  { id: 'T2', markets: ['xau'], S: '4h', label: 'gold, setup H4 (VR and CF H1)' },
  { id: 'T3', markets: ['xau'], S: '30m', label: 'gold, setup M30 (VR and CF M15)' },
  { id: 'T4', markets: ['eurusd', 'gbpusd', 'usdjpy', 'audusd'], S: '1h', label: 'four majors pooled, setup H1' },
];

const overlap = (a, b) => a.lo <= b.hi && a.hi >= b.lo;

// Setups (the orders that would be placed) from S and L candles. Every field depends only on candles closed by `order.t`.
export function setups(Sb, Lb, cost) {
  const ev = K.structure(Sb, P.K).events;
  const Q = K.qms(Lb, P.K);
  const counts = { bo: ev.length, vr: 0, cf: 0, rejInsideVR: 0, rejNoBarrier: 0, noCF: 0, skipRR: 0, skipRisk: 0, orders: 0 };
  const out = [];
  let q0 = 0;
  for (let k = 0; k < ev.length; k++) {
    const bo = ev[k], s = bo.dir, tNext = k + 1 < ev.length ? ev[k + 1].t : Infinity;
    // BO zone: from the broken level to the extreme of the leg (broken swing .. break candle)
    let ext = s > 0 ? Infinity : -Infinity;
    for (let x = bo.from; x <= bo.i; x++) ext = s > 0 ? Math.min(ext, Sb[x].l) : Math.max(ext, Sb[x].h);
    const boZone = s > 0 ? { lo: ext, hi: bo.level } : { lo: bo.level, hi: ext };
    while (q0 < Q.length && Q[q0].t <= bo.t) q0++;
    let vr = null, qi = q0;
    for (; qi < Q.length && Q[qi].t < tNext; qi++) if (Q[qi].side === -s) { vr = Q[qi]; break; }
    if (!vr) continue;
    counts.vr++;
    // first L close beyond the VR extreme after the VR
    let beyond = Infinity;
    for (let j = vr.i + 1; j < Lb.length && Lb[j].e < tNext; j++) if (s > 0 ? Lb[j].c > vr.head : Lb[j].c < vr.head) { beyond = Lb[j].e; break; }
    const until = Math.min(tNext, beyond);
    let cf = null;
    for (let x = qi + 1; x < Q.length && Q[x].t < until; x++) if (Q[x].side === s && Q[x].t > vr.t) { cf = Q[x]; break; }
    if (!cf) { counts.noCF++; continue; }
    counts.cf++;
    if (overlap(cf.zone, vr.zone)) { counts.rejInsideVR++; continue; }
    if (!overlap(cf.zone, boZone)) { counts.rejNoBarrier++; continue; }
    const entry = cf.shoulder, stop = s > 0 ? cf.head - cost : cf.head + cost, target = vr.head;
    const risk = s * (entry - stop), reward = s * (target - entry);
    if (!(risk >= P.minRiskCosts * cost) || !(risk > 0)) { counts.skipRisk++; continue; }
    if (!(reward >= P.minRR * risk)) { counts.skipRR++; continue; }
    // order life: 24 L candles from the CF candle; cancelled at the close of an L candle beyond the CF head
    const lifeI = Math.min(cf.i + P.life, Lb.length - 1);
    let expire = cf.i + P.life < Lb.length ? Lb[lifeI].e : cf.t + P.life * (Lb[1] ? Lb[1].t - Lb[0].t : 0);
    for (let j = cf.i + 1; j <= lifeI && Lb[j].e <= expire; j++) if (s > 0 ? Lb[j].c < cf.head : Lb[j].c > cf.head) { expire = Lb[j].e; break; }
    counts.orders++;
    out.push({ side: s, t: cf.t, entry, stop, target, expire, boT: bo.t, boKind: bo.kind, vrT: vr.t, cfT: cf.t, risk0: risk, rr: reward / risk });
  }
  out.sort((a, b) => a.t - b.t);
  return { setups: out, counts };
}

// First 5-minute candle (at or after `from`, before `to`) that reaches the target: the order is cancelled from its start.
function targetFirst(m5, side, target, from, to) {
  let lo = 0, hi = m5.length; while (lo < hi) { const m = (lo + hi) >> 1; if (m5[m].t < from) lo = m + 1; else hi = m; }
  for (let i = lo; i < m5.length && m5[i].t < to; i++) if (side > 0 ? m5[i].h >= target : m5[i].l <= target) return m5[i].t;
  return Infinity;
}

// Trades of one market and setup timeframe. `end` = only trades closed by then are booked.
export function runMarket(m5, S, cost, { end = Infinity } = {}) {
  const Sb = K.resample(m5, K.TF[S]), Lb = K.resample(m5, K.TF[LOWER[S]]);
  const { setups: U, counts } = setups(Sb, Lb, cost);
  counts.blocked = 0; counts.nofill = 0; counts.filled = 0; counts.open = 0; counts.cancelledTarget = 0;
  const trades = []; let busy = -Infinity;
  for (const u of U) {
    if (u.t < busy) { counts.blocked++; continue; }
    const tf = targetFirst(m5, u.side, u.target, u.t, u.expire);
    const expire = Math.min(u.expire, tf);
    const r = K.simulate({ side: u.side, entry: u.entry, stop: u.stop, target: u.target, t: u.t, type: 'limit', expire, maxHold: P.hold }, m5, { cost });
    if (r.status === 'nofill' || r.status === 'bad') { counts.nofill++; if (tf < u.expire) counts.cancelledTarget++; busy = Math.max(busy, expire); continue; }
    if (r.status === 'open' || r.exitT > end) { counts.open++; busy = Infinity; continue; }
    counts.filled++;
    busy = r.exitT;
    trades.push({ side: u.side, t: u.t, fillT: r.fillT, entry: u.entry, fill: r.fill, stop: u.stop, target: u.target, exitT: r.exitT,
      exit: r.exit, reason: r.reason, risk: r.risk, R: r.R, Rnet: r.Rnet, R2: r.R - (2 * cost) / r.risk, boKind: u.boKind, rr: u.rr });
  }
  return { trades, counts };
}

// ---- statistics on the pre-registered windows (month sums padded with zero months over the whole window) -------------
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
const r4 = (x) => (x == null || !Number.isFinite(x) ? x : Math.round(x * 1e4) / 1e4);
const round = (o) => JSON.parse(JSON.stringify(o, (k, v) => (typeof v === 'number' ? r4(v) : v)));

function maxGapDays(m5, a, b) {
  let g = 0; let prev = null;
  for (const x of m5) { if (x.t < a) { prev = x.t; continue; } if (x.t >= b) break; if (prev != null) g = Math.max(g, (x.t - prev) / 86400); prev = x.t; }
  return g;
}

export function evaluate(T, W) {
  const res = {};
  for (const w of ['REP', 'IS', 'OOS']) res[w] = windowStats(T, W[w]);
  res.OOS_2x = windowStats(T, W.OOS, 'R2');
  res.OOS_gross = windowStats(T, W.OOS, 'R');
  res.IS_gross = windowStats(T, W.IS, 'R');
  res.REP_gross = windowStats(T, W.REP, 'R');
  const byYear = {};
  for (const x of T) { const y = new Date(x.fillT * 1000).getUTCFullYear(); const s = (byYear[y] ||= { n: 0, wins: 0, Rnet: 0, R: 0 }); s.n++; s.wins += x.R > 1e-9; s.Rnet += x.Rnet; s.R += x.R; }
  for (const y of Object.keys(byYear)) byYear[y].meanRnet = byYear[y].Rnet / byYear[y].n;
  res.byYear = byYear;
  return res;
}

export function bar(e, pHolm) {
  const lines = {
    oosMeanPositive: e.OOS.meanR > 0,
    oosMonthT2: e.OOS.tMonth != null && e.OOS.tMonth >= 2,
    holmP05: pHolm != null && pHolm < 0.05,
    isMeanPositive: e.IS.meanR > 0,
    repMeanPositive: e.REP.meanR > 0,
    oos2xPositive: e.OOS_2x.meanR > 0,
    oos30: e.OOS.n >= 30,
  };
  return { lines, pass: Object.values(lines).every(Boolean) };
}

async function main() {
  const t0 = Date.now();
  const idx = JSON.parse(fs.readFileSync(K.DATA_DIR + '/INDEX.json', 'utf8'));
  const cache = {}; const gaps = {}; const perMarket = {};
  let end = Infinity;
  for (const m of K.MARKETS) {
    const m5 = K.load(m, '5m', { from: '2010-01-01' });
    cache[m] = m5;
    end = Math.min(end, Math.floor(m5[m5.length - 1].t / 86400) * 86400); // start of the last (partial) UTC day
  }
  const W = { ...WINDOWS, OOS: [WINDOWS.OOS[0], end] };
  for (const m of K.MARKETS) gaps[m] = { REP: maxGapDays(cache[m], ...W.REP), IS: maxGapDays(cache[m], ...W.IS), OOS: maxGapDays(cache[m], ...W.OOS) };
  const out = {}; const allTrades = [];
  for (const T of TESTS) {
    let tr = []; const counts = {};
    for (const m of T.markets) {
      const r = runMarket(cache[m], T.S, K.COSTS[m], { end });
      for (const x of r.trades) x.market = m;
      counts[m] = r.counts; tr = tr.concat(r.trades);
      perMarket[T.id + ':' + m] = evaluate(r.trades, W);
      console.error(T.id, m, r.counts, ((Date.now() - t0) / 1000).toFixed(0) + 's');
    }
    out[T.id] = { ...T, counts, eval: evaluate(tr, W) };
    for (const x of tr) allTrades.push({ test: T.id, ...x });
  }
  const ps = TESTS.map((T) => out[T.id].eval.OOS.pMonth ?? 1);
  // Holm on the one-sided bar: a test only counts when its t is positive; the p used is the two-sided Student p of the month t.
  const ph = K.holm(ps);
  TESTS.forEach((T, i) => { out[T.id].pHolm = ph[i]; out[T.id].bar = bar(out[T.id].eval, ph[i]); });
  const holeOver5 = Object.values(gaps).some((g) => Object.values(g).some((x) => x > 5));
  const t1 = out.T1;
  let verdict;
  if (t1.eval.OOS.n < 30 || holeOver5) verdict = 'INCONCLUSIVE';
  else if (t1.bar.pass) verdict = 'PASS';
  else if (TESTS.some((T) => out[T.id].bar.pass)) verdict = 'FAIL'; // T1 fails; a secondary pass alone names a hypothesis only
  else verdict = 'FAIL';
  const result = round({
    study: 'storyline-qm-sop', built: new Date().toISOString().slice(0, 10), verdict,
    primary: 'T1', windows: { REP: '2010-01-01 to 2019-12-31', IS: '2020-01-01 to 2023-12-31', OOS: '2024-01-01 to ' + new Date(end * 1000).toISOString().slice(0, 10) + ' (exclusive)' },
    costs: K.COSTS, params: { ...P, lower: LOWER, holdNote: '5 trading days = 7 calendar days from the fill', monthKey: 'fill time' },
    dataGapsDays: gaps, dataSource: idx.source,
    tests: Object.fromEntries(TESTS.map((T) => [T.id, { label: T.label, markets: T.markets, S: T.S, counts: out[T.id].counts, pHolm: out[T.id].pHolm, bar: out[T.id].bar, ...out[T.id].eval }])),
    perMarket,
    secondaryPassAlone: TESTS.filter((T) => T.id !== 'T1' && out[T.id].bar.pass).map((T) => T.id),
  });
  const dir = new URL('.', import.meta.url).pathname;
  fs.writeFileSync(dir + 'result.json', JSON.stringify(result, null, 1) + '\n');
  const slim = allTrades.map((x) => [x.test, x.market, x.side, x.fillT, r4(x.entry), r4(x.stop), r4(x.target), x.exitT, r4(x.exit), ({ stop: 's', target: 'g', time: 'x' })[x.reason] || x.reason, r4(x.R), r4(x.Rnet), x.boKind === 'BO' ? 'B' : 'C']);
  fs.writeFileSync(dir + 'trades.json', JSON.stringify({ cols: ['test', 'market', 'side', 'entryTime', 'entry', 'stop', 'target', 'exitTime', 'exit', 'reason(s=stop,g=target,x=time)', 'R', 'Rnet', 'boKind(B=BO,C=ChoCh)'], note: 'times unix s UTC (entryTime = fill); prices OANDA mid', rows: slim }) + '\n');
  console.error('done', verdict, ((Date.now() - t0) / 1000).toFixed(0) + 's');
}

if (process.argv[1] && new URL(import.meta.url).pathname === fs.realpathSync(process.argv[1])) main();
