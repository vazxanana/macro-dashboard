# Gold's 10-day momentum split by its correlation with the S&P 500: result (14 Nov 2026)

**Verdict: FAIL, 0 of 3: haven-regime gold momentum made -0.059R a trade net 2017-26 (n 131, month t -0.61), -0.021R in 2007-16; the risk regime +0.017R (t +0.21).**

Paper research only. No live rule, size, filter, council member or page changed. Rule, costs, windows, the three tests and the placebo were fixed in `PREREGISTRATION.md`, pushed alone (63bf5d75b) before any trade was simulated. Data: council-data `research/daily/xau.json` and `spx500.json` at `67bac79eb`, OANDA mid daily candles, weekend stubs folded into the next weekday; 5369 gold days from 2006-03-20 to 2026-11-13, 5353 of them with an S&P 500 candle. Signal days: 2007-16 2588, 42.7 % in the haven regime (C < 0); 2017-26 2551, 44.4 % haven. One position at a time per test. A stand-alone rule, not a gate, exit, entry or size of the gold book, and none of its 2006-17 positions is read (owner decision 44); not an edge without n and t.

## The three tests (R a trade, 1R = the stop distance, 2 x ATR(20), ten days held; monthly sums of net R on every calendar month of the window, by exit month)

| Test | Window | Trades (buys) | Won | Stopped | Median stop $ | Gross R | Net R | Cost share | Month net (t) | Month gross t | Total net R | Worst DD R | OOS at 2x costs (t) | One-sided p | Holm p | Pass |
|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|
| T1 Haven regime (C < 0): follow the 10-day move (primary) | IS 2007-01 to 2016-12 | 125 (65) | 46% | 33% | 38.11 | +0.022 | −0.021 | 196% | −0.022 (−0.24) | +0.25 | −2.61 | −11.15 |  |  |  |  |
|  | OOS 2017-01 to 2026-10 | 131 (78) | 42% | 35% | 34.03 | −0.001 | −0.059 | n/a (gross ≤ 0) | −0.066 (−0.61) | −0.01 | −7.75 | −17.06 | −0.130 (−1.22) | 0.729 | 1.000 | no |
| T2 Risk regime (C >= 0): follow the 10-day move | IS 2007-01 to 2016-12 | 165 (90) | 42% | 33% | 36.60 | +0.002 | −0.043 | 2805% | −0.059 (−0.57) | +0.02 | −7.11 | −17.06 |  |  |  |  |
|  | OOS 2017-01 to 2026-10 | 159 (85) | 47% | 33% | 54.21 | +0.059 | +0.017 | 71% | +0.023 (+0.21) | +0.72 | +2.77 | −12.78 | −0.033 (−0.30) | 0.417 | 1.000 | no |
| T3 Does the regime matter: month series T1 minus T2 | IS 2007-01 to 2016-12 | 290 | | | | | | | +0.038 (+0.29) | +0.16 | | |  |  |  |  |
|  | OOS 2017-01 to 2026-10 | 290 | | | | | | | −0.089 (−0.60) | −0.53 | | | −0.097 (−0.66) | 0.726 | 1.000 | no |
| Unconditional 10-day momentum (comparison, not a test) | IS 2007-01 to 2016-12 | 274 (152) | 44% | 34% | 37.18 | −0.033 | −0.078 | n/a (gross ≤ 0) | −0.177 (−1.43) | −0.60 | −21.27 | −26.10 |  |  |  |  |
|  | OOS 2017-01 to 2026-10 | 268 (156) | 44% | 34% | 47.24 | +0.044 | −0.007 | 116% | −0.016 (−0.11) | +0.71 | −1.84 | −22.63 |  |  |  |  |
| Long every 10th day (same-side baseline, not a test) | IS 2007-01 to 2016-12 | 236 (236) | 48% | 34% | 37.40 | +0.049 | −0.017 | 135% | −0.034 (−0.27) | +0.78 | −4.08 | −23.03 |  |  |  |  |
|  | OOS 2017-01 to 2026-10 | 233 (233) | 49% | 26% | 47.46 | +0.189 | +0.111 | 42% | +0.218 (+1.64) | +2.77 | +25.75 | −9.18 |  |  |  |  |
| Short every 10th day (same-side baseline, not a test) | IS 2007-01 to 2016-12 | 237 (0) | 42% | 36% | 37.20 | −0.050 | −0.067 | n/a (gross ≤ 0) | −0.132 (−1.02) | −0.76 | −15.81 | −33.83 |  |  |  |  |
|  | OOS 2017-01 to 2026-10 | 231 (0) | 40% | 35% | 47.46 | −0.142 | −0.156 | n/a (gross ≤ 0) | −0.305 (−2.79) | −2.54 | −35.95 | −40.06 |  |  |  |  |

