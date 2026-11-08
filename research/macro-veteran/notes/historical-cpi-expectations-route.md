# Historical monthly CPI expectation route: producer evidence and usable coverage

Working research note, captured 8 November 2026. No new forecast, market-return analysis, or performance result was produced. No frozen archive or outputs file was changed.

**Finding:** Cleveland Fed's public monthly-chart JSON supplies a concrete historical **model benchmark**, with both headline and core CPI values before each of the 36 releases during calendar 2022–2024. This is not survey consensus. The producer describes the relevant history as real-time published forecasts; the currently served JSON is not an independently timestamped original delivery archive.

## 1. Actual public download discovered

The [official Inflation Nowcasting page](https://www.clevelandfed.org/indicators-and-data/inflation-nowcasting) embeds this direct data URL in its monthly chart component:

`https://www.clevelandfed.org/-/media/files/webcharts/inflationnowcasting/nowcast_month.json?sc_lang=en`

This corrects the previous work note's narrower observation that no explicit download had been located. A visible download button is not needed: the public page itself declares the data file. The browser search renderer rejects its `application/octet-stream` type, but a normal direct fetch returned HTTP 200 and valid JSON. This is a rendering limitation, not an access barrier.

Local evidence:

- `work/raw/cpi-expectations-history/cleveland-nowcast-month.json`: 7,683,463 bytes, received `2026-11-08T19:30:50.967Z`; SHA-256 `9253b45d839c5fe1e5fd1e2d583f9f7aa48bedeb02b4a4060a04041d598c17cd`.
- `work/raw/cpi-expectations-history/capture-1794166251192.json`: request, response, size, hash, and source URL metadata for the JSON and BLS archive index.
- `work/raw/cpi-pilot-sources-2026-11-08/cleveland-nowcast.html`: previously captured official page; monthly component at approximately lines 2662–2675 supplies the URL, chart title, attribution, and license.

The captured file contains 161 monthly chart objects, with target periods July 2013–November 2026. Each includes daily paths for CPI, core CPI, PCE, and core PCE, followed by four actual series. The monthly CPI fields are seasonally adjusted, nonannualized month-over-month percentage changes.

## 2. Coverage and cohort boundary

Two distinct extractions are retained:

| Working file | Selection | Coverage |
|---|---|---|
| `work/raw/cpi-expectations-history/model-benchmark-coverage-2022-2024.json` | Target reference month in 2022–2024 | Jan 2022–Dec 2024; last release Jan 15, 2025 |
| `work/raw/cpi-expectations-history/release-year-cohort-2022-2024.json` | BLS release date in calendar years 2022–2024 | Dec 2021–Nov 2024; 36 releases Jan 12, 2022–Dec 11, 2024 |

The **second file matches the repeated-study calendar-release-year scope**. It adds December 2021, keeps the first extraction intact, and explicitly retains December 2024/January 2025 as an excluded record with its reason. Every one of the 36 selected releases has both model fields on the previous calendar day. All 36 chart actual dates agree with the dates encoded in the official BLS archive filenames. This establishes usable date/value coverage, not immutable historical delivery receipts.

The rule is fixed: select the last nonempty model observation dated **strictly before** the BLS release date. It does not choose the most accurate historical point. Cleveland's FAQ places daily updates around 10 a.m. Eastern; release-day points cannot be presumed available before CPI's 8:30 a.m. Eastern release. [Producer timing and historical-chart documentation](https://www.clevelandfed.org/indicators-and-data/inflation-nowcasting).

Examples from the captured JSON, retaining source precision:

| Target month | Selected model date | Headline model % | Core model % | BLS release date |
|---|---|---:|---:|---|
| Dec 2021 | 2022-01-11 | 0.388985413110369 | 0.404667075043658 | 2022-01-12 |
| Jan 2022 | 2022-02-09 | 0.427111543925782 | 0.445653417478999 | 2022-02-10 |
| Jan 2024 | 2024-02-12 | 0.13100846500564 | 0.320186100133907 | 2024-02-13 |

## 3. Parser details that prevent silent errors

Each object's `chart.subcaption` is the target, for example `2024-1`. The global `_comment` is `2026-11-06 00:00` in this capture; it is **not** an observation's historical publication timestamp.

`categories[0].category` contains normal `MM/DD` labels plus vertical release markers such as `{label:"CPI Jan",vline:"true"}`. **Remove vertical markers before aligning the categories with each `dataset[].data` array.** Markers do not consume a series data index. For January 2024 there are 41 ordinary date categories and 41 elements per series.

Year is not included in category labels. The extractor derives it from the target year and adjacent month boundaries, then checks valid calendar dates and monotonic ordering. Empty-string values remain missing; string `"0"` remains a genuine zero. Headline/core are selected by `seriesname`, not by blindly trusting dataset positions. The actual series have one nonempty CPI point each, on the independently derived BLS release date.

The reproducible working extraction is `work/extract_cpi_expectation_history.mjs`; `work/extend_cpi_history_release_year_cohort.mjs` produces the additional calendar-release cohort without overwriting the original.

## 4. What the history does and does not establish

Endnote 3 of the producer's [March 2023 real-time assessment](https://www.clevelandfed.org/publications/economic-commentary/2023/ec-202306-real-time-assessment-inflation-nowcasting-cleveland-fed) separates reconstructed 1999–2013Q2 forecasts from forecasts generated and published on the website in real time from 2013Q3 onward. The 2022–2024 points fall in the latter period. The article's exercise ends in 2022; its statement alone does not independently authenticate every 2023–2024 file version.

The present capture therefore supports a **producer-maintained historical model benchmark**, with a documented real-time production history. It does not prove exact original arrival times, that historical points were never corrected, or the bytes any individual trader received. Keep `original_delivery_receipt_for_historical_nowcast:false`. Do not describe this as a prospective experiment or a pre-event archived consensus database.

The assessment compares quarterly inflation forecasts from surveys and models and uses a later-vintage truth convention. Its reported comparisons cannot establish monthly CPI survey-consensus coverage or be imported into a first-print monthly event study. [Assessment and endnotes](https://www.clevelandfed.org/publications/economic-commentary/2023/ec-202306-real-time-assessment-inflation-nowcasting-cleveland-fed).

## 5. BLS first-release values and dates: concrete source access

The [official BLS CPI archive index](https://www.bls.gov/bls/news-release/cpi.htm) directly links reference-month releases and PDFs. Its HTML was captured as `work/raw/cpi-expectations-history/bls-cpi-archive.html` (128,672 bytes; SHA-256 `a6c6595103212f19425d454b5fa4b58f63eb4e037a5da6659b9f787c8e449b2b`). Each working row supplies the exact official archive URL and release date, not a guessed calendar.

All 36 Jan 2022–Dec 2024 **target-month** release HTML pages were downloaded successfully into `work/raw/cpi-expectations-history/bls-releases/`; request/response hashes and dates are in `bls-releases-capture-1794166491193.json`. The extra [December 2021 release](https://www.bls.gov/news.release/archives/cpi_01122022.htm) was separately captured, recorded in `dec2021-additional-release-capture.json`. Thus the calendar-year cohort's 36 releases are all locally available, plus the explicitly excluded Jan 2025 release. No current BLS database was substituted for release vintage.

For example, the [January 2024 release](https://www.bls.gov/news.release/archives/cpi_02132024.htm) identifies February 13, 2024 at 8:30 a.m. Eastern and prints monthly headline/core changes of **0.3% / 0.4%** in Table A. Cleveland's chart actual fields instead carry `0.305433015268397` / `0.392389746143951`. These unrounded chart values are not the same precision as BLS's printed surprise target. The repeated study should source and retain BLS Table A's original release precision, with exact measure metadata.

The archive warns that subsequent releases can revise archived observations. Treat a dated release's Table A current-month column as the release-vintage route; preserve the local bytes and review corrections if relevant. The present website capture should not be called a contemporaneous delivery receipt.

## 6. Access and license evidence

The official monthly chart component declares `data-chart-license="https://creativecommons.org/licenses/by/4.0/"` and attributes calculations to the Federal Reserve Bank of Cleveland using BLS, BEA, EIA, Financial Times, and Haver Analytics inputs. Record this as the **publisher's chart license declaration**, with Cleveland attribution and retrieval date. It does not grant access to or a license for underlying vendors' raw input feeds. The 2023 Economic Commentary article separately declares CC BY-NC 4.0; do not transfer that article license onto the chart or vice versa.

[BLS copyright guidance](https://www.bls.gov/opub/copyright-information.htm) places its published material in the public domain apart from previously copyrighted images and asks for source attribution. No paid credentials were used to fetch these BLS pages or Cleveland data.

## 7. Remaining consensus gap, with concrete next routes

**No 36-release historical survey-consensus dataset with verified pre-release cutoff, coverage, and reuse rights was acquired in this task.** The complete Cleveland extraction does not close that different gap. No Bloomberg/Reuters figure was guessed; quarterly SPF targets were not converted into monthly expectations.

- [Trading Economics' own point-in-time documentation](https://docs.tradingeconomics.com/economic_calendar/point-in-time/) describes preserving original calendar values. Its displayed request uses indicator/country/date-range parameters and an API key, and its example is for initial claims. It shows no separate pre-release `as_of` parameter in that example. This is a concrete access lead, but not proof that 36 CPI consensus cutoffs or historical forecast edits are available under the user's entitlement. Needed evidence: actual CPI sample, forecast definition, precise snapshot timing and revision policy, all-month coverage, and contract reuse terms. `Forecast` and `TEForecast` must remain distinct. No key was obtained and no paid request was made.
- Econoday's [API documentation URL](https://api.econoday.com/api/api.html) is indexed with a numerical consensus description but direct open returned **401 Unauthorized**. The producer historical-data brochure URL found in search returned **404** on direct open. Search snippets alone are not a delivered dataset or license. The unresolved route is authorized archive/API access with historical event identifiers, cutoff metadata, and redistribution terms; do not populate consensus rows from snippets or post-event commentary.

Actionable handoff: use the 36-row calendar-release cohort as a clearly labelled **model-error benchmark study**, retaining its historical-vintage limitation. Keep survey-consensus fields missing until a producer-sourced, licensed historical delivery is verified. No claim about trading profitability follows from the coverage checks.
