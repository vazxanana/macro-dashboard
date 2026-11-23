# Evening methods: do the owner's methods work where the plain fade sits? (result)

**Verdict: PASS. 1 of 10 readings pass; R5 (M15 box close-out, FADED) in the evening made +0.236R a trade before costs in 2015-26 (n 14,586, month t 15.78) and -0.185R after costs.**

Run 23 Nov 2026 as pre-registered (`PREREGISTRATION.md`, committed and pushed alone first). Research only: nothing live
changed, nothing is proposed. One run, no variants. Not an edge: R is judged BEFORE costs (as the grid7 studies); the
after-cost figure sits beside every one. Costs for xag, nzdusd, usdcad, usdchf, eurjpy are ASSUMED, not measured.

## What was run

Ten fixed readings of the owner's methods, each from its source study's own code (imported, never edited), and the plain
fade of the first M15 break as the control; every exit a 2R target; OANDA mid on ten markets; A = 2005-14, B = 2015 to
Oct 2026. Split by the UTC hour the signal candle starts: evening 20-23, day 07-16, other 00-06 and 17-19. A reading passes
only if, in A and in B: evening beats day (Welch t >= 2), the evening cell is positive with month-sum t >= 2 (n >= 300), and
it beats the plain fade in the evening (Welch t >= 2); Holm over the 10 tests on the weakest of the six. Per-trade Welch t
counts overlapping trades as independent, so it can overstate.

## Checks

- Gate, plain fade, 2005-14: n 171,523 mean +0.054 (want n 171,523, +0.054): equal.
- Gate, plain fade, 2015-26: n 201,772 mean +0.042 (want n 201,769, +0.042): DIFFERENT.
- The gate differs by a handful of trades in 2015-26: the candle cache was fetched again for this run (23 Nov 2026), and the
  provider's late-2026 candles are not byte-identical to the copy fade-hour-check read; the means agree to the third decimal.
- Cut test (10 cuts): every spec known by each date equal on cut candles (xau 2006-06-14 n 2057; xau 2007-03-21 n 8595; xau 2007-11-14 n 13905; xau 2008-08-20 n 20844; xau 2009-05-13 n 27288; eurusd 2006-06-14 n 12947; eurusd 2007-03-21 n 19664; eurusd 2007-11-14 n 25454; eurusd 2008-08-20 n 32441; eurusd 2009-05-13 n 39518).
- Every trade has its stop on the losing side (the run throws otherwise).

## Primary tests (before costs)

| Test | Reading | eve-day A | eve-day B | eve A (month t) | eve B (month t) | vs fade A | vs fade B | Holm p | Pass |
|---|---|---:|---:|---:|---:|---:|---:|---:|---|
| R1 | Engulf zone first touch + M15 break, WITH | -3.82 | -4.64 | -0.109 (-3.98) | -0.143 (-5.55) | -12.04 | -11.98 | 1.000 | no |
| R2 | Engulf zone first touch + M15 break, FADED | 2.72 | 1.94 | +0.109 (4.31) | +0.076 (3.19) | -3.47 | -3.39 | 1.000 | no |
| R3 | Failed engulf on M15 (within 12 candles) | -18.31 | -14.48 | -0.118 (-13.30) | -0.103 (-10.71) | -28.99 | -24.18 | 1.000 | no |
| R4 | M15 box close-out, WITH | -13.85 | -9.64 | -0.122 (-9.97) | -0.103 (-9.38) | -25.40 | -20.81 | 1.000 | no |
| R5 | M15 box close-out, FADED | 15.28 | 15.78 | +0.245 (17.66) | +0.236 (15.78) | 2.71 | 4.08 | 0.034 | yes |
| R6 | Mosha CF M30>M5, WITH | -4.01 | -7.84 | -0.087 (-4.11) | -0.153 (-7.95) | -14.92 | -16.92 | 1.000 | no |
| R7 | Mosha CF M30>M5, FADED | 3.34 | 6.48 | +0.100 (4.46) | +0.136 (5.58) | -4.39 | -1.29 | 1.000 | no |
| R8 | Mosha CF H1>M15, WITH | -4.95 | -2.98 | -0.159 (-5.78) | -0.089 (-3.22) | -14.71 | -9.75 | 1.000 | no |
| R9 | Mosha CF H1>M15, FADED | 5.52 | 6.42 | +0.240 (8.05) | +0.211 (6.79) | 1.12 | 1.33 | 1.000 | no |
| R10 | Zone flip near, 4h, M15 close inside | 3.68 | 2.61 | +0.124 (4.46) | +0.086 (3.53) | -2.91 | -3.36 | 1.000 | no |

Plain fade, evening: A +0.204R a trade (n 26,275, month t 18.01; +0.046 after costs), B +0.169R (n 27,671, t 14.09; -0.015 after costs).

## Every cell

R a trade before costs (month t) | after costs, n.

