# Issuer Fundamental Analysis Template

Copy for a public-company or credit analysis. Replace bracketed prompts, preserve the evidence ledger, and remove irrelevant sections. This is a research framework, not an automatic valuation or a recommendation.

For a worked mining example, see [Gold Producer Fundamentals Case — 8 November 2026](gold-producer-fundamentals-case-2026-11-08.md). It shows why reporting cutoffs, ownership perimeters, ounce denominators, cash-flow definitions, and hedge terms must be aligned before drawing peer conclusions.

## 1. Question and conclusion

**Issuer / security:** [Legal name, ticker, share class, listing, currency]  
**As of:** [Timestamp and timezone]  
**Decision supported:** [Monitor / compare / diligence / valuation / risk review]  
**Investment horizon:** [Event / 6–12 months / multi-year / credit maturity]  
**Conclusion:** [One short paragraph. Separate business quality, financial resilience, valuation, and catalyst/timing.]  
**Confidence:** [High / medium / low; explain evidence quality and uncertainty separately.]

### Decision in four questions

1. **Business:** Is the business improving, stable, or deteriorating, and why?
2. **Financial claims:** How much cash reaches equity/debt holders after reinvestment, working capital, interest, tax and dilution?
3. **Price:** What expectations are already embedded in the security price, and what must happen to justify it?
4. **Catalyst/risk:** What could change the market's view within the stated horizon?

Do not collapse these into “good company = good investment.”

## 2. Source and point-in-time record

Start with the issuer's filed reports and exhibits in [SEC EDGAR](https://www.sec.gov/search-filings/edgar-application-programming-interfaces), not an aggregator's normalized output. The SEC's [10-K guide](https://www.sec.gov/answers/reada10k.htm) is a useful map to the business, risk factors, MD&A, audited statements and exhibits. For non-US issuers, use the home regulator's filing system and the issuer's local statutory filings.

| Document / data | Filing date and accepted time | Period covered | Primary evidence extracted | Revision / amendment? | Link |
|---|---|---|---|---|---|
| Latest 10-K / annual report | [ ] | [ ] | [Segments, risks, accounting policy, audited statements] | [ ] | [ ] |
| Latest 10-Q / interim report | [ ] | [ ] | [Current operating results, liquidity, debt, commitments] | [ ] | [ ] |
| 8-K / earnings release | [ ] | [ ] | [Guidance, non-GAAP reconciliation, material events] | [ ] | [ ] |
| Proxy statement | [ ] | [ ] | [Compensation, incentives, related parties, ownership] | [ ] | [ ] |
| Debt agreement / bond terms | [ ] | [ ] | [Maturities, covenants, collateral, pricing] | [ ] | [ ] |
| Bankruptcy docket / monthly operating report (when applicable) | [Court and docket dates] | [Case period] | [Orders, claims, DIP terms, cash receipts/disbursements, restrictions, plan/recovery terms] | [ ] | [PACER / U.S. Trustee](issuer-and-physical-flow-data-map.md) |
| Earnings call / investor presentation | [ ] | [Period] | [Management claims; distinguish from filed facts] | [ ] | [ ] |

