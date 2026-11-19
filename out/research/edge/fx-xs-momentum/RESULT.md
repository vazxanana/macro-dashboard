# Result: forex cross-sectional momentum, monthly rebalance (13 Nov 2026)

**Verdict: FAIL** on the pre-registered bar (PREREGISTRATION.md, pushed before any number was computed). Buying the two
strongest and selling the two weakest of the seven G10 currencies against USD each month lost money on 2016 to October 2026 with
either lookback: 63-day −0.244R a month net (130 months, month t −1.79), 21-day −0.152R a month (t −1.13). Not an edge; nothing
live changed and no proposal is written.

| Book of 4 legs, 1R each, net of costs and financing | Months | Net R a month | Total | Month t | Sharpe | Worst drawdown |
|---|---|---|---|---|---|---|
| 63-day, decisive 2016-01 to 2026-10 | 130 | −0.244 | −31.7R | −1.79 | −0.55 | −39.19R |
| 63-day, replication 2008-01 to 2015-12 | 96 | +0.098 | +9.45R | 0.58 | 0.21 | −12.56R |
| 21-day, decisive 2016-01 to 2026-10 | 130 | −0.152 | −19.7R | −1.13 | −0.34 | −25.1R |
| 21-day, replication 2008-01 to 2015-12 | 96 | +0.081 | +7.75R | 0.46 | 0.16 | −14.66R |

- **Checks** (all required for a lookback): decisive net > 0 and month t >= 2: **not met** for either; replication the same sign:
  met for both (positive) but the decisive side is negative, so the signs differ; Holm over the two lookbacks on the one-sided p:
  p 0.963 (63-day) and 0.871 (21-day), Holm-adjusted 1 and 1: **not met**; placebo: **not met** (below).
- **Placebo** (40 seeded runs, 2 random longs and 2 random shorts a month, same stops, exits and costs, 2016 on): month t 5th
  percentile −2.79, median −1.31, 95th percentile −0.17. The 63-day book's −1.79 sits below the placebo median and the 21-day
  book's −1.13 just above it: ranking by past return did no better than picking at random.
- **Before costs it is flat too**: decisive gross −0.034R a month (63-day, t −0.25) and +0.062R (21-day, t 0.46). Without
  financing (spread, slippage and commission only): −0.066R (t −0.48) and +0.030R (t 0.22). The replication years were
  better before costs (+0.269R and +0.250R a month, t 1.59 and 1.40) and are still not significant.
- **Where the R goes**: per leg, on 2016 on, 63-day: 520 legs, 45.0 % won, 32.7 % stopped (1 gap fill), net −0.061R a leg, of which
  costs 0.008R and financing 0.044R. With a 3 × ATR(20) stop a leg risks about 2 % of price, so the flat 0.004 % a night
  (about 30 rollovers a month) is the largest charge; spread, slippage and commission on this raw-spread model are small.
- **Years** (63-day, net, reported only): 2016 −2.32R, 2017 −7.95, 2018 −10.30, 2019 +1.85, 2020 −10.64, 2021 −0.32, 2022 +2.25,
  2023 −1.74, 2024 −6.06, 2025 +3.87, 2026 −0.33.
- The data: 6,280 common trading days (2002-09-24 to 2026-11-06); no flat (high = low) candle from 2008 on in any series.
  November 2026 is incomplete and left out.

**Limitation, as pre-registered: carry is not in this test.** The rate differential between each currency and the dollar is not
reachable from the build sandbox (FRED is refused), so every leg, long or short, pays a flat 0.004 % a night. In the published
work, part of currency momentum's return is carry (high-rate currencies tend to rank high and earn the differential). This
test measures the price part alone; it says nothing about a momentum book that is paid its true carry. Even before any cost,
though, the price part was flat on 2016 on (t −0.25 / +0.46), so financing is not what separates this book from an edge.

What it means: on the council's OANDA daily candles, 3-month and 1-month cross-sectional momentum among the seven dollar pairs
has not paid since 2016, and its 2008-15 gain was not significant. Do not propose it; a carry-inclusive version would need
measured rate differentials and its own pre-registration.

To repeat: `node research/edge/fx-xs-momentum/run.mjs` (reads council-data with `git show`, writes `result.json`). Tests:
`tests/fx-xs-momentum.test.mjs`.
