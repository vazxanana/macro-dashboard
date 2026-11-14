# Pre-registration: previous-day high / low raid and reversal to an H1 gap, spot gold (mmxm-pdhl-raid-gold, 14 Nov 2026)

Committed and pushed ALONE, before any candle of this test was fetched or read. Nothing below changes after a result is seen.
Research only: no live rule, size, filter, stop, config or council member changes.

**Owner decision 44.** This is a NEW stand-alone intraday rule on gold. It is not a gate, exit, entry or size of the live gold
book (Gold trend + Gold daily engulf) and it never reads the book's 2006-17 window: **no candle before 1 Jan 2018 is used**,
not even as warm-up of a test window (the only look-back is the previous day and 240 H1 candles before a trade; the first
traded day is chosen so that no look-back reaches into 2017). The brief asked for 2016 onward with an in-sample of 2016-2020;
2016-17 lies inside the 2006-17 window, so the owner's rule wins and the in-sample starts in 2018 (stated here, before any
result).

A first pre-registration of this model on US index CFDs (branch `mmxm-pdhl-raid`) was pushed and is NOT run (the owner made
gold the priority). It is left as it is.

## Source and what is tested
The owner's market-maker-model skill (written for gold) describes an intraday reversal model: in a kill zone the previous
day's high (or low) is run, the lower timeframe shifts its structure back the other way, and the trade aims at an hourly fair
value gap on the far side of the previous day's middle; with no such gap there is no trade, and sells are only taken above the
day's midnight open (buys below it). The skill also asks for an SMT divergence; it is tested here as a secondary rule with
silver. The rules below are this study's own mechanical reading.

