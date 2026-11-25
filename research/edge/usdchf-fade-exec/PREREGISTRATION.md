# Pre-registration: usdchf-fade-exec (25 Nov 2026)

Paper research only. Nothing live changes, nothing is placed, no rule is proposed. Written and pushed alone, **before any broker
tick of these orders is read**. Owner's request (25 Nov 2026): "Yes start the USD/CHF re-pricing".

## Why

The auto-researcher (`auto-1`, `research/edge/auto-researcher`) has two leads after 31.8 million tries and 364 holdout looks. The
first, USD/CHF block-break, was re-priced at the broker's quotes in `usdchf-blk-exec` and FAILED (-0.011R after commission). This
is the second: **USD/CHF fade, short only** (worker 4, 25 Nov 2026 06:49 UTC): a close above the previous 5 H1 highs is faded
(sell) at the next open when that open is at 20, 21 or 22 UTC; stop 0.75 x ATR(14) of H1, target 1R, out after 12 H1 candles,
one at a time, the engine's skip when the cost exceeds half the stop. Its looks: 2005-14 +0.165R (t 3.79), 2015-19 +0.147R (t 1.87),
holdout 2020 on +0.240R (t 4.18, Holm 0.0036 over the 364 looks). Every one of its entries sits in or just before the 21:00-22:00
UTC rollover, where the demo broker quotes USD/CHF about 2 pips wide, and the engine charges a flat 0.7 pip. The assumed cost is
the only thing the lead may rest on. This study fills the same orders at the broker's own bid and ask. The rule was found on these
same years (a hypothesis picked from 364 looks), so a PASS would be a lead for a forward paper record, never an edge.

## The rule (unchanged)

The lead's exact genome, `orders.mjs` (`G`). Gate, on the candle cache before any tick: the same code over 2020 on gives 257 orders
and +0.2142R, equal to the engine's own `simulate` on the same candles (the look itself, on the worker's own candle copy, said 267
and +0.240R). The window is the broker's tick history: entries from 2023-12-01 to 2026-11-20. Counted before any tick was read, on
mid candles: **127 orders**, mid mean +0.168R after the engine's cost, 1 time exit.

## The measurement (`council/tick-probe.mjs`, the `usdchf-blk-exec` method, unchanged)

Pass 1 (marks): the quote at the entry moment (looked for up to 60 s before it) and at the deadline (up to 3,600 s before it). A
sell fills at the bid: A. No entry quote = entry unresolved (left out, counted). Pass 2 (fills), only after A is known: stop
X = A + D (D = the mid risk), target T = A - 1 x D; first tick on the CLOSING side (a sell closes at the ask) crossing each level,
windows of at most 1,800 s over the 5-minute candles that come within N of a level (N = 2 x W, 10 x W inside 20:55-23:04 UTC;
W = 0.00005). A stop books at the tick's closing price (a gap fills worse), a target at T, neither by the deadline = time exit at
the deadline quote. Exit unresolved = left out, counted.

R on ticks = s x (exit - A) / D; after commission = minus 2 x 0.0000225 x A / D (the demo's raw-spread commission). Mid R beside it.

## Test and verdict (one test)

R a trade after commission, all resolved orders, t of calendar-month sums:

- **PASS**: mean > 0, month t >= 2, at least 100 resolved orders, exit-unresolved at most 10 % of the entry-resolved.
- **INCONCLUSIVE**: exit-unresolved over 10 %. **TOO FEW**: under 100 resolved. **FAIL** otherwise.

(100, not the 150 of the sister study: this rule trades less often, 127 orders in the window; said now, before any tick.)

Power, said now: with about 127 orders and a per-trade sd near 0.95R, month t 2 needs roughly +0.17R a trade; the mid figure is
+0.17R, so even a faithful fill would sit at the edge of t 2. What the study can decide is whether the broker's quotes take the
edge away (mean at or under 0). Reported beside, none of it a verdict: before commission; tick minus mid per order; the entry
spread in R (median, 90th percentile); each year; the exit mix; the orders open inside 21:00-22:59 UTC (all of them are, by
construction: reported, not split).

One run. No variant of the rule, hours or allowances on these years after the result. Deliverables: `run.mjs`, the query files,
`RESULT.md`, `result.json`, `tests/usdchf-fade-exec.test.mjs`.
