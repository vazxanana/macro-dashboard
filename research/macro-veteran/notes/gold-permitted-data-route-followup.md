# Official gold data: permission and historical-access follow-up

Checked 9 November 2026 UTC. Scope: primary-source permissions, access, definitions and a date/schema audit; no gold-value analysis, returns or event statistics.

## Decision

**A concrete alternative exists: the National Bank of Ukraine’s published gold accounting valuation.** Its open-data terms affirm commercial use and combination with other information. A dated NBU regulation also expressly permits residents and nonresidents to use its accounting metals prices in money/foreign-exchange market transactions. These are affirmative publisher statements, rather than permission inferred from a public download.

Keep this as a **separate UAH accounting-reference route**. It does not resolve GLD’s terms, replace GLD close/NAV, supply an executable USD gold spot price, or establish an intraday CPI response. The research question and endpoint would have to change explicitly before using this series. No original GLD endpoint or frozen package was changed.

## 1. NBU permission: research and trading versus redistribution

The current [NBU Open Data page](https://bank.gov.ua/en/open-data) permits unrestricted further use and dissemination; copying, publishing, distribution and use, **“including for commercial purposes”**; combination with other information; and integration into the user’s products. It requires source attribution, including a hyperlink to the data administrator’s open-data page. The reviewed page contains no noncommercial-only limitation or prohibition on statistical transformations. This provides affirmative publisher support for private statistical use of the NBU-published output, including research intended to inform trading. Preserve attribution in local analysis metadata even when nothing is published.

Separately, [Regulation 148, consolidated through 30 November 2021](https://bank.gov.ua/admin_uploads/law/Regulation_10122019_148_30112021.pdf?v=4), §4¹ (printed page 3), permits resident/nonresident use in money/FX-market transactions without obligation. This paraphrases the Ukrainian text; it is not a legal opinion or permission for every financial-product licence.

The open-data permission is broader than mere private saving and is not conditioned on publishing the analysis. Redistribution is a separate action: attribution remains mandatory, but this project will keep the raw numeric response local and outside the assistant skill. NBU’s permission for its published accounting output should not be presented as a licence to obtain, reconstruct or redistribute Bloomberg/LBMA source feeds. No such feed was accessed.

## 2. Concrete access and audited coverage

The [current NBU Developer API manual](https://bank.gov.ua/en/open-data/api-dev), section 1, explicitly includes official exchange rates **and accounting prices of investment metals**, including date-range queries by currency/metal. Its linked [history-query instructions](https://bank.gov.ua/admin_uploads/article/Instr_API_KURS_VAL_data_Full_eng.pdf) describe the `start`, `end`, `valcode`, `sort`, `order` and JSON parameters.

Verified public request, with no account, token or payment:

```text
https://bank.gov.ua/NBU_Exchange/exchange_site?start=20220101&end=20241231&valcode=xau&sort=exchangedate&order=asc&json
```

The endpoint returned HTTP 200 and `application/json; charset=utf-8` on 9 November 2026 at 00:13:50 UTC. The response was 218,193 bytes, SHA-256 `0eabe5b8de70aef8a437ddccf1b5f8d8977944118e46a33b3f3ea15652007143`.

Only dates, field names, types, missingness and unit/metal labels were inspected. Price values were neither printed nor inspected analytically.

| Audit item | Observed result |
|---|---|
| Rows | 1,096 |
| `exchangedate` range | 2022-01-01 through 2024-12-31 |
| Unique effective-date labels | 1,096; no duplicate, missing-calendar or unparseable effective dates |
| `calcdate` range | 2021-12-30 through 2024-12-30 |
| Unique calculation-date labels | 781; calculation dates repeat across effective dates |
| Missing/null `rate` or `rate_per_unit` | None |
| Missing/null `units`, date, code or label fields | None |
| `special` | Null in all 1,096 rows; see schema qualification below |
| Metal labels | `cc = XAU`; English name `Gold` |
| Raw `units` field | Integer `1` throughout; unit name requires publisher documentation |

The full field set is `calcdate`, `cc`, `enname`, `exchangedate`, `group`, `r030`, `rate`, `rate_per_unit`, `special`, `txt`, `units`.

The current API manual says `special` was introduced on 21 January 2026 to indicate special versus normal conditions for calculating the hryvnia/US-dollar rate. Its null history must not be counted as missing gold prices or interpreted as confirmation of normal market conditions in 2022–2024. The current response schema is not proof that all fields were published contemporaneously in that period. No historical revision/vintage audit was performed.

The date audit establishes complete **calendar-date delivery**, not 1,096 independent gold observations. Repeated calculation dates, weekends and holiday carryovers need explicit handling in any later study. A calculation date preceding the requested effective-date window is not itself an error.

## 3. Exact construct, units and clocks

The raw integer `units = 1` specifies a quantity; it does not itself say ounces, grams, hryvnias or dollars. The [NBU metals list approved 26 April 2022](https://bank.gov.ua/admin_uploads/law/26042022_260-no.pdf?v=4), printed page 6, identifies digital code **959**, letter code **XAU**, as gold with a quantity of **one troy ounce**. The [NBU accounting-price page](https://bank.gov.ua/en/markets/exchangerates-metal) labels the money column **UAH** and says the NBU assumes no obligation to buy or sell at the stated prices. Combined with the unit metadata, this identifies a published **UAH valuation per troy ounce of gold**, rather than USD spot or an ETF share. The 2022 list entered into force on 28 April; it is a dated unit-definition corroboration, not a claim that this document alone governs every date in the audit.

The dated [2021 consolidation of Regulation 148](https://bank.gov.ua/admin_uploads/law/Regulation_10122019_148_30112021.pdf?v=4) provides the historical baseline:

- Section I §2(1): Bloomberg BFIX quotations at **15:00 Kyiv time**.
- Section III §8: accounting metals valuation combines the official UAH/USD input with Bloomberg BFIX metals quotations; if unavailable, it uses the latest available LBMA/information-system price.
- §9: metals accounting prices rounded to two decimal places.
- §10: next-business-day effectiveness, with weekend/holiday rules.
- §11: prior-business-day levels may apply when working days are transferred.
- §13: publication by **15:30 on the calculation day**.

These distinguish underlying observation time, calculation/publication date, and effective/carryover date. Keep `calcdate` and `exchangedate` separately. The historical API instructions do not independently define every returned field; the label-to-clock mapping still requires reconciliation against actual dated notices before an event study. In particular, `rate_per_unit` is a returned value field, but its full formula was not independently audited here.

Current API prose says the current-date response changes from current to next business day after 15:30. Use explicit historical dates instead of relying on this moving current-date response. Do not apply a current rule or fixed New York conversion to the full history. The [March 2025 consolidation](https://bank.gov.ua/admin_uploads/law/Regulation_10122019_148_24032025.pdf?v=13) supplies amendment annotations, but a complete wartime and holiday exception audit across 2022–2024 remains outstanding.

## 4. What this can and cannot answer

This route can support a separately specified investigation of **NBU gold accounting valuations** once dates and exceptions are audited. It has an affirmative publisher-use basis and concrete historical access.

It cannot silently stand in for a US close-to-close gold return. The valuation includes an official Ukrainian FX input. The [NBU 2022 annual report](https://bank.gov.ua/admin_uploads/article/annual_report_2022_eng.pdf?v=12) describes the wartime fixed exchange-rate regime and its July adjustment; the [NBU’s 2023 interim financial statements](https://bank.gov.ua/admin_uploads/article/NBU_2023_cfs_9M_eng.pdf?v=14) record the move to managed exchange-rate flexibility from 3 October 2023. That official input may differ from a tradable spot rate. Dividing the gold valuation by another official series would create a derived construct; it would not automatically recover an executable USD price, a consistently timed benchmark, or an independent gold response. **No back-conversion was performed.**

The accounting series also inherits publication lag, rounding, possible fallback quotations and carryovers. Those limits matter even if analysis remains private. No intraday or causal claim follows from daily valuations.

## 5. Bounded comparison: remaining rights gaps

| Route | Exact permission evidence and decision |
|---|---|
| GLD close/NAV | [Issuer terms](https://www.spdrgoldshares.com/terms-and-conditions/) allow personal noncommercial saving but also restrict derivative works and money-making use; the archive adds reproduction/redistribution restrictions. The separate LBMA clauses should not be indiscriminately applied to non-LBMA fields. Private analysis is not rejected merely because redistribution is restricted; the unresolved point is affirmative permission for the intended statistical/trading purpose. See the prior GLD route note. NBU terms do not cure it. |
| Bank of Russia accounting metals | [About the Site](https://cbr.ru/eng/about/), “On information available,” item 2, states information **“cannot be used for commercial purposes either.”** A later section broadly permits reproduction with attribution; that reproduction permission does not erase the separate purpose limitation. Not a clear trading-research route. |
| Swiss National Bank | [Copyright](https://www.snb.ch/en/srv/disclaimer_copyright) permits saving, translation, transmission and other compatible use for noncommercial purposes; outside-source rights remain with their owners. [Liability terms](https://www.snb.ch/en/srv/disclaimer_liability) also say SNB-calculated data are not intended for direct/indirect use with financial transactions. Not selected. |
| NBP gold history | [API manual](https://api.nbp.pl/en.html) documents daily historical gold access since 2 January 2013, a 93-day query limit and a calculated price per gram of 1000-fineness gold. The **currently retrieved** [NBP terms PDF](https://static.nbp.pl/dokumenty/regulaminy/regulamin_nbppl.pdf), §1(6)–(8), permits personal/work saving, copying and printing with source attribution. Its retrieved §1(6) lacks the noncommercial phrase shown in a search snippet. Do not call this a verified commercial-use ban. It does not supply as explicit a grant for statistical transformations/trading as the NBU evidence reviewed here; API subdomain applicability and the gold calculation clock remain unverified. Not classified as forbidden. |

The Bank of England’s [database terms](https://www.bankofengland.co.uk/legal) normally use the Open Government Licence but exclude selected third-party series; its general licence cannot automatically clear a gold series. The Bundesbank’s [general terms §4.1](https://www.bundesbank.de/en/homepage/user-information/conditions-for-the-general-use-of-the-website-764706) allow personal/professional saving and reproduction of its own information while prohibiting alteration/distortion. Neither was promoted to a gold-specific permission finding without resolving source ownership and intended use. No further price downloads were made for these screened alternatives.

## 6. Local evidence and handoff

- Date/schema audit: `work/raw/gold-permitted-route-followup/nbu-xau-date-schema-profile.json`.
- Small source receipts: `work/raw/gold-permitted-route-followup/source-receipts.json`.
- Failed requests, kept separately: `work/raw/gold-permitted-route-followup/request-failures.json`.
- Separate raw numeric response: `work/raw/gold-permitted-route-followup/nbu-xau-2022-2024-uninspected.json`. **Do not package, paste into the skill, or treat as the original GLD primary endpoint.** It is retained for a future authorized audit; values have not been inspected analytically.

The search service returned 403 for NBU documentation while ordinary public requests succeeded with HTTP 200. Archived parliament-page requests timed out; the NBU’s own dated regulation PDFs supplied the methodology evidence instead. A government catalogue entry had stale metadata, a test-labelled underlying datapackage and inconsistent identifiers; it was not used as the decisive licence authority. The affirmative permission finding rests on the NBU’s own current Open Data page and dated regulation.

Before any study, resolve the intended endpoint, calculation/effective-date mapping, wartime/holiday exceptions, contemporaneous availability and revision history. A permission finding is not a completed price-quality or event-study audit.
