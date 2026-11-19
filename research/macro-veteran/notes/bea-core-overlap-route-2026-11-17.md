# BEA core overlap route audit — 17 November 2026

The three official annual schedules support **72 scheduled national releases** in release-date years 2022–2024: **36 GDP releases** (12 advance, 12 second and 12 third estimates) and **36 Personal Income and Outlays/PCE releases**. **65 of 72** have title-and-date corroboration in retrieved official archive indexes. This is a calendar-only route audit; it does **not** establish complete actual-publication coverage or pass the frozen broader-overlap gate.

GDP reference quarters run from 2021 Q4 through 2024 Q3. PI&O reference months run from December 2021 through November 2024. No economic outcomes, prices, returns, window matching or recomputation are included.

## Official sources

- [2022 annual schedule](https://apps.bea.gov/scb/issues/2021/12-december/1221-news-releases-2022.htm), [2023 annual schedule](https://apps.bea.gov/scb/issues/2022/12-december/1222-news-releases-2023.htm), [2024 annual schedule](https://apps.bea.gov/scb/issues/2023/12-december/1223-news-releases-2024.htm). Each states Eastern time, ordinarily 8:30 a.m.
- [BEA archive example, page 8](https://www.bea.gov/news/archive?created_1=All&field_related_product_target_id=All&page=8&title=). Pages 4–13 were inspected; JSON binds each corroborated row to its retrieved page and line.
- [2022 annual update calendar](https://www.bea.gov/news/blog/2022-07-13/national-industry-and-state-annual-updates-coming-sept-29-30), [2023 comprehensive update availability](https://www.bea.gov/information-updates-national-economic-accounts-2023), [2024 annual update availability](https://www.bea.gov/information-updates-national-economic-accounts-2024).
- [Official special-time schedule node](https://www.bea.gov/node/38921): **PI&O on 27 November 2024 was scheduled at 10:00 a.m. Eastern**, alongside GDP at 8:30 a.m.

## Scheduled inventory

Dates below are official scheduled dates. Every time is 08:30 America/New_York except the marked 10:00 PI&O release. JSON contains individual titles, estimate vintage, source receipt/line, archive corroboration and update flags.

| Year | GDP dates in ascending order |
|---|---|
| 2022 | 01-27 (advance); 02-24 (second); 03-30 (third); 04-28 (advance); 05-26 (second); 06-29 (third); 07-28 (advance); 08-25 (second); 09-29 (third); 10-27 (advance); 11-30 (second); 12-22 (third) |
| 2023 | 01-26 (advance); 02-23 (second); 03-30 (third); 04-27 (advance); 05-25 (second); 06-29 (third); 07-27 (advance); 08-30 (second); 09-28 (third); 10-26 (advance); 11-29 (second); 12-21 (third) |
| 2024 | 01-25 (advance); 02-28 (second); 03-28 (third); 04-25 (advance); 05-30 (second); 06-27 (third); 07-25 (advance); 08-29 (second); 09-26 (third); 10-30 (advance); 11-27 (second); 12-19 (third) |

| Year | Personal Income and Outlays/PCE dates in ascending order |
|---|---|
| 2022 | 01-28; 02-25; 03-31; 04-29; 05-27; 06-30; 07-29; 08-26; 09-30; 10-28; 12-01; 12-23 |
| 2023 | 01-27; 02-24; 03-31; 04-28; 05-26; 06-30; 07-28; 08-31; 09-29; 10-27; 11-30; 12-22 |
| 2024 | 01-26; 02-29; 03-29; 04-26; 05-31; 06-28; 07-26; 08-30; 09-27; 10-31; 11-27 **10:00**; 12-20 |

## Updates and schedule changes

Annual/comprehensive update bundles are retained on **2022-09-29 GDP / 2022-09-30 PI&O**, **2023-09-28 GDP / 2023-09-29 PI&O**, and **2024-09-26 GDP / 2024-09-27 PI&O**. They coincide with ordinary release rows and are not six additional independent headlines.

The 2023 comprehensive update rescheduled second-quarter **GDP by industry and GDP by state** from the originally planned September dates. Official update and archive records show separate releases on **2023-12-05**. This illustrates why an advance annual schedule alone cannot establish all revised-GDP publication coverage. The national GDP headline date stayed 2023-09-28.

The update pages also contain staged table releases/corrections. JSON preserves 12 supplementary dates, including 2023-12-05, 2024-02-01, 2024-05-23 and 2024-10-02. Their times and precise inclusion under the frozen core-family wording remain unresolved. They must not silently disappear from completeness review.

## Gaps and evidentiary limits

- **Seven scheduled rows lack archive corroboration in the retrieved snapshots:** GDP 2022-01-27, 2022-02-24, 2023-10-26; PI&O 2022-01-28, 2022-02-25, 2023-09-29, 2023-10-27. They remain scheduled events; absence from these snapshots is not evidence of cancellation.
- Archive page snapshots had different crawl ages, duplicate boundary rows and gaps. Page 13 returned 2021 records despite page 12 ending March 2022. No continuous complete archive has been established.
- No exhaustive review of unscheduled corrections, reissues, release advisories or table-only revision flows was completed.
- **Zero actual first network publication timestamps are authenticated.** Current archive Published dates, last-modified dates, planned times and embargo headers do not authenticate first availability.
- Direct origin retrieval failed sandbox DNS; retained receipts are rendered web-tool text, **not original HTTP HTML/PDF bytes or response headers**. Their local hashes identify the retained evidence only. No cookies, session IDs, credentials or sensitive headers are retained.
- Broad initial search and a later release-time search incidentally displayed economic outcome snippets. No values were transcribed into this audit or used. Only calendar, update-calendar and archive-metadata receipts were saved.

The broader overlap gate remains **incomplete**. No windows have been classified clean, matched, excluded or recomputed. Frozen artifacts, index/checkpoint, ZIPs and protected price data were not written.

## Files

- `work/bea-core-overlap-route-2026-11-17.json`: 72 row inventory, 12 supplementary dates, source binding, coverage gaps and retained-receipt SHA256 manifest.
- `work/raw/bea-core-overlap-2026-11-17/`: 17 rendered official calendar/update/archive evidence receipts. These are metadata receipts, not authenticated historical first-publication bytes.
