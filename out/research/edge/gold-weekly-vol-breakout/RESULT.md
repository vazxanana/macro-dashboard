# Gold: the weekly volatility breakout (week open ± k × the previous week's range)

Paper research only. A new stand-alone weekly rule on spot gold, not a gate, exit, entry or size of the live gold book (owner decision 44: none of the book's records read). No claim carries over from the daily rule (`gold-vol-breakout`). Nothing live changed, no proposal. The rule, costs, windows, placebo and pass bar were pushed first (`PREREGISTRATION.md`, sha256 in `result.json`). This page is written by `run.mjs` from `result.json`.

**Verdict: FAIL, 0 of 3: gold week open ± 0.5 × prior week range breakout 2017 → now +0.054R a trade net (n 396, month t +0.92); 2007-16 +0.005R**

## Tests

| Test | Rule | Period | n | Win | Net R/trade | Gross R/trade | Net at 2x cost | Cost R/trade | Financing R/trade | Total R | t (months) | Gross t | Stops / time | Max DD R | Median stop $ |
|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|
| T1 | k 0.5, both sides | 2007-2016 | 408 | 45.8 % | +0.005 | +0.057 | −0.047 | +0.052 | +0.017 | +2.08 | +0.11 | +1.20 | 138 / 270 | −19.81 | 18.41 |
| T1 | k 0.5, both sides | 2017 → 2026-11-09 | 396 | 43.2 % | +0.054 | +0.105 | +0.003 | +0.051 | +0.021 | +21.33 | +0.92 | +1.80 | 120 / 276 | −22.50 | 22.05 |
| T2 | k 0.3, both sides | 2007-2016 | 502 | 36.9 % | +0.069 | +0.150 | −0.013 | +0.081 | +0.026 | +34.52 | +0.94 | +2.03 | 272 / 230 | −22.94 | 12.01 |
| T2 | k 0.3, both sides | 2017 → 2026-11-09 | 494 | 34.4 % | +0.032 | +0.107 | −0.043 | +0.075 | +0.029 | +15.80 | +0.38 | +1.27 | 282 / 212 | −41.30 | 14.57 |
| T3 | k 0.5, buys only | 2007-2016 | 220 | 52.7 % | +0.128 | +0.200 | +0.056 | +0.072 | +0.035 | +28.18 | +1.96 | +3.02 | 61 / 159 | −8.76 | 17.59 |
| T3 | k 0.5, buys only | 2017 → 2026-11-09 | 231 | 46.3 % | +0.111 | +0.180 | +0.042 | +0.069 | +0.038 | +25.67 | +1.47 | +2.37 | 64 / 167 | −15.37 | 21.08 |
| Comparison | long every week, open to Friday, stop 0.5 × prior range (not a test) | 2007-2016 | 522 | 42.9 % | −0.030 | +0.039 | −0.100 | +0.069 | +0.037 | −15.80 | −0.56 | +0.71 | 230 / 292 | −41.86 | 20.29 |
| Comparison | long every week, open to Friday, stop 0.5 × prior range (not a test) | 2017 → 2026-11-09 | 515 | 46.8 % | +0.084 | +0.161 | +0.007 | +0.077 | +0.050 | +43.33 | +1.38 | +2.62 | 201 / 314 | −21.59 | 24.46 |

## Decision (out of sample, Holm over the three tests)

| Test | p | Holm p | net > 0 | t ≥ 2 | Holm < 0.05 | in sample > 0 | 2x cost > 0 | placebos beaten (need 38 of 40) | n ≥ 30 | pass |
|---|---|---|---|---|---|---|---|---|---|---|
| T1 | 0.179 | 0.358 | yes | no | no | yes | yes | 34 | yes | **fail** |
| T2 | 0.352 | 0.358 | yes | no | no | yes | no | 37 | yes | **fail** |
| T3 | 0.071 | 0.212 | yes | no | no | yes | yes | 0 | yes | **fail** |

## Placebo (out of sample, 40 seeds)

For every real trade, one market entry in the same week at a random 5-minute mark from the week's first candle to Thursday 20:55 UTC, side drawn with the test's own out-of-sample share of buys (T3: buy), stop at the real trade's 1R distance, out at the week's exit or the stop, the same costs and financing.

| Test | Real net R a trade | Placebo median | Placebo 95th percentile | Placebo min / max |
|---|---|---|---|---|
| T1 | +0.054 | −0.012 | +0.084 | −0.189 / +0.118 |
| T2 | +0.032 | −0.028 | +0.037 | −0.174 / +0.074 |
| T3 | +0.111 | +0.469 | +0.534 | +0.313 / +0.570 |

## Sides and skipped weeks

- T1, 2017 → now: buys n 213 +0.135R, sells n 183 −0.040R; weeks without a trade, whole period: nofill 233.
- T2, 2017 → now: buys n 242 +0.205R, sells n 252 −0.134R; weeks without a trade, whole period: nofill 41.
- T3, 2017 → now: buys n 231 +0.111R, sells n 0 —R; weeks without a trade, whole period: nofill 586.

## By year (net R a trade, n)

| Year | T1 | T2 | T3 |
|---|---|---|---|
| 2007 | −0.005 (41) | +0.125 (52) | +0.188 (25) |
| 2008 | +0.012 (39) | +0.143 (50) | +0.021 (23) |
| 2009 | −0.158 (41) | −0.177 (52) | +0.259 (21) |
| 2010 | −0.204 (43) | −0.009 (52) | +0.079 (29) |
| 2011 | +0.118 (42) | +0.232 (49) | +0.448 (20) |
| 2012 | +0.029 (41) | −0.027 (51) | +0.221 (21) |
| 2013 | +0.185 (39) | +0.410 (48) | −0.293 (17) |
| 2014 | +0.020 (40) | −0.094 (49) | +0.076 (20) |
| 2015 | −0.042 (40) | −0.191 (51) | +0.125 (16) |
| 2016 | +0.108 (42) | +0.317 (48) | +0.112 (28) |
| 2017 | +0.134 (46) | +0.278 (52) | +0.192 (26) |
| 2018 | −0.233 (41) | −0.336 (51) | −0.226 (21) |
| 2019 | −0.130 (39) | −0.252 (47) | −0.103 (28) |
| 2020 | +0.532 (36) | +0.603 (51) | +0.511 (22) |
| 2021 | −0.154 (34) | −0.283 (47) | −0.311 (19) |
| 2022 | −0.059 (38) | −0.066 (50) | −0.237 (23) |
| 2023 | +0.097 (39) | +0.076 (50) | +0.133 (23) |
| 2024 | −0.043 (42) | −0.092 (50) | +0.207 (25) |
| 2025 | +0.308 (43) | +0.366 (52) | +0.387 (31) |
| 2026 | +0.077 (38) | −0.048 (44) | +0.633 (13) |

## Reading

The primary rule (T1) does not pass the pre-registered bar (failed: t2, holm, placebo). Out of sample: T1 +0.054R net (n 396, t +0.92; gross +0.105R, t +1.80; 2007-16 +0.005R, t +0.11; 34 of 40 placebos beaten; failed: t2, holm, placebo); T2 +0.032R net (n 494, t +0.38; gross +0.107R, t +1.27; 2007-16 +0.069R, t +0.94; 37 of 40 placebos beaten; failed: t2, holm, cost2x, placebo); T3 +0.111R net (n 231, t +1.47; gross +0.180R, t +2.37; 2007-16 +0.128R, t +1.96; 0 of 40 placebos beaten; failed: t2, holm, placebo). On weeks the median stop is $22.05 out of sample (18.41 in sample); costs and financing take 0.051R a trade on T1, of which financing 0.021R. The comparison (long every week from the open, same stop) made +0.084R a trade net out of sample (n 515, t +1.38) and −0.030R in sample. On T1 the buys made +0.135R a trade and the sells −0.040R out of sample, which is gold's rise more than the breakout. The placebo as pre-registered draws its entries from the weeks the test filled; for the buys-only T3 those are weeks in which price rose half a range above the open, so random buys earlier in the same week catch that rise (placebo median far above T3): a flaw of that placebo's design, said here and not repaired after the result; T3 fails on its t and Holm p in any case. Not an edge; nothing live changes and no proposal is written.

## Data and method

- OANDA mid XAU/USD M5 through the keyless candle proxy, 2006-11-01 → 2026-11-13; 1046 complete weeks, last Monday 2026-11-09
- Rule: O = open of the week's first M5 candle (Sunday reopen); prevRange = high − low of all the previous week's candles; buy stop O + k × prevRange and sell stop O − k × prevRange live to the Friday 20:55 UTC candle, first filled wins (a gap fills at the open; both in one candle: the level nearer its open); stop at O (fill and stop in one candle: the stop); out at the close of the Friday 20:55 candle; T1 k 0.5, T2 k 0.3, T3 k 0.5 buys only; weeks with fewer than 600 candles (or a previous week with fewer) skipped
- Costs: $0.60 a round trip per ounce (spread and slippage), 2x reported; financing `FIN.xau.long` (0.000148 of price a rollover, the demo broker's swap of 11 Nov 2026, today's rate for every year) × `nights` × entry / 1R on buys.
- Limited power, said before the result: one trade a week at most, month sums of a few trades; a FAIL is "not shown", not "shown not to work".
- To repeat: `node research/edge/gold-weekly-vol-breakout/run.mjs <dir>` with `<dir>/xau-5m.json.gz` (OANDA mid M5 XAU/USD from the candle proxy, kept out of git).
