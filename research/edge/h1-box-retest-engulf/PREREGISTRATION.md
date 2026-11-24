# H1 box break, retest of the broken edge, M15 engulf with the break: pre-registration (24 Nov 2026)

Written and committed alone BEFORE `run.mjs` exists or any trade is computed. Research only: nothing live changes, no rule is
proposed, no order code is touched. One of twenty one-combination studies run the same day.

## Why

The desks and the earlier studies read a box break, a retest and an engulf separately. Already tested, all FAIL after costs:
`box-zone` (a turned Daily box as a zone, H4 boxes for the entry), `box-touch-trend` (a limit at the edge of an M15 / M5 swing
box), `gold-box-breakout` (a five-day box on gold), `grid6-eg-box-market` (Daily / H4 engulf zones with a swing-box close-out
below), `grid6-box-in-box`, `fade-breaks-holdout` (the fade of an M5 box break), `vb-retest-limit` (a limit at the retest of the
daily breakout level). None of them tests this chain: an H1 box that follows price (edgekit `boxesClose`) breaking by a close,
THEN a retest of the broken edge, THEN an M15 engulf with the break as the entry. That is the assigned combination and it is
untested, so it is tested as assigned.

## Data

OANDA mid 5-minute candles of the shared cache (`research/edge/_lib/edgekit.mjs` `load`), read only, no network. Markets: xau,
eurusd, gbpusd, usdjpy, audusd, pooled (gold's cache starts in 2006). H1 and M15 candles are UTC-aligned buckets of the 5-minute
candles (`resample`). Costs: the toolkit's round trips (`research/edge/combo-grid-2/run.mjs` `COSTS`: gold 0.30, EUR/USD 0.00006,
GBP/USD 0.00008, USD/JPY 0.008, AUD/USD 0.00006), the same for every year.

Windows, by the time of the fill: discovery 2005-01-01 to 2014-12-31, confirmation 2015-01-01 to 2026-10-31.

## The rule (closed candles only)

1. **Box** (H1): `boxesClose` on the H1 candles. A box starts at the candle that broke the box before it and takes the high and
   low of every H1 candle until one CLOSES above its high (break up) or below its low (break down). Only broken boxes are used;
   the box's high, low and height are fixed at that close. Box length = the number of H1 candles in it (the breaking candle
   not counted).
2. **Retest** (M15): from the first M15 candle that starts at or after the breaking H1 candle's close, the first M15 candle
   that trades back to the broken edge (break up: its low is at or below the box high; break down: its high is at or above
   the box low). It must come within 96 M15 candles of the break, else no trade. An M15 candle that CLOSES beyond the box's
   far side (break up: below the box low) before the entry ends the setup (that candle cannot be the entry).
3. **Engulf** (M15): the first M15 candle, from the retest candle itself to the 12th M15 candle after it, that completes an
   engulf WITH the break by `council/eg-methods.mjs` `engulfAt(C, i, span)`: a candle of the break's colour that closes beyond
   the high (break up) or low (break down) of the base = the last candle of the other colour at most `span` candles before
   it. The base may lie before the retest. No such candle in that stretch: no trade. One trade a box at most; boxes are
   independent of each other (trades of different boxes may overlap).
4. **Entry**: market at the open of the first 5-minute candle that starts at or after the engulf candle's close.
5. **Stop**: past the engulf zone: the lowest low (break up; the highest high for a break down) of the M15 candles from the
   base to the completing candle, minus (plus) one round-trip cost of the market. The stop is always on the losing side of the
   fill; a fill at or past the stop, or a risk not larger than the round-trip cost, is no trade.
6. **Target** (the cell): `1R` = one risk from the fill; `box` = the box height projected from the broken edge (break up: box
   high + height). A `box` target not beyond the fill is no trade in that cell.
7. **Exit**: stop or target on the 5-minute candles after the fill candle's open (the fill candle counts); a candle that holds
   both is a stop; a candle that opens past the stop or target exits at its open; otherwise out at the close of the first
   5-minute candle that closes 48 hours or more after the fill. Trades still open at the end of the data are dropped.

## Cells (8, all fixed here)

box length (`len3`: 3 or more H1 candles; `len8`: 8 or more) x engulf span (`eg3`: the base at most 3 candles back, the
desks' definition; `eg1`: the candle right before) x target (`1R`, `box`).

Names: `len3 eg3 1R`, `len3 eg3 box`, `len3 eg1 1R`, `len3 eg1 box`, `len8 eg3 1R`, `len8 eg3 box`, `len8 eg1 1R`, `len8 eg1 box`.

## Statistics and the pass bar

R a trade before costs and after costs (after = R minus cost / risk) for every cell in both windows. t = the t of the
calendar-month sums of R (month of the fill; every month from the window's first to last trade month, empty months as 0).
p = two-sided Student p of the after-cost month t in confirmation, set to 1 when the mean is not above zero; Holm over the 8 cells.

A cell PASSES only with all of: n >= 300 in each window; mean R AFTER costs > 0 with month t >= 2 in BOTH windows; Holm p <
0.05 in confirmation. Verdict: PASS if any cell passes; INCONCLUSIVE if no cell has n >= 300 in both windows; else FAIL.

## Reported

Every cell: n, win share, R before and after costs, month t before and after costs, in both windows; the Holm p; the mean
cost / risk and the median planned reward of the `box` target in R; per market (context only, no verdict) for the best cell;
how many boxes reached each step (broken, long enough, retested, engulfed, traded). One run, no variants after the result.
A PASS would be a hypothesis for a holdout test, never an edge by itself.
