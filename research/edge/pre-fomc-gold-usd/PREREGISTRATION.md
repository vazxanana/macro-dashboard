# The pre-FOMC drift in gold and the US dollar: pre-registration

Written and committed **before** any candle was fetched or any trade computed (14 Nov 2026). The event list, the rules, the
costs, the windows, the statistics, the placebo and the pass bar are fixed here; nothing in them changes after the results are
seen. Anything added later is labelled post hoc in `RESULT.md`.

Paper research only. No live rule, size, filter, stop, config or council member changes; ICT is not involved. **This is a
stand-alone rule.** Under the owner's rule of 12 Nov 2026 (docs/owner-decisions.md item 44: no further gate, exit, entry or
size is tested on the live gold book's 2006-17 window) it is not, and can never become by this study, a gate, exit, entry or
size of the live gold book (Gold trend, Gold daily engulf). It trades its own windows only. A pass is a hypothesis for a
forward paper shadow the owner decides on, never a live rule.

## The claim being tested

Some work on the pre-FOMC announcement drift (Lucca and Moench 2015 found it in US equities) reports that in the 24 hours
before scheduled FOMC statements the US dollar tends to weaken and gold to firm. This study asks whether a trader could have
earned that, net of a CFD trader's costs, on the council's own OANDA feeds after 2016.

## What is already known (seen before this was written)

- `pre-fomc-drift` (branch, not on main; FAIL): the same 24-hour window, long SPX500 / NAS100, 2008-2026. SPX500 in 2016 →
  now made +0.044R a trade, t 1.35, and did not clear its placebo; gold (XAU/USD) was reported there as descriptive only, and
  its gold figures were seen when that study was read for this one. That gold row used a 1.5 x ATR(14) stop, $0.50 cost and a
  T − 5 min exit, so it is not this rule; it is named here so nobody reads this study as untouched on gold.
- `bond-fomc-drift` (#906, FAIL): Treasuries after FOMC; not the window tested here.
- `event-reaction`: gold and the dollar index AFTER CPI / NFP / FOMC releases; nothing about the 24 hours before.
- That OANDA serves XAU/USD, EUR/USD, GBP/USD, AUD/USD and USD/JPY M15 candles from 2008 through the candle proxy (one request
  for two days of January 2008 on USD/JPY, made only to see whether the history exists; no return was computed).

## Event list

Copied byte for byte (as `events.mjs` of this folder; branches are never imported) from `pre-fomc-drift/events.mjs`: the last
day of each SCHEDULED FOMC meeting, 2008-2021 written from the Federal Reserve's historical calendars, 2022 on from
`council/events.mjs` (`HISTORY` + `EVENTS`). **The 2008-2021 dates were written from memory in a sandbox that cannot reach
federalreserve.gov and are UNVERIFIED** (that study checked them only by the release-minute range; this one repeats that check
on EUR/USD, descriptive, nothing dropped). The decisive window 2016 → now therefore rests on unverified dates for 2016-2021 and
on the repository's checked calendar from 2022. Unscheduled announcements (22 Jan 2008, 8 Oct 2008, 9 May 2010, 3 Mar 2020,
15 Mar 2020) are excluded, and no placebo date may fall within 3 days of them. Statement time `T`: 14:15 New York 2008-2012,
12:30 on the 2011-2012 press-conference meetings, 14:00 from January 2013; New York daylight time applied by date.

**The list has no decision field** (no rate-change flag for any meeting). So **T3 (gold long only before rate-change meetings)
is dropped** before any data is seen, as the brief allows; no rate-change list is written for this study.

## Data

OANDA mid M15 candles of `xau`, `eurusd`, `gbpusd`, `audusd`, `usdjpy` through the site's keyless proxy (`/md/bars`,
`tf=15m`), 1 Nov 2007 to 14 Nov 2026, complete candles only: `node --use-env-proxy research/edge/pre-fomc-gold-usd/fetch.mjs
<dir>`. Files stay out of git.

## The rule (one trade per event)

- **Entry**: at the close of the M15 candle that ends at `T − 24 h` (14:00 New York the day before a 14:00 statement; for the
  14:15 and 12:30 statements of 2008-2012, the same clock time the day before: identical to `pre-fomc-drift`). No candle
  ends exactly there → the last one ending in the 60 minutes before; none → the event is skipped and listed.
- **Exit**: at the close of the M15 candle that ends at `T − 15 min` (13:45 New York for a 14:00 statement), before the
  release. Same fallback.
