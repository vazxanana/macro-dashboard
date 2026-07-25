# Close-to-Close vs. Range-Based (Parkinson / Garman-Klass) Volatility Estimators
- **URL:** https://ryanoconnellfinance.com/historical-volatility-estimators/ (related: https://flashalpha.com/articles/yang-zhang-vs-close-to-close-realized-volatility ; https://www.sciencedirect.com/science/article/pii/S1544612323003641)
- **Type:** industry (practitioner/educational summary of academic estimators — Parkinson 1980, Garman-Klass 1980)
- **Date:** unknown
- **Credibility:** 3
- **Recency:** 3
- **Bias:** Financial-education content site; summarizes established academic estimators faithfully but is not itself peer-reviewed.
- **Market:** general (applies to equities, futures, FX/gold alike)
- **Sourcing:** SEARCH-DERIVED — not verified against primary text

## Reported content
> "Close-to-close volatility only uses two data points (yesterday's close and today's close), missing all intraday price action." (paraphrased from search summary)
> "Parkinson is approximately five times more efficient than the close-to-close estimator under geometric Brownian motion, because the intraday range contains more information about the true diffusion coefficient than a single daily return." (paraphrased from search summary)
> "Garman-Klass (1980) extends Parkinson by incorporating all four OHLC prices, achieving approximately 7.4x efficiency versus close-to-close." (paraphrased from search summary)
> One drawback: Parkinson's estimator "doesn't take into account price movements after market close, hence it systematically undervalues volatility." (paraphrased from search summary)

## Relevance
This is important CONTRARY evidence for the broader thesis that closes are "special": from a pure statistical-estimation standpoint, close-to-close returns are markedly LESS information-efficient than range/intraday-based estimators (5-7x less efficient per the Parkinson/Garman-Klass literature). This suggests that whatever institutional/behavioral significance the close carries (benchmarking, NAV, settlement), it is not because two-point close-to-close data is a statistically superior summary of a day's price action — intraday range/extremes carry more statistical information about volatility.
