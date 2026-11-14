# Gold: the first pullback after the 08:30 New York impulse

Paper research only. A new stand-alone intraday rule, **not a gate, exit, entry or size of the live gold book** (owner decision 44: none of the book's records read). Nothing live changed, no proposal. The rule, costs, windows, placebo and pass bar were pushed first (`PREREGISTRATION.md`, sha256 in `result.json`). This page is written by `run.mjs` from `result.json`.

**Verdict: FAIL, 0 of 3: buying / selling the 50 % pullback of gold's 08:30 NY impulse, 2017 → now −0.172R a trade net (n 690, month t −4.06, gross −0.005R); 2007-16 −0.178R**

## Tests (R of the actual stop distance; t on calendar-month sums of net R)

| Test | Rule | Period | n | Win | Net R/trade | Gross R/trade | Net at 2x cost | Cost R/trade | Total R | t (months) | Gross t | Stops / targets / time | Max DD R | Median stop $ |
|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|
| T1 | 50 % retrace limit with the impulse, 1.5R target, out 16:00 NY | 2007-2016 | 721 | 41.3 % | −0.178 | +0.020 | −0.377 | +0.198 | −128.52 | −3.98 | +0.46 | 383 / 257 / 81 | −128.52 | 3.32 |
| T1 | 50 % retrace limit with the impulse, 1.5R target, out 16:00 NY | 2017 → 2026-11-13 | 690 | 41.0 % | −0.172 | −0.005 | −0.340 | +0.167 | −118.94 | −4.06 | −0.12 | 380 / 238 / 72 | −123.11 | 4.1 |
| T1 | 50 % retrace limit with the impulse, 1.5R target, out 16:00 NY | 2017-2021 | 348 | 39.9 % | −0.233 | −0.027 | −0.440 | +0.206 | −81.19 | −3.71 | −0.44 | 195 / 117 / 36 | −83.91 | 3.26 |
| T1 | 50 % retrace limit with the impulse, 1.5R target, out 16:00 NY | 2022 → 2026-11-13 | 342 | 42.1 % | −0.110 | +0.017 | −0.238 | +0.128 | −37.75 | −1.96 | +0.31 | 185 / 121 / 36 | −53.97 | 5.43 |
| T2 | T1 with the target at the impulse extreme | 2007-2016 | 721 | 48.8 % | −0.216 | −0.017 | −0.414 | +0.198 | −155.53 | −5.98 | −0.50 | 344 / 334 / 43 | −156.16 | 3.32 |
| T2 | T1 with the target at the impulse extreme | 2017 → 2026-11-13 | 690 | 47.8 % | −0.203 | −0.035 | −0.370 | +0.167 | −139.93 | −5.11 | −0.93 | 344 / 312 / 34 | −143.52 | 4.1 |
| T2 | T1 with the target at the impulse extreme | 2017-2021 | 348 | 45.4 % | −0.309 | −0.102 | −0.515 | +0.206 | −107.39 | −5.04 | −1.78 | 181 / 151 / 16 | −111.89 | 3.26 |
| T2 | T1 with the target at the impulse extreme | 2022 → 2026-11-13 | 342 | 50.3 % | −0.095 | +0.033 | −0.223 | +0.128 | −32.54 | −2.03 | +0.66 | 163 / 161 / 18 | −40.54 | 5.43 |
| T3 | T1 on impulses of 0.5 x ATR(14) or more | 2007-2016 | 127 | 42.5 % | −0.124 | −0.003 | −0.245 | +0.121 | −15.70 | −1.26 | −0.03 | 57 / 33 / 37 | −22.61 | 5.49 |
| T3 | T1 on impulses of 0.5 x ATR(14) or more | 2017 → 2026-11-13 | 136 | 50.7 % | +0.053 | +0.153 | −0.046 | +0.099 | +7.25 | +0.65 | +1.86 | 48 / 38 / 50 | −6.31 | 7.42 |
| T3 | T1 on impulses of 0.5 x ATR(14) or more | 2017-2021 | 61 | 52.5 % | +0.066 | +0.193 | −0.061 | +0.127 | +4.04 | +0.53 | +1.53 | 20 / 16 / 25 | −5.51 | 4.92 |
| T3 | T1 on impulses of 0.5 x ATR(14) or more | 2022 → 2026-11-13 | 75 | 49.3 % | +0.043 | +0.119 | −0.034 | +0.077 | +3.21 | +0.39 | +1.10 | 28 / 22 / 25 | −6.31 | 9.02 |

## Decision (out of sample, Holm over the three tests)

| Test | p | Holm p | net > 0 | n ≥ 30 | t ≥ 2 | Holm < 0.05 | 2007-16 > 0 | 2x cost > 0 | placebos beaten (need 38 of 40) | pass |
|---|---|---|---|---|---|---|---|---|---|---|
| T1 | 1 | 1 | no | yes | no | no | no | no | 40 | **fail** |
| T2 | 1 | 1 | no | yes | no | no | no | no | 38 | **fail** |
| T3 | 0.258 | 0.774 | yes | yes | no | no | no | no | 40 | **fail** |

**Placebo** (an unconditional same-side baseline: on each out-of-sample day the test traded, market entry at a random M5 open 09:00-10:55 New York on the impulse's side, stop at the trade's own 1R distance, the test's target and 16:00 New York exit, same cost; 40 seeds):

- T1: seed means −0.341 to −0.223R a trade, median −0.284, 95th percentile −0.245R.
- T2: seed means −0.333 to −0.191R a trade, median −0.266, 95th percentile −0.207R.
- T3: seed means −0.263 to −0.071R a trade, median −0.193, 95th percentile −0.077R.

## Buys and sells (net R a trade, n, month t)

| Test | Period | Buys | Sells |
|---|---|---|---|
| T1 | 2007-2016 | −0.188 (n 351, t −2.98; gross +0.005) | −0.169 (n 370, t −2.73; gross +0.035) |
| T1 | 2017 → 2026-11-13 | −0.137 (n 333, t −2.12; gross +0.030) | −0.205 (n 357, t −3.06; gross −0.037) |
| T2 | 2007-2016 | −0.226 (n 351, t −4.16; gross −0.034) | −0.206 (n 370, t −3.95; gross −0.001) |
| T2 | 2017 → 2026-11-13 | −0.207 (n 333, t −3.91; gross −0.040) | −0.199 (n 357, t −3.04; gross −0.031) |
| T3 | 2007-2016 | −0.058 (n 57, t −0.41; gross +0.060) | −0.177 (n 70, t −1.38; gross −0.053) |
| T3 | 2017 → 2026-11-13 | +0.147 (n 71, t +1.16; gross +0.247) | −0.049 (n 65, t −0.40; gross +0.050) |

Days without a trade, whole period: T1 impulse 42, small 3254, nofill 456, paststop 1; T2 impulse 42, small 3254, nofill 456, paststop 1; T3 impulse 42, small 4690, nofill 169.

## By year (net R a trade, n)

| Year | T1 | T2 | T3 |
|---|---|---|---|
| 2007 | −0.209 (87) | −0.224 (87) | +0.151 (14) |
| 2008 | −0.212 (78) | −0.258 (78) | +0.113 (8) |
| 2009 | −0.030 (73) | −0.113 (73) | −0.267 (9) |
| 2010 | −0.210 (77) | −0.286 (77) | −0.724 (11) |
| 2011 | −0.081 (60) | −0.213 (60) | +0.491 (7) |
| 2012 | −0.280 (75) | −0.208 (75) | −0.274 (12) |
| 2013 | −0.360 (67) | −0.313 (67) | −0.294 (18) |
| 2014 | −0.067 (70) | −0.138 (70) | −0.033 (21) |
| 2015 | −0.002 (70) | −0.182 (70) | +0.132 (15) |
| 2016 | −0.322 (64) | −0.217 (64) | −0.374 (12) |
| 2017 | −0.334 (55) | −0.408 (55) | +0.064 (13) |
| 2018 | −0.228 (69) | −0.324 (69) | −0.012 (13) |
| 2019 | −0.151 (61) | −0.340 (61) | +0.238 (9) |
| 2020 | −0.164 (76) | −0.141 (76) | +0.470 (11) |
| 2021 | −0.292 (87) | −0.358 (87) | −0.263 (15) |
| 2022 | +0.084 (79) | +0.031 (79) | +0.296 (21) |
| 2023 | −0.236 (101) | −0.080 (101) | +0.055 (23) |
| 2024 | −0.042 (75) | −0.129 (75) | −0.092 (20) |
| 2025 | −0.110 (49) | −0.103 (49) | −0.067 (6) |
| 2026 | −0.314 (38) | −0.322 (38) | −0.406 (5) |

## Reading

No test passes the pre-registered bar. Out of sample: T1 −0.172R (n 690, t −4.06, gross −0.005R; 2007-16 −0.178R; failed: netPos, t2, holm, isPos, cost2x); T2 −0.203R (n 690, t −5.11, gross −0.035R; 2007-16 −0.216R; failed: netPos, t2, holm, isPos, cost2x); T3 +0.053R (n 136, t +0.65, gross +0.153R; 2007-16 −0.124R; failed: t2, holm, isPos, cost2x). Costs take 0.167R a trade on T1 at a median stop of $4.1. Buys −0.137R (n 333) and sells −0.205R (n 357) out of sample on T1. Placebo seeds beaten: T1 40, T2 38, T3 40 of 40. Not an edge; nothing live changes and no proposal is written.

## Data and method

- OANDA mid XAU/USD M5 (keyless candle proxy), 5164 New York weekdays 2007-01-01 → 2026-11-13, New York time by the US daylight rule since 2007
- Rule: New York weekdays; impulse = the M5 candles 08:30-08:55 NY (5+), direction = sign(last close - first open), leg from the origin (low/high up to the extreme) to the extreme, at least 0.25 x ATR(14) of the earlier UTC weekdays; at 09:00 NY a limit at the 50 % retrace, live on candles 09:00-10:55 NY (a gap fills at the open); stop $0.30 beyond the origin; in the fill candle only the stop counts; T1 target 1.5R else out 16:00 NY; T2 target = the impulse extreme; T3 = T1 with the leg at least 0.5 x ATR; stop first, a gap through the stop fills at the open; one trade a day
- Costs: $0.60 a round trip per ounce (spread and slippage), 2x reported; financing on buys by `council/fills.mjs` `nights` x `FIN.xau.long` (0.000148 of price a rollover): charged on 3085 test trades, total 0R: every exit is at or before 16:00 New York, before the rollover.
- Decided while coding, before the first run: the ATR's "complete UTC days" are Monday-Friday UTC days (the Sunday reopen stub is left out); 2006 New York days are not traded, so the old US daylight rule of 2006 is not needed.
- To repeat: `node research/edge/gold-ny-impulse-pullback/run.mjs <xau-5m.json.gz>` (OANDA mid M5 XAU/USD as `[unixSec, o, h, l, c]` rows, kept out of git).
