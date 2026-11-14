# Result: Brent - WTI crude spread, log-spread z-score mean reversion (14 Nov 2026)

**Verdict: FAIL: fading a 2-sd stretch of the Brent - WTI spread is not an edge after costs.** Pre-registered in [PREREGISTRATION.md](PREREGISTRATION.md) (committed alone and pushed first). Entry |z| > 2: -0.199R a trade net on 2016-now (n 87, month-sum t -1.42), -0.297R on 2003-2015 (n 112). Nothing live changed.

Data: OANDA mid daily BCO_USD (Brent) and WTICO_USD (WTI), council-data research/daily/bco.json, wtico.json; weekend stubs folded with `foldWeekend`, legs joined on common days (5960 days, 2003-08-19 to 2026-11-06). Rule: s = ln(Brent) - ln(WTI) on daily closes, z over the last 60 closes; z > 2 shorts the spread (sell Brent, buy WTI), z < -2 buys it, equal notional, at the next open; stop when the spread moves a further 1.5 x the signal's 60-day sd against the entry (1R; checked on closes), exit at |z| < 0.5 or at the close of the 20th day; one position at a time. Costs (assumed, not measured): a round trip of 0.06 % of price on each leg and financing of 3 % a year on each leg as a cost, per rollover night.

## The pre-registered rule (entry |z| > 2), base costs

| Window | n | Gross R a trade | Spread cost | Financing | Net R a trade | Net total | Win % | PF | Month-sum t | Worst drawdown |
|---|---|---|---|---|---|---|---|---|---|---|
| 2016-now (decisive) | 87 | +0.060 | +0.089 | +0.171 | -0.199 | -17.34 | 48.28 | 0.70 | -1.42 | -24.55R |
| 2003-2015 (replication) | 112 | -0.133 | +0.056 | +0.108 | -0.297 | -33.29 | 43.75 | 0.55 | -2.44 | -39.47R |
| of which 2011-13 (Cushing glut, a known break) | 28 | -0.564 | +0.041 | +0.085 | -0.689 | -19.30 | 25.00 | 0.19 | -3.10 | -20.37R |
| replication without 2011-13 (reported only) | 84 | +0.011 | +0.062 | +0.116 | -0.167 | -13.99 | 50.00 | 0.72 | -1.21 | -19.10R |

## Against the bar

- Net R a trade > 0 on 2016-now: no (-0.199).
- Net R a trade > 0 on the replication window: no (-0.297).
- Month-sum t >= 2 on 2016-now: no (-1.42).
- n >= 40 on 2016-now: yes (87).
- Above the placebo's 95th percentile: no (-0.149).

## Placebo: random entry days (same count per year), random side, the same exits and costs (2016-now, 40 seeded draws)

| Real net R a trade | Draws median | 5th pct | 95th pct | Draws >= real |
|---|---|---|---|---|
| -0.199 | -0.249 | -0.401 | -0.149 | 8 of 40 |

## Cost sensitivity (net R a trade, month-sum t)

| Costs | 2016-now n | Net R | t | Replication n | Net R | t |
|---|---|---|---|---|---|---|
| 0 x (gross) | 87 | +0.060 | 0.44 | 112 | -0.133 | -1.13 |
| 1 x (base) | 87 | -0.199 | -1.42 | 112 | -0.297 | -2.44 |
| 2 x | 87 | -0.459 | -3.07 | 112 | -0.462 | -3.62 |

## Per year (entry year, base costs)

| Year | n | Gross R a trade | Net R a trade | Net total |
|---|---|---|---|---|
| 2003 | 3 | +0.016 | -0.142 | -0.43 |
| 2004 | 9 | +0.177 | -0.029 | -0.26 |
| 2005 | 10 | +0.107 | -0.085 | -0.85 |
| 2006 | 7 | -0.077 | -0.342 | -2.39 |
| 2007 | 9 | +0.136 | -0.019 | -0.17 |
| 2008 | 12 | -0.064 | -0.256 | -3.07 |
| 2009 | 8 | -0.245 | -0.342 | -2.74 |
| 2010 | 9 | -0.819 | -1.020 | -9.18 |
| 2011 | 10 | -0.873 | -0.987 | -9.87 |
| 2012 | 8 | -0.233 | -0.383 | -3.06 |
| 2013 | 10 | -0.519 | -0.637 | -6.37 |
| 2014 | 8 | +0.603 | +0.441 | 3.53 |
| 2015 | 9 | +0.308 | +0.175 | 1.58 |
| 2016 | 6 | +0.217 | -0.001 | -0.01 |
| 2017 | 9 | -0.403 | -0.687 | -6.18 |
| 2018 | 10 | +0.037 | -0.160 | -1.60 |
| 2019 | 5 | +0.634 | +0.435 | 2.17 |
| 2020 | 10 | -0.007 | -0.207 | -2.07 |
| 2021 | 8 | -0.360 | -0.665 | -5.32 |
| 2022 | 9 | +0.337 | +0.130 | 1.17 |
| 2023 | 6 | +0.208 | -0.097 | -0.58 |
| 2024 | 5 | +0.479 | -0.050 | -0.25 |
| 2025 | 10 | -0.370 | -0.687 | -6.87 |
| 2026 | 9 | +0.445 | +0.243 | 2.18 |

