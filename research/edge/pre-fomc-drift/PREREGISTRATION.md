# The pre-FOMC announcement drift, out of sample: pre-registration

Written and committed **before** any candle was fetched or any trade computed (13 Nov 2026). The event list, the rule, the
costs, the windows, the placebo and the pass bar are fixed here; nothing in them changes after the results are seen.
Anything added later is labelled post hoc in `RESULT.md`.

Paper research only. No live rule, size, filter, stop, config or council member changes. ICT is not involved. A pass is a
hypothesis for a forward paper shadow that the owner decides on; it is never a live rule.

## The claim being tested

Lucca and Moench (2015, Journal of Finance, "The Pre-FOMC Announcement Drift") report that US equities earned a large share
of their excess return in the 24 hours before scheduled FOMC announcements, 1994-2011. Later work reports the effect weakened
after the paper was circulated. This study asks whether it is there, net of a CFD trader's costs, on the council's own index
feeds: before publication's influence (2008-2015, descriptive) and after it (2016 → now, the window that decides).

## What is already known (seen before this was written)

- The paper's headline and the later reports of decay, as above (not read again for this study; no figure from them is used).
- `research/edge/event-reaction` (gold and the dollar index around CPI / NFP / FOMC, 2018-26): descriptive gold moves after
  the release; nothing about the 24 hours before. No study in this repository has measured an index before FOMC.
- That OANDA serves SPX500 and NAS100 M5 candles from January 2008 through the candle proxy (one request for one day of
  January 2008 each, made only to see whether the history exists; no return was computed). NAS100's 2008 M5 history is thin.

## Event list (scheduled FOMC statements only)

Source: the Federal Reserve's FOMC meeting calendars (federalreserve.gov, "Meeting calendars and information" and the
"Historical materials by year" pages), the last day of each SCHEDULED meeting. 2022 onward is taken from the repository's own
calendar (`council/events.mjs` `HISTORY` and `RAW.FOMC`, checked there against EUR/USD release-minute spikes). 2008-2021 is
written into `events.mjs` of this study from the Fed's historical calendars; the build sandbox cannot reach
federalreserve.gov, so the list is checked in `run.mjs` by the release-minute check below, never by price direction.

- **Unscheduled meetings and announcements are excluded**: 22 Jan 2008, 8 Oct 2008 (joint cut), 9 May 2010 (swap lines),
  3 Mar 2020, 15 Mar 2020. The scheduled 17-18 Mar 2020 meeting was replaced by the 15 Mar one and has no statement of its
  own: excluded. Conference calls without a scheduled statement are not events.
- **Statement time** (New York, DST-correct, converted to UTC with the zone rules of that date): 14:15 for 2008-2012, except
  12:30 on the 2011-2012 meetings with a press conference (27 Apr, 22 Jun, 2 Nov 2011; 25 Jan, 25 Apr, 20 Jun, 13 Sep,
  12 Dec 2012); 14:00 from January 2013 on. Call the release time `T`.
- **Release-minute check** (validates the list, decides nothing): for each event, the SPX500 range of the M5 candle starting
  at `T` against the median range of that same candle on the weekdays within ±25 days. Reported per event; an event below 1x
  is listed as "no spike" but is NOT dropped (dropping by price would select events).

## Data

OANDA mid M5 candles of SPX500, NAS100 and XAU/USD through the site's keyless proxy (`/md/bars`), 1 Nov 2007 to
13 Nov 2026, complete candles only: `node --use-env-proxy research/edge/pre-fomc-drift/fetch.mjs <dir>`. Files stay out of git.

## The rule (one trade per event per market; long only)

- **Entry**: buy at the close of the M5 candle that ends at `T − 24 h` (the close of the hourly candle 24 hours before a
  whole-hour release; for a 14:15 or 12:30 release, the same clock time the day before). If no candle ends exactly there,
  the last candle ending in the 60 minutes before it; none → the event is skipped and listed.
- **Exit**: at the close of the M5 candle that ends at `T − 5 min` (13:55 New York for a 14:00 statement), before the
  release. If none ends exactly there, the last candle ending in the 60 minutes before it; none → skipped and listed.
- **Stop (every trade has one)**: entry − 1.5 x the expected 24-hour move, where the expected move = ATR(14) of the 14
  complete New York trading days (17:00 to 17:00 New York, built from the M5 candles; true range with the prior day's close)
  that ended at or before the entry. Checked on every M5 candle after the entry candle up to the exit candle: a candle that
  opens at or under the stop exits at its open (a gap), otherwise a low at or under the stop exits at the stop. The stop is
  never moved.
- **R** = (exit − entry) / (entry − stop); **net R** = R − cost / (entry − stop).
- **Costs (fixed now, conservative for a CFD)**: round trip SPX500 **1.0 index point**, NAS100 **2.0 points**, XAU/USD
  **$0.50**; plus long financing of **6 % a year of the entry price / 365 per rollover crossed** (rollover = 22:00 UTC on a
  weekday; for the indices a Friday rollover counts 3, for gold a Wednesday counts 3, `council/fills.mjs` `nights`).
  Today's price levels make the point costs smaller in % than in 2008; they are kept fixed (conservative early on).

## Windows

- **A, 2008-01-01 to 2015-12-31**: the years after the paper's sample that share its regime. Reported, not decisive.
- **B, 2016-01-01 to 2026-11-13**: the post-publication test. **Decides the verdict.**
- An event belongs to the window of its statement date.

## Placebo (40 seeds)

For seed `s` (deterministic generator, seeds 1-40), each event of the window gets one random stand-in: a date with the same
weekday as the event's statement day, drawn uniformly from the 365 days centred on it and inside the same window, at the
same New York clock time; dates within 3 calendar days of any FOMC announcement (scheduled or unscheduled, any year) are
not allowed; a stand-in whose entry or exit cannot be priced is drawn again (at most 50 tries; none → that event has no
stand-in in that seed). The stand-in is traded with the identical rule and costs. Placebo statistic = mean net R a trade of
the seed. The FOMC mean is compared with the 95th percentile of the 40 placebo means (linear interpolation).

## Pass bar (decided on SPX500, window B)

**PASS** only if all three hold on SPX500 in 2016 → now:
1. mean net R a trade > 0;
2. t ≥ 2 (one-sample t of the per-trade net R against 0);
3. the mean beats the 95th percentile of the 40 placebo means.

NAS100 is the second market: the same three checks are reported for it and the RESULT says "confirms" or "does not confirm";
it cannot turn a FAIL into a PASS. Window A for both indices, and XAU/USD in both windows, are **descriptive, not judged**.
Also reported, descriptive: win rate, stops hit, gross R, the per-year mean, and the same statistics in % of price without the
stop (the paper's measure). Never call this an edge without n and t; a PASS leads only to a proposal for a paper shadow
(`research/proposals/2026-11-13-pre-fomc.md`) that the owner approves or not. A FAIL leads to no proposal.

## Tests

`tests/pre-fomc-drift.test.mjs` (offline): the DST-correct `T`, entry and exit times on fixed dates (both sides of each DST
switch, the 14:15 and 12:30 years), no look-ahead (the ATR and the entry use no candle after the entry; the trade uses no
candle after the exit), every trade has a stop under its entry, costs and financing, the placebo excludes FOMC days and keeps
the weekday, and `RESULT.md` against `result.json`.
