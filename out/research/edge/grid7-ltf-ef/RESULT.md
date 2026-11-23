# The failed engulf (EF) on the lower timeframes, ten markets (result)

**Verdict: FAIL. 0 of 54 failed-engulf cells pass; the best confirmation cell, m15 K12 none proj, made +0.351R a trade before costs in 2015-26 (n 661, month t 4.79; discovery +0.432R, t 1.62; against the plain fade Welch t 1.08 / 2.75).**

Run 23 Nov 2026 as pre-registered (`PREREGISTRATION.md`, committed and pushed alone first). Research only: nothing live
changed, nothing is proposed. One run, no variants.

## What was run

An engulf zone on M5, M15 or H1 (`council/eg-methods.mjs` `zones`, 3-candle span, the base candle wick to wick) that a
later candle of the same timeframe closes through on its far side within K = 3, 6 or 12 candles of the engulf completing
(it FAILED), traded the other way at market at the next 5-minute open. Context "none" (every zone) or "brk" (the last
structure break known when the engulf completed was of its own side, at most 24 candles earlier). Stop past the extreme
between the base and the failing candle + 0.1 ATR(14); exit 1R, 2R or "proj" (the base range projected 1:1 from the side
closed through, only when 1R or more away); time limit 8 h / 1 day / 2 days. 54 cells. Control per cell: the plain
`grid7-wide-fade` rule (context none, stop past the break candle) on the same timeframe and exit (proj against its swing
exit), run here on the same candles. Ten markets pooled, OANDA mid 5-minute candles; discovery = fills 2005-2014,
confirmation = 2015 to October 2026. Judged before costs on month sums, Holm over the 54 confirmation tests, and a per-trade
Welch t >= 2 against the control in both windows. Costs beside: **ASSUMED, not measured** for xag, nzdusd, usdcad, usdchf, eurjpy.

## The bar, cell by cell

- n >= 300 in both windows: 42 of 54.
- Mean R > 0 and month t >= 2 in discovery: 7; in confirmation: 12; both: 5.
- Holm-adjusted p < 0.05: 11.
- Welch t >= 2 against the plain fade in both windows: 12.
- **All five: 0.**
- Of those, positive after costs in both windows: 0.
- Side-flipped (traded WITH the failed zone) clearing bars 1-3: 14 (m5 K3 none 1R; m5 K3 none 2R; m5 K6 none 1R; m5 K6 none 2R; m5 K12 none 1R; m5 K12 none 2R; m15 K3 none 1R; m15 K3 none 2R; m15 K6 none 1R; m15 K6 none 2R; m15 K12 none 1R; m15 K12 none 2R; m15 K12 brk 2R; h1 K12 none 2R).

## Every judged cell

R a trade before costs (month-sum t), after costs beside; "cost R" = mean round-trip cost / risk in 2015-26; "vs fade" = per-trade
Welch t of the cell against its control (discovery / confirmation); mirror = the cell traded the other way.

