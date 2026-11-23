# Engulf and failed-engulf zones with a ChoCh or EF turn down the ladder (result)

**Verdict: FAIL. 0 of 56 cells pass; the best confirmation cell, B turn ef trig choch 3R, made +0.019R a trade before costs in 2015-26 (n 7,696, month t 1.04; discovery +0.034R, t 1.77).**

Run 23 Nov 2026 as pre-registered (`PREREGISTRATION.md`, committed and pushed alone first). Research only: nothing live
changed, nothing is proposed. One run, no variants.

## What was run

Ladder A: a Daily engulf zone (or a Daily engulf zone that failed and turned), the first return into it, a turn on H4 (a
ChoCh: the first close beyond the last 2-a-side swing against the move into the zone; or an EF: an H4 engulf of the other
side closed through), then the first ChoCh or EF of the same side on H1; ladder B the same one step lower (H4 zone, H1 turn,
M15 trigger). Market entry at the next 5-minute open, stop past the extreme made in the zone + 0.1 ATR of the middle
timeframe, exits 1R / 2R / 3R / the nearest opposite higher zone (1R or more away). 48 cells (ladder x turn x trigger x exit)
and 8 with the Daily MSNR call with / against the side (turn and trigger = either; 1R, 2R). Ten markets pooled, OANDA mid
5-minute candles; discovery = fills 2005-2014, confirmation = 2015 to October 2026. Two controls: (i) the same lowest-timeframe
trigger of the same kind and side with no zone setup, nearest in time; (ii) the zone return entered at market with no turn.
Costs after the fact only: the demo figures for gold and the four majors; **ASSUMED, not measured** for xag, nzdusd, usdcad, usdchf, eurjpy.

## The bar, cell by cell

- n >= 300 in both windows: 53 of 56.
- Mean R > 0 and month t >= 2 in discovery: 0; in confirmation: 0; both: 0.
- Holm-adjusted p < 0.05 over the 56 confirmation tests: 0.
- Beats control (i) (Welch t >= 2 in both windows): 0; control (ii): 0.
- **All: 0.**
- Side-flipped placebo passing bars 1-3 and Holm: 0.

Best confirmation cell: B turn ef trig choch 3R. Best on the weaker of the two windows: B turn ef trig choch 3R (discovery
+0.034R, t 1.77; confirmation +0.019R, t 1.04).

## Every cell

R a trade before costs (month-sum t), after costs beside; controls (i) and (ii): their R in confirmation and the Welch t of the
cell against them (discovery / confirmation); Holm on the confirmation test; the side-flipped placebo in confirmation.

