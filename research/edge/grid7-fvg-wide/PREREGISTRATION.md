# Wide fair-value-gap grid: 54 cells on ten markets (pre-registration, 23 Nov 2026)

Written and pushed alone BEFORE any run. Research only: nothing live reads it, nothing is placed, no rule is proposed.

## Why

The day's grids on five markets landed at chance; the wide design of `grid7-wide-core` (few cells fixed in advance, ten
markets, 2005 to 2026) is the template. Fair-value gaps were tested only inside larger grids (`grid6-smc-market`, `smc-ob-fvg`,
`smc-sweep-fvg`). This study asks the plain questions on their own: does price react to a gap when it comes back to it, and
does a gap that is closed through (an inverse gap) mean anything, judged against random bands of the same height.

## Data

- OANDA mid 5-minute candles, the shared cache (`research/edge/_lib/edgekit.mjs`, `fetch-cache.mjs`), loaded from 2004-01-01.
- Markets (10): xau, xag, eurusd, gbpusd, usdjpy, audusd, nzdusd, usdcad, usdchf, eurjpy.
- Timeframes from the 5-minute candles (`edgekit.resample`, UTC buckets): 15m, 1h, 4h.
- Exclusions: `combo-grid-2`'s `exclusions(market)`; a trade whose fill falls in one is dropped.
- Windows by fill time: **discovery 2005-01-01 to 2014-12-31** (120 months), **confirmation 2015-01-01 to 2026-10-31**
  (142 months). Month sums count every calendar month of the window, an empty month as 0.

## The gap (timeframe G = 15m, 1h or 4h; closed candles only)

A three-candle gap at G candle i: bullish when low(i) > high(i-2) (zone = high(i-2) to low(i)), bearish when high(i) < low(i-2)
(zone = high(i) to low(i-2)); `grid6-smc-market` `gapZones` (imported). Known at the close of candle i. Its life: until the first
M15 close through its far side (below the bottom for a bullish gap, above the top for a bearish one), or 120 G candles.

Labels (fixed per gap at its formation):
- **size**: gap height / ATR(14) of G at candle i, "large" when above the median of that ratio over the same market's gaps of
  G formed in the discovery window (one number per market and timeframe), else "small".
- **break**: the gap formed with a structure break when `edgekit.structure(G, 2)` has an event in the gap's direction at
  candle i-1 or i.

## Events (each at most once per gap)

- **(a) mkt**: the first M15 candle starting at or after the gap is known that CLOSES inside the zone, before any M15 close
  through its far side. Market entry with the gap's side at the open of the next 5-minute candle. Stop: the far side of the
  gap, 0.1 x ATR(14) of G (at candle i) further.
- **(a2) lim50**: a limit at the gap's middle with the gap's side, resting from the gap's formation until the gap's life ends.
  Filled only when a 5-minute candle trades THROUGH it by half the market's round trip (buy: low <= middle - cost / 2), at the
  better of the open and the middle; on the fill candle only the stop counts. Stop as (a).
- **(b) ifvg**: the first M15 close through the gap's far side within its life (an inverse gap): market entry AGAINST the
  gap's side at the next 5-minute open. Stop: past that M15 candle's extreme (its high for a sell), 0.1 x ATR(14) of M15 at
  that candle further.

## Control (c): random bands

For every real gap at G candle i, one control band: formed at G candle i' = i - k, k drawn uniformly from 24..240 (seeded
RNG, one stream per market and timeframe); the same height and side as the gap; its middle at the same distance from close(i')
as the gap's middle is from close(i), on the same side (below the close for a bullish gap). It carries the real gap's size and
break labels and the same life rules, and goes through the same events (a), (a2), (b) with the same stops (ATR at i'). A band
with i' < 20 is skipped.

## Trade

- Every trade has its stop on the losing side of its fill; a fill at or past the stop is no trade; a risk under the market's
  round trip is no trade.
- Exits: a target at **1R** or **2R**, the stop, or the close of the 5-minute candle that reaches the time limit (15m gaps
  1 day, 1h 2 days, 4h 5 days). A 5-minute candle that opens past the stop or target exits at its open; one that holds both is
  a stop. Management: `dom-trade-through` `manage` (imported).
- R before costs; after costs = R - round trip / risk with `combo-grid-2`'s `COSTS` (the demo figures for xau, eurusd, gbpusd,
  usdjpy, audusd; **ASSUMED, not measured** for xag, nzdusd, usdcad, usdchf, eurjpy).

## Cells (54)

3 gap timeframes (15m, 1h, 4h) x 3 entries (mkt, lim50, ifvg) x 3 subsets (all; large gaps only; gaps formed with a structure
break only) x 2 exits (1R, 2R) = 54. Each pools the ten markets. Each has its control: the (c) bands' trades of the same
timeframe, entry, subset label and exit.

## The bar (judged BEFORE costs; after-cost figures beside)

A cell passes only if ALL hold:
1. n >= 300 trades in discovery AND in confirmation;
2. mean R a trade > 0 and month-sum t >= 2 in discovery AND in confirmation;
3. Holm over all 54 confirmation tests (one-sided p of the confirmation month-sum t, df = months - 1): adjusted p < 0.05;
4. it beats its control: Welch t (trade R of the cell against trade R of its control) >= 2 in discovery AND in confirmation.

**Verdict**: PASS if at least one cell passes; FAIL if none does. Nothing is adopted from a pass: it would be a candidate for
its own holdout and forward record.

## Also reported

- Every cell: n, mean R, month t in both windows, before and after costs; its control's figures and the Welch t.
- The complements (small gaps, gaps without a break) as descriptive rows, not tested.
- The **side-flipped check** of every cell: the same fill, the other side, the stop the same distance on the other side, the
  same exits; judged by bars 1-3 (expected: about nothing passes).
- Per-market rows for any passing cell.
- A cut test: gaps and events computed on candles cut at several dates equal the full run's events known by those dates.
- One run, no variants. Do not re-test variants of these cells on these years.
