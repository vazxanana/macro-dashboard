# Independent Census and interval metadata check

**PASS_INDEPENDENT_METADATA_CHECK**: 23 checks passed; 0 failed.

- Census: 36 exact family rows independently parsed from three saved HTML calendars; 36/36 ledger rows agree on family, date, clock, reference month, both hidden IDs, source body hash, literal decoded row hash and source line.
- Verified all three HTML receipt hashes and the capture-manifest hash.
- Intervals: 133/133 existing audited rows exactly equal the projection, in order, with only ending_date, start_proxy_utc and end_proxy_utc. The named source byte hash agrees. No full source JSON decode or outcome-field inspection occurred.

Census timestamps remain **scheduled**, not authenticated actual first publication. The saved row timezone is unknown and UTC is null; this review preserves both caveats. Complete historical notices/corrections coverage and the broader overlap gate remain unresolved. The interval check validates an existing metadata projection, not original study matching. No downloads, outcome calculations, matching or exclusions were performed.
