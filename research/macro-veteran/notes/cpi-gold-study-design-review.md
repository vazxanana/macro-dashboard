# CPI and gold: identification review and bounded historical design

Prepared 8 November 2026. Scope: a proposed repeated-event analysis for releases dated 2022–2024. This reviewer has not inspected the study's gold returns, rate changes, event/control contrasts, or model coefficients. This document proposes a specification for the coordinating researcher to freeze before computing those statistics; it is not evidence that a freeze has already happened. Other researchers must disclose any results they have already inspected.

## Decision

The viable first gold question is: **Were absolute changes in a specified daily gold-backed fund valuation larger in CPI-release-date windows than in calendar-matched non-CPI windows?** This is a descriptive release-calendar association. Daily data and archived CPI first prints alone cannot identify an inflation-surprise shock, a causal gold response, or a five-minute trading strategy.

Proposed primary gold outcome: **official GLD USD NAV per share**, conditional on both a verified historical field definition and permission for the intended analysis. Do not switch the primary outcome to GLD market close, LBMA PM, or another vendor after inspecting results. An accessible workbook does not itself establish permission to use or redistribute its contents. If the rights or data gate fails, publish the event/coverage audit with the gold analysis explicitly unavailable. A separately specified Treasury daily-rate module can still produce genuine findings; it does not become a substitute gold test.

The design is retrospective. Freezing it now limits choices made after this computation; it does not make 2022–2024 a prospective preregistration or an untouched holdout. A 2024 subperiod can be a temporal comparison, with those limits stated.

## What the available combinations support

| Inputs available | Defensible analysis | Claim not supported by those inputs alone |
| --- | --- | --- |
| Official release dates + daily GLD NAV or a daily gold benchmark | Daily-window movement and release-calendar association | Exact 08:30 reaction, execution return, CPI causality |
| Above + archived CPI first prints | Description of the released inflation data; exploratory association with inflation levels or acceleration | Calling actual-minus-previous CPI an expectation surprise |
| Above + demonstrably pre-release, target-matched survey consensus | Association between the measured survey forecast error and the full daily outcome window | A pure CPI shock, a five-minute effect, market-wide expectations |
| Above + an archived, frozen pre-release model nowcast | Association with a named model's forecast error | Survey consensus or market consensus |
| First prints + correctly timestamped expectations + permitted intraday gold quotes | Narrower event reactions, subject to simultaneous news, latency, liquidity and timestamp checks | Automatic causal identification or net tradability |
| CPI calendar + official Treasury daily yields, gold unavailable | Daily rate-movement association on the same release cohort | A gold result, a demonstrated gold transmission channel |

Headline and core, monthly and annual rates, and survey and model expectations are different variables. Do not pick whichever definition produces the largest coefficient. A prior published inflation figure is information about the past, not an expectation of the new figure. A revised historical CPI series is not a substitute for the number first announced.

## Endpoint clocks: the central trap

The issuer's October 2022 prospectus sets GLD NAV on a regular NYSE Arca trading day at the earlier of the London afternoon gold determination or noon New York; valuation uses the LBMA PM benchmark. The issuer dashboard distinguishes NAV establishment from a 16:00 New York bid/ask midpoint and a separate 16:30 gold spot reference. NAV, market close, midpoint and spot-reference fields must retain their own labels. The prospectus also describes expenses paid from trust assets, so a NAV change is not exactly the change in an unencumbered ounce of gold. Confirm the applicable historical methodology for January–September 2022 before extending the later prospectus backward. [Historical issuer prospectus](https://files.spdrgoldshares.com/spdr-cms/2025-10/GLD_Prospectus_10042022_as_filed.pdf), [issuer data and field notes](https://www.spdrgoldshares.com/usa/gld/).

IBA's afternoon gold auction **starts** at 15:00 London local time; the setting follows the auction rounds. The scheduled start is not an exact auction-end or publication timestamp. Daily benchmark receipt and public website availability are also distinct. Benchmark use is subject to licensing; verify the intended analysis, storage and output rights rather than assuming that only redistribution is restricted. [IBA benchmark description](https://www.ice.com/iba/lbma-precious-metals), [LBMA benchmark information](https://www.lbma.org.uk/prices-and-data/lbma-precious-metal-prices).

| Clock or window | Date-specific interpretation |
| --- | --- |
| CPI calendar anchor | Normally scheduled 08:30 `America/New_York`, not a fixed UTC time. The archived calendar remains the source for each event. |
| CPI UTC conversion | 13:30 UTC during New York standard time; 12:30 UTC during daylight time. |
| LBMA PM scheduled start | 15:00 `Europe/London`: 15:00 UTC in winter and 14:00 UTC in summer. Usually 10:00 New York, but 11:00 during the US/UK daylight-saving mismatch. |
| GLD NAV outcome | Prior valuation to release-date valuation; gold pricing is linked to the PM setting, with the prospectus's noon fallback. Do not relabel this 08:30-to-10:00 or close-to-close. |
| GLD exchange close outcome | Prior regular-session close to release-date regular-session close; includes overnight news and later US announcements. Verify actual session end on shortened sessions. |
| Treasury daily outcome | Approximately 15:30 New York on the preceding Treasury observation date to approximately 15:30 on the release date. These are indicative quote-derived curves, not executed trades or exact time-stamped ticks. |

