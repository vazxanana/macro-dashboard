# The passing rules as one paper book, 2016 → 19 Nov 2026

**ACCOUNTING (no rule tested): the equal-1R book of the five passing rules made +475.5R over 131 months (+43.6R a year, month t 4.81), worst closed drawdown −49.8R, worst full year 2023 −23.0R; in-sample years for at least one rule, a description, not evidence**

Pre-registered in `PREREGISTRATION.md` (committed alone before any figure). **Every year here is in sample for at least one of the five rules**, so this is a description of how the record looked, not evidence that it will continue. Costs: gold breakout measured (hourly spread), USD/JPY breakout pre-set demo cost, gotobi the study's own assumed ~2 pips (the broker quotes measured 0.81; second book line), pre-holiday and Turnaround assumed. 1R a trade each, nothing compounded. Paper research only; nothing live changed. Written by `run.mjs`.

Gates: gold breakout W3 ok ({"n":935,"netR":0.094,"t":2.41}), W4 ok ({"n":1121,"netR":0.105,"t":2.79}); gotobi T2 ok ({"n":771,"netR":0.1481,"t":2.74}); USD/JPY baseline {"n":2079,"netR":0.063}.

## Per rule and the book (131 months, 2840 weekdays)

| | Trades | Total R | R a trade | R a year | Month t | Months up | Worst month | Worst closed DD (R) | DD from → to | Longest under water (days) | Worst full year | Losing years | 2026 to date |
|---|---|---|---|---|---|---|---|---|---|---|---|---|---|
| Gold volatility breakout T1 | 2059 | +210.0 | +0.102 | +19.2 | 3.75 | 73 of 131 | −8.3 | −28.3 | 2023-05-09 → 2024-02-28 | 597 (2023-05-09 →) | 2023 −8.2 | 2023 | +50.7 |
| USD/JPY volatility breakout T1 | 2079 | +131.7 | +0.063 | +12.1 | 2.50 | 74 of 131 | −7.7 | −33.8 | 2022-12-15 → 2023-10-30 | 574 (2022-12-15 →) | 2023 −15.4 | 2016, 2019, 2023 | +13.4 |
| Gotobi fade T2 (USD/JPY) | 772 | +113.5 | +0.147 | +10.4 | 2.72 | 68 of 131 | −5.5 | −18.9 | 2016-09-22 → 2018-09-10 | 981 (2016-09-22 →) | 2018 −2.8 | 2018, 2023 | −12.6 |
| Gold before a US holiday T1 | 100 | +12.6 | +0.125 | +1.1 | 2.21 | 52 of 131 | −1.1 | −2.8 | 2025-01-16 → 2026-06-18 | 672 (still open) (2025-01-16 →) | 2025 −1.4 | 2016, 2025 | −1.1 |
| Turnaround Tuesday R2 (NAS100) | 82 | +7.8 | +0.095 | +0.7 | 1.98 | 37 of 131 | −1.0 | −1.2 | 2021-11-22 → 2022-12-28 | 1051 (2021-11-22 →) | 2022 −0.7 | 2022 | +1.0 |
| Equal-1R book (all five) | 5092 | +475.5 | +0.093 | +43.6 | 4.81 | 86 of 131 | −15.6 | −49.8 | 2023-04-03 → 2023-09-20 | 469 (2016-09-13 →) | 2023 −23.0 | 2023 | +51.3 |
| Book, gotobi at broker quotes from 24 Nov 2023 | 5092 | +485.9 | +0.095 | +44.5 | 4.91 | 86 of 131 | −15.6 | −49.8 | 2023-04-03 → 2023-09-20 | 469 (2016-09-13 →) | 2023 −22.6 | 2023 | +55.9 |

## Correlations

Daily (every weekday, 0 on days a rule did not trade):

| | goldVB | jpyVB | gotobi | preHol | turn |
|---|---|---|---|---|---|
| goldVB | 1.00 | 0.14 | -0.03 | 0.03 | -0.04 |
| jpyVB | 0.14 | 1.00 | 0.02 | -0.01 | 0.01 |
| gotobi | -0.03 | 0.02 | 1.00 | 0.00 | -0.02 |
| preHol | 0.03 | -0.01 | 0.00 | 1.00 | -0.01 |
| turn | -0.04 | 0.01 | -0.02 | -0.01 | 1.00 |

Monthly sums:

| | goldVB | jpyVB | gotobi | preHol | turn |
|---|---|---|---|---|---|
| goldVB | 1.00 | 0.22 | 0.01 | 0.10 | 0.00 |
| jpyVB | 0.22 | 1.00 | 0.13 | 0.19 | -0.02 |
| gotobi | 0.01 | 0.13 | 1.00 | 0.03 | -0.06 |
| preHol | 0.10 | 0.19 | 0.03 | 1.00 | -0.09 |
| turn | 0.00 | -0.02 | -0.06 | -0.09 | 1.00 |

The USD/JPY breakout and gotobi both traded on 569 weekdays (two USD/JPY positions on those mornings).

