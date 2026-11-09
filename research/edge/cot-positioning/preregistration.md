# COT positioning: does large-speculator positioning predict 1- and 4-week returns? Pre-registration

Written **before** any information coefficient, any in-sample / out-of-sample split or any 1-year-percentile number below was computed. Nothing in it changes after the results are seen; anything added later is labelled post hoc in `RESULT.md`.

**Disclosure.** Before this was written, the COT desk's own whole-sample numbers (2020–26, no split) were visible in council-data `macro/cot.json`: hit rates and naive t for its two fixed signals ("extreme" 90th / 10th percentile, "flow" 1.5 sd), per market. Among them: GBP and CHF "extreme" over 4 weeks with naive t above 3, gold "extreme" over 4 weeks with t −2.0. Those t-stats ignore that 4-week returns sampled weekly overlap. That is why the overlap-robust statistics below are fixed in advance, and why a split is required.

## Question

The COT desk (`council/cot.mjs`) shows where speculators' net position sits in its range and how it changed on the week. The veteran's research pack treats positioning as crowding context, not a direction call, and the macro skill's prior is that COT crowding had about no edge for gold (IC about +0.01). This study asks whether that holds for **gold, the seven FX majors and the two US index futures**, with the release lag respected:

1. Does the **percentile of the speculators' net position** in its prior 1-year or 3-year range predict the next 1 and 4 weeks' return, contrarian (crowded long → lower returns)?
2. Does the **week-on-week change** (in standard deviations of the prior year's changes) predict them, following the flow?
3. Do **extremes** (top / bottom 10% of the 3-year range) predict a reversal, and more so when the **commercials sit on the other side**?

## Data

- **Positions:** CFTC Commitments of Traders, futures only, from the CFTC Public Reporting Environment (free; `publicreporting.cftc.gov`), as fetched by the council into council-data `macro/cot-raw.json` (report dates 2019-01-08 to 2026-11-03, one row per market per week). CFTC itself does not resolve from the research sandbox, so the council's own fetch is the copy used; `run.mjs` records the file's SHA-256 and coverage.
  - Gold: Disaggregated report, COMEX gold `088691`, speculators = **managed money**.
  - FX and indices: Traders in Financial Futures, speculators = **leveraged funds**. EUR `099741`, GBP `096742`, JPY `097741`, AUD `232741`, NZD `112741`, CAD `090741`, CHF `092741`, Nasdaq-100 mini `209742`, E-mini S&P 500 `13874A`.
  - Net = long − short contracts.
- **Prices:** the council's OANDA daily mid candles (council-data `research/daily/<sym>.json`: `xau`, `eurusd`, `gbpusd`, `usdjpy`, `audusd`, `nzdusd`, `usdcad`, `usdchf`, `nas100`, `spx500`). Candles are dated at 00:00 UTC; Saturday and Sunday candles (OANDA's Sunday-evening stub) are dropped, so a horizon counts weekdays.
- **Direction:** returns are measured in the **futures' direction**. JPY, CAD and CHF futures are the currency against USD, so the USD/JPY, USD/CAD and USD/CHF returns are sign-flipped. A positive return means the speculators' long side gained.
- **Short history, stated up front.** The cached history starts in 2019, so the 3-year percentile exists only from January 2022. The CFTC publishes TFF history from 2006 and Disaggregated from 2006; a longer replication needs a run where CFTC resolves (the `macro-gold` Actions pattern). It is not part of this verdict.

## Timing (no look-ahead)

- A report's **as-of date** *d* is a Tuesday (a Monday in some holiday weeks). The report is normally published the Friday after at 15:30 ET; in holiday weeks it can slip to the Monday.
- A report counts as **known from 00:00 UTC of the first Monday strictly after *d*** (*d* + 6 days for a Tuesday, *d* + 7 for a Monday).
- **Entry** = the close of the first weekday candle that opens after that Monday 00:00 UTC (normally the Tuesday close, a full day after even a Monday publication). **1 week** = 5 weekday closes after entry, **4 weeks** = 20.
- **Late-published weeks are excluded.** During the US government shutdown of 1 Oct – 12 Nov 2025 the CFTC stopped publishing and then caught up on a compressed schedule. Reports with as-of dates **2025-09-30 to 2026-01-27** (a deliberately wide window) were not public on the normal schedule and are dropped from every test. The 2018–19 shutdown backlog (as-of dates to early 2019) only feeds the history of the percentiles, which start testing in 2020.
- Every feature uses reports with as-of dates ≤ *d* only.

## Features (per market, per report week)

- **P1:** percentile of this week's net among the prior **52** reports (share of them ≤ this week's net, 0–100). Needs 52 prior reports.
- **P3:** the same among the prior **156** reports. Needs 156.
- **Z:** this week's change in net ÷ the standard deviation of the prior 52 weekly changes. Needs 52 prior changes. A change across a gap of more than 10 days between reports is not a weekly change and is left out (it counts as missing).
- **C3:** percentile of the **commercials'** net among the prior 156 reports (TFF: dealer / intermediary; Disaggregated: producer / merchant / processor / user plus swap dealers).

