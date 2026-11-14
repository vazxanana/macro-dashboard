# US index CFDs' Sunday-reopen gap fade: result

Pre-registered in PREREGISTRATION.md (committed before this study's code existed or any trade was simulated). Built 2026-11-14. Paper research only: nothing live changed.

## Verdict: FAIL: pooled −0.126R a trade after costs on 2016-26 (n 102, month-sum t −1.59), −0.067R on 2008-15 (n 42)

Decisive window 2016-01-01 to 2026-11-13: pooled −0.126R a trade after costs (n 102, month-sum t −1.59, −0.095R before costs, fill rate 10.8 %); US500 −0.092R (n 38, t −1.28), NAS100 −0.151R (n 30, t −1.52), US30 −0.141R (n 34, t −1.69). Placebo (weekday evenings, same rule, 40 seeds): decisive pooled mean p5 / p50 / p95 −0.060 / −0.022 / +0.066R; 40 of 40 at or above the real −0.126R.

| Test | Window | n | Fill rate | Win | Gross R | Spread R | Financing R | Net R | Net R at 2x spread | Trade t | Month-sum t | Total net R | Max DD R |
|---|---|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|
| T1 US500 | 2016-26 | 38 | 10.5 % | 42.1 % | −0.058 | −0.026 | −0.008 | −0.092 | −0.118 | −1.14 | −1.28 | −3.5 | 4.6 |
| T1 US500 | 2008-15 | 17 | 5.9 % | 47.1 % | −0.049 | −0.025 | −0.006 | −0.081 | −0.106 | −0.81 | −0.81 | −1.4 | 2.1 |
| T2 NAS100 | 2016-26 | 30 | 13.3 % | 43.3 % | −0.126 | −0.019 | −0.006 | −0.151 | −0.170 | −1.41 | −1.52 | −4.5 | 5.5 |
| T2 NAS100 | 2008-15 | 10 | 0.0 % | 70.0 % | +0.014 | −0.020 | −0.004 | −0.010 | −0.030 | −0.08 | −0.08 | −0.1 | 1.3 |
| T3 US30 | 2016-26 | 34 | 8.8 % | 50.0 % | −0.109 | −0.025 | −0.007 | −0.141 | −0.167 | −1.60 | −1.69 | −4.8 | 6.0 |
| T3 US30 | 2008-15 | 15 | 0.0 % | 53.3 % | −0.057 | −0.025 | −0.006 | −0.088 | −0.113 | −0.78 | −0.85 | −1.3 | 2.2 |
| P pooled | 2016-26 | 102 | 10.8 % | 45.1 % | −0.095 | −0.024 | −0.007 | −0.126 | −0.149 | −2.41 | −1.59 | −12.8 | 15.6 |
| P pooled | 2008-15 | 42 | 2.4 % | 54.8 % | −0.037 | −0.024 | −0.006 | −0.067 | −0.091 | −1.04 | −0.68 | −2.8 | 4.8 |

## Pass conditions (decisive window)

| Test | net > 0 | net > 0 at 2x spread | month-sum t (Holm for T1-T3, alone for P) | n ≥ 30 / 60 | replication net > 0 | Pass |
|---|---|---|---|---|---|---|
| T1 | no | no | no (p 0.8995) | yes | no | no |
| T2 | no | no | no (p 0.9355) | yes | no | no |
| T3 | no | no | no (p 0.9547) | yes | no | no |
| P | no | no | no (p 0.9439) | yes | no | no |

## Placebo

Weekday (Monday-Thursday) evenings with a 14:00 → 18:00 New York move over 0.5 × ATR20, faded the same way (target the 14:00 price, 1 × ATR stop, out at 09:30 the next day, the same costs), drawn to the real trade counts per market and window. Pool sizes: US500 184 (2008-15) / 222 (2016-26), NAS100 204 (2008-15) / 196 (2016-26), US30 170 (2008-15) / 189 (2016-26). Decisive pooled mean net R over 40 seeds: min −0.092, p5 −0.060, median −0.022, p95 +0.066, max +0.077; the real pooled −0.126R (40 of 40 seeds at or above it).

## How often the gap fills (every used week, before Monday 09:30 New York, pooled)

| |gap| / ATR20 | 2008-15 weeks | filled | rate | 2016-26 weeks | filled | rate |
|---|---:|---:|---:|---:|---:|---:|
| 0-0.25 | 1064 | 866 | 81.4 % | 1348 | 1022 | 75.8 % |
| 0.25-0.5 | 59 | 22 | 37.3 % | 137 | 57 | 41.6 % |
| 0.5-1 | 34 | 0 | 0.0 % | 80 | 7 | 8.8 % |
| 1-up | 8 | 1 | 12.5 % | 22 | 3 | 13.6 % |

## Exits, skipped weeks

- T1 US500: weeks from 2008 984, used 918, skipped {"holiday":63,"reopen":3}, eligible (gap > 0.5 ATR) 55, no trade {}; exits 2016-26 {"time":31,"stop":3,"target":4}, 2008-15 {"time":15,"stop":1,"target":1}.
- T2 NAS100: weeks from 2008 984, used 917, skipped {"holiday":63,"reopen":4}, eligible (gap > 0.5 ATR) 40, no trade {}; exits 2016-26 {"time":21,"stop":5,"target":4}, 2008-15 {"time":9,"stop":1}.
- T3 US30: weeks from 2008 984, used 917, skipped {"holiday":63,"reopen":4}, eligible (gap > 0.5 ATR) 49, no trade {}; exits 2016-26 {"time":27,"stop":4,"target":3}, 2008-15 {"time":14,"stop":1}.

## By year (pooled, net R a trade, total, n)

| Year | Net R | Total | n |
|---|---:|---:|---:|
| 2008 | −0.171 | −0.85 | 5 |
| 2010 | −1.016 | −3.05 | 3 |
| 2011 | −0.089 | −0.71 | 8 |
| 2012 | +0.402 | +2.01 | 5 |
| 2013 | −0.103 | −1.24 | 12 |
| 2014 | +0.039 | +0.16 | 4 |
| 2015 | +0.178 | +0.89 | 5 |
| 2016 | −0.358 | −2.86 | 8 |
| 2017 | −0.021 | −0.17 | 8 |
| 2018 | −0.036 | −0.18 | 5 |
| 2019 | −0.320 | −4.79 | 15 |
| 2020 | −0.349 | −5.94 | 17 |
| 2022 | +0.353 | +1.41 | 4 |
| 2023 | +0.168 | +0.17 | 1 |
| 2025 | −0.088 | −1.59 | 18 |
| 2026 | +0.043 | +1.12 | 26 |

## Reading

Not an edge, and not a near miss. A Sunday-reopen gap over half a 20-day ATR on the three US index CFDs did not fill before New York opened on Monday: the fade reached Friday's close in 11 of 102 trades in 2016-26 and 1 of 42 in 2008-15, most trades (79 of 102) ran out at 09:30 Monday, and the stream lost before any cost (pooled −0.095R a trade gross on 2016-26, −0.037R on 2008-15). After the index spread (about 0.024R) and one night of financing (about 0.007R) every market loses in both windows (month-sum t −1.28 to −1.69 on 2016-26), so no test meets any of the pre-registered conditions but n. The fill table says why: small gaps (under a quarter of the ATR) fill before Monday 09:30 in 76-81 % of weeks, but gaps of 0.5-1 ATR filled in 0 of 34 weeks in 2008-15 and 7 of 80 in 2016-26 (none of the up gaps): a large weekend gap on these indices is news being priced, not thin-book noise, and price tends to keep it. The real pooled mean (−0.126R) is below all 40 placebo runs on weekday evenings (p5 −0.060R, p95 +0.066R), so fading a big Sunday gap did worse than fading a same-size afternoon-to-evening move on an ordinary weekday. Never propose it as a council rule or filter; nothing live changed. Not tested (outside the pre-registration): a hold past 09:30 Monday, a partial-fill target, or trading with the gap.

## Data

OANDA mid M5 through /md/bars: US500 1305759 candles 2007-10-01 00:00 to 2026-11-13 21:55; NAS100 1322971 candles 2007-10-01 00:00 to 2026-11-13 21:55; US30 1330930 candles 2007-10-01 00:00 to 2026-11-13 21:55. Rates: FRED DGS2 weekly (rates.json, copied from research/edge/index-overnight/rates.json). Holidays: ict/calendar.mjs cmeShut. To repeat: `node --use-env-proxy research/edge/index-weekend-gap/fetch.mjs <dir>`, then `node research/edge/index-weekend-gap/run.mjs full <dir>` (candles kept out of the repository).
