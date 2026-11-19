# Result: betting against beta within asset classes (14 Nov 2026)

**Verdict: FAIL, 0 of 4 tests pass: betting against beta within commodities and FX is not an edge after costs (OOS 2017-26 -0.167 % a month, n 118, t -0.52).** Pre-registered in [PREREGISTRATION.md](PREREGISTRATION.md) (committed alone and pushed first). Paper research only; nothing live changed.

Claim: Frazzini & Pedersen (2014), Betting Against Beta: within an asset class, low-beta markets earn higher risk-adjusted returns than high-beta ones; long low-beta levered to beta 1, short high-beta delevered to beta 1.

Related: `index-low-vol` (branch, FAIL) ranked 17 index CFDs by total volatility, so the indices are a reported group here, not part of the primary test; `commodity-xs-momentum` and `fx-xs-momentum` (branches, FAIL) used the same market sets and cost assumptions with a momentum signal.

Data: OANDA mid daily candles (council-data research/daily/*.json, weekend stubs folded with `foldWeekend`): commodities xau xag xpt xpd xcu bco wtico natgas corn wheat soybn sugar; FX eurusd gbpusd audusd nzdusd usdjpy usdcad usdchf (usdjpy, usdcad, usdchf inverted: each market is the currency against the dollar); indices au200 ch20 cn50 de40 es35 eu50 fr40 hk33 in50 jp225 nas100 nl25 sg30 spx500 uk100 us2000 us30. DGS2 from council-data macro/cache.json for index financing.

Rule: at each month end, within each group, beta = OLS slope of a market's daily return on the group's equal-weighted average over the last 250 common days, shrunk 0.6 x beta + 0.4; long the low-beta half at 1 / (n x mean low beta) of the book each, short the high-beta half at 1 / (n x mean high beta) each (each leg ex-ante beta 1), each position capped at 3 x its inverse-ATR size; enter at the next open, stop 3 x ATR(20), out at the close of the next month. Figures are % of the book a month. Costs: round trip indices 0.04 %, commodities 0.06 % (gold $0.30, silver $0.03), FX 2 pips; financing a night on every position, longs and shorts: indices (DGS2 + 2.5 %) / 365, commodities 3 % a year, FX 0.004 %.

## Against the bar (OOS 2017-01 to 2026-10, net at base costs; Holm over P, C, F, I)

| Test | OOS mean > 0 | OOS t >= 2 | Holm (one-sided p) | IS mean > 0 | OOS at 2x costs > 0 | Above placebo 95th pct | Pass |
|---|---|---|---|---|---|---|---|
| P (primary): commodities + FX, equal weight | no (-0.1673) | no (-0.52) | no (p 0.699) | no (-0.0678) | no (-0.5709) | no (against -0.1642) | no |
| C: commodities | no (-0.1823) | no (-0.31) | no (p 0.6202) | no (-0.0299) | no (-0.7463) | yes (against -0.2368) | no |
| F: FX | no (-0.1522) | no (-1.1) | no (p 0.8654) | no (-0.0698) | no (-0.3955) | no (against 0.0184) | no |
| I: indices (reported group) | no (-1.0401) | no (-4.72) | no (p 1) | no (-0.828) | no (-1.7879) | no (against -0.7209) | no |

## P (primary): commodities + FX, equal weight

| Window, cost | Months | Mean (% of the book a month) | t (months) | NW t (3 lags) | Total | Worst drawdown | Sharpe (a year) | Months up |
|---|---|---|---|---|---|---|---|---|
| **OOS 2017-01 to 2026-10, net (1x)** | 118 | -0.1673 | -0.52 | -0.48 | -19.74 | -58.4 | -0.17 | 43 % |
| OOS, gross (0x) | 118 | 0.2364 | 0.73 | 0.68 | 27.89 | -30.43 | 0.23 | 45 % |
| OOS, 2x costs | 118 | -0.5709 | -1.79 | -1.67 | -67.36 | -101.71 | -0.57 | 37 % |
| **IS 2004-04 to 2016-12, net (1x)** | 153 | -0.0678 | -0.29 | -0.28 | -10.37 | -26.37 | -0.08 | 46 % |
| IS, gross (0x) | 153 | 0.3234 | 1.36 | 1.31 | 49.48 | -17.16 | 0.38 | 55 % |
| IS, 2x costs | 153 | -0.459 | -1.95 | -1.87 | -70.23 | -70.23 | -0.54 | 43 % |

Costs a month (base, OOS): spread 0.0869 + financing 0.3167 (% of the book).

## C: commodities

| Window, cost | Months | Mean (% of the book a month) | t (months) | NW t (3 lags) | Total | Worst drawdown | Sharpe (a year) | Months up |
|---|---|---|---|---|---|---|---|---|
| **OOS 2017-01 to 2026-10, net (1x)** | 118 | -0.1823 | -0.31 | -0.28 | -21.51 | -96.25 | -0.1 | 43 % |
| OOS, gross (0x) | 118 | 0.3816 | 0.64 | 0.58 | 45.03 | -59.38 | 0.2 | 48 % |
| OOS, 2x costs | 118 | -0.7463 | -1.26 | -1.15 | -88.06 | -155.98 | -0.4 | 39 % |
| **IS 2004-04 to 2016-12, net (1x)** | 153 | -0.0299 | -0.07 | -0.07 | -4.57 | -44.1 | -0.02 | 52 % |
| IS, gross (0x) | 153 | 0.5079 | 1.2 | 1.22 | 77.71 | -34.47 | 0.34 | 57 % |
| IS, 2x costs | 153 | -0.5676 | -1.36 | -1.38 | -86.85 | -96.24 | -0.38 | 45 % |

Costs a month (base, OOS): spread 0.1316 + financing 0.4324 (% of the book).

## F: FX

| Window, cost | Months | Mean (% of the book a month) | t (months) | NW t (3 lags) | Total | Worst drawdown | Sharpe (a year) | Months up |
|---|---|---|---|---|---|---|---|---|
| **OOS 2017-01 to 2026-10, net (1x)** | 118 | -0.1522 | -1.1 | -1.23 | -17.96 | -32.31 | -0.35 | 48 % |
| OOS, gross (0x) | 118 | 0.0911 | 0.66 | 0.73 | 10.75 | -17.32 | 0.21 | 51 % |
| OOS, 2x costs | 118 | -0.3955 | -2.89 | -3.21 | -46.67 | -50.91 | -0.92 | 41 % |
| **IS 2003-05 to 2016-12, net (1x)** | 164 | -0.0698 | -0.43 | -0.42 | -11.44 | -23.16 | -0.12 | 44 % |
| IS, gross (0x) | 164 | 0.1722 | 1.06 | 1.03 | 28.25 | -15.85 | 0.29 | 46 % |
| IS, 2x costs | 164 | -0.3117 | -1.93 | -1.87 | -51.12 | -61.17 | -0.52 | 39 % |

Costs a month (base, OOS): spread 0.0423 + financing 0.201 (% of the book).

## I: indices (reported group)

| Window, cost | Months | Mean (% of the book a month) | t (months) | NW t (3 lags) | Total | Worst drawdown | Sharpe (a year) | Months up |
|---|---|---|---|---|---|---|---|---|
| **OOS 2017-01 to 2026-10, net (1x)** | 118 | -1.0401 | -4.72 | -4.96 | -122.74 | -126.3 | -1.5 | 32 % |
| OOS, gross (0x) | 118 | -0.2924 | -1.32 | -1.4 | -34.5 | -53.04 | -0.42 | 45 % |
| OOS, 2x costs | 118 | -1.7879 | -8.08 | -8.23 | -210.97 | -212.05 | -2.58 | 18 % |
| **IS 2004-04 to 2016-12, net (1x)** | 153 | -0.828 | -5.06 | -5.72 | -126.69 | -126.69 | -1.42 | 32 % |
| IS, gross (0x) | 153 | -0.1687 | -1.02 | -1.15 | -25.81 | -33.71 | -0.29 | 52 % |
| IS, 2x costs | 153 | -1.4874 | -8.99 | -9.73 | -227.56 | -227.56 | -2.52 | 21 % |

Costs a month (base, OOS): spread 0.0814 + financing 0.6663 (% of the book).

## All three groups, equal weight (reported only)

| Window, cost | Months | Mean (% of the book a month) | t (months) | NW t (3 lags) | Total | Worst drawdown | Sharpe (a year) | Months up |
|---|---|---|---|---|---|---|---|---|
| **OOS 2017-01 to 2026-10, net (1x)** | 118 | -0.4582 | -1.89 | -1.72 | -54.07 | -78.52 | -0.6 | 39 % |
| OOS, gross (0x) | 118 | 0.0601 | 0.25 | 0.22 | 7.09 | -32 | 0.08 | 47 % |
| OOS, 2x costs | 118 | -0.9766 | -4.05 | -3.7 | -115.23 | -133.56 | -1.29 | 29 % |
| **IS 2004-04 to 2016-12, net (1x)** | 153 | -0.3212 | -1.8 | -1.78 | -49.14 | -49.14 | -0.5 | 43 % |
| IS, gross (0x) | 153 | 0.1594 | 0.89 | 0.88 | 24.38 | -13.44 | 0.25 | 53 % |
| IS, 2x costs | 153 | -0.8018 | -4.5 | -4.46 | -122.67 | -122.67 | -1.26 | 35 % |

Costs a month (base, OOS): spread 0.0851 + financing 0.4332 (% of the book).

## The groups (OOS)

| Group | Positions | Capped | Exits | Mean shrunk beta, Low / High | Mean gross notional (books) |
|---|---|---|---|---|---|
| Commodities | 1416 | 9 | time 970, stop 434, stop-gap 12 | 0.783 / 1.214 | 2.112 |
| FX (currency against the dollar) | 708 | 0 | time 488, stop 219, stop-gap 1 | 0.866 / 1.143 | 2.034 |
| Indices (reported group) | 1888 | 1 | stop 624, time 1234, stop-gap 29, data-end 1 | 0.886 / 1.113 | 2.028 |

- Commodities, median raw beta (OOS formations): xau 0.416, soybn 0.637, sugar 0.664, corn 0.686, xcu 0.81, xag 0.952, wheat 0.959, xpt 1.013, xpd 1.326, natgas 1.369, bco 1.417, wtico 1.515. Months in each half: soybn 113 Low / 5 High; xau 110 Low / 8 High; sugar 101 Low / 17 High; corn 93 Low / 25 High; xcu 93 Low / 25 High; wheat 62 Low / 56 High; xag 56 Low / 62 High; xpt 39 Low / 79 High; bco 19 Low / 99 High; xpd 14 Low / 104 High; natgas 5 Low / 113 High; wtico 3 Low / 115 High.
- FX (currency against the dollar), median raw beta (OOS formations): usdcad 0.746, usdchf 0.882, usdjpy 0.886, eurusd 0.911, gbpusd 1.011, audusd 1.289, nzdusd 1.321. Months in each half: usdcad 106 Low / 0 High; usdchf 86 Low / 12 High; usdjpy 71 Low / 28 High; eurusd 58 Low / 19 High; gbpusd 29 Low / 71 High; audusd 4 Low / 106 High; nzdusd 0 Low / 118 High.
- Indices (reported group), median raw beta (OOS formations): ch20 0.723, cn50 0.781, au200 0.788, uk100 0.79, es35 0.807, sg30 0.817, in50 0.847, us30 0.957, spx500 1.025, nl25 1.032, hk33 1.041, fr40 1.059, de40 1.12, eu50 1.159, jp225 1.174, nas100 1.268, us2000 1.303. Months in each half: ch20 109 Low / 9 High; au200 103 Low / 6 High; sg30 102 Low / 16 High; uk100 100 Low / 17 High; es35 89 Low / 14 High; cn50 91 Low / 27 High; in50 55 Low / 8 High; us30 74 Low / 44 High; spx500 45 Low / 67 High; hk33 43 Low / 69 High; nl25 41 Low / 74 High; jp225 33 Low / 85 High; fr40 26 Low / 80 High; nas100 18 Low / 98 High; de40 9 Low / 109 High; eu50 4 Low / 105 High; us2000 2 Low / 116 High.

## Placebo (random halves each month within each group, same construction and costs; OOS, 40 seeded draws)

| Test | Real mean | Draws median | 5th pct | 95th pct | Draws at or above the real |
|---|---|---|---|---|---|
| P | -0.1673 | -0.4813 | -0.7214 | -0.1642 | 3 of 40 |
| C | -0.1823 | -0.7779 | -1.3102 | -0.2368 | 1 of 40 |
| F | -0.1522 | -0.1736 | -0.3211 | 0.0184 | 16 of 40 |
| I | -1.0401 | -0.9228 | -1.0906 | -0.7209 | 36 of 40 |

## Variant: the paper's beta (reported only, not judged)

| Test | Window | Months | Mean net | t | NW t | Total | Worst drawdown |
|---|---|---|---|---|---|---|---|
| P | IS | 129 | -0.1422 | -0.51 | -0.51 | -18.34 | -41.29 |
| P | OOS | 118 | -0.2453 | -0.92 | -0.9 | -28.94 | -46.84 |
| C | IS | 129 | -0.2173 | -0.44 | -0.45 | -28.03 | -82.2 |
| C | OOS | 118 | -0.2954 | -0.6 | -0.56 | -34.86 | -74.74 |
| F | IS | 140 | -0.0687 | -0.4 | -0.4 | -9.61 | -18.97 |
| F | OOS | 118 | -0.1951 | -1.33 | -1.47 | -23.03 | -38.92 |
| I | IS | 129 | -0.7833 | -4.18 | -4.52 | -101.05 | -103.7 |
| I | OOS | 118 | -1.0094 | -4.83 | -4.81 | -119.11 | -121.27 |

## Per year (net at 1x, % of the book, summed over the year's months)

| Year | P | C | F | I |
|---|---|---|---|---|
| 2003 |  |  | 8.02 |  |
| 2004 | -7.73 | -13.13 | -5.59 | -16.43 |
| 2005 | -6.82 | -9.65 | -3.97 | -7.1 |
| 2006 | 15.33 | 36.51 | -5.87 | -8.64 |
| 2007 | -1.06 | -2.79 | 0.69 | -17.68 |
| 2008 | 15.75 | 16.77 | 14.72 | -13.09 |
| 2009 | -18.98 | -27.85 | -10.09 | 4.07 |
| 2010 | 8.26 | 12.93 | 3.57 | -1.72 |
| 2011 | -6.2 | -10.71 | -1.67 | -18.06 |
| 2012 | 2.67 | 8.54 | -3.16 | -7.02 |
| 2013 | -4.32 | -5.92 | -2.7 | -16.26 |
| 2014 | -3.73 | -3.17 | -4.25 | 1.88 |
| 2015 | -0.33 | 0.5 | -1.16 | -15.31 |
| 2016 | -3.24 | -6.57 | 0.09 | -11.36 |
| 2017 | -5.19 | -12.46 | 2.07 | 1.66 |
| 2018 | -0.85 | -3.29 | 1.58 | -9.11 |
| 2019 | -4.54 | -11.63 | 2.55 | -12.4 |
| 2020 | 5.74 | 19.44 | -7.92 | -6.46 |
| 2021 | -5.92 | -5.13 | -6.71 | -16.28 |
| 2022 | -20.09 | -35.55 | -4.65 | -15.65 |
| 2023 | -0.78 | 1.34 | -2.89 | -17.29 |
| 2024 | -6.22 | -9.41 | -3.05 | -24.36 |
| 2025 | -13.88 | -28.83 | 1.06 | -15.59 |
| 2026 | 31.99 | 63.94 | 0.02 | -7.26 |

## What it means, and what it does not

- The primary test does not clear the pre-registered bar: on these OANDA CFDs, long the low-beta half levered to a beta of 1 against the high-beta half within commodities and within the dollar pairs is not an edge after costs. Never call it one; not a council rule, no proposal written, nothing live changed.
- Post hoc reading, not a test: before any cost the primary book was positive in both windows (OOS 0.2364 % a month, t 0.73; IS 0.3234, t 1.36), commodities (0.3816, t 0.64) and FX (0.0911, t 0.66) alike, and never significant; the book holds about two books of gross notional and pays 0.3167 % a month of financing and 0.0869 % of spread, which turns it negative. Indices lose before costs too (OOS -0.2924, t -1.32), as `index-low-vol` found for low volatility. The commodity placebo's random halves lose more than the beta halves (the real C is above 39 of 40 draws), but the real book is still negative net, and its 2026 gain (see per year) is one year in eleven.
- The halves are small (6 and 3 markets a side in commodities and FX, up to 8 in indices) and stable for long stretches (months in each half above), so the monthly t overstates the number of independent bets in either direction.
- The low-beta side is levered (its notional is about 1 / its mean shrunk beta) and every position pays financing, longs and shorts alike: the gross rows show the result before any cost. Daily betas across markets closing at different hours are biased toward zero (the paper-beta variant uses 3-day correlations for that reason). No dividends on indices, no FX carry beyond the flat financing, CFD prices on commodities, and a 3 x ATR(20) stop on every position (the paper held without stops): this is the claim as a CFD trader could run it, not a replication of the paper's data.

To repeat: `node research/edge/xs-bab/run.mjs fetch <dir>` (git show from origin/council-data, no network; candles kept out of git), then `node research/edge/xs-bab/run.mjs full <dir>`. Tests: `tests/xs-bab.test.mjs`.
