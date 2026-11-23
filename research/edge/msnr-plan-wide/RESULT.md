# The MSNR plan with market entries on ten markets (result)

**Verdict: FAIL. 0 of 54 cells pass; the best confirmation cell, market QM pips-stop 3R, made +0.001R a trade before costs in 2015-26 (n 70,323, month t 0.05; its control +0.002R).**

Run 23 Nov 2026 as pre-registered (`PREREGISTRATION.md`, committed and pushed alone first). Research only: nothing live
changed, nothing is proposed. One run, no variants.

## What was run

The MSNR desk's plan, its pieces imported from `council/eg-methods.mjs` (`snrSides`, `zones`, `turnBack`, `qmSetups`): a Daily
rejection of a fresh Daily level confirmed by an H4 break within 3 trading days gives the side; inside an H4 zone of that side
(an engulf zone, or an opposite zone that failed) a 15- / 30-minute engulf (EG), a failed opposite 15- / 30-minute engulf (EF)
or a 15- / 30-minute QM is the trigger. Entry at market (the next 5-minute open) or, as a second set, a limit at the trigger
zone filled only when traded through by half the round trip. Stop 30 pips in the market's own pip, or past the trigger zone
+ 0.1 ATR(14) of M15; 1R / 2R / 3R targets, 5 days at most. Each cell against the same trigger taken anywhere at matched times
(same calendar month and UTC hour). Ten markets pooled, OANDA mid 5-minute candles; discovery 2005-2014, confirmation 2015 to
October 2026. Costs only beside the verdict: demo figures for gold and the four majors, **ASSUMED** for xag, nzdusd, usdcad, usdchf, eurjpy.

## The bar, cell by cell

- n >= 300 in both windows: 54 of 54.
- Mean R > 0 and month t >= 2 in discovery: 0; in confirmation: 0; both: 0.
- Holm-adjusted p < 0.05 over the 54 confirmation tests: 0.
- Beats its control (Welch t >= 2 in both windows): 4.
- **All four: 0.**
- Side-flipped check (market set) passing bars 1-3: 3 (market EG zone-stop 1R; market EG zone-stop 2R; market EF zone-stop 1R).

## Every cell

R a trade before costs (month-sum t), after costs beside; control = the same trigger anywhere at matched times; "vs ctl" =
Welch t of the cell against its control (discovery / confirmation); Holm on the confirmation test.

