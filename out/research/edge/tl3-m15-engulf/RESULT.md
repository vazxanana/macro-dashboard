# H1 trendline, third touch, M15 engulf away from the line: result (24 Nov 2026)

**Verdict: FAIL. 0 of 2 line cells pass; the better one, line swing, made -0.154R a trade after costs in 2015-26 (n 1,821, month t -3.87; -0.066R before costs) and -0.168R in 2005-14 (n 1,382, month t -4.28).**

Run once, as pre-registered (`PREREGISTRATION.md`, committed alone before this code). Research only: nothing live changed,
nothing is proposed. Code: `run.mjs` (the shared toolkit, `engulfAt` of `council/eg-methods.mjs`, the costs and data-quality
exclusions of `combo-grid-2`). Data: OANDA mid 5-minute candles of xau, eurusd, gbpusd, usdjpy, audusd, grouped to UTC M15 and H1.

## What was run

A rising H1 line through two confirmed swing lows (3 candles a side, the second higher, at least 12 H1 candles apart, never
closed below); its third touch = the first M15 candle that comes within 0.1 H1 ATR of it; within that candle and the next three,
an M15 engulf up (a close above the high of the last opposite candle, 3 candles back at most) with no M15 close below the line:
buy at the next 5-minute open, stop 0.1 M15 ATR under the lowest low since the touch, target 2R or the last H1 swing high at
least 0.5R away, out after 48 hours. Sells mirror it on a falling line through two swing highs. Control: every M15 engulf, no
line, same stop rule and exits. A trade risking under 3 round trips is skipped. Costs are taken off every trade.

## Every cell

R a trade (month-sum t in brackets), before and after costs; win rate and mean cost in R are the confirmation window's, after costs.

| Cell | n 05-14 | before costs 05-14 (t) | after costs 05-14 (t) | n 15-26 | before costs 15-26 (t) | after costs 15-26 (t) | winners | cost R | Holm | Pass |
|---|---:|---:|---:|---:|---:|---:|---:|---:|---:|---|
| line 2R | 1,566 | -0.005 (-0.15) | -0.074 (-2.13) | 2,097 | -0.037 (-1.23) | -0.121 (-3.99) | 33.4 % | 0.084 | 1.000 | no |
| line swing | 1,382 | -0.096 (-2.47) | -0.168 (-4.28) | 1,821 | -0.066 (-1.65) | -0.154 (-3.87) | 32.5 % | 0.088 | 1.000 | no |
| control 2R | 456,530 | -0.030 (-9.07) | -0.103 (-26.29) | 564,056 | -0.024 (-7.74) | -0.109 (-30.96) | 33.3 % | 0.085 | 1.000 | no |
| control swing | 389,891 | -0.070 (-14.36) | -0.146 (-27.70) | 480,145 | -0.047 (-9.03) | -0.136 (-23.75) | 31.0 % | 0.089 | 1.000 | no |

## Does the line pick better engulfs?

Line minus control, R a trade after costs (Welch t on trades; descriptive, no verdict).

| Exit | 2005-14 | 2015-26 |
|---|---:|---:|
| 2R | +0.029 (t 0.81) | -0.012 (t -0.41) |
| swing | -0.022 (t -0.55) | -0.018 (t -0.44) |

## The line cells by side and by market (descriptive)

