# CME QuikStrike — Practical Obtainability Assessment for a Keyless Browser Dashboard
- **URL:** https://www.cmegroup.com/tools-information/quikstrike.html ; https://www.cmegroup.com/tools-information/quikstrike/open-interest-heatmap.html ; https://www.cmegroup.com/tools-information/quikstrike/options-open-interest-profile.html
- **Type:** primary (CME Group product pages)
- **Date:** current (live pages)
- **Credibility:** 4
- **Recency:** 5
- **Bias:** 1
- **Obtainable free?:** unclear — CME states QuikStrike provides "free pricing and analytics tools" with "no downloads, special installs or licensing required," but simultaneously invites registration for "QuikStrike Essentials" to unlock the full tool suite; unclear whether the specific Open Interest Heatmap / strike-level OI view is accessible without an account, and even if viewable, it is an interactive web app (not a JSON/CSV endpoint), meaning it is not straightforwardly scrapable by a static/keyless client-side fetch the way this dashboard's other feeds are
- **Sourcing:** SEARCH-DERIVED — not verified against primary text

## Reported content
> "QuikStrike provides free pricing and analytics tools for CME Group markets... No downloads, special installs or licensing required... You can register for QuikStrike Essentials, their flagship offering, to get access to all QuikStrike tools at once... The Open Interest Heatmap allows you to track positions by expiry and strike... available for benchmark products across all CME Group asset classes." (paraphrased from search snippets)

## Relevance
This is the load-bearing finding for question 3. Even in the best case (QuikStrike's OI Heatmap is viewable without login), it is a CME-hosted interactive JavaScript application, not a public REST/CSV API — there is no indication in any search result of a documented, keyless, CORS-enabled JSON endpoint suitable for a static HTML/JS dashboard to fetch cross-origin from a browser. Combined with sources 44 and 46 (Barchart/vendor pages are also human-facing web pages, not APIs; equity-focused GEX vendors don't cover gold at all), the honest conclusion is: **gold options strike-level OI / GEX / zero-gamma data is not practically obtainable for a free, keyless, in-browser fetch** — confirming the practical blocker the task flagged. Aggregate gold **futures** OI (not options-strike-level) is the one piece that is genuinely free and simple (CME's own volume/OI page, Goldhub, YCharts/CFTC), but that alone cannot support GEX, max-pain, or zero-gamma style level calculations, which require the options strike/OI matrix.
