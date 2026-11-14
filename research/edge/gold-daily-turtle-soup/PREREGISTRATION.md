# Pre-registration: Turtle Soup (failed 20-day breaks) on spot gold daily (14 Nov 2026)

Written, committed and pushed alone before any number of this study was computed. Paper research: nothing here is read by
the council, the mirror or the page, and no live rule changes whatever the verdict.

**Item 44 (docs/owner-decisions.md) and what this study is not.** A NEW stand-alone daily rule on gold, judged on its own
out-of-sample years (2017 to October 2026). It is not a gate, exit, entry or size of the gold book (Gold trend / Gold daily
engulf), reads none of that book's trades or signals, and its verdict says nothing about that book. Gold trend BUYS a
breakout of the prior 20 daily highs; this rule FADES a 20-day break that fails at once (it sells a failed new 20-day high and
buys a failed new 20-day low). The two share the 20-day channel and nothing else; no result here is to be read as a filter or
exit for Gold trend, and none will be proposed as one.

## Why, and what is already tested (dedupe)
"Turtle Soup" (L. Raschke): a market makes a new 20-day low (high) some days after the previous 20-day low (high); the
breakout traders' stops are taken and price comes back inside; enter against the break with a stop order back inside the old
extreme, stop beyond the new extreme. The owner's ICT material names the same idea "turtle soup at lows that broke highs".
- `ict-concepts` (main): turtle soup on H1 at relative equal lows / "the low that broke the high", 96-candle pools, indices and
  GC, entry at an H1 close back inside, A-rule stop band: FAIL. Intraday pools, not the 20-day daily channel.
- `gold-week-raid` (branch): a raid of the PREVIOUS WEEK's high / low and a close back inside: FAIL. A one-week range, not a
  20-day extreme with a 3-day spacing rule, and entry on an H1 close, not a stop order at the old extreme.
- `mmxm-pdhl-raid-gold` (branch): previous DAY's high / low raid in the New York kill zone with an M15 shift: FAIL (12 trades).
- `gold-shock-revert` (branch): fade a close-to-close move over 2 x ATR: FAIL. A move size, not a channel break.
- `gold-ibs` (branch): close position inside the day's range: FAIL. No channel, no break.
- `gold-record-high` (branch): long after an all-time closing high (continuation): FAIL.
- `gold-key-reversal` (running on another branch at the time of writing): a key-reversal day = a new extreme and a CLOSE
  back beyond the prior day's close, entered after the close. Turtle Soup differs: the trigger is the 20-day channel with
  the previous extreme at least 3 days old, the entry is an intraday STOP order at the old extreme (no close needed, T1), and
  the stop sits beyond the new extreme.
None tested the 20-day Turtle Soup on gold daily: this is new.

## Data and the day
- OANDA mid H1 XAU_USD through the site's keyless candle proxy (`fetch.mjs`, March 2006 to the end of the data; cache kept out
  of git). Complete candles only.
- **Days are 17:00 New York trading days** built from H1 with `research/edge/gold-drd-long/run.mjs` `days` / `nyDay`
  (imported, unchanged; weekend hours dropped), as `gold-ibs` did. The channel, the spacing rule and the time exit use these
  days; fills, stops and targets are checked on the H1 candles.

## Definitions (a buy; a sell mirrors every line)
- `L20(i)` = the lowest daily low of days i-20 .. i-1; `k(i)` = the most recent of those days whose low equals it.
- **Spacing**: `i - k(i) >= 3` (the previous 20-day low was made at least 3 trading days before day i).
- **Buffer** `B` = $0.30 (gold-ibs / gold-systems' stop buffer).

## The rule (three tests, fixed now)
**T1 (primary), classic Turtle Soup, both sides.** On day i with the spacing rule met, the first H1 candle of day i whose low
goes below `L20(i)` arms a BUY STOP at `L20(i) + B`. The order works from the NEXT H1 candle to the end of day i+1 (the
"same / next day" window); if not filled by then, no trade. Fill: the first working H1 candle whose high reaches the level, at
max(open, level) (a candle that opens through it fills at its open). Initial stop = the lowest low of all H1 candles from the
start of day i up to (not including) the fill candle, minus B. If that stop is not below the fill, no trade.
**T2, Turtle Soup Plus One, both sides** (Raschke's own version). Day i CLOSES below `L20(i)` (spacing rule met). On day i+1
only, a BUY STOP at `L20(i) + B` works from day i+1's first H1 candle; fill as T1. Initial stop = the lowest low of days i and
i+1 up to (not including) the fill candle, minus B.
**T3, longs only**: T1's buys alone.

**Exit (all three)**: target = fill + 2 x (fill - stop) (2R, a resting limit), else the stop, else the close of the third
trading day after the fill day (fill day = day 0; out at day 3's 17:00 New York close). Checked on H1 candles from the candle
AFTER the fill candle; on the fill candle itself only the stop counts (its low may come after the fill: worst case). A candle
holding both stop and target is a stop; a candle that opens through the stop fills at its open, through the target at the
target. One position at a time per test (a signal while a trade of that test is open is skipped; T1 buys and sells share one
book).
Nothing is computed from data after the fill except the trade's own path (a test checks this on hand-made candles).

## Costs (every trade, in price)
- Spread **$0.30** a round trip, plus slippage of **half a spread ($0.15) per market order**: the stop-order entry is a market
  order (slippage paid), the stop exit and the time exit too; a target fill is a limit (no slippage). So $0.60 a round trip
  for a stop or time exit, $0.45 for a target exit (`council/fills.mjs` convention).
- Financing on longs only: `council/fills.mjs` `nights(entryTime, exitTime)` x `FIN.xau.long` (0.000148 of price a rollover,
  the demo broker's XAUUSD swap of 11 Nov 2026, today's rate for every year) x entry price. Shorts pay and earn nothing.
- R = side x (exit - entry) / (entry - stop distance), minus costs and financing in R; gross R reported beside it.
- **2x costs**: spread, slippage and financing all doubled.

## Windows (by fill day)
- **Out of sample (decisive): 2017-01-01 to 2026-10-31.**
- In sample (replication): 2007-01-01 to 2016-12-31 (2006 is warm-up and is not reported).

## Statistics
- t on calendar-month sums of net R: every calendar month of the window counts, 0 where no trade closed; a trade belongs to its
  exit month. One-sided p from the normal distribution. Holm over the three tests.
- Placebo, 40 seeds (fixed seeded generator): each real out-of-sample trade is replaced by an entry at the first H1 open of a
  random trading day of the same calendar year, same side, a stop at the same multiple of ATR(20) (simple mean of 20 daily
  true ranges ending the day before) as the real trade's risk, 2R target, held at most the real trade's number of days, same
  costs, no one-at-a-time rule. The rule's mean net R a trade is compared with the 40 seed means.

## Pass bar (per test; all needed)
1. Out of sample n >= 50.
2. Out of sample mean net R a trade > 0, month-sum t >= 2 and Holm-adjusted p < 0.05.
3. In sample mean net R a trade > 0 (same sign).
4. Out of sample mean net R still > 0 at 2x costs.
5. The rule's out-of-sample mean above at least 38 of the 40 placebo seed means.

**Verdict**: PASS if T1 passes. If T1 fails the study FAILS whatever T2 / T3 do; a T2 or T3 passing alone is reported by
name as "passes alone, not an edge until replicated on other data". Never called an edge without n and t. Reported besides,
not tested: buys and sells apart, year by year, exits by kind, gross R.