| Cell | n 05-14 | before costs 05-14 (t) | after costs 05-14 (t) | n 15-26 | before costs 15-26 (t) | after costs 15-26 (t) | winners | cost R |
|---|---:|---:|---:|---:|---:|---:|---:|---:|
| line 2R buys | 815 | -0.037 (-0.72) | -0.108 (-2.09) | 1,075 | -0.064 (-1.77) | -0.146 (-4.02) | 32.8 % | 0.083 |
| line 2R sells | 751 | +0.029 (0.57) | -0.038 (-0.75) | 1,022 | -0.009 (-0.20) | -0.095 (-2.07) | 34.0 % | 0.086 |
| line swing buys | 709 | -0.129 (-2.55) | -0.202 (-3.97) | 908 | -0.114 (-2.30) | -0.202 (-4.06) | 31.4 % | 0.088 |
| line swing sells | 673 | -0.062 (-1.07) | -0.133 (-2.29) | 913 | -0.017 (-0.30) | -0.106 (-1.83) | 33.6 % | 0.089 |
| xau line 2R | 252 | -0.051 (-0.62) | -0.179 (-2.15) | 438 | +0.033 (0.51) | -0.073 (-1.10) | 35.8 % | 0.107 |
| xau line swing | 228 | -0.143 (-1.49) | -0.275 (-2.81) | 377 | -0.088 (-1.15) | -0.200 (-2.58) | 32.9 % | 0.112 |
| eurusd line 2R | 304 | +0.048 (0.56) | -0.001 (-0.01) | 388 | -0.027 (-0.37) | -0.100 (-1.33) | 34.0 % | 0.073 |
| eurusd line swing | 268 | +0.018 (0.17) | -0.033 (-0.32) | 335 | -0.095 (-0.86) | -0.172 (-1.54) | 29.3 % | 0.076 |
| gbpusd line 2R | 315 | +0.067 (0.88) | +0.018 (0.24) | 403 | -0.143 (-1.96) | -0.220 (-2.99) | 29.5 % | 0.077 |
| gbpusd line swing | 278 | -0.117 (-1.43) | -0.167 (-2.03) | 348 | -0.067 (-0.68) | -0.148 (-1.49) | 32.2 % | 0.081 |
| usdjpy line 2R | 322 | -0.007 (-0.07) | -0.088 (-0.98) | 426 | +0.038 (0.52) | -0.048 (-0.65) | 35.9 % | 0.086 |
| usdjpy line swing | 292 | -0.147 (-1.65) | -0.231 (-2.56) | 376 | +0.002 (0.02) | -0.087 (-0.95) | 35.1 % | 0.089 |
| audusd line 2R | 373 | -0.078 (-1.27) | -0.130 (-2.13) | 442 | -0.092 (-1.46) | -0.169 (-2.69) | 31.4 % | 0.077 |
| audusd line swing | 316 | -0.094 (-1.23) | -0.148 (-1.95) | 385 | -0.082 (-1.03) | -0.163 (-2.04) | 32.7 % | 0.081 |

## Counts and checks

- Lines accepted: 17,048. Ended before a touch: 0 by an H1 close through, 25 by age, 1,898 replaced by a newer line. Touched a third time: 15,127.
- Of the touched: 9,572 cancelled by an M15 close through the line, 1,832 with no engulf in four candles, 3,721 signals.
- Line signals skipped for a risk under 3 round trips: 52; with no swing target at least 0.5R away (2R cell only): 460.
- Control signals: 1,040,784. All streams: dropped for bad data 654, fill at or past the stop 710, risk under 3 round trips 18,841, unresolved at the data's end 49.
- Cut test: 15 cuts over the five markets, 1,611,134 signals known by the cut dates, 0 missing or extra when the candles are cut there.
- Every trade has its stop on the losing side of the fill (the run throws otherwise). Stop first when a 5-minute candle holds both.

## What it means

No line cell clears the bar. With the 2R target the trendline entry made -0.037R a trade before costs and -0.121R after
them in 2015-26 (-0.005R and -0.074R in 2005-14); the same engulf with no line made -0.024R before and -0.109R after
(-0.030R and -0.103R). The line's difference from the control is -0.012R (t -0.41) at 2R and -0.018R (t -0.44) at the
swing target in 2015-26, +0.029R (t 0.81) and -0.022R (t -0.55) in 2005-14.
Read it with the earlier trendline studies (`trendline-engulf-2020`, `tl-third-touch`, `trendline-qm`): a mechanical line through
the last two swings, touched a third time, does not turn an engulf into a trade that pays its costs. It does not judge a line
chosen by eye. No variant is run on these years. Nothing live changed; no rule is proposed.
