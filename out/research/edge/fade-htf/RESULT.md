# Fade on H4 and D1: fading the first structure break on the higher timeframes (result)

**Verdict: FAIL. 0 of 12 fade cells pass (0 too few to judge); the best judged cell, h4 ext 1R fade, made +0.026R a trade before costs in 2015-26 (n 13,787, month t 2.34; discovery +0.030R, t 2.59).**

Run 23 Nov 2026 as pre-registered (`PREREGISTRATION.md`, committed and pushed alone first). Research only: nothing live
changed, nothing is proposed. One run, no variants.

## What was run

The first structure break (a close beyond the last confirmed swing, 3 candles a side; `grid7-wide-fade` `breaks`) on H4 (UTC
4-hour buckets) or D1 (UTC days, weekend candles folded into the next weekday), FADED: market entry against the break at the
next 5-minute open; the "with" mirror beside (same fill, same stop distance on the other side, same targets in R). Stop past the
break candle's extreme + 0.1 ATR(14) ("ext") or 1 ATR(14) ("atr"); exit at 1R, 2R or the opposite swing ("swing"); time limit
H4 8 days, D1 30 days. Ten markets pooled, OANDA mid 5-minute candles. Discovery = fills 2005-2014, confirmation = 2015 to
October 2026. Judged before costs on month sums; Holm over the 12 fade confirmation tests.
Costs beside: the demo figures for gold and the four majors; **ASSUMED, not measured** for xag, nzdusd, usdcad, usdchf, eurjpy.

## The bar, fade cells

- n >= 300 in both windows: 12 of 12 (too few to judge: none).
- Mean R > 0 and month t >= 2 in discovery: 1; in confirmation: 2; both: 1.
- Holm-adjusted p < 0.05: 0.
- **All four: 0.**
- Of those, positive after costs in both windows: 0.

## Every cell

R a trade before costs (month-sum t), after costs beside; "cost R" = mean round-trip cost / risk in 2015-26. The "with" row is
the same cell traded WITH the break (reported, not judged).

