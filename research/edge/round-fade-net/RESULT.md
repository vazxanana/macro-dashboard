# Round-number fade after costs: higher timeframes and complements (result)

**Verdict: FAIL. 0 of 30 cells pass after costs; the best, h4 exhaust+dayext 3R, made -0.063R a trade after costs in 2015-26 (n 5,926, month t -2.43; +0.035R before costs).**

Run 24 Nov 2026 as pre-registered (`PREREGISTRATION.md`, committed and pushed alone first). Research only: nothing live
changed, nothing is proposed. One run, no variants.

## What was run

The fade of a close through a round level (`round-number-breaks`' levels and events) on M15, H1 and H4, stop past the event
candle's extreme + 0.1 ATR, market entry at the next 5-minute open, 2R or 3R, time limit 1 / 2 / 5 days. Complements: none;
exhaust (event candle range >= 1.5 ATR); quiet (fill 17:00-06:59 UTC); dayext (fill in the outer 20 % of the last 20 New York
days' range, on the side of the close); exhaust+dayext. Ten markets pooled; judged AFTER costs on month sums in 2005-14 and
2015-26, Holm over 30, and positive after costs on the five measured-cost markets alone. Costs ASSUMED for xag, nzdusd, usdcad, usdchf, eurjpy.

## The bar, cell by cell

- n >= 200 in both windows: 30 of 30.
- After costs mean > 0 and month t >= 2 in discovery: 0; in confirmation: 0.
- Holm-adjusted p < 0.05: 0. Positive after costs on the measured markets: 0.
- **All five: 0.**

## Every cell

R a trade after costs (month-sum t after costs), before costs beside; cost R = mean round trip / risk in 2015-26.

| Cell | n 05-14 | net 05-14 (t) | gross 05-14 | n 15-26 | net 15-26 (t) | gross 15-26 (t) | cost R | measured net 15-26 (t) | Holm | Pass |
|---|---:|---:|---:|---:|---:|---:|---:|---:|---:|---|
| m15 none 2R | 205,663 | -0.200 (-39.58) | +0.066 | 198,732 | -0.307 (-43.27) | +0.018 (4.62) | 0.325 | -0.293 (-42.83) | 1.000 | no |
| m15 none 3R | 205,663 | -0.145 (-26.08) | +0.121 | 198,732 | -0.264 (-39.92) | +0.061 (13.01) | 0.325 | -0.251 (-36.90) | 1.000 | no |
| m15 exhaust 2R | 72,031 | -0.184 (-24.22) | +0.049 | 66,308 | -0.277 (-36.16) | +0.005 (0.82) | 0.283 | -0.276 (-31.70) | 1.000 | no |
| m15 exhaust 3R | 72,031 | -0.126 (-14.24) | +0.107 | 66,308 | -0.225 (-27.24) | +0.058 (7.41) | 0.283 | -0.220 (-23.33) | 1.000 | no |
| m15 quiet 2R | 94,188 | -0.194 (-31.75) | +0.102 | 88,734 | -0.307 (-34.05) | +0.051 (8.68) | 0.358 | -0.300 (-33.46) | 1.000 | no |
| m15 quiet 3R | 94,188 | -0.134 (-18.71) | +0.162 | 88,734 | -0.268 (-31.29) | +0.089 (12.89) | 0.358 | -0.260 (-30.15) | 1.000 | no |
| m15 dayext 2R | 52,963 | -0.195 (-20.31) | +0.068 | 50,253 | -0.309 (-22.46) | +0.015 (1.86) | 0.325 | -0.297 (-19.49) | 1.000 | no |
| m15 dayext 3R | 52,963 | -0.137 (-12.30) | +0.126 | 50,253 | -0.267 (-18.96) | +0.058 (5.99) | 0.325 | -0.258 (-15.88) | 1.000 | no |
| m15 exhaust+dayext 2R | 19,998 | -0.180 (-13.49) | +0.048 | 17,435 | -0.276 (-17.25) | +0.007 (0.53) | 0.283 | -0.284 (-14.10) | 1.000 | no |
| m15 exhaust+dayext 3R | 19,998 | -0.112 (-7.45) | +0.116 | 17,435 | -0.224 (-12.02) | +0.060 (3.54) | 0.283 | -0.226 (-9.37) | 1.000 | no |
| h1 none 2R | 110,321 | -0.063 (-10.45) | +0.093 | 109,115 | -0.155 (-26.61) | +0.039 (7.17) | 0.194 | -0.139 (-21.65) | 1.000 | no |
| h1 none 3R | 110,321 | -0.040 (-5.24) | +0.116 | 109,115 | -0.139 (-20.34) | +0.054 (8.23) | 0.194 | -0.121 (-14.83) | 1.000 | no |
| h1 exhaust 2R | 42,888 | -0.097 (-9.55) | +0.042 | 41,294 | -0.154 (-18.16) | +0.015 (1.81) | 0.169 | -0.139 (-13.54) | 1.000 | no |
| h1 exhaust 3R | 42,888 | -0.081 (-7.22) | +0.058 | 41,294 | -0.134 (-12.80) | +0.035 (3.36) | 0.169 | -0.117 (-9.37) | 1.000 | no |
| h1 quiet 2R | 53,084 | -0.028 (-3.73) | +0.136 | 50,713 | -0.149 (-16.24) | +0.054 (6.20) | 0.203 | -0.142 (-14.23) | 1.000 | no |
| h1 quiet 3R | 53,084 | -0.001 (-0.08) | +0.164 | 50,713 | -0.144 (-14.10) | +0.060 (6.01) | 0.203 | -0.135 (-11.26) | 1.000 | no |
| h1 dayext 2R | 30,472 | -0.041 (-3.80) | +0.115 | 29,708 | -0.151 (-13.29) | +0.045 (4.45) | 0.196 | -0.129 (-10.08) | 1.000 | no |
| h1 dayext 3R | 30,472 | -0.005 (-0.38) | +0.151 | 29,708 | -0.126 (-9.27) | +0.070 (5.65) | 0.196 | -0.106 (-6.56) | 1.000 | no |
| h1 exhaust+dayext 2R | 13,358 | -0.070 (-4.31) | +0.072 | 12,285 | -0.150 (-10.54) | +0.021 (1.50) | 0.171 | -0.138 (-8.17) | 1.000 | no |
| h1 exhaust+dayext 3R | 13,358 | -0.038 (-1.91) | +0.104 | 12,285 | -0.124 (-6.89) | +0.047 (2.66) | 0.171 | -0.107 (-4.80) | 1.000 | no |
| h4 none 2R | 53,621 | -0.032 (-4.12) | +0.056 | 53,956 | -0.080 (-10.50) | +0.029 (3.79) | 0.109 | -0.068 (-7.74) | 1.000 | no |
| h4 none 3R | 53,621 | -0.026 (-2.90) | +0.062 | 53,956 | -0.086 (-10.00) | +0.023 (2.67) | 0.109 | -0.071 (-6.98) | 1.000 | no |
| h4 exhaust 2R | 17,518 | -0.072 (-4.94) | +0.009 | 16,769 | -0.085 (-6.04) | +0.008 (0.58) | 0.093 | -0.075 (-4.30) | 1.000 | no |
| h4 exhaust 3R | 17,518 | -0.063 (-3.59) | +0.018 | 16,769 | -0.085 (-5.08) | +0.008 (0.47) | 0.093 | -0.075 (-3.52) | 1.000 | no |
| h4 quiet 2R | 23,205 | +0.007 (0.61) | +0.102 | 22,688 | -0.052 (-3.99) | +0.066 (4.98) | 0.118 | -0.041 (-2.63) | 1.000 | no |
| h4 quiet 3R | 23,205 | +0.008 (0.61) | +0.103 | 22,688 | -0.061 (-3.82) | +0.057 (3.53) | 0.118 | -0.045 (-2.30) | 1.000 | no |
| h4 dayext 2R | 16,476 | -0.025 (-1.65) | +0.064 | 16,357 | -0.084 (-5.46) | +0.027 (1.87) | 0.112 | -0.090 (-5.05) | 1.000 | no |
| h4 dayext 3R | 16,476 | -0.009 (-0.51) | +0.080 | 16,357 | -0.085 (-4.68) | +0.027 (1.52) | 0.112 | -0.086 (-4.22) | 1.000 | no |
| h4 exhaust+dayext 2R | 6,288 | -0.065 (-2.55) | +0.020 | 5,926 | -0.081 (-3.74) | +0.017 (0.81) | 0.098 | -0.093 (-3.25) | 1.000 | no |
| h4 exhaust+dayext 3R | 6,288 | -0.058 (-2.07) | +0.027 | 5,926 | -0.063 (-2.43) | +0.035 (1.38) | 0.098 | -0.078 (-2.34) | 1.000 | no |

## Checks

- Cut test (H1 and H4 events): 10 cuts on xau, usdjpy: 240,992 events known by the cut dates, 0 missing or extra.
- Every trade has its stop on the losing side of the fill (the run throws otherwise); a fill past the stop or a risk under the round trip is no trade.

| Market | from | events | trades | dropped | past the stop | risk under cost | unresolved |
|---|---|---:|---:|---:|---:|---:|---:|
| xau | 2006-03-19 | 89,160 | 81,470 | 4 | 397 | 7,286 | 1 |
| xag | 2006-03-19 | 52,864 | 31,192 | 642 | 638 | 20,391 | 1 |
| eurusd | 2004-01-01 | 78,861 | 76,575 | 17 | 219 | 1,496 | 0 |
| gbpusd | 2004-01-01 | 100,333 | 96,790 | 62 | 402 | 2,430 | 1 |
| usdjpy | 2004-01-01 | 77,387 | 73,921 | 27 | 207 | 2,696 | 2 |
| audusd | 2004-01-01 | 70,668 | 67,394 | 44 | 411 | 2,309 | 0 |
| nzdusd | 2004-01-01 | 68,369 | 64,076 | 5 | 416 | 3,364 | 1 |
| usdcad | 2004-01-01 | 75,146 | 71,300 | 48 | 361 | 2,870 | 0 |
| usdchf | 2004-01-01 | 70,233 | 65,590 | 41 | 553 | 3,494 | 0 |
| eurjpy | 2004-01-01 | 106,999 | 103,100 | 5 | 316 | 2,990 | 0 |

## What it means

No cell is positive after costs in both decades. The best before costs in 2015-26 was m15 none 3R (+0.061R, t 13.01; -0.264R after costs):
moving to higher timeframes makes the cost a smaller share of 1R but the pull-back tilt shrinks with it, and none of the
complements (exhaustion candle, quiet hours, daily-range extreme) adds enough to pay the spread. The round-number fade is
closed: no further variants on these years. Nothing live changed.
