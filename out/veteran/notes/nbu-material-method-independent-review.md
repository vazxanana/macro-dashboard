# Independent review of material NBU method changes

Reviewed 9 November 2026 UTC. This is a bounded source-verification review, not a legal opinion or a price study. Only saved official NBU PDFs and their local receipt/render metadata were used for the independent findings. No downloads occurred. The raw XAU price JSON was not opened, and no returns, FX levels or back-conversions were computed.

**All four material changes were independently confirmed.** The source reading and findings were saved before the helper audit was opened. Nine rendered clause/commencement pages were inspected visually. Legal commencement dates, calculation dates, valuation-effectiveness dates and first observed API values remain separate.

## Findings and exact locators

| Source | Verified finding | PDF pages and clauses |
|---|---|---|
| 127, 30 November 2021 | Adopted 30 November and officially published 1 December 2021, but **commences 4 January 2022**. Attached changes move BFIX **15:30 → 15:00 Kyiv time** and the website publication deadline **16:00 → 15:30**. The two clocks describe different steps. | PDF p 1 operative §4; p 2 attached §1(2), amending 148 I §2(1); p 3 attached §2(4), amending 148 III §13 first paragraph. |
| 21, 24 February 2022 | Replacement §13 explicitly freezes official FX rates, SDR and bank-metal prices at the levels operative on 24 February. It is **not only a USD-input freeze**. Commencement is the **day of signing**; the document date/publication header is 24 February. | PDF p 2 operative §1 replacing 18 §13; p 3 operative §2; p 1 date/publication header. |
| 58, 21 March 2022 | New §13 keeps the USD input fixed; new §13¹ requires bank-metal prices to be calculated under 148 using that input. New §13² continues suspension of the separate reference USD calculation. It commences on official publication; the header states **21 March 2022**. | PDF p 2 operative §1(7), replacing §13 with §§13–13²; p 4 operative §2; p 1 publication header. |
| 154, 21 July 2022 | The metals valuation **calculated 20 July remains operative throughout all of 21 July**. Commencement is 21 July. The 25 July exception concerns §1(3), whereas the metals carryover is §1(5). The separate USD rule has a 09:00 clock; that does not move the metals valuation at 09:00. | PDF p 2 operative §1(5), second inserted paragraph in 18 §13¹; p 3 operative §2; p 1 §§1(3)–1(4) for the exception/timing distinction. |

The prior consolidation was checked as a referent, not accepted merely from its candidate filename: its title/body lists the 2020 amendments. I §2(1), PDF p 1, identifies the pre-127 BFIX time as 15:30 **Kyiv**. III §13 spans PDF pp 7–8 and sets website publication no later than 16:00. Amendment 127 explicitly replaces those figures. This does not establish fresh calculations on 1–3 January holidays or any original API dissemination time.

Amendment 21 literally uses the Ukrainian phrase for **calculated price** of bank metals. Its inclusion of metals is unambiguous; an exact quotation should not substitute the different Ukrainian phrase for accounting price. Amendment 58 uses the accounting-price terminology in its restored calculation clause.

## Verified rules versus unsupported inferences

Three error probes are contradicted by the exact clauses: that 127's new clocks commenced on its adoption date; that 21 froze only USD; and that metals necessarily repriced at the separate 09:00 USD-rule time on 21 July. These probes were introduced by this reviewer; they are **not allegations that the helper made those claims**.

The following remain uncertain or unestablished:

- The signature hour on 24 February and official-publication hour on 21 March.
- The first restored calculation, first newly published number or first changed numeric value after a legal transition. In particular, 58 alone does not prove a new `calcdate` on 21 March or a first new effective/API value on 22 March.
- The first subsequent changed metals valuation after the July carryover. The all-day rule identifies what remains operative on 21 July, not the next observed quote.
- Equality of values, flat observed prices, zero returns, freshness of underlying quotations, and precise legal-date alignment with API `calcdate`/effective-date fields. No such data was read.
- Complete 2022–2024 legal coverage, including every intervening wartime decision, calendar exception, fallback or implementation change. Four selected amendments cannot close that broader gate.

Accordingly, the general pre/post-4-January clock change is verified, but applying a 2021-labelled consolidation mechanically to the entire 2022–2024 history is unsupported. Likewise, describing the February rule as a freeze does not demonstrate an observed flat series or an exact midnight boundary.

## Comparison performed after the independent read

The helper's `127_CLOCK`, `21_FREEZE`, `58_RESTORE` and `154_USD_RESET_AND_CARRY` records agree with the independently read clauses and commencement rules. Its explicit intraday/first-new-value limitations are appropriate. **No material contradiction was found in these four checked findings.**

This is not an independent validation of every continuous interval in the helper's timeline, its 2023/2024 amendments, or all operational/holiday exceptions. The reviewed helper file hashes and comparison time are recorded in the companion JSON. Neither helper file was edited.

## Source identity and provenance

All page references above are **one-based PDF pages**, which can differ from printed attachment numbering. The JSON supplies each claim's source SHA, exact paragraph locator, official URL, local file and reviewed render hashes.

| Source | SHA-256 of independently read local PDF |
|---|---|
| [127](C:/Users/Xanan/Documents/Codex/2026-11-07/continue-setting-up-my-meridianx-ctrader/work/raw/nbu-method-history/nbu-148-amendment-127-2021-11-30.pdf) | `ff507225bbfec30ef2845f73f03fb939b55b9edf64ef8a3c46097bea6c29174e` |
| [21](C:/Users/Xanan/Documents/Codex/2026-11-07/continue-setting-up-my-meridianx-ctrader/work/raw/nbu-method-history/nbu-18-amendment-21-2022-02-24.pdf) | `5e7d7eb3bad4285141c4ff07bed26ca3233d6db21bd938fefb7c7c08bf23c57c` |
| [58](C:/Users/Xanan/Documents/Codex/2026-11-07/continue-setting-up-my-meridianx-ctrader/work/raw/nbu-method-history/nbu-18-amendment-58-2022-03-21.pdf) | `ea05e9de29216b5cb90913b8502228fc921baed6ec3629de78ff5b1e11af2952` |
| [154](C:/Users/Xanan/Documents/Codex/2026-11-07/continue-setting-up-my-meridianx-ctrader/work/raw/nbu-method-history/nbu-18-amendment-154-2022-07-21.pdf) | `66a6f4a7ebc34e97bb06ae8ab22aa2036a37f57c46d90e3038443ca83f9ae390` |
| [Prior 2020 consolidation](C:/Users/Xanan/Documents/Codex/2026-11-07/continue-setting-up-my-meridianx-ctrader/work/raw/nbu-method-history/nbu-148-prior-consolidation-2020-10-07-candidate.pdf) | `3a032e95a8e936bf375dbef7037f041f3fef5c58ffb6582b06a1790f24e221d9` |

Original source: National Bank of Ukraine. English summaries are derivative review metadata; the Ukrainian legal wording controls. The saved PDF body hashes matched their existing HTTP receipts, and all nine inspected render hashes matched the render index. These checks identify the saved source representation; they do not authenticate its bytes against a contemporaneous publication archive.

Deliverables are this note and `work/nbu-material-method-independent-review.json` only. Existing source, protocol, result, price and archive files were not modified.
