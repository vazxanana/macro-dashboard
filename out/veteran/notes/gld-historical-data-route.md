# GLD historical data: current route, actual schema and use boundary

Reviewed 8 November 2026, approximately 19:29–19:34 UTC. This is a bounded access/schema review for a possible CPI-to-gold study. No event returns were calculated, no historical prices were copied into `outputs/`, and no frozen V1/V1.1 or master references were edited. Public issuer-linked responses were retained locally in `work/raw/gld-event-study/`.

## Concrete route found

The [current issuer GLD page](https://www.spdrgoldshares.com/usa/gld/) links **Historical Archive (XLSX)** to:

`https://api.spdrgoldshares.com/api/v1/historical-archive?exchange=NYSE&lang=en&product=gld`

The formerly plausible CSV URL `https://www.spdrgoldshares.com/assets/dynamic/GLD/GLD_US_archive_EN.csv` currently redirects to `https://api.spdrgoldshares.com/api/v1/barlist?underlying=gld`. It returns an HSBC allocated-bar-list **PDF**, not historical CSV data. This was confirmed directly, not inferred from filename or a search-service parser. A successful HTTP response is insufficient: check final URL, type and file signature.

Successful capture metadata is `work/raw/gld-event-study/capture-manifest-1794166248741.json`. The earlier `capture-manifest-1794166235779.json` contains failed restricted-network requests and must not be cited as successful retrieval.

| Captured item | Result |
|---|---|
| Current historical archive | HTTP 200, XLSX, 543,372 bytes; attachment `US_GLD_Archive_EN.xlsx` |
| XLSX SHA-256 | `776ee32a829252161f422407e30bc8c206c2056919065480a8e16110689e1800` |
| Completed receipt | 2026-11-08 19:30:48.441 UTC |
| Publisher HTTP Last-Modified | 2026-11-07 23:36:06 GMT; not proof of any observation's original publication |
| Old CSV route | HTTP 200 after redirect, PDF, 697,561 bytes; signature `%PDF-1.5` |
| Old-route PDF SHA-256 | `8f7d90da99c498a516a892350a661db5d69bde3a1d9d0973e1a62853cdcb2a59` |

## File contents and observed coverage

The workbook has a Disclaimer sheet and a historical-data sheet, 5,731 worksheet rows including its header, with **5,730 dated observations** and 11 fields. Dates span **18 November 2004 through 5 November 2026** in ascending order, without duplicate or unparseable dates. This copy does not reach the latest preceding trading day, 6 November; do not silently call its final observation 6 November because the file was modified on 7 November.

The fields cover date, GLD closing share price, gold ounces per share, NAV per share, an indicative per-share value, a bid/ask midpoint, premium/discount relative to that indicative value, daily share volume, trust gold ounces, tonnes and total NAV. The exact schema is in the local `history-schema-profile.json`; the two most relevant literal labels are **Closing Price** and **NAV/Share at 10:30am NYT**. There is **no LBMA price column**.

The workbook's Disclaimer states that the LBMA Gold Price was removed at ICE Benchmark Administration's request and points to [IBA licensing information](https://www.ice.com/iba/lbma-gold-silver-price). Do not treat the issuer archive as a currently available historical LBMA benchmark file or quietly reconstruct a purported independent benchmark from NAV.

For closing price, NAV and most other numeric fields, this copy contains **5,525 numeric observations** and **205 US Holiday statuses**. These statuses are missing market observations, not zeros. The premium/discount field has three additional AWAITED statuses on 24 July 2018, 11 February 2022 and 15 March 2022. Its numeric negative and zero values are valid observations, distinct from those text statuses.

Three weekend rows—1 January, 19 June and 25 December 2022—are all holiday-status rows, not numeric trading observations. Four weekdays are entirely absent: 25 December 2006, 6 April 2007, and 29–30 October 2012. Their dates are consistent with possible holidays/closures, but this review did not independently verify each exchange calendar. Preserve them as gaps and reconcile with the exchange calendar rather than filling them forward or inventing prices. Mixed omitted-date and explicit-holiday conventions mean a simple weekday-count expectation is inadequate.

`history-schema-profile.json` stores field-type/status counts and date coverage only, not the historical price database. No return, event coefficient or performance result was produced.

## Definitions and clocks that matter for CPI research

GLD is an exchange-traded trust share, whose objective reflects bullion less trust expenses. Its closing share price is not a spot-gold quote, benchmark auction price or NAV. The inspected archive does not expose a documented adjustment/total-return flag or a within-day timestamp for its closing-price field. Do not assume a vendor-style adjusted series.

The archive labels its indicative-value, midpoint and premium/discount fields at **4:15 p.m. New York**, whereas the current issuer page describes its market-information midpoint at **4 p.m.** The archive's NAV label is **10:30 a.m. New York**, while the current page describes NAV establishment between 10:30 a.m. and noon. Preserve the downloaded labels; do not overwrite historical clock conventions with the current webpage's prose. These differences require publisher/vintage clarification if a precise window is claimed.

The [January 2026 issuer FAQ](https://files.spdrgoldshares.com/spdr-cms/2026-03/GLD-FAQs-January-2026.pdf), pricing section, describes NAV as trust gold valued using that day's LBMA PM auction, plus cash less accrued expenses, divided by shares. It separately describes the intraday indicative value using spot bid/offer midpoint and expenses. London auctions occur at local London times; New York conversion varies during UK/US daylight-saving mismatches. The archive Disclaimer also gives a fallback when a PM auction is unavailable and notes the pre-20-March-2015 London Fix basis. Do not label the NAV history as one constant, independently observed 10:30-New-York price window across all dates.

A daily GLD closing-price endpoint could, if permitted for the intended use and calendar-cleaned, describe a **close-to-close ETF association on CPI release dates**. It includes overnight news and the rest of the US session. NAV-to-NAV uses a different clock and has fee/cash/auction effects. Neither establishes an 8:30-to-8:35 reaction, causal CPI effect or executable broker XAUUSD return. The same issuer page distinguishes settlement-date bar-list holdings from trade-date website holdings, another reason the old redirected PDF cannot replace the daily series.

## Rights: separate private analysis from redistribution

The [issuer terms](https://www.spdrgoldshares.com/terms-and-conditions/) permit saving/display/printing **“only for your personal, non-commercial use”**. Separate clauses restrict **“create derivative works from”** the information and **“commercial or money-making purpose”** without consent. The workbook bars reproduction/redistribution without prior consent. Those restrictions are distinct: the redistribution bar alone does not establish that private personal analysis is forbidden, but no blanket trading-study permission was found. Verify the intended use; this is not a legal conclusion.

A separate LBMA-specific clause limits supplied benchmark information to internal review of WGTS analysis and prohibits disclosure. Do not transfer that narrower clause automatically to non-LBMA share-price/NAV fields, which remain subject to the general terms. Public download availability is not an open-data licence. Keep raw data out of the assistant package.

## Decision for the parent study

There is a concrete, directly downloaded **daily GLD-share/NAV archive**, but it is not the old CSV and no longer includes LBMA prices. The prospective study must choose its instrument and daily endpoint explicitly, preserve holiday/status missingness and the 2015 benchmark/clock issues, and resolve intended-use permissions rather than conflating personal analysis with redistribution. If the desired claim remains an intraday gold-surprise reaction, this route does not supply the required prices or a historical receipt log. No substitute intraday or benchmark series was fabricated.

## Reproducible local evidence

- `work/raw/gld-event-study/capture.mjs`: bounded four-route direct capture script.
- `work/raw/gld-event-study/capture-manifest-1794166248741.json`: successful response types, redirects, headers, receipts, sizes and hashes.
- `work/raw/gld-event-study/current-history-1794166248441.xlsx`: raw issuer archive, kept private locally.
- `work/raw/gld-event-study/inspect-history.py` and `history-schema-profile.json`: read-only schema/status/date inspection; no event-return calculations.
- `current-product-page-1794166248620.html` and `terms-1794166248740.html`: saved official product/terms responses with manifest hashes.

The FAQ/prospectus were read through the primary-source search tool; this note does not claim separately downloaded raw FAQ bytes. Original observation publication/receipt timestamps and a historical revision log were not obtained.
