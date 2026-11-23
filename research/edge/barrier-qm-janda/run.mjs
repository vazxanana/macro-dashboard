// Barrier, QM, then the second break: entry at the engulf inside it (pre-registered 23 Nov 2026, PREREGISTRATION.md,
// committed before this file). Pure functions + `node research/edge/barrier-qm-janda/run.mjs` (reads the toolkit's candle
// cache, outside git; writes result.json and trades.json next to this file). Research only: nothing live reads it.
//
// The rule, in the order of PREREGISTRATION.md (closed candles only, swings K = 3), gold only:
//   pairs: D1 (17:00 New York days) -> H1, H4 -> M15, H1 -> M5, M30 -> M5 (barrier -> confirmation).
//   1. Barrier zones on the barrier timeframe B: (a) break-origin zone of every edgekit.structure break (broken level to the
//      extreme of the leg from the broken swing to the break candle; break up = buy zone); (b) engulf zone (`engulfs`).
//      Known at the close of the candle that completes it. Touch = the first CLOSED B candle after that which trades into
//      it; the zone is gone if a B candle closes beyond its far side first, or after 100 B candles.
//   2. Direction (P, S2, S3): the Daily structure side known at the touch candle's close must equal the zone's side.
//   3. Confirmation: the first QM of the zone's side on C whose break closes after the touch candle's close, within 48 C
//      candles of it, with its head inside the zone (S2: inside the zone's near quarter). A C close (or the touch candle's
//      close) beyond the zone's far side before such a QM ends the setup.
//   4. Second break: the first C close beyond the latest swing high (buy) / low (sell) confirmed after the QM break candle,
//      within 48 C candles of it; a C close beyond the QM head first ends it.
//   5. Entry: the latest engulf of the trade's side whose first candle lies at or after the lowest low (buy) / highest high
//      (sell) between the QM break and the second break, completed by the second break candle; limit at its near edge, placed
//      at the second break's close, alive 24 C candles; cancelled by a C close beyond the stop or when the target trades first.
//   6. Stop $0.30 beyond the QM head, at least $1.00 from the entry. Target = the nearest B swing high (buy) / low (sell)
//      confirmed by the second break's close and at least 2R from the entry. Time exit at the close of the 20th B candle
//      after the fill candle. Fills on 5-minute candles (edgekit.simulate). One position (or resting order) at a time per pair.
import fs from 'node:fs';
import * as K from '../_lib/edgekit.mjs';
import { financing } from '../../../council/fills.mjs';

export const P = { K: 3, span: 3, zoneLife: 100, qmWin: 48, secondWin: 48, life: 24, hold: 20, buf: 0.30, minStop: 1.00, minRR: 2 };
export const PAIRS = [['1d', '1h'], ['4h', '15m'], ['1h', '5m'], ['30m', '5m']];
export const WINDOWS = {
  REP: [Date.UTC(2010, 0, 1) / 1000, Date.UTC(2020, 0, 1) / 1000],
  IS: [Date.UTC(2020, 0, 1) / 1000, Date.UTC(2024, 0, 1) / 1000],
  OOS: [Date.UTC(2024, 0, 1) / 1000, null],
};
export const TESTS = [
  { id: 'P', primary: true, dir: true, near: false, side: 0, label: 'primary: four pairs pooled, with the Daily structure' },
  { id: 'S1', dir: false, near: false, side: 0, label: 'P without the direction filter' },
  { id: 'S2', dir: true, near: true, side: 0, label: 'P with the QM head in the zone near quarter' },
  { id: 'S3', dir: true, near: false, side: 1, label: 'P, buys only' },
];

