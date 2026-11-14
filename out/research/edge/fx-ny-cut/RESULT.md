# The 10:00 New York option cut, forex majors: result

**Verdict: FAIL.** Trading toward a round level from 09:00 to the 10:00 New York cut made -0.054R a trade net out of sample (n 3575, t -7.86). In sample -0.057R (n 3510, t -6.8); gross out of sample +0.002R, at 2x costs -0.11R; placebo 95th percentile -0.04R (real above 14 of 40). Best pair out of sample usdcad -0.011R (n 511, t -0.58, Holm p 1); 0 of 7 pairs pass on their own.

Pre-registered in PREREGISTRATION.md (committed before any candle was read). Seven pairs (eurusd, gbpusd, audusd, nzdusd, usdcad, usdchf, usdjpy), OANDA mid M5,
in sample 2016-01-01 to 2021-06-30, out of sample 2021-07-01 to 2026-11-12. At 09:00 New York (daylight time handled), when price is 1-10 pips
from a 50-pip round level, trade toward it at market; stop 1.5 x the 20-day mean 09:00-10:00 range; out at 10:00 New York or the stop.
Round numbers stand in for option strikes: no strike or open-interest data was available (a known limitation).
Costs: spread 0.3 pip + commission 22.5 USD per million a side (2 x 22.5e-6 x price a round trip) + 0.5 pip slippage on the entry and on the exit. t on calendar-month sums. Paper research only: nothing live changed.

## Pool and pairs

| Stream | Window | n | Net R a trade | Gross R a trade | Net at 2x | t net (months) | t gross | Total net R | Win rate | Stops | Median stop (pips) |
|---|---|---|---|---|---|---|---|---|---|---|---|
| Pool | IS 2016-21H1 | 3510 | −0.057 | +0.003 | −0.118 | -6.80 | 0.34 | −201.7 | 45.0 % | 146 | 30.61 |
| Pool | OOS 2021H2-26 | 3575 | −0.054 | +0.002 | −0.110 | -7.86 | 0.36 | −192.0 | 44.2 % | 122 | 32.5 |
| eurusd | IS 2016-21H1 | 525 | −0.053 | +0.004 | −0.111 | -2.48 | 0.20 | −28.1 | 47.6 % | 24 | 32.85 |
| eurusd | OOS 2021H2-26 | 546 | −0.078 | −0.021 | −0.135 | -4.49 | -1.24 | −42.6 | 42.3 % | 18 | 32.81 |
| gbpusd | IS 2016-21H1 | 476 | −0.038 | +0.005 | −0.081 | -1.78 | 0.23 | −18.0 | 44.3 % | 15 | 45.6 |
| gbpusd | OOS 2021H2-26 | 537 | −0.061 | −0.014 | −0.108 | -3.51 | -0.79 | −32.7 | 45.1 % | 18 | 39.83 |
| audusd | IS 2016-21H1 | 502 | −0.068 | +0.004 | −0.141 | -3.21 | 0.22 | −34.1 | 43.0 % | 23 | 24.1 |
| audusd | OOS 2021H2-26 | 489 | −0.026 | +0.037 | −0.089 | -1.33 | 1.87 | −12.5 | 47.4 % | 16 | 25.39 |
| nzdusd | IS 2016-21H1 | 496 | −0.074 | −0.002 | −0.146 | -3.57 | -0.10 | −36.7 | 42.5 % | 19 | 22.95 |
| nzdusd | OOS 2021H2-26 | 509 | −0.082 | −0.014 | −0.150 | -4.44 | -0.80 | −41.7 | 40.1 % | 17 | 23.96 |
| usdcad | IS 2016-21H1 | 482 | −0.052 | −0.002 | −0.102 | -2.19 | -0.10 | −25.0 | 46.9 % | 23 | 38.43 |
| usdcad | OOS 2021H2-26 | 511 | −0.011 | +0.042 | −0.064 | -0.58 | 2.26 | −5.6 | 48.7 % | 11 | 38.03 |
| usdchf | IS 2016-21H1 | 530 | −0.059 | +0.004 | −0.121 | -3.03 | 0.22 | −31.1 | 44.7 % | 21 | 27.61 |
| usdchf | OOS 2021H2-26 | 476 | −0.084 | −0.023 | −0.145 | -4.18 | -1.11 | −39.9 | 40.8 % | 19 | 27.03 |
| usdjpy | IS 2016-21H1 | 499 | −0.058 | +0.006 | −0.121 | -2.62 | 0.26 | −28.7 | 45.5 % | 21 | 29.12 |
| usdjpy | OOS 2021H2-26 | 507 | −0.034 | +0.011 | −0.078 | -1.72 | 0.58 | −17.0 | 45.0 % | 23 | 49.74 |

