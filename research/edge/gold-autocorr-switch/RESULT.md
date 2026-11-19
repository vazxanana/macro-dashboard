# Gold's autocorrelation regime switching 5-day momentum and reversal: result (14 Nov 2026)

**Verdict: FAIL, 0 of 3: the autocorrelation switch made -0.015R a trade net 2017-26 (n 441, month t -0.43) and -0.007R in 2007-16 (t -0.22); the momentum leg +0.116R (t 1.92).**

Paper research only. No live rule, size, filter, council member or page changed. Rule, costs, windows, the three tests and the placebo were fixed in `PREREGISTRATION.md`, pushed alone (9aeba8af3) before any trade was simulated. Data: council-data `research/daily/xau.json` at `f6288251e`, OANDA mid daily candles, weekend stubs folded into the next weekday; 5364 trading days from 2006-03-20 to 2026-11-06. Signal days (AC and M5 both non-zero): 2007-16 2601, of which 44.6 % in the momentum regime (AC > 0); 2017-26 2552, 42.3 % momentum. One position at a time per test. A stand-alone rule, not a gate, exit, entry or size of the gold book, and none of its 2006-17 positions is read (owner decision 44); not an edge without n and t.

## The three tests (R a trade, 1R = the stop distance, 2 x ATR(20), five days held; monthly sums of net R on every calendar month of the window, by exit month)

| Test | Window | Trades (buys) | Won | Stopped | Median stop $ | Gross R | Net R | Month net (t) | Month gross t | Total net R | Worst DD R | OOS at 2x costs (t) | One-sided p | Holm p | Pass |
|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|
| T1 The switch: follow the 5-day move when AC > 0, fade it when AC < 0 (primary) | IS 2007-01 to 2016-12 | 454 (206) | 50% | 15% | 36.83 | +0.022 | −0.007 | −0.026 (−0.22) | +0.70 | −3.10 | −14.02 |  |  |  |  |
|  | OOS 2017-01 to 2026-10 | 441 (234) | 48% | 14% | 48.01 | +0.016 | −0.015 | −0.057 (−0.43) | +0.45 | −6.68 | −18.73 | −0.173 (−1.33) | 0.666 | 1.000 | no |
| T2 Momentum leg alone (AC > 0) | IS 2007-01 to 2016-12 | 225 (112) | 54% | 12% | 39.11 | +0.081 | +0.053 | +0.100 (+1.00) | +1.52 | +12.02 | −11.33 |  |  |  |  |
|  | OOS 2017-01 to 2026-10 | 204 (120) | 51% | 10% | 49.14 | +0.149 | +0.116 | +0.201 (+1.92) | +2.41 | +23.72 | −3.99 | +0.145 (+1.41) | 0.027 | 0.082 | no |
| T3 Reversal leg alone (AC < 0) | IS 2007-01 to 2016-12 | 272 (120) | 45% | 18% | 35.53 | −0.037 | −0.067 | −0.152 (−1.59) | −0.88 | −18.24 | −19.46 |  |  |  |  |
|  | OOS 2017-01 to 2026-10 | 272 (125) | 48% | 18% | 48.08 | −0.046 | −0.074 | −0.171 (−1.61) | −1.00 | −20.18 | −28.73 | −0.237 (−2.20) | 0.946 | 1.000 | no |
| Unconditional 5-day momentum (comparison, not a test) | IS 2007-01 to 2016-12 | 452 (240) | 50% | 16% | 37.25 | +0.038 | +0.008 | +0.029 (+0.22) | +1.11 | +3.47 | −11.38 |  |  |  |  |
|  | OOS 2017-01 to 2026-10 | 438 (250) | 51% | 14% | 47.86 | +0.107 | +0.075 | +0.278 (+2.23) | +3.15 | +32.76 | −6.54 |  |  |  |  |
| Unconditional 5-day reversal (comparison, not a test) | IS 2007-01 to 2016-12 | 456 (207) | 45% | 18% | 37.20 | −0.065 | −0.093 | −0.355 (−2.86) | −2.01 | −42.64 | −43.16 |  |  |  |  |
|  | OOS 2017-01 to 2026-10 | 456 (191) | 45% | 23% | 47.64 | −0.092 | −0.119 | −0.458 (−3.35) | −2.61 | −54.05 | −56.70 |  |  |  |  |
| Long every 5th day (baseline, not a test) | IS 2007-01 to 2016-12 | 433 (433) | 52% | 16% | 37.35 | +0.058 | +0.016 | +0.059 (+0.44) | +1.56 | +7.08 | −25.66 |  |  |  |  |
|  | OOS 2017-01 to 2026-10 | 426 (426) | 55% | 13% | 47.69 | +0.127 | +0.082 | +0.295 (+2.12) | +3.27 | +34.81 | −9.14 |  |  |  |  |
| Short every 5th day (baseline, not a test) | IS 2007-01 to 2016-12 | 433 (0) | 44% | 17% | 37.35 | −0.046 | −0.063 | −0.227 (−1.63) | −1.19 | −27.19 | −41.35 |  |  |  |  |
|  | OOS 2017-01 to 2026-10 | 426 (0) | 42% | 22% | 47.69 | −0.110 | −0.124 | −0.446 (−3.39) | −3.01 | −52.67 | −59.71 |  |  |  |  |

