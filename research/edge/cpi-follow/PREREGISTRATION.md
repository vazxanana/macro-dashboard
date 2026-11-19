# Pre-registration: US CPI, follow or fade the first 15 minutes, held to the New York close (13 Nov 2026)

Written and pushed before any trade of this study is computed. Every rule, window, cost and pass bar is fixed here; the run
is made once and reported whatever it shows. Paper research only: nothing live reads it, no rule, size, filter, stop or
council member changes. A PASS is a proposal to the owner, never a live change.

## What this is, and what it is not

- **A new, stand-alone event rule** on four markets. It is not a gate, exit, entry or size of the supported gold book
  (Gold trend + Gold daily engulf), so owner decision 44 (no more tests of that book on 2006-17) does not apply; this file
  says so because the replication window overlaps those years. No book position, system or council record is read.
- **Not a repeat of `research/edge/event-reaction`** (9 Nov 2026, FAIL). That study asked whether gold's T+5 to T+60
  minute move follows the dollar index's first 5-minute read on CPI days (34 of 73, p 0.76). This study trades each
  market's OWN first 15-minute move (08:30-08:45 New York), both ways (follow and fade), with a stop on every trade, holds
  to 11:00 or 16:00 New York, nets costs, and is judged on R with t. It reads no dollar index and uses no 5-minute read.

## Events (US CPI, 08:30 New York)

- 2012-2017: BLS release dates written **from memory** (the BLS archive pages are not reachable from the build sandbox),
  so each date must pass a spike check before it is used: the 08:30 M5 candle's range (high minus low) on EUR/USD OR on
  USD/JPY is at least 2x the median of the same candle's range on the 20 weekdays before it. A date that fails is dropped
  and listed, never moved to another day. The list needs a spot-check against bls.gov; it is in `events.mjs` and here:
  - 2012: 01-19, 02-17, 03-16, 04-13, 05-15, 06-14, 07-17, 08-15, 09-14, 10-16, 11-15, 12-14
  - 2013: 01-16, 02-21, 03-15, 04-16, 05-16, 06-18, 07-16, 08-15, 09-17, 10-30, 11-20, 12-17
  - 2014: 01-16, 02-20, 03-18, 04-15, 05-15, 06-17, 07-22, 08-19, 09-17, 10-22, 11-20, 12-17
  - 2015: 01-16, 02-26, 03-24, 04-17, 05-22, 06-18, 07-17, 08-19, 09-16, 10-15, 11-17, 12-15
  - 2016: 01-20, 02-19, 03-16, 04-14, 05-17, 06-16, 07-15, 08-16, 09-16, 10-18, 11-17, 12-15
  - 2017: 01-18, 02-15, 03-15, 04-14, 05-12, 06-14, 07-14, 08-11, 09-14, 10-13, 11-15, 12-13
- 2018-2021: the BLS dates already in the repository (`research/edge/event-reaction/build.mjs` `CPI_EARLY`, copied into
  `events.mjs`, not imported: it is a script, not a module). All are used (no spike check: they come from the schedule).
- 2022 to now: `council/events.mjs` `HISTORY` and `EVENTS` (type CPI), every release before the run time.
- The spike check is only a guard on the memory list. A real CPI day on which another 08:30 release also printed passes
  it as well; that is accepted (the trade is "the 08:30 New York candle on a CPI day").

## Data

