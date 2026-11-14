# Round numbers on spot gold ($100 and $50 levels: stall and break): result

**Verdict: FAIL, 0 of 3: T1 OOS -0.09R net (n 344, t -1.37), IS -0.361R; T2 OOS -0.219R net (n 348, t -2.87), IS -0.231R; T3 OOS -0.062R net (n 615, t -0.83), IS -0.028R**

Pre-registered in PREREGISTRATION.md (committed and pushed before any candle was read). Spot gold (xau), OANDA mid M5, New York
17:00 trading days, in sample 2016-01-01 to 2020-12-31, out of sample 2021-01-01 to 2026-11-12. Levels: multiples of $100 (T1, T3) and the odd multiples
of $50 (T2); the placebo shifts the $100-spaced grid by a random fraction of a step (40 seeds, never within $5 of a real level).
Distances scale with the daily ATR(14). Costs: $0.30 a round trip + $0.15 (half the $0.30 spread) of slippage on every market order (the break entry, stop and time exits). No financing (every trade closed before the rollover). t on calendar-month
sums; Holm over the three tests. The comparable studies are `fx-round-numbers` and `index-round-numbers` (both FAIL, 0 of 2).
A standalone intraday rule, not a change to the live gold book. Paper research only: nothing live changed.

## The three tests

| Test | Window | n | Gross R a trade | Net R a trade | t (months, net) | t (months, gross) | Total net R | Win rate | Net at 2x costs | t at 2x |
|---|---|---|---|---|---|---|---|---|---|---|
| T1 | IS 2016-20 | 123 | −0.258 | −0.361 | -3.03 | -2.24 | −44.4 | 30.1 % | −0.463 | -3.72 |
| T1 | OOS 2021 on | 344 | −0.053 | −0.090 | -1.37 | -0.81 | −31.0 | 37.8 % | −0.127 | -1.93 |
| T2 | IS 2016-20 | 112 | −0.134 | −0.231 | -2.23 | -1.32 | −25.9 | 31.3 % | −0.328 | -3.05 |
| T2 | OOS 2021 on | 348 | −0.180 | −0.219 | -2.87 | -2.39 | −76.1 | 33.3 % | −0.257 | -3.35 |
| T3 | IS 2016-20 | 221 | +0.149 | −0.028 | -0.25 | 1.38 | −6.2 | 37.1 % | −0.204 | -1.70 |
| T3 | OOS 2021 on | 615 | +0.007 | −0.062 | -0.83 | 0.09 | −38.2 | 30.9 % | −0.131 | -1.72 |

- T1: stall at $100: limit at the first touch in the New York day of a $100 level approached from 0.5 x ATR away, against the approach, stop 0.25 x ATR beyond, target 0.5 x ATR, flat before the 17:00 New York rollover.
- T2: stall at $50: the same on the odd multiples of $50.
- T3: break of $100: first M5 close 0.05 x ATR beyond a $100 level it touched, market at the next open, stop 0.1 x ATR back past the level, target 0.5 x ATR, flat before the rollover.

## The pass bar

| Test | Verdict | OOS n >= 100 | OOS month-sum t >= 2 | Holm p < 0.05 | IS net R a trade > 0 | OOS net at 2x costs > 0 | beats 38 of 40 placebo grids | p (one-sided, OOS) | Holm p |
|---|---|---|---|---|---|---|---|---|---|
| T1 | FAIL | yes | no | no | no | no | no | 0.91466 | 1 |
| T2 | FAIL | yes | no | no | no | no | no | 0.99795 | 1 |
| T3 | FAIL | yes | no | no | no | no | no | 0.79673 | 1 |

## Placebo: the grid shifted by a random fraction of a step (OOS, 40 seeds)

