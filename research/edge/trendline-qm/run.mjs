// Trendline break, retest and M15 QM on gold (pre-registered 23 Nov 2026, PREREGISTRATION.md, committed before this file).
// Pure functions + `node research/edge/trendline-qm/run.mjs` (reads the toolkit's candle cache, outside git; writes
// result.json and trades.json next to this file). Research only: nothing live reads it, nothing is placed.
//
// The rule, in the order of PREREGISTRATION.md (closed candles only; H1 / M15 / H4 grouped from OANDA mid 5-minute gold):
//   Falling line (buys): the last two confirmed H1 swing highs A then B (edgekit.swings, 3 a side), B lower than A,
//     6..240 H1 candles apart; the straight line through their highs, by H1 candle index. Drawn at B's confirmation candle
//     only if no H1 close from B+1 to that candle is above it; replaced when a newer swing high is confirmed; dead once
//     the candle is more than 240 H1 candles after B. Rising line (sells): the mirror on swing lows.
//   Break: the first H1 close beyond the line (one setup per line; the broken line is spent).
//   Retest: the first M15 candle starting at or after the break candle's close whose low reaches line + 0.25 x ATR14(H1 at
//     the break) (high reaches line - 0.25 ATR for sells), the line read at the H1 candle that holds the M15 candle, within
//     24 H1 candles of the break. Cancelled from the close of the first H1 candle after the break that closes more than
//     1 ATR on the wrong side of the line.
//   Confirmation: the first edgekit.qms(M15, 3) QM of the trade's side whose break candle closes at or after the retest
//     candle's close and at most 16 M15 candles after it.
//   Entry: market at the open of the next candle (the first 5-minute open at or after the QM close). Stop: the retest
//     extreme (lowest low / highest high of M15 candles retest..QM break) beyond by $0.30; skipped if under $1.00 away.
//   Target: the most recent H1 swing high above the entry (low below, sells) confirmed by the entry; skipped when none or
//     under 1R. Time exit at the close of the 48th H1 candle after the one holding the fill. Stop first (edgekit.simulate).
//   One position at a time (buys and sells together), streams run separately for T1, S1, S2.
//   S1: T1 setups only when the H4 structure side (edgekit.structure, 3 a side) known at entry is the trade's side.
//   S2: T1 setups with a fixed 2R target (the swing-target skip does not apply; the rest of the rule unchanged).
// ATR14 = the simple mean of the last 14 H1 true ranges up to and including the break candle (the pre-registration names
// ATR(14) without a smoothing; this is the plain reading).
import fs from 'node:fs';
import * as K from '../_lib/edgekit.mjs';

export const P = { K: 3, minGap: 6, maxGap: 240, life: 240, retestTol: 0.25, retestH1: 24, cancelAtr: 1, qmM15: 16,
  pad: 0.30, minStop: 1.00, minRR: 1, holdH1: 48, atrN: 14, s2RR: 2 };
export const WINDOWS = {
  REP: [Date.UTC(2010, 0, 1) / 1000, Date.UTC(2020, 0, 1) / 1000],
  IS: [Date.UTC(2020, 0, 1) / 1000, Date.UTC(2024, 0, 1) / 1000],
  OOS: [Date.UTC(2024, 0, 1) / 1000, null],
};

function atrAt(H, j, n = P.atrN) {
  let s = 0, k = 0;
  for (let x = j; x > 0 && k < n; x--, k++) s += Math.max(H[x].h - H[x].l, Math.abs(H[x].h - H[x - 1].c), Math.abs(H[x].l - H[x - 1].c));
  return k ? s / k : null;
}

