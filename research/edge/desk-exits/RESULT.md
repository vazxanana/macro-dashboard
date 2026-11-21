# Desk exits: 1R, 2R, 3R targets or a trailing stop on every desk's trades

Pre-registered (PREREGISTRATION.md, committed first). The desks' own entries of 2026, each run alone on OANDA mid 5-minute candles with a target of 1R, 2R or 3R, or a trailing stop 1R behind the best price from +1R, against the exit each desk books. Mean R a trade, before costs and after the desk-rigor cost model. In sample: a "better" here is a hypothesis for the 2020-2025 harness, never a rule.

**Verdict: PASS.** 1 of 60 exit-group comparisons better than the desk's own exit after costs on the pre-registered bar (Engulf short method, Trailing stop (1R behind from +1R): −0.060R a trade after costs, still a loss); 1 worse. A better exit is not a profitable one: read the after-costs column.

Trades: 30904 closed records (3 left out: their candles ended before an exit, or no candle at the fill).

## Mosha sequence (mosha, n 125, 2026-07-24 to 2026-11-20)

| Exit | Before costs, R a trade | After costs | Win % | Total after costs | Month t | Against own exit (after costs) | Holm p | Halves | Verdict |
|---|---|---|---|---|---|---|---|---|---|
| The desk's own exit | +0.044 | −0.029 | 22.4 | −3.580 | -0.17 | — | — | — | — |
| Target 1R | +0.048 | −0.024 | 52.8 | −2.980 | -0.23 | +0.061 (t 0.39) | 1 | +0.176 / −0.164 | no better |
| Target 2R | +0.112 | +0.040 | 37.6 | +5.020 | 0.59 | +0.104 (t 0.7) | 1 | +0.289 / −0.148 | no better |
| Target 3R | +0.043 | −0.029 | 27.2 | −3.610 | -0.34 | +0.051 (t 0.55) | 1 | +0.102 / −0.101 | no better |
| Trailing stop (1R behind from +1R) | +0.029 | −0.043 | 51.2 | −5.430 | -1.03 | +0.075 (t 0.44) | 1 | +0.203 / −0.229 | no better |

## Mosha barrier entry (mosha, n 13040, 2026-07-23 to 2026-11-20)

| Exit | Before costs, R a trade | After costs | Win % | Total after costs | Month t | Against own exit (after costs) | Holm p | Halves | Verdict |
|---|---|---|---|---|---|---|---|---|---|
| The desk's own exit | +0.005 | −0.084 | 25.2 | −1089.410 | -2.83 | — | — | — | — |
| Target 1R | −0.034 | −0.122 | 48.4 | −1591.390 | -5.24 | −0.025 (t -0.82) | 1 | −0.024 / −0.053 | no better |
| Target 2R | −0.022 | −0.110 | 32.8 | −1437.220 | -4.44 | −0.019 (t -0.93) | 1 | −0.011 / −0.042 | no better |
| Target 3R | −0.003 | −0.091 | 25.2 | −1186.280 | -3 | −0.008 (t -4.05) | 0.0031 | −0.006 / −0.009 | worse |
| Trailing stop (1R behind from +1R) | +0.004 | −0.085 | 44 | −1102.460 | -3.36 | +0.014 (t 0.58) | 1 | +0.012 / −0.014 | no better |

## Engulf D1 (eg, n 182, 2025-12-22 to 2026-11-17)

| Exit | Before costs, R a trade | After costs | Win % | Total after costs | Month t | Against own exit (after costs) | Holm p | Halves | Verdict |
|---|---|---|---|---|---|---|---|---|---|
| The desk's own exit | +0.135 | +0.125 | 43.4 | +22.750 | 1.22 | — | — | — | — |
| Target 1R | +0.031 | +0.022 | 51.1 | +3.940 | 0.34 | −0.172 (t -1.91) | 1 | −0.112 / −0.095 | no better |
| Target 2R | +0.033 | +0.023 | 44 | +4.190 | 0.25 | −0.147 (t -2.76) | 0.3295 | −0.120 / −0.084 | no better |
| Target 3R | +0.092 | +0.082 | 43.4 | +14.940 | 0.7 | −0.094 (t -1.36) | 1 | −0.091 / +0.005 | no better |
| Trailing stop (1R behind from +1R) | +0.102 | +0.092 | 50.5 | +16.710 | 1.01 | −0.075 (t -1.15) | 1 | −0.052 / −0.014 | no better |

## Engulf H4 (eg, n 1091, 2025-12-30 to 2026-11-20)

