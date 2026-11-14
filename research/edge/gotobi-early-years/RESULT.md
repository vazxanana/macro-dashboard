# Gotobi early years: the frozen T2 fade on yen pair-years no gotobi study has used

**Verdict: DOES NOT REPLICATE.** It fails on pooled month t >= 2 at the base cost, pooled net R a trade > 0 at 2 x cost: the six yen crosses EUR/JPY, GBP/JPY, AUD/JPY, CAD/JPY, CHF/JPY, NZD/JPY pooled, 2005-01-31 to 2009-12-31 (OANDA mid M5), n 2129, +0.053R a trade net at the original 1.30-pip cost, month t +1.12; at 2 x cost −0.029R (month t −0.61). These pair-years were never used by a gotobi study, but they are the SAME calendar days as #889 R2 (USD/JPY 2005-09): no calendar year with intraday USD/JPY data is left unused. **Still not a net edge**: the spread and slippage at 00:55 and 06:00 UTC have not been measured on any yen pair, and the crosses' 0.3 pip spread is assumed. The rule is the gotobi study's T2, frozen byte for byte (frozen.mjs); pre-registered in PREREGISTRATION.md (first commit of the branch). Paper research only; nothing live changed.

**Gate: PASSED.** The frozen file's own loop on USD/JPY (OANDA mid M5, fetched again) gives T2 2016-01-01 to 2026-11-11: n 771, +0.1481R a trade, month t +2.74 (#878: n 771, +0.148R, t 2.74).

## The unused set

- Used by the gotobi studies: USD/JPY 2005-01 to 2026-11 (OANDA; HistData 2018-26), EUR/JPY, GBP/JPY, AUD/JPY, CAD/JPY, CHF/JPY 2010-01 to 2026-11. Never used: NZD/JPY, and every cross before 2010.
- USD/JPY before 2005: OANDA serves one stub candle a day (20:55 UTC), nothing at 00:55 or 06:00 UTC: not computable. HistData in council-data: USD/JPY 2018-26 only, no yen cross.
- Primary set U: the six crosses from their first OANDA M5 candle (EUR/JPY 2005-01-03, GBP/JPY 2005-01-03, AUD/JPY 2005-01-03, CAD/JPY 2005-01-03, CHF/JPY 2005-01-03, NZD/JPY 2005-01-03; first trade 2005-01-31) to 2009-12-31: 2129 gotobi trades, EUR/JPY 355, GBP/JPY 355, AUD/JPY 355, CAD/JPY 355, CHF/JPY 355, NZD/JPY 354.
- U shares its calendar days with #889 R2 (USD/JPY 2005-09). Supporting set N: NZD/JPY 2010-01-01 to 2026-11-11 (same calendar as #878 and #889 R1).

## U pooled, at three costs

| Cost | n | Mean R a trade | Trade t | Month t | Months | Total R | Worst drawdown (R) |
|---|---|---|---|---|---|---|---|
| 0 (gross) | 2129 | +0.135 | +5.76 | +2.87 | 60 | +287.9 | 48.9 |
| **base, 1.30 pips + commission (C1)** | 2129 | +0.053 | +2.25 | +1.12 | 60 | +112.6 | 72.0 |
| 2 x base | 2129 | −0.029 | −1.25 | −0.61 | 60 | −62.6 | 161.1 |
| C2a published spread, no slippage (4 crosses with a figure) | 1420 | +0.088 | +3.05 | +1.80 | 60 | +124.9 | 50.0 |
| C2b published spread + 2 x 0.5 slippage (4 crosses) | 1420 | +0.041 | +1.40 | +0.82 | 60 | +57.5 | 63.6 |
| C2a all six (EUR/JPY, NZD/JPY at 1.39, assumed) | 2129 | +0.069 | +2.94 | +1.46 | 60 | +147.0 | 66.4 |
| C2b all six (EUR/JPY, NZD/JPY at 1.39 + 1.0, assumed) | 2129 | +0.023 | +0.98 | +0.49 | 60 | +49.3 | 88.6 |

## The pre-registered conditions

| Condition | Value | Holds |
|---|---|---|
| Pooled net R a trade > 0 at the base cost | +0.053 | yes |
| Pooled month t >= 2 at the base cost | +1.12 | no |
| Pooled net R a trade > 0 at 2 x cost | −0.029 | no |
| Floor: >= 3 crosses with >= 3 years of trades, >= 400 pooled trades | 6 crosses, 2129 trades | yes |

## Each cross (2005-09)

