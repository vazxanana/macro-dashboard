# Gold after its largest 5-day move of the year (capitulation / blow-off): result (14 Nov 2026)

**Verdict: FAIL, 0 of 3: fading gold's largest 5-day move of the year made +0.215R a trade net 2017-26 (n 20, month t 0.77) but lost -0.472R in 2007-16 (t -2.29); buying capitulations +0.392R (n 9, t 1.00).**

Paper research only. No live rule, size, filter, council member or page changed. Rule, costs, windows, the three tests and the placebo were fixed in `PREREGISTRATION.md`, pushed alone (0f84ea91a) before any trade was simulated. Data: council-data `research/daily/xau.json` at `f6288251e`, OANDA mid daily candles, weekend stubs folded into the next weekday; 5364 trading days from 2006-03-20 to 2026-11-06. Events with their signal day in 2007-01 to 2026-10: 29 capitulation days and 37 blow-off days (consecutive days count separately; one position at a time per test). A stand-alone rule, not a gate, exit, entry or size of the gold book, and none of its 2006-17 positions is read (owner decision 44); not an edge without n and t.

## The three tests (R a trade, 1R = the stop distance, 2 x ATR(20); monthly sums of net R on every calendar month of the window, by exit month)

| Test | Window | Trades (buys) | Won | Stopped | Median stop $ | Gross R | Net R | Month net (t) | Month gross t | Total net R | Worst DD R | OOS at 2x costs (t) | One-sided p | Holm p | Pass |
|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|
| T1 Reversal, both sides: buy a capitulation, sell a blow-off (primary) | IS 2007-01 to 2016-12 | 20 (11) | 30% | 60% | 49.58 | −0.445 | −0.472 | −0.079 (−2.29) | −2.17 | −9.45 | −10.62 |  |  |  |  |
|  | OOS 2017-01 to 2026-10 | 20 (7) | 45% | 35% | 57.78 | +0.246 | +0.215 | +0.037 (+0.77) | +0.87 | +4.31 | −3.58 | +0.031 (+0.67) | 0.221 | 0.476 | no |
| T2 Buy after a capitulation only | IS 2007-01 to 2016-12 | 11 (11) | 36% | 55% | 49.58 | −0.356 | −0.394 | −0.036 (−1.64) | −1.51 | −4.34 | −4.98 |  |  |  |  |
|  | OOS 2017-01 to 2026-10 | 9 (9) | 56% | 22% | 65.65 | +0.448 | +0.392 | +0.030 (+1.00) | +1.10 | +3.52 | −1.11 | +0.026 (+0.89) | 0.159 | 0.476 | no |
| T3 Continuation, both sides: sell a capitulation, buy a blow-off | IS 2007-01 to 2016-12 | 17 (7) | 47% | 24% | 43.35 | +0.223 | +0.190 | +0.027 (+0.68) | +0.79 | +3.24 | −3.08 |  |  |  |  |
|  | OOS 2017-01 to 2026-10 | 21 (12) | 33% | 43% | 57.78 | −0.370 | −0.414 | −0.074 (−2.61) | −2.31 | −8.70 | −8.79 | −0.082 (−2.88) | 0.995 | 0.995 | no |
| Long every 10th day (baseline, not a test) | IS 2007-01 to 2016-12 | 255 (255) | 49% | 31% | 37.77 | +0.086 | +0.020 | +0.042 (+0.34) | +1.46 | +5.05 | −22.90 |  |  |  |  |
|  | OOS 2017-01 to 2026-10 | 255 (255) | 51% | 26% | 47.46 | +0.194 | +0.115 | +0.248 (+1.65) | +2.74 | +29.26 | −10.92 |  |  |  |  |
| Short every 10th day (baseline, not a test) | IS 2007-01 to 2016-12 | 255 (0) | 40% | 34% | 37.77 | −0.081 | −0.098 | −0.208 (−1.54) | −1.28 | −24.95 | −36.62 |  |  |  |  |
|  | OOS 2017-01 to 2026-10 | 255 (0) | 40% | 35% | 47.46 | −0.156 | −0.170 | −0.368 (−3.14) | −2.88 | −43.38 | −46.01 |  |  |  |  |

