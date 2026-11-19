# Result: long-term reversal across national stock indices (14 Nov 2026)

**Verdict: FAIL.** Buying the three national indices with the worst 36-month return and shorting the three best is not an edge after costs (decisive 2016-now -0.047R a month, Newey-West t -3.8). Pre-registered in [PREREGISTRATION.md](PREREGISTRATION.md) (committed alone and pushed first). Paper research only; nothing live changed.

Claim: Balvers, Wu & Gilliland (2000); Richards (1997): past 3-year losers among national indices beat past winners over the next year. Related: `dual-momentum` and `index-spread-momentum` (both FAIL, branches of the same names) tested MOMENTUM; this tests the opposite, LONG-TERM REVERSAL across 17 national index CFDs.

Data: OANDA mid daily candles of au200, ch20, cn50, de40, es35, eu50, fr40, hk33, in50, jp225, nas100, nl25, sg30, spx500, uk100, us2000, us30 (council-data research/daily/*.json, weekend stubs folded with `foldWeekend`). Each CFD is quoted in its own currency (JP225, CN50, IN50 in US dollars, the rest local); currency moves are not hedged or converted, and each leg's R is its price move over its own 1R (3 x ATR(20) of the same series), so legs are comparable in R. Price indices, no dividends. DGS2 from council-data macro/cache.json `score.fred.DGS2` (weekly, as-of), a fixed 4 % before its first value (2006-01).

Rule: at each month end rank the markets with a fresh month-end close and 37 months of month-end history by close(m-1) / close(m-37) - 1; long the bottom 3, short the top 3 at the next open, 1R = 3 x ATR(20), stop 1R from the entry (gap fills at the open; a stopped leg is flat for the rest of its cohort), out at the close of month m+12; 12 overlapping cohorts; book R a month = mean of the live cohorts' mean leg R. Costs: 0.04 % of price a leg round trip, plus financing (DGS2 + 2.5 %) / 365 a rollover night on longs and shorts alike.

## Main test (36-month lookback, skip one month)

| Window, cost | Months | Mean R a month | NW t (12 lags) | Plain t | Total R | Worst drawdown R | Months up |
|---|---|---|---|---|---|---|---|
| **Decisive 2016-01 to 2026-10, net (1x)** | 130 | -0.0472 | -3.8 | -3.1 | -6.14 | -6.8 | 39 % |
| Decisive, gross (0x) | 130 | -0.015 | -1.17 | -0.98 | -1.95 | -3.44 | 47 % |
| Decisive, 2x costs | 130 | -0.0795 | -6.17 | -5.19 | -10.33 | -10.93 | 32 % |
| **Replication 2006-05 to 2015-12, net (1x)** | 116 | -0.026 | -1.29 | -1.27 | -3.01 | -3.57 | 41 % |
| Replication, gross (0x) | 116 | 0.003 | 0.15 | 0.15 | 0.35 | -2.84 | 48 % |
| Replication, 2x costs | 116 | -0.055 | -2.42 | -2.65 | -6.38 | -6.47 | 37 % |

Costs a month (base): decisive spread 0.0008R + financing 0.0314R; replication spread 0.0009R + financing 0.0281R. Live cohorts a decisive month: 12 to 12. First month end with 10 or more ranked markets: 2006-04.

## Against the bar

- Decisive mean net R a month > 0: no (-0.0472).
- Replication mean net R a month > 0: no (-0.026).
- Decisive Newey-West t >= 2: no (-3.8).
- Above the placebo's 95th percentile: no (-0.0472 against -0.0323).

## Placebo (random order of the ranked markets each month, same construction and costs; decisive window, 40 seeded draws)

| Real mean net R a month | Draws median | 5th pct | 95th pct | Draws at or above the real |
|---|---|---|---|---|
| -0.0472 | -0.0408 | -0.0455 | -0.0323 | 39 of 40 |

## Per year (book R summed over the year's months, net at 1x and gross)

| Year | Months | Net R | Gross R |
|---|---|---|---|
| 2006 | 8 | -0.73 | 0.03 |
| 2007 | 12 | -0.67 | 0.09 |
| 2008 | 12 | 1.43 | 1.66 |
| 2009 | 12 | -0.65 | -0.47 |
| 2010 | 12 | -1.13 | -0.95 |
| 2011 | 12 | -0.41 | -0.21 |
| 2012 | 12 | -0.28 | -0.06 |
| 2013 | 12 | 0.56 | 0.88 |
| 2014 | 12 | -0.38 | -0.09 |
| 2015 | 12 | -0.75 | -0.53 |
| 2016 | 12 | -0.61 | -0.36 |
| 2017 | 12 | 0.67 | 1.19 |
| 2018 | 12 | -0.83 | -0.4 |
| 2019 | 12 | -0.9 | -0.46 |
| 2020 | 12 | -1.05 | -0.92 |
| 2021 | 12 | -0.31 | -0.06 |
| 2022 | 12 | -0.11 | 0.16 |
| 2023 | 12 | -1.8 | -1.28 |
| 2024 | 12 | -0.22 | 0.23 |
| 2025 | 12 | -0.26 | 0.25 |
| 2026 | 10 | -0.72 | -0.3 |

## Which markets drive it (each leg's share of the book's net R, base costs)

- Decisive, largest contributions: sg30 long +0.36R, hk33 long +0.3R, us2000 long +0.15R, sg30 short +0.03R, de40 long -0.03R.
- Decisive, largest drags: nas100 short -1.73R, spx500 short -0.69R, us30 short -0.6R, cn50 long -0.5R, jp225 short -0.47R.
- Replication, largest contributions: jp225 long +0.69R, de40 short +0.36R, sg30 short +0.35R, ch20 long +0.19R, cn50 long +0.16R; largest drags: nas100 short -1.19R, us2000 short -0.52R, uk100 long -0.42R, us30 long -0.39R, jp225 short -0.38R.
- Times picked in the decisive cohorts: nas100 0 long / 123 short; sg30 90 long / 1 short; cn50 45 long / 34 short; hk33 69 long / 0 short; es35 36 long / 29 short; spx500 0 long / 52 short; ch20 47 long / 0 short; uk100 40 long / 0 short; jp225 0 long / 35 short; in50 0 long / 34 short; us30 0 long / 33 short; eu50 24 long / 6 short; fr40 11 long / 15 short; au200 19 long / 0 short; de40 5 long / 11 short; us2000 4 long / 11 short; nl25 0 long / 6 short.
- Legs: decisive 780 (stop 605, time 125, stop-gap 30, data-end 5, open 15; 0 not entered); replication 696 (stop 506, stop-gap 44, time 146; 0 not entered).

## Named variants (reported only, not judged)

| Lookback | Window | Months | Mean net R a month | NW t | Total R | Worst drawdown R |
|---|---|---|---|---|---|---|
| 12 months | decisive | 130 | -0.0366 | -2.91 | -4.75 | -5.67 |
| 12 months | replication from 2004-05 | 140 | -0.0151 | -0.78 | -2.11 | -2.97 |
| 60 months | decisive | 130 | -0.0452 | -2.97 | -5.87 | -6.77 |
| 60 months | replication from 2008-05 | 92 | -0.0167 | -0.73 | -1.54 | -3.19 |

## What it means, and what it does not

- The rule does not clear the pre-registered bar: on this universe, from 2016, buying the three indices that fell (or rose least) over three years and shorting the three that rose most is not an edge after costs. Never call it one; not a council rule, no proposal written, nothing live changed.
- Post hoc reading, not a test: the real book did worse than 39 of 40 random orderings. Over 2016-now the three-year winners kept winning (NAS100 was short in 123 decisive cohorts and is the largest drag), so fading them lost; this is not evidence that following them is an edge (`dual-momentum` and `index-spread-momentum` found none).
- Few independent observations: a 12-month hold gives about 10.83 non-overlapping years in the decisive window and 9.67 in the replication window. The overlapping monthly book has 130 and 116 months, but neighbouring months share 11 of 12 cohorts, which is why the t uses 12 Newey-West lags; even so, a 36-month signal changes slowly, so the same few markets sit on each side for years (see the picks above) and the result rests on a handful of national stories.
- The universe overlaps (US30 / SPX500 / NAS100 / US2000; EU50 / DE40 / FR40 / NL25 / ES35), so a "bottom 3" can be three versions of one market; there are fewer independent countries than 17 markets.
- Price CFDs without dividends: high-yield markets (UK100, AU200, ES35) are understated against low-yield ones (NAS100) over three years; currency effects are left in each leg's own currency; the papers used dollar total returns of MSCI indices. This is the claim as a CFD trader could run it, not a replication of the papers' data.
- Financing is charged on shorts as well (conservative); the "gross" rows show the result with no cost at all. The 1R stop at 3 x ATR(20) cuts many legs before their 12 months: the papers held without stops.

To repeat: `node research/edge/index-long-reversal/run.mjs fetch <dir>` (git show from origin/council-data, no network; candles kept out of git), then `node research/edge/index-long-reversal/run.mjs full <dir>`. Tests: `tests/index-long-reversal.test.mjs`.
