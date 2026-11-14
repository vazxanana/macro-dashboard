# Commodity cross-sectional skewness (12 months, most negative third long / most positive third short): result

**Verdict: FAIL.** Out of sample 2016-06 to 2026-10: −0.060R a month net (125 months, Newey-West t −1.38). Out of sample 1000 legs at −0.060R net a leg; in sample 2006-02 to 2016-05: +0.030R a month (124 months, t +0.62; 964 legs at +0.026R a leg); at 2x costs out of sample −0.109R a month; the real out-of-sample mean beats 24 of 40 random rankings (−0.0598R against the placebo p95 −0.0171R). 1 of the 4 conditions met (in sample positive).

Paper research only. No live rule, size, filter, council member or page was changed, and the gold book is not touched (owner decision 44: a cross-sectional commodity study, not a gate, exit, entry or size on the gold book). Rule, costs, windows and the one judged test were fixed in `PREREGISTRATION.md` (commit 0974ac40b), pushed alone before any skewness or position was computed.

**Related.** `commodity-xs-momentum` (branch `commodity-xs-momentum`, FAIL) ranked the same twelve CFDs by their 12-1 return; its harness (calendar, entries, stop, costs, financing, statistics, placebo) is copied here unchanged, only the signal, the bucket (a third a side) and the windows (first half / rest) differ. `tsmom` and `fx-xs-momentum` (both FAIL) are other momentum tests. No study here had ranked by return skewness.

## What was tested

Twelve OANDA commodity CFDs (`xau xag xpt xpd xcu bco wtico natgas corn wheat soybn sugar`, council-data daily candles, all `status: ok`, weekend stubs folded into Monday, each market on its own calendar). At each month's last close, the skewness (Pearson's moment coefficient) of the market's daily log close-to-close returns from its month-end of M−12 to its month-end of M (at least 200 returns), ranked from most negative to most positive; with N ≥ 10 ranked, buy the floor(N/3) most negatively skewed and sell the floor(N/3) most positively skewed at the open of each market's first candle of the next month (4 a side with twelve markets, 3 with ten or eleven: 14 early months), 1R = stop = 2 x ATR(20) (every leg has its stop; a candle opening beyond it fills at its open), out at the month's last close. Month R = the legs' net R / number of legs. Costs: round trip gold $0.30, silver $0.03, the rest 0.06 % of price; financing 3 % a year on every leg, long and short, by `council/fills.mjs` `nights`. Data to 2026-11-06 (November left out). No leg was missing an entry.

Windows, by the pre-registered rule: the 249 holding months from the first with 10 ranked markets (2006-02, as expected) to 2026-10; in sample the first 124, out of sample the last 125.

## The judged test

| Window | Months | Gross R a month | Net R a month | NW t (3 lags) | Plain t | Sharpe | Total net R | Worst drawdown R | Positive months |
|---|---|---|---|---|---|---|---|---|---|
| In sample 2006-02 to 2016-05 | 124 | +0.079 | +0.030 | +0.62 | +0.60 | +0.19 | +3.66 | −4.26 | 48.4 % |
| Out of sample 2016-06 to 2026-10 | 125 | −0.010 | −0.060 | −1.38 | −1.42 | −0.44 | −7.48 | −9.37 | 43.2 % |

| Condition | Met |
|---|---|
| 1. Out-of-sample NW t >= 2, base costs | no (−1.38) |
| 2. In-sample net mean > 0 | yes (+0.030R) |
| 3. Out-of-sample net mean at 2x costs > 0 | no (−0.109R) |
| 4. Out-of-sample mean above the placebo's 95th percentile | no (−0.0598R against −0.0171R) |

## Costs: 0 / base / 2x (descriptive; only the conditions above decide)

| Window | No costs: R a month (t) | Base (t) | 2x costs (t) | A leg: gross / net / round trip / financing (R) |
|---|---|---|---|---|
| In sample | +0.079 (+1.63) | +0.030 (+0.62) | −0.020 (−0.42) | +0.076 / +0.026 / 0.014 / 0.036 |
| Out of sample | −0.010 (−0.23) | −0.060 (−1.38) | −0.109 (−2.55) | −0.010 / −0.060 / 0.013 / 0.036 |

Before any cost the out-of-sample book was already −0.010R a month (t −0.23); the in-sample gain before costs (+0.079R, t +1.63) was not significant either, and costs took most of it.

## Placebo (40 seeds, random ranking each month, same legs a side, entries, stops and costs, out-of-sample window)

| Placebo net R a month | p5 | p50 | p95 | max | Real | Placebos at or above the real |
|---|---|---|---|---|---|---|
| | −0.1199 | −0.0776 | −0.0171 | +0.0195 | −0.0598 | 16 of 40 |

The skewness ranking sat inside the random rankings' range, a little above their median. The random books are negative too: every one pays the same costs, and short legs lost in a decade when commodities rose.

## Long legs against short legs (net R a leg)

