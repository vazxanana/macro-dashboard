// Council · paper fills (8 Nov 2026): how the Trader's paper trades would really have filled. Pure functions, no I/O; the Trader
// (council/trader.mjs) and the Backtest (council/backtest.mjs) import them, tests/trader-*.test.mjs check them.
//   1. Costs: every closed paper trade keeps its raw R (R, as before) and gets a cost-adjusted R (Rnet) with the cost in R (costR).
//      The cost is the Backtest's costOf (spread + Kraken fees on crypto) plus slippage on every market order (entry at market,
//      stop, time or at-market exit; a limit entry and a target exit pay none). Spread: the broker's symbol info when known
//      (ctrader/symbols.json), else the Backtest's typical spread. Entry slippage: the cTrader demo mirror's own fills once a
//      market has MIN_FILLS of them (median of demo fill - council entry, in price), else SLIP_SPREADS of a spread.
//   2. Stale-signal guard (a shadow stat, it changes no trade): drift = how far price had moved from the signal's price when the
//      Trader filled, in R of the signal's risk (+ = chased, the fill is worse; - = price came back toward the stop).
//      |drift| > STALE_R would be recorded as "missed" by the guard; staleStats() counts those and what they made.
//   3. Trade-state helpers: a stop hit through a gap fills at the gapped open, a candle that fills a limit and reaches the target
//      with an unknown order is resolved as missed, and candles while the spot market is shut are ignored for gold / forex.

// typical spread (same model as the trade reviews): one spread is paid per round trip
export const spreadOf = (M, price) => M.group === 'Forex' ? 0.0001 : M.spot ? 0.3 : price * 0.0002;
// Cost charged to a replay trade, in price: the spread, plus for crypto Kraken's exchange fees (the council's crypto prices are
// Kraken spot; research/edge/costs: the spread alone was ~1/40 of the real cost). Kraken Pro's entry tier: 0.25% maker, 0.40% taker.
// A limit entry pays maker, a market entry (twins, sweeps) taker; the exit is charged taker (stops are market orders). Forex and
// gold keep the spread only (a raw-spread account's commission is about the spread again: research/edge/costs).
export const FEE = { maker: 0.0025, taker: 0.004 };
export const costOf = (M, price, limitEntry) => spreadOf(M, price) + (M.group === 'Crypto' ? price * ((limitEntry ? FEE.maker : FEE.taker) + FEE.taker) : 0);

export const SLIP_SPREADS = 0.5;   // conservative default: half a spread of slippage on every market order until real fills exist
export const MIN_FILLS = 5;        // demo fills a market needs before the mirror's slippage replaces the default
export const STALE_R = 0.25;       // stale-signal guard: price more than this many R from the signal's price when we fill

const med = (a) => { const v = a.slice().sort((x, y) => x - y), n = v.length; return n ? (n % 2 ? v[n >> 1] : (v[n / 2 - 1] + v[n / 2]) / 2) : null; };
const DONE = new Set(['win', 'loss', 'be']);

// Per-market cost inputs. symbols: market -> broker symbol names (ctrader-mirror SYMBOLS); brokerInfo: { symbols: { XAUUSD: { spread } } }
// (spread in price); mirrorMap: ctrader/mirror.json state.map (each fill has symbol, side, fillPrice, councilEntry).
export function costModel(markets, { symbols = {}, brokerInfo = null, mirrorMap = null, minFills = MIN_FILLS } = {}) {
  const info = (brokerInfo && (brokerInfo.symbols || brokerInfo)) || {}, slips = {};
  for (const m of Object.values(mirrorMap || {})) {
    const px = +m.fillPrice, ce = +m.councilEntry; if (!(px > 0 && ce > 0)) continue;
    const k = Object.keys(markets).find((x) => (symbols[x] || []).includes(m.symbol)); if (!k) continue;
    (slips[k] = slips[k] || []).push((m.side === 'sell' ? -1 : 1) * (px - ce));
  }
  const out = {};
  for (const k of Object.keys(markets)) {
    const bi = (symbols[k] || []).map((n) => info[n]).find((x) => x && +x.spread > 0), s = slips[k] || [];
    out[k] = { spread: bi ? +bi.spread : null, entrySlip: s.length >= minFills ? +med(s).toPrecision(6) : null, fills: s.length,
      src: (bi ? 'broker' : 'default') + (s.length >= minFills ? '+mirror' : '') };
  }
  return out;
}

const unitR = (t) => t.rawR != null ? t.rawR : t.R;
// did the trade leave at its target (a resting limit: no slippage)? Newer trades say so in exitKind; older ones are inferred
export const targetExit = (t) => t.exitKind ? t.exitKind === 'target' : !t.exit && t.status === 'win' && !t.trailMoved && Number.isFinite(unitR(t)) && Math.abs(unitR(t) - t.rr) <= 0.02;
export const limitEntry = (t) => t.entryMode === 'limit' || (t.entryMode !== 'market' && t.filled != null && t.opened != null && t.filled !== t.opened);

