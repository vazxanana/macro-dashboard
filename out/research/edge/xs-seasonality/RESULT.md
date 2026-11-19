# Cross-sectional return seasonality (same calendar month in past years): result

**Verdict: FAIL: all four groups' book made -0.7477R a month net out of sample (n 118 months, t -2.03, Holm p 0.1271), in sample +0.1095R (t +0.32).**

Pre-registered bar (primary book): OOS month-sum t >= 2 with Holm p < 0.05 over five tests missed; IS net > 0 met; OOS net > 0 at 2x costs missed; beats >= 38 of 40 placebo runs missed.

Out of sample 2017-01 to 2026-10 (118 months, 2359 trades): -0.0374R a trade net (gross +0.013R, spread 0.0096R, financing 0.0408R); gross +0.2609R a month (t +0.7), net -0.7477R (t -2.03, Newey-West -1.92), at 2x costs -1.7563R; total net -88.23R.
In sample 2007-06 to 2016-12 (115 months, 1836 trades): +0.0069R a trade net; gross +0.7884R a month (t +2.3), net +0.1095R (t +0.32), total +12.59R.
Placebo (40 seeds, each month ranked on a random OTHER calendar month's past average, same thirds, stops and costs): the real OOS mean beats 34 of 40; placebo 5th / 50th / 95th percentile -1.5432 / -1.0549 / -0.5289R a month.

Every trade has a stop at 1R = 3 x ATR(20) from its entry. Net of a round trip (index 0.04 %, gold $0.30, silver $0.03, other commodities 0.06 %, FX majors the demo raw-spread model, SEK / NOK 0.04 %) and overnight financing (index: policy rate + 2.5 % long, max(0, 2.5 % - rate) short; gold long the demo broker's measured rate; other commodities 3 % a year both sides; FX 0.004 % a night both sides). Paper research: no live rule, size, filter, stop or council member changed.

## The five tests (net R, base costs; Holm over the five)

| Book | First month | IS months / trades | IS gross R a month (t) | IS net R a month (t) | OOS trades | OOS gross R a month (t) | OOS net R a month (t) | OOS 2x R a month | p | Holm p | Lines |
|---|---|---|---|---|---|---|---|---|---|---|---|
| all | 2007-06 | 115 / 1836 | +0.7884 (+2.3) | +0.1095 (+0.32) | 2359 | +0.2609 (+0.7) | -0.7477 (-2.03) | -1.7563 | 0.0424 | 0.1271 | t/Holm missed, IS met, 2x missed |
| index | 2008-04 | 115 / 610 | +0.1174 (+0.81) | -0.1296 (-0.9) | 943 | -0.1433 (-0.6) | -0.5935 (-2.53) | -1.0436 | 0.0114 | 0.057 | t/Holm missed, IS missed, 2x missed |
| metal | 2010-02 | 115 / 166 | +0.0329 (+0.41) | -0.0348 (-0.44) | 236 | -0.098 (-1.15) | -0.1857 (-2.21) | -0.2733 | 0.0271 | 0.1084 | t/Holm missed, IS missed, 2x missed |
| energy | 2008-04 | 115 / 420 | +0.4088 (+2.42) | +0.2867 (+1.71) | 472 | +0.3073 (+1.51) | +0.1616 (+0.8) | +0.0158 | 0.4237 | 0.8474 | t/Holm missed, IS met, 2x met |
| fx | 2007-06 | 115 / 640 | +0.2292 (+1.25) | -0.0129 (-0.07) | 708 | +0.1949 (+1.16) | -0.1302 (-0.79) | -0.4553 | 0.4295 | 0.8474 | t/Holm missed, IS missed, 2x missed |

## Per trade

| Book | Window | Trades (long / short) | Win % | Gross R | Spread R | Financing R | Net R | Net 2x R | Stops (gap) | Long net R | Short net R |
|---|---|---|---|---|---|---|---|---|---|---|---|
| all | IS | 1836 (918 / 918) | 47.6 | +0.0494 | 0.0083 | 0.0342 | +0.0069 | -0.0357 | 552 (16) | -5.5 | +18.09 |
| all | OOS | 2359 (1179 / 1180) | 46.7 | +0.013 | 0.0096 | 0.0408 | -0.0374 | -0.0879 | 743 (22) | +0.93 | -89.16 |
| index | IS | 610 (305 / 305) | 48.4 | +0.0221 | 0.0091 | 0.0375 | -0.0244 | -0.071 | 190 (14) | +5.33 | -20.24 |
| index | OOS | 943 (471 / 472) | 45.8 | -0.0179 | 0.0103 | 0.0461 | -0.0743 | -0.1306 | 305 (11) | +1.58 | -71.61 |
| metal | IS | 166 (83 / 83) | 47.6 | +0.0228 | 0.0113 | 0.0356 | -0.0241 | -0.071 | 56 (0) | -7.48 | +3.48 |
| metal | OOS | 236 (118 / 118) | 44.5 | -0.049 | 0.01 | 0.0338 | -0.0928 | -0.1367 | 75 (1) | +0.4 | -22.31 |
| energy | IS | 420 (210 / 210) | 48.1 | +0.1119 | 0.0076 | 0.0258 | +0.0785 | +0.0451 | 122 (1) | +11.74 | +21.23 |
| energy | OOS | 472 (236 / 236) | 51.7 | +0.0768 | 0.0082 | 0.0282 | +0.0404 | +0.004 | 139 (8) | +17.22 | +1.85 |
| fx | IS | 640 (320 / 320) | 46.6 | +0.0412 | 0.0073 | 0.0362 | -0.0023 | -0.0458 | 184 (1) | -15.09 | +13.61 |
| fx | OOS | 708 (354 / 354) | 45.2 | +0.0325 | 0.0096 | 0.0446 | -0.0217 | -0.0759 | 224 (2) | -18.27 | +2.91 |

## Primary book: month sums

| Window | Costs | Mean R a month | t | Newey-West t | Sharpe | Positive months % | Total R | Worst drawdown R |
|---|---|---|---|---|---|---|---|---|
| In sample | 0 | +0.7884 | +2.3 | +2.11 | +0.74 | 58.3 | +90.67 | -19.34 |
| In sample | base | +0.1095 | +0.32 | +0.29 | +0.1 | 53.9 | +12.59 | -31.38 |
| In sample | 2x | -0.5695 | -1.66 | -1.5 | -0.54 | 44.3 | -65.49 | -89.02 |
| Out of sample | 0 | +0.2609 | +0.7 | +0.66 | +0.22 | 53.4 | +30.78 | -42.01 |
| Out of sample | base | -0.7477 | -2.03 | -1.92 | -0.65 | 39 | -88.23 | -97.11 |
| Out of sample | 2x | -1.7563 | -4.82 | -4.51 | -1.54 | 33.9 | -207.25 | -207.25 |

## By year (primary, base costs)

| Year | Months | Trades | Gross R | Net R |
|---|---|---|---|---|
| 2007 | 7 | 28 | +4.41 | +2.99 |
| 2008 | 12 | 120 | +13.81 | +10.55 |
| 2009 | 12 | 170 | +10.81 | +5.83 |
| 2010 | 12 | 214 | +20.99 | +12.95 |
| 2011 | 12 | 216 | -11.74 | -19.5 |
| 2012 | 12 | 216 | +28.06 | +17.36 |
| 2013 | 12 | 216 | -8.5 | -19.52 |
| 2014 | 12 | 216 | +40.65 | +27.79 |
| 2015 | 12 | 216 | +8.99 | +0.31 |
| 2016 | 12 | 224 | -16.82 | -26.18 |
| 2017 | 12 | 240 | -9.06 | -24.17 |
| 2018 | 12 | 240 | +34.59 | +22.2 |
| 2019 | 12 | 240 | +6.58 | -7.26 |
| 2020 | 12 | 240 | -0.83 | -10.69 |
| 2021 | 12 | 240 | +9.86 | -2.18 |
| 2022 | 12 | 239 | +3.05 | -5.72 |
| 2023 | 12 | 240 | +2.29 | -9.89 |
| 2024 | 12 | 240 | -6.98 | -19.97 |
| 2025 | 12 | 240 | -20.57 | -32.52 |
| 2026 | 10 | 200 | +11.85 | +1.98 |

## By market (net R, base costs)

| Market | Group | IS long / short | IS net R | OOS long / short | OOS net R |
|---|---|---|---|---|---|
| spx500 | index | 15 / 18 | -2.47 | 42 / 12 | -3.67 |
| de40 | index | 54 / 18 | +5.31 | 64 / 19 | -4.14 |
| uk100 | index | 15 / 29 | +4.61 | 25 / 48 | -19.04 |
| fr40 | index | 16 / 31 | -10.63 | 22 / 31 | -5.03 |
| ch20 | index | 30 / 41 | -9.66 | 22 / 33 | -6.05 |
| nl25 | index | 11 / 24 | -5.26 | 32 / 58 | -7.36 |
| es35 | index | 0 / 0 | 0 | 13 / 28 | +1.16 |
| jp225 | index | 40 / 51 | +7.29 | 56 / 42 | -0.59 |
| au200 | index | 21 / 38 | -8.91 | 20 / 52 | -11.5 |
| hk33 | index | 62 / 22 | +2.14 | 52 / 26 | -7.17 |
| cn50 | index | 3 / 1 | +2.17 | 52 / 54 | -6.14 |
| sg30 | index | 36 / 30 | -0.35 | 38 / 45 | +9.25 |
| in50 | index | 2 / 2 | +0.85 | 33 / 24 | -9.73 |
| xau | metal | 10 / 7 | -3.33 | 11 / 21 | -8.51 |
| xag | metal | 18 / 15 | -2.68 | 21 / 21 | -5.06 |
| xpt | metal | 9 / 24 | -3.01 | 10 / 39 | -4.66 |
| xpd | metal | 19 / 16 | +6.62 | 41 / 10 | +3.61 |
| xcu | metal | 27 / 21 | -1.59 | 35 / 27 | -7.29 |
| wtico | energy | 27 / 22 | -2.55 | 27 / 23 | +5.8 |
| bco | energy | 23 / 31 | +3.33 | 37 / 30 | -3.54 |
| natgas | energy | 32 / 36 | -8.46 | 39 / 38 | +6.42 |
| corn | energy | 31 / 24 | +9.89 | 35 / 29 | +12.79 |
| wheat | energy | 30 / 27 | -6.67 | 24 / 36 | -7.01 |
| soybn | energy | 27 / 29 | +26.15 | 28 / 36 | -0.25 |
| sugar | energy | 40 / 41 | +11.29 | 46 / 44 | +4.85 |
| eurusd | fx | 33 / 32 | -8.29 | 34 / 30 | +3.06 |
| gbpusd | fx | 32 / 48 | +9.69 | 27 / 41 | -5.21 |
| audusd | fx | 47 / 22 | +13.32 | 51 / 28 | -18.64 |
| nzdusd | fx | 43 / 16 | -8.1 | 58 / 28 | -4.38 |
| usdjpy | fx | 39 / 45 | -15.6 | 44 / 58 | +12.47 |
| usdcad | fx | 32 / 44 | -5.7 | 32 / 40 | -12.12 |
| usdchf | fx | 43 / 31 | -3.94 | 59 / 28 | +11.6 |
| usdsek | fx | 20 / 33 | +0.41 | 17 / 46 | +3.56 |
| usdnok | fx | 31 / 49 | +16.73 | 32 / 55 | -5.71 |

## De-drifted variant (reported only, never deciding)

Ranked on the same-month average minus the market's average over all months of the same past years.

| Book | IS net R a month (t) | OOS net R a month (t) |
|---|---|---|
| all | +0.2562 (+0.72) | -0.8434 (-2.27) |
| index | -0.1533 (-1) | -0.6404 (-2.86) |
| metal | -0.02 (-0.24) | -0.2441 (-2.82) |
| energy | +0.3545 (+2.13) | +0.1725 (+0.83) |
| fx | +0.075 (+0.41) | -0.1315 (-0.82) |

## Reading

- The pre-registered bar was not met: no proposal is written and nothing changes. A FAIL is not evidence that the opposite works. Another universe, look-back, minimum history, stop or weighting would be a new study with its own pre-registration on data it was not chosen on.
- The backlog (candidate 3) named cost as the weak point: compare the gross and net columns above to see how much of any effect the spread and financing take.
- The placebo ranks on another calendar month's past average, so it keeps each market's long-run drift and the book's shape, stops and costs: it shows what the same-month part adds over a ranking on the market's general past.

## What this cannot show

- Price indices without dividends; each index in its own currency; approximate policy rates; assumed spreads for most CFDs; FX without the rate differential; unadjusted commodity rolls.
- 3 to 13 markets a group and at most about 8 to 17 past years per average: a small cross-section and a short history next to the published ones.

To repeat: `node research/edge/xs-seasonality/run.mjs` (reads council-data with `git show`, no network). Tests: `tests/xs-seasonality.test.mjs`.
