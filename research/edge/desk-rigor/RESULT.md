# The desks' readings after the marking audit, and the methods' own conditions

Built 2026-11-21. Pre-registered (PREREGISTRATION.md, committed before any trade was computed). Paper research only.

**Verdict: FAIL (0 of 13).**

## Readings: does each make money after costs?

| | Reading | IS n | IS net R | OOS n | OOS before costs | OOS net R | month t | Holm p | Verdict |
|---|---|---|---|---|---|---|---|---|---|
| R1 | Mosha sequence (BO, VR, CF, pullback, EG) | 1967 | −0.082 | 978 | −0.059 | −0.172 | -2.22 | 1 | FAIL |
| R2 | Mosha barrier entry (D1, H4, H1 barriers) | 4437 | −0.126 | 2112 | −0.044 | −0.113 | -2.12 | 1 | FAIL |
| R3 | Engulf plan (with the Daily) | 1395 | −0.089 | 893 | +0.018 | −0.069 | -1.52 | 1 | FAIL |
| R4 | Engulf simple (not with the Daily) | 1754 | −0.144 | 1008 | +0.021 | −0.068 | -1.44 | 1 | FAIL |
| R5 | Engulf direct entry (fresh zones) | 162 | −0.147 | 97 | +0.010 | −0.075 | -0.53 | 1 | FAIL (too few to judge) |
| R6 | MSNR: with the direction | 6743 | −0.319 | 3957 | −0.038 | −0.300 | -11.87 | 1 | FAIL |
| R7 | MSNR gold plan | 1432 | −0.042 | 775 | +0.127 | +0.079 | 1.31 | 1 | FAIL |

R a trade; in sample 2020-2023, out of sample 2024-2025; t on calendar-month sums of net R.

## Conditions: does the subset the method prefers do better?

| | Condition | OOS preferred n | net R | OOS rest n | net R | monthly difference | t | Holm p | IS difference | Verdict |
|---|---|---|---|---|---|---|---|---|---|---|
| C1 | R1: the pullback reached 50% before the CF, against not | 813 | −0.200 | 165 | −0.034 | −0.229 | -1.51 | 1 | +0.133 | FAIL |
| C2 | R1: CF clear of the VR (case 1), against inside it (case 2) | 383 | −0.251 | 595 | −0.121 | −0.015 | -0.08 | 1 | −0.005 | FAIL |
| C3 | R2: barrier is the origin of a major BO, against an internal BO | 720 | −0.134 | 1392 | −0.102 | +0.010 | 0.13 | 1 | +0.025 | FAIL |
| C4 | R2: entry with the Daily structure, against not with it | 1082 | −0.147 | 1030 | −0.077 | −0.068 | -0.82 | 1 | +0.030 | FAIL |
| C5 | Engulf plan (R3) against the simple method (R4) | 893 | −0.069 | 1008 | −0.068 | +0.010 | 0.15 | 1 | +0.043 | FAIL |
| C6 | MSNR with the direction (R6) against the same entry against it | 3957 | −0.300 | 3835 | −0.343 | +0.051 | 1.51 | 0.8518 | −0.025 | FAIL |

## By market, out of sample (net R a trade, n)

| Reading | xau | eurusd | gbpusd |
|---|---|---|---|
| R1 | −0.070 (292) | −0.229 (342) | −0.201 (344) |
| R2 | +0.054 (580) | −0.256 (774) | −0.094 (758) |
| R3 | −0.006 (331) | −0.056 (248) | −0.148 (314) |
| R4 | +0.033 (354) | −0.022 (331) | −0.226 (323) |
| R5 | −0.075 (40) | +0.182 (27) | −0.306 (30) |
| R6 | −0.070 (1198) | −0.441 (1329) | −0.362 (1430) |
| R7 | +0.079 (775) | n/a | n/a |

## By year (net R, trades)

| Reading | 2020 | 2021 | 2022 | 2023 | 2024 | 2025 |
|---|---|---|---|---|---|---|
| R1 | −42.8 (499) | −33.0 (479) | +10.1 (535) | −96.0 (454) | −122.6 (482) | −45.5 (496) |
| R2 | −202.9 (1066) | −235.8 (1134) | −88.7 (1139) | −30.9 (1098) | −120.4 (1064) | −117.9 (1048) |
| R3 | −34.1 (347) | −23.2 (281) | −43.2 (382) | −24.0 (385) | −29.8 (395) | −32.2 (498) |
| R4 | −38.5 (432) | −43.6 (339) | −107.9 (537) | −62.5 (446) | −69.0 (447) | +0.7 (561) |
| R5 | −4.5 (32) | +1.7 (30) | −11.5 (55) | −9.5 (45) | −12.2 (42) | +4.9 (55) |
| R6 | −543.4 (1403) | −326.0 (1171) | −576.1 (2245) | −707.9 (1924) | −520.9 (1746) | −665.9 (2211) |
| R7 | +12.0 (349) | −42.9 (362) | −13.9 (381) | −15.9 (340) | +47.3 (398) | +13.6 (377) |
