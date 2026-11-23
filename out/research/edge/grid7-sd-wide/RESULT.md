# Wide supply / demand grid: zones by base type on ten markets (result)

**Verdict: FAIL. 0 of 56 cells pass; the best confirmation cell, RBD 4h touch 1R, made +0.059R a trade before costs in 2015-26 (n 1,772, month t 2.39; discovery +0.031R, t 1.30; +0.012R after costs).**

Run 23 Nov 2026 as pre-registered (`PREREGISTRATION.md`, committed and pushed alone first). Research only: nothing live
changed, nothing is proposed. One run, no variants.

## What was run

A zone = a base of 1-4 small candles (body under half the ATR) between a leg in and a strong leg out (one or two candles with
a body over 1.5 ATR), on the Daily or H4 chart; shapes RBR, DBD (continuation), DBR, RBD (reversal); the zone is the base's
range, fresh until its first touch. On the first touch, on the timeframe two steps lower (Daily -> H1, H4 -> M15): (touch)
market entry at the touch candle's close, or (break) at the first structure break of the zone's side within 24 candles.
Stop past the zone's far side + 0.1 ATR; exits 1R, 2R or the leg-out's extreme (when 1R or more away); time limit 10 days
(Daily) / 3 days (H4). 48 shape cells + 8 leg-out strength cells (shapes pooled, 2R). Each cell against its control: random
bands of the same height born at the same time at a matched distance (three seeds). Ten markets pooled, OANDA mid 5-minute
candles; discovery 2005-2014, confirmation 2015 to October 2026. Costs after the fact only; **ASSUMED, not measured** for xag, nzdusd, usdcad, usdchf, eurjpy.

## The bar, cell by cell

- n >= 300 in both windows: 27 of 56.
- Mean R > 0 and month t >= 2 in discovery: 1; in confirmation: 3; both: 0.
- Holm-adjusted p < 0.05 over the 56 confirmation tests: 0.
- Beats its control (Welch t >= 2 in both windows): 0 of 56.
- **All four: 0.**
- Side-flipped placebo passing bars 1-3: 0.

Best confirmation cell: RBD 4h touch 1R. Best on the weaker of the two windows: RBD 4h touch 2R (discovery
+0.057R, t 1.62; confirmation +0.060R, t 1.79).

## Every cell

R a trade before costs (month-sum t), after costs beside; control = its random bands (R before costs); "vs ctl" = Welch t
of the cell against its control (discovery / confirmation); Holm on the confirmation test.

