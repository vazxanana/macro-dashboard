# NBU accounting gold: legal clocks, frozen valuations and misleading date counts

The NBU route has affirmative open-data permission and a usable historical response, but its accounting valuations require their own dated methodology. The new audit found an explicit wartime metals freeze, a delayed clock-change commencement and a full-day metals carryover alongside a USD-regime change. These findings materially qualify the earlier historical-baseline description.

This is a metadata and methodology case. The preserved 2022–2024 numerical XAU response remains analytically uninspected; no price equality, returns, FX back-conversion or trading result was calculated. The current source library is not proof of original historical publication or immutable first-delivery bytes. NBU's permission for its accounting output does not grant rights to Bloomberg/LBMA source feeds. [NBU Open Data](https://bank.gov.ua/en/open-data).

## Material chronology

| Rule or transition | Verified source meaning | Research implication |
|---|---|---|
| Before 4 January 2022 | The prior consolidation uses a 15:30 Kyiv BFIX observation and publication by 16:00. Amendment 127 was adopted in November 2021 but commenced on 4 January 2022. | A document's adoption or consolidation date does not establish when its amended clocks apply. |
| Year-end carryover | Resolution 142 carries the valuation calculated 30 December 2021 through 31 December–4 January inclusive. | The effective valuation on 4 January need not be that day's newly calculated value. |
| From 4 January 2022, absent an override | Amendment 127 changes the BFIX clock to 15:00 and the website deadline to 15:30, Kyiv local time. | Keep quotation, calculation, publication and effectiveness separate. The actual quote may instead use a permitted fallback. |
| 24 February signing → 21 March publication | Amendment 21 explicitly freezes metals accounting valuations as well as official FX/SDR at the levels effective 24 February. Amendment 58 subsequently restores metals calculation under Regulation 148 using the fixed official USD input. | Do not call every advancing date label a fresh gold-market observation. Exact signing/publication hours and the first fresh effective valuation remain unknown. |
| 21 July 2022 | The USD reset applies from 09:00 while the metals valuation calculated 20 July remains effective throughout 21 July. | Official FX and accounting gold can have different transition timing even on the same labelled date. |
| 3 October 2023 | Amendment 121 removes the fixed-USD clause and its qualifier on metals calculation. | Preserve the official USD-input regime as a separate component of the valuation method. |
| 1 November 2024 | Amendment 115 removes the electronic-mail subscriber-distribution requirement. | That distribution-channel change does not change the website deadline or establish when an individual user received a value. |

Primary sources: [prior Regulation 148 consolidation](https://bank.gov.ua/admin_uploads/law/Regulation_10122019_148_07102020.pdf), [amendment 127](https://bank.gov.ua/admin_uploads/law/30112021_127.pdf?v=19), [Resolution 142](https://bank.gov.ua/admin_uploads/law/16122021_142.pdf?v=4), [amendment 21](https://bank.gov.ua/admin_uploads/law/24022022_21.pdf?v=14), [amendment 58](https://bank.gov.ua/admin_uploads/law/21032022_58.pdf?v=11), [amendment 154](https://bank.gov.ua/admin_uploads/law/21072022_154.pdf?v=5), [amendment 121](https://bank.gov.ua/admin_uploads/law/02102023_121.pdf?v=19), [amendment 115](https://bank.gov.ua/admin_uploads/law/13092024_115.pdf?v=8). Exact pages, paragraphs, commencement evidence and unknown boundaries are preserved in `work/nbu-gold-method-version-audit.json` and its companion note. This is a descriptive source audit, not a legal opinion.

The standing method combines an official UAH/USD input with a gold quotation; a latest-available LBMA/information-system price can replace unavailable BFIX. The two-decimal precision rule does not specify a tie-breaking algorithm in the inspected text. A scheduled local clock is not proof that a fresh quote existed or that publication occurred precisely at that instant. [2024 consolidation](https://bank.gov.ua/admin_uploads/law/Regulation_10122019_148_13092024.pdf?v=12), III §§8–13.

## What the date-only audit establishes

A projection replaced every JSON numeric token with a constant without numeric conversion or output, then retained only the two date strings. It found 1,096 effective-date labels and 781 distinct `calcdate` labels, with 315 additional rows sharing calculation labels. All effective dates are delivered, but neither row count is a count of independent fresh gold prices.

The only absent Monday–Friday calculation labels between the observed calculation endpoints are 31 December 2021, 3 January 2022 and 7 January 2022. A Saturday label occurs on 12 March 2022. Monday–Friday is an audit reference, not an authenticated banking or quotation calendar; the date labels alone do not explain those exceptions or authenticate actual calculations.

Two date-only examples show why effective-date alignment matters:

- `calcdate` 1 February 2024 maps to effective labels 2–4 February; `calcdate` 2 February maps to 5 February.
- `calcdate` 20 July 2022 maps to 21 July; `calcdate` 21 July maps to 22–24 July.

The ordinary legal rule preserves the valuation already effective before nonbusiness days, while the new calculation on the final business day starts on the next business day. The displayed calendar date therefore cannot be treated as a same-day market close. Labels also advance during the documented freeze. No equality or freshness of numeric prices was tested.

**Inference, not a calculated result:** dividing the metals valuation by an official USD series matched only on the effective-date label could combine the carried metals value with a changed FX regime on 21 July. The legal timing supports this mismatch risk; no reconstructed USD price or numerical artefact was computed.

## Banking calendars are another layer

Resolution 142 planned bank-workday transfers in March and June 2022. Later official NBU notices identify 25 April, 2 May and 9 May as bank working days during martial law. Their SEP bank-day conventions do not establish fresh gold quotations on every payment-processing day. A fixed peacetime holiday calendar is insufficient. [April notice](https://www.kmu.gov.ua/news/rozyasnennya-nbu-yak-pracyuvatimut-sep-ta-banki-25-kvitnya), [May notice](https://www.kmu.gov.ua/news/informaciya-nbu-shchodo-roboti-sep-ta-bankiv-2-ta-9-travnya).

## Remaining gates

The range API's precise field meanings, original schema availability and revision history need separate evidence. Definitions from another endpoint must not be borrowed simply because fields look similar. A current response, file timestamp or service field is not an authenticated historical publication clock. The paired API audit in `work/nbu-api-date-contract-audit.md` records what its documents actually establish.

A later study must specify the NBU accounting construct, align the applicable input/calculation/effective dates, handle the frozen period and dated exceptions, identify stale/fallback quotation risk, and retain publication/vintage uncertainty. It cannot silently substitute this series for a USD spot price, GLD close/NAV or an intraday CPI reaction. Full daily exception coverage, quote-source age, rounding ties and original receipts remain unresolved.

The [bounded validation record](nbu-gold-metadata-validation-2026-11-09.json) binds the source bodies, clause/render evidence, independent four-amendment review, partial API contract and date-only projection. It does not close the remaining field, calendar or vintage gates.

The raw price file remains outside the assistant package under the existing data-quality boundary. The date projection and legal-source evidence can be shared with source attribution. Source: [National Bank of Ukraine Open Data](https://bank.gov.ua/en/open-data). Selection, English interpretation and calendar arithmetic are independent MeridianX research modifications; source wording controls. Earlier delivered ZIPs and the real CPI pilot remain unchanged.
