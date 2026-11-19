# Momentum acceleration on spot gold: result (14 Nov 2026)

**Verdict: FAIL: 13-week acceleration added +0.029R a trade over the same-side baseline 2017-26 (n 76, month t 0.21); own net -0.015R.**

Paper research only. No live rule, size, filter, council member or page changed. Rule, costs, windows, the baseline, the three tests and the placebo were fixed in `PREREGISTRATION.md`, pushed alone (da83cf932) before any candle was read. Data: council-data `research/daily/xau.json` at `2ad23e383`, OANDA mid daily candles, weekend stubs folded into Monday; 1077 complete weeks from 2006-03-20 to 2026-11-02. A stand-alone rule, not a gate, exit, entry or size of the gold book (owner decision 44); not an edge without n and t.

## The three tests (R a trade, 1R = 2 x ATR(20); monthly sums by exit month over every calendar month of the window)

Month column = the test's own measure (excess R for T1 / T3, net R for T2). Costs = $0.60 a round trip + financing on buys.

| Test | Window | Trades | Longs | Won | Stopped | Median stop $ | Gross R | Net R | Excess R | Cost share | Month (t) | Month gross t | Total | Worst DD | OOS at 2x costs (t) | One-sided p | Holm p | Pass |
|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|
| T1 13-week acceleration, excess over the same-side baseline (primary) | IS 2007-01 to 2016-12 | 68 | 31 | 38% | 54% | 38.24 | −0.164 | −0.221 | −0.165 | n/a | −0.094 (−1.20) | −1.16 | −11.24 | −20.25 |  |  |  |  |
|  | OOS 2017-01 to 2026-10 | 76 | 37 | 43% | 46% | 48.69 | +0.057 | −0.015 | +0.029 | 126% | +0.019 (+0.21) | +0.40 | +2.22 | −11.51 | +0.019 (+0.21) | 0.417 | 1.000 | no |
| T2 13-week acceleration, own net R | IS 2007-01 to 2016-12 | 68 | 31 | 38% | 54% | 38.24 | −0.164 | −0.221 |  | n/a | −0.125 (−1.57) | −1.16 | −15.02 | −23.39 |  |  |  |  |
|  | OOS 2017-01 to 2026-10 | 76 | 37 | 43% | 46% | 48.69 | +0.057 | −0.015 |  | 126% | −0.009 (−0.10) | +0.40 | −1.11 | −12.83 | −0.055 (−0.62) | 0.540 | 1.000 | no |
| T3 26-week acceleration, excess over the same-side baseline | IS 2007-01 to 2016-12 | 44 | 21 | 50% | 39% | 40.68 | +0.389 | +0.331 | +0.384 | 15% | +0.141 (+1.76) | +1.78 | +16.90 | −3.98 |  |  |  |  |
|  | OOS 2017-01 to 2026-10 | 61 | 28 | 36% | 53% | 43.58 | −0.062 | −0.135 | −0.078 | n/a | −0.040 (−0.44) | −0.34 | −4.77 | −9.65 | −0.043 (−0.47) | 0.670 | 1.000 | no |

