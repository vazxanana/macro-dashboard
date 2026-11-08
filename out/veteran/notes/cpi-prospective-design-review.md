# Prospective core-CPI pilot — independent design review

Reviewed 8 November 2026 against the current forecast ledger, evaluation-plan and evidence schemas, evaluator implementation and guide. This note assesses design only. It does not verify current numerical inputs, issue a forecast, register a plan, or establish that an October outcome remains unpublished. The parent source reviewers must establish those facts from current official sources before issuance. Frozen V1 and all output deliverables were left unchanged.

## Recommendation

The proposed fixed equal-weight blend is defensible as a transparent, unvalidated pilot point model:

`forecast_m = 0.5 × Cleveland_nowcast_m + 0.5 × latest_available_BLS_first_release_core_mom`

Use the last term alone as the predeclared persistence baseline. Freeze the weights, input-selection rule, target and scoring rule before issuance. This makes a real prediction that can lose to its baseline. It does not establish optimal weights, independent corroboration, calibrated uncertainty or an advantage over the Cleveland model itself. A single resolved case would prove operation of the research cycle, not skill.

The blend combines a current model estimate with persistence; the inputs may overlap. Describe their common CPI information instead of counting two independent signals. There is no empirical justification yet for the 50% weight. It is a deliberately simple initial specification, and it may dilute a better Cleveland forecast. Preserve the pure Cleveland input for a secondary, predeclared comparison; do not select the preferred comparator after the result. If a second comparison is formally scored with the current evaluator, give it a distinct frozen specification/report and do not count the same monthly outcome twice as independent evidence.

## Target, units and score

