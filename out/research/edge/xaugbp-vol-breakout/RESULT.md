**Verdict: FAIL (confT2, conf2x, placebo): gold's T1 breakout on XAU/GBP, confirmation 2016-01 → 2026-10 +0.005R a trade net (n 2089, month t +0.16); discovery 2006-04 → 2015-12 +0.086R (n 1820, t +2.38)**

# Gold in pounds: gold-vol-breakout's T1 rule, unchanged, on XAU/GBP

Paper research only. Is the daily volatility breakout a gold effect whatever currency gold is priced in? It passed on XAU/USD and on XAU/EUR (`gold-eur-vol-breakout`, +0.067R, month t 3.50); here the same rule on gold priced in pounds. The rule, cost, windows, placebo and bar were pushed first (`PREREGISTRATION.md`, sha256 in `result.json`); the trading functions are imported from `research/edge/index-vol-breakout/original.mjs` (sha256 checked). Never a gate, exit, entry or size of the live gold book (owner decision 44). Nothing live changed, no proposal. Written by `run.mjs` from `result.json`.

## XAU/GBP, T1

| Period | n | Win | Net R/trade | Gross R/trade | Net at 2x cost | Cost R/trade | Total R | t (months) | Gross t | 2x-cost t | Max DD R |
|---|---|---|---|---|---|---|---|---|---|---|---|
| Discovery 2006-04 → 2015-12 | 1820 | 43.8 % | +0.086 | +0.112 | +0.060 | +0.026 | +156.48 | +2.38 | +3.11 | +1.65 | −25.42 |
| Confirmation 2016-01 → 2026-10 | 2089 | 40.5 % | +0.005 | +0.038 | −0.027 | +0.033 | +11.02 | +0.16 | +1.19 | −0.84 | −116.32 |
| Pooled | 3909 | 42.1 % | +0.043 | +0.073 | +0.013 | +0.030 | +167.50 | +1.78 | +3.02 | +0.54 | −116.32 |

## Decision (one test; Holm over one test is its own p)

| p (one-sided, confirmation) | conf. t ≥ 2 | disc. > 0 | conf. > 0 | conf. 2x cost > 0 | placebos beaten (need 38 of 40) | conf. n ≥ 200 | pass |
|---|---|---|---|---|---|---|---|
| 0.43644 | no | yes | yes | no | 36 | yes | **fail** |

## Placebo (confirmation window, 40 seeds)

| Real net R a trade | Placebo median | Placebo 95th percentile | Placebo min / max |
|---|---|---|---|
| +0.005 | −0.016 | +0.007 | −0.060 / +0.016 |

## Sides

- Discovery: buys n 904 +0.075R, sells n 916 +0.097R.
- Confirmation: buys n 1075 +0.054R, sells n 1014 −0.046R.
- Days without a trade (pooled): nofill 1404, thin 6, noopen 29.

## By year (XAU/GBP net R a trade; XAU/USD reference net)

| Year | n | Net | Gross | Total R | XAU/USD net (n) |
|---|---|---|---|---|---|
| 2006 | 145 | +0.108 | +0.128 | +15.61 | −0.058 (137) |
| 2007 | 187 | +0.132 | +0.161 | +24.68 | +0.208 (183) |
| 2008 | 188 | +0.202 | +0.220 | +38.06 | +0.191 (188) |
| 2009 | 193 | −0.002 | +0.020 | −0.42 | +0.021 (190) |
| 2010 | 189 | +0.113 | +0.139 | +21.33 | +0.137 (182) |
| 2011 | 191 | +0.005 | +0.029 | +0.97 | +0.044 (186) |
| 2012 | 184 | −0.004 | +0.030 | −0.68 | +0.038 (186) |
| 2013 | 170 | +0.072 | +0.099 | +12.25 | +0.258 (181) |
| 2014 | 184 | +0.246 | +0.279 | +45.33 | +0.136 (171) |
| 2015 | 189 | −0.003 | +0.026 | −0.63 | −0.025 (190) |
| 2016 | 187 | −0.025 | +0.005 | −4.76 | +0.008 (180) |
| 2017 | 189 | +0.002 | +0.040 | +0.36 | −0.006 (187) |
| 2018 | 203 | −0.150 | −0.110 | −30.48 | −0.097 (188) |
| 2019 | 192 | −0.112 | −0.076 | −21.58 | −0.040 (191) |
| 2020 | 190 | +0.013 | +0.039 | +2.41 | +0.178 (189) |
| 2021 | 191 | +0.011 | +0.044 | +2.13 | +0.021 (179) |
| 2022 | 190 | −0.061 | −0.030 | −11.59 | +0.016 (193) |
| 2023 | 193 | −0.132 | −0.091 | −25.39 | −0.095 (186) |
| 2024 | 205 | +0.065 | +0.100 | +13.41 | +0.053 (200) |
| 2025 | 186 | +0.243 | +0.270 | +45.26 | +0.181 (193) |
| 2026 | 163 | +0.253 | +0.272 | +41.25 | +0.256 (163) |

