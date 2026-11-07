// Edge research (portfolio): portfolio rules across the council and ICT trade streams. Paper research only; nothing
// here changes the live trader or tracker. It reads trade lists other tools already produced and studies:
//   1. correlation of daily R between systems and markets, and USD clustering (same-dollar trades open together)
//   2. exposure caps: trades per market, same-dollar cap (maxUsd), Scalp re-entry wait; ICT: per-market and
//      same-direction index cap. Chosen on the in-sample part only, reported out-of-sample.
//   3. sizing: fixed 1R vs volatility-scaled vs fractional Kelly (capped) vs the ICT desk's own sizeOf
//   4. Monte Carlo: 10,000 day-block bootstraps (and an i.i.d. trade bootstrap for contrast) of the final portfolio:
//      max drawdown distribution, P(drawdown >= 20R), time to recover.
// Usage: node research/edge/portfolio/portfolio.mjs <council 150d json with a closed column> <ict-stream.mjs outputs, comma-separated>
//          <ict/replay.json> <backtest.json (30 d)> <out dir>
// Inputs (all from origin/council-data except the second, which ict-stream.mjs builds from HistData M1):
//   research/backtest-150d-m30.json  council engine replay 2026-06..11, 40 columns incl. closed
//   ict-hist.json                    ICT iFVG on HistData NQ/ES/GC proxies 2018-2026 (ict-filters driver, unchanged)
//   ict/replay.json                  ICT desk CNBC replay Aug 2025-Nov 2026 (NQ ES YM RTY GC)
//   backtest.json                    council 30-day replay with OANDA D1 labels (no close times: correlation only)
import fs from 'node:fs';
import path from 'node:path';

const [C150, ICTH, ICTR, BT30, OUT = '.'] = process.argv.slice(2);
const rd = (f) => JSON.parse(fs.readFileSync(f, 'utf8'));
const DAY = 86400, dayOf = (t) => Math.floor(t / DAY);
const sum = (a) => a.reduce((x, y) => x + y, 0), mean = (a) => (a.length ? sum(a) / a.length : 0);
const sd = (a) => { const m = mean(a); return Math.sqrt(sum(a.map((x) => (x - m) ** 2)) / Math.max(1, a.length - 1)); };
const r2 = (x, d = 3) => (x == null || !isFinite(x) ? null : +x.toFixed(d));
const pct = (a, p) => { const s = [...a].sort((x, y) => x - y); return s[Math.min(s.length - 1, Math.floor(p * s.length))]; };
function stats(rs) {
  const n = rs.length; if (!n) return { n: 0, wr: null, exp: null, R: 0, maxDD: 0, t: null };
  let eq = 0, pk = 0, dd = 0, st = 0, ws = 0; for (const x of rs) { eq += x; pk = Math.max(pk, eq); dd = Math.max(dd, pk - eq); st = x < 0 ? st + 1 : 0; ws = Math.max(ws, st); }
  const m = mean(rs), s = sd(rs);
  return { n, wr: r2(rs.filter((x) => x > 0).length / n), exp: r2(m), R: r2(sum(rs), 1), maxDD: r2(dd, 1), streak: ws, t: r2(s ? (m / s) * Math.sqrt(n) : 0, 2) };
}
// daily view of a trade list: R booked on the close day (UTC), every calendar day of the window counted (0 when flat)
function daily(trades, d0, d1, key = 'w') {
  const m = new Map(); for (const t of trades) { const d = dayOf(t.close); m.set(d, (m.get(d) || 0) + t.R * (t[key] ?? 1)); }
  const out = []; for (let d = d0; d <= d1; d++) out.push(m.get(d) || 0); return out;
}
function dstats(dly) {   // daily Sharpe (annualised on 365 calendar days), max DD, R/DD
  let eq = 0, pk = 0, dd = 0, uw = 0, uwMax = 0; for (const x of dly) { eq += x; if (eq >= pk) { pk = eq; uw = 0; } else uw++; uwMax = Math.max(uwMax, uw); dd = Math.max(dd, pk - eq); }
  const s = sd(dly); return { days: dly.length, R: r2(eq, 1), sharpe: r2(s ? (mean(dly) / s) * Math.sqrt(365) : 0, 2), maxDD: r2(dd, 1), rdd: r2(dd ? eq / dd : null, 2), longestUnderwaterDays: uwMax };
}
const pearson = (a, b) => { const ma = mean(a), mb = mean(b); let n = 0, x = 0, y = 0; for (let i = 0; i < a.length; i++) { n += (a[i] - ma) * (b[i] - mb); x += (a[i] - ma) ** 2; y += (b[i] - mb) ** 2; } return x && y ? n / Math.sqrt(x * y) : null; };

