# CPI and PPI before PCE: 36-release source panel and fixed proxy

**Scope:** 36 reference months, December 2021–November 2024, with public releases January 2022–December 2024. The [joined panel](cpi-ppi-to-pce-release-panel-2022-2024.csv) combines the earlier [BLS schedule/CPI first-print matrix](ppi-cpi-availability-and-cpi-first-print-2022-2024.csv) with 36 [BEA originally reported PCE prints](pce-original-release-first-print-ledger-2022-2024.csv). The [BEA extraction evidence](pce-original-release-extraction-evidence-2022-2024.json) retains each source page, dated embargo header, title and the exact table lines used. One [August 2022 release](https://www.bea.gov/news/2022/personal-income-and-outlays-august-2022-and-annual-update) carries an annual-update suffix; its original-release table is included.

## Chronology result

The PPI and CPI **scheduled/embargo clocks** both precede the matched BEA PCE embargo clock in **36 of 36** rows. PPI precedes CPI in just five; the CPI/PPI→PCE route can use both regardless of their order relative to each other. These clocks do **not** authenticate original web posting or our data receipt. No current-vintage BEA API values were used as historical targets. The BEA archive pages state that their original data have been superseded; this panel intentionally retains the current-reference-month print on each dated release.

## Descriptive CPI-only reference point

At a hypothetical cutoff after CPI and before PCE, use **core CPI monthly first print as an unadjusted numeric guess for core PCE monthly original print**. Across the 36 rows, that identity proxy has MAE **0.094 percentage points**, RMSE **0.129 percentage points**, mean CPI-minus-PCE error **+0.078 percentage points**, and **13 exact matches at one-decimal precision**. [Exact machine-readable calculations and limits](core-cpi-to-core-pce-fixed-proxy-2022-2024.json) and the per-month errors are saved. This calculation was made after constructing the panel and is **exploratory/descriptive**, not a pre-registered out-of-sample score or a benchmark victory.

The positive average gap shows why an unadjusted CPI copy is a weak final model. BEA's [source mapping description](https://www.bea.gov/help/faq/521) explains that PCE has detailed CPI/PPI inputs and Fisher aggregation; the detailed mapping and weights must be versioned. [BEA's CPI/PCE reconciliation](https://www.bea.gov/help/faq/555) covers conceptual and weighting differences. This baseline alone cannot infer a PPI contribution.

## Required next test

1. The [36-row PPI four-series ledger](ppi-original-release-four-series-2022-2024.csv) is now populated; inspect the [retrospective expanding-window comparison](cpi-ppi-to-pce-expanding-model-check-2022-2024.md) before using the broad aggregate. It finds no robust incremental skill.
2. Obtain the applicable historical BEA source crosswalk, or mark components unavailable; the linked October 2026 workbook is a **current** map and cannot be backcast silently across method updates.
3. Freeze a component-level CPI-only baseline and a CPI+PPI candidate **before** scoring a contiguous holdout and a prospective period. Compare monthly squared and absolute errors, bias and influence; count missing cases. Do not fit a rich model on 36 monthly rows.
4. Treat any XAU/USD release reaction as a separate, timestamped demo execution study with consensus and executable bid/ask data. This panel contains no gold returns or trading edge.

**Status:** Dated release-page collection and schedule-order audit, with a CPI-only reference point and an exploratory broad-PPI model comparison. Original posting timestamps, page hashes, detailed PPI-to-PCE component mapping, historical BEA crosswalk, consensus, and demo quotes are still open gates.
