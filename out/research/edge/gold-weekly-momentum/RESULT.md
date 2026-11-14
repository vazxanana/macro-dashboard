# Weekly momentum or reversal on spot gold: result (14 Nov 2026)

**Verdict: FAIL, 0 of 3: last week's sign made +0.029R a trade net 2017-26 (n 513, month t 0.95); fading a 2-sd week -0.061R (n 28, t -0.29).**

Paper research only. No live rule, size, filter, council member or page changed. Rule, costs, windows, the three tests and the placebo were fixed in `PREREGISTRATION.md`, pushed alone (7721466b6) before any week was simulated. Data: council-data `research/daily/xau.json` at `2e8d6a5c0`, OANDA mid daily candles, weekend stubs folded into Monday; 1077 complete weeks from 2006-03-20 to 2026-11-02. A stand-alone rule, not a gate, exit, entry or size of the gold book (owner decision 44); not an edge without n and t.

## The three tests (R a trade, 1R = 2 x ATR(20); monthly sums of net R on every calendar month of the window, by exit month)

| Test | Window | Trades | Longs | Won | Stopped | Gross R | Net R | Month net (t) | Month gross t | Total net R | Worst DD R | OOS at 2x costs (t) | One-sided p | Holm p | Pass |
|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|
| T1 One-week momentum (primary) | IS 2008-01 to 2016-12 | 470 | 246 | 50% | 16% | +0.037 | +0.007 | +0.032 (+0.23) | +1.15 | +3.48 | −11.89 |  |  |  |  |
|  | OOS 2017-01 to 2026-10 | 513 | 290 | 49% | 14% | +0.062 | +0.029 | +0.127 (+0.95) | +1.99 | +15.01 | −10.27 | −0.016 (−0.12) | 0.171 | 0.513 | no |
| T2 Four-week momentum | IS 2008-01 to 2016-12 | 470 | 247 | 47% | 16% | +0.016 | −0.014 | −0.060 (−0.43) | +0.49 | −6.49 | −21.04 |  |  |  |  |
|  | OOS 2017-01 to 2026-10 | 513 | 293 | 49% | 14% | +0.030 | −0.003 | −0.012 (−0.08) | +0.84 | −1.38 | −15.63 | −0.154 (−1.02) | 0.532 | 1.000 | no |
| T3 Reversal after a week over 2 sd | IS 2008-01 to 2016-12 | 29 | 16 | 38% | 31% | −0.148 | −0.171 | −0.046 (−1.41) | −1.23 | −4.95 | −6.36 |  |  |  |  |
|  | OOS 2017-01 to 2026-10 | 28 | 10 | 46% | 36% | −0.041 | −0.061 | −0.015 (−0.29) | −0.20 | −1.72 | −4.09 | −0.019 (−0.39) | 0.614 | 1.000 | no |
| Always long every week (comparison, not a test) | IS | 470 | 470 | 49% | 17% | +0.024 | −0.017 | −0.074 (−0.48) | +0.69 | −8.00 | −29.34 | | | | |
| | OOS | 513 | 513 | 53% | 15% | +0.092 | +0.045 | +0.197 (+1.34) | +2.70 | +23.27 | −12.81 | | | | |

Pass bar (pre-registered, each test on its own, Holm over three): OOS net month mean > 0 with t >= 2 and Holm p < 0.05, the in-sample mean > 0, the OOS mean > 0 at 2x costs and financing, the OOS t above the placebo's 95th percentile.

| Check | T1 | T2 | T3 |
|---|---|---|---|
| oosPositive | yes | no | no |
| oosT2 | no | no | no |
| holm05 | no | no | no |
| isSameSign | yes | no | no |
| x2Positive | no | no | no |
| abovePlacebo95 | yes | no | no |

## Long and short legs apart (net R a trade, month t of the leg alone)

| Test | Window | Long n | Long gross R | Long net R | Long t | Long total | Short n | Short gross R | Short net R | Short t | Short total |
|---|---|---|---|---|---|---|---|---|---|---|---|
| T1 | IS | 246 | +0.053 | +0.011 | +0.24 | +2.63 | 224 | +0.019 | +0.004 | +0.07 | +0.85 |
|  | OOS | 290 | +0.138 | +0.090 | +1.92 | +26.23 | 223 | −0.036 | −0.050 | −1.22 | −11.22 |
| T2 | IS | 247 | +0.047 | +0.005 | +0.10 | +1.18 | 223 | −0.019 | −0.034 | −0.78 | −7.67 |
|  | OOS | 293 | +0.116 | +0.069 | +1.37 | +20.32 | 220 | −0.084 | −0.099 | −2.48 | −21.70 |
| T3 | IS | 16 | −0.189 | −0.219 | −1.64 | −3.51 | 13 | −0.098 | −0.111 | −0.51 | −1.45 |
|  | OOS | 10 | +0.074 | +0.036 | +0.14 | +0.36 | 18 | −0.105 | −0.116 | −0.49 | −2.08 |