// Lines and their breaks on H1. Every break depends only on H1 candles 0..j.
export function breaks(H) {
  const sw = K.swings(H, P.K).sort((a, b) => a.ci - b.ci || a.i - b.i);
  const out = []; const lastH = [], lastL = []; let k = 0;
  const line = { 1: null, '-1': null }; // side +1 = falling line through highs (buys)
  const val = (L, j) => L.A.price + ((L.B.price - L.A.price) * (j - L.A.i)) / (L.B.i - L.A.i);
  for (let j = 0; j < H.length; j++) {
    // 1. the close of j against the lines drawn before it
    for (const s of [1, -1]) {
      const L = line[s]; if (!L) continue;
      if (j - L.B.i > P.life) { line[s] = null; continue; }
      if (j <= L.drawnI) continue;
      const v = val(L, j);
      if (s > 0 ? H[j].c > v : H[j].c < v) {
        out.push({ side: s, i: j, t: H[j].e, A: { i: L.A.i, price: L.A.price }, B: { i: L.B.i, price: L.B.price }, value: v, atr: atrAt(H, j) });
        line[s] = null; // spent
      }
    }
    // 2. swings confirmed at the close of j draw / replace lines
    while (k < sw.length && sw[k].ci <= j) {
      const x = sw[k++];
      const arr = x.type === 'H' ? lastH : lastL, s = x.type === 'H' ? 1 : -1;
      arr.push(x);
      line[s] = null; // replaced by the newest two swings (or none if they do not qualify)
      if (arr.length < 2) continue;
      const A = arr[arr.length - 2], B = x, gap = B.i - A.i;
      if (gap < P.minGap || gap > P.maxGap) continue;
      if (s > 0 ? !(B.price < A.price) : !(B.price > A.price)) continue;
      const L = { A, B, drawnI: j };
      let ok = true;
      for (let y = B.i + 1; y <= j; y++) { const v = val(L, y); if (s > 0 ? H[y].c > v : H[y].c < v) { ok = false; break; } }
      if (ok) line[s] = L;
    }
  }
  return { breaks: out, swings: sw, val };
}

// Setups (orders) from the breaks. Every field depends only on candles closed by `t` (the QM close) and the 5-minute
// candle starting at `t` (the fill).
export function setups(m5, { h4Side = true } = {}) {
  const H = K.resample(m5, 3600), M = K.resample(m5, 900), H4 = h4Side ? K.resample(m5, 14400) : null;
  const { breaks: BR, swings: SW } = breaks(H);
  const Q = K.qms(M, P.K);
  const side4 = H4 ? K.structure(H4, P.K).side : null;
  const hIdx = new Map(H.map((b, i) => [b.t, i]));
  const counts = { breaks: BR.length, cancelled: 0, noRetest: 0, noQM: 0, skipStop: 0, skipTarget: 0, setups: 0 };
  const val = (b, j) => b.A.price + ((b.B.price - b.A.price) * (j - b.A.i)) / (b.B.i - b.A.i);
  const out = [];
  for (const b of BR) {
    const s = b.side, atr = b.atr;
    if (!(atr > 0)) { counts.noRetest++; continue; }
    // cancel time: close of the first H1 candle after the break > 1 ATR on the wrong side of the line
    let cancelT = Infinity;
    for (let x = b.i + 1; x < H.length && x <= b.i + P.retestH1 + 64; x++) {
      const v = val(b, x);
      if (s > 0 ? H[x].c < v - P.cancelAtr * atr : H[x].c > v + P.cancelAtr * atr) { cancelT = H[x].e; break; }
    }
    // retest
    let lo = 0, hi = M.length; while (lo < hi) { const m = (lo + hi) >> 1; if (M[m].t < b.t) lo = m + 1; else hi = m; }
    let r = -1, cancelledBefore = false;
    for (let x = lo; x < M.length; x++) {
      if (M[x].t >= cancelT) { cancelledBefore = true; break; }
      const h = hIdx.get(Math.floor(M[x].t / 3600) * 3600); if (h == null) continue;
      if (h > b.i + P.retestH1) break;
      const v = val(b, h);
      if (s > 0 ? M[x].l <= v + P.retestTol * atr : M[x].h >= v - P.retestTol * atr) { r = x; break; }
    }
    if (r < 0) { if (cancelledBefore) counts.cancelled++; else counts.noRetest++; continue; }
    // confirmation
    let q = null;
    { let a = 0, c = Q.length; while (a < c) { const m = (a + c) >> 1; if (Q[m].i < r) a = m + 1; else c = m; }
      for (let x = a; x < Q.length; x++) { const z = Q[x]; if (z.i - r > P.qmM15) break; if (z.side === s) { q = z; break; } } }
    if (!q) { counts.noQM++; continue; }
    if (q.t >= cancelT) { counts.cancelled++; continue; }
    // entry, stop
    let f0 = 0, f1 = m5.length; while (f0 < f1) { const m = (f0 + f1) >> 1; if (m5[m].t < q.t) f0 = m + 1; else f1 = m; }
    if (f0 >= m5.length) { counts.noQM++; continue; }
    const fill = m5[f0].o;
    let ext = s > 0 ? Infinity : -Infinity;
    for (let x = r; x <= q.i; x++) ext = s > 0 ? Math.min(ext, M[x].l) : Math.max(ext, M[x].h);
    const stop = s > 0 ? ext - P.pad : ext + P.pad, risk = s * (fill - stop);
    if (!(risk >= P.minStop)) { counts.skipStop++; continue; }
    // target: the most recent confirmed H1 swing beyond the entry, known at the entry
    let tgt = null;
    let wEnd = 0; { let c = SW.length; while (wEnd < c) { const m = (wEnd + c) >> 1; if (SW[m].ct <= q.t) wEnd = m + 1; else c = m; } }
    for (let x = wEnd - 1; x >= 0 && !tgt; x--) { const w = SW[x]; if (w.type === (s > 0 ? 'H' : 'L') && s * (w.price - fill) > 0) tgt = w; }
    const swingOK = tgt && s * (tgt.price - fill) >= P.minRR * risk;
    const hFill = hIdx.get(Math.floor(m5[f0].t / 3600) * 3600);
    const dl = hFill + P.holdH1 < H.length ? H[hFill + P.holdH1].e : H[hFill].e + P.holdH1 * 3600;
    const h4 = side4 ? side4[K.closedCount(H4, q.t) - 1] ?? 0 : null;
    counts.setups++;
    if (!swingOK) counts.skipTarget++;
    out.push({ side: s, t: q.t, fill, stop, risk, target: swingOK ? tgt.price : null, maxHold: dl - m5[f0].t, breakT: b.t, retestT: M[r].e,
      lineA: b.A.price, lineB: b.B.price, atr, h4 });
  }
  out.sort((a, b) => a.t - b.t);
  return { setups: out, counts };
}