| Cell | n 05-14 | R 05-14 (t) | net | ctl R 05-14 | n 15-26 | R 15-26 (t) | net | ctl R 15-26 | vs ctl | Holm | Flipped R 15-26 (t) | Pass |
|---|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|---|
| market EG pips-stop 1R | 177,406 | -0.028 (-3.58) | -0.065 | -0.014 | 217,138 | -0.018 (-2.73) | -0.056 | -0.011 | -5.28 / -2.58 | 1.000 | +0.013 (1.98) | no |
| market EG pips-stop 2R | 177,406 | -0.031 (-2.40) | -0.068 | -0.015 | 217,138 | -0.008 (-0.75) | -0.047 | -0.005 | -4.48 / -0.84 | 1.000 | +0.027 (2.37) | no |
| market EG pips-stop 3R | 177,406 | -0.027 (-1.57) | -0.064 | -0.011 | 217,138 | -0.005 (-0.34) | -0.044 | -0.001 | -3.75 / -1.03 | 1.000 | +0.032 (2.01) | no |
| market EG zone-stop 1R | 175,042 | -0.014 (-3.20) | -0.120 | -0.027 | 212,337 | -0.018 (-5.53) | -0.143 | -0.025 | 4.62 / 2.78 | 1.000 | +0.012 (3.63) | no |
| market EG zone-stop 2R | 175,042 | -0.028 (-3.69) | -0.134 | -0.033 | 212,337 | -0.025 (-4.68) | -0.149 | -0.033 | 1.31 / 2.35 | 1.000 | +0.018 (3.43) | no |
| market EG zone-stop 3R | 175,042 | -0.034 (-3.38) | -0.140 | -0.034 | 212,337 | -0.022 (-3.16) | -0.147 | -0.034 | 0.05 / 2.93 | 1.000 | +0.016 (2.05) | no |
| market EF pips-stop 1R | 77,317 | -0.025 (-2.96) | -0.062 | -0.015 | 95,046 | -0.016 (-2.28) | -0.055 | -0.010 | -2.72 / -1.85 | 1.000 | +0.011 (1.50) | no |
| market EF pips-stop 2R | 77,317 | -0.027 (-1.94) | -0.064 | -0.014 | 95,046 | -0.002 (-0.20) | -0.041 | -0.003 | -2.41 / 0.02 | 1.000 | +0.025 (2.13) | no |
| market EF pips-stop 3R | 77,317 | -0.017 (-0.90) | -0.054 | -0.011 | 95,046 | +0.000 (0.02) | -0.039 | +0.002 | -0.82 / -0.28 | 1.000 | +0.029 (1.75) | no |
| market EF zone-stop 1R | 76,011 | -0.038 (-7.49) | -0.153 | -0.042 | 92,388 | -0.025 (-5.95) | -0.160 | -0.030 | 1.01 / 1.15 | 1.000 | +0.017 (3.95) | no |
| market EF zone-stop 2R | 76,011 | -0.046 (-5.50) | -0.161 | -0.048 | 92,388 | -0.027 (-4.44) | -0.162 | -0.033 | 0.48 / 1.23 | 1.000 | +0.013 (2.03) | no |
| market EF zone-stop 3R | 76,011 | -0.049 (-4.57) | -0.165 | -0.048 | 92,388 | -0.030 (-3.95) | -0.165 | -0.035 | -0.17 / 0.80 | 1.000 | +0.023 (2.93) | no |
| market QM pips-stop 1R | 54,927 | -0.008 (-1.05) | -0.045 | -0.009 | 70,323 | -0.008 (-1.15) | -0.048 | -0.007 | 0.09 / -0.23 | 1.000 | +0.002 (0.35) | no |
| market QM pips-stop 2R | 54,927 | -0.007 (-0.55) | -0.044 | -0.009 | 70,323 | -0.003 (-0.25) | -0.043 | -0.003 | 0.36 / 0.04 | 1.000 | +0.018 (1.61) | no |
| market QM pips-stop 3R | 54,927 | +0.004 (0.22) | -0.033 | -0.008 | 70,323 | +0.001 (0.05) | -0.039 | +0.002 | 1.43 / -0.18 | 1.000 | +0.022 (1.50) | no |
| market QM zone-stop 1R | 54,259 | -0.014 (-2.53) | -0.106 | -0.021 | 68,837 | -0.010 (-2.02) | -0.123 | -0.014 | 1.37 / 0.85 | 1.000 | +0.002 (0.51) | no |
| market QM zone-stop 2R | 54,259 | -0.009 (-0.98) | -0.101 | -0.019 | 68,837 | -0.013 (-1.58) | -0.126 | -0.016 | 1.48 / 0.60 | 1.000 | +0.018 (2.37) | no |
| market QM zone-stop 3R | 54,259 | -0.002 (-0.17) | -0.094 | -0.014 | 68,837 | -0.010 (-0.96) | -0.124 | -0.019 | 1.45 / 1.18 | 1.000 | +0.029 (2.96) | no |
| market EG pips-stop 1R +MSNR | 100,051 | -0.019 (-1.92) | -0.056 | -0.002 | 128,441 | -0.016 (-1.76) | -0.055 | -0.012 | -4.88 / -1.20 | 1.000 | +0.011 (1.23) | no |
| market EG pips-stop 2R +MSNR | 100,051 | -0.027 (-1.68) | -0.064 | +0.005 | 128,441 | -0.012 (-0.82) | -0.051 | -0.007 | -6.45 / -1.06 | 1.000 | +0.022 (1.36) | no |
| market EG pips-stop 3R +MSNR | 100,051 | -0.020 (-0.97) | -0.057 | +0.012 | 128,441 | -0.009 (-0.47) | -0.048 | -0.003 | -5.49 / -1.12 | 1.000 | +0.027 (1.25) | no |
| market EG zone-stop 1R +MSNR | 98,765 | -0.010 (-1.73) | -0.115 | -0.021 | 126,008 | -0.012 (-2.52) | -0.134 | -0.020 | 3.12 / 2.43 | 1.000 | +0.006 (1.28) | no |
| market EG zone-stop 2R +MSNR | 98,765 | -0.018 (-1.86) | -0.123 | -0.022 | 126,008 | -0.020 (-2.56) | -0.142 | -0.028 | 0.87 / 1.60 | 1.000 | +0.008 (1.03) | no |
| market EG zone-stop 3R +MSNR | 98,765 | -0.026 (-2.06) | -0.131 | -0.021 | 126,008 | -0.014 (-1.31) | -0.136 | -0.027 | -0.76 / 2.38 | 1.000 | +0.004 (0.41) | no |
| market EF pips-stop 1R +MSNR | 43,322 | -0.013 (-1.17) | -0.050 | +0.002 | 56,109 | -0.016 (-1.61) | -0.055 | -0.005 | -2.75 / -2.44 | 1.000 | +0.011 (1.12) | no |
| market EF pips-stop 2R +MSNR | 43,322 | -0.024 (-1.34) | -0.061 | +0.010 | 56,109 | -0.010 (-0.60) | -0.048 | +0.003 | -4.48 / -1.94 | 1.000 | +0.019 (1.17) | no |
| market EF pips-stop 3R +MSNR | 43,322 | -0.012 (-0.51) | -0.048 | +0.023 | 56,109 | -0.006 (-0.27) | -0.044 | +0.009 | -3.79 / -1.93 | 1.000 | +0.023 (1.03) | no |
| market EF zone-stop 1R +MSNR | 42,653 | -0.034 (-4.90) | -0.149 | -0.032 | 54,723 | -0.017 (-3.20) | -0.150 | -0.024 | -0.39 / 1.36 | 1.000 | +0.009 (1.71) | no |
| market EF zone-stop 2R +MSNR | 42,653 | -0.037 (-3.41) | -0.152 | -0.033 | 54,723 | -0.022 (-2.67) | -0.154 | -0.022 | -0.51 / 0.03 | 1.000 | -0.001 (-0.10) | no |
| market EF zone-stop 3R +MSNR | 42,653 | -0.044 (-3.14) | -0.159 | -0.027 | 54,723 | -0.028 (-2.52) | -0.160 | -0.020 | -1.79 / -0.94 | 1.000 | +0.008 (0.80) | no |
| market QM pips-stop 1R +MSNR | 30,950 | -0.004 (-0.39) | -0.041 | +0.004 | 41,476 | -0.013 (-1.28) | -0.052 | -0.002 | -1.16 / -1.78 | 1.000 | +0.008 (0.76) | no |
| market QM pips-stop 2R +MSNR | 30,950 | -0.007 (-0.40) | -0.044 | +0.012 | 41,476 | -0.016 (-1.00) | -0.055 | +0.004 | -1.92 / -2.35 | 1.000 | +0.019 (1.26) | no |
| market QM pips-stop 3R +MSNR | 30,950 | +0.009 (0.39) | -0.028 | +0.024 | 41,476 | -0.013 (-0.66) | -0.052 | +0.009 | -1.34 / -2.29 | 1.000 | +0.029 (1.35) | no |
| market QM zone-stop 1R +MSNR | 30,592 | -0.014 (-1.87) | -0.106 | -0.014 | 40,681 | -0.008 (-1.25) | -0.118 | -0.004 | -0.00 / -0.54 | 1.000 | +0.001 (0.21) | no |
| market QM zone-stop 2R +MSNR | 30,592 | -0.007 (-0.55) | -0.098 | -0.007 | 40,681 | -0.011 (-1.04) | -0.121 | -0.001 | -0.03 / -1.10 | 1.000 | +0.015 (1.49) | no |
| market QM zone-stop 3R +MSNR | 30,592 | +0.004 (0.28) | -0.087 | +0.006 | 40,681 | -0.011 (-0.80) | -0.121 | +0.002 | -0.17 / -1.26 | 1.000 | +0.027 (2.12) | no |
| limit EG pips-stop 1R | 137,327 | -0.041 (-5.40) | -0.077 | -0.023 | 167,850 | -0.034 (-5.00) | -0.071 | -0.024 | -5.95 / -3.68 | 1.000 | - | no |
| limit EG pips-stop 2R | 137,327 | -0.044 (-3.27) | -0.079 | -0.023 | 167,850 | -0.026 (-2.46) | -0.064 | -0.020 | -4.92 / -1.73 | 1.000 | - | no |
| limit EG pips-stop 3R | 137,327 | -0.043 (-2.41) | -0.079 | -0.020 | 167,850 | -0.025 (-1.76) | -0.063 | -0.017 | -4.65 / -1.86 | 1.000 | - | no |
| limit EG zone-stop 1R | 133,756 | -0.064 (-15.77) | -0.200 | -0.078 | 162,214 | -0.076 (-21.24) | -0.235 | -0.086 | 4.48 / 3.60 | 1.000 | - | no |
| limit EG zone-stop 2R | 133,756 | -0.068 (-10.85) | -0.203 | -0.081 | 162,214 | -0.077 (-14.72) | -0.236 | -0.091 | 3.15 / 3.57 | 1.000 | - | no |
| limit EG zone-stop 3R | 133,756 | -0.077 (-9.00) | -0.213 | -0.086 | 162,214 | -0.083 (-12.24) | -0.243 | -0.096 | 1.62 / 2.75 | 1.000 | - | no |
| limit EF pips-stop 1R | 61,399 | -0.038 (-4.25) | -0.074 | -0.026 | 75,403 | -0.031 (-4.27) | -0.069 | -0.025 | -2.62 / -1.51 | 1.000 | - | no |
| limit EF pips-stop 2R | 61,399 | -0.043 (-2.89) | -0.079 | -0.027 | 75,403 | -0.016 (-1.28) | -0.054 | -0.019 | -2.56 / 0.48 | 1.000 | - | no |
| limit EF pips-stop 3R | 61,399 | -0.035 (-1.74) | -0.071 | -0.026 | 75,403 | -0.016 (-0.92) | -0.053 | -0.017 | -1.21 / 0.26 | 1.000 | - | no |
| limit EF zone-stop 1R | 59,316 | -0.097 (-17.76) | -0.249 | -0.102 | 72,262 | -0.097 (-20.31) | -0.274 | -0.102 | 1.06 / 1.13 | 1.000 | - | no |
| limit EF zone-stop 2R | 59,316 | -0.103 (-13.20) | -0.255 | -0.108 | 72,262 | -0.098 (-15.28) | -0.274 | -0.105 | 0.78 / 1.23 | 1.000 | - | no |
| limit EF zone-stop 3R | 59,316 | -0.105 (-10.05) | -0.256 | -0.112 | 72,262 | -0.102 (-12.40) | -0.278 | -0.108 | 0.92 / 0.88 | 1.000 | - | no |
| limit QM pips-stop 1R | 25,069 | -0.044 (-4.16) | -0.080 | -0.032 | 32,359 | -0.044 (-5.03) | -0.082 | -0.030 | -1.57 / -2.16 | 1.000 | - | no |
| limit QM pips-stop 2R | 25,069 | -0.044 (-2.72) | -0.081 | -0.031 | 32,359 | -0.049 (-3.61) | -0.087 | -0.036 | -1.29 / -1.48 | 1.000 | - | no |
| limit QM pips-stop 3R | 25,069 | -0.037 (-1.70) | -0.073 | -0.027 | 32,359 | -0.046 (-2.79) | -0.085 | -0.036 | -0.78 / -0.97 | 1.000 | - | no |
| limit QM zone-stop 1R | 21,172 | -0.183 (-16.96) | -0.507 | -0.190 | 25,770 | -0.212 (-23.60) | -0.606 | -0.222 | 0.70 / 1.14 | 1.000 | - | no |
| limit QM zone-stop 2R | 21,172 | -0.158 (-13.22) | -0.482 | -0.168 | 25,770 | -0.187 (-16.89) | -0.582 | -0.201 | 0.89 / 1.21 | 1.000 | - | no |
| limit QM zone-stop 3R | 21,172 | -0.150 (-11.30) | -0.474 | -0.161 | 25,770 | -0.183 (-14.26) | -0.578 | -0.190 | 0.78 / 0.52 | 1.000 | - | no |

