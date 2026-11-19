# Independent NBU–CPI reference-clock audit

**Conditional reference-clock arithmetic only.** Used JavaScript Intl, with only CPI release dates/scheduled UTC and NBU date pairs selected. No prices, forecast values, outcomes or returns were accessed.

Node 24.16.0; ICU 78.3; CLDR 48.0; timezone data 2026b. Europe/Kyiv resolves as Europe/Kiev. All UTC conversions passed full component round trips.

Gaps are reference-clock UTC minus BLS scheduled UTC, in minutes. Hypotheses are (A) clocks on the CPI calendar date and (B) clocks on the paired calcdate label treated hypothetically as a Kyiv calendar day. Neither is actual quote/publication evidence.

The post-4-January default is 15:00 BFIX and 15:30 website deadline. Frozen-rule days 24 February–20 March 2022 are excluded from fresh-clock interpretation. March 10 2022 remains flagged.

## Summary

{
  "events": 36,
  "conditional_default_cases": 35,
  "frozen_cases": [
    "2022-03-10"
  ],
  "same_date_BFIX_all": {
    "30": 2,
    "-30": 34
  },
  "same_date_deadline_all": {
    "0": 34,
    "60": 2
  },
  "conditional_same_date_BFIX": {
    "30": 2,
    "-30": 33
  },
  "conditional_same_date_deadline": {
    "0": 33,
    "60": 2
  },
  "paired_calcdate_BFIX_all": {
    "-1470": 34,
    "-1410": 2
  },
  "paired_calcdate_deadline_all": {
    "-1440": 34,
    "-1380": 2
  },
  "conditional_paired_calcdate_BFIX": {
    "-1470": 33,
    "-1410": 2
  },
  "conditional_paired_calcdate_deadline": {
    "-1440": 33,
    "-1380": 2
  }
}

## Per-event arithmetic

