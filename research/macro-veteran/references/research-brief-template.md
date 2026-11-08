# Research Brief Template

Copy this file for a new macro, company, commodity, FX, or market-structure question. Replace bracketed prompts; delete sections that do not apply. Keep the source ledger and uncertainty section even when the answer is short.

## Finding

**As of:** [date, time, timezone]  
**Question:** [one sentence]  
**Decision supported:** [what the reader may decide or monitor]  
**Instrument / geography:** [scope]  
**Horizon:** [intraday / event / weeks / quarters / structural]  
**Conclusion:** [direct answer in 1–3 sentences]  
**Evidence assessment:** measurement confidence [high / medium / low]; interpretation support [high / medium / low] — [brief basis; a well-measured observation can still provide weak support for a causal explanation]  
**Forecast probability:** [state separately in the forecast ledger; do not use “confidence” as a substitute]

### What matters most

- [Strongest piece of evidence]
- [Strongest counterevidence]
- [Next event or observation that could change the conclusion]

## Scope and method

- **Included:** [markets, period, data, and event window]
- **Excluded:** [material boundaries]
- **Method:** [comparison, calculation, filing review, scenario analysis, or other]
- **Assumptions:** [explicit assumptions; identify which one matters most]

## Evidence ledger

| Claim or observation | Evidence / value | Type | Reference period | Published / captured at | Vintage / revision | Source and direct link | Upstream lineage / dependence group | Limitation |
|---|---|---|---|---|---|---|---|---|
| [Claim] | [Value or concise finding] | Observed / calculated / estimated / interpretation | [Period] | [Timestamp + timezone] | [Initial / revised / as-of date] | [Primary source] | [Underlying dataset or source group; say independent only when justified] | [Coverage, lag, definition, or none known] |

**Evidence type guide:** *Observed* means directly reported. *Calculated* means reproducible arithmetic. *Estimated* means model-derived or incomplete. *Interpretation* means an explanation consistent with the evidence, not uniquely demonstrated by it.

**Evidence independence check:** Count independent data-generating processes, not links or news articles. If two reports share a regulatory database, provider consensus, sample, or model inputs, mark the shared lineage and avoid treating them as separate confirmation.

## Expectations and event reaction

Complete this section for a scheduled data release, policy decision, auction, or earnings event.

| Item | Value / observation | Source | Timestamp / vintage |
|---|---|---|---|
| Consensus before event | [Value or unavailable] | [Source] | [As-of timestamp] |
| Official actual | [Value] | [Primary source] | [Release timestamp] |
| Prior value as then known | [Value] | [Primary source] | [Prior vintage] |
| Revised prior value | [Value / not revised / unavailable] | [Primary source] | [Revision timestamp] |
| Price reaction | [Instrument, venue, window, return/change] | [Market data source] | [Window and timezone] |

**Surprise calculation:** [Actual minus contemporaneous consensus, unit, sign convention; or explain why not calculated.]  
**Standardized surprise:** [(actual − consensus) / historical surprise standard deviation, if useful; state the past-only estimation window, consensus source, and sample size. Keep raw and standardized values.]  
**Composition:** [Important subcomponents, revisions, and offsetting details.]  
**Interpretation:** [Separate the release surprise from the subsequent market reaction.]

| Instrument / channel | Pre-event observation | Immediate window | Later window / close | Source, venue, timezone | Diagnostic interpretation and limits |
|---|---|---|---|---|---|
| [e.g. 2-year yield / policy path] | [Value] | [Change] | [Change] | [Feed and timestamp] | [Did policy pricing react as expected?] |
| [USD basket / FX] | [Value] | [Change] | [Change] | [Feed and timestamp] | [Relative-rate or risk channel?] |
| [Gold / instrument] | [Value] | [Return] | [Return] | [Feed and timestamp] | [Was the move confirmed or offset?] |
| [Equity / credit / other] | [Value] | [Change] | [Change] | [Feed and timestamp] | [Useful cross-check; not causal proof] |

**Overlapping news / data quality:** [Other releases at the same time, revisions, unscheduled headlines, market-hours issues, stale quotes, or widening spreads. If attribution is not separable, call it a joint-news reaction.]

## What is already priced or expected?

