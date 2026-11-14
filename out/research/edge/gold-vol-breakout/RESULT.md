# Gold: the intraday volatility breakout (UTC open ± k × the previous day's range)

Paper research only. A new stand-alone intraday rule, not a gate, exit, entry or size of the live gold book (owner decision 44: none of the book's records read). Nothing live changed, no proposal. The rule, costs, windows, placebo and pass bar were pushed first (`PREREGISTRATION.md`, sha256 in `result.json`). This page is written by `run.mjs` from `result.json`.

**Verdict: FAIL, 0 of 3: gold open ± 0.5 × prior range breakout 2021 → now +0.072R a trade net (n 1121, month t +1.86, gross +0.121R); 2016-20 +0.009R**

## Tests

| Test | Rule | Period | n | Win | Net R/trade | Gross R/trade | Net at 2x cost | Cost R/trade | Total R | t (months) | Gross t | Stops / time | Max DD R | Median stop $ |
|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|
| T1 | k 0.5, both sides | 2016-2020 | 935 | 39.8 % | +0.009 | +0.111 | −0.094 | +0.102 | +8.27 | +0.22 | +2.87 | 323 / 612 | −42.89 | 6.49 |
| T1 | k 0.5, both sides | 2021 → 2026-11-12 | 1121 | 43.4 % | +0.072 | +0.121 | +0.023 | +0.049 | +80.27 | +1.86 | +3.21 | 391 / 730 | −39.18 | 13.49 |
| T2 | k 0.7, both sides | 2016-2020 | 652 | 44.0 % | +0.040 | +0.120 | −0.039 | +0.079 | +26.19 | +1.10 | +3.31 | 153 / 499 | −17.05 | 8.29 |
| T2 | k 0.7, both sides | 2021 → 2026-11-12 | 801 | 46.9 % | +0.061 | +0.099 | +0.023 | +0.038 | +48.69 | +1.54 | +2.53 | 187 / 614 | −30.24 | 17.21 |
| T3 | k 0.5, buys only, previous D1 close above its 20-day mean | 2016-2020 | 310 | 39.7 % | +0.028 | +0.136 | −0.081 | +0.108 | +8.61 | +0.39 | +1.87 | 110 / 200 | −26.26 | 6.25 |
| T3 | k 0.5, buys only, previous D1 close above its 20-day mean | 2021 → 2026-11-12 | 377 | 45.1 % | +0.058 | +0.111 | +0.006 | +0.053 | +22.04 | +0.95 | +1.80 | 143 / 234 | −20.40 | 13.07 |

## Decision (out of sample, Holm over the three tests)

| Test | p | Holm p | net > 0 | t ≥ 2 | Holm < 0.05 | in sample > 0 | 2x cost > 0 | placebos beaten (need 38 of 40) | n ≥ 30 | pass |
|---|---|---|---|---|---|---|---|---|---|---|
| T1 | 0.031 | 0.094 | yes | no | no | yes | yes | 40 | yes | **fail** |
| T2 | 0.062 | 0.124 | yes | no | no | yes | yes | 40 | yes | **fail** |
| T3 | 0.171 | 0.171 | yes | no | no | yes | yes | 39 | yes | **fail** |

## Placebo (out of sample, 40 seeds)

Every day the test could trade, one market entry at a random 5-minute mark 01:00-18:00 UTC, side by a fair coin (T3: buy), stop k × the previous day's range away, out at 21:00 UTC or the stop, the same costs.

| Test | Real net R a trade | Placebo median | Placebo 95th percentile | Placebo min / max |
|---|---|---|---|---|
| T1 | +0.072 | −0.033 | +0.002 | −0.078 / +0.013 |
| T2 | +0.061 | −0.029 | +0.001 | −0.055 / +0.019 |
| T3 | +0.058 | +0.009 | +0.041 | −0.037 / +0.065 |

## Sides and skipped days

- T1, 2021 → now: buys n 587 +0.070R, sells n 534 +0.073R; financing +0.000R a trade; days without a trade, whole period: noopen 19, flatprev 1, nofill 745.
- T2, 2021 → now: buys n 403 +0.068R, sells n 398 +0.053R; financing +0.000R a trade; days without a trade, whole period: noopen 19, flatprev 1, nofill 1348.
- T3, 2021 → now: buys n 377 +0.058R, sells n 0 —R; financing +0.000R a trade; days without a trade, whole period: noopen 19, flatprev 1, trenddown 1203, nofill 911.

## By year (net R a trade, n)

| Year | T1 | T2 | T3 |
|---|---|---|---|
| 2016 | +0.008 (180) | +0.034 (136) | +0.029 (59) |
| 2017 | −0.006 (187) | +0.000 (127) | +0.058 (70) |
| 2018 | −0.097 (188) | −0.043 (132) | −0.260 (46) |
| 2019 | −0.040 (191) | +0.046 (123) | +0.071 (66) |
| 2020 | +0.178 (189) | +0.161 (134) | +0.146 (69) |
| 2021 | +0.021 (179) | +0.010 (127) | −0.049 (53) |
| 2022 | +0.016 (193) | +0.027 (138) | +0.116 (53) |
| 2023 | −0.095 (186) | −0.092 (141) | −0.052 (64) |
| 2024 | +0.053 (200) | +0.090 (141) | −0.008 (81) |
| 2025 | +0.181 (193) | +0.175 (134) | +0.122 (92) |
| 2026 | +0.269 (170) | +0.170 (120) | +0.330 (34) |

## Reading

The primary rule (T1) does not pass the pre-registered bar (failed: t2, holm). Out of sample: T1 +0.072R net (n 1121, t +1.86; gross +0.121R, t +3.21; 2016-20 +0.009R; 40 of 40 placebos beaten; failed: t2, holm); T2 +0.061R net (n 801, t +1.54; gross +0.099R, t +2.53; 2016-20 +0.040R; 40 of 40 placebos beaten; failed: t2, holm); T3 +0.058R net (n 377, t +0.95; gross +0.111R, t +1.80; 2016-20 +0.028R; 39 of 40 placebos beaten; failed: t2, holm). Costs take 0.049R a trade on T1 at a median stop of $13.49. T1 by year out of sample: 2021 +0.021R, 2022 +0.016R, 2023 −0.095R, 2024 +0.053R, 2025 +0.181R, 2026 +0.269R; 2021-24 together −0.35R in all (n 758), so most of the out-of-sample gain is 2025-26, the years of gold's widest daily ranges. Before costs the rule leans the right way in both windows (gross month t +2.87 in 2016-20, +3.21 after), and it beats every placebo seed, but after costs the out-of-sample t is under 2 and in sample it is flat. Not an edge; nothing live changes and no proposal is written.

## Data and method

- OANDA mid XAU/USD M5 through the keyless candle proxy; 2843 weekdays built 2015-12-01 → 2026-11-12; D1 = complete UTC days folded with council/fills.mjs foldWeekend
- Rule: O = open of the first M5 candle 00:00-00:55 UTC; prevRange = high − low of the previous weekend-folded UTC D1; buy stop O + k × prevRange and sell stop O − k × prevRange live 00:00-20:55 UTC, first filled wins (a gap fills at the open; both in one candle: the level nearer its open); stop back at O (worst case in the fill candle); out at the 20:55 candle close; T1 k 0.5, T2 k 0.7, T3 k 0.5 buys only when the previous D1 close is above its 20-day mean
- Costs: $0.60 a round trip per ounce (spread and slippage), 2x reported; financing `FIN.xau.long` × `nights` on buys (no trade crosses the 22:00 UTC rollover: 0).
- To repeat: `node research/edge/gold-vol-breakout/run.mjs <dir>` with `<dir>/xau-5m-vol.json.gz` (OANDA mid M5 XAU/USD from the candle proxy, kept out of git).
