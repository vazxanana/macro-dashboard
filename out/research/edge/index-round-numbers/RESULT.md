# Round numbers on four index CFDs (stall and break): result

**Verdict: FAIL: 0 of 2 rules pass. T1 OOS -0.072R net (n 1055, t -1.94), IS -0.147R; T2 OOS -0.008R net (n 2347, t -0.24), IS -0.124R**

Pre-registered in PREREGISTRATION.md (committed and pushed before any candle was read). Markets nas100, spx500, us30, de40, OANDA mid M5,
cash sessions only (US 09:30-16:00 New York, DAX 09:00-17:30 Frankfurt), in sample 2016-01-01 to 2020-12-31, out of sample 2021-01-01 to 2026-11-12.
Levels: multiples of 500 (nas100), 100 (spx500), 1000 (us30), 1000 (de40); the half grid is the secondary; the placebo shifts the grid
by a random fraction of a step per market (40 seeds). Distances scale with the daily ATR(14). Costs: round trip nas100 2.0, spx500 1.0, us30 5.5, de40 2.0 index points (orb-nas100 / pre-fomc-drift, open-run-breadth). No financing (intraday).
t on calendar-month sums; Holm over the four tests. The comparable forex study is `fx-round-numbers` (FAIL, 0 of 2). Paper research only: nothing live changed.

## The four tests, pooled

| Test | Window | n | Gross R a trade | Net R a trade | t (months, net) | t (months, gross) | Total net R | Win rate | Net at 2x costs | t at 2x |
|---|---|---|---|---|---|---|---|---|---|---|
| T1 round | IS 2016-20 | 409 | −0.070 | −0.147 | -2.59 | -1.25 | −60.2 | 37.2 % | −0.224 | -3.84 |
| T1 round | OOS 2021 on | 1055 | −0.030 | −0.072 | -1.94 | -0.81 | −76.2 | 39.4 % | −0.114 | -3.03 |
| T2 round | IS 2016-20 | 959 | −0.023 | −0.124 | -2.74 | -0.53 | −118.9 | 34.4 % | −0.225 | -4.73 |
| T2 round | OOS 2021 on | 2347 | +0.046 | −0.008 | -0.24 | 1.44 | −18.0 | 36.5 % | −0.061 | -1.91 |
| T1 half | IS 2016-20 | 412 | −0.025 | −0.112 | -1.54 | -0.35 | −46.3 | 38.3 % | −0.200 | -2.67 |
| T1 half | OOS 2021 on | 1057 | −0.018 | −0.060 | -1.70 | -0.50 | −63.3 | 37.5 % | −0.102 | -2.87 |
| T2 half | IS 2016-20 | 968 | −0.048 | −0.152 | -2.96 | -0.94 | −147.1 | 33.0 % | −0.256 | -4.87 |
| T2 half | OOS 2021 on | 2383 | +0.036 | −0.018 | -0.60 | 1.22 | −42.9 | 36.1 % | −0.072 | -2.37 |

T1: stall: limit at the first in-session touch of a level approached from 0.5 x ATR away, against the approach, stop 0.25 x ATR beyond, target 0.5 x ATR, flat at the session close. T2: break: first M5 close 0.05 x ATR beyond a level it touched, market at the next open, stop 0.1 x ATR back past the level, target 0.5 x ATR, flat at the session close. "half" = the same rule on the grid shifted by half a step.

## The pass bar

| Test | Role | Verdict | OOS n >= 100 | OOS month-sum t >= 2 | Holm p < 0.05 | IS net R a trade > 0 | OOS net at 2x costs > 0 | beats the placebo 95th percentile | p (one-sided, OOS) | Holm p |
|---|---|---|---|---|---|---|---|---|---|---|
| T1 round | primary | FAIL | yes | no | no | no | no | no | 0.97381 | 1 |
| T2 round | primary | FAIL | yes | no | no | no | no | no | 0.59483 | 1 |
| T1 half | secondary | FAIL | yes | no | no | no | no | no | 0.95543 | 1 |
| T2 half | secondary | FAIL | yes | no | no | no | no | no | 0.72575 | 1 |

## Placebo: the grid shifted by a random fraction of a step (OOS, 40 seeds)

| Test | Real net R a trade | Placebo mean | Placebo 95th pct | Placebo range | Real gross | Placebo gross mean | Placebo gross 95th pct | Real rank among 41 |
|---|---|---|---|---|---|---|---|---|
| T1 round | −0.072 | −0.064 | −0.025 | −0.129 to −0.009 | −0.030 | −0.022 | +0.018 | 27 |
| T2 round | −0.008 | −0.019 | +0.032 | −0.066 to +0.040 | +0.046 | +0.035 | +0.085 | 11 |
| T1 half | −0.060 | −0.064 | −0.025 | −0.129 to −0.009 | −0.018 | −0.022 | +0.018 | 20 |
| T2 half | −0.018 | −0.019 | +0.032 | −0.066 to +0.040 | +0.036 | +0.035 | +0.085 | 21 |

## Per market (net R a trade, n, gross, t on months)

