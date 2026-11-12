# Assistant reference update — corrections and quality audit

**Date:** 8 November 2026. Apply this note to the current master references when preparing the next assistant update. The original V1 ZIP remains an archive; it is not evidence that every example in it passed validation.

## Correction that affects the already shared V1 example

Replace V1's `research-evidence-record-example.json` with the [corrected master example](research-evidence-record-example.json). Its calculated net-position record used `revision_status: "derived"`, which its own schema does not allow. The corrected value is `not_applicable`; derivation remains represented by the record type and quality status.

The destination inside the assistant package is `gptmacro-v-1/references/research-evidence-record-example.json` (or `references/research-evidence-record-example.json` relative to its skill folder).

The same record also placed observation IDs in a field intended for source IDs and inherited its input report's publication date. The correction keeps observation references under `measurement.derivation.input_record_ids`, clears the calculation's unsupported publication date and records the reconstruction time. The two reported inputs now mark initial-vintage status as unknown because original-release bytes were not captured. Do not infer historical delivery from a later retrieval.

Use the [evidence schema](research-evidence-record.schema.json), [corrected example](research-evidence-record-example.json), and this note together. The new [GDP vintage case](gdp-revision-and-composition-case-2023-q3.md) demonstrates explicit missing values, three release clocks, revision links and source hashes.

## Corrections to the later master-library increment

| Area | Corrected distinction | Evidence |
|---|---|---|
| CFTC COT date | 3 November 2026 is the latest checked COMEX futures-only position date; 27 October is its comparison date. Publication was scheduled for 6 November at 3:30 p.m. ET; the report was available when checked. The actual delivery timestamp was not captured. | [COMEX report](https://www.cftc.gov/dea/futures/deacmxlf.htm), [release schedule](https://www.cftc.gov/MarketReports/CommitmentsofTraders/ReleaseSchedule/index.htm) |
| COT coverage | Nonreportable aggregate long/short totals are published residuals, while identities/counts/classifications are unavailable. Legacy history before 30 September 1992 is not uniformly weekly. | [Explanatory notes](https://www.cftc.gov/MarketReports/CommitmentsofTraders/ExplanatoryNotes/index.htm), [historical archive](https://www.cftc.gov/MarketReports/CommitmentsofTraders/HistoricalCompressed/index.htm) |
| Private-credit amounts | Repair currency values damaged during a text edit. F4.4.s is $1.5399tn at 2026 Q2. For 2025 Q4, the methods note distinguishes $1.857tn domestic-vehicle assets, $1.083tn of their U.S.-business loans and $1.458tn of such loans including foreign vehicles. | [Z.1 release](https://www.federalreserve.gov/releases/z1/20260911/z1.pdf), [methods, Table 1](https://www.federalreserve.gov/econres/notes/feds-notes/introducing-private-credit-into-the-financial-accounts-of-the-united-states-20261016.html) |
| Z.1 flow units and matrix | Quarterly D3.t/F4.4.t flows are SAAR. Printed M3.t is an annual 2025 sector-by-instrument matrix in this release; it is not current-quarter bilateral lending. | [Release and table notes](https://www.federalreserve.gov/releases/z1/20260911/z1.pdf) |
| Dealer fails and accounting | FR 2004C weekly fails accumulate daily amounts, including weekends/holidays; unresolved amounts repeat. FR 2004A and SI differ in accounting basis, preventing mechanical reconciliation. | [FR 2004 instructions](https://www.federalreserve.gov/apps/reportingforms/Download/DownloadAttachment?guid=950ab256-b485-4586-99b0-b27eb205fdfa) |
| ALFRED initial releases | Request an explicit historical real-time range with output_type=4; default real-time parameters are today's date. Daily vintages cannot prove intraday availability. | [Observations API](https://fred.stlouisfed.org/docs/api/fred/series_observations.html), [real-time periods](https://fred.stlouisfed.org/docs/api/fred/realtime_period.html) |

## How to use the audit

The later [forecast evaluation addition](forecast-ledger-evaluation-guide.md) supplies an executable scorer, a separate full-schema checker, a plan schema and synthetic binary/quantile/point cases. Its [own verification report](forecast-evaluator-validation-2026-11-08.json) covers 35 runtime tests, fixture-schema checks and eight schema-command cases. An independent review reproduced and rechecked a publication-cutoff fix: completing a pending resolution cannot silently make an already excluded forecast eligible. A recipient test also led to runnable schema commands and examples that preserve the supplied reports. These are separate checks from the evidence-record audit below.

The master forecast schema adds optional actual-publication and outcome-unit fields to resolution snapshots; the existing forecast example still validates. Include these fields for a strict prospective evaluation. Preserve V1, copy additions as a new increment, and retain the original creation timestamps rather than presenting retrospective or synthetic work as prospective. The CPI plan's 8 November review separately corrects C-CPI-U revision status, yield-to-basis-point conversion and unverified preliminary consensus context.

The [validation report](research-validation-report-2026-11-08.json) records completed checks: both current evidence files and the forecast example pass JSON Schema 2020-12 with date/URI formats enabled. The 45 new records also pass lineage, chronology, missing-value, arithmetic and raw-file-hash checks. Three deliberately reintroduced known defects are rejected. Reading the example directly from the frozen V1 ZIP reproduces its enum failure; the corrected master passes. A scan of top-level Markdown found 11 malformed table rows, which were repaired; its table/link/control-character checks now report no issues.

Validate examples against the supplied schema with date and URI formats enabled, then check semantics separately: unique IDs, source versus observation lineage, revision chains, calculation inputs, units, missing values and publication versus receipt. A schema pass cannot prove that a financial claim is true.

For new source additions, reconcile copied claims across the registry, source map, playbook and index. Inspect the publisher's actual position/reference date and comparison date, not just a page title. Check the literal saved values after editing, especially currency symbols, decimals and minus signs. Independent source review and file validation address different errors.

V1 archive SHA-256: `69c97e348d08ca12f140d617c28ee8e1fa5d8f83b5c76fd1da0b30c6ecf5ba1f`.

This review improves the reference library and its examples. It does not establish predictive performance; that requires forecasts issued before outcomes and scored under predefined rules.
