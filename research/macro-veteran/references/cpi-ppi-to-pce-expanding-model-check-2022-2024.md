# Does broad PPI add to a core CPI → core PCE forecast?

**Result: no convincing incremental PPI signal in this small retrospective check.** The [36-month source panel](cpi-ppi-to-pce-36-month-source-and-baseline-2022-2024.md) now contains four original-release PPI aggregate changes per month and BEA original-release PCE targets. PPI figures come from [dated BLS news releases](https://www.bls.gov/bls/news-release/ppi.htm), with one official [PDF fallback for October 2023](https://www.bls.gov/news.release/archives/ppi_11152023.pdf). [Row-level PPI extraction evidence](ppi-original-release-extraction-evidence-2022-2024.json), [PCE extraction evidence](pce-original-release-extraction-evidence-2022-2024.json), and [per-month forecast records](cpi-ppi-to-pce-expanding-forecasts-2022-2024.json) permit audit.

The first 12 months seed each model; the next 24 months are evaluated one at a time. For each month, the model is refitted using **only prior-month PCE outcomes**. The two fitted models are ordinary least squares with an intercept: (1) current core CPI print; (2) current core CPI plus PPI final demand less food, energy and trade services. A fixed identity proxy copies core CPI to core PCE. All figures below use percentage points of the monthly change.

| Model | Evaluated months | MAE | RMSE |
|---|---:|---:|---:|
| Fixed core CPI identity proxy | 24 | 0.0833 | 0.1155 |
| Expanding core CPI only | 24 | 0.0766 | 0.1003 |
| Expanding core CPI + broad PPI exclusion | 24 | 0.0748 | 0.1001 |

The candidate's MAE gain over the fitted CPI-only model is just **0.0018 percentage points**; its MSE gain is **0.000040 squared percentage points**. It has lower squared error in **12 of 24** months. A paired, three-month circular block bootstrap 95% interval for candidate-minus-CPI-only MSE is **−0.000546 to +0.000414 squared percentage points**, spanning zero. Deleting one evaluated month can reverse the sign of the MSE comparison. The 2023 RMSE is slightly worse with PPI. [Exact results, year splits, uncertainty method and limitations](cpi-ppi-to-pce-expanding-score-2022-2024.json) are saved.

This is a **retrospective exploratory check**, not a preregistered or untouched holdout. It tests one broad PPI aggregate, not the detailed PCE source components. The BEA [source-data explanation](https://www.bea.gov/help/faq/521) says detailed CPI/PPI inputs are combined at the PCE component level; a future model needs the historical crosswalk, weights and any BEA adjustments. The target is one-decimal first-release PCE, and the source pages' actual first web publication/receipt times remain unauthenticated. No timestamped consensus, XAU/USD quotes, trading cost or return is in this test.

**Decision:** Do not use this PPI aggregate to issue a trading signal. Continue with source-mapped PCE components and a prospective forecast ledger. Keep release-day gold trading as a separate cTrader **demo** execution study.