// Engulf: the base is the last candle of the other colour (a doji has none); a candle at most `span` candles after it that
// closes beyond its high (buy) / low (sell) completes it. A newer candle of the base's colour becomes the base; a close
// through the base's other side cancels it. Zone = the base, wick to wick. Each: { side, b (base index), i (completing index) }.
export function engulfs(bars, span = P.span) {
  const out = []; let up = null, dn = null; // up: a bearish base waiting for a close above its high (buy)
  for (let j = 0; j < bars.length; j++) {
    const x = bars[j];
    if (up != null) {
      if (j - up > span || x.c < bars[up].l) up = null;
      else if (x.c > bars[up].h) { out.push({ side: 1, b: up, i: j, lo: bars[up].l, hi: bars[up].h }); up = null; }
    }
    if (dn != null) {
      if (j - dn > span || x.c > bars[dn].h) dn = null;
      else if (x.c < bars[dn].l) { out.push({ side: -1, b: dn, i: j, lo: bars[dn].l, hi: bars[dn].h }); dn = null; }
    }
    if (x.c < x.o) up = j; else if (x.c > x.o) dn = j;
  }
  return out;
}

// Barrier zones of one timeframe: { side, lo, hi, k (known index), kind 'bo'|'eg' }.
export function zones(B) {
  const out = [];
  for (const ev of K.structure(B, P.K).events) {
    let ext = ev.dir > 0 ? Infinity : -Infinity;
    for (let x = ev.from; x <= ev.i; x++) ext = ev.dir > 0 ? Math.min(ext, B[x].l) : Math.max(ext, B[x].h);
    const z = ev.dir > 0 ? { lo: ext, hi: ev.level } : { lo: ev.level, hi: ext };
    if (z.hi > z.lo) out.push({ side: ev.dir, ...z, k: ev.i, kind: 'bo' });
  }
  for (const g of engulfs(B)) if (g.hi > g.lo) out.push({ side: g.side, lo: g.lo, hi: g.hi, k: g.i, kind: 'eg' });
  return out.sort((a, b) => a.k - b.k);
}

// First touch of a zone: index of the B candle, or -1 (gone / never). Ends at the end of the candles handed in.
export function touchOf(B, z) {
  for (let j = z.k + 1; j < B.length && j <= z.k + P.zoneLife; j++) {
    const b = B[j];
    if (z.side > 0 ? b.l <= z.hi : b.h >= z.lo) return j;
    if (z.side > 0 ? b.c < z.lo : b.c > z.hi) return -1;
  }
  return -1;
}

const lowerBound = (arr, v, f) => { let lo = 0, hi = arr.length; while (lo < hi) { const m = (lo + hi) >> 1; if (f(arr[m]) < v) lo = m + 1; else hi = m; } return lo; };