## Hypotheses (fixed signs)

| # | Feature | Predicts | Expected sign |
|---|---|---|---|
| H1 | P1 (1-year crowding) | 1w and 4w return | IC **< 0** (contrarian) |
| H2 | P3 (3-year crowding) | 1w and 4w return | IC **< 0** (contrarian) |
| H3 | Z (weekly flow) | 1w and 4w return | IC **> 0** (follow) |
| H4 | Extreme: −1 if P3 ≥ 90, +1 if P3 ≤ 10 (the desk's "extreme") | 1w and 4w return × signal | mean **> 0** |
| H5 | Extreme with commercials opposite: −1 if P3 ≥ 90 and C3 ≤ 10; +1 if P3 ≤ 10 and C3 ≥ 90 | 1w and 4w return × signal | mean **> 0** |

H5 needs the commercials' positions. If they are missing for more than 10% of the weeks in the cached history (the council's cache kept only the speculators until this study's change to `council/cot.mjs`), **H5 is NOT RUN** and says so; it is not a fail. It runs on the next full re-fetch.

## Windows

- **In sample (IS):** as-of dates **2020-01-01 to 2023-12-31** (P3 and C3 from their first full window, January 2022).
- **Out of sample (OOS):** as-of dates **2024-01-01** to the last report with a complete forward window.
- Late-published weeks (above) are excluded from both.

## Statistics

- **IC** = Spearman rank correlation of the feature with the forward return, per market and window.
- **t for an IC** (overlap- and persistence-robust): ranks are standardized within the market and window; the weekly products *u* = z(rank feature) × z(rank return) are averaged, and the standard error is Newey-West (Bartlett kernel) with lag **2** for 1-week and **6** for 4-week returns.
- **Pooled IC** (the primary test for H1–H3): for each week, the average of *u* over the markets with data that week; pooled IC = the mean over weeks; t = Newey-West on that weekly series with the same lags. Averaging within the week first keeps the shared dollar factor from counting as independent evidence.
- **Events (H4, H5):** for each event the signal × return; n, hit rate (share > 0), mean in %. t = mean ÷ an overlap-weighted standard error: events whose forward windows overlap are correlated with weight 1 − (distance in weekdays ÷ horizon). Pooled events: per week, the average over the markets with an event, then Newey-West as above.
- Also reported: n, per-market base rate of a positive return, quintile means of the 4-week return by P3 (diagnostic).

## Pass bars

**Primary (pooled, per hypothesis and horizon: H1–H3 × 1w / 4w = 6 tests):** PASS if

1. IS pooled IC has the expected sign with |t| ≥ **2.0**, and
2. OOS pooled IC has the same sign with |t| ≥ **1.65** and |IC| ≥ **0.03**.

**Per market (decides the desk's per-market "edge" flag):** a (market, hypothesis, horizon) cell passes if

- H1–H3: IS IC has the expected sign, |t| ≥ 2.0 and |IC| ≥ 0.05; OOS IC the same sign, |t| ≥ 1.65 and |IC| ≥ 0.05.
- H4, H5: IS n ≥ 15, hit rate ≥ 55% and t ≥ 2.0; OOS n ≥ 8, mean > 0 and hit rate ≥ 55%.

**Pooled events (H4, H5 × 1w / 4w):** PASS if IS t ≥ 2.0 and OOS mean > 0 with t ≥ 1.65.

With 10 markets × 5 hypotheses × 2 horizons, a few IS passes are expected by chance; the OOS leg is what counts. No threshold, window, lag or feature changes after the results are seen.

## Verdicts

- **Study:** PASS if any primary or pooled-event test passes; otherwise FAIL (positioning has no tested edge at these horizons on this history).
- **Per market:** "tested" if any cell passes (named with its hypothesis, horizon and OOS numbers), otherwise "none". The COT desk shows this per market as `edge`. A "tested" flag is information for the desk; it changes no rule, size or trade.
- **Gold** is reported first and compared with the prior (IC about +0.01).

## Pre-declared diagnostics (cannot change a verdict)

1. **Whole sample** (IS + OOS together) ICs per market.
2. **OI-normalised P3:** the 3-year percentile of net ÷ open interest, 4-week IC.
3. **Old timing:** the desk's previous entry rule (as-of + 6 days for every report, late-published weeks included) for H4 over 4 weeks, to show what the timing fixes change.
4. **Quintiles:** mean 4-week return by P3 quintile, pooled.
5. **Gold by year:** H2 4-week IC per calendar year.

## Run

`node research/edge/cot-positioning/run.mjs <council-data dir>` (a checkout of the `council-data` branch with `macro/cot-raw.json` and `research/daily/`). It writes `result.json`. Features, release timing and late weeks come from `council/cot.mjs` (`features`, `knownAt`, `isLate`), so the desk and the study use the same definitions. Paper research only.
