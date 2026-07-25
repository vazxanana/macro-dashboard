# CFTC Commitments of Traders (COT) — Gold Release Cadence and Lag

- **URL:** https://www.cftc.gov/MarketReports/CommitmentsofTraders/ReleaseSchedule/index.htm ; https://www.cftc.gov/MarketReports/CommitmentsofTraders/index.htm
- **Type:** primary (CFTC is the US federal regulator; this is the official government data source)
- **Date:** Ongoing weekly series; release-schedule page is the authoritative reference (date of last update unknown from snippet).
- **Credibility:** 5
- **Recency:** 5
- **Bias:** None — official regulatory data.
- **Cadence/lag:** **Weekly.** Positions are captured as of Tuesday's close; the CFTC receives data from reporting firms Wednesday morning, verifies it, and releases the report Friday at 3:30pm ET. This is a **3-calendar-day lag** (Tue close -> Fri afternoon) built into the report by design — the freshest COT number a daily engine could ever have is already 3 days stale the moment it's published, and up to ~9 days stale just before the next Friday's release (i.e., the data point is "current" for a shrinking window then goes stale until refreshed).
- **Sourcing:** SEARCH-DERIVED — not verified by pulling the live CFTC release-schedule page directly, though CFTC is itself the primary regulator and this description matches broadly-known, long-standing CFTC procedure.

## Reported content
> "The Commitments of Traders reports are released at 3:30 p.m. Eastern time, usually on Friday, and the release usually includes data from the previous Tuesday... resulting in a three-day lag between the data snapshot and publication." (paraphrased.)
> "The CFTC Commitments of Traders (COT) report breaks down open interest in COMEX gold futures by trader group: managed money (hedge funds and CTAs), producer/merchant (commercial hedgers) and swap dealers, and it is published every Friday with positions as of Tuesday close." (paraphrased.)

## Relevance
Confirms and quantifies the well-known but important constraint already flagged in the task brief: COT is weekly-cadence with a 3-day publication lag on top of already being a snapshot (not continuous data), so a value read on, say, Monday reflects positioning that is already 6 days old, and remains "the latest available" for the full week until the next Friday. For a daily engine, COT should be treated as a slow-moving positioning/sentiment backdrop (updated once a week) never as a same-day signal.