// Setups of one pair. ctx = { B, C, D (daily), Q (qms of C), G (engulfs of C), SwC, SwB } precomputed.
export function setups(B, C, D, opt = {}, pre = null) {
  const dir = opt.dir !== false, near = !!opt.near, onlySide = opt.side || 0;
  const Q = pre?.Q || K.qms(C, P.K), G = pre?.G || engulfs(C);
  const SwC = pre?.SwC || K.swings(C, P.K).sort((a, b) => a.ci - b.ci), SwB = pre?.SwB || K.swings(B, P.K).sort((a, b) => a.ct - b.ct);
  const Dside = pre?.Dside || K.structure(D, P.K).side;
  const Z = pre?.Z || zones(B);
  const Gi = G.map((g) => g.i);
  const counts = { zones: Z.length, touched: 0, dirOff: 0, noQM: 0, qm: 0, noSecond: 0, second: 0, noEngulf: 0, smallStop: 0, noTarget: 0, orders: 0 };
  const out = [];
  for (const z of Z) {
    if (onlySide && z.side !== onlySide) continue;
    const tj = touchOf(B, z);
    if (tj < 0) continue;
    counts.touched++;
    const touchT = B[tj].e, s = z.side;
    if (dir) {
      const dn = K.closedCount(D, touchT);
      if (!(dn > 0 && Dside[dn - 1] === s)) { counts.dirOff++; continue; }
    }
    if (s > 0 ? B[tj].c < z.lo : B[tj].c > z.hi) { counts.noQM++; continue; } // the touch candle closed beyond the far side
    const c0 = K.closedCount(C, touchT);
    // 3. confirmation QM
    let qm = null;
    const qs = lowerBound(Q, c0, (q) => q.i);
    let endFar = Infinity; // first C index after the touch closing beyond the far side
    for (let j = c0; j < C.length && j < c0 + P.qmWin; j++) if (s > 0 ? C[j].c < z.lo : C[j].c > z.hi) { endFar = j; break; }
    for (let x = qs; x < Q.length && Q[x].i < c0 + P.qmWin; x++) {
      const q = Q[x];
      if (q.i > endFar) break;
      if (q.side !== s) continue;
      const inZone = q.head >= z.lo && q.head <= z.hi;
      const inNear = s > 0 ? q.head >= z.hi - 0.25 * (z.hi - z.lo) : q.head <= z.lo + 0.25 * (z.hi - z.lo);
      if (inZone && (!near || inNear)) { qm = q; break; }
    }
    if (!qm) { counts.noQM++; continue; }
    counts.qm++;
    // 4. second break
    let j2 = -1, sw = null, k = lowerBound(SwC, qm.i + 1, (w) => w.ci);
    for (let j = qm.i + 1; j < C.length && j <= qm.i + P.secondWin; j++) {
      while (k < SwC.length && SwC[k].ci < j) { const w = SwC[k++]; if (w.type === (s > 0 ? 'H' : 'L')) sw = w; }
      if (s > 0 ? C[j].c < qm.head : C[j].c > qm.head) break;
      if (sw && (s > 0 ? C[j].c > sw.price : C[j].c < sw.price)) { j2 = j; break; }
    }
    if (j2 < 0) { counts.noSecond++; continue; }
    counts.second++;
    // 5. engulf in the leg
    let ex = qm.i + 1;
    for (let x = qm.i + 1; x <= j2; x++) if (s > 0 ? C[x].l < C[ex].l : C[x].h > C[ex].h) ex = x;
    let g = null;
    for (let x = lowerBound(Gi, j2 + 1, (v) => v) - 1; x >= 0 && G[x].i >= ex; x--) if (G[x].side === s && G[x].b >= ex) { g = G[x]; break; }
    if (!g) { counts.noEngulf++; continue; }
    const t = C[j2].e;
    const entry = s > 0 ? g.hi : g.lo, stop = s > 0 ? qm.head - P.buf : qm.head + P.buf, risk = s * (entry - stop);
    if (!(risk >= P.minStop)) { counts.smallStop++; continue; }
    // 6. target: nearest B swing of the trade's side confirmed by t, at least 2R away
    const need = entry + s * P.minRR * risk;
    let target = null;
    const lim = lowerBound(SwB, t + 1, (w) => w.ct);
    for (let x = 0; x < lim; x++) {
      const w = SwB[x];
      if (w.type !== (s > 0 ? 'H' : 'L')) continue;
      if (s > 0 ? w.price >= need : w.price <= need) if (target == null || (s > 0 ? w.price < target : w.price > target)) target = w.price;
    }
    if (target == null) { counts.noTarget++; continue; }
    // order life: 24 C candles; a C close beyond the stop cancels it
    let expire = j2 + P.life < C.length ? C[j2 + P.life].e : t + P.life * (C[1].t - C[0].t);
    for (let j = j2 + 1; j < C.length && C[j].e <= expire; j++) if (s > 0 ? C[j].c < stop : C[j].c > stop) { expire = C[j].e; break; }
    counts.orders++;
    out.push({ side: s, t, entry, stop, target, expire, kind: z.kind, zlo: z.lo, zhi: z.hi, touchT, qmT: qm.t, head: qm.head, secondT: t, egT: C[g.i].e });
  }
  out.sort((a, b) => a.t - b.t || a.entry - b.entry);
  return { setups: out, counts };
}

function targetFirst(m5, side, target, from, to) {
  for (let i = lowerBound(m5, from, (b) => b.t); i < m5.length && m5[i].t < to; i++) if (side > 0 ? m5[i].h >= target : m5[i].l <= target) return m5[i].t;
  return Infinity;
}

