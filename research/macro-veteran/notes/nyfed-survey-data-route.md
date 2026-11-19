# NY Fed market-expectations survey data route

The official page currently links a September 2026 complete questionnaire/results/XLSX set. October 2026 has a questionnaire link and no linked results or data. The selected predecessor is December 2024. Twelve unmodified public-source captures, HTTP receipts and SHA-256 hashes are retained under work/raw/nyfed-survey-expectations/. No unreleased October path was guessed. [Official survey page](https://www.newyorkfed.org/markets/market-intelligence/survey-of-market-expectations).

## Concrete download and schema

| File | Data records | Sheet and columns | Cohorts |
|---|---:|---|---|
| September 2026 XLSX | 2,748 | Sheet1,21 columns | Combined,Dealer,Participant |
| December 2024 XLSX | 2,170 | Sheet1,21 columns | Combined,SMP,SPD |

The source files are [September 2026 data](https://www.newyorkfed.org/medialibrary/media/markets/survey/2026/sep-2026-data.xlsx) and [December 2024 data](https://www.newyorkfed.org/medialibrary/media/markets/survey/2024/dec-2024-data.xlsx). Each has one visible sheet, no dictionary tab, no formulas and no defined names. Its21 headers and per-row question text/tags provide the usable dictionary. The companion JSON lists every field and precise source fixtures. A row is one published cohort/statistic/element, not one firm.

The key fields retain distribution/due dates, panel, legacy question number, theme/subject, elicitation type/mode, full question text, question/value tags, table headers, horizon/date, bucket bounds and aggregation/value. The observed key distribution-date+panel+value-tag+aggregation is unique in both files. Do not drop question wording, conditional scenarios or period definitions. The legacy spd_question_number does not itself identify the population or guarantee a matching native SMP question number.

These are aggregate results. Their statistics are count, pctl25,pctl50,pctl75 and avg. Percentiles summarize respondents’ answers; avg on a probability question averages the probabilities assigned to each bucket. Tail-percentile questions add another layer: a cross-respondent median of an elicited tail percentile is not a pooled predictive distribution. The results’ named-firm roster does not map individual firms to answers. [Producer explanation of the machine-readable release](https://tellerwindow.newyorkfed.org/2024/10/10/a-new-view-of-our-monetary-policy-expectations-surveys/).

## Population, timing and unit traps

The surveys merged in January 2025 and the nondealer panel expanded. SPD→Dealer and SMP→Participant are conceptual label mappings, not proof of constant panels. In2024,SPD includes questions not shared with SMP/Combined. Preserve publisher Combined statistics rather than averaging medians from the separate cohorts. [FAQ](https://www.newyorkfed.org/markets/market-intelligence/survey-of-market-expectations/faqs-survey-of-market-expectations), [merger statement](https://www.newyorkfed.org/markets/opolicy/operating_policy_250113).

In these files survey_release_date matches questionnaire distribution: September 2, 2026 and December 4, 2024. It is not the public XLSX/results publication clock. Survey_due_date is the response deadline. Questions precede FOMC meetings; aggregate results/data follow the minutes, about 3 weeks after meetings. These answers cannot be treated as publicly available on their distribution date. No exact historical first-publication timestamp was established.

All aggregation_value cells use General formatting. Rate/inflation level examples are stored as fractions while count rows are cardinalities; percentage-point changes, dollar amounts and date strings use other scales. Source question entry instructions alone do not define exported storage scale. Register units per question/element and verify against the matching result table. Horizons include meeting dates, years, quarters and longer run. The same year-end date can encode a point policy-rate target or a Q4/Q4 inflation target; the date alone is insufficient.

## Verified field fixtures

| Fixture | Median cell/token | Count cell/token | Meaning and PDF evidence |
|---|---|---|---|
|2026 Q10 Combined core PCE2026|U4:0.032 →3.2%|U2:58|Own modal core-PCE estimate,Q4/Q4; questionnaire p14/results p16.|
|2026 Q1b Combined SEP FF2027|U100:0.0363 →3.63%|U98:61|Respondents’ expected September SEP median FOMC projection for year-end2027; questionnaire p2/results p5.|
|2024 Q3 Combined productivity scenario|U168:0.4pp|U166:40|Change in longer-run rate expectation under persistent+0.5pp productivity scenario; both questionnaires p3/results p5.|
|2024 Combined SOMA end period|U280:inline string2025-05-15|U278:44|Date-encoded percentile of month/quarter dropdown; SPD Q4c questionnaire p5/table p8; SMP Q4b questionnaire p4/table p7.|

All cells above are on Sheet1. Exact XML tokens, source hashes, tags and question-text cell pointers are in the JSON. The 2026 figures/counts visually match the combined PDF. The separate2024 PDFs establish question/units and panel context; Combined is supplied in XLSX and has no separate Combined PDF. For the date case, the original menu uses months/quarters. Do not interpret a date-encoded aggregate as an observed event date or a day-precise respondent forecast.

The SEP example concerns expectations of the FOMC participants’ reported median. Respondents’ own modal policy-rate path is a different question,Q2a. The Q10 example is their own economic projection. Neither is monthly CPI consensus. [2026 questionnaire](https://www.newyorkfed.org/medialibrary/media/markets/survey/2026/sep-survey-sme.pdf), [2026 results](https://www.newyorkfed.org/medialibrary/media/markets/survey/2026/sep-2026-sme-results.pdf).

## Counts, absent rows and rights

The full U-column checks cover 2026 rows2:2749 and 2024 rows2:2171. There are no null, blank-string or Excel-error aggregation values in these universes. Restricting to count gives 840 and 709 rows respectively; none is zero. The 2024 file’s nine string results are date-encoded percentiles. Optional horizon/bucket fields can be blank intentionally. No suppression threshold was located in the inspected workbooks,FAQ or result introductions; this does not establish a no-suppression policy. Longer-run core PCE is explicitly N/A/dash in2026 Q10 and has no corresponding value row. No zero or hidden observation was invented.

The 2026 results report 65 invited and 62 returned; the 2024 PDFs report 24 dealer and 24 participant returns. These totals are not universal item denominators. Use the matching count row; missing or shorter-horizon answers change counts.

Attribution: © 2026 Federal Reserve Bank of New York. Content from the New York Fed subject to the Terms of Use at newyorkfed.org. Exact source survey titles are retained. Selection and interpretation are independent research modifications; the New York Fed did not create or endorse them. The general licence permits personal/business use, storage, copying, distribution and derivatives subject to source/copyright notices, attribution, derivative labeling, no distortion and any content-specific restrictions. No workbook-specific restriction text was found by the bounded cell/property/comment review. The general Terms still apply; these files are not labelled public domain. [Terms of Use](https://www.newyorkfed.org/privacy/termsofuse).

No source workbook was modified or exported. No model, forecast-performance test or trading-return calculation was created. Prior artifacts and ZIPs were untouched.