| Cell | n 05-14 | R 05-14 (t) | net 05-14 | n 15-26 | R 15-26 (t) | net 15-26 | ctl R 05-14 / 15-26 | vs ctl | Holm | Placebo R 15-26 (t) | Pass |
|---|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|---|
| RBR 1d touch 1R | 254 | -0.065 (-1.06) | -0.084 | 339 | -0.050 (-0.91) | -0.067 | -0.055 / +0.015 | -0.13 / -1.07 | 1.000 | +0.050 (0.91) | no |
| RBR 1d touch 2R | 254 | -0.141 (-2.00) | -0.160 | 339 | -0.084 (-1.28) | -0.101 | -0.071 / -0.001 | -0.78 / -1.11 | 1.000 | +0.008 (0.12) | no |
| RBR 1d touch ext | 175 | -0.135 (-1.51) | -0.158 | 239 | -0.020 (-0.23) | -0.041 | -0.116 / -0.055 | -0.17 / 0.34 | 1.000 | +0.181 (1.46) | no |
| RBR 1d break 1R | 160 | -0.071 (-1.03) | -0.084 | 219 | -0.096 (-1.67) | -0.108 | -0.074 / -0.032 | 0.03 / -0.92 | 1.000 | +0.096 (1.67) | no |
| RBR 1d break 2R | 160 | -0.138 (-1.88) | -0.151 | 219 | -0.086 (-1.28) | -0.098 | -0.115 / +0.006 | -0.24 / -1.09 | 1.000 | +0.081 (1.10) | no |
| RBR 1d break ext | 52 | +0.003 (0.02) | -0.012 | 82 | +0.061 (0.48) | +0.045 | -0.229 / +0.044 | 1.23 / 0.11 | 1.000 | -0.113 (-0.92) | no |
| RBR 4h touch 1R | 1,636 | -0.002 (-0.07) | -0.044 | 1,881 | -0.007 (-0.28) | -0.054 | -0.011 / -0.047 | 0.33 / 0.54 | 1.000 | +0.001 (0.06) | no |
| RBR 4h touch 2R | 1,636 | +0.045 (1.38) | +0.003 | 1,881 | -0.005 (-0.15) | -0.052 | +0.005 / -0.082 | 1.04 / 0.99 | 1.000 | +0.024 (0.74) | no |
| RBR 4h touch ext | 1,231 | +0.058 (1.32) | +0.010 | 1,356 | -0.059 (-1.31) | -0.114 | +0.038 / -0.110 | 0.38 / 0.48 | 1.000 | +0.075 (1.65) | no |
| RBR 4h break 1R | 881 | -0.010 (-0.32) | -0.035 | 1,021 | -0.059 (-2.08) | -0.088 | -0.077 / -0.011 | 1.83 / -1.44 | 1.000 | +0.057 (1.99) | no |
| RBR 4h break 2R | 881 | +0.009 (0.21) | -0.016 | 1,021 | -0.045 (-1.21) | -0.074 | -0.041 / -0.026 | 1.09 / -0.45 | 1.000 | +0.053 (1.44) | no |
| RBR 4h break ext | 282 | +0.029 (0.39) | -0.003 | 332 | -0.049 (-0.72) | -0.089 | -0.046 / -0.031 | 0.86 / -0.24 | 1.000 | +0.044 (0.62) | no |
| DBD 1d touch 1R | 249 | +0.030 (0.48) | +0.018 | 308 | -0.088 (-1.63) | -0.105 | +0.122 / -0.044 | -1.23 / -0.71 | 1.000 | +0.088 (1.63) | no |
| DBD 1d touch 2R | 249 | +0.034 (0.47) | +0.022 | 308 | -0.111 (-1.58) | -0.128 | +0.098 / -0.117 | -0.67 / 0.09 | 1.000 | +0.128 (1.70) | no |
| DBD 1d touch ext | 170 | -0.024 (-0.26) | -0.038 | 216 | -0.005 (-0.06) | -0.025 | +0.175 / -0.118 | -1.64 / 1.15 | 1.000 | -0.056 (-0.61) | no |
| DBD 1d break 1R | 155 | +0.041 (0.60) | +0.032 | 171 | -0.009 (-0.14) | -0.024 | +0.094 / -0.126 | -0.59 / 1.53 | 1.000 | +0.009 (0.14) | no |
| DBD 1d break 2R | 155 | -0.079 (-0.98) | -0.088 | 171 | -0.010 (-0.13) | -0.025 | +0.064 / -0.089 | -1.34 / 0.87 | 1.000 | +0.044 (0.56) | no |
| DBD 1d break ext | 57 | +0.107 (0.64) | +0.093 | 77 | -0.004 (-0.03) | -0.023 | +0.281 / -0.127 | -0.84 / 0.77 | 1.000 | +0.027 (0.21) | no |
| DBD 4h touch 1R | 1,703 | +0.009 (0.36) | -0.028 | 1,872 | +0.021 (0.91) | -0.024 | +0.036 / -0.002 | -0.96 / 0.90 | 1.000 | -0.022 (-0.95) | no |
| DBD 4h touch 2R | 1,703 | +0.024 (0.69) | -0.013 | 1,872 | -0.027 (-0.81) | -0.072 | +0.036 / -0.023 | -0.31 / -0.13 | 1.000 | -0.023 (-0.71) | no |
| DBD 4h touch ext | 1,229 | -0.024 (-0.56) | -0.067 | 1,413 | -0.076 (-2.07) | -0.128 | +0.035 / -0.051 | -1.20 / -0.55 | 1.000 | +0.019 (0.41) | no |
| DBD 4h break 1R | 940 | +0.000 (0.01) | -0.022 | 1,029 | -0.074 (-2.27) | -0.103 | +0.007 / -0.063 | -0.20 / -0.34 | 1.000 | +0.071 (2.19) | no |
| DBD 4h break 2R | 940 | -0.051 (-1.24) | -0.073 | 1,029 | -0.101 (-2.42) | -0.129 | -0.016 / -0.062 | -0.78 / -0.92 | 1.000 | +0.036 (0.84) | no |
| DBD 4h break ext | 312 | -0.065 (-0.94) | -0.099 | 370 | -0.120 (-1.66) | -0.159 | -0.034 / -0.026 | -0.39 / -1.26 | 1.000 | +0.123 (1.45) | no |
| DBR 1d touch 1R | 206 | +0.020 (0.31) | +0.005 | 283 | +0.108 (1.77) | +0.092 | +0.004 / +0.094 | 0.18 / 0.22 | 1.000 | -0.108 (-1.77) | no |
| DBR 1d touch 2R | 206 | -0.072 (-0.79) | -0.087 | 283 | +0.115 (1.55) | +0.099 | +0.059 / +0.114 | -1.21 / 0.01 | 1.000 | +0.013 (0.16) | no |
| DBR 1d touch ext | 146 | -0.032 (-0.28) | -0.049 | 192 | +0.084 (0.90) | +0.065 | +0.044 / +0.228 | -0.55 / -1.36 | 1.000 | -0.029 (-0.25) | no |
| DBR 1d break 1R | 120 | -0.098 (-1.11) | -0.109 | 185 | +0.095 (1.52) | +0.082 | -0.108 / +0.099 | 0.10 / -0.05 | 1.000 | -0.095 (-1.52) | no |
| DBR 1d break 2R | 120 | -0.094 (-0.91) | -0.105 | 185 | +0.076 (1.02) | +0.063 | -0.117 / +0.128 | 0.19 / -0.58 | 1.000 | -0.069 (-0.97) | no |
| DBR 1d break ext | 52 | +0.141 (0.86) | +0.128 | 62 | +0.315 (2.13) | +0.300 | -0.122 / +0.352 | 1.25 / -0.20 | 0.947 | -0.290 (-2.25) | no |
| DBR 4h touch 1R | 1,393 | -0.015 (-0.58) | -0.049 | 1,608 | -0.022 (-0.85) | -0.068 | -0.007 / -0.018 | -0.27 / -0.12 | 1.000 | +0.019 (0.75) | no |
| DBR 4h touch 2R | 1,393 | +0.018 (0.51) | -0.016 | 1,608 | -0.054 (-1.68) | -0.100 | +0.014 / -0.017 | 0.08 / -0.94 | 1.000 | +0.058 (1.72) | no |
| DBR 4h touch ext | 998 | +0.031 (0.71) | -0.008 | 1,136 | -0.102 (-2.60) | -0.157 | +0.013 / -0.013 | 0.34 / -1.77 | 1.000 | +0.048 (1.12) | no |
| DBR 4h break 1R | 769 | +0.018 (0.57) | -0.004 | 879 | -0.072 (-2.19) | -0.100 | -0.004 / -0.017 | 0.57 / -1.56 | 1.000 | +0.068 (2.07) | no |
| DBR 4h break 2R | 769 | +0.017 (0.40) | -0.005 | 879 | -0.103 (-2.52) | -0.131 | -0.022 / -0.017 | 0.80 / -1.97 | 1.000 | +0.039 (0.95) | no |
| DBR 4h break ext | 249 | -0.003 (-0.04) | -0.033 | 285 | -0.157 (-2.28) | -0.196 | +0.007 / -0.018 | -0.11 / -1.69 | 1.000 | +0.052 (0.69) | no |
| RBD 1d touch 1R | 274 | +0.026 (0.47) | +0.010 | 307 | +0.108 (2.14) | +0.091 | -0.048 / +0.062 | 1.03 / 0.75 | 0.947 | -0.108 (-2.14) | no |
| RBD 1d touch 2R | 274 | -0.022 (-0.29) | -0.037 | 307 | +0.125 (1.79) | +0.107 | -0.044 / +0.029 | 0.25 / 1.18 | 1.000 | -0.086 (-1.27) | no |
| RBD 1d touch ext | 202 | -0.066 (-0.72) | -0.084 | 219 | +0.096 (1.08) | +0.075 | +0.002 / +0.061 | -0.62 / 0.34 | 1.000 | -0.063 (-0.72) | no |
| RBD 1d break 1R | 175 | -0.072 (-1.17) | -0.086 | 205 | +0.054 (0.81) | +0.041 | -0.009 / -0.018 | -0.75 / 1.00 | 1.000 | -0.054 (-0.81) | no |
| RBD 1d break 2R | 175 | -0.051 (-0.68) | -0.065 | 205 | +0.023 (0.30) | +0.011 | +0.017 / -0.036 | -0.66 / 0.70 | 1.000 | -0.042 (-0.51) | no |
| RBD 1d break ext | 89 | -0.039 (-0.31) | -0.056 | 88 | -0.199 (-1.87) | -0.218 | +0.003 / -0.068 | -0.24 / -0.95 | 1.000 | +0.016 (0.13) | no |
| RBD 4h touch 1R | 1,519 | +0.031 (1.30) | -0.004 | 1,772 | +0.059 (2.39) | +0.012 | +0.033 / +0.019 | -0.05 / 1.51 | 0.510 | -0.064 (-2.60) | no |
| RBD 4h touch 2R | 1,519 | +0.057 (1.62) | +0.022 | 1,772 | +0.060 (1.79) | +0.013 | +0.032 / +0.002 | 0.62 / 1.60 | 1.000 | -0.050 (-1.45) | no |
| RBD 4h touch ext | 1,130 | +0.043 (0.91) | +0.003 | 1,340 | +0.083 (1.96) | +0.030 | +0.036 / +0.024 | 0.14 / 1.23 | 1.000 | -0.036 (-0.73) | no |
| RBD 4h break 1R | 855 | -0.018 (-0.51) | -0.040 | 977 | -0.032 (-1.03) | -0.063 | +0.001 / -0.030 | -0.51 / -0.07 | 1.000 | +0.028 (0.90) | no |
| RBD 4h break 2R | 855 | -0.011 (-0.24) | -0.033 | 977 | +0.004 (0.10) | -0.026 | -0.005 / +0.014 | -0.12 / -0.22 | 1.000 | +0.038 (1.00) | no |
| RBD 4h break ext | 299 | +0.064 (0.86) | +0.033 | 355 | +0.061 (0.94) | +0.021 | -0.017 / +0.034 | 0.98 / 0.35 | 1.000 | +0.033 (0.50) | no |
| all shapes 1d touch 2R, leg out 1.5-2.5 ATR | 921 | -0.050 (-1.29) | -0.065 | 1,131 | -0.002 (-0.07) | -0.020 | +0.013 / +0.001 | -1.26 / -0.10 | 1.000 | +0.026 (0.64) | no |
| all shapes 1d break 2R, leg out 1.5-2.5 ATR | 569 | -0.080 (-1.85) | -0.091 | 715 | -0.012 (-0.33) | -0.025 | -0.034 / +0.003 | -0.84 / -0.33 | 1.000 | +0.011 (0.28) | no |
| all shapes 4h touch 2R, leg out 1.5-2.5 ATR | 5,229 | +0.024 (1.35) | -0.012 | 5,934 | -0.002 (-0.09) | -0.047 | +0.009 / -0.020 | 0.72 / 0.92 | 1.000 | -0.005 (-0.23) | no |
| all shapes 4h break 2R, leg out 1.5-2.5 ATR | 2,917 | -0.007 (-0.34) | -0.031 | 3,313 | -0.067 (-2.94) | -0.095 | -0.034 / -0.029 | 1.05 / -1.59 | 1.000 | +0.039 (1.86) | no |
| all shapes 1d touch 2R, leg out over 2.5 ATR | 62 | -0.037 (-0.21) | -0.055 | 106 | +0.103 (0.89) | +0.086 | -0.103 / +0.029 | 0.34 / 0.53 | 1.000 | -0.096 (-0.91) | no |
| all shapes 1d break 2R, leg out over 2.5 ATR | 41 | -0.222 (-1.33) | -0.237 | 66 | +0.091 (0.66) | +0.079 | -0.043 / -0.017 | -0.84 / 0.68 | 1.000 | -0.078 (-0.65) | no |
| all shapes 4h touch 2R, leg out over 2.5 ATR | 1,023 | +0.095 (2.03) | +0.054 | 1,201 | -0.025 (-0.66) | -0.076 | +0.080 / +0.022 | 0.30 / -1.07 | 1.000 | +0.028 (0.70) | no |
| all shapes 4h break 2R, leg out over 2.5 ATR | 525 | -0.035 (-0.61) | -0.057 | 593 | -0.022 (-0.41) | -0.052 | +0.037 / +0.010 | -1.23 / -0.59 | 1.000 | +0.050 (0.91) | no |

