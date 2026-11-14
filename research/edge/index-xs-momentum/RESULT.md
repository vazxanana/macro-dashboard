# Cross-sectional momentum across national stock indices (12-1, monthly): result

**Verdict: FAIL** (pre-registered bar: OOS month-sum t >= 2 missed; IS net > 0 missed; OOS net > 0 at 2x costs missed; beats >= 38 of 40 placebo runs missed).

Out of sample 2016-01 to 2026-10 (130 months, 1039 trades): -0.0648R a trade net (gross +0.0032R, spread 0.0114R, financing 0.0566R), -0.518R a month, month-sum t -1.53 (Newey-West -1.57), total -67.34R; at 2x costs -1.0615R a month.
In sample 2005-04 to 2015-12 (129 months, 835 trades): -0.1042R a trade net, -0.6745R a month, t -2.78, total -87.01R.
Placebo (40 seeds, random ranking each month, same thirds, stops and costs): the real OOS mean beats 28 of 40; placebo 5th / 50th / 95th percentile -0.9465 / -0.6097 / -0.2335R a month.

Every trade has a stop at 1R = 2 x ATR(20) from its entry. Net of a 0.03 % round trip and overnight financing (long: the quote currency's policy rate + 2.5 % a year; short: max(0, 2.5 % - rate)). Paper research: no live rule, size, filter, stop or council member changed.

## Setup

Universe (one index per country): spx500, de40, uk100, fr40, ch20, nl25, es35, jp225, au200, hk33, cn50, sg30, in50. Data: council-data `research/daily/<key>.json` (OANDA mid daily candles, weekend stubs folded into Monday), last candle 2026-11-06.

| Index | First month | Last candle | Candles | Currency |
|---|---|---|---|---|
| spx500 | 2003-03 | 2026-11-06 | 6124 | USD |
| de40 | 2003-03 | 2026-11-06 | 6010 | EUR |
| uk100 | 2003-03 | 2026-11-06 | 5975 | GBP |
| fr40 | 2003-02 | 2026-11-06 | 5949 | EUR |
| ch20 | 2003-03 | 2026-11-06 | 5939 | CHF |
| nl25 | 2008-01 | 2026-11-06 | 4812 | EUR |
| es35 | 2016-12 | 2026-11-06 | 2523 | EUR |
| jp225 | 2003-03 | 2026-11-06 | 6115 | USD |
| au200 | 2004-03 | 2026-11-06 | 5781 | AUD |
| hk33 | 2003-02 | 2026-11-06 | 5867 | HKD |
| cn50 | 2011-08 | 2026-11-06 | 3855 | USD |
| sg30 | 2004-01 | 2026-11-06 | 5834 | SGD |
| in50 | 2011-08 | 2022-07-12 | 2735 | USD |

## Windows

| Window | Months (traded) | Trades (long / short) | Win % | Gross R a trade | Spread R | Financing R | Net R a trade | Net 2x R a trade | Stops (gap) | Missing legs |
|---|---|---|---|---|---|---|---|---|---|---|
| In sample 2005-04 to 2015-12 | 129 (126) | 835 (418 / 417) | 38.8 | -0.0423 | 0.0106 | 0.0513 | -0.1042 | -0.1661 | 426 (55) | 1 |
| Out of sample 2016-01 to 2026-10 | 130 (130) | 1039 (519 / 520) | 38.8 | +0.0032 | 0.0114 | 0.0566 | -0.0648 | -0.1328 | 520 (25) | 1 |

| Window | Costs | Mean R a month | t | Newey-West t | Sharpe | Positive months % | Total R | Worst drawdown R |
|---|---|---|---|---|---|---|---|---|
| In sample | 0 | -0.2738 | -1.12 | -1.21 | -0.34 | 45 | -35.32 | -58.69 |
| In sample | base | -0.6745 | -2.78 | -2.92 | -0.85 | 38 | -87.01 | -101.71 |
| In sample | 2x | -1.0752 | -4.43 | -4.51 | -1.35 | 32.6 | -138.7 | -146.85 |
| Out of sample | 0 | +0.0255 | +0.07 | +0.08 | +0.02 | 50.8 | +3.32 | -33.92 |
| Out of sample | base | -0.518 | -1.53 | -1.57 | -0.46 | 44.6 | -67.34 | -81.84 |
| Out of sample | 2x | -1.0615 | -3.15 | -3.19 | -0.96 | 36.9 | -138 | -149.94 |

Long legs net -23.64R IS, +22.95R OOS; short legs net -63.37R IS, -90.29R OOS.

## By year (net R, base costs)

| Year | Months | Trades | Gross R | Net R |
|---|---|---|---|---|
| 2005 | 9 | 54 | +13.52 | +6.46 |
| 2006 | 10 | 59 | -20.28 | -25.6 |
| 2007 | 11 | 66 | -11.41 | -16.14 |
| 2008 | 12 | 72 | +9.88 | +7.68 |
| 2009 | 12 | 72 | -12.17 | -14.86 |
| 2010 | 12 | 72 | +2.95 | -1.33 |
| 2011 | 12 | 72 | +4.92 | +1.7 |
| 2012 | 12 | 80 | -3.59 | -8.6 |
| 2013 | 12 | 96 | -2.51 | -8.83 |
| 2014 | 12 | 96 | -13.75 | -20.51 |
| 2015 | 12 | 96 | -2.88 | -6.98 |
| 2016 | 12 | 96 | -12.79 | -18.1 |
| 2017 | 12 | 96 | -10.28 | -19.23 |
| 2018 | 12 | 96 | +12.36 | +5.44 |
| 2019 | 12 | 96 | -2.97 | -9.16 |
| 2020 | 12 | 96 | +25.38 | +20.6 |
| 2021 | 12 | 96 | -8.57 | -14.75 |
| 2022 | 12 | 95 | -9.23 | -13.18 |
| 2023 | 12 | 96 | +8.55 | +1.65 |
| 2024 | 12 | 96 | -14.04 | -22.48 |
| 2025 | 12 | 96 | +3.16 | -4.14 |
| 2026 | 10 | 80 | +11.74 | +6.01 |

## By index (net R, base costs)

| Index | IS long / short | IS net R | OOS long / short | OOS net R |
|---|---|---|---|---|
| spx500 | 52 / 34 | -32.14 | 74 / 10 | +10.71 |
| de40 | 78 / 5 | -11.92 | 48 / 32 | -8.25 |
| uk100 | 31 / 42 | -17.05 | 33 / 51 | -21.45 |
| fr40 | 13 / 49 | +0.41 | 31 / 41 | -18.6 |
| ch20 | 41 / 41 | +4.17 | 24 / 60 | -23.26 |
| nl25 | 24 / 21 | -0.38 | 33 / 16 | -17.16 |
| es35 | 0 / 0 | 0 | 41 / 39 | +7.2 |
| jp225 | 45 / 56 | +1.3 | 70 / 30 | -0.99 |
| au200 | 27 / 31 | +2.75 | 28 / 38 | -18.52 |
| hk33 | 43 / 46 | -21.72 | 34 / 70 | +13.7 |
| cn50 | 13 / 27 | -4.74 | 37 / 55 | +8.6 |
| sg30 | 37 / 53 | +1.98 | 19 / 69 | -3.25 |
| in50 | 14 / 12 | -9.67 | 47 / 9 | +3.93 |

## Variants (reported only, never deciding)

| Variant | Window | Trades | Net R a trade | Mean R a month | t | Newey-West t |
|---|---|---|---|---|---|---|
| 6-1 | IS | 847 | -0.1343 | -0.8821 | -3.09 | -3.75 |
| 6-1 | OOS | 1040 | -0.057 | -0.4563 | -1.3 | -1.31 |
| 3-1 | IS | 853 | -0.1129 | -0.7465 | -2.73 | -3.49 |
| 3-1 | OOS | 1040 | -0.085 | -0.6798 | -1.95 | -2.03 |

## Reading

- The pre-registered bar was not met: no proposal is written and nothing changes. A FAIL is not evidence that the opposite works. Any other look-back, bucket size, weighting or universe would be a new study with its own pre-registration on data it was not chosen on.
- Related, all FAIL as well: `high52-rotation` (long-only rotation by nearness to the 52-week high), `tsmom` / `tsmom-portfolio` (each market against its own past), `commodity-xs-momentum` and `fx-xs-momentum` (this rule on commodities and dollar pairs).
- The placebo holds the same number of indices long and short at random, with the same stops and costs: it shows what the cost and the stop alone do to a book of this shape.

## What this cannot show

- Price indices without dividends (a CFD long is credited the dividend, a short pays it; left out on both sides); each index earns in its own currency; policy rates are approximate year averages; the 0.03 % spread is assumed, not measured on the demo broker.
- Thirteen national indices (ten to twelve most months) is a small cross-section next to the published one.

To repeat: `node research/edge/index-xs-momentum/run.mjs` (reads council-data with `git show`, no network). Tests: `tests/index-xs-momentum.test.mjs`.
