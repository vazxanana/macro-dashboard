// Re-costs the council's 30-day replay (council-data backtest.json) under realistic spreads, commission, slippage and
// latency. backtest.mjs charges one "typical spread" per trade: 1 pip on forex, 0.30 on gold, 0.02% of price on crypto,
// stored per trade as cost = spread / risk (R). Because cost = engineSpread / r0, every realistic cost is the same trade's
// cost column scaled by realistic/engine, so the re-costing is exact per trade (no prices needed).
// Latency needs prices: market-entry trades (the @mkt twins and orders filled at the signal) on gold and forex are replayed
// on OANDA M1 mid bars of the same window: entry = the M1 close at the signal, stop/target rebuilt from r0 and rr,
// then filled 0-3 minutes later at the M1 open + spread + slippage.
//   node research/edge/costs/bt30.mjs <backtest.json> <oandaDir> <out.json>
import fs from 'node:fs';
import path from 'node:path';
import { model, nyHour, stats } from './costs.mjs';

const [BT, OD, OUT] = process.argv.slice(2);
const b = JSON.parse(fs.readFileSync(BT, 'utf8')), C = b.tradeCols;
const T = b.trades.map((r) => Object.fromEntries(C.map((c, i) => [c, r[i]]))).filter((x) => x.R_none != null);
const SYM = { xau: 'XAUUSD', eurusd: 'EURUSD', gbpusd: 'GBPUSD', audusd: 'AUDUSD', usdcad: 'USDCAD', usdchf: 'USDCHF' };
const CRYPTO = new Set(['btc', 'eth', 'sol', 'xrp']);
const engSpread = (m) => SYM[m] === 'XAUUSD' ? 0.3 : SYM[m] ? 0.0001 : null;   // crypto: price * 0.0002 (relative)
// crypto realistic round trips as a fraction of price: MT5/cTrader CFD (owner's bridge symbols) ~0.04%; Kraken Pro spot taker 0.40% a side
const CRYPTO_RT = { cfd: 0.0004, kraken: 0.008 };

function realCost(x, acct) {   // in R
  if (CRYPTO.has(x.market)) return x.cost * (CRYPTO_RT[acct === 'raw' ? 'cfd' : 'kraken'] / 0.0002);
  const c = model(SYM[x.market], acct)(x.opened), mkt = x.filled === x.opened;
  const px = c.spread + c.comm + (mkt ? c.slipM : 0) + (x.R_none < 0 ? c.slipS : 0);
  return x.cost * px / engSpread(x.market);
}

// OANDA M1 bars
const OB = {};
for (const m of Object.keys(SYM)) { try { OB[m] = JSON.parse(fs.readFileSync(path.join(OD, `oanda_${m}_1m.json`), 'utf8')); } catch (e) { /* none */ } }
function idxAt(arr, t) { let lo = 0, hi = arr.length; while (lo < hi) { const mid = (lo + hi) >> 1; if (arr[mid][0] < t) lo = mid + 1; else hi = mid; } return lo; }
// replay one market-entry trade; bars are MID: bid = mid - spread/2, ask = mid + spread/2
function sim(x, cost, lat) {
  const A = OB[x.market]; if (!A) return null;
  const k0 = idxAt(A, x.opened); if (k0 < 1 || k0 >= A.length || A[k0 - 1][0] !== x.opened - 60) return null;
  const s = x.side === 'sell' ? -1 : 1, r0 = engSpread(x.market) / x.cost, E = A[k0 - 1][4], S = E - s * r0, Tg = E + s * x.rr * r0;
  let k = idxAt(A, x.opened + lat * 60); if (k >= A.length) return null;
  const c0 = cost ? cost(A[k][0]) : { spread: 0, comm: 0, slipM: 0, slipS: 0 };
  const fill = A[k][1] + s * (c0.spread / 2 + c0.slipM);
  if (s > 0 ? fill >= Tg : fill <= Tg) return 0;
  for (let j = k; j < A.length; j++) {
    const [t, , h, l] = A[j], c = cost ? cost(t) : c0, hs = c.spread / 2;
    // exits: a buy sells at the bid (mid - hs), a sell buys at the ask (mid + hs)
    if (s > 0 ? l - hs <= S : h + hs >= S) { const px = (s > 0 ? Math.min(S, A[j][1] - hs) : Math.max(S, A[j][1] + hs)) - s * c.slipS; return (s * (px - fill) - c0.comm) / r0; }
    if (s > 0 ? h - hs >= Tg : l + hs <= Tg) return (s * (Tg - fill) - c0.comm) / r0;
  }
  return null;   // still open at the end of the OANDA window
}

