# Structure breaks by kind: BOS against ChoCh, three entries, ten markets (result)

**Verdict: FAIL. 0 of 51 cells pass; the best confirmation cell, m15 fade BOS 2R, made +0.066R a trade before costs in 2015-26 (n 81,768, month t 10.99; against its control Welch t 1.94), -0.324R after costs.**

Run 23 Nov 2026 as pre-registered (`PREREGISTRATION.md`, committed and pushed alone first). Research only: nothing live
changed, nothing is proposed. One run, no variants.

## What was run

Every structure break (a close beyond the last confirmed swing, 3 candles a side; `edgekit` `structure`) on M15, H1 or H4,
labelled BOS (with the structure side before it) or ChoCh (the first break against it), with the BOS count of its leg and
the structure side of the next timeframe up (M15 -> H1, H1 -> H4, H4 -> D1). Entries: WITH the break at the next 5-minute
open (stop past the opposite swing + 0.1 ATR), FADED (stop past the break candle's extreme + 0.1 ATR), and on the RETEST
(price back to the broken level on the timeframe one step lower, then a close back beyond it in the break's direction;
stop as WITH). Exits 1R / 2R, time limit 1 / 2 / 5 days. 36 cells by kind per timeframe, 9 by BOS count and 6 by the next
timeframe up (timeframes pooled, 1R): 51. Ten markets pooled, OANDA mid 5-minute candles; discovery = fills 2005-2014,
confirmation = 2015 to October 2026. Judged before costs on month sums, Holm over the 51 confirmation tests, and each cell
against its control (the plain `grid7-wide-fade` rule: fade every break, ext stop, same timeframe and exit) by a per-trade
Welch t >= 2 in both windows. Costs beside; **ASSUMED, not measured** for xag, nzdusd, usdcad, usdchf, eurjpy.

## The bar, cell by cell

- n >= 300 in both windows: 51 of 51.
- Mean R > 0 and month t >= 2 in discovery: 9; in confirmation: 4; both: 4.
- Holm-adjusted p < 0.05: 3.
- First four checks together (the before-cost bar without the control): 3 (m15 fade BOS 2R; m15 fade ChoCh 2R; h1 fade BOS 2R).
- Beats its control (Welch t >= 2 in both windows): 3.
- **All five: 0.**
- Of those, positive after costs in both windows: 0.

## Every cell

R a trade before costs (month-sum t), after costs beside; "cost R" = mean round-trip cost / risk in 2015-26; control = the
plain fade rule on the same timeframe and exit (pooled timeframes for parts B and C); Welch = cell against control, per trade.

| Cell | n 05-14 | R 05-14 (t) | net 05-14 | n 15-26 | R 15-26 (t) | net 15-26 | cost R | Holm | control R 05-14 / 15-26 | Welch 05-14 / 15-26 | Pass |
|---|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|---|
| m15 with BOS 1R | 87,463 | -0.017 (-3.37) | -0.071 | 103,185 | -0.026 (-6.25) | -0.090 | 0.064 | 1.000 | -0.030 / -0.053 | 3.05 / 7.00 | no |
| m15 with BOS 2R | 87,463 | -0.012 (-1.47) | -0.065 | 103,185 | -0.029 (-4.66) | -0.093 | 0.064 | 1.000 | +0.094 / +0.054 | -18.53 / -15.70 | no |
| m15 with ChoCh 1R | 78,085 | -0.022 (-5.72) | -0.081 | 89,575 | -0.018 (-5.53) | -0.087 | 0.070 | 1.000 | -0.030 / -0.053 | 1.74 / 8.63 | no |
| m15 with ChoCh 2R | 78,085 | -0.020 (-4.01) | -0.079 | 89,575 | -0.017 (-3.91) | -0.087 | 0.070 | 1.000 | +0.094 / +0.054 | -19.01 / -12.67 | no |
| m15 fade BOS 1R | 72,126 | -0.029 (-6.10) | -0.345 | 81,768 | -0.046 (-10.65) | -0.437 | 0.390 | 1.000 | -0.030 / -0.053 | 0.19 / 1.54 | no |
| m15 fade BOS 2R | 72,126 | +0.098 (15.05) | -0.218 | 81,768 | +0.066 (10.99) | -0.324 | 0.390 | 0.000 | +0.094 / +0.054 | 0.63 / 1.94 | no |
| m15 fade ChoCh 1R | 72,906 | -0.031 (-6.62) | -0.351 | 82,792 | -0.060 (-12.55) | -0.449 | 0.389 | 1.000 | -0.030 / -0.053 | -0.19 / -1.53 | no |
| m15 fade ChoCh 2R | 72,906 | +0.089 (13.21) | -0.231 | 82,792 | +0.042 (7.14) | -0.346 | 0.389 | 0.000 | +0.094 / +0.054 | -0.63 / -1.94 | no |
| m15 retest BOS 1R | 60,821 | -0.018 (-3.27) | -0.073 | 72,886 | -0.027 (-6.22) | -0.092 | 0.065 | 1.000 | -0.030 / -0.053 | 2.47 / 6.09 | no |
| m15 retest BOS 2R | 60,821 | -0.014 (-1.58) | -0.069 | 72,886 | -0.029 (-4.27) | -0.095 | 0.065 | 1.000 | +0.094 / +0.054 | -16.79 / -14.11 | no |
| m15 retest ChoCh 1R | 55,299 | -0.015 (-3.29) | -0.075 | 63,765 | -0.014 (-3.74) | -0.085 | 0.072 | 1.000 | -0.030 / -0.053 | 3.05 / 8.51 | no |
| m15 retest ChoCh 2R | 55,299 | -0.010 (-1.64) | -0.070 | 63,765 | -0.014 (-2.67) | -0.086 | 0.072 | 1.000 | +0.094 / +0.054 | -15.34 / -10.84 | no |
| h1 with BOS 1R | 22,699 | -0.011 (-1.25) | -0.035 | 26,561 | -0.002 (-0.20) | -0.030 | 0.029 | 1.000 | +0.035 / -0.009 | -6.05 / 1.08 | no |
| h1 with BOS 2R | 22,699 | -0.002 (-0.19) | -0.026 | 26,561 | +0.003 (0.22) | -0.026 | 0.029 | 1.000 | +0.105 / +0.040 | -10.68 / -4.07 | no |
| h1 with ChoCh 1R | 19,198 | +0.015 (2.27) | -0.013 | 22,164 | -0.009 (-1.47) | -0.041 | 0.032 | 1.000 | +0.035 / -0.009 | -2.43 / 0.07 | no |
| h1 with ChoCh 2R | 19,198 | +0.019 (2.09) | -0.008 | 22,164 | +0.001 (0.18) | -0.031 | 0.032 | 1.000 | +0.105 / +0.040 | -7.87 / -3.89 | no |
| h1 fade BOS 1R | 21,556 | +0.047 (6.36) | -0.141 | 25,100 | +0.003 (0.42) | -0.227 | 0.230 | 1.000 | +0.035 / -0.009 | 1.46 / 1.59 | no |
| h1 fade BOS 2R | 21,556 | +0.126 (11.62) | -0.062 | 25,100 | +0.057 (5.40) | -0.173 | 0.230 | 0.000 | +0.105 / +0.040 | 1.69 / 1.52 | no |
| h1 fade ChoCh 1R | 21,506 | +0.022 (2.50) | -0.168 | 25,079 | -0.022 (-2.74) | -0.250 | 0.228 | 1.000 | +0.035 / -0.009 | -1.46 / -1.60 | no |
| h1 fade ChoCh 2R | 21,506 | +0.085 (6.52) | -0.106 | 25,079 | +0.023 (2.35) | -0.205 | 0.228 | 0.486 | +0.105 / +0.040 | -1.70 / -1.53 | no |
| h1 retest BOS 1R | 15,409 | -0.020 (-2.01) | -0.045 | 18,141 | -0.005 (-0.59) | -0.035 | 0.030 | 1.000 | +0.035 / -0.009 | -6.37 / 0.51 | no |
| h1 retest BOS 2R | 15,409 | -0.013 (-0.99) | -0.038 | 18,141 | -0.008 (-0.63) | -0.038 | 0.030 | 1.000 | +0.105 / +0.040 | -10.43 / -4.62 | no |
| h1 retest ChoCh 1R | 13,380 | +0.010 (1.13) | -0.019 | 15,514 | -0.003 (-0.48) | -0.037 | 0.034 | 1.000 | +0.035 / -0.009 | -2.69 / 0.67 | no |
| h1 retest ChoCh 2R | 13,380 | +0.012 (1.05) | -0.017 | 15,514 | -0.000 (-0.00) | -0.034 | 0.034 | 1.000 | +0.105 / +0.040 | -7.54 / -3.56 | no |
| h4 with BOS 1R | 6,623 | -0.004 (-0.27) | -0.016 | 7,373 | +0.007 (0.47) | -0.006 | 0.013 | 1.000 | +0.030 / +0.026 | -2.58 / -1.52 | no |
| h4 with BOS 2R | 6,623 | +0.014 (0.66) | +0.002 | 7,373 | +0.010 (0.56) | -0.003 | 0.013 | 1.000 | +0.018 / +0.037 | -0.28 / -1.66 | no |
| h4 with ChoCh 1R | 5,254 | -0.003 (-0.24) | -0.015 | 5,935 | +0.001 (0.10) | -0.013 | 0.015 | 1.000 | +0.030 / +0.026 | -2.26 / -1.79 | no |
| h4 with ChoCh 2R | 5,254 | +0.006 (0.37) | -0.006 | 5,935 | +0.015 (0.89) | +0.001 | 0.015 | 1.000 | +0.018 / +0.037 | -0.69 / -1.24 | no |
| h4 fade BOS 1R | 6,538 | +0.039 (2.57) | -0.071 | 7,250 | +0.026 (1.84) | -0.104 | 0.130 | 1.000 | +0.030 / +0.026 | 0.57 / 0.00 | no |
| h4 fade BOS 2R | 6,538 | +0.030 (1.47) | -0.080 | 7,250 | +0.039 (1.83) | -0.091 | 0.130 | 1.000 | +0.018 / +0.037 | 0.52 / 0.09 | no |
| h4 fade ChoCh 1R | 5,791 | +0.020 (1.30) | -0.082 | 6,538 | +0.026 (1.72) | -0.098 | 0.124 | 1.000 | +0.030 / +0.026 | -0.63 / -0.00 | no |
| h4 fade ChoCh 2R | 5,791 | +0.005 (0.27) | -0.097 | 6,538 | +0.035 (1.83) | -0.089 | 0.124 | 1.000 | +0.018 / +0.037 | -0.57 / -0.10 | no |
| h4 retest BOS 1R | 4,431 | -0.007 (-0.39) | -0.019 | 4,867 | -0.007 (-0.40) | -0.021 | 0.014 | 1.000 | +0.030 / +0.026 | -2.41 / -2.25 | no |
| h4 retest BOS 2R | 4,431 | +0.011 (0.51) | -0.001 | 4,867 | -0.004 (-0.20) | -0.018 | 0.014 | 1.000 | +0.018 / +0.037 | -0.37 / -2.24 | no |
| h4 retest ChoCh 1R | 3,458 | -0.015 (-0.92) | -0.027 | 3,959 | +0.006 (0.36) | -0.010 | 0.016 | 1.000 | +0.030 / +0.026 | -2.59 / -1.28 | no |
| h4 retest ChoCh 2R | 3,458 | +0.002 (0.11) | -0.010 | 3,959 | +0.025 (1.30) | +0.010 | 0.016 | 1.000 | +0.018 / +0.037 | -0.77 / -0.58 | no |
| all with bos-1st 1R | 59,204 | -0.014 (-2.92) | -0.060 | 69,588 | -0.017 (-4.15) | -0.072 | 0.056 | 1.000 | -0.012 / -0.039 | -0.31 / 5.34 | no |
| all with bos-2nd 1R | 29,432 | -0.015 (-2.13) | -0.061 | 34,668 | -0.017 (-2.74) | -0.072 | 0.055 | 1.000 | -0.012 / -0.039 | -0.53 / 4.02 | no |
| all with bos-3rd+ 1R | 28,149 | -0.018 (-1.91) | -0.062 | 32,863 | -0.028 (-3.74) | -0.080 | 0.052 | 1.000 | -0.012 / -0.039 | -1.03 / 1.99 | no |
| all fade bos-1st 1R | 50,558 | -0.012 (-2.37) | -0.290 | 57,808 | -0.036 (-7.69) | -0.377 | 0.341 | 1.000 | -0.012 / -0.039 | 0.06 / 0.62 | no |
| all fade bos-2nd 1R | 25,285 | -0.010 (-1.40) | -0.284 | 28,798 | -0.023 (-3.65) | -0.361 | 0.338 | 1.000 | -0.012 / -0.039 | 0.31 / 2.38 | no |
| all fade bos-3rd+ 1R | 24,377 | +0.002 (0.29) | -0.267 | 27,512 | -0.029 (-4.30) | -0.362 | 0.333 | 1.000 | -0.012 / -0.039 | 2.02 / 1.54 | no |
| all retest bos-1st 1R | 41,101 | -0.015 (-2.96) | -0.063 | 48,746 | -0.018 (-3.57) | -0.075 | 0.058 | 1.000 | -0.012 / -0.039 | -0.53 / 4.41 | no |
| all retest bos-2nd 1R | 20,209 | -0.022 (-2.68) | -0.069 | 24,204 | -0.019 (-2.97) | -0.075 | 0.056 | 1.000 | -0.012 / -0.039 | -1.43 / 3.05 | no |
| all retest bos-3rd+ 1R | 19,351 | -0.020 (-1.94) | -0.064 | 22,944 | -0.032 (-3.91) | -0.085 | 0.053 | 1.000 | -0.012 / -0.039 | -1.05 / 1.07 | no |
| all with htf-with 1R | 116,474 | -0.012 (-2.08) | -0.059 | 135,659 | -0.018 (-3.71) | -0.073 | 0.055 | 1.000 | -0.012 / -0.039 | -0.09 / 6.30 | no |
| all with htf-against 1R | 102,823 | -0.017 (-4.92) | -0.067 | 119,134 | -0.017 (-4.76) | -0.076 | 0.059 | 1.000 | -0.012 / -0.039 | -1.38 / 6.31 | no |
| all fade htf-with 1R | 106,192 | -0.013 (-3.34) | -0.288 | 120,873 | -0.043 (-10.87) | -0.379 | 0.337 | 1.000 | -0.012 / -0.039 | -0.32 / -1.03 | no |
| all fade htf-against 1R | 94,218 | -0.011 (-2.47) | -0.292 | 107,654 | -0.035 (-8.25) | -0.375 | 0.340 | 1.000 | -0.012 / -0.039 | 0.34 / 1.10 | no |
| all retest htf-with 1R | 80,401 | -0.016 (-2.70) | -0.065 | 94,524 | -0.020 (-4.26) | -0.077 | 0.057 | 1.000 | -0.012 / -0.039 | -1.05 / 5.02 | no |
| all retest htf-against 1R | 72,381 | -0.012 (-3.14) | -0.063 | 84,608 | -0.013 (-3.17) | -0.074 | 0.061 | 1.000 | -0.012 / -0.039 | 0.07 / 6.62 | no |

## Checks

- Cut test: 50 cuts on xau, xag, eurusd, gbpusd, usdjpy, audusd, nzdusd, usdcad, usdchf, eurjpy: 3,557,514 signals known by the cut dates, 0 missing or extra when the candles are cut there.
- Every trade has its stop on the losing side of the fill (the run throws otherwise); a fill at or past the stop and a risk under the round-trip cost are no trades.
- Exclusions: the data-quality audit's bad intervals (`combo-grid-2` `exclusions`).

| Market | candles from | signals | simulated (with / fade / retest kept) | dropped (bad data) | past the stop | risk under cost | unresolved |
|---|---|---:|---:|---:|---:|---:|---:|
| xau | 2006-03-19 | 120,355 | 110,252 (43,477 / 36,766 / 30,002) | 7 | 387 | 9,709 | 7 |
| xag | 2006-03-19 | 120,513 | 87,280 (42,686 / 15,171 / 29,419) | 252 | 1,745 | 31,236 | 4 |
| eurusd | 2004-01-01 | 135,050 | 131,231 (48,467 / 48,906 / 33,850) | 62 | 323 | 3,278 | 8 |
| gbpusd | 2004-01-01 | 133,957 | 129,670 (48,067 / 48,162 / 33,431) | 147 | 371 | 3,615 | 10 |
| usdjpy | 2004-01-01 | 133,327 | 128,184 (48,144 / 46,313 / 33,714) | 101 | 278 | 4,596 | 13 |
| audusd | 2004-01-01 | 137,703 | 132,774 (49,633 / 48,268 / 34,865) | 98 | 627 | 4,048 | 8 |
| nzdusd | 2004-01-01 | 136,493 | 130,193 (49,158 / 46,268 / 34,755) | 4 | 517 | 5,632 | 12 |
| usdcad | 2004-01-01 | 136,091 | 129,954 (48,664 / 47,006 / 34,281) | 140 | 374 | 5,436 | 3 |
| usdchf | 2004-01-01 | 133,641 | 126,222 (47,835 / 44,773 / 33,603) | 133 | 976 | 6,142 | 11 |
| eurjpy | 2004-01-01 | 133,383 | 129,319 (47,984 / 47,317 / 34,010) | 8 | 257 | 3,610 | 8 |

## What it means

No cell clears the whole bar. Naming a break BOS or ChoCh, counting the BOS of the leg, checking the next timeframe up,
or waiting for the retest does not give a trade that makes money before costs in both decades AND beats simply fading every
break. Do not re-test variants of these 51 cells on these years. Nothing live changed; no rule is proposed.

The only cells positive before costs in both decades (m15 fade BOS 2R; m15 fade ChoCh 2R; h1 fade BOS 2R) are FADES at 2R: the
`grid7-wide-fade` tilt again. Split by kind they are no better than fading every break (Welch t under 2 in at least one window),
and after costs they lose (-0.324R, -0.346R, -0.173R a trade in 2015-26).

The cells that beat their control in both windows (m15 with BOS 1R; m15 retest BOS 1R; m15 retest ChoCh 1R) lose money before costs
themselves; they only lose less than fading every break at 1R does.