// One stream: the setups chosen, one position at a time. variant 'T1' | 'S1' | 'S2'. `end` = book only trades closed by then.
export function stream(m5, U, variant, cost, { end = Infinity } = {}) {
  const trades = []; let busy = -Infinity; const c = { blocked: 0, filtered: 0, open: 0, bad: 0 };
  for (const u of U) {
    let target = u.target;
    if (variant === 'S2') target = u.fill + u.side * P.s2RR * u.risk;
    else if (target == null) continue;
    if (variant === 'S1' && u.h4 !== u.side) { c.filtered++; continue; }
    if (u.t < busy) { c.blocked++; continue; }
    const r = K.simulate({ side: u.side, entry: u.fill, stop: u.stop, target, t: u.t, type: 'market', maxHold: u.maxHold }, m5, { cost });
    if (r.status === 'bad' || r.status === 'nofill') { c.bad++; continue; }
    if (r.status === 'open' || r.exitT > end) { c.open++; busy = Infinity; continue; }
    busy = r.exitT;
    trades.push({ market: 'xau', side: u.side, t: u.t, fillT: r.fillT, entry: r.fill, stop: u.stop, target, exitT: r.exitT, exit: r.exit,
      reason: r.reason, risk: r.risk, R: r.R, Rnet: r.Rnet, R2: r.R - (2 * cost) / r.risk, h4: u.h4 });
  }
  return { trades, counts: c };
}

// ---- statistics on the pre-registered windows (month sums padded with zero months over the whole window) -------------
const ym = (t) => { const d = new Date(t * 1000); return d.getUTCFullYear() * 12 + d.getUTCMonth(); };
export function windowStats(trades, [a, b], key = 'Rnet') {
  const xs = trades.filter((x) => x.fillT >= a && x.fillT < b);
  const n = xs.length, vals = xs.map((x) => x[key]);
  const mean = n ? vals.reduce((p, q) => p + q, 0) / n : null;
  const m0 = ym(a), m1 = ym(b - 1), sums = new Array(m1 - m0 + 1).fill(0);
  for (const x of xs) sums[ym(x.fillT) - m0] += x[key];
  const Mn = sums.length, mm = sums.reduce((p, q) => p + q, 0) / Mn;
  const sd = Mn > 1 ? Math.sqrt(sums.reduce((p, q) => p + (q - mm) ** 2, 0) / (Mn - 1)) : 0;
  const tMonth = sd > 0 && n ? mm / (sd / Math.sqrt(Mn)) : null;
  let cum = 0, peak = 0, dd = 0; for (const v of [...xs].sort((p, q) => p.exitT - q.exitT).map((x) => x[key])) { cum += v; peak = Math.max(peak, cum); dd = Math.min(dd, cum - peak); }
  return { n, wins: xs.filter((x) => x.R > 1e-9).length, meanR: mean, total: vals.reduce((p, q) => p + q, 0), months: Mn, tMonth,
    pMonth: tMonth == null ? null : K.pFromT(tMonth, Mn - 1), maxDD: dd };
}
export function evaluate(T, W) {
  const res = {};
  for (const w of ['REP', 'IS', 'OOS']) res[w] = windowStats(T, W[w]);
  res.OOS_2x = windowStats(T, W.OOS, 'R2'); res.IS_2x = windowStats(T, W.IS, 'R2');
  res.OOS_gross = windowStats(T, W.OOS, 'R'); res.IS_gross = windowStats(T, W.IS, 'R'); res.REP_gross = windowStats(T, W.REP, 'R');
  const bySide = {};
  for (const s of [1, -1]) { const xs = T.filter((x) => x.side === s); bySide[s > 0 ? 'buy' : 'sell'] = { REP: windowStats(xs, W.REP), IS: windowStats(xs, W.IS), OOS: windowStats(xs, W.OOS) }; }
  res.bySide = bySide;
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
    oos2xPositive: e.OOS_2x.meanR > 0,
    oos30: e.OOS.n >= 30,
  };
  return { lines, pass: Object.values(lines).every(Boolean) };
}
const r4 = (x) => (x == null || !Number.isFinite(x) ? x : Math.round(x * 1e4) / 1e4);
const round = (o) => JSON.parse(JSON.stringify(o, (k, v) => (typeof v === 'number' ? r4(v) : v)));

