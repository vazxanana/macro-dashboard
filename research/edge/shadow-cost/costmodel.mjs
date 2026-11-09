// Realistic round-trip cost of a paper trade in R, the stats every stream is judged on, and the pre-registered verdict
// (research/edge/shadow-cost/preregistration.md). Pure functions, no I/O; run.mjs feeds them, tests/shadow-cost.test.mjs checks them.
//
// Cost in price = spread + commission + entry slippage (market entries only) + exit slippage (any exit but a resting target).
// Spread / slippage levels for forex and gold are the costs study's raw-account figures (research/edge/costs/costs.mjs) with its
// New York-hour session shape; commission is the demo broker's (ctrader/symbols.json); crypto spread is the broker's quote;
// CME futures are the costs study's micro round trip.
import { LEVEL, sessMult, nyHour, FUT } from '../costs/costs.mjs';

export const GATE = 0.10;                     // proposal 3: cost at most 0.10R a trade
export const FX = { eurusd: 'EURUSD', gbpusd: 'GBPUSD', audusd: 'AUDUSD', usdcad: 'USDCAD', usdchf: 'USDCHF' };
export const CRYPTO = { btc: 'BTCUSD', eth: 'ETHUSD', sol: 'SOLUSD', xrp: 'XRPUSD' };
export const FUTMAP = { nq: 'NQ', es: 'ES', ym: 'YM', rty: 'RTY', gc: 'GC' };
export const groupOf = (m) => FX[m] ? 'forex' : m === 'xau' ? 'gold' : m === 'xag' ? 'silver' : CRYPTO[m] ? 'crypto' : FUTMAP[m] ? 'futures' : null;

// Broker inputs (defaults = council-data ctrader/symbols.json of 9 Nov 2026 07:03 UTC; run.mjs reads the live file and passes its own)
export const BROKER = {
  commPerSide: { forex: 22.5e-6, gold: 12e-6, silver: 12e-6, crypto: 0 },          // USD per USD of notional, a side
  cryptoSpread: { btc: 17.5 / 74117.05, eth: 3.08 / 2105.55, sol: 0.208 / 85.735 }, // quoted spread / mid
};
export const SILVER = { spread: 0.025, slipM: 0.005, slipS: 0.01 };   // spot silver (no broker quote): assumption, stated in the prereg
export const FUT_COMM_RT = 1.24;                                      // CME micro, USD round trip incl. fees

// mirror-measured market-entry slippage multipliers per group ({ forex: 1, ... }; 1 = the default)
export function brokerFrom(symbols) {
  const S = (symbols && symbols.symbols) || {}, out = { commPerSide: { ...BROKER.commPerSide }, cryptoSpread: { ...BROKER.cryptoSpread } };
  const rate = (n) => { const c = S[n] && S[n].commission; return c && Number.isFinite(+c.preciseRate) ? +c.preciseRate / 1e8 / 1e6 : null; };
  const fx = rate('EURUSD'), au = rate('XAUUSD');
  if (fx != null) out.commPerSide.forex = fx;
  if (au != null) { out.commPerSide.gold = au; out.commPerSide.silver = au; }
  for (const [m, n] of Object.entries(CRYPTO)) {
    const s = S[n]; if (s && +s.spread > 0 && +s.bid > 0 && +s.ask > 0) out.cryptoSpread[m] = +s.spread / ((+s.bid + +s.ask) / 2);
  }
  if (out.cryptoSpread.xrp == null) { const v = ['btc', 'eth', 'sol'].map((m) => out.cryptoSpread[m]).filter(Number.isFinite); out.cryptoSpread.xrp = v.reduce((a, b) => a + b, 0) / v.length; }
  return out;
}

