# Equal highs / lows: the sweep and the break of a pool (result)

**Verdict: FAIL. 0 of 48 cells pass; the best confirmation cell, sweep m15 pool 2 other 2R, made +0.025R a trade before costs in 2015-26 (n 15,420, month t 2.07; discovery +0.047R, t 3.75; against its single-swing control Welch t -1.04).**

Run 23 Nov 2026 as pre-registered (`PREREGISTRATION.md`, committed and pushed alone first). Research only: nothing live
changed, nothing is proposed. One run, no variants.

## What was run

On M15 and H1, every candle that takes two or more equal, untouched swing lows / highs (the detector of
`research/edge/ict-equal-lows/eq.mjs`: 3 candles a side, last 96 candles, within 0.1 x the daily ATR, 4+ candles apart).
Sweep = within that candle and the next two, a close back on the pool's side before any close beyond it: traded back at the
next 5-minute open, stop past the sweep's extreme + 0.1 ATR. Break = a close beyond the deepest swept swing first: traded with
it, stop 1 ATR. Exits 1R, 2R, or the range (sweep: the range's far edge; break: the measured move; only when 1R or more away).
Ten markets pooled, OANDA mid 5-minute candles. Discovery = fills 2005-2014, confirmation = 2015 to October 2026. Each cell is
judged before costs on month sums and against its control: the same event on a single swing taken alone.
Costs beside: the demo figures for gold and the four majors; **ASSUMED, not measured** for xag, nzdusd, usdcad, usdchf, eurjpy.

## The bar, cell by cell

- n >= 300 in both windows: 44 of 48.
- Mean R > 0 and month t >= 2 in discovery: 7; in confirmation: 1; both: 1.
- Holm-adjusted p < 0.05: 0.
- Beats its single-swing control (Welch t >= 2 in both windows): 5.
- **All five: 0.**
- Of those, positive after costs in both windows: 0.

## Every cell

R a trade before costs (month-sum t), after costs ("net") beside; control = the same cell on single-swing events;
W = Welch t, cell minus control.

| Cell | n 05-14 | R 05-14 (t) | net 05-14 | ctrl R 05-14 | W 05-14 | n 15-26 | R 15-26 (t) | net 15-26 | ctrl R 15-26 | W 15-26 | Holm | Pass |
|---|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|---|
| sweep m15 pool 2 london 1R | 7,261 | -0.010 (-0.73) | -0.185 | +0.009 | -1.47 | 7,402 | -0.028 (-2.15) | -0.239 | -0.016 | -0.90 | 1.000 | no |
| sweep m15 pool 2 london 2R | 7,261 | +0.018 (0.99) | -0.157 | +0.052 | -1.80 | 7,402 | -0.006 (-0.33) | -0.217 | +0.015 | -1.11 | 1.000 | no |
| sweep m15 pool 2 london range | 6,883 | +0.007 (0.24) | -0.173 | +0.037 | -0.94 | 7,065 | +0.019 (0.64) | -0.197 | +0.037 | -0.51 | 1.000 | no |
| sweep m15 pool 2 ny 1R | 6,842 | -0.018 (-1.49) | -0.173 | -0.005 | -0.99 | 7,947 | -0.035 (-2.82) | -0.220 | -0.037 | 0.14 | 1.000 | no |
| sweep m15 pool 2 ny 2R | 6,842 | +0.006 (0.35) | -0.148 | +0.026 | -1.05 | 7,947 | -0.010 (-0.63) | -0.195 | -0.017 | 0.41 | 1.000 | no |
| sweep m15 pool 2 ny range | 6,385 | -0.000 (-0.02) | -0.161 | +0.046 | -1.46 | 7,278 | -0.022 (-0.79) | -0.217 | -0.017 | -0.18 | 1.000 | no |
| sweep m15 pool 2 other 1R | 14,215 | +0.024 (2.61) | -0.184 | +0.038 | -1.49 | 15,420 | +0.006 (0.65) | -0.250 | +0.010 | -0.48 | 1.000 | no |
| sweep m15 pool 2 other 2R | 14,215 | +0.047 (3.75) | -0.161 | +0.078 | -2.30 | 15,420 | +0.025 (2.07) | -0.231 | +0.038 | -1.04 | 0.959 | no |
| sweep m15 pool 2 other range | 13,171 | +0.046 (2.17) | -0.169 | +0.121 | -3.06 | 14,082 | +0.041 (1.83) | -0.227 | +0.066 | -1.05 | 1.000 | no |
| sweep m15 pool 3+ london 1R | 2,228 | -0.017 (-0.76) | -0.190 | +0.009 | -1.17 | 1,961 | -0.007 (-0.29) | -0.224 | -0.016 | 0.41 | 1.000 | no |
| sweep m15 pool 3+ london 2R | 2,228 | +0.013 (0.40) | -0.160 | +0.052 | -1.23 | 1,961 | +0.026 (0.75) | -0.191 | +0.015 | 0.34 | 1.000 | no |
| sweep m15 pool 3+ london range | 2,148 | -0.025 (-0.41) | -0.202 | +0.037 | -1.11 | 1,894 | +0.122 (1.67) | -0.099 | +0.037 | 1.28 | 1.000 | no |
| sweep m15 pool 3+ ny 1R | 2,168 | -0.016 (-0.74) | -0.176 | -0.005 | -0.49 | 2,186 | -0.021 (-0.84) | -0.192 | -0.037 | 0.73 | 1.000 | no |
| sweep m15 pool 3+ ny 2R | 2,168 | +0.041 (1.27) | -0.119 | +0.026 | 0.46 | 2,186 | +0.007 (0.21) | -0.165 | -0.017 | 0.79 | 1.000 | no |
| sweep m15 pool 3+ ny range | 2,024 | -0.001 (-0.01) | -0.168 | +0.046 | -0.89 | 1,992 | +0.021 (0.40) | -0.162 | -0.017 | 0.68 | 1.000 | no |
| sweep m15 pool 3+ other 1R | 3,351 | +0.044 (2.41) | -0.155 | +0.038 | 0.38 | 2,998 | -0.021 (-1.14) | -0.257 | +0.010 | -1.64 | 1.000 | no |
| sweep m15 pool 3+ other 2R | 3,351 | +0.058 (2.10) | -0.141 | +0.078 | -0.79 | 2,998 | -0.027 (-1.07) | -0.264 | +0.038 | -2.44 | 1.000 | no |
| sweep m15 pool 3+ other range | 3,062 | +0.092 (1.86) | -0.114 | +0.121 | -0.58 | 2,783 | +0.019 (0.39) | -0.229 | +0.066 | -0.86 | 1.000 | no |
| sweep h1 pool 2 london 1R | 1,934 | -0.008 (-0.32) | -0.113 | +0.018 | -1.03 | 1,962 | -0.013 (-0.49) | -0.146 | -0.006 | -0.30 | 1.000 | no |
| sweep h1 pool 2 london 2R | 1,934 | -0.019 (-0.62) | -0.125 | +0.032 | -1.46 | 1,962 | -0.022 (-0.65) | -0.155 | +0.021 | -1.24 | 1.000 | no |
| sweep h1 pool 2 london range | 1,808 | +0.008 (0.15) | -0.102 | -0.022 | 0.48 | 1,824 | -0.016 (-0.26) | -0.155 | +0.021 | -0.52 | 1.000 | no |
| sweep h1 pool 2 ny 1R | 2,270 | -0.000 (-0.02) | -0.094 | +0.010 | -0.44 | 2,608 | -0.044 (-2.30) | -0.153 | -0.018 | -1.23 | 1.000 | no |
| sweep h1 pool 2 ny 2R | 2,270 | -0.000 (-0.01) | -0.094 | +0.045 | -1.43 | 2,608 | -0.021 (-0.79) | -0.130 | -0.015 | -0.22 | 1.000 | no |
| sweep h1 pool 2 ny range | 2,034 | -0.010 (-0.24) | -0.109 | +0.034 | -0.85 | 2,336 | -0.055 (-0.98) | -0.170 | -0.029 | -0.48 | 1.000 | no |
| sweep h1 pool 2 other 1R | 2,350 | +0.004 (0.17) | -0.103 | +0.055 | -2.28 | 2,666 | -0.030 (-1.52) | -0.159 | +0.003 | -1.55 | 1.000 | no |
| sweep h1 pool 2 other 2R | 2,350 | -0.020 (-0.65) | -0.126 | +0.041 | -1.94 | 2,666 | -0.016 (-0.68) | -0.146 | +0.004 | -0.71 | 1.000 | no |
| sweep h1 pool 2 other range | 2,232 | -0.089 (-1.73) | -0.199 | +0.029 | -2.09 | 2,512 | -0.036 (-0.78) | -0.171 | -0.006 | -0.56 | 1.000 | no |
| sweep h1 pool 3+ london 1R | 260 | +0.012 (0.20) | -0.086 | +0.018 | -0.10 | 224 | -0.041 (-0.61) | -0.162 | -0.006 | -0.53 | 1.000 | no |
| sweep h1 pool 3+ london 2R | 260 | +0.130 (1.46) | +0.033 | +0.032 | 1.08 | 224 | -0.064 (-0.68) | -0.185 | +0.021 | -0.91 | 1.000 | no |
| sweep h1 pool 3+ london range | 253 | +0.316 (1.34) | +0.217 | -0.022 | 1.44 | 218 | -0.283 (-2.33) | -0.405 | +0.021 | -2.53 | 1.000 | no |
| sweep h1 pool 3+ ny 1R | 333 | -0.043 (-0.79) | -0.137 | +0.010 | -0.97 | 364 | -0.055 (-1.12) | -0.153 | -0.018 | -0.71 | 1.000 | no |
| sweep h1 pool 3+ ny 2R | 333 | +0.037 (0.53) | -0.056 | +0.045 | -0.11 | 364 | -0.064 (-0.95) | -0.162 | -0.015 | -0.70 | 1.000 | no |
| sweep h1 pool 3+ ny range | 305 | +0.122 (0.96) | +0.024 | +0.034 | 0.68 | 326 | -0.257 (-2.63) | -0.362 | -0.029 | -2.19 | 1.000 | no |
| sweep h1 pool 3+ other 1R | 512 | +0.109 (2.26) | -0.007 | +0.055 | 1.20 | 317 | +0.014 (0.24) | -0.101 | +0.003 | 0.20 | 1.000 | no |
| sweep h1 pool 3+ other 2R | 512 | +0.077 (1.40) | -0.038 | +0.041 | 0.56 | 317 | -0.054 (-0.61) | -0.169 | +0.004 | -0.74 | 1.000 | no |
| sweep h1 pool 3+ other range | 359 | +0.087 (0.61) | -0.035 | +0.029 | 0.38 | 297 | -0.154 (-1.01) | -0.275 | -0.006 | -1.18 | 1.000 | no |
| break m15 pool 2 all 1R | 25,185 | -0.027 (-4.22) | -0.174 | -0.071 | 6.31 | 26,880 | -0.040 (-5.91) | -0.200 | -0.053 | 1.92 | 1.000 | no |
| break m15 pool 2 all 2R | 25,185 | -0.034 (-3.58) | -0.181 | -0.086 | 5.34 | 26,880 | -0.041 (-4.28) | -0.200 | -0.064 | 2.47 | 1.000 | no |
| break m15 pool 2 all range | 24,214 | -0.027 (-2.13) | -0.174 | -0.086 | 4.50 | 25,967 | -0.041 (-3.36) | -0.201 | -0.058 | 1.36 | 1.000 | no |
| break m15 pool 3+ all 1R | 7,043 | -0.023 (-1.59) | -0.180 | -0.071 | 3.92 | 6,087 | -0.009 (-0.58) | -0.165 | -0.053 | 3.19 | 1.000 | no |
| break m15 pool 3+ all 2R | 7,043 | +0.004 (0.22) | -0.154 | -0.086 | 5.16 | 6,087 | +0.005 (0.24) | -0.151 | -0.064 | 3.60 | 1.000 | no |
| break m15 pool 3+ all range | 6,790 | +0.014 (0.54) | -0.139 | -0.086 | 3.94 | 5,883 | -0.005 (-0.17) | -0.162 | -0.058 | 1.98 | 1.000 | no |
| break h1 pool 2 all 1R | 5,961 | -0.001 (-0.04) | -0.084 | -0.039 | 2.65 | 6,195 | +0.014 (0.95) | -0.073 | -0.022 | 2.62 | 1.000 | no |
| break h1 pool 2 all 2R | 5,961 | +0.006 (0.32) | -0.077 | -0.032 | 1.91 | 6,195 | -0.005 (-0.24) | -0.091 | -0.035 | 1.57 | 1.000 | no |
| break h1 pool 2 all range | 5,714 | +0.011 (0.47) | -0.071 | -0.022 | 1.25 | 5,967 | +0.001 (0.02) | -0.086 | -0.015 | 0.60 | 1.000 | no |
| break h1 pool 3+ all 1R | 1,113 | +0.023 (0.80) | -0.123 | -0.039 | 2.00 | 863 | +0.042 (1.06) | -0.047 | -0.022 | 1.87 | 1.000 | no |
| break h1 pool 3+ all 2R | 1,113 | +0.071 (1.66) | -0.076 | -0.032 | 2.34 | 863 | +0.068 (1.22) | -0.021 | -0.035 | 2.11 | 1.000 | no |
| break h1 pool 3+ all range | 972 | +0.135 (2.01) | +0.037 | -0.022 | 2.33 | 839 | +0.087 (1.22) | -0.002 | -0.015 | 1.46 | 1.000 | no |

## Checks

- Cut test: 10 cuts on xau, eurusd: 420,177 events known by the cut dates, 0 missing or extra when the candles are cut there.
- Every trade has its stop on the losing side of the fill (the run throws otherwise); a fill at or past the stop and a risk under the round-trip cost are no trades.
- Exclusions: the data-quality audit's bad intervals (`combo-grid-2` `exclusions`).

| Market | candles from | events | simulated | sweeps pool / single | breaks pool / single | dropped (bad data) | past the stop | risk under cost | unresolved |
|---|---|---:|---:|---:|---:|---:|---:|---:|---:|
| xau | 2006-03-19 | 75,305 | 73,047 | 8,326 / 30,771 | 7,396 / 26,553 | 6 | 63 | 2,189 | 1 |
| xag | 2006-03-19 | 74,930 | 47,437 | 5,278 / 17,632 | 5,213 / 19,314 | 156 | 101 | 27,236 | 0 |
| eurusd | 2004-01-01 | 83,858 | 83,474 | 9,551 / 35,071 | 8,755 / 30,097 | 55 | 39 | 236 | 0 |
| gbpusd | 2004-01-01 | 84,419 | 83,935 | 9,690 / 35,587 | 8,576 / 30,080 | 101 | 67 | 260 | 2 |
| usdjpy | 2004-01-01 | 81,997 | 81,407 | 9,650 / 33,732 | 8,605 / 29,420 | 73 | 46 | 411 | 0 |
| audusd | 2004-01-01 | 83,407 | 82,950 | 8,983 / 34,340 | 8,405 / 31,221 | 60 | 53 | 282 | 1 |
| nzdusd | 2004-01-01 | 83,918 | 83,435 | 9,330 / 35,768 | 7,966 / 30,369 | 4 | 96 | 331 | 2 |
| usdcad | 2004-01-01 | 84,382 | 83,826 | 9,470 / 34,708 | 8,411 / 31,237 | 106 | 49 | 327 | 0 |
| usdchf | 2004-01-01 | 84,273 | 83,443 | 9,921 / 35,391 | 8,340 / 29,791 | 113 | 69 | 590 | 0 |
| eurjpy | 2004-01-01 | 84,426 | 83,946 | 9,580 / 37,419 | 7,660 / 29,287 | 5 | 64 | 337 | 0 |

## What it means

No cell clears the bar. **Sweeps**: traded back, a swept pool makes about zero before costs and does not beat a single
swing swept the same way (0 of 36 sweep cells beat the control in both windows; in the M15 "other hours" cells the single
swing does better). **Breaks**: traded with the break, an equal pool loses less than a single swing broken the same way
(5 of 12 break cells beat the control in both windows), but the pool breaks themselves are about zero or negative
before costs (every break cell between -0.05R and +0.14R a trade, none with a month t of 2 in both windows): "loses less than the control" is not
a trade. After costs every cell loses in the confirmation window. Silver: about a third of its events had a risk under the
ASSUMED round trip and were no trades. Do not re-test variants of these 48 cells on these years. Nothing live changed; no rule
is proposed.
