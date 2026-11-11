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
//   4. The Backtest's trade step (replayBar / manageVariant): its exit variants managed on those same helpers, so a replayed trade
//      fills and exits like a live one (tests/backtest-fills.test.mjs).

// typical spread (same model as the trade reviews): one spread is paid per round trip
export const spreadOf = (M, price) => M.group === 'Forex' ? 0.0001 : M.spot ? 0.3 : price * 0.0002;
// Cost charged to a replay trade, in price: the spread, plus for crypto the rest of a CFD round trip. Until 7 Nov crypto was
// charged Kraken Pro spot fees (0.25% maker / 0.40% taker a side, FEE below, kept for the research that cites them): the council's
// crypto prices are Kraken spot, and research/edge/costs found the spread alone ~1/40 of that. The owner trades through cTrader
// (CFD), so the Kraken venue was the wrong cost model (shadow-audit, 8 Nov: 300R of a −288R paper week was those fees); crypto
// now pays the costs study's CFD figure, 0.04% a round trip (CFD_CRYPTO), of which spreadOf is the 0.02% spread. Forex and gold
// keep the spread only (a raw-spread account's commission is about the spread again: research/edge/costs).
export const FEE = { maker: 0.0025, taker: 0.004 };   // Kraken Pro entry tier: no longer charged, see above
export const CFD_CRYPTO = 0.0004;                     // CFD round trip on crypto as a fraction of price (research/edge/costs "raw" column)
export const costOf = (M, price, limitEntry) => spreadOf(M, price) + (M.group === 'Crypto' ? price * (CFD_CRYPTO - 0.0002) : 0);

// Overnight financing (11 Nov 2026, owner approved the edge review's decision 2; research/edge/trend-breadth Part A). A long gold
// position on the demo broker pays financing at every rollover it is held through: the broker's own XAUUSD symbol record
// (council-data ctrader/symbols.json, read 11 Nov 2026: swap.long -5.903 pips of 0.1 an ounce near 3,987, three on Wednesday),
// confirmed by the demo account's own deals (-$0.59 for one ounce held one night near $4,100) = 0.0148 % of the price a night,
// about 5.3 % a year. Method as the study's: rollovers are Monday-Friday 22:00 UTC (17:00 New York to the hour), a Wednesday
// counts three; financing in R = nights x rate x entry price / the trade's initial risk, per unit. Longs only: the broker
// credits a short (+2.785 pips), the paper model credits nothing. Gold only: no other market's rate has been measured here, so
// none is charged (the NQ open run is out before the rollover). Today's rate, not a history of it: update FIN when the broker's
// record changes. It is part of costR from the first trade closed after this code runs; a costR already stamped is never redone.
export const FIN = { xau: { long: 0.000148, short: 0, src: 'cTrader demo XAUUSD swap.long -5.903 pips (ctrader/symbols.json), research/edge/trend-breadth Part A', asOf: '2026-11-11' } };
export const FIN_DAY = 86400;
// rollovers strictly after t and before c (unix seconds): Monday-Friday 22:00 UTC, Wednesday counts three
export function nights(t, c) {
  let n = 0;
  if (!Number.isFinite(t) || !Number.isFinite(c)) return 0;
  for (let d = Math.floor(t / FIN_DAY) * FIN_DAY + 22 * 3600; d < c; d += FIN_DAY) {
    if (d <= t) continue;
    const w = new Date(d * 1000).getUTCDay();
    if (w >= 1 && w <= 5) n += w === 3 ? 3 : 1;
  }
  return n;
}
// financing of one closed trade, in R of its initial risk per unit: { finR, nights } (0 when the market or side pays none)
export function financing(t, fin = FIN) {
  const f = fin[t.market], rate = f ? (t.side === 'sell' ? f.short : f.long) : 0, px = +t.entry, r0 = +t.r0 || Math.abs(t.entry - t.stop);
  const from = t.filled != null ? t.filled : t.opened, nn = rate > 0 && Number.isFinite(from) && Number.isFinite(t.closed) ? nights(from, t.closed) : 0;
  return { finR: nn > 0 && px > 0 && r0 > 0 ? nn * rate * px / r0 : 0, nights: nn };
}
// Financing of a replay or study row that carries no stamped cost (its R is after the spread only): the same charge, from the
// row's own entry, initial risk (r0, else its first stop stop0, else stop), fill and close. A row whose cost was stamped at its
// close already holds its financing (or closed before financing was counted, and is never recosted): 0 here.
export const rowFinancing = (x, fin = FIN) => !x || x.costR != null || Number.isFinite(x.Rnet) ? { finR: 0, nights: 0 }
  : financing({ ...x, r0: +x.r0 || (x.stop0 != null ? Math.abs(x.entry - x.stop0) : undefined) }, fin);