| Window | Long legs | Long net R a leg | Short legs | Short net R a leg |
|---|---|---|---|---|
| In sample | 482 | +0.100 | 482 | −0.048 |
| Out of sample | 500 | +0.083 | 500 | −0.203 |

## Per year (net R, sum of monthly R)

| Year | Months | Gross | Net |
|---|---|---|---|
| 2006 | 11 | +1.65 | +1.15 |
| 2007 | 12 | +0.11 | −0.55 |
| 2008 | 12 | +1.53 | +1.11 |
| 2009 | 12 | −1.68 | −2.14 |
| 2010 | 12 | +2.22 | +1.65 |
| 2011 | 12 | +1.32 | +0.80 |
| 2012 | 12 | +2.86 | +2.23 |
| 2013 | 12 | −1.38 | −2.05 |
| 2014 | 12 | +1.39 | +0.62 |
| 2015 | 12 | −0.17 | −0.77 |
| 2016 | 12 | +2.21 | +1.56 |
| 2017 | 12 | −0.26 | −1.11 |
| 2018 | 12 | −1.71 | −2.46 |
| 2019 | 12 | +1.79 | +1.02 |
| 2020 | 12 | +0.66 | +0.15 |
| 2021 | 12 | −0.94 | −1.46 |
| 2022 | 12 | −0.92 | −1.34 |
| 2023 | 12 | −0.59 | −1.17 |
| 2024 | 12 | −0.83 | −1.37 |
| 2025 | 12 | +2.35 | +1.74 |
| 2026 | 10 | −1.13 | −1.44 |

## Which markets drive it (net R of the legs, in R of one leg)

| Market | In-sample long / short legs | In-sample net R | Out-of-sample long / short legs | Out-of-sample net R |
|---|---|---|---|---|
| xau | 71 / 23 | +27.57 | 25 / 47 | −9.32 |
| xag | 87 / 2 | −1.99 | 47 / 27 | +16.28 |
| xpt | 84 / 10 | +24.00 | 44 / 7 | +14.48 |
| xpd | 77 / 9 | +4.80 | 77 / 24 | +10.41 |
| xcu | 31 / 52 | −3.07 | 41 / 44 | +17.89 |
| bco | 16 / 40 | −12.56 | 68 / 35 | −8.29 |
| wtico | 11 / 36 | −8.43 | 78 / 25 | −5.84 |
| natgas | 5 / 92 | −3.53 | 16 / 54 | −20.39 |
| corn | 14 / 64 | +4.59 | 47 / 19 | −22.83 |
| wheat | 9 / 77 | −0.94 | 7 / 104 | −28.09 |
| soybn | 53 / 25 | +3.75 | 36 / 45 | −15.80 |
| sugar | 24 / 52 | −8.72 | 14 / 69 | −8.35 |

The ranking is sticky by market: the precious metals sit mostly in the negative-skew (long) bucket and natural gas, wheat and corn mostly in the positive-skew (short) bucket, so the book is close to a slow long-metals / short-grains-and-gas spread. In sample that spread paid (gold and platinum longs); out of sample gold moved to the short side more often and lost there, and the grain and gas legs lost.

## Roll gaps (no adjustment; descriptive)

Legs whose holding window held an open-to-previous-close jump above 3 %: 21 in sample (summed +5.97R of leg R) and 54 out of sample (+19.20R). Without those legs the in-sample mean is +0.021R a month (t +0.44) and the out-of-sample −0.091R (t −2.06): the jumps helped the book, they do not hide an edge. Roll jumps also enter the skewness signal (not corrected, as pre-registered).

## Named variants (reported only, never judged)

| Variant | In-sample net R a month (NW t) | Out-of-sample net R a month (NW t) |
|---|---|---|
| 12 months, a third a side (judged) | +0.030 (+0.62) | −0.060 (−1.38) |
| 6 months, a third a side | +0.072 (+1.57) | −0.068 (−1.69) |
| 12 months, 3 a side | +0.080 (+1.46) | −0.106 (−2.23) |

Every version is positive in sample and negative out of sample: the in-sample gain did not repeat.

## What it means, and what it does not

- On these twelve OANDA commodity CFDs, with these costs and a 2 x ATR(20) stop on every leg, ranking by the skewness of the past year's daily returns lost −0.060R a month out of sample (125 months, t −1.38) after a small, non-significant in-sample gain (+0.030R, t +0.62), and it did not beat random rankings. Not an edge; never call it one. Nothing live changes and no proposal is written.
- It does not test the published futures portfolios (about 27 fully collateralised futures, no stop, no CFD financing, roll-adjusted returns). The round trips and the single financing rate are assumptions; roll adjustments are not modelled. With no costs at all the out-of-sample book was still negative, so none of these choices separates it from an edge.
- It says nothing about the gold book (owner decision 44).
- Any other lookback, universe, bucket or exit is a new hypothesis and needs its own pre-registration on other data.

To repeat: `node research/edge/commodity-skewness/run.mjs` (reads council-data with `git show`, no network; writes `result.json`). Tests: `tests/commodity-skewness.test.mjs`.
