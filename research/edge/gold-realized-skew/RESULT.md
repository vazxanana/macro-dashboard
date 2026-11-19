# Gold's intraday realized skewness and the next week's return: result

**Verdict: FAIL. Both sides out of sample +0.031R a trade net (n 320, t 0.65, Holm p 0.52), in sample -0.027R, -0.008R at 2x costs; 0 of 3 conditions met.**

Paper research only. No live rule, size, filter, council member or page changed, and the gold book is not touched (a stand-alone
rule; none of the book's 2006-17 positions is read, owner item 44). Rule, costs, windows, the three tests and the pass bar were fixed
in `PREREGISTRATION.md`, pushed alone before anything was computed.

## What was tested
OANDA mid gold 5-minute candles, 1 Nov 2006 to 13 Nov 2026 (1,431,423 candles, 5,172 kept 17:00 New York days). Each day's
realized skewness of its 5-minute log returns, averaged over five days, ranked against the previous 250 values: under the 20th
percentile buy, over the 80th sell, at the next day's first open; stop 1.5 x ATR(20) daily (every trade has one, checked on
5-minute candles, a gap fills at the open), out at the close of the 5th day, one at a time. Costs $0.60 a round trip plus
`nights` x `FIN.xau.long` on buys. t on calendar-month sums of net R (empty months count 0), Holm over the three tests.

## The three tests

| Test | Window | n | Gross R a trade | Net R a trade | t gross | t net | Total net R | Worst drawdown R | Net at 2x costs |
|---|---|---|---|---|---|---|---|---|---|
| T1 both sides (primary) | In sample 2007-16 | 305 | +0.011 | -0.027 | 0.17 | -0.44 | -8.30 | -18.81 | |
| T1 both sides (primary) | Out of sample 2017-26 | 320 | +0.070 | +0.031 | 1.46 | 0.65 | +9.93 | -11.31 | -0.008 |
| T2 buys only | In sample | 155 | +0.023 | -0.032 | 0.30 | -0.42 | -5.00 | -20.70 | |
| T2 buys only | Out of sample | 169 | +0.231 | +0.172 | 2.99 | 2.26 | +29.10 | -5.72 | +0.114 |
| T3 sells only | In sample | 161 | -0.056 | -0.077 | -0.57 | -0.78 | -12.47 | -22.06 | |
| T3 sells only | Out of sample | 165 | -0.090 | -0.109 | -1.38 | -1.66 | -18.00 | -19.02 | -0.128 |

Holm-adjusted one-sided p (out of sample, net): T1 0.5157, T2 0.0357, T3 0.9515.

| Condition (T1) | Met |
|---|---|
| 1. Out-of-sample net t >= 2 with Holm p < 0.05 | no (t 0.65, p 0.52) |
| 2. In-sample net mean of the same sign | no (-0.027R against +0.031R) |
| 3. Out of sample positive at 2x costs | no (-0.008R) |

## Placebo
40 seeded draws of 320 out-of-sample entries on random days, with T1's buy / sell mix and the same stop, exit and costs: mean
-0.029R a trade, 95th percentile +0.025R; the real +0.031R beats 38 of 40. Above the placebo, but the stream's own month t is
0.65 and it loses after costs in sample: not a finding.

## Reading
- The published sign (low skew, higher returns) shows only on the buy side and only out of sample. T2's out-of-sample +0.172R
  (Holm p 0.036) sits on gold's 2017-26 rise: a 5-day buy entered on every out-of-sample day with the same stop, exit and costs
  makes +0.091R (2,537 trades; in sample -0.004R), and T2 lost in sample (-0.032R). T2 cannot pass the study alone and is not
  evidence of an edge. (The every-day buy was added after the result, as context; it is not a test.)
- The sell side loses in both windows.
- Year by year (T1, net R): 2007 -1.71, 2008 -0.40, 2009 +3.11, 2010 -7.37, 2011 +6.08, 2012 -1.87, 2013 +8.91, 2014 -4.50,
  2015 -6.99, 2016 -3.55, 2017 -3.81, 2018 +2.51, 2019 +6.00, 2020 +4.92, 2021 -1.25, 2022 +1.74, 2023 -1.08, 2024 -4.52,
  2025 +8.00, 2026 -1.54 (10 of 20 years positive).
- Thresholds 0.10 / 0.90 (reported only): in sample -0.013R (n 182, t -0.17), out of sample +0.044R (n 188, t 0.68).

Not an edge. Do not use intraday realized skewness as a gold signal, gate or size step.

## To repeat
`node research/edge/mosha-sweep/run.mjs fetch <dir>` (OANDA 5-minute gold through the candle proxy, kept out of git), then
`node research/edge/gold-realized-skew/run.mjs <dir>/xau-5m.json.gz`. Test: `tests/gold-realized-skew.test.mjs`.
