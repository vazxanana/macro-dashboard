# Gold: what to expect from the intraday volatility breakout (risk profile)

Paper research only. A descriptive risk profile of a stand-alone intraday rule on spot gold, the `gold-vol-breakout` study's T1, for the owner to read before any paper or demo step. No hypothesis is tested and nothing passes or fails. The rule is not a gate, exit, entry or size of the live gold book, and none of that book's records were read (owner decision 44). Nothing live changed; no proposal is written. The plan was pushed first (`PREREGISTRATION.md`, sha256 in `result.json`); the trading code is the replicate study's, copied verbatim (`replicate.mjs`, `original.mjs`, sha256 in `result.json`). This page is written by `run.mjs` from `result.json`.

**Verdict: Descriptive risk profile, no test: T1 2007-26 +0.072R a trade net (n 3706, month t +3.30), worst drawdown −42.9R, 12-month band −14.9 to +44.3R, stop line −14.9R**

## Harness gate

| Window | n | Net R | Gross R | Month t | Gross t | Net 2x | Replicate study | Exact |
|---|---|---|---|---|---|---|---|---|
| 2007-2015 | 1657 | +0.111 | +0.203 | +3.19 | +5.96 | +0.018 | 1657 / +0.111 / +3.19 | yes |
| 2007 → 2026-11-12 | 3713 | +0.073 | +0.155 | +3.35 | +7.24 | −0.009 | 3713 / +0.073 / +3.35 | yes |

## The record, 2007-01-01 → 2026-10-31 (whole months)

| Window | n | Net R/trade | Gross R/trade | Month t (net) | Month t (gross) | Net at 2x cost |
|---|---|---|---|---|---|---|
| 2007-2026-10 | 3706 | +0.072 | +0.154 | +3.30 | +7.19 | −0.010 |
| in sample 2007-2016 | 1837 | +0.101 | +0.193 | +3.14 | +6.13 | +0.008 |
| out of sample 2017-2026-10 | 1869 | +0.044 | +0.116 | +1.49 | +4.01 | −0.027 |

Outside every figure: 1-12 Nov 2026, 7 trades, +0.569R a trade net. The month t figures describe the record; they are not tests (no p-value, no Holm).

| At | Total R | R a year | Trades a year | Worst closed drawdown | Drawdown from → low → regained | Longest under water | Worst month | Worst year (2007-25) | Longest losing streak | Months positive |
|---|---|---|---|---|---|---|---|---|---|---|
| $0.60 a round trip | +268.2 | +13.58 | 187.7 | −42.89R | 2016-06-21 → 2019-07-01 → 2020-11-09 | 4.36 years (2016-06-21 → 2020-11-09) | 2023-06 −9.12R | 2018 −18.15R | 11 trades | 55.0 % |
| 2x costs ($1.20) | −35.6 | −1.81 | 187.7 | −187.40R | 2014-07-14 → 2024-05-16 → not regained | 12.23 years (2014-07-14 → still under) | 2008-01 −11.08R | 2018 −41.38R | 11 trades | 47.1 % |

| Year | Net R at $0.60 | Net R at 2x |
|---|---|---|
| 2007 | +38.05 | +8.54 |
| 2008 | +35.96 | +19.60 |
| 2009 | +4.08 | −13.04 |
| 2010 | +24.95 | +9.56 |
| 2011 | +8.17 | −3.49 |
| 2012 | +7.03 | −6.63 |
| 2013 | +46.76 | +34.14 |
| 2014 | +23.34 | +5.24 |
| 2015 | −4.66 | −23.50 |
| 2016 | +1.51 | −14.97 |
| 2017 | −1.15 | −23.96 |
| 2018 | −18.15 | −41.38 |
| 2019 | −7.62 | −29.71 |
| 2020 | +33.67 | +22.55 |
| 2021 | +3.72 | −8.42 |
| 2022 | +3.16 | −8.77 |
| 2023 | −17.76 | −30.66 |
| 2024 | +10.53 | +0.74 |
| 2025 | +34.90 | +29.17 |
| 2026 (to October) | +41.74 | +39.37 |