// Financing of one replay trade (council/backtest.mjs; tr as replayBar manages it: m, side, entry, r0, filled) for one of its exit
// variants (default the live exit, R_none): the charge the Trader stamps on the same trade at its close, 0 while that exit runs.
export const replayFin = (tr, v = tr && tr.v && tr.v[0], fin = FIN) => !tr || !v || !v.done || !Number.isFinite(v.closed) ? 0
  : financing({ market: tr.m, side: tr.side, entry: tr.entry, r0: tr.r0, filled: tr.filled, closed: v.closed }, fin).finR;
// The stream a system is judged on once the owner has made it a paper shadow (blockedBy exactly ['owner-shadow']; the momentum
// pullback's 6 Nov ['test']): its live trades from before plus the shadow trades the unchanged rule takes after. A trade another
// rule blocked (weekly, cap, momentum, ...) is not part of it.
export const ownStream = (x) => !!x && (!x.shadow || (Array.isArray(x.blockedBy) && x.blockedBy.length === 1 && (x.blockedBy[0] === 'owner-shadow' || x.blockedBy[0] === 'test')));

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
  const fin = financing(t);   // overnight financing (gold longs), 0 for a trade closed before its first rollover
  return { costR: cost / r0 + fin.finR, src: (mm && mm.src) || 'default', finR: fin.finR, nights: fin.nights };
}

// Stamp costR (once, at the close) and Rnet (every run, so it follows R) on every closed trade; a trade reopened (bad print) loses both
export function annotateCosts(trades, markets, model = {}) {
  for (const t of trades) {
    if (!DONE.has(t.status) || !Number.isFinite(t.R)) { delete t.Rnet; delete t.costR; delete t.costSrc; delete t.finR; delete t.nights; continue; }
    if (t.costR == null) { const c = tradeCost(t, markets[t.market], model[t.market]); if (!c) continue; t.costR = +c.costR.toFixed(3); t.costSrc = c.src; if (c.nights > 0) { t.finR = +c.finR.toFixed(3); t.nights = c.nights; } }
    const scale = t.rawR != null && t.size ? t.size : 1;   // R is already x size once rawR is set
    t.Rnet = +(t.R - t.costR * scale).toFixed(2);
  }
  return trades;
}

const sumUp = (a) => ({ n: a.length, R: +a.reduce((s, t) => s + t.R, 0).toFixed(2), Rnet: +a.reduce((s, t) => s + (Number.isFinite(t.Rnet) ? t.Rnet : t.R), 0).toFixed(2),
  fin: +a.reduce((s, t) => s + (Number.isFinite(t.finR) ? t.finR * (t.rawR != null && t.size ? t.size : 1) : 0), 0).toFixed(2) });   // fin: the financing part of the cost, in R (already inside Rnet)
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
// 7 Nov (owner OK): the daily 17:00 New York rollover. Its first minutes print spiky mid prices on forex (USD/CHF 12 Aug 21:04 UTC);
// over 90 days 21 live-style stops (12.6R) were taken there (#520). OANDA prints next to nothing 17:00-17:04 and the spread spike
// sits on the first candles after (USD/CHF 1m range 17:05 median 2.6 / p90 5.7 pips vs ~0.5-0.8 / ~2 the rest of the hour; back to
// normal by ~17:15). Candles starting 17:00-17:14 New York, Monday to Thursday (Friday 17:00 is the weekend close, Sunday 17:00
// the real reopen), fill and stop nothing; the next candle still can (a real move shows in its open: stopFill).
const nyMin = new Intl.DateTimeFormat('en-US', { timeZone: 'America/New_York', weekday: 'short', hour: '2-digit', minute: '2-digit', hourCycle: 'h23' });
export function spotRollover(t) {
  const p = Object.fromEntries(nyMin.formatToParts(new Date(t * 1000)).map((x) => [x.type, x.value]));
  return ['Mon', 'Tue', 'Wed', 'Thu'].includes(p.weekday) && +p.hour % 24 === 17 && +p.minute < 15;
}
// a gold / forex candle that must not fill or stop a trade: spot shut, or the rollover minutes
export const spotSkip = (t) => spotClosed(t) || spotRollover(t);

