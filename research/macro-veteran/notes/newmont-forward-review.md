# Newmont Q3-equivalent cash-flow review

Reviewed 8 November 2026. Read-only review of the input JSON, source filings, builder, and exported workbook. No workbook, source data or deliverable was changed by this review.

## Conclusion

No financial arithmetic blocker found in the stated Q3-equivalent sensitivity. The two requested interpretations are correct:

- A $100/oz gold-price increase adds **$79.6838 million** to consolidated operating cash flow and FCF under the model's 6% price-linked charge proxy and 30% incremental cash-tax response. Reported-replay FCF becomes **$1,991.6838 million**.
- Setting other operating cash changes to zero adds **$309 million**, retains **$256 million** of cash reclamation/remediation, and gives CFO of **$3,077 million** and FCF of **$2,221 million**. This is an illustrative net-change assumption, not evidence of a sustainable future cash-flow level.

The revised workbook's source references are usable: source labels identify S1/S2 and six Excel Notes preserve the complete SEC URLs on related numeric inputs. There are no HYPERLINK formulas remaining in the revised import.

## Independent calculations

All amounts below are USD millions except the stated gold price.

| Calculation | Q3 2026 | Nine months ended September 2026 |
|---|---:|---:|
| Consolidated net income | 2,514 | 8,093 |
| Total noncash adjustments | 819 | 2,241 |
| Before operating-asset/liability changes | 3,333 | 10,334 |
| Reclamation/remediation cash change | (256) | (714) |
| Other operating-asset/liability changes | (309) | (143) |
| Operating cash flow | 2,768 | 9,477 |
| Consolidated cash capital additions | (856) | (2,216) |
| Company free cash flow | **1,912** | **7,261** |

For the $100/oz increase, 1.211 million consolidated sold ounces multiply the price change directly into millions of dollars: 1.211 × $100 = $121.1 million gross. The assumed charge is 6% × $121.1 million = $7.266 million. The remaining $113.834 million pays assumed cash tax of $34.1502 million. The after-tax increment is $79.6838 million.

The other-cash-change balance is -318 -172 +9 -22 +29 +165 = -309. The source's complete -565 operating-asset/liability change also includes -256 of closure cash. The model removes the net -309 when requested and retains the closure deduction. It does not add back the whole -565.

## Meaning of the assumptions

1. **Cash versus accounting.** The build correctly starts with consolidated net income and reverses the noncash cash-flow-statement adjustments. The $190 million noncash reclamation adjustment is distinct from the $256 million actual reclamation/remediation cash use. The latter remains deducted. The release's 9M impairment of $13 million plus other noncash adjustments of $157 million reconcile to the 10-Q's combined $170 million line.

2. **Ownership and capital perimeter.** The model uses consolidated CFO, 1.211 million consolidated gold ounces sold, and $856 million cash-statement capital additions. It does not substitute $879 million of attributable capital or deduct AISC on top of the cash bridge. This preserves the intended company FCF perimeter. Consolidated FCF cannot be treated as a direct estimate of cash distributable to common shareholders.

3. **Tax asymmetry.** The 30% rate is an analyst assumption about incremental cash payments. It is not the company's 33% adjusted accounting tax-rate guidance. With the downside-relief fraction at zero, a $100/oz decline reduces cash by $113.834 million, rather than $79.6838 million, because there is no immediate tax saving. Positive and negative price sensitivities must therefore be described separately. Cost changes are taxed through the same net incremental pretax amount.

4. **Price-linked charges.** The earnings release explicitly excludes approximately $6/oz of royalty, production-tax and workers-participation effect for every $100/oz gold-price change from its pretax sensitivity. Converting that rule to a 6% quarterly gross-revenue sensitivity at fixed sold ounces is an exposed analyst assumption. The model does not misuse the annual $505 million sensitivity as quarterly cash or divide it by four.

5. **Price and settlement.** The $4,291/oz anchor is the reported average before provisional MTM; $4,317/oz includes the reported $26/oz MTM contribution. The model preserves reported baseline CFO/FCF and applies an incremental price shock. It does not rebuild all revenue as exact price times rounded ounces, or remove the historical $31 million MTM contribution a second time. The 10-Q explicitly describes provisional concentrate sales subject to final pricing over subsequent months. Full within-quarter cash pass-through is therefore an assumption, not a filing fact.

6. **Other cash changes.** Setting the net change to zero also removes favorable offsets from tax accruals and other accrued liabilities. It does not assert that every component is transitory or that each returns to zero. It supplies no independent forecast of collections, inventory, taxes or payments.

7. **Break-even and valuation.** The reported-replay local cash break-even of $2,611.3612/oz is mathematically correct with the selected zero downside tax relief. The other-cash-change-zero case gives $2,339.9133/oz. Both are extrapolations of this local model with fixed operations and spending. Neither measures mine economic cost, sustainable corporate break-even, equity fair value or a share-price target. No unsupported equity valuation claim was identified in the workbook content reviewed.

## Checks actually performed

- Read the builder and input JSON and independently recomputed the Q3/9M bridges in JavaScript.
- Verified both local source-file SHA-256 values against the JSON source manifest; both matched.
- Opened both referenced SEC URLs successfully and checked the relevant filing/release passages against the local source content.
- Imported and recalculated the initial exported workbook in the bundled artifact calculation engine without exporting it. Independently checked reported replay, +$100 gold, -$100 gold, other-cash-change-zero, stress-case FCF and the sensitivity table's base cell. Results agreed with the calculations above. Stress-case FCF was $767.57306 million.
- Imported and recalculated the revised exported workbook. Confirmed its SHA-256 is `fc109d047bf7c222c2ff98544515a9302d98e1f82aee8466cb8fde4713b579ff`, selected replay remains case 1, and FCF remains $1,912 million. Confirmed the revised import contains no HYPERLINK matches.
- Read the revised XLSX's serialized Excel Notes directly. Notes on `Actuals!F8`, `G8`, `G14`, `F29`, `G29` and `F39` contain the correct complete SEC URLs and contextual source descriptions. The first numeric inputs correctly hold 2,514; 8,093; 13; 1.211; 3.638; and 505, respectively.

The workbook was not opened in desktop Excel during this review. This review does not independently establish desktop Excel calculation behavior or visual layout; the parent task is handling its export/native-feature and visual checks.

## Direct primary sources

- [Newmont Form 10-Q for the period ended 30 September 2026](https://www.sec.gov/Archives/edgar/data/1164727/000116472726000043/nem-20260930.htm): cash-flow statement, gold sales and realized-price bridge, and trade receivables/provisional sales.
- [Newmont Q3 2026 earnings release, SEC Exhibit 99.1](https://www.sec.gov/Archives/edgar/data/1164727/000116472726000041/newmontq32026earningsrelea.htm): quarterly cash-flow statement, FCF reconciliation, annual assumptions/sensitivities and excluded price-linked charges.
