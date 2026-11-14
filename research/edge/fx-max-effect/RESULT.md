# Result: the MAX (lottery) effect across currencies, monthly rebalance (14 Nov 2026)

**Verdict: FAIL** on the pre-registered bar (PREREGISTRATION.md, pushed before any number was computed). Selling the two of the
seven G10 currencies against USD with the largest single daily gain over the past month and buying the two with the smallest
lost money out of sample (2015-01 to 2026-10: −0.138R a month net, 142 months, month t −1.1) and in sample (2005-14: −0.261R a
month, t −1.91). Not an edge; nothing live changed and no proposal is written.

| Book of 4 legs, 1R each | Months | Net R a month | Total | Month t | Sharpe | Worst drawdown |
|---|---|---|---|---|---|---|
| Out of sample 2015-01 to 2026-10, base cost | 142 | −0.138 | −19.57R | −1.1 | −0.32 | −27.47R |
| Out of sample, cost 0 (no cost, no financing) | 142 | +0.077 | +10.98R | 0.61 | 0.18 | −16.7R |
| Out of sample, 2x cost | 142 | −0.353 | −50.13R | −2.84 | −0.83 | −53.43R |
| In sample 2005-01 to 2014-12, base cost | 120 | −0.261 | −31.33R | −1.91 | −0.6 | −39R |
| In sample, cost 0 | 120 | −0.080 | −9.61R | −0.59 | −0.19 | −21.52R |
| In sample, 2x cost | 120 | −0.442 | −53.05R | −3.23 | −1.02 | −58.61R |

- **Checks** (all required): out of sample net > 0 and month t >= 2: **not met** (−0.138R, t −1.1); in sample net > 0: **not
  met** (−0.261R); out of sample net > 0 at 2x cost: **not met** (−0.353R); placebo: **not met** (below).
- **Placebo** (40 seeded runs, 2 random longs and 2 random shorts a month, same months, stops, exits and costs, 2015 on): month t
  5th percentile −2.62, median −1.25, 95th percentile 0.05. The MAX book's −1.1 beats 25 of the 40 random books: no better
  than picking at random.
- **Before costs it is flat too**: +0.077R a month out of sample (t 0.61) and −0.080R in sample (t −0.59); the published sign
  does not even hold consistently before costs.
- **Where the R goes** (out of sample, 568 legs): 43.7 % won, 31.9 % stopped (no gap fill), gross +0.019R a leg, costs 0.008R
  and financing 0.046R a leg, net −0.034R. The flat 0.004 % a night on a stop of about 2 % of price is the largest charge.
- **What the ranking really picks**: out of sample NZD was sold 77 times of 142 and AUD 65, CAD bought 79 and EUR 49: the
  largest daily return mostly ranks the currencies by how much they move, so the book is in practice short the high-volatility
  commodity currencies and long the quieter ones.
- **Years** (net, reported only): 2005 +2.44R, 2006 −0.46, 2007 −8.74, 2008 −8.2, 2009 +4.63, 2010 +1.26, 2011 −0.07,
  2012 −6.19, 2013 −7.51, 2014 −8.52, 2015 −3.9, 2016 −6.19, 2017 +9.72, 2018 −1.19, 2019 +1.47, 2020 −7.15, 2021 −4.23,
  2022 −8.9, 2023 +2.41, 2024 −1.96, 2025 −0.98, 2026 +1.29.
- The data: 6,280 common trading days (2002-09-24 to 2026-11-06). November 2026 is incomplete and left out. The harness is
  `fx-xs-momentum`'s (commit 58bd018), copied unchanged; only the ranking, windows and pass bar differ.

**Limitation, as pre-registered: carry is not in this test.** The rate differential is not reachable from the build sandbox,
so every leg, long or short, pays a flat 0.004 % a night. The book is mostly short AUD and NZD, which carried higher rates
than the dollar for much of the sample, so true carry would often have cost it more, not less (not measured here); and before
any cost the price part is flat (t 0.61 / −0.59).

What it means: on the council's OANDA daily candles the MAX effect among the seven dollar pairs has not paid in 2005-14 or
2015-26. Do not propose it.

To repeat: `node research/edge/fx-max-effect/run.mjs` (reads council-data with `git show`, writes `result.json`). Tests:
`tests/fx-max-effect.test.mjs`.
