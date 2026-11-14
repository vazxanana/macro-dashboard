# Time-series momentum across asset classes: result

**Verdict: FAIL.** All 25 markets pooled: −1.389R a month net in 2016-26 (t −1.44, Sharpe −0.44, worst drawdown −232.0R, 3250 positions) and +0.288R in 2008-15 (t +0.23); 0 of 5 tests pass.

Paper research only. No live rule, size, filter, council member or page was changed. Rule, costs, windows, tests and
verdict were fixed in `PREREGISTRATION.md` (commit ce86df944) before any position was simulated.

## What was tested

Each month, at the last daily close of the month, every one of 25 OANDA markets (council-data daily cache, weekend stubs folded into Monday) gets the sign of its 12-1 month return (`close[t-21] / close[t-252] - 1`); the position opens at the next daily open, 1R = 2 x ATR(63) of past candles, the stop at 1R on the losing side (a stopped market is flat to the next rebalance), closed at the next month-end close. Equal risk: one R per market. Net of a full round trip every month and financing every night (longs 2.5 % + the US 2-year yield, shorts 2.5 % − it floored at 0; currencies the rate differential less a 1 % markup). Portfolio = the sum of the month's R; statistics on monthly sums. Decisive window 2016-01 to 2026-10, replication 2008-01 to 2015-12. Data to 2026-11-06.

Markets dropped: none (every file starts before 2008).

## The five tests

| Test | Window | Months | Positions | Net R a month | Month-sum t | Sharpe | Total R | Worst drawdown R | Placebo t p5 / p50 / p95 / max |
|---|---|---|---|---|---|---|---|---|---|
| T1 All 25 markets | 2016-26 | 130 | 3250 | −1.389 | −1.44 | −0.44 | −180.5 | −232.0 | −4.19 / −2.92 / −1.88 / −1.28 |
| T1 All 25 markets | 2008-15 | 96 | 2397 | +0.288 | +0.23 | +0.08 | +27.6 | −104.6 | −1.82 / −0.85 / +0.12 / +0.52 |
| T2 Indices | 2016-26 | 130 | 910 | −0.185 | −0.39 | −0.12 | −24.1 | −77.4 | −2.53 / −1.64 / −0.85 / −0.30 |
| T2 Indices | 2008-15 | 96 | 670 | −0.090 | −0.14 | −0.05 | −8.7 | −55.2 | −2.84 / −1.51 / −0.36 / +0.36 |
| T3 Bonds | 2016-26 | 130 | 390 | −0.239 | −0.78 | −0.24 | −31.1 | −61.7 | −4.37 / −2.93 / −1.59 / −1.10 |
| T3 Bonds | 2008-15 | 96 | 288 | −0.843 | −2.96 | −1.05 | −80.9 | −82.0 | −4.44 / −2.62 / −0.91 / −0.31 |
| T4 Commodities | 2016-26 | 130 | 1040 | −0.801 | −1.86 | −0.57 | −104.1 | −121.8 | −3.13 / −1.83 / −0.61 / −0.12 |
| T4 Commodities | 2008-15 | 96 | 767 | +1.012 | +1.70 | +0.60 | +97.2 | −38.2 | −0.55 / +0.84 / +2.33 / +2.60 |
| T5 Forex | 2016-26 | 130 | 910 | −0.164 | −0.36 | −0.11 | −21.3 | −61.6 | −1.48 / −0.19 / +0.59 / +0.98 |
| T5 Forex | 2008-15 | 96 | 672 | +0.209 | +0.38 | +0.13 | +20.1 | −36.4 | −0.70 / +0.23 / +1.24 / +1.74 |

| Test | One-sided p (decisive) | Holm p | 1: decisive t ≥ 2 | 2: replication > 0 | 3: Holm < 0.05 | 4: above placebo p95 | 5: > 0 at x2 costs | Pass |
|---|---|---|---|---|---|---|---|---|
| T1 | 0.9251 | 1 | no | yes | no | yes | no | no |
| T2 | 0.6517 | 1 | no | no | no | yes | no | no |
| T3 | 0.7823 | 1 | no | no | no | yes | no | no |
| T4 | 0.9686 | 1 | no | yes | no | no | no | no |
| T5 | 0.6406 | 1 | no | yes | no | no | no | no |

## Before costs, without financing, at twice the costs (descriptive, never deciding)

