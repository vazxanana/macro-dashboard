# NY Fed survey cross-cycle metadata coverage

Completed all **26 explicitly linked workbooks**: 24 newly captured official files and the two unchanged verified files. Coverage runs 2023:July through 2026:September. This is an independent derivative metadata description, with no numerical expectation values or performance results.

The profile covers **63,190 source data rows**, including **20,545 count rows**. It records 55 exact descriptive family tuples, 129 exact question tags and 1519 exact value tags across cycles.

## Exact scope and schema

All 26 workbooks contain one visible `Sheet1` with the same 21 A:U headers. Source headers and all target/horizon/bucket metadata are retained. Each question wording is represented by an exact UTF-8 SHA256 and a source J-cell pointer; U values are excluded. Each value-field variant retains panel/statistic source-row references.

`survey_release_date` is the questionnaire distribution date. It is not the first public result or XLSX availability date. Capture timestamps document this retrieval only. Raw files are unchanged; hashes were checked before and after reads.

A descriptive family is the exact source tuple `(theme, subject_group, subject, question_type, question_mode)`. These broad families do not establish comparable units, wording, targets or respondent populations. The separate exact question-tag matrix and value-field catalogue retain those distinctions. All missing cycle-family cells are explicit and remain missing.

There are **17 families present in all 26 cycles** and **38 with at least one missing cycle**. Exact question tags with embedded years or meeting dates are preserved rather than normalized into an assumed series.

## Cycle coverage

| Cycle | Data rows | Count rows | Exact question tags | Value tags | Panel row counts |
|---|---:|---:|---:|---:|---|
| 2023:July | 1920 | 660 | 42 | 238 | Combined: 604; SMP: 604; SPD: 712 |
| 2023:September | 1994 | 689 | 42 | 261 | Combined: 602; SMP: 602; SPD: 790 |
| 2023:October/November | 1984 | 673 | 45 | 253 | Combined: 604; SMP: 604; SPD: 776 |
| 2023:December | 1930 | 649 | 41 | 245 | Combined: 586; SMP: 586; SPD: 758 |
| 2024:January | 2388 | 777 | 48 | 293 | Combined: 728; SMP: 728; SPD: 932 |
| 2024:March | 2154 | 720 | 48 | 274 | Combined: 650; SMP: 650; SPD: 854 |
| 2024:April/May | 2012 | 692 | 43 | 262 | Combined: 608; SMP: 608; SPD: 796 |
| 2024:June | 2210 | 734 | 46 | 276 | Combined: 674; SMP: 674; SPD: 862 |
| 2024:July | 1792 | 628 | 40 | 238 | Combined: 540; SMP: 540; SPD: 712 |
| 2024:September | 2198 | 731 | 46 | 275 | Combined: 670; SMP: 670; SPD: 858 |
| 2024:November | 2080 | 694 | 46 | 260 | Combined: 636; SMP: 636; SPD: 808 |
| 2024:December | 2170 | 709 | 47 | 265 | Combined: 666; SMP: 666; SPD: 838 |
| 2025:January | 2556 | 819 | 42 | 273 | Combined: 852; Dealer: 852; Participant: 852 |
| 2025:March | 2634 | 864 | 46 | 288 | Combined: 878; Dealer: 878; Participant: 878 |
| 2025:May | 2940 | 915 | 51 | 305 | Combined: 980; Dealer: 980; Participant: 980 |
| 2025:June | 2538 | 846 | 50 | 282 | Combined: 846; Dealer: 846; Participant: 846 |
| 2025:July | 2520 | 810 | 48 | 270 | Combined: 840; Dealer: 840; Participant: 840 |
| 2025:September | 2838 | 921 | 54 | 307 | Combined: 946; Dealer: 946; Participant: 946 |
| 2025:October | 2610 | 834 | 49 | 278 | Combined: 870; Dealer: 870; Participant: 870 |
| 2025:December | 2604 | 843 | 50 | 281 | Combined: 868; Dealer: 868; Participant: 868 |
| 2026:January | 2886 | 900 | 50 | 300 | Combined: 962; Dealer: 962; Participant: 962 |
| 2026:March | 3204 | 1005 | 59 | 335 | Combined: 1068; Dealer: 1068; Participant: 1068 |
| 2026:April | 2682 | 849 | 49 | 283 | Combined: 894; Dealer: 894; Participant: 894 |
| 2026:June | 3180 | 975 | 59 | 325 | Combined: 1060; Dealer: 1060; Participant: 1060 |
| 2026:July | 2418 | 768 | 47 | 256 | Combined: 806; Dealer: 806; Participant: 806 |
| 2026:September | 2748 | 840 | 49 | 280 | Combined: 916; Dealer: 916; Participant: 916 |

## Observed drift and absent coverage

The January 2025 boundary changes panel codes from `SPD`/`SMP` to `Dealer`/`Participant`; `Combined` persists. The predecessor files have unequal panel row totals, while the 2025–2026 files have equal row totals across the three panels. That is a coverage observation, not proof of unchanged firms or respondents.

