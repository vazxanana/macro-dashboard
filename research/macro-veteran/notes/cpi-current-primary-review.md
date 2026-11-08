# Current primary-source check for a real October 2026 core-CPI forecast

Checked with the connected search-service between **2026-11-08 14:01:39 and 14:02:49 UTC**. Those are local tool-observation bounds, not proof of a source's actual publication time. No forecast was issued and no master or V1 file was edited by this review.

## Is the target still prospective?

**The checked official record supports treating October 2026 CPI as not yet released.** The November calendar schedules October CPI for **Tuesday 10 November, 08:30 Eastern**, equivalent to **13:30 UTC** on that date. Real Earnings is simultaneous. The calendar's displayed last-modified date is 3 November. This is a scheduled time, not observed delivery. [BLS calendar](https://www.bls.gov/schedule/2026/11_sched_list.htm)

The live summary and TOC identify September 2026 as their current result. The official archive's 2026 list begins with September and contains no October release in the observed list. The series directory independently ends the core-SA series at 2026 M09. Searching official pages for the November date returned schedule/preview references, not an October outcome. A guessed future archive URL was inaccessible through the tool; that failure alone would not establish nonpublication. The inference above rests on the combined current-release, archive, metadata and calendar evidence. [Current summary](https://www.bls.gov/news.release/cpi.nr0.htm), [archive](https://www.bls.gov/bls/news-release/cpi.htm), [series directory](https://download.bls.gov/pub/time.series/cu/cu.series)

## Exact target and latest known comparator

| Field | Verified specification |
|---|---|
| Population/geography | CPI-U, all urban consumers, U.S. city average. |
| Core item | All items less food and energy. |
| Underlying SA index identifier | `CUSR0000SA0L1E`; area `0000`, item `SA0L1E`, seasonal flag `S`, base `1982-84=100`. The directory shows latest period 2026 M09. |
| Forecast outcome | The **October 2026 seasonally adjusted change from the preceding month**, in percent, published for that core item in the first October CPI release's Table A. |
| Numeric scale | Store `0.3` for a change of 0.3 percent, rather than `0.003`, 30 bp, an index level or an annualized rate. |
| Precision | Score the one-decimal percentage change as actually printed in Table A. Do not substitute a higher-precision change reconstructed from index levels unless it is registered as a different target. |
| Prior observable value | The archived September release prints core m/m **0.3**; its Table A also shows August **0.3** and July **0.2**. |

