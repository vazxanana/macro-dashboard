# The flip: broken supply / demand and engulf zones traded the other way (result)

**Verdict: FAIL. 0 of 56 cells pass; the best confirmation cell, both near 4h close 1R, made +0.034R a trade before costs in 2015-26 (n 18,515, month t 3.91; discovery +0.041R, t 4.42).**

Run 23 Nov 2026 as pre-registered (`PREREGISTRATION.md`, committed and pushed alone first). Research only: nothing live
changed, nothing is proposed. One run, no variants.

## What was run

Fresh supply / demand zones (`grid5-sd-eg`) and engulf zones (3-candle span) on the Daily and H4 chart. A zone closed through
on its own timeframe is traded the other way on its first return (from the side it was broken to), on the timeframe two steps
lower (Daily -> H1, H4 -> M15): (a) at the first close inside the zone, or (b) at the first structure break of the flipped side,
within 24 candles; market at the next 5-minute open, stop past the zone's far side + 0.1 ATR(14) of the zone timeframe, 1R or
2R (time limit 2 days / 1 day). Ten markets pooled, OANDA mid 5-minute candles; discovery 2005-2014, confirmation 2015 to
October 2026. Costs after the fact only; **ASSUMED, not measured** for xag, nzdusd, usdcad, usdchf, eurjpy.

Controls: (1) **unbroken**: the same zones' ordinary first touch before any break, traded with their own side, same entries and
exits; (2) **random band**: per flip, a band of the zone's width on the same side of price at 0.5-2.0 times the flipped zone's
distance from the break candle's close, traded exactly as the flipped zone. The random band carries the flip's distance and
body values; its MSNR condition is read at its own trigger (the same condition as the cell). Its distance is the excursion beyond
the flipped zone's broken edge measured up to the band's own return (see Checks).

## The bar, cell by cell

- n >= 300 in both windows: 56 of 56.
- Mean R > 0 and month t >= 2 in discovery: 12; in confirmation: 10; both: 10.
- Holm-adjusted p < 0.05 over the 56 confirmation tests: 5.
- Beats the unbroken control (Welch t >= 2 in both windows): 3; beats the random band: 0.
- **All: 0.**
- Side-flipped placebo passing bars 1-3: 0.

## Every cell

R a trade before costs (month-sum t), after costs beside; Welch t of the cell against the unbroken control and the random band
(discovery / confirmation); Holm on the confirmation test.

