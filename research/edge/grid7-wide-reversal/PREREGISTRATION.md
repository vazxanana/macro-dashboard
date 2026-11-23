# Wide reversal grid: reversal patterns at Daily key levels, ten markets (pre-registration, 23 Nov 2026)

Written and pushed alone BEFORE any run. Research only: nothing live reads it, nothing is placed, no rule is proposed.

## Why

The thousand-cell grids on five markets kept landing at chance (`grid6-qm-keylevel`, `grid6-msnr-ef-market`). The wide design of
`grid7-wide-core` (few cells fixed in advance, ten markets, 2005-14 discovery / 2015-26 confirmation) has the power to see a real
tilt of a few hundredths of an R. This study gives the owner's REVERSAL patterns at a Daily key level that test: **48 cells under
test**, each against its own control.

## Data

- OANDA mid 5-minute candles, the shared cache (`research/edge/_lib/edgekit.mjs`, filled by `_lib/fetch-cache.mjs`, `EDGE_DATA`
  on the machine that runs it), loaded from 2004-01-01 for warm-up.
- Markets (10): xau, xag, eurusd, gbpusd, usdjpy, audusd, nzdusd, usdcad, usdchf, eurjpy (gold and silver from where OANDA's
  history starts).
- Timeframes from the 5-minute candles with `combo-grid-3`'s `frames` (imported): 15m and 1h (UTC buckets), 1d (17:00 New York
  trading days, `dailyNY`), 1w (weeks of those days).
- Exclusions: `combo-grid-2`'s `exclusions(market)` (the data-quality audit's bad intervals); a trade whose fill falls in one is
  dropped.
- Windows by the fill time: **discovery 2005-01-01 to 2014-12-31** (120 months), **confirmation 2015-01-01 to 2026-10-31**
  (142 months). Month sums count every calendar month of the window, an empty month as 0.

## Daily key levels (closed candles only)

Each family gives zones `{ side, bottom, top, known-at, end }`; a zone serves from the close of the candle that completes it until
its end (a Daily close through its far side, or its life). All imported, none edited.

- **eg**: Daily engulf zone, `combo-grid-3` `buildZones('eg', 1d)` (the base candle of a close beyond it within 3 candles, the
  repository's `engulfAt` rule), 120 Daily candles of life.
- **dom**: Daily dominant zone, `buildZones('dom', 1d)` (two same-colour candles, the second closing beyond the first's extreme;
  the zone is the first candle's body).
- **av**: Daily V / A turn of the closes, `buildZones('av', 1d)` (a close lower / higher than the 2 closes either side; buy zone
  low to close, sell zone close to high).
- **pw**: the previous week's high (a sell level) and low (a buy level), `grid6-qm-keylevel` `prevHL(1w)`: known at the week's
  close, alive for the whole next week, a line (bottom = top).

**First touch only**: the first candle of the pattern timeframe T, starting at or after the zone is known and before its end,
that trades into `[bottom, top]` (candle k0). Only that visit counts. The zone's side is the trade side: a buy zone is a level
price falls into, so the reversal is a buy (against the move into the level); a sell zone mirrors.

## Patterns (timeframe T = 1h or 15m), closed candles only

Within the 24 T candles from k0 (inclusive) and closing before the zone's end, the FIRST of each pattern with the zone's side:

1. **qm**: a QM (`edgekit.qms(T, 2)`: a new extreme beyond the shoulder, then a close beyond the swing before it) whose head is at
   or after k0 (the new extreme is made at the level). Signal = the QM break candle.
2. **ef**: a failed engulf of the move's side: an engulf zone on T (`combo-grid-3` `egZones(T, 3)`) of the OTHER side (a sell
   engulf while price falls into a buy level), completed at or after k0, whose zone is closed through on its far side within 6 T
   candles of its completion. Signal = that closing candle.
3. **ctl (control)**: the first plain structure break with the zone's side (`edgekit.structure(T, 2)`, BO or ChoCh) at or after
   k0. Not judged; it is each cell's comparison.

## Trade

- Entry: market, at the open of the first 5-minute candle starting at or after the signal candle's close.
- Stop: past the extreme made at the level (the lowest low from k0 to the signal candle for a buy, the highest high for a sell)
  by 0.1 x ATR(14) of T at the signal candle. Every trade has its stop on the losing side of the fill; a fill at or past the
  stop is no trade; a trade whose risk is under the market's round trip is no trade (same for every cell).
- Exits (three): **1R**; **2R**; **mm** (measured move): the distance from the extreme made at the level to the pattern's trigger
  level (qm: the broken swing; ef: the failed engulf zone's far side; ctl: the broken swing), projected 1:1 beyond that trigger
  level, taken only when that target is 1R or more from the fill (a trade with a nearer target is not in the mm cell). Else the
  stop, or the close of the 5-minute candle that reaches the time limit (2 days for 1h patterns, 1 day for 15m). A 5-minute
  candle that opens past the stop or a target exits at its open; one that holds both is a stop.
- One trade per (market, family, T, pattern, signal candle, side): two zones met by one signal count once.
- R before costs; after costs = R - round trip / risk with `combo-grid-2`'s `COSTS` (the demo figures for xau, eurusd, gbpusd,
  usdjpy, audusd; **ASSUMED, not measured** for xag, nzdusd, usdcad, usdchf, eurjpy).

## Cells

Under test: 4 families (eg, dom, av, pw) x 2 patterns (qm, ef) x 2 T (1h, 15m) x 3 exits (1R, 2R, mm) = **48 cells**. Controls:
the same 4 x 2 x 3 with ctl = 24 cells, reported, never judged. Each cell pools the ten markets.

## The bar (judged BEFORE costs; after-cost figures shown beside)

A cell passes only if ALL hold:

1. n >= 300 trades in discovery AND in confirmation;
2. mean R a trade > 0 and month-sum t >= 2 in discovery AND in confirmation;
3. Holm over the 48 confirmation tests (one-sided p of the confirmation month-sum t, df = months - 1): adjusted p < 0.05;
4. it beats its own control (ctl, same family, T and exit): Welch t (trade R of the cell against trade R of the control) >= 2 in
   discovery AND in confirmation.

**Verdict**: PASS if at least one of the 48 cells passes; INCONCLUSIVE if none passes and fewer than 24 of the 48 cells reach
n >= 300 in both windows (too thin to judge); FAIL otherwise. Nothing is adopted from a pass: a passing cell would be a candidate
for its own forward record and an owner decision.

## Also reported

- Every cell (and control): n, mean R, month t in both windows, before and after costs; the Welch t against the control.
- The **side-flipped check** of every cell: the same signal and fill, the other side, the stop the same distance on the other
  side of the fill, the same R multiples as targets; judged by bars 1-3 (expected: about nothing passes).
- Per-market rows for any passing cell.
- A cut test: the signals of several markets computed on candles cut at a date equal the full run's signals known by that date.
- One run, no variants. Do not re-test variants of these cells on these years.
