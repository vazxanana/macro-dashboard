# Pre-registration: the 2-day RSI pullback on US indices, out of the book's sample (13 Nov 2026)

Written and committed before any number of this study was computed. Paper research: nothing here is read by the council,
the mirror or the page, and no live rule changes whatever the verdict. Not an ICT study.

## The question
The short-term oversold pullback popularised in 2009 for US stock indices (buy when the 2-day RSI is under 10 while price is
above its 200-day average, sell on the first close above the 5-day average) is one of the most quoted daily mean-reversion
rules. Its book showed it on data up to 2008. Does it make money after costs on the years AFTER that sample, on the index
CFDs the council can read?

## Data
- OANDA mid daily candles, council-data `research/daily/<key>.json` (the council's weekly cache, `git show
  origin/council-data:…`, no network): `spx500` (SPX500_USD), `nas100` (NAS100_USD), `us30` (US30_USD). UTC-aligned daily
  candles; Saturday and Sunday candles (a handful of stubs) are dropped before anything is computed.
- **The close used is OANDA's daily candle close** (the price at 00:00 UTC, a few hours after the US cash close), not the
  exchange's official close. The 200-day SMA, the 5-day SMA, RSI(2) and ATR(20) are all on these candles.
- Financing benchmark: FRED `DGS2` (weekly, from council-data `macro/cache.json` `score.fred.DGS2`, as of the entry day: the
  last value dated on or before it).

## The rule (as written, no parameter chosen here)
- Signal on the close of day i: close(i) > SMA200(i) (200 closes up to and including i) AND Wilder RSI(2)(i) < 10.
  Wilder RSI: the first average gain / loss is the simple mean of the first 2 changes, then avg = (avg x 1 + change) / 2.
- **Fill at the NEXT day's open** (day i+1). Never at the signal close.
- Stop: entry - 3 x ATR(20), ATR (Wilder true range, simple 20-day mean) taken at the signal close i. Every trade has it from
  the fill. A day whose low reaches the stop exits at the stop, or at that day's open if it opened below it (gap). The entry
  day itself is checked.
- Exit: the first close (day j >= entry day) above SMA5(j) -> sell at day j+1's open. If the stop is hit on a day, that
  exit wins (it happened before the close).
- One position per market; a new signal while in a position is ignored; after an exit a later signal may enter again.
- A trade still open at the end of the data is closed at the last close and marked (`atEnd`).

## Costs (round trip, in index points, charged on every trade)
- Spread and slippage: SPX500 1.0, NAS100 3.0, US30 4.0 points a round trip (OANDA-like quoted spreads plus half a spread
  of slippage on each fill).
- Financing on the long: (DGS2 + 2.5 %) / 365 x entry price per night held. Nights = calendar days between the entry day
  and the exit day (a position held from Friday to Monday pays 3; a holiday pays its calendar nights). A trade closed on its
  entry day pays none.
- Net return per trade = (exit - entry - spread points - financing) / entry, in %. Also reported: R = the same in units of
  the initial risk (3 x ATR).

## Windows (by entry day)
- A: 2008-01-01 to 2015-12-31 (after the book's sample; reported).
- **B: 2016-01-01 to the end of the data (decisive).**

## Pass (each market, window B)
All of:
1. Net return per trade > 0.
2. t >= 2 on trades (mean / (sd / sqrt n)).
3. t >= 2 on calendar-month sums of net return (every month of the window counts, 0 where nothing closed; a trade's month
   is its exit month).
4. Beats the placebo: 40 seeds (1..40); for each seed, every real trade of window B is replaced by an entry at the next open
   after a day drawn at random from the window's days with close > SMA200, held for the same number of trading days
   (exit at that day's open), with the same 3 x ATR(20) stop and the same costs (placebo trades may overlap). The real mean
   net return per trade must exceed the 95th percentile of the 40 seed means.
5. Holm over the three markets at 5 %: p = one-sided normal p of the trade t, Holm step-down.

**Verdict**: PASS if at least one market meets all five; FAIL otherwise. Window A is reported beside it, and a PASS that
loses in window A is said so. A PASS leads to a paper-shadow proposal only (`research/proposals/2026-11-13-rsi2.md`); never
a live change. A FAIL needs no proposal.

## Not changed after seeing results
Parameters (10, 200, 5, 2, 3 x ATR20), costs, windows, the placebo design and the pass bar are fixed by this file. Anything
else looked at afterwards is labelled as such and is not evidence.
