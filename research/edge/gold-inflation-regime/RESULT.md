# Long gold while stocks and bonds move together: result (14 Nov 2026)

**Verdict: FAIL, 0 of 3: longs while stocks and bonds co-move beat gold's drift by +0.019R a trade net 2017-26 (n 93, month t +0.16), -0.056R in 2007-16 (n 32).**

Paper research only. No live rule, size, filter, council member or page changed. Rule, costs, windows, the three tests and the placebo were fixed in `PREREGISTRATION.md`, pushed alone (ec2a2ced8) before any trade was simulated. Data: council-data `research/daily/xau.json`, `spx500.json` and `usb10y.json` at `fff1565f5`, OANDA mid daily candles, weekend stubs folded into the next weekday; 5369 gold days from 2006-03-20 to 2026-11-13, 5346 of them with an S&P 500 and a 10-year note candle. Share of signal days with C > 0: 2007-16 10.4 % (C > 0.3: 0.2 %), 2017-26 32.3 % (16.3 %). One position at a time per test. A stand-alone rule, not a gate, exit, entry or size of the gold book, and none of its positions is read (owner decision 44); not an edge without n and t.

## The three tests (R a trade, 1R = the stop distance, 2 x ATR(20), ten days held; excess = net R minus the mean net R of the same-side trade on every eligible day of the window; monthly sums by exit month)

| Test | Window | Trades | Won | Stopped | Median stop $ | Gross R | Net R | Excess R | Cost share | Month net t | Month excess (t) | Total net R | Worst DD R | OOS 2x costs: net (t), excess (t) | One-sided p | Holm p | Pass |
|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|
| T1 Long gold when the stock-bond correlation is positive, C > 0 (primary) | IS 2007-01 to 2016-12 | 32 | 47% | 34% | 33.80 | +0.029 | −0.042 | −0.056 | 245% | −0.33 | −0.015 (−0.44) | −1.35 | −5.64 |  |  |  |  |
|  | OOS 2017-01 to 2026-10 | 93 | 45% | 27% | 53.89 | +0.210 | +0.143 | +0.019 | 32% | +1.18 | +0.015 (+0.16) | +13.28 | −10.27 | +0.059 (+0.63), +0.023 (+0.25) | 0.436 | 1.000 | no |
| T2 Long gold when C > 0.3 | IS 2007-01 to 2016-12 | 2 | 0% | 50% | 33.85 | −0.735 | −0.822 | −0.836 | n/a (gross ≤ 0) | −1.35 | −0.014 (−1.35) | −1.64 | −1.64 |  |  |  |  |
|  | OOS 2017-01 to 2026-10 | 48 | 44% | 27% | 56.63 | +0.190 | +0.124 | 0.000 | 35% | +0.75 | 0.000 (0.00) | +5.94 | −3.22 | +0.023 (+0.35), +0.005 (+0.07) | 0.500 | 1.000 | no |
| T3 Short gold when C < 0 (hedging regime) | IS 2007-01 to 2016-12 | 255 | 42% | 38% | 36.56 | −0.091 | −0.108 | −0.012 | n/a (gross ≤ 0) | −1.64 | −0.025 (−0.18) | −27.63 | −39.73 |  |  |  |  |
|  | OOS 2017-01 to 2026-10 | 195 | 38% | 42% | 43.86 | −0.180 | −0.196 | −0.028 | n/a (gross ≤ 0) | −2.78 | −0.046 (−0.42) | −38.21 | −42.57 | −0.350 (−2.99), −0.049 (−0.44) | 0.663 | 1.000 | no |

| Same-side baseline (every eligible day, overlapping; not a test) | n IS | n OOS | Gross R IS | Gross R OOS | Net R IS | Net R OOS | Net R 2x OOS |
|---|---|---|---|---|---|---|---|
| Long every day | 2581 | 2560 | +0.081 | +0.202 | +0.013 | +0.124 | +0.046 |
| Short every day | 2582 | 2548 | −0.080 | −0.154 | −0.097 | −0.168 | −0.182 |

Pass bar (pre-registered, each test on its own, Holm over three; the verdict follows T1): OOS month mean of excess > 0 with t >= 2 and Holm p < 0.05, the in-sample excess > 0, the OOS plain net and the OOS excess > 0 at 2x costs and financing, the OOS excess t above the placebo's 95th percentile.

| Check | T1 | T2 | T3 |
|---|---|---|---|
| oosExPositive | yes | no | no |
| oosExT2 | no | no | no |
| holm05 | no | no | no |
| isSameSign | no | no | no |
| x2NetPositive | yes | yes | no |
| x2ExPositive | yes | yes | no |
| abovePlacebo95 | no | no | no |

