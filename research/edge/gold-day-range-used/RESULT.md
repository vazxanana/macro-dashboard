# Gold: a day range already used up by 15:00 UTC, faded (or followed) to 21:00 UTC

Paper research only. A new stand-alone intraday rule, **not a gate, exit, entry or size of the live gold book** (owner decision 44: none of the book's records read). Nothing live changed, no proposal. The rule, costs, windows, baseline, placebo and pass bar were pushed first (`PREREGISTRATION.md`, sha256 in `result.json`). This page is written by `run.mjs` from `result.json`.

**Verdict: FAIL, 0 of 3: fading gold's used-up day 15-21 UTC made −0.126R a trade net 2017-26 (n 391), −0.067R over the same side every day (month t −1.96); 2007-16 −0.068R.**

## Tests (R of the 0.5 x ADR stop; t on calendar-month sums)

| Test | Period | n | Win | Gross R | Net R | Net at 2x | Same-side baseline R | Excess R | t net | t gross | t excess | t 2x | Stops | Max DD R | Median stop $ |
|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|
| T1 Fade a used-up day (U >= 1.0) | 2007-2016 | 381 | 40.7 % | −0.074 | −0.147 | −0.220 | −0.079 | −0.068 | −4.15 | −2.11 | −2.06 | −6.06 | 85 | −59.99 | 8.73 |
| T1 Fade a used-up day (U >= 1.0) | 2017 → 2026-10 | 391 | 41.9 % | −0.069 | −0.126 | −0.183 | −0.059 | −0.067 | −3.56 | −1.94 | −1.96 | −5.13 | 77 | −50.78 | 11.81 |
| T1 Fade a used-up day (U >= 1.0) | 2017-2021 | 191 | 45.0 % | −0.020 | −0.095 | −0.170 | −0.074 | −0.020 | −1.87 | −0.38 | −0.41 | −3.34 | 35 | −24.27 | 9.07 |
| T1 Fade a used-up day (U >= 1.0) | 2022 → 2026-10 | 200 | 39.0 % | −0.117 | −0.156 | −0.195 | −0.045 | −0.111 | −3.14 | −2.36 | −2.37 | −3.88 | 42 | −31.72 | 14.97 |
| T2 Fade a well over-used day (U >= 1.5) | 2007-2016 | 99 | 34.3 % | −0.208 | −0.283 | −0.357 | −0.068 | −0.215 | −3.55 | −2.58 | −2.84 | −4.50 | 35 | −34.24 | 8.22 |
| T2 Fade a well over-used day (U >= 1.5) | 2017 → 2026-10 | 105 | 39.0 % | −0.114 | −0.173 | −0.231 | −0.049 | −0.124 | −2.17 | −1.45 | −1.62 | −2.87 | 29 | −18.66 | 11.36 |
| T2 Fade a well over-used day (U >= 1.5) | 2017-2021 | 52 | 44.2 % | −0.026 | −0.103 | −0.180 | −0.056 | −0.047 | −1.32 | −0.34 | −0.60 | −2.26 | 11 | −8.21 | 9.11 |
| T2 Fade a well over-used day (U >= 1.5) | 2022 → 2026-10 | 53 | 34.0 % | −0.200 | −0.241 | −0.281 | −0.042 | −0.198 | −1.75 | −1.47 | −1.53 | −2.01 | 18 | −13.47 | 14.43 |
| T3 Follow a used-up day (U >= 1.0) | 2007-2016 | 381 | 46.5 % | +0.090 | +0.017 | −0.056 | −0.050 | +0.067 | +0.46 | +2.44 | +1.87 | −1.44 | 55 | −11.95 | 8.73 |
| T3 Follow a used-up day (U >= 1.0) | 2017 → 2026-10 | 391 | 47.8 % | +0.066 | +0.009 | −0.048 | −0.050 | +0.059 | +0.24 | +1.81 | +1.65 | −1.29 | 51 | −13.36 | 11.81 |
| T3 Follow a used-up day (U >= 1.0) | 2017-2021 | 191 | 42.9 % | +0.030 | −0.046 | −0.121 | −0.070 | +0.025 | −0.81 | +0.53 | +0.44 | −2.10 | 26 | −10.53 | 9.07 |
| T3 Follow a used-up day (U >= 1.0) | 2022 → 2026-10 | 200 | 52.5 % | +0.100 | +0.061 | +0.022 | −0.031 | +0.092 | +1.32 | +2.15 | +2.05 | +0.47 | 25 | −5.02 | 14.97 |

## Decision (out of sample, Holm over the three tests on the excess t)

| Test | p | Holm p | excess > 0 | excess t ≥ 2 | Holm < 0.05 | 2007-16 excess > 0 | net > 0 | 2x cost > 0 | placebos beaten (need 38 of 40) | n ≥ 30 | pass |
|---|---|---|---|---|---|---|---|---|---|---|---|
| T1 | 0.975 | 1 | no | no | no | no | no | no | 0 | yes | **fail** |
| T2 | 0.947 | 1 | no | no | no | no | no | no | 1 | yes | **fail** |
| T3 | 0.049 | 0.148 | yes | no | no | yes | yes | no | 40 | yes | **fail** |

**Placebo** (each out-of-sample trade moved to a random other eligible weekday of 2017-26, same side and mechanics; 40 seeds):

- T1: seed means −0.125 to +0.013R a trade, median −0.054, 95th percentile −0.007R; the test's own −0.126R beats 0.
- T2: seed means −0.174 to +0.062R a trade, median −0.086, 95th percentile +0.046R; the test's own −0.173R beats 1.
- T3: seed means −0.114 to +0.006R a trade, median −0.057, 95th percentile −0.009R; the test's own +0.009R beats 40.

## Sides and skipped days

- T1, 2017 → 2026-10: buys n 176 net −0.144R excess −0.082R; sells n 215 net −0.111R excess −0.054R; cost +0.057R a trade; financing +0.000R.
- T2, 2017 → 2026-10: buys n 56 net −0.253R excess −0.189R; sells n 49 net −0.080R excess −0.049R; cost +0.059R a trade; financing +0.000R.
- T3, 2017 → 2026-10: buys n 215 net +0.008R excess +0.066R; sells n 176 net +0.011R excess +0.050R; cost +0.057R a trade; financing +0.000R.
- Weekdays without a reading, whole file: morning 35, window 3.

## By year (net R / excess R a trade, n)

| Year | T1 | T2 | T3 |
|---|---|---|---|
| 2007 | −0.210 / −0.076 (44) | +0.316 / +0.419 (13) | −0.099 / +0.024 (44) |
| 2008 | −0.197 / −0.142 (37) | −0.269 / −0.229 (8) | +0.105 / +0.140 (37) |
| 2009 | −0.219 / −0.150 (32) | −0.563 / −0.436 (3) | +0.070 / +0.120 (32) |
| 2010 | −0.254 / −0.193 (35) | −0.572 / −0.503 (10) | +0.109 / +0.180 (35) |
| 2011 | −0.069 / +0.032 (38) | −0.069 / −0.064 (12) | +0.077 / +0.009 (38) |
| 2012 | +0.064 / +0.095 (30) | −0.208 / −0.201 (10) | −0.135 / −0.114 (30) |
| 2013 | −0.161 / −0.118 (48) | −0.448 / −0.392 (13) | −0.006 / +0.061 (48) |
| 2014 | −0.291 / −0.217 (37) | −0.366 / −0.313 (11) | +0.196 / +0.254 (37) |
| 2015 | −0.056 / +0.027 (43) | −0.276 / −0.162 (10) | −0.109 / −0.019 (43) |
| 2016 | −0.054 / +0.069 (37) | −0.778 / −0.623 (9) | −0.006 / +0.017 (37) |
| 2017 | −0.093 / −0.017 (31) | −0.447 / −0.483 (4) | −0.080 / +0.005 (31) |
| 2018 | −0.055 / +0.032 (36) | −0.299 / −0.212 (11) | −0.109 / +0.009 (36) |
| 2019 | −0.206 / −0.074 (32) | +0.007 / +0.160 (10) | +0.001 / +0.104 (32) |
| 2020 | −0.155 / −0.128 (41) | −0.072 / −0.075 (13) | +0.054 / +0.095 (41) |
| 2021 | −0.006 / +0.060 (51) | +0.041 / +0.084 (14) | −0.089 / −0.058 (51) |
| 2022 | −0.207 / −0.176 (46) | −0.207 / −0.163 (14) | +0.093 / +0.168 (46) |
| 2023 | −0.204 / −0.147 (43) | −0.559 / −0.465 (13) | +0.157 / +0.179 (43) |
| 2024 | −0.094 / −0.066 (41) | +0.092 / +0.100 (11) | −0.054 / −0.017 (41) |
| 2025 | −0.117 / −0.038 (44) | −0.264 / −0.207 (8) | +0.015 / +0.034 (44) |
| 2026 | −0.151 / −0.132 (26) | −0.211 / −0.233 (7) | +0.104 / +0.082 (26) |

## Reading

The primary test does not pass the pre-registered bar. Out of sample: T1 net −0.126R, gross −0.069R, excess −0.067R (n 391, excess t −1.96; 2007-16 excess −0.068R, t −2.06; failed: excessPos, t2, holm, isExcessPos, netPos, cost2x, placebo); T2 net −0.173R, gross −0.114R, excess −0.124R (n 105, excess t −1.62; 2007-16 excess −0.215R, t −2.84; failed: excessPos, t2, holm, isExcessPos, netPos, cost2x, placebo); T3 net +0.009R, gross +0.066R, excess +0.059R (n 391, excess t +1.65; 2007-16 excess +0.067R, t +1.87; failed: t2, holm, cost2x). The same-side baseline (15:00 → 21:00 UTC on every eligible day) made 2017-26 buys −0.050R and sells −0.057R a trade net (2007-16 −0.043R / −0.079R): the cost alone is about 0.057R a trade at a median stop of $11.81. Placebo seeds beaten: T1 0, T2 1, T3 40 of 40. Not an edge; nothing live changes and no proposal is written.

## Data and method

- OANDA mid XAU/USD H1 (keyless candle proxy), 5154 weekdays 2007-01-01 → 2026-10-30, UTC hours
- Rule: U = range of the 00:00-14:00 UTC H1 candles / ADR (mean whole-day range of the 20 previous complete weekdays); P = place of the 14:00 candle close in that range; T1 U >= 1.0 and P >= 0.8 sell / P <= 0.2 buy; T2 the same with U >= 1.5; T3 the opposite side (follow) with U >= 1.0; market at the 15:00 UTC open, stop 0.5 x ADR, out at the 20:00 candle close (21:00 UTC); stop first, a gap through fills at the open; excess = net R minus the mean net R of the same side on every eligible day of the same calendar month
- Costs: $0.60 a round trip per ounce (spread and slippage), 2x reported; financing `nights` x `FIN.xau.long` on buys from `council/fills.mjs` (0 here: every trade is out at 21:00 UTC, before the 22:00 UTC rollover).
- To repeat: `node research/edge/gold-day-range-used/run.mjs <xau-1h.json.gz>` (OANDA mid H1 XAU/USD as `[unixSec, o, h, l, c]` rows from the keyless candle proxy `/md/bars?sym=xau&tf=1h`, kept out of git).
