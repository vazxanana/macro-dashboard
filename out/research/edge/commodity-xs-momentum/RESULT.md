# Commodity cross-sectional momentum (12-1, top 3 / bottom 3): result

**Verdict: FAIL.** 2016-01 to 2026-10: −0.071R a month net (130 months, Newey-West t −1.30, worst drawdown −13.33R); 2006-02 to 2015-12: +0.029R a month (119 months, t +0.69); the decisive mean sits at the random-ranking placebo's median (−0.0715R against p50 −0.0703R, p95 −0.0004R). 1 of the 4 conditions met (replication positive).

Paper research only. No live rule, size, filter, council member or page was changed, and the gold book is not touched (owner
decision 44: a cross-market study). Rule, costs, windows and the one judged test were fixed in `PREREGISTRATION.md` (commit
ab97f28a3), pushed before any position was simulated.

**Related.** `tsmom` (branch `tsmom`) tested TIME-SERIES momentum (each market long or short by the sign of its own 12-1 return;
commodities −0.801R a month on 2016-26, t −1.86, FAIL); `fx-xs-momentum` (branch `fx-xs-momentum`) tested CROSS-SECTIONAL
momentum among the seven dollar pairs (FAIL). This study is the cross-sectional version on commodities, which had not been
tested here: markets ranked against each other, three long and three short, so a common rise or fall largely cancels.

## What was tested

Twelve OANDA commodity CFDs (`xau xag xpt xpd xcu bco wtico natgas corn wheat soybn sugar`, council-data daily candles,
weekend stubs folded into Monday, each market on its own calendar). At each month's last close, rank by close(M−1) /
close(M−12) − 1 (a market needs a candle in M, M−1 and M−12); with at least 10 ranked, buy the top 3 and sell the bottom 3 at
the open of each market's first candle of the next month, 1R = stop = 2 x ATR(20) (every leg has its stop; a candle opening
beyond it fills at its open), out at the month's last close. Month R = the six legs' net R / 6. Costs: round trip gold $0.30,
silver $0.03, the rest 0.06 % of price; financing 3 % a year on every leg, long and short, by `council/fills.mjs` `nights`.
Data to 2026-11-06 (November left out). No leg was missing an entry in either window.

## The judged test

| Window | Months | Gross R a month | Net R a month | NW t (3 lags) | Plain t | Sharpe | Total net R | Worst drawdown R | Positive months |
|---|---|---|---|---|---|---|---|---|---|
| Decisive 2016-01 to 2026-10 | 130 | −0.026 | −0.071 | −1.30 | −1.37 | −0.42 | −9.29 | −13.33 | 40.0 % |
| Replication 2006-02 to 2015-12 | 119 | +0.073 | +0.029 | +0.69 | +0.59 | +0.19 | +3.43 | −3.30 | 47.1 % |

| Condition | Met |
|---|---|
| 1. Net mean > 0, decisive | no (−0.071R) |
| 1. Net mean > 0, replication | yes (+0.029R) |
| 2. Decisive NW t >= 2, full window (130 of 130 months) | no (−1.30) |
| 3. Decisive mean above the placebo's 95th percentile | no (−0.0715R against −0.0004R) |

The replication window starts at 2006-02, the first holding month with 10 of 12 markets ranked (platinum and palladium start in
January 2005; gold and silver join in 2007).

## Costs: 0 / base / 2x (descriptive; only base decides)

| Window | No costs: R a month (t) | Base (t) | 2x costs (t) | A leg: gross / round trip / financing (R) |
|---|---|---|---|---|
| Decisive | −0.026 (−0.46) | −0.071 (−1.30) | −0.117 (−2.15) | −0.026 / 0.013 / 0.033 |
| Replication | +0.073 (+1.72) | +0.029 (+0.69) | −0.016 (−0.38) | +0.073 / 0.012 / 0.032 |

Before any cost the decisive book was already slightly negative; costs only add to it. Financing is the larger charge
(0.033R a leg against 0.013R for the round trip): a 2 x ATR(20) stop on a commodity is a few percent of price, so a month of
3 % a year is a noticeable share of 1R.

## Placebo (40 seeds, random ranking each month, same entries, stops and costs, 2016-01 to 2026-10)

| Placebo net R a month | p5 | p50 | p95 | max | Real | Placebos at or above the real |
|---|---|---|---|---|---|---|
| | −0.1192 | −0.0703 | −0.0004 | +0.0664 | −0.0715 | 20 of 40 |

Ranking by the 12-1 return did exactly as well as picking six markets at random: the real book sits at the placebo median.
The placebo is negative too, because every random book pays the same costs.

## Per year (net R, sum of monthly R)

