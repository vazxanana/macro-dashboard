# Gotobi: USD/JPY and EUR/JPY into the 09:55 Tokyo fix on settlement days, and the fade after it

**Verdict: PASS (T2).** T2 met all five pre-registered conditions. Pre-registered in PREREGISTRATION.md (first commit of the branch), OANDA mid M5, net of the raw-spread cost model plus 0.5 pip slippage a side. Paper research only; nothing live changed.

## Results

| Test | Pair | Leg | Window | n | Net R a trade | Gross R a trade | Cost R | Total net R | Month t | Months | Win % | Stopped % | Median stop (pips) |
|---|---|---|---|---|---|---|---|---|---|---|---|---|---|
| T1 | USD/JPY | long | 2016-now | 760 | +0.036 | +0.158 | 0.123 | +27.1 | +0.93 | 131 | 50.1 | 31.3 | 17.4 |
| T1 | USD/JPY | long | 2010-15 | 425 | +0.122 | +0.275 | 0.153 | +51.7 | +1.60 | 72 | 51.1 | 27.5 | 12 |
| T2 | USD/JPY | fade | 2016-now | 771 | +0.148 | +0.261 | 0.113 | +114.2 | +2.74 | 131 | 51.4 | 27.6 | 19.5 |
| T2 | USD/JPY | fade | 2010-15 | 425 | +0.131 | +0.243 | 0.112 | +55.5 | +2.45 | 72 | 52.7 | 27.3 | 17.5 |
| T3 | EUR/JPY | long | 2016-now | 765 | +0.095 | +0.214 | 0.118 | +72.9 | +2.20 | 131 | 52.0 | 29.8 | 17.5 |
| T3 | EUR/JPY | long | 2010-15 | 425 | −0.016 | +0.093 | 0.110 | −6.9 | −0.21 | 72 | 46.1 | 32.7 | 18.9 |
| T4 | EUR/JPY | fade | 2016-now | 771 | +0.102 | +0.202 | 0.100 | +78.6 | +1.84 | 131 | 49.3 | 28.3 | 21.5 |
| T4 | EUR/JPY | fade | 2010-15 | 425 | +0.198 | +0.275 | 0.076 | +84.3 | +3.23 | 72 | 55.3 | 25.9 | 26.1 |

## The five conditions

| Test | Net R > 0 | Month t >= 2 | 2010-15 same sign | Holm (adj. p) | Placebo 95th pct (net R) | Beats placebo | Pass |
|---|---|---|---|---|---|---|---|
| T1 | yes | no | yes | no (0.1762) | −0.091 | yes (above 40 of 40) | fail |
| T2 | yes | yes | yes | yes (0.0123) | −0.016 | yes (above 40 of 40) | PASS |
| T3 | yes | yes | no | yes (0.0417) | −0.087 | yes (above 40 of 40) | fail |
| T4 | yes | no | yes | no (0.0658) | −0.031 | yes (above 40 of 40) | fail |

## Placebo and every other day

Each placebo seed draws as many non-gotobi Tokyo business days of 2016-now as the test has trades and runs the identical leg. "Every other day" is the leg on all of them.

| Test | Placebo median net R | Placebo 95th pct (38th of 40) | Every non-gotobi day: n | net R | month t |
|---|---|---|---|---|---|
| T1 | −0.133 | −0.091 | 1839 | −0.137 | −5.02 |
| T2 | −0.062 | −0.016 | 1870 | −0.063 | −2.37 |
| T3 | −0.115 | −0.087 | 1859 | −0.123 | −4.83 |
| T4 | −0.075 | −0.031 | 1870 | −0.081 | −2.93 |

## By year (net R total, gotobi trades)

| Test | 2010 | 2011 | 2012 | 2013 | 2014 | 2015 | 2016 | 2017 | 2018 | 2019 | 2020 | 2021 | 2022 | 2023 | 2024 | 2025 | 2026 |
|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|
| T1 | +7.0 | +34.7 | +4.2 | +20.9 | −9.7 | −5.3 | −5.6 | +14.1 | −4.2 | +2.5 | −8.0 | +15.2 | +1.3 | +2.7 | +9.6 | −10.0 | +9.7 |
| T2 | +14.8 | +15.8 | +13.2 | +12.5 | +2.0 | −2.8 | +20.4 | +3.8 | −2.8 | +21.6 | +14.2 | +3.2 | +29.3 | −0.8 | +15.4 | +21.9 | −11.8 |
| T3 | −6.5 | +16.4 | −2.6 | +17.8 | −20.2 | −11.9 | −7.2 | +23.5 | +5.3 | +1.5 | +7.5 | +11.0 | −5.6 | +10.0 | +17.1 | +5.8 | +3.8 |
| T4 | +13.7 | +17.4 | +11.5 | +18.6 | +3.0 | +20.1 | +21.7 | −8.2 | −9.8 | +7.2 | −5.0 | +4.6 | +20.1 | +4.4 | +25.8 | +23.5 | −5.6 |

## Notes

- Data: OANDA mid M5, USD/JPY from 2009-11-01, EUR/JPY from 2009-11-01, through 2026-11-11. Gotobi trades lost to missing candles: T1 23, T2 12, T3 18, T4 12 (of 1208 gotobi days in both windows).
- The long entry is 22:05 UTC whenever 22:00 UTC is 17:00 New York (New York standard time, about November to March), the rollover gap; 22:00 UTC otherwise. No position is held across a rollover, so no financing is charged.
- Costs per round trip: 0.3 pip spread + 2 x 0.5 pip slippage + 2 x USD 22.5 per million (about 0.7 pip at 150 yen), so about 2 pips; the cost in R is that divided by the stop distance D. The 0.3 pip spread is the USD/JPY-style raw-spread figure, used unmeasured for EUR/JPY.
- The month t is on calendar-month sums of net R; the trade t in result.json (`tradeT`) treats the about six trades of a month as independent and is shown for information only.
- The placebo 95th percentiles are below zero because the same windows on ordinary days lose about their cost (the "every non-gotobi day" column): the placebo asks whether gotobi days beat ordinary days, the other conditions whether they beat zero.
- Read after the verdict, not part of it (T2): positive in 8 of 11 years of 2016-now and 5 of 6 of 2010-15; at twice the costs it would make +0.035R a trade on 2016-now. The other three tests did not pass and are not evidence for it.
