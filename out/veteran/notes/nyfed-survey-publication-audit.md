# NY Fed survey publication clocks

Metadata audit, 9 November 2026. Sources and receipts are recorded in the companion JSON and `work/raw/nyfed-survey-clocks/`. This work computes no forecasts, errors or returns. The two spreadsheet responses were hashed and discarded without opening ZIP contents, worksheets or cells.

## Finding

**Premeeting survey collection does not make the collected answers public before the meeting.** The NY Fed posts questionnaires when distributed, roughly two weeks before the FOMC meeting; aggregate results/data follow about three weeks after the meeting, after its minutes. These are publication policies, not exact historical receipt timestamps. The current page also warns that some result appendices contain postmeeting updates. [Current survey and archive](https://www.newyorkfed.org/markets/market-intelligence/survey-of-market-expectations).

The captured archive at **07:56:49 UTC on 9 November 2026** lists October 2026 Questions but no October Results/Data links. September 2026 is the latest row with Results/Data links. This describes the captured page, not global proof that no unlisted object existed.

## Concrete clocks

| Cycle / instrument | Distribution and response evidence | FOMC meeting | Public results/data evidence |
| --- | --- | --- | --- |
| September 2026 SME | Results header: distributed 2 September; received by 8 September. Questionnaire requested replies by 14:00 EDT on 8 September. | 15–16 September | Currently accessible and hashed. General policy points to around 7 October after minutes; exact original NY Fed PDF/XLSX publication times remain unknown. |
| October 2026 SME | Questionnaire requests replies by 14:00 EDT on 19 October; question 5 refers to its release around 14 October. The latter is document context, not an original delivery receipt. | 27–28 October | Only questionnaire linked in the captured current row. No aggregate October answers inferred. |
| September 2024 SPD and SMP | Both result headers: distributed 4 September; received by 9 September. Both questionnaires request replies by 14:00 EDT on 9 September. | 17–18 September | Prior PDF publication is established by the 10 October format announcement, without exact first-public times. Spreadsheet and new Combined releases were announced on 10 October. |

These collection dates and deadlines come from the [September 2026 results](https://www.newyorkfed.org/medialibrary/media/markets/survey/2026/sep-2026-sme-results.pdf), its [questionnaire](https://www.newyorkfed.org/medialibrary/media/markets/survey/2026/sep-survey-sme.pdf), the [October questionnaire](https://www.newyorkfed.org/medialibrary/media/markets/survey/2026/oct-survey-sme.pdf), and the September 2024 [dealer results](https://www.newyorkfed.org/medialibrary/media/markets/survey/2024/sep-2024-spd-results.pdf), [participant results](https://www.newyorkfed.org/medialibrary/media/markets/survey/2024/sep-2024-smp-results.pdf), [dealer questions](https://www.newyorkfed.org/medialibrary/media/markets/survey/2024/sep-survey-pd.pdf) and [participant questions](https://www.newyorkfed.org/medialibrary/media/markets/survey/2024/sep-survey-mp.pdf). “Received by” is a date label; a requested deadline is not every firm's actual submission timestamp.

The Federal Reserve's minutes announcements specify **7 October 2026 at 14:00 EDT** and **9 October 2024 at 14:00 EDT**, respectively. Those are minutes-release clocks. They do not establish that NY Fed results appeared at the same instant. [2026 announcement](https://www.federalreserve.gov/newsevents/pressreleases/monetary20261007a.htm), [2024 announcement](https://www.federalreserve.gov/newsevents/pressreleases/monetary20241009a.htm).

## Format backfill and instrument change

On **10 October 2024**, the NY Fed announced machine-readable files covering **July 2023–September 2024**. It described legacy dealer/participant values as already public in PDFs; the accompanying article identifies Combined aggregation as newly available. Therefore a file carrying a 2023 survey date was not necessarily an available 2023 spreadsheet, and an earlier subgroup PDF is not evidence that a Combined aggregate was already public. Numerical PDF/XLSX equality was not tested here. [Format announcement](https://www.newyorkfed.org/markets/opolicy/operating_policy_241010), [NY Fed explanation](https://tellerwindow.newyorkfed.org/2024/10/10/a-new-view-of-our-monetary-policy-expectations-surveys/).

The predecessor instruments remained separate through 2024. The merger announcement is dated **13 January 2025**, effective with questionnaire distribution on **15 January**. Existing participants continued, while the nondealer panel expanded; subgroup breakdowns remained available, and firm lists moved into cycle-specific results PDFs. Historical Combined data and later SME data therefore need explicit instrument/panel labels. [Merger announcement](https://www.newyorkfed.org/markets/opolicy/operating_policy_250113), [FAQ](https://www.newyorkfed.org/markets/market-intelligence/survey-of-market-expectations/faqs-survey-of-market-expectations).

## Dictionary implications

- Separate collection date, response deadline, meeting dates, minutes release, format-specific first-public availability and current retrieval. Leave unsupported original timestamps null.
- Preserve SPD/SMP/SME, dealer/nondealer/Combined, questionnaire version, response phase and panel version. Keep postmeeting appendices outside a premeeting information set.
- Store target, horizon, units, question text, bins and aggregation separately. A median of respondents' modal points differs from averaged elicited probabilities. Invited firms, actual respondents and item/horizon completeness also differ. Questionnaire placeholders are not forecasts.
- A dated response window supports historical-expectations research. Public as-of use requires public-availability evidence for the particular result/version. The survey is not automatically monthly CPI consensus or a market-implied price.

The capture set contains **21 successful source receipts**: 19 retained HTML/PDF bodies with verified hashes and two XLSX body hashes without workbook parsing. Failed ordinary-network attempts are retained as failures. Current receipts establish access and identify the served versions; they do not authenticate immutable original bytes, first historical publication or per-respondent issuance. No existing research artifact or ZIP was changed.
