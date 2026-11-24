# A tradable evening fade? (result)

**Verdict: FAIL. the picked cell A 2ATR mkt all (-0.012R a trade after costs in 2005-14, n 12,950) P1 -0.061R (n 14,143, t -4.26); P2 -0.069R (n 7,775, t -3.97); P3 -0.039R (n 13,849, t -3.28) after costs.**

Run 24 Nov 2026 as pre-registered (`PREREGISTRATION.md`, committed and pushed alone first). Research only: nothing live
changed, nothing is proposed. One run, no variants after it. Judged AFTER costs.

## What was run

`grid7-wide-fade` M15 fade signals (imported) with the rollover rule always on: no fill and no holding between 21:00 and 22:59
UTC (a trade still open is closed at the close of the last candle before 21:00), out after a day, target 2R. Grid of 24 cells:
break hours A (20, 23) or B (17-20, 23, 00, 01) x stop 1 / 1.5 / 2 x ATR(14) of M15 x market or limit (0.25 ATR better, 12
candles) x all or calm (ATR below 0.8 of its 100-candle median). One cell picked on OANDA 2005-14 after costs (n >= 1,000).
Costs: the demo figures; **ASSUMED** for xag, nzdusd, usdcad, usdchf, eurjpy, gbpjpy, audjpy, cadjpy, eurgbp, euraud.

## Gate

- Rollover rule off, 1 ATR, market, break hours 20-23, 2015-26: n 27,671, +0.169R (fade-hour-check: n 27,671, +0.169R); this study's simulator against the grid's exits: 0 trades differ. Equal.

## The picked cell

**A 2ATR mkt all**: 2005-14 n 12,950, +0.088R before costs, -0.012R after (month t -0.91).

## Primary tests (after costs)

| Test | What | n | R before | R after (month t) | at 2x cost | Holm p | Pass |
|---|---|---:|---:|---:|---:|---:|---|
| P1 | OANDA ten markets, 2015-01 .. 2026-10 | 14,143 | +0.053 | -0.061 (-4.26) | -0.175 | 1.000 | no |
| P2 | HistData eight markets, 2018-02 .. 2026-10 | 7,775 | +0.041 | -0.069 (-3.97) | -0.178 | 1.000 | no |
| P3 | five crosses, OANDA, 2005-01 .. 2026-10 | 13,849 | +0.050 | -0.039 (-3.28) | -0.129 | 1.000 | no |

## Every cell

n | R before | R after (month t) | R at 2x cost, per window.