const live = (x) => x.setup.replace('@mkt', '') === 'scalp' && x.d1 === 'against' && !['asia', 'overlap'].includes(x.session) && x.market !== 'audusd';
const out = { source: { at: b.at, from: b.from, to: b.to, trades: T.length }, engine: 'backtest.mjs spreadOf: forex 1 pip, gold 0.30, crypto 0.02% of price, one per round trip', groups: {}, latency: {}, validation: {} };
const groupsOf = (x) => { const k = x.setup, g = [k, `${k}|${CRYPTO.has(x.market) ? 'crypto' : x.market === 'xau' ? 'gold' : 'fx'}`]; if (live(x)) { const L = `LIVE scalp rule${x.setup.endsWith('@mkt') ? ' @mkt' : ''}`; g.push(L, `${L}|${g[1].split('|')[1]}`, `${L}|${x.market}`); } return g; };
const acc = {};
for (const x of T) {
  const v = { gross: x.R_none, engine: x.R_none - x.cost, raw: x.R_none - realCost(x, 'raw'), oanda: x.R_none - realCost(x, 'oanda') };
  for (const g of groupsOf(x)) { const a = (acc[g] = acc[g] || { gross: [], engine: [], raw: [], oanda: [], costEng: [], costRaw: [], costOanda: [] });
    for (const k of ['gross', 'engine', 'raw', 'oanda']) a[k].push(v[k]); a.costEng.push(x.cost); a.costRaw.push(v.gross - v.raw); a.costOanda.push(v.gross - v.oanda); }
}
const mean = (a) => a.reduce((p, q) => p + q, 0) / a.length;
for (const [g, a] of Object.entries(acc)) out.groups[g] = { gross: stats(a.gross), engine: stats(a.engine), raw: stats(a.raw), oanda: stats(a.oanda), costR: { engine: +mean(a.costEng).toFixed(3), raw: +mean(a.costRaw).toFixed(3), oanda: +mean(a.costOanda).toFixed(3) } };

// latency on market entries, gold + forex
const lat = {}; let match = 0, tried = 0;
for (const x of T) {
  if (!SYM[x.market] || x.filled !== x.opened || x.cost < 0.005) continue;
  const g0 = sim(x, null, 0); if (g0 == null) continue;
  tried++; if (Math.abs(g0 - x.R_none) < 0.25) match++;
  const raw = model(SYM[x.market], 'raw'), oa = model(SYM[x.market], 'oanda');
  const r = { feed: x.R_none, g0, r0: sim(x, raw, 0), r1: sim(x, raw, 1), r2: sim(x, raw, 2), r3: sim(x, raw, 3), o2: sim(x, oa, 2) };
  if (Object.values(r).some((v) => v == null)) continue;
  for (const g of [x.setup.replace('@mkt', '') + ' (market entries)', 'all market entries', ...(live(x) ? ['LIVE scalp rule (market entries)', `LIVE scalp rule (market entries)|${x.market === 'xau' ? 'gold' : 'fx'}`] : [])]) {
    const a = (lat[g] = lat[g] || {}); for (const [k, v] of Object.entries(r)) (a[k] = a[k] || []).push(v);
  }
}
out.validation = { marketEntryTradesReplayed: tried, sameOutcomeWithin025R: match, note: 'OANDA mid vs the Kraken/PAXG feed the replay used; a mismatch is a different stop/target touch, not a cost' };
for (const [g, a] of Object.entries(lat)) out.latency[g] = Object.fromEntries(Object.entries(a).map(([k, v]) => [k, stats(v)]));
fs.writeFileSync(OUT, JSON.stringify(out, null, 1));
const row = (g, s) => `${g.padEnd(34)} n${String(s.gross.n).padStart(5)}  gross ${s.gross.exp.toFixed(3)}  engine ${s.engine.exp.toFixed(3)}  raw ${s.raw.exp.toFixed(3)}  oanda ${s.oanda.exp.toFixed(3)}  | costR eng ${s.costR.engine} raw ${s.costR.raw} oanda ${s.costR.oanda}`;
for (const [g, s] of Object.entries(out.groups).sort()) if (s.gross.n >= 30) console.log(row(g, s));
console.log('validation', JSON.stringify(out.validation));
for (const [g, a] of Object.entries(out.latency)) console.log('LAT', g.padEnd(34), Object.entries(a).map(([k, s]) => `${k} ${s.exp}`).join('  '), 'n', a.g0.n, '(feed R_none', a.feed.exp + ')');
