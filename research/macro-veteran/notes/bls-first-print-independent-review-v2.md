# Independent BLS first-print review v2: notice scan repaired

V1 missed **two explicit reissue notes** in the same captured releases. Its numerical extraction remains intact; this v2 is a bounded metadata correction. V1's regex omitted reissued/re-issued, singular correct, incorrectly, and inadvertent wording. It therefore returned a false zero count even though both notices were present. Numeric agreement could not detect that metadata failure. V1 and the root addendum remain unchanged.

The new helper scans complete paragraphs in the **first PRE** of every release, retains full notice text and trigger reasons, and separately counts routine revision guidance. It captures the June 12 and July 11, 2024 reissue notes. Candidate detection still requires product/scope review; a zero hit is not proof of no corrections.

| Evidence | Scope | Implication for selected HTML Table A fields |
|---|---|---|
| June 12, 2024 embedded note and errata | CPI-W monthly unadjusted narrative; direction corrected to increase | Notice does not identify changes to selected CPI-U headline/core monthly/annual fields. |
| July 11, 2024 embedded note and errata | Inpatient hospital services detail removed from Tables 2, 6, 7 and companion file | Notice does not identify changes to selected Table A fields. |
| February 10, 2022 PDF reissue, registered February 11 | January 2022 PDF tables | Register explicitly says text and other versions were correct as originally published; do not transfer PDF errors to HTML Table A. |
| October 10, 2024 companion XLSX errata | **September 2024 reference month**, columns Q–AC labelled unadjusted instead of seasonally adjusted | Companion-file labels are a separate product from selected HTML Table A. |

The official sources are the [BLS errata register](https://www.bls.gov/errata/), [June 12 archive](https://www.bls.gov/news.release/archives/cpi_06122024.htm), and [July 11 archive](https://www.bls.gov/news.release/archives/cpi_07112024.htm). Raw register and notice hashes were checked against the successful source-integrity capture manifest. Four specific errata entries were mapped with explicit scope; this is not an exhaustive certification of all historical corrections.

The [official May 15, 2024 notice](https://www.bls.gov/cpi/notices/2024/early-data-release-05152024.htm) also reports a subset of CPI/Real Earnings files loaded approximately 30 minutes early. The 08:30 ET header is a scheduled embargo time, not universal actual availability. The notice alone does not identify the selected file/field arrival time, justify an exact 08:00 timestamp, or authenticate original bytes. The JSON flags this release separately as a clock exception.

All 36 raw hashes still match the independent v1 inputs. V2 preserves v1's 144 numeric fields, dates, and scheduled UTC conversions; it does not claim a fresh numeric extraction. It reads no root numerical extraction. No model errors, market statistics, or original-byte authentication claims were created.

Regression result: **9/9 pass**. Checks cover both real notes with complete scope text, real PRE negative control with external clock exception, hyphenated/case/line-wrap/markup reissue variants, other explicit correction wording, routine sampling-error/revision negatives, first-PRE isolation, 36 source hashes, and four errata mappings.

New files: `work/bls-first-print-independent-helper-v2.mjs`, `work/bls-first-print-independent-review-v2.json`, and this note. V1, root files, all raws, cohorts, outputs, and frozen archives were not modified.