- **Stop (every leg has one)**: 1.0 x ATR(20) of the 20 complete New York trading days (17:00 to 17:00 New York, built from the
  M15 candles; true range with the prior day's close) that ended at or before the entry, under the entry for a long and over
  it for a short. Checked on every M15 candle after the entry candle up to the exit candle: a candle that opens through the
  stop exits at its open (a gap), otherwise one that touches it exits at the stop. Never moved.
- **T1, gold**: long XAU/USD. R = (exit − entry) / (entry − stop).
- **T2, short USD**: four legs at the same times, each with its own stop, equal risk: long EUR/USD, long GBP/USD, long
  AUD/USD, short USD/JPY. The basket's R for the event = the mean of the four legs' R (each leg in R of its own risk, so 1R of
  basket risk = 0.25R a leg). An event is traded only when all four legs can be priced; otherwise skipped and listed.
- **T3**: dropped (see the event list).

## Costs (fixed now)

- **Gold**: $0.30 a round trip, plus long financing `nights(entry, exit) x FIN.xau.long x entry` from `council/fills.mjs`
  (imported from main: rollovers Monday-Friday 22:00 UTC, Wednesday three; today's demo rate for every year).
- **Forex**: the raw-spread model of CLAUDE.md "Forex spreads" as `council/fills.mjs` `tradeCost` charges it for a market
  entry and a time exit: quoted spread 0 (council-data `ctrader/symbols.json` `spreadTypical.median` = 0 on the three majors),
  the broker's commission `commissionRT` = 0.000045 of the price a round trip, and half a DEFAULT spread of slippage on each of
  the two market orders, i.e. one default spread a round trip: 0.0001 for EUR/USD, GBP/USD, AUD/USD and 0.01 for USD/JPY (the
  pip; `spreadOf` gives 0.0001 to every forex pair, which would be nothing on USD/JPY, so its pip is used). USD/JPY is not in
  `symbols.json`: its commission is taken as the same 0.000045. **Swaps**: `symbols.json` `swap` (pips a night, type 0,
  triple on Wednesday) charged per `nights()`: EUR/USD long 0.621 pip, GBP/USD long 0.179 pip; AUD/USD long is a credit
  (+0.041) and is credited nothing; USD/JPY short has no record and is charged nothing (said in `RESULT.md`). Today's swap
  for every year. Costs in R = cost / the leg's risk.
- **2x costs**: every cost above doubled (financing and swaps included), reported for each test and window.

## Windows

- **A, replication, 2008-01-01 to 2015-12-31** (event dates unverified). Must be net positive; not otherwise judged.
- **B, decisive, 2016-01-01 to 2026-11-14.** An event belongs to the window of its statement date.

## Statistics

- Per test and window: n, gross R a trade, net R a trade, t of the per-meeting net R against 0 (one-sample), one-sided p
  (Student t, n − 1 df; H1: mean > 0), win rate, stops hit; also the mean % move entry → exit close without the stop (gold
  long; basket = mean of the legs' signed % moves).
- **Holm** over the tests of window B (T1, T2: two tests).
- **Placebo, 40 seeds**, method of `pre-fomc-drift`: each event gets one stand-in per seed, a date with the same weekday drawn
  uniformly from the 365 days centred on it inside the same window, same New York clock time, none within 3 calendar days of
  any FOMC announcement (scheduled or unscheduled), redrawn up to 50 times when it cannot be priced (mulberry32, seeds 1-40).
  Traded with the identical rule and costs. Reported: the mean of the 40 seed means, their 95th percentile, how many seeds
  the FOMC mean beats.

## Pass bar (per test; the study passes if T1 or T2 passes)

A test **PASSES** only if all hold:
1. net R a trade > 0 in window A **and** in window B;
2. the Holm-adjusted one-sided p of window B < 0.05;
3. n ≥ 60 trades in window B.

Reported beside the bar, not part of it: the placebo (a test that passes but sits under the placebo's 95th percentile is
called "passes the bar, not above the placebo" in `RESULT.md`) and the 2x-cost result. Never call this an edge without n and
t. A pass leads only to a proposal for a paper shadow that the owner approves or not; a FAIL leads to no proposal.

## Tests

`tests/pre-fomc-gold-usd.test.mjs` (offline): entry and exit times on fixed dates (both sides of a DST switch, the 14:15 and
12:30 years), no look-ahead (the ATR uses no day ending after the entry; the trade no candle after the exit), every leg has
a stop on its losing side, short legs mirrored, gold costs and financing, forex costs and swaps, the basket as the mean of
four legs, Holm, the placebo excludes FOMC days and keeps the weekday, and `RESULT.md` against `result.json`.
