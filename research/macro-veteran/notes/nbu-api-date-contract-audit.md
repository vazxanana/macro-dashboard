# NBU API date and field contract: bounded audit

**The historical field-to-clock contract remains incomplete.** The official documents support explicit historical queries and identify a UAH accounting-valuation construct, but the reviewed range instructions do not define every output field or its historical timing. Do not infer a publication timestamp from `calcdate`, or a normalization formula from `rate_per_unit`.

This audit read static documentation and the existing date/schema and date-only projections. The protected gold-price response stayed closed. No prices, numeric API sample values, returns, model errors or back-conversions were inspected or computed. Five fresh official static documents were captured with receipts and verified hashes under `work/raw/nbu-api-date-audit/`; sample numbers were redacted before display. The parallel legal-version audit is a separate source of evidence.

## Supported mappings and remaining gaps

| Item | Supported evidence | Limit |
| --- | --- | --- |
| Range `exchangedate` | The instructions name this sorting field and describe results sorted by exchange-rate date. | A rate-date label is not an original-publication timestamp. A complete effective-date mapping for every 2022–2024 date still needs dated-rule reconciliation. |
| Range `calcdate` | Present in current output examples and the date-only profile. | No explicit range-field prose definition found. The name and label patterns do not prove calculation, quotation, publication or revision time. |
| `rate` / `rate_per_unit` | Both appear in range examples. | The precise denominator/formula is not defined in the reviewed range instructions. Neither division by `units` nor equality of the fields for XAU was tested or assumed. |
| `units` | Current profile reports a quantity of 1. The classifier/template caption specifies troy-ounce quantities and lists XAU as 1; the price-page heading specifies UAH. | This corroborates the accounting construct. It does not alone bind every range field or establish the applicable classifier for every historical date. |
| `special` | Current manual says the field was added on 21 January 2026 for USD calculation conditions. | It is not a gold-market normality flag. Nulls in historical XAU records are not missing prices or proof of normal historical conditions. |

Sources: [range instructions](https://bank.gov.ua/admin_uploads/article/Instr_API_KURS_VAL_data_Full_eng.pdf), [current developer manual](https://bank.gov.ua/en/open-data/api-dev), [unit-list document](https://bank.gov.ua/admin_uploads/law/26042022_260-no.pdf?v=4), [accounting-price heading](https://bank.gov.ua/en/markets/exchangerates-metal). The classifier page inspected is template-labelled; its legal period of applicability is not established by this field audit.

## Separate endpoints have separate contracts

The linked [single-date instructions](https://bank.gov.ua/admin_uploads/article/Instr_API_KURS_VAL_Full_eng.pdf) document a **different** signing-file route, `NBU_Exchange/exchange`, using `date=dd.mm.yyyy`. Its schema defines `StartDate` as the setting date, `Units` as quantity/scale, and `TimeSign` as **service information for the site**, with an unsigned-byte type. `TimeSign` is not documented as a publication timestamp.

That PDF also documents `NBUStatService/.../exchangenew`, with `date=YYYYMMDD`, as information generated at setting date. Neither route establishes the range endpoint's `calcdate`/`exchangedate` mapping. Preserve endpoint identity and parameter formats rather than aliasing similarly named fields.

The range instructions use `start/end=YYYYMMDD`, currency/metal selection and sorting parameters. Explicit dates avoid the moving current-date selection; they do not supply an as-of vintage. No data endpoint was called in this audit.

## Current instructions are not contemporaneous 2022–2024 evidence

The current manual says current-day information displays the current business day before **3:30 PM** and the next business day afterward. That paragraph does not specify its timezone or document every historical exception. It cannot become a uniform historical publication clock. The same section's **4 November 2026** update concerns the noon EUR reference rate, not a gold quotation clock. [Developer manual](https://bank.gov.ua/en/open-data/api-dev).

The captured English and Ukrainian range PDFs carry creation/modification metadata dated **24 March 2026**. Those file properties are not authenticated first-publication or API-introduction dates. Their examples also differ: English omits `special`; Ukrainian includes it. These observations justify versioning the documents, not claiming that the entire current schema existed in 2022–2024 or that historical numeric values were revised. [Ukrainian instructions](https://bank.gov.ua/admin_uploads/article/Instr_API_KURS_VAL_data.pdf).

## Calendar evidence and the next bounded audit

The date-only projection reports **1,096 `exchangedate` labels and 781 distinct `calcdate` labels**, with label gaps of 1–5 days. The absent Monday–Friday calculation labels between endpoints are 31 December 2021, 3 January 2022 and 7 January 2022; a Saturday label exists on 12 March 2022. A 7 March label also exists, so a prewar planned workday-transfer calendar cannot stand in for observed publication metadata.

The first in-window group attaches 30 December 2021 to labels 1–4 January 2022. Its left edge is truncated by the request. Repeated labels do not prove equal prices, fresh underlying quotations or 781 independent observations. No price equality was checked. Date-only projection SHA256: `e0dc4dd1ddf57c489689368e3528e524efb0ff4da44cc0276ec64ab8a37f1906`.

A later calendar audit needs an explicit endpoint/field dictionary; applicable dated rules and NBU operational exceptions; separate quotation, setting, effective and publication clocks; documented timezone handling; and a fixed treatment of window edges and unresolved carryovers. Original release/signed-file evidence and correction handling are needed for point-in-time claims. Current retrieval receipts, PDF metadata and date labels do not supply them.

The companion JSON records supported mappings, unknowns, source hashes and the later audit requirements. No prior artifact or frozen ZIP was changed. NBU documents are the primary sources; selection, paraphrases and numeric redactions are researcher modifications, not NBU endorsement.
