# Pre-registration: previous-day high / low raid and reversal to an H1 gap, US index CFDs (mmxm-pdhl-raid, 14 Nov 2026)

Committed and pushed ALONE, before any candle of the test was fetched or read. Nothing below changes after a result is seen.
Research only: no live rule, size, filter, stop, config or council member changes. Gold is not tested (owner decision 44).

## Source and what is tested
The owner's market-maker-model skill describes an intraday reversal model: in the New York morning the previous day's high (or
low) is run, the lower timeframe shifts its structure back the other way, and the trade aims at an hourly fair value gap on the
far side of the previous day's middle; with no such gap there is no trade, and sells are only taken above the day's midnight
open (buys below it). The rules below are this study's own mechanical reading of that idea. The skill also asks for an SMT
divergence between related markets; it is NOT part of this test (it is not in the rule set fixed by the brief), so this is the
model without SMT.

Dedupe: no study has tested this. Closest: `gold-week-raid` (previous WEEK raid on gold, FAIL), `swing-day3` (another model, on
gold), `ict-concepts` (turtle soup / NWOG on H1, FAIL), `ict-sessions` (timing of the ICT A-setup), and the 6 Nov skill
cross-check on branch `ict-mmxm` (the midnight-open filter on the desk's H1 iFVG model, not this model).

## Markets and data (fixed before any result)
- OANDA mid candles of **NAS100, SPX500, US30** (`nas100`, `spx500`, `us30`) through the keyless proxy
  `https://meridianx.dev/md/bars` (`node --use-env-proxy`), M15 and H1, paged in windows of 4,999 candles as
  `research/edge/trend-breadth-h1/fetch.mjs` does. Complete candles only. Cache kept out of git.
- Span: New York trading days from 4 Jan 2016 to the last complete day before the run (13 Nov 2026).
- Clock: New York wall time from `Intl` `America/New_York` (daylight saving handled), via `ict/calendar.mjs` `nyParts`
  (read only). `cmeShut` drops candles in a CME-shut period. A day whose `dayInfo` kind is `full` or `early` is not traded
  (an early close ends before the 16:00 flat time); such a day still serves as the next day's "previous day" only if it is not
  `full`.

## Rule (sells described; buys mirror every price comparison)
1. **New York day** D = the candles starting from 18:00 ET of the evening before to 17:00 ET (Sunday 18:00 opens Monday's day).
   **Previous day** = the New York day immediately before D that has trading candles (Friday's for a Monday). PDH / PDL = its
   highest high / lowest low over M15 candles; **PD mid** = (PDH + PDL) / 2.
2. **Midnight open** MO = the open of D's M15 candle starting at 00:00 ET (no such candle: no trade that day).
3. **Raid**: the first M15 candle of D whose high is above PDH (sell side) or low below PDL (buy side). It must START between
   08:00 and 11:45 ET; if PDH was already traded above earlier in D (from 18:00 on), the high side does not count that day
   (mirror for PDL). If the first raiding candle crosses both PDH and PDL, the day is skipped. Only the first raid of the window
   is a candidate; at most one trade a day per market.
4. **MSS** (market structure shift): a confirmed M15 swing low = a candle whose low is below the lows of the 2 candles before
   and the 2 after (confirmed once the second candle after has closed), whose own index is at or after the raid candle. The
   MSS candle is the first M15 candle that CLOSES below the most recent swing low confirmed before it, and it must start no
   later than 1 h 45 min after the raid candle's start (closes within 2 h of the raid). None: no trade.
5. **Raid extreme** X = the highest high from the raid candle to the MSS candle. The **leg** = from the candle that made X to the
   MSS candle; leg low L = its lowest low.
6. **Entry**: ONE rule, fixed here: a sell **limit at the 50 % of the leg**, E = (X + L) / 2, placed at the close of the MSS
   candle. (The FVG-near-edge entry is not tested.)
7. **Stop**: S = X + buffer, buffer = 1 point NAS100, 0.5 SPX500, 2 US30. Risk r = S − E (r ≤ 0: no trade).
8. **Target** (decided at the MSS close, from H1 candles that have CLOSED by then, looking back at most 240 H1 candles): the
   nearest **unfilled bullish H1 fair value gap** (the opposite-direction gap: candle 3's low above candle 1's high) whose top
   edge (candle 3's low) is at or below PD mid and below E. Unfilled = no H1 candle after candle 3, up to the MSS close, has a
   low at or below candle 1's high. "Nearest" = the highest such top edge. Target T = that top edge. No such gap: no trade.
   (T − E distance) / r < 1.5: no trade.
9. **Midnight-open filter** (T1 only): a sell only when E > MO; a buy only when E < MO.
10. **Order life and fills** (M15): the limit is live from the MSS candle's close until the candle starting 15:45 ET; it is
    cancelled if, before it fills, price reaches T (a low at or below T) or the leg's high side is retaken (a high above S).
    A candle whose high reaches E fills it at E (at the open if the open is already above E). From the fill candle on: a high at
    or above S stops it at S (at the open if it gaps above), a low at or below T takes the target at T; both in one candle =
    the stop. In the fill candle itself only the stop is checked. Not out by the close of the 15:45 candle: flat at that close.
11. **R** = (E − exit) / r for a sell. **Costs**, round trip in index points (no financing: flat before the 17:00 rollover):
    NAS100 **2**, SPX500 **1** (the `orb-nas100` / `pre-fomc-drift` figures), US30 **3** (assumed, the same order of spread for
    a market about 1.5-2x NAS100's points). Net R = R − cost / r. A 2x-cost run doubles the cost.

## Windows, tests, statistics
- **In sample 2016-01-01 to 2020-12-31; out of sample 2021-01-01 to the end of the data.** By the trade's New York date.
- **T1 (primary)**: the rule with the midnight-open filter, pooled over the three markets.
- **T2**: the same rule without the midnight-open filter, pooled (shows what the filter is worth).
- **T3-T5**: T1 on NAS100, SPX500, US30 alone.
- Statistic: t of the calendar-month sums of net R (every calendar month of the window counts, zero when there is no trade),
  one-sided p from the t distribution; **Holm over the five OOS tests**.
- **Pass bar (T1)**: OOS net t >= 2 with Holm-adjusted p < 0.05, in-sample net mean of the same sign (> 0), and OOS mean net R
  still > 0 at 2x costs. Anything else is FAIL. T2-T5 are reported; none of them can turn a FAIL into a pass.
- **Placebo** (40 seeded draws, seed 1..40): on each day T1 traded, the same fill time and price, a random direction, the same
  risk r, the target found by the step-8 rule in the drawn direction (relative to that price, from the same candles; under
  1.5R or none: no placebo trade that day), managed by step 10 from the fill candle on. Reported: how many of the 40 draws'
  OOS net R a trade the real T1 beats.
- Reported per test and window: n, win rate, gross and net R a trade, total, month t, stops / targets / flat exits, median risk
  in points, worst drawdown; per year; the funnel (days, raids, MSS, target found, >= 1.5R, filter, fills).

## Deliverables
`run.mjs` (fetch + run), `RESULT.md`, `result.json`, `tests/mmxm-pdhl-raid.test.mjs` (offline: the rule on hand-made candles,
no look-ahead, the report against result.json), rebuilt `out/`.