| Cell | n 05-14 | R 05-14 (t) | net 05-14 | n 15-26 | R 15-26 (t) | net 15-26 | cost R | Holm | Control R 05-14 / 15-26 | vs fade | Mirror R 15-26 (t) | Pass |
|---|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|---|
| m5 K3 none 1R | 294,971 | -0.019 (-6.72) | -0.156 | 393,327 | -0.030 (-15.14) | -0.193 | 0.162 | 1.000 | -0.122 / -0.139 | 40.96 / 46.04 | +0.023 (11.81) | no |
| m5 K3 none 2R | 294,971 | -0.023 (-6.03) | -0.161 | 393,327 | -0.037 (-12.26) | -0.200 | 0.162 | 1.000 | +0.050 / +0.018 | -20.52 / -16.78 | +0.027 (11.65) | no |
| m5 K3 none proj | 543 | +0.231 (3.45) | -0.135 | 1,005 | +0.159 (3.13) | -0.325 | 0.484 | 0.047 | +0.274 / +0.202 | -0.69 / -0.98 | -0.274 (-6.13) | no |
| m5 K3 brk 1R | 150,743 | +0.002 (0.51) | -0.135 | 198,703 | -0.015 (-5.66) | -0.176 | 0.161 | 1.000 | -0.122 / -0.139 | 39.90 / 43.44 | +0.008 (2.95) | no |
| m5 K3 brk 2R | 150,743 | +0.004 (0.89) | -0.133 | 198,703 | -0.017 (-4.38) | -0.178 | 0.161 | 1.000 | +0.050 / +0.018 | -10.62 / -8.75 | +0.009 (2.60) | no |
| m5 K3 brk proj | 255 | +0.190 (1.82) | -0.168 | 481 | +0.271 (3.62) | -0.208 | 0.479 | 0.010 | +0.274 / +0.202 | -0.88 / 1.02 | -0.372 (-6.24) | no |
| m5 K6 none 1R | 525,382 | -0.016 (-6.93) | -0.143 | 692,007 | -0.031 (-17.82) | -0.180 | 0.150 | 1.000 | -0.122 / -0.139 | 47.79 / 51.59 | +0.024 (14.43) | no |
| m5 K6 none 2R | 525,382 | -0.019 (-5.64) | -0.145 | 692,007 | -0.038 (-14.59) | -0.188 | 0.150 | 1.000 | +0.050 / +0.018 | -21.99 / -19.01 | +0.025 (13.04) | no |
| m5 K6 none proj | 801 | +0.314 (4.97) | -0.046 | 1,391 | +0.196 (4.33) | -0.261 | 0.457 | 0.001 | +0.274 / +0.202 | 0.75 / -0.17 | -0.292 (-6.92) | no |
| m5 K6 brk 1R | 270,496 | +0.005 (1.62) | -0.120 | 351,621 | -0.017 (-7.33) | -0.166 | 0.149 | 1.000 | -0.122 / -0.139 | 49.10 / 50.45 | +0.011 (4.59) | no |
| m5 K6 brk 2R | 270,496 | +0.007 (1.86) | -0.118 | 351,621 | -0.021 (-6.52) | -0.169 | 0.149 | 1.000 | +0.050 / +0.018 | -11.95 / -11.49 | +0.008 (2.70) | no |
| m5 K6 brk proj | 381 | +0.356 (3.97) | +0.003 | 664 | +0.289 (4.52) | -0.163 | 0.452 | 0.000 | +0.274 / +0.202 | 1.00 / 1.50 | -0.383 (-6.97) | no |
| m5 K12 none 1R | 781,778 | -0.015 (-7.06) | -0.132 | 1,018,307 | -0.029 (-18.39) | -0.167 | 0.138 | 1.000 | -0.122 / -0.139 | 51.68 / 55.78 | +0.023 (14.85) | no |
| m5 K12 none 2R | 781,778 | -0.018 (-5.57) | -0.134 | 1,018,307 | -0.037 (-15.28) | -0.175 | 0.138 | 1.000 | +0.050 / +0.018 | -23.34 / -19.64 | +0.025 (15.88) | no |
| m5 K12 none proj | 1,012 | +0.331 (5.15) | -0.022 | 1,772 | +0.214 (4.78) | -0.220 | 0.434 | 0.000 | +0.274 / +0.202 | 1.18 / 0.32 | -0.333 (-8.29) | no |
| m5 K12 brk 1R | 403,898 | +0.002 (0.84) | -0.113 | 519,023 | -0.016 (-7.65) | -0.153 | 0.137 | 1.000 | -0.122 / -0.139 | 53.31 / 55.55 | +0.010 (4.93) | no |
| m5 K12 brk 2R | 403,898 | +0.003 (0.83) | -0.112 | 519,023 | -0.021 (-7.10) | -0.158 | 0.137 | 1.000 | +0.050 / +0.018 | -14.45 / -12.61 | +0.010 (3.76) | no |
| m5 K12 brk proj | 490 | +0.381 (4.30) | +0.041 | 860 | +0.297 (4.55) | -0.130 | 0.427 | 0.000 | +0.274 / +0.202 | 1.48 / 1.74 | -0.402 (-7.31) | no |
| m15 K3 none 1R | 102,594 | -0.014 (-3.95) | -0.101 | 130,253 | -0.023 (-7.13) | -0.128 | 0.105 | 1.000 | -0.030 / -0.053 | 3.83 / 7.91 | +0.018 (5.47) | no |
| m15 K3 none 2R | 102,594 | -0.014 (-2.43) | -0.101 | 130,253 | -0.031 (-7.13) | -0.136 | 0.105 | 1.000 | +0.094 / +0.054 | -18.67 / -16.28 | +0.016 (3.96) | no |
| m15 K3 none proj | 161 | +0.119 (0.82) | -0.197 | 292 | +0.364 (3.03) | +0.064 | 0.300 | 0.063 | +0.241 / +0.158 | -0.94 / 1.94 | -0.456 (-5.28) | no |
| m15 K3 brk 1R | 52,115 | -0.003 (-0.60) | -0.089 | 65,516 | -0.010 (-2.31) | -0.113 | 0.103 | 1.000 | -0.030 / -0.053 | 5.19 / 9.17 | +0.005 (1.10) | no |
| m15 K3 brk 2R | 52,115 | -0.009 (-1.25) | -0.095 | 65,516 | -0.016 (-2.52) | -0.118 | 0.103 | 1.000 | +0.094 / +0.054 | -14.44 / -10.75 | +0.004 (0.57) | no |
| m15 K3 brk proj | 75 | +0.069 (0.33) | -0.238 | 137 | +0.615 (3.22) | +0.319 | 0.296 | 0.036 | +0.241 / +0.158 | -0.87 / 2.62 | -0.572 (-4.48) | no |
| m15 K6 none 1R | 184,352 | -0.013 (-4.33) | -0.093 | 231,338 | -0.021 (-7.98) | -0.118 | 0.097 | 1.000 | -0.030 / -0.053 | 4.71 / 9.70 | +0.016 (6.12) | no |
| m15 K6 none 2R | 184,352 | -0.013 (-2.73) | -0.093 | 231,338 | -0.025 (-6.83) | -0.122 | 0.097 | 1.000 | +0.094 / +0.054 | -21.56 / -17.34 | +0.017 (5.68) | no |
| m15 K6 none proj | 257 | +0.358 (1.67) | +0.056 | 486 | +0.364 (4.01) | +0.078 | 0.287 | 0.002 | +0.241 / +0.158 | 0.66 / 2.45 | -0.474 (-7.34) | no |
| m15 K6 brk 1R | 94,351 | -0.001 (-0.31) | -0.080 | 117,213 | -0.010 (-2.73) | -0.105 | 0.095 | 1.000 | -0.030 / -0.053 | 6.78 / 11.12 | +0.005 (1.37) | no |
| m15 K6 brk 2R | 94,351 | -0.007 (-1.18) | -0.086 | 117,213 | -0.012 (-2.30) | -0.106 | 0.095 | 1.000 | +0.094 / +0.054 | -17.22 / -12.22 | +0.007 (1.41) | no |
| m15 K6 brk proj | 128 | +0.566 (1.47) | +0.279 | 228 | +0.484 (3.22) | +0.205 | 0.279 | 0.036 | +0.241 / +0.158 | 1.01 / 2.50 | -0.542 (-5.81) | no |
| m15 K12 none 1R | 275,320 | -0.016 (-5.35) | -0.089 | 341,427 | -0.019 (-8.03) | -0.108 | 0.089 | 1.000 | -0.030 / -0.053 | 4.16 / 11.09 | +0.015 (6.14) | no |
| m15 K12 none 2R | 275,320 | -0.015 (-3.27) | -0.088 | 341,427 | -0.022 (-6.50) | -0.111 | 0.089 | 1.000 | +0.094 / +0.054 | -23.68 / -17.78 | +0.018 (6.68) | no |
| m15 K12 none proj | 334 | +0.432 (1.62) | +0.148 | 661 | +0.351 (4.79) | +0.079 | 0.272 | 0.000 | +0.241 / +0.158 | 1.08 / 2.75 | -0.466 (-8.39) | no |
| m15 K12 brk 1R | 140,936 | -0.009 (-2.51) | -0.081 | 173,551 | -0.009 (-2.81) | -0.096 | 0.087 | 1.000 | -0.030 / -0.053 | 5.38 / 12.61 | +0.005 (1.40) | no |
| m15 K12 brk 2R | 140,936 | -0.011 (-2.05) | -0.083 | 173,551 | -0.011 (-2.52) | -0.098 | 0.087 | 1.000 | +0.094 / +0.054 | -20.02 / -13.41 | +0.010 (2.18) | no |
| m15 K12 brk proj | 170 | +0.779 (1.57) | +0.508 | 304 | +0.461 (3.83) | +0.194 | 0.267 | 0.005 | +0.241 / +0.158 | 1.66 / 2.77 | -0.473 (-6.25) | no |
| h1 K3 none 1R | 28,225 | +0.001 (0.18) | -0.045 | 34,565 | -0.007 (-1.32) | -0.062 | 0.055 | 1.000 | +0.035 / -0.009 | -4.46 / 0.27 | +0.005 (0.90) | no |
| h1 K3 none 2R | 28,225 | +0.012 (1.43) | -0.034 | 34,565 | -0.014 (-1.67) | -0.069 | 0.055 | 1.000 | +0.105 / +0.040 | -8.88 / -5.74 | +0.017 (2.55) | no |
| h1 K3 none proj | 21 | +0.429 (1.08) | +0.188 | 60 | +0.171 (0.80) | +0.037 | 0.134 | 1.000 | +0.157 / +0.073 | 0.72 / 0.46 | -0.467 (-3.20) | no |
| h1 K3 brk 1R | 14,553 | +0.012 (1.35) | -0.034 | 17,844 | -0.017 (-2.12) | -0.071 | 0.054 | 1.000 | +0.035 / -0.009 | -2.47 / -0.95 | +0.015 (1.88) | no |
| h1 K3 brk 2R | 14,553 | +0.029 (2.44) | -0.016 | 17,844 | -0.028 (-2.49) | -0.081 | 0.054 | 1.000 | +0.105 / +0.040 | -5.91 / -5.84 | +0.030 (2.91) | no |
| h1 K3 brk proj | 16 | +0.579 (1.17) | +0.337 | 29 | +0.258 (0.81) | +0.101 | 0.156 | 1.000 | +0.157 / +0.073 | 0.92 / 0.58 | -0.706 (-3.44) | no |
| h1 K6 none 1R | 48,379 | -0.005 (-0.99) | -0.046 | 58,844 | -0.002 (-0.47) | -0.052 | 0.050 | 1.000 | +0.035 / -0.009 | -6.03 / 1.18 | -0.000 (-0.04) | no |
| h1 K6 none 2R | 48,379 | +0.004 (0.58) | -0.038 | 58,844 | -0.005 (-0.64) | -0.054 | 0.050 | 1.000 | +0.105 / +0.040 | -11.12 / -5.41 | +0.009 (1.74) | no |
| h1 K6 none proj | 28 | +0.274 (0.82) | +0.056 | 80 | +0.150 (0.79) | +0.030 | 0.120 | 1.000 | +0.157 / +0.073 | 0.38 / 0.40 | -0.328 (-2.57) | no |
| h1 K6 brk 1R | 25,126 | +0.005 (0.71) | -0.036 | 30,325 | -0.010 (-1.53) | -0.058 | 0.048 | 1.000 | +0.035 / -0.009 | -3.89 / -0.08 | +0.008 (1.19) | no |
| h1 K6 brk 2R | 25,126 | +0.017 (1.99) | -0.024 | 30,325 | -0.013 (-1.49) | -0.061 | 0.048 | 1.000 | +0.105 / +0.040 | -8.26 / -5.44 | +0.019 (2.16) | no |
| h1 K6 brk proj | 18 | +0.524 (1.14) | +0.296 | 36 | +0.068 (0.25) | -0.074 | 0.142 | 1.000 | +0.157 / +0.073 | 0.88 / -0.02 | -0.488 (-2.68) | no |
| h1 K12 none 1R | 70,871 | -0.002 (-0.46) | -0.039 | 84,778 | -0.005 (-1.07) | -0.049 | 0.045 | 1.000 | +0.035 / -0.009 | -6.08 / 0.80 | +0.003 (0.60) | no |
| h1 K12 none 2R | 70,871 | +0.008 (1.23) | -0.029 | 84,778 | -0.005 (-0.78) | -0.050 | 0.045 | 1.000 | +0.105 / +0.040 | -11.51 / -5.90 | +0.011 (2.31) | no |
| h1 K12 none proj | 36 | +0.348 (1.23) | +0.145 | 95 | +0.149 (0.85) | +0.041 | 0.108 | 1.000 | +0.157 / +0.073 | 0.68 / 0.43 | -0.249 (-2.08) | no |
| h1 K12 brk 1R | 36,781 | +0.009 (1.40) | -0.028 | 43,594 | -0.011 (-1.79) | -0.054 | 0.044 | 1.000 | +0.035 / -0.009 | -3.78 / -0.21 | +0.008 (1.43) | no |
| h1 K12 brk 2R | 36,781 | +0.023 (2.93) | -0.013 | 43,594 | -0.009 (-1.25) | -0.053 | 0.044 | 1.000 | +0.105 / +0.040 | -8.56 / -5.68 | +0.021 (2.52) | no |
| h1 K12 brk proj | 22 | +0.735 (1.70) | +0.522 | 48 | +0.071 (0.28) | -0.047 | 0.118 | 1.000 | +0.157 / +0.073 | 1.48 / -0.01 | -0.251 (-1.46) | no |

