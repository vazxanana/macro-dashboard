# London fix: the run into the 16:00 WM/Reuters fix on six forex majors, and the fade after it

**Verdict: FAIL.** Neither test met the pre-registered bar (T1 −0.152R a trade net, n 3510, month t −7.44; T2 −0.164R a trade net, n 3510, month t −10.32, 2020-now, six pairs pooled). Pre-registered in PREREGISTRATION.md (first commit of the branch), OANDA mid M5, net of the raw-spread cost model plus 0.5 pip slippage a side. Paper research only; nothing live changed.

## Results, six pairs pooled

| Test | Window | n | Net R a trade | Gross R a trade | Cost R | Net R at 2 x cost | Total net R | Month t | Month t at 2 x cost | Months | Win % | Stopped % |
|---|---|---|---|---|---|---|---|---|---|---|---|---|
| T1 | 2020-now | 3510 | −0.152 | −0.011 | 0.141 | −0.292 | −532.1 | −7.44 | −13.31 | 83 | 41.3 | 23.7 |
| T1 | 2016-19 | 2036 | −0.166 | −0.005 | 0.161 | −0.327 | −338.0 | −6.77 | −11.83 | 48 | 41.7 | 28.3 |
| T2 | 2020-now | 3510 | −0.164 | −0.023 | 0.141 | −0.305 | −575.9 | −10.32 | −16.37 | 83 | 34.4 | 6.1 |
| T2 | 2016-19 | 2036 | −0.195 | −0.034 | 0.161 | −0.356 | −396.7 | −10.32 | −15.34 | 48 | 34.5 | 11.6 |

## The five conditions

| Test | Net R > 0 | Month t >= 2 | 2016-19 same sign | Holm (adj. p) | Placebo 95th pct (net R) | Beats placebo | Pass |
|---|---|---|---|---|---|---|---|
| T1 | no | no | no | no (1) | −0.156 | yes (above 38 of 40) | fail |
| T2 | no | no | no | no (1) | −0.191 | yes (above 40 of 40) | fail |

## By pair (information, not tests)

| Test | Pair | Window | n | Net R a trade | Gross R a trade | Cost R | Month t | Median stop (pips) |
|---|---|---|---|---|---|---|---|---|
| T1 | EUR/USD | 2020-now | 578 | −0.155 | −0.011 | 0.144 | −4.53 | 13.6 |
| T1 | EUR/USD | 2016-19 | 351 | −0.149 | +0.024 | 0.172 | −2.83 | 11.8 |
| T1 | GBP/USD | 2020-now | 571 | −0.153 | −0.038 | 0.115 | −3.92 | 17.8 |
| T1 | GBP/USD | 2016-19 | 350 | −0.183 | −0.070 | 0.114 | −4.08 | 18.0 |
| T1 | USD/JPY | 2020-now | 603 | −0.166 | −0.022 | 0.144 | −4.86 | 15.1 |
| T1 | USD/JPY | 2016-19 | 351 | −0.146 | +0.029 | 0.175 | −2.81 | 11.4 |
| T1 | AUD/USD | 2020-now | 594 | −0.170 | −0.009 | 0.162 | −5.39 | 10.7 |
| T1 | AUD/USD | 2016-19 | 317 | −0.253 | −0.056 | 0.198 | −5.94 | 8.8 |
| T1 | USD/CHF | 2020-now | 573 | −0.126 | +0.021 | 0.147 | −3.74 | 12.1 |
| T1 | USD/CHF | 2016-19 | 317 | −0.109 | +0.053 | 0.162 | −2.17 | 11.1 |
| T1 | EUR/JPY | 2020-now | 591 | −0.138 | −0.005 | 0.133 | −3.53 | 16.0 |
| T1 | EUR/JPY | 2016-19 | 350 | −0.158 | −0.011 | 0.148 | −3.29 | 13.3 |
| T2 | EUR/USD | 2020-now | 578 | −0.163 | −0.019 | 0.144 | −6.12 | 13.6 |
| T2 | EUR/USD | 2016-19 | 351 | −0.223 | −0.050 | 0.172 | −6.58 | 11.8 |
| T2 | GBP/USD | 2020-now | 571 | −0.142 | −0.028 | 0.115 | −5.84 | 17.8 |
| T2 | GBP/USD | 2016-19 | 350 | −0.148 | −0.035 | 0.114 | −4.12 | 18.0 |
| T2 | USD/JPY | 2020-now | 603 | −0.132 | +0.013 | 0.144 | −4.92 | 15.1 |
| T2 | USD/JPY | 2016-19 | 351 | −0.168 | +0.007 | 0.175 | −4.03 | 11.4 |
| T2 | AUD/USD | 2020-now | 594 | −0.181 | −0.019 | 0.162 | −7.01 | 10.7 |
| T2 | AUD/USD | 2016-19 | 317 | −0.223 | −0.025 | 0.198 | −5.99 | 8.8 |
| T2 | USD/CHF | 2020-now | 573 | −0.201 | −0.055 | 0.147 | −7.87 | 12.1 |
| T2 | USD/CHF | 2016-19 | 317 | −0.233 | −0.071 | 0.162 | −5.73 | 11.1 |
| T2 | EUR/JPY | 2020-now | 591 | −0.166 | −0.033 | 0.133 | −7.61 | 16.0 |
| T2 | EUR/JPY | 2016-19 | 350 | −0.180 | −0.033 | 0.148 | −4.83 | 13.3 |

