# The fade conditions stacked on the three Equinox fade rules, at measured hourly spreads (result)

**Verdict: FAIL. 0 of 9 stacked tests pass after the measured costs; best confirmation reading big S3 +0.002R a trade after costs (n 99, month t 0.01), discovery -0.146R.**

Run 24 Nov 2026 as pre-registered (`PREREGISTRATION.md`, committed and pushed alone first). Research only: nothing live
changed, nothing is proposed. One run, no variants. The conditions were chosen by earlier studies on these same years, so a
pass would only be a hypothesis for a forward paper record; never call any of this an edge. A before-cost tilt is not an edge.

## Gate and checks

- Break fade, xau, 2005-26: 35,213 trades after data-quality exclusions (fade-late-hourcost gate 35,212, within 5): passed.
- Break fade, usdjpy, 2005-26: 38,596 trades after data-quality exclusions (fade-late-hourcost gate 38,596, within 5): passed.
- Cut test xau: 2008-06-11 0 of 6,783 tags differ; 2013-03-13 0 of 22,538 tags differ; 2019-09-18 0 of 41,860 tags differ; 2024-05-08 0 of 56,904 tags differ.
- Cut test usdjpy: 2008-06-11 0 of 12,140 tags differ; 2013-03-13 0 of 28,871 tags differ; 2019-09-18 0 of 51,586 tags differ; 2024-05-08 0 of 67,594 tags differ.
- Cut test xag: 2008-06-11 0 of 3,024 tags differ; 2013-03-13 0 of 14,368 tags differ; 2019-09-18 0 of 22,303 tags differ; 2024-05-08 0 of 32,496 tags differ.
- Every trade has its stop on the losing side (the run throws otherwise).

## Primary tests (pooled xau, usdjpy, xag; AFTER measured costs)

Measured: xau and usdjpy spreads by UTC hour (the broker's quotes at this fade's fills and exits), xag the probe's hourProfile;
commission gold 0.000024, USD/JPY 0.000045, silver **ASSUMED** 0.000024. Month t = calendar-month sums, empty months 0.

| Rule | Stack | n 05-14 | R 05-14 | n 15-26 | R 15-26 (month t) | control 15-26 | Holm p | Pass |
|---|---|---:|---:|---:|---:|---:|---:|---|
| fade | S1 evening, no rollover | 3,476 | +0.015 | 3,984 | -0.097 (-4.09) | -0.121 | 1.000 | no |
| fade | S2 = S1 + low vol | 1,894 | -0.016 | 2,412 | -0.137 (-4.80) | -0.121 | 1.000 | no |
| fade | S3 = S2 + Monday | 695 | -0.022 | 819 | -0.125 (-2.32) | -0.121 | 1.000 | no |
| big | S1 evening, no rollover | 586 | +0.145 | 606 | -0.068 (-0.69) | -0.189 | 1.000 | no |
| big | S2 = S1 + low vol | 305 | -0.031 | 331 | -0.187 (-1.60) | -0.189 | 1.000 | no |
| big | S3 = S2 + Monday | 131 | -0.146 | 99 | +0.002 (0.01) | -0.189 | 1.000 | no |
| box | S1 evening, no rollover | 3,964 | -0.023 | 4,849 | -0.043 (-2.35) | -0.062 | 1.000 | no |
| box | S2 = S1 + low vol | 1,939 | -0.038 | 2,658 | -0.060 (-2.73) | -0.062 | 1.000 | no |
| box | S3 = S2 + Monday | 747 | -0.027 | 904 | -0.075 (-1.99) | -0.062 | 1.000 | no |

## Every cell, judged markets (before / after measured costs)