Pass bar (pre-registered, each test on its own, Holm over three; the verdict is T1's): OOS month mean > 0 with t >= 2 and Holm p < 0.05, the in-sample mean > 0, the OOS mean > 0 at 2x costs and financing (baseline recomputed at 2x), the OOS t above the placebo's 95th percentile.

| Check | T1 | T2 | T3 |
|---|---|---|---|
| oosPositive | yes | no | no |
| oosT2 | no | no | no |
| holm05 | no | no | no |
| isSameSign | no | no | yes |
| x2Positive | yes | no | no |
| abovePlacebo95 | no | no | no |

## The baseline: a buy and a sell in every week (same entry, stop, four-week hold; overlapping)

| Window | Long n | Long gross R | Long net R | Long month t | Short n | Short gross R | Short net R | Short month t |
|---|---|---|---|---|---|---|---|---|
| IS 2007-16 | 508 | +0.124 | +0.016 | +0.17 | 508 | −0.099 | −0.116 | −1.36 |
| OOS 2017-26 | 513 | +0.320 | +0.187 | +1.78 | 512 | −0.249 | −0.263 | −3.42 |

(Baseline month t is on overlapping trades and only describes the drift.)

## Long and short legs apart

| Test | Window | Long n | Long net R | Long excess R | Long excess t | Short n | Short net R | Short excess R | Short excess t |
|---|---|---|---|---|---|---|---|---|---|
| T1 | IS | 31 | −0.130 | −0.146 | −0.72 | 37 | −0.297 | −0.181 | −0.98 |
|  | OOS | 37 | +0.090 | −0.097 | −0.42 | 39 | −0.114 | +0.149 | +0.91 |
| T2 | IS | 31 | −0.130 | −0.146 | −0.72 | 37 | −0.297 | −0.181 | −0.98 |
|  | OOS | 37 | +0.090 | −0.097 | −0.42 | 39 | −0.114 | +0.149 | +0.91 |
| T3 | IS | 21 | +0.258 | +0.242 | +0.71 | 23 | +0.398 | +0.514 | +1.82 |
|  | OOS | 28 | +0.037 | −0.150 | −0.48 | 33 | −0.280 | −0.017 | −0.09 |

## Placebo (40 seeds: each test's own trades with their sides shuffled among them; OOS month t of the test's measure)

| Test | p5 | p50 | p95 | max | Real | Seeds below the real | Signals with plain momentum of the same sign |
|---|---|---|---|---|---|---|---|
| T1 | −1.99 | +0.04 | +1.62 | +1.76 | +0.21 | 24 of 40 | 83% |
| T2 | −2.32 | −0.31 | +1.32 | +1.52 | −0.10 | 22 of 40 | 83% |
| T3 | −1.46 | −0.21 | +1.05 | +1.23 | −0.44 | 16 of 40 | 91% |

## Per year (sums by exit year; T2 shares T1's trades)

| Year | T1 n | T1 net | T1 excess | T3 n | T3 net | T3 excess |
|---|---|---|---|---|---|---|
| 2007 | 3 | +2.33 | +2.28 | 1 | −1.03 | −1.05 |
| 2008 | 4 | +0.71 | +1.18 | 8 | +6.42 | +6.94 |
| 2009 | 5 | −2.16 | −1.98 | 4 | −2.01 | −2.07 |
| 2010 | 8 | −4.13 | −3.73 | 3 | −1.26 | −1.04 |
| 2011 | 9 | −2.34 | −1.82 | 1 | +1.49 | +1.48 |
| 2012 | 5 | −0.11 | +0.07 | 4 | +0.61 | +0.94 |
| 2013 | 9 | +1.66 | +2.30 | 7 | +4.48 | +5.29 |
| 2014 | 9 | −7.00 | −6.35 | 4 | +2.31 | +2.38 |
| 2015 | 6 | −3.07 | −2.91 | 3 | −1.52 | −1.18 |
| 2016 | 10 | −0.91 | −0.28 | 9 | +5.10 | +5.21 |
| 2017 | 7 | −4.10 | −4.06 | 10 | −7.31 | −6.48 |
| 2018 | 7 | +5.75 | +6.24 | 7 | +0.16 | +2.00 |
| 2019 | 13 | +0.40 | +0.66 | 8 | +2.75 | +1.25 |
| 2020 | 7 | +2.21 | +2.70 | 4 | −4.07 | −3.92 |
| 2021 | 5 | −1.27 | −1.31 | 6 | −1.83 | −0.70 |
| 2022 | 6 | +3.69 | +3.92 | 4 | −0.08 | +0.98 |
| 2023 | 6 | −0.13 | +0.10 | 9 | −2.35 | −2.69 |
| 2024 | 9 | −7.57 | −7.46 | 5 | +2.64 | +2.15 |
| 2025 | 10 | −0.27 | +0.11 | 1 | +1.11 | +0.93 |
| 2026 | 6 | +0.18 | +1.31 | 7 | +0.78 | +1.72 |

## Reading

- **The primary test fails.** Out of sample the 13-week acceleration rule made +0.029R a trade more than the same-side every-week trade (n 76, month t 0.21, Holm p 1.000); in sample it made −0.165R less (n 68, t −1.20): the sign flips between the windows. Its sides beat 24 of 40 shuffles of the same sides (placebo 95th percentile t 1.62): no information in the direction.
- **On its own the rule loses.** Net −0.015R a trade out of sample (+0.057R gross; spread 0.014R and financing 0.057R take more than the gross, cost share 126%) and −0.221R in sample (t −1.57). Median stop $48.69 out of sample, $38.24 in sample.
- **The baseline is gold's drift.** A buy of every week with the same stop and hold made +0.187R net out of sample and +0.016R in sample; a sell lost −0.263R and −0.116R. The rule's long leg (+0.090R net out of sample) is under the plain buy (excess −0.097R); its short leg loses less than the plain sell (excess +0.149R, t 0.91), which is what the small positive T1 is made of.
- **The 26-week reading (T3) reverses**: +0.384R excess in sample (n 44, t 1.76), −0.078R out of sample (n 61, t −0.44).
- 83% (T1) and 91% (T3) of the signals point the same way as plain momentum over the last half-window: the reading is mostly momentum, and gold's momentum is already known not to pay here (`gold-tsmom`, `gold-weekly-momentum`). Nothing proposed; not an edge; nothing live changed.
