# Formal-FOMC exclusion: declared Treasury-study sensitivity

The predeclared formal-statement filter leaves a **+2.24 basis-point** mean contrast in absolute daily 10-year real par-yield changes across **35 scored CPI dates**, versus +2.06 bp across all 36 in the [primary study](treasury-cpi-calendar-study-2022-2024.md). Mean event movement is 6.20 bp; the mean of the surviving within-event control averages is 3.96 bp. This is a narrower descriptive comparison, with no separately claimed confidence interval or causal interpretation.

All 36 intended month slots remain in the ledger. The filter removes **12 June 2024** as an event window: the [official FOMC statement at 14:00 EDT](https://www.federalreserve.gov/newsevents/pressreleases/monetary20240612a.htm) lies between the preceding weekday's approximate 15:30 New York quote proxy and that day's proxy. Nine originally matched control dates also contain formal statements and are removed. Every remaining control comes from its original matched set; none is replaced or rematched. Every retained event still has at least one control.

| Item | Result |
|---|---:|
| Original unique event/control intervals audited | 133 |
| Formal statements in reconciled official calendar | 24 |
| Intended / scored CPI events | 36 / 35 |
| Removed event windows | 1 |
| Removed original control dates | 9 |
| Mean absolute event change | 6.20 bp |
| Mean of surviving event-control means | 3.96 bp |
| Equal-event mean contrast | +2.24 bp |
| Positive contrasts | 19 / 35 |

Removed control dates are 26 January, 4 May and 27 July 2022; 3 May, 26 July and 20 September 2023; and 1 May, 18 September and 18 December 2024. Exact interval endpoints, hits, original/surviving control lists and all recomputed contrasts are in the [variant JSON](treasury-cpi-fomc-variant-2022-2024.json).

## Why the calendar gate passed

The official [meeting calendar](https://www.federalreserve.gov/monetarypolicy/fomccalendars.htm) and three annual FOMC release archives identify the same 24 formal statements. The separate full annual press archives were also screened for Monetary Policy/FOMC entries, including unscheduled announcements; the union contained 108 relevant unique entries requiring classification. Every formal statement's own page supplied its date and 14:00 EST/EDT header, checked against New York daylight time. No unresolved formal-statement URL or classification remained. The source review checked 56 saved-body hashes.

The annual default press pages alone omit the separate formal-statement entries. Older historical-year pages returning 404 were not treated as empty calendars. The successful current meeting calendar and complementary release archives supplied the reconciliation. See `work/fomc-overlap-calendar-2022-2024.md` and its machine-readable calendar for the source counts, classifications and receipts.

This is complete **for formal FOMC policy statements in the currently published official sources**. It is not complete Fed-news coverage. Three unscheduled March 2023 funding/liquidity/joint announcements were preserved separately, alongside framework, balance-sheet and projection supplements; they were not silently relabeled formal statements. Speeches, minutes, Board actions, other macro releases and unscheduled news still matter. The broader macro-exclusion gate remains incomplete.

## Interval and reporting limits

A statement strictly inside a window excludes it; equality with either endpoint is treated as boundary ambiguity. A 14:00 statement on the preceding day is before the 15:30 start and does not exclude a following-day window merely because that calendar date had a statement. Six bounded interval tests passed, including both boundaries, equivalent timezones and the source-coverage edge.

The formal filter changes both the event and control composition. Its positive estimate does not convert the remainder into isolated CPI shocks or establish that FOMC news explained a particular difference. Official release headers and Treasury's approximate quote proxies are not exact network receipt/trade timestamps. No new endpoint, control rule, rate series or uncertainty method was chosen after the results.

Run `python outputs/scripts/treasury-cpi-fomc-variant.py` from the workspace root after the primary source/binding checks. The main result JSON, frozen protocol and amendment remain unchanged; this sensitivity is a separate artifact. Independent reconstruction in `work/treasury-fomc-variant-independent.json` passed **1,345 checks with zero failures**, including all 133 interval classifications, exclusions and 35 scored contrasts. Its own calculation was saved before reading the root variant. The [validation record](treasury-cpi-validation-2026-11-09.json) binds the result and audit hashes.
