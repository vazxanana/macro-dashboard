# Gold Futures/Options Open Interest — Available Data Sources Survey
- **URL:** https://www.cmegroup.com/markets/metals/precious/gold.volume.html ; https://www.cmegroup.com/tools-information/quikstrike/volume-open-interest-tools.html ; https://www.barchart.com/futures/quotes/GC*0/options ; https://www.gold.org/goldhub/data/gold-open-interest ; https://ycharts.com/indicators/comex_gold_futures_open_interest
- **Type:** primary (CME, Goldhub/World Gold Council) / industry (Barchart, YCharts)
- **Date:** current (live pages, checked 2026)
- **Credibility:** 4 (CME/Goldhub primary), 3 (Barchart/YCharts)
- **Recency:** 5
- **Bias:** 1 (CME, exchange/industry body primary source) / 2 (Barchart — commercial data vendor)
- **Obtainable free?:** unclear — futures open interest (aggregate) is free and easy (CME, Goldhub, YCharts all publish daily/weekly aggregate OI); **options open interest by strike** requires either CME QuikStrike (registration-gated, see source 49) or Barchart (page loads options chains with OI column but likely rate-limited/paywalled for full historical or programmatic access)
- **Sourcing:** SEARCH-DERIVED — not verified against primary text (pages not fetched, only search snippets)

## Reported content
> "CME Group Official Tools — You can view volume, open interest, and open interest change activity on the most active strikes, by calls, puts, and combined calls and puts... Barchart.com — Offers futures option prices for gold with option quotes and option chains, including information on open interest by strike price... YCharts — Provides weekly updates and historical trends for COMEX Gold Futures Open Interest, with data sourced from the US CFTC... Gold.org (World Gold Council) — Provides data on current gold open interest from nine major gold futures exchanges." (aggregated from search results)

## Relevance
Directly addresses the practical crux: **aggregate futures open interest** for gold is genuinely free, easy, and available from multiple redundant sources (CME's own volume page, Goldhub, YCharts via CFTC data) — this could support a simple "OI rising/falling" macro data point. But **strike-level options OI** (needed for GEX/max-pain calculations) sits behind either CME QuikStrike's registration wall or commercial vendors (Barchart) whose free tier for a scriptable/keyless in-browser fetch is doubtful — these are consumer web pages designed for human viewing, not public JSON/CSV APIs, and likely have anti-scraping measures. This strongly suggests strike-level gold options OI is NOT reliably obtainable free & keyless for an automated browser-side dashboard.