## The pass bar (pool decides)

| Stream | OOS month-sum t >= 2 (net) | IS net R a trade > 0 | OOS net R a trade > 0 at 2x costs | beats the placebo 95th percentile | Holm p (OOS) | Verdict |
|---|---|---|---|---|---|---|
| Pool | no | no | no | no | 1 | FAIL |
| eurusd | no | no | no | no | 1 | FAIL |
| gbpusd | no | no | no | no | 1 | FAIL |
| audusd | no | no | no | yes | 1 | FAIL |
| nzdusd | no | no | no | no | 1 | FAIL |
| usdcad | no | no | no | yes | 1 | FAIL |
| usdchf | no | no | no | no | 1 | FAIL |
| usdjpy | no | no | no | no | 1 | FAIL |

## Placebo (out of sample, 40 seeds: the same rule at levels shifted 5-45 pips off the round grid) and the 25-pip control

| Stream | Real net R a trade | Placebo mean | Placebo 95th pct | Placebo range | Real ranks above | 25-pip control (n, net R) |
|---|---|---|---|---|---|---|
| Pool | −0.054 | −0.052 | −0.040 | −0.075 to −0.035 | 14 of 40 | 3642, −0.044 |
| eurusd | −0.078 | −0.048 | −0.021 | −0.109 to −0.021 | 4 of 40 | 485, −0.024 |
| gbpusd | −0.061 | −0.046 | −0.014 | −0.071 to −0.013 | 12 of 40 | 502, −0.071 |
| audusd | −0.026 | −0.061 | −0.040 | −0.103 to −0.033 | 40 of 40 | 516, −0.073 |
| nzdusd | −0.082 | −0.056 | −0.032 | −0.093 to −0.031 | 4 of 40 | 529, −0.041 |
| usdcad | −0.011 | −0.056 | −0.029 | −0.100 to −0.022 | 40 of 40 | 528, −0.060 |
| usdchf | −0.084 | −0.054 | −0.019 | −0.099 to −0.018 | 6 of 40 | 534, −0.023 |
| usdjpy | −0.034 | −0.042 | −0.018 | −0.077 to −0.007 | 25 of 40 | 548, −0.020 |

## Reported only: the release after the cut (10:00-11:00 New York, away from the same level, same stop)

| Stream | Window | n | Net R a trade | Gross R a trade | t net (months) | t gross |
|---|---|---|---|---|---|---|
| Pool | IS | 3500 | −0.066 | −0.006 | -6.70 | -0.62 |
| Pool | OOS | 3558 | −0.058 | −0.002 | -5.39 | -0.17 |
| eurusd | IS | 521 | −0.079 | −0.022 | -3.07 | -0.85 |
| eurusd | OOS | 544 | −0.066 | −0.009 | -2.70 | -0.37 |
| gbpusd | IS | 476 | −0.050 | −0.008 | -2.04 | -0.32 |
| gbpusd | OOS | 535 | −0.065 | −0.017 | -3.13 | -0.85 |
| audusd | IS | 500 | −0.081 | −0.009 | -3.41 | -0.39 |
| audusd | OOS | 488 | −0.051 | +0.012 | -2.49 | 0.60 |
| nzdusd | IS | 495 | −0.054 | +0.018 | -2.45 | 0.88 |
| nzdusd | OOS | 505 | −0.071 | −0.003 | -3.31 | -0.15 |
| usdcad | IS | 480 | −0.071 | −0.022 | -2.79 | -0.83 |
| usdcad | OOS | 510 | −0.035 | +0.018 | -1.42 | 0.76 |
| usdchf | IS | 529 | −0.075 | −0.012 | -3.22 | -0.53 |
| usdchf | OOS | 471 | −0.082 | −0.021 | -3.14 | -0.82 |
| usdjpy | IS | 499 | −0.048 | +0.015 | -2.20 | 0.74 |
| usdjpy | OOS | 505 | −0.037 | +0.008 | -1.58 | 0.34 |

