# Mosha sequence: the CF inside the VR, and the 50 % pullback before the CF

**Verdict: FAIL. after costs, confirmation: T1 case 2 minus case 1 −0.187R (n 871/627, t -1.51); T2 −0.196R (n 1287/211, t -1.16); clear-CF +0.013R a trade (n 627, month t 0.12; discovery −0.296R, t -3.54).**

**Before costs (the owner's request after the pre-registration; a second verdict on the same bar with the cost checks dropped, its own Holm): FAIL. T1 −0.191R (n 871 / 627, Welch t -1.54) FAIL; T2 −0.204R (n 1287 / 211, t -1.21) FAIL; T3 +0.114R a trade in confirmation (n 627, month t 1.05), −0.192R in discovery (n 857, month t -2.33) FAIL.**

## Every test before costs (R a trade as the code books it), with the after-cost figures beside it

| Test | Window | Side | n | R before costs | month-sum t | R after costs | month-sum t after |
|---|---|---|---|---|---|---|---|
| T1 | discovery | CF inside the VR | 1262 | −0.060 | -1.5 | −0.170 | -4.18 |
| T1 | discovery | CF clear of the VR | 857 | −0.192 | -2.33 | −0.296 | -3.54 |
| T1 | discovery | difference | | +0.132 (Welch t 1.48) | 1.75 (month-paired) | +0.127 (Welch t 1.42) | |
| T1 | confirmation | CF inside the VR | 871 | −0.077 | -1.25 | −0.174 | -2.83 |
| T1 | confirmation | CF clear of the VR | 627 | +0.114 | 1.05 | +0.013 | 0.12 |
| T1 | confirmation | difference | | −0.191 (Welch t -1.54) | -1.91 (month-paired) | −0.187 (Welch t -1.51) | |
| T2 | discovery | past 50 % before the CF | 1833 | −0.118 | -2.55 | −0.224 | -4.73 |
| T2 | discovery | not past 50 % | 286 | −0.081 | -0.72 | −0.200 | -1.78 |
| T2 | discovery | difference | | −0.037 (Welch t -0.31) | 0.72 (month-paired) | −0.024 (Welch t -0.2) | |
| T2 | confirmation | past 50 % before the CF | 1287 | −0.026 | -0.4 | −0.123 | -1.89 |
| T2 | confirmation | not past 50 % | 211 | +0.178 | 1.02 | +0.073 | 0.42 |
| T2 | confirmation | difference | | −0.204 (Welch t -1.21) | -0.84 (month-paired) | −0.196 (Welch t -1.16) | |
| T3 | discovery | clear-CF sequence | 857 | −0.192 | -2.33 | −0.296 | -3.54 |
| T3 | confirmation | clear-CF sequence | 627 | +0.114 | 1.05 | +0.013 | 0.12 |

Before-cost verdicts: T1 FAIL (Holm p 0.37176), T2 FAIL (Holm p 0.37176), T3 FAIL (Holm p 0.37176). T3 checks before costs: nDiscovery100 yes, discoveryMeanPositive no, discoveryTMonth2 no, nConfirmation50 yes, confirmationMeanPositive yes, confirmationTMonth2 no, holmBelow05 no.

## After costs (the pre-registered verdict)

Built 2026-11-23. Pre-registered (PREREGISTRATION.md, committed before any trade was computed). Paper research only; nothing live changed.
Gold, EUR/USD and GBP/USD (primary); discovery 2020-2023, confirmation 2024 to 2026-11-23; R a trade after the round-trip cost; 3617 closed sequence entries in the primary pool, 21941 on all 18 markets.
Cut test (gold, cut at 2020-06-01): passed (56 records filled by the cut, identical in both runs: true).

## T1 and T2: does one subset do better? (difference of mean net R a trade, Welch t)

| Test | Window | first n | first R | second n | second R | difference | Welch t | at 2x cost | Holm p | Verdict |
|---|---|---|---|---|---|---|---|---|---|---|
| T1 CF inside the VR (case 2) minus CF clear of it (case 1) | discovery | 1262 | −0.170 | 857 | −0.296 | +0.127 | 1.42 | +0.122 |  |  |
| T1  | confirmation | 871 | −0.174 | 627 | +0.013 | −0.187 | -1.51 | −0.183 | 0.3975 | FAIL |
| T2 pullback past 50 % before the CF minus not | discovery | 1833 | −0.224 | 286 | −0.200 | −0.024 | -0.2 | −0.012 |  |  |
| T2  | confirmation | 1287 | −0.123 | 211 | +0.073 | −0.196 | -1.16 | −0.188 | 0.49278 | FAIL |

Month-paired difference in confirmation: T1 −0.230 (35 months, t -1.9), T2 −0.201 (35 months, t -0.83).
T1 checks: nDiscovery100Each yes, discoveryAbsT2 no, nConfirmation50Each yes, confirmationSameSign no, holmBelow05 no, monthPairedSameSign no, sameSignAt2xCost no.
T2 checks: nDiscovery100Each yes, discoveryAbsT2 no, nConfirmation50Each yes, confirmationSameSign yes, holmBelow05 no, monthPairedSameSign yes, sameSignAt2xCost yes.

## T3: the clear-CF sequence alone, against the common bar

| Window | n | win % | net R a trade | month t | before costs | at 2x cost |
|---|---|---|---|---|---|---|
| discovery | 857 | 19.4 | −0.296 | -3.54 | −0.192 | −0.401 |
| confirmation | 627 | 20.4 | +0.013 | 0.12 | +0.114 | −0.088 |

Holm p 0.49278. Checks: nDiscovery100 yes, discoveryMeanPositive no, discoveryTMonth2 no, nConfirmation50 yes, confirmationMeanPositive yes, confirmationTMonth2 no, holmBelow05 no, positiveAt2xCost no. Verdict FAIL.

## Reported, not tested: each market (R a trade; confirmation unless said; after costs, then before costs)

| Market | kept | case 1 / case 2 | T1 diff (t) | T2 diff (t) | T3 discovery n, R, month t | T3 confirmation n, R, month t | before costs: T1 diff (t) | T2 diff (t) | T3 R (month t) discovery / confirmation |
|---|---|---|---|---|---|---|---|---|---|
| xau | 1144 | 456 / 688 | −0.272 (-1.14) | −0.186 (-0.61) | 271, −0.523, -4.21 | 185, +0.074, 0.26 | −0.278 (-1.17) | −0.176 (-0.58) | −0.390 (-3.23) / +0.158 (0.56) |
| eurusd | 1238 | 492 / 746 | −0.071 (-0.32) | +0.019 (0.08) | 293, −0.127, -0.69 | 199, −0.043, -0.23 | −0.070 (-0.31) | −0.000 (0) | −0.036 (-0.2) / +0.061 (0.33) |
| gbpusd | 1235 | 536 / 699 | −0.230 (-1.23) | −0.401 (-1.25) | 293, −0.257, -2.2 | 243, +0.013, 0.08 | −0.233 (-1.25) | −0.419 (-1.31) | −0.163 (-1.42) / +0.124 (0.75) |
| usdjpy | 1209 | 489 / 720 | −0.563 (-1.09) | +0.254 (0.81) | 277, −0.299, -2.14 | 212, +0.432, 0.9 | −0.556 (-1.07) | +0.251 (0.81) | −0.186 (-1.39) / +0.514 (1.07) |
| audusd | 1428 | 595 / 833 | −0.184 (-0.84) | −0.163 (-0.68) | 368, −0.207, -1.72 | 227, −0.105, -0.53 | −0.175 (-0.8) | −0.177 (-0.74) | −0.105 (-0.88) / +0.017 (0.09) |
| nzdusd | 1399 | 569 / 830 | −0.118 (-0.63) | +0.180 (0.94) | 341, −0.098, -0.77 | 228, −0.073, -0.54 | −0.104 (-0.56) | +0.180 (0.96) | +0.015 (0.12) / +0.082 (0.63) |
| usdcad | 1271 | 517 / 754 | +0.083 (0.39) | +0.332 (1.9) | 305, −0.129, -1.11 | 212, −0.113, -0.52 | +0.090 (0.42) | +0.327 (1.88) | −0.041 (-0.35) / −0.002 (-0.01) |
| usdchf | 1151 | 465 / 686 | +0.066 (0.31) | −0.086 (-0.36) | 259, −0.213, -1.34 | 206, −0.235, -1.37 | +0.077 (0.36) | −0.088 (-0.37) | −0.089 (-0.56) / −0.100 (-0.6) |
| eurjpy | 1218 | 490 / 728 | −0.068 (-0.34) | −0.071 (-0.28) | 289, −0.206, -1.48 | 201, −0.101, -0.59 | −0.054 (-0.27) | −0.085 (-0.34) | −0.096 (-0.69) / −0.012 (-0.07) |
| xag | 1161 | 493 / 668 | +0.043 (0.18) | −0.573 (-1.43) | 301, −0.761, -4.09 | 192, −0.571, -2.89 | +0.033 (0.14) | −0.592 (-1.48) | −0.074 (-0.45) / −0.157 (-0.9) |
| gbpjpy | 1197 | 481 / 716 | +0.172 (0.99) | −0.039 (-0.16) | 278, +0.256, 1.38 | 203, −0.202, -1.25 | +0.180 (1.04) | −0.046 (-0.18) | +0.370 (1.97) / −0.100 (-0.64) |
| eurgbp | 1171 | 468 / 703 | +0.207 (1.08) | +0.093 (0.5) | 270, −0.551, -5.18 | 198, −0.443, -2.24 | +0.209 (1.1) | +0.088 (0.47) | −0.375 (-3.59) / −0.187 (-0.97) |
| audjpy | 1296 | 522 / 774 | +0.176 (1.02) | +0.224 (1.2) | 306, −0.101, -0.78 | 216, −0.351, -2.79 | +0.195 (1.12) | +0.222 (1.2) | +0.032 (0.25) / −0.232 (-1.83) |
| cadjpy | 1147 | 416 / 731 | +0.287 (1.46) | −0.403 (-1.14) | 233, −0.271, -1.69 | 183, −0.349, -1.85 | +0.296 (1.51) | −0.404 (-1.14) | −0.129 (-0.79) / −0.215 (-1.18) |
| euraud | 1417 | 529 / 888 | −0.433 (-1.98) | +0.224 (1.09) | 301, −0.261, -2.38 | 228, +0.049, 0.26 | −0.421 (-1.92) | +0.213 (1.04) | −0.149 (-1.4) / +0.175 (0.92) |
| nas100 | 1071 | 442 / 629 | −0.021 (-0.08) | +0.051 (0.2) | 256, −0.100, -0.39 | 186, −0.121, -0.47 | −0.020 (-0.08) | +0.036 (0.14) | −0.042 (-0.16) / −0.084 (-0.33) |
| spx500 | 1085 | 453 / 632 | +0.242 (1.04) | −0.072 (-0.3) | 274, −0.191, -1.66 | 179, −0.280, -1.14 | +0.236 (1.02) | −0.086 (-0.36) | −0.103 (-0.89) / −0.200 (-0.82) |
| de40 | 1103 | 467 / 636 | +0.256 (1.16) | +0.137 (0.54) | 267, +0.078, 0.36 | 200, −0.189, -1.03 | +0.253 (1.15) | +0.132 (0.52) | +0.151 (0.69) / −0.119 (-0.66) |

18-market pool, descriptive: T1 confirmation −0.035 (n 5376 / 3698, t -0.63), T2 −0.024 (n 7824 / 1250, t -0.37), clear-CF sequence −0.138R (n 3698, month t -2.31) in confirmation and −0.220R (n 5182, month t -5.92) in discovery.

## Splits of the primary pool, descriptive (net R a trade, whole window)

| Split | case 1 n | case 1 R | case 2 n | case 2 R |
|---|---|---|---|---|
| 15m>5m>5m | 576 | −0.144 | 1086 | −0.131 |
| 1d>4h>1h | 115 | −0.345 | 44 | −0.239 |
| 1h>30m>15m | 122 | −0.193 | 196 | −0.091 |
| 30m>15m>5m | 412 | −0.098 | 625 | −0.184 |
| 4h>1h>15m | 259 | −0.228 | 182 | −0.441 |
| internal BO | 349 | −0.322 | 648 | −0.252 |
| major BO | 1135 | −0.118 | 1485 | −0.136 |
| eurusd | 492 | −0.093 | 746 | −0.075 |
| gbpusd | 536 | −0.135 | 699 | −0.205 |
| xau | 456 | −0.280 | 688 | −0.242 |

The record's own "reached 50 % by the entry" flag, confirmation: 1287 past vs 211 not, difference −0.196 (t -1.16). T2 within case 1 (confirmation): −0.227 (n 563 / 64, t -0.58); within case 2: −0.221 (n 724 / 147, t -1.31). Records with no 50 % line (left out of T2): 0.
Whole sequence (both cases), primary pool: discovery −0.221R (n 2119, month t -4.73), confirmation −0.096R (n 1498, month t -1.53).

## Reading

A difference between two subsets is not an edge; the whole-sequence and clear-CF figures above are what a trader of this reading would have had. No variant was run after the result.