## Month-block bootstrap of 3 years (20000 draws of 36 months from the 131, seed 20261124)

| | 3-year total R p5 | p50 | p95 | Share below 0 | Worst DD in the 3 years p50 | p5 (bad case) |
|---|---|---|---|---|---|---|
| Gold volatility breakout T1 | +10.2 | +56.8 | +106.5 | 2.2 % | −13.1 | −26.6 |
| USD/JPY volatility breakout T1 | −8.4 | +35.8 | +81.8 | 9.5 % | −15.8 | −33.1 |
| Gotobi fade T2 (USD/JPY) | −3.2 | +30.5 | +69.2 | 6.8 % | −10.4 | −21.8 |
| Gold before a US holiday T1 | −1.3 | +3.4 | +8.4 | 12.1 % | −1.7 | −3.7 |
| Turnaround Tuesday R2 (NAS100) | −1.1 | +2.1 | +5.6 | 14.4 % | −1.1 | −2.5 |
| Equal-1R book (all five) | +46.4 | +129.7 | +216.8 | 0.4 % | −20.2 | −40.7 |
| Book, gotobi at broker quotes from 24 Nov 2023 | +49.1 | +132.7 | +219.7 | 0.4 % | −19.9 | −40.3 |

Months are drawn as whole blocks, so a month's trades stay together; months are drawn independently, so a run of bad months (like 2023 for both breakouts) is likely under-represented. Built from in-sample years: the bands show the spread of the record, not a forecast.

## At 0.25 % risk a trade (simple %, not compounded)

| | % a year | Worst closed DD % | Worst full year % | 3-year p5 % | p50 % | p95 % | 3-year worst DD p5 % |
|---|---|---|---|---|---|---|---|
| Gold volatility breakout T1 | +4.8 | −7.1 | −2.0 | +2.6 | +14.2 | +26.6 | −6.7 |
| USD/JPY volatility breakout T1 | +3.0 | −8.4 | −3.9 | −2.1 | +8.9 | +20.4 | −8.3 |
| Gotobi fade T2 (USD/JPY) | +2.6 | −4.7 | −0.7 | −0.8 | +7.6 | +17.3 | −5.5 |
| Gold before a US holiday T1 | +0.3 | −0.7 | −0.3 | −0.3 | +0.8 | +2.1 | −0.9 |
| Turnaround Tuesday R2 (NAS100) | +0.2 | −0.3 | −0.2 | −0.3 | +0.5 | +1.4 | −0.6 |
| Equal-1R book (all five) | +10.9 | −12.4 | −5.7 | +11.6 | +32.4 | +54.2 | −10.2 |
| Book, gotobi at broker quotes from 24 Nov 2023 | +11.1 | −12.4 | −5.7 | +12.3 | +33.2 | +54.9 | −10.1 |

## By year (R)

| Year | goldVB | jpyVB | gotobi | preHol | turn | book | bookExec |
|---|---|---|---|---|---|---|---|
| 2016 | +15.2 | −0.4 | +20.4 | −0.3 | +1.1 | +36.0 | +36.0 |
| 2017 | +18.1 | +6.5 | +3.8 | +2.3 | +0.1 | +30.8 | +30.8 |
| 2018 | +1.4 | +19.4 | −2.8 | +2.9 | +1.6 | +22.6 | +22.6 |
| 2019 | +10.9 | −8.8 | +21.6 | +0.3 | +1.0 | +25.0 | +25.0 |
| 2020 | +41.9 | +17.7 | +14.2 | +2.5 | +1.9 | +78.2 | +78.2 |
| 2021 | +12.9 | +31.2 | +3.2 | +2.0 | +0.8 | +50.1 | +50.1 |
| 2022 | +12.1 | +19.8 | +29.3 | +0.7 | −0.7 | +61.2 | +61.2 |
| 2023 | −8.2 | −15.4 | −0.8 | +0.6 | +0.8 | −23.0 | −22.6 |
| 2024 | +17.2 | +37.8 | +15.4 | +4.0 | +0.1 | +74.5 | +77.6 |
| 2025 | +37.8 | +10.4 | +21.9 | −1.4 | +0.1 | +68.8 | +71.1 |
| 2026 | +50.7 | +13.4 | −12.6 | −1.1 | +1.0 | +51.3 | +55.9 |

## Notes

- In sample: the gold breakout was found on 2016-20 and judged on 2021-26; the USD/JPY breakout was found on 2016-26; gotobi judged on 2016-26; the pre-holiday long judged on 2017-26; Turnaround Tuesday judged on 2016-26. No year here is untouched for every rule.
- The forward records (gold breakout from 13 Nov, USD/JPY breakout from 20 Nov, pre-holiday from Thanksgiving, Turnaround from 12 Nov) are the judges; gotobi has only the demo job.
- Turnaround Tuesday and the pre-holiday long had their replications fail or not independent (research/proposals/2026-11-23-edge-book.md); they are in the book because the task named them.
- The 0.25 % figures add R x 0.25 % to the starting account; slippage beyond what each study charged is not counted.
