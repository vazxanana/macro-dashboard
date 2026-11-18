# Saved macro notice date matches against frozen intervals

This bounded check compares known extra, correction, revision and staged-flow **dates** in the saved BLS, BEA, Census and Federal Reserve G.17 inventories with the 133 frozen UTC intervals in `treasury-core-overlap-intervals-2026-11-17.json`. It yields nine notice-date matches in nine intervals. A matching calendar date does not by itself establish intraday overlap or family inclusion. Machine-readable boundaries and source URLs are in the companion JSON.

| Notice date | Frozen interval ending | Official notice | Open decision |
|---|---|---|---|
| 2022-02-16 | 2022-02-17 | [BLS PPI reissue](https://www.bls.gov/errata/home.htm), correcting original February 15 release | Reissue clock unknown; interval starts 20:30Z on the 16th. |
| 2022-04-25 | 2022-04-26 | [Census annual retail revision schedule](https://www2.census.gov/marts/adv2202.pdf) | Announced 10:00 EDT (14:00Z), before 19:30Z interval start if held as scheduled; actual publication unverified and annual-revision family scope unresolved. |
| 2024-04-23 | 2024-04-24 | [Census annual retail revision](https://www2.census.gov/retail/releases/historical/marts/adv2404.pdf) | Retrospectively reported in the **May 15** advance release; April 23 is the revision date, not the notice-document publication date. Clock and family scope unresolved. |
| 2023-03-28 | 2023-03-28 | [G.17 industrial production annual revision](https://www.federalreserve.gov/releases/g17/Revisions/20230328/g17rev.pdf) | Official PDF states noon EDT (16:00Z), inside 19:30Z March 27–19:30Z March 28 interval. Annual-revision family scope and actual first network availability remain unverified. |
| 2023-10-18 | 2023-10-19 | [BEA KLEMS annual tables](https://www.bea.gov/information-updates-national-economic-accounts-2023) | Date-only staged flow; clock and GDP/PI&O family scope unresolved. |
| 2023-11-20 | 2023-11-21 | [BEA industry underlying detail tables](https://www.bea.gov/information-updates-national-economic-accounts-2023) | Date-only staged flow; clock and family scope unresolved. |
| 2023-12-05 | 2023-12-05 | [BEA delayed GDP by Industry release](https://www.bea.gov/information-updates-national-economic-accounts-2023) | Date-only release flow; clock and GDP-family scope unresolved. |
| 2024-10-02 | 2024-10-03 | [BEA annual-only tables and corrections](https://www.bea.gov/information-updates-national-economic-accounts-2024) | Date-only staged flow; clock and family scope unresolved. |
| 2024-12-10 | 2024-12-11 | [BEA NIPA Tables 2.9 and 7.19](https://www.bea.gov/information-updates-national-economic-accounts-2024) | Date-only staged flow; clock and family scope unresolved. |

The other saved G.17 annual-revision dates (2022-06-28, 2024-06-28) and seven other saved BEA supplementary dates have no calendar-date match. BEA comprehensive-update bundles coinciding with ordinary GDP or personal-income release rows were not counted as independent extra notices. This checks only the saved notice inventories; they do not certify the full universe of unscheduled corrections or first publication times. No interval was classified clean and no Treasury outcome, score, or control rematch was computed.
