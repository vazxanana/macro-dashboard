# Cross-Asset Macro Regime Framework

**Purpose:** Diagnose the shock and transmission behind market moves across rates, currencies, equities, credit, commodities and gold. This is a research framework, not a mechanical signal. “Higher yields” or “risk-off” alone do not identify the underlying shock.

## 1. Start with the move, then identify the shock

The same price change can come from different forces. A long Treasury yield can rise because the expected policy path moved up, inflation compensation rose, or investors demanded more term premium. Each channel has different implications for the dollar, equities, credit, commodities and gold.

First calculate changes over matched windows and name the instrument:

- **Rates:** front-end policy pricing; 2-, 5- and 10-year nominal yields; TIPS real yields; breakevens/inflation compensation; curve slope; estimated term premium.
- **FX:** broad USD measure, major crosses and relevant local currency. Do not mix ICE DXY with a different Fed dollar index under one label.
- **Risk assets:** equity index/sector, credit spreads, implied volatility and cyclical commodities.
- **Funding:** repo/SOFR, FX swap basis, Treasury liquidity/depth if available, and official stress aggregates.
- **Gold/commodities:** specify benchmark, futures contract or broker CFD; include curve, spread and session where relevant.

Keep observation, publication and retrieval timestamps. A daily close correlation cannot establish which market moved first intraday.

## 2. Shock fingerprints

The directions below are **diagnostic tendencies**, not universal laws. “Up/down” means an initial, other-things-equal response; actual markets combine shocks and vary by country, regime, positioning and liquidity.

| Candidate shock | Rates / curve clues | FX and other cross-asset clues | Gold / commodity implication to test | Strongest competing explanation |
|---|---|---|---|---|
| **Positive growth or demand news** | Front-end and real yields may rise as growth and expected policy improve; curve may steepen if long-run growth expectations dominate. | Equities often firm, credit spreads may tighten, cyclical commodities may strengthen; USD depends on relative growth and policy versus other regions. | Gold may weaken if higher real yields dominate, or hold if currency/risk/portfolio demand offsets. Industrial commodities may respond more directly to demand. | Positive central-bank information or inflation pressure can also raise yields; rising stocks with yields does not prove a pure growth shock. |
| **Negative growth / demand shock** | Policy-path rates and real yields often fall; curve response depends on expected easing and term premium. | Equities fall, credit spreads widen, cyclical commodities weaken; USD may rise as a safe/funding asset or fall if US-specific growth deteriorates. | Gold can benefit from lower real yields and defensive demand, but could be sold for cash in a severe funding squeeze. | Disinflation can lower yields while risk premia widen; a supply shock has a different inflation signature. |
| **Inflation surprise / inflation-risk shock** | Breakevens may rise; nominal yields rise if real yields or inflation compensation increases. Separate actual TIPS real-yield changes from breakevens. | FX responds to relative policy paths and terms of trade; equities depend on margins, discount rates and whether inflation is demand- or supply-driven. | Gold is not mechanically bullish on higher CPI: it may fall if real yields/USD rise, or rise if currency confidence/inflation-risk demand dominates. Energy and some commodities may have direct supply exposure. | Oil/commodity supply shock versus broad demand or wage/services persistence. Examine release composition and subsequent revisions. |
| **Hawkish policy shock** | Front-end OIS/futures reprice higher; a policy shock often raises short yields and can flatten the curve. Track the path, not just the current target rate. | USD may strengthen when the relative expected path rises; equity valuations may compress and credit conditions tighten. | Higher real yields and USD can pressure gold, all else equal; actual response may be offset by central-bank information or risk demand. | The central bank may reveal a stronger economic outlook at the same time; joint rate/equity response is informative but not definitive. |
| **Dovish policy shock** | Front-end policy expectations fall; real yields can ease. Curve shape depends on the growth interpretation and term premium. | USD may weaken relative to other currencies; equities/credit can rally if easier policy is seen as supportive, or sell if easing signals economic distress. | Lower real yields and a weaker USD can support gold; panic easing can instead coincide with liquidation and cash demand. | A dovish repricing caused by deteriorating growth rather than benign disinflation. |
| **Positive supply / productivity shock** | Output can improve while inflation pressure eases; expected policy need not rise as much as under a demand shock. | Equities may rise with lower inflation pressure; credit may improve; FX depends on external competitiveness. | Gold can lag if real yields remain firm and defensive demand fades. Commodity effects depend on which supply curve shifts. | Demand boom can look like better productivity early on; verify productivity/output and unit-cost evidence over time. |
| **Negative supply shock / stagflation risk** | Inflation compensation may rise while growth expectations weaken; central-bank trade-off becomes harder and nominal yields may rise despite weak real activity. | Equities can fall, credit spreads widen, and producer/exporter currencies may diverge from importers. | Gold may benefit from inflation/uncertainty demand, yet real-rate and USD moves can offset. Commodity price effects are strongest in the disrupted input. | Temporary sector-specific disruption versus persistent broad supply/cost shock; inspect breadth, inventories, wages and expectations. |
| **Dollar funding / liquidity shock** | Funding spreads, repo pressure or market dislocations rise; Treasury yields can behave unusually if collateral/liquid-asset demand dominates. | USD funding demand can lift the dollar and widen FX swap basis; risky assets fall and volatility rises. | Gold may initially fall from margin calls/liquidation even if medium-run safe-haven demand later supports it. | Ordinary risk aversion without funding scarcity, or quarter-end/settlement technicals. Check funding quantities and persistence. |
| **Sovereign duration / fiscal term-premium shock** | Long yields rise more than short policy rates; estimated term premium or auction/liquidity measures may rise, curve steepens. | Long-duration equities may underperform; FX can weaken if fiscal credibility is impaired, though relative yields may attract capital in other cases. Credit and collateral conditions may tighten. | Gold may gain as a currency/debt hedge, or fall if real yields and USD rise. It is not a pure fiscal-stress hedge. | Stronger expected growth, a higher future policy path, or changing inflation-risk premium. Compare surveys/policy pricing, term-premium models, issuance and liquidity. |
| **Geopolitical / event-risk shock** | Safe-asset yields may fall, but inflation, energy and fiscal channels can push yields up instead. | USD/CHF/JPY and volatility responses depend on the event, geography, funding stress and starting valuation; energy/defense sectors can diverge. | Gold may rise on hedging demand, but the path depends on liquidity, sanctions, rates and event persistence. | A concurrent policy or supply shock. Define the event window and compare affected and less-affected assets. |

