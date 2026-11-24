# FVG return taken only with the day's volatility breakout (result)

**Verdict: FAIL. 0 of 3 tests pass; FVG returns WITH the day's breakout made -0.105R a trade after costs in 2015-26 (n 11010, month t -9.75; before costs +0.013R), AGAINST -0.108R (n 5765, t -7.54), every FVG trade -0.094R (n 37608, t -15.93).**

Run 2026-11-24 as pre-registered (`PREREGISTRATION.md`, committed and pushed alone first). Research only: nothing live changed,
nothing is proposed. One run, no variants. A before-cost tilt is not an edge.

## What was run

The FVG return (`grid7-fvg-wide` cell `1h mkt large 1R`, its own `signals`, medians from its result.json, `dom-trade-through`
`manage`) on xau, eurusd, gbpusd, usdjpy, audusd, usdcad, usdchf, OANDA mid 5-minute candles. Breakout days from the T1 studies' own
`buildDays` / `daySkip` / `vbTrade` (k 0.5, both sides; gold `gold-vol-breakout-hourcost/original.mjs`, forex
`index-vol-breakout/original.mjs`). An FVG trade whose decision (the M15 close inside the gap) came after the breakout's fill
candle closed and before 21:00 UTC is WITH when its side is the breakout's, AGAINST otherwise; CONTROL = FVG trades of no-fill days;
REST = every trade not WITH. Costs = `combo-grid-2` `COSTS` (xau 0.3, eurusd 0.00006, gbpusd 0.00008, usdjpy 0.008, audusd 0.00006, usdcad 0.00007, usdchf 0.00007; USD/CAD and
USD/CHF ASSUMED, not measured). Discovery 2005-2014 (gold from March 2006), confirmation 2015 to October 2026, month sums with empty
months as 0.

## The tests (Holm over three)

| Test | Pass | Holm p |
|---|---|---:|
| T1 WITH after costs (with the random-day placebo): random-day matched placebo beaten 6 of 40 in 2015-26 (40 of 40 in 2005-14) | no | 1.000 |
| T2 WITH minus REST after costs: +0.043R (Welch t 3.47) in 2005-14, -0.017R (t -1.45) in 2015-26 | no | 1.000 |
| T3 WITH minus AGAINST after costs: +0.054R (Welch t 3.02) in 2005-14, +0.002R (t 0.12) in 2015-26 | no | 1.000 |

Placebo draws (mean net R of the matched random-day sample): 2005-14 -0.096 to -0.053 (median -0.069); 2015-26 -0.111 to -0.068 (median -0.094).

## Pooled

| Set | n 05-14 | R before | R after | month t (after) | n 15-26 | R before (month t) | R after | month t (after) | cost R | won |
|---|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|
| WITH | 9126 | +0.053 | -0.043 | -4.27 | 11010 | +0.013 (t 1.26) | -0.105 | -9.75 | 0.118 | 50.7 % |
| AGAINST | 4740 | +0.006 | -0.098 | -6.9 | 5765 | +0.012 (t 0.83) | -0.108 | -7.54 | 0.119 | 50.7 % |
| CONTROL | 6213 | +0.092 | -0.028 | -1.95 | 7688 | +0.070 (t 6.09) | -0.057 | -4.86 | 0.127 | 53.5 % |
| REST | 23346 | +0.027 | -0.087 | -10.22 | 26598 | +0.038 (t 5.8) | -0.089 | -13.59 | 0.127 | 51.9 % |
| ALL | 32472 | +0.034 | -0.075 | -10.62 | 37608 | +0.030 (t 5.43) | -0.094 | -15.93 | 0.124 | 51.5 % |

## Per market

### xau

Breakout days 3850, no-fill days 1452; cell signals 9145; risk under cost 139, stop on the wrong side 12, still open 0, excluded 1.

| Set | n 05-14 | R before | R after | month t (after) | n 15-26 | R before (month t) | R after | month t (after) | cost R | won |
|---|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|
| WITH | 1005 | +0.103 | -0.087 | -2.76 | 1473 | +0.056 (t 2.29) | -0.108 | -3.99 | 0.164 | 53.1 % |
| AGAINST | 521 | +0.076 | -0.131 | -2.8 | 762 | -0.039 (t -1.11) | -0.205 | -5.67 | 0.166 | 48.2 % |
| CONTROL | 919 | +0.036 | -0.196 | -5.14 | 1111 | +0.038 (t 1.23) | -0.138 | -4.18 | 0.176 | 51.9 % |
| ALL | 3995 | +0.055 | -0.161 | -8.43 | 4998 | +0.038 (t 2.63) | -0.135 | -8.48 | 0.173 | 52.0 % |

