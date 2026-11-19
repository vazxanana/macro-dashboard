# Gold: the opening-range breakout of the COMEX day session (08:20-08:50 New York)

Paper research only. A new stand-alone intraday rule, not a gate, exit, entry or size of the live gold book (item 44: no candle before 2016, none of the book's records read). Nothing live changed, no proposal. The rule, costs, windows, placebo and pass bar were pushed first (`PREREGISTRATION.md`, sha256 in `result.json`). This page is written by `run.mjs` from `result.json`.

**Verdict: FAIL, 0 of 3: gold 08:20-08:50 NY breakout 2021 → now +0.006R a trade net (n 1407, month t +0.20, gross +0.075R); 2016-20 −0.155R**

## Tests

| Test | Rule | Period | n | Win | Net R/trade | Gross R/trade | Net at 2x cost | Cost R/trade | Total R | t (months) | Gross t | Stops / targets / time | Max DD R | Median stop $ |
|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|
| T1 | Breakout, stop at the opposite side, 2R | 2016-2020 | 1183 | 38.8 % | −0.155 | −0.002 | −0.308 | +0.153 | −183.61 | −5.05 | −0.08 | 421 / 148 / 614 | −186.06 | 4.13 |
| T1 | Breakout, stop at the opposite side, 2R | 2021 → 2026-11-13 | 1407 | 44.6 % | +0.006 | +0.075 | −0.063 | +0.069 | +8.44 | +0.20 | +2.43 | 473 / 195 / 739 | −36.06 | 9.19 |
| T2 | T1 on a range under its 20-day median width | 2016-2020 | 600 | 39.2 % | −0.161 | +0.036 | −0.358 | +0.197 | −96.71 | −3.27 | +0.78 | 269 / 114 / 217 | −117.78 | 3 |
| T2 | T1 on a range under its 20-day median width | 2021 → 2026-11-13 | 725 | 45.2 % | +0.064 | +0.155 | −0.026 | +0.091 | +46.50 | +1.30 | +3.14 | 298 / 151 / 276 | −29.43 | 6.3 |
| T3 | Fade of the first break, stop past its extreme, 1R | 2016-2020 | 1147 | 19.8 % | −6.087 | −0.354 | −11.821 | +5.734 | −6982.14 | −6.53 | −11.47 | 774 / 370 / 3 | −6983.40 | 0.38 |
| T3 | Fade of the first break, stop past its extreme, 1R | 2021 → 2026-11-13 | 1359 | 20.5 % | −3.235 | −0.480 | −5.989 | +2.755 | −4395.90 | −12.94 | −15.79 | 1005 / 353 / 1 | −4395.90 | 0.59 |

## Decision (out of sample, Holm over the three tests)

| Test | p | Holm p | net > 0 | t ≥ 2 | Holm < 0.05 | in sample > 0 | 2x cost > 0 | above placebo 95th | pass |
|---|---|---|---|---|---|---|---|---|---|
| T1 | 0.421 | 0.841 | yes | no | no | no | no | yes | **fail** |
| T2 | 0.097 | 0.29 | yes | no | no | no | no | yes | **fail** |
| T3 | 1 | 1 | no | no | no | no | no | no | **fail** |

**Placebo** (the T1 rule on a 30-minute range starting at a random 5-minute mark 03:00-13:00 New York, one draw a day, 40 seeds, 2021 → now): seed means from −0.183 to −0.057R a trade, median −0.132, 95th percentile −0.083R.

## Sides and skipped days

- T1, 2021 → now: buys n 700 −0.019R, sells n 707 +0.031R; days without a trade, whole period: nobreak 123, range 1.
- T2, 2021 → now: buys n 334 +0.045R, sells n 391 +0.080R; days without a trade, whole period: warmup 21, wide 1360, nobreak 8.
- T3, 2021 → now: buys n 680 −3.255R, sells n 679 −3.214R; days without a trade, whole period: nobreak 123, norisk 84, range 1.

## By year (net R a trade, n)

| Year | T1 | T2 | T3 |
|---|---|---|---|
| 2016 | −0.140 (235) | −0.210 (117) | −4.179 (228) |
| 2017 | −0.192 (232) | −0.157 (124) | −8.186 (228) |
| 2018 | −0.161 (234) | −0.161 (120) | −5.541 (230) |
| 2019 | −0.215 (240) | −0.294 (123) | −9.172 (226) |
| 2020 | −0.070 (242) | +0.025 (116) | −3.471 (235) |
| 2021 | +0.019 (238) | +0.070 (134) | −3.406 (229) |
| 2022 | +0.007 (236) | +0.058 (121) | −3.786 (229) |
| 2023 | +0.074 (234) | +0.125 (125) | −5.106 (221) |
| 2024 | −0.040 (244) | −0.125 (118) | −2.826 (239) |
| 2025 | +0.052 (243) | +0.220 (121) | −2.436 (236) |
| 2026 | −0.084 (212) | +0.026 (106) | −1.806 (205) |

## Reading

The primary breakout (T1) does not pass the pre-registered bar (failed: t2, holm, isPos, cost2x). Out of sample it makes +0.006R a trade after costs (n 1407, month t +0.20; before costs +0.075R, t +2.43); costs take 0.069R a trade at a median stop of $9.19. T2 (narrow range) +0.064R (n 725, t +1.30; failed: t2, holm, isPos, cost2x); T3 (fade) −3.235R (n 1359, t −12.94; failed: netPos, t2, holm, isPos, cost2x, placebo). Before costs the breakout does lean the right way out of sample (T1 gross t +2.43, T2 gross t +3.14), but not in 2016-20 (T1 gross −0.002R), and the spread and slippage take what there is. T3's per-trade figures are large because its stop sits a median $0.59 from the entry (the break candle often closes near its extreme), so $0.60 of cost is several R; it loses before costs too (gross −0.480R, t −15.79). Not an edge; nothing live changes and no proposal is written.

## Data and method

- OANDA mid XAU/USD M5 through the keyless candle proxy, 2714 trading days 2016-01-04 → 2026-11-13; New York time and the CME calendar from ict/calendar.mjs (full holidays and early closes skipped)
- Rule: range = high/low of the six M5 candles 08:20-08:45 NY; break = first M5 close outside it on a candle starting 08:50-11:25; entry at the next open (market); T1 with the break, stop at the opposite side, 2R; T2 = T1 on days whose range is under the median of the previous 20; T3 against the break, stop at the 08:20 → break-candle extreme, 1R; stop first, a gap through the stop fills at the open; flat at 12:00 NY; one trade a day
- Costs: $0.30 a round trip per ounce plus $0.15 slippage per market order (entry always; a stop or 12:00 exit; a target is a limit), 2x reported; no financing (flat by 12:00 New York).
- To repeat: `node --use-env-proxy research/edge/gold-comex-orb/fetch.mjs <dir>`, then `node research/edge/gold-comex-orb/run.mjs <dir>`.
