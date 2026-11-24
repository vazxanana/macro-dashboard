# The FVG return at the demo broker's measured hourly spreads (result)

**Verdict: FAIL. At measured costs the pooled FVG return (xau, xag, usdjpy) made -0.047R a trade in 2005-14 (n 11994, month t -4.34) and -0.060R in 2015-26 (n 14248, t -6.72; +0.045R before costs).**

Run 24 Nov 2026 as pre-registered (`PREREGISTRATION.md`, committed and pushed alone first). Research only: nothing live
changed, no rule is proposed. One run, no variants. These years were already read by `grid7-fvg-wide`, which chose the cell:
this is cost accounting on a selection already made. A before-cost tilt is not an edge.

## What was run

`grid7-fvg-wide` cell `1h mkt large 1R` by its own code (imported): an H1 three-candle gap larger than the market's 2005-14
median gap / ATR (the medians stored in its result.json), market entry at the next 5-minute open after the first M15 close
inside the gap, stop past the far side + 0.1 ATR, target 1R, out after 2 days; OANDA mid 5-minute candles. Cost a trade: half
the measured spread of the entry hour and of the exit hour, the broker's commission, and on a stop exit another half spread.
Measured profiles: xau = council-data 0459ec37e2 research/probe/ticks-XAUUSD.json hourProfile (at 2026-11-20T00:58:29.569Z); xag = council-data 19c2477d5b research/probe/ticks-XAGUSD.json hourProfile (at 2026-11-20T01:39:04.457Z); usdjpy = fade-late-hourcost/profile.json (council-data 3e30f22b6aa52d26ee3b913ba14a9bb15d7eca98: research/probe/ticks-<SYM>-fade-*.json marks (fade-tick-exec)). Commission: council-data 853060f780536f829f4e3f52ff201e9e81702185 ctrader/symbols.json.

Markets with a measured hourly profile: **xau, xag** (`hourProfile`), **usdjpy** (a profile built from the broker's own
quotes by `fade-late-hourcost`). No hourly profile: eurusd, gbpusd, audusd, nzdusd, usdcad, usdchf, eurjpy (reported apart, not judged).

## Gate (before costs, against grid7's perMarket figures of the cell)

| Market | n 05-14 (grid7) | R 05-14 (grid7) | n 15-26 (grid7) | R 15-26 (grid7) | walk mismatches | ok |
|---|---:|---:|---:|---:|---:|---|
| xau | 3,995 (3,995) | +0.055 (+0.055) | 4,998 (4,997) | +0.038 (+0.037) | 0 | yes |
| xag | 3,327 (3,327) | +0.075 (+0.075) | 3,794 (3,794) | +0.072 (+0.072) | 0 | yes |
| eurusd | 4,717 (4,725) | +0.030 (+0.029) | 5,225 (5,225) | +0.045 (+0.045) | 0 | yes |
| gbpusd | 4,718 (4,725) | +0.025 (+0.024) | 5,319 (5,319) | +0.013 (+0.013) | 0 | yes |
| usdjpy | 4,672 (4,679) | +0.024 (+0.024) | 5,456 (5,456) | +0.033 (+0.033) | 0 | yes |
| audusd | 5,078 (5,086) | +0.038 (+0.038) | 6,022 (6,019) | +0.023 (+0.023) | 0 | yes |
| nzdusd | 4,758 (4,767) | +0.052 (+0.052) | 5,847 (5,847) | +0.041 (+0.041) | 0 | yes |
| usdcad | 4,675 (4,686) | +0.032 (+0.032) | 5,439 (5,440) | +0.034 (+0.034) | 0 | yes |
| usdchf | 4,617 (4,629) | +0.037 (+0.036) | 5,149 (5,149) | +0.028 (+0.028) | 0 | yes |
| eurjpy | 4,652 (4,659) | +0.065 (+0.065) | 5,413 (5,413) | +0.034 (+0.034) | 0 | yes |

## Tests (after measured costs; Holm over four)

| Test | n 05-14 | net 05-14 (t) | n 15-26 | before costs 15-26 (t) | cost R | net 15-26 (t) | 2x cost 15-26 | control net 15-26 | vs control | Holm p | Pass |
|---|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|---|
| T1 pooled (xau, xag, usdjpy) | 11,994 | -0.047 (-4.34) | 14,248 | +0.045 | 0.105 | -0.060 (-6.72) | -0.165 | -0.109 | 3.98 | 1.000 | no |
| T2 gold | 3,995 | +0.015 (0.91) | 4,998 | +0.038 | 0.048 | -0.010 (-0.69) | -0.058 | -0.058 | 2.35 | 1.000 | no |
| T3 silver | 3,327 | -0.085 (-3.76) | 3,794 | +0.072 | 0.176 | -0.104 (-5.91) | -0.280 | -0.173 | 2.86 | 1.000 | no |
| T4 USD/JPY | 4,672 | -0.073 (-4.7) | 5,456 | +0.033 | 0.108 | -0.075 (-5.23) | -0.183 | -0.110 | 1.75 | 1.000 | no |

