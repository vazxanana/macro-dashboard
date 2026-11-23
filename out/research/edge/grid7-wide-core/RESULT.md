# Wide core grid: 96 cells on ten markets (result)

**Verdict: FAIL. 0 of 96 cells pass; the best confirmation cell, eg 1d box 2R, made +0.025R a trade before costs in 2015-26 (n 3,446, month t 1.29; discovery +0.024R, t 1.08).**

Run 23 Nov 2026 as pre-registered (`PREREGISTRATION.md`, committed and pushed alone first). Research only: nothing live
changed, nothing is proposed. One run, no variants.

## What was run

Six level families on the Daily or H4 chart (engulf zone, failed engulf traded the other way, dominant zone, V / A turn of
the closes, fresh supply / demand, and a control with no level), first touch only; then on the timeframe two steps lower
(Daily -> H1, H4 -> M15) the first structure break or box close-out with the level's side within 24 candles; market entry at
the next 5-minute open, stop past the trigger's swing + 0.1 ATR, a 1R or 2R target (time limit 2 days / 1 day). The same 48
cells again with the Daily MSNR call agreeing: 96. Ten markets pooled (xau, xag, eurusd, gbpusd, usdjpy, audusd, nzdusd,
usdcad, usdchf, eurjpy), OANDA mid 5-minute candles. Discovery = fills 2005-2014, confirmation = 2015 to October 2026.
Costs after the fact only: the demo figures for gold and the four majors; **ASSUMED, not measured** for xag, nzdusd, usdcad, usdchf, eurjpy.

## The bar, cell by cell

- n >= 300 in both windows: 96 of 96.
- Mean R > 0 and month t >= 2 in discovery: 0; in confirmation: 0; both: 0.
- Holm-adjusted p < 0.05 over the 96 confirmation tests: 0.
- Beats its own control (Welch t >= 2 in both windows): 0 of 80.
- **All four (a level family, not the control): 0.**
- Side-flipped placebo passing bars 1-3: 10 (eg 4h box 2R; av 4h box 2R; none 4h break 1R; none 4h break 2R; none 4h box 1R; none 4h box 2R; none 4h break 1R +MSNR; none 4h break 2R +MSNR; none 4h box 1R +MSNR; none 4h box 2R +MSNR).

Best confirmation cell: eg 1d box 2R. Best on the weaker of the two windows: eg 1d box 2R (discovery
+0.024R, t 1.08; confirmation +0.025R, t 1.29).

All cells without the MSNR condition at 1R, pooled (trades counted once per cell): discovery -0.024R a trade over
649,876 cell-trades, confirmation -0.022R over 770,426.

## Every cell

R a trade before costs (month-sum t), after costs beside; "vs ctl" = Welch t of the cell against its control (discovery /
confirmation); Holm on the confirmation test.