## Risk a trade, in % of the account (simple, not compounded)

One trade a day at most, so the open risk is never more than one trade's. Simple % means R × risk with no compounding, so a figure past −100 % says the account would be gone, not a real percentage. The 1-in-20 ten-year drawdown is the 95th percentile of the worst closed drawdown over 120 months drawn by month-block bootstrap (20000 draws, seed 45): −57.2R (median −32.3R).

| Risk a trade | % a year | Worst drawdown % (history) | 1-in-20 ten-year drawdown % | Years under water (history) | % a year at 2x costs | Worst drawdown % at 2x costs |
|---|---|---|---|---|---|---|
| 0.1 % | +1.36 | −4.29 | −5.72 | 4.36 | −0.18 | −18.74 |
| 0.25 % | +3.40 | −10.72 | −14.31 | 4.36 | −0.45 | −46.85 |
| 0.5 % | +6.79 | −21.44 | −28.62 | 4.36 | −0.90 | −93.70 |
| 1 % | +13.58 | −42.89 | −57.23 | 4.36 | −1.81 | −187.40 |

## Forward bands and pre-committed stop lines

Month-block bootstrap of the daily net R of the record (20000 draws, seed 44): each path draws whole calendar months with replacement. "No edge" and "losing" take 1x and 2x the mean net R a trade (+0.072R) off every trade.

| World | Months | Trades | Total p5 | p50 | p95 | Total below 0 | Drawdown p50 | Drawdown p95 |
|---|---|---|---|---|---|---|---|---|
| as measured | 12 | 188 | −14.9 | +13.1 | +44.3 | 23.2 % | −13.9 | −27.2 |
| as measured | 24 | 375 | −14.2 | +26.4 | +69.9 | 14.3 % | −18.5 | −35.8 |
| as measured | 36 | 563 | −10.5 | +40.3 | +93.3 | 9.8 % | −21.6 | −40.9 |
| no edge | 12 | 188 | −28.6 | −0.5 | +30.8 | 50.8 % | −18.9 | −36.8 |
| no edge | 24 | 375 | −41.4 | −0.7 | +42.9 | 51.0 % | −27.6 | −54.0 |
| no edge | 36 | 563 | −51.4 | −0.3 | +53.0 | 50.5 % | −33.9 | −66.7 |
| losing (2x mean off) | 12 | 188 | −42.3 | −14.0 | +17.4 | 77.3 % | −26.2 | −48.2 |
| losing (2x mean off) | 24 | 375 | −68.5 | −27.6 | +16.2 | 85.1 % | −43.2 | −76.6 |
| losing (2x mean off) | 36 | 563 | −92.1 | −41.0 | +12.8 | 89.8 % | −58.0 | −101.3 |

Stop lines, fixed from the as-measured world before any forward record exists. A line crossed would send the rule back off paper by the owner's decision; it never closes a trade.

| Line | Level | False alarm (as measured) | Detected: no edge | Detected: losing |
|---|---|---|---|---|
| S1 | worst closed drawdown over 40.9R at any time in 36 months | 5.0 % | 33.8 % | 78.6 % |
| S2 | total under −14.9R at 12 months | 5.0 % | 21.1 % | 48.1 % |
| S3 | total under −14.2R at 24 months | 5.0 % | 29.6 % | 69.6 % |
| S4 | total under −10.5R at 36 months | 5.0 % | 36.8 % | 82.7 % |
| any | any of S1-S4 within 36 months | 11.7 % | 51.0 % | 89.4 % |

## How long a forward record needs for t ≥ 2

| At | Mean net R a trade | sd | Trades for t ≥ 2 | Years | Month mean / sd | Months for t ≥ 2 |
|---|---|---|---|---|---|---|
| $0.60 | +0.072 | 1.382 | 1460 | 7.8 | +1.127 / 5.267 | 88 |
| 2x costs | −0.010 | 1.386 | never (mean not positive) | — | −0.150 / 5.448 | never |