| Year | Months | Gross | Net |
|---|---|---|---|
| 2006 | 11 | +1.09 | +0.63 |
| 2007 | 12 | +0.29 | −0.24 |
| 2008 | 12 | +2.04 | +1.68 |
| 2009 | 12 | +2.05 | +1.63 |
| 2010 | 12 | −0.48 | −0.92 |
| 2011 | 12 | +0.71 | +0.21 |
| 2012 | 12 | −0.70 | −1.29 |
| 2013 | 12 | +2.66 | +1.95 |
| 2014 | 12 | +0.81 | +0.08 |
| 2015 | 12 | +0.24 | −0.31 |
| 2016 | 12 | −0.78 | −1.34 |
| 2017 | 12 | −1.19 | −1.89 |
| 2018 | 12 | −3.05 | −3.69 |
| 2019 | 12 | +0.02 | −0.69 |
| 2020 | 12 | +0.25 | −0.18 |
| 2021 | 12 | +0.67 | +0.14 |
| 2022 | 12 | −0.65 | −1.03 |
| 2023 | 12 | −1.99 | −2.46 |
| 2024 | 12 | −0.70 | −1.30 |
| 2025 | 12 | +5.66 | +5.01 |
| 2026 | 10 | −1.56 | −1.86 |

2 of 11 decisive years positive after costs (2021 and 2025); 2025 alone (+5.01R, the metals' run) carries the window.
Without 2025 the decisive mean is −0.121R a month.

## Which markets drive it (net R of the legs, in R of one leg; a month counts each leg as 1/6)

| Market | Decisive long / short legs | Decisive net R | Replication long / short legs | Replication net R |
|---|---|---|---|---|
| xau | 55 / 14 | +24.68 | 32 / 13 | +3.12 |
| xag | 58 / 29 | +3.32 | 23 / 25 | +19.41 |
| xpt | 20 / 33 | −6.71 | 7 / 15 | −4.68 |
| xpd | 42 / 41 | +5.90 | 55 / 19 | +9.62 |
| xcu | 21 / 15 | −5.49 | 27 / 20 | +1.31 |
| bco | 42 / 40 | −3.50 | 16 / 28 | +3.64 |
| wtico | 36 / 41 | −17.00 | 26 / 44 | +0.21 |
| natgas | 42 / 50 | −13.12 | 29 / 62 | −13.96 |
| corn | 17 / 25 | −13.06 | 45 / 32 | −9.17 |
| wheat | 21 / 29 | −28.55 | 36 / 32 | +2.73 |
| soybn | 7 / 28 | −7.58 | 31 / 23 | +9.78 |
| sugar | 29 / 45 | +5.36 | 30 / 44 | −1.46 |

Decisive legs: 780 (390 long, 390 short), 38.2 % won after costs, 400 stopped (12 at a gap open). The long legs made +0.117R
net a leg and the short legs −0.260R: commodities rose on balance in 2016-26, so shorts lost whatever the ranking (the
placebo books carry the same three-and-three split). The gain is gold held long (+24.7R of leg R); the losses are spread over
wheat, crude, natural gas and corn.

## Roll gaps (no adjustment; descriptive)

The candles are not back-adjusted and OANDA's cash adjustment at a contract roll is not modelled. Legs whose holding window
held an open-to-previous-close jump above 3 %: 51 in the decisive window (summed +18.75R of leg R) and 16 in replication
(+7.36R). Without those legs the decisive mean is −0.104R a month (t −1.84) and the replication +0.022R (t +0.52): the jumps
helped the book, they do not hide an edge.

## Named variants (reported only, never judged)

| Lookback | Decisive net R a month (NW t) | Decisive gross | Replication net (NW t) | Replication gross |
|---|---|---|---|---|
| 12-1 (judged) | −0.071 (−1.30) | −0.026 | +0.029 (+0.69) | +0.073 |
| 6-1 | +0.000 (+0.00) | +0.047 | −0.094 (−2.43) | −0.051 |
| 3-1 | −0.091 (−1.85) | −0.045 | −0.028 (−0.67) | +0.016 |

No lookback is positive in both windows after costs.

## What it means, and what it does not

- On these twelve OANDA commodity CFDs, with these costs and a 2 x ATR(20) stop on every leg, ranking commodities against each
  other by their 12-1 return did no better than a random ranking in 2016-26 and lost about 0.07R a month; the 2006-15 gain
  (+0.03R a month, t +0.69) is not significant either. Not an edge; never call it one. Nothing live changes and no proposal is
  written.
- It does not test the published futures portfolios (more markets, fully collateralised futures with roll yield, no stop,
  no CFD financing). The financing rule is one assumed rate on both sides (a short is often credited in reality); the round
  trips are assumptions, not measured spreads; roll adjustments are not modelled. With no costs at all the decisive book was
  still −0.026R a month, so none of these choices separates it from an edge.
- It says nothing about the gold book (owner decision 44); the gold long legs' gain here is gold's rise, not a ranking effect.
- Any other lookback, universe or exit is a new hypothesis and needs its own pre-registration on other data.

To repeat: `node research/edge/commodity-xs-momentum/run.mjs` (reads council-data with `git show`, no network; writes
`result.json`). Tests: `tests/commodity-xs-momentum.test.mjs`.