// ─── the Trader's "Manage open trades" step for ONE candle, as a pure function (gold fidelity, 8 Nov) ───
// council/trader.mjs manages every paper trade with the loop under "Manage open trades"; replayBar / manageVariant below cover the
// engine setups (stop, target, break-even) but none of what the gold systems carry: a trailing stop (trail [fromR, behindR]), a
// per-trade break-even (beAt), a time exit (maxHold) and a pyramid add (addAt / addSize). manageLive is that loop body for one
// candle, so a research replay of the gold systems (research/edge/gold-fidelity/run.mjs) fills and exits as the live Trader does;
// tests/fills-live.test.mjs runs the Trader's own loop text against it. The caller skips spotSkip candles for gold / forex, applies
// the forex settle rule, expires resting orders on its run clock (expireOrder) and sizes R once closed (sizeR).
// Returns null, 'exit' (closed on this candle: win / loss / be / missed) or { add } (the second unit the Trader would push; the
// caller keeps one per trade, by id). be = config.be (the Coach's break-even; noBe trades ignore it); feed = the round's feed tag,
// stamped on the add as the Trader does. The entry is read in the candle feed's frame (E = entry + feedBasis, council/feed.mjs).
export function manageLive(tr, b, { be = null, feed = undefined } = {}) {
  const s = tr.side === 'sell', E = tr.entry + (tr.feedBasis || 0);
  if (tr.status === 'pending') {
    if (s ? b.high >= tr.entry : b.low <= tr.entry) {
      if (fillBarAmbiguous(b, s, tr.entry, tr.stop, tr.t1)) { tr.status = 'missed'; tr.closed = b.time; tr.R = 0; tr.exit = 'fill and target in one candle'; return 'exit'; }
      tr.status = 'open'; tr.filled = b.time; }
    else if (s ? b.low <= tr.t1 : b.high >= tr.t1) { tr.status = 'missed'; tr.closed = b.time; tr.R = 0; return 'exit'; }
    else return null;
  }
  const r0 = tr.r0 || (tr.r0 = Math.abs(E - tr.stop));
  if (s ? b.high >= tr.stop : b.low <= tr.stop) {
    const px = stopFill(b, s, tr.stop, b.time > tr.filled), gapped = px !== tr.stop;
    if (tr.trail && tr.trailMoved) { tr.R = exitR(s, E, px, r0); tr.status = tr.R > 0 ? 'win' : tr.R < 0 ? 'loss' : 'be'; tr.exit = 'trailing stop'; }
    else if (tr.beMoved) { tr.R = exitR(s, E, px, r0); tr.status = tr.R < 0 ? 'loss' : 'be'; } else { tr.status = 'loss'; tr.R = gapped ? exitR(s, E, px, r0) : -1; }
    if (gapped) tr.gapR = +((s ? px - tr.stop : tr.stop - px) / r0).toFixed(2);
    tr.exitPx = px; tr.exitKind = 'stop'; tr.closed = b.time; return 'exit';
  }
  if (s ? b.low <= tr.t1 : b.high >= tr.t1) { tr.status = 'win'; tr.closed = b.time; tr.R = tr.rr; tr.exitPx = tr.t1; tr.exitKind = 'target'; return 'exit'; }
  if (tr.maxHold && b.time >= tr.filled + tr.maxHold) { const R = +((s ? E - b.close : b.close - E) / r0).toFixed(2); tr.status = R > 0 ? 'win' : R < 0 ? 'loss' : 'be'; tr.R = R; tr.closed = b.time; tr.exit = `${tr.maxHold / 3600} h`; tr.exitPx = b.close; tr.exitKind = 'time'; return 'exit'; }
  tr.mfe = +Math.max(tr.mfe || 0, ((s ? E - b.low : b.high - E) / r0)).toFixed(2);
  tr.mae = +Math.max(tr.mae || 0, ((s ? b.high - E : E - b.low) / r0)).toFixed(2);
  if (tr.trail && tr.mfe >= tr.trail[0]) { const ns = E + (s ? -1 : 1) * (tr.mfe - tr.trail[1]) * r0; if (s ? ns < tr.stop : ns > tr.stop) { tr.stop = +ns.toFixed(Math.max(2, (tr.dec ?? 2) + 1)); tr.trailMoved = true; } }
  if (be && !tr.noBe && !tr.beMoved && (s ? E < tr.stop : E > tr.stop) && ((s ? E - b.low : b.high - E) / r0) >= be) { tr.stop = E; tr.beMoved = true; }
  if (tr.beAt && !tr.beMoved && (s ? E < tr.stop : E > tr.stop) && ((s ? E - b.low : b.high - E) / r0) >= tr.beAt) { tr.stop = E; tr.beMoved = true; }
  if (tr.addAt && !tr.addDone && tr.status === 'open' && tr.mfe >= tr.addAt) { tr.addDone = true; const add = addUnit(tr, b, feed); if (add) return { add }; }
  return null;
}
// the pyramid add the Trader pushes at +addAt R (gold replica gold-add, Mosha mosha-add): a second unit at the +addAt level with the
// stop at the first entry (in the feed's frame), the parent's target and its trail re-expressed in the add's own R; size = addAt x the
// parent's size so the add's addAt-R-wide stop counts as that much account risk; a shadow parent's add is a shadow too (its system is
// not ours), carrying the parent's blockers or 'owner-shadow'
export function addUnit(tr, b, feed = undefined) {
  const s = tr.side === 'sell', E = tr.entry + (tr.feedBasis || 0), r0 = tr.r0 || Math.abs(E - tr.stop), dp = Math.max(2, (tr.dec ?? 2) + 1), dir = s ? -1 : 1;
  const ae = +(E + dir * tr.addAt * r0).toFixed(dp), rA = Math.abs(ae - E);
  if (!(rA > 0)) return null;
  return { id: `${tr.id}-add`, market: tr.market, label: tr.label, dec: tr.dec, k: tr.k, name: `${tr.name} add`, pair: tr.pair, h: tr.h, side: tr.side,
    entry: ae, stop: E, t1: tr.t1, rr: +(Math.abs(tr.t1 - ae) / rA).toFixed(2), trail: tr.trail ? [+((tr.trail[0] - tr.addAt) / tr.addAt).toFixed(3), +(tr.trail[1] / tr.addAt).toFixed(3)] : undefined,
    size: +(tr.addAt * (tr.size || 1)).toFixed(2), buf: tr.buf, opened: b.time, filled: b.time, checked: b.time, status: 'open', R: null, r0: rA, maxHold: Math.max(300, (tr.filled + (tr.maxHold || 48 * 3600)) - b.time), noBe: true, entryMode: 'market', addOf: tr.id, shadow: !!tr.shadow, blockedBy: tr.shadow ? (Array.isArray(tr.blockedBy) && tr.blockedBy.length ? tr.blockedBy.slice() : ['owner-shadow']) : [],
    feed };
}
// a resting order expires on the Trader's run clock: validFor, else the WAIT of its timeframe, else a day
export function expireOrder(tr, now, wait = 86400) {
  if (tr.status === 'pending' && now - tr.opened > (tr.validFor || wait || 86400)) { tr.status = 'expired'; tr.closed = now; tr.R = 0; return true; }
  return false;
}
// half- and double-size trades: the score counts R x size once; rawR keeps the per-unit result
export function sizeR(tr) { if (tr.size && tr.size !== 1 && tr.R != null && tr.rawR == null) { tr.rawR = tr.R; tr.R = +(tr.R * tr.size).toFixed(2); } return tr; }