## Overlap with gold (descriptive)

The live book's records were not read (owner decision 44); gold's own return stands in for a long-gold holding.

| Measure | n | Value |
|---|---|---|
| Correlation, T1 daily net R with gold's same-day return, every weekday | 5154 | −0.063 |
| The same, trading days only | 3706 | −0.064 |
| Correlation, T1 monthly R with long-gold buy-and-hold's monthly return | 238 | −0.009 |
| Net R a trade on days gold closed up | 1928 | +0.029 |
| Net R a trade on days gold closed down | 1778 | +0.119 |
| Buys | 1838 | +0.087 |
| Sells | 1868 | +0.058 |

## Placebo (40 seeds, context)

The replicate study's placebo on the days T1 could trade: a market entry at a random 5-minute mark 01:00-18:00 UTC, fair-coin side, stop 0.5 × the previous day's range away, out at 21:00 UTC or the stop, the same costs. It trades on every eligible day (no fill needed), so it takes more trades than T1 and its drawdowns are larger for that reason too.

| T1 net R a trade | Placebo median | Placebo 95th percentile | Seeds beaten | Placebo trades a record | Placebo worst drawdown median (min / max) | T1 worst drawdown |
|---|---|---|---|---|---|---|
| +0.072 | −0.048 | −0.024 | 40 of 40 | 5108.3 | −272.9R (−161.3 / −429.4) | −42.89R |

## What a 12-month paper record could and could not show

A 12-month paper record of T1 is about 188 trades. If the rule is exactly as measured on 2007-26, its year ends between −14.9R and +44.3R nine times in ten (median +13.1R) and is a losing year 23.2 % of the time; if it has no edge at all, the year ends between −28.6R and +30.8R (median −0.5R). The two ranges overlap almost entirely, so one year cannot show that the rule works or that it does not: the 12-month line (−14.9R) stops a rule with no edge only 21.1 % of the time and a losing one 48.1 %, and a forward t of 2 at the measured mean takes about 1460 trades, 7.8 years. The history itself had a 4.36-year stretch under water (2016-06-21 to 2020-11-09) and the out-of-sample stretch 2017-26 made +0.044R a trade (month t +1.49). What a year can show is the part the backtest cannot: whether every trade really carries its stop at the open, whether the orders fill near the levels, and above all what a round trip really costs. Costs are 0.082R of the +0.154R gross a trade, and at twice the assumed $0.60 the 2007-26 record is −0.010R a trade (−35.6R in all, under water since 2014-07-14); a measured demo cost is the one figure a 12-month record can settle.

## Data and method

- OANDA mid XAU/USD M5 through the keyless candle proxy; 5206 weekdays built 2006-11-01 → 2026-11-12; D1 = complete UTC days folded with council/fills.mjs foldWeekend
- Rule: O = open of the first M5 candle 00:00-00:55 UTC; prevRange = high − low of the previous weekend-folded UTC D1; buy stop O + 0.5 × prevRange and sell stop O − 0.5 × prevRange live 00:00-20:55 UTC, first filled wins; stop back at O (worst case in the fill candle); out at the 20:55 candle close
- Costs: $0.60 a round trip per ounce (the original study's fixed figure, today's level; older spreads were not measured), 2x reported; financing `FIN.xau.long` × `nights` on buys (no trade crosses the 22:00 UTC rollover: 0).
- Daily R series: one value per built weekday, 0 on a day without a trade; drawdowns are closed (end of day), from the running high, the record starting at 0. Risk figures are simple %, not compounded.
- To repeat: `node research/edge/gold-vol-breakout-risk/run.mjs <dir>` with `<dir>/xau-5m.json.gz` (OANDA mid M5 XAU/USD 2006-11 on, from the candle proxy, out of git).