Cross-asset fingerprint is a hypothesis generator. If rates rise and equities also rise, a positive growth or information shock may be more plausible than a pure tightening shock; confirm with policy pricing, earnings breadth, credit and event details. If rates and equities fall together, distinguish growth fear from forced deleveraging using spreads, funding and market depth.

## 3. Decompose yields before narrating them

For a nominal government yield, a useful conceptual decomposition is expected future short rates plus a term premium, with model and instrument details affecting the exact estimate. For inflation-linked comparisons, inflation compensation is not a direct, clean observation of expected inflation: it also reflects inflation-risk premia and liquidity differences between nominal Treasuries and TIPS. [Federal Reserve TIPS curve notes](https://www.federalreserve.gov/data/tips-yield-curve-and-inflation-compensation.htm)

Useful public diagnostics include:

- Nominal Treasury and TIPS yields from the [US Treasury](https://home.treasury.gov/policy-issues/financing-the-government/interest-rate-statistics).
- Estimated expected-rate and term-premium components from the [New York Fed ACM term-premium data](https://www.newyorkfed.org/research/data-indicators/term-premia-tabs). These are model estimates, not traded prices or official forecasts.
- Policy expectations from named overnight-indexed swaps or futures, retaining timestamp, contract and conversion method.
- Inflation surveys and official releases to triangulate market-implied compensation.

Do not write “real yields rose” from nominal Treasury yields alone. Do not write “inflation expectations rose” from breakevens alone. State whether a result is directly observed or model-decomposed.

## 4. Use a compact regime matrix, then confirm with market pricing

Classify the **surprise direction** of growth and inflation relative to contemporaneous expectations, not simply whether levels are high or low. “Growth strong” could mean above forecast even as the economy slows; “inflation easing” can coexist with a high year-over-year rate.

| Growth surprise | Inflation surprise | Likely first questions | Key confirmation |
|---|---|---|---|
| Positive | Negative / easing | Is this a favorable supply/productivity mix? | Activity improves, inflation breadth eases, real yields/policy path do not rise as much as a demand boom would imply. |
| Positive | Positive | Is demand overheating or supply constrained? | Front-end policy repricing, wage/service breadth, credit and cyclical asset response. |
| Negative | Positive | Is this stagflation or a temporary input shock? | Supply/energy contributions, inflation expectations, real income, margin/credit deterioration and policy reaction. |
| Negative | Negative | Is this benign disinflation or a recessionary demand shock? | Employment/orders, earnings revisions, credit spreads, policy repricing and funding conditions. |

Add a third axis for **financial conditions/liquidity**. The same growth/inflation pair can produce different outcomes if leverage, funding and market-making capacity are loose versus stressed. A benign disinflation shock can support both duration and equities in loose conditions; in a forced liquidation, correlations can converge as investors raise cash.

Keep a **state change** separate from a **relationship change**. A real-yield level crossing a chosen threshold may change the current state label; it does not show that gold's sensitivity to real yields has changed. A structural-break claim concerns instability in a specified parameter or distribution and should name that object, the test, the candidate timing and its uncertainty. If the break was located using the full sample, it is retrospective; a live regime switch needs a one-sided detector tested on future data without look-ahead. [Andrews on unknown break dates](https://users.ssc.wisc.edu/~behansen/718/Andrews1993.pdf), [Bai–Perron on multiple breaks](https://www.columbia.edu/~jb3064/papers/1998_Estimating_and_testing_linear_models_with_multiple_structural_changes.pdf)

## 5. Event-study protocol

For a macro release or policy announcement:

1. Save timestamped consensus and first-print actual, prior value and revision; preserve units and source.
2. Calculate raw surprise. Standardize only using a pre-event, past-only surprise distribution for the same release and consistent survey definition.
3. Lock the benchmark instrument/feed, pre-event price, windows and event calendar before inspecting the reaction.
4. Compare front-end rates, real yields/breakevens, USD, equities/credit, relevant commodity and gold over matched windows.
5. Identify simultaneous releases, scheduled speakers, headlines, stale quotes, widening spreads and market-hour mismatches. If effects overlap, call it a joint-news reaction.
6. Describe the price response and candidate transmission. Reserve causal language for an identification design that handles confounding and announcement-selection issues.

For central-bank news, an unexpected rate-path change can coexist with information about the bank's assessment of the economy. High-frequency joint movement in rates and equities can help distinguish components under a model, but it does not make a simple sign rule universal. [Jarociński and Karadi (2020)](https://www.aeaweb.org/articles?id=10.1257/mac.20180090), [Federal Reserve event-study research](https://www.federalreserve.gov/econres/feds/do-actions-speak-louder-than-words-the-response-of-asset-prices-to-monetary-policy-actions-and-statements.htm)

## 6. Daily cross-asset monitor

| Block | Track | Ask |
|---|---|---|
| Policy | OIS/futures path, central-bank communication, front-end yields | What changed in expected reaction function versus current level? |
| Curve | Nominal curve, TIPS real curve, breakeven, ACM term premium | Is the long-end move expectations, inflation compensation, term premium or a mix? |
| FX | DXY or a defined broad index, G10/EM pairs, relevant local FX | Is USD move broad, relative-policy-driven, terms-of-trade-driven or funding-driven? |
| Risk | Equities, sector breadth, credit spreads, volatility | Is the move growth optimism, risk-premium repricing or forced de-risking? |
| Funding | SOFR/repo, FX swap basis, short-term funding and liquidity measures | Is funding functioning normally? Is the indicator persistent or a calendar effect? |
| Real economy | Surprise tracker, labor, consumption, production, surveys, earnings revisions | What is the direction of new information versus expectations, and how broad is it? |
| Commodities/gold | Curves, inventories/flows where observable, local prices, positioning | Is the move macro, physical, positioning, supply or venue-specific? |

For each block, display value, change over selected horizon, source timestamp, publication time, vintage, unit, and freshness flag. Missing data should remain missing; do not carry forward stale intraday prices and call them current.

For funding and market-functioning context outside the US, use public ECB MMSR aggregate repo/unsecured/OIS measures where relevant and the Bank of England weekly balance sheet. ECB MMSR collects FX-swap transactions, but its regular public dataset does not currently provide a daily FX-swap series; the ECB's periodic [Euro money market studies](https://www.ecb.europa.eu/press/euromoneymarket/html/ecb.euromoneymarket202504.en.html) give retrospective aggregate analysis of that segment. Use the Fed's quarterly SCOOS as a slower dealer-terms overlay (haircuts, credit terms, leverage, collateral disputes), not as a live market series. Preserve the ECB MMSR reporting-population break beginning in 2025 for published segments. [ECB MMSR](https://data.ecb.europa.eu/data/datasets/MMSR), [Bank of England weekly report](https://www.bankofengland.co.uk/weekly-report/balance-sheet-and-weekly-report), [Fed SCOOS](https://www.federalreserve.gov/data/scoos.htm)

## 7. Hypothesis card

```text
Claim and horizon:
Candidate shock:
What surprised, relative to which timestamped expectation?
Observed cross-asset changes (instrument, venue, window, source):
Yield decomposition: observed vs model estimate:
Mechanism from shock to affected market:
Best alternative explanation:
Overlapping news / liquidity / positioning confounders:
What observation would falsify the diagnosis?
Next source update / event / review time:
Forecast ID, if a probability is issued:
Confidence and missing evidence:
```

## 8. Research anchors

- Federal Reserve, [TIPS Yield Curve and Inflation Compensation](https://www.federalreserve.gov/data/tips-yield-curve-and-inflation-compensation.htm): measure construction and interpretation limits.
- New York Fed, [Treasury Term Premia](https://www.newyorkfed.org/research/data-indicators/term-premia-tabs): ACM model estimates and downloadable data.
- Federal Reserve, [Funding Risk](https://www.federalreserve.gov/publications/may-2021-funding-risk.htm): global dollar funding mechanisms and vulnerabilities.
- BIS, [What happens to EMEs when US yields go up?](https://www.bis.org/publications/working-paper-1081-what-happens-emes-when-us-yields-go-up): why the type of US yield increase and USD co-movement matter for spillovers.
- BIS, [Financial conditions in a changing global financial system](https://www.bis.org/publications/aer-2025/financial-conditions-changing-global-financial-system): cross-border flow and monetary transmission context.
- Jarociński and Karadi, [Deconstructing Monetary Policy Surprises—The Role of Information Shocks](https://www.aeaweb.org/articles?id=10.1257/mac.20180090): model-based distinction between policy and central-bank information shocks.

The papers identify effects under particular samples and assumptions. Use them to motivate variables and tests; do not apply their coefficients as universal, current trading rules.
