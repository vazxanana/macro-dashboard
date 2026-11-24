# Fair-value gap plus: wider room and a structure side, after costs (result)

**Verdict: FAIL. 0 of 36 cells pass after costs on the ten markets; the best, 1d wide none 1R, made +0.002R a trade after costs in 2015-26 (n 5,315, month t 0.12) and +0.005R on eight unread markets (n 8,164, t 0.39).**

Run 24 Nov 2026 as pre-registered (`PREREGISTRATION.md`, committed and pushed alone first). Research only: nothing live
changed, nothing is proposed. One run, no variants.

## What was run

`grid7-fvg-wide`'s passing entry (market at the next 5-minute open after the first M15 close back inside a fair-value gap)
on 1h, 4h and 1d gaps; stop past the gap's far side by 0.1 ATR ("gap") or 1 ATR ("wide") of the gap's timeframe; every
gap, or only when the structure side of the gap's timeframe ("tf") or of the timeframe above ("up") agrees; 1R or 2R.
Stage 1 on the ten markets `grid7-fvg-wide` read (so a pass there is selection), **judged after costs**; stage 2 once on
eight markets no gap study had read (nas100, spx500, de40, gbpjpy, audjpy, cadjpy, eurgbp, euraud), 2005 to October 2026.
Costs: the demo figures for xau, eurusd, gbpusd, usdjpy, audusd; **ASSUMED, not measured** for every other market, all of stage 2.

## Stage 1 (ten markets, after costs)

- Passing all three checks: 0.
- Best on the weaker window: 1d wide none 1R (net +0.013R, t 0.79 in 2005-14; +0.002R, t 0.12 in 2015-26).