## (b) The engulf traded WITH it at completion (reported, not judged)

Same zones, entered with the engulf at the next 5-minute open after it completes; stop past the base-to-completion extreme
+ 0.1 ATR. Not in the Holm family; "bars 1-3" = n, discovery and confirmation as for the judged cells.

| Row | n 05-14 | R 05-14 (t) | net 05-14 | n 15-26 | R 15-26 (t) | net 15-26 | cost R | Mirror R 05-14 (t) | Mirror R 15-26 (t) | bars 1-3 |
|---|---:|---:|---:|---:|---:|---:|---:|---:|---:|---|
| m5 with-EG none 1R | 1,676,291 | -0.015 (-8.85) | -0.184 | 2,112,010 | -0.028 (-23.53) | -0.227 | 0.199 | +0.007 (4.39) | +0.018 (15.87) | mirror |
| m5 with-EG none 2R | 1,676,291 | -0.008 (-3.09) | -0.177 | 2,112,010 | -0.028 (-15.27) | -0.227 | 0.199 | +0.028 (16.66) | +0.027 (21.06) | mirror |
| m5 with-EG none proj | 17,955 | +0.106 (6.61) | -0.223 | 29,401 | +0.005 (0.76) | -0.420 | 0.425 | -0.100 (-7.18) | -0.039 (-5.05) | no |
| m5 with-EG brk 1R | 850,911 | -0.040 (-16.50) | -0.205 | 1,071,869 | -0.043 (-23.83) | -0.238 | 0.195 | +0.032 (13.67) | +0.033 (18.75) | mirror |
| m5 with-EG brk 2R | 850,911 | -0.044 (-12.03) | -0.209 | 1,071,869 | -0.051 (-18.82) | -0.246 | 0.195 | +0.063 (21.68) | +0.047 (19.76) | mirror |
| m5 with-EG brk proj | 8,157 | +0.069 (3.79) | -0.265 | 13,316 | -0.026 (-2.27) | -0.456 | 0.430 | -0.068 (-4.14) | -0.009 (-0.77) | no |
| m15 with-EG none 1R | 597,077 | -0.024 (-12.49) | -0.134 | 723,485 | -0.025 (-16.09) | -0.152 | 0.127 | +0.021 (10.96) | +0.019 (12.65) | mirror |
| m15 with-EG none 2R | 597,077 | -0.029 (-9.80) | -0.139 | 723,485 | -0.032 (-13.10) | -0.160 | 0.127 | +0.028 (13.63) | +0.022 (13.03) | mirror |
| m15 with-EG none proj | 3,522 | +0.119 (4.72) | -0.136 | 5,380 | +0.094 (5.13) | -0.235 | 0.329 | -0.079 (-3.77) | -0.131 (-7.36) | yes |
| m15 with-EG brk 1R | 304,241 | -0.044 (-13.83) | -0.150 | 370,092 | -0.036 (-14.92) | -0.159 | 0.123 | +0.041 (12.94) | +0.031 (12.75) | mirror |
| m15 with-EG brk 2R | 304,241 | -0.047 (-9.85) | -0.154 | 370,092 | -0.045 (-11.47) | -0.168 | 0.123 | +0.048 (10.99) | +0.035 (9.50) | mirror |
| m15 with-EG brk proj | 1,598 | +0.039 (1.12) | -0.220 | 2,321 | +0.041 (1.59) | -0.286 | 0.327 | +0.013 (0.34) | -0.108 (-4.21) | no |
| h1 with-EG none 1R | 152,708 | -0.022 (-6.94) | -0.083 | 179,577 | -0.017 (-6.83) | -0.089 | 0.071 | +0.021 (6.41) | +0.014 (5.38) | mirror |
| h1 with-EG none 2R | 152,708 | -0.021 (-3.97) | -0.081 | 179,577 | -0.017 (-4.48) | -0.089 | 0.071 | +0.028 (8.25) | +0.018 (5.93) | mirror |
| h1 with-EG none proj | 567 | +0.157 (2.46) | -0.050 | 1,241 | +0.233 (4.66) | +0.036 | 0.197 | -0.144 (-2.74) | -0.335 (-8.53) | yes |
| h1 with-EG brk 1R | 80,827 | -0.022 (-4.31) | -0.081 | 93,781 | -0.024 (-5.03) | -0.092 | 0.069 | +0.021 (4.06) | +0.021 (4.37) | mirror |
| h1 with-EG brk 2R | 80,827 | -0.022 (-2.41) | -0.080 | 93,781 | -0.021 (-2.89) | -0.089 | 0.069 | +0.029 (3.98) | +0.020 (2.88) | mirror |
| h1 with-EG brk proj | 267 | +0.182 (2.02) | -0.034 | 615 | +0.216 (3.11) | +0.023 | 0.192 | -0.233 (-3.27) | -0.336 (-7.10) | no |

