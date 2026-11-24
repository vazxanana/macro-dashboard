# The MSNR switch with complements from the other studies: pick on old years, judge on untouched markets (pre-registration, 24 Nov 2026)

Written and pushed alone BEFORE any run. Research only: nothing live reads it, nothing is placed, no rule is proposed.

## Why

`msnr-switch-fade` (23 Nov 2026) was INCONCLUSIVE: 0 of 42 cells passed. Its best cell faded the first H1-ladder pullback after a
switch with a key-level target, +0.291R a trade before costs in 2015-26 (month t 3.72), but it did not beat the same fade under
an old call, and it lost after costs (-0.197R): costs took about half of 1R a trade, because the swing stops on M5 / M15 are a
few pips. Two things were missing, both named by earlier studies:

1. **Stop size against the spread.** Every before-cost tilt of the fade grids died after costs for the same reason
   (`grid7-wide-fade`: the tilt is largest where the stop is smallest). A stop sized on the WORKING chart's ATR makes the
   round trip a much smaller share of 1R.
2. **Context from other studies**: the hours (`fade-conditions`, `fade-hour-check`: the fade lives mostly 20-23 UTC, near the
   daily roll, where quotes are least trustworthy, so the opposite filter, 07-20 UTC only, is the one a real fill would want),
   and the higher timeframe's structure (`fade-mtf-context`, `vb-structure-filter`: no help on their own triggers, untested
   on the switch).

The owner asked to improve the switch rules into something that holds after costs. This study does that honestly: a fixed
grid of complements, selection on the discovery years only, judged AFTER costs on eight markets no switch study has read.

## Data

- OANDA mid 5-minute candles from the shared cache (`research/edge/_lib/edgekit.mjs`), loaded from 2004-01-01 for warm-up.
- **Selection set (S)**: the ten markets of `msnr-switch-fade` (xau, xag, eurusd, gbpusd, usdjpy, audusd, nzdusd, usdcad,
  usdchf, eurjpy), fills **2005-01-01 to 2014-12-31** only.
- **Holdout H1 (primary)**: eight markets no MSNR switch study has read: nas100, spx500, de40, gbpjpy, audjpy, cadjpy, eurgbp,
  euraud (the `fade-new-markets` Test A list), fills 2005-01-01 to 2026-10-31 (each from where OANDA's history starts).
- **Holdout H2 (secondary)**: the ten selection markets, fills 2015-01-01 to 2026-10-31. Said plainly: `msnr-switch-fade` read
  these years for its 42 base cells, so H2 is not untouched; it is reported and must only be positive (sign).
- Timeframes from `combo-grid-3` `frames` (imported, unchanged). Exclusions: `combo-grid-2` `exclusions(market)`.
- Costs: `combo-grid-2` `COSTS`, charged as round trip / risk in R on every trade. Demo figures for gold and the four majors;
  **ASSUMED, not measured** for xag, nzdusd, usdcad, usdchf, eurjpy and every H1 market.

## The rules (all from `msnr-switch-fade`, imported or copied unchanged unless named here)

Call, switch and ladders as `msnr-switch-fade` (`direction()` from `council/eg-methods.mjs`, unchanged): **L4** = working H4,
Daily key levels, triggers on M15, time limit 1 day; **LH** = working H1, H4 key levels, triggers on M5, time limit 8 hours.

Triggers (closed candles only; entry at the next 5-minute open):
- **a**: the first trigger-chart structure break (`structure(T, 3)`) AGAINST a fresh call, faded (entered with the call), call
  age 0-5 working candles;
- **b**: the first break WITH a fresh call, entered with it, age 0-5;
- **c**: the switch candle, entered with the call.

Complements (each a factor of the grid):
- **stop**: `swing` = `msnr-switch-fade`'s stop (past the trigger leg + 0.1 ATR of the trigger chart; for c, past the tapped
  zone + 0.1 ATR); `watr` = 1 x ATR(14) of the WORKING chart at the last working candle closed by the trigger, from the fill.
- **hours**: `all`, or `day` = the trigger candle closes at an hour 07:00-19:59 UTC (no entries near the daily roll).
- **htf**: `any`, or `d1` = the Daily structure side (`edgekit` `structure` on the 17:00 New York days, 3 candles a side) at the
  last Daily candle closed by the trigger equals the call.
- **exit**: `2R`, or `key` = `msnr-switch-fade`'s nearest opposite key level (only when 1R or more away).

Grid: 3 triggers x 2 ladders x 2 stops x 2 hours x 2 htf x 2 exits = **96 cells**. Every trade has its stop on the losing side
(the run throws otherwise); a trade whose risk is under the round trip is not taken.

## Selection (on S only, AFTER costs)

Eligible: n >= 300, mean R after costs > 0 and month-sum t of after-cost R >= 2, pooled over the ten markets, fills 2005-2014.
The **at most three** eligible cells with the highest after-cost month t are selected. If none is eligible the verdict is
**FAIL** and no holdout is judged (the holdout numbers are still reported for every cell, marked "not selected").

## The bar (each selected cell)

- **H1**: n >= 300; mean R after costs > 0; month-sum t of after-cost R >= 2; Holm-adjusted one-sided p < 0.05 over the
  selected cells.
- **H2**: mean R after costs > 0.

**PASS** if any selected cell clears H1 and H2; **INCONCLUSIVE** if a selected cell clears H1's sign and t but not Holm or H2,
or has n under 300 with t >= 2; otherwise **FAIL**. Every cell of the grid is reported in every window, before and after costs.
A PASS is a candidate for a forward paper record, never a live rule without the owner.

## Checks

- Cut test: on two markets at five dates, the signals known by a date, computed on candles cut there, equal the full run's.
- One run, no variants. Nothing is re-selected after the holdout is read.