// ─── the replay's trade step (council/backtest.mjs), on the same rules as the Trader's "Manage open trades" ───
// The Backtest manages each trade on 1m candles under several exit variants at once (v: none / be1 / be15 / tp2 and the paper
// pt1); these two functions are that management, built on the helpers above so a replayed trade fills and exits as a live one:
// a stop gapped through fills at the candle's open (first, break-even and trailing stops alike), a limit fill + target in one
// candle with an unknown order is missed (0R), and a candle while spot is shut fills, stops and targets nothing.
// One exit variant v of trade tr on candle b. A gapped stop records v.gapR (R lost beyond the stop).
export function manageVariant(v, tr, b) {
  if (v.done) return;
  const s = tr.side === 'sell', sg = s ? -1 : 1, r0 = tr.r0, hitStop = s ? b.high >= v.stop : b.low <= v.stop;
  const stopOut = () => { const px = stopFill(b, s, v.stop, b.time > tr.filled); v.done = true; v.closed = b.time; if (px !== v.stop) v.gapR = +(sg * (v.stop - px) / r0).toFixed(2); return px; };
  if (v.pt) {   // partial: stop first, then the partial at +pt.at R, then the 10R cap; the stop moves after the candle's checks
    const fav = (s ? tr.entry - b.low : b.high - tr.entry) / r0, cap = tr.entry + sg * 10 * r0;
    if (hitStop) { const px = stopOut(); v.R = v.booked + v.size * (px - tr.entry) * sg / r0; return; }
    if (v.size === 1 && fav >= v.pt.at) { v.booked = 0.5 * v.pt.at; v.size = 0.5; }
    if (s ? b.low <= cap : b.high >= cap) { v.done = true; v.R = v.booked + v.size * 10; v.closed = b.time; return; }
    v.best = Math.max(v.best, fav);
    if (v.size < 1) { const ns = tr.entry + sg * Math.max(0, v.best - v.pt.trail) * r0; if ((ns - v.stop) * sg > 0) v.stop = ns; }
    return;
  }
  // the Trader: the first stop books -1R, a break-even stop 0R, and a stop filled at a gapped open the R at that open
  if (hitStop) { const px = stopOut(); v.R = px !== v.stop ? exitR(s, tr.entry, px, r0) : v.beMoved ? 0 : -1; return; }
  const tgt = v.t2 && tr.t2 != null ? tr.t2 : tr.t1;
  if (s ? b.low <= tgt : b.high >= tgt) { v.done = true; v.R = tgt === tr.t1 ? tr.rr : Math.abs(tgt - tr.entry) / r0; v.closed = b.time; return; }
  if (v.be && !v.beMoved && ((s ? tr.entry - b.low : b.high - tr.entry) / r0) >= v.be) { v.stop = tr.entry; v.beMoved = true; }
}
// One replay trade on candle b. tr: side, entry, stop, t1, rr, r0, opened, status ('pending' | 'open' | 'closed' with the paper
// pt1 still running), mfe, v (exit variants). shut: spotClosed(b.time) for gold / forex (never for crypto); a resting order still
// expires once b is more than wait seconds after the signal. Statuses it sets: 'open' (filled, tr.filled), 'missed' (target
// first, or fill and target in one candle: tr.fillTarget), 'expired', 'closed' (every variant but the paper ones done).
export function replayBar(tr, b, { shut = false, wait = 86400 } = {}) {
  const s = tr.side === 'sell';
  if (tr.status === 'pending') {
    if (b.time < tr.opened) return;
    if (!shut && (s ? b.high >= tr.entry : b.low <= tr.entry)) {
      if (fillBarAmbiguous(b, s, tr.entry, tr.stop, tr.t1)) { tr.status = 'missed'; tr.fillTarget = true; return; }
      tr.status = 'open'; tr.filled = b.time;
    } else if (!shut && (s ? b.low <= tr.t1 : b.high >= tr.t1)) { tr.status = 'missed'; return; }
    else { if (b.time - tr.opened > wait) tr.status = 'expired'; return; }
  }
  if (shut) return;
  // closed by the replay's own variants while the paper pt1 exit still runs: keep managing pt1 only (status, MFE and the
  // signal checks treat the trade as closed)
  if (tr.status === 'closed') { for (const v of tr.v) manageVariant(v, tr, b); return; }
  if (tr.status !== 'open') return;
  tr.mfe = Math.max(tr.mfe, (s ? tr.entry - b.low : b.high - tr.entry) / tr.r0);
  for (const v of tr.v) manageVariant(v, tr, b);
  if (tr.v.every((v) => v.done || v.pt)) tr.status = 'closed';
}