| Reading | Hours | n A | A before (t) | A after | n B | B before (t) | B after |
|---|---|---:|---:|---:|---:|---:|---:|
| R1 Engulf zone first touch + M15 break, WITH | evening | 2,917 | -0.109 (-3.98) | -0.191 | 2,934 | -0.143 (-5.55) | -0.246 |
| R1 Engulf zone first touch + M15 break, WITH | day | 12,122 | -0.006 (-0.49) | -0.063 | 14,638 | -0.020 (-1.63) | -0.087 |
| R1 Engulf zone first touch + M15 break, WITH | other | 8,524 | -0.028 (-1.98) | -0.106 | 10,602 | -0.017 (-1.09) | -0.110 |
| R1 Engulf zone first touch + M15 break, WITH | all | 23,563 | -0.027 (-3.32) | -0.094 | 28,174 | -0.032 (-3.53) | -0.112 |
| R2 Engulf zone first touch + M15 break, FADED | evening | 2,917 | +0.109 (4.31) | +0.027 | 2,934 | +0.076 (3.19) | -0.027 |
| R2 Engulf zone first touch + M15 break, FADED | day | 12,122 | +0.031 (2.58) | -0.025 | 14,637 | +0.022 (2.24) | -0.045 |
| R2 Engulf zone first touch + M15 break, FADED | other | 8,524 | +0.044 (2.91) | -0.034 | 10,603 | +0.003 (0.17) | -0.091 |
| R2 Engulf zone first touch + M15 break, FADED | all | 23,563 | +0.046 (5.26) | -0.022 | 28,174 | +0.021 (2.74) | -0.060 |
| R3 Failed engulf on M15 (within 12 candles) | evening | 43,299 | -0.118 (-13.30) | -0.206 | 48,925 | -0.103 (-10.71) | -0.214 |
| R3 Failed engulf on M15 (within 12 candles) | day | 119,300 | +0.018 (2.98) | -0.041 | 148,098 | +0.000 (0.03) | -0.071 |
| R3 Failed engulf on M15 (within 12 candles) | other | 112,721 | -0.011 (-1.35) | -0.093 | 144,419 | -0.017 (-3.14) | -0.117 |
| R3 Failed engulf on M15 (within 12 candles) | all | 275,320 | -0.015 (-3.27) | -0.088 | 341,442 | -0.022 (-6.51) | -0.111 |
| R4 M15 box close-out, WITH | evening | 19,223 | -0.122 (-9.97) | -0.180 | 19,826 | -0.103 (-9.38) | -0.175 |
| R4 M15 box close-out, WITH | day | 66,303 | +0.019 (3.05) | -0.025 | 79,610 | -0.005 (-0.87) | -0.059 |
| R4 M15 box close-out, WITH | other | 55,620 | -0.031 (-3.72) | -0.088 | 67,701 | -0.026 (-3.84) | -0.095 |
| R4 M15 box close-out, WITH | all | 141,146 | -0.020 (-3.78) | -0.071 | 167,137 | -0.025 (-6.05) | -0.088 |
| R5 M15 box close-out, FADED | evening | 15,326 | +0.245 (17.66) | -0.108 | 14,586 | +0.236 (15.78) | -0.185 |
| R5 M15 box close-out, FADED | day | 58,959 | +0.037 (5.31) | -0.234 | 69,035 | +0.009 (1.32) | -0.328 |
| R5 M15 box close-out, FADED | other | 45,402 | +0.121 (13.70) | -0.209 | 52,576 | +0.068 (8.16) | -0.342 |
| R5 M15 box close-out, FADED | all | 119,687 | +0.095 (19.61) | -0.208 | 136,197 | +0.056 (10.26) | -0.318 |
| R6 Mosha CF M30>M5, WITH | evening | 5,798 | -0.087 (-4.11) | -0.246 | 6,430 | -0.153 (-7.95) | -0.344 |
| R6 Mosha CF M30>M5, WITH | day | 16,291 | -0.005 (-0.43) | -0.136 | 18,675 | -0.002 (-0.15) | -0.156 |
| R6 Mosha CF M30>M5, WITH | other | 16,112 | -0.041 (-3.34) | -0.196 | 18,646 | -0.048 (-4.76) | -0.230 |
| R6 Mosha CF M30>M5, WITH | all | 38,201 | -0.033 (-3.83) | -0.178 | 43,751 | -0.044 (-6.18) | -0.215 |
| R7 Mosha CF M30>M5, FADED | evening | 4,543 | +0.100 (4.46) | -0.370 | 3,952 | +0.136 (5.58) | -0.411 |
| R7 Mosha CF M30>M5, FADED | day | 14,274 | +0.016 (1.25) | -0.393 | 15,396 | -0.035 (-2.82) | -0.532 |
| R7 Mosha CF M30>M5, FADED | other | 12,239 | +0.065 (4.48) | -0.403 | 11,870 | +0.007 (0.46) | -0.555 |
| R7 Mosha CF M30>M5, FADED | all | 31,056 | +0.048 (5.19) | -0.394 | 31,218 | +0.003 (0.29) | -0.525 |
| R8 Mosha CF H1>M15, WITH | evening | 3,192 | -0.159 (-5.78) | -0.253 | 2,971 | -0.089 (-3.22) | -0.204 |
| R8 Mosha CF H1>M15, WITH | day | 4,987 | -0.011 (-0.53) | -0.099 | 6,131 | +0.001 (0.07) | -0.106 |
| R8 Mosha CF H1>M15, WITH | other | 7,148 | -0.026 (-1.42) | -0.125 | 8,418 | -0.029 (-1.72) | -0.146 |
| R8 Mosha CF H1>M15, WITH | all | 15,327 | -0.049 (-3.90) | -0.143 | 17,520 | -0.029 (-2.42) | -0.142 |
| R9 Mosha CF H1>M15, FADED | evening | 2,885 | +0.240 (8.05) | -0.145 | 2,526 | +0.211 (6.79) | -0.239 |
| R9 Mosha CF H1>M15, FADED | day | 5,080 | +0.037 (1.81) | -0.268 | 6,290 | -0.011 (-0.63) | -0.390 |
| R9 Mosha CF H1>M15, FADED | other | 6,473 | +0.114 (5.67) | -0.251 | 7,392 | +0.055 (2.78) | -0.391 |
| R9 Mosha CF H1>M15, FADED | all | 14,438 | +0.112 (7.48) | -0.236 | 16,208 | +0.054 (4.52) | -0.367 |
| R10 Zone flip near, 4h, M15 close inside | evening | 2,320 | +0.124 (4.46) | +0.077 | 2,875 | +0.086 (3.53) | +0.029 |
| R10 Zone flip near, 4h, M15 close inside | day | 7,850 | +0.015 (0.88) | -0.041 | 9,428 | +0.017 (1.09) | -0.049 |
| R10 Zone flip near, 4h, M15 close inside | other | 4,944 | +0.056 (2.72) | +0.008 | 6,210 | +0.065 (3.09) | +0.004 |
| R10 Zone flip near, 4h, M15 close inside | all | 15,114 | +0.045 (3.59) | -0.007 | 18,513 | +0.044 (3.71) | -0.019 |
| C Plain fade of the first M15 break (control) | evening | 26,275 | +0.204 (18.01) | +0.046 | 27,671 | +0.169 (14.09) | -0.015 |
| C Plain fade of the first M15 break (control) | day | 75,039 | -0.005 (-0.83) | -0.132 | 89,036 | +0.008 (1.49) | -0.129 |
| C Plain fade of the first M15 break (control) | other | 70,209 | +0.062 (8.46) | -0.092 | 85,065 | +0.036 (6.57) | -0.141 |
| C Plain fade of the first M15 break (control) | all | 171,523 | +0.054 (11.38) | -0.088 | 201,772 | +0.042 (11.33) | -0.118 |