| Cell | 05-14 n | before | after (t) | 2x | 15-26 n | before | after (t) | 2x | HistData n | before | after (t) | 2x | crosses n | before | after (t) | 2x |
|---|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|
| A 1ATR mkt all | 12,557 | +0.108 | -0.055 (-4.21) | -0.218 | 13,705 | +0.061 | -0.129 (-9.01) | -0.320 | 7,606 | +0.059 | -0.134 (-7.94) | -0.328 | 13,848 | +0.078 | -0.101 (-7.54) | -0.280 |
| A 1ATR mkt calm | 7,170 | +0.098 | -0.087 (-4.50) | -0.271 | 8,625 | +0.066 | -0.146 (-7.54) | -0.359 | 4,353 | +0.045 | -0.176 (-7.32) | -0.397 | 7,817 | +0.070 | -0.138 (-7.59) | -0.346 |
| A 1ATR lim all | 9,519 | +0.001 | -0.165 (-10.50) | -0.331 | 10,802 | -0.000 | -0.193 (-13.13) | -0.386 | 5,974 | +0.012 | -0.184 (-9.25) | -0.380 | 10,969 | +0.029 | -0.151 (-9.91) | -0.331 |
| A 1ATR lim calm | 5,690 | -0.016 | -0.202 (-9.62) | -0.388 | 7,034 | -0.010 | -0.224 (-11.34) | -0.437 | 3,596 | +0.003 | -0.218 (-8.21) | -0.438 | 6,373 | +0.016 | -0.192 (-9.26) | -0.399 |
| A 1.5ATR mkt all | 12,831 | +0.096 | -0.028 (-2.20) | -0.152 | 13,976 | +0.056 | -0.084 (-5.58) | -0.224 | 7,711 | +0.056 | -0.082 (-4.67) | -0.220 | 13,849 | +0.056 | -0.064 (-5.19) | -0.183 |
| A 1.5ATR mkt calm | 7,358 | +0.103 | -0.038 (-2.19) | -0.179 | 8,807 | +0.056 | -0.100 (-4.91) | -0.255 | 4,432 | +0.052 | -0.107 (-4.53) | -0.266 | 7,818 | +0.051 | -0.088 (-5.25) | -0.226 |
| A 1.5ATR lim all | 9,740 | +0.027 | -0.100 (-6.72) | -0.226 | 11,001 | +0.004 | -0.137 (-8.64) | -0.278 | 6,050 | +0.015 | -0.124 (-6.49) | -0.264 | 10,970 | +0.026 | -0.094 (-5.98) | -0.214 |
| A 1.5ATR lim calm | 5,846 | +0.020 | -0.123 (-6.22) | -0.265 | 7,177 | +0.001 | -0.155 (-7.66) | -0.310 | 3,655 | +0.013 | -0.145 (-5.73) | -0.303 | 6,374 | +0.008 | -0.131 (-6.58) | -0.269 |
| A 2ATR mkt all **(picked)** | 12,950 | +0.088 | -0.012 (-0.91) | -0.112 | 14,143 | +0.053 | -0.061 (-4.26) | -0.175 | 7,775 | +0.041 | -0.069 (-3.97) | -0.178 | 13,849 | +0.050 | -0.039 (-3.28) | -0.129 |
| A 2ATR mkt calm | 7,458 | +0.092 | -0.023 (-1.28) | -0.139 | 8,928 | +0.062 | -0.065 (-3.22) | -0.191 | 4,463 | +0.040 | -0.084 (-3.46) | -0.208 | 7,818 | +0.048 | -0.057 (-3.36) | -0.161 |
| A 2ATR lim all | 9,833 | +0.048 | -0.054 (-3.55) | -0.156 | 11,126 | +0.020 | -0.094 (-6.13) | -0.208 | 6,105 | -0.009 | -0.121 (-6.08) | -0.232 | 10,970 | +0.027 | -0.063 (-4.20) | -0.153 |
| A 2ATR lim calm | 5,924 | +0.051 | -0.066 (-3.21) | -0.183 | 7,269 | +0.019 | -0.107 (-5.38) | -0.234 | 3,683 | -0.022 | -0.146 (-5.76) | -0.269 | 6,374 | +0.007 | -0.097 (-4.84) | -0.200 |
| B 1ATR mkt all | 47,761 | +0.070 | -0.077 (-9.53) | -0.224 | 57,185 | +0.044 | -0.130 (-17.44) | -0.304 | 33,089 | +0.049 | -0.132 (-14.26) | -0.314 | 54,046 | +0.056 | -0.103 (-12.88) | -0.261 |
| B 1ATR mkt calm | 18,463 | +0.066 | -0.117 (-9.09) | -0.301 | 24,425 | +0.054 | -0.158 (-13.39) | -0.369 | 13,688 | +0.058 | -0.168 (-11.86) | -0.393 | 19,892 | +0.050 | -0.160 (-13.35) | -0.370 |
| B 1ATR lim all | 37,071 | -0.007 | -0.155 (-17.28) | -0.303 | 45,867 | +0.002 | -0.174 (-21.01) | -0.350 | 26,508 | +0.008 | -0.177 (-16.07) | -0.361 | 42,994 | +0.019 | -0.141 (-15.43) | -0.301 |
| B 1ATR lim calm | 14,894 | -0.035 | -0.220 (-15.75) | -0.405 | 20,396 | -0.006 | -0.220 (-16.89) | -0.433 | 11,497 | +0.004 | -0.223 (-14.36) | -0.450 | 16,375 | +0.007 | -0.203 (-15.01) | -0.412 |
| B 1.5ATR mkt all | 48,592 | +0.058 | -0.053 (-7.61) | -0.163 | 58,419 | +0.041 | -0.090 (-12.89) | -0.220 | 33,690 | +0.043 | -0.090 (-9.89) | -0.223 | 54,062 | +0.045 | -0.061 (-9.15) | -0.167 |
| B 1.5ATR mkt calm | 18,996 | +0.061 | -0.081 (-7.08) | -0.223 | 25,138 | +0.049 | -0.111 (-9.67) | -0.272 | 14,040 | +0.055 | -0.112 (-8.22) | -0.278 | 19,908 | +0.047 | -0.094 (-9.24) | -0.234 |
| B 1.5ATR lim all | 37,723 | +0.002 | -0.109 (-13.15) | -0.220 | 46,875 | +0.005 | -0.127 (-16.75) | -0.259 | 27,004 | +0.013 | -0.123 (-11.98) | -0.259 | 43,007 | +0.023 | -0.084 (-11.05) | -0.191 |
| B 1.5ATR lim calm | 15,326 | -0.016 | -0.159 (-12.32) | -0.302 | 21,003 | +0.003 | -0.158 (-13.13) | -0.320 | 11,801 | +0.015 | -0.153 (-9.95) | -0.322 | 16,388 | +0.017 | -0.123 (-10.86) | -0.263 |
| B 2ATR mkt all | 48,960 | +0.049 | -0.039 (-5.90) | -0.128 | 59,035 | +0.041 | -0.064 (-10.49) | -0.170 | 33,948 | +0.038 | -0.068 (-7.90) | -0.174 | 54,065 | +0.043 | -0.036 (-6.07) | -0.116 |
| B 2ATR mkt calm | 19,298 | +0.055 | -0.064 (-5.83) | -0.182 | 25,555 | +0.055 | -0.078 (-7.57) | -0.210 | 14,148 | +0.049 | -0.081 (-6.05) | -0.212 | 19,910 | +0.050 | -0.055 (-5.72) | -0.161 |
| B 2ATR lim all | 38,027 | +0.013 | -0.076 (-9.56) | -0.166 | 47,378 | +0.017 | -0.090 (-12.74) | -0.197 | 27,216 | +0.017 | -0.091 (-9.06) | -0.199 | 43,009 | +0.027 | -0.053 (-7.15) | -0.133 |
| B 2ATR lim calm | 15,573 | +0.012 | -0.107 (-8.38) | -0.226 | 21,359 | +0.023 | -0.111 (-9.95) | -0.245 | 11,895 | +0.023 | -0.109 (-6.87) | -0.241 | 16,389 | +0.025 | -0.080 (-7.07) | -0.186 |