| Exit | Before costs, R a trade | After costs | Win % | Total after costs | Month t | Against own exit (after costs) | Holm p | Halves | Verdict |
|---|---|---|---|---|---|---|---|---|---|
| The desk's own exit | +0.002 | −0.029 | 36.1 | −31.460 | -0.62 | — | — | — | — |
| Target 1R | −0.037 | −0.068 | 48.4 | −74.040 | -1.47 | −0.061 (t -1.64) | 1 | +0.004 / −0.082 | no better |
| Target 2R | −0.011 | −0.041 | 33.9 | −44.900 | -0.75 | −0.020 (t -0.87) | 1 | −0.010 / −0.015 | no better |
| Target 3R | −0.008 | −0.039 | 26.9 | −42.360 | -0.69 | −0.050 (t -0.77) | 1 | +0.013 / −0.033 | no better |
| Trailing stop (1R behind from +1R) | −0.016 | −0.046 | 47 | −50.620 | -0.71 | −0.019 (t -0.69) | 1 | +0.023 / −0.058 | no better |

## Engulf H1 (eg, n 4053, 2025-12-30 to 2026-11-20)

| Exit | Before costs, R a trade | After costs | Win % | Total after costs | Month t | Against own exit (after costs) | Holm p | Halves | Verdict |
|---|---|---|---|---|---|---|---|---|---|
| The desk's own exit | +0.014 | −0.042 | 36.4 | −169.640 | -1.51 | — | — | — | — |
| Target 1R | +0.006 | −0.049 | 50.7 | −199.990 | -2.59 | −0.005 (t -0.3) | 1 | +0.006 / −0.021 | no better |
| Target 2R | −0.003 | −0.058 | 33.7 | −235.490 | -2.2 | −0.044 (t -1.39) | 1 | −0.017 / −0.015 | no better |
| Target 3R | −0.007 | −0.063 | 25.4 | −253.430 | -1.71 | −0.028 (t -1.56) | 1 | −0.022 / −0.019 | no better |
| Trailing stop (1R behind from +1R) | +0.014 | −0.041 | 47.7 | −167.470 | -1.44 | −0.012 (t -0.73) | 1 | +0.000 / +0.001 | no better |

## Engulf plan (with the Daily) (eg, n 2149, 2025-12-31 to 2026-11-20)

| Exit | Before costs, R a trade | After costs | Win % | Total after costs | Month t | Against own exit (after costs) | Holm p | Halves | Verdict |
|---|---|---|---|---|---|---|---|---|---|
| The desk's own exit | −0.074 | −0.154 | 31.1 | −330.380 | -5 | — | — | — | — |
| Target 1R | −0.137 | −0.217 | 43.4 | −466.090 | -5.68 | −0.114 (t -2.27) | 1 | −0.113 / −0.014 | no better |
| Target 2R | −0.074 | −0.154 | 31.1 | −330.380 | -5 | +0.000 (t 1.71) | 1 | +0.000 / +0.000 | no better |
| Target 3R | −0.051 | −0.131 | 23.9 | −281.380 | -3.05 | +0.007 (t 0.28) | 1 | +0.034 / +0.012 | no better |
| Trailing stop (1R behind from +1R) | +0.035 | −0.045 | 39.2 | −95.960 | -1.39 | +0.056 (t 1.15) | 1 | +0.101 / +0.117 | no better |

## Engulf short method (eg, n 2146, 2025-12-31 to 2026-11-20)

| Exit | Before costs, R a trade | After costs | Win % | Total after costs | Month t | Against own exit (after costs) | Holm p | Halves | Verdict |
|---|---|---|---|---|---|---|---|---|---|
| The desk's own exit | −0.075 | −0.156 | 31 | −335.450 | -5.35 | — | — | — | — |
| Target 1R | −0.139 | −0.220 | 43.2 | −472.460 | -5.66 | −0.085 (t -2.8) | 0.2964 | −0.094 / −0.034 | no better |
| Target 2R | −0.076 | −0.158 | 30.9 | −338.450 | -5.46 | −0.001 (t -1) | 1 | +0.000 / −0.003 | no better |
| Target 3R | −0.064 | −0.145 | 23.6 | −311.060 | -3.33 | +0.047 (t 1.24) | 1 | −0.002 / +0.024 | no better |
| Trailing stop (1R behind from +1R) | +0.022 | −0.060 | 39.1 | −128.320 | -2.52 | +0.133 (t 3.42) | 0.037 | +0.107 / +0.086 | better |

## Engulf direct entry (eg, n 41, 2026-01-05 to 2026-11-02)

