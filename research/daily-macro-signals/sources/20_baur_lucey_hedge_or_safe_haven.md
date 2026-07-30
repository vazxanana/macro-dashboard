# Is Gold a Hedge or a Safe Haven? An Analysis of Stocks, Bonds and Gold (Baur & Lucey, 2010)
- **URL:** https://onlinelibrary.wiley.com/doi/10.1111/j.1540-6288.2010.00244.x (also SSRN: https://papers.ssrn.com/sol3/papers.cfm?abstract_id=952289)
- **Type:** academic (peer-reviewed, *Financial Review*, 2010; the foundational paper that introduced the hedge/safe-haven distinction for gold)
- **Date:** 2010 (Financial Review, Vol. 45)
- **Credibility:** 5 (the seminal, most-cited paper in this literature; methodology — quantile regression on daily US/UK/German stock and bond returns — is well documented across many secondary sources)
- **Recency:** 2 (2010 publication; findings are foundational but dated — later papers, including this session's other sources, revisit/qualify them)
- **Bias:** None apparent — independent academic authors (Dirk Baur, Brian Lucey), no commercial gold-industry affiliation.
- **Horizon of claims:** daily (quantile regressions run on daily stock/bond/gold return series; the "short-lived" finding is specifically about day-after timing)

## Note on sourcing method
WebFetch to onlinelibrary.wiley.com, papers.ssrn.com, brianmlucey.com, and ijbs.unimas.my all returned HTTP 403 in this session — consistent with a systemic organization egress-policy block confirmed against control domains (google.com, en.wikipedia.org, federalreserve.gov, fred.stlouisfed.org all also 403'd; only raw.githubusercontent.com succeeded). Content below is reconstructed from WebSearch synthesis, restricted where possible to single-domain queries (onlinelibrary.wiley.com) to reduce cross-source contamination. Not independently verified against the primary-source PDF text.

## Reported quotes/paraphrases (not independently verified against primary-source text)
> A hedge is defined as "an asset that is uncorrelated or negatively correlated with another asset or portfolio 'on average'" and a safe haven "performs the same function 'in times of market stress or turmoil.'"

> "Gold is a hedge against stocks on average and a safe haven in extreme stock market conditions." Gold is a hedge for stocks in the US and UK but not in Germany.

> "Gold only serves as a safe haven against stocks in extreme negative stock market conditions (2.5% and 1% quantiles)."

> Methodology: quantile regression is used "to examine correlations in the case of large and unlikely events" — the 5%, 2.5%, and 1% lower quantiles of stock/bond returns are used as regressors that take a value of zero unless the return falls below that quantile in a given period (i.e., an indicator for extreme-tail days only).

> Critical timing finding, reported consistently across secondary summaries: **"The safe haven property is extremely short-lived so that an investor buying gold one day after a shock loses money."**

## Relevance
This is the direct answer to the central predictive-vs-reactive question: Baur & Lucey's own finding is that gold's safe-haven property shows up as a *same-day, extreme-tail-conditional* co-movement, and it does **not persist into the next trading day** — buying gold *after* observing the shock (i.e., trying to trade on it with a one-day lag, which is exactly the shape of a next-day bias engine) is reported to lose money. This is about as explicit an academic statement as exists that the gold safe-haven effect is contemporaneous/reactive, not predictive at daily-plus-one horizon. It also anchors the hedge/safe-haven definitional split that is central to why "gold negatively correlated with stocks on average" (hedge, unconditional) is a completely different claim from "gold rises when stocks crash" (safe haven, conditional on extreme stress) — a scoring model should not treat these as interchangeable or assume the safe-haven case generalizes outside tail-quantile stock/bond crashes.