| Cell | n 05-14 | R 05-14 (t) | net 05-14 | n 15-26 | R 15-26 (t) | net 15-26 | unbroken R 15-26 | random R 15-26 | vs unbroken | vs random | Holm | Placebo R 15-26 (t) | Pass |
|---|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|---|
| sd all 1d close 1R | 977 | +0.030 (1.22) | +0.019 | 1,255 | +0.007 (0.30) | -0.008 | -0.008 (n 1,634) | -0.012 (n 1,244) | 2.52 / 0.59 | -0.04 / 0.71 | 1.000 | -0.007 (-0.30) | no |
| sd all 1d close 2R | 977 | +0.031 (1.19) | +0.020 | 1,255 | +0.015 (0.61) | +0.000 | -0.010 (n 1,634) | -0.003 (n 1,244) | 2.28 / 0.92 | 0.20 / 0.61 | 1.000 | +0.008 (0.29) | no |
| sd all 1d break 1R | 757 | +0.010 (0.47) | +0.001 | 977 | -0.031 (-1.76) | -0.042 | -0.041 (n 1,252) | -0.003 (n 944) | 0.36 / 0.45 | -0.29 / -1.13 | 1.000 | +0.031 (1.76) | no |
| sd all 1d break 2R | 757 | +0.011 (0.42) | +0.002 | 977 | -0.032 (-1.70) | -0.044 | -0.042 (n 1,252) | -0.012 (n 944) | 0.53 / 0.40 | -0.25 / -0.78 | 1.000 | +0.033 (1.60) | no |
| sd all 4h close 1R | 6,492 | +0.030 (2.72) | -0.001 | 7,441 | +0.023 (2.23) | -0.017 | -0.005 (n 10,365) | +0.017 (n 7,345) | 3.71 / 2.10 | 0.23 / 0.38 | 0.651 | -0.026 (-2.58) | no |
| sd all 4h close 2R | 6,492 | +0.033 (2.24) | +0.001 | 7,441 | +0.022 (1.61) | -0.017 | -0.009 (n 10,365) | +0.024 (n 7,345) | 2.22 / 1.93 | 0.50 / -0.08 | 1.000 | -0.031 (-2.42) | no |
| sd all 4h break 1R | 4,800 | -0.023 (-1.70) | -0.044 | 5,314 | +0.000 (0.04) | -0.027 | -0.003 (n 7,380) | -0.006 (n 5,199) | -1.05 / 0.25 | 0.07 / 0.41 | 1.000 | -0.000 (-0.04) | no |
| sd all 4h break 2R | 4,800 | -0.019 (-1.25) | -0.041 | 5,314 | -0.004 (-0.32) | -0.031 | -0.000 (n 7,380) | -0.008 (n 5,199) | -0.79 / -0.23 | 0.09 / 0.23 | 1.000 | -0.002 (-0.15) | no |
| eg all 1d close 1R | 3,903 | +0.007 (0.50) | -0.010 | 5,075 | +0.017 (1.15) | -0.004 | -0.010 (n 6,613) | +0.000 (n 4,927) | 0.98 / 1.85 | -0.12 / 1.09 | 1.000 | -0.018 (-1.18) | no |
| eg all 1d close 2R | 3,903 | +0.004 (0.21) | -0.014 | 5,075 | +0.004 (0.23) | -0.017 | -0.002 (n 6,613) | -0.009 (n 4,927) | 0.29 / 0.36 | 0.05 / 0.71 | 1.000 | -0.015 (-0.92) | no |
| eg all 1d break 1R | 2,775 | -0.016 (-1.22) | -0.028 | 3,537 | -0.037 (-2.95) | -0.052 | -0.008 (n 5,019) | -0.028 (n 3,494) | -1.74 / -2.01 | 0.19 / -0.57 | 1.000 | +0.037 (2.95) | no |
| eg all 1d break 2R | 2,775 | -0.012 (-0.74) | -0.024 | 3,537 | -0.027 (-2.02) | -0.042 | -0.004 (n 5,019) | -0.021 (n 3,494) | -1.90 / -1.49 | -0.04 / -0.38 | 1.000 | +0.030 (2.14) | no |
| eg all 4h close 1R | 23,803 | +0.031 (4.63) | -0.030 | 28,966 | +0.023 (3.39) | -0.049 | +0.014 (n 39,050) | +0.022 (n 28,451) | 1.04 / 1.23 | -0.09 / 0.15 | 0.024 | -0.031 (-4.48) | no |
| eg all 4h close 2R | 23,803 | +0.032 (3.60) | -0.029 | 28,966 | +0.031 (3.67) | -0.041 | +0.014 (n 39,050) | +0.026 (n 28,451) | 1.13 / 1.76 | -0.29 / 0.55 | 0.009 | -0.035 (-3.76) | no |
| eg all 4h break 1R | 15,766 | -0.008 (-1.12) | -0.042 | 18,868 | -0.005 (-0.66) | -0.047 | -0.010 (n 28,246) | -0.003 (n 18,468) | -0.11 / 0.67 | 1.22 / -0.17 | 1.000 | +0.003 (0.36) | no |
| eg all 4h break 2R | 15,766 | +0.002 (0.17) | -0.033 | 18,868 | -0.003 (-0.33) | -0.045 | -0.010 (n 28,246) | +0.001 (n 18,468) | 0.07 / 0.63 | 1.33 / -0.38 | 1.000 | +0.005 (0.52) | no |
| both near 1d close 1R | 2,842 | +0.017 (0.99) | +0.002 | 3,494 | +0.030 (1.65) | +0.011 | -0.007 (n 7,587) | +0.016 (n 3,472) | 1.73 / 2.39 | -0.36 / 0.78 | 1.000 | -0.030 (-1.65) | no |
| both near 1d close 2R | 2,842 | +0.012 (0.64) | -0.002 | 3,494 | +0.030 (1.38) | +0.011 | -0.000 (n 7,587) | +0.017 (n 3,472) | 1.05 / 1.70 | -0.32 / 0.61 | 1.000 | -0.029 (-1.46) | no |
| both near 1d break 1R | 2,029 | -0.013 (-0.83) | -0.024 | 2,534 | -0.016 (-1.04) | -0.031 | -0.011 (n 5,654) | -0.015 (n 2,489) | -1.38 / -0.35 | -0.31 / -0.10 | 1.000 | +0.016 (1.04) | no |
| both near 1d break 2R | 2,029 | -0.008 (-0.39) | -0.018 | 2,534 | -0.009 (-0.54) | -0.023 | -0.006 (n 5,654) | -0.012 (n 2,489) | -1.37 / -0.20 | -0.33 / 0.17 | 1.000 | +0.005 (0.29) | no |
| both near 4h close 1R | 15,117 | +0.041 (4.42) | -0.011 | 18,515 | +0.034 (3.91) | -0.029 | +0.010 (n 45,669) | +0.029 (n 18,230) | 3.06 / 2.92 | 0.50 / 0.53 | 0.004 | -0.038 (-4.39) | no |
| both near 4h close 2R | 15,117 | +0.045 (3.60) | -0.007 | 18,515 | +0.044 (3.73) | -0.019 | +0.008 (n 45,669) | +0.032 (n 18,230) | 2.70 / 3.33 | -0.05 / 0.89 | 0.008 | -0.044 (-3.67) | no |
| both near 4h break 1R | 10,360 | -0.001 (-0.09) | -0.033 | 12,731 | +0.004 (0.38) | -0.035 | -0.010 (n 32,097) | +0.001 (n 12,308) | 0.82 / 1.51 | 0.72 / 0.25 | 1.000 | -0.005 (-0.55) | no |
| both near 4h break 2R | 10,360 | +0.005 (0.40) | -0.026 | 12,731 | +0.007 (0.53) | -0.032 | -0.008 (n 32,097) | +0.006 (n 12,308) | 0.46 / 1.34 | 0.83 / 0.02 | 1.000 | -0.009 (-0.74) | no |
| both far 1d close 1R | 1,560 | -0.006 (-0.27) | -0.026 | 2,174 | -0.014 (-0.68) | -0.035 | -0.007 (n 7,587) | -0.027 (n 2,339) | 0.29 / -0.38 | -0.14 / 0.56 | 1.000 | +0.013 (0.63) | no |
| both far 1d close 2R | 1,560 | -0.007 (-0.27) | -0.027 | 2,174 | -0.044 (-1.88) | -0.065 | -0.000 (n 7,587) | -0.048 (n 2,339) | 0.04 / -2.05 | 0.37 / 0.13 | 1.000 | +0.015 (0.60) | no |
| both far 1d break 1R | 1,004 | -0.020 (-0.96) | -0.032 | 1,333 | -0.071 (-4.15) | -0.085 | -0.011 (n 5,654) | -0.044 (n 1,467) | -1.36 / -3.19 | 0.20 / -1.15 | 1.000 | +0.071 (4.15) | no |
| both far 1d break 2R | 1,004 | -0.023 (-1.05) | -0.036 | 1,333 | -0.060 (-2.99) | -0.073 | -0.006 (n 5,654) | -0.032 (n 1,467) | -1.70 / -2.56 | -0.23 / -1.05 | 1.000 | +0.072 (3.54) | no |
| both far 4h close 1R | 12,228 | +0.017 (1.69) | -0.042 | 14,346 | +0.010 (0.98) | -0.061 | +0.010 (n 45,669) | +0.017 (n 15,371) | 0.38 / -0.05 | -0.47 / -0.63 | 1.000 | -0.020 (-2.02) | no |
| both far 4h close 2R | 12,228 | +0.017 (1.27) | -0.042 | 14,346 | +0.012 (1.02) | -0.058 | +0.008 (n 45,669) | +0.019 (n 15,371) | 0.27 / 0.38 | -0.10 / -0.47 | 1.000 | -0.018 (-1.37) | no |
| both far 4h break 1R | 7,225 | -0.017 (-1.72) | -0.047 | 7,981 | -0.018 (-1.72) | -0.055 | -0.010 (n 32,097) | -0.007 (n 8,540) | -0.67 / -0.73 | 0.27 / -0.82 | 1.000 | +0.016 (1.57) | no |
| both far 4h break 2R | 7,225 | +0.000 (0.04) | -0.030 | 7,981 | -0.021 (-1.61) | -0.058 | -0.008 (n 32,097) | -0.005 (n 8,540) | 0.05 / -0.99 | 0.54 / -0.98 | 1.000 | +0.024 (2.05) | no |
| both small 1d close 1R | 2,722 | +0.001 (0.03) | -0.015 | 3,351 | +0.018 (1.05) | -0.002 | -0.007 (n 7,587) | +0.004 (n 3,408) | 0.74 / 1.57 | -0.40 / 0.78 | 1.000 | -0.018 (-1.05) | no |
| both small 1d close 2R | 2,722 | -0.008 (-0.42) | -0.023 | 3,351 | +0.007 (0.36) | -0.012 | -0.000 (n 7,587) | -0.004 (n 3,408) | -0.02 / 0.41 | -0.58 / 0.54 | 1.000 | -0.015 (-0.77) | no |
| both small 1d break 1R | 1,906 | -0.017 (-1.04) | -0.027 | 2,405 | -0.027 (-1.85) | -0.041 | -0.011 (n 5,654) | -0.021 (n 2,440) | -1.54 / -1.03 | -0.43 / -0.30 | 1.000 | +0.027 (1.85) | no |
| both small 1d break 2R | 1,906 | -0.008 (-0.46) | -0.019 | 2,405 | -0.018 (-1.18) | -0.032 | -0.006 (n 5,654) | -0.017 (n 2,440) | -1.38 / -0.75 | -0.36 / -0.05 | 1.000 | +0.015 (0.95) | no |
| both small 4h close 1R | 13,960 | +0.026 (2.81) | -0.028 | 17,224 | +0.020 (2.59) | -0.046 | +0.010 (n 45,669) | +0.021 (n 17,496) | 1.35 / 1.22 | 0.21 / -0.09 | 0.261 | -0.026 (-3.25) | no |
| both small 4h close 2R | 13,960 | +0.028 (2.31) | -0.025 | 17,224 | +0.035 (3.29) | -0.032 | +0.008 (n 45,669) | +0.025 (n 17,496) | 1.24 / 2.46 | -0.35 / 0.78 | 0.033 | -0.036 (-3.31) | no |
| both small 4h break 1R | 9,394 | -0.011 (-1.11) | -0.043 | 11,523 | -0.009 (-1.03) | -0.049 | -0.010 (n 32,097) | -0.006 (n 11,472) | -0.20 / 0.07 | 0.19 / -0.32 | 1.000 | +0.008 (0.85) | no |
| both small 4h break 2R | 9,394 | +0.001 (0.10) | -0.031 | 11,523 | -0.009 (-0.77) | -0.049 | -0.008 (n 32,097) | +0.001 (n 11,472) | 0.13 / -0.07 | 0.59 / -0.68 | 1.000 | +0.003 (0.30) | no |
| both big 1d close 1R | 1,680 | +0.022 (1.01) | +0.004 | 2,317 | +0.007 (0.31) | -0.014 | -0.007 (n 7,587) | -0.008 (n 2,403) | 1.66 / 0.75 | -0.02 / 0.66 | 1.000 | -0.008 (-0.34) | no |
| both big 1d close 2R | 1,680 | +0.028 (1.07) | +0.009 | 2,317 | -0.006 (-0.24) | -0.027 | -0.000 (n 7,587) | -0.015 (n 2,403) | 1.47 / -0.27 | 0.75 / 0.33 | 1.000 | -0.007 (-0.28) | no |
| both big 1d break 1R | 1,127 | -0.013 (-0.70) | -0.026 | 1,462 | -0.049 (-2.61) | -0.064 | -0.011 (n 5,654) | -0.032 (n 1,516) | -1.14 / -2.04 | 0.38 / -0.72 | 1.000 | +0.049 (2.61) | no |
| both big 1d break 2R | 1,127 | -0.020 (-0.85) | -0.033 | 1,462 | -0.040 (-1.88) | -0.054 | -0.006 (n 5,654) | -0.023 (n 1,516) | -1.64 / -1.65 | -0.14 / -0.64 | 1.000 | +0.050 (2.34) | no |
| both big 4h close 1R | 13,385 | +0.035 (3.43) | -0.022 | 15,637 | +0.027 (2.70) | -0.039 | +0.010 (n 45,669) | +0.026 (n 16,105) | 2.27 / 1.90 | -0.08 / 0.12 | 0.194 | -0.035 (-3.56) | no |
| both big 4h close 2R | 13,385 | +0.037 (2.91) | -0.019 | 15,637 | +0.024 (1.94) | -0.041 | +0.008 (n 45,669) | +0.028 (n 16,105) | 1.89 / 1.44 | 0.28 / -0.26 | 1.000 | -0.029 (-2.22) | no |
| both big 4h break 1R | 8,191 | -0.003 (-0.32) | -0.033 | 9,189 | +0.001 (0.15) | -0.036 | -0.010 (n 32,097) | +0.002 (n 9,376) | 0.58 / 1.14 | 0.91 / -0.03 | 1.000 | -0.003 (-0.31) | no |
| both big 4h break 2R | 8,191 | +0.006 (0.50) | -0.024 | 9,189 | +0.002 (0.21) | -0.035 | -0.008 (n 32,097) | +0.003 (n 9,376) | 0.45 / 0.87 | 0.83 / -0.03 | 1.000 | +0.005 (0.41) | no |
| both msnr 1d close 1R | 2,684 | +0.009 (0.46) | -0.008 | 3,523 | +0.008 (0.42) | -0.013 | -0.011 (n 4,006) | -0.011 (n 3,586) | 1.74 / 1.08 | -0.08 / 1.02 | 1.000 | -0.008 (-0.42) | no |
| both msnr 1d close 2R | 2,684 | +0.007 (0.34) | -0.009 | 3,523 | -0.003 (-0.14) | -0.023 | -0.009 (n 4,006) | -0.017 (n 3,586) | 1.24 / 0.32 | 0.32 / 0.65 | 1.000 | -0.007 (-0.35) | no |
| both msnr 1d break 1R | 1,833 | -0.028 (-1.68) | -0.039 | 2,412 | -0.040 (-2.68) | -0.054 | -0.023 (n 2,909) | -0.024 (n 2,420) | -1.50 / -0.97 | 0.25 / -0.90 | 1.000 | +0.040 (2.68) | no |
| both msnr 1d break 2R | 1,833 | -0.022 (-1.19) | -0.033 | 2,412 | -0.036 (-2.19) | -0.050 | -0.019 (n 2,909) | -0.020 (n 2,420) | -1.61 / -0.91 | 0.26 / -0.79 | 1.000 | +0.034 (2.10) | no |
| both msnr 4h close 1R | 13,397 | +0.029 (2.96) | -0.026 | 16,479 | +0.021 (2.19) | -0.046 | +0.004 (n 23,520) | +0.026 (n 16,918) | 2.33 / 1.71 | -0.07 / -0.48 | 0.717 | -0.028 (-2.98) | no |
| both msnr 4h close 2R | 13,397 | +0.033 (2.64) | -0.022 | 16,479 | +0.037 (3.02) | -0.030 | -0.007 (n 23,520) | +0.040 (n 16,918) | 1.71 / 3.48 | -0.07 / -0.21 | 0.076 | -0.025 (-1.95) | no |
| both msnr 4h break 1R | 8,696 | -0.007 (-0.70) | -0.037 | 10,441 | -0.001 (-0.06) | -0.039 | -0.023 (n 16,520) | +0.008 (n 10,492) | 0.46 / 2.08 | -0.07 / -0.73 | 1.000 | -0.002 (-0.17) | no |
| both msnr 4h break 2R | 8,696 | +0.007 (0.56) | -0.024 | 10,441 | +0.004 (0.32) | -0.034 | -0.024 (n 16,520) | +0.016 (n 10,492) | 1.01 / 2.15 | 0.60 / -0.81 | 1.000 | -0.002 (-0.17) | no |

