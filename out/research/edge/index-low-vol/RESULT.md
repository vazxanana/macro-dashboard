# Result: the low-volatility anomaly across national stock indices (14 Nov 2026)

**Verdict: FAIL, 0 of 2 tests pass: holding the three least volatile national indices against the three most volatile is not an edge after costs (T1 equal risk long / short -0.094R a month, NW t -2.69; T2 equal-volatility long books, spread -0.059 % a month, NW t -0.41, decisive 2016-now).** Pre-registered in [PREREGISTRATION.md](PREREGISTRATION.md) (committed alone and pushed first). Paper research only; nothing live changed.

Claim: Blitz & van Vliet (2007); Frazzini & Pedersen (2014): low-volatility assets, country indices included, earn better risk-adjusted returns than high-volatility ones.

Related: `index-long-reversal` (branch, FAIL) used the same 17 index CFDs, the same cost model and the same 3 x ATR(20) stop with a 36-month return signal; its code is copied here, not imported. `vol-managed-index` (branch, FAIL) tested volatility TARGETING of one index through time; this study is cross-sectional (which indices against which).

Data: OANDA mid daily candles of au200, ch20, cn50, de40, es35, eu50, fr40, hk33, in50, jp225, nas100, nl25, sg30, spx500, uk100, us2000, us30 (council-data research/daily/*.json, weekend stubs folded with `foldWeekend`), each in its own quote currency, not converted; price CFDs without dividends. DGS2 from council-data macro/cache.json `score.fred.DGS2`, a fixed 4 % before its first value.

Rule: at each month end rank the markets with a fresh close and 13 months of history (150+ daily returns) by the sample sd of their daily log returns over the past 12 months; Low = the 3 lowest, High = the 3 highest; enter at the next open, stop 3 x ATR(20) from the entry (gap fills at the open), out at the close of the next month; rebalance monthly. **T1**: long Low, short High, each leg 1R = the stop distance; book R = mean leg R. **T2**: two long-only books, each leg weighted 1 % / (sigma x sqrt 21) of a notional book (1 % of the book a month per leg), same stop; figure = Low book return - High book return in % of the book. Costs: 0.04 % of price a leg round trip, financing (DGS2 + 2.5 %) / 365 a rollover night on every leg, longs and shorts alike.

## T1: equal risk, long Low 3 / short High 3

| Window, cost | Months | Mean (R a month) | NW t (3 lags) | Plain t | Total | Worst drawdown | Sharpe (a year) | Months up |
|---|---|---|---|---|---|---|---|---|
| **Decisive 2016-01 to 2026-10, net (1x)** | 130 | -0.0937 | -2.69 | -2.56 | -12.18 | -13.44 | -0.78 | 39 % |
| Decisive, gross (0x) | 130 | -0.0045 | -0.13 | -0.12 | -0.59 | -5.7 | -0.04 | 49 % |
| Decisive, 2x costs | 130 | -0.1829 | -5.21 | -5.07 | -23.78 | -24.57 | -1.54 | 31 % |
| **Replication 2004-04 to 2015-12, net (1x)** | 141 | -0.1305 | -4.64 | -4.91 | -18.4 | -18.4 | -1.43 | 32 % |
| Replication, gross (0x) | 141 | -0.0481 | -1.72 | -1.8 | -6.78 | -7.5 | -0.53 | 43 % |
| Replication, 2x costs | 141 | -0.2129 | -6.95 | -7.85 | -30.01 | -30.01 | -2.29 | 23 % |

Costs a month (base, decisive): spread 0.0102 + financing 0.079 (R).

Legs: decisive 780 (stop 251, time 517, stop-gap 12); replication 846 (time 571, stop-gap 24, stop 251).

## T2: equal volatility contribution, long Low 3 book minus long High 3 book

| Window, cost | Months | Mean (% of the book a month) | NW t (3 lags) | Plain t | Total | Worst drawdown | Sharpe (a year) | Months up |
|---|---|---|---|---|---|---|---|---|
| **Decisive 2016-01 to 2026-10, net (1x)** | 130 | -0.0593 | -0.41 | -0.37 | -7.71 | -30.56 | -0.11 | 49 % |
| Decisive, gross (0x) | 130 | 0.0696 | 0.47 | 0.42 | 9.05 | -21.19 | 0.13 | 50 % |
| Decisive, 2x costs | 130 | -0.1883 | -1.34 | -1.2 | -24.48 | -40.92 | -0.37 | 48 % |
| **Replication 2004-04 to 2015-12, net (1x)** | 141 | -0.2859 | -1.9 | -2.11 | -40.31 | -46.51 | -0.62 | 44 % |
| Replication, gross (0x) | 141 | -0.178 | -1.16 | -1.29 | -25.09 | -40.66 | -0.38 | 48 % |
| Replication, 2x costs | 141 | -0.3938 | -2.65 | -2.97 | -55.52 | -56.28 | -0.87 | 40 % |

Costs a month (base, decisive): spread 0.0518 + financing 0.422 (% of the book).

Each long book alone (net at 1x, % of the book a month):

| Book | Window | Months | Mean | NW t | Total | Worst drawdown | Sharpe (a year) |
|---|---|---|---|---|---|---|---|
| Low 3 | decisive | 130 | 0.0081 | 0.04 | 1.05 | -27.96 | 0.01 |
| High 3 | decisive | 130 | 0.0674 | 0.49 | 8.77 | -12.61 | 0.13 |
| Low 3 | replication | 141 | -0.2454 | -1.26 | -34.59 | -44.26 | -0.38 |
| High 3 | replication | 141 | 0.0405 | 0.24 | 5.71 | -24.95 | 0.07 |

Legs: decisive 780 (stop 228, time 542, stop-gap 10); replication 846 (time 578, stop 235, stop-gap 33).

## Against the bar

| Test | Decisive mean > 0 | Replication mean > 0 | Decisive NW t >= 2 | Holm (one-sided p) | Above placebo 95th pct | Pass |
|---|---|---|---|---|---|---|
| T1 | no (-0.0937) | no (-0.1305) | no (-2.69) | no (p 0.9964) | no (-0.0937 against -0.0798) | no |
| T2 | no (-0.0593) | no (-0.2859) | no (-0.41) | no (p 0.6591) | no (-0.0593 against 0.2015) | no |

## Placebo (random order of the ranked markets each month, same construction and costs; decisive window, 40 seeded draws)

| Test | Real mean | Draws median | 5th pct | 95th pct | Draws at or above the real |
|---|---|---|---|---|---|
| T1 | -0.0937 | -0.1086 | -0.1359 | -0.0798 | 10 of 40 |
| T2 | -0.0593 | 0.0497 | -0.1695 | 0.2015 | 29 of 40 |

## Variant: 6-month volatility window (reported only, not judged)

| Test | Window | Months | Mean net | NW t | Total | Worst drawdown | Sharpe (a year) |
|---|---|---|---|---|---|---|---|
| T1 | decisive | 130 | -0.0961 | -2.83 | -12.49 | -14.45 | -0.85 |
| T1 | replication from 2003-10 | 147 | -0.1299 | -5.25 | -19.1 | -19.53 | -1.5 |
| T2 | decisive | 130 | -0.064 | -0.42 | -8.32 | -24.99 | -0.12 |
| T2 | replication from 2003-10 | 147 | -0.2556 | -1.85 | -37.58 | -42.39 | -0.57 |

## Per year (net at 1x, summed over the year's months; T1 in R, T2 in % of the book)

| Year | Months | T1 | T2 |
|---|---|---|---|
| 2004 | 9 | -2.1 | -2.76 |
| 2005 | 12 | -0.89 | 0.45 |
| 2006 | 12 | -1.72 | 2.54 |
| 2007 | 12 | -3.63 | -9.88 |
| 2008 | 12 | 0.19 | -6.28 |
| 2009 | 12 | 0.23 | 3.05 |
| 2010 | 12 | -1.05 | -2.49 |
| 2011 | 12 | -1.38 | -2.55 |
| 2012 | 12 | -2.05 | -3.06 |
| 2013 | 12 | 0.2 | 4.07 |
| 2014 | 12 | -3.94 | -19.83 |
| 2015 | 12 | -2.27 | -3.57 |
| 2016 | 12 | -1.49 | 1.29 |
| 2017 | 12 | 0.25 | 8.74 |
| 2018 | 12 | -0.21 | 0.28 |
| 2019 | 12 | -1.69 | -3.33 |
| 2020 | 12 | -0.11 | -2.67 |
| 2021 | 12 | -0.24 | 4.77 |
| 2022 | 12 | -1.22 | -8.97 |
| 2023 | 12 | -2.39 | -9.44 |
| 2024 | 12 | -3.35 | -4.62 |
| 2025 | 12 | -1.83 | 2.07 |
| 2026 | 10 | 0.11 | 4.17 |

## Which markets drive it (decisive, each leg's share of the net result, base costs)

- T1 (R), largest contributions: us30 long +1.8, jp225 long +1.415, spx500 long +0.845, cn50 long +0.651, hk33 short +0.437; largest drags: nas100 short -4.224, us2000 short -3.293, jp225 short -1.83, ch20 long -1.597, uk100 long -1.491.
- T2 (% of the book; a "high" leg's sign is flipped, it is the subtracted book), largest contributions: hk33 high +9.989, us30 low +8.26, jp225 low +5.396, spx500 low +4.779, cn50 low +3.057; largest drags: ch20 low -9.872, nas100 high -8.44, uk100 low -8.388, us2000 high -4.745, in50 high -4.123.
- Months in each book (decisive, 130 months): uk100 89 Low / 0 High; hk33 5 Low / 82 High; au200 86 Low / 0 High; ch20 78 Low / 0 High; us2000 0 Low / 74 High; cn50 3 Low / 69 High; nas100 0 Low / 68 High; jp225 12 Low / 41 High; us30 52 Low / 0 High; spx500 26 Low / 0 High; fr40 0 Low / 20 High; sg30 19 Low / 0 High; in50 8 Low / 11 High; eu50 0 Low / 15 High; nl25 10 Low / 0 High; de40 0 Low / 6 High; es35 2 Low / 4 High.
- Median trailing 12-month volatility, annualised % (decisive formations): au200 12.34, uk100 12.58, ch20 13.32, sg30 14.48, us30 14.86, spx500 15.08, nl25 15.16, in50 15.31, fr40 16.07, es35 16.3, de40 16.32, eu50 16.42, jp225 19.05, us2000 20.09, nas100 20.09, cn50 22.39, hk33 22.85.

## What it means, and what it does not

- Neither test clears the pre-registered bar: on these 17 index CFDs, from 2016, holding the least volatile indices against the most volatile ones is not an edge after costs, whether each leg risks the same (T1) or contributes the same volatility (T2). Never call it one; not a council rule, no proposal written, nothing live changed.
- The ranking is very stable: the same markets sit in the same book for years (see the months in each book above), so the result rests on a few national stories rather than on 130 independent bets, and the monthly t overstates the evidence in either direction.
- The universe overlaps (US30 / SPX500 / NAS100 / US2000; EU50 / DE40 / FR40 / NL25 / ES35): a Low or High book can hold two or three versions of one market, so there are fewer independent countries than 17.
- Price CFDs without dividends and in local currency: low-volatility markets with high dividend yields (CH20, UK100, AU200) are understated against low-yield ones, and currency moves are left in each leg. The papers used dollar total returns (and, for Frazzini and Pedersen, beta rather than total volatility, with leverage on the low-beta side); this is the claim as a CFD trader could run it, not a replication of their data.
- T1 already gives each leg the same risk, so it is a test of return per unit of risk across the two groups, long / short; T2 holds both groups long at the same volatility, so its spread is the same question without shorting. At equal volatility the Low book holds more notional than the High book (about 1.6 times, by the median volatilities above), so it pays more financing: part of T2's cost gap is that, not the anomaly. Financing is charged on shorts too in T1 (conservative); the gross rows show each result with no cost at all. Every leg has a stop at 3 x ATR(20): the papers held without stops.
- Post hoc reading, not a test: before costs T1 is close to zero in the decisive window (-0.0045R a month, t -0.13) and negative in the replication window (-0.0481R, t -1.72); the net loss is mostly the cost of holding six legs a month. In T2 the High book did better than the Low book in both windows (decisive 0.0674 against 0.0081 % a month; replication 0.0405 against -0.2454). No sign of the anomaly on these markets in either window.

To repeat: `node research/edge/index-low-vol/run.mjs fetch <dir>` (git show from origin/council-data, no network; candles kept out of git), then `node research/edge/index-low-vol/run.mjs full <dir>`. Tests: `tests/index-low-vol.test.mjs`.