| Cell | n 05-14 | gross 05-14 | net 05-14 (t) | n 15-26 | gross 15-26 (t) | net 15-26 (t) | Holm | Pass |
|---|---:|---:|---:|---:|---:|---:|---:|---|
| 1h gap none 1R | 67,077 | +0.024 | -0.151 (-28.52) | 78,970 | +0.020 (5.10) | -0.183 (-35.80) | 1.000 | no |
| 1h gap none 2R | 67,077 | +0.055 | -0.120 (-17.44) | 78,970 | +0.046 (8.23) | -0.157 (-25.75) | 1.000 | no |
| 1h gap tf 1R | 43,141 | +0.030 | -0.141 (-21.75) | 50,552 | +0.020 (3.84) | -0.178 (-28.76) | 1.000 | no |
| 1h gap tf 2R | 43,141 | +0.060 | -0.111 (-12.53) | 50,552 | +0.043 (5.81) | -0.156 (-19.93) | 1.000 | no |
| 1h gap up 1R | 39,872 | +0.027 | -0.142 (-21.50) | 46,549 | +0.022 (4.04) | -0.174 (-28.66) | 1.000 | no |
| 1h gap up 2R | 39,872 | +0.053 | -0.116 (-13.12) | 46,549 | +0.049 (6.63) | -0.147 (-19.03) | 1.000 | no |
| 1h wide none 1R | 70,504 | +0.032 | -0.025 (-6.86) | 82,986 | +0.033 (9.10) | -0.031 (-7.33) | 1.000 | no |
| 1h wide none 2R | 70,504 | +0.034 | -0.023 (-4.25) | 82,986 | +0.032 (5.66) | -0.033 (-5.58) | 1.000 | no |
| 1h wide tf 1R | 45,252 | +0.036 | -0.022 (-4.16) | 53,067 | +0.026 (4.44) | -0.038 (-5.95) | 1.000 | no |
| 1h wide tf 2R | 45,252 | +0.030 | -0.027 (-3.34) | 53,067 | +0.025 (2.86) | -0.039 (-4.21) | 1.000 | no |
| 1h wide up 1R | 41,727 | +0.026 | -0.029 (-5.10) | 48,782 | +0.032 (5.30) | -0.031 (-4.81) | 1.000 | no |
| 1h wide up 2R | 41,727 | +0.026 | -0.030 (-3.27) | 48,782 | +0.031 (3.09) | -0.033 (-3.26) | 1.000 | no |
| 4h gap none 1R | 22,084 | +0.051 | -0.046 (-5.48) | 27,052 | +0.036 (5.55) | -0.075 (-10.68) | 1.000 | no |
| 4h gap none 2R | 22,084 | +0.051 | -0.045 (-3.85) | 27,052 | +0.051 (5.05) | -0.059 (-5.63) | 1.000 | no |
| 4h gap tf 1R | 14,868 | +0.052 | -0.041 (-4.06) | 17,812 | +0.041 (4.83) | -0.063 (-7.20) | 1.000 | no |
| 4h gap tf 2R | 14,868 | +0.045 | -0.048 (-3.33) | 17,812 | +0.056 (4.29) | -0.049 (-3.66) | 1.000 | no |
| 4h gap up 1R | 12,716 | +0.058 | -0.038 (-3.37) | 15,228 | +0.028 (2.90) | -0.080 (-7.89) | 1.000 | no |
| 4h gap up 2R | 12,716 | +0.055 | -0.041 (-2.66) | 15,228 | +0.036 (2.57) | -0.072 (-5.09) | 1.000 | no |
| 4h wide none 1R | 22,398 | +0.019 | -0.007 (-0.93) | 27,530 | +0.022 (3.20) | -0.010 (-1.44) | 1.000 | no |
| 4h wide none 2R | 22,398 | +0.030 | +0.004 (0.40) | 27,530 | +0.027 (2.78) | -0.004 (-0.43) | 1.000 | no |
| 4h wide tf 1R | 15,058 | +0.011 | -0.015 (-1.41) | 18,112 | +0.016 (1.72) | -0.015 (-1.56) | 1.000 | no |
| 4h wide tf 2R | 15,058 | +0.017 | -0.009 (-0.60) | 18,112 | +0.019 (1.41) | -0.011 (-0.82) | 1.000 | no |
| 4h wide up 1R | 12,870 | +0.019 | -0.006 (-0.53) | 15,478 | +0.011 (1.00) | -0.020 (-1.82) | 1.000 | no |
| 4h wide up 2R | 12,870 | +0.015 | -0.011 (-0.56) | 15,478 | -0.003 (-0.20) | -0.034 (-2.11) | 1.000 | no |
| 1d gap none 1R | 4,497 | +0.015 | -0.027 (-1.72) | 5,315 | +0.052 (3.46) | +0.002 (0.13) | 1.000 | no |
| 1d gap none 2R | 4,497 | +0.020 | -0.021 (-0.96) | 5,315 | +0.044 (2.23) | -0.006 (-0.30) | 1.000 | no |
| 1d gap tf 1R | 2,993 | +0.015 | -0.026 (-1.19) | 3,523 | +0.034 (1.78) | -0.015 (-0.77) | 1.000 | no |
| 1d gap tf 2R | 2,993 | -0.002 | -0.043 (-1.42) | 3,523 | +0.010 (0.41) | -0.038 (-1.50) | 1.000 | no |
| 1d gap up 1R | 2,643 | +0.035 | -0.007 (-0.34) | 3,055 | +0.068 (3.28) | +0.018 (0.88) | 1.000 | no |
| 1d gap up 2R | 2,643 | +0.036 | -0.006 (-0.18) | 3,055 | +0.043 (1.47) | -0.007 (-0.23) | 1.000 | no |
| 1d wide none 1R | 4,498 | +0.023 | +0.013 (0.79) | 5,315 | +0.013 (0.93) | +0.002 (0.12) | 1.000 | no |
| 1d wide none 2R | 4,498 | +0.028 | +0.018 (0.91) | 5,315 | +0.001 (0.09) | -0.010 (-0.59) | 1.000 | no |
| 1d wide tf 1R | 2,994 | +0.003 | -0.007 (-0.28) | 3,521 | -0.024 (-1.16) | -0.036 (-1.70) | 1.000 | no |
| 1d wide tf 2R | 2,994 | +0.007 | -0.003 (-0.11) | 3,521 | -0.040 (-1.61) | -0.051 (-2.07) | 1.000 | no |
| 1d wide up 1R | 2,643 | +0.014 | +0.004 (0.15) | 3,056 | +0.002 (0.09) | -0.010 (-0.43) | 1.000 | no |
| 1d wide up 2R | 2,643 | +0.027 | +0.017 (0.52) | 3,056 | -0.015 (-0.54) | -0.027 (-0.96) | 1.000 | no |