| Rule | Stack | n 05-14 | before | after (month t) | n 15-26 | before (month t) | after (month t) |
|---|---|---:|---:|---:|---:|---:|---:|
| fade | control (no stack) | 43,763 | +0.036 | -0.083 (-10.54) | 53,377 | +0.011 (1.69) | -0.121 (-17.05) |
| fade | S1 evening, no rollover | 3,476 | +0.165 | +0.015 (0.54) | 3,984 | +0.071 (2.96) | -0.097 (-4.09) |
| fade | S2 = S1 + low vol | 1,894 | +0.151 | -0.016 (-0.44) | 2,412 | +0.051 (1.77) | -0.137 (-4.80) |
| fade | S3 = S2 + Monday | 695 | +0.174 | -0.022 (-0.36) | 819 | +0.052 (0.98) | -0.125 (-2.32) |
| fade | placebo: 08-11, no rollover | 7,487 | -0.021 | -0.122 (-6.64) | 8,754 | +0.012 (0.73) | -0.096 (-5.90) |
| big | control (no stack) | 8,686 | +0.260 | +0.016 (0.68) | 11,634 | +0.105 (5.83) | -0.189 (-9.72) |
| big | S1 evening, no rollover | 586 | +0.414 | +0.145 (1.74) | 606 | +0.295 (3.02) | -0.068 (-0.69) |
| big | S2 = S1 + low vol | 305 | +0.263 | -0.031 (-0.31) | 331 | +0.233 (1.96) | -0.187 (-1.60) |
| big | S3 = S2 + Monday | 131 | +0.154 | -0.146 (-0.94) | 99 | +0.413 (1.75) | +0.002 (0.01) |
| big | placebo: 08-11, no rollover | 1,264 | +0.321 | +0.139 (2.52) | 1,253 | +0.154 (2.70) | -0.091 (-1.64) |
| box | control (no stack) | 28,375 | +0.022 | -0.050 (-5.20) | 36,153 | +0.022 (2.88) | -0.062 (-7.79) |
| box | S1 evening, no rollover | 3,964 | +0.056 | -0.023 (-1.30) | 4,849 | +0.055 (2.95) | -0.043 (-2.35) |
| box | S2 = S1 + low vol | 1,939 | +0.046 | -0.038 (-1.56) | 2,658 | +0.050 (2.27) | -0.060 (-2.73) |
| box | S3 = S2 + Monday | 747 | +0.052 | -0.027 (-0.73) | 904 | +0.023 (0.64) | -0.075 (-1.99) |
| box | placebo: 08-11, no rollover | 0 | - | - (0.00) | 0 | - (0.00) | - (0.00) |

## Reported only: the seven markets with no measured hourly spread (one flat round trip; ASSUMED for nzdusd, usdcad, usdchf, eurjpy)

| Rule | Stack | n 05-14 | before | after (month t) | n 15-26 | before (month t) | after (month t) |
|---|---|---:|---:|---:|---:|---:|---:|
| fade | control (no stack) | 127,752 | +0.060 | -0.036 (-5.95) | 148,395 | +0.053 (11.91) | -0.075 (-16.00) |
| fade | S1 evening, no rollover | 10,910 | +0.168 | +0.047 (2.75) | 11,357 | +0.137 (8.17) | -0.032 (-1.94) |
| fade | S2 = S1 + low vol | 6,462 | +0.141 | +0.000 (0.02) | 7,371 | +0.124 (5.64) | -0.071 (-3.22) |
| fade | S3 = S2 + Monday | 2,521 | +0.162 | +0.016 (0.47) | 2,416 | +0.062 (1.81) | -0.138 (-4.05) |
| fade | placebo: 08-11, no rollover | 20,106 | -0.012 | -0.087 (-7.18) | 23,889 | +0.018 (1.74) | -0.083 (-7.62) |
| big | control (no stack) | 38,668 | +0.318 | -0.028 (-1.71) | 42,809 | +0.217 (16.78) | -0.223 (-16.22) |
| big | S1 evening, no rollover | 2,633 | +0.564 | +0.160 (2.45) | 1,673 | +0.367 (4.91) | -0.127 (-1.72) |
| big | S2 = S1 + low vol | 1,531 | +0.496 | +0.058 (0.97) | 920 | +0.366 (5.40) | -0.189 (-2.86) |
| big | S3 = S2 + Monday | 790 | +0.407 | -0.035 (-0.47) | 318 | +0.354 (3.07) | -0.210 (-1.81) |
| big | placebo: 08-11, no rollover | 5,983 | +0.289 | -0.036 (-0.97) | 6,629 | +0.233 (7.53) | -0.190 (-5.92) |
| box | control (no stack) | 86,995 | +0.060 | -0.004 (-0.62) | 102,560 | +0.060 (13.21) | -0.029 (-6.03) |
| box | S1 evening, no rollover | 12,421 | +0.085 | +0.018 (1.59) | 13,511 | +0.094 (8.18) | -0.007 (-0.59) |
| box | S2 = S1 + low vol | 6,581 | +0.069 | -0.008 (-0.54) | 7,657 | +0.078 (5.40) | -0.039 (-2.68) |
| box | S3 = S2 + Monday | 2,648 | +0.039 | -0.038 (-1.77) | 2,500 | +0.063 (2.66) | -0.054 (-2.25) |
| box | placebo: 08-11, no rollover | 0 | - | - (0.00) | 0 | - (0.00) | - (0.00) |

