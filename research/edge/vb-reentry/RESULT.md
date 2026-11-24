# The volatility breakout: the same side again after a stop-out

**Verdict: FAIL, 0 of 3: the same-side re-entry after a T1 stop-out made +0.009R a trade after costs in 2015 → now pooled (n 557, month t +0.17), +0.118R in 2005-14 (n 378); gold +0.108R (n 275, t +1.39), USD/JPY −0.089R (n 282, t −1.23); E3 failed t2, holm, cost2x, control**

Paper research only. Rule, tests and bar fixed in `PREREGISTRATION.md` (pushed alone first). Nothing live changed, nothing is proposed. Both windows were read for T1 itself before; only the re-entry trades are new. This page is written by `run.mjs` from `result.json`.

## Harness gates

- xau T1 2007-01-01 → 2015-12-31: got n 1657, net +0.111R, month t +3.19 (published 1657, +0.111, +3.19): exact
- xau walker against vbTrade on 3861 T1 trades: identical
- usdjpy T1 2005-01-04 → 2015-12-31: got n 2089, net +0.079R, month t +2.95 (published 2089, +0.079, +2.95): exact
- usdjpy T1 2016-01-01 → 2026-11-19: got n 2079, net +0.063R, month t +2.50 (published 2079, +0.063, +2.50): exact
- usdjpy walker against vbTrade on 4169 T1 trades: identical

## Re-entry trades, after costs

| Test | Window | Stopped days | Re-entered | n | Win | Gross R/trade | Net R/trade | Net at 2x | Total R | Month t | Gross t | Stops / time | Buys / sells | Control net R (mean of 40) | Control beaten |
|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|
| E1 xau | 2005-14 | 533 | 32 % | 170 | 42.9 % | +0.204 | +0.180 | +0.156 | +30.59 | +1.38 | +1.56 | 61 / 109 | 71 / 99 | +0.320 | 3 of 40 |
| E1 xau | 2015 → now | 781 | 35 % | 275 | 46.2 % | +0.133 | +0.108 | +0.084 | +29.83 | +1.39 | +1.69 | 84 / 191 | 132 / 143 | +0.251 | 0 of 40 |
| E2 usdjpy | 2005-14 | 608 | 34 % | 208 | 42.8 % | +0.104 | +0.067 | +0.029 | +13.89 | +0.83 | +1.31 | 57 / 151 | 99 / 109 | +0.234 | 0 of 40 |
| E2 usdjpy | 2015 → now | 766 | 37 % | 282 | 39.0 % | −0.047 | −0.089 | −0.130 | −25.04 | −1.23 | −0.66 | 107 / 175 | 129 / 153 | +0.193 | 0 of 40 |
| E3 xau + usdjpy | 2005-14 | 1141 | 33 % | 378 | 42.9 % | +0.149 | +0.118 | +0.086 | +44.48 | +1.78 | +2.25 | 118 / 260 | 170 / 208 | +0.273 | 0 of 40 |
| E3 xau + usdjpy | 2015 → now | 1547 | 36 % | 557 | 42.5 % | +0.042 | +0.009 | −0.024 | +4.80 | +0.17 | +0.80 | 191 / 366 | 261 / 296 | +0.221 | 0 of 40 |

## Decision (confirmation 2015 → now, Holm over E1-E3)

| Test | Month t | p | Holm p | Disc > 0 | Conf > 0 | t ≥ 2 | Holm < 0.05 | n ≥ 200 | 2x cost > 0 | Control ≥ 38 of 40 | Pass |
|---|---|---|---|---|---|---|---|---|---|---|---|
| E1 | +1.39 | 0.083 | 0.249 | yes | yes | no | no | yes | yes | no | **fail** |
| E2 | −1.23 | 0.891 | 0.891 | yes | no | no | no | yes | no | no | **fail** |
| E3 | +0.17 | 0.434 | 0.868 | yes | yes | no | no | yes | no | no | **fail** |

## Per stopped day: T1 alone against T1 + the re-entry (net R a stopped day; reported)

| Test | Window | Stopped days | T1 alone | T1 + re-entry |
|---|---|---|---|---|
| E1 | 2005-14 | 533 | −1.018 | −0.961 |
| E1 | 2015 → now | 781 | −1.018 | −0.980 |
| E2 | 2005-14 | 608 | −1.034 | −1.011 |
| E2 | 2015 → now | 766 | −1.037 | −1.070 |
| E3 | 2005-14 | 1141 | −1.026 | −0.987 |
| E3 | 2015 → now | 1547 | −1.028 | −1.025 |

## By year (re-entry net R; reported)

| Year | Gold n | Gold net R/trade | USD/JPY n | USD/JPY net R/trade |
|---|---|---|---|---|
| 2005 | 0 | — | 16 | −0.131 |
| 2006 | 11 | +0.723 | 28 | +0.563 |
| 2007 | 14 | +0.654 | 19 | +0.224 |
| 2008 | 13 | −0.647 | 23 | +0.422 |
| 2009 | 19 | +0.255 | 12 | −0.072 |
| 2010 | 11 | +0.479 | 23 | +0.158 |
| 2011 | 27 | +0.309 | 24 | −0.229 |
| 2012 | 24 | −0.191 | 16 | −0.042 |
| 2013 | 21 | −0.186 | 11 | +0.192 |
| 2014 | 30 | +0.397 | 36 | −0.346 |
| 2015 | 25 | −0.128 | 27 | +0.066 |
| 2016 | 25 | +0.238 | 21 | −0.221 |
| 2017 | 20 | +0.242 | 20 | +0.022 |
| 2018 | 21 | −0.060 | 17 | −0.265 |
| 2019 | 24 | +0.167 | 26 | −0.371 |
| 2020 | 19 | −0.206 | 20 | −0.151 |
| 2021 | 22 | +0.359 | 19 | −0.048 |
| 2022 | 33 | −0.038 | 31 | +0.114 |
| 2023 | 29 | +0.260 | 35 | +0.153 |
| 2024 | 27 | +0.415 | 20 | −0.409 |
| 2025 | 17 | +0.199 | 24 | −0.040 |
| 2026 | 13 | −0.411 | 22 | −0.196 |

## Reading

Crossing the trigger again after being stopped back at the open gave +0.042R a trade before costs and +0.009R after in 2015 → now (n 557); the random-time same-side control on the same days made +0.221R (real beat it in 0 of 40 seeds). The control days are the days the price did cross the trigger again after the stop-out, so a random later entry on them is helped by knowing that move came (its level is inflated by that selection, as the pre-registration's design implies); the verdict does not rest on it: the confirmation month t is under 2 on every test. A before-cost tilt is not an edge; nothing changes on any desk or job.

## Caveats

- Gold costs are the demo account's measured hourly spreads of November 2026 (route C1 of `gold-vol-breakout-hourcost`) charged on every past year as a share of price; USD/JPY costs are the 0.000045 commission + 0.5 pip every USD/JPY breakout study used. Neither is a historical measurement.
- OANDA mid M5 candles; inside one 5-minute candle the order of prices is unknown, so a re-entry never fills in the stop-out candle and a fill candle that also reaches the open is booked as a stop.
- Data to 2026-11-21. Gold starts March 2006, so its discovery window is 2006-14.
- Both windows were read for T1 before this study; the re-entry rule itself was fixed before any re-entry figure was computed.
