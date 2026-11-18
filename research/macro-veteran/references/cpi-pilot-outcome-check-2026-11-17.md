# October CPI pilot: candidate located; primary case remains unresolved

The current [BLS dated archive](https://www.bls.gov/news.release/archives/cpi_11102026.htm) displays **0.3%** for October 2026 core CPI-U, seasonally adjusted change from the preceding month, in both Table A and the narrative. This is a current-archive candidate, not an authenticated original-vintage outcome. The original forecast remains **0.255%**. No primary score is assigned.

The web observation ran from **17 November 2026, 20:55:30 to 20:55:33 UTC**, after the frozen resolution deadline of **17 November, 13:30 UTC**. This receipt time does not establish that publication was late. The archive's 10 November 08:30 Eastern embargo header states a release convention; it does not authenticate actual first availability. Original release-day bytes and actual publication remain unknown.

Two searches of the current [BLS errata page](https://www.bls.gov/errata/) for the archive filename and October 2026 returned no matching text. That bounded absence does not establish that no correction exists or has ever existed. Native capture failed on the errata endpoint with HTTP 403; the parallel archive fetch did not produce a successful retained body or complete receipt manifest. The saved evidence is explicitly a selected **web-tool text representation**, not raw HTML.

At **21:01:06.356 UTC**, an append-only pending resolution attempt was added with `outcome: null`, `published_at_utc: null`, and an empty score list. Keeping the outcome null permits a later qualifying resolution append. The candidate 0.3 is retained in the evidence sidecar and review note. The record's October 31 observation timestamp is the reference-period endpoint prescribed in the original issuance; actual retrieval and recording timestamps remain separate.

Both ledger records passed JSON Schema validation. The unchanged guarded evaluator reports **1 registered case, 1 unresolved case, 1 pending resolution attempt, 0 scores**. The original 4,559 issuance bytes remain the exact prefix of the ledger; protocol, evaluation plan, evidence inputs and rules were not changed. Local hashes establish consistency of these files, not tamper-proof historical storage.

- [Qualified source observation](../work/raw/cpi-pilot-outcome-2026-11-17/web-observation.json)
- [Append and validation report](cpi-pilot-pending-attempt-validation-2026-11-17.json)
- [Guarded evaluation](cpi-pilot-asof-2026-11-17.json)
- [Append-only forecast ledger](cpi-pilot-forecast-ledger.jsonl)
- [Original pilot and frozen method](core-cpi-prospective-pilot-2026-11-08.md)

No first-publication timestamp was inferred from a schedule, date label, file hash or current receipt. No result from this check establishes forecasting skill or trading performance. This is new work outside the unchanged V1.4 the assistant ZIP.
