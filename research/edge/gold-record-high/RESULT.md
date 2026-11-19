# Gold after a new record closing high: result (14 Nov 2026)

**Verdict: FAIL: long 20 days after an all-time closing high made +0.319R a trade net 2017-26 (n 17, month t 0.93); 0 of 3 tests pass.**

Paper research only. No live rule, size, filter, council member or page changed. Rule, costs, windows, the three tests and the placebo were fixed in `PREREGISTRATION.md`, pushed alone before any trade was simulated. Data: council-data `research/daily/xau.json` at `389931b46`, OANDA mid daily candles, weekend stubs folded into Monday. Not a gate, exit, entry or size of the gold book (owner decision 44); not an edge without n and t.

## The three tests (R a trade; monthly sums of net R on every calendar month of the window, by exit month)

| Test | Window | Trades | Won | Stopped | Gross R | Net R | Month net (t) | Month gross t | Total net R | Worst DD R | OOS at 2x costs (t) | One-sided p | Holm p | Pass |
|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|
| T1 Long after an all-time closing high (primary) | IS 2008-01 to 2016-12 | 16 | 63% | 19% | +0.659 | +0.563 | +0.083 (+1.87) | +2.09 | +9.00 | −1.81 |  |  |  |  |
|  | OOS 2017-01 to 2026-10 | 17 | 59% | 35% | +0.412 | +0.319 | +0.046 (+0.93) | +1.15 | +5.42 | −2.91 | +0.032 (+0.68) | 0.176 | 0.352 | no |
| T2 Long after a 52-week closing high | IS 2008-01 to 2016-12 | 22 | 55% | 23% | +0.407 | +0.315 | +0.064 (+1.39) | +1.73 | +6.93 | −1.81 |  |  |  |  |
|  | OOS 2017-01 to 2026-10 | 30 | 57% | 30% | +0.388 | +0.285 | +0.073 (+1.21) | +1.58 | +8.56 | −2.91 | +0.046 (+0.80) | 0.113 | 0.339 | no |
| T3 Short (fade) after a 52-week closing high | IS 2008-01 to 2016-12 | 30 | 27% | 47% | −0.290 | −0.301 | −0.084 (−1.55) | −1.51 | −9.03 | −9.74 |  |  |  |  |
|  | OOS 2017-01 to 2026-10 | 53 | 32% | 57% | −0.396 | −0.404 | −0.181 (−2.47) | −2.43 | −21.40 | −24.69 | −0.185 (−2.50) | 0.993 | 0.993 | no |

Pass bar (pre-registered, judged on T1; T2 / T3 against the same bar as secondary findings): OOS net month mean > 0 with t >= 2 and Holm p < 0.05, the in-sample mean of the same sign, the OOS mean > 0 at 2x costs and financing.

| Check | T1 | T2 | T3 |
|---|---|---|---|
| oosPositive | yes | yes | no |
| oosT2 | no | no | no |
| holm05 | no | no | no |
| isSameSign | yes | yes | no |
| x2Positive | yes | yes | no |

## Placebo (40 seeds: each trade moved to a random weekday of the same year, same side, stop, hold and costs; OOS net month t)

| Test | p5 | p50 | p95 | max | Real | Seeds at or above the real |
|---|---|---|---|---|---|---|
| T1 | +0.90 | +1.56 | +2.22 | +2.34 | +0.93 | 37 of 40 |
| T2 | +0.54 | +1.33 | +2.51 | +2.79 | +1.21 | 24 of 40 |
| T3 | −3.72 | −2.97 | −1.52 | −1.33 | −2.47 | 13 of 40 |

## Per year (sum of net R by exit year)

| Year | T1 n | T1 net | T2 n | T2 net | T3 n | T3 net |
|---|---|---|---|---|---|---|
| 2008 | 2 | +2.51 | 3 | +1.38 | 4 | −1.09 |
| 2009 | 3 | +2.85 | 4 | +2.09 | 5 | −1.49 |
| 2010 | 6 | −0.75 | 6 | −0.75 | 7 | −1.72 |
| 2011 | 5 | +4.39 | 5 | +4.39 | 9 | −4.87 |
| 2016 | 0 | 0 | 4 | −0.18 | 5 | +0.15 |
| 2017 | 0 | 0 | 1 | −1.07 | 1 | +1.51 |
| 2018 | 0 | 0 | 1 | −1.07 | 1 | +0.76 |
| 2019 | 0 | 0 | 3 | +2.08 | 5 | −2.96 |
| 2020 | 1 | −1.07 | 6 | +2.95 | 11 | −5.03 |
| 2022 | 0 | 0 | 1 | +0.26 | 2 | −0.33 |
| 2023 | 1 | −1.04 | 3 | −2.11 | 3 | −0.17 |
| 2024 | 8 | +0.23 | 8 | +0.23 | 12 | −4.27 |
| 2025 | 6 | +5.67 | 6 | +5.67 | 13 | −7.93 |
| 2026 | 1 | +1.62 | 1 | +1.62 | 5 | −2.98 |

## First record after more than 60 trading days without one (descriptive, not a test: n too small)

| Signal day | Exit | Gross R | Net R |
|---|---|---|---|
| 2008-01-02 | time | +1.657 | +1.558 |
| 2009-09-11 | time | +1.006 | +0.897 |
| 2010-05-11 | stop | −1.000 | −1.043 |
| 2010-09-14 | time | +2.130 | +1.980 |
| 2011-03-01 | stop | −1.000 | −1.068 |
| 2020-07-27 | stop | −1.000 | −1.070 |
| 2023-12-01 | stop | −1.000 | −1.037 |
| 2025-01-30 | time | +0.899 | +0.762 |
| 2025-08-29 | time | +2.881 | +2.745 |

## Reading

- **Continuation, but no more than owning gold.** After a record close gold went on up on average (T1 +0.319R a trade net out of sample, T2 +0.285R), and the in-sample sign agrees (T1 +0.563R, month t 1.87). But the monthly t is under 1 out of sample for T1 (0.93) and 1.21 for T2, far from 2, and the placebo answers the real question: the same number of 20-day longs on random days of the same years did as well or better (T1: 37 of 40 seeds at or above the real t, median placebo t 1.56; T2: 24 of 40). The record day adds nothing measurable to gold's drift in those years.
- **No reversal either.** Fading a 52-week high (T3) lost −0.404R a trade net out of sample (n 53, month t −2.47) and −0.301R in sample: shorting gold at a record is the wrong side, as shorting it on random days of the same years was (placebo median t −2.97).
- **The first record after a gap** (descriptive, 9 events in 2008-26): 5 time exits up, 4 stopped; too few to say anything.
- **Samples are thin.** Gold made no all-time closing high from September 2011 to July 2020, so T1 has 17 trades out of sample, nearly all in 2024-26. Financing (about 0.09R a long) is most of the cost; the $0.60 a trade is about 0.01R at a 3 x ATR stop.
- Nothing proposed. Not an edge, not a gate on the gold book; nothing live changed.
