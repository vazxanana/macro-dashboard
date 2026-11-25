# The H1 fair value gap tapped after a continuation move, then an H1 QM or an M15 CHoCH, target the move's low: result (25 Nov 2026)

**Verdict: FAIL.** T1: −0.285R a trade after costs out of sample (n 18, month t −0.74), −0.331R in sample (n 23), −0.154R on 2010-2019 (n 40, month t −0.83); lines missed: oosMean, oosT, holm, isMean, oos2x, n30, repMean. T2: −0.146R a trade after costs out of sample (n 353, month t −1.74), −0.043R in sample (n 471), −0.083R on 2010-2019 (n 1265, month t −2.08); lines missed: oosMean, oosT, holm, isMean, oos2x, repMean.

Pre-registered in PREREGISTRATION.md (committed before any trade was computed); run by `run.mjs` on the toolkit's OANDA mid 5m
cache. R after the toolkit's round-trip costs unless said; t on calendar-month sums (by exit month); windows by entry time;
p one-sided (mean > 0); Holm across T1-T2.

| Test | Window | n | R a trade after costs | month t | at 2x costs | before costs | Holm p (OOS) | passes |
|---|---|---|---|---|---|---|---|---|
| T1 entry A (H1 QM), five markets pooled | 2010-2019 (replication) | 40 | −0.154 | −0.83 | −0.180 | −0.129 |  |  |
| T1 entry A (H1 QM), five markets pooled | 2020-2023 (IS) | 23 | −0.331 | −1.22 | −0.351 | −0.310 |  |  |
| T1 entry A (H1 QM), five markets pooled | 2024 - end of cache (OOS) | 18 | −0.285 | −0.74 | −0.309 | −0.261 | 1.00 | no |
| T2 entry B (M15 CHoCH), five markets pooled | 2010-2019 (replication) | 1265 | −0.083 | −2.08 | −0.126 | −0.039 |  |  |
| T2 entry B (M15 CHoCH), five markets pooled | 2020-2023 (IS) | 471 | −0.043 | −0.69 | −0.082 | −0.005 |  |  |
| T2 entry B (M15 CHoCH), five markets pooled | 2024 - end of cache (OOS) | 353 | −0.146 | −1.74 | −0.186 | −0.106 | 1.00 | no |
| D1 entry A, gold alone (not tested) | 2010-2019 (replication) | 6 | −0.242 | −0.51 | −0.283 | −0.202 |  |  |
| D1 entry A, gold alone (not tested) | 2020-2023 (IS) | 4 | −0.396 | −0.68 | −0.419 | −0.374 |  |  |
| D1 entry A, gold alone (not tested) | 2024 - end of cache (OOS) | 5 | −0.613 | −1.42 | −0.635 | −0.592 | - | no |
| D2 entry B, gold alone (not tested) | 2010-2019 (replication) | 262 | −0.178 | −1.89 | −0.249 | −0.106 |  |  |
| D2 entry B, gold alone (not tested) | 2020-2023 (IS) | 98 | −0.125 | −1.18 | −0.176 | −0.074 |  |  |
| D2 entry B, gold alone (not tested) | 2024 - end of cache (OOS) | 72 | +0.095 | 0.45 | +0.071 | +0.120 | - | no |

## Per market, T1 entry A (H1 QM), five markets pooled: R a trade after costs (n)

| Market | 2010-2019 | 2020-2023 | 2024 on | before costs 2024 on |
|---|---|---|---|---|
| eurusd | +0.065 (10) | −1.023 (3) | +0.032 (2) | +0.057 |
| usdjpy | −0.728 (9) | −0.547 (6) | −1.015 (2) | −1.000 |
| xau | −0.242 (6) | −0.396 (4) | −0.613 (5) | −0.592 |
| gbpusd | −0.089 (5) | −1.020 (5) | −0.033 (7) | −0.005 |
| audusd | +0.163 (10) | +1.086 (5) | +0.066 (2) | +0.091 |