| CPI date | Scheduled UTC | Same-date BFIX UTC / gap | Same-date deadline UTC / gap | Paired calcdate | Paired BFIX UTC / gap | Paired deadline UTC / gap | Qualification |
|---|---|---|---|---|---|---|---|
| 2022-01-12 | 2022-01-12T13:30:00Z | 2022-01-12T13:00Z / -30 | 2022-01-12T13:30Z / 0 | 2022-01-11 | 2022-01-11T13:00Z / -1470 | 2022-01-11T13:30Z / -1440 | Conditional references only |
| 2022-02-10 | 2022-02-10T13:30:00Z | 2022-02-10T13:00Z / -30 | 2022-02-10T13:30Z / 0 | 2022-02-09 | 2022-02-09T13:00Z / -1470 | 2022-02-09T13:30Z / -1440 | Conditional references only |
| 2022-03-10 | 2022-03-10T13:30:00Z | 2022-03-10T13:00Z / -30 | 2022-03-10T13:30Z / 0 | 2022-03-09 | 2022-03-09T13:00Z / -1470 | 2022-03-09T13:30Z / -1440 | FROZEN: excluded from fresh-clock interpretation |
| 2022-04-12 | 2022-04-12T12:30:00Z | 2022-04-12T12:00Z / -30 | 2022-04-12T12:30Z / 0 | 2022-04-11 | 2022-04-11T12:00Z / -1470 | 2022-04-11T12:30Z / -1440 | Conditional references only |
| 2022-05-11 | 2022-05-11T12:30:00Z | 2022-05-11T12:00Z / -30 | 2022-05-11T12:30Z / 0 | 2022-05-10 | 2022-05-10T12:00Z / -1470 | 2022-05-10T12:30Z / -1440 | Conditional references only |
| 2022-06-10 | 2022-06-10T12:30:00Z | 2022-06-10T12:00Z / -30 | 2022-06-10T12:30Z / 0 | 2022-06-09 | 2022-06-09T12:00Z / -1470 | 2022-06-09T12:30Z / -1440 | Conditional references only |
| 2022-07-13 | 2022-07-13T12:30:00Z | 2022-07-13T12:00Z / -30 | 2022-07-13T12:30Z / 0 | 2022-07-12 | 2022-07-12T12:00Z / -1470 | 2022-07-12T12:30Z / -1440 | Conditional references only |
| 2022-08-10 | 2022-08-10T12:30:00Z | 2022-08-10T12:00Z / -30 | 2022-08-10T12:30Z / 0 | 2022-08-09 | 2022-08-09T12:00Z / -1470 | 2022-08-09T12:30Z / -1440 | Conditional references only |
| 2022-09-13 | 2022-09-13T12:30:00Z | 2022-09-13T12:00Z / -30 | 2022-09-13T12:30Z / 0 | 2022-09-12 | 2022-09-12T12:00Z / -1470 | 2022-09-12T12:30Z / -1440 | Conditional references only |
| 2022-10-13 | 2022-10-13T12:30:00Z | 2022-10-13T12:00Z / -30 | 2022-10-13T12:30Z / 0 | 2022-10-12 | 2022-10-12T12:00Z / -1470 | 2022-10-12T12:30Z / -1440 | Conditional references only |
| 2022-11-10 | 2022-11-10T13:30:00Z | 2022-11-10T13:00Z / -30 | 2022-11-10T13:30Z / 0 | 2022-11-09 | 2022-11-09T13:00Z / -1470 | 2022-11-09T13:30Z / -1440 | Conditional references only |
| 2022-12-13 | 2022-12-13T13:30:00Z | 2022-12-13T13:00Z / -30 | 2022-12-13T13:30Z / 0 | 2022-12-12 | 2022-12-12T13:00Z / -1470 | 2022-12-12T13:30Z / -1440 | Conditional references only |
| 2023-01-12 | 2023-01-12T13:30:00Z | 2023-01-12T13:00Z / -30 | 2023-01-12T13:30Z / 0 | 2023-01-11 | 2023-01-11T13:00Z / -1470 | 2023-01-11T13:30Z / -1440 | Conditional references only |
| 2023-02-14 | 2023-02-14T13:30:00Z | 2023-02-14T13:00Z / -30 | 2023-02-14T13:30Z / 0 | 2023-02-13 | 2023-02-13T13:00Z / -1470 | 2023-02-13T13:30Z / -1440 | Conditional references only |
| 2023-03-14 | 2023-03-14T12:30:00Z | 2023-03-14T13:00Z / 30 | 2023-03-14T13:30Z / 60 | 2023-03-13 | 2023-03-13T13:00Z / -1410 | 2023-03-13T13:30Z / -1380 | Conditional references only |
| 2023-04-12 | 2023-04-12T12:30:00Z | 2023-04-12T12:00Z / -30 | 2023-04-12T12:30Z / 0 | 2023-04-11 | 2023-04-11T12:00Z / -1470 | 2023-04-11T12:30Z / -1440 | Conditional references only |
| 2023-05-10 | 2023-05-10T12:30:00Z | 2023-05-10T12:00Z / -30 | 2023-05-10T12:30Z / 0 | 2023-05-09 | 2023-05-09T12:00Z / -1470 | 2023-05-09T12:30Z / -1440 | Conditional references only |
| 2023-06-13 | 2023-06-13T12:30:00Z | 2023-06-13T12:00Z / -30 | 2023-06-13T12:30Z / 0 | 2023-06-12 | 2023-06-12T12:00Z / -1470 | 2023-06-12T12:30Z / -1440 | Conditional references only |
| 2023-07-12 | 2023-07-12T12:30:00Z | 2023-07-12T12:00Z / -30 | 2023-07-12T12:30Z / 0 | 2023-07-11 | 2023-07-11T12:00Z / -1470 | 2023-07-11T12:30Z / -1440 | Conditional references only |
| 2023-08-10 | 2023-08-10T12:30:00Z | 2023-08-10T12:00Z / -30 | 2023-08-10T12:30Z / 0 | 2023-08-09 | 2023-08-09T12:00Z / -1470 | 2023-08-09T12:30Z / -1440 | Conditional references only |
| 2023-09-13 | 2023-09-13T12:30:00Z | 2023-09-13T12:00Z / -30 | 2023-09-13T12:30Z / 0 | 2023-09-12 | 2023-09-12T12:00Z / -1470 | 2023-09-12T12:30Z / -1440 | Conditional references only |
| 2023-10-12 | 2023-10-12T12:30:00Z | 2023-10-12T12:00Z / -30 | 2023-10-12T12:30Z / 0 | 2023-10-11 | 2023-10-11T12:00Z / -1470 | 2023-10-11T12:30Z / -1440 | Conditional references only |
| 2023-11-14 | 2023-11-14T13:30:00Z | 2023-11-14T13:00Z / -30 | 2023-11-14T13:30Z / 0 | 2023-11-13 | 2023-11-13T13:00Z / -1470 | 2023-11-13T13:30Z / -1440 | Conditional references only |
| 2023-12-12 | 2023-12-12T13:30:00Z | 2023-12-12T13:00Z / -30 | 2023-12-12T13:30Z / 0 | 2023-12-11 | 2023-12-11T13:00Z / -1470 | 2023-12-11T13:30Z / -1440 | Conditional references only |
| 2024-01-11 | 2024-01-11T13:30:00Z | 2024-01-11T13:00Z / -30 | 2024-01-11T13:30Z / 0 | 2024-01-10 | 2024-01-10T13:00Z / -1470 | 2024-01-10T13:30Z / -1440 | Conditional references only |
| 2024-02-13 | 2024-02-13T13:30:00Z | 2024-02-13T13:00Z / -30 | 2024-02-13T13:30Z / 0 | 2024-02-12 | 2024-02-12T13:00Z / -1470 | 2024-02-12T13:30Z / -1440 | Conditional references only |
| 2024-03-12 | 2024-03-12T12:30:00Z | 2024-03-12T13:00Z / 30 | 2024-03-12T13:30Z / 60 | 2024-03-11 | 2024-03-11T13:00Z / -1410 | 2024-03-11T13:30Z / -1380 | Conditional references only |
| 2024-04-10 | 2024-04-10T12:30:00Z | 2024-04-10T12:00Z / -30 | 2024-04-10T12:30Z / 0 | 2024-04-09 | 2024-04-09T12:00Z / -1470 | 2024-04-09T12:30Z / -1440 | Conditional references only |
| 2024-05-15 | 2024-05-15T12:30:00Z | 2024-05-15T12:00Z / -30 | 2024-05-15T12:30Z / 0 | 2024-05-14 | 2024-05-14T12:00Z / -1470 | 2024-05-14T12:30Z / -1440 | Early-release issue; actual UTC unknown |
| 2024-06-12 | 2024-06-12T12:30:00Z | 2024-06-12T12:00Z / -30 | 2024-06-12T12:30Z / 0 | 2024-06-11 | 2024-06-11T12:00Z / -1470 | 2024-06-11T12:30Z / -1440 | Conditional references only |
| 2024-07-11 | 2024-07-11T12:30:00Z | 2024-07-11T12:00Z / -30 | 2024-07-11T12:30Z / 0 | 2024-07-10 | 2024-07-10T12:00Z / -1470 | 2024-07-10T12:30Z / -1440 | Conditional references only |
| 2024-08-14 | 2024-08-14T12:30:00Z | 2024-08-14T12:00Z / -30 | 2024-08-14T12:30Z / 0 | 2024-08-13 | 2024-08-13T12:00Z / -1470 | 2024-08-13T12:30Z / -1440 | Conditional references only |
| 2024-09-11 | 2024-09-11T12:30:00Z | 2024-09-11T12:00Z / -30 | 2024-09-11T12:30Z / 0 | 2024-09-10 | 2024-09-10T12:00Z / -1470 | 2024-09-10T12:30Z / -1440 | Conditional references only |
| 2024-10-10 | 2024-10-10T12:30:00Z | 2024-10-10T12:00Z / -30 | 2024-10-10T12:30Z / 0 | 2024-10-09 | 2024-10-09T12:00Z / -1470 | 2024-10-09T12:30Z / -1440 | Conditional references only |
| 2024-11-13 | 2024-11-13T13:30:00Z | 2024-11-13T13:00Z / -30 | 2024-11-13T13:30Z / 0 | 2024-11-12 | 2024-11-12T13:00Z / -1470 | 2024-11-12T13:30Z / -1440 | Conditional references only |
| 2024-12-11 | 2024-12-11T13:30:00Z | 2024-12-11T13:00Z / -30 | 2024-12-11T13:30Z / 0 | 2024-12-10 | 2024-12-10T13:00Z / -1470 | 2024-12-10T13:30Z / -1440 | Conditional references only |

## Limits

May 15 2024 uses the scheduled CPI time only; its exact early actual-release UTC is not established. Coinciding deadline/schedule clocks do not establish simultaneous publication. Prior calcdate-labelled clocks do not prove prior quotes or information availability. Freeze, holiday, fallback, operational and historical-vintage exceptions remain separate. No first-new-value inference is made.

The JSON contains input hashes, runtime provenance, per-event UTCs/offsets/gaps and flags. Independent snapshot saved before reading the root Python result.


## Post-snapshot root comparison

PASS: all 756 per-event comparisons agree across 36 releases. Compared both hypotheses’ UTC instants, BFIX/deadline gaps, Kyiv offsets, date joins and frozen/default exclusions against the root Python output. Root SHA-256: `81f4efe66929e58e0f49500af5e9e6910013f1b411df582e532f3818ed8e0e09`. No actual quote/publication timestamp was authenticated in either result.

The JavaScript snapshot was saved before reading the root result file. The root summary had been communicated earlier, but its expected counts were not used in the arithmetic. Intl’s legacy Europe/Kiev resolution is recorded; it yielded matching offsets. No research or price calculation was added.
