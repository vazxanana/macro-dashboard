// Realistic execution-cost models shared by every script in research/edge/costs/.
//
// No bid/ask history exists in the repo's data: HistData M1 files are BID only, OANDA bars via meridianx.dev are MID
// only (api/bars.js asks price 'M'), Dukascopy idx files are one side, CNBC futures are last-trade. So spread LEVELS come
// from published broker figures (typical/average, not minimum) and the hour-of-day SHAPE from the well-known retail
// liquidity cycle anchored on the New York 17:00 rollover (FX/metals daily break). Every number is in one table below so a
// reader can change it and rerun.
//
// Units: price units of the instrument. "spread" = full bid/ask spread; one spread is paid per round trip.
// "comm" = round-trip commission in price units. "slipM" = adverse slippage on a market entry, "slipS" on a stop fill.

// Pip value per 100k in USD (for converting a $7 / lot round-trip ECN commission into pips); rough 2024-26 levels.
const PIPUSD = { EURUSD: 10, GBPUSD: 10, AUDUSD: 10, USDCAD: 7.3, USDCHF: 11.5, USDJPY: 6.7 };
const PIP = { EURUSD: 1e-4, GBPUSD: 1e-4, AUDUSD: 1e-4, USDCAD: 1e-4, USDCHF: 1e-4, USDJPY: 1e-2 };

// Published typical spreads (normal London/NY hours). raw = IC Markets Raw Spread (avg spreads published on its site,
// + $3.50 per side per 100k commission); oanda = OANDA standard spread-only account (published average spreads).
// Gold: raw ~0.12-0.16 USD avg + $7/lot (100 oz) = 0.07; OANDA gold ~0.35-0.55 at 2025-26 prices.
export const LEVEL = {
  //            raw spread (pips/usd) | oanda spread | slip market | slip stop  (pips for FX, USD for gold)
  EURUSD: { raw: 0.15, oanda: 1.2, slipM: 0.1, slipS: 0.2 },
  GBPUSD: { raw: 0.35, oanda: 1.8, slipM: 0.15, slipS: 0.3 },
  AUDUSD: { raw: 0.25, oanda: 1.4, slipM: 0.1, slipS: 0.2 },
  USDCAD: { raw: 0.35, oanda: 2.0, slipM: 0.15, slipS: 0.3 },
  USDCHF: { raw: 0.35, oanda: 1.8, slipM: 0.15, slipS: 0.3 },
  USDJPY: { raw: 0.20, oanda: 1.3, slipM: 0.1, slipS: 0.2 },
  XAUUSD: { raw: 0.14, oanda: 0.45, slipM: 0.05, slipS: 0.10, commRaw: 0.07 },
};

// Session multiplier on the spread (not on commission), keyed by New York local hour (DST-aware), because the FX/metals
// day breaks at 17:00 New York: 17:00-18:00 NY = rollover / gold maintenance break, spreads 3-10x; 18:00-20:00 NY =
// thin early Asia; 20:00-03:00 NY = Asia (EUR/GBP/CHF/CAD ~1.4x, AUD/JPY ~1.15x); 03:00-12:00 NY = London + overlap 1.0;
// 12:00-17:00 NY = New York afternoon 1.25x (liquidity drains after the London close).
export function sessMult(sym, nyHour) {
  const asiaLocal = sym === 'AUDUSD' || sym === 'USDJPY';
  if (nyHour === 17) return 5.0;
  if (nyHour === 18 || nyHour === 19) return 2.2;
  if (nyHour >= 20 || nyHour < 3) return asiaLocal ? 1.15 : (sym === 'XAUUSD' ? 1.3 : 1.45);
  if (nyHour < 12) return 1.0;
  return 1.25;
}