| Cell | n 05-14 | R 05-14 (t) | net 05-14 | n 15-26 | R 15-26 (t) | net 15-26 (t) | cost R | Holm | Status |
|---|---:|---:|---:|---:|---:|---:|---:|---:|---|
| h4 ext 1R fade | 12,329 | +0.030 (2.59) | -0.076 | 13,787 | +0.026 (2.34) | -0.101 (-8.94) | 0.127 | 0.125 | fail |
| h4 ext 2R fade | 12,329 | +0.020 (1.25) | -0.087 | 13,787 | +0.037 (2.30) | -0.090 (-5.68) | 0.127 | 0.128 | fail |
| h4 ext swing fade | 11,735 | +0.044 (1.28) | -0.063 | 13,087 | +0.040 (1.15) | -0.089 (-2.57) | 0.128 | 1.000 | fail |
| h4 atr 1R fade | 12,476 | -0.016 (-1.33) | -0.054 | 14,019 | -0.019 (-1.66) | -0.062 (-5.45) | 0.043 | 1.000 | fail |
| h4 atr 2R fade | 12,476 | +0.019 (1.12) | -0.018 | 14,019 | -0.022 (-1.35) | -0.065 (-4.02) | 0.043 | 1.000 | fail |
| h4 atr swing fade | 11,877 | +0.017 (0.90) | -0.021 | 13,313 | -0.014 (-0.70) | -0.057 (-2.91) | 0.044 | 1.000 | fail |
| d1 ext 1R fade | 1,821 | -0.024 (-0.93) | -0.070 | 2,186 | -0.038 (-1.67) | -0.097 (-4.11) | 0.058 | 1.000 | fail |
| d1 ext 2R fade | 1,821 | -0.015 (-0.40) | -0.060 | 2,186 | -0.058 (-1.72) | -0.116 (-3.41) | 0.058 | 1.000 | fail |
| d1 ext swing fade | 1,715 | +0.139 (1.47) | +0.093 | 2,089 | -0.046 (-0.61) | -0.105 (-1.38) | 0.059 | 1.000 | fail |
| d1 atr 1R fade | 1,831 | -0.025 (-0.85) | -0.037 | 2,211 | +0.008 (0.30) | -0.008 (-0.32) | 0.016 | 1.000 | fail |
| d1 atr 2R fade | 1,831 | +0.029 (0.69) | +0.017 | 2,211 | +0.022 (0.58) | +0.006 (0.17) | 0.016 | 1.000 | fail |
| d1 atr swing fade | 1,724 | +0.022 (0.47) | +0.009 | 2,112 | +0.017 (0.37) | +0.001 (0.02) | 0.016 | 1.000 | fail |
| h4 ext 1R with | 12,329 | -0.043 (-3.74) | -0.149 | 13,787 | -0.038 (-3.44) | -0.165 (-14.37) | 0.127 | - | not judged |
| h4 ext 2R with | 12,329 | -0.032 (-2.04) | -0.138 | 13,787 | -0.026 (-1.79) | -0.153 (-10.07) | 0.127 | - | not judged |
| h4 ext swing with | 11,735 | -0.046 (-1.20) | -0.152 | 13,087 | -0.007 (-0.20) | -0.135 (-3.73) | 0.128 | - | not judged |
| h4 atr 1R with | 12,476 | +0.015 (1.23) | -0.023 | 14,019 | +0.016 (1.43) | -0.027 (-2.41) | 0.043 | - | not judged |
| h4 atr 2R with | 12,476 | +0.015 (0.84) | -0.022 | 14,019 | +0.017 (0.96) | -0.026 (-1.50) | 0.043 | - | not judged |
| h4 atr swing with | 11,877 | +0.033 (1.24) | -0.005 | 13,313 | +0.014 (0.58) | -0.030 (-1.26) | 0.044 | - | not judged |
| d1 ext 1R with | 1,821 | +0.021 (0.80) | -0.025 | 2,186 | +0.037 (1.62) | -0.021 (-0.91) | 0.058 | - | not judged |
| d1 ext 2R with | 1,821 | +0.045 (1.19) | -0.000 | 2,186 | +0.013 (0.37) | -0.045 (-1.25) | 0.058 | - | not judged |
| d1 ext swing with | 1,715 | +0.170 (1.39) | +0.124 | 2,089 | -0.026 (-0.30) | -0.085 (-0.97) | 0.059 | - | not judged |
| d1 atr 1R with | 1,831 | +0.025 (0.85) | +0.012 | 2,211 | -0.008 (-0.30) | -0.024 (-0.91) | 0.016 | - | not judged |
| d1 atr 2R with | 1,831 | +0.084 (1.73) | +0.072 | 2,211 | -0.012 (-0.29) | -0.028 (-0.69) | 0.016 | - | not judged |
| d1 atr swing with | 1,724 | +0.134 (1.94) | +0.122 | 2,112 | -0.006 (-0.12) | -0.022 (-0.45) | 0.016 | - | not judged |

## Stop size

Risk of the fade trades over both windows, in pips (0.01 on yen pairs, 0.0001 on other pairs) or dollars (gold, silver):
mean / median / typical (= cost / mean(cost / risk), the harmonic mean). The lower-timeframe columns are the same "typical" figure
for `grid7-wide-fade`'s cells, from its committed result. * = cost ASSUMED.

