# Five PPI-before-CPI release observations, 2022–2024

This [CSV](ppi-before-cpi-five-release-observations-2022-2024.csv) records the five matching reference months for which the scheduled PPI release preceded CPI in the 36-month release cohort. PPI values are the one-decimal, seasonally adjusted monthly figures printed in each **dated archived BLS PPI release**. The core CPI outcome comes from the separately audited [CPI first-print ledger](cpi-first-print-release-ledger-2022-2024.json). Values are percentages, not percentage-point contributions. No prediction or trading signal is derived from five observations.

| Reference month | PPI final demand | PPI less food, energy and trade | PPI goods | PPI services | Later core CPI | BLS source |
|---|---:|---:|---:|---:|---:|---|
| 2022-09 | 0.4 | 0.4 | 0.4 | 0.4 | 0.6 | [12 Oct 2022, USDL 22-1989](https://www.bls.gov/news.release/archives/ppi_10122022.htm) |
| 2022-11 | 0.3 | 0.3 | 0.1 | 0.4 | 0.2 | [9 Dec 2022, USDL 22-2267](https://www.bls.gov/news.release/archives/ppi_12092022.htm) |
| 2023-09 | 0.5 | 0.2 | 0.9 | 0.3 | 0.3 | [11 Oct 2023, USDL 23-2184](https://www.bls.gov/news.release/archives/ppi_10112023.htm) |
| 2024-04 | 0.5 | 0.4 | 0.4 | 0.6 | 0.3 | [14 May 2024, USDL 24-0943](https://www.bls.gov/news.release/archives/ppi_05142024.htm) |
| 2024-07 | 0.1 | 0.3 | 0.6 | -0.2 | 0.2 | [13 Aug 2024, USDL 24-1661](https://www.bls.gov/news.release/archives/ppi_08132024.htm) |

**Availability limit:** The releases print an embargo-until clock and each is scheduled before its matched CPI. The original web publication and receipt timestamps have not been authenticated; an archived page fetched later cannot prove the exact instant or that its content was never corrected. Do not use the five rows as a verified historical feature set until that gate is closed. PPI final demand, PPI less food/energy/trade, and CPI core are different baskets, so differences between columns are not forecast errors.

**Next model implication:** This sparse same-month route cannot support a credible fitted PPI→CPI strategy on its own. Use it as a timing and feature-availability case. Build the larger CPI+PPI→PCE panel with component-to-PCE mappings and first prints, then compare it with predeclared baselines out of sample. Keep release-day XAU/USD demo execution as a separate study requiring timestamped consensus and bid/ask quotes.

**Continuation:** The [36-month aggregate PPI/PCE panel](cpi-ppi-to-pce-36-month-source-and-baseline-2022-2024.md) and [retrospective model check](cpi-ppi-to-pce-expanding-model-check-2022-2024.md) now cover the broader release cohort. Component-level PCE source mapping and prospective validation remain open.