## Placebo (40 seeds: each test's own trades with their sides shuffled among them, same long / short share, same weeks, stops and costs; OOS net month t)

| Test | p5 | p50 | p95 | max | Real | Seeds below the real |
|---|---|---|---|---|---|---|
| T1 | −2.41 | −1.05 | +0.42 | +1.09 | +0.95 | 39 of 40 |
| T2 | −2.51 | −1.07 | +0.93 | +0.93 | −0.08 | 32 of 40 |
| T3 | −2.22 | −0.93 | +0.58 | +0.61 | −0.29 | 26 of 40 |

## Per year (sum of net R by exit year)

| Year | T1 n | T1 net | T2 n | T2 net | T3 n | T3 net |
|---|---|---|---|---|---|---|
| 2008 | 52 | −4.34 | 52 | +1.00 | 5 | −1.26 |
| 2009 | 53 | −0.39 | 53 | +4.81 | 0 | 0 |
| 2010 | 52 | +2.69 | 52 | +0.09 | 1 | +0.78 |
| 2011 | 52 | +4.05 | 52 | +3.48 | 8 | −0.93 |
| 2012 | 52 | −8.28 | 52 | +3.70 | 0 | 0 |
| 2013 | 52 | +1.73 | 52 | −6.20 | 6 | −1.28 |
| 2014 | 52 | +4.87 | 52 | −0.17 | 1 | −1.03 |
| 2015 | 52 | +4.87 | 52 | −9.62 | 3 | +0.24 |
| 2016 | 53 | −1.74 | 53 | −3.58 | 5 | −1.47 |
| 2017 | 52 | +7.62 | 52 | −11.05 | 0 | 0 |
| 2018 | 52 | −6.58 | 52 | +1.36 | 0 | 0 |
| 2019 | 52 | +0.22 | 52 | +6.95 | 5 | −1.27 |
| 2020 | 53 | −1.08 | 53 | −1.75 | 5 | +2.67 |
| 2021 | 52 | +1.86 | 52 | −3.57 | 1 | +0.27 |
| 2022 | 52 | −1.22 | 52 | −0.94 | 2 | −0.50 |
| 2023 | 52 | +4.57 | 52 | −0.95 | 4 | −2.92 |
| 2024 | 52 | −2.01 | 52 | +1.41 | 5 | +1.95 |
| 2025 | 53 | +6.25 | 53 | +6.16 | 3 | +0.30 |
| 2026 | 43 | +5.38 | 43 | +0.99 | 3 | −2.21 |

## Reading

- **One-week momentum (T1) is small and not separate from noise.** Out of sample it made +0.029R a trade net (n 513, month t 0.95; +0.062R gross, month gross t 1.99); spread and slippage (0.014R) and financing (0.019R) take about half of the gross. In sample +0.007R (n 470, t 0.23). At 2x costs it loses (−0.016R a month). Holm p 0.513. Its sides did beat 39 of 40 shuffles of the same sides (placebo 95th percentile t 0.42), so the ordering carries a little information, but far under the t of 2 the bar asks for.
- **Most of it is gold's long drift.** Always long every week made +0.045R a trade net out of sample (n 513, month t 1.34, +23.27R in total) against T1's +15.01R. T1's long leg (weeks after an up week) made +0.090R (n 290, t 1.92, +26.23R) and its short leg lost −0.050R (n 223, t −1.22, −11.22R): the shorts cost more than the selection of long weeks added. In sample both legs are about flat (+0.011R and +0.004R).
- **Four-week momentum (T2) is flat**: −0.003R out of sample (n 513, t −0.08), −0.014R in sample; its shorts lost −0.099R a trade out of sample (t −2.48).
- **Fading an extreme week (T3) is thin and negative**: 28 trades out of sample, −0.061R (t −0.29); 29 in sample, −0.171R (t −1.41). Too few to say anything beyond "no sign of reversal".
- Nothing proposed. Not an edge, not a gate on the gold book; nothing live changed. A long-only "after an up week" variant was not pre-registered and is not tested here (chosen after seeing the legs: not evidence).
