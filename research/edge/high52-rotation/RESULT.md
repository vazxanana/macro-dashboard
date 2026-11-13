# 52-week-high proximity rotation across equity indices: result

**Verdict: FAIL** (pre-registered bar: decisive excess > 0 with Newey-West t >= 2 missed; 2008-15 excess > 0 missed; decisive Sharpe >= benchmark met; above the placebo's 95th percentile missed).

Decisive window 2016-01 to 2026-10 (130 months): the rotation made +3.8 % a year (Sharpe +0.32) against +3.24 % (Sharpe +0.26) for the equal-weight book of all eleven; excess +0.0461 % a month, Newey-West t +0.38.
Replication 2008-01 to 2015-12 (96 months): excess -0.1378 % a month (Newey-West t -1.13); rotation Sharpe -0.17, benchmark -0.06.
Placebo (40 seeds of 3 random indices a month, same weights, stop and costs): 95th percentile of the decisive excess +0.0968 % a month, median -0.0335 %; 7 of 40 seeds did at least as well as the rule.

Net of the pre-registered trading costs and financing (each index currency's cash rate for the year + 2.5 % a year on every long). Returns summed on a constant equity of 1 (not compounded). Paper research: no live rule, size, filter, stop or council member changed.

## Setup

Rule: each month end hold the 3 of 11 equity-index CFDs with the highest close / 252-day closing high, inverse 60-day volatility weights (gross 1x, long only), rebalanced at the next open, 3 x ATR(20) catastrophe stop; benchmark = all eligible indices at equal weight with the same stop, costs and financing. Universe: spx500, nas100, us30, us2000, de40, uk100, jp225, eu50, fr40, au200, hk33; dropped: none (every history starts in 2003-04). Data: council-data `research/daily/<key>.json`, OANDA mid daily candles to 2026-11-06, weekend stubs folded into Monday. Catastrophe stops hit: 265 (rotation) and 942 (benchmark).

## Windows

### 2008-01 to 2015-12

| Stream | Months | Mean % a month | % a year | Sharpe | t | Newey-West t | Total % | Worst drawdown % |
|---|---|---|---|---|---|---|---|---|
| Rotation (top 3) | 96 | -0.214 | -2.57 | -0.17 | -0.48 | -0.45 | -20.55 | -60.31 |
| Benchmark (all, equal weight) | 96 | -0.0762 | -0.91 | -0.06 | -0.17 | -0.16 | -7.32 | -57.98 |
| All, inverse-volatility weight (descriptive) | 96 | -0.0962 | -1.15 | -0.08 | -0.22 | -0.2 | -9.24 | -57.63 |
| **Excess over the benchmark** | 96 | -0.1378 | -1.65 | -0.36 | -1.03 | -1.13 | -13.23 | -17.76 |
| Excess over the inverse-volatility book (descriptive) | 96 | -0.1178 | -1.41 | -0.33 | -0.93 | -1 | -11.31 | -17.72 |

### 2016-01 to 2026-10

| Stream | Months | Mean % a month | % a year | Sharpe | t | Newey-West t | Total % | Worst drawdown % |
|---|---|---|---|---|---|---|---|---|
| Rotation (top 3) | 130 | +0.3163 | +3.8 | +0.32 | +1.05 | +1.15 | +41.12 | -21.72 |
| Benchmark (all, equal weight) | 130 | +0.2701 | +3.24 | +0.26 | +0.87 | +0.95 | +35.12 | -27.91 |
| All, inverse-volatility weight (descriptive) | 130 | +0.2745 | +3.29 | +0.27 | +0.9 | +0.99 | +35.69 | -27.63 |
| **Excess over the benchmark** | 130 | +0.0461 | +0.55 | +0.11 | +0.36 | +0.38 | +6 | -16.46 |
| Excess over the inverse-volatility book (descriptive) | 130 | +0.0418 | +0.5 | +0.11 | +0.35 | +0.37 | +5.43 | -17.07 |

## How often each index was held (months)

| Index | spx500 | nas100 | us30 | us2000 | de40 | uk100 | jp225 | eu50 | fr40 | au200 | hk33 |
|---|---|---|---|---|---|---|---|---|---|---|---|
| 2008-15 | 52 | 48 | 55 | 20 | 25 | 26 | 14 | 9 | 9 | 16 | 14 |
| Decisive | 79 | 48 | 52 | 13 | 24 | 49 | 27 | 23 | 22 | 47 | 6 |

## Sensitivities (never deciding)

| Variant | Window | Excess % a month | Newey-West t | Rotation Sharpe | Benchmark Sharpe | Rotation % a year | Benchmark % a year |
|---|---|---|---|---|---|---|---|
| Costs x2 (trading and financing) | 2008-15 | -0.1334 | -1.08 | -0.36 | -0.25 | -5.4 | -3.8 |
| Costs x2 (trading and financing) | Decisive | +0.038 | +0.32 | 0 | -0.04 | 0 | -0.46 |
| No financing | 2008-15 | -0.1482 | -1.22 | 0 | +0.12 | +0.07 | +1.85 |
| No financing | Decisive | +0.0478 | +0.4 | +0.61 | +0.55 | +7.39 | +6.81 |
| No costs, no financing | 2008-15 | -0.1422 | -1.18 | +0.02 | +0.13 | +0.26 | +1.97 |
| No costs, no financing | Decisive | +0.0543 | +0.45 | +0.63 | +0.56 | +7.59 | +6.94 |

## Reading

- The pre-registered bar was not met: no proposal is written and nothing changes. Any variant (another look-back, top 2 or 4, a different weighting, total-return data, more indices) would be a new study with its own pre-registration, judged on data it was not chosen on.
- The placebo shows how much of any excess is simply holding three of these eleven at inverse-volatility weights: its median excess is -0.0335 % a month against the equal-weight book.

## What this cannot show

- Dividends: a CFD long is credited the index dividend; the OANDA mid is a price index, so high-yield indices (UK, Hong Kong, euro area) are understated against low-yield ones (Nasdaq). Not corrected.
- Currency: each index earns in its own currency (no FX translation). Financing uses approximate year-average policy rates stated in the pre-registration.
- Eleven correlated indices are a narrow cross-section; the published effect is across thousands of stocks.
- Not an edge in the council: no forward record exists. Never call it one without n, t and a forward record.

To repeat: `node research/edge/high52-rotation/run.mjs fetch <dir>`, then `node research/edge/high52-rotation/run.mjs full <dir>`. Tests: `tests/high52-rotation.test.mjs`.