// cost of one round trip, in R of the trade's initial risk (per unit of size)
export function tradeCost(t, M, mm = {}) {
  const px = +t.entry, r0 = +t.r0 || Math.abs(t.entry - t.stop);
  if (!M || !(px > 0) || !(r0 > 0)) return null;
  const lim = limitEntry(t), sp = mm && mm.spread > 0 ? mm.spread : spreadOf(M, px), slip = SLIP_SPREADS * sp;
  let cost = costOf(M, px, lim) - spreadOf(M, px) + sp;
  if (!lim) cost += mm && mm.entrySlip != null ? Math.max(0, mm.entrySlip) - sp / 2 : slip;   // a demo fill already includes the half spread
  if (!targetExit(t)) cost += slip;
  return { costR: cost / r0, src: (mm && mm.src) || 'default' };
}

// Stamp costR (once, at the close) and Rnet (every run, so it follows R) on every closed trade; a trade reopened (bad print) loses both
export function annotateCosts(trades, markets, model = {}) {
  for (const t of trades) {
    if (!DONE.has(t.status) || !Number.isFinite(t.R)) { delete t.Rnet; delete t.costR; delete t.costSrc; continue; }
    if (t.costR == null) { const c = tradeCost(t, markets[t.market], model[t.market]); if (!c) continue; t.costR = +c.costR.toFixed(3); t.costSrc = c.src; }
    const scale = t.rawR != null && t.size ? t.size : 1;   // R is already x size once rawR is set
    t.Rnet = +(t.R - t.costR * scale).toFixed(2);
  }
  return trades;
}

const sumUp = (a) => ({ n: a.length, R: +a.reduce((s, t) => s + t.R, 0).toFixed(2), Rnet: +a.reduce((s, t) => s + (Number.isFinite(t.Rnet) ? t.Rnet : t.R), 0).toFixed(2) });
// gross vs net by book (live / shadow) and market group
export function costSummary(trades, markets) {
  const out = {};
  for (const book of ['live', 'shadow']) {
    const a = trades.filter((t) => DONE.has(t.status) && Number.isFinite(t.R) && !!t.shadow === (book === 'shadow'));
    out[book] = { all: sumUp(a), byGroup: {} };
    for (const g of [...new Set(a.map((t) => (markets[t.market] || {}).group || 'other'))]) out[book].byGroup[g] = sumUp(a.filter((t) => ((markets[t.market] || {}).group || 'other') === g));
  }
  return out;
}

// Stale-signal guard. drift in R of the signal's risk: + = price ran on (we chase), - = price came back toward the stop
export function driftR(side, signalPx, fillPx, stop) {
  const r = Math.abs(signalPx - stop);
  if (!(r > 0) || !Number.isFinite(+fillPx)) return null;
  return +(((side === 'sell' ? -1 : 1) * (fillPx - signalPx)) / r).toFixed(3);
}
// engine setups record the planned entry in ctx.planned; a market fill with no stop move gets its drift back-filled once
export function backfillDrift(trades) {
  for (const t of trades) if (t.drift == null && t.ctx && Number.isFinite(t.ctx.planned) && t.filled != null && t.filled === t.opened && !t.beMoved && !t.trailMoved) {
    const d = driftR(t.side, t.ctx.planned, t.entry, t.stop); if (d != null) t.drift = d;
  }
  return trades;
}
export function staleStats(trades, X = STALE_R) {
  const rows = trades.filter((t) => Number.isFinite(t.drift)), out = { X, n: rows.length };
  const grp = (a) => { const c = a.filter((t) => DONE.has(t.status) && Number.isFinite(t.R)); const s = sumUp(c); return { n: a.length, closed: c.length, R: s.R, Rnet: s.Rnet }; };
  for (const book of ['live', 'shadow']) {
    const a = rows.filter((t) => !!t.shadow === (book === 'shadow'));
    out[book] = { chased: grp(a.filter((t) => t.drift > X)), better: grp(a.filter((t) => t.drift < -X)), kept: grp(a.filter((t) => Math.abs(t.drift) <= X)) };
  }
  return out;
}

// ─── trade-state helpers ───
// the exit price of a stop hit on candle b: the stop, or the candle's open when price opened beyond it (a weekend or news gap,
// missing candles). afterFill: the candle started after the fill (on the fill candle the open came before the fill: use the stop)
export const stopFill = (b, sell, stop, afterFill = true) => !afterFill ? stop : sell ? Math.max(stop, b.open) : Math.min(stop, b.open);
export const exitR = (sell, entry, px, r0) => +(((sell ? entry - px : px - entry)) / r0).toFixed(2);
// a resting limit order whose fill candle also reaches the target (without the stop) and did not open through the entry: the order
// of the two inside the candle is unknown. Target first = the order is missed (0R); entry first = a win. Resolved as missed.
export function fillBarAmbiguous(b, sell, entry, stop, t1) {
  const hitT = sell ? b.low <= t1 : b.high >= t1, hitS = sell ? b.high >= stop : b.low <= stop, openThrough = sell ? b.open >= entry : b.open <= entry;
  return hitT && !hitS && !openThrough;
}
// spot gold and forex are shut from Friday 17:00 to Sunday 17:00 New York time; a candle in that window (Kraken's PAXG fallback
// trades 24/7) is not the market and must not fill or stop a trade
const nyFmt = new Intl.DateTimeFormat('en-US', { timeZone: 'America/New_York', weekday: 'short', hour: '2-digit', hourCycle: 'h23' });
export function spotClosed(t) {
  const p = Object.fromEntries(nyFmt.formatToParts(new Date(t * 1000)).map((x) => [x.type, x.value])), h = +p.hour;
  return p.weekday === 'Sat' || (p.weekday === 'Fri' && h >= 17) || (p.weekday === 'Sun' && h < 17);
}
