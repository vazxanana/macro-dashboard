# Gold: its own illiquidity (Amihud ratio) and the next week

Paper research only. A new stand-alone weekly rule, **not a gate, exit, entry or size of the live gold book** (owner decision 44: none of the book's records read). Nothing live changed, no proposal. The rule, costs, windows, baseline, placebo and pass bar were pushed first (`PREREGISTRATION.md`, sha256 in `result.json`). This page is written by `run.mjs` from `result.json`.

**Verdict: FAIL, 0 of 3: buying the week after illiquid gold made +0.152R a trade net 2017-26 (n 110), +0.028R over buying every week (month t +0.82); 2007-16 +0.010R.**

## Tests (R of the 2 x ATR(20) stop; t on calendar-month sums)

| Test | Period | n | Win | Gross R | Net R | Net at 2x | Same-side baseline R | Excess R | t net | t gross | t excess | t 2x | Stops | Max DD R | Median stop $ |
|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|
| T1 Illiquid gold, buy (rank >= 2/3) | 2007-2016 | 133 | 42.1 % | −0.038 | −0.081 | −0.096 | −0.091 | +0.010 | −1.27 | −0.60 | +0.36 | −1.51 | 28 | −13.36 | 38.58 |
| T1 Illiquid gold, buy (rank >= 2/3) | 2017 → 2026-10 | 110 | 55.5 % | +0.208 | +0.152 | +0.134 | +0.124 | +0.028 | +2.49 | +3.40 | +0.82 | +2.20 | 10 | −3.09 | 34.76 |
| T1 Illiquid gold, buy (rank >= 2/3) | 2017-2021 | 64 | 57.8 % | +0.181 | +0.112 | +0.089 | +0.101 | +0.011 | +1.36 | +2.16 | +0.28 | +1.07 | 6 | −3.09 | 24.01 |
| T1 Illiquid gold, buy (rank >= 2/3) | 2022 → 2026-10 | 46 | 52.2 % | +0.246 | +0.207 | +0.197 | +0.156 | +0.051 | +2.27 | +2.68 | +0.83 | +2.17 | 4 | −2.53 | 53.81 |
| T2 Liquid gold, sell (rank <= 1/3) | 2007-2016 | 250 | 40.8 % | −0.035 | −0.052 | −0.070 | −0.060 | +0.007 | −1.11 | −0.74 | +0.44 | −1.47 | 38 | −23.68 | 37.96 |
| T2 Liquid gold, sell (rank <= 1/3) | 2017 → 2026-10 | 240 | 41.3 % | −0.104 | −0.117 | −0.131 | −0.090 | −0.027 | −2.44 | −2.15 | −1.67 | −2.73 | 50 | −32.12 | 49.37 |
| T2 Liquid gold, sell (rank <= 1/3) | 2017-2021 | 115 | 45.2 % | −0.005 | −0.024 | −0.042 | −0.016 | −0.008 | −0.42 | −0.09 | −0.40 | −0.74 | 18 | −7.23 | 30.09 |
| T2 Liquid gold, sell (rank <= 1/3) | 2022 → 2026-10 | 125 | 37.6 % | −0.195 | −0.204 | −0.213 | −0.159 | −0.045 | −2.73 | −2.61 | −1.74 | −2.86 | 32 | −31.88 | 72.59 |
| T3 Illiquid and falling, buy | 2007-2016 | 61 | 49.2 % | +0.025 | −0.019 | −0.035 | −0.204 | +0.185 | −0.22 | +0.28 | +3.38 | −0.40 | 10 | −7.42 | 34.97 |
| T3 Illiquid and falling, buy | 2017 → 2026-10 | 42 | 54.8 % | +0.162 | +0.108 | +0.091 | −0.007 | +0.115 | +1.75 | +2.67 | +1.83 | +1.45 | 2 | −1.07 | 38.81 |
| T3 Illiquid and falling, buy | 2017-2021 | 23 | 60.9 % | +0.166 | +0.099 | +0.075 | −0.063 | +0.162 | +1.07 | +1.87 | +1.99 | +0.80 | 2 | −1.07 | 23.44 |
| T3 Illiquid and falling, buy | 2022 → 2026-10 | 19 | 47.4 % | +0.158 | +0.119 | +0.109 | +0.060 | +0.059 | +1.44 | +1.87 | +0.59 | +1.33 | 0 | −1.03 | 53.51 |

## Decision (out of sample, Holm over the three tests on the excess t)

| Test | p | Holm p | excess > 0 | excess t ≥ 2 | Holm < 0.05 | 2007-16 excess > 0 | net > 0 | 2x cost > 0 | placebos beaten (need 38 of 40) | n ≥ 30 | pass |
|---|---|---|---|---|---|---|---|---|---|---|---|
| T1 | 0.206 | 0.412 | yes | no | no | yes | yes | yes | 37 | yes | **fail** |
| T2 | 0.953 | 0.953 | no | no | no | yes | no | no | 11 | yes | **fail** |
| T3 | 0.034 | 0.101 | yes | no | no | yes | yes | yes | 30 | yes | **fail** |

**Placebo** (each out-of-sample trade moved to a random other eligible week of 2017-26, same side and mechanics; 40 seeds):

- T1: seed means −0.094 to +0.207R a trade, median +0.035, 95th percentile +0.157R; the test's own +0.152R beats 37.
- T2: seed means −0.211 to +0.019R a trade, median −0.095, 95th percentile −0.043R; the test's own −0.117R beats 11.
- T3: seed means −0.230 to +0.259R a trade, median +0.017, 95th percentile +0.216R; the test's own +0.108R beats 30.

## Baseline (the same trade in every eligible week)

- 2007-2016, buy: n 508, gross +0.021R, net −0.022R a trade, month t −0.65.
- 2007-2016, sell: n 508, gross −0.030R, net −0.046R a trade, month t −1.38.
- 2017 → 2026-10, buy: n 513, gross +0.103R, net +0.056R a trade, month t +1.77.
- 2017 → 2026-10, sell: n 513, gross −0.091R, net −0.105R a trade, month t −3.26.
- T1, 2017 → 2026-10: cost +0.056R a trade, of which financing +0.039R.
- T2, 2017 → 2026-10: cost +0.014R a trade, of which financing +0.000R.
- T3, 2017 → 2026-10: cost +0.054R a trade, of which financing +0.037R.

## By year (net R / excess R a trade, n)

| Year | T1 | T2 | T3 |
|---|---|---|---|
| 2007 | +0.108 / −0.108 (5) | −0.105 / +0.034 (26) | +0.546 / +0.373 (2) |
| 2008 | +0.066 / +0.043 (9) | +0.037 / +0.002 (28) | +0.461 / +0.552 (3) |
| 2009 | −0.098 / −0.044 (10) | −0.125 / −0.015 (20) | −0.250 / −0.003 (5) |
| 2010 | +0.356 / +0.132 (6) | −0.204 / +0.035 (40) | +0.632 / +0.249 (1) |
| 2011 | −0.675 / −0.031 (7) | −0.336 / −0.118 (28) | −0.500 / +0.139 (4) |
| 2012 | +0.109 / +0.085 (29) | +0.137 / +0.055 (11) | +0.402 / +0.505 (11) |
| 2013 | −0.124 / +0.112 (3) | +0.194 / +0.014 (46) | +0.162 / +0.397 (1) |
| 2014 | −0.120 / +0.049 (30) | −0.044 / +0.059 (8) | −0.024 / +0.217 (13) |
| 2015 | −0.232 / −0.086 (33) | −0.049 / −0.216 (3) | −0.275 / −0.028 (20) |
| 2016 | +0.203 / −0.107 (1) | −0.031 / +0.051 (40) | +0.203 / −0.107 (1) |
| 2017 | −0.254 / −0.381 (6) | −0.066 / −0.006 (41) | −1.036 / −1.032 (1) |
| 2018 | +0.074 / +0.015 (22) | +0.054 / −0.046 (23) | +0.097 / +0.173 (9) |
| 2019 | +0.157 / +0.000 (25) | −0.663 / −0.300 (4) | +0.106 / +0.157 (9) |
| 2020 | +0.332 / +0.232 (6) | −0.028 / −0.014 (31) | +0.435 / +0.444 (3) |
| 2021 | +0.235 / +0.252 (5) | +0.142 / +0.131 (16) | +0.185 / +0.455 (1) |
| 2022 | +0.194 / +0.048 (14) | +0.080 / +0.057 (20) | +0.268 / +0.186 (6) |
| 2023 | +0.218 / +0.114 (18) | −0.079 / −0.028 (23) | +0.015 / −0.042 (8) |
| 2024 | +0.855 / +0.812 (2) | −0.246 / −0.054 (32) | +0.418 / +0.458 (1) |
| 2025 | +0.704 / +0.008 (1) | −0.494 / −0.047 (34) | — |
| 2026 | +0.043 / −0.181 (11) | −0.035 / −0.175 (16) | +0.029 / −0.030 (4) |

## Reading

The primary test does not pass the pre-registered bar. Out of sample: T1 net +0.152R, gross +0.208R, excess +0.028R (n 110, excess t +0.82; 2007-16 excess +0.010R, t +0.36; failed: t2, holm, placebo); T2 net −0.117R, gross −0.104R, excess −0.027R (n 240, excess t −1.67; 2007-16 excess +0.007R, t +0.44; failed: excessPos, t2, holm, netPos, cost2x, placebo); T3 net +0.108R, gross +0.162R, excess +0.115R (n 42, excess t +1.83; 2007-16 excess +0.185R, t +3.38; failed: t2, holm, placebo). The same-side baseline (the next week in every eligible week) made 2017-26 buys +0.056R and sells −0.105R a trade net (2007-16 −0.022R / −0.046R). Placebo seeds beaten: T1 37, T2 11, T3 30 of 40. Not an edge; nothing live changes and no proposal is written.

## Data and method

- council-data research/daily/xau.json (OANDA mid, UTC days, weekdays only), 1035 trade weeks 2007-01-01 → 2026-10-26
- Rule: a_t = |ln(c_t / c_t-1)| / tick volume; ILLIQ = mean a over 20 weekdays; rank = share of the 250 previous ILLIQ readings below it, read at the last weekday of a week; T1 rank >= 2/3 buy the next week; T2 rank <= 1/3 sell it; T3 rank >= 2/3 and that week closed down, buy; market at the next week's first open, stop 2 x ATR(20), out at its last close; stop first, a gap through fills at the open; excess = net R minus the mean net R of the same side in every eligible week starting in the same calendar month
- Costs: $0.60 a round trip per ounce (spread and slippage), 2x reported; financing `nights` x `FIN.xau.long` on buys from `council/fills.mjs` (first weekday 00:00 UTC to last weekday 21:00 UTC).
- Volume is OANDA's count of price updates a day, a proxy for activity, not traded volume; it grows by two orders of magnitude over the sample, so only a rank against gold's own previous 250 readings is used.
- To repeat: `git show origin/council-data:research/daily/xau.json > <scratch>/xau.json`, then `node research/edge/gold-amihud/run.mjs <scratch>/xau.json` (the file stays out of git).
