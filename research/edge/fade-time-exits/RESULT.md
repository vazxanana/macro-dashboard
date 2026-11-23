# The fade over time: mark-to-market and time exits (result)

**Verdict: PASS. 4 of 4 time exits of m15 none atr pass before costs; best 60 min, +0.040R a trade in 2015-26 (n 201,760, month t 11.90; discovery +0.047R, t 11.52), -0.120R after costs.**

Run 23 Nov 2026 as pre-registered (`PREREGISTRATION.md`, committed and pushed alone first). Research only: nothing live
changed, nothing is proposed. One run, no variants.

## What was run

The rule of `grid7-wide-fade` cell **m15 none atr**, imported unchanged: fade the first M15 structure break (a close beyond the
last confirmed swing, 3 candles a side), market entry against it at the next 5-minute open, stop 1 x ATR(14) of M15 from the
fill. Marked to market at the open of the first 5-minute candle at or after 5, 15, 30, 60, 120, 240 minutes and 1 day (stop
first: a trade stopped before the mark counts at its stop, -1R or worse on a gap). Time exits at 15 / 30 / 60 / 240 minutes are
those marks; the grid's 2R and swing exits beside. Ten markets pooled, OANDA mid 5-minute candles; discovery = fills 2005-14,
confirmation = 2015 to October 2026; judged before costs on month sums, Holm over the 4 confirmation tests.
Costs beside: the demo figures for gold and the four majors; **ASSUMED, not measured** for xag, nzdusd, usdcad, usdchf, eurjpy.

## The bar: the four time exits (M15)

| Exit | n 05-14 | R 05-14 (t) | net 05-14 | n 15-26 | R 15-26 (t) | net 15-26 | cost R | Holm | Pass |
|---|---:|---:|---:|---:|---:|---:|---:|---:|---|
| 15 min | 171,523 | +0.023 (9.67) | -0.119 | 201,760 | +0.026 (11.56) | -0.134 | 0.160 | 0.000 | yes |
| 30 min | 171,523 | +0.030 (8.64) | -0.113 | 201,760 | +0.034 (11.28) | -0.127 | 0.160 | 0.000 | yes |
| 60 min | 171,523 | +0.047 (11.52) | -0.096 | 201,760 | +0.040 (11.90) | -0.120 | 0.160 | 0.000 | yes |
| 240 min | 171,523 | +0.074 (12.47) | -0.069 | 201,760 | +0.051 (10.02) | -0.110 | 0.160 | 0.000 | yes |
| grid 2R (beside) | 171,523 | +0.054 (11.38) | -0.088 | 201,760 | +0.042 (11.29) | -0.118 | 0.160 | | |

Passed: 15 min, 30 min, 60 min, 240 min. Of those, positive after costs in both windows: none.

## Secondary: each time exit against the grid's exits, paired by trade

Mean of (time-exit R - other exit R) per trade, month t of the month sums. Costs are the same on both sides of a pair.

| Exit | vs 2R 05-14 (t) | vs 2R 15-26 (t) | vs swing 05-14 (t) | vs swing 15-26 (t) |
|---|---:|---:|---:|---:|
| 15 min | -0.031 (-7.96) | -0.016 (-4.66) | -0.035 (-6.49) | -0.014 (-3.31) |
| 30 min | -0.024 (-7.18) | -0.008 (-2.48) | -0.026 (-5.48) | -0.007 (-1.59) |
| 60 min | -0.007 (-2.26) | -0.002 (-0.60) | -0.008 (-1.83) | +0.000 (0.06) |
| 240 min | +0.020 (4.71) | +0.009 (1.95) | +0.019 (4.14) | +0.010 (2.42) |

## The curve (descriptive)

Mean R at each mark before costs (month t), after costs beside. A trade stopped before a mark counts at its stop at that
mark and every later one, so "win" (share of trades above the fill) falls as the hold grows; the 2R and swing rows are the grid's exits.

### m5 none atr