| Cell | n 05-14 | R 05-14 (t) | net 05-14 | n 15-26 | R 15-26 (t) | net 15-26 | vs ctl | Holm | Placebo R 15-26 (t) | Pass |
|---|---:|---:|---:|---:|---:|---:|---:|---:|---:|---|
| eg 1d break 1R | 4,072 | -0.009 (-0.73) | -0.047 | 5,025 | +0.014 (1.04) | -0.029 | 0.25 / 1.73 | 1.000 | -0.017 (-1.25) | no |
| eg 1d break 2R | 4,072 | +0.007 (0.35) | -0.031 | 5,025 | +0.009 (0.50) | -0.034 | 0.46 / 0.89 | 1.000 | -0.000 (-0.03) | no |
| eg 1d box 1R | 2,813 | +0.025 (1.32) | +0.001 | 3,446 | +0.011 (0.70) | -0.018 | 1.93 / 1.10 | 1.000 | -0.011 (-0.70) | no |
| eg 1d box 2R | 2,813 | +0.024 (1.08) | +0.000 | 3,446 | +0.025 (1.29) | -0.004 | 1.24 / 1.20 | 1.000 | +0.007 (0.33) | no |
| eg 4h break 1R | 23,563 | -0.031 (-5.02) | -0.099 | 28,173 | -0.023 (-3.56) | -0.104 | 0.15 / 1.20 | 1.000 | +0.019 (2.90) | no |
| eg 4h break 2R | 23,563 | -0.027 (-3.32) | -0.094 | 28,173 | -0.031 (-3.53) | -0.112 | 0.63 / 0.56 | 1.000 | +0.021 (2.74) | no |
| eg 4h box 1R | 16,713 | -0.020 (-3.13) | -0.065 | 19,611 | -0.024 (-3.51) | -0.080 | 0.52 / -0.03 | 1.000 | +0.021 (3.14) | no |
| eg 4h box 2R | 16,713 | -0.013 (-1.39) | -0.058 | 19,611 | -0.016 (-1.86) | -0.073 | 0.67 / 1.00 | 1.000 | +0.031 (3.66) | no |
| ef 1d break 1R | 2,539 | -0.012 (-0.63) | -0.047 | 3,245 | -0.023 (-1.37) | -0.067 | 0.08 / -0.77 | 1.000 | +0.021 (1.26) | no |
| ef 1d break 2R | 2,539 | -0.007 (-0.28) | -0.042 | 3,245 | -0.056 (-2.71) | -0.099 | -0.19 / -2.23 | 1.000 | +0.027 (1.24) | no |
| ef 1d box 1R | 1,754 | +0.007 (0.30) | -0.017 | 2,284 | -0.021 (-1.09) | -0.050 | 0.72 / -0.78 | 1.000 | +0.019 (1.00) | no |
| ef 1d box 2R | 1,754 | -0.006 (-0.20) | -0.030 | 2,284 | -0.051 (-2.24) | -0.080 | -0.16 / -2.28 | 1.000 | +0.030 (1.15) | no |
| ef 4h break 1R | 15,628 | -0.036 (-4.24) | -0.105 | 18,625 | -0.018 (-2.43) | -0.098 | -0.54 / 1.67 | 1.000 | +0.014 (1.84) | no |
| ef 4h break 2R | 15,628 | -0.029 (-2.58) | -0.098 | 18,625 | -0.016 (-1.43) | -0.096 | 0.27 / 2.02 | 1.000 | +0.008 (0.75) | no |
| ef 4h box 1R | 11,084 | -0.014 (-1.46) | -0.059 | 13,062 | -0.012 (-1.34) | -0.068 | 1.11 / 1.38 | 1.000 | +0.009 (1.06) | no |
| ef 4h box 2R | 11,084 | -0.003 (-0.24) | -0.049 | 13,062 | +0.005 (0.40) | -0.051 | 1.36 / 2.72 | 1.000 | +0.021 (1.87) | no |
| dom 1d break 1R | 4,113 | -0.022 (-1.32) | -0.057 | 5,273 | -0.021 (-1.68) | -0.062 | -0.60 / -0.84 | 1.000 | +0.020 (1.57) | no |
| dom 1d break 2R | 4,113 | -0.006 (-0.26) | -0.040 | 5,273 | -0.021 (-1.28) | -0.062 | -0.15 / -0.81 | 1.000 | +0.043 (2.50) | no |
| dom 1d box 1R | 2,789 | -0.037 (-2.03) | -0.060 | 3,600 | -0.031 (-2.36) | -0.058 | -1.64 / -1.64 | 1.000 | +0.031 (2.31) | no |
| dom 1d box 2R | 2,789 | -0.015 (-0.70) | -0.038 | 3,600 | -0.017 (-0.96) | -0.044 | -0.61 / -1.00 | 1.000 | +0.035 (1.98) | no |
| dom 4h break 1R | 22,281 | -0.019 (-2.63) | -0.084 | 27,605 | -0.024 (-3.87) | -0.101 | 1.83 / 1.00 | 1.000 | +0.019 (3.01) | no |
| dom 4h break 2R | 22,281 | -0.020 (-2.10) | -0.085 | 27,605 | -0.032 (-3.72) | -0.109 | 1.33 / 0.50 | 1.000 | +0.019 (2.19) | no |
| dom 4h box 1R | 15,851 | -0.020 (-2.37) | -0.064 | 19,308 | -0.024 (-3.29) | -0.080 | 0.52 / -0.10 | 1.000 | +0.021 (2.79) | no |
| dom 4h box 2R | 15,851 | -0.010 (-0.84) | -0.054 | 19,308 | -0.026 (-2.64) | -0.082 | 0.94 / -0.07 | 1.000 | +0.023 (2.33) | no |
| av 1d break 1R | 3,320 | +0.009 (0.54) | -0.028 | 4,225 | -0.013 (-0.89) | -0.057 | 1.32 / -0.21 | 1.000 | +0.012 (0.83) | no |
| av 1d break 2R | 3,320 | +0.029 (1.38) | -0.007 | 4,225 | -0.011 (-0.61) | -0.055 | 1.42 / -0.23 | 1.000 | +0.026 (1.44) | no |
| av 1d box 1R | 2,245 | +0.010 (0.58) | -0.013 | 2,827 | -0.016 (-1.09) | -0.046 | 0.97 / -0.59 | 1.000 | +0.016 (1.09) | no |
| av 1d box 2R | 2,245 | +0.029 (1.25) | +0.006 | 2,827 | -0.014 (-0.72) | -0.044 | 1.29 / -0.73 | 1.000 | +0.036 (1.86) | no |
| av 4h break 1R | 20,159 | -0.027 (-3.78) | -0.095 | 23,904 | -0.016 (-2.46) | -0.098 | 0.74 / 2.12 | 1.000 | +0.012 (1.79) | no |
| av 4h break 2R | 20,159 | -0.025 (-2.57) | -0.094 | 23,904 | -0.015 (-1.74) | -0.097 | 0.74 / 2.35 | 1.000 | +0.029 (3.17) | no |
| av 4h box 1R | 13,558 | -0.023 (-2.90) | -0.069 | 15,766 | -0.008 (-1.09) | -0.066 | 0.11 / 1.95 | 1.000 | +0.005 (0.66) | no |
| av 4h box 2R | 13,558 | -0.014 (-1.22) | -0.060 | 15,766 | +0.000 (0.04) | -0.057 | 0.49 / 2.52 | 1.000 | +0.035 (3.71) | no |
| sd 1d break 1R | 993 | -0.050 (-1.55) | -0.088 | 1,249 | -0.060 (-2.24) | -0.106 | -1.23 / -1.90 | 1.000 | +0.059 (2.18) | no |
| sd 1d break 2R | 993 | -0.046 (-1.12) | -0.084 | 1,249 | -0.105 (-2.97) | -0.150 | -1.12 / -2.92 | 1.000 | +0.088 (2.25) | no |
| sd 1d box 1R | 653 | +0.018 (0.51) | -0.005 | 844 | -0.046 (-1.39) | -0.076 | 0.75 / -1.30 | 1.000 | +0.046 (1.39) | no |
| sd 1d box 2R | 653 | +0.013 (0.30) | -0.010 | 844 | -0.089 (-2.32) | -0.119 | 0.36 / -2.48 | 1.000 | +0.043 (1.02) | no |
| sd 4h break 1R | 6,585 | -0.029 (-2.38) | -0.094 | 7,365 | -0.008 (-0.65) | -0.085 | 0.21 / 1.94 | 1.000 | +0.002 (0.16) | no |
| sd 4h break 2R | 6,585 | -0.023 (-1.30) | -0.088 | 7,365 | -0.025 (-1.53) | -0.102 | 0.55 / 0.71 | 1.000 | +0.012 (0.75) | no |
| sd 4h box 1R | 4,757 | -0.015 (-0.98) | -0.059 | 5,101 | -0.026 (-1.75) | -0.080 | 0.69 / -0.20 | 1.000 | +0.023 (1.51) | no |
| sd 4h box 2R | 4,757 | -0.001 (-0.04) | -0.045 | 5,101 | -0.017 (-0.96) | -0.071 | 1.06 / 0.51 | 1.000 | +0.020 (1.13) | no |
| none 1d break 1R | 60,196 | -0.013 (-2.55) | -0.051 | 70,893 | -0.010 (-2.30) | -0.054 | control | 1.000 | +0.008 (1.79) | no |
| none 1d break 2R | 60,196 | -0.003 (-0.33) | -0.040 | 70,893 | -0.007 (-1.04) | -0.051 | control | 1.000 | +0.014 (2.72) | no |
| none 1d box 1R | 37,732 | -0.008 (-1.47) | -0.032 | 43,993 | -0.006 (-1.28) | -0.036 | control | 1.000 | +0.005 (1.01) | no |
| none 1d box 2R | 37,732 | -0.002 (-0.24) | -0.026 | 43,993 | +0.002 (0.22) | -0.028 | control | 1.000 | +0.014 (2.52) | no |
| none 4h break 1R | 235,332 | -0.032 (-10.96) | -0.109 | 277,873 | -0.030 (-12.66) | -0.119 | control | 1.000 | +0.026 (10.80) | no |
| none 4h break 2R | 235,332 | -0.032 (-6.92) | -0.109 | 277,873 | -0.036 (-10.08) | -0.125 | control | 1.000 | +0.026 (9.41) | no |
| none 4h box 1R | 141,146 | -0.024 (-7.44) | -0.075 | 167,129 | -0.024 (-8.71) | -0.086 | control | 1.000 | +0.020 (7.46) | no |
| none 4h box 2R | 141,146 | -0.020 (-3.78) | -0.071 | 167,129 | -0.025 (-6.04) | -0.088 | control | 1.000 | +0.024 (7.46) | no |
| eg 1d break 1R +MSNR | 2,138 | -0.015 (-0.77) | -0.051 | 2,543 | -0.018 (-0.89) | -0.061 | -0.36 / -0.05 | 1.000 | +0.015 (0.73) | no |
| eg 1d break 2R +MSNR | 2,138 | +0.009 (0.36) | -0.027 | 2,543 | -0.034 (-1.28) | -0.077 | 0.16 / -0.57 | 1.000 | +0.034 (1.27) | no |
| eg 1d box 1R +MSNR | 1,502 | +0.001 (0.03) | -0.023 | 1,746 | -0.029 (-1.29) | -0.057 | 0.35 / -0.52 | 1.000 | +0.029 (1.29) | no |
| eg 1d box 2R +MSNR | 1,502 | +0.028 (0.96) | +0.005 | 1,746 | +0.000 (0.01) | -0.028 | 0.81 / 0.40 | 1.000 | +0.032 (1.18) | no |
| eg 4h break 1R +MSNR | 12,022 | -0.039 (-4.12) | -0.106 | 14,404 | -0.018 (-2.04) | -0.098 | -1.27 / 1.50 | 1.000 | +0.013 (1.50) | no |
| eg 4h break 2R +MSNR | 12,022 | -0.032 (-2.71) | -0.098 | 14,404 | -0.036 (-2.84) | -0.116 | -0.54 / 0.31 | 1.000 | +0.020 (1.83) | no |
| eg 4h box 1R +MSNR | 8,504 | -0.021 (-2.03) | -0.066 | 10,051 | -0.029 (-2.83) | -0.085 | 0.04 / -0.58 | 1.000 | +0.026 (2.53) | no |
| eg 4h box 2R +MSNR | 8,504 | -0.014 (-0.96) | -0.059 | 10,051 | -0.021 (-1.59) | -0.077 | 0.04 / 0.66 | 1.000 | +0.041 (3.09) | no |
| ef 1d break 1R +MSNR | 1,563 | -0.025 (-1.01) | -0.061 | 2,074 | -0.027 (-1.30) | -0.071 | -0.72 / -0.48 | 1.000 | +0.024 (1.16) | no |
| ef 1d break 2R +MSNR | 1,563 | -0.014 (-0.43) | -0.051 | 2,074 | -0.065 (-2.64) | -0.109 | -0.59 / -1.66 | 1.000 | +0.042 (1.41) | no |
| ef 1d box 1R +MSNR | 1,074 | -0.015 (-0.55) | -0.039 | 1,470 | -0.028 (-1.11) | -0.057 | -0.28 / -0.41 | 1.000 | +0.025 (1.01) | no |
| ef 1d box 2R +MSNR | 1,074 | -0.008 (-0.23) | -0.032 | 1,470 | -0.068 (-2.45) | -0.097 | -0.37 / -1.99 | 1.000 | +0.024 (0.72) | no |
| ef 4h break 1R +MSNR | 7,725 | -0.040 (-3.78) | -0.109 | 9,378 | -0.004 (-0.39) | -0.084 | -1.12 / 2.56 | 1.000 | +0.001 (0.08) | no |
| ef 4h break 2R +MSNR | 7,725 | -0.041 (-2.83) | -0.109 | 9,378 | -0.001 (-0.05) | -0.081 | -1.01 / 2.75 | 1.000 | +0.001 (0.09) | no |
| ef 4h box 1R +MSNR | 5,470 | -0.010 (-0.70) | -0.055 | 6,737 | -0.014 (-1.05) | -0.070 | 0.90 / 0.84 | 1.000 | +0.011 (0.87) | no |
| ef 4h box 2R +MSNR | 5,470 | -0.011 (-0.58) | -0.056 | 6,737 | +0.010 (0.56) | -0.046 | 0.21 / 2.54 | 1.000 | +0.021 (1.26) | no |
| dom 1d break 1R +MSNR | 2,345 | -0.020 (-0.94) | -0.052 | 2,926 | -0.047 (-2.67) | -0.088 | -0.62 / -1.67 | 1.000 | +0.046 (2.59) | no |
| dom 1d break 2R +MSNR | 2,345 | -0.005 (-0.19) | -0.038 | 2,926 | -0.053 (-2.24) | -0.094 | -0.39 / -1.44 | 1.000 | +0.082 (3.33) | no |
| dom 1d box 1R +MSNR | 1,582 | -0.033 (-1.38) | -0.055 | 1,994 | -0.071 (-3.52) | -0.098 | -1.14 / -2.60 | 1.000 | +0.070 (3.46) | no |
| dom 1d box 2R +MSNR | 1,582 | -0.006 (-0.20) | -0.028 | 1,994 | -0.061 (-2.43) | -0.088 | -0.35 / -2.02 | 1.000 | +0.084 (3.20) | no |
| dom 4h break 1R +MSNR | 11,686 | -0.026 (-2.68) | -0.089 | 14,600 | -0.034 (-3.72) | -0.111 | 0.18 / -0.35 | 1.000 | +0.029 (3.15) | no |
| dom 4h break 2R +MSNR | 11,686 | -0.031 (-2.50) | -0.095 | 14,600 | -0.044 (-3.52) | -0.120 | -0.50 / -0.36 | 1.000 | +0.032 (2.53) | no |
| dom 4h box 1R +MSNR | 8,296 | -0.024 (-2.30) | -0.067 | 10,241 | -0.028 (-2.49) | -0.083 | -0.26 / -0.46 | 1.000 | +0.025 (2.23) | no |
| dom 4h box 2R +MSNR | 8,296 | -0.009 (-0.59) | -0.052 | 10,241 | -0.036 (-2.61) | -0.091 | 0.36 / -0.51 | 1.000 | +0.027 (1.77) | no |
| av 1d break 1R +MSNR | 1,548 | +0.006 (0.23) | -0.028 | 1,943 | -0.031 (-1.43) | -0.073 | 0.53 / -0.63 | 1.000 | +0.030 (1.38) | no |
| av 1d break 2R +MSNR | 1,548 | +0.002 (0.06) | -0.032 | 1,943 | -0.029 (-1.08) | -0.071 | -0.10 / -0.34 | 1.000 | +0.021 (0.75) | no |
| av 1d box 1R +MSNR | 1,046 | +0.005 (0.17) | -0.017 | 1,271 | -0.049 (-2.12) | -0.078 | 0.44 / -1.22 | 1.000 | +0.049 (2.12) | no |
| av 1d box 2R +MSNR | 1,046 | -0.002 (-0.05) | -0.023 | 1,271 | -0.035 (-1.24) | -0.063 | -0.17 / -0.78 | 1.000 | +0.048 (1.67) | no |
| av 4h break 1R +MSNR | 10,056 | -0.034 (-3.22) | -0.100 | 12,110 | -0.020 (-2.07) | -0.102 | -0.67 / 1.18 | 1.000 | +0.015 (1.59) | no |
| av 4h break 2R +MSNR | 10,056 | -0.033 (-2.26) | -0.099 | 12,110 | -0.026 (-1.90) | -0.107 | -0.61 / 1.12 | 1.000 | +0.036 (2.62) | no |
| av 4h box 1R +MSNR | 6,783 | -0.034 (-2.92) | -0.077 | 7,970 | +0.000 (0.01) | -0.057 | -1.05 / 2.14 | 1.000 | -0.004 (-0.33) | no |
| av 4h box 2R +MSNR | 6,783 | -0.018 (-1.06) | -0.061 | 7,970 | +0.004 (0.24) | -0.054 | -0.21 / 2.31 | 1.000 | +0.030 (1.98) | no |
| sd 1d break 1R +MSNR | 551 | -0.051 (-1.17) | -0.085 | 710 | -0.081 (-2.25) | -0.129 | -1.09 / -1.80 | 1.000 | +0.078 (2.16) | no |
| sd 1d break 2R +MSNR | 551 | -0.037 (-0.64) | -0.071 | 710 | -0.141 (-3.00) | -0.189 | -0.80 / -2.77 | 1.000 | +0.129 (2.39) | no |
| sd 1d box 1R +MSNR | 370 | -0.035 (-0.76) | -0.056 | 480 | -0.103 (-2.37) | -0.135 | -0.61 / -2.15 | 1.000 | +0.103 (2.37) | no |
| sd 1d box 2R +MSNR | 370 | -0.005 (-0.09) | -0.026 | 480 | -0.144 (-2.91) | -0.176 | -0.17 / -2.84 | 1.000 | +0.065 (1.26) | no |
| sd 4h break 1R +MSNR | 3,549 | -0.037 (-2.19) | -0.102 | 3,963 | -0.008 (-0.44) | -0.084 | -0.58 / 1.49 | 1.000 | +0.004 (0.21) | no |
| sd 4h break 2R +MSNR | 3,549 | -0.023 (-0.95) | -0.088 | 3,963 | -0.050 (-2.13) | -0.125 | 0.08 / -0.48 | 1.000 | +0.012 (0.56) | no |
| sd 4h box 1R +MSNR | 2,596 | -0.017 (-0.78) | -0.062 | 2,762 | -0.036 (-1.90) | -0.089 | 0.25 / -0.68 | 1.000 | +0.033 (1.74) | no |
| sd 4h box 2R +MSNR | 2,596 | -0.014 (-0.49) | -0.059 | 2,762 | -0.051 (-2.18) | -0.104 | 0.03 / -0.92 | 1.000 | +0.034 (1.37) | no |
| none 1d break 1R +MSNR | 30,282 | -0.007 (-0.93) | -0.044 | 35,712 | -0.017 (-2.59) | -0.061 | control | 1.000 | +0.015 (2.27) | no |
| none 1d break 2R +MSNR | 30,282 | +0.005 (0.39) | -0.032 | 35,712 | -0.019 (-1.95) | -0.063 | control | 1.000 | +0.022 (2.11) | no |
| none 1d box 1R +MSNR | 19,019 | -0.007 (-0.74) | -0.031 | 22,203 | -0.018 (-2.26) | -0.048 | control | 1.000 | +0.017 (2.11) | no |
| none 1d box 2R +MSNR | 19,019 | +0.004 (0.29) | -0.019 | 22,203 | -0.010 (-0.93) | -0.040 | control | 1.000 | +0.031 (2.88) | no |
| none 4h break 1R +MSNR | 117,506 | -0.027 (-5.41) | -0.103 | 139,742 | -0.031 (-7.68) | -0.119 | control | 1.000 | +0.027 (6.64) | no |
| none 4h break 2R +MSNR | 117,506 | -0.025 (-3.08) | -0.101 | 139,742 | -0.040 (-6.06) | -0.128 | control | 1.000 | +0.029 (4.70) | no |
| none 4h box 1R +MSNR | 70,494 | -0.021 (-3.57) | -0.072 | 84,303 | -0.024 (-4.90) | -0.086 | control | 1.000 | +0.021 (4.29) | no |
| none 4h box 2R +MSNR | 70,494 | -0.015 (-1.57) | -0.065 | 84,303 | -0.030 (-3.79) | -0.092 | control | 1.000 | +0.026 (3.57) | no |

