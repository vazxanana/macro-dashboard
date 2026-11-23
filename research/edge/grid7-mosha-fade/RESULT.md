# Wide Mosha grid: the storyline's CF traded with it and faded (result)

**Verdict: FAIL. 0 of 54 cells pass; 4 clear the before-cost bar but none beats its control in both windows; best confirmation cell fade M30>M5 any struct, +0.154R a trade before costs in 2015-26 (n 19,376, month t 5.15), -0.383R after costs.**

Run 23 Nov 2026 as pre-registered (`PREREGISTRATION.md`, committed and pushed alone first). Research only: nothing live
changed, nothing is proposed. One run, no variants.

## What was run

The storyline of `grid6-mosha-market` (imported): a BO = a structure break on the upper timeframe; the VR = the first
lower-timeframe break against it; the CF = the next lower-timeframe break back with it (3 candles a side, closed candles
only). Ladders H4>H1, H1>M15, M30>M5. At the next 5-minute open after the CF candle's close: (a) WITH the CF, stop past the VR
leg's extreme + 0.1 ATR, exits 1R / 2R / the move's extreme; (b) the FADE, stop past the CF candle's extreme + 0.1 ATR, exits
1R / 2R / the BO level (a structural target only when 1R or more away). CF place: any, clear of the VR box, inside it. 54 cells.
Controls on the same lower timeframe: (b) every structure break faded (`grid7-wide-fade`'s rule, "ext" stop; struct against its
swing exit); (a) every structure break traded with it, stop past the break leg's origin (struct against its 2R). Ten markets
pooled, OANDA mid 5-minute candles; discovery = fills 2005-2014, confirmation = 2015 to October 2026; before costs on month
sums, Holm over 54. Costs beside: demo figures for gold and the four majors; **ASSUMED, not measured** for xag, nzdusd, usdcad, usdchf, eurjpy.

## The bar, cell by cell

- n >= 300 in both windows: 51 of 54.
- Mean R > 0 and month t >= 2 in discovery: 12; in confirmation: 5; both: 4.
- Holm-adjusted p < 0.05: 4.
- Bars 1-3 (the before-cost bar): 4 (fade H1>M15 any 2R; fade H1>M15 inside 2R; fade M30>M5 any struct; fade M30>M5 inside struct).
- Beat the control (Welch t >= 2 in both windows): 0.
- **All five: 0.**
- Side-flipped cells clearing bars 1-3 with Holm: 5 (with M30>M5 any 1R; with M30>M5 any 2R; with M30>M5 any struct; with M30>M5 clear 2R; with M30>M5 inside 1R).

## Every cell

R a trade before costs (month-sum t), after costs beside; Welch = the cell against its control, per trade, before costs.

