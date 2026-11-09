# CPI dates and daily Treasury yield movements, 2022–2024

Across the 36 CPI release dates, the mean absolute daily 10-year real par-yield change was **6.11 basis points**, versus **4.06 bp** for each event's calendar-matched comparison average. The equally weighted difference is **+2.06 bp**. This is a descriptive daily release-calendar association. It does not isolate CPI causality, identify an inflation-surprise shock, measure a gold response or demonstrate trading profit.

One basis point is 0.01 percentage point of yield. A yield change is not a bond total return.

## Primary result and uncertainty

| Statistic | Result |
|---|---:|
| Intended / scored events | 36 / 36 |
| Mean event absolute change | 6.11 bp |
| Mean of within-event control averages | 4.06 bp |
| Equal-event mean contrast | +2.06 bp |
| Median event contrast | 1.00 bp |
| Positive event contrasts | 20 / 36 |
| Approximate 95% circular-block interval, 3 months | [0.20, 3.96] bp |
| Declared 6-month-block interval | [0.13, 3.90] bp |

Both intervals use 10,000 draws under the frozen deterministic procedure. They are approximate resampling displays for 36 months, not randomization inference or a probability that CPI caused the contrast. Their lower bounds are close to zero. Regime shifts, limited sample size, unmatched news exposure and the circular wrap limit interpretation. No p-value or forecast-skill claim is reported.

## Stability and declared comparisons

| Release year | Event absolute mean | Matched mean | Contrast | Positive / scored |
|---|---:|---:|---:|---:|
| 2022 | 6.75 bp | 5.49 bp | +1.26 bp | 5 / 12 |
| 2023 | 6.83 bp | 3.37 bp | +3.47 bp | 9 / 12 |
| 2024 | 4.75 bp | 3.31 bp | +1.44 bp | 6 / 12 |

The 2022 median contrast was −1.00 bp, despite its positive mean: this pattern is not uniform across events. Leaving one event out gives contrasts from +1.66 to +2.25 bp. Leaving one year out remains positive; excluding 2023 leaves +1.35 bp. These are influence descriptions, not selection of a preferred subperiod.

Excluding 15 May 2024, when a subset of CPI files was posted early, leaves **+1.99 bp** across 35 scored events while retaining all 36 intended slots. The pre-event placebo gives **-1.85 bp** across 33 scored slots. Two March placebos lack an exact DST-spanning control; the November 2024 placebo lacks its required preceding weekday observation. No matching rule was relaxed. The placebo does not show comparable positive concentration in this particular comparison; it does not prove causality.

The predeclared secondary 2-year nominal-yield contrast is **+5.39 bp** across 36 events (10.47 versus 5.08 bp). It is descriptive and has no separately claimed confidence interval. The maturities differ: subtracting this series from the real 10-year series would not produce a matched-maturity inflation-compensation measure.

The [predeclared formal-FOMC exclusion](treasury-cpi-fomc-exclusion-2022-2024.md) now passes its statement-calendar gate: filtering one event window and nine original control dates leaves +2.24 bp across 35 scored events, without rematching or a new CI. Its independently checked result is separate from the unchanged primary snapshot. The broader core-release exclusion remains unavailable without complete calendar coverage. Unknown overlap is never labeled clean.

## What was fixed before calculation

The [locally frozen retrospective protocol](treasury-cpi-study-protocol-2022-2024.json) was adopted at 00:17:28 UTC on 9 November 2026, before downloading the study series or calculating differences. Incidental historical level snippets were disclosed. This is not a pre-2022 registration or untouched holdout. Its [preserved amendment](treasury-cpi-study-amendment-01-2026-11-09.json), adopted at 00:20:27, changes only the official-format binding check after old HTML requests returned empty tables; outcomes still use the original official XML.

For each event, compare the absolute change from the immediately preceding Monday–Friday calendar date to the release date. Both required observations must exist; no missing weekday is bridged or filled. Controls share year-month, weekday, calendar gap, both New York UTC offsets and proxy interval length. CPI dates and their nearest valid observation neighbors are excluded from controls. All remaining controls are used; no minimum was raised above the frozen one-control rule. The control-count distribution is 2 events with one control, 12 with two, 17 with three and 5 with four. Average controls within each event first, then weight events equally.

The [coverage ledger](treasury-cpi-coverage-2022-2024.json) was saved before differences were computed. All 36 actual windows passed in each series. Each series has 749 valid source dates; absent fixed-calendar weekdays remain explicit (11 in 2022, 10 in 2023 and 12 in 2024). These are missing under the fixed weekday rule, not a verified Treasury holiday calendar.

## Sources, clocks and reproducibility

