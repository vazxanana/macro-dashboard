# MeridianX red-folder news: data and testable strategy, V1

**Research scope:** U.S. high-impact scheduled macro releases, with XAU/USD on the MeridianX cTrader **demo** feed as the first execution instrument. A red-folder label is a calendar priority flag, not evidence of a predictable surprise or a trade. Each release has three clocks: reference period, actual public release, and first quote that our demo feed could have traded. Capture all three.

## First finding: PPI usually cannot predict that month's CPI in time

The [release-order audit](ppi-cpi-release-order-2022-2024.json) pairs 36 matching reference months in the saved BLS release records. **PPI was scheduled before CPI in only 5 of 36 pairs; CPI came first in 31.** The five earlier-PPI reference months were September and November 2022, September 2023, and April and July 2024. The [36-row CSV](ppi-cpi-availability-and-cpi-first-print-2022-2024.csv) gives each date, scheduled UTC clock, printed CPI core monthly outcome and blank fields for PPI values and actual-publication timestamps. Empty fields are deliberate; no historical PPI feature or edge has been estimated yet.

The [five archived PPI observations](ppi-before-cpi-five-release-observations-2022-2024.md) now add the printed final-demand, less-food/energy/trade, goods and services changes for the earlier-PPI cases, with each original dated BLS release linked. These are **archived release figures**, not authenticated first-web-publication snapshots; they are kept in a separate file so the 36-row availability matrix does not imply that all PPI values or clocks have been verified.

The [five-row PPI/CPI→PCE seed panel](ppi-cpi-to-pce-five-release-panel-2022-2024.md) adds each matched BEA original-release headline and core PCE print. The sequence checks pass for these five rows, but this selected subset is not a model sample or evidence of incremental PPI value. The full PCE study must include months regardless of whether PPI happened to precede CPI.

**19 November continuation:** The [full 36-month CPI/PPI→PCE source panel](cpi-ppi-to-pce-36-month-source-and-baseline-2022-2024.md) now supplies dated original-release BEA targets and four aggregate PPI fields for every month. The [expanding-window broad-PPI check](cpi-ppi-to-pce-expanding-model-check-2022-2024.md) shows only a tiny, unstable improvement over a CPI-only fit; it does not establish PPI forecast skill or a trading edge. It is a screening result, not a historical component-mapped nowcast.