// ---------- load the streams ----------
const LABEL = { xau: 'XAU/USD', eurusd: 'EUR/USD', gbpusd: 'GBP/USD', audusd: 'AUD/USD', usdcad: 'USD/CAD', usdchf: 'USD/CHF' };
// the trader's usdDir: +1 = long the dollar, -1 = short the dollar, 0 = crypto / indices
const usdDir = (mk, side) => { const L = LABEL[mk]; if (!L) return 0; const [a, b] = L.split('/'), buy = side === 'buy' ? 1 : -1; return b === 'USD' ? -buy : a === 'USD' ? buy : 0; };

const cj = rd(C150), CI = Object.fromEntries(cj.tradeCols.map((c, i) => [c, i]));
// live council sleeve (trader.mjs userRules 7 Nov): Scalp against D1, not in Asia, skips AUD/USD; gold M30->M1 against D1
const STREAMS = {
  scalpA: (x) => x[CI.setup] === 'scalp' && x[CI.d1] === 'against' && x[CI.session] !== 'asia' && x[0] !== 'audusd',
  goldM30: (x) => x[CI.setup] === 'm30m1' && x[0] === 'xau' && x[CI.d1] === 'against',
};
const council = [];   // every signal incl. resting orders that never filled (they hold a slot while pending, R 0)
for (const x of cj.trades) for (const [s, f] of Object.entries(STREAMS)) if (f(x) && x[CI.closed]) {
  const filled = x[CI.fill] === 1;
  council.push({ sys: 'council', stream: s, market: x[0], side: x[2], open: x[CI.opened], fillT: x[CI.filled], close: x[CI.closed], filled,
    Rg: filled ? x[CI.R_none] : 0, R: filled ? x[CI.R_none] - x[CI.cost] : 0, rr: x[CI.rr], usd: usdDir(x[0], x[2]) });
}
council.sort((a, b) => a.open - b.open);
const cFilled = council.filter((t) => t.filled);
const cT0 = Math.min(...council.map((t) => t.open)), cT1 = Math.max(...council.map((t) => t.close));
const cSplit = cT0 + (2 / 3) * (cT1 - cT0);   // first 2/3 in-sample, last 1/3 out-of-sample (by signal time)

// ICT long stream (HistData proxies, 2018-2026): per-unit R net of 2 ticks (the ict-filters cost model)
const ICOST = { nq: 0.5, es: 0.5, ym: 2, rty: 0.2, gc: 0.2 };
const ih = ICTH.split(',').flatMap((f) => rd(f).trades).filter((t) => t.aset && t.closed).map((t) => ({ sys: 'ict', stream: 'ictA', market: t.market, side: t.side, open: t.signalAt, close: t.closed, filled: true,
  Rg: t.R, R: t.R - ICOST[t.market] / t.r0, size: t.size, year: new Date(t.signalAt * 1000).getUTCFullYear(), usd: t.market === 'gc' ? (t.side === 'buy' ? -1 : 1) : 0 })).sort((a, b) => a.open - b.open);
// ICT desk replay (CNBC, Aug 2025-Nov 2026): A-setups, per-unit R (Rraw when sized) net of 1 tick + spread
const ir = rd(ICTR).trades.filter((t) => t.aset && t.closed && t.status !== 'open' && t.valid !== false).map((t) => { const R = t.Rraw ?? t.R;
  return { sys: 'ict', stream: 'ictCnbc', market: t.market, side: t.side, open: t.signalAt, close: t.closed, filled: true, Rg: R, R: R - ICOST[t.market] / t.r0, size: t.size }; });

