# Pre-registration: eurjpy-egr-exec (28 Nov 2026)

Paper research only. Nothing live changes, nothing is placed, no rule is proposed. Written and pushed alone, **before any broker
tick of these orders is read**. Owner's request (28 Nov 2026): "yes price the eurjpy sell".

## Why

The auto-researcher (version `auto-3`, engulf rules only, 2021 to now) had, on 28 Nov 2026, 301 million tries, 1.1 million check
looks, 2,831 results and its first 3 leads, all on EUR/JPY. The strongest sell lead is **`eurjpy|egr48|short|none|0.75|1.5`**: the
first return to a standing H1 engulf zone up to 48 candles old that closes back out on the zone's side, sells only, entry hours
10:00-15:59 UTC, the H1 ATR in the top 70 % of its last 500 readings, stop 0.75 x ATR(14), target 1.5R, out after 24 H1 candles,
one position at a time, the engine's skip when the cost exceeds half the stop. In the worker file: 2021-23 +0.389R (n 197), check
2024 on +0.377R (n 105, month t 4.44), before the engine's 0.01 yen cost only.

Doubts written down before this run: it was picked as one of the best of about 1.1 million looks (at the result bar about one random
rule in forty passes by luck; Holm was run over all of them, but the zone-age, hour and volatility choices were found together on
these years); the second sell lead (12-candle zones, 07:00-18:59 UTC, out after 96 candles) is the same idea and overlaps it; a stop
of 0.75 x ATR is about 19 yen pips, so the spread, commission and swap are a larger share of 1R than on the gold and USD/JPY rules
that passed. The question here is narrow: do the broker's own bid and ask, its commission and the swap on a EUR/JPY short leave
the mid-candle result standing. A PASS would only make it a candidate for a forward paper record, never an edge.

## The rule (unchanged)

The exact genome, `orders.mjs` (`G`), with the engine's own `sig` for the trigger. Gate, on the candle cache (OANDA mid, to
2026-11-23) before any tick: the same code over 2024 on gives 103 orders and +0.3566R, equal to the engine's own `simulate`
(n 103, +0.3566R). The window is the broker's tick history: entries from 2023-12-01 to 2026-11-20. Counted before any tick was read,
on mid candles: **106 orders**, mid mean +0.364R after the engine's cost (0.01 yen), per-trade sd 1.24R, 0 time exits, 60 reaching
the target, median stop 0.190 yen.

## The measurement (`council/tick-probe.mjs`, the `usdjpy-brk-exec` / `gold-bo8-exec` method, unchanged)

Pass 1 (marks): the quote at the entry moment (looked for up to 60 s before it) and at the deadline (up to 3,600 s before it). A
sell fills at the bid: A. No entry quote = entry unresolved (left out, counted). Pass 2 (fills), only after A is known: stop
X = A + D (D = the mid risk), target T = A - 1.5 x D; first ask crossing each level, windows of at most 1,800 s over the 5-minute
candles that come within N of a level (N = 2 x W, 10 x W inside 20:55-23:04 UTC; W = 0.01 yen). A stop books at the tick's ask (a
gap fills worse), a target at T, neither by the deadline = time exit at the deadline ask. Exit unresolved = left out, counted.

R on ticks = (A - exit) / D. After costs = minus 0.000045 x A / D (the demo's EUR/JPY commission, a round trip, from
`ctrader/symbols.json` `commissionRT`) minus the swap: `council/fills.mjs` `nights(entry, exit)` x 1.007 pips (0.01007 yen) a
unit, the demo's EUR/JPY short swap on 27 Nov 2026 (`swap.short` -1.007, Wednesday three) / D. Mid R beside it.

## Test and verdict (one test, lead 1 only)

R a trade after costs, all resolved orders of lead 1, t of calendar-month sums:

- **PASS**: mean > 0, month t >= 2, at least 100 resolved orders, exit-unresolved at most 10 % of the entry-resolved.
- **INCONCLUSIVE**: exit-unresolved over 10 %. **TOO FEW**: under 100 resolved. **FAIL** otherwise.

Power, said now: with 106 orders over 36 months and a per-trade sd near 1.24R, month t 2 needs roughly +0.25R a trade; the mid
figure is +0.36R. Only 6 orders of room above the 100-order bar: a few entries without a quote make it TOO FEW, which is then the
verdict. Reported beside, none of it a verdict: lead 2 (`G2`, 176 orders) the same way; before costs; tick minus mid per order; the
entry spread in R; the swap in R; each year; the exit mix; trades open inside the 21:00-22:59 UTC rollover or not.

One run. No variant of the rule, stop, target, hours, swap or allowances on these years after the result. Deliverables: `run.mjs`,
the query files, `RESULT.md`, `result.json`, `tests/eurjpy-egr-exec.test.mjs`.