// Trades of one pair from its setups. end = only trades closed by then are booked.
export function trade(U, m5, B, cost, { end = Infinity } = {}) {
  const counts = { blocked: 0, nofill: 0, filled: 0, open: 0 };
  const trades = []; let busy = -Infinity;
  for (const u of U) {
    if (u.t < busy) { counts.blocked++; continue; }
    const expire = Math.min(u.expire, targetFirst(m5, u.side, u.target, u.t, u.expire));
    const base = { side: u.side, entry: u.entry, stop: u.stop, target: u.target, t: u.t, type: 'limit', expire };
    let r = K.simulate(base, m5, { cost });
    if (r.status === 'nofill' || r.status === 'bad') { counts.nofill++; busy = Math.max(busy, expire); continue; }
    let bi = K.barAt(B, r.fillT); if (bi < 0) bi = K.closedCount(B, r.fillT);
    const deadline = bi + P.hold < B.length ? B[bi + P.hold].e : Infinity;
    if (deadline !== Infinity) r = K.simulate({ ...base, maxHold: deadline - r.fillT }, m5, { cost });
    if (r.status === 'open' || deadline === Infinity || r.exitT > end) { counts.open++; busy = Infinity; continue; }
    counts.filled++; busy = r.exitT;
    const fin = u.side > 0 ? financing({ market: 'xau', side: 'buy', entry: r.fill, r0: r.risk, filled: r.fillT, closed: r.exitT }).finR : 0;
    const costR = cost / r.risk + fin;
    trades.push({ side: u.side, t: u.t, fillT: r.fillT, entry: u.entry, fill: r.fill, stop: u.stop, target: u.target, exitT: r.exitT,
      exit: r.exit, reason: r.reason, risk: r.risk, R: r.R, Rnet: r.R - costR, R2: r.R - 2 * costR, finR: fin, kind: u.kind });
  }
  return { trades, counts };
}

// ---- statistics on the pre-registered windows (month sums padded with zero months) ----------------------------------
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
  for (const w of ['REP', 'IS', 'OOS']) res[w] = windowStats(T, W[w]);
  res.OOS_2x = windowStats(T, W.OOS, 'R2');
  for (const w of ['REP', 'IS', 'OOS']) res[w + '_gross'] = windowStats(T, W[w], 'R');
  res.OOS_buys = windowStats(T.filter((x) => x.side > 0), W.OOS); res.OOS_sells = windowStats(T.filter((x) => x.side < 0), W.OOS);
  res.IS_buys = windowStats(T.filter((x) => x.side > 0), W.IS); res.IS_sells = windowStats(T.filter((x) => x.side < 0), W.IS);
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
    holmP05: pHolm != null && pHolm < 0.05 && e.OOS.tMonth > 0,
    isMeanPositive: e.IS.meanR > 0,
    oos2xPositive: e.OOS_2x.meanR > 0,
    oos30: e.OOS.n >= 30,
    repMeanPositive: e.REP.meanR > 0,
    repMonthT1: e.REP.tMonth != null && e.REP.tMonth >= 1,
  };
  return { lines, pass: Object.values(lines).every(Boolean) };
}
export function verdictOf(tests) {
  const p = tests.P, e = p.eval;
  if (p.bar.pass) return 'PASS';
  if (e.OOS.n < 30) return 'INCONCLUSIVE';
  if (e.IS.meanR > 0 && e.OOS.meanR > 0 && e.OOS.tMonth >= 1 && e.OOS_2x.meanR > 0 && e.REP.meanR > 0 && e.REP.tMonth >= 1) return 'INCONCLUSIVE';
  if (Object.keys(tests).some((k) => k !== 'P' && tests[k].bar.pass)) return 'INCONCLUSIVE';
  return 'FAIL';
}

const r4 = (x) => (x == null || !Number.isFinite(x) ? x : Math.round(x * 1e4) / 1e4);
const round = (o) => JSON.parse(JSON.stringify(o, (k, v) => (typeof v === 'number' ? r4(v) : v)));