## Checks

- Cut test: 50 cuts on xau, xag, eurusd, gbpusd, usdjpy, audusd, nzdusd, usdcad, usdchf, eurjpy: 1,266,973 signals (real, unbroken and random) known by the cut dates, 0 missing or extra when the candles are cut there.
- One change made before the report was read, because the cut test caught it: the first run gave a random band the real zone's distance value, which is only known at the real zone's return and can come after the band's trigger (a few signals in 3 of 50 cuts differed). The band now measures the same excursion up to its own return; the real flips are unchanged.
- Every trade has its stop on the losing side of the fill (the run throws otherwise); fills at or past the stop and trades whose risk is under the round-trip cost are no trades (every stream alike).
- Exclusions: the data-quality audit's bad intervals (`combo-grid-2` `exclusions`).

| Market | candles from | flip / unbroken / random signals | simulated | dropped (bad data) | past the stop | risk under cost |
|---|---|---:|---:|---:|---:|---:|
| xau | 2006-03-19 | 12,997 / 17,059 / 12,668 | 40,265 | 0 | 51 | 23 |
| xag | 2006-03-19 | 13,383 / 17,243 / 13,019 | 39,954 | 84 | 74 | 1,008 |
| eurusd | 2004-01-01 | 14,697 / 19,068 / 14,411 | 45,279 | 19 | 75 | 7 |
| gbpusd | 2004-01-01 | 14,807 / 18,879 / 14,568 | 45,504 | 26 | 80 | 9 |
| usdjpy | 2004-01-01 | 14,319 / 18,498 / 14,140 | 43,922 | 18 | 70 | 5 |
| audusd | 2004-01-01 | 15,323 / 19,043 / 15,131 | 46,540 | 37 | 48 | 7 |
| nzdusd | 2004-01-01 | 14,968 / 18,727 / 14,686 | 45,453 | 0 | 40 | 5 |
| usdcad | 2004-01-01 | 15,365 / 19,389 / 15,071 | 46,628 | 39 | 56 | 7 |
| usdchf | 2004-01-01 | 14,810 / 18,786 / 14,440 | 44,883 | 50 | 82 | 8 |
| eurjpy | 2004-01-01 | 14,681 / 18,310 / 14,354 | 44,317 | 5 | 70 | 6 |

## What it means

No flip cell clears the bar: trading a broken supply / demand or engulf zone the other way on its first return does not
pick trades that beat the same zones touched before any break, or a random band at a matched distance, in both windows.
Do not re-test variants of these 56 cells on these years. Nothing live changed; no rule is proposed.

**Where the tilt is.** 10 cells are positive before costs in both windows, all on H4 zones with
the close-inside entry (best both near 4h close 1R: +0.041R / +0.034R a trade, month t 4.42 / 3.91). Some beat the
unbroken first touch, but a random band at a matched distance on the same side of price does about as well (+0.029R in
2015-26, Welch t 0.50 / 0.53): the tilt belongs to buying (selling) a pull-back into ANY level near a break, the
short-term pull-back the day's other studies found, not to the flipped zone. After costs it loses (-0.029R a trade in 2015-26).