// Components of one round trip in price units. trade: { market, entry (price), t (entry, unix s), marketEntry (bool), exit:
// 'target' | 'stop' | 'time' } (exit 'stop' covers stop, trail and break-even stops). slipMult: { group: multiplier } from the mirror.
export function costParts(trade, broker = BROKER, slipMult = {}) {
  const m = trade.market, g = groupOf(m), px = +trade.entry, k = slipMult[g] || 1;
  if (!g || !(px > 0)) return null;
  let spread, comm, slipM, slipS;
  if (g === 'forex' || g === 'gold') {
    const sym = g === 'gold' ? 'XAUUSD' : FX[m], L = LEVEL[sym], unit = g === 'gold' ? 1 : 1e-4;
    spread = L.raw * unit * sessMult(sym, nyHour(trade.t)); comm = 2 * broker.commPerSide[g] * px; slipM = L.slipM * unit; slipS = L.slipS * unit;
  } else if (g === 'silver') {
    spread = SILVER.spread * sessMult('XAUUSD', nyHour(trade.t)); comm = 2 * broker.commPerSide.silver * px; slipM = SILVER.slipM; slipS = SILVER.slipS;
  } else if (g === 'crypto') {
    spread = broker.cryptoSpread[m] * px; comm = 0; slipM = slipS = spread / 2;
  } else {
    const F = FUT[FUTMAP[m]]; spread = F.tick; comm = FUT_COMM_RT / F.usdPerPt; slipM = slipS = F.tick;
  }
  slipM *= k;
  const entrySlip = trade.marketEntry ? slipM : 0, exitSlip = trade.exit === 'target' ? 0 : trade.exit === 'time' ? slipM : slipS;
  return { spread, comm, slip: entrySlip + exitSlip, total: spread + comm + entrySlip + exitSlip };
}

// cost in R of one unit (the caller multiplies by size); r0 = initial risk in price
export function costR(trade, broker = BROKER, slipMult = {}) {
  const p = costParts(trade, broker, slipMult), r0 = +trade.r0;
  if (!p || !(r0 > 0)) return null;
  return { costR: p.total / r0, spreadR: p.spread / r0, commR: p.comm / r0, slipR: p.slip / r0 };
}

// Mirror fills → slippage multipliers. map: one or more ctrader/mirror*.json state.map objects merged; defaults: the model's slipM per
// market. Only same-time copies (lagSec <= maxLag) with a market entry and a slipR count, one per positionId.
export function mirrorSlippage(maps, broker = BROKER, { maxLag = 300, minFills = 5 } = {}) {
  const seen = new Set(), by = {}, rows = [];
  const mk = Object.fromEntries([...Object.entries(FX), ...Object.entries(CRYPTO), ['xau', 'XAUUSD']].map(([m, s]) => [s, m]));
  for (const map of maps) for (const [id, f] of Object.entries(map || {})) {
    const m = f && mk[f.symbol]; if (!m || f.viaLimit || f.slipR == null || !(+f.lagSec <= maxLag)) continue;
    const key = f.positionId || id; if (seen.has(key)) continue; seen.add(key);
    const risk = Math.abs(+f.councilEntry - +f.stop); if (!(risk > 0)) continue;
    const t = Date.parse(f.openedAt) / 1000, d = costParts({ market: m, entry: +f.councilEntry, t, marketEntry: true, exit: 'target' }, broker);
    const halfSpread = d.spread / 2, slipM = d.slip, adverse = +f.slipR * risk, excess = adverse - halfSpread;
    const g = groupOf(m); (by[g] = by[g] || []).push(excess / slipM);
    rows.push({ id, market: m, lagSec: +f.lagSec, slipR: +f.slipR, excessOverDefault: +(excess / slipM).toFixed(2) });
  }
  const mult = {}, groups = {};
  for (const [g, a] of Object.entries(by)) {
    const mean = a.reduce((s, x) => s + x, 0) / a.length;
    groups[g] = { n: a.length, meanExcessOverDefault: +mean.toFixed(2), used: a.length >= minFills };
    if (a.length >= minFills && mean > 1) mult[g] = mean;
  }
  const lags = rows.map((r) => r.lagSec).sort((a, b) => a - b);
  return { mult, groups, rows, n: rows.length, medianLagSec: lags.length ? lags[lags.length >> 1] : null,
    meanSlipR: rows.length ? +(rows.reduce((s, r) => s + r.slipR, 0) / rows.length).toFixed(3) : null };
}

