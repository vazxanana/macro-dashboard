# COMEX Gold Warehouse Registered/Eligible Stocks — Daily Reporting

- **URL:** https://www.cmegroup.com/clearing/operations-and-deliveries/registrar-reports.html ; https://www.cmegroup.com/solutions/clearing/operations-and-deliveries/nymex-delivery-notices.html ; https://www.cmegroup.com/delivery_reports/Gold_Stocks.xls
- **Type:** primary (CME Group exchange operator — the vault stock data is an exchange-operational disclosure, not a research/opinion product)
- **Date:** Live/ongoing daily series; example snapshot cited "as of July 24, 2026: COMEX vaults hold ~22.96M oz of gold" combined registered+eligible.
- **Credibility:** 5
- **Recency:** 5
- **Bias:** None expected — operational exchange data, not promotional.
- **Cadence/lag:** **Daily.** Depositories report holdings to CME Group each business day; the report reflects end-of-prior-business-day inventory, so effectively 1-business-day lag (T+1 morning publication for T-day close). This is by far the freshest/lowest-lag fundamental-flow-adjacent data source in this survey.
- **Sourcing:** SEARCH-DERIVED — not verified by directly downloading the CME .xls report.

## Reported content
> "The exchange publishes daily warehouse stock reports showing how much metal is held inside the COMEX storage system at the end of each trading day... split into registered and eligible categories." (paraphrased.)
> "Registered metal is backed by a warehouse receipt (warrant) and can be delivered against a futures contract right now. Eligible metal meets exchange specs and sits in the same vaults but has no active warrant, so it is not immediately deliverable." (paraphrased.)
> "As of July 24, 2026, COMEX vaults hold... 22.96M oz of gold" combining registered and eligible stocks (paraphrased single-snapshot figure from a third-party aggregator site, not the CME file itself).

## Relevance
This is the **only genuinely daily-cadence, low-lag fundamental/flow data source** identified in this whole research pass (1-day lag vs. weekly ETF flows, 3-day-lag weekly COT, ~1-month-lag quarterly WGC, ~2-month-lag monthly IMF central-bank data). Registered-stock depletion/build is a legitimate delivery-squeeze/physical-tightness signal that a daily engine could plausibly ingest directly from CME's own published files, rather than relying on lagged secondary aggregates. Recommend treating this as the highest-priority "real daily fundamental input" candidate if the dashboard wants a genuinely fresh flow signal.
