# Pre-registration: the weekly US natural gas storage report, drift after the first half hour (14 Nov 2026)

Written, committed and pushed ALONE before any candle of this study is fetched or any number computed. The schedule rule,
the trade, the costs, the windows, the statistics, the placebo and the pass bar are fixed here; nothing in them changes after
the results are seen. Anything added later is labelled post hoc in `RESULT.md`.

Paper research only. No live rule, size, filter, stop, config or council member changes; ICT is not involved. Natural gas
is not a market the council trades. A pass is at most a proposal to the owner for a paper shadow stream (every trade with its
stop), never a live rule.

## Why, and what was already tested

The government's weekly natural gas storage report (working gas in underground storage, lower 48) is published on Thursday at
10:30 New York and is the one scheduled weekly release that moves US natural gas. No consensus figures are available to the
council, so the test uses only the price's own reaction.

Checked before writing (14 Nov 2026): no branch or folder on this topic (`git ls-remote --heads origin`: no `natgas` /
`storage` / `eia` head; `research/edge` on main has no natural gas event study). Related, read for code and costs only:
`oil-wednesday` (branch; the crude inventory report on WTI, fade or follow the first M30 candle, held to 16:00: FAIL),
`pre-release-drift` (branch; 24 h before CPI / payrolls: FAIL), `energy-seasonal` (branch; seasonal windows on WTI, Brent and
natural gas, one trade a year: FAIL). None measured the natural gas storage report. No return of this report's day was
computed or seen for this study.

## Data

OANDA mid M5 candles of `NATGAS_USD` through the site's keyless candle proxy (`/md/bars?sym=natgas&tf=5m`,
`node --use-env-proxy`), from 2005-01-01 (or the first candle the proxy serves, if later) to the last complete candle at the
run. Complete candles only (`live` dropped). The cache stays out of git. New York time from UTC by the US daylight-saving rule
(`council/histdata.mjs` `nyOffsetH`).

## Release schedule (derived from the rule; no calendar is fetched)

- Normal week: **Thursday 10:30 New York**.
- **Holiday weeks are left out of every test.** A week (Monday-Friday) that contains a US federal holiday (observed date:
  New Year's Day, Martin Luther King Jr. Day, Presidents' Day, Memorial Day, Juneteenth from 2021, Independence Day, Labor Day,
  Columbus Day, Veterans Day, Thanksgiving, Christmas; a Saturday holiday observed the Friday before, a Sunday holiday the
  Monday after; the same list and code as `oil-wednesday`) is skipped. Why: in those weeks the publisher moves the release by
  a day or to another hour (Thanksgiving week: Wednesday at noon; Thursday holidays: the day before; some Monday-Wednesday
  holidays: no change) and the rule cannot tell which without a calendar. Skipping them keeps every event at a time the rule
  is sure of. The skipped weeks are counted in the result. Known limits, accepted: one-off delays (government shutdowns, system
  problems) are not modelled and put noise into those events.

## Primary hypothesis (a): post-release drift (the one tested)

For a release at `T` (Thursday 10:30 New York):
- **Reference price** = the open of the M5 candle that opens at `T`.
- **Signal** = the close of the M5 candle that ends at `T + 30 min` (opens 10:55) minus the reference. Up when > 0, down
  when < 0; exactly 0 is no trade.
- **Entry** = the open of the next M5 candle (opens `T + 30 min`, 11:00), in the signal's direction (continue).
- **Stop** (absolute rule 1, every trade has one) = entry ∓ 1.5 x A, where A = the mean of |close at 14:30 − open at 11:00|
  over the **20 previous report events** of the study (same window, strictly earlier reports, skipped weeks not counted;
  only events where both prices exist count). The first 20 events only build A and are not traded. The stop never moves.
- **Exit** = the close of the M5 candle that ends at **14:30 New York** (the NYMEX natural gas settlement, the energy
  market's New York close). No target.
- Stop first: from the entry candle on, a candle that OPENS beyond the stop exits at that open; else one whose low (long) /
  high (short) reaches the stop exits at the stop. A missing candle: the trade is managed on the candles there are; an event
  with no reference, signal or entry candle, or no candle ending by 14:30, is skipped and counted.
- **R** = (exit − entry) x side / (1.5 x A). Held inside one day: no overnight financing.

## Costs

Round trip $0.005 a unit (the stated natural gas CFD spread of `energy-seasonal`; the demo broker lists no energy symbol, so it
is an assumption, not a broker figure). Net R = R − cost / risk. Reported at cost 0, base ($0.005) and 2x ($0.010).

## Windows (in sample / out of sample)

Midpoint date = halfway (in time) between the first and the last M5 candle in the cache. **In sample** = traded events before
the midpoint date; **out of sample** = traded events on or after it.

## Statistics

- Per window: n, mean net R a trade, win rate, total, worst drawdown, and **t on calendar-month sums** (sum of net R of each
  calendar month that has a trade; t = mean / (sd / sqrt(months))).
- **Placebo**: 40 seeds (1..40, a fixed generator in `run.mjs`): for every report week of the study, a random weekday of the
  same week that is not the Thursday and not a holiday, with the same clock times (10:30, 11:00, 14:30 New York); the stop's A
  is the placebo series' own previous 20 events, built the same way. The statistic compared: out-of-sample mean net R a trade
  (base cost).

## Pass bar (all must hold, primary (a) only)

1. Out-of-sample month-sum t >= 2, net of base cost (mean > 0).
2. In-sample mean net R a trade > 0 (base cost).
3. Out-of-sample mean net R a trade > 0 at 2x cost.
4. The out-of-sample mean net R beats at least 38 of the 40 placebo means (95 %).

**Verdict: PASS** if all four hold, else **FAIL**. One test, so no multiple-testing correction.

## Reported only, not tested (b): pre-release drift

From the Wednesday New York close (the close of the M5 candle ending Wednesday 14:30 New York) to Thursday 10:25 (the close of
the candle ending 10:25): the mean % move with its month-sum t, IS / OOS. Trade version, for the record only: side = the sign
of the mean move of the 20 previous reports (walk-forward), entry at the open of the M5 candle opening Wednesday 14:30, exit at
the close of the candle ending Thursday 10:25, stop 1.5 x the 20-report mean |move| of that window, same stop-first and costs
(no financing charged: one rollover; said). Neither (b) nor any by-year, by-side or post-hoc split can pass or fail this study.

## What follows

A FAIL changes nothing and no proposal is written. A PASS is only a proposal to the owner for a paper shadow stream.