Pass bar (pre-registered, each test on its own, Holm over three; the verdict follows T1): OOS net month mean > 0 with t >= 2 and Holm p < 0.05, the in-sample mean > 0, the OOS mean > 0 at 2x costs and financing, the OOS t above the placebo's 95th percentile. T3 is the month series of T1 minus T2; its placebo is each T1 placebo minus the real T2 series.

| Check | T1 | T2 | T3 |
|---|---|---|---|
| oosPositive | no | yes | no |
| oosT2 | no | no | no |
| holm05 | no | no | no |
| isSameSign | no | no | yes |
| x2Positive | no | no | no |
| abovePlacebo95 | no | no | no |

## Placebo (40 seeds: each real trade's signal day replaced by a random day whose trade, same side, hold and stop rule, exits in the same window; OOS net month t)

| Test | p5 | p50 | p95 | max | Real | Seeds below the real |
|---|---|---|---|---|---|---|
| T1 | −1.18 | +0.26 | +1.37 | +1.55 | −0.61 | 7 of 40 |
| T2 | −1.69 | −0.10 | +1.26 | +1.70 | +0.21 | 24 of 40 |
| T3 | −0.90 | +0.01 | +0.95 | +1.03 | −0.60 | 7 of 40 |

## Per year (sum of net R by exit year)

| Year | T1 n | T1 net | T2 n | T2 net |
|---|---|---|---|---|
| 2007 | 3 | −3.15 | 27 | −4.95 |
| 2008 | 18 | −4.05 | 11 | +0.89 |
| 2009 | 8 | +0.74 | 21 | −4.90 |
| 2010 | 7 | −1.20 | 21 | −3.04 |
| 2011 | 14 | +3.55 | 16 | +0.28 |
| 2012 | 3 | −1.20 | 26 | +0.08 |
| 2013 | 8 | +1.75 | 22 | +0.15 |
| 2014 | 26 | −6.36 | 2 | −0.35 |
| 2015 | 17 | +1.39 | 10 | +2.56 |
| 2016 | 21 | +5.92 | 9 | +2.17 |
| 2017 | 26 | +0.93 | 1 | −1.02 |
| 2018 | 17 | +1.38 | 15 | +1.58 |
| 2019 | 28 | −7.58 | 3 | −0.37 |
| 2020 | 11 | +1.59 | 19 | −4.60 |
| 2021 | 7 | −2.19 | 24 | −2.72 |
| 2022 | 11 | −0.48 | 20 | −3.89 |
| 2023 | 13 | −1.45 | 14 | +2.86 |
| 2024 | 4 | −1.49 | 26 | +2.86 |
| 2025 | 14 | +1.55 | 17 | −0.95 |
| 2026 | 0 | 0 | 20 | +9.02 |

## Reading

- **Haven-regime momentum (T1) does nothing.** Out of sample it made −0.059R a trade net (n 131, month t −0.61; −0.001R gross), in sample −0.021R (n 125, month t −0.24; +0.022R gross), and only 7 of 40 placebo seeds (random same-side days) sit below it. With a median stop of $34.03 out of sample, spread and slippage cost 0.018R and financing 0.041R a trade: there is no gross return for the costs to take.
- **The regime does not tell persistent moves from the rest.** The risk regime (T2) made +0.017R net out of sample (n 159, t +0.21) and −0.043R in sample; the difference T1 minus T2 is −0.089R a month out of sample (t −0.60). If anything the haven regime is the worse one for following gold's 10-day move.
- **Against the baselines.** Unconditional 10-day momentum on every day made −0.007R out of sample (n 268, t −0.11). The same-side baselines show the drift the test is built to separate: long every 10th day +0.111R out of sample (n 233, t +1.64), short every 10th day −0.156R (n 231, t −2.79). T1's buys and sells together do no better than a coin-flip side on the same days.
- Nothing proposed. Not an edge, not a gate on the gold book; nothing live changed.
