# Gold's daily swing-structure flip, the "1-2-3": result (14 Nov 2026)

**Verdict: FAIL: the daily 1-2-3 flip made +0.024R a trade net 2017-26 both sides (n 93, month t 0.22); longs +0.121R (t 0.74), shorts -0.146R (t -1.15).**

Paper research only. No live rule, size, filter, council member or page changed. Rule, costs, windows, the three tests and the placebo were fixed in `PREREGISTRATION.md`, pushed alone (beb8ab81a) before any swing was located. Data: council-data `research/daily/xau.json` at `f6288251e`, OANDA mid daily candles, weekend stubs folded into Monday; 5364 days from 2006-03-20 to 2026-11-06. A stand-alone rule, not a gate, exit, entry or size of the gold book (owner decision 44); not an edge without n and t.

## The three tests (R a trade, 1R = the stop distance; monthly sums of net R on every calendar month of the window, by exit month)

| Test | Window | Trades | Longs | Won | Stopped | Median stop $ | Gross R | Cost R | Financing R | Net R | Month net (t) | Month gross t | Total net R | Worst DD R | OOS at 2x costs (t) | One-sided p | Holm p | Pass |
|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|
| T1 Both sides (primary) | IS 2007-01 to 2016-12 | 108 | 63 | 43% | 34% | 41.17 | −0.055 | +0.016 | +0.028 | −0.100 | −0.090 (−1.17) | −0.64 | −10.79 | −16.95 |  |  |  |  |
|  | OOS 2017-01 to 2026-10 | 93 | 56 | 47% | 25% | 52.03 | +0.077 | +0.013 | +0.040 | +0.024 | +0.019 (+0.22) | +0.69 | +2.25 | −7.03 | −0.022 (−0.26) | 0.413 | 0.826 | no |
| T2 Longs only | IS 2007-01 to 2016-12 | 64 | 64 | 44% | 38% | 39.99 | −0.027 | +0.018 | +0.048 | −0.093 | −0.050 (−0.86) | −0.25 | −5.96 | −11.31 |  |  |  |  |
|  | OOS 2017-01 to 2026-10 | 56 | 56 | 50% | 27% | 50.43 | +0.200 | +0.013 | +0.066 | +0.121 | +0.058 (+0.74) | +1.20 | +6.79 | −4.95 | +0.020 (+0.26) | 0.230 | 0.689 | no |
| T3 Shorts only | IS 2007-01 to 2016-12 | 49 | 0 | 43% | 31% | 45.50 | −0.103 | +0.015 | 0.000 | −0.118 | −0.048 (−0.99) | −0.86 | −5.78 | −10.06 |  |  |  |  |
|  | OOS 2017-01 to 2026-10 | 38 | 0 | 42% | 24% | 53.18 | −0.133 | +0.013 | 0.000 | −0.146 | −0.047 (−1.15) | −1.05 | −5.55 | −6.91 | −0.051 (−1.25) | 0.875 | 0.875 | no |
| Long every 10th day, 1.5 x ATR stop (comparison, not a test) | IS 2007-01 to 2016-12 | 260 | 260 | 42% | 45% | 27.85 | +0.086 | +0.023 | +0.061 | +0.003 | +0.006 (+0.03) | +1.08 | +0.68 | −33.51 |  |  |  |  |
|  | OOS 2017-01 to 2026-10 | 256 | 256 | 47% | 38% | 35.91 | +0.314 | +0.019 | +0.076 | +0.219 | +0.475 (+2.37) | +3.36 | +55.99 | −11.88 |  |  |  |  |

Pass bar (pre-registered; T1 decides): OOS net month mean > 0 with t >= 2 and Holm p < 0.05, the in-sample mean > 0, the OOS mean > 0 at 2x costs and financing, the OOS t above the placebo's 95th percentile.

| Check | T1 | T2 | T3 |
|---|---|---|---|
| oosPositive | yes | yes | no |
| oosT2 | no | no | no |
| holm05 | no | no | no |
| isSameSign | no | no | no |
| x2Positive | no | yes | no |
| abovePlacebo95 | no | no | no |

