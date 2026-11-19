# Gold in the month after a washout month: result (14 Nov 2026)

**Verdict: FAIL, 0 of 3: buying the month after a washout month made +0.108R a trade net 2017-26 (n 164 in 8 traded months, month t 0.59, over baseline +0.068R, t 0.39).**

Paper research only. No live rule, size, filter, council member or page changed. Rule, costs, windows, the three tests, the baseline and the placebo were fixed in `PREREGISTRATION.md`, pushed alone (9c052f4e3) before any trade was simulated. Data: council-data `research/daily/xau.json` at `c721916f3`, OANDA mid daily candles, weekend stubs folded into the next weekday; 5369 trading days from 2006-03-20 to 2026-11-13. A daily entry on every trading day of the month after a signal month (overlapping positions), so the trades of one signal month move together: the independent count is the number of signal months. A stand-alone rule, not a gate, exit, entry or size of the gold book, and none of its 2006-17 positions is read (owner decision 44); not an edge without n and t.

## The three tests (R a trade, 1R = 3 x ATR(20); monthly sums on every calendar month of the window, by exit month)

| Test | Window | Trades (signal months) | Won | Stopped | Median stop $ | Gross R | Net R | Over baseline R | Month net (t) | Month gross t | Month excess t | Total net R | Worst DD R | OOS at 2x costs (t) | One-sided p | Holm p | Pass |
|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|
| T1 Long after a washout month (close in the bottom tenth of its range) (primary) | IS 2007-01 to 2016-12 | 120 (6) | 38% | 22% | 47.02 | −0.228 | −0.284 | −0.289 | −0.284 (−2.30) | −2.06 | −2.41 | −34.03 | −37.35 |  |  |  |  |
|  | OOS 2017-01 to 2026-10 | 164 (8) | 49% | 8% | 63.53 | +0.169 | +0.108 | +0.068 | +0.150 (+0.59) | +0.91 | +0.39 | +17.71 | −15.84 | +0.065 (+0.26) | 0.278 | 0.555 | no |
| T2 Long after the worst month of the past year | IS 2007-01 to 2016-12 | 250 (12) | 53% | 10% | 67.77 | +0.063 | +0.024 | +0.073 | +0.050 (+0.24) | +0.64 | +0.70 | +6.01 | −10.43 |  |  |  |  |
|  | OOS 2017-01 to 2026-10 | 254 (12) | 53% | 5% | 81.00 | +0.192 | +0.139 | +0.106 | +0.299 (+1.15) | +1.55 | +0.93 | +35.30 | −18.75 | +0.185 (+0.73) | 0.125 | 0.375 | no |
| T3 Short after a month closing in the top tenth of its range | IS 2007-01 to 2016-12 | 377 (18) | 40% | 23% | 56.57 | −0.157 | −0.169 | +0.001 | −0.529 (−1.78) | −1.67 | +0.01 | −63.54 | −74.63 |  |  |  |  |
|  | OOS 2017-01 to 2026-10 | 435 (20) | 40% | 31% | 81.18 | −0.185 | −0.194 | 0.000 | −0.716 (−1.74) | −1.67 | 0.00 | −84.49 | −109.88 | −0.749 (−1.81) | 0.959 | 0.959 | no |
| Long every day (baseline, not a test) | IS 2007-01 to 2016-12 | 2602 (121) | 50% | 15% | 55.96 | +0.061 | +0.012 |  | +0.250 (+0.28) | +1.47 |  | +30.05 | −145.95 |  |  |  |  |
|  | OOS 2017-01 to 2026-10 | 2555 (119) | 52% | 13% | 71.36 | +0.134 | +0.078 |  | +1.687 (+1.77) | +3.02 |  | +199.06 | −64.77 |  |  |  |  |
| Short every day (baseline, not a test) | IS 2007-01 to 2016-12 | 2602 (121) | 44% | 17% | 55.96 | −0.058 | −0.070 |  | −1.512 (−1.63) | −1.37 |  | −181.49 | −273.67 |  |  |  |  |
|  | OOS 2017-01 to 2026-10 | 2552 (119) | 42% | 21% | 71.36 | −0.129 | −0.138 |  | −2.989 (−3.53) | −3.29 |  | −352.69 | −381.26 |  |  |  |  |

