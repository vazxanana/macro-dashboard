# Silver's volatility against gold's as a gold signal: result (14 Nov 2026)

**Verdict: FAIL, 0 of 3: buying gold when silver is calm against gold made +0.007R a trade net 2017-26 (n 151, month t 0.10), -0.091R over buying every day.**

Paper research only. No live rule, size, filter, council member or page changed. Rule, costs, windows, the three tests, the same-side baseline and the placebo were fixed in `PREREGISTRATION.md`, pushed alone (37ea13f80) before any signal or trade was computed. Data: council-data `research/daily/xau.json` and `xag.json` at `67bac79eb`, OANDA mid daily candles joined on the day, weekend stubs folded into the next weekday; 5369 joined trading days from 2006-03-20 to 2026-11-13. Q = silver's 20-day realised volatility over gold's (median 1.7 in 2007-16, 1.81 in 2017-26); signal days (Q in the bottom / top fifth of its trailing 252 days): 2007-16 570 low and 661 high of 2536 days, 2017-26 542 low and 564 high of 2552. A stand-alone rule, not a gate, exit, entry or size of the gold book, and none of its 2006-17 positions is read (owner decision 44); not an edge without n and t.

## The three tests (R a trade, 1R = the stop distance, 1.5 x ATR(20), held five trading days; one trade at a time; monthly sums of net R on every calendar month of the window, by exit month)

| Test | Window | Trades (buys) | Won | Stopped | Median stop $ | Gross R | Cost R | Financing R | Net R | Same-side baseline net R | Excess R (t) | Month net (t) | Month gross t | Total net R | Worst DD R | OOS at 2x costs (t) | One-sided p | Holm p | Pass |
|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|
| T1 Buy gold when silver is calm against gold (primary) | IS 2007-01 to 2016-12 | 157 (157) | 48% | 33% | 30.24 | +0.035 | +0.021 | +0.028 | −0.014 | −0.003 | −0.012 (−0.15) | −0.019 (−0.18) | +0.43 | −2.27 | −16.07 |  |  |  |  |
|  | OOS 2017-01 to 2026-10 | 151 (151) | 49% | 23% | 37.28 | +0.061 | +0.018 | +0.036 | +0.007 | +0.098 | −0.091 (−1.29) | +0.009 (+0.10) | +0.93 | +1.02 | −8.18 | −0.061 (−0.73) | 0.460 | 1.000 | no |
| T2 Sell gold when silver is wild against gold | IS 2007-01 to 2016-12 | 182 (0) | 40% | 32% | 25.47 | −0.066 | +0.024 | 0.000 | −0.089 | −0.064 | −0.026 (−0.36) | −0.136 (−1.29) | −0.96 | −16.29 | −25.01 |  |  |  |  |
|  | OOS 2017-01 to 2026-10 | 152 (0) | 38% | 36% | 33.77 | −0.166 | +0.019 | 0.000 | −0.185 | −0.120 | −0.065 (−0.82) | −0.238 (−1.93) | −1.74 | −28.05 | −32.94 | −0.262 (−2.10) | 0.973 | 1.000 | no |
| T3 Both together | IS 2007-01 to 2016-12 | 339 (157) | 44% | 32% | 27.20 | −0.020 | +0.023 | +0.013 | −0.055 | −0.035 | −0.020 (−0.38) | −0.156 (−1.07) | −0.38 | −18.74 | −30.58 |  |  |  |  |
|  | OOS 2017-01 to 2026-10 | 303 (151) | 44% | 30% | 35.28 | −0.053 | +0.019 | +0.018 | −0.089 | −0.011 | −0.078 (−1.46) | −0.229 (−1.51) | −0.89 | −27.02 | −31.60 | −0.323 (−2.13) | 0.934 | 1.000 | no |
| Long on every eligible day, five days (baseline pool, overlapping, not a test) | IS 2007-01 to 2016-12 | 2531 (2531) | 49% | 30% | 28.27 | +0.050 | +0.022 | +0.030 | −0.003 |  |  | −0.060 (−0.07) | +1.23 | −7.18 | −170.34 |  |  |  |  |
|  | OOS 2017-01 to 2026-10 | 2556 (2556) | 52% | 25% | 35.77 | +0.155 | +0.019 | +0.039 | +0.098 |  |  | +2.122 (+2.24) | +3.53 | +250.36 | −59.19 |  |  |  |  |
| Short on every eligible day, five days (baseline pool, overlapping, not a test) | IS 2007-01 to 2016-12 | 2534 (0) | 44% | 31% | 28.27 | −0.041 | +0.022 | 0.000 | −0.064 |  |  | −1.343 (−1.50) | −0.98 | −161.22 | −243.71 |  |  |  |  |
|  | OOS 2017-01 to 2026-10 | 2549 (0) | 41% | 33% | 35.77 | −0.101 | +0.019 | 0.000 | −0.120 |  |  | −2.583 (−3.25) | −2.75 | −304.74 | −342.85 |  |  |  |  |