## Checks

- Cut test: 10 cuts on xau, eurusd: 4,199,000 signals known by the cut dates, 0 missing or extra when the candles are cut there.
- Every trade has its stop on the losing side of the fill (the run throws otherwise); a fill at or past the stop and a risk under the round-trip cost are no trades (same for the control).
- Exclusions: the data-quality audit's bad intervals (`combo-grid-2` `exclusions`).

| Market | candles from | zone signals | EF | with-EG | control trades | dropped (bad data) | past the stop | risk under cost | unresolved |
|---|---|---:|---:|---:|---:|---:|---:|---:|---:|
| xau | 2006-03-19 | 765,326 | 240,646 | 524,680 | 83,269 | 24 | 466 | 10,331 | 20 |
| xag | 2006-03-19 | 745,447 | 239,931 | 505,516 | 23,051 | 1572 | 640 | 219,114 | 22 |
| eurusd | 2004-01-01 | 851,961 | 269,197 | 582,764 | 132,962 | 439 | 367 | 862 | 27 |
| gbpusd | 2004-01-01 | 859,032 | 274,249 | 584,783 | 128,652 | 768 | 458 | 1,073 | 39 |
| usdjpy | 2004-01-01 | 834,158 | 258,242 | 575,916 | 120,007 | 669 | 372 | 1,524 | 50 |
| audusd | 2004-01-01 | 845,517 | 269,086 | 576,431 | 127,790 | 469 | 412 | 847 | 47 |
| nzdusd | 2004-01-01 | 838,677 | 266,732 | 571,945 | 114,215 | 10 | 650 | 1,161 | 47 |
| usdcad | 2004-01-01 | 836,171 | 267,187 | 568,984 | 118,269 | 711 | 363 | 1,458 | 32 |
| usdchf | 2004-01-01 | 836,745 | 267,647 | 569,098 | 113,370 | 697 | 656 | 2,903 | 25 |
| eurjpy | 2004-01-01 | 851,054 | 266,519 | 584,535 | 125,946 | 19 | 406 | 666 | 30 |

