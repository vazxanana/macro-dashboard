# Correction to the independent review's notice scan

9 November 2026. The independent extraction's 144 numerical fields, 36 dates, source hashes and scheduled UTC conversions agree with the separate root extraction. Its claim that the bounded notice scan found no correction text is contradicted by two explicit **reissued** notes in the same captured sources.

- [12 June 2024 release](https://www.bls.gov/news.release/archives/cpi_06122024.htm): a same-day correction changed the direction in the CPI-W monthly unadjusted paragraph. The note does not identify a change to the four CPI-U Table A fields selected in this study.
- [11 July 2024 release](https://www.bls.gov/news.release/archives/cpi_07112024.htm): a same-day reissue removed unpublished-criteria inpatient-hospital-service detail from Tables 2, 6 and 7. The note does not identify a change to the selected Table A headline/core CPI-U fields.

The [official errata register](https://www.bls.gov/errata/) corroborates both notes. The root parser retains their complete text and flags both affected archives. The independent helper searched a narrower correction vocabulary and missed `reissued`; its zero-candidate result is retained as an audit failure, not relied upon as proof of no corrections. Numerical agreement alone could not catch this metadata error.

This bounded correction review found no specified correction to the selected four fields. It does not establish that original release-day bytes were identical to the present archive or rule out undocumented changes. No earlier release bytes were obtained to certify that stronger claim.

Related errata distinguish local electricity/utility aggregates, harmonized research-series files, companion-file labels and CPI-W text from the selected national CPI-U Table A measures. Do not transfer their adjustments across reporting perimeters or silently substitute current database history. Raw official register and notice captures are under `work/raw/cpi-source-integrity-2026-11-09/`.