Touch rate in the hour (descriptive, whole sample): the round level was touched before 10:00 on 65.7 % of the primary trades (n 7085); the 25-pip level on 66.4 % of the control's trades (n 7363).

## By year, pool (net R a trade / total net R / n)

| Year | Net R a trade | Gross R a trade | Total net R | n |
|---|---|---|---|---|
| 2016 | −0.021 | +0.024 | −13.1 | 613 |
| 2017 | −0.046 | +0.014 | −29.9 | 650 |
| 2018 | −0.073 | −0.009 | −45.3 | 623 |
| 2019 | −0.079 | +0.000 | −52.2 | 663 |
| 2020 | −0.065 | −0.010 | −42.2 | 649 |
| 2021 | −0.062 | −0.004 | −40.5 | 655 |
| 2022 | −0.046 | −0.003 | −29.9 | 651 |
| 2023 | −0.052 | −0.005 | −33.3 | 645 |
| 2024 | −0.057 | +0.004 | −37.7 | 660 |
| 2025 | −0.049 | +0.012 | −34.2 | 702 |
| 2026 | −0.062 | +0.007 | −35.4 | 574 |

## Days (2016-01-01 to 2026-11-12, New York weekdays)

| Pair | Candles | First | Last | Traded | Far from a level | At the level | No 09:00 candle | Hour candles missing | Warm-up |
|---|---|---|---|---|---|---|---|---|---|
| eurusd | 821744 | 2015-11-01 22:00 | 2026-11-12 23:55 | 1071 | 1640 | 106 | 18 | 0 | 0 |
| gbpusd | 821204 | 2015-11-01 22:00 | 2026-11-12 23:55 | 1013 | 1709 | 95 | 18 | 0 | 0 |
| audusd | 818540 | 2015-11-01 22:00 | 2026-11-12 23:55 | 991 | 1718 | 107 | 19 | 0 | 0 |
| nzdusd | 820871 | 2015-11-01 22:00 | 2026-11-12 23:55 | 1005 | 1718 | 94 | 18 | 0 | 0 |
| usdcad | 821525 | 2015-11-01 22:00 | 2026-11-12 23:55 | 993 | 1733 | 91 | 18 | 0 | 0 |
| usdchf | 813417 | 2015-11-01 22:00 | 2026-11-12 23:55 | 1006 | 1706 | 104 | 18 | 1 | 0 |
| usdjpy | 822120 | 2015-11-01 22:00 | 2026-11-12 23:55 | 1006 | 1741 | 70 | 18 | 0 | 0 |

## Reading

- Written after the run. There is no pull to the round level in the hour before the cut: before any cost the pooled trade made +0.003R a trade in sample (t 0.34) and +0.002R out of sample (t 0.36). The costs (0.3 pip spread, commission, 1 pip of slippage, about 0.055R on a median 31-33 pip stop) make both clearly negative (t -6.8 and -7.86).
- The round levels do no better than levels placed anywhere else: out of sample the real rule (-0.054R) ranks above 14 of 40 placebo grids shifted 5-45 pips off the round numbers (95th percentile -0.040R), and the grid halfway between round levels (the 25-pip control) did a little better (-0.044R, gross +0.012R). Price touched the round level before 10:00 on 65.7 % of trades and the 25-pip level on 66.4 % of the control's: no sign of pinning.
- No pair works alone: all seven are negative net out of sample; USD/CAD is nearest to flat (-0.011R, t -0.58, gross +0.042R) and lost in sample (-0.052R). 0 of 7 pairs pass.
- Reported only: the release after the cut (10:00-11:00 New York, away from the same level) is flat before costs too (+-0.006R gross in both windows) and loses its costs. Nothing happens at the round level around 10:00 New York that this data can see.
- Limitation: round numbers are only a proxy for option strikes; real expiry sizes and strikes were not available. This does not show that large real expiries have no effect, only that the round-number proxy gives no trade. Not an edge; no proposal is written; nothing live changes. Another distance, stop, grid or exit time is not tried on this data without a new pre-registration.

To repeat: `node --use-env-proxy research/edge/fx-ny-cut/run.mjs fetch <dir>` (candles outside git), then `node research/edge/fx-ny-cut/run.mjs full <dir>`. Tests: `tests/fx-ny-cut.test.mjs`.