XBRL/API facts are useful for retrieval and comparison, but tags, units, dimensions, fiscal periods and company extensions need checking against the original filing. The SEC company-concept API returns facts grouped by the units companies report; it is not a substitute for footnotes or issuer-specific context. [SEC API documentation](https://www.sec.gov/search-filings/edgar-application-programming-interfaces)

## 3. Business model and industry economics

**What is sold:** [Product/service, customer, payer and end user]  
**How revenue is earned:** [Price × volume, subscription, transaction fee, spread, regulated return, commodity exposure, etc.]  
**Revenue concentration:** [Top customers, products, geographies, channels; if undisclosed, say so]  
**Customer value and switching costs:** [Evidence, retention, renewal, repeat purchase or contract length]  
**Competition and substitutes:** [Named peers, private competitors, in-house substitutes, regulation/technology]  
**Industry cycle:** [Demand, inventory, capacity, pricing, utilization, supply and credit cycle]  
**Operating leverage:** [Which costs are fixed/variable; break-even or incremental margin evidence]  
**Capital intensity:** [Maintenance/growth capex, working capital, leases, R&D, customer acquisition]  
**Key operating metrics:** [Definition, source, period, trend, limitations]

Prefer operational evidence over management adjectives. Identify whether KPIs are audited, defined consistently, comparable over time, and reported on the same perimeter as revenue.

## 4. Financial history and normalization

Collect at least five fiscal years plus the latest quarterly and trailing-twelve-month period when available. Keep reported values and analyst adjustments in separate columns. Use fiscal-period labels and filing timestamps, not calendar-year assumptions.

| Metric | FY−4 | FY−3 | FY−2 | FY−1 | Latest FY | Latest quarter | TTM | Source / definition |
|---|---:|---:|---:|---:|---:|---:|---:|---|
| Revenue | | | | | | | | |
| Organic / constant-currency growth | | | | | | | | |
| Gross profit / gross margin | | | | | | | | |
| Operating income / margin | | | | | | | | |
| GAAP net income / diluted EPS | | | | | | | | |
| Adjusted earnings / EPS (reconciled) | | | | | | | | |
| Cash from operations | | | | | | | | |
| Capital expenditure | | | | | | | | |
| Free cash flow (state definition) | | | | | | | | |
| Stock-based compensation | | | | | | | | |
| Diluted weighted-average shares | | | | | | | | |
| Cash, restricted cash and marketable securities | | | | | | | | |
| Total debt / lease liabilities | | | | | | | | |

### Normalize carefully

- Separate organic growth from acquisitions, disposals, FX translation and accounting changes.
- Show GAAP and company-adjusted earnings side by side. Reconcile each material adjustment; repeated “one-time” exclusions may be recurring economics.
- Calculate free cash flow with an explicit formula, commonly operating cash flow less capital expenditure; check whether restructuring, leases, capitalized software, supplier finance or stock compensation make that measure incomplete.
- Inspect working capital: receivables, contract assets, inventory, payables, deferred revenue and cash conversion. Compare growth rates to sales and disclose acquisition/seasonality effects.
- Track share count and dilution. Per-share growth can diverge from aggregate growth because of stock awards, buybacks, convertibles or issuance.
- Separate maintenance investment from growth investment only when evidence permits. Do not label all capex above depreciation “growth” without support.
- Identify discontinued operations, restatements, accounting changes, pension adjustments, impairments and large acquisition effects. Keep the original reported series visible.

## 5. Earnings quality and accounting checks

| Check | Observation | What would concern me? | Counterevidence / explanation | Source |
|---|---|---|---|---|
| Revenue vs receivables / contract assets | [ ] | [ ] | [ ] | [ ] |
| Inventory vs sales / cost of sales | [ ] | [ ] | [ ] | [ ] |
| Operating cash flow vs net income | [ ] | [ ] | [ ] | [ ] |
| Capitalized costs / software / commissions | [ ] | [ ] | [ ] | [ ] |
| Adjusted earnings exclusions and recurrence | [ ] | [ ] | [ ] | [ ] |
| Stock compensation and dilution | [ ] | [ ] | [ ] | [ ] |
| Goodwill, intangibles and acquisition returns | [ ] | [ ] | [ ] | [ ] |
| Supplier finance, factoring, securitization | [ ] | [ ] | [ ] | [ ] |
| Related-party transactions / segment changes | [ ] | [ ] | [ ] | [ ] |
| Auditor, control, restatement or filing delay | [ ] | [ ] | [ ] | [ ] |

These are prompts for verification, not automatic fraud indicators. Use footnotes, auditor opinions, subsequent filings and management explanations before drawing a conclusion. The SEC emphasizes that the 10-K contains risk factors, MD&A and detailed financial statements; read the filing's footnotes rather than relying only on headline ratios. [SEC guide to 10-Ks](https://www.sec.gov/answers/reada10k.htm)

## 6. Balance sheet, liquidity and debt resilience

**Cash quality:** [Unrestricted cash, trapped cash, currency, pledged balances, short-term investments]  
**Debt schedule:** [Amount, maturity, currency, fixed/floating, secured/unsecured, refinancing source]  
**Covenants:** [Tests, headroom, springing terms, collateral, cross-default; cite agreement]  
**Lease and pension obligations:** [Present value / funded status / required contributions]  
**Near-term liquidity:** [Cash + committed undrawn facilities − known uses and restrictions]  
**Interest sensitivity:** [Floating debt, refinancing rates, hedge expiry, rate shock]  
**Contingent claims:** [Guarantees, litigation, purchase obligations, take-or-pay, environmental liabilities]  
**Downside runway:** [Cash generation or liquidity under a stated adverse case]

For credit, add recovery/collateral, debt ranking, guarantors, documentation, maturity wall, refinancing access, interest coverage and covenant cushion. For equity, include the dilution or restructuring path if liquidity becomes insufficient. In an active Chapter 11 case, cross-check current court filings and any monthly operating report against DIP/cash-collateral orders, restricted cash, claims and the plan; the reported operating cash balance is not necessarily cash available to all creditors. Use the [PACER / court-file route](issuer-and-physical-flow-data-map.md) and follow the case's current U.S. Trustee and local-court reporting rules.

## 7. Management, incentives and governance

- Compare guidance with outcomes over several years; retain original guidance vintages where available.
- Review compensation metrics and whether they reward per-share value, cash returns, growth at any cost, or adjusted metrics that exclude recurring costs.
- Review insider transactions using transaction date and filing date; distinguish pre-planned sales from discretionary purchases and examine the full filing.
- Check ownership changes, related-party dealings, auditor tenure/control matters, capital allocation, buyback price discipline, acquisitions and divestitures.
- Record the strongest management explanation and the strongest independent evidence against it.

## 8. Expectations, valuation and implied assumptions

**Current security price and timestamp:** [Source, exchange, currency, share class]  
**Market capitalization / enterprise value:** [Formula and treatment of leases, minority interests, preferreds and cash]  
**Valuation method(s):** [DCF, earnings/cash-flow multiple, asset/NAV, sum-of-parts, credit spread/recovery]  
**Peer set and why comparable:** [Business mix, geography, growth, risk, accounting and capital intensity]  
**Estimate source and vintage:** [Consensus provider, contributors, captured timestamp, horizon]  
**What the current price appears to require:** [Growth, margins, reinvestment, terminal value or recovery assumptions]

| Case | Revenue / volume | Margin / unit economics | Reinvestment / cash conversion | Discount rate / multiple | Per-share value or credit outcome | Probability and evidence |
|---|---|---|---|---|---|---|
| Downside | [ ] | [ ] | [ ] | [ ] | [ ] | [ ] |
| Base | [ ] | [ ] | [ ] | [ ] | [ ] | [ ] |
| Upside | [ ] | [ ] | [ ] | [ ] | [ ] | [ ] |

Use at least one reverse-valuation question: what operating performance must occur for the current price to be reasonable? Show sensitivity to the variables that matter most. Avoid false precision from a single DCF terminal value or an unadjusted peer multiple. Use sector-appropriate metrics and explain why they match this business.

## 9. Sector-specific additions

| Sector | Add these drivers | Common traps |
|---|---|---|
| Banks | Net interest margin, deposit beta, loan growth, nonperforming assets, charge-offs, CET1/capital, liquidity and securities duration; use the bank-specific normalization checklist below. | P/E or price/book without asset quality, capital needs, deposit mix or rate sensitivity; mixing holding-company and bank-subsidiary data or reserve builds with realized losses. |
| Insurers | Premium growth, combined ratio, reserve development, investment yield, capital solvency and catastrophe exposure | Treating underwriting profit and investment income as interchangeable; ignoring reserve revisions. |
| REITs | Same-property NOI, occupancy, rent spreads, FFO/AFFO reconciliation, lease duration, cap rates, debt ladder and asset values | Using GAAP EPS without adjusting real-estate depreciation; ignoring refinancing and equity dilution. |
| Software / platforms | ARR definition, net retention, churn, bookings, deferred revenue/RPO, gross retention, customer concentration, CAC/payback and SBC | Equating bookings/backlog with revenue or ignoring dilution and capitalized acquisition costs. |
| Energy / mining | Realized prices, production, reserve life, decline rates, lifting/AISC costs and definition, sustaining capex, hedges, royalties and jurisdiction; for miners, bridge reserve/resource revisions and validate the latest operator report; for royalty/stream issuers, capture the covered area, metal, delivery/payment terms, term, caps and operator data access | Treating spot commodity price as company cash flow; using cost metrics with inconsistent byproduct credits; treating a resource as a reserve or a royalty issuer's stale/operator-sourced mine data as independently verified. |
| Consumer / retail | Same-store sales, units vs price/mix, inventory turns, markdowns, returns, store economics and working-capital seasonality | Reading nominal sales growth as volume growth; overlooking channel stuffing or inventory accumulation. |
| Biotech / early-stage | Cash runway, burn, trial phases/endpoints, enrollment, regulatory milestones, patent runway, dilution and partner economics | Assigning commercial value to early clinical data without probability, time, financing and dilution. |

### Bank-specific normalization checklist

For a worked four-bank filing comparison, see the [Q3 2026 U.S. bank fundamentals case](us-bank-fundamentals-case-q3-2026.md).

1. **Match the reporting entity and quarter.** A bank holding company's SEC filing and Federal Reserve FR Y-9C are consolidated at the parent level; the insured bank's FFIEC Call Report has a different legal-entity perimeter. Do not mix them without reconciling intercompany balances, subsidiaries, and quarter-end versus average balances. Preserve the filing date, reporting form, and amendments. ([FR Y-9C](https://www.federalreserve.gov/apps/reportingforms/Report/Index/FR_Y-9C), [FFIEC Call Report instructions](https://www.ffiec.gov/sites/default/files/data/reporting-forms/FFIEC031_FFIEC041_202606_i.pdf))
2. **Rebuild earnings and rate sensitivity.** Separate GAAP net income, net interest income, tax-equivalent NII, fee/trading revenue, provision for credit losses, and expenses. Calculate NIM only on a consistent basis: NII over average interest-earning assets, with annualization and tax-equivalent treatment stated. Bridge NII through average balances, yields/costs, asset/liability mix and repricing. Treat management NII/EVE rate shocks as scenario outputs whose deposit-beta, balance-sheet-growth, and curve assumptions matter; cumulative deposit beta is analyst-calculated, so declare the benchmark, window and rate denominator. ([Fed bank-conditions report](https://www.federalreserve.gov/publications/2026-june-supervision-and-regulation-report-report-banking-system-conditions.htm), [Fed review of deposit assumptions](https://www.federalreserve.gov/publications/2023-April-SVB-Supervision-of-SVBFG-by-Critical-Risk-Areas.htm))
3. **Map funding by price and stability.** Track average and period-end deposits by interest-bearing status, product, insured/uninsured estimate, concentration, and customer segment. Add deposit costs, CDs, brokered deposits, FHLB and other wholesale funding, and any shift to money funds or other yield alternatives. Separate the bank subsidiary from holding-company liquidity and report uninsured deposits with the source definition; do not use a single average deposit rate to infer every customer's repricing behavior.
4. **Separate reserve building from realized credit loss.** By loan class, track balances/originations, delinquencies, nonaccruals, criticized/classified loans where disclosed, provision, net charge-offs, and the allowance roll-forward. Calculate allowance-to-loan and allowance-to-net-charge-off measures only with a stated denominator and period. For CRE, split office, multifamily and other property types; follow maturities, extensions, updated collateral values, LTV/DSCR and refinancing terms where disclosed, using [OCC CRE refinancing guidance](https://www.occ.treas.gov/news-issuances/bulletins/2024/bulletin-2024-29.html) as a supervisory risk lens. For cards and auto, separate vintages, score bands, delinquency roll rates and loss curves.
5. **Do not equate CECL allowances with IFRS 9 expected-credit-loss stages.** CECL estimates lifetime expected losses for in-scope amortized-cost assets; IFRS 9 distinguishes 12-month ECL at Stage 1 from lifetime ECL after significant credit-risk increase and for credit-impaired assets. Compare allowance levels only after checking staging, scenario weighting, write-off policy, acquired loans, portfolio mix and migration. ([FDIC CECL policy](https://www.fdic.gov/news/financial-institution-letters/2023/fil23017.html), [IFRS 9](https://www.ifrs.org/content/dam/ifrs/publications/pdf-standards/english/2024/issued/part-a/ifrs-9-financial-instruments.pdf?bypass=on))
6. **Normalize regulatory capital and securities marks.** Show CET1 dollars and ratio with the risk-weighted-asset denominator, applicable firm-specific stress capital buffer, GSIB/other surcharges, and headroom to binding requirements. Add the supplementary leverage ratio when relevant. Show GAAP equity/AOCI beside regulatory capital and verify whether the bank elected the AOCI opt-out; unrealized available-for-sale marks may not enter CET1 for an eligible opt-out firm. Tie dividends and repurchases to capital headroom, stress-test results and net share count, not authorization alone. ([Federal Reserve large-bank capital requirements](https://www.federalreserve.gov/supervisionreg/large-bank-capital-requirements.htm), [AOCI regulatory adjustment](https://www.federalreserve.gov/frrs/regulations/section-21722-regulatory-capital-adjustments-and-deductions.htm))
7. **Distinguish regulatory liquidity from usable cash.** Report LCR and NSFR only where the firm is in scope and publishes them. LCR addresses a defined 30-day stress outflow; NSFR is a one-year structural funding measure. Pair either with unencumbered HQLA, legal-entity location, deposit concentration, collateral already pledged, and contingent funding capacity. Neither ratio is a forecast of a particular run or a complete measure of liquidity available to shareholders. ([Federal Reserve LCR FAQs](https://www.federalreserve.gov/supervisionreg/topics/liquidity-coverage-ratio-faqs.htm), [NSFR rule](https://www.federalreserve.gov/frrs/regulations/section-249100-net-stable-funding-ratio.htm))

## 10. Catalysts, risks and falsification

| Claim | Evidence supporting | Evidence against | What would resolve it? | Date / source |
|---|---|---|---|---|
| [Thesis driver] | [ ] | [ ] | [ ] | [ ] |
| [Key risk] | [ ] | [ ] | [ ] | [ ] |
| [Catalyst] | [ ] | [ ] | [ ] | [ ] |

**Thesis break condition:** [Observable that would materially weaken the case]  
**Next checkpoints:** [Earnings, filing, product launch, debt maturity, regulatory decision, competitor data]  
**What is already reflected in expectations?** [Estimate revisions, price reaction, valuation, positioning if observable]  
**Unobservable or licensed information:** [Customer-level churn, private contracts, channel inventory, private-credit terms, etc.]  
**Proxy used and bias:** [ ]

## 11. Final analyst conclusion

**Business quality:** [ ]  
**Financial resilience:** [ ]  
**Valuation / expectations:** [ ]  
**Timing / catalyst:** [ ]  
**Best opposing case:** [ ]  
**What would change my mind:** [ ]  
**Forecast IDs:** [Link to forecast ledger and resolution rules]

Keep facts, calculations, estimates, interpretations and forecasts distinct. A company can be operationally strong while its shares are overvalued, or operationally weak while its credit has sufficient asset coverage; state which security and claim the evidence concerns.

## Sources and reference points

- [SEC EDGAR API documentation](https://www.sec.gov/search-filings/edgar-application-programming-interfaces) — company submissions and structured facts; validate against filing text and footnotes.
- [SEC: How to Read a 10-K](https://www.sec.gov/answers/reada10k.htm) — filing sections and core disclosures.
- [SEC: Using EDGAR to Research Investments](https://www.sec.gov/search-filings/edgar-search-assistance/using-edgar-research-investments) — filing types and what they contain.
- [FASB Accounting Standards Codification](https://www.fasb.org/standards) — authoritative nongovernmental US GAAP source; access terms may apply.
- [CFA Institute Financial Statement Analysis](https://www.cfainstitute.org/en/programs/cfa/curriculum/study-sessions/financial-statement-analysis) — structured study curriculum; use as a secondary framework, not as source evidence about an issuer.

## Review checklist

- [ ] Filing dates, periods, currencies, units, amendments and restatements are correct.
- [ ] XBRL/API facts were checked against statements, dimensions and footnotes.
- [ ] GAAP results and analyst adjustments are separate and reconciled.
- [ ] Cash conversion, working capital, capex, SBC and dilution are addressed.
- [ ] Debt maturities, covenants, restrictions and downside liquidity are reviewed.
- [ ] Sector metrics fit the business and are defined consistently.
- [ ] Valuation assumptions are explicit, scenario-based and compared with current expectations.
- [ ] Strongest counterargument and falsification condition are stated.
- [ ] Filing-backed claims link to the exact filing, not just an issuer home page.
- [ ] Forecasts have timestamps, probabilities, resolution rules and later scores.