| Test | Window | Gross R a month (t) | No financing (t) | Net (t) | Net at x2 costs (t) | Gross / cost / financing a position (R) | Long / short | Stops hit |
|---|---|---|---|---|---|---|---|---|
| T1 | 2016-26 | +0.835 (+0.84) | +0.151 (+0.15) | −1.389 (−1.44) | −3.613 (−3.83) | +0.033 / 0.027 / 0.062 | 1853 / 1397 | 1607 |
| T1 | 2008-15 | +2.071 (+1.61) | +1.484 (+1.15) | +0.288 (+0.23) | −1.495 (−1.19) | +0.083 / 0.024 / 0.048 | 1357 / 1040 | 1144 |
| T2 | 2016-26 | +0.549 (+1.11) | +0.467 (+0.94) | −0.185 (−0.39) | −0.919 (−2.04) | +0.078 / 0.012 / 0.093 | 683 / 227 | 430 |
| T2 | 2008-15 | +0.323 (+0.50) | +0.254 (+0.39) | −0.090 (−0.14) | −0.503 (−0.80) | +0.046 / 0.010 / 0.049 | 457 / 213 | 317 |
| T3 | 2016-26 | +0.420 (+1.34) | +0.119 (+0.38) | −0.239 (−0.78) | −0.899 (−2.99) | +0.140 / 0.100 / 0.119 | 152 / 238 | 185 |
| T3 | 2008-15 | −0.176 (−0.60) | −0.438 (−1.48) | −0.843 (−2.96) | −1.510 (−5.49) | −0.059 / 0.087 / 0.135 | 200 / 88 | 156 |
| T4 | 2016-26 | −0.266 (−0.61) | −0.496 (−1.14) | −0.801 (−1.86) | −1.336 (−3.15) | −0.033 / 0.029 / 0.038 | 582 / 458 | 538 |
| T4 | 2008-15 | +1.463 (+2.43) | +1.263 (+2.10) | +1.012 (+1.70) | +0.561 (+0.96) | +0.183 / 0.025 / 0.031 | 374 / 393 | 347 |
| T5 | 2016-26 | +0.132 (+0.29) | +0.060 (+0.13) | −0.164 (−0.36) | −0.459 (−1.00) | +0.019 / 0.010 / 0.032 | 436 / 474 | 454 |
| T5 | 2008-15 | +0.460 (+0.82) | +0.405 (+0.72) | +0.209 (+0.38) | −0.042 (−0.08) | +0.066 / 0.008 / 0.028 | 326 / 346 | 324 |

## Per market (net, descriptive)

| Market | Class | 2016-26 positions | total R | t | 2008-15 positions | total R | t |
|---|---|---|---|---|---|---|---|
| nas100 | indices | 130 | +24.1 | +1.57 | 96 | +2.2 | +0.18 |
| spx500 | indices | 130 | +12.5 | +0.82 | 96 | −4.5 | −0.39 |
| us30 | indices | 130 | −1.8 | −0.12 | 96 | −3.1 | −0.27 |
| de40 | indices | 130 | −11.2 | −0.80 | 96 | +4.7 | +0.42 |
| uk100 | indices | 130 | −20.4 | −1.61 | 96 | −3.8 | −0.34 |
| jp225 | indices | 130 | −6.1 | −0.39 | 96 | +1.5 | +0.11 |
| au200 | indices | 130 | −21.1 | −1.76 | 94 | −5.7 | −0.44 |
| usb10y | bonds | 130 | −28.4 | −1.86 | 96 | −22.0 | −1.90 |
| de10yb | bonds | 130 | −3.1 | −0.20 | 96 | −29.6 | −2.40 |
| uk10yb | bonds | 130 | +0.4 | +0.02 | 96 | −29.3 | −2.46 |
| xau | commodities | 130 | −10.5 | −0.70 | 96 | +25.5 | +1.78 |
| xag | commodities | 130 | +11.5 | +0.68 | 96 | +36.5 | +2.61 |
| bco | commodities | 130 | −10.0 | −0.75 | 96 | +23.3 | +1.78 |
| wtico | commodities | 130 | −13.1 | −0.99 | 96 | +14.8 | +1.17 |
| natgas | commodities | 130 | +7.5 | +0.43 | 96 | −11.8 | −1.04 |
| corn | commodities | 130 | −45.8 | −3.59 | 96 | +13.0 | +0.99 |
| wheat | commodities | 130 | −29.2 | −2.18 | 96 | −1.7 | −0.13 |
| soybn | commodities | 130 | −14.6 | −1.01 | 95 | −2.5 | −0.18 |
| eurusd | forex | 130 | −13.9 | −1.03 | 96 | −10.7 | −0.87 |
| gbpusd | forex | 130 | −7.0 | −0.50 | 96 | −15.1 | −1.17 |
| usdjpy | forex | 130 | +7.2 | +0.44 | 96 | +29.2 | +1.98 |
| audusd | forex | 130 | +5.8 | +0.39 | 96 | +8.4 | +0.62 |
| usdcad | forex | 130 | −4.0 | −0.29 | 96 | +13.8 | +0.89 |
| usdchf | forex | 130 | −7.0 | −0.48 | 96 | +2.1 | +0.17 |
| nzdusd | forex | 130 | −2.4 | −0.16 | 96 | −7.7 | −0.65 |

