# Pre-registration: gold-bo8-exec (27 Nov 2026)

Paper research only. Nothing live changes, nothing is placed, no rule is proposed. Written and pushed alone, **before any broker
tick of these orders is read**. Owner's request (27 Nov 2026): "Yes" to pricing the researcher's gold result at the broker's quotes.

## Why

The auto-researcher (version `auto-2`) had, on 27 Nov 2026, 1.16 billion tries, about 4 million check looks, 3,802 results and
no lead. One of its strongest results with the most trades is **gold, a break of the last 8-a-side H1 swing, long only**
(`xau|bo8any|long|none|0.75|6`): an H1 close above the last unbroken swing high (8 candles a side, known 8 candles later), bought
at the next open, no hour, weekday, trend or volatility filter; stop 0.75 x ATR(14) of H1, target 6R, out after 24 H1 candles,
one at a time, the engine's skip when the cost exceeds half the stop. In the worker file: 2019-22 +0.284R (n 391, month t 2.22),
2023 on +0.646R (n 367, t 4.07), all +0.459R (n 758, t 4.49), before the engine's $0.30 cost only.

Doubts written down before this run: it was picked as one of the best of about 4 million looks (at this bar about one random rule in
forty passes by luck, so a t near 4-5 is what the best of them looks like); it is long only on gold, which rose over these years (the
gold volatility breakout and the gold buys of earlier studies are the same drift); a 6R target hit by about a quarter of the trades
makes the result rest on a few big winners. The question here is narrow: do the broker's own bid and ask, its commission and the
overnight financing on a gold buy leave the mid-candle result standing. A PASS would only make it a candidate for a forward paper
record, never an edge.

## The rule (unchanged)

The exact genome, `orders.mjs` (`G`), with the engine's own `sig` for the trigger. Gate, on the candle cache before any tick: the
same code over 2023 on gives 365 orders and +0.6545R, equal to the engine's own `simulate` (n 365, +0.6545R). The window is the
broker's tick history: entries from 2023-12-01 to 2026-11-20. Counted before any tick was read, on mid candles: **282 orders**,
mid mean +0.734R after the engine's cost ($0.30), per-trade sd 2.93R, 23 time exits, 62 reaching the target, median stop $6.34.

## The measurement (`council/tick-probe.mjs`, the `usdjpy-brk-exec` method, unchanged)

Pass 1 (marks): the quote at the entry moment (looked for up to 60 s before it) and at the deadline (up to 3,600 s before it). A
buy fills at the ask: A. No entry quote = entry unresolved (left out, counted). Pass 2 (fills), only after A is known: stop
X = A - D (D = the mid risk), target T = A + 6 x D; first bid crossing each level, windows of at most 1,800 s over the 5-minute
candles that come within N of a level (N = 2 x W, 10 x W inside 20:55-23:04 UTC; W = $0.50). A stop books at the tick's bid (a gap
fills worse), a target at T, neither by the deadline = time exit at the deadline bid. Exit unresolved = left out, counted.

R on ticks = (exit - A) / D. After costs = minus 2 x 0.000024 x A / D (commission, the figure `fade-late-tick-exec` used for gold,
conservative) minus financing: `council/fills.mjs` `nights(entry, exit)` x `FIN.xau.long` (0.000148 of the price a rollover,
Wednesday three) x A / D. Mid R beside it.

## Test and verdict (one test)

R a trade after costs, all resolved orders, t of calendar-month sums:

- **PASS**: mean > 0, month t >= 2, at least 100 resolved orders, exit-unresolved at most 10 % of the entry-resolved.
- **INCONCLUSIVE**: exit-unresolved over 10 %. **TOO FEW**: under 100 resolved. **FAIL** otherwise.

Power, said now: with about 282 orders over 36 months and a per-trade sd near 2.9R, month t 2 needs roughly +0.35R a trade; the
mid figure is +0.73R. Reported beside, none of it a verdict: before costs; tick minus mid per order; the entry spread in R; the
financing in R; each year; the exit mix; trades open inside the 21:00-22:59 UTC rollover or not.

One run. No variant of the rule, stop, target or allowances on these years after the result. Deliverables: `run.mjs`, the query
files, `RESULT.md`, `result.json`, `tests/gold-bo8-exec.test.mjs`.
