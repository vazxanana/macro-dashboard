# Gold: a large M15 candle in the first London hour, followed into New York

Paper research only. A new stand-alone intraday rule, **not a gate, exit, entry or size of the live gold book** (owner decision 44: none of the book's records read). Nothing live changed, no proposal. The rule, costs, windows, baseline, placebo and pass bar were pushed first (`PREREGISTRATION.md`, sha256 in `result.json`). This page is written by `run.mjs` from `result.json`.

**Verdict: FAIL, 0 of 3: gold London M15 displacement followed to 17:00 UTC, 2017-26 −0.139R a trade net (n 305, month t −1.20, lift −0.010R); 2007-16 −0.104R**

## Tests (R of the actual stop distance; t on calendar-month sums of net R)

| Test | Rule | Period | n | Win | Net R/trade | Gross R/trade | Net at 2x cost | Cost R/trade | Same-side baseline R | Lift R | Total R | t (months) | Gross t | Stops / targets / time | Max DD R | Median stop $ |
|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|
| T1 | Displacement followed, out at 17:00 UTC | 2007-2016 | 335 | 27.5 % | −0.104 | +0.080 | −0.289 | +0.185 | −0.127 | +0.023 | −34.91 | −0.94 | +0.73 | 228 / 0 / 107 | −55.77 | 3.48 |
| T1 | Displacement followed, out at 17:00 UTC | 2017 → 2026-10 | 305 | 27.2 % | −0.139 | +0.030 | −0.309 | +0.170 | −0.129 | −0.010 | −42.48 | −1.20 | +0.27 | 211 / 0 / 94 | −60.11 | 3.85 |
| T1 | Displacement followed, out at 17:00 UTC | 2017-2021 | 175 | 27.4 % | −0.225 | −0.015 | −0.434 | +0.209 | −0.127 | −0.097 | −39.30 | −1.55 | −0.11 | 119 / 0 / 56 | −40.53 | 2.88 |
| T1 | Displacement followed, out at 17:00 UTC | 2022 → 2026-10 | 130 | 26.9 % | −0.024 | +0.092 | −0.141 | +0.117 | −0.132 | +0.108 | −3.18 | −0.13 | +0.49 | 92 / 0 / 38 | −19.58 | 5.22 |
| T2 | T1 with a 2R target | 2007-2016 | 335 | 34.0 % | −0.217 | −0.032 | −0.401 | +0.185 | −0.170 | −0.046 | −72.61 | −3.25 | −0.49 | 209 / 94 / 32 | −77.74 | 3.48 |
| T2 | T1 with a 2R target | 2017 → 2026-10 | 305 | 37.4 % | −0.082 | +0.087 | −0.252 | +0.170 | −0.140 | +0.058 | −25.11 | −1.00 | +1.06 | 186 / 102 / 17 | −38.39 | 3.85 |
| T2 | T1 with a 2R target | 2017-2021 | 175 | 38.3 % | −0.094 | +0.115 | −0.303 | +0.209 | −0.139 | +0.044 | −16.51 | −0.78 | +0.95 | 106 / 60 / 9 | −29.80 | 2.88 |
| T2 | T1 with a 2R target | 2022 → 2026-10 | 130 | 36.2 % | −0.066 | +0.051 | −0.183 | +0.117 | −0.143 | +0.077 | −8.59 | −0.62 | +0.47 | 80 / 42 / 8 | −15.90 | 5.22 |
| T3 | T1 when the candle closes beyond the Asian range | 2007-2016 | 229 | 25.8 % | −0.262 | −0.086 | −0.439 | +0.177 | −0.125 | −0.138 | −60.07 | −2.30 | −0.76 | 157 / 0 / 72 | −70.90 | 3.74 |
| T3 | T1 when the candle closes beyond the Asian range | 2017 → 2026-10 | 154 | 26.6 % | −0.208 | −0.041 | −0.375 | +0.167 | −0.126 | −0.082 | −32.08 | −1.43 | −0.28 | 106 / 0 / 48 | −58.72 | 3.85 |
| T3 | T1 when the candle closes beyond the Asian range | 2017-2021 | 91 | 25.3 % | −0.282 | −0.082 | −0.481 | +0.199 | −0.126 | −0.156 | −25.63 | −1.63 | −0.47 | 63 / 0 / 28 | −38.41 | 2.88 |
| T3 | T1 when the candle closes beyond the Asian range | 2022 → 2026-10 | 63 | 28.6 % | −0.102 | +0.018 | −0.223 | +0.121 | −0.127 | +0.025 | −6.45 | −0.40 | +0.07 | 43 / 0 / 20 | −20.31 | 5.16 |

## Decision (out of sample, Holm over the three tests)

| Test | p | Holm p | net > 0 | t ≥ 2 | Holm < 0.05 | 2007-16 > 0 | 2x cost > 0 | lift > 0 | placebos beaten (need 38 of 40) | n ≥ 30 | pass |
|---|---|---|---|---|---|---|---|---|---|---|---|
| T1 | 0.885 | 1 | no | no | no | no | no | no | 18 | yes | **fail** |
| T2 | 0.841 | 1 | no | no | no | no | no | yes | 29 | yes | **fail** |
| T3 | 0.924 | 1 | no | no | no | no | no | no | 8 | yes | **fail** |

**Placebo** (each out-of-sample trade moved to a random other weekday of 2017-26: same side, same UTC entry minute, stop at the same multiple of that day's ATR, the test's exit and costs; 40 seeds):

- T1: seed means −0.336 to +0.225R a trade, median −0.132, 95th percentile +0.091R.
- T2: seed means −0.297 to +0.115R a trade, median −0.130, 95th percentile +0.004R.
- T3: seed means −0.448 to +0.323R a trade, median −0.118, 95th percentile +0.187R.

## Sides and skipped days

- T1, 2017 → 2026-10: buys n 149 −0.158R, sells n 156 −0.121R; median stop 2.06 x ATR; financing +0.000R a trade; days without a trade, whole period: nosignal 4514.
- T2, 2017 → 2026-10: buys n 149 −0.061R, sells n 156 −0.103R; median stop 2.06 x ATR; financing +0.000R a trade; days without a trade, whole period: nosignal 4514.
- T3, 2017 → 2026-10: buys n 72 −0.168R, sells n 82 −0.244R; median stop 2.13 x ATR; financing +0.000R a trade; days without a trade, whole period: nosignal 4514, inside 257.

## By year (net R a trade, n)

| Year | T1 | T2 | T3 |
|---|---|---|---|
| 2007 | −0.246 (21) | −0.250 (21) | +0.098 (14) |
| 2008 | +0.008 (34) | −0.385 (34) | −0.184 (26) |
| 2009 | +0.053 (31) | −0.079 (31) | −0.016 (19) |
| 2010 | −0.050 (32) | −0.283 (32) | −0.036 (24) |
| 2011 | +0.011 (35) | −0.183 (35) | −0.343 (25) |
| 2012 | −0.505 (45) | −0.408 (45) | −0.417 (35) |
| 2013 | −0.130 (41) | −0.247 (41) | −0.286 (26) |
| 2014 | −0.014 (31) | −0.092 (31) | −0.172 (22) |
| 2015 | −0.163 (40) | −0.145 (40) | −0.513 (25) |
| 2016 | +0.183 (25) | +0.031 (25) | −0.637 (13) |
| 2017 | −0.067 (26) | +0.305 (26) | +0.324 (13) |
| 2018 | −0.122 (36) | −0.007 (36) | +0.118 (21) |
| 2019 | −0.358 (46) | −0.297 (46) | −0.737 (26) |
| 2020 | +0.005 (29) | −0.295 (29) | −0.624 (15) |
| 2021 | −0.444 (38) | −0.052 (38) | −0.237 (16) |
| 2022 | −0.191 (39) | +0.092 (39) | −0.141 (19) |
| 2023 | −0.311 (31) | −0.072 (31) | −0.768 (17) |
| 2024 | +0.412 (20) | −0.014 (20) | +0.146 (12) |
| 2025 | +0.405 (29) | −0.045 (29) | +0.578 (11) |
| 2026 | −0.552 (11) | −0.760 (11) | +0.293 (4) |

## Reading

No test passes the pre-registered bar. Out of sample: T1 −0.139R (n 305, t −1.20, gross +0.030R, baseline −0.129R, lift −0.010R; 2007-16 −0.104R; failed: netPos, t2, holm, isPos, cost2x, lift, placebo); T2 −0.082R (n 305, t −1.00, gross +0.087R, baseline −0.140R, lift +0.058R; 2007-16 −0.217R; failed: netPos, t2, holm, isPos, cost2x, placebo); T3 −0.208R (n 154, t −1.43, gross −0.041R, baseline −0.126R, lift −0.082R; 2007-16 −0.262R; failed: netPos, t2, holm, isPos, cost2x, lift, placebo). Costs take 0.170R a trade on T1 at a median stop of $3.85 (2.06 x the M15 ATR). The same-side baseline (the same trade on every other weekday) is the yardstick: gold's 2017-26 rise lifts buys on any day, so a positive net alone is not evidence. Placebo seeds beaten: T1 18, T2 29, T3 8 of 40. Not an edge; nothing live changes and no proposal is written.

## Data and method

- OANDA mid XAU/USD M5 (keyless candle proxy), 5154 weekdays 2007-01-01 → 2026-10-30, UTC; M15 built from complete triples of M5
- Rule: first M15 candle of 08:00-08:59 London (07:00 UTC in British Summer Time, else 08:00 UTC) with range >= 2.0 x the mean true range of the 96 M15 candles before it and body >= 0.6 x its range; side = its colour; market at the next M15 open; stop at the candle's opposite extreme; T1 out at 17:00 UTC; T2 a 2R target else 17:00; T3 = T1 when the candle closes beyond the Asian range (00:00 UTC to the London hour); stop first, a gap through the stop fills at the open; one trade a day
- Costs: $0.60 a round trip per ounce (spread and slippage), 2x reported; financing `nights` x `FIN.xau.long` on buys from `council/fills.mjs` (0 here: every trade is out by 17:00 UTC, before the 22:00 UTC rollover).
- To repeat: `node research/edge/gold-london-displacement/run.mjs <xau-5m.json.gz>` (OANDA mid M5 XAU/USD as `[unixSec, o, h, l, c]` rows, kept out of git).
