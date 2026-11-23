# Wide reversal grid: reversal patterns at Daily key levels, ten markets (result)

**Verdict: FAIL. 0 of 48 cells pass; the best confirmation cell, eg qm 15m 1R, made +0.042R a trade before costs in 2015-26 (n 1,390, month t 1.74; discovery -0.060R, t -2.41; vs its control t -0.41 / 1.18).**

Run 23 Nov 2026 as pre-registered (`PREREGISTRATION.md`, committed and pushed alone first). Research only: nothing live
changed, nothing is proposed. One run, no variants.

## What was run

Four Daily key-level families (engulf zone, dominant zone, V / A turn of the closes, previous week's high / low), first touch
only; then on H1 or M15, within 24 candles of the touch, a reversal with the level's side (against the move into it): a QM whose
new extreme is made at the level, or a failed engulf of the move's side (its zone closed through within 6 candles). The
control is the first plain structure break with the level's side. Market entry at the next 5-minute open, stop past the
extreme made at the level + 0.1 ATR(14) of the pattern timeframe, exits 1R, 2R or the measured move (extreme to the trigger
level, projected 1:1 beyond it, only when 1R or more away); time limit 2 days (H1) / 1 day (M15). 48 cells under test, 24
controls. Ten markets pooled, OANDA mid 5-minute candles; discovery = fills 2005-2014, confirmation = 2015 to October 2026.
Costs after the fact only: the demo figures for gold and the four majors; **ASSUMED, not measured** for xag, nzdusd, usdcad, usdchf, eurjpy.

## The bar, cell by cell

- n >= 300 in both windows: 32 of 48.
- Mean R > 0 and month t >= 2 in discovery: 4; in confirmation: 0; both: 0.
- Holm-adjusted p < 0.05 over the 48 confirmation tests: 0.
- Beats its own control (Welch t >= 2 in both windows): 1 of 48.
- **All four: 0.**
- Side-flipped check passing bars 1-3: 0.

Best confirmation cell: eg qm 15m 1R. Best on the weaker of the two windows: dom ef 1h 2R (discovery
+0.017R, t 0.84; confirmation +0.014R, t 0.82).

## Every cell

R a trade before costs (month-sum t), after costs beside; "vs ctl" = Welch t of the cell against its control (discovery /
confirmation); Holm on the 48 confirmation tests. Controls are listed last and are not judged.

| Cell | n 05-14 | R 05-14 (t) | net 05-14 | n 15-26 | R 15-26 (t) | net 15-26 | vs ctl | Holm | Flipped R 15-26 (t) | Pass |
|---|---:|---:|---:|---:|---:|---:|---:|---:|---:|---|
| eg qm 1h 1R | 1,242 | +0.029 (1.18) | +0.002 | 1,495 | -0.003 (-0.14) | -0.036 | 0.77 / -0.42 | 1.000 | +0.002 (0.08) | no |
| eg qm 1h 2R | 1,242 | +0.046 (1.43) | +0.019 | 1,495 | -0.009 (-0.30) | -0.042 | 0.60 / -0.68 | 1.000 | +0.002 (0.06) | no |
| eg qm 1h mm | 2 | -0.528 (-1.06) | -0.555 | 5 | +0.206 (0.46) | +0.102 | -0.90 / 0.97 | 1.000 | -0.126 (-0.26) | no |
| eg qm 15m 1R | 1,048 | -0.060 (-2.41) | -0.110 | 1,390 | +0.042 (1.74) | -0.019 | -0.41 / 1.18 | 1.000 | -0.044 (-1.85) | no |
| eg qm 15m 2R | 1,048 | -0.041 (-1.12) | -0.091 | 1,390 | +0.040 (1.22) | -0.020 | -0.17 / 0.97 | 1.000 | -0.008 (-0.23) | no |
| eg qm 15m mm | 7 | +0.160 (0.42) | +0.069 | 12 | -0.073 (-0.30) | -0.234 | 0.11 / -0.53 | 1.000 | +0.203 (0.73) | no |
| eg ef 1h 1R | 3,514 | +0.006 (0.36) | -0.026 | 4,309 | +0.007 (0.52) | -0.031 | -0.03 / -0.06 | 1.000 | -0.008 (-0.62) | no |
| eg ef 1h 2R | 3,514 | +0.019 (0.94) | -0.012 | 4,309 | +0.003 (0.20) | -0.035 | -0.16 / -0.43 | 1.000 | +0.004 (0.26) | no |
| eg ef 1h mm | 9 | +0.972 (2.25) | +0.855 | 17 | +0.424 (1.51) | +0.287 | 2.43 / 2.02 | 1.000 | -0.193 (-0.94) | no |
| eg ef 15m 1R | 3,392 | -0.029 (-1.93) | -0.086 | 4,224 | -0.010 (-0.66) | -0.083 | 0.75 / -0.86 | 1.000 | +0.007 (0.45) | no |
| eg ef 15m 2R | 3,392 | -0.069 (-3.01) | -0.126 | 4,224 | -0.019 (-0.88) | -0.091 | -1.23 / -0.78 | 1.000 | +0.010 (0.52) | no |
| eg ef 15m mm | 38 | +0.341 (2.01) | +0.160 | 49 | +0.196 (1.33) | -0.076 | 1.02 / 0.42 | 1.000 | -0.188 (-1.28) | no |
| dom qm 1h 1R | 1,314 | +0.016 (0.64) | -0.008 | 1,642 | -0.024 (-0.99) | -0.054 | 0.89 / -0.31 | 1.000 | +0.023 (0.94) | no |
| dom qm 1h 2R | 1,314 | +0.041 (1.25) | +0.017 | 1,642 | -0.031 (-1.04) | -0.061 | 1.07 / -0.76 | 1.000 | +0.043 (1.39) | no |
| dom qm 1h mm | 2 | +0.554 (0.95) | +0.390 | 7 | -0.258 (-0.69) | -0.336 | 0.91 / -0.13 | 1.000 | +0.071 (0.19) | no |
| dom qm 15m 1R | 1,153 | +0.000 (0.01) | -0.038 | 1,595 | +0.009 (0.39) | -0.042 | 0.75 / 1.25 | 1.000 | -0.013 (-0.55) | no |
| dom qm 15m 2R | 1,153 | -0.005 (-0.12) | -0.043 | 1,595 | -0.010 (-0.32) | -0.061 | 0.71 / 0.03 | 1.000 | +0.019 (0.58) | no |
| dom qm 15m mm | 12 | +0.148 (0.27) | +0.071 | 17 | -0.034 (-0.10) | -0.262 | 0.02 / 0.17 | 1.000 | +0.435 (1.25) | no |
| dom ef 1h 1R | 3,606 | +0.000 (0.01) | -0.027 | 4,600 | +0.004 (0.31) | -0.031 | 0.44 / 1.12 | 1.000 | -0.005 (-0.41) | no |
| dom ef 1h 2R | 3,606 | +0.017 (0.84) | -0.010 | 4,600 | +0.014 (0.82) | -0.020 | 0.54 / 0.95 | 1.000 | -0.005 (-0.27) | no |
| dom ef 1h mm | 12 | +0.296 (0.89) | +0.208 | 28 | -0.127 (-0.72) | -0.189 | 0.84 / 0.27 | 1.000 | +0.030 (0.14) | no |
| dom ef 15m 1R | 3,796 | -0.016 (-0.92) | -0.064 | 4,923 | -0.011 (-0.76) | -0.073 | 0.33 / 0.71 | 1.000 | +0.007 (0.48) | no |
| dom ef 15m 2R | 3,796 | -0.045 (-2.12) | -0.092 | 4,923 | -0.014 (-0.71) | -0.076 | -0.46 / -0.14 | 1.000 | +0.018 (0.86) | no |
| dom ef 15m mm | 25 | +0.302 (1.29) | +0.080 | 63 | +0.074 (0.52) | -0.140 | 0.51 / 0.85 | 1.000 | -0.044 (-0.34) | no |
| av qm 1h 1R | 1,034 | +0.078 (2.81) | +0.053 | 1,372 | -0.027 (-1.10) | -0.059 | 1.42 / -0.53 | 1.000 | +0.026 (1.04) | no |
| av qm 1h 2R | 1,034 | +0.112 (3.10) | +0.087 | 1,372 | -0.040 (-1.34) | -0.071 | 1.36 / -1.05 | 1.000 | +0.025 (0.80) | no |
| av qm 1h mm | 4 | -0.500 (-1.00) | -0.599 | 5 | -0.679 (-1.64) | -0.706 | 0.08 / -1.42 | 1.000 | +0.824 (1.48) | no |
| av qm 15m 1R | 978 | -0.011 (-0.40) | -0.055 | 1,334 | -0.010 (-0.38) | -0.065 | 0.71 / 0.23 | 1.000 | +0.004 (0.15) | no |
| av qm 15m 2R | 978 | +0.005 (0.14) | -0.039 | 1,334 | -0.038 (-1.20) | -0.093 | 0.33 / -0.23 | 1.000 | +0.028 (0.79) | no |
| av qm 15m mm | 6 | +0.025 (0.06) | -0.117 | 7 | +0.194 (0.59) | +0.142 | -0.11 / 0.83 | 1.000 | +0.010 (0.02) | no |
| av ef 1h 1R | 2,863 | -0.008 (-0.48) | -0.038 | 3,682 | -0.023 (-1.51) | -0.060 | -1.78 / -0.51 | 1.000 | +0.022 (1.48) | no |
| av ef 1h 2R | 2,863 | +0.009 (0.42) | -0.021 | 3,682 | -0.020 (-1.03) | -0.056 | -1.58 / -0.64 | 1.000 | +0.031 (1.58) | no |
| av ef 1h mm | 9 | -0.225 (-0.70) | -0.381 | 19 | -0.244 (-0.78) | -0.309 | 0.78 / -0.27 | 1.000 | +0.162 (0.72) | no |
| av ef 15m 1R | 3,230 | -0.040 (-2.14) | -0.090 | 4,257 | -0.048 (-3.14) | -0.114 | -0.21 / -1.53 | 1.000 | +0.044 (2.88) | no |
| av ef 15m 2R | 3,230 | -0.040 (-1.61) | -0.090 | 4,257 | -0.066 (-3.47) | -0.132 | -1.04 / -1.43 | 1.000 | +0.071 (3.09) | no |
| av ef 15m mm | 26 | +0.463 (1.93) | +0.349 | 53 | -0.148 (-1.05) | -0.278 | 1.26 / 0.16 | 1.000 | +0.159 (0.99) | no |
| pw qm 1h 1R | 1,000 | +0.022 (0.67) | -0.005 | 1,311 | +0.001 (0.02) | -0.029 | 0.11 / 0.42 | 1.000 | -0.001 (-0.02) | no |
| pw qm 1h 2R | 1,000 | +0.031 (0.71) | +0.005 | 1,311 | +0.016 (0.48) | -0.014 | -0.20 / 0.07 | 1.000 | -0.008 (-0.23) | no |
| pw qm 1h mm | 3 | -0.333 (-0.58) | -0.510 | 3 | -0.660 (-1.01) | -0.745 | -0.34 / -0.43 | 1.000 | +0.533 (0.75) | no |
| pw qm 15m 1R | 802 | +0.010 (0.27) | -0.034 | 1,030 | +0.003 (0.09) | -0.052 | 0.37 / 0.53 | 1.000 | -0.003 (-0.09) | no |
| pw qm 15m 2R | 802 | +0.039 (0.80) | -0.005 | 1,030 | +0.010 (0.27) | -0.045 | 0.29 / 0.41 | 1.000 | +0.014 (0.31) | no |
| pw qm 15m mm | 5 | +1.043 (1.43) | +0.872 | 14 | +0.134 (0.53) | -0.107 | 1.08 / 0.61 | 1.000 | -0.085 (-0.35) | no |
| pw ef 1h 1R | 2,842 | +0.005 (0.26) | -0.025 | 3,276 | -0.009 (-0.46) | -0.046 | -0.55 / 0.13 | 1.000 | +0.009 (0.46) | no |
| pw ef 1h 2R | 2,842 | +0.019 (0.69) | -0.011 | 3,276 | -0.003 (-0.14) | -0.040 | -0.66 / -0.56 | 1.000 | -0.008 (-0.31) | no |
| pw ef 1h mm | 9 | +0.150 (0.38) | +0.026 | 20 | -0.198 (-0.81) | -0.283 | 0.41 / 0.52 | 1.000 | +0.288 (1.09) | no |
| pw ef 15m 1R | 2,685 | +0.001 (0.04) | -0.052 | 3,272 | +0.002 (0.11) | -0.063 | 0.20 / 0.72 | 1.000 | -0.005 (-0.28) | no |
| pw ef 15m 2R | 2,685 | +0.009 (0.31) | -0.044 | 3,272 | -0.014 (-0.61) | -0.079 | -0.48 / -0.23 | 1.000 | +0.007 (0.31) | no |
| pw ef 15m mm | 21 | +0.188 (0.73) | +0.021 | 33 | -0.231 (-1.18) | -0.472 | -0.36 / -0.72 | 1.000 | +0.167 (0.88) | no |
| eg ctl 1h 1R | 4,072 | +0.006 (0.48) | -0.021 | 5,025 | +0.008 (0.61) | -0.025 | control | - | -0.009 (-0.70) | - |
| eg ctl 1h 2R | 4,072 | +0.024 (1.32) | -0.004 | 5,025 | +0.014 (0.89) | -0.019 | control | - | +0.008 (0.48) | - |
| eg ctl 1h mm | 13 | -0.037 (-0.14) | -0.082 | 25 | -0.310 (-1.54) | -0.405 | control | - | +0.046 (0.23) | - |
| eg ctl 15m 1R | 4,019 | -0.046 (-3.27) | -0.098 | 4,843 | +0.007 (0.57) | -0.055 | control | - | -0.012 (-0.91) | - |
| eg ctl 15m 2R | 4,019 | -0.033 (-1.71) | -0.085 | 4,843 | +0.003 (0.16) | -0.059 | control | - | -0.001 (-0.06) | - |
| eg ctl 15m mm | 45 | +0.114 (0.80) | -0.058 | 42 | +0.102 (0.61) | -0.138 | control | - | +0.014 (0.09) | - |
| dom ctl 1h 1R | 4,113 | -0.009 (-0.59) | -0.033 | 5,272 | -0.017 (-1.34) | -0.045 | control | - | +0.015 (1.24) | - |
| dom ctl 1h 2R | 4,113 | +0.003 (0.17) | -0.021 | 5,272 | -0.008 (-0.50) | -0.037 | control | - | +0.027 (1.76) | - |
| dom ctl 1h mm | 26 | -0.028 (-0.16) | -0.092 | 28 | -0.200 (-1.02) | -0.266 | control | - | +0.062 (0.31) | - |
| dom ctl 15m 1R | 4,536 | -0.023 (-1.43) | -0.065 | 5,648 | -0.024 (-1.78) | -0.077 | control | - | +0.019 (1.46) | - |
| dom ctl 15m 2R | 4,536 | -0.033 (-1.72) | -0.075 | 5,648 | -0.011 (-0.62) | -0.064 | control | - | +0.030 (1.59) | - |
| dom ctl 15m mm | 32 | +0.132 (0.54) | +0.035 | 62 | -0.100 (-0.74) | -0.283 | control | - | -0.004 (-0.02) | - |
| av ctl 1h 1R | 3,320 | +0.033 (2.27) | +0.007 | 4,226 | -0.013 (-0.93) | -0.044 | control | - | +0.012 (0.89) | - |
| av ctl 1h 2R | 3,320 | +0.056 (3.15) | +0.030 | 4,226 | -0.003 (-0.18) | -0.035 | control | - | +0.022 (1.34) | - |
| av ctl 1h mm | 12 | -0.546 (-1.98) | -0.618 | 23 | -0.143 (-0.71) | -0.186 | control | - | -0.145 (-0.81) | - |
| av ctl 15m 1R | 3,861 | -0.035 (-2.28) | -0.081 | 4,705 | -0.017 (-1.16) | -0.075 | control | - | +0.013 (0.93) | - |
| av ctl 15m 2R | 3,861 | -0.009 (-0.44) | -0.055 | 4,705 | -0.029 (-1.57) | -0.087 | control | - | +0.044 (2.32) | - |
| av ctl 15m mm | 26 | +0.079 (0.35) | -0.094 | 45 | -0.180 (-1.29) | -0.387 | control | - | +0.208 (1.37) | - |
| pw ctl 1h 1R | 3,187 | +0.018 (0.87) | -0.008 | 3,676 | -0.012 (-0.68) | -0.042 | control | - | +0.011 (0.65) | - |
| pw ctl 1h 2R | 3,187 | +0.040 (1.48) | +0.014 | 3,676 | +0.013 (0.60) | -0.017 | control | - | +0.011 (0.44) | - |
| pw ctl 1h mm | 11 | -0.079 (-0.26) | -0.171 | 20 | -0.364 (-1.65) | -0.457 | control | - | +0.316 (1.12) | - |
| pw ctl 15m 1R | 3,178 | -0.004 (-0.23) | -0.051 | 3,751 | -0.015 (-0.81) | -0.072 | control | - | +0.013 (0.72) | - |
| pw ctl 15m 2R | 3,178 | +0.025 (0.95) | -0.022 | 3,751 | -0.008 (-0.35) | -0.064 | control | - | +0.013 (0.55) | - |
| pw ctl 15m mm | 28 | +0.318 (1.25) | +0.205 | 43 | -0.061 (-0.34) | -0.277 | control | - | +0.071 (0.39) | - |

## Checks

- Cut test: 15 cuts on xau, eurusd, usdjpy: 111,441 signals known by the cut dates, 0 missing or extra when the candles are cut there.
- Every trade has its stop on the losing side of the fill (the run throws otherwise); fills at or past the stop and trades whose risk is under the round trip are no trades (same for every cell).
- Exclusions: the data-quality audit's bad intervals (`combo-grid-2` `exclusions`).

| Market | candles from | signals | simulated | dropped (bad data) | past the stop | risk under cost | mm under 1R |
|---|---|---:|---:|---:|---:|---:|---:|
| xau | 2006-03-19 | 13,522 | 13,169 | 0 | 0 | 0 | 13,061 |
| xag | 2006-03-19 | 13,839 | 13,357 | 36 | 1 | 136 | 13,080 |
| eurusd | 2004-01-01 | 15,297 | 15,018 | 5 | 0 | 0 | 14,958 |
| gbpusd | 2004-01-01 | 15,267 | 14,959 | 7 | 3 | 0 | 14,913 |
| usdjpy | 2004-01-01 | 14,451 | 14,128 | 9 | 0 | 0 | 14,069 |
| audusd | 2004-01-01 | 15,836 | 15,485 | 4 | 1 | 0 | 15,382 |
| nzdusd | 2004-01-01 | 15,465 | 15,155 | 0 | 0 | 0 | 15,062 |
| usdcad | 2004-01-01 | 15,608 | 15,322 | 11 | 0 | 0 | 15,265 |
| usdchf | 2004-01-01 | 14,921 | 14,637 | 10 | 0 | 0 | 14,515 |
| eurjpy | 2004-01-01 | 14,756 | 14,444 | 3 | 4 | 0 | 14,346 |

## The measured-move exit, said plainly

The measured move as registered (extreme to the trigger level, projected 1:1 beyond it) was under 1R on 144,651 of 145,674
simulated signals: the signal candle closes beyond the trigger level, so the projection is shorter than the risk (extreme plus
buffer to the fill) almost by construction. The mm cells are therefore nearly empty and fail bar 1. This was seen in a code check
on 2005-2008 EUR/USD candles before the full run (the only figures looked at before it); the registered definition was kept
unchanged rather than amended after that look. The 1R and 2R cells decide the verdict.

## One side-flipped reading, said plainly

The failed engulf at a Daily V / A turn on M15 lost in both windows, and its side-flipped trades (continuing the move into
the level) made 1R +0.038R (t 2.08) in 2005-14 and +0.044R (t 2.88) in 2015-26, Holm 0.107; 2R +0.055R (t 2.20) in 2005-14 and +0.071R (t 3.09) in 2015-26, Holm 0.057.
Neither clears Holm, and after costs they are 1R -0.022R (t -1.42) and 2R +0.004R (t 0.19) in 2015-26: not a
continuation rule, and not a candidate (a placebo is not a rule; it was not pre-registered as a test).

## What it means

Read this simply, no reversal pattern at a Daily key level beats a plain structure break at the same level on ten
markets over 22 years, before costs. With this many trades a real tilt of a few hundredths of an R would have shown. Do not
re-test variants of these cells on these years. Nothing live changed; no rule is proposed.