| Exit | Before costs, R a trade | After costs | Win % | Total after costs | Month t | Against own exit (after costs) | Holm p | Halves | Verdict |
|---|---|---|---|---|---|---|---|---|---|
| The desk's own exit | +0.071 | −0.012 | 14.6 | −0.480 | -0.02 | — | — | — | — |
| Target 1R | −0.463 | −0.546 | 26.8 | −22.370 | -2.73 | −0.537 (t -1.19) | 1 | −0.635 / −0.438 | no better |
| Target 2R | −0.342 | −0.424 | 22 | −17.370 | -1.6 | −0.445 (t -0.97) | 1 | −0.285 / −0.533 | no better |
| Target 3R | −0.220 | −0.302 | 19.5 | −12.370 | -0.99 | −0.335 (t -0.7) | 1 | −0.135 / −0.438 | no better |
| Trailing stop (1R behind from +1R) | −0.125 | −0.207 | 24.4 | −8.490 | -0.61 | −0.224 (t -0.71) | 1 | −0.102 / −0.284 | no better |

## MSNR with the direction, 12-16 UTC (msnr, n 1459, 2025-12-31 to 2026-11-20)

| Exit | Before costs, R a trade | After costs | Win % | Total after costs | Month t | Against own exit (after costs) | Holm p | Halves | Verdict |
|---|---|---|---|---|---|---|---|---|---|
| The desk's own exit | +0.002 | −0.090 | 40 | −131.110 | -3.34 | — | — | — | — |
| Target 1R | −0.042 | −0.133 | 48 | −194.280 | -4.97 | −0.061 (t -2.73) | 0.3547 | −0.016 / −0.071 | no better |
| Target 2R | +0.028 | −0.064 | 34.5 | −92.860 | -1.79 | +0.047 (t 1.8) | 1 | +0.008 / +0.044 | no better |
| Target 3R | +0.044 | −0.047 | 26.4 | −69.020 | -1.04 | +0.106 (t 1.58) | 1 | +0.045 / +0.040 | no better |
| Trailing stop (1R behind from +1R) | +0.029 | −0.063 | 43.5 | −92.020 | -1.56 | +0.105 (t 1.37) | 1 | +0.026 / +0.027 | no better |

## MSNR with the direction, other hours (msnr, n 5440, 2025-12-31 to 2026-11-20)

| Exit | Before costs, R a trade | After costs | Win % | Total after costs | Month t | Against own exit (after costs) | Holm p | Halves | Verdict |
|---|---|---|---|---|---|---|---|---|---|
| The desk's own exit | +0.007 | −0.107 | 40.8 | −580.540 | -6.05 | — | — | — | — |
| Target 1R | −0.013 | −0.127 | 50 | −688.870 | -8.11 | −0.023 (t -2.16) | 1 | −0.013 / −0.026 | no better |
| Target 2R | +0.030 | −0.083 | 35 | −452.680 | -4.31 | +0.037 (t 2.38) | 0.9349 | +0.011 / +0.036 | no better |
| Target 3R | +0.035 | −0.078 | 26.5 | −425.210 | -3.77 | +0.020 (t 1.52) | 1 | +0.029 / +0.028 | no better |
| Trailing stop (1R behind from +1R) | +0.050 | −0.064 | 44.8 | −348.130 | -2.51 | +0.053 (t 2.73) | 0.3547 | +0.060 / +0.025 | no better |

## MSNR gold plan (msnr, n 351, 2025-12-31 to 2026-11-17)

| Exit | Before costs, R a trade | After costs | Win % | Total after costs | Month t | Against own exit (after costs) | Holm p | Halves | Verdict |
|---|---|---|---|---|---|---|---|---|---|
| The desk's own exit | −0.299 | −0.373 | 17.7 | −131.090 | -3.79 | — | — | — | — |
| Target 1R | −0.328 | −0.402 | 33.9 | −141.090 | -5.56 | +0.079 (t 0.66) | 1 | −0.114 / +0.057 | no better |
| Target 2R | −0.271 | −0.345 | 24.5 | −121.090 | -4.33 | +0.044 (t 1.04) | 1 | +0.046 / +0.011 | no better |
| Target 3R | −0.299 | −0.373 | 17.7 | −131.090 | -3.79 | +0.000 (t -1) | 1 | +0.000 / +0.000 | no better |
| Trailing stop (1R behind from +1R) | −0.184 | −0.258 | 31.1 | −90.710 | -3.71 | +0.175 (t 1.89) | 1 | +0.135 / +0.095 | no better |

## MSNR gold plan, QM entry (msnr, n 42, 2026-01-05 to 2026-11-11)

