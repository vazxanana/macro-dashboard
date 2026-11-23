# Wide trend-pullback grid: move, pullback, break back with the move, on ten markets (result)

**Verdict: FAIL. 0 of 54 cells pass; the best confirmation cell with n >= 300, H4 shallow+zone 1R, made +0.011R a trade before costs in 2015-26 (n 2,767, month t 0.49; discovery -0.003R, t -0.13).**

Run 23 Nov 2026 as pre-registered (`PREREGISTRATION.md`, committed and pushed alone first). Research only: nothing live
changed, nothing is proposed. One run, no variants.

## What was run

Two chains: a move on the Daily (pullback on H4, trigger on H1) or on H4 (pullback on H1, trigger on M15). The move = the last
structure break on its timeframe (3 candles a side); a pullback starts with a structure break against it one timeframe lower;
the trade is the first structure break back WITH the move on the trigger timeframe, a market entry at the next 5-minute open,
stop past the pullback's extreme + 0.1 ATR(14) of the trigger timeframe, exits 1R, 2R or the move's extreme (when 1R or
more away), time limit 5 days (Daily chain) or 2 days (H4 chain). Contexts: depth of the pullback at the trigger (under 38.2 %,
38.2-61.8 %, over 61.8 % of the move's leg), with or without an engulf / dominant zone of the move's side (on the pullback
timeframe) touched during the pullback. 54 cells, ten markets pooled (xau, xag, eurusd, gbpusd, usdjpy, audusd, nzdusd, usdcad,
usdchf, eurjpy), OANDA mid 5-minute candles. Discovery = fills 2005-2014, confirmation = 2015 to October 2026.
Control of each cell: the first structure break of EITHER side after the same pullbacks began, traded its own way, same
context. Judged before costs on month sums.
Costs after the fact only: the demo figures for gold and the four majors; **ASSUMED, not measured** for xag, nzdusd, usdcad, usdchf, eurjpy.

## The bar, cell by cell

- n >= 300 in both windows: 36 of 54.
- Mean R > 0 and month t >= 2 in discovery: 0; in confirmation: 0; both: 0.
- Holm-adjusted p < 0.05 over the 54 confirmation tests: 0.
- Beats its control (Welch t >= 2 in both windows): 0 of 54.
- **All four: 0.**
- Side-flipped check passing bars 1-3: 0.

Among the cells with n >= 300 in both windows: best confirmation cell H4 shallow+zone 1R. Best on the weaker of the two windows: H4 shallow+zone 2R (discovery
+0.019R, t 0.67; confirmation +0.009R, t 0.32).

## The plain cells ("all" context) beside their controls

| Cell | R 05-14 (t) | control 05-14 | R 15-26 (t) | control 15-26 | after costs 15-26 | vs control |
|---|---:|---:|---:|---:|---:|---:|
| D1 all 1R | +0.005 (0.26) | +0.001 (0.08) | -0.042 (-2.12) | -0.002 (-0.12) | -0.067 | 0.21 / -2.29 |
| D1 all 2R | +0.003 (0.12) | +0.008 (0.50) | -0.050 (-2.15) | +0.000 (0.01) | -0.075 | -0.20 / -2.27 |
| D1 all ext | -0.035 (-1.05) | -0.018 (-0.82) | -0.069 (-2.32) | -0.013 (-0.54) | -0.097 | -0.51 / -1.83 |
| H4 all 1R | -0.025 (-2.51) | -0.007 (-0.83) | -0.009 (-0.93) | -0.015 (-1.92) | -0.061 | -1.60 / 0.53 |
| H4 all 2R | -0.015 (-1.09) | -0.000 (-0.04) | -0.011 (-0.86) | -0.007 (-0.74) | -0.063 | -0.95 / -0.28 |
| H4 all ext | -0.027 (-1.28) | -0.020 (-1.21) | -0.018 (-1.00) | -0.022 (-1.47) | -0.077 | -0.33 / 0.16 |

Beside, `grid7-wide-fade`'s plain fade of every structure break on the same trigger timeframes (a different trade, read from
its result.json, not recomputed; stop past the break candle's extreme):

| Fade cell | for chain | R 05-14 (t) | R 15-26 (t) | after costs 15-26 |
|---|---|---:|---:|---:|
| m15 none ext 1R all | H4 | -0.030 (-8.39) | -0.053 (-14.50) | -0.443 |
| m15 none ext 2R all | H4 | +0.094 (19.57) | +0.054 (12.15) | -0.335 |
| m15 none ext swing all | H4 | +0.241 (17.80) | +0.158 (15.46) | -0.234 |
| h1 none ext 1R all | D1 | +0.035 (5.63) | -0.009 (-1.59) | -0.238 |
| h1 none ext 2R all | D1 | +0.105 (12.31) | +0.040 (5.17) | -0.189 |
| h1 none ext swing all | D1 | +0.157 (7.97) | +0.073 (3.62) | -0.158 |

## Every cell

R a trade before costs (month-sum t), after costs beside; "vs ctl" = Welch t of the cell against its control (discovery /
confirmation); Holm on the confirmation test; "flipped" = the side-flipped check in 2015-26.

| Cell | n 05-14 | R 05-14 (t) | net 05-14 | n 15-26 | R 15-26 (t) | net 15-26 | ctl 15-26 | vs ctl | Holm | Flipped R 15-26 (t) | Pass |
|---|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|---|
| D1 all 1R | 3,791 | +0.005 (0.26) | -0.015 | 4,440 | -0.042 (-2.12) | -0.067 | -0.002 | 0.21 / -2.29 | 1.000 | +0.041 (2.06) | no |
| D1 shallow+zone 1R | 1,002 | -0.004 (-0.10) | -0.026 | 952 | -0.048 (-1.39) | -0.074 | +0.019 | 0.55 / -1.71 | 1.000 | +0.046 (1.32) | no |
| D1 shallow-zone 1R | 1 | +1.000 (1.00) | +0.844 | 1 | +1.000 (1.00) | +0.968 | -0.329 | n/a / n/a | 1.000 | -1.000 (-1.00) | no |
| D1 mid+zone 1R | 1,323 | +0.044 (1.48) | +0.024 | 1,617 | -0.019 (-0.62) | -0.045 | +0.005 | -0.04 / -0.80 | 1.000 | +0.017 (0.56) | no |
| D1 mid-zone 1R | 1 | -1.000 (-1.00) | -1.018 | 2 | -1.000 (-1.42) | -1.026 | +0.333 | n/a / -2.00 | 1.000 | +1.000 (1.42) | no |
| D1 deep+zone 1R | 1,464 | -0.024 (-0.80) | -0.042 | 1,867 | -0.059 (-2.46) | -0.082 | -0.021 | -0.08 / -1.41 | 1.000 | +0.058 (2.42) | no |
| D1 deep-zone 1R | 0 | n/a (0.00) | n/a | 1 | -0.191 (-1.00) | -0.194 | -0.191 | n/a / n/a | 1.000 | +0.191 (1.00) | no |
| D1 eg 1R | 3,747 | +0.003 (0.14) | -0.017 | 4,397 | -0.041 (-2.07) | -0.066 | -0.003 | 0.17 / -2.17 | 1.000 | +0.040 (2.01) | no |
| D1 dom 1R | 3,742 | +0.004 (0.19) | -0.016 | 4,410 | -0.043 (-2.15) | -0.068 | -0.002 | 0.29 / -2.28 | 1.000 | +0.041 (2.09) | no |
| D1 all 2R | 3,791 | +0.003 (0.12) | -0.017 | 4,440 | -0.050 (-2.15) | -0.075 | +0.000 | -0.20 / -2.27 | 1.000 | +0.076 (2.86) | no |
| D1 shallow+zone 2R | 1,002 | -0.019 (-0.42) | -0.041 | 952 | -0.058 (-1.34) | -0.084 | +0.018 | 0.33 / -1.56 | 1.000 | +0.077 (1.53) | no |
| D1 shallow-zone 2R | 1 | +2.000 (1.00) | +1.844 | 1 | +2.000 (1.00) | +1.968 | -0.329 | n/a / n/a | 1.000 | -1.000 (-1.00) | no |
| D1 mid+zone 2R | 1,323 | +0.077 (1.93) | +0.057 | 1,617 | -0.023 (-0.61) | -0.048 | +0.015 | 0.29 / -1.02 | 1.000 | +0.067 (1.70) | no |
| D1 mid-zone 2R | 1 | -1.000 (-1.00) | -1.018 | 2 | -1.000 (-1.42) | -1.026 | +0.310 | n/a / -2.00 | 1.000 | +0.500 (0.45) | no |
| D1 deep+zone 2R | 1,464 | -0.049 (-1.31) | -0.067 | 1,867 | -0.070 (-2.49) | -0.093 | -0.027 | -0.96 / -1.32 | 1.000 | +0.083 (2.48) | no |
| D1 deep-zone 2R | 0 | n/a (0.00) | n/a | 1 | -0.191 (-1.00) | -0.194 | -0.191 | n/a / n/a | 1.000 | +0.191 (1.00) | no |
| D1 eg 2R | 3,747 | -0.001 (-0.04) | -0.021 | 4,397 | -0.048 (-2.06) | -0.073 | -0.000 | -0.24 / -2.16 | 1.000 | +0.075 (2.80) | no |
| D1 dom 2R | 3,742 | -0.000 (-0.02) | -0.020 | 4,410 | -0.051 (-2.20) | -0.076 | -0.001 | -0.09 / -2.29 | 1.000 | +0.077 (2.88) | no |
| D1 all ext | 2,941 | -0.035 (-1.05) | -0.057 | 3,573 | -0.069 (-2.32) | -0.097 | -0.013 | -0.51 / -1.83 | 1.000 | +0.086 (2.72) | no |
| D1 shallow+zone ext | 601 | -0.011 (-0.19) | -0.037 | 591 | -0.083 (-1.46) | -0.113 | +0.014 | 0.34 / -1.48 | 1.000 | +0.171 (2.44) | no |
| D1 shallow-zone ext | 0 | n/a (0.00) | n/a | 1 | +2.472 (1.00) | +2.440 | -0.329 | n/a / n/a | 1.000 | -1.000 (-1.00) | no |
| D1 mid+zone ext | 1,042 | +0.033 (0.62) | +0.010 | 1,318 | -0.041 (-0.86) | -0.070 | +0.007 | -0.37 / -0.95 | 1.000 | +0.051 (1.06) | no |
| D1 mid-zone ext | 1 | -1.000 (-1.00) | -1.018 | 1 | -1.000 (-1.00) | -1.043 | +0.965 | n/a / n/a | 1.000 | +2.447 (1.00) | no |
| D1 deep+zone ext | 1,297 | -0.100 (-2.13) | -0.120 | 1,661 | -0.088 (-2.33) | -0.113 | -0.082 | 0.30 / -0.09 | 1.000 | +0.082 (1.90) | no |
| D1 deep-zone ext | 0 | n/a (0.00) | n/a | 1 | -0.191 (-1.00) | -0.194 | -0.191 | n/a / n/a | 1.000 | +0.191 (1.00) | no |
| D1 eg ext | 2,916 | -0.039 (-1.15) | -0.061 | 3,548 | -0.068 (-2.29) | -0.095 | -0.013 | -0.48 / -1.79 | 1.000 | +0.084 (2.69) | no |
| D1 dom ext | 2,918 | -0.034 (-1.01) | -0.056 | 3,553 | -0.072 (-2.41) | -0.099 | -0.013 | -0.38 / -1.88 | 1.000 | +0.084 (2.69) | no |
| H4 all 1R | 11,961 | -0.025 (-2.51) | -0.067 | 14,136 | -0.009 (-0.93) | -0.061 | -0.015 | -1.60 / 0.53 | 1.000 | +0.004 (0.45) | no |
| H4 shallow+zone 1R | 2,303 | -0.003 (-0.13) | -0.049 | 2,767 | +0.011 (0.49) | -0.044 | -0.035 | 1.02 / 1.88 | 1.000 | -0.016 (-0.73) | no |
| H4 shallow-zone 1R | 23 | -0.217 (-0.96) | -0.312 | 16 | -0.375 (-1.42) | -0.450 | -0.043 | -0.19 / -1.03 | 1.000 | +0.375 (1.42) | no |
| H4 mid+zone 1R | 4,231 | -0.032 (-1.90) | -0.076 | 5,038 | -0.008 (-0.53) | -0.060 | -0.011 | -1.88 / 0.17 | 1.000 | +0.002 (0.16) | no |
| H4 mid-zone 1R | 11 | -0.091 (-0.28) | -0.143 | 9 | -0.511 (-1.73) | -0.565 | -0.294 | -0.19 / -0.59 | 1.000 | +0.511 (1.73) | no |
| H4 deep+zone 1R | 5,392 | -0.028 (-1.96) | -0.067 | 6,303 | -0.016 (-1.22) | -0.067 | -0.006 | -1.42 / -0.63 | 1.000 | +0.013 (0.95) | no |
| H4 deep-zone 1R | 1 | -1.000 (-1.00) | -1.028 | 3 | -0.823 (-1.67) | -0.842 | -0.734 | n/a / -0.28 | 1.000 | +0.823 (1.67) | no |
| H4 eg 1R | 11,727 | -0.024 (-2.37) | -0.066 | 13,870 | -0.007 (-0.69) | -0.058 | -0.014 | -1.63 / 0.71 | 1.000 | +0.002 (0.22) | no |
| H4 dom 1R | 11,703 | -0.022 (-2.22) | -0.064 | 13,928 | -0.009 (-0.91) | -0.061 | -0.015 | -1.47 / 0.59 | 1.000 | +0.004 (0.43) | no |
| H4 all 2R | 11,961 | -0.015 (-1.09) | -0.057 | 14,136 | -0.011 (-0.86) | -0.063 | -0.007 | -0.95 / -0.28 | 1.000 | +0.018 (1.30) | no |
| H4 shallow+zone 2R | 2,303 | +0.019 (0.67) | -0.027 | 2,767 | +0.009 (0.32) | -0.046 | -0.023 | 0.76 / 1.00 | 1.000 | -0.027 (-0.95) | no |
| H4 shallow-zone 2R | 23 | -0.217 (-0.70) | -0.312 | 16 | -0.625 (-2.06) | -0.700 | -0.251 | 0.34 / -1.01 | 1.000 | +0.197 (0.51) | no |
| H4 mid+zone 2R | 4,231 | -0.032 (-1.35) | -0.076 | 5,038 | -0.013 (-0.66) | -0.065 | -0.003 | -1.25 / -0.45 | 1.000 | +0.013 (0.55) | no |
| H4 mid-zone 2R | 11 | -0.293 (-0.88) | -0.345 | 9 | -0.289 (-0.75) | -0.343 | -0.028 | -0.97 / -0.47 | 1.000 | +0.511 (1.05) | no |
| H4 deep+zone 2R | 5,392 | -0.014 (-0.85) | -0.054 | 6,303 | -0.016 (-0.82) | -0.067 | -0.002 | -0.82 / -0.70 | 1.000 | +0.041 (2.31) | no |
| H4 deep-zone 2R | 1 | -1.000 (-1.00) | -1.028 | 3 | -0.823 (-1.67) | -0.842 | -0.734 | n/a / -0.28 | 1.000 | -0.219 (-0.17) | no |
| H4 eg 2R | 11,727 | -0.014 (-0.98) | -0.055 | 13,870 | -0.010 (-0.71) | -0.061 | -0.007 | -0.97 / -0.16 | 1.000 | +0.018 (1.30) | no |
| H4 dom 2R | 11,703 | -0.011 (-0.78) | -0.053 | 13,928 | -0.012 (-0.91) | -0.063 | -0.008 | -0.77 / -0.25 | 1.000 | +0.018 (1.25) | no |
| H4 all ext | 8,397 | -0.027 (-1.28) | -0.075 | 10,205 | -0.018 (-1.00) | -0.077 | -0.022 | -0.33 / 0.16 | 1.000 | +0.038 (1.93) | no |
| H4 shallow+zone ext | 1,224 | -0.024 (-0.57) | -0.082 | 1,590 | +0.005 (0.11) | -0.060 | -0.024 | 0.04 / 0.67 | 1.000 | -0.019 (-0.51) | no |
| H4 shallow-zone ext | 12 | +0.107 (0.22) | -0.005 | 6 | -0.535 (-1.00) | -0.592 | -0.064 | 0.84 / -0.74 | 1.000 | +0.708 (1.01) | no |
| H4 mid+zone ext | 2,913 | -0.029 (-0.89) | -0.081 | 3,554 | -0.032 (-1.06) | -0.091 | -0.028 | -0.80 / -0.13 | 1.000 | +0.028 (0.87) | no |
| H4 mid-zone ext | 5 | -0.556 (-1.19) | -0.594 | 5 | +0.513 (0.58) | +0.438 | +0.321 | -0.92 / 0.18 | 1.000 | +0.404 (0.50) | no |
| H4 deep+zone ext | 4,242 | -0.026 (-0.93) | -0.069 | 5,047 | -0.015 (-0.60) | -0.072 | -0.009 | 0.30 / -0.17 | 1.000 | +0.061 (2.42) | no |
| H4 deep-zone ext | 1 | -1.000 (-1.00) | -1.028 | 3 | -0.823 (-1.67) | -0.842 | -0.734 | n/a / -0.28 | 1.000 | +1.144 (1.61) | no |
| H4 eg ext | 8,267 | -0.029 (-1.33) | -0.077 | 10,046 | -0.017 (-0.93) | -0.076 | -0.024 | -0.47 / 0.34 | 1.000 | +0.035 (1.75) | no |
| H4 dom ext | 8,268 | -0.022 (-1.03) | -0.070 | 10,091 | -0.019 (-1.04) | -0.078 | -0.023 | -0.20 / 0.19 | 1.000 | +0.037 (1.88) | no |

## Checks

- Cut test: 15 cuts on xau, eurusd, usdjpy: 58,553 signals (real and control) known by the cut dates, 0 missing or extra when the candles are cut there.
- Every trade has its stop on the losing side of the fill (the run throws otherwise); fills at or past the stop and trades whose risk is under the round-trip cost are no trades (same for every cell).
- Exclusions: the data-quality audit's bad intervals (`combo-grid-2` `exclusions`).

| Market | candles from | signals (real + control) | real | simulated | dropped (bad data) | past the stop | risk under cost | ext under 1R | real: shallow / mid / deep |
|---|---|---:|---:|---:|---:|---:|---:|---:|---|
| xau | 2006-03-19 | 6,644 | 3,070 | 6,644 | 0 | 0 | 0 | 2,311 | 615 / 1129 / 1326 |
| xag | 2006-03-19 | 6,765 | 3,141 | 6,732 | 9 | 0 | 24 | 2,373 | 607 / 1153 / 1363 |
| eurusd | 2004-01-01 | 7,767 | 3,608 | 7,760 | 5 | 1 | 0 | 2,854 | 818 / 1269 / 1515 |
| gbpusd | 2004-01-01 | 7,824 | 3,622 | 7,818 | 2 | 1 | 0 | 2,928 | 787 / 1262 / 1570 |
| usdjpy | 2004-01-01 | 7,406 | 3,413 | 7,402 | 2 | 1 | 0 | 2,605 | 652 / 1152 / 1606 |
| audusd | 2004-01-01 | 7,788 | 3,573 | 7,780 | 6 | 0 | 0 | 2,826 | 718 / 1288 / 1563 |
| nzdusd | 2004-01-01 | 7,466 | 3,441 | 7,464 | 0 | 2 | 0 | 2,648 | 716 / 1272 / 1449 |
| usdcad | 2004-01-01 | 7,802 | 3,596 | 7,791 | 9 | 0 | 0 | 3,054 | 761 / 1272 / 1558 |
| usdchf | 2004-01-01 | 7,641 | 3,530 | 7,626 | 10 | 2 | 0 | 2,798 | 776 / 1232 / 1515 |
| eurjpy | 2004-01-01 | 7,349 | 3,385 | 7,347 | 0 | 1 | 0 | 2,627 | 615 / 1203 / 1566 |

## What it means

Read this simple way, the move / pullback / break-back cycle does not pick better trades than taking the first break of
either side after the same pullbacks, on ten markets over 22 years, at any depth or with a zone. No cell is positive with
month t >= 2 in either window. The plain Daily chain at 1R made +0.005R a trade in 2005-14 and -0.042R in 2015-26
(t -2.12, n 4,440; its control -0.002R), the plain H4 chain -0.025R and -0.009R; after costs every plain
cell loses. Do not re-test variants of these 54 cells on these years. Nothing live changed; no rule is proposed.

**The "-zone" cells are near empty** (39 trades at most over both windows): an engulf or
dominant zone of the move's side, on the pullback timeframe, was touched between the move's extreme and the trigger in almost every
pullback, since the move itself leaves such zones behind it. So the "with a zone" condition selects nearly everything and says
nothing; this follows from the design fixed in advance and is reported as found.