Pass bar (pre-registered, each test on its own, Holm over three; the verdict follows T1): OOS net month mean > 0 with t >= 2 and Holm p < 0.05, the in-sample mean > 0, the OOS mean > 0 at 2x costs and financing, the OOS t above the placebo's 95th percentile.

| Check | T1 | T2 | T3 |
|---|---|---|---|
| oosPositive | yes | yes | no |
| oosT2 | no | no | no |
| holm05 | no | no | no |
| isSameSign | no | no | yes |
| x2Positive | yes | yes | no |
| abovePlacebo95 | no | no | no |

## Placebo (40 seeds: each real trade's signal day replaced by a random day whose trade, same side, hold and stop rule, exits in the same window; OOS net month t)

| Test | p5 | p50 | p95 | max | Real | Seeds below the real |
|---|---|---|---|---|---|---|
| T1 | −1.71 | −0.45 | +1.41 | +1.44 | +0.77 | 36 of 40 |
| T2 | −1.65 | +0.23 | +1.89 | +2.19 | +1.00 | 31 of 40 |
| T3 | −1.58 | −0.06 | +1.36 | +1.41 | −2.61 | 0 of 40 |

## Per year (sum of net R by exit year)

| Year | T1 n | T1 net | T2 n | T2 net | T3 n | T3 net |
|---|---|---|---|---|---|---|
| 2007 | 1 | −1.02 | 0 | 0 | 1 | −0.09 |
| 2008 | 6 | +0.17 | 3 | −0.37 | 6 | −2.33 |
| 2009 | 1 | −1.04 | 1 | −1.04 | 1 | +0.79 |
| 2011 | 5 | −2.05 | 3 | −0.03 | 3 | +2.73 |
| 2013 | 2 | −1.59 | 1 | −1.01 | 1 | +0.47 |
| 2014 | 1 | −1.03 | 1 | −1.03 | 1 | −0.56 |
| 2015 | 1 | −1.02 | 0 | 0 | 1 | −0.11 |
| 2016 | 3 | −1.87 | 2 | −0.85 | 3 | +2.34 |
| 2018 | 2 | +1.07 | 1 | +1.23 | 2 | −1.01 |
| 2019 | 4 | −0.74 | 1 | +0.91 | 4 | −0.87 |
| 2020 | 2 | −1.33 | 1 | −1.01 | 1 | −0.69 |
| 2021 | 1 | −0.10 | 1 | −0.10 | 1 | +0.01 |
| 2022 | 3 | +0.23 | 0 | 0 | 3 | −2.09 |
| 2023 | 1 | +2.75 | 1 | +2.75 | 1 | −1.02 |
| 2024 | 3 | −1.09 | 1 | −1.03 | 3 | −0.50 |
| 2025 | 3 | +1.53 | 2 | +0.88 | 4 | −1.62 |
| 2026 | 1 | +1.99 | 1 | −0.11 | 2 | −0.92 |

## Reading

- **Fading the year's largest 5-day move (T1) flips sign between the windows.** Out of sample it made +0.215R a trade net (n 20, month t 0.77; +0.246R gross), below the placebo's 95th percentile (36 of 40 seeds below). In sample it lost −0.472R a trade (n 20, month t −2.29). Costs are small here (0.013R spread and slippage, 0.018R financing a trade out of sample, a median stop near $58): the failure is the signal, not the cost.
- **Buying a capitulation alone (T2)** made +0.392R out of sample on only 9 trades (t 1.00) and lost −0.394R in sample (n 11, t −1.64). Long every 10th day (the unconditional baseline) made +0.115R net out of sample (n 255, t 1.65): the 9 capitulation buys are not told apart from gold's drift.
- **Continuation (T3) is T1's mirror and flips the other way**: +0.190R in sample (n 17, t 0.68), −0.414R out of sample (n 21, t −2.61). Two windows that disagree on 17-21 trades each: no stable direction after an extreme 5-day move.
- Nothing proposed. Not an edge, not a gate on the gold book; nothing live changed.