| Exit | Before costs, R a trade | After costs | Win % | Total after costs | Month t | Against own exit (after costs) | Holm p | Halves | Verdict |
|---|---|---|---|---|---|---|---|---|---|
| The desk's own exit | +0.143 | +0.068 | 28.6 | +2.850 | 0.27 | — | — | — | — |
| Target 1R | −0.143 | −0.218 | 42.9 | −9.150 | -1.66 | −0.441 (t -1.62) | 1 | −0.200 / −0.364 | no better |
| Target 2R | −0.071 | −0.146 | 31 | −6.150 | -0.73 | −0.246 (t -1.62) | 1 | −0.100 / −0.318 | no better |
| Target 3R | +0.143 | +0.068 | 28.6 | +2.850 | 0.27 | +0.000 (t n/a) | 1 | +0.000 / +0.000 | no better |
| Trailing stop (1R behind from +1R) | +0.114 | +0.039 | 40.5 | +1.630 | 0.14 | −0.057 (t -0.32) | 1 | −0.086 / +0.023 | no better |

## LIT, the rule's execution (lit, n 45, 2026-01-02 to 2026-11-16)

| Exit | Before costs, R a trade | After costs | Win % | Total after costs | Month t | Against own exit (after costs) | Holm p | Halves | Verdict |
|---|---|---|---|---|---|---|---|---|---|
| The desk's own exit | +0.263 | +0.093 | 24.4 | +4.210 | 0.4 | — | — | — | — |
| Target 1R | −0.111 | −0.281 | 44.4 | −12.620 | -1.59 | −0.418 (t -1.17) | 1 | −0.656 / −0.104 | no better |
| Target 2R | +0.200 | +0.031 | 40 | +1.380 | 0.16 | −0.067 (t -0.2) | 1 | −0.156 / +0.026 | no better |
| Target 3R | +0.221 | +0.052 | 31.1 | +2.330 | 0.3 | −0.176 (t -1.27) | 1 | −0.020 / −0.063 | no better |
| Trailing stop (1R behind from +1R) | +0.177 | +0.007 | 40 | +0.340 | 0.03 | −0.251 (t -0.71) | 1 | −0.121 / −0.053 | no better |

## LIT, loose limit (lit, n 576, 2025-12-31 to 2026-11-20)

| Exit | Before costs, R a trade | After costs | Win % | Total after costs | Month t | Against own exit (after costs) | Holm p | Halves | Verdict |
|---|---|---|---|---|---|---|---|---|---|
| The desk's own exit | −0.046 | −0.149 | 20.8 | −85.570 | -1.48 | — | — | — | — |
| Target 1R | −0.080 | −0.182 | 46 | −105.060 | -2.54 | −0.039 (t -0.41) | 1 | −0.124 / +0.056 | no better |
| Target 2R | −0.046 | −0.148 | 31.9 | −85.530 | -2.19 | −0.012 (t -0.2) | 1 | −0.033 / +0.033 | no better |
| Target 3R | −0.020 | −0.122 | 24.7 | −70.580 | -1.54 | +0.015 (t 0.22) | 1 | +0.050 / +0.002 | no better |
| Trailing stop (1R behind from +1R) | +0.038 | −0.065 | 41.5 | −37.400 | -1.03 | +0.065 (t 0.7) | 1 | −0.030 / +0.197 | no better |

## LIT, market on the break (lit, n 164, 2025-12-31 to 2026-11-20)

| Exit | Before costs, R a trade | After costs | Win % | Total after costs | Month t | Against own exit (after costs) | Holm p | Halves | Verdict |
|---|---|---|---|---|---|---|---|---|---|
| The desk's own exit | −0.044 | −0.111 | 25.6 | −18.270 | -1.19 | — | — | — | — |
| Target 1R | −0.071 | −0.139 | 47 | −22.760 | -2.34 | −0.003 (t -0.04) | 1 | +0.033 / −0.088 | no better |
| Target 2R | −0.114 | −0.181 | 29.9 | −29.760 | -2.07 | −0.065 (t -0.83) | 1 | −0.004 / −0.136 | no better |
| Target 3R | −0.133 | −0.200 | 22 | −32.760 | -1.69 | −0.069 (t -0.86) | 1 | +0.033 / −0.209 | no better |
| Trailing stop (1R behind from +1R) | −0.073 | −0.141 | 43.9 | −23.080 | -1.47 | −0.011 (t -0.14) | 1 | +0.133 / −0.192 | no better |

## Read with

- "Against own exit" compares two harnesses, not only two exits: this study fills on 5-minute candles (the fill candle can only stop) and closes a trade after 5 days, while a desk reads its own fills on its finest candles and has its own time rules. So a fixed target equal to the desk's own (the Mosha barrier's 3R, the MSNR QM's 3R) can still differ from the booked figure: read the four exits against each other first, and "against own exit" second.

## What this is not

- In sample: these entries were built on these candles; the best exit chosen after seeing it is a fit.
- Each trade was run alone: a desk holding one position at a time would have taken other later trades with other exits.
- 2026 only; the Mosha desk from late July (about four months), so its month t rests on few months.
- Nothing live changed: no desk, rule, stop or record reads this.