By year: 2010 −0.225 (3) · 2012 −0.614 (5) · 2013 +1.157 (2) · 2014 −0.511 (5) · 2015 −0.092 (9) · 2016 +0.426 (4) · 2017 −0.015 (5) · 2018 +1.166 (1) · 2019 −0.693 (6) · 2020 −0.617 (6) · 2021 +0.420 (5) · 2022 −0.522 (5) · 2023 −0.485 (7) · 2024 −1.020 (4) · 2025 −0.208 (11) · 2026 +0.410 (3)

## Per market, T2 entry B (M15 CHoCH), five markets pooled: R a trade after costs (n)

| Market | 2010-2019 | 2020-2023 | 2024 on | before costs 2024 on |
|---|---|---|---|---|
| audusd | −0.009 (272) | −0.125 (95) | −0.301 (67) | −0.248 |
| usdjpy | −0.097 (276) | −0.065 (104) | −0.250 (71) | −0.219 |
| eurusd | −0.084 (242) | +0.288 (90) | −0.161 (70) | −0.114 |
| xau | −0.178 (262) | −0.125 (98) | +0.095 (72) | +0.120 |
| gbpusd | −0.041 (213) | −0.183 (84) | −0.128 (73) | −0.084 |

By year: 2010 −0.218 (132) · 2011 +0.029 (110) · 2012 −0.049 (125) · 2013 −0.168 (155) · 2014 −0.154 (129) · 2015 −0.086 (123) · 2016 −0.094 (135) · 2017 −0.003 (122) · 2018 +0.129 (103) · 2019 −0.129 (131) · 2020 +0.092 (133) · 2021 −0.070 (114) · 2022 −0.236 (115) · 2023 +0.025 (109) · 2024 −0.127 (112) · 2025 +0.045 (129) · 2026 −0.386 (112)

## Per market, D1 entry A, gold alone (not tested): R a trade after costs (n)

| Market | 2010-2019 | 2020-2023 | 2024 on | before costs 2024 on |
|---|---|---|---|---|
| xau | −0.242 (6) | −0.396 (4) | −0.613 (5) | −0.592 |

By year: 2010 +1.339 (1) · 2012 −1.058 (1) · 2015 −0.235 (3) · 2016 −1.031 (1) · 2020 −1.019 (1) · 2021 −1.016 (1) · 2022 +1.492 (1) · 2023 −1.042 (1) · 2025 −0.613 (5)

## Per market, D2 entry B, gold alone (not tested): R a trade after costs (n)

| Market | 2010-2019 | 2020-2023 | 2024 on | before costs 2024 on |
|---|---|---|---|---|
| xau | −0.178 (262) | −0.125 (98) | +0.095 (72) | +0.120 |

By year: 2010 −0.515 (23) · 2011 −0.375 (31) · 2012 +0.031 (31) · 2013 −0.360 (29) · 2014 +0.117 (27) · 2015 +0.050 (26) · 2016 −0.200 (31) · 2017 −0.344 (19) · 2018 −0.286 (21) · 2019 +0.029 (24) · 2020 −0.123 (29) · 2021 −0.257 (25) · 2022 −0.020 (22) · 2023 −0.084 (22) · 2024 +0.847 (23) · 2025 +0.019 (28) · 2026 −0.627 (21)

## In plain words

- T1: before costs −0.261R out of sample, −0.310R in sample, −0.129R on 2010-2019; median cost +0.021R a trade, median target +1.57R away; buys −0.509R, sells −0.221R after costs out of sample; exits stop 56, target 25.
- T2: before costs −0.106R out of sample, −0.005R in sample, −0.039R on 2010-2019; median cost +0.035R a trade, median target +1.84R away; buys −0.202R, sells −0.101R after costs out of sample; exits stop 1396, target 687, time 6.
- Gold alone out of sample after costs: entry A −0.613R (n 5), entry B +0.095R (n 72); not tested, said for reading only.

## What it does NOT show

- It tests one mechanical reading of the owner's chart idea (3-candle swings, 0.25 ATR gaps, the toolkit's QM), not his own marking.
- No other FVG size, tap rule, stop, target or timeframe was tried, before or after the result (pre-registered).
- Costs are today's demo figures charged on every year; financing is not charged; stop slippage beyond a gap is not modelled.
- A FAIL is about this rule on these five markets; it does not judge discretionary trades.

Nothing live changed. Files: result.json (every number), trades.json (every trade), tests/fvg-qm-continuation.test.mjs.