Pass bar (pre-registered, each test on its own, Holm over three; the verdict follows T1): OOS net month mean > 0 with t >= 2 and Holm p < 0.05, OOS excess over the same-year baseline > 0 with month t >= 2, the in-sample net mean > 0, the OOS mean > 0 at 2x costs and financing, above at least 38 of 40 placebos. Baseline rows: the same-side trade entered on every trading day (overlapping), so their month t counts heavily overlapping trades.

| Check | T1 | T2 | T3 |
|---|---|---|---|
| oosPositive | yes | yes | no |
| oosT2 | no | no | no |
| holm05 | no | no | no |
| excessT2 | no | no | no |
| isSameSign | no | yes | no |
| x2Positive | yes | yes | no |
| placebo38 | no | no | no |

## Placebo (40 seeds: as many random months as the test has OOS signal months, the baseline trades of the month after each; OOS net month t)

| Test | Months drawn | p5 | p50 | p95 | max | Real | Seeds below the real |
|---|---|---|---|---|---|---|---|
| T1 | 7 | −1.18 | +0.34 | +1.55 | +2.52 | +0.59 | 21 of 40 |
| T2 | 11 | −0.91 | +0.53 | +1.99 | +2.25 | +1.15 | 28 of 40 |
| T3 | 20 | −2.57 | −1.47 | 0.00 | +0.32 | −1.74 | 14 of 40 |

## Every signal month (sum of the next month's trades)