## The picked cell by market

| Feed | Market | 2005-14 n | after (t) | 2015-26 n | after (t) |
|---|---|---:|---:|---:|---:|
| oanda | xau | 1,170 | -0.064 (-1.62) | 1,297 | -0.060 (-1.75) |
| oanda | xag* | 884 | -0.408 (-9.35) | 973 | -0.351 (-7.57) |
| oanda | eurusd | 1,373 | +0.028 (0.93) | 1,444 | -0.010 (-0.29) |
| oanda | gbpusd | 1,359 | +0.043 (1.35) | 1,334 | +0.004 (0.11) |
| oanda | usdjpy | 1,477 | +0.110 (3.11) | 1,797 | -0.020 (-0.66) |
| oanda | audusd | 1,398 | -0.016 (-0.53) | 1,612 | -0.073 (-2.40) |
| oanda | nzdusd* | 1,313 | -0.060 (-1.90) | 1,479 | -0.077 (-2.36) |
| oanda | usdcad* | 1,242 | +0.020 (0.60) | 1,382 | -0.014 (-0.41) |
| oanda | usdchf* | 1,297 | +0.061 (1.81) | 1,175 | -0.042 (-1.17) |
| oanda | eurjpy* | 1,437 | +0.012 (0.34) | 1,650 | -0.062 (-2.05) |
| hist | xau | 0 | n/a (n/a) | 901 | -0.072 (-1.94) |
| hist | xag* | 0 | n/a (n/a) | 722 | -0.314 (-7.00) |
| hist | eurusd | 0 | n/a (n/a) | 1,036 | -0.034 (-0.78) |
| hist | gbpusd | 0 | n/a (n/a) | 928 | -0.054 (-1.18) |
| hist | usdjpy | 0 | n/a (n/a) | 1,296 | -0.039 (-1.17) |
| hist | audusd | 0 | n/a (n/a) | 1,110 | -0.079 (-2.35) |
| hist | usdcad* | 0 | n/a (n/a) | 940 | +0.042 (1.11) |
| hist | usdchf* | 0 | n/a (n/a) | 842 | -0.069 (-1.63) |
| cross | gbpjpy* | 1,372 | +0.071 (2.10) | 1,544 | -0.089 (-3.22) |
| cross | audjpy* | 1,407 | +0.013 (0.45) | 1,582 | -0.096 (-2.97) |
| cross | cadjpy* | 1,271 | +0.002 (0.06) | 1,612 | -0.047 (-1.53) |
| cross | eurgbp* | 1,131 | -0.059 (-1.93) | 1,183 | -0.090 (-2.59) |
| cross | euraud* | 1,290 | +0.002 (0.05) | 1,457 | -0.085 (-2.78) |