Month-sum t on calendar months (2005-01 to 2014-12, 2015-01 to 2026-10; empty months 0). Pass = n >= 200 in each window,
net > 0 in both windows, month t >= 2 in 2015-26 with Holm p < 0.05, net >= 0 at 2x cost, Welch t >= 2 against the random-band control.

## Sensitivity (reported, not judged)

| Row | test | n 15-26 | net 05-14 (t) | net 15-26 (t) |
|---|---|---:|---:|---:|
| 90th percentile spread of each hour | pool | 14,248 | -0.101 (-8.77) | -0.117 (-11.72) |
| 90th percentile spread of each hour | xau | 4,998 | +0.010 (0.62) | -0.016 (-1.08) |
| 90th percentile spread of each hour | xag | 3,794 | -0.122 (-5.21) | -0.144 (-7.86) |
| 90th percentile spread of each hour | usdjpy | 5,456 | -0.181 (-10.47) | -0.192 (-11.11) |
| gold: the fade marks profile instead of hourProfile | pool | 14,248 | -0.048 (-4.41) | -0.061 (-6.84) |
| gold: the fade marks profile instead of hourProfile | xau | 4,998 | +0.013 (0.76) | -0.013 (-0.89) |
| gold: the fade marks profile instead of hourProfile | xag | 3,794 | -0.085 (-3.76) | -0.104 (-5.91) |
| gold: the fade marks profile instead of hourProfile | usdjpy | 5,456 | -0.073 (-4.7) | -0.075 (-5.23) |
| no cost (mid, before costs) | pool | 14,248 | +0.049 (4.7) | +0.045 (5.57) |
| no cost (mid, before costs) | xau | 4,998 | +0.055 (3.27) | +0.038 (2.63) |
| no cost (mid, before costs) | xag | 3,794 | +0.075 (3.55) | +0.072 (4.44) |
| no cost (mid, before costs) | usdjpy | 5,456 | +0.024 (1.61) | +0.033 (2.4) |

## Markets without a measured hourly profile (reported apart, not judged)

Two costs: the grid's ASSUMED round trip (`combo-grid-2` `COSTS`), and the commission plus 1.5 x the council's measured typical spread
(`spreadTypical.median`, not by hour; 0 on most majors: the raw-spread account) as a lower bound.

| Market | n 15-26 | before costs 15-26 | assumed: net 05-14 / 15-26 (t) | commission only: net 05-14 / 15-26 (t) |
|---|---:|---:|---:|---:|
| eurusd | 5,225 | +0.045 | -0.041 / -0.061 (-4.69) | -0.041 / -0.044 (-3.46) |
| gbpusd | 5,319 | +0.013 | -0.057 / -0.091 (-7.02) | -0.053 / -0.064 (-5.03) |
| audusd | 6,022 | +0.023 | -0.045 / -0.095 (-7.4) | -0.017 / -0.040 (-3.11) |
| nzdusd | 5,847 | +0.041 | -0.049 / -0.104 (-7.43) | +0.003 / -0.019 (-1.45) |
| usdcad | 5,439 | +0.034 | -0.077 / -0.081 (-5.51) | -0.043 / -0.064 (-4.41) |
| usdchf | 5,149 | +0.028 | -0.059 / -0.111 (-8.23) | -0.027 / -0.054 (-4.15) |
| eurjpy | 5,413 | +0.034 | -0.031 / -0.086 (-6.01) | -0.006 / -0.059 (-4.2) |

## Exits and stop size (2005-26)

| Market | n | stop | target | time | median stop as a share of price |
|---|---:|---:|---:|---:|---:|
| xau | 8,993 | 4,205 | 4,599 | 189 | 0.147 % |
| xag | 7,121 | 3,222 | 3,704 | 195 | 0.349 % |
| usdjpy | 10,128 | 4,823 | 5,115 | 190 | 0.082 % |

## Year by year (after measured costs; n, net R a trade, month t)

