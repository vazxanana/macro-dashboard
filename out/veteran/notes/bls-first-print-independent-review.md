# Independent BLS first-print CPI extraction

All **36 releases during calendar 2022–2024** were independently extracted from the local raw official BLS archived releases. This review read the agreed cohort and raw HTML only; it did not read the root's extraction, use model forecasts, or calculate model errors or market statistics. All **144 narrative checks** agree with Table A.

The reference months are December 2021 through November 2024. The numeric strings below are percentages, retained at one decimal place. Literal source tokens such as `.5` are also preserved in the companion JSON, alongside normalized `0.5` strings. No extra decimal precision was inferred.

| Target | BLS release | Headline SA MoM | Core SA MoM | Headline NSA YoY | Core NSA YoY | UTC embargo |
|---|---|---:|---:|---:|---:|---|
| 2021-12 | 2022-01-12 | 0.5 | 0.6 | 7.0 | 5.5 | 13:30 |
| 2022-01 | 2022-02-10 | 0.6 | 0.6 | 7.5 | 6.0 | 13:30 |
| 2022-02 | 2022-03-10 | 0.8 | 0.5 | 7.9 | 6.4 | 13:30 |
| 2022-03 | 2022-04-12 | 1.2 | 0.3 | 8.5 | 6.5 | 12:30 |
| 2022-04 | 2022-05-11 | 0.3 | 0.6 | 8.3 | 6.2 | 12:30 |
| 2022-05 | 2022-06-10 | 1.0 | 0.6 | 8.6 | 6.0 | 12:30 |
| 2022-06 | 2022-07-13 | 1.3 | 0.7 | 9.1 | 5.9 | 12:30 |
| 2022-07 | 2022-08-10 | 0.0 | 0.3 | 8.5 | 5.9 | 12:30 |
| 2022-08 | 2022-09-13 | 0.1 | 0.6 | 8.3 | 6.3 | 12:30 |
| 2022-09 | 2022-10-13 | 0.4 | 0.6 | 8.2 | 6.6 | 12:30 |
| 2022-10 | 2022-11-10 | 0.4 | 0.3 | 7.7 | 6.3 | 13:30 |
| 2022-11 | 2022-12-13 | 0.1 | 0.2 | 7.1 | 6.0 | 13:30 |
| 2022-12 | 2023-01-12 | -0.1 | 0.3 | 6.5 | 5.7 | 13:30 |
| 2023-01 | 2023-02-14 | 0.5 | 0.4 | 6.4 | 5.6 | 13:30 |
| 2023-02 | 2023-03-14 | 0.4 | 0.5 | 6.0 | 5.5 | 12:30 |
| 2023-03 | 2023-04-12 | 0.1 | 0.4 | 5.0 | 5.6 | 12:30 |
| 2023-04 | 2023-05-10 | 0.4 | 0.4 | 4.9 | 5.5 | 12:30 |
| 2023-05 | 2023-06-13 | 0.1 | 0.4 | 4.0 | 5.3 | 12:30 |
| 2023-06 | 2023-07-12 | 0.2 | 0.2 | 3.0 | 4.8 | 12:30 |
| 2023-07 | 2023-08-10 | 0.2 | 0.2 | 3.2 | 4.7 | 12:30 |
| 2023-08 | 2023-09-13 | 0.6 | 0.3 | 3.7 | 4.3 | 12:30 |
| 2023-09 | 2023-10-12 | 0.4 | 0.3 | 3.7 | 4.1 | 12:30 |
| 2023-10 | 2023-11-14 | 0.0 | 0.2 | 3.2 | 4.0 | 13:30 |
| 2023-11 | 2023-12-12 | 0.1 | 0.3 | 3.1 | 4.0 | 13:30 |
| 2023-12 | 2024-01-11 | 0.3 | 0.3 | 3.4 | 3.9 | 13:30 |
| 2024-01 | 2024-02-13 | 0.3 | 0.4 | 3.1 | 3.9 | 13:30 |
| 2024-02 | 2024-03-12 | 0.4 | 0.4 | 3.2 | 3.8 | 12:30 |
| 2024-03 | 2024-04-10 | 0.4 | 0.4 | 3.5 | 3.8 | 12:30 |
| 2024-04 | 2024-05-15 | 0.3 | 0.3 | 3.4 | 3.6 | 12:30 |
| 2024-05 | 2024-06-12 | 0.0 | 0.2 | 3.3 | 3.4 | 12:30 |
| 2024-06 | 2024-07-11 | -0.1 | 0.1 | 3.0 | 3.3 | 12:30 |
| 2024-07 | 2024-08-14 | 0.2 | 0.2 | 2.9 | 3.2 | 12:30 |
| 2024-08 | 2024-09-11 | 0.2 | 0.3 | 2.5 | 3.2 | 12:30 |
| 2024-09 | 2024-10-10 | 0.2 | 0.3 | 2.4 | 3.3 | 12:30 |
| 2024-10 | 2024-11-13 | 0.2 | 0.3 | 2.6 | 3.3 | 13:30 |
| 2024-11 | 2024-12-11 | 0.3 | 0.3 | 2.7 | 3.3 | 13:30 |

## Selection and cross-check method

The first four releases (January–April 2022) have a preformatted text Table A, wrapped core labels, and omitted leading zeros. The remaining 32 have semantic HTML Table A, id `cpi_pressa`. For the HTML pages, the selected monthly cells explicitly refer to `cpi_pressa.h.2.8` and the annual cells to `cpi_pressa.h.1.9`. Exact row labels are All items and All items less food and energy. For text tables, all seven monthly headings were captured, the final heading was checked against the release reference month, and the seventh monthly/eighth annual row values were used. Both table formats' annual headers were verified against the same target month.

The JSON retains all eight Table A row tokens and seven monthly headings for audit. Earlier monthly columns can contain revised history; they are not substituted for the current release's last seasonally adjusted monthly column. Annual values are the final unadjusted 12-month column. Every headline/core monthly and annual figure was separately parsed from the opening narrative and matched, including unchanged as 0.0 and declines as negative values. Reference month, printed embargo date, and URL filename agree throughout. Printed weekdays were checked wherever provided.

## Clock and vintage limits

Every release states 08:30 a.m. ET. The JSON preserves that source label and derives UTC using America/New_York: 13:30 in standard time, 12:30 in daylight time. These are announced embargo/release times, not observed website publication receipts or verified trader arrival times. The source records do not supply independent original-delivery timestamps. Current retrieval time and page footer metadata must not be used as historical availability evidence.

The earliest four raw pages contain Windows-1252 punctuation that produces replacement characters if decoded as UTF-8. The helper uses a Windows-1252 fallback for those pages; numeric tokens remain unchanged. There are no unresolved value/header parsing ambiguities.

No explicit corrected/correction-notice/revised-on/erratum text was detected in the visible release content by the bounded scan. This does not certify that no historical corrections occurred. First-print here means the current-month entry in the official date-specific release archive, captured in 2026; the original release-day bytes and absence of silent later changes are not independently authenticated. Raw file SHA-256 values are retained for comparison and future audit. The existing BLS archive warning about subsequent revisions remains applicable.

The companion is `work/bls-first-print-independent-review.json`; the reproducible helper is `work/bls-first-print-independent-helper.mjs`. No raw captures, cohort files, frozen archives, or outputs were altered.
