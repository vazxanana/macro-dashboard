# Dealer Gamma Hedging: Volatility Suppression / Amplification Mechanism
- **URL:** https://menthorq.com/guide/gamma-and-dealer-hedging/ ; https://bsic.it/how-dealers-gamma-impacts-underlying-stocks/ ; https://www.mql5.com/en/articles/23410
- **Type:** industry
- **Date:** unknown (recent vendor/education content, 2024-2026)
- **Credibility:** 2
- **Recency:** 4
- **Bias:** 2 (vendor educational content, one university investment-club writeup — bsic.it/Bocconi Students Investment Club is closer to student-research quality than pure vendor marketing)
- **Obtainable free?:** yes (the explanatory content is free; the live GEX computation itself is not — see source 49)
- **Sourcing:** SEARCH-DERIVED — not verified against primary text

## Reported content
> "Long-gamma hedging suppresses volatility and manufactures the mean reversion you see when a market pins to a level... When the market is net long gamma, dealers hedge in a stabilizing way—if price rises above the pinned strike, dealers sell the underlying, and if the price falls below it, they buy... In contrast, if the dealer is short gamma, they must buy as price rises and sell as it falls, chasing the move... short-gamma hedging amplifies volatility and turns ordinary moves into trends and squeezes." (paraphrased/aggregated from vendor sources)

## Relevance
Reinforces that the vol-suppression/amplification mechanism is a mechanically coherent story consistently repeated across independent vendor sources (convergent industry consensus, though not independently peer-reviewed). Useful for characterizing the mechanism honestly in the platform's documentation even if it can't be operationalized as a live gold feature.
