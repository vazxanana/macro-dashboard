# Newmont cash-flow model: independent design review

Reviewed 8 November 2026. Owned artifact: this note only. Source readings were checked directly in the official Q3 release and SEC 10-Q; the earlier peer case was used as a locator. No registered forecast, master output or frozen V1 was changed.

## Recommendation

Build a **Q3-equivalent conditional consolidated cash-flow sensitivity**, anchored to an exact historical reconciliation. Add a separate panel for management's full-year sensitivities. Do not turn quarterly arithmetic into a Q4 forecast or intrinsic equity valuation without the missing ownership, cash-tax, capital and timing schedules.

## Verified source anchors

| Q3 2026, USD millions unless stated | Value |
|---|---:|
| Company CFO before operating-asset/liability changes | 3,333 |
| Total operating-asset/liability cash use | 565 |
| Included cash reclamation spend | 256 |
| GAAP CFO | 2,768 |
| Consolidated cash additions to PP&MD | 856 |
| Company FCF | 1,912 |
| Attributable capital expenditures, a different basis | 879 |
| Consolidated gold sold, million oz | 1.211 |
| Realized gold, USD/oz, including provisional MTM | 4,317 |
| Before provisional MTM, USD/oz | 4,291 |

[Official release and reconciliations](https://www.newmont.com/investors/news-release/news-details/2026/Newmont-Reports-Third-Quarter-2026-Results-with-Record-Third-Quarter-Adjusted-Net-Income-Positioned-to-Achieve-Full-Year-Guidance-Provides-Update-on-Red-Chris-Block-Cave-Project/default.aspx), [SEC 10-Q, operating results and MD&A](https://www.sec.gov/Archives/edgar/data/1164727/000116472726000043/nem-20260930.htm).

The release's full-year sensitivity is **$505m pretax per $100/oz gold**, excluding an approximately **$6/oz royalty, production-tax and worker-participation cost response per $100 gold**. Oil exposure is **$60m direct plus $50m indirect per $10/bbl**. Adjusted tax-rate guidance is **33%**, which is not a disclosed marginal cash-tax response. These are separate annual guidance measures, not quarterly cash outcomes.

## Historical bridge and the important normalization trap

The source arithmetic is:

```text
3,333 CFO before company-defined operating-asset/liability changes
 -256 cash reclamation
 -309 remaining operating-asset/liability cash movement [calculated residual]
=2,768 reported CFO
 -856 consolidated cash capital additions
=1,912 company FCF
```

Subtracting $879m attributable capex from consolidated CFO gives the wrong FCF. Its difference from $856m is not an error to plug: the release explicitly distinguishes attributable capital excluding capitalized interest from the consolidated cash-flow line.

Calling $3,333m “normalized sustainable CFO” would erase actual closure cash. A timing-neutral scenario that holds the **other** operating-asset/liability movement at zero but retains reclamation produces $3,077m CFO and $2,221m FCF at unchanged capex. Those are analyst conditional calculations, not company-normalized forecasts. Nor is $256m automatically a sustainable future run rate. Keep this driver visible and distinguish closure-project spending from ordinary receivables/inventory timing.

The separately discussed receivable, inventory, accrual and tax movements do not fully sum to the headline cash-use bucket. Preserve the residual rather than forcing a reconciliation. A model should tie to the complete statement while showing any selected explanatory components.

## Suggested calculation flow

1. Keep historical reported values and company definitions immutable in a source area.
2. Use a single scenario build in USD millions. Hold consolidated sold ounces fixed initially; attributable production, equity-method output and “gold equivalents” cannot replace this denominator.
3. Enter a **change** in realized gold price from the historical anchor. Revenue effect is `1.211 × price change` because volume is million ounces. Do not multiply by 1,000 or divide by 1,000 again.
4. Show incremental royalty/profit-sharing cost separately. Applying the company's approximate $6/oz coefficient to this quarter-equivalent volume is an **analyst extrapolation** from annual guidance, not a disclosed exact quarterly cash schedule. It is local/linear and can fail at country tax and royalty thresholds.
5. Apply a clearly labeled assumed incremental cash-tax response to the incremental pretax effect. A default borrowed from 33% adjusted ETR guidance remains an assumption; retain the distinction in the model. Tax-payment timing and usable loss shields can make actual cash taxes asymmetric.
6. Add an independent cash operating-cost delta if used, specifying which exposure it represents. Avoid adding both an oil-derived cost delta and a generic cost delta for the same cost shock.
7. Bring through cash reclamation, the remaining working-capital movement and **consolidated cash** capex as distinct drivers. Defaults can reproduce the historical quarter; an alternative timing-neutral view can set only other-WC to zero.
8. Calculate CFO and FCF. Do not deduct AISC, CAS, depreciation, cash taxes or sustaining capex a second time from a CFO anchor already reflecting them. AISC already contains sustaining investment and has its own by-product/allocation definitions.

Useful independent arithmetic checks for a +$100 gold move at fixed volume:

```text
Incremental revenue:                   1.211 ×100       =121.10000
Illustrative statutory-cost leakage:   1.211 ×6         =  7.26600
Incremental pretax amount:                              113.83400
At assumed 33% incremental cash tax:   113.834 ×(1−.33)  = 76.26878
```

The final amount is conditional, not a reported cash-flow sensitivity. Lower cash collection within the quarter, provisional receivable remeasurement, price-sensitive accruals or cash-tax lags alter it. The reported realized-price anchor includes non-cash provisional MTM, so it is not a cash-settlement quote. Make the price delta's assumed cash pass-through explicit.

## Keep the annual management panel separate

The issuer's $505m annual gold sensitivity is pretax and excludes specified statutory-cost leakage. Do not label it after-tax FCF, add it to a quarterly CFO anchor, or divide it by four to create a Q4 forecast. Likewise, the annual oil sensitivity is not an observed quarterly cost line. Annualizing the quarter's 1.211Moz and comparing mechanically with the sensitivity's implied volume is not a perimeter reconciliation.

For an annual after-tax sensitivity illustration, retain tax and affected-ounce assumptions separately. Do not automatically multiply the excluded $6 coefficient by 5.260Moz attributable production when the sensitivity's relevant consolidated exposure has not been established. A source-provided gross/pre-tax panel can remain informative even when an exact net-cash translation is unavailable.

## Valuation and equity boundaries

The defensible present outputs are historical CFO/FCF, the accounting bridge, conditional changes and break-even operating assumptions. A share-price target, DCF, enterprise-value multiple or common-equity FCF yield should remain unavailable in this version. They require a matched forward cash-flow perimeter, current share/security price, outstanding-share basis, net-debt/lease policy, minority/equity-investee treatment, reserve/mine-life schedule and capital/reclamation obligations.

Consolidated FCF is not automatically cash distributable to Newmont common holders. Equity-method earnings are not equivalent to cash distributions, and equity-investee contributions can sit outside the company's FCF subtraction. NCI distributions, principal repayments, buybacks and dividends belong in an explicit downstream cash-allocation bridge if modeled. Do not deduct them inside both FCF and an equity bridge.

The planned $1.95bn Barrick payment is a distinct cash allocation after the September balance sheet, not sustaining capex or a recurring operating charge. A mechanical cash-stock deduction holding all other flows constant may be shown as such, but is not a Q4 closing-cash forecast or proof of distributable excess cash. Never also deduct the same payment in a second net-debt/valuation adjustment.

## Weakest inputs and unavailable claims

- Price-to-cash collection timing and provisional settlements are not fully specified by average realized price.
- An effective/adjusted tax rate is not the marginal cash-tax rate or a calendar of payments.
- Aggregate annual royalty coefficients cannot reproduce jurisdiction-specific nonlinear rules.
- Quarterly volume/cost/capex guidance on different ownership bases does not reconcile itself to consolidated cash FCF.
- A working-capital addback is not a finding that the cash will return, and reclamation cash cannot disappear in normalization.
- A static local sensitivity does not prove a predictive gold beta, sustainable run rate, share-price response or investable edge.

These limitations should be stated next to the affected inputs/outputs, not buried only in a final disclaimer. The model is worthwhile because it makes the mechanisms and required assumptions auditable, not because it invents an unsupported valuation.
