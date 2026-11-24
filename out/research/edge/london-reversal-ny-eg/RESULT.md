# London reversal day, New York pullback into an H1 engulf zone (result)

**Verdict: FAIL. 0 of 8 cells pass; the best cell, mid lon 2R, made -0.054R a trade after costs in 2015-26 (n 1,114, month t -1.32; before costs +0.002R; 2005-14 -0.046R after costs, n 975, month t -1.03).**

Run 24 Nov 2026 as pre-registered (`PREREGISTRATION.md`, committed alone first). Research only: nothing live changed, nothing is
proposed. One run, no variants. Judged AFTER costs (the demo round trips of `edgekit` `COSTS`).

## What was run

On a UTC weekday: the Asia range = high and low of the 5-minute candles starting 00:00-06:55; London = 07:00-11:55. A reversal day
so far = London traded beyond one side of the Asia range and its last candle closed beyond the Asia middle (`mid`) or beyond the
range's other side (`other`), known at 12:00. In New York (fills 12:00-15:55) a limit rests at the near edge of every H1 engulf
zone of London's direction made that day from 08:00 on and not yet traded into (`lon`: zones known by 12:00; `any`: also zones
completed in New York); the first edge reached is the day's one trade. Stop past the zone's far edge by 0.1 H1 ATR(14), targets
1R and 2R, out at 20:00 UTC. Stop first in a candle holding both; on the fill candle only the stop counts. Five markets pooled
(xau, eurusd, gbpusd, usdjpy, audusd), OANDA mid 5-minute candles; discovery 2005-2014, confirmation 2015 to October 2026.

## The bar, cell by cell

- n >= 300 in both windows: 8 of 8.
- Mean R after costs > 0 and month t >= 2 in discovery: 0; in confirmation: 0.
- Holm-adjusted p < 0.05: 0.
- **All: 0.**

## Every cell

R a trade; "before" = before costs, "after" = after costs; t = t of calendar-month sums (empty months as 0).

| cell | 2005-14 n | win | before | t | after | t | 2015-26 n | win | before | t | after | t | cost R | Holm p | pass |
|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|
| mid lon 1R | 975 | 51% | +0.026 | 0.80 | -0.028 | -0.86 | 1,114 | 49% | -0.022 | -0.66 | -0.078 | -2.31 | 0.06 | 1.000 | no |
| mid lon 2R | 975 | 39% | +0.007 | 0.17 | -0.046 | -1.03 | 1,114 | 39% | +0.002 | 0.05 | -0.054 | -1.32 | 0.06 | 1.000 | no |
| mid any 1R | 1,445 | 49% | +0.003 | 0.13 | -0.046 | -1.68 | 1,650 | 48% | -0.039 | -1.44 | -0.092 | -3.38 | 0.05 | 1.000 | no |
| mid any 2R | 1,445 | 38% | -0.026 | -0.71 | -0.076 | -2.04 | 1,650 | 39% | -0.025 | -0.74 | -0.079 | -2.28 | 0.05 | 1.000 | no |
| other lon 1R | 397 | 51% | +0.027 | 0.62 | -0.021 | -0.49 | 453 | 44% | -0.100 | -2.07 | -0.153 | -3.05 | 0.05 | 1.000 | no |
| other lon 2R | 397 | 37% | -0.079 | -1.41 | -0.127 | -2.26 | 453 | 37% | -0.064 | -1.07 | -0.116 | -1.92 | 0.05 | 1.000 | no |
| other any 1R | 596 | 48% | -0.021 | -0.61 | -0.066 | -1.87 | 682 | 44% | -0.104 | -2.60 | -0.153 | -3.73 | 0.05 | 1.000 | no |
| other any 2R | 596 | 36% | -0.106 | -2.42 | -0.151 | -3.39 | 682 | 37% | -0.081 | -1.61 | -0.130 | -2.54 | 0.05 | 1.000 | no |

## Beside: the same limit rule with no London condition

Every weekday, both directions, same zone sets and targets. Not part of the bar. Welch t = reversal-day trades against these,
after costs, per trade (it counts trades as independent, so it can overstate; the reversal-day trades are a subset of these).