| At | n 05-14 | R 05-14 (t) | net 05-14 | n 15-26 | R 15-26 (t) | net 15-26 | win 15-26 |
|---|---:|---:|---:|---:|---:|---:|---:|
| 5 min | 492,292 | +0.028 (12.36) | -0.195 | 591,338 | +0.039 (23.54) | -0.222 | 50.6% |
| 15 min | 492,292 | +0.051 (17.12) | -0.172 | 591,338 | +0.058 (24.19) | -0.203 | 46.3% |
| 30 min | 492,292 | +0.067 (21.09) | -0.155 | 591,338 | +0.070 (25.78) | -0.191 | 40.3% |
| 60 min | 492,292 | +0.089 (24.17) | -0.134 | 591,338 | +0.074 (23.98) | -0.187 | 32.5% |
| 120 min | 492,292 | +0.097 (24.99) | -0.125 | 591,338 | +0.076 (21.82) | -0.185 | 24.9% |
| 240 min | 492,292 | +0.092 (18.86) | -0.130 | 591,338 | +0.072 (16.30) | -0.190 | 18.4% |
| 1 day | 492,292 | +0.109 (10.18) | -0.113 | 591,338 | +0.085 (8.88) | -0.176 | 8.1% |
| 2R | 492,292 | +0.073 (24.59) | -0.149 | 591,338 | +0.066 (24.42) | -0.195 | 35.6% |
| swing | 468,984 | +0.087 (23.55) | -0.135 | 556,588 | +0.076 (22.06) | -0.185 | 26.6% |

### m15 none atr (the primary rule)

| At | n 05-14 | R 05-14 (t) | net 05-14 | n 15-26 | R 15-26 (t) | net 15-26 | win 15-26 |
|---|---:|---:|---:|---:|---:|---:|---:|
| 5 min | 171,523 | +0.018 (10.18) | -0.124 | 201,760 | +0.019 (12.39) | -0.142 | 51.7% |
| 15 min | 171,523 | +0.023 (9.67) | -0.119 | 201,760 | +0.026 (11.56) | -0.134 | 51.1% |
| 30 min | 171,523 | +0.030 (8.64) | -0.113 | 201,760 | +0.034 (11.28) | -0.127 | 48.3% |
| 60 min | 171,523 | +0.047 (11.52) | -0.096 | 201,760 | +0.040 (11.90) | -0.120 | 43.0% |
| 120 min | 171,523 | +0.069 (13.33) | -0.074 | 201,760 | +0.049 (11.54) | -0.111 | 36.0% |
| 240 min | 171,523 | +0.074 (12.47) | -0.069 | 201,760 | +0.051 (10.02) | -0.110 | 28.6% |
| 1 day | 171,523 | +0.085 (7.41) | -0.057 | 201,760 | +0.069 (6.55) | -0.092 | 13.5% |
| 2R | 171,523 | +0.054 (11.38) | -0.088 | 201,760 | +0.042 (11.29) | -0.118 | 35.1% |
| swing | 161,032 | +0.059 (9.45) | -0.084 | 186,568 | +0.040 (8.66) | -0.120 | 26.8% |

### h1 none atr

| At | n 05-14 | R 05-14 (t) | net 05-14 | n 15-26 | R 15-26 (t) | net 15-26 | win 15-26 |
|---|---:|---:|---:|---:|---:|---:|---:|
| 5 min | 45,310 | +0.007 (3.19) | -0.073 | 52,937 | +0.006 (2.96) | -0.083 | 51.7% |
| 15 min | 45,310 | +0.012 (3.48) | -0.068 | 52,937 | +0.005 (1.71) | -0.084 | 52.0% |
| 30 min | 45,310 | +0.006 (1.36) | -0.075 | 52,937 | +0.002 (0.45) | -0.087 | 51.2% |
| 60 min | 45,310 | +0.013 (2.40) | -0.068 | 52,937 | +0.008 (1.80) | -0.081 | 49.8% |
| 120 min | 45,310 | +0.024 (3.44) | -0.057 | 52,937 | +0.020 (3.65) | -0.069 | 47.2% |
| 240 min | 45,310 | +0.032 (3.98) | -0.049 | 52,937 | +0.023 (3.62) | -0.066 | 42.0% |
| 1 day | 45,310 | +0.048 (4.12) | -0.033 | 52,937 | +0.016 (1.51) | -0.073 | 23.9% |
| 2R | 45,310 | +0.018 (2.38) | -0.062 | 52,937 | +0.007 (0.94) | -0.082 | 34.4% |
| swing | 41,790 | +0.019 (1.91) | -0.062 | 48,549 | -0.004 (-0.40) | -0.093 | 27.0% |