## Gold alone (reported, not judged)

The desk plan's own market with its own 30-pip stop, before costs; control = the same trigger on gold anywhere at matched times.

| Cell | n 06-14 | R 06-14 (t) | ctl | n 15-26 | R 15-26 (t) | ctl |
|---|---:|---:|---:|---:|---:|---:|
| market EG pips-stop 1R | 14,480 | -0.041 (-2.68) | -0.015 | 20,482 | +0.006 (0.50) | -0.023 |
| market EG pips-stop 2R | 14,480 | -0.062 (-2.28) | -0.012 | 20,482 | +0.025 (1.09) | -0.018 |
| market EG pips-stop 3R | 14,480 | -0.046 (-1.39) | +0.001 | 20,482 | +0.042 (1.38) | -0.014 |
| market EF pips-stop 1R | 6,217 | -0.045 (-2.22) | -0.016 | 8,895 | -0.002 (-0.12) | -0.017 |
| market EF pips-stop 2R | 6,217 | -0.070 (-2.11) | -0.011 | 8,895 | +0.025 (0.98) | -0.014 |
| market EF pips-stop 3R | 6,217 | -0.036 (-0.87) | +0.004 | 8,895 | +0.051 (1.48) | -0.006 |
| market QM pips-stop 1R | 4,646 | -0.020 (-1.12) | -0.016 | 7,016 | +0.015 (0.96) | -0.012 |
| market QM pips-stop 2R | 4,646 | -0.024 (-0.78) | -0.014 | 7,016 | +0.016 (0.61) | -0.016 |
| market QM pips-stop 3R | 4,646 | +0.011 (0.27) | +0.003 | 7,016 | +0.039 (1.13) | -0.007 |
| limit EG pips-stop 1R | 10,937 | -0.077 (-4.65) | -0.059 | 15,915 | -0.034 (-2.40) | -0.060 |
| limit EG pips-stop 2R | 10,937 | -0.101 (-3.76) | -0.055 | 15,915 | -0.018 (-0.74) | -0.060 |
| limit EG pips-stop 3R | 10,937 | -0.095 (-2.93) | -0.042 | 15,915 | +0.000 (0.00) | -0.060 |
| limit EF pips-stop 1R | 4,893 | -0.066 (-3.46) | -0.072 | 7,082 | -0.027 (-1.52) | -0.051 |
| limit EF pips-stop 2R | 4,893 | -0.112 (-3.46) | -0.075 | 7,082 | +0.017 (0.60) | -0.044 |
| limit EF pips-stop 3R | 4,893 | -0.076 (-1.96) | -0.051 | 7,082 | +0.038 (1.01) | -0.043 |
| limit QM pips-stop 1R | 2,150 | -0.068 (-2.73) | -0.074 | 3,241 | -0.064 (-3.20) | -0.081 |
| limit QM pips-stop 2R | 2,150 | -0.096 (-2.48) | -0.072 | 3,241 | -0.083 (-2.59) | -0.086 |
| limit QM pips-stop 3R | 2,150 | -0.060 (-1.14) | -0.039 | 3,241 | -0.051 (-1.20) | -0.089 |

