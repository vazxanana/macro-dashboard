# Gold in euros: gold-vol-breakout's T1 rule, unchanged, on XAU/EUR

Paper research only. Is the daily volatility breakout of `gold-vol-breakout` (passed on XAU/USD 2007-15, branch `gold-vol-breakout-replicate`) about gold itself or about the dollar leg? The same rule on gold priced in euros. Not a rule for any live book and never a gate, exit, entry or size of the live gold book (owner decision 44). Nothing live changed, no proposal. The rule, cost, window, placebo and pass bar were pushed first (`PREREGISTRATION.md`, sha256 in `result.json`); the trading functions are imported from `original.mjs`, a verbatim copy of the original study's `run.mjs` (sha256 in `result.json`). This page is written by `run.mjs` from `result.json`.

**Verdict: PASS: gold's T1 breakout on XAU/EUR 2006-04 → 2026-10 +0.067R a trade net (n 3873, month t +3.50; gross +0.099R, t +5.23)**

## XAU/EUR, T1

| Period | n | Win | Net R/trade | Gross R/trade | Net at 2x cost | Cost R/trade | Total R | t (months) | Gross t | 2x-cost t | Stops / time | Max DD R | Median stop € |
|---|---|---|---|---|---|---|---|---|---|---|---|---|---|
| 2006-04 → 2026-10 (pooled) | 3873 | 43.4 % | +0.067 | +0.099 | +0.035 | +0.032 | +258.42 | +3.50 | +5.23 | +1.80 | 1344 / 2529 | −33.96 | 6.45 |
| 2006-04 → 2016-12 (H1) | 1994 | 44.1 % | +0.087 | +0.116 | +0.059 | +0.028 | +174.32 | +3.23 | +4.30 | +2.17 | 697 / 1297 | −33.96 | 5.5 |
| 2017-01 → 2026-10 (H2) | 1879 | 42.5 % | +0.045 | +0.081 | +0.009 | +0.036 | +84.10 | +1.66 | +3.04 | +0.32 | 647 / 1232 | −26.17 | 8.13 |

## Decision (one test; Holm over one test is its own p)

| p (one-sided, pooled) | pooled t ≥ 2 | H1 > 0 | H2 > 0 | pooled 2x cost > 0 | placebos beaten (need 38 of 40) | n ≥ 30 each half | pass |
|---|---|---|---|---|---|---|---|
| 0.00023 | yes | yes | yes | yes | 40 | yes | **pass** |

## Placebo (2006-04 → 2026-10, 40 seeds)

The original study's placebo: every day T1 could trade, one market entry at a random 5-minute mark 01:00-18:00 UTC, side by a fair coin, stop 0.5 × the previous day's range away, out at 21:00 UTC or the stop, the same cost per day.

| Real net R a trade | Placebo median | Placebo 95th percentile | Placebo min / max |
|---|---|---|---|
| +0.067 | −0.009 | +0.007 | −0.038 / +0.030 |

## Sides and skipped days

- H1: buys n 980 +0.079R, sells n 1014 +0.096R; financing +0.000R a trade.
- H2: buys n 962 +0.091R, sells n 917 −0.004R; financing +0.000R a trade.
- Days without a trade, whole window: nofill 1442, thin 4, noopen 29.

## By year (XAU/EUR net and gross R a trade; XAU/USD reference net)

| Year | n | Net | Gross | Total R | XAU/USD net (n) |
|---|---|---|---|---|---|
| 2006 | 142 | +0.169 | +0.190 | +24.05 | −0.287 (27) |
| 2007 | 179 | +0.184 | +0.216 | +32.95 | +0.208 (183) |
| 2008 | 185 | +0.028 | +0.047 | +5.18 | +0.191 (188) |
| 2009 | 196 | +0.011 | +0.037 | +2.09 | +0.021 (190) |
| 2010 | 184 | +0.182 | +0.209 | +33.41 | +0.137 (182) |
| 2011 | 189 | +0.250 | +0.274 | +47.34 | +0.044 (186) |
| 2012 | 186 | −0.061 | −0.028 | −11.37 | +0.038 (186) |
| 2013 | 177 | +0.158 | +0.184 | +27.92 | +0.258 (181) |
| 2014 | 179 | +0.127 | +0.162 | +22.80 | +0.136 (171) |
| 2015 | 194 | −0.027 | +0.000 | −5.31 | −0.025 (190) |
| 2016 | 183 | −0.026 | +0.012 | −4.74 | +0.008 (180) |
| 2017 | 195 | +0.068 | +0.114 | +13.34 | −0.006 (187) |
| 2018 | 190 | −0.080 | −0.030 | −15.11 | −0.097 (188) |
| 2019 | 189 | +0.024 | +0.069 | +4.48 | −0.040 (191) |
| 2020 | 187 | +0.055 | +0.084 | +10.34 | +0.178 (189) |
| 2021 | 184 | +0.034 | +0.069 | +6.25 | +0.021 (179) |
| 2022 | 196 | +0.026 | +0.058 | +5.03 | +0.016 (193) |
| 2023 | 191 | −0.066 | −0.024 | −12.68 | −0.095 (186) |
| 2024 | 197 | +0.170 | +0.204 | +33.50 | +0.053 (200) |
| 2025 | 192 | +0.013 | +0.041 | +2.58 | +0.181 (193) |
| 2026 | 158 | +0.230 | +0.249 | +36.37 | +0.256 (163) |