// ---------- 1. correlation ----------
const corr = {};
{
  // window where council 150d, ICT HistData and ICT CNBC all exist
  const w0 = dayOf(Math.max(cT0, Math.min(...ir.map((t) => t.open)))), w1 = dayOf(Math.min(cT1, Math.max(...ih.map((t) => t.close)), Math.max(...ir.map((t) => t.close))));
  const series = {};
  for (const mk of [...new Set(cFilled.filter((t) => t.stream === 'scalpA').map((t) => t.market))].sort()) series[`scalpA:${mk}`] = daily(cFilled.filter((t) => t.stream === 'scalpA' && t.market === mk), w0, w1);
  series['goldM30:xau'] = daily(cFilled.filter((t) => t.stream === 'goldM30'), w0, w1);
  for (const mk of ['nq', 'es', 'gc']) series[`ictHist:${mk}`] = daily(ih.filter((t) => t.market === mk), w0, w1);
  for (const mk of ['nq', 'es', 'ym', 'rty', 'gc']) series[`ictCnbc:${mk}`] = daily(ir.filter((t) => t.market === mk), w0, w1);
  const keys = Object.keys(series), M = {};
  for (const a of keys) { M[a] = {}; for (const b of keys) M[a][b] = r2(pearson(series[a], series[b]), 2); }
  // system level
  const sys = { councilScalpA: daily(cFilled.filter((t) => t.stream === 'scalpA'), w0, w1), councilGoldM30: series['goldM30:xau'],
    councilFX: daily(cFilled.filter((t) => t.stream === 'scalpA' && LABEL[t.market] && t.market !== 'xau'), w0, w1),
    councilCrypto: daily(cFilled.filter((t) => t.stream === 'scalpA' && !LABEL[t.market]), w0, w1), councilGoldScalp: series['scalpA:xau'],
    ictIndex: daily(ir.filter((t) => t.market !== 'gc'), w0, w1), ictGold: series['ictCnbc:gc'] };
  const SM = {}; for (const a of Object.keys(sys)) { SM[a] = {}; for (const b of Object.keys(sys)) SM[a][b] = r2(pearson(sys[a], sys[b]), 2); }
  // long-run ICT market correlation 2018-2026 (HistData)
  const l0 = dayOf(ih[0].open), l1 = dayOf(Math.max(...ih.map((t) => t.close)));
  const L = Object.fromEntries(['nq', 'es', 'gc'].map((mk) => [mk, daily(ih.filter((t) => t.market === mk), l0, l1)]));
  const LM = {}; for (const a of Object.keys(L)) { LM[a] = {}; for (const b of Object.keys(L)) LM[a][b] = r2(pearson(L[a], L[b]), 2); }
  // 30-day council replay (OANDA D1 labels), by open day: no close column there
  const bt = rd(BT30), BI = Object.fromEntries(bt.tradeCols.map((c, i) => [c, i]));
  const b30 = bt.trades.filter((x) => x[1] === 'scalp' && x[BI.d1] === 'against' && x[BI.session] !== 'asia' && x[BI.fill] === 1);
  const bd0 = dayOf(Math.min(...b30.map((x) => x[3]))), bd1 = dayOf(Math.max(...b30.map((x) => x[3])));
  const B = {}; for (const x of b30) { const k = x[0]; (B[k] ||= new Array(bd1 - bd0 + 1).fill(0))[dayOf(x[3]) - bd0] += x[BI.R_none] - x[BI.cost]; }
  const BM = {}; for (const a of Object.keys(B).sort()) { BM[a] = {}; for (const b of Object.keys(B).sort()) BM[a][b] = r2(pearson(B[a], B[b]), 2); }
  const offDiag = (MM, ks) => { const v = []; for (let i = 0; i < ks.length; i++) for (let j = i + 1; j < ks.length; j++) if (MM[ks[i]][ks[j]] != null) v.push(MM[ks[i]][ks[j]]); return r2(mean(v), 2); };
  const fx = ['eurusd', 'gbpusd', 'usdcad', 'usdchf', 'xau'];
  corr.window = [new Date(w0 * DAY * 1000).toISOString().slice(0, 10), new Date(w1 * DAY * 1000).toISOString().slice(0, 10)];
  corr.markets = M; corr.systems = SM; corr.ictLongRun = LM; corr.council30dOanda = BM;
  corr.avgPairwise = { councilFxGold150d: offDiag(M, fx.map((m) => `scalpA:${m}`)), councilCrypto150d: offDiag(M, ['btc', 'eth', 'sol', 'xrp'].map((m) => `scalpA:${m}`)),
    council30dAll: offDiag(BM, Object.keys(BM)), ictIndexCnbc: offDiag(M, ['nq', 'es', 'ym', 'rty'].map((m) => `ictCnbc:${m}`)) };
}

// ---------- USD clustering: trades on different dollar markets open at the same time ----------
const usdCluster = {};
{
  const U = cFilled.filter((t) => t.usd);
  const same = [], opp = [];
  for (let i = 0; i < U.length; i++) for (let j = i + 1; j < U.length; j++) {
    const a = U[i], b = U[j]; if (b.fillT >= a.close) continue; if (a.market === b.market) continue;
    if (Math.max(a.fillT, b.fillT) < Math.min(a.close, b.close)) (a.usd === b.usd ? same : opp).push([a.R, b.R]);
  }
  const desc = (P) => ({ pairs: P.length, corrR: r2(pearson(P.map((p) => p[0]), P.map((p) => p[1])), 2), bothLose: r2(P.filter((p) => p[0] < 0 && p[1] < 0).length / Math.max(1, P.length), 2),
    pLoseGivenOtherLoses: r2(P.filter((p) => p[0] < 0 && p[1] < 0).length / Math.max(1, P.filter((p) => p[0] < 0).length), 2) });
  const base = U.filter((t) => t.R < 0).length / U.length;
  // how many same-dollar trades are open together (max over each trade's life, uncapped signals)
  const depth = {}; for (const t of U) { const k = U.filter((x) => x.usd === t.usd && x.fillT <= t.fillT && x.close > t.fillT).length; depth[Math.min(k, 6)] = (depth[Math.min(k, 6)] || 0) + 1; }
  // ICT long stream: same-direction index trades open together (the index analogue of the dollar cluster)
  const I = ih.filter((t) => t.market !== 'gc'), sameI = [], oppI = [];
  for (let i = 0; i < I.length; i++) for (let j = i + 1; j < I.length && I[j].open < I[i].close; j++) { const a = I[i], b = I[j]; if (a.market === b.market) continue; (a.side === b.side ? sameI : oppI).push([a.R, b.R]); }
  Object.assign(usdCluster, { councilSameDollar: desc(same), councilOppositeDollar: desc(opp), baseLossRate: r2(base, 2), openTogetherDepth: depth,
    ictSameDirectionIndex: desc(sameI), ictOppositeIndex: desc(oppI) });
}

