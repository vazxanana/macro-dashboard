# Pre-registration: gold's first new 20-day closing extreme after a stall without one (14 Nov 2026)

Written and pushed alone, before any trade, return or R of this rule was computed. The only things read from the data before
this file were the numbers of signal days per window for a few stall lengths (below), as the study brief requires. Paper
research only: nothing live changes, and no proposal follows from this file.

**Item 44.** A new stand-alone daily rule on spot gold with its own entry, stop and fixed exit, judged on 2017-26. It is not a
gate, exit, entry or size change of the gold book (Gold trend / Gold daily engulf), it reads none of that book's 2006-17
positions and it changes none of its trades. (Its buys fall on days that make a new 20-day closing high, which the live
trend rule may also act on; this study measures its own separate trade and draws no conclusion about the book.)

## The idea
The measured quantity is TIME, not range width: how many trading days gold has gone without a new 20-day closing high or a
new 20-day closing low (a "drought" of new extremes). After such a stall, the first close at a new 20-day extreme either
starts a move out of the stalled range (follow it) or is a false break back into it (fade it).

## Why this is not a duplicate
- `gold-box-breakout` (FAIL) and `gold-squeeze` (FAIL) select a NARROW range (five-day range under 0.6 x its average; Bollinger
  width): a volatility condition, entries by stop orders at the box edge. Here no width is read: a stall can be wide or
  narrow; the condition is only the count of days since the last new 20-day closing extreme, and entry is at the next open.
- `gold-aroon` (FAIL) traded crosses of Aroon(25) up and down lines; it never conditions on the time since BOTH extremes and
  never trades the first new extreme after a stall.
- `gold-record-high`, `gold-week-close-extreme`, `gold-extreme-timing`, `gold-run-pause`, `nr7-breakout`, the volatility
  breakout family and `trend-breadth` (the live rule on other markets) condition on other things. No study in
  `research/edge/` or on a remote branch conditions on the number of days without a new 20-day extreme.

## Hypotheses
- **H1 (primary, T1, follow)**: after 7 or more trading days without any new 20-day closing high or low, a trade in the direction
  of the first new 20-day closing extreme (buy a new high, sell a new low), entered at the next open and held 10 trading days,
  does better than the same-side trade entered on any day.
- **H2 (T2, fade)**: the opposite reading of the same days: sell the new high, buy the new low, same exits.

## Data
OANDA mid daily XAU_USD, council-data `research/daily/xau.json` (`git show origin/council-data:…`, no network), 2006-03-20 to
2026-11-13, weekend candles folded into the next weekday by `council/fills.mjs` `foldWeekend` (5,369 trading days). The candle
copy is kept outside git and deleted at the end. Market set fixed now: spot gold only.

## Rule (exact)
- Day i is a **new 20-day closing high** when close(i) > max(close(i-20) .. close(i-1)), a **new 20-day closing low** when
  close(i) < min(close(i-20) .. close(i-1)) (strict). Days before index 20 are neither.
- **Stall length** at a new extreme on day i = the number of trading days strictly between the previous new extreme (high or
  low) and day i. **Signal day** i: a new 20-day closing extreme whose stall length is at least **K = 7**. Everything is known
  at the close of day i.
- Entry at the open of day i+1, side +1 for a new high and -1 for a new low (T1), the opposite (T2). Stop 3 x ATR(14) (true
  range of days i-13 .. i, known at the signal; the wide stop) on the losing side; a day after the entry day that opens through
  the stop exits at that open, otherwise a touch exits at the stop. Out at the close of the 10th trading day (i+10) when not
  stopped. No target.
- One position at a time per test: a signal while that test's position is open is skipped.
- R = (exit - entry) / risk x side, risk = the stop distance.

## Costs
$0.60 a round trip on every trade (the brief's figure), plus on buys overnight financing `nights(entry, exit)` x
`FIN.xau.long` (0.000148 of price a rollover, the cTrader demo's XAUUSD swap of 11 Nov 2026, `council/fills.mjs`) x entry price,
in R by dividing by the risk. Sells pay and receive nothing. The same rate is used for every year (a stated assumption).
2x costs = both doubled.

## Windows and counts
In sample (IS) entries 2007-01-01 to 2016-12-31; out of sample (OOS) entries 2017-01-01 to 2026-10-31; month sums by entry
month. Signal days counted before this file (entry in the window): K = 7: IS 108 (56 highs, 52 lows), OOS 113 (67, 46);
with the one-position rule at most a 10-day hold removes, at least 100 IS and 108 OOS trades remain. Stalls of 15 or more days
(the length first considered) give only 36 IS and 30 OOS signals, under the 100 a window the brief requires, so K = 7 is fixed
here from the counts alone. Other counts seen: K = 6: 123 / 127; K = 8: 94 / 103; K = 10: 78 / 84.

## Statistics
- Per test and window: n, gross R a trade, cost and financing R, net R a trade, total, win rate, exits by kind, buys / sells.
- **Same-side every-day baseline**: the same side, stop, hold and costs entered at the open after EVERY trading day of the
  window (overlapping, a pool, not a test); its mean net R a trade per side and window.
- **Excess** of a trade = its net R minus the baseline mean net R of its side in its window. **The test statistic is the t on
  calendar-month sums of excess** (every month of the window counts, an empty month 0), one-sided p from the normal. The t on
  month sums of net R is reported too.
- **Holm** over the two one-sided OOS excess p values.
- **Placebo** (40 seeds, mulberry32 seeds 1-40): the same OOS signal days and exits with the side drawn at random per trade.
- **Control that keeps drift and volatility but removes the signal** (40 seeds, seeds 101-140): for each calendar year of the
  OOS window and each side, the same number of trades as the test took that year on that side, entered on random trading days
  of that year (drawn without replacement, one position at a time, the same stop, hold and costs). It keeps the year's drift
  and volatility, the side mix and the trade count, and removes which days were picked.

## Pass bar (per test; the study's verdict is PASS only if T1 passes)
1. OOS excess month t >= 2 and Holm-adjusted one-sided p <= 0.0228.
2. IS excess > 0 (same sign).
3. OOS net R a trade > 0 and OOS excess > 0 at 2x costs.
4. OOS net R a trade above at least 38 of 40 placebo draws AND at least 38 of 40 control draws.
T2 passing alone would be a lead to replicate on other data, not an edge. Nothing about the rule (20-day extremes, K = 7, the
10-day hold, the 3 x ATR(14) stop) is changed after a result. Any later variant needs its own pre-registration on other data.

## Deliverables
`run.mjs` (`fetch <dir>`, then `full <dir>`), `RESULT.md` with the bold verdict line, `result.json`, and
`tests/gold-stall-drought.test.mjs` (rule on hand-made candles, no look-ahead, the report against result.json).