| cell | control 2005-14 n | after | control 2015-26 n | after | Welch t 2005-14 | Welch t 2015-26 |
|---|---|---|---|---|---|---|
| mid lon 1R | 4,453 | -0.041 | 5,713 | -0.083 | 0.38 | 0.16 |
| mid lon 2R | 4,453 | -0.049 | 5,713 | -0.063 | 0.07 | 0.23 |
| mid any 1R | 10,710 | -0.052 | 13,409 | -0.081 | 0.23 | -0.46 |
| mid any 2R | 10,710 | -0.055 | 13,409 | -0.078 | -0.62 | -0.03 |
| other lon 1R | 4,453 | -0.041 | 5,713 | -0.083 | 0.39 | -1.5 |
| other lon 2R | 4,453 | -0.049 | 5,713 | -0.063 | -1.26 | -0.89 |
| other any 1R | 10,710 | -0.052 | 13,409 | -0.081 | -0.34 | -1.96 |
| other any 2R | 10,710 | -0.055 | 13,409 | -0.078 | -1.98 | -1.14 |

## By market, the best cell (mid lon 2R; context only)

| market | 2005-14 n | before | after | t after | 2015-26 n | before | after | t after |
|---|---|---|---|---|---|---|---|---|
| xau | 192 | +0.052 | -0.079 | -0.77 | 194 | +0.061 | -0.041 | -0.44 |
| eurusd | 247 | -0.033 | -0.061 | -0.77 | 322 | -0.079 | -0.123 | -1.64 |
| gbpusd | 271 | -0.014 | -0.045 | -0.59 | 331 | -0.016 | -0.055 | -0.87 |
| usdjpy | 132 | +0.027 | -0.025 | -0.22 | 124 | -0.003 | -0.065 | -0.55 |
| audusd | 133 | +0.042 | +0.006 | 0.05 | 143 | +0.151 | +0.098 | 0.84 |

## Counts

| market | candles from | days read | excluded | reversal days (mid) | of them other | with a zone of the day | fills lon | fills any | risk under cost | odd |
|---|---|---|---|---|---|---|---|---|---|---|
| xau | 2006-03-19 | 5,290 | 0 | 886 | 324 | 841 | 386 | 521 | 0 | 0 |
| eurusd | 2005-01-02 | 5,653 | 4 | 1,619 | 787 | 1,524 | 569 | 858 | 0 | 0 |
| gbpusd | 2005-01-02 | 5,651 | 7 | 1,906 | 1,020 | 1,795 | 602 | 964 | 0 | 0 |
| usdjpy | 2005-01-02 | 5,652 | 6 | 710 | 165 | 656 | 256 | 365 | 0 | 0 |
| audusd | 2005-01-02 | 5,647 | 4 | 749 | 202 | 694 | 276 | 387 | 0 | 0 |

In all 27,893 market-days, 5,870 reversal days by the middle (2,498 by the other side). "risk under cost" and "odd"
(an order the engine did not fill on its candle) count orders of the rule and of the control together.

## Checks

- Cut check (classification, zones and orders known by a date, on candles cut there, against the full run): 13 cuts, 0 differences (xau 2008-06-11 n 546; xau 2012-03-14 n 1517; xau 2016-09-21 n 2683; xau 2021-02-17 n 3818; xau 2025-05-07 n 4905; eurusd 2008-06-11 n 890; eurusd 2012-03-14 n 1866; eurusd 2016-09-21 n 3037; eurusd 2021-02-17 n 4177; eurusd 2025-05-07 n 5271; gbpusd 2016-09-21 n 3038; usdjpy 2016-09-21 n 3038; audusd 2016-09-21 n 3036).
- Every trade has its stop on the losing side of its fill (the run throws otherwise).

## Reading

No cell clears the bar after costs. Waiting for London to finish as a reversal day and buying or selling the New York pullback into an hourly engulf zone is not shown to make money here; nothing is proposed and no variant is to be run on these years.

## What a reviewer should doubt

- Mid candles, not bid / ask: a limit at a zone edge is assumed filled at the touch; a real fill needs the price to trade through by the spread.
- The same round-trip cost is charged in every year (today's demo figures), which flatters 2005-14.
- `other` days are a subset of `mid` days and the 1R / 2R cells share entries, so the 8 cells are far from independent.
- A target is fixed with the order (entry edge + k x the planned risk); a fill at an open beyond the edge keeps that target.
- Gold's history starts later than 2005 (see Counts).