async function main() {
  const t0 = Date.now();
  const idx = JSON.parse(fs.readFileSync(K.DATA_DIR + '/INDEX.json', 'utf8'));
  const m5 = K.load('xau', '5m', { from: '2010-01-01' });
  const end = Math.floor(m5[m5.length - 1].t / 86400) * 86400; // start of the last (partial) UTC day
  const W = { ...WINDOWS, OOS: [WINDOWS.OOS[0], end] };
  const { setups: U, counts } = setups(m5);
  console.error('setups', counts, ((Date.now() - t0) / 1000).toFixed(0) + 's');
  const ids = ['T1', 'S1', 'S2']; const out = {}; const all = [];
  for (const id of ids) {
    const r = stream(m5, U, id, K.COSTS.xau, { end });
    out[id] = { counts: r.counts, ...evaluate(r.trades, W) };
    for (const x of r.trades) all.push({ test: id, ...x });
  }
  const ph = K.holm(ids.map((id) => (out[id].OOS.tMonth > 0 ? out[id].OOS.pMonth : 1) ?? 1));
  ids.forEach((id, i) => { out[id].pHolm = ph[i]; out[id].bar = bar(out[id], ph[i]); });
  const t1 = out.T1;
  let verdict;
  if (t1.OOS.n < 30) verdict = 'INCONCLUSIVE';
  else if (t1.bar.pass && t1.REP.meanR > 0) verdict = 'PASS';
  else if (t1.bar.pass || out.S1.bar.pass || out.S2.bar.pass) verdict = 'INCONCLUSIVE';
  else verdict = 'FAIL';
  const result = round({
    study: 'trendline-qm', built: new Date().toISOString().slice(0, 10), verdict, primary: 'T1', market: 'xau',
    windows: { REP: '2010-01-01 to 2019-12-31', IS: '2020-01-01 to 2023-12-31', OOS: '2024-01-01 to ' + new Date(end * 1000).toISOString().slice(0, 10) + ' (exclusive)' },
    cost: K.COSTS.xau, params: P, atrNote: 'ATR14 = simple mean of the last 14 H1 true ranges at the break', monthKey: 'fill time',
    dataSource: idx.source, setupCounts: counts,
    tests: Object.fromEntries(ids.map((id) => [id, out[id]])),
    holmOver: ids, holmNote: 'two-sided p of the out-of-sample month t; a test whose t is not positive counts as p = 1',
  });
  const dir = new URL('.', import.meta.url).pathname;
  fs.writeFileSync(dir + 'result.json', JSON.stringify(result, null, 1) + '\n');
  const rows = all.map((x) => [x.test, x.market, x.side, x.fillT, r4(x.entry), r4(x.stop), r4(x.target), x.exitT, r4(x.exit),
    ({ stop: 's', target: 'g', time: 'x' })[x.reason] || x.reason, r4(x.R), r4(x.Rnet), x.h4]);
  fs.writeFileSync(dir + 'trades.json', JSON.stringify({ cols: ['test', 'market', 'side', 'entryTime', 'entry', 'stop', 'target', 'exitTime', 'exit',
    'reason(s=stop,g=target,x=time)', 'R', 'Rnet', 'h4Side'], note: 'times unix s UTC (entryTime = fill); prices OANDA mid; Rnet after $0.30 a round trip', rows }) + '\n');
  console.error('done', verdict, ((Date.now() - t0) / 1000).toFixed(0) + 's');
}

if (process.argv[1] && new URL(import.meta.url).pathname === fs.realpathSync(process.argv[1])) main();
