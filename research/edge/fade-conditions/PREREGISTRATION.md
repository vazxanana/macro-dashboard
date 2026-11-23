# Where the fade tilt lives: two fade rules split by fixed conditions (pre-registration, 23 Nov 2026)

Written and pushed alone BEFORE any run. Research only: nothing live reads it, nothing is placed, no rule is proposed.

## Why

`research/edge/grid7-wide-fade` found that FADING the first structure break at market makes a small before-cost tilt on ten
markets in both 2005-14 and 2015-26 (for example `m15 none atr 2R all`: +0.054R / +0.042R a trade, month t 11.38 / 11.33;
`h1 none ext 2R all`: +0.105R / +0.040R, month t 12.31 / 5.17), and that every passing cell loses after costs. The tilt per
trade is small. This study asks WHERE it lives (hour, volatility, Daily trend, size of the break candle, day of week), with one
fixed set of splits, the level to test chosen in discovery and tested once in confirmation.

## Rules (unchanged, imported)

The two cells of `grid7-wide-fade`, by its own code (`research/edge/grid7-wide-fade/run.mjs`: `signals`, `exits`, its
constants; imported, never edited), context "none", all sessions:

- **R1 = `m15 none atr 2R all`**: trigger M15; stop 1 x ATR(14) of M15 from the fill; target 2R; time limit 1 day.
- **R2 = `h1 none ext 2R all`**: trigger H1; stop past the break candle's extreme by 0.1 x ATR(14) of H1; target 2R; time
  limit 2 days.

Side = against the break; market entry at the open of the first 5-minute candle at or after the break candle's close. Every
trade has a stop on its losing side (the run throws otherwise); a fill at or past the stop, and a risk under the round-trip
cost, are no trade; a trade is kept only when the grid would keep it (its mirror resolved too), so the pooled figures must
reproduce the grid's (the **gate**, below). Stop first when one 5-minute candle holds stop and target; a gap fills at the open.

## Data

OANDA mid 5-minute candles from the shared cache (`research/edge/_lib/edgekit.mjs`, `EDGE_DATA`), from 2004-01-01 for warm-up;
timeframes by `combo-grid-3` `frames` (15m, 1h UTC buckets; 1d = 17:00 New York trading days from the same candles). Markets
(10): xau, xag, eurusd, gbpusd, usdjpy, audusd, nzdusd, usdcad, usdchf, eurjpy. Exclusions: `combo-grid-2` `exclusions`.
Windows by fill time: **discovery 2005-01-01 to 2014-12-31** (120 months), **confirmation 2015-01-01 to 2026-10-31** (142
months). Month sums count every calendar month of the window, an empty month as 0.

## The conditions (measured at the break candle's close from closed candles only; fixed here)

Let T be the trigger timeframe, j the break candle (`T[j]`, it closes at `ts`), a = ATR(14) of T at j (the grid's `atr14`).

1. **hour**: UTC hour of the break candle's OPEN time `T[j].t`, in 4-hour blocks: 00-03, 04-07, 08-11, 12-15, 16-19, 20-23
   (6 levels).
2. **vol**: a / median(ATR(14) of T over candles j-99..j, 100 values): **low** < 0.8, **mid** 0.8-1.25, **high** > 1.25
   (3 levels). Fewer than 100 ATR values on file (or a zero median): no level (the trade is left out of this split only).
3. **trend**: the Daily candles of `frames` CLOSED by `ts` (end <= ts); the last 21 closes c0..c20. ER = |c20 - c0| / sum of
   |c(i) - c(i-1)| over the 20 steps; band **range** < 0.2, **mid** 0.2-0.4, **trend** > 0.4; direction = sign(c20 - c0);
   **with** = the break goes the same way as the 20-day direction, **against** = the other way. Six levels: range-with,
   range-against, mid-with, mid-against, trend-with, trend-against. Fewer than 21 closed days, or c20 = c0: no level.
4. **body**: |close - open| of the break candle / a: **small** < 0.5, **medium** 0.5-1, **large** > 1 (3 levels).
5. **dow**: UTC weekday of the break candle's open time; a Sunday candle counts as Monday (the reopen starts Monday's trading
   day); Mon, Tue, Wed, Thu, Fri (5 levels). A Saturday candle: no level.

Boundaries: vol < 0.8 low, 0.8 <= x <= 1.25 mid, > 1.25 high; ER < 0.2 range, 0.2 <= ER <= 0.4 mid, > 0.4 trend;
body < 0.5 small, 0.5 <= x <= 1 medium, > 1 large.

## Primary tests (10 = 5 splits x 2 rules)

For each rule and split: in DISCOVERY, among the split's levels with n >= 300 discovery trades, the **best** level (highest
mean R before costs) and the **worst** level (lowest). In CONFIRMATION, the difference mean R(best) - mean R(worst) of those
same two levels (no re-picking), with a Welch t on the per-trade R (Welch-Satterthwaite degrees of freedom), one-sided p
(best > worst). Holm over the 10 primary tests.

A primary test **passes** when the confirmation difference is > 0 and its Holm-adjusted one-sided p < 0.05.

**Verdict: PASS** if one primary test or more passes; **FAIL** otherwise; **INCONCLUSIVE** only if fewer than 8 of the 10
markets load or the gate fails (then nothing is judged and the reason is said).

The gate: for each rule, the pooled n and mean R before costs in each window equal `grid7-wide-fade`'s result.json for that
cell (n exactly, mean to 3 decimals).

## Also reported (not part of the bar)

- Every level of every split: n, mean R, month-sum t, win share, in both windows; after costs beside (R less round-trip
  cost / risk; `combo-grid-2` `COSTS`, **ASSUMED, not measured** for xag, nzdusd, usdcad, usdchf, eurjpy).
- Levels positive in both windows (mean R > 0 in both), and those with month t >= 2 in both: descriptive, not tested.
- For each primary test, a month-level check: for months where both levels traded, mean R(best) - mean R(worst), t over
  those months (trades overlap, so the per-trade Welch t can overstate; this is shown beside it, not part of the bar).
- Per-market rows for every passing primary test (best and worst level, both windows, before and after costs).
- Cut test: on five dates in two markets, the signals AND their condition levels known by a date, computed on candles cut
  there, equal the full run's.

## What a result means

A pass says the tilt is larger under one fixed condition than another, in a window the choice was not made on: a description
of where a before-cost tilt sits. It is not an edge, nothing is adopted, and the after-cost figures say how far it is from
tradable. One run, no variants, no other cut points.
