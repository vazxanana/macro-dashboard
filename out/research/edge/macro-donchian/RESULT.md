# The macro rule book's Donchian swing rule on gold (OANDA spot, net of costs)

Paper research only; a stand-alone rule, not part of the live gold book. The rule, costs, tests and placebo were pushed first (`PREREGISTRATION.md`). This page is written by `run.mjs`.

**Verdict: FAIL: longs +0.082R a trade net (n 170, month t +1.35; failed: t2, placebo, holm); score split fails (t +0.02)**

| Stream | n | Win | Net R/trade | Gross R/trade | Total R | PF | t (months) |
|---|---|---|---|---|---|---|---|
| Longs 2007 → end | 170 | 51.8 % | +0.082 | +0.124 | +13.93 | 1.29 | +1.35 |
| Longs 2007-16 | 84 | 48.8 % | +0.036 | +0.073 | +2.99 | 1.12 | +0.50 |
| Longs 2017 → end | 86 | 54.7 % | +0.127 | +0.174 | +10.94 | 1.46 | +1.30 |
| Shorts 2007 → end | 80 | 45.0 % | −0.005 | −0.002 | −0.43 | 0.98 | −0.07 |
| Shorts 2007-16 | 43 | 44.2 % | +0.030 | +0.034 | +1.30 | 1.09 | +0.27 |
| Shorts 2017 → end | 37 | 45.9 % | −0.047 | −0.043 | −1.73 | 0.82 | −0.52 |

T1 checks: netPos yes, t2 no, halves yes, placebo no, holm no (Holm p 0.353).

Placebo (random longs in the same up-trend, 40 seeds): median +0.078R, 95th percentile +0.152R, range +0.008 to +0.159R.

T2, the score's sizing claim: longs with score > +0.25 +0.083R (n 55, 60 % won) against +0.080R (n 108, 46 % won); Welch t +0.02, Holm p 0.981: fails. Longs before the score's first reading: 7.

## Longs by year

| Year | n | Net R/trade | Total |
|---|---|---|---|
| 2007 | 14 | +0.237 | +3.32 |
| 2008 | 9 | −0.217 | −1.95 |
| 2009 | 15 | +0.065 | +0.97 |
| 2010 | 13 | +0.044 | +0.57 |
| 2011 | 11 | +0.145 | +1.59 |
| 2012 | 7 | −0.163 | −1.14 |
| 2013 | 1 | −0.081 | −0.08 |
| 2014 | 5 | −0.234 | −1.17 |
| 2015 | 3 | +0.466 | +1.40 |
| 2016 | 6 | −0.088 | −0.53 |
| 2017 | 7 | −0.155 | −1.08 |
| 2018 | 7 | −0.128 | −0.89 |
| 2019 | 7 | +0.324 | +2.27 |
| 2020 | 9 | +0.369 | +3.32 |
| 2021 | 7 | −0.260 | −1.82 |
| 2022 | 6 | −0.257 | −1.54 |
| 2023 | 9 | +0.200 | +1.80 |
| 2024 | 12 | +0.279 | +3.35 |
| 2025 | 17 | +0.250 | +4.25 |
| 2026 | 5 | +0.262 | +1.31 |

## Reading

The rule book quotes +0.24R a trade on 174 longs before costs (futures, 2007-26). On OANDA spot, folded trading days, the same rule gives 170 longs at +0.124R before costs and +0.082R after costs and financing (month t +1.35); random longs in the same up-trend made +0.078R (95th percentile +0.152R). Shorts −0.005R (n 80). Not supported as an edge on this data; nothing live changes.
