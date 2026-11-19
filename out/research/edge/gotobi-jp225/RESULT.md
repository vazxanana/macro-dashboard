# Gotobi on the Nikkei: the fade after the 09:55 Tokyo fix, moved to JP225

**Verdict: FAIL.** Decisive window: n 760, −0.045R a trade net (+0.043 gross), month t −1.09; replication n 208, −0.024R; at 2x cost −0.134R; placebo 95th pct −0.057R. Pre-registered in PREREGISTRATION.md (pushed alone first). OANDA mid M5 JP225 (JP225_USD CFD), net of 0.04 % of price a round trip. Paper research only; nothing live changed.

## Coverage of the fade window (00:55-06:00 UTC), by year

| Year | Tokyo business days | Entry candle | Entry and exit | Day share | 5-min slot share | Covered |
|---|---|---|---|---|---|---|
| 2010 | 245 | 77 | 74 | 30.2 % | 24.2 % | no |
| 2011 | 245 | 91 | 89 | 36.3 % | 29.5 % | no |
| 2012 | 248 | 213 | 211 | 85.1 % | 81.8 % | no |
| 2013 | 245 | 241 | 241 | 98.4 % | 98.3 % | yes |
| 2014 | 244 | 241 | 241 | 98.8 % | 97.4 % | yes |
| 2015 | 244 | 243 | 243 | 99.6 % | 98.8 % | yes |
| 2016 | 245 | 243 | 243 | 99.2 % | 98.9 % | yes |
| 2017 | 247 | 245 | 245 | 99.2 % | 96.8 % | yes |
| 2018 | 245 | 243 | 243 | 99.2 % | 98.5 % | yes |
| 2019 | 241 | 236 | 236 | 97.9 % | 96.8 % | yes |
| 2020 | 243 | 241 | 241 | 99.2 % | 99.0 % | yes |
| 2021 | 245 | 244 | 244 | 99.6 % | 99.6 % | yes |
| 2022 | 244 | 242 | 241 | 98.8 % | 99.1 % | yes |
| 2023 | 246 | 245 | 245 | 99.6 % | 99.5 % | yes |
| 2024 | 245 | 243 | 243 | 99.2 % | 99.2 % | yes |
| 2025 | 243 | 241 | 240 | 98.8 % | 98.9 % | yes |
| 2026 | 208 | 208 | 208 | 100.0 % | 100.0 % | yes |

## Primary test: sell JP225 at 00:55 UTC on gotobi days, buy back at 06:00 UTC

| Window | n | Net R a trade | Gross R a trade | Cost R | Net R at 2x cost | Total net R | Month t | Months | Win % | Stopped % | Median stop (% of price) |
|---|---|---|---|---|---|---|---|---|---|---|---|
| decisive 2016-01-01 to 2026-11-11 | 760 | −0.045 | +0.043 | 0.088 | −0.134 | −34.6 | −1.09 | 131 | 43.0 | 31.8 | 0.494 |
| replication 2013-01-01 to 2015-12-31 | 208 | −0.024 | +0.050 | 0.074 | −0.097 | −5.0 | −0.33 | 36 | 42.8 | 27.4 | 0.597 |

## The conditions

| Net R > 0 | Month t >= 2 | Replication net R > 0 | Net R at 2x cost > 0 | Above placebo 95th pct | Pass |
|---|---|---|---|---|---|
| no | no (−1.09) | no (−0.024) | no (−0.134) | yes (95th pct −0.057, above 40 of 40) | fail |

## Placebo and every other day (decisive window)

| Placebo median net R | Placebo 95th pct (38th of 40) | Every non-gotobi day: n | net R | month t |
|---|---|---|---|---|
| −0.099 | −0.057 | 1869 | −0.090 | −3.87 |

## By year (gotobi trades)

| | 2013 | 2014 | 2015 | 2016 | 2017 | 2018 | 2019 | 2020 | 2021 | 2022 | 2023 | 2024 | 2025 | 2026 |
|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|
| n | 69 | 68 | 71 | 71 | 70 | 70 | 68 | 69 | 70 | 71 | 71 | 70 | 68 | 62 |
| Total net R | +5.4 | +6.3 | −16.7 | +4.8 | −12.4 | −3.4 | −20.5 | +8.9 | +13.4 | −2.1 | −3.6 | −10.2 | −2.2 | −7.3 |

## Secondary (reported, not conditions)

Plain move of JP225 from the 00:55 UTC open to the 06:00 UTC price, in basis points of the entry price, gotobi days against the other Tokyo business days (Welch t); and the correlation, day by day, of the JP225 and USD/JPY moves over the same window (same price rules, both from OANDA mid M5).

| Window | Gotobi n | Gotobi mean (bp) | Other n | Other mean (bp) | Difference (bp) | Welch t | Corr. all days (n, r, t) | Corr. gotobi days (n, r, t) |
|---|---|---|---|---|---|---|---|---|
| decisive | 760 | −1.78 | 1869 | +0.48 | −2.26 | −0.70 | 2628, +0.493, +29.1 | 760, +0.588, +20.0 |
| replication | 208 | −8.63 | 517 | −0.38 | −8.25 | −1.26 | 725, +0.690, +25.6 | 208, +0.655, +12.4 |

## Notes

- Data: OANDA mid M5 JP225 from 2010-04-12 through 2026-11-11, candles 00:00-06:55 UTC only. Gotobi trades lost to missing candles or a short lookback in covered years: 25 (other days 6).
- JP225_USD is quoted in Nikkei index points (P&L in USD); the price is not converted at the FX rate, so its move is the index move.
- Cost: 0.04 % of the entry price a round trip (about 18 points at 45,000: OANDA's typical daytime spread of about 8 points plus one Osaka mini tick of 5 points each way, the figure fixed in open-run-breadth-2), assumed, not measured. Intraday, no financing.
- The month t is on calendar-month sums of net R; `tradeT` in result.json treats the trades of a month as independent and is for information only.
- One test, so no Holm correction inside the study; it is one more line in the multiple-testing ledger.
- Read after the verdict, not part of it: the gotobi trades beat ordinary days (−0.045R against −0.090R a trade; the placebo condition holds) and the gotobi move after the fix leans the predicted way (−2.26 bp against other days, Welch t −0.70), but before costs the trade makes only +0.043R, under its cost of 0.088R, and the plain-move difference is not apart from noise; ordinary days make −0.003R before costs, so the gotobi gap is about +0.045R a trade, beyond the 40 placebo draws but smaller than the cost. The Nikkei does move with USD/JPY in this window (r +0.493), so a fix flow of the size seen on USD/JPY would be expected to show; it does not, measurably.
