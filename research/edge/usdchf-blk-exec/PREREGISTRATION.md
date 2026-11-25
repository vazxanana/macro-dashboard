# Pre-registration: usdchf-blk-exec (25 Nov 2026)

Paper research only. Nothing live changes, nothing is placed, no rule is proposed. Written and pushed alone, **before any broker
tick of these orders is read**. Owner's request (25 Nov 2026): "just keep going with the research".

## Why

The auto-researcher (`auto-1`, `research/edge/auto-researcher`) produced one lead out of 262 holdout looks: USD/CHF, block-break
fade (the close of the 19:00 UTC H1 candle beyond the high / low of the previous 3 H1 candles is faded at the next open; stop
1 x ATR(14), target 0.5R, out after 4 hourly candles). On mid candles it makes +0.084R a trade after the engine's assumed
0.7 pip cost (t 3.85, 2020 on). An audit found no look-ahead, but every trade is entered at 20:00 UTC and held through the
21:00-22:00 UTC rollover, where the demo broker quotes USD/CHF about 2 pips wide; re-costing the same trades at 1.4 / 2.1 / 2.8 pips
gives +0.026R / -0.032R / -0.090R. The assumed cost is the only thing the lead rests on. This study fills the same orders at the
broker's own bid and ask. The rule was found on these same years (a hypothesis picked from 262 looks), so a PASS would be a lead for
a forward paper record, never an edge.

## The rule (unchanged)

The lead's exact genome, `orders.mjs`: hour 19 UTC, H 3, faded, both sides, stop 1 x ATR(14) of H1 from the fill, target 0.5R,
out after 4 H1 candles (the 00:00 UTC close), one at a time, the engine's skip when the cost exceeds half the stop. Counted before
any tick was read, on mid candles: **185 orders** with entry (the 20:00 UTC H1 open) from 2023-12-01 to 2026-11-20 (inside the
broker's tick history); mid mean +0.081R after the engine's cost; 51 time exits.

## The measurement (`council/tick-probe.mjs`, the `fade-late-tick-exec` method)

Pass 1 (marks): the quote at the entry moment (looked for up to 60 s before it) and at the deadline (up to 3,600 s before it). A
buy fills at the ask, a sell at the bid: A. No entry quote = entry unresolved (left out, counted). Pass 2 (fills), only after A is
known: stop X = A - s x D, target T = A + s x 0.5 x D (D = the mid risk); first tick on the CLOSING side crossing each level (a buy
closes at the bid, a sell at the ask), windows of at most 1,800 s over the 5-minute candles that come within N of a level
(N = 2 x W, 10 x W inside 20:55-23:04 UTC; W = 0.00005). A stop books at the tick's closing price (a gap fills worse), a target at
T, neither by the deadline = time exit at the deadline quote. Exit unresolved = left out, counted.

R on ticks = s x (exit - A) / D (pays the spread at both ends); after commission = minus 2 x 0.0000225 x A / D (the demo's raw-spread
commission, as the USD/JPY and gold studies). Mid R beside it.

## Test and verdict (one test)

R a trade after commission, all resolved orders, t of calendar-month sums:

- **PASS**: mean > 0, month t >= 2, at least 150 resolved orders, exit-unresolved at most 10 % of the entry-resolved.
- **INCONCLUSIVE**: exit-unresolved over 10 %. **TOO FEW**: under 150 resolved. **FAIL** otherwise.

Power, said now: with about 185 orders and a per-trade sd near 0.9R, month t 2 needs roughly +0.15R a trade; the mid figure is
+0.08R, so even a faithful fill would likely read short of t 2: the likely reading is "no evidence", and what the study can decide
is that the broker's quotes take the +0.08R away (mean at or under 0). Reported beside, none of it a verdict: before commission;
tick minus mid per order; the entry spread in R (median, 90th percentile); each year and side; the exit mix; the orders open
inside 21:00-22:59 UTC.

One run. No variant of the rule, hours or allowances on these years after the result. Deliverables: `run.mjs`, the query files,
`RESULT.md`, `result.json`, `tests/usdchf-blk-exec.test.mjs`.
