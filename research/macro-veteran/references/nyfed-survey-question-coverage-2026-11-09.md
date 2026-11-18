# NY Fed survey data: what can be studied across cycles

The 26 linked XLSX files cover July 2023 through September 2026. Their 21-column layout stays stable, while their questions, cohorts and targets vary. A source metadata map now separates those changes instead of treating the downloads as one uniform forecasting panel.

Start with the [compact coverage reference](nyfed-survey-coverage-summary-2026-11-09.json). It retains exact question/value-tag presence masks, cycle totals, source identities and missingness rules. The full searchable catalogue, including question-text hashes, source-cell pointers, horizon/bucket metadata and field variants, is `work/nyfed-survey-cross-cycle-profile.json`. The companion source note is `work/nyfed-survey-cross-cycle-profile.md`. These are discovery references; units and comparability still require the selected questionnaire/results. [Official archive](https://www.newyorkfed.org/markets/market-intelligence/survey-of-market-expectations).

| Observed metadata coverage | Result |
|---|---:|
| Linked workbooks captured or reused with receipts | 26: 24 new captures, 2 unchanged prior captures |
| Aggregate source records | 63,190 |
| Exact `count` records | 20,545 |
| Exact descriptive families | 55 |
| Families present in every cycle | 17 |
| Families absent from at least one cycle | 38 |
| Exact question tags / value tags | 129 / 1,519 |

A family is the exact tuple `(theme, subject_group, subject, question_type, question_mode)`. Its presence does not prove stable wording, units, horizons, bins or firms. The 63,190 records are repeated cohort/statistic/element records, not that many independent forecasts or respondents. Exact year/date-bearing tags remain exact; no automatic aliasing makes unlike targets comparable.

## Two import rules the wider archive adds

The two-file worked case showed five aggregation labels. The full archive additionally uses **`count_1` through `count_5`** for communication-rating categories: 195 such rows in 13 cycles, including 27 zero cells. These frequencies differ from the exact `count` respondent-count records. Zero category frequency is valid data; it must not turn into missingness or a zero total denominator. Preserve the raw aggregation code.

The September 2026 results PDF also contains qualitative Q1a/Q1c summaries, with 41 and 61 responses, that have no corresponding question-number rows in its XLSX. Spreadsheet completeness therefore does not establish full questionnaire-content coverage. This checked example is limited to September 2026; retain PDFs alongside their data files. [September results](https://www.newyorkfed.org/medialibrary/media/markets/survey/2026/sep-2026-sme-results.pdf), pages 4–5.

## Choose a usable field before choosing a model

The coverage masks tell the researcher where to look, not whether fields are interchangeable. For example, expected SEP projections, respondents' own modal forecasts, elicited tail percentiles, averaged bin probabilities and rating frequencies are distinct objects. A field may disappear, change type, roll its horizon or move between panel labels. Use the full catalogue to locate its exact question wording hash, source J-cell, target labels and response count, then check the PDF.

Every inspected value cell uses General formatting. Modes include levels, changes, rating and weights; the same column has no universal conversion. The earlier [source-ingestion case](nyfed-survey-expectations-ingestion-2026-11-09.md) supplies two specifically checked rate examples, rather than an archive-wide normalization rule.

The January 2025 panel-code change from SPD/SMP to Dealer/Participant coincides with the SME merger and nondealer expansion. Equal postmerger row counts across cohorts do not prove equal respondents or a stable firm panel. The older spreadsheet/Combined backfill has a separate availability boundary in October 2024. [Merger statement](https://www.newyorkfed.org/markets/opolicy/operating_policy_250113), [format statement](https://www.newyorkfed.org/markets/opolicy/operating_policy_241010).

Capture times establish which current files were retrieved; original historical first-publication times remain unauthenticated. Source row pointers and metadata partitions were checked separately from economic meaning. The 24 newer captures were not each paired with every PDF question/result table, and full unit/horizon equivalence is not validated. No forecast values, scoring study, market return or trading signal was produced by this metadata map.

The [validation record](nyfed-survey-coverage-validation-2026-11-09.json) binds all26 source receipts,797 independent metadata comparisons, source-row/question-text-hash regression across63,190 rows and1,703 compact presence-mask records. The independent check's initial26 differences were counts of blank rows compared with empty row-index lists; an explicit length comparison resolved that representation difference, with no source changes. The checks do not establish economic comparability or a forecasting record.

© 2026 Federal Reserve Bank of New York. Content from the New York Fed subject to the Terms of Use at newyorkfed.org. Selection and metadata classification are independent MeridianX research modifications, not NY Fed work or endorsement. Preserve applicable [Terms of Use](https://www.newyorkfed.org/privacy/termsofuse).
