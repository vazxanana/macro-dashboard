# NBU gold and CPI: matching calendar dates does not establish an event window

A clock-only audit of the existing 36 CPI release dates shows why the NBU accounting series needs an explicit timing contract before any event study. No prices, forecast errors or market returns were evaluated. The [per-event arithmetic](nbu-cpi-clock-compatibility-2022-2024.json) is conditional on documented reference times, not observed quote or publication timestamps.

The reference clocks are 15:00 Kyiv for BFIX and a 15:30 website publication deadline under the post-4-January rule. CPI's comparison clock is its scheduled 08:30 New York release. The 10 March 2022 case falls inside the documented metals freeze and is excluded from ordinary-clock interpretation, leaving 35 conditional cases. [Dated NBU methodology](nbu-gold-methodology-and-clocks-2026-11-09.md), [CPI source ledger](cpi-first-print-release-ledger-2022-2024.json).

| Conditional comparison | Reference quote minus scheduled CPI | Reference publication deadline minus scheduled CPI |
|---|---|---|
| 15:00/15:30 Kyiv on the CPI calendar date | 30 minutes before in 33 cases; 30 minutes after in 2 | Coincident in 33; 60 minutes after in 2 |
| Reference clocks on the `calcdate` label paired to the CPI effective-date label | 24½ hours before in 33 cases; 23½ hours before in 2 | 24 hours before in 33; 23 hours before in 2 |

The two daylight-saving exceptions are **14 March 2023** and **12 March 2024**, when the U.S. and Kyiv offsets differ from their usual relationship. Both zones were converted separately; no fixed New York/Kyiv difference was imposed. The source date projection pairs all 36 CPI effective-date labels to the preceding calendar day's calculation label. Assigning a reference clock to that label remains conditional because the historical range-field contract is incomplete.

A deadline coinciding with scheduled CPI does not make the valuation a post-release observation: its default quotation reference is earlier, and an effective-date join selects a prior calculation label. Conversely, the two positive same-day reference gaps do not establish that fresh quotes were used, responses captured the release, or data were available to traders then. Fallback quote age, operational exceptions and actual publication remain unverified.

The comparison is against **scheduled** CPI. Actual first-publication times are not authenticated by this audit. The separate 15 May 2024 early-publication case is flagged without inventing a field-specific actual UTC timestamp; its timezone ambiguity remains preserved. [BLS release-integrity case](bls-release-integrity-case-2026-11-09.md).

The script loads explicitly hashed `Europe/Kyiv` and `America/New_York` TZif bytes from `tzdata2026.6` using `ZoneInfo.from_file`, preserving runtime provenance without a system-cache assumption. This is a reproducible clock conversion, not source-time authentication. [Python timezone documentation](https://docs.python.org/3/library/zoneinfo.html).

This addendum is later work outside the unchanged V1.4 ZIP. It identifies a design incompatibility that a naive date join would overlook; it does not approve the NBU series as USD spot, quantify a CPI response, or resolve the remaining field/calendar/vintage gates.

Source attribution: National Bank of Ukraine, [Open Data](https://bank.gov.ua/en/open-data); U.S. Bureau of Labor Statistics. Clock selection and arithmetic are independent MeridianX research modifications.
