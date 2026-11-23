# Wide core grid: few cells, ten markets, long windows (pre-registration, 23 Nov 2026)

Written and pushed alone BEFORE any run. Research only: nothing live reads it, nothing is placed, no rule is proposed.

## Why

The day's grids tested thousands of cells on five markets with a 2010-14 discovery window and kept landing at chance; the one
cell that confirmed failed its holdout (`research/edge/msnr-box-holdout`). This study turns that round: 96 cells, all fixed
below, ten markets, discovery 2005-2014 and confirmation 2015 to the end of October 2026. A real tilt of about +0.05R a trade on
the pooled ten markets would show with a month-sum t well above 2; chance has 96 tries, not thousands.

## Data

- OANDA mid 5-minute candles through the site's candle proxy, the shared cache (`research/edge/_lib/edgekit.mjs`,
  `fetch-cache.mjs`, `EDGE_DATA` on the machine that runs it), loaded from 2004-01-01 for warm-up.
- Markets (10): xau, xag, eurusd, gbpusd, usdjpy, audusd, nzdusd, usdcad, usdchf, eurjpy. Gold and silver start where OANDA's
  history starts (2005-2006); that is what the cache holds.
- Timeframes from the 5-minute candles with `combo-grid-3`'s `frames` (imported): 15m, 1h, 4h (UTC buckets), 1d (17:00 New York
  trading days, `dailyNY`), 1w.
- Exclusions: `combo-grid-2`'s `exclusions(market)` (the data-quality audit's bad intervals); a trade whose fill time falls in one
  is dropped.
- Windows by the fill time: **discovery 2005-01-01 to 2014-12-31** (120 months), **confirmation 2015-01-01 to 2026-10-31**
  (142 months). Month sums count every calendar month of the window, an empty month as 0.

## Key levels (on the level timeframe L = 1d or 4h, closed candles only)

Each family gives zones `{ side, bottom, top, known-at, end }`; a zone serves from the close of the candle that completes it
until its end (a close of L through its far side, or its life).

- **(a) eg**: engulf zone, `combo-grid-3` `buildZones('eg', L)` (the base candle of a close beyond it within 3 candles,
  `council/eg-methods.mjs` `engulfAt`), 120 L candles of life.
- **(b) ef**: an engulf zone that failed (an L close through its far side), traded the OTHER way, `buildZones('ef', L)`.
- **(c) dom**: dominant zone, `buildZones('dom', L)` (two same-colour candles, the second closing beyond the first's extreme;
  the zone is the first candle's body).
- **(d) av**: V / A turn of the closes, `buildZones('av', L)` (a close lower / higher than the 2 closes either side).
- **(e) sd**: fresh supply / demand, `grid5-sd-eg`'s `sdZones(L)` (imported): the base candle before a structure break.
- **(f) none**: the control. No level: every trigger event of (1) or (2) below on the trigger timeframe, anywhere, with its own
  side.

**First touch only**: for (a)-(e) the first trigger-timeframe candle starting at or after the zone is known that trades into
`[bottom, top]` is the touch (candle k0). Only that visit counts; if it gives no trigger, the zone gives no trade.

## Trigger (timeframe T two steps under L: 1d -> 1h, 4h -> 15m), closed candles only

Within the 24 T candles from the touch candle k0 (inclusive), and closing before the zone's end, the FIRST of:

- **(1) break**: a structure break (`edgekit.structure(T, 2)`, BO or ChoCh: a close beyond the last confirmed 2-a-side swing)
  in the zone's direction.
- **(2) box**: a box close-out (`edgekit.boxesHL(T, 2)`: the box between a 2-a-side swing low and swing high, ended by a close
  outside it) in the zone's direction.

## Trade

- Entry: market, at the open of the first 5-minute candle starting at or after the trigger candle's close.
- Stop: past the trigger's swing by 0.1 x ATR(14) of T at the trigger candle. Break: the lowest low (highest high for a sell)
  from the broken swing's candle to the break candle. Box: the box's low (high for a sell).
- Every trade has its stop on the losing side of the fill; a fill already at or past the stop is no trade. A trade whose risk is
  smaller than the market's round-trip cost is no trade (the same rule for every cell).
- Exits (two): a target at **1R** or **2R**, the stop, or the close of the 5-minute candle that reaches the time limit (2 days
  for 1d levels, 1 day for 4h levels). A 5-minute candle that opens past the stop or the target exits at its open; one that holds
  both is a stop.
- One trade per (market, trigger candle, side) within a cell (two zones met by the same trigger count once).
- R before costs; after costs = R - round trip / risk with `combo-grid-2`'s `COSTS` (the demo figures for xau, eurusd, gbpusd,
  usdjpy, audusd; **ASSUMED, not measured** for xag, nzdusd, usdcad, usdchf, eurjpy).

## Cells (96)

6 families x 2 level timeframes (1d, 4h) x 2 triggers (break, box) x 2 exits (1R, 2R) = 48, and the same 48 keeping only trades
where the **Daily MSNR call agrees** with the side: `council/eg-methods.mjs` `direction()` (imported) on the 1d candles with the
1w candles as the timeframe above (as `combo-grid-3`'s `msnrCalls` for 1d), the call of the last 1d candle closed at the trigger
candle's close equal to the trade's side. Each cell pools the ten markets.

## The bar (judged BEFORE costs; after-cost figures shown beside)

A cell passes only if ALL hold:

1. n >= 300 trades in discovery AND in confirmation;
2. mean R a trade > 0 and month-sum t >= 2 in discovery AND in confirmation;
3. Holm over all 96 confirmation tests (one-sided p of the confirmation month-sum t, df = months - 1): adjusted p < 0.05;
4. it beats its own family-(f) control at the same level timeframe, trigger, exit and MSNR condition: Welch t (trade R of the
   cell against trade R of the control) >= 2 in discovery AND in confirmation.

The (f) cells are the controls: they take part in Holm but cannot pass (they have no control of their own). Note: the control's
trades include the triggers that fall in zones, so the two sets overlap; the Welch t is the pre-registered test anyway.

**Verdict**: PASS if at least one (a)-(e) cell passes; FAIL if none does. Nothing is adopted from a pass: a passing cell would be a
candidate for its own forward record and owner decision.

## Also reported

- Every cell: n, mean R, month t in both windows, before and after costs; its control's figures and the Welch t.
- The **side-flipped placebo** of every cell: the same trigger candle and fill, the other side, the stop the same distance on
  the other side of the fill, the same exits. It is judged by the same bar 1-3 (expected: about nothing passes).
- Per-market rows for any passing cell.
- A cut test: the trades of several markets computed on candles cut at a date equal the full run's trades known by that date
  (side, trigger time, stop).
- One run, no variants. Do not re-test variants of these cells on these years.
