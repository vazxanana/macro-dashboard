# USD/JPY: the weekly volatility breakout (week open ± 0.5 × the previous week's range)

Paper research only. `gold-weekly-vol-breakout`'s weekly rule (T1), imported unchanged, on USD/JPY: the one forex market where the daily T1 holds. Rule, costs, windows, control and bar were pushed first (`PREREGISTRATION.md`, sha256 in `result.json`). Nothing live changed. Written by `run.mjs` from `result.json`.

**Verdict: FAIL: USD/JPY weekly breakout (week open ± 0.5 × prior week range) 2015 → now +0.037R a trade after costs and financing (n 486, month t +0.69); 2005-14 +0.036R (n 390, t +0.61)**

| Window | n | Win | Gross R | After cost, before financing | Net R (after both) | Net 2x | Cost R | Financing R | Total R | Month t (net) | Month t (gross) | Month t (before fin.) | Max DD R | Median stop pips | Buys | Sells |
|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|
| Discovery 2005-2014 | 390 | 42.8 % | +0.058 | +0.046 | +0.036 | +0.014 | +0.012 | +0.010 | +14.01 | +0.61 | +0.99 | +0.79 | −20.46 | 87.35 | 183 +0.085 | 207 −0.007 |
| Confirmation 2015 → 2026-11-22 | 486 | 44.0 % | +0.062 | +0.050 | +0.037 | +0.012 | +0.013 | +0.012 | +18.10 | +0.69 | +1.16 | +0.92 | −25.40 | 93 | 266 +0.030 | 220 +0.046 |

## Decision (confirmation)

One-sided p 0.245, Holm (one test) 0.245. Placebo (40 seeds, random 5-minute entry in the same week, the real 1R, the same costs): beats 31 of 40 (38 needed); placebo median +0.010, 95th percentile +0.056.

Checks: positive in both windows yes, month t ≥ 2 no, Holm < 0.05 no, n ≥ 200 yes, 2x cost > 0 yes, placebo no.

## Correlation with the daily USD/JPY T1 (descriptive)

Daily T1 (k 0.5, out at 21:00 UTC, `fx-vol-breakout` cost) net R summed by the same Monday-keyed week, against the weekly trade's net R (weeks where both traded); and calendar-month sums (months where both traded).

| Window | Daily T1 n / net R | Weeks | Weekly corr | Months | Monthly corr |
|---|---|---|---|---|---|
| 2005-2014 | 1894 / +0.092 | 390 | +0.270 | 120 | +0.245 |
| 2015 → now | 2274 / +0.055 | 486 | +0.223 | 143 | +0.197 |
| All | 4169 / +0.072 | 876 | +0.244 | 263 | +0.217 |

## By year (net R a trade, n)

| Year | n | Net R | Total |
|---|---|---|---|
| 2005 | 40 | −0.002 | −0.06 |
| 2006 | 38 | +0.263 | +10.00 |
| 2007 | 39 | +0.313 | +12.21 |
| 2008 | 36 | −0.190 | −6.86 |
| 2009 | 36 | +0.156 | +5.63 |
| 2010 | 39 | −0.118 | −4.60 |
| 2011 | 41 | −0.132 | −5.40 |
| 2012 | 41 | +0.090 | +3.68 |
| 2013 | 40 | −0.225 | −8.99 |
| 2014 | 40 | +0.210 | +8.41 |
| 2015 | 42 | −0.040 | −1.70 |
| 2016 | 39 | +0.363 | +14.14 |
| 2017 | 41 | −0.051 | −2.08 |
| 2018 | 42 | +0.233 | +9.79 |
| 2019 | 39 | +0.021 | +0.83 |
| 2020 | 38 | +0.068 | +2.57 |
| 2021 | 41 | −0.153 | −6.27 |
| 2022 | 42 | +0.254 | +10.68 |
| 2023 | 44 | −0.229 | −10.07 |
| 2024 | 38 | +0.379 | +14.41 |
| 2025 | 43 | −0.372 | −15.98 |
| 2026 | 37 | +0.048 | +1.77 |

Skipped weeks: noprev 1, nofill 265, thin 1.

## Reading

The weekly rule does not carry the daily result to USD/JPY on the pre-registered bar (failed: t2, holm, placebo). Nothing is tuned after this; no other k or side is looked at on these years. Any before-cost tilt is not an edge.

Data: OANDA mid USD/JPY M5 (edgekit cache), 2005-01-02 → 2026-11-22. Cost: 0.000045 × entry + 0.005 a round trip (fx-vol-breakout). Financing: ASSUMED 1 % a year of the entry either side, nights() rollovers (Wednesday three); not measured on the broker. Weeks keyed by their Monday; month t on exit months.