Use IANA time zones for both endpoints and record their UTC conversions. US and UK transitions occur on different dates in March and around late October/early November. A constant London-to-New-York offset creates wrong endpoint and overlap classifications. Match the valuation window's duration and clock phase, not merely a date label. If exact auction setting times are unavailable, store scheduled-start proxies explicitly and mark news near the uncertain endpoint as ambiguous.

Bank holidays differ between London and New York. A US trading day can have a stale or fallback benchmark. Check the valuation rules and calendars; an unchanged number is not by itself proof of staleness. NAV calculation/publication time is not necessarily the time of its underlying gold price. Nothing in daily data reconstructs the price available to a trader at 08:29:59.

## A real release-timing irregularity to retain

BLS documented that a subset of CPI and Real Earnings files was inadvertently loaded roughly 30 minutes before the scheduled 15 May 2024 release. This is an official early-posting notice, stronger evidence than a suspicious feed timestamp. It does **not** establish the exact first-public availability of every headline or core field or who accessed it. The official May calendar scheduled both releases for 08:30 Eastern. [BLS early-posting notice](https://www.bls.gov/cpi/notices/2024/early-data-release-05152024.htm), [May 2024 BLS calendar](https://www.bls.gov/schedule/2024/05_sched_list.htm).

Keep 15 May in the primary daily calendar-association cohort, flag it, and predeclare an exclusion sensitivity. The daily question does not require every market participant first to learn all data precisely at 08:30. Any future narrow intraday study must treat this event separately and cannot infer a clean 08:30 shock.

## Proposed primary gold specification to freeze

### 1. Cohort and records

Define the cohort by **actual release dates from 1 January 2022 through 31 December 2024**, expected to contain 36 monthly CPI releases. This is not the cohort of reference months January 2022–December 2024, which shifts the release boundary. Verify every date against BLS archived releases/calendar, including any rescheduling. Keep all expected events in a coverage ledger whether or not an outcome is usable.

One event record should hold: event ID, reference month, scheduled local and UTC time, actual-availability evidence/status, original-release link, retrieved timestamp and source hash, first-print headline/core monthly and annual values with units and adjustment status, correction flags, endpoint dates, endpoint definitions, calendar/clock signature, data/rights status, matched control IDs, overlap flags and exclusion reason codes. Missing CPI-value parsing should not remove a date from the calendar-only primary test if the release date is verified.

### 2. Outcome and endpoint validity

Let `N(d)` be verified official USD NAV/share for release date `d`. Let `p(d)` be the **expected immediately preceding valid NAV valuation date under the documented calendar**, not an arbitrary earlier nonmissing row. Define:

`r(d) = 100 × ln[N(d) / N(p(d))]` percentage log change.

`A(d) = |r(d)|` absolute percentage log change.

Both endpoints must be valid, positive, uniquely identified and backed by fresh/applicable valuation methodology. Do not silently skip a missing expected valuation to create a multi-day interval. A legitimate holiday gap is allowed and matched as such; an unexplained missing observation is not. Do not forward-fill, interpolate or winsorize the primary outcome. A genuine unchanged valuation is retained unless independent calendar/methodology evidence shows staleness.

The outcome covers the whole prior-NAV-to-current-NAV interval. Its return can contain overnight developments, pre-release positioning, CPI/Real Earnings, other morning news, auction dynamics and fund expenses. Call it a **release-date NAV-window change**, not an abnormal gold return from 08:30.

### 3. Calendar-matched non-CPI comparisons

For each event, eligible controls are other valid outcome-ending dates in the **same calendar year-month and same weekday**, with the same:

- calendar-day gap between expected prior and current valuations;
- London/New York offset signature at both endpoints;
- scheduled endpoint-duration signature after converting both endpoints to UTC.

Exclude all CPI release dates and the immediately preceding and following valid valuation dates around each CPI release. Apply the same data-validity rules to controls. Build this set without looking at changes or signs. Use all eligible controls; do not select the closest-looking return. Retain an event as unscored with `no_matched_control` if none remains. One control is permitted, and the count is reported; matching the US/UK clock phase can leave very few controls in March. Do not relax matching in response to an inconvenient estimate. A relaxed matching scheme would require a named, separately reported amendment or exploratory analysis.

Calendar matching is a modest comparison for time-of-month, day-of-week and local market conditions. It does not randomly assign CPI dates or remove every difference in other release schedules.

### 4. Single primary contrast

For event `e`, with frozen controls `C(e)`, calculate:

`D(e) = A(e) − mean[A(c) for c in C(e)]`.

Primary statistic: the **mean of D(e), equally weighting eligible events**. Report units in percentage points of absolute log change. Show the number of intended and scored events, control counts, event mean absolute change and the mean of the event-specific control means. Do not pool all controls in a way that gives more weight to months having more controls.

This contrast answers a movement-size question. It is not a signed response to positive CPI surprises. The mean signed return, median contrast, fraction of positive contrasts and event/control ratio may be descriptive secondary outputs, clearly subordinate to the frozen statistic.

### 5. Uncertainty and a stopping rule

Report the event-level table and the primary estimate even if it is uninteresting. For an approximate dependence-aware uncertainty display, prespecify a circular moving-block bootstrap over the **36 calendar-month slots**, three consecutive slots per block, 12 sampled blocks per replicate, 10,000 replicates and seed `6771`. Carry missing/unscored slots through resampling and average the eligible contrasts in each replicate; report the 2.5th/97.5th percentiles and number of invalid all-missing replicates. Missing months are never compressed into adjacent observations. A six-month-block version is a declared sensitivity.

With at most 36 events, these intervals rely on weak-dependence and approximate stability assumptions and can be fragile across the 2022–2024 regime change. They are not a randomization test or proof of causality. Do not issue a conventional independent-daily-observation t-test with controls treated as independent evidence. The primary finding is the specified finite-sample association plus its limited uncertainty assessment.

If the contrast is nonpositive, the proposed concentration is absent or reversed in this comparison. If the interval spans zero, state that the comparison does not resolve a positive concentration at this precision. Do not rescue the primary question by changing the endpoint, direction, subperiod, inflation measure or control set. If data or rights make the gold test impossible, stop that test at the coverage gate and report the failure, rather than silently renaming a rates result.

## Overlap and interpretation register

Build overlap flags from **each actual outcome interval**, not only from the event's calendar date. Headline, core and component CPI figures arrive as a bundle; the BLS Real Earnings release is another simultaneous announcement. A daily study cannot isolate each component's contribution. For example, the BLS May 2024 calendar shows CPI and Real Earnings together. This fact limits specificity even on a day without other scheduled releases. [BLS May calendar](https://www.bls.gov/schedule/2024/05_sched_list.htm).

For the event and control intervals, register official release times for at least FOMC statements, employment/payrolls, PPI, retail sales, GDP/PCE, industrial production, weekly unemployment claims and major scheduled central-bank decisions. Include recorded material Fed speeches/press conferences and Treasury auction timings when feasible. Regional surveys, geopolitical news and unscheduled announcements remain plausible unmeasured confounders. An incomplete register must be labelled incomplete; an unflagged event is not automatically a clean event.

The 12 June 2024 FOMC statement was released at 14:00 EDT. That is after the usual GLD NAV gold-setting window but before the exchange close and Treasury's approximately 15:30 quotes. A same-day FOMC dummy would therefore misclassify the NAV exposure while correctly warning about the later windows. Conversely, a previous-day 14:00 announcement can fall **inside** a prior-PM-to-current-PM window. [Federal Reserve statement and release time](https://www.federalreserve.gov/newsevents/pressreleases/monetary20240612a.htm).

Keep all qualifying dates in the primary calendar association. A prespecified overlap-exclusion sensitivity can remove windows containing independently timed major announcements, but it remains a selected, smaller descriptive sample. Publish the complete list and exact interval rule, rather than calling the remainder causal CPI shocks. Do not exclude simultaneous Real Earnings ad hoc: doing so would largely eliminate the intended event bundle.

Do not automatically add same-window USD or interest-rate changes as causal regression controls. They may carry part of the response to the news, so conditioning on them changes the question and can obscure the total association. Their co-movement may be reported as a separate descriptive mechanism check, with mismatched endpoint clocks disclosed.

## Predeclared secondary analyses and falsification

The following are the planned secondary variants; report each under its own label rather than searching for a preferred result:

1. Omit 15 May 2024, the documented early-posting event.
2. Omit windows flagged by the frozen major-announcement overlap rule, with coverage and reasons shown for both events and controls.
3. Show 2022, 2023 and 2024 separately and leave one year out. Show leave-one-event influence on the primary estimate. These are instability checks, not regime selection.
4. Repeat the uncertainty display with six-month blocks.
5. If permission, definitions and complete historical endpoints are independently verified, repeat the movement-size question for GLD regular-session market close and/or LBMA PM. They are different windows and remain secondary even if more significant. No silent data-source splicing.
6. Compute a **pre-event placebo** by shifting each event ending date to its preceding expected valid valuation date and rebuilding controls with the same rules around that pseudo-event. A similarly large pre-event concentration weakens the claim that the pattern is specific to the announcement window; it can also reflect anticipation or overlapping news. It does not establish what caused either pattern. The following-day window may be displayed as a labelled follow-through description, not a replacement primary outcome.

Any additional horizon, inflation sign threshold, surprise proxy, asset, regression control, matching rule or date exclusion is exploratory and enters an analysis-choice log. Display the full family of reported variants; a favourable secondary result does not reverse an unsupported primary claim.

## Optional independent Treasury rates module

This module may proceed if the gold-use gate is unresolved. Freeze it **before inspecting historical rate changes or event/control contrasts**. If those statistics have already been viewed, label the module exploratory. It uses the same 2022–2024 release-date ledger but its own endpoint and calendar rules.

**Primary rates outcome:** absolute change in the official **10-year Treasury par real constant-maturity yield**, in basis points. **Secondary:** corresponding absolute change in the official 2-year nominal par constant-maturity yield. Do not subtract 10-year real from 2-year nominal and call the result breakeven inflation; maturities differ. A yield change is not a bond total return.

Treasury explains that nominal and real par curves use indicative market inputs around 15:30 each business day. These are interpolated maturity points, not necessarily yields of an outstanding security with exactly that remaining maturity. The late-2021 curve-method change predates the proposed cohort, but preserve methodology and historical revision notes. [Treasury interest-rate definitions](https://home.treasury.gov/policy-issues/financing-the-government/interest-rate-statistics), [Treasury daily-rate notes](https://home.treasury.gov/resource-center/data-chart-center/interest-rates/TextView?type=daily_treasury_real_yield_curve_rates).

For series `j`, with reported yields in percent, define `b_j(d) = 100 × [y_j(d) − y_j(p_j(d))]` basis points, where `p_j(d)` is the expected immediately preceding Treasury observation date. The interval is approximately prior 15:30 New York to event-date 15:30 New York. Require both observations; retain genuine zero changes and negative real-yield levels; do not log yields, interpolate or forward-fill missing dates.

Use non-CPI controls from the same year-month and weekday, with the same calendar-day observation gap and New York UTC-offset signature at both endpoints. The London clock is irrelevant to this rates-only module. Exclude CPI dates and immediately adjacent valid Treasury observation dates as above. Require at least one control. Apply the identical event-equal-weight contrast and calendar-slot bootstrap procedure to `|b_real10Y|`. Show 2-year nominal under a secondary label, not as a second chance at the primary result. If both are elevated to primary tests later, disclose the amendment and adjust family-wise inference rather than presenting two unadjusted successes.

Use the rates interval for overlap flags. In particular, the same-day 14:00 FOMC announcement is inside this window. Predeclare the early-posting omission, major-overlap omission, yearly/influence displays and six-month-block sensitivity. A table of signed changes can describe direction, but the primary test remains movement size. No CPI directional surprise claim follows merely from a signed daily average.

Valid final wording is: **“During 2022–2024, CPI-release-date daily 10-year real-yield changes were [larger/not clearly larger] in absolute size than the specified matched dates.”** Even a clear association does not demonstrate a causal CPI-to-rates-to-gold chain. If gold is unavailable, say so beside this finding. Gold and Treasury endpoint times differ, so their contemporaneous daily correlations do not establish sequence or mediation.

An auxiliary archived Cleveland Fed core-inflation model error, if verified, must use a target-matched pre-release snapshot and the actual first print. Name it a **model forecast error**, not consensus surprise. Freeze any regression target, units, intercept and sample before estimating. This is a separate auxiliary question and is unnecessary for the calendar-association module.

## Coverage, provenance and execution contract

Before calculating outcome statistics, preserve an auditable manifest with specification version/time, source URLs, file hashes, retrieved times, dataset fields/units, applicable rights status, historical calendars, source methodology, corrections and every intended event/control date. Resolve duplicate dates and conflicting values openly. Keep raw missing tokens separate from numeric zero. If source values have been corrected since the event, identify the version used; an archive page's present existence does not prove its exact availability to traders at the historical instant.

Publish a flow table starting with the expected 36 event dates: verified calendar; valid current/prior endpoints; freshness and rights gates passed; at least one matched control; primary scored sample. Add reason codes such as `missing_expected_prior`, `missing_current`, `unverified_field`, `stale_or_fallback_unresolved`, `no_matched_control`, `rights_unresolved`, and `timing_irregularity_flag`. The last is a flag rather than an automatic primary exclusion. Do not drop events because they look extreme or contradict a hypothesis.

A bounded successful deliverable is an event/coverage ledger plus the frozen matched-window comparison for whichever explicitly authorized module can actually run, its limitations, and all planned sensitivity results. No live trading, execution credentials or cTrader connectivity is needed for this research. Nothing in this design authorizes live trading.