## The move in pips (M15), beside the spread

Mean signed move per trade in the trade's direction at each mark, both windows together, in pips (gold: 1 pip = $0.10;
silver $0.01; yen pairs 0.01; other pairs 0.0001), with the mean stop distance and the round-trip cost in pips; * = cost ASSUMED.

| Market | stop | cost | 5 min | 15 min | 30 min | 60 min | 120 min | 240 min | 1 day |
|---|---:|---:|---:|---:|---:|---:|---:|---:|---:|
| xau | 22.58 | 3 | 0.22 | 0.34 | 0.13 | 0.39 | 0.42 | 0.74 | 1.88 |
| xag* | 8.45 | 3 | 0.01 | 0.02 | 0.04 | 0.16 | 0.26 | 0.37 | 0.33 |
| eurusd | 8.49 | 0.6 | 0.06 | 0.10 | 0.14 | 0.23 | 0.42 | 0.46 | 0.49 |
| gbpusd | 10.71 | 0.8 | 0.18 | 0.25 | 0.28 | 0.46 | 0.55 | 0.56 | 0.66 |
| usdjpy | 8.45 | 0.8 | 0.03 | 0.02 | -0.02 | 0.03 | 0.14 | 0.30 | 0.73 |
| audusd | 7.54 | 0.6 | 0.13 | 0.12 | 0.16 | 0.19 | 0.28 | 0.26 | 0.18 |
| nzdusd* | 7.15 | 0.7 | 0.16 | 0.19 | 0.20 | 0.26 | 0.29 | 0.27 | 0.36 |
| usdcad* | 8.05 | 0.7 | 0.21 | 0.31 | 0.37 | 0.52 | 0.72 | 0.72 | 0.53 |
| usdchf* | 7.23 | 0.7 | 0.12 | 0.16 | 0.20 | 0.24 | 0.28 | 0.23 | 0.16 |
| eurjpy* | 11.68 | 1 | 0.05 | 0.02 | 0.03 | 0.04 | 0.19 | 0.20 | 0.14 |

## Per market, passing time exits

Before costs (after costs in brackets); * = cost ASSUMED.

### 15 min

| Market | n 05-14 | R (t) [net] | n 15-26 | R (t) [net] |
|---|---:|---:|---:|---:|
| xau | 15,323 | +0.019 (3.28) [-0.242] | 19,890 | +0.002 (0.32) [-0.193] |
| xag* | 10,489 | -0.002 (-0.32) [-0.560] | 12,840 | +0.023 (2.82) [-0.504] |
| eurusd | 18,270 | +0.023 (3.73) [-0.058] | 21,255 | +0.028 (4.97) [-0.089] |
| gbpusd | 18,265 | +0.033 (5.21) [-0.057] | 20,961 | +0.036 (6.08) [-0.080] |
| usdjpy | 17,953 | +0.012 (2.04) [-0.115] | 20,643 | +0.002 (0.32) [-0.126] |
| audusd | 18,606 | +0.028 (4.36) [-0.055] | 21,438 | +0.032 (5.39) [-0.090] |
| nzdusd* | 18,282 | +0.025 (4.01) [-0.073] | 21,441 | +0.038 (6.65) [-0.107] |
| usdcad* | 18,428 | +0.051 (9.19) [-0.065] | 21,486 | +0.043 (8.07) [-0.078] |
| usdchf* | 18,175 | +0.025 (4.67) [-0.087] | 20,998 | +0.043 (7.79) [-0.112] |
| eurjpy* | 17,732 | +0.006 (0.95) [-0.090] | 20,808 | +0.015 (2.85) [-0.110] |