// stats of a list of R values in time order: n, wr, exp, R, sd, t, maxDD (net curve, <= 0)
export function stats(R) {
  const n = R.length; if (!n) return { n: 0, wr: null, exp: null, R: 0, t: null, maxDD: 0 };
  let s = 0, w = 0, eq = 0, pk = 0, dd = 0;
  for (const r of R) { s += r; if (r > 0) w++; eq += r; if (eq > pk) pk = eq; if (eq - pk < dd) dd = eq - pk; }
  const m = s / n, sd = n > 1 ? Math.sqrt(R.reduce((a, r) => a + (r - m) ** 2, 0) / (n - 1)) : 0;
  return { n, wr: +(w / n).toFixed(3), exp: +m.toFixed(3), R: +s.toFixed(1), t: sd > 0 ? +(m / (sd / Math.sqrt(n))).toFixed(2) : null, maxDD: +dd.toFixed(1) };
}
const mean = (a) => a.length ? a.reduce((s, x) => s + x, 0) / a.length : null;
const median = (a) => { const v = a.slice().sort((x, y) => x - y), n = v.length; return n ? (n % 2 ? v[n >> 1] : (v[n / 2 - 1] + v[n / 2]) / 2) : null; };

// trades: [{ t, R (gross, x size), cost (R, x size), live (bool) }]; oosFrom: unix s or null (null = OOS is the live record only)
export function judge(trades, { oosFrom = null, gated = false } = {}) {
  const sorted = trades.slice().sort((a, b) => a.t - b.t), costs = sorted.map((x) => x.cost);
  const isOos = (x) => x.live || (oosFrom != null && x.t >= oosFrom);
  const IS = sorted.filter((x) => !isOos(x)), OOS = sorted.filter(isOos), LIVE = sorted.filter((x) => x.live);
  const net = (a, k = 1) => a.map((x) => x.R - k * x.cost), half = OOS.length >> 1;
  const out = {
    cost: { mean: costs.length ? +mean(costs).toFixed(3) : null, median: costs.length ? +median(costs).toFixed(3) : null, n: costs.length },
    is: stats(net(IS)), isGross: stats(IS.map((x) => x.R)),
    oos: stats(net(OOS)), oosGross: stats(OOS.map((x) => x.R)), oosX2: stats(net(OOS, 2)),
    oosCost: OOS.length ? +mean(OOS.map((x) => x.cost)).toFixed(3) : null,
    halves: [stats(net(OOS.slice(0, half))), stats(net(OOS.slice(half)))],
    live: stats(net(LIVE)), liveGross: stats(LIVE.map((x) => x.R)),
  };
  const costOk = gated || (out.cost.mean != null && out.cost.mean <= GATE), o = out.oos;
  const liveOk = out.live.n < 10 || out.live.t == null || out.live.t > -2;
  let verdict;
  if (!costOk) verdict = 'FAIL';
  else if (o.n >= 30 && o.exp <= 0) verdict = 'FAIL';
  else if (o.n >= 30 && o.exp > 0 && o.t >= 2 && out.halves.every((h) => h.n && h.exp > 0) && out.oosX2.exp > 0 && liveOk) verdict = 'PASS';
  else verdict = 'INCONCLUSIVE';
  out.costOk = costOk;
  out.survives = costOk && o.n > 0 && o.exp > 0;
  out.verdict = verdict;
  out.why = !costOk ? `cost ${out.cost.mean}R > ${GATE}R` : o.n >= 30 && o.exp <= 0 ? `net OOS ${o.exp}R <= 0 (n ${o.n})` : verdict === 'PASS' ? 'all bars met'
    : o.n < 30 ? `only ${o.n} OOS trades` : `net OOS ${o.exp}R, t ${o.t}; halves ${out.halves.map((h) => h.exp).join(' / ')}; x2 ${out.oosX2.exp}`;
  return out;
}