// ---------- 2. caps ----------
// council: replay the signals in time order through the trader's exposure rules (trader.mjs 973-986): at most `pm` live
// trades per market and never both sides, at most `usd` live trades betting the same way on the dollar, and a Scalp is
// skipped within `re` hours of a same-way Scalp loss on that market. Pending orders hold their slot like live ones.
function capCouncil(sig, { pm = 2, usd = 2, re = 3 }) {
  const live = [], taken = [], losses = [];
  for (const t of sig) {
    for (let k = live.length - 1; k >= 0; k--) if (live[k].close <= t.open) { const x = live.splice(k, 1)[0]; if (x.filled && x.R < 0 && x.stream === 'scalpA') losses.push(x); }
    const mk = live.filter((x) => x.market === t.market);
    if (mk.length >= pm || mk.some((x) => x.side !== t.side)) continue;
    if (t.usd && live.filter((x) => x.usd === t.usd).length >= usd) continue;
    if (re && t.stream === 'scalpA' && losses.some((x) => x.market === t.market && x.side === t.side && t.open - x.close <= re * 3600 && t.open >= x.close)) continue;
    live.push(t); taken.push(t);
  }
  return taken.filter((t) => t.filled);
}
const cIS = council.filter((t) => t.open < cSplit), cOOS = council.filter((t) => t.open >= cSplit);
const cd = (A) => [dayOf(Math.min(...A.map((t) => t.open))), dayOf(Math.max(...A.map((t) => t.close)))];
const [cd0, cd1] = cd(council), cdS = dayOf(cSplit);
function evalCouncil(cap) {
  const all = capCouncil(council, cap);   // run over the whole window so open trades carry across the split
  const is = all.filter((t) => t.open < cSplit), oos = all.filter((t) => t.open >= cSplit);
  return { cap, is: { ...stats(is.map((t) => t.R)), ...dstats(daily(is, cd0, cdS - 1)) }, oos: { ...stats(oos.map((t) => t.R)), ...dstats(daily(oos, cdS, cd1)) }, trades: all };
}
const capGrid = []; for (const pm of [1, 2, 3, 99]) for (const usd of [1, 2, 3, 4, 99]) for (const re of [0, 3, 6, 12]) capGrid.push(evalCouncil({ pm, usd, re }));
const score = (s) => s.sharpe;   // selection metric: in-sample daily Sharpe
const cBase = capGrid.find((g) => g.cap.pm === 2 && g.cap.usd === 2 && g.cap.re === 3);
const cNone = capGrid.find((g) => g.cap.pm === 99 && g.cap.usd === 99 && g.cap.re === 0);
const cBest = [...capGrid].sort((a, b) => score(b.is) - score(a.is))[0];
// one knob at a time around the live setting (what each cap does on its own)
const oneKnob = { usd: [1, 2, 3, 4, 99].map((u) => capGrid.find((g) => g.cap.pm === 2 && g.cap.usd === u && g.cap.re === 3)),
  pm: [1, 2, 3, 99].map((p) => capGrid.find((g) => g.cap.pm === p && g.cap.usd === 2 && g.cap.re === 3)),
  re: [0, 3, 6, 12].map((r) => capGrid.find((g) => g.cap.pm === 2 && g.cap.usd === 2 && g.cap.re === r)) };
// split by stream / market group for the chosen caps
const groupStats = (A) => ({ scalpFX: stats(A.filter((t) => t.stream === 'scalpA' && LABEL[t.market] && t.market !== 'xau').map((t) => t.R)),
  scalpGold: stats(A.filter((t) => t.stream === 'scalpA' && t.market === 'xau').map((t) => t.R)), scalpCrypto: stats(A.filter((t) => t.stream === 'scalpA' && !LABEL[t.market]).map((t) => t.R)),
  goldM30: stats(A.filter((t) => t.stream === 'goldM30').map((t) => t.R)) });

