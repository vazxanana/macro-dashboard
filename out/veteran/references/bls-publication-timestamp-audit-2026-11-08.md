# CPI release clocks: an official timestamp is not proof of first availability

**Reviewed:** 8 November 2026, after the pilot's original issuance. Five official BLS responses were captured at approximately 14:23 UTC, with headers, byte counts and hashes. The [audit metadata](bls-publication-timestamp-audit-2026-11-08.json) preserves the observations and local source paths. This review adds verification evidence; it does not change the [issued CPI forecast](core-cpi-prospective-pilot-2026-11-08.md).

## Two concrete traps in the current feeds

| Official route | Captured metadata and content | What the record supports |
|---|---|---|
| [CPI news feed](https://www.bls.gov/feed/cpi.rss) | Atom payload despite its `.rss` filename. The September entry's `published` and `updated` fields are `2026-10-14T07:50:31.2-04:00`, or 11:50:31.2 UTC. | A publisher lifecycle timestamp. It precedes the September release's 08:30 Eastern embargo by about 39m29s. Today's copy does **not** establish when it was publicly accessible then. |
| [CPI latest-number feed](https://www.bls.gov/feed/cpi_latest.rss) | `pubDate` is 6 November 2026, 08:31:36 −0500, while observations still refer to September. | A later feed timestamp can accompany old data. **Inference:** it cannot identify the original September publication instant merely because it is a `pubDate`. |
| [Current core-index API request](https://api.bls.gov/publicAPI/v2/timeseries/data/CUSR0000SA0L1E?latest=true) | Response contains September 2026, its index value and reference-period metadata, without an observation publication timestamp. | Current series retrieval. `responseTime`, `latest=true` and an index reference month do not supply a release clock or the exact published monthly percentage-change target. |

The first finding is **not evidence of an early public leak**. A file can carry a preparation timestamp before its release, and these captures occurred weeks later. Conversely, a refresh date cannot establish that the underlying economic observation is new. A backtest that treats either field as actual historical availability could introduce timing errors while appearing to use official metadata.

## Keep the clocks separate

HTTP `Date` concerns response origination; `Last-Modified` describes when the server believes the selected representation changed; ETags identify versions. None is a first-publication certificate. The captured CPI Atom file's `Last-Modified` is also before its embargo, while its HTTP `Date` is the November retrieval day. [HTTP semantics: Date](https://www.rfc-editor.org/rfc/rfc9110.html#section-6.6.1), [Last-Modified](https://www.rfc-editor.org/rfc/rfc9110.html#section-8.8.2), [ETag](https://www.rfc-editor.org/rfc/rfc9110.html#section-8.8.3)

Atom's publication and update fields concern the entry's lifecycle and publisher-significant changes. They do not certify independently observed global availability. Retain the original field names and provenance. [Atom publication](https://www.rfc-editor.org/rfc/rfc4287.html#section-4.2.9), [Atom update](https://www.rfc-editor.org/rfc/rfc4287.html#section-4.2.15)

For the pilot, keep scheduled release, publisher metadata, request start, completed receipt, reference month and first observed version as separate facts. Record local clock quality and cache information where known. A conservative current receipt establishes that this research process had the captured version by receipt; it cannot retrospectively establish its first delivery to the public.

## A practical post-release evidence record

Before the event, preserve the current release and feeds with their actual reference months. At and after the scheduled event, identify the new reference month and exact Table A core monthly field. Save raw bytes, status/final URL, headers, request and receipt clocks, hashes and each changed version. Check the publisher's terms and use a modest retrieval cadence.

Call the first completed receipt of a new relevant version `first_seen_at_utc`. A last-old/first-new pair can bracket this collector's endpoint observation under stated assumptions. Stale caches and other dissemination channels mean it does not prove the exact earliest public release. Keep corrections as new versions and authenticate the intended first print separately.

If actual publication remains unknown, leave it null and retain the pilot's `resolution_unverified` status. Do not substitute a calendar, embargo header, feed field or receipt merely to obtain a score. Supporting publication-time intervals in a future design would require an explicit new specification; this audit does not reinterpret the frozen contract.