| Market | unit | h4 ext | h4 atr | d1 ext | d1 atr | m5 ext / atr | m15 ext / atr | h1 ext / atr |
|---|---|---:|---:|---:|---:|---:|---:|---:|
| xau | $ | 4.11 / 2.82 / 2.08 | 9.34 / 7.05 / 6.36 | 8.68 / 6.55 / 5.29 | 25.2 / 20.08 / 18.82 | 0.58 / 0.81 | 0.71 / 1.34 | 1.1 / 2.96 |
| xag* | $ | 0.14 / 0.08 / 0.07 | 0.26 / 0.19 / 0.17 | 0.24 / 0.17 / 0.14 | 0.72 / 0.53 / 0.47 | 0.05 / 0.05 | 0.05 / 0.06 | 0.06 / 0.08 |
| eurusd | pips | 14.67 / 11.63 / 8.84 | 36.35 / 32.61 / 30.49 | 31.48 / 26.79 / 22.04 | 99.56 / 90.25 / 86.34 | 1.45 / 3.22 | 2 / 5.97 | 3.98 / 13.39 |
| gbpusd | pips | 18.52 / 14.79 / 11.34 | 46.28 / 42.04 / 39.45 | 40.52 / 35.07 / 27.2 | 125.96 / 116.14 / 112.15 | 1.84 / 4.09 | 2.49 / 7.73 | 4.92 / 17.24 |
| usdjpy | pips | 14.58 / 11.37 / 8.33 | 35.26 / 32.23 / 28.56 | 36.6 / 28.59 / 22.56 | 96.64 / 89.34 / 82.93 | 1.73 / 3.39 | 2.3 / 6.29 | 4.16 / 13.91 |
| audusd | pips | 12.06 / 9.69 / 7.26 | 31.78 / 27.44 / 26.72 | 27.96 / 22.18 / 17.96 | 83.16 / 71.28 / 71.68 | 1.34 / 3.05 | 1.83 / 5.76 | 3.45 / 12.85 |
| nzdusd* | pips | 11.36 / 9.12 / 7.13 | 29.98 / 26.93 / 25.84 | 27.09 / 22.26 / 18.04 | 78.03 / 69.89 / 69.57 | 1.46 / 2.97 | 1.87 / 5.69 | 3.35 / 12.59 |
| usdcad* | pips | 13.73 / 10.48 / 7.78 | 34.67 / 31.61 / 29.36 | 29.19 / 25.44 / 19.82 | 91.66 / 85.9 / 81.62 | 1.49 / 3.11 | 1.92 / 5.91 | 3.43 / 13.26 |
| usdchf* | pips | 13.11 / 9.84 / 7.32 | 31.37 / 28.24 / 26.77 | 28.36 / 22.49 / 19.21 | 84.96 / 74.86 / 73.79 | 1.48 / 2.76 | 1.9 / 5.18 | 3.29 / 11.65 |
| eurjpy* | pips | 18.18 / 13.84 / 10.61 | 47.8 / 41.89 / 39.43 | 44.03 / 32.08 / 26.34 | 126.04 / 111.73 / 109.15 | 2.13 / 4.89 | 2.88 / 8.92 | 5.38 / 18.98 |

## Checks

- Cut test: 10 cuts on xau, eurusd: 16,762 H4 / D1 signals known by the cut dates, 0 missing or extra when the candles are cut there.
- Every trade has its stop on the losing side of the fill (the run throws otherwise); a fill at or past the stop and a risk under the round-trip cost are no trades (same for fade and mirror).
- Exclusions: the data-quality audit's bad intervals (`combo-grid-2` `exclusions`).

| Market | candles from | signals | simulated | dropped (bad data) | past the stop | risk under cost | unresolved at data end |
|---|---|---:|---:|---:|---:|---:|---:|
| xau | 2006-03-19 | 2,891 | 5,760 | 1 | 5 | 13 | 2 |
| xag | 2006-03-19 | 2,821 | 5,274 | 7 | 9 | 345 | 2 |
| eurusd | 2004-01-01 | 3,316 | 6,519 | 0 | 6 | 1 | 1 |
| gbpusd | 2004-01-01 | 3,309 | 6,513 | 1 | 7 | 0 | 3 |
| usdjpy | 2004-01-01 | 3,037 | 5,957 | 3 | 9 | 0 | 4 |
| audusd | 2004-01-01 | 3,113 | 6,109 | 4 | 7 | 0 | 2 |
| nzdusd | 2004-01-01 | 3,070 | 6,034 | 1 | 8 | 0 | 3 |
| usdcad | 2004-01-01 | 3,220 | 6,312 | 1 | 6 | 0 | 1 |
| usdchf | 2004-01-01 | 3,215 | 6,310 | 2 | 4 | 0 | 4 |
| eurjpy | 2004-01-01 | 3,010 | 5,897 | 0 | 4 | 1 | 3 |

## What it means

No fade cell clears the bar on H4 or D1. With stops many times the spread, the tilt the lower-timeframe fades show before
costs is not there to be captured, which fits the reading that the M5 / M15 tilt is a reversal of the mid quote at the scale
of the spread. Do not re-test variants of these cells on these years. Nothing live changed; no rule is proposed.