// ICT: one live trade per market (the tracker's rule) vs 2, and a same-direction cap across the index futures
function capIct(sig, { pm = 1, idx = 99 }) {
  const live = [], taken = [];
  for (const t of sig) {
    for (let k = live.length - 1; k >= 0; k--) if (live[k].close <= t.open) live.splice(k, 1);
    const mk = live.filter((x) => x.market === t.market);
    if (mk.length >= pm || mk.some((x) => x.side !== t.side)) continue;
    if (t.market !== 'gc' && live.filter((x) => x.market !== 'gc' && x.side === t.side).length >= idx) continue;
    live.push(t); taken.push(t);
  }
  return taken;
}
const iIS = (t) => t.year <= 2023;
const [id0, id1] = cd(ih), idS = dayOf(Date.UTC(2024, 0, 1) / 1000);
function evalIct(cap, A = null) {
  const all = A || capIct(ih, cap), is = all.filter(iIS), oos = all.filter((t) => !iIS(t));
  const years = {}; for (const t of all) (years[t.year] ||= []).push(t.R);
  return { cap, is: { ...stats(is.map((t) => t.R)), ...dstats(daily(is, id0, idS - 1)) }, oos: { ...stats(oos.map((t) => t.R)), ...dstats(daily(oos, idS, id1)) },
    years: Object.fromEntries(Object.entries(years).map(([y, r]) => [y, { n: r.length, exp: r2(mean(r)), R: r2(sum(r), 1) }])), trades: all };
}
const ictGrid = []; for (const pm of [1, 2]) for (const idx of [1, 2, 99]) ictGrid.push(evalIct({ pm, idx }));
const iBase = ictGrid.find((g) => g.cap.pm === 1 && g.cap.idx === 99), iBest = [...ictGrid].sort((a, b) => score(b.is) - score(a.is))[0];

// ---------- 3. sizing ----------
// Every scheme gives each trade a weight w (risk in R units). To compare risk-adjusted, each scheme is scaled so its
// average weight over the IN-SAMPLE trades is 1 (no look-ahead), then judged on OOS daily Sharpe, max DD and R/DD.
function sizeSchemes(A, isOf, key) {
  const byK = (t) => t[key];
  const IS = A.filter(isOf);
  // each scheme maps (trade, results of that market's trades CLOSED before this one opened) -> weight
  // Kelly as a stake MULTIPLE: a market's Kelly fraction (mu / var of its R) over the pooled Kelly fraction of the whole
  // stream, so 1x = as good as the stream on average; capped 0-2x (the fraction of equity itself is a separate choice,
  // see kellyFraction below). Pooled k <= 0 -> 1x (nothing to tilt towards).
  const kOf = (h) => { const v = sd(h) ** 2; return v ? mean(h) / v : 0; };
  const isPool = kOf(IS.map((t) => t.R));
  const kelly = (h, pool, floor) => { if (h.length < 30 || !(pool > 0)) return 1; return Math.min(2, Math.max(floor, kOf(h) / pool)); };
  const S = {
    fixed: () => 1,
    // volatility-scaled: 1 / stdev of that market's last 50 results (R), capped 0.5-2x
    volScaled: (t, h) => { const s = h.length >= 20 ? sd(h.slice(-50)) : null; return s ? Math.min(2, Math.max(0.5, 1 / s)) : 1; },
    // Kelly tilt per market from IN-SAMPLE mean / variance (fixed weights), capped 0-2x
    kellyIS: (t) => (isPool > 0 ? Math.min(2, Math.max(0, kOf(IS.filter((x) => byK(x) === byK(t)).map((x) => x.R)) / isPool)) : 1),
    // the same re-estimated on every trade closed before this one (expanding window, 1x until 30 trades in that market)
    kellyRolling: (t, h, all) => kelly(h, kOf(all), 0),
    // with a 0.25x floor, so a market in a slump keeps a small stake instead of being switched off
    kellyRollingFloor: (t, h, all) => kelly(h, kOf(all), 0.25),
  };
  if (A.some((t) => t.size != null)) S.ictSizeOf = (t) => t.size ?? 1;
  const sorted = [...A].sort((a, b) => a.open - b.open), out = {};
  for (const [name, f] of Object.entries(S)) {
    const hist = {}, all = [], pend = [], ws = [];
    for (const t of sorted) {
      for (let k = pend.length - 1; k >= 0; k--) if (pend[k].close <= t.open) { const x = pend.splice(k, 1)[0]; (hist[byK(x)] ||= []).push(x.R); all.push(x.R); }
      ws.push(f(t, hist[byK(t)] || [], all)); pend.push(t);
    }
    const isW = mean(ws.filter((w, i) => isOf(sorted[i]))), norm = isW > 0 ? 1 / isW : 1;
    sorted.forEach((t, i) => { t['w_' + name] = ws[i] * norm; });
    out[name] = { norm: r2(norm, 3), avgW_oos: r2(mean(sorted.filter((t) => !isOf(t)).map((t) => t['w_' + name])), 2) };
  }
  return out;
}
function sizingTable(A, isOf, key, d0, dS, d1) {
  const meta = sizeSchemes(A, isOf, key), res = {};
  for (const name of Object.keys(meta)) {
    const k = 'w_' + name, wr = (B) => B.map((t) => t.R * t[k]);
    const is = A.filter(isOf), oos = A.filter((t) => !isOf(t));
    res[name] = { ...meta[name], is: { ...stats(wr(is)), ...dstats(daily(is, d0, dS - 1, k)) }, oos: { ...stats(wr(oos)), ...dstats(daily(oos, dS, d1, k)) } };
  }
  return res;
}
const ictSizing = sizingTable(iBase.trades, iIS, 'market', id0, idS, id1);
const councilSizing = sizingTable(cBase.trades, (t) => t.open < cSplit, 'market', cd0, cdS, cd1);

