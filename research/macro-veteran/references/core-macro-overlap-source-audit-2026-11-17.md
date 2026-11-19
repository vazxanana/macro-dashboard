# Macro-release overlap: source inventories and exceptions

The next Treasury-study sensitivity needs coverage of all **eight frozen release families** over **133 existing event/control intervals**. This audit adds regular-release inventories and specific exceptions; it does **not** yet pass that coverage gate or produce a new yield result. The [original study](treasury-cpi-calendar-study-2022-2024.md), controls and results remain unchanged.

The metadata-only [interval projection](../work/treasury-core-overlap-intervals-2026-11-17.json) preserves the original UTC endpoints: 43 intervals ending in 2022, 45 in 2023 and 45 in 2024, from 4 January 2022 at 20:30 UTC through 18 December 2024 at 20:30 UTC. It selects the existing interval fields without regenerating calendars or rematching controls.

| Frozen family | Inventory established in this increment | Remaining coverage issue |
|---|---|---|
| FOMC statements | Existing 24-statement official-calendar audit already complete within its stated scope | Broader Fed news remains outside the formal-statement filter |
| BLS Employment Situation | 36 regular scheduled releases | Individual preambles and correction/reissue chronology not exhaustively reconciled |
| BLS PPI | 36 regular scheduled releases; dates agree with BLS historical date list | Additional 16 February 2022 reissue has no established intraday clock |
| Census advance retail sales | 36 regular scheduled rows with separate reference months and release IDs | Timezone absent from captured time cells; release/notice reconciliation incomplete |
| BEA GDP including revised estimates | 36 national scheduled releases, including 12 of each estimate vintage | Supplementary GDP-related rollouts, scope and timing require review |
| BEA PI&O/PCE | 36 scheduled releases and annual/comprehensive update bundles | Seven formerly schedule-only BEA rows now have individual release-page corroboration; archive pagination and supplementary flow scope remain incomplete |
| Federal Reserve industrial production | 36 monthly archive dates and three annual revisions identified | Two additional correction notices are date-only; notice completeness remains open |
| DOL weekly initial claims | Official year selector enumerates 52 PDF links per year; all 38 interval candidates have verified first-page headers | Other 118 PDFs, unlisted corrections and actual publication remain unchecked |

The six monthly families contribute **216 regular records**, not 216 independent shocks or complete news coverage. Extra releases, revisions and corrections are tracked separately; simultaneous update bundles are not automatically counted as independent events.

Three findings show why a default monthly schedule is insufficient:

- **PPI reissue:** BLS documents reissuing the January 2022 release on **16 February 2022**, after its original 15 February release. The original 08:30 schedule cannot supply the reissue's unknown clock. [BLS errata](https://www.bls.gov/errata/home.htm).
- **PCE special clock:** the October 2024 PI&O report was scheduled for **27 November at 10:00 a.m. Eastern**, alongside an 08:30 GDP release. Applying 08:30 to both would erase a real scheduling distinction. [BEA schedule record](https://www.bea.gov/node/38921), [annual 2024 schedule](https://apps.bea.gov/scb/issues/2023/12-december/1223-news-releases-2024.htm).
- **Additional industrial-production flows:** the archive includes annual revisions on **28 June 2022, 28 March 2023 and 28 June 2024**, with noon Eastern headers rather than the monthly 09:15 clock. Its announcement stream also records **17 and 26 July 2024** corrections. Monthly-release dates alone do not cover these flows. [G.17 archive](https://www.federalreserve.gov/releases/g17/), [G.17 announcements](https://www.federalreserve.gov/feeds/G17.html).

The BEA audit also preserves six annual/comprehensive update bundles and 12 supplementary dates or scope questions. A 2023 update moved GDP by industry/state to 5 December; those releases must not silently disappear under a narrowed interpretation of “GDP including revised estimates.” The national GDP headline date and the later supplementary flows remain distinct.

A [BEA seven-row follow-up](../work/bea-seven-gap-followup-2026-11-17.md) located individual official release pages for every row absent from the sampled archive pagination. All 72 regular BEA calendar rows now have title/date corroboration from either the sampled archive or an individual release page; the seven individual pages also state 08:30 Eastern embargo clocks. This does not establish a complete actual-publication or correction history.

The [DOL archive follow-up](../work/dol-archive-route-followup-2026-11-17.md) found the official form route: submit `report=press` and `year` by POST from [Choose a Weekly Report](https://oui.doleta.gov/unemploy/claims_arch.asp). The three resulting calendars list **156 PDFs, 52 per year**, including all eight previously sampled dates. GET queries on the rendered archive had missed this route. Browser DOM hashes identify current rendered calendars; unlisted corrections and reissues need further checking. [Follow-up validation](core-macro-overlap-followup-validation-2026-11-17.json) verifies inventory uniqueness and the seven BEA IDs, within its stated internal scope.

The later [targeted DOL PDF review](../work/dol-claims-window-header-followup-2026-11-17.md) fetched all **38 claims dates** that intersect a fixed interval at the scheduled 08:30 Eastern proxy. Each current historical PDF returned HTTP 200 and its first-page header agrees on date and 08:30 Eastern; one is the Wednesday 27 November 2024 holiday exception. Source receipts and PDF hashes are retained. The other 118 archive links were not fetched in this check, and no correction/reissue or original network-publication census is established.

For Census, [2022](https://www.census.gov/economic-indicators/calendar-listview-2022.html), [2023](https://www.census.gov/economic-indicators/calendar-listview-2023.html) and [2024](https://www.census.gov/economic-indicators/calendar-listview-2024.html) calendars were captured as native HTML, with receipt/body/row hashes and hidden release/reference IDs checked. BLS and BEA inventories preserve qualified web-text evidence where native capture was unavailable. A web-text hash identifies that representation, not original release-day HTML or PDF bytes.

A [later Census clock check](../work/census-retail-clock-followup-2026-11-17.md) found explicit EDT/EST headers for three selected monthly releases and separate annual revision notices in 2022 and 2024. These checks narrow the timezone question for those three documents; they do not generalize automatically to all 36 releases or settle the revision-flow scope.

Retrospective official-calendar completeness and original network first availability are separate questions. Schedules and release headers can support a bounded calendar audit when reconciled with notices; they do not prove when a trader first received the data. The current gate remains open because source/notice coverage, some clocks and scope are unresolved. No interval is declared clean from an incomplete inventory, and no controls are replaced.

Detailed local records:

- [BLS report](../work/bls-core-overlap-route-2026-11-17.md) and [inventory](../work/bls-core-overlap-route-2026-11-17.json).
- [BEA report](../work/bea-core-overlap-route-2026-11-17.md) and [inventory](../work/bea-core-overlap-route-2026-11-17.json).
- [Census report](../work/census-retail-overlap-route-2026-11-17.md) and [inventory](../work/census-retail-overlap-route-2026-11-17.json).
- [Industrial production and claims report](../work/claims-ip-overlap-route-2026-11-17.md) and [inventory](../work/claims-ip-overlap-route-2026-11-17.json).

These are source and timing findings. No new yield changes, return calculations, forecast scores or broader-exclusion result were produced. Existing study outcomes were known before this continuation; no new outcome-blind research history is claimed. All additions are outside the unchanged V1.4 the assistant ZIP.

An [independent metadata check](../work/census-and-interval-independent-check-2026-11-17.json) passed all 23 checks: all 36 Census rows and all 133 projected intervals agree with their saved sources, with no outcome fields inspected by that reader. The [combined validation](core-macro-overlap-validation-2026-11-17.json) binds the four family inventories, verifies hashes and lengths for 121 saved source bodies, and checks the receipt-header allowlist. It validates this bounded catalogue, not broader calendar completeness.