## Checks

- Cut test: 15 cuts on xau, eurusd, usdjpy: 71,658 signals (zones and bands) known by the cut dates, 0 missing or extra when the candles are cut there.
- Every trade has its stop on the losing side of the fill (the run throws otherwise); fills at or past the stop and trades whose risk is under the round-trip cost are no trades (same for every cell and the controls).
- Exclusions: the data-quality audit's bad intervals (`combo-grid-2` `exclusions`).

| Market | candles from | signals | simulated | dropped (bad data) | past the stop | risk under cost | zones traded at the touch (D1 / H4) |
|---|---|---:|---:|---:|---:|---:|---:|
| xau | 2006-03-19 | 8,532 | 8,529 | 0 | 0 | 3 | 222 / 1,208 |
| xag | 2006-03-19 | 8,937 | 8,876 | 16 | 0 | 45 | 245 / 1,224 |
| eurusd | 2004-01-01 | 9,647 | 9,645 | 0 | 0 | 0 | 215 / 1,414 |
| gbpusd | 2004-01-01 | 9,599 | 9,591 | 7 | 1 | 0 | 217 / 1,384 |
| usdjpy | 2004-01-01 | 9,330 | 9,323 | 4 | 0 | 0 | 211 / 1,341 |
| audusd | 2004-01-01 | 10,045 | 10,035 | 4 | 0 | 0 | 219 / 1,425 |
| nzdusd | 2004-01-01 | 9,294 | 9,292 | 0 | 0 | 0 | 215 / 1,324 |
| usdcad | 2004-01-01 | 9,485 | 9,469 | 10 | 0 | 0 | 225 / 1,349 |
| usdchf | 2004-01-01 | 9,187 | 9,182 | 4 | 1 | 0 | 221 / 1,317 |
| eurjpy | 2004-01-01 | 9,879 | 9,868 | 0 | 1 | 0 | 232 / 1,405 |

## What it means

No base shape, zone timeframe, entry or exit of this classic supply / demand reading beats a random band of the same
height at the same distance on ten markets over 22 years. The base shape and the strength of the leg out do not pick better
first touches than chance levels do. Do not re-test variants of these 56 cells on these years. Nothing live changed; no rule is proposed.