### 30 min

| Market | n 05-14 | R (t) [net] | n 15-26 | R (t) [net] |
|---|---:|---:|---:|---:|
| xau | 15,323 | +0.025 (3.08) [-0.236] | 19,890 | +0.002 (0.34) [-0.192] |
| xag* | 10,489 | +0.001 (0.05) [-0.557] | 12,840 | +0.036 (3.61) [-0.491] |
| eurusd | 18,270 | +0.030 (3.60) [-0.051] | 21,255 | +0.039 (5.26) [-0.078] |
| gbpusd | 18,265 | +0.048 (5.93) [-0.042] | 20,961 | +0.041 (5.63) [-0.074] |
| usdjpy | 17,953 | +0.013 (1.73) [-0.113] | 20,643 | -0.002 (-0.31) [-0.130] |
| audusd | 18,606 | +0.034 (4.76) [-0.048] | 21,438 | +0.047 (6.33) [-0.076] |
| nzdusd* | 18,282 | +0.028 (3.52) [-0.070] | 21,441 | +0.043 (6.11) [-0.102] |
| usdcad* | 18,428 | +0.065 (8.02) [-0.052] | 21,486 | +0.054 (7.74) [-0.066] |
| usdchf* | 18,175 | +0.037 (5.28) [-0.075] | 20,998 | +0.050 (6.91) [-0.105] |
| eurjpy* | 17,732 | +0.003 (0.42) [-0.093] | 20,808 | +0.024 (3.65) [-0.102] |

### 60 min

| Market | n 05-14 | R (t) [net] | n 15-26 | R (t) [net] |
|---|---:|---:|---:|---:|
| xau | 15,323 | +0.043 (4.17) [-0.218] | 19,890 | +0.009 (1.01) [-0.186] |
| xag* | 10,489 | +0.023 (1.81) [-0.534] | 12,840 | +0.039 (3.52) [-0.488] |
| eurusd | 18,270 | +0.043 (4.67) [-0.038] | 21,255 | +0.051 (5.63) [-0.066] |
| gbpusd | 18,265 | +0.073 (6.94) [-0.017] | 20,961 | +0.060 (6.58) [-0.056] |
| usdjpy | 17,953 | +0.031 (3.10) [-0.096] | 20,643 | -0.002 (-0.25) [-0.130] |
| audusd | 18,606 | +0.038 (4.25) [-0.045] | 21,438 | +0.060 (6.02) [-0.062] |
| nzdusd* | 18,282 | +0.046 (4.84) [-0.052] | 21,441 | +0.041 (5.22) [-0.103] |
| usdcad* | 18,428 | +0.100 (9.32) [-0.017] | 21,486 | +0.066 (7.97) [-0.054] |
| usdchf* | 18,175 | +0.057 (6.22) [-0.055] | 20,998 | +0.051 (5.88) [-0.104] |
| eurjpy* | 17,732 | +0.005 (0.60) [-0.091] | 20,808 | +0.024 (2.74) [-0.101] |

### 240 min

| Market | n 05-14 | R (t) [net] | n 15-26 | R (t) [net] |
|---|---:|---:|---:|---:|
| xau | 15,323 | +0.105 (6.79) [-0.156] | 19,890 | +0.010 (0.67) [-0.185] |
| xag* | 10,489 | +0.055 (2.83) [-0.503] | 12,840 | +0.050 (3.10) [-0.477] |
| eurusd | 18,270 | +0.082 (5.97) [+0.001] | 21,255 | +0.061 (4.75) [-0.056] |
| gbpusd | 18,265 | +0.098 (6.60) [+0.008] | 20,961 | +0.072 (5.26) [-0.044] |
| usdjpy | 17,953 | +0.066 (4.30) [-0.061] | 20,643 | +0.035 (2.36) [-0.093] |
| audusd | 18,606 | +0.056 (3.67) [-0.026] | 21,438 | +0.068 (4.61) [-0.055] |
| nzdusd* | 18,282 | +0.046 (3.37) [-0.052] | 21,441 | +0.048 (3.69) [-0.097] |
| usdcad* | 18,428 | +0.118 (8.61) [+0.002] | 21,486 | +0.081 (5.94) [-0.039] |
| usdchf* | 18,175 | +0.078 (5.05) [-0.035] | 20,998 | +0.038 (3.08) [-0.117] |
| eurjpy* | 17,732 | +0.031 (2.41) [-0.065] | 20,808 | +0.041 (3.05) [-0.085] |