## Stage 2 (eight unread markets, 2005-2026, after costs)

No cell passed stage 1; the best one is reported and cannot pass:

| Cell | n | gross R (t) | net R (t) | Holm | Pass |
|---|---:|---:|---:|---:|---|
| 1d wide none 1R | 8,164 | +0.015 (1.27) | +0.005 (0.39) | 0.347 | no |

Per market, 1d wide none 1R:

| Market | n | gross R (t) | net R (t) |
|---|---:|---:|---:|
| nas100 | 1,047 | +0.048 (1.85) | +0.035 (1.33) |
| spx500 | 1,063 | +0.043 (1.64) | +0.030 (1.16) |
| de40 | 1,152 | -0.021 (-0.77) | -0.029 (-1.08) |
| gbpjpy | 1,004 | -0.000 (-0.01) | -0.007 (-0.27) |
| audjpy | 1,007 | +0.011 (0.45) | +0.003 (0.11) |
| cadjpy | 1,000 | -0.002 (-0.09) | -0.011 (-0.41) |
| eurgbp | 941 | +0.001 (0.05) | -0.012 (-0.45) |
| euraud | 950 | +0.038 (1.36) | +0.030 (1.07) |

## Checks

- Cut test: 10 cuts: 111,092 entries known by the cut dates, 0 missing or extra on cut candles.
- Every trade has its stop on the losing side of its fill (the run throws otherwise).

| Market | candles from | entries | simulated | dropped | past the stop | risk under cost |
|---|---|---:|---:|---:|---:|---:|
| xau | 2006-03-19 | 19,254 | 37,883 | 2 | 41 | 580 |
| xag | 2006-03-19 | 20,137 | 33,270 | 44 | 64 | 6,852 |
| eurusd | 2004-01-01 | 22,270 | 43,519 | 7 | 30 | 51 |
| gbpusd | 2004-01-01 | 21,883 | 42,652 | 8 | 33 | 41 |
| usdjpy | 2004-01-01 | 21,806 | 42,396 | 9 | 25 | 143 |
| audusd | 2004-01-01 | 23,659 | 46,170 | 16 | 34 | 100 |
| nzdusd | 2004-01-01 | 22,908 | 44,658 | 4 | 58 | 114 |
| usdcad | 2004-01-01 | 22,012 | 42,977 | 18 | 32 | 69 |
| usdchf | 2004-01-01 | 21,665 | 42,166 | 16 | 33 | 169 |
| eurjpy | 2004-01-01 | 21,867 | 42,612 | 1 | 24 | 74 |
| nas100 | 2004-01-02 | 24,898 | 45,482 | 0 | 105 | 1,861 |
| spx500 | 2004-01-02 | 25,541 | 47,413 | 0 | 270 | 1,339 |
| de40 | 2004-01-02 | 18,759 | 35,891 | 0 | 78 | 55 |
| gbpjpy | 2004-01-01 | 20,597 | 40,187 | 0 | 18 | 35 |
| audjpy | 2004-05-31 | 21,551 | 42,414 | 0 | 32 | 92 |
| cadjpy | 2004-05-31 | 21,757 | 42,850 | 0 | 21 | 129 |
| eurgbp | 2004-01-01 | 19,783 | 37,819 | 0 | 40 | 737 |
| euraud | 2004-05-31 | 20,726 | 40,785 | 1 | 25 | 86 |

## What it means

Giving the gap entry more room and a structure side does not make it pay after costs in a way that holds on markets it was not chosen on. Do not re-test variants of these cells on these years. Nothing live changed; no rule is proposed.
