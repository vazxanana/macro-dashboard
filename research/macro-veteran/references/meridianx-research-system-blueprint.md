# MeridianX Research System Blueprint

**Status:** Design proposal for a source-auditable macro, gold, FX and fundamentals research workflow. The cTrader connection remains demo-only; this blueprint does not authorize or propose live order execution.

## Objective

Turn public, licensed and user-provided market information into research that is timely, point-in-time correct, reproducible and useful for decisions. The system should make it easy to answer:

1. What changed, and when could a market participant first know it?
2. What is observed, calculated, estimated or inferred?
3. Which competing explanations fit the evidence?
4. What observation would change or falsify the view?
5. How accurate and calibrated were prior forecasts?

The system should preserve source records and calculation lineage so a brief can be rebuilt later without relying on remembered context.

## Product boundaries

- **Research:** source retrieval, data checks, event analysis, issuer analysis, hypotheses, scenarios and forecast scoring.
- **Market observation:** cTrader demo XAUUSD quotes may be used to understand the intended broker feed, instrument conventions and demo execution assumptions. Label that feed and its market hours; do not call it a universal spot-gold tape. For spot events, request the optional source timestamp (`subscribeToSpotTimestamp=true`) and separately record local receipt time; bid and ask fields can each be absent. Do not calculate midpoint/returns from an incomplete quote. For historical ticks, obey the one-week request limit and continue whenever `hasMore` is true so dense event windows are not silently truncated. [cTrader live quote and historical tick documentation](https://help.ctrader.com/open-api/symbol-data/)
- **Execution:** no live trading, broker credential use for order placement, or autonomous order routing is part of this research system. Any later change would need a separate explicit product decision.
- **Data rights:** a source being viewable in a browser does not automatically permit automated collection, long-term storage, display or redistribution. Record the permitted-use status before ingestion.

## Architecture: immutable evidence, revisable interpretation

Keep raw inputs append-only. A corrected or revised value creates a new version with its own availability time; it does not overwrite the old record. Derived tables and briefs are rebuildable from raw inputs plus versioned transformation code/configuration.

| Layer | Store | Minimum fields | Why |
|---|---|---|---|
| Source registry | Publisher, dataset, access route, upstream lineage, cadence, terms, known lag and quality notes | `source_id`, `publisher`, `series_or_form`, `url`, `access_method`, `upstream_source_ids`, `independence_group_id`, `cadence`, `license_class`, `known_limitations`, `checked_at` | Exposes both access limits and dependent evidence chains. Multiple outlets repeating one vendor estimate or one regulatory database must not be counted as independent confirmations. |
| Raw evidence | Original file or response, metadata and checksum | `source_id`, `retrieved_at_utc`, `published_at_utc`, `http_or_file_metadata`, `content_hash`, `raw_location` | Allows audit and exact replay when definitions or downstream calculations change. |
| Observations | Normalized economic, market, issuer and flow facts | `series_id`, `instrument_id`, `observation_start`, `observation_end`, `available_at_utc`, `value`, `unit`, `currency`, `seasonal_adjustment`, `vintage_id`, `revision_of`, `quality_flag` | Separates the period a value describes from the time it became knowable. |
| Market data | Raw quote events, bars, settlements, spreads and versioned instrument metadata | `instrument_id`, `venue_or_broker`, `benchmark_or_product_id`, `symbol_or_contract_version`, `contract_month`, `settlement_type`, `continuous_series_method`, `roll_rule`, `price_adjustment_method`, `back_adjusted`, `bid`, `ask`, `mid`, `source_event_timestamp_utc`, `client_received_timestamp_utc`, `available_at_utc`, `timestamp_requested_or_source_clock_status`, `calculated_feed_latency_ms`, `quote_age_ms`, `bid_ask_completeness`, `session`, `quality_flag` | Separates when the venue says a quote applied from when the research system received it. Records product identity and continuous-futures construction so benchmark changes, distinct contracts, roll discontinuities and adjusted historical levels cannot be silently conflated. |
| Events | Scheduled releases, policy actions, auctions, filings and unscheduled catalysts | `event_id`, `event_type`, `scheduled_at_utc`, `actual_published_at_utc`, `source_id`, `related_series`, `overlap_group` | Supports release calendars and correctly timed event studies. |
| Expectations | Consensus or market-implied expectation snapshots | `event_id`, `provider`, `captured_at_utc`, `statistic` (median/range), `contributor_count`, `unit`, `source_hash` | Preserves what was expected before the event; current consensus cannot replace the historical snapshot. |
| Research claims | Claim-to-evidence graph | `claim_id`, `claim_text`, `claim_type`, `evidence_ids`, `counterevidence_ids`, `dependence_groups`, `method_version`, `confidence`, `as_of_utc` | Makes each material sentence traceable to observations, preserves counterevidence, and shows whether apparent corroboration comes from independent data or overlapping sources. |
| Forecast ledger | Probabilities, scenarios and resolved outcomes | `forecast_id`, `created_at_utc`, `target`, `threshold`, `horizon`, `probability_or_distribution`, `resolution_rule`, `baseline`, `outcome`, `score` | Prevents hindsight edits and enables calibration review. |

All timestamps should be stored in UTC and rendered with the source's local timezone where that helps the reader. Keep units and instrument identity explicit; never use a blank field to mean “same as another row.”

For a machine-readable example, use the [evidence-record schema](research-evidence-record.schema.json) and its [worked CFTC example](research-evidence-record-example.json). The schema stores records as an array and requires source lineage, independence group, reference period, publication/availability/retrieval time, vintage, units, quality flags and calculation inputs. A calculated record points to its input record IDs; a source timestamp that was not captured stays null rather than being guessed.

Keep forecast accountability as a separate append-only event stream, using the [forecast-ledger schema](forecast-ledger.schema.json). An issuance or update event contains the complete forecast snapshot, information cutoff, resolution rule, comparator, supporting and contrary evidence IDs, and distribution. A resolution is a separate event linked to the prior record, with the outcome snapshot and declared score. Never rewrite an issued probability or silently change its horizon, comparator, or resolution rule; issue a linked update instead. This separates what the analyst believed at the time from later scoring and prevents resolved values from being mistaken for the original forecast.

## First release: gold and US macro research

Build the smallest stack that can produce a fully auditable gold brief. Do not start by trying to ingest every source in the registry.

| Priority | Source family | Start with | Cadence | First useful output |
|---|---|---|---|---|
| P0 | Gold and USD price | Selected licensed/public benchmark where terms permit; cTrader demo XAUUSD feed clearly marked as broker-specific; named USD index series | Daily / intraday if licensed | Returns by matched timestamp, spread/session context and cross-currency gold returns. |
| P0 | US rates/inflation | Treasury nominal and real curves; BLS CPI and labor releases; BEA PCE; ALFRED vintages where available | Daily / release schedule | Yield and real-rate context; first-print vs revised macro event record. |
| P0 | Policy expectations | Timestamped futures/OIS snapshot with source and method; Fed statement/minutes/speeches | Event-driven / daily snapshot | Change in policy-path pricing, not a claim of objective probability. |
| P1 | Positioning and investment flows | CFTC COT; WGC ETF tonnage/flows with methodology and release date | Weekly / monthly | Crowding and listed-fund demand context, separated by publication lag. |
| P1 | Physical/official market | CME stocks/delivery notices, LBMA public data, WGC reserve and demand releases, SGE premium/turnover if reliable aligned data are available | Daily to quarterly | Triangulation with scope and lag stated; no claim of a complete physical flow tape. |
| P2 | Funding and cross-border liquidity | New York Fed repo/rates and facilities; OFR segment data; SEC Form N-MFP and daily money-fund website disclosures; Fed Enhanced Financial Accounts; FFIEC bank reports; BIS GLI/LBS; TIC/IMF PIP | Daily to quarterly, with different publication lags | Matched funding-stress panel that separates daily rates/flows from month-end holdings and quarterly cross-border stocks; do not present structural data as a daily gold-flow signal. |

For any item with a paywall, API key, commercial license or uncertain reuse right, first create a manual source record and a retrieval proof-of-concept. Do not silently substitute a proxy. For example, a broad Fed dollar index is a different measure from ICE DXY and must be tracked as a different series.

## Ingestion sequence and quality gates

1. **Register source and rights.** Record original publisher, dataset identifier, documentation, terms, cadence, expected lag, revision behavior, and whether automated storage/use is permitted.
2. **Capture the raw record.** Save the original response or file and retrieval time. If an official release page differs from an API/database value, retain both and link them.
3. **Normalize without erasing meaning.** Parse into explicit units, currencies, periods, instrument identifiers, adjustment status and timestamps. Keep original label and raw value alongside normalized value.
4. **Version revisions.** Detect changed observations and append a new vintage with `revision_of`. Never backfill revised values into an event study as if they were known earlier.
5. **Run data checks.** Validate schema, monotonic timestamps where appropriate, duplicate keys, unit changes, missing intervals, calendar gaps, impossible values, stale releases and unexpected method changes. Quarantine suspect data; do not auto-impute silently.
6. **Reconcile independent sources.** Compare price or release values only after matching instrument, benchmark, timezone, unit and close convention. Log unexplained differences.
7. **Publish freshness state.** Show last successful retrieval, last expected release, last available observation period, and any failure. “No new value because nothing was scheduled” differs from an ingestion failure.
8. **Build derived measures reproducibly.** Store transformation name/version, input record IDs, parameters, and output timestamp. A chart should be reproducible from those records.
9. **Treat calendars as live source data.** Load or review the publisher's current operational schedule, retain the checked date, and distinguish announced future changes from implemented releases. Do not hard-code weekly cadence assumptions for feeds such as CFTC COT.

## Daily analyst workflow

### Before a major event

- Capture the event calendar and source release time in local time and UTC.
- Record consensus provider, statistic, contributor count and capture time; if unavailable, mark it unavailable.
- Save prior value as then known and identify possible revision fields.
- Define instrument, venue, pre-event price, event window(s), and which market response would fit each mechanism.
- Record competing hypotheses before reading the headline.

### At release and after

- Capture the primary release and publication time; record first print, revision and components.
- Calculate raw surprise, and standardized surprise only if a past-only historical scaling sample is available.
- Observe the same predeclared windows across rates, FX, gold and relevant risk assets. Preserve quote quality and spread; if multiple announcements overlap, classify the reaction as joint news unless separation is defensible.
- Write the causal chain as a hypothesis: **news → expectation/constraint → transmission → price response**. Mark missing links.
- Update probabilities only by adding a timestamped forecast record. Never rewrite the prior view.

### End-of-day / weekly review

- Explain what changed versus what was already priced, show counterevidence and list unexplained residuals.
- Update source freshness/quality, COT and ETF values on their actual reference and publication dates.
- Resolve due forecasts using the predeclared source and rule; compute Brier/CRPS or interval coverage where appropriate.
- Review calibration against base rates and preserve misses in the research log. Separate analytical forecast quality from demo execution quality.

## Research outputs

Every brief should draw from a common evidence ledger and include:

1. **Decision question and as-of cutoff.**
2. **Plain-language conclusion** with confidence and horizon.
3. **Evidence ledger:** observation, calculation, estimate or interpretation; direct sources; observation and publication times; vintage; limitation.
4. **Mechanism:** explain the path from information to market price, including what was priced beforehand.
5. **Best counterargument:** strongest alternative explanation and what would distinguish it.
6. **Scenarios:** conditional observable triggers, no unsupported price targets.
7. **Data gaps:** identify private, licensed, lagged or missing evidence and proxy bias.
8. **Forecast IDs and next checkpoints:** preserve enough structure to resolve and score later.

## Failure handling and analyst guardrails

- A missing or stale source should reduce confidence and be visible to the reader; never substitute a related series without changing the label.
- A disagreement between sources should trigger an instrument/definition/timestamp reconciliation, not cherry-picking the preferred number.
- A market move after a release is a reaction. Calling it a causal effect requires a defensible identification design and tests for overlap, pre-trends, selection and confounding.
- A high hit rate from a small or selected sample is a lead, not a validated edge. Keep a frozen specification, untouched forward sample and realistic demo-feed cost model before describing a rule as tradable.
- Vendor “dealer positioning,” consensus, alternative data and sentiment are estimates or proprietary products unless methodology and raw inputs establish otherwise.
- If data are not observable (for example, complete OTC gold inventory), state the gap and triangulate public proxies. Never imply the proxy is a direct measurement.

## Build order

### Stage 1 — Evidence ledger

Create source registry, append-only raw records, normalized observation metadata, release/event calendar, revision tracking and freshness status. Populate a small gold/US macro sample manually first to prove definitions and provenance.

### Stage 2 — Research briefs

Use the existing [brief template](research-brief-template.md), [issuer fundamentals template](issuer-fundamental-analysis-template.md), [cross-asset regime framework](cross-asset-macro-regime-framework.md), [gold driver map](gold-driver-map.md), [source registry](macro-gold-source-registry.md) and [validation protocol](empirical-market-research-validation.md). Generate no automatic trade instruction. Analyst reviews every calculated surprise and source mismatch.

### Stage 3 — Forecast accountability

Use the [forecast ledger](forecast-ledger.schema.json) with predeclared resolution rules, baselines, proper scoring and sample-size caveats. Before issuing forecasts, register a [plan](forecast-evaluation-plan.schema.json) fixing the comparable cases, target units, method, resolution contract, selection cutoff, score and baseline policy. Follow the [offline evaluation guide](forecast-ledger-evaluation-guide.md): validate each record and the plan, then recompute scores into a separate report. Preserve unresolved and unissued cases and show paired baseline counts. Declare mean versus median for point forecasts; do not infer a full distribution from sparse quantiles. Review probability calibration only after a meaningful set of comparable forecasts has resolved, with dependence and selection accounted for. Synthetic demos and retrospective reconstructions remain labeled accordingly.

### Stage 4 — Demo-market observation

Connect the research view only to the MeridianX cTrader **demo** account for quote-quality, timestamp, spread and symbol-terms diagnostics. Keep credentials in Vercel environment variables; never write access/refresh tokens or client secrets into evidence records, logs or reports. Identify each data record with the broker/server environment, a pseudonymous account reference, the broker's `symbolId`, displayed symbol and a symbol-terms version. Store when the terms snapshot was received; broker symbol IDs and conditions are server-specific and can change. [cTrader symbol model and account fields](https://help.ctrader.com/open-api/model-messages/)

At connection and whenever symbol metadata changes, archive the raw symbol response and a normalized terms snapshot: swap long/short, swap calculation type and rollover schedule; commission type/rate/minimum and any P&L conversion fee; trading intervals, timezone and broker holidays; minimum/maximum/step volume, exposure cap, dynamic-leverage reference, stop-distance rules and guaranteed-stop charge. Retain source units and conversion formula beside any normalized values. Symbol intervals are seconds from Sunday 00:00 in the declared timezone; swap and commission fields have broker-defined calculation types/scales. This is necessary because quoted swap numbers do not share one universal unit and costs or trading hours may differ by symbol/account. [cTrader symbol model](https://help.ctrader.com/open-api/model-messages/)

For live demo quotes, request source timestamps where available, record local receipt time, bid/ask completeness, clock status and quote age; flag stale or incomplete records. For historical event windows, paginate tick requests until `hasMore=false`, splitting requests into periods no longer than one week. If the broker feed exposes Level II depth, subscribe to depth events and store the raw add/delete events as well as reconstructed snapshots. cTrader encodes depth price as a raw integer: divide by `100000` and round to the symbol's digits; divide depth size by `100` to obtain units. Preserve quote IDs, source timestamps if present, local receipt timestamps, subscription resets and any event gaps. Treat this as the MeridianX broker feed, not consolidated market-wide depth; absence of a depth feed is missing coverage, not zero depth. [cTrader live quotes and depth](https://help.ctrader.com/open-api/symbol-data/)

When translating commissions, swaps or dividends into the account's deposit asset, record the conversion-symbol chain and each leg's bid/ask plus source and receipt timestamps used in the calculation. Never apply a current conversion quote to a historical charge. [cTrader conversion-chain workflow](https://help.ctrader.com/open-api/symbol-rate-conversion/). Keep demo observations separate from benchmark-price research and simulated outcomes. This stage does not route orders or enable live trading; any later demo-order experiment would require a separately defined and approved design.

### Stage 5 — Expand by research value

Add issuer fundamentals, other currencies, rates/credit, energy/agriculture or alternative data only when a named question needs them and coverage, cost, rights, history, timestamp quality and validation plan are known.

## Acceptance criteria for the first research release

- Every displayed observation has a source, unit, reference period and availability/retrieval time.
- A revision creates a new vintage; an as-of query can reproduce the earlier value when the source supports vintages.
- Every market quote identifies instrument and venue/broker; benchmark, futures and CFD observations are not silently joined.
- Scheduled macro events store actual, contemporaneous consensus if available, prior value, revision, component fields and selected reaction windows.
- Source release schedules show the operational calendar checked date; announced but not yet implemented schedule changes are marked separately.
- Claims and derived values can be traced to raw evidence and calculation versions.
- Missing, stale, revised, estimated and licensed data are visibly distinguished.
- Forecast records are immutable after issuance and can be resolved and scored against a predeclared baseline.
- Any cTrader data used in research is labeled demo/broker-specific; no live order path is enabled.

## Related research materials

- [Research Analyst Operating Standard](research-analyst-operating-standard.md)
- [Research Brief Template](research-brief-template.md)
- [Issuer Fundamental Analysis Template](issuer-fundamental-analysis-template.md)
- [Cross-Asset Macro Regime Framework](cross-asset-macro-regime-framework.md)
- [Empirical Market Research Validation Protocol](empirical-market-research-validation.md)
- [Probability Forecast Calibration Playbook](probability-forecast-calibration-playbook.md)
- [Macro and Gold Source Registry](macro-gold-source-registry.md)
- [Hard-to-Get Market Data Playbook](hard-to-get-market-data-playbook.md)
- [Advanced Market Intelligence Source Map](advanced-market-intelligence-source-map.md)
- [Funding, Collateral and Sovereign Supply Research Map](funding-collateral-and-sovereign-supply-research-map.md)
- [Derivatives, Positioning and Flow Research](derivatives-positioning-and-flow-research.md)
- [Issuer and Physical-Flow Data Map](issuer-and-physical-flow-data-map.md)
- [Gold Driver Map](gold-driver-map.md)
- [Gold Market Brief — 7 November 2026](gold-market-brief-2026-11-07.md)
- [US October 2026 CPI Pre-Release Plan](us-october-2026-cpi-pre-release-plan.md)