\* cost assumed. HistData rows: 2015-26 column = Feb 2018 on.

## The picked cell by year (after costs)

| Year | ten markets n | after | crosses n | after |
|---|---:|---:|---:|---:|
| 2005 | 1,005 | +0.127 | 658 | +0.101 |
| 2006 | 1,144 | +0.045 | 606 | +0.143 |
| 2007 | 1,259 | -0.046 | 707 | +0.007 |
| 2008 | 1,370 | -0.033 | 646 | -0.039 |
| 2009 | 1,449 | -0.000 | 673 | -0.081 |
| 2010 | 1,457 | -0.089 | 681 | +0.008 |
| 2011 | 1,353 | +0.044 | 615 | -0.034 |
| 2012 | 1,463 | -0.024 | 700 | -0.037 |
| 2013 | 1,255 | -0.016 | 591 | +0.077 |
| 2014 | 1,195 | -0.087 | 594 | -0.050 |
| 2015 | 1,132 | -0.005 | 537 | -0.062 |
| 2016 | 1,178 | -0.016 | 633 | -0.065 |
| 2017 | 1,121 | -0.082 | 615 | -0.121 |
| 2018 | 1,093 | -0.012 | 616 | -0.148 |
| 2019 | 1,010 | -0.111 | 548 | -0.047 |
| 2020 | 1,252 | -0.087 | 643 | -0.101 |
| 2021 | 1,212 | -0.066 | 620 | -0.142 |
| 2022 | 1,247 | -0.083 | 656 | -0.051 |
| 2023 | 1,204 | -0.088 | 665 | -0.067 |
| 2024 | 1,330 | -0.101 | 684 | -0.011 |
| 2025 | 1,316 | +0.015 | 700 | -0.045 |
| 2026 | 1,048 | -0.108 | 461 | -0.130 |

## Beside the two passing breakouts (descriptive)

Monthly sums of R after costs, 1R a trade, fade = the picked cell on the ten markets and the five crosses. No weights fitted.

| Breakout | months | from | correlation | fade R / month (t) | breakout R / month (t) | combined t |
|---|---:|---|---:|---:|---:|---:|
| gold breakout (2021-01 .. 2026-10) | 70 | 2021-01 | 0.02 | -11.18 (-4.09) | 1.63 (2.70) | -3.40 |
| USD/JPY breakout (2016-01 .. 2026-10) | 130 | 2016-01 | -0.08 | -10.95 (-5.78) | 1.00 (2.45) | -5.22 |

## Checks

- Every trade has its stop on the losing side of its entry (the simulator throws otherwise); closed candles only; no fill and
  no holding in 21:00-22:59 UTC, also across a data gap or a weekend; a limit's fill candle can only stop the trade.

