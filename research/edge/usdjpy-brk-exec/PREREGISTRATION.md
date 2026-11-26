# Pre-registration: usdjpy-brk-exec (26 Nov 2026)

Paper research only. Nothing live changes, nothing is placed, no rule is proposed. Written and pushed alone, **before any broker
tick of these orders is read**. Owner's request (26 Nov 2026): "usdjpy run".

## Why

The auto-researcher (`auto-1`, `research/edge/auto-researcher`) has, after about 554 million tries and 6,741 holdout looks, nine
leads, all on the Nasdaq, and one near-lead on a currency: **USD/JPY breakout, long only**. An H1 close above the previous 10 H1
highs, with the close above the 200-hour average, is bought at the next open when that open is at 07 to 12 UTC on a Tuesday,
Wednesday or Thursday; stop 3 x ATR(14) of H1, target 3R, out after 8 H1 candles, one at a time, the engine's skip when the cost
exceeds half the stop. On the candle cache: 2005-14 +0.131R (n 357), 2015-19 +0.092R (n 180), holdout 2020 on +0.211R (n 293).
Its Holm p over the holdout looks is 0.067: **not a lead by the researcher's own rule**, a near miss the owner asked to see priced.
Doubts written down before this run: Monday and Friday together make 0.000R and every weekday +0.129R (the weekday filter may be
luck); the same rule at 13-19 UTC is flat; USD/JPY rose over most of the holdout; it overlaps the USD/JPY breakout of the day that
already has a forward record. Both USD/CHF leads of the researcher were removed by the broker's quotes (`usdchf-blk-exec`,
`usdchf-fade-exec`), but those traded through the 21:00-22:59 UTC rollover with stops of a few pips; this rule enters in the
European morning with a stop of about 54 pips, so the cost is a small share of its risk. The question here is narrow: do the
broker's own bid and ask leave the mid-candle result standing. The rule was found on these same years, so a PASS would only make
it a candidate for a forward paper record, never an edge.

## The rule (unchanged)

The exact genome, `orders.mjs` (`G`). Gate, on the candle cache before any tick: the same code over 2020 on gives 293 orders and
+0.2110R, equal to the engine's own `simulate` (n 293, +0.2110R). The window is the broker's tick history: entries from 2023-12-01
to 2026-11-20. Counted before any tick was read, on mid candles: **131 orders**, mid mean +0.252R after the engine's cost (0.8
pip), per-trade sd 0.90R, 107 time exits, median stop distance 0.543. Entry hours: 07 UTC 52, 08 26, 09 21, 10 18, 11 6, 12 8.

## The measurement (`council/tick-probe.mjs`, the `usdchf-fade-exec` method, unchanged)

Pass 1 (marks): the quote at the entry moment (looked for up to 60 s before it) and at the deadline (up to 3,600 s before it). A
buy fills at the ask: A. No entry quote = entry unresolved (left out, counted). Pass 2 (fills), only after A is known: stop
X = A - D (D = the mid risk), target T = A + 3 x D; first tick on the CLOSING side (a buy closes at the bid) crossing each level,
windows of at most 1,800 s over the 5-minute candles that come within N of a level (N = 2 x W, 10 x W inside 20:55-23:04 UTC;
W = 0.005). A stop books at the tick's closing price (a gap fills worse), a target at T, neither by the deadline = time exit at
the deadline quote (the bid). Exit unresolved = left out, counted.

R on ticks = (exit - A) / D; after commission = minus 2 x 0.0000225 x A / D (the demo's raw-spread commission). Mid R beside it.
No financing is charged: a trade lasts at most 8 hours from an entry at 07-12 UTC and ends by 21:00 UTC, before the rollover.

## Test and verdict (one test)

R a trade after commission, all resolved orders, t of calendar-month sums:

- **PASS**: mean > 0, month t >= 2, at least 100 resolved orders, exit-unresolved at most 10 % of the entry-resolved.
- **INCONCLUSIVE**: exit-unresolved over 10 %. **TOO FEW**: under 100 resolved. **FAIL** otherwise.

Power, said now: with about 131 orders and a per-trade sd near 0.90R, month t 2 needs roughly +0.16R a trade; the mid figure is
+0.25R. So a faithful fill should pass, and a PASS mostly says "the cost is not what this result rests on"; it cannot answer the
doubts above (the weekday filter, the drift, the selection out of 554 million tries). Reported beside, none of it a verdict:
before commission; tick minus mid per order; the entry spread in R (median, 90th percentile); each year; the exit mix.

One run. No variant of the rule, hours, weekdays or allowances on these years after the result. Deliverables: `run.mjs`, the
query files, `RESULT.md`, `result.json`, `tests/usdjpy-brk-exec.test.mjs`.