Signals not taken (all years): T1 stop nearer than 0.5 x ATR 0, stop on the wrong side of the open 0, long and short the same day 0; T2 stop nearer than 0.5 x ATR 0, stop on the wrong side of the open 0, long and short the same day 0; T3 stop nearer than 0.5 x ATR 0, stop on the wrong side of the open 0, long and short the same day 0.

## Placebo (40 seeds: each real trade's entry day replaced by a random day, same side, same stop in ATR units, same hold and costs, exiting in the same window; OOS net month t)

| Test | p5 | p50 | p95 | max | Real | Seeds below the real |
|---|---|---|---|---|---|---|
| T1 | −1.41 | −0.28 | +1.48 | +1.65 | +0.22 | 28 of 40 |
| T2 | −0.44 | +0.91 | +2.03 | +2.95 | +0.74 | 19 of 40 |
| T3 | −2.65 | −0.92 | +0.60 | +0.65 | −1.15 | 17 of 40 |

## Per year (sum of net R by exit year)

| Year | T1 n | T1 net | T2 n | T2 net | T3 n | T3 net |
|---|---|---|---|---|---|---|
| 2007 | 13 | +1.27 | 10 | +2.67 | 3 | −1.40 |
| 2008 | 10 | −3.53 | 7 | −0.88 | 3 | −2.65 |
| 2009 | 13 | −4.74 | 8 | −2.40 | 8 | −3.69 |
| 2010 | 11 | −2.71 | 7 | −0.49 | 4 | −2.22 |
| 2011 | 9 | +4.19 | 6 | +1.28 | 4 | +1.85 |
| 2012 | 10 | −0.83 | 5 | +0.49 | 5 | −1.31 |
| 2013 | 10 | +2.14 | 4 | −1.96 | 7 | +4.16 |
| 2014 | 10 | −4.01 | 6 | −3.09 | 4 | −0.92 |
| 2015 | 9 | −6.12 | 3 | −2.90 | 6 | −1.81 |
| 2016 | 13 | +3.52 | 8 | +1.32 | 5 | +2.20 |
| 2017 | 6 | −2.58 | 5 | −2.30 | 1 | −0.28 |
| 2018 | 10 | −0.58 | 3 | +1.12 | 7 | −1.70 |
| 2019 | 10 | −0.38 | 7 | +0.61 | 3 | −0.99 |
| 2020 | 11 | −0.26 | 8 | +2.19 | 3 | −2.45 |
| 2021 | 11 | −0.12 | 6 | −0.57 | 5 | +0.45 |
| 2022 | 8 | −2.39 | 4 | −3.13 | 4 | +0.75 |
| 2023 | 9 | +2.43 | 6 | +0.85 | 4 | +0.56 |
| 2024 | 9 | −1.84 | 5 | +0.41 | 4 | −2.25 |
| 2025 | 11 | +7.06 | 9 | +8.05 | 2 | −0.99 |
| 2026 | 8 | +0.92 | 3 | −0.44 | 5 | +1.36 |

## Reading

- **The structure flip does not pick better entries than chance.** Both sides together (T1, the primary) made +0.024R a trade net out of sample (n 93, month t 0.22; +0.077R gross) and -0.100R in sample (n 108, t -1.17); at 2x costs it loses out of sample (-0.022R a month). Its t sits above 28 of 40 random-timing seeds (placebo median -0.28, 95th percentile 1.48): inside the noise band.
- **The long side earns no more than gold's drift.** T2 made +0.121R a trade net out of sample (n 56, t 0.74), -0.093R in sample (n 64, t -0.86). Random-day longs with the same stop size gave a median t of 0.91; the real t sits above only 19 of 40 seeds. Long every 10th day (same hold, a 1.5 x ATR stop, same costs) made +0.219R a trade net out of sample (n 256, month t 2.37): buying gold at any time beat buying it on a 1-2-3.
- **The short side loses in both windows**: T3 -0.146R a trade net out of sample (n 38, t -1.15), -0.118R in sample (n 49, t -0.99).
- **Costs are small here**: the median stop is $41.17 in sample and $52.03 out of sample (the higher low is far from the break), so spread and slippage take 0.013-0.016R a trade and long financing 0.028-0.040R across T1. The rule fails before costs too (T1 gross month t -0.64 in sample, +0.69 out of sample).
- Nothing proposed. Not an edge, not a gate on the gold book; nothing live changed.
