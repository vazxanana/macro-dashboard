# Pre-registration: gold-london-orb, a breakout of gold's first London hour range

Written and pushed on 14 Nov 2026 before any trade of this rule was computed. Paper research only.

## What this is, and what it is not

A **new stand-alone intraday rule** on spot gold. It is **not a gate, exit, entry or size of the live gold book** (Gold trend +
Gold daily engulf): none of that book's records is read, and nothing here can change it (owner decision 44 forbids testing
further gates, exits, entries or sizes of that book on 2006-17; this study does none of those). Nothing live changes whatever
the result; a pass would at most be a proposal for the owner with its own forward record.

## Not already tested (checked before writing this)

- `gold-asia-break`: the Asian range (00:00-06:59 London) broken in London. Another range.
- `gold-comex-orb`: the 08:20-08:50 New York range. Another session.
- `fx-london-orb`: the same London hour, on six forex majors only, no gold.
- `gold-london-reversal`: fades the London move at 09:30 New York. Not a breakout of a range.
- `gold-vol-breakout`, `gold-vol-breakout-replicate`: the UTC open ± k x the previous day's range. Not a session range.
- `intraday-momentum`, `metals-intraday-momentum`: first-to-last half-hour momentum. Not a range breakout.

## Data

OANDA mid XAU/USD M5 candles, 2006-11 to 2026-11 (kept outside git). Times are UTC. The candles from 2007-11 are read only to
warm up the 20-day median of T3; no trade before 2008-01-01 is counted.

## The rule (one trade a day at most)

- **Day**: a UTC calendar day Monday-Friday.
- **Range hour**: London 08:00-08:59 local time. In British Summer Time (last Sunday of March 01:00 UTC to last Sunday of
  October 01:00 UTC) that is **07:00-07:59 UTC**, otherwise **08:00-08:59 UTC**. The UTC hour used is recorded per day
  (`rangeUtcHour`). Range high / low = the highest high and lowest low of the twelve M5 candles of that hour. A day is skipped
  when the hour has fewer than 10 candles or a flat range, or when fewer than 60 candles exist from the range's end to 20:00 UTC.
- **Orders**: at the close of the range hour, a buy stop at the range high and a sell stop at the range low, live until 16:00 UTC
  (the last candle that can fill starts at 15:55). The first to fill wins and the other is cancelled.
- **Fills**: a buy stop fills at the range high when a candle's high reaches it, or at the candle's open when it opens above it
  (a gap fills at the open); sell stop mirrored. If one candle reaches both levels, the side whose level is nearer that candle's
  open is the fill, and its stop is in the same candle, so it is counted as stopped (rule below).
- **Stop**: the opposite side of the range (buy: range low; sell: range high). **Every trade has this stop.** 1R = |entry - stop|
  at the actual fill. A stop that falls in the same M5 candle as the fill counts as hit. A gap through the stop fills at the
  candle's open. If a stop and a target fall in one candle, the stop counts.
- **T1**: exit at 20:00 UTC (the close of the 19:55 candle), or at the stop.
- **T2**: target 1.5R from the entry, else as T1.
- **T3**: T1, only on days whose range width is under the median width of the previous 20 days that had a range (strictly
  earlier days; fixed in advance as a compression filter).

## Costs

$0.60 a round trip per ounce on every trade (spread and slippage together), taken off in R as 0.60 / 1R. 2x costs ($1.20)
reported and used in the pass bar. Financing: none; every trade is flat by 20:00 UTC, before the 17:00 New York rollover
(21:00 or 22:00 UTC).

## Windows

In sample 2008-01-01 to 2016-12-31; out of sample 2017-01-01 to the last complete day of the data (2026-11). OOS halves for the
"both halves" check: 2017-2021 and 2022-now.

## Statistics

- t on calendar-month sums of net R (each month one value). One-sided p from the normal; Holm across the three tests (T1, T2, T3).
- Placebo, 40 seeds: on each day the test traded out of sample, enter at market at the open of a random M5 candle starting
  09:00-15:55 UTC, random side (50/50), stop at the same distance as that day's range width, exit as the test (T2 with its 1.5R
  target), same cost. Seeds 1..40, one draw a day. The test's OOS net R a trade must beat the placebo seed mean in 38 of 40.

## Pass bar (per test; the verdict is PASS if any test passes, T1 is the primary)

1. OOS net R a trade > 0
2. OOS month-sum t >= 2 and Holm p < 0.05
3. Net R a trade > 0 in both OOS halves (2017-21, 2022-now) and in sample (2008-16)
4. OOS net R a trade > 0 at 2x costs
5. Beats >= 38 of 40 placebo seeds
6. OOS n >= 30

Anything else is FAIL. No parameter (hour, cutoff, exit time, target, cost, filter) will be changed after the first run.
