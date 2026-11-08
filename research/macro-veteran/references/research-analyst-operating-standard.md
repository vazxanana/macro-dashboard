# Research Analyst Operating Standard

## Purpose

Use this standard for research supporting MeridianX and related macro, company, commodity, FX, and financial-market questions. The goal is not to sound certain; it is to produce conclusions that are traceable, timely, decision-relevant, and honest about what the evidence cannot establish.

## 1. Start with the decision and scope

Before gathering information, state:

- The question being answered and the decision it supports.
- The instrument, geography, time horizon, and relevant event window.
- What would count as evidence for or against the main thesis.
- Whether the user wants a source map, current-state analysis, historical study, or recommendation.

If a missing detail does not prevent useful work, state a reasonable assumption and continue. If it materially changes the answer, ask one concise question while continuing independent research.

## 2. Build an evidence base in source order

Prefer the source closest to the underlying fact:

1. **Primary record:** statistical agency release, central-bank publication, regulator filing, exchange notice, court or government record, or company filing.
2. **Primary dataset/API:** official observations, metadata, release calendars, and downloadable tables.
3. **Credible secondary analysis:** research that adds interpretation or triangulation and identifies its methods and inputs.
4. **Commercial data provider:** use when the data are proprietary, when it adds material coverage, or when it supplies timestamped history unavailable in public sources.
5. **News and commentary:** useful for discovering events and competing interpretations; verify factual claims against primary records where possible.

Search broadly to discover leads, then open the underlying source. A search snippet is a lead, not proof. For consequential claims, seek corroboration from an independent source or the original document. Record source, publication date, observation period, access date, and whether the figure is reported, estimated, or modeled.

## 3. Preserve time and revision integrity

For each time-series observation, retain:

- Reference period and release timestamp, including timezone.
- Initial value and later revisions, if available.
- Source vintage or retrieval timestamp.
- Units, seasonal adjustment, methodology, and coverage.
- Whether the data were available to a market participant at the time being studied.

For US macro history, retrieve ALFRED snapshots using equal realtime_start and realtime_end dates or vintage_dates; its vintage-date endpoint lists dates when a series changed, not every source release. ALFRED timestamps are daily and data are typically added within one business day, so they cannot establish intraday availability. Verify the original provider release time and timezone, record the FRED series ID/definition and retrieval timestamp, and compare with primary-source release archives. Release calendars are schedules, not proof of availability. For other providers, check whether historical snapshots are available; never assume a current download reconstructs historical knowledge.