The baseline pool rows overlap (a trade opens every day), so their month t is not a test statistic; they are the source of each test's matched baseline (same side, same window).

Pass bar (pre-registered, each test on its own, Holm over three; the verdict follows T1): OOS net month mean > 0 with t >= 2 and Holm p < 0.05, the in-sample mean > 0, the OOS mean > 0 at 2x costs and financing, more than 38 of 40 placebo seeds below the real OOS t, and the OOS excess over the same-side baseline > 0.

| Check | T1 | T2 | T3 |
|---|---|---|---|
| oosPositive | yes | no | no |
| oosT2 | no | no | no |
| holm05 | no | no | no |
| isSameSign | no | no | no |
| x2Positive | no | no | no |
| abovePlacebo | no | no | no |
| beatsBaseline | no | no | no |

## Placebo (40 seeds: each real trade replaced by the same-side five-day trade of a random eligible day of the same window; OOS net month t)

| Test | p5 | p50 | p95 | max | Real | Seeds below the real |
|---|---|---|---|---|---|---|
| T1 | −0.13 | +1.13 | +2.87 | +2.87 | +0.10 | 6 of 40 |
| T2 | −2.58 | −1.18 | +0.62 | +1.52 | −1.93 | 12 of 40 |
| T3 | −1.58 | −0.21 | +1.49 | +1.58 | −1.51 | 4 of 40 |

## Per year (sum of net R by exit year)

| Year | T1 n | T1 net | T2 n | T2 net | T3 n | T3 net |
|---|---|---|---|---|---|---|
| 2007 | 16 | +1.80 | 10 | −7.73 | 26 | −5.93 |
| 2008 | 16 | +5.10 | 19 | +3.12 | 35 | +8.22 |
| 2009 | 9 | −1.81 | 32 | −10.42 | 41 | −12.23 |
| 2010 | 14 | −0.44 | 15 | −4.59 | 29 | −5.02 |
| 2011 | 16 | −2.01 | 23 | −4.55 | 39 | −6.56 |
| 2012 | 21 | −1.58 | 7 | +1.24 | 28 | −0.33 |
| 2013 | 23 | −4.92 | 10 | +3.77 | 33 | −1.15 |
| 2014 | 18 | +0.52 | 19 | +0.64 | 37 | +0.98 |
| 2015 | 14 | −4.49 | 25 | +1.88 | 39 | −2.61 |
| 2016 | 10 | +5.56 | 22 | +0.35 | 32 | +5.90 |
| 2017 | 22 | −7.46 | 10 | −4.99 | 32 | −12.45 |
| 2018 | 15 | +1.04 | 17 | −1.55 | 32 | −0.51 |
| 2019 | 17 | +5.70 | 16 | −5.23 | 33 | +0.47 |
| 2020 | 5 | +1.45 | 31 | −10.55 | 36 | −9.10 |
| 2021 | 25 | +0.01 | 5 | +0.30 | 30 | +0.31 |
| 2022 | 11 | −0.91 | 20 | +0.08 | 31 | −0.83 |
| 2023 | 11 | −2.60 | 16 | +3.99 | 27 | +1.39 |
| 2024 | 15 | +3.84 | 13 | −5.73 | 28 | −1.89 |
| 2025 | 23 | +0.27 | 6 | −1.70 | 29 | −1.42 |
| 2026 | 7 | −0.32 | 18 | −2.66 | 25 | −2.98 |

## Reading

- **Silver calm against gold is no reason to buy gold.** Out of sample T1 made +0.007R a trade net (n 151, month t 0.10; +0.061R gross), in sample −0.014R (n 157, month t −0.18); only 6 of 40 placebo seeds sit below it, and it lost at 2x costs (−0.061R). Buying gold for five days on every eligible day made +0.098R net out of sample, so the signal days were 0.091R a trade WORSE than an ordinary day (t −1.29); in sample −0.012R (t −0.15).
- **Silver wild against gold is no reason to sell it.** T2 lost −0.185R a trade net out of sample (n 152, month t −1.93) and −0.089R in sample, below even the short baseline (−0.065R out of sample, t −0.82): a short of gold in a rising decade loses, and the froth story does not soften it. T3, both together, lost −0.089R net out of sample (n 303, month t −1.51).
- Costs are not the reason: the round trip took about 0.02R and a buy's financing about 0.04R a trade out of sample (median stop $37), against gross results near zero for T1 and negative for T2. The ratio of silver's volatility to gold's carries no five-day information about gold on 2007-26 daily candles that gold's own drift does not.
- Nothing proposed. Not an edge, not a gate on the gold book; nothing live changed. No variant (percentile cut, lookback, hold, stop) is tried here.
