# NY Fed survey archive map: 127 cycles, 26 linked data files

This map inventories the official page captured at **07:55:21 UTC on 9 November 2026**. It identifies links and missing link slots; it does not certify each endpoint, inspect every PDF or establish original publication dates. The [machine-readable manifest](nyfed-survey-archive-manifest-2026-11-09.json) retains exact cycle labels, instrument columns, URLs, source-row positions and update markers. The [validation record](nyfed-survey-archive-validation-2026-11-09.json) binds independent comparison of all rows/links and literal source-row hashes.

The captured page contains **127 cycle rows** across 2011–2026: 112 predecessor-survey cycles and 15 SME cycles. It links 215 questionnaire URLs, 214 result URLs and 26 XLSX data URLs; each URL is unique within its type. These are link counts, not counts of independently checked documents or economic observations. [Official survey archive](https://www.newyorkfed.org/markets/market-intelligence/survey-of-market-expectations).

| Period | Cycle rows | Questionnaire / result links by instrument | Cycle-level XLSX links |
|---|---:|---|---:|
| 2011–2013 | 24 | SPD: 24 / 24; no SMP links listed | 0 |
| 2014–2022 | 72 | SPD: 72 / 72; SMP: 72 / 72 | 0 |
| 2023 | 8 | SPD: 8 / 8; SMP: 8 / 8 | 4 |
| 2024 | 8 | SPD: 8 / 8; SMP: 8 / 8 | 8 |
| 2025 | 8 | SME: 8 / 8 | 8 |
| 2026 captured portion | 7 | SME: 7 / 6 | 6 |

The four 2023 XLSX links are July, September, October/November and December, retaining the publisher's combined-month label. October 2026 is the one SME row with questions but no linked results/data; September is the latest row with all three links. An empty slot means the captured page did not list a link. It is not a failed download, a zero response, or proof that an unlisted object never existed.

The legacy page places one shared data file beside dealer and participant columns. Count it once per cycle. Do not treat the same XLSX as two independent datasets or reconstruct Combined medians by averaging subgroup medians. The [source-ingestion case](nyfed-survey-expectations-ingestion-2026-11-09.md) explains the aggregate structure, changing panels and field-specific units.

## Twelve rows need response-phase review

The archive marks these cycle rows with an asterisk:

- 2022: September.
- 2016: March, December.
- 2015: March, September, December.
- 2014: March.
- 2013: June, September.
- 2012: September, October, December.

The page's legend warns of later response updates in result appendices. A row marker therefore triggers inspection of the relevant PDF's collection/update phases. It does not show that every subgroup or answer changed, and it does not require discarding the initial premeeting answers when those are separately identifiable. The manifest preserves the marker without inventing update dates.

## Use the manifest as a discovery layer

Choose a cycle and instrument, then fetch only its listed questionnaire, result and available data file. Preserve the receipt and file hash. Map native questions, targets, scenarios, units and counts against that cycle's documents before normalizing values. Keep original survey-response dates separate from when those answers became public.

The XLSX history has a later format-availability boundary: the NY Fed announced the July 2023–September 2024 backfill and new Combined aggregates on 10 October 2024. The 2025 SME merger also expanded the nondealer panel. These transitions prevent a current link from proving a uniform real-time dataset across the full archive. [Format announcement](https://www.newyorkfed.org/markets/opolicy/operating_policy_241010), [merger announcement](https://www.newyorkfed.org/markets/opolicy/operating_policy_250113).

No archive-wide numeric extraction, forecast test, market return or execution result was produced. Original-time result availability remains unresolved where independent evidence is absent.

© 2026 Federal Reserve Bank of New York. Content from the New York Fed subject to the Terms of Use at newyorkfed.org. Link selection and metadata classification are independent MeridianX research modifications, not NY Fed work or endorsement. Preserve applicable [Terms of Use](https://www.newyorkfed.org/privacy/termsofuse) when sharing the underlying content.