## What it means

No failed-engulf cell clears the bar. What the cells show:

- **The EF side itself loses before costs at 1R and 2R.** Traded the other way after an engulf fails, the 1R / 2R cells are
  negative in confirmation on every timeframe and K (for example m15 K12 none: 1R -0.019R, t -8.03; 2R -0.022R,
  t -6.50). Their M5 / M15 1R cells "beat" the plain fade by a large Welch t only because the fade's own 1R cells are negative
  (the stop-first booking of a 5-minute candle that holds both, with stops of a few pips); at 2R the fade is better.
- **The side-flipped check is the small tilt.** Traded WITH the failed zone (fading the failure, which is itself a break),
  14 cells clear bars 1-3, at about +0.01 to +0.03R a trade against a round trip of 0.09-0.16R on M5 / M15: the
  same fraction-of-a-spread reversal of the mid quote `grid7-wide-fade` found, not a move a taker can capture.
- **The projection cells are a small, selected sample.** The 1:1 projection is 1R or more away on few failures (1,005, 1,391, 664, 1,772, 860, 661 trades
  in 2015-26 across the M5 / M15 proj cells with n >= 300); several are positive before costs with month t over 3 in
  confirmation, but none has discovery t >= 2 together with a Welch t >= 2 against the fade's swing exit in both windows,
  and after costs they are mostly negative on M5. Picking them now would be choosing after the result.
- **(b), reported only:** the engulf traded WITH it at completion loses at 1R / 2R everywhere; its mirror is the same small
  tilt. Rows clearing bars 1-3 (not judged, not in Holm): m15 with-EG none proj; h1 with-EG none proj. These are not tested here and are not
  evidence: they would need their own pre-registration on other data.

Do not re-test variants of these 54 cells on these years. Nothing live changed; no rule is proposed.

Correction to the pre-registration's "Why": the plain fade's M15 break-candle stop, 2R cell had discovery month t 19.57
(+0.094R), not 11.4 as quoted there; the confirmation figure (+0.054R, t 12.2) was right. Nothing in the design depended on it.
