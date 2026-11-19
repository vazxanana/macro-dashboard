# Gold: a breakout of the first London hour range (08:00-08:59 London)

Paper research only. A new stand-alone intraday rule, **not a gate, exit, entry or size of the live gold book** (owner decision 44: none of the book's records read). Nothing live changed, no proposal. The rule, costs, windows, placebo and pass bar were pushed first (`PREREGISTRATION.md`, sha256 in `result.json`). This page is written by `run.mjs` from `result.json`.

**Verdict: FAIL, 0 of 3: gold London first-hour range breakout 2017 → now −0.078R a trade net (n 2542, month t −1.78, gross +0.076R); 2008-16 −0.041R**

## Tests (R of the actual stop distance; t on calendar-month sums of net R)

| Test | Rule | Period | n | Win | Net R/trade | Gross R/trade | Net at 2x cost | Cost R/trade | Total R | t (months) | Gross t | Stops / targets / time | Max DD R | Median stop $ |
|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|
| T1 | Breakout, stop at the opposite side, out at 20:00 UTC | 2008-2016 | 2317 | 27.8 % | −0.041 | +0.150 | −0.231 | +0.190 | −94.15 | −0.88 | +3.28 | 1553 / 0 / 764 | −178.03 | 3.49 |
| T1 | Breakout, stop at the opposite side, out at 20:00 UTC | 2017 → 2026-11-13 | 2542 | 29.1 % | −0.078 | +0.076 | −0.232 | +0.154 | −197.94 | −1.78 | +1.77 | 1652 / 0 / 890 | −255.50 | 4.59 |
| T1 | Breakout, stop at the opposite side, out at 20:00 UTC | 2017-2021 | 1289 | 28.7 % | −0.112 | +0.093 | −0.317 | +0.205 | −144.46 | −1.76 | +1.47 | 829 / 0 / 460 | −150.16 | 3.25 |
| T1 | Breakout, stop at the opposite side, out at 20:00 UTC | 2022 → 2026-11-13 | 1253 | 29.4 % | −0.043 | +0.059 | −0.144 | +0.102 | −53.47 | −0.71 | +1.01 | 823 / 0 / 430 | −120.22 | 6.7 |
| T2 | T1 with a 1.5R target | 2008-2016 | 2317 | 42.9 % | −0.122 | +0.068 | −0.313 | +0.190 | −283.56 | −5.01 | +2.90 | 1243 / 922 / 152 | −297.79 | 3.49 |
| T2 | T1 with a 1.5R target | 2017 → 2026-11-13 | 2542 | 41.6 % | −0.119 | +0.035 | −0.274 | +0.154 | −303.52 | −5.24 | +1.55 | 1378 / 960 / 204 | −314.92 | 4.59 |
| T2 | T1 with a 1.5R target | 2017-2021 | 1289 | 42.1 % | −0.147 | +0.059 | −0.352 | +0.205 | −189.06 | −4.57 | +1.80 | 680 / 498 / 111 | −194.22 | 3.25 |
| T2 | T1 with a 1.5R target | 2022 → 2026-11-13 | 1253 | 41.0 % | −0.091 | +0.010 | −0.193 | +0.102 | −114.46 | −2.84 | +0.34 | 698 / 462 / 93 | −133.15 | 6.7 |
| T3 | T1 on a range under its 20-day median width | 2008-2016 | 1177 | 23.6 % | −0.037 | +0.213 | −0.286 | +0.249 | −43.36 | −0.50 | +2.90 | 871 / 0 / 306 | −156.03 | 2.55 |
| T3 | T1 on a range under its 20-day median width | 2017 → 2026-11-13 | 1260 | 23.8 % | −0.127 | +0.071 | −0.326 | +0.199 | −160.04 | −1.80 | +1.01 | 922 / 0 / 338 | −181.51 | 3.51 |
| T3 | T1 on a range under its 20-day median width | 2017-2021 | 636 | 25.2 % | −0.107 | +0.158 | −0.372 | +0.265 | −67.91 | −0.96 | +1.42 | 457 / 0 / 179 | −77.03 | 2.39 |
| T3 | T1 on a range under its 20-day median width | 2022 → 2026-11-13 | 624 | 22.4 % | −0.148 | −0.017 | −0.279 | +0.131 | −92.13 | −1.69 | −0.19 | 465 / 0 / 159 | −114.02 | 4.88 |

## Decision (out of sample, Holm over the three tests)

| Test | p | Holm p | net > 0 | t ≥ 2 | Holm < 0.05 | 2008-16 > 0 | 2017-21 > 0 | 2022-now > 0 | 2x cost > 0 | placebos beaten (need 38 of 40) | n ≥ 30 | pass |
|---|---|---|---|---|---|---|---|---|---|---|---|---|
| T1 | 0.962 | 1 | no | no | no | no | no | no | no | 40 | yes | **fail** |
| T2 | 1 | 1 | no | no | no | no | no | no | no | 36 | yes | **fail** |
| T3 | 0.964 | 1 | no | no | no | no | no | no | no | 33 | yes | **fail** |

**Placebo** (on each out-of-sample day the test traded: market entry at a random M5 open 09:00-15:55 UTC, random side, stop at that day's range width, the test's exit and cost; 40 seeds):

- T1: seed means −0.217 to −0.082R a trade, median −0.146, 95th percentile −0.093R.
- T2: seed means −0.211 to −0.108R a trade, median −0.158, 95th percentile −0.116R.
- T3: seed means −0.266 to −0.034R a trade, median −0.188, 95th percentile −0.104R.

## Sides, range hours and skipped days

- T1, 2017 → now: buys n 1346 −0.134R, sells n 1196 −0.015R; range hour (UTC) used: 7:00 on 1515 days, 8:00 on 1027 days; days without a trade, whole period: range 37, nofill 7.
- T2, 2017 → now: buys n 1346 −0.140R, sells n 1196 −0.096R; range hour (UTC) used: 7:00 on 1515 days, 8:00 on 1027 days; days without a trade, whole period: range 37, nofill 7.
- T3, 2017 → now: buys n 652 −0.217R, sells n 608 −0.031R; range hour (UTC) used: 7:00 on 755 days, 8:00 on 505 days; days without a trade, whole period: warmup 37, wide 2429.

## By year (net R a trade, n)

| Year | T1 | T2 | T3 |
|---|---|---|---|
| 2008 | +0.161 (257) | −0.039 (257) | +0.403 (132) |
| 2009 | −0.106 (259) | −0.196 (259) | −0.097 (135) |
| 2010 | −0.080 (259) | −0.127 (259) | −0.247 (134) |
| 2011 | −0.188 (257) | −0.071 (257) | −0.304 (126) |
| 2012 | −0.113 (257) | −0.016 (257) | −0.179 (134) |
| 2013 | +0.294 (256) | −0.006 (256) | +0.330 (124) |
| 2014 | −0.098 (258) | −0.244 (258) | −0.128 (138) |
| 2015 | −0.072 (256) | −0.166 (256) | −0.009 (132) |
| 2016 | −0.160 (258) | −0.236 (258) | −0.082 (122) |
| 2017 | −0.258 (256) | −0.183 (256) | −0.309 (130) |
| 2018 | −0.144 (258) | −0.122 (258) | −0.068 (122) |
| 2019 | −0.054 (258) | −0.229 (258) | −0.038 (130) |
| 2020 | +0.100 (259) | −0.084 (259) | +0.193 (119) |
| 2021 | −0.207 (258) | −0.116 (258) | −0.278 (135) |
| 2022 | −0.117 (256) | −0.078 (256) | −0.215 (128) |
| 2023 | −0.197 (256) | −0.185 (256) | −0.301 (135) |
| 2024 | −0.020 (259) | −0.136 (259) | −0.061 (124) |
| 2025 | +0.023 (257) | −0.031 (257) | −0.128 (126) |
| 2026 | +0.118 (225) | −0.017 (225) | −0.003 (111) |

## Reading

No test passes the pre-registered bar. Out of sample: T1 −0.078R (n 2542, t −1.78, gross +0.076R; 2008-16 −0.041R; failed: netPos, t2, holm, isPos, h1Pos, h2Pos, cost2x); T2 −0.119R (n 2542, t −5.24, gross +0.035R; 2008-16 −0.122R; failed: netPos, t2, holm, isPos, h1Pos, h2Pos, cost2x, placebo); T3 −0.127R (n 1260, t −1.80, gross +0.071R; 2008-16 −0.037R; failed: netPos, t2, holm, isPos, h1Pos, h2Pos, cost2x, placebo). Costs take 0.154R a trade on T1 at a median stop of $4.59. Before costs T1 leans with the break (gross +0.150R, t +3.28 in 2008-16; +0.076R, t +1.77 after), but the range is a few dollars wide and $0.60 a round trip takes more than the lean. Placebo seeds beaten:T1 40, T2 36, T3 33 of 40. Not an edge; nothing live changes and no proposal is written.

## Data and method

- OANDA mid XAU/USD M5 (keyless candle proxy), 4946 weekdays 2007-11-01 → 2026-11-13 (from 2007-11 for the T3 warm-up only), UTC
- Rule: range = high/low of the twelve M5 candles of 08:00-08:59 London (07:00 UTC in British Summer Time, else 08:00 UTC, recorded per day); after it closes a buy stop at the high and a sell stop at the low, live until 16:00 UTC, first fill wins (a gap fills at the open; a candle touching both = the level nearer its open, then stopped); stop at the opposite side; T1 out at 20:00 UTC; T2 a 1.5R target else 20:00; T3 = T1 on days whose range is under the median of the previous 20; stop first, a gap through the stop fills at the open; one trade a day
- Costs: $0.60 a round trip per ounce (spread and slippage), 2x reported; no financing (flat by 20:00 UTC, before the 17:00 New York rollover).
- Not in the pre-registration, decided while coding before the first run: a target reached inside the fill candle (and not the stop) counts as reached, since price must cross the range level before it can reach a target beyond it.
- To repeat: `node research/edge/gold-london-orb/run.mjs <xau-5m.json.gz>` (OANDA mid M5 XAU/USD as `[unixSec, o, h, l, c]` rows, kept out of git).