## Per market, evening, readings that pass

### R5

| Market | n A | A before (t) | A after | n B | B before (t) | B after |
|---|---:|---:|---:|---:|---:|---:|
| xau | 733 | +0.233 (4.22) | -0.279 | 1,039 | +0.046 (0.90) | -0.352 |
| xag (cost assumed) | 193 | -0.028 (-0.29) | -0.632 | 261 | -0.086 (-1.07) | -0.587 |
| eurusd | 1,673 | +0.325 (7.94) | +0.026 | 1,459 | +0.220 (6.10) | -0.201 |
| gbpusd | 1,598 | +0.323 (7.35) | -0.030 | 1,388 | +0.295 (6.66) | -0.129 |
| usdjpy | 1,866 | +0.252 (6.76) | -0.125 | 1,933 | +0.164 (5.20) | -0.238 |
| audusd | 2,142 | +0.190 (6.18) | -0.116 | 1,848 | +0.251 (6.75) | -0.173 |
| nzdusd (cost assumed) | 2,179 | +0.194 (5.88) | -0.126 | 1,818 | +0.267 (7.15) | -0.171 |
| usdcad (cost assumed) | 1,536 | +0.314 (7.22) | -0.057 | 1,542 | +0.355 (7.25) | -0.063 |
| usdchf (cost assumed) | 1,462 | +0.341 (7.76) | -0.029 | 1,312 | +0.300 (6.82) | -0.134 |
| eurjpy (cost assumed) | 1,944 | +0.132 (3.71) | -0.222 | 1,986 | +0.241 (6.35) | -0.173 |

## What it means

R5 passed on the pre-registered BEFORE-cost bar: its evening trades beat its day trades and the plain fade's evening
trades. It is not an edge. After costs its evening cell is -0.108R a trade in 2005-14 and -0.185R in 2015-26
(month t -12.25), and no market is positive after costs in 2015-26. Its stop sits just past the close-out candle, tighter
than the plain fade's 1 ATR stop, so the same move is more R before costs and the cost is a larger share of each R. The margin
over the plain fade rests on per-trade Welch t on overlapping trades and the Holm p is just under 0.05. What it says: in the
evening, fading the M15 box close-out reads at least as well as fading the first break; neither pays its costs on these
figures. A follow-up would need the broker's own evening spreads (the tick probe) and its own pre-registration.

Nothing live changed and no rule is proposed. Never call any of these an edge; after costs every evening cell must be read
from the table above. Do not try other hour windows, exits or readings on these years.
