# Compression breakout: a break out of a tight range against the ordinary break (result)

**Verdict: FAIL. 0 of 56 cells pass; the best confirmation cell, m15 n8 fade trail all, made +0.162R a trade before costs in 2015-26 (n 11,797, month t 9.19; discovery +0.196R, t 10.11; Welch t against the ordinary break -0.65 / 0.86).**

Run 23 Nov 2026 as pre-registered (`PREREGISTRATION.md`, committed and pushed alone first). Research only: nothing live
changed, nothing is proposed. One run, no variants.

## What was run

A close out of a tight M15 or H1 range: the last 8 (n8) or 16 (n16) closed candles spanning under 1.5 ATR(14), or three
candles inside the one before them (inside). Traded WITH the break (stop past the box's other side + 0.1 ATR) and FADED
(stop past the break candle's extreme + 0.1 ATR), at market at the next 5-minute open; exits 1R, 2R, or a 1R trail from +1R;
time limit 1 day (M15) / 2 days (H1). 36 cells over all sessions plus 20 splits (n8, 2R: London / New York / other, daily
range so far under / over half the daily ATR): 56. Control = `grid7-wide-fade`'s ordinary first structure break, same
timeframe, direction, exit and split (with-stop past the opposite swing). Ten markets pooled, OANDA mid 5-minute candles;
discovery 2005-2014, confirmation 2015 to October 2026. Judged before costs.
Costs beside: the demo figures for gold and the four majors; **ASSUMED, not measured** for xag, nzdusd, usdcad, usdchf, eurjpy.

## The bar, cell by cell

- n >= 300 in both windows: 42 of 56.
- Mean R > 0 and month t >= 2 in discovery: 17; in confirmation: 12; both: 12.
- Holm-adjusted p < 0.05: 10.
- Welch t >= 2 against the ordinary break in both windows: 2.
- **All five: 0.**
- Of those, positive after costs in both windows: 0.

## Every cell

R a trade before costs (month-sum t), after costs ("net") beside; control = the ordinary break, same timeframe, direction,
exit and split; Welch = cell minus control per trade, discovery / confirmation.

| Cell | n 05-14 | R 05-14 (t) | net 05-14 | n 15-26 | R 15-26 (t) | net 15-26 | Holm | Control R 05-14 / 15-26 | Welch | Pass |
|---|---:|---:|---:|---:|---:|---:|---:|---:|---:|---|
| m15 n8 with 1R all | 12,970 | -0.038 (-4.05) | -0.137 | 15,762 | -0.031 (-3.46) | -0.141 | 1.000 | -0.019 / -0.022 | -2.03 / -1.10 | no |
| m15 n8 with 2R all | 12,970 | -0.050 (-3.62) | -0.149 | 15,762 | -0.041 (-3.38) | -0.150 | 1.000 | -0.016 / -0.024 | -2.74 / -1.54 | no |
| m15 n8 with trail all | 12,970 | -0.046 (-3.96) | -0.145 | 15,762 | -0.041 (-3.58) | -0.150 | 1.000 | -0.016 / -0.021 | -2.69 / -1.95 | no |
| m15 n8 fade 1R all | 10,222 | -0.008 (-0.74) | -0.366 | 11,797 | -0.026 (-2.36) | -0.465 | 1.000 | -0.030 / -0.053 | 2.05 / 2.88 | no |
| m15 n8 fade 2R all | 10,222 | +0.105 (6.55) | -0.253 | 11,797 | +0.066 (4.43) | -0.373 | 0.000 | +0.094 / +0.054 | 0.74 / 0.83 | no |
| m15 n8 fade trail all | 10,222 | +0.196 (10.11) | -0.162 | 11,797 | +0.162 (9.19) | -0.277 | 0.000 | +0.208 / +0.147 | -0.65 / 0.86 | no |
| m15 n16 with 1R all | 1 | +1.000 (1.00) | +0.505 | 0 | n/a (0.00) | n/a | 1.000 | -0.019 / -0.022 | n/a / n/a | no |
| m15 n16 with 2R all | 1 | -1.000 (-1.00) | -1.495 | 0 | n/a (0.00) | n/a | 1.000 | -0.016 / -0.024 | n/a / n/a | no |
| m15 n16 with trail all | 1 | +0.486 (1.00) | -0.010 | 0 | n/a (0.00) | n/a | 1.000 | -0.016 / -0.021 | n/a / n/a | no |
| m15 n16 fade 1R all | 1 | +1.000 (1.00) | +0.578 | 0 | n/a (0.00) | n/a | 1.000 | -0.030 / -0.053 | n/a / n/a | no |
| m15 n16 fade 2R all | 1 | +2.000 (1.00) | +1.578 | 0 | n/a (0.00) | n/a | 1.000 | +0.094 / +0.054 | n/a / n/a | no |
| m15 n16 fade trail all | 1 | +0.730 (1.00) | +0.308 | 0 | n/a (0.00) | n/a | 1.000 | +0.208 / +0.147 | n/a / n/a | no |
| m15 inside with 1R all | 21,766 | -0.033 (-4.38) | -0.135 | 18,019 | -0.032 (-4.35) | -0.137 | 1.000 | -0.019 / -0.022 | -1.81 / -1.28 | no |
| m15 inside with 2R all | 21,766 | -0.041 (-4.17) | -0.143 | 18,019 | -0.041 (-3.95) | -0.146 | 1.000 | -0.016 / -0.024 | -2.51 / -1.65 | no |
| m15 inside with trail all | 21,766 | -0.033 (-3.06) | -0.135 | 18,019 | -0.039 (-4.10) | -0.144 | 1.000 | -0.016 / -0.021 | -1.83 / -1.89 | no |
| m15 inside fade 1R all | 16,965 | -0.035 (-4.26) | -0.379 | 13,869 | -0.049 (-5.43) | -0.462 | 1.000 | -0.030 / -0.053 | -0.68 / 0.43 | no |
| m15 inside fade 2R all | 16,965 | +0.087 (8.27) | -0.257 | 13,869 | +0.051 (3.74) | -0.362 | 0.007 | +0.094 / +0.054 | -0.55 / -0.24 | no |
| m15 inside fade trail all | 16,965 | +0.202 (14.03) | -0.142 | 13,869 | +0.120 (7.39) | -0.293 | 0.000 | +0.208 / +0.147 | -0.38 / -1.79 | no |
| h1 n8 with 1R all | 5,738 | -0.045 (-2.66) | -0.101 | 7,138 | -0.032 (-2.22) | -0.086 | 1.000 | +0.001 / -0.005 | -3.08 / -2.16 | no |
| h1 n8 with 2R all | 5,738 | -0.027 (-1.23) | -0.083 | 7,138 | -0.012 (-0.63) | -0.066 | 1.000 | +0.008 / +0.002 | -1.77 / -0.82 | no |
| h1 n8 with trail all | 5,738 | -0.008 (-0.44) | -0.065 | 7,138 | -0.021 (-1.27) | -0.075 | 1.000 | +0.016 / +0.003 | -1.34 / -1.56 | no |
| h1 n8 fade 1R all | 5,170 | +0.099 (6.80) | -0.144 | 6,612 | +0.022 (1.61) | -0.246 | 1.000 | +0.035 / -0.009 | 4.34 / 2.35 | no |
| h1 n8 fade 2R all | 5,170 | +0.185 (8.72) | -0.058 | 6,612 | +0.068 (3.17) | -0.200 | 0.045 | +0.105 / +0.040 | 3.65 / 1.47 | no |
| h1 n8 fade trail all | 5,170 | +0.206 (10.45) | -0.037 | 6,612 | +0.091 (4.70) | -0.177 | 0.000 | +0.134 / +0.069 | 3.30 / 1.17 | no |
| h1 n16 with 1R all | 0 | n/a (0.00) | n/a | 0 | n/a (0.00) | n/a | 1.000 | +0.001 / -0.005 | n/a / n/a | no |
| h1 n16 with 2R all | 0 | n/a (0.00) | n/a | 0 | n/a (0.00) | n/a | 1.000 | +0.008 / +0.002 | n/a / n/a | no |
| h1 n16 with trail all | 0 | n/a (0.00) | n/a | 0 | n/a (0.00) | n/a | 1.000 | +0.016 / +0.003 | n/a / n/a | no |
| h1 n16 fade 1R all | 0 | n/a (0.00) | n/a | 0 | n/a (0.00) | n/a | 1.000 | +0.035 / -0.009 | n/a / n/a | no |
| h1 n16 fade 2R all | 0 | n/a (0.00) | n/a | 0 | n/a (0.00) | n/a | 1.000 | +0.105 / +0.040 | n/a / n/a | no |
| h1 n16 fade trail all | 0 | n/a (0.00) | n/a | 0 | n/a (0.00) | n/a | 1.000 | +0.134 / +0.069 | n/a / n/a | no |
| h1 inside with 1R all | 5,617 | -0.037 (-2.28) | -0.099 | 5,168 | -0.008 (-0.61) | -0.064 | 1.000 | +0.001 / -0.005 | -2.41 / -0.23 | no |
| h1 inside with 2R all | 5,617 | -0.013 (-0.60) | -0.076 | 5,168 | -0.007 (-0.38) | -0.063 | 1.000 | +0.008 / +0.002 | -1.03 / -0.49 | no |
| h1 inside with trail all | 5,617 | +0.001 (0.03) | -0.062 | 5,168 | -0.007 (-0.42) | -0.064 | 1.000 | +0.016 / +0.003 | -0.79 / -0.60 | no |
| h1 inside fade 1R all | 5,093 | +0.100 (5.79) | -0.121 | 4,790 | +0.007 (0.38) | -0.247 | 1.000 | +0.035 / -0.009 | 4.03 / 1.04 | no |
| h1 inside fade 2R all | 5,093 | +0.177 (7.47) | -0.044 | 4,790 | +0.057 (2.31) | -0.197 | 0.505 | +0.105 / +0.040 | 3.15 / 0.75 | no |
| h1 inside fade trail all | 5,093 | +0.214 (8.79) | -0.007 | 4,790 | +0.083 (3.25) | -0.171 | 0.035 | +0.134 / +0.069 | 3.32 / 0.60 | no |
| m15 n8 with 2R london | 1,250 | +0.047 (1.20) | -0.039 | 1,567 | +0.022 (0.62) | -0.080 | 1.000 | +0.021 / +0.001 | 0.64 / 0.59 | no |
| m15 n8 with 2R ny | 1,409 | -0.002 (-0.05) | -0.061 | 1,416 | +0.024 (0.63) | -0.052 | 1.000 | +0.017 / -0.003 | -0.53 / 0.75 | no |
| m15 n8 with 2R other | 10,311 | -0.069 (-4.48) | -0.175 | 12,779 | -0.056 (-4.41) | -0.170 | 1.000 | -0.042 / -0.041 | -1.85 / -1.18 | no |
| m15 n8 with 2R dlow | 5,996 | -0.038 (-1.91) | -0.161 | 7,456 | -0.040 (-2.20) | -0.167 | 1.000 | -0.017 / -0.018 | -1.08 / -1.30 | no |
| m15 n8 with 2R dhigh | 6,744 | -0.056 (-3.13) | -0.131 | 8,084 | -0.041 (-2.57) | -0.133 | 1.000 | -0.012 / -0.028 | -2.64 / -0.83 | no |
| m15 n8 fade 2R london | 1,049 | +0.063 (1.29) | -0.248 | 1,249 | -0.051 (-1.21) | -0.463 | 1.000 | +0.041 / +0.014 | 0.47 / -1.60 | no |
| m15 n8 fade 2R ny | 1,276 | +0.050 (1.18) | -0.235 | 1,211 | -0.031 (-0.73) | -0.383 | 1.000 | +0.015 / -0.005 | 0.85 / -0.64 | no |
| m15 n8 fade 2R other | 7,897 | +0.119 (6.33) | -0.257 | 9,337 | +0.094 (5.63) | -0.360 | 0.000 | +0.151 / +0.100 | -1.83 / -0.38 | no |
| m15 n8 fade 2R dlow | 4,354 | +0.124 (4.48) | -0.271 | 5,181 | +0.110 (4.78) | -0.365 | 0.000 | +0.121 / +0.070 | 0.10 / 1.92 | no |
| m15 n8 fade 2R dhigh | 5,732 | +0.084 (4.60) | -0.246 | 6,460 | +0.035 (1.89) | -0.380 | 1.000 | +0.061 / +0.037 | 1.17 / -0.08 | no |
| h1 n8 with 2R london | 837 | +0.009 (0.18) | -0.054 | 897 | +0.043 (0.91) | -0.012 | 1.000 | +0.001 / +0.012 | 0.17 / 0.68 | no |
| h1 n8 with 2R ny | 135 | -0.080 (-0.77) | -0.126 | 217 | +0.121 (1.16) | +0.071 | 1.000 | +0.037 / +0.020 | -1.03 / 1.12 | no |
| h1 n8 with 2R other | 4,766 | -0.032 (-1.33) | -0.087 | 6,024 | -0.025 (-1.17) | -0.079 | 1.000 | -0.004 / -0.015 | -1.23 / -0.50 | no |
| h1 n8 with 2R dlow | 5,166 | -0.024 (-1.01) | -0.083 | 6,396 | -0.012 (-0.58) | -0.068 | 1.000 | +0.005 / -0.003 | -1.30 / -0.45 | no |
| h1 n8 with 2R dhigh | 530 | -0.051 (-0.96) | -0.079 | 720 | -0.003 (-0.06) | -0.039 | 1.000 | +0.015 / +0.007 | -1.21 / -0.22 | no |
| h1 n8 fade 2R london | 748 | +0.189 (3.17) | -0.038 | 837 | +0.029 (0.52) | -0.212 | 1.000 | +0.046 / +0.010 | 2.41 / 0.36 | no |
| h1 n8 fade 2R ny | 127 | +0.097 (0.74) | -0.096 | 204 | +0.137 (1.27) | -0.095 | 1.000 | +0.040 / +0.021 | 0.43 / 1.13 | no |
| h1 n8 fade 2R other | 4,295 | +0.187 (8.10) | -0.060 | 5,571 | +0.071 (3.13) | -0.202 | 0.050 | +0.187 / +0.073 | 0.01 / -0.08 | no |
| h1 n8 fade 2R dlow | 4,623 | +0.183 (8.07) | -0.071 | 5,895 | +0.063 (2.78) | -0.213 | 0.141 | +0.148 / +0.038 | 1.40 / 1.19 | no |
| h1 n8 fade 2R dhigh | 513 | +0.180 (2.62) | +0.028 | 700 | +0.103 (1.96) | -0.087 | 1.000 | +0.061 / +0.035 | 1.82 / 1.23 | no |

## Checks

- Cut test: 10 cuts on xau, usdjpy: 300,726 signals known by the cut dates, 0 missing or extra when the candles are cut there.
- Every trade has its stop on the losing side of the fill (the run throws otherwise); a fill at or past the stop and a risk under the round-trip cost are no trades.
- Exclusions: the data-quality audit's bad intervals (`combo-grid-2` `exclusions`).

| Market | candles from | n8 | n16 | inside | control breaks | simulated | dropped | past the stop | risk under cost | no opposite swing | unresolved |
|---|---|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|
| xau | 2006-03-19 | 4,261 | 0 | 5,052 | 44,345 | 91,367 | 5 | 551 | 12,150 | 3,248 | 6 |
| xag | 2006-03-19 | 4,407 | 2 | 5,373 | 44,482 | 64,371 | 111 | 2,251 | 38,488 | 3,418 | 4 |
| eurusd | 2004-01-01 | 4,667 | 0 | 5,085 | 49,644 | 110,547 | 35 | 420 | 3,968 | 3,857 | 5 |
| gbpusd | 2004-01-01 | 4,633 | 0 | 5,040 | 49,322 | 109,116 | 71 | 485 | 4,452 | 3,937 | 6 |
| usdjpy | 2004-01-01 | 3,953 | 0 | 5,585 | 48,601 | 107,292 | 59 | 371 | 5,753 | 2,862 | 5 |
| audusd | 2004-01-01 | 3,674 | 0 | 4,987 | 50,300 | 109,073 | 44 | 819 | 4,878 | 3,152 | 4 |
| nzdusd | 2004-01-01 | 3,373 | 0 | 5,183 | 49,779 | 106,241 | 3 | 643 | 6,723 | 3,063 | 5 |
| usdcad | 2004-01-01 | 4,479 | 0 | 5,367 | 50,052 | 108,674 | 71 | 489 | 6,640 | 3,993 | 2 |
| usdchf | 2004-01-01 | 4,555 | 0 | 5,087 | 49,129 | 105,029 | 69 | 1,204 | 7,430 | 3,879 | 4 |
| eurjpy | 2004-01-01 | 3,998 | 0 | 4,647 | 48,599 | 106,792 | 3 | 349 | 4,300 | 3,047 | 5 |

## What it means

No compression cell clears the bar: a close out of a tight M15 / H1 range does not behave, before costs and in both decades,
unlike the ordinary first structure break in a way that the pre-registered bar can see. Do not re-test variants of these 56
cells on these years. Nothing live changed; no rule is proposed.

**What the cells show.** Traded WITH the break, a tight-range break loses before costs in 18 of the 21 cells with
enough trades, and on M15 it does a little worse than the ordinary break (Welch t down to -2.7 in discovery): compression
does not turn the fading break into a following one. FADED, 12 cells clear both windows before costs, but none of them
beats the ordinary break faded the same way (the control) in confirmation: on M15 they match it, and the H1 fades that beat
it in 2005-14 (Welch t 3.2-3.7) fall to Welch t 0.6-1.5 in 2015-26. The tilt is the one `grid7-wide-fade` found, not
something the tight range adds. The two cells that beat their control in both windows (the 1R fades on M15 and H1 n8)
do not reach month t 2 in confirmation (-0.026R and +0.022R a trade). The 1R fades sit near zero while 2R and the trail
are positive, probably because a 5-minute candle holding stop and target books the stop (the pre-registered rule).
After costs 0 of the 56 cells is positive in both windows; the fades pay 0.3-0.5R a trade on M15.

**n16 is empty.** Sixteen candles spanning under 1.5 ATR(14) almost never happens (2 events in ten markets and 22 years):
the fixed threshold was too tight for that window, a design flaw of this pre-registration, said here and not re-run.