Pass bar (pre-registered, each test on its own, Holm over three; the verdict follows T1): OOS net month mean > 0 with t >= 2 and Holm p < 0.05, the in-sample mean > 0, the OOS mean > 0 at 2x costs and financing, the OOS t above the placebo's 95th percentile.

| Check | T1 | T2 | T3 |
|---|---|---|---|
| oosPositive | no | yes | no |
| oosT2 | no | no | no |
| holm05 | no | no | no |
| isSameSign | no | yes | no |
| x2Positive | no | yes | no |
| abovePlacebo95 | no | yes | no |

## Placebo (40 seeds: each real trade's signal day replaced by a random day whose trade, same side, hold and stop rule, exits in the same window; OOS net month t)

| Test | p5 | p50 | p95 | max | Real | Seeds below the real |
|---|---|---|---|---|---|---|
| T1 | −1.68 | −0.37 | +0.86 | +0.96 | −0.43 | 19 of 40 |
| T2 | −1.08 | +0.26 | +1.73 | +1.75 | +1.92 | 40 of 40 |
| T3 | −1.96 | −0.48 | +1.59 | +1.91 | −1.61 | 8 of 40 |

## Per year (sum of net R by exit year)

| Year | T1 n | T1 net | T2 n | T2 net | T3 n | T3 net |
|---|---|---|---|---|---|---|
| 2007 | 47 | −2.74 | 8 | −3.59 | 44 | −3.95 |
| 2008 | 45 | +1.20 | 32 | +1.87 | 16 | +2.62 |
| 2009 | 45 | −1.69 | 36 | −1.31 | 12 | −1.15 |
| 2010 | 44 | −3.48 | 13 | −3.97 | 37 | −4.14 |
| 2011 | 47 | +0.38 | 26 | +0.61 | 24 | −2.60 |
| 2012 | 46 | +0.79 | 27 | −1.69 | 26 | −0.98 |
| 2013 | 46 | +1.38 | 27 | +9.27 | 26 | −0.66 |
| 2014 | 44 | −5.19 | 21 | +0.52 | 29 | −2.80 |
| 2015 | 45 | +1.87 | 21 | +6.86 | 24 | −0.23 |
| 2016 | 45 | +4.35 | 14 | +3.46 | 34 | −4.35 |
| 2017 | 44 | +2.86 | 21 | +3.52 | 26 | −7.62 |
| 2018 | 44 | +2.86 | 3 | +0.01 | 43 | −1.43 |
| 2019 | 44 | +0.48 | 19 | +2.28 | 29 | −2.22 |
| 2020 | 46 | −6.11 | 20 | +3.38 | 34 | −1.29 |
| 2021 | 44 | −3.92 | 41 | −2.31 | 3 | −1.60 |
| 2022 | 45 | −4.49 | 27 | +0.65 | 27 | −7.97 |
| 2023 | 44 | +3.74 | 26 | +4.51 | 22 | −1.81 |
| 2024 | 47 | −0.14 | 13 | +6.59 | 35 | +0.21 |
| 2025 | 45 | +3.55 | 18 | +3.25 | 29 | +3.91 |
| 2026 | 38 | −5.52 | 16 | +1.84 | 24 | −0.35 |

## Reading

- **The switch (T1) does nothing.** Out of sample it made −0.015R a trade net (n 441, month t −0.43; +0.016R gross), in sample −0.007R (n 454, month t −0.22), and 19 of 40 placebo seeds sit below it. Costs are small (0.014R spread and slippage, 0.017R financing a trade out of sample, a median stop near $48): the failure is the signal.
- **The autocorrelation sign does not tell momentum days from reversal days.** The momentum leg alone (T2) made +0.116R net out of sample (n 204, t 1.92; Holm p 0.082) and +0.053R in sample (n 225, t 1.00): close to the bar, but unconditional 5-day momentum on every day, with no regime read, made +0.075R out of sample (n 438, t 2.23) and +0.008R in sample (n 452, t 0.22). The reversal leg (T3) lost −0.074R out of sample (n 272, t −1.61) and −0.067R in sample, like unconditional reversal (−0.119R out of sample, n 456, t −3.35). Gold's 5-day move tends to continue whatever the 60-day autocorrelation says; fading it loses in both regimes.
- The unconditional momentum comparison is not a test of this study and was not pre-registered as one (it fails the in-sample sign by itself: t 0.22 in 2007-16); it also leans on gold's rise (long every 5th day +0.082R out of sample, n 426, t 2.12). Nothing is proposed from it.
- Nothing proposed. Not an edge, not a gate on the gold book; nothing live changed.