### eurusd

Breakout days 4231, no-fill days 1426; cell signals 9965; risk under cost 10, stop on the wrong side 9, still open 1, excluded 3.

| Set | n 05-14 | R before | R after | month t (after) | n 15-26 | R before (month t) | R after | month t (after) | cost R | won |
|---|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|
| WITH | 1334 | +0.040 | -0.024 | -0.89 | 1466 | +0.048 (t 1.8) | -0.051 | -1.83 | 0.099 | 52.5 % |
| AGAINST | 722 | +0.016 | -0.052 | -1.34 | 737 | +0.009 (t 0.27) | -0.089 | -2.72 | 0.098 | 51.0 % |
| CONTROL | 852 | +0.138 | +0.066 | 2.01 | 1091 | +0.110 (t 3.71) | +0.002 | 0.07 | 0.107 | 55.5 % |
| ALL | 4717 | +0.030 | -0.041 | -2.69 | 5225 | +0.045 (t 3.66) | -0.061 | -4.69 | 0.105 | 52.4 % |

### gbpusd

Breakout days 4254, no-fill days 1404; cell signals 10060; risk under cost 12, stop on the wrong side 5, still open 1, excluded 5.

| Set | n 05-14 | R before | R after | month t (after) | n 15-26 | R before (month t) | R after | month t (after) | cost R | won |
|---|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|
| WITH | 1333 | +0.072 | +0.002 | 0.08 | 1519 | +0.023 (t 0.91) | -0.076 | -3.09 | 0.099 | 50.9 % |
| AGAINST | 707 | -0.091 | -0.167 | -4.37 | 798 | -0.026 (t -0.82) | -0.125 | -3.81 | 0.099 | 48.5 % |
| CONTROL | 907 | +0.084 | -0.006 | -0.16 | 1073 | +0.052 (t 1.78) | -0.055 | -1.83 | 0.107 | 52.6 % |
| ALL | 4718 | +0.025 | -0.057 | -3.74 | 5319 | +0.013 (t 1.07) | -0.091 | -7.02 | 0.105 | 50.5 % |

### usdjpy

Breakout days 4157, no-fill days 1499; cell signals 10173; risk under cost 33, stop on the wrong side 6, still open 1, excluded 5.

| Set | n 05-14 | R before | R after | month t (after) | n 15-26 | R before (month t) | R after | month t (after) | cost R | won |
|---|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|
| WITH | 1402 | +0.042 | -0.070 | -2.7 | 1622 | +0.020 (t 0.79) | -0.092 | -3.56 | 0.113 | 51.4 % |
| AGAINST | 714 | -0.061 | -0.178 | -4.71 | 877 | +0.040 (t 1.16) | -0.078 | -2.24 | 0.118 | 52.2 % |
| CONTROL | 897 | +0.086 | -0.043 | -1.14 | 1101 | +0.069 (t 2.55) | -0.051 | -1.85 | 0.121 | 53.4 % |
| ALL | 4672 | +0.024 | -0.097 | -6.07 | 5456 | +0.033 (t 2.4) | -0.085 | -5.99 | 0.118 | 51.8 % |

### audusd

Breakout days 4255, no-fill days 1397; cell signals 11130; risk under cost 16, stop on the wrong side 8, still open 0, excluded 6.

| Set | n 05-14 | R before | R after | month t (after) | n 15-26 | R before (month t) | R after | month t (after) | cost R | won |
|---|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|
| WITH | 1460 | +0.071 | -0.005 | -0.18 | 1861 | -0.030 (t -1.21) | -0.145 | -5.7 | 0.115 | 48.6 % |
| AGAINST | 787 | +0.026 | -0.060 | -1.74 | 1010 | +0.016 (t 0.54) | -0.102 | -3.46 | 0.118 | 50.7 % |
| CONTROL | 882 | +0.078 | -0.008 | -0.28 | 1220 | +0.060 (t 2.3) | -0.057 | -2.09 | 0.117 | 53.1 % |
| ALL | 5078 | +0.038 | -0.045 | -2.79 | 6022 | +0.023 (t 1.79) | -0.095 | -7.4 | 0.118 | 51.2 % |