| Test | Market | OOS net | n | gross | t | IS net | n | gross | t |
|---|---|---|---|---|---|---|---|---|---|
| T1 round | nas100 | −0.042 | 339 | −0.017 | -0.83 | −0.008 | 86 | +0.051 | -0.07 |
| T1 round | spx500 | −0.118 | 338 | −0.058 | -2.29 | −0.223 | 127 | −0.108 | -2.47 |
| T1 round | us30 | −0.083 | 259 | −0.037 | -1.11 | −0.120 | 117 | −0.051 | -1.23 |
| T1 round | de40 | −0.005 | 119 | +0.026 | -0.05 | −0.218 | 79 | −0.169 | -1.99 |
| T2 round | nas100 | +0.103 | 769 | +0.136 | 1.77 | −0.078 | 205 | −0.003 | -0.77 |
| T2 round | spx500 | −0.075 | 733 | +0.002 | -1.63 | −0.167 | 305 | −0.018 | -2.21 |
| T2 round | us30 | −0.030 | 547 | +0.029 | -0.47 | −0.114 | 283 | −0.025 | -1.25 |
| T2 round | de40 | −0.089 | 298 | −0.047 | -1.02 | −0.118 | 166 | −0.056 | -1.11 |
| T1 half | nas100 | −0.047 | 344 | −0.021 | -0.78 | −0.299 | 86 | −0.227 | -2.35 |
| T1 half | spx500 | −0.052 | 353 | +0.007 | -0.80 | −0.214 | 141 | −0.087 | -1.89 |
| T1 half | us30 | −0.046 | 243 | +0.000 | -0.59 | −0.016 | 115 | +0.061 | -0.15 |
| T1 half | de40 | −0.152 | 117 | −0.119 | -1.76 | +0.164 | 70 | +0.208 | 1.65 |
| T2 half | nas100 | −0.008 | 727 | +0.024 | -0.14 | −0.089 | 214 | −0.003 | -0.93 |
| T2 half | spx500 | −0.028 | 795 | +0.049 | -0.60 | −0.137 | 314 | +0.013 | -1.71 |
| T2 half | us30 | −0.033 | 568 | +0.025 | -0.61 | −0.246 | 277 | −0.151 | -2.92 |
| T2 half | de40 | +0.014 | 293 | +0.055 | 0.16 | −0.103 | 163 | −0.049 | -1.08 |

## By year (net R a trade / total, n)

| Year | T1 round | T2 round | T1 half | T2 half |
|---|---|---|---|---|
| 2016 | −0.054 / −2.3 (n 42) | −0.130 / −15.6 (n 120) | −0.193 / −12.3 (n 64) | −0.127 / −20.1 (n 158) |
| 2017 | −0.148 / −5.3 (n 36) | −0.309 / −27.5 (n 89) | −0.135 / −5.4 (n 40) | −0.160 / −14.1 (n 88) |
| 2018 | −0.276 / −29.3 (n 106) | −0.200 / −44.9 (n 225) | −0.234 / −26.6 (n 114) | −0.165 / −37.5 (n 227) |
| 2019 | −0.159 / −11.3 (n 71) | −0.246 / −39.9 (n 162) | −0.035 / −2.2 (n 61) | −0.197 / −26.6 (n 135) |
| 2020 | −0.078 / −12.1 (n 154) | +0.025 / +9.0 (n 363) | +0.002 / +0.2 (n 133) | −0.135 / −48.7 (n 360) |
| 2021 | −0.075 / −9.4 (n 125) | −0.016 / −4.5 (n 290) | −0.133 / −17.7 (n 133) | −0.054 / −15.6 (n 288) |
| 2022 | −0.068 / −15.5 (n 229) | +0.147 / +72.2 (n 491) | −0.166 / −34.6 (n 208) | +0.120 / +57.2 (n 478) |
| 2023 | −0.054 / −8.0 (n 147) | −0.069 / −21.0 (n 305) | +0.013 / +1.7 (n 128) | −0.038 / −10.8 (n 285) |
| 2024 | +0.000 / +0.1 (n 165) | −0.022 / −7.5 (n 349) | −0.022 / −3.3 (n 154) | −0.162 / −57.3 (n 353) |
| 2025 | −0.099 / −18.9 (n 191) | −0.045 / −20.0 (n 447) | −0.005 / −1.2 (n 241) | −0.018 / −9.1 (n 504) |
| 2026 | −0.123 / −24.4 (n 198) | −0.080 / −37.2 (n 465) | −0.042 / −8.2 (n 193) | −0.015 / −7.1 (n 475) |

## Exits and risk, OOS

- T1 round: stop 476, target 170, time 409; median cost 0.038 R a trade
- T2 round: stop 1326, target 423, time 598; median cost 0.048 R a trade
- T1 half: stop 469, time 415, target 173; median cost 0.039 R a trade
- T2 half: target 416, stop 1344, time 623; median cost 0.048 R a trade

## Data

| Market | M5 candles | First | Last | Sessions with an ATR |
|---|---|---|---|---|
| nas100 | 771096 | 2015-12-01 00:00 | 2026-11-13 21:55 | 2810 |
| spx500 | 754091 | 2015-12-01 00:00 | 2026-11-13 21:55 | 2810 |
| us30 | 770859 | 2015-12-01 00:00 | 2026-11-13 21:55 | 2810 |
| de40 | 615287 | 2015-12-01 07:00 | 2026-11-13 20:55 | 2767 |

To repeat: `node --use-env-proxy research/edge/index-round-numbers/run.mjs fetch <dir>` (candles outside git), then `node research/edge/index-round-numbers/run.mjs full <dir>`. Tests: `tests/index-round-numbers.test.mjs`.
