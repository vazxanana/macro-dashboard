# NY Fed market-expectations surveys: a usable archive with delayed public answers

Verified on 9 November 2026 for MeridianX private research. The archive supplies downloadable **aggregate cohort statistics**, including expectations for policy, inflation and growth. Its premeeting collection dates do not establish that the answers were public before the meeting. This is a source-ingestion case, with two checked examples; it contains no forecast-performance or trading result.

The [source contract](nyfed-survey-source-contract-2026-11-09.json) records raw tokens, units, cells, receipt hashes, interpretation and unknown publication times. The [validation record](nyfed-survey-validation-2026-11-09.json) states the checks performed. The earlier delivered V1.3 ZIP is unchanged; these files belong to the next requested batch.

## What is available

The current archive combines the earlier Survey of Primary Dealers (SPD) and Survey of Market Participants (SMP) into the Survey of Market Expectations (SME). The captured page links October 2026 questions, while September is its latest cycle with linked results and data. This describes the captured page rather than proving that no unlisted file exists. These are selected panels of investment professionals, not a representative census. [Official archive](https://www.newyorkfed.org/markets/market-intelligence/survey-of-market-expectations), [FAQ](https://www.newyorkfed.org/markets/market-intelligence/survey-of-market-expectations/faqs-survey-of-market-expectations).

Two workbooks were inspected: September 2026 has 2,748 data records; December 2024 has 2,170. Both have one worksheet, `Sheet1`, and the same 21 headers. Each row identifies a question, subject, horizon, cohort and statistic; it does not identify an individual respondent. The inspected aggregation labels are `count`, `pctl25`, `pctl50`, `pctl75` and `avg`. No missing `aggregation_value` tokens were found in these two files; this does not establish completeness of every possible question or horizon. Raw files and receipts are under `work/raw/nyfed-survey-expectations/`.

## The publication clock is part of the observation

The publisher posts questions when distributed, roughly two weeks before a meeting. Results and data generally follow about three weeks after the meeting, after its minutes. Some result appendices contain subsequent postmeeting updates. Keep those phases separate. [Publication policy](https://www.newyorkfed.org/markets/market-intelligence/survey-of-market-expectations).

| September 2026 clock | Evidence and interpretation |
|---|---|
| Questionnaire distributed | 2 September; this is the workbook's `survey_release_date`. |
| Responses due / received by | 8 September; the questionnaire requested replies by 14:00 EDT. This is not each firm's submission time. |
| FOMC meeting | 15–16 September. |
| Minutes released | 7 October at 14:00 EDT, a separate Federal Reserve publication. |
| Original NY Fed result PDF/XLSX availability | Exact timestamps remain unknown. Do not substitute the questionnaire date, minutes time, file metadata or today's receipt. |

Collection dates are printed on the [survey results](https://www.newyorkfed.org/medialibrary/media/markets/survey/2026/sep-2026-sme-results.pdf); the requested deadline is in the [questionnaire](https://www.newyorkfed.org/medialibrary/media/markets/survey/2026/sep-survey-sme.pdf). The [minutes announcement](https://www.federalreserve.gov/newsevents/pressreleases/monetary20261007a.htm) establishes the minutes clock only. The separate publication audit in `work/nyfed-survey-publication-audit.md` preserves source receipts and the remaining unknowns.

The historical format has its own start date. On **10 October 2024**, the NY Fed released spreadsheets for July 2023–September 2024 and introduced Combined statistics. Earlier dealer/participant values had already appeared in PDFs. A 2023 survey date therefore does not establish a 2023 spreadsheet or Combined-data information set. The January 2025 merger also expanded the nondealer panel, so historical subgroup labels and later SME labels need explicit versioning. [Format announcement](https://www.newyorkfed.org/markets/opolicy/operating_policy_241010), [merger announcement](https://www.newyorkfed.org/markets/opolicy/operating_policy_250113).

## Two checked examples that must stay distinct

| September 2026 Combined statistic | Raw XLSX token and source | Correct meaning |
|---|---|---|
| Q1b, expected SEP median federal-funds projection, year-end 2027, `pctl50` | `Sheet1!U100 = 0.0363` → **3.63%**; matched count `U98 = 61`; results PDF page 5 | Median across respondents of their modal expectations for the FOMC's forthcoming SEP median projection. This is an expectation of a published projection. |
| Q10, own modal core-PCE forecast, 2026, `pctl50` | `Sheet1!U4 = 0.032` → **3.20%**; matched count `U2 = 58`; results PDF page 16 | Median of respondents' own modal forecasts for core PCE inflation, Q4 over Q4. It is neither monthly CPI nor quarterly annualized PCE. |

Both values and counts were checked against the [source results PDF](https://www.newyorkfed.org/medialibrary/media/markets/survey/2026/sep-2026-sme-results.pdf) and independently read worksheet cells. The document's Q2a asks about respondents' own modal policy path; Q1b must not be relabelled as Q2a. Counts vary by item and horizon, even within the same cohort.

Cross-respondent quartiles describe disagreement among modal point forecasts. For distribution questions, the reported average of respondents' bin probabilities describes something different. A quartile band is not automatically a forecast interval, and an averaged probability distribution is not respondent-level microdata or a market-implied probability.

## Rules for ingestion

1. Store instrument, cycle, raw cohort label, panel version, question/value tags, target, horizon, scenario and statistic together. Question numbers alone are insufficient. The legacy column name `spd_question_number` also appears in SME files; it does not make every observation a dealer response. Legacy SMP native question numbering can differ from that canonical SPD field; retain the questionnaire-specific mapping.
2. Keep questionnaire distribution, requested deadline, meeting, minutes publication, result publication, format availability and current receipt in separate fields. Unsupported original public timestamps remain null. Preserve premeeting versus postmeeting response phase.
3. Assign units per question and statistic. The verified rate examples use decimal fractions, but the shared value column also holds counts, changes, amounts, probabilities and date strings. General Excel formatting supplies no reliable units dictionary. Never apply a blanket multiplication by 100. A separate 2024 scenario-change example uses percentage points directly; the agent profile retains its precise scope.
4. Match each statistic to its own response count. Preserve blanks as null with an unknown reason until documented. No explicit suppression threshold was established by this inspection; do not invent one.
5. Preserve both raw tokens and labelled transformations, with workbook hash, sheet/cell and PDF page. An unmapped unit or target blocks automated use of that field. The contract normalizes only the two examples above; it is not a complete archive-wide importer.
6. For a historical public-information study, establish when the particular result and format became public. These current-archive observations can describe previously collected expectations, but they fail a premeeting public-availability gate for the same meeting.

## Use conditions and remaining work

The NY Fed's general terms permit personal/business use, storage and derivatives subject to conditions. Preserve source notices and free-source URLs, label modifications, retain applicable permissions when sharing and check any content-specific restrictions. This is not a public-domain designation. Source selection and normalization here are MeridianX research modifications, not NY Fed work or endorsement. [Terms of Use](https://www.newyorkfed.org/privacy/termsofuse).

© 2026 Federal Reserve Bank of New York. Content from the New York Fed subject to the Terms of Use at newyorkfed.org.

Next useful work is an archive manifest with cycle-specific question and unit maps, plus genuine result-publication receipts for future releases. Historical original-time availability remains unresolved where evidence is absent. A broader panel comparison or forecast evaluation requires its own target, vintage and scoring protocol; none was computed here. The real CPI pilot remains unchanged, and cTrader remains demo only.
