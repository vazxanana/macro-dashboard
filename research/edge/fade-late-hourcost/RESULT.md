# The late-hour M15 fade at the broker's hourly spreads (result)

**Verdict: FAIL. At the broker's hourly spreads the 20 and 23 UTC fade made -0.071R a trade pooled (n 3179, month t -2.65); gold -0.013R (t -0.29), USD/JPY -0.116R (t -3.41).**

Run 24 Nov 2026 as pre-registered (`PREREGISTRATION.md`, committed and pushed alone first). Paper research only: nothing live
changed, no rule is proposed. These years and hours were already read by `fade-conditions` and `fade-hour-check` (which chose the
hours): this is cost accounting on a selection already made, and a PASS would only be a hypothesis for a forward paper record.

## What was run

`grid7-wide-fade` cell `m15 none atr 2R all` by its own code (imported): fade the first M15 structure break at the next 5-minute
open, stop 1 x ATR(14) of M15 on the losing side, target 2R, out after a day; OANDA mid 5-minute candles. Kept: fills at
20:00-20:59 or 23:00-23:59 UTC. Cost a trade: half the measured spread of the entry hour and of the exit hour, the broker's
commission (gold 0.000024, USD/JPY 0.000045 of price a round trip), and on a stop exit another half spread of the exit hour.
Spreads: the median (ask - bid) / mid by UTC hour of the demo broker's quotes at this rule's own fills and exits (council-data 3e30f22b6aa52d26ee3b913ba14a9bb15d7eca98: research/probe/ticks-<SYM>-fade-*.json marks (fade-tick-exec)).

## Gate

- xau: 35,212 trades 2005-26; `fade-hour-check`'s own loop on the same candles 35,212 (the same trades); its stored result 35,212; 0 differ from `exits()`: passed.
- usdjpy: 38,596 trades 2005-26; `fade-hour-check`'s own loop on the same candles 38,596 (the same trades); its stored result 38,598; 0 differ from `exits()`: passed.
- Deviation from the pre-registration: it asked for the stored counts (35,212 / 38,598). The candle cache has changed since that
  run by 2 USD/JPY trades of 2005-26 (the loop is the same code), so the gate compares with
  `fade-hour-check`'s own loop run on today's candles and allows the stored count within 5 trades.
- Hours with fewer than 20 marks: none.

## Tests (after measured costs)

| Test | n | R a trade (month t) | before costs (t) | cost R | 2015-19 | 2020-26 | Holm p | Holds |
|---|---:|---:|---:|---:|---:|---:|---:|---|
| Gold | 1,389 | -0.013 (-0.29) | +0.063 (1.45) | 0.076 | +0.007 (n 579) | -0.027 (n 810) | 1.000 | no |
| USD/JPY | 1,790 | -0.116 (-3.41) | +0.090 (2.64) | 0.206 | -0.121 (n 689) | -0.113 (n 1,101) | 1.000 | no |
| Pooled | 3,179 | -0.071 (-2.65) | +0.078 (2.88) | 0.149 | -0.062 (n 1,268) | -0.077 (n 1,911) | 1.000 | no |

Month-sum t on calendar months 2015-01 to 2026-10 (empty months 0). Holds = n >= 300, mean > 0, t >= 2, both windows > 0, Holm p < 0.05.

## By entry hour (2015-26, after costs)

| Market | hour | n | R (t) | before costs | cost R |
|---|---:|---:|---:|---:|---:|
| Gold | 20 | 562 | +0.043 (0.55) | +0.106 | 0.063 |
| Gold | 23 | 827 | -0.051 (-1.09) | +0.034 | 0.084 |
| USD/JPY | 20 | 634 | -0.071 (-0.94) | +0.261 | 0.332 |
| USD/JPY | 23 | 1,156 | -0.141 (-3.81) | -0.004 | 0.137 |

## Exits (2015-26)

| Market | n | stop | target | time | exit inside 21:00-22:59 |
|---|---:|---:|---:|---:|---:|
| Gold | 1,389 | 861 | 484 | 44 | 147 |
| USD/JPY | 1,790 | 1,132 | 621 | 37 | 265 |

## Sensitivity (reported, not judged)

