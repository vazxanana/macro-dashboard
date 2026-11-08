# Market expectations capture playbook

**Purpose:** Record the observable benchmark used to say what a market expected before an event or at a forecast cutoff. This is a measurement guide, not a claim that prices reveal objective probabilities.

## 1. Define the expectation being measured

Before collecting a number, specify:

- **Question:** which outcome, variable, horizon and event date are being priced?
- **Instrument:** contract/index/curve, venue, contract month or maturity, and quote convention.
- **Cutoff:** exact timestamp and timezone before the information arrival; record both market timestamp and retrieval time.
- **Transformation:** raw price, implied forward rate, probability distribution, breakeven, or survey statistic. Preserve the raw instrument price alongside any transformation.
- **Coverage and risk premia:** liquidity, term, convexity, risk and positioning premia that prevent a market price from being a pure expectation.

Keep these objects separate: **survey consensus** (respondents' forecasts), **market-implied pricing** (price-derived and risk-premium laden), **official projection** (institutional forecast), and **analyst forecast** (your own scored prediction).

## 2. US policy-rate path: Fed Funds futures and FedWatch

The CME FedWatch Tool converts 30-Day Fed Funds futures into probabilities for target-rate outcomes at scheduled FOMC meetings. The public tool provides current and historical outcome distributions and downloadable history for up to one year; CME advertises an API with extended history dating to 2015, with access subject to CME terms. ([User guide](https://www.cmegroup.com/tools-information/quikstrike/cme-fedwatch-tool-user-guide.html); [API](https://www.cmegroup.com/market-data/market-data-api/fedwatch-api.html))

### Capture procedure

1. Choose the meeting date and capture the entire probability table, not just the modal outcome.
2. Save corresponding 30-Day Fed Funds futures contract prices, contract months and any displayed market timestamp.
3. Record source retrieval time in UTC and local market time; store the raw file/export and the methodology version/link.
4. Capture at fixed pre-event checkpoints (for example, the last available observation before the release) and again in declared post-release windows. Do not compare asynchronous screenshots as if they were simultaneous.
5. Record whether the quote is a live observation, CME end-of-day snapshot, or official settlement. CME's standard ZQ daily settlement is based on activity from 13:59 to 14:00 Central Time, using a VWAP when trades are available; settlement is not an arbitrary intraday event-time quote. ([Settlement procedure](https://www.cmegroup.com/market-data/settlements/files/30-day-fed-fund-futures-daily-settlement-procedure.pdf))

### Interpretation limits

FedWatch probabilities are **model-derived market estimates**, not survey consensus or objective probabilities. CME's calculation assumes 25 bp increments, a proportional response of EFFR to target changes, and scheduled meeting timing; violations or alternative target outcomes affect the translation. Futures prices themselves imply an average monthly EFFR and include market pricing effects. Preserve raw contracts and explain any probability calculation. ([CME methodology](https://www.cmegroup.com/articles/2023/understanding-the-cme-group-fedwatch-tool-methodology.html))

For other central banks, use the relevant exchange-traded overnight-rate futures or dated overnight-index swaps only where the contract and market convention have been checked. A curve-implied path is not automatically a sequence of meeting probabilities. Record the instrument, meeting-date mapping, day-count convention, collateral/clearing conventions, and quote source; if this cannot be verified, report the curve movement without translating it into a precise probability.

## 3. Inflation pricing: breakevens and inflation swaps

US Treasury breakevens can be observed from nominal and TIPS real-yield curves. The daily FRED series T10YIE is defined as 10-year nominal Treasury constant-maturity yield less the 10-year TIPS constant-maturity yield. It is **inflation compensation**, often used as an expectations proxy, rather than pure expected CPI: inflation-risk premia, TIPS liquidity, indexation lag and curve construction matter. The Federal Reserve's fitted TIPS curve and inflation-compensation series are staff research estimates, generally posted weekly, and may be revised or methodologically changed; retain the retrieved vintage. ([FRED series notes](https://fred.stlouisfed.org/series/T10YIE); [Federal Reserve TIPS data notes](https://www.federalreserve.gov/data/tips-yield-curve-and-inflation-compensation.htm))

For inflation swaps, distinguish a benchmark quote curve from public swap transaction reports. Transaction data may be delayed, capped or incomplete and are not a continuous executable quote. Keep survey expectations, breakevens, swaps and model decompositions in separate columns; disagreement between them is information about different premia and respondent populations, not a reason to average them mechanically.

## 4. Consensus and event surprise

Use a point-in-time survey/vendor consensus only when its **release cutoff, contributor count, field definition, and historical snapshot** are documented. Store the forecast distribution where available; if only a median exists, do not invent dispersion. The raw surprise is actual minus contemporaneous consensus in the release's original units. A standardized surprise uses a past-only scale from comparable releases and must state the sample, consensus source and vintage policy.

If no timestamped pre-event consensus exists, do not call the price move a “surprise.” Analyze it as an event-window reaction and state that expectations are unmeasured. This rule applies even if a retrospective news article says an outcome was “widely expected.”

## 5. Capture record

| Field | Required content |
|---|---|
| `question_id` | Outcome or event and target horizon |
| `source` / `instrument` | Publisher, contract/index, venue, maturity/contract month |
| `raw_quote` | Price/rate and units before transformation |
| `implied_distribution` | Full outcomes/probabilities, if published or reproducibly calculated |
| `market_timestamp` | Publisher's quote timestamp with timezone |
| `captured_at_utc` | Retrieval or archive timestamp |
| `event_cutoff` | Exact event/research cutoff and whether observation precedes it |
| `methodology` | Formula/version and assumptions used in transformation |
| `vintage` | File, API response, CME download, or capture hash/location |
| `limits` | Coverage, premium, liquidity, access, revision and licensing notes |

Preserve one immutable record per capture. A current chart is not a substitute for a historical point-in-time snapshot; the CME public history is limited to one year, while longer API access is a separate product. Verify current terms before ingestion, display, retention or redistribution.

## 6. Analysis checklist

- [ ] Is the benchmark tied to the exact instrument and event date?
- [ ] Was it observed before the event, and is its timestamp in the correct timezone?
- [ ] Did I save the raw price, distribution and source vintage?
- [ ] Am I calling a survey a survey and a price-derived value market-implied?
- [ ] Have risk premia, liquidity, contract conventions and model assumptions been stated?
- [ ] Is the actual measured against a contemporaneous consensus, or is the event only a price reaction?
- [ ] Can another analyst reproduce the calculation from the archived inputs?