| Test | Signal month | Close location | Month return | Traded month | Trades | Net R | Over baseline R |
|---|---|---|---|---|---|---|---|
| T1 | 2010-01 | 0.076 | -1.5% | 2010-02 | 20 | +3.31 | +1.18 |
| T1 | 2014-03 | 0.020 | -3.2% | 2014-04 | 21 | −3.23 | −1.91 |
| T1 | 2014-07 | 0.041 | -3.3% | 2014-08 | 21 | −11.04 | −9.72 |
| T1 | 2014-09 | 0.042 | -6.1% | 2014-10 | 23 | −7.73 | −6.29 |
| T1 | 2016-08 | 0.089 | -3.0% | 2016-09 | 22 | −9.86 | −11.50 |
| T1 | 2016-11 | 0.015 | -8.1% | 2016-12 | 22 | +1.81 | +0.18 |
| T1 | 2017-09 | 0.061 | -3.1% | 2017-10 | 22 | −2.80 | −4.50 |
| T1 | 2018-04 | 0.092 | -0.8% | 2018-05 | 23 | −7.19 | −4.49 |
| T1 | 2019-09 | 0.099 | -3.1% | 2019-10 | 23 | −4.07 | −8.33 |
| T1 | 2020-11 | 0.071 | -5.3% | 2020-12 | 22 | +4.65 | +2.62 |
| T1 | 2022-06 | 0.051 | -1.6% | 2022-07 | 21 | +3.11 | +3.56 |
| T1 | 2022-08 | 0.031 | -3.2% | 2022-09 | 22 | −5.46 | −4.99 |
| T1 | 2023-09 | 0.022 | -4.7% | 2023-10 | 22 | +22.18 | +20.73 |
| T2 | 2008-03 | 0.112 | -5.6% | 2008-04 | 22 | −7.45 | −6.97 |
| T2 | 2008-08 | 0.402 | -9.0% | 2008-09 | 22 | +10.57 | +11.05 |
| T2 | 2008-10 | 0.172 | -16.8% | 2008-11 | 20 | +3.93 | +4.37 |
| T2 | 2009-12 | 0.149 | -7.0% | 2010-01 | 20 | −10.18 | −12.31 |
| T2 | 2011-01 | 0.210 | -6.2% | 2011-02 | 20 | +11.48 | +9.04 |
| T2 | 2011-09 | 0.234 | -11.1% | 2011-10 | 21 | +6.57 | +4.01 |
| T2 | 2013-04 | 0.547 | -7.6% | 2013-05 | 23 | −6.52 | −0.86 |
| T2 | 2013-06 | 0.223 | -11.0% | 2013-07 | 23 | +5.32 | +10.98 |
| T2 | 2014-09 | 0.042 | -6.1% | 2014-10 | 23 | −7.73 | −6.29 |
| T2 | 2015-07 | 0.228 | -6.6% | 2015-08 | 21 | +3.63 | +6.60 |
| T2 | 2015-11 | 0.128 | -6.8% | 2015-12 | 22 | +1.87 | +4.98 |
| T2 | 2016-11 | 0.015 | -8.1% | 2016-12 | 22 | +1.81 | +0.18 |
| T2 | 2018-06 | 0.118 | -3.5% | 2018-07 | 22 | −14.68 | −12.10 |
| T2 | 2019-09 | 0.099 | -3.1% | 2019-10 | 23 | −4.07 | −8.33 |
| T2 | 2019-11 | 0.259 | -3.2% | 2019-12 | 22 | +21.05 | +16.97 |
| T2 | 2020-09 | 0.271 | -4.1% | 2020-10 | 22 | −1.50 | −3.53 |
| T2 | 2020-11 | 0.071 | -5.3% | 2020-12 | 22 | +4.65 | +2.62 |
| T2 | 2021-02 | 0.111 | -6.1% | 2021-03 | 23 | +1.42 | +3.27 |
| T2 | 2021-06 | 0.106 | -7.3% | 2021-07 | 22 | −4.13 | −2.36 |
| T2 | 2023-02 | 0.135 | -5.3% | 2023-03 | 23 | +22.36 | +20.84 |
| T2 | 2024-11 | 0.503 | -3.5% | 2024-12 | 22 | −1.65 | −6.52 |
| T2 | 2026-03 | 0.452 | -11.0% | 2026-04 | 21 | −1.40 | +0.92 |
| T2 | 2026-06 | 0.105 | -11.8% | 2026-07 | 23 | +5.96 | +8.50 |
| T3 | 2007-01 | 0.956 | 2.5% | 2007-02 | 20 | +0.14 | +5.65 |
| T3 | 2007-09 | 0.968 | 10.5% | 2007-10 | 23 | −18.92 | −12.59 |
| T3 | 2007-10 | 0.986 | 7.3% | 2007-11 | 22 | +0.10 | +6.15 |
| T3 | 2008-02 | 0.971 | 5.3% | 2008-03 | 21 | +7.51 | +8.38 |
| T3 | 2008-12 | 0.942 | 7.8% | 2009-01 | 22 | −8.28 | −3.40 |
| T3 | 2009-01 | 0.985 | 5.2% | 2009-02 | 20 | −0.69 | +3.75 |
| T3 | 2009-05 | 0.988 | 10.4% | 2009-06 | 22 | +8.41 | +13.29 |
| T3 | 2009-07 | 0.906 | 2.7% | 2009-08 | 21 | −6.24 | −1.58 |
| T3 | 2010-04 | 0.964 | 6.0% | 2010-05 | 21 | −4.54 | +0.30 |
| T3 | 2010-08 | 0.974 | 5.7% | 2010-09 | 22 | −20.41 | −15.34 |
| T3 | 2011-02 | 0.920 | 5.9% | 2011-03 | 23 | −5.47 | −1.31 |
| T3 | 2011-04 | 0.964 | 9.2% | 2011-05 | 22 | −2.03 | +1.95 |
| T3 | 2011-07 | 0.963 | 8.4% | 2011-08 | 23 | −17.04 | −12.88 |
| T3 | 2012-01 | 0.935 | 10.9% | 2012-02 | 21 | +4.74 | +5.22 |
| T3 | 2012-08 | 0.989 | 4.9% | 2012-09 | 20 | −9.12 | −8.66 |
| T3 | 2014-06 | 0.967 | 6.2% | 2014-07 | 23 | +5.54 | +4.82 |
| T3 | 2016-04 | 0.959 | 5.0% | 2016-05 | 22 | +5.55 | +8.81 |
| T3 | 2017-05 | 0.908 | 0.0% | 2017-06 | 22 | +13.97 | +17.73 |
| T3 | 2017-07 | 0.944 | 2.0% | 2017-08 | 23 | −18.09 | −14.16 |
| T3 | 2017-08 | 0.935 | 4.2% | 2017-09 | 21 | +11.00 | +14.59 |
| T3 | 2017-12 | 0.946 | 2.3% | 2018-01 | 23 | −7.13 | −6.93 |
| T3 | 2018-12 | 0.966 | 4.9% | 2019-01 | 23 | −8.59 | −3.96 |
| T3 | 2019-05 | 0.960 | 1.7% | 2019-06 | 20 | −14.17 | −10.15 |
| T3 | 2020-06 | 0.974 | 3.1% | 2020-07 | 23 | −20.38 | −15.36 |
| T3 | 2020-07 | 0.968 | 10.8% | 2020-08 | 21 | +2.57 | +7.15 |
| T3 | 2020-12 | 0.936 | 6.7% | 2021-01 | 20 | +6.71 | +5.98 |
| T3 | 2021-05 | 0.968 | 7.7% | 2021-06 | 22 | +14.58 | +13.78 |
| T3 | 2021-12 | 0.979 | 3.1% | 2022-01 | 21 | −1.11 | −0.39 |
| T3 | 2022-11 | 0.923 | 8.6% | 2022-12 | 22 | −9.83 | −9.08 |
| T3 | 2023-11 | 0.901 | 2.8% | 2023-12 | 21 | −5.51 | −3.78 |
| T3 | 2024-03 | 0.984 | 9.2% | 2024-04 | 22 | −2.49 | +2.62 |
| T3 | 2025-01 | 0.905 | 6.6% | 2025-02 | 20 | −4.78 | +4.20 |
| T3 | 2025-03 | 0.972 | 9.2% | 2025-04 | 21 | −10.32 | −0.89 |
| T3 | 2025-08 | 0.962 | 4.8% | 2025-09 | 22 | −21.75 | −11.87 |
| T3 | 2025-09 | 0.980 | 12.1% | 2025-10 | 23 | −6.36 | +3.97 |
| T3 | 2025-11 | 0.907 | 5.3% | 2025-12 | 23 | −14.21 | −3.89 |
| T3 | 2026-02 | 0.997 | 7.8% | 2026-03 | 22 | +11.41 | +10.47 |

## Reading

- **Buying after a washout month (T1) flips sign between the windows.** In sample it lost −0.284R a trade net (n 120 in 6 traded months, month t −2.30) and −0.289R a trade below the same-year long baseline (t −2.41). Out of sample +0.108R net (n 164, month t 0.59; +0.169R gross, t 0.91), only +0.068R over the baseline (t 0.39), and it beat 21 of 40 random-month placebos. Costs are small (0.011R spread and slippage, 0.050R financing a trade out of sample, median stop $63.5): the failure is the signal.
- **The worst month of the year (T2)** is the nearest: +0.024R in sample (n 250, t 0.24) and +0.139R out of sample (n 254, t 1.15, +0.106R over the baseline, t 0.93, Holm p 0.375, 28 of 40 placebos). Twelve signal months a window: not told apart from gold's drift (long every day made +0.078R a trade net out of sample).
- **Shorting after a top-close month (T3)** lost in both windows (−0.169R and −0.194R a trade net) and is no different from the same-year short baseline (+0.001R and 0.000R a trade over it, month t 0.01 and 0.00): a month closing at its high says nothing about the next month beyond the year's trend.
- Nothing proposed. Not an edge, not a gate on the gold book; nothing live changed.
