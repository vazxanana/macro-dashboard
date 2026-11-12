# Latest research batch: complete status and next work

Prepared 8 November 2026 for the user's private research and trading. The batch includes completed research, executable tools, models, source records and working notes. A working proposal is not a finished empirical result, and synthetic tests are not real resolved forecasts.

## Completed analytical and operational work

- The corrected reference library, source registries, macro/issuer cases and validation notes remain available through the [research index](research-pack-index.md).
- The [forecast tools](forecast-ledger-evaluation-guide.md) passed 50 packaged tests: 35 general and 15 CPI-specific. These establish tested software behavior, not predictive skill.
- The [October CPI pilot](core-cpi-prospective-pilot-2026-11-08.md) has one real locally timestamped issuance at 0.255% core m/m and remains unresolved. Six absolute case plans exist; the five later cases have no issued forecasts or fabricated inputs.
- The [Newmont workbook](newmont-cash-flow-model-2026-11-08.md) reconciles historical consolidated cash flow, retains actual reclamation cash, and provides conditional gold/cost/tax/capex scenarios. Seventeen behavioral checks, source-value comparisons, export/reimport and visual review were completed. It is not a Q4 forecast or equity valuation.
- The [publication-clock audit](bls-publication-timestamp-audit-2026-11-08.md) distinguishes publisher metadata, schedules and actual receipts. Official feed metadata alone did not prove an early public release.

## New findings since revision 1.1

### Historical Cleveland Fed model data are available

The monthly chart on the [official nowcasting page](https://www.clevelandfed.org/indicators-and-data/inflation-nowcasting) declares a [direct JSON data file](https://www.clevelandfed.org/-/media/files/webcharts/inflationnowcasting/nowcast_month.json?sc_lang=en). The captured file has 161 monthly chart objects for July 2013–November 2026, each with model paths and actual series. Its chart component declares CC BY 4.0; the batch preserves the attribution and license evidence. This resolves an earlier discovery gap, rather than proving that no archive existed before.

The working extraction found headline/core model values dated before all 36 BLS releases in calendar 2022–2024. These are **producer-maintained historical model benchmarks, not survey consensus**. The current 2026 file is not a contemporaneously captured delivery log. Full source, extraction and licensing details are in `work/historical-cpi-expectations-route.md`.

Two cohorts remain distinct:

| Definition | Reference months | Release-date coverage |
|---|---|---|
| Original target-month extraction | January 2022–December 2024 | Extends into January 2025 |
| Intended calendar-release study | December 2021–November 2024 | 36 releases during January 2022–December 2024 |

The batch retains both extractions, all 37 captured BLS release pages and the explicit out-of-cohort January 2025 record. It does not silently shift the sample. The Cleveland chart actuals can be unrounded; the eventual study must use each BLS release's printed current-month value and precision, not substitute the chart's actual series.

### The GLD archive route and field definitions changed

The [issuer GLD page](https://www.spdrgoldshares.com/usa/gld/) now links a [historical XLSX archive](https://api.spdrgoldshares.com/api/v1/historical-archive?exchange=NYSE&lang=en&product=gld). The old CSV-looking route currently redirects to a bar-list PDF. Response status and filename alone do not identify the dataset.

The local inspection found daily share-price/NAV/holding fields, not a historical LBMA benchmark-price column. The file reports that LBMA prices were removed. Historical clock labels also differ from current-page descriptions. NAV, share close, indicative value and a broker's XAUUSD quote are different outcomes. The complete schema/coverage/rights review is in `work/gld-historical-data-route.md`; the numerical price database is excluded from the shareable batch under its usage restrictions. Its URL, hash, schema profile and findings are retained.

The user confirmed private research and trading. That purpose is recorded; it is not represented as written authorization for every derivative or redistribution use under the [issuer's terms](https://www.spdrgoldshares.com/terms-and-conditions/).

### One early-release event has direct official evidence

BLS explicitly documented a subset of CPI/Real Earnings files loaded approximately 30 minutes early on **15 May 2024**. This is direct event-specific evidence, unlike inferring early access from a feed timestamp. The exact first availability of every headline/core field remains unestablished. [BLS notice](https://www.bls.gov/cpi/notices/2024/early-data-release-05152024.htm)

## Work that is not yet complete

`work/cpi-gold-study-design-review.md` is a detailed **proposed** retrospective design. It has not been converted into a frozen analysis specification, and no historical gold-return, Treasury-change, event/control contrast, coefficient or performance result has been calculated for this study.

The proposal separates a conditional daily GLD NAV association from an independent official-Treasury rate module. It specifies clocks, matching, overlap flags, missingness, uncertainty, falsification and declared variants. Daily data cannot establish an 08:30–08:35 response, a causal CPI effect or tradable broker returns. A Treasury result must not be relabeled as a gold result.

Historical monthly survey-consensus access remains unverified. Vendor documentation was located, but no proven pre-release monthly CPI consensus dataset or entitlement was delivered. Model forecast errors must keep their model label.

The next concrete steps are to finalize the intended source/use and endpoint, freeze the chosen specification before inspecting market statistics, extract all first-print target fields, build the event/control coverage table, and then run the declared analysis. The historical sample would remain retrospective; a freeze now cannot turn it into a past prospective experiment or untouched holdout.

## How the assistant should read this batch

Use current `outputs/` documents as the main reference layer and `work/` notes as supporting research history. Some working files are superseded audits, deliberate invalid controls or synthetic future scenarios. They must not replace the real CPI ledger or be interpreted as observations.

The inventory records included files and explicit exclusions. Dependencies/caches and duplicate expanded older packages are not research findings. Restricted publisher bodies are represented by URLs, hashes, schema/source records and authored analysis. Earlier V1 and V1.1 ZIPs are retained for provenance; they are not competing current instructions.