Treasury describes indicative input quotes around 15:30 New York, while website availability is usually later. The dated 15:30 endpoints here are approximate proxies, independently converted for DST. `NEW_DATE` midnight labels are not quote or publication times. No complete exceptional/early-close clock audit is claimed. Current methodology prose postdates the sample. [Treasury definitions](https://home.treasury.gov/policy-issues/financing-the-government/interest-rate-statistics), [methodology and availability](https://home.treasury.gov/policy-issues/financing-the-government/interest-rate-statistics/treasury-yield-curve-methodology).

Source inputs are the [official annual XML feeds](https://home.treasury.gov/treasury-daily-interest-rate-xml-feed). Exact Decimal checks produced 1,498 selected-date/value agreements against official archived CSV for 2022–2023 and semantic HTML tables for 2024. The [Treasury archive](https://home.treasury.gov/resource-center/data-chart-center/interest-rates/daily-treasury-rate-archives) is needed because the current old-year HTML requests return no table. This verifies same-producer format consistency, not independent-source truth or original-day bytes.

Captured application-body hashes, receipts and 19 Treasury source files are retained. Transport Content-Length differences are not claimed as wire-byte authentication. The [validation record](treasury-cpi-validation-2026-11-09.json) binds the independent field/source/control reconstruction and bootstrap reports: 4,683 outcome checks, 30 actual-bootstrap comparisons, twelve Python tests and seven cross-language synthetic fixtures passed in their stated scopes. The separate formal-FOMC variant adds 1,345 independent checks and six root interval tests.

From the workspace root, with Python 3.12+ and IANA zoneinfo data available:

```sh
python outputs/scripts/treasury-cpi-study.py coverage
python outputs/scripts/treasury-cpi-study.py evaluate
python outputs/scripts/test_treasury_cpi_study.py
```

The current source vintage is a retrospective archive. CPI/Real Earnings are an information bundle; other releases, policy communications and unscheduled news remain within daily windows. Same-window USD/rate controls were not added to manufacture a causal CPI residual. A separate first-print CPI ledger exists, but its values and Cleveland model forecast errors do not enter this primary statistic. Gold-use and benchmark-clock questions remain separate. Live trading remains disabled.

## Event-level primary results

| CPI release | Signed real-yield change | Absolute change | Matched absolute mean | Contrast | Controls |
|---|---:|---:|---:|---:|---:|
| 2022-01-12 | +5.00 | 5.00 | 7.00 | -2.00 | 3 |
| 2022-02-10 | +6.00 | 6.00 | 5.00 | +1.00 | 3 |
| 2022-03-10 | +2.00 | 2.00 | 2.00 | +0.00 | 1 |
| 2022-04-12 | -2.00 | 2.00 | 5.67 | -3.67 | 3 |
| 2022-05-11 | -13.00 | 13.00 | 6.33 | +6.67 | 3 |
| 2022-06-10 | +10.00 | 10.00 | 2.33 | +7.67 | 3 |
| 2022-07-13 | -4.00 | 4.00 | 8.33 | -4.33 | 3 |
| 2022-08-10 | +2.00 | 2.00 | 5.50 | -3.50 | 4 |
| 2022-09-13 | +3.00 | 3.00 | 5.00 | -2.00 | 2 |
| 2022-10-13 | +1.00 | 1.00 | 5.67 | -4.67 | 3 |
| 2022-11-10 | -27.00 | 27.00 | 11.00 | +16.00 | 1 |
| 2022-12-13 | -6.00 | 6.00 | 2.00 | +4.00 | 2 |
| 2023-01-12 | -9.00 | 9.00 | 3.00 | +6.00 | 3 |
| 2023-02-14 | +5.00 | 5.00 | 4.50 | +0.50 | 2 |
| 2023-03-14 | +2.00 | 2.00 | 4.00 | -2.00 | 2 |
| 2023-04-12 | +0.00 | 0.00 | 2.67 | -2.67 | 3 |
| 2023-05-10 | -4.00 | 4.00 | 2.75 | +1.25 | 4 |
| 2023-06-13 | +8.00 | 8.00 | 1.50 | +6.50 | 2 |
| 2023-07-12 | -15.00 | 15.00 | 3.00 | +12.00 | 2 |
| 2023-08-10 | +10.00 | 10.00 | 5.00 | +5.00 | 4 |
| 2023-09-13 | -3.00 | 3.00 | 2.00 | +1.00 | 3 |
| 2023-10-12 | +10.00 | 10.00 | 3.67 | +6.33 | 3 |
| 2023-11-14 | -16.00 | 16.00 | 5.33 | +10.67 | 3 |
| 2023-12-12 | +0.00 | 0.00 | 3.00 | -3.00 | 2 |
| 2024-01-11 | -6.00 | 6.00 | 3.00 | +3.00 | 3 |
| 2024-02-13 | +9.00 | 9.00 | 3.50 | +5.50 | 2 |
| 2024-03-12 | +3.00 | 3.00 | 1.50 | +1.50 | 2 |
| 2024-04-10 | +15.00 | 15.00 | 2.67 | +12.33 | 3 |
| 2024-05-15 | -7.00 | 7.00 | 2.75 | +4.25 | 4 |
| 2024-06-12 | -3.00 | 3.00 | 4.00 | -1.00 | 2 |
| 2024-07-11 | -6.00 | 6.00 | 1.00 | +5.00 | 2 |
| 2024-08-14 | +1.00 | 1.00 | 3.67 | -2.67 | 3 |
| 2024-09-11 | -2.00 | 2.00 | 4.67 | -2.67 | 3 |
| 2024-10-10 | -1.00 | 1.00 | 3.00 | -2.00 | 4 |
| 2024-11-13 | +1.00 | 1.00 | 3.00 | -2.00 | 3 |
| 2024-12-11 | +3.00 | 3.00 | 7.00 | -4.00 | 2 |

All changes and contrasts in the table are basis points. Full control dates, individual changes, rejected candidates, placebo rows and influence variants are in the [result JSON](treasury-cpi-results-2022-2024.json).

Result snapshot SHA-256: `1ecf48b3ff355dcaf9452bc74d8d39fc50a9a5fac9e9c9a4f936cea8270e4d33`.
