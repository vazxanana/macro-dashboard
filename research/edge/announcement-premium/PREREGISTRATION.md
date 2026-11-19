# Announcement-day premium: a long held over the CPI / payrolls release day, against other days: pre-registration

Written and pushed alone, before `dates.mjs`, `run.mjs` or any return was computed. Paper research only: no live rule, size,
filter, stop, config or council member changes, whatever the result. ICT is not touched. The gold book is not touched (owner
decision item 44 holds: this tests index and bond CFDs, not a gate, exit, entry or size of the gold systems).

## Question and prior
Is a plain long in a US equity index CFD, or in a long-dated US Treasury CFD, held over the UTC day of a US CPI or Employment
Situation (payrolls) release worth more, after costs, than the same one-day long on an ordinary weekday? Prior: Savor and
Wilson, "How Much Do Investors Care About Macroeconomic Risk? Evidence from Scheduled Economic Announcements", Journal of
Financial and Quantitative Analysis 2013 (not opened here; quoted from the untested-backlog proposal, branch
`untested-backlog`, `research/proposals/2026-11-14-untested-backlog.md`, candidate 2): equity and Treasury returns are higher on
scheduled inflation, employment and FOMC announcement days.

## Not a duplicate (checked 14 Nov 2026: `git fetch origin`, `ls research/edge`, the remote branches)
- `cpi-follow`, `nfp-follow`, `fomc-follow`, `event-reaction`: the DIRECTION of the first minutes after a release, traded
  intraday. Not an unconditional long, not a whole day, no bonds.
- `pre-release-drift`: the 24 hours BEFORE CPI / payrolls on gold and the dollar. `pre-fomc-drift`, `bond-fomc-drift`: FOMC.
- `cb-days-other`, `ecb-boj-days`: other central banks' decisions, first-hour direction.
None holds a long through the CPI / payrolls release day on index or bond CFDs. **FOMC days are excluded here** (both from the
release days and from the comparison days), so this does not repeat `pre-fomc-drift`.

## Data
- council-data daily candles `research/daily/<key>.json` (OANDA mid, complete UTC days, read with `git show
  origin/council-data:…`, no network): `spx500` (SPX500_USD), `nas100` (NAS100_USD), `us30` (US30_USD), `usb10y`
  (USB10Y_USD), `usb30y` (USB30Y_USD). Each starts in March 2003; the cache's last day is the last complete day on file.
- Financing rate: FRED DGS2 weekly, the copy `turnaround-tuesday` committed as `rates.json` (from council-data
  `macro/cache.json`), copied beside this file.

## Which day is measured
OANDA's daily candle runs 00:00 to 24:00 UTC. A release at 08:30 New York is 13:30 UTC (winter) or 12:30 UTC (summer): always
inside the UTC candle of the release's New York date `D`. **Unit = the UTC daily candle of D.** Return = close(D) / close of
the candle before it on file − 1, i.e. bought at 00:00 UTC on D (20:00 / 19:00 New York the evening before) and sold at
24:00 UTC on D (20:00 / 19:00 New York that day): the release and the whole New York cash session of D are inside the hold.

## Release dates (written out in `dates.mjs`, each with its source)
- **CPI**
  - 2022 on: `council/events.mjs` (`HISTORY` + `EVENTS`, type CPI; BLS schedules incl. the 2025 shutdown changes).
  - 2018-2021: the BLS schedule list `CPI_EARLY` of `research/edge/event-reaction/build.mjs` (copied).
  - 2012-2017: the `cpi-follow` study's list (branch `cpi-follow`, `events.mjs` `MEMORY`), written there from memory of the BLS
    archives and pre-registered there with a release-minute spike check on EUR/USD and USD/JPY: only the 54 dates that PASSED
    that check are used (the 18 it dropped are dropped here too). Not verified against bls.gov (unreachable from the sandbox).
  - **2008-2011: no CPI dates.** They cannot be written out reliably here; those years are payrolls only. The CPI days of
    2008-11 then sit, unknown, among the comparison days (a small bias towards no difference in-sample; said in the report).