| Row | market | n | R (month t) | 2015-19 | 2020-26 |
|---|---|---:|---:|---:|---:|
| 90th percentile spread of each hour | Gold | 1,389 | -0.131 (-2.91) | -0.114 | -0.143 |
| 90th percentile spread of each hour | USD/JPY | 1,790 | -0.330 (-8.83) | -0.317 | -0.339 |
| 90th percentile spread of each hour | Pooled | 3,179 | -0.243 (-8.61) | -0.224 | -0.256 |
| commission 0.000024 a side on gold | Gold | 1,389 | -0.042 (-0.97) | -0.023 | -0.056 |
| commission 0.000024 a side on gold | USD/JPY | 1,790 | -0.116 (-3.41) | -0.121 | -0.113 |
| commission 0.000024 a side on gold | Pooled | 3,179 | -0.084 (-3.14) | -0.076 | -0.089 |
| gold: hourProfile (first two minutes of each hour) instead of the marks | Gold | 1,389 | -0.005 (-0.11) | +0.016 | -0.019 |
| gold: hourProfile (first two minutes of each hour) instead of the marks | USD/JPY | 1,790 | -0.116 (-3.41) | -0.121 | -0.113 |
| gold: hourProfile (first two minutes of each hour) instead of the marks | Pooled | 3,179 | -0.068 (-2.53) | -0.059 | -0.073 |
| fade-hour-check hours (break at 20 or 23, fill outside 21-22) | Gold | 1,293 | -0.017 (-0.39) | -0.016 | -0.018 |
| fade-hour-check hours (break at 20 or 23, fill outside 21-22) | USD/JPY | 1,797 | -0.133 (-4.01) | -0.154 | -0.120 |
| fade-hour-check hours (break at 20 or 23, fill outside 21-22) | Pooled | 3,090 | -0.085 (-3.27) | -0.093 | -0.079 |
| no cost at all (mid, before costs) | Gold | 1,389 | +0.063 (1.45) | +0.086 | +0.047 |
| no cost at all (mid, before costs) | USD/JPY | 1,790 | +0.090 (2.64) | +0.069 | +0.104 |
| no cost at all (mid, before costs) | Pooled | 3,179 | +0.078 (2.88) | +0.076 | +0.080 |

## Measured spread by UTC hour (median, share of price x 10^5; n marks)

| Hour | gold | n | USD/JPY | n |
|---:|---:|---:|---:|---:|
| 00 | 2.74 | 125 | 0.00 | 141 |
| 01 | 3.04 | 128 | 0.00 | 96 |
| 02 | 2.55 | 57 | 0.00 | 59 |
| 03 | 2.97 | 66 | 0.00 | 57 |
| 04 | 2.72 | 88 | 0.00 | 76 |
| 05 | 2.78 | 140 | 0.00 | 74 |
| 06 | 2.57 | 106 | 0.00 | 107 |
| 07 | 2.56 | 83 | 0.00 | 135 |
| 08 | 1.74 | 85 | 0.00 | 71 |
| 09 | 2.22 | 73 | 0.00 | 80 |
| 10 | 2.52 | 95 | 0.00 | 53 |
| 11 | 1.99 | 80 | 0.00 | 88 |
| 12 | 2.54 | 144 | 0.00 | 144 |
| 13 | 2.40 | 162 | 0.00 | 110 |
| 14 | 2.13 | 107 | 0.00 | 95 |
| 15 | 2.33 | 79 | 0.00 | 84 |
| 16 | 1.68 | 57 | 0.00 | 76 |
| 17 | 1.90 | 55 | 0.00 | 58 |
| 18 | 1.99 | 46 | 0.00 | 66 |
| 19 | 1.65 | 79 | 0.00 | 89 |
| 20 | 2.91 | 70 | 0.67 | 83 |
| 21 | 3.63 | 26 | 45.99 | 80 |
| 22 | 2.61 | 159 | 3.09 | 123 |
| 23 | 2.81 | 134 | 0.67 | 117 |

## Limits

- The spreads were measured on 2023-26 quotes and applied to 2015-26 as a share of price: the relative spread of earlier years is
  not known. The marks sit at this rule's own fills and exits (any hour), not a fixed minute of the hour.
- OANDA mid candles, not fills: `fade-tick-exec` found real fills about 0.02R a trade worse than mid before commission on these
  two markets; that is on top of the spread charged here only in part.
- USD/JPY on this raw-spread account is quoted bid = ask most of the time, so its median spread is 0 in most hours; its cost here
  is mostly the commission and the rollover hours 21-22 UTC, where exits land (see the exit table).

## What it means

Before costs the late-hour fade is positive on both markets (pooled +0.078R a trade, month t 2.88), as `fade-hour-check` found.
At the broker's own spread and commission for those hours it is not: gold is about zero (-0.013R, t -0.29) and USD/JPY loses
(-0.116R, t -3.41), the same in 2015-19 and 2020-26. On USD/JPY the 2R target is a few pips, so the commission alone is about
a tenth of R, and exits that run into the rollover pay its wide spread. Every sensitivity row is negative after costs. The
question is closed for these two markets: no other hour, stop or target is tried on these years. Never call this an edge.
Nothing live changed.