## Checks

- Cut test: 15 cuts on xau, eurusd, usdjpy: 694,656 plan signals known by the cut dates, 0 missing or extra when the candles are cut there.
- Every trade has its stop on the losing side of the fill (the run throws otherwise); a fill at or past the stop, or a risk under the round trip, is no trade.
- Exclusions: the data-quality audit's bad intervals (`combo-grid-2` `exclusions`).
- Gold's 30-pip stop is $3.00 in every year (about 0.6 % of price in 2005, 0.07 % in 2026): the rule as the desk writes it.

| Market | candles from | triggers | plan triggers | dropped (bad data) | stop past the fill | risk under cost | limit not filled |
|---|---|---:|---:|---:|---:|---:|---:|
| xau | 2006-03-19 | 295,737 | 61,744 | 8 | 86 | 225 | 17,517 |
| xag | 2006-03-19 | 295,777 | 62,666 | 168 | 121 | 11,884 | 24,871 |
| eurusd | 2005-01-02 | 328,454 | 69,039 | 32 | 89 | 25 | 18,095 |
| gbpusd | 2005-01-02 | 331,160 | 68,563 | 79 | 104 | 36 | 17,574 |
| usdjpy | 2005-01-02 | 322,003 | 69,962 | 52 | 88 | 50 | 18,945 |
| audusd | 2005-01-02 | 329,319 | 72,787 | 51 | 81 | 37 | 19,926 |
| nzdusd | 2005-01-02 | 327,698 | 73,500 | 1 | 142 | 47 | 19,655 |
| usdcad | 2005-01-02 | 329,018 | 70,733 | 82 | 82 | 40 | 18,644 |
| usdchf | 2005-01-02 | 327,042 | 70,977 | 84 | 126 | 66 | 18,738 |
| eurjpy | 2005-01-02 | 326,746 | 73,045 | 2 | 123 | 46 | 18,869 |

## What it means

With market entries the plan's conditions (a Daily rejection, an H4 break, an H4 zone) do not pick triggers that beat the
same triggers taken anywhere, on ten markets over 22 years. The out-of-sample gold figure of `desk-rigor` rested on resting
limits; read with an entry that a touch fill cannot flatter, the plan is not an edge. Do not re-test variants of these 54
cells on these years. Nothing live changed; no rule is proposed.

The 4 cells that "beat" their control (Welch t >= 2 in both windows) lose money themselves: the plan lost a little
less than the same trigger taken anywhere, with a stop past the trigger zone. Before costs every market-entry cell is within
about 0.05R of zero; after costs every one of the 54 cells loses. The side-flipped trades that clear bars 1-3 are the mirror
of small losses at a 1R / 2R exit and lose after costs: not a fade rule.