| Cell | n 05-14 | R 05-14 (t) | net 05-14 | n 15-26 | R 15-26 (t) | net 15-26 | ctl (i) R 15-26, Welch | ctl (ii) R 15-26, Welch | Holm | Placebo R 15-26 (t) | Pass |
|---|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|---|
| A turn choch trig choch 1R | 1,472 | -0.030 (-1.01) | -0.046 | 1,936 | -0.008 (-0.33) | -0.029 | +0.256, -10.03 / -8.58 | +0.017, -2.13 / -1.09 | 1.000 | +0.008 (0.33) | no |
| A turn choch trig choch 2R | 1,472 | -0.075 (-1.82) | -0.092 | 1,936 | -0.021 (-0.62) | -0.041 | +0.369, -10.93 / -9.10 | +0.020, -2.92 / -1.30 | 1.000 | +0.026 (0.77) | no |
| A turn choch trig choch 3R | 1,472 | -0.064 (-1.36) | -0.080 | 1,936 | -0.034 (-0.95) | -0.055 | +0.432, -10.17 / -9.22 | +0.019, -2.39 / -1.52 | 1.000 | +0.026 (0.71) | no |
| A turn choch trig choch opp | 155 | -0.291 (-3.01) | -0.317 | 234 | -0.022 (-0.25) | -0.049 | +0.515, -7.16 / -4.46 | +0.043, -2.80 / -0.66 | 1.000 | +0.043 (0.42) | no |
| A turn choch trig ef 1R | 4,089 | +0.007 (0.42) | -0.008 | 5,187 | -0.015 (-0.99) | -0.035 | +0.064, -3.58 / -4.18 | +0.017, -1.15 / -2.02 | 1.000 | +0.014 (0.94) | no |
| A turn choch trig ef 2R | 4,089 | +0.009 (0.35) | -0.007 | 5,187 | -0.019 (-0.88) | -0.040 | +0.057, -2.51 / -3.13 | +0.020, -0.76 / -1.85 | 1.000 | +0.022 (1.12) | no |
| A turn choch trig ef 3R | 4,089 | +0.028 (0.96) | +0.012 | 5,187 | -0.018 (-0.71) | -0.038 | +0.057, -1.99 / -2.74 | +0.019, -0.12 / -1.53 | 1.000 | +0.026 (1.12) | no |
| A turn choch trig ef opp | 403 | -0.148 (-2.62) | -0.171 | 540 | -0.027 (-0.43) | -0.057 | +0.085, -0.97 / -1.38 | +0.043, -1.85 / -1.00 | 1.000 | +0.064 (1.01) | no |
| A turn ef trig choch 1R | 1,342 | -0.049 (-1.80) | -0.066 | 1,774 | -0.008 (-0.37) | -0.027 | +0.171, -7.63 / -5.57 | +0.017, -2.78 / -1.05 | 1.000 | +0.008 (0.35) | no |
| A turn ef trig choch 2R | 1,342 | -0.055 (-1.39) | -0.071 | 1,774 | +0.003 (0.11) | -0.015 | +0.251, -7.58 / -5.64 | +0.020, -2.26 / -0.51 | 1.000 | +0.006 (0.20) | no |
| A turn ef trig choch 3R | 1,342 | -0.040 (-0.90) | -0.056 | 1,774 | +0.023 (0.65) | +0.004 | +0.307, -7.21 / -5.52 | +0.019, -1.74 / 0.09 | 1.000 | +0.011 (0.32) | no |
| A turn ef trig choch opp | 166 | -0.174 (-2.01) | -0.199 | 232 | -0.036 (-0.43) | -0.062 | +0.329, -3.83 / -3.13 | +0.043, -1.59 / -0.84 | 1.000 | +0.077 (0.76) | no |
| A turn ef trig ef 1R | 4,060 | -0.012 (-0.70) | -0.026 | 5,073 | -0.024 (-1.84) | -0.041 | +0.050, -4.85 / -3.90 | +0.017, -2.23 / -2.59 | 1.000 | +0.023 (1.79) | no |
| A turn ef trig ef 2R | 4,060 | +0.006 (0.25) | -0.008 | 5,073 | -0.025 (-1.25) | -0.042 | +0.050, -3.84 / -3.04 | +0.020, -0.86 / -2.10 | 1.000 | +0.019 (1.16) | no |
| A turn ef trig ef 3R | 4,060 | +0.025 (0.87) | +0.011 | 5,073 | -0.021 (-0.86) | -0.038 | +0.041, -2.65 / -2.28 | +0.019, -0.22 / -1.65 | 1.000 | +0.024 (1.20) | no |
| A turn ef trig ef opp | 371 | -0.112 (-1.68) | -0.133 | 528 | -0.080 (-1.40) | -0.105 | +0.043, -1.74 / -1.57 | +0.043, -1.32 / -1.81 | 1.000 | +0.080 (1.27) | no |
| A turn either trig choch 1R | 1,791 | -0.047 (-1.85) | -0.065 | 2,341 | +0.002 (0.10) | -0.020 | +0.210, -9.57 / -7.33 | +0.017, -3.00 / -0.70 | 1.000 | -0.003 (-0.12) | no |
| A turn either trig choch 2R | 1,791 | -0.086 (-2.43) | -0.104 | 2,341 | -0.000 (-0.00) | -0.022 | +0.320, -10.88 / -8.08 | +0.020, -3.45 / -0.67 | 1.000 | +0.026 (0.89) | no |
| A turn either trig choch 3R | 1,791 | -0.076 (-1.83) | -0.094 | 2,341 | -0.019 (-0.60) | -0.041 | +0.367, -10.20 / -8.28 | +0.019, -2.84 / -1.14 | 1.000 | +0.027 (0.77) | no |
| A turn either trig choch opp | 246 | -0.210 (-2.65) | -0.235 | 335 | -0.042 (-0.55) | -0.070 | +0.380, -5.84 / -4.19 | +0.043, -2.29 / -1.01 | 1.000 | +0.065 (0.71) | no |
| A turn either trig ef 1R | 4,799 | -0.001 (-0.06) | -0.018 | 5,998 | -0.022 (-1.71) | -0.044 | +0.053, -4.14 / -4.26 | +0.017, -1.69 / -2.58 | 1.000 | +0.021 (1.61) | no |
| A turn either trig ef 2R | 4,799 | +0.002 (0.10) | -0.015 | 5,998 | -0.025 (-1.24) | -0.047 | +0.042, -3.25 / -2.86 | +0.020, -1.06 / -2.15 | 1.000 | +0.021 (1.24) | no |
| A turn either trig ef 3R | 4,799 | +0.034 (1.21) | +0.017 | 5,998 | -0.032 (-1.39) | -0.054 | +0.032, -2.00 / -2.44 | +0.019, 0.12 / -2.16 | 1.000 | +0.024 (1.17) | no |
| A turn either trig ef opp | 568 | -0.137 (-2.49) | -0.162 | 741 | -0.072 (-1.25) | -0.103 | +0.025, -1.75 / -1.38 | +0.043, -1.89 / -1.81 | 1.000 | +0.103 (1.82) | no |
| B turn choch trig choch 1R | 8,362 | -0.006 (-0.52) | -0.043 | 9,789 | -0.020 (-1.94) | -0.067 | +0.308, -22.16 / -24.07 | -0.005, -2.33 / -1.44 | 1.000 | +0.017 (1.67) | no |
| B turn choch trig choch 2R | 8,362 | +0.005 (0.30) | -0.032 | 9,789 | -0.011 (-0.77) | -0.058 | +0.425, -21.39 / -22.42 | +0.025, -3.28 / -2.61 | 1.000 | +0.016 (1.19) | no |
| B turn choch trig choch 3R | 8,362 | +0.026 (1.29) | -0.010 | 9,789 | -0.006 (-0.33) | -0.053 | +0.479, -19.19 / -20.71 | +0.036, -2.16 / -2.53 | 1.000 | +0.026 (1.69) | no |
| B turn choch trig choch opp | 1,383 | -0.064 (-1.60) | -0.116 | 1,708 | -0.022 (-0.62) | -0.088 | +0.488, -10.83 / -10.76 | +0.056, -3.89 / -2.15 | 1.000 | -0.005 (-0.16) | no |
| B turn choch trig ef 1R | 23,197 | -0.008 (-0.93) | -0.043 | 28,338 | -0.012 (-1.78) | -0.058 | +0.057, -7.71 / -8.52 | -0.005, -3.71 / -1.03 | 1.000 | +0.009 (1.40) | no |
| B turn choch trig ef 2R | 23,197 | +0.002 (0.19) | -0.033 | 28,338 | -0.005 (-0.49) | -0.051 | +0.064, -5.73 / -6.38 | +0.025, -5.22 / -3.34 | 1.000 | +0.019 (2.15) | no |
| B turn choch trig ef 3R | 23,197 | +0.007 (0.52) | -0.028 | 28,338 | +0.001 (0.07) | -0.045 | +0.064, -5.32 / -5.09 | +0.036, -4.86 / -3.24 | 1.000 | +0.023 (2.33) | no |
| B turn choch trig ef opp | 3,613 | -0.043 (-1.65) | -0.098 | 4,779 | -0.027 (-1.30) | -0.094 | +0.057, -3.10 / -2.90 | +0.056, -4.87 / -3.50 | 1.000 | +0.017 (0.81) | no |
| B turn ef trig choch 1R | 6,604 | -0.001 (-0.07) | -0.031 | 7,696 | +0.004 (0.36) | -0.036 | +0.241, -13.69 / -15.52 | -0.005, -1.70 / 0.78 | 1.000 | -0.007 (-0.62) | no |
| B turn ef trig choch 2R | 6,604 | +0.014 (0.83) | -0.017 | 7,696 | +0.013 (0.82) | -0.026 | +0.284, -13.07 / -12.64 | +0.025, -2.52 / -0.79 | 1.000 | -0.007 (-0.55) | no |
| B turn ef trig choch 3R | 6,604 | +0.034 (1.77) | +0.004 | 7,696 | +0.019 (1.04) | -0.020 | +0.311, -10.75 / -11.64 | +0.036, -1.63 / -0.95 | 1.000 | -0.012 (-0.77) | no |
| B turn ef trig choch opp | 850 | +0.021 (0.54) | -0.019 | 1,035 | -0.004 (-0.09) | -0.059 | +0.334, -6.16 / -6.01 | +0.056, -1.42 / -1.36 | 1.000 | -0.009 (-0.21) | no |
| B turn ef trig ef 1R | 20,596 | -0.003 (-0.43) | -0.033 | 25,164 | -0.000 (-0.03) | -0.037 | +0.072, -8.24 / -8.58 | -0.005, -3.02 / 0.70 | 1.000 | -0.001 (-0.20) | no |
| B turn ef trig ef 2R | 20,596 | +0.007 (0.68) | -0.023 | 25,164 | +0.007 (0.60) | -0.031 | +0.073, -6.18 / -5.86 | +0.025, -4.67 / -2.02 | 1.000 | +0.005 (0.63) | no |
| B turn ef trig ef 3R | 20,596 | +0.010 (0.86) | -0.019 | 25,164 | +0.013 (1.01) | -0.024 | +0.075, -5.54 / -4.78 | +0.036, -4.55 / -2.07 | 1.000 | +0.004 (0.43) | no |
| B turn ef trig ef opp | 2,419 | +0.013 (0.48) | -0.031 | 3,185 | +0.008 (0.32) | -0.045 | +0.083, -2.35 / -2.29 | +0.056, -2.50 / -1.83 | 1.000 | +0.040 (1.61) | no |
| B turn either trig choch 1R | 9,605 | -0.001 (-0.05) | -0.038 | 11,222 | -0.012 (-1.23) | -0.061 | +0.281, -20.44 / -22.84 | -0.005, -1.92 / -0.68 | 1.000 | +0.009 (0.96) | no |
| B turn either trig choch 2R | 9,605 | +0.013 (0.81) | -0.025 | 11,222 | -0.013 (-0.89) | -0.062 | +0.376, -19.98 / -21.22 | +0.025, -2.92 / -2.88 | 1.000 | +0.011 (0.99) | no |
| B turn either trig choch 3R | 9,605 | +0.033 (1.83) | -0.005 | 11,222 | -0.004 (-0.26) | -0.053 | +0.422, -17.49 / -19.40 | +0.036, -1.85 / -2.56 | 1.000 | +0.013 (0.97) | no |
| B turn either trig choch opp | 1,676 | -0.021 (-0.59) | -0.073 | 2,058 | -0.006 (-0.20) | -0.073 | +0.429, -10.22 / -10.08 | +0.056, -3.04 / -1.86 | 1.000 | -0.005 (-0.16) | no |
| B turn either trig ef 1R | 26,366 | -0.008 (-0.97) | -0.045 | 32,225 | -0.007 (-1.17) | -0.055 | +0.057, -8.25 / -8.48 | -0.005, -3.84 / -0.34 | 1.000 | +0.005 (0.76) | no |
| B turn either trig ef 2R | 26,366 | +0.005 (0.51) | -0.032 | 32,225 | -0.003 (-0.30) | -0.050 | +0.059, -5.53 / -6.04 | +0.025, -5.06 / -3.20 | 1.000 | +0.012 (1.62) | no |
| B turn either trig ef 3R | 26,366 | +0.008 (0.59) | -0.030 | 32,225 | +0.003 (0.25) | -0.044 | +0.058, -5.20 / -4.59 | +0.036, -4.96 / -3.12 | 1.000 | +0.010 (1.17) | no |
| B turn either trig ef opp | 4,394 | -0.029 (-1.23) | -0.084 | 5,845 | -0.013 (-0.69) | -0.080 | +0.059, -3.27 / -2.76 | +0.056, -4.66 / -3.14 | 1.000 | +0.021 (1.07) | no |
| A turn either trig either 1R MSNR with | 2,740 | -0.001 (-0.03) | -0.018 | 3,405 | -0.004 (-0.21) | -0.026 | +0.082, -4.73 / -3.67 | +0.024, -1.59 / -1.38 | 1.000 | +0.003 (0.14) | no |
| A turn either trig either 2R MSNR with | 2,740 | +0.027 (0.85) | +0.010 | 3,405 | -0.010 (-0.37) | -0.033 | +0.106, -3.66 / -3.68 | +0.019, 0.04 / -1.05 | 1.000 | +0.022 (0.82) | no |
| A turn either trig either 1R MSNR against | 2,160 | -0.011 (-0.49) | -0.028 | 2,730 | -0.035 (-1.58) | -0.057 | +0.087, -4.29 / -4.63 | +0.009, -1.26 / -1.89 | 1.000 | +0.033 (1.53) | no |
| A turn either trig either 2R MSNR against | 2,160 | -0.046 (-1.44) | -0.063 | 2,730 | -0.034 (-1.16) | -0.056 | +0.086, -5.38 / -3.46 | +0.021, -2.19 / -1.79 | 1.000 | +0.016 (0.57) | no |
| B turn either trig either 1R MSNR with | 13,631 | -0.006 (-0.55) | -0.043 | 16,680 | -0.006 (-0.66) | -0.053 | +0.099, -9.87 / -9.91 | -0.005, -2.83 / -0.09 | 1.000 | +0.003 (0.35) | no |
| B turn either trig either 2R MSNR with | 13,631 | +0.007 (0.40) | -0.031 | 16,680 | -0.008 (-0.62) | -0.056 | +0.116, -8.60 / -8.55 | +0.027, -3.29 / -2.87 | 1.000 | +0.011 (0.80) | no |
| B turn either trig either 1R MSNR against | 13,173 | -0.009 (-0.88) | -0.047 | 16,179 | -0.009 (-0.94) | -0.058 | +0.115, -10.01 / -11.52 | -0.005, -2.64 / -0.41 | 1.000 | +0.007 (0.70) | no |
| B turn either trig either 2R MSNR against | 13,173 | +0.001 (0.06) | -0.037 | 16,179 | -0.002 (-0.17) | -0.051 | +0.140, -8.22 / -9.63 | +0.024, -4.05 / -2.07 | 1.000 | +0.015 (1.16) | no |

