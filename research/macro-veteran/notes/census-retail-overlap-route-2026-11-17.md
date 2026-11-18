# Census advance retail sales: historical schedule metadata

The three official annual indicator calendars provide **36 regular scheduled releases**, 12 in each of 2022–2024, for the exact label “Advance Monthly Sales for Retail and Food Services.” All selected cells say **8:30 AM**. Each row preserves release date, reference month, source line, body and row hashes, and the separate hidden release/reference identifiers. The reference month is not the publication date. [2022 calendar](https://www.census.gov/economic-indicators/calendar-listview-2022.html), [2023 calendar](https://www.census.gov/economic-indicators/calendar-listview-2023.html), [2024 calendar](https://www.census.gov/economic-indicators/calendar-listview-2024.html).

This is a **schedule inventory**, not complete historical publication coverage. These captured time cells do not explicitly state a timezone, so the extraction retains an unknown timezone and no UTC conversion. It does not assign a presumed offset, infer first availability, or declare any study interval clean. Reconcile applicable official release headers and schedule changes before applying the frozen broader-release exclusion.

The [current Census release-schedule page](https://www.census.gov/retail/release_schedule.html) distinguishes MARTS advance sales from the later MRTS sales/inventories and links separate historical release-date workbooks. The linked [MARTS workbook](https://www.census.gov/retail/marts/www/MARTSreleasedates.xlsx) was discovered but not inspected; the web reader reports unsupported spreadsheet content. The monthly archive is another discovery route, not a verified receipt log. A generic `/retail` link in a calendar row is not a dated original release.

Native capture retained all three annual HTML pages and the current schedule with HTTP 200, actual receipt clocks and SHA-256 hashes. No ephemeral HTTP/session headers were retained. The parser checked 36 exact labels and source rows against their hidden sort/release/reference IDs and verified one scheduled row in each calendar month. Those internal checks do not establish absence of unscheduled news, corrections or reissues.

- Machine-readable inventory: `work/census-retail-overlap-route-2026-11-17.json`, SHA-256 `f3529544d45c4b84d6136ca082318e9547fc061bd885f7c2ec4d29033fa21a3d`.
- Capture receipts: `work/raw/census-retail-calendar-2026-11-17/capture-receipts.json`.
- Reader: `work/profile_census_retail_calendar_2026_11_17.py`.

No sales figures, Treasury changes, forecast errors or returns were extracted or compared. Broad searches incidentally surfaced outcome snippets; none supplied inventory values, outcome selection or analysis. The original study windows, controls, protocol and result remain unchanged. The broader coverage gate remains incomplete.