- Target the U.S. city-average **CPI-U, all items less food and energy, seasonally adjusted one-month percentage change**, for the specified reference month, exactly as displayed in the first official BLS release. The source reviewer should confirm the exact table/field and any series identifier; do not substitute C-CPI-U, NSA/y/y, annualized change, or a rate recomputed from today's revised index levels.
- Resolve the displayed one-decimal rate. Keep an unrounded model calculation from its captured inputs: for illustration only, inputs 0.21 and 0.30 would blend to 0.255. These numbers are not this note's verified inputs or an issued forecast. Extra arithmetic digits do not imply corresponding forecast precision.
- Use a clear unit such as `percent change, month-over-month, seasonally adjusted; numeric 0.3 means 0.3 percent`. A value of 0.3 is not 0.003. Squared error is in squared percentage-point units. Preserve the native labels alongside normalized units.
- Declare `point_functional: mean` and `squared_error`. This is an attempted conditional-mean forecast of the **published rounded outcome**. A weighted average of component point estimates is not proof that it equals that conditional mean. Do not round the model to one decimal before scoring merely to match the display, and do not switch to absolute error after seeing which method wins. Matching the point directive and loss is the central requirement in [Gneiting (2011)](https://www.bundesbank.de/resource/blob/635562/7d3de0f3fc003e5b4864828143f268cf/mL/2012-06-01-eltville-11-gneiting-paper-data.pdf).
- First-release resolution must be frozen. BLS recalculates seasonal factors annually and may revise the preceding five years of seasonally adjusted indexes. Preserve first-release bytes or clearly identified release captures; a later live series is not automatically the original print. [BLS seasonal adjustment](https://www.bls.gov/cpi/seasonal-adjustment/home.htm)

## Timing and a comparable cohort

1. Write the actual plan creation time first. Capture source inputs and their known receipt/availability times. Issue and record the forecast only afterward. The current prospective-mode checks require plan creation no later than issuance, plan creation before the registered cutoff, evidence availability no later than the information cutoff, and both issuance and recording strictly before the cutoff.
2. `selection: initial` is the cleanest first pilot: later research can append updates, but the primary evaluation remains the issued snapshot. Register the case even if a later outage leaves it unissued or unresolved.
3. Do not label a new 8 November issuance as exactly T−48 hours if the source-confirmed release is 10 November at 13:30 UTC: the current session clock was already about 14:01 UTC on 8 November. Either keep this as an initial pilot with its actual lead time, or explicitly freeze a broader window (for example, one initial issuance 24–72 hours before the scheduled release) and report every actual lead time. A later fixed-lead study should have its own cohort. Do not manufacture an earlier issue timestamp.
4. Decide the repeatable rule for future monthly cases before their outcomes: which scheduled release is eligible, when the window opens/closes, what happens on rescheduling, whether a weekend-stale nowcast is permitted, and how a missing input is reported. A stale but genuinely latest captured forecast can be usable if its age is explicit. Do not silently replace a missing Cleveland value or choose a different month.
5. The plan requires explicit timestamps for registered cases. Do not invent future BLS release dates or imply that a single registered month is a large cohort. Add future cases through a separately timestamped plan version before those outcomes, retaining the earlier version. For a stronger evaluation, freeze a consecutive multi-month set once its official calendar is known, including unavailable/unissued cases.
6. Keep `cohort.variable`, population, unit, horizon, method version and resolution contract generic and identical across months. The forecast target's outcome description supplies the specific reference month. If the frozen rule literally says “October 2026,” a November case needs a different resolution contract and cannot be pooled under the current evaluator's exact contract comparison. Direct release URLs can differ; the shared contract should identify the same measurement rule.

## Reference time versus publication time

The monthly reference period, source publication, local receipt, forecast issuance and later resolution are different clocks. A nowcast can be issued after its reference month ends.

The current evaluator's `target.deadline_utc` is used as an outer target/resolution window and must be no earlier than the eligibility cutoff. **Do not set it to 31 October simply because October is the reference month:** that rejects a genuine November nowcast. Set a declared resolution deadline after issuance and specify the missing/delay rule. If the value is not officially available by that rule, retain the unresolved case; do not substitute November CPI or a vendor reconstruction.

The resolution snapshot requires scalar `observed_at_utc` even though CPI is a monthly observation. If encoding the reference-period endpoint there, explicitly call it a **reference-period timestamp convention**, not a directly observed price, collection instant or publication time. Keep the reference month in the target and supporting evidence, and keep the established actual publication time separate. The evaluator checks `observed <= published <= retrieved <= resolved <= recorded`; the supplied mapping needs review because a schema cannot establish the economic meaning of those clocks.

For reference input records, a conservative `available_at_utc` can be this project's first successful receipt time, explicitly labeled as such; it must not claim that this was the source's first public availability. If a browser/search connector supplies rendered text, retain the returned artifact and label it as a connector capture. Its hash is not a hash of unobserved publisher HTTP bytes. Record both the source's stated as-of date and the local receipt time.

## Missing metadata must stay missing

Prospective mode requires `strict_known_availability` and `require_publication_and_unit`. Every referenced evidence record must be supplied with known availability no later than the information cutoff. Unknown original publication time does not itself block an input whose actual receipt is known; preserve the distinction.

For the future resolution, a scheduled/embargo time is not automatically actual publication. Do not fill `published_at_utc` with a guessed scheduled time merely to obtain a scored status. If the actual timestamp cannot be established, the strict evaluator correctly leaves the result `resolution_unverified`, even if the numerical outcome is known. Document the limitation or separately specify an honestly labeled research evaluation; do not relabel a permissive result as fully verified prospective performance.

Use `outcome: null` and `scores: []` for a pending resolution attempt, then append a completion if warranted. Do not append a pending attempt solely because a release is still in the future: an issued forecast with no resolution already remains unresolved. Outcome scores must come from actual BLS data, never the model itself.

## Minimum reviewable registration bundle

- A dated method/protocol fixing the formula, baseline, input-selection rules, exact target, rounding convention, scoring loss, case set, issuance horizon/window, rescheduling and missing-source treatment.
- The actual plan, immutable issuance record, referenced evidence records, saved capture artifacts and current hashes. A computed forecast can cite the two source input records directly and state its arithmetic in the rationale; no invented backdated derived observation is needed.
- Explicitly named source dependence, input ages, one-decimal target discretization, seasonal-revision exposure and absence of an established edge.
- A schema-validation report and a current evaluator report showing the real case **unresolved** while its outcome is still in the future. Passing code checks does not authenticate source truth.
- Evidence outside editable local files if a later performance claim requires independent historical precommitment. Without it, accurately call this a locally recorded prospective pilot, with unauthenticated external timing, rather than an independently verified track record.

The parent can proceed with the pilot if current primary sources confirm the target is not yet public and both inputs are actually captured. Otherwise preserve the attempted registration and source gap; do not disguise an already known outcome as a forecast.