## Checks

- Cut test: 20 cuts on xau, eurusd, usdjpy, nzdusd: 1,522,293 signals known by the cut dates, 0 missing or extra when the candles are cut there.
- Every trade has its stop on the losing side of the fill (the run throws otherwise); fills at or past the stop and trades whose risk is under the round-trip cost are no trades (same for every cell).
- Exclusions: the data-quality audit's bad intervals (`combo-grid-2` `exclusions`).

| Market | candles from | signals | simulated | dropped (bad data) | past the stop | risk under cost |
|---|---|---:|---:|---:|---:|---:|
| xau | 2006-03-19 | 131,702 | 129,186 | 8 | 32 | 41 |
| xag | 2006-03-19 | 131,077 | 123,211 | 264 | 43 | 5,079 |
| eurusd | 2004-01-01 | 147,632 | 144,869 | 55 | 36 | 11 |
| gbpusd | 2004-01-01 | 147,751 | 144,873 | 132 | 37 | 6 |
| usdjpy | 2004-01-01 | 146,703 | 143,729 | 98 | 62 | 8 |
| audusd | 2004-01-01 | 154,032 | 151,209 | 112 | 45 | 8 |
| nzdusd | 2004-01-01 | 152,480 | 149,562 | 4 | 87 | 12 |
| usdcad | 2004-01-01 | 149,899 | 146,793 | 119 | 19 | 9 |
| usdchf | 2004-01-01 | 146,036 | 143,120 | 121 | 63 | 24 |
| eurjpy | 2004-01-01 | 146,811 | 143,894 | 9 | 65 | 7 |

## What it means

No core family, read this simply, beats its own control on ten markets over 22 years. With this many trades a real
tilt of a few hundredths of an R would have shown: the level families do not pick better triggers than the triggers alone.
Do not re-test variants of these 96 cells on these years. Nothing live changed; no rule is proposed.

**The placebo.** 10 side-flipped cells clear bars 1-3, mostly the H4 (M15-trigger) controls. With a 1R exit the
flipped trade is the mirror of the real one (its stop is the real target, its target the real stop), so this says only that
the real trades lose a few hundredths of an R before costs: buying the next 5-minute open after an M15 break or box
close-out gives some of it back. It is not a fade rule: after costs the flipped trades lose too (none 4h break 1R flipped:
+0.026R before costs, t 10.80; -0.063R after costs, t -22.01, n 277,873 in 2015-26).
The pre-registration expected about nothing here; it is reported as found, and it is not a candidate (a placebo is not a rule).
