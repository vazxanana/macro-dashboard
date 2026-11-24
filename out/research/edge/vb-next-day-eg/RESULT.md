# The day after a winning volatility breakout: the first pullback into a fresh H1 engulf zone (result)

**Verdict: FAIL. 0 of 10 cells pass; best usdjpy 1R: -0.082R a trade after costs in 2015-26 (n 980, month t -2.42; before costs -0.011R), discovery -0.052R (n 855, t -1.50).**

Run 2026-11-24 as pre-registered (`PREREGISTRATION.md`, committed alone first). Research only: nothing live changed, nothing
is proposed. One run, no variants. A before-cost tilt is not an edge.

## What was run

Gold, USD/JPY, EUR/USD and GBP/USD, OANDA mid 5-minute candles. Day D = the T1 breakout (k 0.5, both sides, the T1 studies' own
`buildDays` / `daySkip` / `vbTrade`) filled and ended above zero before costs. On the next tradable weekday, 00:00 to 21:00
UTC: the first 5-minute candle that trades into an H1 engulf zone of the breakout's side (`council/eg-methods.mjs` `zones`)
formed since the breakout's fill and not traded into before that day. Limit at the zone's near edge, stop past the far edge by
0.1 x the H1 ATR(14), target 1R or 2R, else out at 21:00 UTC; one trade a day. Costs a round trip: gold $0.30, USD/JPY 0.008
(the desk's demo figures), EUR/USD 0.00006, GBP/USD 0.00008 (the shared figures). Discovery = fills 2005-2014 (gold from 2006),
confirmation = 2015 to October 2026; t of calendar-month sums with empty months as 0; Holm over the ten confirmation tests.

## Every cell (after a WINNING breakout day: the judged set)

| Cell | n 05-14 | R before costs | R after | month t (after) | n 15-26 | R before costs (month t) | R after | month t (after) | cost R | won | Holm p | pass |
|---|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|---|
| xau 1R | 725 | +0.044 | -0.115 | -2.76 | 947 | -0.020 (t -0.61) | -0.134 | -3.94 | 0.114 | 49.1 % | 1.000 | no |
| xau 2R | 725 | +0.015 | -0.143 | -2.50 | 947 | -0.039 (t -0.87) | -0.153 | -3.35 | 0.114 | 33.5 % | 1.000 | no |
| usdjpy 1R | 855 | +0.016 | -0.052 | -1.50 | 980 | -0.011 (t -0.34) | -0.082 | -2.42 | 0.070 | 49.2 % | 1.000 | no |
| usdjpy 2R | 855 | +0.077 | +0.010 | +0.20 | 980 | -0.032 (t -0.76) | -0.102 | -2.41 | 0.070 | 34.4 % | 1.000 | no |
| eurusd 1R | 859 | -0.015 | -0.063 | -2.00 | 949 | -0.046 (t -1.46) | -0.117 | -3.70 | 0.071 | 47.8 % | 1.000 | no |
| eurusd 2R | 859 | -0.051 | -0.099 | -2.21 | 949 | -0.072 (t -1.61) | -0.144 | -3.17 | 0.071 | 32.6 % | 1.000 | no |
| gbpusd 1R | 840 | -0.037 | -0.091 | -2.53 | 984 | -0.060 (t -1.82) | -0.133 | -3.97 | 0.072 | 46.6 % | 1.000 | no |
| gbpusd 2R | 840 | -0.036 | -0.090 | -1.83 | 984 | -0.021 (t -0.48) | -0.093 | -2.12 | 0.072 | 33.7 % | 1.000 | no |
| pooled 1R | 3279 | +0.000 | -0.079 | -4.42 | 3860 | -0.034 (t -1.94) | -0.116 | -6.41 | 0.082 | 48.2 % | 1.000 | no |
| pooled 2R | 3279 | +0.001 | -0.078 | -3.09 | 3860 | -0.041 (t -1.72) | -0.123 | -5.13 | 0.082 | 33.5 % | 1.000 | no |

Cells with n >= 300 in both windows: 10 of 10. Positive after costs in both windows: 0.

## Control (reported, not judged): the same rule the day after a breakout that did NOT end in profit

| Cell | n 05-14 | R before costs | R after | month t (after) | n 15-26 | R before costs (month t) | R after | month t (after) | cost R | won | Holm p | pass |
|---|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|---|
| xau 1R | 834 | -0.073 | -0.238 | -5.91 | 1185 | -0.009 (t -0.29) | -0.128 | -4.14 | 0.119 | 49.3 % | 1.000 | no |
| xau 2R | 834 | -0.066 | -0.231 | -4.61 | 1185 | +0.029 (t +0.71) | -0.090 | -2.20 | 0.119 | 35.6 % | 1.000 | no |
| usdjpy 1R | 962 | -0.033 | -0.103 | -3.52 | 1189 | +0.027 (t +0.91) | -0.044 | -1.49 | 0.071 | 51.6 % | 1.000 | no |
| usdjpy 2R | 962 | -0.008 | -0.079 | -2.11 | 1189 | +0.043 (t +1.01) | -0.028 | -0.65 | 0.071 | 37.0 % | 1.000 | no |
| eurusd 1R | 1012 | +0.001 | -0.049 | -1.73 | 1265 | -0.027 (t -1.07) | -0.100 | -4.02 | 0.073 | 48.9 % | 1.000 | no |
| eurusd 2R | 1012 | -0.049 | -0.099 | -2.27 | 1265 | -0.069 (t -1.94) | -0.142 | -4.02 | 0.073 | 32.4 % | 1.000 | no |
| gbpusd 1R | 1025 | -0.021 | -0.076 | -2.48 | 1230 | -0.035 (t -1.15) | -0.109 | -3.58 | 0.074 | 48.1 % | 1.000 | no |
| gbpusd 2R | 1025 | -0.036 | -0.091 | -2.08 | 1230 | -0.036 (t -0.90) | -0.110 | -2.76 | 0.074 | 33.5 % | 1.000 | no |
| pooled 1R | 3833 | -0.029 | -0.111 | -7.41 | 4869 | -0.011 (t -0.85) | -0.095 | -7.04 | 0.084 | 49.5 % | 1.000 | no |
| pooled 2R | 3833 | -0.039 | -0.120 | -5.74 | 4869 | -0.009 (t -0.48) | -0.093 | -4.82 | 0.084 | 34.6 % | 1.000 | no |

## The funnel

| Market | breakout days | winning | with a next day | with a candidate zone | fills | refused (stop side, risk under cost) | losing days (control) | control fills | dropped (bad data) |
|---|---:|---:|---:|---:|---:|---:|---:|---:|---:|
| xau | 3850 | 1728 | 1724 | 1720 | 1672 | 0 | 2122 | 2019 | 0 |
| usdjpy | 4157 | 1897 | 1897 | 1891 | 1839 | 0 | 2260 | 2151 | 4 |
| eurusd | 4231 | 1862 | 1862 | 1855 | 1810 | 1 | 2369 | 2279 | 4 |
| gbpusd | 4254 | 1881 | 1881 | 1879 | 1827 | 0 | 2373 | 2259 | 7 |

Fills count every year on file; the cells count fills from 2005-01 to 2026-10 outside the bad-data intervals.

## Cut test

The trades known at three dates, computed on candles cut there, equal the full run's on every market: xau 2009-06-10 n 578 (0 missing, 0 extra); xau 2015-03-11 n 1598 (0 missing, 0 extra); xau 2021-09-22 n 2750 (0 missing, 0 extra); usdjpy 2009-06-10 n 821 (0 missing, 0 extra); usdjpy 2015-03-11 n 1851 (0 missing, 0 extra); usdjpy 2021-09-22 n 3053 (0 missing, 0 extra); eurusd 2009-06-10 n 809 (0 missing, 0 extra); eurusd 2015-03-11 n 1910 (0 missing, 0 extra); eurusd 2021-09-22 n 3136 (0 missing, 0 extra); gbpusd 2009-06-10 n 831 (0 missing, 0 extra); gbpusd 2015-03-11 n 1897 (0 missing, 0 extra); gbpusd 2021-09-22 n 3128 (0 missing, 0 extra).

## Reading

No cell clears the bar. The day after a winning breakout does not continue from an H1 engulf zone in a way that survives costs and the month-sum test in both windows.
Limits: a limit order is assumed filled when a mid candle touches its price; the same cost is charged for every year; the control
shows whether "the breakout won" adds anything over "a breakout filled". Never call any cell an edge.