- **Benchmark:** [Observable price, forward curve, option-implied distribution, timestamped consensus, or valuation multiple; include instrument, venue, units, and as-of time.]
- **Implied baseline:** [What that benchmark suggests the market expects, and the calculation or interpretation used. If no defensible estimate is available, state that rather than asserting the news is priced in or not priced in.]
- **Thesis gap:** [How the evidence-based view differs from the observed benchmark and which assumptions drive the difference.]
- **Limits:** [Risk premia, positioning, liquidity, product scope, or other reasons the benchmark is not a pure expectation or objective probability.]

## Competing explanations

| Explanation | Evidence supporting it | Evidence against it | What would distinguish it? |
|---|---|---|---|
| Main explanation | [Evidence] | [Counterevidence] | [Observable test] |
| Alternative explanation | [Evidence] | [Counterevidence] | [Observable test] |

Do not present a narrative as causal unless the mechanism and evidence support the link. Identify other explanations that remain plausible.

## Scenarios and monitoring

| Scenario | Conditions / trigger | Expected transmission | Evidence that weakens it |
|---|---|---|---|
| [Scenario A] | [Observable condition] | [Conditional implication] | [Disconfirming observation] |
| [Scenario B] | [Observable condition] | [Conditional implication] | [Disconfirming observation] |

**Next checkpoints:** [Release, filing, auction, policy date, positioning update, or price level; include source and expected time if verified.]  
**Review date:** [When this brief should be refreshed, or the condition that triggers a refresh.]

## Forecast record (complete for each time-bound prediction)

Record forecasts before the outcome is known. Give each forecast a stable ID. If the view changes, add a new row with a new timestamp; preserve the original forecast.

| Forecast ID | Variable / event and threshold | Probability / distribution | Horizon and deadline | Information cutoff | Resolution source and rule | Base-rate / consensus comparator | Rationale and key disconfirming evidence | Resolved outcome | Score / review |
|---|---|---|---|---|---|---|---|---|---|
| [ID] | [e.g. XAU/USD closes above level X on date Y] | [0–100% or distribution] | [Exact horizon/deadline] | [Timestamp + timezone] | [Source, field, exact condition] | [Same event class base rate or timestamped consensus] | [Short mechanism; what would change the probability] | [Yes/no/value, once resolved] | [Brier/CRPS/interval check and what was learned] |

**Scoring convention:** Binary forecast Brier score = `(probability − outcome)^2`, where outcome is 1 or 0; lower is better. Score against a declared baseline. For continuous forecasts, keep the distribution and interval definitions fixed before resolution; use a proper score such as CRPS and check interval coverage. Do not call a small set of resolved forecasts “calibrated.”

For probability-bin diagnostics, proper-score choice, dependence, baselines and the distinction between forecast quality and trading value, see the [probability forecast calibration playbook](probability-forecast-calibration-playbook.md).

## Data quality and missing information

- **Coverage:** [What market, participants, geography, and period are represented?]
- **Timing:** [Known lags, revisions, publication delays, timezone issues]
- **Access:** [Free, API/key, subscription, restricted, or licensing concern]
- **Proxies:** [Any proxy used for an unobserved quantity and its likely bias]
- **Missing evidence:** [What could not be verified and how it limits the answer]

## Source list

1. [Primary source title] — paste the direct URL; state the claim or series supported and its publication/vintage.
2. [Independent corroborating source] — paste the direct URL and say what distinct evidence it adds.

Prefer direct primary-source links near the claims they support. If a secondary report is the only accessible source for a claim, label that dependence.

## Final audit

- [ ] The answer addresses the stated decision and horizon.
- [ ] Facts, calculations, estimates, interpretations, and forecasts are distinguishable.
- [ ] Material claims have direct links; current and changing details were checked.
- [ ] Release expectations are timestamped; no unavailable historical consensus was invented.
- [ ] Revisions and point-in-time availability were handled correctly.
- [ ] The strongest counterevidence and a viable alternative explanation are included.
- [ ] Data limits and proxies are explicit; no hidden or private quantity is implied to be directly observed.
- [ ] Confidence reflects both source quality and remaining outcome uncertainty.
- [ ] Observable conditions and next checkpoints are stated where uncertainty remains.