## Checks

- Cut test: 15 cuts on xau, eurusd, usdjpy: 262,798 signals known by the cut dates, 0 missing or extra when the candles are cut there.
- Every trade has its stop on the losing side of the fill (the run throws otherwise); fills at or past the stop and trades whose risk is under the round-trip cost are no trades (same for cells and controls).
- Exclusions: the data-quality audit's bad intervals (`combo-grid-2` `exclusions`).

| Market | candles from | signals | zone returns | trades | ctl (i) | no ctl (i) found | ctl (ii) | dropped (bad data) | past the stop | risk under cost |
|---|---|---:|---:|---:|---:|---:|---:|---:|---:|---:|
| xau | 2006-03-19 | 37,216 | 16,051 | 29,101 | 29,101 | 0 | 15,720 | 4 | 29 | 304 |
| xag | 2006-03-19 | 37,392 | 16,297 | 29,038 | 28,864 | 0 | 11,543 | 140 | 41 | 4,974 |
| eurusd | 2004-01-01 | 40,508 | 17,559 | 31,754 | 31,751 | 0 | 17,510 | 35 | 23 | 21 |
| gbpusd | 2004-01-01 | 40,892 | 17,598 | 32,109 | 32,101 | 0 | 17,512 | 35 | 43 | 32 |
| usdjpy | 2004-01-01 | 40,811 | 17,464 | 32,176 | 32,160 | 1 | 17,329 | 30 | 45 | 83 |
| audusd | 2004-01-01 | 42,962 | 17,873 | 33,863 | 33,856 | 0 | 17,743 | 55 | 42 | 73 |
| nzdusd | 2004-01-01 | 43,194 | 17,503 | 33,828 | 33,827 | 1 | 17,370 | 0 | 62 | 68 |
| usdcad | 2004-01-01 | 43,406 | 17,952 | 33,775 | 33,767 | 0 | 17,848 | 45 | 36 | 53 |
| usdchf | 2004-01-01 | 40,750 | 17,487 | 31,664 | 31,647 | 0 | 17,300 | 45 | 71 | 112 |
| eurjpy | 2004-01-01 | 41,322 | 17,434 | 32,416 | 32,403 | 0 | 17,356 | 7 | 42 | 33 |