// ---------- 4. Monte Carlo ----------
// day-block bootstrap: draw 5-day blocks of calendar days (with their real same-day clustering) to fill a 365-day year
function mcBlock(dly, { paths = 10000, H = 365, L = 5, seed = 7, thr = 20 } = {}) {
  let s = seed >>> 0; const rnd = () => { s = (s * 1664525 + 1013904223) >>> 0; return s / 4294967296; };
  const DD = [], REC = [], UW = [], END = []; let hit = 0, unrec = 0;
  for (let p = 0; p < paths; p++) {
    let eq = 0, pk = 0, dd = 0, ddAt = 0, pkAt = 0, ddPk = 0, uw = 0, uwMax = 0, i = 0; const e = new Float64Array(H);
    while (i < H) { const st = Math.floor(rnd() * (dly.length - L + 1)); for (let k = 0; k < L && i < H; k++, i++) { eq += dly[st + k]; e[i] = eq; if (eq >= pk) { pk = eq; pkAt = i; uw = 0; } else uw++; uwMax = Math.max(uwMax, uw); if (pk - eq > dd) { dd = pk - eq; ddAt = i; ddPk = pk; } } }
    let rec = null; for (let j = ddAt + 1; j < H; j++) if (e[j] >= ddPk) { rec = j - ddAt; break; }
    DD.push(dd); UW.push(uwMax); END.push(eq); if (dd >= thr) hit++; if (rec == null && dd > 0) unrec++; else if (rec != null) REC.push(rec);
  }
  return { paths, horizonDays: H, block: L, maxDD: { p50: r2(pct(DD, 0.5), 1), p90: r2(pct(DD, 0.9), 1), p95: r2(pct(DD, 0.95), 1), p99: r2(pct(DD, 0.99), 1) },
    pDD20: r2(hit / paths, 4), recoveryDays: { p50: REC.length ? pct(REC, 0.5) : null, p90: REC.length ? pct(REC, 0.9) : null, p95: REC.length ? pct(REC, 0.95) : null, notRecoveredInYear: r2(unrec / paths, 3) },
    longestUnderwaterDays: { p50: pct(UW, 0.5), p95: pct(UW, 0.95) }, yearR: { p5: r2(pct(END, 0.05), 1), p50: r2(pct(END, 0.5), 1), p95: r2(pct(END, 0.95), 1) }, pLosingYear: r2(END.filter((x) => x < 0).length / paths, 3) };
}
// i.i.d. trade bootstrap for contrast (ignores same-day clustering): the same number of trades per year as the sample
function mcTrades(rs, perYear, { paths = 10000, seed = 11, thr = 20 } = {}) {
  let s = seed >>> 0; const rnd = () => { s = (s * 1664525 + 1013904223) >>> 0; return s / 4294967296; };
  const DD = []; let hit = 0;
  for (let p = 0; p < paths; p++) { let eq = 0, pk = 0, dd = 0; for (let i = 0; i < perYear; i++) { eq += rs[Math.floor(rnd() * rs.length)]; pk = Math.max(pk, eq); dd = Math.max(dd, pk - eq); } DD.push(dd); if (dd >= thr) hit++; }
  return { paths, tradesPerYear: perYear, maxDD: { p50: r2(pct(DD, 0.5), 1), p95: r2(pct(DD, 0.95), 1), p99: r2(pct(DD, 0.99), 1) }, pDD20: r2(hit / paths, 4) };
}
const yrs = (A) => (Math.max(...A.map((t) => t.close)) - Math.min(...A.map((t) => t.open))) / (365 * DAY);
const mc = {};
{
  // ICT A-setups, live caps (1 per market), OOS 2024-26 only and the full 2018-26 history, fixed 1R and the chosen sizing
  const oosT = iBase.trades.filter((t) => !iIS(t)), allT = iBase.trades;
  mc.ictOOS_fixed = { block: mcBlock(daily(oosT, idS, id1)), iid: mcTrades(oosT.map((t) => t.R), Math.round(oosT.length / yrs(oosT))) };
  mc.ictAll_fixed = { block: mcBlock(daily(allT, id0, id1)), iid: mcTrades(allT.map((t) => t.R), Math.round(allT.length / yrs(allT))) };
  for (const nm of ['ictSizeOf', 'volScaled', 'kellyRolling', 'kellyRollingFloor']) mc['ictOOS_' + nm] = { block: mcBlock(daily(oosT, idS, id1, 'w_' + nm)) };
  // council live sleeve with the live caps (150 d) and uncapped, block bootstrap over its own days (short sample: indicative)
  mc.council_liveCaps = { block: mcBlock(daily(cBase.trades, cd0, cd1)), iid: mcTrades(cBase.trades.map((t) => t.R), Math.round(cBase.trades.length / yrs(cBase.trades))) };
  mc.council_bestCaps = { block: mcBlock(daily(cBest.trades, cd0, cd1)) };
  mc.council_uncapped = { block: mcBlock(daily(cNone.trades, cd0, cd1)) };
  // the two systems together on the days both exist (council 150 d window), live caps, fixed 1R
  const j0 = cd0, j1 = Math.min(cd1, id1);
  const joint = daily(cBase.trades, j0, j1).map((x, i) => x + daily(iBase.trades, j0, j1)[i]);
  mc.combined_window = { days: j1 - j0 + 1, block: mcBlock(joint) };
  const jointB = daily(cBest.trades, j0, j1).map((x, i) => x + daily(iBase.trades, j0, j1)[i]);
  mc.combined_window_bestCaps = { days: j1 - j0 + 1, block: mcBlock(jointB) };
}
// Kelly fraction of equity per 1R (f* = mu / var of per-trade R, in-sample), and the risk per trade that puts the 95th
// percentile one-year max drawdown at 20% of equity (linear, no compounding: 20% / p95 DD in R)
// combined book: correlation between the systems' daily R is ~0 (see corr.systems), so the ICT OOS days and the council
// days are bootstrapped independently and added, with the council's R scaled by wC (its R as a fraction of an ICT R)
function mcPair(dA, dB, wB, { paths = 10000, H = 365, L = 5, seed = 13, thr = 20 } = {}) {
  let s = seed >>> 0; const rnd = () => { s = (s * 1664525 + 1013904223) >>> 0; return s / 4294967296; };
  const draw = (d) => { const o = new Float64Array(H); let i = 0; while (i < H) { const st = Math.floor(rnd() * (d.length - L + 1)); for (let k = 0; k < L && i < H; k++, i++) o[i] = d[st + k]; } return o; };
  const DD = [], END = []; let hit = 0;
  for (let p = 0; p < paths; p++) { const a = draw(dA), b = draw(dB); let eq = 0, pk = 0, dd = 0; for (let i = 0; i < H; i++) { eq += a[i] + wB * b[i]; pk = Math.max(pk, eq); dd = Math.max(dd, pk - eq); } DD.push(dd); END.push(eq); if (dd >= thr) hit++; }
  return { wCouncil: wB, maxDD: { p50: r2(pct(DD, 0.5), 1), p95: r2(pct(DD, 0.95), 1), p99: r2(pct(DD, 0.99), 1) }, pDD20: r2(hit / paths, 4), yearR: { p5: r2(pct(END, 0.05), 1), p50: r2(pct(END, 0.5), 1) }, pLosingYear: r2(END.filter((x) => x < 0).length / paths, 3) };
}
const ictBestT = ictGrid.find((g) => g.cap.pm === iBest.cap.pm && g.cap.idx === iBest.cap.idx).trades;
mc.ictOOS_bestCaps = { block: mcBlock(daily(ictBestT.filter((t) => !iIS(t)), idS, id1)) };
mc.ictAll_bestCaps = { block: mcBlock(daily(ictBestT, id0, id1)) };
const combined = [0, 0.05, 0.1, 0.15, 0.25].map((w) => mcPair(daily(ictBestT.filter((t) => !iIS(t)), idS, id1), daily(cBase.trades, cd0, cd1), w));
// the ICT index cap on the desk's own CNBC replay (NQ ES YM RTY GC, Aug 2025 - Nov 2026): an extra out-of-sample check
const irS = [...ir].sort((a, b) => a.open - b.open);
const cnbcCap = Object.fromEntries([[1, 99], [1, 1], [1, 2], [1, 3], [2, 1]].map(([pm, idx]) => { const A = capIct(irS, { pm, idx }); return [`pm${pm}_idx${idx}`, { ...stats(A.map((t) => t.R)), ...dstats(daily(A, dayOf(irS[0].open), dayOf(Math.max(...irS.map((t) => t.close))))) }]; }));
// council by month: fixed vs rolling Kelly tilt (live caps)
const byMonth = (A, k) => { const m = {}; for (const t of A) { const key = new Date(t.open * 1000).toISOString().slice(0, 7); m[key] = r2((m[key] || 0) + t.R * (t[k] ?? 1), 1); } return m; };
const councilMonths = { fixed: byMonth(cBase.trades, 'w_fixed'), kellyRolling: byMonth(cBase.trades, 'w_kellyRolling'), kellyRollingFloor: byMonth(cBase.trades, 'w_kellyRollingFloor') };
const councilKellyWeightsOOS = Object.fromEntries([...new Set(cBase.trades.map((t) => t.market))].map((m) => [m, r2(mean(cBase.trades.filter((t) => t.market === m && t.open >= cSplit).map((t) => t.w_kellyRolling)), 2)]));
const kellyFraction = {
  ictA_IS2018_23: (() => { const r = iBase.trades.filter(iIS).map((t) => t.R); return { mu: r2(mean(r)), var: r2(sd(r) ** 2), fullKelly: r2(mean(r) / sd(r) ** 2, 4), quarterKelly: r2(mean(r) / sd(r) ** 2 / 4, 4) }; })(),
  ictA_OOS2024_26: (() => { const r = iBase.trades.filter((t) => !iIS(t)).map((t) => t.R); return { mu: r2(mean(r)), var: r2(sd(r) ** 2), fullKelly: r2(mean(r) / sd(r) ** 2, 4), quarterKelly: r2(mean(r) / sd(r) ** 2 / 4, 4) }; })(),
  councilLiveCaps_all: (() => { const r = cBase.trades.map((t) => t.R); return { mu: r2(mean(r)), var: r2(sd(r) ** 2), fullKelly: r2(mean(r) / sd(r) ** 2, 4), quarterKelly: r2(mean(r) / sd(r) ** 2 / 4, 4) }; })(),
};
const riskFor20pct = Object.fromEntries(Object.entries(mc).map(([k, v]) => [k, { p95DD_R: v.block.maxDD.p95, riskPerTradePct: r2(20 / v.block.maxDD.p95, 3) }]));