// US DST: second Sunday of March 02:00 local to first Sunday of November 02:00 local
const dstCache = new Map();
function dstBounds(y) {
  if (dstCache.has(y)) return dstCache.get(y);
  const mar1 = new Date(Date.UTC(y, 2, 1)).getUTCDay(), nov1 = new Date(Date.UTC(y, 10, 1)).getUTCDay();
  const marSun = 1 + ((7 - mar1) % 7) + 7, novSun = 1 + ((7 - nov1) % 7);
  const v = [Date.UTC(y, 2, marSun, 7) / 1000, Date.UTC(y, 10, novSun, 6) / 1000];   // 02:00 EST = 07:00 UTC; 02:00 EDT = 06:00 UTC
  dstCache.set(y, v); return v;
}
export const nyOffset = (tUtc) => { const y = new Date(tUtc * 1000).getUTCFullYear(), [a, b] = dstBounds(y); return tUtc >= a && tUtc < b ? 4 : 5; };
export const nyHour = (tUtc) => (new Date(tUtc * 1000).getUTCHours() - nyOffset(tUtc) + 24) % 24;
// HistData stamps convert with council/histdata.mjs `histToUtc` (load.mjs; 10 Nov 2026: not New York time in the weeks the US and
// Europe switch apart)

// Account presets → per-trade cost function. Returns { spread, comm, slipM, slipS } in price units at time t.
export function model(sym, account) {
  const L = LEVEL[sym]; if (!L) throw new Error('no cost level for ' + sym);
  const unit = sym === 'XAUUSD' ? 1 : PIP[sym];
  const comm = account === 'raw' ? (sym === 'XAUUSD' ? L.commRaw : 7 / PIPUSD[sym] * unit) : 0;
  const base = (account === 'raw' ? L.raw : L.oanda) * unit;
  return (t) => ({ spread: base * sessMult(sym, nyHour(t)), comm, slipM: L.slipM * unit, slipS: L.slipS * unit });
}
// typical all-in round trip (spread + commission + market-entry slip), London hours, price units
export function allIn(sym, account) { const f = model(sym, account), c = f(Date.UTC(2025, 0, 15, 10) / 1000); return c.spread + c.comm + c.slipM; }

// CME micro futures (ICT desk). Retail all-in commission incl. exchange/NFA fees ~ $0.62 per side ($1.24 round trip);
// spread 1 tick (crossed once per round trip), slippage 1 tick on market entries and stops.
export const FUT = {
  NQ: { micro: 'MNQ', tick: 0.25, usdPerPt: 2 }, ES: { micro: 'MES', tick: 0.25, usdPerPt: 5 },
  YM: { micro: 'MYM', tick: 1, usdPerPt: 0.5 }, RTY: { micro: 'M2K', tick: 0.1, usdPerPt: 5 },
  GC: { micro: 'MGC', tick: 0.1, usdPerPt: 10 },
};
export function futCost(short, { commRT = 1.24, slipTicks = 1, spreadTicks = 1, stopSlipTicks = 1 } = {}) {
  const F = FUT[short]; return { spread: spreadTicks * F.tick, comm: commRT / F.usdPerPt, slipM: slipTicks * F.tick, slipS: stopSlipTicks * F.tick, tick: F.tick };
}

// stats block used in every result: {n, wr, exp, R, maxDD, t}
export function stats(R) {
  const n = R.length; if (!n) return { n: 0, wr: null, exp: null, R: 0, maxDD: 0, t: null, streak: 0 };
  let s = 0, w = 0, eq = 0, pk = 0, dd = 0, run = 0, worst = 0;
  for (const r of R) { s += r; if (r > 0) w++; eq += r; pk = Math.max(pk, eq); dd = Math.min(dd, eq - pk); if (r < 0) { run++; worst = Math.max(worst, run); } else if (r > 0) run = 0; }
  const m = s / n, sd = Math.sqrt(R.reduce((a, r) => a + (r - m) ** 2, 0) / Math.max(1, n - 1));
  return { n, wr: +(w / n).toFixed(3), exp: +m.toFixed(3), R: +s.toFixed(1), maxDD: +dd.toFixed(1), t: sd > 0 ? +(m / (sd / Math.sqrt(n))).toFixed(2) : null, streak: worst };
}
