# Result: price "value" across index and commodity CFDs, monthly rebalance (14 Nov 2026)

**Verdict: FAIL, 0 of 4 tests pass: the value book of indices and commodities lost out of sample (2017-01 to 2026-10, -0.072R a month net, n 118, month t -2.97) and in sample (-0.038R, n 77, t -1.32).**

Pre-registered in [PREREGISTRATION.md](PREREGISTRATION.md) (committed and pushed alone before any number was computed). Claim:
Asness, Moskowitz & Pedersen 2013, "Value and momentum everywhere": value = the log of the average price 4.5 to 5.5 years
ago minus the log price now; within an asset class the cheapest beat the dearest over the next month. Not an edge; nothing
live changed and no proposal is written. FX is not repeated (`fx-value`, #968, FAIL); the index book is a close relative of
`index-long-reversal` (#941, FAIL: 36-month reversal, 12-month hold) and is not independent evidence.

## What was tested

- **Indices (14)**: `au200 ch20 de40 eu50 fr40 hk33 jp225 nas100 nl25 sg30 spx500 uk100 us2000 us30` (cn50, in50, es35 start
  after 2008, left out). **Commodities (12)**: `xau xag xpt xpd xcu bco wtico natgas corn wheat soybn sugar`.
- Council-data OANDA mid daily candles, weekend stubs folded (`foldWeekend`). Data to 2026-11-06; November left out.
- Each month end, per group with 9+ scored markets: long the cheapest third (highest value score), short the dearest third,
  entry at the next month's first open, stop 3 x ATR(20) = 1R (so every leg is sized by inverse ATR), out at the month's last
  close. Primary (T1) = mean of the two group books in months both exist.
- **Effective windows**: the index value book starts 2008-10, the commodity book 2010-08 (ten markets scored), so T1 and T4
  start 2010-08. In sample is 2010-08 to 2016-12 for T1, T3 and T4 (77 months; short, said in the pre-registration) and
  2008-10 to 2016-12 for T2 (99 months). Out of sample 2017-01 to 2026-10 (118 months) for all four.
- Costs: round trip index CFDs 0.04 %, gold $0.30, silver $0.03, other commodities 0.06 %; financing a flat 3 % a year of
  the entry price on every leg, long and short, per `council/fills.mjs` `nights` (the `commodity-xs-momentum` assumption).

## The four tests (net R a month of the book; t on calendar-month sums; Holm over the four)

| Test | Window | Months | Gross R/month (t) | Net R/month | Net t | NW t | 2x costs | Holm p (OOS) | Worst DD |
|---|---|---|---|---|---|---|---|---|---|
| **T1 value, both groups** | IS 2010-08 to 2016-12 | 77 | +0.012 (0.40) | −0.038 | −1.32 | −1.54 | | | −2.96R |
| **T1 value, both groups** | OOS 2017-01 to 2026-10 | 118 | −0.023 (−0.94) | **−0.072** | **−2.97** | −2.77 | −0.121 | 0.006 (negative) | −9.47R |
| T2 value, indices | IS 2008-10 to 2016-12 | 99 | −0.050 (−1.53) | −0.105 | −3.22 | −4.03 | | | −11.16R |
| T2 value, indices | OOS | 118 | −0.058 (−1.72) | −0.118 | −3.51 | −3.60 | −0.177 | 0.001 (negative) | −14.47R |
| T3 value, commodities | IS 2010-08 to 2016-12 | 77 | +0.091 (2.22) | +0.051 | +1.25 | +1.27 | | | −2.29R |
| T3 value, commodities | OOS | 118 | +0.013 (0.43) | −0.026 | −0.85 | −0.76 | −0.065 | 0.395 | −5.44R |
| T4 value + momentum 50/50 | IS 2010-08 to 2016-12 | 77 | −0.000 (−0.01) | −0.050 | −2.61 | −2.79 | | | −3.85R |
| T4 value + momentum 50/50 | OOS | 118 | −0.010 (−0.65) | −0.059 | −3.77 | −3.52 | −0.108 | 0.001 (negative) | −7.26R |

The small Holm p-values of T1, T2 and T4 are for LOSSES (negative t); the bar needs a positive t of 2 or more.

## Against the bar

| Test | OOS net > 0, t ≥ 2, Holm p ≤ 0.05 | IS net > 0 | OOS > 0 at 2x costs | Above placebo 95th pct | Pass |
|---|---|---|---|---|---|
| T1 (primary) | no (−0.072, t −2.97) | no (−0.038) | no (−0.121) | no (−0.072 vs −0.034) | no |
| T2 | no (−0.118, t −3.51) | no (−0.105) | no (−0.177) | no (−0.118 vs −0.050) | no |
| T3 | no (−0.026, t −0.85) | yes (+0.051) | no (−0.065) | no (−0.026 vs +0.005) | no |
| T4 | no (−0.059, t −3.77) | no (−0.050) | no (−0.108) | no (−0.059 vs −0.040) | no |

## Placebo (40 seeded draws: each group's scored markets in a random order each month, same thirds, stops, costs; OOS)

| Test | Real net R/month | 5th pct | Median | 95th pct | Draws beaten |
|---|---|---|---|---|---|
| T1 | −0.0718 | −0.0860 | −0.0697 | −0.0336 | 14 of 40 |
| T2 | −0.1177 | −0.0990 | −0.0780 | −0.0502 | 1 of 40 |
| T3 | −0.0259 | −0.0960 | −0.0567 | +0.0054 | 31 of 40 |
| T4 | −0.0592 | −0.0663 | −0.0582 | −0.0402 | 16 of 40 |

The primary book is at the placebo's median: ranking by five-year value did about as well as ranking at random, and the
random books lose because every leg pays about 0.06R of costs a month. The index book is worse than 39 of 40 random books.

## What it shows

- **Indices: shorting the dear US indices is the loss.** Out of sample the book was short nas100 in all 118 months
  (−45.2R), spx500 in 113 (−37.4R), jp225 74 (−14.8R), de40 32 (−10.4R); long sg30 109 (+1.7R), hk33 86 (+3.4R), uk100 98
  (−8.0R). The same pattern as #941: a near-fixed "short US, long Asia / UK" position during a decade of US outperformance.
  Before costs it already lost (−0.058R a leg OOS, −0.053R IS); financing took 0.050R a leg a month, spread 0.010R.
- **Commodities: a small gross gain in sample that did not hold.** IS +0.091R a month gross (t 2.22), +0.051R net (t 1.25);
  OOS +0.013R gross (t 0.43), −0.026R net. Largest OOS drags: short xau 90 months (−23.3R), short xpd 74 (−23.6R), xag
  (−13.0R), short xcu 68 (−12.8R); gains from sugar (+15.1R), natgas (+11.5R), bco (+10.0R), wheat (+8.2R). Costs: 0.009R
  spread + 0.030R financing a leg.
- **Value and momentum do diversify, but both legs lose.** Correlation of the monthly net series: indices −0.22 IS / +0.04
  OOS, commodities −0.11 IS / −0.45 OOS. Momentum alone (reported, not tested): indices −0.067R IS (153 months, t −2.97),
  −0.069R OOS (t −1.99); commodities −0.033R IS (t −1.06), −0.024R OOS (t −0.60). Averaging two losing books with low
  correlation gives a smoother loss (T4 OOS Sharpe −1.20), not a gain.
- **Legs** (value, OOS): indices 944 legs, 40.7 % won, 330 stopped (11 gap fills); commodities 944 legs, 46.9 % won, 291
  stopped (5 gap fills). IS: 772 and 588 legs.
- **Years (T1, net R)**: 2010 (Aug-Dec) −1.31, 2011 −0.12, 2012 +0.32, 2013 −0.78, 2014 −0.11, 2015 −0.14, 2016 −0.81 |
  2017 −1.61, 2018 −0.74, 2019 −0.91, 2020 −1.85, 2021 −0.88, 2022 +0.11, 2023 −0.62, 2024 −1.35, 2025 −1.17, 2026 (to Oct)
  +0.55. Positive in 3 of 17 years.

## Limitations (as pre-registered)

CFD prices are spot / price indices, not the paper's futures excess returns: no dividends on indices, no roll yield on
commodities (the financing assumption stands in for it). The commodity book has 77 in-sample months only. Financing is an
assumed flat 3 % on both sides; the gross figures above show the result does not hang on it: the primary book lost before any
cost out of sample (−0.023R a month, t −0.94).

What it means: on the council's OANDA daily candles, five-year price value inside indices and commodities, alone or with
12-1 momentum, has not paid since 2010. Do not propose it.

To repeat: `node research/edge/value-everywhere/run.mjs` (reads `origin/council-data` with `git show`, no network; writes
result.json). Tests: `tests/value-everywhere.test.mjs`.