## Placebo: the same windows at other half-hours of the London afternoon (2020-now)

Each of 40 seeds draws one slot a day from the ten listed below and runs the identical rule there. The slot columns show each slot on its own (net R a trade, month t).

| Test | Placebo median net R | Placebo 95th pct (38th of 40) | Real (16:00) net R | 12:00 | 12:30 | 13:00 | 13:30 | 14:00 | 14:30 | 15:00 | 17:00 | 17:30 | 18:00 |
|---|---|---|---|---|---|---|---|---|---|---|---|---|---|
| T1 | −0.192 | −0.156 | −0.152 | −0.272 (t −10.7) | −0.227 (t −7.8) | −0.166 (t −5.5) | −0.171 (t −5.7) | −0.111 (t −5.1) | −0.178 (t −6.2) | −0.129 (t −4.6) | −0.201 (t −9.4) | −0.199 (t −7.2) | −0.313 (t −11.4) |
| T2 | −0.207 | −0.191 | −0.164 | −0.284 (t −16.9) | −0.226 (t −15.3) | −0.211 (t −12.3) | −0.168 (t −7.4) | −0.158 (t −13.2) | −0.159 (t −11.4) | −0.127 (t −8.2) | −0.228 (t −15.3) | −0.239 (t −16.5) | −0.283 (t −16.7) |

## By year (pooled net R total)

| Test | 2016 | 2017 | 2018 | 2019 | 2020 | 2021 | 2022 | 2023 | 2024 | 2025 | 2026 |
|---|---|---|---|---|---|---|---|---|---|---|---|
| T1 | −43.3 | −94.5 | −97.3 | −103.0 | −68.2 | −59.6 | −84.4 | −89.8 | −108.0 | −76.3 | −46.0 |
| T2 | −98.0 | −86.3 | −100.0 | −112.3 | −45.8 | −111.7 | −72.8 | −102.3 | −113.0 | −44.5 | −85.8 |

## Notes

- Data: OANDA mid M5 of the six pairs from 2015-11-01 to 2026-11-12 (the fx-london-orb study's files, kept outside git). Weekdays: 1792 in 2020-now, 1043 in 2016-19. Days with no A (a 15:30 or 15:55 candle missing) by pair: EUR/USD 19, GBP/USD 19, USD/JPY 19, AUD/USD 20, USD/CHF 22, EUR/JPY 20; events with no trade (an entry or exit candle missing): EUR/USD 0/0, GBP/USD 0/0, USD/JPY 0/0, AUD/USD 0/0, USD/CHF 0/0, EUR/JPY 0/0 (T1/T2).
- London time from Intl (Europe/London): 15:30 London is 15:30 UTC in winter and 14:30 UTC on British summer time. The windows never touch the 17:00 New York rollover (22:00 London), so no financing is charged.
- Costs a round trip: 0.3 pip spread + 2 x 0.5 pip slippage + 2 x USD 22.5 per million (about 0.5 pip on EUR/USD), about 1.8 pips; in R that is divided by |A|, the stop. The 0.3 pip spread was measured on the USD majors and is used unmeasured for EUR/JPY.
- The month t is on calendar-month sums of pooled net R; the trade t (`tradeT` in result.json) treats every trade as independent and is shown for information only. Six pairs on one day are correlated (the dollar), which the month sums absorb.
- T1 before costs: −0.011R a trade on 2020-now and −0.005R on 2016-19; the cost is 0.141R a trade on average because the stop is only |A| (median 13.6 / 17.8 / 15.1 / 10.7 / 12.1 / 16 pips by pair, in the order of the pair table).
- T2 before costs: −0.023R a trade on 2020-now and −0.034R on 2016-19; the cost is 0.141R a trade on average because the stop is only |A| (median 13.6 / 17.8 / 15.1 / 10.7 / 12.1 / 16 pips by pair, in the order of the pair table).
- Placebo: both tests clear the placebo's 95th percentile (T1 above 38 of 40, T2 above 40 of 40) while losing, so the 16:00 windows lose LESS than the same rule at other afternoon half-hours, not that they make money. Before costs the ten placebo slots (12:00 to 18:00, in order) make −0.024 / −0.001 / +0.045 / +0.015 / +0.025 / −0.018 / +0.014 / +0.010 / +0.032 / −0.043R (T1) and −0.036 / +0.001 / +0.000 / +0.018 / −0.022 / +0.001 / +0.015 / −0.017 / −0.009 / −0.013R (T2), with a cost of 0.25 / 0.23 / 0.21 / 0.19 / 0.14 / 0.16 / 0.14 / 0.21 / 0.23 / 0.27R a trade against 0.141R at the fix: |A| is larger into 16:00, so the same pip cost is fewer R there. Read after the verdict, not part of it.