This timing finding changes the research design. Same-reference-month PPI may enter a CPI forecast only in the five earlier-release cases, after actual availability is checked. In the other 31, PPI can inform later outcomes, such as PCE or the next reference month's CPI, but cannot be inserted into the already-published CPI forecast. BLS describes PPI and CPI as different populations and price concepts: PPI excludes imports and owners' equivalent rent, while CPI includes both; aggregate PPI also includes exports, government and business purchases. Their headline changes should not be treated as interchangeable. [BLS PPI/CPI comparison](https://www.bls.gov/ppi/faqs/questions-and-answers.htm); [BLS PPI archive](https://www.bls.gov/bls/news-release/ppi.htm).

## Connected release paths to test

| Earlier observation | Later target | Mechanism and necessary check | Priority |
|---|---|---|---|
| CPI detail + PPI detail | Monthly PCE/core PCE | BEA derives most detailed PCE prices from BLS CPI and PPI, then aggregates with a Fisher chain formula. Map **specific source series** using BEA Table 2.4.4 U-D; account for BEA adjustments and different weights. | First model candidate |
| PPI in the rare earlier-release months | Same-reference-month CPI | Component-level prices may add information beyond the pre-PPI CPI baseline. CPI housing, imports and consumer tax/retail margins create large gaps. Only five historical schedule cases in this cohort. | Sparse sensitivity only |
| Prior-month PPI + gasoline + rent/used-car indicators | Next CPI | Lagged producer costs and energy may change consumer prices with variable pass-through. Require actual incremental forecast improvement versus CPI persistence and Cleveland, not a story about direction. | Exploratory after PCE |
| CPI + PPI + earnings/claims | FOMC expectations | These releases can change rate expectations; the sign and size depend on the full information set and what the market already expected. Measure the intermediate 2-year yield / policy-rate futures response before interpreting gold. | Market-response test |
| Employment Situation + weekly claims + wage/ECI data | Next labor/FOMC release | Claims are timely but cover a different population and concept from payrolls; measure incremental information, revisions and surprise against expectations. | Later module |
| Retail sales + CPI goods prices | Real consumption/PCE quantities | Nominal retail sales and price changes jointly inform real spending; retail excludes much services consumption. | Later module |

[BEA's PCE source-data explanation](https://www.bea.gov/help/faq/521) identifies Table 2.4.4 U-D and the CPI/PPI source mapping. [BEA's CPI/PCE reconciliation](https://www.bea.gov/help/faq/555) documents index and weight differences. The [Cleveland Fed nowcast method](https://www.clevelandfed.org/indicators-and-data/inflation-nowcasting) says its core CPI nowcast is based on past core CPI, so a PPI-augmented candidate tests genuinely new information relative to that published model; historical model snapshots still need point-in-time verification.

**PCE mapping retrieval gate:** BEA currently links [Table 2.4.4 U-D as an XLSX](https://www.bea.gov/sites/default/files/2026-10/FAQ521-Sep26-update.xlsx). Its file contents have not yet been ingested here, and this October 2026 edition cannot be assumed to describe the mapping that was in force during 2022–2024. The [September 2026 methodology update](https://apps.bea.gov/scb/issues/2026/09-september/0926-nipa-methodologies.htm) and [BEA's documented source-data adjustments](https://www.bea.gov/help/faq/1486) make versioned mappings and first-release targets necessary. The sandbox could resolve neither a direct download of the XLSX nor an equivalent machine-readable copy in this pass; do not silently substitute an unversioned present-day crosswalk.

## Data contract for each release

Store one append-only row per **first publication**, with: event/family, reference period, scheduled and actual publication UTC, receipt UTC, original URL and content hash, exact field/series code, unit, SA/NSA, first print, later correction/revision linked separately, current-vintage value, consensus source and timestamp, forecast cutoff, and any simultaneous releases. Do not backfill a current API value into an earlier forecast. BLS archived PPI reports warn that monthly indexes can be revised for four months and seasonal factors for years; a current time series is therefore a poor substitute for release-day data. [BLS detailed PPI archive](https://www.bls.gov/ppi/detailed-report/).

For every XAU/USD demo event window, record broker symbol, bid/ask ticks or the highest available quote frequency, server/UTC clock mapping, spread, executable entry/exit quotes, latency, financing and rejected/missed orders. Record 2-year nominal Treasury yield and USD index or a liquid USD proxy as **explanatory market response**, with their own source/clock. Do not label a gold move a CPI reaction when the fixed window includes another scheduled release; the [overlap audit](core-macro-overlap-source-audit-2026-11-17.md) already found multi-release dates and additional corrections.

## Two separate tests

**A. Pre-release forecast:** predict one printed target, starting with core PCE monthly change, at a fixed cutoff after CPI and PPI but before BEA publication. Freeze a persistence baseline, a simple CPI-to-PCE mapping, and one predeclared CPI+PPI component model. Use expanding-window training only on information available by each historical cutoff. Score every eligible month including misses. Primary loss: squared error for the point mean; report MAE, bias, calibration and leave-one-year influence. Hold out the most recent contiguous period and run a prospective ledger before claiming skill. If a source's first-publication time is unknown, mark that case unverified rather than silently assuming the schedule.

**B. Release-day execution:** the target is an executable demo return after the release, not forecast error. Before testing, fix release family, instrument, entry lag, exit horizon, maximum spread, stop/risk rule and event-conflict exclusions. The signal uses the **surprise versus a timestamped consensus**, not the raw level; missing consensus means no surprise-based trade. Test whether the first post-release movement in rates and USD confirms the expected gold direction, then measure gold entry at the *next executable bid/ask*, with latency and slippage. Compare to a no-trade baseline and to a simple post-release momentum rule. Include all eligible releases, rejected trades and no-signal events. Use an untouched forward demo period before considering any change of trading mode.

**No fixed gold direction is asserted.** Hot inflation can lift yields and USD, pressuring gold, but real-yield, risk and positioning responses can offset or reverse that path. The already completed [Treasury CPI daily-window study](treasury-cpi-calendar-study-2022-2024.md) measures an association in absolute real-yield movement, not a signed intraday gold edge or tradable P&L.

## Next data build, in order

1. Extend the now-complete 36-month **aggregate** PPI release ledger to PCE-relevant PPI components, preserving exact codes, publication/vintage timestamps and corrections. Keep aggregate final-demand PPI as a comparator, not a CPI substitute.
2. Obtain BEA Table 2.4.4 U-D source mappings and archived monthly PCE first prints. Build a versioned component crosswalk; distinguish CPI-based, PPI-based and BEA-adjusted items.
3. Acquire timestamped pre-release consensus with terms allowing private research. If unavailable, do forecast-model evaluation without surprise-based trading claims.
4. Capture synchronized cTrader demo bid/ask and rate/USD proxy quotes prospectively around releases. Freeze trading rules before examining their returns.

No live trading is enabled. The continuation reports a small **retrospective PCE model score**, with no robust PPI increment. It reports **no PPI→CPI accuracy gain or red-folder trading edge**.