For European headline-cycle research, use the Eurostat [PEEI vintage archive](https://ec.europa.eu/eurostat/web/euro-indicators/information-data) for quarterly GDP, monthly ILO unemployment, and monthly industrial production. Its GDP vintage dataset is [`ei_na_q_vtg`](https://ec.europa.eu/eurostat/databrowser/view/ei_na_q_vtg__custom_21900536/default/table); unemployment vintages from 2021 onward are in [`ei_lm_m_vtg`](https://ec.europa.eu/eurostat/databrowser/view/ei_lm_m_vtg/default/table?lang=en). The archive updates monthly about two months after the source release; GDP vintages represent roughly 20-, 45-, 65-, and 110-day estimates after quarter-end. Some unemployment and industrial-production vintages are missing, and classifications/dimensions can evolve. The regular Eurostat API serves latest values without full historical database versioning, so keep direct releases for immediate event studies.

For broader cross-country backtests, the OECD [Short-term Economic Statistics Revisions Database](https://data-explorer.oecd.org/vis?df%5Bag%5D=OECD.SDD.STES&df%5Bds%5D=dsDisseminateFinalDMZ&df%5Bid%5D=DSD_STES_REVISIONS%40DF_STES_REVISIONS&df%5Bvs%5D=4.0&snb=30&tm=key+short-term+economic) provides monthly snapshots of selected short-term indicators as published in OECD editions and supports programmatic retrieval through [OECD's SDMX API](https://www.oecd.org/en/data/insights/data-explainers/2024/09/api.html). The archive is useful for revision analysis and simulated real time, but monthly edition snapshots are not exact intraday release records; changes can reflect both national agencies and OECD processing. Preserve the source agency's original release and timestamp when studying a market reaction.

## 4. Separate facts, interpretations, and forecasts

Apply the time and vintage rules to the [2023 Q3 GDP worked case](gdp-revision-and-composition-case-2023-q3.md). Its unchanged first/third headline coexists with different spending and inflation estimates, while GDI is explicitly missing at the initial release. A reconstructed calculation retains input publication dates in linked records and does not claim the same historical publication or receipt time for itself.

Label statements as one of:

- **Observed:** directly reported by a source.
- **Calculated:** arithmetic from stated inputs; show the method when non-obvious.
- **Estimated:** inferred from incomplete data or a model.
- **Interpretation:** an explanation consistent with the evidence, not uniquely proven by it.
- **Forecast/scenario:** a conditional view of what may happen.

Never present market-implied probabilities as objective probabilities. Explain what the instrument prices imply and which assumptions are needed to translate prices into probabilities. Keep broker, survey, and vendor-specific positioning separate from market-wide positioning.

## 5. Analyze market events against expectations

For a scheduled release or earnings event, gather four timestamps where possible:

1. The pre-event consensus and its source/time stamp.
2. The official actual and release time.
3. The prior value and any revision.
4. The market response over a defined window, with the data venue and timezone stated.

Assess both the headline and meaningful components. A strong number can still be a negative surprise; a weak headline may be offset by revisions or composition. Distinguish the immediate price move from the later interpretation. If historical consensus is unavailable, say so and do not fabricate a surprise series.

For cross-release comparison, retain the raw surprise in the release's units and, when the sample supports it, a standardized surprise: `(first release − timestamped consensus) / historical standard deviation of that release's surprises`. Estimate the scaling factor from information available before the event, using a fixed trailing window or expanding history; do not normalize using future outcomes. Keep the same consensus source/definition where possible, and record the number of contributors and timestamp. A positive surprise is not automatically bullish or bearish for every asset: map it through the policy, growth, inflation, currency and cash-flow channels.

For a practical point-in-time market-pricing capture, use the [Market Expectations Capture Playbook](market-expectations-capture-playbook.md). It shows how to preserve raw futures prices, meeting-outcome distributions and timestamps, and how to keep market-implied pricing distinct from survey consensus and pure expected inflation.

For event studies, predeclare the event timestamp, instrument/feed, return construction and windows. Use the event source's observed publication timestamp and record both source-event time and local quote-receipt time where available; do not rely on a scheduled release time as proof of the actual timestamp. A useful diagnostic set is a very narrow immediate window plus a later window and session close, with exact timestamps and timezones. Check for simultaneous releases, revisions, unscheduled headlines, market closures, clock/feed latency, stale or incomplete quotes and spread widening. If the window contains multiple material announcements, call it a joint-news reaction unless the design can separate them. Cross-asset sequence helps diagnose a mechanism but does not by itself establish causality.

Central-bank announcements require a special caution: a rate surprise can reflect both a policy shock and information the central bank conveys about its outlook. For example, a rate rise with falling equities is more consistent with a restrictive policy shock in the Jarociński–Karadi identification scheme, while rates and equities rising together can be consistent with favorable central-bank information; neither sign rule is universal. Report the joint moves and label any decomposition as model-dependent. [Federal Reserve high-frequency monetary-policy event study](https://www.federalreserve.gov/econres/feds/do-actions-speak-louder-than-words-the-response-of-asset-prices-to-monetary-policy-actions-and-statements.htm), [Jarociński and Karadi (2020)](https://www.aeaweb.org/articles?id=10.1257/mac.20180090)

## 6. Triangulate by asset and mechanism

Do not rely on one indicator when independent evidence is available. Count independent data-generating processes, not the number of links, outlets, or report formats. Map shared upstream data, vendors, samples and model inputs before calling evidence corroborating. Examples include CFTC COT and Bank Participation Reports, which share the large-trader reporting system; a news story quoting a vendor consensus and that vendor page; and a portal distributing another agency's series. A genuinely different measurement method can still add useful information, but shared inputs reduce the amount of independent confirmation. For example:

- **Gold:** real and nominal yields, dollar, policy expectations, CFTC futures positioning, exchange volume/open interest, ETF flows, official reserve releases, physical-market estimates, and price behavior.
- **FX:** relative policy paths, inflation and growth surprises, terms of trade where relevant, CFTC futures positioning, rate differentials, and broker data clearly identified as broker-specific. Spot FX has no single consolidated public order book.
- **Equities:** issuer filings and guidance, earnings and estimate revisions, rates and credit conditions, ownership filings with their reporting lags, and exchange/FINRA market data.
- **Rates and credit:** central-bank and Treasury releases, auction results, repo and funding indicators, futures positioning, TRACE where relevant, and clear separation of public aggregates from private dealer exposures.
- **Energy/agriculture:** official inventories and production, agency supply/demand estimates, weather and trade data, futures curves and positioning, and company disclosures. Identify where physical-market observations are incomplete or delayed.

Use a causal chain: **new information → changed expectation or constraint → transmission mechanism → observable price response**. If one link is missing, identify it rather than filling the gap with narrative.

## 7. Treat difficult data according to what it can actually show

- CFTC COT is a weekly snapshot of reportable futures positions, not real-time total-market exposure. The monthly Bank Participation Report uses the same large-trader reporting system and may overlap at the entity level; treat it as a different classification, not independent confirmation.
- Short-sale volume is not short interest.
- 13F holdings are lagged disclosures, not current portfolios.
- Options open interest does not identify holder direction or dealer gamma.
- Treasury TIC data are useful but can be noisy, lagged, and affected by custodial reporting.
- FX broker sentiment represents that broker's customers, not all participants.
- Swap repositories and TRACE improve transparency but have reporting, aggregation, delay, or licensing limits.
- Alternative data may suffer from sampling bias, survivorship, revisions, or vendor-specific definitions.

When a desired fact is private or unavailable, identify the gap, provide the closest observable proxy, describe the proxy's bias, and avoid implying that it measures the hidden quantity directly.

## 8. Construct a balanced conclusion

Every substantial analysis should include:

- The answer in plain language.
- The strongest supporting evidence and strongest counterevidence.
- What changed and what was already known or priced.
- For market or valuation claims, identify the observable price, curve, consensus, or valuation benchmark used to represent what was priced in; state its timestamp, method, and limits. If no defensible benchmark is available, say so rather than asserting that news is or is not priced.
- Confidence level and the main uncertainty drivers.
- A conditional outlook or scenarios when useful, with observable triggers that would strengthen or weaken each case.
- The next data point or event that could resolve uncertainty.

Do not turn analysis into a trade instruction unless asked. If asked for a trade view, state assumptions, time horizon, invalidation conditions, and relevant execution or data limitations. Avoid false precision and point estimates unsupported by the evidence.

### Maintain a forecast record

Whenever a brief makes a time-bound prediction, record it before the outcome is known. A forecast must specify the event or variable, resolution source, threshold, deadline, information cutoff, probability (or full distribution), rationale, and base-rate comparator. Keep changed forecasts as new timestamped entries; never overwrite the original probability after the market moves.

Resolve forecasts from the predeclared source and rule. Score binary probability forecasts with the Brier score, `BS = (p - y)^2`, where `y` is 1 if the event occurred and 0 otherwise. Lower is better. A historical base rate used at cutoff *t* must include only reference-class outcomes that had resolved and were observable by *t*; when scoring, compare the forecast and baseline on the same resolved out-of-sample cases. A consensus comparator must also be captured by the same cutoff. For a continuous outcome, retain the full predictive distribution and use a proper distributional score such as CRPS, alongside interval coverage and calibration diagnostics. Proper scoring rules reward honest probability distributions in expectation, but no score by itself proves skill; sample size, dependence, changing regimes and the baseline matter. [Gneiting and Raftery, “Strictly Proper Scoring Rules, Prediction, and Estimation”](https://sites.stat.washington.edu/people/raftery/Research/PDF/Gneiting2007jasa.pdf)

Review calibration by probability bands only when there are enough independent resolved forecasts. For example, forecasts near 70% should occur roughly 70% of the time over a sufficiently large and comparable sample; show uncertainty rather than over-reading a small bucket. Track resolution separately from calibration: a forecaster who always repeats the base rate can be calibrated but add little decision value. Do not pool unrelated horizons, instruments or event definitions merely to increase sample count.

## 9. Report sources so the reader can audit the work

Place citations next to the claims they support and link directly to the source. Prefer primary sources and distinct publishers. Explain when a conclusion is an inference. Do not cite a page that only repeats another source if the original is available. Avoid unsupported exact prices, dates, release times, access terms, and product capabilities; verify any detail likely to have changed.

For datasets, include the dataset name or series identifier where practical, not just the portal homepage. Note access requirements and reuse/licensing limits when the user intends to build a product or redistribute data.

## 10. MeridianX research priorities

For the current macro/financial-market research context, prioritize:

1. A reliable, timezone-aware event calendar with source-linked releases.
2. Point-in-time storage of actuals, prior values, revisions, and consensus snapshots.
3. A gold/FX dashboard that separates observable data from estimates and broker-specific indicators.
4. Versioned issuer fundamentals sourced from filings, with provenance back to the filing and table/footnote.
5. A source registry describing cadence, typical delay, history, API method, coverage, and licensing.
6. A research log recording thesis, counter-thesis, evidence strength, confidence, and what would change the conclusion.

Suggested primary-source anchors include [BLS](https://www.bls.gov/schedule/), [BEA](https://www.bea.gov/data), [FRED/ALFRED](https://fred.stlouisfed.org/), [ECB Data Portal](https://data.ecb.europa.eu/), [BIS Data Portal](https://data.bis.org/topics), [SEC EDGAR APIs](https://www.sec.gov/search-filings/edgar-application-programming-interfaces), [CFTC COT](https://www.cftc.gov/MarketReports/CommitmentsofTraders/index.htm), [CFTC Bank Participation Report](https://www.cftc.gov/MarketReports/BankParticipation/index.htm), [New York Fed markets data](https://www.newyorkfed.org/markets/data-hub), [EIA Open Data](https://www.eia.gov/opendata/), and [USDA WASDE](https://esmis.nal.usda.gov/publication/world-agricultural-supply-and-demand-estimates).

## Review checklist

- [ ] Scope, instrument, geography, horizon, and decision are clear.
- [ ] Material claims link to primary evidence or are explicitly labeled as inference.
- [ ] Publication time, observation period, revisions, units, and source vintage are correct.
- [ ] Expectations are distinguished from actuals; historical surprise claims use contemporaneous consensus.
- [ ] Data limitations and market coverage are stated accurately.
- [ ] Supporting and contradicting evidence are both represented.
- [ ] Conclusion is conditional where the evidence is uncertain.
- [ ] A next observable checkpoint is identified where uncertainty remains.
- [ ] Time-bound predictions have a timestamped probability, clear resolution rule, and later score against a declared baseline.