## Placebo (40 seeds: each real trade replaced by a random same-side baseline trade exiting in the same window; OOS month t of excess)

| Test | p5 | p50 | p95 | max | Real | Seeds below the real |
|---|---|---|---|---|---|---|
| T1 | −1.77 | −0.10 | +1.50 | +1.52 | +0.16 | 27 of 40 |
| T2 | −1.66 | −0.57 | +1.47 | +1.68 | 0.00 | 26 of 40 |
| T3 | −1.83 | −0.04 | +1.44 | +1.87 | −0.42 | 13 of 40 |

## Per year (by exit year: trades, sum of net R, sum of excess R)

| Year | T1 n | T1 net | T1 excess | T2 n | T2 net | T2 excess | T3 n | T3 net | T3 excess |
|---|---|---|---|---|---|---|---|---|---|
| 2007 | 9 | +2.95 | +2.83 | 1 | −1.09 | −1.10 | 22 | −6.64 | −4.51 |
| 2008 | 0 | 0 | 0 | 0 | 0 | 0 | 28 | −3.99 | −1.28 |
| 2009 | 0 | 0 | 0 | 0 | 0 | 0 | 29 | −9.40 | −6.59 |
| 2010 | 0 | 0 | 0 | 0 | 0 | 0 | 29 | −11.77 | −8.96 |
| 2011 | 0 | 0 | 0 | 0 | 0 | 0 | 28 | −4.19 | −1.48 |
| 2012 | 0 | 0 | 0 | 0 | 0 | 0 | 27 | +0.81 | +3.43 |
| 2013 | 13 | −3.83 | −4.01 | 0 | 0 | 0 | 15 | +9.97 | +11.42 |
| 2014 | 2 | +0.99 | +0.96 | 0 | 0 | 0 | 26 | +0.52 | +3.04 |
| 2015 | 4 | −0.54 | −0.60 | 1 | −0.56 | −0.57 | 24 | +1.68 | +4.00 |
| 2016 | 4 | −0.91 | −0.97 | 0 | 0 | 0 | 27 | −4.63 | −2.02 |
| 2017 | 0 | 0 | 0 | 0 | 0 | 0 | 28 | −6.58 | −1.88 |
| 2018 | 0 | 0 | 0 | 0 | 0 | 0 | 28 | −2.62 | +2.08 |
| 2019 | 0 | 0 | 0 | 0 | 0 | 0 | 30 | −8.96 | −3.92 |
| 2020 | 0 | 0 | 0 | 0 | 0 | 0 | 28 | −7.18 | −2.48 |
| 2021 | 16 | −2.45 | −4.43 | 4 | +1.45 | +0.95 | 14 | +1.39 | +3.74 |
| 2022 | 14 | −4.55 | −6.29 | 6 | +2.94 | +2.19 | 15 | −1.51 | +1.01 |
| 2023 | 18 | +4.50 | +2.27 | 14 | +3.36 | +1.62 | 10 | −0.12 | +1.56 |
| 2024 | 17 | +5.21 | +3.10 | 8 | +0.85 | −0.14 | 11 | −2.39 | −0.54 |
| 2025 | 10 | +12.51 | +11.27 | 2 | +0.23 | −0.02 | 23 | −11.68 | −7.82 |
| 2026 | 18 | −1.95 | −4.18 | 14 | −2.88 | −4.62 | 8 | +1.42 | +2.77 |

## Reading

- **The positive stock-bond correlation adds nothing to a gold long.** Out of sample T1 made +0.143R a trade net (n 93, month t +1.18), but the same long taken on every eligible day made +0.124R: the excess is +0.019R a trade (month t +0.16), and 27 of 40 placebo seeds (random long days of the same window) sit below it, so it is inside the noise. In sample the excess was −0.056R (n 32, t −0.44): the sign is not even stable.
- **The stronger regime (T2, C > 0.3) is no better.** It existed on 0.2 % of in-sample days (2 trades) and 16.3 % of out-of-sample days; out of sample its 48 longs matched the every-day long exactly (excess +0.000R, t 0.00).
- **Shorting gold in the hedging regime (T3) loses, and only because gold rose.** Out of sample −0.196R a trade net (n 195, month t −2.78), but the every-day short lost −0.168R: excess −0.028R (t −0.42). The regime does not pick weak gold days.
- What the plain long figures show is gold's 2017-26 drift (the every-day long: +0.124R net out of sample, +0.013R in sample), which this test was built to take out. Nothing proposed. Not an edge, not a gate on the gold book; nothing live changed.