The machine-readable profile lists every adjacent-cycle exact tag addition/removal, broad-family addition/removal and changed wording hash for a continuing exact tag/family. Wording differences may reflect ordinary date or horizon rolls; they are not automatically economic or questionnaire redesign breaks.

Families with partial coverage (number of present cycles):

- `balance_sheet_policy_expectations/fed_assets/fed_assets_ambs/path_of_modes/changes`: 1/26; exact missing cycles are in the JSON matrix.
- `balance_sheet_policy_expectations/fed_assets/fed_assets_treasury/path_of_modes/changes`: 1/26; exact missing cycles are in the JSON matrix.
- `rate_policy_expectations/fed_funds_target_range/fed_funds_target_range/scenarios/changes`: 1/26; exact missing cycles are in the JSON matrix.
- `balance_sheet_policy_expectations/fed_assets/fed_assets_soma/composition/levels`: 2/26; exact missing cycles are in the JSON matrix.
- `balance_sheet_policy_expectations/fed_assets/fed_assets_soma/dropdown/levels`: 20/26; exact missing cycles are in the JSON matrix.
- `balance_sheet_policy_expectations/fed_liabilities/fed_liabilities_onrrp/dropdown/levels`: 19/26; exact missing cycles are in the JSON matrix.
- `balance_sheet_policy_expectations/fed_liabilities/fed_liabilities_reserves/dropdown/levels`: 20/26; exact missing cycles are in the JSON matrix.
- `balance_sheet_policy_expectations/fed_assets/fed_assets_soma/modal_point_estimate/levels`: 1/26; exact missing cycles are in the JSON matrix.
- `markets/mkt_mbs_spread/mkt_mbs_spread_30yr/modal_point_estimate/levels`: 1/26; exact missing cycles are in the JSON matrix.
- `markets/mkt_tsy_yield/mkt_tsy_yield_10yr_nom/modal_point_estimate/levels`: 2/26; exact missing cycles are in the JSON matrix.
- `economic_outlook/employment/unemployment_rate/modal_point_estimate/levels`: 6/26; exact missing cycles are in the JSON matrix.
- `balance_sheet_policy_expectations/fed_assets/fed_assets_ambs/path_of_modes/levels`: 25/26; exact missing cycles are in the JSON matrix.
- `balance_sheet_policy_expectations/fed_assets/fed_assets_soma/path_of_modes/levels`: 6/26; exact missing cycles are in the JSON matrix.
- `balance_sheet_policy_expectations/fed_assets/fed_assets_total_assets/path_of_modes/levels`: 25/26; exact missing cycles are in the JSON matrix.
- `balance_sheet_policy_expectations/fed_assets/fed_assets_treasury/path_of_modes/levels`: 25/26; exact missing cycles are in the JSON matrix.
- `balance_sheet_policy_expectations/fed_liabilities/fed_liabilities_currency/path_of_modes/levels`: 25/26; exact missing cycles are in the JSON matrix.
- `balance_sheet_policy_expectations/fed_liabilities/fed_liabilities_tga/path_of_modes/levels`: 25/26; exact missing cycles are in the JSON matrix.
- `markets/mkt_mortgage_rate/mkt_mortgage_rate_30yr_fixed_primary/path_of_modes/levels`: 6/26; exact missing cycles are in the JSON matrix.
- `markets/mkt_tsy_yield/mkt_tsy_yield_10yr_nom/path_of_modes/levels`: 6/26; exact missing cycles are in the JSON matrix.
- `markets/money_market_spreads/mnmspreads/path_of_modes/levels`: 15/26; exact missing cycles are in the JSON matrix.
- `communications/sep_median/sep_median_core_pce/path_of_modes/levels`: 7/26; exact missing cycles are in the JSON matrix.
- `communications/sep_median/sep_median_fed_funds_target_range/path_of_modes/levels`: 13/26; exact missing cycles are in the JSON matrix.
- `communications/sep_median/sep_median_headline_pce/path_of_modes/levels`: 7/26; exact missing cycles are in the JSON matrix.
- `communications/sep_median/sep_median_real_gdp_growth/path_of_modes/levels`: 7/26; exact missing cycles are in the JSON matrix.
- `communications/sep_median/sep_median_unemployment_rate/path_of_modes/levels`: 7/26; exact missing cycles are in the JSON matrix.
- `economic_outlook/inflation/headline_cpi/percentiles/levels`: 6/26; exact missing cycles are in the JSON matrix.
- `economic_outlook/inflation/headline_pce/percentiles/levels`: 6/26; exact missing cycles are in the JSON matrix.
- `economic_outlook/real_gdp_growth/real_gdp_growth/percentiles/levels`: 6/26; exact missing cycles are in the JSON matrix.
- `economic_outlook/employment/unemployment_rate/percentiles/levels`: 6/26; exact missing cycles are in the JSON matrix.
- `balance_sheet_policy_expectations/fed_assets/fed_assets_soma/probability_distribution/levels`: 19/26; exact missing cycles are in the JSON matrix.
- `markets/mkt_tsy_yield/mkt_tsy_yield_10yr_nom/probability_distribution/levels`: 1/26; exact missing cycles are in the JSON matrix.
- `markets/money_market_spreads/mnmspreads/probability_distribution/levels`: 2/26; exact missing cycles are in the JSON matrix.
- `economic_outlook/employment/unemployment_rate/probability_distribution/levels`: 8/26; exact missing cycles are in the JSON matrix.
- `economic_outlook/recession/us_recession/probability_distribution/levels`: 18/26; exact missing cycles are in the JSON matrix.
- `rate_policy_expectations/fed_funds_target_range/fed_funds_target_range/scenarios/levels`: 6/26; exact missing cycles are in the JSON matrix.
- `markets/money_market_spreads/mnmspreads/scenarios/levels`: 5/26; exact missing cycles are in the JSON matrix.
- `communications/communications_grade/communications_grade/rating_scale/rating`: 13/26; exact missing cycles are in the JSON matrix.
- `markets/mkt_tsy_yield/mkt_tsy_yield_5y5y_nom/factors/weights`: 1/26; exact missing cycles are in the JSON matrix.

