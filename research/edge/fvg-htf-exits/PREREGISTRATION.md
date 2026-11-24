# FVG return on H4 and D1 with larger targets and a time exit (pre-registration, 24 Nov 2026)

Written and pushed alone, before `run.mjs` exists and before any number of this study is seen. Research only: nothing live
changes, nothing is proposed by this document.

## Why

The Equinox "FVG return" desk trades `grid7-fvg-wide` cell `1h mkt large 1R`: +0.035R a trade before costs in 2015-26
(n 52,659, month t 7.27) but -0.113R after costs. In that grid the cell nearest to break-even after costs was `4h mkt large
2R` (-0.021R, n 16,891; discovery +0.005R). Costs are a fixed price amount, so a wider gap (H4, D1) and a larger target
(more R per winner, the same cost per trade in price) should cost less in R. This study asks, after costs, whether the
market return into a large H4 or D1 fair-value gap, with a 2R or 3R target or a plain time exit, is positive.
`gold-daily-fvg` (gold's D1 gap, first retest, limit, 2R; FAIL, 2017-26 +0.076R net, t 0.97) and `smc-ob-fvg` /
`smc-sweep-fvg` (H1 / M5 gaps, FAIL) are related but other rules (other entries, one market, H1).

## Rule (the grid7-fvg-wide code itself, imported, never edited)

- Gaps: `grid6-smc-market` `gapZones` through `grid7-fvg-wide` `bandsOf` (three-candle gap; height / ATR(14) of the gap
  timeframe at formation; one random control band per gap, as grid7). Gap timeframes:
  - **H4** = `grid7-fvg-wide` `frames` (UTC 4-hour buckets of the 5-minute candles).
  - **D1** = `edgekit` `dailyNY` (17:00 New York trading days, weekend candles folded into Monday). New in this study.
- Subset: **large** gaps only (height / ATR above the market's median of the discovery gaps of that timeframe, computed
  as grid7 does: from the real gaps formed 2005-2014). "All gaps" is reported beside, not tested.
- Entry: grid7's **mkt** entry, `eventsOf` kind 0: the first M15 close inside the gap (within LIFE 120 candles of the gap
  timeframe and before an M15 close beyond its far side), market at the next 5-minute open, WITH the gap. Stop past the
  gap's far side + 0.1 ATR(14) of the gap timeframe. A trade whose risk is under the round-trip cost is skipped (grid7).
- Exits, `dom-trade-through` `manage` (stop first in a candle, gaps through the stop or target fill at the open):
  - **2R**: target 2R, else out at the close of the time limit.
  - **3R**: target 3R, else out at the close of the time limit.
  - **time**: no target; the original stop or the close of the time limit (`manage` slot 8).
  - Time limits: **H4 5 days** (grid7's), **D1 20 days** (fixed here before any run).
- Data-quality exclusions: `combo-grid-2` `exclusions` (grid7's). Many trades may be open at once (grid7 counted every signal).

## Markets, windows, costs

grid7's ten: xau, xag, eurusd, gbpusd, usdjpy, audusd, nzdusd, usdcad, usdchf, eurjpy; OANDA mid 5-minute candles from the
`edgekit` cache. Windows as grid7 (so the H4 2R cell can be checked against it): **discovery** = fills 2005-01-01 to
2014-12-31 (120 months), **confirmation** = fills 2015-01-01 to 2026-10-31 (142 months). Said plainly: grid7 already read
these years for H4 with 1R and 2R; the H4 3R / time cells and every D1 cell are new.
Costs: `combo-grid-2` `COSTS` round trip in price, in R = cost / risk per trade; the demo figures for gold and the four
majors, **ASSUMED, not measured** for xag, nzdusd, usdcad, usdchf, eurjpy.

## Tests (six, judged AFTER costs)

T1 H4 large 2R, T2 H4 large 3R, T3 H4 large time, T4 D1 large 2R, T5 D1 large 3R, T6 D1 large time.

A test passes only if ALL hold:
1. n >= 200 trades in each window;
2. mean R after costs > 0 in discovery AND in confirmation;
3. month-sum t of R after costs >= 2 in confirmation (sum of net R of the trades filled in each calendar month, all ten
   markets pooled);
4. Holm-adjusted one-sided p (of that confirmation month t, df = months - 1) < 0.05 over the six tests;
5. control: in confirmation the real trades beat their random control bands (grid7's: same height, side and distance from
   price, formed 24-240 candles earlier, through the same entry and exits) by Welch t >= 2 on R after costs.

Verdict: PASS if at least one test passes, else FAIL. A stream positive before costs and negative after is a before-cost
tilt, not an edge.

## Gate and checks

- Gate: T1 before costs must reproduce grid7's `4h mkt large 2R` (n 13,897 / 16,891; +0.069R / +0.053R). If it does not,
  the run is a harness error and nothing is judged.
- No look-ahead: the signals known by five cut dates, computed on candles cut there, equal the full run's (grid7's cut test,
  run for xau and eurusd on both timeframes).
- Reported only: 1R, 4R, 6R and the trailing slot of `manage`, "all gaps", per market, buys / sells.

One run, no variants. Whatever the result, nothing live changes.
