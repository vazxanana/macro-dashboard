# Nearness to the 52-week high on commodities and currencies: result

**Verdict: FAIL: nearness to the 52-week high, combined commodity + FX book, −0.029R a month net out of sample 2017-26 (n 118, t −1.12), −0.003R in sample; 0 of 4 tests pass.**

Paper research only. No live rule, size, filter, council member or page changed. Rule, sets, costs, windows and the four tests were fixed in `PREREGISTRATION.md`, pushed alone before any position was simulated. Data: council-data `research/daily/*.json` (commit `e08b7aeb9`), OANDA mid daily candles, weekend stubs folded into Monday, to 2026-10.

**Related.** `high52-rotation` (#853) and `index-52w-high` (#911) tested this ranking on equity indices and failed; `commodity-xs-momentum` and `fx-xs-momentum` tested the past-return ranking on these groups and failed. The 12-1 momentum control below uses this study's own construction.

## The four tests (R a month, mean of the legs; combined = mean of the two group books)

| Test | Window | Months | Gross R | Net R | Net t | Total net R | Worst drawdown R | OOS net at 2x costs | One-sided p | Holm p | Pass |
|---|---|---|---|---|---|---|---|---|---|---|---|
| T1 Nearness, combined (primary) | IS 2005-07 to 2016-12 | 138 | +0.042 (t +1.44) | −0.003 | −0.10 | −0.40 | −5.13 | | | | |
| | OOS 2017-01 to 2026-10 | 118 | +0.027 (t +1.01) | −0.029 | −1.12 | −3.42 | −6.61 | −0.085 (t −3.31) | 0.8686 | 1 | no |
| T2 Nearness, commodities alone | IS 2005-07 to 2016-12 | 138 | +0.085 (t +2.37) | +0.048 | +1.33 | +6.59 | −3.75 | | | | |
| | OOS 2017-01 to 2026-10 | 118 | +0.046 (t +1.35) | +0.006 | +0.19 | +0.77 | −4.01 | −0.034 (t −0.98) | 0.4247 | 1 | no |
| T3 Nearness, currencies alone | IS 2005-07 to 2016-12 | 138 | −0.002 (t −0.06) | −0.053 | −1.36 | −7.38 | −10.21 | | | | |
| | OOS 2017-01 to 2026-10 | 118 | +0.007 (t +0.18) | −0.064 | −1.74 | −7.60 | −10.16 | −0.136 (t −3.71) | 0.9591 | 1 | no |
| T4 Residual nearness, combined | IS 2005-07 to 2016-12 | 138 | +0.052 (t +2.09) | +0.006 | +0.24 | +0.80 | −4.88 | | | | |
| | OOS 2017-01 to 2026-10 | 118 | +0.009 (t +0.41) | −0.046 | −1.98 | −5.38 | −5.85 | −0.101 (t −4.40) | 0.9761 | 1 | no |

Pass bar (pre-registered, judged on T1): OOS net mean > 0 with t >= 2 and Holm p < 0.05, the in-sample net mean of the same sign, and the OOS mean > 0 at 2x costs and financing.

| Check | T1 | T2 | T3 | T4 |
|---|---|---|---|---|
| oosPositive | no | yes | no | no |
| oosT2 | no | no | no | no |
| holm05 | no | no | no | no |
| isSameSign | yes | yes | yes | no |
| x2Positive | no | no | no | no |

## Placebo (40 seeds, random ordering within each group each month, same thirds, stops and costs, combined OOS net t)

| p5 | p50 | p95 | max | T1 real | Seeds at or above the real |
|---|---|---|---|---|---|
| −4.91 | −3.12 | −1.65 | −1.65 | −1.12 | 0 of 40 |

## Control: 12-1 momentum, same construction (reported, not a test)

| Book | IS gross | IS net (t) | OOS gross | OOS net (t) | OOS net at 2x |
|---|---|---|---|---|---|
| Combined | +0.003 | −0.040 (−1.45) | +0.031 | −0.023 (−0.73) | −0.077 |
| Commodities | +0.020 | −0.016 (−0.52) | +0.014 | −0.025 (−0.61) |  |
| Currencies | −0.014 | −0.063 (−1.47) | +0.049 | −0.021 (−0.50) |  |

Monthly correlation of the combined nearness and momentum books, OOS net: 0.63.

## Costs, and the book without the exotic currencies (T1, descriptive)

| Variant | IS net (t) | OOS net (t) |
|---|---|---|
| No costs, no financing | +0.042 (+1.44) | +0.027 (+1.01) |
| Base (decides) | −0.003 (−0.10) | −0.029 (−1.12) |
| 2x costs and financing | −0.047 (−1.67) | −0.085 (−3.31) |
| G10 currencies only (no NOK SEK PLN SGD MXN ZAR TRY) | −0.004 (−0.15) | −0.051 (−2.05) |

## Legs, OOS (nearness)

| Group | Legs | Won % | Stopped % | Gross R | Cost R | Financing R | Net R |
|---|---|---|---|---|---|---|---|
| Commodities | 944 | 46.8 | 29.9 | +0.046 | 0.0085 | 0.0314 | +0.006 |
| Currencies | 2596 | 43.6 | 31.5 | +0.007 | 0.0221 | 0.0491 | −0.064 |

## Per year (T1 combined, sum of monthly R; momentum control net beside it)

| Year | Months | Gross | Net | Momentum net |
|---|---|---|---|---|
| 2005 | 6 | +1.72 | +1.42 | +0.87 |
| 2006 | 12 | +2.38 | +1.80 | −1.61 |
| 2007 | 12 | −0.59 | −1.17 | −0.27 |
| 2008 | 12 | +2.70 | +2.31 | +0.21 |
| 2009 | 12 | −0.20 | −0.58 | −0.95 |
| 2010 | 12 | +0.45 | −0.02 | −0.32 |
| 2011 | 12 | −1.27 | −1.70 | −1.20 |
| 2012 | 12 | −0.90 | −1.55 | −2.19 |
| 2013 | 12 | +1.39 | +0.77 | +1.43 |
| 2014 | 12 | −0.61 | −1.32 | −1.68 |
| 2015 | 12 | −0.05 | −0.56 | +0.81 |
| 2016 | 12 | +0.72 | +0.21 | −0.56 |
| 2017 | 12 | −0.76 | −1.41 | −1.34 |
| 2018 | 12 | −1.11 | −1.79 | −1.00 |
| 2019 | 12 | −1.22 | −1.95 | −0.88 |
| 2020 | 12 | +1.90 | +1.33 | +0.43 |
| 2021 | 12 | +0.46 | −0.18 | −0.77 |
| 2022 | 12 | +0.01 | −0.52 | −0.40 |
| 2023 | 12 | +0.15 | −0.40 | −0.50 |
| 2024 | 12 | −0.49 | −1.15 | −0.73 |
| 2025 | 12 | +2.41 | +1.67 | +2.09 |
| 2026 | 10 | +1.78 | +1.00 | +0.40 |

## Reading

- Before any cost the combined nearness book made +0.027R a month out of sample (t +1.01) and +0.042R in sample (t +1.44): small, and not significant in either window. Costs and financing (mostly financing on the currency legs) take it below zero.
- The placebo books are all negative (they pay the same costs). T1's OOS t (−1.12) sits above 40 of 40 random orderings: the ranking picked better than random markets did, but not by enough to cover the same costs, so the book still loses. Not part of the bar; it does not change the verdict.
- Commodities alone (T2) were the best part: +0.048R in sample, +0.006R out of sample (t +0.19), negative at 2x costs. Currencies (T3) lost in both windows. The residual version (T4) lost out of sample.
- Nearness and 12-1 momentum books move together (OOS monthly correlation 0.63); neither earns net of costs on these groups.
- No variant (another look-back, other thirds, carry-inclusive financing) is proposed: any would be a new study with its own pre-registration on data it was not chosen on.

## What this cannot show

- Carry: every currency leg pays a flat 0.004 % a night, long or short; true rate differentials (large on TRY, ZAR, MXN) are not in the test. Commodity CFDs embed their futures roll in the price; financing is a flat 3 % a year.
- Nearness is on the pair as quoted: a cross and its inverse would rank in opposite order, so the currency result depends on OANDA's quoting convention. This was fixed in advance, not chosen.
- The published effect is on thousands of stocks; 12 commodities and 35 overlapping pairs are a narrow, correlated cross-section.
- Not an edge in the council and no forward record. Nothing is proposed.

To repeat: `node research/edge/high52-cmdfx/run.mjs` (reads council-data with `git show`, writes `result.json` and `RESULT.md`). Tests: `tests/high52-cmdfx.test.mjs`.