| Test | Real net R a trade | Placebo mean | Placebo range | Grids the real one beats (of 40) | Real gross | Placebo gross mean | Real rank among 41 |
|---|---|---|---|---|---|---|---|
| T1 | −0.090 | −0.102 | −0.198 to +0.000 | 25 | −0.053 | −0.064 | 16 |
| T2 | −0.219 | −0.102 | −0.198 to +0.000 | 0 | −0.180 | −0.064 | 41 |
| T3 | −0.062 | −0.063 | −0.168 to +0.048 | 20 | +0.007 | +0.007 | 21 |

T1 and T2 are the same stall rule, so they share the 40 placebo grids and the same placebo figures: the real $100 and $50 levels are two of the grids that rule could be run on. A real grid beating 38 of 40 would mean the level itself matters; neither does.

## By side (net R a trade, n, t on months)

| Test | Side | OOS net | n | gross | t | IS net | n | gross | t |
|---|---|---|---|---|---|---|---|---|---|
| T1 | buy | −0.066 | 198 | −0.030 | -0.70 | −0.418 | 59 | −0.321 | -2.94 |
| T1 | sell | −0.123 | 146 | −0.084 | -1.16 | −0.308 | 64 | −0.201 | -2.21 |
| T2 | buy | −0.193 | 182 | −0.157 | -1.91 | −0.151 | 54 | −0.057 | -1.09 |
| T2 | sell | −0.247 | 166 | −0.205 | -2.58 | −0.305 | 58 | −0.205 | -2.23 |
| T3 | buy | −0.093 | 293 | −0.022 | -1.05 | +0.074 | 103 | +0.248 | 0.55 |
| T3 | sell | −0.034 | 322 | +0.033 | -0.33 | −0.116 | 118 | +0.062 | -0.79 |

## By year (net R a trade / total, n)

| Year | T1 | T2 | T3 |
|---|---|---|---|
| 2016 | −0.186 / −2.4 (n 13) | −0.384 / −13.4 (n 35) | −0.242 / −4.8 (n 20) |
| 2017 | +0.009 / +0.1 (n 15) | −0.284 / −4.8 (n 17) | +0.112 / +2.5 (n 22) |
| 2018 | −0.353 / −7.1 (n 20) | −0.691 / −10.4 (n 15) | −0.186 / −8.0 (n 43) |
| 2019 | −0.424 / −12.7 (n 30) | −0.195 / −1.2 (n 6) | +0.281 / +16.0 (n 57) |
| 2020 | −0.495 / −22.3 (n 45) | +0.101 / +3.9 (n 39) | −0.150 / −11.8 (n 79) |
| 2021 | −0.317 / −10.8 (n 34) | +0.054 / +1.4 (n 26) | +0.043 / +2.9 (n 67) |
| 2022 | −0.134 / −5.2 (n 39) | −0.551 / −17.6 (n 32) | −0.197 / −12.0 (n 61) |
| 2023 | −0.105 / −2.3 (n 22) | −0.529 / −14.8 (n 28) | −0.036 / −1.6 (n 45) |
| 2024 | −0.363 / −12.7 (n 35) | −0.259 / −12.7 (n 49) | −0.159 / −10.7 (n 67) |
| 2025 | +0.024 / +2.0 (n 83) | +0.139 / +11.2 (n 81) | +0.162 / +23.3 (n 144) |
| 2026 | −0.016 / −2.0 (n 131) | −0.330 / −43.6 (n 132) | −0.173 / −40.1 (n 231) |

## Exits and risk, OOS

- T1: stop 195, time 73, target 76; median cost 0.025 R a trade; median stop $16.95
- T2: time 89, target 53, stop 206; median cost 0.027 R a trade; median stop $14.71
- T3: target 135, time 84, stop 396; median cost 0.047 R a trade; median stop $11.81

## Data

xau: 776427 M5 candles, 2015-12-01 00:00 to 2026-11-13 21:55 UTC; 2813 trading days with an ATR.

To repeat: `node --use-env-proxy research/edge/gold-round-numbers/fetch.mjs <dir>` (candles outside git), then `node research/edge/gold-round-numbers/run.mjs full <dir>`. Tests: `tests/gold-round-numbers.test.mjs`.