OANDA mid M5 candles (`/md/bars?sym=<key>&tf=5m&from=&to=`, the site's candle proxy, through `node --use-env-proxy`):
`xau` (XAU_USD), `eurusd`, `usdjpy`, `nas100` (NAS100_USD), January 2012 to the run date. The placebo needs random
non-event weekdays and each of those needs its own 20 prior weekdays, so the whole history is fetched (paced, cached in a
scratch folder, never in git) and only weekday candles between 08:00 and 16:30 New York are kept. All clock work is New
York local time from the IANA zone (`America/New_York`), so daylight saving is handled; a candle is named by its opening
minute.

## The rule, for one market on one day

Candles: P = the 08:25 candle, W = the 08:30, 08:35 and 08:40 candles. All four must exist, else no trade (counted).
- `pre` = close of P (the price just before the release). `c45` = close of the 08:40 candle (the 08:45 price).
- `move` = c45 - pre. `move` = 0: no trade. `hi` / `lo` = the highest high and lowest low of W. `range` = hi - lo.
- **Range filter (fixed now):** no trade when `range` < 0.5 x the median `range` (same three candles) of the 20 most recent
  earlier non-event weekdays that have all four candles. A non-event weekday is not a CPI date of the list (the full
  memory list, failed dates included) and not a likely payrolls day (a Friday on the 1st-7th of the month). Fewer than 10
  such days in the 45 calendar days before: no trade (counted). Only candles before the event day are read.
- **Entry:** at c45, market, in the direction of `move` (follow) or against it (fade). dir = +1 long, -1 short.
- **Follow stop:** beyond the far extreme of the range: a long's stop is `lo`, a short's is `hi`; when that is closer than
  0.25 x `range` to the entry, the stop is moved out to 0.25 x `range` from the entry.
- **Fade stop:** 1 x `range` beyond the extreme being faded: a short after an up move has its stop at `hi + range`, a long
  after a down move at `lo - range`. (Always more than 0.25 x `range` from the entry, so the floor never binds.)
- **Management:** from the 08:45 candle on, each candle in time order: if it opens through the stop, out at its open; else
  if its range touches the stop (low <= stop for a long, high >= stop for a short), out at the stop. No target, no
  break-even, no trail.
- **Exit:** otherwise at the close of the last candle that opens before 16:00 New York (the 15:55 candle). Variant exit:
  before 11:00 (the 10:55 candle). A missing candle is skipped; at least one candle after entry is needed, else no trade.
- **R:** risk = |entry - stop|. Gross R = dir x (exit - entry) / risk. Net R = gross R - cost / risk.

## Costs (round trip, in price; the trade is risked in R, so the cost is cost / risk)

- Gold: $0.30 a round trip, as fixed by the brief (no event slippage added; a 2x-cost row is reported).
- EUR/USD, USD/JPY: 0.3 pip spread + commission 22.5 USD per million of notional a side (= 4.5e-5 x price a round trip,
  for both pairs) + **1 pip of slippage on each market fill on these event days**: entry and exit are both market fills
  (a stop is a stop-market order), so 2 pips. Pip = 0.0001 EUR/USD, 0.01 USD/JPY.
- NAS100: 1.5 points spread + **1 point of slippage on each market fill** (2 fills) = 3.5 points.

## The four tests and the pass bar

Tests: Follow-16:00, Follow-11:00, Fade-16:00, Fade-11:00. Each pools the four markets.
- The unit of the t is the EVENT, not the trade (the four markets on one day are not independent): event R = the mean net
  R of the markets that traded that day. Per test: n events, mean event R, t = mean / (sd / sqrt n) (sd with n - 1).
  The pooled net R a trade (mean over trades) is reported beside it.
- Windows: **decisive** January 2020 to the run date; **replication** January 2012 to December 2019.
- A test PASSES only if all hold:
  1. decisive: mean event R > 0 and t >= 2, and the pooled net R a trade > 0;
  2. Holm over the four tests on the decisive one-sided p values (Student t, n - 1 degrees of freedom): adjusted p < 0.05;
  3. replication: mean event R > 0 (same sign);
  4. placebo: the decisive mean event R is above the 95th percentile of 40 placebo values. Placebo seed s (1..40,
     mulberry32): draw, without replacement, as many weekdays as the test has decisive events from the decisive window's
     non-event weekdays (same definition as the filter, the candles needed present), run the same rule, filter, costs
     and exit on them, and take the mean event R.
- The study PASSES if at least one test passes; it is reported test by test. Per market rows (n, net R, t over trades) and
  gross R, 2x costs and year by year are reported, never judged.

## Will not be done

No parameter is changed after a result (the 0.25 floor, the 1x fade stop, the 0.5 filter, the exits, the costs). No market
is dropped or added. A failed test is not re-run on a sub-period, a market or a session.