| Cell | n 05-14 | R 05-14 (t) | net 05-14 | n 15-26 | R 15-26 (t) | net 15-26 | Holm | Control R 05-14 / 15-26 | Welch 05-14 / 15-26 | Flipped R 15-26 (t) | Pass |
|---|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|---|
| with H4>H1 any 1R | 3,834 | +0.007 (0.40) | -0.045 | 4,441 | +0.025 (1.71) | -0.035 | 1.000 | -0.008 / -0.009 | 0.90 / 2.29 | -0.035 (-2.36) | no |
| with H4>H1 any 2R | 3,834 | +0.002 (0.08) | -0.050 | 4,441 | +0.011 (0.51) | -0.050 | 1.000 | +0.006 / -0.007 | -0.22 / 0.90 | -0.017 (-0.76) | no |
| with H4>H1 any struct | 1,803 | -0.096 (-1.94) | -0.173 | 2,079 | -0.023 (-0.59) | -0.115 | 1.000 | +0.006 / -0.007 | -2.56 / -0.42 | -0.005 (-0.12) | no |
| with H4>H1 clear 1R | 243 | +0.046 (0.69) | -0.125 | 292 | -0.003 (-0.05) | -0.215 | 1.000 | -0.008 / -0.009 | 0.83 / 0.11 | -0.121 (-2.05) | no |
| with H4>H1 clear 2R | 243 | +0.081 (0.91) | -0.089 | 292 | +0.068 (0.82) | -0.144 | 1.000 | +0.006 / -0.007 | 0.81 / 0.90 | -0.092 (-1.16) | no |
| with H4>H1 clear struct | 230 | -0.276 (-1.51) | -0.454 | 277 | -0.194 (-1.28) | -0.415 | 1.000 | +0.006 / -0.007 | -1.80 / -1.30 | -0.109 (-0.60) | no |
| with H4>H1 inside 1R | 3,591 | +0.004 (0.23) | -0.039 | 4,149 | +0.027 (1.81) | -0.022 | 1.000 | -0.008 / -0.009 | 0.71 / 2.36 | -0.029 (-1.92) | no |
| with H4>H1 inside 2R | 3,591 | -0.004 (-0.17) | -0.047 | 4,149 | +0.006 (0.31) | -0.043 | 1.000 | +0.006 / -0.007 | -0.46 / 0.68 | -0.011 (-0.51) | no |
| with H4>H1 inside struct | 1,573 | -0.069 (-1.47) | -0.131 | 1,802 | +0.003 (0.08) | -0.069 | 1.000 | +0.006 / -0.007 | -1.93 / 0.29 | +0.011 (0.24) | no |
| with H1>M15 any 1R | 15,327 | -0.043 (-4.65) | -0.138 | 17,520 | -0.031 (-3.62) | -0.144 | 1.000 | -0.028 / -0.027 | -1.89 / -0.43 | +0.013 (1.62) | no |
| with H1>M15 any 2R | 15,327 | -0.049 (-3.90) | -0.143 | 17,520 | -0.029 (-2.42) | -0.142 | 1.000 | -0.026 / -0.032 | -2.02 / 0.32 | +0.016 (1.27) | no |
| with H1>M15 any struct | 7,597 | -0.108 (-4.65) | -0.242 | 8,687 | -0.045 (-1.97) | -0.203 | 1.000 | -0.026 / -0.032 | -3.69 / -0.64 | +0.054 (2.56) | no |
| with H1>M15 clear 1R | 812 | -0.129 (-3.68) | -0.410 | 905 | -0.091 (-2.76) | -0.430 | 1.000 | -0.028 / -0.027 | -2.89 / -1.93 | -0.101 (-3.05) | no |
| with H1>M15 clear 2R | 812 | -0.078 (-1.55) | -0.360 | 905 | -0.110 (-2.71) | -0.449 | 1.000 | -0.026 / -0.032 | -1.07 / -1.71 | -0.020 (-0.48) | no |
| with H1>M15 clear struct | 774 | -0.110 (-0.88) | -0.401 | 862 | -0.049 (-0.52) | -0.399 | 1.000 | -0.026 / -0.032 | -0.63 / -0.17 | -0.003 (-0.03) | no |
| with H1>M15 inside 1R | 14,515 | -0.039 (-4.09) | -0.123 | 16,615 | -0.027 (-3.05) | -0.128 | 1.000 | -0.028 / -0.027 | -1.28 / -0.01 | +0.020 (2.24) | no |
| with H1>M15 inside 2R | 14,515 | -0.047 (-3.71) | -0.131 | 16,615 | -0.024 (-1.98) | -0.125 | 1.000 | -0.026 / -0.032 | -1.83 / 0.72 | +0.018 (1.39) | no |
| with H1>M15 inside struct | 6,823 | -0.108 (-5.07) | -0.224 | 7,825 | -0.045 (-2.00) | -0.182 | 1.000 | -0.026 / -0.032 | -4.19 / -0.64 | +0.060 (2.92) | no |
| with M30>M5 any 1R | 38,201 | -0.043 (-7.22) | -0.188 | 43,750 | -0.045 (-8.80) | -0.216 | 1.000 | -0.031 / -0.037 | -2.24 / -1.60 | +0.016 (3.22) | no |
| with M30>M5 any 2R | 38,201 | -0.033 (-3.83) | -0.178 | 43,750 | -0.044 (-6.17) | -0.215 | 1.000 | -0.038 / -0.046 | 0.73 / 0.41 | +0.025 (3.52) | no |
| with M30>M5 any struct | 19,591 | -0.043 (-2.70) | -0.239 | 21,742 | -0.070 (-5.54) | -0.301 | 1.000 | -0.038 / -0.046 | -0.33 / -1.87 | +0.051 (3.66) | no |
| with M30>M5 clear 1R | 2,250 | -0.213 (-9.06) | -0.590 | 2,178 | -0.218 (-10.10) | -0.654 | 1.000 | -0.031 / -0.037 | -8.72 / -8.66 | -0.063 (-2.59) | no |
| with M30>M5 clear 2R | 2,250 | -0.108 (-3.58) | -0.485 | 2,178 | -0.141 (-5.13) | -0.576 | 1.000 | -0.038 / -0.046 | -2.41 / -3.24 | +0.101 (3.16) | no |
| with M30>M5 clear struct | 2,136 | -0.007 (-0.08) | -0.396 | 2,051 | -0.134 (-2.18) | -0.586 | 1.000 | -0.038 / -0.046 | 0.42 / -1.33 | +0.180 (2.46) | no |
| with M30>M5 inside 1R | 35,951 | -0.032 (-5.21) | -0.163 | 41,572 | -0.035 (-6.56) | -0.193 | 1.000 | -0.031 / -0.037 | -0.19 / 0.25 | +0.020 (3.76) | no |
| with M30>M5 inside 2R | 35,951 | -0.028 (-3.13) | -0.159 | 41,572 | -0.039 (-5.22) | -0.196 | 1.000 | -0.038 / -0.046 | 1.36 / 1.15 | +0.021 (2.76) | no |
| with M30>M5 inside struct | 17,455 | -0.047 (-3.03) | -0.219 | 19,691 | -0.063 (-5.00) | -0.271 | 1.000 | -0.038 / -0.046 | -0.71 / -1.39 | +0.037 (2.84) | no |
| fade H4>H1 any 1R | 4,353 | +0.037 (2.26) | -0.169 | 5,068 | -0.039 (-2.48) | -0.284 | 1.000 | +0.035 / -0.009 | 0.15 / -1.99 | -0.065 (-4.37) | no |
| fade H4>H1 any 2R | 4,353 | +0.105 (4.28) | -0.101 | 5,068 | +0.009 (0.41) | -0.237 | 1.000 | +0.105 / +0.040 | -0.01 / -1.50 | -0.035 (-1.78) | no |
| fade H4>H1 any struct | 2,691 | +0.140 (1.77) | -0.076 | 3,109 | +0.054 (0.86) | -0.198 | 1.000 | +0.157 / +0.073 | -0.22 / -0.29 | -0.067 (-1.10) | no |
| fade H4>H1 clear 1R | 991 | -0.016 (-0.51) | -0.206 | 1,207 | -0.026 (-0.87) | -0.273 | 1.000 | +0.035 / -0.009 | -1.52 / -0.57 | -0.088 (-3.04) | no |
| fade H4>H1 clear 2R | 991 | +0.042 (0.85) | -0.148 | 1,207 | +0.056 (1.40) | -0.191 | 1.000 | +0.105 / +0.040 | -1.36 / 0.39 | -0.065 (-1.68) | no |
| fade H4>H1 clear struct | 369 | +0.183 (0.87) | -0.022 | 453 | +0.268 (1.48) | +0.010 | 1.000 | +0.157 / +0.073 | 0.13 / 1.04 | -0.220 (-1.76) | no |
| fade H4>H1 inside 1R | 3,362 | +0.053 (2.85) | -0.158 | 3,861 | -0.043 (-2.54) | -0.287 | 1.000 | +0.035 / -0.009 | 0.98 / -2.00 | -0.057 (-3.42) | no |
| fade H4>H1 inside 2R | 3,362 | +0.123 (4.43) | -0.087 | 3,861 | -0.006 (-0.25) | -0.251 | 1.000 | +0.105 / +0.040 | 0.68 / -1.96 | -0.026 (-1.17) | no |
| fade H4>H1 inside struct | 2,322 | +0.133 (1.58) | -0.084 | 2,656 | +0.017 (0.25) | -0.233 | 1.000 | +0.157 / +0.073 | -0.29 / -0.79 | -0.041 (-0.58) | no |
| fade H1>M15 any 1R | 14,438 | -0.017 (-1.66) | -0.365 | 16,208 | -0.061 (-7.11) | -0.481 | 1.000 | -0.030 / -0.053 | 1.37 / -0.88 | -0.175 (-21.04) | no |
| fade H1>M15 any 2R | 14,438 | +0.112 (7.48) | -0.236 | 16,208 | +0.054 (4.52) | -0.367 | 0.000 | +0.094 / +0.054 | 1.42 / -0.05 | -0.113 (-9.64) | no |
| fade H1>M15 any struct | 9,278 | +0.310 (5.71) | -0.047 | 10,289 | +0.058 (1.38) | -0.374 | 1.000 | +0.241 / +0.158 | 1.38 / -2.45 | -0.119 (-3.18) | no |
| fade H1>M15 clear 1R | 2,931 | -0.040 (-1.91) | -0.378 | 3,657 | -0.055 (-3.07) | -0.467 | 1.000 | -0.030 / -0.053 | -0.56 / -0.09 | -0.179 (-10.40) | no |
| fade H1>M15 clear 2R | 2,931 | +0.042 (1.36) | -0.295 | 3,657 | +0.054 (2.12) | -0.358 | 0.896 | +0.094 / +0.054 | -1.91 / -0.00 | -0.120 (-4.62) | no |
| fade H1>M15 clear struct | 1,136 | +0.261 (1.94) | -0.089 | 1,425 | -0.039 (-0.42) | -0.463 | 1.000 | +0.241 / +0.158 | 0.15 / -2.07 | -0.261 (-3.33) | no |
| fade H1>M15 inside 1R | 11,507 | -0.011 (-1.05) | -0.361 | 12,551 | -0.062 (-6.74) | -0.485 | 1.000 | -0.030 / -0.053 | 1.80 / -0.97 | -0.173 (-18.67) | no |
| fade H1>M15 inside 2R | 11,507 | +0.130 (8.18) | -0.220 | 12,551 | +0.053 (4.05) | -0.370 | 0.002 | +0.094 / +0.054 | 2.50 / -0.06 | -0.112 (-8.76) | no |
| fade H1>M15 inside struct | 8,142 | +0.316 (5.76) | -0.041 | 8,864 | +0.074 (1.56) | -0.360 | 1.000 | +0.241 / +0.158 | 1.42 / -1.90 | -0.097 (-2.40) | no |
| fade M30>M5 any 1R | 31,056 | -0.128 (-15.21) | -0.570 | 31,218 | -0.156 (-19.58) | -0.684 | 1.000 | -0.122 / -0.139 | -1.02 / -2.88 | -0.249 (-29.06) | no |
| fade M30>M5 any 2R | 31,056 | +0.048 (5.19) | -0.394 | 31,218 | +0.003 (0.29) | -0.525 | 1.000 | +0.050 / +0.018 | -0.26 / -1.82 | -0.124 (-12.30) | no |
| fade M30>M5 any struct | 19,451 | +0.211 (6.32) | -0.240 | 19,376 | +0.154 (5.15) | -0.383 | 0.000 | +0.274 / +0.202 | -2.12 / -1.73 | -0.036 (-1.20) | no |
| fade M30>M5 clear 1R | 8,488 | -0.144 (-10.31) | -0.580 | 8,827 | -0.147 (-13.21) | -0.666 | 1.000 | -0.122 / -0.139 | -1.95 / -0.78 | -0.237 (-17.97) | no |
| fade M30>M5 clear 2R | 8,488 | +0.024 (1.43) | -0.412 | 8,827 | +0.007 (0.52) | -0.512 | 1.000 | +0.050 / +0.018 | -1.68 / -0.69 | -0.119 (-7.61) | no |
| fade M30>M5 clear struct | 3,307 | +0.072 (1.24) | -0.373 | 3,467 | +0.111 (1.95) | -0.413 | 1.000 | +0.274 / +0.202 | -3.15 / -1.46 | -0.058 (-1.06) | no |
| fade M30>M5 inside 1R | 22,568 | -0.122 (-14.37) | -0.566 | 22,391 | -0.159 (-17.22) | -0.691 | 1.000 | -0.122 / -0.139 | -0.02 / -2.96 | -0.253 (-27.95) | no |
| fade M30>M5 inside 2R | 22,568 | +0.057 (5.66) | -0.387 | 22,391 | +0.001 (0.08) | -0.531 | 1.000 | +0.050 / +0.018 | 0.70 / -1.74 | -0.125 (-10.63) | no |
| fade M30>M5 inside struct | 16,144 | +0.239 (6.16) | -0.213 | 15,909 | +0.163 (5.12) | -0.377 | 0.000 | +0.274 / +0.202 | -1.05 / -1.27 | -0.031 (-0.95) | no |