Dedupe: no study has tested this. Closest: `gold-week-raid` (previous WEEK raid on gold, H1, FAIL 0 of 3), `swing-day3` (the
skill's swing-point model on gold, another model), `ict-concepts` (turtle soup / NWOG on H1, FAIL), `ict-sessions`, and the
6 Nov skill cross-check on branch `ict-mmxm` (the midnight-open filter on the desk's H1 iFVG model, not this model).

## Market and data (fixed before any result)
- OANDA mid **XAU/USD** (`xau`), and **XAG/USD** (`xag`) for the SMT test only, M15 and H1 candles, through the keyless proxy
  `https://meridianx.dev/md/bars` (`node --use-env-proxy`), paged in windows of 4,999 candles as
  `research/edge/trend-breadth-h1/fetch.mjs` does; requested from 2017-12-01 so the previous day of 2 Jan 2018 exists, but no
  candle before 2018-01-01 00:00 UTC is kept except the previous day of the first traded day and the H1 gap look-back, both cut
  at 2018-01-01: the first traded day is the first day whose previous day and 240-candle H1 look-back lie wholly in 2018.
  Complete candles only. Cache kept out of git.
- Span: to the last complete New York day before the run (13 Nov 2026).
- Clock: New York wall time (`Intl` `America/New_York`, daylight saving handled) via `ict/calendar.mjs` `nyParts` (read only).
  Weekend: `council/fills.mjs` `spotClosed` (read only); candles inside it are dropped. A day whose `ict/calendar.mjs` `dayInfo`
  kind is `full` or `early` is not traded (an early close or holiday thins the session); it still serves as the next day's
  previous day when it has candles.

## Rule (sells described; buys mirror every price comparison)
1. **New York day** D = the candles from 17:00 ET of the evening before to 17:00 ET (Sunday 17:00 opens Monday's day).
   **Previous day** = the New York day immediately before D that has candles (Friday's for a Monday). PDH / PDL = its highest
   high / lowest low over M15 candles; **PD mid** = (PDH + PDL) / 2.
2. **Midnight open** MO = the open of D's M15 candle starting 00:00 ET (none: no trade that day).
3. **Raid** (kill zone K): the first M15 candle of D whose high is above PDH (sell side) or low below PDL (buy side) and that
   STARTS inside K. **Primary K = New York, 08:00-12:00 ET** (raid candle starting 08:00 to 11:45), as the skill maps gold.
   Secondary K = London, 02:00-05:00 ET (starting 02:00 to 04:45). If the level was already traded beyond earlier in D (from
   17:00 on), that side does not count that day. A first raiding candle that crosses both PDH and PDL skips the day. Only the
   first raid inside K is a candidate; at most one trade a day.
4. **MSS**: a confirmed M15 swing low = a candle whose low is below the lows of the 2 candles before and the 2 after
   (confirmed once the second candle after has closed), whose own index is at or after the raid candle. The MSS candle is the
   first M15 candle that CLOSES below the most recent swing low confirmed before it, starting no later than 1 h 45 min after the
   raid candle's start (closing within 2 h of the raid). None: no trade.
5. **Raid extreme** X = the highest high from the raid candle to the MSS candle. The **leg** = from the candle that made X to the
   MSS candle; leg low L = its lowest low.
6. **Entry** (one rule, fixed here): a sell **limit at the 50 % of the leg**, E = (X + L) / 2, placed at the MSS candle's close.
   (The FVG-near-edge entry is not tested.)
7. **Stop**: S = X + $0.30. Risk r = S − E (r ≤ 0: no trade).
8. **Target** (decided at the MSS close, from H1 candles CLOSED by then, at most 240 H1 candles back): the nearest **unfilled
   bullish H1 fair value gap** (the opposite-direction gap: candle 3's low above candle 1's high) whose top edge (candle 3's
   low) is at or below PD mid and below E. Unfilled = no H1 candle after candle 3, up to the MSS close, has a low at or below
   candle 1's high. Nearest = the highest such top edge. Target T = that top edge. No such gap: no trade. (E − T) / r < 1.5: no
   trade.
9. **Midnight-open filter**: a sell only when E > MO; a buy only when E < MO.
10. **Order life and fills** (M15): live from the MSS close until the candle starting 15:45 ET; cancelled if, before it fills,
    price reaches T (a low at or below T) or trades above S. A candle whose high reaches E fills at E (at the open if the open
    is already above E). From the fill candle on: a high at or above S stops it at S (at the open if it gaps above), a low at or
    below T takes the target at T; both in one candle = the stop; in the fill candle itself only the stop is checked. Not out
    by the close of the 15:45 candle: flat at that close.
11. **SMT (secondary test only)**: a sell also needs silver NOT to have traded above ITS previous day's high (same day
    definition) from the gold raid candle's start to the gold MSS candle's close (gold made the higher high, silver did not);
    a buy mirrors with the lows. Silver missing for any of those candles: no trade.
12. **R** = (E − exit) / r for a sell. **Costs**: **$0.30 a round trip** (the spread the gold studies and `council/fills.mjs`
    `spreadOf` use for gold); no financing (flat before the 17:00 rollover). Net R = R − 0.30 / r. A 2x-cost run uses $0.60.

## Windows, tests, statistics
- **In sample 2018-01-01 to 2020-12-31; out of sample 2021-01-01 to the end of the data**, by the trade's New York date.
- **T1 (primary)**: New York kill zone, with the midnight-open filter.
- **T2**: T1 without the midnight-open filter (what the filter is worth).
- **T3**: London kill zone, with the filter.
- **T4**: T1 plus the silver SMT condition (step 11).
- Statistic: t of the calendar-month sums of net R (every calendar month of the window counts, zero when there is no trade),
  one-sided p from the t distribution; **Holm over the four OOS tests**.
- **Pass bar (T1)**: OOS net t >= 2 with Holm-adjusted p < 0.05, in-sample net mean of the same sign (> 0), and OOS mean net R
  still > 0 at 2x costs. Anything else is FAIL. T2-T4 are reported and cannot turn a FAIL into a pass.
- **Placebo** (40 seeded draws, seeds 1..40): on each day T1 traded, the same fill time and price, a random direction, the same
  risk r, the target found by the step-8 rule in the drawn direction relative to that price (under 1.5R or none: no placebo
  trade that day), managed by step 10 from the fill candle on, costs as T1. Reported: how many of the 40 draws' OOS net R a
  trade the real T1 beats.
- Reported per test and window: n, win rate, gross and net R a trade, total, month t, stops / targets / flat exits, median risk
  in dollars, worst drawdown; per year; the funnel (days, raids, MSS, target found, >= 1.5R, filter, fills).

## Deliverables
`run.mjs` (fetch + run), `RESULT.md`, `result.json`, `tests/mmxm-pdhl-raid-gold.test.mjs` (offline: the rule on hand-made
candles, no look-ahead, the report against result.json), rebuilt `out/`.