The series ID denotes an **index**, not a stored percent-change series. The exact release field is the resolution authority for the target above. Directory metadata verifies its series identity, while the current archive verifies the then-observable printed value. Capturing an archive today does not independently authenticate the bytes first delivered on its release date. [BLS series directory](https://download.bls.gov/pub/time.series/cu/cu.series), [September release, Table A](https://www.bls.gov/news.release/archives/cpi_10142026.htm)

The September release header is dated **14 October 2026, 08:30 ET**, and displays release number **USDL-26-1574**. Its page last-modified date is 14 October. The header is an embargo/release label; no original delivery log was captured in this review. A baseline can honestly be labeled the September archived value **as retrieved before this forecast**, without claiming that an original-release snapshot was independently retained. [Archived release](https://www.bls.gov/news.release/archives/cpi_10142026.htm)

## Vintage and shutdown rules that affect the contract

Seasonally adjusted CPI data are revised through annual seasonal-factor updates covering the preceding five years. A first-release forecast must preserve its initial outcome and avoid resolving later from an automatically revised database. Predeclare how a same-day correction will be handled; either preserve the first captured publication as the target or define an explicit correction cutoff before issuance. The general description of CPI-U as final does not eliminate seasonal revisions to this SA target. [BLS technical note](https://www.bls.gov/cpi/technical-notes/), [seasonal-adjustment FAQ](https://www.bls.gov/cpi/seasonal-adjustment/questions-and-answers.htm)

BLS did not issue an October 2025 CPI release, and October 2026 annual comparisons will be omitted where the October 2025 index is absent. That does **not** imply the current monthly core target is unavailable. Keep it separate from reconstructed model y/y estimates and from final October–December 2025 C-CPI-U estimates, scheduled as a separate companion publication on 10 November. [Shutdown-impact FAQ, questions 15–16](https://www.bls.gov/cpi/additional-resources/2025-federal-government-shutdown-impact-cpi-faq.htm)

For the 2026 seasonal-adjustment process, BLS interpolated many missing October 2025 observations using September/November geometric means; there were special two-month cases. This is a potential model/history break to disclose, not a reason to invent a missing observed CPI value. [Seasonal-adjustment FAQ, question 8](https://www.bls.gov/cpi/seasonal-adjustment/questions-and-answers.htm)

## Practical implications for registration

- Use an actual current creation/issuance timestamp and an information cutoff no later than issuance. The source check is prospective only relative to the observed official state; current hashes cannot prove external precommitment.
- Capture the actual current Cleveland model row separately if it will be an input or comparator. This review did not verify its value, as-of time, historical revision status or mapping to the printed rounded target.
- A one-case scorecard can prove a workflow after resolution. It cannot establish skill. Register a rule for consecutive future cases and missing captures before selecting results.
- Do not equate a Table A percent change with an API index level. Rescaling both forecast and outcome from fractional changes to percentage units multiplies squared-error loss by 10,000; mixing the scales creates a different error altogether.
- Preserve actual observation, publication/availability and receipt timestamps separately at resolution. A release-header embargo plus a retrieval proves neither exact original delivery nor an independently authenticated publication instant. If actual publication cannot be established, keep that metadata gap visible rather than filling it with the scheduled time.
- Current source captures here are tool-rendered readings, not saved original HTTP response bytes. Parent work should retain raw bytes or an explicitly labeled tool-response artifact, exact receipt evidence and a hash if used to support a prospective evidence ledger.

## Access and remaining evidence gaps

The BLS time-series UI and guessed future archive page were inaccessible through this tool. The plain-text series directory and official current/archive pages were accessible. No source body, publisher HTTP headers, original release-day receipt log, or external timestamping attestation was retained by this bounded note. No claim is made that the October outcome is impossible to obtain elsewhere; the official public record inspected still presented it as future.

Relevant displayed modification dates: calendar **3 November 2026**; current summary and September release **14 October 2026**; shutdown FAQ **16 September 2026**; technical note and seasonal FAQ **13 February 2026**. These page labels are not observation/receipt timestamps.

## Follow-up: independent check of directly downloaded BLS bytes

At **2026-11-08 14:06:37 UTC**, inspected the parent's captures under `outputs/cpi-pilot-sources-2026-11-08/`; no source files were edited.

- `bls-release-calendar.html`, rows 643–649, matches the CPI and simultaneous Real Earnings date/time above; row 680 supplies the Eastern-time convention and 3 November modification label.
- `bls-september-cpi-release.html`, rows 738–747, matches the core row above. Its explicit HTML header IDs distinguish March–September monthly SA values from the last NSA annual comparison: the core row is 0.2, 0.4, 0.2, 0.0, 0.2, 0.3, 0.3, then 2.6. The two final 0.3 entries belong to August and September; 2.6 is annual.
- The release's embargo header, release identifier, next-release statement and displayed modification date agree with the tool-rendered reading. A targeted search found no correction notice, but that absence plus an original-looking header does not establish that the current archive bytes are identical to the original release-day bytes. Preserve the prior-value description as an archived September value captured on 8 November.

The **successful** direct manifest is `direct-capture-manifest-1794146734083.json`. The generic `direct-capture-manifest.json` retains the earlier failed requests; it must not be mistaken for evidence of a successful download. The successful manifest labels original publication time unestablished, appropriately.

Independently recomputed SHA-256 and byte counts for both BLS files; both exactly match the successful manifest:

| Capture | Bytes | SHA-256 | Manifest receipt time |
|---|---:|---|---|
| Calendar | 57,103 | `db4cb05e91e67b434f16f01d37540258e780cad0bffa001607f08fc2ef87e071` | `2026-11-08T14:05:32.579Z` |
| September release | 1,373,525 | `b9f981390c08f4a530d839495fce582124015b979bac0398bfcc35ffde0544e4` | `2026-11-08T14:05:32.788Z` |

This verifies current bytes and consistency with the recorded receipt metadata. It is not an external timestamp attestation or proof of the original publication instant. The earlier tool-only capture limitation above describes the initial pass; these two BLS source bodies now have direct downloaded artifacts.
