# Newmont: reconcile cash first, then vary gold and costs

**As of:** 8 November 2026. The [editable workbook](newmont-cash-flow-2026-11-08/newmont-cash-flow-model.xlsx) reproduces reported Q3 cash flow, then changes explicitly selected assumptions on that same consolidated perimeter. Its scenarios are Q3-equivalent calculations, not Q4 forecasts, sustainable run rates or an equity valuation.

The main finding is that removing Newmont's entire operating-asset/liability cash-use adjustment would erase real reclamation spending. The useful sensitivity also differs from simply multiplying gold prices by attributable production.

## The historical cash bridge

| Q3 2026, USD million | Amount |
|---|---:|
| Cash flow before operating-asset/liability changes | 3,333 |
| Reclamation/remediation cash use | (256) |
| Other operating-asset/liability changes, net | (309) |
| Reported operating cash flow | 2,768 |
| Consolidated cash capital additions | (856) |
| Company free cash flow | 1,912 |

The complete cash-use bucket is $565m, including $256m reclamation. The workbook retains that cash obligation and separately calculates the other $309m from the statement's components. It uses consolidated cash capital additions, rather than $879m of attributable capital on a different basis. The nine-month bridge independently reconciles to $9,477m operating cash flow and $7,261m FCF. [SEC earnings release and reconciliations](https://www.sec.gov/Archives/edgar/data/1164727/000116472726000041/newmontq32026earningsrelea.htm), [Form 10-Q cash-flow statement](https://www.sec.gov/Archives/edgar/data/1164727/000116472726000043/nem-20260930.htm)

## What a $100 gold change means in this model

The fixed denominator is **1.211 million consolidated ounces sold**. The price anchor is **$4,291/oz before provisional mark-to-market**, rather than the $4,317 reported figure that includes $26/oz MTM. This average still is not a cash-settlement quote. The baseline reported cash flow is preserved; the model does not subtract the historical MTM again. [10-Q gold sales and realized-price bridge](https://www.sec.gov/Archives/edgar/data/1164727/000116472726000043/nem-20260930.htm)

Under the default assumptions:

| Incremental effect of +$100/oz | USD million |
|---|---:|
| Gold revenue: `1.211 × 100` | 121.1000 |
| Assumed price-linked charges: `6% × 121.1` | (7.2660) |
| Incremental pre-tax cash amount | 113.8340 |
| Assumed incremental cash tax: `30% × 113.834` | (34.1502) |
| Incremental after-tax cash | **79.6838** |

The 6% charge is an analyst transfer of management's approximate annual $6/oz cost response per $100 gold change to fixed quarterly ounces. The **30% cash-tax response is an illustrative analyst assumption**, distinct from the company's 33% adjusted tax-rate guidance. Full cash realization within the quarter is also assumed. Management's annual $505m pretax gold sensitivity is retained separately; it is not divided by four or treated as quarterly FCF. [Management assumptions, sensitivities and excluded-charge footnote](https://www.sec.gov/Archives/edgar/data/1164727/000116472726000041/newmontq32026earningsrelea.htm)

The default downside tax-relief fraction is zero. Consequently, a **$100/oz decline reduces cash by $113.834m**, rather than $79.684m: the model assumes no immediate cash-tax saving on the decline. The cash-tax response, relief fraction and charge proxy are visible controls. Jurisdictional thresholds, settlement lags and actual tax payments can invalidate this local approximation.

## Three cases, one calculation

Change the numbered selector on **Assumptions**. The same cash-flow build and native two-input sensitivity table recalculate; reported source history stays fixed.

| Case | Selected change | FCF, USD million |
|---|---|---:|
| Reported replay | Original reported inputs | 1,912.0 |
| Other cash change zero | Set only the net other operating-asset/liability change to zero; retain reclamation | 2,221.0 |
| Gold/cost stress | $3,500/oz gold, $100m extra cash operating cost, $1,000m cash capex; other defaults retained | 767.6 |

The second case removes a **net** cash-use amount that includes receivables, inventory, payables, tax accruals and favorable accrued-liability offsets. It does not predict that $309m will reverse or that every component is temporary. The $256m reclamation default is historical spending, not a proven future run rate.

The reported-replay local-model cash break-even is about **$2,611/oz**. It holds other businesses, sold ounces, cash uses and capital spending fixed and assumes the selected tax response. It is neither mine economic cost nor an equity price target. A large gold-price change could alter operations, volumes, tax regimes and spending, breaking those assumptions.

## Evidence and verification

The [input records](newmont-cash-flow-2026-11-08/newmont-cash-flow-inputs.json) preserve units, periods, source codes, completed receipt times and two raw-file hashes. Source URLs also appear in Excel Notes beside related numeric inputs. The annual sensitivity panel remains separate from quarterly actuals. The [verification record](newmont-cash-flow-2026-11-08/newmont-cash-flow-validation.json) covers historical reconciliations, scenario changes, missing-versus-zero inputs, native sensitivity-table behavior, export/reimport and visual review of all three sheets.

Seventeen behavioral checks passed. An independent reviewer recalculated the main cases, checked source hashes and verified the exported source Notes. The workbook was recalculated in the bundled spreadsheet engine; desktop Excel itself was not opened.

This is a levered consolidated cash-flow sensitivity. An equity valuation still needs a forward cash-flow perimeter, noncontrolling and equity-investee cash treatment, capital/closure schedules, mine lives, financing and matched security/share-count inputs. AISC is not subtracted from this CFO anchor because that would duplicate operating costs and sustaining investment already represented elsewhere.
