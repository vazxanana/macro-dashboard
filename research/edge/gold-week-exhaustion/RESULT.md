# Gold's week already stretched by mid-week, faded to the Friday close: result (14 Nov 2026)

**Verdict: FAIL, 0 of 3: fading a gold week stretched 0.75 weekly ranges by mid-week made -0.014R a trade net 2017-26 (n 76, month t -0.17), +0.017R over the same-side baseline.**

Paper research only. No live rule, size, filter, council member or page changed. Rule, costs, windows, the three tests, the same-side baseline and the placebo were fixed in `PREREGISTRATION.md`, pushed alone (0dd3a1efd) before any signal or trade was computed. Data: council-data `research/daily/xau.json` at `67bac79eb`, OANDA mid daily candles, weekend stubs folded into the next weekday; 5369 trading days from 2006-03-20 to 2026-11-13. Signal weeks (a move from the week's open of at least 0.75 x the mean range of the 10 previous weeks by the close of the 1st, 2nd or 3rd trading day): 2007-16 64 of 522 weeks (31 buys), 2017-26 76 of 513 (32 buys). A stand-alone rule, not a gate, exit, entry or size of the gold book, and none of its 2006-17 positions is read (owner decision 44); not an edge without n and t.

## The three tests (R a trade, 1R = the stop distance, 1.5 x ATR(20), held to the week's last close; monthly sums of net R on every calendar month of the window, by exit month)

| Test | Window | Trades (buys) | Won | Stopped | Median stop $ | Gross R | Cost R | Financing R | Net R | Same-side baseline net R | Excess R (t) | Month net (t) | Month gross t | Total net R | Worst DD R | OOS at 2x costs (t) | One-sided p | Holm p | Pass |
|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|
| T1 The fade, both sides (primary) | IS 2007-01 to 2016-12 | 64 (31) | 45% | 19% | 28.78 | −0.039 | +0.021 | +0.006 | −0.066 | −0.024 | −0.042 (−0.46) | −0.035 (−0.77) | −0.45 | −4.21 | −4.36 |  |  |  |  |
|  | OOS 2017-01 to 2026-10 | 76 (32) | 51% | 22% | 46.85 | +0.009 | +0.015 | +0.008 | −0.014 | −0.031 | +0.017 (+0.20) | −0.009 (−0.17) | +0.10 | −1.07 | −4.64 | −0.024 (−0.43) | 0.567 | 1.000 | no |
| T2 Buys only (weeks already down) | IS 2007-01 to 2016-12 | 31 (31) | 48% | 23% | 30.65 | −0.045 | +0.019 | +0.013 | −0.077 | +0.021 | −0.099 (−0.74) | −0.020 (−0.55) | −0.32 | −2.40 | −2.92 |  |  |  |  |
|  | OOS 2017-01 to 2026-10 | 32 (32) | 50% | 19% | 48.81 | +0.010 | +0.015 | +0.018 | −0.023 | +0.062 | −0.085 (−0.69) | −0.006 (−0.20) | +0.09 | −0.73 | −2.97 | −0.015 (−0.49) | 0.579 | 1.000 | no |
| T3 Sells only (weeks already up) | IS 2007-01 to 2016-12 | 33 (0) | 42% | 15% | 27.45 | −0.033 | +0.022 | 0.000 | −0.055 | −0.066 | +0.011 (+0.09) | −0.015 (−0.50) | −0.30 | −1.81 | −2.83 |  |  |  |  |
|  | OOS 2017-01 to 2026-10 | 44 (0) | 52% | 25% | 46.85 | +0.008 | +0.015 | 0.000 | −0.008 | −0.099 | +0.091 (+0.77) | −0.003 (−0.07) | +0.06 | −0.34 | −4.64 | −0.009 (−0.20) | 0.528 | 1.000 | no |
| Long on every Tue-Fri entry day to the week's end (baseline pool, overlapping, not a test) | IS 2007-01 to 2016-12 | 2080 (2080) | 52% | 15% | 27.98 | +0.064 | +0.023 | +0.015 | +0.026 |  |  | +0.459 (+0.96) | +2.30 | +55.10 | −61.25 |  |  |  |  |
|  | OOS 2017-01 to 2026-10 | 2039 (2039) | 53% | 12% | 35.77 | +0.093 | +0.019 | +0.018 | +0.056 |  |  | +0.972 (+2.17) | +3.56 | +114.68 | −26.32 |  |  |  |  |
| Short on every Tue-Fri entry day to the week's end (baseline pool, overlapping, not a test) | IS 2007-01 to 2016-12 | 2080 (0) | 43% | 15% | 27.98 | −0.051 | +0.023 | 0.000 | −0.074 |  |  | −1.280 (−2.76) | −1.92 | −153.56 | −167.90 |  |  |  |  |
|  | OOS 2017-01 to 2026-10 | 2039 (0) | 42% | 16% | 35.77 | −0.074 | +0.019 | 0.000 | −0.093 |  |  | −1.603 (−3.58) | −2.87 | −189.15 | −209.69 |  |  |  |  |
| Continuation: T1's signals followed instead of faded (reading only, not a test) | IS 2007-01 to 2016-12 | 64 (33) | 47% | 19% | 28.78 | −0.054 | +0.021 | +0.006 | −0.080 |  |  | −0.043 (−1.06) | −0.71 | −5.14 | −6.97 |  |  |  |  |
|  | OOS 2017-01 to 2026-10 | 76 (44) | 42% | 21% | 46.85 | −0.013 | +0.015 | +0.010 | −0.038 |  |  | −0.025 (−0.43) | −0.15 | −2.90 | −5.58 |  |  |  |  |

The baseline pool rows overlap (up to four entries a week on the same side), so their month t is not a test statistic; they are the source of each test's matched baseline (same side, same entry weekday, same window).

Pass bar (pre-registered, each test on its own, Holm over three; the verdict follows T1): OOS net month mean > 0 with t >= 2 and Holm p < 0.05, the in-sample mean > 0, the OOS mean > 0 at 2x costs and financing, more than 38 of 40 placebo seeds below the real OOS t, and the OOS excess over the same-side baseline > 0.

| Check | T1 | T2 | T3 |
|---|---|---|---|
| oosPositive | no | no | no |
| oosT2 | no | no | no |
| holm05 | no | no | no |
| isSameSign | no | no | no |
| x2Positive | no | no | no |
| abovePlacebo | no | no | no |
| beatsBaseline | yes | no | yes |

## Placebo (40 seeds: each real trade replaced by the same-side, same-entry-weekday trade of a random week of the same window; OOS net month t)

| Test | p5 | p50 | p95 | max | Real | Seeds below the real |
|---|---|---|---|---|---|---|
| T1 | −2.54 | −0.06 | +1.16 | +1.31 | −0.17 | 19 of 40 |
| T2 | −0.87 | +0.53 | +2.21 | +2.69 | −0.20 | 9 of 40 |
| T3 | −2.29 | −0.78 | +0.81 | +1.02 | −0.07 | 28 of 40 |

## T1 by entry weekday, 2007-26 (sum of net R)

| Entry day | Trades | Net R |
|---|---|---|
| Tue | 24 | −4.76 |
| Wed | 44 | +1.10 |
| Thu | 72 | −1.63 |

## Per year (sum of net R by exit year)

| Year | T1 n | T1 net | T2 n | T2 net | T3 n | T3 net |
|---|---|---|---|---|---|---|
| 2007 | 1 | −0.23 | 1 | −0.23 | 0 | 0 |
| 2008 | 8 | −0.59 | 5 | −0.38 | 3 | −0.20 |
| 2009 | 6 | +0.40 | 0 | 0 | 6 | +0.40 |
| 2010 | 7 | −1.00 | 2 | −0.86 | 5 | −0.15 |
| 2011 | 11 | −1.93 | 5 | −0.77 | 6 | −1.15 |
| 2012 | 6 | −1.01 | 3 | +0.22 | 3 | −1.23 |
| 2013 | 7 | +1.12 | 6 | +1.18 | 1 | −0.06 |
| 2014 | 6 | −0.10 | 3 | −0.48 | 3 | +0.38 |
| 2015 | 7 | +1.24 | 4 | −0.74 | 3 | +1.98 |
| 2016 | 5 | −2.11 | 2 | −0.34 | 3 | −1.77 |
| 2017 | 5 | −0.73 | 2 | −0.59 | 3 | −0.14 |
| 2018 | 4 | −0.61 | 2 | −1.10 | 2 | +0.49 |
| 2019 | 5 | +0.22 | 0 | 0 | 5 | +0.22 |
| 2020 | 16 | −1.79 | 7 | −0.09 | 9 | −1.69 |
| 2021 | 4 | −0.53 | 4 | −0.53 | 0 | 0 |
| 2022 | 5 | +1.17 | 3 | −0.56 | 2 | +1.73 |
| 2023 | 6 | +0.92 | 4 | −0.10 | 2 | +1.02 |
| 2024 | 12 | +1.44 | 5 | +0.82 | 7 | +0.62 |
| 2025 | 14 | −0.43 | 3 | +0.52 | 11 | −0.95 |
| 2026 | 5 | −0.72 | 2 | +0.90 | 3 | −1.62 |

## Reading

- **The fade does nothing.** Out of sample T1 made −0.014R a trade net (n 76, month t −0.17; +0.009R gross), in sample −0.066R (n 64, month t −0.77); 19 of 40 placebo seeds sit below it. Costs are not the reason: the round trip took 0.015R and financing 0.008R a trade out of sample (median stop $46.85), against a gross result of about zero.
- **Against the same-side baseline it is noise either way.** Out of sample the matched baseline (same side, same entry weekday, every week) made −0.031R, so T1 is +0.017R above it (t 0.20); in sample −0.042R below it (t −0.46). The buys after a down week (T2) made −0.023R net out of sample against +0.062R for buying the same weekday of every week (excess −0.085R, t −0.69): a stretched down week is, if anything, a worse week to buy than an ordinary one. The sells after an up week (T3) lost less than selling every week (−0.008R against −0.099R, excess +0.091R, t 0.77), which is gold's rise showing on the baseline, not a signal.
- Following the stretched week instead (the mirror, reading only) lost too: −0.038R out of sample (n 76) and −0.080R in sample. A week that has already travelled a normal week's range by mid-week neither gives it back nor extends it in any measurable way on 2007-26 daily candles.
- Nothing proposed. Not an edge, not a gate on the gold book; nothing live changed. No variant (threshold, lookback, stop, hold) is tried here.
