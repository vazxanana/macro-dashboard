# Independent Treasury field-binding audit

**All six series/year bindings pass the adopted amendment 01.** Both2022 and 2023 annual HTML requests returned No Results Found and no table; these original failures remain recorded. Under the preserved pre-outcome amendment, official archived 2020–2023 CSV files match every selected 2022/2023 XML date and decimal exactly. The 2024 semantic HTML tables likewise agree. No differences, returns, contrasts or outcome statistics were calculated; no yield levels are included.

| Series | Year | XML dated entries | Adopted format binding |
|---|---|---:|---|
| real | 2022 | 249 | official archived CSV under adopted amendment 01: PASS |
| real | 2023 | 250 | official archived CSV under adopted amendment 01: PASS |
| real | 2024 | 250 | official semantic HTML: PASS |
| nominal | 2022 | 249 | official archived CSV under adopted amendment 01: PASS |
| nominal | 2023 | 250 | official archived CSV under adopted amendment 01: PASS |
| nominal | 2024 | 250 | official semantic HTML: PASS |

## Field and date semantics

The real series uses TC_10YEAR in DailyTreasuryRealYieldCurveRateData; the nominal series uses BC_2YEAR in DailyTreasuryYieldCurveRateData. Matching2024 HTML headers are 10 YR and 2 Yr, with exact header identifiers retained in the JSON. Select cells by the exact headers attribute. Real 20 YR and 30 YR cells reuse the TC10YEAR class, and tables include hidden columns from other rate categories; substring class matching or fixed positions can bind the wrong maturity.

NEW_DATE is Edm.DateTime with a midnight mask throughout all six XML files. It is an observation-date label, not the input quote, website release or receipt clock. Every parsed date is valid, within the requested year, and Monday–Friday. The JSON retains absent fixed-calendar weekdays without calling them verified holidays. No selected-field nulls, absent fields or conflicting/identical duplicate date rows were found. Zero and negative tokens are valid and are not missing-value rules.

No next-page links or default 300-row-cap signatures occur in these annual feeds. Treasury XML documentation specifies the annual endpoint separately from the all-years paginated endpoint. The requested ranges extend through the first/last observed dates of each year; this does not independently certify every expected Treasury session. The 2024 HTML and amended2022/2023 archived CSV comparisons have identical selected annual date masks.

## Units, transport and historical limits

The intended convention is percent-form annual bond-equivalent par yields. The HTML maturity headers do not themselves print a percent label, and Edm.Double is not a unit declaration. [Treasury’s official FAQ](https://home.treasury.gov/policy-issues/financing-the-government/interest-rate-statistics/interest-rates-frequently-asked-questions) describes CMT annual bond-equivalent quotations and distinguishes percent from decimal notation. The captured definitions distinguish nominal par and TIPS par-real curve families. Do not infer scale from value magnitude or treat same-format equality as a separate unit definition.

All saved capture hashes and byte counts agree with the capture manifest, and the protocol hash matches the adopted manifest. Some HTTP Content-Length values differ from saved bodies; automatic decompression is a plausible explanation, but the capture did not retain Content-Encoding. The hashes authenticate these saved application-body captures, not original historical wire bytes.

This is current same-producer format consistency. It is not independent-source corroboration, historical first-publication authentication, an exact quote-time audit or a complete closure calendar. The original 2022/2023 HTML failures remain in the audit; amendment 01 specifies the official archived CSV route, which now passes exact date/Decimal comparisons. The original protocol and adopted amendment hashes both match their capture manifests. Raw files, protocol and root outputs were not modified.

Five bounded regression checks pass: intended series/year coverage, valid zero/negative versus missing-token handling, equivalent/conflicting duplicates, preserved original HTML failures, and every amended exact-format comparison. All 19 saved-source hashes and byte counts agree with the two capture manifests.