## Against XAU/USD (descriptive, pre-registered)

The same T1 on OANDA XAU/USD M5 (the replicate study's cache, which starts 2006-11-01), $0.60 a round trip, same window.

| Market | Period | n | Net R/trade | Gross R/trade | Net 2x | t (months) | Gross t |
|---|---|---|---|---|---|---|---|
| XAU/EUR | pooled | 3873 | +0.067 | +0.099 | +0.035 | +3.50 | +5.23 |
| XAU/USD | pooled | 3733 | +0.070 | +0.152 | −0.013 | +3.19 | +7.13 |
| XAU/EUR | H1 | 1994 | +0.087 | +0.116 | +0.059 | +3.23 | +4.30 |
| XAU/USD | H1 | 1864 | +0.095 | +0.189 | +0.002 | +2.99 | +6.04 |
| XAU/EUR | H2 | 1879 | +0.045 | +0.081 | +0.009 | +1.66 | +3.04 |
| XAU/USD | H2 | 1869 | +0.044 | +0.116 | −0.027 | +1.49 | +4.01 |

Days both markets took a T1 trade: 3254 (XAU/EUR only 619, XAU/USD only 479). Daily correlation of gross R 0.59, of net R 0.589; same side on 86.5 % of those days.

## Reading

T1 passes every pre-registered check on XAU/EUR. Paper research only; it says the breakout is in gold's own moves rather than only in the dollar, not that it is an edge to trade. Pooled 2006-04 → 2026-10: +0.067R a trade net (n 3873, month t +3.50; gross +0.099R, t +5.23; +0.035R at 2x costs). H1 2006-16 +0.087R (n 1994, t +3.23; gross t +4.30); H2 2017-26 +0.045R (n 1879, t +1.66; gross t +3.04). 40 of 40 placebo seeds beaten (placebo median −0.009R). Costs take 0.032R a trade. 16 of 21 years positive after costs. For reference the same rule on XAU/USD over the same window (from 2006-11-01): +0.070R net (n 3733, t +3.19; gross t +7.13). On the 3254 days both traded, the two results correlate 0.59 (gross R) and take the same side 86.5 % of the time: on most days the XAU/EUR trade is the XAU/USD trade with the dollar taken out, so gold's own move, not the dollar, sets the side. It is the same effect seen without the dollar leg, not a second, independent one to add beside XAU/USD. The later half alone does not reach t 2 (H2 month t +1.66, net +0.045R), as on XAU/USD over the same years; the pre-registered bar is the pooled t. Before costs the effect is smaller in euros (+0.099R a trade against +0.152R on XAU/USD), so part of the XAU/USD gross may come with the dollar leg; the net figures are close only because the cost here is lower in R. The cost here is a stated 0.016 % of price, not a measured XAU/EUR spread; it charges less in R than the XAU/USD reference's fixed $0.60 in the years gold was cheap. At twice it (0.032 %) the pooled stream is still +0.035R a trade, month t +1.80. Read with the XAU/USD result: the breakout does not depend on the dollar leg. Nothing live changes and no proposal is written.

## Data and method

- OANDA mid XAU/EUR M5 through the keyless candle proxy; 5367 weekdays built 2006-03-20 → 2026-11-12; D1 = complete UTC days folded with council/fills.mjs foldWeekend
- Rule: O = open of the first M5 candle 00:00-00:55 UTC; prevRange = high − low of the previous weekend-folded UTC D1; buy stop O + 0.5 × prevRange and sell stop O − 0.5 × prevRange live 00:00-20:55 UTC, first filled wins (a gap fills at the open; both in one candle: the level nearer its open); stop back at O (worst case in the fill candle); out at the 20:55 candle close
- Costs: 0.016 % of the day's open a round trip (≈ $0.60 at $3,700; stated, not measured: no XAU/EUR spread is measured in the repository), 2x reported; financing `FIN.xau.long` × `nights` on buys, assumed for XAU/EUR (no trade crosses the 22:00 UTC rollover: 0).
- To repeat: `node --use-env-proxy research/edge/gold-eur-vol-breakout/run.mjs fetch <dir>`, then `node research/edge/gold-eur-vol-breakout/run.mjs <dir> <xauDir>` (`<xauDir>/xau-5m.json.gz` = the replicate study's XAU/USD cache); candle caches stay out of the repository.
