# Result: forex "value" as a five-year cross-sectional reversal, monthly rebalance (14 Nov 2026)

**Verdict: FAIL** on the pre-registered bar (PREREGISTRATION.md, pushed alone before any number was computed). Buying the two
G10 currencies that fell most against the dollar over five years and selling the two that rose most, each month, lost money out
of sample: 2015-01 to 2026-10, primary (60-month return) −0.118R a month net (142 months, month t −0.89), skip variant (60 to 12
months ago) −0.102R a month (t −0.82). Not an edge; nothing live changed and no proposal is written.

| Book of 4 legs, 1R each | Window | Months | Net R a month | Total | Month t | Sharpe | Worst drawdown |
|---|---|---|---|---|---|---|---|
| Primary, base cost | OOS 2015-01 to 2026-10 | 142 | −0.118 | −16.82R | −0.89 | −0.26 | −29.74R |
| Primary, 2x cost | OOS | 142 | −0.331 | −46.95R | −2.50 | −0.73 | −54.60R |
| Primary, before costs | OOS | 142 | +0.094 | +13.32R | 0.70 | 0.20 | −13.18R |
| Primary, base cost | IS 2007-10 to 2014-12 | 87 | +0.112 | +9.74R | 0.59 | 0.22 | −19.61R |
| Primary, before costs | IS | 87 | +0.286 | +24.90R | 1.49 | 0.55 | −15.08R |
| Skip 12, base cost | OOS | 142 | −0.102 | −14.44R | −0.82 | −0.24 | −30.72R |
| Skip 12, 2x cost | OOS | 142 | −0.312 | −44.36R | −2.53 | −0.74 | −55.65R |
| Skip 12, before costs | OOS | 142 | +0.109 | +15.49R | 0.87 | 0.25 | −19.72R |
| Skip 12, base cost | IS | 87 | +0.062 | +5.41R | 0.32 | 0.12 | −23.77R |

**Checks** (all five required for a signal):

| Signal | 1: OOS net > 0 and t ≥ 2 | 2: IS net > 0 | 3: OOS > 0 at 2x cost | 4: Holm p ≤ 0.05 | 5: above placebo 95th pct | Pass |
|---|---|---|---|---|---|---|
| Primary (60 months) | no (−0.118, t −0.89) | yes (+0.112) | no (−0.331) | no (p 1.00) | no (beats 26 of 40) | no |
| Skip 12 | no (−0.102, t −0.82) | yes (+0.062) | no (−0.312) | no (p 1.00) | no (beats 27 of 40) | no |

- **Placebo** (40 seeded runs, 2 random longs and 2 random shorts a month, same months, stops, exits and costs, OOS): month t
  5th percentile −2.81, median −1.17, 95th percentile +0.39. The rule's −0.89 / −0.82 sit above the placebo median (26 and 27
  of 40 beaten) and well below the 95th: ranking by the five-year return did about as well as picking at random.
- **Before costs it is small and not significant in either window**: OOS +0.094R a month gross (t 0.70), IS +0.286R (t 1.49);
  without financing (spread, slippage and commission only) OOS +0.062R (t 0.46). The 2x-cost book is clearly negative.
- **Where the R goes** (primary, OOS, per leg): 568 legs, 44.4 % won, 31.3 % stopped (1 gap fill), net −0.030R a leg = gross
  +0.023R less trading cost 0.008R and financing 0.045R. With a 3 × ATR(20) stop a leg risks about 2 % of price, so the flat
  0.004 % a night (about 30 rollovers a month) is the largest charge. IS: 348 legs, gross +0.072R, net +0.028R a leg.
- **What it held** (primary, OOS months, reported only): CHF short in 134 of 142 months (it rose most against the dollar over five
  years nearly throughout), AUD long 72, JPY long 95 / short 31, NZD long 58. A book so concentrated in a few persistent picks
  is close to a fixed "short CHF, long JPY / AUD" position.
- **Years** (primary, net R, reported only): 2007 (Oct-Dec) +0.16, 2008 +9.28, 2009 +3.77, 2010 −4.57, 2011 −12.03, 2012 +7.56,
  2013 +8.10, 2014 −2.54 | 2015 +1.14, 2016 +2.26, 2017 −5.04, 2018 −1.46, 2019 −0.01, 2020 −8.52, 2021 +5.58, 2022 +3.88,
  2023 −4.04, 2024 −2.06, 2025 −13.92, 2026 (to Oct) +5.40.
- The data: 6,280 common trading days, 2002-09-24 to 2026-11-06 (OANDA mid daily, weekend stubs folded). The first signal needs
  60 month-ends, so positions start October 2007 (the brief's 2005 in-sample start is not reachable); November 2026 is incomplete
  and left out.

**Costs and rates used** (as `fx-xs-momentum`, copied): spread 0.3 pip a round trip, slippage 0.5 pip a side, commission 22.5 USD
per million a side (the demo account's measured raw-spread model, CLAUDE.md "Forex spreads", 12 Nov 2026); financing a flat
0.004 % of price a night on every leg, long or short (the `trend-breadth-h1` / `fx-xs-momentum` assumption), nights by
`council/fills.mjs` `nights`. 2x = trading cost and financing both doubled. **Stop**: every leg has a protective stop at
3 × ATR(20) from the entry (= 1R), gap fills at the open.

**Limitations, as pre-registered.** (1) This is the NOMINAL five-year return; the published value signal uses the real exchange
rate, and CPI is not reachable from the build sandbox. (2) Carry is not in the test: every leg pays a flat financing charge,
while a month-long hold really earns or pays the rate differential (the `fx-carry` branch's rates are from memory and not
merged). Even before any cost, though, the out-of-sample book was +0.094R a month with t 0.70, so neither limitation is what
separates this book from an edge.

What it means: on the council's OANDA daily candles, nominal five-year reversal among the seven dollar pairs has not paid since
2015, and its 2007-14 gain was not significant. Do not propose it; a real-exchange-rate version would need CPI data and its own
pre-registration.

To repeat: `node research/edge/fx-value/run.mjs` (reads council-data with `git show`, writes `result.json`). Tests:
`tests/fx-value.test.mjs`.