## Against XAU/USD (descriptive, pre-registered)

The same T1 on OANDA XAU/USD M5 (edgekit's cache, from 2006-03-20), $0.60 a round trip, same windows.

| Market | Period | n | Net R/trade | Gross R/trade | Net 2x | t (months) | Gross t |
|---|---|---|---|---|---|---|---|
| XAU/GBP | discovery | 1820 | +0.086 | +0.112 | +0.060 | +2.38 | +3.11 |
| XAU/USD | discovery | 1794 | +0.098 | +0.192 | +0.004 | +2.98 | +5.98 |
| XAU/GBP | confirmation | 2089 | +0.005 | +0.038 | −0.027 | +0.16 | +1.19 |
| XAU/USD | confirmation | 2049 | +0.041 | +0.115 | −0.032 | +1.48 | +4.25 |
| XAU/GBP | pooled | 3909 | +0.043 | +0.073 | +0.013 | +1.78 | +3.02 |
| XAU/USD | pooled | 3843 | +0.068 | +0.151 | −0.016 | +3.17 | +7.23 |

Monthly net-R sums, XAU/GBP against XAU/USD, over 247 months both traded: correlation **0.482**. Days both took a T1 trade: 3352 (XAU/GBP only 557, XAU/USD only 491); daily correlation gross R 0.568, net R 0.551; same side on 85.9 % of those days.

## Reading

T1 does not pass the pre-registered bar on XAU/GBP (failed: confT2, conf2x, placebo). Confirmation 2016-01 → 2026-10: +0.005R a trade net (n 2089, month t +0.16; gross +0.038R, t +1.19; −0.027R at 2x costs). Discovery 2006-04 → 2015-12: +0.086R (n 1820, t +2.38; gross t +3.11). 36 of 40 placebo seeds beaten on the confirmation window (placebo median −0.016R). XAU/USD over the same windows: confirmation +0.041R (n 2049, t +1.48), discovery +0.098R (t +2.98). Monthly net-R correlation with XAU/USD T1 0.482 over 247 months; same side on 85.9 % of shared days: only partly the same trades as XAU/USD. XAU/USD itself would not clear this confirmation bar either (month t +1.48 on 2016-26 at the old $0.60 cost; the measured-cost studies are what carry it there), so the 2016-26 window is a hard test for this rule on any gold quote. Before costs XAU/GBP's confirmation is +0.038R (gross month t +1.19) against XAU/USD's +0.115R (t +4.25): the pound quote keeps about a third of the dollar quote's gross; a before-cost tilt is not an edge. Worst confirmation drawdown −116.32R. The cost is a stated 0.016 % of price, not a measured XAU/GBP spread. Nothing live changes and no proposal is written.

## Data and method

- OANDA mid XAU/GBP M5 through the keyless candle proxy; 5374 weekdays built 2006-03-20 → 2026-11-23; D1 = complete UTC days folded with council/fills.mjs foldWeekend
- Rule: O = open of the first M5 candle 00:00-00:55 UTC; prevRange = high − low of the previous weekend-folded UTC D1; buy stop O + 0.5 × prevRange and sell stop O − 0.5 × prevRange live 00:00-20:55 UTC, first filled wins; stop back at O; out at the 20:55 candle close
- Costs: exactly `gold-eur-vol-breakout`'s model: 0.016 % of the day's open a round trip (≈ $0.60 at $3,700), stated, not measured (no XAU/GBP spread is measured in the repository; it is likely wider than XAU/USD's); financing `FIN.xau.long` × `nights` on buys, assumed (no trade crosses the rollover). 2x reported and in the bar.
- To repeat: `node --use-env-proxy research/edge/xaugbp-vol-breakout/run.mjs fetch <dir>`, then `node research/edge/xaugbp-vol-breakout/run.mjs <dir>` (XAU/USD from edgekit's xau 5m cache); candle caches stay out of the repository.
