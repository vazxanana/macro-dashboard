# The H1 dominant-zone limit on gold at the demo broker's measured hourly spreads (23 Nov 2026)

**Verdict: FAIL. At measured costs the 4R exit made -0.015R a trade in 2021-23 (n 8850, month t -0.48) and +0.072R in 2024-now (n 8911, t 3.33); the trail -0.035R (t -2.19) and +0.010R (t 0.87).**

Pre-registered in `PREREGISTRATION.md` (pushed alone, before the run). Research only: nothing live changed. **2020-26 has been read by three grids that picked this family from millions of cells**: even a pass here would only have said the family can pay the measured costs, a candidate for the forward demo record (`council/dom-demo.mjs`), not evidence on new data. The untouched-years test is `research/edge/dom-zone-holdout`.

Neither pre-registered test holds in both windows (T1 4R and T2 trail, Holm p 1 / 1): 2021-23 loses after the measured costs at every exit.

## Gates

- G1: the walk that finds each exit candle reproduces `multi()`'s R on every trade and exit: held.
- G2: before costs, 4R, 2024-now: n 8911, +0.142R, month t 6.61 against grid 3's gold cell (n 8,909, +0.142R, t 6.62): held (the cache runs to 2026-11-23T12:45 UTC).
- G3: trades built from candles cut at 2022-06-15 (4223 trades), 2024-03-15 (9481 trades), 2025-09-15 (14076 trades) equal the full run's: held. Every trade has its stop on the losing side.

## Costs

C1 (judged): half the median quoted spread of the fill hour + half of the exit hour (council-data `research/probe/ticks-XAUUSD.json` at 0459ec37, 1.7-2.6 x 10^-5 of price), commission 0.000024 of price, 0.05 x M stop slippage (median range of the 12 M5 candles ending with the fill), long financing 0.000148 a night. A trade pays a median $0.192 (90th percentile $0.592) against a median risk of $3.91. C2: the 90th-percentile spread and 0.10 x M. Flat: the grids' $0.30.

## Net R a trade (month t)

| Exit | Window | n | Before costs | C1 | C2 | Flat $0.30 |
|---|---|---:|---|---|---|---|
| 2R | 2021-23 | 8850 | +0.034 (1.72) | -0.037 (-1.92) | -0.066 (-3.45) | -0.101 (-5.05) |
| 2R | 2024-now | 8911 | +0.088 (5.6) | +0.023 (1.45) | -0.008 (-0.51) | +0.019 (1.12) |
| 3R | 2021-23 | 8850 | +0.036 (1.4) | -0.037 (-1.43) | -0.066 (-2.59) | -0.098 (-3.8) |
| 3R | 2024-now | 8911 | +0.114 (6.23) | +0.046 (2.47) | +0.015 (0.79) | +0.045 (2.22) |
| 4R | 2021-23 | 8850 | +0.060 (1.93) | -0.015 (-0.48) | -0.044 (-1.43) | -0.075 (-2.36) |
| 4R | 2024-now | 8911 | +0.142 (6.61) | +0.072 (3.33) | +0.041 (1.88) | +0.073 (3.16) |
| trail | 2021-23 | 8850 | +0.035 (2.18) | -0.035 (-2.19) | -0.064 (-4.08) | -0.100 (-6.08) |
| trail | 2024-now | 8911 | +0.074 (6.37) | +0.010 (0.87) | -0.021 (-1.92) | +0.005 (0.44) |

T1 (4R, C1) fails on 2021-23; T2 (trail, C1) fails in both windows. Before costs every exit is positive in both windows, weaker in 2021-23 (t 1.4-2.2) than in 2024-now (t 5.6-6.6).

## The share of R the cost takes (C1, 2021-now)

| Exit | n | Gross R a trade | Cost R a trade | Share | Net (t) |
|---|---:|---|---|---:|---|
| 2R | 17761 | +0.061 | 0.068 | 111 % | -0.007 (-0.53) |
| 3R | 17761 | +0.075 | 0.070 | 94 % | +0.005 (0.29) |
| 4R | 17761 | +0.101 | 0.072 | 72 % | +0.029 (1.47) |
| trail | 17761 | +0.054 | 0.067 | 123 % | -0.012 (-1.24) |

The stop is about $4 on a median trade, so even a $0.19 round trip is about 0.07R: the cost takes 72 % of the 4R exit's gross and all of the others'.

## Year by year (C1, net R a trade, month t)

| Year | n | 2R | 3R | 4R | Trail | 4R before costs |
|---|---:|---|---|---|---|---|
| 2021 | 2876 | -0.031 (-0.92) | -0.001 (-0.04) | -0.007 (-0.19) | -0.011 (-0.43) | +0.070 |
| 2022 | 3080 | -0.012 (-0.3) | -0.023 (-0.4) | +0.007 (0.11) | -0.017 (-0.57) | +0.076 |
| 2023 | 2894 | -0.070 (-2.62) | -0.087 (-2.68) | -0.047 (-0.86) | -0.076 (-3.17) | +0.031 |
| 2024 | 3097 | +0.026 (1.05) | +0.015 (0.49) | +0.044 (1.22) | +0.023 (1.1) | +0.122 |
| 2025 | 3078 | +0.032 (1.26) | +0.073 (2.18) | +0.112 (2.91) | +0.027 (1.56) | +0.184 |
| 2026 (to 23 Nov) | 2736 | +0.009 (0.27) | +0.051 (1.53) | +0.059 (1.54) | -0.025 (-1.6) | +0.116 |

2023 loses under C1 at every exit; only 2024-25 carry the family.

## By fill session (C1, 2021-now, reported only)

| Session (UTC) | n | 4R net (t) | Trail net (t) |
|---|---:|---|---|
| Asia | 5382 | -0.010 (-0.29) | -0.013 (-0.63) |
| London | 3991 | +0.084 (2.29) | +0.017 (0.8) |
| New York | 7303 | +0.009 (0.36) | -0.031 (-1.97) |
| late | 1085 | +0.148 (2.13) | +0.009 (0.22) |

Session splits were not pre-registered as tests and are read after the fact: never a filter from this table.

## What it means

The measured costs are lower than the grids' flat $0.30 in most hours, but adding the stop-slippage allowance and long financing brings a trade back to about the same 0.07R. The family pays its measured costs in 2024-now at 4R (and 3R) and not in 2021-23 at any exit: no pre-registered test holds in both windows. Nothing is called an edge. The forward demo record (`council/dom-demo.mjs`, 2R target) and the untouched-years holdout are where this family is judged; at 2R this table puts it at +0.023R a trade in 2024-now (t 1.45) and -0.037R in 2021-23.

To repeat: `node --use-env-proxy research/edge/_lib/fetch-cache.mjs xau 5m 2019`, then `git show 0459ec37:research/probe/ticks-XAUUSD.json > ticks.json` and `EDGE_DATA=<cache> node --max-old-space-size=6000 research/edge/dom-gold-hourcost/run.mjs ticks.json` (about a minute).