## By year (all 25 markets, R)

| Year | Positions | Gross | Net |
|---|---|---|---|
| 2008 | 300 | +78.8 | +60.4 |
| 2009 | 299 | −38.1 | −53.0 |
| 2010 | 300 | +56.7 | +35.7 |
| 2011 | 298 | −9.7 | −27.6 |
| 2012 | 300 | −23.9 | −45.5 |
| 2013 | 300 | +83.5 | +55.7 |
| 2014 | 300 | +16.4 | −11.4 |
| 2015 | 300 | +35.1 | +13.3 |
| 2016 | 300 | −49.2 | −71.4 |
| 2017 | 300 | −7.7 | −42.0 |
| 2018 | 300 | +7.7 | −20.8 |
| 2019 | 300 | +24.3 | −4.2 |
| 2020 | 300 | −11.7 | −36.7 |
| 2021 | 300 | +33.7 | +6.1 |
| 2022 | 300 | +32.8 | +22.0 |
| 2023 | 300 | −27.7 | −48.3 |
| 2024 | 300 | +25.4 | −5.8 |
| 2025 | 300 | +37.7 | +4.5 |
| 2026 | 250 | +43.5 | +16.2 |

## Reading

- T1 (all markets): −1.389R a month net in 2016-26 (t −1.44, 3250 positions, worst drawdown −232.0R) and +0.288R in 2008-15 (t +0.23); before any cost +0.835R (t +0.84) and +2.071R (t +1.61).
- The 2 x ATR(63) stop was hit on 1607 of 3250 positions in 2016-26 and 1144 of 2397 in 2008-15: over a month a 2-ATR stop is close to the typical move, so about half the positions are stopped before the month ends (the published rule has no stop; this one is the brief's).
- Costs a position, 2016-26: trading 0.027R, financing 0.062R, against a gross +0.033R.
- Placebo (40 random-sign books, same entries, stops and costs): T1 decisive t median −2.92, 95th percentile −1.88; 2 of 40 placebos reached the real t.
- T2 Indices: −0.185R a month 2016-26 (t −0.39), −0.090R 2008-15 (t −0.14).
- T3 Bonds: −0.239R a month 2016-26 (t −0.78), −0.843R 2008-15 (t −2.96).
- T4 Commodities: −0.801R a month 2016-26 (t −1.86), +1.012R 2008-15 (t +1.70).
- T5 Forex: −0.164R a month 2016-26 (t −0.36), +0.209R 2008-15 (t +0.38).
- Not an edge on these markets with these costs. Never call it one; nothing live changes, and a variant needs its own pre-registration on other data.

## Limits, said

- One full round trip is charged every month even when the sign does not change (conservative); stop exits pay that night's financing (conservative).
- The financing rule is the brief's single rule (2.5 % + the US 2-year yield) for every non-currency market whatever its currency, gold included (not the demo broker's measured gold swap). CAD, CHF and NZD policy rates are approximate yearly means written from memory; bond CFD costs are an assumption. The AUD policy rate (for AUD/USD) was left out of the pre-registration's list by oversight; it is taken from the same `index-spread-momentum` table as EUR, GBP and JPY (`rates.json` says so).
- Monthly closed R: drawdown inside a month is not shown. The placebo keeps each slot's entry, size and stop and only randomises the side.
- 2008-15 overlaps the samples of the published papers; 2016 on is mostly after them. Nothing was fitted on either window.

To repeat: `node research/edge/tsmom/run.mjs fetch <dir>` (git show from `origin/council-data`, no network), then `node research/edge/tsmom/run.mjs full <dir>`.
