# Pre-registration: fade-late-tick-exec (24 Nov 2026)

Paper research only. Nothing live changes, nothing is placed, no rule is proposed from it. Written and pushed alone, **before
any broker tick of these orders is read** and before any query file is written. Owner's request (24 Nov 2026): "run it at the
broker ticks for 20 to 22 utc".

## Why

`fade-hour-check` found that the Break fade (fade the first M15 structure break) is strongest, before costs and on **mid**
candles, when the break candle starts at 20:00 or 21:00 UTC (2015-26, ten markets: +0.201R and +0.357R a trade), and that much
of it is booked inside the daily rollover (21:00-22:59 UTC), when the broker's spread is at its widest. A mid candle is not a
fill. `fade-late-hourcost` priced only the 20 and 23 UTC hours with hourly median spreads (-0.071R a trade), and
`fade-tick-exec` (a random sample over all hours) was INCONCLUSIVE because 28 % of its orders could not be resolved with
bracketed levels. Nobody has filled the 20:00-21:59 breaks at the broker's own bid and ask. This study does, with exact levels.

**These hours were chosen after looking at these same years** (`fade-hour-check`, `fade-conditions`). So this measures
execution of a selection already made. A PASS would be a hypothesis for a forward paper record, never an edge.

## The rule (unchanged, imported, never edited)

`grid7-wide-fade` cell `m15 none atr 2R all` through `fade-tick-exec/run.mjs` `orders()` (rule `a`): the first M15 structure
break (a close beyond the last confirmed swing, 3 candles a side, closed candles only), direction d; the fade trades side
s = -d at market at the open of the first 5-minute candle starting at or after the break candle's close; stop 1 x ATR(14) of M15
from the fill (every trade has one, on the losing side), target 2R, out after one day. The rule's own skips stay (risk under the
market's round-trip cost, data-quality exclusions, a mid path that cannot be resolved).

**Hour** = the UTC hour in which the break candle STARTS (its close minus 900 s), `fade-hour-check`'s definition.

## Markets, window, orders

- Broker XAUUSD (OANDA `xau`) and USDJPY (OANDA `usdjpy`): the two markets with tick history on the demo account.
- Signals whose mid fill candle starts in **2023-12-01 00:00 to 2026-11-20 00:00 UTC** (inside the broker's tick history).
- **Every** signal with hour 20, 21 or 22, no sampling. Counted before any tick was read: XAUUSD 126 / 70 / 156 and USDJPY
  168 / 152 / 232 in the slightly longer window from 24 Nov 2023. **Primary block: hours 20 and 21** (about 516 orders).
  Hour 22 is measured and reported beside, never part of the verdict.
- Power, said now: with about 500 orders and a per-trade sd near 1.3R, month t 2 needs roughly +0.11R a trade after
  commission. On mid these hours made +0.2R to +0.36R before costs, so a real tilt of that size would show; a FAIL means "not
  there at the broker's prices at this n".

## The measurement: two passes, exact levels (`council/tick-probe.mjs`)

**Pass 1 (marks).** The quote at each order's mid fill candle start (the entry moment), looked for up to 60 s before it; and the
quote at the end of its deadline candle, looked for up to 3,600 s before it (the deadline is a day later, at the same time of
day, often inside the broker's daily break).
- Entry: a buy fills at the ask, a sell at the bid: A. No quote in the 60 s before the entry moment = **entry unresolved**:
  the order is left out of every figure and counted (at these hours that is itself a finding: nothing to trade against).

**Pass 2 (fills), written only after A is known.** Levels on the tick scale with the rule's own distance D (the mid risk):
stop X = A - s x D, target T = A + 2 x s x D. The probe returns the first tick in a window of at most 1,800 s that crosses a
level on a named side (its `dir` 1 / -1: ask >= level / bid <= level; and, added for this study before any tick was read,
`dir` 2 / -2: bid >= level / ask <= level).
- Stop: the CLOSING side reaches X: a buy when bid <= X (dir -1), a sell when ask >= X (dir 1). Booked at that tick's closing
  price (a gap fills worse than X).
- Target: the CLOSING side reaches T: a buy when bid >= T (dir 2), a sell when ask <= T (dir -2). Booked at T (a limit).
- Windows: every 5-minute candle from the fill candle to the deadline candle whose mid low (buy stop, sell target) or mid high
  (sell stop, buy target) comes within **N** of the level, merged into windows of at most 1,800 s. N = 2 x W outside the
  rollover and 10 x W for candles starting 20:55-23:04 UTC, where the bid and ask stand far from the mid; W = $0.50 (XAUUSD),
  0.05 yen (USDJPY), the `-exec` studies' basis allowance. A crossing counts only at or after the entry moment.
- Exit = the earlier of the two crossings (exact tick times; both cannot happen on one tick). Neither by the deadline candle's
  end = **time exit** at the deadline quote (a buy at the bid, a sell at the ask). No deadline quote within 3,600 s, or a
  window that was not read = **exit unresolved**: left out and counted.

R on ticks = s x (exit - A) / D: it pays the spread at both ends. **After commission** = minus 2 x k x A / D with k = 0.000024
(XAUUSD) and 0.0000225 (USDJPY) a side. Mid R = the rule's own `exits()` on the same order, beside, with `combo-grid-2`'s flat
cost.

## Test and verdict (one test)

Primary block (hours 20 and 21, XAUUSD + USDJPY pooled), R a trade **after commission**:

- **PASS**: mean > 0, t of calendar-month sums >= 2, at least 300 resolved orders, and exit-unresolved orders at most 10 % of
  the entry-resolved ones.
- **INCONCLUSIVE**: exit-unresolved over 10 %.
- **TOO FEW**: under 300 resolved orders.
- **FAIL** otherwise.

Reported beside, none of it a verdict: before commission; tick minus mid per order (mean and month t); each market; each hour
(20, 21, 22); by year and side; the exit mix; entry-unresolved counts by hour; the spread paid at the entry in R (median, 90th
percentile) by hour; the share of orders open at any time inside 21:00-22:59 UTC and their R against the rest.

One run. No variant of the rule, the hours or the allowances on these years after the result. Deliverables: `run.mjs`
(`marks`, `queries`, `report`), the query files, `RESULT.md`, `result.json`, `tests/fade-late-tick-exec.test.mjs`.
