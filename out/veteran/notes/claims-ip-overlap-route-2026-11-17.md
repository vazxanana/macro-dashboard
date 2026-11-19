# Industrial production and initial-claims official routes

Generated 2026-11-17T21:11:57.583166+00:00. Metadata only; no economic values, outcomes, interval verdicts or control rematching.

The official G.17 regular-release inventory is reconciled: **36 monthly releases plus 3 annual revisions**. The historical monthly-date list and monthly archive href dates agree exactly; all 39 HTML release dates and current PDF date/time headers agree. Monthly PDFs say 09:15 EST/EDT; annual revisions on 2022-06-28, 2023-03-28 and 2024-06-28 say 12:00 noon EDT. Each dated clock was converted using America/New_York, with tzdb 2026f. This is same-producer format consistency, not independent first-publication authentication.

Official sources: [G.17 archive](https://www.federalreserve.gov/releases/g17/), [historical monthly dates](https://www.federalreserve.gov/releases/g17/release_dates.htm), [announcements](https://www.federalreserve.gov/feeds/G17.html). The monthly list omits the annual revisions. Four malformed archive rows initially defeated a row-based parse; enumeration of observed hrefs recovered them and reconciled all 36 dates. No dates were manufactured from monthly cadence.

The announcements index also contains correction notices dated **2024-07-17 and 2024-07-26**. Their exact publication times and treatment as separate macro releases are unresolved. They are retained as date-only candidates, so the 39 regular releases are not asserted to be a complete unscheduled/reissue census.

DOL coverage is explicitly partial: **8 historical PDFs**, each with an 08:30 Eastern embargo header. Wednesday exceptions in the sample are 2022-11-23, 2023-11-22, 2024-07-03 and 2024-11-27. The sample also checks 2022-01-06, 2023-01-05, 2024-01-04 and 2024-12-26. The JSON contains every source URL, hash and dated UTC conversion.

The [DOL archive](https://oui.doleta.gov/unemploy/archive.asp) currently renders a 2025 calendar. Requests with year=2024, yr=2024 and CY=2024 returned the same bytes and no 2024 PDF links. The documented rolling latest-release link is [data.pdf](https://www.dol.gov/ui/data.pdf); observed historical PDFs use https://oui.doleta.gov/press/YYYY/MMDDYY.pdf. Three native requests to a candidate official newsroom year-filter route returned HTTP 403. No full weekly inventory or holiday/reissue completeness is claimed.

The JSON is the access/metadata contract: release date rather than reference period; observed archive href; publication-clock kind; timezone and dated UTC conversion; current receipt; raw-byte SHA256; same-producer date reconciliation; explicit actual-first-publication and reissue unknowns. Current receipt, HTTP Date/Last-Modified, archive dates, PDF headers and schedules do not authenticate actual first historical network availability.

**The frozen broader-overlap gate remains unavailable.** DOL enumeration is incomplete and G.17 corrections lack times; unknown is never clean. This report does not classify any frozen interval or alter the protocol, study index, controls or outcomes.

Provenance: work\raw\claims-ip-overlap-2026-11-17\manifest.json (SHA256 c3597451da7605d3f68db8d428442e4bac2afe662bd67b9c80e6d8bb0f74ec9d). It records 93 successful current HTTP receipts and 6 failed attempts. Only allowlisted non-sensitive receipt headers are retained; set-cookie and other headers were discarded. Native HTML/PDF files are verbatim current response bytes; *.web.txt is tool-rendered discovery text, not original source bytes.

PDF extraction note: optional fontTools was absent and pypdf emitted font-encoding warnings for some G.17 files. All 39 exact date/time header patterns nevertheless parsed and reconciled; no values or figures were used.

Machine-readable inventory: claims-ip-overlap-route-2026-11-17.json. Frozen protocol SHA256: 4bbed411c83a65253d5172badfced14a9c1a6c1e83f939ddaed0ee2f64644835.
