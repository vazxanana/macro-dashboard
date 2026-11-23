# The end of an H1 pullback inside an H4 trend, from the right half of the range: result (23 Nov 2026)

**Verdict: FAIL.** T1 (five markets): +0.125R a trade after costs out of sample (n 120, month t 0.77), −0.036R in sample (n 154), +0.042R on 2010-2019 (n 411, month t 0.59). Lines missed: oosT, holm, isMean. T2 (gold) fails, T3 (forex) fails, T4 (location picks better) fails.

Pre-registered in PREREGISTRATION.md (committed before any trade was computed); run by `run.mjs` on the toolkit's OANDA mid 5m
cache. R after the toolkit's round-trip costs unless said; t on calendar-month sums (by exit month); windows by entry time;
p one-sided (mean > 0); Holm across T1-T4.

| Test | Window | n | R a trade after costs | month t | at 2x costs | before costs | Holm p (OOS) | passes |
|---|---|---|---|---|---|---|---|---|
| T1 five markets pooled | 2010-2019 (replication) | 411 | +0.042 | 0.59 | +0.017 | +0.068 |  |  |
| T1 five markets pooled | 2020-2023 (IS) | 154 | −0.036 | −0.37 | −0.059 | −0.013 |  |  |
| T1 five markets pooled | 2024 - end of cache (OOS) | 120 | +0.125 | 0.77 | +0.103 | +0.146 | 0.44 | no |
| T2 gold alone | 2010-2019 (replication) | 76 | −0.038 | −0.24 | −0.082 | +0.006 |  |  |
| T2 gold alone | 2020-2023 (IS) | 27 | −0.315 | −1.35 | −0.344 | −0.285 |  |  |
| T2 gold alone | 2024 - end of cache (OOS) | 20 | +0.495 | 1.20 | +0.480 | +0.510 | 0.37 | no |
| T3 four forex pairs pooled | 2010-2019 (replication) | 335 | +0.060 | 0.73 | +0.039 | +0.082 |  |  |
| T3 four forex pairs pooled | 2020-2023 (IS) | 127 | +0.023 | 0.19 | +0.001 | +0.044 |  |  |
| T3 four forex pairs pooled | 2024 - end of cache (OOS) | 100 | +0.051 | 0.26 | +0.028 | +0.074 | 0.44 | no |
| T4 rejected by the location step (comparison) | 2010-2019 (replication) | 327 | −0.030 | −0.45 | −0.053 | −0.006 |  |  |
| T4 rejected by the location step (comparison) | 2020-2023 (IS) | 143 | −0.106 | −1.15 | −0.127 | −0.085 |  |  |
| T4 rejected by the location step (comparison) | 2024 - end of cache (OOS) | 88 | −0.125 | −0.93 | −0.146 | −0.104 | 0.37 | no |

T4 (out of sample, location kept against rejected): kept +0.125R (n 120), rejected −0.125R (n 88), difference +0.250R, Welch t 1.34, one-sided p 0.09, Holm 0.37. The T4 rows of the table are the rejected stream.

## Per market (T1 rows), R a trade after costs (n)

| Market | 2010-2019 | 2020-2023 | 2024 on | before costs 2024 on |
|---|---|---|---|---|
| eurusd | −0.086 (91) | +0.038 (29) | −0.103 (21) | −0.081 |
| usdjpy | +0.101 (85) | +0.014 (32) | +0.074 (23) | +0.088 |
| xau | −0.038 (76) | −0.315 (27) | +0.495 (20) | +0.510 |
| gbpusd | +0.228 (84) | −0.007 (38) | +0.280 (28) | +0.307 |
| audusd | +0.005 (75) | +0.058 (28) | −0.082 (28) | −0.057 |

## By year (T1), R a trade after costs (n)

2010 +0.196 (47) · 2011 −0.050 (36) · 2012 +0.030 (40) · 2013 −0.078 (36) · 2014 −0.071 (40) · 2015 +0.415 (35) · 2016 −0.186 (42) · 2017 +0.075 (53) · 2018 +0.170 (40) · 2019 −0.073 (42) · 2020 −0.272 (35) · 2021 −0.230 (43) · 2022 +0.142 (31) · 2023 +0.209 (45) · 2024 −0.024 (46) · 2025 −0.181 (31) · 2026 +0.504 (43)

## In plain words

- Before costs the rule is +0.146R a trade out of sample, −0.013R in sample and +0.068R on 2010-2019; the median cost is +0.020R a trade, the median target +1.76R away.
- Gold alone: +0.495R a trade after costs out of sample (n 20), −0.038R on 2010-2019 (n 76). Forex pooled: +0.051R (n 100) and +0.060R (n 335).
- The location step: out of sample the kept trades made +0.125R a trade and the rejected ones −0.125R (Welch t 1.34).
- External range (pullback past the 50 % line) +0.145R (n 75) against internal +0.090R (n 45) out of sample, after costs.
- Exits (T1, all windows): stop 427 (−1.00R before costs), target 254 (+1.84R before costs), time 4 (+0.89R before costs).
- Buys +0.080R and sells +0.159R a trade after costs out of sample.

## What it does NOT show

- It tests one mechanical reading of the market cycle (3-candle swings, the toolkit's structure), not the owner's own reading on a chart.
- No other swing size, half, target, stop or timeframe was tried, before or after the result (pre-registered).
- X is taken from the H1 candles after the H4 break's close, as written; a peak inside the break candle itself is not counted.
- Costs are today's demo figures charged on every year; financing (gold buys pay it) is not charged; stop slippage beyond a gap is not modelled.
- The 2x-costs line charges twice the cost on the same trades (the stop keeps its one-cost buffer).
- A FAIL is about this rule on these five markets; it does not judge discretionary trades.

Nothing live changed. Files: result.json (every number), trades.json (every T1 and T4-rejected trade), tests/h4-pullback-end.test.mjs.