| Market | from | dropped (bad data) | risk under cost | unresolved | limit not filled | market fill in rollover |
|---|---|---:|---:|---:|---:|---:|
| xau | 2006-03-19 | 3 | 94 | 7 | 2,442 | 327 |
| xag | 2006-03-19 | 67 | 12,839 | 7 | 2,406 | 327 |
| eurusd | 2004-01-01 | 19 | 10 | 0 | 2,625 | 365 |
| gbpusd | 2004-01-01 | 49 | 20 | 0 | 2,794 | 387 |
| usdjpy | 2004-01-01 | 33 | 26 | 0 | 2,581 | 393 |
| audusd | 2004-01-01 | 29 | 12 | 0 | 2,725 | 382 |
| nzdusd | 2004-01-01 | 1 | 11 | 6 | 2,849 | 453 |
| usdcad | 2004-01-01 | 43 | 2 | 0 | 2,907 | 468 |
| usdchf | 2004-01-01 | 41 | 10 | 3 | 2,794 | 407 |
| eurjpy | 2004-01-01 | 2 | 14 | 6 | 2,579 | 429 |
| xau | 2018-01-01 | 0 | 0 | 7 | 981 | 166 |
| xag | 2018-01-01 | 0 | 3,178 | 4 | 987 | 231 |
| eurusd | 2018-01-01 | 0 | 0 | 0 | 1,025 | 151 |
| gbpusd | 2018-01-01 | 0 | 0 | 0 | 1,069 | 194 |
| usdjpy | 2018-01-01 | 0 | 0 | 0 | 1,003 | 198 |
| audusd | 2018-01-01 | 0 | 0 | 0 | 1,041 | 190 |
| usdcad | 2018-01-01 | 0 | 0 | 0 | 1,138 | 207 |
| usdchf | 2018-01-01 | 0 | 0 | 3 | 1,130 | 272 |
| gbpjpy | 2004-01-01 | 0 | 12 | 0 | 2,574 | 425 |
| audjpy | 2004-05-31 | 0 | 16 | 0 | 2,563 | 424 |
| cadjpy | 2004-05-31 | 0 | 24 | 0 | 2,689 | 490 |
| eurgbp | 2004-01-01 | 1 | 29 | 3 | 2,761 | 459 |
| euraud | 2004-05-31 | 0 | 0 | 6 | 2,698 | 430 |

## What it means

**No version of the evening fade survives costs once it stays clear of the rollover.** All 24 cells lose after costs in
every window, on both feeds and on the five crosses; the picked cell (the least bad in 2005-14) is negative in all three tests.

What the grid shows about what was missing:
- **The rollover was most of the tilt.** With no fill and no holding in 21:00-22:59, break hours 20 and 23 at a 1 ATR stop make
  +0.061R a trade before costs in 2015-26 (n 13,705) against +0.169R for the 20-23 block that held through it.
  What is left is real on every feed (crosses +0.078R, HistData +0.059R before costs) but smaller than one round trip.
- **A wider stop cuts the cost in R but the edge shrinks with it** (2 ATR: +0.053R before, -0.061R after in 2015-26).
- **A better-priced limit makes it worse** (-0.000R before costs at 1 ATR): the orders that fill are the ones where the
  break kept going (adverse selection), the ones that would have worked leave without them.
- **The calm-volatility filter does not help** after costs in any window.
- **The wider evening window B is no better** (-0.064R after costs at 2 ATR in 2015-26, n 59,035).
- **As a complement it adds nothing**: its monthly R is uncorrelated with the gold and USD/JPY breakouts (about 0), but it
  loses on its own, so a book with it is worse than the breakouts alone (see the table).

So the fade of the first M15 break is a small, real mean-reversion of quotes in the evening, mostly at the rollover, and too
small to pay a taker's spread. The one way left to test it would be paying less than the mid-to-mid move: a maker order at the
break level with the broker's own ticks (the tick probe), on its own pre-registration. On these candles it is closed: no more
cuts of this rule on these years. Nothing live changed; never call it an edge.