## Shape, nulls and counting limits

Duplicate source-key groups: **0** using `(survey_release_date, panel_type, value_tag, aggregation)`. Null U rows: **0**; blank-string U rows: **0**; zero-valued count rows: **0**; source formula cells: **0**; Excel error cells: **0**. These checks cover all 63,190 data rows, not unreported or suppressed cells.

There are **252 date-encoded U string rows** and **0 other U string rows**. The profile records only their types and source pointers. A date-encoded aggregate of a month/quarter dropdown must not acquire invented day precision. No suppression rule is inferred from the observed cell shapes.

Count-row totals describe row coverage, not the number of distinct responding firms. Per-item counts may differ; Combined results must not be reconstructed from subgroup medians. General formatting is not a unit dictionary. Changes, levels, probabilities, ratings, date encodings, and nested percentile questions require their source semantics.

## Evidence and use limits

- Capture manifest: `work/raw/nyfed-survey-cross-cycle/capture-cross-cycle-2026-11-09.json`; SHA256 `fd67cc6a9474c13c11e4f51a78394bfdf8dbad6f4fc0e4ab3f12e8edf8d78939`.
- Archive link inventory: `outputs/nyfed-survey-archive-manifest-2026-11-09.json`; SHA256 `63031be9f2508900ca3348a2160336ce3956e6aaec8686f86ef46b34309f82e1`.
- The 24 new files have individual HTTP receipts. The two reused files retain their original receipts; they were not presented as freshly downloaded.
- All requested and final URLs are official `www.newyorkfed.org` links, and every downloaded file matched an explicit archive link.
- The current 2026 archive is a current producer representation, not original-vintage authentication. No first-publication timestamp or immutable historical file guarantee is created.
- The new 24 workbooks were not individually paired with all their question/results PDFs. Exact source wording and units remain accessible through source pointers; the earlier September 2026/December 2024 detailed audit and its PDF fixtures are preserved.
- No earlier unlinked workbooks, missing question families, missing panels or suppressed figures were filled. No forecasts, errors, losses, returns or trading signals were calculated.

© 2026 Federal Reserve Bank of New York. Source titles: *Survey of Market Expectations*, *Survey of Primary Dealers*, and *Survey of Market Participants*. Source material is subject to the [New York Fed Terms of Use](https://www.newyorkfed.org/privacy/termsofuse). Independent derivative metadata map by MeridianX research; not created or endorsed by the New York Fed. Source workbooks unmodified.

## Additional aggregation and qualitative-content checks

The exact `count` row total above excludes **195 `count_1` through `count_5` category-count rows across 13 cycles**. All attach to `commgrade_rating`, the 1–5 communication-effectiveness rating question. There are **27 zero category-count cells**; these are distinct from a zero respondent denominator and are not interpreted as missing or suppressed observations. All aggregation codes are preserved verbatim.

Observed question modes are `levels`, `changes`, `rating` and `weights`; observed question types are `composition`, `dropdown`, `factors`, `modal_point_estimate`, `path_of_modes`, `percentiles`, `probability`, `probability_distribution`, `rating_scale` and `scenarios`. Every observed U cell uses General formatting; that is not a common unit.

For the inspected September 2026 cycle, native Q1a and Q1c have no workbook question-number rows, while results PDF pages 4 and 5 publish qualitative commentary with 41 and 61 responses respectively. Thus XLSX coverage is published numeric/date aggregate elements, not all qualitative questionnaire content. The PDF remains complementary. No qualitative answer is inferred from missing XLSX tags, and this specific PDF reconciliation was not generalized to all 26 cycles.

Exact value tags also have a cross-cycle presence/absence catalogue; year- or date-bearing tags are retained verbatim and absent cycles remain missing.