## The controls

| Control | n 05-14 | R 05-14 (t) | net 05-14 | n 15-26 | R 15-26 (t) | net 15-26 |
|---|---:|---:|---:|---:|---:|---:|
| with control 1h 1R | 45,411 | -0.008 (-1.41) | -0.040 | 53,120 | -0.009 (-1.72) | -0.047 |
| with control 1h 2R | 45,411 | +0.006 (0.76) | -0.026 | 53,120 | -0.007 (-0.91) | -0.045 |
| with control 15m 1R | 175,986 | -0.028 (-8.23) | -0.096 | 207,816 | -0.027 (-10.59) | -0.107 |
| with control 15m 2R | 175,986 | -0.026 (-5.01) | -0.095 | 207,816 | -0.032 (-8.21) | -0.111 |
| with control 5m 1R | 518,635 | -0.031 (-13.61) | -0.141 | 619,685 | -0.037 (-19.20) | -0.163 |
| with control 5m 2R | 518,635 | -0.038 (-10.49) | -0.148 | 619,685 | -0.046 (-16.56) | -0.172 |
| fade control 1h 1R | 43,062 | +0.035 (5.63) | -0.155 | 50,178 | -0.009 (-1.59) | -0.238 |
| fade control 1h 2R | 43,062 | +0.105 (12.31) | -0.084 | 50,178 | +0.040 (5.17) | -0.189 |
| fade control 1h swing | 39,710 | +0.157 (7.97) | -0.033 | 45,990 | +0.073 (3.62) | -0.158 |
| fade control 15m 1R | 145,032 | -0.030 (-8.39) | -0.348 | 164,557 | -0.053 (-14.50) | -0.443 |
| fade control 15m 2R | 145,032 | +0.094 (19.57) | -0.225 | 164,557 | +0.054 (12.15) | -0.335 |
| fade control 15m swing | 135,982 | +0.241 (17.80) | -0.079 | 151,876 | +0.158 (15.46) | -0.234 |
| fade control 5m 1R | 333,573 | -0.122 (-21.64) | -0.542 | 351,129 | -0.139 (-26.00) | -0.642 |
| fade control 5m 2R | 333,573 | +0.050 (12.52) | -0.370 | 351,129 | +0.018 (3.98) | -0.485 |
| fade control 5m swing | 317,389 | +0.274 (26.28) | -0.147 | 329,660 | +0.202 (23.85) | -0.303 |