| Cross | First candle | n | Gross R | Net R (base) | Month t (base) | Net R (2 x) | Month t (2 x) | Worst DD base (R) | Win % | Stopped % | Median stop (pips) | Gotobi days lost |
|---|---|---|---|---|---|---|---|---|---|---|---|---|
| EUR/JPY | 2005-01-03 | 355 | +0.164 | +0.088 | +1.57 | +0.013 | +0.22 | 9.4 | 50.1 | 27.9 | 27.9 | 5 of 360 |
| GBP/JPY | 2005-01-03 | 355 | +0.237 | +0.173 | +2.86 | +0.109 | +1.80 | 9.3 | 53.0 | 26.8 | 37.4 | 5 of 360 |
| AUD/JPY | 2005-01-03 | 355 | +0.043 | −0.031 | −0.55 | −0.104 | −1.83 | 33.4 | 46.5 | 31.6 | 25.4 | 5 of 360 |
| CAD/JPY | 2005-01-03 | 355 | +0.101 | +0.009 | +0.14 | −0.084 | −1.39 | 23.7 | 47.9 | 30.7 | 20.2 | 5 of 360 |
| CHF/JPY | 2005-01-03 | 355 | +0.208 | +0.097 | +1.83 | −0.015 | −0.27 | 11.5 | 53.8 | 27.0 | 16.5 | 5 of 360 |
| NZD/JPY | 2005-01-03 | 354 | +0.059 | −0.018 | −0.34 | −0.096 | −1.71 | 25.6 | 46.3 | 30.8 | 21.7 | 6 of 360 |

Published-cost case per cross (C2b = published spread + 2 x 0.5 pip slippage, commission on top; EUR/JPY and NZD/JPY have no published figure and take the stand-in, assumed):

| Cross | x C2a (pips) | C2a net R / month t | x C2b (pips) | C2b net R / month t |
|---|---|---|---|---|
| EUR/JPY (stand-in) | 1.39 | +0.085 / +1.51 | 2.39 | +0.046 / +0.82 |
| GBP/JPY | 0.49 | +0.196 / +3.24 | 1.49 | +0.168 / +2.77 |
| AUD/JPY | 0.29 | +0.013 / +0.24 | 1.29 | −0.030 / −0.54 |
| CAD/JPY | 0.49 | +0.052 / +0.87 | 1.49 | −0.002 / −0.03 |
| CHF/JPY | 1.39 | +0.091 / +1.71 | 2.39 | +0.026 / +0.48 |
| NZD/JPY (stand-in) | 1.39 | −0.023 / −0.41 | 2.39 | −0.070 / −1.25 |

## Placebo and every other day (reported, not a condition)

Each seed draws, from each cross's non-gotobi Tokyo business days of the same window, as many days as that cross has gotobi trades and runs the identical leg (#889's design), at the base cost.

| Market | Placebo median net R | Placebo 95th pct (38th of 40) | Gotobi beats | Every non-gotobi day: n | net R | month t |
|---|---|---|---|---|---|---|
| EUR/JPY | −0.074 | −0.013 | 40 of 40 | 855 | −0.074 | −1.97 |
| GBP/JPY | −0.075 | −0.031 | 40 of 40 | 856 | −0.079 | −1.97 |
| AUD/JPY | −0.059 | +0.009 | 31 of 40 | 856 | −0.056 | −1.30 |
| CAD/JPY | −0.138 | −0.092 | 40 of 40 | 856 | −0.138 | −3.49 |
| CHF/JPY | −0.078 | −0.033 | 40 of 40 | 856 | −0.088 | −2.32 |
| NZD/JPY | −0.062 | +0.016 | 33 of 40 | 855 | −0.049 | −1.00 |
| **U pooled** | −0.077 | −0.051 | 40 of 40 | | | |

## By year (net R total at the base cost, gotobi trades)

| Market | 2005 | 2006 | 2007 | 2008 | 2009 |
|---|---|---|---|---|---|
| EUR/JPY | +6.0 | +4.9 | +6.7 | +5.7 | +8.1 |
| GBP/JPY | +8.0 | +11.6 | +6.0 | +22.1 | +13.8 |
| AUD/JPY | −7.0 | −9.9 | −11.2 | +3.6 | +13.6 |
| CAD/JPY | +1.7 | +1.4 | −11.3 | +4.8 | +6.4 |
| CHF/JPY | +10.4 | +4.0 | −0.6 | +12.4 | +8.0 |
| NZD/JPY | −13.8 | −4.1 | −2.7 | +10.3 | +3.8 |
| Pooled | +5.3 (402) | +7.8 (432) | −13.1 (432) | +58.9 (431) | +53.7 (432) |

## Fisher, the multiple-testing ledger's rule