## Contract rolls and one-leg gaps

The candles are used as quoted, not back-adjusted (the cache carries no roll dates or adjustments). A one-leg gap = one leg's overnight log gap over 5 % while the other's is at most 5 %: 12 such days in the whole joined history. A trade whose hold (the day after entry to the exit day) contains one is dropped from every statistic and still holds the position until its exit. Dropped, entry |z| > 2: 2 (2020-03-13 to 2020-03-16, long spread, gross -1.397R, gap on 2020-03-16; 2026-04-07 to 2026-04-14, long spread, gross +2.183R, gap on 2026-04-08). Variant V1: 2. Smaller roll steps stay in the data unadjusted (a stated limit).

## Variant V1, entry |z| > 1.5 (reported only, never judged)

| Window | n | Gross R a trade | Spread cost | Financing | Net R a trade | Net total | Win % | PF | Month-sum t | Worst drawdown |
|---|---|---|---|---|---|---|---|---|---|---|
| 2016-now | 135 | +0.021 | +0.093 | +0.158 | -0.229 | -30.91 | 51.85 | 0.63 | -2.16 | -35.32R |
| replication | 152 | -0.135 | +0.057 | +0.101 | -0.293 | -44.52 | 45.39 | 0.53 | -3.18 | -50.61R |
| of which 2011-13 | 37 | -0.557 | +0.040 | +0.079 | -0.676 | -25.01 | 29.73 | 0.19 | -3.65 | -26.08R |
Cost sensitivity, 2016-now net R a trade: 0 x +0.021, 1 x -0.229, 2 x -0.479.

## Also reported, not judged

- **2016-now**: exits mean 38, time 18, stop 31; sides 41 short spread / 46 long spread; worst single trade -4.012R; 1R median 1.54 % of a leg's notional.
- **replication**: exits stop 48, time 22, mean 42; sides 64 short spread / 48 long spread; worst single trade -1.976R; 1R median 2.35 % of a leg's notional.

## What it means

The rule does not clear the pre-registered bar: fading a 2-sd stretch of the Brent - WTI spread back toward its 60-day mean is not a tradeable edge on this data at the assumed costs. It is not a council rule, no proposal is written and nothing live changed. Never call it an edge; another threshold, window, hedge ratio, stop or exit would need its own pre-registration on other data (the |z| > 1.5 variant above is reported only and is not a candidate). It does not say the two crudes are not linked: it says this daily z-score fade, with these exits and costs, does not pay.

Before any cost the decisive window makes +0.060R a trade (month-sum t 0.44) and the replication window -0.133R (t -1.13); the assumed costs take +0.260R a trade on 2016-now, because 1R (1.5 x the 60-day sd of the spread, median 1.54 % of a leg) is small next to two legs' spread and financing. The real figure is near the placebo's middle (8 of 40 random draws match or beat it): the z-score entry adds little over a random entry with the same exits. The 2011-13 Cushing glut is the worst stretch (-0.689R a trade, n 28), as the pre-registration expected of a break; without it the replication window is still negative after costs (-0.167R).

Stated limits: the stop is checked on daily closes only (two prices of the spread a day), so a stop exit fills beyond its level and can lose more than 1R; the spread (0.06 % a leg) and the financing (3 % a year a leg) are assumptions, not measurements; the candles are not back-adjusted for contract rolls and only gaps over 5 % on one leg are caught; R uses log returns of the legs at equal notional.

To repeat: `node research/edge/brent-wti-spread/run.mjs fetch <dir>` (git show from origin/council-data, no network; candles kept out of git), then `node research/edge/brent-wti-spread/run.mjs full <dir>`. Tests: `tests/brent-wti-spread.test.mjs`.