## Checks

- xau: grid signal cut test 249,969 signals at 3 cut dates, 0 missing or extra; marks recomputed on candles cut at each mark (the mark candle's high, low and close replaced) on 400 trades: 0 of 2800 differ.
- eurusd: grid signal cut test 295,634 signals at 3 cut dates, 0 missing or extra; marks recomputed on candles cut at each mark (the mark candle's high, low and close replaced) on 400 trades: 0 of 2800 differ.
- Every trade has its stop on the losing side of the fill (the run throws otherwise); a fill past the stop and a risk under the round-trip cost are no trades.
- Exclusions: the data-quality audit's bad intervals (`combo-grid-2` `exclusions`). A trade counts only when every mark and the 2R exit resolve.

| Market | candles from | signals (3 timeframes) | used | dropped (bad data) | past the stop | risk under cost | unresolved |
|---|---|---:|---:|---:|---:|---:|---:|
| xau | 2006-03-19 | 149,453 | 144,023 | 10 | 0 | 5,418 | 2 |
| xag | 2006-03-19 | 149,441 | 68,222 | 304 | 0 | 80,907 | 8 |
| eurusd | 2004-01-01 | 168,996 | 168,666 | 88 | 0 | 151 | 6 |
| gbpusd | 2004-01-01 | 168,813 | 168,431 | 176 | 0 | 118 | 3 |
| usdjpy | 2004-01-01 | 165,453 | 164,843 | 134 | 0 | 380 | 6 |
| audusd | 2004-01-01 | 170,631 | 170,304 | 117 | 0 | 124 | 5 |
| nzdusd | 2004-01-01 | 169,160 | 168,850 | 3 | 0 | 223 | 6 |
| usdcad | 2004-01-01 | 169,395 | 168,730 | 168 | 0 | 386 | 6 |
| usdchf | 2004-01-01 | 168,588 | 167,727 | 160 | 0 | 603 | 5 |
| eurjpy | 2004-01-01 | 165,558 | 165,364 | 6 | 0 | 79 | 9 |

## What it means

4 time exit(s) clear the pre-registered bar before costs in both decades. None stays positive after costs. A before-cost tilt, not an edge; nothing is adopted, no live change, no variant on these years.

**The shape.** On M15 the tilt starts at once (+0.019R at 5 minutes in 2015-26) and grows slowly with the hold (+0.040R at 1 hour, +0.051R at 4 hours, +0.069R at a day); the
time exits do not keep it with a shorter hold: against the grid's 2R exit, 15 and 30 minutes are worse in both windows, 1 hour is
level and 4 hours a little better (secondary, paired). On H1 the tilt is near zero for the first hour; on M5 it peaks near 2 hours.

**Beside the spread.** In pips the mean move in the trade's direction is under the round-trip cost on 68 of 70 market x mark cells (at or over it: usdcad 120 min, usdcad 240 min, on an ASSUMED cost); the largest is usdcad at 120 min, 103 % of the cost
(gold: under 2 pips, $0.19, at a day against a $0.30 round trip). The fade is a reversal of the mid quote about the size of the
bid / ask or smaller: no time exit is positive after costs pooled in either window, and in 2015-26 none is on any market (in 2005-14 only the 4-hour exit on EUR/USD, GBP/USD and USD/CAD sits at +0.001 to +0.008R, t under 0.6). Silver loses over half its
signals to the risk-under-cost rule (its cost is assumed); the other markets lose under 4 %.
