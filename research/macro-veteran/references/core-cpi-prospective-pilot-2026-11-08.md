# Core CPI: first locally registered prospective pilot

**Issued:** 8 November 2026, 14:12:31.228 UTC. **Target:** October 2026 first-release core CPI-U, U.S. city average, seasonally adjusted monthly percent change. **Research point estimate: +0.255% m/m.** The case is unresolved; no forecast-performance score exists yet. This is an unvalidated mechanical experiment, with local timestamp/hash evidence rather than externally authenticated precommitment.

The captured BLS calendar schedules the release for **10 November, 08:30 Eastern / 13:30 UTC**. Actual publication has not been observed. Issuance was approximately **47.2913 hours** before that schedule, within the declared 24–72-hour window. It is not an exact 48-hour forecast. [BLS calendar](https://www.bls.gov/schedule/2026/11_sched_list.htm)

## What was fixed before issuance

The [six-month protocol](cpi-pilot-protocol-2026-11-08.json) names consecutive reference months October 2026–March 2027, the model, comparisons and missing-case policy. The [first absolute evaluation plan](cpi-pilot-evaluation-plan-2026-10.json) was created at 14:12:31.143 UTC, before issuance. At that time, only the first case had a captured absolute calendar plan. A later [calendar addendum](cpi-pilot-calendar-addendum-2026-11-08.json), created at 14:28:25.102 UTC, preserves a new official calendar capture and five future plans. Those plans contain no future forecast or baseline values. Retain all six in the eventual cohort accounting, including omissions.

| Reference month | Captured scheduled release, UTC | Absolute evaluation plan |
|---|---|---|
| October 2026 | 10 November 2026, 13:30 | [Original October plan](cpi-pilot-evaluation-plan-2026-10.json) |
| November 2026 | 10 December 2026, 13:30 | [November plan](cpi-pilot-case-plans/2026-11.json) |
| December 2026 | 13 January 2027, 13:30 | [December plan](cpi-pilot-case-plans/2026-12.json) |
| January 2027 | 11 February 2027, 13:30 | [January plan](cpi-pilot-case-plans/2027-01.json) |
| February 2027 | 10 March 2027, 13:30 | [February plan](cpi-pilot-case-plans/2027-02.json) |
| March 2027 | 13 April 2027, 12:30 | [March plan](cpi-pilot-case-plans/2027-03.json) |

Each date is 08:30 Eastern in the captured [official CPI-specific calendar](https://www.bls.gov/schedule/news_release/cpi.htm); April's UTC conversion includes daylight saving time. These remain mutable schedules. Recheck before each future issuance and preserve changes separately; do not backdate a plan or copy October's numerical forecast into future cases.

| Item | Frozen choice |
|---|---|
| Model | `0.5 × captured Cleveland core nowcast + 0.5 × latest available archived BLS core monthly print` |
| Current inputs | `0.21` and `0.30`, giving `0.255`; retain the unrounded arithmetic result |
| Primary comparison | Captured Cleveland core-CPI monthly nowcast, `0.21`; public model, not survey consensus |
| Secondary comparison | Latest archived monthly core print, `0.30`; calculate its squared error on every resolved case |
| Scoring directive | Point mean, squared error; differences are in percentage points and losses in squared percentage points |
| Version selection | Initial issuance; a later view cannot replace the primary forecast |
| Eligibility cutoff | 9 November 2026, 13:30 UTC, one day before the captured scheduled release |
| Resolution deadline | 17 November 2026, 13:30 UTC, seven days after that schedule |
| Missing or delayed data | Preserve missing/unverified status and original dates; no imputed outcome or silent reclassification |

The source inputs were received locally at 14:05:32.788 UTC for the BLS archive and 14:05:33.380 UTC for Cleveland. Cleveland's source table is labeled updated **6 November**; that label does not establish an archived 6 November receipt. BLS's archived September core value is **0.3%**, also shown for August; the following **2.6%** column is annual. The source archive captured now does not prove unchanged original release-day bytes. [Cleveland table](https://www.clevelandfed.org/indicators-and-data/inflation-nowcasting), [BLS September release](https://www.bls.gov/news.release/archives/cpi_10142026.htm)

## What this model tests

This experiment gives the most recent core print more weight than Cleveland's published smoothing rule. The weights were not fitted to a historical performance search. They are a transparent candidate whose value remains to be measured. A recent higher observation could represent persistence worth retaining or noise worth smoothing; this case cannot distinguish those reliably.

Cleveland's published technical specification uses a recursive 12-month average for core inflation. Its missing-data notice describes estimated October 2025 inputs and implied November monthly changes. **Analyst inference:** under that specification, the October 2026 lag window includes both affected months. The blend combines overlapping lagged-core information and does not add an independent daily energy signal. Exact replication would require the input vintages and unrounded implementation. [Technical FAQ](https://www.clevelandfed.org/-/media/project/clevelandfedtenant/clevelandfedsite/indicators-and-data/inflation-nowcasting/nowcasting_faqs.pdf), [missing-input method](https://www.clevelandfed.org/-/media/project/clevelandfedtenant/clevelandfedsite/indicators-and-data/inflation-nowcasting/inflation-nowcasting-model-methodological-approach-to-missing-october-and-november-2025-cpi-data.pdf)

The extra decimal in `0.255` reflects the calculation, not demonstrated forecasting precision. The target is the **exact one-decimal published first-release monthly change**, not a reconstructed unrounded change from the index, a later seasonally revised value, a year-over-year comparison or C-CPI-U. `CUSR0000SA0L1E` identifies the underlying seasonally adjusted index; it is not itself the monthly percentage-change field.

## A useful limit visible before the result

These are **hypothetical outcomes**, not observations or scores in the real ledger:

| Possible published outcome | Blend loss `(0.255 − y)²` | Cleveland loss `(0.21 − y)²` | Persistence loss `(0.30 − y)²` |
|---|---|---|---|
| `0.2` | `0.003025` | `0.000100` | `0.010000` |
| `0.3` | `0.002025` | `0.008100` | `0.000000` |

The blend beats Cleveland when `y > 0.2325`, and persistence when `y < 0.2775`. No one-decimal outcome lies between those thresholds, so this single case cannot beat both comparisons at once. Across several cases, average losses can rank differently. Preserve the declared primary comparison and show the secondary one even if it is less flattering; do not select a benchmark after seeing the outcome.

## Source and registration evidence

The [six evidence records](cpi-pilot-evidence-2026-11-08.json) distinguish reported inputs, methodological qualifications and the current calculation. Known completed receipt times establish conservative input availability for this issuance. Original publication timestamps remain null. The [source manifest](cpi-pilot-source-manifest-2026-11-08.json) records five successful publisher responses, hashes, byte counts, retrievals and exact extracted rows. Raw files remain in `work/raw/cpi-pilot-sources-2026-11-08/` for local audit; the portable manifest is metadata, not a replacement for those bytes. It explicitly identifies the successful timestamped capture manifest and retains the earlier failed-attempt history separately.

The [JSONL ledger](cpi-pilot-forecast-ledger.jsonl) contains one real issuance and no resolution. Its [initial evaluator report](cpi-pilot-initial-evaluation-2026-11-08.json) records one unresolved case, all referenced input availability supplied, and no aggregate scores. A later [CPI-specific evaluation](cpi-pilot-guarded-initial-evaluation-2026-11-08.json) applies additional checks to that same issuance. The [registration validation](cpi-pilot-registration-validation-2026-11-08.json) states the checks and remaining limits. Current files and supplied clocks cannot authenticate an immutable historical record on their own.

**Post-registration review:** synthetic rehearsals showed that the general scorer does not interpret the pilot's prose deadline, upper issuance-window limit or one-decimal field convention. The separate [CPI evaluator](scripts/evaluate-cpi-pilot.mjs) enforces those already declared rules, adds persistence losses and shows intended cases versus cases in the supplied plan. Its [tests](scripts/evaluate-cpi-pilot.test.mjs) use synthetic future outcomes without adding them to the real ledger. It does not authenticate a source's first-release identity, calendar accuracy or publication clock. This adds verification to the original contract and does not change the issued forecast.

To check the inputs and create a new local view, use the [evaluation guide](forecast-ledger-evaluation-guide.md). With the already installed validator packages in this workspace:

```powershell
New-Item -ItemType Directory -Force work/cpi-pilot-evaluation | Out-Null
node outputs/scripts/validate-forecast-inputs.mjs --modules work/schema-validator/node_modules --ledger outputs/cpi-pilot-forecast-ledger.jsonl --plan outputs/cpi-pilot-evaluation-plan-2026-10.json --evidence outputs/cpi-pilot-evidence-2026-11-08.json
node outputs/scripts/evaluate-cpi-pilot.mjs --ledger outputs/cpi-pilot-forecast-ledger.jsonl --plan outputs/cpi-pilot-evaluation-plan-2026-10.json --protocol outputs/cpi-pilot-protocol-2026-11-08.json --evidence outputs/cpi-pilot-evidence-2026-11-08.json --out work/cpi-pilot-evaluation/current-view.json
node --test outputs/scripts/evaluate-cpi-pilot.test.mjs
```

The CPI command requires a fresh output filename and refuses to replace any existing file. Its schedule check derives the captured release from the frozen case cutoff plus 24 hours, rather than querying a live calendar. Its six-case accounting is local to the supplied plan; other absolute case plans may exist elsewhere. The current master ledger schema adds comparator type `published_model`; use that schema for this case. The frozen V1 schema and archive remain historical copies.

To reproduce the original registration view, add `--as-of 2026-11-08T14:12:31.252Z` to the evaluator command. Without that option it uses the current clock and reports the chosen as-of explicitly.

The arithmetic 24–72-hour window is necessary but does not override the strict cutoff: both issuance and recording must be **before** T−24h. An issuance exactly at that boundary remains visible as `no_eligible_snapshot`; it is not silently scored or dropped. The companion `status_counts` retains every case status for reconciliation.

## Resolve only after the primary release

Capture the official initial October release and relevant table before interpreting later market moves. Establish the first-release vintage, exact row, reference month, displayed monthly value, actual publication evidence and receipt time. Preserve any later correction separately. If the original first print cannot be established, retain the uncertainty instead of silently using the current page.

For this monthly reference record, encode `observed_at_utc` as `2026-10-31T23:59:59Z` and explicitly identify it as a **reference-period endpoint**, not an actual measurement or publication instant. Keep actual publication, retrieval, resolution and recording times separate. The target's later deadline is a resolution limit, not the reference-period end. Strict evaluation remains `resolution_unverified` if actual publication timing or matching outcome units cannot be established; a schedule or receipt is not a substitute.

The later [official-feed timestamp audit](bls-publication-timestamp-audit-2026-11-08.md) found concrete reasons to keep this distinction: feed metadata can precede an embargo or refresh without a new CPI observation. That review occurred after issuance and is not retroactively represented as an original forecast input.

Actual publication must be no later than the frozen deadline. Test a candidate resolution in a separate copy with the CPI-specific evaluator before appending it to the real ledger; the general scorer's `scored` status alone does not establish compliance with this pilot contract. A nonempty vintage label also cannot authenticate the first print.

Append the resolution to the existing issuance only after those checks. The main outcome stays the first release. The CPI evaluator recomputes its primary loss against the captured `0.21` and separately reports `(0.30 − outcome)²` using the uniquely matching supporting BLS record. Missing or ambiguous secondary evidence stays unavailable without dropping the primary case; verify the actual source row and previous reference month manually. Report all missing cases, actual lead times, corrections, paired counts and source limitations before any aggregate claim. One resolved case would demonstrate an operational cycle, not superior forecasting skill or a trading edge. The experiment does not connect to cTrader or enable live trading.