| Year | xau | xag | usdjpy |
|---|---:|---:|---:|
| 2005 |  |  | 470, -0.041 (-1.01) |
| 2006 | 390, -0.004 (-0.05) | 332, -0.096 (-1.33) | 464, -0.052 (-1.27) |
| 2007 | 427, -0.035 (-0.96) | 240, +0.010 (0.16) | 448, -0.119 (-2.36) |
| 2008 | 486, +0.044 (1.35) | 393, -0.044 (-0.74) | 470, -0.049 (-0.88) |
| 2009 | 469, +0.067 (1.96) | 393, -0.023 (-0.47) | 475, -0.041 (-0.78) |
| 2010 | 443, +0.048 (0.88) | 412, -0.131 (-2.11) | 477, -0.089 (-2.02) |
| 2011 | 484, +0.010 (0.15) | 462, +0.009 (0.1) | 449, -0.130 (-2.68) |
| 2012 | 446, -0.019 (-0.34) | 436, -0.247 (-5.78) | 478, -0.094 (-1.64) |
| 2013 | 429, +0.022 (0.44) | 378, -0.091 (-1.78) | 486, -0.068 (-1.18) |
| 2014 | 421, -0.005 (-0.1) | 281, -0.130 (-1.95) | 455, -0.046 (-0.97) |
| 2015 | 408, -0.005 (-0.1) | 269, -0.071 (-1.45) | 476, -0.115 (-2.66) |
| 2016 | 402, +0.047 (0.81) | 277, -0.135 (-2.25) | 428, +0.002 (0.03) |
| 2017 | 361, +0.025 (0.44) | 204, -0.149 (-2.01) | 487, +0.030 (0.63) |
| 2018 | 377, -0.053 (-0.8) | 200, -0.237 (-3.19) | 470, -0.005 (-0.17) |
| 2019 | 485, -0.032 (-0.7) | 202, -0.078 (-3.04) | 457, -0.038 (-0.93) |
| 2020 | 370, -0.048 (-0.86) | 329, +0.014 (0.2) | 445, -0.118 (-3.1) |
| 2021 | 420, -0.020 (-0.49) | 349, -0.087 (-1.57) | 474, -0.119 (-2.56) |
| 2022 | 426, +0.055 (1.22) | 443, -0.166 (-3.41) | 424, -0.062 (-1.09) |
| 2023 | 434, -0.040 (-0.77) | 360, -0.182 (-4.49) | 461, -0.104 (-1.94) |
| 2024 | 457, -0.057 (-1.68) | 402, -0.058 (-0.9) | 427, -0.083 (-1.28) |
| 2025 | 462, -0.086 (-1.73) | 393, -0.183 (-3.31) | 531, -0.182 (-5.56) |
| 2026 | 396, +0.114 (2.64) | 366, +0.037 (0.64) | 376, -0.091 (-1.45) |

## Measured spread by UTC hour (median, share of price x 10^5)

| Hour | xau | xag | usdjpy |
|---:|---:|---:|---:|
| 00 | 2.41 (n 44) | 42.39 (n 44) | 0.00 (n 141) |
| 01 | 2.60 (n 44) | 49.22 (n 44) | 0.00 (n 96) |
| 02 | 2.05 (n 44) | 42.58 (n 44) | 0.00 (n 59) |
| 03 | 1.70 (n 44) | 41.02 (n 44) | 0.00 (n 57) |
| 04 | 1.96 (n 44) | 38.99 (n 44) | 0.00 (n 76) |
| 05 | 2.20 (n 44) | 40.21 (n 44) | 0.00 (n 74) |
| 06 | 1.85 (n 44) | 40.75 (n 44) | 0.00 (n 107) |
| 07 | 2.31 (n 44) | 39.58 (n 44) | 0.00 (n 135) |
| 08 | 2.41 (n 44) | 40.38 (n 44) | 0.00 (n 71) |
| 09 | 1.90 (n 44) | 39.57 (n 44) | 0.00 (n 80) |
| 10 | 1.91 (n 44) | 38.66 (n 44) | 0.00 (n 53) |
| 11 | 1.76 (n 44) | 39.58 (n 44) | 0.00 (n 88) |
| 12 | 2.03 (n 44) | 37.33 (n 44) | 0.00 (n 144) |
| 13 | 2.51 (n 44) | 39.48 (n 44) | 0.00 (n 110) |
| 14 | 2.32 (n 44) | 40.48 (n 44) | 0.00 (n 95) |
| 15 | 1.92 (n 44) | 39.17 (n 44) | 0.00 (n 84) |
| 16 | 1.94 (n 44) | 35.47 (n 44) | 0.00 (n 76) |
| 17 | 1.81 (n 44) | 36.81 (n 44) | 0.00 (n 58) |
| 18 | 1.75 (n 44) | 37.94 (n 44) | 0.00 (n 66) |
| 19 | 2.19 (n 44) | 36.68 (n 44) | 0.00 (n 89) |
| 20 | 2.41 (n 44) | 37.66 (n 44) | 0.67 (n 83) |
| 21 | 2.39 (n 14) | 38.60 (n 14) | 45.99 (n 80) |
| 22 | 2.63 (n 24) | 72.22 (n 24) | 3.09 (n 123) |
| 23 | 2.23 (n 36) | 53.66 (n 36) | 0.67 (n 117) |

## Caveats

- In sample: grid7 chose this cell on these years; a pass would only be a candidate for a forward paper record.
- Profiles are recent (Nov 2026, today's relative spread charged on every past year); the gold and silver profiles are the
  first two minutes of each hour on 44 weekdays, USD/JPY's are quotes at another rule's fills. Slippage beyond the quote is
  only the extra half spread on stops; target fills at the mid level are charged half a spread.
- OANDA mid candles, not broker ticks.
