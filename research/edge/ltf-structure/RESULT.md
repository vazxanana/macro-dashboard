# Lower-timeframe structure as an entry permission (22 Nov 2026)

**Verdict: FAIL.** 0 of 13 groups pass. Pool out of sample with the condition: −0.167R a trade after costs (n 1261, month t -2.77); without it −0.102R (n 35614); difference −0.065R (Welch t -1.49).

Pre-registered (PREREGISTRATION.md, committed before any result). Condition P: at the entry, the last H1 break known is with the trade, the last M15 break known is a structure shift with the trade made known at most 6 hours before, and the last M5 break known is with the trade (the page's own structure function, 6 candles a side, candles closed by the entry only). The desks' own trades on gold, EUR/USD and GBP/USD, taken as booked; R a trade AFTER the desk-rigor costs; in sample 2020-2023, out of sample 2024-2025; t on calendar-month sums. Paper research only.

Trades: 112330 (4 left out by the trade builder). P holds on 3.6 % of them (in sample 3.7 %, out of sample 3.4 %). No-look-ahead check: 1800 random cuts, 0 mismatches; structure read once over each whole series (the check passed).

## Out of sample 2024-2025 (the verdict)

| Group | n | P keeps | With P: n | net R | month t | Holm p | Without P: n | net R | month t | Difference | Welch t | Paired months (t) | Holm p | Verdict |
|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|
| Mosha sequence | 487 | 11.9 % | 58 | −0.339 | -1.6 | 1 | 429 | −0.322 | -2.47 | −0.017 | -0.07 | +0.035 (0.08) | 1 | FAIL |
| Mosha barrier entry | 21458 | 2.7 % | 584 | −0.090 | -0.97 | 1 | 20874 | −0.090 | -4.85 | +0.001 | 0.01 | +0.010 (0.1) | 1 | FAIL |
| Engulf D1 | 251 | 1.6 % | 4 | −0.051 | -0.05 | 1 | 247 | −0.065 | -0.83 | +0.013 | 0.01 | +0.739 (0.64) | 1 | FAIL (too few) |
| Engulf H4 | 1366 | 6.1 % | 83 | −0.173 | -1.36 | 1 | 1283 | −0.031 | -0.59 | −0.142 | -1 | −0.170 (-1.21) | 1 | FAIL |
| Engulf H1 | 5636 | 4.2 % | 238 | −0.166 | -1.79 | 1 | 5398 | −0.090 | -3.7 | −0.076 | -0.88 | −0.075 (-0.75) | 1 | FAIL |
| Engulf plan (with the Daily) | 1144 | 3 % | 34 | −0.482 | -2.06 | 0.9062 | 1110 | −0.107 | -2.67 | −0.375 | -1.73 | −0.382 (-1.47) | 1 | FAIL |
| Engulf short method | 1204 | 3.7 % | 45 | −0.098 | -0.5 | 1 | 1159 | −0.117 | -2.99 | +0.018 | 0.08 | +0.138 (0.52) | 1 | FAIL |
| MSNR with the direction, 12-16 UTC | 836 | 6.1 % | 51 | −0.352 | -2.31 | 0.5222 | 785 | −0.127 | -2.79 | −0.225 | -1.33 | −0.236 (-1.21) | 1 | FAIL |
| MSNR with the direction, other hours | 3290 | 4.4 % | 145 | −0.306 | -2.15 | 0.7573 | 3145 | −0.180 | -8.18 | −0.126 | -1.25 | −0.077 (-0.59) | 1 | FAIL |
| MSNR gold plan | 575 | 1.7 % | 10 | −0.246 | -0.46 | 1 | 565 | −0.121 | -1.85 | −0.125 | -0.23 | −0.111 (-0.21) | 1 | FAIL (too few) |
| MSNR gold plan, QM entry | 149 | 4.7 % | 7 | +0.096 | 0.12 | 1 | 142 | −0.063 | -0.38 | +0.159 | 0.21 | +0.666 (0.52) | 1 | FAIL (too few) |
| LIT, loose limit | 319 | 0.6 % | 2 | +0.059 | 0.05 | 1 | 317 | −0.198 | -2.37 | +0.257 | 0.23 | −0.008 (-0.01) | 1 | FAIL (too few) |
| Pool: every trade | 36875 | 3.4 % | 1261 | −0.167 | -2.77 | 0.1457 | 35614 | −0.102 | -7.81 | −0.065 | -1.49 | −0.054 (-0.91) | 1 | FAIL |

## In sample 2020-2023

| Group | n | P keeps | With P: n | net R | month t | Without P: n | net R | month t | Difference | Welch t | Paired months (t) |
|---|---|---|---|---|---|---|---|---|---|---|---|
| Mosha sequence | 976 | 14.3 % | 140 | +0.011 | 0.06 | 836 | −0.154 | -1.63 | +0.165 | 0.8 | +0.349 (1.23) |
| Mosha barrier entry | 44883 | 2.9 % | 1294 | −0.079 | -1.02 | 43589 | −0.060 | -4.07 | −0.019 | -0.38 | +0.008 (0.1) |
| Engulf D1 | 470 | 0.9 % | 4 | +1.399 | 1.03 | 466 | +0.055 | 0.75 | +1.344 | 0.99 | +1.299 (1.11) |
| Engulf H4 | 2929 | 5.8 % | 171 | +0.093 | 0.73 | 2758 | −0.031 | -0.96 | +0.124 | 1.07 | +0.078 (0.57) |
| Engulf H1 | 11474 | 4.8 % | 553 | −0.187 | -3.1 | 10921 | −0.079 | -5.2 | −0.108 | -2.04 | −0.055 (-0.96) |
| Engulf plan (with the Daily) | 2597 | 4.6 % | 119 | −0.133 | -0.8 | 2478 | −0.050 | -1.92 | −0.083 | -0.61 | +0.087 (0.53) |
| Engulf short method | 2640 | 4.4 % | 117 | −0.089 | -0.63 | 2523 | −0.145 | -5.23 | +0.057 | 0.42 | −0.037 (-0.25) |
| MSNR with the direction, 12-16 UTC | 1466 | 5.9 % | 86 | −0.281 | -1.83 | 1380 | −0.171 | -5.15 | −0.110 | -0.83 | −0.003 (-0.02) |
| MSNR with the direction, other hours | 5649 | 4.3 % | 241 | −0.121 | -1.3 | 5408 | −0.194 | -8.95 | +0.073 | 0.89 | +0.075 (0.68) |
| MSNR gold plan | 1177 | 2.3 % | 27 | +0.154 | 0.42 | 1150 | −0.041 | -0.74 | +0.195 | 0.54 | +0.004 (0.01) |
| MSNR gold plan, QM entry | 268 | 3.4 % | 9 | −0.586 | -1.47 | 259 | +0.004 | 0.04 | −0.590 | -1.29 | −0.586 (-1.88) |
| LIT, loose limit | 628 | 1.3 % | 8 | −1.085 | -7.71 | 620 | −0.007 | -0.09 | −1.078 | -12.82 | −0.714 (-4.16) |
| Pool: every trade | 75455 | 3.7 % | 2774 | −0.098 | -1.77 | 72681 | −0.076 | -7.35 | −0.022 | -0.72 | +0.013 (0.25) |

## Before costs, with P (reported, no verdict)

| Group | IS n | IS R before costs | OOS n | OOS R before costs |
|---|---|---|---|---|
| Mosha sequence | 140 | +0.071 | 58 | −0.266 |
| Mosha barrier entry | 1294 | −0.023 | 584 | −0.023 |
| Engulf D1 | 4 | +1.412 | 4 | −0.036 |
| Engulf H4 | 171 | +0.129 | 83 | −0.134 |
| Engulf H1 | 553 | −0.123 | 238 | −0.096 |
| Engulf plan (with the Daily) | 119 | −0.045 | 34 | −0.383 |
| Engulf short method | 117 | −0.002 | 45 | −0.008 |
| MSNR with the direction, 12-16 UTC | 86 | −0.171 | 51 | −0.216 |
| MSNR with the direction, other hours | 241 | +0.026 | 145 | −0.140 |
| MSNR gold plan | 27 | +0.185 | 10 | −0.200 |
| MSNR gold plan, QM entry | 9 | −0.556 | 7 | +0.143 |
| LIT, loose limit | 8 | −1.000 | 2 | +0.198 |
| Pool: every trade | 2774 | −0.029 | 1261 | −0.086 |

## Placebo: the structure AGAINST the trade

The same condition for the opposite side (H1, a fresh M15 structure shift and M5 all against the trade), same groups and bar. Passing groups: none.

| Group | IS n | IS net R | IS difference | OOS n | OOS net R | month t | Holm p | OOS difference | Welch t | Verdict |
|---|---|---|---|---|---|---|---|---|---|---|
| Mosha sequence | 1 | −1.026 | −0.896 | 0 | n/a | n/a | 1 | n/a | n/a | FAIL |
| Mosha barrier entry | 2185 | −0.086 | −0.026 | 948 | −0.098 | -0.9 | 1 | −0.007 | -0.13 | FAIL |
| Engulf D1 | 44 | +0.339 | +0.301 | 11 | −0.502 | -1.52 | 1 | −0.457 | -1.35 | FAIL |
| Engulf H4 | 89 | −0.094 | −0.073 | 27 | +0.006 | 0.04 | 1 | +0.047 | 0.18 | FAIL |
| Engulf H1 | 146 | +0.070 | +0.155 | 68 | +0.058 | 0.34 | 1 | +0.153 | 0.84 | FAIL |
| Engulf plan (with the Daily) | 85 | −0.275 | −0.229 | 46 | −0.115 | -0.45 | 1 | +0.004 | 0.02 | FAIL |
| Engulf short method | 110 | −0.171 | −0.029 | 34 | −0.389 | -2.18 | 0.7607 | −0.281 | -1.25 | FAIL |
| MSNR with the direction, 12-16 UTC | 78 | −0.308 | −0.139 | 36 | −0.055 | -0.27 | 1 | +0.090 | 0.43 | FAIL |
| MSNR with the direction, other hours | 192 | −0.345 | −0.159 | 76 | −0.069 | -0.48 | 1 | +0.119 | 0.82 | FAIL |
| MSNR gold plan | 37 | −0.166 | −0.134 | 22 | +0.403 | 0.99 | 1 | +0.547 | 1.28 | FAIL |
| MSNR gold plan, QM entry | 3 | +0.303 | +0.322 | 2 | +2.961 | n/a | 1 | +3.058 | 21.68 | FAIL |
| LIT, loose limit | 30 | +0.052 | +0.076 | 19 | −0.424 | -1.22 | 1 | −0.243 | -0.74 | FAIL |
| Pool: every trade | 3032 | −0.098 | −0.022 | 1302 | −0.089 | -1.06 | 1 | +0.016 | 0.34 | FAIL |

## Reading it

- Out of sample the trades with P are net positive in 2 of 13 groups; 0 reach month t >= 2 after Holm.
- With P beats without P in both windows in 2 of 13 groups (trade-level difference of means); the largest out-of-sample Welch t is 0.23.
- Mosha barrier entry, the group the 2026 split pointed at: out of sample −0.090R with P (n 584) against −0.090R without.
- The question is closed on these years: no variant of the condition is run on 2020-2025.

## Limits

- The trades are each desk's reading as its code stood on 21 Nov 2026 (the desk-partial run); the desks have changed since.
- Each trade is taken as booked, alone: a desk that skipped the trades without P would have held other positions.
- Groups share months and markets, and the pool is mostly Mosha barrier entries.
- Three markets, OANDA mid 5-minute candles (M15 and H1 built from them); today's cost model charged on every year.
- One run, no variants: by the pre-registration no other timeframes, look-backs or freshness windows are tried on 2020-2025.
- Nothing live changed. A pass would only have been a candidate for a forward paper record.