## Control (i) is biased (found after the run)

Control (i) came out far above the real cells on every market (about +0.25R to +0.5R a trade on the ChoCh cells), which the
earlier fade studies make implausible for plain trigger events. The cause is in the pre-registered matching, not in the trade
code: the matched trigger is the nearest in time, and when it lies BEFORE the real trigger it is chosen because a real setup
forms after it, which tells the control that price is about to turn its way (selection on the future). A check of the cell
B turn choch trig choch 1R on all ten markets (`run.mjs bias`): matched controls before the real trigger +0.568R a trade
(n 14,721), after it -0.015R (n 9,380); the real cell made -0.006R / -0.020R.
So the Welch tests against control (i) are not a fair comparison and are reported only as computed. The verdict does not rest
on them: no cell meets bar 2 (mean R > 0 with month t >= 2) in either window, and none beats control (ii), which has no such
selection. A future matched control should only take triggers known before the real one AND chosen without reference to it.

## What it means

No cell clears the bar. On ten markets over 22 years, a higher engulf or failed-engulf zone with a ChoCh or EF turn one
timeframe lower and the same sign one timeframe lower again sits at about zero before costs (no cell has month t >= 2 in either
window) and loses after costs; it does not beat entering at the zone return (control (ii)), and the side-flipped trades do no
better or worse in any way that clears the bar. Do not re-test variants of these cells on these years. Nothing live changed; no
rule is proposed.
