# GEX Retail Misunderstandings and Model Limitations (SpotGamma / OptionScout)
- **URL:** https://spotgamma.com/gamma-exposure-explained/ ; https://spotgamma.com/gamma-exposure-gex/ ; https://optionscout.ai/blog/gamma-exposure-gex-explained
- **Type:** industry
- **Date:** unknown (recent vendor content)
- **Credibility:** 2
- **Recency:** 4
- **Bias:** 2 (SpotGamma is the vendor that coined/popularized "GEX" as a commercial product — capped per instructions)
- **Obtainable free?:** n/a (discussion source; SpotGamma's own actual GEX numbers are subscription-gated beyond a limited free SPX chart)
- **Sourcing:** SEARCH-DERIVED — not verified against primary text

## Reported content
> "Gamma exposure has become a popular topic, and with popularity comes misunderstanding... GEX does not tell you whether the market will go up or down; it tells you the volatility regime, whether moves will be small and mean-reverting or large and trending... Call walls and put walls are zones, not exact numbers... GEX assumes the dealer side is short customer flow, but when a large customer-vs-customer print clears the tape, dealers don't carry the residual exposure and the GEX read goes stale... a sudden IV expansion can reposition every dealer hedge instantly... not all large gamma concentrations are hedged, as customer-held long calls that won't be hedged at expiration don't create dealer pressure." (paraphrased/aggregated, notably from the vendor that invented the term — self-critical admissions are worth more credibility than a marketing claim, but still capped as vendor bias)

## Relevance
Even the vendor that coined "GEX" concedes structural assumption failures (dealer-short-flow assumption breaks with customer-vs-customer trades; IV shocks invalidate hedges instantly; not all OI is actually hedged). This is useful as an internal-source admission that GEX is a modeled estimate with real, acknowledged blind spots — not a hard measurement — reinforcing that even where data is obtainable (equities), the output is approximate, and for gold where the underlying dealer positioning data isn't public at all, any GEX-style feature would be doubly speculative.