- **Payrolls (Employment Situation)**
  - 2022 on: `council/events.mjs` (type NFP).
  - January 2008 to December 2021: the BLS rule the `nfp-follow` study pre-registered (branch `nfp-follow`, copied, not
    imported): the release is the third Friday after the Saturday ending the reference week that contains the 12th; a computed
    1-3 January moves one week later; a computed Friday that is the observed Independence Day (4 July, or 3 July when the 4th is
    a Saturday) moves to the Thursday before; the October 2013 shutdown dates (4 Oct → 22 Oct, 1 Nov → 8 Nov). `nfp-follow`
    used it from 2010; 2008-2009 extend the same rule, with no exception added. A release-minute check (USB10Y M5 range of the
    08:30 New York candle against the median of the same candle on the 8 nearest other Fridays) is run on the 2008-2009 rule
    dates and REPORTED; it drops nothing (the rule is BLS's own; nfp-follow's check flagged real but quiet releases).
- A release date that is not a NYSE trading day (Good Friday payrolls; full holidays as in `turnaround-tuesday`'s `dayKind`,
  `ict/calendar.mjs` `cmeYear` + NYSE rules + the 2012 storm, 2018 and 2025 closures) is dropped and counted. A day that is both
  a CPI and a payrolls day counts once. A release day without a candle on file is dropped and counted.
- **FOMC days**: the scheduled statement dates of `pre-fomc-drift` (`events.mjs` `OLD` 2008-21, `council/events.mjs` 2022 on;
  copied) and its unscheduled announcement dates. A CPI or payrolls day that is also an FOMC day is dropped (counted).

## Comparison days
Every other NYSE trading day (Monday-Friday) with a candle, that is not a CPI, payrolls or FOMC day, in the same window.

## Costs
Each release-day hold pays one round trip and one night of financing, as a share of the price:
- Spread + slippage a round trip (stated assumptions, not measured): SPX500 0.04 %, NAS100 0.05 % (the `turnaround-tuesday` /
  `pre-holiday` convention), US30 0.05 % (taken equal to NAS100), USB10Y and USB30Y 0.10 % (the `tsmom` / `bond-fomc-drift`
  bond CFD assumption).
- Financing: (DGS2, the last weekly value on or before D, + 2.5 %) / 365 for ONE night, on every hold (also a Friday hold).
- Comparison days carry no cost: they are the passive long's ordinary day. So the measured difference = release-day NET
  return − other-day GROSS return; costs count entirely against the release-day trade.
- At 2x costs both parts are doubled.

## Windows
- **In sample: 2008-01-01 to 2016-12-31** (judged on its sign).
- **Out of sample: 2017-01-01 to the last day on file** (decides).

## Tests (five; Holm over the five)
- **T1 (primary): SPX500 long** on release days. T2 NAS100. T3 US30. T4 USB10Y long (a price: long = falling yields).
  T5 USB30Y long.
- Statistic: Welch t of (release-day net returns) vs (other-day gross returns), out of sample. One-sided p from the normal
  approximation, Holm-adjusted over T1-T5.
- **Placebo**: 40 seeds (1 to 40, a fixed PRNG); each draws, without replacement, as many comparison days of the out-of-sample
  window as the test has release days there, charges them the release-day costs, and computes the same Welch t against the
  remaining comparison days.
- **A test passes** when all hold: (1) OOS Welch t >= 2 and Holm-adjusted p < 0.05; (2) OOS release days n >= 100; (3) the
  in-sample difference is > 0 (same sign); (4) the OOS difference is > 0 at 2x costs; (5) the OOS t is above the placebo
  seeds' t in at least 38 of 40 seeds.
- **Verdict PASS only if T1 passes.** Any of T2-T5 passing while T1 fails is reported as a hypothesis for its own
  pre-registration, not a pass.
- Reported, never deciding: gross differences and t, the release-day mean net return and its one-sample t, CPI days and
  payrolls days apart, by year, the date funnel and the 2008-09 release-minute check.

## After
`dates.mjs`, `run.mjs`, `result.json`, `RESULT.md` (the bold verdict line first, with its reason, under 220 characters),
`tests/announcement-premium.test.mjs`. No proposal and no live change follow from a FAIL; a PASS would be a paper proposal for
the owner, nothing more.