## By market, after costs, confirmation 2015-26 (n, R a trade, month t)

| Rule | Stack | xau | usdjpy | xag | eurusd | gbpusd | audusd | nzdusd | usdcad | usdchf | eurjpy |
|---|---|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|
| fade | S0 | 19,890, -0.056 (-4.86) | 20,645, -0.139 (-14.22) | 12,842, -0.192 (-11.90) | 21,256, -0.063 (-6.39) | 20,962, -0.066 (-6.03) | 21,440, -0.074 (-7.19) | 21,442, -0.092 (-8.82) | 21,488, -0.050 (-5.11) | 20,999, -0.091 (-8.66) | 20,808, -0.091 (-9.25) |
| fade | S1 | 1,422, +0.000 (0.00) | 1,967, -0.133 (-4.34) | 595, -0.207 (-3.34) | 1,610, -0.045 (-1.05) | 1,463, +0.013 (0.31) | 1,886, -0.026 (-0.73) | 1,726, -0.073 (-1.97) | 1,574, -0.022 (-0.61) | 1,283, +0.001 (0.02) | 1,815, -0.057 (-1.51) |
| fade | S2 | 772, -0.028 (-0.54) | 1,356, -0.161 (-4.15) | 284, -0.317 (-3.10) | 1,145, -0.110 (-2.20) | 1,012, -0.012 (-0.23) | 1,429, -0.054 (-1.26) | 1,047, -0.145 (-2.81) | 761, -0.071 (-1.33) | 729, -0.033 (-0.57) | 1,248, -0.061 (-1.36) |
| fade | S3 | 270, -0.007 (-0.08) | 450, -0.164 (-2.43) | 99, -0.270 (-1.54) | 382, -0.211 (-2.65) | 336, -0.122 (-1.51) | 451, -0.077 (-1.03) | 330, -0.239 (-3.35) | 276, -0.148 (-1.61) | 255, -0.125 (-1.18) | 386, -0.066 (-0.78) |
| fade | P1 | 3,340, -0.031 (-1.33) | 3,137, -0.123 (-4.98) | 2,277, -0.154 (-4.79) | 3,385, -0.078 (-3.23) | 3,459, -0.061 (-2.39) | 3,395, -0.092 (-3.75) | 3,434, -0.087 (-3.60) | 3,582, -0.018 (-0.76) | 3,377, -0.141 (-5.11) | 3,257, -0.109 (-4.26) |
| big | S0 | 4,593, -0.068 (-2.03) | 5,784, -0.256 (-10.54) | 1,257, -0.322 (-4.80) | 6,232, -0.159 (-4.89) | 6,454, -0.163 (-5.60) | 6,054, -0.222 (-7.60) | 5,489, -0.247 (-8.36) | 6,630, -0.258 (-8.72) | 6,230, -0.239 (-7.85) | 5,720, -0.279 (-10.09) |
| big | S1 | 147, +0.021 (0.11) | 425, -0.062 (-0.53) | 34, -0.525 (-1.46) | 188, +0.046 (0.16) | 174, -0.121 (-0.70) | 366, -0.249 (-2.35) | 342, -0.055 (-0.47) | 177, -0.118 (-0.72) | 114, +0.169 (0.57) | 312, -0.284 (-2.30) |
| big | S2 | 47, -0.143 (-0.45) | 274, -0.184 (-1.50) | 10, -0.471 (-0.74) | 114, -0.269 (-1.76) | 99, -0.218 (-0.96) | 248, -0.369 (-3.59) | 158, -0.114 (-0.68) | 68, +0.093 (0.28) | 44, +0.315 (1.17) | 189, -0.172 (-1.03) |
| big | S3 | 14, -0.136 (-0.36) | 79, +0.037 (0.15) | 6, -0.137 (-0.14) | 44, -0.488 (-1.85) | 34, -0.506 (-1.84) | 76, -0.358 (-1.76) | 62, +0.032 (0.12) | 31, -0.294 (-0.80) | 17, +0.774 (1.53) | 54, -0.128 (-0.39) |
| big | P1 | 541, -0.006 (-0.06) | 592, -0.169 (-1.96) | 120, -0.094 (-0.49) | 989, -0.216 (-2.78) | 1,226, -0.104 (-1.52) | 631, -0.160 (-1.72) | 692, -0.234 (-2.77) | 1,068, -0.288 (-4.08) | 1,188, -0.090 (-1.26) | 835, -0.291 (-4.01) |
| box | S0 | 13,062, -0.011 (-0.90) | 14,876, -0.083 (-7.85) | 8,215, -0.107 (-7.50) | 14,089, -0.009 (-0.79) | 13,866, -0.020 (-1.74) | 15,489, -0.019 (-1.81) | 15,296, -0.035 (-3.40) | 14,950, -0.043 (-3.98) | 13,905, -0.032 (-2.67) | 14,965, -0.047 (-4.48) |
| box | S1 | 1,859, +0.053 (1.93) | 2,100, -0.115 (-4.96) | 890, -0.076 (-2.18) | 1,785, +0.003 (0.12) | 1,703, +0.005 (0.18) | 2,128, +0.005 (0.21) | 2,075, -0.034 (-1.44) | 2,032, -0.026 (-1.06) | 1,650, +0.003 (0.10) | 2,138, -0.000 (-0.01) |
| box | S2 | 903, +0.041 (1.04) | 1,339, -0.133 (-4.54) | 416, -0.042 (-0.83) | 1,058, -0.034 (-1.04) | 962, -0.044 (-1.23) | 1,459, -0.009 (-0.30) | 1,223, -0.047 (-1.49) | 772, -0.070 (-1.82) | 777, -0.072 (-1.60) | 1,406, -0.030 (-0.97) |
| box | S3 | 345, +0.018 (0.29) | 412, -0.119 (-2.37) | 147, -0.170 (-1.68) | 383, -0.025 (-0.47) | 295, -0.053 (-0.87) | 464, -0.088 (-1.87) | 359, -0.029 (-0.52) | 278, -0.123 (-2.44) | 271, -0.095 (-1.31) | 450, +0.001 (0.02) |
| box | P1 | 0, - (0.00) | 0, - (0.00) | 0, - (0.00) | 0, - (0.00) | 0, - (0.00) | 0, - (0.00) | 0, - (0.00) | 0, - (0.00) | 0, - (0.00) | 0, - (0.00) |

## What it says

- Before costs the evening cut (S1) still lifts every rule in 2015-26 (fade +0.011 -> +0.071R, big +0.105 -> +0.295R, box +0.022 -> +0.055R on the judged markets), but after the
  broker's measured evening spreads every S1 cell loses in confirmation. A before-cost tilt is not an edge.
- Stacking makes it worse, not better: low volatility (S2) lowers the before-cost mean in the evening (fade +0.071 -> +0.051R) and, with a
  smaller ATR stop, raises the cost in R; Monday (S3) leaves too few trades (big S3: 99 in confirmation, under the 200 bar).
- The placebo (S1's shape at 08-11) is flat to negative before costs on the fade, as `fade-conditions` found; the box fade
  (F1) trades only outside 07-17 UTC, so its placebo is empty by construction.
- Single-market cells above zero (gold box S1, by-market table) are slices picked after looking: not tested, not evidence.
- Caveats: today's measured spreads are charged on every year; silver's commission is ASSUMED; the seven unmeasured markets
  carry one flat round trip (ASSUMED for four) and are reported, not judged; the conditions were chosen on these same years.