p = 1 − Φ(month t), one-sided; Fisher −2 Σ ln p on 2k df (functions copied from multiple-testing-update/run.mjs). Inputs: #878 T2 t 2.74 (p 0.0031), #889 R2 t 3.8 (p 7.23e-5), #889 R1 t 2.75 (p 0.0030), U t +1.12 (p 0.1314). Bonferroni line of the ledger: p < 1.50e-4.

| Combination | Reading | Fisher p | z | Under Bonferroni |
|---|---|---|---|---|
| #878 T2 + #889 R2 | calendar-disjoint (the ledger's own figure) | 3.63e-6 | +4.49 | yes |
| #878 T2 + U | calendar-disjoint | 0.0036 | +2.69 | no |
| **the weaker of the two (the pre-registered reading)** | U and R2 share 2005-09 on other instruments | **0.0036** | +2.69 | no |
| #878 T2 + #889 R2 + U | upper bound: the same 2005-09 days counted twice | 4.93e-6 | +4.42 | yes |
| #878 T2 + #889 R2 + #889 R1 + U | upper bound: all cells | 2.06e-7 | +5.06 | yes |

## Supporting: NZD/JPY 2010-now (never used by a gotobi study; same calendar days as #878 and #889 R1; not in the verdict or Fisher)

| Window | n | Gross R | Net R (base) | Month t (base) | Net R (2 x) | Month t (2 x) | Worst DD base (R) |
|---|---|---|---|---|---|---|---|
| 2010-01-01 to 2026-11-11 | 1196 | +0.117 | +0.035 | +1.05 | −0.049 | −1.47 | 36.5 |
| 2016-now | 771 | +0.110 | +0.024 | +0.57 | | | |
| 2010-15 | 425 | +0.132 | +0.054 | +1.02 | | | |

Correlation of NZD/JPY's gotobi-day net R with USD/JPY's own T2 trade the same day (2016-now, the gate's trades): 0.51 over 771 days.

## Notes

- Data: OANDA mid M5 through the /md/bars proxy (fetch.mjs), only candles starting 00:00-06:55 UTC kept. U: EUR/JPY from 2005-01-03, GBP/JPY from 2005-01-03, AUD/JPY from 2005-01-03, CAD/JPY from 2005-01-03, CHF/JPY from 2005-01-03, NZD/JPY from 2005-01-03, through 2009-12-31. N: NZD/JPY 2009-11-02 to 2026-11-12. Gate: USD/JPY 2015-11-02 to 2026-11-12.
- Costs: the frozen formula (0.3 pip spread + 2 x 0.5 pip slippage + 2 x USD 22.5 per million a side, the original 1.30-pip assumption) on every cross; the 0.3 pip spread is assumed, not measured, for every cross. Before costs U makes +0.135R a trade; the base cost takes 0.082R; at twice the cost −0.029R. The C2 figures are gotobi-cost's published all-day averages (web search summaries, not measured, none for EUR/JPY or NZD/JPY).
- Placebo (reported, not a condition): U's pooled +0.053R a trade is above the 95th percentile of 40 seeded draws of non-gotobi days (−0.051R; beats 40 of 40).
- Read after the verdict, not part of it: before costs U has month t +2.87 (+0.135R a trade) and the gotobi days beat all 40 placebo draws, so on these pair-years the gotobi mornings are better than ordinary ones before costs; what fails is the cost bar: at the assumed 1.30 pips the pooled month t is +1.12 and at twice the cost the pooled figure is negative. Crosses split: GBP/JPY, CHF/JPY and EUR/JPY positive at the base cost, CAD/JPY about zero (+0.009R), AUD/JPY and NZD/JPY below zero, as on 2010-26 (#889: AUD/JPY weakest). 2007 is the one losing year of the pool.
- Read after the verdict: U is new pair-years, not new calendar years. The crosses' gotobi-day results move with USD/JPY's on the same day (#889: correlation 0.5-0.8 on 2010-now), and #889 R2 already measured USD/JPY on these 2005-09 days, so U is mostly a second look at the same yen flow on the same mornings, through other pairs. The month t is on calendar-month sums of net R across the six crosses, which carries that correlation; the trade t treats every trade as independent and is shown only.
- Worst drawdown: the largest peak-to-trough fall of cumulative R, the pooled trades in order of entry time then pair (six trades of a gotobi morning count one after another), at a fixed 1R a trade.
- No calendar year with intraday USD/JPY data is unused: OANDA serves one stub candle a day before 2005 (20:55 UTC, nothing at 00:55 or 06:00), council-data HistData USD/JPY covers 2018-26 only (used by #894 / #912), and Dukascopy is not reachable from this sandbox.