// ---------- write ----------
const strip = (g) => ({ cap: g.cap, is: g.is, oos: g.oos, years: g.years });
const sblk = (s) => (s ? { n: s.n, wr: s.wr, exp: s.exp, R: s.R, maxDD: s.maxDD, t: s.t } : null);
const out = {
  inputs: { council150d: path.basename(C150), councilWindow: [new Date(cT0 * 1000).toISOString(), new Date(cT1 * 1000).toISOString()], councilSplit: new Date(cSplit * 1000).toISOString(),
    councilSignals: council.length, councilFilled: cFilled.length, ictHist: ih.length, ictCnbc: ir.length },
  corr, usdCluster,
  caps: { council: { variants: capGrid.length, base: strip(cBase), uncapped: strip(cNone), bestIS: strip(cBest), oneKnob: Object.fromEntries(Object.entries(oneKnob).map(([k, v]) => [k, v.map(strip)])),
    groupsBase: { is: groupStats(cBase.trades.filter((t) => t.open < cSplit)), oos: groupStats(cBase.trades.filter((t) => t.open >= cSplit)) },
    groupsBest: { is: groupStats(cBest.trades.filter((t) => t.open < cSplit)), oos: groupStats(cBest.trades.filter((t) => t.open >= cSplit)) },
    top10IS: [...capGrid].sort((a, b) => score(b.is) - score(a.is)).slice(0, 10).map(strip), all: capGrid.map(strip) },
    ict: { variants: ictGrid.length, base: strip(iBase), bestIS: strip(iBest), all: ictGrid.map(strip) } },
  sizing: { ict: ictSizing, council: councilSizing }, kellyFraction, riskFor20pct, combined, cnbcCap, councilMonths, councilKellyWeightsOOS,
  gross: { councilLiveCaps: { is: stats(cBase.trades.filter((t) => t.open < cSplit).map((t) => t.Rg)), oos: stats(cBase.trades.filter((t) => t.open >= cSplit).map((t) => t.Rg)) },
    ictA: { is: stats(iBase.trades.filter(iIS).map((t) => t.Rg)), oos: stats(iBase.trades.filter((t) => !iIS(t)).map((t) => t.Rg)) } },
  mc,
};
fs.mkdirSync(OUT, { recursive: true });
fs.writeFileSync(path.join(OUT, 'detail.json'), JSON.stringify(out, null, 1));
console.log(JSON.stringify({ inputs: out.inputs, avgCorr: corr.avgPairwise, systems: corr.systems, usd: usdCluster }, null, 1));
const line = (n, g) => console.log(n.padEnd(34), 'IS', JSON.stringify(sblk(g.is)), g.is.sharpe, '| OOS', JSON.stringify(sblk(g.oos)), g.oos.sharpe);
line('council live caps 2/2/3h', cBase); line('council uncapped', cNone); line(`council best IS ${JSON.stringify(cBest.cap)}`, cBest);
for (const [k, v] of Object.entries(oneKnob)) for (const g of v) line(`  ${k} ${JSON.stringify(g.cap)}`, g);
line('ict 1/market', iBase); line(`ict best IS ${JSON.stringify(iBest.cap)}`, iBest); for (const g of ictGrid) line(`  ict ${JSON.stringify(g.cap)}`, g);
for (const [sys, T] of Object.entries(out.sizing)) for (const [k, v] of Object.entries(T)) console.log(sys.padEnd(8), k.padEnd(18), 'IS sh', v.is.sharpe, 'R', v.is.R, 'DD', v.is.maxDD, 'rdd', v.is.rdd, '| OOS sh', v.oos.sharpe, 'R', v.oos.R, 'DD', v.oos.maxDD, 'rdd', v.oos.rdd, 'avgW', v.avgW_oos);
for (const [k, v] of Object.entries(mc)) console.log(k.padEnd(24), JSON.stringify(v));
console.log(JSON.stringify({ kellyFraction, riskFor20pct, combined, cnbcCap, councilMonths, councilKellyWeightsOOS }, null, 1));
