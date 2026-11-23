# Box grid: the swing box's close-out with it, faded, and its false break, on ten markets (result)

**Verdict: FAIL. 0 of 46 box cells pass; the best confirmation cell, m15 fade box all, made +0.166R a trade before costs in 2015-26 (n 135,530, month t 15.16; discovery +0.232R, t 19.84), Welch t against the plain fade -0.55 / 0.55.**

Run 23 Nov 2026 as pre-registered (`PREREGISTRATION.md`, committed and pushed alone first). Research only: nothing live
changed, nothing is proposed. One run, no variants.

## What was run

The box from the last confirmed swing low to the last confirmed swing high (2 candles a side, `edgekit` `boxesHL`) on M15 and
H1, closed out by a candle closing beyond it. Events: the close-out traded WITH it (stop past the box's other side + 0.1 ATR),
the close-out FADED, and the first false break of each edge (a wick beyond with the close inside, or a close-out closed back
inside within 2 candles) traded back into the box (both: stop past the break's extreme + 0.1 ATR). Market entry at the next
5-minute open; exits 1R, 2R or the box's other side (only when 1R or more away). Context at 1R: box size under / over 2 ATR,
and the higher timeframe's box (H1 for M15, H4 for H1) standing, last closed out the same way, or the other way. 46 cells,
ten markets pooled, discovery = fills 2005-2014, confirmation = 2015 to October 2026, judged before costs on month sums, Holm
over the 46 confirmation tests, and each cell against the plain `grid7-wide-fade` rule on its timeframe and exit (Welch t >= 2
in both windows).
Costs beside: the demo figures for gold and the four majors; **ASSUMED, not measured** for xag, nzdusd, usdcad, usdchf, eurjpy.

## The bar, cell by cell

- n >= 300 in both windows: 46 of 46.
- Mean R > 0 and month t >= 2 in discovery: 24; in confirmation: 6.
- Holm-adjusted p < 0.05: 5.
- Beats its control (Welch t >= 2 in both windows): 8.
- **All five: 0.**
- Of those, positive after costs in both windows: 0.
- Side-flipped cells clearing bars 1-3 (n, discovery, confirmation): 8 (m15 with 1R all; m15 with 2R all; h1 with 2R all; m15 with 1R small; m15 with 1R large; m15 with 1R htf-in; m15 with 1R htf-same; m15 with 1R htf-other).

## The controls (the plain fade, `grid7-wide-fade` rule)

| Control | n 05-14 | R 05-14 (t) | net 05-14 | n 15-26 | R 15-26 (t) | net 15-26 | flipped R 15-26 (t) |
|---|---:|---:|---:|---:|---:|---:|---:|
| control m15 fade ext 1R | 145,032 | -0.030 (-8.39) | -0.348 | 164,557 | -0.053 (-14.50) | -0.443 | -0.168 (-43.12) |
| control m15 fade ext 2R | 145,032 | +0.094 (19.57) | -0.225 | 164,557 | +0.054 (12.15) | -0.335 | -0.097 (-21.96) |
| control m15 fade ext swing | 135,982 | +0.241 (17.80) | -0.079 | 151,876 | +0.158 (15.46) | -0.234 | -0.045 (-4.88) |
| control h1 fade ext 1R | 43,062 | +0.035 (5.63) | -0.155 | 50,178 | -0.009 (-1.59) | -0.238 | -0.084 (-15.67) |
| control h1 fade ext 2R | 43,062 | +0.105 (12.31) | -0.084 | 50,178 | +0.040 (5.17) | -0.189 | -0.048 (-6.68) |
| control h1 fade ext swing | 39,710 | +0.157 (7.97) | -0.033 | 45,990 | +0.073 (3.62) | -0.158 | -0.034 (-1.88) |

## Every cell

R a trade before costs (month-sum t), after costs beside; "vs ctl" = Welch t of the cell's R against its control's, discovery /
confirmation; flipped = the same cell traded the other way.

| Cell | n 05-14 | R 05-14 (t) | net 05-14 | n 15-26 | R 15-26 (t) | net 15-26 | Holm | vs ctl | Flipped R 15-26 (t) | Pass |
|---|---:|---:|---:|---:|---:|---:|---:|---:|---:|---|
| m15 with 1R all | 141,146 | -0.024 (-7.44) | -0.075 | 167,129 | -0.024 (-8.71) | -0.086 | 1.000 | 1.53 / 8.61 | +0.020 (7.46) | no |
| m15 with 2R all | 141,146 | -0.020 (-3.78) | -0.071 | 167,129 | -0.025 (-6.04) | -0.088 | 1.000 | -22.34 / -16.80 | +0.024 (7.46) | no |
| m15 fade 1R all | 119,687 | -0.029 (-7.81) | -0.332 | 136,197 | -0.050 (-11.27) | -0.424 | 1.000 | 0.28 / 0.80 | -0.161 (-34.44) | no |
| m15 fade 2R all | 119,687 | +0.095 (19.61) | -0.208 | 136,197 | +0.056 (10.26) | -0.318 | 0.000 | 0.29 / 0.30 | -0.093 (-18.27) | no |
| m15 fade box all | 119,258 | +0.232 (19.84) | -0.072 | 135,530 | +0.166 (15.16) | -0.209 | 0.000 | -0.55 / 0.55 | -0.054 (-5.63) | no |
| m15 false 1R all | 104,210 | +0.022 (6.97) | -0.144 | 123,758 | -0.000 (-0.05) | -0.203 | 1.000 | 12.49 / 13.86 | -0.031 (-11.17) | no |
| m15 false 2R all | 104,210 | +0.049 (10.38) | -0.117 | 123,758 | +0.022 (5.62) | -0.181 | 0.000 | -7.60 / -5.97 | -0.019 (-4.28) | no |
| m15 false box all | 88,162 | +0.061 (8.19) | -0.118 | 103,419 | +0.034 (5.15) | -0.186 | 0.000 | -13.84 / -10.47 | -0.024 (-3.38) | no |
| h1 with 1R all | 37,732 | -0.008 (-1.47) | -0.032 | 43,993 | -0.006 (-1.28) | -0.036 | 1.000 | -6.47 / 0.47 | +0.005 (1.01) | no |
| h1 with 2R all | 37,732 | -0.002 (-0.24) | -0.026 | 43,993 | +0.002 (0.22) | -0.028 | 1.000 | -11.91 / -4.66 | +0.014 (2.52) | no |
| h1 fade 1R all | 36,137 | +0.038 (6.10) | -0.141 | 41,713 | -0.013 (-2.20) | -0.236 | 1.000 | 0.51 / -0.56 | -0.073 (-12.31) | no |
| h1 fade 2R all | 36,137 | +0.103 (11.57) | -0.077 | 41,713 | +0.034 (4.45) | -0.189 | 0.000 | -0.25 / -0.70 | -0.038 (-5.26) | no |
| h1 fade box all | 36,068 | +0.136 (6.24) | -0.044 | 41,555 | +0.050 (2.69) | -0.174 | 0.164 | -0.76 / -0.98 | -0.033 (-1.85) | no |
| h1 false 1R all | 28,307 | +0.029 (5.01) | -0.064 | 33,155 | -0.000 (-0.02) | -0.113 | 1.000 | -0.74 / 1.29 | -0.011 (-2.16) | no |
| h1 false 2R all | 28,307 | +0.037 (4.47) | -0.056 | 33,155 | +0.010 (1.43) | -0.102 | 1.000 | -6.22 / -2.98 | +0.006 (0.78) | no |
| h1 false box all | 23,760 | +0.035 (2.22) | -0.067 | 27,438 | -0.014 (-1.10) | -0.138 | 1.000 | -5.14 / -4.12 | -0.010 (-0.75) | no |
| m15 with 1R small | 45,745 | -0.033 (-6.40) | -0.099 | 55,888 | -0.042 (-9.00) | -0.122 | 1.000 | -0.70 / 2.31 | +0.037 (7.80) | no |
| m15 with 1R large | 95,401 | -0.020 (-5.21) | -0.063 | 111,241 | -0.014 (-4.70) | -0.067 | 1.000 | 2.51 / 10.29 | +0.012 (3.90) | no |
| m15 with 1R htf-in | 73,105 | -0.018 (-4.27) | -0.072 | 86,679 | -0.018 (-4.81) | -0.082 | 1.000 | 2.71 / 8.61 | +0.015 (4.02) | no |
| m15 with 1R htf-same | 37,485 | -0.027 (-3.88) | -0.072 | 44,979 | -0.033 (-5.75) | -0.091 | 1.000 | 0.45 / 3.87 | +0.030 (5.23) | no |
| m15 with 1R htf-other | 30,553 | -0.035 (-5.74) | -0.085 | 35,471 | -0.025 (-4.16) | -0.088 | 1.000 | -0.94 / 4.91 | +0.021 (3.52) | no |
| m15 fade 1R small | 39,595 | -0.030 (-5.68) | -0.321 | 46,784 | -0.046 (-8.14) | -0.407 | 1.000 | 0.00 / 1.35 | -0.144 (-27.10) | no |
| m15 fade 1R large | 80,092 | -0.028 (-6.74) | -0.337 | 89,413 | -0.053 (-10.33) | -0.433 | 1.000 | 0.37 / 0.18 | -0.171 (-30.34) | no |
| m15 fade 1R htf-in | 60,463 | -0.038 (-7.70) | -0.354 | 69,052 | -0.049 (-10.60) | -0.434 | 1.000 | -1.70 / 0.93 | -0.160 (-30.00) | no |
| m15 fade 1R htf-same | 32,882 | -0.021 (-3.27) | -0.302 | 37,898 | -0.052 (-7.22) | -0.407 | 1.000 | 1.34 / 0.29 | -0.163 (-21.66) | no |
| m15 fade 1R htf-other | 26,341 | -0.016 (-2.24) | -0.319 | 29,247 | -0.052 (-7.11) | -0.422 | 1.000 | 2.04 / 0.24 | -0.162 (-22.77) | no |
| m15 false 1R small | 32,384 | +0.017 (3.10) | -0.143 | 39,663 | +0.000 (0.08) | -0.197 | 1.000 | 7.49 / 9.46 | -0.028 (-5.40) | no |
| m15 false 1R large | 71,826 | +0.024 (6.16) | -0.145 | 84,095 | -0.000 (-0.11) | -0.205 | 1.000 | 11.62 / 12.28 | -0.033 (-9.39) | no |
| m15 false 1R htf-in | 54,128 | +0.020 (4.80) | -0.156 | 64,511 | +0.002 (0.48) | -0.209 | 1.000 | 9.73 / 11.69 | -0.034 (-8.94) | no |
| m15 false 1R htf-same | 26,111 | +0.034 (5.13) | -0.115 | 31,487 | +0.007 (1.19) | -0.181 | 1.000 | 9.25 / 9.61 | -0.037 (-6.59) | no |
| m15 false 1R htf-other | 23,971 | +0.013 (2.10) | -0.149 | 27,760 | -0.012 (-1.93) | -0.212 | 1.000 | 6.10 / 6.23 | -0.018 (-2.82) | no |
| h1 with 1R small | 12,358 | -0.023 (-2.24) | -0.055 | 14,199 | +0.001 (0.07) | -0.040 | 1.000 | -5.81 / 1.06 | -0.003 (-0.36) | no |
| h1 with 1R large | 25,374 | -0.001 (-0.24) | -0.021 | 29,794 | -0.010 (-1.64) | -0.033 | 1.000 | -5.02 / -0.06 | +0.009 (1.50) | no |
| h1 with 1R htf-in | 18,346 | +0.005 (0.72) | -0.019 | 22,112 | +0.003 (0.40) | -0.027 | 1.000 | -3.63 / 1.61 | -0.004 (-0.61) | no |
| h1 with 1R htf-same | 11,171 | -0.023 (-1.98) | -0.046 | 12,730 | -0.013 (-1.21) | -0.041 | 1.000 | -6.08 / -0.41 | +0.012 (1.10) | no |
| h1 with 1R htf-other | 8,215 | -0.018 (-1.53) | -0.043 | 9,151 | -0.019 (-1.61) | -0.050 | 1.000 | -4.82 / -0.96 | +0.018 (1.48) | no |
| h1 fade 1R small | 11,873 | +0.053 (4.99) | -0.121 | 13,549 | -0.007 (-0.75) | -0.227 | 1.000 | 1.80 / 0.25 | -0.066 (-7.01) | no |
| h1 fade 1R large | 24,264 | +0.031 (4.46) | -0.151 | 28,164 | -0.016 (-2.28) | -0.240 | 1.000 | -0.45 / -0.89 | -0.076 (-10.82) | no |
| h1 fade 1R htf-in | 17,481 | +0.023 (2.87) | -0.161 | 20,867 | -0.029 (-3.91) | -0.255 | 1.000 | -1.26 / -2.42 | -0.061 (-8.47) | no |
| h1 fade 1R htf-same | 10,749 | +0.056 (5.25) | -0.118 | 12,137 | -0.001 (-0.11) | -0.219 | 1.000 | 2.00 / 0.81 | -0.080 (-8.04) | no |
| h1 fade 1R htf-other | 7,907 | +0.047 (3.97) | -0.130 | 8,709 | +0.010 (0.82) | -0.213 | 1.000 | 1.03 / 1.63 | -0.091 (-7.40) | no |
| h1 false 1R small | 8,857 | +0.032 (3.00) | -0.057 | 10,021 | +0.005 (0.53) | -0.104 | 1.000 | -0.20 / 1.34 | -0.017 (-1.63) | no |
| h1 false 1R large | 19,450 | +0.028 (3.53) | -0.067 | 23,134 | -0.003 (-0.43) | -0.117 | 1.000 | -0.83 / 0.84 | -0.008 (-1.33) | no |
| h1 false 1R htf-in | 13,707 | +0.013 (1.53) | -0.083 | 16,979 | +0.003 (0.40) | -0.112 | 1.000 | -2.18 / 1.35 | -0.014 (-1.95) | no |
| h1 false 1R htf-same | 7,717 | +0.065 (5.13) | -0.023 | 8,697 | -0.010 (-1.01) | -0.119 | 1.000 | 2.44 / -0.04 | -0.001 (-0.09) | no |
| h1 false 1R htf-other | 6,882 | +0.020 (1.54) | -0.073 | 7,479 | +0.004 (0.37) | -0.107 | 1.000 | -1.11 / 1.10 | -0.015 (-1.23) | no |

## Checks

- Cut test: 10 cuts on xau, gbpusd: 344,586 events known by the cut dates, 0 missing or extra when the candles are cut there.
- Every trade has its stop on the losing side of the fill (the run throws otherwise); a fill at or past the stop and a risk under the round-trip cost are no trades.
- Exclusions: the data-quality audit's bad intervals (`combo-grid-2` `exclusions`).

| Market | candles from | box events | control signals | trades simulated | dropped (bad data) | past the stop | risk under cost | unresolved |
|---|---|---:|---:|---:|---:|---:|---:|---:|
| xau | 2006-03-19 | 60,553 | 44,349 | 121,691 | 8 | 671 | 17,012 | 4 |
| xag | 2006-03-19 | 59,101 | 44,574 | 73,673 | 212 | 2,936 | 60,517 | 6 |
| eurusd | 2004-01-01 | 69,438 | 49,724 | 152,328 | 47 | 522 | 5,429 | 3 |
| gbpusd | 2004-01-01 | 69,918 | 49,435 | 151,874 | 118 | 634 | 6,015 | 8 |
| usdjpy | 2004-01-01 | 70,072 | 48,700 | 149,765 | 88 | 492 | 8,137 | 13 |
| audusd | 2004-01-01 | 75,969 | 50,388 | 160,785 | 90 | 1,144 | 7,176 | 3 |
| nzdusd | 2004-01-01 | 75,856 | 49,832 | 156,933 | 5 | 931 | 10,148 | 3 |
| usdcad | 2004-01-01 | 70,482 | 50,174 | 150,163 | 105 | 653 | 9,186 | 9 |
| usdchf | 2004-01-01 | 69,404 | 49,243 | 145,110 | 109 | 1,623 | 10,524 | 5 |
| eurjpy | 2004-01-01 | 71,863 | 48,668 | 153,730 | 6 | 429 | 6,409 | 5 |

## What it means

No box cell clears the bar: on ten markets and 22 years the box's close-out, faded or traded with it, and its false break
do not beat the plain fade of the first structure break before costs in both decades (and the plain fade itself loses after
costs). Do not re-test variants of these 46 cells on these years. Nothing live changed; no rule is proposed.