## Checks

- Cut test: 25 cuts on xau, eurusd, usdjpy, audusd, eurjpy: 218,971 storylines known by the cut dates, 0 missing or extra when the candles are cut there.
- Every trade has its stop on the losing side of the fill (the run throws otherwise); a fill at or past the stop and a risk under the round-trip cost are no trades (cells, flips and controls alike).
- The fade cells' CF breaks are among the control's breaks, so each fade cell is a subset of its control (the Welch t compares a subset with the whole: it can only understate a real difference a little).

| Market | candles from | storylines | CF inside the VR | cell trades | control trades | dropped (bad data) | risk under cost | unresolved | no struct target |
|---|---|---:|---:|---:|---:|---:|---:|---:|---:|
| xau | 2006-03-19 | 14,969 | 11,191 | 19,186 | 232,294 | 22 | 70,338 | 3 | 8,444 |
| xag | 2006-03-19 | 14,854 | 11,018 | 10,815 | 150,448 | 657 | 148,762 | 6 | 5,680 |
| eurusd | 2004-01-01 | 16,308 | 12,049 | 25,328 | 301,710 | 186 | 35,731 | 6 | 10,715 |
| gbpusd | 2004-01-01 | 16,198 | 12,037 | 24,799 | 297,113 | 377 | 38,984 | 9 | 10,661 |
| usdjpy | 2004-01-01 | 16,868 | 12,456 | 24,825 | 285,148 | 290 | 46,311 | 8 | 10,763 |
| audusd | 2004-01-01 | 16,705 | 12,180 | 25,062 | 298,128 | 237 | 38,243 | 5 | 11,127 |
| nzdusd | 2004-01-01 | 16,613 | 12,183 | 23,640 | 283,143 | 5 | 54,918 | 7 | 10,694 |
| usdcad | 2004-01-01 | 16,079 | 11,938 | 23,509 | 287,322 | 359 | 50,939 | 3 | 10,586 |
| usdchf | 2004-01-01 | 16,130 | 12,056 | 23,288 | 281,562 | 334 | 49,832 | 7 | 10,118 |
| eurjpy | 2004-01-01 | 16,465 | 12,174 | 24,962 | 291,316 | 12 | 40,060 | 7 | 10,933 |

## What it means

No cell clears every check. Where the storyline's fade looks positive before costs it is the general fade tilt of
`grid7-wide-fade` (its control does as well or better), and the storyline traded with the CF does not make money before costs.
The side-flipped check points the same way: 5 flipped cells clear bars 1-3, all of them the WITH cells turned
against the CF (same fill, the wide VR stop mirrored), which is again a fade of the lower-timeframe break.
The grid-6 placebo result is explained by the general fade of a structure break, not by the storyline. Do not re-test
variants of these cells on these years. Nothing live changed; no rule is proposed.