### usdcad (cost ASSUMED)

Breakout days 4238, no-fill days 1417; cell signals 10156; risk under cost 24, stop on the wrong side 8, still open 1, excluded 9.

| Set | n 05-14 | R before | R after | month t (after) | n 15-26 | R before (month t) | R after | month t (after) | cost R | won |
|---|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|
| WITH | 1259 | +0.029 | -0.071 | -2.54 | 1525 | -0.008 (t -0.3) | -0.120 | -4.43 | 0.113 | 49.4 % |
| AGAINST | 614 | +0.093 | -0.016 | -0.44 | 822 | +0.049 (t 1.32) | -0.054 | -1.46 | 0.103 | 52.2 % |
| CONTROL | 878 | +0.111 | -0.005 | -0.16 | 1131 | +0.094 (t 3.27) | -0.025 | -0.85 | 0.119 | 54.6 % |
| ALL | 4675 | +0.033 | -0.077 | -4.87 | 5439 | +0.034 (t 2.41) | -0.081 | -5.51 | 0.115 | 51.6 % |

### usdchf (cost ASSUMED)

Breakout days 4252, no-fill days 1404; cell signals 9823; risk under cost 38, stop on the wrong side 9, still open 1, excluded 9.

| Set | n 05-14 | R before | R after | month t (after) | n 15-26 | R before (month t) | R after | month t (after) | cost R | won |
|---|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|
| WITH | 1333 | +0.027 | -0.063 | -2.3 | 1544 | -0.007 (t -0.28) | -0.136 | -5.23 | 0.130 | 49.6 % |
| AGAINST | 675 | +0.009 | -0.082 | -2.02 | 759 | +0.025 (t 0.65) | -0.108 | -2.73 | 0.134 | 51.8 % |
| CONTROL | 878 | +0.116 | +0.009 | 0.25 | 961 | +0.069 (t 2.18) | -0.078 | -2.42 | 0.146 | 53.6 % |
| ALL | 4617 | +0.037 | -0.059 | -3.97 | 5149 | +0.028 (t 2.19) | -0.111 | -8.23 | 0.139 | 51.5 % |

## No look-ahead

Cut test (signals, their set and the day labels known at a cut date, computed on candles cut there, against the full run): xau 2008-06-11: 1117 signals, missing 0, extra 0, day labels differing 0; xau 2012-03-14: 2893 signals, missing 0, extra 0, day labels differing 0; xau 2016-09-21: 4815 signals, missing 0, extra 0, day labels differing 0; xau 2021-02-17: 6606 signals, missing 0, extra 0, day labels differing 0; xau 2025-05-07: 8434 signals, missing 0, extra 0, day labels differing 0; usdjpy 2008-06-11: 1599 signals, missing 0, extra 0, day labels differing 0; usdjpy 2012-03-14: 3361 signals, missing 0, extra 0, day labels differing 0; usdjpy 2016-09-21: 5499 signals, missing 0, extra 0, day labels differing 0; usdjpy 2021-02-17: 7536 signals, missing 0, extra 0, day labels differing 0; usdjpy 2025-05-07: 9452 signals, missing 0, extra 0, day labels differing 0.

## Reading

Taking the FVG return only with the day's breakout does not make it pay: WITH loses after costs in both windows
(-0.043R / -0.105R a trade). Its edge over the rest in 2005-14 (+0.043R, Welch t
3.47) did not repeat in 2015-26 (-0.017R, t -1.45), and WITH and AGAINST are equal in 2015-26. As in
`vb-pullback-fade`, the least bad set is the quiet no-fill days (CONTROL +0.070R before costs,
-0.057R after, 2015-26): the breakout direction picks no better FVG trades. Reported, not a rule.

## Caveats

- WITH is a subset of the plain FVG desk rule; its trades overlap freely (as the parent), and trades of one day are not
  independent, so the Welch t on trades overstates; the month-sum t of T1 carries the overlap.
- The breakout is only a label here: its forex years were read by earlier studies; on forex outside USD/JPY it did not pass.
- Costs are today's demo figures charged on every year (USD/CAD, USD/CHF assumed); a 1R target leaves little room for them.