async function main() {
  const t0 = Date.now();
  const m5 = K.load('xau', '5m', { from: '2010-01-01' });
  const end = Math.floor(m5[m5.length - 1].t / 86400) * 86400;
  const W = { ...WINDOWS, OOS: [WINDOWS.OOS[0], end] };
  const D = K.dailyNY(m5);
  const Dside = K.structure(D, P.K).side;
  const TF = { '1d': D };
  for (const tf of ['4h', '1h', '30m', '15m', '5m']) TF[tf] = tf === '5m' ? m5 : K.resample(m5, K.TF[tf]);
  let gap = 0; for (let i = 1; i < m5.length; i++) gap = Math.max(gap, (m5[i].t - m5[i - 1].t) / 86400);
  const pre = {};
  for (const [b, c] of PAIRS) {
    const B = TF[b], C = TF[c];
    pre[b + '>' + c] = { Q: K.qms(C, P.K), G: engulfs(C), SwC: K.swings(C, P.K).sort((x, y) => x.ci - y.ci), SwB: K.swings(B, P.K).sort((x, y) => x.ct - y.ct), Dside, Z: zones(B) };
    console.error('pre', b, c, ((Date.now() - t0) / 1000).toFixed(0) + 's');
  }
  const out = {}; const all = []; const perPair = {};
  for (const T of TESTS) {
    let tr = []; const counts = {};
    for (const [b, c] of PAIRS) {
      const key = b + '>' + c;
      const S = setups(TF[b], TF[c], D, T, pre[key]);
      const r = trade(S.setups, m5, TF[b], K.COSTS.xau, { end });
      for (const x of r.trades) x.pair = key;
      counts[key] = { ...S.counts, ...r.counts }; tr = tr.concat(r.trades);
      perPair[T.id + ':' + key] = evaluate(r.trades, W);
      console.error(T.id, key, counts[key], ((Date.now() - t0) / 1000).toFixed(0) + 's');
    }
    out[T.id] = { ...T, counts, eval: evaluate(tr, W) };
    for (const x of tr) all.push({ test: T.id, ...x });
  }
  const ph = K.holm(TESTS.map((T) => out[T.id].eval.OOS.pMonth ?? 1));
  TESTS.forEach((T, i) => { out[T.id].pHolm = ph[i]; out[T.id].bar = bar(out[T.id].eval, ph[i]); });
  const verdict = verdictOf(out);
  const result = round({
    study: 'barrier-qm-janda', built: new Date().toISOString().slice(0, 10), verdict, primary: 'P', market: 'xau',
    windows: { REP: '2010-01-01 to 2019-12-31', IS: '2020-01-01 to 2023-12-31', OOS: '2024-01-01 to ' + new Date(end * 1000).toISOString().slice(0, 10) + ' (exclusive)' },
    cost: { roundTrip: K.COSTS.xau, financing: 'council/fills.mjs financing on buys', monthKey: 'fill time' },
    params: { ...P, pairs: PAIRS.map((p) => p.join('>')) }, maxDataGapDays: gap,
    reading: 'The touch is known at the close of the touching barrier candle; the confirming QM must break after that close. Of several QMs the first whose head lies in the zone is taken.',
    tests: Object.fromEntries(TESTS.map((T) => [T.id, { label: T.label, counts: out[T.id].counts, pHolm: out[T.id].pHolm, bar: out[T.id].bar, ...out[T.id].eval }])),
    perPair,
  });
  const dir = new URL('.', import.meta.url).pathname;
  fs.writeFileSync(dir + 'result.json', JSON.stringify(result, null, 1) + '\n');
  const rows = all.map((x) => [x.test, x.pair, x.side, x.fillT, r4(x.entry), r4(x.stop), r4(x.target), x.exitT, r4(x.exit), ({ stop: 's', target: 'g', time: 'x' })[x.reason] || x.reason, r4(x.R), r4(x.Rnet), x.kind]);
  fs.writeFileSync(dir + 'trades.json', JSON.stringify({ market: 'xau', cols: ['test', 'pair', 'side', 'entryTime', 'entry', 'stop', 'target', 'exitTime', 'exit', 'reason(s=stop,g=target,x=time)', 'R', 'Rnet', 'barrierKind(bo|eg)'], note: 'times unix s UTC (entryTime = fill); prices OANDA mid; Rnet after $0.30 and buy financing', rows }) + '\n');
  console.error('done', verdict, ((Date.now() - t0) / 1000).toFixed(0) + 's');
}

if (process.argv[1] && new URL(import.meta.url).pathname === fs.realpathSync(process.argv[1])) main();
