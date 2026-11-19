# Gold after a day that closes at its extreme (a "full close"): result (2026-11-14)

**Verdict: FAIL, 0 of 3: buying gold after a close in the top tenth of its range made −0.047R a trade over the every-day buy 2017-26 (n 238, month t −0.76); 2007-16 +0.057R.**

Pre-registered in `PREREGISTRATION.md` (pushed alone before any trade was computed; sha256 in `result.json`). A new
stand-alone daily rule, **not a gate, exit, entry or size of the gold book** (docs/owner-decisions.md item 44); none of that
book's positions were read. Paper research only: nothing live changed and no proposal is written. This page is written by
`run.mjs` from `result.json`.

## Rule (as pre-registered)

Data: council-data research/daily/xau.json (OANDA mid, UTC days), weekends folded (council/fills.mjs foldWeekend), 2006-03-20 to 2026-11-13, 5369 days. A setup is day i with a range of at least 0.5 (T2: 1.0)
x ATR(20) whose close is in the top 10 % of its range (T3: the bottom 15 %). Entry at the next UTC open; stop $0.30 past the
setup day's low (high for the sell), at least 0.5 x ATR away; out at the third daily close. One position at a time. Costs
$0.60 a round trip plus financing on buys (0.000148 of price a rollover). Excess = net R
minus the mean net R of the same trade after every day of the same calendar year (same side).

## Tests (R of the stop; excess over the same-year every-day trade; t on calendar-month sums)

| Test | Period | n | Win | Gross R | Net R | Net 2x | Excess R | Excess 2x | t excess | t net | t gross | Stops |
|---|---|---|---|---|---|---|---|---|---|---|---|---|
| T1 full close up (top 10 %, range >= 0.5 ATR), buy | 2007-2016 | 166 | 48.2 % | +0.113 | +0.043 | −0.028 | +0.057 | +0.091 | +0.63 | +0.48 | +1.25 | 49 |
| T1 full close up (top 10 %, range >= 0.5 ATR), buy | 2017 → 2026-10 | 238 | 47.9 % | +0.057 | −0.008 | −0.073 | −0.047 | −0.010 | −0.76 | −0.13 | +0.88 | 72 |
| T2 full close up on a wide day (top 10 %, range >= 1.0 ATR), buy | 2007-2016 | 110 | 50.0 % | +0.071 | +0.013 | −0.044 | +0.034 | +0.083 | +0.39 | +0.16 | +0.76 | 26 |
| T2 full close up on a wide day (top 10 %, range >= 1.0 ATR), buy | 2017 → 2026-10 | 156 | 50.0 % | +0.061 | +0.006 | −0.048 | −0.054 | −0.006 | −0.83 | +0.09 | +0.92 | 38 |
| T3 full close down (bottom 15 %, range >= 0.5 ATR), sell | 2007-2016 | 170 | 42.4 % | +0.025 | −0.009 | −0.043 | +0.036 | +0.061 | +0.40 | −0.10 | +0.27 | 54 |
| T3 full close down (bottom 15 %, range >= 0.5 ATR), sell | 2017 → 2026-10 | 209 | 37.3 % | −0.112 | −0.142 | −0.172 | −0.034 | −0.015 | −0.57 | −2.21 | −1.75 | 71 |

## Baseline (the same trade after every day)

| Side | Period | n | Gross R | Net R | Net 2x | t net |
|---|---|---|---|---|---|---|
| long | 2007-2016 | 2602 | +0.047 | −0.059 | −0.165 | −1.28 |
| long | 2017 → 2026-10 | 2552 | +0.124 | +0.018 | −0.088 | +0.36 |
| short | 2007-2016 | 2602 | −0.008 | −0.067 | −0.126 | −1.28 |
| short | 2017 → 2026-10 | 2552 | −0.069 | −0.117 | −0.166 | −2.89 |

## Decision (out of sample, Holm over the three tests)

| Test | p | Holm p | excess > 0, t ≥ 2, Holm < 0.05 | 2007-16 excess > 0 | 2x costs > 0 | placebos beaten (need 38 of 40) | n ≥ 100 each window | pass |
|---|---|---|---|---|---|---|---|---|
| T1 | 0.7764 | 1 | no | yes | no | 10 of 40 | yes | **fail** |
| T2 | 0.7967 | 1 | no | yes | no | 14 of 40 | yes | **fail** |
| T3 | 0.7157 | 1 | no | yes | no | 15 of 40 | yes | **fail** |

Placebo: each real out-of-sample trade replaced by the same trade after a random day of the same year that moved the same
way and passed the same range filter but did not close in the band (keeps drift, direction and volatility; removes where
the close sat). Placebo mean excess, 5th / 50th / 95th percentile of the 40 draws:

- T1: −0.121 / +0.010 / +0.206 (real −0.047)
- T2: −0.160 / −0.023 / +0.212 (real −0.054)
- T3: −0.160 / +0.032 / +0.161 (real −0.034)

## By year (excess R a trade)

| Year | T1 | T2 | T3 |
|---|---|---|---|
| 2007 | −0.198 (21) | −0.009 (15) | +0.346 (17) |
| 2008 | +0.465 (19) | +0.006 (10) | +0.126 (22) |
| 2009 | +0.026 (14) | +0.416 (11) | +0.103 (19) |
| 2010 | −0.051 (23) | −0.267 (14) | −0.097 (15) |
| 2011 | −0.207 (23) | +0.034 (15) | +0.230 (10) |
| 2012 | +0.449 (17) | +0.149 (11) | −0.014 (15) |
| 2013 | −0.071 (13) | +0.067 (9) | −0.210 (23) |
| 2014 | +0.446 (6) | +0.446 (6) | −0.176 (16) |
| 2015 | +0.362 (11) | +0.339 (8) | −0.008 (14) |
| 2016 | −0.161 (19) | −0.471 (11) | +0.140 (19) |
| 2017 | −0.085 (25) | −0.057 (17) | −0.114 (24) |
| 2018 | +0.094 (16) | +0.237 (9) | −0.037 (20) |
| 2019 | −0.067 (22) | +0.033 (15) | +0.074 (20) |
| 2020 | +0.057 (23) | −0.347 (14) | −0.447 (13) |
| 2021 | +0.019 (24) | +0.122 (17) | −0.222 (22) |
| 2022 | +0.051 (27) | +0.086 (16) | −0.277 (28) |
| 2023 | −0.206 (23) | −0.129 (15) | +0.268 (29) |
| 2024 | −0.010 (25) | −0.123 (18) | +0.456 (19) |
| 2025 | −0.165 (30) | −0.189 (25) | −0.383 (15) |
| 2026 | −0.099 (23) | +0.020 (10) | +0.141 (19) |

## Reading

A close at the top of the day does not tell gold's next three days anything an ordinary day does not. Out of sample the full-close buy made +0.057R before costs and −0.008R net a trade (n 238), below the same buy after every day of the same year (−0.047R excess, month t −0.76); it was +0.057R excess in 2007-16 (t 0.63), so the sign flips. The wide-day version (T2) and the sell after a close at the low (T3) are the same: no test is above its placebo median by enough (10, 14 and 15 of 40 beaten), and the sells lose net out of sample (−0.142R, t −2.21) as every gold short in this series has. What the buys earn is gold's drift of the year, which the baseline already holds. Not an edge, not a filter, no proposal.

To repeat: `git show origin/council-data:research/daily/xau.json > <dir>/xau.json`, then
`node research/edge/gold-marubozu-close/run.mjs <dir>`. Tests: `tests/gold-marubozu-close.test.mjs`.
